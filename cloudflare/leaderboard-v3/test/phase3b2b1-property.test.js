import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  issueStartingRelicOfferV08,
  selectStartingRelic
} from "../src/rulesets/v08-meta-1/starting-relic-offer.js";
import {
  applyRelicAcquisition,
  assertCanonicalRelicBuildV08,
  canAcquireRelic,
  createEmptyRelicBuildV08,
  projectPublicBuild,
  V08_RELIC_POLICY_DATA
} from "../src/rulesets/v08-meta-1/relic-policy.js";

function oracle(seed) {
  return {
    async deriveRandomBytes(options) {
      const output = new Uint8Array(options.length);
      let offset = 0;
      let block = 0;
      while (offset < output.length) {
        const digest = createHash("sha256")
          .update(`${seed}|${options.runId}|${options.revision}|${options.purpose}|${options.counter}|${block}`)
          .digest();
        const take = Math.min(digest.length, output.length - offset);
        output.set(digest.subarray(0, take), offset);
        offset += take;
        block += 1;
      }
      return output;
    }
  };
}

function context(seed) {
  return {
    runId: `property_3b2b1_${seed}`,
    season: "season-phase3b2b1-property",
    startedAt: 1_700_000_000_000 + seed,
    randomOracle: oracle(seed)
  };
}

test("property: 1000 seeded starting offers are deterministic, opaque and select exactly once", async () => {
  const observedOfferIds = new Set();
  for (let seed = 1; seed <= 1_000; seed += 1) {
    const resolvedContext = context(seed);
    const initial = createInitialMetaStateV08({ startDepth: 0 }, resolvedContext);
    const first = await issueStartingRelicOfferV08(initial, resolvedContext);
    const second = await issueStartingRelicOfferV08(initial, resolvedContext);
    assert.deepEqual(second, first);
    assert.equal(first.currentRoomDirective, null);
    assert.equal(first.pendingOffer.choices.length, 3);
    assert.equal(new Set(first.pendingOffer.choices.map((choice) => choice.choiceId)).size, 3);
    assert.equal(JSON.stringify(first.pendingOffer.publicChoices).includes("privateRelicId"), false);
    assert.ok(!observedOfferIds.has(first.pendingOffer.offerId));
    observedOfferIds.add(first.pendingOffer.offerId);

    const selectedChoice = first.pendingOffer.choices[seed % 3];
    const selected = await selectStartingRelic(first, {
      offerId: first.pendingOffer.offerId,
      choiceId: selectedChoice.choiceId
    }, resolvedContext);
    assert.equal(selected.status, "active");
    assert.equal(selected.revision, 1);
    assert.equal(selected.pendingOffer, null);
    assert.equal(selected.build.totalRelicStacks, 1);
    assert.equal(selected.build.relics[0].relicId, selectedChoice.privateRelicId);
    assertCanonicalRelicBuildV08(selected.build);
    const retry = await selectStartingRelic(selected, {
      offerId: first.pendingOffer.offerId,
      choiceId: selectedChoice.choiceId
    }, resolvedContext);
    assert.deepEqual(retry, selected);
  }
  assert.equal(observedOfferIds.size, 1_000);
});

test("property: every catalog acquisition preserves stack, slot, unique, mythic and projection invariants", async () => {
  const catalog = V08_RELIC_POLICY_DATA.catalog.relics;
  for (let seed = 1; seed <= 1_000; seed += 1) {
    let build = createEmptyRelicBuildV08();
    for (let step = 0; step < 20; step += 1) {
      const relic = catalog[(seed * 17 + step * 31) % catalog.length];
      const verdict = canAcquireRelic(build, relic.relicId);
      if (!verdict.allowed) continue;
      build = await applyRelicAcquisition(build, {
        relicId: relic.relicId,
        acquiredRevision: step,
        acquisitionSource: "property",
        sourceOfferId: `property_${seed}_${step}`
      });
      assertCanonicalRelicBuildV08(build);
      assert.ok(build.relicSlotsUsed <= build.relicSlotLimit);
      assert.equal(
        build.totalRelicStacks,
        build.relics.reduce((sum, entry) => sum + entry.stacks, 0)
      );
      assert.equal(new Set(build.relics.map((entry) => entry.relicId)).size, build.uniqueRelicCount);
      for (const entry of build.relics) {
        const policy = catalog.find((candidate) => candidate.relicId === entry.relicId);
        assert.ok(entry.stacks <= policy.maximumStacks);
      }
      assert.equal(
        build.relics.filter((entry) => (
          catalog.find((candidate) => candidate.relicId === entry.relicId)?.mythic
        )).length <= 1,
        true
      );
      const publicBuild = projectPublicBuild(build);
      assert.equal(JSON.stringify(publicBuild).includes("sourceOfferId"), false);
      assert.equal(JSON.stringify(publicBuild).includes("acquiredRevision"), false);
    }
  }
});
