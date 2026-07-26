import fallbackDocument from "./data/relic-reward-fallback-policy.generated.json" with { type: "json" };
import manifest from "./data/ruleset-manifest.json" with { type: "json" };
import { assertGoldLedgerV08, resolveGoldModifierV08 } from "./gold-policy.js";
import { assertMetaStateV08, cloneMetaStateV08 } from "./meta-state.js";
import {
  computeRelicOfferStateDigestV08
} from "./relic-offer-common.js";
import {
  getOtterRelicCandidatePoolV08,
  getRegularRelicCandidatePoolV08
} from "./regular-relic-offer.js";

const policy = fallbackDocument.canonicalData;
const sourcePolicies = new Map(
  policy.sources.map((entry) => [`${entry.sourceType}:${entry.sourceId}`, entry])
);
const fallbackPolicies = new Map(
  policy.fallbackPolicies.map((entry) => [
    `${entry.sourceType}:${entry.sourceId}:${entry.reason}`,
    entry
  ])
);

export const RELIC_REWARD_FALLBACK_POLICY_VERSION = policy.policyVersion;
export const RELIC_REWARD_FALLBACK_HISTORY_LIMIT = policy.historyLimit;

function reject(code, anomalyReasonCodes = []) {
  return {
    decision: "REJECT",
    code,
    anomalyReasonCodes: [...anomalyReasonCodes]
  };
}

function normalizeTrustedInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("RELIC_REWARD_AVAILABILITY_INPUT_INVALID");
  }
  const normalized = {};
  for (const field of [
    "sourceType",
    "sourceId",
    "sourceDirectiveId",
    "rewardEnvelopeId",
    "rewardSlotId",
    "acquisitionContext"
  ]) {
    normalized[field] = String(input[field] || "").trim();
    if (!normalized[field]) {
      throw new TypeError(`RELIC_REWARD_AVAILABILITY_INPUT_INVALID:${field}`);
    }
  }
  return normalized;
}

function findBinding(metaState, input) {
  const directive = metaState.currentRoomDirective;
  const envelope = metaState.currentRewardEnvelope;
  if (!directive || !envelope) return reject("SOURCE_UNAVAILABLE");
  if (metaState.rulesetHash !== manifest.rulesetHash) return reject("RULESET_HASH_MISMATCH");
  if (input.sourceDirectiveId !== directive.directiveId) return reject("RELIC_REWARD_DIRECTIVE_MISMATCH");
  if (input.rewardEnvelopeId !== envelope.envelopeId) return reject("RELIC_REWARD_ENVELOPE_ID_MISMATCH");
  if (
    envelope.runId !== metaState.runId ||
    envelope.rulesetHash !== metaState.rulesetHash
  ) {
    return reject("RELIC_REWARD_BINDING_MISMATCH");
  }
  if (
    envelope.revision !== metaState.revision ||
    directive.revision !== metaState.revision
  ) {
    return reject("OFFER_EXPIRED");
  }
  if (
    envelope.directiveId !== directive.directiveId ||
    envelope.roomType !== directive.roomType
  ) {
    return reject("RELIC_REWARD_BINDING_MISMATCH");
  }
  const slot = envelope.rewardSlots?.find((entry) => entry.slotId === input.rewardSlotId);
  if (!slot) return reject("RELIC_REWARD_SLOT_UNKNOWN");
  if (
    slot.sourceType !== input.sourceType ||
    slot.sourceId !== input.sourceId
  ) {
    return reject("RELIC_REWARD_SOURCE_MISMATCH");
  }
  const sourcePolicy = sourcePolicies.get(`${slot.sourceType}:${slot.sourceId}`);
  if (!sourcePolicy) return reject("SOURCE_UNAVAILABLE");
  if (slot.consumed) return reject("RELIC_REWARD_SLOT_ALREADY_CONSUMED");
  return { directive, envelope, slot, sourcePolicy };
}

function candidateCount(metaState, binding) {
  if (binding.slot.availabilityMode === "stored_reward") {
    return Array.isArray(binding.slot.canonicalStoredChoiceIds)
      ? binding.slot.canonicalStoredChoiceIds.length
      : 0;
  }
  if (binding.slot.availabilityMode === "future_arena_spec") {
    return Number.isSafeInteger(binding.slot.canonicalCandidateCount)
      ? binding.slot.canonicalCandidateCount
      : 0;
  }
  if (binding.slot.sourceId === "warden-standard-drop") {
    return getRegularRelicCandidatePoolV08(metaState, binding.directive.depth).length;
  }
  if (binding.slot.sourceId === "otter-crimson-chest") {
    return getOtterRelicCandidatePoolV08(metaState).length;
  }
  return 0;
}

export function resolveRelicFallback({
  canonicalState,
  sourceType,
  sourceId,
  reason,
  rewardSlot
}) {
  const entry = fallbackPolicies.get(`${sourceType}:${sourceId}:${reason}`);
  if (!entry || rewardSlot?.availabilityMode !== "stored_reward") {
    return reject(
      reason === "STORED_REWARD_STALE"
        ? "STORED_REWARD_STALE"
        : "RELIC_REWARD_FALLBACK_NOT_ALLOWED",
      reason === "STORED_REWARD_STALE" ? [policy.securityDivergence] : []
    );
  }
  const gold = resolveGoldModifierV08({
    canonicalBuild: canonicalState.build,
    canonicalRunModifiers: canonicalState.runModifiers,
    sourceId: entry.goldSourceId,
    baseAmount: entry.baseAmount,
    context: { applyMultiplier: entry.applyGoldModifiers }
  });
  return {
    decision: "AWARD_FALLBACK",
    fallbackPolicyId: entry.fallbackPolicyId,
    reason: entry.reason,
    awardType: entry.awardType,
    authoritativeGoldDelta: gold.amount,
    baseGoldAmount: gold.baseAmount,
    goldMultiplier: gold.multiplier,
    otherAward: null,
    consumesRewardSlot: entry.consumesRewardSlot,
    consumesOffer: entry.consumesOffer,
    consumesTransaction: entry.consumesTransaction,
    anomalyReasonCodes: [],
    receipt: {
      policyVersion: policy.policyVersion,
      fallbackPolicyId: entry.fallbackPolicyId,
      goldSourceId: entry.goldSourceId,
      baseGoldAmount: gold.baseAmount,
      authoritativeGoldDelta: gold.amount
    }
  };
}

export function resolveRelicRewardAvailability(metaState, trustedInput) {
  let input;
  try {
    assertMetaStateV08(metaState);
    input = normalizeTrustedInput(trustedInput);
  } catch (error) {
    return reject(error.message);
  }
  const binding = findBinding(metaState, input);
  if (binding.decision === "REJECT") return binding;
  if (input.acquisitionContext === "stored_reward") {
    if (binding.slot.availabilityMode !== "stored_reward") {
      return reject("RELIC_REWARD_ACQUISITION_CONTEXT_MISMATCH");
    }
    if (candidateCount(metaState, binding) === 0) {
      return resolveRelicFallback({
        canonicalState: metaState,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        reason: "STORED_REWARD_EMPTY",
        rewardSlot: binding.slot
      });
    }
  } else if (input.acquisitionContext === "pre_offer") {
    if (!["pre_offer", "future_arena_spec"].includes(binding.slot.availabilityMode)) {
      return reject("RELIC_REWARD_ACQUISITION_CONTEXT_MISMATCH");
    }
    if (candidateCount(metaState, binding) === 0) {
      return {
        decision: "NO_REWARD",
        reason: "EMPTY_CANDIDATE_POOL",
        consumesRewardSlot: true,
        consumesOffer: false,
        consumesTransaction: false,
        authoritativeGoldDelta: 0,
        anomalyReasonCodes: []
      };
    }
  } else {
    return reject("RELIC_REWARD_ACQUISITION_CONTEXT_UNKNOWN");
  }
  const pendingTransaction = metaState.pendingRelicTransaction;
  if (
    pendingTransaction?.incoming?.sourceRewardSlotId === binding.slot.slotId
  ) {
    return {
      decision: "REQUIRE_REPLACEMENT",
      transactionId: pendingTransaction.transactionId
    };
  }
  return {
    decision: "ISSUE_RELIC_OFFER",
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    rewardSlotId: input.rewardSlotId
  };
}

function normalizeCommitRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("RELIC_REWARD_FALLBACK_REQUEST_INVALID");
  }
  const legal = new Set([
    "sourceType",
    "sourceId",
    "sourceDirectiveId",
    "rewardEnvelopeId",
    "rewardSlotId",
    "acquisitionContext"
  ]);
  for (const field of Object.keys(request)) {
    if (!legal.has(field)) {
      throw new TypeError(`RELIC_REWARD_FALLBACK_REQUEST_UNKNOWN_FIELD:${field}`);
    }
  }
  return normalizeTrustedInput(request);
}

async function requestDigest(request, cryptoProvider) {
  return computeRelicOfferStateDigestV08({
    operation: "relic_reward_fallback",
    ...request
  }, cryptoProvider);
}

async function resultingStateDigest(next, slot, resolution, cryptoProvider) {
  return computeRelicOfferStateDigestV08({
    runId: next.runId,
    rulesetHash: next.rulesetHash,
    revision: next.revision,
    depth: next.depth,
    gold: next.gold,
    buildDigest: next.build.buildDigest,
    modifierDigest: next.runModifiers.modifierDigest,
    rewardEnvelopeId: next.currentRewardEnvelope.envelopeId,
    rewardSlotId: slot.slotId,
    slotConsumed: slot.consumed,
    resolution
  }, cryptoProvider);
}

export async function commitRelicRewardFallback(metaState, rawRequest, context = {}) {
  const request = normalizeCommitRequest(rawRequest);
  const digest = await requestDigest(request, context.cryptoProvider);
  const prior = (metaState.relicFallbackHistory || []).find(
    (entry) =>
      entry.rewardEnvelopeId === request.rewardEnvelopeId &&
      entry.rewardSlotId === request.rewardSlotId
  );
  if (prior) {
    if (prior.requestDigest !== digest) {
      throw new TypeError("RELIC_REWARD_FALLBACK_IDEMPOTENCY_PAYLOAD_MISMATCH");
    }
    return cloneMetaStateV08(metaState);
  }
  const resolution = resolveRelicRewardAvailability(metaState, request);
  if (!["AWARD_FALLBACK", "NO_REWARD"].includes(resolution.decision)) {
    throw new TypeError(resolution.code || `RELIC_REWARD_RESOLUTION_NOT_COMMITTABLE:${resolution.decision}`);
  }

  const next = cloneMetaStateV08(metaState);
  const slot = next.currentRewardEnvelope.rewardSlots.find(
    (entry) => entry.slotId === request.rewardSlotId
  );
  if (!slot || slot.consumed) throw new TypeError("RELIC_REWARD_SLOT_ALREADY_CONSUMED");
  if (resolution.consumesOffer && next.pendingOffer) {
    if (next.pendingOffer.rewardSlotId !== slot.slotId) {
      throw new TypeError("RELIC_REWARD_FALLBACK_OFFER_MISMATCH");
    }
    next.pendingOffer = null;
  }
  if (resolution.consumesTransaction && next.pendingRelicTransaction) {
    if (next.pendingRelicTransaction.incoming?.sourceRewardSlotId !== slot.slotId) {
      throw new TypeError("RELIC_REWARD_FALLBACK_TRANSACTION_MISMATCH");
    }
    next.pendingRelicTransaction = null;
  }

  const goldDelta = resolution.authoritativeGoldDelta;
  next.gold += goldDelta;
  next.goldLedger.earnedServerDerived += goldDelta;
  next.goldLedger.lastDelta = goldDelta;
  next.goldLedger.lastEnvelopeId = request.rewardEnvelopeId;
  slot.consumed = true;
  slot.resolution = resolution.decision === "AWARD_FALLBACK"
    ? "fallback_awarded"
    : "no_reward";
  const stateDigest = await resultingStateDigest(
    next,
    slot,
    slot.resolution,
    context.cryptoProvider
  );
  const receipt = {
    requestDigest: digest,
    resultingStateDigest: stateDigest,
    rewardEnvelopeId: request.rewardEnvelopeId,
    rewardSlotId: request.rewardSlotId,
    sourceType: request.sourceType,
    sourceId: request.sourceId,
    resolution: resolution.decision,
    reason: resolution.reason,
    fallbackPolicyId: resolution.fallbackPolicyId || null,
    baseGoldAmount: resolution.baseGoldAmount || 0,
    authoritativeGoldDelta: goldDelta,
    anomalyReasonCodes: [...resolution.anomalyReasonCodes]
  };
  next.relicFallbackHistory = [
    ...(next.relicFallbackHistory || []),
    receipt
  ].slice(-RELIC_REWARD_FALLBACK_HISTORY_LIMIT);
  next.updatedAt = next.startedAt + next.revision;
  assertGoldLedgerV08(next);
  return next;
}

export function assertRelicFallbackHistoryV08(history) {
  if (!Array.isArray(history) || history.length > RELIC_REWARD_FALLBACK_HISTORY_LIMIT) {
    throw new TypeError("META_STATE_INVALID:relicFallbackHistory");
  }
  for (const entry of history) {
    if (!entry || typeof entry !== "object") {
      throw new TypeError("RELIC_REWARD_FALLBACK_RECEIPT_INVALID");
    }
    for (const field of [
      "requestDigest",
      "resultingStateDigest",
      "rewardEnvelopeId",
      "rewardSlotId",
      "sourceType",
      "sourceId",
      "resolution",
      "reason"
    ]) {
      if (!String(entry[field] || "").trim()) {
        throw new TypeError(`RELIC_REWARD_FALLBACK_RECEIPT_INVALID:${field}`);
      }
    }
    if (
      !Number.isSafeInteger(entry.authoritativeGoldDelta) ||
      entry.authoritativeGoldDelta < 0
    ) {
      throw new TypeError("RELIC_REWARD_FALLBACK_RECEIPT_INVALID:gold");
    }
  }
  return history;
}

export function projectPublicRelicFallbackReceiptV08(receipt) {
  assertRelicFallbackHistoryV08([receipt]);
  return {
    resolution: receipt.resolution,
    reason: receipt.reason,
    fallbackPolicyId: receipt.fallbackPolicyId,
    authoritativeGoldDelta: receipt.authoritativeGoldDelta,
    rewardSlotId: receipt.rewardSlotId,
    stateDigest: receipt.resultingStateDigest,
    anomalyReasonCodes: [...receipt.anomalyReasonCodes]
  };
}

export const V08_RELIC_REWARD_FALLBACK_POLICY = Object.freeze(policy);
