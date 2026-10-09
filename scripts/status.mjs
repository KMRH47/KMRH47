import { graphql, rest } from "./github.mjs";

const REPO = "repos/qol-tools/qol";
const INDEX = "https://qol-tools.github.io/qol/plugins/index.json";
const REGISTRY = "https://ghcr.io";
const PACKAGE = "qol-tools/plugins";
const WAVE = 10 * 60 * 1000;
const DISPATCH_SLACK = 2 * 60 * 1000;
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
  const list = (await rest(token, `${REPO}/actions/runs/${run.id}/jobs?per_page=100`)).jobs;
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

function dispatchedBy(run, list) {
  const start = Date.parse(run.run_started_at);
  const end = run.status === "completed" ? Date.parse(run.updated_at) + DISPATCH_SLACK : Infinity;
  return list.filter((item) => item.event === "workflow_dispatch" && Date.parse(item.created_at) >= start && Date.parse(item.created_at) <= end);
}

async function versioning(token, trays, now) {
  const main = (await runs(token, "ci.yml", 10, "&event=push&branch=main")).find((run) => state(run) !== "skip");
  if (!main) throw new Error("no tests run on main");
  const run = (await runs(token, "plugin-version.yml", 20, "&event=workflow_run")).find((item) => item.head_sha === main.head_sha && state(item) !== "skip");
  const list = run ? await jobs(token, run) : [];
  const named = (match) => list.filter((job) => match.test(job.name) && state(job) !== "skip");
  const candidates = named(/^Candidate /);
  const tags = [...new Set(candidates.map((job) => job.name.match(/^Candidate (qol-[a-z0-9-]+?-v\d+\.\d+\.\d+) \(/)?.[1]).filter(Boolean))];
  const tray = run ? dispatchedBy(run, trays)[0] : undefined;
  const trayTag = tray?.display_title.match(/qol-tray-v\d+\.\d+\.\d+/)?.[0] ?? (candidates.some((job) => job.name.startsWith("Candidate qol-tray")) ? "qol-tray" : null);
  const versions = [...(trayTag ? [trayTag] : []), ...tags];
  const tagged = named(/^Attest, tag/);
  const decided = state({ status: named(/^Prepare /)[0]?.status, conclusion: named(/^Prepare /)[0]?.conclusion }) === "ok";
  const fact = !run ? (state(main) === "ok" ? "starting" : "waits for main's tests") : !decided ? "choosing new versions" : versions.length ? `${versions.length} new version${versions.length === 1 ? "" : "s"}` : "no new versions";
  return {
    name: "versions",
    fact,
    rows: [
      { name: "tests on main", state: state(main), time: took([runSpan(main)], now) },
      piece("what changed", named(/^(Plan binary probes|Probe )/), now),
      piece("new numbers", named(/^Prepare /), now),
      piece("trial builds", candidates, now),
      piece("tags", tagged, now),
    ],
  };
}

async function trayLane(token, now) {
  const [run, previous] = await runs(token, "qol-tray-release.yml", 2);
  const version = run.display_title.match(/qol-tray-v(\d+\.\d+\.\d+)/)?.[1];
  if (!version) throw new Error(`qol-tray release run ${run.id} names no version: ${run.display_title}`);
  let list = await jobs(token, run);
  if (!list.some((job) => job.name.startsWith("Build ")) && previous) list = (await jobs(token, previous)).map((job) => ({ ...job, status: run.status, conclusion: run.conclusion, started_at: null }));
  const builds = list
    .filter((job) => job.name.startsWith("Build ") || (job.name.startsWith("Verify ") && ["bad", "run"].includes(state(job))))
    .sort((a, b) => platform(a.name) - platform(b.name))
    .map((job) => piece(job.name.replace(/^Build /, "").replace(/ release$/, ""), [job], now));
  const publish = piece("GitHub release", list.filter((job) => job.name === "Create GitHub Release"), now);
  const built = worst(builds.map((item) => item.state));
  const releasedFact = {
    ok: `users can download ${version}`,
    run: `releasing ${version}`,
    bad: `${version} did not release`,
    wait: built === "bad" ? `${version} did not build` : `${version} waits for its builds`,
  }[publish.state];
  return {
    tray: { name: "qol-tray", fact: built === "ok" ? `${version} built` : built === "bad" ? `${version} failed to build` : `building ${version}`, rows: builds },
    released: { name: "released", fact: releasedFact, rows: [publish] },
    run,
  };
}

function pluginLane(qol, releases, now) {
  const latest = new Map();
  for (const run of releases) {
    const tag = run.display_title.match(/^Release (qol-[a-z0-9-]+-v\d+\.\d+\.\d+)$/)?.[1];
    const id = tag?.replace(/-v\d+\.\d+\.\d+$/, "");
    if (id && !latest.has(id)) latest.set(id, { run, tag });
  }
  const newest = Math.max(...[...latest.values()].map(({ run }) => Date.parse(run.created_at)));
  const items = qol.plugins.map((plugin) => {
    const found = latest.get(plugin.id);
    if (!found) return { name: plugin.name, state: "idle" };
    const fresh = Date.parse(found.run.created_at) > newest - WAVE;
    const runState = state(found.run);
    return { name: plugin.name, state: fresh ? runState : runState === "ok" ? "idle" : runState, run: found.run, tag: found.tag, fresh };
  });
  const wave = items.filter((item) => item.fresh);
  const count = (s) => wave.filter((item) => item.state === s).length;
  const built = count("ok");
  const building = count("run") + count("wait");
  const failed = wave.filter((item) => item.state === "bad");
  const fact = building
    ? `building ${building} new version${building === 1 ? "" : "s"}`
    : wave.length === 1
      ? `${release(wave[0].tag)} built`
      : `${built} new version${built === 1 ? "" : "s"} built`;
  const rows = [];
  if (built) rows.push({ name: built === 1 ? wave.find((item) => item.state === "ok").tag.replace(/-v.*/, "") : `${built} built`, state: "ok", time: took(wave.filter((item) => item.state === "ok").map((item) => runSpan(item.run)), now) });
  if (building) rows.push({ name: `${building} building`, state: "run", time: took(wave.filter((item) => item.state === "run").map((item) => runSpan(item.run)), now) });
  if (failed.length) rows.push({ name: `${listed(failed.map((item) => item.name))} failed`, state: "bad", time: "" });
  if (items.length > wave.length) rows.push({ name: `${items.length - wave.length} had no change`, note: true });
  return { tile: { name: "plugins", fact, squares: items.map((item) => item.state), rows }, wave };
}

async function registry(token, wave, now) {
  const pushes = (await Promise.all(wave.map((item) => jobs(token, item.run))))
    .flat()
    .filter((job) => job.name === "Publish registry artifact" && state(job) !== "skip");
  const auth = await (await fetch(`${REGISTRY}/token?scope=repository:${PACKAGE}:pull`)).json();
  const tags = await (await fetch(`${REGISTRY}/v2/${PACKAGE}/tags/list?n=10000`, { headers: { authorization: `Bearer ${auth.token}` } })).json();
  if (!Array.isArray(tags.tags)) throw new Error(`ghcr.io listed no tags for ${PACKAGE}`);
  const name = wave.length === 1 ? `${release(wave[0].tag)} stored` : `${wave.length} new versions stored`;
  return { name: "registry", fact: `${tags.tags.length} versions on ghcr.io`, rows: [piece(name, pushes, now)] };
}

const INDEX_STEP = { build: "list", sign: "sign", deploy: "publish" };

async function index(token, count, signed, now) {
  const recent = await runs(token, "plugin-index.yml", 10);
  const run = recent[0];
  let rows = [];
  for (const item of recent) {
    const list = await jobs(token, item);
    if (!list.length) continue;
    rows = Object.entries(INDEX_STEP).map(([job, step]) => piece(step, list.filter((entry) => entry.name.split(" ")[0].toLowerCase() === job), now));
    if (item !== run) rows = rows.map((line) => ({ ...line, state: "wait", time: "" }));
    break;
  }
  return { name: "index", fact: signed ? `${count} plugins for users` : `${count} plugins, unsigned`, rows };
}


export async function buildBoard(token, qol, now = Date.now()) {
  const [response, signature, releases, trays] = await Promise.all([
    fetch(INDEX),
    fetch(`${INDEX}.minisig`, { method: "HEAD" }),
    runs(token, "release.yml", 60),
    runs(token, "qol-tray-release.yml", 5),
  ]);
  if (!response.ok) throw new Error(`${INDEX} answered ${response.status}`);
  const plugins = pluginLane(qol, releases, now);
  const [prs, queue, landed, versions, tray, store, published] = await Promise.all([
    pullRequests(token),
    mergeQueue(token, now),
    merged(token, now),
    versioning(token, trays, now),
    trayLane(token, now),
    registry(token, plugins.wave, now),
    index(token, Object.keys((await response.json()).plugins).length, signature.ok, now),
  ]);
  return {
    change: [prs, queue, landed, versions],
    plugins: [plugins.tile, store, published],
    tray: [tray.tray, tray.released],
  };
}
