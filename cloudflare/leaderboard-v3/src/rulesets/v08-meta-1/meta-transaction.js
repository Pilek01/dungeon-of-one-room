import manifest from "./data/ruleset-manifest.json" with { type: "json" };
import {
  computeRelicOfferStateDigestV08,
  deriveRelicOfferOpaqueIdV08
} from "./relic-offer-common.js";
import { assertGoldLedgerV08 } from "./gold-policy.js";

export const META_TRANSACTION_POLICY_VERSION = "v08-meta-transaction-1";
export const META_TRANSACTION_RECEIPT_LIMIT = 64;

function requireText(value, code) {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(code);
  return text;
}

function requireAmount(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(code);
  return value;
}

function bindingInput(state) {
  return {
    rulesetId: state.rulesetId,
    rulesetHash: state.rulesetHash,
    runId: state.runId,
    revision: state.revision,
    status: state.status,
    depth: state.depth,
    roomIndex: state.roomIndex,
    gold: state.gold,
    campGold: state.campGold ?? 0,
    lives: state.lives,
    build: state.build,
    runModifierDigest: state.runModifiers?.modifierDigest,
    currentRoomDirectiveId: state.currentRoomDirective?.directiveId ?? null,
    currentRewardEnvelope: state.currentRewardEnvelope
      ? {
          envelopeId: state.currentRewardEnvelope.envelopeId,
          rewardSlots: (state.currentRewardEnvelope.rewardSlots || []).map((slot) => ({
            slotId: slot.slotId,
            consumed: Boolean(slot.consumed),
            resolution: slot.resolution ?? null
          }))
        }
      : null,
    pendingRelicOfferId: state.pendingOffer?.offerId ?? null,
    pendingRelicTransactionId: state.pendingRelicTransaction?.transactionId ?? null,
    metaSourceConsumptions: state.metaSourceConsumptions ?? []
  };
}

export function computeMetaTransactionStateDigestV08(state, cryptoProvider = globalThis.crypto) {
  return computeRelicOfferStateDigestV08(bindingInput(state), cryptoProvider);
}

function normalizeChoiceSpec(choice, index) {
  if (!choice || typeof choice !== "object" || Array.isArray(choice)) {
    throw new TypeError(`META_TRANSACTION_CHOICE_INVALID:${index}`);
  }
  return {
    kind: requireText(choice.kind, `META_TRANSACTION_CHOICE_KIND_REQUIRED:${index}`),
    label: requireText(choice.label, `META_TRANSACTION_CHOICE_LABEL_REQUIRED:${index}`),
    status: choice.status === "locked" ? "locked" : "available",
    publicData: structuredClone(choice.publicData ?? {}),
    privateData: structuredClone(choice.privateData ?? {})
  };
}

function normalizeOfferSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    throw new TypeError("META_TRANSACTION_OFFER_SPEC_INVALID");
  }
  const choices = Array.isArray(spec.choices)
    ? spec.choices.map(normalizeChoiceSpec)
    : [];
  if (choices.length < 1 || choices.length > 64) {
    throw new TypeError("META_TRANSACTION_OFFER_CHOICE_COUNT_INVALID");
  }
  return {
    sourceType: requireText(spec.sourceType, "META_TRANSACTION_SOURCE_TYPE_REQUIRED"),
    sourceId: requireText(spec.sourceId, "META_TRANSACTION_SOURCE_ID_REQUIRED"),
    sourcePolicyVersion: requireText(
      spec.sourcePolicyVersion,
      "META_TRANSACTION_SOURCE_POLICY_VERSION_REQUIRED"
    ),
    sourceBinding: structuredClone(spec.sourceBinding ?? {}),
    choices
  };
}

async function opaqueId(state, context, purpose, counter, prefix) {
  return deriveRelicOfferOpaqueIdV08(
    state,
    context,
    `meta-transaction/${purpose}`,
    counter,
    prefix
  );
}

export async function issueMetaTransactionOfferV08(metaState, rawSpec, context = {}) {
  if (metaState.pendingInventory) {
    const current = metaState.pendingInventory;
    if (
      current.sourceType === rawSpec?.sourceType &&
      current.sourceId === rawSpec?.sourceId
    ) {
      return structuredClone(metaState);
    }
    throw new TypeError("META_TRANSACTION_OFFER_ALREADY_PENDING");
  }
  if (metaState.pendingRelicTransaction) {
    throw new TypeError("META_TRANSACTION_RELIC_REPLACEMENT_PENDING");
  }
  if (
    metaState.rulesetHash !== manifest.rulesetHash ||
    context.runId && context.runId !== metaState.runId ||
    context.rulesetHash && context.rulesetHash !== metaState.rulesetHash
  ) {
    throw new TypeError("META_TRANSACTION_ISSUE_BINDING_MISMATCH");
  }
  const spec = normalizeOfferSpec(rawSpec);
  const issuedStateDigest = await computeMetaTransactionStateDigestV08(
    metaState,
    context.cryptoProvider
  );
  const sourceInstanceId = await opaqueId(
    metaState,
    context,
    `${spec.sourceId}/source-id`,
    0,
    "meta_source"
  );
  const offerId = await opaqueId(
    metaState,
    context,
    `${spec.sourceId}/offer-id`,
    0,
    "meta_offer"
  );
  const choices = [];
  for (let index = 0; index < spec.choices.length; index += 1) {
    const choice = spec.choices[index];
    choices.push({
      transactionId: await opaqueId(
        metaState,
        context,
        `${spec.sourceId}/transaction-id`,
        index,
        "meta_tx"
      ),
      choiceId: await opaqueId(
        metaState,
        context,
        `${spec.sourceId}/choice-id`,
        index,
        "meta_choice"
      ),
      kind: choice.kind,
      label: choice.label,
      publicData: choice.publicData,
      privateData: choice.privateData,
      status: choice.status
    });
  }
  const next = structuredClone(metaState);
  next.pendingInventory = {
    policyVersion: META_TRANSACTION_POLICY_VERSION,
    sourcePolicyVersion: spec.sourcePolicyVersion,
    sourceType: spec.sourceType,
    sourceId: spec.sourceId,
    sourceInstanceId,
    offerId,
    runId: metaState.runId,
    rulesetHash: metaState.rulesetHash,
    issuedRevision: metaState.revision,
    issuedBuildDigest: metaState.build.buildDigest,
    issuedStateDigest,
    sourceBinding: spec.sourceBinding,
    choices
  };
  return next;
}

export function projectPublicMetaTransactionOfferV08(offer) {
  if (!offer) return null;
  assertPendingMetaTransactionOfferV08(offer);
  return {
    sourceType: offer.sourceType,
    sourceId: offer.sourceId,
    sourceInstanceId: offer.sourceInstanceId,
    offerId: offer.offerId,
    choices: offer.choices.map((choice) => ({
      transactionId: choice.transactionId,
      choiceId: choice.choiceId,
      kind: choice.kind,
      label: choice.label,
      status: choice.status,
      ...structuredClone(choice.publicData)
    }))
  };
}

function normalizeRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("META_TRANSACTION_REQUEST_INVALID");
  }
  for (const field of Object.keys(request)) {
    if (!["transactionId", "choiceId"].includes(field)) {
      throw new TypeError(`META_TRANSACTION_REQUEST_UNKNOWN_FIELD:${field}`);
    }
  }
  return {
    transactionId: requireText(
      request.transactionId,
      "META_TRANSACTION_ID_REQUIRED"
    ),
    choiceId: requireText(request.choiceId, "META_TRANSACTION_CHOICE_ID_REQUIRED")
  };
}

async function requestDigest(request, cryptoProvider) {
  return computeRelicOfferStateDigestV08({
    operation: "meta_transaction_commit",
    transactionId: request.transactionId,
    choiceId: request.choiceId
  }, cryptoProvider);
}

function findReceipt(state, transactionId) {
  return (state.metaTransactionReceipts || []).find(
    (entry) => entry.transactionId === transactionId
  ) || null;
}

function validateContextBinding(metaState, offer, context) {
  if (
    offer.runId !== metaState.runId ||
    offer.rulesetHash !== metaState.rulesetHash ||
    offer.rulesetHash !== manifest.rulesetHash ||
    context.runId && context.runId !== metaState.runId ||
    context.rulesetHash && context.rulesetHash !== metaState.rulesetHash
  ) {
    throw new TypeError("META_TRANSACTION_BINDING_MISMATCH");
  }
  if (offer.issuedRevision !== metaState.revision) {
    throw new TypeError("META_TRANSACTION_STALE_REVISION");
  }
  if (offer.issuedBuildDigest !== metaState.build.buildDigest) {
    throw new TypeError("META_TRANSACTION_STALE_BUILD_DIGEST");
  }
}

export async function preflightMetaTransactionV08(metaState, rawRequest, context = {}) {
  const request = normalizeRequest(rawRequest);
  const digest = await requestDigest(request, context.cryptoProvider);
  const prior = findReceipt(metaState, request.transactionId);
  if (prior) {
    if (prior.requestDigest !== digest) {
      throw new TypeError("META_TRANSACTION_IDEMPOTENCY_PAYLOAD_MISMATCH");
    }
    return { decision: "REPLAY", request, requestDigest: digest, receipt: prior };
  }
  const offer = metaState.pendingInventory;
  if (!offer) throw new TypeError("META_TRANSACTION_NOT_FOUND");
  validateContextBinding(metaState, offer, context);
  const actualStateDigest = await computeMetaTransactionStateDigestV08(
    metaState,
    context.cryptoProvider
  );
  if (offer.issuedStateDigest !== actualStateDigest) {
    throw new TypeError("META_TRANSACTION_STALE_STATE_DIGEST");
  }
  const choice = offer.choices.find(
    (entry) => entry.transactionId === request.transactionId
  );
  if (!choice) throw new TypeError("META_TRANSACTION_NOT_FOUND");
  if (choice.choiceId !== request.choiceId) {
    throw new TypeError("META_TRANSACTION_CHOICE_MISMATCH");
  }
  if (choice.status !== "available") {
    throw new TypeError("META_TRANSACTION_ALREADY_CONSUMED");
  }
  return {
    decision: "COMMIT",
    request,
    requestDigest: digest,
    offer: structuredClone(offer),
    choice: structuredClone(choice)
  };
}

function ensureLedgerFields(state) {
  state.campGold = requireAmount(state.campGold ?? 0, "CAMP_GOLD_INVALID");
  state.goldLedger.campEarnedServerDerived = requireAmount(
    state.goldLedger.campEarnedServerDerived ?? 0,
    "GOLD_LEDGER_INVALID:campEarnedServerDerived"
  );
  state.goldLedger.campSpentServerDerived = requireAmount(
    state.goldLedger.campSpentServerDerived ?? 0,
    "GOLD_LEDGER_INVALID:campSpentServerDerived"
  );
}

export function spendCanonicalGoldV08(state, amount, currency = "run_gold") {
  const cost = requireAmount(amount, "META_TRANSACTION_COST_INVALID");
  ensureLedgerFields(state);
  let runGold = 0;
  let campGold = 0;
  if (currency === "run_gold") {
    if (state.gold < cost) throw new TypeError("INSUFFICIENT_GOLD");
    runGold = cost;
  } else if (currency === "camp_gold") {
    if (state.campGold < cost) throw new TypeError("INSUFFICIENT_CAMP_GOLD");
    campGold = cost;
  } else if (currency === "run_then_camp") {
    if (state.gold + state.campGold < cost) throw new TypeError("INSUFFICIENT_GOLD");
    runGold = Math.min(state.gold, cost);
    campGold = cost - runGold;
  } else {
    throw new TypeError(`META_TRANSACTION_CURRENCY_UNKNOWN:${currency}`);
  }
  state.gold -= runGold;
  state.campGold -= campGold;
  state.goldLedger.spentServerDerived += runGold;
  state.goldLedger.campSpentServerDerived += campGold;
  state.goldLedger.lastDelta = 0;
  assertGoldLedgerV08(state);
  return { total: cost, runGold, campGold, currency };
}

export function awardCanonicalGoldV08(state, amount, currency = "run_gold") {
  const award = requireAmount(amount, "META_TRANSACTION_REWARD_INVALID");
  ensureLedgerFields(state);
  if (currency === "run_gold") {
    state.gold += award;
    state.goldLedger.earnedServerDerived += award;
    state.goldLedger.lastDelta = award;
  } else if (currency === "camp_gold") {
    state.campGold += award;
    state.goldLedger.campEarnedServerDerived += award;
  } else {
    throw new TypeError(`META_TRANSACTION_CURRENCY_UNKNOWN:${currency}`);
  }
  assertGoldLedgerV08(state);
  return { total: award, currency };
}

export function consumeCanonicalMetaSourceV08(
  state,
  sourceType,
  sourceId,
  sourceInstanceId
) {
  const type = requireText(sourceType, "META_SOURCE_TYPE_REQUIRED");
  const id = requireText(sourceId, "META_SOURCE_ID_REQUIRED");
  const instanceId = requireText(sourceInstanceId, "META_SOURCE_INSTANCE_REQUIRED");
  const entries = Array.isArray(state.metaSourceConsumptions)
    ? state.metaSourceConsumptions
    : [];
  if (entries.some((entry) => entry.sourceInstanceId === instanceId)) {
    throw new TypeError("META_SOURCE_ALREADY_CONSUMED");
  }
  state.metaSourceConsumptions = [
    ...entries,
    {
      sourceType: type,
      sourceId: id,
      sourceInstanceId: instanceId,
      consumedRevision: state.revision
    }
  ].slice(-64);
  return state;
}

export function isCanonicalMetaSourceConsumedV08(state, sourceInstanceId) {
  const instanceId = requireText(sourceInstanceId, "META_SOURCE_INSTANCE_REQUIRED");
  return (state.metaSourceConsumptions || []).some(
    (entry) => entry.sourceInstanceId === instanceId
  );
}

function validateEvaluatorResult(result, metaState) {
  if (!result || typeof result !== "object" || !result.nextState) {
    throw new TypeError("META_TRANSACTION_EVALUATOR_RESULT_INVALID");
  }
  const next = result.nextState;
  if (
    next.runId !== metaState.runId ||
    next.rulesetHash !== metaState.rulesetHash ||
    next.revision !== metaState.revision
  ) {
    throw new TypeError("META_TRANSACTION_EVALUATOR_BINDING_CHANGED");
  }
  return {
    next,
    consumeOffer: result.consumeOffer !== false,
    publicResult: structuredClone(result.publicResult ?? {}),
    authoritativeCost: structuredClone(result.authoritativeCost ?? null),
    authoritativeReward: structuredClone(result.authoritativeReward ?? null)
  };
}

export async function commitMetaTransactionV08(
  metaState,
  request,
  evaluator,
  context = {}
) {
  if (typeof evaluator !== "function") {
    throw new TypeError("META_TRANSACTION_EVALUATOR_REQUIRED");
  }
  const preflight = await preflightMetaTransactionV08(metaState, request, context);
  if (preflight.decision === "REPLAY") return structuredClone(metaState);
  const working = structuredClone(metaState);
  const result = validateEvaluatorResult(await evaluator({
    state: working,
    offer: preflight.offer,
    choice: preflight.choice,
    context
  }), metaState);
  const next = result.next;
  const mutableOffer = next.pendingInventory;
  if (
    !mutableOffer ||
    mutableOffer.offerId !== preflight.offer.offerId ||
    mutableOffer.sourceInstanceId !== preflight.offer.sourceInstanceId
  ) {
    throw new TypeError("META_TRANSACTION_SOURCE_CHANGED_DURING_EVALUATION");
  }
  const mutableChoice = mutableOffer.choices.find(
    (entry) => entry.transactionId === preflight.request.transactionId
  );
  if (!mutableChoice || mutableChoice.status !== "available") {
    throw new TypeError("META_TRANSACTION_CHOICE_CHANGED_DURING_EVALUATION");
  }
  mutableChoice.status = "sold";
  if (result.consumeOffer) {
    next.pendingInventory = null;
  } else {
    mutableOffer.issuedBuildDigest = next.build.buildDigest;
    mutableOffer.issuedStateDigest = await computeMetaTransactionStateDigestV08(
      next,
      context.cryptoProvider
    );
  }
  const resultingStateDigest = await computeMetaTransactionStateDigestV08(
    next,
    context.cryptoProvider
  );
  const receipt = {
    policyVersion: META_TRANSACTION_POLICY_VERSION,
    transactionId: preflight.request.transactionId,
    choiceId: preflight.request.choiceId,
    requestDigest: preflight.requestDigest,
    resultingStateDigest,
    sourceType: preflight.offer.sourceType,
    sourceId: preflight.offer.sourceId,
    sourceInstanceId: preflight.offer.sourceInstanceId,
    offerId: preflight.offer.offerId,
    kind: preflight.choice.kind,
    completedRevision: next.revision,
    authoritativeCost: result.authoritativeCost,
    authoritativeReward: result.authoritativeReward,
    publicResult: result.publicResult
  };
  next.metaTransactionReceipts = [
    ...(next.metaTransactionReceipts || []),
    receipt
  ].slice(-META_TRANSACTION_RECEIPT_LIMIT);
  next.updatedAt = next.startedAt + next.revision;
  assertGoldLedgerV08(next);
  return next;
}

export function assertPendingMetaTransactionOfferV08(offer) {
  if (offer === null) return offer;
  if (!offer || typeof offer !== "object" || !Array.isArray(offer.choices)) {
    throw new TypeError("META_TRANSACTION_OFFER_INVALID");
  }
  for (const field of [
    "policyVersion",
    "sourcePolicyVersion",
    "sourceType",
    "sourceId",
    "sourceInstanceId",
    "offerId",
    "runId",
    "rulesetHash",
    "issuedStateDigest",
    "issuedBuildDigest"
  ]) {
    requireText(offer[field], `META_TRANSACTION_OFFER_INVALID:${field}`);
  }
  if (!Number.isSafeInteger(offer.issuedRevision) || offer.issuedRevision < 0) {
    throw new TypeError("META_TRANSACTION_OFFER_INVALID:issuedRevision");
  }
  if (offer.choices.length < 1 || offer.choices.length > 64) {
    throw new TypeError("META_TRANSACTION_OFFER_INVALID:choices");
  }
  const transactions = new Set();
  const choices = new Set();
  for (const choice of offer.choices) {
    for (const field of ["transactionId", "choiceId", "kind", "label"]) {
      requireText(choice[field], `META_TRANSACTION_CHOICE_INVALID:${field}`);
    }
    if (transactions.has(choice.transactionId) || choices.has(choice.choiceId)) {
      throw new TypeError("META_TRANSACTION_CHOICE_ID_DUPLICATE");
    }
    transactions.add(choice.transactionId);
    choices.add(choice.choiceId);
    if (!["available", "locked", "sold"].includes(choice.status)) {
      throw new TypeError("META_TRANSACTION_CHOICE_STATUS_INVALID");
    }
  }
  return offer;
}

export function assertMetaTransactionReceiptsV08(receipts) {
  if (!Array.isArray(receipts) || receipts.length > META_TRANSACTION_RECEIPT_LIMIT) {
    throw new TypeError("META_TRANSACTION_RECEIPTS_INVALID");
  }
  for (const receipt of receipts) {
    for (const field of [
      "transactionId",
      "choiceId",
      "requestDigest",
      "resultingStateDigest",
      "sourceType",
      "sourceId",
      "sourceInstanceId",
      "offerId",
      "kind"
    ]) {
      requireText(receipt?.[field], `META_TRANSACTION_RECEIPT_INVALID:${field}`);
    }
  }
  return receipts;
}
