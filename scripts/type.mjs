import { readFile } from "node:fs/promises";
import path from "node:path";
import opentype from "opentype.js";

const FACES = {
  regular: { file: "IBMPlexSans-Regular.ttf", id: "r" },
  medium: { file: "IBMPlexSans-Medium.ttf", id: "m" },
  semibold: { file: "IBMPlexSans-SemiBold.ttf", id: "s" },
  mono: { file: "IBMPlexMono-Regular.ttf", id: "o" },
};

const round = (value) => Math.round(value * 100) / 100;

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

export async function loadType(dir) {
  const fonts = {};
  for (const [face, { file }] of Object.entries(FACES)) {
    const bytes = await readFile(path.join(dir, file));
    fonts[face] = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  const width = (face, text, size) => fonts[face].getAdvanceWidth(text, size);
  return {
    width,
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
    document() {
      const glyphs = new Map();
      return {
        text(face, text, size, x, y, fill, anchor = "start") {
          const font = fonts[face];
          const em = font.unitsPerEm;
          const shift = { start: 0, middle: width(face, text, size) / 2, end: width(face, text, size) }[anchor];
          let uses = "";
          font.forEachGlyph(text, 0, 0, em, undefined, (glyph, glyphX) => {
            const commands = glyph.getPath(0, 0, em).commands;
            if (commands.length === 0) return;
            const id = `${FACES[face].id}${glyph.index}`;
            if (!glyphs.has(id)) glyphs.set(id, pathData(commands));
            uses += `<use href="#${id}" x="${round(glyphX)}"/>`;
          });
          return `<g fill="${fill}" transform="translate(${round(x - shift)} ${round(y)}) scale(${size / em})">${uses}</g>`;
        },
        defs() {
          return `<defs>${[...glyphs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join("")}</defs>`;
        },
      };
    },
  };
}
