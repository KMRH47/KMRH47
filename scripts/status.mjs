import { graphql, rest } from "./github.mjs";

const REPO = "repos/qol-tools/qol";
const INDEX = "https://qol-tools.github.io/qol/plugins/index.json";
const REGISTRY = "https://ghcr.io";
const PACKAGE = "qol-tools/plugins";
const CANDIDATE = /^Candidate (qol-[a-z0-9-]+?-v\d+\.\d+\.\d+) \(/;
const TRAY_CANDIDATE = /^Candidate qol-tray \(/;
const DISPATCH_SLACK = 2 * 60 * 1000;
const JOB_PAGE = 50;
const RANK = { ok: 0, wait: 1, run: 2, bad: 3 };
const PLATFORMS = [
  ["Linux", /ubuntu|linux/i],
  ["macOS", /macos/i],
  ["Windows", /windows/i],
];

const runs = async (token, workflow, count, filter = "") =>
  (await rest(token, `${REPO}/actions/workflows/${workflow}/runs?per_page=${count}${filter}`)).workflow_runs;
const finished = new Map();
async function jobs(token, run) {
  const key = `${run.id}/${run.run_attempt}`;
  if (finished.has(key)) return finished.get(key);
  const list = [];
  for (let page = 1; ; page++) {
    const body = await rest(token, `${REPO}/actions/runs/${run.id}/jobs?per_page=${JOB_PAGE}&page=${page}`);
    list.push(...body.jobs);
    if (body.jobs.length < JOB_PAGE || list.length >= body.total_count) break;
  }
  if (run.status === "completed") finished.set(key, list);
  return list;
}

function state({ status, conclusion }) {
  if (status === "in_progress") return "run";
  if (status !== "completed") return "wait";
  if (conclusion === "success") return "ok";
  return conclusion === "skipped" ? "skip" : "bad";
}

const platform = (name) => PLATFORMS.findIndex(([, match]) => match.test(name));

const worst = (states) => states.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "ok");

function took(spans, now) {
  const started = spans.map(([start]) => start).filter(Boolean);
  if (!started.length) return "";
  const running = spans.some(([, end]) => !end);
  const ms = (running ? now : Math.max(...spans.map(([, end]) => Date.parse(end)))) - Math.min(...started.map(Date.parse));
  return ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60000)} min`;
}

const jobSpan = (job) => [job.started_at, job.status === "completed" ? job.completed_at : null];
const runSpan = (run) => [run.run_started_at, run.status === "completed" ? run.updated_at : null];

function piece(name, list, now) {
  const pieceState = list.length ? worst(list.map(state)) : "wait";
  return { name, state: pieceState, time: pieceState === "wait" ? "" : took(list.map(jobSpan), now) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso) => {
  const date = new Date(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
};
const subject = (title) => title.replace(/^[a-z]+(\([^)]*\))?!?: /, "");
const release = (tag) => tag.replace(/-v(\d+\.\d+\.\d+)$/, " $1");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const listed = (names) => (names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

async function pullRequests(token) {
  const data = await graphql(
    token,
    `query { repository(owner: "qol-tools", name: "qol") { pullRequests(states: OPEN, first: 20, orderBy: { field: UPDATED_AT, direction: DESC }) { nodes { number title isDraft isInMergeQueue commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } } } } }`,
  );
  const open = data.repository.pullRequests.nodes.filter((pull) => !pull.isInMergeQueue);
  const rows = open.slice(0, 3).map((pull) => {
    const rollup = pull.commits.nodes[0]?.commit.statusCheckRollup?.state;
    const [rowState, time] = pull.isDraft
      ? ["wait", "draft"]
      : rollup === "SUCCESS"
        ? ["ok", "passed"]
        : rollup === "FAILURE" || rollup === "ERROR"
          ? ["bad", "failed"]
          : ["run", "checking"];
    return { name: `#${pull.number} ${subject(pull.title)}`, state: rowState, time };
  });
  return {
    name: "PRs",
    fact: open.length ? `${open.length} open` : "none open",
    rows: rows.length ? rows : [{ name: "nothing open", note: true }],
  };
}

async function mergeTests(token, now) {
  for (const run of await runs(token, "ci.yml", 10, "&event=merge_group")) {
    const ran = (await jobs(token, run)).filter((job) => /^(lint|release build|sandbox)/.test(job.name) && state(job) !== "skip");
    if (!ran.length) continue;
    return PLATFORMS.map(([name, match]) => [name, ran.filter((job) => match.test(job.name))])
      .filter(([, list]) => list.length)
      .map(([name, list]) => piece(name, list, now));
  }
  throw new Error("no merge queue CI run ran tests");
}

async function mergeQueue(token, now) {
  const [entries, tests] = await Promise.all([
    graphql(
      token,
      `query { repository(owner: "qol-tools", name: "qol") { mergeQueue(branch: "main") { entries(first: 10) { nodes { state pullRequest { number title } } } } } }`,
    ).then((data) => data.repository.mergeQueue?.entries.nodes ?? []),
    mergeTests(token, now),
  ]);
  const front = entries[0];
  const testing = front?.state === "AWAITING_CHECKS";
  const rows = entries.slice(0, 2).map((entry, index) => ({
    name: `#${entry.pullRequest.number} ${subject(entry.pullRequest.title)}`,
    state: index === 0 && testing ? "run" : "wait",
    time: index === 0 && testing ? "testing" : "waiting",
  }));
  rows.push({ name: front ? `tests on #${front.pullRequest.number}` : "last merge tested on", note: true }, ...tests);
  return { name: "queue", fact: entries.length ? `${entries.length} waiting to merge` : "nothing waiting to merge", rows };
}

async function merged(token, now) {
  const since = new Date(now - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const search = rest(token, `search/issues?q=${encodeURIComponent(`repo:qol-tools/qol is:pr is:merged merged:>=${since}`)}`);
  const pulls = (await rest(token, `${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=30`))
    .filter((pull) => pull.merged_at)
    .sort((a, b) => Date.parse(b.merged_at) - Date.parse(a.merged_at));
  const count = (await search).total_count;
  return {
    name: "merged",
    fact: `${count} in 30 days`,
    rows: pulls.slice(0, 2).map((pull) => ({ name: `#${pull.number} ${subject(pull.title)}`, state: "ok", time: day(pull.merged_at), still: true })),
  };
}

const PULL = /\(#(\d+)\)/;
const started = (list) => list.some((job) => state(job) !== "wait");

async function mergeOf(token, run) {
  const list = run ? await jobs(token, run) : [];
  const named = (match) => list.filter((job) => match.test(job.name) && state(job) !== "skip");
  const pull = run?.head_commit?.message.split("\n")[0].match(PULL)?.[1];
  return { run, name: pull ? `#${pull}` : run?.head_sha.slice(0, 7), named, decided: state(named(/^Prepare /)[0] ?? {}) === "ok" };
}

async function currentMerge(token, versionRuns) {
  const main = (await runs(token, "ci.yml", 10, "&event=push&branch=main")).find((run) => state(run) !== "skip");
  if (!main) throw new Error("no tests run on main");
  return { main, ...(await mergeOf(token, versionRuns.find((item) => item.head_sha === main.head_sha))) };
}

async function lastMerge(token, versionRuns, current, match) {
  for (const run of versionRuns.slice(current.run ? versionRuns.indexOf(current.run) + 1 : 0)) {
    const merge = await mergeOf(token, run);
    if (merge.named(match).length) return merge;
  }
  return null;
}

function dispatchedBy(run, list) {
  const start = Date.parse(run.run_started_at);
  const end = run.status === "completed" ? Date.parse(run.updated_at) + DISPATCH_SLACK : Infinity;
  return list.filter((item) => item.event === "workflow_dispatch" && Date.parse(item.created_at) >= start && Date.parse(item.created_at) <= end);
}

async function versioning(merge, trays, now) {
  const { main, run, named, decided } = merge;
  const candidates = named(/^Candidate /);
  const tags = [...new Set(candidates.map((job) => job.name.match(CANDIDATE)?.[1]).filter(Boolean))];
  const tray = run ? dispatchedBy(run, trays)[0] : undefined;
  const trayTag = tray?.display_title.match(/qol-tray-v\d+\.\d+\.\d+/)?.[0] ?? (candidates.some((job) => job.name.startsWith("Candidate qol-tray")) ? "qol-tray" : null);
  const versions = [...(trayTag ? [trayTag] : []), ...tags];
  const tagged = named(/^Attest, tag/);
  const fact = !run ? (state(main) === "ok" ? "starting" : "waits for main's tests") : !decided ? "choosing new versions" : versions.length ? `${versions.length} new version${versions.length === 1 ? "" : "s"}` : "no new versions";
  return {
    name: "versions",
    fact,
    rows: [
      { name: "tests on main", state: state(main), time: took([runSpan(main)], now) },
      piece("new numbers", named(/^Prepare /), now),
      piece("builds", candidates, now),
      piece("tags", tagged, now),
    ],
  };
}

async function trayOf(token, merge, trays, now) {
  const list = merge.named(TRAY_CANDIDATE);
  const run = merge.run && dispatchedBy(merge.run, trays)[0];
  const version = run?.display_title.match(/qol-tray-v(\d+\.\d+\.\d+)/)?.[1] ?? "the next version";
  const builds = list.sort((a, b) => platform(a.name) - platform(b.name)).map((job) => piece(PLATFORMS[platform(job.name)][0], [job], now));
  const steps = (run ? await jobs(token, run) : []).filter((job) => job.name === "Create GitHub Release" || job.name.startsWith("Verify "));
  return { merge, list, version, builds, steps, publish: piece("GitHub release", steps, now) };
}

async function trayLane(token, merge, last, trays, now) {
  const current = await trayOf(token, merge, trays, now);
  const before = last ? await trayOf(token, last, trays, now) : current;
  const built = (lane) => worst(lane.builds.map((item) => item.state));
  const tray = started(current.list) || !last
    ? { name: "qol-tray", fact: built(current) === "ok" ? `${current.version} built` : built(current) === "bad" ? `${current.version} failed to build` : `building ${current.version}`, rows: current.builds }
    : { name: "qol-tray", fact: `${last.name} built ${before.version}`, rows: before.builds, stale: true };
  const releasing = started(current.steps) || !last ? current : null;
  const released = releasing
    ? {
        name: "released",
        fact: {
          ok: `users can download ${current.version}`,
          run: `releasing ${current.version}`,
          bad: `${current.version} did not release`,
          wait: built(current) === "bad" ? `${current.version} did not build` : `${current.version} waits for its builds`,
        }[current.publish.state],
        rows: [current.publish],
      }
    : { name: "released", fact: `${before.version} out since ${last.name}`, rows: [before.publish], stale: true };
  return { tray, released };
}

function waveOf(merge, releases) {
  const byTag = new Map();
  for (const job of merge?.named(CANDIDATE) ?? []) {
    const tag = job.name.match(CANDIDATE)[1];
    byTag.set(tag, [...(byTag.get(tag) ?? []), job]);
  }
  return [...byTag].map(([tag, list]) => ({
    id: tag.replace(/-v\d+\.\d+\.\d+$/, ""),
    tag,
    list,
    state: worst(list.map(state)),
    run: releases.find((item) => item.display_title === `Release ${tag}`),
  }));
}

function pluginLane(qol, merge, wave, releases, now, stale) {
  const byPlugin = new Map(wave.map((item) => [item.id, item]));
  const items = qol.plugins.map((plugin) => {
    const fresh = byPlugin.get(plugin.id);
    if (fresh) return fresh;
    if (!merge.decided) return { state: "wait" };
    const last = releases.find((run) => run.display_title.startsWith(`Release ${plugin.id}-v`));
    return { state: last && state(last) === "bad" ? "bad" : "idle" };
  });
  const count = (s) => wave.filter((item) => item.state === s).length;
  const built = count("ok");
  const building = count("run") + count("wait");
  const failed = wave.filter((item) => item.state === "bad");
  const name = (item) => qol.plugins.find((plugin) => plugin.id === item.id)?.name ?? item.id;
  const fact = stale
    ? `${merge.name} built ${plural(wave.length, "version")}`
    : !merge.decided
      ? "waits for new versions"
      : !wave.length
        ? "no new versions"
        : building
          ? `building ${plural(building, "new version")}`
          : wave.length === 1
            ? `${release(wave[0].tag)} built`
            : `${plural(built, "new version")} built`;
  const rows = [];
  if (built) rows.push({ name: built === 1 ? wave.find((item) => item.state === "ok").tag.replace(/-v.*/, "") : `${built} built`, state: "ok", time: took(wave.filter((item) => item.state === "ok").flatMap((item) => item.list.map(jobSpan)), now) });
  if (building) rows.push({ name: `${building} building`, state: "run", time: took(wave.filter((item) => item.state === "run").flatMap((item) => item.list.map(jobSpan)), now) });
  if (failed.length) rows.push({ name: `${listed(failed.map(name))} failed`, state: "bad", time: "" });
  if (merge.decided && items.length > wave.length) rows.push({ name: `${items.length - wave.length} had no change`, note: true });
  return { name: "plugins", fact, squares: items.map((item) => item.state), rows, stale };
}

const pushesOf = async (token, wave) =>
  (await Promise.all(wave.filter((item) => item.run).map((item) => jobs(token, item.run))))
    .flat()
    .filter((job) => job.name === "Publish registry artifact" && state(job) !== "skip");

async function registry(token, merge, wave, last, lastWave, now) {
  const pushes = await pushesOf(token, wave);
  if (!started(pushes) && last) {
    const before = await pushesOf(token, lastWave);
    return { name: "registry", fact: `${last.name} stored ${plural(lastWave.length, "version")}`, rows: [piece(`${plural(lastWave.length, "version")} stored`, before, now)], stale: true };
  }
  const auth = await (await fetch(`${REGISTRY}/token?scope=repository:${PACKAGE}:pull`)).json();
  const tags = await (await fetch(`${REGISTRY}/v2/${PACKAGE}/tags/list?n=10000`, { headers: { authorization: `Bearer ${auth.token}` } })).json();
  if (!Array.isArray(tags.tags)) throw new Error(`ghcr.io listed no tags for ${PACKAGE}`);
  const name = !merge.decided ? "new versions stored" : wave.length === 1 ? `${release(wave[0].tag)} stored` : `${plural(wave.length, "new version")} stored`;
  return { name: "registry", fact: `${tags.tags.length} versions on ghcr.io`, rows: [piece(name, pushes, now)] };
}

const INDEX_STEP = { build: "list", sign: "sign", deploy: "publish" };

async function index(token, merge, last, count, signed, now) {
  const since = merge.run ? Date.parse(merge.run.run_started_at) : Infinity;
  const recent = await runs(token, "plugin-index.yml", 10);
  const steps = async (run) => {
    const list = run ? await jobs(token, run) : [];
    return { list, rows: Object.entries(INDEX_STEP).map(([job, step]) => piece(step, list.filter((entry) => entry.name.split(" ")[0].toLowerCase() === job), now)) };
  };
  const current = await steps(recent.find((item) => Date.parse(item.created_at) >= since));
  if (started(current.list) || !last) return { name: "index", fact: signed ? `${count} plugins for users` : `${count} plugins, unsigned`, rows: current.rows };
  const before = await steps(recent.find((item) => Date.parse(item.created_at) < since && state(item) !== "skip"));
  return { name: "index", fact: `${last.name} published`, rows: before.rows, stale: true };
}

export async function buildBoard(token, qol, now = Date.now()) {
  const [response, signature, releases, trays, versionRuns] = await Promise.all([
    fetch(INDEX),
    fetch(`${INDEX}.minisig`, { method: "HEAD" }),
    runs(token, "release.yml", 60),
    runs(token, "qol-tray-release.yml", 10),
    runs(token, "plugin-version.yml", 50, "&event=workflow_run").then((list) => list.filter((run) => state(run) !== "skip")),
  ]);
  if (!response.ok) throw new Error(`${INDEX} answered ${response.status}`);
  const merge = await currentMerge(token, versionRuns);
  const [lastPlugins, lastTray] = await Promise.all([lastMerge(token, versionRuns, merge, CANDIDATE), lastMerge(token, versionRuns, merge, TRAY_CANDIDATE)]);
  const wave = waveOf(merge, releases);
  const lastWave = waveOf(lastPlugins, releases);
  const fresh = started(merge.named(CANDIDATE)) || !lastPlugins;
  const plugins = fresh ? pluginLane(qol, merge, wave, releases, now, false) : pluginLane(qol, lastPlugins, lastWave, releases, now, true);
  const [prs, queue, landed, versions, tray, store, published] = await Promise.all([
    pullRequests(token),
    mergeQueue(token, now),
    merged(token, now),
    versioning(merge, trays, now),
    trayLane(token, merge, lastTray, trays, now),
    registry(token, merge, wave, lastPlugins, lastWave, now),
    index(token, merge, lastPlugins, Object.keys((await response.json()).plugins).length, signature.ok, now),
  ]);
  return {
    change: [prs, queue, landed, versions],
    plugins: [plugins, store, published],
    tray: [tray.tray, tray.released],
  };
}
