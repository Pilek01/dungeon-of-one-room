import crossroadsPolicyDocument from "./data/crossroads-transaction-policy.generated.json" with { type: "json" };
import {
  awardCanonicalGoldV08,
  commitMetaTransactionV08,
  consumeCanonicalMetaSourceV08,
  isCanonicalMetaSourceConsumedV08,
  issueMetaTransactionOfferV08
} from "./meta-transaction.js";
import { resolveGoldModifierV08 } from "./gold-policy.js";
import {
  applyRelicAcquisition,
  applyRelicReplacementBuildV08,
  getRelicCatalogEntryV08,
  V08_RELIC_POLICY_DATA
} from "./relic-policy.js";
import { evaluateRelicAcquisition } from "./relic-replacement.js";
import { deriveIntInclusive } from "./rng.js";
import { deriveRunModifierEffects } from "./run-modifiers.js";

const policy = crossroadsPolicyDocument.canonicalData;
const catalog = V08_RELIC_POLICY_DATA.catalog.relics;

export const CROSSROADS_POLICY_SPEC = Object.freeze({
  moduleFile: "crossroads-policy.js",
  authority: "SERVER_ISSUED",
  choices: Object.freeze(["power", "mercy"]),
  offerBinding: "runId+rulesetHash+revision+state/build digest+roomDirectiveId",
  implementationStatus: "m1-test-only"
});

export const V08_CROSSROADS_TRANSACTION_POLICY = policy;

function crossroadsRoomBinding(metaState) {
  const directive = metaState.currentRoomDirective;
  if (!directive || directive.roomType !== "crossroads") {
    throw new TypeError("CROSSROADS_SOURCE_UNAVAILABLE");
  }
  if (directive.runId && directive.runId !== metaState.runId) {
    throw new TypeError("CROSSROADS_SOURCE_BINDING_MISMATCH");
  }
  if (directive.revision !== metaState.revision) {
    throw new TypeError("CROSSROADS_SOURCE_STALE");
  }
  if (isCanonicalMetaSourceConsumedV08(metaState, directive.directiveId)) {
    throw new TypeError("CROSSROADS_SOURCE_ALREADY_CONSUMED");
  }
  return {
    directiveId: directive.directiveId,
    depth: directive.depth,
    roomIndex: directive.roomIndex
  };
}

async function randomInt(metaState, context, purpose, counter, maximum) {
  const derive = context.randomOracle?.deriveIntInclusive
    ? context.randomOracle.deriveIntInclusive.bind(context.randomOracle)
    : deriveIntInclusive;
  return derive(0, maximum, {
    secret: context.secret,
    rulesetId: metaState.rulesetId,
    runId: metaState.runId,
    revision: metaState.revision,
    purpose: `crossroads/${purpose}`,
    counter,
    cryptoProvider: context.cryptoProvider
  });
}

function baselineDraftEligible(metaState, relic) {
  if (!relic.acquisitionSources.includes("relic_draft")) return false;
  if (!policy.power.eligibleRarities.includes(relic.rarity)) return false;
  const owned = metaState.build.relics.find((entry) => entry.relicId === relic.relicId);
  if (owned && !relic.stackable) return false;
  if (owned && owned.stacks >= relic.maximumStacks) return false;
  if (
    relic.mythic &&
    metaState.build.relics.some((entry) => getRelicCatalogEntryV08(entry.relicId).mythic)
  ) {
    return false;
  }
  return true;
}

async function rollNonBossRarity(metaState, context, depth, counter) {
  const depthBonus = Math.floor(Math.max(0, depth) / 5);
  const legendaryChance = 0.02 + depthBonus * 0.008;
  const epicChance = 0.06 + depthBonus * 0.012;
  const rareChance = 0.17;
  const mythicChance = Math.max(
    0,
    Math.min(0.02, legendaryChance * 0.05)
  );
  const roll = await randomInt(
    metaState,
    context,
    "power-rarity",
    counter,
    999_999
  );
  const scaled = roll / 1_000_000;
  if (scaled < mythicChance) return "mythic";
  if (scaled < mythicChance + legendaryChance) return "legendary";
  if (scaled < mythicChance + legendaryChance + epicChance) return "epic";
  if (scaled < mythicChance + legendaryChance + epicChance + rareChance) return "rare";
  return "normal";
}

async function powerRelics(metaState, binding, context) {
  const basePool = catalog.filter((relic) => baselineDraftEligible(metaState, relic));
  const used = new Set();
  const choices = [];
  const count = Math.max(
    0,
    policy.power.baseChoiceCount +
      deriveRunModifierEffects(metaState.runModifiers).extraRelicChoices
  );
  for (let index = 0; index < count; index += 1) {
    const rarity = await rollNonBossRarity(
      metaState,
      context,
      binding.depth,
      index
    );
    const remaining = basePool.filter((relic) => !used.has(relic.relicId));
    if (!remaining.length) break;
    const preferred = remaining.filter((relic) => relic.rarity === rarity);
    const pool = preferred.length ? preferred : remaining;
    const candidateIndex = await randomInt(
      metaState,
      context,
      "power-candidate",
      index,
      pool.length - 1
    );
    const relic = pool[candidateIndex];
    used.add(relic.relicId);
    choices.push(relic);
  }
  return choices;
}

async function powerAcquisitionChoices(metaState, relic, group) {
  const decision = await evaluateRelicAcquisition(metaState, {
    incomingRelicId: relic.relicId,
    incomingStacks: 1,
    acquisitionSource: "relic_draft",
    sourceOfferId: "crossroads_pending_offer",
    sourceChoiceId: "crossroads_pending_choice",
    sourceRewardSlotId: null
  });
  if (decision.decision === "ACQUIRE_DIRECT") {
    return [{
      kind: "crossroads_power_relic",
      label: `POWER ${relic.relicId}`,
      publicData: {
        action: "power",
        relicId: relic.relicId,
        rarity: relic.rarity,
        hpCostRatio: policy.power.maxHpCostMultiplier,
        durationTurns: policy.power.durationTurns,
        replacement: false
      },
      privateData: {
        action: "power_acquire",
        relicId: relic.relicId,
        removals: [],
        group
      }
    }];
  }
  if (decision.decision !== "REQUIRE_REPLACEMENT") return [];
  return decision.candidatePlans.map((candidate, index) => ({
    kind: "crossroads_power_replacement",
    label: `POWER ${relic.relicId} replacement ${index + 1}`,
    publicData: {
      action: "power",
      relicId: relic.relicId,
      rarity: relic.rarity,
      hpCostRatio: policy.power.maxHpCostMultiplier,
      durationTurns: policy.power.durationTurns,
      replacement: true,
      removals: candidate.removals.map((entry) => ({
        relicId: entry.relicId,
        stacks: -entry.targetStackDelta
      }))
    },
    privateData: {
      action: "power_acquire",
      relicId: relic.relicId,
      removals: candidate.removals.map((entry) => ({
        relicId: entry.relicId,
        stacks: -entry.targetStackDelta
      })),
      group
    }
  }));
}

function powerPenalty(resources) {
  const maxHpBefore = Math.max(1, Math.round(resources.maxHp));
  const amount = Math.max(
    policy.power.minimumMaxHpCost,
    Math.round(maxHpBefore * policy.power.maxHpCostMultiplier)
  );
  resources.maxHp = Math.max(1, maxHpBefore - amount);
  resources.hp = Math.max(1, Math.min(resources.maxHp, resources.hp));
  resources.crossroadsPowerMaxHpPenalty = amount;
  resources.crossroadsPowerExpireTurn =
    resources.turn + policy.power.durationTurns;
  return amount;
}

function resolveCanonicalGold(metaState, sourceId, baseAmount) {
  return resolveGoldModifierV08({
    canonicalBuild: metaState.build,
    canonicalRunModifiers: metaState.runModifiers,
    sourceId,
    baseAmount,
    context: { applyMultiplier: true }
  });
}

export async function issueCrossroadsOfferV08(metaState, context = {}) {
  if (
    metaState.pendingInventory?.sourceType === "crossroads" &&
    metaState.pendingInventory?.sourceId === "crossroads-choice"
  ) {
    return structuredClone(metaState);
  }
  const binding = crossroadsRoomBinding(metaState);
  const relics = await powerRelics(metaState, binding, context);
  const powerChoices = [];
  for (const [index, relic] of relics.entries()) {
    powerChoices.push(...await powerAcquisitionChoices(
      metaState,
      relic,
      `power-result-${index}`
    ));
  }
  if (powerChoices.length) {
    powerChoices.push({
      kind: "crossroads_power_skip",
      label: "Confirm POWER and decline relic",
      publicData: {
        action: "power_skip",
        hpCostRatio: policy.power.maxHpCostMultiplier,
        durationTurns: policy.power.durationTurns
      },
      privateData: { action: "power_skip" }
    });
  } else {
    powerChoices.push({
      kind: "crossroads_power_fallback",
      label: "Confirm POWER empty fallback",
      publicData: {
        action: "power_fallback",
        hpCostRatio: policy.power.maxHpCostMultiplier,
        durationTurns: policy.power.durationTurns,
        baseGold: policy.power.emptyPoolFallback.baseGold
      },
      privateData: { action: "power_fallback" }
    });
  }
  const mercy = {
    kind: "crossroads_mercy",
    label: "Choose MERCY",
    publicData: {
      action: "mercy",
      heal: "full",
      resetCooldowns: true,
      refillPotions: !metaState.build.pacts.includes("avarice")
    },
    privateData: { action: "mercy" }
  };
  return issueMetaTransactionOfferV08(metaState, {
    sourceType: "crossroads",
    sourceId: "crossroads-choice",
    sourcePolicyVersion: policy.policyVersion,
    sourceBinding: binding,
    choices: [...powerChoices, mercy]
  }, context);
}

function consumeCrossroads(state, offer, action) {
  consumeCanonicalMetaSourceV08(
    state,
    "crossroads",
    action,
    offer.sourceBinding.directiveId
  );
}

function applyMercy(state) {
  const resources = state.build.resources;
  const healed = Math.max(0, resources.maxHp - resources.hp);
  resources.hp = resources.maxHp;
  let cooldownsReset = 0;
  for (const skillId of Object.keys(resources.skillCooldowns)) {
    if (resources.skillCooldowns[skillId] > 0) cooldownsReset += 1;
    resources.skillCooldowns[skillId] = 0;
  }
  const emptySlots = Math.max(0, resources.maxPotions - resources.potions);
  let gold = null;
  if (emptySlots && state.build.pacts.includes("avarice")) {
    gold = resolveCanonicalGold(
      state,
      policy.mercy.avarice.sourceId,
      emptySlots * policy.mercy.avarice.baseGoldPerEmptySlot
    );
    awardCanonicalGoldV08(state, gold.amount, "run_gold");
  } else {
    resources.potions += emptySlots;
  }
  return {
    healed,
    cooldownsReset,
    potionsRefilled: gold ? 0 : emptySlots,
    avariceGold: gold?.amount ?? 0,
    avariceBaseGold: gold?.baseAmount ?? 0
  };
}

export async function commitCrossroadsTransactionV08(metaState, request, context = {}) {
  return commitMetaTransactionV08(metaState, request, async ({
    state,
    offer,
    choice
  }) => {
    if (offer.sourceType !== "crossroads") {
      throw new TypeError("CROSSROADS_TRANSACTION_SOURCE_MISMATCH");
    }
    const action = choice.privateData?.action;
    consumeCrossroads(state, offer, action);
    if (action === "mercy") {
      const result = applyMercy(state);
      return {
        nextState: state,
        publicResult: { action, ...result },
        authoritativeCost: { type: "none", amount: 0 },
        authoritativeReward: result
      };
    }
    if (!["power_acquire", "power_skip", "power_fallback"].includes(action)) {
      throw new TypeError("CROSSROADS_TRANSACTION_ACTION_UNKNOWN");
    }
    const hpCost = powerPenalty(state.build.resources);
    state.specialRoomScheduleState.crossroadsPenaltyActive = true;
    let gold = null;
    if (action === "power_acquire") {
      const acquisition = {
        relicId: choice.privateData.relicId,
        acquiredRevision: state.revision,
        acquisitionSource: "relic_draft",
        sourceOfferId: offer.offerId
      };
      state.build = choice.privateData.removals.length
        ? await applyRelicReplacementBuildV08(
            state.build,
            choice.privateData.removals,
            { ...acquisition, stacks: 1 },
            context
          )
        : await applyRelicAcquisition(state.build, acquisition, context);
    } else if (action === "power_fallback") {
      gold = resolveCanonicalGold(
        state,
        policy.power.emptyPoolFallback.sourceId,
        policy.power.emptyPoolFallback.baseGold
      );
      awardCanonicalGoldV08(state, gold.amount, "run_gold");
    }
    return {
      nextState: state,
      publicResult: {
        action,
        hpCost,
        durationTurns: policy.power.durationTurns,
        relicId: choice.privateData.relicId ?? null,
        fallbackGold: gold?.amount ?? 0
      },
      authoritativeCost: {
        type: "temporary_max_hp",
        amount: hpCost,
        durationTurns: policy.power.durationTurns
      },
      authoritativeReward: action === "power_acquire"
        ? { relicId: choice.privateData.relicId, stacks: 1 }
        : gold
          ? { gold: gold.amount, baseGold: gold.baseAmount }
          : null
    };
  }, context);
}

export function advanceCrossroadsTurnsV08(metaState, turns = 1) {
  if (!Number.isSafeInteger(turns) || turns < 0) {
    throw new TypeError("CROSSROADS_TURNS_INVALID");
  }
  const next = structuredClone(metaState);
  const resources = next.build.resources;
  resources.turn += turns;
  if (
    resources.crossroadsPowerMaxHpPenalty > 0 &&
    resources.crossroadsPowerExpireTurn <= resources.turn
  ) {
    resources.maxHp += resources.crossroadsPowerMaxHpPenalty;
    resources.crossroadsPowerMaxHpPenalty = 0;
    resources.crossroadsPowerExpireTurn = -1;
    next.specialRoomScheduleState.crossroadsPenaltyActive = false;
  }
  return next;
}
