import { round } from "../type.mjs";
import { DARK, heading, panel, svg } from "../svg.mjs";

const WIDTH = 1200;
const PAD = 48;
const ROW = 40;
const BAR = 14;

const number = (value) => value.toLocaleString("en-US");

export function timeCard(stats, doc) {
  const rows = stats.top.map((repo, index) => ({
    label: repo.name,
    commits: repo.commits,
    fill: index === 0 ? DARK.amber : DARK.faint,
  }));
  if (stats.rest.repos > 0) {
    rows.push({ label: `${stats.rest.repos} other repos`, commits: stats.rest.commits, fill: DARK.faint });
  }
  const top = 292;
  const footnote = top + rows.length * ROW + 30;
  const height = footnote + 40;
  const frame = panel("time", WIDTH, height, [
    { x: 300, y: 150, r: 360, color: DARK.amber, opacity: 0.12 },
    { x: WIDTH, y: 0, r: 300, color: DARK.orange, opacity: 0.07 },
  ]);
  const barX = PAD + 330;
  const barSpan = WIDTH - PAD - barX - 90;
  const defs = frame.defs + `<clipPath id="bars"><rect x="${barX}" y="0" width="${WIDTH - barX}" height="${height}"/></clipPath>`;

  const parts = [frame.body];
  parts.push(heading(doc, "where my time goes", "the past twelve months, by repository.", PAD, 80));
  const lead = stats.top[0];
  const figures = [
    [number(stats.total), "public commits"],
    [`${Math.round((lead.commits / stats.total) * 100)}%`, `of them in ${lead.name}`],
    [number(stats.activeDays), "of 365 days had a commit"],
  ];
  const figureWidth = (WIDTH - 2 * PAD) / figures.length;
  figures.forEach(([value, label], index) => {
    const x = PAD + index * figureWidth;
    parts.push(doc.text("display", value, 68, x - 2, 210, DARK.ink));
    parts.push(doc.text("regular", label, 18, x, 242, DARK.secondary));
  });

  parts.push(`<g clip-path="url(#bars)">`);
  rows.forEach((row, index) => {
    const y = top + index * ROW;
    const width = round(Math.max(BAR / 2, (row.commits / rows[0].commits) * barSpan));
    const begin = round(0.3 + index * 0.12);
    parts.push(
      `<rect x="${barX - BAR}" y="${y}" width="${BAR}" height="${BAR}" rx="${BAR / 2}" fill="${row.fill}">` +
        `<animate attributeName="width" from="${BAR}" to="${width + BAR}" begin="${begin}s" dur="1.1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.8 0.2 1"/></rect>`,
    );
  });
  parts.push(`</g>`);
  rows.forEach((row, index) => {
    const y = top + index * ROW;
    const width = Math.max(BAR / 2, (row.commits / rows[0].commits) * barSpan);
    parts.push(doc.text("regular", doc.fit("regular", row.label, 18, barX - PAD - 24), 18, PAD, y + 13, DARK.ink));
    parts.push(
      `<g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${round(1.1 + index * 0.12)}s" dur="0.4s" fill="freeze"/>` +
        doc.text("regular", number(row.commits), 18, barX + width + 12, y + 13, DARK.secondary) +
        `</g>`,
    );
  });
  parts.push(doc.text("regular", "Commits to public repositories, as counted by GitHub. Refreshed daily.", 15, PAD, footnote, DARK.muted));
  return svg(WIDTH, height, "Where my time goes: commits in the past 12 months by repository", doc, parts.join(""), defs);
}
