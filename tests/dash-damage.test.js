const assert = require("node:assert/strict");
const { computeDashStrikeDamage } = require("../dash-damage.js");

function run() {
  {
    const base = computeDashStrikeDamage({
      attack: 100,
      scaledBonus: 10,
      furyMult: 1,
      dashRelicMult: 1,
      pactSkillMult: 1,
      dashTier: 0,
      minDamage: 1
    });
    assert.equal(base, 55);
  }

  {
    const rare = computeDashStrikeDamage({
      attack: 100,
      scaledBonus: 10,
      furyMult: 1,
      dashRelicMult: 1,
      pactSkillMult: 1,
      dashTier: 1,
      minDamage: 1
    });
    assert.equal(rare, 110);
  }

  {
    const scaled = computeDashStrikeDamage({
      attack: 200,
      scaledBonus: 8,
      furyMult: 1.2,
      dashRelicMult: 1.1,
      pactSkillMult: 1.25,
      dashTier: 2,
      minDamage: 1
    });
    assert.equal(scaled, 344);
  }

  console.log("dash-damage tests: OK");
}

run();
