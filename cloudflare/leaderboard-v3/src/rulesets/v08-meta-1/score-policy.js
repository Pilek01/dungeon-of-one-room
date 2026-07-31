import sourceAuditDocument from "./data/m3-finalization-source-audit.generated.json" with { type: "json" };

const policy = sourceAuditDocument.canonicalData.score;
const MAX_DEPTH = sourceAuditDocument.canonicalData.victory.depth;

export const SCORE_VERSION_V08 = policy.version;

export const SCORE_POLICY_SPEC = Object.freeze({
  moduleFile: "score-policy.js",
  authority: "SERVER_DERIVED",
  scoreVersion: SCORE_VERSION_V08,
  legacyFormula: policy.formula,
  inputs: Object.freeze([
    "campaignScoreCarry.highWaterDepth",
    "campaignScoreCarry.earnedGold",
    "acceptedActiveMaxDepth",
    "acceptedActiveRunGoldEarned"
  ]),
  implementationStatus: "r2-campaign-carry"
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

export function normalizeCampaignScoreCarryV08(value) {
  const source = value === undefined ? {} : value;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError("SCORE_CARRY_INVALID");
  }
  const highWaterDepth = nonNegativeSafeInteger(
    source.highWaterDepth ?? 0,
    "SCORE_CARRY_DEPTH_INVALID"
  );
  if (highWaterDepth > MAX_DEPTH) throw new TypeError("SCORE_CARRY_DEPTH_INVALID");
  const earnedGold = nonNegativeSafeInteger(
    source.earnedGold ?? 0,
    "SCORE_CARRY_GOLD_INVALID"
  );
  return { highWaterDepth, earnedGold };
}

export function deriveCampaignScoreInputsV08(state) {
  const recordedActiveMaxDepth = nonNegativeSafeInteger(
    state?.maxDepth,
    "SCORE_DEPTH_INVALID"
  );
  if (recordedActiveMaxDepth > MAX_DEPTH) throw new TypeError("SCORE_DEPTH_INVALID");
  const recordedActiveRunGoldEarned = acceptedRunGoldEarnedV08(state);
  const carry = normalizeCampaignScoreCarryV08(state?.campaign?.scoreCarry);
  const extractedCarryAlreadyIncludesDescent =
    Boolean(state?.extraction) &&
    Object.hasOwn(state?.campaign || {}, "scoreCarry") &&
    (
      state?.status === "extraction" ||
      (state?.status === "finalized" && state?.outcome === "extract")
    );
  const activeMaxDepth = extractedCarryAlreadyIncludesDescent ? 0 : recordedActiveMaxDepth;
  const activeRunGoldEarned = extractedCarryAlreadyIncludesDescent
    ? 0
    : recordedActiveRunGoldEarned;
  const acceptedMaxDepth = Math.max(carry.highWaterDepth, activeMaxDepth);
  const acceptedRunGoldEarned = carry.earnedGold + activeRunGoldEarned;
  if (!Number.isSafeInteger(acceptedRunGoldEarned)) {
    throw new TypeError("SCORE_GOLD_OVERFLOW");
  }
  return {
    acceptedMaxDepth,
    acceptedRunGoldEarned,
    carry,
    active: {
      maxDepth: activeMaxDepth,
      earnedGold: activeRunGoldEarned
    }
  };
}

export function composeCampaignScoreCarryV08(state) {
  const inputs = deriveCampaignScoreInputsV08(state);
  return {
    highWaterDepth: inputs.acceptedMaxDepth,
    earnedGold: inputs.acceptedRunGoldEarned
  };
}

export function deriveFinalScoreV08(state) {
  const inputs = deriveCampaignScoreInputsV08(state);
  const depthPoints = inputs.acceptedMaxDepth * 1000;
  const goldPoints = inputs.acceptedRunGoldEarned * 2;
  const bossMilestonePoints = Math.floor(inputs.acceptedMaxDepth / 5) * 2500;
  const score = Math.round(depthPoints + goldPoints + bossMilestonePoints);
  if (!Number.isSafeInteger(score) || score < 0) {
    throw new TypeError("SCORE_RESULT_OVERFLOW");
  }
  return {
    scoreVersion: SCORE_VERSION_V08,
    score,
    inputs: {
      acceptedMaxDepth: inputs.acceptedMaxDepth,
      acceptedRunGoldEarned: inputs.acceptedRunGoldEarned
    },
    components: {
      depthPoints,
      goldPoints,
      bossMilestonePoints
    }
  };
}
