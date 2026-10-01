import { round } from "../type.mjs";
import { QOL, discrete, qolWindow, svg, tile } from "../svg.mjs";

const WIDTH = 1200;
const PAD = 48;
const COLUMNS = 3;
const GAP = 24;
const ICON = 52;
const STEP = 1.1;
const NAME = 18;
const DESCRIPTION = 15.5;
const LEADING = 22;
const PLATFORMS = [
  ["linux", "Linux"],
  ["macos", "macOS"],
];

export function pluginsCard({ plugins }, doc) {
  const columnWidth = (WIDTH - 2 * PAD - (COLUMNS - 1) * GAP) / COLUMNS;
  const textWidth = columnWidth - ICON - 30;
  const total = plugins.length * STEP;
  const top = 154;
  const cells = [];
  let y = top;
  for (let start = 0; start < plugins.length; start += COLUMNS) {
    const row = plugins.slice(start, start + COLUMNS).map((plugin) => ({
      ...plugin,
      lines: doc.wrap("regular", plugin.description, DESCRIPTION, textWidth),
    }));
    const height = Math.max(ICON, 44 + (Math.max(...row.map((plugin) => plugin.lines.length)) - 1) * LEADING + 8);
    row.forEach((plugin, column) => cells.push({ ...plugin, x: PAD + column * (columnWidth + GAP), y, height }));
    y += height + 30;
  }
  const height = y - 30 + 52;
  const parts = [qolWindow(0, 0, WIDTH, height)];
  const counts = PLATFORMS.map(([key, label]) => `${plugins.filter((plugin) => plugin.platforms.includes(key)).length} run on ${label}`);
  parts.push(doc.text("display", "plugins", 44, PAD, 74, QOL.ink));
  parts.push(doc.text("medium", `${plugins.length} installed`, 14, PAD + 2, 98, QOL.accentText));
  parts.push(doc.text("regular", `each one is released and installed on its own. ${counts.join(" and ")}.`, 15, WIDTH - PAD, 98, QOL.muted, { anchor: "end" }));
  parts.push(`<rect x="${PAD}" y="118" width="${WIDTH - 2 * PAD}" height="1" fill="${QOL.line}"/>`);
  cells.forEach((cell, index) => {
    const on = discrete(
      "opacity",
      [
        [0, 0],
        [index * STEP, 1],
        [(index + 1) * STEP, 0],
      ],
      total,
    );
    parts.push(
      `<g opacity="0">${on}<rect x="${round(cell.x - 14)}" y="${cell.y - 14}" width="${round(columnWidth + 22)}" height="${cell.height + 28}" rx="8" fill="${QOL.selection}" fill-opacity="0.6"/></g>`,
    );
    parts.push(tile(cell.mark, cell.x, cell.y, ICON, QOL.accent, { wash: 0, stroke: QOL.text, base: QOL.raised }));
    parts.push(`<g opacity="0">${on}${tile(cell.mark, cell.x, cell.y, ICON, QOL.accent, { wash: 0.24, base: QOL.raised })}</g>`);
    parts.push(doc.text("medium", cell.name, NAME, cell.x + ICON + 18, cell.y + 19, QOL.ink));
    const platforms = PLATFORMS.filter(([key]) => cell.platforms.includes(key)).map(([, label]) => label);
    parts.push(doc.text("medium", platforms.join(" · "), 13, cell.x + columnWidth - 8, cell.y + 18, QOL.dim, { anchor: "end" }));
    cell.lines.forEach((line, lineIndex) => {
      parts.push(doc.text("regular", line, DESCRIPTION, cell.x + ICON + 18, cell.y + 44 + lineIndex * LEADING, QOL.muted));
    });
  });
  return svg(WIDTH, height, `qol plugins: ${plugins.map((plugin) => plugin.name).join(", ")}`, doc, parts.join(""));
}
