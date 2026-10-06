import { round } from "../type.mjs";
import { QOL, qolWindow, svg } from "../svg.mjs";

const WIDTH = 838;
const PAD = 24;
const COLUMN = (WIDTH - 2 * PAD) / 5;
const INNER = COLUMN - 14;
const TOP = 86;
const ROW = 21;
const PIP = 11;
const PITCH = 15;
const PER_ROW = 9;
const COLOR = { ok: QOL.success, bad: QOL.danger, run: QOL.accent, wait: QOL.dim };
const LINE = { ok: QOL.muted, bad: QOL.danger, run: QOL.accentText };
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
  if (state === "ok" || state === "bad") return `<rect x="${round(x)}" y="${y}" width="${PIP}" height="${PIP}" rx="2" fill="${COLOR[state]}"/>`;
  return `<rect x="${round(x + 1)}" y="${y + 1}" width="${PIP - 2}" height="${PIP - 2}" rx="1.5" fill="none" stroke="${COLOR[state]}" stroke-width="2"/>`;
}

function row(doc, x, y, { name, time, state, dotted = true, live = state === "run" }) {
  const lead = dotted ? 18 : 0;
  const timeWidth = time ? doc.width("regular", time, 13) + 10 : 0;
  const color = dotted ? QOL.muted : LINE[state];
  return (
    (dotted ? dot(state, x + 4.5, y - 5) : "") +
    doc.text("regular", doc.fit("regular", name, 14, INNER - lead - timeWidth), 14, x + lead, y, color) +
    (time ? doc.text("regular", time, 13, x + INNER, y, live ? QOL.accentText : QOL.dim, { anchor: "end" }) : "")
  );
}

function fold({ items, wall }) {
  const ok = items.filter((item) => item.state === "ok");
  const bad = items.filter((item) => item.state === "bad");
  const building = items.length - ok.length - bad.length;
  const lines = [{ name: `${bad.length || building ? ok.length : `all ${ok.length}`} released`, time: wall, state: "ok", dotted: false, live: building > 0 }];
  if (bad.length) lines.push({ name: `${bad.map((item) => item.name).join(" and ")} failed`, time: "", state: "bad", dotted: false });
  if (building) lines.push({ name: `${building} still building`, time: "", state: "run", dotted: false });
  return lines;
}

function describe(stage) {
  const pieces = stage.items ?? stage.pieces;
  const off = pieces.filter((item) => item.state !== "ok");
  const summary = off.length ? off.map((item) => `${item.name} ${WORD[item.state]}`).join(", ") : "all passed";
  return `${stage.name} (${stage.fact}): ${summary}`;
}

export function statusCard(stages, doc) {
  const parts = [];
  let deepest = 0;
  stages.forEach((stage, column) => {
    const x = PAD + column * COLUMN;
    parts.push(doc.text("display", stage.name, 36, x, 56, QOL.ink));
    parts.push(doc.text("medium", stage.fact, 13, x + 2, 77, QOL.accentText));
    let y = TOP;
    if (stage.items) {
      stage.items.forEach((item, index) => {
        parts.push(pip(item.state, x + 2 + (index % PER_ROW) * PITCH, y + 5 + Math.floor(index / PER_ROW) * PITCH));
      });
      y += 5 + Math.ceil(stage.items.length / PER_ROW) * PITCH + 3;
      for (const line of fold(stage)) {
        parts.push(row(doc, x + 2, y + 15, line));
        y += ROW;
      }
    } else {
      for (const item of stage.pieces) {
        parts.push(row(doc, x + 2, y + 15, item));
        y += ROW;
      }
    }
    deepest = Math.max(deepest, y);
  });
  const height = Math.ceil(deepest + 20);
  return svg(WIDTH, height, `qol build status. ${stages.map(describe).join("; ")}.`, doc, qolWindow(0, 0, WIDTH, height) + parts.join(""));
}
