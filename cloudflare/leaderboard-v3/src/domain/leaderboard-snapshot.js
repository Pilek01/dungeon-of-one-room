const SNAPSHOT_KINDS = new Set(["death", "extract", "final"]);
const ASSISTANCE_CLASSES = new Set(["none", "observer_bot", "cheats", "mixed"]);
const SNAPSHOT_KIND_PRIORITY = Object.freeze({
  death: 0,
  extract: 1,
  final: 2
});

function integer(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(code);
  return value;
}

function text(value, code) {
  const result = String(value || "");
  if (!result) throw new TypeError(code);
  return result;
}

export function compareLeaderboardSnapshots(left, right) {
  for (const field of ["score", "depth", "gold"]) {
    const delta = integer(right[field], `LEADERBOARD_SNAPSHOT_${field.toUpperCase()}_INVALID`) -
      integer(left[field], `LEADERBOARD_SNAPSHOT_${field.toUpperCase()}_INVALID`);
    if (delta !== 0) return delta;
  }
  if (left.runId === right.runId) {
    const leftPriority = SNAPSHOT_KIND_PRIORITY[left.snapshotKind] ?? 0;
    const rightPriority = SNAPSHOT_KIND_PRIORITY[right.snapshotKind] ?? 0;
    if (leftPriority !== rightPriority) return rightPriority - leftPriority;
  }
  const createdDelta =
    integer(left.createdAt, "LEADERBOARD_SNAPSHOT_CREATED_AT_INVALID") -
    integer(right.createdAt, "LEADERBOARD_SNAPSHOT_CREATED_AT_INVALID");
  if (createdDelta !== 0) return createdDelta;
  return text(left.runId, "LEADERBOARD_SNAPSHOT_RUN_ID_INVALID")
    .localeCompare(text(right.runId, "LEADERBOARD_SNAPSHOT_RUN_ID_INVALID"));
}

export function isLeaderboardSnapshotBetter(candidate, current) {
  return !current || compareLeaderboardSnapshots(candidate, current) < 0;
}

export function createLeaderboardSnapshot(input) {
  const snapshotKind = text(input.snapshotKind, "LEADERBOARD_SNAPSHOT_KIND_INVALID");
  const assistanceClass = text(
    input.assistanceClass || "none",
    "LEADERBOARD_ASSISTANCE_CLASS_INVALID"
  );
  if (!SNAPSHOT_KINDS.has(snapshotKind)) {
    throw new TypeError("LEADERBOARD_SNAPSHOT_KIND_INVALID");
  }
  if (!ASSISTANCE_CLASSES.has(assistanceClass)) {
    throw new TypeError("LEADERBOARD_ASSISTANCE_CLASS_INVALID");
  }
  const snapshot = {
    runId: text(input.runId, "LEADERBOARD_SNAPSHOT_RUN_ID_INVALID"),
    profileId: text(input.profileId, "LEADERBOARD_SNAPSHOT_PROFILE_ID_INVALID"),
    season: text(input.season, "LEADERBOARD_SNAPSHOT_SEASON_INVALID"),
    playerName: text(input.playerName, "LEADERBOARD_SNAPSHOT_PLAYER_INVALID"),
    score: integer(input.score, "LEADERBOARD_SNAPSHOT_SCORE_INVALID"),
    depth: integer(input.depth, "LEADERBOARD_SNAPSHOT_DEPTH_INVALID"),
    gold: integer(input.gold, "LEADERBOARD_SNAPSHOT_GOLD_INVALID"),
    durationMs: integer(input.durationMs, "LEADERBOARD_SNAPSHOT_DURATION_INVALID"),
    outcome: text(input.outcome, "LEADERBOARD_SNAPSHOT_OUTCOME_INVALID"),
    snapshotKind,
    assistanceClass,
    build: structuredClone(input.build),
    summary: structuredClone(input.summary),
    verificationLevel: text(
      input.verificationLevel,
      "LEADERBOARD_SNAPSHOT_VERIFICATION_INVALID"
    ),
    createdAt: integer(input.createdAt, "LEADERBOARD_SNAPSHOT_CREATED_AT_INVALID")
  };
  compareLeaderboardSnapshots(snapshot, snapshot);
  return snapshot;
}
