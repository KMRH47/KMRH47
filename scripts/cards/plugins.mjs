import { round } from "../type.mjs";
import { DARK, discrete, heading, panel, svg, tile } from "../svg.mjs";

const WIDTH = 1200;
const PAD = 48;
const COLUMNS = 3;
const GAP = 24;
const ICON = 52;
const STEP = 1.1;
const NAME = 23;
const DESCRIPTION = 16.5;
const LEADING = 23;
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
    const height = Math.max(ICON, 46 + (Math.max(...row.map((plugin) => plugin.lines.length)) - 1) * LEADING + 8);
    row.forEach((plugin, column) => cells.push({ ...plugin, x: PAD + column * (columnWidth + GAP), y, height }));
    y += height + 30;
  }
  const height = y - 30 + 52;
  const frame = panel("plugins", WIDTH, height, [
    { x: 80, y: 0, r: 320, color: DARK.amber, opacity: 0.1 },
    { x: WIDTH, y: height, r: 380, color: DARK.teal, opacity: 0.06 },
  ]);

  const parts = [frame.body];
  const counts = PLATFORMS.map(([key, label]) => `${plugins.filter((plugin) => plugin.platforms.includes(key)).length} run on ${label}`);
  parts.push(heading(doc, `${plugins.length} plugins, one tray`, `each one is released and installed on its own. ${counts.join(" and ")}.`, PAD, 80));
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
      `<g opacity="0">${on}<rect x="${round(cell.x - 14)}" y="${cell.y - 14}" width="${round(columnWidth + 22)}" height="${cell.height + 28}" rx="14" fill="${DARK.line}" fill-opacity="0.7"/>` +
        `<rect x="${round(cell.x - 14)}" y="${cell.y + 2}" width="4" height="${cell.height - 4}" rx="2" fill="${DARK.amber}"/></g>`,
    );
    parts.push(tile(cell.mark, cell.x, cell.y, ICON, DARK.amber, { wash: 0.06, stroke: DARK.secondary }));
    parts.push(`<g opacity="0">${on}${tile(cell.mark, cell.x, cell.y, ICON, DARK.amber, { wash: 0.22 })}</g>`);
    parts.push(doc.text("display", cell.name, NAME, cell.x + ICON + 18, cell.y + 20, DARK.ink));
    const platforms = PLATFORMS.filter(([key]) => cell.platforms.includes(key)).map(([, label]) => label);
    parts.push(doc.text("medium", platforms.join(" · "), 13, cell.x + columnWidth - 8, cell.y + 19, DARK.muted, { anchor: "end" }));
    cell.lines.forEach((line, lineIndex) => {
      parts.push(doc.text("regular", line, DESCRIPTION, cell.x + ICON + 18, cell.y + 46 + lineIndex * LEADING, DARK.secondary));
    });
  });
  return svg(WIDTH, height, `qol plugins: ${plugins.map((plugin) => plugin.name).join(", ")}`, doc, parts.join(""), frame.defs);
}
