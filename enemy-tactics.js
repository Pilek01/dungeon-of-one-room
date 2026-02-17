(() => {
  function ensureEnemyState(enemy) {
    if (!enemy) return;
    enemy.slamAiming = Boolean(enemy.slamAiming);
    enemy.volleyAiming = Boolean(enemy.volleyAiming);
    enemy.burstAiming = Boolean(enemy.burstAiming);
    enemy.volleyCooldown = Math.max(0, Number(enemy.volleyCooldown) || 0);
    enemy.burstCooldown = Math.max(0, Number(enemy.burstCooldown) || 0);
    enemy.telegraphAge = Math.max(0, Number(enemy.telegraphAge) || 0);
  }

  function tickPassiveCooldowns(enemy) {
    ensureEnemyState(enemy);
    if (enemy.volleyCooldown > 0) enemy.volleyCooldown -= 1;
    if (enemy.burstCooldown > 0) enemy.burstCooldown -= 1;
    if (enemy.aiming || enemy.slamAiming || enemy.volleyAiming || enemy.burstAiming) {
      enemy.telegraphAge = Math.min(99, enemy.telegraphAge + 1);
    } else {
      enemy.telegraphAge = 0;
    }
  }

  function handleSkeleton(enemy, context = {}) {
    ensureEnemyState(enemy);
    const canLineShot = Boolean(context.canLineShot);
    if (enemy.volleyAiming) {
      if (canLineShot) {
        enemy.volleyAiming = false;
        enemy.volleyCooldown = 5;
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
    const hasLineShot = Boolean(context.hasLineShot);
    const canBurstHit = hasLineShot && distance > 1 && distance <= 3;
    if (enemy.burstAiming) {
      // Gravity burst always channels for at least 2 Warden turns.
      if ((enemy.telegraphAge || 0) < 2) {
        return { type: "hold_burst" };
      }
      if (canBurstHit) {
        enemy.burstAiming = false;
        enemy.burstCooldown = 7;
        enemy.telegraphAge = 0;
        return { type: "execute_burst" };
      }
      const escapedBurstRange = distance <= 1 || distance > 3;
      enemy.burstAiming = false;
      if (escapedBurstRange) {
        // If player escaped burst range during channel, spend cooldown anyway.
        enemy.burstCooldown = 7;
      }
      enemy.telegraphAge = 0;
      return { type: "cancel_burst" };
    }

    const canStartTelegraph = Boolean(context.canStartTelegraph);
    const wantsCast = context.intent === "cast";
    const playerShieldActive = Boolean(context.playerShieldActive);
    if (!wantsCast || playerShieldActive) return { type: "none" };
    if (!canBurstHit) return { type: "none" };
    if (enemy.burstCooldown > 0) return { type: "none" };
    if (!canStartTelegraph) return { type: "none" };

    if (Math.random() < 0.35) {
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
