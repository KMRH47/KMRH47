import { DARK, chip, chips, panel, svg, tile } from "../svg.mjs";

const WIDTH = 600;
const HEIGHT = 250;
const PAD = 32;
const STAR = "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z";

export function projectCard(project, stars, marks, doc) {
  const color = DARK[project.accent];
  const name = project.repo.split("/")[1];
  const frame = panel(name, WIDTH, HEIGHT, [
    { x: WIDTH - 40, y: 10, r: 300, color, opacity: 0.2 },
    { x: 0, y: HEIGHT, r: 240, color: DARK.amber, opacity: 0.05 },
  ], 20);
  const parts = [frame.body];
  parts.push(tile(project.icon ?? marks.get(project.mark), PAD, PAD, 68, color, { wash: 0.16 }));
  const labelWidth = 28 + doc.width("medium", project.label, 14);
  const nameSpace = WIDTH - PAD - labelWidth - 20 - (PAD + 88);
  const nameSize = Math.min(34, (34 * nameSpace) / doc.width("display", name, 34));
  parts.push(doc.text("display", name, nameSize, PAD + 88, PAD + 48, DARK.ink));
  parts.push(
    chip(doc, project.label, WIDTH - PAD - labelWidth, 26, { color, fill: color, fillOpacity: 0.12, size: 14, height: 28 }).markup,
  );

  const lines = doc.wrap("regular", project.text, 18, WIDTH - 2 * PAD);
  const shown = lines.slice(0, 2);
  if (lines.length > 2) shown[1] = doc.fit("regular", `${shown[1]} ${lines.slice(2).join(" ")}`, 18, WIDTH - 2 * PAD);
  shown.forEach((line, index) => parts.push(doc.text("regular", line, 18, PAD, 140 + index * 27, DARK.secondary)));

  const row = chips(doc, project.chips, PAD, 192);
  parts.push(row.markup);
  if (stars > 0) {
    parts.push(chip(doc, stars.toLocaleString("en-US"), row.end, 192, { icon: { d: STAR, fill: DARK.amber } }).markup);
  }
  return svg(WIDTH, HEIGHT, `${name}: ${project.text}`, doc, parts.join(""), frame.defs);
}
