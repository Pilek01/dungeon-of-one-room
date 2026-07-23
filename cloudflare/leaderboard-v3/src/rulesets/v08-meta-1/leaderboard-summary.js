export const LEADERBOARD_SUMMARY_SPEC = Object.freeze({
  authority: "SERVER_DERIVED",
  verificationLevel: "checkpoint_verified_v3",
  publicFields: Object.freeze([
    "runId",
    "playerName",
    "score",
    "depth",
    "gold",
    "durationMs",
    "outcome",
    "verificationLevel",
    "createdAt",
    "publicBuild",
    "publicSummary"
  ]),
  implementationStatus: "not-implemented"
});
