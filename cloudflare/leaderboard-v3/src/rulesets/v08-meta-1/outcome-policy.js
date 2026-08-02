import sourceAuditDocument from "./data/m3-finalization-source-audit.generated.json" with { type: "json" };
import { composeCampaignScoreCarryV08 } from "./score-policy.js";
import { applyMutatorProgressDeltaV08 } from "./mutator-progression.js";

const extractionPolicy = sourceAuditDocument.canonicalData.extraction;

export const OUTCOME_POLICY_VERSION = "v08-outcome-1";
export const TERMINAL_ELIGIBLE_STATUSES = Object.freeze([
  "victory",
  "defeat",
  "extraction"
]);

function exactExtractionRequest(request) {
  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request) ||
    Object.keys(request).sort().join(",") !== "mode" ||
    !["normal", "emergency"].includes(request.mode)
  ) {
    throw new TypeError("EXTRACTION_REQUEST_INVALID");
  }
  return request;
}

function campUpgradeLevel(state, id) {
  const level = Number(state.build?.campUpgrades?.[id] || 0);
  if (!Number.isSafeInteger(level) || level < 0) {
    throw new TypeError("EXTRACTION_CAMP_UPGRADE_INVALID");
  }
  return level;
}

function clearTransientBoundary(state) {
  state.currentRoomDirective = null;
  state.currentRewardEnvelope = null;
  state.pendingOffer = null;
  state.pendingRelicTransaction = null;
  state.pendingInventory = null;
  state.campSession = null;
}

export function assertTerminalEligibilityV08(state) {
  if (!TERMINAL_ELIGIBLE_STATUSES.includes(state.status)) {
    throw new TypeError("RUN_NOT_TERMINAL_ELIGIBLE");
  }
  if (
    !state.terminalEligibility ||
    state.terminalEligibility.outcome !== state.status ||
    state.terminalEligibility.eligibleRevision !== state.revision
  ) {
    throw new TypeError("TERMINAL_ELIGIBILITY_INVALID");
  }
  if (
    state.currentRoomDirective ||
    state.currentRewardEnvelope ||
    state.pendingOffer ||
    state.pendingRelicTransaction ||
    state.pendingInventory
  ) {
    throw new TypeError("TERMINAL_STATE_HAS_BLOCKING_WORK");
  }
  return state.terminalEligibility;
}

export function requestExtractionV08(state, request) {
  exactExtractionRequest(request);
  if (state.status !== "active") throw new TypeError("RUN_NOT_ACTIVE");
  if (
    request.mode === "normal" &&
    Math.max(0, Number(state.statistics?.roomsCompleted) || 0) < 1
  ) {
    throw new TypeError("NORMAL_EXTRACTION_REQUIRES_ACCEPTED_ROOM_CLEAR");
  }
  const next = structuredClone(state);
  const walletBefore = next.gold;
  let lossRatio = 0;
  if (request.mode === "emergency") {
    lossRatio = Math.min(
      extractionPolicy.maximumLossRatio,
      Math.max(
        extractionPolicy.minimumLossRatio,
        extractionPolicy.emergencyBaseLossRatio -
          campUpgradeLevel(next, "emergency_stash") *
            extractionPolicy.emergencyStashReductionPerLevel
      )
    );
    next.gold = Math.max(0, Math.floor(walletBefore * (1 - lossRatio)));
  }
  const campGoldAwarded = Math.max(0, Math.round(next.gold));
  if (
    request.mode === "normal" &&
    next.depth >= 10 &&
    next.mutatorRunTracking.potionUses === 0
  ) {
    next.mutatorProgress = applyMutatorProgressDeltaV08(next.mutatorProgress, {
      potionFreeExtract: next.mutatorProgress.potionFreeExtract + 1
    });
  }
  next.campGold += campGoldAwarded;
  next.campaign = {
    ...next.campaign,
    scoreCarry: composeCampaignScoreCarryV08(next)
  };
  clearTransientBoundary(next);
  next.status = "extraction";
  next.extraction = {
    policyVersion: OUTCOME_POLICY_VERSION,
    mode: request.mode,
    walletBefore,
    walletAfter: next.gold,
    goldLost: walletBefore - next.gold,
    campGoldAwarded,
    lossRatio
  };
  next.terminalEligibility = {
    outcome: "extraction",
    eligibleRevision: next.revision,
    reason: request.mode
  };
  assertTerminalEligibilityV08(next);
  return {
    nextState: next,
    publicResult: structuredClone(next.extraction)
  };
}
