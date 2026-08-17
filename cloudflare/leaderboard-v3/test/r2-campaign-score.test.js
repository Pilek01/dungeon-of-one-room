import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createWorker } from "../src/index.js";
import { RUN_TTL_MS } from "../src/config.js";
import { publicRulesetMetaState } from "../src/domain/ruleset-runtime.js";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import { V08_META_1_LOCAL_RELEASE_DESCRIPTOR } from "../src/rulesets/releases.js";
import { finalizeRunV08 } from "../src/rulesets/v08-meta-1/finalization-policy.js";
import {
  assertMetaStateV08,
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import { requestExtractionV08 } from "../src/rulesets/v08-meta-1/outcome-policy.js";
import {
  profileStateFromRunV08
} from "../src/rulesets/v08-meta-1/profile-policy.js";
import { createV08Meta1Ruleset } from "../src/rulesets/v08-meta-1/index.js";
import { deriveFinalScoreV08 } from "../src/rulesets/v08-meta-1/score-policy.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };
import { canonicalDigest } from "../src/security/digests.js";
import { canonicalJson } from "../src/security/canonical-json.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";

const STARTED_AT = 1_930_000_000_000;
const PROFILE_ID = "profile_0123456789abcdef0123456789abcdef";
const PROFILE_CREDENTIAL = "ppppppppppppppppppppppppppppppppppppppppppp";
const CONTEXT = Object.freeze({
  season: "r2-campaign-score",
  startedAt: STARTED_AT,
  now: STARTED_AT,
  secret: TEST_SECRET,
  cryptoProvider: webcrypto
});

function createState(runId) {
  const state = createInitialMetaStateV08({ startDepth: 0 }, { ...CONTEXT, runId });
  state.profileId = PROFILE_ID;
  state.playerName = "Campaign Score";
  state.protocolVersion = "ranked-v3-checkpoint-1";
  state.gameVersion = "0.8.1";
  state.expiresAt = STARTED_AT + RUN_TTL_MS;
  return state;
}

function extractedDescent({ runId, maxDepth = 4, earnedGold = 243 }) {
  const state = createState(runId);
  state.status = "active";
  state.depth = maxDepth;
  state.maxDepth = maxDepth;
  state.statistics.roomsCompleted = Math.max(1, maxDepth);
  state.gold = earnedGold;
  state.goldLedger.earnedServerDerived = earnedGold;
  return requestExtractionV08(state, { mode: "normal" }).nextState;
}

function persistedProfileFromExtracted(state, revision = 1) {
  const profile = profileStateFromRunV08(state, PROFILE_ID, revision);
  profile.goldLedger.campEarnedServerDerived =
    profile.goldLedger.campSpentServerDerived + profile.campGold;
  return profile;
}

async function nextDescent(profile, runId) {
  const ruleset = createV08Meta1Ruleset({
    secret: TEST_SECRET,
    cryptoProvider: webcrypto
  });
  const profileInput = structuredClone(profile);
  profileInput.campGold = 0;
  profileInput.goldLedger.campEarnedServerDerived = 0;
  profileInput.goldLedger.campSpentServerDerived = 0;
  const state = await ruleset.createRun({
    startDepth: 0,
    profileState: profileInput,
    playerName: "Campaign Score",
    season: CONTEXT.season
  }, {
    ...CONTEXT,
    runId
  });
  state.playerName = "Campaign Score";
  state.expiresAt = STARTED_AT + RUN_TTL_MS;
  return state;
}

function applyDescentScore(state, { maxDepth, earnedGold, spentGold = 0 }) {
  state.depth = maxDepth;
  state.maxDepth = maxDepth;
  state.goldLedger.earnedServerDerived = earnedGold;
  state.goldLedger.earnedBoundedAttested = 0;
  state.goldLedger.spentServerDerived = spentGold;
  state.gold = earnedGold - spentGold;
  return state;
}

function terminalDefeat(state) {
  state.status = "defeat";
  state.currentRoomDirective = null;
  state.currentRewardEnvelope = null;
  state.pendingOffer = null;
  state.pendingRelicTransaction = null;
  state.pendingInventory = null;
  state.terminalEligibility = {
    outcome: "defeat",
    eligibleRevision: state.revision,
    reason: "campaign_score_test"
  };
  return state;
}

test("campaign score carries 4486 through Extract, Camp, and a new descent to 4992", async () => {
  const first = extractedDescent({ runId: "run_campaign_score_0001" });
  assert.equal(deriveFinalScoreV08(first).score, 4_486);
  const profile = persistedProfileFromExtracted(first);
  const second = applyDescentScore(
    await nextDescent(profile, "run_campaign_score_0002"),
    { maxDepth: 1, earnedGold: 253 }
  );
  const score = deriveFinalScoreV08(second);
  assert.equal(score.score, 4_992);
  assert.deepEqual(score.inputs, {
    acceptedMaxDepth: 4,
    acceptedRunGoldEarned: 496
  });
});

test("a repeated depth never re-awards campaign depth points", async () => {
  const first = extractedDescent({ runId: "run_campaign_score_0003" });
  const profile = persistedProfileFromExtracted(first);
  const repeated = applyDescentScore(
    await nextDescent(profile, "run_campaign_score_0004"),
    { maxDepth: 2, earnedGold: 0 }
  );
  const score = deriveFinalScoreV08(repeated);
  assert.equal(score.score, 4_486);
  assert.equal(score.components.depthPoints, 4_000);
});

test("campaign score accumulates earned gold even after the new descent spends it", async () => {
  const first = extractedDescent({ runId: "run_campaign_score_0005" });
  const profile = persistedProfileFromExtracted(first);
  const spent = applyDescentScore(
    await nextDescent(profile, "run_campaign_score_0006"),
    { maxDepth: 1, earnedGold: 253, spentGold: 253 }
  );
  const score = deriveFinalScoreV08(spent);
  assert.equal(spent.gold, 0);
  assert.equal(score.inputs.acceptedRunGoldEarned, 496);
  assert.equal(score.score, 4_992);
});

function createRegisteredHarness() {
  const repositories = createMemoryRepositories();
  let sequence = 1;
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_LOCAL_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "local",
    repositories,
    now: () => STARTED_AT,
    randomUUID() {
      const suffix = String(sequence).padStart(12, "0");
      sequence += 1;
      return `00000000-0000-4000-8000-${suffix}`;
    }
  });
  async function post(path, body, operationId) {
    const response = await worker.fetch(new Request(`https://score.invalid${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": operationId
      },
      body: JSON.stringify(body)
    }), { RANKED_V3_HMAC_SECRET: TEST_SECRET });
    return { response, payload: await response.json() };
  }
  return { repositories, post };
}

test("Extract retry persists one score carry snapshot and never folds the descent twice", async () => {
  const harness = createRegisteredHarness();
  const started = (await harness.post("/api/v3/runs/start", {
    playerName: "Score Extract",
    season: CONTEXT.season,
    gameVersion: "0.8.1",
    rulesetId: "v08-meta-1",
    rulesetHash: manifest.rulesetHash,
    clientInstallIdHash: "install_0123456789abcdef",
    profileId: PROFILE_ID,
    profileCredential: PROFILE_CREDENTIAL,
    recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"
  }, "score-carry-start")).payload;
  const selected = (await harness.post("/api/v3/runs/event", {
    runId: started.runId,
    type: "select_starting_relic",
    bootstrapToken: started.bootstrapToken,
    offerId: started.metaState.startingRelicOffer.offerId,
    choiceId: started.metaState.startingRelicOffer.publicChoices[0].choiceId
  }, "score-carry-select")).payload;
  const firstDirective = selected.metaState.currentRoomDirective;
  const reportedGoldDelta = selected.metaState.currentRewardEnvelope.fixedAwards.reduce(
    (sum, award) => sum + award.amount,
    0
  );
  const commands = [{ code: "move", count: 2 }, { code: "attack", count: 1 }];
  const checkpointed = (await harness.post("/api/v3/runs/checkpoint", {
    runId: selected.runId,
    checkpointToken: selected.checkpointToken,
    roomDirectiveId: firstDirective.directiveId,
    roomNonce: firstDirective.roomNonce,
    roomResult: "cleared",
    rewardClaims: [],
    integrityVersion: 1,
    integritySignals: [],
    reportedGoldDelta,
    reportedGoldTotal: selected.metaState.gold + reportedGoldDelta,
    turnCount: 3,
    elapsedMs: 1_000,
    commandJournalDigest: await canonicalDigest(commands),
    compactRoomProof: {
      version: 1,
      roomDirectiveId: firstDirective.directiveId,
      roomNonce: firstDirective.roomNonce,
      commands
    }
  }, "score-carry-checkpoint")).payload;
  const directive = checkpointed.metaState.currentRoomDirective;
  const request = {
    runId: checkpointed.runId,
    type: "request_extraction",
    checkpointToken: checkpointed.checkpointToken,
    roomDirectiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
    clientProtocolVersion: "ranked-v3-checkpoint-1",
    payload: { mode: "normal" }
  };
  const first = await harness.post("/api/v3/runs/event", request, "score-carry-extract");
  assert.equal(first.response.status, 200, JSON.stringify(first.payload));
  const profileAfterFirst = harness.repositories.snapshotProfile(PROFILE_ID);
  const expectedEarned =
    profileAfterFirst.state.goldLedger.earnedServerDerived +
    profileAfterFirst.state.goldLedger.earnedBoundedAttested;
  assert.deepEqual(profileAfterFirst.state.campaign.scoreCarry, {
    highWaterDepth: first.payload.metaState.maxDepth,
    earnedGold: expectedEarned
  });
  const retry = await harness.post("/api/v3/runs/event", request, "score-carry-extract");
  assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
  assert.deepEqual(retry.payload, first.payload);
  assert.deepEqual(harness.repositories.snapshotProfile(PROFILE_ID), profileAfterFirst);
  assert.equal(harness.repositories.leaderboardCount(), 1);
  const page = await harness.repositories.leaderboard.list(CONTEXT.season, { limit: 20 });
  assert.equal(page.entries[0].outcome, "extract");
  assert.equal(page.entries[0].snapshotKind, "extract");
});

test("public state, terminal finalization, and leaderboard use the same carried canonical score", async () => {
  const first = extractedDescent({ runId: "run_campaign_score_0007" });
  const profile = persistedProfileFromExtracted(first);
  const second = terminalDefeat(applyDescentScore(
    await nextDescent(profile, "run_campaign_score_0008"),
    { maxDepth: 1, earnedGold: 253, spentGold: 253 }
  ));
  const ruleset = createV08Meta1Ruleset({ secret: TEST_SECRET, cryptoProvider: webcrypto });
  const extractedFinalization = finalizeRunV08(first, { finalizedAt: STARTED_AT + 500 });
  const extractedPublicState = publicRulesetMetaState(extractedFinalization.nextState, ruleset);
  const publicState = publicRulesetMetaState(second, ruleset);
  const result = finalizeRunV08(second, { finalizedAt: STARTED_AT + 1_000 });
  const entry = result.storageEffects.find(
    (effect) => effect.type === "upsert_leaderboard_snapshot"
  ).entry;
  assert.equal(extractedFinalization.response.score, 4_486);
  assert.equal(extractedPublicState.score.score, 4_486);
  assert.equal(result.response.score, 4_992);
  assert.equal(result.nextState.finalization.summary.score, 4_992);
  assert.equal(entry.score, 4_992);
  assert.equal(publicState.score.score, 4_992);
  const builder = await readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");
  assert.match(builder, /publicState\?\.score/u);
});

test("canonical persisted campaign score carry validates independently of JSON key order", () => {
  const persisted = JSON.parse(canonicalJson(createState("run_campaign_score_0010")));
  assert.doesNotThrow(() => assertMetaStateV08(persisted));
});

test("legacy profiles without score carry normalize safely before their next descent", async () => {
  const extracted = extractedDescent({ runId: "run_campaign_score_0009" });
  const legacyProfile = persistedProfileFromExtracted(extracted);
  delete legacyProfile.campaign.scoreCarry;
  const hydrated = await nextDescent(legacyProfile, "run_campaign_score_0010");
  assert.doesNotThrow(() => assertMetaStateV08(hydrated));
  assert.deepEqual(hydrated.campaign.scoreCarry, {
    highWaterDepth: 0,
    earnedGold: 0
  });
});
