import { DARK, chip, chips, heading, panel, svg, tile } from "../svg.mjs";

const WIDTH = 1200;
const HEIGHT = 104;
const TEXT = 108;
const STAR = "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z";
const SMALL = { size: 14, height: 28 };

export function projectName(project) {
  return project.name ?? project.repo.split("/")[1];
}

export function projectCard(project, stars, marks, doc) {
  const color = DARK[project.accent];
  const name = projectName(project);
  const frame = panel(name, WIDTH, HEIGHT, [{ x: 54, y: HEIGHT / 2, r: 200, color, opacity: 0.22 }], 18);
  const parts = [frame.body];
  parts.push(tile(project.icon ?? marks.get(project.mark), 22, 20, 64, color, { wash: 0.16 }));
  parts.push(doc.text("display", name, 28, TEXT, 46, DARK.ink));
  parts.push(
    chip(doc, project.label, TEXT + doc.width("display", name, 28) + 16, 23, { ...SMALL, color, fill: color, fillOpacity: 0.12 }).markup,
  );
  const meta = stars > 0 ? [...project.chips, { label: stars.toLocaleString("en-US"), icon: { d: STAR, fill: DARK.amber } }] : project.chips;
  const metaWidth = chips(doc, meta, 0, 0, SMALL).end - 10;
  parts.push(chips(doc, meta, WIDTH - 24 - metaWidth, 23, SMALL).markup);
  parts.push(doc.text("regular", doc.fit("regular", project.text, 17.5, WIDTH - TEXT - 24), 17.5, TEXT, 80, DARK.secondary));
  return svg(WIDTH, HEIGHT, `${name}: ${project.text}`, doc, parts.join(""), frame.defs);
}

export function projectsHeader(title, caption, doc) {
  const height = 112;
  return svg(WIDTH, height, `${title}: ${caption}`, doc, heading(doc, title, caption, 24, 52));
}
