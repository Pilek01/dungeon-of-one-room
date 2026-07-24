import catalogDocument from "./data/relic-catalog.generated.json" with { type: "json" };
import pityPolicyDocument from "./data/relic-pity-policy.generated.json" with { type: "json" };
import rarityPolicyDocument from "./data/relic-rarity-policy.generated.json" with { type: "json" };
import regularPolicyDocument from "./data/regular-relic-offer-policy.generated.json" with { type: "json" };
import { assertMetaStateV08, cloneMetaStateV08 } from "./meta-state.js";
import {
  applyRelicAcquisition,
  assertCanonicalRelicBuildDigestV08,
  canAcquireRelic,
  projectPublicBuild
} from "./relic-policy.js";
import {
  appendRelicOfferReceiptV08,
  assertPublicRelicChoiceV08,
  assertRelicSelectionRequestV08,
  computeRelicOfferStateDigestV08,
  deriveRelicOfferOpaqueIdV08,
  findRelicOfferReceiptV08,
  projectPublicRelicChoiceV08
} from "./relic-offer-common.js";
import { assertRoomRewardEnvelopeV3 } from "./reward-policy.js";
import { deriveIntInclusive } from "./rng.js";

const catalog = catalogDocument.canonicalData;
const pityPolicy = pityPolicyDocument.canonicalData;
const rarityPolicy = rarityPolicyDocument.canonicalData;
const policy = regularPolicyDocument.canonicalData;
const ONE_MILLION = 1_000_000;
const wardenPity = pityPolicy.implemented.find(
  (entry) => entry.sourceId === policy.implementedSourceId
);

function requireIssueRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("RELIC_REWARD_ISSUE_REQUEST_INVALID");
  }
  const fields = ["rewardEnvelopeId", "rewardSlotId", "sourceDirectiveId"];
  for (const field of Object.keys(request)) {
    if (!fields.includes(field)) {
      throw new TypeError(`RELIC_REWARD_ISSUE_UNKNOWN_FIELD:${field}`);
    }
  }
  const normalized = {};
  for (const field of fields) {
    normalized[field] = String(request[field] || "").trim();
    if (!normalized[field]) throw new TypeError(`RELIC_REWARD_ISSUE_REQUIRED:${field}`);
  }
  return normalized;
}

function requireRandomOracle(state, context) {
  const oracle = context.randomOracle || { deriveIntInclusive };
  if (typeof oracle.deriveIntInclusive !== "function") {
    throw new TypeError("RULESET_RANDOM_ORACLE_INVALID");
  }
  return {
    oracle,
    base: {
      secret: context.secret,
      rulesetId: state.rulesetId,
      runId: state.runId,
      revision: state.revision,
      cryptoProvider: context.cryptoProvider
    }
  };
}

async function randomInt(state, context, minimum, maximum, purpose, counter) {
  const resolved = requireRandomOracle(state, context);
  return resolved.oracle.deriveIntInclusive(minimum, maximum, {
    ...resolved.base,
    purpose,
    counter
  });
}

function rarityTierForDepth(depth) {
  return rarityPolicy.rarityTiers.find(
    (entry) => depth >= entry.minDepth && depth <= entry.maxDepth
  ) || null;
}

function unlockedRarities(tier) {
  const result = new Set(
    Object.entries(tier.rarityWeights)
      .filter(([, weight]) => Number(weight) > 0)
      .map(([rarity]) => rarity)
  );
  if (tier.mythicEligible) result.add("mythic");
  return result;
}

async function rollWardenDrop(state, context, tier, slotId) {
  const missStreak = Math.max(
    0,
    Number(state.relicOfferState.sourceSpecificCounters.wardenDropMissStreak) || 0
  );
  const hardPity = missStreak >= wardenPity.hardPityAfterMisses;
  const chance = hardPity
    ? 1
    : Math.min(
        wardenPity.chanceCapBeforeHardPity,
        tier.dropChance + missStreak * wardenPity.bonusPerMiss
      );
  const roll = await randomInt(
    state,
    context,
    0,
    ONE_MILLION - 1,
    "relic-offer-drop",
    Number.parseInt(slotId.slice(-8), 16) || 0
  );
  return {
    hit: hardPity || roll < Math.round(chance * ONE_MILLION),
    missStreak,
    hardPity,
    chance
  };
}

async function rollRarity(state, context, tier, counter) {
  const legendaryWeight = Math.max(0, Number(tier.rarityWeights.legendary) || 0);
  const mythicChance = Math.min(
    rarityPolicy.mythicChanceMaximum,
    legendaryWeight * rarityPolicy.mythicRelativeToLegendaryChance
  );
  const roll = await randomInt(
    state,
    context,
    0,
    ONE_MILLION - 1,
    "relic-offer-rarity",
    counter
  );
  const mythicUnits = Math.round(mythicChance * ONE_MILLION);
  if (roll < mythicUnits) return "mythic";
  const normalized = mythicUnits < ONE_MILLION
    ? (roll - mythicUnits) / (ONE_MILLION - mythicUnits)
    : 0;
  let cumulative = 0;
  for (const rarity of rarityPolicy.rarityOrder) {
    cumulative += Number(tier.rarityWeights[rarity]) || 0;
    if (normalized < cumulative) return rarity;
  }
  return "normal";
}

function candidatePool(state, tier) {
  const allowedRarities = unlockedRarities(tier);
  return catalog.relics.filter((relic) => (
    allowedRarities.has(relic.rarity) &&
    relic.acquisitionSources.includes("boss_drop") &&
    canAcquireRelic(state.build, relic.relicId).allowed
  ));
}

export function getRegularRelicCandidatePoolV08(state, depth) {
  const tier = rarityTierForDepth(depth);
  if (!tier) return [];
  return candidatePool(state, tier).map((entry) => entry.relicId);
}

async function chooseRelics(state, context, tier) {
  const pool = candidatePool(state, tier);
  if (pool.length === 0) throw new TypeError(policy.emptyPoolBehavior);
  const selected = [];
  const used = new Set();
  for (let index = 0; index < policy.offerChoiceCount; index += 1) {
    const rarity = await rollRarity(state, context, tier, index);
    let candidates = pool.filter(
      (entry) => entry.rarity === rarity && !used.has(entry.relicId)
    );
    if (candidates.length === 0) {
      candidates = pool.filter((entry) => !used.has(entry.relicId));
    }
    if (candidates.length === 0) break;
    const selectedIndex = await randomInt(
      state,
      context,
      0,
      candidates.length - 1,
      "relic-offer-candidate",
      index
    );
    const selectedRelic = candidates[selectedIndex];
    selected.push(selectedRelic);
    used.add(selectedRelic.relicId);
  }
  for (let index = selected.length - 1; index > 0; index -= 1) {
    const swapIndex = await randomInt(
      state,
      context,
      0,
      index,
      "relic-offer-choice-order",
      selected.length - 1 - index
    );
    [selected[index], selected[swapIndex]] = [selected[swapIndex], selected[index]];
  }
  return { pool, selected };
}

function findRewardSlot(state, request) {
  const directive = state.currentRoomDirective;
  if (!directive || typeof directive !== "object") {
    throw new TypeError("RELIC_REWARD_DIRECTIVE_REQUIRED");
  }
  const envelope = assertRoomRewardEnvelopeV3(state.currentRewardEnvelope);
  if (request.rewardEnvelopeId !== envelope.envelopeId) {
    throw new TypeError("RELIC_REWARD_ENVELOPE_ID_MISMATCH");
  }
  if (request.sourceDirectiveId !== directive?.directiveId) {
    throw new TypeError("RELIC_REWARD_DIRECTIVE_MISMATCH");
  }
  if (envelope.runId !== state.runId) throw new TypeError("RELIC_REWARD_ENVELOPE_RUN_MISMATCH");
  if (envelope.rulesetHash !== state.rulesetHash) throw new TypeError("RELIC_REWARD_RULESET_MISMATCH");
  if (envelope.revision !== state.revision || directive.revision !== state.revision) {
    throw new TypeError("RELIC_REWARD_ENVELOPE_STALE");
  }
  if (envelope.directiveId !== directive.directiveId) {
    throw new TypeError("RELIC_REWARD_DIRECTIVE_MISMATCH");
  }
  if (envelope.consumed) throw new TypeError("RELIC_REWARD_ENVELOPE_CONSUMED");
  const slot = envelope.rewardSlots.find((entry) => entry.slotId === request.rewardSlotId);
  if (!slot) throw new TypeError("RELIC_REWARD_SLOT_UNKNOWN");
  if (
    slot.slotType !== policy.rewardSlotType ||
    slot.sourceType !== policy.sourceType ||
    slot.sourceId !== policy.implementedSourceId
  ) {
    throw new TypeError("RELIC_REWARD_SOURCE_MISMATCH");
  }
  return { directive, envelope, slot };
}

function offerDigestInput(state, binding) {
  return {
    runId: state.runId,
    rulesetHash: state.rulesetHash,
    revision: state.revision,
    sourceDirectiveId: binding.directive.directiveId,
    rewardEnvelopeId: binding.envelope.envelopeId,
    rewardSlotId: binding.slot.slotId,
    sourceType: binding.slot.sourceType,
    sourceId: binding.slot.sourceId,
    buildDigest: state.build.buildDigest
  };
}

export async function issueRegularRelicOffer(metaState, rawRequest = {}, context = {}) {
  assertMetaStateV08(metaState);
  await assertCanonicalRelicBuildDigestV08(metaState.build, context.cryptoProvider);
  if (metaState.status !== "active") throw new TypeError("RUN_NOT_ACTIVE");
  const request = requireIssueRequest(rawRequest);
  const binding = findRewardSlot(metaState, request);
  if (binding.slot.offerId) {
    if (
      metaState.pendingOffer?.offerType === "relic_reward" &&
      metaState.pendingOffer.offerId === binding.slot.offerId
    ) {
      return cloneMetaStateV08(metaState);
    }
    throw new TypeError("RELIC_REWARD_SLOT_ALREADY_ISSUED");
  }
  if (binding.slot.consumed && binding.slot.resolution === "no_drop") {
    return cloneMetaStateV08(metaState);
  }
  if (binding.slot.consumed) throw new TypeError("RELIC_REWARD_SLOT_ALREADY_CONSUMED");
  if (metaState.pendingOffer) throw new TypeError("RELIC_REWARD_PENDING_OFFER_EXISTS");

  const tier = rarityTierForDepth(binding.directive.depth);
  if (!tier) throw new TypeError("RELIC_REWARD_SOURCE_DEPTH_INVALID");
  const drop = await rollWardenDrop(metaState, context, tier, binding.slot.slotId);
  const next = cloneMetaStateV08(metaState);
  const mutableSlot = next.currentRewardEnvelope.rewardSlots.find(
    (entry) => entry.slotId === binding.slot.slotId
  );
  if (!drop.hit) {
    mutableSlot.consumed = true;
    mutableSlot.resolution = "no_drop";
    next.relicOfferState.sourceSpecificCounters.wardenDropMissStreak =
      drop.missStreak + 1;
    return next;
  }

  const { selected } = await chooseRelics(metaState, context, tier);
  const offerId = await deriveRelicOfferOpaqueIdV08(
    metaState,
    context,
    "relic-offer-offer-id",
    0,
    "offer"
  );
  const choices = [];
  for (let index = 0; index < selected.length; index += 1) {
    choices.push({
      choiceId: await deriveRelicOfferOpaqueIdV08(
        metaState,
        context,
        "relic-offer-choice-id",
        index,
        "choice"
      ),
      privateRelicId: selected[index].relicId
    });
  }
  const offer = {
    offerId,
    offerType: "relic_reward",
    runId: metaState.runId,
    rulesetHash: metaState.rulesetHash,
    issuedRevision: metaState.revision,
    sourceType: binding.slot.sourceType,
    sourceId: binding.slot.sourceId,
    sourceDirectiveId: binding.directive.directiveId,
    rewardEnvelopeId: binding.envelope.envelopeId,
    rewardSlotId: binding.slot.slotId,
    choices,
    publicChoices: choices.map((choice) =>
      projectPublicRelicChoiceV08(metaState.build, choice)
    ),
    issuedStateDigest: await computeRelicOfferStateDigestV08(
      offerDigestInput(metaState, binding),
      context.cryptoProvider
    ),
    expiresOnRevision: metaState.revision,
    consumed: false,
    consumedChoiceId: null,
    consumedAtRevision: null
  };
  assertRegularRelicOfferV08(offer);
  next.pendingOffer = offer;
  mutableSlot.offerId = offer.offerId;
  mutableSlot.resolution = "offer_issued";
  next.relicOfferState.sourceSpecificCounters.wardenDropMissStreak = 0;
  next.relicOfferState.offersIssuedBySource[offer.sourceId] =
    Math.max(0, Number(next.relicOfferState.offersIssuedBySource[offer.sourceId]) || 0) + 1;
  return next;
}

export function assertRegularRelicOfferV08(offer) {
  if (!offer || typeof offer !== "object") throw new TypeError("RELIC_REWARD_OFFER_INVALID");
  if (offer.offerType !== "relic_reward") throw new TypeError("RELIC_REWARD_OFFER_TYPE_INVALID");
  for (const field of [
    "offerId",
    "runId",
    "rulesetHash",
    "sourceType",
    "sourceId",
    "sourceDirectiveId",
    "rewardEnvelopeId",
    "rewardSlotId",
    "issuedStateDigest"
  ]) {
    if (!String(offer[field] || "").trim()) {
      throw new TypeError(`RELIC_REWARD_OFFER_INVALID:${field}`);
    }
  }
  for (const field of ["issuedRevision", "expiresOnRevision"]) {
    if (!Number.isSafeInteger(offer[field]) || offer[field] < 0) {
      throw new TypeError(`RELIC_REWARD_OFFER_INVALID:${field}`);
    }
  }
  if (
    !Array.isArray(offer.choices) ||
    offer.choices.length < 1 ||
    offer.choices.length > policy.offerChoiceCount ||
    !Array.isArray(offer.publicChoices) ||
    offer.publicChoices.length !== offer.choices.length
  ) {
    throw new TypeError("RELIC_REWARD_OFFER_CHOICES_INVALID");
  }
  const choiceIds = new Set();
  const relicIds = new Set();
  for (let index = 0; index < offer.choices.length; index += 1) {
    const choice = offer.choices[index];
    const publicChoice = offer.publicChoices[index];
    if (!choice || Object.keys(choice).sort().join(",") !== "choiceId,privateRelicId") {
      throw new TypeError("RELIC_REWARD_PRIVATE_CHOICE_INVALID");
    }
    if (
      !String(choice.choiceId || "").trim() ||
      choiceIds.has(choice.choiceId) ||
      relicIds.has(choice.privateRelicId)
    ) {
      throw new TypeError("RELIC_REWARD_CHOICE_DUPLICATE");
    }
    assertPublicRelicChoiceV08(publicChoice);
    if (
      publicChoice.choiceId !== choice.choiceId ||
      publicChoice.relicId !== choice.privateRelicId
    ) {
      throw new TypeError("RELIC_REWARD_PUBLIC_CHOICE_MISMATCH");
    }
    choiceIds.add(choice.choiceId);
    relicIds.add(choice.privateRelicId);
  }
  if (typeof offer.consumed !== "boolean") {
    throw new TypeError("RELIC_REWARD_OFFER_CONSUMED_INVALID");
  }
  if (offer.consumed) {
    if (!choiceIds.has(offer.consumedChoiceId)) {
      throw new TypeError("RELIC_REWARD_OFFER_CONSUMED_CHOICE_INVALID");
    }
    if (!Number.isSafeInteger(offer.consumedAtRevision) || offer.consumedAtRevision < 0) {
      throw new TypeError("RELIC_REWARD_OFFER_CONSUMED_REVISION_INVALID");
    }
  } else if (offer.consumedChoiceId !== null || offer.consumedAtRevision !== null) {
    throw new TypeError("RELIC_REWARD_OFFER_UNCONSUMED_FIELDS_INVALID");
  }
  return offer;
}

export async function selectRegularRelic(metaState, request = {}, context = {}) {
  assertMetaStateV08(metaState);
  await assertCanonicalRelicBuildDigestV08(metaState.build, context.cryptoProvider);
  const { offerId, choiceId } = assertRelicSelectionRequestV08(request);
  const receipt = findRelicOfferReceiptV08(metaState, offerId);
  if (receipt) {
    if (receipt.choiceId !== choiceId) {
      throw new TypeError("RELIC_REWARD_OFFER_ALREADY_CONSUMED_DIFFERENT_CHOICE");
    }
    return cloneMetaStateV08(metaState);
  }
  const offer = metaState.pendingOffer;
  if (!offer || offer.offerId !== offerId) throw new TypeError("RELIC_REWARD_OFFER_UNKNOWN");
  assertRegularRelicOfferV08(offer);
  if (offer.consumed) throw new TypeError("RELIC_REWARD_OFFER_ALREADY_CONSUMED");
  if (offer.runId !== metaState.runId) throw new TypeError("RELIC_REWARD_OFFER_RUN_MISMATCH");
  if (offer.rulesetHash !== metaState.rulesetHash) {
    throw new TypeError("RELIC_REWARD_OFFER_RULESET_MISMATCH");
  }
  if (offer.issuedRevision !== metaState.revision || offer.expiresOnRevision !== metaState.revision) {
    throw new TypeError("RELIC_REWARD_OFFER_STALE");
  }
  const binding = findRewardSlot(metaState, {
    rewardEnvelopeId: offer.rewardEnvelopeId,
    rewardSlotId: offer.rewardSlotId,
    sourceDirectiveId: offer.sourceDirectiveId
  });
  if (binding.slot.offerId !== offer.offerId || binding.slot.consumed) {
    throw new TypeError("RELIC_REWARD_SLOT_BINDING_INVALID");
  }
  const expectedDigest = await computeRelicOfferStateDigestV08(
    offerDigestInput(metaState, binding),
    context.cryptoProvider
  );
  if (offer.issuedStateDigest !== expectedDigest) {
    throw new TypeError("RELIC_REWARD_OFFER_STATE_DIGEST_MISMATCH");
  }
  const choice = offer.choices.find((entry) => entry.choiceId === choiceId);
  if (!choice) throw new TypeError("RELIC_REWARD_CHOICE_UNKNOWN");
  const verdict = canAcquireRelic(metaState.build, choice.privateRelicId);
  if (!verdict.allowed) throw new TypeError(verdict.code);

  const next = cloneMetaStateV08(metaState);
  next.build = await applyRelicAcquisition(next.build, {
    relicId: choice.privateRelicId,
    acquiredRevision: next.revision,
    acquisitionSource: "boss_drop",
    sourceOfferId: offer.offerId
  }, context);
  const mutableSlot = next.currentRewardEnvelope.rewardSlots.find(
    (entry) => entry.slotId === offer.rewardSlotId
  );
  mutableSlot.consumed = true;
  next.pendingOffer = null;
  appendRelicOfferReceiptV08(next, {
    offerId,
    choiceId,
    relicId: choice.privateRelicId,
    consumedAtRevision: next.revision,
    publicBuild: projectPublicBuild(next.build),
    offer: {
      ...offer,
      consumed: true,
      consumedChoiceId: choiceId,
      consumedAtRevision: next.revision
    }
  });
  next.updatedAt = next.startedAt + next.revision;
  return next;
}

export function projectPublicRegularRelicOfferV08(offer) {
  assertRegularRelicOfferV08(offer);
  const {
    choices: _privateChoices,
    issuedStateDigest: _privateDigest,
    ...publicOffer
  } = offer;
  return structuredClone(publicOffer);
}

export const V08_REGULAR_RELIC_OFFER_POLICY = Object.freeze({
  policy,
  rarityPolicy,
  pityPolicy
});
