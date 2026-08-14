const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const builder = fs.readFileSync(
  path.join(root, "scripts", "build-pages-v3.mjs"),
  "utf8"
);

assert.match(builder, /function getRankedSpecialRoomScalingDepth\(\)/);
assert.match(
  builder,
  /specialRoomPayload\?\.scalingDepth/
);
assert.match(
  builder,
  /getForgeEncounterProfileForDepth\(specialRoomScalingDepth\)/
);
assert.match(
  builder,
  /getVaultEncounterProfile\(specialRoomScalingDepth\)/
);
assert.match(
  builder,
  /const extra = Math\.floor\(specialRoomScalingDepth/
);
assert.match(
  builder,
  /createEnemy\(enemyType, spot\.x, spot\.y, \{ elite, depthOverride: specialRoomScalingDepth \}\)/
);
assert.match(
  builder,
  /const encounterDepth = Math\.max\(0, Math\.floor\(Number\(options\.depthOverride\)/
);
assert.match(
  builder,
  /getChestUpgradeFlatByDepth\(CHEST_ATTACK_UPGRADE_FLAT, rewardDepth\)/
);
assert.match(
  builder,
  /getChestUpgradeFlatByDepth\(CHEST_ARMOR_UPGRADE_FLAT, rewardDepth\)/
);
assert.match(
  builder,
  /getChestHealthUpgradeFlatByDepth\(rewardDepth\)/
);

console.log("Online special-room scaling contract tests passed");
