import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertRegularRelicOfferV08,
  createV08Meta1Ruleset,
  getArenaRelicCandidatePoolV08,
  issueRegularRelicOffer,
  projectPublicRegularRelicOfferV08,
  resolveRelicRewardAvailability,
  selectRegularRelic
} from "../src/rulesets/v08-meta-1/index.js";
import {
  applyRelicAcquisition,
  assertCanonicalRelicBuildDigestV08,
  createEmptyRelicBuildV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import {
  applyCanonicalRunModifierSelection,
  deriveRunModifierEffects
} from "../src/rulesets/v08-meta-1/run-modifiers.js";
import arenaPolicyDocument from "../src/rulesets/v08-meta-1/data/arena-relic-offer-policy.generated.json" with { type: "json" };
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(await readFile(
  path.join(
    WORKER_ROOT,
    "src",
    "rulesets",
    "v08-meta-1",
    "test",
    "phase3b2c3b-golden-fixtures.json"
  ),
  "utf8"
));
const policy = arenaPolicyDocument.canonicalData;
const allowedRarities = new Set(policy.allowedRarities);
const trustedModifierContext = Object.freeze({ authority: "TRUSTED_RULESET_DOMAIN" });
const fixtureFields = [
  "fixtureId",
  "sourceType",
  "sourceId",
  "sourceEvidence",
  "depth",
  "ascension",
  "rarityTarget",
  "candidateSeed",
  "expectedChoiceCount",
  "expectedOutcome",
  "expectedFallback",
  "expectedRulesetHash"
];

function deterministicOracle(seed, controls = {}, purposeLog = []) {
  return {
    async deriveRandomBytes(options) {
      purposeLog.push(options.purpose);
      const output = new Uint8Array(options.length);
      let offset = 0;
      let block = 0;
      while (offset < output.length) {
        const digest = createHash("sha256")
          .update([
            seed,
            options.runId,
            options.revision,
            options.purpose,
            options.counter,
            block
          ].join("|"))
          .digest();
        const take = Math.min(digest.length, output.length - offset);
        output.set(digest.subarray(0, take), offset);
        offset += take;
        block += 1;
      }
      return output;
    },
    async deriveIntInclusive(minimum, maximum, options) {
      purposeLog.push(options.purpose);
      let forced;
      if (
        options.purpose === "room-type/otter-queue" ||
        options.purpose === "room-type/vault" ||
        options.purpose === "room-type/weighted"
      ) {
        forced = maximum;
      } else if (options.purpose === "arena-relic-offer-rarity") {
        forced = controls.rarityRolls?.[options.counter];
      } else if (options.purpose === "arena-relic-offer-candidate") {
        forced = controls.candidateRolls?.[options.counter];
      } else if (options.purpose === "arena-relic-choice-order") {
        forced = controls.orderRolls?.[options.counter] ?? maximum;
      }
      if (Number.isSafeInteger(forced)) {
        return Math.max(minimum, Math.min(maximum, forced));
      }
      const digest = createHash("sha256")
        .update([
          seed,
          options.runId,
          options.revision,
          options.purpose,
          options.counter
        ].join("|"))
        .digest();
      return minimum + digest.readUInt32BE(0) % (maximum - minimum + 1);
    }
  };
}

function context(runId, seed = runId, controls = {}, purposeLog = []) {
  return {
    runId,
    season: "season-phase3b2c3b",
    startedAt: 1_700_000_500_000,
    elapsedMs: 1_000,
    secret: "phase3b2c3b:0123456789abcdef0123456789abcdef",
    randomOracle: deterministicOracle(seed, controls, purposeLog)
  };
}

function rarityRollFor(target, depth) {
  const rarity = policy.rarityPolicy;
  const depthBonus = Math.floor(depth / rarity.depthBonusDivisor);
  const legendary = rarity.legendaryBase + depthBonus * rarity.legendaryPerDepthBonus;
  const epic = rarity.epicBase + depthBonus * rarity.epicPerDepthBonus;
  const mythic = Math.min(
    rarity.mythicChanceMaximum,
    legendary * rarity.mythicRelativeToLegendaryChance
  );
  const boundaries = {
    mythic: 0,
    legendary: Math.round(mythic * 1_000_000),
    epic: Math.round((mythic + legendary) * 1_000_000),
    rare: Math.round((mythic + legendary + epic) * 1_000_000),
    normal: Math.round((mythic + legendary + epic + rarity.rareChance) * 1_000_000)
  };
  return Math.min(999_999, boundaries[target] + (target === "mythic" ? 0 : 1));
}

async function arenaState({
  runId = "arena_offer",
  depth = 41,
  ascension = false,
  build = null,
  seed = runId,
  rarityTarget = null,
  candidateSeed = 0,
  purposeLog = []
} = {}) {
  const controls = {
    rarityRolls: rarityTarget
      ? Array.from({ length: 4 }, () => rarityRollFor(rarityTarget, depth))
      : null,
    candidateRolls: Array.from({ length: 4 }, (_, index) => candidateSeed + index),
    orderRolls: Array.from({ length: 4 }, () => Number.MAX_SAFE_INTEGER)
  };
  const resolvedContext = context(runId, seed, controls, purposeLog);
  const ruleset = createV08Meta1Ruleset({
    secret: resolvedContext.secret,
    randomOracle: resolvedContext.randomOracle
  });
  let state = await ruleset.createRun({ startDepth: 0 }, resolvedContext);
  if (ascension) {
    state = await applyCanonicalRunModifierSelection(state, {
      modifierIds: ["ascension"],
      activationSource: "server-issued-run-start"
    }, trustedModifierContext);
  }
  state = await ruleset.selectStartingRelic(state, {
    offerId: state.pendingOffer.offerId,
    choiceId: state.pendingOffer.choices[0].choiceId
  }, resolvedContext);
  state.depth = depth - 1;
  state.roomIndex = depth - 1;
  state.currentRoomDirective = null;
  state.currentRewardEnvelope = null;
  state.statistics.roomsCompleted = 1;
  state.specialRoomScheduleState.otterRoomsSeenThisRun = 3;
  state.specialRoomScheduleState.otterSeenInGame = true;
  state.specialRoomScheduleState.otterPityUsedInGame = true;
  if (build) state.build = build;
  state = await ruleset.issueRoomDirective(state, resolvedContext);
  assert.equal(state.currentRoomDirective.roomType, "arena");
  assert.equal(state.currentRoomDirective.roomCategory, "special");
  assert.equal(state.currentRewardEnvelope.rewardSlots.length, 1);
  return { state, ruleset, resolvedContext, purposeLog };
}

function issueRequest(state, overrides = {}) {
  return {
    rewardEnvelopeId: state.currentRewardEnvelope.envelopeId,
    rewardSlotId: state.currentRewardEnvelope.rewardSlots[0].slotId,
    sourceDirectiveId: state.currentRoomDirective.directiveId,
    ...overrides
  };
}

async function issued(options = {}) {
  const result = await arenaState(options);
  result.state = await issueRegularRelicOffer(
    result.state,
    issueRequest(result.state),
    result.resolvedContext
  );
  return result;
}

async function buildWith(relicIds) {
  let build = createEmptyRelicBuildV08();
  for (const [revision, relicId] of relicIds.entries()) {
    build = await applyRelicAcquisition(build, {
      relicId,
      acquiredRevision: revision,
      acquisitionSource: "fixture",
      sourceOfferId: "arena_fixture_" + revision + "_" + relicId
    });
  }
  return build;
}

test("Phase 3B2C3B golden corpus has exactly 40 source-bound complete fixtures", () => {
  assert.equal(fixtures.length, 40);
  assert.equal(new Set(fixtures.map((fixture) => fixture.fixtureId)).size, 40);
  for (const fixture of fixtures) {
    assert.deepEqual(Object.keys(fixture), fixtureFields);
    assert.equal(fixture.sourceType, policy.sourceType);
    assert.equal(fixture.sourceId, policy.sourceId);
    assert.ok(fixture.sourceEvidence.length >= 3);
    assert.equal(fixture.expectedRulesetHash, "manifest.rulesetHash");
  }
});

test("Arena policy records the exact protected v0.8 trigger, pool, rarity and fallback", () => {
  assert.equal(policy.minimumDepth, 40);
  assert.equal(policy.firstEffectiveNonBossDepth, 41);
  assert.equal(policy.maximumDepth, 99);
  assert.equal(policy.excludedBossInterval, 5);
  assert.equal(policy.waveCount, 2);
  assert.equal(policy.offerChoiceCount, 3);
  assert.equal(policy.extraChoiceEffect, "extraRelicChoices");
  assert.deepEqual(policy.allowedRarities, ["rare", "epic", "legendary", "mythic"]);
  assert.equal(policy.candidateAcquisitionSource, "relic_draft");
  assert.equal(policy.rarityPolicy.mythicRelativeToLegendaryChance, 0.05);
  assert.equal(policy.rarityPolicy.mythicChanceMaximum, 0.02);
  assert.equal(policy.storedEmptyFallback.baseGold, 60);
  assert.match(policy.storedEmptyFallback.condition, /existing canonical stored Arena/u);
  assert.equal(policy.fullPoolBehavior, "CANONICAL_REPLACEMENT_TRANSACTION");
  assert.equal(policy.implementationStatus, "phase-3b2c3b-disconnected-test-only");
  assert.ok(policy.sourceEvidence.length >= 6);
});

test("Arena directive and RoomRewardEnvelopeV3 bind one deterministic RegularRelicOfferV3", async () => {
  const first = await issued({
    runId: "arena_deterministic",
    seed: "arena_shared",
    rarityTarget: "rare"
  });
  const offer = first.state.pendingOffer;
  const slot = first.state.currentRewardEnvelope.rewardSlots[0];
  assertRegularRelicOfferV08(offer);
  assert.equal(slot.sourceType, "arena");
  assert.equal(slot.sourceId, "arena-reward-cache");
  assert.equal(slot.offerPolicyRef, "arena-relic-offer-policy.generated.json");
  assert.equal(slot.offerId, offer.offerId);
  assert.equal(offer.sourceDirectiveId, first.state.currentRoomDirective.directiveId);
  assert.equal(offer.rewardEnvelopeId, first.state.currentRewardEnvelope.envelopeId);
  assert.equal(offer.rewardSlotId, slot.slotId);

  const retry = await issueRegularRelicOffer(
    first.state,
    issueRequest(first.state),
    first.resolvedContext
  );
  assert.deepEqual(retry, first.state);
  const restarted = await issued({
    runId: "arena_deterministic",
    seed: "arena_shared",
    rarityTarget: "rare"
  });
  assert.deepEqual(restarted.state.pendingOffer, offer);
});

test("Arena uses three choices normally and four only from canonical Ascension effects", async () => {
  const normal = await issued({ runId: "arena_three", ascension: false });
  const ascension = await issued({ runId: "arena_four", ascension: true });
  assert.equal(deriveRunModifierEffects(normal.state.runModifiers).extraRelicChoices, 0);
  assert.equal(normal.state.pendingOffer.choices.length, 3);
  assert.equal(deriveRunModifierEffects(ascension.state.runModifiers).extraRelicChoices, 1);
  assert.equal(ascension.state.pendingOffer.choices.length, 4);
});

test("Arena choices are exact rare+ draft candidates, unique and selectable", async () => {
  const result = await issued({ runId: "arena_choices", rarityTarget: "epic" });
  const offer = result.state.pendingOffer;
  const pool = new Set(getArenaRelicCandidatePoolV08(result.state));
  assert.equal(new Set(offer.choices.map((choice) => choice.privateRelicId)).size, 3);
  for (const [index, choice] of offer.choices.entries()) {
    assert.ok(pool.has(choice.privateRelicId));
    assert.ok(allowedRarities.has(offer.publicChoices[index].rarity));
  }
  const selection = {
    offerId: offer.offerId,
    choiceId: offer.choices[0].choiceId
  };
  const selected = await selectRegularRelic(result.state, selection, result.resolvedContext);
  assert.ok(selected.build.relics.some(
    (entry) => entry.relicId === offer.choices[0].privateRelicId
  ));
  assert.equal(selected.gold, result.state.gold);
  assert.equal(selected.currentRewardEnvelope.rewardSlots[0].consumed, true);
  assert.equal(selected.pendingOffer, null);
  await assertCanonicalRelicBuildDigestV08(selected.build);
  const replay = await selectRegularRelic(selected, selection, result.resolvedContext);
  assert.deepEqual(replay, selected);
});

test("Arena full build selection reuses the canonical replacement transaction", async () => {
  const build = await buildWith([
    "abyssalreliquary",
    "ironboots",
    "fieldrations",
    "trapweave",
    "cachekey",
    "scoutlens",
    "shrineward",
    "idol",
    "thornmail",
    "vampfang"
  ]);
  const result = await issued({
    runId: "arena_replacement",
    build,
    rarityTarget: "legendary"
  });
  const offer = result.state.pendingOffer;
  const choice = offer.choices.find((entry) => (
    !build.relics.some((owned) => owned.relicId === entry.privateRelicId)
  ));
  assert.ok(choice);
  const pending = await selectRegularRelic(result.state, {
    offerId: offer.offerId,
    choiceId: choice.choiceId
  }, result.resolvedContext);
  assert.ok(pending.pendingRelicTransaction);
  assert.equal(pending.pendingOffer.selectionPending, true);
  assert.equal(pending.currentRewardEnvelope.rewardSlots[0].resolution, "selection_pending");
  assert.equal(pending.gold, result.state.gold);
});

test("60 base gold is allowed only for an existing canonical empty Arena stored reward", async () => {
  const actual = await arenaState({ runId: "arena_fallback_scope" });
  const preOffer = resolveRelicRewardAvailability(actual.state, {
    sourceType: "arena",
    sourceId: "arena-reward-cache",
    sourceDirectiveId: actual.state.currentRoomDirective.directiveId,
    rewardEnvelopeId: actual.state.currentRewardEnvelope.envelopeId,
    rewardSlotId: actual.state.currentRewardEnvelope.rewardSlots[0].slotId,
    acquisitionContext: "pre_offer"
  });
  assert.equal(preOffer.decision, "ISSUE_RELIC_OFFER");
  assert.equal(Object.hasOwn(preOffer, "authoritativeGoldDelta"), false);

  const stored = structuredClone(actual.state);
  const slot = stored.currentRewardEnvelope.rewardSlots[0];
  slot.sourceType = "stored_relic_chest";
  slot.availabilityMode = "stored_reward";
  slot.canonicalStoredChoiceIds = [];
  const fallback = resolveRelicRewardAvailability(stored, {
    sourceType: "stored_relic_chest",
    sourceId: "arena-reward-cache",
    sourceDirectiveId: stored.currentRoomDirective.directiveId,
    rewardEnvelopeId: stored.currentRewardEnvelope.envelopeId,
    rewardSlotId: slot.slotId,
    acquisitionContext: "stored_reward"
  });
  assert.equal(fallback.decision, "AWARD_FALLBACK");
  assert.equal(fallback.fallbackPolicyId, "ARENA_STORED_CACHE_EMPTY_GOLD_V08");
  assert.equal(fallback.baseGoldAmount, 60);
  assert.equal(fallback.authoritativeGoldDelta, 60);

  slot.availabilityMode = "pre_offer";
  const wrongContext = resolveRelicRewardAvailability(stored, {
    sourceType: "stored_relic_chest",
    sourceId: "arena-reward-cache",
    sourceDirectiveId: stored.currentRoomDirective.directiveId,
    rewardEnvelopeId: stored.currentRewardEnvelope.envelopeId,
    rewardSlotId: slot.slotId,
    acquisitionContext: "stored_reward"
  });
  assert.equal(wrongContext.decision, "REJECT");
  assert.equal(wrongContext.code, "RELIC_REWARD_ACQUISITION_CONTEXT_MISMATCH");
});

test("Arena issue fails closed on fake, stale, foreign and boss-depth bindings", async () => {
  {
    const result = await arenaState({ runId: "arena_fake_slot" });
    await assert.rejects(
      issueRegularRelicOffer(
        result.state,
        issueRequest(result.state, { rewardSlotId: "fake" }),
        result.resolvedContext
      ),
      /RELIC_REWARD_SLOT_UNKNOWN/u
    );
  }
  {
    const result = await arenaState({ runId: "arena_stale" });
    result.state.revision += 1;
    await assert.rejects(
      issueRegularRelicOffer(result.state, issueRequest(result.state), result.resolvedContext),
      /RELIC_REWARD_ENVELOPE_STALE/u
    );
  }
  {
    const result = await arenaState({ runId: "arena_foreign" });
    result.state.currentRewardEnvelope.rewardSlots[0].sourceId = "otter-crimson-chest";
    await assert.rejects(
      issueRegularRelicOffer(result.state, issueRequest(result.state), result.resolvedContext),
      /RELIC_REWARD_SOURCE_MISMATCH/u
    );
  }
  {
    const result = await arenaState({ runId: "arena_boss_depth" });
    const invalid = structuredClone(result.state);
    invalid.currentRoomDirective.depth = 40;
    await assert.rejects(
      issueRegularRelicOffer(invalid, issueRequest(invalid), result.resolvedContext),
      /ARENA_RELIC_REWARD_DEPTH_INVALID/u
    );
  }
});

test("Arena RNG namespace and public projection remain isolated and bounded", async () => {
  const purposeLog = [];
  const result = await issued({ runId: "arena_namespace", purposeLog });
  const arenaPurposes = new Set(purposeLog.filter((purpose) => purpose.startsWith("arena-relic")));
  assert.deepEqual(arenaPurposes, new Set(policy.rngPurposes));
  assert.equal(purposeLog.some((purpose) => purpose.startsWith("otter-relic")), false);
  const publicOffer = projectPublicRegularRelicOfferV08(result.state.pendingOffer);
  assert.equal(Object.hasOwn(publicOffer, "choices"), false);
  assert.equal(Object.hasOwn(publicOffer, "issuedStateDigest"), false);
  const bytes = Buffer.byteLength(JSON.stringify(publicOffer), "utf8");
  console.info("Phase 3B2C3B maximum public Arena relic offer: " + bytes + " bytes");
  assert.ok(bytes < policy.publicPayloadTargetBytes, bytes + " bytes");
  assert.match(manifest.rulesetHash, /^sha256:[a-f0-9]{64}$/u);
});

for (const fixture of fixtures) {
  test("golden 3B2C3B source-bound fixture: " + fixture.fixtureId, async () => {
    const result = await issued({
      runId: fixture.fixtureId,
      depth: fixture.depth,
      ascension: fixture.ascension,
      rarityTarget: fixture.rarityTarget,
      candidateSeed: fixture.candidateSeed
    });
    const offer = result.state.pendingOffer;
    assert.equal(offer.sourceType, fixture.sourceType);
    assert.equal(offer.sourceId, fixture.sourceId);
    assert.equal(offer.choices.length, fixture.expectedChoiceCount);
    if (fixture.rarityTarget === "normal") {
      assert.ok(allowedRarities.has(offer.publicChoices[0].rarity));
      assert.equal(fixture.expectedFallback, "WHOLE_POOL");
    } else {
      assert.equal(offer.publicChoices[0].rarity, fixture.rarityTarget);
      assert.equal(fixture.expectedFallback, "NONE");
    }
    assert.equal(result.state.currentRoomDirective.depth, fixture.depth);
    assert.equal(fixture.expectedOutcome, "OFFER_ISSUED");
    assert.equal(fixture.expectedRulesetHash, "manifest.rulesetHash");
  });
}
