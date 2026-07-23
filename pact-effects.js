(function () {
  function getBasePlayer(options = {}) {
    return options.basePlayer && typeof options.basePlayer === "object" ? options.basePlayer : null;
  }

  function applySinglePactEffect(player, pactId, options = {}) {
    if (!player || !pactId) return player;
    const critCap = Number(options.critCap) || 0.55;
    const minEffectiveDamage = Math.max(1, Number(options.minEffectiveDamage) || 1);
    const chainsArmorBonus = Math.max(0, Math.round(Number(options.chainsArmorBonus) || 20));
    const normalizedId = String(pactId).trim().toLowerCase();

    if (normalizedId === "precision") {
      player.crit = Math.max(0.01, Math.min(critCap, (Number(player.crit) || 0.1) + 0.12));
      player.maxHp = Math.max(minEffectiveDamage, Math.round((Number(player.maxHp) || 1) * 0.75));
      player.hp = Math.min(Number(player.hp) || player.maxHp, player.maxHp);
      return player;
    }

    if (normalizedId === "blood") {
      player.attack = Math.max(
        minEffectiveDamage,
        Math.round((Number(player.attack) || 0) * 0.8)
      );
      return player;
    }

    if (normalizedId === "chains") {
      player.armor = Math.max(0, Math.round(Number(player.armor) || 0) + chainsArmorBonus);
      return player;
    }

    return player;
  }

  function removeSinglePactEffect(player, pactId, options = {}) {
    if (!player || !pactId) return player;
    const basePlayer = getBasePlayer(options);
    const normalizedId = String(pactId).trim().toLowerCase();

    if (normalizedId === "precision" && basePlayer) {
      player.crit = Number(basePlayer.crit) || 0.1;
      player.maxHp = Number(basePlayer.maxHp) || 1;
      player.hp = Math.min(Number(player.hp) || player.maxHp, player.maxHp);
      return player;
    }

    if (normalizedId === "blood" && basePlayer) {
      player.attack = Number(basePlayer.attack) || 1;
      return player;
    }

    if (normalizedId === "chains" && basePlayer) {
      player.armor = Math.max(0, Number(basePlayer.armor) || 0);
      return player;
    }

    return player;
  }

  function applyPersistentPactEffects(player, activePactIds, options = {}) {
    const pactIds = Array.isArray(activePactIds) ? activePactIds : [];
    for (const pactId of pactIds) {
      applySinglePactEffect(player, pactId, options);
    }
    return player;
  }

  const api = {
    applySinglePactEffect,
    applyPersistentPactEffects,
    removeSinglePactEffect
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonPactEffects = api;
  }
})();
