const REQUIRED_RULESET_METHODS = Object.freeze([
  "createInitialMetaState",
  "issueRoomDirective",
  "resolveCheckpointRewards",
  "validateMetaEvent",
  "computeFinalScore",
  "buildLeaderboardSummary"
]);

export function assertRulesetV3(ruleset, requestedHash = "") {
  if (!ruleset || typeof ruleset !== "object") {
    throw new TypeError("RULESET_UNAVAILABLE");
  }
  if (typeof ruleset.rulesetHash !== "string" || !ruleset.rulesetHash) {
    throw new TypeError("RULESET_HASH_MISSING");
  }
  if (requestedHash && ruleset.rulesetHash !== requestedHash) {
    throw new TypeError("RULESET_HASH_MISMATCH");
  }
  for (const method of REQUIRED_RULESET_METHODS) {
    if (typeof ruleset[method] !== "function") {
      throw new TypeError(`RULESET_METHOD_MISSING:${method}`);
    }
  }
  return ruleset;
}

export { REQUIRED_RULESET_METHODS };
