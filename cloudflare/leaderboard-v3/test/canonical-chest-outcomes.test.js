import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { createRoomRewardEnvelopeV3 } from "../src/rulesets/v08-meta-1/reward-policy.js";
import { settleRoomRewardEnvelopeV3, settleBoundaryRewardEnvelopeV3 } from "../src/rulesets/v08-meta-1/reward-policy.js";
import { normalizeChestBonusesV08 } from "../src/rulesets/v08-meta-1/chest-bonus-policy.js";
import {
  applyRelicAcquisition,
  computeRelicBuildDigestV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import { applyCanonicalRunModifierSelection } from "../src/rulesets/v08-meta-1/run-modifiers.js";

const context = {
  runId: "run_canonical_chest_red",
  season: "season-canonical-chest",
  startedAt: 1_900_000_000_000,
  secret: "canonical-chest-secret-0123456789abcdef",
  cryptoProvider: webcrypto,
  randomOracle: { async deriveIntInclusive() { return 0; } }
};

function directive(roomType = "combat") {
  return {
    directiveId: "directive_canonical_chest_red",
    runId: context.runId,
    revision: 0,
    roomIndex: 1,
    depth: 1,
    roomType,
    roomCategory: ["arena", "crossroads", "otter"].includes(roomType) ? "special" : "normal",
    specialRoomPayload: null
  };
}

async function issuedState({ roll = 0, depth = 1, campaign, relicId, pact, modifierIds, roomType = "combat" } = {}) {
  const state = createInitialMetaStateV08({ campaign }, context);
  state.status = "active";
  state.depth = depth;
  state.campaign.chestBonuses = campaign?.chestBonuses || state.campaign.chestBonuses;
  if (relicId) {
    state.build = await applyRelicAcquisition(state.build, {
      relicId,
      acquiredRevision: state.revision,
      acquisitionSource: "canonical_chest_test",
      sourceOfferId: `offer_${relicId}`
    }, { cryptoProvider: webcrypto });
  }
  if (pact) {
    state.build.pacts = [pact];
    state.build.buildDigest = await computeRelicBuildDigestV08(state.build, webcrypto);
  }
  if (modifierIds) {
    const next = await applyCanonicalRunModifierSelection(state, {
      modifierIds,
      activationSource: "server-issued-run-start"
    }, { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto });
    Object.assign(state, next);
  }
  const currentDirective = { ...directive(roomType), depth, revision: state.revision };
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

  assert.equal(envelope.canonicalChestOutcomesVersion, "v1");
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

test("canonical envelope marker requires ordinary slots to retain every issued outcome", async () => {
  const state = await issuedState({ depth: 4, roll: 2 });
  assert.equal(state.currentRewardEnvelope.canonicalChestOutcomesVersion, "v1");
  const tampered = structuredClone(state);
  delete tampered.currentRewardEnvelope.claimSlots[0].canonicalOutcome;
  await assert.rejects(
    () => settleRoomRewardEnvelopeV3(tampered, requestFor(tampered, []), {
      ...context,
      capabilities: { canonicalChestOutcomes: "v1" }
    }),
    /REWARD_CHEST_OUTCOME|REWARD_CLAIM_SLOT/u
  );
});

test("special canonical-capability envelopes retain the marker but keep legacy slots", async () => {
  const state = await issuedState({ roomType: "arena", depth: 4, roll: 2 });
  assert.equal(state.currentRewardEnvelope.canonicalChestOutcomesVersion, "v1");
  assert.equal(Object.hasOwn(state.currentRewardEnvelope.claimSlots[0], "canonicalOutcome"), false);
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

test("canonical issuance resolves Shrine Ward, Alchemist, and Avarice conversions", async () => {
  const shrineWard = await issuedState({ roll: 980_000, relicId: "shrineward" });
  assert.equal(shrineWard.currentRewardEnvelope.claimSlots[0].canonicalOutcome.outcome, "gold");
  const alchemist = await issuedState({ roll: 0, modifierIds: ["alchemist"] });
  assert.equal(alchemist.currentRewardEnvelope.claimSlots[0].canonicalOutcome.outcome, "fallback_gold");
  const avarice = await issuedState({ roll: 800_000, pact: "avarice" });
  assert.equal(avarice.currentRewardEnvelope.claimSlots[0].canonicalOutcome.outcome, "fallback_gold");
});

test("canonical capability does not issue ordinary outcomes for special chest slots", async () => {
  for (const roomType of ["arena", "crossroads", "otter"]) {
    const state = await issuedState({ roomType });
    assert.equal(state.currentRewardEnvelope.claimSlots.length, 1);
    assert.equal(Object.hasOwn(state.currentRewardEnvelope.claimSlots[0], "canonicalOutcome"), false);
    const settled = await settleRoomRewardEnvelopeV3(
      state,
      requestFor(state, [{
        claimType: "chest",
        claimId: "chest_1",
        count: 1,
        localEvidence: { outcome: "opened" }
      }]),
      { ...context, capabilities: { canonicalChestOutcomes: "v1" } }
    );
    assert.equal(settled.state.currentRewardEnvelope.claimSlots[0].consumed, true);
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

test("canonical attack and armor claims derive their envelope-depth buckets", async () => {
  for (const [roll, field] of [[400_000, "attackDepthBuckets"], [700_000, "armorDepthBuckets"]]) {
    const state = await issuedState({ roll, depth: 31 });
    const slot = state.currentRewardEnvelope.claimSlots[0];
    const result = await settleRoomRewardEnvelopeV3(
      state,
      requestFor(state, [{
        claimType: "chest",
        claimId: slot.slotId,
        count: 1,
        localEvidence: { outcome: slot.canonicalOutcome.outcome, awardId: slot.canonicalOutcome.awardId }
      }]),
      {
        ...context,
        randomOracle: { async deriveIntInclusive() { return roll; } },
        capabilities: { canonicalChestOutcomes: "v1" }
      }
    );
    assert.equal(result.state.campaign.chestBonuses[field]["3"], 1);
  }
});

test("canonical Vault stat and trap outcomes include the mandatory gold bonus", async () => {
  for (const roll of [0, 200_000, 400_000, 700_000, 990_000]) {
    const state = await issuedState({ roomType: "vault", roll });
    const slot = state.currentRewardEnvelope.claimSlots[0];
    const settled = await settleRoomRewardEnvelopeV3(
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
      {
        ...context,
        randomOracle: { async deriveIntInclusive() { return roll; } },
        capabilities: { canonicalChestOutcomes: "v1" }
      }
    );
    const fixed = state.currentRewardEnvelope.fixedAwards.reduce((sum, award) => sum + award.amount, 0);
    assert.equal(settled.authoritativeGoldDelta, fixed + 50, `roll=${roll}`);
  }
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
      /REWARD_CLAIM_CHEST_(OUTCOME_MISMATCH|AWARD_ID_MISMATCH|STAT_EVIDENCE_FORBIDDEN|EVIDENCE_SCHEMA_INVALID)/u
    );
  }
});

test("canonical stat replay is exact and issued-state tampering fails closed", async () => {
  const state = await issuedState({ roll: 0 });
  const slot = state.currentRewardEnvelope.claimSlots[0];
  const request = requestFor(state, [{
    claimType: "chest",
    claimId: slot.slotId,
    count: 1,
    localEvidence: { outcome: slot.canonicalOutcome.outcome, awardId: slot.canonicalOutcome.awardId }
  }]);
  const first = await settleRoomRewardEnvelopeV3(
    state,
    request,
    { ...context, capabilities: { canonicalChestOutcomes: "v1" } }
  );
  const replay = await settleRoomRewardEnvelopeV3(
    first.state,
    request,
    { ...context, capabilities: { canonicalChestOutcomes: "v1" } }
  );
  assert.equal(replay.replayed, true);
  assert.equal(replay.state.campaign.chestBonuses.healthDepthBuckets["0"], 1);

  const tampered = await issuedState({ roll: 0 });
  tampered.currentRewardEnvelope.claimSlots[0].canonicalOutcome.outcome = "gold";
  await assert.rejects(
    settleRoomRewardEnvelopeV3(tampered, requestFor(tampered, []), {
      ...context,
      capabilities: { canonicalChestOutcomes: "v1" }
    }),
    /REWARD_(ISSUED_STATE_DIGEST_MISMATCH|CHEST_OUTCOME_ISSUANCE_MISMATCH)/u
  );
});

test("canonical claims reject unknown scalar and nested evidence fields", async () => {
  const state = await issuedState({ roll: 0 });
  const slot = state.currentRewardEnvelope.claimSlots[0];
  for (const extra of [
    { healthBonus: 1 },
    { attackAmount: 2 },
    { value: 3 },
    { nested: { amount: 4 } }
  ]) {
    await assert.rejects(
      settleRoomRewardEnvelopeV3(
        state,
        requestFor(state, [{
          claimType: "chest",
          claimId: slot.slotId,
          count: 1,
          localEvidence: {
            outcome: slot.canonicalOutcome.outcome,
            awardId: slot.canonicalOutcome.awardId,
            ...extra
          }
        }]),
        { ...context, capabilities: { canonicalChestOutcomes: "v1" } }
      ),
      /REWARD_CLAIM_CHEST_EVIDENCE_SCHEMA_INVALID/u
    );
  }
});

test("canonical claims reject wrong, reused, other-slot, and stale bindings", async () => {
  const state = await issuedState({ roll: 0 });
  const [first, second] = state.currentRewardEnvelope.claimSlots;
  const evidence = { outcome: first.canonicalOutcome.outcome, awardId: first.canonicalOutcome.awardId };
  const capable = { ...context, capabilities: { canonicalChestOutcomes: "v1" } };
  await assert.rejects(
    settleRoomRewardEnvelopeV3(state, requestFor(state, [{ claimType: "chest", claimId: "missing", count: 1, localEvidence: evidence }]), capable),
    /REWARD_CLAIM_ID_UNKNOWN/u
  );
  await assert.rejects(
    settleRoomRewardEnvelopeV3(state, requestFor(state, [{ claimType: "chest", claimId: second.slotId, count: 1, localEvidence: evidence }]), capable),
    /REWARD_CLAIM_CHEST_AWARD_ID_MISMATCH/u
  );
  await assert.rejects(
    settleRoomRewardEnvelopeV3(state, { ...requestFor(state, [{ claimType: "chest", claimId: first.slotId, count: 1, localEvidence: evidence }]), roomNonce: "stale" }, capable),
    /REWARD_CLAIM_NONCE_MISMATCH/u
  );
  await assert.rejects(
    settleRoomRewardEnvelopeV3(state, requestFor(state, [
      { claimType: "chest", claimId: first.slotId, count: 1, localEvidence: evidence },
      { claimType: "chest", claimId: first.slotId, count: 1, localEvidence: evidence }
    ]), capable),
    /REWARD_CLAIM_DUPLICATE/u
  );
});

test("canonical resource and gold categories require their exact evidence fields", async () => {
  for (const [roll, required] of [[800_000, "count"], [920_000, "count"], [950_000, "baseAmount"]]) {
    const state = await issuedState({ roll });
    const slot = state.currentRewardEnvelope.claimSlots[0];
    const evidence = { outcome: slot.canonicalOutcome.outcome, awardId: slot.canonicalOutcome.awardId };
    await assert.rejects(
      settleRoomRewardEnvelopeV3(
        state,
        requestFor(state, [{ claimType: "chest", claimId: slot.slotId, count: 1, localEvidence: evidence }]),
        {
          ...context,
          randomOracle: { async deriveIntInclusive() { return roll; } },
          capabilities: { canonicalChestOutcomes: "v1" }
        }
      ),
      /REWARD_CLAIM_CHEST_EVIDENCE_SCHEMA_INVALID/u
    );
    evidence[required] = required === "count" ? 1 : 4;
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
