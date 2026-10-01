import { round } from "../type.mjs";
import { QOL, bob, linear, qolWindow, svg } from "../svg.mjs";

const WIDTH = 1200;
const HEIGHT = 656;
const SLIDE = 3.6;
const FADE = 0.5;
const BACK = { x: 48, y: 48, width: 820, bar: 46 };
const FRONT = { x: 736, y: 262, scale: 0.5, height: 626 };

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
      doc.text("display", "qol settings", 22, BACK.x + 22, BACK.y + 31, QOL.muted) +
      doc.text("display", `/ ${slide.title}`, 22, BACK.x + 22 + doc.width("display", "qol settings ", 22), BACK.y + 31, QOL.ink) +
      `</g>`;
    return { image, title };
  });
  return { images: layers.map((layer) => layer.image).join(""), titles: layers.map((layer) => layer.title).join(""), imageHeight };
}

export function screensCard({ shots }, doc) {
  const { images, titles, imageHeight } = slideshow(shots.settings, doc, "back-image");
  const backHeight = BACK.bar + imageHeight;
  const frontWidth = round(840 * FRONT.scale);
  const frontHeight = round(FRONT.height * FRONT.scale);
  const defs =
    `<clipPath id="back-image"><path d="M${BACK.x} ${BACK.y + BACK.bar}H${BACK.x + BACK.width}V${BACK.y + backHeight - 14}a14 14 0 0 1-14 14H${BACK.x + 14}a14 14 0 0 1-14-14Z"/></clipPath>` +
    `<clipPath id="front-image"><rect x="${FRONT.x}" y="${FRONT.y}" width="${frontWidth}" height="${frontHeight}" rx="12"/></clipPath>` +
    `<filter id="lift" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000" flood-opacity="0.55"/></filter>`;

  const parts = [qolWindow(0, 0, WIDTH, HEIGHT)];
  parts.push(
    `<g>${bob(5, 7, 0)}<g filter="url(#lift)">` +
      `<path d="M${BACK.x} ${BACK.y + 14}a14 14 0 0 1 14-14H${BACK.x + BACK.width - 14}a14 14 0 0 1 14 14V${BACK.y + BACK.bar}H${BACK.x}Z" fill="${QOL.ground}"/>` +
      `<rect x="${BACK.x}" y="${BACK.y + BACK.bar}" width="${BACK.width}" height="${imageHeight}" fill="${QOL.ground}" clip-path="url(#back-image)"/>` +
      `</g>${images}${titles}<rect x="${BACK.x + 0.5}" y="${BACK.y + 0.5}" width="${BACK.width - 1}" height="${backHeight - 1}" rx="14" fill="none" stroke="${QOL.line}"/>` +
      `<rect x="${BACK.x}" y="${BACK.y + BACK.bar - 1}" width="${BACK.width}" height="1" fill="${QOL.line}"/></g>`,
  );
  parts.push(
    `<g>${bob(7, 5.5, 2)}<g filter="url(#lift)"><rect x="${FRONT.x}" y="${FRONT.y}" width="${frontWidth}" height="${frontHeight}" rx="12" fill="${QOL.ground}"/></g>` +
      `<image href="${shots.launcher}" x="${FRONT.x}" y="${FRONT.y}" width="${frontWidth}" height="${round(664 * FRONT.scale)}" clip-path="url(#front-image)"/></g>`,
  );
  return svg(WIDTH, HEIGHT, "Screenshots of qol: the settings panel moving through five plugin pages, and the launcher", doc, parts.join(""), defs);
}
