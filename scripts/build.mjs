import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { THEMES, qolCard, timeCard } from "./cards.mjs";
import { publicCommitDays } from "./github.mjs";
import { readQol } from "./qol.mjs";
import { summarize } from "./stats.mjs";
import { loadType } from "./type.mjs";

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

const qol = await readQol(values.qol);
const type = await loadType(qol.fonts);
const to = new Date();
const from = new Date(to.getTime() - 365 * 86_400_000);
const stats = summarize(await publicCommitDays(token, values.login, from, to), 3);

await mkdir(values.out, { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  await writeFile(`${values.out}/time-${name}.svg`, timeCard(stats, theme, type));
  await writeFile(`${values.out}/qol-${name}.svg`, qolCard(qol, theme, type));
}
console.log(JSON.stringify({ ...stats, plugins: qol.plugins.length }));
