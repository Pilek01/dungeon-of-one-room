import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };
import fallbackPolicy from "../src/rulesets/v08-meta-1/data/relic-reward-fallback-policy.generated.json" with { type: "json" };
import {
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  applyRelicAcquisition
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import {
  commitRelicRewardFallback,
  resolveRelicFallback,
  resolveRelicRewardAvailability
} from "../src/rulesets/v08-meta-1/relic-reward-fallback.js";
import {
  createV08Meta1Ruleset
} from "../src/rulesets/v08-meta-1/index.js";
import fixtures, {
  PHASE3B2C3A_FIXTURE_FIELDS
} from "../src/rulesets/v08-meta-1/test/phase3b2c3a-golden-fixtures.js";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const context = Object.freeze({
  runId: "fallback-run",
  rulesetHash: manifest.rulesetHash,
  secret: "phase3b2c3a:0123456789abcdef0123456789abcdef"
});

function state({
  sourceType = "stored_relic_chest",
  sourceId = "arena-reward-cache",
  availabilityMode = "stored_reward",
  canonicalStoredChoiceIds = [],
  canonicalCandidateCount = undefined
} = {}) {
  const next = createInitialMetaStateV08({}, {
    runId: "fallback-run",
    season: "season-phase3b2c3a",
    startedAt: 1_700_000_500_000
  });
  next.status = "active";
  next.currentRoomDirective = {
    directiveId: "directive_fallback",
    revision: next.revision,
    roomType: sourceId === "arena-reward-cache"
      ? "arena"
      : sourceId === "otter-crimson-chest"
        ? "otter"
        : "boss"
  };
  next.currentRewardEnvelope = {
    envelopeId: "envelope_fallback",
    runId: next.runId,
    rulesetHash: next.rulesetHash,
    directiveId: next.currentRoomDirective.directiveId,
    revision: next.revision,
    roomType: next.currentRoomDirective.roomType,
    consumed: false,
    rewardSlots: [{
      slotId: "slot_fallback",
      slotType: "relic_reward",
      sourceType,
      sourceId,
      availabilityMode,
      canonicalStoredChoiceIds,
      ...(canonicalCandidateCount === undefined ? {} : { canonicalCandidateCount }),
      consumed: false,
      offerId: null,
      resolution: null
    }]
  };
  return next;
}

function request(overrides = {}) {
  return {
    sourceType: "stored_relic_chest",
    sourceId: "arena-reward-cache",
    sourceDirectiveId: "directive_fallback",
    rewardEnvelopeId: "envelope_fallback",
    rewardSlotId: "slot_fallback",
    acquisitionContext: "stored_reward",
    ...overrides
  };
}

test("Phase 3B2C3A has 60 schema-complete executable fixtures", () => {
  assert.equal(fixtures.length, 60);
  assert.equal(new Set(fixtures.map((entry) => entry.fixtureId)).size, 60);
  for (const fixture of fixtures) {
    assert.deepEqual(Object.keys(fixture), PHASE3B2C3A_FIXTURE_FIELDS);
    assert.ok(fixture.legacySourceEvidence.length > 0);
    assert.equal(fixture.expectedRulesetHash, "manifest.rulesetHash");
  }
});

test("fallback audit was completed before implementation with every required field", async () => {
  const audit = await readFile(
    path.join(WORKSPACE_ROOT, "docs", "ONLINE_V3_PHASE3B2C3A.md"),
    "utf8"
  );
  for (const field of [
    "fallbackFlowId", "legacySourceFiles", "legacyFunctionOrSymbol", "trigger",
    "sourceType", "sourceId", "precondition", "emptyPoolBehavior",
    "staleCacheBehavior", "fullSlotsBehavior", "noLegalReplacementBehavior",
    "cancelBehavior", "fallbackRewardType", "fallbackAmount",
    "calculationInputs", "serverCanDeriveExactly", "consumesRewardSlot",
    "consumesOffer", "changesGold", "changesBuild", "changesOtherMetaState",
    "idempotencySemantics", "sourceEvidence", "implementationStatus"
  ]) {
    assert.match(audit, new RegExp(field, "u"));
  }
  for (const flow of [
    "WARDEN_EMPTY_POOL_V08",
    "OTTER_PRESPAWN_EMPTY_POOL_V08",
    "ARENA_PRESPAWN_EMPTY_POOL_V08",
    "ARENA_STORED_REWARD_EMPTY_V08",
    "OTTER_STORED_REWARD_EMPTY_V08",
    "GLOBAL_REPLACEMENT_CANCEL_OR_IMPOSSIBLE_V08"
  ]) {
    assert.match(audit, new RegExp(flow, "u"));
  }
});

test("generated policy is source-specific and contains no potion/stat fallback", () => {
  const data = fallbackPolicy.canonicalData;
  assert.equal(data.policyVersion, "v08-relic-reward-fallback-1");
  assert.deepEqual(
    data.fallbackPolicies.map((entry) => [
      entry.fallbackPolicyId,
      entry.awardType,
      entry.baseAmount,
      entry.applyGoldModifiers
    ]),
    [
      ["ARENA_STORED_CACHE_EMPTY_GOLD_V08", "GOLD", 60, true],
      ["OTTER_CRIMSON_STORED_EMPTY_GOLD_V08", "GOLD", 50, true]
    ]
  );
});

test("canonical availability separates empty candidates from an empty stored reward", () => {
  const stored = state();
  const award = resolveRelicRewardAvailability(stored, request());
  assert.equal(award.decision, "AWARD_FALLBACK");
  assert.equal(award.fallbackPolicyId, "ARENA_STORED_CACHE_EMPTY_GOLD_V08");
  assert.equal(award.baseGoldAmount, 60);

  const preOffer = state({
    availabilityMode: "future_arena_spec",
    canonicalStoredChoiceIds: null,
    canonicalCandidateCount: 0
  });
  const noReward = resolveRelicRewardAvailability(preOffer, request({
    acquisitionContext: "pre_offer"
  }));
  assert.deepEqual(noReward, {
    decision: "NO_REWARD",
    reason: "EMPTY_CANDIDATE_POOL",
    consumesRewardSlot: true,
    consumesOffer: false,
    consumesTransaction: false,
    authoritativeGoldDelta: 0,
    anomalyReasonCodes: []
  });

  preOffer.currentRewardEnvelope.rewardSlots[0].canonicalCandidateCount = 4;
  assert.equal(
    resolveRelicRewardAvailability(preOffer, request({
      acquisitionContext: "pre_offer"
    })).decision,
    "ISSUE_RELIC_OFFER"
  );
});

test("Arena 60 and Otter 50 are fixed bases processed by the existing gold modifier", async () => {
  const arena = state();
  const arenaAward = resolveRelicFallback({
    canonicalState: arena,
    sourceType: "stored_relic_chest",
    sourceId: "arena-reward-cache",
    reason: "STORED_REWARD_EMPTY",
    rewardSlot: arena.currentRewardEnvelope.rewardSlots[0]
  });
  assert.equal(arenaAward.baseGoldAmount, 60);
  assert.equal(arenaAward.authoritativeGoldDelta, 60);

  const otter = state({
    sourceId: "otter-crimson-chest"
  });
  const otterRequest = request({
    sourceId: "otter-crimson-chest"
  });
  assert.equal(
    resolveRelicRewardAvailability(otter, otterRequest).authoritativeGoldDelta,
    50
  );

  arena.build = await applyRelicAcquisition(arena.build, {
    relicId: "idol",
    acquiredRevision: arena.revision,
    acquisitionSource: "boss_drop",
    sourceOfferId: "fixture_idol"
  });
  assert.equal(
    resolveRelicRewardAvailability(arena, request()).authoritativeGoldDelta,
    69
  );
});

test("fallback commit is atomic, credits the authoritative ledger once and consumes the slot", async () => {
  const initial = state();
  const before = structuredClone(initial);
  const committed = await commitRelicRewardFallback(initial, request(), context);
  assert.deepEqual(initial, before);
  assert.equal(committed.gold, 60);
  assert.equal(committed.goldLedger.earnedServerDerived, 60);
  assert.equal(committed.goldLedger.earnedBoundedAttested, 0);
  assert.equal(committed.goldLedger.anomalyScore, 0);
  assert.equal(committed.currentRewardEnvelope.rewardSlots[0].consumed, true);
  assert.equal(committed.currentRewardEnvelope.rewardSlots[0].resolution, "fallback_awarded");
  assert.equal(committed.relicFallbackHistory.length, 1);
  assert.match(committed.relicFallbackHistory[0].resultingStateDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(
    await commitRelicRewardFallback(committed, request(), context),
    committed
  );
});

test("NO_REWARD commit consumes only the canonical slot and exact retry is stable", async () => {
  const initial = state({
    availabilityMode: "future_arena_spec",
    canonicalStoredChoiceIds: null,
    canonicalCandidateCount: 0
  });
  const noRewardRequest = request({ acquisitionContext: "pre_offer" });
  const committed = await commitRelicRewardFallback(initial, noRewardRequest, context);
  assert.equal(committed.gold, 0);
  assert.equal(committed.goldLedger.earnedServerDerived, 0);
  assert.equal(committed.currentRewardEnvelope.rewardSlots[0].resolution, "no_reward");
  assert.equal(committed.relicFallbackHistory[0].resolution, "NO_REWARD");
  assert.deepEqual(
    await commitRelicRewardFallback(committed, noRewardRequest, context),
    committed
  );
});

test("client fallback amount, reason, cache, choices and reported totals are rejected", async () => {
  for (const [field, value] of [
    ["amount", 999999],
    ["reason", "STORED_REWARD_EMPTY"],
    ["cache", []],
    ["choices", []],
    ["goldDelta", 999999],
    ["goldTotal", 999999],
    ["emptyPool", true],
    ["stale", true]
  ]) {
    const initial = state();
    const before = structuredClone(initial);
    await assert.rejects(
      commitRelicRewardFallback(initial, { ...request(), [field]: value }, context),
      new RegExp(`RELIC_REWARD_FALLBACK_REQUEST_UNKNOWN_FIELD:${field}`, "u")
    );
    assert.deepEqual(initial, before);
  }
});

test("stale and cross-bound state fail closed without mutation", () => {
  const cases = [
    ["revision", (next) => { next.currentRewardEnvelope.revision += 1; }, "OFFER_EXPIRED"],
    ["directive", (next) => { next.currentRoomDirective.directiveId = "other"; }, "RELIC_REWARD_DIRECTIVE_MISMATCH"],
    ["envelope", (next) => { next.currentRewardEnvelope.envelopeId = "other"; }, "RELIC_REWARD_ENVELOPE_ID_MISMATCH"],
    ["slot", (next) => { next.currentRewardEnvelope.rewardSlots[0].slotId = "other"; }, "RELIC_REWARD_SLOT_UNKNOWN"],
    ["run", (next) => { next.currentRewardEnvelope.runId = "other"; }, "RELIC_REWARD_BINDING_MISMATCH"],
    ["ruleset", (next) => { next.currentRewardEnvelope.rulesetHash = "sha256:other"; }, "RELIC_REWARD_BINDING_MISMATCH"]
  ];
  for (const [label, mutate, code] of cases) {
    const initial = state();
    mutate(initial);
    const before = structuredClone(initial);
    assert.equal(resolveRelicRewardAvailability(initial, request()).code, code, label);
    assert.deepEqual(initial, before, label);
  }
});

test("same slot with a different request identity cannot be replayed", async () => {
  const committed = await commitRelicRewardFallback(state(), request(), context);
  await assert.rejects(
    commitRelicRewardFallback(committed, request({
      acquisitionContext: "pre_offer"
    }), context),
    /RELIC_REWARD_FALLBACK_IDEMPOTENCY_PAYLOAD_MISMATCH/u
  );
});

test("fallback serialization is deterministic and receipts remain bounded", async () => {
  const committed = await commitRelicRewardFallback(state(), request(), context);
  assert.deepEqual(JSON.parse(JSON.stringify(committed)), committed);
  const restarted = JSON.parse(JSON.stringify(committed));
  assert.deepEqual(
    await commitRelicRewardFallback(restarted, request(), context),
    committed
  );
  const bounded = state();
  bounded.relicFallbackHistory = Array.from({ length: 64 }, (_, index) => ({
    requestDigest: `sha256:${String(index).padStart(64, "0")}`,
    resultingStateDigest: `sha256:${String(index + 1).padStart(64, "0")}`,
    rewardEnvelopeId: `old_envelope_${index}`,
    rewardSlotId: `old_slot_${index}`,
    sourceType: "stored_relic_chest",
    sourceId: "arena-reward-cache",
    resolution: "AWARD_FALLBACK",
    reason: "STORED_REWARD_EMPTY",
    fallbackPolicyId: "ARENA_STORED_CACHE_EMPTY_GOLD_V08",
    baseGoldAmount: 60,
    authoritativeGoldDelta: 60,
    anomalyReasonCodes: []
  }));
  const next = await commitRelicRewardFallback(bounded, request(), context);
  assert.equal(next.relicFallbackHistory.length, 64);
  assert.equal(next.relicFallbackHistory.at(-1).rewardSlotId, "slot_fallback");
});

test("ruleset facade exposes test-only resolution and transition without activating endpoints", async () => {
  const ruleset = createV08Meta1Ruleset({
    secret: context.secret
  });
  assert.equal(ruleset.status, "test-only");
  assert.equal(ruleset.resolveRelicRewardAvailability(state(), request()).decision, "AWARD_FALLBACK");
  const committed = await ruleset.commitRelicRewardFallback(state(), request(), context);
  assert.equal(committed.gold, 60);
});
