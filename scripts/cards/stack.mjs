import { DARK, chips, heading, panel, svg } from "../svg.mjs";

const WIDTH = 1200;
const PAD = 48;
const LABEL = 200;
const ROW = 54;
const TOP = 140;

export function stackCard(stack, doc) {
  const height = TOP + (stack.length - 1) * ROW + 34 + 44;
  const frame = panel("stack", WIDTH, height, [{ x: 80, y: 0, r: 320, color: DARK.amber, opacity: 0.1 }]);
  const parts = [frame.body, heading(doc, "stack", "what I build with.", PAD, 80)];
  stack.forEach((group, index) => {
    const y = TOP + index * ROW;
    parts.push(doc.text("medium", group.label, 16, PAD, y + 23, DARK.muted));
    parts.push(chips(doc, group.chips, PAD + LABEL, y).markup);
  });
  const label = stack.map((group) => `${group.label}: ${group.chips.map((chip) => chip.label).join(", ")}`).join("; ");
  return svg(WIDTH, height, `My stack. ${label}`, doc, parts.join(""), frame.defs);
}
