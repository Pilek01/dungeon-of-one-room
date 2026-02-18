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
    { id: "ironboots", rarity: "normal", name: "Iron Boots", desc: "Immune to spike damage" },
    { id: "idol", rarity: "rare", name: "Golden Idol", desc: "+20% gold gain this run" },
    { id: "thornmail", rarity: "rare", name: "Thorn Mail", desc: "Melee attackers take 10 dmg" },
    { id: "vampfang", rarity: "rare", name: "Vampiric Fang", desc: "Heal 10 HP every 3 kills" },
    { id: "adrenal", rarity: "rare", name: "Adrenaline Vial", desc: "Max fury +2, start with 2 fury" },
    { id: "scoutlens", rarity: "normal", name: "Scout's Lens", desc: "Enemy HP bars visible" },
    { id: "magnet", rarity: "rare", name: "Magnetic Shard", desc: "Auto-loot chests within 2 tiles" },
    { id: "shrineward", rarity: "rare", name: "Shrine Ward", desc: "Shrines always bless, never curse" },
    { id: "merchfavor", rarity: "rare", name: "Merchant's Favor", desc: "Merchant prices halved" },
    { id: "glasscannon", rarity: "epic", name: "Glass Cannon", desc: "+40 ATK, -50 max HP" },
    { id: "echostrike", rarity: "epic", name: "Echo Strike", desc: "30% chance to hit twice" },
    { id: "phasecloak", rarity: "epic", name: "Phase Cloak", desc: "Auto-dodge every 5th turn" },
    { id: "soulharvest", rarity: "epic", name: "Soul Harvest", desc: "Every 10 kills: +10 max HP (cap +100)" },
    { id: "burnblade", rarity: "epic", name: "Burning Blade", desc: "Attacks ignite: 10 dmg/turn for 3 turns" },
    { id: "frostamulet", rarity: "epic", name: "Frost Amulet", desc: "Nearby non-elites 15% chance to freeze (boss/elite immune)" },
    { id: "chronoloop", rarity: "legendary", name: "Chrono Loop", desc: "Cheat death once per run: revive 50% HP, kill all enemies" },
    { id: "voidreaper", rarity: "legendary", name: "Void Reaper", desc: "Crits execute <30% HP enemies. +15% crit. Crit kills +3 gold" },
    { id: "titanheart", rarity: "legendary", name: "Titan's Heart", desc: "+80 max HP, +20 ARM, -20 ATK. Potions heal +50%" },
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
