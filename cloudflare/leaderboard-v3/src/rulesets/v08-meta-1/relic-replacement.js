import { isCompatibleRulesetHashV08 } from "./ruleset-hash-policy.js";
import slotPolicyDocument from "./data/relic-slot-policy.generated.json" with { type: "json" };
import {
  applyRelicReplacementBuildV08,
  canAcquireRelic,
  getRelicCatalogEntryV08,
  projectPublicBuild
} from "./relic-policy.js";
import {
  appendRelicOfferReceiptV08,
  deriveRelicOfferOpaqueIdV08
} from "./relic-offer-common.js";

const slotPolicy = slotPolicyDocument.canonicalData;
export const RELIC_REPLACEMENT_POLICY_VERSION = "v08-replacement-1";
export const RELIC_REPLACEMENT_HISTORY_LIMIT = 64;

function countBy(build, field) {
  return build.relics.filter((entry) => getRelicCatalogEntryV08(entry.relicId)[field]).length;
}

function sourceAllowed(policy, source) {
  return policy.acquisitionSources.includes(source);
}

function normalizeAcquisition(acquisition) {
  if (!acquisition || typeof acquisition !== "object" || Array.isArray(acquisition)) {
    throw new TypeError("RELIC_ACQUISITION_INVALID");
  }
  const normalized = {
    incomingRelicId: String(acquisition.incomingRelicId || "").trim(),
    incomingStacks: Number(acquisition.incomingStacks ?? 1),
    acquisitionSource: String(acquisition.acquisitionSource || "").trim(),
    sourceOfferId: String(acquisition.sourceOfferId || "").trim(),
    sourceChoiceId: String(acquisition.sourceChoiceId || "").trim(),
    sourceRewardSlotId: acquisition.sourceRewardSlotId == null
      ? null
      : String(acquisition.sourceRewardSlotId || "").trim()
  };
  if (!normalized.incomingRelicId) throw new TypeError("RELIC_INVALID");
  if (!Number.isSafeInteger(normalized.incomingStacks) || normalized.incomingStacks !== 1) {
    throw new TypeError("RELIC_INCOMING_STACKS_INVALID");
  }
  for (const field of ["acquisitionSource", "sourceOfferId", "sourceChoiceId"]) {
    if (!normalized[field]) throw new TypeError(`RELIC_ACQUISITION_INVALID:${field}`);
  }
  return normalized;
}

export function isRelicDraftEligibleV08(build, relicId) {
  let policy;
  try {
    policy = getRelicCatalogEntryV08(relicId);
  } catch {
    return false;
  }
  const existing = build.relics.find((entry) => entry.relicId === policy.relicId);
  if (existing && (!policy.stackable || existing.stacks >= policy.maximumStacks)) return false;
  if (policy.mythic && countBy(build, "mythic") >= slotPolicy.maximumMythicRelics) return false;
  return true;
}

function physicalRemovalUnits(build, excluded = new Set()) {
  const units = [];
  for (const entry of build.relics) {
    if (excluded.has(entry.relicId)) continue;
    for (let index = 0; index < entry.stacks; index += 1) units.push(entry.relicId);
  }
  return units;
}

function removalCombinations(units, count) {
  const results = new Map();
  function visit(start, remaining, selected) {
    if (remaining === 0) {
      const counts = new Map();
      for (const relicId of selected) counts.set(relicId, (counts.get(relicId) || 0) + 1);
      const removals = [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relicId, stacks]) => ({ relicId, stacks }));
      results.set(removals.map((entry) => `${entry.relicId}:${entry.stacks}`).join("|"), removals);
      return;
    }
    for (let index = start; index <= units.length - remaining; index += 1) {
      selected.push(units[index]);
      visit(index + 1, remaining - 1, selected);
      selected.pop();
    }
  }
  visit(0, count, []);
  return [...results.values()];
}

function candidateRemovalPlans(build, incoming, reason, policyMode) {
  const incomingPolicy = getRelicCatalogEntryV08(incoming.incomingRelicId);
  const currentMythic = build.relics.find(
    (entry) => getRelicCatalogEntryV08(entry.relicId).mythic
  );
  if (
    incomingPolicy.mythic &&
    incomingPolicy.relicId !== slotPolicy.slotBonusRelicId &&
    currentMythic?.relicId === slotPolicy.slotBonusRelicId &&
    build.relicSlotsUsed >= 9
  ) {
    const extraCount = build.relicSlotsUsed - slotPolicy.baseRelicSlots;
    return removalCombinations(
      physicalRemovalUnits(build, new Set([slotPolicy.slotBonusRelicId])),
      extraCount
    ).map((removals) => [
      ...removals,
      { relicId: slotPolicy.slotBonusRelicId, stacks: 1 }
    ]);
  }
  if (policyMode === "legendary_duel") {
    return build.relics
      .filter((entry) => getRelicCatalogEntryV08(entry.relicId).legendary)
      .slice(0, 1)
      .map((entry) => [{ relicId: entry.relicId, stacks: 1 }]);
  }
  if (reason === "MYTHIC_LIMIT_REACHED") {
    return currentMythic ? [[{ relicId: currentMythic.relicId, stacks: 1 }]] : [];
  }
  return build.relics.map((entry) => [{ relicId: entry.relicId, stacks: 1 }]);
}

function replacementReason(verdict, policy) {
  if (verdict.code === "RELIC_SLOTS_FULL") return "RELIC_SLOTS_FULL";
  if (verdict.code === "RELIC_LEGENDARY_LIMIT_REACHED") return "LEGENDARY_LIMIT_REACHED";
  if (
    verdict.code === "RELIC_MYTHIC_LIMIT_REACHED" ||
    verdict.code.startsWith("RELIC_MUTUALLY_EXCLUSIVE:") && policy.mythic
  ) {
    return "MYTHIC_LIMIT_REACHED";
  }
  return null;
}

function removalProjection(build, removal) {
  const entry = build.relics.find((candidate) => candidate.relicId === removal.relicId);
  const resultingStacks = entry.stacks - removal.stacks;
  return {
    relicId: removal.relicId,
    currentStacks: entry.stacks,
    targetStackDelta: -removal.stacks,
    removalMode: resultingStacks === 0 ? "remove_all" : "decrement",
    resultingStacks
  };
}

async function simulateCandidates(metaState, incoming, reason, policyMode, context) {
  const plans = candidateRemovalPlans(metaState.build, incoming, reason, policyMode);
  const candidates = [];
  for (const removals of plans) {
    try {
      const resultingBuild = await applyRelicReplacementBuildV08(
        metaState.build,
        removals,
        {
          relicId: incoming.incomingRelicId,
          stacks: incoming.incomingStacks,
          acquiredRevision: metaState.revision,
          acquisitionSource: incoming.acquisitionSource,
          sourceOfferId: incoming.sourceOfferId
        },
        context
      );
      candidates.push({
        removals: removals.map((entry) => removalProjection(metaState.build, entry)),
        resultingSlotsUsed: resultingBuild.relicSlotsUsed,
        resultingSlotLimit: resultingBuild.relicSlotLimit,
        resultingLegendaryCount: countBy(resultingBuild, "legendary"),
        resultingMythicCount: countBy(resultingBuild, "mythic"),
        resultingBuildDigest: resultingBuild.buildDigest
      });
    } catch {
      // A candidate exists publicly only when the complete final build is legal.
    }
  }
  return candidates;
}

export async function evaluateRelicAcquisition(metaState, acquisition, context = {}) {
  const incoming = normalizeAcquisition(acquisition);
  let policy;
  try {
    policy = getRelicCatalogEntryV08(incoming.incomingRelicId);
  } catch {
    return { decision: "REJECT", code: "INVALID_RELIC" };
  }
  if (!sourceAllowed(policy, incoming.acquisitionSource)) {
    return { decision: "REJECT", code: "RELIC_SOURCE_RESTRICTION" };
  }
  if (incoming.acquisitionSource === "starting_relic" && metaState.build.relicSlotsUsed !== 0) {
    return { decision: "REJECT", code: "STARTING_RELIC_BUILD_NOT_EMPTY" };
  }
  const verdict = canAcquireRelic(metaState.build, incoming.incomingRelicId);
  if (verdict.allowed) {
    return { decision: "ACQUIRE_DIRECT", incoming };
  }
  if (verdict.code.startsWith("RELIC_STACK_LIMIT_REACHED:")) {
    return { decision: "REJECT", code: "STACK_CAP_REACHED" };
  }
  if (verdict.code.startsWith("RELIC_UNIQUE_DUPLICATE:")) {
    return { decision: "REJECT", code: "UNIQUE_DUPLICATE" };
  }
  const reason = replacementReason(verdict, policy);
  if (!reason) return { decision: "REJECT", code: verdict.code };
  const legendaryLimit = metaState.build.relics.some(
    (entry) => entry.relicId === slotPolicy.doubleLegendaryRelicId
  ) || incoming.incomingRelicId === slotPolicy.doubleLegendaryRelicId
    ? slotPolicy.maximumLegendaryRelicsWithBonus
    : slotPolicy.maximumLegendaryRelics;
  const policyMode =
    reason === "LEGENDARY_LIMIT_REACHED" && legendaryLimit <= 1
      ? "legendary_duel"
      : "capacity_replacement";
  const candidatePlans = await simulateCandidates(
    metaState,
    incoming,
    reason,
    policyMode,
    context
  );
  if (candidatePlans.length === 0) {
    return { decision: "REJECT", code: "NO_LEGAL_REPLACEMENT" };
  }
  return {
    decision: "REQUIRE_REPLACEMENT",
    reason,
    policyMode,
    secondaryReasons: candidatePlans.some((candidate) => candidate.removals.length > 1)
      ? ["BUILD_CAPACITY_REBALANCE"]
      : [],
    incoming,
    candidatePlans
  };
}

export async function createPendingRelicTransactionV08(
  metaState,
  decision,
  context = {}
) {
  if (decision?.decision !== "REQUIRE_REPLACEMENT") {
    throw new TypeError("RELIC_REPLACEMENT_DECISION_REQUIRED");
  }
  const transactionId = await deriveRelicOfferOpaqueIdV08(
    metaState,
    context,
    "relic-replacement/transaction-id",
    0,
    "replacement"
  );
  const candidates = [];
  for (let index = 0; index < decision.candidatePlans.length; index += 1) {
    candidates.push({
      replacementChoiceId: await deriveRelicOfferOpaqueIdV08(
        metaState,
        context,
        "relic-replacement/choice-id",
        index,
        "replace"
      ),
      ...structuredClone(decision.candidatePlans[index])
    });
  }
  const incomingPolicy = getRelicCatalogEntryV08(decision.incoming.incomingRelicId);
  const transaction = {
    transactionId,
    transactionType: "relic_replacement",
    reason: decision.reason,
    secondaryReasons: structuredClone(decision.secondaryReasons),
    policyMode: decision.policyMode,
    policyVersion: RELIC_REPLACEMENT_POLICY_VERSION,
    runId: metaState.runId,
    rulesetHash: metaState.rulesetHash,
    issuedRevision: metaState.revision,
    issuedBuildDigest: metaState.build.buildDigest,
    incoming: structuredClone(decision.incoming),
    candidates,
    publicProjection: null,
    cancelAllowed: true,
    consumed: false,
    selectedReplacementChoiceId: null,
    completedRevision: null,
    cancelled: false
  };
  transaction.publicProjection = {
    transactionId,
    reason: transaction.reason,
    incoming: {
      relicId: incomingPolicy.relicId,
      stacks: transaction.incoming.incomingStacks,
      rarity: incomingPolicy.rarity
    },
    choices: candidates.map((candidate) => ({
      replacementChoiceId: candidate.replacementChoiceId,
      removals: candidate.removals.map((removal) => ({
        relicId: removal.relicId,
        currentStacks: removal.currentStacks,
        removalMode: removal.removalMode,
        resultingStacks: removal.resultingStacks
      })),
      resultingSlotsUsed: candidate.resultingSlotsUsed,
      resultingSlotLimit: candidate.resultingSlotLimit
    })),
    cancelAllowed: true
  };
  return transaction;
}

export function projectPublicRelicReplacement(metaState) {
  const transaction = metaState?.pendingRelicTransaction;
  return transaction ? structuredClone(transaction.publicProjection) : null;
}

function assertReplacementRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("RELIC_REPLACEMENT_REQUEST_INVALID");
  }
  for (const field of Object.keys(request)) {
    if (!["transactionId", "replacementChoiceId"].includes(field)) {
      throw new TypeError(`RELIC_REPLACEMENT_REQUEST_UNKNOWN_FIELD:${field}`);
    }
  }
  const transactionId = String(request.transactionId || "").trim();
  const replacementChoiceId = String(request.replacementChoiceId || "").trim();
  if (!transactionId) throw new TypeError("REPLACEMENT_TRANSACTION_NOT_FOUND");
  if (!replacementChoiceId) throw new TypeError("REPLACEMENT_CHOICE_NOT_ALLOWED");
  return { transactionId, replacementChoiceId };
}

function findReplacementReceipt(state, transactionId) {
  return (state.relicReplacementHistory || []).find(
    (entry) => entry.transactionId === transactionId
  ) || null;
}

function validateBinding(metaState, transaction, context) {
  if (
    transaction.runId !== metaState.runId ||
    transaction.rulesetHash !== metaState.rulesetHash ||
    !isCompatibleRulesetHashV08(transaction.rulesetHash) ||
    context.runId && context.runId !== metaState.runId ||
    context.rulesetHash && context.rulesetHash !== metaState.rulesetHash
  ) {
    throw new TypeError("REPLACEMENT_BINDING_MISMATCH");
  }
  if (transaction.issuedRevision !== metaState.revision) {
    throw new TypeError("STALE_REPLACEMENT_TRANSACTION");
  }
  if (transaction.issuedBuildDigest !== metaState.build.buildDigest) {
    throw new TypeError("REPLACEMENT_BUILD_CHANGED");
  }
}

function consumeSource(next, transaction, resolution, completedRevision) {
  const offer = next.pendingOffer;
  if (
    !offer ||
    offer.offerId !== transaction.incoming.sourceOfferId ||
    !offer.choices.some(
      (choice) => choice.choiceId === transaction.incoming.sourceChoiceId
    )
  ) {
    throw new TypeError("REPLACEMENT_SOURCE_OFFER_MISMATCH");
  }
  if (offer.offerType === "relic_reward") {
    const slot = next.currentRewardEnvelope?.rewardSlots?.find(
      (entry) => entry.slotId === transaction.incoming.sourceRewardSlotId
    );
    if (
      !slot ||
      slot.offerId !== offer.offerId ||
      slot.consumed
    ) {
      throw new TypeError("REPLACEMENT_SOURCE_SLOT_MISMATCH");
    }
    slot.consumed = true;
    slot.resolution = resolution;
  }
  const consumedOffer = {
    ...offer,
    selectionPending: false,
    selectedChoiceId: transaction.incoming.sourceChoiceId,
    consumed: true,
    consumedChoiceId: transaction.incoming.sourceChoiceId,
    consumedAtRevision: completedRevision
  };
  next.pendingOffer = null;
  return consumedOffer;
}

function appendReplacementReceipt(next, receipt) {
  next.relicReplacementHistory = [
    ...(next.relicReplacementHistory || []),
    receipt
  ].slice(-RELIC_REPLACEMENT_HISTORY_LIMIT);
}

export async function commitRelicReplacement(metaState, request, context = {}) {
  const normalized = assertReplacementRequest(request);
  const receipt = findReplacementReceipt(metaState, normalized.transactionId);
  if (receipt) {
    if (
      receipt.cancelled ||
      receipt.replacementChoiceId !== normalized.replacementChoiceId
    ) {
      throw new TypeError("REPLACEMENT_ALREADY_COMPLETED");
    }
    return structuredClone(metaState);
  }
  const transaction = metaState.pendingRelicTransaction;
  if (!transaction || transaction.transactionId !== normalized.transactionId) {
    throw new TypeError("REPLACEMENT_TRANSACTION_NOT_FOUND");
  }
  validateBinding(metaState, transaction, context);
  const candidate = transaction.candidates.find(
    (entry) => entry.replacementChoiceId === normalized.replacementChoiceId
  );
  if (!candidate) throw new TypeError("REPLACEMENT_CHOICE_NOT_ALLOWED");
  const rebuilt = await applyRelicReplacementBuildV08(
    metaState.build,
    candidate.removals.map((entry) => ({
      relicId: entry.relicId,
      stacks: -entry.targetStackDelta
    })),
    {
      relicId: transaction.incoming.incomingRelicId,
      stacks: transaction.incoming.incomingStacks,
      acquiredRevision: metaState.revision,
      acquisitionSource: transaction.incoming.acquisitionSource,
      sourceOfferId: transaction.incoming.sourceOfferId
    },
    context
  );
  if (rebuilt.buildDigest !== candidate.resultingBuildDigest) {
    throw new TypeError("REPLACEMENT_BUILD_CHANGED");
  }
  const next = structuredClone(metaState);
  next.build = rebuilt;
  const starting = next.pendingOffer?.offerType === "starting_relic";
  if (starting) {
    next.revision += 1;
    next.status = "active";
  }
  const consumedOffer = consumeSource(
    next,
    transaction,
    "replacement_committed",
    next.revision
  );
  const completed = {
    ...transaction,
    consumed: true,
    selectedReplacementChoiceId: normalized.replacementChoiceId,
    completedRevision: next.revision
  };
  next.pendingRelicTransaction = null;
  appendRelicOfferReceiptV08(next, {
    offerId: consumedOffer.offerId,
    choiceId: transaction.incoming.sourceChoiceId,
    relicId: transaction.incoming.incomingRelicId,
    consumedAtRevision: next.revision,
    publicBuild: projectPublicBuild(next.build),
    offer: consumedOffer
  });
  appendReplacementReceipt(next, {
    transactionId: transaction.transactionId,
    replacementChoiceId: normalized.replacementChoiceId,
    cancelled: false,
    completedRevision: next.revision,
    resultingBuildDigest: next.build.buildDigest,
    transaction: completed
  });
  next.updatedAt = next.startedAt + next.revision;
  return next;
}

export async function cancelRelicReplacement(metaState, request, context = {}) {
  if (!request || Object.keys(request).some((field) => field !== "transactionId")) {
    throw new TypeError("RELIC_REPLACEMENT_CANCEL_REQUEST_INVALID");
  }
  const transactionId = String(request.transactionId || "").trim();
  const receipt = findReplacementReceipt(metaState, transactionId);
  if (receipt) {
    if (!receipt.cancelled) throw new TypeError("REPLACEMENT_ALREADY_COMPLETED");
    return structuredClone(metaState);
  }
  const transaction = metaState.pendingRelicTransaction;
  if (!transaction || transaction.transactionId !== transactionId) {
    throw new TypeError("REPLACEMENT_TRANSACTION_NOT_FOUND");
  }
  validateBinding(metaState, transaction, context);
  if (!transaction.cancelAllowed) throw new TypeError("REPLACEMENT_CANCEL_NOT_ALLOWED");
  const next = structuredClone(metaState);
  const consumedOffer = consumeSource(
    next,
    transaction,
    "replacement_cancelled",
    next.revision
  );
  next.pendingRelicTransaction = null;
  appendRelicOfferReceiptV08(next, {
    offerId: consumedOffer.offerId,
    choiceId: transaction.incoming.sourceChoiceId,
    relicId: transaction.incoming.incomingRelicId,
    consumedAtRevision: next.revision,
    publicBuild: projectPublicBuild(next.build),
    offer: consumedOffer
  });
  appendReplacementReceipt(next, {
    transactionId,
    replacementChoiceId: null,
    cancelled: true,
    completedRevision: next.revision,
    resultingBuildDigest: next.build.buildDigest,
    transaction: {
      ...transaction,
      consumed: true,
      completedRevision: next.revision,
      cancelled: true
    }
  });
  next.updatedAt = next.startedAt + next.revision;
  return next;
}

export function assertPendingRelicTransactionV08(transaction) {
  if (transaction === null) return null;
  if (!transaction || transaction.transactionType !== "relic_replacement") {
    throw new TypeError("PENDING_RELIC_TRANSACTION_INVALID");
  }
  for (const field of [
    "transactionId",
    "reason",
    "policyMode",
    "policyVersion",
    "runId",
    "rulesetHash",
    "issuedBuildDigest"
  ]) {
    if (!String(transaction[field] || "").trim()) {
      throw new TypeError(`PENDING_RELIC_TRANSACTION_INVALID:${field}`);
    }
  }
  if (!Number.isSafeInteger(transaction.issuedRevision) || transaction.issuedRevision < 0) {
    throw new TypeError("PENDING_RELIC_TRANSACTION_INVALID:issuedRevision");
  }
  if (!Array.isArray(transaction.candidates) || transaction.candidates.length < 1) {
    throw new TypeError("PENDING_RELIC_TRANSACTION_INVALID:candidates");
  }
  if (
    !transaction.publicProjection ||
    transaction.publicProjection.transactionId !== transaction.transactionId
  ) {
    throw new TypeError("PENDING_RELIC_TRANSACTION_INVALID:publicProjection");
  }
  return transaction;
}
