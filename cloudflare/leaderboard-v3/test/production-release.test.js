import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorker } from "../src/index.js";
import productionWorker from "../src/production-ruleset-entry.js";
import { createRulesetRegistry, RULESET_RELEASE_STATES } from "../src/rulesets/registry.js";
import { V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR } from "../src/rulesets/releases.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const EXPECTED_HASH = "sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6";

async function rootFile(relative) {
  return readFile(path.join(ROOT, relative), "utf8");
}

test("production entry activates only the exact tested v08-meta-1 hash", async () => {
  assert.equal(manifest.rulesetHash, EXPECTED_HASH);
  assert.equal(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.status, RULESET_RELEASE_STATES.PRODUCTION_RELEASED);
  const registry = createRulesetRegistry([V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR]);
  const resolved = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: EXPECTED_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(resolved.rulesetHash, EXPECTED_HASH);

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
  const [pages, proxy, builder, config, game, ui, runtime, style, workerConfig] = await Promise.all([
    rootFile("wrangler.jsonc"),
    rootFile("functions/api/v3/[[path]].js"),
    rootFile("scripts/build-pages-v3.mjs"),
    rootFile("config.js"),
    rootFile("game.js"),
    rootFile("online-v3/ranked-v3-ui.js"),
    rootFile("online-v3/ranked-v3-runtime.js"),
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
  assert.match(runtime, /await resolveCheckpoint\(\);/u);
  assert.doesNotMatch(runtime, /Resolve checkpoint|server-issued opaque choice/u);
  assert.match(style, /\.ranked-v3-entry,[\s\S]*display: none !important;/u);
  assert.match(style, /body\.ranked-v3-modal-open #screenOverlay/u);
  assert.doesNotMatch(style, /#32204c|#9b70d8/u);
  assert.match(builder, /\.boot-screen\.loading \.boot-loading/u);
  assert.match(builder, /hdBootLoadingProgress/u);
  assert.match(workerConfig, /workers_dev = false/u);
  assert.match(workerConfig, /name = "RANKED_V3_ABUSE_CONTROL"/u);
  assert.match(workerConfig, /crons = \["\*\/15 \* \* \* \*"\]/u);
  assert.match(workerConfig, /database_name = "dungeon-online-v3-production"/u);
});
