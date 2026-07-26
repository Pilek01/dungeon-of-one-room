import test from "node:test";
import assert from "node:assert/strict";
import {
  appendCompactRecentOperation,
  createCompactOperationRecord,
  createRecentOperationsV2,
  recentOperationsByteLength,
  resolveCompactIdempotentReplay
} from "../src/domain/idempotency.js";

function response(revision, overrides = {}) {
  return {
    ok: true,
    acceptedBoundary: revision === 0 ? "run_started" : "room_cleared",
    runId: "run_compact",
    revision,
    checkpointToken: `token-${revision}-${"s".repeat(96)}`,
    metaState: {
      runId: "run_compact",
      rulesetId: "v08-meta-1",
      rulesetHash: `sha256:${"a".repeat(64)}`,
      revision,
      gold: revision * 10,
      build: {
        relics: revision > 1 ? [{ id: "ember", stacks: 1 }] : [],
        relicSlotsUsed: revision > 1 ? 1 : 0
      },
      pendingOffer: overrides.pendingOffer ?? null
    },
    ...overrides.responseFields
  };
}

async function record(revision, overrides = {}) {
  const responseBody = response(revision, overrides);
  return createCompactOperationRecord({
    operationId: overrides.operationId || `operation-${revision}`,
    operationType: overrides.operationType || (revision ? "checkpoint" : "start"),
    requestDigest: overrides.requestDigest || `request-digest-${revision}`,
    responseKind: overrides.responseKind || (revision ? "checkpoint" : "start"),
    runId: "run_compact",
    rulesetId: "v08-meta-1",
    rulesetHash: `sha256:${"a".repeat(64)}`,
    revisionBefore: Math.max(0, revision - 1),
    revisionAfter: revision,
    responseStatus: revision ? 200 : 201,
    responseBody,
    stateDigest: `state-digest-${revision}`,
    createdAt: 1_800_000_000_000 + revision
  });
}

test("v2 exact retry reconstructs historical semantic response", async () => {
  let store = createRecentOperationsV2();
  const original = [];
  for (let revision = 0; revision < 4; revision += 1) {
    const operation = await record(revision);
    original.push(response(revision));
    store = appendCompactRecentOperation(store, operation, 12);
  }
  for (let revision = 0; revision < 4; revision += 1) {
    const replay = await resolveCompactIdempotentReplay(
      store,
      `operation-${revision}`,
      `request-digest-${revision}`
    );
    assert.equal(replay.kind, "replay");
    assert.deepEqual(replay.responseBody, original[revision]);
    assert.equal(replay.resultingRevision, revision);
  }
});

test("v2 conflicting retry is rejected before reconstruction", async () => {
  const store = appendCompactRecentOperation(
    createRecentOperationsV2(),
    await record(0),
    12
  );
  assert.deepEqual(
    await resolveCompactIdempotentReplay(store, "operation-0", "different"),
    { kind: "conflict" }
  );
});

test("historical retry never uses the newest public projection", async () => {
  let store = createRecentOperationsV2();
  store = appendCompactRecentOperation(store, await record(0), 12);
  store = appendCompactRecentOperation(store, await record(1), 12);
  store = appendCompactRecentOperation(store, await record(2), 12);
  const replay = await resolveCompactIdempotentReplay(
    store,
    "operation-1",
    "request-digest-1"
  );
  assert.equal(replay.responseBody.metaState.revision, 1);
  assert.equal(replay.responseBody.metaState.gold, 10);
  assert.deepEqual(replay.responseBody.metaState.build.relics, []);
});

test("ring promotion preserves retries inside a 12-operation window", async () => {
  let store = createRecentOperationsV2();
  for (let revision = 0; revision < 20; revision += 1) {
    store = appendCompactRecentOperation(store, await record(revision), 12);
  }
  assert.equal(store.records.length, 12);
  assert.equal(store.records[0].projection.kind, "snapshot");
  assert.equal(
    (await resolveCompactIdempotentReplay(
      store,
      "operation-8",
      "request-digest-8"
    )).kind,
    "replay"
  );
  assert.equal(
    (await resolveCompactIdempotentReplay(
      store,
      "operation-7",
      "request-digest-7"
    )).kind,
    "miss"
  );
});

test("large replacement projection is stored once instead of per response", async () => {
  const largeOffer = {
    transactionId: "replacement-large",
    choices: Array.from({ length: 8 }, (_, index) => ({
      choiceId: `choice-${index}`,
      relicId: `relic-${index}`,
      publicBuild: {
        relics: Array.from({ length: 10 }, (__, relicIndex) => ({
          id: `relic-${relicIndex}-${"x".repeat(90)}`,
          stacks: 1
        }))
      }
    }))
  };
  const fullResponses = [];
  let store = createRecentOperationsV2();
  for (let revision = 0; revision < 12; revision += 1) {
    const operationResponse = response(revision, { pendingOffer: largeOffer });
    fullResponses.push({
      idempotencyKey: `operation-${revision}`,
      requestDigest: `request-digest-${revision}`,
      responseBody: operationResponse
    });
    store = appendCompactRecentOperation(
      store,
      await record(revision, { pendingOffer: largeOffer }),
      12
    );
  }
  const legacyBytes = new TextEncoder().encode(JSON.stringify(fullResponses)).byteLength;
  assert(recentOperationsByteLength(store) < legacyBytes * 0.4);
  const replay = await resolveCompactIdempotentReplay(
    store,
    "operation-11",
    "request-digest-11"
  );
  assert.deepEqual(replay.responseBody, response(11, { pendingOffer: largeOffer }));
});

test("result digest detects corrupted immutable reconstruction data", async () => {
  const store = appendCompactRecentOperation(
    createRecentOperationsV2(),
    await record(0),
    12
  );
  store.records[0].projection.value.gold = 999;
  await assert.rejects(
    resolveCompactIdempotentReplay(store, "operation-0", "request-digest-0"),
    /RECENT_OPS_RESULT_DIGEST_MISMATCH/u
  );
});

test("unknown compact format and patch kinds fail closed", async () => {
  await assert.rejects(
    resolveCompactIdempotentReplay(
      { version: 99, publicProjectionVersion: 1, records: [] },
      "operation",
      "digest"
    ),
    /RECENT_OPS_FORMAT_UNSUPPORTED/u
  );
  const store = appendCompactRecentOperation(
    createRecentOperationsV2(),
    await record(0),
    12
  );
  store.records[0].projection.kind = "latest-state";
  await assert.rejects(
    resolveCompactIdempotentReplay(store, "operation-0", "request-digest-0"),
    /RECENT_OPS_RECORD_INVALID:projection/u
  );
});
