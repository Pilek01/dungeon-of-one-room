const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  getBossProfile,
  getFinalBossPhaseProfile,
  getBossEncounterProfile,
  getBossAddProfile
} = require("../boss-campaign.js");

function run() {
  {
    assert.deepEqual(getBossAddProfile(5), { count: 0, eliteCount: 0 });
    assert.deepEqual(getBossAddProfile(10), { count: 2, eliteCount: 0 });
    assert.deepEqual(getBossAddProfile(15), { count: 2, eliteCount: 1 });
    assert.deepEqual(getBossAddProfile(20), { count: 2, eliteCount: 2 });
    assert.deepEqual(getBossAddProfile(40, 3), { count: 3, eliteCount: 3 });
  }

  {
    const first = getBossEncounterProfile(5);
    const laterGate = getBossEncounterProfile(10);
    assert.equal(first.id, "descent");
    assert.equal(first.hpMultiplier, 0.8);
    assert.equal(first.attackMultiplier, 0.9);
    assert.equal(first.pulseDamageMultiplier, laterGate.pulseDamageMultiplier);
    assert.equal(first.burstDamageMultiplier, laterGate.burstDamageMultiplier);
    assert.equal(laterGate.hpMultiplier, 1);
    assert.equal(laterGate.attackMultiplier, 1);

    const gameSource = fs.readFileSync(
      path.resolve(__dirname, "..", "game.js"),
      "utf8"
    );
    assert.match(
      gameSource,
      /hpMultiplier\) \|\| 1\)/
    );
    assert.doesNotMatch(
      gameSource,
      /Math\.max\(1, Number\(bossProfile\?\.hpMultiplier\)/
    );
    assert.doesNotMatch(
      gameSource,
      /Math\.max\(1, Number\(bossProfile\?\.attackMultiplier\)/
    );
  }

  {
    const profile = getBossProfile(5);
    assert.equal(profile.id, "descent");
    assert.equal(profile.name, "Gate Warden");
    assert.equal(profile.voidAegisEnabled, false);
    assert.equal(profile.abilitySet, "gate");
    assert.equal(profile.usesLegacyPulse, true);
  }

  {
    const profile = getBossProfile(25);
    assert.equal(profile.id, "corruption");
    assert.equal(profile.smartAi, true);
    assert.ok(profile.burstCooldown <= 6);
    assert.equal(profile.voidAegisEnabled, false);
  }

  {
    const profile = getBossProfile(45);
    assert.equal(profile.id, "rupture");
    assert.equal(profile.voidAegisEnabled, true);
    assert.ok(profile.hpMultiplier > 1);
  }

  {
    const collapse = getBossProfile(65);
    const endgame = getBossProfile(85);
    assert.equal(collapse.abilitySet, "collapse");
    assert.equal(endgame.abilitySet, "abyssal");
    assert.equal(collapse.usesLegacyPulse, false);
    assert.equal(collapse.latticeCooldown, 5);
    assert.equal(collapse.latticeDetonationDelayTurns, 2);
    assert.equal(collapse.latticeCastCount, 1);
    assert.equal(endgame.latticeCooldown, 5);
    assert.equal(endgame.latticeDetonationDelayTurns, 2);
    assert.equal(endgame.latticeCastCount, 2);
    assert.equal(endgame.latticeDoubleLine, false);
    assert.ok(endgame.attackMultiplier >= collapse.attackMultiplier);
    assert.ok(endgame.burstDamageMultiplier >= collapse.burstDamageMultiplier);
    assert.ok(endgame.burstRange >= collapse.burstRange);
  }

  {
    const phase1 = getFinalBossPhaseProfile(1);
    const phase2 = getFinalBossPhaseProfile(2);
    assert.ok(phase2.hpMultiplier > phase1.hpMultiplier);
    assert.ok(phase2.attackMultiplier > phase1.attackMultiplier);
    assert.ok(phase2.burstDamageMultiplier > phase1.burstDamageMultiplier);
    assert.ok(phase2.pulseCooldown <= phase1.pulseCooldown);
    assert.equal(phase1.abilitySet, "abyssal");
    assert.equal(phase1.latticeCooldown, 5);
    assert.equal(phase1.latticeDetonationDelayTurns, 2);
    assert.equal(phase1.latticeCastCount, 2);
    assert.equal(phase1.latticeDoubleLine, false);
    assert.equal(phase2.abilitySet, "reborn");
    assert.equal(phase2.doomSigilCount, 3);
    assert.equal(phase2.doomSigilCooldown, 5);
  }

  {
    const normal = getBossEncounterProfile(85, 2);
    const final = getBossEncounterProfile(100, 2);
    assert.equal(normal.id, "endgame");
    assert.equal(final.phase, 2);
    assert.equal(final.name, "Abyssal Warden Reborn");
  }

  console.log("boss-campaign tests: OK");
}

run();
