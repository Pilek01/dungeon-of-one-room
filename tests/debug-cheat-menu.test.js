const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");

for (const roomType of [
  "treasure",
  "shrine",
  "cursed",
  "merchant",
  "ambush",
  "horde",
  "duel",
  "crossroads",
  "arena"
]) {
  assert.match(game, new RegExp('"[^"]+", "' + roomType + '", "[^"]+"'), "missing debug room action: " + roomType);
}

for (const roomType of ["otter", "vault", "pact", "forge"]) {
  assert.match(game, new RegExp('forcedNextRoomType = "' + roomType + '"'), "missing existing special-room cheat: " + roomType);
}

assert.match(game, /overlay-card overlay-card-debug-cheats/);
assert.match(game, /debug-cheat-sections/);
assert.doesNotMatch(game, /A\/D or arrows switch section/);
assert.match(game, /OBSERVER_BOT_UNLIMITED_GOLD = 999999/);
assert.match(game, /function toggleObserverBotUnlimitedGold\(\)/);
assert.match(game, /syncObserverBotUnlimitedGold\(\);\s*if \(!isObserverBotActive\(\)\) return;/);
assert.match(game, /queueDebugRoom\("cheat_merchant", "Cheat Merchant"\)/);
assert.match(game, /\["a", "crossroads", "Crossroads"\]/);
assert.match(game, /key: "d",\s*section: "Run",\s*name: "Next Room: Cheat Merchant"/);
assert.match(game, /state\.forcedNextRoomType === "cheat_merchant"/);
assert.match(game, /getDebugCheatRelicEntries\(\)\.map\(\(relic\) =>/);
assert.match(game, /data-debug-relic-id=/);
assert.match(game, /tryClaimDebugCheatMerchantRelic\(relicId\)/);
assert.match(game, /chooseDebugCheatMerchantRelicForBot\(\)/);
assert.doesNotMatch(game, /tryClaimDebugCheatMerchantRelic[\s\S]*?state\.debugCheatMerchantClaimed = true;[\s\S]*?function chooseDebugCheatMerchantRelicForBot/);
assert.match(game, /Click relics to fill up to 8 base slots/);

assert.match(css, /\.screen-overlay\.visible:has\(\.overlay-card-debug-cheats\)[\s\S]*position:\s*fixed[\s\S]*width:\s*100vw[\s\S]*height:\s*100vh/);
assert.match(css, /\.debug-cheat-sections\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/);
assert.match(css, /\.debug-cheat-relic-catalog\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit/);

console.log("Debug cheat menu contract tests passed");