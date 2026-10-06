import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

function markBodies(source) {
  const names = new Map(
    [...source.matchAll(/Self::(\w+) => "([a-z-]+)"/g)].map(([, variant, name]) => [variant, name]),
  );
  return new Map(
    [...source.matchAll(/Self::(\w+) => \{?\s*r#"([\s\S]*?)"#/g)].map(([, variant, body]) => [
      names.get(variant),
      body,
    ]),
  );
}

function tables(toml) {
  return toml.split(/^(?=\[)/m).map((block) => ({
    header: block.match(/^\[([^\]]+)\]/)?.[1] ?? "",
    field(key) {
      const match = block.match(new RegExp(`^${key}\\s*=\\s*(".*"|\\[.*\\])\\s*$`, "m"));
      return match ? JSON.parse(match[1]) : null;
    },
  }));
}

function pluginSection(toml) {
  const blocks = tables(toml);
  const plugin = blocks.find((block) => block.header === "plugin");
  const actions = blocks
    .filter((block) => block.header.startsWith("action."))
    .map((block) => block.field("label"))
    .filter((label) => label && !label.startsWith("Settings"));
  return {
    id: plugin?.field("id"),
    name: plugin?.field("name"),
    icon: plugin?.field("icon"),
    description: plugin?.field("description"),
    version: plugin?.field("version"),
    platforms: plugin?.field("platforms"),
    actions,
  };
}

export async function readQol(root) {
  const marks = markBodies(await readFile(path.join(root, "libs/theme/src/marks.rs"), "utf8"));
  const entries = await readdir(path.join(root, "plugins"), { withFileTypes: true });
  const plugins = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "template") continue;
    const file = path.join(root, "plugins", entry.name, "plugin.toml");
    const plugin = pluginSection(await readFile(file, "utf8"));
    if (!plugin.id || !plugin.name || !plugin.description || !plugin.version || !plugin.platforms || !marks.has(plugin.icon)) {
      throw new Error(`${file}: missing id, name, description, version, platforms or a known icon`);
    }
    plugins.push({ ...plugin, mark: marks.get(plugin.icon) });
  }
  plugins.sort((a, b) => a.name.localeCompare(b.name));
  if (!marks.has("qol")) throw new Error("marks.rs has no qol mark");
  return { plugins, marks, fonts: path.join(root, "libs/gpui/assets/fonts") };
}
