import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorker } from "../src/index.js";
import productionWorker from "../src/production-ruleset-entry.js";
import { createRulesetRegistry, RULESET_RELEASE_STATES } from "../src/rulesets/registry.js";
import {
  V08_META_1_LEGACY_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_LOCAL_RELEASE_DESCRIPTOR,
  V08_META_1_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_R2_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_SCORE_CARRY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_HD_BOOT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_BOUNDARY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_WARDEN_HOTFIX_RELEASE_DESCRIPTOR,
  V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR
} from "../src/rulesets/releases.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const EXPECTED_HASH = "sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711";
const BOUNDARY_PREVIOUS_HASH = "sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3";
const HD_BOOT_PREVIOUS_HASH = "sha256:7027a84ff06d6d9304e3d8e4343dbd6b3071c8bec734fad10b85981fa92347e8";
const SCORE_CARRY_PREVIOUS_HASH = "sha256:e4175a6cb29f576a3ad85357a433d6595eb7e9d19a6c5f47ed125ecfe9ae538e";
const WARDEN_HOTFIX_HASH = "sha256:31124ece34ef1c82a28bb977467d169eade8b34c0c13360d7054ab1684e5fe36";
const R2_HASH = "sha256:956251f158e55a0a47f9e43d5680d9aae66a22045c833bd76b8798cdc00e012e";
const PREVIOUS_HASH = "sha256:08dfa4f97d91b4f21dbfae7232246125ddbbc6a0270cf81a9e1ed012e5f5d403";
const LEGACY_HASH = "sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6";

async function rootFile(relative) {
  return readFile(path.join(ROOT, relative), "utf8");
}

test("production entry keeps the deployed v08-meta-1 hash while retaining prior runs", async () => {
  assert.notEqual(manifest.rulesetHash, EXPECTED_HASH);
  assert.equal(V08_META_1_LOCAL_RELEASE_DESCRIPTOR.rulesetHash, manifest.rulesetHash);
  assert.equal(V08_META_1_LOCAL_RELEASE_DESCRIPTOR.status, RULESET_RELEASE_STATES.LOCAL_RELEASE_CANDIDATE);
  assert.equal(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash, EXPECTED_HASH);
  assert.equal(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.status, RULESET_RELEASE_STATES.PRODUCTION_RELEASED);
  const registry = createRulesetRegistry([
    V08_META_1_LEGACY_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_R2_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_WARDEN_HOTFIX_RELEASE_DESCRIPTOR,
    V08_META_1_SCORE_CARRY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_HD_BOOT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_BOUNDARY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR
  ]);
  const resolved = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: EXPECTED_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(resolved.rulesetHash, EXPECTED_HASH);
  const r2 = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: R2_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(r2.rulesetHash, R2_HASH);
  const wardenHotfix = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: WARDEN_HOTFIX_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(wardenHotfix.rulesetHash, WARDEN_HOTFIX_HASH);
  const scoreCarryPrevious = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: SCORE_CARRY_PREVIOUS_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(scoreCarryPrevious.rulesetHash, SCORE_CARRY_PREVIOUS_HASH);
  const hdBootPrevious = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: HD_BOOT_PREVIOUS_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(hdBootPrevious.rulesetHash, HD_BOOT_PREVIOUS_HASH);
  const boundaryPrevious = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: BOUNDARY_PREVIOUS_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(boundaryPrevious.rulesetHash, BOUNDARY_PREVIOUS_HASH);
  const previous = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: PREVIOUS_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(previous.rulesetHash, PREVIOUS_HASH);
  const legacy = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: LEGACY_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(legacy.rulesetHash, LEGACY_HASH);

  const response = await productionWorker.fetch(new Request(
    "https://production.invalid/api/v3/availability?clientProtocolVersion=ranked-v3-checkpoint-1"
  ), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.rulesetHash, EXPECTED_HASH);
});

test("production availability reports the activated ruleset", async () => {
  const response = await productionWorker.fetch(new Request(
    "https://production.invalid/api/v3/availability?clientProtocolVersion=ranked-v3-checkpoint-1"
  ), {});
  const body = await response.json();
  assert.equal(body.availability, "active");
  assert.equal(body.productionActivated, true);
  assert.equal(body.rulesetId, "v08-meta-1");
  assert.equal(body.rulesetHash, EXPECTED_HASH);
});

test("production registry starts and abandons the retained R2 ruleset hash", async () => {
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([
      V08_META_1_R2_PRODUCTION_RELEASE_DESCRIPTOR,
      V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR
    ]),
    rulesetEnvironment: "production",
    repositories: createMemoryRepositories()
  });
  const recoveryCredential = "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr";
  const startResponse = await worker.fetch(new Request(
    "https://production.invalid/api/v3/runs/start",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "retained-r2-start"
      },
      body: JSON.stringify({
        playerName: "Retained R2",
        season: "season-1",
        gameVersion: "0.8.1",
        rulesetId: "v08-meta-1",
        rulesetHash: R2_HASH,
        clientInstallIdHash: "install_retained_r2_123456",
        profileId: "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
        recoveryCredential,
        clientProtocolVersion: "ranked-v3-checkpoint-1"
      })
    }
  ), {
    RANKED_V3_HMAC_SECRET: TEST_SECRET,
    RANKED_V3_ABUSE_CONTROL: {
      async limit() {
        return { success: true };
      }
    }
  });
  const started = await startResponse.json();
  assert.equal(startResponse.status, 201, JSON.stringify(started));
  assert.equal(started.metaState.rulesetHash, R2_HASH);

  const selectResponse = await worker.fetch(new Request(
    "https://production.invalid/api/v3/runs/event",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "retained-r2-select"
      },
      body: JSON.stringify({
        runId: started.runId,
        type: "select_starting_relic",
        bootstrapToken: started.bootstrapToken,
        offerId: started.metaState.startingRelicOffer.offerId,
        choiceId: started.metaState.startingRelicOffer.publicChoices[0].choiceId
      })
    }
  ), { RANKED_V3_HMAC_SECRET: TEST_SECRET });
  const selected = await selectResponse.json();
  assert.equal(selectResponse.status, 200, JSON.stringify(selected));
  assert.equal(selected.metaState.status, "active");
  assert.equal(selected.metaState.rulesetHash, R2_HASH);
  const operationId = "op_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const abandonResponse = await worker.fetch(new Request(
    "https://production.invalid/api/v3/runs/abandon",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": operationId
      },
      body: JSON.stringify({
        operationId,
        runId: selected.runId,
        recoveryCredential,
        clientProtocolVersion: "ranked-v3-checkpoint-1",
        lastKnownRevision: selected.metaState.revision
      })
    }
  ), { RANKED_V3_HMAC_SECRET: TEST_SECRET });
  const abandoned = await abandonResponse.json();
  assert.equal(abandonResponse.status, 200, JSON.stringify(abandoned));
  assert.equal(abandoned.metaState.status, "abandoned");
  assert.equal(abandoned.metaState.rulesetHash, R2_HASH);
});

test("production Ranked start uses the edge limiter with a profile-scoped key", async () => {
  const calls = [];
  const metrics = [];
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "production",
    repositories: createMemoryRepositories(),
    metrics: { increment: (...entry) => metrics.push(entry) }
  });
  const profileId = "profile_cccccccccccccccccccccccccccccccc";
  const response = await worker.fetch(new Request("https://production.invalid/api/v3/runs/start", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": "production-rate-limit"
    },
    body: JSON.stringify({
      playerName: "Private Tester",
      season: "season-1",
      gameVersion: "v0.8.0",
      rulesetId: "v08-meta-1",
      rulesetHash: EXPECTED_HASH,
      clientInstallIdHash: "install_production_123456789",
      profileId,
      profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
      recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
      clientProtocolVersion: "ranked-v3-checkpoint-1"
    })
  }), {
    RANKED_V3_HMAC_SECRET: TEST_SECRET,
    RANKED_V3_ABUSE_CONTROL: {
      async limit(input) {
        calls.push(input);
        return { success: false };
      }
    }
  });
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "START_RATE_LIMITED");
  assert.deepEqual(calls, [{ key: `ranked-start:${profileId}` }]);
  assert.ok(metrics.some((entry) => entry[0] === "rejected_starts" && entry[2] === "edge_rate_limit"));
});

test("Pages release stays same-origin and disconnects all v2 bindings", async () => {
  const [pages, proxy, builder, config, game, ui, runtime, leaderboardUi, style, workerConfig] = await Promise.all([
    rootFile("wrangler.jsonc"),
    rootFile("functions/api/v3/[[path]].js"),
    rootFile("scripts/build-pages-v3.mjs"),
    rootFile("config.js"),
    rootFile("game.js"),
    rootFile("online-v3/ranked-v3-ui.js"),
    rootFile("online-v3/ranked-v3-runtime.js"),
    rootFile("online-v3/ranked-v3-leaderboard-ui.js"),
    rootFile("style.css"),
    rootFile("cloudflare/leaderboard-v3/wrangler.production.toml")
  ]);
  const pagesConfig = JSON.parse(pages);
  assert.deepEqual(pagesConfig.services, [{
    binding: "RANKED_V3_BACKEND",
    service: "dungeon-online-v3-production"
  }]);
  assert.equal("preview" in pagesConfig.env, false);
  assert.match(pages, /"binding": "RANKED_V3_BACKEND"/u);
  assert.match(pages, /"service": "dungeon-online-v3-production"/u);
  assert.doesNotMatch(pages, /RANKED_BACKEND|ranked-v2|ranked-s1/iu);
  assert.match(proxy, /context\.env\.RANKED_V3_BACKEND/u);
  assert.match(builder, /include: \["\/api\/v3\/\*"\]/u);
  assert.match(builder, /\["assets", "render", "online-v3"\]/u);
  assert.doesNotMatch(builder, /Vault-Guardian-Codex-Pack/u);
  assert.match(builder, /title: "Practice \(Offline\)"/u);
  assert.match(builder, /DungeonOnlineV3Menu\?\.extendOptions/u);
  assert.match(builder, /bootInputLocked/u);
  assert.match(builder, /data-menu-index/u);
  assert.match(builder, /Preparing the dungeon/u);
  assert.match(
    builder,
    /state\.onlineV3Directive = state\.onlineV3NextDirective;[\s\S]*?buildRoom\(\);[\s\S]*?DungeonOnlineV3\?\.onRoomEntered\?\.\(state\.onlineV3Directive\)/u
  );
  assert.match(config, /DUNGEON_ONLINE_V3_API = ""/u);
  assert.match(game, /title: "Start New Game"/u);
  assert.doesNotMatch(game, /DungeonOnlineV3Menu|bootInputLocked|data-menu-index/u);
  assert.match(ui, /"Ranked \(Online\)"/u);
  assert.match(ui, /relicDetails/u);
  assert.match(ui, /relic-draft-choice-starting/u);
  assert.match(ui, /stopPropagation/u);
  assert.match(ui, /playerText/u);
  assert.match(runtime, /title: "Ranked \(Online\)"/u);
  assert.match(runtime, /title: "Ranked Leaderboard"/u);
  assert.match(runtime, /"Build Chronicle"/u);
  assert.match(leaderboardUi, /ranked-v3-reference-plate--leaderboard/u);
  assert.match(leaderboardUi, /ranked-v3-reference-plate--inspect/u);
  assert.match(leaderboardUi, /ranked-v3-reference-plate-art/u);
  assert.match(leaderboardUi, /data-record-tooltip/u);
  assert.doesNotMatch(leaderboardUi, /floor-skull\.png/u);
  assert.match(runtime, /await resolveCheckpoint\(\);/u);
  assert.doesNotMatch(runtime, /Resolve checkpoint|server-issued opaque choice/u);
  assert.doesNotMatch(runtime, /ui\.(?:showMessage|showChoices)\("Ranked (?:run finalized|Camp)"|ui\.button\("(?:Open Camp|Finalize)"|`Ranked \$\{state\.status\}`/u);
  assert.match(runtime, /enterRankedCamp/u);
  assert.match(runtime, /onCampAction/u);
  assert.match(builder, /enterRankedCamp/u);
  assert.match(builder, /onCampAction/u);
  assert.match(runtime, /roomClearPending: Boolean\(pendingRoomSummary\)/u);
  assert.match(runtime, /lostRelicId/u);
  assert.match(
    builder,
    /resumeAfterFatal\(directive, publicState, presentation = \{\}\)[\s\S]*?state\.phase = "dead"[\s\S]*?playDeathTrack\(\)/u
  );
  assert.match(builder, /rankedFatalDirective/u);
  assert.match(builder, /if \(state\.onlineV3Ranked\)[\s\S]*?leaveToMainMenu/u);
  assert.match(builder, /DungeonOnlineV3\?\.onRoomEntered\?\.\(state\.onlineV3Directive\)/u);
  assert.match(style, /\.ranked-v3-entry,[\s\S]*display: none !important;/u);
  assert.match(style, /body\.ranked-v3-modal-open #screenOverlay/u);
  assert.match(style, /\[data-record-tooltip\]:focus-visible::after/u);
  assert.doesNotMatch(style, /#32204c|#9b70d8/u);
  assert.match(builder, /\.boot-screen\.loading \.boot-loading/u);
  assert.match(builder, /hdBootLoadingProgress/u);
  assert.match(workerConfig, /workers_dev = false/u);
  assert.match(workerConfig, /name = "RANKED_V3_ABUSE_CONTROL"/u);
  assert.match(workerConfig, /crons = \["\*\/15 \* \* \* \*"\]/u);
  assert.match(workerConfig, /database_name = "dungeon-online-v3-production"/u);
});
test("production menu separates Practice pause, Practice save, and Ranked save choices", async () => {
  const [builder, runtime] = await Promise.all([
    rootFile("scripts/build-pages-v3.mjs"),
    rootFile("online-v3/ranked-v3-runtime.js")
  ]);
  assert.match(builder, /isRunPauseMenuActive\(\)[\s\S]*title: "Main Menu"/u);
  assert.match(builder, /title: "Main Menu"[\s\S]*enterMenu\(\);/u);
  assert.match(builder, /DungeonOnlineV3GameBridge\?\.isRanked\?\.\(\)/u);
  assert.match(builder, /rankedPause[\s\S]*leaveToMainMenu/u);
  assert.match(
    builder,
    /if \(state\.onlineV3Ranked\)[\s\S]*?DungeonOnlineV3\?\.leaveToMainMenu\?\.\(\);[\s\S]*?return;/u
  );
  assert.match(
    builder,
    /holdTerminal\(publicState\)[\s\S]*?finalGameOverPrompt = \{[\s\S]*?playFinalGameOverTrack\(\)/u
  );
  assert.match(
    builder,
    /holdTerminal\(publicState\)[\s\S]*?state\.phase = publicState\?\.status === "victory" \? "won" : "dead";[\s\S]*?syncBgmWithState\(\);[\s\S]*?playFinalGameOverTrack\(\)/u
  );
  assert.match(builder, /data-menu-new-game-index[\s\S]*activateMenuNewGameConfirmSelection/u);
  assert.doesNotMatch(runtime, /options\.get\("continue"\),/u);
  assert.match(runtime, /Start New Ranked/u);
  assert.match(runtime, /Continue Ranked/u);
  assert.match(runtime, /recoveryStore\.loadRecovery\(\)/u);
  assert.match(
    runtime,
    /session\.getState\(\) === root\.DungeonRankedV3Session\.STATES\.finalized[\s\S]*?clearEndedRecovery\(\)/u
  );
});
