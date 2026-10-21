import { round } from "./type.mjs";

export const QOL = {
  ground: "#161819",
  raised: "#202225",
  bar: "#26282a",
  line: "#2c2d31",
  ink: "#f9f9f9",
  text: "#9e9e9e",
  muted: "#909090",
  dim: "#686a6c",
  accent: "#8a93f7",
  accentText: "#9996eb",
  selection: "#46497a",
  success: "#4ade80",
  danger: "#ff6b6b",
  secondary: "#c9cbcf",
  rule: "#353c44",
};

const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

export function svg(width, height, label, doc, body, defs = "") {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(label)}">` +
    `<title>${escape(label)}</title><defs>${doc.defs()}${defs}</defs>${body}</svg>\n`
  );
}

export function mark(body, x, y, size, stroke, width = 4) {
  return `<g transform="translate(${round(x)} ${round(y)}) scale(${round((size / 48) * 10000) / 10000})" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}

export function baseline(doc, face, size, lineHeight, top) {
  const { ascent, descent } = doc.metrics(face, size);
  return top + (lineHeight - ascent - descent) / 2 + ascent;
}

export function lines(doc, face, size, lineHeight, text, x, top, fill, { width, ...options } = {}) {
  const rows = width ? doc.wrap(face, text, size, width) : [text];
  const first = baseline(doc, face, size, lineHeight, top);
  return {
    markup: rows.map((row, index) => doc.text(face, row, size, x, first + index * lineHeight, fill, options)).join(""),
    height: rows.length * lineHeight,
  };
}

export function box(x, y, width, height, radius, fill, { stroke, strokeOpacity, opacity } = {}) {
  const inset = stroke ? 0.5 : 0;
  const fade = opacity === undefined ? "" : ` fill-opacity="${opacity}"`;
  const edge = stroke ? ` stroke="${stroke}"${strokeOpacity === undefined ? "" : ` stroke-opacity="${strokeOpacity}"`}` : "";
  return `<rect x="${round(x + inset)}" y="${round(y + inset)}" width="${round(width - 2 * inset)}" height="${round(height - 2 * inset)}" rx="${round(radius - inset)}" fill="${fill}"${fade}${edge}/>`;
}

export function wash(id, width, height, from, to) {
  return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${round(width / 2)} 0) scale(${round(width * 1.2)} ${round(height * 0.7)})"><stop offset="0" stop-color="${from}"/><stop offset="0.7" stop-color="${to}"/></radialGradient>`;
}

export function qolWindow(x, y, width, height) {
  return `<rect x="${x + 0.5}" y="${y + 0.5}" width="${width - 1}" height="${height - 1}" rx="12" fill="${QOL.ground}" stroke="${QOL.line}"/>`;
}

function keyed(steps, total) {
  const keys = [];
  const values = [];
  for (const [time, value] of steps) {
    const key = Math.round(Math.min(1, Math.max(0, time / total)) * 10000) / 10000;
    if (keys.length && key <= keys.at(-1)) {
      values[values.length - 1] = value;
      continue;
    }
    keys.push(key);
    values.push(value);
  }
  keys[0] = 0;
  return `values="${values.join(";")}" keyTimes="${keys.join(";")}" dur="${round(total)}s" repeatCount="indefinite"`;
}

export function linear(attribute, steps, total) {
  return `<animate attributeName="${attribute}" calcMode="linear" ${keyed(steps, total)}/>`;
}

export function bob(distance, seconds, phase) {
  return `<animateTransform attributeName="transform" type="translate" values="0 0;0 ${-distance};0 0" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" dur="${seconds}s" begin="${-phase}s" repeatCount="indefinite"/>`;
}

export function dataUri(type, bytes) {
  return `data:${type};base64,${bytes.toString("base64")}`;
}
