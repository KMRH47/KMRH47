import { QOL, baseline, box, lines } from "../svg.mjs";
import { round } from "../type.mjs";
import { INNER, PAD, SPACE, card, frame, header, panel, title } from "./section.mjs";

const TAGLINE = "Each one scratched an itch, and most still run every day.";
const STAR = "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z";
const COLUMNS = 3;
const GAP = 12;
const COVER_HEIGHT = 210;
const KCD = { ink: "#f1e6cf", secondary: "#d8c8a6", gold: "#c9a45c", red: "#e38a66", edge: "#6b5530", wash: "23,18,13" };

function star(x, line) {
  return `<path transform="translate(${round(x - 1.2)} ${round(line - 11.2)}) scale(0.6)" d="${STAR}" fill="${QOL.accentText}"/>`;
}

function cover(doc, project, uri, x, y, width) {
  const { kicker, title, line, chips } = project.cover;
  const id = `cover-${project.repo.split("/")[1]}`;
  const top = y + (COVER_HEIGHT - 122) / 2;
  const left = x + 28;
  let chipX = left;
  const chipMarkup = chips
    .map((chip, index) => {
      const face = index === 0 ? "onestSemibold" : "onest";
      const chipWidth = doc.width(face, chip, 12) + 20;
      const shape = index === 0 ? box(chipX, top + 98, chipWidth, 24, 4, KCD.gold) : box(chipX, top + 98, chipWidth, 24, 4, "none", { stroke: "#8a6f3c" });
      const label = doc.text(face, chip, 12, chipX + 10, baseline(doc, face, 12, 24, top + 98), index === 0 ? "#17120d" : KCD.ink);
      chipX += chipWidth + 8;
      return shape + label;
    })
    .join("");
  return {
    defs:
      `<clipPath id="${id}-clip"><rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${COVER_HEIGHT}" rx="12"/></clipPath>` +
      `<linearGradient id="${id}-shade" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="rgb(${KCD.wash})" stop-opacity="0.94"/><stop offset="0.42" stop-color="rgb(${KCD.wash})" stop-opacity="0.82"/><stop offset="0.75" stop-color="rgb(${KCD.wash})" stop-opacity="0.1"/></linearGradient>`,
    markup:
      `<g clip-path="url(#${id}-clip)"><image href="${uri}" x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${COVER_HEIGHT}" preserveAspectRatio="xMidYMid slice"/>` +
      `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${COVER_HEIGHT}" fill="url(#${id}-shade)"/></g>` +
      box(x, y, width, COVER_HEIGHT, 12, "none", { stroke: KCD.edge }) +
      lines(doc, "onestSemibold", 11, 13, kicker.toUpperCase(), left, top, KCD.red, { tracking: 2 }).markup +
      lines(doc, "frauncesBold", 34, 36, title, left, top + 21, KCD.ink).markup +
      lines(doc, "frauncesItalic", 15, 21, line, left, top + 65, KCD.secondary).markup +
      chipMarkup,
  };
}

function rows(projects) {
  const placed = [];
  let row = [];
  let used = 0;
  projects.forEach((project) => {
    const span = project.span ?? 1;
    if (used + span > COLUMNS) {
      placed.push(row);
      row = [];
      used = 0;
    }
    row.push({ project, column: used, span });
    used += span;
  });
  return row.length ? [...placed, row] : placed;
}

export function smallerCard(projects, stars, covers, doc) {
  const head = title(doc, "smaller things", TAGLINE);
  const column = (INNER - GAP * (COLUMNS - 1)) / COLUMNS;
  let top = head.bottom;
  let markup = "";
  let defs = "";
  for (const row of rows(projects)) {
    if (row[0].project.cover) {
      const tile = cover(doc, row[0].project, covers[row[0].project.cover.shot], PAD, top, INNER);
      defs += tile.defs;
      markup += tile.markup;
      top += COVER_HEIGHT + GAP;
      continue;
    }
    const cells = row.map((cell) => ({ ...cell, width: column * cell.span + GAP * (cell.span - 1) }));
    const texts = cells.map((cell) => doc.wrap("onest", cell.project.text, 13, cell.width - 38).length * 19.5);
    const height = header(23.1) + Math.max(...texts) + 10 + 21 + 19;
    cells.forEach((cell, index) => {
      const { project, width } = cell;
      const x = PAD + cell.column * (column + GAP);
      const name = project.repo.split("/")[1];
      const count = stars.get(project.repo) ?? 0;
      const sub = count > 0 ? `${project.label} · ` : project.label;
      const shell = card(doc, x, top, width, height, name, sub, 22, 23.1);
      const text = top + header(23.1);
      const chip = text + texts[index] + 10;
      markup +=
        shell.markup +
        (count > 0 ? star(shell.sub.x, shell.sub.baseline) + doc.text("onestSemibold", ` ${count.toLocaleString("en-US")}`, 12.5, shell.sub.x + 10.5, shell.sub.baseline, QOL.accentText) : "") +
        lines(doc, "onest", 13, 19.5, project.text, x + 19, text, QOL.secondary, { width: width - 38 }).markup +
        `<circle cx="${round(x + 23)}" cy="${round(chip + 10.5)}" r="3.25" fill="none" stroke="${QOL.muted}" stroke-width="1.5"/>` +
        doc.text("onest", project.language, 13, x + 37, baseline(doc, "onest", 13, 13, chip + 4), QOL.secondary);
    });
    top += height + GAP;
  }
  const height = Math.ceil(top - GAP + PAD);
  const wash = frame("smaller-wash", height, "#1c1d24", "#111214");
  const label = `smaller things: ${projects.map((project) => `${project.repo.split("/")[1]}, ${project.text}`).join(" ")}`;
  return panel(height, label, doc, wash.body + head.markup + markup, wash.defs + defs, SPACE);
}
