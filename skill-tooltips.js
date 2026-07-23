(function () {
  function toInt(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  }

  function normalizeTierLines(input) {
    return Array.isArray(input)
      ? input.filter((line) => typeof line === "string" && line.trim().length > 0)
      : [];
  }

  function buildDashTooltip(data = {}) {
    const tierLines = normalizeTierLines(data.tierLines);
    const lines = [
      `${data.name || "Dash"} [${data.tierLabel || "Base"}]`,
      `Current cast: ${toInt(data.currentDamage)} dmg | Range ${toInt(data.range, 3)}`
    ];
    if (toInt(data.firstHitDamage) > toInt(data.currentDamage)) {
      lines.push(`Legendary first hit: ${toInt(data.firstHitDamage)} dmg`);
    }
    if (toInt(data.splashDamage) > 0) {
      lines.push(`Landing splash: ${toInt(data.splashDamage)} dmg`);
    }
    lines.push(`Cooldown on cast: ${toInt(data.cooldownOnCast, 0)} combat turns`);
    lines.push("Effects: pierce, knockback");
    if (data.afterlineText) {
      lines.push(`Afterline: ${data.afterlineText}`);
    }
    if (tierLines.length > 0) {
      lines.push("Tiers:");
      lines.push(...tierLines);
    }
    return lines.join("\n");
  }

  function buildShockwaveTooltip(data = {}) {
    const tierLines = normalizeTierLines(data.tierLines);
    const lines = [
      `${data.name || "Shockwave"} [${data.tierLabel || "Base"}]`,
      `Current Fury: ${toInt(data.currentFury, 0)}`
    ];
    if (toInt(data.radius, 1) >= 2) {
      lines.push(`Current cast: ring1 ${toInt(data.ring1Damage)} dmg | ring2 ${toInt(data.ring2Damage)} dmg`);
    } else {
      lines.push(`Current cast: ${toInt(data.ring1Damage)} dmg`);
    }
    lines.push(`Cooldown on cast: ${toInt(data.cooldownOnCast, 0)} combat turns`);
    const effects = [];
    if (data.knockback) effects.push("knockback");
    if (toInt(data.disorientTurns, 0) > 0) effects.push(`ring1 disorient ${toInt(data.disorientTurns)}T`);
    if (effects.length > 0) {
      lines.push(`Effects: ${effects.join(", ")}`);
    }
    if (tierLines.length > 0) {
      lines.push("Tiers:");
      lines.push(...tierLines);
    }
    return lines.join("\n");
  }

  function buildShieldTooltip(data = {}) {
    const tierLines = normalizeTierLines(data.tierLines);
    const currentCastLine = data.fracturedSigilActive
      ? `Current cast: ${toInt(data.fracturedBarrierAmount)} barrier (from ${toInt(data.shieldAmount)} shield)`
      : `Current cast: ${toInt(data.shieldAmount)} shield`;
    const lines = [
      `${data.name || "Shield"} [${data.tierLabel || "Base"}]`,
      currentCastLine
    ];
    lines.push(
      data.fracturedSigilActive
        ? "Fractured Sigil: Shield becomes persistent barrier"
        : `Decay: ${toInt(data.decayPercent, 20)}% each combat turn`
    );
    if (data.chargeText) {
      lines.push(`Charges: ${data.chargeText}`);
    } else {
      lines.push(`Cooldown on cast: ${toInt(data.cooldownOnCast, 0)} combat turns`);
    }
    if (toInt(data.legendaryArmorBonus, 0) > 0) {
      lines.push(`While active: +${toInt(data.legendaryArmorBonus)} ARM`);
    }
    if (toInt(data.reflectPercent, 0) > 0) {
      lines.push(`Melee reflect: ${toInt(data.reflectPercent)}% of absorbed shield damage`);
    }
    if (toInt(data.storePercent, 0) > 0) {
      lines.push(
        `Aegis Counter: stores ${toInt(data.storePercent)}% (cap ${toInt(data.storeCap)}) | blast ${toInt(data.blastRing1Percent)}% / ${toInt(data.blastRing2Percent)}%`
      );
    }
    if (toInt(data.currentStoredDamage, 0) > 0) {
      lines.push(
        `Stored now: ${toInt(data.currentStoredDamage)} -> blast ${toInt(data.currentBlastRing1)} / ${toInt(data.currentBlastRing2)}`
      );
    }
    if (tierLines.length > 0) {
      lines.push("Tiers:");
      lines.push(...tierLines);
    }
    return lines.join("\n");
  }

  const api = {
    buildDashTooltip,
    buildShockwaveTooltip,
    buildShieldTooltip
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonSkillTooltips = api;
  }
})();
