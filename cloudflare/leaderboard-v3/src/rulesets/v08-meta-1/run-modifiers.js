import catalogDocument from "./data/run-modifier-catalog.generated.json" with { type: "json" };
import effectsDocument from "./data/run-modifier-effects.generated.json" with { type: "json" };
import selectionDocument from "./data/run-modifier-selection-policy.generated.json" with { type: "json" };
import {
  applyPotionResourceTransitionV08,
  assertCanonicalPotionResourcesV08,
  derivePotionMaximumV08
} from "./potion-policy.js";

const catalog = catalogDocument.canonicalData;
const effects = effectsDocument.canonicalData;
const selection = selectionDocument.canonicalData;
const catalogById = new Map(catalog.modifiers.map((entry) => [entry.modifierId, entry]));
const effectsById = new Map(effects.modifiers.map((entry) => [entry.modifierId, entry]));
const activationSources = new Set(selection.trustedActivationSources);

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

function requireCatalogEntry(modifierId) {
  const entry = catalogById.get(String(modifierId || ""));
  if (!entry) throw new TypeError(`RUN_MODIFIER_UNKNOWN:${String(modifierId || "")}`);
  if (entry.scope !== "RUN_SCOPED") {
    throw new TypeError(`RUN_MODIFIER_SCOPE_FORBIDDEN:${entry.modifierId}`);
  }
  return entry;
}

function digestInput(ledger) {
  return {
    active: [...ledger.active]
      .map((entry) => ({ ...entry }))
      .sort((left, right) => left.modifierId.localeCompare(right.modifierId)),
    activeCount: ledger.activeCount,
    derivedEffectsVersion: ledger.derivedEffectsVersion
  };
}

function multiply(current, value) {
  return current * Number(value);
}

export function createEmptyRunModifierLedgerV08() {
  return {
    active: [],
    activeCount: 0,
    modifierDigest: selection.emptyLedgerDigest,
    derivedEffectsVersion: selection.derivedEffectsVersion
  };
}

export function assertCanonicalRunModifierLedgerV08(ledger) {
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) {
    throw new TypeError("RUN_MODIFIER_LEDGER_INVALID");
  }
  const allowedLedgerFields = new Set([
    "active",
    "activeCount",
    "modifierDigest",
    "derivedEffectsVersion"
  ]);
  for (const field of Object.keys(ledger)) {
    if (!allowedLedgerFields.has(field)) {
      throw new TypeError(`RUN_MODIFIER_LEDGER_UNKNOWN_FIELD:${field}`);
    }
  }
  if (!Array.isArray(ledger.active)) throw new TypeError("RUN_MODIFIER_ACTIVE_INVALID");
  if (ledger.active.length > selection.maximumActiveModifiers) {
    throw new TypeError("RUN_MODIFIER_ACTIVE_LIMIT_EXCEEDED");
  }
  if (ledger.activeCount !== ledger.active.length) {
    throw new TypeError("RUN_MODIFIER_ACTIVE_COUNT_MISMATCH");
  }
  if (ledger.derivedEffectsVersion !== selection.derivedEffectsVersion) {
    throw new TypeError("RUN_MODIFIER_EFFECTS_VERSION_MISMATCH");
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(ledger.modifierDigest)) {
    throw new TypeError("RUN_MODIFIER_DIGEST_INVALID");
  }
  const seen = new Set();
  let previousId = "";
  for (const active of ledger.active) {
    if (!active || typeof active !== "object" || Array.isArray(active)) {
      throw new TypeError("RUN_MODIFIER_ACTIVE_ENTRY_INVALID");
    }
    const allowedEntryFields = new Set([
      "modifierId",
      "stacks",
      "activatedRevision",
      "activationSource"
    ]);
    for (const field of Object.keys(active)) {
      if (!allowedEntryFields.has(field)) {
        throw new TypeError(`RUN_MODIFIER_ACTIVE_ENTRY_UNKNOWN_FIELD:${field}`);
      }
    }
    const policy = requireCatalogEntry(active.modifierId);
    if (seen.has(active.modifierId)) {
      throw new TypeError(`RUN_MODIFIER_DUPLICATE:${active.modifierId}`);
    }
    if (previousId && previousId.localeCompare(active.modifierId) >= 0) {
      throw new TypeError("RUN_MODIFIER_ORDER_INVALID");
    }
    if (
      !Number.isSafeInteger(active.stacks) ||
      active.stacks < 1 ||
      active.stacks > policy.maximumStacks
    ) {
      throw new TypeError(`RUN_MODIFIER_STACK_LIMIT:${active.modifierId}`);
    }
    if (!policy.stackable && active.stacks !== 1) {
      throw new TypeError(`RUN_MODIFIER_NON_STACKABLE:${active.modifierId}`);
    }
    if (!Number.isSafeInteger(active.activatedRevision) || active.activatedRevision < 0) {
      throw new TypeError(`RUN_MODIFIER_ACTIVATED_REVISION_INVALID:${active.modifierId}`);
    }
    if (!activationSources.has(active.activationSource)) {
      throw new TypeError(`RUN_MODIFIER_ACTIVATION_SOURCE_UNKNOWN:${active.activationSource}`);
    }
    for (const excludedId of policy.mutuallyExclusiveWith) {
      if (ledger.active.some((entry) => entry.modifierId === excludedId)) {
        throw new TypeError(
          `RUN_MODIFIER_MUTUALLY_EXCLUSIVE:${active.modifierId}:${excludedId}`
        );
      }
    }
    seen.add(active.modifierId);
    previousId = active.modifierId;
  }
  return ledger;
}

export async function computeRunModifierDigestV08(
  ledger,
  cryptoProvider = globalThis.crypto
) {
  assertCanonicalRunModifierLedgerV08(ledger);
  return sha256(digestInput(ledger), cryptoProvider);
}

export async function assertCanonicalRunModifierDigestV08(
  ledger,
  cryptoProvider = globalThis.crypto
) {
  const expected = await computeRunModifierDigestV08(ledger, cryptoProvider);
  if (ledger.modifierDigest !== expected) {
    throw new TypeError("RUN_MODIFIER_DIGEST_MISMATCH");
  }
  return ledger;
}

export function deriveRunModifierEffects(canonicalRunModifiers, _context = {}) {
  assertCanonicalRunModifierLedgerV08(canonicalRunModifiers);
  const result = {
    effectsVersion: selection.derivedEffectsVersion,
    activeModifierCount: canonicalRunModifiers.activeCount,
    extraRelicChoices: 0,
    goldMultiplierAdditive: 0,
    eliteGoldMultiplier: 1,
    relicRarityModifiers: {},
    relicOfferModifiers: { extraRelicChoices: 0 },
    roomScheduleModifiers: {},
    roomGenerationModifiers: { extraEnemiesAdditive: 0 },
    enemyScalingModifiers: {
      hpMultiplier: 1,
      damageMultiplier: 1,
      eliteHpMultiplier: 1,
      eliteChanceAdditive: 0,
      attackMultiplierPerThreeMaximumDepths: 0,
      attackDepthStep: 3
    },
    playerStartModifiers: {
      attackMultiplier: 1,
      maximumHpMultiplier: 1,
      armorMultiplier: 1,
      critChanceAdditive: 0
    },
    playerDynamicModifiers: {
      attackPerMaximumDepthFraction: 0,
      rounding: null
    },
    potionModifiers: {
      maximumSlotsAdditive: 0,
      minimumMaximumSlots: 1,
      startingPotionsAdditive: 0,
      healMultiplier: 1
    },
    rewardModifiers: { chestHealingDisabled: false },
    economyModifiers: { shopCostMultiplier: 1 },
    roomEntryModifiers: { barrierMaximumHpFraction: 0 },
    scoreMultiplier: 1,
    lifeRuleModifiers: {},
    flags: []
  };
  for (const active of canonicalRunModifiers.active) {
    const definition = effectsById.get(active.modifierId);
    if (!definition) {
      throw new TypeError(`RUN_MODIFIER_EFFECTS_UNKNOWN:${active.modifierId}`);
    }
    const value = definition.effects;
    result.goldMultiplierAdditive += Number(value.gold?.globalAdditive) || 0;
    result.eliteGoldMultiplier = multiply(
      result.eliteGoldMultiplier,
      value.gold?.eliteRewardMultiplier || 1
    );
    result.extraRelicChoices += Number(value.relicOffer?.extraRelicChoices) || 0;
    result.relicOfferModifiers.extraRelicChoices = result.extraRelicChoices;
    result.roomGenerationModifiers.extraEnemiesAdditive +=
      Number(value.roomGeneration?.extraEnemiesAdditive) || 0;
    result.enemyScalingModifiers.hpMultiplier = multiply(
      result.enemyScalingModifiers.hpMultiplier,
      value.enemy?.hpMultiplier || 1
    );
    result.enemyScalingModifiers.damageMultiplier = multiply(
      result.enemyScalingModifiers.damageMultiplier,
      value.enemy?.damageMultiplier || 1
    );
    result.enemyScalingModifiers.eliteHpMultiplier = multiply(
      result.enemyScalingModifiers.eliteHpMultiplier,
      value.enemy?.eliteHpMultiplier || 1
    );
    result.enemyScalingModifiers.eliteChanceAdditive +=
      Number(value.enemy?.eliteChanceAdditive) || 0;
    result.enemyScalingModifiers.attackMultiplierPerThreeMaximumDepths +=
      Number(value.enemy?.attackMultiplierPerThreeMaximumDepths) || 0;
    result.playerStartModifiers.attackMultiplier = multiply(
      result.playerStartModifiers.attackMultiplier,
      value.playerStart?.attackMultiplier || 1
    );
    result.playerStartModifiers.maximumHpMultiplier = multiply(
      result.playerStartModifiers.maximumHpMultiplier,
      value.playerStart?.maximumHpMultiplier || 1
    );
    result.playerStartModifiers.armorMultiplier = multiply(
      result.playerStartModifiers.armorMultiplier,
      value.playerStart?.armorMultiplier || 1
    );
    result.playerStartModifiers.critChanceAdditive +=
      Number(value.playerStart?.critChanceAdditive) || 0;
    result.playerDynamicModifiers.attackPerMaximumDepthFraction +=
      Number(value.playerDynamic?.attackPerMaximumDepthFraction) || 0;
    if (value.playerDynamic?.rounding) {
      result.playerDynamicModifiers.rounding = value.playerDynamic.rounding;
    }
    result.potionModifiers.maximumSlotsAdditive +=
      Number(value.potion?.maximumSlotsAdditive) || 0;
    result.potionModifiers.startingPotionsAdditive +=
      Number(value.potion?.startingPotionsAdditive) || 0;
    result.potionModifiers.minimumMaximumSlots = Math.max(
      result.potionModifiers.minimumMaximumSlots,
      Number(value.potion?.minimumMaximumSlots) || 1
    );
    result.potionModifiers.healMultiplier = multiply(
      result.potionModifiers.healMultiplier,
      value.potion?.healMultiplier || 1
    );
    result.rewardModifiers.chestHealingDisabled ||= Boolean(
      value.reward?.chestHealingDisabled
    );
    result.economyModifiers.shopCostMultiplier = multiply(
      result.economyModifiers.shopCostMultiplier,
      value.economy?.shopCostMultiplier || 1
    );
    result.roomEntryModifiers.barrierMaximumHpFraction +=
      Number(value.roomEntry?.barrierMaximumHpFraction) || 0;
    result.flags.push(active.modifierId);
  }
  return result;
}

function flaskStackCount(build) {
  return build?.relics?.find((entry) => entry.relicId === "flask")?.stacks || 0;
}

function potionCapacityInput(build, effects) {
  return {
    baseMaximum: 3,
    satchelLevel: Number(build?.campUpgrades?.satchel) || 0,
    modifierMaximumSlotsAdditive: effects.potionModifiers.maximumSlotsAdditive,
    flaskStacks: flaskStackCount(build)
  };
}

function applyCanonicalPotionEffects(
  metaState,
  previousEffects,
  nextEffects,
  activationSource,
  context = {}
) {
  if (context.potionPolicyVersion === "legacy") return;
  if (!metaState?.build?.resources) return;
  const capacityInput = potionCapacityInput(metaState.build, nextEffects);
  const nextMaximum = derivePotionMaximumV08(capacityInput);
  if (activationSource === "server-issued-run-start") {
    metaState.build.resources = applyPotionResourceTransitionV08(
      metaState.build.resources,
      { nextMaximum, currentGrant: nextEffects.potionModifiers.startingPotionsAdditive }
    );
  } else {
    const previousCapacity = potionCapacityInput(metaState.build, previousEffects);
    const previousMaximum = derivePotionMaximumV08(previousCapacity);
    if (previousMaximum !== nextMaximum) {
      metaState.build.resources = applyPotionResourceTransitionV08(
        metaState.build.resources,
        { nextMaximum, currentGrant: 0 }
      );
    }
  }
  assertCanonicalPotionResourcesV08(metaState.build.resources, nextMaximum);
}
export async function applyCanonicalRunModifierSelection(
  metaState,
  request,
  context = {}
) {
  if (context.authority !== selection.trustedAuthority) {
    throw new TypeError("RUN_MODIFIER_TRUSTED_AUTHORITY_REQUIRED");
  }
  const modifierIds = Array.isArray(request?.modifierIds)
    ? request.modifierIds.map((id) => String(id || ""))
    : null;
  if (!modifierIds) throw new TypeError("RUN_MODIFIER_SELECTION_REQUIRED");
  const activationSource = String(request?.activationSource || "");
  if (!activationSources.has(activationSource)) {
    throw new TypeError(`RUN_MODIFIER_ACTIVATION_SOURCE_UNKNOWN:${activationSource}`);
  }
  if (new Set(modifierIds).size !== modifierIds.length) {
    throw new TypeError("RUN_MODIFIER_SELECTION_DUPLICATE");
  }
  if (modifierIds.length > selection.maximumActiveModifiers) {
    throw new TypeError("RUN_MODIFIER_ACTIVE_LIMIT_EXCEEDED");
  }
  const requested = modifierIds.map(requireCatalogEntry);
  const requestedIds = requested.map((entry) => entry.modifierId).sort();
  const currentLedger = metaState?.runModifiers;
  assertCanonicalRunModifierLedgerV08(currentLedger);
  await assertCanonicalRunModifierDigestV08(currentLedger, context.cryptoProvider);
  const currentIds = currentLedger.active.map((entry) => entry.modifierId);
  const previousEffects = deriveRunModifierEffects(currentLedger);
  if (canonicalJson(currentIds) === canonicalJson(requestedIds)) {
    return structuredClone(metaState);
  }
  if (activationSource === "server-issued-run-start") {
    const pristineMaximum = derivePotionMaximumV08(potionCapacityInput(metaState.build, previousEffects));
    const resources = metaState.build?.resources;
    if (
      !resources ||
      resources.potions !== pristineMaximum ||
      resources.maxPotions !== pristineMaximum
    ) {
      throw new TypeError("RUN_MODIFIER_RUN_START_RESOURCES_NOT_PRISTINE");
    }
  }
  if (activationSource === "server-issued-run-start" && currentIds.length > 0) {
    throw new TypeError("RUN_MODIFIER_RUN_START_ALREADY_SET");
  }
  if (
    activationSource !== "server-issued-mid-run" &&
    currentIds.some((id) => !requestedIds.includes(id))
  ) {
    throw new TypeError("RUN_MODIFIER_REMOVAL_FORBIDDEN");
  }
  const next = structuredClone(metaState);
  const byId = new Map(currentLedger.active.map((entry) => [entry.modifierId, entry]));
  next.runModifiers.active = requestedIds.map((modifierId) => (
    byId.get(modifierId) || {
      modifierId,
      stacks: 1,
      activatedRevision: metaState.revision,
      activationSource
    }
  ));
  next.runModifiers.activeCount = next.runModifiers.active.length;
  next.runModifiers.derivedEffectsVersion = selection.derivedEffectsVersion;
  assertCanonicalRunModifierLedgerV08(next.runModifiers);
  next.runModifiers.modifierDigest = await sha256(
    digestInput(next.runModifiers),
    context.cryptoProvider
  );
  const nextEffects = deriveRunModifierEffects(next.runModifiers);
  applyCanonicalPotionEffects(next, previousEffects, nextEffects, activationSource, context);
  return next;
}

export function projectPublicRunModifiers(metaState) {
  const ledger = assertCanonicalRunModifierLedgerV08(metaState?.runModifiers);
  const derived = deriveRunModifierEffects(ledger);
  return {
    active: ledger.active.map(({ modifierId, stacks }) => ({
      modifierId,
      stacks,
      metadataId: modifierId
    })),
    activeCount: ledger.activeCount,
    modifierDigest: ledger.modifierDigest,
    summary: {
      extraRelicChoices: derived.extraRelicChoices,
      goldMultiplierAdditive: derived.goldMultiplierAdditive,
      potionModifiers: structuredClone(derived.potionModifiers)
    }
  };
}

export function projectLeaderboardRunModifiers(metaState) {
  const ledger = assertCanonicalRunModifierLedgerV08(metaState?.runModifiers);
  return {
    modifiers: ledger.active.map(({ modifierId, stacks }) => ({ modifierId, stacks })),
    flags: ledger.active.map((entry) => entry.modifierId)
  };
}

export function getFutureArenaRelicChoiceCountV08(metaState) {
  return 3 + deriveRunModifierEffects(metaState.runModifiers).extraRelicChoices;
}

export const V08_RUN_MODIFIER_DATA = Object.freeze({
  catalog,
  effects,
  selection
});
