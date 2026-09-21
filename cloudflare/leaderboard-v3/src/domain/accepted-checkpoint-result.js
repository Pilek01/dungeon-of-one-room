import { isOfficialRankEligible } from "./rank-eligibility.js";

// Only signals scoped to the current room may preserve an earlier result.
// Unknown or missing integrity evidence fails closed.
const CURRENT_ROOM_REASONS = new Set([
  "REPORTED_GOLD_DELTA_MISMATCH",
  "REPORTED_GOLD_TOTAL_MISMATCH",
  "local_room_completion_capability_invalid"
]);

export function applyAcceptedCheckpointResult(previous, next, ruleset, options = {}) {
  if (isOfficialRankEligible(next)) {
    if (options.operationType === "checkpoint" && next.rankIntegrity?.version === 1) {
      next.lastAcceptedCheckpoint = {
        revision: next.revision,
        entry: ruleset.createLeaderboardSnapshot(next, {
          snapshotKind: "checkpoint",
          outcome: "checkpoint",
          createdAt: options.now
        })
      };
    } else if (options.operationType === "event" && options.leaderboardSnapshot) {
      next.lastAcceptedCheckpoint = {
        revision: next.revision,
        entry: structuredClone(options.leaderboardSnapshot)
      };
    }
    return {};
  }

  // Once the Ranked prefix is closed, later unranked telemetry is unrelated
  // to its acceptance. A retrospective moderation decision needs separate evidence.
  if (previous.rankedCheckpointResult) {
    next.rankedCheckpointResult = structuredClone(previous.rankedCheckpointResult);
    return { leaderboardSnapshot: null, leaderboardDeleteRunId: null };
  }

  const reasons = next.rankIntegrity?.reasonCodes || [];
  const safe = reasons.length > 0 && reasons.every((reason) => CURRENT_ROOM_REASONS.has(reason));
  if (!safe) {
    next.rankedCheckpointResult = { status: "withheld" };
    return { leaderboardDeleteRunId: next.runId, leaderboardSnapshot: null };
  }
  const checkpoint = previous.lastAcceptedCheckpoint;
  if (!checkpoint || !isOfficialRankEligible(previous)) {
    next.rankedCheckpointResult = { status: "unavailable" };
    return { leaderboardDeleteRunId: next.runId, leaderboardSnapshot: null };
  }
  const entry = structuredClone(checkpoint.entry);
  next.rankedCheckpointResult = {
    status: "preserved",
    revision: checkpoint.revision,
    depth: entry.depth,
    score: entry.score,
    gold: entry.gold
  };
  return { leaderboardSnapshot: entry, leaderboardDeleteRunId: null };
}
