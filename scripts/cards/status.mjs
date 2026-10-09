import { round } from "../type.mjs";
import { QOL, svg } from "../svg.mjs";

const WIDTH = 838;
const ROW = 21;
const PIP = 11;
const PITCH = 15;
const PER_ROW = 9;
const GAP = 8;
const PADX = 14;
const STORY = 34;
const LABEL = 28;
const COLOR = { ok: QOL.success, bad: QOL.danger, run: QOL.accent, wait: QOL.dim, idle: QOL.line };
const WORD = { ok: "passed", bad: "failed", run: "running", wait: "waiting" };

function dot(state, x, y) {
  if (state === "ok" || state === "bad") return `<circle cx="${round(x)}" cy="${y}" r="4.5" fill="${COLOR[state]}"/>`;
  if (state === "wait") return `<circle cx="${round(x)}" cy="${y}" r="3.5" fill="none" stroke="${QOL.dim}" stroke-width="2"/>`;
  return (
    `<circle cx="${round(x)}" cy="${y}" r="3.5" fill="none" stroke="${QOL.accent}" stroke-opacity="0.25" stroke-width="2"/>` +
    `<path d="M${round(x)} ${y - 3.5}A3.5 3.5 0 0 1 ${round(x + 3.5)} ${y}" fill="none" stroke="${QOL.accent}" stroke-width="2" stroke-linecap="round">` +
    `<animateTransform attributeName="transform" type="rotate" from="0 ${round(x)} ${y}" to="360 ${round(x)} ${y}" dur="0.9s" repeatCount="indefinite"/></path>`
  );
}

function pip(state, x, y) {
  if (state === "ok" || state === "bad" || state === "idle") return `<rect x="${round(x)}" y="${y}" width="${PIP}" height="${PIP}" rx="2" fill="${COLOR[state]}"/>`;
  return `<rect x="${round(x + 1)}" y="${y + 1}" width="${PIP - 2}" height="${PIP - 2}" rx="1.5" fill="none" stroke="${COLOR[state]}" stroke-width="2"/>`;
}

function row(doc, x, y, { name, time, state, note, still, width }) {
  if (note) return doc.text("regular", doc.fit("regular", name, 13, width), 13, x, y, QOL.dim);
  const timeWidth = time ? doc.width("regular", time, 13) + 10 : 0;
  const live = state === "run" && !still;
  return (
    dot(state, x + 4.5, y - 5) +
    doc.text("regular", doc.fit("regular", name, 14, width - 18 - timeWidth), 14, x + 18, y, state === "bad" ? QOL.danger : QOL.muted) +
    (time ? doc.text("regular", time, 13, x + width, y, live ? QOL.accentText : state === "bad" ? QOL.danger : QOL.dim, { anchor: "end" }) : "")
  );
}

function body(doc, tile, inner) {
  const parts = [doc.text("display", tile.name, 36, PADX, 44, QOL.ink), doc.text("medium", doc.fit("medium", tile.fact, 13, inner), 13, PADX + 2, 65, QOL.accentText)];
  let y = 74;
  if (tile.squares) {
    tile.squares.forEach((state, index) => parts.push(pip(state, PADX + 2 + (index % PER_ROW) * PITCH, y + 5 + Math.floor(index / PER_ROW) * PITCH)));
    y += 5 + Math.ceil(tile.squares.length / PER_ROW) * PITCH + 3;
  }
  for (const line of tile.rows) {
    parts.push(row(doc, PADX + 2, y + 15, { ...line, width: inner }));
    y += ROW;
  }
  return { markup: parts.join(""), bottom: y };
}

function describe(tile) {
  const lines = tile.rows.filter((line) => !line.note).map((line) => `${line.name} ${line.time || WORD[line.state]}`);
  return `${tile.name} (${tile.fact})${lines.length ? `: ${lines.join(", ")}` : ""}`;
}

function strip(height, text, size, ink, face, document) {
  const doc = document();
  return svg(WIDTH, height, text, doc, doc.text(face, doc.fit(face, text, size, WIDTH - 2 * PADX), size, PADX, height - 10, ink));
}

function tileRow(tiles, document) {
  const width = WIDTH / tiles.length;
  const inner = width - GAP - 2 * PADX - 2;
  const drawn = tiles.map((tile) => {
    const doc = document();
    return { tile, doc, ...body(doc, tile, inner) };
  });
  const height = Math.ceil(Math.max(...drawn.map((item) => item.bottom)) + 16 + GAP);
  return drawn.map(({ tile, doc, markup }) => {
    const frame = `<rect x="${GAP / 2 + 0.5}" y="${GAP / 2 + 0.5}" width="${round(width - GAP - 1)}" height="${height - GAP - 1}" rx="12" fill="${QOL.ground}" stroke="${QOL.line}"/>`;
    return [`status-${tile.name.toLowerCase()}.svg`, svg(round(width), height, `qol ${describe(tile)}.`, doc, frame + `<g transform="translate(${GAP / 2} ${GAP / 2})">${markup}</g>`)];
  });
}

export function statusTiles(board, document) {
  return Object.fromEntries([
    ["status-story.svg", strip(STORY, board.story, 15, QOL.muted, "regular", document)],
    ...tileRow(board.change, document),
    ["status-lane-plugins.svg", strip(LABEL, "then each plugin with a new version", 13, QOL.dim, "medium", document)],
    ...tileRow(board.plugins, document),
    ["status-lane-tray.svg", strip(LABEL, "and qol-tray when it has a new version", 13, QOL.dim, "medium", document)],
    ...tileRow(board.tray, document),
  ]);
}
