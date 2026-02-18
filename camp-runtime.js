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
      saveRunSnapshot,
      grantPotion,
      merchantPotionCost,
      STORAGE_TOTAL_MERCHANT_POTS
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
        pushLog(`Merchant: ${skill.name} is already Epic.`, "bad");
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
      pushLog(
        `Merchant reforges ${skill.name} to ${newLabel}. -${cost} gold (${payment.fromRun} run, ${payment.fromCamp} camp).${
          nextCost ? ` Next: ${nextCost}g.` : " Max tier reached."
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

    return {
      getMerchantUpgradeWalletTotal,
      spendMerchantUpgradeGold,
      openMerchantMenu,
      closeMerchantMenu,
      tryBuySkillUpgradeFromMerchant,
      tryBuyPotionFromMerchant
    };
  }

  window.DungeonCampRuntime = {
    create
  };
})();
