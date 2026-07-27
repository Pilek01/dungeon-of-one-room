import sourceAuditDocument from "./data/m3-finalization-source-audit.generated.json" with { type: "json" };

const policy = sourceAuditDocument.canonicalData.score;
const MAX_DEPTH = sourceAuditDocument.canonicalData.victory.depth;

export const SCORE_VERSION_V08 = policy.version;

export const SCORE_POLICY_SPEC = Object.freeze({
  moduleFile: "score-policy.js",
  authority: "SERVER_DERIVED",
  scoreVersion: SCORE_VERSION_V08,
  legacyFormula: policy.formula,
  inputs: Object.freeze(["acceptedMaxDepth", "acceptedRunGoldEarned"]),
  implementationStatus: "m3-canonical"
});

function nonNegativeSafeInteger(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(code);
  return value;
}

export function acceptedRunGoldEarnedV08(state) {
  const ledger = state?.goldLedger;
  if (!ledger || typeof ledger !== "object") {
    throw new TypeError("SCORE_GOLD_LEDGER_REQUIRED");
  }
  const serverDerived = nonNegativeSafeInteger(
    ledger.earnedServerDerived,
    "SCORE_SERVER_GOLD_INVALID"
  );
  const boundedAttested = nonNegativeSafeInteger(
    ledger.earnedBoundedAttested,
    "SCORE_ATTESTED_GOLD_INVALID"
  );
  const total = serverDerived + boundedAttested;
  if (!Number.isSafeInteger(total)) throw new TypeError("SCORE_GOLD_OVERFLOW");
  return total;
}

export function deriveFinalScoreV08(state) {
  const depth = nonNegativeSafeInteger(state?.maxDepth, "SCORE_DEPTH_INVALID");
  if (depth > MAX_DEPTH) throw new TypeError("SCORE_DEPTH_INVALID");
  const gold = acceptedRunGoldEarnedV08(state);
  const depthPoints = depth * 1000;
  const goldPoints = gold * 2;
  const bossMilestonePoints = Math.floor(depth / 5) * 2500;
  const score = Math.round(depthPoints + goldPoints + bossMilestonePoints);
  if (!Number.isSafeInteger(score) || score < 0) {
    throw new TypeError("SCORE_RESULT_OVERFLOW");
  }
  return {
    scoreVersion: SCORE_VERSION_V08,
    score,
    inputs: {
      acceptedMaxDepth: depth,
      acceptedRunGoldEarned: gold
    },
    components: {
      depthPoints,
      goldPoints,
      bossMilestonePoints
    }
  };
}
