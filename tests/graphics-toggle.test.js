const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
test("HD-only graphics contract removes preference surface", () => {
  assert.doesNotMatch(index, /render\/graphics-preference\.js/u);
  assert.match(game, /function isHdGraphics\(\)\s*\{\s*return true;\s*\}/u);
  assert.doesNotMatch(game, /DungeonGraphicsPreference|graphicsPreferenceApi|graphicsPreference\b/u);
  assert.doesNotMatch(game, /DUNGEON_HD_GRAPHICS_ENABLED|dungeonOneRoomGraphicsMode|readPreference\(|writePreference\(/u);
  assert.doesNotMatch(
    game,
    /function (?:getGraphicsOptionsItems|getGraphicsMenuDescription|openGraphicsOptions|setGraphicsPreference|applyGraphicsPreference)\s*\(|menuOptionsView\s*===\s*"graphics"|graphicsView/u
  );

  const rootItems = game.match(/function getMenuOptionsRootItems\(\)\s*\{([\s\S]*?)\n\s*\}/u);
  assert.ok(rootItems, "Options root items must remain discoverable");
  assert.doesNotMatch(rootItems[1], /id:\s*"graphics"|title:\s*"Graphics"/u);
});
