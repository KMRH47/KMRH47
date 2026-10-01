import { round } from "../type.mjs";
import { DARK, discrete, linear, panel, svg } from "../svg.mjs";

const WIDTH = 1200;
const PAD = 48;
const CELL = 16;
const GAP = 4;
const ROWS = 7;
const INTRO = 3.2;
const TICK = 0.12;
const GENERATIONS = 160;
const HOLD = 1.6;
const FADE = 0.6;
const BACKDROP = 0.2;
const LEVELS = [DARK.row, "#4a3b1a", "#7a5d1f", "#b4862c", DARK.amber];
const TRAIL = [1, 0.55, 0.32, 0.17, 0.08];

function evolve(alive, exists) {
  return alive.map((column, x) =>
    column.map((cell, y) => {
      if (!exists[x][y]) return false;
      let neighbours = 0;
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          if ((dx || dy) && alive[x + dx]?.[y + dy]) neighbours += 1;
        }
      }
      return cell ? neighbours === 2 || neighbours === 3 : neighbours === 3;
    }),
  );
}

function generations(calendar) {
  const grid = (test) =>
    calendar.weeks.map((week) => {
      const column = Array(ROWS).fill(false);
      for (const day of week) column[day.weekday] = test(day);
      return column;
    });
  const exists = grid(() => true);
  let alive = grid((day) => day.level > 0);
  const states = [alive];
  const seen = new Set([JSON.stringify(alive)]);
  while (states.length <= GENERATIONS) {
    alive = evolve(alive, exists);
    const key = JSON.stringify(alive);
    if (seen.has(key)) break;
    states.push(alive);
    seen.add(key);
  }
  return { exists, states };
}

export function lifeCard(calendar, doc) {
  const { exists, states } = generations(calendar);
  const weeks = calendar.weeks.length;
  const x0 = round((WIDTH - (weeks * (CELL + GAP) - GAP)) / 2);
  const y0 = 128;
  const footnote = y0 + ROWS * (CELL + GAP) + 40;
  const height = footnote + 38;
  const lifeEnd = INTRO + (states.length - 1) * TICK;
  const settled = lifeEnd + HOLD;
  const total = settled + FADE;
  const frame = panel("life", WIDTH, height, [
    { x: WIDTH / 2, y: y0 + 70, r: 520, color: DARK.amber, opacity: 0.08 },
    { x: 0, y: 0, r: 260, color: DARK.violet, opacity: 0.07 },
  ]);
  const defs = frame.defs + `<rect id="cell" width="${CELL}" height="${CELL}" rx="3.5"/>`;
  const at = (x, y) => `x="${x0 + x * (CELL + GAP)}" y="${y0 + y * (CELL + GAP)}"`;
  const during = (inside, outside) =>
    linear(
      "opacity",
      [
        [0, outside],
        [INTRO, outside],
        [INTRO + 0.35, inside],
        [settled, inside],
        [total, outside],
      ],
      total,
    );

  const parts = [frame.body];
  parts.push(doc.text("monoMedium", "ACTIVITY", 15, PAD, 56, DARK.amber, { tracking: 3 }));
  parts.push(doc.text("display", "Quality of life, played as the Game of Life", 34, PAD, 92, DARK.ink));

  const base = [];
  const levels = LEVELS.map(() => []);
  calendar.weeks.forEach((week, x) => {
    for (const day of week) {
      base.push(`<use href="#cell" ${at(x, day.weekday)}/>`);
      if (day.level > 0) levels[day.level].push(`<use href="#cell" ${at(x, day.weekday)}/>`);
    }
  });
  parts.push(`<g fill="${DARK.row}">${base.join("")}</g>`);
  parts.push(
    `<g>${during(BACKDROP, 1)}${levels.map((cells, level) => (level ? `<g fill="${LEVELS[level]}">${cells.join("")}</g>` : "")).join("")}</g>`,
  );

  const cells = [];
  exists.forEach((column, x) =>
    column.forEach((present, y) => {
      if (!present) return;
      const steps = [[0, 0]];
      let lastAlive = -Infinity;
      states.forEach((state, generation) => {
        if (state[x][y]) lastAlive = generation;
        steps.push([INTRO + generation * TICK, TRAIL[generation - lastAlive] ?? 0]);
      });
      steps.push([settled, 0]);
      if (!steps.some(([, value]) => value > 0)) return;
      const compact = steps.filter((step, index) => index === 0 || step[1] !== steps[index - 1][1]);
      cells.push(`<use href="#cell" ${at(x, y)} opacity="0">${discrete("opacity", compact, total)}</use>`);
    }),
  );
  parts.push(`<g fill="${DARK.amberBright}">${cells.join("")}</g>`);

  const digits = doc.width("mono", "000", 16);
  parts.push(`<g opacity="0">${during(1, 0)}${doc.text("mono", "generation", 16, WIDTH - PAD - digits - 10, 92, DARK.muted, { anchor: "end" })}</g>`);
  states.forEach((_, generation) => {
    const until = generation === states.length - 1 ? settled : INTRO + (generation + 1) * TICK;
    const show = discrete(
      "opacity",
      [
        [0, 0],
        [INTRO + generation * TICK, 1],
        [until, 0],
      ],
      total,
    );
    parts.push(`<g opacity="0">${show}${doc.text("mono", String(generation), 16, WIDTH - PAD, 92, DARK.secondary, { anchor: "end" })}</g>`);
  });
  parts.push(`<g>${during(0, 1)}${doc.text("mono", `${calendar.total.toLocaleString("en-US")} contributions`, 16, WIDTH - PAD, 92, DARK.muted, { anchor: "end" })}</g>`);
  parts.push(
    doc.text(
      "regular",
      "My contribution graph for the past year seeds Conway's Game of Life. Every day with a contribution starts alive.",
      15,
      PAD,
      footnote,
      DARK.muted,
    ),
  );
  return svg(WIDTH, height, "My contribution graph for the past year, played as Conway's Game of Life", doc, parts.join(""), defs);
}
