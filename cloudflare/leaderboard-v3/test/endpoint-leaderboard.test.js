import test from "node:test";
import assert from "node:assert/strict";
import { createHarness, TEST_SEASON } from "./fixtures/harness.js";

test("GET /api/v3/leaderboard returns compact entries", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  await harness.finalize(started);
  const result = await harness.call(
    "GET",
    `/api/v3/leaderboard?season=${TEST_SEASON}&limit=20`
  );
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.entries.length, 1);
  assert.equal(result.payload.entries[0].verificationLevel, "checkpoint_verified_v3");
  assert.equal("build" in result.payload.entries[0], false);
  assert.equal("canonicalState" in result.payload.entries[0], false);
});

test("GET /api/v3/leaderboard/:runId returns public build details only", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  await harness.finalize(started);
  const result = await harness.call(
    "GET",
    `/api/v3/leaderboard/${started.runId}`
  );
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.payload.entry.build.relics, []);
  assert.deepEqual(result.payload.entry.build.mutators, []);
  assert.deepEqual(result.payload.entry.build.skillTiers, {
    dash: 0,
    aoe: 0,
    shield: 0
  });
  assert.equal(result.payload.entry.verificationLevel, "checkpoint_verified_v3");
  assert.equal("canonical_state_json" in result.payload.entry, false);
  assert.equal("recentOps" in result.payload.entry, false);
});
