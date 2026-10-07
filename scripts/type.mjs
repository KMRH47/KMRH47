import { readFile } from "node:fs/promises";
import path from "node:path";
import opentype from "opentype.js";

const FACES = {
  regular: { file: "IBMPlexSans-Regular.ttf", id: "r" },
  medium: { file: "IBMPlexSans-Medium.ttf", id: "m" },
  semibold: { file: "IBMPlexSans-SemiBold.ttf", id: "s" },
  mono: { file: "IBMPlexMono-Regular.ttf", id: "o" },
  monoMedium: { file: "IBMPlexMono-Medium.ttf", id: "n" },
  display: { file: "SairaSemiCondensed-SemiBold.ttf", id: "d" },
};

export const round = (value) => Math.round(value * 100) / 100;

function pathData(commands) {
  return commands
    .map((command) => {
      switch (command.type) {
        case "M":
        case "L":
          return `${command.type}${round(command.x)} ${round(command.y)}`;
        case "Q":
          return `Q${round(command.x1)} ${round(command.y1)} ${round(command.x)} ${round(command.y)}`;
        case "C":
          return `C${round(command.x1)} ${round(command.y1)} ${round(command.x2)} ${round(command.y2)} ${round(command.x)} ${round(command.y)}`;
        default:
          return "Z";
      }
    })
    .join("");
}

export const FONT_FILES = Object.fromEntries(Object.entries(FACES).map(([face, { file }]) => [face, file]));

export async function loadType(dir) {
  const buffers = {};
  for (const [face, file] of Object.entries(FONT_FILES)) {
    const bytes = await readFile(path.join(dir, file));
    buffers[face] = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  return typeFromFonts(buffers);
}

export function typeFromFonts(buffers) {
  const fonts = Object.fromEntries(Object.entries(buffers).map(([face, buffer]) => [face, opentype.parse(buffer)]));

  const glyphRun = (face, text) => {
    const font = fonts[face];
    const run = [];
    font.forEachGlyph(text, 0, 0, font.unitsPerEm, undefined, (glyph, x) => {
      run.push({ glyph, x, advance: glyph.advanceWidth ?? 0 });
    });
    return run;
  };

  const width = (face, text, size, tracking = 0) =>
    fonts[face].getAdvanceWidth(text, size) + tracking * Math.max(0, [...text].length - 1);

  const measure = {
    width,
    edges(face, text, size, tracking = 0) {
      const scale = size / fonts[face].unitsPerEm;
      return glyphRun(face, text).map(({ x, advance }, index) => (x + advance) * scale + tracking * index);
    },
    fit(face, text, size, maxWidth) {
      if (width(face, text, size) <= maxWidth) return text;
      let cut = text;
      while (cut && width(face, `${cut}…`, size) > maxWidth) cut = cut.slice(0, -1);
      return `${cut}…`;
    },
    wrap(face, text, size, maxWidth) {
      const lines = [];
      let line = "";
      for (const word of text.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (line && width(face, next, size) > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      return line ? [...lines, line] : lines;
    },
  };

  return {
    ...measure,
    document() {
      const glyphs = new Map();
      return {
        ...measure,
        text(face, text, size, x, y, fill, { anchor = "start", tracking = 0, opacity } = {}) {
          const em = fonts[face].unitsPerEm;
          const scale = size / em;
          const total = width(face, text, size, tracking);
          const shift = { start: 0, middle: total / 2, end: total }[anchor];
          let uses = "";
          glyphRun(face, text).forEach(({ glyph, x: glyphX }, index) => {
            if (glyph.index === 0) throw new Error(`${face} has no glyph for a character in ${JSON.stringify(text)}`);
            const commands = glyph.getPath(0, 0, em).commands;
            if (commands.length === 0) return;
            const id = `${FACES[face].id}${glyph.index}`;
            if (!glyphs.has(id)) glyphs.set(id, pathData(commands));
            uses += `<use href="#${id}" x="${round(glyphX + (tracking * index) / scale)}"/>`;
          });
          const fade = opacity === undefined ? "" : ` opacity="${opacity}"`;
          return `<g fill="${fill}"${fade} transform="translate(${round(x - shift)} ${round(y)}) scale(${round(scale * 10000) / 10000})">${uses}</g>`;
        },
        defs() {
          return [...glyphs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join("");
        },
      };
    },
  };
}
