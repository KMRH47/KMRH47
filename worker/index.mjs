import { DurableObject } from "cloudflare:workers";
import { statusTiles } from "../scripts/cards/status.mjs";
import { pluginSection } from "../scripts/qol.mjs";
import { buildBoard } from "../scripts/status.mjs";
import { FONT_FILES, typeFromFonts } from "../scripts/type.mjs";

const FONTS = "https://raw.githubusercontent.com/qol-tools/qol/main/libs/gpui/assets/fonts/";
const INDEX = "https://qol-tools.github.io/qol/plugins/index.json";
const REFRESH_EVERY = 15 * 1000;
const TILE = /^\/status-([a-z-]+)\.svg$/;

let type;

async function loadType() {
  const buffers = {};
  for (const [face, file] of Object.entries(FONT_FILES)) {
    const response = await fetch(FONTS + file, { cf: { cacheTtl: 86400, cacheEverything: true } });
    if (!response.ok) throw new Error(`${file} answered ${response.status}`);
    buffers[face] = await response.arrayBuffer();
  }
  return typeFromFonts(buffers);
}

async function plugins() {
  const response = await fetch(INDEX);
  if (!response.ok) throw new Error(`${INDEX} answered ${response.status}`);
  const index = await response.json();
  return Object.values(index.plugins)
    .map((plugin) => pluginSection(plugin.versions[plugin.latest].plugin_toml))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function render(token) {
  type ??= await loadType();
  return statusTiles(await buildBoard(token, { plugins: await plugins() }), () => type.document());
}

export class Status extends DurableObject {
  snapshot = null;
  rendering = null;

  refresh() {
    this.rendering ??= render(this.env.GITHUB_TOKEN)
      .then(async (tiles) => {
        this.snapshot = { at: Date.now(), tiles };
        await this.ctx.storage.put("snapshot", this.snapshot);
        return this.snapshot;
      })
      .finally(() => {
        this.rendering = null;
      });
    return this.rendering;
  }

  async tile(name) {
    this.snapshot ??= await this.ctx.storage.get("snapshot");
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + REFRESH_EVERY);
    return (this.snapshot ?? (await this.refresh())).tiles[name];
  }

  async alarm() {
    await this.refresh().catch((error) => console.error(error));
    await this.ctx.storage.setAlarm(Date.now() + REFRESH_EVERY);
  }
}

export default {
  async fetch(request, env) {
    const name = new URL(request.url).pathname.match(TILE)?.[0]?.slice(1);
    if (!name) return new Response("not found", { status: 404 });
    const tile = await env.STATUS.get(env.STATUS.idFromName("qol")).tile(name);
    if (!tile) return new Response("not found", { status: 404 });
    return new Response(tile, {
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=15" },
    });
  },
};
