import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHarness, TEST_SEASON } from "./fixtures/harness.js";

test("logical D1 budget stays bounded per endpoint", async () => {
  const harness = createHarness();

  const started = (await harness.start()).payload;
  assert.deepEqual(
    {
      reads: harness.repositories.metrics.reads,
      writes: harness.repositories.metrics.writes,
      batches: harness.repositories.metrics.batches
    },
    { reads: 0, writes: 1, batches: 0 }
  );

  harness.repositories.resetMetrics();
  const checkpointed = (await harness.checkpoint(started)).payload;
  assert.deepEqual(
    {
      reads: harness.repositories.metrics.reads,
      writes: harness.repositories.metrics.writes,
      batches: harness.repositories.metrics.batches
    },
    { reads: 1, writes: 1, batches: 0 }
  );

  harness.repositories.resetMetrics();
  const evented = (await harness.event(
    checkpointed,
    "life_lost",
    {},
    "event-budget-0001"
  )).payload;
  assert.deepEqual(
    {
      reads: harness.repositories.metrics.reads,
      writes: harness.repositories.metrics.writes,
      batches: harness.repositories.metrics.batches
    },
    { reads: 1, writes: 1, batches: 0 }
  );

  harness.repositories.resetMetrics();
  await harness.finalize(evented);
  assert.deepEqual(
    {
      reads: harness.repositories.metrics.reads,
      writes: harness.repositories.metrics.writes,
      batches: harness.repositories.metrics.batches
    },
    { reads: 1, writes: 2, batches: 1 }
  );

  harness.repositories.resetMetrics();
  await harness.call("GET", `/api/v3/leaderboard?season=${TEST_SEASON}&limit=20`);
  assert.deepEqual(
    {
      reads: harness.repositories.metrics.reads,
      writes: harness.repositories.metrics.writes,
      batches: harness.repositories.metrics.batches
    },
    { reads: 1, writes: 0, batches: 0 }
  );
});

test("canonical state and recent ops do not contain a combat replay", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const checkpointed = (await harness.checkpoint(started)).payload;
  const stored = harness.repositories.snapshotRun(checkpointed.runId);
  assert.equal("commands" in stored, false);
  assert.equal("combatReplay" in stored, false);
  assert(stored.recentOps.length <= 24);
  assert(stored.journalDigest);
});

test("D1 mutations use optimistic concurrency and finalize gates its insert", async () => {
  const [runSource, leaderboardSource] = await Promise.all([
    readFile(new URL("../src/storage/d1-runs.js", import.meta.url), "utf8"),
    readFile(new URL("../src/storage/d1-leaderboard.js", import.meta.url), "utf8")
  ]);
  assert.match(
    runSource,
    /WHERE run_id = \? AND revision = \? AND status = 'active'/u
  );
  assert.match(runSource, /db\.batch\(\[update, insert\]\)/u);
  assert.match(leaderboardSource, /WHERE changes\(\) = 1/u);
});
