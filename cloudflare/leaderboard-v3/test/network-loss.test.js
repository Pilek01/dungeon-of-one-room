import test from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./fixtures/harness.js";

test("checkpoint retry after a lost response returns the stored response", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;

  const responseThatClientLost = await harness.checkpoint(started);
  const retry = await harness.checkpoint(started);

  assert.equal(retry.response.status, 200);
  assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
  assert.deepEqual(retry.payload, responseThatClientLost.payload);
  assert.equal(harness.repositories.snapshotRun(started.runId).gold, 10);
});

test("retry after timeout before execution performs the operation once", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const firstActualAttempt = await harness.checkpoint(
    started,
    {},
    "checkpoint-after-timeout-0001"
  );
  assert.equal(firstActualAttempt.response.status, 200);
  assert.equal(firstActualAttempt.response.headers.get("x-idempotent-replay"), null);
  assert.equal(harness.repositories.snapshotRun(started.runId).revision, 1);
});

test("lost finalize response can be retried without a second leaderboard row", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;

  const responseThatClientLost = await harness.finalize(started);
  const retry = await harness.finalize(started);

  assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
  assert.deepEqual(retry.payload, responseThatClientLost.payload);
  assert.equal(harness.repositories.leaderboardCount(), 1);
});

test("exact retry remains available after the original token expires", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const original = await harness.finalize(started);
  harness.advanceTime(16 * 60 * 1000);
  const retry = await harness.finalize(started);
  assert.equal(retry.response.status, 200);
  assert.deepEqual(retry.payload, original.payload);
  assert.equal(harness.repositories.leaderboardCount(), 1);
});
