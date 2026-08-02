import campPolicyDocument from "./data/camp-transaction-policy.generated.json" with { type: "json" };
import {
  awardCanonicalGoldV08,
  commitMetaTransactionV08,
  issueMetaTransactionOfferV08,
  spendCanonicalGoldV08
} from "./meta-transaction.js";
import {
  applyRelicRemovalV08,
  getRelicCatalogEntryV08
} from "./relic-policy.js";
import { deriveRelicOfferOpaqueIdV08 } from "./relic-offer-common.js";
import {
  applyCanonicalRunModifierSelection,
  deriveRunModifierEffects,
  V08_RUN_MODIFIER_DATA
} from "./run-modifiers.js";

const policy = campPolicyDocument.canonicalData;
const upgradeById = new Map(policy.upgrades.map((entry) => [entry.id, entry]));
const elixirById = new Map(policy.elixirs.map((entry) => [entry.id, entry]));
const mutatorCatalog = V08_RUN_MODIFIER_DATA.catalog;
const maximumActiveMutators = V08_RUN_MODIFIER_DATA.selection.maximumActiveModifiers;

export const CAMP_POLICY_SPEC = Object.freeze({
  moduleFile: "camp-policy.js",
  authority: "SERVER_ISSUED",
  actions: Object.freeze([
    "upgrade",
    "elixir-buy-refill",
    "elixir-discard",
    "relic-sale",
    "mutator-add",
    "mutator-remove"
  ]),
  offerBinding: "runId+rulesetHash+revision+state/build digest+campSessionId",
  implementationStatus: "m1-test-only"
});

export const V08_CAMP_TRANSACTION_POLICY = policy;

function currentElixir(build) {
  const entries = Array.isArray(build.elixirs) ? build.elixirs : [];
  if (!entries.length) return null;
  if (entries.length !== 1) throw new TypeError("CAMP_ELIXIR_LOADOUT_INVALID");
  const entry = entries[0];
  const definition = elixirById.get(entry.elixirId);
  if (
    !definition ||
    !Number.isSafeInteger(entry.charges) ||
    entry.charges < 1 ||
    entry.charges > policy.elixirStackMaximum
  ) {
    throw new TypeError("CAMP_ELIXIR_LOADOUT_INVALID");
  }
  return { entry, definition };
}

function requireCampSession(metaState) {
  const session = metaState.campSession;
  if (!session || session.active !== true) {
    throw new TypeError("CAMP_SOURCE_UNAVAILABLE");
  }
  if (
    !Number.isFinite(session.shopCostMultiplier) ||
    session.shopCostMultiplier < 0
  ) {
    throw new TypeError("CAMP_SOURCE_BINDING_MISMATCH");
  }
  return session;
}

export async function beginCampSessionV08(metaState, context = {}) {
  if (metaState.pendingInventory) {
    throw new TypeError("CAMP_SESSION_PENDING_TRANSACTION");
  }
  if (metaState.campSession?.active) return structuredClone(metaState);
  const next = structuredClone(metaState);
  const sessionId = await deriveRelicOfferOpaqueIdV08(
    metaState,
    context,
    "camp/session-id",
    metaState.metaTransactionReceipts.length,
    "camp_session"
  );
  next.campSession = {
    sessionId,
    active: true,
    openedRevision: metaState.revision,
    shopCostMultiplier:
      deriveRunModifierEffects(metaState.runModifiers).economyModifiers.shopCostMultiplier
  };
  return next;
}

export function closeCampSessionV08(metaState) {
  if (metaState.pendingInventory) {
    throw new TypeError("CAMP_SESSION_PENDING_TRANSACTION");
  }
  const next = structuredClone(metaState);
  next.campSession = null;
  return next;
}

function upgradeCost(build, upgrade, multiplier) {
  const level = Number(build.campUpgrades[upgrade.id] ?? 0);
  if (!Number.isSafeInteger(level) || level < 0 || level > upgrade.max) {
    throw new TypeError(`CAMP_UPGRADE_LEVEL_INVALID:${upgrade.id}`);
  }
  const base = Math.round(upgrade.baseCost * upgrade.costGrowth ** level);
  return Math.max(0, Math.round(base * multiplier));
}

function upgradeChoices(metaState, session) {
  const choices = [];
  for (const upgrade of policy.upgrades) {
    const level = Number(metaState.build.campUpgrades[upgrade.id] ?? 0);
    if (!Number.isSafeInteger(level) || level < 0 || level > upgrade.max) {
      throw new TypeError(`CAMP_UPGRADE_LEVEL_INVALID:${upgrade.id}`);
    }
    if (level >= upgrade.max) continue;
    const cost = upgradeCost(metaState.build, upgrade, session.shopCostMultiplier);
    choices.push({
      kind: "camp_upgrade",
      label: `Upgrade ${upgrade.id} to ${level + 1}`,
      publicData: {
        action: "upgrade",
        upgradeId: upgrade.id,
        currentLevel: level,
        resultingLevel: level + 1,
        maximumLevel: upgrade.max,
        price: cost,
        currency: "camp_gold"
      },
      privateData: {
        action: "upgrade",
        upgradeId: upgrade.id,
        expectedLevel: level,
        cost
      }
    });
  }
  return choices;
}

function elixirChoices(metaState) {
  const active = currentElixir(metaState.build);
  const highestDepth = metaState.build.resources.highestUnlockedDepth;
  const choices = [];
  if (active) {
    const missing = policy.elixirStackMaximum - active.entry.charges;
    if (missing > 0) {
      const cost = Math.max(
        1,
        Math.ceil(active.definition.cost * missing / policy.elixirStackMaximum)
      );
      choices.push({
        kind: "camp_elixir_refill",
        label: `Refill ${active.definition.id}`,
        publicData: {
          action: "elixir_refill",
          elixirId: active.definition.id,
          currentCharges: active.entry.charges,
          resultingCharges: policy.elixirStackMaximum,
          price: cost,
          currency: "camp_gold"
        },
        privateData: {
          action: "elixir_buy_refill",
          elixirId: active.definition.id,
          expectedCharges: active.entry.charges,
          cost
        }
      });
    }
    const refund = Math.max(
      0,
      Math.floor(
        active.definition.cost *
          policy.elixirDiscardRefundRatio *
          (active.entry.charges / policy.elixirStackMaximum)
      )
    );
    choices.push({
      kind: "camp_elixir_discard",
      label: `Discard ${active.definition.id}`,
      publicData: {
        action: "elixir_discard",
        elixirId: active.definition.id,
        charges: active.entry.charges,
        refund,
        currency: "camp_gold"
      },
      privateData: {
        action: "elixir_discard",
        elixirId: active.definition.id,
        expectedCharges: active.entry.charges,
        refund
      }
    });
    return choices;
  }
  for (const elixir of policy.elixirs) {
    if (highestDepth < elixir.unlockDepth) continue;
    choices.push({
      kind: "camp_elixir_buy",
      label: `Buy ${elixir.id}`,
      publicData: {
        action: "elixir_buy",
        elixirId: elixir.id,
        tier: elixir.tier,
        charges: policy.elixirStackMaximum,
        price: elixir.cost,
        currency: "camp_gold"
      },
      privateData: {
        action: "elixir_buy_refill",
        elixirId: elixir.id,
        expectedCharges: 0,
        cost: elixir.cost
      }
    });
  }
  return choices;
}

function mutatorChoices(metaState) {
  const activeIds = metaState.runModifiers.active
    .map((entry) => entry.modifierId)
    .sort();
  const unlockedIds = new Set(metaState.mutatorProgress.unlockedMutatorIds);
  const additions = activeIds.length >= maximumActiveMutators
    ? []
    : mutatorCatalog.modifiers
        .filter((modifier) =>
          unlockedIds.has(modifier.modifierId) && !activeIds.includes(modifier.modifierId)
        )
        .map((modifier) => ({
          kind: "camp_mutator_add",
          label: "Enable " + modifier.displayName,
          publicData: {
            action: "mutator_add",
            mutatorId: modifier.modifierId,
            displayName: modifier.displayName,
            currentActiveCount: activeIds.length,
            maximumActiveMutators
          },
          privateData: {
            action: "mutator_add",
            mutatorId: modifier.modifierId,
            expectedActiveIds: activeIds
          }
        }));
  const removals = mutatorCatalog.modifiers
    .filter((modifier) => activeIds.includes(modifier.modifierId))
    .map((modifier) => ({
      kind: "camp_mutator_remove",
      label: "Disable " + modifier.displayName,
      publicData: {
        action: "mutator_remove",
        mutatorId: modifier.modifierId,
        displayName: modifier.displayName,
        currentActiveCount: activeIds.length,
        maximumActiveMutators
      },
      privateData: {
        action: "mutator_remove",
        mutatorId: modifier.modifierId,
        expectedActiveIds: activeIds
      }
    }));
  return [...additions, ...removals];
}

function relicSaleChoices(metaState) {
  return metaState.build.relics.map((entry) => {
    const relic = getRelicCatalogEntryV08(entry.relicId);
    const value = policy.relicReturnValues[relic.rarity];
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new TypeError(`CAMP_RELIC_RETURN_VALUE_INVALID:${relic.rarity}`);
    }
    return {
      kind: "camp_relic_sale",
      label: `Confirm sale ${relic.relicId}`,
      publicData: {
        action: "relic_sale",
        relicId: relic.relicId,
        rarity: relic.rarity,
        currentStacks: entry.stacks,
        stacksSold: 1,
        reward: value,
        currency: "camp_gold",
        requiresConfirmation: true
      },
      privateData: {
        action: "relic_sale",
        relicId: relic.relicId,
        expectedStacks: entry.stacks,
        reward: value
      }
    };
  });
}

export async function issueCampTransactionsV08(metaState, context = {}) {
  const session = requireCampSession(metaState);
  const sourceId = `camp-transactions-${metaState.metaTransactionReceipts.length}`;
  if (
    metaState.pendingInventory?.sourceType === "camp" &&
    metaState.pendingInventory?.sourceId === sourceId
  ) {
    return structuredClone(metaState);
  }
  const choices = [
    ...upgradeChoices(metaState, session),
    ...elixirChoices(metaState),
    ...relicSaleChoices(metaState),
    ...mutatorChoices(metaState)
  ];
  if (!choices.length) return structuredClone(metaState);
  return issueMetaTransactionOfferV08(metaState, {
    sourceType: "camp",
    sourceId,
    sourcePolicyVersion: policy.policyVersion,
    sourceBinding: {
      sessionId: session.sessionId,
      openedRevision: session.openedRevision,
      shopCostMultiplier: session.shopCostMultiplier
    },
    choices
  }, context);
}

function applyInstantUpgradePreview(build, upgradeId) {
  if (upgradeId === "vitality") {
    const level = build.campUpgrades[upgradeId];
    const oldMultiplier = 1 + (level - 1) * 0.1;
    const newMultiplier = 1 + level * 0.1;
    const previousMax = build.resources.maxHp;
    const previousHp = build.resources.hp;
    build.resources.maxHp = Math.max(
      1,
      Math.round(previousMax * newMultiplier / oldMultiplier)
    );
    build.resources.hp = Math.max(
      1,
      Math.min(
        build.resources.maxHp,
        Math.round(previousHp * newMultiplier / oldMultiplier)
      )
    );
  } else if (upgradeId === "satchel") {
    build.resources.maxPotions += 1;
    build.resources.potions = Math.min(
      build.resources.maxPotions,
      build.resources.potions + 1
    );
  }
}

export async function commitCampTransactionV08(metaState, request, context = {}) {
  return commitMetaTransactionV08(metaState, request, async ({
    state,
    offer,
    choice
  }) => {
    if (offer.sourceType !== "camp") {
      throw new TypeError("CAMP_TRANSACTION_SOURCE_MISMATCH");
    }
    const session = requireCampSession(state);
    if (session.sessionId !== offer.sourceBinding.sessionId) {
      throw new TypeError("CAMP_SESSION_STALE");
    }
    const action = choice.privateData?.action;
    if (action === "upgrade") {
      const upgrade = upgradeById.get(choice.privateData.upgradeId);
      if (!upgrade) throw new TypeError("CAMP_UPGRADE_UNKNOWN");
      const current = Number(state.build.campUpgrades[upgrade.id] ?? 0);
      if (
        current !== choice.privateData.expectedLevel ||
        current >= upgrade.max ||
        upgradeCost(state.build, upgrade, session.shopCostMultiplier) !==
          choice.privateData.cost
      ) {
        throw new TypeError("CAMP_UPGRADE_TARGET_STALE");
      }
      const spent = spendCanonicalGoldV08(
        state,
        choice.privateData.cost,
        "camp_gold"
      );
      state.build.campUpgrades[upgrade.id] = current + 1;
      applyInstantUpgradePreview(state.build, upgrade.id);
      return {
        nextState: state,
        publicResult: {
          action,
          upgradeId: upgrade.id,
          level: current + 1
        },
        authoritativeCost: spent
      };
    }
    if (action === "elixir_buy_refill") {
      const elixir = elixirById.get(choice.privateData.elixirId);
      if (!elixir) throw new TypeError("CAMP_ELIXIR_UNKNOWN");
      const active = currentElixir(state.build);
      const charges = active?.entry.charges ?? 0;
      if (
        charges !== choice.privateData.expectedCharges ||
        active && active.definition.id !== elixir.id ||
        state.build.resources.highestUnlockedDepth < elixir.unlockDepth
      ) {
        throw new TypeError("CAMP_ELIXIR_TARGET_STALE");
      }
      const expectedCost = charges
        ? Math.max(
            1,
            Math.ceil(
              elixir.cost *
                (policy.elixirStackMaximum - charges) /
                policy.elixirStackMaximum
            )
          )
        : elixir.cost;
      if (expectedCost !== choice.privateData.cost) {
        throw new TypeError("CAMP_ELIXIR_COST_STALE");
      }
      const spent = spendCanonicalGoldV08(state, expectedCost, "camp_gold");
      state.build.elixirs = [{
        elixirId: elixir.id,
        charges: policy.elixirStackMaximum
      }];
      return {
        nextState: state,
        publicResult: {
          action,
          elixirId: elixir.id,
          charges: policy.elixirStackMaximum
        },
        authoritativeCost: spent
      };
    }
    if (action === "elixir_discard") {
      const active = currentElixir(state.build);
      if (
        !active ||
        active.definition.id !== choice.privateData.elixirId ||
        active.entry.charges !== choice.privateData.expectedCharges
      ) {
        throw new TypeError("CAMP_ELIXIR_TARGET_STALE");
      }
      const refund = Math.max(
        0,
        Math.floor(
          active.definition.cost *
            policy.elixirDiscardRefundRatio *
            (active.entry.charges / policy.elixirStackMaximum)
        )
      );
      if (refund !== choice.privateData.refund) {
        throw new TypeError("CAMP_ELIXIR_REFUND_STALE");
      }
      state.build.elixirs = [];
      awardCanonicalGoldV08(state, refund, "camp_gold");
      return {
        nextState: state,
        publicResult: { action, elixirId: active.definition.id, refund },
        authoritativeReward: { campGold: refund }
      };
    }
    if (action === "mutator_add" || action === "mutator_remove") {
      const currentIds = state.runModifiers.active
        .map((entry) => entry.modifierId)
        .sort();
      if (JSON.stringify(currentIds) !== JSON.stringify(choice.privateData.expectedActiveIds)) {
        throw new TypeError("CAMP_MUTATOR_TARGET_STALE");
      }
      const mutatorId = choice.privateData.mutatorId;
      if (action === "mutator_add" && !state.mutatorProgress.unlockedMutatorIds.includes(mutatorId)) {
        throw new TypeError("CAMP_MUTATOR_LOCKED");
      }
      if (action === "mutator_add" && currentIds.length >= maximumActiveMutators) {
        throw new TypeError("CAMP_MUTATOR_LIMIT");
      }
      if (action === "mutator_remove" && !currentIds.includes(mutatorId)) {
        throw new TypeError("CAMP_MUTATOR_NOT_ACTIVE");
      }
      const modifierIds = action === "mutator_add"
        ? [...currentIds, mutatorId]
        : currentIds.filter((id) => id !== mutatorId);
      const nextState = await applyCanonicalRunModifierSelection(
        state,
        {
          modifierIds,
          activationSource: "server-issued-mid-run"
        },
        { ...context, authority: "TRUSTED_RULESET_DOMAIN" }
      );
      return {
        nextState,
        publicResult: {
          action,
          mutatorId,
          activeCount: nextState.runModifiers.activeCount
        }
      };
    }
    if (action === "relic_sale") {
      const entry = state.build.relics.find(
        (candidate) => candidate.relicId === choice.privateData.relicId
      );
      if (!entry || entry.stacks !== choice.privateData.expectedStacks) {
        throw new TypeError("CAMP_RELIC_SALE_TARGET_STALE");
      }
      const relic = getRelicCatalogEntryV08(entry.relicId);
      const reward = policy.relicReturnValues[relic.rarity];
      if (reward !== choice.privateData.reward) {
        throw new TypeError("CAMP_RELIC_SALE_REWARD_STALE");
      }
      state.build = await applyRelicRemovalV08(
        state.build,
        { relicId: relic.relicId, stacks: 1 },
        context
      );
      awardCanonicalGoldV08(state, reward, "camp_gold");
      return {
        nextState: state,
        publicResult: { action, relicId: relic.relicId, reward },
        authoritativeReward: { campGold: reward }
      };
    }
    throw new TypeError("CAMP_TRANSACTION_ACTION_UNKNOWN");
  }, context);
}
