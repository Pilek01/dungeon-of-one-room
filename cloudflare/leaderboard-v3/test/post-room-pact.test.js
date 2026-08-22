import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  applyRulesetCheckpoint,
  applyRulesetEvent
} from "../src/domain/ruleset-runtime.js";
import { assertMetaStateV08, createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { createRoomDirectiveV3 } from "../src/rulesets/v08-meta-1/room-directive.js";
import { createRoomRewardEnvelopeV3 } from "../src/rulesets/v08-meta-1/reward-policy.js";
import { createV08Meta1Ruleset } from "../src/rulesets/v08-meta-1/index.js";
import {
  commitPactTransactionV08,
  issuePactOfferV08
} from "../src/rulesets/v08-meta-1/pact-policy.js";
import { computeMetaTransactionStateDigestV08 } from "../src/rulesets/v08-meta-1/meta-transaction.js";
import {
  V08_META_1_PACT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PRODUCTION_RULESET_HASH,
  V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR
} from "../src/rulesets/releases.js";

const SECRET = "post-room-pact:0123456789abcdef0123456789abcdef";

function oracle(seed) {
  return {
    async deriveRandomBytes(options) {
      const digest = createHash("sha256")
        .update([seed, options.runId, options.revision, options.purpose, options.counter].join("|"))
        .digest();
      return new Uint8Array(digest.subarray(0, options.length));
    },
    async deriveIntInclusive(minimum, maximum, options) {
      const digest = createHash("sha256")
        .update([seed, options.runId, options.revision, options.purpose, options.counter].join("|"))
        .digest();
      return minimum + digest.readUInt32BE(0) % (maximum - minimum + 1);
    }
  };
}

async function pactState({ runId = "run_post_room_pact", activePact = null } = {}) {
  const context = {
    runId,
    season: "season-test",
    startedAt: 1_800_000_000_000,
    secret: SECRET,
    randomOracle: oracle(runId)
  };
  const state = createInitialMetaStateV08({}, context);
  state.status = "active";
  state.build.pacts = activePact ? [activePact] : [];
  const directive = createRoomDirectiveV3({
    directiveId: `${runId}_directive`,
    runId,
    revision: state.revision,
    roomIndex: 8,
    depth: 45,
    roomType: "pact",
    roomCategory: "special",
    directiveSeed: `${runId}_seed`,
    roomNonce: `${runId}_nonce`,
    rewardEnvelopeRef: `${runId}_reward`,
    specialRoomPayload: { scalingDepth: 45 },
    issuedAt: state.startedAt
  });
  state.roomIndex = directive.roomIndex;
  state.depth = directive.depth - 1;
  state.currentRoomDirective = directive;
  state.currentRewardEnvelope = await createRoomRewardEnvelopeV3({
    state,
    directive,
    envelopeId: directive.rewardEnvelopeRef
  });
  return { state, context };
}

function checkpointBody(state) {
  const directive = state.currentRoomDirective;
  return {
    roomResult: "cleared",
    roomDirectiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
    rewardClaims: [],
    reportedGoldDelta: 0,
    reportedGoldTotal: state.gold,
    integrityVersion: 1,
    integritySignals: [],
    turnCount: 2,
    elapsedMs: 100,
    commandJournalDigest: "post-room-pact-test",
    compactRoomProof: {
      roomDirectiveId: directive.directiveId,
      roomNonce: directive.roomNonce
    }
  };
}

test("capable Pact checkpoint settles with the pre-Pact build and withholds the next directive", async () => {
  const { state, context } = await pactState({ activePact: "avarice" });
  const ruleset = {
    ...createV08Meta1Ruleset({ rulesetHash: state.rulesetHash }),
    capabilities: { postRoomPactSettlement: "post-room-pact-v1" }
  };
  const beforeGold = state.gold;
  const transition = await applyRulesetCheckpoint(
    state,
    checkpointBody(state),
    ruleset,
    context
  );
  assert.equal(transition.nextState.revision, state.revision + 1);
  assert.equal(transition.nextState.currentRoomDirective.consumed, true);
  assert.equal(transition.nextState.pendingInventory?.sourceType, "pact");
  assert.equal(transition.nextState.pendingInventory?.sourceBinding.completedDirectiveId, state.currentRoomDirective.directiveId);
  assert.equal(transition.nextState.pendingInventory?.sourceBinding.completedRevision, state.revision);
  assert.equal(transition.nextState.pendingInventory?.sourceBinding.postSettlementBuildDigest, transition.nextState.build.buildDigest);
  assert.ok(transition.nextState.gold > beforeGold);
  assert.deepEqual(transition.nextState.build.pacts, ["avarice"]);
  assertMetaStateV08(transition.nextState);
});

test("post-room Pact apply, replace, break, and leave issue exactly one next directive", async () => {
  for (const activePact of [null, "avarice"]) {
    const { state, context } = await pactState({ runId: `run_apply_${activePact || "none"}`, activePact });
    const ruleset = {
      ...createV08Meta1Ruleset({ rulesetHash: state.rulesetHash }),
      capabilities: { postRoomPactSettlement: "post-room-pact-v1" }
    };
    const transition = await applyRulesetCheckpoint(state, checkpointBody(state), ruleset, context);
    const choice = transition.nextState.pendingInventory.choices.find((entry) => entry.privateData.action === "apply");
    const committed = await commitPactTransactionV08(transition.nextState, {
      transactionId: choice.transactionId,
      choiceId: choice.choiceId
    }, context);
    assert.equal(committed.pendingInventory, null);
    assert.ok(committed.currentRoomDirective);
    assert.equal(committed.currentRoomDirective.roomIndex, state.roomIndex + 1);
    assert.equal(
      committed.metaTransactionReceipts.at(-1).resultingStateDigest,
      await computeMetaTransactionStateDigestV08(committed),
      "Pact receipt must audit the final persisted post-room state"
    );
  }
  {
    const { state, context } = await pactState({ runId: "run_break", activePact: "avarice" });
    const ruleset = { ...createV08Meta1Ruleset({ rulesetHash: state.rulesetHash }), capabilities: { postRoomPactSettlement: "post-room-pact-v1" } };
    const transition = await applyRulesetCheckpoint(state, checkpointBody(state), ruleset, context);
    const choice = transition.nextState.pendingInventory.choices.find((entry) => entry.privateData.action === "break");
    const committed = await commitPactTransactionV08(transition.nextState, { transactionId: choice.transactionId, choiceId: choice.choiceId }, context);
    assert.deepEqual(committed.build.pacts, []);
    assert.ok(committed.currentRoomDirective);
  }
  {
    const { state, context } = await pactState({ runId: "run_leave" });
    const ruleset = { ...createV08Meta1Ruleset({ rulesetHash: state.rulesetHash }), capabilities: { postRoomPactSettlement: "post-room-pact-v1" } };
    const transition = await applyRulesetCheckpoint(state, checkpointBody(state), ruleset, context);
    const choice = transition.nextState.pendingInventory.choices.find((entry) => entry.privateData.action === "leave");
    const committed = await commitPactTransactionV08(transition.nextState, { transactionId: choice.transactionId, choiceId: choice.choiceId }, context);
    assert.equal(committed.metaSourceConsumptions.length, 0);
    assert.ok(committed.currentRoomDirective);
  }
});

test("post-room Pact retries are fail-closed and resume projects the opaque offer", async () => {
  const { state, context } = await pactState({ runId: "run_replay" });
  const capable = { ...createV08Meta1Ruleset({ rulesetHash: state.rulesetHash }), capabilities: { postRoomPactSettlement: "post-room-pact-v1" } };
  const transition = await applyRulesetCheckpoint(state, checkpointBody(state), capable, context);
  assertMetaStateV08(transition.nextState);
  const offer = transition.nextState.pendingInventory;
  const choice = offer.choices[0];
  const committed = await commitPactTransactionV08(transition.nextState, { transactionId: choice.transactionId, choiceId: choice.choiceId }, context);
  assert.ok(committed.currentRoomDirective);
  assert.deepEqual(await commitPactTransactionV08(committed, { transactionId: choice.transactionId, choiceId: choice.choiceId }, context), committed);
  const stale = structuredClone(transition.nextState);
  stale.revision += 1;
  await assert.rejects(
    commitPactTransactionV08(stale, { transactionId: choice.transactionId, choiceId: choice.choiceId }, context),
    /META_TRANSACTION_STALE|META_TRANSACTION_IDEMPOTENCY/u
  );
  const forged = structuredClone(transition.nextState);
  forged.pendingPostRoomPact.postSettlementBuildDigest = "forged";
  assert.throws(() => assertMetaStateV08(forged), /META_STATE_INVALID:pendingPostRoomPact_binding/u);
  const forgedSequence = structuredClone(transition.nextState);
  forgedSequence.pendingPostRoomPact.completedDepth += 1;
  assert.throws(() => assertMetaStateV08(forgedSequence), /META_STATE_INVALID:pendingPostRoomPact_binding/u);
  assert.equal(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities.postRoomPactSettlement, "post-room-pact-v1");
  assert.equal(V08_META_1_PRODUCTION_RULESET_HASH, state.rulesetHash);
  assert.notEqual(V08_META_1_PACT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash, state.rulesetHash);
});

test("old ruleset capability keeps the existing Pact checkpoint behavior", async () => {
  const { state, context } = await pactState({ runId: "run_old_capability" });
  const ruleset = createV08Meta1Ruleset({ rulesetHash: state.rulesetHash });
  const transition = await applyRulesetCheckpoint(state, checkpointBody(state), ruleset, context);
  assert.ok(transition.nextState.currentRoomDirective);
  assert.equal(transition.nextState.pendingInventory, null);
});

test("capable Pact rooms reject pre-checkpoint offers while old capability retains legacy opening", async () => {
  const capable = await pactState({ runId: "run_preopen_capable" });
  await assert.rejects(
    applyRulesetEvent(
      capable.state,
      { type: "open_meta_offer", payload: {} },
      V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.createRuleset(),
      capable.context
    ),
    /PACT_POST_ROOM_SETTLEMENT_REQUIRED/u
  );
  const legacy = await pactState({ runId: "run_preopen_legacy" });
  const offer = await issuePactOfferV08(legacy.state, legacy.context);
  assert.equal(offer.pendingInventory.sourceType, "pact");
});

test("capable Pact checkpoint rejects a stale pre-checkpoint Pact offer instead of rebinding it", async () => {
  const { state, context } = await pactState({ runId: "run_stale_preopen" });
  const preexisting = await issuePactOfferV08(state, context);
  const capable = { ...createV08Meta1Ruleset({ rulesetHash: state.rulesetHash }), capabilities: { postRoomPactSettlement: "post-room-pact-v1" } };
  await assert.rejects(
    applyRulesetCheckpoint(preexisting, checkpointBody(preexisting), capable, context),
    /PACT_POST_ROOM_TRANSACTION_PENDING/u
  );
});

test("pending post-room Pact accepts only its opaque commit event and rejects bypass events", async () => {
  const { state, context } = await pactState({ runId: "run_event_gate" });
  const ruleset = { ...createV08Meta1Ruleset({ rulesetHash: state.rulesetHash }), capabilities: { postRoomPactSettlement: "post-room-pact-v1" } };
  const transition = await applyRulesetCheckpoint(state, checkpointBody(state), ruleset, context);
  for (const type of ["open_meta_offer", "request_extraction", "report_fatal_event", "mark_test_assistance"]) {
    await assert.rejects(
      applyRulesetEvent(transition.nextState, { type, payload: {} }, ruleset, context),
      /PACT_POST_ROOM_TRANSACTION_PENDING/u
    );
  }
});

test("pending post-room Pact blocks checkpoint replay before reward-envelope access", async () => {
  const { state, context } = await pactState({ runId: "run_checkpoint_replay" });
  const capable = { ...createV08Meta1Ruleset({ rulesetHash: state.rulesetHash }), capabilities: { postRoomPactSettlement: "post-room-pact-v1" } };
  const transition = await applyRulesetCheckpoint(state, checkpointBody(state), capable, context);
  await assert.rejects(
    applyRulesetCheckpoint(transition.nextState, checkpointBody(transition.nextState), capable, context),
    /PACT_POST_ROOM_TRANSACTION_PENDING/u
  );
});

test("a newly selected Avarice Pact cannot retroactively amplify the completed room claim", async () => {
  const baseline = await pactState({ runId: "run_claim_baseline" });
  const capable = { ...createV08Meta1Ruleset({ rulesetHash: baseline.state.rulesetHash }), capabilities: { postRoomPactSettlement: "post-room-pact-v1" } };
  const claimBody = { ...checkpointBody(baseline.state), rewardClaims: [{ claimType: "enemy", claimId: "enemy:skeleton", count: 1 }] };
  const baselineTransition = await applyRulesetCheckpoint(baseline.state, claimBody, capable, baseline.context);
  const selected = baselineTransition.nextState.pendingInventory.choices.find((entry) => entry.privateData.action === "apply");
  const afterPact = await commitPactTransactionV08(baselineTransition.nextState, { transactionId: selected.transactionId, choiceId: selected.choiceId }, baseline.context);
  assert.equal(afterPact.rewardSettlementHistory.at(-1).authoritativeGoldDelta, baselineTransition.nextState.rewardSettlementHistory.at(-1).authoritativeGoldDelta);
});
