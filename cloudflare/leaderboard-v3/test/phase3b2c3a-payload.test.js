import test from "node:test";
import assert from "node:assert/strict";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  applyRelicAcquisition,
  createEmptyRelicBuildV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import {
  createPendingRelicTransactionV08,
  evaluateRelicAcquisition,
  projectPublicRelicReplacement
} from "../src/rulesets/v08-meta-1/relic-replacement.js";
import {
  commitRelicRewardFallback,
  projectPublicRelicFallbackReceiptV08
} from "../src/rulesets/v08-meta-1/relic-reward-fallback.js";

const context = Object.freeze({
  runId: "fallback-size-run",
  rulesetHash: manifest.rulesetHash,
  secret: "phase3b2c3a-size:0123456789abcdef0123456789abcdef"
});
const fullIds = [
  "fang", "plating", "lucky", "ironboots",
  "fieldrations", "trapweave", "cachekey", "scoutlens"
];

async function buildWith(ids) {
  let build = createEmptyRelicBuildV08();
  for (const [revision, relicId] of ids.entries()) {
    build = await applyRelicAcquisition(build, {
      relicId,
      acquiredRevision: revision,
      acquisitionSource: "boss_drop",
      sourceOfferId: `size_${revision}_${relicId}`
    });
  }
  return build;
}

async function replacementProjection(ids, incomingRelicId) {
  const state = createInitialMetaStateV08({}, {
    runId: "fallback-size-run",
    season: "season-phase3b2c3a",
    startedAt: 1_700_000_700_000
  });
  state.status = "active";
  state.build = await buildWith(ids);
  const acquisition = {
    incomingRelicId,
    incomingStacks: 1,
    acquisitionSource: "boss_drop",
    sourceOfferId: "offer_replacement",
    sourceChoiceId: "choice_incoming",
    sourceRewardSlotId: "slot_relic"
  };
  const decision = await evaluateRelicAcquisition(state, acquisition, context);
  assert.equal(decision.decision, "REQUIRE_REPLACEMENT");
  state.pendingRelicTransaction = await createPendingRelicTransactionV08(
    state,
    decision,
    context
  );
  return projectPublicRelicReplacement(state);
}

function fallbackState({ noReward = false } = {}) {
  const state = createInitialMetaStateV08({}, {
    runId: "fallback-size-run",
    season: "season-phase3b2c3a",
    startedAt: 1_700_000_700_000
  });
  state.status = "active";
  state.currentRoomDirective = {
    directiveId: "directive_size",
    revision: state.revision,
    roomType: "arena"
  };
  state.currentRewardEnvelope = {
    envelopeId: "envelope_size",
    runId: state.runId,
    rulesetHash: state.rulesetHash,
    directiveId: "directive_size",
    revision: state.revision,
    roomType: "arena",
    consumed: false,
    rewardSlots: [{
      slotId: "slot_size",
      slotType: "relic_reward",
      sourceType: "stored_relic_chest",
      sourceId: "arena-reward-cache",
      availabilityMode: noReward ? "future_arena_spec" : "stored_reward",
      canonicalStoredChoiceIds: noReward ? null : [],
      ...(noReward ? { canonicalCandidateCount: 0 } : {}),
      consumed: false,
      offerId: null,
      resolution: null
    }]
  };
  return state;
}

function fallbackRequest({ noReward = false } = {}) {
  return {
    sourceType: "stored_relic_chest",
    sourceId: "arena-reward-cache",
    sourceDirectiveId: "directive_size",
    rewardEnvelopeId: "envelope_size",
    rewardSlotId: "slot_size",
    acquisitionContext: noReward ? "pre_offer" : "stored_reward"
  };
}

test("Phase 3B2C3A measures fallback, NO_REWARD and replacement payloads", async () => {
  const fallback = await commitRelicRewardFallback(
    fallbackState(),
    fallbackRequest(),
    context
  );
  const noReward = await commitRelicRewardFallback(
    fallbackState({ noReward: true }),
    fallbackRequest({ noReward: true }),
    context
  );
  const fallbackResponse = projectPublicRelicFallbackReceiptV08(
    fallback.relicFallbackHistory.at(-1)
  );
  const noRewardResponse = projectPublicRelicFallbackReceiptV08(
    noReward.relicFallbackHistory.at(-1)
  );
  const pendingEight = await replacementProjection(fullIds, "adrenal");
  const maximum = await replacementProjection(
    ["abyssalreliquary", ...fullIds, "risk"],
    "crownconcord"
  );
  const bytes = {
    fallback: Buffer.byteLength(JSON.stringify(fallbackResponse), "utf8"),
    noReward: Buffer.byteLength(JSON.stringify(noRewardResponse), "utf8"),
    pendingEight: Buffer.byteLength(JSON.stringify(pendingEight), "utf8"),
    maximumReplacement: Buffer.byteLength(JSON.stringify(maximum), "utf8")
  };
  assert.equal(pendingEight.choices.length, 8);
  assert.equal(bytes.maximumReplacement, 14_484);
  assert.ok(bytes.fallback < 1024);
  assert.ok(bytes.noReward < 1024);
  const operation = {
    idempotencyKey: "x".repeat(64),
    requestDigest: "a".repeat(64),
    responseBody: maximum
  };
  const recent12 = Buffer.byteLength(
    JSON.stringify(Array.from({ length: 12 }, () => operation)),
    "utf8"
  );
  const recent24 = Buffer.byteLength(
    JSON.stringify(Array.from({ length: 24 }, () => operation)),
    "utf8"
  );
  console.info(
    `Phase 3B2C3A payload bytes: ${JSON.stringify({ ...bytes, recent12, recent24 })}`
  );
});
