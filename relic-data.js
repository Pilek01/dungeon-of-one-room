(() => {
  const RARITY = {
    normal: { label: "Normal", color: "#b0b8c4", border: "#b0b8c422", bg: "#b0b8c408" },
    rare: { label: "Rare", color: "#4d9fff", border: "#4d9fff55", bg: "#4d9fff14" },
    epic: { label: "Epic", color: "#b44dff", border: "#b44dff66", bg: "#b44dff18" },
    legendary: { label: "Legendary", color: "#ffb020", border: "#ffb02088", bg: "#ffb02022" }
  };

  const RELIC_RETURN_VALUE = {
    normal: 50,
    rare: 100,
    epic: 200,
    legendary: 400
  };

  const WARDEN_RELIC_DROP_TABLE = [
    { minDepth: 25, dropChance: 0.6, rarityWeights: { normal: 0.35, rare: 0.3, epic: 0.22, legendary: 0.13 } },
    { minDepth: 20, dropChance: 0.6, rarityWeights: { normal: 0.45, rare: 0.3, epic: 0.2, legendary: 0.05 } },
    { minDepth: 15, dropChance: 0.55, rarityWeights: { normal: 0.45, rare: 0.25, epic: 0.2, legendary: 0.1 } },
    { minDepth: 10, dropChance: 0.5, rarityWeights: { normal: 0.55, rare: 0.3, epic: 0.15, legendary: 0 } },
    { minDepth: 5, dropChance: 0.45, rarityWeights: { normal: 0.75, rare: 0.25, epic: 0, legendary: 0 } }
  ];
  const WARDEN_RELIC_PITY_BONUS_PER_MISS = 0.15;
  const WARDEN_RELIC_HARD_PITY_AFTER_MISSES = 3;

  const RELICS = [
    { id: "fang", rarity: "normal", name: "Fang Charm", desc: "+10 ATK" },
    { id: "plating", rarity: "normal", name: "Bone Plating", desc: "+10 ARM" },
    { id: "lucky", rarity: "normal", name: "Lucky Coin", desc: "+5% crit" },
    { id: "flask", rarity: "normal", name: "Spare Flask", desc: "+1 potion" },
    { id: "lifebloom", rarity: "normal", name: "Lifebloom Seed", desc: "+20 max HP and heal 20" },
    { id: "ironboots", rarity: "normal", name: "Iron Boots", desc: "Immune to spike damage. Non-stackable" },
    { id: "fieldrations", rarity: "normal", name: "Field Rations", desc: "+20 HP at the start of each depth. Non-stackable" },
    { id: "quickloader", rarity: "normal", name: "Quickloader", desc: "Potions also grant +10 ATK for 3 turns" },
    { id: "idol", rarity: "rare", name: "Golden Idol", desc: "+15% gold gain this run" },
    { id: "thornmail", rarity: "rare", name: "Thorn Mail", desc: "Melee attackers take 20% reflected damage" },
    { id: "adrenal", rarity: "rare", name: "Adrenaline Vial", desc: "Max fury +2, start with 2 fury" },
    { id: "scoutlens", rarity: "normal", name: "Scout's Lens", desc: "Enemy HP bars visible. Non-stackable" },
    { id: "magnet", rarity: "rare", name: "Magnetic Shard", desc: "Auto-loot chests within 2 tiles" },
    { id: "shrineward", rarity: "normal", name: "Shrine Ward", desc: "Shrines always bless. Chests never trigger traps. Non-stackable" },
    { id: "merchfavor", rarity: "rare", name: "Merchant's Favor", desc: "Merchant prices halved" },
    { id: "risk", rarity: "rare", name: "Risk", desc: "+40% damage. You cannot use potions" },
    { id: "sharpsight", rarity: "rare", name: "Sharpsight Loop", desc: "+10% damage to full-HP enemies" },
    { id: "gambleredge", rarity: "rare", name: "Gambler's Edge", desc: "+12% crit, -20 ARM" },
    { id: "laststandtorque", rarity: "rare", name: "Last Stand Torque", desc: "While below 50% HP: +20 ATK" },
    { id: "vampfang", rarity: "epic", name: "Vampiric Fang", desc: "Lifesteal: heal 10% of damage dealt on each hit (cap 20/hit)" },
    { id: "glasscannon", rarity: "epic", name: "Glass Cannon", desc: "+40 ATK, -50% max HP" },
    { id: "echostrike", rarity: "epic", name: "Echo Strike", desc: "25% chance to hit twice" },
    { id: "phasecloak", rarity: "epic", name: "Phase Cloak", desc: "Auto-dodge every 3rd turn" },
    { id: "soulharvest", rarity: "epic", name: "Soul Harvest", desc: "Every 30 kills: +10 max HP (cap +100)" },
    { id: "burnblade", rarity: "epic", name: "Burning Blade", desc: "Attacks ignite: 30 dmg/turn for 3 turns" },
    { id: "frostamulet", rarity: "epic", name: "Frost Amulet", desc: "Nearby non-elites 15% chance to freeze (boss/elite immune)" },
    { id: "bloodvial", rarity: "epic", name: "Blood Vial", desc: "Overheal converts into shield" },
    { id: "executionseal", rarity: "epic", name: "Executioner's Seal", desc: "+25% damage to enemies below 40% HP" },
    { id: "stormsigil", rarity: "epic", name: "Storm Sigil", desc: "Every 10th hit deals +30 bonus damage" },
    { id: "gravewhisper", rarity: "epic", name: "Grave Whisper", desc: "Kills grant +5 ATK for this encounter (cap +25)" },
    { id: "mirrorcarapace", rarity: "epic", name: "Mirror Carapace", desc: "Take 15% less damage. Deal 10% less damage" },
    { id: "momentumengine", rarity: "epic", name: "Momentum Engine", desc: "Dash deals +20% damage" },
    { id: "chronoloop", rarity: "legendary", name: "Chrono Loop", desc: "Cheat death once per run: revive 50% HP, deal 100 damage to nearby enemies" },
    { id: "voidreaper", rarity: "legendary", name: "Void Reaper", desc: "Crits execute <30% HP enemies. +15% crit. Crit kills +10 gold" },
    { id: "titanheart", rarity: "legendary", name: "Titan's Heart", desc: "+80 max HP, +20 ARM. Potions heal +50%" },
    { id: "engineofwar", rarity: "legendary", name: "Engine of War", desc: "Below 30% HP: gain +100 shield, +30% damage and +20% lifesteal for 3 turns (once per depth)" },
    { id: "chaosorb", rarity: "legendary", name: "Chaos Orb", desc: "Every 10 turns rolls 1 of 6 effects: +20 ATK, +20 HP/kill, +20 gold, 100 dmg random enemy, safe teleport, or nothing" }
  ];

  window.DungeonRelicData = {
    RARITY,
    RELIC_RETURN_VALUE,
    WARDEN_RELIC_DROP_TABLE,
    WARDEN_RELIC_PITY_BONUS_PER_MISS,
    WARDEN_RELIC_HARD_PITY_AFTER_MISSES,
    RELICS
  };
})();
