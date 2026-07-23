import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  issueNextRoomDirectiveV08
} from "../src/rulesets/v08-meta-1/room-policy.js";
import {
  settleRoomRewardEnvelopeV3
} from "../src/rulesets/v08-meta-1/reward-policy.js";

function seededOracle(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  }
  return {
    async deriveRandomBytes(options) {
      return Uint8Array.from({ length: options.length }, () => next() & 255);
    },
    async deriveIntInclusive(min, max) {
      return min + (next() % (max - min + 1));
    }
  };
}

function context(seed, runId = `property_${seed}`) {
  return {
    runId,
    season: "season-phase3b2a-property",
    startedAt: 1_700_000_000_000,
    secret: "property:0123456789abcdef0123456789abcdef",
    randomOracle: seededOracle(seed)
  };
}

async function issued(seed, build) {
  const resolved = context(seed);
  const initial = createInitialMetaStateV08(
    { runId: resolved.runId, season: resolved.season },
    resolved
  );
  if (build) initial.build = structuredClone(build);
  return issueNextRoomDirectiveV08(initial, resolved);
}

function requestFor(state, overrides = {}) {
  const fixed = state.currentRewardEnvelope.fixedAwards.reduce(
    (sum, award) => sum + award.amount,
    0
  );
  return {
    envelopeId: state.currentRewardEnvelope.envelopeId,
    roomDirectiveId: state.currentRoomDirective.directiveId,
    roomNonce: state.currentRoomDirective.roomNonce,
    claims: [],
    reportedGoldDelta: fixed,
    reportedGoldTotal: state.gold + fixed,
    turnCount: 10,
    elapsedMs: 1_000,
    commandJournalDigest: "journal",
    compactRoomProof: "proof",
    ...overrides
  };
}

test("reported client totals never become authoritative totals", async () => {
  const state = await issued(1);
  const low = await settleRoomRewardEnvelopeV3(
    state,
    requestFor(state, { reportedGoldTotal: 10_000, reportedGoldDelta: 10_000 })
  );
  assert.equal(low.state.gold, low.authoritativeGoldDelta);
  assert.notEqual(low.state.gold, 10_000);
});

test("reported totals do not change the authoritative result", async () => {
  const left = await issued(2, undefined);
  const right = structuredClone(left);
  const a = await settleRoomRewardEnvelopeV3(left, requestFor(left, { reportedGoldTotal: 0 }));
  const b = await settleRoomRewardEnvelopeV3(right, requestFor(right, { reportedGoldTotal: 999_999 }));
  assert.equal(a.authoritativeGoldDelta, b.authoritativeGoldDelta);
  assert.equal(a.state.gold, b.state.gold);
});

test("fixed awards, slots, and envelope are consumed at most once", async () => {
  const state = await issued(3);
  const chestBase = state.currentRoomDirective.roomType === "treasure" ? 24 : 4;
  const request = requestFor(state, {
    claims: [{
      claimType: "chest",
      claimId: "chest_1",
      count: 1,
      localEvidence: { outcome: "gold", baseAmount: chestBase }
    }],
    reportedGoldDelta: state.currentRewardEnvelope.fixedAwards[0].amount + chestBase,
    reportedGoldTotal: state.currentRewardEnvelope.fixedAwards[0].amount + chestBase
  });
  const first = await settleRoomRewardEnvelopeV3(state, request);
  const retry = await settleRoomRewardEnvelopeV3(first.state, request);
  assert.deepEqual(retry.state, first.state);
  assert.equal(retry.state.goldLedger.roomClaimsAccepted, 1);
  assert.equal(retry.state.currentRewardEnvelope.claimSlots[0].consumed, true);
  assert.equal(retry.state.currentRewardEnvelope.consumed, true);
});

test("ledger, gold, build modifiers, and fake client build preserve invariants", async () => {
  const plain = await issued(4);
  const modified = await issued(4, {
    relics: ["idol"],
    mutators: [],
    pacts: [],
    campUpgrades: {},
    skillTiers: {},
    elixirs: []
  });
  const plainResult = await settleRoomRewardEnvelopeV3(
    plain,
    requestFor(plain, { clientBuild: { relics: ["idol"] } })
  );
  const modifiedResult = await settleRoomRewardEnvelopeV3(
    modified,
    requestFor(modified)
  );
  assert.ok(modifiedResult.authoritativeGoldDelta >= plainResult.authoritativeGoldDelta);
  assert.equal(
    plainResult.state.gold,
    plainResult.state.goldLedger.earnedServerDerived +
      plainResult.state.goldLedger.earnedBoundedAttested -
      plainResult.state.goldLedger.spentServerDerived
  );
  assert.ok(plainResult.state.gold >= 0);
});

test("1000 seeded envelopes stay deterministic and within all hard limits", async () => {
  for (let seed = 1; seed <= 1_000; seed += 1) {
    const first = await issued(seed);
    const second = await issued(seed);
    assert.deepEqual(first.currentRoomDirective, second.currentRoomDirective);
    assert.deepEqual(first.currentRewardEnvelope, second.currentRewardEnvelope);
    const envelope = first.currentRewardEnvelope;
    assert.ok(envelope.maximumGoldDelta >= envelope.fixedAwards[0].amount);
    assert.ok(envelope.maximumGoldDelta <= 10_000);
    assert.ok(envelope.claimSlots.length <= 10);
    assert.ok(envelope.boundedClaims.every(
      (claim) => claim.maximumCount >= 0 && claim.maximumCount <= 18
    ));
    const request = requestFor(first);
    const settled = await settleRoomRewardEnvelopeV3(first, request);
    assert.ok(settled.authoritativeGoldDelta <= envelope.maximumGoldDelta);
    assert.ok(settled.state.gold >= 0);
    const replay = await settleRoomRewardEnvelopeV3(settled.state, request);
    assert.deepEqual(replay.state, settled.state);
  }
});

test("predicted pure gold settlement response stays compact", async (t) => {
  const state = await issued(1);
  const result = await settleRoomRewardEnvelopeV3(state, requestFor(state));
  const projectedResponse = {
    runId: result.state.runId,
    rulesetHash: result.state.rulesetHash,
    revision: result.state.revision,
    gold: result.state.gold,
    goldLedger: result.state.goldLedger,
    rewardSettlement: {
      envelopeId: result.state.currentRewardEnvelope.envelopeId,
      authoritativeGoldDelta: result.authoritativeGoldDelta,
      anomalies: result.anomalies,
      replayed: result.replayed
    }
  };
  const bytes = Buffer.byteLength(JSON.stringify(projectedResponse), "utf8");
  t.diagnostic(`predicted pure gold settlement response: ${bytes} bytes`);
  assert.ok(bytes < 4_096);
});
