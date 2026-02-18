(() => {
  const CAMP_UPGRADES = [
    {
      id: "vitality",
      key: "1",
      name: "Vitality",
      desc: "+10% max HP at run start",
      baseCost: 20,
      costGrowth: 1.4,
      scale: 8,
      max: 10
    },
    {
      id: "blade",
      key: "2",
      name: "Sharpen Blade",
      desc: "+10 ATK and +10% all flat ATK per level",
      baseCost: 30,
      costGrowth: 1.4,
      scale: 10,
      max: 15
    },
    {
      id: "satchel",
      key: "3",
      name: "Potion Satchel",
      desc: "+1 starting potion",
      baseCost: 15,
      scale: 11,
      max: 6
    },
    {
      id: "guard",
      key: "4",
      name: "Guard Plates",
      desc: "+10 starting armor",
      baseCost: 30,
      costGrowth: 1.4,
      scale: 12,
      max: 15
    },
    {
      id: "auto_potion",
      key: "5",
      name: "Auto Potion",
      desc: "Auto-use potion at 25 HP or less (5-turn CD)",
      baseCost: 600,
      scale: 0,
      max: 1,
      currency: "camp_gold"
    },
    {
      id: "potion_strength",
      key: "6",
      name: "Potion Strength",
      desc: "+20 potion heal per level",
      baseCost: 80,
      scale: 60,
      max: 5,
      currency: "camp_gold"
    },
    {
      id: "crit_chance",
      key: "7",
      name: "Crit Training",
      desc: "+5% crit chance at run start",
      baseCost: 100,
      scale: 80,
      max: 4,
      currency: "camp_gold"
    },
    {
      id: "treasure_sense",
      key: "8",
      name: "Treasure Sense",
      desc: "+10% gold from chest drops",
      baseCost: 80,
      scale: 60,
      max: 5,
      currency: "camp_gold"
    },
    {
      id: "emergency_stash",
      key: "9",
      name: "Emergency Stash",
      desc: "-10% emergency extract gold loss",
      baseCost: 120,
      scale: 80,
      max: 3,
      currency: "camp_gold"
    },
    {
      id: "bounty_contract",
      key: "0",
      name: "Bounty Contract",
      desc: "+10% gold from enemy kills",
      baseCost: 70,
      scale: 55,
      max: 5,
      currency: "camp_gold"
    }
  ];

  window.DungeonCampData = {
    CAMP_UPGRADES
  };
})();
