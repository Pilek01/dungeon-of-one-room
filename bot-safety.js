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
    return hp > 0 && hp < maxHp;
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
    getForgeTargetForBot,
    getPendingBlastZones
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalScope.botSafetyApi = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
