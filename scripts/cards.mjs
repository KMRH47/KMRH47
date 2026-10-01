const WIDTH = 840;
const PAD = 32;

export const THEMES = {
  dark: {
    card: "#16171a",
    edge: null,
    ink: "#f3f2f0",
    secondary: "#b3b1ac",
    muted: "#8b8880",
    rule: "#25262b",
    accent: "#e0ac3f",
    quiet: "#6f6c65",
    wash: 0.12,
  },
  light: {
    card: "#faf8f3",
    edge: "#e6e0d3",
    ink: "#1a1815",
    secondary: "#4f4b43",
    muted: "#6f6a60",
    rule: "#e6e0d3",
    accent: "#b8860b",
    quiet: "#a5a7ab",
    wash: 0.12,
  },
};

const number = (value) => value.toLocaleString("en-US");

function card(height, label, doc, body, theme) {
  const edge = theme.edge ? ` stroke="${theme.edge}"` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${label}">` +
    `<title>${label}</title>${doc.defs()}` +
    `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="16" fill="${theme.card}"${edge}/>` +
    `${body}</svg>\n`
  );
}

function bar(x, y, width, height, radius, fill) {
  const r = Math.min(radius, width / 2, height / 2);
  return `<path fill="${fill}" d="M${x} ${y}h${width - r}a${r} ${r} 0 0 1 ${r} ${r}v${height - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${r - width}z"/>`;
}

function mark(body, x, y, size, stroke) {
  return `<g transform="translate(${x} ${y}) scale(${size / 48})" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}

function tile(body, x, y, size, theme) {
  const inset = size * 0.2;
  return (
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.27}" fill="${theme.accent}" fill-opacity="${theme.wash}"/>` +
    mark(body, x + inset, y + inset, size - 2 * inset, theme.accent)
  );
}

export function timeCard(stats, theme, type) {
  const doc = type.document();
  const parts = [
    doc.text("medium", "Where my time goes", 17, PAD, PAD + 17, theme.ink),
    doc.text("regular", "Past 12 months", 13, WIDTH - PAD, PAD + 17, theme.muted, "end"),
  ];
  const lead = stats.top[0];
  const figures = [
    [number(stats.total), "public commits"],
    [`${Math.round((lead.commits / stats.total) * 100)}%`, `of them in ${lead.name}`],
    [number(stats.activeDays), "of 365 days had a commit"],
  ];
  const figureWidth = (WIDTH - 2 * PAD) / figures.length;
  figures.forEach(([value, label], index) => {
    const x = PAD + index * figureWidth;
    parts.push(doc.text("semibold", value, 40, x, PAD + 86, theme.ink));
    parts.push(doc.text("regular", label, 13, x, PAD + 110, theme.secondary));
  });

  const rows = stats.top.map((repo, index) => ({
    label: repo.name,
    commits: repo.commits,
    fill: index === 0 ? theme.accent : theme.quiet,
  }));
  if (stats.rest.repos > 0) {
    rows.push({ label: `${stats.rest.repos} other repos`, commits: stats.rest.commits, fill: theme.quiet });
  }
  const barX = PAD + 236;
  const barSpan = WIDTH - PAD - barX - 64;
  const top = PAD + 146;
  rows.forEach((row, index) => {
    const y = top + index * 30;
    const width = Math.max(2, (row.commits / rows[0].commits) * barSpan);
    parts.push(doc.text("regular", type.fit("regular", row.label, 13, barX - PAD - 16), 13, PAD, y + 9, theme.ink));
    parts.push(bar(barX, y, width, 10, 4, row.fill));
    parts.push(doc.text("regular", number(row.commits), 13, barX + width + 8, y + 9, theme.secondary));
  });
  const footnote = top + rows.length * 30 + 16;
  parts.push(
    doc.text("regular", "Commits to public repositories, as counted by GitHub. Refreshed daily.", 11.5, PAD, footnote, theme.muted),
  );
  return card(footnote + PAD - 6, "Where my time goes: commits in the past 12 months by repository", doc, parts.join(""), theme);
}

export function qolCard(qol, theme, type) {
  const doc = type.document();
  const textX = PAD + 64 + 20;
  const parts = [
    tile(qol.mark, PAD, PAD, 64, theme),
    doc.text("semibold", "qol", 30, textX, PAD + 30, theme.ink),
    doc.text("regular", "A portable quality-of-life layer for any computer you sit down at.", 15, textX, PAD + 56, theme.secondary),
    doc.text("mono", "github.com/qol-tools/qol", 12.5, WIDTH - PAD, PAD + 30, theme.muted, "end"),
  ];
  const ruleY = PAD + 64 + 26;
  parts.push(`<path d="M${PAD} ${ruleY}H${WIDTH - PAD}" stroke="${theme.rule}"/>`);

  const columns = 3;
  const gap = 28;
  const columnWidth = (WIDTH - 2 * PAD - (columns - 1) * gap) / columns;
  const textWidth = columnWidth - 50;
  let y = ruleY + 28;
  for (let start = 0; start < qol.plugins.length; start += columns) {
    const row = qol.plugins
      .slice(start, start + columns)
      .map((plugin) => ({ ...plugin, lines: type.wrap("regular", plugin.description, 12.5, textWidth) }));
    row.forEach((plugin, column) => {
      const x = PAD + column * (columnWidth + gap);
      parts.push(tile(plugin.mark, x, y, 36, theme));
      parts.push(doc.text("medium", plugin.name, 14, x + 50, y + 14, theme.ink));
      plugin.lines.forEach((line, index) => {
        parts.push(doc.text("regular", line, 12.5, x + 50, y + 34 + index * 17.5, theme.secondary));
      });
    });
    const lines = Math.max(...row.map((plugin) => plugin.lines.length));
    y += Math.max(36, 40 + (lines - 1) * 17.5) + 24;
  }
  return card(y - 24 + PAD, `qol: ${qol.plugins.length} plugins`, doc, parts.join(""), theme);
}
