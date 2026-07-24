import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assertRegularRelicOfferV08,
  createV08Meta1Ruleset,
  getOtterRelicCandidatePoolV08,
  issueRegularRelicOffer,
  selectRegularRelic
} from "../src/rulesets/v08-meta-1/index.js";
import {
  assertCanonicalRelicBuildV08,
  canAcquireRelic,
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
    },
    async deriveIntInclusive(minimum, maximum, options) {
      if (options.purpose === "room-type/otter-queue") return minimum;
      const digest = createHash("sha256")
        .update(`${seed}|${options.runId}|${options.revision}|${options.purpose}|${options.counter}`)
        .digest();
      return minimum + digest.readUInt32BE(0) % (maximum - minimum + 1);
    }
  };
}

function context(seed) {
  return {
    runId: `property_3b2b2b1_${seed}`,
    season: "season-phase3b2b2b1-property",
    startedAt: 1_700_000_400_000 + seed,
    elapsedMs: 1_000,
    randomOracle: oracle(seed)
  };
}

async function otterState(seed) {
  const resolvedContext = context(seed);
  const resolvedRuleset = createV08Meta1Ruleset({
    randomOracle: resolvedContext.randomOracle
  });
  let state = await resolvedRuleset.createRun({ startDepth: 0 }, resolvedContext);
  state = await resolvedRuleset.selectStartingRelic(state, {
    offerId: state.pendingOffer.offerId,
    choiceId: state.pendingOffer.choices[seed % state.pendingOffer.choices.length].choiceId
  }, resolvedContext);
  const legalDepths = Array.from(
    { length: 79 },
    (_, index) => index + 21
  ).filter((depth) => depth % 5 !== 0);
  const depth = legalDepths[seed % legalDepths.length];
  state.depth = depth - 1;
  state.roomIndex = depth - 1;
  state.currentRoomDirective = null;
  state.currentRewardEnvelope = null;
  state.statistics.roomsCompleted = 1;
  state.specialRoomScheduleState.otterRoomsSeenThisRun = seed % 3;
  state.specialRoomScheduleState.otterSeenInGame = seed % 3 > 0;
  state = await resolvedRuleset.issueRoomDirective(state, resolvedContext);
  assert.equal(state.currentRoomDirective.roomType, "otter");
  return { state, resolvedContext };
}

function requestFor(state) {
  return {
    rewardEnvelopeId: state.currentRewardEnvelope.envelopeId,
    rewardSlotId: state.currentRewardEnvelope.rewardSlots[0].slotId,
    sourceDirectiveId: state.currentRoomDirective.directiveId
  };
}

test("property: 3000 seeded Otter offers preserve every implemented invariant", async () => {
  const catalog = new Map(
    V08_RELIC_POLICY_DATA.catalog.relics.map((entry) => [entry.relicId, entry])
  );
  const observedOfferIds = new Set();
  for (let seed = 1; seed <= 3_000; seed += 1) {
    const prepared = await otterState(seed);
    const before = structuredClone(prepared.state);
    const request = requestFor(prepared.state);
    const issued = await issueRegularRelicOffer(
      prepared.state,
      request,
      prepared.resolvedContext
    );
    const issueRetry = await issueRegularRelicOffer(
      issued,
      request,
      prepared.resolvedContext
    );
    assert.deepEqual(issueRetry, issued);
    assert.equal(issued.gold, before.gold);
    assert.equal(issued.lives, before.lives);
    assert.equal(issued.depth, before.depth);
    assert.deepEqual(issued.build, before.build);

    const offer = issued.pendingOffer;
    assertRegularRelicOfferV08(offer);
    assert.equal(offer.sourceType, "otter");
    assert.equal(offer.sourceId, "otter-crimson-chest");
    assert.ok(offer.choices.length >= 1 && offer.choices.length <= 9);
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

    const pool = new Set(getOtterRelicCandidatePoolV08(before));
    for (let index = 0; index < offer.choices.length; index += 1) {
      const privateChoice = offer.choices[index];
      const publicChoice = offer.publicChoices[index];
      const relic = catalog.get(privateChoice.privateRelicId);
      assert.ok(relic);
      assert.ok(["rare", "epic", "legendary", "mythic"].includes(relic.rarity));
      assert.ok(relic.acquisitionSources.includes("otter"));
      assert.ok(pool.has(relic.relicId));
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
  assert.equal(observedOfferIds.size, 3_000);
});

test("property: 250 illegal Otter selections cannot mutate run or build state", async () => {
  for (let seed = 1; seed <= 250; seed += 1) {
    const prepared = await otterState(10_000 + seed);
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

test("property: Vault deliberately has no synthetic offer property run", () => {
  assert.ok(true, "NOT_AN_ACTIVE_RELIC_SOURCE");
});
