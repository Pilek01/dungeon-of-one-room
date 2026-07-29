import {
  computeRelicBuildDigestV08,
  createEmptyRelicBuildV08
} from "./relic-policy.js";
import { createEmptyRunModifierLedgerV08 } from "./run-modifiers.js";

export const PROFILE_POLICY_VERSION = "v08-ranked-profile-1";

function safeLevel(value) {
  const level = Number(value || 0);
  if (!Number.isSafeInteger(level) || level < 0) {
    throw new TypeError("PROFILE_CAMP_UPGRADE_INVALID");
  }
  return level;
}

async function resetBuildForNextRun(build, cryptoProvider) {
  const empty = createEmptyRelicBuildV08();
  const next = structuredClone(build || empty);
  const vitality = safeLevel(next.campUpgrades?.vitality);
  const satchel = safeLevel(next.campUpgrades?.satchel);
  const maxHp = Math.max(
    1,
    Math.round(empty.resources.maxHp * (1 + vitality * 0.1))
  );
  next.resources = {
    ...empty.resources,
    maxHp,
    hp: maxHp,
    maxPotions: empty.resources.maxPotions + satchel,
    potions: empty.resources.potions + satchel,
    highestUnlockedDepth: Math.max(
      0,
      Number(next.resources?.highestUnlockedDepth) || 0
    )
  };
  next.merchant = structuredClone(empty.merchant);
  next.buildDigest = await computeRelicBuildDigestV08(next, cryptoProvider);
  return next;
}

export async function hydrateRunFromProfileV08(state, profile, context = {}) {
  if (!profile) return structuredClone(state);
  if (
    profile.rulesetId !== state.rulesetId ||
    profile.rulesetHash !== state.rulesetHash
  ) {
    throw new TypeError("PROFILE_RULESET_MISMATCH");
  }
  const next = structuredClone(state);
  next.profileId = profile.profileId;
  next.campGold = Math.max(0, Number(profile.campGold) || 0);
  next.lives = Math.max(0, Number(profile.lives) || next.lives);
  next.build = await resetBuildForNextRun(profile.build, context.cryptoProvider);
  next.runModifiers = structuredClone(
    profile.runModifiers || createEmptyRunModifierLedgerV08()
  );
  return next;
}

function profileStateFromCanonicalRun(state, profileId, profileRevision = 0) {
  return {
    profilePolicyVersion: PROFILE_POLICY_VERSION,
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
    goldLedger: structuredClone(state.goldLedger),
    metaTransactionReceipts: [],
    metaSourceConsumptions: [],
    campSession: null,
    pendingInventory: null,
    startingRelicGranted: state.status !== "awaiting_starting_relic",
    lastExtractedRunId: state.status === "extraction" ? state.runId : null
  };
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
    campSession: profile.campSession
      ? {
          sessionId: profile.campSession.sessionId,
          active: profile.campSession.active === true
        }
      : null
  };
}
