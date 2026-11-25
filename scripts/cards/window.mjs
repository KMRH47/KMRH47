import { round } from "../type.mjs";
import { QOL, baseline, box, lines, mark } from "../svg.mjs";
import { INNER, PAD, SPACE, frame, heavy, panel, title } from "./section.mjs";
import { GROUPS, TAGLINE, key } from "./plugins.mjs";

const SHOT = { width: 1296, height: 452 };
const COLUMN_GAP = 20;
const ROW = 25;
const PLATFORMS = [
  ["linux", "Linux", "(X11)"],
  ["windows", "Windows", ""],
  ["macos", "macOS", ""],
];
const NOT_YET = { windows: new Set(["clipboard"]) };

const runsOn = (plugins, os) => plugins.filter((plugin) => plugin.platforms.includes(os) && !NOT_YET[os]?.has(key(plugin))).length;

function shot(uri, top) {
  const height = round((INNER * SHOT.height) / SHOT.width);
  const defs =
    `<clipPath id="win-clip"><rect x="${PAD}" y="${top}" width="${INNER}" height="${height}" rx="10"/></clipPath>` +
    `<linearGradient id="win-fade" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${round(top + height)}"><stop offset="0.62" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="win-mask" maskUnits="userSpaceOnUse" x="0" y="${top}" width="${PAD * 2 + INNER}" height="${height}"><rect x="0" y="${top}" width="${PAD * 2 + INNER}" height="${height}" fill="url(#win-fade)"/></mask>`;
  const markup =
    `<g mask="url(#win-mask)"><image href="${uri}" x="${PAD}" y="${top}" width="${INNER}" height="${height}" clip-path="url(#win-clip)"/>` +
    box(PAD, top, INNER, height, 10, "none", { stroke: QOL.line }) +
    `</g>`;
  return { defs, markup, height };
}

function index(doc, groups, top) {
  const width = (INNER - COLUMN_GAP * (groups.length - 1)) / groups.length;
  const subs = groups.map((group) => doc.wrap("onestSemibold", group.sub, 11, width));
  const subHeight = Math.max(28, ...subs.map((rows) => rows.length * 14.3));
  const rule = top + 19 + 5 + subHeight + 10;
  let markup = "";
  groups.forEach((group, column) => {
    const x = PAD + column * (width + COLUMN_GAP);
    markup += lines(doc, "display", 19, 19, group.head, x, top, QOL.ink, { bold: heavy(19) }).markup;
    markup += lines(doc, "onestSemibold", 11, 14.3, group.sub, x, top + 24, QOL.accentText, { width }).markup;
    markup += box(x, rule, width, 1, 0, QOL.line);
    group.plugins.forEach((plugin, row) => {
      const y = rule + 11 + row * ROW;
      markup += mark(plugin.mark, x, y + (ROW - 16) / 2, 16, QOL.accentText);
      markup += doc.text("onest", plugin.name, 13, x + 24, baseline(doc, "onest", 13, ROW, y), QOL.secondary);
    });
  });
  const tallest = Math.max(...groups.map((group) => group.plugins.length));
  return { markup, bottom: rule + 11 + tallest * ROW };
}

function platforms(doc, plugins, top) {
  const middle = top + 17 + 10;
  const count = String(plugins.length);
  let markup =
    box(PAD, top, INNER, 1, 0, QOL.line) +
    doc.text("display", count, 20, PAD, baseline(doc, "display", 20, 20, middle - 10), QOL.ink, { bold: heavy(20) }) +
    doc.text("onest", "plugins", 13, PAD + doc.width("display", count, 20) + 4, baseline(doc, "onest", 13, 20, middle - 10), QOL.muted);
  const parts = PLATFORMS.map(([os, name, note]) => {
    const number = String(runsOn(plugins, os));
    const label = ` on ${name}`;
    const extra = note ? ` ${note}` : "";
    const numberWidth = doc.width("display", number, 15);
    const labelWidth = doc.width("onest", label, 13);
    return { number, label, extra, numberWidth, labelWidth, width: numberWidth + labelWidth + doc.width("onest", extra, 13) };
  });
  let right = PAD + INNER;
  parts.reverse().forEach((part, index, all) => {
    const x = right - part.width;
    const textBaseline = baseline(doc, "onest", 13, 16, middle - 8);
    markup += doc.text("display", part.number, 15, x, baseline(doc, "display", 15, 16, middle - 8), QOL.ink, { bold: heavy(15) });
    markup += doc.text("onest", part.label, 13, x + part.numberWidth, textBaseline, QOL.secondary);
    if (part.extra) markup += doc.text("onest", part.extra, 13, x + part.numberWidth + part.labelWidth, textBaseline, QOL.muted);
    if (index < all.length - 1) markup += box(x - 17, middle - 8, 1, 16, 0, QOL.line);
    right = x - 33;
  });
  return { markup, bottom: middle + 10 };
}

export function windowCard(plugins, doc, shotUri) {
  const byKey = new Map(plugins.map((plugin) => [key(plugin), plugin]));
  const groups = GROUPS.map(([head, sub, keys]) => ({ head, sub, plugins: keys.filter((name) => byKey.has(name)).map((name) => byKey.get(name)) }));
  const listed = groups.flatMap((group) => group.plugins);
  const missing = plugins.filter((plugin) => !listed.includes(plugin));
  if (missing.length) throw new Error(`plugins with no group: ${missing.map(key).join(", ")}`);
  const head = title(doc, "qol", TAGLINE);
  const window = shot(shotUri, head.bottom + 12);
  const list = index(doc, groups, head.bottom + 12 + window.height + 8);
  const foot = platforms(doc, plugins, list.bottom + 24);
  const height = Math.ceil(foot.bottom + PAD);
  const wash = frame("qol-wash", height, "#1c1d24", "#111214");
  const label = `qol: ${TAGLINE} The settings window, then its ${plugins.length} plugins in five groups: ${groups.map((group) => `${group.head}: ${group.plugins.map((plugin) => plugin.name).join(", ")}`).join("; ")}. ${PLATFORMS.map(([os, name, note]) => `${runsOn(plugins, os)} on ${name}${note ? ` ${note}` : ""}`).join(", ")}.`;
  return panel(height, label, doc, wash.body + head.markup + window.markup + list.markup + foot.markup, wash.defs + window.defs, SPACE);
}
