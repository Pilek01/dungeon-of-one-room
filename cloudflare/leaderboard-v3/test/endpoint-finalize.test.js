import test from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./fixtures/harness.js";

test("POST /api/v3/runs/finalize computes authoritative score and writes once", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const checkpointed = (await harness.checkpoint(started)).payload;
  const finalized = await harness.finalize(checkpointed, "defeat", undefined, {
    score: 999_999,
    gold: 99_999,
    depth: 99
  });
  assert.equal(finalized.response.status, 200);
  assert.equal(finalized.payload.score, 200);
  assert.equal(finalized.payload.verificationLevel, "checkpoint_verified_v3");
  assert.equal(finalized.payload.metaState.status, "finalized");
  assert.equal(harness.repositories.leaderboardCount(), 1);
});

test("duplicate finalize returns the original response and no second row", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const first = await harness.finalize(started);
  const retry = await harness.finalize(started);
  assert.equal(retry.response.status, 200);
  assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
  assert.deepEqual(retry.payload, first.payload);
  assert.equal(harness.repositories.leaderboardCount(), 1);
});

test("extract finalize requires an accepted extract event", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const rejected = await harness.finalize(started, "extract");
  assert.equal(rejected.response.status, 422);
  assert.equal(rejected.payload.error.code, "FINALIZE_OUTCOME_INVALID");

  const extracted = (await harness.event(
    started,
    "extract",
    {},
    "event-extract-0001"
  )).payload;
  const finalized = await harness.finalize(
    extracted,
    "extract",
    "finalize-extract-0001"
  );
  assert.equal(finalized.response.status, 200);
  assert.equal(finalized.payload.outcome, "extract");
  assert.equal("leaderboardEntryId" in finalized.payload, false);
  assert.equal(harness.repositories.leaderboardCount(), 0);
});
