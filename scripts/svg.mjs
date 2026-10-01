import { round } from "./type.mjs";

export const DARK = {
  base: "#101114",
  raised: "#16171a",
  row: "#1d1e22",
  line: "#25262b",
  ink: "#f3f2f0",
  secondary: "#b3b1ac",
  muted: "#8b8880",
  faint: "#6f6c65",
  amber: "#e0ac3f",
  amberBright: "#ffc77a",
  orange: "#eb9d55",
  green: "#46e08a",
  teal: "#56d6e0",
  pink: "#e879c6",
  blue: "#68b0ff",
  violet: "#8a93f7",
};

export const LIGHT = { ink: "#1a1815", secondary: "#4f4b43", muted: "#6f6a60", amber: "#b8860b" };

const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

export function svg(width, height, label, doc, body, defs = "") {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(label)}">` +
    `<title>${escape(label)}</title><defs>${doc.defs()}${defs}</defs>${body}</svg>\n`
  );
}

export function mark(body, x, y, size, stroke) {
  return `<g transform="translate(${round(x)} ${round(y)}) scale(${round((size / 48) * 10000) / 10000})" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}

export function tile(body, x, y, size, color, { wash = 0.14, stroke = color, base = DARK.row } = {}) {
  const radius = round(size * 0.27);
  const inset = size * 0.22;
  return (
    `<rect x="${round(x)}" y="${round(y)}" width="${size}" height="${size}" rx="${radius}" fill="${base}"/>` +
    `<rect x="${round(x)}" y="${round(y)}" width="${size}" height="${size}" rx="${radius}" fill="${color}" fill-opacity="${wash}"/>` +
    mark(body, x + inset, y + inset, size - 2 * inset, stroke)
  );
}

export function glow(id, color, opacity) {
  return `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
}

export function panel(id, width, height, glows, radius = 24) {
  const defs =
    `<clipPath id="${id}-clip"><rect width="${width}" height="${height}" rx="${radius}"/></clipPath>` +
    `<linearGradient id="${id}-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${DARK.raised}"/><stop offset="1" stop-color="${DARK.base}"/></linearGradient>` +
    glows.map((spot, index) => glow(`${id}-glow${index}`, spot.color, spot.opacity)).join("");
  const body =
    `<rect width="${width}" height="${height}" rx="${radius}" fill="url(#${id}-fill)"/>` +
    `<g clip-path="url(#${id}-clip)">` +
    glows.map((spot, index) => `<circle cx="${spot.x}" cy="${spot.y}" r="${spot.r}" fill="url(#${id}-glow${index})"/>`).join("") +
    `</g>`;
  return { defs, body };
}

export function heading(doc, title, caption, x, y) {
  return doc.text("display", title, 36, x, y, DARK.ink) + doc.text("regular", caption, 17, x, y + 32, DARK.muted);
}

export function chip(doc, label, x, y, { dot, icon, color = DARK.secondary, fill = DARK.row, fillOpacity = 1, size = 16, height = 34 } = {}) {
  const pad = 14;
  const lead = dot ? 18 : icon ? 22 : 0;
  const width = pad * 2 + lead + doc.width("medium", label, size);
  const markup =
    `<rect x="${round(x)}" y="${y}" width="${round(width)}" height="${height}" rx="${height / 2}" fill="${fill}" fill-opacity="${fillOpacity}"/>` +
    (dot ? `<circle cx="${round(x + pad + 4)}" cy="${y + height / 2}" r="4.5" fill="${dot}"/>` : "") +
    (icon ? `<path transform="translate(${round(x + pad - 3)} ${y + height / 2 - 9.5}) scale(0.78)" d="${icon.d}" fill="${icon.fill}"/>` : "") +
    doc.text("medium", label, size, x + pad + lead, y + height / 2 + size * 0.36, color);
  return { markup, width };
}

export function chips(doc, labels, x, y, options = {}) {
  let end = x;
  const markup = labels
    .map((entry) => {
      const { markup, width } = chip(doc, entry.label, end, y, { ...options, ...entry });
      end += width + 10;
      return markup;
    })
    .join("");
  return { markup, end };
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

export function discrete(attribute, steps, total) {
  return `<animate attributeName="${attribute}" calcMode="discrete" ${keyed(steps, total)}/>`;
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
