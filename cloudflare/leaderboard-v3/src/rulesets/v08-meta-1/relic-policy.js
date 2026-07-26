import catalogDocument from "./data/relic-catalog.generated.json" with { type: "json" };
import buildMetadataDocument from "./data/relic-build-metadata.generated.json" with { type: "json" };
import slotPolicyDocument from "./data/relic-slot-policy.generated.json" with { type: "json" };

const catalog = catalogDocument.canonicalData;
const buildMetadata = buildMetadataDocument.canonicalData;
const slotPolicy = slotPolicyDocument.canonicalData;
const relicById = new Map(catalog.relics.map((entry) => [entry.relicId, entry]));

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
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await cryptoProvider.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("")}`;
}

function requireRelic(relicId) {
  const relic = relicById.get(String(relicId || ""));
  if (!relic) throw new TypeError(`RELIC_UNKNOWN:${String(relicId || "")}`);
  return relic;
}

function buildDigestInput(build) {
  return {
    relics: build.relics,
    relicSlotBase: build.relicSlotBase,
    relicSlotBonus: build.relicSlotBonus,
    relicSlotLimit: build.relicSlotLimit,
    relicSlotsUsed: build.relicSlotsUsed,
    uniqueRelicCount: build.uniqueRelicCount,
    totalRelicStacks: build.totalRelicStacks
  };
}

function summarizeRelics(relics) {
  let relicSlotBonus = 0;
  let relicSlotsUsed = 0;
  let totalRelicStacks = 0;
  for (const entry of relics) {
    const policy = requireRelic(entry.relicId);
    if (!Number.isSafeInteger(entry.stacks) || entry.stacks < 1 || entry.stacks > policy.maximumStacks) {
      throw new TypeError(`RELIC_STACKS_INVALID:${entry.relicId}`);
    }
    relicSlotBonus += policy.bonusRelicSlots;
    relicSlotsUsed += policy.slotCost * entry.stacks;
    totalRelicStacks += entry.stacks;
  }
  return {
    relicSlotBonus,
    relicSlotLimit: slotPolicy.baseRelicSlots + relicSlotBonus,
    relicSlotsUsed,
    uniqueRelicCount: relics.length,
    totalRelicStacks
  };
}

export function createEmptyRelicBuildV08() {
  return {
    relics: [],
    relicSlotBase: slotPolicy.baseRelicSlots,
    relicSlotBonus: 0,
    relicSlotLimit: slotPolicy.baseRelicSlots,
    relicSlotsUsed: 0,
    uniqueRelicCount: 0,
    totalRelicStacks: 0,
    buildDigest: "sha256:939e68a3048e9671285fd4fd2fde751111e3d8a7c27541272f3628d556a44ba7",
    pacts: [],
    campUpgrades: {},
    skillTiers: {},
    elixirs: [],
    resources: {
      potions: 3,
      maxPotions: 3,
      hp: 100,
      maxHp: 100,
      skillCooldowns: { dash: 0, aoe: 0, shield: 0 },
      combatBoostTurns: 0,
      combatBoostAttack: 0,
      combatBoostArmor: 0,
      hasSecondChance: false,
      highestUnlockedDepth: 0,
      turn: 0,
      crossroadsPowerMaxHpPenalty: 0,
      crossroadsPowerExpireTurn: -1
    },
    merchant: {
      potionsBought: 0,
      secondChancePurchases: 0,
      reservedRelic: null
    }
  };
}

export function getRelicCatalogEntryV08(relicId) {
  return structuredClone(requireRelic(relicId));
}

export function getRelicStackLimit(relicId) {
  return requireRelic(relicId).maximumStacks;
}

export function getRelicSlotCost(relicId) {
  return requireRelic(relicId).slotCost;
}

export function getRelicSlotLimit(build) {
  return summarizeRelics(Array.isArray(build?.relics) ? build.relics : []).relicSlotLimit;
}

export function canAcquireRelic(build, relicId) {
  const policy = requireRelic(relicId);
  const relics = Array.isArray(build?.relics) ? build.relics : [];
  const existing = relics.find((entry) => entry.relicId === relicId);
  if (existing && !policy.stackable) {
    return { allowed: false, code: `RELIC_UNIQUE_DUPLICATE:${relicId}` };
  }
  if (existing && existing.stacks >= policy.maximumStacks) {
    return { allowed: false, code: `RELIC_STACK_LIMIT_REACHED:${relicId}` };
  }
  const mythicCount = relics.filter((entry) => requireRelic(entry.relicId).mythic).length;
  if (policy.mythic && mythicCount >= slotPolicy.maximumMythicRelics) {
    return { allowed: false, code: "RELIC_MYTHIC_LIMIT_REACHED" };
  }
  const legendaryCount = relics.filter((entry) => requireRelic(entry.relicId).legendary).length;
  const legendaryLimit = relics.some((entry) => entry.relicId === slotPolicy.doubleLegendaryRelicId)
    || relicId === slotPolicy.doubleLegendaryRelicId
    ? slotPolicy.maximumLegendaryRelicsWithBonus
    : slotPolicy.maximumLegendaryRelics;
  if (policy.legendary && legendaryCount >= legendaryLimit) {
    return { allowed: false, code: "RELIC_LEGENDARY_LIMIT_REACHED" };
  }
  const mutuallyExclusiveRelic = relics.find((entry) =>
    policy.mutuallyExclusiveWith.includes(entry.relicId)
  );
  if (mutuallyExclusiveRelic) {
    return {
      allowed: false,
      code: `RELIC_MUTUALLY_EXCLUSIVE:${relicId}:${mutuallyExclusiveRelic.relicId}`
    };
  }
  const summary = summarizeRelics(relics);
  const incomingBonus = existing ? 0 : policy.bonusRelicSlots;
  const nextLimit = slotPolicy.baseRelicSlots + summary.relicSlotBonus + incomingBonus;
  if (summary.relicSlotsUsed + policy.slotCost > nextLimit) {
    return { allowed: false, code: "RELIC_SLOTS_FULL" };
  }
  return { allowed: true, code: null };
}

export function previewRelicAcquisitionV08(build, relicId) {
  const policy = requireRelic(relicId);
  const relics = Array.isArray(build?.relics) ? build.relics : [];
  const existing = relics.find((entry) => entry.relicId === relicId);
  const verdict = canAcquireRelic(build, relicId);
  if (!verdict.allowed) throw new TypeError(verdict.code);
  const summary = summarizeRelics(relics);
  const incomingBonus = existing ? 0 : policy.bonusRelicSlots;
  return {
    relicId: policy.relicId,
    rarity: policy.rarity,
    currentStacks: existing?.stacks || 0,
    resultingStacks: (existing?.stacks || 0) + 1,
    slotCost: policy.slotCost,
    resultingSlotsUsed: summary.relicSlotsUsed + policy.slotCost,
    resultingSlotLimit: slotPolicy.baseRelicSlots + summary.relicSlotBonus + incomingBonus
  };
}

export function previewRelicIncomingV08(build, relicId) {
  const policy = requireRelic(relicId);
  const relics = Array.isArray(build?.relics) ? build.relics : [];
  const existing = relics.find((entry) => entry.relicId === relicId);
  const summary = summarizeRelics(relics);
  const incomingBonus = existing ? 0 : policy.bonusRelicSlots;
  return {
    relicId: policy.relicId,
    rarity: policy.rarity,
    currentStacks: existing?.stacks || 0,
    resultingStacks: (existing?.stacks || 0) + 1,
    slotCost: policy.slotCost,
    resultingSlotsUsed: summary.relicSlotsUsed + policy.slotCost,
    resultingSlotLimit: slotPolicy.baseRelicSlots + summary.relicSlotBonus + incomingBonus
  };
}

export async function computeRelicBuildDigestV08(build, cryptoProvider = globalThis.crypto) {
  assertCanonicalRelicBuildV08(build);
  return sha256(buildDigestInput(build), cryptoProvider);
}

export async function assertCanonicalRelicBuildDigestV08(
  build,
  cryptoProvider = globalThis.crypto
) {
  const expected = await computeRelicBuildDigestV08(build, cryptoProvider);
  if (build.buildDigest !== expected) throw new TypeError("RELIC_BUILD_DIGEST_MISMATCH");
  return build;
}

export async function applyRelicAcquisition(build, acquisition, context = {}) {
  const relicId = String(acquisition?.relicId || "");
  const policy = requireRelic(relicId);
  const verdict = canAcquireRelic(build, relicId);
  if (!verdict.allowed) throw new TypeError(verdict.code);
  if (!Number.isSafeInteger(acquisition.acquiredRevision) || acquisition.acquiredRevision < 0) {
    throw new TypeError("RELIC_ACQUIRED_REVISION_INVALID");
  }
  const acquisitionSource = String(acquisition.acquisitionSource || "").trim();
  const sourceOfferId = String(acquisition.sourceOfferId || "").trim();
  if (!acquisitionSource) throw new TypeError("RELIC_ACQUISITION_SOURCE_REQUIRED");
  if (!sourceOfferId) throw new TypeError("RELIC_SOURCE_OFFER_REQUIRED");

  const next = structuredClone(build);
  const existing = next.relics.find((entry) => entry.relicId === relicId);
  if (existing) {
    existing.stacks += 1;
  } else {
    next.relics.push({
      relicId,
      stacks: 1,
      acquiredRevision: acquisition.acquiredRevision,
      acquisitionSource,
      sourceOfferId
    });
  }
  const summary = summarizeRelics(next.relics);
  Object.assign(next, {
    relicSlotBase: slotPolicy.baseRelicSlots,
    ...summary
  });
  next.buildDigest = await sha256(buildDigestInput(next), context.cryptoProvider);
  return next;
}

export async function applyRelicReplacementBuildV08(
  build,
  removals,
  acquisition,
  context = {}
) {
  if (!Array.isArray(removals) || removals.length < 1) {
    throw new TypeError("RELIC_REPLACEMENT_REMOVALS_REQUIRED");
  }
  const next = structuredClone(build);
  for (const removal of removals) {
    const relicId = String(removal?.relicId || "");
    const stacks = Number(removal?.stacks);
    if (!Number.isSafeInteger(stacks) || stacks < 1) {
      throw new TypeError("RELIC_REPLACEMENT_REMOVAL_STACKS_INVALID");
    }
    const entryIndex = next.relics.findIndex((entry) => entry.relicId === relicId);
    if (entryIndex < 0 || next.relics[entryIndex].stacks < stacks) {
      throw new TypeError("RELIC_REPLACEMENT_TARGET_CHANGED");
    }
    next.relics[entryIndex].stacks -= stacks;
    if (next.relics[entryIndex].stacks === 0) next.relics.splice(entryIndex, 1);
  }
  const relicId = String(acquisition?.relicId || "");
  const policy = requireRelic(relicId);
  const incomingStacks = Number(acquisition?.stacks ?? 1);
  if (!Number.isSafeInteger(incomingStacks) || incomingStacks !== 1) {
    throw new TypeError("RELIC_REPLACEMENT_INCOMING_STACKS_INVALID");
  }
  if (!Number.isSafeInteger(acquisition.acquiredRevision) || acquisition.acquiredRevision < 0) {
    throw new TypeError("RELIC_ACQUIRED_REVISION_INVALID");
  }
  const acquisitionSource = String(acquisition.acquisitionSource || "").trim();
  const sourceOfferId = String(acquisition.sourceOfferId || "").trim();
  if (!acquisitionSource) throw new TypeError("RELIC_ACQUISITION_SOURCE_REQUIRED");
  if (!sourceOfferId) throw new TypeError("RELIC_SOURCE_OFFER_REQUIRED");
  const existing = next.relics.find((entry) => entry.relicId === relicId);
  if (existing) {
    existing.stacks += incomingStacks;
  } else {
    next.relics.push({
      relicId: policy.relicId,
      stacks: incomingStacks,
      acquiredRevision: acquisition.acquiredRevision,
      acquisitionSource,
      sourceOfferId
    });
  }
  const summary = summarizeRelics(next.relics);
  Object.assign(next, {
    relicSlotBase: slotPolicy.baseRelicSlots,
    ...summary
  });
  next.buildDigest = await sha256(buildDigestInput(next), context.cryptoProvider);
  assertCanonicalRelicBuildV08(next);
  return next;
}

export async function applyRelicRemovalV08(build, removal, context = {}) {
  const relicId = String(removal?.relicId || "");
  const stacks = Number(removal?.stacks ?? 1);
  if (!Number.isSafeInteger(stacks) || stacks < 1) {
    throw new TypeError("RELIC_REMOVAL_STACKS_INVALID");
  }
  const next = structuredClone(build);
  const index = next.relics.findIndex((entry) => entry.relicId === relicId);
  if (index < 0 || next.relics[index].stacks < stacks) {
    throw new TypeError("RELIC_REMOVAL_TARGET_CHANGED");
  }
  next.relics[index].stacks -= stacks;
  if (next.relics[index].stacks === 0) next.relics.splice(index, 1);
  const summary = summarizeRelics(next.relics);
  Object.assign(next, {
    relicSlotBase: slotPolicy.baseRelicSlots,
    ...summary
  });
  next.buildDigest = await sha256(buildDigestInput(next), context.cryptoProvider);
  assertCanonicalRelicBuildV08(next);
  return next;
}

export function assertCanonicalRelicBuildV08(build) {
  if (!build || typeof build !== "object" || !Array.isArray(build.relics)) {
    throw new TypeError("RELIC_BUILD_INVALID");
  }
  if (Object.hasOwn(build, "mutators")) {
    throw new TypeError("RELIC_BUILD_MUTATORS_FORBIDDEN");
  }
  const seen = new Set();
  for (const entry of build.relics) {
    if (!entry || typeof entry !== "object") throw new TypeError("RELIC_BUILD_ENTRY_INVALID");
    const allowedFields = new Set([
      "relicId",
      "stacks",
      "acquiredRevision",
      "acquisitionSource",
      "sourceOfferId"
    ]);
    for (const field of Object.keys(entry)) {
      if (!allowedFields.has(field)) {
        throw new TypeError(`RELIC_BUILD_ENTRY_UNKNOWN_FIELD:${field}`);
      }
    }
    if (seen.has(entry.relicId)) throw new TypeError(`RELIC_BUILD_DUPLICATE_ENTRY:${entry.relicId}`);
    seen.add(entry.relicId);
    requireRelic(entry.relicId);
    for (const field of ["acquiredRevision"]) {
      if (!Number.isSafeInteger(entry[field]) || entry[field] < 0) {
        throw new TypeError(`RELIC_BUILD_ENTRY_INVALID:${field}`);
      }
    }
    for (const field of ["acquisitionSource", "sourceOfferId"]) {
      if (!String(entry[field] || "").trim()) throw new TypeError(`RELIC_BUILD_ENTRY_INVALID:${field}`);
    }
  }
  const summary = summarizeRelics(build.relics);
  const mythicCount = build.relics.filter((entry) => requireRelic(entry.relicId).mythic).length;
  if (mythicCount > slotPolicy.maximumMythicRelics) {
    throw new TypeError("RELIC_BUILD_MYTHIC_LIMIT_EXCEEDED");
  }
  const legendaryCount = build.relics.filter((entry) => requireRelic(entry.relicId).legendary).length;
  const legendaryLimit = build.relics.some(
    (entry) => entry.relicId === slotPolicy.doubleLegendaryRelicId
  )
    ? slotPolicy.maximumLegendaryRelicsWithBonus
    : slotPolicy.maximumLegendaryRelics;
  if (legendaryCount > legendaryLimit) {
    throw new TypeError("RELIC_BUILD_LEGENDARY_LIMIT_EXCEEDED");
  }
  for (const entry of build.relics) {
    const policy = requireRelic(entry.relicId);
    const conflict = build.relics.find(
      (candidate) =>
        candidate.relicId !== entry.relicId &&
        policy.mutuallyExclusiveWith.includes(candidate.relicId)
    );
    if (conflict) {
      throw new TypeError(
        `RELIC_BUILD_MUTUAL_EXCLUSION:${entry.relicId}:${conflict.relicId}`
      );
    }
  }
  if (summary.relicSlotsUsed > summary.relicSlotLimit) {
    throw new TypeError("RELIC_BUILD_SLOT_LIMIT_EXCEEDED");
  }
  for (const [field, expected] of Object.entries({
    relicSlotBase: slotPolicy.baseRelicSlots,
    ...summary
  })) {
    if (build[field] !== expected) throw new TypeError(`RELIC_BUILD_SUMMARY_MISMATCH:${field}`);
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(build.buildDigest)) {
    throw new TypeError("RELIC_BUILD_DIGEST_INVALID");
  }
  if (!build.resources || typeof build.resources !== "object") {
    throw new TypeError("RELIC_BUILD_RESOURCES_INVALID");
  }
  for (const field of [
    "potions",
    "maxPotions",
    "hp",
    "maxHp",
    "combatBoostTurns",
    "combatBoostAttack",
    "combatBoostArmor",
    "highestUnlockedDepth",
    "turn",
    "crossroadsPowerMaxHpPenalty"
  ]) {
    if (!Number.isSafeInteger(build.resources[field]) || build.resources[field] < 0) {
      throw new TypeError(`RELIC_BUILD_RESOURCES_INVALID:${field}`);
    }
  }
  if (
    !Number.isSafeInteger(build.resources.crossroadsPowerExpireTurn) ||
    build.resources.crossroadsPowerExpireTurn < -1
  ) {
    throw new TypeError("RELIC_BUILD_RESOURCES_INVALID:crossroadsPowerExpireTurn");
  }
  if (
    build.resources.potions > build.resources.maxPotions ||
    build.resources.hp > build.resources.maxHp
  ) {
    throw new TypeError("RELIC_BUILD_RESOURCES_BOUNDS_INVALID");
  }
  if (!build.merchant || typeof build.merchant !== "object") {
    throw new TypeError("RELIC_BUILD_MERCHANT_INVALID");
  }
  for (const field of ["potionsBought", "secondChancePurchases"]) {
    if (!Number.isSafeInteger(build.merchant[field]) || build.merchant[field] < 0) {
      throw new TypeError(`RELIC_BUILD_MERCHANT_INVALID:${field}`);
    }
  }
  return build;
}

export function projectPublicBuild(build) {
  assertCanonicalRelicBuildV08(build);
  return Object.fromEntries(buildMetadata.publicProjectionFields.map((field) => [
    field,
    field === "relics"
      ? build.relics.map(({ relicId, stacks }) => ({ relicId, stacks }))
      : structuredClone(build[field])
  ]));
}

export const V08_RELIC_POLICY_DATA = Object.freeze({ catalog, buildMetadata, slotPolicy });
