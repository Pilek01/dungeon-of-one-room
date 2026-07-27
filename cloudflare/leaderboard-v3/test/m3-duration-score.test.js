import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RUN_TTL_MS } from "../src/config.js";
import {
  buildFinalProjectionsV08,
  deriveFinalDurationV08,
  deriveFinalScoreV08
} from "../src/rulesets/v08-meta-1/index.js";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";

const STARTED_AT = 1_820_000_000_000;
const fixtures = JSON.parse(await readFile(new URL(
  "../src/rulesets/v08-meta-1/test/m3-duration-score-golden-fixtures.json",
  import.meta.url
), "utf8"));

function state() {
  const value = createInitialMetaStateV08(
    { startDepth: 0 },
    {
      runId: "run_0000000000000001",
      season: "m3-season",
      startedAt: STARTED_AT
    }
  );
  return {
    ...value,
    expiresAt: STARTED_AT + RUN_TTL_MS,
    playerName: "M3 Score",
    protocolVersion: "ranked-v3-checkpoint-1",
    gameVersion: "0.8.1"
  };
}

test("M3 duration/score golden corpus has 12 exact active-source cases", () => {
  assert.equal(fixtures.length, 12);
  assert.equal(new Set(fixtures.map((entry) => entry.fixtureId)).size, 12);
});

test("golden score boundaries preserve the exact v0.8 formula", () => {
  for (const fixture of fixtures.filter((entry) => "score" in entry)) {
    const run = state();
    run.maxDepth = fixture.depth;
    run.goldLedger.earnedServerDerived = fixture.gold;
    const projection = deriveFinalScoreV08(run);
    assert.equal(projection.score, fixture.score, fixture.fixtureId);
    assert.equal(projection.inputs.acceptedMaxDepth, fixture.depth);
    assert.equal(projection.inputs.acceptedRunGoldEarned, fixture.gold);
  }
});

test("score uses cumulative earned gold and never subtracts spending", () => {
  const run = state();
  run.maxDepth = 10;
  run.goldLedger.earnedServerDerived = 100;
  run.goldLedger.earnedBoundedAttested = 25;
  run.goldLedger.spentServerDerived = 120;
  run.gold = 5;
  const projection = deriveFinalScoreV08(run);
  assert.equal(projection.inputs.acceptedRunGoldEarned, 125);
  assert.equal(projection.score, 15_250);
});

test("duration is frozen from persisted server timestamps and bounded by run TTL", () => {
  for (const fixture of fixtures.filter((entry) => "elapsed" in entry)) {
    const projection = deriveFinalDurationV08(
      state(),
      STARTED_AT + fixture.elapsed
    );
    assert.equal(projection.durationMs, fixture.elapsed, fixture.fixtureId);
  }
  assert.throws(
    () => deriveFinalDurationV08(state(), STARTED_AT - 1),
    /CLOCK_REGRESSION/u
  );
  assert.throws(
    () => deriveFinalDurationV08(state(), STARTED_AT + RUN_TTL_MS + 1),
    /RUN_EXPIRED/u
  );
});

test("final build and run projections are canonical, immutable and privacy-bounded", () => {
  const run = state();
  run.maxDepth = 25;
  run.goldLedger.earnedServerDerived = 400;
  run.goldLedger.spentServerDerived = 100;
  run.gold = 300;
  run.statistics.roomsCompleted = 25;
  run.statistics.bossRoomsCompleted = 5;
  run.lifeLedger.fatalEvents = 2;
  run.lifeLedger.preventedDeaths = 1;
  run.lifeLedger.lifeLosses = 1;
  run.lives = 4;
  const scoreProjection = deriveFinalScoreV08(run);
  const durationProjection = deriveFinalDurationV08(run, STARTED_AT + 12_345);
  const before = structuredClone(run);
  const projection = buildFinalProjectionsV08(run, {
    outcome: "extract",
    scoreProjection,
    durationProjection
  });
  assert.deepEqual(run, before);
  assert.equal(projection.summary.scoreVersion, "v08-score-1");
  assert.equal(projection.summary.durationPolicyVersion, "server-wall-clock-v1");
  assert.equal(projection.summary.gold.earned, 400);
  assert.equal(projection.summary.gold.finalWallet, 300);
  assert.equal(projection.summary.lives.remaining, 4);
  assert.equal(projection.publicSummary.rulesetHash, run.rulesetHash);
  assert.equal(Object.hasOwn(projection.build, "resources"), false);
  assert.equal(JSON.stringify(projection).includes("recentOps"), false);
  assert.equal(JSON.stringify(projection).includes("clientInstallIdHash"), false);
});

test("negative, non-integer and overflow score inputs fail closed", () => {
  for (const mutate of [
    (run) => { run.maxDepth = -1; },
    (run) => { run.maxDepth = 101; },
    (run) => { run.maxDepth = 1.5; },
    (run) => { run.goldLedger.earnedServerDerived = -1; },
    (run) => { run.goldLedger.earnedBoundedAttested = 0.5; },
    (run) => { run.goldLedger.earnedServerDerived = Number.MAX_SAFE_INTEGER; }
  ]) {
    const run = state();
    mutate(run);
    assert.throws(() => deriveFinalScoreV08(run));
  }
});

test("256-seed score and restart property matrix is exact and deterministic", () => {
  for (let seed = 0; seed < 256; seed += 1) {
    const run = state();
    run.maxDepth = seed % 101;
    run.goldLedger.earnedServerDerived = seed * 17;
    run.goldLedger.earnedBoundedAttested = seed % 13;
    const restarted = JSON.parse(JSON.stringify(run));
    const first = deriveFinalScoreV08(run);
    const second = deriveFinalScoreV08(restarted);
    assert.deepEqual(second, first);
    const expected =
      run.maxDepth * 1000 +
      (seed * 17 + seed % 13) * 2 +
      Math.floor(run.maxDepth / 5) * 2500;
    assert.equal(first.score, expected);
  }
});
