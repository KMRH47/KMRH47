import { QOL, baseline, box, lines, wash } from "../svg.mjs";

export const WIDTH = 831;
export const PAD = 40;
export const INNER = WIDTH - 2 * PAD;

export const heavy = (size) => size * (1 / 48 + ((Math.min(Math.max(size, 9), 36) - 9) / 27) * (1 / 64 - 1 / 48));
export const header = (line) => 17 + line + 6 + 15 + 12;

export function frame(id, height, from, to) {
  return { defs: wash(id, WIDTH, height, from, to), body: box(0, 0, WIDTH, height, 12, `url(#${id})`) };
}

export function title(doc, name, tagline) {
  const heading = lines(doc, "display", 34, 37.4, name, WIDTH / 2, PAD, QOL.ink, { anchor: "middle", bold: heavy(34) });
  const caption = lines(doc, "onest", 15, 21, tagline, WIDTH / 2, PAD + heading.height + 8, QOL.ink, { anchor: "middle" });
  const rule = PAD + heading.height + 8 + caption.height + 16;
  return { markup: heading.markup + caption.markup + box(PAD, rule, INNER, 1, 0, QOL.rule), bottom: rule + 17 };
}

export function card(doc, x, y, width, height, head, sub, font, line) {
  const top = y + 17 + line + 6;
  return {
    markup:
      box(x, y, width, height, 12, QOL.ground, { stroke: QOL.line }) +
      lines(doc, "display", font, line, head, x + 19, y + 17, QOL.ink, { tracking: -0.2, bold: heavy(font) }).markup +
      lines(doc, "onestSemibold", 12.5, 15, sub, x + 19, top, QOL.accentText).markup,
    sub: { x: x + 19 + doc.width("onestSemibold", sub, 12.5), baseline: baseline(doc, "onestSemibold", 12.5, 15, top) },
  };
}
