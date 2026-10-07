import { graphql, rest } from "./github.mjs";

const REPO = "repos/qol-tools/qol";
const INDEX = "https://qol-tools.github.io/qol/plugins/index.json";
const REGISTRY = "https://ghcr.io";
const PACKAGE = "qol-tools/plugins";
const WAVE = 10 * 60 * 1000;
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
  const time = ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60000)} min`;
  return time;
}

const jobSpan = (job) => [job.started_at, job.status === "completed" ? job.completed_at : null];
const runSpan = (run) => [run.run_started_at, run.status === "completed" ? run.updated_at : null];

function piece(name, list, now) {
  return { name, state: worst(list.map(state)), time: took(list.map(jobSpan), now) };
}

async function candidates(token) {
  const active = (await runs(token, "plugin-version.yml", 5)).filter((run) => run.status !== "completed");
  const built = new Map();
  for (const job of (await Promise.all(active.map((run) => jobs(token, run)))).flat()) {
    const id = job.name.match(/^Candidate (qol-[a-z0-9-]+?)(?:-v\d+\.\d+\.\d+)? \(/)?.[1];
    if (id && state(job) !== "skip") built.set(id, [...(built.get(id) ?? []), job]);
  }
  return built;
}

const releasing = (list) => (list.some((job) => state(job) === "bad") ? "bad" : "run");

async function tests(token, now) {
  for (const run of await runs(token, "ci.yml", 10, "&event=merge_group")) {
    const ran = (await jobs(token, run)).filter((job) => /^(lint|release build|sandbox)/.test(job.name) && state(job) !== "skip");
    if (!ran.length) continue;
    const pieces = PLATFORMS.map(([name, match]) => [name, ran.filter((job) => match.test(job.name))])
      .filter(([, list]) => list.length)
      .map(([name, list]) => piece(name, list, now));
    return { name: "tests", fact: "before every merge", pieces };
  }
  throw new Error("no merge queue CI run ran tests");
}

async function latestRun(token, workflow, toPieces) {
  const [run, previous] = await runs(token, workflow, 2);
  const pieces = await toPieces(run);
  if (pieces.length || !previous) return { run, pieces };
  return { run, pieces: (await toPieces(previous)).map((item) => ({ ...item, state: state(run), time: "" })) };
}

async function tray(token, building, now) {
  const { run, pieces } = await latestRun(token, "qol-tray-release.yml", async (run) =>
    (await jobs(token, run))
      .filter((job) => job.name.startsWith("Build ") || ["bad", "run"].includes(state(job)))
      .sort((a, b) => platform(a.name) - platform(b.name))
      .map((job) => piece(job.name.replace(/^Build /, "").replace(/ release$/, ""), [job], now)),
  );
  const version = run.display_title.match(/qol-tray-v(\d+\.\d+\.\d+)/)?.[1];
  if (!version) throw new Error(`qol-tray release run ${run.id} names no version: ${run.display_title}`);
  const next = building.get("qol-tray");
  if (next) {
    for (const item of pieces) {
      const list = next.filter((job) => PLATFORMS[platform(item.name)]?.[1].test(job.name));
      if (list.length) Object.assign(item, { state: releasing(list), time: took(list.map(jobSpan), now) });
    }
  }
  return { name: "qol-tray", fact: `version ${version}`, pieces };
}

function plugins(qol, listed, building, released, now) {
  const latest = new Map();
  for (const run of released) {
    const id = run.display_title.match(/^Release (qol-[a-z0-9-]+)-v\d+\.\d+\.\d+$/)?.[1];
    if (id && !latest.has(id)) latest.set(id, run);
  }
  const items = qol.plugins.map((plugin) => {
    const next = building.get(plugin.id);
    if (next) return { name: plugin.name, state: releasing(next), time: took(next.map(jobSpan), now), jobs: next };
    const run = latest.get(plugin.id);
    if (!run) return { name: plugin.name, state: listed.has(plugin.id) ? "ok" : "wait", time: "" };
    return { name: plugin.name, state: state(run), time: took([runSpan(run)], now), run };
  });
  const newest = Math.max(...items.filter((item) => item.run).map((item) => Date.parse(item.run.created_at)));
  const wave = items.filter((item) => item.run && Date.parse(item.run.created_at) > newest - WAVE).map((item) => item.run);
  const next = items.flatMap((item) => item.jobs ?? []);
  const wall = next.length ? took(next.map(jobSpan), now) : took(wave.map(runSpan), now);
  return { name: "plugins", fact: `${items.length} plugins`, items, wall, wave };
}

async function registry(token, wave, now) {
  const pushes = (await Promise.all(wave.map((run) => jobs(token, run))))
    .flat()
    .filter((job) => job.name === "Publish registry artifact" && state(job) !== "skip");
  const list = pushes.length
    ? pushes
    : (await jobs(token, (await runs(token, "plugin-registry-backfill.yml", 1))[0])).filter((job) => job.name === "Push existing releases");
  const auth = await (await fetch(`${REGISTRY}/token?scope=repository:${PACKAGE}:pull`)).json();
  const tags = await (await fetch(`${REGISTRY}/v2/${PACKAGE}/tags/list?n=10000`, { headers: { authorization: `Bearer ${auth.token}` } })).json();
  if (!Array.isArray(tags.tags)) throw new Error(`ghcr.io listed no tags for ${PACKAGE}`);
  return { name: "registry", fact: `${tags.tags.length} plugin versions`, pieces: [piece("ghcr.io", list, now)] };
}

async function index(token, count, signed, now) {
  const { pieces } = await latestRun(token, "plugin-index.yml", async (run) =>
    (await jobs(token, run)).map((job) => piece(job.name.split(" ")[0].toLowerCase(), [job], now)),
  );
  return { name: "index", fact: `${count} plugins${signed ? ", signed" : ""}`, pieces };
}

const minutes = (seconds) => `${Math.max(1, Math.round(seconds / 60))} min`;
const ago = (ms) => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} ${Math.round(h / 24) === 1 ? "day" : "days"} ago`;
};
const subject = (title) => title.replace(/^[a-z]+(\([^)]*\))?!?: /, "");
const platformName = (name) => PLATFORMS.reduce((label, [platform, match]) => label.replace(/\(([^)]*)\)/, (all, inner) => (match.test(inner) ? `(${platform})` : all)), name);

async function checks(token, sha, required, now) {
  const runs = (await rest(token, `${REPO}/commits/${sha}/check-runs?per_page=100`)).check_runs;
  return runs
    .map((run) => ({ ...run, state: state(run) }))
    .filter((run) => run.state !== "skip")
    .map((run) => ({
      name: platformName(run.name),
      state: run.state,
      time: required.has(run.name) ? "required" : took([[run.started_at, run.status === "completed" ? run.completed_at : null]], now),
      first: required.has(run.name),
    }))
    .sort((a, b) => b.first - a.first || a.name.localeCompare(b.name));
}

async function queue(token, now) {
  const [owner, name] = REPO.split("/").slice(1);
  const rules = rest(token, `${REPO}/rules/branches/main`);
  const data = await graphql(
    token,
    `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { mergeQueue(branch: "main") { entries(first: 10) { nodes { state estimatedTimeToMerge headCommit { oid } pullRequest { number title } } } } } }`,
    { owner, name },
  );
  const required = new Set(
    (await rules)
      .filter((rule) => rule.type === "required_status_checks")
      .flatMap((rule) => rule.parameters.required_status_checks.map((check) => check.context)),
  );
  const entries = data.repository.mergeQueue?.entries.nodes ?? [];
  const front = entries[0];
  const frontChecks = front ? await checks(token, front.headCommit.oid, required, now) : [];
  const started = frontChecks.length > 0 && front.state === "AWAITING_CHECKS";
  return {
    entries: entries.map((entry, index) => ({
      number: entry.pullRequest.number,
      title: subject(entry.pullRequest.title),
      state: index === 0 && started ? "run" : "wait",
      left: entry.estimatedTimeToMerge ? minutes(entry.estimatedTimeToMerge) : "",
    })),
    front: front && { number: front.pullRequest.number, checks: frontChecks },
  };
}

async function merged(token, now) {
  const since = new Date(now - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const search = rest(token, `search/issues?q=${encodeURIComponent(`repo:qol-tools/qol is:pr is:merged merged:>=${since}`)}`);
  const pulls = (await rest(token, `${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=30`))
    .filter((pull) => pull.merged_at)
    .sort((a, b) => Date.parse(b.merged_at) - Date.parse(a.merged_at));
  const count = (await search).total_count;
  return {
    count,
    pulls: pulls.slice(0, 2).map((pull) => ({ number: pull.number, title: subject(pull.title), ago: ago(now - Date.parse(pull.merged_at)) })),
  };
}

export async function buildQueue(token, now = Date.now()) {
  const [waiting, landed] = await Promise.all([queue(token, now), merged(token, now)]);
  return { queue: waiting, merged: landed };
}

export async function buildStatus(token, qol, now = Date.now()) {
  const [response, signature, building, releases] = await Promise.all([
    fetch(INDEX),
    fetch(`${INDEX}.minisig`, { method: "HEAD" }),
    candidates(token),
    runs(token, "release.yml", 40),
  ]);
  if (!response.ok) throw new Error(`${INDEX} answered ${response.status}`);
  const listed = new Set(Object.keys((await response.json()).plugins));
  const released = Promise.resolve(plugins(qol, listed, building, releases, now));
  return Promise.all([
    tests(token, now),
    tray(token, building, now),
    released,
    released.then((done) => registry(token, done.wave, now)),
    index(token, listed.size, signature.ok, now),
  ]);
}
