import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createV08Meta1Ruleset,
  assertStartingRelicOfferV08,
  projectPublicStartingRelicOfferV08,
  selectStartingRelic
} from "../src/rulesets/v08-meta-1/index.js";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { issueNextRoomDirectiveV08 } from "../src/rulesets/v08-meta-1/room-policy.js";
import {
  applyRelicAcquisition,
  assertCanonicalRelicBuildDigestV08,
  assertCanonicalRelicBuildV08,
  canAcquireRelic,
  createEmptyRelicBuildV08,
  getRelicSlotLimit,
  getRelicStackLimit,
  projectPublicBuild,
  V08_RELIC_POLICY_DATA
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import { calculateMultipliedGoldV08 } from "../src/rulesets/v08-meta-1/gold-policy.js";
import { settleRoomRewardEnvelopeV3 } from "../src/rulesets/v08-meta-1/reward-policy.js";

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULESET_ROOT = path.join(WORKER_ROOT, "src", "rulesets", "v08-meta-1");
const fixtures = JSON.parse(await readFile(
  path.join(RULESET_ROOT, "test", "phase3b2b1-golden-fixtures.json"),
  "utf8"
));
const manifest = JSON.parse(await readFile(
  path.join(RULESET_ROOT, "data", "ruleset-manifest.json"),
  "utf8"
));
const requiredFixtureFields = [
  "fixtureId",
  "legacySourceEvidence",
  "initialMetaState",
  "serverRandomInputs",
  "offer",
  "request",
  "expectedBuild",
  "expectedPublicBuild",
  "expectedNextStatus",
  "expectedError",
  "expectedRulesetHash"
];
const expectedFixtureIds = [
  "initial-starting-offer",
  "exact-starting-set",
  "deterministic-offer-retry",
  "different-run-opaque-ids",
  "legal-first-choice",
  "every-starting-option",
  "unknown-offer",
  "unknown-choice",
  "choice-outside-offer",
  "other-run-offer",
  "wrong-ruleset-offer",
  "stale-offer",
  "consumed-offer",
  "exact-selection-retry",
  "different-choice-after-consume",
  "fake-relic-rejected",
  "fake-rarity-rejected",
  "fake-stacks-rejected",
  "canonical-build-ledger",
  "public-build-projection",
  "stable-build-digest",
  "serialize-round-trip",
  "worker-restart-offer",
  "stack-cap",
  "full-slots",
  "bonus-slots",
  "unique-duplicate",
  "mythic-restriction",
  "unknown-relic-policy",
  "gold-modifier-integration",
  "fake-client-build-ignored",
  "room-blocked-before-choice",
  "room-unlocked-after-choice"
];

function context(runId = "run_phase3b2b1") {
  return {
    runId,
    season: "season-phase3b2b1",
    startedAt: 1_700_000_000_000,
    elapsedMs: 1_000,
    secret: "phase3b2b1:0123456789abcdef0123456789abcdef"
  };
}

function ruleset() {
  return createV08Meta1Ruleset({
    secret: "phase3b2b1:0123456789abcdef0123456789abcdef"
  });
}

async function offered(runId = "run_phase3b2b1") {
  const resolvedContext = context(runId);
  return ruleset().createRun({ startDepth: 0 }, resolvedContext);
}

async function selected(runId = "run_phase3b2b1", choiceIndex = 0) {
  const resolvedRuleset = ruleset();
  const resolvedContext = context(runId);
  const offerState = await resolvedRuleset.createRun({ startDepth: 0 }, resolvedContext);
  const choice = offerState.pendingOffer.choices[choiceIndex];
  const state = await resolvedRuleset.selectStartingRelic(offerState, {
    offerId: offerState.pendingOffer.offerId,
    choiceId: choice.choiceId
  }, resolvedContext);
  return { state, offerState, resolvedRuleset, resolvedContext };
}

async function buildWith(relicIds) {
  let build = createEmptyRelicBuildV08();
  let revision = 0;
  for (const relicId of relicIds) {
    build = await applyRelicAcquisition(build, {
      relicId,
      acquiredRevision: revision,
      acquisitionSource: "golden_fixture",
      sourceOfferId: `fixture_offer_${revision}`
    });
    revision += 1;
  }
  return build;
}

function selectionRequest(state, choiceIndex = 0, overrides = {}) {
  return {
    offerId: state.pendingOffer.offerId,
    choiceId: state.pendingOffer.choices[choiceIndex].choiceId,
    ...overrides
  };
}

function rewardRequest(state, overrides = {}) {
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
    commandJournalDigest: "phase3b2b1_fixture_journal",
    compactRoomProof: "phase3b2b1_fixture_proof",
    ...overrides
  };
}

test("Phase 3B2B1 golden corpus has exactly 33 complete fixtures", () => {
  assert.equal(fixtures.length, 33);
  assert.deepEqual(fixtures.map((fixture) => fixture.fixtureId), expectedFixtureIds);
  for (const fixture of fixtures) {
    assert.deepEqual(Object.keys(fixture), requiredFixtureFields);
    assert.ok(fixture.legacySourceEvidence.length > 0);
    assert.equal(fixture.expectedRulesetHash, "manifest.rulesetHash");
  }
});

const runners = {
  async "initial-starting-offer"() {
    const state = await offered();
    assert.equal(state.status, "awaiting_starting_relic");
    assert.equal(state.currentRoomDirective, null);
    assert.equal(state.pendingOffer.offerType, "starting_relic");
    assert.deepEqual(Object.keys(state.pendingOffer), [
      "offerId",
      "offerType",
      "runId",
      "rulesetHash",
      "issuedRevision",
      "sourceType",
      "sourceId",
      "choices",
      "publicChoices",
      "issuedStateDigest",
      "expiresOnRevision",
      "consumed",
      "consumedChoiceId",
      "consumedAtRevision",
      "selectionPending",
      "selectedChoiceId"
    ]);
    assertStartingRelicOfferV08(state.pendingOffer);
    assert.equal(state.rulesetHash, manifest.rulesetHash);
  },
  async "exact-starting-set"() {
    const state = await offered();
    assert.deepEqual(state.pendingOffer.choices.map((choice) => choice.privateRelicId), [
      "fang",
      "plating",
      "lucky"
    ]);
  },
  async "deterministic-offer-retry"() {
    assert.deepEqual(await offered("retry_run"), await offered("retry_run"));
  },
  async "different-run-opaque-ids"() {
    const left = await offered("opaque_left");
    const right = await offered("opaque_right");
    assert.notEqual(left.pendingOffer.offerId, right.pendingOffer.offerId);
    assert.notDeepEqual(
      left.pendingOffer.choices.map((choice) => choice.choiceId),
      right.pendingOffer.choices.map((choice) => choice.choiceId)
    );
  },
  async "legal-first-choice"() {
    const { state } = await selected();
    assert.deepEqual(state.build.relics.map(({ relicId, stacks }) => ({ relicId, stacks })), [
      { relicId: "fang", stacks: 1 }
    ]);
  },
  async "every-starting-option"() {
    for (const [index, relicId] of ["fang", "plating", "lucky"].entries()) {
      const { state } = await selected(`option_${index}`, index);
      assert.equal(state.build.relics[0].relicId, relicId);
    }
  },
  async "unknown-offer"() {
    const state = await offered();
    await assert.rejects(
      selectStartingRelic(state, selectionRequest(state, 0, { offerId: "offer_unknown" }), context()),
      /STARTING_RELIC_OFFER_UNKNOWN/u
    );
  },
  async "unknown-choice"() {
    const state = await offered();
    await assert.rejects(
      selectStartingRelic(state, selectionRequest(state, 0, { choiceId: "choice_unknown" }), context()),
      /STARTING_RELIC_CHOICE_UNKNOWN/u
    );
  },
  async "choice-outside-offer"() {
    const state = await offered("outside_a");
    const outside = await offered("outside_b");
    await assert.rejects(
      selectStartingRelic(
        state,
        selectionRequest(state, 0, { choiceId: outside.pendingOffer.choices[0].choiceId }),
        context("outside_a")
      ),
      /STARTING_RELIC_CHOICE_UNKNOWN/u
    );
  },
  async "other-run-offer"() {
    const state = await offered();
    await assert.rejects(
      selectStartingRelic(state, selectionRequest(state, 0, { runId: "other_run" }), context()),
      /STARTING_RELIC_OFFER_RUN_MISMATCH/u
    );
  },
  async "wrong-ruleset-offer"() {
    const state = await offered();
    await assert.rejects(
      selectStartingRelic(
        state,
        selectionRequest(state, 0, { rulesetHash: "sha256:wrong" }),
        context()
      ),
      /STARTING_RELIC_OFFER_RULESET_MISMATCH/u
    );
  },
  async "stale-offer"() {
    const state = await offered();
    state.revision += 1;
    await assert.rejects(
      selectStartingRelic(state, selectionRequest(state), context()),
      /STARTING_RELIC_OFFER_STALE/u
    );
  },
  async "consumed-offer"() {
    const { state } = await selected();
    assert.equal(state.pendingOffer, null);
    assert.equal(state.offerSettlementHistory.length, 1);
    assert.equal(state.offerSettlementHistory[0].offer.consumed, true);
    assert.equal(
      state.offerSettlementHistory[0].offer.consumedChoiceId,
      state.offerSettlementHistory[0].choiceId
    );
    assert.equal(state.offerSettlementHistory[0].offer.consumedAtRevision, 1);
  },
  async "exact-selection-retry"() {
    const result = await selected("selection_retry");
    const request = selectionRequest(result.offerState);
    const retry = await result.resolvedRuleset.selectStartingRelic(
      result.state,
      request,
      result.resolvedContext
    );
    assert.deepEqual(retry, result.state);
  },
  async "different-choice-after-consume"() {
    const result = await selected("selection_changed");
    await assert.rejects(
      result.resolvedRuleset.selectStartingRelic(
        result.state,
        selectionRequest(result.offerState, 1),
        result.resolvedContext
      ),
      /STARTING_RELIC_OFFER_ALREADY_CONSUMED_DIFFERENT_CHOICE/u
    );
  },
  async "fake-relic-rejected"() {
    const state = await offered("fake_private_relic");
    state.pendingOffer.choices[0].privateRelicId = "fake";
    await assert.rejects(
      selectStartingRelic(state, selectionRequest(state), context("fake_private_relic")),
      /STARTING_RELIC_PRIVATE_CHOICE_INVALID/u
    );
  },
  async "fake-rarity-rejected"() {
    const build = await buildWith(["ironboots"]);
    build.relics[0].rarity = "mythic";
    assert.throws(() => assertCanonicalRelicBuildV08(build), /RELIC_BUILD_ENTRY_UNKNOWN_FIELD:rarity/u);
  },
  async "fake-stacks-rejected"() {
    const build = await buildWith(["fang"]);
    build.relics[0].stacks = 99;
    assert.throws(() => assertCanonicalRelicBuildV08(build), /RELIC_STACKS_INVALID:fang/u);
  },
  async "canonical-build-ledger"() {
    const { state } = await selected();
    assertCanonicalRelicBuildV08(state.build);
    assert.deepEqual(Object.keys(state.build.relics[0]), [
      "relicId",
      "stacks",
      "acquiredRevision",
      "acquisitionSource",
      "sourceOfferId"
    ]);
  },
  async "public-build-projection"() {
    const { state, offerState } = await selected();
    const projectedBuild = projectPublicBuild(state.build);
    const projectedOffer = projectPublicStartingRelicOfferV08(offerState.pendingOffer);
    assert.deepEqual(projectedBuild.relics, [{ relicId: "fang", stacks: 1 }]);
    assert.equal(JSON.stringify(projectedBuild).includes("sourceOfferId"), false);
    assert.equal(Object.hasOwn(projectedOffer, "choices"), false);
    assert.equal(JSON.stringify(projectedOffer).includes("privateRelicId"), false);
  },
  async "stable-build-digest"() {
    const left = await buildWith(["fang", "fang", "plating"]);
    const right = await buildWith(["fang", "fang", "plating"]);
    assert.equal(left.buildDigest, right.buildDigest);
    left.relics[0].acquiredRevision += 1;
    await assert.rejects(
      assertCanonicalRelicBuildDigestV08(left),
      /RELIC_BUILD_DIGEST_MISMATCH/u
    );
  },
  async "serialize-round-trip"() {
    const { state } = await selected();
    assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  },
  async "worker-restart-offer"() {
    const left = await offered("restart_offer");
    const right = await offered("restart_offer");
    assert.deepEqual(left.pendingOffer, right.pendingOffer);
  },
  async "stack-cap"() {
    const build = await buildWith(["fang", "fang", "fang", "fang", "fang"]);
    assert.equal(getRelicStackLimit("fang"), 5);
    assert.deepEqual(canAcquireRelic(build, "fang"), {
      allowed: false,
      code: "RELIC_STACK_LIMIT_REACHED:fang"
    });
  },
  async "full-slots"() {
    const build = await buildWith([
      "ironboots",
      "fieldrations",
      "trapweave",
      "cachekey",
      "scoutlens",
      "shrineward",
      "idol",
      "thornmail"
    ]);
    assert.equal(build.relicSlotsUsed, 8);
    assert.equal(canAcquireRelic(build, "plating").code, "RELIC_SLOTS_FULL");
  },
  async "bonus-slots"() {
    let build = await buildWith([
      "ironboots",
      "fieldrations",
      "trapweave",
      "cachekey",
      "scoutlens",
      "shrineward",
      "idol",
      "thornmail"
    ]);
    build = await applyRelicAcquisition(build, {
      relicId: "abyssalreliquary",
      acquiredRevision: 8,
      acquisitionSource: "golden_fixture",
      sourceOfferId: "fixture_bonus"
    });
    assert.equal(getRelicSlotLimit(build), 10);
    assert.equal(build.relicSlotsUsed, 9);
    assert.equal(canAcquireRelic(build, "plating").allowed, true);
  },
  async "unique-duplicate"() {
    const build = await buildWith(["ironboots"]);
    assert.equal(canAcquireRelic(build, "ironboots").code, "RELIC_UNIQUE_DUPLICATE:ironboots");
  },
  async "mythic-restriction"() {
    const build = await buildWith(["abyssalreliquary"]);
    assert.equal(canAcquireRelic(build, "crownconcord").code, "RELIC_MYTHIC_LIMIT_REACHED");
  },
  async "unknown-relic-policy"() {
    assert.throws(() => getRelicStackLimit("unknown"), /RELIC_UNKNOWN/u);
  },
  async "gold-modifier-integration"() {
    const build = await buildWith(["idol"]);
    assert.equal(calculateMultipliedGoldV08({
      canonicalBuild: build,
      sourceId: "room-clear",
      baseAmount: 10
    }), 12);
  },
  async "fake-client-build-ignored"() {
    const { state } = await selected("fake_client_build");
    const result = await settleRoomRewardEnvelopeV3(
      state,
      rewardRequest(state, { clientBuild: { relics: [{ relicId: "idol", stacks: 99 }] } })
    );
    assert.equal(result.authoritativeGoldDelta, 2);
  },
  async "room-blocked-before-choice"() {
    const state = await offered("blocked_room");
    await assert.rejects(
      issueNextRoomDirectiveV08(state, context("blocked_room")),
      /RUN_NOT_ACTIVE/u
    );
  },
  async "room-unlocked-after-choice"() {
    const { state } = await selected("unlocked_room");
    assert.equal(state.status, "active");
    assert.equal(state.currentRoomDirective.depth, 1);
    assert.equal(state.currentRoomDirective.revision, 1);
  }
};

for (const fixture of fixtures) {
  test(`golden 3B2B1: ${fixture.fixtureId}`, async () => {
    await runners[fixture.fixtureId]();
  });
}

test("canonical relic catalog inventories every active v0.8 relic and exact starting eligibility", () => {
  assert.equal(V08_RELIC_POLICY_DATA.catalog.inventoryCount, 58);
  assert.deepEqual(
    V08_RELIC_POLICY_DATA.catalog.relics
      .filter((entry) => entry.startingEligible)
      .map((entry) => entry.relicId),
    ["fang", "plating", "lucky"]
  );
  for (const relic of V08_RELIC_POLICY_DATA.catalog.relics) {
    for (const field of [
      "relicId",
      "displayName",
      "rarity",
      "startingEligible",
      "stackable",
      "maximumStacks",
      "slotCost",
      "unique",
      "legendary",
      "mythic",
      "mythicRules",
      "bonusRelicSlots",
      "mutuallyExclusiveWith",
      "acquisitionSources",
      "depthRestrictions",
      "bossRestrictions",
      "goldModifierRef",
      "buildMetadataFields",
      "legacySourceFiles",
      "legacySourceSymbols",
      "notes"
    ]) {
      assert.ok(Object.hasOwn(relic, field), `${relic.relicId}:${field}`);
    }
  }
});
