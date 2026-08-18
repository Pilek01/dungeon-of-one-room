import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import test from "node:test";
import { applyRulesetEvent } from "../src/domain/ruleset-runtime.js";
import {
  captureRankIntegrityRoomContext,
  initializeRankEligibility
} from "../src/domain/rank-eligibility.js";
import * as rewardPolicy from "../src/rulesets/v08-meta-1/reward-policy.js";
import { applyFatalEventV08 } from "../src/rulesets/v08-meta-1/life-policy.js";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { requestExtractionV08 } from "../src/rulesets/v08-meta-1/outcome-policy.js";
import { consumeRoomDirectiveV08, issueNextRoomDirectiveV08 } from "../src/rulesets/v08-meta-1/room-policy.js";
import {
  V08_META_1_INTEGRITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_LOCAL_RELEASE_DESCRIPTOR,
  V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR
} from "../src/rulesets/releases.js";

const SECRET = "ranked-boundary-checkpoints:0123456789abcdef0123456789abcdef";
const NOW = 1_900_100_000_000;

function oracle() {
  return {
    async deriveRandomBytes(options) {
      const bytes = new Uint8Array(options.length);
      let offset = 0;
      let block = 0;
      while (offset < bytes.length) {
        const digest = createHash("sha256")
          .update([SECRET, options.runId, options.revision, options.purpose, options.counter, block].join("|"))
          .digest();
        const take = Math.min(digest.length, bytes.length - offset);
        bytes.set(digest.subarray(0, take), offset);
        offset += take;
        block += 1;
      }
      return bytes;
    },
    async deriveIntInclusive(minimum) {
      return minimum;
    }
  };
}

async function activeRoom(runId) {
  const context = {
    runId,
    season: "boundary-season",
    startedAt: NOW,
    now: NOW,
    secret: SECRET,
    cryptoProvider: webcrypto,
    randomOracle: oracle()
  };
  const state = createInitialMetaStateV08({}, context);
  state.status = "active";
  const issued = await issueNextRoomDirectiveV08(state, context);
  assert.ok(issued.currentRewardEnvelope.claimSlots.length > 0, "fixture room needs a chest slot");
  return { state: issued, context };
}

function boundaryRequest(state, claims, overrides = {}) {
  return {
    envelopeId: state.currentRewardEnvelope.envelopeId,
    roomDirectiveId: state.currentRoomDirective.directiveId,
    roomNonce: state.currentRoomDirective.roomNonce,
    claims,
    reportedGoldDelta: 0,
    reportedGoldTotal: state.gold,
    turnCount: 1,
    elapsedMs: 100,
    commandJournalDigest: "boundary-journal",
    compactRoomProof: "boundary-proof",
    ...overrides
  };
}

function mapFragmentClaim(state) {
  return [{
    claimType: "chest",
    claimId: state.currentRewardEnvelope.claimSlots[0].slotId,
    count: 1,
    localEvidence: { outcome: "map_fragment", count: 1 }
  }];
}

test("emergency boundary settles a map fragment without room-clear reward, clear, or depth", async () => {
  assert.equal(typeof rewardPolicy.settleBoundaryRewardEnvelopeV3, "function");
  const { state, context } = await activeRoom("run_boundary_emergency");
  const fixedAward = state.currentRewardEnvelope.fixedAwards[0].amount;
  assert.ok(fixedAward > 0);
  const settled = await rewardPolicy.settleBoundaryRewardEnvelopeV3(
    state,
    boundaryRequest(state, mapFragmentClaim(state)),
    { outcome: "emergency" },
    context
  );
  assert.equal(settled.state.campaign.treasureMapFragments, 1);
  assert.equal(settled.state.gold, state.gold);
  assert.equal(settled.state.depth, state.depth);
  assert.equal(settled.state.statistics.roomsCompleted, 0);
  assert.equal(settled.state.currentRewardEnvelope.consumed, true);

  const extracted = requestExtractionV08(settled.state, { mode: "emergency" }).nextState;
  assert.equal(extracted.depth, state.depth);
  assert.equal(extracted.statistics.roomsCompleted, 0);
  assert.equal(extracted.extraction.walletBefore, state.gold);
});

test("fatal boundary preserves one durable map fragment and an exact retry is a replay", async () => {
  assert.equal(typeof rewardPolicy.settleBoundaryRewardEnvelopeV3, "function");
  const { state, context } = await activeRoom("run_boundary_fatal");
  state.build.resources.hasSecondChance = true;
  const request = boundaryRequest(state, mapFragmentClaim(state));
  const settled = await rewardPolicy.settleBoundaryRewardEnvelopeV3(
    state,
    request,
    { outcome: "fatal" },
    context
  );
  const replay = await rewardPolicy.settleBoundaryRewardEnvelopeV3(
    settled.state,
    request,
    { outcome: "fatal" },
    context
  );
  assert.equal(replay.replayed, true);
  assert.equal(replay.state.campaign.treasureMapFragments, 1);
  assert.equal(replay.state.currentRewardEnvelope.consumed, false);

  const fatal = await applyFatalEventV08(
    replay.state,
    { classification: "local_fatal_event" },
    context
  );
  assert.equal(fatal.publicResult.resolution, "prevented_second_chance");
  assert.equal(fatal.nextState.currentRoomDirective.directiveId, state.currentRoomDirective.directiveId);
  assert.equal(fatal.nextState.depth, state.depth);
  assert.equal(fatal.nextState.statistics.roomsCompleted, 0);
});

test("fatal settlement validates ignored transient claims instead of accepting invented rewards", async () => {
  const { state, context } = await activeRoom("run_boundary_fatal_invalid_claim");
  await assert.rejects(
    rewardPolicy.settleBoundaryRewardEnvelopeV3(
      state,
      boundaryRequest(state, [{
        claimType: "enemy",
        claimId: "enemy:invented_devtools_reward",
        count: 1
      }]),
      { outcome: "fatal" },
      context
    ),
    /REWARD_CLAIM_ID_UNKNOWN/u
  );
});

test("a consumed fatal claim cannot be collected twice but a later room can grant another fragment", async () => {
  assert.equal(typeof rewardPolicy.settleBoundaryRewardEnvelopeV3, "function");
  const { state, context } = await activeRoom("run_boundary_later_fragment");
  const first = await rewardPolicy.settleBoundaryRewardEnvelopeV3(
    state,
    boundaryRequest(state, mapFragmentClaim(state)),
    { outcome: "fatal" },
    context
  );
  await assert.rejects(
    rewardPolicy.settleBoundaryRewardEnvelopeV3(
      first.state,
      boundaryRequest(first.state, mapFragmentClaim(first.state), { turnCount: 2 }),
      { outcome: "fatal" },
      context
    ),
    /REWARD_CLAIM_SLOT_CONSUMED/u
  );

  const fixed = first.state.currentRewardEnvelope.fixedAwards[0].amount;
  const cleared = await consumeRoomDirectiveV08(first.state, {
    directiveId: first.state.currentRoomDirective.directiveId,
    runId: first.state.runId,
    rulesetHash: first.state.rulesetHash,
    revision: first.state.revision,
    roomIndex: first.state.currentRoomDirective.roomIndex,
    depth: first.state.currentRoomDirective.depth,
    roomType: first.state.currentRoomDirective.roomType,
    roomNonce: first.state.currentRoomDirective.roomNonce,
    completionAttestation: "local-room-completed",
    rewardClaim: boundaryRequest(first.state, [], {
      reportedGoldDelta: fixed,
      reportedGoldTotal: first.state.gold + fixed
    })
  }, context);
  assert.ok(cleared.currentRewardEnvelope.claimSlots.length > 0);
  const second = await rewardPolicy.settleBoundaryRewardEnvelopeV3(
    cleared,
    boundaryRequest(cleared, mapFragmentClaim(cleared)),
    { outcome: "fatal" },
    context
  );
  assert.equal(second.state.campaign.treasureMapFragments, 2);
});

test("the activated release advertises event-journal settlement while the previous release does not", () => {
  assert.equal(
    V08_META_1_LOCAL_RELEASE_DESCRIPTOR.capabilities.boundarySettlementMode,
    "event-journal-v1"
  );
  assert.equal(
    V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities.boundarySettlementMode,
    "event-journal-v1"
  );
  assert.notEqual(
    V08_META_1_INTEGRITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.capabilities.boundarySettlementMode,
    "event-journal-v1"
  );
});

test("capable fatal events settle the journal before a prevented fatal and keep the room open", async () => {
  const { state, context } = await activeRoom("run_boundary_event_fatal");
  state.build.resources.hasSecondChance = true;
  initializeRankEligibility(state, { integrityVersion: 1 });
  captureRankIntegrityRoomContext(state);
  const ruleset = V08_META_1_LOCAL_RELEASE_DESCRIPTOR.createRuleset();
  const result = await applyRulesetEvent(state, {
    type: "report_fatal_event",
    payload: {
      classification: "local_fatal_event",
      boundarySettlement: boundaryRequest(state, mapFragmentClaim(state))
    }
  }, ruleset, context);
  assert.equal(result.nextState.campaign.treasureMapFragments, 1);
  assert.equal(result.nextState.statistics.roomsCompleted, 0);
  assert.equal(result.nextState.currentRoomDirective.directiveId, state.currentRoomDirective.directiveId);
  assert.equal(result.nextState.lifeLedger.secondChancePreventions, 1);
});

test("an impossible boundary claim makes the run provisional but still resolves the fatal", async () => {
  const { state, context } = await activeRoom("run_boundary_event_invalid_claim");
  state.build.resources.hasSecondChance = true;
  initializeRankEligibility(state, { integrityVersion: 1 });
  captureRankIntegrityRoomContext(state);
  const ruleset = V08_META_1_LOCAL_RELEASE_DESCRIPTOR.createRuleset();
  const result = await applyRulesetEvent(state, {
    type: "report_fatal_event",
    payload: {
      classification: "local_fatal_event",
      boundarySettlement: boundaryRequest(state, [{
        claimType: "enemy",
        claimId: "enemy:invented_devtools_reward",
        count: 1
      }])
    }
  }, ruleset, context);
  assert.equal(result.nextState.rankEligibility, "provisional");
  assert.ok(result.nextState.rankIntegrity.reasonCodes.includes("BOUNDARY_SETTLEMENT_INVALID"));
  assert.equal(result.nextState.lifeLedger.secondChancePreventions, 1);
  assert.equal(result.nextState.currentRoomDirective.directiveId, state.currentRoomDirective.directiveId);
});

test("capable emergency extraction settles without clear and edited totals become provisional", async () => {
  const { state, context } = await activeRoom("run_boundary_event_emergency");
  initializeRankEligibility(state, { integrityVersion: 1 });
  captureRankIntegrityRoomContext(state);
  const ruleset = V08_META_1_LOCAL_RELEASE_DESCRIPTOR.createRuleset();
  const result = await applyRulesetEvent(state, {
    type: "request_extraction",
    payload: {
      mode: "emergency",
      boundarySettlement: boundaryRequest(state, mapFragmentClaim(state), {
        reportedGoldDelta: 99_999,
        reportedGoldTotal: 99_999
      })
    }
  }, ruleset, context);
  assert.equal(result.nextState.status, "extraction");
  assert.equal(result.nextState.statistics.roomsCompleted, 0);
  assert.equal(result.nextState.depth, state.depth);
  assert.equal(result.nextState.campaign.treasureMapFragments, 1);
  assert.equal(result.nextState.rankEligibility, "provisional");
});

test("the previous production capability contract rejects the new event journal fields", async () => {
  const context = {
    runId: "run_boundary_legacy_event",
    season: "boundary-season",
    startedAt: NOW,
    now: NOW,
    secret: SECRET,
    cryptoProvider: webcrypto,
    randomOracle: oracle()
  };
  const state = createInitialMetaStateV08({
    rulesetHash: V08_META_1_INTEGRITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash
  }, context);
  state.status = "active";
  const issued = await issueNextRoomDirectiveV08(state, context);
  const ruleset = V08_META_1_INTEGRITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.createRuleset();
  await assert.rejects(
    applyRulesetEvent(issued, {
      type: "request_extraction",
      payload: {
        mode: "emergency",
        boundarySettlement: boundaryRequest(issued, [])
      }
    }, ruleset, context),
    /EXTRACTION_PAYLOAD_INVALID_FIELDS/u
  );
});
