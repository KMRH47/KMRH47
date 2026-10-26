import { QOL, baseline, box, lines } from "../svg.mjs";
import { round } from "../type.mjs";
import { INNER, PAD, SPACE, WIDTH, card, frame, header, title } from "./section.mjs";
import { TILES, star } from "./tiles.mjs";

const TAGLINE = "Each one scratched an itch.";
const COLUMNS = 3;
const GAP = 12;
const COVER_HEIGHT = 210;
const TILE_HEIGHT = 200;
const KCD = { ink: "#f1e6cf", secondary: "#d8c8a6", gold: "#c9a45c", red: "#e38a66", edge: "#6b5530", wash: "23,18,13" };

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

const repoName = (project) => project.repo.split("/")[1];

function layout(projects, type) {
  const column = (INNER - GAP * (COLUMNS - 1)) / COLUMNS;
  const headBottom = title(type.document(), "smaller things", TAGLINE).bottom;
  const tiles = [];
  let top = headBottom;
  for (const row of rows(projects)) {
    if (row[0].project.cover) {
      tiles.push({ ...row[0], x: PAD, y: top, width: INNER, height: COVER_HEIGHT });
      top += COVER_HEIGHT + GAP;
      continue;
    }
    const cells = row.map((cell) => ({ ...cell, x: PAD + cell.column * (column + GAP), y: top, width: column * cell.span + GAP * (cell.span - 1) }));
    const texts = cells.map((cell) => type.wrap("onest", cell.project.text, 13, cell.width - 38).length * 19.5);
    const styled = cells.every((cell) => TILES[repoName(cell.project)]);
    const height = styled ? TILE_HEIGHT : header(23.1) + Math.max(...texts) + 10 + 21 + 19;
    cells.forEach((cell, index) => tiles.push({ ...cell, height, textHeight: texts[index] }));
    top += height + GAP;
  }
  return { tiles, headBottom, height: Math.ceil(top - GAP + PAD) };
}

function tileMarkup(doc, tile, stars, covers) {
  const { project, x, y: top, width, height, textHeight } = tile;
  if (project.cover) return cover(doc, project, covers[project.cover.shot], x, top, width);
  const name = repoName(project);
  const count = stars.get(project.repo) ?? 0;
  if (TILES[name]) return TILES[name](doc, tile, count);
  const sub = count > 0 ? `${project.label} · ` : project.label;
  const shell = card(doc, x, top, width, height, name, sub, 22, 23.1);
  const text = top + header(23.1);
  const chip = text + textHeight + 10;
  return {
    defs: "",
    markup:
      shell.markup +
      (count > 0 ? star(shell.sub.x, shell.sub.baseline, QOL.accentText) + doc.text("onestSemibold", ` ${count.toLocaleString("en-US")}`, 12.5, shell.sub.x + 10.5, shell.sub.baseline, QOL.accentText) : "") +
      lines(doc, "onest", 13, 19.5, project.text, x + 19, text, QOL.secondary, { width: width - 38 }).markup +
      `<circle cx="${round(x + 23)}" cy="${round(chip + 10.5)}" r="3.25" fill="none" stroke="${QOL.muted}" stroke-width="1.5"/>` +
      doc.text("onest", project.language, 13, x + 37, baseline(doc, "onest", 13, 13, chip + 4), QOL.secondary),
  };
}

const attribute = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

function slice(doc, crop, label, body, defs) {
  const view = `${round(crop.x)} ${round(crop.y)} ${round(crop.width)} ${round(crop.height)}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(crop.width)}" height="${round(crop.height)}" viewBox="${view}" role="img" aria-label="${attribute(label)}">` +
    `<title>${attribute(label)}</title><defs>${doc.defs()}${defs}</defs><g transform="translate(0 ${SPACE})">${body}</g></svg>\n`
  );
}

export function smallerSlices(projects, stars, covers, type) {
  const { tiles, headBottom, height } = layout(projects, type);
  const wash = frame("smaller-wash", height, "#1c1d24", "#111214");
  const lastTop = Math.max(...tiles.map((tile) => tile.y));
  const headDoc = type.document();
  const head = title(headDoc, "smaller things", TAGLINE);
  const files = {
    "smaller-head.svg": slice(headDoc, { x: 0, y: 0, width: WIDTH, height: headBottom - GAP / 2 + SPACE }, `smaller things. ${TAGLINE}`, wash.body + head.markup, wash.defs),
  };
  for (const tile of tiles) {
    const doc = type.document();
    const drawn = tileMarkup(doc, tile, stars, covers);
    const left = tile.column === 0 ? 0 : tile.x - GAP / 2;
    const right = tile.column + tile.span === COLUMNS ? WIDTH : tile.x + tile.width + GAP / 2;
    const top = tile.y - GAP / 2 + SPACE;
    const bottom = tile.y === lastTop ? height + SPACE : tile.y + tile.height + GAP / 2 + SPACE;
    const name = repoName(tile.project);
    files[`smaller-${name}.svg`] = slice(doc, { x: left, y: top, width: right - left, height: bottom - top }, `${name}: ${tile.project.text}`, wash.body + drawn.markup, wash.defs + drawn.defs);
  }
  return files;
}
