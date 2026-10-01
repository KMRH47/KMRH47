import { DARK, LIGHT, svg } from "../svg.mjs";

const WIDTH = 1200;
const HEIGHT = 132;

export function sectionHeader(number, label, title, theme, doc) {
  const palette = theme === "dark" ? DARK : LIGHT;
  const id = `rule-${number}`;
  const defs = `<linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${palette.amber}"/><stop offset="0.55" stop-color="${palette.amber}" stop-opacity="0.15"/><stop offset="1" stop-color="${palette.amber}" stop-opacity="0"/></linearGradient>`;
  const body =
    doc.text("monoMedium", `${number} / ${label.toUpperCase()}`, 16, 2, 46, palette.amber, { tracking: 3 }) +
    doc.text("display", title, 50, 0, 104, palette.ink) +
    `<rect x="0" y="124" width="${WIDTH}" height="3" rx="1.5" fill="url(#${id})"/>`;
  return svg(WIDTH, HEIGHT, title, doc, body, defs);
}
