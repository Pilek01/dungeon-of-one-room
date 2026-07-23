const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "style-hd-composition.css"), "utf8");
const baseCss = fs.readFileSync(path.join(root, "style.css"), "utf8");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");

assert.match(css, /\.skills-bar\s*\{[\s\S]*gap:\s*clamp\(8px, 0\.85vw, 14px\)/);
assert.match(css, /\.skills-bar\s*\{[\s\S]*width:\s*100%[\s\S]*max-width:\s*100%[\s\S]*grid-template-columns:\s*minmax\(0, 0\.9fr\) minmax\(0, 1\.2fr\) minmax\(0, 0\.9fr\)/);
assert.match(css, /grid-template-rows:[^;]*clamp\(124px, 15\.7vh, 148px\)/);
assert.match(css, /\.skill-card\.tier-rare\.ready[\s\S]*saturate\(1\.08\)/);
assert.match(css, /\.skill-card\.tier-epic\.ready[\s\S]*saturate\(1\.12\)/);
assert.match(css, /\.skill-card\.tier-legendary\.ready[\s\S]*saturate\(1\.14\)/);
assert.match(css, /\.skill-card\.tier-(?:rare|epic|legendary)\.armed/);
assert.match(baseCss, /skill-rare-frame\.png/);
assert.match(baseCss, /skill-epic-frame\.png/);
assert.match(baseCss, /skill-legendary-frame\.png/);
assert.match(game, /tier >= 3 \? "tier-legendary" : tier >= 2 \? "tier-epic" : tier >= 1 \? "tier-rare" : "tier-base"/);
assert.match(game, /data-ui-tooltip-title=.*skill\.name.*tierLabel/);
assert.match(game, /const useHdSkillCards = getRuntimeGraphicsMode\(\) === "hd"/);
assert.match(game, /if \(!useHdSkillCards\)[\s\S]*skill-icon[\s\S]*skill\.name.*<small>\[\$\{tierLabel\}\]<\/small>/);
assert.match(game, /\[hudEl, activeEffectsEl, mutatorsEl, skillsBarEl\]\.forEach\(bindHdUiTooltipSurface\)/);
assert.match(css, /\.skill-card\[data-ui-tooltip\]:focus-visible/);
assert.match(css, /\.hd-ui-tooltip-body[\s\S]*white-space:\s*pre-line/);
assert.match(css, /\.skill-desc\s*\{\s*display:\s*none/);
assert.match(css, /\.skill-card\.armed \.skill-desc\s*\{[\s\S]*display:\s*-webkit-box/);
assert.match(css, /\.skill-card\.tier-epic,[\s\S]*\.skill-card\.tier-legendary[\s\S]*clip-path:\s*polygon\([\s\S]*40% 9%, 45% 0, 55% 0[\s\S]*55% 100%, 45% 100%, 40% 91%/);
assert.match(game, /state\.skillTiers = \{ dash: 1, aoe: 2, shield: LEGENDARY_SKILL_TIER \}/);

console.log("HD skill card contract tests passed");
