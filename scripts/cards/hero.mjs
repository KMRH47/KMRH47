import { round } from "../type.mjs";
import { DARK, discrete, glow, hints, keycap, panel, searchBar, svg, tile } from "../svg.mjs";

const WIDTH = 1200;
const HEIGHT = 494;
const QUERIES = ["window", "shot", "control", "session", "blue", "remap"];
const TYPE = 0.14;
const EMPTY = 0.6;
const HOLD = 1.6;
const MOVE = 1.2;
const PRESS = 0.3;
const WINDOW = { x: 48, y: 40, width: 1104, height: 378 };
const BAR = { x: 66, y: 58, width: 1068, height: 64, text: 122, size: 26 };
const ROWS = { x: 66, y: 140, width: 620, height: 80, gap: 10, count: 3 };
const PREVIEW = { x: 702, y: 140, width: 432, height: 260, header: 100 };
const HINTS_Y = 460;

function score(plugin, query) {
  const name = plugin.name.toLowerCase();
  const description = plugin.description.toLowerCase();
  if (name.startsWith(query)) return 5;
  if (name.split(" ").some((word) => word.startsWith(query))) return 4;
  if (name.includes(query)) return 3;
  if (description.split(/[^a-z0-9]+/).some((word) => word.startsWith(query))) return 2;
  return description.includes(query) ? 1 : 0;
}

function search(plugins, query) {
  if (!query) return plugins.slice(0, ROWS.count);
  return plugins
    .map((plugin) => ({ plugin, score: score(plugin, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.plugin.name.localeCompare(b.plugin.name))
    .slice(0, ROWS.count)
    .map((entry) => entry.plugin);
}

function nameMatch(name, query) {
  const lower = name.toLowerCase();
  if (!query) return null;
  for (let index = lower.indexOf(query); index >= 0; index = lower.indexOf(query, index + 1)) {
    if (index === 0 || lower[index - 1] === " ") return [index, index + query.length];
  }
  const index = lower.indexOf(query);
  return index >= 0 ? [index, index + query.length] : null;
}

function timeline(plugins, doc) {
  const states = [];
  const queries = [];
  let time = 0;
  QUERIES.forEach((query, index) => {
    const start = time;
    states.push({ time, prefix: "", selected: 0, length: 0 });
    time += EMPTY;
    for (let length = 1; length <= query.length; length += 1) {
      states.push({ time, prefix: query.slice(0, length), selected: 0, query: index, length });
      time += length === query.length ? HOLD : TYPE;
    }
    if (search(plugins, query).length > 1) {
      states.push({ time, prefix: query, selected: 1, query: index, length: query.length, press: true });
      time += MOVE;
    }
    queries.push({ query, edges: doc.edges("mono", query, BAR.size), start, end: time });
  });
  states.forEach((state, index) => {
    state.rows = search(plugins, state.prefix);
    state.end = states[index + 1]?.time ?? time;
  });
  return { states, queries, total: time };
}

function shown(intervals, total) {
  const merged = [];
  for (const [start, end] of intervals) {
    const last = merged.at(-1);
    if (last && Math.abs(last[1] - start) < 1e-6) last[1] = end;
    else merged.push([start, end]);
  }
  const steps = [[0, 0]];
  for (const [start, end] of merged) steps.push([start, 1], [end, 0]);
  return discrete("opacity", steps, total);
}

function layer(states, total, key, render) {
  const groups = new Map();
  for (const state of states) {
    for (const [id, args] of key(state)) {
      if (!groups.has(id)) groups.set(id, { args, intervals: [] });
      groups.get(id).intervals.push([state.time, state.end]);
    }
  }
  return [...groups.values()].map(({ args, intervals }) => `<g opacity="0">${shown(intervals, total)}${render(...args)}</g>`).join("");
}

const rowY = (position) => ROWS.y + position * (ROWS.height + ROWS.gap);

export function heroCard({ plugins, release, pluginCount }, doc) {
  const { states, queries, total } = timeline(plugins, doc);
  const frame = panel("hero", WIDTH, HEIGHT, [
    { x: 920, y: 260, r: 520, color: DARK.amber, opacity: 0.16 },
    { x: 80, y: HEIGHT, r: 380, color: DARK.violet, opacity: 0.12 },
    { x: WIDTH, y: 0, r: 300, color: DARK.orange, opacity: 0.1 },
  ]);
  const defs =
    frame.defs +
    glow("preview-glow", DARK.amber, 0.3) +
    `<clipPath id="preview-clip"><rect x="${PREVIEW.x}" y="${PREVIEW.y}" width="${PREVIEW.width}" height="${PREVIEW.height}" rx="14"/></clipPath>` +
    `<clipPath id="header-clip"><rect x="${PREVIEW.x}" y="${PREVIEW.y}" width="${PREVIEW.width}" height="${PREVIEW.header}"/></clipPath>` +
    `<filter id="lift" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="#000" flood-opacity="0.6"/></filter>` +
    queries
      .map(({ edges, end }, index) => {
        const widths = [[0, 0]];
        for (const state of states) {
          if (state.query === index && state.length) widths.push([state.time, edges[state.length - 1]]);
        }
        widths.push([end, 0]);
        return `<clipPath id="query${index}"><rect x="${BAR.text}" y="${BAR.y}" width="0" height="${BAR.height}">${discrete("width", widths, total)}</rect></clipPath>`;
      })
      .join("");

  const parts = [frame.body];
  parts.push(`<g filter="url(#lift)"><rect x="${WINDOW.x}" y="${WINDOW.y}" width="${WINDOW.width}" height="${WINDOW.height}" rx="22" fill="${DARK.raised}"/></g>`);
  parts.push(searchBar(doc, BAR.x, BAR.y, BAR.width, BAR.height, "PLUGINS"));

  const baseline = BAR.y + BAR.height / 2 + 9;
  parts.push(
    layer(states, total, (state) => (state.length ? [] : [["placeholder", []]]), () =>
      doc.text("regular", "search plugins", 22, BAR.text + 2, baseline - 1, DARK.faint),
    ),
  );
  queries.forEach(({ query }, index) => {
    parts.push(`<g clip-path="url(#query${index})">${doc.text("mono", query, BAR.size, BAR.text, baseline, DARK.ink)}</g>`);
  });
  const caret = states.map((state) => [state.time, round(BAR.text + (state.length ? queries[state.query].edges[state.length - 1] + 2 : -3))]);
  parts.push(
    `<rect x="${BAR.text}" y="${BAR.y + 16}" width="2.5" height="${BAR.height - 32}" rx="1.25" fill="${DARK.amber}">${discrete("x", caret, total)}` +
      `<animate attributeName="opacity" values="1;0" keyTimes="0;0.5" dur="1s" calcMode="discrete" repeatCount="indefinite"/></rect>`,
  );

  parts.push(
    layer(
      states,
      total,
      (state) => state.rows.map((_, position) => [`row${position}`, [position]]),
      (position) => `<rect x="${ROWS.x}" y="${rowY(position)}" width="${ROWS.width}" height="${ROWS.height}" rx="14" fill="${DARK.row}"/>`,
    ),
  );
  parts.push(
    layer(
      states,
      total,
      (state) => (state.rows.length > state.selected ? [[`selected${state.selected}`, [state.selected]]] : []),
      (position) =>
        `<rect x="${ROWS.x}" y="${rowY(position)}" width="${ROWS.width}" height="${ROWS.height}" rx="14" fill="${DARK.line}"/>` +
        `<rect x="${ROWS.x}" y="${rowY(position) + 18}" width="4" height="${ROWS.height - 36}" rx="2" fill="${DARK.amber}"/>` +
        keycap(doc, "enter", ROWS.x + ROWS.width - 46, rowY(position) + 46),
    ),
  );
  const textX = ROWS.x + 86;
  const textWidth = ROWS.x + ROWS.width - 58 - textX;
  parts.push(
    layer(
      states,
      total,
      (state) => state.rows.map((plugin, position) => [`${plugin.name}@${position}`, [plugin, position]]),
      (plugin, position) =>
        tile(plugin.mark, ROWS.x + 16, rowY(position) + 14, 52, DARK.amber, { wash: 0.06, stroke: DARK.secondary }) +
        doc.text("display", plugin.name, 24, textX, rowY(position) + 35, DARK.ink) +
        doc.text("regular", doc.fit("regular", plugin.description, 16.5, textWidth), 16.5, textX, rowY(position) + 61, DARK.secondary),
    ),
  );
  parts.push(
    layer(
      states,
      total,
      (state) => {
        const plugin = state.rows[state.selected];
        return plugin ? [[`${plugin.name}#${state.selected}`, [plugin, state.selected]]] : [];
      },
      (plugin, position) => tile(plugin.mark, ROWS.x + 16, rowY(position) + 14, 52, DARK.amber, { wash: 0.22 }),
    ),
  );
  parts.push(
    layer(
      states,
      total,
      (state) =>
        state.rows.flatMap((plugin, position) => {
          const match = nameMatch(plugin.name, state.prefix);
          return match ? [[`${plugin.name}@${position}:${match}`, [plugin, position, match]]] : [];
        }),
      (plugin, position, [start, end]) =>
        doc.text("display", plugin.name.slice(start, end), 24, textX + doc.width("display", plugin.name.slice(0, start), 24), rowY(position) + 35, DARK.amber),
    ),
  );

  parts.push(`<rect x="${PREVIEW.x}" y="${PREVIEW.y}" width="${PREVIEW.width}" height="${PREVIEW.height}" rx="14" fill="${DARK.row}"/>`);
  parts.push(
    layer(
      states,
      total,
      (state) => {
        const plugin = state.rows[state.selected];
        return plugin ? [[plugin.name, [plugin]]] : [];
      },
      (plugin) => {
        const actions = plugin.actions.slice(0, 3);
        const more = plugin.actions.length - actions.length;
        const actionY = (index) => PREVIEW.y + PREVIEW.header + 40 + index * 32;
        return (
          `<g clip-path="url(#preview-clip)"><rect x="${PREVIEW.x}" y="${PREVIEW.y}" width="${PREVIEW.width}" height="${PREVIEW.header}" fill="${DARK.line}"/></g>` +
          `<g clip-path="url(#header-clip)"><circle cx="${PREVIEW.x + 60}" cy="${PREVIEW.y + PREVIEW.header / 2}" r="160" fill="url(#preview-glow)"/></g>` +
          tile(plugin.mark, PREVIEW.x + 28, PREVIEW.y + 18, 64, DARK.amber, { wash: 0.22 }) +
          doc.text("display", plugin.name, 30, PREVIEW.x + 112, PREVIEW.y + 47, DARK.ink) +
          doc.text("mono", `v${plugin.version} · ${plugin.platforms.join(", ")}`, 14, PREVIEW.x + 113, PREVIEW.y + 74, DARK.muted) +
          actions
            .map(
              (label, index) =>
                `<circle cx="${PREVIEW.x + 34}" cy="${actionY(index) - 6}" r="3" fill="${DARK.amber}"/>` +
                doc.text("regular", doc.fit("regular", label, 17, PREVIEW.width - 76), 17, PREVIEW.x + 50, actionY(index), DARK.secondary),
            )
            .join("") +
          (more > 0 ? doc.text("regular", `${more} more actions`, 15, PREVIEW.x + 50, actionY(actions.length), DARK.muted) : "")
        );
      },
    ),
  );

  const legend = hints(
    doc,
    [
      ["enter", "open"],
      ["↑↓", "move"],
      ["tab", "scope"],
      ["esc", "close"],
    ],
    WINDOW.x + WINDOW.width,
    HINTS_Y,
  );
  parts.push(legend.markup);
  const press = states.filter((state) => state.press).map((state) => [state.time, state.time + PRESS]);
  parts.push(`<g opacity="0">${shown(press, total)}${keycap(doc, "↑↓", legend.keys.get("↑↓"), HINTS_Y, DARK.amber)}</g>`);
  parts.push(doc.text("mono", `qol-tray ${release} · ${pluginCount} plugins`, 15, WINDOW.x, HINTS_Y, DARK.muted));

  const found = QUERIES.map((query) => search(plugins, query)[0].name);
  const label = `The qol launcher searching its plugins as I type, finding ${found.slice(0, -1).join(", ")} and ${found.at(-1)}.`;
  return svg(WIDTH, HEIGHT, label, doc, parts.join(""), defs);
}
