const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
const compositionCss = fs.readFileSync(path.join(ROOT, "style-hd-composition.css"), "utf8");

test("HD Escape menu preserves and resumes the in-memory run", () => {
  assert.match(game, /getRuntimeGraphicsMode\(\) === "hd"/);
  assert.match(game, /enterMenu\(\{ preserveRunContext: state\.phase === "playing" \}\)/);
  assert.match(game, /function resumeRunFromPauseMenu\(\)[\s\S]*state\.phase = "playing";/);
  assert.match(game, /if \(key === "escape" && isRunPauseMenuActive\(\)\)[\s\S]*resumeRunFromPauseMenu\(\)/);
  assert.match(game, /if \(resumeRunFromPauseMenu\(\)\) return;[\s\S]*tryLoadRunSnapshot\(\)/);
});

test("HD pause keeps run HUD surfaces active behind the overlay", () => {
  assert.match(game, /buildHud\(\)[\s\S]*state\.phase === "menu" && !isRunPauseMenuActive\(\)/);
  assert.match(game, /const inRun = state\.phase === "playing" \|\| isRunPauseMenuActive\(\)/);
  assert.match(game, /const runVisible =[^;]*isRunPauseMenuActive\(\)/);
  assert.match(game, /overlay-card-pause-menu/);
  assert.match(compositionCss, /body\.graphics-hd-ui:has\(#game\.graphics-hd\) \.screen-overlay\.visible:has\(\.overlay-card-pause-menu\)/);
  assert.match(compositionCss, /body\.graphics-hd-ui:has\(#game\.graphics-hd\) \.board:has\(\.screen-overlay\.visible \.overlay-card-pause-menu \.overlay-menu\) > \.depth-badge/);
  assert.match(compositionCss, /\.board > \.depth-badge \{ grid-row: 2; \}/);
  assert.match(compositionCss, /\.board > \.room-stage \{ grid-row: 3; \}/);
  assert.match(compositionCss, /\.board > \.skills-bar \{ grid-row: 4; \}/);
});
