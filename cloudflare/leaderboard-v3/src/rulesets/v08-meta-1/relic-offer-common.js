import { deriveRandomBytes } from "./rng.js";
import { previewRelicIncomingV08 } from "./relic-policy.js";

export const RELIC_OFFER_HISTORY_LIMIT = 64;

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function computeRelicOfferStateDigestV08(value, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.subtle) throw new TypeError("CRYPTO_PROVIDER_REQUIRED");
  const digest = await cryptoProvider.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(value))
  );
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}

export async function deriveRelicOfferOpaqueIdV08(
  state,
  context,
  purpose,
  counter,
  prefix
) {
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

export function projectPublicRelicChoiceV08(build, choice) {
  if (!choice || typeof choice !== "object") throw new TypeError("RELIC_OFFER_CHOICE_INVALID");
  const choiceId = String(choice.choiceId || "").trim();
  const relicId = String(choice.privateRelicId || "").trim();
  if (!choiceId) throw new TypeError("RELIC_OFFER_CHOICE_ID_INVALID");
  const preview = previewRelicIncomingV08(build, relicId);
  return {
    choiceId,
    relicId: preview.relicId,
    rarity: preview.rarity,
    currentStacks: preview.currentStacks,
    resultingStacks: preview.resultingStacks,
    slotCost: preview.slotCost,
    resultingSlotsUsed: preview.resultingSlotsUsed,
    resultingSlotLimit: preview.resultingSlotLimit
  };
}

export function assertPublicRelicChoiceV08(choice) {
  const fields = [
    "choiceId",
    "relicId",
    "rarity",
    "currentStacks",
    "resultingStacks",
    "slotCost",
    "resultingSlotsUsed",
    "resultingSlotLimit"
  ];
  if (
    !choice ||
    Object.keys(choice).sort().join(",") !== fields.sort().join(",")
  ) {
    throw new TypeError("RELIC_OFFER_PUBLIC_CHOICE_INVALID");
  }
  for (const field of ["choiceId", "relicId", "rarity"]) {
    if (!String(choice[field] || "").trim()) {
      throw new TypeError(`RELIC_OFFER_PUBLIC_CHOICE_INVALID:${field}`);
    }
  }
  for (const field of [
    "currentStacks",
    "resultingStacks",
    "slotCost",
    "resultingSlotsUsed",
    "resultingSlotLimit"
  ]) {
    if (!Number.isSafeInteger(choice[field]) || choice[field] < 0) {
      throw new TypeError(`RELIC_OFFER_PUBLIC_CHOICE_INVALID:${field}`);
    }
  }
  return choice;
}

export function assertRelicSelectionRequestV08(request, options = {}) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("RELIC_OFFER_SELECTION_REQUEST_INVALID");
  }
  const allowed = new Set(["offerId", "choiceId"]);
  if (options.allowBindingFields) {
    allowed.add("runId");
    allowed.add("rulesetHash");
  }
  for (const field of Object.keys(request)) {
    if (!allowed.has(field)) {
      throw new TypeError(`RELIC_OFFER_SELECTION_UNKNOWN_FIELD:${field}`);
    }
  }
  const offerId = String(request.offerId || "").trim();
  const choiceId = String(request.choiceId || "").trim();
  if (!offerId) throw new TypeError("RELIC_OFFER_SELECTION_OFFER_ID_REQUIRED");
  if (!choiceId) throw new TypeError("RELIC_OFFER_SELECTION_CHOICE_ID_REQUIRED");
  return { offerId, choiceId };
}

export function findRelicOfferReceiptV08(state, offerId) {
  return (state.offerSettlementHistory || []).find(
    (entry) => entry.offerId === offerId
  ) || null;
}

export function appendRelicOfferReceiptV08(state, receipt) {
  state.offerSettlementHistory = [
    ...(state.offerSettlementHistory || []),
    receipt
  ].slice(-RELIC_OFFER_HISTORY_LIMIT);
  return state;
}
