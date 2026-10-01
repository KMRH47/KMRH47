import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { featuredCard } from "./cards/featured.mjs";
import { heroCard } from "./cards/hero.mjs";
import { lifeCard } from "./cards/life.mjs";
import { pluginsCard } from "./cards/plugins.mjs";
import { projectCard } from "./cards/project.mjs";
import { sectionHeader } from "./cards/section.mjs";
import { timeCard } from "./cards/time.mjs";
import { contributionCalendar, latestRelease, publicCommitDays, stars } from "./github.mjs";
import { PROJECTS } from "./projects.mjs";
import { readQol } from "./qol.mjs";
import { summarize } from "./stats.mjs";
import { dataUri } from "./svg.mjs";
import { loadType } from "./type.mjs";

const SECTIONS = [
  ["01", "now building", "What I'm building"],
  ["02", "shipped", "Other things I've made"],
  ["03", "stack", "Tools I reach for"],
  ["04", "activity", "The last twelve months"],
];
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
const [days, calendar, release, starCounts] = await Promise.all([
  publicCommitDays(token, values.login, from, to),
  contributionCalendar(token, values.login),
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
  "featured.svg": featuredCard(facts, type.document()),
  "plugins.svg": pluginsCard(facts, type.document()),
  "time.svg": timeCard(stats, type.document()),
  "life.svg": lifeCard(calendar, type.document()),
};
for (const project of PROJECTS) {
  files[`project-${project.repo.split("/")[1]}.svg`] = projectCard(project, starCounts.get(project.repo), qol.marks, type.document());
}
for (const [number, label, title] of SECTIONS) {
  for (const theme of ["dark", "light"]) {
    files[`section-${number}-${theme}.svg`] = sectionHeader(number, label, title, theme, type.document());
  }
}

await mkdir(values.out, { recursive: true });
for (const [name, markup] of Object.entries(files)) await writeFile(`${values.out}/${name}`, markup);
console.log(JSON.stringify({ ...stats, release, plugins: qol.plugins.length, files: Object.keys(files).length }));
