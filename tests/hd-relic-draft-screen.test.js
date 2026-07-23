const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const css = fs.readFileSync(path.join(root, "style-hd-composition.css"), "utf8");
const forgeCss = fs.readFileSync(path.join(root, "style-hd-forge.css"), "utf8");

assert.match(game, /function buildRelicDraftOverlayContent\(\)/);
assert.match(game, /relic-draft-grid-standard/);
assert.match(game, /const forgeRewardKind = state\.roomType === "forge" && state\.phase === "relic"/);
assert.match(game, /relic-draft-grid-forge-temper/);
assert.match(game, /relic-draft-grid-forge-transmute/);
assert.match(game, /forge-reward-panel forge-reward-panel-/);
assert.match(game, /suppressTooltip: Boolean\(forgeRewardKind\)/);
assert.match(game, /relic-draft-grid-dense/);
assert.match(game, /relic-draft-grid-duel/);
assert.match(game, /data-relic-key="\$\{escapeHtmlAttr\(key\)\}"/);
assert.match(game, /class="relic-draft-icon"/);
assert.match(game, /state\.phase === "relic"\) \{\s*menuBlock = buildRelicDraftOverlayContent\(\)/);
assert.match(game, /overlay-card overlay-card-relic-draft/);
assert.match(game, /if \(state\.phase === "relic"\) \{\s*mutatorsEl\.innerHTML = ""/);
assert.match(game, /const activateRelicChoice = \(choice\) =>/);
assert.match(game, /choice\.dataset\.relicKey/);

assert.match(css, /\.overlay-card-relic-draft\s*\{[\s\S]*max-height:\s*min\(540px,/);
assert.match(css, /\.overlay-card-relic-draft\s*\{[\s\S]*menu-frame\.png/);
assert.match(css, /\.relic-draft-grid-standard\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,/);
assert.match(css, /\.relic-draft-grid-forge-temper\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 220px\);[\s\S]*justify-content:\s*center/);
assert.match(css, /\.relic-draft-icon\s*\{[\s\S]*opacity:\s*0\.24/);
assert.match(css, /\.relic-draft-choice\s*\{[\s\S]*--relic-border[\s\S]*cursor:\s*pointer/);
assert.match(css, /\.relic-draft-skip[\s\S]*cursor:\s*pointer/);
assert.match(forgeCss, /\.forge-reward-sanctuary\s*\{[\s\S]*grid-template-areas:/);
assert.match(forgeCss, /\.relic-draft-grid-forge-transmute\s*\{[\s\S]*repeat\(3,/);
assert.match(forgeCss, /\.forge-reward-panel \.forge-reward-choice\.hd-nav-selected/);
assert.match(forgeCss, /\.forge-reward-panel \.relic-draft-skip\.hd-nav-selected/);

console.log("HD relic draft screen contract tests passed");
