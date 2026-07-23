const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const compositionCss = fs.readFileSync(path.join(root, "style-hd-composition.css"), "utf8");

test("fresh HD main menu hides gameplay chrome without changing the in-run pause menu", () => {
  assert.match(
    game,
    /function syncMainMenuOnlyMode\(\)[\s\S]*state\.phase === "menu" && !isRunPauseMenuActive\(\)[\s\S]*classList\.toggle\("main-menu-only"/
  );
  assert.match(game, /syncMainMenuOnlyMode\(\);\s*buildHud\(\);/);
  assert.match(compositionCss, /body\.graphics-hd-ui\.main-menu-only \.panel/);
  assert.match(compositionCss, /body\.graphics-hd-ui\.main-menu-only #game/);
  assert.match(compositionCss, /body\.graphics-hd-ui\.main-menu-only \.screen-overlay/);
  assert.match(compositionCss, /body\.graphics-hd-ui\.main-menu-only \.layout-track/);
});

test("boot reveal waits for the initial graphics mode to settle", () => {
  assert.match(game, /let initialGraphicsReady = Promise\.resolve\(\)/);
  assert.match(
    game,
    /function initializeGraphicsMode\(\)[\s\S]*initialGraphicsReady = Promise\.resolve\(initialization\)\.catch/
  );
  assert.match(
    game,
    /function dismissBootScreen\(\)[\s\S]*Promise\.resolve\(initialGraphicsReady\)[\s\S]*gameAppEl\.classList\.remove\("app-hidden"\)/
  );
});
