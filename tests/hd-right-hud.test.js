const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const css = fs.readFileSync(path.join(root, "style-hd-composition.css"), "utf8");

assert.match(game, /\[hudEl, activeEffectsEl, mutatorsEl, skillsBarEl\]\.forEach\(bindHdUiTooltipSurface\)/);
assert.match(game, /class="mut-row mut-on" data-ui-tooltip-title=/);
assert.match(game, /valueTextLength > 28[\s\S]*stat-value-xlong/);
assert.match(game, /class="stat-value\$\{valueDensity\}"/);
assert.match(css, /\.panel-right > \.actions[\s\S]*panel-texture\.png/);
assert.match(css, /\.panel-right > \.panel-title\s*\{[\s\S]*width:\s*calc\(100% - 24px\)[\s\S]*margin:\s*-5px auto 4px/);
assert.match(css, /grid-template-rows:\s*58px auto auto auto minmax\(150px, 1fr\)/);
assert.match(css, /\.active-effects \.statline[\s\S]*min-height:\s*36px/);
assert.match(css, /\.active-effects[\s\S]*overflow-y:\s*auto/);
assert.match(css, /\.active-effects\s*\{[\s\S]*max-height:\s*min\(310px, 33vh\)/);
assert.match(css, /\.active-effects \.stat-value-long[\s\S]*font-size:\s*clamp/);
assert.match(css, /\.mutators \.mut-row[\s\S]*grid-template-columns:\s*30px/);
assert.match(css, /\.log > div[\s\S]*border-bottom:/);
assert.match(css, /\.mut-row\[data-ui-tooltip\]:focus-visible/);

console.log("HD right HUD contract tests passed");
