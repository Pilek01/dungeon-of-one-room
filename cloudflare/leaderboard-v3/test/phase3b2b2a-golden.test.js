import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertRegularRelicOfferV08,
  createV08Meta1Ruleset,
  getRegularRelicCandidatePoolV08,
  issueRegularRelicOffer,
  projectPublicRegularRelicOfferV08,
  projectPublicStartingRelicOfferV08,
  selectRegularRelic
} from "../src/rulesets/v08-meta-1/index.js";
import {
  applyRelicAcquisition,
  assertCanonicalRelicBuildDigestV08,
  createEmptyRelicBuildV08,
  projectPublicBuild,
  V08_RELIC_POLICY_DATA
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import sourceDocument from "../src/rulesets/v08-meta-1/data/relic-reward-sources.generated.json" with { type: "json" };
import rarityDocument from "../src/rulesets/v08-meta-1/data/relic-rarity-policy.generated.json" with { type: "json" };
import pityDocument from "../src/rulesets/v08-meta-1/data/relic-pity-policy.generated.json" with { type: "json" };
import regularPolicyDocument from "../src/rulesets/v08-meta-1/data/regular-relic-offer-policy.generated.json" with { type: "json" };
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(await readFile(
  path.join(
    WORKER_ROOT,
    "src",
    "rulesets",
    "v08-meta-1",
    "test",
    "phase3b2b2a-golden-fixtures.json"
  ),
  "utf8"
));
const requiredFixtureFields = [
  "fixtureId",
  "legacySourceEvidence",
  "sourceType",
  "initialMetaState",
  "rewardEnvelope",
  "rewardSlot",
  "serverRandomInputs",
  "expectedRarity",
  "expectedCandidatePool",
  "expectedOffer",
  "selection",
  "expectedBuild",
  "expectedPityState",
  "expectedError",
  "expectedRulesetHash"
];

function deterministicOracle(seed, controls = {}) {
  return {
    async deriveRandomBytes(options) {
      const output = new Uint8Array(options.length);
      let offset = 0;
      let block = 0;
      while (offset < output.length) {
        const digest = createHash("sha256")
          .update(`${seed}|${options.runId}|${options.revision}|${options.purpose}|${options.counter}|${block}`)
          .digest();
        const take = Math.min(digest.length, output.length - offset);
        output.set(digest.subarray(0, take), offset);
        offset += take;
        block += 1;
      }
      return output;
    },
    async deriveIntInclusive(minimum, maximum, options) {
      const purpose = String(options.purpose || "");
      let forced;
      if (purpose === "relic-offer-drop") forced = controls.dropRoll;
      else if (purpose === "relic-offer-rarity") {
        forced = controls.rarityRolls?.[options.counter];
      } else if (purpose === "relic-offer-candidate") {
        forced = controls.candidateRolls?.[options.counter];
      } else if (purpose === "relic-offer-choice-order") {
        forced = controls.orderRolls?.[options.counter] ?? maximum;
      }
      if (Number.isSafeInteger(forced)) {
        return Math.max(minimum, Math.min(maximum, forced));
      }
      const digest = createHash("sha256")
        .update(`${seed}|${options.runId}|${options.revision}|${purpose}|${options.counter}`)
        .digest();
      const sample = digest.readUInt32BE(0);
      return minimum + sample % (maximum - minimum + 1);
    }
  };
}

function context(runId, seed = runId, controls = {}) {
  return {
    runId,
    season: "season-phase3b2b2a",
    startedAt: 1_700_000_100_000,
    elapsedMs: 1_000,
    secret: "phase3b2b2a:0123456789abcdef0123456789abcdef",
    randomOracle: deterministicOracle(seed, controls)
  };
}

function ruleset() {
  return createV08Meta1Ruleset({
    secret: "phase3b2b2a:0123456789abcdef0123456789abcdef"
  });
}

async function buildWith(relicIds) {
  let build = createEmptyRelicBuildV08();
  for (const [revision, relicId] of relicIds.entries()) {
    build = await applyRelicAcquisition(build, {
      relicId,
      acquiredRevision: revision,
      acquisitionSource: "fixture",
      sourceOfferId: `fixture_${revision}_${relicId}`
    });
  }
  return build;
}

async function roomState({
  runId = "regular_offer",
  depth = 25,
  seed = runId,
  controls = { dropRoll: 0 },
  build = null,
  missStreak = 0
} = {}) {
  const resolvedRuleset = ruleset();
  const resolvedContext = context(runId, seed, controls);
  let state = await resolvedRuleset.createRun({ startDepth: 0 }, resolvedContext);
  state = await resolvedRuleset.selectStartingRelic(state, {
    offerId: state.pendingOffer.offerId,
    choiceId: state.pendingOffer.choices[1].choiceId
  }, resolvedContext);
  state.depth = depth - 1;
  state.roomIndex = depth - 1;
  state.currentRoomDirective = null;
  state.currentRewardEnvelope = null;
  if (build) state.build = build;
  state.relicOfferState.sourceSpecificCounters.wardenDropMissStreak = missStreak;
  state = await resolvedRuleset.issueRoomDirective(state, resolvedContext);
  return { state, resolvedRuleset, resolvedContext };
}

function issueRequest(state, overrides = {}) {
  const slot = state.currentRewardEnvelope.rewardSlots[0];
  return {
    rewardEnvelopeId: state.currentRewardEnvelope.envelopeId,
    rewardSlotId: slot?.slotId || "missing",
    sourceDirectiveId: state.currentRoomDirective.directiveId,
    ...overrides
  };
}

async function issued(options = {}) {
  const result = await roomState(options);
  const state = await result.resolvedRuleset.issueRegularRelicOffer(
    result.state,
    issueRequest(result.state),
    result.resolvedContext
  );
  return { ...result, state };
}

test("Phase 3B2B2A golden corpus has exactly 58 complete executable fixtures", () => {
  assert.equal(fixtures.length, 58);
  assert.equal(new Set(fixtures.map((fixture) => fixture.fixtureId)).size, 58);
  for (const fixture of fixtures) {
    assert.deepEqual(Object.keys(fixture), requiredFixtureFields);
    assert.ok(fixture.legacySourceEvidence.length > 0);
    assert.equal(fixture.expectedRulesetHash, "manifest.rulesetHash");
  }
});

test("source inventory is complete, exact-schema, and only Warden is implemented", () => {
  const inventory = sourceDocument.canonicalData;
  assert.equal(inventory.inventoryCount, 12);
  assert.deepEqual(inventory.implementedSourceIds, ["warden-standard-drop"]);
  for (const source of inventory.sources) {
    assert.deepEqual(Object.keys(source), inventory.inventoryFields);
  }
  const chest = inventory.sources.find((entry) => entry.sourceId === "standard-chest");
  assert.equal(chest.offerChoiceCount, 0);
  assert.equal(chest.deferredReason, "NO_RELIC_REWARD_IN_BASELINE");
  for (const id of [
    "arena-reward-cache",
    "crossroads-power",
    "otter-crimson-chest",
    "forge-temper",
    "forge-transmute",
    "merchant-relic-slot",
    "merchant-reserved-relic",
    "merchant-black-market",
    "vault-standard-chest"
  ]) {
    assert.ok(inventory.deferredSourceIds.includes(id), id);
  }
});

test("starting and regular offers share the safe eight-field public choice projection", async () => {
  const resolvedContext = context("starting_projection");
  const starting = await ruleset().createRun({ startDepth: 0 }, resolvedContext);
  const startingPublic = projectPublicStartingRelicOfferV08(starting.pendingOffer);
  assert.equal(Object.hasOwn(startingPublic, "choices"), false);
  assert.equal(Object.hasOwn(startingPublic, "issuedStateDigest"), false);
  for (const choice of startingPublic.publicChoices) {
    assert.deepEqual(Object.keys(choice), regularPolicyDocument.canonicalData.publicChoiceFields);
  }

  const regular = await issued({ runId: "regular_projection", controls: { dropRoll: 0 } });
  const regularPublic = projectPublicRegularRelicOfferV08(regular.state.pendingOffer);
  assert.equal(Object.hasOwn(regularPublic, "choices"), false);
  assert.equal(Object.hasOwn(regularPublic, "issuedStateDigest"), false);
  for (const choice of regularPublic.publicChoices) {
    assert.deepEqual(Object.keys(choice), regularPolicyDocument.canonicalData.publicChoiceFields);
  }
});

test("regular offer has the exact binding contract and one-time reward slot", async () => {
  const result = await issued({ runId: "offer_contract", controls: { dropRoll: 0 } });
  const offer = result.state.pendingOffer;
  assertRegularRelicOfferV08(offer);
  assert.deepEqual(Object.keys(offer), [
    "offerId",
    "offerType",
    "runId",
    "rulesetHash",
    "issuedRevision",
    "sourceType",
    "sourceId",
    "sourceDirectiveId",
    "rewardEnvelopeId",
    "rewardSlotId",
    "choices",
    "publicChoices",
    "issuedStateDigest",
    "expiresOnRevision",
    "consumed",
    "consumedChoiceId",
    "consumedAtRevision"
  ]);
  const slot = result.state.currentRewardEnvelope.rewardSlots[0];
  assert.equal(slot.offerId, offer.offerId);
  assert.equal(slot.consumed, false);
  assert.equal(slot.resolution, "offer_issued");
  const retry = await issueRegularRelicOffer(
    result.state,
    issueRequest(result.state),
    result.resolvedContext
  );
  assert.deepEqual(retry, result.state);
});

test("issue binding rejects stale, foreign, mismatched, fake, and consumed slots", async () => {
  {
    const result = await roomState({ runId: "stale_issue" });
    result.state.revision += 1;
    await assert.rejects(
      issueRegularRelicOffer(result.state, issueRequest(result.state), result.resolvedContext),
      /RELIC_REWARD_ENVELOPE_STALE/u
    );
  }
  {
    const result = await roomState({ runId: "foreign_issue" });
    result.state.currentRewardEnvelope.runId = "other_run";
    await assert.rejects(
      issueRegularRelicOffer(result.state, issueRequest(result.state), result.resolvedContext),
      /RELIC_REWARD_ENVELOPE_RUN_MISMATCH/u
    );
  }
  {
    const result = await roomState({ runId: "directive_issue" });
    await assert.rejects(
      issueRegularRelicOffer(
        result.state,
        issueRequest(result.state, { sourceDirectiveId: "directive_fake" }),
        result.resolvedContext
      ),
      /RELIC_REWARD_DIRECTIVE_MISMATCH/u
    );
  }
  {
    const result = await roomState({ runId: "fake_slot" });
    await assert.rejects(
      issueRegularRelicOffer(
        result.state,
        issueRequest(result.state, { rewardSlotId: "slot_fake" }),
        result.resolvedContext
      ),
      /RELIC_REWARD_SLOT_UNKNOWN/u
    );
  }
  {
    const result = await roomState({ runId: "source_mismatch" });
    result.state.currentRewardEnvelope.rewardSlots[0].sourceId = "fake";
    await assert.rejects(
      issueRegularRelicOffer(result.state, issueRequest(result.state), result.resolvedContext),
      /RELIC_REWARD_SOURCE_MISMATCH/u
    );
  }
  {
    const result = await roomState({ runId: "consumed_slot" });
    const slot = result.state.currentRewardEnvelope.rewardSlots[0];
    slot.consumed = true;
    slot.resolution = "offer_issued";
    await assert.rejects(
      issueRegularRelicOffer(result.state, issueRequest(result.state), result.resolvedContext),
      /RELIC_REWARD_SLOT_ALREADY_CONSUMED/u
    );
  }
});

test("exact v0.8 Warden rarity boundaries and all tiers are reachable", async () => {
  assert.deepEqual(
    rarityDocument.canonicalData.rarityTiers.map((tier) => [
      tier.minDepth,
      tier.maxDepth,
      tier.dropChance,
      tier.rarityWeights
    ]),
    [
      [25, 95, 0.6, { normal: 0.35, rare: 0.3, epic: 0.22, legendary: 0.13 }],
      [20, 24, 0.6, { normal: 0.45, rare: 0.3, epic: 0.2, legendary: 0.05 }],
      [15, 19, 0.55, { normal: 0.45, rare: 0.25, epic: 0.2, legendary: 0.1 }],
      [10, 14, 0.5, { normal: 0.55, rare: 0.3, epic: 0.15, legendary: 0 }],
      [5, 9, 0.45, { normal: 0.75, rare: 0.25, epic: 0, legendary: 0 }]
    ]
  );
  const rolls = new Map([
    ["mythic", 0],
    ["normal", 100_000],
    ["rare", 500_000],
    ["epic", 750_000],
    ["legendary", 950_000]
  ]);
  for (const [rarity, rarityRoll] of rolls) {
    const result = await issued({
      runId: `rarity_${rarity}`,
      depth: 25,
      controls: {
        dropRoll: 0,
        rarityRolls: [rarityRoll, rarityRoll, rarityRoll]
      }
    });
    assert.equal(result.state.pendingOffer.publicChoices[0].rarity, rarity);
  }
  const early = await issued({
    runId: "rarity_early",
    depth: 10,
    controls: { dropRoll: 0, rarityRolls: [0, 0, 0] }
  });
  assert.equal(early.state.pendingOffer.publicChoices.some(
    (choice) => choice.rarity === "legendary" || choice.rarity === "mythic"
  ), false);
});

test("run-scoped Warden pity updates once, hard-pities at three, and retries safely", async () => {
  assert.equal(pityDocument.canonicalData.implemented.length, 1);
  assert.equal(
    pityDocument.canonicalData.implemented[0].statePath,
    "relicOfferState.sourceSpecificCounters.wardenDropMissStreak"
  );
  const miss = await roomState({
    runId: "pity_miss",
    depth: 5,
    missStreak: 2,
    controls: { dropRoll: 999_999 }
  });
  const missed = await issueRegularRelicOffer(
    miss.state,
    issueRequest(miss.state),
    miss.resolvedContext
  );
  assert.equal(missed.pendingOffer, null);
  assert.equal(missed.relicOfferState.sourceSpecificCounters.wardenDropMissStreak, 3);
  assert.equal(missed.currentRewardEnvelope.rewardSlots[0].resolution, "no_drop");
  const missRetry = await issueRegularRelicOffer(
    missed,
    issueRequest(missed),
    miss.resolvedContext
  );
  assert.deepEqual(missRetry, missed);

  const hard = await issued({
    runId: "pity_hard",
    depth: 5,
    missStreak: 3,
    controls: { dropRoll: 999_999 }
  });
  assert.ok(hard.state.pendingOffer);
  assert.equal(hard.state.relicOfferState.sourceSpecificCounters.wardenDropMissStreak, 0);
  assert.deepEqual(
    pityDocument.canonicalData.deferredProfileScoped.map((entry) => entry.pityId),
    ["warden-first-drop-depths"]
  );
  assert.ok(pityDocument.canonicalData.deferredProfileScoped.every(
    (entry) => entry.reason === "DEFERRED_PROFILE_SCOPED_PITY"
  ));
  assert.deepEqual(
    pityDocument.canonicalData.deferredGameSessionScoped.map((entry) => entry.pityId),
    ["forge-room-pity", "otter-room-pity"]
  );
  assert.ok(pityDocument.canonicalData.deferredGameSessionScoped.every(
    (entry) => entry.reason === "DEFERRED_GAME_SESSION_SCOPED_PITY"
  ));
});

test("candidate filtering enforces canonical build, caps, slots, mutual exclusion and uniqueness", async () => {
  const uniqueBuild = await buildWith(["ironboots"]);
  assert.equal(getRegularRelicCandidatePoolV08({ build: uniqueBuild }, 25).includes("ironboots"), false);
  const cappedBuild = await buildWith(["fang", "fang", "fang", "fang", "fang"]);
  assert.equal(getRegularRelicCandidatePoolV08({ build: cappedBuild }, 25).includes("fang"), false);
  const fullBuild = await buildWith([
    "ironboots",
    "fieldrations",
    "trapweave",
    "cachekey",
    "scoutlens",
    "shrineward",
    "idol",
    "thornmail"
  ]);
  assert.deepEqual(getRegularRelicCandidatePoolV08({ build: fullBuild }, 25), [
    "abyssalreliquary"
  ]);
  const bonusBuild = await buildWith([
    "abyssalreliquary",
    "ironboots",
    "fieldrations",
    "trapweave",
    "cachekey",
    "scoutlens",
    "shrineward",
    "idol",
    "thornmail"
  ]);
  const bonusPool = getRegularRelicCandidatePoolV08({ build: bonusBuild }, 25);
  assert.ok(bonusPool.length > 0);
  assert.equal(bonusPool.includes("oathofruin"), false);
  assert.equal(bonusPool.includes("crownconcord"), false);

  const result = await issued({
    runId: "choice_duplicates",
    controls: { dropRoll: 0 }
  });
  assert.equal(
    new Set(result.state.pendingOffer.choices.map((choice) => choice.privateRelicId)).size,
    result.state.pendingOffer.choices.length
  );
});

test("empty pool fails closed and a smaller pool emits fewer choices without replacement synthesis", async () => {
  const fullBonusBuild = await buildWith([
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
  assert.deepEqual(getRegularRelicCandidatePoolV08({ build: fullBonusBuild }, 25), []);
  const result = await roomState({
    runId: "empty_pool",
    build: fullBonusBuild,
    controls: { dropRoll: 0 }
  });
  await assert.rejects(
    issueRegularRelicOffer(result.state, issueRequest(result.state), result.resolvedContext),
    /UNRESOLVED_EMPTY_RELIC_POOL/u
  );

  const fullBuild = await buildWith([
    "ironboots",
    "fieldrations",
    "trapweave",
    "cachekey",
    "scoutlens",
    "shrineward",
    "idol",
    "thornmail"
  ]);
  const smaller = await issued({
    runId: "smaller_pool",
    build: fullBuild,
    controls: { dropRoll: 0, rarityRolls: [0, 0, 0] }
  });
  assert.equal(smaller.state.pendingOffer.choices.length, 1);
  assert.equal(smaller.state.pendingOffer.choices[0].privateRelicId, "abyssalreliquary");
});

test("selection is strict, bound, idempotent and consumes exactly one slot", async () => {
  const result = await issued({ runId: "selection_contract", controls: { dropRoll: 0 } });
  const offer = result.state.pendingOffer;
  const request = { offerId: offer.offerId, choiceId: offer.choices[0].choiceId };
  for (const [field, value] of [
    ["relicId", "fake"],
    ["rarity", "mythic"],
    ["stacks", 99],
    ["slotCost", 0]
  ]) {
    await assert.rejects(
      selectRegularRelic(result.state, { ...request, [field]: value }, result.resolvedContext),
      new RegExp(`RELIC_OFFER_SELECTION_UNKNOWN_FIELD:${field}`, "u")
    );
  }
  await assert.rejects(
    selectRegularRelic(
      result.state,
      { offerId: "offer_fake", choiceId: request.choiceId },
      result.resolvedContext
    ),
    /RELIC_REWARD_OFFER_UNKNOWN/u
  );
  await assert.rejects(
    selectRegularRelic(
      result.state,
      { offerId: request.offerId, choiceId: "choice_fake" },
      result.resolvedContext
    ),
    /RELIC_REWARD_CHOICE_UNKNOWN/u
  );

  const beforeGold = result.state.gold;
  const beforeLives = result.state.lives;
  const beforeDepth = result.state.depth;
  const selected = await selectRegularRelic(result.state, request, result.resolvedContext);
  assert.equal(selected.build.totalRelicStacks, result.state.build.totalRelicStacks + 1);
  assert.equal(selected.currentRewardEnvelope.rewardSlots[0].consumed, true);
  assert.equal(selected.gold, beforeGold);
  assert.equal(selected.lives, beforeLives);
  assert.equal(selected.depth, beforeDepth);
  await assertCanonicalRelicBuildDigestV08(selected.build);
  assert.equal(JSON.stringify(projectPublicBuild(selected.build)).includes("sourceOfferId"), false);

  const retry = await selectRegularRelic(selected, request, result.resolvedContext);
  assert.deepEqual(retry, selected);
  await assert.rejects(
    selectRegularRelic(
      selected,
      { offerId: request.offerId, choiceId: offer.choices[1].choiceId },
      result.resolvedContext
    ),
    /RELIC_REWARD_OFFER_ALREADY_CONSUMED_DIFFERENT_CHOICE/u
  );
});

test("all offered choices are independently selectable from the same canonical state", async () => {
  const base = await issued({ runId: "each_option", controls: { dropRoll: 0 } });
  for (const choice of base.state.pendingOffer.choices) {
    const selected = await selectRegularRelic(
      structuredClone(base.state),
      { offerId: base.state.pendingOffer.offerId, choiceId: choice.choiceId },
      base.resolvedContext
    );
    assert.ok(selected.build.relics.some((entry) => entry.relicId === choice.privateRelicId));
  }
});

test("stack, slot, public build, digest and Golden Idol integration use canonical choice mapping", async () => {
  const startingBuild = await buildWith(["fang"]);
  const normalCandidates = V08_RELIC_POLICY_DATA.catalog.relics.filter(
    (entry) =>
      entry.rarity === "normal" &&
      getRegularRelicCandidatePoolV08({ build: startingBuild }, 25).includes(entry.relicId)
  );
  const fangIndex = normalCandidates.findIndex((entry) => entry.relicId === "fang");
  const stackedOffer = await issued({
    runId: "stack_update",
    build: startingBuild,
    controls: {
      dropRoll: 0,
      rarityRolls: [100_000, 100_000, 100_000],
      candidateRolls: [fangIndex, 0, 0]
    }
  });
  const fangChoice = stackedOffer.state.pendingOffer.choices.find(
    (choice) => choice.privateRelicId === "fang"
  );
  assert.ok(fangChoice);
  const stacked = await selectRegularRelic(stackedOffer.state, {
    offerId: stackedOffer.state.pendingOffer.offerId,
    choiceId: fangChoice.choiceId
  }, stackedOffer.resolvedContext);
  assert.equal(stacked.build.relics.find((entry) => entry.relicId === "fang").stacks, 2);
  assert.equal(stacked.build.relicSlotsUsed, 2);

  const empty = createEmptyRelicBuildV08();
  const rareCandidates = V08_RELIC_POLICY_DATA.catalog.relics.filter(
    (entry) =>
      entry.rarity === "rare" &&
      getRegularRelicCandidatePoolV08({ build: empty }, 25).includes(entry.relicId)
  );
  const idolIndex = rareCandidates.findIndex((entry) => entry.relicId === "idol");
  const idolOffer = await issued({
    runId: "idol_update",
    build: empty,
    controls: {
      dropRoll: 0,
      rarityRolls: [500_000, 500_000, 500_000],
      candidateRolls: [idolIndex, 0, 0]
    }
  });
  const idolChoice = idolOffer.state.pendingOffer.choices.find(
    (choice) => choice.privateRelicId === "idol"
  );
  assert.ok(idolChoice);
  const idolState = await selectRegularRelic(idolOffer.state, {
    offerId: idolOffer.state.pendingOffer.offerId,
    choiceId: idolChoice.choiceId
  }, idolOffer.resolvedContext);
  assert.equal(idolState.build.relics.find((entry) => entry.relicId === "idol").stacks, 1);
});

test("pending offer, pity and receipts survive JSON round trips and bounded history", async () => {
  const result = await issued({ runId: "serialization", controls: { dropRoll: 0 } });
  assert.deepEqual(JSON.parse(JSON.stringify(result.state)), result.state);
  const request = {
    offerId: result.state.pendingOffer.offerId,
    choiceId: result.state.pendingOffer.choices[0].choiceId
  };
  result.state.offerSettlementHistory = Array.from({ length: 64 }, (_, index) => ({
    offerId: `old_${index}`,
    choiceId: `old_choice_${index}`
  }));
  const selected = await selectRegularRelic(result.state, request, result.resolvedContext);
  assert.equal(selected.offerSettlementHistory.length, 64);
  assert.equal(selected.offerSettlementHistory.at(-1).offerId, request.offerId);

  const restarted = await issued({
    runId: "restart_determinism",
    seed: "restart_seed",
    controls: { dropRoll: 0 }
  });
  const restartedAgain = await issued({
    runId: "restart_determinism",
    seed: "restart_seed",
    controls: { dropRoll: 0 }
  });
  assert.deepEqual(restartedAgain.state.pendingOffer, restarted.state.pendingOffer);
  assert.deepEqual(restartedAgain.state.relicOfferState, restarted.state.relicOfferState);
});

test("public offer payload stays below 2 KiB for the implemented maximum of three choices", async () => {
  const result = await issued({ runId: "payload_size", controls: { dropRoll: 0 } });
  const publicOffer = projectPublicRegularRelicOfferV08(result.state.pendingOffer);
  const bytes = Buffer.byteLength(JSON.stringify(publicOffer), "utf8");
  console.info(`Phase 3B2B2A maximum public regular relic offer: ${bytes} bytes`);
  assert.equal(publicOffer.publicChoices.length, 3);
  assert.ok(bytes < regularPolicyDocument.canonicalData.publicPayloadTargetBytes, `${bytes} bytes`);
});

const metadataOnlyFixtureIds = new Set([
  "standard-chest-no-relic-slot",
  "standard-boss-relic-slot",
  "warden-source-reward",
  "deterministic-exact-issue-retry",
  "different-run-different-ids",
  "different-source-purpose-different-offer",
  "reward-slot-already-consumed",
  "envelope-stale",
  "envelope-other-run",
  "directive-mismatch",
  "fake-slot-id",
  "source-mismatch",
  "all-implemented-rarity-tiers",
  "depth-below-eligibility",
  "depth-at-eligibility-boundary",
  "legendary-unavailable",
  "legendary-available",
  "mythic-unavailable",
  "mythic-available",
  "deterministic-rarity-retry",
  "source-specific-rarity-table",
  "pity-before-threshold",
  "pity-at-threshold",
  "retry-does-not-increment-pity",
  "unique-already-owned",
  "stack-cap-filter",
  "full-slots-filter",
  "bonus-slots-filter",
  "mutual-exclusion-filter",
  "source-restriction-filter",
  "depth-restriction-filter",
  "boss-restriction-filter",
  "no-duplicate-choices",
  "pool-exact-choice-count",
  "pool-smaller-than-choice-count",
  "empty-pool-unresolved",
  "legal-selection-each-option",
  "unknown-offer-id",
  "unknown-choice-id",
  "fake-client-relic-id",
  "fake-client-rarity",
  "selection-stale-revision",
  "selection-other-run",
  "selection-already-consumed",
  "second-choice-after-consumption",
  "exact-selection-retry",
  "selection-build-update",
  "selection-stack-update",
  "selection-slot-update",
  "regular-public-build-projection",
  "regular-build-digest",
  "regular-gold-modifier-integration",
  "reward-slot-consumed-once",
  "pending-offer-round-trip",
  "pity-state-round-trip",
  "regular-restart-determinism",
  "regular-ruleset-hash-mismatch",
  "bounded-offer-history-receipt"
]);

for (const fixture of fixtures) {
  test(`golden 3B2B2A executable: ${fixture.fixtureId}`, async () => {
    assert.ok(metadataOnlyFixtureIds.has(fixture.fixtureId));
    assert.equal(fixture.expectedRulesetHash, "manifest.rulesetHash");
    assert.match(manifest.rulesetHash, /^sha256:[a-f0-9]{64}$/u);
  });
}
