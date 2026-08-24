const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.match(index, /balance-progression\.js[\s\S]*camp-data\.js[\s\S]*game\.js/);
assert.match(game, /const balanceProgressionApi = window\.DungeonBalanceProgression/);
assert.match(game, /getBossAddProfile\(state\.depth, regionConfig\.bossAddCount\)/);
assert.match(game, /forceElite: i < bossAdds\.eliteCount/);
assert.match(game, /isRoomTypeUnlocked\("vault", state\.depth, true\)/);
assert.match(game, /isRoomTypeUnlocked\(type, state\.depth, false\)/);
assert.match(game, /getDamageAfterArmor\(remainingDamage, state\.player\.armor, MIN_EFFECTIVE_DAMAGE\)/);
assert.doesNotMatch(game, /remainingAfterShield/);
assert.doesNotMatch(game, /state\.player\.armor = clamp\(state\.player\.armor, 0, scaledCombat\(10\)\)/);
assert.match(game, /Armor applies after shields/);
assert.match(game, /getCampUpgradeBaseCost\(def, level\)/);
assert.match(game, /isCampUpgradeTierUnlocked\(def\.id, level, getHighestBossClearDepth\(\)\)/);
assert.match(game, /getRelicAppraisalValue\(baseSale\.total, getCampUpgradeLevel\("relic_appraisal"\)\)/);
assert.match(game, /getEligibleDeathRelicIndices\(state\.relics/);
assert.match(game, /shouldPreventDeathRelicLoss\(getCampUpgradeLevel\("relic_ward"\), Math\.random\(\)\)/);
assert.match(game, /protectedStarterRelicId/);
assert.match(game, /if \(wasStartingRelicDraft\) state\.protectedStarterRelicId = relic\.id/);
assert.match(game, /protectedStarterRelicId: state\.protectedStarterRelicId/);
assert.match(game, /state\.protectedStarterRelicId = STARTING_RELIC_IDS\.includes\(snapshot\.protectedStarterRelicId\)/);
assert.match(game, /startDepthUnlocks\["11"\]/);

console.log("Early balance integration tests passed");
