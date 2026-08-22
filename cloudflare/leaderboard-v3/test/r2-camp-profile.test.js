import test from "node:test";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import { V08_META_1_LOCAL_RELEASE_DESCRIPTOR } from "../src/rulesets/releases.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";
import { canonicalDigest } from "../src/security/digests.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const require = createRequire(import.meta.url);
const sessionApi = require("../../../online-v3/ranked-v3-session.js");

const PROFILE_ID = "profile_0123456789abcdef0123456789abcdef";
const PROFILE_CREDENTIAL = "ppppppppppppppppppppppppppppppppppppppppppp";

function createHarness() {
  const repositories = createMemoryRepositories();
  let sequence = 1;
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_LOCAL_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "local",
    repositories,
    now: () => 1_900_000_000_000,
    randomUUID() {
      const suffix = String(sequence).padStart(12, "0");
      sequence += 1;
      return `00000000-0000-4000-8000-${suffix}`;
    }
  });
  const env = { RANKED_V3_HMAC_SECRET: TEST_SECRET };

  async function post(path, body, operationId) {
    const response = await worker.fetch(new Request(`https://r2.invalid${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": operationId
      },
      body: JSON.stringify(body)
    }), env);
    return { response, payload: await response.json() };
  }

  function profileBody(extra = {}) {
    return {
      profileId: PROFILE_ID,
      profileCredential: PROFILE_CREDENTIAL,
      rulesetId: "v08-meta-1",
      rulesetHash: manifest.rulesetHash,
      clientProtocolVersion: "ranked-v3-checkpoint-1",
      ...extra
    };
  }

  async function start(operationId, extra = {}) {
    return post("/api/v3/runs/start", {
      playerName: "R2 Camp",
      season: "r2-local",
      gameVersion: "0.8.1",
      rulesetId: "v08-meta-1",
      rulesetHash: manifest.rulesetHash,
      clientInstallIdHash: "install_0123456789abcdef",
      profileId: PROFILE_ID,
      profileCredential: PROFILE_CREDENTIAL,
      recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
      ...extra
    }, operationId);
  }

  return { post, profileBody, start, repositories };
}

test("fresh Ranked ignores a valid legacy Practice import", async () => {
  const harness = createHarness();
  const first = await harness.start("r2-mutator-import-first", {
    newCampaign: true,
    practiceMutatorImport: {
      metrics: { totalKills: 200 },
      historicalUnlockedMutatorIds: ["resilience"]
    }
  });
  assert.equal(first.response.status, 201);
  assert.deepEqual(first.payload.profile.mutatorProgress.unlockedMutatorIds, []);
  assert.deepEqual(first.payload.profile.runModifiers.active, []);
  assert.equal(first.payload.profile.mutatorProgress.totalKills, 0);
  assert.equal(first.payload.profile.mutatorProgress.eliteKills, 0);
  assert.equal(first.payload.profile.mutatorProgress.depthHighscore, 0);
  assert.equal(first.payload.profile.mutatorProgress.totalGoldEarned, 0);
  assert.equal(first.payload.profile.mutatorProgress.totalMerchantPots, 0);
  assert.equal(first.payload.profile.mutatorProgress.shieldUsesThisGame, 0);
  assert.equal(first.payload.profile.mutatorProgress.potionFreeExtract, 0);
  assert.equal(first.payload.profile.mutatorProgress.importConsumed, false);
  assert.ok(first.payload.bootstrapToken);
});

test("continuing Ranked ignores a valid legacy Practice import without mutating the profile", async () => {
  const harness = createHarness();
  const first = await harness.start("r2-mutator-import-base");
  assert.equal(first.response.status, 201);
  const before = harness.repositories.snapshotProfile(PROFILE_ID);

  const second = await harness.start("r2-mutator-import-continue", {
    newCampaign: false,
    practiceMutatorImport: {
      metrics: { totalKills: 200, totalGoldEarned: 50_000 },
      historicalUnlockedMutatorIds: ["greed", "resilience"]
    }
  });
  assert.equal(second.response.status, 201);
  assert.deepEqual(harness.repositories.snapshotProfile(PROFILE_ID), before);
  assert.deepEqual(second.payload.profile.mutatorProgress, first.payload.profile.mutatorProgress);
});

test("ordinary Ranked room cannot open Camp", async () => {
  const harness = createHarness();
  const started = (await harness.start("r2-camp-start-ordinary")).payload;
  const selected = (await harness.post("/api/v3/runs/event", {
    runId: started.runId,
    type: "select_starting_relic",
    bootstrapToken: started.bootstrapToken,
    offerId: started.metaState.startingRelicOffer.offerId,
    choiceId: started.metaState.startingRelicOffer.publicChoices[0].choiceId
  }, "r2-camp-select-ordinary")).payload;
  const directive = selected.metaState.currentRoomDirective;
  const rejected = await harness.post("/api/v3/runs/event", {
    runId: selected.runId,
    type: "begin_camp_session",
    checkpointToken: selected.checkpointToken,
    roomDirectiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
    payload: {}
  }, "r2-camp-illegal-ordinary");
  assert.equal(rejected.response.status, 409);
  assert.equal(rejected.payload.error.code, "CAMP_EXTRACTION_REQUIRED");
});

test("canonical extraction creates an authenticated profile Camp and next run", async () => {
  const harness = createHarness();
  const started = (await harness.start("r2-camp-start-extract")).payload;
  const selected = (await harness.post("/api/v3/runs/event", {
    runId: started.runId,
    type: "select_starting_relic",
    bootstrapToken: started.bootstrapToken,
    offerId: started.metaState.startingRelicOffer.offerId,
    choiceId: started.metaState.startingRelicOffer.publicChoices[0].choiceId
  }, "r2-camp-select-extract")).payload;
  const directive = selected.metaState.currentRoomDirective;
  const reportedGoldDelta = selected.metaState.currentRewardEnvelope.fixedAwards.reduce(
    (sum, award) => sum + award.amount,
    0
  );
  const commands = [{ code: "move", count: 2 }, { code: "attack", count: 1 }];
  const checkpointed = (await harness.post("/api/v3/runs/checkpoint", {
    runId: selected.runId,
    checkpointToken: selected.checkpointToken,
    roomDirectiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
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
      roomDirectiveId: directive.directiveId,
      roomNonce: directive.roomNonce,
      commands
    }
  }, "r2-camp-checkpoint")).payload;
  assert.ok(checkpointed.metaState.gold > 0);
  const nextDirective = checkpointed.metaState.currentRoomDirective;
  const extracted = (await harness.post("/api/v3/runs/event", {
    runId: checkpointed.runId,
    type: "request_extraction",
    checkpointToken: checkpointed.checkpointToken,
    roomDirectiveId: nextDirective.directiveId,
    roomNonce: nextDirective.roomNonce,
    payload: { mode: "normal" }
  }, "r2-camp-extract")).payload;
  assert.equal(extracted.metaState.status, "extraction");
  assert.ok(extracted.metaState.campGold > 0);
  const storedExtractionProfile = harness.repositories.snapshotProfile(PROFILE_ID).state;
  assert.equal(
    storedExtractionProfile.goldLedger.campEarnedServerDerived,
    storedExtractionProfile.campGold
  );
  assert.equal(extracted.profile.profileId, PROFILE_ID);

  const beforeFinalize = await harness.post(
    "/api/v3/profiles/camp",
    harness.profileBody({ action: "open" }),
    "r2-camp-open-too-early"
  );
  assert.equal(beforeFinalize.response.status, 409);
  assert.equal(beforeFinalize.payload.error.code, "CAMP_FINALIZATION_REQUIRED");

  const finalized = await harness.post("/api/v3/runs/finalize", {
    runId: extracted.runId,
    checkpointToken: extracted.checkpointToken
  }, "r2-camp-finalize");
  assert.equal(finalized.response.status, 200);
  assert.equal(harness.repositories.leaderboardCount(), 1);

  const wrongCredential = await harness.post(
    "/api/v3/profiles/camp",
    harness.profileBody({
      profileCredential: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      action: "open"
    }),
    "r2-camp-wrong-credential"
  );
  assert.equal(wrongCredential.response.status, 401);

  const unfundedProfile = await harness.repositories.profiles.get(PROFILE_ID);
  const fundedProfile = structuredClone(unfundedProfile);
  fundedProfile.state.campGold = 1_000;
  fundedProfile.state.goldLedger.campEarnedServerDerived = 1_000;
  fundedProfile.state.build.elixirs = [{ elixirId: "unknown_elixir", charges: 0 }];
  assert.equal(
    await harness.repositories.profiles.updateConditional(
      fundedProfile,
      unfundedProfile.revision
    ),
    true
  );

  const unknownExhaustedElixir = await harness.post(
    "/api/v3/profiles/camp",
    harness.profileBody({ action: "open" }),
    "r2-camp-open-unknown-exhausted-elixir"
  );
  assert.equal(unknownExhaustedElixir.response.status, 422);
  assert.equal(
    unknownExhaustedElixir.payload.error.code,
    "CAMP_ELIXIR_LOADOUT_INVALID"
  );

  const invalidProfile = await harness.repositories.profiles.get(PROFILE_ID);
  const exhaustedProfile = structuredClone(invalidProfile);
  exhaustedProfile.state.build.elixirs = [{ elixirId: "fury_1", charges: 0 }];
  assert.equal(
    await harness.repositories.profiles.updateConditional(
      exhaustedProfile,
      invalidProfile.revision
    ),
    true
  );

  const opened = await harness.post(
    "/api/v3/profiles/camp",
    harness.profileBody({ action: "open" }),
    "r2-camp-open"
  );
  assert.equal(opened.response.status, 200);
  assert.equal(opened.payload.profile.profileId, PROFILE_ID);
  assert.equal(opened.payload.profile.campSession.active, true);
  assert.deepEqual(opened.payload.profile.build.elixirs, []);
  assert.deepEqual(
    harness.repositories.snapshotProfile(PROFILE_ID).state.build.elixirs,
    []
  );
  const reopenedAfterLostResponse = await harness.post(
    "/api/v3/profiles/camp",
    harness.profileBody({ action: "open" }),
    "r2-camp-reopen-after-lost-response"
  );
  assert.equal(
    reopenedAfterLostResponse.response.status,
    200,
    JSON.stringify(reopenedAfterLostResponse.payload)
  );
  assert.equal(reopenedAfterLostResponse.payload.revision, opened.payload.revision);
  assert.deepEqual(
    reopenedAfterLostResponse.payload.metaTransactionOffer,
    opened.payload.metaTransactionOffer
  );
  const upgrade = opened.payload.metaTransactionOffer.choices.find(
    (choice) => choice.action === "upgrade" && choice.upgradeId === "vitality"
  );
  assert.ok(upgrade);
  const committed = await harness.post(
    "/api/v3/profiles/camp",
    harness.profileBody({
      action: "commit",
      transactionId: upgrade.transactionId,
      choiceId: upgrade.choiceId
    }),
    "r2-camp-commit-upgrade"
  );
  assert.equal(committed.response.status, 200, JSON.stringify(committed.payload));
  assert.equal(committed.payload.profile.build.campUpgrades.vitality, 1);
  const refreshed = await harness.post(
    "/api/v3/profiles/camp",
    harness.profileBody({ action: "open" }),
    "r2-camp-refresh-after-upgrade"
  );
  assert.equal(refreshed.response.status, 200);
  assert.equal(refreshed.payload.profile.build.campUpgrades.vitality, 1);
  assert.ok(refreshed.payload.metaTransactionOffer);

  const currentProfile = await harness.repositories.profiles.get(PROFILE_ID);
  const legacyProfile = structuredClone(currentProfile);
  legacyProfile.state.goldLedger.campEarnedServerDerived = 0;
  legacyProfile.state.goldLedger.campSpentServerDerived = 0;
  legacyProfile.state.build.relics = [];
  legacyProfile.state.build.relicSlotBonus = 0;
  legacyProfile.state.build.relicSlotLimit = legacyProfile.state.build.relicSlotBase;
  legacyProfile.state.build.relicSlotsUsed = 0;
  legacyProfile.state.build.uniqueRelicCount = 0;
  legacyProfile.state.build.totalRelicStacks = 0;
  assert.equal(
    await harness.repositories.profiles.updateConditional(
      legacyProfile,
      currentProfile.revision
    ),
    true
  );

  const nextRun = await harness.start("r2-camp-next-run");
  assert.equal(nextRun.response.status, 201, JSON.stringify(nextRun.payload));
  assert.equal(nextRun.payload.metaState.profileId, PROFILE_ID);
  assert.equal(nextRun.payload.metaState.status, "active");
  assert.equal(nextRun.payload.metaState.build.relics.length, 0);
  assert.equal(nextRun.payload.metaState.startingRelicOffer, null);
  assert.equal(
    harness.repositories.snapshotProfile(PROFILE_ID).state.lastExtractedRunId,
    extracted.runId
  );
});
test("profile-backed start may enter the first room without a new relic bootstrap", () => {
  const session = sessionApi.createStateMachine();
  session.transition(sessionApi.STATES.starting);
  session.transition(sessionApi.STATES.entering);
  session.transition(sessionApi.STATES.active);
  assert.equal(session.getState(), sessionApi.STATES.active);
});
