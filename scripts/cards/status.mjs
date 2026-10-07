import { round } from "../type.mjs";
import { QOL, svg } from "../svg.mjs";

const WIDTH = 838;
const ROW = 21;
const PIP = 11;
const PITCH = 15;
const PER_ROW = 9;
const COLOR = { ok: QOL.success, bad: QOL.danger, run: QOL.accent, wait: QOL.dim };
const LINE = { ok: QOL.muted, bad: QOL.danger, run: QOL.accentText, wait: QOL.dim };
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

function row(doc, x, y, { name, time, state, dotted = true, live = state === "run", width, color }) {
  const lead = dotted ? 18 : 0;
  const timeWidth = time ? doc.width("regular", time, 13) + 10 : 0;
  const ink = color ?? (state === "bad" ? QOL.danger : dotted ? QOL.muted : LINE[state]);
  return (
    (dotted ? dot(state, x + 4.5, y - 5) : "") +
    doc.text("regular", doc.fit("regular", name, 14, width - lead - timeWidth), 14, x + lead, y, ink) +
    (time ? doc.text("regular", time, 13, x + width, y, live ? QOL.accentText : QOL.dim, { anchor: "end" }) : "")
  );
}

function fold({ items, wall }) {
  const ok = items.filter((item) => item.state === "ok");
  const bad = items.filter((item) => item.state === "bad");
  const building = items.length - ok.length - bad.length;
  const lines = [{ name: `${ok.length} released`, time: wall, state: "ok", dotted: false, live: building > 0 }];
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

const GAP = 8;
const PADX = 14;

function tileSvg(width, height, label, doc, body) {
  const inner = `<rect x="${GAP / 2 + 0.5}" y="${GAP / 2 + 0.5}" width="${round(width - GAP - 1)}" height="${height - GAP - 1}" rx="12" fill="${QOL.ground}" stroke="${QOL.line}"/>`;
  return svg(round(width), height, label, doc, inner + `<g transform="translate(${GAP / 2} ${GAP / 2})">${body}</g>`);
}

function head(doc, name, fact) {
  return doc.text("display", name, 36, PADX, 44, QOL.ink) + doc.text("medium", fact, 13, PADX + 2, 65, QOL.accentText);
}

function stageTile(doc, stage, inner) {
  const parts = [head(doc, stage.name, stage.fact)];
  let y = 74;
  if (stage.items) {
    stage.items.forEach((item, index) => parts.push(pip(item.state, PADX + 2 + (index % PER_ROW) * PITCH, y + 5 + Math.floor(index / PER_ROW) * PITCH)));
    y += 5 + Math.ceil(stage.items.length / PER_ROW) * PITCH + 3;
    for (const line of fold(stage)) {
      parts.push(row(doc, PADX + 2, y + 15, { ...line, width: inner }));
      y += ROW;
    }
  } else {
    for (const item of stage.pieces) {
      parts.push(row(doc, PADX + 2, y + 15, { ...item, width: inner }));
      y += ROW;
    }
  }
  return { body: parts.join(""), bottom: y };
}

function lines(doc, list, inner) {
  return list.map((line, index) => row(doc, PADX + 2, 90 + index * ROW, { ...line, width: inner })).join("");
}

export function statusTiles(stages, { queue, merged }, document) {
  const files = {};
  const topWidth = WIDTH / stages.length;
  const topInner = topWidth - GAP - 2 * PADX - 2;
  const drawn = stages.map((stage) => {
    const doc = document();
    return { stage, doc, ...stageTile(doc, stage, topInner) };
  });
  const topHeight = Math.ceil(Math.max(...drawn.map((tile) => tile.bottom)) + 16 + GAP);
  for (const { stage, doc, body } of drawn) {
    files[`status-${stage.name}.svg`] = tileSvg(topWidth, topHeight, `qol ${describe(stage)}.`, doc, body);
  }

  const width = WIDTH / 3;
  const inner = width - GAP - 2 * PADX - 2;
  const front = queue.entries[0];
  const queueLines = queue.entries.length
    ? queue.entries.map((entry) => ({ name: `#${entry.number} ${entry.title}`, time: entry.state === "run" ? `${entry.left} left` : entry.left && `in ${entry.left}`, state: entry.state }))
    : [{ name: "nothing waiting", state: "wait", dotted: false, color: QOL.dim }];
  const checkLines = queue.front?.checks.length
    ? queue.front.checks.map((check) => ({ name: check.name, time: check.time, state: check.state }))
    : [{ name: front ? "waiting to start" : "idle", state: "wait", dotted: false, color: QOL.dim }];
  const mergedLines = merged.pulls.map((pull) => ({ name: `#${pull.number} ${pull.title}`, time: pull.ago, state: "ok", live: false }));
  const height = Math.ceil(74 + Math.max(queueLines.length, checkLines.length, mergedLines.length) * ROW + 10 + GAP);
  const bottom = [
    ["queue", front ? `${queue.entries.length} queued${front.left ? `, next merge in ${front.left}` : ""}` : "empty", queueLines],
    ["checks", front ? `#${front.number}, merges next` : "nothing to check", checkLines],
    ["merged", `${merged.count} in 30 days`, mergedLines],
  ];
  for (const [name, fact, list] of bottom) {
    const doc = document();
    const label = `qol ${name} (${fact}): ${list.map((line) => line.name).join(", ")}`;
    files[`status-${name}.svg`] = tileSvg(width, height, label, doc, head(doc, name, fact) + lines(doc, list, inner));
  }
  return files;
}
