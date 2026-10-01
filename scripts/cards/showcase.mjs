import { DARK, chip, discrete, panel, svg } from "../svg.mjs";

const WIDTH = 1200;
const LEFT = 56;
const COLUMN = 236;
const WINDOW = { x: 324, y: 40, width: 840, height: 664 };
const KCD = { height: 452, column: 330 };
const SHADOW = `<filter id="lift" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000" flood-opacity="0.55"/></filter>`;

function timeline(frames) {
  let start = 0;
  const spans = frames.map((frame) => {
    const span = { ...frame, start, end: start + frame.ms / 1000 };
    start = span.end;
    return span;
  });
  return { spans, total: start };
}

function visible(span, index, total) {
  return discrete("opacity", index === 0 ? [[0, 1], [span.end, 0]] : [[0, 0], [span.start, 1], [span.end, 0]], total);
}

function label(doc, text, x, y, color) {
  return doc.text("monoMedium", text.toUpperCase(), 14, x, y, color, { tracking: 2 });
}

export function qolShowcase({ plugins, frames }, doc) {
  const height = WINDOW.y * 2 + WINDOW.height;
  const frame = panel("qol", WIDTH, height, [
    { x: 760, y: 360, r: 560, color: DARK.violet, opacity: 0.42 },
    { x: 40, y: 30, r: 320, color: DARK.amber, opacity: 0.24 },
  ]);
  const tallest = frames.findIndex((entry) => entry.height === Math.max(...frames.map((other) => other.height)));
  const { spans, total } = timeline([...frames.slice(tallest), ...frames.slice(0, tallest)]);
  const parts = [frame.body];
  parts.push(label(doc, "main project", LEFT, 76, DARK.amber));
  parts.push(doc.text("display", "qol", 104, LEFT - 4, 178, DARK.ink));
  doc
    .wrap("regular", `A tray app with ${plugins.length} plugins that makes any computer I sit down at work like my own.`, 20, COLUMN)
    .forEach((line, index) => parts.push(doc.text("regular", line, 20, LEFT, 226 + index * 29, DARK.secondary)));
  [
    { label: "Linux · macOS", color: DARK.violet, fill: DARK.violet, fillOpacity: 0.16 },
    { label: `${plugins.length} plugins` },
    { label: "Rust · gpui", dot: "#dea584" },
  ].forEach((entry, index) => parts.push(chip(doc, entry.label, LEFT, 360 + index * 46, entry).markup));
  parts.push(label(doc, "now searching", LEFT, 600, DARK.muted));
  for (const mode of ["apps", "files"]) {
    const steps = [];
    for (const span of spans) steps.push([span.start, span.mode === mode ? 1 : 0]);
    parts.push(`<g opacity="${spans[0].mode === mode ? 1 : 0}">${discrete("opacity", steps, total)}${doc.text("display", mode, 44, LEFT - 2, 650, DARK.violet)}</g>`);
  }
  spans.forEach((span, index) => {
    parts.push(
      `<g opacity="${index === 0 ? 1 : 0}">${visible(span, index, total)}` +
        `<rect x="${WINDOW.x}" y="${WINDOW.y}" width="${WINDOW.width}" height="${span.height}" fill="${DARK.raised}" filter="url(#lift)"/>` +
        `<image href="${span.uri}" x="${WINDOW.x}" y="${WINDOW.y}" width="${WINDOW.width}" height="${span.height}"/></g>`,
    );
  });
  return svg(WIDTH, height, `qol, my main project: the real launcher searching apps, then files`, doc, parts.join(""), frame.defs + SHADOW);
}

export function kcdShowcase(doc) {
  const frame = panel("kcd", WIDTH, KCD.height, [
    { x: 900, y: 220, r: 520, color: DARK.orange, opacity: 0.3 },
    { x: 40, y: 30, r: 300, color: DARK.amber, opacity: 0.16 },
  ]);
  const parts = [frame.body];
  parts.push(label(doc, "on the side", LEFT, 76, DARK.orange));
  parts.push(doc.text("display", "kcd2-m4a1", 56, LEFT - 2, 136, DARK.ink));
  doc
    .wrap("regular", "An M4A1 carbine for Kingdom Come: Deliverance II, and the Blender toolchain I built to make it.", 19, KCD.column - LEFT)
    .forEach((line, index) => parts.push(doc.text("regular", line, 19, LEFT, 180 + index * 27, DARK.secondary)));
  const progress = [
    ["aims and fires in game", true],
    ["holster, back and idle poses", true],
    ["hand grips", false],
  ];
  progress.forEach(([text, done], index) => {
    const y = 318 + index * 34;
    const dot = done
      ? `<circle cx="${LEFT + 7}" cy="${y - 6}" r="6" fill="${DARK.green}"/>`
      : `<circle cx="${LEFT + 7}" cy="${y - 6}" r="5.2" fill="none" stroke="${DARK.orange}" stroke-width="2"/>`;
    parts.push(dot + doc.text("medium", done ? text : `${text}, in progress`, 17, LEFT + 24, y, done ? DARK.secondary : DARK.orange));
  });
  return svg(WIDTH, KCD.height, "kcd2-m4a1: an M4A1 carbine mod for Kingdom Come: Deliverance II, in progress.", doc, parts.join(""), frame.defs);
}
