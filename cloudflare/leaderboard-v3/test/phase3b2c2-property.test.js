import test from "node:test";
import assert from "node:assert/strict";
import catalogDocument from "../src/rulesets/v08-meta-1/data/relic-catalog.generated.json" with { type: "json" };
import {
  applyRelicAcquisition,
  applyRelicReplacementBuildV08,
  assertCanonicalRelicBuildV08,
  canAcquireRelic,
  createEmptyRelicBuildV08,
  getRelicCatalogEntryV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import {
  createPendingRelicTransactionV08,
  evaluateRelicAcquisition
} from "../src/rulesets/v08-meta-1/relic-replacement.js";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";

const catalog = catalogDocument.canonicalData.relics;
const context = Object.freeze({
  runId: "property-run",
  secret: "phase3b2c2-property:0123456789abcdef0123456789abcdef"
});

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function metaState(runId) {
  const state = createInitialMetaStateV08({}, {
    runId,
    season: "season-phase3b2c2",
    startedAt: 1_700_000_500_000
  });
  state.status = "active";
  return state;
}

async function randomLegalBuild(seed) {
  const rng = random(seed);
  let build = createEmptyRelicBuildV08();
  const attempts = 8 + Math.floor(rng() * 18);
  for (let index = 0; index < attempts; index += 1) {
    const relic = catalog[Math.floor(rng() * catalog.length)];
    if (!canAcquireRelic(build, relic.relicId).allowed) continue;
    build = await applyRelicAcquisition(build, {
      relicId: relic.relicId,
      acquiredRevision: index,
      acquisitionSource: "property",
      sourceOfferId: `property_${seed}_${index}`
    });
  }
  return build;
}

function acquisitionSource(relic) {
  for (const source of ["boss_drop", "otter", "relic_draft"]) {
    if (relic.acquisitionSources.includes(source)) return source;
  }
  return relic.acquisitionSources[0];
}

test("5000 seeded legal build/incoming combinations preserve every replacement invariant", async () => {
  let cases = 0;
  let direct = 0;
  let replacement = 0;
  let rejected = 0;
  for (let buildSeed = 1; buildSeed <= 125; buildSeed += 1) {
    const build = await randomLegalBuild(buildSeed);
    for (let incomingIndex = 0; incomingIndex < 40; incomingIndex += 1) {
      const relic = catalog[(buildSeed * 37 + incomingIndex * 13) % catalog.length];
      const meta = metaState(`property_${buildSeed}_${incomingIndex}`);
      meta.build = structuredClone(build);
      const before = structuredClone(meta);
      const acquisition = {
        incomingRelicId: relic.relicId,
        incomingStacks: 1,
        acquisitionSource: acquisitionSource(relic),
        sourceOfferId: `offer_${buildSeed}_${incomingIndex}`,
        sourceChoiceId: `choice_${buildSeed}_${incomingIndex}`,
        sourceRewardSlotId: `slot_${buildSeed}_${incomingIndex}`
      };
      const decision = await evaluateRelicAcquisition(meta, acquisition, context);
      assert.deepEqual(meta, before);
      if (decision.decision === "ACQUIRE_DIRECT") {
        direct += 1;
        const resulting = await applyRelicAcquisition(build, {
          relicId: relic.relicId,
          acquiredRevision: meta.revision,
          acquisitionSource: acquisition.acquisitionSource,
          sourceOfferId: acquisition.sourceOfferId
        });
        assertCanonicalRelicBuildV08(resulting);
        assert.ok(resulting.relicSlotsUsed <= resulting.relicSlotLimit);
      } else if (decision.decision === "REQUIRE_REPLACEMENT") {
        replacement += 1;
        assert.ok(decision.candidatePlans.length > 0);
        for (const candidate of decision.candidatePlans) {
          const resulting = await applyRelicReplacementBuildV08(
            build,
            candidate.removals.map((removal) => ({
              relicId: removal.relicId,
              stacks: -removal.targetStackDelta
            })),
            {
              relicId: relic.relicId,
              stacks: 1,
              acquiredRevision: meta.revision,
              acquisitionSource: acquisition.acquisitionSource,
              sourceOfferId: acquisition.sourceOfferId
            }
          );
          assertCanonicalRelicBuildV08(resulting);
          assert.equal(resulting.buildDigest, candidate.resultingBuildDigest);
          assert.ok(resulting.relicSlotsUsed <= resulting.relicSlotLimit);
          const legendaryCount = resulting.relics.filter(
            (entry) => getRelicCatalogEntryV08(entry.relicId).legendary
          ).length;
          const mythicCount = resulting.relics.filter(
            (entry) => getRelicCatalogEntryV08(entry.relicId).mythic
          ).length;
          assert.ok(legendaryCount <= (
            resulting.relics.some((entry) => entry.relicId === "crownconcord") ? 2 : 1
          ));
          assert.ok(mythicCount <= 1);
        }
        if (replacement <= 100) {
          const transaction = await createPendingRelicTransactionV08(
            meta,
            decision,
            { ...context, runId: meta.runId }
          );
          assert.equal(transaction.incoming.relicId, undefined);
          assert.equal(transaction.incoming.incomingRelicId, relic.relicId);
          assert.ok(transaction.candidates.every((candidate) =>
            /^replace_[a-f0-9]{32}$/u.test(candidate.replacementChoiceId)
          ));
        }
      } else {
        rejected += 1;
        assert.ok(decision.code);
      }
      assert.equal(meta.gold, before.gold);
      assert.equal(meta.lives, before.lives);
      assert.equal(meta.depth, before.depth);
      assert.deepEqual(meta.runModifiers, before.runModifiers);
      cases += 1;
    }
  }
  assert.equal(cases, 5000);
  assert.ok(direct > 0);
  assert.ok(replacement > 0);
  assert.ok(rejected > 0);
  console.info(
    `Phase 3B2C2 property cases: ${cases} (direct ${direct}, replacement ${replacement}, reject ${rejected})`
  );
});
