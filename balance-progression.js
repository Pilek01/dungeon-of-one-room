(function () {
  const ARMOR_REDUCTION_CAP = 0.7;
  const BLADE_LINEAR_START_LEVEL = 15;
  const BLADE_LINEAR_GAIN = 25;
  const FIXED_COST_START_LEVEL = 15;
  const RELIC_WARD_CHANCES = Object.freeze([0, 0.33, 0.66, 1]);
  const RELIC_WARD_UNLOCK_DEPTHS = Object.freeze([10, 30, 50]);
  const RELIC_APPRAISAL_UNLOCK_DEPTHS = Object.freeze([10, 20, 30]);

  function safeLevel(value, maximum = Number.MAX_SAFE_INTEGER) {
    return Math.max(0, Math.min(maximum, Math.floor(Number(value) || 0)));
  }

  function getArmorDamageReduction(armor) {
    const safeArmor = Math.max(0, Number(armor) || 0);
    if (safeArmor <= 0) return 0;
    return Math.min(ARMOR_REDUCTION_CAP, safeArmor / (safeArmor + 100));
  }

  function getDamageAfterArmor(rawDamage, armor, minimumDamage = 0) {
    const incoming = Math.max(0, Number(rawDamage) || 0);
    const floor = Math.max(0, Number(minimumDamage) || 0);
    return Math.max(floor, Math.ceil(incoming * (1 - getArmorDamageReduction(armor))));
  }

  function getBladeCampAttackBonus(level) {
    const safe = safeLevel(level, 25);
    const curvedLevel = Math.min(safe, BLADE_LINEAR_START_LEVEL);
    const curvedBonus = Math.round(curvedLevel * 10 * (1 + curvedLevel * 0.1));
    return curvedBonus + Math.max(0, safe - BLADE_LINEAR_START_LEVEL) * BLADE_LINEAR_GAIN;
  }

  function getBladeAttackMultiplier(level) {
    return 1 + Math.min(safeLevel(level, 25), BLADE_LINEAR_START_LEVEL) * 0.1;
  }

  function getCampUpgradeBaseCost(definition, level) {
    const safe = safeLevel(level);
    const growth = Math.max(1, Number(definition?.costGrowth) || 2);
    const baseCost = Math.max(0, Number(definition?.baseCost) || 0);
    const fixedAfterFifteen = definition?.id === "blade" || definition?.id === "vitality";
    const exponent = fixedAfterFifteen
      ? Math.min(safe, FIXED_COST_START_LEVEL - 1)
      : safe;
    return Math.round(baseCost * growth ** exponent);
  }

  function getRelicWardProtectionChance(level) {
    return RELIC_WARD_CHANCES[safeLevel(level, 3)];
  }

  function getRelicAppraisalMultiplier(level) {
    return 1 + safeLevel(level, 3) * 0.15;
  }

  function getRelicAppraisalValue(baseValue, level) {
    const base = Math.max(0, Math.round(Number(baseValue) || 0));
    return Math.round(base * (100 + safeLevel(level, 3) * 15) / 100);
  }

  function shouldPreventDeathRelicLoss(level, roll) {
    const chance = getRelicWardProtectionChance(level);
    const safeRoll = Math.max(0, Math.min(0.999999999999, Number(roll) || 0));
    return chance >= 1 || safeRoll < chance;
  }

  function getEligibleDeathRelicIndices(relicIds, options = {}) {
    const relics = Array.isArray(relicIds) ? relicIds : [];
    const isMythic = typeof options.isMythic === "function" ? options.isMythic : () => false;
    const protectedId = options.starterProtectionActive
      ? String(options.protectedStarterRelicId || "")
      : "";
    let protectedCopySkipped = false;
    const indices = [];
    for (let index = 0; index < relics.length; index += 1) {
      const relicId = relics[index];
      if (isMythic(relicId)) continue;
      if (!protectedCopySkipped && protectedId && relicId === protectedId) {
        protectedCopySkipped = true;
        continue;
      }
      indices.push(index);
    }
    return indices;
  }

  function getCampUpgradeUnlockDepth(id, nextLevel) {
    const tierIndex = safeLevel(nextLevel, 3) - 1;
    if (tierIndex < 0) return 0;
    if (id === "relic_ward") return RELIC_WARD_UNLOCK_DEPTHS[tierIndex] || 0;
    if (id === "relic_appraisal") return RELIC_APPRAISAL_UNLOCK_DEPTHS[tierIndex] || 0;
    return 0;
  }

  function isCampUpgradeTierUnlocked(id, currentLevel, highestBossClearDepth) {
    const requiredDepth = getCampUpgradeUnlockDepth(id, safeLevel(currentLevel, 3) + 1);
    return requiredDepth <= 0 || Math.max(0, Number(highestBossClearDepth) || 0) >= requiredDepth;
  }

  function isRoomTypeUnlocked(roomType, depth, forcedByMapFragments = false) {
    const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
    if (roomType === "cursed") return safeDepth >= 6;
    if (roomType === "forge") return safeDepth >= 11;
    if (roomType === "vault") return Boolean(forcedByMapFragments) || safeDepth >= 11;
    return true;
  }

  const api = Object.freeze({
    ARMOR_REDUCTION_CAP,
    getArmorDamageReduction,
    getDamageAfterArmor,
    getBladeCampAttackBonus,
    getBladeAttackMultiplier,
    getCampUpgradeBaseCost,
    getRelicWardProtectionChance,
    getRelicAppraisalMultiplier,
    getRelicAppraisalValue,
    shouldPreventDeathRelicLoss,
    getEligibleDeathRelicIndices,
    getCampUpgradeUnlockDepth,
    isCampUpgradeTierUnlocked,
    isRoomTypeUnlocked
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.DungeonBalanceProgression = api;
})();
