import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { beginCampSessionV08, commitCampTransactionV08, issueCampTransactionsV08 } from "../src/rulesets/v08-meta-1/camp-policy.js";
import { issueNextRoomDirectiveV08 } from "../src/rulesets/v08-meta-1/room-policy.js";
import { settleRoomRewardEnvelopeV3 } from "../src/rulesets/v08-meta-1/reward-policy.js";
import { applyFatalEventV08 } from "../src/rulesets/v08-meta-1/life-policy.js";
import { requestExtractionV08 } from "../src/rulesets/v08-meta-1/outcome-policy.js";
import { hydrateRunFromProfileV08, publicProfileStateV08, profileStateFromRunV08 } from "../src/rulesets/v08-meta-1/profile-policy.js";
import { applyMutatorProgressDeltaV08 } from "../src/rulesets/v08-meta-1/mutator-progression.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };
import { observerBotReleaseConfig } from "../../../scripts/pages-release-preflight.mjs";

const SECRET = "online-boundary-repair:0123456789abcdef0123456789abcdef";
const CONTEXT = Object.freeze({
  runId: "run_online_boundary_repair",
  season: "repair-season",
  startedAt: 1_900_000_000_000,
  now: 1_900_000_000_000,
  secret: SECRET,
  cryptoProvider: webcrypto
});

function oracle() {
  return {
    async deriveRandomBytes(options) {
      const output = new Uint8Array(options.length);
      let offset = 0;
      let block = 0;
      while (offset < output.length) {
        const digest = createHash("sha256")
          .update([SECRET, options.runId, options.revision, options.purpose, options.counter, block].join("|"))
          .digest();
        const take = Math.min(digest.length, output.length - offset);
        output.set(digest.subarray(0, take), offset);
        offset += take;
        block += 1;
      }
      return output;
    },
    async deriveIntInclusive(minimum, maximum, options) {
      const digest = createHash("sha256")
        .update([SECRET, options.runId, options.purpose, options.counter].join("|"))
        .digest();
      return minimum + digest.readUInt32BE(0) % (maximum - minimum + 1);
    }
  };
}

function initialState(runId = CONTEXT.runId) {
  const context = { ...CONTEXT, runId, randomOracle: oracle() };
  const state = createInitialMetaStateV08({}, context);
  state.status = "active";
  return { state, context };
}

function rewardRequest(state, claims) {
  return {
    envelopeId: state.currentRewardEnvelope.envelopeId,
    roomDirectiveId: state.currentRoomDirective.directiveId,
    roomNonce: state.currentRoomDirective.roomNonce,
    claims,
    reportedGoldDelta: 0,
    reportedGoldTotal: 0,
    turnCount: 1,
    elapsedMs: 1,
    commandJournalDigest: "repair-journal",
    compactRoomProof: "repair-proof"
  };
}

test("new Ranked campaign bridge resets highscore and chest effects, while next descent does not", async () => {
  const builder = await readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../../../online-v3/ranked-v3-runtime.js", import.meta.url), "utf8");
  assert.match(builder, /resetMetaProgressForFreshStart\(\{\s*persist:\s*false\s*\}\)/u);
  assert.match(builder, /newCampaign/u);
  assert.match(builder, /state\.highscore\s*=\s*depth/u);
  assert.match(runtime, /newCampaign/u);
  assert.match(runtime, /onCampStartRun[\s\S]*prepareFreshRankedStart\(false\)/u);
});

test("Ranked chest carry hydrates from canonical campaign state and isolates Practice persistence", async () => {
  const builder = await readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");
  const game = await readFile(new URL("../../../game.js", import.meta.url), "utf8");
  assert.match(builder, /hydrateRankedChestCarry/u);
  assert.match(builder, /enterRankedCamp[\s\S]*hydrateRankedChestCarry/u);
  assert.match(builder, /returnToPractice[\s\S]*resetSessionChestBonuses/u);
  assert.match(game, /function resetMetaProgressForFreshStart\(options = \{\}/u);
  assert.match(game, /options\.persist/u);
});

test("Online Ranked Camp exposes a server-issued mutator addition and carries it", async () => {
  const { state, context } = initialState("run_mutator_repair");
  state.campGold = 100;
  state.goldLedger.campEarnedServerDerived = 100;
  state.build.resources.highestUnlockedDepth = 50;
  state.mutatorProgress = applyMutatorProgressDeltaV08(state.mutatorProgress, { totalKills: 200 });
  let current = await beginCampSessionV08(state, context);
  current = await issueCampTransactionsV08(current, context);
  const choice = current.pendingInventory?.choices.find((entry) => entry.privateData?.action === "mutator_add");
  assert.ok(choice, "expected a canonical mutator Camp choice");
  const committed = await commitCampTransactionV08(current, {
    transactionId: choice.transactionId,
    choiceId: choice.choiceId
  }, context);
  assert.deepEqual(committed.runModifiers.active.map((entry) => entry.modifierId), [choice.privateData.mutatorId]);
  const profile = profileStateFromRunV08({ ...committed, status: "extraction" }, "profile_mutator_repair", 1);
  assert.equal(publicProfileStateV08(profile).runModifiers.active[0].modifierId, choice.privateData.mutatorId);
});

test("Online Ranked Camp offers only unlocked additions and always allows active removal", async () => {
  const { state, context } = initialState("run_mutator_toggle_repair");
  state.mutatorProgress = applyMutatorProgressDeltaV08(state.mutatorProgress, { totalKills: 200 });
  let current = await beginCampSessionV08(state, context);
  current = await issueCampTransactionsV08(current, context);
  const addChoices = current.pendingInventory.choices.filter((entry) => entry.privateData?.action === "mutator_add");
  assert.deepEqual(addChoices.map((entry) => entry.privateData.mutatorId), ["berserker"]);
  current = await commitCampTransactionV08(current, {
    transactionId: addChoices[0].transactionId,
    choiceId: addChoices[0].choiceId
  }, context);
  current = await issueCampTransactionsV08(current, context);
  const remove = current.pendingInventory.choices.find((entry) => entry.privateData?.action === "mutator_remove");
  assert.equal(remove.privateData.mutatorId, "berserker");
  current = await commitCampTransactionV08(current, {
    transactionId: remove.transactionId,
    choiceId: remove.choiceId
  }, context);
  assert.deepEqual(current.runModifiers.active, []);
  assert.deepEqual(current.mutatorProgress.unlockedMutatorIds, ["berserker"]);
});

test("Ranked profile persists canonical unlock progress and legacy active modifiers hydrate unlocked", async () => {
  const { state, context } = initialState("run_mutator_profile_progress");
  state.mutatorProgress = applyMutatorProgressDeltaV08(state.mutatorProgress, { totalKills: 200 });
  const profile = profileStateFromRunV08(
    { ...state, status: "extraction" },
    "profile_mutator_progress",
    2
  );
  assert.deepEqual(publicProfileStateV08(profile).mutatorProgress.unlockedMutatorIds, ["berserker"]);

  delete profile.mutatorProgress;
  profile.runModifiers.active = [{
    modifierId: "greed",
    stacks: 1,
    activatedRevision: 1,
    activationSource: "server-issued-mid-run"
  }];
  profile.runModifiers.activeCount = 1;
  const hydrated = await hydrateRunFromProfileV08(state, profile, context);
  assert.deepEqual(hydrated.mutatorProgress.unlockedMutatorIds, ["greed"]);
});

test("accepted checkpoint advances kill, elite, gold, depth, shield and potion tracking exactly once", async () => {
  const { state, context } = initialState("run_mutator_checkpoint_progress");
  const issued = await issueNextRoomDirectiveV08(state, context);
  const request = rewardRequest(issued, [
    { claimType: "enemy", claimId: "enemy:slime", count: 1 },
    { claimType: "elite", claimId: "elite:slime", count: 1 },
    { claimType: "resource", claimId: "shield-use", count: 18 },
    { claimType: "resource", claimId: "potion-use", count: 1 }
  ]);
  const settled = await settleRoomRewardEnvelopeV3(issued, request, context);
  assert.equal(settled.state.mutatorProgress.totalKills, 2);
  assert.equal(settled.state.mutatorProgress.eliteKills, 1);
  assert.equal(settled.state.mutatorProgress.depthHighscore, issued.currentRewardEnvelope.depth);
  assert.equal(settled.state.mutatorProgress.totalGoldEarned, settled.authoritativeGoldDelta);
  assert.equal(settled.state.mutatorProgress.shieldUsesThisGame, 18);
  assert.equal(settled.state.mutatorRunTracking.potionUses, 1);
  assert.equal(settled.state.mutatorProgress.unlockedMutatorIds.includes("resilience"), false);
  const replay = await settleRoomRewardEnvelopeV3(settled.state, request, context);
  assert.equal(replay.state.mutatorProgress.totalKills, 2);
  assert.equal(replay.state.mutatorProgress.shieldUsesThisGame, 18);
});

test("Famine unlocks only after normal depth-10 extraction with no potion use", () => {
  const { state } = initialState("run_mutator_famine_progress");
  state.depth = 10;
  state.statistics.roomsCompleted = 1;
  const extracted = requestExtractionV08(state, { mode: "normal" }).nextState;
  assert.equal(extracted.mutatorProgress.potionFreeExtract, 1);
  assert.ok(extracted.mutatorProgress.unlockedMutatorIds.includes("famine"));

  const used = initialState("run_mutator_famine_blocked").state;
  used.depth = 10;
  used.statistics.roomsCompleted = 1;
  used.mutatorRunTracking.potionUses = 1;
  const blocked = requestExtractionV08(used, { mode: "normal" }).nextState;
  assert.equal(blocked.mutatorProgress.potionFreeExtract, 0);
});

test("fatal event accepts one bounded elixir use and preserves 3/5 after a nonterminal death", async () => {
  const { state, context } = initialState("run_elixir_fatal_repair");
  state.build.elixirs = [{ elixirId: "fury_1", charges: 3 }];
  const result = await applyFatalEventV08(state, {
    classification: "local_fatal_event",
    elixirUsage: { elixirId: "fury_1", count: 1 }
  }, context);
  assert.equal(result.nextState.status, "active");
  assert.equal(result.nextState.build.elixirs[0].charges, 2);
  assert.equal(result.nextState.lives, 4);
});

test("checkpoint accepts bounded elixir-use claim and retries it idempotently", async () => {
  const { state, context } = initialState("run_elixir_checkpoint_repair");
  state.build.elixirs = [{ elixirId: "fury_1", charges: 5 }];
  const issued = await issueNextRoomDirectiveV08(state, context);
  const request = rewardRequest(issued, [{
    claimType: "resource",
    claimId: "elixir-use",
    count: 2,
    localEvidence: { elixirId: "fury_1" }
  }]);
  const settled = await settleRoomRewardEnvelopeV3(issued, request, context);
  assert.equal(settled.state.build.elixirs[0].charges, 3);
  const replay = await settleRoomRewardEnvelopeV3(settled.state, request, context);
  assert.equal(replay.replayed, true);
  assert.equal(replay.state.build.elixirs[0].charges, 3);
});

test("legacy profiles without elixirs remain valid for fatal events", async () => {
  const { state, context } = initialState("run_legacy_profile_repair");
  const result = await applyFatalEventV08(state, { classification: "local_fatal_event" }, context);
  assert.equal(result.nextState.status, "active");
  assert.deepEqual(result.nextState.build.elixirs, []);
});

test("deployed test bot remains password-gated and test music is muted", async () => {
  const builder = await readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../../../online-v3/ranked-v3-runtime.js", import.meta.url), "utf8");
  const protocol = await readFile(new URL("../../../online-v3/ranked-v3-protocol.js", import.meta.url), "utf8");
  const game = await readFile(new URL("../../../game.js", import.meta.url), "utf8");
  const headed = await readFile(new URL("../../../scripts/online-v3-ranked-headed.mjs", import.meta.url), "utf8");
  const releaseConfig = observerBotReleaseConfig({
    DUNGEON_ONLINE_TEST_BOT_PASSWORD: "boundary-observer-password"
  }, "release");
  assert.equal(releaseConfig.enabled, true);
  assert.match(releaseConfig.passwordHash, /^sha256:[a-f0-9]{64}$/u);
  assert.doesNotMatch(JSON.stringify(releaseConfig), /boundary-observer-password/u);
  assert.throws(
    () => observerBotReleaseConfig({}, "release"),
    /DUNGEON_ONLINE_TEST_BOT_PASSWORD is required for release builds/u
  );
  assert.match(builder, /unlockRankedTestBot/u);
  assert.match(builder, /canUseDebugCheats/u);
  assert.doesNotMatch(runtime, /Start \+ Observer Bot|Continue \+ Observer Bot/u);
  assert.doesNotMatch(runtime, /pendingBotPassword/u);
  assert.match(runtime, /requestTestControlsUnlock: unlockTestBot/u);
  assert.match(protocol, /"mark_test_assistance"/u);
  assert.match(
    game,
    /DEBUG_MENU_TOGGLE_KEY[\s\S]*DUNGEON_ONLINE_TEST_BOT_ENABLED[\s\S]*!state\.onlineV3TestBotUnlocked[\s\S]*requestTestControlsUnlock/u
  );
  assert.match(
    builder,
    /markTestAssistance\?\.\("observer_bot"\)[\s\S]*onlineV3TestBotUnlocked = true/u
  );
  assert.match(
    builder,
    /toggleDebugCheatMenu\(true, \{ botOnly: false \}\)/u
  );
  assert.doesNotMatch(headed, /Start \+ Observer Bot|Continue \+ Observer Bot/u);
  assert.match(
    headed,
    /button[^\n]*Start Ranked[\s\S]*keyboard\.press\("F9"\)[\s\S]*Toggle Observer Bot/u
  );
  assert.match(headed, /dungeonOneRoomAudioMuted/u);
});

test("headed Forge reward resolves the canonical replacement before leaving the room", async () => {
  const headed = await readFile(new URL("../../../scripts/online-v3-ranked-headed.mjs", import.meta.url), "utf8");

  assert.match(headed, /async function chooseForgeRewardWithCanonicalReplacement\(page, diagnostics\)/u);
  assert.match(headed, /metaTransactionOffer[\s\S]*removals[\s\S]*relicId[\s\S]*data-relic-key/u);
  assert.match(headed, /chooseForgeRewardWithCanonicalReplacement\(page, diagnostics\)[\s\S]*crossVisiblePortal/u);
});

test("Ranked Observer Bot owns canonical offers and waits for the full boundary", async () => {
  const builder = await readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../../../online-v3/ranked-v3-runtime.js", import.meta.url), "utf8");

  assert.match(runtime, /let observerBotBoundaryPending = false;/u);
  assert.match(runtime, /function isRankedObserverBotActive\(\)/u);
  assert.match(runtime, /function runObserverBotBoundary\(task\)/u);
  assert.match(runtime, /selectStartingRelic|select_relic/u);
  assert.match(runtime, /commit_relic_replacement/u);
  assert.match(runtime, /commit_meta_transaction/u);
  assert.match(
    runtime,
    /function onForgeMode\(mode, context = \{\}\)[\s\S]*runObserverBotBoundary[\s\S]*open_meta_offer/u
  );
  assert.match(runtime, /isObserverBotBoundaryPending/u);

  assert.match(builder, /isRankedTestBotActive\(\)/u);
  assert.match(builder, /DungeonOnlineV3\?\.isObserverBotBoundaryPending\?\.\(\)/u);
  assert.match(
    builder,
    /function runObserverBotStep\(\)[\s\S]*isObserverBotBoundaryPending[\s\S]*state\.phase/u
  );
});

test("capable Ranked rooms keep the journal open until portal, extract, or fatal settlement", async () => {
  const builder = await readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../../../online-v3/ranked-v3-runtime.js", import.meta.url), "utf8");
  const protocol = await readFile(new URL("../../../online-v3/ranked-v3-protocol.js", import.meta.url), "utf8");

  const clearStart = builder.indexOf("const completionCapability = onlineV3RoomCompletionCapability;");
  const clearEnd = builder.indexOf("`\n  ]\n];", clearStart);
  assert.ok(clearStart >= 0 && clearEnd > clearStart, "expected injected Ranked room-clear block");
  const clearBlock = builder.slice(clearStart, clearEnd);
  assert.equal((clearBlock.match(/onlineV3RewardRecorder\?\.snapshot/gu) || []).length, 1);
  assert.match(
    clearBlock,
    /if \(!window\.DungeonOnlineV3\?\.usesBoundarySettlement\?\.\(\)\)[\s\S]*onlineV3RewardRecorder\?\.snapshot/u
  );
  assert.match(clearBlock, /onLocalRoomCleared/u);
  assert.match(clearBlock, /reportedGoldDelta/u);

  assert.match(builder, /captureRankedBoundary\(\)[\s\S]*onlineV3RewardRecorder\?\.snapshot/u);
  assert.match(builder, /state\.onlineV3NextDirective[\s\S]*onPortalEntry/u);
  assert.match(builder, /resetRankedBoundaryRecorder/u);
  assert.match(protocol, /function supportsBoundarySettlement\(value\)/u);
  assert.match(runtime, /function onPortalEntry\(\)[\s\S]*captureRankedBoundary/u);
  assert.match(runtime, /mergeCapturedBoundary[\s\S]*Math\.max/u);
  assert.match(runtime, /Loading next depth…/u);
  assert.match(runtime, /Extracting…/u);
  assert.match(runtime, /fixedAwardGold[\s\S]*reportedGoldDelta/u);
  assert.match(runtime, /onFatalEvent[\s\S]*captureRankedBoundary/u);
  assert.match(runtime, /resetRankedBoundaryRecorder[\s\S]*resumePreventedFatal/u);
});
