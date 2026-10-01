import { DARK, bob, glow, mark, svg } from "../svg.mjs";

const WIDTH = 1200;
const HEIGHT = 420;
const COLORS = [DARK.violet, DARK.amber, DARK.teal, DARK.pink, DARK.green, DARK.blue, DARK.orange];
const FIELD = { x: 700, y: 46, width: 460, height: 328, columns: 5 };
const DRIFT = 18;

const GLOWS = [
  { color: DARK.violet, opacity: 0.5, r: 440, from: [980, 60], to: [860, 140] },
  { color: DARK.amber, opacity: 0.3, r: 380, from: [180, 430], to: [320, 380] },
  { color: DARK.teal, opacity: 0.28, r: 280, from: [1180, 420], to: [1080, 360] },
  { color: DARK.pink, opacity: 0.2, r: 240, from: [600, -20], to: [520, 40] },
];

function drift(attribute, from, to) {
  return `<animate attributeName="${attribute}" values="${from};${to};${from}" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" dur="${DRIFT}s" repeatCount="indefinite"/>`;
}

function jitter(index, salt) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value) - 0.5;
}

export function bannerCard({ plugins }, doc) {
  const rows = Math.ceil(plugins.length / FIELD.columns);
  const cellWidth = FIELD.width / FIELD.columns;
  const cellHeight = FIELD.height / rows;
  const marks = plugins.map((plugin, index) => {
    const size = 38 + Math.round((jitter(index, 3) + 0.5) * 18);
    const x = FIELD.x + (index % FIELD.columns) * cellWidth + cellWidth / 2 + jitter(index, 1) * 30 - size / 2;
    const y = FIELD.y + Math.floor(index / FIELD.columns) * cellHeight + cellHeight / 2 + jitter(index, 2) * 22 - size / 2;
    const color = COLORS[index % COLORS.length];
    return `<g>${bob(6 + (index % 4) * 2, 4 + (index % 5), index * 0.7)}${mark(plugin.mark, x, y, size, color)}</g>`;
  });

  const defs =
    `<clipPath id="banner-clip"><rect width="${WIDTH}" height="${HEIGHT}" rx="24"/></clipPath>` +
    GLOWS.map((spot, index) => glow(`banner-glow${index}`, spot.color, spot.opacity)).join("") +
    `<linearGradient id="banner-veil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${DARK.base}" stop-opacity="0.75"/><stop offset="0.55" stop-color="${DARK.base}" stop-opacity="0"/></linearGradient>`;
  const glows = GLOWS.map(
    (spot, index) =>
      `<circle cx="${spot.from[0]}" cy="${spot.from[1]}" r="${spot.r}" fill="url(#banner-glow${index})">` +
      drift("cx", spot.from[0], spot.to[0]) +
      drift("cy", spot.from[1], spot.to[1]) +
      `</circle>`,
  );
  const body =
    `<g clip-path="url(#banner-clip)"><rect width="${WIDTH}" height="${HEIGHT}" fill="${DARK.base}"/>${glows.join("")}` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#banner-veil)"/>${marks.join("")}</g>` +
    doc.text("display", "Karsten", 112, 64, 206, DARK.ink) +
    doc.text("medium", "full-stack developer · Malmö", 24, 70, 256, DARK.amber) +
    doc.text("regular", "I build the tools I wish my computer came with.", 24, 70, 306, DARK.secondary);
  return svg(WIDTH, HEIGHT, "Karsten, full-stack developer in Malmö. I build the tools I wish my computer came with.", doc, body, defs);
}
