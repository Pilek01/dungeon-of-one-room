"use strict";

(function initBotSafety(globalScope) {
  function getForgeTargetForBot(forge) {
    if (!forge || forge.used || !forge.awakened) return null;
    const x = Number.isFinite(Number(forge.interactX)) ? Number(forge.interactX) : Number(forge.x);
    const y = Number.isFinite(Number(forge.interactY)) ? Number(forge.interactY) : Number(forge.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: Math.round(x), y: Math.round(y) };
  }

  function getBotCombatChestAdjustment(options = {}) {
    if (options.onChest !== true || options.roomCleared === true) return 0;
    return options.chase === true ? 36 : -110;
  }

  function mergeBotActionCandidate(existing, incoming) {
    if (!existing || typeof existing !== "object") return { ...(incoming || {}) };
    if (!incoming || typeof incoming !== "object") return { ...existing };
    return { ...existing, ...incoming };
  }

  function shouldBotBlockPathTile(options = {}) {
    if (options.pit === true) return true;
    return options.avoidHazards === true && options.hazard === true && options.target !== true;
  }

  function getBotPostClearNavigationMode(options = {}) {
    if (options.portalPresent !== true) return "missing_portal";
    return options.loopPingPongActive === true ? "portal_recovery" : "normal";
  }

  function canBotDrinkPotion(options = {}) {
    if (options.hasRisk) return false;
    if (Math.max(0, Number(options.oathPotionLockTurns) || 0) > 0) return false;
    if (Math.max(0, Number(options.potions) || 0) <= 0) return false;
    const hp = Math.max(0, Number(options.hp) || 0);
    const maxHp = Math.max(1, Number(options.maxHp) || 1);
    if (hp <= 0) return false;
    if (hp < maxHp) return true;
    return hasMeaningfulPotionStatus(options);
  }
  const CRITICAL_HP_RATIO = 0.35;
  const POTION_MEANINGFUL_STATUS_RATIO = 0.1;

  function normalizePotionStatus(options = {}, turnsKey, damageKey, maxHp) {
    const turns = Math.max(0, Math.floor(Number(options[turnsKey]) || 0));
    const damage = Math.max(0, Number(options[damageKey]) || 0);
    const remainingDamage = turns * damage;
    const threshold = Math.max(1, Math.ceil(maxHp * POTION_MEANINGFUL_STATUS_RATIO));
    return { turns, damage, remainingDamage, meaningful: remainingDamage >= threshold || turns >= 3 };
  }

  function hasMeaningfulPotionStatus(options = {}) {
    const maxHp = Math.max(1, Number(options.maxHp) || 1);
    return normalizePotionStatus(options, "bleedTurns", "bleedDamage", maxHp).meaningful ||
      normalizePotionStatus(options, "poisonTurns", "poisonDamage", maxHp).meaningful;
  }

  function buildPotionActionKey(options = {}) {
    const turn = Number.isFinite(Number(options.turn)) ? Math.floor(Number(options.turn)) : 0;
    const enemyTurn = Number.isFinite(Number(options.enemyTurn)) ? Math.floor(Number(options.enemyTurn)) : 0;
    const hazard = options.hazardIdentity == null || options.hazardIdentity === ""
      ? "ordinary"
      : encodeURIComponent(String(options.hazardIdentity));
    return `potion:${turn}:${enemyTurn}:${hazard}`;
  }

  function blockedPotionDecision(reason, actionKey) {
    return { use: false, reason, actionKey };
  }

  function decideBotPotionUse(options = {}) {
    const actionKey = buildPotionActionKey(options);
    if (options.hasRisk) return blockedPotionDecision("blocked_risk", actionKey);
    if (Math.max(0, Number(options.oathPotionLockTurns) || 0) > 0) return blockedPotionDecision("blocked_oath", actionKey);
    if (Math.max(0, Number(options.potions) || 0) <= 0) return blockedPotionDecision("blocked_empty", actionKey);
    const hp = Math.max(0, Number(options.hp) || 0);
    const maxHp = Math.max(1, Number(options.maxHp) || 1);
    if (hp <= 0) return blockedPotionDecision("blocked_dead", actionKey);
    if (options.boundaryPending || options.observerBotBoundaryPending || options.rankedBoundaryPending) {
      return blockedPotionDecision("blocked_boundary", actionKey);
    }
    if (options.turnInProgress || options.enemyTurnInProgress || options.enemyTurnPending) {
      return blockedPotionDecision("blocked_turn", actionKey);
    }
    const cooldown = Math.max(0, Number(options.cooldownTurns) || 0, Number(options.potionCooldown) || 0, Number(options.autoPotionCooldown) || 0);
    if (Math.max(0, Number(cooldown) || 0) > 0) return blockedPotionDecision("blocked_cooldown", actionKey);
    if (String(options.lastPotionActionKey || "") === actionKey) {
      return blockedPotionDecision("blocked_duplicate_action", actionKey);
    }

    const incomingDamage = Math.max(0, Number(options.incomingDamage) || 0);
    const barrier = Math.max(0, Number(options.barrier ?? options.totalBarrier) || 0);
    const barrierAdjustedDamage = Math.max(0, incomingDamage - barrier);
    const bleed = normalizePotionStatus(options, "bleedTurns", "bleedDamage", maxHp);
    const poison = normalizePotionStatus(options, "poisonTurns", "poisonDamage", maxHp);
    const remainingStatusDamage = bleed.remainingDamage + poison.remainingDamage;
    const projectedDamage = barrierAdjustedDamage + remainingStatusDamage;
    const effectiveHeal = Math.max(0, Number(options.effectiveHeal ?? options.healAmount) || 0);
    const utilizedHeal = Math.min(Math.max(0, maxHp - hp), effectiveHeal);
    const hpAfterThreat = hp - projectedDamage;
    const potionClearsStatuses = bleed.turns > 0 || poison.turns > 0;
    const hpAfterPotionThreat = hp + utilizedHeal - (potionClearsStatuses ? barrierAdjustedDamage : projectedDamage);
    const meaningfulHeal = utilizedHeal >= Math.max(1, Math.ceil(maxHp * POTION_MEANINGFUL_STATUS_RATIO));
    const hpRatio = hp / maxHp;
    if (hpAfterThreat <= 0 && hpAfterPotionThreat > 0) return { use: true, reason: "prevent_lethal", actionKey };
    if (bleed.meaningful || poison.meaningful) {
      const cleanseBleed = bleed.meaningful && (!poison.meaningful || bleed.remainingDamage >= poison.remainingDamage);
      return { use: true, reason: cleanseBleed ? "cleanse_bleed" : "cleanse_poison", actionKey };
    }
    if (hpRatio > CRITICAL_HP_RATIO && hpAfterThreat / maxHp <= CRITICAL_HP_RATIO && meaningfulHeal && hpAfterPotionThreat > hpAfterThreat) {
      return { use: true, reason: "prevent_critical", actionKey };
    }
    if (hpRatio <= CRITICAL_HP_RATIO && meaningfulHeal) return { use: true, reason: "low_hp_useful_heal", actionKey };
    if (hpRatio >= 0.8 && barrierAdjustedDamage < Math.max(1, Math.ceil(maxHp * POTION_MEANINGFUL_STATUS_RATIO))) {
      return { use: false, reason: "high_hp_low_threat", actionKey };
    }
    if (utilizedHeal < Math.max(1, Math.ceil(maxHp * POTION_MEANINGFUL_STATUS_RATIO))) {
      return { use: false, reason: "heal_waste", actionKey };
    }
    return { use: false, reason: "high_hp_low_threat", actionKey };
  }

  function tileKey(x, y) {
    return `${x},${y}`;
  }

  function addBlastZoneCell(map, x, y, damage, risk, turnsUntilBlast, source) {
    const key = tileKey(x, y);
    const existing = map[key];
    if (!existing) {
      map[key] = { damage, risk, turnsUntilBlast, source };
      return;
    }
    map[key] = {
      damage: Math.max(existing.damage, damage),
      risk: Math.max(existing.risk, risk),
      turnsUntilBlast: Math.min(existing.turnsUntilBlast, turnsUntilBlast),
      source: existing.risk >= risk ? existing.source : source
    };
  }

  function addSquareBlast(map, centerX, centerY, damage, risk, turnsUntilBlast, source, inBounds) {
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const x = centerX + ox;
        const y = centerY + oy;
        if (inBounds && !inBounds(x, y)) continue;
        addBlastZoneCell(map, x, y, damage, risk, turnsUntilBlast, source);
      }
    }
  }

  function getPendingBlastZones(options = {}) {
    const mines = Array.isArray(options.mines) ? options.mines : [];
    const bursts = Array.isArray(options.volatileBursts) ? options.volatileBursts : [];
    const inBounds = typeof options.inBounds === "function" ? options.inBounds : null;
    const map = {};

    for (const mine of mines) {
      if (!mine || !mine.armed) continue;
      const fuseTurns = Math.max(0, Number(mine.fuseTurns) || 0);
      if (fuseTurns > 1) continue;
      const turnsUntilBlast = fuseTurns;
      const damage = Math.max(1, Number(mine.damage) || 0);
      const risk = fuseTurns <= 0 ? 180 : 150;
      addSquareBlast(map, Number(mine.x), Number(mine.y), damage, risk, turnsUntilBlast, "mine", inBounds);
    }

    for (const burst of bursts) {
      if (!burst) continue;
      const fuseTurns = Math.max(0, Number(burst.fuseTurns) || 0);
      const source = String(burst.source || "").toLowerCase() === "totem" ? "totem" : "volatile";
      const shouldTrack = source === "volatile" ? fuseTurns <= 2 : fuseTurns <= 1;
      if (!shouldTrack) continue;
      const turnsUntilBlast = fuseTurns;
      const damage = Math.max(1, Number(burst.damage) || 0);
      const risk = source === "volatile"
        ? (fuseTurns <= 1 ? 145 : 80)
        : 155;
      addSquareBlast(map, Number(burst.x), Number(burst.y), damage, risk, turnsUntilBlast, source, inBounds);
    }

    return map;
  }

  function getBotEarlyPotionUpgradePlan(options = {}) {
    const depthValue = Number(options.depth);
    const depth = Number.isFinite(depthValue) ? Math.max(0, Math.floor(depthValue)) : 0;
    const campGoldValue = Number(options.campGold);
    const campGold = Number.isFinite(campGoldValue) ? Math.max(0, campGoldValue) : 0;
    const satchelLevelValue = Number(options.satchelLevel);
    const satchelLevel = Number.isFinite(satchelLevelValue)
      ? Math.max(0, Math.min(6, Math.floor(satchelLevelValue)))
      : 0;
    const potionStrengthLevelValue = Number(options.potionStrengthLevel);
    const potionStrengthLevel = Number.isFinite(potionStrengthLevelValue)
      ? Math.max(0, Math.min(5, Math.floor(potionStrengthLevelValue)))
      : 0;
    const hpRatioValue = Number(options.hpRatio);
    const hpRatio = Number.isFinite(hpRatioValue) ? Math.max(0, Math.min(1, hpRatioValue)) : 1;
    const livesValue = Number(options.lives);
    const lives = Number.isFinite(livesValue) ? Math.max(0, Math.floor(livesValue)) : 3;
    const survivabilityValue = Number(options.survivabilityLevel);
    const survivabilityLevel = Number.isFinite(survivabilityValue)
      ? Math.max(0, Math.floor(survivabilityValue))
      : 0;

    if (depth > 18) {
      return {
        active: false,
        satchelTarget: satchelLevel,
        potionStrengthTarget: potionStrengthLevel,
        recommendedUpgrade: null,
        reason: "outside_early_game"
      };
    }

    const fundedCapacity = campGold >= 320;
    const survivalPressure = hpRatio < 0.6 || lives <= 2 || survivabilityLevel < 5;
    const fundedHealingBySurvival = campGold >= 520 && survivalPressure;
    const fundedHealingByWealth = campGold >= 760;
    const fundedHealing = fundedHealingBySurvival || fundedHealingByWealth;
    const satchelTarget = fundedCapacity ? 3 : 2;
    const potionStrengthTarget = fundedHealing ? 2 : 1;

    if (satchelLevel < Math.min(2, satchelTarget)) {
      return {
        active: true,
        satchelTarget,
        potionStrengthTarget,
        recommendedUpgrade: "satchel",
        reason: "early_capacity"
      };
    }
    if (potionStrengthLevel < 1) {
      return {
        active: true,
        satchelTarget,
        potionStrengthTarget,
        recommendedUpgrade: "potion_strength",
        reason: "early_healing"
      };
    }
    if (satchelLevel < satchelTarget) {
      return {
        active: true,
        satchelTarget,
        potionStrengthTarget,
        recommendedUpgrade: "satchel",
        reason: "funded_capacity"
      };
    }
    if (potionStrengthLevel < potionStrengthTarget) {
      return {
        active: true,
        satchelTarget,
        potionStrengthTarget,
        recommendedUpgrade: "potion_strength",
        reason: fundedHealingBySurvival ? "survival_healing" : "funded_healing"
      };
    }
    return {
      active: true,
      satchelTarget,
      potionStrengthTarget,
      recommendedUpgrade: null,
      reason: "goals_met"
    };
  }

  function getBotSkillSavingsUpgradeCount(depthValue) {
    const numericDepth = Number(depthValue);
    const depth = Number.isFinite(numericDepth)
      ? Math.max(0, Math.floor(numericDepth))
      : 0;
    if (depth >= 16) return 2;
    if (depth >= 11) return 1;
    return 0;
  }

  function getBotGoldBankingPressure(options = {}) {
    const depthValue = Number(options.depth);
    const depth = Number.isFinite(depthValue) ? Math.max(0, Math.floor(depthValue)) : 0;
    const goldValue = Number(options.gold);
    const gold = Number.isFinite(goldValue) ? Math.max(0, goldValue) : 0;
    const threshold = Math.round(700 + Math.max(0, depth - 5) * 18);
    const ratio = threshold > 0 ? gold / threshold : 0;
    let score = 0;
    if (ratio >= 1) {
      score = Math.round(40 + Math.min(20, (ratio - 1) * 30));
    } else if (ratio >= 0.55) {
      score = Math.round(10 + ((ratio - 0.55) / 0.45) * 30);
    }
    const profile = String(options.profile || "balanced").toLowerCase();
    const strongThreshold = profile === "safe" ? 38 : profile === "aggressive" ? 46 : 40;
    return {
      threshold,
      score: Math.max(0, Math.min(60, score)),
      ratio,
      strong: score >= strongThreshold
    };
  }

  function decideBotOffensiveMine(options = {}) {
    const blocked = (reason) => ({
      use: false,
      reason,
      escape: null,
      enemyHits: 0,
      predictedKills: 0,
      expectedEnemyDamage: 0
    });
    if (!options.dashAvailable) return blocked("dash_unavailable");
    if (options.mineArmed || !options.adjacent) return blocked("mine_not_available");

    const playerHp = Math.max(0, Number(options.playerHp) || 0);
    const playerMaxHp = Math.max(1, Number(options.playerMaxHp) || 1);
    const playerBarrier = Math.max(0, Number(options.playerBarrier) || 0);
    const entryDamage = Math.max(0, Number(options.entryDamage) || 0);
    const hpAfterEntry = playerHp + playerBarrier - entryDamage;
    if (hpAfterEntry <= Math.max(1, playerMaxHp * 0.2)) return blocked("unsafe_entry");

    const mineDamage = Math.max(1, Number(options.mineDamage) || 1);
    const blastEnemies = (Array.isArray(options.enemies) ? options.enemies : [])
      .filter((enemy) => enemy && enemy.inBlast === true);
    let expectedEnemyDamage = 0;
    let predictedKills = 0;
    for (const enemy of blastEnemies) {
      const hp = Math.max(0, Number(enemy.hp) || 0);
      expectedEnemyDamage += Math.min(hp, mineDamage);
      if (hp > 0 && hp <= mineDamage) predictedKills += 1;
    }
    const enemyHits = blastEnemies.length;
    const usefulCrowd = enemyHits >= 3 || (enemyHits >= 2 && predictedKills >= 1);
    const expectedMeleeDamage = Math.max(1, Number(options.expectedMeleeDamage) || 1);
    const profitableDamage = expectedEnemyDamage >= Math.max(
      mineDamage * 1.5,
      expectedMeleeDamage * 1.6,
      entryDamage * 2.2
    );
    if (!usefulCrowd || !profitableDamage) {
      return {
        ...blocked("poor_trade"),
        enemyHits,
        predictedKills,
        expectedEnemyDamage
      };
    }

    const safeEscapes = (Array.isArray(options.escapes) ? options.escapes : [])
      .filter((escape) => {
        if (!escape || escape.passable !== true) return false;
        if (Math.max(0, Number(escape.distanceFromMine) || 0) <= 1) return false;
        if (escape.hazard === true) return false;
        if (Math.max(0, Number(escape.pendingBlastDamage) || 0) > 0) return false;
        if (Math.max(0, Number(escape.expectedDamage) || 0) >= hpAfterEntry) return false;
        return Math.max(0, Number(escape.risk) || 0) <= 120;
      })
      .sort((a, b) => {
        const dangerA = Math.max(0, Number(a.expectedDamage) || 0) * 3 + Math.max(0, Number(a.risk) || 0);
        const dangerB = Math.max(0, Number(b.expectedDamage) || 0) * 3 + Math.max(0, Number(b.risk) || 0);
        return dangerA - dangerB || Math.max(0, Number(b.distanceFromMine) || 0) - Math.max(0, Number(a.distanceFromMine) || 0);
      });
    if (safeEscapes.length <= 0) {
      return {
        ...blocked("no_safe_escape"),
        enemyHits,
        predictedKills,
        expectedEnemyDamage
      };
    }
    const best = safeEscapes[0];
    return {
      use: true,
      reason: "profitable_safe_setup",
      escape: { dx: Number(best.dx) || 0, dy: Number(best.dy) || 0 },
      enemyHits,
      predictedKills,
      expectedEnemyDamage
    };
  }

  function decideBotEmergencyExtract(options = {}) {
    const hp = Math.max(0, Number(options.hp) || 0);
    const maxHp = Math.max(1, Number(options.maxHp) || 1);
    const incomingDamage = Math.max(0, Number(options.incomingDamage) || 0);
    const barrier = Math.max(0, Number(options.barrier) || 0);
    const bleedDamage = Math.max(0, Math.floor(Number(options.bleedTurns) || 0)) > 0
      ? Math.max(0, Number(options.bleedDamage) || 0)
      : 0;
    const poisonDamage = Math.max(0, Math.floor(Number(options.poisonTurns) || 0)) > 0
      ? Math.max(0, Number(options.poisonDamage) || 0)
      : 0;
    const statusDamage = bleedDamage + poisonDamage;
    const immediateAfterBarrier = Math.max(0, incomingDamage - barrier);
    const projectedDamage = immediateAfterBarrier + statusDamage;
    const result = (extract, reason) => ({ extract, reason, projectedDamage });
    if (hp - projectedDamage > 0) return result(false, "not_lethal");

    const potion = options.potion || {};
    if (potion.available === true && potion.reliable === true) {
      const heal = Math.min(Math.max(0, maxHp - hp), Math.max(0, Number(potion.heal) || 0));
      const damageAfterPotion = immediateAfterBarrier + (potion.clearsStatuses === true ? 0 : statusDamage);
      if (hp + heal - damageAfterPotion > 0) return result(false, "survives_with_potion");
    }

    const shield = options.shield || {};
    if (shield.available === true && shield.reliable === true) {
      const shieldAmount = Math.max(0, Number(shield.amount) || 0);
      const damageAfterShield = Math.max(0, immediateAfterBarrier - shieldAmount) + statusDamage;
      if (hp - damageAfterShield > 0) return result(false, "survives_with_shield");
    }

    if (options.safeStepDamage != null && Number.isFinite(Number(options.safeStepDamage))) {
      const safeStepDamage = Math.max(0, Number(options.safeStepDamage)) + statusDamage;
      if (hp - safeStepDamage > 0) return result(false, "survives_with_safe_step");
    }
    if (options.safeDashDamage != null && Number.isFinite(Number(options.safeDashDamage))) {
      const safeDashDamage = Math.max(0, Number(options.safeDashDamage)) + statusDamage;
      if (hp - safeDashDamage > 0) return result(false, "survives_with_safe_dash");
    }
    return result(true, "certain_lethal_no_survival");
  }

  const api = {
    canBotDrinkPotion,
    decideBotEmergencyExtract,
    decideBotOffensiveMine,
    decideBotPotionUse,
    getBotCombatChestAdjustment,
    getBotPostClearNavigationMode,
    getBotEarlyPotionUpgradePlan,
    getBotGoldBankingPressure,
    getBotSkillSavingsUpgradeCount,
    getForgeTargetForBot,
    getPendingBlastZones,
    mergeBotActionCandidate,
    shouldBotBlockPathTile
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalScope.botSafetyApi = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
