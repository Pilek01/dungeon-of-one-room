export const LIFE_POLICY_SPEC = Object.freeze({
  moduleFile: "life-policy.js",
  authority: Object.freeze({
    maximumLives: "SERVER_DERIVED",
    lifeLostReport: "HEURISTIC_ONLY",
    issuedLifePurchase: "SERVER_DERIVED",
    localDeathPrevention: "HEURISTIC_ONLY"
  }),
  implementationStatus: "not-implemented"
});
