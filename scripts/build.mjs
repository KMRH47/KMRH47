import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { heroCard } from "./cards/hero.mjs";
import { pluginsCard } from "./cards/plugins.mjs";
import { screensCard } from "./cards/screens.mjs";
import { smallerCard } from "./cards/smaller.mjs";
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
const covers = Object.fromEntries(
  await Promise.all(PROJECTS.filter((project) => project.cover).map(async ({ cover }) => [cover.shot, await shot(cover.shot)])),
);
const screens = {
  shots: {
    launcher: await shot("launcher"),
    settings: await Promise.all(SETTINGS.map(async ([file, title]) => ({ uri: await shot(`settings-${file}`), title }))),
  },
};

const files = {
  "hero-dark.svg": heroCard("dark", type.document()),
  "hero-light.svg": heroCard("light", type.document()),
  "qol.svg": pluginsCard(qol.plugins, type.document()),
  "plugins.svg": pluginsCard(qol.plugins, type.document(), { heading: false }),
  "smaller.svg": smallerCard(PROJECTS, starCounts, covers, type.document()),
  "screens.svg": screensCard(screens, type.document()),
};

await mkdir(values.out, { recursive: true });
for (const [name, markup] of Object.entries(files)) await writeFile(`${values.out}/${name}`, markup);
console.log(JSON.stringify({ plugins: qol.plugins.length, files: Object.keys(files).length }));
