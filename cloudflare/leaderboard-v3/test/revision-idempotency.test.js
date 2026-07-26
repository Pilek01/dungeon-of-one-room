import test from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./fixtures/harness.js";

test("stale token cannot overwrite a newer revision", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  await harness.checkpoint(started);
  const stale = await harness.event(
    started,
    "life_lost",
    {},
    "event-stale-0001"
  );
  assert.equal(stale.response.status, 409);
  assert.equal(stale.payload.error.code, "REVISION_CONFLICT");
});

test("same idempotency key and digest replays the exact checkpoint response", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const first = await harness.checkpoint(started);
  const retry = await harness.checkpoint(started);
  assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
  assert.deepEqual(retry.payload, first.payload);
  assert.equal(harness.repositories.snapshotRun(started.runId).gold, 10);
});

test("same idempotency key with a changed request is rejected", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  await harness.checkpoint(started);
  const conflict = await harness.checkpoint(started, {
    elapsedMs: 12_001
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.payload.error.code, "IDEMPOTENCY_KEY_REUSED");
});

test("conditional update conflict returns REVISION_CONFLICT", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  harness.repositories.runs.updateConditional = async () => false;
  const result = await harness.checkpoint(started);
  assert.equal(result.response.status, 409);
  assert.equal(result.payload.error.code, "REVISION_CONFLICT");
});

test("recent operation ring remains bounded", async () => {
  const harness = createHarness();
  let session = (await harness.start()).payload;
  for (let index = 0; index < 30; index += 1) {
    const result = await harness.event(
      session,
      "extract",
      {},
      `event-ring-${String(index).padStart(4, "0")}`
    );
    assert.equal(result.response.status, 200);
    session = result.payload;
  }
  const recentOps = harness.repositories.snapshotRun(session.runId).recentOps;
  assert.equal(recentOps.version, 2);
  assert.equal(recentOps.records.length, 12);
});

test("retry outside the retained mutation window returns documented revision conflict", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  let session = started;
  for (let index = 0; index < 13; index += 1) {
    session = (await harness.event(
      session,
      "extract",
      {},
      `event-expiry-${String(index).padStart(4, "0")}`
    )).payload;
  }
  const expired = await harness.start({}, "start-fixture-0001");
  assert.equal(expired.response.status, 409);
  assert.equal(expired.payload.error.code, "IDEMPOTENCY_WINDOW_EXPIRED");

  const oldMutation = await harness.event(
    started,
    "extract",
    {},
    "event-expiry-0000"
  );
  assert.equal(oldMutation.response.status, 409);
  assert.equal(oldMutation.payload.error.code, "REVISION_CONFLICT");
});
