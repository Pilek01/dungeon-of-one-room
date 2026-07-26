import test from "node:test";
import assert from "node:assert/strict";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  commitRelicRewardFallback,
  resolveRelicRewardAvailability
} from "../src/rulesets/v08-meta-1/relic-reward-fallback.js";

const context = Object.freeze({
  runId: "fallback-property-run",
  rulesetHash: manifest.rulesetHash,
  secret: "phase3b2c3a-property:0123456789abcdef0123456789abcdef"
});

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value;
  };
}

function propertyState(index, variant) {
  const next = createInitialMetaStateV08({}, {
    runId: "fallback-property-run",
    season: "season-phase3b2c3a",
    startedAt: 1_700_000_600_000 + index
  });
  next.status = "active";
  next.currentRoomDirective = {
    directiveId: `directive_${index}`,
    revision: next.revision,
    roomType: "arena"
  };
  const stored = variant <= 1;
  next.currentRewardEnvelope = {
    envelopeId: `envelope_${index}`,
    runId: next.runId,
    rulesetHash: next.rulesetHash,
    directiveId: next.currentRoomDirective.directiveId,
    revision: next.revision,
    roomType: "arena",
    consumed: false,
    rewardSlots: [{
      slotId: `slot_${index}`,
      slotType: "relic_reward",
      sourceType: "stored_relic_chest",
      sourceId: "arena-reward-cache",
      availabilityMode: stored ? "stored_reward" : "future_arena_spec",
      canonicalStoredChoiceIds: stored
        ? variant === 0 ? [] : [`canonical_relic_${index}`]
        : null,
      ...(stored ? {} : { canonicalCandidateCount: variant === 2 ? 0 : 3 }),
      consumed: false,
      offerId: null,
      resolution: null
    }]
  };
  if (variant === 3) next.currentRewardEnvelope.revision += 1;
  return next;
}

function propertyRequest(index, variant) {
  return {
    sourceType: "stored_relic_chest",
    sourceId: "arena-reward-cache",
    sourceDirectiveId: `directive_${index}`,
    rewardEnvelopeId: `envelope_${index}`,
    rewardSlotId: `slot_${index}`,
    acquisitionContext: variant <= 1 ? "stored_reward" : "pre_offer"
  };
}

test("5000 seeded canonical source/reward states preserve fallback invariants", async () => {
  const random = rng(0x3b2c3a);
  const counts = {
    ISSUE_RELIC_OFFER: 0,
    AWARD_FALLBACK: 0,
    NO_REWARD: 0,
    REJECT: 0
  };
  for (let index = 0; index < 5000; index += 1) {
    const variant = random() % 4;
    const state = propertyState(index, variant);
    const request = propertyRequest(index, variant);
    const before = structuredClone(state);
    const resolution = resolveRelicRewardAvailability(state, request);
    counts[resolution.decision] += 1;
    assert.deepEqual(state, before);

    if (resolution.decision === "ISSUE_RELIC_OFFER") {
      assert.equal(state.currentRewardEnvelope.rewardSlots[0].consumed, false);
      assert.equal(state.currentRewardEnvelope.rewardSlots[0].canonicalStoredChoiceIds.length, 1);
    } else if (resolution.decision === "AWARD_FALLBACK") {
      assert.equal(resolution.fallbackPolicyId, "ARENA_STORED_CACHE_EMPTY_GOLD_V08");
      assert.equal(resolution.baseGoldAmount, 60);
      assert.equal(resolution.authoritativeGoldDelta, 60);
      if (index % 20 === 0) {
        const committed = await commitRelicRewardFallback(state, request, context);
        assert.equal(committed.gold, 60);
        assert.equal(committed.goldLedger.earnedServerDerived, 60);
        assert.equal(committed.currentRewardEnvelope.rewardSlots[0].consumed, true);
        assert.equal(committed.build.buildDigest, state.build.buildDigest);
        assert.equal(committed.lives, state.lives);
        assert.equal(committed.depth, state.depth);
        assert.equal(
          committed.runModifiers.modifierDigest,
          state.runModifiers.modifierDigest
        );
        assert.deepEqual(
          await commitRelicRewardFallback(committed, request, context),
          committed
        );
      }
    } else if (resolution.decision === "NO_REWARD") {
      assert.equal(resolution.reason, "EMPTY_CANDIDATE_POOL");
      assert.equal(resolution.authoritativeGoldDelta, 0);
    } else {
      assert.equal(resolution.code, "OFFER_EXPIRED");
      assert.equal(state.gold, 0);
      assert.equal(state.currentRewardEnvelope.rewardSlots[0].consumed, false);
    }
  }
  for (const count of Object.values(counts)) assert.ok(count > 0);
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), 5000);
  console.info(`Phase 3B2C3A property cases: 5000 ${JSON.stringify(counts)}`);
});

test("seeded forged client fields never become fallback authority", async () => {
  const random = rng(0xc3a5000);
  const forbidden = [
    "amount",
    "reason",
    "sourceIdOverride",
    "goldDelta",
    "goldTotal",
    "choices",
    "cache",
    "emptyPool",
    "stale"
  ];
  for (let index = 0; index < 500; index += 1) {
    const field = forbidden[random() % forbidden.length];
    const initial = propertyState(index, 0);
    const before = structuredClone(initial);
    await assert.rejects(
      commitRelicRewardFallback(initial, {
        ...propertyRequest(index, 0),
        [field]: random()
      }, context),
      new RegExp(`RELIC_REWARD_FALLBACK_REQUEST_UNKNOWN_FIELD:${field}`, "u")
    );
    assert.deepEqual(initial, before);
  }
});
