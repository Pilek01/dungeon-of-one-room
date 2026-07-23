import test from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./fixtures/harness.js";

test("POST /api/v3/runs/start creates one authoritative run", async () => {
  const harness = createHarness();
  const result = await harness.start();
  assert.equal(result.response.status, 201);
  assert.equal(result.payload.ok, true);
  assert.match(result.payload.runId, /^run_[a-f0-9]+$/u);
  assert.equal(result.payload.revision, 0);
  assert.equal(result.payload.metaState.gold, 0);
  assert.equal(result.payload.metaState.depth, 0);
  assert.equal(result.payload.metaState.roomDirective.depth, 1);
  assert.equal(harness.repositories.metrics.writes, 1);
  assert.equal(harness.repositories.metrics.reads, 0);
});

test("start retry returns the exact original response", async () => {
  const harness = createHarness();
  const first = await harness.start();
  const retry = await harness.start();
  assert.equal(retry.response.status, 201);
  assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
  assert.deepEqual(retry.payload, first.payload);
});

test("start rejects reused idempotency key with different payload", async () => {
  const harness = createHarness();
  await harness.start();
  const conflict = await harness.start({ playerName: "OtherPlayer" });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.payload.error.code, "IDEMPOTENCY_KEY_REUSED");

  const seasonConflict = await harness.start({ season: "other-season" });
  assert.equal(seasonConflict.response.status, 409);
  assert.equal(seasonConflict.payload.error.code, "IDEMPOTENCY_KEY_REUSED");
});

test("start fails closed without a ruleset or token secret", async () => {
  const noRuleset = createHarness({ ruleset: null });
  const rulesetResult = await noRuleset.start();
  assert.equal(rulesetResult.response.status, 503);
  assert.equal(rulesetResult.payload.error.code, "RULESET_UNAVAILABLE");

  const noSecret = createHarness({ secret: "" });
  const secretResult = await noSecret.start();
  assert.equal(secretResult.response.status, 503);
  assert.equal(secretResult.payload.error.code, "TOKEN_SECRET_UNAVAILABLE");
});
