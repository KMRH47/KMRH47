import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { bannerCard } from "./cards/banner.mjs";
import { pluginsCard } from "./cards/plugins.mjs";
import { projectCard, projectsHeader } from "./cards/project.mjs";
import { screensCard } from "./cards/screens.mjs";
import { kcdShowcase, qolShowcase } from "./cards/showcase.mjs";
import { stackCard } from "./cards/stack.mjs";
import { stars } from "./github.mjs";
import { PROJECTS } from "./projects.mjs";
import { STACK } from "./stack.mjs";
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
const frames = JSON.parse(await readFile(new URL("../shots/launcher/frames.json", import.meta.url), "utf8"));
const facts = {
  plugins: qol.plugins,
  frames: await Promise.all(frames.map(async (frame) => ({ ...frame, uri: await shot(`launcher/${frame.file.replace(".webp", "")}`) }))),
  shots: {
    launcher: await shot("launcher"),
    settings: await Promise.all(SETTINGS.map(async ([file, title]) => ({ uri: await shot(`settings-${file}`), title }))),
  },
};

const files = {
  "banner.svg": bannerCard(facts, type.document()),
  "qol.svg": qolShowcase(facts, type.document()),
  "kcd2.svg": kcdShowcase(await shot("kcd2-ingame"), type.document()),
  "plugins.svg": pluginsCard(facts, type.document()),
  "screens.svg": screensCard(facts, type.document()),
  "stack.svg": stackCard(STACK, type.document()),
  "projects.svg": projectsHeader("smaller things", "tools I made along the way.", type.document()),
};
for (const project of PROJECTS) {
  files[`project-${project.repo.split("/")[1]}.svg`] = projectCard(project, starCounts.get(project.repo), qol.marks, type.document());
}

await mkdir(values.out, { recursive: true });
for (const [name, markup] of Object.entries(files)) await writeFile(`${values.out}/${name}`, markup);
console.log(JSON.stringify({ plugins: qol.plugins.length, files: Object.keys(files).length }));
