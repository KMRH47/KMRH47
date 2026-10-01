import { round } from "../type.mjs";
import { DARK, bob, discrete, glow, linear, panel, svg, tile } from "../svg.mjs";

const WIDTH = 1200;
const HEIGHT = 400;
const PHRASES = [
  ["a launcher.", "launcher"],
  ["alt-tab with window previews.", "alt-tab"],
  ["screenshot and recording tools.", "shot"],
  ["window snapping.", "window-actions"],
  ["key remapping.", "key-remap"],
  ["Bluetooth that reconnects.", "bluetooth"],
  ["voice dictation for terminals.", "voice"],
  ["smart light controls.", "lights"],
];
const TYPE = 0.06;
const HOLD = 1.7;
const ERASE = 0.026;
const PAUSE = 0.35;
const HUB = { x: 905, y: 196, size: 104 };
const ORBIT = { rx: 205, ry: 128, size: 64 };
const LINE = { x: 72, y: 286, size: 30 };

function schedule(doc) {
  let start = 0;
  return PHRASES.map(([phrase, icon]) => {
    const edges = doc.edges("medium", phrase, LINE.size);
    const typed = start + edges.length * TYPE;
    const erase = typed + HOLD;
    const end = erase + edges.length * ERASE + PAUSE;
    const slot = { phrase, icon, edges, start, typed, erase, end };
    start = end;
    return slot;
  });
}

function typing(slots, total, phraseX) {
  const caret = [[0, phraseX]];
  const clips = slots.map((slot, index) => {
    const widths = [[0, 0]];
    slot.edges.forEach((edge, step) => {
      widths.push([slot.start + (step + 1) * TYPE, edge]);
      caret.push([slot.start + (step + 1) * TYPE, phraseX + edge]);
    });
    slot.edges
      .slice(0, -1)
      .reverse()
      .forEach((edge, step) => {
        widths.push([slot.erase + (step + 1) * ERASE, edge]);
        caret.push([slot.erase + (step + 1) * ERASE, phraseX + edge]);
      });
    const cleared = slot.erase + slot.edges.length * ERASE;
    widths.push([cleared, 0]);
    caret.push([cleared, phraseX]);
    return `<clipPath id="type${index}"><rect x="${round(phraseX)}" y="${LINE.y - 34}" width="0" height="48">${discrete("width", widths, total)}</rect></clipPath>`;
  });
  return { clips: clips.join(""), caret: discrete("x", caret, total) };
}

function orbit(index, count) {
  const angle = ((-112.5 + (360 / count) * index) * Math.PI) / 180;
  return { x: HUB.x + ORBIT.rx * Math.cos(angle), y: HUB.y + ORBIT.ry * Math.sin(angle) };
}

export function heroCard({ marks, release, pluginCount }, doc) {
  const slots = schedule(doc);
  const total = slots.at(-1).end;
  const prefix = "I build ";
  const phraseX = LINE.x + doc.width("regular", prefix, LINE.size);
  const { clips, caret } = typing(slots, total, phraseX);
  const frame = panel("hero", WIDTH, HEIGHT, [
    { x: HUB.x, y: HUB.y, r: 360, color: DARK.amber, opacity: 0.2 },
    { x: 1170, y: 430, r: 280, color: DARK.orange, opacity: 0.12 },
    { x: 150, y: 430, r: 320, color: DARK.violet, opacity: 0.08 },
  ]);
  const defs =
    frame.defs +
    clips +
    glow("hub-glow", DARK.amber, 0.45) +
    glow("lit-glow", DARK.amber, 0.5) +
    `<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#ffffff" fill-opacity="0.07"/></pattern>` +
    `<radialGradient id="dots-fade" cx="0.75" cy="0.5" r="0.6"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<mask id="dots-mask"><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dots-fade)"/></mask>`;

  const parts = [frame.body, `<rect width="${WIDTH}" height="${HEIGHT}" rx="24" fill="url(#dots)" mask="url(#dots-mask)"/>`];
  parts.push(doc.text("medium", "Hi, I'm", 24, LINE.x, 118, DARK.muted));
  parts.push(doc.text("display", "Karsten", 116, LINE.x - 6, 224, DARK.ink));
  parts.push(doc.text("regular", prefix, LINE.size, LINE.x, LINE.y, DARK.secondary));
  slots.forEach((slot, index) => {
    parts.push(`<g clip-path="url(#type${index})">${doc.text("medium", slot.phrase, LINE.size, phraseX, LINE.y, DARK.amber)}</g>`);
  });
  parts.push(
    `<rect x="${round(phraseX)}" y="${LINE.y - 26}" width="3" height="33" rx="1.5" fill="${DARK.amber}">${caret}<animate attributeName="opacity" values="1;0" keyTimes="0;0.5" dur="1s" calcMode="discrete" repeatCount="indefinite"/></rect>`,
  );
  parts.push(`<path d="M${LINE.x} 330H${LINE.x + 36}" stroke="${DARK.amber}" stroke-width="3" stroke-linecap="round"/>`);
  parts.push(doc.text("regular", "Full-stack developer in Malmö", 19, LINE.x + 52, 337, DARK.muted));

  const points = slots.map((_, index) => orbit(index, slots.length));
  points.forEach((point, index) => {
    parts.push(`<path d="M${HUB.x} ${HUB.y}L${round(point.x)} ${round(point.y)}" stroke="${DARK.amber}" stroke-opacity="0.16" stroke-width="1.5"/>`);
    parts.push(
      `<circle r="3.5" fill="${DARK.amberBright}" opacity="0">` +
        `<animateMotion path="M${HUB.x} ${HUB.y}L${round(point.x)} ${round(point.y)}" dur="2.6s" begin="${-index * 0.33}s" repeatCount="indefinite"/>` +
        `<animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.25;0.75;1" dur="2.6s" begin="${-index * 0.33}s" repeatCount="indefinite"/>` +
        `</circle>`,
    );
  });

  parts.push(
    `<circle cx="${HUB.x}" cy="${HUB.y}" r="150" fill="url(#hub-glow)">` +
      `<animate attributeName="opacity" values="0.55;1;0.55" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" dur="4s" repeatCount="indefinite"/></circle>`,
  );
  parts.push(tile(marks.get("qol"), HUB.x - HUB.size / 2, HUB.y - HUB.size / 2, HUB.size, DARK.amber, { wash: 0.16 }));

  slots.forEach((slot, index) => {
    const point = points[index];
    const x = point.x - ORBIT.size / 2;
    const y = point.y - ORBIT.size / 2;
    const lit = linear(
      "opacity",
      [
        [0, 0],
        [slot.start, 0],
        [slot.start + 0.25, 1],
        [slot.end - 0.3, 1],
        [slot.end, 0],
        [total, 0],
      ],
      total,
    );
    parts.push(
      `<g>${bob(6, 5 + (index % 3), index * 0.8)}` +
        tile(marks.get(slot.icon), x, y, ORBIT.size, DARK.amber, { wash: 0.05, stroke: DARK.muted }) +
        `<g opacity="0">${lit}<circle cx="${round(point.x)}" cy="${round(point.y)}" r="70" fill="url(#lit-glow)"/>` +
        tile(marks.get(slot.icon), x, y, ORBIT.size, DARK.amber, { wash: 0.24 }) +
        `</g></g>`,
    );
  });

  parts.push(doc.text("mono", `qol-tray ${release} · ${pluginCount} plugins`, 15, WIDTH - 48, 374, DARK.muted, { anchor: "end" }));
  const label = `Hi, I'm Karsten. I build ${PHRASES.map(([phrase]) => phrase.replace(/\.$/, "")).join(", ")}.`;
  return svg(WIDTH, HEIGHT, label, doc, parts.join(""), defs);
}
