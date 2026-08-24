const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const runtime = fs.readFileSync(path.join(root, "online-v3", "ranked-v3-runtime.js"), "utf8");

assert.match(runtime, /function onOtterChestOpen\(\)/);
assert.match(runtime, /sourceId: "otter-crimson-chest"/);
assert.match(runtime, /rewardSlotId: slot\.slotId/);
assert.match(runtime, /if \(isOtterCrimsonSlot\(slot\)\)[\s\S]*RANKED_OTTER_CHEST_PRESENTATION_UNAVAILABLE/);
assert.match(runtime, /RANKED_OTTER_CHEST_PRESENTATION_UNAVAILABLE/);

assert.match(game, /showRankedOtterRewardChest\(slot\)/);
assert.match(game, /canonicalRewardSlotId: slotId/);
assert.match(game, /if \(state\.onlineV3Ranked && chest\.type === "otter_red"\)/);
assert.match(game, /DungeonOnlineV3\?\.onOtterChestOpen\?\.\(\)/);
assert.match(game, /function spawnOtterRewardChest\(\)[\s\S]*relicOfferIds/);
assert.match(game, /const postClearChest = getNearestChestForBot\(\)/);

console.log("Ranked Otter chest integration tests passed");
