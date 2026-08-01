import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { beginCampSessionV08, commitCampTransactionV08, issueCampTransactionsV08 } from "../src/rulesets/v08-meta-1/camp-policy.js";
import { issueNextRoomDirectiveV08 } from "../src/rulesets/v08-meta-1/room-policy.js";
import { settleRoomRewardEnvelopeV3 } from "../src/rulesets/v08-meta-1/reward-policy.js";
import { applyFatalEventV08 } from "../src/rulesets/v08-meta-1/life-policy.js";
import { publicProfileStateV08, profileStateFromRunV08 } from "../src/rulesets/v08-meta-1/profile-policy.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

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
  assert.match(builder, /resetMetaProgressForFreshStart\(\)/u);
  assert.match(builder, /newCampaign/u);
  assert.match(builder, /state\.highscore\s*=\s*depth/u);
  assert.match(runtime, /newCampaign/u);
  assert.match(runtime, /onCampStartRun[\s\S]*prepareFreshRankedStart\(false\)/u);
});

test("Online Ranked Camp exposes a server-issued mutator addition and carries it", async () => {
  const { state, context } = initialState("run_mutator_repair");
  state.campGold = 100;
  state.goldLedger.campEarnedServerDerived = 100;
  state.build.resources.highestUnlockedDepth = 50;
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
  const headed = await readFile(new URL("../../../scripts/online-v3-ranked-headed.mjs", import.meta.url), "utf8");
  assert.match(builder, /DUNGEON_ONLINE_TEST_BOT_PASSWORD_HASH/u);
  assert.match(builder, /unlockRankedTestBot/u);
  assert.match(builder, /canUseDebugCheats/u);
  assert.match(runtime, /Observer Bot/u);
  assert.match(headed, /dungeonOneRoomAudioMuted/u);
});
