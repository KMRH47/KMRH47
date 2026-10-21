import { QOL, lines, svg } from "../svg.mjs";
import { WIDTH, heavy } from "./section.mjs";

const HEADLINE = "I build the tools I wish my computer came with.";
const SUBLINE = "Full-stack developer in Malmö. Most of it starts as a small annoyance at my own desk.";
const THEMES = { dark: { ink: QOL.ink, secondary: QOL.secondary }, light: { ink: "#1f2328", secondary: "#59636e" } };

export function heroCard(theme, doc) {
  const { ink, secondary } = THEMES[theme];
  const headline = lines(doc, "display", 40, 44, HEADLINE, WIDTH / 2, 8, ink, { anchor: "middle", tracking: -0.3, bold: heavy(40) });
  const subline = lines(doc, "onest", 15, 22.5, SUBLINE, WIDTH / 2, 64, secondary, { anchor: "middle" });
  return svg(WIDTH, 91, `${HEADLINE} ${SUBLINE}`, doc, headline.markup + subline.markup);
}
