(() => {
  const RARITY = {
    normal: { label: "Normal", color: "#b0b8c4", border: "#b0b8c422", bg: "#b0b8c408" },
    rare: { label: "Rare", color: "#4d9fff", border: "#4d9fff55", bg: "#4d9fff14" },
    epic: { label: "Epic", color: "#b44dff", border: "#b44dff66", bg: "#b44dff18" },
    legendary: { label: "Legendary", color: "#ffb020", border: "#ffb02088", bg: "#ffb02022" },
    mythic: { label: "Mythic", color: "#7df0ff", border: "#7df0ffaa", bg: "#7df0ff1f" }
  };

  const RELIC_RETURN_VALUE = {
    normal: 50,
    rare: 100,
    epic: 200,
    legendary: 400,
    mythic: 800
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
    { id: "trapweave", rarity: "normal", name: "Trapweaver Padding", desc: "Take 35% less environmental damage. Non-stackable" },
    { id: "cachekey", rarity: "normal", name: "Cache Key", desc: "The first chest opened each depth grants 8% max HP as Barrier. Non-stackable" },
    { id: "idol", rarity: "rare", name: "Golden Idol", desc: "+15% gold gain this run" },
    { id: "thornmail", rarity: "rare", name: "Thorn Mail", desc: "Melee attackers take 20% reflected damage" },
    { id: "adrenal", rarity: "rare", name: "Adrenaline Vial", desc: "Max fury +2, start with 2 fury" },
    { id: "scoutlens", rarity: "normal", name: "Scout's Lens", desc: "Enemy HP bars visible. Non-stackable" },
    { id: "magnet", rarity: "rare", name: "Magnetic Shard", desc: "Auto-loot chests within 2 tiles" },
    { id: "shrineward", rarity: "normal", name: "Shrine Ward", desc: "Shrines always bless. Chests never trigger traps. Non-stackable" },
    { id: "merchfavor1", rarity: "normal", name: "Merchant's Favor I", desc: "Merchant prices -15%. Doesn't stack with other Merchant's Favor tiers." },
    { id: "merchfavor", rarity: "rare", name: "Merchant's Favor II", desc: "Merchant prices -30%. Doesn't stack with other Merchant's Favor tiers." },
    { id: "merchfavor3", rarity: "epic", name: "Merchant's Favor III", desc: "Merchant prices -45%. Doesn't stack with other Merchant's Favor tiers." },
    { id: "risk", rarity: "rare", name: "Risk", desc: "+40% damage. You cannot use potions" },
    { id: "sharpsight", rarity: "rare", name: "Sharpsight Loop", desc: "+10% damage to full-HP enemies" },
    { id: "gambleredge", rarity: "rare", name: "Gambler's Edge", desc: "+12% crit, -20 ARM" },
    { id: "laststandtorque", rarity: "rare", name: "Last Stand Torque", desc: "While below 50% HP: +20 ATK" },
    { id: "thinbuckler", rarity: "rare", name: "Thin Buckler", desc: "Start combat with +6% Max HP barrier" },
    { id: "duelistseal", rarity: "rare", name: "Duelist Seal", desc: "While exactly one enemy remains: deal +20% damage and take 15% less damage" },
    { id: "afterimageboots", rarity: "rare", name: "Afterimage Boots", desc: "Dash grants Barrier equal to 10% max HP" },
    { id: "alchemistscoil", rarity: "rare", name: "Alchemist Coil", desc: "Using a potion reduces every active skill cooldown by 2 turns" },
    { id: "vampfang", rarity: "epic", name: "Vampiric Fang", desc: "Lifesteal: heal 10% of damage dealt on each hit (cap 20/hit)" },
    { id: "glasscannon", rarity: "epic", name: "Glass Cannon", desc: "+30 ATK, -55% max HP" },
    { id: "echostrike", rarity: "epic", name: "Echo Strike", desc: "25% chance to hit twice" },
    { id: "phasecloak", rarity: "epic", name: "Phase Cloak", desc: "Auto-dodge every 3rd turn" },
    { id: "soulharvest", rarity: "epic", name: "Soul Harvest", desc: "Every 50 kills: +5 max HP (cap +100)" },
    { id: "burnblade", rarity: "epic", name: "Burning Blade", desc: "Attacks ignite: 30 dmg/turn for 3 turns" },
    { id: "frostamulet", rarity: "epic", name: "Frost Amulet", desc: "Nearby non-elites 15% chance to freeze (boss/elite immune)" },
    { id: "bloodvial", rarity: "epic", name: "Blood Vial", desc: "Overheal converts into barrier" },
    { id: "executionseal", rarity: "epic", name: "Executioner's Seal", desc: "+25% damage to enemies below 40% HP" },
    { id: "stormsigil", rarity: "epic", name: "Storm Sigil", desc: "Every 10th hit deals +30 bonus damage" },
    { id: "gravewhisper", rarity: "epic", name: "Grave Whisper", desc: "Kills grant +5 ATK for this encounter (cap +25)" },
    { id: "mirrorcarapace", rarity: "epic", name: "Mirror Carapace", desc: "Take 15% less damage. Deal 10% less damage" },
    { id: "momentumengine", rarity: "epic", name: "Momentum Engine", desc: "Dash deals +20% damage" },
    { id: "executionchain", rarity: "epic", name: "Execution Chain", desc: "Kills reduce all skill cooldowns by 1 turn; elite and boss kills reduce them by 2" },
    { id: "aegisdynamo", rarity: "epic", name: "Aegis Dynamo", desc: "Absorb at least 33% max HP with Shield or Barrier in a single hit to empower your next hit by 40%" },
    { id: "hazardprism", rarity: "epic", name: "Hazard Prism", desc: "Enemies hurt by environmental hazards become Exposed for 3 turns and take +20% damage from you" },
    { id: "fracturedsigil", rarity: "legendary", name: "Fractured Sigil", desc: "Shield skill becomes Barrier. Gain 60% of normal Shield value as persistent barrier" },
    { id: "borrowedtime", rarity: "epic", name: "Borrowed Time", desc: "When a skill comes off cooldown: gain +15% Max HP barrier" },
    { id: "deadeyeprism", rarity: "epic", name: "Deadeye Prism", desc: "+5% crit chance. Critical hits deal x3 damage" },
    { id: "chronoloop", rarity: "legendary", name: "Chrono Loop", desc: "Cheat death once per run: revive 50% HP, deal 100 damage to nearby enemies" },
    { id: "voidreaper", rarity: "legendary", name: "Void Reaper", desc: "Crits execute <30% HP enemies. +15% crit. Crit kills +10 gold" },
    { id: "titanheart", rarity: "legendary", name: "Titan's Heart", desc: "+60 max HP, +12 ARM, -20 ATK. Potions heal +30%" },
    { id: "engineofwar", rarity: "legendary", name: "Engine of War", desc: "Below 30% HP: gain +100 shield, +30% damage and +20% lifesteal for 3 turns (once per depth)" },
    { id: "lastresort", rarity: "legendary", name: "The Last Resort", desc: "If HP drops below 35% during combat: reset all skill cooldowns once per combat" },
    { id: "crownofoneroom", rarity: "legendary", name: "Crown of the One Room", desc: "Every 5 combat turns: gain +40% Max HP barrier. It vanishes after 2 turns." },
    { id: "chaosorb", rarity: "legendary", name: "Chaos Orb", desc: "Every 10 turns rolls 1 of 6 effects: +20 ATK, +20 HP/kill, +20 gold, 100 dmg random enemy, safe teleport, or nothing" },
    { id: "perfectrhythm", rarity: "legendary", name: "Perfect Rhythm", desc: "After 3 combat turns without losing HP, deal +30% damage until you lose HP" },
    { id: "labyrinthheart", rarity: "legendary", name: "Heart of the Labyrinth", desc: "Flawless combat clears grant +5 max HP and +2 ATK, up to 8 times" },
    { id: "oathofruin", rarity: "mythic", name: "Oath of Ruin", desc: "-70% skill cooldowns. Casting a skill costs 8% current HP (barrier first). Potions locked for 3 turns." },
    { id: "abyssalreliquary", rarity: "mythic", name: "Abyssal Reliquary", desc: "+2 max relic slots. Protected from death penalty" },
    { id: "crownconcord", rarity: "mythic", name: "Crown Concord", desc: "You can equip up to 2 legendary relics" }
  ];

  const RELIC_HD_ICON_BASE_PATH = "assets/hd/ui/relics";
  for (const relic of RELICS) {
    relic.icon = `${RELIC_HD_ICON_BASE_PATH}/${relic.id}.png`;
  }

  const api = {
    RARITY,
    RELIC_RETURN_VALUE,
    WARDEN_RELIC_DROP_TABLE,
    WARDEN_RELIC_PITY_BONUS_PER_MISS,
    WARDEN_RELIC_HARD_PITY_AFTER_MISSES,
    RELICS
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonRelicData = api;
  }
})();
