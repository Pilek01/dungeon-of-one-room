import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { createWorker } from "../src/index.js";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import { V08_META_1_LOCAL_RELEASE_DESCRIPTOR } from "../src/rulesets/releases.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const require = createRequire(import.meta.url);
const clientApi = require("../../../online-v3/ranked-v3-client.js");
const protocol = require("../../../online-v3/ranked-v3-protocol.js");

function recoveryStore() {
  let session = { runId: "run_a1", revision: 0 };
  let recovery = {
    runId: "run_a1",
    recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"
  };
  return {
    loadSession: () => structuredClone(session),
    saveSession: (value) => { session = structuredClone(value); },
    clearSession: () => { session = null; },
    loadRecovery: () => structuredClone(recovery),
    saveRecovery: (value) => { recovery = structuredClone(value); },
    clearRecovery: () => { recovery = null; },
    snapshot: () => ({ session, recovery })
  };
}

test("canonical abandon is authenticated, exactly retryable and never publishes", async () => {
  const repositories = createMemoryRepositories();
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_LOCAL_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "local",
    repositories,
    now: () => 1_920_000_000_000,
    randomUUID: () => "00000000-0000-4000-8000-000000000001"
  });
  const env = { RANKED_V3_HMAC_SECRET: TEST_SECRET };
  const credential = "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr";

  async function post(path, body, operationId) {
    const response = await worker.fetch(new Request(`https://abandon.invalid${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": operationId
      },
      body: JSON.stringify(body)
    }), env);
    return { response, payload: await response.json() };
  }

  const started = (await post("/api/v3/runs/start", {
    playerName: "Abandon",
    season: "r2-local",
    gameVersion: "0.8.1",
    rulesetId: "v08-meta-1",
    rulesetHash: manifest.rulesetHash,
    clientInstallIdHash: "install_abandon_123456",
    profileId: "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
    recoveryCredential: credential
  }, "abandon-start")).payload;
  const operationId = "op_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const body = {
    operationId,
    runId: started.runId,
    recoveryCredential: credential,
    clientProtocolVersion: "ranked-v3-checkpoint-1",
    lastKnownRevision: 0
  };
  const first = await post("/api/v3/runs/abandon", body, operationId);
  const replay = await post("/api/v3/runs/abandon", body, operationId);
  assert.equal(first.response.status, 200);
  assert.equal(first.payload.metaState.status, "abandoned");
  assert.deepEqual(replay.payload, first.payload);
  assert.equal(replay.response.headers.get("x-idempotent-replay"), "1");
  assert.equal(repositories.snapshotRun(started.runId).status, "abandoned");
  assert.equal(repositories.leaderboardCount(), 0);

  const resumed = await post(
    "/api/v3/runs/resume",
    { ...body, operationId: "op_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    "op_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  );
  assert.equal(resumed.response.status, 410);
});

test("client clears recovery only after acknowledged abandonment", async () => {
  const store = recoveryStore();
  let resolveRequest;
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "op_cccccccccccccccccccccccccccccccc",
      request: () => new Promise((resolve) => { resolveRequest = resolve; })
    }
  });
  const pending = client.abandonCanonical();
  assert.ok(store.snapshot().session);
  assert.ok(store.snapshot().recovery);
  resolveRequest({
    payload: {
      ok: true,
      protocolVersion: protocol.PROTOCOL_VERSION,
      runId: "run_a1",
      revision: 1,
      metaState: {
        runId: "run_a1",
        protocolVersion: protocol.PROTOCOL_VERSION,
        rulesetId: protocol.RULESET_ID,
        rulesetHash: protocol.RULESET_HASH,
        revision: 1,
        status: "abandoned"
      }
    }
  });
  await pending;
  assert.equal(store.snapshot().session, null);
  assert.equal(store.snapshot().recovery, null);
});

test("runtime preserves recovery for Practice exit and resyncs canonical state", async () => {
  const runtime = await readFile(new URL(
    "../../../online-v3/ranked-v3-runtime.js",
    import.meta.url
  ), "utf8");
  assert.doesNotMatch(runtime, /const recoveryAtBoot = recoveryStore\.loadSession/u);
  assert.match(runtime, /Return to Practice[\s\S]*returnToPractice/u);
  assert.match(runtime, /Abandon Ranked Run[\s\S]*confirmAbandon/u);
  assert.match(runtime, /resumeCanonical\(\)/u);
  assert.match(runtime, /client\?\.clear\(\)[\s\S]*ABANDONED_LOCAL_SESSION/u);
});
