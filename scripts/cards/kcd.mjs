import { baseline, box, lines } from "../svg.mjs";
import { round } from "../type.mjs";
import { INNER, PAD, SPACE, WIDTH, frame, panel } from "./section.mjs";

const INK = "#f1e6cf";
const SECONDARY = "#c9b896";
const GOLD = "#c9a45c";
const RED = "#d9734f";
const PAPER = "#efe4cc";
const LINE = { stroke: GOLD, strokeOpacity: 0.22 };
const TAGLINE = "An M4A1 in a game set in 1403, built to feel like it belongs there.";
const ITEMS = [
  ["rifle", "M4A1", "Firearm · 5.56", "An M4A1 carbine: gas operated, magazine fed, chambered for 5.56 millimetre ammunition and rifled to throw a small bullet fast and flat. No idea how I got this."],
  ["magazine", "5.56 Magazine", "Ammunition · 30 rounds", "Thirty round M4A1 magazines loaded with 5.56 millimetre cartridges. Far too well made for this century."],
];
const FACTS = [
  ["Its own ammo", "Fires only its 5.56; every other gun keeps its own."],
  ["30-round magazines", "The count is saved with the game and shown on the HUD."],
  ["Empty reload", "Starts by itself with the bolt catch; the spent mag falls and stays."],
  ["Partial reload", "On a key, without the catch, topping the mag back up to 30."],
];
const FORGE = "My own CLI for the mod. It builds and installs the pak, boots the game, tunes it live over rcon without a restart, and poses every animation in Forge Studio, a browser studio that drives Blender.";
const COMMANDS = [
  ["play", "boot the game on the installed pak"],
  ["game aim", "tune the aim live over rcon"],
  ["game reload", "time the reload sounds live"],
  ["studio", "pose a scene in Forge Studio"],
  ["pak", "what the pak changes"],
  ["trial", "every trial and its verdict"],
];

function figure(id, uri, x, y, width, height) {
  return {
    defs: `<clipPath id="${id}"><rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="6"/></clipPath>`,
    markup:
      `<image href="${uri}" x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>` +
      box(x - 1, y - 1, width + 2, height + 2, 7, "none", LINE),
  };
}

function heading(doc, text, top) {
  const end = PAD + doc.width("frauncesSemibold", text, 22) + 14;
  return (
    lines(doc, "frauncesSemibold", 22, 22, text, PAD, top, INK).markup +
    `<rect x="${round(end)}" y="${round(top + 10.5)}" width="${round(WIDTH - PAD - end)}" height="1" fill="url(#kcd-rule)"/>`
  );
}

function item(doc, uri, index, [, name, kind, text], x, y, width, height) {
  const body = x + 105;
  const glow = `kcd-item${index}`;
  return {
    defs: `<radialGradient id="${glow}" gradientUnits="userSpaceOnUse" cx="${round(x + 53)}" cy="${round(y + 45.4)}" r="59.36"><stop offset="0" stop-color="#5b4b37"/><stop offset="1" stop-color="#2c241a"/></radialGradient>`,
    markup:
      box(x, y, width, height, 6, PAPER, LINE) +
      box(x + 4, y + 4, width - 8, height - 8, 2, "none", { stroke: "#9a7230", strokeOpacity: 0.45 }) +
      box(x + 15, y + 15, 76, 76, 4, `url(#${glow})`) +
      `<image href="${uri}" x="${round(x + 21.08)}" y="${round(y + 21.08)}" width="63.84" height="63.84"/>` +
      lines(doc, "frauncesBold", 18, 19.8, name, body, y + 15, "#2a1f14").markup +
      lines(doc, "onestSemibold", 11, 11, kind.toUpperCase(), body, y + 39.8, "#9a7230", { tracking: 1 }).markup +
      lines(doc, "frauncesItalic", 12.5, 18.125, text, body, y + 58.8, "#5a4a36", { width: width - 120 }).markup,
  };
}

const itemHeight = (doc, width, text) => 30 + Math.max(76, 43.8 + doc.wrap("frauncesItalic", text, 12.5, width - 120).length * 18.125);

export function kcdCard(shots, doc) {
  const parts = [];
  const defs = [`<linearGradient id="kcd-rule"><stop offset="0" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient>`];
  const center = WIDTH / 2;
  parts.push(lines(doc, "onestSemibold", 12, 12, "a mod for kingdom come: deliverance ii".toUpperCase(), center - 1, PAD, RED, { anchor: "middle", tracking: 2 }).markup);
  parts.push(lines(doc, "frauncesTitle", 54, 54, "kcd2-m4a1", center, PAD + 22, INK, { anchor: "middle", tracking: -0.5 }).markup);
  parts.push(lines(doc, "frauncesItalic", 16, 22.4, TAGLINE, center, PAD + 86, SECONDARY, { anchor: "middle" }).markup);
  parts.push(box(PAD, PAD + 124.4, INNER, 1, 0, GOLD, { opacity: 0.22 }));

  const collage = PAD + 141.4;
  const wide = ((INNER - 8) * 1.55) / 2.55;
  const narrow = INNER - 8 - wide;
  for (const [id, uri, x, y, width, height] of [
    ["kcd-fire", shots.fire, PAD, collage, wide, 408],
    ["kcd-third", shots.third, PAD + wide + 8, collage, narrow, 200],
    ["kcd-first", shots.first, PAD + wide + 8, collage + 208, narrow, 200],
  ]) {
    const shot = figure(id, uri, x, y, width, height);
    defs.push(shot.defs);
    parts.push(shot.markup);
  }

  const items = collage + 408 + 34;
  parts.push(heading(doc, "In the game", items));
  const half = (INNER - 12) / 2;
  const cardHeight = Math.max(...ITEMS.map((entry) => itemHeight(doc, half, entry[3])));
  ITEMS.forEach((entry, index) => {
    const card = item(doc, shots[entry[0]], index, entry, PAD + index * (half + 12), items + 38, half, cardHeight);
    defs.push(card.defs);
    parts.push(card.markup);
  });

  const facts = items + 38 + cardHeight + 14;
  const quarter = (INNER - 42) / 4;
  let factsHeight = 0;
  FACTS.forEach(([head, text], index) => {
    const x = PAD + index * (quarter + 14);
    const detail = lines(doc, "onest", 12.5, 18.125, text, x, facts + 33.8, SECONDARY, { width: quarter });
    factsHeight = Math.max(factsHeight, 33.8 + detail.height);
    parts.push(box(x, facts, quarter, 2, 0, RED) + lines(doc, "frauncesBold", 14, 16.8, head, x, facts + 12, INK).markup + detail.markup);
  });

  const forge = facts + factsHeight + 34;
  parts.push(heading(doc, "Built with kcd2-forge", forge));
  const studioWidth = ((INNER - 20) * 1.25) / 2.25;
  const studioShot = figure("kcd-studio", shots.studio, PAD, forge + 38, studioWidth, (studioWidth * 396) / 812);
  defs.push(studioShot.defs);
  parts.push(studioShot.markup);
  const text = PAD + studioWidth + 20;
  const textWidth = INNER - studioWidth - 20;
  const about = lines(doc, "onest", 13.5, 20.925, FORGE, text, forge + 38, SECONDARY, { width: textWidth });
  parts.push(about.markup);
  let row = forge + 38 + about.height + 12;
  for (const [command, meaning] of COMMANDS) {
    const line = Math.max(baseline(doc, "onest", 12, 15.6, 0), baseline(doc, "monoMedium", 12, 12, 0));
    parts.push(
      box(text, row, textWidth, 1, 0, GOLD, { opacity: 0.22 }) +
        doc.text("monoMedium", command, 12, text, row + 6 + line, RED) +
        doc.text("onest", meaning, 12, text + 96, row + 6 + line, SECONDARY),
    );
    row += 26.6;
  }

  const height = Math.ceil(Math.max(forge + 38 + (studioWidth * 396) / 812, row) + PAD);
  const wash = frame("kcd-wash", height, "#2a2016", "#17120d");
  return panel(height, `kcd2-m4a1, a mod for Kingdom Come: Deliverance II. ${TAGLINE}`, doc, wash.body + parts.join(""), wash.defs + defs.join(""), SPACE);
}
