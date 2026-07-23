export const SCORE_POLICY_SPEC = Object.freeze({
  moduleFile: "score-policy.js",
  authority: "SERVER_DERIVED",
  legacyFormula: "depth*1000 + gold*2 + floor(depth/5)*2500",
  inputs: Object.freeze(["acceptedMaxDepth", "acceptedRunGold"]),
  implementationStatus: "not-implemented"
});
