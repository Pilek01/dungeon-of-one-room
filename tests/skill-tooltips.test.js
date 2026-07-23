const assert = require("node:assert/strict");

const {
  buildDashTooltip,
  buildShockwaveTooltip,
  buildShieldTooltip
} = require("../skill-tooltips.js");

function run() {
  {
    const tooltip = buildDashTooltip({
      name: "Dash",
      tierLabel: "Legendary",
      currentDamage: 180,
      firstHitDamage: 288,
      splashDamage: 108,
      range: 4,
      cooldownOnCast: 10,
      afterlineText: "40% ATK for 4 turns",
      tierLines: [
        "Base: 3-tile pierce + knockback",
        "Rare: +100% dash damage",
        "Epic: Range +1 and landing splash damage",
        "Legendary: First hit +60% damage. Leaves afterline for 4 turns (40% ATK)."
      ]
    });
    assert.match(tooltip, /Current cast: 180 dmg \| Range 4/);
    assert.match(tooltip, /Legendary first hit: 288 dmg/);
    assert.match(tooltip, /Landing splash: 108 dmg/);
    assert.match(tooltip, /Cooldown on cast: 10 combat turns/);
    assert.match(tooltip, /Afterline: 40% ATK for 4 turns/);
  }

  {
    const tooltip = buildShockwaveTooltip({
      name: "Shockwave",
      tierLabel: "Legendary",
      currentFury: 3,
      ring1Damage: 240,
      ring2Damage: 160,
      radius: 2,
      cooldownOnCast: 25,
      knockback: true,
      disorientTurns: 2,
      tierLines: [
        "Base: Base 60% damage, +20% per Fury spent",
        "Rare: Damage x1.5 + knockback",
        "Epic: Radius 2 with falloff (ring1 100%, ring2 70%)",
        "Legendary: Overload Wave: ring1 120%, ring2 80%. Ring1 disorients for 2 turns."
      ]
    });
    assert.match(tooltip, /Current Fury: 3/);
    assert.match(tooltip, /ring1 240 dmg \| ring2 160 dmg/);
    assert.match(tooltip, /Effects: knockback, ring1 disorient 2T/);
  }

  {
    const tooltip = buildShieldTooltip({
      name: "Shield",
      tierLabel: "Legendary",
      shieldAmount: 250,
      decayPercent: 20,
      chargeText: "2/2 (+1 in 20T)",
      legendaryArmorBonus: 50,
      reflectPercent: 35,
      storePercent: 25,
      storeCap: 160,
      blastRing1Percent: 70,
      blastRing2Percent: 40,
      currentStoredDamage: 90,
      currentBlastRing1: 63,
      currentBlastRing2: 36,
      tierLines: [
        "Base: 100% Max HP shield. Decays 20% each combat turn.",
        "Rare: Shield is 25% bigger. Cast pushes nearby enemies.",
        "Epic: 2 charges. One charge returns every 20 combat turns. Melee hits trigger counter damage.",
        "Legendary: Aegis Counter stores absorbed damage, explodes when Shield ends, and grants +50 ARM while active."
      ]
    });
    assert.match(tooltip, /Current cast: 250 shield/);
    assert.match(tooltip, /While active: \+50 ARM/);
    assert.match(tooltip, /Stored now: 90 -> blast 63 \/ 36/);
  }

  {
    const tooltip = buildShieldTooltip({
      name: "Shield",
      tierLabel: "Rare",
      shieldAmount: 250,
      fracturedBarrierAmount: 150,
      fracturedSigilActive: true,
      chargeText: "",
      tierLines: [
        "Base: 100% Max HP shield. Decays 20% each combat turn.",
        "Rare: Shield is 25% bigger. Cast pushes nearby enemies."
      ]
    });
    assert.match(tooltip, /Current cast: 150 barrier \(from 250 shield\)/);
    assert.match(tooltip, /Fractured Sigil: Shield becomes persistent barrier/);
  }

  console.log("skill-tooltips tests: OK");
}

run();
