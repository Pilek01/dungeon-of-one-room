(() => {
  function create(deps = {}) {
    const {
      state,
      RELICS,
      RARITY,
      RELIC_RETURN_VALUE,
      MAX_NORMAL_RELIC_STACK,
      MAX_RELICS,
      WARDEN_RELIC_DROP_TABLE,
      WARDEN_RELIC_PITY_BONUS_PER_MISS,
      WARDEN_RELIC_HARD_PITY_AFTER_MISSES,
      MAX_DEPTH,
      clamp,
      persistWardenFirstDropDepths
    } = deps;

    function hasRelic(id) {
      return state.relics.includes(id);
    }

    function getRelicById(relicId) {
      return RELICS.find((relic) => relic.id === relicId) || null;
    }

    function isLegendaryRelic(relicId) {
      const relic = getRelicById(relicId);
      return Boolean(relic && relic.rarity === "legendary");
    }

    function hasLegendaryRelic(exceptRelicId = null) {
      return state.relics.some((relicId) => relicId !== exceptRelicId && isLegendaryRelic(relicId));
    }

    function getRelicStackCount(relicId) {
      return state.relics.reduce((count, id) => count + (id === relicId ? 1 : 0), 0);
    }

    function isNormalRelicStackAtCap(relicId) {
      const relic = getRelicById(relicId);
      if (!relic || relic.rarity !== "normal") return false;
      return getRelicStackCount(relicId) >= MAX_NORMAL_RELIC_STACK;
    }

    function getRelicInventoryGroups() {
      const groups = [];
      const indexById = new Map();
      for (const relicId of state.relics) {
        const index = indexById.get(relicId);
        if (index == null) {
          groups.push({ relicId, count: 1 });
          indexById.set(relicId, groups.length - 1);
        } else {
          groups[index].count += 1;
        }
      }
      return groups;
    }

    function getRelicInventoryGroupsFromList(relicIds) {
      const groups = [];
      const indexById = new Map();
      for (const relicId of relicIds || []) {
        if (typeof relicId !== "string") continue;
        const index = indexById.get(relicId);
        if (index == null) {
          groups.push({ relicId, count: 1 });
          indexById.set(relicId, groups.length - 1);
        } else {
          groups[index].count += 1;
        }
      }
      return groups;
    }

    function getRelicExchangeBreakdown(relicIds) {
      const groups = getRelicInventoryGroupsFromList(relicIds);
      const rows = [];
      for (const group of groups) {
        const relic = getRelicById(group.relicId);
        if (!relic) continue;
        const rarity = RELIC_RETURN_VALUE[relic.rarity] != null ? relic.rarity : "normal";
        const unitValue = RELIC_RETURN_VALUE[rarity];
        rows.push({
          relicId: relic.id,
          name: relic.name,
          rarity,
          rarityInfo: RARITY[rarity] || RARITY.normal,
          count: group.count,
          unitValue,
          totalValue: unitValue * group.count
        });
      }
      rows.sort((a, b) =>
        b.totalValue - a.totalValue ||
        b.unitValue - a.unitValue ||
        a.name.localeCompare(b.name)
      );
      return rows;
    }

    function relicHotkeyForIndex(index) {
      return index === 9 ? "0" : String(index + 1);
    }

    function getRelicDiscardHotkeyHint() {
      return MAX_RELICS >= 10 ? "1-0" : `1-${MAX_RELICS}`;
    }

    function getRelicDraftSkipIndex() {
      const draftSize = Math.max(0, state.relicDraft?.length || 0);
      if (draftSize <= 3) return 3;
      return 9;
    }

    function getRelicDraftSkipHotkey() {
      return relicHotkeyForIndex(getRelicDraftSkipIndex());
    }

    function getRelicReturnSummary(relicIds) {
      const summary = {
        count: 0,
        total: 0,
        byRarity: {
          normal: 0,
          rare: 0,
          epic: 0,
          legendary: 0
        }
      };

      for (const relicId of relicIds || []) {
        const relic = getRelicById(relicId);
        if (!relic) continue;
        const rarity = RELIC_RETURN_VALUE[relic.rarity] != null ? relic.rarity : "normal";
        summary.count += 1;
        summary.byRarity[rarity] += 1;
        summary.total += RELIC_RETURN_VALUE[rarity];
      }

      return summary;
    }

    function getExtractPromptCarriedRelics(prompt = state.extractRelicPrompt) {
      if (!prompt || !Array.isArray(prompt.carriedRelics)) return [];
      return prompt.carriedRelics.filter((id) => typeof id === "string");
    }

    function sanitizeExtractRelicSelectionIndices(indices, maxCount) {
      const cap = Math.max(0, Number(maxCount) || 0);
      const sanitized = [];
      const seen = new Set();
      for (const rawIndex of indices || []) {
        const index = Math.floor(Number(rawIndex));
        if (!Number.isFinite(index) || index < 0 || index >= cap || seen.has(index)) continue;
        seen.add(index);
        sanitized.push(index);
      }
      sanitized.sort((a, b) => a - b);
      return sanitized;
    }

    function getExtractPromptSelectedIndices(prompt = state.extractRelicPrompt) {
      const carriedRelics = getExtractPromptCarriedRelics(prompt);
      return sanitizeExtractRelicSelectionIndices(prompt?.selectedIndices, carriedRelics.length);
    }

    function getExtractPromptSelectedRelics(prompt = state.extractRelicPrompt) {
      const carriedRelics = getExtractPromptCarriedRelics(prompt);
      const selectedIndices = getExtractPromptSelectedIndices(prompt);
      return selectedIndices
        .map((index) => carriedRelics[index])
        .filter((id) => typeof id === "string");
    }

    function getExtractPromptSelectedSummary(prompt = state.extractRelicPrompt) {
      return getRelicReturnSummary(getExtractPromptSelectedRelics(prompt));
    }

    function getWardenRelicTableEntry(depth = state.depth) {
      const safeDepth = Math.max(0, Number(depth) || 0);
      for (const entry of WARDEN_RELIC_DROP_TABLE) {
        if (safeDepth >= entry.minDepth) return entry;
      }
      return null;
    }

    function getWardenRelicDropChance(depth = state.depth) {
      const entry = getWardenRelicTableEntry(depth);
      return entry ? entry.dropChance : 0;
    }

    function getWardenRelicDropRoll(depth = state.depth) {
      const baseChance = getWardenRelicDropChance(depth);
      const missStreak = Math.max(0, Number(state.wardenRelicMissStreak) || 0);
      const hardPity = missStreak >= WARDEN_RELIC_HARD_PITY_AFTER_MISSES;
      const chanceValue = hardPity
        ? 1
        : clamp(baseChance + missStreak * WARDEN_RELIC_PITY_BONUS_PER_MISS, 0, 0.95);
      return { chance: chanceValue, missStreak, hardPity };
    }

    function getWardenDepthKey(depth = state.depth) {
      const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
      return String(safeDepth);
    }

    function hasUsedWardenFirstDropAtDepth(depth = state.depth) {
      const key = getWardenDepthKey(depth);
      return Boolean(state.wardenFirstDropDepths && state.wardenFirstDropDepths[key]);
    }

    function markWardenFirstDropUsedAtDepth(depth = state.depth) {
      const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
      if (safeDepth <= 0) return;
      const key = getWardenDepthKey(safeDepth);
      if (!state.wardenFirstDropDepths || typeof state.wardenFirstDropDepths !== "object") {
        state.wardenFirstDropDepths = {};
      }
      if (state.wardenFirstDropDepths[key]) return;
      state.wardenFirstDropDepths[key] = true;
      if (typeof persistWardenFirstDropDepths === "function") {
        persistWardenFirstDropDepths();
      }
    }

    function shouldForceWardenFirstDrop(depth = state.depth) {
      const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
      if (safeDepth <= 0 || safeDepth >= MAX_DEPTH) return false;
      if (safeDepth % 5 !== 0) return false;
      return !hasUsedWardenFirstDropAtDepth(safeDepth);
    }

    function getRelicsByRarity(rarity) {
      return RELICS.filter(r => r.rarity === rarity);
    }

    return {
      hasRelic,
      getRelicById,
      isLegendaryRelic,
      hasLegendaryRelic,
      getRelicStackCount,
      isNormalRelicStackAtCap,
      getRelicInventoryGroups,
      getRelicInventoryGroupsFromList,
      getRelicExchangeBreakdown,
      relicHotkeyForIndex,
      getRelicDiscardHotkeyHint,
      getRelicDraftSkipIndex,
      getRelicDraftSkipHotkey,
      getRelicReturnSummary,
      getExtractPromptCarriedRelics,
      sanitizeExtractRelicSelectionIndices,
      getExtractPromptSelectedIndices,
      getExtractPromptSelectedRelics,
      getExtractPromptSelectedSummary,
      getWardenRelicTableEntry,
      getWardenRelicDropChance,
      getWardenRelicDropRoll,
      getWardenDepthKey,
      hasUsedWardenFirstDropAtDepth,
      markWardenFirstDropUsedAtDepth,
      shouldForceWardenFirstDrop,
      getRelicsByRarity
    };
  }

  window.DungeonRelicRuntime = {
    create
  };
})();
