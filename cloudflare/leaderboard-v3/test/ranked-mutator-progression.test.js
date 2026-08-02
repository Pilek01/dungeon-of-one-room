import assert from "node:assert/strict";
import test from "node:test";
import {
  MUTATOR_PROGRESS_VERSION,
  applyMutatorProgressDeltaV08,
  applyPracticeMutatorImportV08,
  createEmptyMutatorProgressV08,
  normalizeMutatorProgressV08,
  resetMutatorCampaignProgressV08
} from "../src/rulesets/v08-meta-1/mutator-progression.js";

const CASES = Object.freeze([
  ["berserker", "totalKills", 200],
  ["bulwark", "depthHighscore", 15],
  ["alchemist", "totalMerchantPots", 25],
  ["greed", "totalGoldEarned", 12_000],
  ["hunter", "eliteKills", 90],
  ["resilience", "shieldUsesThisGame", 60],
  ["momentum", "depthHighscore", 20],
  ["famine", "potionFreeExtract", 1],
  ["elitist", "eliteKills", 250],
  ["ascension", "depthHighscore", 30]
]);

test("Online Ranked uses every exact Practice mutator threshold", () => {
  for (const [mutatorId, metric, threshold] of CASES) {
    const below = applyMutatorProgressDeltaV08(
      createEmptyMutatorProgressV08(),
      { [metric]: threshold - 1 }
    );
    assert.equal(below.unlockedMutatorIds.includes(mutatorId), false, `${mutatorId} below threshold`);

    const exact = applyMutatorProgressDeltaV08(
      createEmptyMutatorProgressV08(),
      { [metric]: threshold }
    );
    assert.equal(exact.unlockedMutatorIds.includes(mutatorId), true, `${mutatorId} exact threshold`);
  }
});

test("progress IDs are stable, sorted, allowlisted, and counters never decrease", () => {
  const progressed = applyMutatorProgressDeltaV08(createEmptyMutatorProgressV08(), {
    totalKills: 200,
    depthHighscore: 30,
    totalGoldEarned: 12_000
  });
  assert.deepEqual(progressed.unlockedMutatorIds, [
    "ascension",
    "berserker",
    "bulwark",
    "greed",
    "momentum"
  ]);
  assert.throws(
    () => applyMutatorProgressDeltaV08(progressed, { totalKills: 199 }),
    /MUTATOR_PROGRESS_DECREASE/u
  );
  assert.throws(
    () => applyMutatorProgressDeltaV08(progressed, { totalKills: -1 }),
    /MUTATOR_PROGRESS_COUNTER_INVALID/u
  );
});

test("Practice import is consumed once and recomputes unlocks from metrics", () => {
  const imported = applyPracticeMutatorImportV08(createEmptyMutatorProgressV08(), {
    metrics: {
      totalKills: 200,
      eliteKills: 90,
      depthHighscore: 15,
      totalGoldEarned: 0,
      totalMerchantPots: 0,
      shieldUsesThisGame: 0,
      potionFreeExtract: 0
    },
    historicalUnlockedMutatorIds: ["resilience"]
  }, { importedAt: 1_900_000_000_000 });

  assert.equal(imported.importConsumed, true);
  assert.equal(imported.importedAt, 1_900_000_000_000);
  assert.deepEqual(imported.unlockedMutatorIds, [
    "berserker",
    "bulwark",
    "hunter",
    "resilience"
  ]);
  assert.throws(
    () => applyPracticeMutatorImportV08(imported, { metrics: {} }),
    /MUTATOR_PRACTICE_IMPORT_CONSUMED/u
  );
});

test("Practice import rejects unknown IDs and does not trust historical flags except Resilience", () => {
  assert.throws(
    () => applyPracticeMutatorImportV08(createEmptyMutatorProgressV08(), {
      metrics: {},
      historicalUnlockedMutatorIds: ["unknown"]
    }),
    /MUTATOR_IMPORT_ID_UNKNOWN/u
  );
  const imported = applyPracticeMutatorImportV08(createEmptyMutatorProgressV08(), {
    metrics: {},
    historicalUnlockedMutatorIds: ["greed", "resilience"]
  });
  assert.deepEqual(imported.unlockedMutatorIds, ["resilience"]);
});

test("legacy progression includes active modifiers and normalizes safely", () => {
  const normalized = normalizeMutatorProgressV08(undefined, {
    activeModifierIds: ["greed", "berserker"]
  });
  assert.equal(normalized.progressVersion, MUTATOR_PROGRESS_VERSION);
  assert.deepEqual(normalized.unlockedMutatorIds, ["berserker", "greed"]);
  assert.equal(normalized.importConsumed, false);
});

test("fresh campaign reset clears counters and unlocks but preserves import receipt", () => {
  const imported = applyPracticeMutatorImportV08(createEmptyMutatorProgressV08(), {
    metrics: { totalKills: 200 },
    historicalUnlockedMutatorIds: []
  }, { importedAt: 123 });
  const reset = resetMutatorCampaignProgressV08(imported);
  assert.equal(reset.totalKills, 0);
  assert.deepEqual(reset.unlockedMutatorIds, []);
  assert.equal(reset.importConsumed, true);
  assert.equal(reset.importedAt, 123);
});
