import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { heroCard } from "./cards/hero.mjs";
import { pluginsCard } from "./cards/plugins.mjs";
import { projectCard, projectsHeader } from "./cards/project.mjs";
import { screensCard } from "./cards/screens.mjs";
import { timeCard } from "./cards/time.mjs";
import { latestRelease, publicCommitDays, stars } from "./github.mjs";
import { PROJECTS } from "./projects.mjs";
import { readQol } from "./qol.mjs";
import { summarize } from "./stats.mjs";
import { dataUri } from "./svg.mjs";
import { loadType } from "./type.mjs";

const SETTINGS = [
  ["alt-tab", "alt tab"],
  ["display", "display"],
  ["os-themes", "os themes"],
  ["shot", "shot"],
  ["window-actions", "window actions"],
];

const { values } = parseArgs({
  options: {
    qol: { type: "string" },
    login: { type: "string", default: "KMRH47" },
    out: { type: "string", default: "assets" },
  },
});
const token = process.env.GITHUB_TOKEN;
if (!values.qol || !token) {
  throw new Error("usage: GITHUB_TOKEN=<token> node scripts/build.mjs --qol <qol checkout> [--login <user>] [--out <dir>]");
}

const shot = async (name) => dataUri("image/webp", await readFile(new URL(`../shots/${name}.webp`, import.meta.url)));
const qol = await readQol(values.qol);
const type = await loadType(qol.fonts);
const to = new Date();
const from = new Date(to.getTime() - 365 * 86_400_000);
const [days, release, starCounts] = await Promise.all([
  publicCommitDays(token, values.login, from, to),
  latestRelease(token, "qol-tools/qol", "qol-tray-v"),
  stars(token, PROJECTS.map((project) => project.repo)),
]);
const stats = summarize(days, 3);
const facts = {
  marks: qol.marks,
  plugins: qol.plugins,
  pluginCount: qol.plugins.length,
  release,
  shots: {
    launcher: await shot("launcher"),
    settings: await Promise.all(SETTINGS.map(async ([file, title]) => ({ uri: await shot(`settings-${file}`), title }))),
  },
};

const files = {
  "hero.svg": heroCard(facts, type.document()),
  "time.svg": timeCard(stats, type.document()),
  "plugins.svg": pluginsCard(facts, type.document()),
  "screens.svg": screensCard(facts, type.document()),
  "projects.svg": projectsHeader("everything else", type.document()),
};
for (const project of PROJECTS) {
  files[`project-${project.repo.split("/")[1]}.svg`] = projectCard(project, starCounts.get(project.repo), qol.marks, type.document());
}

await mkdir(values.out, { recursive: true });
for (const [name, markup] of Object.entries(files)) await writeFile(`${values.out}/${name}`, markup);
console.log(JSON.stringify({ ...stats, release, plugins: qol.plugins.length, files: Object.keys(files).length }));
