(() => {
  const MUTATORS = [
    {
      id: "berserker",
      name: "Berserker",
      key: "1",
      bonus: "+25% ATK",
      drawback: "-25% Max HP",
      unlockText: "Kill 200 enemies"
    },
    {
      id: "bulwark",
      name: "Bulwark",
      key: "2",
      bonus: "+30% Armor",
      drawback: "-20% ATK",
      unlockText: "Reach depth highscore 15"
    },
    {
      id: "alchemist",
      name: "Alchemist",
      key: "3",
      bonus: "+2 potion slots, potions heal +30%",
      drawback: "Chests don't restore HP",
      unlockText: "Buy 25 potions from merchant"
    },
    {
      id: "greed",
      name: "Greed",
      key: "4",
      bonus: "+40% gold",
      drawback: "+2 enemies/room, enemies +20% HP, shop +25%",
      unlockText: "Earn 12000 gold total"
    },
    {
      id: "hunter",
      name: "Hunter",
      key: "5",
      bonus: "+20% Crit",
      drawback: "Enemies deal +25% more damage",
      unlockText: "Kill 90 elites"
    },
    {
      id: "resilience",
      name: "Resilience",
      key: "6",
      bonus: "Barrier = 20% Max HP on room entry",
      drawback: "Enemies deal +20% more damage",
      unlockText: "Use shield skill 60 times"
    },
    {
      id: "momentum",
      name: "Momentum",
      key: "7",
      bonus: "+0.5% ATK per depth reached (stacks)",
      drawback: "Enemies deal +15% more damage",
      unlockText: "Reach depth highscore 20"
    },
    {
      id: "famine",
      name: "Famine",
      key: "8",
      bonus: "+30% Max HP",
      drawback: "-50% potion heal, -3 max potion slots",
      unlockText: "Extract depth 10+ without using potion"
    },
    {
      id: "elitist",
      name: "Elitist",
      key: "9",
      bonus: "Elites drop +60% gold",
      drawback: "+30% elite spawn, elites +25% HP",
      unlockText: "Kill 250 elites"
    },
    {
      id: "ascension",
      name: "Ascension",
      key: "0",
      bonus: "+1 relic choice per draft",
      drawback: "Enemies +3% ATK per 3 depths reached",
      unlockText: "Reach depth highscore 30"
    }
  ];

  function asNonNegativeInt(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
  }

  function getMutatorUnlockStatus(progress = {}) {
    const totalKills = asNonNegativeInt(progress.totalKills);
    const depthHighscore = asNonNegativeInt(progress.depthHighscore);
    const totalMerchantPots = asNonNegativeInt(progress.totalMerchantPots);
    const totalGoldEarned = asNonNegativeInt(progress.totalGoldEarned);
    const eliteKills = asNonNegativeInt(progress.eliteKills);
    const shieldUsesThisGame = asNonNegativeInt(progress.shieldUsesThisGame);
    const potionFreeExtract = asNonNegativeInt(progress.potionFreeExtract);

    return {
      berserker: totalKills >= 200,
      bulwark: depthHighscore >= 15,
      alchemist: totalMerchantPots >= 25,
      greed: totalGoldEarned >= 12000,
      hunter: eliteKills >= 90,
      resilience: shieldUsesThisGame >= 60,
      momentum: depthHighscore >= 20,
      famine: potionFreeExtract >= 1,
      elitist: eliteKills >= 250,
      ascension: depthHighscore >= 30
    };
  }

  window.DungeonMutatorData = {
    MUTATORS,
    getMutatorUnlockStatus
  };
})();
