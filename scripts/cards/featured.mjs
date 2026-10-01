import { round } from "../type.mjs";
import { DARK, bob, chips, linear, panel, svg, tile } from "../svg.mjs";

const WIDTH = 1200;
const HEIGHT = 600;
const SLIDE = 3.6;
const FADE = 0.5;
const BACK = { x: 590, y: 52, width: 560, bar: 40 };
const FRONT = { x: 546, y: 268, scale: 0.47 };
const TEXT = { x: 64, width: 450 };

function slideshow(slides, doc, clipId) {
  const total = slides.length * SLIDE;
  const imageHeight = round((BACK.width * 667) / 1056);
  const layers = slides.map((slide, index) => {
    const start = index * SLIDE;
    const steps =
      index === 0
        ? [
            [0, 1],
            [SLIDE, 1],
            [SLIDE + FADE, 0],
            [total - FADE, 0],
            [total, 1],
          ]
        : [
            [0, 0],
            [start, 0],
            [start + FADE, 1],
            [start + SLIDE, 1],
            [start + SLIDE + FADE, 0],
            [total, 0],
          ];
    const fade = linear("opacity", steps, total);
    const image = `<g opacity="${index === 0 ? 1 : 0}">${fade}<image href="${slide.uri}" x="${BACK.x}" y="${BACK.y + BACK.bar}" width="${BACK.width}" height="${imageHeight}" clip-path="url(#${clipId})"/></g>`;
    const title =
      `<g opacity="${index === 0 ? 1 : 0}">${fade}` +
      doc.text("display", "qol settings", 19, BACK.x + 20, BACK.y + 27, DARK.muted) +
      doc.text("display", `/ ${slide.title}`, 19, BACK.x + 20 + doc.width("display", "qol settings ", 19), BACK.y + 27, DARK.ink) +
      `</g>`;
    return { image, title };
  });
  return { images: layers.map((layer) => layer.image).join(""), titles: layers.map((layer) => layer.title).join(""), imageHeight };
}

export function featuredCard({ marks, release, pluginCount, shots }, doc) {
  const frame = panel("featured", WIDTH, HEIGHT, [
    { x: 150, y: 110, r: 300, color: DARK.amber, opacity: 0.16 },
    { x: 960, y: 560, r: 380, color: DARK.violet, opacity: 0.14 },
    { x: 1190, y: 30, r: 220, color: DARK.orange, opacity: 0.1 },
  ]);
  const { images, titles, imageHeight } = slideshow(shots.settings, doc, "back-image");
  const backHeight = BACK.bar + imageHeight;
  const frontWidth = round(840 * FRONT.scale);
  const frontHeight = round(664 * FRONT.scale);
  const defs =
    frame.defs +
    `<clipPath id="back-image"><path d="M${BACK.x} ${BACK.y + BACK.bar}H${BACK.x + BACK.width}V${BACK.y + backHeight - 14}a14 14 0 0 1-14 14H${BACK.x + 14}a14 14 0 0 1-14-14Z"/></clipPath>` +
    `<clipPath id="front-image"><rect x="${FRONT.x}" y="${FRONT.y}" width="${frontWidth}" height="${frontHeight}" rx="12"/></clipPath>` +
    `<filter id="lift" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000" flood-opacity="0.55"/></filter>`;

  const parts = [frame.body];
  parts.push(tile(marks.get("qol"), TEXT.x, 60, 88, DARK.amber, { wash: 0.16 }));
  parts.push(doc.text("display", "qol", 84, TEXT.x + 112, 128, DARK.ink));
  parts.push(doc.text("medium", "A portable quality-of-life layer", 21, TEXT.x + 114, 160, DARK.secondary));

  const paragraphs = [
    `One tray app hosts ${pluginCount} plugins: a launcher, alt-tab with window previews, screenshots and screen recording, window snapping, key remapping, Bluetooth that reconnects, and sound and display control.`,
    "My plugins, keybindings and settings follow me to any machine I sit down at.",
  ];
  let y = 226;
  for (const paragraph of paragraphs) {
    for (const line of doc.wrap("regular", paragraph, 19, TEXT.width)) {
      parts.push(doc.text("regular", line, 19, TEXT.x, y, DARK.secondary));
      y += 30;
    }
    y += 14;
  }
  parts.push(
    chips(
      doc,
      [
        { label: "Rust", dot: "#dea584" },
        { label: "gpui", dot: DARK.amber },
        { label: "Linux", dot: DARK.green },
        { label: "macOS", dot: DARK.blue },
      ],
      TEXT.x,
      476,
    ).markup,
  );
  parts.push(doc.text("mono", `qol-tray ${release} · github.com/qol-tools/qol`, 15, TEXT.x, 552, DARK.muted));

  parts.push(
    `<g>${bob(5, 7, 0)}<g filter="url(#lift)">` +
      `<path d="M${BACK.x} ${BACK.y + 14}a14 14 0 0 1 14-14H${BACK.x + BACK.width - 14}a14 14 0 0 1 14 14V${BACK.y + BACK.bar}H${BACK.x}Z" fill="#1a1b1f"/>` +
      `<rect x="${BACK.x}" y="${BACK.y + BACK.bar}" width="${BACK.width}" height="${imageHeight}" fill="${DARK.raised}" clip-path="url(#back-image)"/>` +
      `</g>${images}${titles}</g>`,
  );
  parts.push(
    `<g>${bob(7, 5.5, 2)}<g filter="url(#lift)"><rect x="${FRONT.x}" y="${FRONT.y}" width="${frontWidth}" height="${frontHeight}" rx="12" fill="#f3efe6"/></g>` +
      `<image href="${shots.launcher}" x="${FRONT.x}" y="${FRONT.y}" width="${frontWidth}" height="${frontHeight}" clip-path="url(#front-image)"/></g>`,
  );
  return svg(WIDTH, HEIGHT, "qol: a portable quality-of-life layer, with screenshots of its launcher and settings", doc, parts.join(""), defs);
}
