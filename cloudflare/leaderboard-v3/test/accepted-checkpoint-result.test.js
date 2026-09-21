import test from "node:test";
import assert from "node:assert/strict";
import { applyAcceptedCheckpointResult } from "../src/domain/accepted-checkpoint-result.js";

test("later unranked telemetry cannot overwrite an already frozen checkpoint decision", () => {
  for (const status of ["preserved", "withheld", "unavailable"]) {
    const result = status === "preserved"
      ? { status, revision: 4, depth: 3, score: 3000, gold: 0 }
      : { status };
    const previous = { runId: "run_frozen", rankEligibility: "provisional", rankedCheckpointResult: result };
    const next = { ...structuredClone(previous),
      rankIntegrity: { reasonCodes: ["REPORTED_GOLD_TOTAL_MISMATCH", "BOUNDARY_SETTLEMENT_INVALID"] } };
    const effects = applyAcceptedCheckpointResult(previous, next, {});
    assert.deepEqual(next.rankedCheckpointResult, result);
    assert.equal(effects.leaderboardSnapshot, null);
    assert.equal(effects.leaderboardDeleteRunId, null);
  }
});

test("unknown reasons at first downgrade cannot publish a previously accepted checkpoint", () => {
  const previous = { runId: "run_unknown", rankEligibility: "official",
    lastAcceptedCheckpoint: { revision: 2, entry: { depth: 1, score: 1000, gold: 0 } } };
  const next = { ...structuredClone(previous), rankEligibility: "provisional",
    rankIntegrity: { reasonCodes: ["UNKNOWN_INTEGRITY_REASON"] } };
  const effects = applyAcceptedCheckpointResult(previous, next, {});
  assert.equal(next.rankedCheckpointResult.status, "withheld");
  assert.equal(effects.leaderboardSnapshot, null);
  assert.equal(effects.leaderboardDeleteRunId, previous.runId);
});
