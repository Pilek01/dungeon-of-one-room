import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  issueNextRoomDirectiveV08
} from "../src/rulesets/v08-meta-1/room-policy.js";
import {
  settleRoomRewardEnvelopeV3
} from "../src/rulesets/v08-meta-1/reward-policy.js";
import {
  applyRelicAcquisition,
  computeRelicBuildDigestV08,
  createEmptyRelicBuildV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";

function zeroOracle() {
  return {
    async deriveRandomBytes(options) {
      const bytes = new Uint8Array(options.length);
      let offset = 0;
      let block = 0;
      while (offset < bytes.length) {
        const digest = createHash("sha256")
          .update(JSON.stringify({
            runId: options.runId,
            revision: options.revision,
            purpose: options.purpose,
            counter: options.counter,
            block
          }))
          .digest();
        const take = Math.min(digest.length, bytes.length - offset);
        bytes.set(digest.subarray(0, take), offset);
        offset += take;
        block += 1;
      }
      return bytes;
    },
    async deriveIntInclusive(min) {
      return min;
    }
  };
}

const baseContext = {
  runId: "run_ranked_proc_gold",
  season: "season-ranked-proc-gold",
  startedAt: 1_700_000_000_000,
  secret: "ranked-proc-gold:0123456789abcdef0123456789abcdef",
  randomOracle: zeroOracle()
};

async function issuedState({ relics = [], capabilities = { boundedProcClaims: "v1" } } = {}) {
  let state = createInitialMetaStateV08({
    runId: baseContext.runId,
    season: baseContext.season
  }, baseContext);
  state.status = "active";
  let build = createEmptyRelicBuildV08();
  for (const relicId of relics) {
    build = await applyRelicAcquisition(build, {
      relicId,
      acquiredRevision: state.revision,
      acquisitionSource: "ranked_proc_gold_test",
      sourceOfferId: `test_${relicId}`
    });
  }
  state.build = build;
  return issueNextRoomDirectiveV08(state, { ...baseContext, capabilities });
}

function requestFor(state, claims, overrides = {}) {
  const fixed = state.currentRewardEnvelope.fixedAwards.reduce(
    (sum, award) => sum + award.amount,
    0
  );
  return {
    envelopeId: state.currentRewardEnvelope.envelopeId,
    roomDirectiveId: state.currentRoomDirective.directiveId,
    roomNonce: state.currentRoomDirective.roomNonce,
    claims,
    reportedGoldDelta: fixed,
    reportedGoldTotal: state.gold + fixed,
    turnCount: 10,
    elapsedMs: 1_000,
    commandJournalDigest: "journal_ranked_proc_gold",
    compactRoomProof: "proof_ranked_proc_gold",
    ...overrides
  };
}

async function rejectUnchanged(state, request, code) {
  const before = structuredClone(state);
  await assert.rejects(settleRoomRewardEnvelopeV3(state, request, {
    capabilities: { boundedProcClaims: "v1" }
  }), new RegExp(code, "u"));
  assert.deepEqual(state, before);
}

test("Void Reaper proc is bounded by accepted enemy and elite kills", async () => {
  const state = await issuedState({ relics: ["voidreaper"] });
  const claims = [
    { claimType: "enemy", claimId: "enemy:slime", count: 2 },
    { claimType: "elite", claimId: "elite:slime", count: 1 },
    { claimType: "proc", claimId: "void-reaper-crit-kill", count: 3 }
  ];
  const authoritativeGoldDelta = 2 + (2 * 2) + (1 * 2) + (3 * 10);
  const result = await settleRoomRewardEnvelopeV3(
    state,
    requestFor(state, claims, {
      reportedGoldDelta: authoritativeGoldDelta,
      reportedGoldTotal: state.gold + authoritativeGoldDelta
    }),
    { capabilities: { boundedProcClaims: "v1" } }
  );
  assert.equal(result.authoritativeGoldDelta, authoritativeGoldDelta);
  assert.deepEqual(result.anomalies, []);
});

test("Void Reaper uses the global multiplier but excludes Bounty Contract", async () => {
  const state = await issuedState({ relics: ["voidreaper", "idol"] });
  state.build.campUpgrades.bounty_contract = 5;
  state.build.buildDigest = await computeRelicBuildDigestV08(state.build);
  const claims = [{ claimType: "proc", claimId: "void-reaper-crit-kill", count: 1 }];
  const acceptedKills = [{ claimType: "enemy", claimId: "enemy:slime", count: 1 }];
  const result = await settleRoomRewardEnvelopeV3(
    state,
    requestFor(state, [...acceptedKills, ...claims], {
      reportedGoldDelta: 2 + 3 + 12,
      reportedGoldTotal: 17
    }),
    { capabilities: { boundedProcClaims: "v1" } }
  );
  assert.equal(result.authoritativeGoldDelta, 17);
  assert.deepEqual(result.anomalies, []);
});

test("Void Reaper excludes hazards from its evidence cap", async () => {
  const state = await issuedState({ relics: ["voidreaper"] });
  await rejectUnchanged(
    state,
    requestFor(state, [
      { claimType: "enemy", claimId: "enemy:slime", count: 1 },
      { claimType: "hazard", claimId: "hazard-kill", count: 1 },
      { claimType: "proc", claimId: "void-reaper-crit-kill", count: 2 }
    ]),
    "REWARD_PROC_VOID_REAPER_CAP"
  );
});

test("Chaos Orb proc is capped by the room-local turn count and stays flat", async () => {
  const state = await issuedState({ relics: ["chaosorb", "idol"] });
  const count = 2;
  const result = await settleRoomRewardEnvelopeV3(
    state,
    requestFor(state, [{ claimType: "proc", claimId: "chaos-orb-gold-roll", count }], {
      turnCount: 11,
      reportedGoldDelta: 2 + count * 20,
      reportedGoldTotal: 2 + count * 20
    }),
    { capabilities: { boundedProcClaims: "v1" } }
  );
  assert.equal(result.authoritativeGoldDelta, 42);
  assert.deepEqual(result.anomalies, []);
});

test("proc claims reject missing relics, invalid counts, unknown ids, duplicates, and over-cap requests", async () => {
  const missing = await issuedState();
  await rejectUnchanged(
    missing,
    requestFor(missing, [{ claimType: "proc", claimId: "void-reaper-crit-kill", count: 1 }]),
    "REWARD_CLAIM_ID_UNKNOWN"
  );

  const invalid = await issuedState({ relics: ["chaosorb"] });
  for (const count of [0, -1, 1.5]) {
    await rejectUnchanged(
      invalid,
      requestFor(invalid, [{ claimType: "proc", claimId: "chaos-orb-gold-roll", count }]),
      "REWARD_CLAIM_COUNT_INVALID"
    );
  }
  await rejectUnchanged(
    invalid,
    requestFor(invalid, [{ claimType: "proc", claimId: "chaos-orb-not-real", count: 1 }]),
    "REWARD_CLAIM_ID_UNKNOWN"
  );
  await rejectUnchanged(
    invalid,
    requestFor(invalid, [
      { claimType: "proc", claimId: "chaos-orb-gold-roll", count: 1 },
      { claimType: "proc", claimId: "chaos-orb-gold-roll", count: 1 }
    ]),
    "REWARD_CLAIM_DUPLICATE"
  );
  await rejectUnchanged(
    invalid,
    requestFor(invalid, [{ claimType: "proc", claimId: "chaos-orb-gold-roll", count: 2 }], { turnCount: 10 }),
    "REWARD_PROC_CHAOS_ORB_CAP"
  );
});

test("old capability envelopes do not advertise bounded proc claims", async () => {
  const state = await issuedState({ relics: ["voidreaper"], capabilities: {} });
  assert.equal(
    state.currentRewardEnvelope.boundedClaims.some((claim) => claim.claimType === "proc"),
    false
  );
});

test("extra unexplained gold remains provisional while exact proc totals stay official", async () => {
  const state = await issuedState({ relics: ["chaosorb"] });
  const result = await settleRoomRewardEnvelopeV3(
    state,
    requestFor(state, [{ claimType: "proc", claimId: "chaos-orb-gold-roll", count: 1 }], {
      turnCount: 1,
      reportedGoldDelta: 999,
      reportedGoldTotal: 999
    }),
    { capabilities: { boundedProcClaims: "v1" } }
  );
  assert.equal(result.authoritativeGoldDelta, 22);
  assert.ok(result.anomalies.includes("REPORTED_GOLD_DELTA_MISMATCH"));
  assert.ok(result.anomalies.includes("REPORTED_GOLD_TOTAL_MISMATCH"));
  assert.equal(result.state.gold, 22);
});
