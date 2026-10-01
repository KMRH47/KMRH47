import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { pluginsCard } from "./cards/plugins.mjs";
import { projectCard, projectsHeader } from "./cards/project.mjs";
import { screensCard } from "./cards/screens.mjs";
import { stars } from "./github.mjs";
import { PROJECTS } from "./projects.mjs";
import { readQol } from "./qol.mjs";
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
    out: { type: "string", default: "assets" },
  },
});
const token = process.env.GITHUB_TOKEN;
if (!values.qol || !token) {
  throw new Error("usage: GITHUB_TOKEN=<token> node scripts/build.mjs --qol <qol checkout> [--out <dir>]");
}

const shot = async (name) => dataUri("image/webp", await readFile(new URL(`../shots/${name}.webp`, import.meta.url)));
const qol = await readQol(values.qol);
const type = await loadType(qol.fonts);
const starCounts = await stars(token, PROJECTS.map((project) => project.repo));
const facts = {
  plugins: qol.plugins,
  shots: {
    launcher: await shot("launcher"),
    settings: await Promise.all(SETTINGS.map(async ([file, title]) => ({ uri: await shot(`settings-${file}`), title }))),
  },
};

const files = {
  "plugins.svg": pluginsCard(facts, type.document()),
  "screens.svg": screensCard(facts, type.document()),
  "projects.svg": projectsHeader("everything else", "other things I have built.", type.document()),
};
for (const project of PROJECTS) {
  files[`project-${project.repo.split("/")[1]}.svg`] = projectCard(project, starCounts.get(project.repo), qol.marks, type.document());
}

await mkdir(values.out, { recursive: true });
for (const [name, markup] of Object.entries(files)) await writeFile(`${values.out}/${name}`, markup);
console.log(JSON.stringify({ plugins: qol.plugins.length, files: Object.keys(files).length }));
