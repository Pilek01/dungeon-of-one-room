import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assertRegularRelicOfferV08,
  createV08Meta1Ruleset,
  issueRegularRelicOffer,
  selectRegularRelic
} from "../src/rulesets/v08-meta-1/index.js";
import {
  assertCanonicalRelicBuildV08,
  canAcquireRelic,
  V08_RELIC_POLICY_DATA
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import rarityDocument from "../src/rulesets/v08-meta-1/data/relic-rarity-policy.generated.json" with { type: "json" };

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
    },
    async deriveIntInclusive(minimum, maximum, options) {
      if (options.purpose === "relic-offer-drop") return minimum;
      const digest = createHash("sha256")
        .update(`${seed}|${options.runId}|${options.revision}|${options.purpose}|${options.counter}`)
        .digest();
      return minimum + digest.readUInt32BE(0) % (maximum - minimum + 1);
    }
  };
}

function context(seed) {
  return {
    runId: `property_3b2b2a_${seed}`,
    season: "season-phase3b2b2a-property",
    startedAt: 1_700_000_200_000 + seed,
    elapsedMs: 1_000,
    randomOracle: oracle(seed)
  };
}

async function bossState(seed) {
  const resolvedContext = context(seed);
  const resolvedRuleset = createV08Meta1Ruleset({ randomOracle: resolvedContext.randomOracle });
  let state = await resolvedRuleset.createRun({ startDepth: 0 }, resolvedContext);
  state = await resolvedRuleset.selectStartingRelic(state, {
    offerId: state.pendingOffer.offerId,
    choiceId: state.pendingOffer.choices[seed % 3].choiceId
  }, resolvedContext);
  const tiers = [5, 10, 15, 20, 25, 30, 45, 60, 75, 95];
  const depth = tiers[seed % tiers.length];
  state.depth = depth - 1;
  state.roomIndex = depth - 1;
  state.currentRoomDirective = null;
  state.currentRewardEnvelope = null;
  state = await resolvedRuleset.issueRoomDirective(state, resolvedContext);
  return { state, resolvedRuleset, resolvedContext };
}

function requestFor(state) {
  return {
    rewardEnvelopeId: state.currentRewardEnvelope.envelopeId,
    rewardSlotId: state.currentRewardEnvelope.rewardSlots[0].slotId,
    sourceDirectiveId: state.currentRoomDirective.directiveId
  };
}

test("property: 5000 seeded standard Warden offers preserve every regular-offer invariant", async () => {
  const catalog = new Map(
    V08_RELIC_POLICY_DATA.catalog.relics.map((entry) => [entry.relicId, entry])
  );
  const observedOfferIds = new Set();
  for (let seed = 1; seed <= 5_000; seed += 1) {
    const prepared = await bossState(seed);
    const before = structuredClone(prepared.state);
    const request = requestFor(prepared.state);
    const issued = await issueRegularRelicOffer(
      prepared.state,
      request,
      prepared.resolvedContext
    );
    const retry = await issueRegularRelicOffer(
      issued,
      request,
      prepared.resolvedContext
    );
    assert.deepEqual(retry, issued);
    assert.equal(issued.gold, before.gold);
    assert.equal(issued.lives, before.lives);
    assert.equal(issued.depth, before.depth);
    assert.deepEqual(issued.build, before.build);

    const offer = issued.pendingOffer;
    assertRegularRelicOfferV08(offer);
    assert.ok(offer.choices.length >= 1 && offer.choices.length <= 3);
    assert.equal(new Set(offer.choices.map((choice) => choice.choiceId)).size, offer.choices.length);
    assert.equal(
      new Set(offer.choices.map((choice) => choice.privateRelicId)).size,
      offer.choices.length
    );
    assert.equal(offer.runId, issued.runId);
    assert.equal(offer.rulesetHash, issued.rulesetHash);
    assert.equal(offer.issuedRevision, issued.revision);
    assert.equal(offer.sourceDirectiveId, issued.currentRoomDirective.directiveId);
    assert.equal(offer.rewardEnvelopeId, issued.currentRewardEnvelope.envelopeId);
    assert.equal(offer.rewardSlotId, issued.currentRewardEnvelope.rewardSlots[0].slotId);
    assert.equal(issued.currentRewardEnvelope.rewardSlots[0].offerId, offer.offerId);
    assert.equal(issued.currentRewardEnvelope.rewardSlots[0].consumed, false);
    assert.ok(!observedOfferIds.has(offer.offerId));
    observedOfferIds.add(offer.offerId);

    const tier = rarityDocument.canonicalData.rarityTiers.find(
      (entry) => issued.depth + 1 >= entry.minDepth && issued.depth + 1 <= entry.maxDepth
    );
    const unlocked = new Set(
      Object.entries(tier.rarityWeights)
        .filter(([, weight]) => weight > 0)
        .map(([rarity]) => rarity)
    );
    if (tier.mythicEligible) unlocked.add("mythic");
    for (let index = 0; index < offer.choices.length; index += 1) {
      const privateChoice = offer.choices[index];
      const publicChoice = offer.publicChoices[index];
      const relic = catalog.get(privateChoice.privateRelicId);
      assert.ok(relic);
      assert.ok(unlocked.has(relic.rarity));
      assert.ok(relic.acquisitionSources.includes("boss_drop"));
      assert.equal(canAcquireRelic(before.build, relic.relicId).allowed, true);
      assert.equal(publicChoice.choiceId, privateChoice.choiceId);
      assert.equal(publicChoice.relicId, relic.relicId);
      assert.equal(publicChoice.rarity, relic.rarity);
      assert.ok(publicChoice.resultingSlotsUsed <= publicChoice.resultingSlotLimit);
    }

    const choice = offer.choices[seed % offer.choices.length];
    const selection = { offerId: offer.offerId, choiceId: choice.choiceId };
    const selected = await selectRegularRelic(issued, selection, prepared.resolvedContext);
    assertCanonicalRelicBuildV08(selected.build);
    assert.equal(selected.build.relicSlotsUsed <= selected.build.relicSlotLimit, true);
    assert.equal(selected.currentRewardEnvelope.rewardSlots[0].consumed, true);
    assert.equal(selected.pendingOffer, null);
    assert.equal(selected.gold, issued.gold);
    assert.equal(selected.lives, issued.lives);
    assert.equal(selected.depth, issued.depth);
    const selectedRetry = await selectRegularRelic(
      selected,
      selection,
      prepared.resolvedContext
    );
    assert.deepEqual(selectedRetry, selected);
    assert.deepEqual(JSON.parse(JSON.stringify(selected)), selected);
  }
  assert.equal(observedOfferIds.size, 5_000);
});

test("property: illegal client selection never changes gold, lives, depth, build, slot or pity", async () => {
  for (let seed = 1; seed <= 250; seed += 1) {
    const prepared = await bossState(10_000 + seed);
    const issued = await issueRegularRelicOffer(
      prepared.state,
      requestFor(prepared.state),
      prepared.resolvedContext
    );
    const snapshot = structuredClone(issued);
    await assert.rejects(
      selectRegularRelic(issued, {
        offerId: issued.pendingOffer.offerId,
        choiceId: issued.pendingOffer.choices[0].choiceId,
        relicId: "client_fake"
      }, prepared.resolvedContext),
      /RELIC_OFFER_SELECTION_UNKNOWN_FIELD:relicId/u
    );
    assert.deepEqual(issued, snapshot);
  }
});
