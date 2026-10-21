import { QOL, baseline, lines } from "../svg.mjs";
import { round } from "../type.mjs";
import { INNER, PAD, SPACE, card, frame, header, panel, title } from "./section.mjs";

const TAGLINE = "Each one fixed one annoyance, and most still run every day.";
const STAR = "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z";
const COLUMNS = 3;
const GAP = 12;

function star(x, line) {
  return `<path transform="translate(${round(x - 1.2)} ${round(line - 11.2)}) scale(0.6)" d="${STAR}" fill="${QOL.accentText}"/>`;
}

function rows(projects) {
  const placed = [];
  let row = [];
  let used = 0;
  projects.forEach((project, index) => {
    const span = index === 0 ? 2 : 1;
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

export function smallerCard(projects, stars, doc) {
  const head = title(doc, "smaller things", TAGLINE);
  const column = (INNER - GAP * (COLUMNS - 1)) / COLUMNS;
  let top = head.bottom;
  let markup = "";
  for (const row of rows(projects)) {
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
  return panel(height, label, doc, wash.body + head.markup + markup, wash.defs, SPACE);
}
