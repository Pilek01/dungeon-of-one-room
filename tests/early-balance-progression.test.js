const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const balancePath = path.join(root, "balance-progression.js");
assert.ok(fs.existsSync(balancePath), "balance-progression.js should define shared early-game rules");

const {
  getArmorDamageReduction,
  getDamageAfterArmor,
  getBladeCampAttackBonus,
  getCampUpgradeBaseCost,
  getRelicWardProtectionChance,
  getRelicAppraisalMultiplier,
  getRelicAppraisalValue,
  shouldPreventDeathRelicLoss,
  getEligibleDeathRelicIndices,
  getCampUpgradeUnlockDepth,
  isCampUpgradeTierUnlocked,
  isRoomTypeUnlocked
} = require(balancePath);

assert.equal(getArmorDamageReduction(0), 0);
assert.equal(getArmorDamageReduction(50), 1 / 3);
assert.equal(getArmorDamageReduction(100), 0.5);
assert.equal(getArmorDamageReduction(150), 0.6);
assert.equal(getArmorDamageReduction(1000), 0.7);
assert.equal(getDamageAfterArmor(200, 150, 10), 80);
assert.equal(getDamageAfterArmor(20, 1000, 10), 10);

assert.equal(getBladeCampAttackBonus(0), 0);
assert.equal(getBladeCampAttackBonus(15), 375);
assert.equal(getBladeCampAttackBonus(16), 400);
assert.equal(getBladeCampAttackBonus(25), 625);
assert.equal(getCampUpgradeBaseCost({ id: "blade", baseCost: 30, costGrowth: 1.4 }, 14), 3334);
assert.equal(getCampUpgradeBaseCost({ id: "blade", baseCost: 30, costGrowth: 1.4 }, 15), 3334);
assert.equal(getCampUpgradeBaseCost({ id: "vitality", baseCost: 30, costGrowth: 1.4 }, 24), 3334);

assert.deepEqual([0, 1, 2, 3].map(getRelicWardProtectionChance), [0, 0.33, 0.66, 1]);
assert.deepEqual([0, 1, 2, 3].map(getRelicAppraisalMultiplier), [1, 1.15, 1.3, 1.45]);
assert.equal(getRelicAppraisalValue(200, 3), 290);
assert.equal(shouldPreventDeathRelicLoss(1, 0.32), true);
assert.equal(shouldPreventDeathRelicLoss(1, 0.33), false);
assert.equal(shouldPreventDeathRelicLoss(3, 0.9999), true);
assert.deepEqual(
  getEligibleDeathRelicIndices(["fang", "fang", "idol", "mythic"], {
    protectedStarterRelicId: "fang",
    starterProtectionActive: true,
    isMythic: (id) => id === "mythic"
  }),
  [1, 2]
);
assert.equal(getCampUpgradeUnlockDepth("relic_ward", 1), 10);
assert.equal(getCampUpgradeUnlockDepth("relic_ward", 3), 50);
assert.equal(getCampUpgradeUnlockDepth("relic_appraisal", 1), 10);
assert.equal(getCampUpgradeUnlockDepth("relic_appraisal", 3), 30);
assert.equal(isCampUpgradeTierUnlocked("relic_ward", 0, 9), false);
assert.equal(isCampUpgradeTierUnlocked("relic_ward", 0, 10), true);
assert.equal(isCampUpgradeTierUnlocked("relic_ward", 1, 29), false);
assert.equal(isCampUpgradeTierUnlocked("relic_appraisal", 1, 20), true);

assert.equal(isRoomTypeUnlocked("cursed", 5, false), false);
assert.equal(isRoomTypeUnlocked("cursed", 6, false), true);
assert.equal(isRoomTypeUnlocked("forge", 10, false), false);
assert.equal(isRoomTypeUnlocked("forge", 11, false), true);
assert.equal(isRoomTypeUnlocked("vault", 10, false), false);
assert.equal(isRoomTypeUnlocked("vault", 10, true), true);

console.log("Early balance progression tests passed");
