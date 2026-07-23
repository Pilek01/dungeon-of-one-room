(() => {
  function ensureEnemyState(enemy) {
    if (!enemy) return;
    enemy.slamAiming = Boolean(enemy.slamAiming);
    enemy.anvilAiming = Boolean(enemy.anvilAiming);
    enemy.volleyAiming = Boolean(enemy.volleyAiming);
    enemy.burstAiming = Boolean(enemy.burstAiming);
    enemy.anvilDx = Math.max(-1, Math.min(1, Math.trunc(Number(enemy.anvilDx) || 0)));
    enemy.anvilDy = Math.max(-1, Math.min(1, Math.trunc(Number(enemy.anvilDy) || 0)));
    enemy.blacksmithTemperCooldown = Math.max(0, Number(enemy.blacksmithTemperCooldown) || 0);
    enemy.blacksmithTemperUses = Math.max(0, Number(enemy.blacksmithTemperUses) || 0);
    enemy.blacksmithBarrier = Math.max(0, Number(enemy.blacksmithBarrier) || 0);
    enemy.blacksmithBarrierTurns = Math.max(0, Number(enemy.blacksmithBarrierTurns) || 0);
    enemy.moltenPulseCooldown = Math.max(0, Number(enemy.moltenPulseCooldown) || 0);
    const acolyteCastType = String(enemy.acolyteCastType || "").toLowerCase();
    enemy.acolyteCastType =
      acolyteCastType === "heal" || acolyteCastType === "buff" || acolyteCastType === "attack"
        ? acolyteCastType
        : "";
    enemy.volleyCooldown = Math.max(0, Number(enemy.volleyCooldown) || 0);
    enemy.burstCooldown = Math.max(0, Number(enemy.burstCooldown) || 0);
    enemy.telegraphAge = Math.max(0, Number(enemy.telegraphAge) || 0);
    enemy.voidAegisCooldown = Math.max(0, Number(enemy.voidAegisCooldown) || 0);
    enemy.voidAegisUses = Math.max(0, Number(enemy.voidAegisUses) || 0);
    enemy.voidAegisShield = Math.max(0, Number(enemy.voidAegisShield) || 0);
    enemy.voidAegisTurns = Math.max(0, Number(enemy.voidAegisTurns) || 0);
    if (enemy.voidAegisShield > 0 && enemy.voidAegisTurns <= 0) {
      enemy.voidAegisTurns = 1;
    }
    enemy.voidAegisRetaliateTurn = Number.isFinite(Number(enemy.voidAegisRetaliateTurn))
      ? Number(enemy.voidAegisRetaliateTurn)
      : -1;
  }

  function tickPassiveCooldowns(enemy) {
    ensureEnemyState(enemy);
    if (enemy.volleyCooldown > 0) enemy.volleyCooldown -= 1;
    if (enemy.burstCooldown > 0) enemy.burstCooldown -= 1;
    if (enemy.voidAegisCooldown > 0) enemy.voidAegisCooldown -= 1;
    if (enemy.blacksmithTemperCooldown > 0) enemy.blacksmithTemperCooldown -= 1;
    if (enemy.moltenPulseCooldown > 0) enemy.moltenPulseCooldown -= 1;
    const nativeTelegraphActive = Boolean(
      enemy.aiming || enemy.slamAiming || enemy.anvilAiming || enemy.volleyAiming || enemy.burstAiming
    );
    const expansionTelegraphActive = Boolean(
      enemy.riftAiming ||
      enemy.bulwarkBashAiming ||
      enemy.latticeAiming ||
      enemy.voidStepAiming ||
      enemy.soulChainAiming ||
      enemy.blacksmithChainAiming
    );
    if (nativeTelegraphActive) {
      enemy.telegraphAge = Math.min(99, enemy.telegraphAge + 1);
    } else if (!expansionTelegraphActive) {
      enemy.telegraphAge = 0;
    }
  }

  function handleSkeleton(enemy, context = {}) {
    ensureEnemyState(enemy);
    const canLineShot = Boolean(context.canLineShot);
    if (enemy.volleyAiming) {
      if (canLineShot) {
        enemy.volleyAiming = false;
        enemy.volleyCooldown = 7;
        enemy.telegraphAge = 0;
        return { type: "execute_volley" };
      }
      enemy.volleyAiming = false;
      enemy.telegraphAge = 0;
      return { type: "cancel_volley" };
    }

    const canStartTelegraph = Boolean(context.canStartTelegraph);
    const wantsCast = context.intent === "cast";
    const playerShieldActive = Boolean(context.playerShieldActive);
    if (!canLineShot || !wantsCast || playerShieldActive) return { type: "none" };
    if ((enemy.cooldown || 0) > 0 || enemy.volleyCooldown > 0) return { type: "none" };
    if (!canStartTelegraph) return { type: "none" };

    if (Math.random() < 0.32) {
      enemy.volleyAiming = true;
      enemy.telegraphAge = 0;
      return { type: "start_volley" };
    }
    return { type: "none" };
  }

  function handleWarden(enemy, context = {}) {
    ensureEnemyState(enemy);
    const distance = Math.max(0, Number(context.distance) || 0);
    const depth = Math.max(0, Number(context.depth) || 0);
    const hasBurstWindow = Boolean(context.hasBurstWindow);
    const burstMaxRange = Math.max(2, Number(context.burstMaxRange) || 3);
    const burstHitCooldown = Math.max(
      1,
      Number(context.burstHitCooldown) || (depth >= 20 ? 5 : 7)
    );
    const burstCancelCooldown = Math.max(
      1,
      Number(context.burstCancelCooldown) || (depth >= 20 ? 3 : 7)
    );
    const antiKiteActive = Boolean(context.antiKiteActive);
    const canBurstHit = hasBurstWindow && distance > 1 && distance <= burstMaxRange;
    if (enemy.burstAiming) {
      // Gravity burst always channels for at least 2 Warden turns.
      if ((enemy.telegraphAge || 0) < 2) {
        return { type: "hold_burst" };
      }
      if (canBurstHit) {
        enemy.burstAiming = false;
        enemy.burstCooldown = burstHitCooldown;
        enemy.telegraphAge = 0;
        return { type: "execute_burst" };
      }
      const escapedBurstRange = distance <= 1 || distance > burstMaxRange;
      enemy.burstAiming = false;
      if (escapedBurstRange) {
        // If player escaped burst range during channel, spend cooldown anyway.
        enemy.burstCooldown = burstCancelCooldown;
      }
      enemy.telegraphAge = 0;
      return { type: "cancel_burst" };
    }

    const canStartTelegraph = Boolean(context.canStartTelegraph);
    const wantsCast = context.intent === "cast" || (antiKiteActive && canBurstHit);
    const focusMode = String(context.focusMode || "normal");
    const playerShieldActive = Boolean(context.playerShieldActive);
    if (!wantsCast || playerShieldActive) return { type: "none" };
    if (!canBurstHit) return { type: "none" };
    if (enemy.burstCooldown > 0) return { type: "none" };
    if (!canStartTelegraph) return { type: "none" };

    let burstChance = depth >= 20 ? 0.55 : 0.35;
    if (wantsCast) burstChance += depth >= 20 ? 0.12 : 0.05;
    if (focusMode === "intercept" || focusMode === "pressure") {
      burstChance += depth >= 20 ? 0.15 : 0.08;
    }
    if (antiKiteActive && depth >= 20) {
      burstChance += 0.18;
    }
    burstChance = Math.max(0.05, Math.min(0.95, burstChance));

    if (Math.random() < burstChance) {
      enemy.burstAiming = true;
      enemy.telegraphAge = 0;
      return { type: "start_burst" };
    }
    return { type: "none" };
  }

  function handleBrute(enemy, context = {}) {
    ensureEnemyState(enemy);
    const distance = Math.max(0, Number(context.distance) || 0);
    const canStartTelegraph = Boolean(context.canStartTelegraph);

    if (distance > 1 && enemy.slamAiming) {
      enemy.slamAiming = false;
      enemy.telegraphAge = 0;
      return { type: "cancel_slam" };
    }
    if (distance !== 1) return { type: "none" };
    if ((enemy.cooldown || 0) > 0) return { type: "none" };

    if (!enemy.slamAiming) {
      if (!canStartTelegraph) return { type: "none" };
      enemy.slamAiming = true;
      enemy.telegraphAge = 0;
      return { type: "start_slam" };
    }

    enemy.slamAiming = false;
    enemy.telegraphAge = 0;
    return { type: "execute_slam" };
  }

  function getTelegraphKind(enemy) {
    if (!enemy) return "";
    if (enemy.volleyAiming) return "volley";
    if (enemy.burstAiming) return "burst";
    if (enemy.anvilAiming) return "anvil";
    if (enemy.slamAiming) return "slam";
    if (enemy.aiming) return "cast";
    return "";
  }

  window.DungeonEnemyTactics = {
    ensureEnemyState,
    tickPassiveCooldowns,
    handleSkeleton,
    handleWarden,
    handleBrute,
    getTelegraphKind
  };
})();
