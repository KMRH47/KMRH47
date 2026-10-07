import { DurableObject } from "cloudflare:workers";
import { statusTiles } from "../scripts/cards/status.mjs";
import { pluginSection } from "../scripts/qol.mjs";
import { buildQueue, buildStatus } from "../scripts/status.mjs";
import { FONT_FILES, typeFromFonts } from "../scripts/type.mjs";

const FONTS = "https://raw.githubusercontent.com/qol-tools/qol/main/libs/gpui/assets/fonts/";
const INDEX = "https://qol-tools.github.io/qol/plugins/index.json";
const FRESH_FOR = 15 * 1000;
const IDLE_EVERY = 60 * 1000;
const WATCHED_FOR = 5 * 60 * 1000;
const WAIT_FOR_FRESH = 3000;
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
  const [stages, queue] = await Promise.all([plugins().then((list) => buildStatus(token, { plugins: list })), buildQueue(token)]);
  return statusTiles(stages, queue, () => type.document());
}

export class Status extends DurableObject {
  snapshot = null;
  viewed = 0;
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
    this.viewed = Date.now();
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + FRESH_FOR);
    this.snapshot ??= await this.ctx.storage.get("snapshot");
    if (!this.snapshot) return (await this.refresh()).tiles[name];
    if (Date.now() - this.snapshot.at <= 2 * FRESH_FOR) return this.snapshot.tiles[name];
    const stale = this.snapshot;
    const fresh = this.refresh().catch(() => stale);
    const waited = new Promise((resolve) => setTimeout(() => resolve(stale), WAIT_FOR_FRESH));
    return (await Promise.race([fresh, waited])).tiles[name];
  }

  async alarm() {
    await this.refresh().catch((error) => console.error(error));
    const watched = Date.now() - this.viewed < WATCHED_FOR;
    await this.ctx.storage.setAlarm(Date.now() + (watched ? FRESH_FOR : IDLE_EVERY));
  }
}

export default {
  async fetch(request, env) {
    const name = new URL(request.url).pathname.match(TILE)?.[0]?.slice(1);
    if (!name) return new Response("not found", { status: 404 });
    const tile = await env.STATUS.get(env.STATUS.idFromName("qol")).tile(name);
    if (!tile) return new Response("not found", { status: 404 });
    return new Response(tile, {
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store, max-age=0" },
    });
  },
};
