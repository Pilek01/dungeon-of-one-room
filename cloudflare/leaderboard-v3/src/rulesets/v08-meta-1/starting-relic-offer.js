import manifest from "./data/ruleset-manifest.json" with { type: "json" };
import startingPolicyDocument from "./data/starting-relic-policy.generated.json" with { type: "json" };
import { assertMetaStateV08, cloneMetaStateV08 } from "./meta-state.js";
import {
  applyRelicAcquisition,
  assertCanonicalRelicBuildDigestV08,
  projectPublicBuild
} from "./relic-policy.js";
import { deriveRandomBytes } from "./rng.js";

const policy = startingPolicyDocument.canonicalData;
const HISTORY_LIMIT = 64;

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.subtle) throw new TypeError("CRYPTO_PROVIDER_REQUIRED");
  const digest = await cryptoProvider.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(value))
  );
  return `sha256:${Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("")}`;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function opaqueId(state, context, purpose, counter, prefix) {
  const derive = context.randomOracle?.deriveRandomBytes
    ? context.randomOracle.deriveRandomBytes.bind(context.randomOracle)
    : deriveRandomBytes;
  const bytes = await derive({
    secret: context.secret,
    rulesetId: state.rulesetId,
    runId: state.runId,
    revision: state.revision,
    purpose,
    counter,
    length: 16,
    cryptoProvider: context.cryptoProvider
  });
  return `${prefix}_${bytesToHex(bytes)}`;
}

export async function issueStartingRelicOfferV08(state, context = {}) {
  assertMetaStateV08(state);
  await assertCanonicalRelicBuildDigestV08(state.build, context.cryptoProvider);
  if (state.status !== "awaiting_starting_relic") throw new TypeError("STARTING_RELIC_STATUS_INVALID");
  if (state.currentRoomDirective) throw new TypeError("STARTING_RELIC_ROOM_ALREADY_ISSUED");
  if (state.pendingOffer) return cloneMetaStateV08(state);
  const offerId = await opaqueId(state, context, "starting-relic/offer-id", 0, "offer");
  const choices = [];
  for (let index = 0; index < policy.startingRelicIds.length; index += 1) {
    choices.push({
      choiceId: await opaqueId(state, context, "starting-relic/choice-id", index, "choice"),
      privateRelicId: policy.startingRelicIds[index]
    });
  }
  const offer = {
    offerId,
    offerType: "starting_relic",
    runId: state.runId,
    rulesetHash: state.rulesetHash,
    issuedRevision: state.revision,
    sourceType: policy.sourceType,
    sourceId: policy.sourceId,
    choices,
    publicChoices: choices.map(({ choiceId }) => ({ choiceId })),
    issuedStateDigest: await sha256({
      runId: state.runId,
      rulesetHash: state.rulesetHash,
      revision: state.revision,
      status: state.status,
      buildDigest: state.build.buildDigest
    }, context.cryptoProvider),
    expiresOnRevision: state.revision,
    consumed: false,
    consumedChoiceId: null,
    consumedAtRevision: null
  };
  assertStartingRelicOfferV08(offer);
  const next = cloneMetaStateV08(state);
  next.pendingOffer = offer;
  return next;
}

function findReceipt(state, offerId) {
  return (state.offerSettlementHistory || []).find((entry) => entry.offerId === offerId) || null;
}

export function assertStartingRelicOfferV08(offer) {
  if (!offer || typeof offer !== "object") throw new TypeError("STARTING_RELIC_OFFER_INVALID");
  if (offer.offerType !== "starting_relic") throw new TypeError("STARTING_RELIC_OFFER_TYPE_INVALID");
  for (const field of [
    "offerId",
    "runId",
    "rulesetHash",
    "sourceType",
    "sourceId",
    "issuedStateDigest"
  ]) {
    if (!String(offer[field] || "").trim()) {
      throw new TypeError(`STARTING_RELIC_OFFER_INVALID:${field}`);
    }
  }
  for (const field of ["issuedRevision", "expiresOnRevision"]) {
    if (!Number.isSafeInteger(offer[field]) || offer[field] < 0) {
      throw new TypeError(`STARTING_RELIC_OFFER_INVALID:${field}`);
    }
  }
  if (!Array.isArray(offer.choices) || offer.choices.length !== policy.choiceCount) {
    throw new TypeError("STARTING_RELIC_OFFER_CHOICES_INVALID");
  }
  if (!Array.isArray(offer.publicChoices) || offer.publicChoices.length !== policy.choiceCount) {
    throw new TypeError("STARTING_RELIC_PUBLIC_CHOICES_INVALID");
  }
  const choiceIds = new Set();
  for (let index = 0; index < offer.choices.length; index += 1) {
    const choice = offer.choices[index];
    const publicChoice = offer.publicChoices[index];
    if (!choice || Object.keys(choice).sort().join(",") !== "choiceId,privateRelicId") {
      throw new TypeError("STARTING_RELIC_PRIVATE_CHOICE_INVALID");
    }
    if (!String(choice.choiceId || "").trim() || choiceIds.has(choice.choiceId)) {
      throw new TypeError("STARTING_RELIC_CHOICE_ID_INVALID");
    }
    if (choice.privateRelicId !== policy.startingRelicIds[index]) {
      throw new TypeError("STARTING_RELIC_PRIVATE_CHOICE_INVALID");
    }
    if (
      !publicChoice ||
      Object.keys(publicChoice).length !== 1 ||
      publicChoice.choiceId !== choice.choiceId
    ) {
      throw new TypeError("STARTING_RELIC_PUBLIC_CHOICE_INVALID");
    }
    choiceIds.add(choice.choiceId);
  }
  if (typeof offer.consumed !== "boolean") {
    throw new TypeError("STARTING_RELIC_OFFER_CONSUMED_INVALID");
  }
  if (offer.consumed) {
    if (!choiceIds.has(offer.consumedChoiceId)) {
      throw new TypeError("STARTING_RELIC_OFFER_CONSUMED_CHOICE_INVALID");
    }
    if (!Number.isSafeInteger(offer.consumedAtRevision) || offer.consumedAtRevision < 0) {
      throw new TypeError("STARTING_RELIC_OFFER_CONSUMED_REVISION_INVALID");
    }
  } else if (offer.consumedChoiceId !== null || offer.consumedAtRevision !== null) {
    throw new TypeError("STARTING_RELIC_OFFER_UNCONSUMED_FIELDS_INVALID");
  }
  return offer;
}

export async function selectStartingRelic(metaState, request = {}, context = {}) {
  assertMetaStateV08(metaState);
  await assertCanonicalRelicBuildDigestV08(metaState.build, context.cryptoProvider);
  const offerId = String(request.offerId || "");
  const choiceId = String(request.choiceId || "");
  const receipt = findReceipt(metaState, offerId);
  if (receipt) {
    if (request.runId && request.runId !== metaState.runId) {
      throw new TypeError("STARTING_RELIC_OFFER_RUN_MISMATCH");
    }
    if (request.rulesetHash && request.rulesetHash !== metaState.rulesetHash) {
      throw new TypeError("STARTING_RELIC_OFFER_RULESET_MISMATCH");
    }
    if (receipt.choiceId !== choiceId) {
      throw new TypeError("STARTING_RELIC_OFFER_ALREADY_CONSUMED_DIFFERENT_CHOICE");
    }
    return cloneMetaStateV08(metaState);
  }
  if (metaState.status !== "awaiting_starting_relic") {
    throw new TypeError("STARTING_RELIC_STATUS_INVALID");
  }
  const offer = metaState.pendingOffer;
  if (!offer || offer.offerId !== offerId) throw new TypeError("STARTING_RELIC_OFFER_UNKNOWN");
  assertStartingRelicOfferV08(offer);
  if (offer.runId !== metaState.runId || request.runId && request.runId !== metaState.runId) {
    throw new TypeError("STARTING_RELIC_OFFER_RUN_MISMATCH");
  }
  if (offer.rulesetHash !== metaState.rulesetHash || request.rulesetHash && request.rulesetHash !== manifest.rulesetHash) {
    throw new TypeError("STARTING_RELIC_OFFER_RULESET_MISMATCH");
  }
  if (offer.consumed) throw new TypeError("STARTING_RELIC_OFFER_ALREADY_CONSUMED");
  if (metaState.revision !== offer.issuedRevision || metaState.revision !== offer.expiresOnRevision) {
    throw new TypeError("STARTING_RELIC_OFFER_STALE");
  }
  const choice = offer.choices.find((entry) => entry.choiceId === choiceId);
  if (!choice) throw new TypeError("STARTING_RELIC_CHOICE_UNKNOWN");
  if (!policy.startingRelicIds.includes(choice.privateRelicId)) {
    throw new TypeError("STARTING_RELIC_PRIVATE_CHOICE_INVALID");
  }

  const next = cloneMetaStateV08(metaState);
  next.build = await applyRelicAcquisition(next.build, {
    relicId: choice.privateRelicId,
    acquiredRevision: next.revision,
    acquisitionSource: "starting_relic",
    sourceOfferId: offer.offerId
  }, context);
  next.revision += 1;
  next.status = "active";
  next.pendingOffer = null;
  next.offerSettlementHistory = [
    ...(next.offerSettlementHistory || []),
    {
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
    }
  ].slice(-HISTORY_LIMIT);
  next.updatedAt = next.startedAt + next.revision;
  return next;
}

export function projectPublicStartingRelicOfferV08(offer) {
  assertStartingRelicOfferV08(offer);
  const {
    choices: _privateChoices,
    ...publicOffer
  } = offer;
  return structuredClone(publicOffer);
}

export const V08_STARTING_RELIC_POLICY = policy;
