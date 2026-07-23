const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "style-hd-composition.css"), "utf8");

test("relic inventory renders 2x4 by default and 2x5 after slot expansion", () => {
  assert.match(game, /const MAX_RELICS = 8;/);
  assert.match(game, /const MYTHIC_RELIC_SLOT_BONUS = 2;/);
  assert.match(game, /Array\.from\(\{ length: relicSlotCap \}/);
  assert.match(game, /relicSlotCap > MAX_RELICS \? 5 : 4/);
  assert.match(game, /relic-slot-grid relic-slot-grid-\$\{relicGridColumns\}/);
  assert.match(css, /\.relic-slot-grid\s*\{[\s\S]*grid-template-columns: repeat\(4,/);
  assert.match(css, /\.relic-slot-grid-5\s*\{[\s\S]*grid-template-columns: repeat\(5,/);
  assert.match(css, /\.relic-slot\.rarity-mythic\s*\{[^}]*border-color:\s*#66e4f2;[^}]*box-shadow:/);
});

test("HD player sheet exposes stable visual hierarchy hooks", () => {
  assert.match(game, /const statClass = `statline statline-\$\{statKey\}`/);
  assert.match(css, /\.hud-section-player \.statline-player,/);
  assert.match(css, /\.hud-section-player \.statline-hp strong \{ color: #e16a5f; \}/);
  assert.match(css, /\.hud-section-player \.statline-atk,/);
  assert.match(css, /\.hud-section-dungeon \.statline-map-fragments/);
});

test("HD HUD tooltips use the whole field and a styled floating surface", () => {
  assert.match(game, /data-ui-tooltip-title="\$\{escapeHtmlAttr\(label\)\}" data-ui-tooltip="\$\{escapeHtmlAttr\(tooltip\)\}"/);
  assert.match(game, /surface\.addEventListener\("pointerover"/);
  assert.match(game, /surface\.addEventListener\("focusin"/);
  assert.match(game, /function showHdUiTooltip\(anchor\)/);
  assert.match(css, /\.statline\[data-ui-tooltip\]/);
  assert.match(css, /\.hd-ui-tooltip\s*\{[\s\S]*width: min\(330px,/);
  assert.match(css, /\.statline-crit strong\s*\{[\s\S]*text-align: center;/);
});

test("HD vertical HP, Shield and Barrier meters expose mechanic tooltips", () => {
  assert.match(game, /syncVitalTooltip\(\s*hpRailTrackEl,\s*"Health \(HP\)"/);
  assert.match(game, /syncVitalTooltip\(\s*shieldRailTrackEl,\s*"Skill Shield \(SH\)"/);
  assert.match(game, /syncVitalTooltip\(\s*barrierRailTrackEl,\s*"Barrier \(BR\)"/);
  assert.match(game, /\[hpRailEl, protectionRailEl\]\.forEach\(bindHdUiTooltipSurface\)/);
  assert.match(game, /track\.setAttribute\("tabindex", runVisible \? "0" : "-1"\)/);
  assert.match(css, /\.room-vital-track\[data-ui-tooltip\]:focus-visible/);
});

test("HD Fury, Elixir and Potion icons expose dynamic mechanic tooltips", () => {
  assert.match(game, /const furyTooltip = `Current: \$\{furyNow\}\/\$\{furyMax\}/);
  assert.match(game, /loadoutElixir\.statLabel[\s\S]*Press G during combat/);
  assert.match(game, /const potionHealMin = potionHealForBase/);
  assert.match(game, /Press F to restore \$\{potionHealMin\}-\$\{potionHealMax\} HP/);
  assert.match(game, /\[leftResourceRailEl, potionResourceRailEl\]\.forEach\(bindHdUiTooltipSurface\)/);
  assert.match(css, /\.room-resource-icon\[data-ui-tooltip\]:focus-visible/);
});
