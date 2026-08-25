import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createV08Meta1Ruleset } from "../src/rulesets/v08-meta-1/index.js";
import { computeRelicBuildDigestV08 } from "../src/rulesets/v08-meta-1/relic-policy.js";
import { assertMetaStateV08, createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { canonicalJson } from "../src/security/canonical-json.js";
import {
  applyPracticeMutatorImportToProfileV08,
  createInitialProfileStateV08,
  hydrateRunFromProfileV08,
  profileStateFromRunV08,
  publicProfileStateV08
} from "../src/rulesets/v08-meta-1/profile-policy.js";
import { consumeRoomDirectiveV08, issueNextRoomDirectiveV08 } from "../src/rulesets/v08-meta-1/room-policy.js";
import { settleRoomRewardEnvelopeV3 } from "../src/rulesets/v08-meta-1/reward-policy.js";

const context = Object.freeze({
  runId: "run_campaign_parity",
  season: "r2-local",
  startedAt: 1_900_000_000_000,
  now: 1_900_000_000_000,
  secret: "campaign-parity-secret-0123456789abcdef",
  cryptoProvider: webcrypto
});

const highOracle = Object.freeze({
  async deriveIntInclusive(_min, max) {
    return max;
  },
  async deriveRandomBytes({ length }) {
    return new Uint8Array(length).fill(255);
  }
});

function initial(input = {}) {
  return createInitialMetaStateV08(input, context);
}
function rewardRequest(state, claims = []) {
  return {
    envelopeId: state.currentRewardEnvelope.envelopeId,
    roomDirectiveId: state.currentRoomDirective.directiveId,
    roomNonce: state.currentRoomDirective.roomNonce,
    claims,
    reportedGoldDelta: 0,
    reportedGoldTotal: 0,
    turnCount: 10,
    elapsedMs: 1_000,
    commandJournalDigest: "campaign_journal_0123456789abcdef",
    compactRoomProof: "campaign_proof_0123456789abcdef"
  };
}


test("Ranked profile preserves map progress, first-Warden history, and unlocked starts", async () => {
  const state = initial();
  state.status = "extraction";
  state.campaign.treasureMapFragments = 7;
  state.campaign.forcedNextRoomType = "vault";
  state.campaign.wardenFirstDropDepths = [5, 10];
  state.campaign.unlockedStartDepths = [11];
  const profile = profileStateFromRunV08(state, "profile_campaign", 3);
  assert.deepEqual(publicProfileStateV08(profile).campaign, state.campaign);
  const next = initial({ startDepth: 11, unlockedStartDepths: [11] });
  const persistedProfile = JSON.parse(canonicalJson(profile));
  const hydrated = await hydrateRunFromProfileV08(next, persistedProfile, { cryptoProvider: webcrypto });
  assert.doesNotThrow(() => assertMetaStateV08(hydrated));
  assert.deepEqual(hydrated.campaign, state.campaign);
  assert.equal(hydrated.build.resources.maxPotions, 3);
  assert.equal(hydrated.build.resources.potions, 3);
  const repeated = await hydrateRunFromProfileV08(next, persistedProfile, { cryptoProvider: webcrypto });
  assert.deepEqual(repeated.build.resources, hydrated.build.resources);
});

test("natural Otter state survives extract and Camp, preventing the depth 41 pity", async () => {
  const firstDescent = initial();
  firstDescent.status = "extraction";
  firstDescent.campaign.otterSeenInCampaign = true;
  const profile = profileStateFromRunV08(firstDescent, "profile_otter_seen", 2);
  const nextDescent = initial({ startDepth: 41, unlockedStartDepths: [41] });
  const hydrated = await hydrateRunFromProfileV08(nextDescent, profile, { cryptoProvider: webcrypto });
  hydrated.status = "active";
  assert.equal(hydrated.specialRoomScheduleState.otterSeenInGame, true);
  const issued = await issueNextRoomDirectiveV08(hydrated, { ...context, randomOracle: highOracle });
  assert.notEqual(issued.currentRoomDirective.specialRoomPayload?.policySource, "otter-pity");
});

test("used Otter pity survives Camp and cannot repeat in the next descent", async () => {
  const firstDescent = initial();
  firstDescent.status = "extraction";
  firstDescent.campaign.otterSeenInCampaign = true;
  firstDescent.campaign.otterPityUsedInCampaign = true;
  const profile = profileStateFromRunV08(firstDescent, "profile_otter_pity", 4);
  const nextDescent = initial({ startDepth: 41, unlockedStartDepths: [41] });
  const hydrated = await hydrateRunFromProfileV08(nextDescent, profile, { cryptoProvider: webcrypto });
  hydrated.status = "active";
  assert.equal(hydrated.specialRoomScheduleState.otterPityUsedInGame, true);
  const issued = await issueNextRoomDirectiveV08(hydrated, { ...context, randomOracle: highOracle });
  assert.notEqual(issued.currentRoomDirective.specialRoomPayload?.policySource, "otter-pity");
});

test("depth 41 grants one Otter pity when the campaign has not seen Otter", async () => {
  const state = initial({ startDepth: 41, unlockedStartDepths: [41] });
  state.status = "active";
  const issued = await issueNextRoomDirectiveV08(state, { ...context, randomOracle: highOracle });
  assert.equal(issued.currentRoomDirective.specialRoomPayload.policySource, "otter-pity");
  assert.equal(issued.campaign.otterSeenInCampaign, true);
  assert.equal(issued.campaign.otterPityUsedInCampaign, true);
});

test("a completely new campaign permits the depth 41 Otter pity again", async () => {
  const fresh = initial({ startDepth: 41, unlockedStartDepths: [41] });
  fresh.status = "active";
  assert.equal(fresh.campaign.otterSeenInCampaign, false);
  assert.equal(fresh.campaign.otterPityUsedInCampaign, false);
  const issued = await issueNextRoomDirectiveV08(fresh, { ...context, randomOracle: highOracle });
  assert.equal(issued.currentRoomDirective.specialRoomPayload.policySource, "otter-pity");
});

test("a completed treasure map forces the next non-boss room to Vault and is consumed once", async () => {
  const state = initial();
  state.status = "active";
  state.campaign.forcedNextRoomType = "vault";
  const issued = await issueNextRoomDirectiveV08(state, context);
  assert.equal(issued.currentRoomDirective.depth, 1);
  assert.equal(issued.currentRoomDirective.roomType, "vault");
  assert.equal(issued.campaign.forcedNextRoomType, "");
});
test("Ranked settlement preserves potion use and potion chest pickup", async () => {
  let state = initial();
  state.status = "active";
  state.campaign.forcedNextRoomType = "vault";
  state.build.resources.potions = 2;
  state.build.buildDigest = await computeRelicBuildDigestV08(state.build, webcrypto);
  state = await issueNextRoomDirectiveV08(state, context);
  const slotId = state.currentRewardEnvelope.claimSlots[0].slotId;
  const settled = await settleRoomRewardEnvelopeV3(state, rewardRequest(state, [
    { claimType: "resource", claimId: "potion-use", count: 1 },
    { claimType: "chest", claimId: slotId, count: 1, localEvidence: { outcome: "potion", count: 1 } }
  ]), context);
  assert.equal(settled.state.build.resources.potions, 2);
  assert.equal(settled.state.currentRewardEnvelope.claimSlots[0].consumed, true);

  let capped = initial();
  capped.status = "active";
  capped.campaign.forcedNextRoomType = "vault";
  capped = await issueNextRoomDirectiveV08(capped, context);
  const cappedSlotId = capped.currentRewardEnvelope.claimSlots[0].slotId;
  const cappedSettlement = await settleRoomRewardEnvelopeV3(capped, rewardRequest(capped, [
    { claimType: "chest", claimId: cappedSlotId, count: 1, localEvidence: { outcome: "potion", count: 1 } }
  ]), context);
  assert.equal(cappedSettlement.state.build.resources.potions, 3);
});

test("the tenth Ranked map fragment persists and queues a Vault", async () => {
  let state = initial();
  state.status = "active";
  state.campaign.forcedNextRoomType = "vault";
  state.campaign.treasureMapFragments = 9;
  state = await issueNextRoomDirectiveV08(state, context);
  const slotId = state.currentRewardEnvelope.claimSlots[0].slotId;
  const settled = await settleRoomRewardEnvelopeV3(state, rewardRequest(state, [
    { claimType: "chest", claimId: slotId, count: 1, localEvidence: { outcome: "map_fragment", count: 1 } }
  ]), context);
  assert.equal(settled.state.campaign.treasureMapFragments, 0);
  assert.equal(settled.state.campaign.forcedNextRoomType, "vault");
});

test("defeating the depth 10 Warden unlocks depth 11 and only that profile may start there", async () => {
  let state = initial();
  state.status = "active";
  state.depth = 9;
  state.roomIndex = 9;
  state = await issueNextRoomDirectiveV08(state, context);
  assert.equal(state.currentRoomDirective.roomType, "boss");
  assert.equal(state.currentRoomDirective.depth, 10);
  const settled = await settleRoomRewardEnvelopeV3(state, rewardRequest(state), context);
  assert.deepEqual(settled.state.campaign.unlockedStartDepths, [11]);

  const extracted = structuredClone(settled.state);
  extracted.status = "extraction";
  const unlockedProfile = profileStateFromRunV08(extracted, "profile_checkpoint", 1);
  const lockedProfile = createInitialProfileStateV08(initial(), "profile_locked");
  const ruleset = createV08Meta1Ruleset({ secret: context.secret, cryptoProvider: webcrypto });
  await assert.rejects(
    ruleset.createRun({ startDepth: 11, profileState: lockedProfile }, { ...context, runId: "run_locked_checkpoint" }),
    /START_DEPTH_LOCKED/u
  );
  const started = await ruleset.createRun(
    { startDepth: 11, profileState: unlockedProfile },
    { ...context, runId: "run_unlocked_checkpoint" }
  );
  assert.equal(started.startDepth, 11);
  assert.equal(started.currentRoomDirective?.depth, 11);
});

test("depth 5 Warden checkpoint accepts bounded potion use before advancing", async () => {
  let state = initial();
  state.status = "active";
  state.depth = 4;
  state.roomIndex = 4;
  state.build.resources.potions = 2;
  state.build.buildDigest = await computeRelicBuildDigestV08(state.build, webcrypto);
  state = await issueNextRoomDirectiveV08(state, context);
  assert.equal(state.currentRoomDirective.roomType, "boss");
  assert.equal(state.currentRoomDirective.depth, 5);

  const directive = state.currentRoomDirective;
  const next = await consumeRoomDirectiveV08(state, {
    runId: state.runId,
    rulesetHash: state.rulesetHash,
    revision: state.revision,
    directiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
    roomIndex: directive.roomIndex,
    depth: directive.depth,
    roomType: directive.roomType,
    completionAttestation: "local-room-completed",
    rewardClaim: rewardRequest(state, [
      { claimType: "enemy", claimId: "enemy:warden", count: 1 },
      { claimType: "resource", claimId: "potion-use", count: 1 }
    ])
  }, context);

  assert.equal(next.depth, 5);
  assert.equal(next.build.resources.potions, 1);
  assert.equal(next.currentRoomDirective.depth, 6);
  assert.equal(next.currentRoomDirective.roomIndex, 6);
});

test("fresh Ranked profile starts with the exact v0.8 campaign defaults", () => {
  const profile = createInitialProfileStateV08(initial(), "profile_defaults");
  assert.deepEqual(profile.campaign, {
    treasureMapFragments: 0,
    forcedNextRoomType: "",
    wardenFirstDropDepths: [],
    unlockedStartDepths: [],
    forgeSeenInCampaign: false,
    forgePityUsedInCampaign: false,
    otterSeenInCampaign: false,
    otterPityUsedInCampaign: false,
    protectedStarterRelicId: "",
    scoreCarry: { highWaterDepth: 0, earnedGold: 0 },
    chestBonuses: {
      schemaVersion: 1,
      attackDepthBuckets: {},
      armorDepthBuckets: {},
      healthDepthBuckets: {}
    }
  });
});

test("highestUnlockedDepth carries only within one Ranked campaign", async () => {
  const source = initial();
  source.status = "extraction";
  source.build.resources.highestUnlockedDepth = 20;
  const profile = profileStateFromRunV08(source, "profile_depth_parity", 7);

  const next = await hydrateRunFromProfileV08(
    initial(),
    profile,
    { cryptoProvider: webcrypto }
  );
  const repeated = await hydrateRunFromProfileV08(
    initial(),
    JSON.parse(canonicalJson(profile)),
    { cryptoProvider: webcrypto }
  );
  assert.equal(next.build.resources.highestUnlockedDepth, 20);
  assert.equal(repeated.build.resources.highestUnlockedDepth, 20);

  const fresh = createInitialProfileStateV08(initial(), "profile_fresh_campaign");
  assert.equal(fresh.build.resources.highestUnlockedDepth, 0);

  const campaignBefore = structuredClone(profile.campaign);
  const imported = applyPracticeMutatorImportToProfileV08(
    profile,
    {
      metrics: { depthHighscore: 99 },
      historicalUnlockedMutatorIds: ["resilience"]
    },
    { now: context.now }
  );
  assert.equal(imported.build.resources.highestUnlockedDepth, 20);
  assert.deepEqual(imported.campaign, campaignBefore);
});

test("production bridge uses native Forge and native Camp checkpoint selection", async () => {
  const builder = await readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../../../online-v3/ranked-v3-runtime.js", import.meta.url), "utf8");
  assert.match(builder, /openRankedForgeRoom/u);
  assert.match(builder, /onForgeMode/u);
  assert.match(builder, /enterRankedForge/u);
  assert.match(builder, /state.onlineV3ForgePresentation/u);
  assert.match(builder, /syncRankedStartDepthUnlocks/u);
  assert.match(builder, /onCampStartRun\?\.\(selectedDepth\)/u);
  assert.doesNotMatch(runtime, /ui\.showMessage\("Forge", "Choose the Forge operation\."/u);
  assert.match(runtime, /function onForgeMode\(mode, context = \{\}\)/u);
  assert.match(runtime, /function onCampStartRun\(startDepth = 0\)[\s\S]*prepareFreshRankedStart\(false\)/u);
  assert.match(runtime, /boundedCombatResources/u);
  assert.match(runtime, /summary:[\s\S]*combatResources/u);
  assert.match(runtime, /eventPayload:[\s\S]*combatResources/u);
  assert.match(runtime, /fatalPayload\.boundarySettlement = mergeCapturedBoundary\(captureRankedBoundary\(\)\)\.eventPayload/u);
  assert.match(builder, /onlineV3BoundedCombatResources/u);
  assert.match(builder, /hp: Math\.max\(0, Math\.floor\(Number\(state\.player\.hp\)/u);
  assert.match(builder, /maxHp: Math\.max\(0, Math\.floor\(Number\(state\.player\.maxHp\)/u);
});
