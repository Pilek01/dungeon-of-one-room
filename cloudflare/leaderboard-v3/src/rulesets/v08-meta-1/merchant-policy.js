import { applyMutatorProgressDeltaV08 } from "./mutator-progression.js";
import merchantPolicyDocument from "./data/merchant-transaction-policy.generated.json" with { type: "json" };
import {
  commitMetaTransactionV08,
  issueMetaTransactionOfferV08,
  awardCanonicalGoldV08,
  spendCanonicalGoldV08
} from "./meta-transaction.js";
import {
  applyRelicAcquisition,
  applyRelicRemovalV08,
  applyRelicReplacementBuildV08,
  getRelicCatalogEntryV08,
  V08_RELIC_POLICY_DATA
} from "./relic-policy.js";
import {
  evaluateRelicAcquisition,
  isRelicDraftEligibleV08
} from "./relic-replacement.js";
import { deriveIntInclusive } from "./rng.js";
import { deriveRunModifierEffects } from "./run-modifiers.js";

const policy = merchantPolicyDocument.canonicalData;
const catalog = V08_RELIC_POLICY_DATA.catalog.relics;
const tierByRarity = new Map(policy.relicTiers.map((entry) => [entry.rarity, entry]));
const returnByRarity = new Map(
  policy.relicReturnValues.map((entry) => [entry.rarity, entry.value])
);

export const MERCHANT_POLICY_SPEC = Object.freeze({
  moduleFile: "merchant-policy.js",
  authority: "SERVER_ISSUED",
  inventoryKinds: Object.freeze([
    "relic",
    "service",
    "skill-upgrade",
    "reserved-relic",
    "buyback",
    "black-market"
  ]),
  invalidation: "accepted purchase, room transition, run finalization, or newer revision",
  implementationStatus: "m1-test-only"
});

function randomInt(metaState, context, purpose, counter, maximum) {
  const derive = context.randomOracle?.deriveIntInclusive
    ? context.randomOracle.deriveIntInclusive.bind(context.randomOracle)
    : deriveIntInclusive;
  return derive(0, maximum, {
    secret: context.secret,
    rulesetId: metaState.rulesetId,
    runId: metaState.runId,
    revision: metaState.revision,
    purpose: `merchant/${purpose}`,
    counter,
    cryptoProvider: context.cryptoProvider
  });
}

function merchantDiscount(build) {
  const owned = new Set(build.relics.map((entry) => entry.relicId));
  if (owned.has("merchfavor3")) return 0.45;
  if (owned.has("merchfavor")) return 0.30;
  if (owned.has("merchfavor1")) return 0.15;
  return 0;
}

function discounted(base, build) {
  return Math.max(1, Math.round(base * (1 - merchantDiscount(build))));
}

function shopMultiplier(metaState) {
  return deriveRunModifierEffects(metaState.runModifiers).economyModifiers.shopCostMultiplier;
}

function potionCost(metaState, purchaseOffset) {
  const bought = metaState.build.merchant.potionsBought + purchaseOffset;
  const base = Math.min(50, 10 * (bought + 1));
  const pactMultiplier = metaState.build.pacts.includes("avarice") ? 2 : 1;
  return Math.round(
    discounted(base, metaState.build) *
      shopMultiplier(metaState) *
      pactMultiplier
  );
}

function skillCost(metaState, base) {
  return Math.max(
    1,
    Math.round(discounted(base, metaState.build) * shopMultiplier(metaState))
  );
}

function merchantRoomBinding(metaState) {
  const directive = metaState.currentRoomDirective;
  if (!directive || directive.roomType !== "merchant") {
    throw new TypeError("MERCHANT_SOURCE_UNAVAILABLE");
  }
  if (directive.runId && directive.runId !== metaState.runId) {
    throw new TypeError("MERCHANT_SOURCE_BINDING_MISMATCH");
  }
  if (directive.revision !== metaState.revision) {
    throw new TypeError("MERCHANT_SOURCE_STALE");
  }
  return {
    directiveId: directive.directiveId,
    depth: directive.depth,
    roomIndex: directive.roomIndex
  };
}

function rarityForRoll(roll) {
  let cursor = roll;
  for (const tier of policy.relicTiers) {
    cursor -= tier.weight;
    if (cursor < 0) return tier;
  }
  return policy.relicTiers.at(-1);
}

function candidatePool(metaState, rarity, excluded = new Set(), context = {}) {
  const owned = new Set(metaState.build.relics.map((entry) => entry.relicId));
  const all = catalog.filter(
    (entry) =>
      entry.rarity === rarity &&
      entry.acquisitionSources.includes("merchant") &&
      !excluded.has(entry.relicId) &&
      isRelicDraftEligibleV08(metaState.build, entry.relicId, context)
  );
  const unowned = all.filter((entry) => !owned.has(entry.relicId));
  return unowned.length ? unowned : all;
}

async function acquisitionChoices(
  metaState,
  relicId,
  source,
  cost,
  currency,
  group,
  context = {}
) {
  const decision = await evaluateRelicAcquisition(metaState, {
    incomingRelicId: relicId,
    incomingStacks: 1,
    acquisitionSource: source,
    sourceOfferId: "merchant_pending_offer",
    sourceChoiceId: "merchant_pending_choice",
    sourceRewardSlotId: null
  }, context);
  const relic = getRelicCatalogEntryV08(relicId);
  if (decision.decision === "ACQUIRE_DIRECT") {
    return [{
      kind: source === "merchant" ? "merchant_relic_purchase" : "merchant_reserved_claim",
      label: `Acquire ${relic.relicId}`,
      publicData: {
        relicId: relic.relicId,
        rarity: relic.rarity,
        price: cost,
        currency,
        replacement: false
      },
      privateData: {
        action: "acquire_relic",
        relicId: relic.relicId,
        acquisitionSource: source,
        cost,
        currency,
        group,
        removals: []
      }
    }];
  }
  if (decision.decision !== "REQUIRE_REPLACEMENT") return [];
  return decision.candidatePlans.map((candidate, index) => ({
    kind: "merchant_relic_replacement",
    label: `Acquire ${relic.relicId} replacement ${index + 1}`,
    publicData: {
      relicId: relic.relicId,
      rarity: relic.rarity,
      price: cost,
      currency,
      replacement: true,
      removals: candidate.removals.map((entry) => ({
        relicId: entry.relicId,
        stacks: -entry.targetStackDelta
      }))
    },
    privateData: {
      action: "acquire_relic",
      relicId: relic.relicId,
      acquisitionSource: source,
      cost,
      currency,
      group,
      removals: candidate.removals.map((entry) => ({
        relicId: entry.relicId,
        stacks: -entry.targetStackDelta
      }))
    }
  }));
}

function markGroupSold(state, group, exceptTransactionId) {
  if (!group) return;
  for (const choice of state.pendingInventory.choices) {
    if (
      choice.transactionId !== exceptTransactionId &&
      choice.privateData?.group === group &&
      choice.status === "available"
    ) {
      choice.status = "sold";
    }
  }
}

async function blackMarketChoices(metaState, context) {
  const results = [];
  let counter = 0;
  for (const owned of metaState.build.relics) {
    const source = getRelicCatalogEntryV08(owned.relicId);
    const targetRarity = source.rarity === "normal"
      ? "rare"
      : source.rarity === "rare"
        ? "epic"
        : null;
    if (!targetRarity) continue;
    const pool = candidatePool(metaState, targetRarity, new Set([source.relicId]));
    if (!pool.length) continue;
    const index = await randomInt(
      metaState,
      context,
      "black-market-result",
      counter,
      pool.length - 1
    );
    counter += 1;
    const result = pool[index];
    try {
      await applyRelicReplacementBuildV08(
        metaState.build,
        [{ relicId: source.relicId, stacks: 1 }],
        {
          relicId: result.relicId,
          stacks: 1,
          acquiredRevision: metaState.revision,
          acquisitionSource: "merchant",
          sourceOfferId: "merchant_pending_offer"
        },
        context
      );
    } catch {
      continue;
    }
    results.push({
      kind: "merchant_black_market",
      label: `Transmute owned ${source.relicId}`,
      publicData: {
        targetRelicId: source.relicId,
        targetRarity: source.rarity,
        resultRarity: targetRarity,
        price: 0,
        currency: "run_gold"
      },
      privateData: {
        action: "black_market",
        targetRelicId: source.relicId,
        resultRelicId: result.relicId,
        cost: 0,
        currency: "run_gold",
        group: "merchant-service"
      }
    });
  }
  return results;
}

export async function issueMerchantInventoryV08(metaState, context = {}) {
  const sourceBinding = merchantRoomBinding(metaState);
  const choices = [];
  const resources = metaState.build.resources;
  const missingPotions = Math.max(0, resources.maxPotions - resources.potions);
  for (let offset = 0; offset < missingPotions; offset += 1) {
    const cost = potionCost(metaState, offset);
    choices.push({
      kind: "merchant_potion",
      label: `Potion ${offset + 1}`,
      status: offset === 0 ? "available" : "locked",
      publicData: { price: cost, currency: "run_then_camp" },
      privateData: {
        action: "potion",
        expectedBought: metaState.build.merchant.potionsBought + offset,
        cost,
        currency: "run_then_camp"
      }
    });
  }
  for (const [skillId, offers] of Object.entries(policy.skillUpgrades)) {
    const currentTier = metaState.build.skillTiers[skillId] || 0;
    for (const offer of offers.filter((entry) => entry.tier > currentTier)) {
      if (
        offer.tier === policy.maximumSkillTier &&
        resources.highestUnlockedDepth < policy.legendarySkillRequiredDepth
      ) {
        continue;
      }
      const cost = skillCost(metaState, offer.cost);
      choices.push({
        kind: "merchant_skill_upgrade",
        label: `${skillId} tier ${offer.tier}`,
        status: offer.tier === currentTier + 1 ? "available" : "locked",
        publicData: {
          skillId,
          tier: offer.tier,
          price: cost,
          currency: "run_then_camp"
        },
        privateData: {
          action: "skill_upgrade",
          skillId,
          fromTier: offer.tier - 1,
          toTier: offer.tier,
          cost,
          currency: "run_then_camp"
        }
      });
    }
  }

  const reserved = metaState.build.merchant.reservedRelic;
  if (reserved) {
    choices.push(...await acquisitionChoices(
      metaState,
      reserved.relicId,
      "merchant",
      reserved.remainingPrice,
      "run_then_camp",
      "merchant-reserved",
      context
    ));
    choices.push({
      kind: "merchant_reserved_discard",
      label: `Discard reserved ${reserved.relicId}`,
      publicData: { relicId: reserved.relicId, depositRefund: 0 },
      privateData: {
        action: "discard_reserved",
        relicId: reserved.relicId,
        cost: 0,
        currency: "run_gold",
        group: "merchant-reserved"
      }
    });
  } else {
    const totalWeight = policy.relicTiers.reduce((sum, entry) => sum + entry.weight, 0);
    const rarityRoll = await randomInt(
      metaState,
      context,
      "relic-rarity",
      0,
      totalWeight - 1
    );
    const tier = rarityForRoll(rarityRoll);
    const pool = candidatePool(metaState, tier.rarity, new Set(), context);
    if (pool.length) {
      const candidateIndex = await randomInt(
        metaState,
        context,
        "relic-candidate",
        0,
        pool.length - 1
      );
      const relic = pool[candidateIndex];
      const price = discounted(tier.price, metaState.build);
      choices.push(...await acquisitionChoices(
        metaState,
        relic.relicId,
        "merchant",
        price,
        "run_then_camp",
        "merchant-relic-slot",
        context
      ));
      const deposit = Math.max(1, Math.round(price * policy.reservationDepositRatio));
      const claimChoices = await acquisitionChoices(
        metaState,
        relic.relicId,
        "merchant",
        price - deposit,
        "run_then_camp",
        "merchant-reserved",
        context
      );
      for (const claimChoice of claimChoices) {
        claimChoice.status = "locked";
        claimChoice.kind = "merchant_reserved_claim";
        claimChoice.label = `Claim reserved ${relic.relicId}`;
        claimChoice.publicData.price = price - deposit;
        claimChoice.privateData.cost = price - deposit;
      }
      choices.push(...claimChoices);
      choices.push({
        kind: "merchant_relic_reserve",
        label: `Reserve ${relic.relicId}`,
        publicData: {
          relicId: relic.relicId,
          totalPrice: price,
          deposit,
          remainingPrice: price - deposit,
          currency: "run_then_camp"
        },
        privateData: {
          action: "reserve_relic",
          relicId: relic.relicId,
          totalPrice: price,
          deposit,
          remainingPrice: price - deposit,
          cost: deposit,
          currency: "run_then_camp",
          group: "merchant-relic-slot"
        }
      });
    }
  }

  for (const owned of metaState.build.relics) {
    if (owned.relicId === metaState.build.merchant.reservedRelic?.relicId) continue;
    const relic = getRelicCatalogEntryV08(owned.relicId);
    const payout = Math.max(
      1,
      Math.round((returnByRarity.get(relic.rarity) || 0) * policy.buybackRatio)
    );
    choices.push({
      kind: "merchant_buyback",
      label: `Sell ${owned.relicId}`,
      publicData: {
        relicId: owned.relicId,
        stacksAvailable: owned.stacks,
        payout,
        currency: "run_gold"
      },
      privateData: {
        action: "buyback",
        relicId: owned.relicId,
        payout,
        currency: "run_gold"
      }
    });
  }

  const lifeRoll = await randomInt(metaState, context, "service-life", 0, 99);
  const services = policy.services.filter(
    (entry) =>
      (
        entry.id !== "secondchance" ||
        metaState.build.merchant.secondChancePurchases <
          policy.maximumSecondChancePurchases
      ) &&
      (
        context.capabilities?.boundedCombatResources !== "v1" ||
        entry.id !== "fullheal" ||
        metaState.build.resources.hp < metaState.build.resources.maxHp
      )
  );
  const service = metaState.lives < policy.maximumLives && lifeRoll < 10
    ? policy.extraLifeService
    : services[await randomInt(
        metaState,
        context,
        "service-choice",
        0,
        Math.max(0, services.length - 1)
      )] || null;
  if (service?.id === "blackmarket") {
    choices.push(...await blackMarketChoices(metaState, context));
  } else if (service) {
    const cost = discounted(service.baseCost, metaState.build);
    choices.push({
      kind: "merchant_service",
      label: service.id,
      publicData: {
        serviceId: service.id,
        price: cost,
        currency: "run_then_camp"
      },
      privateData: {
        action: "service",
        serviceId: service.id,
        cost,
        currency: "run_then_camp",
        group: "merchant-service"
      }
    });
  }
  choices.push({
    kind: "leave",
    label: "Leave Merchant",
    publicData: {},
    privateData: { action: "leave", cost: 0, currency: "run_gold" }
  });
  return issueMetaTransactionOfferV08(metaState, {
    sourceType: "merchant",
    sourceId: "merchant-room",
    sourcePolicyVersion: policy.policyVersion,
    sourceBinding,
    choices
  }, context);
}

async function applyAcquisition(next, offer, choice, context) {
  const data = choice.privateData;
  const acquisition = {
    relicId: data.relicId,
    stacks: 1,
    acquiredRevision: next.revision,
    acquisitionSource: data.acquisitionSource,
    sourceOfferId: offer.offerId
  };
  next.build = data.removals.length
    ? await applyRelicReplacementBuildV08(
        next.build,
        data.removals,
        acquisition,
        context
      )
    : await applyRelicAcquisition(next.build, acquisition, context);
  if (data.group === "merchant-reserved") {
    next.build.merchant.reservedRelic = null;
  }
}

export async function commitMerchantTransactionV08(metaState, request, context = {}) {
  return commitMetaTransactionV08(metaState, request, async ({
    state: next,
    offer,
    choice
  }) => {
    if (offer.sourceType !== "merchant" || offer.sourceId !== "merchant-room") {
      throw new TypeError("MERCHANT_TRANSACTION_SOURCE_MISMATCH");
    }
    merchantRoomBinding(next);
    const data = choice.privateData;
    let authoritativeCost = null;
    let authoritativeReward = null;
    if (data.action === "leave") {
      return {
        nextState: next,
        consumeOffer: true,
        publicResult: { left: true }
      };
    }
    if (data.action === "potion") {
      if (
        next.build.merchant.potionsBought !== data.expectedBought ||
        next.build.resources.potions >= next.build.resources.maxPotions
      ) {
        throw new TypeError("MERCHANT_POTION_CHOICE_STALE");
      }
      authoritativeCost = spendCanonicalGoldV08(next, data.cost, data.currency);
      next.build.resources.potions += 1;
      next.build.merchant.potionsBought += 1;
      next.mutatorProgress = applyMutatorProgressDeltaV08(next.mutatorProgress, {
        totalMerchantPots: next.mutatorProgress.totalMerchantPots + 1
      });
      const nextPotion = next.pendingInventory.choices.find(
        (entry) =>
          entry.privateData?.action === "potion" &&
          entry.privateData.expectedBought === data.expectedBought + 1
      );
      if (nextPotion?.status === "locked") nextPotion.status = "available";
    } else if (data.action === "skill_upgrade") {
      if ((next.build.skillTiers[data.skillId] || 0) !== data.fromTier) {
        throw new TypeError("MERCHANT_SKILL_CHOICE_STALE");
      }
      authoritativeCost = spendCanonicalGoldV08(next, data.cost, data.currency);
      next.build.skillTiers[data.skillId] = data.toTier;
      const nextSkill = next.pendingInventory.choices.find(
        (entry) =>
          entry.privateData?.action === "skill_upgrade" &&
          entry.privateData.skillId === data.skillId &&
          entry.privateData.fromTier === data.toTier
      );
      if (nextSkill?.status === "locked") nextSkill.status = "available";
    } else if (data.action === "acquire_relic") {
      if (
        data.group === "merchant-reserved" &&
        next.build.merchant.reservedRelic?.relicId !== data.relicId
      ) {
        throw new TypeError("MERCHANT_RESERVED_RELIC_STALE");
      }
      await applyAcquisition(next, offer, choice, context);
      authoritativeCost = spendCanonicalGoldV08(next, data.cost, data.currency);
      markGroupSold(next, data.group, choice.transactionId);
    } else if (data.action === "reserve_relic") {
      if (next.build.merchant.reservedRelic) {
        throw new TypeError("MERCHANT_RESERVATION_ALREADY_ACTIVE");
      }
      authoritativeCost = spendCanonicalGoldV08(next, data.cost, data.currency);
      next.build.merchant.reservedRelic = {
        relicId: data.relicId,
        totalPrice: data.totalPrice,
        depositPaid: data.deposit,
        remainingPrice: data.remainingPrice
      };
      markGroupSold(next, data.group, choice.transactionId);
      for (const pending of next.pendingInventory.choices) {
        if (
          pending.privateData?.group === "merchant-reserved" &&
          pending.privateData?.relicId === data.relicId &&
          pending.status === "locked"
        ) {
          pending.status = "available";
        }
      }
    } else if (data.action === "discard_reserved") {
      if (next.build.merchant.reservedRelic?.relicId !== data.relicId) {
        throw new TypeError("MERCHANT_RESERVED_RELIC_STALE");
      }
      next.build.merchant.reservedRelic = null;
      markGroupSold(next, data.group, choice.transactionId);
    } else if (data.action === "buyback") {
      if (next.build.merchant.reservedRelic?.relicId === data.relicId) {
        throw new TypeError("MERCHANT_RESERVED_RELIC_BUYBACK_FORBIDDEN");
      }
      next.build = await applyRelicRemovalV08(
        next.build,
        { relicId: data.relicId, stacks: 1 },
        context
      );
      authoritativeReward = awardCanonicalGoldV08(next, data.payout, data.currency);
    } else if (data.action === "black_market") {
      next.build = await applyRelicReplacementBuildV08(
        next.build,
        [{ relicId: data.targetRelicId, stacks: 1 }],
        {
          relicId: data.resultRelicId,
          stacks: 1,
          acquiredRevision: next.revision,
          acquisitionSource: "merchant",
          sourceOfferId: offer.offerId
        },
        context
      );
      markGroupSold(next, data.group, choice.transactionId);
    } else if (data.action === "service") {
      const resources = next.build.resources;
      if (data.serviceId === "fullheal") {
        if (resources.hp >= resources.maxHp) throw new TypeError("MERCHANT_FULL_HEAL_NOT_LEGAL");
        resources.hp = resources.maxHp;
      } else if (data.serviceId === "combatboost") {
        if (resources.combatBoostTurns > 0) {
          throw new TypeError("MERCHANT_COMBAT_BOOST_ALREADY_ACTIVE");
        }
        resources.combatBoostTurns = 100;
        resources.combatBoostAttack = 20;
        resources.combatBoostArmor = 20;
      } else if (data.serviceId === "secondchance") {
        if (
          resources.hasSecondChance ||
          next.build.merchant.secondChancePurchases >=
            policy.maximumSecondChancePurchases
        ) {
          throw new TypeError("MERCHANT_SECOND_CHANCE_NOT_LEGAL");
        }
        resources.hasSecondChance = true;
        next.build.merchant.secondChancePurchases += 1;
      } else if (data.serviceId === "onelife") {
        if (next.lives >= policy.maximumLives) {
          throw new TypeError("MERCHANT_EXTRA_LIFE_NOT_LEGAL");
        }
        next.lives += 1;
      } else {
        throw new TypeError("MERCHANT_SERVICE_UNKNOWN");
      }
      authoritativeCost = spendCanonicalGoldV08(next, data.cost, data.currency);
      markGroupSold(next, data.group, choice.transactionId);
    } else {
      throw new TypeError("MERCHANT_ACTION_UNKNOWN");
    }
    return {
      nextState: next,
      consumeOffer: data.action === "discard_reserved" || data.group === "merchant-reserved",
      authoritativeCost,
      authoritativeReward,
      publicResult: {
        kind: choice.kind,
        action: data.action
      }
    };
  }, context);
}

export const V08_MERCHANT_TRANSACTION_POLICY = Object.freeze(policy);
