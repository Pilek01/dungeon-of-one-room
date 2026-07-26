import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createV08Meta1Ruleset,
  getArenaRelicCandidatePoolV08,
  issueRegularRelicOffer,
  projectPublicRegularRelicOfferV08,
  selectRegularRelic
} from "../src/rulesets/v08-meta-1/index.js";
import {
  applyCanonicalRunModifierSelection,
  assertCanonicalRunModifierDigestV08
} from "../src/rulesets/v08-meta-1/run-modifiers.js";
import arenaPolicyDocument from "../src/rulesets/v08-meta-1/data/arena-relic-offer-policy.generated.json" with { type: "json" };

const policy = arenaPolicyDocument.canonicalData;
const allowedRarities = new Set(policy.allowedRarities);
const trustedModifierContext = Object.freeze({ authority: "TRUSTED_RULESET_DOMAIN" });
const eligibleDepths = Array.from({ length: 59 }, (_, index) => index + 41)
  .filter((depth) => depth % policy.excludedBossInterval !== 0);

function seededOracle(seed, purposeLog = []) {
  return {
    async deriveRandomBytes(options) {
      purposeLog.push(options.purpose);
      const output = new Uint8Array(options.length);
      let offset = 0;
      let block = 0;
      while (offset < output.length) {
        const digest = createHash("sha256")
          .update([
            seed,
            options.runId,
            options.revision,
            options.purpose,
            options.counter,
            block
          ].join("|"))
          .digest();
        const take = Math.min(digest.length, output.length - offset);
        output.set(digest.subarray(0, take), offset);
        offset += take;
        block += 1;
      }
      return output;
    },
    async deriveIntInclusive(minimum, maximum, options) {
      purposeLog.push(options.purpose);
      if (
        options.purpose === "room-type/otter-queue" ||
        options.purpose === "room-type/vault" ||
        options.purpose === "room-type/weighted"
      ) {
        return maximum;
      }
      const digest = createHash("sha256")
        .update([
          seed,
          options.runId,
          options.revision,
          options.purpose,
          options.counter
        ].join("|"))
        .digest();
      return minimum + digest.readUInt32BE(0) % (maximum - minimum + 1);
    }
  };
}

function context(runId, seed, purposeLog = []) {
  return {
    runId,
    season: "season-phase3b2c3b-property",
    startedAt: 1_700_000_600_000,
    elapsedMs: 2_000,
    secret: "phase3b2c3b-property:0123456789abcdef0123456789abcdef",
    randomOracle: seededOracle(seed, purposeLog)
  };
}

async function arenaCase(index, purposeLog = []) {
  const runId = "arena_property_" + index;
  const seed = "seed_" + ((index * 2_654_435_761) >>> 0);
  const depth = eligibleDepths[(index * 17 + 3) % eligibleDepths.length];
  const ascension = index % 2 === 1;
  const resolvedContext = context(runId, seed, purposeLog);
  const ruleset = createV08Meta1Ruleset({
    secret: resolvedContext.secret,
    randomOracle: resolvedContext.randomOracle
  });
  let state = await ruleset.createRun({ startDepth: 0 }, resolvedContext);
  if (ascension) {
    state = await applyCanonicalRunModifierSelection(state, {
      modifierIds: ["ascension"],
      activationSource: "server-issued-run-start"
    }, trustedModifierContext);
  }
  state = await ruleset.selectStartingRelic(state, {
    offerId: state.pendingOffer.offerId,
    choiceId: state.pendingOffer.choices[index % state.pendingOffer.choices.length].choiceId
  }, resolvedContext);
  state.depth = depth - 1;
  state.roomIndex = depth - 1;
  state.currentRoomDirective = null;
  state.currentRewardEnvelope = null;
  state.statistics.roomsCompleted = 1;
  state.specialRoomScheduleState.otterRoomsSeenThisRun = 3;
  state.specialRoomScheduleState.otterSeenInGame = true;
  state.specialRoomScheduleState.otterPityUsedInGame = true;
  state = await ruleset.issueRoomDirective(state, resolvedContext);
  assert.equal(state.currentRoomDirective.roomType, "arena");
  const request = {
    rewardEnvelopeId: state.currentRewardEnvelope.envelopeId,
    rewardSlotId: state.currentRewardEnvelope.rewardSlots[0].slotId,
    sourceDirectiveId: state.currentRoomDirective.directiveId
  };
  return {
    state,
    request,
    resolvedContext,
    depth,
    ascension,
    seed
  };
}

test("seeded Arena offer properties hold across 256 canonical runs", async () => {
  for (let index = 0; index < 256; index += 1) {
    const purposeLog = [];
    const prepared = await arenaCase(index, purposeLog);
    const before = structuredClone(prepared.state);
    const issued = await issueRegularRelicOffer(
      prepared.state,
      prepared.request,
      prepared.resolvedContext
    );
    assert.deepEqual(prepared.state, before);
    const offer = issued.pendingOffer;
    const expectedCount = prepared.ascension ? 4 : 3;
    assert.equal(offer.choices.length, expectedCount);
    assert.equal(offer.publicChoices.length, expectedCount);
    assert.equal(new Set(offer.choices.map((choice) => choice.choiceId)).size, expectedCount);
    assert.equal(new Set(offer.choices.map((choice) => choice.privateRelicId)).size, expectedCount);
    const pool = new Set(getArenaRelicCandidatePoolV08(issued));
    for (const [choiceIndex, choice] of offer.choices.entries()) {
      assert.ok(pool.has(choice.privateRelicId));
      assert.ok(allowedRarities.has(offer.publicChoices[choiceIndex].rarity));
    }
    assert.equal(issued.gold, before.gold);
    assert.equal(issued.lives, before.lives);
    assert.equal(issued.depth, prepared.depth - 1);
    assert.equal(issued.currentRoomDirective.depth, prepared.depth);
    await assertCanonicalRunModifierDigestV08(issued.runModifiers);

    const publicOffer = projectPublicRegularRelicOfferV08(offer);
    assert.equal(Object.hasOwn(publicOffer, "choices"), false);
    assert.equal(Object.hasOwn(publicOffer, "issuedStateDigest"), false);
    assert.ok(
      Buffer.byteLength(JSON.stringify(publicOffer), "utf8") <
      policy.publicPayloadTargetBytes
    );

    const chosen = offer.choices[index % offer.choices.length];
    const selected = await selectRegularRelic(issued, {
      offerId: offer.offerId,
      choiceId: chosen.choiceId
    }, prepared.resolvedContext);
    assert.equal(selected.pendingRelicTransaction, null);
    assert.ok(selected.build.relics.some((entry) => entry.relicId === chosen.privateRelicId));
    assert.equal(selected.gold, issued.gold);
    assert.equal(selected.currentRewardEnvelope.rewardSlots[0].consumed, true);

    if (index % 16 === 0) {
      const repeatedPrepared = await arenaCase(index);
      const repeated = await issueRegularRelicOffer(
        repeatedPrepared.state,
        repeatedPrepared.request,
        repeatedPrepared.resolvedContext
      );
      assert.deepEqual(repeated.pendingOffer, offer);
    }

    const arenaPurposes = new Set(
      purposeLog.filter((purpose) => purpose.startsWith("arena-relic"))
    );
    assert.deepEqual(arenaPurposes, new Set(policy.rngPurposes));
  }
});

test("seeded Arena binding mutations fail closed without mutating 96 inputs", async () => {
  const mutationKinds = ["slot", "source", "revision", "directive"];
  for (let index = 0; index < 96; index += 1) {
    const prepared = await arenaCase(index + 1_000);
    const mutated = structuredClone(prepared.state);
    const request = { ...prepared.request };
    const mutation = mutationKinds[index % mutationKinds.length];
    let expected;
    if (mutation === "slot") {
      request.rewardSlotId = "foreign_slot";
      expected = /RELIC_REWARD_SLOT_UNKNOWN/u;
    } else if (mutation === "source") {
      mutated.currentRewardEnvelope.rewardSlots[0].sourceType = "otter";
      expected = /RELIC_REWARD_SOURCE_MISMATCH/u;
    } else if (mutation === "revision") {
      mutated.revision += 1;
      expected = /RELIC_REWARD_ENVELOPE_STALE/u;
    } else {
      request.sourceDirectiveId = "foreign_directive";
      expected = /RELIC_REWARD_DIRECTIVE_MISMATCH/u;
    }
    const snapshot = structuredClone(mutated);
    await assert.rejects(
      issueRegularRelicOffer(mutated, request, prepared.resolvedContext),
      expected
    );
    assert.deepEqual(mutated, snapshot);
  }
});
