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
      setStorageItem,
      STORAGE_TOTAL_MERCHANT_POTS,
      applyRelic,
      hasMythicRelic,
      isLegendaryRelicCapReached,
      getLegendaryRelicCap,
      removeRelic,
      getRelicById,
      getMerchantRelicBuybackPrice,
      getMerchantFavorDiscountedCost,
      MERCHANT_SECOND_CHANCE_MAX_PURCHASES,
      MAX_RELICS,
      getRelicSlotCap,
      getRelicSlotCapWithIncoming,
      syncMutatorUnlocks,
      grantLife,
      MAX_LIVES
    } = deps;

    function getCurrentRelicSlotCap() {
      const cap = Number(typeof getRelicSlotCap === "function" ? getRelicSlotCap() : MAX_RELICS);
      return Math.max(1, Math.floor(Number.isFinite(cap) ? cap : MAX_RELICS));
    }

    function getIncomingRelicSlotCap(relicId) {
      if (typeof getRelicSlotCapWithIncoming === "function") {
        const cap = Number(getRelicSlotCapWithIncoming(relicId));
        if (Number.isFinite(cap)) return Math.max(1, Math.floor(cap));
      }
      return getCurrentRelicSlotCap();
    }

    function getRelicSlotHint() {
      const cap = getCurrentRelicSlotCap();
      return cap >= 10 ? "1-0" : `1-${cap}`;
    }

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
      state.merchantLegendarySwapPending = null;
      state.merchantBuybackPending = null;
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
      if (typeof setStorageItem === "function") {
        setStorageItem(STORAGE_TOTAL_MERCHANT_POTS, String(state.totalMerchantPots));
      }
      grantPotion(1);
      spawnParticles(state.player.x, state.player.y, "#ffd98a", 10, 1.15);
      const nextCost = merchantPotionCost();
      pushLog(
        `Merchant deal: -${cost} gold (${payment.fromRun} run, ${payment.fromCamp} camp), +1 potion (${state.player.potions}/${state.player.maxPotions}). Next: ${nextCost}g.`,
        "good"
      );
      state.merchantPotsThisRun = (state.merchantPotsThisRun || 0) + 1;
      syncMutatorUnlocks();
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
      if ((relic.rarity === "legendary" || relic.rarity === "mythic") && state.relics.includes(relic.id)) {
        pushLog(`You already own ${relic.name}.`, "bad");
        return false;
      }
      if (relic.rarity === "legendary" && isLegendaryRelicCapReached()) {
        const currentLegendaryId = state.relics.find((id) => {
          const owned = getRelicById(id);
          return owned && owned.rarity === "legendary";
        }) || null;
        if (!currentLegendaryId) {
          pushLog("Legendary swap unavailable right now.", "bad");
          return false;
        }
        state.merchantLegendarySwapPending = {
          source: "offer",
          relicId: slot.relicId,
          price: cost,
          currentLegendaryId
        };
        state.merchantBuybackPending = null;
        pushLog(`Legendary cap reached (${getLegendaryRelicCap()}/${getLegendaryRelicCap()}). Choose swap for ${relic.name} (1 keep current, 2 take new).`, "bad");
        markUiDirty();
        return true;
      }
      if (relic.rarity === "mythic" && hasMythicRelic()) {
        const currentMythicId = state.relics.find((id) => {
          const owned = getRelicById(id);
          return owned && owned.rarity === "mythic";
        }) || null;
        if (!currentMythicId) {
          pushLog("Mythic swap unavailable right now.", "bad");
          return false;
        }
        state.merchantLegendarySwapPending = {
          source: "offer",
          relicId: slot.relicId,
          price: cost,
          currentLegendaryId: currentMythicId
        };
        state.merchantBuybackPending = null;
        pushLog(`Mythic limit: choose swap for ${relic.name} (1 keep current, 2 take new).`, "bad");
        markUiDirty();
        return true;
      }
      // Check if inventory is full — prompt swap instead of hard-fail
      const relicSlotCap = getIncomingRelicSlotCap(slot.relicId);
      if (state.relics.length >= relicSlotCap) {
        state.merchantRelicSwapPending = { source: "offer", relicId: slot.relicId, price: cost };
        state.merchantBuybackPending = null;
        pushLog(`Relic inventory full (${relicSlotCap}/${relicSlotCap}). Choose a relic to replace with ${relic.name} (press ${getRelicSlotHint()} in shop).`, "bad");
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

    function tryReserveRelicFromMerchant() {
      if (state.phase !== "playing") return false;
      if (state.roomType !== "merchant") return false;
      if (!isOnMerchant()) return false;
      const slot = state.merchantRelicSlot;
      if (!slot) {
        pushLog("No relic available to reserve.", "bad");
        return false;
      }
      const relic = getRelicById(slot.relicId);
      if (!relic) {
        pushLog("Merchant relic data error.", "bad");
        return false;
      }
      const totalPrice = Math.max(1, Math.round(Number(slot.price) || 0));
      const deposit = Math.max(1, Math.round(totalPrice * 0.25));
      const wallet = getMerchantUpgradeWalletTotal();
      if (wallet < deposit) {
        pushLog(`Merchant: need ${deposit} gold for reservation deposit.`, "bad");
        return false;
      }
      const previous = state.merchantReservedRelic;
      spendMerchantUpgradeGold(deposit);
      state.merchantReservedRelic = {
        relicId: slot.relicId,
        totalPrice,
        depositPaid: deposit,
        remainingPrice: Math.max(0, totalPrice - deposit)
      };
      state.merchantRelicSlot = null;
      state.merchantBuybackPending = null;
      if (previous && typeof previous === "object" && typeof previous.relicId === "string") {
        const prevRelic = getRelicById(previous.relicId);
        pushLog(
          `Merchant: reservation switched from ${prevRelic ? prevRelic.name : previous.relicId} to ${relic.name}. New deposit -${deposit} gold (non-refundable).`,
          "warn"
        );
      } else {
        pushLog(`Merchant: reserved ${relic.name}. Deposit -${deposit} gold, remaining ${Math.max(0, totalPrice - deposit)} gold.`, "good");
      }
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    function tryBuyReservedRelicFromMerchant() {
      if (state.phase !== "playing") return false;
      if (state.roomType !== "merchant") return false;
      if (!isOnMerchant()) return false;
      const reserved = state.merchantReservedRelic;
      if (!reserved || typeof reserved !== "object") {
        pushLog("No reserved relic.", "bad");
        return false;
      }
      const relicId = typeof reserved.relicId === "string" ? reserved.relicId : "";
      const relic = getRelicById(relicId);
      if (!relic) {
        pushLog("Reserved relic data error.", "bad");
        return false;
      }
      if ((relic.rarity === "legendary" || relic.rarity === "mythic") && state.relics.includes(relic.id)) {
        pushLog(`You already own ${relic.name}.`, "bad");
        return false;
      }
      const remainingPrice = Math.max(0, Math.round(Number(reserved.remainingPrice) || 0));
      const wallet = getMerchantUpgradeWalletTotal();
      if (wallet < remainingPrice) {
        pushLog(`Merchant: need ${remainingPrice} gold to claim reserved ${relic.name}.`, "bad");
        return false;
      }
      if (relic.rarity === "legendary" && isLegendaryRelicCapReached()) {
        const currentLegendaryId = state.relics.find((id) => {
          const owned = getRelicById(id);
          return owned && owned.rarity === "legendary";
        }) || null;
        if (!currentLegendaryId) {
          pushLog("Legendary swap unavailable right now.", "bad");
          return false;
        }
        state.merchantLegendarySwapPending = {
          source: "reserved",
          relicId,
          price: remainingPrice,
          currentLegendaryId
        };
        state.merchantBuybackPending = null;
        pushLog(`Legendary cap reached (${getLegendaryRelicCap()}/${getLegendaryRelicCap()}). Choose swap for reserved ${relic.name} (1 keep current, 2 take new).`, "bad");
        markUiDirty();
        return true;
      }
      if (relic.rarity === "mythic" && hasMythicRelic()) {
        const currentMythicId = state.relics.find((id) => {
          const owned = getRelicById(id);
          return owned && owned.rarity === "mythic";
        }) || null;
        if (!currentMythicId) {
          pushLog("Mythic swap unavailable right now.", "bad");
          return false;
        }
        state.merchantLegendarySwapPending = {
          source: "reserved",
          relicId,
          price: remainingPrice,
          currentLegendaryId: currentMythicId
        };
        state.merchantBuybackPending = null;
        pushLog(`Mythic limit: choose swap for reserved ${relic.name} (1 keep current, 2 take new).`, "bad");
        markUiDirty();
        return true;
      }
      const relicSlotCap = getIncomingRelicSlotCap(relicId);
      if (state.relics.length >= relicSlotCap) {
        state.merchantRelicSwapPending = { source: "reserved", relicId, price: remainingPrice };
        state.merchantBuybackPending = null;
        pushLog(`Relic inventory full (${relicSlotCap}/${relicSlotCap}). Choose a relic to replace with reserved ${relic.name} (${getRelicSlotHint()}).`, "bad");
        markUiDirty();
        return true;
      }
      const applied = applyRelic(relicId);
      if (!applied) {
        pushLog(`Cannot claim reserved ${relic.name} right now.`, "bad");
        return false;
      }
      spendMerchantUpgradeGold(remainingPrice);
      state.merchantReservedRelic = null;
      spawnParticles(state.player.x, state.player.y, "#ffb020", 14, 1.3);
      pushLog(`Merchant: claimed reserved ${relic.name} for ${remainingPrice} gold (deposit already paid).`, "good");
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    function tryDiscardReservedRelicFromMerchant() {
      if (state.phase !== "playing") return false;
      if (state.roomType !== "merchant") return false;
      if (!isOnMerchant()) return false;
      const reserved = state.merchantReservedRelic;
      if (!reserved || typeof reserved !== "object") {
        pushLog("No reserved relic to discard.", "bad");
        return false;
      }
      const relicId = typeof reserved.relicId === "string" ? reserved.relicId : "";
      const relic = getRelicById(relicId);
      const depositPaid = Math.max(0, Math.round(Number(reserved.depositPaid) || 0));
      state.merchantReservedRelic = null;
      state.merchantBuybackPending = null;
      pushLog(
        `Merchant: reservation discarded for ${relic ? relic.name : (relicId || "unknown relic")}. Deposit ${depositPaid} gold lost.`,
        "warn"
      );
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    function resolveMerchantLegendarySwap(acceptIncoming) {
      const pending = state.merchantLegendarySwapPending;
      if (!pending || typeof pending !== "object") return false;
      const incomingRelic = getRelicById(pending.relicId);
      const currentRelic = getRelicById(pending.currentLegendaryId);
      if (!incomingRelic || !currentRelic) {
        state.merchantLegendarySwapPending = null;
        pushLog("Merchant legendary swap canceled (invalid relic state).", "bad");
        markUiDirty();
        return false;
      }
      if (!acceptIncoming) {
        state.merchantLegendarySwapPending = null;
        pushLog(`Merchant: kept ${currentRelic.name}.`, "neutral");
        saveRunSnapshot();
        markUiDirty();
        return true;
      }
      const price = Math.max(0, Math.round(Number(pending.price) || 0));
      const wallet = getMerchantUpgradeWalletTotal();
      if (wallet < price) {
        pushLog(`Merchant: need ${price} gold to complete swap.`, "bad");
        return false;
      }
      removeRelic(currentRelic.id, { silent: true });
      const applied = applyRelic(incomingRelic.id, { silent: true });
      if (!applied) {
        applyRelic(currentRelic.id, { silent: true });
        pushLog(`Merchant: swap failed for ${incomingRelic.name}.`, "bad");
        state.merchantLegendarySwapPending = null;
        markUiDirty();
        return false;
      }
      spendMerchantUpgradeGold(price);
      if (pending.source === "reserved") {
        state.merchantReservedRelic = null;
      } else {
        state.merchantRelicSlot = null;
      }
      state.merchantLegendarySwapPending = null;
      state.merchantBuybackPending = null;
      spawnParticles(state.player.x, state.player.y, "#ffb020", 14, 1.3);
      pushLog(`Merchant: swapped ${currentRelic.name} -> ${incomingRelic.name}. Paid ${price} gold.`, "good");
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
      const cost = typeof getMerchantFavorDiscountedCost === "function"
        ? getMerchantFavorDiscountedCost(baseCost)
        : baseCost;
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
      const cost = typeof getMerchantFavorDiscountedCost === "function"
        ? getMerchantFavorDiscountedCost(baseCost)
        : baseCost;
      const wallet = getMerchantUpgradeWalletTotal();
      if (wallet < cost) {
        pushLog(`Merchant: need ${cost} gold for Combat Boost.`, "bad");
        return false;
      }
      spendMerchantUpgradeGold(cost);
      state.player.combatBoostTurns = 100;
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
      const cost = typeof getMerchantFavorDiscountedCost === "function"
        ? getMerchantFavorDiscountedCost(baseCost)
        : baseCost;
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

    function tryBuyOneLife() {
      if (state.phase !== "playing") return false;
      if (state.roomType !== "merchant") return false;
      if (!isOnMerchant()) return false;
      if (state.merchantServiceSlot !== "onelife") {
        pushLog("Extra Life not available today.", "bad");
        return false;
      }
      if (state.lives >= MAX_LIVES) {
        pushLog("Extra Life: already at max lives.", "bad");
        return false;
      }
      const baseCost = 2000;
      const cost = typeof getMerchantFavorDiscountedCost === "function"
        ? getMerchantFavorDiscountedCost(baseCost)
        : baseCost;
      const wallet = getMerchantUpgradeWalletTotal();
      if (wallet < cost) {
        pushLog(`Merchant: need ${cost} gold for Extra Life.`, "bad");
        return false;
      }
      spendMerchantUpgradeGold(cost);
      state.merchantServiceSlot = null;
      grantLife("Merchant", 1);
      spawnParticles(state.player.x, state.player.y, "#ff4d7e", 20, 1.5);
      pushLog(`Merchant: Extra Life purchased! Lives: ${state.lives}/${MAX_LIVES}. -${cost} gold.`, "good");
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
      const { source = "offer", relicId: newRelicId, price } = state.merchantRelicSwapPending;
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
      if (source === "reserved") {
        state.merchantReservedRelic = null;
      } else {
        state.merchantRelicSlot = null;
      }
      state.merchantRelicSwapPending = null;
      state.merchantBuybackPending = null;
      spawnParticles(state.player.x, state.player.y, "#ffb020", 14, 1.3);
      spawnShockwaveRing(state.player.x, state.player.y, {
        color: "#ffb020",
        core: "#fff8e0",
        maxRadius: TILE * 2.7,
        life: 300
      });
      pushLog(`Merchant: swapped ${outRelic.name} -> ${newRelic.name} for ${price} gold.`, "good");
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    function getMerchantBuybackEntries() {
      const groups = new Map();
      for (const relicId of state.relics || []) {
        const relic = getRelicById(relicId);
        if (!relic) continue;
        if (relicId === state.merchantReservedRelic?.relicId) continue;
        const existing = groups.get(relicId);
        if (existing) {
          existing.count += 1;
          continue;
        }
        const price = Math.max(1, Math.round(Number(getMerchantRelicBuybackPrice?.(relicId)) || 0));
        groups.set(relicId, { relicId, count: 1, price });
      }
      return Array.from(groups.values()).sort((a, b) => {
        if (b.price !== a.price) return b.price - a.price;
        return String(a.relicId).localeCompare(String(b.relicId));
      });
    }

    function toggleMerchantBuybackMode(forceOpen = null) {
      if (state.phase !== "playing" || state.roomType !== "merchant" || !isOnMerchant()) return false;
      const entries = getMerchantBuybackEntries();
      if (entries.length <= 0) {
        pushLog("No relics available to sell.", "bad");
        return false;
      }
      const next = forceOpen == null ? !Boolean(state.merchantBuybackPending) : Boolean(forceOpen);
      state.merchantBuybackPending = next ? entries : null;
      if (next) {
        state.blackMarketPending = null;
        state.merchantRelicSwapPending = null;
        state.merchantLegendarySwapPending = null;
      }
      markUiDirty();
      return true;
    }

    function trySellRelicToMerchant(relicId) {
      if (state.phase !== "playing" || state.roomType !== "merchant" || !isOnMerchant()) return false;
      if (!relicId || !state.relics.includes(relicId)) return false;
      if (relicId === state.merchantReservedRelic?.relicId) {
        pushLog("Reserved relic cannot be sold to merchant.", "bad");
        return false;
      }
      const relic = getRelicById(relicId);
      if (!relic) return false;
      const payout = Math.max(1, Math.round(Number(getMerchantRelicBuybackPrice?.(relicId)) || 0));
      const removed = removeRelic(relicId, { silent: true });
      if (!removed) {
        pushLog(`Merchant refuses ${relic.name}.`, "bad");
        return false;
      }
      state.player.gold = Math.max(0, Number(state.player.gold) || 0) + payout;
      spawnParticles(state.player.x, state.player.y, "#ffd57a", 9, 1.1);
      pushLog(`Merchant buys ${relic.name} for ${payout} gold.`, "good");
      const entries = getMerchantBuybackEntries();
      state.merchantBuybackPending = entries.length > 0 ? entries : null;
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
      tryReserveRelicFromMerchant,
      tryBuyReservedRelicFromMerchant,
      tryDiscardReservedRelicFromMerchant,
      resolveMerchantLegendarySwap,
      tryBuyRelicSwap: tryMerchantRelicSwap,
      getMerchantBuybackEntries,
      toggleMerchantBuybackMode,
      trySellRelicToMerchant,
      tryBuyFullHeal,
      tryBuyCombatBoost,
      tryBuySecondChance,
      tryBuyOneLife,
      tryUseBlackMarket
    };
  }

  window.DungeonCampRuntime = {
    create
  };
})();
