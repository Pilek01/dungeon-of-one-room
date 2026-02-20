(() => {
  function create(deps = {}) {
    const {
      state,
      isOnMerchant,
      markUiDirty,
      pushLog,
      SKILL_BY_ID,
      getSkillTier,
      MAX_SKILL_TIER,
      merchantSkillUpgradeCost,
      persistCampProgress,
      spawnParticles,
      spawnShockwaveRing,
      TILE,
      getSkillTierLabel,
      canBuyLegendarySkillUpgrade,
      getLegendarySkillUpgradeBlockReason,
      saveRunSnapshot,
      grantPotion,
      merchantPotionCost,
      STORAGE_TOTAL_MERCHANT_POTS,
      applyRelic,
      hasRelic,
      removeRelic,
      getRelicById,
      MERCHANT_SECOND_CHANCE_MAX_PURCHASES,
      MAX_RELICS
    } = deps;

    function getMerchantUpgradeWalletTotal() {
      const runGold = Math.max(0, Number(state.player.gold) || 0);
      const campGold = Math.max(0, Number(state.campGold) || 0);
      return runGold + campGold;
    }

    function spendMerchantUpgradeGold(amount) {
      const cost = Math.max(0, Number(amount) || 0);
      const fromRun = Math.min(Math.max(0, state.player.gold), cost);
      state.player.gold -= fromRun;
      const fromCamp = cost - fromRun;
      if (fromCamp > 0) {
        state.campGold = Math.max(0, state.campGold - fromCamp);
      }
      return { fromRun, fromCamp };
    }

    function openMerchantMenu() {
      if (state.phase !== "playing") return false;
      if (state.roomType !== "merchant") return false;
      if (!isOnMerchant()) return false;
      state.merchantMenuOpen = true;
      markUiDirty();
      return true;
    }

    function closeMerchantMenu(logText = "") {
      if (!state.merchantMenuOpen) return false;
      state.merchantMenuOpen = false;
      state.blackMarketPending = null;
      state.merchantRelicSwapPending = null;
      if (logText) {
        pushLog(logText);
      } else {
        markUiDirty();
      }
      return true;
    }

    function tryBuySkillUpgradeFromMerchant(skillId) {
      if (state.phase !== "playing") return false;
      if (state.roomType !== "merchant") return false;
      if (!isOnMerchant()) return false;

      const skill = SKILL_BY_ID[skillId];
      if (!skill) return false;

      const tier = getSkillTier(skillId);
      if (tier >= MAX_SKILL_TIER) {
        pushLog(`Merchant: ${skill.name} is already ${getSkillTierLabel(skillId)}.`, "bad");
        return false;
      }

      const nextTier = tier + 1;
      if (
        nextTier >= 3 &&
        typeof canBuyLegendarySkillUpgrade === "function" &&
        !canBuyLegendarySkillUpgrade(skillId)
      ) {
        const blockReason =
          typeof getLegendarySkillUpgradeBlockReason === "function"
            ? getLegendarySkillUpgradeBlockReason(skillId)
            : "Legendary upgrade is locked.";
        pushLog(`Merchant: ${blockReason}`, "bad");
        return false;
      }

      const cost = merchantSkillUpgradeCost(skillId);
      if (cost == null) {
        pushLog("Merchant has no upgrade offer.", "bad");
        return false;
      }
      const wallet = getMerchantUpgradeWalletTotal();
      if (wallet < cost) {
        pushLog(`Merchant: need ${cost} gold for ${skill.name} upgrade (run + camp).`, "bad");
        return false;
      }

      const payment = spendMerchantUpgradeGold(cost);
      state.skillTiers[skillId] = tier + 1;
      persistCampProgress();
      spawnParticles(state.player.x, state.player.y, "#9fdcff", 13, 1.25);
      spawnShockwaveRing(state.player.x, state.player.y, {
        color: "#8fd9ff",
        core: "#e9f6ff",
        maxRadius: TILE * 2.7,
        life: 300
      });

      const newLabel = getSkillTierLabel(skillId);
      const nextCost = merchantSkillUpgradeCost(skillId);
      const nextBlockedReason =
        typeof canBuyLegendarySkillUpgrade === "function" && !canBuyLegendarySkillUpgrade(skillId)
          ? (typeof getLegendarySkillUpgradeBlockReason === "function"
            ? getLegendarySkillUpgradeBlockReason(skillId)
            : "")
          : "";
      pushLog(
        `Merchant reforges ${skill.name} to ${newLabel}. -${cost} gold (${payment.fromRun} run, ${payment.fromCamp} camp).${
          nextBlockedReason
            ? ` ${nextBlockedReason}`
            : nextCost
              ? ` Next: ${nextCost}g.`
              : " Max tier reached."
        }`,
        "good"
      );
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    function tryBuyPotionFromMerchant() {
      if (state.phase !== "playing") return false;
      if (state.roomType !== "merchant") return false;
      if (!isOnMerchant()) return false;
      if (state.player.potions >= state.player.maxPotions) {
        pushLog(`Merchant: potion bag full (${state.player.potions}/${state.player.maxPotions}).`, "bad");
        return false;
      }
      const cost = merchantPotionCost();
      const wallet = getMerchantUpgradeWalletTotal();
      if (wallet < cost) {
        pushLog(`Merchant: need ${cost} gold for a potion (run + camp).`, "bad");
        return false;
      }
      const payment = spendMerchantUpgradeGold(cost);
      if (payment.fromCamp > 0) {
        persistCampProgress();
      }
      state.merchantPotionsBought = (state.merchantPotionsBought || 0) + 1;
      state.totalMerchantPots += 1;
      localStorage.setItem(STORAGE_TOTAL_MERCHANT_POTS, String(state.totalMerchantPots));
      grantPotion(1);
      spawnParticles(state.player.x, state.player.y, "#ffd98a", 10, 1.15);
      const nextCost = merchantPotionCost();
      pushLog(
        `Merchant deal: -${cost} gold (${payment.fromRun} run, ${payment.fromCamp} camp), +1 potion (${state.player.potions}/${state.player.maxPotions}). Next: ${nextCost}g.`,
        "good"
      );
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    function tryBuyRelicFromMerchant() {
      if (state.phase !== "playing") return false;
      if (state.roomType !== "merchant") return false;
      if (!isOnMerchant()) return false;
      const slot = state.merchantRelicSlot;
      if (!slot) {
        pushLog("No relic available from merchant.", "bad");
        return false;
      }
      const cost = slot.price;
      const wallet = getMerchantUpgradeWalletTotal();
      if (wallet < cost) {
        pushLog(`Merchant: need ${cost} gold for this relic.`, "bad");
        return false;
      }
      const relic = getRelicById(slot.relicId);
      if (!relic) {
        pushLog("Merchant relic data error.", "bad");
        return false;
      }
      // Check if inventory is full — prompt swap instead of hard-fail
      if (state.relics.length >= MAX_RELICS) {
        state.merchantRelicSwapPending = { relicId: slot.relicId, price: cost };
        pushLog(`Relic inventory full (${MAX_RELICS}/${MAX_RELICS}). Choose a relic to replace with ${relic.name} (press 1-${MAX_RELICS} in shop).`, "bad");
        markUiDirty();
        return true;
      }
      const applied = applyRelic(slot.relicId);
      if (!applied) {
        pushLog(`Cannot acquire ${relic.name} right now (already owned).`, "bad");
        return false;
      }
      spendMerchantUpgradeGold(cost);
      state.merchantRelicSlot = null;
      spawnParticles(state.player.x, state.player.y, "#ffb020", 14, 1.3);
      pushLog(`Merchant: acquired ${relic.name} for ${cost} gold.`, "good");
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    function tryBuyFullHeal() {
      if (state.phase !== "playing") return false;
      if (state.roomType !== "merchant") return false;
      if (!isOnMerchant()) return false;
      if (state.merchantServiceSlot !== "fullheal") {
        pushLog("Full Heal not available today.", "bad");
        return false;
      }
      const baseCost = 150;
      const cost = hasRelic("merchfavor") ? Math.round(baseCost * 0.5) : baseCost;
      const wallet = getMerchantUpgradeWalletTotal();
      if (wallet < cost) {
        pushLog(`Merchant: need ${cost} gold for Full Heal.`, "bad");
        return false;
      }
      if (state.player.hp >= state.player.maxHp) {
        pushLog("Already at full HP.", "bad");
        return false;
      }
      spendMerchantUpgradeGold(cost);
      const healed = state.player.maxHp - state.player.hp;
      state.player.hp = state.player.maxHp;
      state.merchantServiceSlot = null;
      spawnParticles(state.player.x, state.player.y, "#80ff80", 14, 1.3);
      pushLog(`Merchant: Full Heal for ${cost} gold (+${healed} HP).`, "good");
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    function tryBuyCombatBoost() {
      if (state.phase !== "playing") return false;
      if (state.roomType !== "merchant") return false;
      if (!isOnMerchant()) return false;
      if (state.merchantServiceSlot !== "combatboost") {
        pushLog("Combat Boost not available today.", "bad");
        return false;
      }
      if (state.player.combatBoostTurns > 0) {
        pushLog("Combat Boost already active.", "bad");
        return false;
      }
      const baseCost = 200;
      const cost = hasRelic("merchfavor") ? Math.round(baseCost * 0.5) : baseCost;
      const wallet = getMerchantUpgradeWalletTotal();
      if (wallet < cost) {
        pushLog(`Merchant: need ${cost} gold for Combat Boost.`, "bad");
        return false;
      }
      spendMerchantUpgradeGold(cost);
      state.player.combatBoostTurns = 30;
      state.player.attack += 20;
      state.player.armor += 20;
      state.merchantServiceSlot = null;
      spawnParticles(state.player.x, state.player.y, "#ff8040", 14, 1.3);
      pushLog(`Merchant: Combat Boost active for 30 turns (+20 ATK, +20 ARM). -${cost} gold.`, "good");
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    function tryBuySecondChance() {
      if (state.phase !== "playing") return false;
      if (state.roomType !== "merchant") return false;
      if (!isOnMerchant()) return false;
      if (state.merchantServiceSlot !== "secondchance") {
        pushLog("Second Chance not available today.", "bad");
        return false;
      }
      if (state.player.hasSecondChance) {
        pushLog("Second Chance already active.", "bad");
        return false;
      }
      if (state.merchantSecondChancePurchases >= MERCHANT_SECOND_CHANCE_MAX_PURCHASES) {
        pushLog("Second Chance not available.", "bad");
        return false;
      }
      const baseCost = 800;
      const cost = hasRelic("merchfavor") ? Math.round(baseCost * 0.5) : baseCost;
      const wallet = getMerchantUpgradeWalletTotal();
      if (wallet < cost) {
        pushLog(`Merchant: need ${cost} gold for Second Chance.`, "bad");
        return false;
      }
      spendMerchantUpgradeGold(cost);
      state.player.hasSecondChance = true;
      state.merchantSecondChancePurchases += 1;
      state.merchantServiceSlot = null;
      spawnParticles(state.player.x, state.player.y, "#cc44ff", 14, 1.3);
      pushLog(`Merchant: Second Chance purchased. Next fatal blow survived. -${cost} gold.`, "good");
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    function tryUseBlackMarket(relicId) {
      if (state.phase !== "playing") return false;
      if (state.roomType !== "merchant") return false;
      if (!isOnMerchant()) return false;
      if (state.merchantServiceSlot !== "blackmarket") {
        pushLog("Black Market not available today.", "bad");
        return false;
      }
      const relic = getRelicById(relicId);
      if (!relic) {
        pushLog("Invalid relic selected.", "bad");
        return false;
      }
      if (!state.relics.includes(relicId)) {
        pushLog("You don't own that relic.", "bad");
        return false;
      }
      const UPGRADE_MAP = { normal: "rare", rare: "epic" };
      const targetRarity = UPGRADE_MAP[relic.rarity];
      if (!targetRarity) {
        pushLog(`Cannot upgrade ${relic.name} at the Black Market (Epic→Legendary not available).`, "bad");
        return false;
      }
      const targetPool = (window.DungeonRelicData?.RELICS || []).filter(r => r.rarity === targetRarity);
      if (targetPool.length === 0) {
        pushLog("No relics available at that tier.", "bad");
        return false;
      }
      const newRelic = targetPool[Math.floor(Math.random() * targetPool.length)];
      removeRelic(relicId);
      const applied = applyRelic(newRelic.id);
      if (!applied) {
        applyRelic(relicId);
        pushLog(`Cannot acquire ${newRelic.name} (inventory conflict). Trade cancelled.`, "bad");
        return false;
      }
      state.merchantServiceSlot = null;
      state.blackMarketPending = null;
      spawnParticles(state.player.x, state.player.y, "#ffaa00", 16, 1.4);
      pushLog(`Black Market: traded ${relic.name} for ${newRelic.name}.`, "good");
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    function tryMerchantRelicSwap(relicIndex) {
      if (!state.merchantRelicSwapPending) return false;
      const { relicId: newRelicId, price } = state.merchantRelicSwapPending;
      const idx = Number(relicIndex);
      if (isNaN(idx) || idx < 0 || idx >= state.relics.length) return false;
      const outRelicId = state.relics[idx];
      const outRelic = getRelicById(outRelicId);
      const newRelic = getRelicById(newRelicId);
      if (!outRelic || !newRelic) return false;
      removeRelic(outRelicId);
      const applied = applyRelic(newRelicId);
      if (!applied) {
        applyRelic(outRelicId);
        pushLog(`Cannot acquire ${newRelic.name}. Trade cancelled.`, "bad");
        state.merchantRelicSwapPending = null;
        markUiDirty();
        return false;
      }
      spendMerchantUpgradeGold(price);
      state.merchantRelicSlot = null;
      state.merchantRelicSwapPending = null;
      spawnParticles(state.player.x, state.player.y, "#ffb020", 14, 1.3);
      spawnShockwaveRing(state.player.x, state.player.y, {
        color: "#ffb020",
        core: "#fff8e0",
        maxRadius: TILE * 2.7,
        life: 300
      });
      pushLog(`Merchant: swapped ${outRelic.name} → ${newRelic.name} for ${price} gold.`, "good");
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    return {
      getMerchantUpgradeWalletTotal,
      spendMerchantUpgradeGold,
      openMerchantMenu,
      closeMerchantMenu,
      tryBuySkillUpgradeFromMerchant,
      tryBuyPotionFromMerchant,
      tryBuyRelicFromMerchant,
      tryBuyRelicSwap: tryMerchantRelicSwap,
      tryBuyFullHeal,
      tryBuyCombatBoost,
      tryBuySecondChance,
      tryUseBlackMarket
    };
  }

  window.DungeonCampRuntime = {
    create
  };
})();
