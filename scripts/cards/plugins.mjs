import { QOL, baseline, box, lines, mark } from "../svg.mjs";
import { INNER, PAD, SPACE, card, frame, header, panel, title } from "./section.mjs";

const GROUPS = [
  ["desktop", "find, switch and capture", ["launcher", "alt-tab", "window-actions", "explorer", "clipboard", "shot"]],
  ["input", "every key, click and voice", ["keyremap", "input", "controllers", "pointz", "voice"]],
  ["hardware", "screens, sound and devices", ["monitor", "sound", "lights", "bluetooth"]],
  ["system", "updates, apps, lock and look", ["update-manager", "removeapp", "session", "os-themes"]],
  ["ai and dev", "for long coding sessions", ["cli-sessions", "memory"]],
];
const WORDING = { "qol-clipboard": "Keep a history of everything you copy and search it from the launcher" };
const OS = { linux: "linux", macos: "mac", windows: "win" };
const TAGLINE = "A portable quality-of-life layer for any computer you sit down at.";
const GAP = 12;
const ICON = 34;
const TEXT = ICON + 12;

const key = (plugin) => plugin.id.replace(/^qol-/, "");

function groups(plugins) {
  const byKey = new Map(plugins.map((plugin) => [key(plugin), plugin]));
  const grouped = new Set(GROUPS.flatMap(([, , keys]) => keys));
  return [
    ...GROUPS.map(([head, sub, keys]) => ({ head, sub, plugins: keys.filter((name) => byKey.has(name)).map((name) => byKey.get(name)) })),
    { head: "more", sub: "new in qol", plugins: plugins.filter((plugin) => !grouped.has(key(plugin))) },
  ].filter((group) => group.plugins.length);
}

function tile(doc, plugin, x, y, width) {
  const words = (WORDING[plugin.id] ?? plugin.description).replace(/\.$/, "");
  const description = lines(doc, "onest", 12.5, 17.5, words, x + TEXT, y + 19.8, QOL.secondary, { width: width - TEXT });
  const nameBaseline = baseline(doc, "onestSemibold", 14, 16.8, y);
  const platforms = plugin.platforms.length === 3 ? "" : plugin.platforms.map((name) => OS[name]).join(" · ");
  const markup =
    box(x, y, ICON, ICON, 9, QOL.accentText, { opacity: 0.14 }) +
    mark(plugin.mark, x + 7, y + 7, 20, QOL.accentText, 3.2) +
    doc.text("onestSemibold", plugin.name, 14, x + TEXT, nameBaseline, QOL.ink) +
    (platforms ? doc.text("mono", platforms, 10.5, x + TEXT + doc.width("onestSemibold", plugin.name, 14) + 8, nameBaseline, QOL.muted) : "") +
    description.markup;
  return { markup, height: Math.max(ICON, 19.8 + description.height) };
}

function tiles(doc, plugins, x, y, width, columns) {
  const column = (width - 24 * (columns - 1)) / columns;
  let top = y;
  let markup = "";
  for (let start = 0; start < plugins.length; start += columns) {
    const row = plugins.slice(start, start + columns).map((plugin, index) => tile(doc, plugin, x + index * (column + 24), top, column));
    markup += row.map((entry) => entry.markup).join("");
    top += Math.max(...row.map((entry) => entry.height)) + GAP;
  }
  return { markup, height: top - GAP - y };
}

export function pluginsCard(plugins, doc, { heading = true } = {}) {
  const head = heading ? title(doc, "qol", TAGLINE) : { markup: "", bottom: PAD };
  const half = (INNER - GAP) / 2;
  const cards = groups(plugins).map((group, index, all) => {
    const wide = index === all.length - 1 && all.length % 2 === 1;
    const width = wide ? INNER : half;
    return { ...group, width, columns: wide ? 2 : 1, body: tiles(doc, group.plugins, 0, 0, width - 38, wide ? 2 : 1).height };
  });
  let top = head.bottom;
  let markup = "";
  for (let index = 0; index < cards.length; index += cards[index].width === INNER ? 1 : 2) {
    const row = cards[index].width === INNER ? [cards[index]] : cards.slice(index, index + 2);
    const height = header(32) + Math.max(...row.map((entry) => entry.body)) + 19;
    row.forEach((entry, column) => {
      const x = PAD + column * (half + GAP);
      markup += card(doc, x, top, entry.width, height, entry.head, entry.sub, 32, 32).markup;
      markup += tiles(doc, entry.plugins, x + 19, top + header(32), entry.width - 38, entry.columns).markup;
    });
    top += height + GAP;
  }
  const height = Math.ceil(top - GAP + PAD);
  const wash = frame("qol-wash", height, "#1c1d24", "#111214");
  const label = `${heading ? `qol: ${TAGLINE} ` : ""}Plugins: ${plugins.map((plugin) => plugin.name).join(", ")}`;
  return panel(height, label, doc, wash.body + head.markup + markup, wash.defs, heading ? SPACE : 0);
}
