import { baseline, box, lines } from "../svg.mjs";
import { round } from "../type.mjs";
import { heavy } from "./section.mjs";

const STAR = "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z";
const COMMAND = "M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3";
const RUNE = "M10 16 L32 40 L21 50 L21 10 L32 20 L10 44";

export function star(x, line, fill) {
  return `<path transform="translate(${round(x - 1.2)} ${round(line - 11.2)}) scale(0.6)" d="${STAR}" fill="${fill}"/>`;
}

function name(doc, text, x, top, fill, size = 24) {
  return lines(doc, "display", size, size * 1.1, text, x, top, fill, { tracking: -0.2, bold: heavy(size) }).markup;
}

function sub(doc, label, count, x, top, fill, face = "onestSemibold") {
  const line = baseline(doc, face, 12.5, 15, top);
  const text = count > 0 ? `${label} · ` : label;
  let markup = doc.text(face, text, 12.5, x, line, fill);
  if (count > 0) {
    const after = x + doc.width(face, text, 12.5);
    markup += star(after, line, fill) + doc.text(face, ` ${count.toLocaleString("en-US")}`, 12.5, after + 10.5, line, fill);
  }
  return markup;
}

function language(doc, label, count, x, top, fill) {
  const line = baseline(doc, "onestSemibold", 12.5, 15, top);
  return `<circle cx="${round(x + 4)}" cy="${round(line - 4.5)}" r="3.5" fill="${fill}"/>` + sub(doc, label, count, x + 14, top, fill);
}

function clip(id, { x, y, width, height }) {
  return `<clipPath id="${id}"><rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="12"/></clipPath>`;
}

function qolSkills(doc, tile, count) {
  const { x, y, width, height } = tile;
  const note = x + width - 200;
  const rows = [
    [["---", "#8a83c9"]],
    [["name: ", "#3a375c"], ["qol-cli", "#4b3fb5"]],
    [["description: Use", "#3a375c"]],
    [["when changing the", "#3a375c"]],
    [["qol CLI.", "#3a375c"]],
    [["---", "#8a83c9"]],
  ];
  const yaml = rows
    .map((parts, index) => {
      let left = note + 12;
      const line = baseline(doc, "mono", 11, 18, y + 32 + index * 18);
      return parts
        .map(([text, fill]) => {
          const markup = doc.text("mono", text, 11, left, line, fill);
          left += doc.width("mono", text, 11);
          return markup;
        })
        .join("");
    })
    .join("");
  return {
    defs: "",
    markup:
      box(x, y, width, height, 12, "#eeeaff", { stroke: "#c9c2f2" }) +
      name(doc, "qol-skills", x + 20, y + 18, "#1b1840") +
      sub(doc, "Agent skills · JavaScript", count, x + 20, y + 50, "#4b3fb5") +
      lines(doc, "onest", 13, 19.5, tile.project.text, x + 20, y + 76, "#3a375c", { width: note - x - 38 }).markup +
      box(note, y + 20, 180, height - 40, 8, "#ffffff", { stroke: "#d6d0f7" }) +
      yaml,
  };
}

function pointz(doc, tile, count) {
  const { x, y, width, height } = tile;
  const id = "tile-pointz";
  return {
    defs: clip(id, tile),
    markup:
      box(x, y, width, height, 12, "#2dd4bf") +
      `<g clip-path="url(#${id})"><circle cx="${round(x + width - 36)}" cy="${round(y + height - 36)}" r="56" fill="#0f766e" fill-opacity="0.25"/><circle cx="${round(x + width - 36)}" cy="${round(y + height - 36)}" r="18" fill="#0b3b37"/></g>` +
      name(doc, "pointz", x + 20, y + 18, "#052e2b", 26) +
      sub(doc, tile.project.label, count, x + 20, y + 52, "#0b4a44") +
      lines(doc, "onest", 13, 19.5, tile.project.text, x + 20, y + 78, "#063a35", { width: 170 }).markup +
      language(doc, tile.project.language, 0, x + 20, y + height - 35, "#063a35"),
  };
}

function btQuickie(doc, tile, count) {
  const { x, y, width, height } = tile;
  const id = "tile-bt-quickie";
  return {
    defs: clip(id, tile),
    markup:
      box(x, y, width, height, 12, "#1d4ed8") +
      `<g clip-path="url(#${id})"><path transform="translate(${round(x + width - 96)} ${round(y + height - 132)}) scale(2.5)" d="${RUNE}" fill="none" stroke="#93c5fd" stroke-opacity="0.35" stroke-width="3" stroke-linejoin="round"/></g>` +
      name(doc, "bt-quickie", x + 20, y + 18, "#ffffff", 26) +
      sub(doc, tile.project.label, count, x + 20, y + 52, "#dbeafe") +
      lines(doc, "onest", 13, 19.5, tile.project.text, x + 20, y + 78, "#eff6ff", { width: 180 }).markup +
      language(doc, tile.project.language, 0, x + 20, y + height - 35, "#dbeafe"),
  };
}

function windowsLikeRemap(doc, tile, count) {
  const { x, y, width, height } = tile;
  const id = "tile-windows-like-remap";
  const half = x + width / 2;
  const bar = y + height - 64;
  const key = baseline(doc, "mono", 22, 26, y + 40);
  return {
    defs: clip(id, tile),
    markup:
      `<g clip-path="url(#${id})">` +
      `<rect x="${round(x)}" y="${round(y)}" width="${round(width / 2)}" height="${round(height)}" fill="#e8e8ed"/>` +
      `<rect x="${round(half)}" y="${round(y)}" width="${round(width / 2)}" height="${round(height)}" fill="#0f4fbf"/>` +
      `<rect x="${round(x)}" y="${round(bar)}" width="${round(width)}" height="64" fill="#16161c"/></g>` +
      box(x, y, width, height, 12, "none", { stroke: "#3a3a46" }) +
      lines(doc, "onestSemibold", 11, 13, "MACOS", x + 20, y + 20, "#55555f", { tracking: 1 }).markup +
      `<path transform="translate(${round(x + 20)} ${round(key - 18)}) scale(0.8)" d="${COMMAND}" fill="none" stroke="#18181b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      doc.text("mono", "C", 22, x + 46, key, "#18181b") +
      lines(doc, "onestSemibold", 11, 13, "FEELS LIKE", half + 18, y + 20, "#dbeafe", { tracking: 1 }).markup +
      doc.text("mono", "Ctrl C", 22, half + 18, key, "#ffffff") +
      name(doc, "windows-like-remap", x + 20, bar + 10, "#ffffff", 20) +
      sub(doc, `Hammerspoon · ${tile.project.language}`, count, x + 20, bar + 38, "#b9b9c4"),
  };
}

function fastYoutrack(doc, tile, count) {
  const { x, y, width, height } = tile;
  const chip = doc.width("mono", "PRJ-142", 12) + 12;
  const ticket = baseline(doc, "mono", 14, 40, y + 80);
  return {
    defs: "",
    markup:
      box(x, y, width, height, 12, "#fdf0f7", { stroke: "#f2c6dd" }) +
      name(doc, "fast-youtrack", x + 20, y + 18, "#3b0a2a") +
      sub(doc, tile.project.label, 0, x + 20, y + 50, "#9d174d") +
      box(x + 20, y + 80, width - 40, 40, 8, "#ffffff", { stroke: "#f2c6dd" }) +
      box(x + 32, y + 90, chip, 20, 4, "#be185d") +
      doc.text("mono", "PRJ-142", 12, x + 38, baseline(doc, "mono", 12, 20, y + 90), "#ffffff") +
      doc.text("mono", "+1h 24m", 14, x + width - 32, ticket, "#3b0a2a", { anchor: "end" }) +
      language(doc, tile.project.language, count, x + 20, y + height - 35, "#5b2140"),
  };
}

export const TILES = {
  "qol-skills": qolSkills,
  pointz,
  "bt-quickie": btQuickie,
  "windows-like-remap": windowsLikeRemap,
  "fast-youtrack": fastYoutrack,
};
