const assert = require("node:assert/strict");
const {
  applyPersistentPactEffects,
  applySinglePactEffect,
  removeSinglePactEffect
} = require("../pact-effects.js");

function makePlayer() {
  return {
    crit: 0.1,
    maxHp: 100,
    hp: 100,
    armor: 5,
    attack: 20,
    maxAdrenaline: 3,
    adrenaline: 3
  };
}

function run() {
  {
    const player = makePlayer();
    applyPersistentPactEffects(player, ["precision"], { critCap: 0.55, minEffectiveDamage: 1 });
    assert.equal(player.crit, 0.22);
    assert.equal(player.maxHp, 75);
    assert.equal(player.hp, 75);
  }

  {
    const player = makePlayer();
    applySinglePactEffect(player, "blood", { critCap: 0.55, minEffectiveDamage: 1 });
    assert.equal(player.attack, 16);
    applySinglePactEffect(player, "precision", { critCap: 0.55, minEffectiveDamage: 1 });
    assert.equal(player.attack, 16, "adding precision after blood must not reapply blood attack penalty");
    assert.equal(player.crit, 0.22, "precision should use final pact value");
    assert.equal(player.maxHp, 75, "precision should reduce max HP by 25%");
  }

  {
    const player = makePlayer();
    applyPersistentPactEffects(player, ["precision", "blood"], { critCap: 0.55, minEffectiveDamage: 1 });
    assert.equal(player.crit, 0.22);
    assert.equal(player.maxHp, 75);
    assert.equal(player.hp, 75);
    assert.equal(player.attack, 16);
    assert.equal(player.armor, 5);
    assert.equal(player.maxAdrenaline, 3);
    assert.equal(player.adrenaline, 3);
  }

  {
    const player = makePlayer();
    applySinglePactEffect(player, "precision", { critCap: 0.55, minEffectiveDamage: 1 });
    removeSinglePactEffect(player, "precision", { critCap: 0.55, minEffectiveDamage: 1, basePlayer: makePlayer() });
    assert.equal(player.crit, 0.1);
    assert.equal(player.maxHp, 100);
    assert.equal(player.hp, 75);
  }

  {
    const player = makePlayer();
    applySinglePactEffect(player, "blood", { critCap: 0.55, minEffectiveDamage: 1 });
    removeSinglePactEffect(player, "blood", { critCap: 0.55, minEffectiveDamage: 1, basePlayer: makePlayer() });
    assert.equal(player.attack, 20);
  }

  {
    const player = makePlayer();
    applySinglePactEffect(player, "iron", { critCap: 0.55, minEffectiveDamage: 1 });
    removeSinglePactEffect(player, "iron", { critCap: 0.55, minEffectiveDamage: 1, basePlayer: makePlayer() });
    assert.equal(player.armor, 5);
    assert.equal(player.attack, 20);
    assert.equal(player.maxAdrenaline, 3);
    assert.equal(player.adrenaline, 3);
  }

  {
    const player = makePlayer();
    applySinglePactEffect(player, "chains", { chainsArmorBonus: 20, minEffectiveDamage: 1 });
    assert.equal(player.armor, 25);
    removeSinglePactEffect(player, "chains", { basePlayer: makePlayer() });
    assert.equal(player.armor, 5);
  }

  console.log("pact-effects tests: OK");
}

run();
