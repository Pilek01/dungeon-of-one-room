"use strict";

(function initBotSafety(globalScope) {
  function getForgeTargetForBot(forge) {
    if (!forge || forge.used || !forge.awakened) return null;
    const x = Number.isFinite(Number(forge.interactX)) ? Number(forge.interactX) : Number(forge.x);
    const y = Number.isFinite(Number(forge.interactY)) ? Number(forge.interactY) : Number(forge.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: Math.round(x), y: Math.round(y) };
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

  const api = {
    canBotDrinkPotion,
    decideBotPotionUse,
    getForgeTargetForBot,
    getPendingBlastZones
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalScope.botSafetyApi = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
