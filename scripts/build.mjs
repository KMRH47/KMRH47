import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { bannerCard } from "./cards/banner.mjs";
import { projectCard, projectsHeader } from "./cards/project.mjs";
import { kcdLoadout, kcdShowcase, qolShowcase } from "./cards/showcase.mjs";
import { stackCard } from "./cards/stack.mjs";
import { stars } from "./github.mjs";
import { PROJECTS } from "./projects.mjs";
import { STACK } from "./stack.mjs";
import { readQol } from "./qol.mjs";
import { dataUri } from "./svg.mjs";
import { loadType } from "./type.mjs";

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
};

const files = {
  "banner.svg": bannerCard(facts, type.document()),
  "qol.svg": qolShowcase(facts, type.document()),
  "kcd2-loadout.svg": kcdLoadout(
    { idle: await shot("kcd2-henry-idle"), rifle: await shot("kcd2-m4a1-icon"), cartridge: await shot("kcd2-556-icon") },
    type.document(),
  ),
  "kcd2-m4a1.svg": kcdShowcase({ henry: await shot("kcd2-henry"), aim: await shot("kcd2-ingame") }, type.document()),
  "stack.svg": stackCard(STACK, type.document()),
  "projects.svg": projectsHeader("smaller things", "tools I made along the way.", type.document()),
};
for (const project of PROJECTS) {
  files[`project-${project.repo.split("/")[1]}.svg`] = projectCard(project, starCounts.get(project.repo), qol.marks, type.document());
}

await mkdir(values.out, { recursive: true });
for (const [name, markup] of Object.entries(files)) await writeFile(`${values.out}/${name}`, markup);
console.log(JSON.stringify({ plugins: qol.plugins.length, files: Object.keys(files).length }));
