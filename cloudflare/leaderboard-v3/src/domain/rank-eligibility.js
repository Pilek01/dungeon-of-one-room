import rewardBoundsDocument from "../rulesets/v08-meta-1/data/room-reward-bounds.generated.json" with { type: "json" };
import { calculateEnemyGoldV08 } from "../rulesets/v08-meta-1/gold-policy.js";

export const RANK_ELIGIBILITY = Object.freeze({
  official: "official",
  provisional: "provisional"
});

export const ROOM_INTEGRITY_SIGNAL = Object.freeze({
  invalidCompletionCapability: "local_room_completion_capability_invalid"
});

export const RANK_INTEGRITY_REASON = Object.freeze({
  missingEnvelope: "CHECKPOINT_INTEGRITY_ENVELOPE_MISSING",
  reportedGoldDeltaMismatch: "REPORTED_GOLD_DELTA_MISMATCH",
  reportedGoldTotalMismatch: "REPORTED_GOLD_TOTAL_MISMATCH"
});

export const V08_LOCAL_ELITE_REWARD_BONUS = 3;

const rewardBounds = rewardBoundsDocument.canonicalData;

const DISQUALIFYING_GOLD_INTEGRITY_REASONS = new Set([
  RANK_INTEGRITY_REASON.reportedGoldDeltaMismatch,
  RANK_INTEGRITY_REASON.reportedGoldTotalMismatch
]);

const ALLOWED_INTEGRITY_SIGNALS = new Set(Object.values(ROOM_INTEGRITY_SIGNAL));

function canonicalReasons(value) {
  return [...new Set(
    (Array.isArray(value) ? value : [])
      .map((entry) => String(entry || ""))
      .filter(Boolean)
  )].slice(0, 16);
}

function canonicalRoomGoldContext(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !String(value.directiveId || "") ||
    !value.build ||
    typeof value.build !== "object" ||
    Array.isArray(value.build) ||
    !value.runModifiers ||
    typeof value.runModifiers !== "object" ||
    Array.isArray(value.runModifiers)
  ) return null;
  return {
    directiveId: String(value.directiveId),
    build: structuredClone(value.build),
    runModifiers: structuredClone(value.runModifiers)
  };
}

export function initializeRankEligibility(state, options = {}) {
  const next = state;
  const provisional = next.rankEligibility === RANK_ELIGIBILITY.provisional;
  const existingVersion = next.rankIntegrity?.version;
  const version = existingVersion === 1 || existingVersion === 0
    ? existingVersion
    : options.integrityVersion === 1
      ? 1
      : 0;
  next.rankEligibility = provisional
    ? RANK_ELIGIBILITY.provisional
    : RANK_ELIGIBILITY.official;
  next.rankIntegrity = {
    version,
    reasonCodes: canonicalReasons(next.rankIntegrity?.reasonCodes),
    firstDetectedRevision: Number.isSafeInteger(next.rankIntegrity?.firstDetectedRevision)
      ? next.rankIntegrity.firstDetectedRevision
      : null,
    roomGoldContext: canonicalRoomGoldContext(next.rankIntegrity?.roomGoldContext)
  };
  return next;
}

export function captureRankIntegrityRoomContext(state) {
  initializeRankEligibility(state);
  const directiveId = String(state.currentRoomDirective?.directiveId || "");
  if (!directiveId) {
    state.rankIntegrity.roomGoldContext = null;
    return state;
  }
  if (
    state.rankIntegrity.roomGoldContext?.directiveId === directiveId
  ) {
    return state;
  }
  state.rankIntegrity.roomGoldContext = {
    directiveId,
    build: structuredClone(state.build),
    runModifiers: structuredClone(state.runModifiers)
  };
  return state;
}

export function rankIntegrityRoomState(state) {
  const context = canonicalRoomGoldContext(state?.rankIntegrity?.roomGoldContext);
  const directiveId = String(state?.currentRoomDirective?.directiveId || "");
  if (!context || !directiveId || context.directiveId !== directiveId) return null;
  const roomState = structuredClone(state);
  roomState.build = structuredClone(context.build);
  roomState.runModifiers = structuredClone(context.runModifiers);
  return roomState;
}

export function rankEligibilityOf(state) {
  return state?.rankEligibility === RANK_ELIGIBILITY.provisional
    ? RANK_ELIGIBILITY.provisional
    : RANK_ELIGIBILITY.official;
}

export function isOfficialRankEligible(state) {
  return rankEligibilityOf(state) === RANK_ELIGIBILITY.official;
}

function v08LocalEliteGoldAdjustment(state, rewardClaims) {
  if (
    state?.rulesetId !== "v08-meta-1" ||
    state?.currentRewardEnvelope?.claimPolicyVersion !== rewardBounds.policyVersion
  ) return 0;
  const roomType = state.currentRewardEnvelope.roomType;
  const roomRewardBonus = Math.max(
    0,
    Number(rewardBounds.enemyClaims.rewardBonusByRoom[roomType]) || 0
  );
  let adjustment = 0;
  for (const claim of Array.isArray(rewardClaims) ? rewardClaims : []) {
    if (claim?.claimType !== "elite" || !String(claim.claimId || "").startsWith("elite:")) {
      continue;
    }
    const enemyType = String(claim.claimId).slice("elite:".length);
    const count = Math.max(0, Number(claim.count) || 0);
    const common = {
      canonicalBuild: state.build,
      canonicalRunModifiers: state.runModifiers,
      enemyType,
      elite: true
    };
    const canonicalUnit = calculateEnemyGoldV08({
      ...common,
      rewardBonus: roomRewardBonus
    });
    const localUnit = calculateEnemyGoldV08({
      ...common,
      rewardBonus: roomRewardBonus + V08_LOCAL_ELITE_REWARD_BONUS
    });
    adjustment += (localUnit - canonicalUnit) * count;
  }
  return adjustment;
}

export function checkpointGoldIntegrityReasons(state, body, authoritativeGoldDelta) {
  if (body?.integrityVersion !== 1) return [];
  const canonicalDelta = Math.max(0, Number(authoritativeGoldDelta) || 0);
  const expectedLocalDelta = canonicalDelta + v08LocalEliteGoldAdjustment(
    state,
    body.rewardClaims
  );
  const expectedLocalTotal = Math.max(0, Number(state?.gold) || 0) + expectedLocalDelta;
  const reasons = [];
  if (body.reportedGoldDelta !== expectedLocalDelta) {
    reasons.push(RANK_INTEGRITY_REASON.reportedGoldDeltaMismatch);
  }
  if (body.reportedGoldTotal !== expectedLocalTotal) {
    reasons.push(RANK_INTEGRITY_REASON.reportedGoldTotalMismatch);
  }
  return reasons;
}

export function applyCheckpointRankEligibility(state, input = {}) {
  initializeRankEligibility(state, { integrityVersion: input.integrityVersion });
  if (state.rankIntegrity.version !== 1) return state;
  const reasons = [
    ...(input.integrityVersion !== 1
      ? [RANK_INTEGRITY_REASON.missingEnvelope]
      : [
          ...(Array.isArray(input.integritySignals)
            ? input.integritySignals.filter((entry) => ALLOWED_INTEGRITY_SIGNALS.has(entry))
            : []),
          ...(Array.isArray(input.goldIntegrityReasons)
            ? input.goldIntegrityReasons.filter((entry) =>
                DISQUALIFYING_GOLD_INTEGRITY_REASONS.has(entry)
              )
            : [])
        ])
  ];
  if (reasons.length === 0) return state;
  state.rankEligibility = RANK_ELIGIBILITY.provisional;
  state.rankIntegrity.reasonCodes = canonicalReasons([
    ...state.rankIntegrity.reasonCodes,
    ...reasons
  ]);
  if (state.rankIntegrity.firstDetectedRevision === null) {
    state.rankIntegrity.firstDetectedRevision = state.revision;
  }
  return state;
}
