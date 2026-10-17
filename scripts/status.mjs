import { graphql, rest } from "./github.mjs";

const REPO = "repos/qol-tools/qol";
const INDEX = "https://qol-tools.github.io/qol/plugins/index.json";
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
const settled = new Map();
async function jobs(token, run) {
  const key = `${run.id}/${run.run_attempt}`;
  if (settled.has(key)) return settled.get(key);
  const list = [];
  for (let page = 1; ; page++) {
    const body = await rest(token, `${REPO}/actions/runs/${run.id}/jobs?per_page=${JOB_PAGE}&page=${page}`);
    list.push(...body.jobs);
    if (body.jobs.length < JOB_PAGE || list.length >= body.total_count) break;
  }
  if (run.status === "completed") settled.set(key, list);
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
  return { name: "queue", fact: entries.length ? `${entries.length} waiting to merge` : "nothing waiting to merge", rows, waiting: entries.length };
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

function nameOf(run) {
  const pull = run.head_commit?.message.split("\n")[0].match(PULL)?.[1];
  return pull ? `#${pull}` : run.head_sha.slice(0, 7);
}

async function mergeOf(token, run) {
  const list = run ? await jobs(token, run) : [];
  const named = (match) => list.filter((job) => match.test(job.name) && state(job) !== "skip");
  return { run, name: run && nameOf(run), named, decided: state(named(/^Prepare /)[0] ?? {}) === "ok" };
}

function history(token, versionRuns) {
  const seen = [];
  return {
    seen,
    async find(test) {
      for (let k = 0; k < versionRuns.length; k++) {
        seen[k] ??= await mergeOf(token, versionRuns[k]);
        if (await test(seen[k])) return seen[k];
      }
      return null;
    },
  };
}

async function currentMerge(token, past, versionRuns) {
  const main = (await runs(token, "ci.yml", 10, "&event=push&branch=main")).find((run) => state(run) !== "skip");
  if (!main) throw new Error("no tests run on main");
  const run = versionRuns.find((item) => item.head_sha === main.head_sha);
  return { main, ...(run ? await past.find((merge) => merge.run.id === run.id) : { ...(await mergeOf(token, null)), name: nameOf(main) }) };
}

const finished = (list) => list.length > 0 && list.every((job) => state(job) === "ok" || state(job) === "bad");
function newer(merges, shown) {
  const at = merges.findIndex((merge) => merge.run.id === shown.run?.id);
  return at < 0 ? merges : merges.slice(0, at);
}
const replaced = (merges, shown, match) => newer(merges, shown).some((merge) => merge.decided && merge.named(match).length > 0);
const incoming = (past, current, shown) => past.queued > 0 || !current.run || newer(past.seen, shown).some((merge) => !merge.decided);
const look = (past, current, shown, done, match) => done && (replaced(past.seen, shown, match) || incoming(past, current, shown));

function dispatchedBy(run, list) {
  const start = Date.parse(run.run_started_at);
  const end = run.status === "completed" ? Date.parse(run.updated_at) + DISPATCH_SLACK : Infinity;
  return list.filter((item) => item.event === "workflow_dispatch" && Date.parse(item.created_at) >= start && Date.parse(item.created_at) <= end);
}

async function versioning(merge, past, trays, now) {
  const { main, run, named, decided } = merge;
  const candidates = named(/^Candidate /);
  const tags = [...new Set(candidates.map((job) => job.name.match(CANDIDATE)?.[1]).filter(Boolean))];
  const tray = run ? dispatchedBy(run, trays)[0] : undefined;
  const trayTag = tray?.display_title.match(/qol-tray-v\d+\.\d+\.\d+/)?.[0] ?? (candidates.some((job) => job.name.startsWith("Candidate qol-tray")) ? "qol-tray" : null);
  const versions = [...(trayTag ? [trayTag] : []), ...tags];
  const tagged = named(/^Attest, tag/);
  const fact = !run
    ? state(main) === "ok" ? `${merge.name} starts` : `${merge.name} waits for main's tests`
    : !decided
      ? `${merge.name} choosing new versions`
      : versions.length
        ? `${merge.name} chose ${plural(versions.length, "new version")}`
        : `${merge.name} chose no new versions`;
  const stale = merge.run?.status === "completed" && incoming(past, merge, merge);
  return {
    name: "versions",
    fact,
    stale,
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

async function trayLane(token, past, current, trays, now) {
  const built = (lane) => worst(lane.builds.map((item) => item.state));
  const builder = (await past.find((merge) => started(merge.named(TRAY_CANDIDATE)))) ?? current;
  const lane = await trayOf(token, builder, trays, now);
  const building = look(past, current, builder, finished(lane.list), TRAY_CANDIDATE);
  const tray = {
    name: "qol-tray",
    fact: built(lane) === "ok" ? `${builder.name} built ${lane.version}` : built(lane) === "bad" ? `${builder.name}: ${lane.version} failed to build` : `${builder.name} building ${lane.version}`,
    rows: lane.builds,
    stale: building,
  };
  let out = lane;
  await past.find(async (merge) => {
    if (!merge.named(TRAY_CANDIDATE).length) return false;
    const candidate = merge === builder ? lane : await trayOf(token, merge, trays, now);
    if (started(candidate.steps)) out = candidate;
    return started(candidate.steps);
  });
  const releasing = look(past, current, out.merge, out.publish.state === "ok" || out.publish.state === "bad", TRAY_CANDIDATE);
  const released = {
    name: "released",
    fact: {
      ok: `${out.version} out since ${out.merge.name}`,
      run: `${out.merge.name} releasing ${out.version}`,
      bad: `${out.merge.name}: ${out.version} did not release`,
      wait: built(out) === "bad" ? `${out.merge.name}: ${out.version} did not build` : `${out.version} waits for ${out.merge.name}'s builds`,
    }[out.publish.state],
    rows: [out.publish],
    stale: releasing,
  };
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

const LISTED = 4;
const BUMP = /^chore\(plugins\): bump plugin versions/;
const touched = new Map();

async function pulls(token, merge, wave) {
  if (wave.length > LISTED) return;
  await Promise.all(
    wave.map(async (item) => {
      const key = `${merge.run.head_sha}/${item.id}`;
      if (!touched.has(key)) touched.set(key, await rest(token, `${REPO}/commits?sha=${merge.run.head_sha}&path=plugins/${item.id.replace(/^qol-/, "")}&per_page=10`));
      const subjects = touched.get(key).map((commit) => commit.commit.message.split("\n")[0]);
      const pull = subjects.slice(0, (subjects.findIndex((line) => BUMP.test(line)) + 1 || subjects.length + 1) - 1).map((line) => line.match(PULL)?.[1]).find(Boolean);
      item.pull = pull ? `#${pull}` : merge.name;
    }),
  );
}

const grouped = (wave, row) =>
  [...new Set(wave.map((item) => item.pull))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .flatMap((pull) => [{ name: pull, note: true }, ...wave.filter((item) => item.pull === pull).map(row)]);
const versionOf = (item) => release(item.tag).replace(/^qol-/, "");

function pluginLane(qol, merge, wave, releases, now) {
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
  const fact = !merge.decided
    ? `${merge.name} waits for new versions`
    : !wave.length
      ? `${merge.name} changed no plugins`
      : building
        ? `${merge.name} building ${plural(wave.length, "version")}`
        : `${merge.name} built ${plural(wave.length, "version")}`;
  const rows = [];
  if (wave.length && wave.length <= LISTED) rows.push(...grouped(wave, (item) => ({ name: versionOf(item), state: item.state, time: took(item.list.map(jobSpan), now) })));
  else if (built) rows.push({ name: built === 1 ? wave.find((item) => item.state === "ok").tag.replace(/-v.*/, "") : `${built} built`, state: "ok", time: took(wave.filter((item) => item.state === "ok").flatMap((item) => item.list.map(jobSpan)), now) });
  if (building) rows.push({ name: `${building} building`, state: "run", time: took(wave.filter((item) => item.state === "run").flatMap((item) => item.list.map(jobSpan)), now) });
  if (failed.length && wave.length > LISTED) rows.push({ name: `${listed(failed.map(name))} failed`, state: "bad", time: "" });
  if (merge.decided && items.length > wave.length) rows.push({ name: `${items.length - wave.length} had no change`, note: true });
  return { name: "plugins", fact, squares: items.map((item) => item.state), rows };
}

const pushesOf = async (token, wave) =>
  (await Promise.all(wave.filter((item) => item.run).map((item) => jobs(token, item.run))))
    .flat()
    .filter((job) => job.name === "Publish registry artifact" && state(job) !== "skip");

async function stored(token, wave, name, now) {
  if (wave.length > LISTED) return [piece(name, await pushesOf(token, wave), now)];
  const pushes = await Promise.all(wave.map((item) => pushesOf(token, [item])));
  return grouped(wave, (item) => piece(versionOf(item), pushes[wave.indexOf(item)], now));
}

async function registry(token, merge, wave, shown, now) {
  const pushes = await pushesOf(token, wave);
  const name = !merge.decided ? "new versions stored" : wave.length === 1 ? `${release(wave[0].tag)} stored` : `${plural(wave.length, "new version")} stored`;
  const rows = wave.length ? await stored(token, wave, name, now) : [piece(name, pushes, now)];
  const fact = finished(pushes) ? `${merge.name} stored ${plural(wave.length, "version")}` : `${merge.name} storing ${plural(wave.length, "version")}`;
  return { name: "registry", fact, rows, stale: shown };
}

const INDEX_STEP = { build: "list", sign: "sign", deploy: "publish" };

async function index(token, past, current, count, signed, now) {
  const recent = (await runs(token, "plugin-index.yml", 10)).filter((run) => state(run) !== "skip");
  let run = null;
  let list = [];
  for (const item of recent) {
    list = await jobs(token, item);
    if (started(list)) {
      run = item;
      break;
    }
  }
  const rows = Object.entries(INDEX_STEP).map(([job, step]) => piece(step, (run ? list : []).filter((entry) => entry.name.split(" ")[0].toLowerCase() === job), now));
  const owner = run ? ((await past.find((merge) => Date.parse(merge.run.run_started_at) <= Date.parse(run.created_at))) ?? current) : current;
  const shown = look(past, current, owner, run?.status === "completed", CANDIDATE);
  const fact = `${owner.name} ${run?.status === "completed" ? "published" : "publishing"} ${count} plugins${signed ? "" : ", unsigned"}`;
  return { name: "index", fact, rows, stale: shown };
}

export async function buildBoard(token, qol, now = Date.now()) {
  const [response, signature, releases, trays, versionRuns] = await Promise.all([
    fetch(INDEX),
    fetch(`${INDEX}.minisig`, { method: "HEAD" }),
    runs(token, "release.yml", 60),
    runs(token, "qol-tray-release.yml", 10),
    runs(token, "plugin-version.yml", 50, "&event=workflow_run").then((list) => list.filter((run) => state(run) !== "skip" && run.conclusion !== "cancelled")),
  ]);
  if (!response.ok) throw new Error(`${INDEX} answered ${response.status}`);
  const past = history(token, versionRuns);
  const queue = await mergeQueue(token, now);
  past.queued = queue.waiting;
  const merge = await currentMerge(token, past, versionRuns);
  const builder = (await past.find((item) => started(item.named(CANDIDATE)))) ?? merge;
  const wave = waveOf(builder, releases);
  const keeper = (await past.find(async (item) => item.named(CANDIDATE).length > 0 && started(await pushesOf(token, waveOf(item, releases))))) ?? builder;
  const kept = waveOf(keeper, releases);
  await Promise.all([pulls(token, builder, wave), pulls(token, keeper, kept)]);
  const building = look(past, merge, builder, finished(builder.named(CANDIDATE)), CANDIDATE);
  const plugins = { ...pluginLane(qol, builder, wave, releases, now), stale: building };
  const storing = look(past, merge, keeper, finished(await pushesOf(token, kept)), CANDIDATE);
  const [prs, landed, versions, tray, store, published] = await Promise.all([
    pullRequests(token),
    merged(token, now),
    versioning(merge, past, trays, now),
    trayLane(token, past, merge, trays, now),
    registry(token, keeper, kept, storing, now),
    index(token, past, merge, Object.keys((await response.json()).plugins).length, signature.ok, now),
  ]);
  return {
    change: [prs, queue, landed, versions],
    plugins: [plugins, store, published],
    tray: [tray.tray, tray.released],
  };
}
