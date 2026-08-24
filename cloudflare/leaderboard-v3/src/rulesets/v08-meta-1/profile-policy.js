import {
  computeRelicBuildDigestV08,
  createEmptyRelicBuildV08
} from "./relic-policy.js";
import {
  createEmptyRunModifierLedgerV08,
  deriveRunModifierEffects,
  projectPublicRunModifiers
} from "./run-modifiers.js";
import {
  assertCanonicalPotionResourcesV08,
  derivePotionMaximumV08,
  initializePotionResourcesV08
} from "./potion-policy.js";
import { CANONICAL_POTION_RESOURCES_VERSION_V08, normalizeCampaignStateV08 } from "./meta-state.js";
import {
  applyPracticeMutatorImportV08,
  createEmptyMutatorProgressV08,
  normalizeMutatorProgressV08,
  projectPublicMutatorProgressV08
} from "./mutator-progression.js";

function flaskStackCount(build) {
  return build?.relics?.find((entry) => entry.relicId === "flask")?.stacks || 0;
}

export const PROFILE_POLICY_VERSION = "v08-ranked-profile-1";

function safeLevel(value) {
  const level = Number(value || 0);
  if (!Number.isSafeInteger(level) || level < 0) {
    throw new TypeError("PROFILE_CAMP_UPGRADE_INVALID");
  }
  return level;
}

async function resetBuildForNextRun(build, cryptoProvider, potionModifiers, potionPolicyVersion = "legacy") {
  const empty = createEmptyRelicBuildV08();
  const next = structuredClone(build || empty);
  const vitality = safeLevel(next.campUpgrades?.vitality);
  const satchel = safeLevel(next.campUpgrades?.satchel);
  const maxHp = Math.max(
    1,
    Math.round(empty.resources.maxHp * (1 + vitality * 0.1))
  );
  const potionInput = {
    baseMaximum: empty.resources.maxPotions,
    satchelLevel: satchel,
    modifierMaximumSlotsAdditive: potionPolicyVersion === "legacy"
      ? 0
      : potionModifiers.maximumSlotsAdditive,
    flaskStacks: flaskStackCount(next)
  };
  if (potionPolicyVersion === "legacy") {
    next.resources = {
      ...empty.resources,
      maxHp,
      hp: maxHp,
      highestUnlockedDepth: Math.max(0, Number(next.resources?.highestUnlockedDepth) || 0)
    };
    next.merchant = structuredClone(empty.merchant);
    next.buildDigest = await computeRelicBuildDigestV08(next, cryptoProvider);
    return next;
  }
  const potionResources = initializePotionResourcesV08({
    ...potionInput,
    startingPotionsAdditive: potionModifiers.startingPotionsAdditive
  });
  next.resources = {
    ...empty.resources,
    maxHp,
    hp: maxHp,
    ...potionResources,
    highestUnlockedDepth: Math.max(
      0,
      Number(next.resources?.highestUnlockedDepth) || 0
    )
  };
  assertCanonicalPotionResourcesV08(next.resources, derivePotionMaximumV08(potionInput));
  next.merchant = structuredClone(empty.merchant);
  next.buildDigest = await computeRelicBuildDigestV08(next, cryptoProvider);
  return next;
}

function resolveProfilePotionPolicyVersion(profile, context) {
  const profileVersion = profile.potionPolicyVersion;
  if (profileVersion !== undefined && profileVersion !== CANONICAL_POTION_RESOURCES_VERSION_V08) {
    throw new TypeError("PROFILE_POTION_POLICY_VERSION_INVALID");
  }
  const contextVersion = context.potionPolicyVersion;
  if (contextVersion !== undefined && contextVersion !== "legacy" && contextVersion !== CANONICAL_POTION_RESOURCES_VERSION_V08) {
    throw new TypeError("PROFILE_POTION_POLICY_VERSION_INVALID");
  }
  return contextVersion || (profileVersion === CANONICAL_POTION_RESOURCES_VERSION_V08 ? CANONICAL_POTION_RESOURCES_VERSION_V08 : "legacy");
}
export async function hydrateRunFromProfileV08(state, profile, context = {}) {
  if (!profile) return structuredClone(state);
  if (
    profile.rulesetId !== state.rulesetId ||
    profile.rulesetHash !== state.rulesetHash
  ) {
    throw new TypeError("PROFILE_RULESET_MISMATCH");
  }
  const potionPolicyVersion = resolveProfilePotionPolicyVersion(profile, context);
  const next = structuredClone(state);
  if (potionPolicyVersion === "legacy" && profile.potionPolicyVersion === undefined) {
    delete next.potionPolicyVersion;
  }
  next.profileId = profile.profileId;
  next.campGold = Math.max(0, Number(profile.campGold) || 0);
  next.lives = Math.max(0, Number(profile.lives) || next.lives);
  next.runModifiers = structuredClone(
    profile.runModifiers || createEmptyRunModifierLedgerV08()
  );
  const potionModifiers = deriveRunModifierEffects(next.runModifiers).potionModifiers;
  next.build = await resetBuildForNextRun(
    profile.build,
    context.cryptoProvider,
    potionModifiers,
    potionPolicyVersion
  );
  next.mutatorProgress = normalizeMutatorProgressV08(profile.mutatorProgress, {
    activeModifierIds: next.runModifiers.active.map((entry) => entry.modifierId)
  });
  next.campaign = normalizeCampaignStateV08({ campaign: profile.campaign || next.campaign });
  next.specialRoomScheduleState.forgeSeenInGame =
    next.campaign.forgeSeenInCampaign;
  next.specialRoomScheduleState.forgePityUsedInGame =
    next.campaign.forgePityUsedInCampaign;
  if (
    context.capabilities == null ||
    context.capabilities.earlyBalanceOtterRepair === "v1"
  ) {
    next.specialRoomScheduleState.otterSeenInGame =
      next.campaign.otterSeenInCampaign;
    next.specialRoomScheduleState.otterPityUsedInGame =
      next.campaign.otterPityUsedInCampaign;
  }
  return next;
}

function profileStateFromCanonicalRun(state, profileId, profileRevision = 0) {
  if (
    state.potionPolicyVersion !== undefined &&
    state.potionPolicyVersion !== CANONICAL_POTION_RESOURCES_VERSION_V08
  ) {
    throw new TypeError("PROFILE_POTION_POLICY_VERSION_INVALID");
  }
  return {
    profilePolicyVersion: PROFILE_POLICY_VERSION,
    ...(state.potionPolicyVersion === CANONICAL_POTION_RESOURCES_VERSION_V08
      ? { potionPolicyVersion: CANONICAL_POTION_RESOURCES_VERSION_V08 }
      : {}),
    profileId,
    runId: profileId,
    rulesetId: state.rulesetId,
    rulesetHash: state.rulesetHash,
    status: "active",
    revision: profileRevision,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    campGold: state.campGold,
    lives: state.lives,
    build: structuredClone(state.build),
    runModifiers: structuredClone(state.runModifiers),
    mutatorProgress: normalizeMutatorProgressV08(
      state.mutatorProgress || createEmptyMutatorProgressV08(),
      { activeModifierIds: state.runModifiers.active.map((entry) => entry.modifierId) }
    ),
    campaign: structuredClone(state.campaign),
    goldLedger: structuredClone(state.goldLedger),
    metaTransactionReceipts: [],
    metaSourceConsumptions: [],
    campSession: null,
    pendingInventory: null,
    startingRelicGranted: state.status !== "awaiting_starting_relic",
    lastExtractedRunId: state.status === "extraction" ? state.runId : null
  };
}

export function applyPracticeMutatorImportToProfileV08(profile, payload, context = {}) {
  const next = structuredClone(profile);
  next.mutatorProgress = normalizeMutatorProgressV08(next.mutatorProgress, {
    activeModifierIds: (next.runModifiers?.active || []).map((entry) => entry.modifierId)
  });
  if (next.mutatorProgress.importConsumed) return next;
  next.mutatorProgress = applyPracticeMutatorImportV08(
    next.mutatorProgress,
    payload,
    { importedAt: context.now }
  );
  return next;
}

export function createInitialProfileStateV08(state, profileId) {
  return profileStateFromCanonicalRun(state, profileId, 0);
}

export function profileStateFromRunV08(state, profileId, profileRevision = 0) {
  if (state.status !== "extraction") {
    throw new TypeError("PROFILE_EXTRACTION_SOURCE_REQUIRED");
  }
  return profileStateFromCanonicalRun(state, profileId, profileRevision);
}

export function publicProfileStateV08(profile) {
  return {
    profilePolicyVersion: PROFILE_POLICY_VERSION,
    profileId: profile.profileId,
    rulesetId: profile.rulesetId,
    rulesetHash: profile.rulesetHash,
    revision: profile.revision,
    campGold: profile.campGold,
    lives: profile.lives,
    build: structuredClone(profile.build),
    runModifiers: projectPublicRunModifiers({ runModifiers: profile.runModifiers || createEmptyRunModifierLedgerV08() }),
    mutatorProgress: projectPublicMutatorProgressV08(
      normalizeMutatorProgressV08(profile.mutatorProgress, {
        activeModifierIds: (profile.runModifiers?.active || []).map((entry) => entry.modifierId)
      })
    ),
    campaign: normalizeCampaignStateV08({ campaign: profile.campaign }),
    campSession: profile.campSession
      ? {
          sessionId: profile.campSession.sessionId,
          active: profile.campSession.active === true
        }
      : null
  };
}
