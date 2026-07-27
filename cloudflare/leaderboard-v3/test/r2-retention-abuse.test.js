import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createWorker, R2_METRIC_NAMES } from "../src/index.js";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import { V08_META_1_LOCAL_RELEASE_DESCRIPTOR } from "../src/rulesets/releases.js";
import { createRecentOperationsV2 } from "../src/domain/idempotency.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

function minimalRun(runId, status, expiresAt) {
  return {
    runId,
    status,
    revision: 0,
    rulesetHash: manifest.rulesetHash,
    expiresAt
  };
}

test("scheduled cleanup deletes only expired non-finalized runs", async () => {
  const repositories = createMemoryRepositories();
  const metadata = {
    stateDigest: "digest",
    recentOps: createRecentOperationsV2(),
    startIdempotencyKey: "cleanup-key-a",
    startRequestDigest: "request-a"
  };
  await repositories.runs.insert(minimalRun("run_a1", "active", 99), metadata);
  await repositories.runs.insert(minimalRun("run_b1", "abandoned", 99), {
    ...metadata,
    startIdempotencyKey: "cleanup-key-b"
  });
  await repositories.runs.insert(minimalRun("run_c1", "finalized", 99), {
    ...metadata,
    startIdempotencyKey: "cleanup-key-c"
  });
  await repositories.runs.insert(minimalRun("run_d1", "active", 101), {
    ...metadata,
    startIdempotencyKey: "cleanup-key-d"
  });
  const metrics = [];
  const worker = createWorker({
    repositories,
    now: () => 100,
    metrics: {
      increment: (...entry) => metrics.push(entry)
    }
  });
  const result = await worker.scheduled({}, {});
  assert.equal(result.deleted, 2);
  assert.equal(repositories.snapshotRun("run_a1"), null);
  assert.equal(repositories.snapshotRun("run_b1"), null);
  assert.equal(repositories.snapshotRun("run_c1").status, "finalized");
  assert.equal(repositories.snapshotRun("run_d1").status, "active");
  assert.deepEqual(metrics.at(-1), ["cleanup_deleted", 2, "scheduled"]);
});

test("authenticated profile active-run cap rejects the third live run", async () => {
  const repositories = createMemoryRepositories();
  let sequence = 1;
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_LOCAL_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "local",
    repositories,
    now: () => 1_930_000_000_000,
    randomUUID() {
      const suffix = String(sequence).padStart(12, "0");
      sequence += 1;
      return `00000000-0000-4000-8000-${suffix}`;
    }
  });
  const env = { RANKED_V3_HMAC_SECRET: TEST_SECRET };
  async function start(index) {
    const response = await worker.fetch(new Request("https://cap.invalid/api/v3/runs/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": `active-cap-${index}`
      },
      body: JSON.stringify({
        playerName: "Cap",
        season: "r2-local",
        gameVersion: "0.8.1",
        rulesetId: "v08-meta-1",
        rulesetHash: manifest.rulesetHash,
        clientInstallIdHash: "install_cap_123456789",
        profileId: "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
        recoveryCredential: String(index).repeat(43)
      })
    }), env);
    return { response, payload: await response.json() };
  }
  assert.equal((await start(1)).response.status, 201);
  assert.equal((await start(2)).response.status, 201);
  const rejected = await start(3);
  assert.equal(rejected.response.status, 429);
  assert.equal(rejected.payload.error.code, "ACTIVE_RUN_LIMIT");
});

test("production start is gated by configured abuse control and metrics are secret-free", async () => {
  const repositories = createMemoryRepositories();
  const metrics = [];
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_LOCAL_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "production",
    repositories,
    metrics: { increment: (...entry) => metrics.push(entry) }
  });
  const response = await worker.fetch(new Request("https://gate.invalid/api/v3/runs/start", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": "production-gate"
    },
    body: JSON.stringify({
      playerName: "Gate",
      season: "r2-local",
      gameVersion: "0.8.1",
      rulesetId: "v08-meta-1",
      rulesetHash: manifest.rulesetHash,
      clientInstallIdHash: "install_gate_123456789",
      profileId: "profile_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
      recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"
    })
  }), { RANKED_V3_HMAC_SECRET: TEST_SECRET });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "ABUSE_CONTROL_REQUIRED");
  assert.equal(metrics.some((entry) => /credential|token|rrrr|pppp/iu.test(JSON.stringify(entry))), false);
  assert.deepEqual(R2_METRIC_NAMES, [
    "run_starts",
    "rejected_starts",
    "active_runs",
    "cleanup_deleted",
    "resume_success",
    "resume_failure",
    "invalid_recovery_credentials",
    "stale_conflicts",
    "finalizations",
    "leaderboard_reads",
    "d1_write_failures"
  ]);

  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /new Map\(\).*rate|moduleGlobal.*rate/iu);
});
