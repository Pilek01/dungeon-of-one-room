import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import test from "node:test";
import { errorFromCause } from "../src/http/errors.js";
import { settleBoundaryRewardEnvelopeV3, settleRoomRewardEnvelopeV3 } from "../src/rulesets/v08-meta-1/reward-policy.js";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { computeRelicBuildDigestV08 } from "../src/rulesets/v08-meta-1/relic-policy.js";
import { issueNextRoomDirectiveV08 } from "../src/rulesets/v08-meta-1/room-policy.js";

const SECRET = "ranked-boundary-resources:0123456789abcdef0123456789abcdef";
const CAPS = Object.freeze({
  boundarySettlementMode: "event-journal-v1",
  boundedCombatResources: "v1"
});

function oracle() {
  return {
    async deriveRandomBytes(options) {
      const digest = createHash("sha256")
        .update([SECRET, options.runId, options.revision, options.purpose, options.counter].join("|"))
        .digest();
      return new Uint8Array(digest.subarray(0, options.length));
    },
    async deriveIntInclusive(minimum) {
      return minimum;
    }
  };
}

async function activeRoom(runId = "boundary-resources") {
  const context = {
    runId,
    season: "boundary-resources",
    startedAt: 1_900_100_000_000,
    now: 1_900_100_000_000,
    secret: SECRET,
    cryptoProvider: webcrypto,
    randomOracle: oracle(),
    capabilities: CAPS
  };
  let state = createInitialMetaStateV08({}, context);
  state.status = "active";
  state.build.resources.hp = 80;
  state.build.resources.maxHp = 100;
  state.build.resources.combatBoostTurns = 5;
  state.build.resources.combatBoostAttack = 20;
  state.build.resources.combatBoostArmor = 20;
  state.build.resources.highestUnlockedDepth = 19;
  if (runId.includes("depth")) state.depth = 19;
  state = await issueNextRoomDirectiveV08(state, context);
  return { state, context };
}

function request(state, overrides = {}) {
  return {
    envelopeId: state.currentRewardEnvelope.envelopeId,
    roomDirectiveId: state.currentRoomDirective.directiveId,
    roomNonce: state.currentRoomDirective.roomNonce,
    claims: [],
    reportedGoldDelta: 0,
    reportedGoldTotal: state.gold,
    turnCount: 3,
    elapsedMs: 100,
    commandJournalDigest: "boundary-resource-journal",
    compactRoomProof: "boundary-resource-proof",
    combatResources: { hp: 40, maxHp: 100 },
    ...overrides
  };
}

test("bounded combat resources require exactly hp and maxHp with canonical bounds", async () => {
  const { state, context } = await activeRoom("boundary-resource-validation");
  for (const combatResources of [
    { hp: 40, maxHp: 100, extra: 1 },
    { hp: -1, maxHp: 100 },
    { hp: 101, maxHp: 100 },
    { hp: 40.5, maxHp: 100 },
    { hp: 40, maxHp: 99 }
  ]) {
    await assert.rejects(
      settleBoundaryRewardEnvelopeV3(
        state,
        request(state, { combatResources }),
        { outcome: "fatal" },
        context
      ),
      /BOUNDARY_COMBAT_RESOURCES/u
    );
  }
});

test("bounded combat resource validation errors remain actionable instead of INTERNAL_ERROR", () => {
  const mapped = errorFromCause(
    new TypeError("BOUNDARY_COMBAT_RESOURCES_MAX_MISMATCH")
  );
  assert.equal(mapped.status, 422);
  assert.equal(mapped.code, "BOUNDARY_COMBAT_RESOURCES_MAX_MISMATCH");
});

test("accepted boundary applies hp and turn/boost exactly once and exact replay is digest-keyed", async () => {
  const { state, context } = await activeRoom("boundary-resource-replay");
  const payload = request(state);
  const first = await settleBoundaryRewardEnvelopeV3(
    state,
    payload,
    { outcome: "fatal" },
    context
  );
  assert.equal(first.state.build.resources.hp, 40);
  assert.equal(first.state.build.resources.turn, 3);
  assert.equal(first.state.build.resources.combatBoostTurns, 2);
  assert.equal(first.state.build.resources.combatBoostAttack, 20);
  assert.equal(first.state.build.resources.combatBoostArmor, 20);
  assert.equal(
    await computeRelicBuildDigestV08(first.state.build, webcrypto),
    first.state.build.buildDigest
  );

  const replay = await settleBoundaryRewardEnvelopeV3(
    first.state,
    payload,
    { outcome: "fatal" },
    context
  );
  assert.equal(replay.replayed, true);
  assert.equal(replay.state.build.resources.hp, 40);
  assert.equal(replay.state.build.resources.turn, 3);
  assert.equal(replay.state.build.resources.combatBoostTurns, 2);
  await assert.rejects(
    settleBoundaryRewardEnvelopeV3(
      first.state,
      request(first.state, { combatResources: { hp: 41, maxHp: 100 } }),
      { outcome: "fatal" },
      context
    ),
    /REWARD_IDEMPOTENCY_PAYLOAD_MISMATCH/u
  );
});

test("accepted cleared depth unlock updates only highestUnlockedDepth and lower hp cannot alter canonical benefits", async () => {
  const { state, context } = await activeRoom("boundary-resource-depth");
  const before = structuredClone(state);
  const result = await settleRoomRewardEnvelopeV3(
    state,
    request(state, { combatResources: { hp: 1, maxHp: 100 } }),
    context
  );
  assert.equal(result.state.build.resources.hp, 1);
  assert.equal(result.state.build.resources.highestUnlockedDepth, 20);
  const fixedGold = before.currentRewardEnvelope.fixedAwards.reduce((sum, award) => sum + award.amount, 0);
  assert.equal(result.state.gold, before.gold + fixedGold);
  assert.equal(result.state.build.resources.maxHp, before.build.resources.maxHp);
  assert.deepEqual(result.state.build.relics, before.build.relics);
  assert.deepEqual(result.state.build.resources.potions, before.build.resources.potions);
  assert.deepEqual(result.state.build.elixirs, before.build.elixirs);
  assert.deepEqual(result.state.runModifiers, before.runModifiers);
  assert.equal(result.state.rankEligibility, before.rankEligibility);
});

test("fatal boundary does not advance highestUnlockedDepth", async () => {
  const { state, context } = await activeRoom("boundary-resource-fatal-depth");
  const result = await settleBoundaryRewardEnvelopeV3(
    state,
    request(state),
    { outcome: "fatal" },
    context
  );
  assert.equal(result.state.build.resources.highestUnlockedDepth, 19);
});

test("combat boost clears attack and armor exactly when the boundary delta expires it", async () => {
  const { state, context } = await activeRoom("boundary-resource-boost-expiry");
  state.build.resources.combatBoostTurns = 3;
  state.build.resources.combatBoostAttack = 20;
  state.build.resources.combatBoostArmor = 20;
  const result = await settleBoundaryRewardEnvelopeV3(
    state,
    request(state, { turnCount: 3 }),
    { outcome: "fatal" },
    context
  );
  assert.equal(result.state.build.resources.combatBoostTurns, 0);
  assert.equal(result.state.build.resources.combatBoostAttack, 0);
  assert.equal(result.state.build.resources.combatBoostArmor, 0);
});

test("different fatal command journal starts a new settlement and retries exactly", async () => {
  const { state, context } = await activeRoom("boundary-resource-journal-sequence");
  const firstPayload = request(state, {
    commandJournalDigest: "boundary-resource-journal-1"
  });
  const first = await settleBoundaryRewardEnvelopeV3(
    state,
    firstPayload,
    { outcome: "fatal" },
    context
  );
  const secondPayload = request(first.state, {
    commandJournalDigest: "boundary-resource-journal-2",
    combatResources: { hp: 30, maxHp: 100 },
    turnCount: 1
  });
  const second = await settleBoundaryRewardEnvelopeV3(
    first.state,
    secondPayload,
    { outcome: "fatal" },
    context
  );
  assert.equal(second.replayed, false);
  assert.equal(second.state.build.resources.hp, 30);
  assert.equal(second.state.build.resources.turn, 4);
  assert.equal(second.state.rewardSettlementHistory.length, 2);
  assert.equal(
    await computeRelicBuildDigestV08(second.state.build, webcrypto),
    second.state.build.buildDigest
  );

  const replay = await settleBoundaryRewardEnvelopeV3(
    second.state,
    secondPayload,
    { outcome: "fatal" },
    context
  );
  assert.equal(replay.replayed, true);
  assert.equal(replay.state.build.resources.turn, 4);
  assert.equal(replay.state.rewardSettlementHistory.length, 2);
});
