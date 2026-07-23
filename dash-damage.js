function computeDashStrikeDamage({
  attack,
  scaledBonus,
  furyMult,
  dashRelicMult,
  pactSkillMult,
  dashTier,
  minDamage
}) {
  const safeMin = Math.max(1, Number(minDamage) || 1);
  const safeAttack = Math.max(0, Number(attack) || 0);
  const safeScaledBonus = Math.max(0, Number(scaledBonus) || 0);
  const safeFuryMult = Math.max(0, Number(furyMult) || 0);
  const safeDashRelicMult = Math.max(0, Number(dashRelicMult) || 0);
  const safePactSkillMult = Math.max(0, Number(pactSkillMult) || 0);
  const safeTier = Math.max(0, Math.trunc(Number(dashTier) || 0));

  const DASH_BASE_DAMAGE_MULTIPLIER = 0.5;
  const DASH_RARE_DAMAGE_MULTIPLIER = 2;

  let damage = Math.max(
    safeMin,
    Math.round(
      (safeAttack + safeScaledBonus) *
      safeFuryMult *
      safeDashRelicMult *
      safePactSkillMult *
      DASH_BASE_DAMAGE_MULTIPLIER
    )
  );
  if (safeTier >= 1) {
    damage = Math.max(safeMin, Math.round(damage * DASH_RARE_DAMAGE_MULTIPLIER));
  }
  return damage;
}

const dashDamageApi = {
  computeDashStrikeDamage
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = dashDamageApi;
}

if (typeof globalThis !== "undefined") {
  globalThis.dashDamageApi = dashDamageApi;
}
