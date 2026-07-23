export const FIXTURE_RULESET_HASH = "sha256:online-v3-fixture-ruleset";

function cloneBuild(build) {
  return {
    relics: build.relics.map((entry) => ({ ...entry })),
    mutators: [...build.mutators],
    skillTiers: { ...build.skillTiers },
    elixirs: [...build.elixirs],
    bossDepthSummary: build.bossDepthSummary.map((entry) => ({ ...entry }))
  };
}

function reject(code) {
  return { accepted: false, code };
}

function relicEvent(state, request) {
  const relicId = String(request.payload?.relicId || "");
  const offer = state.rewardOffer;
  if (!offer) return reject("REWARD_ALREADY_CLAIMED");
  if (!offer.relicIds.includes(relicId)) return reject("RELIC_NOT_OFFERED");
  const build = cloneBuild(state.build);
  const current = build.relics.find((entry) => entry.id === relicId);
  if (current && current.stacks >= offer.maxStacks) return reject("STACK_LIMIT_EXCEEDED");
  if (current) current.stacks += 1;
  else build.relics.push({ id: relicId, stacks: 1 });
  return {
    accepted: true,
    nextMeta: { build, rewardOffer: null },
    publicResult: { relicId }
  };
}

function mutatorEvent(state, request) {
  const mutatorId = String(request.payload?.mutatorId || "");
  const offered = Array.isArray(state.offers?.mutators) ? state.offers.mutators : [];
  if (!offered.includes(mutatorId)) return reject("MUTATOR_NOT_OFFERED");
  const build = cloneBuild(state.build);
  if (!build.mutators.includes(mutatorId)) build.mutators.push(mutatorId);
  return {
    accepted: true,
    nextMeta: {
      build,
      offers: { ...state.offers, mutators: [] }
    },
    publicResult: { mutatorId }
  };
}

function merchantEvent(state, request) {
  const itemId = String(request.payload?.itemId || "");
  const item = state.merchantInventory.find((entry) => entry.id === itemId);
  if (!item) return reject("MERCHANT_ITEM_NOT_FOUND");
  if (state.gold < item.cost) return reject("INSUFFICIENT_GOLD");
  return {
    accepted: true,
    nextMeta: {
      gold: state.gold - item.cost,
      merchantInventory: state.merchantInventory.filter((entry) => entry.id !== itemId),
      statistics: {
        ...state.statistics,
        merchantPurchases: Math.max(0, Number(state.statistics.merchantPurchases) || 0) + 1
      }
    },
    publicResult: { itemId, cost: item.cost }
  };
}

function skillEvent(state, request) {
  const skillId = String(request.payload?.skillId || "");
  const offer = state.offers?.skills?.find((entry) => entry.id === skillId);
  if (!offer) return reject("SKILL_NOT_OFFERED");
  if (state.gold < offer.cost) return reject("INSUFFICIENT_GOLD");
  const build = cloneBuild(state.build);
  build.skillTiers[skillId] = offer.tier;
  return {
    accepted: true,
    nextMeta: {
      gold: state.gold - offer.cost,
      build,
      offers: {
        ...state.offers,
        skills: state.offers.skills.filter((entry) => entry.id !== skillId)
      }
    },
    publicResult: { skillId, tier: offer.tier, cost: offer.cost }
  };
}

function elixirEvent(state, request) {
  const elixirId = String(request.payload?.elixirId || "");
  const offered = Array.isArray(state.offers?.elixirs) ? state.offers.elixirs : [];
  if (!offered.includes(elixirId)) return reject("ELIXIR_NOT_OFFERED");
  const build = cloneBuild(state.build);
  if (!build.elixirs.includes(elixirId)) build.elixirs.push(elixirId);
  return {
    accepted: true,
    nextMeta: {
      build,
      offers: { ...state.offers, elixirs: [] }
    },
    publicResult: { elixirId }
  };
}

function simplePaidEvent(state, request, offerKey, idField, invalidCode) {
  const selectedId = String(request.payload?.[idField] || "");
  const offers = Array.isArray(state.offers?.[offerKey]) ? state.offers[offerKey] : [];
  const offer = offers.find((entry) => entry.id === selectedId);
  if (!offer) return reject(invalidCode);
  if (state.gold < offer.cost) return reject("INSUFFICIENT_GOLD");
  return {
    accepted: true,
    nextMeta: {
      gold: state.gold - offer.cost,
      offers: {
        ...state.offers,
        [offerKey]: offers.filter((entry) => entry.id !== selectedId)
      },
      statistics: {
        ...state.statistics,
        [offerKey]: Math.max(0, Number(state.statistics[offerKey]) || 0) + 1
      }
    },
    publicResult: { [idField]: selectedId, cost: offer.cost }
  };
}

export const fixtureRuleset = Object.freeze({
  rulesetHash: FIXTURE_RULESET_HASH,

  createInitialMetaState() {
    return {
      gold: 0,
      lives: 3,
      build: {
        relics: [],
        mutators: [],
        skillTiers: { dash: 0, aoe: 0, shield: 0 },
        elixirs: [],
        bossDepthSummary: []
      },
      statistics: {
        roomsCleared: 0,
        bossesCleared: 0,
        merchantPurchases: 0
      },
      rewardOffer: null,
      merchantInventory: [],
      offers: {},
      specialRoomSchedule: [
        { afterDepth: 2, roomType: "merchant" },
        { afterDepth: 4, roomType: "fixture_boss" }
      ]
    };
  },

  issueRoomDirective(state, context) {
    const roomIndex = state.roomIndex + 1;
    const depth = state.depth + 1;
    const scheduled = state.specialRoomSchedule.find((entry) => entry.afterDepth === depth);
    return {
      id: context.directiveId,
      roomIndex,
      depth,
      roomType: scheduled?.roomType || "combat",
      roomNonce: context.nonce,
      publicData: { fixture: true }
    };
  },

  resolveCheckpointRewards(state) {
    const clearedBoss = state.roomDirective.roomType === "fixture_boss";
    const build = cloneBuild(state.build);
    if (clearedBoss) {
      build.bossDepthSummary.push({
        depth: state.roomDirective.depth,
        bossId: "fixture_boss",
        outcome: "cleared"
      });
    }
    return {
      depthDelta: 1,
      goldDelta: 10,
      build,
      statistics: {
        ...state.statistics,
        bossesCleared: Math.max(0, Number(state.statistics.bossesCleared) || 0) +
          (clearedBoss ? 1 : 0)
      },
      rewardOffer: {
        id: `fixture_reward_${state.roomIndex}`,
        relicIds: ["fixture_ember", "fixture_wardstone"],
        maxStacks: 2
      },
      merchantInventory: [
        { id: `fixture_potion_${state.roomIndex}`, type: "potion", cost: 7 }
      ],
      offers: {
        mutators: ["fixture_greed"],
        skills: [{ id: "dash", tier: 1, cost: 4 }],
        elixirs: ["fixture_fury"],
        camp: [{ id: "fixture_camp_hp", cost: 5 }],
        forge: [{ id: "fixture_temper", cost: 6 }],
        pacts: [{ id: "fixture_pact", cost: 3 }]
      },
      specialRoomSchedule: state.specialRoomSchedule
    };
  },

  validateMetaEvent(state, request) {
    switch (request.type) {
      case "reward_selected":
      case "relic_selected":
        return relicEvent(state, request);
      case "mutator_selected":
        return mutatorEvent(state, request);
      case "skill_upgraded":
        return skillEvent(state, request);
      case "elixir_selected":
        return elixirEvent(state, request);
      case "merchant_purchase":
        return merchantEvent(state, request);
      case "camp_upgrade":
        return simplePaidEvent(state, request, "camp", "upgradeId", "CAMP_UPGRADE_NOT_OFFERED");
      case "forge_action":
        return simplePaidEvent(state, request, "forge", "actionId", "FORGE_ACTION_NOT_OFFERED");
      case "pact_selected":
        return simplePaidEvent(state, request, "pacts", "pactId", "PACT_NOT_OFFERED");
      case "life_lost":
        if (state.lives <= 0) return reject("NO_LIVES_REMAINING");
        return {
          accepted: true,
          nextMeta: { lives: state.lives - 1 },
          publicResult: { lives: state.lives - 1 }
        };
      case "extract":
        return {
          accepted: true,
          nextMeta: { extractRequested: true },
          publicResult: { extractRequested: true }
        };
      default:
        return reject("EVENT_TYPE_INVALID");
    }
  },

  computeFinalScore(state) {
    return (
      state.depth * 100 +
      state.gold * 10 +
      Math.max(0, Number(state.statistics.bossesCleared) || 0) * 500
    );
  },

  buildLeaderboardSummary(state, context) {
    return {
      build: cloneBuild(state.build),
      summary: {
        outcome: context.outcome,
        roomsCleared: Math.max(0, Number(state.statistics.roomsCleared) || 0),
        bossesCleared: Math.max(0, Number(state.statistics.bossesCleared) || 0),
        bossDepthSummary: state.build.bossDepthSummary.map((entry) => ({ ...entry }))
      }
    };
  }
});
