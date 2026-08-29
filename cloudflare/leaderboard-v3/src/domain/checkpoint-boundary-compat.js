import {
  applyIssuedChestStatBonusV08,
  projectChestBonusesV08
} from "../rulesets/v08-meta-1/chest-bonus-policy.js";

function unchanged(combatResources) {
  return structuredClone(combatResources);
}

export function normalizeCheckpointCombatResourcesForIssuedHealthV08({
  state,
  rewardClaims,
  combatResources,
  capabilities
}) {
  const source = unchanged(combatResources);
  if (
    capabilities?.boundedCombatResources !== "v1" ||
    capabilities?.canonicalChestOutcomes !== "v1" ||
    !state?.currentRewardEnvelope ||
    !state?.campaign ||
    !state?.build?.resources
  ) {
    return source;
  }
  if (
    !Number.isSafeInteger(source.hp) ||
    !Number.isSafeInteger(source.maxHp) ||
    !Number.isSafeInteger(state.build.resources.maxHp) ||
    source.maxHp !== state.build.resources.maxHp
  ) {
    return source;
  }

  const claims = Array.isArray(rewardClaims) ? rewardClaims : [];
  const slots = new Map(
    (Array.isArray(state.currentRewardEnvelope.claimSlots)
      ? state.currentRewardEnvelope.claimSlots
      : [])
      .map((slot) => [slot.slotId, slot])
  );
  const seenHealthSlots = new Set();
  let campaign = structuredClone(state.campaign);
  let beforeHealthFlat;
  try {
    beforeHealthFlat = projectChestBonusesV08(campaign.chestBonuses).healthFlat;
    for (const claim of claims) {
      if (
        claim?.claimType !== "chest" ||
        claim?.count !== 1 ||
        claim?.localEvidence?.outcome !== "health"
      ) {
        continue;
      }
      const slot = slots.get(claim.claimId);
      if (
        !slot ||
        slot.consumed ||
        slot.canonicalOutcome?.outcome !== "health" ||
        claim.localEvidence.awardId !== slot.canonicalOutcome.awardId
      ) {
        continue;
      }
      if (seenHealthSlots.has(slot.slotId)) return source;
      seenHealthSlots.add(slot.slotId);
      campaign = applyIssuedChestStatBonusV08(campaign, {
        stat: "health",
        scalingDepth: state.currentRewardEnvelope.scalingDepth
      }, {
        exactStatCarry: capabilities.exactChestStatCarry === "v1"
      });
    }
  } catch {
    // Preserve the original payload so the authoritative ruleset reports the
    // exact validation error instead of this compatibility layer masking it.
    return source;
  }

  if (seenHealthSlots.size === 0) return source;
  const afterHealthFlat = projectChestBonusesV08(campaign.chestBonuses).healthFlat;
  const healthDelta = afterHealthFlat - beforeHealthFlat;
  if (!Number.isSafeInteger(healthDelta) || healthDelta <= 0) return source;
  const hp = source.hp + healthDelta;
  const maxHp = source.maxHp + healthDelta;
  if (!Number.isSafeInteger(hp) || !Number.isSafeInteger(maxHp)) return source;
  return {
    ...source,
    hp,
    maxHp
  };
}
