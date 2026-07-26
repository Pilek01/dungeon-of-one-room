import test from "node:test";
import assert from "node:assert/strict";
import {
  appendVersionedRecentOperation,
  createCompactOperationRecord,
  migrateLegacyRecentOperations,
  resolveIdempotentReplay
} from "../src/domain/idempotency.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";

const RULESET_HASH = `sha256:${"b".repeat(64)}`;

function response(revision) {
  return {
    ok: true,
    acceptedBoundary: revision === 0 ? "run_started" : "room_cleared",
    runId: "run_storage",
    revision,
    checkpointToken: `legacy-token-${revision}`,
    metaState: {
      runId: "run_storage",
      rulesetHash: RULESET_HASH,
      revision,
      gold: revision * 5
    }
  };
}

function legacyOperation(revision) {
  return {
    idempotencyKey: `legacy-${revision}`,
    requestDigest: `legacy-digest-${revision}`,
    responseStatus: revision === 0 ? 201 : 200,
    responseBody: response(revision),
    resultingRevision: revision,
    createdAt: 1_800_000_000_000 + revision
  };
}

async function compactRecord(revision) {
  return createCompactOperationRecord({
    operationId: `compact-${revision}`,
    operationType: "event",
    requestDigest: `compact-digest-${revision}`,
    responseKind: "extract",
    runId: "run_storage",
    rulesetId: "fixture",
    rulesetHash: RULESET_HASH,
    revisionBefore: revision - 1,
    revisionAfter: revision,
    responseStatus: 200,
    responseBody: response(revision),
    stateDigest: `state-${revision}`,
    createdAt: 1_800_000_000_000 + revision
  });
}

test("legacy v1 full-response records remain read-only replay compatible", async () => {
  const legacy = [legacyOperation(0), legacyOperation(1)];
  const replay = await resolveIdempotentReplay(
    legacy,
    "legacy-0",
    "legacy-digest-0"
  );
  assert.equal(replay.kind, "replay");
  assert.deepEqual(replay.responseBody, response(0));
  assert.deepEqual(
    await resolveIdempotentReplay(legacy, "legacy-0", "changed"),
    { kind: "conflict" }
  );
});

test("legacy v1 history migrates deterministically to v2 on the next write", async () => {
  const legacy = [legacyOperation(0), legacyOperation(1)];
  const first = await appendVersionedRecentOperation(
    legacy,
    await compactRecord(2),
    12
  );
  const second = await appendVersionedRecentOperation(
    structuredClone(legacy),
    await compactRecord(2),
    12
  );
  assert.deepEqual(first, second);
  assert.equal(first.version, 2);
  assert.equal(first.records.length, 3);
  assert.deepEqual(
    (await resolveIdempotentReplay(first, "legacy-0", "legacy-digest-0")).responseBody,
    response(0)
  );
  assert.deepEqual(
    (await resolveIdempotentReplay(first, "compact-2", "compact-digest-2")).responseBody,
    response(2)
  );
});

test("legacy migration respects the selected retained window", async () => {
  const legacy = Array.from({ length: 20 }, (_, revision) => legacyOperation(revision));
  const compact = await migrateLegacyRecentOperations(legacy, 12);
  assert.equal(compact.records.length, 12);
  assert.equal(
    (await resolveIdempotentReplay(compact, "legacy-7", "legacy-digest-7")).kind,
    "miss"
  );
  assert.equal(
    (await resolveIdempotentReplay(compact, "legacy-8", "legacy-digest-8")).kind,
    "replay"
  );
});

test("versioned operation history survives repository serialization and restart clone", async () => {
  const repositories = createMemoryRepositories();
  const recentOps = await migrateLegacyRecentOperations(
    [legacyOperation(0)],
    12
  );
  const state = {
    runId: "run_storage",
    revision: 0,
    status: "active"
  };
  await repositories.runs.insert(state, {
    stateDigest: "state-0",
    recentOps,
    startIdempotencyKey: "legacy-0",
    startRequestDigest: "legacy-digest-0"
  });
  const restored = await repositories.runs.get("run_storage");
  assert.deepEqual(restored.recentOps, recentOps);
  assert.deepEqual(
    (await resolveIdempotentReplay(
      restored.recentOps,
      "legacy-0",
      "legacy-digest-0"
    )).responseBody,
    response(0)
  );
});

test("concurrent conditional persistence has one winner and no split history", async () => {
  const repositories = createMemoryRepositories();
  const initialOps = await migrateLegacyRecentOperations([legacyOperation(0)], 12);
  await repositories.runs.insert({
    runId: "run_storage",
    revision: 0,
    status: "active"
  }, {
    stateDigest: "state-0",
    recentOps: initialOps,
    startIdempotencyKey: "legacy-0",
    startRequestDigest: "legacy-digest-0"
  });
  const nextOps = await appendVersionedRecentOperation(
    initialOps,
    await compactRecord(1),
    12
  );
  const results = await Promise.all([
    repositories.runs.updateConditional({
      runId: "run_storage",
      revision: 1,
      status: "active"
    }, 0, { stateDigest: "state-1", recentOps: nextOps }),
    repositories.runs.updateConditional({
      runId: "run_storage",
      revision: 1,
      status: "active"
    }, 0, { stateDigest: "state-conflict", recentOps: initialOps })
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  const stored = repositories.snapshotRun("run_storage");
  assert.equal(stored.revision, 1);
  assert.equal(stored.stateDigest, "state-1");
  assert.deepEqual(stored.recentOps, nextOps);
});
