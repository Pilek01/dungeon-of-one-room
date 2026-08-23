import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { createRoomRewardEnvelopeV3 } from "../src/rulesets/v08-meta-1/reward-policy.js";
import { settleRoomRewardEnvelopeV3, settleBoundaryRewardEnvelopeV3 } from "../src/rulesets/v08-meta-1/reward-policy.js";
import { normalizeChestBonusesV08 } from "../src/rulesets/v08-meta-1/chest-bonus-policy.js";

const context = {
  runId: "run_canonical_chest_red",
  season: "season-canonical-chest",
  startedAt: 1_900_000_000_000,
  secret: "canonical-chest-secret-0123456789abcdef",
  cryptoProvider: webcrypto,
  randomOracle: { async deriveIntInclusive() { return 0; } }
};

function directive() {
  return {
    directiveId: "directive_canonical_chest_red",
    runId: context.runId,
    revision: 0,
    roomIndex: 1,
    depth: 1,
    roomType: "combat",
    roomCategory: "normal",
    specialRoomPayload: null
  };
}

async function issuedState({ roll = 0, depth = 1, campaign } = {}) {
  const state = createInitialMetaStateV08({ campaign }, context);
  state.status = "active";
  state.depth = depth;
  state.campaign.chestBonuses = campaign?.chestBonuses || state.campaign.chestBonuses;
  const currentDirective = { ...directive(), depth, revision: state.revision };
  const envelope = await createRoomRewardEnvelopeV3({
    state,
    directive: currentDirective,
    envelopeId: `reward_canonical_${depth}_${roll}`,
    ...context,
    randomOracle: { async deriveIntInclusive() { return roll; } },
    capabilities: { canonicalChestOutcomes: "v1" }
  });
  state.currentRoomDirective = currentDirective;
  state.currentRewardEnvelope = envelope;
  return state;
}

function requestFor(state, claims) {
  const fixed = state.currentRewardEnvelope.fixedAwards.reduce((sum, award) => sum + award.amount, 0);
  return {
    envelopeId: state.currentRewardEnvelope.envelopeId,
    roomDirectiveId: state.currentRoomDirective.directiveId,
    roomNonce: state.currentRoomDirective.roomNonce,
    claims,
    reportedGoldDelta: fixed,
    reportedGoldTotal: state.gold + fixed,
    turnCount: 10,
    elapsedMs: 1_000,
    commandJournalDigest: "journal_canonical_chest",
    compactRoomProof: "proof_canonical_chest"
  };
}

test("canonical chest capability issues an outcome and award binding for every slot", async () => {
  const state = createInitialMetaStateV08({}, context);
  const envelope = await createRoomRewardEnvelopeV3({
    state,
    directive: directive(),
    envelopeId: "reward_canonical_chest_red",
    ...context,
    capabilities: { canonicalChestOutcomes: "v1" }
  });

  assert.ok(envelope.claimSlots.length > 0);
  for (const slot of envelope.claimSlots) {
    assert.deepEqual(Object.keys(slot.canonicalOutcome).sort(), ["awardId", "outcome"]);
    assert.match(slot.canonicalOutcome.awardId, /\S/u);
    assert.ok([
      "health",
      "healing",
      "attack",
      "armor",
      "potion",
      "map_fragment",
      "gold",
      "trap",
      "fallback_gold"
    ].includes(slot.canonicalOutcome.outcome));
  }
});

test("canonical issuance follows the legacy standard chest distribution categories", async () => {
  const expected = [
    [0, "health"],
    [200_000, "healing"],
    [400_000, "attack"],
    [700_000, "armor"],
    [800_000, "potion"],
    [920_000, "map_fragment"],
    [950_000, "gold"],
    [980_000, "trap"]
  ];
  for (const [roll, outcome] of expected) {
    const state = await issuedState({ roll });
    assert.equal(state.currentRewardEnvelope.claimSlots[0].canonicalOutcome.outcome, outcome);
  }
});

test("canonical stat claim applies one derived bucket increment without accepting a client amount", async () => {
  const state = await issuedState({ roll: 0, depth: 21 });
  const slot = state.currentRewardEnvelope.claimSlots[0];
  const result = await settleRoomRewardEnvelopeV3(
    state,
    requestFor(state, [{
      claimType: "chest",
      claimId: slot.slotId,
      count: 1,
      localEvidence: {
        outcome: slot.canonicalOutcome.outcome,
        awardId: slot.canonicalOutcome.awardId
      }
    }]),
    { ...context, capabilities: { canonicalChestOutcomes: "v1" } }
  );
  assert.equal(result.authoritativeGoldDelta, 12);
  assert.equal(result.state.campaign.chestBonuses.healthDepthBuckets["2"], 1);
});

test("canonical award, outcome, and invented stat evidence are rejected", async () => {
  const state = await issuedState({ roll: 0 });
  const slot = state.currentRewardEnvelope.claimSlots[0];
  for (const localEvidence of [
    { outcome: "gold", awardId: slot.canonicalOutcome.awardId },
    { outcome: slot.canonicalOutcome.outcome, awardId: "award_tampered" },
    { outcome: slot.canonicalOutcome.outcome, awardId: slot.canonicalOutcome.awardId, amount: 10 }
  ]) {
    await assert.rejects(
      settleRoomRewardEnvelopeV3(
        state,
        requestFor(state, [{ claimType: "chest", claimId: slot.slotId, count: 1, localEvidence }]),
        { ...context, capabilities: { canonicalChestOutcomes: "v1" } }
      ),
      /REWARD_CLAIM_CHEST_(OUTCOME_MISMATCH|AWARD_ID_MISMATCH|STAT_EVIDENCE_FORBIDDEN)/u
    );
  }
});

test("legacy capability keeps client-attested chest behavior", async () => {
  const state = createInitialMetaStateV08({}, context);
  state.status = "active";
  const currentDirective = { ...directive(), revision: state.revision };
  const envelope = await createRoomRewardEnvelopeV3({
    state,
    directive: currentDirective,
    envelopeId: "reward_legacy_chest",
    ...context
  });
  state.currentRoomDirective = currentDirective;
  state.currentRewardEnvelope = envelope;
  const result = await settleRoomRewardEnvelopeV3(
    state,
    requestFor(state, [{
      claimType: "chest",
      claimId: "chest_1",
      count: 1,
      localEvidence: { outcome: "gold", baseAmount: 4 }
    }]),
    context
  );
  assert.equal(result.state.campaign.chestBonuses.healthDepthBuckets["0"], undefined);
  assert.equal(result.state.currentRewardEnvelope.claimSlots[0].consumed, true);
});

test("sequential issuance converts the sixth stat slot to a server fallback", async () => {
  const bonuses = normalizeChestBonusesV08({
    schemaVersion: 1,
    attackDepthBuckets: {},
    armorDepthBuckets: {},
    healthDepthBuckets: { 2: 4 }
  });
  const state = await issuedState({ roll: 0, depth: 21, campaign: { chestBonuses: bonuses } });
  assert.equal(state.currentRewardEnvelope.claimSlots[0].canonicalOutcome.outcome, "health");
  assert.equal(state.currentRewardEnvelope.claimSlots[1].canonicalOutcome.outcome, "fallback_gold");

  const first = state.currentRewardEnvelope.claimSlots[0];
  const second = state.currentRewardEnvelope.claimSlots[1];
  const result = await settleRoomRewardEnvelopeV3(
    state,
    requestFor(state, [
      {
        claimType: "chest",
        claimId: first.slotId,
        count: 1,
        localEvidence: { outcome: first.canonicalOutcome.outcome, awardId: first.canonicalOutcome.awardId }
      },
      {
        claimType: "chest",
        claimId: second.slotId,
        count: 1,
        localEvidence: { outcome: second.canonicalOutcome.outcome, awardId: second.canonicalOutcome.awardId, baseAmount: 2 }
      }
    ]),
    { ...context, capabilities: { canonicalChestOutcomes: "v1" } }
  );
  assert.equal(result.state.campaign.chestBonuses.healthDepthBuckets["2"], 5);
});

test("fatal and emergency canonical stat claims never persist chest bonuses", async () => {
  for (const outcome of ["emergency", "fatal"]) {
    const state = await issuedState({ roll: 0 });
    const slot = state.currentRewardEnvelope.claimSlots[0];
    const settled = await settleBoundaryRewardEnvelopeV3(
      state,
      requestFor(state, [{
        claimType: "chest",
        claimId: slot.slotId,
        count: 1,
        localEvidence: { outcome: slot.canonicalOutcome.outcome, awardId: slot.canonicalOutcome.awardId }
      }]),
      { outcome },
      { ...context, capabilities: { canonicalChestOutcomes: "v1" } }
    );
    assert.deepEqual(settled.state.campaign.chestBonuses.healthDepthBuckets, {});
  }
});
