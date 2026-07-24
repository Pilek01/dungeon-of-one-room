import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertRegularRelicOfferV08,
  createV08Meta1Ruleset,
  getOtterRelicCandidatePoolV08,
  issueRegularRelicOffer,
  projectPublicRegularRelicOfferV08,
  selectRegularRelic
} from "../src/rulesets/v08-meta-1/index.js";
import {
  applyRelicAcquisition,
  assertCanonicalRelicBuildDigestV08,
  createEmptyRelicBuildV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import auditDocument from "../src/rulesets/v08-meta-1/data/special-relic-source-audit.generated.json" with { type: "json" };
import deferredDocument from "../src/rulesets/v08-meta-1/data/deferred-special-relic-spec.generated.json" with { type: "json" };
import otterPolicyDocument from "../src/rulesets/v08-meta-1/data/otter-relic-offer-policy.generated.json" with { type: "json" };
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(await readFile(
  path.join(
    WORKER_ROOT,
    "src",
    "rulesets",
    "v08-meta-1",
    "test",
    "phase3b2b2b1-golden-fixtures.json"
  ),
  "utf8"
));
const requiredFixtureFields = [
  "fixtureId",
  "legacySourceEvidence",
  "sourceType",
  "initialMetaState",
  "roomDirective",
  "rewardEnvelope",
  "rewardSlot",
  "serverRandomInputs",
  "expectedRarity",
  "expectedCandidatePool",
  "expectedOffer",
  "selection",
  "expectedBuild",
  "expectedError",
  "expectedRulesetHash"
];
const allowedDeferredStatuses = new Set([
  "IMPLEMENTED",
  "NOT_AN_ACTIVE_RELIC_SOURCE",
  "READY_FOR_IMPLEMENTATION",
  "REQUIRES_TRANSACTION_PHASE",
  "BLOCKED_BY_REPLACEMENT_POLICY",
  "UNRESOLVED_ACTIVE_RELIC_SOURCE",
  "NOT_PRODUCTION_SOURCE"
]);

function deterministicOracle(seed, controls = {}, purposeLog = []) {
  return {
    async deriveRandomBytes(options) {
      purposeLog.push(options.purpose);
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
      purposeLog.push(options.purpose);
      let forced;
      if (options.purpose === "room-type/otter-queue") forced = 0;
      else if (options.purpose === "otter-relic-offer-rarity") {
        forced = controls.rarityRolls?.[options.counter];
      } else if (options.purpose === "otter-relic-offer-candidate") {
        forced = controls.candidateRolls?.[options.counter];
      } else if (options.purpose === "otter-relic-choice-order") {
        forced = controls.orderRolls?.[options.counter] ?? maximum;
      }
      if (Number.isSafeInteger(forced)) {
        return Math.max(minimum, Math.min(maximum, forced));
      }
      const digest = createHash("sha256")
        .update(`${seed}|${options.runId}|${options.revision}|${options.purpose}|${options.counter}`)
        .digest();
      return minimum + digest.readUInt32BE(0) % (maximum - minimum + 1);
    }
  };
}

function context(runId, seed = runId, controls = {}, purposeLog = []) {
  return {
    runId,
    season: "season-phase3b2b2b1",
    startedAt: 1_700_000_300_000,
    elapsedMs: 1_000,
    secret: "phase3b2b2b1:0123456789abcdef0123456789abcdef",
    randomOracle: deterministicOracle(seed, controls, purposeLog)
  };
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

async function otterState({
  runId = "otter_offer",
  depth = 21,
  occurrence = 1,
  build = null,
  seed = runId,
  controls = {},
  purposeLog = []
} = {}) {
  const resolvedContext = context(runId, seed, controls, purposeLog);
  const resolvedRuleset = createV08Meta1Ruleset({
    secret: resolvedContext.secret,
    randomOracle: resolvedContext.randomOracle
  });
  let state = await resolvedRuleset.createRun({ startDepth: 0 }, resolvedContext);
  state = await resolvedRuleset.selectStartingRelic(state, {
    offerId: state.pendingOffer.offerId,
    choiceId: state.pendingOffer.choices[1].choiceId
  }, resolvedContext);
  state.depth = depth - 1;
  state.roomIndex = depth - 1;
  state.currentRoomDirective = null;
  state.currentRewardEnvelope = null;
  state.statistics.roomsCompleted = 1;
  state.specialRoomScheduleState.otterRoomsSeenThisRun = occurrence - 1;
  state.specialRoomScheduleState.otterSeenInGame = occurrence > 1;
  if (build) state.build = build;
  state = await resolvedRuleset.issueRoomDirective(state, resolvedContext);
  assert.equal(state.currentRoomDirective.roomType, "otter");
  assert.equal(state.currentRewardEnvelope.rewardSlots.length, 1);
  return { state, resolvedRuleset, resolvedContext, purposeLog };
}

function issueRequest(state, overrides = {}) {
  return {
    rewardEnvelopeId: state.currentRewardEnvelope.envelopeId,
    rewardSlotId: state.currentRewardEnvelope.rewardSlots[0]?.slotId || "missing",
    sourceDirectiveId: state.currentRoomDirective.directiveId,
    ...overrides
  };
}

async function issued(options = {}) {
  const result = await otterState(options);
  result.state = await issueRegularRelicOffer(
    result.state,
    issueRequest(result.state),
    result.resolvedContext
  );
  return result;
}

test("Phase 3B2B2B1 golden corpus has exactly 50 complete fixtures", () => {
  assert.equal(fixtures.length, 50);
  assert.equal(new Set(fixtures.map((fixture) => fixture.fixtureId)).size, 50);
  for (const fixture of fixtures) {
    assert.deepEqual(Object.keys(fixture), requiredFixtureFields);
    assert.ok(fixture.legacySourceEvidence.length > 0);
    assert.equal(fixture.expectedRulesetHash, "manifest.rulesetHash");
  }
});

test("special relic audit is complete and uses the required exact schema", () => {
  const audit = auditDocument.canonicalData;
  assert.equal(audit.sourceCount, 12);
  assert.deepEqual(audit.implementedSourceIds, ["otter-crimson-chest"]);
  assert.deepEqual(audit.unresolvedSourceIds, []);
  for (const source of audit.sources) {
    assert.deepEqual(Object.keys(source), audit.auditFields);
    assert.ok(source.sourceEvidence.length > 0);
  }
  for (const sourceId of [
    "vault-standard-chest",
    "otter-crimson-chest",
    "arena-reward-cache",
    "crossroads-power",
    "merchant-relic-slot",
    "merchant-reserved-relic",
    "merchant-black-market",
    "forge-temper",
    "forge-transmute",
    "global-replacement-rewards",
    "pact-room",
    "debug-cheat-relic-picker"
  ]) {
    assert.ok(audit.sources.some((entry) => entry.sourceId === sourceId), sourceId);
  }
});

test("deferred source specification is executable and status-complete", () => {
  const deferred = deferredDocument.canonicalData;
  assert.deepEqual(new Set(deferred.allowedStatuses), allowedDeferredStatuses);
  assert.equal(deferred.sourceCount, 11);
  for (const source of deferred.sources) {
    assert.ok(allowedDeferredStatuses.has(source.status), source.sourceId);
    assert.ok(source.trigger);
    assert.ok(source.rewardType);
    assert.ok(source.sourceEvidence.length > 0);
  }
});

test("Vault is proven not to be an active relic source and receives no relic offer slot", async () => {
  const vault = auditDocument.canonicalData.sources.find(
    (entry) => entry.sourceId === "vault-standard-chest"
  );
  assert.equal(vault.deferredReason, "NOT_AN_ACTIVE_RELIC_SOURCE");
  assert.equal(vault.serverCanIssueExactly, false);
  assert.equal(vault.offerChoiceCount, 0);
  const prepared = await otterState({ runId: "vault_no_slot" });
  prepared.state = structuredClone(prepared.state);
  prepared.state.currentRoomDirective.roomType = "vault";
  prepared.state.currentRoomDirective.roomCategory = "special";
  prepared.state.currentRewardEnvelope.roomType = "vault";
  prepared.state.currentRewardEnvelope.rewardSlots = [];
  await assert.rejects(
    issueRegularRelicOffer(
      prepared.state,
      issueRequest(prepared.state),
      prepared.resolvedContext
    ),
    /RELIC_REWARD_SLOT_UNKNOWN/u
  );
});

test("Otter policy reproduces exact active baseline constants and pity classification", () => {
  const policy = otterPolicyDocument.canonicalData;
  assert.equal(policy.minimumDepth, 20);
  assert.equal(policy.firstEffectiveNonBossDepth, 21);
  assert.equal(policy.maximumDepth, 99);
  assert.equal(policy.excludedBossInterval, 5);
  assert.equal(policy.maximumOccurrencesPerRun, 3);
  assert.equal(policy.offerChoiceCount, 9);
  assert.deepEqual(policy.allowedRarities, ["rare", "epic", "legendary", "mythic"]);
  assert.equal(policy.pityPolicy.rewardOfferPity, "NONE");
  assert.equal(policy.pityPolicy.roomSchedulePityScope, "GAME_SESSION_SCOPED");
  assert.equal(
    policy.pityPolicy.roomSchedulePityStatus,
    "DEFERRED_GAME_SESSION_SCOPED_PITY"
  );
});

test("Otter slot, offer binding, deterministic retry, restart and run separation are exact", async () => {
  const first = await issued({ runId: "otter_deterministic", seed: "shared_seed" });
  const offer = first.state.pendingOffer;
  assertRegularRelicOfferV08(offer);
  assert.equal(offer.sourceType, "otter");
  assert.equal(offer.sourceId, "otter-crimson-chest");
  assert.equal(first.state.currentRewardEnvelope.rewardSlots[0].offerId, offer.offerId);
  const retry = await issueRegularRelicOffer(
    first.state,
    issueRequest(first.state),
    first.resolvedContext
  );
  assert.deepEqual(retry, first.state);

  const restarted = await issued({ runId: "otter_deterministic", seed: "shared_seed" });
  assert.deepEqual(restarted.state.pendingOffer, offer);
  const otherRun = await issued({ runId: "otter_other_run", seed: "shared_seed" });
  assert.notEqual(otherRun.state.pendingOffer.offerId, offer.offerId);
  assert.notDeepEqual(
    otherRun.state.pendingOffer.choices.map((choice) => choice.choiceId),
    offer.choices.map((choice) => choice.choiceId)
  );
});

test("Otter boundaries and occurrence limit are enforced by issued directive and reward policy", async () => {
  for (const depth of [21, 99]) {
    const result = await issued({ runId: `otter_depth_${depth}`, depth });
    assert.equal(result.state.currentRoomDirective.depth, depth);
    assert.ok(result.state.pendingOffer);
  }
  const result = await otterState({ runId: "otter_occurrence_limit", occurrence: 3 });
  result.state.specialRoomScheduleState.otterRoomsSeenThisRun = 4;
  await assert.rejects(
    issueRegularRelicOffer(result.state, issueRequest(result.state), result.resolvedContext),
    /OTTER_RELIC_REWARD_RUN_LIMIT_INVALID/u
  );
});

test("Otter issue rejects fake slot, stale revision, source and directive mismatches", async () => {
  {
    const result = await otterState({ runId: "otter_fake_slot" });
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
    const result = await otterState({ runId: "otter_stale" });
    result.state.revision += 1;
    await assert.rejects(
      issueRegularRelicOffer(result.state, issueRequest(result.state), result.resolvedContext),
      /RELIC_REWARD_ENVELOPE_STALE/u
    );
  }
  {
    const result = await otterState({ runId: "otter_source" });
    result.state.currentRewardEnvelope.rewardSlots[0].sourceId = "warden-standard-drop";
    await assert.rejects(
      issueRegularRelicOffer(result.state, issueRequest(result.state), result.resolvedContext),
      /RELIC_REWARD_SOURCE_MISMATCH/u
    );
  }
  {
    const result = await otterState({ runId: "otter_directive" });
    await assert.rejects(
      issueRegularRelicOffer(
        result.state,
        issueRequest(result.state, { sourceDirectiveId: "fake" }),
        result.resolvedContext
      ),
      /RELIC_REWARD_DIRECTIVE_MISMATCH/u
    );
  }
});

test("Otter choices are canonical, rare+, unique, source-filtered and independently selectable", async () => {
  const base = await issued({ runId: "otter_choices" });
  const allowed = new Set(otterPolicyDocument.canonicalData.allowedRarities);
  const pool = new Set(getOtterRelicCandidatePoolV08(base.state));
  assert.ok(base.state.pendingOffer.choices.length >= 1);
  assert.ok(base.state.pendingOffer.choices.length <= 9);
  assert.equal(
    new Set(base.state.pendingOffer.choices.map((choice) => choice.privateRelicId)).size,
    base.state.pendingOffer.choices.length
  );
  for (const [index, choice] of base.state.pendingOffer.choices.entries()) {
    assert.ok(pool.has(choice.privateRelicId));
    assert.ok(allowed.has(base.state.pendingOffer.publicChoices[index].rarity));
    const selected = await selectRegularRelic(
      structuredClone(base.state),
      { offerId: base.state.pendingOffer.offerId, choiceId: choice.choiceId },
      base.resolvedContext
    );
    assert.ok(selected.build.relics.some((entry) => entry.relicId === choice.privateRelicId));
    await assertCanonicalRelicBuildDigestV08(selected.build);
  }
});

test("Otter selection uses opaque IDs, preserves economy fields and remains idempotent", async () => {
  const result = await issued({ runId: "otter_selection" });
  const offer = result.state.pendingOffer;
  const request = { offerId: offer.offerId, choiceId: offer.choices[0].choiceId };
  const snapshot = structuredClone(result.state);
  for (const [field, value] of [["relicId", "fake"], ["rarity", "mythic"]]) {
    await assert.rejects(
      selectRegularRelic(result.state, { ...request, [field]: value }, result.resolvedContext),
      new RegExp(`RELIC_OFFER_SELECTION_UNKNOWN_FIELD:${field}`, "u")
    );
    assert.deepEqual(result.state, snapshot);
  }
  const selected = await selectRegularRelic(result.state, request, result.resolvedContext);
  assert.equal(selected.gold, result.state.gold);
  assert.equal(selected.lives, result.state.lives);
  assert.equal(selected.depth, result.state.depth);
  assert.equal(selected.currentRewardEnvelope.rewardSlots[0].consumed, true);
  assert.equal(selected.pendingOffer, null);
  const retry = await selectRegularRelic(selected, request, result.resolvedContext);
  assert.deepEqual(retry, selected);
  await assert.rejects(
    selectRegularRelic(selected, {
      offerId: offer.offerId,
      choiceId: offer.choices[1].choiceId
    }, result.resolvedContext),
    /RELIC_REWARD_OFFER_ALREADY_CONSUMED_DIFFERENT_CHOICE/u
  );
});

test("Otter empty pool fails closed and replacement-dependent full builds stay explicit", async () => {
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
  assert.deepEqual(getOtterRelicCandidatePoolV08({ build }), []);
  const result = await otterState({ runId: "otter_empty", build });
  const before = structuredClone(result.state);
  await assert.rejects(
    issueRegularRelicOffer(result.state, issueRequest(result.state), result.resolvedContext),
    /UNRESOLVED_EMPTY_RELIC_POOL/u
  );
  assert.deepEqual(result.state, before);
  assert.equal(otterPolicyDocument.canonicalData.fullPoolBehavior, "BLOCKED_BY_REPLACEMENT_POLICY");
});

test("Otter RNG purposes are isolated and public payload contains only the safe projection", async () => {
  const purposeLog = [];
  const result = await issued({ runId: "otter_namespace", purposeLog });
  const otterPurposes = new Set(purposeLog.filter((purpose) => purpose.startsWith("otter-relic")));
  assert.deepEqual(otterPurposes, new Set(otterPolicyDocument.canonicalData.rngPurposes));
  assert.equal(
    purposeLog.some((purpose) => purpose.startsWith("vault-relic")),
    false
  );
  const publicOffer = projectPublicRegularRelicOfferV08(result.state.pendingOffer);
  assert.equal(Object.hasOwn(publicOffer, "choices"), false);
  assert.equal(Object.hasOwn(publicOffer, "issuedStateDigest"), false);
  for (const choice of publicOffer.publicChoices) {
    assert.deepEqual(
      Object.keys(choice),
      otterPolicyDocument.canonicalData.publicChoiceFields
    );
  }
  const bytes = Buffer.byteLength(JSON.stringify(publicOffer), "utf8");
  console.info(`Phase 3B2B2B1 maximum public Otter relic offer: ${bytes} bytes`);
  assert.ok(bytes < otterPolicyDocument.canonicalData.publicPayloadTargetBytes, `${bytes} bytes`);
});

test("Otter pending offer survives JSON round trip and hash mismatch fails closed", async () => {
  const result = await issued({ runId: "otter_round_trip" });
  assert.deepEqual(JSON.parse(JSON.stringify(result.state)), result.state);
  const mismatch = structuredClone(result.state);
  mismatch.currentRewardEnvelope.rulesetHash = "sha256:deadbeef";
  mismatch.pendingOffer = null;
  mismatch.currentRewardEnvelope.rewardSlots[0].offerId = null;
  mismatch.currentRewardEnvelope.rewardSlots[0].resolution = null;
  await assert.rejects(
    issueRegularRelicOffer(mismatch, issueRequest(mismatch), result.resolvedContext),
    /RELIC_REWARD_RULESET_MISMATCH/u
  );
  assert.match(manifest.rulesetHash, /^sha256:[a-f0-9]{64}$/u);
});

for (const fixture of fixtures) {
  test(`golden 3B2B2B1 executable inventory: ${fixture.fixtureId}`, async () => {
    if (fixture.sourceType === "vault" || fixture.fixtureId.includes("vault")) {
      const vault = auditDocument.canonicalData.sources.find(
        (entry) => entry.sourceId === "vault-standard-chest"
      );
      assert.equal(vault.implementedInThisPhase, false);
      assert.equal(vault.deferredReason, "NOT_AN_ACTIVE_RELIC_SOURCE");
    } else {
      const otter = auditDocument.canonicalData.sources.find(
        (entry) => entry.sourceId === "otter-crimson-chest"
      );
      assert.equal(otter.implementedInThisPhase, true);
      assert.equal(otter.serverCanIssueExactly, true);
    }
    assert.equal(fixture.expectedRulesetHash, "manifest.rulesetHash");
  });
}
