import forgePolicyDocument from "./data/forge-transaction-policy.generated.json" with { type: "json" };
import {
  commitMetaTransactionV08,
  consumeCanonicalMetaSourceV08,
  isCanonicalMetaSourceConsumedV08,
  issueMetaTransactionOfferV08
} from "./meta-transaction.js";
import {
  applyRelicAcquisition,
  applyRelicRemovalV08,
  applyRelicReplacementBuildV08,
  getRelicCatalogEntryV08,
  V08_RELIC_POLICY_DATA
} from "./relic-policy.js";
import { evaluateRelicAcquisition } from "./relic-replacement.js";
import { deriveIntInclusive } from "./rng.js";

const policy = forgePolicyDocument.canonicalData;
const catalog = V08_RELIC_POLICY_DATA.catalog.relics;
const rarityOrder = Object.freeze(["normal", "rare", "epic", "legendary", "mythic"]);

export const FORGE_POLICY_SPEC = Object.freeze({
  moduleFile: "forge-policy.js",
  authority: "SERVER_ISSUED",
  actions: Object.freeze(["temper", "transmute"]),
  offerBinding: "runId+rulesetHash+revision+state/build digest+roomDirectiveId",
  implementationStatus: "m1-test-only"
});

export const V08_FORGE_TRANSACTION_POLICY = policy;

function forgeRoomBinding(metaState) {
  const directive = metaState.currentRoomDirective;
  if (!directive || directive.roomType !== "forge") {
    throw new TypeError("FORGE_SOURCE_UNAVAILABLE");
  }
  if (directive.runId && directive.runId !== metaState.runId) {
    throw new TypeError("FORGE_SOURCE_BINDING_MISMATCH");
  }
  if (directive.revision !== metaState.revision) {
    throw new TypeError("FORGE_SOURCE_STALE");
  }
  if (isCanonicalMetaSourceConsumedV08(metaState, directive.directiveId)) {
    throw new TypeError("FORGE_SOURCE_ALREADY_CONSUMED");
  }
  return {
    directiveId: directive.directiveId,
    depth: directive.depth,
    roomIndex: directive.roomIndex
  };
}

function profileForDepth(depth) {
  const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
  let selected = policy.profiles[0];
  for (const profile of policy.profiles) {
    if (safeDepth >= profile.minDepth) selected = profile;
  }
  return selected;
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
    purpose: `forge/${purpose}`,
    counter,
    cryptoProvider: context.cryptoProvider
  });
}

function baselineDraftEligible(metaState, relic) {
  if (!relic.acquisitionSources.includes("forge")) return false;
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

async function temperAcquisitionChoices(metaState, relic) {
  const decision = await evaluateRelicAcquisition(metaState, {
    incomingRelicId: relic.relicId,
    incomingStacks: 1,
    acquisitionSource: "forge",
    sourceOfferId: "forge_pending_offer",
    sourceChoiceId: "forge_pending_choice",
    sourceRewardSlotId: null
  });
  if (decision.decision === "ACQUIRE_DIRECT") {
    return [{
      kind: "forge_temper",
      label: `Temper ${relic.relicId}`,
      publicData: {
        action: "temper",
        relicId: relic.relicId,
        rarity: relic.rarity,
        cost: 0,
        replacement: false
      },
      privateData: {
        action: "temper",
        relicId: relic.relicId,
        removals: []
      }
    }];
  }
  if (decision.decision !== "REQUIRE_REPLACEMENT") return [];
  return decision.candidatePlans.map((candidate, index) => ({
    kind: "forge_temper_replacement",
    label: `Temper ${relic.relicId} replacement ${index + 1}`,
    publicData: {
      action: "temper",
      relicId: relic.relicId,
      rarity: relic.rarity,
      cost: 0,
      replacement: true,
      removals: candidate.removals.map((entry) => ({
        relicId: entry.relicId,
        stacks: -entry.targetStackDelta
      }))
    },
    privateData: {
      action: "temper",
      relicId: relic.relicId,
      removals: candidate.removals.map((entry) => ({
        relicId: entry.relicId,
        stacks: -entry.targetStackDelta
      }))
    }
  }));
}

function leaveChoice(mode) {
  return {
    kind: `forge_${mode}_leave`,
    label: mode === "temper" ? "Leave forged relic" : "Keep sacrificed relic",
    publicData: { action: "leave", mode, cost: 0 },
    privateData: { action: "leave", mode }
  };
}

function markForgeConsumed(state, binding, mode) {
  consumeCanonicalMetaSourceV08(
    state,
    "forge",
    `forge-${mode}`,
    binding.directiveId
  );
}

export async function issueForgeTemperOfferV08(metaState, context = {}) {
  if (
    metaState.pendingInventory?.sourceType === "forge" &&
    metaState.pendingInventory?.sourceId === "forge-temper"
  ) {
    return structuredClone(metaState);
  }
  const binding = forgeRoomBinding(metaState);
  const profile = profileForDepth(binding.depth);
  const pool = catalog.filter(
    (relic) =>
      profile.allowedRarities.includes(relic.rarity) &&
      baselineDraftEligible(metaState, relic)
  );
  if (!pool.length) return structuredClone(metaState);
  const candidateIndex = await randomInt(
    metaState,
    context,
    "temper-candidate",
    0,
    pool.length - 1
  );
  const relic = pool[candidateIndex];
  const choices = await temperAcquisitionChoices(metaState, relic);
  if (!choices.length) return structuredClone(metaState);
  const prepared = structuredClone(metaState);
  markForgeConsumed(prepared, binding, "temper");
  return issueMetaTransactionOfferV08(prepared, {
    sourceType: "forge",
    sourceId: "forge-temper",
    sourcePolicyVersion: policy.policyVersion,
    sourceBinding: { ...binding, profile: profile.label },
    choices: [...choices, leaveChoice("temper")]
  }, context);
}

function weightedRarityChoices(profile, sacrificedRarity) {
  const minimum = Math.max(0, rarityOrder.indexOf(sacrificedRarity));
  const allowed = profile.allowedRarities.filter(
    (rarity) => rarityOrder.indexOf(rarity) >= minimum
  );
  const effective = allowed.length ? allowed : [sacrificedRarity];
  return effective.map((rarity, index) => ({
    rarity,
    weight: Number(profile.rarityWeights[rarity]) || (index === 0 ? 1 : 0.35)
  }));
}

async function chooseWeightedRarity(metaState, context, profile, sourceRelic, outputIndex) {
  const entries = weightedRarityChoices(profile, sourceRelic.rarity);
  const scaled = entries.map((entry) => ({
    ...entry,
    units: Math.max(1, Math.round(entry.weight * 1_000_000))
  }));
  const total = scaled.reduce((sum, entry) => sum + entry.units, 0);
  let roll = await randomInt(
    metaState,
    context,
    `transmute/${sourceRelic.relicId}/rarity`,
    outputIndex,
    total - 1
  );
  for (const entry of scaled) {
    if (roll < entry.units) return entry.rarity;
    roll -= entry.units;
  }
  return scaled.at(-1).rarity;
}

async function legalTransmuteCandidates(
  metaState,
  sourceRelic,
  profile,
  used,
  context
) {
  const removed = await applyRelicRemovalV08(
    metaState.build,
    { relicId: sourceRelic.relicId, stacks: 1 },
    context
  );
  const legal = [];
  for (const relic of catalog) {
    if (
      relic.relicId === sourceRelic.relicId ||
      used.has(relic.relicId) ||
      !relic.acquisitionSources.includes("forge") ||
      !profile.allowedRarities.includes(relic.rarity)
    ) {
      continue;
    }
    try {
      await applyRelicAcquisition(removed, {
        relicId: relic.relicId,
        acquiredRevision: metaState.revision,
        acquisitionSource: "forge",
        sourceOfferId: "forge_pending_offer"
      }, context);
      legal.push(relic);
    } catch {
      // Only candidates producing a complete canonical build are offerable.
    }
  }
  return legal;
}

async function transmuteChoicesForSource(metaState, sourceEntry, profile, context) {
  const sourceRelic = getRelicCatalogEntryV08(sourceEntry.relicId);
  const used = new Set();
  const choices = [];
  for (let outputIndex = 0; outputIndex < policy.transmute.outputCount; outputIndex += 1) {
    const legal = await legalTransmuteCandidates(
      metaState,
      sourceRelic,
      profile,
      used,
      context
    );
    if (!legal.length) break;
    const preferredRarity = await chooseWeightedRarity(
      metaState,
      context,
      profile,
      sourceRelic,
      outputIndex
    );
    const preferred = legal.filter((relic) => relic.rarity === preferredRarity);
    const pool = preferred.length ? preferred : legal;
    const resultIndex = await randomInt(
      metaState,
      context,
      `transmute/${sourceRelic.relicId}/candidate`,
      outputIndex,
      pool.length - 1
    );
    const result = pool[resultIndex];
    used.add(result.relicId);
    choices.push({
      kind: "forge_transmute",
      label: `Transmute ${sourceRelic.relicId} into ${result.relicId}`,
      publicData: {
        action: "transmute",
        sacrificeRelicId: sourceRelic.relicId,
        sacrificeRarity: sourceRelic.rarity,
        resultRelicId: result.relicId,
        resultRarity: result.rarity,
        cost: 0
      },
      privateData: {
        action: "transmute",
        sacrificeRelicId: sourceRelic.relicId,
        resultRelicId: result.relicId
      }
    });
  }
  return choices;
}

export async function issueForgeTransmuteOfferV08(metaState, context = {}) {
  if (
    metaState.pendingInventory?.sourceType === "forge" &&
    metaState.pendingInventory?.sourceId === "forge-transmute"
  ) {
    return structuredClone(metaState);
  }
  const binding = forgeRoomBinding(metaState);
  if (!metaState.build.relics.length) {
    throw new TypeError("FORGE_TRANSMUTE_REQUIRES_RELIC");
  }
  const profile = profileForDepth(binding.depth);
  const choices = [];
  for (const sourceEntry of metaState.build.relics) {
    choices.push(...await transmuteChoicesForSource(
      metaState,
      sourceEntry,
      profile,
      context
    ));
  }
  if (!choices.length) return structuredClone(metaState);
  const prepared = structuredClone(metaState);
  markForgeConsumed(prepared, binding, "transmute");
  return issueMetaTransactionOfferV08(prepared, {
    sourceType: "forge",
    sourceId: "forge-transmute",
    sourcePolicyVersion: policy.policyVersion,
    sourceBinding: { ...binding, profile: profile.label },
    choices: [...choices, leaveChoice("transmute")]
  }, context);
}

export async function commitForgeTransactionV08(metaState, request, context = {}) {
  return commitMetaTransactionV08(metaState, request, async ({
    state,
    offer,
    choice
  }) => {
    const action = choice.privateData?.action;
    if (offer.sourceType !== "forge") {
      throw new TypeError("FORGE_TRANSACTION_SOURCE_MISMATCH");
    }
    if (action === "leave") {
      return {
        nextState: state,
        publicResult: { action: "leave", mode: choice.privateData.mode },
        authoritativeCost: { amount: 0, currency: "run_gold" }
      };
    }
    if (action === "temper") {
      const acquisition = {
        relicId: choice.privateData.relicId,
        acquiredRevision: state.revision,
        acquisitionSource: "forge",
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
      return {
        nextState: state,
        publicResult: {
          action,
          relicId: choice.privateData.relicId,
          buildDigest: state.build.buildDigest
        },
        authoritativeCost: { amount: 0, currency: "run_gold" },
        authoritativeReward: {
          relicId: choice.privateData.relicId,
          stacks: 1
        }
      };
    }
    if (action === "transmute") {
      const removed = await applyRelicRemovalV08(
        state.build,
        { relicId: choice.privateData.sacrificeRelicId, stacks: 1 },
        context
      );
      state.build = await applyRelicAcquisition(removed, {
        relicId: choice.privateData.resultRelicId,
        acquiredRevision: state.revision,
        acquisitionSource: "forge",
        sourceOfferId: offer.offerId
      }, context);
      return {
        nextState: state,
        publicResult: {
          action,
          sacrificeRelicId: choice.privateData.sacrificeRelicId,
          resultRelicId: choice.privateData.resultRelicId,
          buildDigest: state.build.buildDigest
        },
        authoritativeCost: { amount: 0, currency: "run_gold" },
        authoritativeReward: {
          relicId: choice.privateData.resultRelicId,
          stacks: 1
        }
      };
    }
    throw new TypeError("FORGE_TRANSACTION_ACTION_UNKNOWN");
  }, context);
}
