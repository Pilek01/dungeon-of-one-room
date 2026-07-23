(function () {
  const FORGE_PROFILES = Object.freeze([
    Object.freeze({
      minDepth: 0,
      label: "Tempered",
      choiceCount: 1,
      rarityWeights: Object.freeze({ rare: 0.72, epic: 0.28 }),
      allowedRarities: Object.freeze(["rare", "epic"])
    }),
    Object.freeze({
      minDepth: 20,
      label: "Masterwork",
      choiceCount: 1,
      rarityWeights: Object.freeze({ rare: 0.25, epic: 0.55, legendary: 0.20 }),
      allowedRarities: Object.freeze(["rare", "epic", "legendary"])
    }),
    Object.freeze({
      minDepth: 40,
      label: "Mythforged",
      choiceCount: 1,
      rarityWeights: Object.freeze({ epic: 0.58, legendary: 0.39, mythic: 0.03 }),
      allowedRarities: Object.freeze(["epic", "legendary", "mythic"])
    })
  ]);

  const FORGE_ENCOUNTER_PROFILES = Object.freeze([
    Object.freeze({
      minDepth: 0,
      enemyType: "blacksmith_guardian",
      spikeMin: 4,
      spikeMax: 6,
      mineMin: 2,
      mineMax: 3,
      flameVentMin: 2,
      flameVentMax: 3
    })
  ]);

  const FORGE_SETPIECE_LAYOUT = Object.freeze({
    originX: 3,
    originY: 0,
    width: 3,
    height: 3,
    interactX: 4,
    interactY: 3,
    guardianSpawnX: 4,
    guardianSpawnY: 3,
    playerSpawnX: 4,
    playerSpawnY: 7,
    blockedTiles: Object.freeze([
      Object.freeze({ x: 3, y: 1 }),
      Object.freeze({ x: 4, y: 1 }),
      Object.freeze({ x: 5, y: 1 }),
      Object.freeze({ x: 3, y: 2 }),
      Object.freeze({ x: 4, y: 2 }),
      Object.freeze({ x: 5, y: 2 })
    ])
  });

  function getForgeProfileForDepth(depth) {
    const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
    let profile = FORGE_PROFILES[0];
    for (const candidate of FORGE_PROFILES) {
      if (safeDepth >= candidate.minDepth) {
        profile = candidate;
      }
    }
    return profile;
  }

  function rankChoices(pool, loadout) {
    const choices = Array.isArray(pool) ? pool.filter(Boolean) : [];
    return choices.slice();
  }

  function pickWeighted(weights, random) {
    const entries = Object.entries(weights || {}).filter(([, weight]) => Number(weight) > 0);
    if (entries.length <= 0) return "";
    const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
    if (total <= 0) return entries[0][0];
    let roll = (typeof random === "function" ? random() : Math.random()) * total;
    for (const [key, weight] of entries) {
      roll -= Number(weight);
      if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
  }

  function chooseRandom(candidates, random) {
    if (!Array.isArray(candidates) || candidates.length <= 0) return null;
    const roll = typeof random === "function" ? random() : Math.random();
    const index = Math.max(0, Math.min(candidates.length - 1, Math.floor(roll * candidates.length)));
    return candidates[index] || candidates[0] || null;
  }

  function chooseForgeDraft(options = {}) {
    const depth = Math.max(0, Math.floor(Number(options.depth) || 0));
    const pool = Array.isArray(options.pool) ? options.pool.filter(Boolean) : [];
    const loadout = Array.isArray(options.loadout) ? options.loadout.filter(Boolean) : [];
    const random = typeof options.random === "function" ? options.random : Math.random;
    const profile = getForgeProfileForDepth(depth);
    const allowedRarities = new Set(profile.allowedRarities);
    const ranked = rankChoices(
      pool.filter((relic) => allowedRarities.has(relic.rarity)),
      loadout
    );

    const choices = [];
    const usedIds = new Set();
    const targetCount = Math.max(1, Math.floor(Number(options.count) || profile.choiceCount));

    for (let i = 0; i < targetCount; i += 1) {
      let candidates = [];
      if (i === 0) {
        candidates = ranked.filter((relic) => !usedIds.has(relic.id));
      } else {
        const targetRarity = pickWeighted(profile.rarityWeights, random);
        candidates = ranked.filter((relic) => relic.rarity === targetRarity && !usedIds.has(relic.id));
      }
      if (candidates.length <= 0) {
        candidates = ranked.filter((relic) => !usedIds.has(relic.id));
      }
      const choice = chooseRandom(candidates, random);
      if (!choice) break;
      choices.push(choice);
      usedIds.add(choice.id);
    }

    return {
      profile,
      choices
    };
  }

  function getForgeEncounterProfileForDepth(depth) {
    const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
    let profile = FORGE_ENCOUNTER_PROFILES[0];
    for (const candidate of FORGE_ENCOUNTER_PROFILES) {
      if (safeDepth >= candidate.minDepth) {
        profile = candidate;
      }
    }
    return profile;
  }

  function getForgeSetpieceLayout() {
    return FORGE_SETPIECE_LAYOUT;
  }

  function getForgeActionsForState(options = {}) {
    const loadout = Array.isArray(options.loadout) ? options.loadout.filter(Boolean) : [];
    return Object.freeze({
      canTemper: true,
      canTransmute: loadout.length > 0
    });
  }

  function normalizeTakeFilter(filterFn) {
    return typeof filterFn === "function" ? filterFn : (() => true);
  }

  function chooseRarityAtOrAbove(rarity, profile, random) {
    const order = ["normal", "rare", "epic", "legendary", "mythic"];
    const rarityIndex = Math.max(0, order.indexOf(String(rarity || "").toLowerCase()));
    const allowed = profile.allowedRarities
      .filter((entry) => order.indexOf(entry) >= rarityIndex);
    if (allowed.length <= 0) {
      return String(rarity || profile.allowedRarities[0] || "rare").toLowerCase();
    }
    const weights = {};
    for (const entry of allowed) {
      weights[entry] = Number(profile.rarityWeights?.[entry]) || (entry === allowed[0] ? 1 : 0.35);
    }
    return pickWeighted(weights, random) || allowed[0];
  }

  function planForgeTemper(options = {}) {
    const draft = chooseForgeDraft({
      ...options,
      count: 1
    });
    return {
      profile: draft.profile,
      relic: Array.isArray(draft.choices) ? draft.choices[0] || null : null
    };
  }

  function planForgeTransmute(options = {}) {
    const depth = Math.max(0, Math.floor(Number(options.depth) || 0));
    const pool = Array.isArray(options.pool) ? options.pool.filter(Boolean) : [];
    const loadout = Array.isArray(options.loadout) ? options.loadout.filter(Boolean) : [];
    const sacrificedRelic = options.sacrificedRelic || null;
    const random = typeof options.random === "function" ? options.random : Math.random;
    const canTakeRelic = normalizeTakeFilter(options.canTakeRelic);
    const profile = getForgeProfileForDepth(depth);
    const ranked = rankChoices(pool, loadout);
    const usedIds = new Set([String(sacrificedRelic?.id || "")]);
    const choices = [];
    const targetCount = Math.max(1, Math.floor(Number(options.count) || 3));
    const sacrificedRarity = String(sacrificedRelic?.rarity || "").toLowerCase();

    for (let i = 0; i < targetCount; i += 1) {
      const preferredRarity = chooseRarityAtOrAbove(sacrificedRarity, profile, random);
      let candidates = ranked.filter((relic) => {
        if (!relic || usedIds.has(relic.id)) return false;
        if (!profile.allowedRarities.includes(relic.rarity)) return false;
        if (!canTakeRelic(relic, { sacrificedRelic, loadout, depth, profile })) return false;
        return relic.rarity === preferredRarity;
      });
      if (candidates.length <= 0) {
        candidates = ranked.filter((relic) => {
          if (!relic || usedIds.has(relic.id)) return false;
          if (!profile.allowedRarities.includes(relic.rarity)) return false;
          if (!canTakeRelic(relic, { sacrificedRelic, loadout, depth, profile })) return false;
          return true;
        });
      }
      const choice = chooseRandom(candidates, random);
      if (!choice) break;
      choices.push(choice);
      usedIds.add(choice.id);
    }

    return {
      profile,
      sacrificedRelic,
      choices
    };
  }

  const api = {
    getForgeProfileForDepth,
    getForgeEncounterProfileForDepth,
    getForgeSetpieceLayout,
    chooseForgeDraft,
    getForgeActionsForState,
    planForgeTemper,
    planForgeTransmute
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonForgeRoom = api;
  }
})();
