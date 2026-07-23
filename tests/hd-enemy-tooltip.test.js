const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const css = fs.readFileSync(path.join(root, "style-hd-composition.css"), "utf8");

assert.match(game, /hdEnemyTooltipEl\.className = "hd-enemy-tooltip"/);
assert.match(game, /function buildHdEnemyTooltip\(enemy\)/);
assert.match(game, /function getEnemyAbilityDescriptions\(enemy\)/);
assert.match(game, /Aimed Shot[\s\S]*Mending Chant[\s\S]*Serrated Bite[\s\S]*Skill Hex[\s\S]*Heavy Slam[\s\S]*Hazard Slam[\s\S]*Anvil Slam[\s\S]*Gravity Burst/);
assert.match(game, /hd-enemy-tooltip-abilities[\s\S]*<h4>Abilities<\/h4>/);
assert.match(game, /Empowered:[\s\S]*Void Aegis:[\s\S]*Disoriented[\s\S]*Frozen[\s\S]*Burning/);
assert.match(game, /statusSection\("Intent"[\s\S]*statusSection\("Buffs"[\s\S]*statusSection\("Debuffs"/);
assert.match(game, /canvas\.dataset\.graphicsMode !== "hd" && hoveredEnemy/);
assert.match(game, /if \(canvas\.dataset\.graphicsMode === "hd"\)[\s\S]*showHdEnemyTooltip/);
assert.match(css, /\.hd-enemy-tooltip\s*\{[\s\S]*position:\s*fixed[\s\S]*pointer-events:\s*none/);
assert.match(css, /\.hd-enemy-tooltip-health[\s\S]*\.hd-enemy-tooltip-status\.tone-debuff/);
assert.match(css, /\.hd-enemy-tooltip-abilities\s*\{[\s\S]*border-left:\s*2px solid #7b668f/);
assert.match(css, /\.skills-bar\s*\{[\s\S]*width:\s*100%[\s\S]*grid-template-columns:\s*minmax\(0, 0\.9fr\) minmax\(0, 1\.2fr\) minmax\(0, 0\.9fr\)[\s\S]*margin-inline:\s*0/);

console.log("HD enemy tooltip and skill footprint tests passed");
