import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import {
  createAuthenticatedRunBootstrap,
  selectAuthenticatedStartingRelic
} from "../src/domain/run-bootstrap.js";
import {
  applyRulesetCheckpoint,
  applyRulesetEvent,
  finalizeRulesetRun,
  publicRulesetMetaState
} from "../src/domain/ruleset-runtime.js";
import {
  captureRankIntegrityRoomContext,
  checkpointGoldIntegrityReasons,
  V08_LOCAL_ELITE_REWARD_BONUS
} from "../src/domain/rank-eligibility.js";
import { calculateEnemyGoldV08 } from "../src/rulesets/v08-meta-1/gold-policy.js";
import { createV08Meta1Ruleset } from "../src/rulesets/v08-meta-1/index.js";
import { applyRelicAcquisition } from "../src/rulesets/v08-meta-1/relic-policy.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };
import { TEST_SECRET } from "./fixtures/harness.js";

const NOW = 1_860_000_000_000;

async function activeState(seed = 1) {
  const ruleset = createV08Meta1Ruleset({
    secret: TEST_SECRET,
    cryptoProvider: webcrypto
  });
  const bootstrap = await createAuthenticatedRunBootstrap({
    playerName: "Integrity",
    season: "integrity-season",
    gameVersion: "0.8.1",
    rulesetId: "v08-meta-1",
    rulesetHash: manifest.rulesetHash,
    clientInstallIdHash: `install_integrity_${seed}`
  }, {
    ruleset,
    secret: TEST_SECRET,
    cryptoProvider: webcrypto,
    now: NOW + seed,
    runId: `run_${seed.toString(16).padStart(16, "0")}`,
    bootstrapNonce: `bootstrap_integrity_${seed}`,
    profileId: `profile_${seed.toString(16).padStart(32, "0")}`
  });
  const offer = bootstrap.nextState.pendingOffer;
  const selected = await selectAuthenticatedStartingRelic(
    bootstrap.nextState,
    {
      offerId: offer.offerId,
      choiceId: offer.choices[0].choiceId
    },
    {
      ruleset,
      secret: TEST_SECRET,
      cryptoProvider: webcrypto
    }
  );
  return { ruleset, state: selected.nextState };
}

function checkpointBody(state, overrides = {}) {
  const authoritativeDelta = state.currentRewardEnvelope.fixedAwards.reduce(
    (sum, award) => sum + award.amount,
    0
  );
  return {
    roomResult: "cleared",
    rewardClaims: [],
    turnCount: 3,
    elapsedMs: 1_000,
    commandJournalDigest: "integrity_journal_0123456789abcdef",
    compactRoomProof: {
      version: 1,
      roomDirectiveId: state.currentRoomDirective.directiveId,
      roomNonce: state.currentRoomDirective.roomNonce,
      commands: []
    },
    integrityVersion: 1,
    integritySignals: [],
    reportedGoldDelta: authoritativeDelta,
    reportedGoldTotal: state.gold + authoritativeDelta,
    ...overrides
  };
}

async function checkpoint(value, overrides = {}) {
  return applyRulesetCheckpoint(
    value.state,
    checkpointBody(value.state, overrides),
    value.ruleset,
    {
      secret: TEST_SECRET,
      cryptoProvider: webcrypto,
      now: NOW + value.state.revision
    }
  );
}

test("new Ranked runs start eligible for the official leaderboard", async () => {
  const { ruleset, state } = await activeState(1);
  assert.equal(state.rankEligibility, "official");
  assert.equal(publicRulesetMetaState(state, ruleset).rankEligibility, "official");
});

test("potion-only checkpoint is bounded and leaves Fury/elixir state byte-equivalent", async () => {
  const value = await activeState(4);
  value.state.build.resources.potions = 2;
  value.state.build.elixirs = [{ elixirId: "fury_1", charges: 3 }];
  const before = structuredClone(value.state);
  const result = await checkpoint(value, {
    rewardClaims: [{ claimType: "resource", claimId: "potion-use", count: 1 }]
  });

  assert.equal(result.nextState.build.resources.potions, 1);
  assert.deepEqual(result.nextState.build.elixirs, before.build.elixirs);
  assert.deepEqual(result.nextState.runModifiers, before.runModifiers);
  assert.equal(result.nextState.build.resources.maxPotions, before.build.resources.maxPotions);
  assert.equal(value.state.build.resources.potions, before.build.resources.potions);

  await assert.rejects(
    checkpoint(value, {
      rewardClaims: [{ claimType: "resource", claimId: "potion-use", count: 3 }]
    }),
    /REWARD_CLAIM_POTION_USE_LIMIT/u
  );
});

test("an invalid local room-completion capability makes the run provisional", async () => {
  const value = await activeState(2);
  const result = await checkpoint(value, {
    integritySignals: ["local_room_completion_capability_invalid"]
  });
  assert.equal(result.nextState.rankEligibility, "provisional");
  assert.deepEqual(result.nextState.rankIntegrity.reasonCodes, [
    "local_room_completion_capability_invalid"
  ]);
  assert.equal(
    publicRulesetMetaState(result.nextState, value.ruleset).rankEligibility,
    "provisional"
  );
  assert.deepEqual(
    publicRulesetMetaState(result.nextState, value.ruleset).rankIntegrity,
    {
      reasonCodes: ["local_room_completion_capability_invalid"],
      firstDetectedRevision: result.nextState.rankIntegrity.firstDetectedRevision
    }
  );
});

test("a local gold delta that disagrees with canonical rewards makes the run provisional", async () => {
  const value = await activeState(3);
  const result = await checkpoint(value, { reportedGoldDelta: 99_999 });
  assert.equal(result.nextState.rankEligibility, "provisional");
  assert(result.nextState.rankIntegrity.reasonCodes.includes(
    "REPORTED_GOLD_DELTA_MISMATCH"
  ));
});

test("the local v0.8 elite bonus is accepted with canonical build and mutator multipliers", async () => {
  const value = await activeState(30);
  const fixedGold = value.state.currentRewardEnvelope.fixedAwards.reduce(
    (sum, award) => sum + award.amount,
    0
  );
  const common = {
    canonicalBuild: value.state.build,
    canonicalRunModifiers: value.state.runModifiers,
    enemyType: "slime",
    elite: true
  };
  const canonicalDelta = fixedGold + calculateEnemyGoldV08({
    ...common,
    rewardBonus: 0
  });
  const expectedLocalDelta = fixedGold + calculateEnemyGoldV08({
    ...common,
    rewardBonus: V08_LOCAL_ELITE_REWARD_BONUS
  });
  const body = checkpointBody(value.state, {
    rewardClaims: [{ claimType: "elite", claimId: "elite:slime", count: 1 }],
    reportedGoldDelta: expectedLocalDelta,
    reportedGoldTotal: value.state.gold + expectedLocalDelta
  });
  assert.deepEqual(
    checkpointGoldIntegrityReasons(value.state, body, canonicalDelta),
    []
  );
  assert.deepEqual(
    checkpointGoldIntegrityReasons(value.state, {
      ...body,
      reportedGoldDelta: expectedLocalDelta + 1,
      reportedGoldTotal: value.state.gold + expectedLocalDelta + 1
    }, canonicalDelta),
    ["REPORTED_GOLD_DELTA_MISMATCH", "REPORTED_GOLD_TOTAL_MISMATCH"]
  );
});

test("the first active room captures its gold integrity context", async () => {
  const value = await activeState(32);
  assert.equal(
    value.state.rankIntegrity.roomGoldContext.directiveId,
    value.state.currentRoomDirective.directiveId
  );
  assert.deepEqual(value.state.rankIntegrity.roomGoldContext.build, value.state.build);
  assert.deepEqual(
    value.state.rankIntegrity.roomGoldContext.runModifiers,
    value.state.runModifiers
  );
});

test("a relic acquired after room clear does not change the room gold integrity baseline", async () => {
  const value = await activeState(33);
  const roomStartState = structuredClone(value.state);
  value.state.build = await applyRelicAcquisition(value.state.build, {
    relicId: "idol",
    acquiredRevision: value.state.revision,
    acquisitionSource: "boss_drop",
    sourceOfferId: "offer_integrity_timing"
  }, { cryptoProvider: webcrypto });
  captureRankIntegrityRoomContext(value.state);
  assert.deepEqual(
    value.state.rankIntegrity.roomGoldContext.build,
    roomStartState.build,
    "same-room meta transactions must not rewrite the room-start gold context"
  );
  const fixedGold = roomStartState.currentRewardEnvelope.fixedAwards.reduce(
    (sum, award) => sum + award.amount,
    0
  );
  const localEnemyGold = calculateEnemyGoldV08({
    canonicalBuild: roomStartState.build,
    canonicalRunModifiers: roomStartState.runModifiers,
    enemyType: "skeleton",
    elite: true,
    rewardBonus: V08_LOCAL_ELITE_REWARD_BONUS
  });
  const reportedGoldDelta = fixedGold + localEnemyGold;
  const result = await checkpoint(value, {
    rewardClaims: [{ claimType: "elite", claimId: "elite:skeleton", count: 1 }],
    reportedGoldDelta,
    reportedGoldTotal: value.state.gold + reportedGoldDelta
  });
  assert.equal(result.nextState.rankEligibility, "official");
  assert.equal(
    result.nextState.rankIntegrity.roomGoldContext.directiveId,
    result.nextState.currentRoomDirective.directiveId
  );
  assert.deepEqual(
    result.nextState.rankIntegrity.roomGoldContext.build,
    result.nextState.build
  );
});


test("a new run cannot bypass integrity by omitting the whole envelope", async () => {
  const value = await activeState(31);
  const result = await checkpoint(value, {
    integrityVersion: undefined,
    integritySignals: undefined,
    reportedGoldDelta: undefined,
    reportedGoldTotal: undefined
  });
  assert.equal(result.nextState.rankEligibility, "provisional");
  assert(result.nextState.rankIntegrity.reasonCodes.includes(
    "CHECKPOINT_INTEGRITY_ENVELOPE_MISSING"
  ));
});

test("a canonical legacy run remains compatible without the integrity envelope", async () => {
  const value = await activeState(32);
  const legacyState = structuredClone(value.state);
  delete legacyState.rankEligibility;
  delete legacyState.rankIntegrity;
  const result = await checkpoint({ ...value, state: legacyState }, {
    integrityVersion: undefined,
    integritySignals: undefined,
    reportedGoldDelta: undefined,
    reportedGoldTotal: undefined
  });
  assert.equal(result.nextState.rankEligibility, "official");
  assert.equal(result.nextState.rankIntegrity.version, 0);
});

test("provisional eligibility cannot return to official after a clean checkpoint", async () => {
  const value = await activeState(4);
  const first = await checkpoint(value, {
    integritySignals: ["local_room_completion_capability_invalid"]
  });
  const second = await checkpoint({ ruleset: value.ruleset, state: first.nextState });
  assert.equal(second.nextState.rankEligibility, "provisional");
  assert.deepEqual(second.nextState.rankIntegrity.reasonCodes, [
    "local_room_completion_capability_invalid"
  ]);
});

test("a provisional life loss does not publish a death snapshot", async () => {
  const value = await activeState(5);
  value.state.rankEligibility = "provisional";
  value.state.rankIntegrity = {
    version: 1,
    reasonCodes: ["local_room_completion_capability_invalid"],
    firstDetectedRevision: value.state.revision
  };
  const result = await applyRulesetEvent(
    value.state,
    {
      type: "report_fatal_event",
      payload: { classification: "local_fatal_event" }
    },
    value.ruleset,
    { secret: TEST_SECRET, cryptoProvider: webcrypto, now: NOW + 5 }
  );
  assert.equal(result.nextState.status, "active");
  assert.equal(
    result.storageEffects.some((effect) => effect.type === "upsert_leaderboard_snapshot"),
    false
  );
});

test("finalizing a provisional defeat does not publish a leaderboard entry", async () => {
  const value = await activeState(6);
  const terminal = structuredClone(value.state);
  terminal.rankEligibility = "provisional";
  terminal.rankIntegrity = {
    version: 1,
    reasonCodes: ["REPORTED_GOLD_DELTA_MISMATCH"],
    firstDetectedRevision: terminal.revision
  };
  terminal.status = "defeat";
  terminal.currentRoomDirective = null;
  terminal.currentRewardEnvelope = null;
  terminal.pendingOffer = null;
  terminal.pendingRelicTransaction = null;
  terminal.pendingInventory = null;
  terminal.terminalEligibility = {
    outcome: "defeat",
    eligibleRevision: terminal.revision,
    reason: "integrity_test"
  };
  const result = finalizeRulesetRun(terminal, value.ruleset, { now: NOW + 10_000 });
  assert.equal(result.nextState.rankEligibility, "provisional");
  assert.equal(result.response.rankEligibility, "provisional");
  assert.equal("leaderboardEntryId" in result.response, false);
  assert.equal(
    result.storageEffects.some((effect) => effect.type === "upsert_leaderboard_snapshot"),
    false
  );
});
