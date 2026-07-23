const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const game = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
const hdCss = fs.readFileSync(path.join(__dirname, "..", "style-hd-composition.css"), "utf8");

function readDepthList(constantName) {
  const match = game.match(new RegExp(`const ${constantName} = Object\\.freeze\\(\\[([^\\]]+)\\]\\)`));
  assert.ok(match, `Missing ${constantName}`);
  return match[1].split(",").map((value) => Number(value.trim()));
}

const checkpoints = readDepthList("START_DEPTH_CHECKPOINTS");
const bossUnlocks = readDepthList("START_DEPTH_UNLOCK_BOSS_DEPTHS");

assert.deepEqual(checkpoints, [11, 21, 31, 41, 51, 61, 71, 81, 91]);
assert.deepEqual(bossUnlocks, [10, 20, 30, 40, 50, 60, 70, 80, 90]);
assert.equal(checkpoints.length, bossUnlocks.length);
assert.deepEqual(checkpoints, bossUnlocks.map((depth) => depth + 1));
assert.match(game, /const unlockIndex = START_DEPTH_UNLOCK_BOSS_DEPTHS\.indexOf\(bossDepth\);[\s\S]*const startDepth = START_DEPTH_CHECKPOINTS\[unlockIndex\];/);
assert.match(game, /const hotkey = index === 9 \? "0" : String\(index \+ 1\);/);
assert.match(game, /if \(\(key >= "1" && key <= "9"\) \|\| key === "0"\)/);
assert.match(game, /const index = key === "0" \? 9 : Number\(key\) - 1;/);
assert.match(css, /\.overlay-card\.overlay-card-camp-start \.overlay-menu \{[\s\S]*grid-template-columns: repeat\(2,/);
assert.match(css, /body:has\(#game\.graphics-hd\) \.overlay-card\.overlay-card-camp-start \{[\s\S]*width: min\(760px, 100%\)/);

const hdPromptStart = game.indexOf('if (useHdStartDepthUi) {', game.indexOf('state.campStartDepthPromptOpen'));
const hdRowsStart = game.indexOf('      const rows = options.map((depth, index) => {', hdPromptStart + 40);
const classicPromptStart = game.indexOf('      const rows = options.map((depth, index) => {', hdRowsStart + 40);
assert.ok(hdPromptStart >= 0 && hdRowsStart > hdPromptStart && classicPromptStart > hdRowsStart, "Missing explicit HD start-depth renderer branch");
const hdPrompt = game.slice(hdPromptStart, classicPromptStart);
assert.match(hdPrompt, /camp-start-sanctum/);
assert.match(hdPrompt, /data-start-depth-index/);
assert.match(hdPrompt, /Arrows choose[\s\S]*Enter confirms[\s\S]*Esc returns/);
assert.doesNotMatch(hdPrompt, /overlay-menu-key|quick select/);
assert.match(game, /useHdStartDepthUi &&[\s\S]*key === "arrowleft"[\s\S]*key === "arrowright"/);
assert.match(game, /!useHdStartDepthUi && \(\(key >= "1" && key <= "9"\) \|\| key === "0"\)/);
assert.match(hdCss, /HD expedition staging: refreshed start-depth selection/);
assert.match(hdCss, /\.camp-start-route-grid \{[\s\S]*grid-template-columns: repeat\(2,/);
assert.match(hdCss, /\.camp-start-choice\.selected \{/);
console.log("Start-depth checkpoint tests passed");
