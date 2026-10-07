import { statusTiles } from "../scripts/cards/status.mjs";
import { pluginSection } from "../scripts/qol.mjs";
import { buildQueue, buildStatus } from "../scripts/status.mjs";
import { FONT_FILES, typeFromFonts } from "../scripts/type.mjs";

const FONTS = "https://raw.githubusercontent.com/qol-tools/qol/main/libs/gpui/assets/fonts/";
const INDEX = "https://qol-tools.github.io/qol/plugins/index.json";
const FRESH_FOR = 15;
const SERVE_STALE_FOR = 86400;
const TILE = /^\/status-([a-z-]+)\.svg$/;

let type;
let snapshot = { at: 0, tiles: null };
let rendering = null;

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
  const stages = await buildStatus(token, { plugins: await plugins() });
  return statusTiles(stages, await buildQueue(token), () => type.document());
}

const KEY = new Request("https://qol-status.internal/snapshot");
const age = () => (Date.now() - snapshot.at) / 1000;

function refresh(env) {
  rendering ??= render(env.GITHUB_TOKEN)
    .then(async (tiles) => {
      snapshot = { at: Date.now(), tiles };
      await caches.default.put(KEY, new Response(JSON.stringify(tiles), {
        headers: { "content-type": "application/json", "cache-control": `max-age=${SERVE_STALE_FOR}`, "x-rendered-at": String(snapshot.at) },
      }));
      return tiles;
    })
    .finally(() => {
      rendering = null;
    });
  return rendering;
}

async function tiles(env, ctx) {
  if (!snapshot.tiles) {
    const cached = await caches.default.match(KEY);
    if (cached) snapshot = { at: Number(cached.headers.get("x-rendered-at")), tiles: await cached.json() };
  }
  if (!snapshot.tiles || age() > SERVE_STALE_FOR) return refresh(env);
  if (age() > FRESH_FOR) ctx.waitUntil(refresh(env));
  return snapshot.tiles;
}

export default {
  async fetch(request, env, ctx) {
    const name = new URL(request.url).pathname.match(TILE)?.[0]?.slice(1);
    if (!name) return new Response("not found", { status: 404 });
    const rendered = await tiles(env, ctx);
    if (!rendered[name]) return new Response("not found", { status: 404 });
    return new Response(rendered[name], {
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-cache, max-age=0" },
    });
  },
};
