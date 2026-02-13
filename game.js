(() => {
  function normalizeSeasonId(value, fallback = "season-1") {
    const cleaned = String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 32);
    return cleaned || fallback;
  }

  const GRID_SIZE = 9;
  const TILE = 16;
  const CANVAS_SIZE = GRID_SIZE * TILE;
  const STORAGE_DEPTH = "dungeonOneRoomHighscore";
  const STORAGE_GOLD = "dungeonOneRoomBestGold";
  const STORAGE_DEATHS = "dungeonOneRoomDeaths";
  const STORAGE_MUT_UNLOCK = "dungeonOneRoomMutatorUnlocks";
  const STORAGE_MUT_ACTIVE = "dungeonOneRoomMutatorActive";
  const STORAGE_AUDIO_MUTED = "dungeonOneRoomAudioMuted";
  const STORAGE_CAMP_GOLD = "dungeonOneRoomCampGold";
  const STORAGE_ESSENCE_LEGACY = "dungeonOneRoomEssence";
  const STORAGE_LIVES = "dungeonOneRoomLives";
  const STORAGE_CAMP_UPGRADES = "dungeonOneRoomCampUpgrades";
  const STORAGE_SKILL_TIERS = "dungeonOneRoomSkillTiers";
  const STORAGE_RUN_SAVE = "dungeonOneRoomRunSave";
  const STORAGE_ELITE_KILLS = "dungeonOneRoomEliteKills";
  const STORAGE_TOTAL_KILLS = "dungeonOneRoomTotalKills";
  const STORAGE_TOTAL_GOLD = "dungeonOneRoomTotalGold";
  const STORAGE_TOTAL_MERCHANT_POTS = "dungeonOneRoomTotalMerchantPots";
  const STORAGE_POTION_FREE_EXTRACT = "dungeonOneRoomPotionFreeExtract";
  const STORAGE_PLAYER_NAME = "dungeonOneRoomPlayerName";
  const STORAGE_LEADERBOARD = "dungeonOneRoomLeaderboardV1";
  const STORAGE_LEADERBOARD_PENDING = "dungeonOneRoomLeaderboardPendingV1";
  const GAME_VERSION = (() => {
    const raw = typeof window !== "undefined" ? window.GAME_VERSION : "";
    const normalized = typeof raw === "string" ? raw.trim() : "";
    return normalized || "dev";
  })();
  const MAX_LIVES = 5;
  const MAX_RELICS = 8;
  const MAX_NORMAL_RELIC_STACK = 5;
  const LEADERBOARD_LIMIT = 25;
  const LEADERBOARD_MODAL_LIMIT = 20;
  const LEADERBOARD_PENDING_LIMIT = 200;
  const COMBAT_SCALE = 10;
  const BASE_PLAYER_HP = 10;
  const BASE_PLAYER_ATTACK = 2;
  const BASE_PLAYER_ARMOR = 0;
  const LOW_HP_THRESHOLD = 4 * COMBAT_SCALE;
  const LOW_HP_CRITICAL_THRESHOLD = 2 * COMBAT_SCALE;
  const MIN_EFFECTIVE_DAMAGE = 1 * COMBAT_SCALE;
  const CRIT_CHANCE_CAP = 0.55;
  const ARMOR_DAMAGE_REDUCTION_CAP = 0.7;
  const AUTO_POTION_TRIGGER_HP = 25;
  const AUTO_POTION_INTERNAL_COOLDOWN_TURNS = 5;
  const SHRINE_FURY_BLESSING_CHANCE = 0.1;
  const ENEMY_LATE_SCALE_START_DEPTH = 20;
  const ENEMY_LATE_SCALE_STEP_DEPTH = 10;
  const ENEMY_LATE_SCALE_PER_STEP = 0.2;
  const CHAOS_ORB_ROLL_INTERVAL = 10;
  const CHAOS_ORB_ATK_BONUS = 2 * COMBAT_SCALE; // +20 ATK
  const CHAOS_ORB_KILL_HEAL = 2 * COMBAT_SCALE; // +20 HP per kill
  const CHAOS_ORB_GOLD_BONUS = 20;
  const CHAOS_ORB_ENEMY_DAMAGE = 10 * COMBAT_SCALE; // 100 dmg
  const MAX_FLOOR_BONFIRE_PER_MAP = 2;
  const MIN_FLOOR_SKULL_PER_MAP = 3;
  const MAX_FLOOR_SKULL_PER_MAP = 4;
  const MAX_FLOOR_CRACK_CROSS_PER_MAP = 3;
  const MAX_FLOOR_VAR3_PER_MAP = 3;
  const ONLINE_LEADERBOARD_TIMEOUT_MS = 8000;
  const ONLINE_LEADERBOARD_REFRESH_MS = 12000;
  const ONLINE_LEADERBOARD_API_BASE = (() => {
    const raw = typeof window !== "undefined" ? window.DUNGEON_LEADERBOARD_API : "";
    const normalized = typeof raw === "string" ? raw.trim() : "";
    return normalized.replace(/\/+$/, "");
  })();
  const ONLINE_LEADERBOARD_SEASON = normalizeSeasonId(
    typeof window !== "undefined" ? window.DUNGEON_LEADERBOARD_SEASON : ""
  );
  const DEBUG_CHEATS_ENABLED = true;
  const DEBUG_MENU_TOGGLE_KEY = "f9";
  const MUSIC_TRACKS = {
    normal: "assets/Dungeon Descent.mp3",
    boss: "assets/Dungeon Descent2.mp3"
  };
  const SPLASH_TRACK = "assets/Splash.mp3";
  const DEATH_TRACK = "assets/death.mp3";
  const CHEST_SPRITE_PATH = "assets/sprite/chest.png";
  const CHEST_SPRITE_VERSION = "20260209_2001";
  const PORTAL_SPRITE_FRAME_PATHS = [
    "assets/sprite/portal/portal1.png",
    "assets/sprite/portal/portal2.png",
    "assets/sprite/portal/portal3.png",
    "assets/sprite/portal/portal4.png",
    "assets/sprite/portal/portal5.png",
    "assets/sprite/portal/portal6.png"
  ];
  const PORTAL_SPRITE_VERSION = "20260213_002";
  const PORTAL_FRAME_MS = 110;
  const PORTAL_DRAW_SCALE = 1.25;
  const SPIKE_SPRITE_PATH = "assets/sprite/spike.png";
  const SPIKE_SPRITE_VERSION = "20260213_001";
  const SPIKE_DRAW_SCALE = 1.4;
  const TILESET_SPRITE_PATH = "assets/sprite/tileset.png";
  const TILESET_SPRITE_VERSION = "20260213_002";
  const TILESET_TILE_SIZE = 16;
  const TILESET_COLUMNS = 4;
  const TILESET_IDS = {
    wallCornerTL: 0,
    wallTop: 1,
    floorA: 2,
    wallCornerTR: 3,
    floorB: 4,
    floorSkull: 5,
    floorBonfire: 6,
    floorCrackCross: 7,
    wallLeft: 8,
    floorVar3: 9,
    floorVar4: 10,
    wallRight: 11,
    wallCornerBL: 12,
    wallBottom: 13,
    floorC: 14,
    wallCornerBR: 15,
    wallBase: 1
  };
  const SPIKE_MULTIPLIER = 6;
  const ROOM_INNER_TILES = (GRID_SIZE - 2) * (GRID_SIZE - 2);
  const MAX_SPIKE_DENSITY = 0.6;
  const MAX_SPIKES_PER_ROOM = Math.floor(ROOM_INNER_TILES * MAX_SPIKE_DENSITY);
  const NON_TREASURE_CHEST_CHANCE = 0.5;
  const PLAYER_SPRITE_FRAME_PATHS = {
    north: [
      "assets/sprite/player/frames/north_0.png",
      "assets/sprite/player/frames/north_1.png",
      "assets/sprite/player/frames/north_2.png",
      "assets/sprite/player/frames/north_3.png"
    ],
    south: [
      "assets/sprite/player/frames/south_0.png",
      "assets/sprite/player/frames/south_1.png",
      "assets/sprite/player/frames/south_2.png",
      "assets/sprite/player/frames/south_3.png"
    ],
    east: [
      "assets/sprite/player/frames/east_0.png",
      "assets/sprite/player/frames/east_1.png",
      "assets/sprite/player/frames/east_2.png",
      "assets/sprite/player/frames/east_3.png"
    ],
    west: [
      "assets/sprite/player/frames/west_0.png",
      "assets/sprite/player/frames/west_1.png",
      "assets/sprite/player/frames/west_2.png",
      "assets/sprite/player/frames/west_3.png"
    ]
  };
  const PLAYER_SPRITE_VERSION = "20260209_1916";
  const PLAYER_SPRITE_CLIPS = {
    north: { x: 11, y: 4, w: 10, h: 25 },
    south: { x: 11, y: 3, w: 10, h: 25 },
    east: { x: 11, y: 4, w: 9, h: 25 },
    west: { x: 12, y: 3, w: 9, h: 26 }
  };
  const SLIME_SPRITE_FRAME_PATHS = {
    north: [
      "assets/sprite/slime/frames/north_0.png",
      "assets/sprite/slime/frames/north_1.png",
      "assets/sprite/slime/frames/north_2.png",
      "assets/sprite/slime/frames/north_3.png"
    ],
    south: [
      "assets/sprite/slime/frames/south_0.png",
      "assets/sprite/slime/frames/south_1.png",
      "assets/sprite/slime/frames/south_2.png",
      "assets/sprite/slime/frames/south_3.png"
    ],
    east: [
      "assets/sprite/slime/frames/east_0.png",
      "assets/sprite/slime/frames/east_1.png",
      "assets/sprite/slime/frames/east_2.png",
      "assets/sprite/slime/frames/east_3.png"
    ],
    west: [
      "assets/sprite/slime/frames/west_0.png",
      "assets/sprite/slime/frames/west_1.png",
      "assets/sprite/slime/frames/west_2.png",
      "assets/sprite/slime/frames/west_3.png"
    ]
  };
  const SLIME_SPRITE_VERSION = "20260209_1938";
  const SLIME_SPRITE_CLIPS = {
    north: { x: 9, y: 14, w: 29, h: 21 },
    south: { x: 10, y: 13, w: 29, h: 21 },
    east: { x: 12, y: 14, w: 20, h: 23 },
    west: { x: 17, y: 15, w: 19, h: 23 }
  };
  const SKELETON_SPRITE_FRAME_PATHS = {
    north: [
      "assets/sprite/skeleton/frames/north_0.png",
      "assets/sprite/skeleton/frames/north_1.png",
      "assets/sprite/skeleton/frames/north_2.png",
      "assets/sprite/skeleton/frames/north_3.png"
    ],
    south: [
      "assets/sprite/skeleton/frames/south_0.png",
      "assets/sprite/skeleton/frames/south_1.png",
      "assets/sprite/skeleton/frames/south_2.png",
      "assets/sprite/skeleton/frames/south_3.png"
    ],
    east: [
      "assets/sprite/skeleton/frames/east_0.png",
      "assets/sprite/skeleton/frames/east_1.png",
      "assets/sprite/skeleton/frames/east_2.png",
      "assets/sprite/skeleton/frames/east_3.png"
    ],
    west: [
      "assets/sprite/skeleton/frames/west_0.png",
      "assets/sprite/skeleton/frames/west_1.png",
      "assets/sprite/skeleton/frames/west_2.png",
      "assets/sprite/skeleton/frames/west_3.png"
    ]
  };
  const SKELETON_SPRITE_VERSION = "20260209_1957";
  const SKELETON_SPRITE_CLIPS = {
    north: { x: 11, y: 6, w: 11, h: 20 },
    south: { x: 11, y: 5, w: 9, h: 20 },
    east: { x: 13, y: 6, w: 6, h: 20 },
    west: { x: 13, y: 6, w: 6, h: 20 }
  };
  const BRUTE_SPRITE_FRAME_PATHS = {
    north: [
      "assets/sprite/brute/frames/north_0.png",
      "assets/sprite/brute/frames/north_1.png",
      "assets/sprite/brute/frames/north_2.png",
      "assets/sprite/brute/frames/north_3.png"
    ],
    south: [
      "assets/sprite/brute/frames/south_0.png",
      "assets/sprite/brute/frames/south_1.png",
      "assets/sprite/brute/frames/south_2.png",
      "assets/sprite/brute/frames/south_3.png"
    ],
    east: [
      "assets/sprite/brute/frames/east_0.png",
      "assets/sprite/brute/frames/east_1.png",
      "assets/sprite/brute/frames/east_2.png",
      "assets/sprite/brute/frames/east_3.png"
    ],
    west: [
      "assets/sprite/brute/frames/west_0.png",
      "assets/sprite/brute/frames/west_1.png",
      "assets/sprite/brute/frames/west_2.png",
      "assets/sprite/brute/frames/west_3.png"
    ]
  };
  const BRUTE_SPRITE_VERSION = "20260211_1900";
  const BRUTE_SPRITE_CLIPS = {
    north: { x: 6, y: 4, w: 26, h: 27 },
    south: { x: 8, y: 4, w: 27, h: 26 },
    east: { x: 14, y: 4, w: 12, h: 29 },
    west: { x: 15, y: 5, w: 12, h: 29 }
  };

  const SYNTH_VOLUME_MULTIPLIER = 6;
  const BASE_SYNTH_MASTER_GAIN = 0.18;

  const COLORS = {
    floorA: "#1c2027",
    floorB: "#1a1d23",
    floorCrack: "#101319",
    wall: "#636a75",
    wallEdge: "#8b94a3",
    wallDark: "#3d424c",
    player: "#f2efe1",
    playerHit: "#ff7f73",
    playerCape: "#ca6752",
    slime: "#70cd69",
    slimeEye: "#203020",
    skeleton: "#d8dde6",
    skeletonEye: "#192029",
    brute: "#cb6d4f",
    bruteTrim: "#6a1f1f",
    warden: "#8d68d8",
    wardenTrim: "#3f2b74",
    wardenEye: "#d3bbff",
    chest: "#bd8b47",
    chestTrim: "#5f4320",
    merchant: "#4fb18f",
    merchantTrim: "#1d4f44",
    portalCore: "#8ee9ff",
    portalGlow: "#48b7e0",
    spike: "#b75252",
    spikeDark: "#692c2c",
    text: "#f5f7fb",
    shadow: "#00000088"
  };

  const ENEMY_THEME_PRESETS = {
    infernal: {
      bruteShadow: "#241516",
      bruteFoot: "#4f1d1d",
      bruteBodyDark: "#7a312e",
      bruteBody: COLORS.brute,
      bruteTrim: COLORS.bruteTrim,
      bruteSkin: "#f2b089",
      bruteMouth: "#2b0f0f",
      bruteRest: "#f7d47f",
      bruteSpark: "#ff9a67",
      wardenShadow: "#1a1328",
      wardenBodyDark: "#4a3475",
      wardenBody: COLORS.warden,
      wardenTrim: COLORS.wardenTrim,
      wardenEye: COLORS.wardenEye,
      wardenSpark: "#ccb7ff",
      wardenCrown: "#efe4ff",
      wardenBolt: "#c8a7ff"
    },
    necro: {
      bruteShadow: "#0f1514",
      bruteFoot: "#244f43",
      bruteBodyDark: "#2f6d5e",
      bruteBody: "#4da58e",
      bruteTrim: "#173a31",
      bruteSkin: "#d2f0e3",
      bruteMouth: "#102a22",
      bruteRest: "#7dffcf",
      bruteSpark: "#56f5c4",
      wardenShadow: "#0d1017",
      wardenBodyDark: "#2f3d69",
      wardenBody: "#536db8",
      wardenTrim: "#182445",
      wardenEye: "#c4e3ff",
      wardenSpark: "#87b6ff",
      wardenCrown: "#dff1ff",
      wardenBolt: "#99beff"
    },
    void: {
      bruteShadow: "#140f1f",
      bruteFoot: "#3f275b",
      bruteBodyDark: "#5a2f84",
      bruteBody: "#8b4ac4",
      bruteTrim: "#2a1342",
      bruteSkin: "#eed7ff",
      bruteMouth: "#230f33",
      bruteRest: "#ffd58a",
      bruteSpark: "#d4a3ff",
      wardenShadow: "#0a0712",
      wardenBodyDark: "#34245a",
      wardenBody: "#6f43b0",
      wardenTrim: "#1b1033",
      wardenEye: "#f0d2ff",
      wardenSpark: "#b987ff",
      wardenCrown: "#ffe7ff",
      wardenBolt: "#d0a3ff"
    }
  };

  function getWardenThemeByDepth(depth) {
    if (depth >= 25) return ENEMY_THEME_PRESETS.void;
    if (depth >= 15) return ENEMY_THEME_PRESETS.infernal;
    if (depth >= 5) return ENEMY_THEME_PRESETS.necro;
    return ENEMY_THEME_PRESETS.infernal;
  }

  function getBruteThemeByDepth(depth) {
    if (depth >= 30) return ENEMY_THEME_PRESETS.void;
    if (depth >= 20) return ENEMY_THEME_PRESETS.infernal;
    if (depth >= 10) return ENEMY_THEME_PRESETS.necro;
    return ENEMY_THEME_PRESETS.infernal;
  }

  function getThemeForEnemy(enemy) {
    if (enemy?.type === "warden") return getWardenThemeByDepth(state.depth);
    if (enemy?.type === "brute") return getBruteThemeByDepth(state.depth);
    return ENEMY_THEME_PRESETS.infernal;
  }

  const MUTATORS = [
    {
      id: "berserker", name: "Berserker", key: "1",
      bonus: "+30 ATK", drawback: "-50 Max HP", campGoldBonus: 0.15,
      unlockText: "Kill 50 enemies"
    },
    {
      id: "bulwark", name: "Bulwark", key: "2",
      bonus: "+30 Armor", drawback: "-20 ATK", campGoldBonus: 0.15,
      unlockText: "Reach depth 8"
    },
    {
      id: "alchemist", name: "Alchemist", key: "3",
      bonus: "+3 Potions", drawback: "Chests don't heal", campGoldBonus: 0.10,
      unlockText: "Buy 10 merchant potions"
    },
    {
      id: "greed", name: "Greed", key: "4",
      bonus: "+40% Gold", drawback: "+2 enemies, +20 enemy HP, shop +20%", campGoldBonus: 0.05,
      unlockText: "Earn 1000 gold total"
    },
    {
      id: "hunter", name: "Hunter", key: "5",
      bonus: "+15% Crit", drawback: "Enemies deal +20 damage", campGoldBonus: 0.15,
      unlockText: "Kill 30 elites"
    },
    {
      id: "glassdepths", name: "Glass Depths", key: "6",
      bonus: "Spikes drop gold", drawback: "+50% spikes per room", campGoldBonus: 0.20,
      unlockText: "Reach depth 12"
    },
    {
      id: "haste", name: "Haste", key: "7",
      bonus: "Player moves first", drawback: "15% enemy double move", campGoldBonus: 0.20,
      unlockText: "Reach depth 10"
    },
    {
      id: "famine", name: "Famine", key: "8",
      bonus: "+20 Max HP", drawback: "No merchants, potions heal 50%", campGoldBonus: 0.25,
      unlockText: "Extract depth 10+ without potions"
    },
    {
      id: "elitist", name: "Elitist", key: "9",
      bonus: "Elites drop +50% gold", drawback: "+30% elite spawn, elites +20 HP", campGoldBonus: 0.20,
      unlockText: "Kill 100 elites"
    },
    {
      id: "ascension", name: "Ascension", key: "0",
      bonus: "+1 relic choice", drawback: "Enemy ATK scales +10 per 3 depths", campGoldBonus: 0.30,
      unlockText: "Reach depth 15"
    }
  ];

  const ROOM_TYPE_LABELS = {
    combat: "Combat",
    treasure: "Treasure",
    shrine: "Shrine",
    cursed: "Cursed",
    merchant: "Merchant",
    boss: "Boss"
  };

  const CAMP_UPGRADES = [
    {
      id: "vitality",
      key: "1",
      name: "Vitality",
      desc: "+10 max HP at run start",
      baseCost: 10,
      scale: 8,
      max: 10
    },
    {
      id: "blade",
      key: "2",
      name: "Sharpen Blade",
      desc: "+10 attack at run start",
      baseCost: 15,
      scale: 10,
      max: 8
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
      scale: 12,
      max: 6
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
      desc: "+10 potion heal per level",
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

  const RARITY = {
    normal:    { label: "Normal",    color: "#b0b8c4", border: "#b0b8c422", bg: "#b0b8c408" },
    rare:      { label: "Rare",      color: "#4d9fff", border: "#4d9fff55", bg: "#4d9fff14" },
    epic:      { label: "Epic",      color: "#b44dff", border: "#b44dff66", bg: "#b44dff18" },
    legendary: { label: "Legendary", color: "#ffb020", border: "#ffb02088", bg: "#ffb02022" }
  };

  const RELIC_RETURN_VALUE = {
    normal: 25,
    rare: 50,
    epic: 100,
    legendary: 200
  };

  const RELICS = [
    // â”€â”€ Normal (6) â”€â”€
    { id: "fang",      rarity: "normal", name: "Fang Charm",     desc: "+10 ATK" },
    { id: "plating",   rarity: "normal", name: "Bone Plating",   desc: "+10 ARM" },
    { id: "lucky",     rarity: "normal", name: "Lucky Coin",     desc: "+5% crit" },
    { id: "flask",     rarity: "normal", name: "Spare Flask",    desc: "+1 potion" },
    { id: "lifebloom", rarity: "normal", name: "Lifebloom Seed", desc: "+20 max HP and heal 20" },
    { id: "ironboots", rarity: "normal", name: "Iron Boots",     desc: "Immune to spike damage" },
    // â”€â”€ Rare (8) â”€â”€
    { id: "idol",      rarity: "rare", name: "Golden Idol",      desc: "+20% gold gain this run" },
    { id: "thornmail", rarity: "rare", name: "Thorn Mail",       desc: "Melee attackers take 10 dmg" },
    { id: "vampfang",  rarity: "rare", name: "Vampiric Fang",    desc: "Heal 10 HP every 3 kills" },
    { id: "adrenal",   rarity: "rare", name: "Adrenaline Vial",  desc: "Max fury +2, start with 2 fury" },
    { id: "scoutlens", rarity: "rare", name: "Scout's Lens",     desc: "Enemy HP bars visible" },
    { id: "magnet",    rarity: "rare", name: "Magnetic Shard",   desc: "Auto-loot chests within 2 tiles" },
    { id: "shrineward",rarity: "rare", name: "Shrine Ward",      desc: "Shrines always bless, never curse" },
    { id: "merchfavor",rarity: "rare", name: "Merchant's Favor", desc: "Merchant prices halved" },
    // â”€â”€ Epic (6) â”€â”€
    { id: "glasscannon", rarity: "epic", name: "Glass Cannon",  desc: "+40 ATK, -50 max HP" },
    { id: "echostrike",  rarity: "epic", name: "Echo Strike",   desc: "30% chance to hit twice" },
    { id: "phasecloak",  rarity: "epic", name: "Phase Cloak",   desc: "Auto-dodge every 5th turn" },
    { id: "soulharvest", rarity: "epic", name: "Soul Harvest",  desc: "Every 10 kills: +10 max HP (cap +100)" },
    { id: "burnblade",   rarity: "epic", name: "Burning Blade", desc: "Attacks ignite: 10 dmg/turn for 3 turns" },
    { id: "frostamulet", rarity: "epic", name: "Frost Amulet",  desc: "Nearby non-elites 15% chance to freeze (boss/elite immune)" },
    // â”€â”€ Legendary (4) â”€â”€
    { id: "chronoloop",  rarity: "legendary", name: "Chrono Loop",  desc: "Cheat death once per run: revive 50% HP, kill all enemies" },
    { id: "voidreaper",  rarity: "legendary", name: "Void Reaper",  desc: "Crits execute <30% HP enemies. +15% crit. Crit kills +3 gold" },
    { id: "titanheart",  rarity: "legendary", name: "Titan's Heart", desc: "+80 max HP, +20 ARM, -20 ATK. Potions heal +50%" },
    { id: "chaosorb",    rarity: "legendary", name: "Chaos Orb",    desc: "Every 10 turns rolls 1 of 6 effects: +20 ATK, +20 HP/kill, +20 gold, 100 dmg random enemy, safe teleport, or nothing" }
  ];

  const SKILLS = [
    {
      id: "dash",
      key: "Z",
      name: "Dash",
      cooldown: 10,
      desc: "3-tile pierce + knockback"
    },
    {
      id: "aoe",
      key: "X",
      name: "Shockwave",
      cooldown: 30,
      desc: "Hit all 8 nearby tiles"
    },
    {
      id: "shield",
      key: "C",
      name: "Shield",
      cooldown: 20,
      desc: "Full immunity for 3 turns after cast"
    }
  ];

  const SKILL_BY_ID = Object.fromEntries(SKILLS.map((skill) => [skill.id, skill]));
  const DEFAULT_SKILL_COOLDOWNS = Object.fromEntries(SKILLS.map((skill) => [skill.id, 0]));
  const MAX_SKILL_TIER = 2;
  const SKILL_TIER_LABELS = ["Base", "Rare", "Epic"];
  const DEFAULT_SKILL_TIERS = Object.fromEntries(SKILLS.map((skill) => [skill.id, 0]));
  const MERCHANT_SKILL_UPGRADES = {
    dash: [
      { tier: 1, label: "Rare", cost: 800, desc: "+100% dash damage" },
      { tier: 2, label: "Epic", cost: 1600, desc: "Range +1 and landing splash damage" }
    ],
    aoe: [
      { tier: 1, label: "Rare", cost: 1000, desc: "Radius +1 tile" },
      { tier: 2, label: "Epic", cost: 2000, desc: "Damage x2" }
    ],
    shield: [
      { tier: 1, label: "Rare", cost: 300, desc: "Cast pushes nearby enemies" },
      { tier: 2, label: "Epic", cost: 600, desc: "Reflect x2 and provoke attacks" }
    ]
  };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const screenOverlayEl = document.getElementById("screenOverlay");
  const roomIntroOverlayEl = document.getElementById("roomIntroOverlay");
  const depthBadgeEl = document.getElementById("depthBadge");
  const hudEl = document.getElementById("hud");
  const actionsEl = document.getElementById("actions");
  const skillsBarEl = document.getElementById("skillsBar");
  const mutatorsEl = document.getElementById("mutators");
  const logEl = document.getElementById("log");
  const appVersionEl = document.getElementById("appVersion");
  const bootScreenEl = document.getElementById("bootScreen");
  const gameAppEl = document.getElementById("gameApp");
  let hoveredEnemy = null;

  if (appVersionEl) {
    appVersionEl.textContent = `Version ${GAME_VERSION}`;
  }
  window.DUNGEON_GAME_VERSION = GAME_VERSION;

  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const chance = (p) => Math.random() < p;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);
  const tileKey = (x, y) => `${x},${y}`;
  const inBounds = (x, y) => x >= 1 && x <= GRID_SIZE - 2 && y >= 1 && y <= GRID_SIZE - 2;
  const manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
  const scaledCombat = (base) => Math.round(base * COMBAT_SCALE);

  function getFuryBlessingBonus() {
    return (state.player?.furyBlessingTurns || 0) > 0 ? 2 : 0;
  }

  function getEffectiveAdrenaline() {
    return Math.max(0, Number(state.player.adrenaline) || 0) + getFuryBlessingBonus();
  }

  function getEffectiveMaxAdrenaline() {
    return Math.max(0, Number(state.player.maxAdrenaline) || 0) + getFuryBlessingBonus();
  }

  function getEnemyLateDepthMultiplier(depth = state.depth) {
    if (depth < ENEMY_LATE_SCALE_START_DEPTH) return 1;
    const steps = Math.floor((depth - ENEMY_LATE_SCALE_START_DEPTH) / ENEMY_LATE_SCALE_STEP_DEPTH) + 1;
    return 1 + steps * ENEMY_LATE_SCALE_PER_STEP;
  }

  const TWEEN_MS = 120;

  function startTween(entity) {
    entity._tweenFromX = entity.x * TILE;
    entity._tweenFromY = entity.y * TILE;
    entity._tweenT = 0;
  }

  function snapVisual(entity) {
    entity._tweenT = TWEEN_MS;
    entity._tweenFromX = entity.x * TILE;
    entity._tweenFromY = entity.y * TILE;
  }

  function updateTweens(dt) {
    const all = [state.player, ...state.enemies];
    for (const e of all) {
      if (e._tweenT == null) { e._tweenT = TWEEN_MS; e._tweenFromX = e.x * TILE; e._tweenFromY = e.y * TILE; }
      e._tweenT = Math.min(TWEEN_MS, e._tweenT + dt);
    }
  }

  function visualX(entity) {
    const target = entity.x * TILE;
    if (entity._tweenT == null || entity._tweenT >= TWEEN_MS || entity._tweenFromX == null) return target;
    const t = entity._tweenT / TWEEN_MS;
    const ease = t * (2 - t);
    return Math.round(entity._tweenFromX + (target - entity._tweenFromX) * ease);
  }

  function visualY(entity) {
    const target = entity.y * TILE;
    if (entity._tweenT == null || entity._tweenT >= TWEEN_MS || entity._tweenFromY == null) return target;
    const t = entity._tweenT / TWEEN_MS;
    const ease = t * (2 - t);
    return Math.round(entity._tweenFromY + (target - entity._tweenFromY) * ease);
  }

  function computeImageOpaqueBounds(img, alphaThreshold = 10, padding = 1) {
    const w = img.naturalWidth || 0;
    const h = img.naturalHeight || 0;
    if (w <= 0 || h <= 0) return null;

    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const offCtx = off.getContext("2d", { willReadFrequently: true });
    if (!offCtx) return null;
    offCtx.clearRect(0, 0, w, h);
    offCtx.drawImage(img, 0, 0, w, h);

    const pixels = offCtx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const alpha = pixels[(y * w + x) * 4 + 3];
        if (alpha <= alphaThreshold) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < minX || maxY < minY) return null;
    const x = Math.max(0, minX - padding);
    const y = Math.max(0, minY - padding);
    const right = Math.min(w - 1, maxX + padding);
    const bottom = Math.min(h - 1, maxY + padding);
    return {
      x,
      y,
      w: right - x + 1,
      h: bottom - y + 1
    };
  }

  function updateCanvasScale() {
    const viewportMax = Math.max(160, Math.min(window.innerWidth - 40, window.innerHeight - 220, 576));
    const scale = clamp(Math.floor(viewportMax / CANVAS_SIZE), 1, 6);
    const size = CANVAS_SIZE * scale;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
  }

  function readJsonStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function sanitizeMutatorMap(input) {
    const output = {};
    for (const mutator of MUTATORS) {
      output[mutator.id] = Boolean(input && input[mutator.id]);
    }
    return output;
  }

  function sanitizeCampUpgrades(input) {
    const output = {};
    for (const upgrade of CAMP_UPGRADES) {
      const rawValue = Number(input && input[upgrade.id]);
      output[upgrade.id] = clamp(Number.isFinite(rawValue) ? rawValue : 0, 0, upgrade.max);
    }
    return output;
  }

  function sanitizeSkillCooldowns(input) {
    const output = { ...DEFAULT_SKILL_COOLDOWNS };
    for (const skill of SKILLS) {
      const rawValue = Number(input && input[skill.id]);
      output[skill.id] = clamp(Number.isFinite(rawValue) ? rawValue : 0, 0, 99);
    }
    return output;
  }

  function sanitizeSkillTiers(input) {
    const output = { ...DEFAULT_SKILL_TIERS };
    for (const skill of SKILLS) {
      const rawValue = Number(input && input[skill.id]);
      output[skill.id] = clamp(Number.isFinite(rawValue) ? rawValue : 0, 0, MAX_SKILL_TIER);
    }
    return output;
  }

  function sanitizePlayerName(value) {
    const base = String(value || "")
      .replace(/\s+/g, " ")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .trim();
    const clipped = base.slice(0, 18);
    return clipped;
  }

  function makeRunId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function calculateScore(depth, gold) {
    const safeDepth = Math.max(0, Number(depth) || 0);
    const safeGold = Math.max(0, Number(gold) || 0);
    return Math.round(safeDepth * 1000 + safeGold * 3);
  }

  function getRunMaxDepth() {
    return Math.max(0, Number(state.runMaxDepth) || 0, Number(state.depth) || 0);
  }

  function getRunGoldEarned() {
    return Math.max(0, Number(state.runGoldEarned) || 0);
  }

  function sanitizeLeaderboardEntry(rawEntry) {
    if (!rawEntry || typeof rawEntry !== "object") return null;
    const depth = Math.max(0, Number(rawEntry.depth) || 0);
    const gold = Math.max(0, Number(rawEntry.gold) || 0);
    const score = Math.max(0, Number(rawEntry.score) || calculateScore(depth, gold));
    const outcome = rawEntry.outcome === "extract" ? "extract" : "death";
    const ts = Math.max(0, Number(rawEntry.ts) || Date.now());
    const mutatorIds = Array.isArray(rawEntry.mutatorIds)
      ? rawEntry.mutatorIds.filter((id) => typeof id === "string")
      : [];
    const rawVersion =
      typeof rawEntry.version === "string" && rawEntry.version.trim()
        ? rawEntry.version.trim()
        : typeof rawEntry.game_version === "string" && rawEntry.game_version.trim()
          ? rawEntry.game_version.trim()
          : GAME_VERSION;
    return {
      id: String(rawEntry.id || `${ts}-${Math.random().toString(36).slice(2, 8)}`),
      runId: String(rawEntry.runId || rawEntry.id || `${ts}-${Math.random().toString(36).slice(2, 8)}`),
      playerName: sanitizePlayerName(rawEntry.playerName) || "Anonymous",
      ts,
      endedAt: typeof rawEntry.endedAt === "string" ? rawEntry.endedAt : new Date(ts).toISOString(),
      outcome,
      depth,
      gold,
      score,
      mutatorCount: Math.max(0, Number(rawEntry.mutatorCount) || mutatorIds.length || 0),
      mutatorIds,
      version: rawVersion,
      season: normalizeSeasonId(rawEntry.season || "", "legacy")
    };
  }

  function sortLeaderboardEntries(entries, mode = "score", limit = LEADERBOARD_LIMIT) {
    const source = Array.isArray(entries) ? [...entries] : [];
    if (mode === "depth") {
      source.sort((a, b) =>
        b.depth - a.depth ||
        b.score - a.score ||
        b.gold - a.gold ||
        b.ts - a.ts
      );
    } else {
      source.sort((a, b) =>
        b.score - a.score ||
        b.depth - a.depth ||
        b.gold - a.gold ||
        b.ts - a.ts
      );
    }
    return source.slice(0, Math.max(1, limit));
  }

  function sanitizeLeaderboard(input) {
    if (!Array.isArray(input)) return [];
    const sanitized = [];
    for (const rawEntry of input) {
      const entry = sanitizeLeaderboardEntry(rawEntry);
      if (entry) sanitized.push(entry);
    }
    return sortLeaderboardEntries(sanitized, "score", LEADERBOARD_LIMIT);
  }

  function sanitizePendingLeaderboard(input) {
    if (!Array.isArray(input)) return [];
    const dedupedByRun = new Map();
    for (const rawEntry of input) {
      const entry = sanitizeLeaderboardEntry(rawEntry);
      if (!entry || !entry.runId) continue;
      const existing = dedupedByRun.get(entry.runId);
      if (!existing || isLeaderboardEntryBetter(entry, existing)) {
        dedupedByRun.set(entry.runId, entry);
      }
    }
    const pending = Array.from(dedupedByRun.values());
    pending.sort((a, b) => a.ts - b.ts);
    return pending.slice(0, LEADERBOARD_PENDING_LIMIT);
  }

  const initialUnlocks = sanitizeMutatorMap(readJsonStorage(STORAGE_MUT_UNLOCK, {}));
  const initialActive = sanitizeMutatorMap(readJsonStorage(STORAGE_MUT_ACTIVE, {}));
  const initialCampUpgrades = sanitizeCampUpgrades(readJsonStorage(STORAGE_CAMP_UPGRADES, {}));
  const initialSkillCooldowns = sanitizeSkillCooldowns({});
  const initialSkillTiers = sanitizeSkillTiers(readJsonStorage(STORAGE_SKILL_TIERS, {}));
  const initialLeaderboard = sanitizeLeaderboard(readJsonStorage(STORAGE_LEADERBOARD, []));
  const initialLeaderboardPending = sanitizePendingLeaderboard(readJsonStorage(STORAGE_LEADERBOARD_PENDING, []));
  const initialPlayerName = sanitizePlayerName(localStorage.getItem(STORAGE_PLAYER_NAME) || "");

  const state = {
    phase: "boot",
    depth: 0,
    runMaxDepth: 0,
    runGoldEarned: 0,
    turn: 0,
    roomIndex: 0,
    bossRoom: false,
    roomType: "combat",
    highscore: Number(localStorage.getItem(STORAGE_DEPTH) || 0),
    bestGold: Number(localStorage.getItem(STORAGE_GOLD) || 0),
    deaths: Number(localStorage.getItem(STORAGE_DEATHS) || 0),
    eliteKills: Number(localStorage.getItem(STORAGE_ELITE_KILLS) || 0),
    totalKills: Number(localStorage.getItem(STORAGE_TOTAL_KILLS) || 0),
    totalGoldEarned: Number(localStorage.getItem(STORAGE_TOTAL_GOLD) || 0),
    totalMerchantPots: Number(localStorage.getItem(STORAGE_TOTAL_MERCHANT_POTS) || 0),
    potionFreeExtract: Number(localStorage.getItem(STORAGE_POTION_FREE_EXTRACT) || 0),
    campGold: Number(localStorage.getItem(STORAGE_CAMP_GOLD) || localStorage.getItem(STORAGE_ESSENCE_LEGACY) || 0),
    lives: clamp(Number(localStorage.getItem(STORAGE_LIVES) || MAX_LIVES), 0, MAX_LIVES),
    leaderboard: initialLeaderboard,
    leaderboardPending: initialLeaderboardPending,
    onlineLeaderboard: [],
    onlineLeaderboardLoading: false,
    onlineLeaderboardStatus: ONLINE_LEADERBOARD_API_BASE ? "idle" : "disabled", // "disabled" | "idle" | "loading" | "syncing" | "online" | "offline"
    onlineLeaderboardError: "",
    onlineLeaderboardUpdatedAt: 0,
    onlineSyncInFlight: false,
    playerName: initialPlayerName,
    unlockedMutators: initialUnlocks,
    activeMutators: initialActive,
    campUpgrades: initialCampUpgrades,
    skillCooldowns: initialSkillCooldowns,
    skillTiers: initialSkillTiers,
    uiDirty: true,
    portalPulse: 0,
    shake: 0,
    flash: 0,
    playerAnimTimer: 0,
    floorPattern: [],
    roomCleared: false,
    roomIntroTimer: 0,
    roomIntroDuration: 0,
    roomIntroTitle: "",
    roomIntroSubtitle: "",
    extractConfirm: null,
    extractRelicPrompt: null,
    finalGameOverPrompt: null,
    merchantMenuOpen: false,
    merchantUpgradeBoughtThisRoom: false,
    dashAimActive: false,
    relicDraft: null,
    legendarySwapPending: null,
    relicSwapPending: null,
    relics: [],
    shrine: null,
    merchant: null,
    lastExtract: null,
    currentRunId: null,
    runLeaderboardSubmitted: false,
    menuIndex: 0,
    hasContinueRun: false,
    leaderboardModalOpen: false,
    leaderboardSortMode: "score", // "score" | "depth"
    leaderboardScope: "current", // "current" | "legacy"
    nameModalOpen: false,
    nameModalAction: null,
    nameDraft: initialPlayerName,
    campPanelView: "shop", // "shop" or "mutators"
    campVisitShopCostMult: 1,
    debugCheatOpen: false,
    debugGodMode: false,
    merchantPotionsBought: 0,
    runMods: {
      goldMultiplier: 1,
      extraEnemies: 0,
      chestHealPenalty: 0,
      enemyDamageBonus: 0,
      eliteChance: 0.12,
      enemyHpBonus: 0,
      shopCostMult: 1,
      eliteHpBonus: 0,
      eliteGoldMult: 1,
      extraSpikeMult: 1,
      enemyDoubleMoveChance: 0,
      noMerchants: false,
      potionHealMult: 1,
      enemyAtkPerDepth: 0,
      campGoldBonus: 0,
      extraRelicChoices: 0
    },
    audioMuted: localStorage.getItem(STORAGE_AUDIO_MUTED) === "1",
    player: {
      x: 4,
      y: 4,
      hp: scaledCombat(BASE_PLAYER_HP),
      maxHp: scaledCombat(BASE_PLAYER_HP),
      attack: scaledCombat(BASE_PLAYER_ATTACK),
      armor: scaledCombat(BASE_PLAYER_ARMOR),
      potions: 1,
      maxPotions: 5,
      gold: 0,
      adrenaline: 0,
      maxAdrenaline: 3,
      crit: 0.1,
      lastMoveX: 0,
      lastMoveY: -1,
      barrierArmor: 0,
      barrierTurns: 0,
      soulHarvestCount: 0,
      soulHarvestGained: 0,
      chronoUsedThisRun: false,
      phaseCooldown: 0,
      titanAttackPenalty: 0,
      chaosAtkBonus: 0,
      chaosAtkTurns: 0,
      chaosKillHeal: 0,
      chaosRollCounter: 0,
      autoPotionCooldown: 0,
      furyBlessingTurns: 0
    },
    portal: { x: 1, y: 1 },
    enemies: [],
    chests: [],
    spikes: [],
    rangedBolts: [],
    rangedImpacts: [],
    shockwaveRings: [],
    dashTrails: [],
    particles: [],
    log: []
  };

  const audio = {
    ctx: null,
    master: null,
    bgmNormal: null,
    bgmBoss: null,
    currentBgm: null,
    bgmReady: false,
    bgmWarned: false,
    splash: null,
    deathSample: null,
    deathWarned: false
  };

  const playerSprites = {};
  const slimeSprites = {};
  const skeletonSprites = {};
  const bruteSprites = {};
  const chestSprite = {
    img: null,
    ready: false,
    failed: false
  };
  const portalSprite = {
    frames: [],
    readyCount: 0,
    failed: false
  };
  const spikeSprite = {
    img: null,
    ready: false,
    failed: false
  };
  const tilesetSprite = {
    img: null,
    ready: false,
    failed: false
  };

  function markUiDirty() {
    state.uiDirty = true;
  }

  function pushLog(text, type = "") {
    state.log.unshift({ text, type });
    if (state.log.length > 8) {
      state.log.length = 8;
    }
    markUiDirty();
  }

  function canUseDebugCheats() {
    return DEBUG_CHEATS_ENABLED;
  }

  function isDebugGodModeActive() {
    return canUseDebugCheats() && state.debugGodMode;
  }

  function toggleDebugCheatMenu(forceOpen = null) {
    if (!canUseDebugCheats()) return false;
    if (state.phase === "boot" || state.phase === "splash") return false;
    const next = forceOpen == null ? !state.debugCheatOpen : Boolean(forceOpen);
    state.debugCheatOpen = next;
    markUiDirty();
    return true;
  }

  function saveAfterDebugCheat() {
    saveMetaProgress();
    if (state.phase === "playing" || state.phase === "relic" || state.phase === "camp") {
      saveRunSnapshot();
    }
    markUiDirty();
  }

  function getDebugCheatActions() {
    return [
      {
        key: "1",
        name: "+100 Run Gold",
        desc: "Add 100 gold to current run.",
        available: () => state.phase === "playing" || state.phase === "relic",
        run: () => {
          const gained = grantGold(100, { applyMultiplier: false });
          pushLog(`Debug: +${gained} run gold.`, "warn");
          saveAfterDebugCheat();
        }
      },
      {
        key: "2",
        name: "+1000 Camp Gold",
        desc: "Add 1000 camp gold.",
        available: () => true,
        run: () => {
          state.campGold += 1000;
          pushLog("Debug: +1000 camp gold.", "warn");
          saveAfterDebugCheat();
        }
      },
      {
        key: "3",
        name: "Full Heal",
        desc: "Restore HP to max.",
        available: () => state.phase === "playing" || state.phase === "relic",
        run: () => {
          state.player.hp = state.player.maxHp;
          spawnParticles(state.player.x, state.player.y, "#8ce1a7", 12, 1.2);
          pushLog("Debug: healed to full.", "warn");
          saveAfterDebugCheat();
        }
      },
      {
        key: "4",
        name: "+1 Life",
        desc: "Grant one extra life.",
        available: () => state.lives < MAX_LIVES,
        run: () => {
          grantLife("Debug cheat");
          saveAfterDebugCheat();
        }
      },
      {
        key: "5",
        name: "Clear Room",
        desc: "Kill all enemies in current room.",
        available: () => state.phase === "playing" && state.enemies.length > 0,
        run: () => {
          const before = state.enemies.length;
          for (const enemy of [...state.enemies]) {
            killEnemy(enemy, "debug clear");
          }
          checkRoomClearBonus();
          pushLog(`Debug: room cleared (${before} enemies).`, "warn");
          saveAfterDebugCheat();
        }
      },
      {
        key: "6",
        name: "Relic Draft",
        desc: "Force or reroll relic draft.",
        available: () => state.phase === "playing" || state.phase === "relic",
        run: () => {
          openRelicDraft(true);
          pushLog("Debug: relic draft rerolled.", "warn");
          saveAfterDebugCheat();
        }
      },
      {
        key: "7",
        name: "+1 Potion",
        desc: "Add one potion to bag.",
        available: () => state.phase === "playing" || state.phase === "relic",
        run: () => {
          grantPotion(1);
          pushLog("Debug: +1 potion.", "warn");
          saveAfterDebugCheat();
        }
      },
      {
        key: "8",
        name: "Toggle God Mode",
        desc: "No damage from hits, spikes, traps, curses.",
        available: () => true,
        run: () => {
          state.debugGodMode = !state.debugGodMode;
          pushLog(`Debug: God Mode ${state.debugGodMode ? "ON" : "OFF"}.`, "warn");
          saveAfterDebugCheat();
        }
      },
      {
        key: "9",
        name: "Reset Skill CD",
        desc: "Set all skill cooldowns to 0.",
        available: () => state.phase === "playing",
        run: () => {
          for (const skill of SKILLS) {
            state.skillCooldowns[skill.id] = 0;
          }
          pushLog("Debug: skill cooldowns reset.", "warn");
          saveAfterDebugCheat();
        }
      },
      {
        key: "0",
        name: "Next Depth",
        desc: "Jump to next room depth.",
        available: () => state.phase === "playing",
        run: () => {
          state.depth += 1;
          state.runMaxDepth = Math.max(state.runMaxDepth, state.depth);
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + scaledCombat(1));
          saveMetaProgress();
          buildRoom();
          pushLog(`Debug: jumped to depth ${state.depth}.`, "warn");
          saveRunSnapshot();
          markUiDirty();
        }
      },
      {
        key: "l",
        name: "Clear Leaderboard",
        desc: "Delete local leaderboard + pending uploads.",
        available: () => (state.leaderboard || []).length > 0 || (state.leaderboardPending || []).length > 0,
        run: () => {
          clearLocalLeaderboard();
          pushLog("Debug: local leaderboard cleared.", "warn");
          saveRunSnapshot();
          markUiDirty();
        }
      }
    ];
  }

  function triggerDebugCheatHotkey(key) {
    if (!canUseDebugCheats()) return false;
    const action = getDebugCheatActions().find((item) => item.key === key);
    if (!action) return false;
    const enabled = action.available ? action.available() : true;
    if (!enabled) {
      pushLog(`Debug cheat unavailable: ${action.name}.`, "bad");
      markUiDirty();
      return true;
    }
    action.run();
    markUiDirty();
    return true;
  }

  function persistMutatorState() {
    localStorage.setItem(STORAGE_MUT_UNLOCK, JSON.stringify(state.unlockedMutators));
    localStorage.setItem(STORAGE_MUT_ACTIVE, JSON.stringify(state.activeMutators));
  }

  function persistCampProgress() {
    localStorage.setItem(STORAGE_CAMP_GOLD, String(state.campGold));
    localStorage.setItem(STORAGE_LIVES, String(state.lives));
    localStorage.setItem(STORAGE_CAMP_UPGRADES, JSON.stringify(state.campUpgrades));
    localStorage.setItem(STORAGE_SKILL_TIERS, JSON.stringify(state.skillTiers));
  }

  function persistLeaderboard() {
    localStorage.setItem(STORAGE_LEADERBOARD, JSON.stringify(state.leaderboard || []));
  }

  function persistLeaderboardPending() {
    localStorage.setItem(STORAGE_LEADERBOARD_PENDING, JSON.stringify(state.leaderboardPending || []));
  }

  function clearLocalLeaderboard() {
    state.leaderboard = [];
    state.leaderboardPending = [];
    state.onlineLeaderboard = [];
    state.onlineLeaderboardError = "";
    state.onlineLeaderboardStatus = ONLINE_LEADERBOARD_API_BASE ? "idle" : "disabled";
    state.onlineLeaderboardUpdatedAt = 0;
    localStorage.removeItem(STORAGE_LEADERBOARD);
    localStorage.removeItem(STORAGE_LEADERBOARD_PENDING);
    markUiDirty();
  }

  function persistPlayerName() {
    if (state.playerName) {
      localStorage.setItem(STORAGE_PLAYER_NAME, state.playerName);
    } else {
      localStorage.removeItem(STORAGE_PLAYER_NAME);
    }
  }

  function setPlayerName(rawName, options = {}) {
    const normalized = sanitizePlayerName(rawName);
    if (!normalized) {
      if (!options.silent) {
        pushLog("Enter a nickname (1-18 chars).", "bad");
      }
      return false;
    }
    const changed = normalized !== state.playerName;
    state.playerName = normalized;
    state.nameDraft = normalized;
    persistPlayerName();
    if (changed && !options.silent) {
      pushLog(`Nickname set: ${normalized}.`, "good");
    }
    markUiDirty();
    return true;
  }

  function openNameModal(action = null) {
    state.nameModalOpen = true;
    state.nameModalAction = action;
    state.nameDraft = state.playerName || "";
    markUiDirty();
    requestAnimationFrame(() => {
      const input = document.getElementById("nameInput");
      if (!input) return;
      input.value = state.nameDraft || "";
      input.focus();
      input.select();
    });
  }

  function closeNameModal() {
    state.nameModalOpen = false;
    state.nameModalAction = null;
    markUiDirty();
  }

  function submitNameModal() {
    const input = document.getElementById("nameInput");
    const candidate = sanitizePlayerName(input ? input.value : state.nameDraft);
    if (!candidate) {
      pushLog("Nickname is required (1-18 chars).", "bad");
      markUiDirty();
      if (input) input.focus();
      return false;
    }
    const action = state.nameModalAction;
    const changed = candidate !== state.playerName;
    setPlayerName(candidate, { silent: true });
    closeNameModal();
    if (changed) {
      pushLog(`Nickname set: ${candidate}.`, "good");
    }
    if (action === "start_new_game") {
      startFreshSessionRun();
    }
    return true;
  }

  function startFreshSessionRun() {
    resetMetaProgressForFreshStart();
    state.currentRunId = makeRunId();
    state.runMaxDepth = 0;
    state.runGoldEarned = 0;
    state.runLeaderboardSubmitted = false;
    startRun();
  }

  function openLeaderboardModal() {
    state.leaderboardModalOpen = true;
    state.leaderboardSortMode = "score";
    state.leaderboardScope = "current";
    if (isOnlineLeaderboardEnabled()) {
      refreshOnlineLeaderboard(true);
    }
    markUiDirty();
  }

  function closeLeaderboardModal() {
    if (!state.leaderboardModalOpen) return;
    state.leaderboardModalOpen = false;
    markUiDirty();
  }

  function toggleLeaderboardSortMode() {
    state.leaderboardSortMode = state.leaderboardSortMode === "score" ? "depth" : "score";
    if (isOnlineLeaderboardEnabled()) {
      refreshOnlineLeaderboard(true);
    }
    markUiDirty();
  }

  function setLeaderboardScope(scope) {
    const normalized = scope === "legacy" ? "legacy" : "current";
    if (state.leaderboardScope === normalized) return;
    state.leaderboardScope = normalized;
    if (isOnlineLeaderboardEnabled()) {
      refreshOnlineLeaderboard(true);
    }
    markUiDirty();
  }

  function toggleLeaderboardScope() {
    setLeaderboardScope(state.leaderboardScope === "current" ? "legacy" : "current");
  }

  function isOnlineLeaderboardEnabled() {
    return Boolean(ONLINE_LEADERBOARD_API_BASE);
  }

  function getOnlineLeaderboardEndpoint() {
    if (!isOnlineLeaderboardEnabled()) return "";
    if (ONLINE_LEADERBOARD_API_BASE.endsWith("/api/leaderboard")) {
      return ONLINE_LEADERBOARD_API_BASE;
    }
    if (ONLINE_LEADERBOARD_API_BASE.endsWith("/api")) {
      return `${ONLINE_LEADERBOARD_API_BASE}/leaderboard`;
    }
    return `${ONLINE_LEADERBOARD_API_BASE}/api/leaderboard`;
  }

  function getLeaderboardSourceEntries() {
    const source = isOnlineLeaderboardEnabled() && state.onlineLeaderboardUpdatedAt > 0
      ? state.onlineLeaderboard
      : state.leaderboard;
    if (state.leaderboardScope !== "legacy") {
      return source.filter((entry) => normalizeSeasonId(entry?.season || "", "legacy") === ONLINE_LEADERBOARD_SEASON);
    }
    return source;
  }

  function getLeaderboardSourceLabel() {
    if (!isOnlineLeaderboardEnabled()) return "Local";
    if (state.onlineLeaderboardUpdatedAt > 0) return "Online";
    if (state.onlineLeaderboardLoading || state.onlineSyncInFlight) return "Local (syncing online)";
    return "Local (offline fallback)";
  }

  function getLeaderboardStatusNote() {
    if (!isOnlineLeaderboardEnabled()) {
      return "Offline mode: set window.DUNGEON_LEADERBOARD_API to enable online ranking.";
    }
    const pending = (state.leaderboardPending || []).length;
    const noteParts = [];
    if (state.onlineLeaderboardLoading) {
      noteParts.push("Fetching online leaderboard...");
    } else if (state.onlineSyncInFlight) {
      noteParts.push("Uploading pending scores...");
    } else if (state.onlineLeaderboardStatus === "online") {
      noteParts.push("Online sync active.");
    } else if (state.onlineLeaderboardStatus === "offline") {
      noteParts.push("Online unavailable, showing fallback/local cache.");
    }
    if (pending > 0) {
      noteParts.push(`Pending uploads: ${pending}`);
    }
    if (state.onlineLeaderboardError) {
      noteParts.push(`Last error: ${state.onlineLeaderboardError}`);
    }
    return noteParts.join(" ");
  }

  function upsertPendingLeaderboardEntry(entry) {
    const normalized = sanitizeLeaderboardEntry(entry);
    if (!normalized || !normalized.runId) return;
    const current = Array.isArray(state.leaderboardPending) ? state.leaderboardPending : [];
    const existing = current.find((item) => String(item.runId || "") === normalized.runId);
    const preferred = existing && !isLeaderboardEntryBetter(normalized, existing) ? existing : normalized;
    const filtered = current.filter((item) => String(item.runId || "") !== normalized.runId);
    state.leaderboardPending = sanitizePendingLeaderboard([preferred, ...filtered]);
    persistLeaderboardPending();
  }

  function removePendingLeaderboardEntryByRunId(runId) {
    const targetRunId = String(runId || "");
    if (!targetRunId) return;
    const current = Array.isArray(state.leaderboardPending) ? state.leaderboardPending : [];
    const next = current.filter((item) => String(item.runId || "") !== targetRunId);
    if (next.length === current.length) return;
    state.leaderboardPending = sanitizePendingLeaderboard(next);
    persistLeaderboardPending();
  }

  async function fetchJsonWithTimeout(url, options = {}, timeoutMs = ONLINE_LEADERBOARD_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          accept: "application/json",
          ...(options.headers || {})
        }
      });
      const raw = await response.text();
      let parsed = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
      }
      if (!response.ok) {
        const msg = parsed && typeof parsed.error === "string"
          ? parsed.error
          : `HTTP ${response.status}`;
        throw new Error(msg);
      }
      return parsed;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function submitLeaderboardEntryOnline(entry) {
    if (!isOnlineLeaderboardEnabled()) return false;
    const endpoint = getOnlineLeaderboardEndpoint();
    if (!endpoint) return false;
    const payloadVersion =
      typeof entry.version === "string" && entry.version.trim()
        ? entry.version.trim()
        : GAME_VERSION;
    const payload = {
      runId: entry.runId,
      playerName: sanitizePlayerName(entry.playerName) || "Anonymous",
      ts: Math.max(0, Number(entry.ts) || Date.now()),
      endedAt: entry.endedAt,
      outcome: entry.outcome === "extract" ? "extract" : "death",
      depth: Math.max(0, Number(entry.depth) || 0),
      gold: Math.max(0, Number(entry.gold) || 0),
      score: Math.max(0, Number(entry.score) || 0),
      mutatorCount: Math.max(0, Number(entry.mutatorCount) || 0),
      mutatorIds: Array.isArray(entry.mutatorIds) ? entry.mutatorIds : [],
      version: payloadVersion,
      game_version: payloadVersion,
      season: normalizeSeasonId(entry.season || ONLINE_LEADERBOARD_SEASON)
    };
    await fetchJsonWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    return true;
  }

  async function flushPendingLeaderboardQueue() {
    if (!isOnlineLeaderboardEnabled()) return false;
    if (state.onlineSyncInFlight) return false;

    state.leaderboardPending = sanitizePendingLeaderboard(state.leaderboardPending);
    persistLeaderboardPending();
    if ((state.leaderboardPending || []).length <= 0) return true;

    state.onlineSyncInFlight = true;
    state.onlineLeaderboardStatus = "syncing";
    markUiDirty();

    try {
      const queueSnapshot = [...state.leaderboardPending];
      for (const entry of queueSnapshot) {
        try {
          await submitLeaderboardEntryOnline(entry);
          removePendingLeaderboardEntryByRunId(entry.runId);
        } catch (error) {
          state.onlineLeaderboardStatus = "offline";
          state.onlineLeaderboardError =
            error && error.message ? error.message : "Failed to upload pending scores.";
          break;
        }
      }
      if ((state.leaderboardPending || []).length === 0) {
        state.onlineLeaderboardStatus = "online";
        state.onlineLeaderboardError = "";
      }
    } catch (error) {
      state.onlineLeaderboardStatus = "offline";
      state.onlineLeaderboardError =
        error && error.message ? error.message : "Failed to upload pending scores.";
    } finally {
      state.onlineSyncInFlight = false;
      markUiDirty();
    }

    return (state.leaderboardPending || []).length === 0;
  }

  async function refreshOnlineLeaderboard(force = false) {
    if (!isOnlineLeaderboardEnabled()) return false;
    if (state.onlineLeaderboardLoading && !force) return false;
    const now = Date.now();
    if (!force && now - state.onlineLeaderboardUpdatedAt < ONLINE_LEADERBOARD_REFRESH_MS) {
      return true;
    }

    state.onlineLeaderboardLoading = true;
    state.onlineLeaderboardStatus = "loading";
    markUiDirty();

    try {
      await flushPendingLeaderboardQueue();
      const endpoint = getOnlineLeaderboardEndpoint();
      const sort = state.leaderboardSortMode === "depth" ? "depth" : "score";
      const scope = state.leaderboardScope === "legacy" ? "legacy" : "current";
      const season = encodeURIComponent(ONLINE_LEADERBOARD_SEASON);
      const url = `${endpoint}?sort=${encodeURIComponent(sort)}&limit=${LEADERBOARD_MODAL_LIMIT}&scope=${scope}&season=${season}`;
      const payload = await fetchJsonWithTimeout(url, { method: "GET" });
      const entries = [];
      const sourceEntries = Array.isArray(payload?.entries) ? payload.entries : [];
      for (const rawEntry of sourceEntries) {
        const entry = sanitizeLeaderboardEntry(rawEntry);
        if (entry) entries.push(entry);
      }
      state.onlineLeaderboard = sortLeaderboardEntries(entries, state.leaderboardSortMode, LEADERBOARD_LIMIT);
      state.onlineLeaderboardUpdatedAt = Date.now();
      state.onlineLeaderboardStatus = "online";
      state.onlineLeaderboardError = "";
      markUiDirty();
      return true;
    } catch (error) {
      state.onlineLeaderboardStatus = "offline";
      state.onlineLeaderboardError =
        error && error.message ? error.message : "Failed to refresh online leaderboard.";
      markUiDirty();
      return false;
    } finally {
      state.onlineLeaderboardLoading = false;
      markUiDirty();
    }
  }

  function queueLeaderboardEntryForOnline(entry) {
    if (!isOnlineLeaderboardEnabled()) return;
    upsertPendingLeaderboardEntry(entry);
    // Fire-and-forget upload; UI handles offline fallback and pending queue.
    flushPendingLeaderboardQueue();
  }

  function isLeaderboardEntryBetter(candidate, current) {
    const candidateScore = Number(candidate?.score) || 0;
    const currentScore = Number(current?.score) || 0;
    if (candidateScore !== currentScore) return candidateScore > currentScore;
    const candidateDepth = Number(candidate?.depth) || 0;
    const currentDepth = Number(current?.depth) || 0;
    if (candidateDepth !== currentDepth) return candidateDepth > currentDepth;
    const candidateGold = Number(candidate?.gold) || 0;
    const currentGold = Number(current?.gold) || 0;
    if (candidateGold !== currentGold) return candidateGold > currentGold;
    return (Number(candidate?.ts) || 0) > (Number(current?.ts) || 0);
  }

  function getSortedLeaderboardEntries(limit = LEADERBOARD_MODAL_LIMIT) {
    return sortLeaderboardEntries(getLeaderboardSourceEntries(), state.leaderboardSortMode, limit);
  }

  function upsertLeaderboardEntry(entry) {
    const runId = String(entry?.runId || "");
    const current = Array.isArray(state.leaderboard) ? state.leaderboard : [];
    const existing = runId ? current.find((item) => String(item.runId || "") === runId) : null;
    const preferred = existing && !isLeaderboardEntryBetter(entry, existing) ? existing : entry;
    const filtered = runId ? current.filter((item) => String(item.runId || "") !== runId) : current;
    state.leaderboard = sanitizeLeaderboard([preferred, ...filtered]);
    persistLeaderboard();
  }

  function getActiveMutatorIds() {
    return MUTATORS.filter((mutator) => state.activeMutators[mutator.id]).map((mutator) => mutator.id);
  }

  function recordRunOnLeaderboard(outcome) {
    if (state.runLeaderboardSubmitted && state.currentRunId) return;
    const depth = getRunMaxDepth();
    const gold = getRunGoldEarned();
    if (depth <= 0 && gold <= 0) {
      state.runLeaderboardSubmitted = true;
      return;
    }

    const runId = String(state.currentRunId || makeRunId());
    state.currentRunId = runId;
    const ts = Date.now();
    const mutatorIds = getActiveMutatorIds();
    const entry = {
      id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
      runId,
      playerName: sanitizePlayerName(state.playerName) || "Anonymous",
      ts,
      endedAt: new Date(ts).toISOString(),
      outcome: outcome === "extract" ? "extract" : "death",
      depth,
      gold,
      score: calculateScore(depth, gold),
      mutatorCount: mutatorIds.length,
      mutatorIds,
      version: GAME_VERSION,
      game_version: GAME_VERSION,
      season: ONLINE_LEADERBOARD_SEASON
    };

    upsertLeaderboardEntry(entry);
    queueLeaderboardEntryForOnline(entry);
    state.runLeaderboardSubmitted = true;
  }

  function formatLeaderboardTimestamp(ts) {
    const d = new Date(Math.max(0, Number(ts) || 0));
    if (Number.isNaN(d.getTime())) return "unknown date";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}`;
  }

  function resetMetaProgressForFreshStart() {
    state.highscore = 0;
    state.bestGold = 0;
    state.deaths = 0;
    state.campGold = 0;
    state.lives = MAX_LIVES;
    state.unlockedMutators = sanitizeMutatorMap({});
    state.activeMutators = sanitizeMutatorMap({});
    state.campUpgrades = sanitizeCampUpgrades({});
    state.skillTiers = sanitizeSkillTiers({});
    state.skillCooldowns = sanitizeSkillCooldowns({});
    state.lastExtract = null;
    state.runMaxDepth = 0;
    state.runGoldEarned = 0;
    state.currentRunId = null;
    state.runLeaderboardSubmitted = false;
    state.campVisitShopCostMult = 1;
    state.leaderboardModalOpen = false;
    state.nameModalOpen = false;
    state.nameModalAction = null;
    state.extractRelicPrompt = null;
    state.finalGameOverPrompt = null;

    localStorage.setItem(STORAGE_DEPTH, "0");
    localStorage.setItem(STORAGE_GOLD, "0");
    localStorage.setItem(STORAGE_DEATHS, "0");
    persistMutatorState();
    persistCampProgress();
    clearRunSnapshot();
    markUiDirty();
  }

  function grantLife(source, amount = 1) {
    if (state.lives >= MAX_LIVES) return false;
    const gain = Math.min(amount, MAX_LIVES - state.lives);
    state.lives += gain;
    pushLog(`${source}: +${gain} life${gain > 1 ? "s" : ""}.`, "good");
    persistCampProgress();
    markUiDirty();
    return true;
  }

  function saveMetaProgress() {
    state.highscore = Math.max(state.highscore, getRunMaxDepth());
    state.bestGold = Math.max(state.bestGold, state.player.gold);
    localStorage.setItem(STORAGE_DEPTH, String(state.highscore));
    localStorage.setItem(STORAGE_GOLD, String(state.bestGold));
    localStorage.setItem(STORAGE_DEATHS, String(state.deaths));
    persistMutatorState();
    persistCampProgress();
    markUiDirty();
  }

  function clearRunSnapshot() {
    localStorage.removeItem(STORAGE_RUN_SAVE);
    state.hasContinueRun = false;
    markUiDirty();
  }

  function buildRunSnapshot() {
    return {
      gameVersion: GAME_VERSION,
      phase: state.phase,
      depth: state.depth,
      runMaxDepth: state.runMaxDepth,
      runGoldEarned: state.runGoldEarned,
      turn: state.turn,
      roomIndex: state.roomIndex,
      bossRoom: state.bossRoom,
      roomType: state.roomType,
      floorPattern: state.floorPattern,
      roomCleared: state.roomCleared,
      extractRelicPrompt: state.extractRelicPrompt,
      relicDraft: state.relicDraft,
      legendarySwapPending: state.legendarySwapPending,
      relicSwapPending: state.relicSwapPending,
      relics: state.relics,
      shrine: state.shrine,
      merchant: state.merchant,
      lastExtract: state.lastExtract,
      playerName: state.playerName,
      currentRunId: state.currentRunId,
      runLeaderboardSubmitted: state.runLeaderboardSubmitted,
      runMods: state.runMods,
      player: state.player,
      portal: state.portal,
      enemies: state.enemies,
      chests: state.chests,
      spikes: state.spikes,
      log: state.log,
      highscore: state.highscore,
      bestGold: state.bestGold,
      deaths: state.deaths,
      campGold: state.campGold,
      lives: state.lives,
      unlockedMutators: state.unlockedMutators,
      activeMutators: state.activeMutators,
      campUpgrades: state.campUpgrades,
      skillCooldowns: state.skillCooldowns,
      skillTiers: state.skillTiers,
      campVisitShopCostMult: state.campVisitShopCostMult,
      merchantUpgradeBoughtThisRoom: state.merchantUpgradeBoughtThisRoom,
      merchantPotionsBought: state.merchantPotionsBought || 0,
      potionsUsedThisRun: state.potionsUsedThisRun || 0
    };
  }

  function saveRunSnapshot() {
    if (state.phase !== "playing" && state.phase !== "relic" && state.phase !== "camp") {
      return;
    }
    localStorage.setItem(STORAGE_RUN_SAVE, JSON.stringify(buildRunSnapshot()));
    state.hasContinueRun = true;
    markUiDirty();
  }

  function tryLoadRunSnapshot() {
    const snapshot = readJsonStorage(STORAGE_RUN_SAVE, null);
    if (!snapshot || !snapshot.player || !snapshot.portal) {
      localStorage.removeItem(STORAGE_RUN_SAVE);
      state.hasContinueRun = false;
      return false;
    }

    const nextPhase =
      snapshot.phase === "playing" || snapshot.phase === "relic" || snapshot.phase === "camp"
        ? snapshot.phase
        : "playing";

    state.phase = nextPhase;
    state.depth = Math.max(0, Number(snapshot.depth) || 0);
    state.runMaxDepth = Math.max(0, Number(snapshot.runMaxDepth) || state.depth);
    state.runGoldEarned = Math.max(
      0,
      Number(snapshot.runGoldEarned) ||
      Number(snapshot.player?.gold) ||
      0
    );
    state.turn = Math.max(0, Number(snapshot.turn) || 0);
    state.roomIndex = Math.max(0, Number(snapshot.roomIndex) || 0);
    state.bossRoom = Boolean(snapshot.bossRoom);
    state.roomType = ROOM_TYPE_LABELS[snapshot.roomType] ? snapshot.roomType : "combat";
    state.floorPattern = Array.isArray(snapshot.floorPattern) ? snapshot.floorPattern : makeFloorPattern();
    state.roomCleared = Boolean(snapshot.roomCleared);
    if (
      nextPhase === "camp" &&
      snapshot.extractRelicPrompt &&
      typeof snapshot.extractRelicPrompt === "object" &&
      snapshot.extractRelicPrompt.relicReturn &&
      typeof snapshot.extractRelicPrompt.relicReturn === "object"
    ) {
      const relicReturn = snapshot.extractRelicPrompt.relicReturn;
      state.extractRelicPrompt = {
        baseGold: Math.max(0, Number(snapshot.extractRelicPrompt.baseGold) || 0),
        bonusGold: Math.max(0, Number(snapshot.extractRelicPrompt.bonusGold) || 0),
        relicReturn: {
          count: Math.max(0, Number(relicReturn.count) || 0),
          total: Math.max(0, Number(relicReturn.total) || 0),
          byRarity: {
            normal: Math.max(0, Number(relicReturn.byRarity?.normal) || 0),
            rare: Math.max(0, Number(relicReturn.byRarity?.rare) || 0),
            epic: Math.max(0, Number(relicReturn.byRarity?.epic) || 0),
            legendary: Math.max(0, Number(relicReturn.byRarity?.legendary) || 0)
          }
        },
        carriedRelics: Array.isArray(snapshot.extractRelicPrompt.carriedRelics)
          ? snapshot.extractRelicPrompt.carriedRelics.filter((id) => typeof id === "string")
          : []
      };
    } else {
      state.extractRelicPrompt = null;
    }
    state.relicDraft = Array.isArray(snapshot.relicDraft) ? snapshot.relicDraft : null;
    if (
      snapshot.legendarySwapPending &&
      typeof snapshot.legendarySwapPending === "object" &&
      typeof snapshot.legendarySwapPending.incomingRelicId === "string" &&
      typeof snapshot.legendarySwapPending.currentRelicId === "string"
    ) {
      state.legendarySwapPending = {
        incomingRelicId: snapshot.legendarySwapPending.incomingRelicId,
        currentRelicId: snapshot.legendarySwapPending.currentRelicId
      };
    } else {
      state.legendarySwapPending = null;
    }
    state.relicSwapPending = typeof snapshot.relicSwapPending === "string" ? snapshot.relicSwapPending : null;
    state.relics = Array.isArray(snapshot.relics) ? snapshot.relics : [];
    state.shrine = snapshot.shrine || null;
    state.merchant = snapshot.merchant || null;
    state.lastExtract = snapshot.lastExtract || null;
    if (typeof snapshot.playerName === "string") {
      setPlayerName(snapshot.playerName, { silent: true });
    }
    state.currentRunId = typeof snapshot.currentRunId === "string" && snapshot.currentRunId
      ? snapshot.currentRunId
      : nextPhase === "playing" || nextPhase === "relic"
        ? makeRunId()
        : null;
    state.runLeaderboardSubmitted = Boolean(snapshot.runLeaderboardSubmitted);

    state.runMods = {
      goldMultiplier: Number(snapshot.runMods?.goldMultiplier) || 1,
      extraEnemies: Number(snapshot.runMods?.extraEnemies) || 0,
      chestHealPenalty: Number(snapshot.runMods?.chestHealPenalty) || 0,
      enemyDamageBonus: Number(snapshot.runMods?.enemyDamageBonus) || 0,
      eliteChance: Number(snapshot.runMods?.eliteChance) || 0.12,
      enemyHpBonus: Number(snapshot.runMods?.enemyHpBonus) || 0,
      shopCostMult: Number(snapshot.runMods?.shopCostMult) || 1,
      eliteHpBonus: Number(snapshot.runMods?.eliteHpBonus) || 0,
      eliteGoldMult: Number(snapshot.runMods?.eliteGoldMult) || 1,
      extraSpikeMult: Number(snapshot.runMods?.extraSpikeMult) || 1,
      enemyDoubleMoveChance: Number(snapshot.runMods?.enemyDoubleMoveChance) || 0,
      noMerchants: Boolean(snapshot.runMods?.noMerchants),
      potionHealMult: Number(snapshot.runMods?.potionHealMult) || 1,
      enemyAtkPerDepth: Number(snapshot.runMods?.enemyAtkPerDepth) || 0,
      campGoldBonus: Number(snapshot.runMods?.campGoldBonus) || 0,
      extraRelicChoices: Number(snapshot.runMods?.extraRelicChoices) || 0
    };
    state.merchantPotionsBought = Number(snapshot.merchantPotionsBought) || 0;
    state.potionsUsedThisRun = Number(snapshot.potionsUsedThisRun) || 0;
    const snapshotCampVisitShopCostMult = Number(snapshot.campVisitShopCostMult);
    state.campVisitShopCostMult =
      snapshotCampVisitShopCostMult > 0
        ? snapshotCampVisitShopCostMult
        : nextPhase === "camp"
          ? Number(snapshot.runMods?.shopCostMult) || 1
          : 1;

    state.player = {
      x: Number(snapshot.player.x) || 4,
      y: Number(snapshot.player.y) || 4,
      hp: Number(snapshot.player.hp) || scaledCombat(BASE_PLAYER_HP),
      maxHp: Number(snapshot.player.maxHp) || scaledCombat(BASE_PLAYER_HP),
      attack: Number(snapshot.player.attack) || scaledCombat(BASE_PLAYER_ATTACK),
      armor: Number(snapshot.player.armor) || scaledCombat(BASE_PLAYER_ARMOR),
      potions: Number(snapshot.player.potions) || 1,
      maxPotions: Math.max(5, Number(snapshot.player.maxPotions) || 5),
      gold: Number(snapshot.player.gold) || 0,
      adrenaline: Number(snapshot.player.adrenaline) || 0,
      crit: Number(snapshot.player.crit) || 0.1,
      lastMoveX: Number(snapshot.player.lastMoveX) || 0,
      lastMoveY: Number(snapshot.player.lastMoveY) || -1,
      barrierArmor: Math.max(0, Number(snapshot.player.barrierArmor) || 0),
      barrierTurns: Math.max(0, Number(snapshot.player.barrierTurns) || 0),
      maxAdrenaline: Math.max(3, Number(snapshot.player.maxAdrenaline) || 3),
      soulHarvestCount: Math.max(0, Number(snapshot.player.soulHarvestCount) || 0),
      soulHarvestGained: Math.max(0, Number(snapshot.player.soulHarvestGained) || 0),
      chronoUsedThisRun: Boolean(snapshot.player.chronoUsedThisRun),
      phaseCooldown: Math.max(0, Number(snapshot.player.phaseCooldown) || 0),
      titanAttackPenalty: Math.max(0, Number(snapshot.player.titanAttackPenalty) || 0),
      chaosAtkBonus: Math.max(0, Number(snapshot.player.chaosAtkBonus) || 0),
      chaosAtkTurns: Math.max(0, Number(snapshot.player.chaosAtkTurns) || 0),
      chaosKillHeal: Math.max(0, Number(snapshot.player.chaosKillHeal) || 0),
      chaosRollCounter: clamp(
        Math.max(0, Number(snapshot.player.chaosRollCounter) || 0),
        0,
        CHAOS_ORB_ROLL_INTERVAL - 1
      ),
      autoPotionCooldown: Math.max(0, Number(snapshot.player.autoPotionCooldown) || 0),
      furyBlessingTurns: Math.max(0, Number(snapshot.player.furyBlessingTurns) || 0)
    };
    state.player.hp = clamp(state.player.hp, 1, state.player.maxHp);
    state.player.crit = clamp(state.player.crit, 0.01, CRIT_CHANCE_CAP);
    if (!hasRelic("chaosorb")) {
      state.player.chaosAtkBonus = 0;
      state.player.chaosAtkTurns = 0;
      state.player.chaosKillHeal = 0;
      state.player.chaosRollCounter = 0;
    }
    snapVisual(state.player);

    state.portal = {
      x: Number(snapshot.portal.x) || 1,
      y: Number(snapshot.portal.y) || 1
    };

    state.enemies = Array.isArray(snapshot.enemies) ? snapshot.enemies : [];
    for (const enemy of state.enemies) {
      if (enemy.cooldown == null) enemy.cooldown = 0;
      enemy.aiming = Boolean(enemy.aiming);
      enemy.castFlash = 0;
      enemy.frozenThisTurn = Boolean(enemy.frozenThisTurn);
      enemy.frostFx = Math.max(0, Number(enemy.frostFx) || 0);
      enemy.maxHp = Number(enemy.maxHp) || Number(enemy.hp) || 1;
      if (!enemy.facing) enemy.facing = "south";
      snapVisual(enemy);
    }
    state.chests = Array.isArray(snapshot.chests) ? snapshot.chests : [];
    state.spikes = Array.isArray(snapshot.spikes) ? snapshot.spikes : [];
    state.rangedBolts = [];
    state.rangedImpacts = [];
    state.shockwaveRings = [];
    state.dashTrails = [];
    state.dashAimActive = false;
    state.roomIntroTimer = 0;
    state.roomIntroDuration = 0;
    state.roomIntroTitle = "";
    state.roomIntroSubtitle = "";
    state.particles = [];
    state.log = Array.isArray(snapshot.log) ? snapshot.log.slice(0, 8) : [];
    normalizeRelicInventory();

    state.highscore = Math.max(state.highscore, Number(snapshot.highscore) || 0);
    state.bestGold = Math.max(state.bestGold, Number(snapshot.bestGold) || 0);
    state.deaths = Math.max(state.deaths, Number(snapshot.deaths) || 0);
    state.campGold = Math.max(
      state.campGold,
      Number(snapshot.campGold ?? snapshot.essence) || 0
    );
    state.lives = clamp(Number(snapshot.lives ?? state.lives), 0, MAX_LIVES);
    state.unlockedMutators = sanitizeMutatorMap(snapshot.unlockedMutators || state.unlockedMutators);
    state.activeMutators = sanitizeMutatorMap(snapshot.activeMutators || state.activeMutators);
    state.campUpgrades = sanitizeCampUpgrades(snapshot.campUpgrades || state.campUpgrades);
    state.skillCooldowns = sanitizeSkillCooldowns(snapshot.skillCooldowns || state.skillCooldowns);
    state.skillTiers = sanitizeSkillTiers(snapshot.skillTiers || state.skillTiers);
    state.merchantMenuOpen = false;
    state.leaderboardModalOpen = false;
    state.nameModalOpen = false;
    state.nameModalAction = null;
    state.merchantUpgradeBoughtThisRoom = Boolean(snapshot.merchantUpgradeBoughtThisRoom);

    state.hasContinueRun = true;
    markUiDirty();
    return true;
  }

  function ensureAudio() {
    if (state.audioMuted) return false;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return false;

    if (!audio.ctx) {
      audio.ctx = new AudioContextCtor();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = BASE_SYNTH_MASTER_GAIN * SYNTH_VOLUME_MULTIPLIER;
      audio.master.connect(audio.ctx.destination);
    }
    audio.master.gain.value = BASE_SYNTH_MASTER_GAIN * SYNTH_VOLUME_MULTIPLIER;
    if (audio.ctx.state === "suspended") {
      audio.ctx.resume();
    }
    return true;
  }

  function loadPlayerSprites() {
    for (const [direction, paths] of Object.entries(PLAYER_SPRITE_FRAME_PATHS)) {
      playerSprites[direction] = {
        frames: new Array(paths.length).fill(null),
        readyCount: 0,
        failed: false
      };
      paths.forEach((path, frameIndex) => {
        const img = new Image();
        img.onload = () => {
          playerSprites[direction].frames[frameIndex] = img;
          playerSprites[direction].readyCount += 1;
          markUiDirty();
        };
        img.onerror = () => {
          if (!playerSprites[direction].failed) {
            playerSprites[direction].failed = true;
            pushLog(`Player sprite failed: ${path}`, "bad");
          }
        };
        img.src = `${path}?v=${PLAYER_SPRITE_VERSION}`;
      });
    }
  }

  function loadChestSprite() {
    const img = new Image();
    chestSprite.img = img;
    chestSprite.ready = false;
    chestSprite.failed = false;
    img.onload = () => {
      chestSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!chestSprite.failed) {
        chestSprite.failed = true;
        pushLog(`Chest sprite failed: ${CHEST_SPRITE_PATH}`, "bad");
      }
    };
    img.src = `${CHEST_SPRITE_PATH}?v=${CHEST_SPRITE_VERSION}`;
  }

  function loadPortalSprite() {
    portalSprite.frames = new Array(PORTAL_SPRITE_FRAME_PATHS.length).fill(null);
    portalSprite.readyCount = 0;
    portalSprite.failed = false;
    PORTAL_SPRITE_FRAME_PATHS.forEach((path, frameIndex) => {
      const img = new Image();
      img.onload = () => {
        portalSprite.frames[frameIndex] = img;
        portalSprite.readyCount += 1;
        markUiDirty();
      };
      img.onerror = () => {
        if (!portalSprite.failed) {
          portalSprite.failed = true;
          pushLog(`Portal frame failed: ${path}`, "bad");
        }
      };
      img.src = `${path}?v=${PORTAL_SPRITE_VERSION}`;
    });
  }

  function loadSpikeSprite() {
    const img = new Image();
    spikeSprite.img = img;
    spikeSprite.ready = false;
    spikeSprite.failed = false;
    img.onload = () => {
      spikeSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!spikeSprite.failed) {
        spikeSprite.failed = true;
        pushLog(`Spike sprite failed: ${SPIKE_SPRITE_PATH}`, "bad");
      }
    };
    img.src = `${SPIKE_SPRITE_PATH}?v=${SPIKE_SPRITE_VERSION}`;
  }

  function loadTilesetSprite() {
    const img = new Image();
    tilesetSprite.img = img;
    tilesetSprite.ready = false;
    tilesetSprite.failed = false;
    img.onload = () => {
      tilesetSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!tilesetSprite.failed) {
        tilesetSprite.failed = true;
        pushLog(`Tileset failed: ${TILESET_SPRITE_PATH}`, "bad");
      }
    };
    img.src = `${TILESET_SPRITE_PATH}?v=${TILESET_SPRITE_VERSION}`;
  }

  function loadSlimeSprites() {
    for (const [direction, paths] of Object.entries(SLIME_SPRITE_FRAME_PATHS)) {
      slimeSprites[direction] = {
        frames: new Array(paths.length).fill(null),
        readyCount: 0,
        failed: false
      };
      paths.forEach((path, frameIndex) => {
        const img = new Image();
        img.onload = () => {
          slimeSprites[direction].frames[frameIndex] = img;
          slimeSprites[direction].readyCount += 1;
          markUiDirty();
        };
        img.onerror = () => {
          if (!slimeSprites[direction].failed) {
            slimeSprites[direction].failed = true;
            pushLog(`Slime sprite failed: ${path}`, "bad");
          }
        };
        img.src = `${path}?v=${SLIME_SPRITE_VERSION}`;
      });
    }
  }

  function loadSkeletonSprites() {
    for (const [direction, paths] of Object.entries(SKELETON_SPRITE_FRAME_PATHS)) {
      skeletonSprites[direction] = {
        frames: new Array(paths.length).fill(null),
        readyCount: 0,
        failed: false
      };
      paths.forEach((path, frameIndex) => {
        const img = new Image();
        img.onload = () => {
          skeletonSprites[direction].frames[frameIndex] = img;
          skeletonSprites[direction].readyCount += 1;
          markUiDirty();
        };
        img.onerror = () => {
          if (!skeletonSprites[direction].failed) {
            skeletonSprites[direction].failed = true;
            pushLog(`Skeleton sprite failed: ${path}`, "bad");
          }
        };
        img.src = `${path}?v=${SKELETON_SPRITE_VERSION}`;
      });
    }
  }

  function loadBruteSprites() {
    for (const [direction, paths] of Object.entries(BRUTE_SPRITE_FRAME_PATHS)) {
      bruteSprites[direction] = {
        frames: new Array(paths.length).fill(null),
        readyCount: 0,
        failed: false
      };
      paths.forEach((path, frameIndex) => {
        const img = new Image();
        img.onload = () => {
          bruteSprites[direction].frames[frameIndex] = img;
          bruteSprites[direction].readyCount += 1;
          markUiDirty();
        };
        img.onerror = () => {
          if (!bruteSprites[direction].failed) {
            bruteSprites[direction].failed = true;
            pushLog(`Brute sprite failed: ${path}`, "bad");
          }
        };
        img.src = `${path}?v=${BRUTE_SPRITE_VERSION}`;
      });
    }
  }

  function ensureSplashTrack() {
    if (audio.splash) return;
    audio.splash = new Audio(SPLASH_TRACK);
    audio.splash.loop = false;
    audio.splash.preload = "auto";
    audio.splash.volume = 0.5;
    audio.splash.addEventListener("error", () => {
      pushLog(`Music file failed: ${SPLASH_TRACK}`, "bad");
    });
    audio.splash.load();
  }

  function stopSplashTrack(resetTime = false) {
    if (!audio.splash) return;
    audio.splash.pause();
    if (resetTime) {
      audio.splash.currentTime = 0;
    }
  }

  function playSplashTrack() {
    if (state.audioMuted) return;
    ensureSplashTrack();
    if (!audio.splash) return;
    stopSplashTrack(true);
    const playPromise = audio.splash.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        if (!audio.bgmWarned) {
          pushLog("Browser blocked autoplay. Press any key or click game area.", "bad");
          audio.bgmWarned = true;
        }
      });
    }
  }

  function ensureDeathTrack() {
    if (audio.deathSample) return;
    audio.deathSample = new Audio(DEATH_TRACK);
    audio.deathSample.loop = false;
    audio.deathSample.preload = "auto";
    audio.deathSample.volume = 0.65;
    audio.deathSample.addEventListener("error", () => {
      pushLog(`Music file failed: ${DEATH_TRACK}`, "bad");
    });
    audio.deathSample.load();
  }

  function stopDeathTrack(resetTime = false) {
    if (!audio.deathSample) return;
    audio.deathSample.pause();
    if (resetTime) {
      audio.deathSample.currentTime = 0;
    }
  }

  function playDeathTrack() {
    if (state.audioMuted) return false;
    ensureDeathTrack();
    if (!audio.deathSample) return false;
    stopDeathTrack(true);
    const playPromise = audio.deathSample.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        if (!audio.deathWarned) {
          pushLog("Browser blocked autoplay. Press any key or click game area.", "bad");
          audio.deathWarned = true;
        }
      });
    }
    return true;
  }

  function createBgmTrack(src, volume) {
    const track = new Audio(src);
    track.loop = true;
    track.preload = "auto";
    track.volume = volume;
    track.addEventListener("error", () => {
      pushLog(`Music file failed: ${src}`, "bad");
    });
    return track;
  }

  function ensureBgmTracks() {
    if (audio.bgmReady) return;
    audio.bgmNormal = createBgmTrack(MUSIC_TRACKS.normal, 0.36);
    audio.bgmBoss = createBgmTrack(MUSIC_TRACKS.boss, 0.4);
    audio.bgmNormal.load();
    audio.bgmBoss.load();
    audio.bgmReady = true;
  }

  function pauseBgmTrack(track, resetTime = false) {
    if (!track) return;
    track.pause();
    if (resetTime) {
      track.currentTime = 0;
    }
  }

  function stopAllBgm(resetTime = false) {
    pauseBgmTrack(audio.bgmNormal, resetTime);
    pauseBgmTrack(audio.bgmBoss, resetTime);
    audio.currentBgm = null;
  }

  function playBgmTrack(track) {
    if (!track || state.audioMuted) return;
    const playPromise = track.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        if (!audio.bgmWarned) {
          pushLog("Browser blocked autoplay. Press any key or click game area.", "bad");
          audio.bgmWarned = true;
        }
      });
    }
  }

  function syncBgmWithState(force = false) {
    ensureBgmTracks();

    const allowMusic = state.phase === "playing" || state.phase === "relic";
    const splashPlaying = state.phase === "menu" || state.phase === "camp" || state.phase === "dead";
    if (state.audioMuted || !allowMusic) {
      stopAllBgm(false);
      if (!splashPlaying) {
        stopSplashTrack(false);
      }
      return;
    }

    stopSplashTrack(false);

    const target = state.bossRoom ? audio.bgmBoss : audio.bgmNormal;
    const other = target === audio.bgmNormal ? audio.bgmBoss : audio.bgmNormal;

    pauseBgmTrack(other, true);

    if (audio.currentBgm !== target) {
      pauseBgmTrack(audio.currentBgm, true);
      audio.currentBgm = target;
    }

    if (force && target.paused) {
      target.currentTime = 0;
    }
    if (target.paused) {
      playBgmTrack(target);
    }
  }

  function playTone(ctx, destination, options) {
    const {
      at = ctx.currentTime,
      frequency = 220,
      endFrequency = frequency,
      duration = 0.08,
      type = "square",
      gain = 0.08
    } = options;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    osc.frequency.linearRampToValueAtTime(endFrequency, at + duration);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(gain, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env);
    env.connect(destination);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  function playSfx(kind) {
    if (!ensureAudio()) return;
    const ctx = audio.ctx;
    const out = audio.master;
    const now = ctx.currentTime + 0.002;

    if (kind === "hit") {
      playTone(ctx, out, {
        at: now,
        frequency: 170,
        endFrequency: 120,
        duration: 0.06,
        type: "square",
        gain: 0.06
      });
      return;
    }
    if (kind === "death") {
      playTone(ctx, out, {
        at: now,
        frequency: 210,
        endFrequency: 90,
        duration: 0.24,
        type: "sawtooth",
        gain: 0.08
      });
      playTone(ctx, out, {
        at: now + 0.12,
        frequency: 90,
        endFrequency: 60,
        duration: 0.2,
        type: "triangle",
        gain: 0.06
      });
      return;
    }
    if (kind === "chrono") {
      playTone(ctx, out, {
        at: now,
        frequency: 170,
        endFrequency: 620,
        duration: 0.18,
        type: "triangle",
        gain: 0.08
      });
      playTone(ctx, out, {
        at: now + 0.04,
        frequency: 250,
        endFrequency: 1040,
        duration: 0.24,
        type: "sawtooth",
        gain: 0.06
      });
      playTone(ctx, out, {
        at: now + 0.16,
        frequency: 940,
        endFrequency: 420,
        duration: 0.28,
        type: "sine",
        gain: 0.055
      });
      return;
    }
    if (kind === "bosswarn") {
      playTone(ctx, out, {
        at: now,
        frequency: 150,
        endFrequency: 300,
        duration: 0.18,
        type: "sawtooth",
        gain: 0.085
      });
      playTone(ctx, out, {
        at: now + 0.16,
        frequency: 300,
        endFrequency: 120,
        duration: 0.34,
        type: "triangle",
        gain: 0.07
      });
      return;
    }
    if (kind === "portal") {
      playTone(ctx, out, {
        at: now,
        frequency: 280,
        endFrequency: 540,
        duration: 0.12,
        type: "triangle",
        gain: 0.065
      });
      playTone(ctx, out, {
        at: now + 0.09,
        frequency: 510,
        endFrequency: 760,
        duration: 0.14,
        type: "triangle",
        gain: 0.06
      });
      return;
    }
    if (kind === "chest") {
      playTone(ctx, out, {
        at: now,
        frequency: 620,
        endFrequency: 730,
        duration: 0.06,
        type: "square",
        gain: 0.06
      });
      playTone(ctx, out, {
        at: now + 0.05,
        frequency: 760,
        endFrequency: 880,
        duration: 0.08,
        type: "square",
        gain: 0.06
      });
    }
  }

  function toggleAudio() {
    state.audioMuted = !state.audioMuted;
    localStorage.setItem(STORAGE_AUDIO_MUTED, state.audioMuted ? "1" : "0");
    if (state.audioMuted) {
      stopSplashTrack(false);
      stopDeathTrack(false);
    }
    syncBgmWithState(true);
    pushLog(`Audio ${state.audioMuted ? "muted" : "enabled"}.`);
    markUiDirty();
  }

  function unlockMutator(id) {
    if (state.unlockedMutators[id]) return false;
    state.unlockedMutators[id] = true;
    return true;
  }

  function syncMutatorUnlocks() {
    const newlyUnlocked = [];
    const rules = [
      { id: "berserker", ok: state.totalKills >= 50 },
      { id: "bulwark", ok: state.highscore >= 8 },
      { id: "alchemist", ok: state.totalMerchantPots >= 10 },
      { id: "greed", ok: state.totalGoldEarned >= 1000 },
      { id: "hunter", ok: state.eliteKills >= 30 },
      { id: "haste", ok: state.highscore >= 10 },
      { id: "glassdepths", ok: state.highscore >= 12 },
      { id: "famine", ok: state.potionFreeExtract >= 1 },
      { id: "elitist", ok: state.eliteKills >= 100 },
      { id: "ascension", ok: state.highscore >= 15 }
    ];

    for (const rule of rules) {
      if (rule.ok && unlockMutator(rule.id)) {
        const mutator = MUTATORS.find((item) => item.id === rule.id);
        if (mutator) newlyUnlocked.push(mutator);
      }
    }

    if (newlyUnlocked.length > 0) {
      persistMutatorState();
      markUiDirty();
    }
    return newlyUnlocked;
  }

  function isMutatorActive(id) {
    return Boolean(state.activeMutators[id] && state.unlockedMutators[id]);
  }

  function activeMutatorCount() {
    let count = 0;
    for (const mutator of MUTATORS) {
      if (isMutatorActive(mutator.id)) count += 1;
    }
    return count;
  }

  function toggleMutator(index) {
    const mutator = MUTATORS[index];
    if (!mutator) return;
    if (!state.unlockedMutators[mutator.id]) {
      pushLog(`${mutator.name} is locked (${mutator.unlockText}).`, "bad");
      return;
    }
    const willEnable = !state.activeMutators[mutator.id];
    if (willEnable && activeMutatorCount() >= 3) {
      pushLog("Max 3 active mutators.", "bad");
      return;
    }
    state.activeMutators[mutator.id] = willEnable;
    persistMutatorState();
    pushLog(`${mutator.name} ${willEnable ? "enabled" : "disabled"} for next run.`);
    markUiDirty();
  }

  function getMenuOptions() {
    return [
      {
        key: "1",
        title: "Start New Game",
        desc: state.playerName
          ? `Begin a fresh run as ${state.playerName}.`
          : "Set nickname first, then begin a fresh run.",
        disabled: false,
        action: () => {
          if (!state.playerName) {
            openNameModal("start_new_game");
            return;
          }
          startFreshSessionRun();
        }
      },
      {
        key: "2",
        title: "Continue",
        desc: state.hasContinueRun ? "Resume your saved run." : "No saved run available.",
        disabled: !state.hasContinueRun,
        action: () => {
          if (!tryLoadRunSnapshot()) {
            pushLog("No valid run save found.", "bad");
            state.hasContinueRun = false;
            markUiDirty();
            return;
          }
          stopSplashTrack(true);
          pushLog("Run continued.");
          syncBgmWithState(true);
          markUiDirty();
        }
      },
      {
        key: "3",
        title: "Leaderboard",
        desc: isOnlineLeaderboardEnabled()
          ? "Open Top 20 online ranking (with local fallback)."
          : "Open Top 20 local ranking.",
        disabled: false,
        action: () => openLeaderboardModal()
      },
      {
        key: "4",
        title: state.playerName ? `Nickname: ${state.playerName}` : "Set Nickname",
        desc: "Set or edit player nickname.",
        disabled: false,
        action: () => openNameModal(null)
      },
      {
        key: "5",
        title: `Audio: ${state.audioMuted ? "OFF" : "ON"}`,
        desc: "Toggle game music and sound.",
        disabled: false,
        action: () => toggleAudio()
      },
      {
        key: "6",
        title: "Clear Continue Slot",
        desc: "Delete saved run data.",
        disabled: !state.hasContinueRun,
        action: () => {
          clearRunSnapshot();
          pushLog("Continue slot cleared.");
        }
      }
    ];
  }

  function moveMenuSelection(step) {
    const options = getMenuOptions();
    if (options.length === 0) return;
    let next = state.menuIndex;
    for (let i = 0; i < options.length; i += 1) {
      next = (next + step + options.length) % options.length;
      if (!options[next].disabled) {
        state.menuIndex = next;
        markUiDirty();
        return;
      }
    }
  }

  function activateMenuOption(index = state.menuIndex) {
    const options = getMenuOptions();
    const option = options[index];
    if (!option || option.disabled) return;
    option.action();
    markUiDirty();
  }

  function dismissBootScreen() {
    if (gameAppEl) gameAppEl.classList.remove("app-hidden");
    if (bootScreenEl) {
      bootScreenEl.classList.add("fading");
      bootScreenEl.addEventListener("transitionend", () => {
        bootScreenEl.classList.add("hidden");
      }, { once: true });
    }
  }

  function enterSplash() {
    dismissBootScreen();
    playSplashTrack();
    // Skip splash phase, go straight to menu
    enterMenu();
  }

  function enterMenu() {
    state.phase = "menu";
    state.merchantMenuOpen = false;
    state.leaderboardModalOpen = false;
    state.nameModalOpen = false;
    state.nameModalAction = null;
    state.finalGameOverPrompt = null;
    const options = getMenuOptions();
    const firstEnabled = options.findIndex((item) => !item.disabled);
    state.menuIndex = firstEnabled >= 0 ? firstEnabled : 0;
    syncBgmWithState();
    if (isOnlineLeaderboardEnabled()) {
      flushPendingLeaderboardQueue();
      refreshOnlineLeaderboard(false);
    }
    markUiDirty();
  }

  function getCampUpgradeLevel(id) {
    return state.campUpgrades[id] || 0;
  }

  function getCampUpgradeCost(def) {
    const level = getCampUpgradeLevel(def.id);
    const base = Math.round(def.baseCost * 2 ** level);
    const visitMult = state.phase === "camp"
      ? (state.campVisitShopCostMult || 1)
      : (state.runMods?.shopCostMult || 1);
    return Math.round(base * visitMult);
  }

  function getCampVisitShopTaxPercent() {
    const mult = Math.max(0, Number(state.campVisitShopCostMult) || 1);
    return Math.max(0, Math.round((mult - 1) * 100));
  }

  function getCampUpgradeCurrency(def) {
    return "camp gold";
  }

  function getCampUpgradeWallet(def) {
    return state.campGold;
  }

  function spendCampUpgradeCurrency(def, amount) {
    state.campGold = Math.max(0, state.campGold - amount);
  }

  function buyCampUpgrade(index) {
    if (state.phase !== "camp") return;
    const def = CAMP_UPGRADES[index];
    if (!def) return;

    const level = getCampUpgradeLevel(def.id);
    if (level >= def.max) {
      pushLog(`${def.name} is maxed.`, "bad");
      return;
    }
    const cost = getCampUpgradeCost(def);
    const currency = getCampUpgradeCurrency(def);
    if (getCampUpgradeWallet(def) < cost) {
      pushLog(`Not enough ${currency} (${cost} needed).`, "bad");
      return;
    }
    spendCampUpgradeCurrency(def, cost);
    state.campUpgrades[def.id] = level + 1;
    persistCampProgress();
    pushLog(`${def.name} upgraded to level ${level + 1}.`, "good");
    saveRunSnapshot();
    markUiDirty();
  }

  function chooseRoomType() {
    const guaranteedMerchantRoom = state.roomIndex === 18;
    if (guaranteedMerchantRoom) {
      return "merchant";
    }

    const roll = Math.random();
    let type;
    if (state.depth < 2) {
      if (roll < 0.8) type = "combat";
      else if (roll < 0.97) type = "treasure";
      else type = "merchant";
    } else if (state.depth < 5) {
      if (roll < 0.6) type = "combat";
      else if (roll < 0.78) type = "treasure";
      else if (roll < 0.91) type = "shrine";
      else if (roll < 0.96) type = "cursed";
      else type = "merchant";
    } else if (state.depth < 10) {
      if (roll < 0.56) type = "combat";
      else if (roll < 0.73) type = "treasure";
      else if (roll < 0.87) type = "shrine";
      else if (roll < 0.97) type = "cursed";
      else type = "merchant";
    } else {
      if (roll < 0.5) type = "combat";
      else if (roll < 0.66) type = "treasure";
      else if (roll < 0.8) type = "shrine";
      else if (roll < 0.96) type = "cursed";
      else type = "merchant";
    }
    // Famine mutator: no merchants
    if (type === "merchant" && state.runMods.noMerchants && !guaranteedMerchantRoom) type = "combat";
    return type;
  }

  function merchantPotionCost() {
    const bought = state.merchantPotionsBought || 0;
    const base = 10 * Math.pow(2, bought); // 10, 20, 40, 80, 160...
    const discounted = hasRelic("merchfavor") ? Math.round(base * 0.5) : base;
    return Math.round(discounted * (state.runMods?.shopCostMult || 1));
  }

  function getSkillTier(skillId) {
    return clamp(Number(state.skillTiers?.[skillId]) || 0, 0, MAX_SKILL_TIER);
  }

  function getSkillTierLabelByValue(tier) {
    return SKILL_TIER_LABELS[clamp(tier, 0, MAX_SKILL_TIER)] || SKILL_TIER_LABELS[0];
  }

  function getSkillTierLabel(skillId) {
    return getSkillTierLabelByValue(getSkillTier(skillId));
  }

  function getNextSkillUpgradeOffer(skillId) {
    const tier = getSkillTier(skillId);
    const upgrades = MERCHANT_SKILL_UPGRADES[skillId] || [];
    return upgrades[tier] || null;
  }

  function merchantSkillUpgradeCost(skillId) {
    const offer = getNextSkillUpgradeOffer(skillId);
    if (!offer) return null;
    const discounted = hasRelic("merchfavor") ? Math.round(offer.cost * 0.5) : offer.cost;
    return Math.max(1, Math.round(discounted * (state.runMods?.shopCostMult || 1)));
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
    if (state.player.gold < cost) {
      pushLog(`Merchant: need ${cost} gold for a potion.`, "bad");
      return false;
    }
    state.player.gold -= cost;
    state.merchantPotionsBought = (state.merchantPotionsBought || 0) + 1;
    state.totalMerchantPots += 1;
    localStorage.setItem(STORAGE_TOTAL_MERCHANT_POTS, String(state.totalMerchantPots));
    grantPotion(1);
    spawnParticles(state.player.x, state.player.y, "#ffd98a", 10, 1.15);
    const nextCost = merchantPotionCost();
    pushLog(`Merchant deal: -${cost} gold, +1 potion (${state.player.potions}/${state.player.maxPotions}). Next: ${nextCost}g.`, "good");
    saveRunSnapshot();
    markUiDirty();
    return true;
  }

  function pickEliteAffix() {
    const roll = Math.random();
    if (roll < 0.34) return "fast";
    if (roll < 0.67) return "tank";
    return "vampiric";
  }

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

  function relicHotkeyForIndex(index) {
    return index === 9 ? "0" : String(index + 1);
  }

  function getRelicDiscardHotkeyHint() {
    return MAX_RELICS >= 10 ? "1-0" : `1-${MAX_RELICS}`;
  }

  function getRelicDraftSkipIndex() {
    const draftSize = Math.max(0, state.relicDraft?.length || 0);
    // Default drafts are 3 choices -> key 4 for skip.
    // If mutators add more choices, fallback to key 0.
    if (draftSize <= 3) return 3;
    return 9;
  }

  function getRelicDraftSkipHotkey() {
    return relicHotkeyForIndex(getRelicDraftSkipIndex());
  }

  function applyRelicEffects(relicId, options = {}) {
    const onGain = options.onGain !== false;
    // Normal
    if (relicId === "fang") { state.player.attack += scaledCombat(1); return; }
    if (relicId === "plating") { state.player.armor += scaledCombat(1); return; }
    if (relicId === "lucky") { state.player.crit = clamp(state.player.crit + 0.05, 0.01, CRIT_CHANCE_CAP); return; }
    if (relicId === "flask") {
      state.player.maxPotions += 1;
      if (onGain) grantPotion(1);
      return;
    }
    if (relicId === "lifebloom") {
      state.player.maxHp += scaledCombat(2);
      if (onGain) {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + scaledCombat(2));
      } else {
        state.player.hp = Math.min(state.player.hp, state.player.maxHp);
      }
      return;
    }
    if (relicId === "ironboots") { return; } // passive: checked in spike logic
    // Rare
    if (relicId === "idol") { state.runMods.goldMultiplier += 0.2; return; }
    if (relicId === "thornmail") { return; } // passive: checked in enemy melee
    if (relicId === "vampfang") { return; } // passive: checked in killEnemy
    if (relicId === "adrenal") {
      state.player.maxAdrenaline += 2;
      if (onGain) {
        state.player.adrenaline = Math.min(state.player.maxAdrenaline, state.player.adrenaline + 2);
      } else {
        state.player.adrenaline = Math.min(state.player.maxAdrenaline, state.player.adrenaline);
      }
      return;
    }
    if (relicId === "scoutlens") { return; } // passive: checked in draw
    if (relicId === "magnet") { return; } // passive: checked after move
    if (relicId === "shrineward") { return; } // passive: checked in shrine
    if (relicId === "merchfavor") { return; } // passive: checked in merchant
    // Epic
    if (relicId === "glasscannon") {
      state.player.attack += scaledCombat(4);
      state.player.maxHp = Math.max(scaledCombat(4), state.player.maxHp - scaledCombat(5));
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
      return;
    }
    if (relicId === "echostrike") { return; } // passive: checked in attackEnemy
    if (relicId === "phasecloak") {
      if (onGain) state.player.phaseCooldown = 5;
      return;
    }
    if (relicId === "soulharvest") { return; } // passive: checked in killEnemy
    if (relicId === "burnblade") { return; } // passive: checked in attackEnemy
    if (relicId === "frostamulet") { return; } // passive: checked in enemyTurn
    // Legendary
    if (relicId === "chronoloop") {
      if (onGain) state.player.chronoUsedThisRun = false;
      return;
    }
    if (relicId === "voidreaper") {
      state.player.crit = clamp(state.player.crit + 0.15, 0.01, CRIT_CHANCE_CAP);
      return;
    }
    if (relicId === "titanheart") {
      state.player.maxHp += scaledCombat(8);
      state.player.armor += scaledCombat(2);
      const penalty = Math.min(scaledCombat(2), Math.max(0, state.player.attack - scaledCombat(1)));
      state.player.attack -= penalty;
      state.player.titanAttackPenalty = penalty;
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
      return;
    }
    if (relicId === "chaosorb") {
      state.player.chaosAtkBonus = 0;
      state.player.chaosAtkTurns = 0;
      state.player.chaosKillHeal = 0;
      state.player.chaosRollCounter = 0;
      return;
    } // passive: checked in finalizeTurn
  }

  function removeRelicEffects(relicId) {
    // Normal
    if (relicId === "fang") { state.player.attack = Math.max(scaledCombat(1), state.player.attack - scaledCombat(1)); return; }
    if (relicId === "plating") { state.player.armor = Math.max(0, state.player.armor - scaledCombat(1)); return; }
    if (relicId === "lucky") { state.player.crit = clamp(state.player.crit - 0.05, 0.01, CRIT_CHANCE_CAP); return; }
    if (relicId === "flask") {
      state.player.maxPotions = Math.max(1, state.player.maxPotions - 1);
      state.player.potions = Math.min(state.player.potions, state.player.maxPotions);
      return;
    }
    if (relicId === "lifebloom") {
      state.player.maxHp = Math.max(scaledCombat(4), state.player.maxHp - scaledCombat(2));
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
      return;
    }
    if (relicId === "ironboots") { return; }
    // Rare
    if (relicId === "idol") {
      state.runMods.goldMultiplier = Math.max(0.2, state.runMods.goldMultiplier - 0.2);
      return;
    }
    if (relicId === "thornmail") { return; }
    if (relicId === "vampfang") {
      state.player.vampFangKills = 0;
      return;
    }
    if (relicId === "adrenal") {
      state.player.maxAdrenaline = Math.max(3, state.player.maxAdrenaline - 2);
      state.player.adrenaline = Math.min(state.player.adrenaline, state.player.maxAdrenaline);
      return;
    }
    if (relicId === "scoutlens") { return; }
    if (relicId === "magnet") { return; }
    if (relicId === "shrineward") { return; }
    if (relicId === "merchfavor") { return; }
    // Epic
    if (relicId === "glasscannon") {
      state.player.attack = Math.max(scaledCombat(1), state.player.attack - scaledCombat(4));
      state.player.maxHp += scaledCombat(5);
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
      return;
    }
    if (relicId === "echostrike") { return; }
    if (relicId === "phasecloak") {
      state.player.phaseCooldown = 0;
      return;
    }
    if (relicId === "soulharvest") {
      const gained = Math.max(0, state.player.soulHarvestGained || 0);
      if (gained > 0) {
        state.player.maxHp = Math.max(scaledCombat(4), state.player.maxHp - gained * scaledCombat(1));
      }
      state.player.soulHarvestCount = 0;
      state.player.soulHarvestGained = 0;
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
      return;
    }
    if (relicId === "burnblade") { return; }
    if (relicId === "frostamulet") { return; }
    // Legendary
    if (relicId === "chronoloop") { return; }
    if (relicId === "voidreaper") {
      state.player.crit = clamp(state.player.crit - 0.15, 0.01, CRIT_CHANCE_CAP);
      return;
    }
    if (relicId === "titanheart") {
      state.player.maxHp = Math.max(scaledCombat(4), state.player.maxHp - scaledCombat(8));
      state.player.armor = Math.max(0, state.player.armor - scaledCombat(2));
      const refund = Math.max(0, state.player.titanAttackPenalty || 0);
      state.player.attack += refund;
      state.player.titanAttackPenalty = 0;
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
      return;
    }
    if (relicId === "chaosorb") {
      state.player.chaosAtkBonus = 0;
      state.player.chaosAtkTurns = 0;
      state.player.chaosKillHeal = 0;
      state.player.chaosRollCounter = 0;
      return;
    }
  }

  function applyRelic(relicId, options = {}) {
    const relic = getRelicById(relicId);
    if (!relic) return false;
    const canStack = relic.rarity === "normal";
    if (canStack && getRelicStackCount(relicId) >= MAX_NORMAL_RELIC_STACK) return false;
    if (!canStack && state.relics.includes(relicId)) return false;
    if (state.relics.length >= MAX_RELICS) return false;
    if (relic.rarity === "legendary" && hasLegendaryRelic()) return false;
    state.relics.push(relicId);
    applyRelicEffects(relicId, options);
    markUiDirty();
    return true;
  }

  function removeRelic(relicId, options = {}) {
    const silent = Boolean(options.silent);
    const idx = state.relics.indexOf(relicId);
    if (idx < 0) return false;
    state.relics.splice(idx, 1);
    removeRelicEffects(relicId);
    if (!silent) {
      const relic = getRelicById(relicId);
      if (relic) {
        pushLog(`Relic discarded: ${relic.name}.`, "bad");
      }
    } else {
      markUiDirty();
    }
    return true;
  }

  function normalizeRelicInventory() {
    const original = [...state.relics];
    let keptCount = 0;
    let keptLegendary = false;
    const keptUniqueNonStack = new Set();
    const keptNormalStacks = new Map();
    let changed = false;

    for (const relicId of original) {
      const relic = getRelicById(relicId);
      const isLegendary = Boolean(relic && relic.rarity === "legendary");
      const isStackableNormal = Boolean(relic && relic.rarity === "normal");
      const duplicateNonStack = Boolean(relic && !isStackableNormal && keptUniqueNonStack.has(relicId));
      const normalStackCount = isStackableNormal ? (keptNormalStacks.get(relicId) || 0) : 0;
      const normalStackOverCap = isStackableNormal && normalStackCount >= MAX_NORMAL_RELIC_STACK;
      if (!relic || keptCount >= MAX_RELICS || (isLegendary && keptLegendary) || duplicateNonStack || normalStackOverCap) {
        if (removeRelic(relicId, { silent: true })) {
          changed = true;
        }
        continue;
      }
      keptCount += 1;
      if (isStackableNormal) {
        keptNormalStacks.set(relicId, normalStackCount + 1);
      } else {
        keptUniqueNonStack.add(relicId);
      }
      if (isLegendary) keptLegendary = true;
    }

    if (changed) {
      state.relicDraft = null;
      state.legendarySwapPending = null;
      state.relicSwapPending = null;
      if (state.phase === "relic") {
        state.phase = "playing";
      }
    }
    return changed;
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

  function rollRelicRarity(isBoss) {
    const depthBonus = Math.floor(state.depth / 5);
    let legendaryChance = 0.02 + depthBonus * 0.008;
    let epicChance = 0.06 + depthBonus * 0.012;
    let rareChance = 0.17;
    // Boss draft: boosted rarity
    if (isBoss) {
      legendaryChance += 0.03;
      epicChance += 0.06;
      rareChance += 0.10;
    }
    const roll = Math.random();
    if (roll < legendaryChance) return "legendary";
    if (roll < legendaryChance + epicChance) return "epic";
    if (roll < legendaryChance + epicChance + rareChance) return "rare";
    return "normal";
  }

  function openRelicDraft(isBoss = false) {
    normalizeRelicInventory();
    const pool = RELICS.filter(
      (relic) =>
        (relic.rarity === "normal" && !isNormalRelicStackAtCap(relic.id)) ||
        (relic.rarity !== "normal" && !state.relics.includes(relic.id))
    );
    if (pool.length === 0) return;

    const choices = [];
    const usedIds = new Set();
    const draftSize = 3 + (state.runMods.extraRelicChoices || 0);
    for (let i = 0; i < draftSize; i += 1) {
      const rarity = rollRelicRarity(isBoss);
      let candidates = pool.filter((r) => r.rarity === rarity && !usedIds.has(r.id));
      // Fallback: try any rarity if no candidates
      if (candidates.length === 0) candidates = pool.filter((r) => !usedIds.has(r.id));
      if (candidates.length === 0) break;
      const pick = candidates[randInt(0, candidates.length - 1)];
      choices.push(pick);
      usedIds.add(pick.id);
    }
    if (choices.length === 0) return;
    state.relicDraft = choices;
    state.legendarySwapPending = null;
    state.relicSwapPending = null;
    state.phase = "relic";
    syncBgmWithState();
    pushLog(`Relic draft! Choose 1-${choices.length} or ${getRelicDraftSkipHotkey()} to skip.`, "good");
    saveRunSnapshot();
    markUiDirty();
  }

  function chooseRelic(index) {
    if (state.phase !== "relic") return;
    if (state.legendarySwapPending) {
      const incomingRelic = getRelicById(state.legendarySwapPending.incomingRelicId);
      const currentRelic = getRelicById(state.legendarySwapPending.currentRelicId);
      if (!incomingRelic || !currentRelic || !state.relics.includes(currentRelic.id)) {
        state.legendarySwapPending = null;
        markUiDirty();
        return;
      }

      if (index === 0) {
        pushLog(`Kept ${currentRelic.name}. ${incomingRelic.name} was discarded.`, "bad");
        state.legendarySwapPending = null;
        state.relicSwapPending = null;
        state.relicDraft = null;
        state.phase = "playing";
        syncBgmWithState();
        saveRunSnapshot();
        markUiDirty();
        return;
      }

      if (index === 1) {
        removeRelic(currentRelic.id, { silent: true });
        if (!applyRelic(incomingRelic.id)) {
          applyRelic(currentRelic.id, { onGain: false });
          pushLog("Legendary swap failed.", "bad");
          return;
        }
        pushLog(`Legendary swapped: ${currentRelic.name} -> ${incomingRelic.name}.`, "good");
        state.legendarySwapPending = null;
        state.relicSwapPending = null;
        state.relicDraft = null;
        state.phase = "playing";
        syncBgmWithState();
        saveRunSnapshot();
        markUiDirty();
        return;
      }

      pushLog("You can only have 1 legendary. Press 1 or 2.", "bad");
      return;
    }

    if (state.relicSwapPending) {
      const incomingRelic = getRelicById(state.relicSwapPending);
      if (!incomingRelic) {
        state.relicSwapPending = null;
        markUiDirty();
        return;
      }

      const outgoingRelicId = state.relics[index];
      if (!outgoingRelicId) {
        pushLog(`Choose relic to discard with keys ${getRelicDiscardHotkeyHint()}.`, "bad");
        return;
      }

      if (incomingRelic.rarity === "legendary" && hasLegendaryRelic(outgoingRelicId)) {
        pushLog("Only 1 legendary relic allowed. Discard your current legendary first.", "bad");
        return;
      }

      const outgoingRelic = getRelicById(outgoingRelicId);
      removeRelic(outgoingRelicId, { silent: true });
      if (!applyRelic(incomingRelic.id)) {
        applyRelic(outgoingRelicId, { onGain: false });
        pushLog("Relic swap failed.", "bad");
        return;
      }

      pushLog(
        `Relic swapped: ${outgoingRelic ? outgoingRelic.name : outgoingRelicId} -> ${incomingRelic.name}.`,
        "good"
      );
      state.relicSwapPending = null;
      state.relicDraft = null;
      state.phase = "playing";
      syncBgmWithState();
      saveRunSnapshot();
      markUiDirty();
      return;
    }

    const skipIndex = getRelicDraftSkipIndex();
    if (index === skipIndex) {
      state.legendarySwapPending = null;
      state.relicSwapPending = null;
      state.relicDraft = null;
      state.phase = "playing";
      syncBgmWithState();
      pushLog("Relic draft skipped. Current relics kept.");
      saveRunSnapshot();
      markUiDirty();
      return;
    }

    const relic = state.relicDraft?.[index];
    if (!relic) return;
    if (relic.rarity === "normal" && isNormalRelicStackAtCap(relic.id)) {
      pushLog(`${relic.name} stack is max (${MAX_NORMAL_RELIC_STACK}/${MAX_NORMAL_RELIC_STACK}). Choose another relic or skip.`, "bad");
      return;
    }
    const currentLegendaryId = state.relics.find((relicId) => isLegendaryRelic(relicId));
    if (relic.rarity === "legendary" && currentLegendaryId) {
      state.legendarySwapPending = {
        incomingRelicId: relic.id,
        currentRelicId: currentLegendaryId
      };
      state.relicSwapPending = null;
      pushLog("You can only have 1 legendary. Press 1 to keep current, 2 to take new.", "bad");
      saveRunSnapshot();
      markUiDirty();
      return;
    }
    if (state.relics.length >= MAX_RELICS) {
      state.relicSwapPending = relic.id;
      state.legendarySwapPending = null;
      const skipKey = getRelicDraftSkipHotkey();
      pushLog(
        `Relic inventory full (${MAX_RELICS}/${MAX_RELICS}). Choose one relic to discard (${getRelicDiscardHotkeyHint()}). Next time: use ${skipKey} to skip draft.`,
        "bad"
      );
      saveRunSnapshot();
      markUiDirty();
      return;
    }
    if (!applyRelic(relic.id)) {
      pushLog("Cannot take this relic.", "bad");
      return;
    }
    pushLog(`Relic acquired: ${relic.name}.`, "good");
    state.legendarySwapPending = null;
    state.relicSwapPending = null;
    state.relicDraft = null;
    state.phase = "playing";
    syncBgmWithState();
    saveRunSnapshot();
    markUiDirty();
  }

  function enterCampFromExtract() {
    state.extractConfirm = null;
    state.extractRelicPrompt = null;
    state.merchantMenuOpen = false;
    state.legendarySwapPending = null;
    state.relicSwapPending = null;
    state.campPanelView = "shop";
    state.campVisitShopCostMult = Number(state.runMods?.shopCostMult) || 1;
    recordRunOnLeaderboard("extract");
    const baseGold = Math.max(0, Math.round(state.player.gold));
    const bonusMult = state.runMods.campGoldBonus || 0;
    const bonusGold = Math.round(baseGold * bonusMult);
    const relicReturn = getRelicReturnSummary(state.relics);
    const gainedCampGold = baseGold + bonusGold;
    state.campGold += gainedCampGold;
    state.lastExtract = {
      depth: state.depth,
      gold: state.player.gold,
      campGold: gainedCampGold,
      relicReturned: 0,
      relicGold: 0
    };
    state.relicDraft = null;
    // Famine unlock: extract from depth 10+ without using potions
    if (state.depth >= 10 && (state.potionsUsedThisRun || 0) === 0) {
      state.potionFreeExtract = (state.potionFreeExtract || 0) + 1;
      localStorage.setItem(STORAGE_POTION_FREE_EXTRACT, String(state.potionFreeExtract));
    }
    state.phase = "camp";
    syncBgmWithState();
    saveMetaProgress();
    const unlockedNow = syncMutatorUnlocks();
    if (bonusGold > 0) {
      pushLog(`Extraction: +${baseGold} gold +${bonusGold} mutator bonus = ${gainedCampGold} camp gold.`, "good");
    } else {
      pushLog(`Extraction success: +${gainedCampGold} camp gold.`, "good");
    }
    if (relicReturn.count > 0) {
      state.extractRelicPrompt = {
        baseGold,
        bonusGold,
        relicReturn,
        carriedRelics: [...state.relics]
      };
      for (const mutator of unlockedNow) {
        pushLog(`Unlocked: [${mutator.key}] ${mutator.name}!`, "good");
      }
      pushLog(
        `Relics carried: ${relicReturn.count}. Exchange for +${relicReturn.total} camp gold? [Y] yes (sell) / [N] no (keep relics in camp).`,
        "warn"
      );
      saveRunSnapshot();
      markUiDirty();
      return;
    }
    state.relics = [];
    for (const mutator of unlockedNow) {
      pushLog(`Unlocked: [${mutator.key}] ${mutator.name}!`, "good");
    }
    pushLog("Camp shop: keys 1-0 buy upgrades. Press R for a new run.");
    saveRunSnapshot();
    markUiDirty();
  }

  function resolveExtractRelicPrompt(exchangeForGold) {
    const prompt = state.extractRelicPrompt;
    if (!prompt) return false;

    if (exchangeForGold) {
      const relicGain = Math.max(0, Number(prompt.relicReturn?.total) || 0);
      if (relicGain > 0) {
        state.campGold += relicGain;
        if (state.lastExtract) {
          state.lastExtract.campGold += relicGain;
          state.lastExtract.relicReturned = Math.max(0, Number(prompt.relicReturn?.count) || 0);
          state.lastExtract.relicGold = relicGain;
        }
      }
      state.relics = [];
      state.relicDraft = null;
      state.legendarySwapPending = null;
      state.relicSwapPending = null;
      state.extractRelicPrompt = null;
      pushLog(
        `Relics exchanged: +${relicGain} camp gold. Camp shop: keys 1-0 buy upgrades. Press R for a new run.`,
        "good"
      );
      saveMetaProgress();
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    const carriedRelics = Array.isArray(prompt.carriedRelics)
      ? prompt.carriedRelics.filter((id) => typeof id === "string")
      : [...state.relics];
    state.relics = carriedRelics;
    normalizeRelicInventory();
    state.relicDraft = null;
    state.legendarySwapPending = null;
    state.relicSwapPending = null;
    state.extractRelicPrompt = null;
    pushLog(
      `Relics kept (${state.relics.length}). You can shop now. Press R to start next run with kept relics.`,
      "good"
    );
    saveRunSnapshot();
    markUiDirty();
    return true;
  }

  function openEmergencyExtractConfirm() {
    if (state.phase !== "playing") return false;
    state.extractConfirm = {
      lossRatio: getEmergencyExtractLossRatio()
    };
    markUiDirty();
    return true;
  }

  function cancelEmergencyExtractConfirm() {
    if (!state.extractConfirm) return;
    state.extractConfirm = null;
    pushLog("Extraction canceled.");
    markUiDirty();
  }

  function confirmEmergencyExtract() {
    if (!state.extractConfirm) return false;
    const lossRatio = clamp(
      Number(state.extractConfirm.lossRatio) || getEmergencyExtractLossRatio(),
      0,
      0.95
    );
    const keepRatio = 1 - lossRatio;
    const currentGold = Math.max(0, state.player.gold);
    const keptGold = Math.max(0, Math.floor(currentGold * keepRatio));
    const lostGold = currentGold - keptGold;
    state.player.gold = keptGold;
    state.extractConfirm = null;
    pushLog(`Emergency extract: lost ${lostGold} gold, kept ${keptGold}.`, "bad");
    extractRun({ forced: true });
    return true;
  }

  function resetRunModifiers() {
    state.runMods.goldMultiplier = 1;
    state.runMods.extraEnemies = 0;
    state.runMods.chestHealPenalty = 0;
    state.runMods.enemyDamageBonus = 0;
    state.runMods.eliteChance = 0.12;
    state.runMods.enemyHpBonus = 0;
    state.runMods.shopCostMult = 1;
    state.runMods.eliteHpBonus = 0;
    state.runMods.eliteGoldMult = 1;
    state.runMods.extraSpikeMult = 1;
    state.runMods.enemyDoubleMoveChance = 0;
    state.runMods.noMerchants = false;
    state.runMods.potionHealMult = 1;
    state.runMods.enemyAtkPerDepth = 0;
    state.runMods.campGoldBonus = 0;
    state.runMods.extraRelicChoices = 0;
  }

  function applyCampUpgradesToRun() {
    state.player.maxHp += scaledCombat(getCampUpgradeLevel("vitality"));
    state.player.attack += scaledCombat(getCampUpgradeLevel("blade"));
    const satchelLevel = getCampUpgradeLevel("satchel");
    state.player.potions += satchelLevel;
    state.player.maxPotions += satchelLevel;
    state.player.armor += scaledCombat(getCampUpgradeLevel("guard"));
    state.player.crit += getCampUpgradeLevel("crit_chance") * 0.05;
  }

  function getPotionHealAmount() {
    const bonus = scaledCombat(getCampUpgradeLevel("potion_strength"));
    const base = randInt(scaledCombat(4) + bonus, scaledCombat(6) + bonus);
    let heal = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(base * state.runMods.potionHealMult));
    // Titan's Heart: +50% potion healing.
    if (hasRelic("titanheart")) {
      heal = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(heal * 1.5));
    }
    return heal;
  }

  function getTreasureSenseMultiplier() {
    return 1 + getCampUpgradeLevel("treasure_sense") * 0.1;
  }

  function getBountyContractMultiplier() {
    return 1 + getCampUpgradeLevel("bounty_contract") * 0.1;
  }

  function getEmergencyExtractLossRatio() {
    const reduction = getCampUpgradeLevel("emergency_stash") * 0.1;
    return clamp(0.7 - reduction, 0.05, 0.95);
  }

  function getSkillCooldownRemaining(skillId) {
    return Math.max(0, Number(state.skillCooldowns[skillId]) || 0);
  }

  function putSkillOnCooldown(skillId) {
    const skill = SKILL_BY_ID[skillId];
    if (!skill) return;
    // +1 offsets cooldown ticking in the same finalized turn.
    state.skillCooldowns[skillId] = skill.cooldown + 1;
  }

  function tickSkillCooldowns() {
    for (const skill of SKILLS) {
      const id = skill.id;
      if (state.skillCooldowns[id] > 0) {
        state.skillCooldowns[id] -= 1;
      }
    }
  }

  function tickBarrier() {
    if (state.player.barrierTurns <= 0) return;
    state.player.barrierTurns -= 1;
    if (state.player.barrierTurns <= 0) {
      state.player.barrierTurns = 0;
      state.player.barrierArmor = 0;
      pushLog("Shield fades.");
    }
  }

  function isShieldActive() {
    return state.player.barrierTurns > 0;
  }

  function isEpicShieldReflectActive() {
    return isShieldActive() && getSkillTier("shield") >= 2;
  }

  function blockDamageWithShield(sourceLabel, attacker = null, blockedDamage = 0) {
    if (!isShieldActive()) return false;
    spawnParticles(state.player.x, state.player.y, "#a9cfff", 8, 1.05);
    setShake(1.1);
    pushLog(`Shield blocks ${sourceLabel}.`, "good");

    // Epic Shield: reflect blocked damage back to the attacker.
    if (
      attacker &&
      state.phase === "playing" &&
      getSkillTier("shield") >= 2 &&
      state.enemies.includes(attacker)
    ) {
      const reflectDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(Math.max(MIN_EFFECTIVE_DAMAGE, blockedDamage) * 2));
      attacker.hp -= reflectDamage;
      spawnParticles(attacker.x, attacker.y, "#b7d8ff", 9, 1.1);
      pushLog(`Shield reflects ${reflectDamage} to ${attacker.name}.`, "good");
      if (attacker.hp <= 0) {
        killEnemy(attacker, "shield reflect");
      }
    }
    markUiDirty();
    return true;
  }

  function tryAutoPotion(triggerLabel = "low HP") {
    if (state.phase !== "playing") return false;
    if (getCampUpgradeLevel("auto_potion") < 1) return false;
    if (state.player.hp <= 0 || state.player.hp > AUTO_POTION_TRIGGER_HP) return false;
    if (state.player.autoPotionCooldown > 0) return false;
    if (state.player.potions <= 0) return false;

    state.player.potions -= 1;
    state.player.autoPotionCooldown = AUTO_POTION_INTERNAL_COOLDOWN_TURNS;
    state.potionsUsedThisRun = (state.potionsUsedThisRun || 0) + 1;
    const heal = getPotionHealAmount();
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    spawnParticles(state.player.x, state.player.y, "#8ce1a7", 12, 1.1);
    pushLog(
      `Auto Potion (${triggerLabel}): +${heal} HP (CD ${AUTO_POTION_INTERNAL_COOLDOWN_TURNS} turns).`,
      "good"
    );
    markUiDirty();
    return true;
  }

  function tickAutoPotionCooldown() {
    if (state.player.autoPotionCooldown > 0) {
      state.player.autoPotionCooldown -= 1;
    }
  }

  function tickFuryBlessing() {
    if (state.player.furyBlessingTurns > 0) {
      state.player.furyBlessingTurns -= 1;
      if (state.player.furyBlessingTurns <= 0) {
        state.player.furyBlessingTurns = 0;
        pushLog("Fury Blessing fades.", "bad");
      }
    }
  }

  function applyMutatorsToRun() {
    resetRunModifiers();
    let totalCampGoldBonus = 0;

    if (isMutatorActive("berserker")) {
      state.player.attack += scaledCombat(3);
      state.player.maxHp -= scaledCombat(5);
      totalCampGoldBonus += 0.15;
    }
    if (isMutatorActive("bulwark")) {
      state.player.armor += scaledCombat(3);
      state.player.attack -= scaledCombat(2);
      totalCampGoldBonus += 0.15;
    }
    if (isMutatorActive("alchemist")) {
      state.player.potions += 3;
      state.player.maxPotions += 3;
      state.runMods.chestHealPenalty = 999; // chests don't heal
      totalCampGoldBonus += 0.10;
    }
    if (isMutatorActive("greed")) {
      state.runMods.goldMultiplier += 0.4;
      state.runMods.extraEnemies += 2;
      state.runMods.enemyHpBonus += scaledCombat(2);
      state.runMods.shopCostMult *= 1.2;
      totalCampGoldBonus += 0.05;
    }
    if (isMutatorActive("hunter")) {
      state.player.crit += 0.15;
      state.runMods.enemyDamageBonus += scaledCombat(2);
      totalCampGoldBonus += 0.15;
    }
    if (isMutatorActive("glassdepths")) {
      state.runMods.extraSpikeMult = 1.5;
      totalCampGoldBonus += 0.20;
    }
    if (isMutatorActive("haste")) {
      state.runMods.enemyDoubleMoveChance = 0.15;
      totalCampGoldBonus += 0.20;
    }
    if (isMutatorActive("famine")) {
      state.player.maxHp += scaledCombat(2);
      state.runMods.noMerchants = true;
      state.runMods.potionHealMult = 0.5;
      totalCampGoldBonus += 0.25;
    }
    if (isMutatorActive("elitist")) {
      state.runMods.eliteChance += 0.30;
      state.runMods.eliteHpBonus = scaledCombat(2); // elites specifically get +20 HP
      state.runMods.eliteGoldMult = 1.5;
      totalCampGoldBonus += 0.20;
    }
    if (isMutatorActive("ascension")) {
      state.runMods.extraRelicChoices += 1;
      state.runMods.enemyAtkPerDepth = scaledCombat(1); // +10 ATK per 3 depths
      totalCampGoldBonus += 0.30;
    }

    state.runMods.campGoldBonus = totalCampGoldBonus;

    state.player.maxHp = clamp(state.player.maxHp, scaledCombat(4), scaledCombat(40));
    state.player.attack = clamp(state.player.attack, scaledCombat(1), scaledCombat(20));
    state.player.armor = clamp(state.player.armor, 0, scaledCombat(10));
    state.player.crit = clamp(state.player.crit, 0.01, CRIT_CHANCE_CAP);
  }

  function grantGold(amount, options = {}) {
    const rawAmount = Math.max(0, Number(amount) || 0);
    if (rawAmount <= 0) return 0;
    const applyMultiplier = options.applyMultiplier !== false;
    const scaled = applyMultiplier
      ? Math.max(1, Math.round(rawAmount * state.runMods.goldMultiplier))
      : Math.max(1, Math.round(rawAmount));
    state.player.gold += scaled;
    state.runGoldEarned += scaled;
    state.totalGoldEarned += scaled;
    localStorage.setItem(STORAGE_TOTAL_GOLD, String(state.totalGoldEarned));
    return scaled;
  }

  function grantPotion(count = 1) {
    const before = state.player.potions;
    state.player.potions = Math.min(state.player.maxPotions, state.player.potions + count);
    return state.player.potions - before;
  }

  function randomFreeTile(occupied) {
    let x;
    let y;
    do {
      x = randInt(1, GRID_SIZE - 2);
      y = randInt(1, GRID_SIZE - 2);
    } while (occupied.has(tileKey(x, y)));
    occupied.add(tileKey(x, y));
    return { x, y };
  }

  function buildDirectPath(fromX, fromY, toX, toY, horizontalFirst) {
    const path = [];
    let x = fromX;
    let y = fromY;
    while (x !== toX || y !== toY) {
      if (horizontalFirst && x !== toX) {
        x += sign(toX - x);
      } else if (!horizontalFirst && y !== toY) {
        y += sign(toY - y);
      } else if (x !== toX) {
        x += sign(toX - x);
      } else {
        y += sign(toY - y);
      }
      path.push({ x, y });
    }
    return path;
  }

  function countSpikesOnPath(path, spikeSet) {
    let count = 0;
    for (const tile of path) {
      if (spikeSet.has(tileKey(tile.x, tile.y))) {
        count += 1;
      }
    }
    return count;
  }

  function rollChestCountWithChance(baseCount, keepChance) {
    let total = 0;
    for (let i = 0; i < baseCount; i += 1) {
      if (chance(keepChance)) {
        total += 1;
      }
    }
    return total;
  }

  function carveSafeSpikePathToPortal() {
    if (!state.portal || state.spikes.length === 0) return;

    const spikeSet = new Set(state.spikes.map((spike) => tileKey(spike.x, spike.y)));
    const horizontalPath = buildDirectPath(
      state.player.x,
      state.player.y,
      state.portal.x,
      state.portal.y,
      true
    );
    const verticalPath = buildDirectPath(
      state.player.x,
      state.player.y,
      state.portal.x,
      state.portal.y,
      false
    );
    const horizontalHits = countSpikesOnPath(horizontalPath, spikeSet);
    const verticalHits = countSpikesOnPath(verticalPath, spikeSet);
    const bestPath = horizontalHits <= verticalHits ? horizontalPath : verticalPath;
    const safeTiles = new Set(bestPath.map((tile) => tileKey(tile.x, tile.y)));

    if (safeTiles.size === 0) return;
    state.spikes = state.spikes.filter((spike) => !safeTiles.has(tileKey(spike.x, spike.y)));
  }

  function makeFloorPattern() {
    const pattern = [];
    for (let y = 0; y < GRID_SIZE; y += 1) {
      const row = [];
      for (let x = 0; x < GRID_SIZE; x += 1) {
        row.push(randInt(0, 9));
      }
      pattern.push(row);
    }

    const bonfireTiles = [];
    const skullTiles = [];
    const crossTiles = [];
    const floorVar3Tiles = [];
    for (let y = 1; y <= GRID_SIZE - 2; y += 1) {
      for (let x = 1; x <= GRID_SIZE - 2; x += 1) {
        const tileId = getFloorTilesetId(pattern[y][x]);
        if (tileId === TILESET_IDS.floorBonfire) {
          bonfireTiles.push({ x, y });
        } else if (tileId === TILESET_IDS.floorSkull) {
          skullTiles.push({ x, y });
        } else if (tileId === TILESET_IDS.floorCrackCross) {
          crossTiles.push({ x, y });
        } else if (tileId === TILESET_IDS.floorVar3) {
          floorVar3Tiles.push({ x, y });
        }
      }
    }

    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = randInt(0, i);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    };
    // Replacements intentionally avoid limited buckets: bonfire/skull/crack-cross/floorVar3.
    const replacementNoise = [0, 1, 6, 8, 9];
    const replaceTile = (tile) => {
      pattern[tile.y][tile.x] = replacementNoise[randInt(0, replacementNoise.length - 1)];
    };
    const isAdjacent = (a, b) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
    const enforceLimit = (arr, maxCount, disallowAdjacent = false) => {
      if (arr.length <= 0) return;
      shuffle(arr);
      const kept = [];
      for (const tile of arr) {
        if (kept.length >= maxCount) {
          replaceTile(tile);
          continue;
        }
        if (disallowAdjacent && kept.some((other) => isAdjacent(other, tile))) {
          replaceTile(tile);
          continue;
        }
        kept.push(tile);
      }
    };

    enforceLimit(bonfireTiles, MAX_FLOOR_BONFIRE_PER_MAP, true);
    enforceLimit(skullTiles, randInt(MIN_FLOOR_SKULL_PER_MAP, MAX_FLOOR_SKULL_PER_MAP), true);
    enforceLimit(crossTiles, MAX_FLOOR_CRACK_CROSS_PER_MAP);
    enforceLimit(floorVar3Tiles, MAX_FLOOR_VAR3_PER_MAP);

    return pattern;
  }

  function isBossDepth() {
    return state.depth > 0 && state.depth % 5 === 0;
  }

  function getRoomsUntilBoss() {
    if (state.depth <= 0) return 5;
    if (state.depth % 5 === 0) return state.bossRoom ? 0 : 5;
    return 5 - (state.depth % 5);
  }

  function setupRoomIntroSplash() {
    state.roomIntroDuration = state.bossRoom ? 920 : 760;
    state.roomIntroTimer = state.roomIntroDuration;
    state.roomIntroTitle = `DEPTH ${state.depth}`;
    if (state.depth === 0) {
      state.roomIntroSubtitle = "STARTING CHAMBER";
      return;
    }
    if (state.bossRoom) {
      state.roomIntroSubtitle = "BOSS CHAMBER";
      return;
    }
    const roomLabel = (ROOM_TYPE_LABELS[state.roomType] || "Room").toUpperCase();
    state.roomIntroSubtitle = `${roomLabel} ROOM`;
  }

  function rollEnemyType() {
    const roll = Math.random();
    if (state.depth < 5) return "slime";
    if (state.depth <= 10) return roll < 0.72 ? "slime" : "skeleton";
    if (roll < 0.43) return "slime";
    if (roll < 0.77) return "skeleton";
    return "brute";
  }

  function createEnemy(type, x, y, options = {}) {
    const depthScale = Math.floor(state.depth / 2);
    const damageBonus = state.runMods.enemyDamageBonus;
    let enemy;
    if (type === "skeleton") {
      enemy = {
        type,
        name: "Skeleton",
        x,
        y,
        hp: scaledCombat(4 + depthScale),
        attack: scaledCombat(1 + Math.floor(state.depth / 4)) + damageBonus,
        range: 3,
        cooldown: 0,
        aiming: false
      };
    } else if (type === "brute") {
      enemy = {
        type,
        name: "Brute",
        x,
        y,
        hp: scaledCombat(7 + state.depth),
        attack: scaledCombat(3 + Math.floor(state.depth / 3)) + damageBonus,
        rests: false
      };
    } else if (type === "warden") {
      enemy = {
        type,
        name: "Warden",
        x,
        y,
        hp: scaledCombat(16 + state.depth * 2),
        attack: scaledCombat(4 + Math.floor(state.depth / 3)) + damageBonus,
        range: 4,
        cooldown: 0
      };
    } else {
      enemy = {
        type: "slime",
        name: "Slime",
        x,
        y,
        hp: scaledCombat(3 + depthScale),
        attack: scaledCombat(1 + Math.floor(state.depth / 5)) + damageBonus
      };
    }

    // Mutator: enemy HP bonus (scaled for x10 combat values).
    enemy.hp += state.runMods.enemyHpBonus;
    // Ascension: enemy ATK scales +10 per 3 depths.
    if (state.runMods.enemyAtkPerDepth > 0) {
      enemy.attack += Math.floor(state.depth / 3) * state.runMods.enemyAtkPerDepth;
    }

    const lateScale = getEnemyLateDepthMultiplier(state.depth);
    if (lateScale > 1) {
      enemy.hp = Math.round(enemy.hp * lateScale);
      enemy.attack = Math.round(enemy.attack * lateScale);
    }

    enemy.elite = false;
    enemy.affix = null;
    enemy.rewardBonus = 0;
    enemy.maxHp = enemy.hp;
    enemy.castFlash = 0;
    enemy.frozenThisTurn = false;
    enemy.frostFx = 0;
    enemy.facing = "south";
    snapVisual(enemy);

    if (options.elite && enemy.type !== "warden" && state.depth >= 6) {
      enemy.elite = true;
      enemy.rewardBonus += 3;
      enemy.hp = Math.round(enemy.hp * 1.4) + (state.runMods.eliteHpBonus || 0);
      enemy.attack += scaledCombat(1);
      enemy.affix = pickEliteAffix();

      if (enemy.affix === "tank") {
        enemy.hp = Math.round(enemy.hp * 1.3);
      } else if (enemy.affix === "fast") {
        enemy.attack += scaledCombat(1);
      } else if (enemy.affix === "vampiric") {
        enemy.vampiric = true;
      }
      enemy.maxHp = enemy.hp;
      enemy.name = `Elite ${enemy.name}`;
    }

    return enemy;
  }

  function buildRegularRoom(occupied) {
    const baseEnemyCount = Math.min(
      8,
      2 + Math.floor(state.depth / 2) + randInt(0, 2) + state.runMods.extraEnemies
    );
    const baseChestCount = randInt(1, 2);
    const baseSpikeCount = randInt(0, Math.min(3, 1 + Math.floor(state.depth / 3)));
    let enemyCount = baseEnemyCount;
    let chestCount = baseChestCount;
    let spikeCount = baseSpikeCount;

    state.roomType = chooseRoomType();
    if (state.roomType === "merchant") {
      enemyCount = 0;
      chestCount = 0;
      spikeCount = 0;
      const merchantSpot = randomFreeTile(occupied);
      state.merchant = { x: merchantSpot.x, y: merchantSpot.y };
      state.roomCleared = true;
      pushLog(`Merchant room ${state.depth + 1}: stand on trader and press E to open shop.`, "good");
      return;
    }
    if (state.roomType === "treasure") {
      enemyCount = Math.max(1, baseEnemyCount - 2);
      chestCount = 3;
      spikeCount = randInt(0, 1);
    } else if (state.roomType === "shrine") {
      enemyCount = Math.max(2, baseEnemyCount - 1);
      chestCount = 1;
      spikeCount = 0;
    } else if (state.roomType === "cursed") {
      enemyCount = Math.min(10, baseEnemyCount + 2);
      chestCount = randInt(0, 1);
      spikeCount = Math.min(5, baseSpikeCount + 2);
    }
    if (state.roomType !== "treasure") {
      chestCount = rollChestCountWithChance(chestCount, NON_TREASURE_CHEST_CHANCE);
    }

    // +500% spikes (x6) with hard cap (60% of room) and reserved space for player/portal.
    const shrineSlots = state.roomType === "shrine" ? 1 : 0;
    const reservedTiles = 2 + enemyCount + chestCount + shrineSlots;
    const maxSpikesByRoom = Math.max(
      0,
      Math.min(MAX_SPIKES_PER_ROOM, ROOM_INNER_TILES - reservedTiles)
    );
    spikeCount = clamp(Math.round(spikeCount * SPIKE_MULTIPLIER * state.runMods.extraSpikeMult), 0, maxSpikesByRoom);

    const elitesEnabled = state.depth >= 6;
    let eliteChance = state.runMods.eliteChance + state.depth * 0.01;
    if (state.roomType === "treasure") eliteChance -= 0.06;
    if (state.roomType === "shrine") eliteChance += 0.03;
    if (state.roomType === "cursed") eliteChance += 0.22;
    eliteChance = clamp(eliteChance, 0.02, 0.75);

    for (let i = 0; i < enemyCount; i += 1) {
      const spot = randomFreeTile(occupied);
      const elite = elitesEnabled && chance(eliteChance);
      state.enemies.push(createEnemy(rollEnemyType(), spot.x, spot.y, { elite }));
    }
    for (let i = 0; i < chestCount; i += 1) {
      const spot = randomFreeTile(occupied);
      state.chests.push({ x: spot.x, y: spot.y, opened: false });
    }
    for (let i = 0; i < spikeCount; i += 1) {
      const spot = randomFreeTile(occupied);
      state.spikes.push({ x: spot.x, y: spot.y });
    }

    if (state.roomType === "shrine") {
      const shrineSpot = randomFreeTile(occupied);
      state.shrine = { x: shrineSpot.x, y: shrineSpot.y, used: false };
    }

    pushLog(
      `${ROOM_TYPE_LABELS[state.roomType]} room ${state.depth + 1}: ${enemyCount} enemies, ${chestCount} chests, ${spikeCount} spikes.`
    );
  }

  function buildBossRoom(occupied) {
    state.roomType = "boss";
    const bossSpot = randomFreeTile(occupied);
    state.enemies.push(createEnemy("warden", bossSpot.x, bossSpot.y));

    const addCount = Math.min(3, 1 + Math.floor(state.depth / 5));
    const chestCount = rollChestCountWithChance(2, NON_TREASURE_CHEST_CHANCE);
    // +500% spikes (x6) with hard cap (60% of room) and reserved space for player/portal.
    const reservedTiles = 2 + (1 + addCount) + chestCount;
    const maxSpikesByRoom = Math.max(
      0,
      Math.min(MAX_SPIKES_PER_ROOM, ROOM_INNER_TILES - reservedTiles)
    );
    const spikeCount = clamp(Math.round(1 * SPIKE_MULTIPLIER), 0, maxSpikesByRoom);
    for (let i = 0; i < addCount; i += 1) {
      const spot = randomFreeTile(occupied);
      const type = rollEnemyType();
      state.enemies.push(createEnemy(type, spot.x, spot.y, { elite: state.depth >= 6 && chance(0.3) }));
    }
    for (let i = 0; i < chestCount; i += 1) {
      const spot = randomFreeTile(occupied);
      state.chests.push({ x: spot.x, y: spot.y, opened: false });
    }
    for (let i = 0; i < spikeCount; i += 1) {
      const spot = randomFreeTile(occupied);
      state.spikes.push({ x: spot.x, y: spot.y });
    }
    pushLog(`Depth ${state.depth}: Warden chamber. Kill the mini-boss.`, "bad");
  }

  function buildRoom() {
    state.roomIndex += 1;
    state.roomCleared = false;
    state.extractConfirm = null;
    state.merchantMenuOpen = false;
    state.merchantUpgradeBoughtThisRoom = false;
    state.dashAimActive = false;
    state.bossRoom = isBossDepth();
    state.shrine = null;
    state.merchant = null;
    state.roomType = state.bossRoom ? "boss" : "combat";
    state.floorPattern = makeFloorPattern();
    state.player.x = 4;
    state.player.y = 4;
    snapVisual(state.player);
    state.player.adrenaline = hasRelic("adrenal") ? 2 : 0;

    const occupied = new Set([tileKey(state.player.x, state.player.y)]);
    state.enemies = [];
    state.chests = [];
    state.spikes = [];
    state.rangedBolts = [];
    state.rangedImpacts = [];
    state.shockwaveRings = [];
    state.dashTrails = [];

    if (state.bossRoom) {
      buildBossRoom(occupied);
    } else {
      buildRegularRoom(occupied);
    }

    state.portal = randomFreeTile(occupied);
    carveSafeSpikePathToPortal();
    setupRoomIntroSplash();
    if (state.bossRoom) {
      playSfx("bosswarn");
    }
    syncBgmWithState();
    markUiDirty();
  }

  function startRun(options = {}) {
    const carriedRelics = Array.isArray(options.carriedRelics)
      ? options.carriedRelics.filter((id) => typeof id === "string")
      : [];
    const carryRelics = carriedRelics.length > 0;
    stopSplashTrack(true);
    state.phase = "playing";
    state.depth = 0;
    if (!state.currentRunId) {
      state.currentRunId = makeRunId();
      state.runMaxDepth = 0;
      state.runGoldEarned = 0;
    }
    state.turn = 0;
    state.roomIndex = 0;
    state.bossRoom = false;
    state.roomType = "combat";
    state.shake = 0;
    state.flash = 0;
    state.particles = [];
    state.rangedBolts = [];
    state.rangedImpacts = [];
    state.shockwaveRings = [];
    state.dashTrails = [];
    state.log = [];
    state.extractConfirm = null;
    state.extractRelicPrompt = null;
    state.finalGameOverPrompt = null;
    state.campVisitShopCostMult = 1;
    state.runLeaderboardSubmitted = false;
    state.leaderboardModalOpen = false;
    state.nameModalOpen = false;
    state.nameModalAction = null;
    state.merchantMenuOpen = false;
    state.merchantUpgradeBoughtThisRoom = false;
    state.dashAimActive = false;
    state.relicDraft = null;
    state.legendarySwapPending = null;
    state.relicSwapPending = null;
    state.relics = [];
    state.shrine = null;
    state.merchant = null;

    state.merchantPotionsBought = 0;
    state.potionsUsedThisRun = 0;
    state.player.hp = scaledCombat(BASE_PLAYER_HP);
    state.player.maxHp = scaledCombat(BASE_PLAYER_HP);
    state.player.attack = scaledCombat(BASE_PLAYER_ATTACK);
    state.player.armor = scaledCombat(BASE_PLAYER_ARMOR);
    state.player.potions = 1;
    state.player.maxPotions = 5;
    state.player.gold = 0;
    state.player.adrenaline = 0;
    state.player.maxAdrenaline = 3;
    state.player.crit = 0.1;
    state.player.lastMoveX = 0;
    state.player.lastMoveY = -1;
    state.player.barrierArmor = 0;
    state.player.barrierTurns = 0;
    state.player.soulHarvestCount = 0;
    state.player.soulHarvestGained = 0;
    state.player.chronoUsedThisRun = false;
    state.player.phaseCooldown = 0;
    state.player.titanAttackPenalty = 0;
    state.player.chaosAtkBonus = 0;
    state.player.chaosAtkTurns = 0;
    state.player.chaosKillHeal = 0;
    state.player.chaosRollCounter = 0;
    state.player.autoPotionCooldown = 0;
    state.player.furyBlessingTurns = 0;
    state.skillCooldowns = sanitizeSkillCooldowns({});
    stopDeathTrack(true);

    applyCampUpgradesToRun();
    applyMutatorsToRun();
    if (carryRelics) {
      for (const relicId of carriedRelics) {
        applyRelic(relicId);
      }
      normalizeRelicInventory();
    }
    state.player.hp = state.player.maxHp;

    buildRoom();
    syncBgmWithState(true);
    if (carryRelics) {
      pushLog(`New run started with ${state.relics.length} carried relics.`);
    } else {
      pushLog("New run started.");
    }
    if (activeMutatorCount() > 0) {
      pushLog(`Active mutators: ${activeMutatorCount()}.`);
    }
    saveRunSnapshot();
    markUiDirty();
  }

  function gameOver(reason) {
    if (state.phase !== "playing") return;
    if (state.player.hp <= 0 && tryTriggerChronoLoop("fatal blow")) {
      return;
    }
    if (state.player.hp <= 0 && hasRelic("chronoloop") && state.player.chronoUsedThisRun) {
      pushLog("Chrono Loop was already spent this run.", "bad");
    }
    recordRunOnLeaderboard("death");
    state.phase = "dead";
    state.extractConfirm = null;
    state.merchantMenuOpen = false;
    syncBgmWithState();
    const usedSample = playDeathTrack();
    if (!usedSample && !state.audioMuted) {
      playSfx("death");
    }
    pushLog(reason, "bad");
    state.lives = Math.max(0, state.lives - 1);
    pushLog(`Life lost. ${state.lives}/${MAX_LIVES} remaining.`, "bad");

    if (state.lives <= 0) {
      const finalDepth = getRunMaxDepth();
      const finalGold = getRunGoldEarned();
      const finalScore = calculateScore(finalDepth, finalGold);
      pushLog("All lives lost. Fresh start triggered.", "bad");
      resetMetaProgressForFreshStart();
      state.finalGameOverPrompt = {
        depth: finalDepth,
        gold: finalGold,
        score: finalScore
      };
      pushLog(`Progress reset. Lives restored to ${MAX_LIVES}.`, "good");
      pushLog("GAME OVER. Choose Main Menu or Leaderboard.", "bad");
      clearRunSnapshot();
      return;
    }

    state.deaths += 1;
    saveMetaProgress();

    const unlockedNow = syncMutatorUnlocks();
    if (unlockedNow.length > 0) {
      for (const mutator of unlockedNow) {
        pushLog(`Unlocked: [${mutator.key}] ${mutator.name}.`, "good");
      }
    }
    pushLog("Press 1-0 to toggle mutators, R to start a new run.");
    clearRunSnapshot();
  }

  function extractRun(options = {}) {
    if (state.phase !== "playing") return;
    const forced = Boolean(options.forced);
    if (!forced && !isOnPortal()) return;
    if (!forced && !state.roomCleared) {
      pushLog("Clear the room before extracting.", "bad");
      return;
    }
    state.merchantMenuOpen = false;
    playSfx("portal");
    enterCampFromExtract();
  }

  function getEnemyAt(x, y) {
    return state.enemies.find((enemy) => enemy.x === x && enemy.y === y);
  }

  function getChestAt(x, y) {
    return state.chests.find((chest) => chest.x === x && chest.y === y && !chest.opened);
  }

  function isSpikeAt(x, y) {
    return state.spikes.some((spike) => spike.x === x && spike.y === y);
  }

  function isOnPortal() {
    return state.player.x === state.portal.x && state.player.y === state.portal.y;
  }

  function isOnShrine() {
    return Boolean(
      state.shrine &&
        !state.shrine.used &&
        state.player.x === state.shrine.x &&
        state.player.y === state.shrine.y
    );
  }

  function isOnMerchant() {
    return Boolean(
      state.merchant &&
        state.player.x === state.merchant.x &&
        state.player.y === state.merchant.y
    );
  }

  function activateShrine() {
    if (!isOnShrine()) return;
    state.shrine.used = true;
    const blessing = hasRelic("shrineward") ? true : chance(0.85);
    if (blessing) {
      if (chance(SHRINE_FURY_BLESSING_CHANCE)) {
        const duration = randInt(100, 200);
        state.player.adrenaline = Math.min(state.player.maxAdrenaline, state.player.adrenaline + 2);
        state.player.furyBlessingTurns = Math.max(state.player.furyBlessingTurns || 0, duration);
        pushLog(
          `Shrine blessing: Fury +2 now, Fury Blessing active for ${state.player.furyBlessingTurns} turns.`,
          "good"
        );
      } else {
        const roll = randInt(1, 4);
        if (roll === 1) {
          state.player.maxHp += scaledCombat(1);
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + scaledCombat(2));
          pushLog("Shrine blessing: +10 max HP and heal 20.", "good");
        } else if (roll === 2) {
          state.player.attack += scaledCombat(1);
          pushLog("Shrine blessing: +10 ATK.", "good");
        } else if (roll === 3) {
          state.player.armor += scaledCombat(1);
          pushLog("Shrine blessing: +10 ARM.", "good");
        } else {
          grantPotion(1);
          pushLog("Shrine blessing: +1 potion.", "good");
        }
      }
    } else {
      if (blockDamageWithShield("shrine curse")) {
        pushLog("Shrine curse negated.", "good");
      } else if (isDebugGodModeActive()) {
        pushLog("Shrine curse ignored (God Mode).", "warn");
      } else {
        state.player.hp -= scaledCombat(2);
        pushLog("Shrine curse: -20 HP.", "bad");
        tryAutoPotion("shrine curse");
        if (state.player.hp <= 0) {
          if (tryTriggerChronoLoop("shrine curse")) {
            return;
          }
          gameOver(`A shrine curse ended your run at depth ${state.depth}.`);
        }
      }
    }
    spawnParticles(state.player.x, state.player.y, "#c9abff", 12, 1.25);
    setShake(1.4);
    markUiDirty();
  }

  function spawnParticles(tileX, tileY, color, count, spread = 1.1) {
    const centerX = tileX * TILE + TILE / 2;
    const centerY = tileY * TILE + TILE / 2;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * spread + 0.15;
      state.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.07,
        life: randInt(120, 240),
        maxLife: 240,
        size: randInt(1, 2),
        color
      });
    }
  }

  function spawnRangedBolt(fromTileX, fromTileY, toTileX, toTileY, color) {
    state.rangedBolts.push({
      fromX: fromTileX * TILE + TILE / 2,
      fromY: fromTileY * TILE + TILE / 2,
      toX: toTileX * TILE + TILE / 2,
      toY: toTileY * TILE + TILE / 2,
      color,
      progress: 0,
      speed: 0.012,
      life: 220,
      maxLife: 220
    });
  }

  function spawnRangedImpact(tileX, tileY, color) {
    state.rangedImpacts.push({
      x: tileX * TILE + TILE / 2,
      y: tileY * TILE + TILE / 2,
      color,
      radius: 2,
      life: 120,
      maxLife: 120
    });
  }

  function spawnShockwaveRing(tileX, tileY, options = {}) {
    const color = options.color || "#f2cb92";
    const core = options.core || "#fff0cf";
    const maxRadius = Number(options.maxRadius) || TILE * 2.4;
    const maxLife = Number(options.life) || 340;
    state.shockwaveRings.push({
      x: tileX * TILE + TILE / 2,
      y: tileY * TILE + TILE / 2,
      radius: 2,
      maxRadius,
      life: maxLife,
      maxLife,
      color,
      core
    });
  }

  function spawnDashTrail(fromTileX, fromTileY, toTileX, toTileY) {
    state.dashTrails.push({
      fromX: fromTileX * TILE + TILE / 2,
      fromY: fromTileY * TILE + TILE / 2,
      toX: toTileX * TILE + TILE / 2,
      toY: toTileY * TILE + TILE / 2,
      life: 180,
      maxLife: 180,
      color: "#9fdcff"
    });
  }

  function revealPortalFx() {
    if (!state.portal) return;
    spawnParticles(state.portal.x, state.portal.y, COLORS.portalCore, 16, 1.4);
    spawnShockwaveRing(state.portal.x, state.portal.y, {
      color: COLORS.portalGlow,
      core: COLORS.portalCore,
      maxRadius: TILE * 2.6,
      life: 320
    });
    playSfx("portal");
  }

  function setShake(amount) {
    state.shake = Math.max(state.shake, amount);
  }

  function removeEnemy(enemy) {
    state.enemies = state.enemies.filter((item) => item !== enemy);
  }

  function rewardForEnemy(enemy) {
    let base = 2;
    if (enemy.type === "warden") base = 35;
    else if (enemy.type === "brute") base = 4;
    else if (enemy.type === "skeleton") base = 3;
    const eliteMult = enemy.elite ? (state.runMods.eliteGoldMult || 1) : 1;
    const boosted = (base + (enemy.rewardBonus || 0)) * getBountyContractMultiplier() * eliteMult;
    return Math.max(1, Math.round(boosted));
  }

  function killEnemy(enemy, reason) {
    removeEnemy(enemy);
    const reward = grantGold(rewardForEnemy(enemy));
    state.player.adrenaline = clamp(state.player.adrenaline + 1, 0, state.player.maxAdrenaline);
    state.totalKills += 1;
    localStorage.setItem(STORAGE_TOTAL_KILLS, String(state.totalKills));
    if (enemy.elite) {
      state.eliteKills += 1;
      localStorage.setItem(STORAGE_ELITE_KILLS, String(state.eliteKills));
    }
    spawnParticles(enemy.x, enemy.y, "#ffd57a", 8, 1.45);
    pushLog(`${enemy.name} down. +${reward} gold. ${reason ? `(${reason})` : ""}`, "good");

    if (hasRelic("chaosorb") && (state.player.chaosKillHeal || 0) > 0) {
      const healAmount = Math.max(MIN_EFFECTIVE_DAMAGE, state.player.chaosKillHeal);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmount);
      spawnParticles(state.player.x, state.player.y, "#8ce1a7", 6, 0.95);
      pushLog(`Chaos: kill heal +${healAmount} HP.`, "good");
    }

    // Vampiric Fang: heal 10 HP every 3 kills
    if (hasRelic("vampfang")) {
      state.player.vampFangKills = (state.player.vampFangKills || 0) + 1;
      if (state.player.vampFangKills % 3 === 0) {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + scaledCombat(1));
        spawnParticles(enemy.x, enemy.y, "#ff5555", 6, 1.0);
        pushLog("Vampiric Fang: +10 HP.", "good");
      }
    }

    // Soul Harvest: +10 max HP every 10 kills (cap +100)
    if (hasRelic("soulharvest") && (state.player.soulHarvestGained || 0) < 10) {
      state.player.soulHarvestCount = (state.player.soulHarvestCount || 0) + 1;
      if (state.player.soulHarvestCount % 10 === 0) {
        state.player.soulHarvestGained = (state.player.soulHarvestGained || 0) + 1;
        state.player.maxHp += scaledCombat(1);
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + scaledCombat(1));
        spawnParticles(enemy.x, enemy.y, "#b44dff", 8, 1.2);
        pushLog(`Soul Harvest: +10 max HP (${state.player.soulHarvestGained * 10}/100).`, "good");
      }
    }

    markUiDirty();
  }

  function checkRoomClearBonus() {
    if (state.roomCleared || state.enemies.length > 0) return;
    state.roomCleared = true;
    revealPortalFx();
    pushLog("Room cleared! Portal revealed.", "good");
    let goldBonus = 2 + Math.floor(state.depth / 2);
    let potionChance = 0.35;

    if (!state.bossRoom) {
      if (state.roomType === "treasure") {
        goldBonus = Math.max(1, goldBonus - 1);
        potionChance = 0.22;
      } else if (state.roomType === "shrine") {
        goldBonus += 1;
        potionChance = 0.45;
      } else if (state.roomType === "cursed") {
        goldBonus += 4;
        potionChance = 0.15;
      }
    }

    if (state.bossRoom) {
      goldBonus += 10;
      pushLog("Mini-boss defeated. Boss relic drop!", "good");
      openRelicDraft(true);
      if (chance(0.01)) {
        grantLife("Boss drop");
      }
    }
    const scaled = grantGold(goldBonus);
    if (chance(potionChance)) {
      grantPotion(1);
      pushLog(`Room clear bonus: +${scaled} gold and +1 potion.`, "good");
    } else {
      pushLog(`Room clear bonus: +${scaled} gold.`, "good");
    }
    markUiDirty();
  }

  function tryTriggerChronoLoop(sourceLabel = "fatal damage") {
    if (state.phase !== "playing") return false;
    if (!hasRelic("chronoloop") || state.player.chronoUsedThisRun) return false;

    state.player.chronoUsedThisRun = true;
    state.player.hp = Math.max(1, Math.floor(state.player.maxHp * 0.5));

    const killCount = state.enemies.length;
    for (const enemy of [...state.enemies]) {
      spawnParticles(enemy.x, enemy.y, "#ffb020", 12, 1.6);
    }
    state.enemies = [];

    state.flash = 240;
    setShake(5.2);
    playSfx("chrono");
    spawnParticles(state.player.x, state.player.y, "#ffb020", 24, 2.1);
    spawnParticles(state.player.x, state.player.y, "#c78cff", 16, 1.6);
    spawnShockwaveRing(state.player.x, state.player.y, {
      color: "#ffb53e",
      core: "#fff1ce",
      maxRadius: TILE * 3.5,
      life: 480
    });
    spawnShockwaveRing(state.player.x, state.player.y, {
      color: "#bd88ff",
      core: "#efd9ff",
      maxRadius: TILE * 4.8,
      life: 620
    });
    spawnRangedImpact(state.player.x, state.player.y, "#ffb020");
    spawnRangedImpact(state.player.x, state.player.y, "#bd88ff");
    pushLog(
      `CHRONO LOOP! Revived with ${state.player.hp} HP. ${killCount} enemies erased after ${sourceLabel}.`,
      "good"
    );
    pushLog("Chrono Loop triggered: resurrection charge spent.", "warn");
    checkRoomClearBonus();
    markUiDirty();
    return true;
  }

  function applyDamageToPlayer(rawDamage, source, attacker = null) {
    if (isDebugGodModeActive()) {
      return;
    }
    if (blockDamageWithShield(source, attacker, rawDamage)) {
      return;
    }
    // Phase Cloak: auto-dodge every 5th turn
    if (hasRelic("phasecloak") && state.player.phaseCooldown <= 0) {
      state.player.phaseCooldown = 5;
      spawnParticles(state.player.x, state.player.y, "#c9abff", 10, 1.3);
      pushLog(`Phase Cloak dodges ${source}!`, "good");
      markUiDirty();
      return;
    }
    const incomingDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(rawDamage));
    const minDamageFromCap = Math.max(
      MIN_EFFECTIVE_DAMAGE,
      Math.ceil(incomingDamage * (1 - ARMOR_DAMAGE_REDUCTION_CAP))
    );
    const reducedByArmor = Math.max(MIN_EFFECTIVE_DAMAGE, incomingDamage - state.player.armor);
    const reduced = Math.max(minDamageFromCap, reducedByArmor);
    state.player.hp -= reduced;
    state.flash = 90;
    setShake(2.8);
    spawnParticles(state.player.x, state.player.y, "#ff8e83", 8, 1.35);
    playSfx("hit");
    pushLog(`${source} hits you for ${reduced}.`, "bad");
    tryAutoPotion(source);
    if (state.player.hp <= 0) {
      if (tryTriggerChronoLoop(source)) {
        return;
      }
      gameOver(`You died on depth ${state.depth}.`);
    }
    markUiDirty();
  }

  function applySpikeToPlayer() {
    if (!isSpikeAt(state.player.x, state.player.y) || state.phase !== "playing") return;
    if (isDebugGodModeActive()) {
      return;
    }
    // Iron Boots: immune to spikes
    if (hasRelic("ironboots")) {
      return;
    }
    if (blockDamageWithShield("spikes")) {
      return;
    }
    state.player.hp -= scaledCombat(1);
    state.flash = 60;
    setShake(1.6);
    spawnParticles(state.player.x, state.player.y, "#d86b6b", 6, 1.1);
    // Glass Depths: spikes drop gold
    if (isMutatorActive("glassdepths")) {
      const spikeGold = grantGold(randInt(1, 3));
      pushLog(`Spikes cut you for ${scaledCombat(1)}, but drop ${spikeGold} gold.`, "bad");
    } else {
      pushLog(`Spikes cut you for ${scaledCombat(1)}.`, "bad");
    }
    tryAutoPotion("spikes");
    if (state.player.hp <= 0) {
      if (tryTriggerChronoLoop("spikes")) {
        return;
      }
      gameOver(`You bled out on spikes at depth ${state.depth}.`);
    }
    markUiDirty();
  }

  function applySpikeToEnemy(enemy) {
    if (!isSpikeAt(enemy.x, enemy.y)) return false;
    enemy.hp -= scaledCombat(1);
    spawnParticles(enemy.x, enemy.y, "#d27272", 5, 0.9);
    if (enemy.hp <= 0) {
      removeEnemy(enemy);
      const reward = grantGold(1);
      pushLog(`${enemy.name} collapsed on spikes. +${reward} gold.`, "good");
      markUiDirty();
      return true;
    }
    return false;
  }

  function openChest(chest) {
    chest.opened = true;
    playSfx("chest");
    const roll = Math.random();
    const inTreasureRoom = state.roomType === "treasure";
    const table = inTreasureRoom
      ? { heal: 0.28, attack: 0.46, armor: 0.58, potion: 0.72, gold: 0.97 }
      : { heal: 0.38, attack: 0.62, armor: 0.78, potion: 0.9, gold: 0.97 };
    if (chance(0.005)) {
      grantLife("Chest blessing");
    }
    if (roll < table.heal) {
      if (state.runMods.chestHealPenalty >= 999) {
        // Alchemist: chests don't heal, give gold instead
        const fallbackGold = grantGold(randInt(2, 5));
        pushLog(`Chest: no heal (Alchemist), +${fallbackGold} gold.`);
      } else {
        const healAmount = Math.max(MIN_EFFECTIVE_DAMAGE, scaledCombat(4) - state.runMods.chestHealPenalty);
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmount);
        pushLog(`Chest: +${healAmount} HP.`);
      }
    } else if (roll < table.attack) {
      state.player.attack += 2;
      pushLog("Chest: Attack +2.", "good");
    } else if (roll < table.armor) {
      state.player.armor += 2;
      pushLog("Chest: Armor +2.", "good");
    } else if (roll < table.potion) {
      grantPotion(1);
      pushLog("Chest: +1 potion.", "good");
    } else if (roll < table.gold) {
      let raw = randInt(4, 8);
      if (inTreasureRoom) {
        raw = Math.round(raw * 6);
      }
      raw = Math.max(1, Math.round(raw * getTreasureSenseMultiplier()));
      const scaled = grantGold(raw);
      pushLog(`Chest: +${scaled} gold.`, "good");
    } else {
      if (blockDamageWithShield("chest trap")) {
        pushLog("Chest trap deflected.", "good");
      } else if (isDebugGodModeActive()) {
        pushLog("Chest trap ignored (God Mode).", "warn");
      } else {
        state.player.hp -= scaledCombat(3);
        pushLog(`Chest trap! You take ${scaledCombat(3)}.`, "bad");
        tryAutoPotion("chest trap");
        if (state.player.hp <= 0) {
          if (tryTriggerChronoLoop("chest trap")) {
            return;
          }
          gameOver(`You died from a chest trap on depth ${state.depth}.`);
        }
      }
    }
    spawnParticles(chest.x, chest.y, "#f2c57c", 10, 1.2);
    setShake(1.3);
    markUiDirty();
  }

  function isFreeTileForKnockback(x, y, targetEnemy) {
    if (!inBounds(x, y)) return false;
    if (x === state.player.x && y === state.player.y) return false;
    if (state.chests.some((chest) => !chest.opened && chest.x === x && chest.y === y)) return false;
    if (state.enemies.some((enemy) => enemy !== targetEnemy && enemy.x === x && enemy.y === y)) return false;
    return true;
  }

  function getDashKnockbackOffsets(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        return [
          [1, 0], [1, -1], [1, 1], [0, -1], [0, 1], [-1, 0], [-1, -1], [-1, 1]
        ];
      }
      return [
        [-1, 0], [-1, -1], [-1, 1], [0, -1], [0, 1], [1, 0], [1, -1], [1, 1]
      ];
    }
    if (dy > 0) {
      return [
        [0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]
      ];
    }
    return [
      [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1]
    ];
  }

  function findDashKnockbackTile(enemy, dashDx, dashDy) {
    const offsets = getDashKnockbackOffsets(dashDx, dashDy);

    // First: adjacent tiles in directional order.
    for (const [ox, oy] of offsets) {
      const x = enemy.x + ox;
      const y = enemy.y + oy;
      if (isFreeTileForKnockback(x, y, enemy)) {
        return { x, y };
      }
    }

    // Fallback: nearest free tile in a 2-tile radius.
    for (let radius = 2; radius <= 2; radius += 1) {
      const candidates = [];
      for (let oy = -radius; oy <= radius; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue;
          const x = enemy.x + ox;
          const y = enemy.y + oy;
          if (!isFreeTileForKnockback(x, y, enemy)) continue;
          const forwardBias = -(ox * dashDx + oy * dashDy);
          const sideBias = Math.abs(Math.abs(dashDx) > 0 ? oy : ox);
          candidates.push({ x, y, score: forwardBias * 10 + sideBias });
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.score - b.score);
        return { x: candidates[0].x, y: candidates[0].y };
      }
    }

    // Final fallback: any nearest free tile in the room.
    let best = null;
    for (let y = 1; y <= GRID_SIZE - 2; y += 1) {
      for (let x = 1; x <= GRID_SIZE - 2; x += 1) {
        if (!isFreeTileForKnockback(x, y, enemy)) continue;
        const dist = Math.abs(x - enemy.x) + Math.abs(y - enemy.y);
        if (!best || dist < best.dist) {
          best = { x, y, dist };
        }
      }
    }
    if (best) {
      return { x: best.x, y: best.y };
    }
    return null;
  }

  function cancelDashAim(logText = "Dash canceled.") {
    if (!state.dashAimActive) return false;
    state.dashAimActive = false;
    if (logText) {
      pushLog(logText);
    } else {
      markUiDirty();
    }
    return true;
  }

  function tryArmDashSkill() {
    const skill = SKILL_BY_ID.dash;
    const remaining = getSkillCooldownRemaining(skill.id);
    if (remaining > 0) {
      pushLog(`${skill.name} cooldown: ${remaining} turns.`, "bad");
      return false;
    }
    if (state.dashAimActive) {
      cancelDashAim();
      return true;
    }
    state.dashAimActive = true;
    pushLog("Dash armed. Choose direction (WASD/Arrows). Esc cancels.", "good");
    return true;
  }

  function tryUseDashSkill(forcedDx = null, forcedDy = null) {
    const skill = SKILL_BY_ID.dash;
    const dashTier = getSkillTier(skill.id);
    const remaining = getSkillCooldownRemaining(skill.id);
    if (remaining > 0) {
      state.dashAimActive = false;
      pushLog(`${skill.name} cooldown: ${remaining} turns.`, "bad");
      return false;
    }

    const rawDx = forcedDx == null ? state.player.lastMoveX : forcedDx;
    const rawDy = forcedDy == null ? state.player.lastMoveY : forcedDy;
    const dx = sign(rawDx || 0);
    const dy = sign(rawDy || 0);
    if (dx === 0 && dy === 0) {
      pushLog("Dash needs a direction.", "bad");
      return false;
    }

    let damage = state.player.attack + scaledCombat(1) + Math.floor(getEffectiveAdrenaline() / 2);
    if (dashTier >= 1) {
      damage = Math.max(MIN_EFFECTIVE_DAMAGE, damage * 2);
    }
    const maxDashTiles = dashTier >= 2 ? 4 : 3;
    const hitSet = new Set();
    const path = [];
    let currentX = state.player.x;
    let currentY = state.player.y;
    for (let i = 0; i < maxDashTiles; i += 1) {
      const nx = currentX + dx;
      const ny = currentY + dy;
      if (!inBounds(nx, ny)) break;
      if (getChestAt(nx, ny)) break;
      path.push({ x: nx, y: ny });
      currentX = nx;
      currentY = ny;
    }

    if (path.length === 0) {
      pushLog("Dash blocked.", "bad");
      return false;
    }

    const fromX = state.player.x;
    const fromY = state.player.y;
    startTween(state.player);
    for (const step of path) {
      spawnDashTrail(state.player.x, state.player.y, step.x, step.y);
      state.player.x = step.x;
      state.player.y = step.y;

      const enemy = getEnemyAt(step.x, step.y);
      if (enemy && state.enemies.includes(enemy) && !hitSet.has(enemy)) {
        enemy.hp -= damage;
        spawnParticles(enemy.x, enemy.y, "#8ee9ff", 11, 1.3);
        hitSet.add(enemy);
        if (enemy.hp <= 0) {
          killEnemy(enemy, "dash strike");
        }
      }
    }
    state.player.lastMoveX = dx;
    state.player.lastMoveY = dy;

    let knockbacks = 0;
    let splashHits = 0;
    let splashKills = 0;
    const landingEnemy = getEnemyAt(state.player.x, state.player.y);
    if (landingEnemy && state.enemies.includes(landingEnemy)) {
      const knockTile = findDashKnockbackTile(landingEnemy, dx, dy);
      if (knockTile) {
        startTween(landingEnemy);
        landingEnemy.x = knockTile.x;
        landingEnemy.y = knockTile.y;
        landingEnemy.facing = getFacingFromDelta(knockTile.x - state.player.x, knockTile.y - state.player.y, landingEnemy.facing);
        spawnParticles(knockTile.x, knockTile.y, "#8ed8ff", 8, 1.15);
        applySpikeToEnemy(landingEnemy);
        knockbacks += 1;
      }
    }

    if (dashTier >= 2) {
      const splashDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.floor(damage * 0.6));
      for (const enemy of [...state.enemies]) {
        if (hitSet.has(enemy)) continue;
        if (Math.abs(enemy.x - state.player.x) > 1 || Math.abs(enemy.y - state.player.y) > 1) continue;
        enemy.hp -= splashDamage;
        splashHits += 1;
        spawnParticles(enemy.x, enemy.y, "#7fc9ff", 8, 1.2);
        if (enemy.hp <= 0) {
          killEnemy(enemy, "dash splash");
          splashKills += 1;
        }
      }
      if (splashHits > 0) {
        spawnShockwaveRing(state.player.x, state.player.y, {
          color: "#8fcaff",
          core: "#e7f6ff",
          maxRadius: TILE * 1.8,
          life: 220
        });
      }
    }

    const travelTiles = Math.max(Math.abs(state.player.x - fromX), Math.abs(state.player.y - fromY));
    const hits = hitSet.size;
    const kills = [...hitSet].filter((enemy) => !state.enemies.includes(enemy)).length;
    if (hits > 0 || knockbacks > 0 || splashHits > 0) {
      pushLog(
        `Dash surges ${travelTiles} tiles: ${hits} hit${hits !== 1 ? "s" : ""}, ${kills} kill${kills !== 1 ? "s" : ""}${knockbacks > 0 ? `, ${knockbacks} knockback` : ""}${splashHits > 0 ? `, splash ${splashHits} hit/${splashKills} kill` : ""}.`,
        "good"
      );
    }

    playSfx("hit");
    if (isOnShrine()) {
      activateShrine();
    }
    setShake(1.9);
    spawnParticles(state.player.x, state.player.y, "#9fdcff", 9, 1.2);
    state.dashAimActive = false;
    putSkillOnCooldown(skill.id);
    finalizeTurn();
    return true;
  }

  function tryUseAoeSkill() {
    const skill = SKILL_BY_ID.aoe;
    const aoeTier = getSkillTier(skill.id);
    const remaining = getSkillCooldownRemaining(skill.id);
    if (remaining > 0) {
      pushLog(`${skill.name} cooldown: ${remaining} turns.`, "bad");
      return false;
    }

    const radius = aoeTier >= 1 ? 2 : 1;
    const targets = state.enemies.filter(
      (enemy) => Math.abs(enemy.x - state.player.x) <= radius && Math.abs(enemy.y - state.player.y) <= radius
    );
    if (targets.length === 0) {
      pushLog("Shockwave has no targets nearby.", "bad");
      return false;
    }

    let damage = Math.max(MIN_EFFECTIVE_DAMAGE, state.player.attack + Math.floor(getEffectiveAdrenaline() / 2));
    if (aoeTier >= 2) {
      damage *= 2;
    }
    let kills = 0;
    for (const enemy of targets) {
      if (!state.enemies.includes(enemy)) continue;
      enemy.hp -= damage;
      spawnParticles(enemy.x, enemy.y, "#ffd8a1", 8, 1.25);
      if (enemy.hp <= 0) {
        killEnemy(enemy, "shockwave");
        kills += 1;
      }
    }

    spawnShockwaveRing(state.player.x, state.player.y, {
      color: aoeTier >= 2 ? "#ffc87d" : "#f2cb92",
      core: aoeTier >= 2 ? "#fff5e6" : "#fff0cf",
      maxRadius: radius >= 2 ? TILE * 3.8 : TILE * 2.4,
      life: radius >= 2 ? 420 : 340
    });
    if (radius >= 2) {
      spawnShockwaveRing(state.player.x, state.player.y, {
        color: "#ffd8a9",
        core: "#fff6db",
        maxRadius: TILE * 2.8,
        life: 340
      });
    }
    playSfx("hit");
    setShake(2.3);
    spawnParticles(state.player.x, state.player.y, "#f6c48f", 12, 1.3);
    pushLog(
      `Shockwave (R${radius}) deals ${damage} to ${targets.length} target${targets.length > 1 ? "s" : ""}${
        kills > 0 ? ` (${kills} kill${kills > 1 ? "s" : ""})` : ""
      }.`,
      "good"
    );
    putSkillOnCooldown(skill.id);
    finalizeTurn();
    return true;
  }

  function tryUseShieldSkill() {
    const skill = SKILL_BY_ID.shield;
    const shieldTier = getSkillTier(skill.id);
    const remaining = getSkillCooldownRemaining(skill.id);
    if (remaining > 0) {
      pushLog(`${skill.name} cooldown: ${remaining} turns.`, "bad");
      return false;
    }
    if (state.player.barrierTurns > 0) {
      pushLog("Shield is already active.", "bad");
      return false;
    }

    state.player.barrierArmor = 0;
    // +1 offset because barrier ticks down in the same finalized turn.
    state.player.barrierTurns = 4;
    spawnParticles(state.player.x, state.player.y, "#b4d3ff", 12, 1.15);
    let pushed = 0;
    if (shieldTier >= 1) {
      const nearbyEnemies = [...state.enemies].filter(
        (enemy) => Math.abs(enemy.x - state.player.x) <= 1 && Math.abs(enemy.y - state.player.y) <= 1
      );
      for (const enemy of nearbyEnemies) {
        if (!state.enemies.includes(enemy)) continue;
        const awayDx = sign(enemy.x - state.player.x);
        const awayDy = sign(enemy.y - state.player.y);
        if (awayDx === 0 && awayDy === 0) continue;
        const knockTile = findDashKnockbackTile(enemy, awayDx, awayDy);
        if (!knockTile) continue;
        startTween(enemy);
        enemy.x = knockTile.x;
        enemy.y = knockTile.y;
        enemy.facing = getFacingFromDelta(knockTile.x - state.player.x, knockTile.y - state.player.y, enemy.facing);
        spawnParticles(knockTile.x, knockTile.y, "#b5d4ff", 7, 1.05);
        applySpikeToEnemy(enemy);
        pushed += 1;
      }
    }
    setShake(1.2);
    pushLog(
      `Shield up: full immunity for 3 turns after cast${
        shieldTier >= 1 ? `, knockback ${pushed}` : ""
      }${shieldTier >= 2 ? ", reflect x2 + taunt active" : ""}.`,
      "good"
    );
    putSkillOnCooldown(skill.id);
    finalizeTurn();
    return true;
  }

  function tryUseSkillByKey(key) {
    if (state.phase !== "playing") return false;
    if (key === "z") return tryArmDashSkill();
    if (key === "x") return tryUseAoeSkill();
    if (key === "c") return tryUseShieldSkill();
    return false;
  }

  function attackEnemy(enemy) {
    if (state.phase !== "playing") return;
    const base = state.player.attack + getEffectiveAdrenaline() + (state.player.chaosAtkBonus || 0);
    const critical = chance(state.player.crit);
    let damage = critical ? base * 2 : base;
    enemy.hp -= damage;
    playSfx("hit");
    spawnParticles(enemy.x, enemy.y, critical ? "#ffe694" : "#ff9d8d", critical ? 12 : 8, 1.35);
    setShake(2.1);
    pushLog(
      `You hit ${enemy.name} for ${damage}${critical ? " (CRIT)" : ""}.`,
      critical ? "good" : ""
    );

    // Burning Blade: ignite enemy
    if (hasRelic("burnblade") && enemy.hp > 0) {
      enemy.burnTurns = (enemy.burnTurns || 0) + 3;
      pushLog(`${enemy.name} is burning!`, "good");
    }

    // Void Reaper: crit execute enemies below 30% HP
    if (hasRelic("voidreaper") && critical && enemy.hp > 0) {
      const threshold = Math.floor((enemy.maxHp || enemy.hp) * 0.3);
      if (enemy.hp <= threshold) {
        enemy.hp = 0;
        pushLog(`Void Reaper executes ${enemy.name}!`, "good");
        spawnParticles(enemy.x, enemy.y, "#b44dff", 14, 1.6);
      }
    }

    if (enemy.hp <= 0) {
      // Void Reaper crit kill gold bonus
      if (hasRelic("voidreaper") && critical) {
        const voidGold = grantGold(3);
        pushLog(`Void Reaper bonus: +${voidGold} gold.`, "good");
      }
      killEnemy(enemy, "final blow");
    }

    // Echo Strike: 30% chance to hit again
    if (hasRelic("echostrike") && state.enemies.includes(enemy) && enemy.hp > 0 && chance(0.3)) {
      const echoDmg = Math.max(MIN_EFFECTIVE_DAMAGE, state.player.attack);
      enemy.hp -= echoDmg;
      spawnParticles(enemy.x, enemy.y, "#9fdcff", 8, 1.2);
      pushLog(`Echo Strike! Extra ${echoDmg} damage.`, "good");
      if (enemy.hp <= 0) {
        killEnemy(enemy, "echo strike");
      }
    }

    markUiDirty();
  }

  function enemyTileBlocked(x, y, currentEnemy) {
    if (!inBounds(x, y)) return true;
    if (x === state.player.x && y === state.player.y) return true;
    if (state.chests.some((chest) => !chest.opened && chest.x === x && chest.y === y)) return true;
    if (state.enemies.some((enemy) => enemy !== currentEnemy && enemy.x === x && enemy.y === y)) {
      return true;
    }
    return false;
  }

  function stepToward(enemy, targetX, targetY) {
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const sx = sign(dx);
    const sy = sign(dy);
    const options = [];
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (sx !== 0) options.push({ x: enemy.x + sx, y: enemy.y });
      if (sy !== 0) options.push({ x: enemy.x, y: enemy.y + sy });
    } else {
      if (sy !== 0) options.push({ x: enemy.x, y: enemy.y + sy });
      if (sx !== 0) options.push({ x: enemy.x + sx, y: enemy.y });
    }
    if (sx !== 0 && sy !== 0) {
      options.push({ x: enemy.x + sx, y: enemy.y + sy });
    }
    for (const option of options) {
      if (!enemyTileBlocked(option.x, option.y, enemy)) {
        return option;
      }
    }
    return null;
  }

  function hasLineOfSight(enemy) {
    if (enemy.x === state.player.x) {
      const minY = Math.min(enemy.y, state.player.y);
      const maxY = Math.max(enemy.y, state.player.y);
      for (let y = minY + 1; y < maxY; y += 1) {
        if (state.chests.some((chest) => !chest.opened && chest.x === enemy.x && chest.y === y)) {
          return false;
        }
      }
      return true;
    }
    if (enemy.y === state.player.y) {
      const minX = Math.min(enemy.x, state.player.x);
      const maxX = Math.max(enemy.x, state.player.x);
      for (let x = minX + 1; x < maxX; x += 1) {
        if (state.chests.some((chest) => !chest.opened && chest.x === x && chest.y === enemy.y)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  function enemyMelee(enemy) {
    const damage = enemy.type === "skeleton"
      ? Math.max(MIN_EFFECTIVE_DAMAGE, enemy.attack - scaledCombat(1))
      : enemy.attack;
    applyDamageToPlayer(damage, enemy.name, enemy);
    if (enemy.vampiric && state.phase === "playing") {
      enemy.hp = Math.min(enemy.maxHp || enemy.hp, enemy.hp + scaledCombat(1));
    }
    spawnParticles(state.player.x, state.player.y, "#ff7a7a", 7, 1.35);

    // Thorn Mail: reflect 10 dmg to melee attackers
    if (hasRelic("thornmail") && state.phase === "playing" && state.enemies.includes(enemy)) {
      enemy.hp -= scaledCombat(1);
      spawnParticles(enemy.x, enemy.y, "#d86b6b", 5, 0.9);
      pushLog(`Thorn Mail reflects ${scaledCombat(1)} to ${enemy.name}.`, "good");
      if (enemy.hp <= 0) {
        killEnemy(enemy, "thorns");
      }
    }
  }

  function enemyRanged(enemy) {
    const boltColor = enemy.type === "warden" ? "#c8a7ff" : "#8bb4ff";
    enemy.castFlash = 120;
    enemy.aiming = false;
    spawnRangedBolt(enemy.x, enemy.y, state.player.x, state.player.y, boltColor);
    spawnRangedImpact(state.player.x, state.player.y, boltColor);
    applyDamageToPlayer(enemy.attack, `${enemy.name} bolt`, enemy);
    if (enemy.vampiric && state.phase === "playing") {
      enemy.hp = Math.min(enemy.maxHp || enemy.hp, enemy.hp + scaledCombat(1));
    }
    spawnParticles(state.player.x, state.player.y, boltColor, 7, 1.35);
  }

  function enemyTurn() {
    if (state.phase !== "playing") return;
    const order = [...state.enemies];
    for (const enemy of order) {
      if (state.phase !== "playing") return;
      if (!state.enemies.includes(enemy)) continue;

      // Frost Amulet: skip frozen enemies
      if (enemy.frozenThisTurn) {
        if (isFrostImmuneEnemy(enemy)) {
          enemy.frozenThisTurn = false;
          enemy.frostFx = 0;
        } else {
          enemy.frozenThisTurn = false;
          enemy.frostFx = Math.max(enemy.frostFx || 0, 820);
          spawnParticles(enemy.x, enemy.y, "#cde9ff", 4, 0.55);
          continue;
        }
      }

      if (enemy.type === "brute") {
        enemy.rests = !enemy.rests;
        if (enemy.rests) {
          continue;
        }
      }

      const distance = manhattan(enemy.x, enemy.y, state.player.x, state.player.y);
      const lineDistance = Math.abs(enemy.x - state.player.x) + Math.abs(enemy.y - state.player.y);

      if (enemy.type === "warden") {
        if (enemy.cooldown > 0) {
          enemy.cooldown -= 1;
        }
        const canBlast =
          hasLineOfSight(enemy) && lineDistance <= enemy.range && enemy.cooldown === 0 && distance > 1;
        if (canBlast) {
          enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
          enemyRanged(enemy);
          enemy.cooldown = 2;
          pushLog("Warden casts a pulse blast.", "bad");
          if (state.phase !== "playing") return;
          continue;
        }
      }

      if (enemy.type === "skeleton" && enemy.cooldown > 0) {
        enemy.cooldown -= 1;
      }
      if (enemy.type === "skeleton") {
        const canLineShot = hasLineOfSight(enemy) && lineDistance >= 2 && lineDistance <= enemy.range;
        if (enemy.aiming) {
          if (canLineShot) {
            enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
            enemyRanged(enemy);
            enemy.cooldown = 2;
            if (state.phase !== "playing") return;
            continue;
          }
          enemy.aiming = false;
        }
        if (canLineShot && enemy.cooldown === 0) {
          if (isEpicShieldReflectActive()) {
            enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
            enemyRanged(enemy);
            enemy.cooldown = 2;
            if (state.phase !== "playing") return;
            continue;
          }
          enemy.aiming = true;
          pushLog("Skeleton lines up a shot.", "bad");
          continue;
        }
      }

      if (distance === 1) {
        enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
        enemyMelee(enemy);
        if (state.phase !== "playing") return;
        continue;
      }

      const step = stepToward(enemy, state.player.x, state.player.y);
      if (!step) {
        continue;
      }
      const oldX = enemy.x;
      const oldY = enemy.y;
      startTween(enemy);
      enemy.x = step.x;
      enemy.y = step.y;
      enemy.facing = getFacingFromDelta(step.x - oldX, step.y - oldY, enemy.facing);
      if (applySpikeToEnemy(enemy)) {
        continue;
      }

      // Fast affix or Haste mutator double move
      const hasDoubleMove = enemy.affix === "fast" ||
        (state.runMods.enemyDoubleMoveChance > 0 && chance(state.runMods.enemyDoubleMoveChance));
      if (hasDoubleMove && state.phase === "playing" && state.enemies.includes(enemy)) {
        const bonusDistance = manhattan(enemy.x, enemy.y, state.player.x, state.player.y);
        if (bonusDistance > 1) {
          const bonusStep = stepToward(enemy, state.player.x, state.player.y);
          if (bonusStep) {
            const bonusOldX = enemy.x;
            const bonusOldY = enemy.y;
            startTween(enemy);
            enemy.x = bonusStep.x;
            enemy.y = bonusStep.y;
            enemy.facing = getFacingFromDelta(bonusStep.x - bonusOldX, bonusStep.y - bonusOldY, enemy.facing);
            if (applySpikeToEnemy(enemy)) {
              continue;
            }
          }
        }
      }

      // Epic Shield provokes nearby enemies into melee to make reflect reliable.
      if (isEpicShieldReflectActive() && state.phase === "playing" && state.enemies.includes(enemy)) {
        const postMoveDistance = manhattan(enemy.x, enemy.y, state.player.x, state.player.y);
        if (postMoveDistance === 1) {
          enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
          enemyMelee(enemy);
          if (state.phase !== "playing") return;
          continue;
        }
      }
    }
  }

  function tickBurningEnemies() {
    if (!hasRelic("burnblade")) return;
    for (const enemy of [...state.enemies]) {
      if (!state.enemies.includes(enemy)) continue;
      if ((enemy.burnTurns || 0) > 0) {
        enemy.burnTurns -= 1;
        enemy.hp -= scaledCombat(1);
        spawnParticles(enemy.x, enemy.y, "#ff6a35", 4, 0.8);
        if (enemy.hp <= 0) {
          killEnemy(enemy, "burn");
        }
      }
    }
  }

  function isFrostImmuneEnemy(enemy) {
    return Boolean(enemy && (enemy.elite || enemy.type === "warden"));
  }

  function tickFrostAmulet() {
    if (!hasRelic("frostamulet")) return;
    for (const enemy of state.enemies) {
      if (isFrostImmuneEnemy(enemy)) {
        enemy.frozenThisTurn = false;
        continue;
      }
      const dist = manhattan(enemy.x, enemy.y, state.player.x, state.player.y);
      if (dist <= 2 && chance(0.15)) {
        enemy.frozenThisTurn = true;
        enemy.frostFx = Math.max(enemy.frostFx || 0, 620);
        spawnParticles(enemy.x, enemy.y, "#a9d8ff", 5, 0.7);
      }
    }
  }

  function getChaosSafeTeleportTiles() {
    const tiles = [];
    for (let y = 1; y <= GRID_SIZE - 2; y += 1) {
      for (let x = 1; x <= GRID_SIZE - 2; x += 1) {
        if (x === state.player.x && y === state.player.y) continue;
        if (isSpikeAt(x, y)) continue;
        if (getEnemyAt(x, y)) continue;
        if (state.chests.some((chest) => !chest.opened && chest.x === x && chest.y === y)) continue;
        if (state.merchant && state.merchant.x === x && state.merchant.y === y) continue;
        if (state.shrine && !state.shrine.used && state.shrine.x === x && state.shrine.y === y) continue;
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  function tickChaosOrb() {
    if (!hasRelic("chaosorb")) return;

    state.player.chaosRollCounter = (state.player.chaosRollCounter || 0) + 1;
    if (state.player.chaosRollCounter < CHAOS_ORB_ROLL_INTERVAL) return;
    state.player.chaosRollCounter = 0;

    // Previous Chaos Orb mode expires on each new roll.
    state.player.chaosAtkBonus = 0;
    state.player.chaosAtkTurns = 0;
    state.player.chaosKillHeal = 0;

    // Visual feedback for every roll.
    spawnParticles(state.player.x, state.player.y, "#ffb020", 16, 1.4);
    spawnShockwaveRing(state.player.x, state.player.y, {
      color: "#ffbf6d",
      core: "#fff1d2",
      maxRadius: TILE * 2.3,
      life: 260
    });

    const roll = randInt(1, 6);
    if (roll === 1) {
      state.player.chaosAtkBonus = CHAOS_ORB_ATK_BONUS;
      state.player.chaosAtkTurns = CHAOS_ORB_ROLL_INTERVAL;
      pushLog("Chaos roll [1]: +20 ATK for 10 turns.", "good");
      return;
    }
    if (roll === 2) {
      state.player.chaosKillHeal = CHAOS_ORB_KILL_HEAL;
      pushLog("Chaos roll [2]: +20 HP per kill for 10 turns.", "good");
      return;
    }
    if (roll === 3) {
      const chaosGold = grantGold(CHAOS_ORB_GOLD_BONUS, { applyMultiplier: false });
      pushLog(`Chaos roll [3]: +${chaosGold} gold.`, "good");
      return;
    }
    if (roll === 4) {
      if (state.enemies.length <= 0) {
        pushLog("Chaos roll [4]: no enemy to strike.");
        return;
      }
      const target = state.enemies[randInt(0, state.enemies.length - 1)];
      target.hp -= CHAOS_ORB_ENEMY_DAMAGE;
      spawnParticles(target.x, target.y, "#ff8c8c", 10, 1.35);
      pushLog(`Chaos roll [4]: ${target.name} takes ${CHAOS_ORB_ENEMY_DAMAGE} chaos damage.`, "good");
      if (target.hp <= 0) {
        killEnemy(target, "chaos strike");
      }
      return;
    }
    if (roll === 5) {
      const safeTiles = getChaosSafeTeleportTiles();
      if (safeTiles.length <= 0) {
        pushLog("Chaos roll [5]: no safe tile for teleport.");
        return;
      }
      const fromX = state.player.x;
      const fromY = state.player.y;
      const to = safeTiles[randInt(0, safeTiles.length - 1)];
      startTween(state.player);
      state.player.x = to.x;
      state.player.y = to.y;
      spawnParticles(fromX, fromY, "#a5c6ff", 8, 1.0);
      spawnParticles(to.x, to.y, "#a5c6ff", 10, 1.2);
      pushLog("Chaos roll [5]: teleported to a random safe tile.", "good");
      return;
    }
    pushLog("Chaos roll [6]: nothing happens.");
  }

  function tickMagneticShard() {
    if (!hasRelic("magnet")) return;
    const adjacent = state.chests.filter((chest) =>
      !chest.opened &&
      Math.abs(chest.x - state.player.x) <= 2 &&
      Math.abs(chest.y - state.player.y) <= 2 &&
      !(chest.x === state.player.x && chest.y === state.player.y)
    );
    for (const chest of adjacent) {
      openChest(chest);
      if (state.phase !== "playing") return;
    }
  }

  function finalizeTurn() {
    if (state.phase !== "playing") return;
    state.turn += 1;

    // Magnetic Shard: auto-loot adjacent chests
    tickMagneticShard();
    if (state.phase !== "playing") return;

    applySpikeToPlayer();
    if (state.phase !== "playing") return;

    // Frost Amulet: freeze nearby enemies before their turn
    tickFrostAmulet();

    enemyTurn();
    if (state.phase !== "playing") return;

    // Burning Blade: tick burn damage on enemies
    tickBurningEnemies();
    if (state.phase !== "playing") return;

    checkRoomClearBonus();
    if (state.phase !== "playing") return;

    // Chaos Orb: rolls a random effect every 10 turns.
    tickChaosOrb();

    // Phase Cloak cooldown
    if (hasRelic("phasecloak") && state.player.phaseCooldown > 0) {
      state.player.phaseCooldown -= 1;
    }

    tickSkillCooldowns();
    tickAutoPotionCooldown();
    tickFuryBlessing();
    tickBarrier();
    saveMetaProgress();
    saveRunSnapshot();
    markUiDirty();
  }

  function tryMove(dx, dy) {
    if (state.phase !== "playing") return;
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;
    if (!inBounds(nx, ny)) return;

    const enemy = getEnemyAt(nx, ny);
    if (enemy) {
      state.player.lastMoveX = dx;
      state.player.lastMoveY = dy;
      attackEnemy(enemy);
      finalizeTurn();
      return;
    }

    state.player.lastMoveX = dx;
    state.player.lastMoveY = dy;
    startTween(state.player);
    state.player.x = nx;
    state.player.y = ny;

    const chest = getChestAt(nx, ny);
    if (chest) {
      openChest(chest);
      if (state.phase !== "playing") return;
    }

    if (isOnShrine()) {
      activateShrine();
      if (state.phase !== "playing") return;
    }

    finalizeTurn();
  }

  function drinkPotion() {
    if (state.phase !== "playing") return;
    if (state.player.potions <= 0) {
      pushLog("No potion left.", "bad");
      return;
    }
    if (state.player.hp >= state.player.maxHp) {
      pushLog("HP already full.");
      return;
    }
    state.player.potions -= 1;
    state.potionsUsedThisRun = (state.potionsUsedThisRun || 0) + 1;
    const heal = getPotionHealAmount();
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    spawnParticles(state.player.x, state.player.y, "#8ce1a7", 10, 1.05);
    pushLog(`Potion used. +${heal} HP.`, "good");
    markUiDirty();
    finalizeTurn();
  }

  function attemptDescend() {
    if (state.phase !== "playing") return;
    if (!isOnPortal()) return;
    if (state.enemies.length > 0) {
      pushLog("Portal sealed. Clear all enemies first.", "bad");
      return;
    }
    state.depth += 1;
    state.runMaxDepth = Math.max(state.runMaxDepth, state.depth);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + scaledCombat(1));
    saveMetaProgress();
    playSfx("portal");
    buildRoom();
    if (state.bossRoom) {
      pushLog(`You descend to depth ${state.depth}. Mini-boss room!`, "bad");
    } else {
      pushLog(`You descend to depth ${state.depth}. +${scaledCombat(1)} HP from momentum.`, "good");
    }
    saveRunSnapshot();
    markUiDirty();
  }

  function buildHud() {
    if (state.phase === "boot" || state.phase === "splash" || state.phase === "menu") {
      hudEl.innerHTML = [
        `<div class="statline"><span>Player</span><strong>${state.playerName || "Not set"}</strong></div>`,
        `<div class="statline"><span>Lives</span><strong>${state.lives}/${MAX_LIVES}</strong></div>`,
        `<div class="statline"><span>Camp Gold</span><strong>${state.campGold}</strong></div>`,
        `<div class="statline"><span>Highscore</span><strong>${state.highscore}</strong></div>`,
        `<div class="statline"><span>Best Gold</span><strong>${state.bestGold}</strong></div>`,
        `<div class="statline"><span>Deaths</span><strong>${state.deaths}</strong></div>`,
        `<div class="statline"><span>Continue</span><strong>${state.hasContinueRun ? "YES" : "NO"}</strong></div>`
      ].join("");
      return;
    }

    if (state.phase === "camp") {
      hudEl.innerHTML = [
        `<div class="statline"><span>Player</span><strong>${state.playerName || "Not set"}</strong></div>`,
        `<div class="statline"><span>Lives</span><strong>${state.lives}/${MAX_LIVES}</strong></div>`,
        `<div class="statline"><span>Camp Gold</span><strong>${state.campGold}</strong></div>`,
        `<div class="statline"><span>Highscore</span><strong>${state.highscore}</strong></div>`,
        `<div class="statline"><span>Best Gold</span><strong>${state.bestGold}</strong></div>`,
        `<div class="statline"><span>Deaths</span><strong>${state.deaths}</strong></div>`,
        `<div class="statline"><span>Carried Relics</span><strong>${state.relics.length}/${MAX_RELICS}</strong></div>`,
        `<div class="statline"><span>Vitality</span><strong>${getCampUpgradeLevel("vitality")}</strong></div>`,
        `<div class="statline"><span>Blade</span><strong>${getCampUpgradeLevel("blade")}</strong></div>`,
        `<div class="statline"><span>Satchel</span><strong>${getCampUpgradeLevel("satchel")}</strong></div>`,
        `<div class="statline"><span>Guard</span><strong>${getCampUpgradeLevel("guard")}</strong></div>`,
        `<div class="statline"><span>Auto Potion</span><strong>${getCampUpgradeLevel("auto_potion")}/1</strong></div>`,
        `<div class="statline"><span>Potion Str</span><strong>${getCampUpgradeLevel("potion_strength")}/5</strong></div>`,
        `<div class="statline"><span>Crit Train</span><strong>${getCampUpgradeLevel("crit_chance")}/4</strong></div>`,
        `<div class="statline"><span>Treasure Sense</span><strong>${getCampUpgradeLevel("treasure_sense")}/5</strong></div>`,
        `<div class="statline"><span>Emergency Stash</span><strong>${getCampUpgradeLevel("emergency_stash")}/3</strong></div>`,
        `<div class="statline"><span>Bounty Contract</span><strong>${getCampUpgradeLevel("bounty_contract")}/5</strong></div>`
      ].join("");
      return;
    }

    const chaosAtkBonus = Math.max(0, Number(state.player.chaosAtkBonus) || 0);
    const chaosRollCounter = clamp(
      Math.max(0, Number(state.player.chaosRollCounter) || 0),
      0,
      CHAOS_ORB_ROLL_INTERVAL - 1
    );
    const chaosTurnsLeft = hasRelic("chaosorb")
      ? CHAOS_ORB_ROLL_INTERVAL - chaosRollCounter
      : 0;

    hudEl.innerHTML = [
      `<div class="statline"><span>Player</span><strong>${state.playerName || "Not set"}</strong></div>`,
      `<div class="statline"><span>HP</span><strong>${state.player.hp}/${state.player.maxHp}</strong></div>`,
      `<div class="statline"><span>Lives</span><strong>${state.lives}/${MAX_LIVES}</strong></div>`,
      `<div class="statline"><span>ATK</span><strong>${state.player.attack}${chaosAtkBonus > 0 ? ` (+${chaosAtkBonus})` : ""}</strong></div>`,
      `<div class="statline"><span>ARM</span><strong>${state.player.armor}</strong></div>`,
      `<div class="statline"><span>Crit</span><strong>${Math.round(state.player.crit * 100)}%</strong></div>`,
      `<div class="statline"><span>Potions</span><strong>${state.player.potions}/${state.player.maxPotions}</strong></div>`,
      `<div class="statline"><span>Gold</span><strong>${state.player.gold}</strong></div>`,
      `<div class="statline"><span>Run Gold+</span><strong>${getRunGoldEarned()}</strong></div>`,
      `<div class="statline"><span>Score</span><strong>${calculateScore(getRunMaxDepth(), getRunGoldEarned())}</strong></div>`,
      `<div class="statline"><span>Depth</span><strong>${state.depth}</strong></div>`,
      `<div class="statline"><span>Highscore</span><strong>${state.highscore}</strong></div>`,
      `<div class="statline"><span>Best Gold</span><strong>${state.bestGold}</strong></div>`,
      `<div class="statline"><span>Deaths</span><strong>${state.deaths}</strong></div>`,
      `<div class="statline"><span>Camp Gold</span><strong>${state.campGold}</strong></div>`,
      `<div class="statline"><span>Enemies</span><strong>${state.enemies.length}</strong></div>`,
      `<div class="statline"><span>Turn</span><strong>${state.turn}</strong></div>`,
      `<div class="statline"><span>Fury</span><strong>${getEffectiveAdrenaline()}/${getEffectiveMaxAdrenaline()}</strong></div>`,
      hasRelic("chaosorb")
        ? `<div class="statline"><span>Chaos Roll</span><strong>${chaosTurnsLeft}T</strong></div>`
        : "",
      state.player.chaosKillHeal > 0
        ? `<div class="statline"><span>Chaos Heal</span><strong>+${state.player.chaosKillHeal}/kill</strong></div>`
        : "",
      state.player.furyBlessingTurns > 0
        ? `<div class="statline"><span>Fury Bless</span><strong>${state.player.furyBlessingTurns}T</strong></div>`
        : "",
      `<div class="statline"><span>Room</span><strong>${ROOM_TYPE_LABELS[state.roomType]}</strong></div>`,
      `<div class="statline"><span>Relics</span><strong>${state.relics.length}/${MAX_RELICS}</strong></div>`,
      ...getRelicInventoryGroups().map(({ relicId, count }) => {
        const rel = RELICS.find((r) => r.id === relicId);
        if (!rel) return "";
        const ri = RARITY[rel.rarity] || RARITY.normal;
        const chronoSpent = relicId === "chronoloop" && state.player.chronoUsedThisRun;
        const relicColor = chronoSpent ? "#ff5f5f" : ri.color;
        const relicLabel = chronoSpent ? "SPENT" : ri.label;
        const stackSuffix = count > 1
          ? rel.rarity === "normal"
            ? ` x${count}/${MAX_NORMAL_RELIC_STACK}`
            : ` x${count}`
          : "";
        return `<div class="statline"><span style="color:${relicColor}">${rel.name}${stackSuffix}</span><strong style="color:${relicColor}">${relicLabel}</strong></div>`;
      })
    ].join("");
  }

  function buildDepthBadge() {
    if (!depthBadgeEl) return;

    const shouldShow = state.phase !== "boot" && state.phase !== "splash";
    if (!shouldShow) {
      depthBadgeEl.classList.add("hidden");
      canvas.classList.remove("boss-pulse");
      return;
    }

    let title = "";
    let subtitle = "";

    if (state.phase === "playing" || state.phase === "relic") {
      const roomLabel = ROOM_TYPE_LABELS[state.roomType] || "Room";
      const bossStatus = state.bossRoom ? "BOSS NOW" : `BOSS IN ${getRoomsUntilBoss()}`;
      title = `Depth ${state.depth}`;
      subtitle = `${roomLabel} Room - ${bossStatus}`;
    } else if (state.phase === "camp") {
      const lastDepth = state.lastExtract?.depth ?? state.depth;
      title = "Camp";
      subtitle = `Last run depth ${lastDepth}`;
    } else if (state.phase === "dead") {
      title = `Depth ${state.depth}`;
      subtitle = "Run Over";
    } else {
      title = "Main Menu";
      subtitle = state.hasContinueRun ? "Continue available" : "Fresh run ready";
    }

    depthBadgeEl.innerHTML = [
      `<strong>${title}</strong>`,
      `<span>${subtitle}</span>`
    ].join("");

    const inBossRoom = state.phase === "playing" && state.bossRoom;
    depthBadgeEl.classList.remove("hidden");
    depthBadgeEl.classList.toggle("boss", inBossRoom);
    canvas.classList.toggle("boss-pulse", inBossRoom);
  }

  function getSkillTierEffectsSummary(skillId) {
    const tier = getSkillTier(skillId);
    if (skillId === "dash") {
      if (tier >= 2) return "4-tile pierce, x2 dmg, landing splash";
      if (tier >= 1) return "3-tile pierce, x2 damage";
      return "3-tile pierce + knockback";
    }
    if (skillId === "aoe") {
      if (tier >= 2) return "Radius 2, damage x2";
      if (tier >= 1) return "Radius 2 shockwave";
      return "Hit all 8 nearby tiles";
    }
    if (skillId === "shield") {
      if (tier >= 2) return "3-turn immunity, knockback + reflect x2 (taunt)";
      if (tier >= 1) return "3-turn immunity + cast knockback";
      return "Full immunity for 3 turns after cast";
    }
    return "";
  }

  function buildSkillsBar() {
    if (!skillsBarEl) return;

    const inRun = state.phase === "playing";
    const iconBySkill = {
      dash: ">>",
      aoe: "**",
      shield: "[]"
    };

    const cards = SKILLS.map((skill) => {
      const cd = getSkillCooldownRemaining(skill.id);
      const tierLabel = getSkillTierLabel(skill.id);
      const tier = getSkillTier(skill.id);
      const tierClass = tier >= 2 ? "tier-epic" : tier >= 1 ? "tier-rare" : "tier-base";
      const dashArmed = inRun && skill.id === "dash" && state.dashAimActive;
      const ready = inRun && cd <= 0;
      const stateClass = dashArmed
        ? "armed"
        : ready
          ? "ready"
          : cd > 0
            ? "cooling"
            : "idle";
      const cardClass = `skill-card ${stateClass} ${tierClass}`;
      const status = dashArmed ? "ARMED" : cd > 0 ? `${cd}T` : inRun ? "READY" : "IDLE";
      const detail =
        dashArmed
          ? "Choose direction (WASD/Arrows)"
          : skill.id === "shield" && state.player.barrierTurns > 0
          ? `Immunity (${state.player.barrierTurns}T)`
          : getSkillTierEffectsSummary(skill.id);
      return [
        `<div class="${cardClass}" data-skill="${skill.id}">`,
        `<div class="skill-head">`,
        `<span class="skill-key">${skill.key}</span>`,
        `<span class="skill-icon">${iconBySkill[skill.id]}</span>`,
        `<span class="skill-cd">${status}</span>`,
        `</div>`,
        `<div class="skill-name">${skill.name} <small>[${tierLabel}]</small></div>`,
        `<div class="skill-desc">${detail}</div>`,
        `</div>`
      ].join("");
    }).join("");

    skillsBarEl.innerHTML = cards;
  }

  function buildActionText() {
    if (state.phase === "boot") { actionsEl.textContent = ""; return; }
    const emergencyLossPercent = Math.round(getEmergencyExtractLossRatio() * 100);

    if (state.phase === "menu") {
      actionsEl.textContent = "Navigate with W/S or Arrows. Enter to select.";
      return;
    }
    if (state.phase === "camp") {
      if (state.extractRelicPrompt) {
        const relicGold = Math.max(0, Number(state.extractRelicPrompt.relicReturn?.total) || 0);
        actionsEl.textContent = `Exchange relics for +${relicGold} camp gold? Y/Enter = sell, N/Esc = keep relics in camp.`;
        return;
      }
      const summary = state.lastExtract
        ? `Last run: depth ${state.lastExtract.depth}, +${state.lastExtract.campGold} camp gold${
            state.lastExtract.relicReturned > 0
              ? ` (${state.lastExtract.relicReturned} relics returned for +${state.lastExtract.relicGold})`
              : ""
          }.`
        : "";
      const panelHint = state.campPanelView === "mutators" ? "1-0 toggle mutators" : "1-0 buy upgrades";
      const carryHint = state.relics.length > 0
        ? ` R - new run (carry ${state.relics.length} relics).`
        : " R - new run.";
      actionsEl.textContent = `${panelHint}. T - switch view.${carryHint}${summary ? " " + summary : ""}`;
      return;
    }
    if (state.phase === "relic") {
      if (state.legendarySwapPending) {
        const incoming = getRelicById(state.legendarySwapPending.incomingRelicId);
        const current = getRelicById(state.legendarySwapPending.currentRelicId);
        const incomingName = incoming ? incoming.name : "new legendary";
        const currentName = current ? current.name : "current legendary";
        actionsEl.textContent = `You can only have 1 legendary. 1 keep ${currentName}, 2 take ${incomingName}.`;
      } else if (state.relicSwapPending) {
        const incoming = getRelicById(state.relicSwapPending);
        actionsEl.textContent = incoming
          ? `Relic cap ${MAX_RELICS}/${MAX_RELICS}. Press ${getRelicDiscardHotkeyHint()} to discard one for ${incoming.name}.`
          : `Relic cap reached. Press ${getRelicDiscardHotkeyHint()} to discard one relic.`;
      } else {
        const draftSize = (state.relicDraft || []).length;
        const skipKey = getRelicDraftSkipHotkey();
        actionsEl.textContent = `Press 1-${draftSize} to pick a relic, or ${skipKey} to skip.`;
      }
      return;
    }
    if (state.phase === "dead") {
      if (state.finalGameOverPrompt) {
        actionsEl.textContent = "GAME OVER: all lives lost. 1 = Main Menu, 2 = Leaderboard.";
      } else {
        actionsEl.textContent = `Lives: ${state.lives}/${MAX_LIVES}. R - restart. 1-0 - toggle mutators.`;
      }
      return;
    }
    if (state.phase === "playing" && state.extractConfirm) {
      actionsEl.textContent = `Lose ${emergencyLossPercent}% gold? Y/Enter â€” confirm, N/Esc â€” cancel.`;
      return;
    }
    if (state.phase === "playing" && state.merchantMenuOpen) {
      actionsEl.textContent = "Merchant menu: 1 potion (run gold), 2 dash/3 shockwave/4 shield (run + camp gold). E/Esc - close.";
      return;
    }
    if (state.phase === "playing" && state.dashAimActive) {
      actionsEl.textContent = "Dash armed: choose direction (WASD/Arrows), Esc to cancel.";
      return;
    }
    if (state.phase === "playing" && hoveredEnemy && state.enemies.includes(hoveredEnemy)) {
      const e = hoveredEnemy;
      let info = `${e.name} â€” HP: ${e.hp}/${e.maxHp}, ATK: ${e.attack}`;
      if (e.range) info += `, Range: ${e.range}`;
      if (e.aiming) info += ", Aiming!";
      if (e.frozenThisTurn || (e.frostFx || 0) > 0) info += ", Frozen";
      if ((e.burnTurns || 0) > 0) info += `, Burn(${e.burnTurns})`;
      if (e.elite) info += ` [${e.affix || "elite"}]`;
      actionsEl.textContent = info;
      return;
    }
    if (isOnMerchant()) {
      const cost = merchantPotionCost();
      actionsEl.textContent = `Merchant: E â€” open shop (potion ${cost}g). Q â€” emergency extract.`;
      return;
    }
    if (isOnPortal()) {
      if (state.enemies.length > 0) {
        actionsEl.textContent = "Portal locked â€” clear the room first. Q â€” emergency extract.";
      } else {
        actionsEl.textContent = "E â€” descend deeper. Q â€” full extract (keep all gold).";
      }
      return;
    }
    if (state.roomCleared) {
      actionsEl.textContent = `Room cleared! Portal revealed. Head to the portal. Q - emergency extract (-${emergencyLossPercent}%).`;
      return;
    }
    actionsEl.textContent = "Move into enemies to attack. Q â€” emergency extract.";
  }

  function buildMutatorRows(canToggle) {
    return MUTATORS.map((mutator) => {
      const unlocked = state.unlockedMutators[mutator.id];
      const active = state.activeMutators[mutator.id];
      const rowClass = unlocked ? (active ? "mut-row mut-on" : "mut-row") : "mut-row mut-locked";
      const status = unlocked ? (active ? "ON" : "OFF") : "LOCKED";
      const goldPct = mutator.campGoldBonus > 0 ? ` +${Math.round(mutator.campGoldBonus * 100)}% gold` : "";
      const desc = unlocked
        ? `${mutator.bonus}; ${mutator.drawback}${goldPct}`
        : `Unlock: ${mutator.unlockText}`;
      return [
        `<div class="${rowClass}">`,
        `<span class="mut-key">${mutator.key}</span>`,
        `<div class="mut-body">`,
        `<strong>${mutator.name} <em>${status}</em></strong>`,
        `<small>${desc}</small>`,
        `</div>`,
        `</div>`
      ].join("");
    }).join("");
  }

  function buildActiveMutatorSummary() {
    const active = MUTATORS.filter((m) => state.activeMutators[m.id]);
    if (active.length === 0) return `<h3>Mutators</h3><small>None active</small>`;
    const rows = active.map((m) => {
      return `<div class="mut-row mut-on"><span class="mut-key">${m.key}</span><div class="mut-body"><strong>${m.name}</strong><small>${m.bonus}; ${m.drawback}</small></div></div>`;
    }).join("");
    return `<h3>Mutators (${active.length}/3)</h3>${rows}`;
  }

  function buildLeaderboardRows(limit = LEADERBOARD_MODAL_LIMIT) {
    const entries = getSortedLeaderboardEntries(limit);
    if (entries.length === 0) {
      if (isOnlineLeaderboardEnabled() && (state.onlineLeaderboardLoading || state.onlineSyncInFlight)) {
        return `<small class="leaderboard-note">Loading online leaderboard...</small>`;
      }
      if (state.leaderboardScope === "current") {
        return `<small class="leaderboard-note">No runs in current season yet.</small>`;
      }
      if (isOnlineLeaderboardEnabled() && state.onlineLeaderboardUpdatedAt > 0) {
        return `<small class="leaderboard-note">No finished runs recorded online yet.</small>`;
      }
      return `<small class="leaderboard-note">No finished runs yet.</small>`;
    }

    const rows = entries.map((entry, index) => {
      const outcomeLabel = entry.outcome === "extract" ? "EXTRACT" : "DEATH";
      const mutatorLabel = entry.mutatorCount > 0 ? ` | Mut ${entry.mutatorCount}` : "";
      const versionLabel = state.leaderboardScope === "legacy"
        ? ` | Ver ${entry.version || "unknown"}`
        : "";
      const topClass = index === 0 ? " leaderboard-top" : "";
      return [
        `<div class="mut-row leaderboard-row${topClass}">`,
        `<span class="mut-key">#${index + 1}</span>`,
        `<div class="mut-body">`,
        `<strong>${entry.playerName} <em>${entry.score} pts | Depth ${entry.depth} | Gold ${entry.gold} | ${outcomeLabel}${versionLabel}</em></strong>`,
        `<small>${formatLeaderboardTimestamp(entry.ts)}${mutatorLabel}</small>`,
        `</div>`,
        `</div>`
      ].join("");
    }).join("");
    return rows;
  }

  function buildMutatorPanel() {
    if (state.phase === "boot") {
      mutatorsEl.innerHTML = "";
      return;
    }

    // Menu: show mutator list (toggle with 1-0 not available here, just display)
    if (state.phase === "menu") {
      const rows = buildMutatorRows(false);
      const count = activeMutatorCount();
      mutatorsEl.innerHTML = `<h3>Mutators (${count}/3)</h3>${rows}`;
      return;
    }

    // Camp: toggle between shop and mutators with [T]
    if (state.phase === "camp") {
      if (state.campPanelView === "mutators") {
        const rows = buildMutatorRows(true);
        const count = activeMutatorCount();
        mutatorsEl.innerHTML = `<h3>Mutators (${count}/3) <small>[T] Shop</small></h3>${rows}`;
        return;
      }
      const shopTaxPercent = getCampVisitShopTaxPercent();
      const shopTaxClass = shopTaxPercent > 0 ? "camp-tax-note positive" : "camp-tax-note";
      const shopTaxText = `Current shop tax: +${shopTaxPercent}% (from last run mutators).`;
      const rows = CAMP_UPGRADES.map((upgrade) => {
        const level = getCampUpgradeLevel(upgrade.id);
        const maxed = level >= upgrade.max;
        const upgradeCost = getCampUpgradeCost(upgrade);
        const affordable = maxed || getCampUpgradeWallet(upgrade) >= upgradeCost;
        const cost = maxed ? "MAX" : `${upgradeCost} ${getCampUpgradeCurrency(upgrade)}`;
        const rowClass = ["mut-row", maxed ? "mut-on" : "", !affordable ? "mut-unaffordable" : ""]
          .join(" ")
          .trim();
        return [
          `<div class="${rowClass}">`,
          `<span class="mut-key">${upgrade.key}</span>`,
          `<div class="mut-body">`,
          `<strong>${upgrade.name} <em>Lv ${level}/${upgrade.max}</em></strong>`,
          `<small>${upgrade.desc} | Cost: ${cost}</small>`,
          `</div>`,
          `</div>`
        ].join("");
      }).join("");
      mutatorsEl.innerHTML = `<h3>Camp Shop <small>[T] Mutators</small></h3><small class="${shopTaxClass}">${shopTaxText}</small>${rows}`;
      return;
    }

    if (state.phase === "relic") {
      if (state.legendarySwapPending) {
        const incoming = getRelicById(state.legendarySwapPending.incomingRelicId);
        const current = getRelicById(state.legendarySwapPending.currentRelicId);
        const incomingInfo = RARITY[incoming?.rarity] || RARITY.legendary;
        const currentInfo = RARITY[current?.rarity] || RARITY.legendary;
        const rows = [
          [
            `<div class="mut-row mut-legendary" style="border-color:${currentInfo.border};background:${currentInfo.bg}">`,
            `<span class="mut-key">1</span>`,
            `<div class="mut-body">`,
            `<strong style="color:${currentInfo.color}">${current?.name || "Current Legendary"} <em>${currentInfo.label}</em></strong>`,
            `<small>Keep your current legendary relic.</small>`,
            `</div>`,
            `</div>`
          ].join(""),
          [
            `<div class="mut-row mut-legendary" style="border-color:${incomingInfo.border};background:${incomingInfo.bg}">`,
            `<span class="mut-key">2</span>`,
            `<div class="mut-body">`,
            `<strong style="color:${incomingInfo.color}">${incoming?.name || "New Legendary"} <em>${incomingInfo.label}</em></strong>`,
            `<small>Replace current legendary with this one.</small>`,
            `</div>`,
            `</div>`
          ].join("")
        ].join("");
        mutatorsEl.innerHTML = `<h3>You can only have 1 legendary</h3>${rows}`;
        return;
      }

      if (state.relicSwapPending) {
        const incoming = getRelicById(state.relicSwapPending);
        const rows = state.relics.map((relicId, index) => {
          const relic = getRelicById(relicId);
          const rarityInfo = RARITY[relic?.rarity] || RARITY.normal;
          const rarityClass = relic?.rarity === "legendary" ? "mut-row mut-legendary" :
                              relic?.rarity === "epic" ? "mut-row mut-epic" :
                              relic?.rarity === "rare" ? "mut-row mut-rare" : "mut-row mut-on";
          return [
            `<div class="${rarityClass}" style="border-color:${rarityInfo.border};background:${rarityInfo.bg}">`,
            `<span class="mut-key">${relicHotkeyForIndex(index)}</span>`,
            `<div class="mut-body">`,
            `<strong style="color:${rarityInfo.color}">${relic?.name || relicId} <em>${rarityInfo.label}</em></strong>`,
            `<small>${relic?.desc || "Unknown relic"}</small>`,
            `</div>`,
            `</div>`
          ].join("");
        }).join("");
        const targetName = incoming ? incoming.name : "new relic";
        mutatorsEl.innerHTML = `<h3>Replace Relic <small>${targetName}</small></h3>${rows}`;
        return;
      }

      const rows = (state.relicDraft || []).map((relic, index) => {
        const rarityInfo = RARITY[relic.rarity] || RARITY.normal;
        const rarityClass = relic.rarity === "legendary" ? "mut-row mut-legendary" :
                            relic.rarity === "epic" ? "mut-row mut-epic" :
                            relic.rarity === "rare" ? "mut-row mut-rare" : "mut-row mut-on";
        return [
          `<div class="${rarityClass}" style="border-color:${rarityInfo.border};background:${rarityInfo.bg}">`,
          `<span class="mut-key">${index + 1}</span>`,
          `<div class="mut-body">`,
          `<strong style="color:${rarityInfo.color}">${relic.name} <em>${rarityInfo.label}</em></strong>`,
          `<small>${relic.desc}</small>`,
          `</div>`,
          `</div>`
        ].join("");
      }).join("");
      const skipKey = getRelicDraftSkipHotkey();
      const skipRow = [
        `<div class="mut-row">`,
        `<span class="mut-key">${skipKey}</span>`,
        `<div class="mut-body">`,
        `<strong>Take No Relic <em>Skip</em></strong>`,
        `<small>Keep your current relic setup.</small>`,
        `</div>`,
        `</div>`
      ].join("");
      mutatorsEl.innerHTML = `<h3>Relic Draft</h3>${rows}${skipRow}`;
      return;
    }

    // Playing: show only active mutators (compact)
    if (state.phase === "playing") {
      mutatorsEl.innerHTML = buildActiveMutatorSummary();
      return;
    }

    // Dead: full mutator list
    const rows = buildMutatorRows(!state.finalGameOverPrompt);
    const count = activeMutatorCount();
    const deadHint = state.finalGameOverPrompt ? "locked after final GAME OVER" : "press 1-0";
    mutatorsEl.innerHTML = `<h3>Mutators (${count}/3) - ${deadHint}</h3>${rows}`;
  }

  function buildLog() {
    logEl.innerHTML = state.log
      .map((entry) => `<div class="${entry.type}">${entry.text}</div>`)
      .join("");
  }

  function buildScreenOverlay() {
    if (!screenOverlayEl) return;

    if (canUseDebugCheats() && state.debugCheatOpen) {
      const rows = getDebugCheatActions()
        .map((action) => {
          const enabled = action.available ? action.available() : true;
          const classes = [
            "overlay-menu-row",
            enabled ? "" : "disabled"
          ].join(" ").trim();
          return [
            `<div class="${classes}">`,
            `<div class="overlay-menu-key">${action.key}</div>`,
            `<div><strong>${action.name}</strong><br /><span>${action.desc}</span></div>`,
            `</div>`
          ].join("");
        })
        .join("");
      screenOverlayEl.className = "screen-overlay visible";
      screenOverlayEl.innerHTML = [
        `<div class="overlay-card">`,
        `<h2 class="overlay-title">Debug Cheats</h2>`,
        `<p class="overlay-sub">God Mode: ${state.debugGodMode ? "ON" : "OFF"} | Phase: ${state.phase}</p>`,
        `<p class="overlay-hint">1-0 or L execute | ${DEBUG_MENU_TOGGLE_KEY.toUpperCase()} or Esc close</p>`,
        `<div class="overlay-menu">${rows}</div>`,
        `</div>`
      ].join("");
      return;
    }

    if (state.nameModalOpen) {
      const hasName = Boolean(sanitizePlayerName(state.playerName));
      const subtitle = hasName
        ? "Update nickname used in leaderboard entries."
        : "Nickname is required before starting a new run.";
      const hint = "Enter - save | Esc - cancel";
      screenOverlayEl.className = "screen-overlay visible";
      screenOverlayEl.innerHTML = [
        `<div class="overlay-card overlay-card-wide">`,
        `<h2 class="overlay-title">Set Nickname</h2>`,
        `<p class="overlay-sub">${subtitle}</p>`,
        `<div class="name-modal-wrap">`,
        `<input id="nameInput" class="name-input" type="text" maxlength="18" placeholder="Your nickname" autocomplete="off" spellcheck="false" />`,
        `<small class="leaderboard-note">Allowed: A-Z, 0-9, space, _ and - (max 18).</small>`,
        `</div>`,
        `<p class="overlay-hint">${hint}</p>`,
        `</div>`
      ].join("");
      requestAnimationFrame(() => {
        const input = document.getElementById("nameInput");
        if (!input) return;
        if (input.value !== state.nameDraft) {
          input.value = state.nameDraft || "";
        }
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
      return;
    }

    if (state.leaderboardModalOpen && state.phase === "menu") {
      const modeLabel = state.leaderboardSortMode === "depth" ? "Depth" : "Points";
      const scopeLabel = state.leaderboardScope === "legacy" ? "Legacy" : "Current Season";
      const rows = buildLeaderboardRows(LEADERBOARD_MODAL_LIMIT);
      const sourceLabel = getLeaderboardSourceLabel();
      const statusNote = getLeaderboardStatusNote();
      screenOverlayEl.className = "screen-overlay visible";
      screenOverlayEl.innerHTML = [
        `<div class="overlay-card overlay-card-wide">`,
        `<h2 class="overlay-title">Leaderboard</h2>`,
        `<p class="overlay-sub">Top ${Math.min(LEADERBOARD_MODAL_LIMIT, LEADERBOARD_LIMIT)} | Scope: ${scopeLabel} | Sort: ${modeLabel} | Source: ${sourceLabel}</p>`,
        statusNote ? `<p class="overlay-sub">${statusNote}</p>` : "",
        `<div class="overlay-menu leaderboard-modal-list">${rows}</div>`,
        `<p class="overlay-hint">T - switch Points/Depth | V - switch Current/Legacy | Esc/Enter - close</p>`,
        `</div>`
      ].join("");
      return;
    }

    if (state.phase === "dead" && state.finalGameOverPrompt) {
      const finalDepth = Math.max(0, Number(state.finalGameOverPrompt.depth) || 0);
      const finalGold = Math.max(0, Number(state.finalGameOverPrompt.gold) || 0);
      const finalScore = Math.max(
        0,
        Number(state.finalGameOverPrompt.score) || calculateScore(finalDepth, finalGold)
      );
      const rows = [
        `<div class="overlay-menu-row">`,
        `<div class="overlay-menu-key">1</div>`,
        `<div><strong>Main Menu</strong><br /><span>Return to main menu after final wipe.</span></div>`,
        `</div>`,
        `<div class="overlay-menu-row">`,
        `<div class="overlay-menu-key">2</div>`,
        `<div><strong>Leaderboard</strong><br /><span>Show ranking for this run, then continue in menu.</span></div>`,
        `</div>`
      ].join("");
      screenOverlayEl.className = "screen-overlay visible";
      screenOverlayEl.innerHTML = [
        `<div class="overlay-card overlay-card-wide overlay-card-danger">`,
        `<h2 class="overlay-title">GAME OVER</h2>`,
        `<p class="overlay-sub">All lives lost.</p>`,
        `<p class="overlay-sub">Final run: ${finalScore} pts | Depth ${finalDepth} | Gold ${finalGold}</p>`,
        `<div class="overlay-menu">${rows}</div>`,
        `<p class="overlay-hint">1 / Enter / Esc - Main Menu | 2 - Leaderboard</p>`,
        `</div>`
      ].join("");
      return;
    }

    if (state.phase === "playing" && !state.extractConfirm && !state.merchantMenuOpen) {
      screenOverlayEl.className = "screen-overlay";
      screenOverlayEl.innerHTML = "";
      return;
    }

    if (state.phase === "camp" && state.extractRelicPrompt) {
      const relicReturn = state.extractRelicPrompt.relicReturn || { count: 0, total: 0, byRarity: {} };
      const carried = Math.max(0, Number(relicReturn.count) || 0);
      const gain = Math.max(0, Number(relicReturn.total) || 0);
      screenOverlayEl.className = "screen-overlay visible";
      screenOverlayEl.innerHTML = [
        `<div class="overlay-card">`,
        `<h2 class="overlay-title">Relic Exchange</h2>`,
        `<p class="overlay-sub">Extracted with ${carried} relics.</p>`,
        `<p class="overlay-sub">Sell relics now for +${gain} camp gold, or keep relics and stay in camp.</p>`,
        `<p class="overlay-sub">N:${relicReturn.byRarity?.normal || 0} R:${relicReturn.byRarity?.rare || 0} E:${relicReturn.byRarity?.epic || 0} L:${relicReturn.byRarity?.legendary || 0}</p>`,
        `<p class="overlay-hint">Y/Enter - sell relics | N/Esc - keep relics in camp</p>`,
        `</div>`
      ].join("");
      return;
    }

    let title = "Paused";
    let subtitle = "";
    let hint = "";
    if (state.phase === "playing" && state.extractConfirm) {
      const lossRatio = clamp(Number(state.extractConfirm.lossRatio) || 0.7, 0, 0.95);
      const keepRatio = 1 - lossRatio;
      title = "Emergency Extract";
      subtitle = `Lose ${Math.round(lossRatio * 100)}% gold and keep ${Math.max(
        0,
        Math.floor(state.player.gold * keepRatio)
      )}.`;
      hint = "Enter/Y confirm | Esc/N cancel";
    } else if (state.phase === "playing" && state.merchantMenuOpen) {
      title = "Merchant";
      subtitle = `Run ${state.player.gold} | Camp ${state.campGold} | Total ${getMerchantUpgradeWalletTotal()} | Potions ${state.player.potions}/${state.player.maxPotions}`;
      hint = "1 potion | 2 dash | 3 shockwave | 4 shield | E/Esc close";
    } else if (state.phase === "boot") {
      // Boot handled by HTML overlay
      return;
    } else if (state.phase === "menu") {
      title = "Main Menu";
      subtitle = "W/S or Arrows + Enter";
    } else if (state.phase === "dead") {
      title = "Run Over";
      subtitle = `Depth ${state.depth} | Gold ${state.player.gold} | Lives ${state.lives}/${MAX_LIVES}`;
    } else if (state.phase === "camp") {
      title = "Camp Shop";
      subtitle = `Camp Gold ${state.campGold} | Lives ${state.lives}/${MAX_LIVES}`;
    } else if (state.phase === "relic") {
      if (state.legendarySwapPending) {
        const incoming = getRelicById(state.legendarySwapPending.incomingRelicId);
        const current = getRelicById(state.legendarySwapPending.currentRelicId);
        title = "You can only have 1 legendary";
        subtitle = `1: Keep ${current ? current.name : "current"} | 2: Take ${incoming ? incoming.name : "new"}`;
      } else if (state.relicSwapPending) {
        const incoming = getRelicById(state.relicSwapPending);
        title = "Relic Inventory Full";
        subtitle = incoming
          ? `Choose relic to discard (${getRelicDiscardHotkeyHint()}) for ${incoming.name}.`
          : `Choose relic to discard (${getRelicDiscardHotkeyHint()}).`;
      } else {
        title = "Relic Draft";
        const rarityLabels = (state.relicDraft || []).map((r) => {
          const ri = RARITY[r.rarity] || RARITY.normal;
          return ri.label;
        });
        subtitle = `Depth ${state.depth} - ${rarityLabels.join(" / ")}`;
      }
    }

    if (state.phase === "menu") hint = `1-${getMenuOptions().length} quick select`;
    if (state.phase === "dead") hint = "R restart | Esc menu";
    if (state.phase === "camp") hint = "1-0 buy upgrade | R new run";
    if (state.phase === "relic") {
      const draftSize = Math.max(1, (state.relicDraft || []).length);
      if (state.legendarySwapPending) {
        hint = "Press 1 or 2";
      } else {
        hint = state.relicSwapPending
          ? `Press ${getRelicDiscardHotkeyHint()} to discard relic`
          : `Choose with 1-${draftSize} or ${getRelicDraftSkipHotkey()} to skip`;
      }
    }

    let menuBlock = "";
    if (state.phase === "menu") {
      const rows = getMenuOptions()
        .map((option, index) => {
          const classes = [
            "overlay-menu-row",
            state.menuIndex === index ? "selected" : "",
            option.disabled ? "disabled" : ""
          ].join(" ").trim();
          return [
            `<div class="${classes}">`,
            `<div class="overlay-menu-key">${option.key}</div>`,
            `<div><strong>${option.title}</strong><br /><span>${option.desc}</span></div>`,
            `</div>`
          ].join("");
        })
        .join("");
      menuBlock = `<div class="overlay-menu">${rows}</div>`;
    } else if (state.phase === "playing" && state.merchantMenuOpen) {
      const buildMerchantRow = (key, titleText, body, disabled = false) => {
        const classes = [
          "overlay-menu-row",
          disabled ? "disabled" : ""
        ].join(" ").trim();
        return [
          `<div class="${classes}">`,
          `<div class="overlay-menu-key">${key}</div>`,
          `<div><strong>${titleText}</strong><br /><span>${body}</span></div>`,
          `</div>`
        ].join("");
      };

      const potionCost = merchantPotionCost();
      const potionFull = state.player.potions >= state.player.maxPotions;
      const potionBody = potionFull
        ? `Potion bag full (${state.player.potions}/${state.player.maxPotions})`
        : `+1 potion for ${potionCost} gold`;
      const potionDisabled = potionFull || state.player.gold < potionCost;

      const buildSkillRow = (key, skillId) => {
        const skill = SKILL_BY_ID[skillId];
        const currentTier = getSkillTier(skillId);
        const currentLabel = getSkillTierLabelByValue(currentTier);
        const offer = getNextSkillUpgradeOffer(skillId);
        if (!offer) {
          return buildMerchantRow(key, `${skill.name} [${currentLabel} MAX]`, "Already Epic (max tier).", true);
        }
        const nextLabel = getSkillTierLabelByValue(offer.tier);
        const cost = merchantSkillUpgradeCost(skillId);
        const wallet = getMerchantUpgradeWalletTotal();
        const cannotAfford = wallet < cost;
        const disabled = cannotAfford;
        const reason = cannotAfford
          ? `Need ${cost} gold (run + camp).`
          : `Upgrade to ${nextLabel}: ${offer.desc}. Cost ${cost} gold (run + camp).`;
        return buildMerchantRow(key, `${skill.name} [${currentLabel} -> ${nextLabel}]`, reason, disabled);
      };

      const rows = [
        buildMerchantRow("1", "Potion", potionBody, potionDisabled),
        buildSkillRow("2", "dash"),
        buildSkillRow("3", "aoe"),
        buildSkillRow("4", "shield")
      ].join("");
      menuBlock = `<div class="overlay-menu">${rows}</div>`;
    }

    screenOverlayEl.className = "screen-overlay visible";
    screenOverlayEl.innerHTML = [
      `<div class="overlay-card">`,
      `<h2 class="overlay-title">${title}</h2>`,
      subtitle ? `<p class="overlay-sub">${subtitle}</p>` : "",
      hint ? `<p class="overlay-hint">${hint}</p>` : "",
      menuBlock,
      `</div>`
    ].join("");
  }

  function updateUi() {
    if (!state.uiDirty) return;
    buildHud();
    buildDepthBadge();
    buildSkillsBar();
    buildActionText();
    buildMutatorPanel();
    buildLog();
    buildScreenOverlay();
    state.uiDirty = false;
  }

  function drawFloorTile(x, y) {
    const px = x * TILE;
    const py = y * TILE;
    if (drawFloorTileFromTileset(x, y, px, py)) {
      return;
    }
    const wall = x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1;
    if (wall) {
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = COLORS.wallEdge;
      ctx.fillRect(px, py, TILE, 2);
      ctx.fillRect(px, py, 2, TILE);
      ctx.fillStyle = COLORS.wallDark;
      ctx.fillRect(px + TILE - 2, py, 2, TILE);
      ctx.fillRect(px, py + TILE - 2, TILE, 2);
      return;
    }

    const noise = state.floorPattern[y]?.[x] ?? 0;
    ctx.fillStyle = noise % 2 === 0 ? COLORS.floorA : COLORS.floorB;
    ctx.fillRect(px, py, TILE, TILE);
    if (noise === 2 || noise === 5) {
      ctx.fillStyle = COLORS.floorCrack;
      ctx.fillRect(px + 4, py + 7, 8, 1);
      ctx.fillRect(px + 7, py + 4, 1, 8);
    } else if (noise === 3) {
      ctx.fillStyle = COLORS.floorCrack;
      ctx.fillRect(px + 3, py + 3, 2, 2);
      ctx.fillRect(px + 11, py + 10, 2, 2);
    }
  }

  function drawTilesetTile(tileId, px, py) {
    if (!tilesetSprite.ready || !tilesetSprite.img) return false;
    const sx = (tileId % TILESET_COLUMNS) * TILESET_TILE_SIZE;
    const sy = Math.floor(tileId / TILESET_COLUMNS) * TILESET_TILE_SIZE;
    ctx.drawImage(
      tilesetSprite.img,
      sx, sy, TILESET_TILE_SIZE, TILESET_TILE_SIZE,
      px, py, TILE, TILE
    );
    return true;
  }

  function getWallTilesetId(x, y) {
    const max = GRID_SIZE - 1;
    if (x === 0 && y === 0) return TILESET_IDS.wallCornerTL;
    if (x === max && y === 0) return TILESET_IDS.wallCornerTR;
    if (x === 0 && y === max) return TILESET_IDS.wallCornerBL;
    if (x === max && y === max) return TILESET_IDS.wallCornerBR;
    if (y === 0) return TILESET_IDS.wallTop;
    if (y === max) return TILESET_IDS.wallBottom;
    if (x === 0) return TILESET_IDS.wallLeft;
    if (x === max) return TILESET_IDS.wallRight;
    return TILESET_IDS.wallBase;
  }

  function getFloorTilesetId(noise) {
    if (noise === 2 || noise === 5) return TILESET_IDS.floorCrackCross;
    if (noise === 3) return TILESET_IDS.floorBonfire;
    if (noise === 4) return TILESET_IDS.floorVar3;
    if (noise === 7) return TILESET_IDS.floorSkull;
    if (noise === 8) return TILESET_IDS.floorVar4;
    if (noise === 6) return TILESET_IDS.floorC;
    if (noise === 1 || noise === 9) return TILESET_IDS.floorB;
    return TILESET_IDS.floorA;
  }

  function drawFloorTileFromTileset(x, y, px, py) {
    if (!tilesetSprite.ready || !tilesetSprite.img) return false;
    const wall = x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1;
    const tileId = wall
      ? getWallTilesetId(x, y)
      : getFloorTilesetId(state.floorPattern[y]?.[x] ?? 0);
    return drawTilesetTile(tileId, px, py);
  }

  function drawPortal() {
    if (!state.roomCleared) return;
    const px = state.portal.x * TILE;
    const py = state.portal.y * TILE;
    if (portalSprite.readyCount > 0 && portalSprite.frames.length > 0) {
      const drawSize = Math.round(TILE * PORTAL_DRAW_SCALE);
      const drawX = Math.round(px + (TILE - drawSize) / 2);
      const drawY = Math.round(py + (TILE - drawSize) / 2);
      const frameCount = portalSprite.frames.length;
      const frameIndex = Math.floor(state.playerAnimTimer / PORTAL_FRAME_MS) % frameCount;
      const frame =
        portalSprite.frames[frameIndex] ||
        portalSprite.frames.find((img) => Boolean(img));
      if (frame) {
        const sw = frame.naturalWidth || TILE;
        const sh = frame.naturalHeight || TILE;
        ctx.drawImage(frame, 0, 0, sw, sh, drawX, drawY, drawSize, drawSize);
      }
      if (state.enemies.length > 0) {
        ctx.fillStyle = "#2a0f0f88";
        ctx.fillRect(drawX, drawY, drawSize, drawSize);
      }
      if (frame) return;
    }
    const pulse = (Math.sin(state.portalPulse) + 1) * 0.5;
    const lockedColor = state.enemies.length > 0 ? "#8b5d5d" : COLORS.portalGlow;
    ctx.fillStyle = lockedColor;
    ctx.fillRect(px + 3, py + 3, 10, 10);
    ctx.fillStyle = COLORS.portalCore;
    ctx.fillRect(px + 5, py + 5, 6, 6);
    const edge = pulse > 0.5 ? 2 : 1;
    ctx.fillStyle = "#b2f5ff";
    ctx.fillRect(px + edge, py + edge, TILE - edge * 2, 1);
    ctx.fillRect(px + edge, py + TILE - edge - 1, TILE - edge * 2, 1);
  }

  function drawChest(chest) {
    const px = chest.x * TILE;
    const py = chest.y * TILE;
    if (chest.opened) {
      ctx.fillStyle = "#3a2d1d";
      ctx.fillRect(px + 3, py + 8, 10, 4);
      return;
    }
    if (chestSprite.ready && chestSprite.img) {
      const drawW = 14;
      const drawH = 14;
      const drawX = Math.round(px + (TILE - drawW) / 2);
      const drawY = Math.round(py + TILE - drawH);
      ctx.drawImage(chestSprite.img, 0, 0, 32, 32, drawX, drawY, drawW, drawH);
      return;
    }
    ctx.fillStyle = COLORS.chest;
    ctx.fillRect(px + 3, py + 6, 10, 7);
    ctx.fillStyle = COLORS.chestTrim;
    ctx.fillRect(px + 3, py + 5, 10, 2);
    ctx.fillStyle = "#f0d485";
    ctx.fillRect(px + 7, py + 8, 2, 2);
  }

  function drawSpikes(spike) {
    const px = spike.x * TILE;
    const py = spike.y * TILE;
    const drawSize = Math.round(TILE * SPIKE_DRAW_SCALE);
    const drawX = Math.round(px + (TILE - drawSize) / 2);
    const drawY = Math.round(py + (TILE - drawSize) / 2);
    if (spikeSprite.ready && spikeSprite.img) {
      const sw = spikeSprite.img.naturalWidth || TILE;
      const sh = spikeSprite.img.naturalHeight || TILE;
      ctx.drawImage(spikeSprite.img, 0, 0, sw, sh, drawX, drawY, drawSize, drawSize);
      return;
    }
    ctx.save();
    const centerX = px + TILE / 2;
    const centerY = py + TILE / 2;
    ctx.translate(centerX, centerY);
    ctx.scale(SPIKE_DRAW_SCALE, SPIKE_DRAW_SCALE);
    ctx.translate(-TILE / 2, -TILE / 2);
    ctx.fillStyle = COLORS.spikeDark;
    ctx.fillRect(3, 11, 10, 2);
    ctx.fillStyle = COLORS.spike;
    ctx.fillRect(4, 6, 2, 5);
    ctx.fillRect(7, 5, 2, 6);
    ctx.fillRect(10, 6, 2, 5);
    ctx.restore();
  }

  function drawShrine() {
    if (!state.shrine) return;
    const px = state.shrine.x * TILE;
    const py = state.shrine.y * TILE;
    const active = !state.shrine.used;
    ctx.fillStyle = active ? "#7f68d8" : "#4a455a";
    ctx.fillRect(px + 4, py + 4, 8, 8);
    ctx.fillStyle = active ? "#d5c4ff" : "#7f7698";
    ctx.fillRect(px + 7, py + 2, 2, 2);
    ctx.fillRect(px + 7, py + 12, 2, 2);
    if (active) {
      ctx.fillRect(px + 2, py + 7, 2, 2);
      ctx.fillRect(px + 12, py + 7, 2, 2);
    }
  }

  function drawMerchant() {
    if (!state.merchant) return;
    const px = state.merchant.x * TILE;
    const py = state.merchant.y * TILE;
    const pulse = (Math.sin(state.portalPulse * 2.2) + 1) * 0.5;
    ctx.fillStyle = COLORS.merchantTrim;
    ctx.fillRect(px + 3, py + 12, 10, 2);
    ctx.fillStyle = COLORS.merchant;
    ctx.fillRect(px + 5, py + 5, 6, 7);
    ctx.fillRect(px + 4, py + 6, 8, 4);
    ctx.fillStyle = "#d8fff2";
    ctx.fillRect(px + 6, py + 7, 1, 1);
    ctx.fillRect(px + 9, py + 7, 1, 1);
    if (pulse > 0.5) {
      ctx.fillStyle = "#ffd98a";
      ctx.fillRect(px + 7, py + 2, 2, 2);
    }
  }

  function drawSlimeFallback(enemy) {
    const px = visualX(enemy);
    const py = visualY(enemy);
    ctx.fillStyle = COLORS.slime;
    ctx.fillRect(px + 3, py + 6, 10, 6);
    ctx.fillRect(px + 4, py + 5, 8, 2);
    ctx.fillStyle = COLORS.slimeEye;
    ctx.fillRect(px + 6, py + 8, 1, 1);
    ctx.fillRect(px + 9, py + 8, 1, 1);
  }

  function drawSlimeSprite(enemy) {
    const facing = enemy.facing || "south";
    const spriteSet = slimeSprites[facing];
    if (!spriteSet || spriteSet.readyCount <= 0) return false;
    const clip = SLIME_SPRITE_CLIPS[facing] || { x: 0, y: 0, w: 48, h: 48 };
    const frameIndex = Math.floor(state.playerAnimTimer / 180) % spriteSet.frames.length;
    const img = spriteSet.frames[frameIndex] || spriteSet.frames.find(Boolean);
    if (!img) return false;

    const px = visualX(enemy);
    const py = visualY(enemy);
    const drawW = 13;
    const drawH = 12;
    const drawX = Math.round(px + (TILE - drawW) / 2);
    const drawY = Math.round(py + TILE - drawH);
    ctx.drawImage(img, clip.x, clip.y, clip.w, clip.h, drawX, drawY, drawW, drawH);
    return true;
  }

  function drawSlime(enemy) {
    if (!drawSlimeSprite(enemy)) {
      drawSlimeFallback(enemy);
    }
  }

  function drawSkeletonFallback(enemy) {
    const px = visualX(enemy);
    const py = visualY(enemy);
    ctx.fillStyle = COLORS.skeleton;
    ctx.fillRect(px + 5, py + 4, 6, 5);
    ctx.fillRect(px + 7, py + 9, 2, 4);
    ctx.fillStyle = COLORS.skeletonEye;
    ctx.fillRect(px + 6, py + 6, 1, 1);
    ctx.fillRect(px + 9, py + 6, 1, 1);
  }

  function drawSkeletonSprite(enemy) {
    const facing = enemy.facing || "south";
    const spriteSet = skeletonSprites[facing];
    if (!spriteSet || spriteSet.readyCount <= 0) return false;
    const clip = SKELETON_SPRITE_CLIPS[facing] || { x: 0, y: 0, w: 32, h: 32 };
    const frameIndex = Math.floor(state.playerAnimTimer / 180) % spriteSet.frames.length;
    const img = spriteSet.frames[frameIndex] || spriteSet.frames.find(Boolean);
    if (!img) return false;

    const px = visualX(enemy);
    const py = visualY(enemy);
    const drawH = 15;
    const drawW = Math.max(9, Math.round((drawH * clip.w) / clip.h) + 3);
    const drawX = Math.round(px + (TILE - drawW) / 2);
    const drawY = Math.round(py + TILE - drawH);
    ctx.drawImage(img, clip.x, clip.y, clip.w, clip.h, drawX, drawY, drawW, drawH);
    return true;
  }

  function drawSkeleton(enemy) {
    if (!drawSkeletonSprite(enemy)) {
      drawSkeletonFallback(enemy);
    }
  }

  function drawBruteSprite(enemy) {
    const facing = enemy.facing || "south";
    const spriteSet = bruteSprites[facing];
    if (!spriteSet || spriteSet.readyCount <= 0) return false;

    const px = visualX(enemy);
    const py = visualY(enemy);
    const clip = BRUTE_SPRITE_CLIPS[facing] || { x: 0, y: 0, w: 40, h: 40 };
    const frameIndex = Math.floor(state.playerAnimTimer / 180) % spriteSet.frames.length;
    const img = spriteSet.frames[frameIndex] || spriteSet.frames.find(Boolean);
    if (!img) return false;
    const drawH = 21;
    const drawW = Math.max(12, Math.round((drawH * clip.w) / clip.h));
    const bob = Math.sin(state.playerAnimTimer * 0.02 + enemy.x * 0.55 + enemy.y * 0.35) > 0.45 ? 1 : 0;
    const drawX = Math.round(px + (TILE - drawW) / 2);
    const drawY = Math.round(py + TILE - drawH - bob);
    ctx.drawImage(img, clip.x, clip.y, clip.w, clip.h, drawX, drawY, drawW, drawH);
    return true;
  }

  function drawBruteFallback(enemy) {
    const px = visualX(enemy);
    const py = visualY(enemy);
    const theme = getThemeForEnemy(enemy);
    const pulse = (Math.sin(state.portalPulse * 2 + enemy.x * 0.35 + enemy.y * 0.2) + 1) * 0.5;
    const bodyLift = pulse > 0.75 ? 1 : 0;

    ctx.fillStyle = theme.bruteShadow;
    ctx.fillRect(px + 3, py + 13, 10, 2);
    ctx.fillStyle = theme.bruteFoot;
    ctx.fillRect(px + 4, py + 12, 3, 2);
    ctx.fillRect(px + 9, py + 12, 3, 2);

    ctx.fillStyle = theme.bruteBodyDark;
    ctx.fillRect(px + 2, py + 4 - bodyLift, 12, 8);
    ctx.fillStyle = theme.bruteBody;
    ctx.fillRect(px + 3, py + 5 - bodyLift, 10, 7);

    ctx.fillStyle = theme.bruteTrim;
    ctx.fillRect(px + 2, py + 4 - bodyLift, 12, 2);
    ctx.fillRect(px + 2, py + 11 - bodyLift, 12, 1);
    ctx.fillRect(px + 2, py + 6 - bodyLift, 1, 4);
    ctx.fillRect(px + 13, py + 6 - bodyLift, 1, 4);

    ctx.fillStyle = theme.bruteSkin;
    ctx.fillRect(px + 5, py + 7 - bodyLift, 1, 1);
    ctx.fillRect(px + 10, py + 7 - bodyLift, 1, 1);
    ctx.fillStyle = theme.bruteMouth;
    ctx.fillRect(px + 6, py + 9 - bodyLift, 4, 1);

    if (enemy.rests) {
      ctx.fillStyle = theme.bruteRest;
      ctx.fillRect(px + 7, py + 7 - bodyLift, 2, 2);
      ctx.fillRect(px + 10, py + 4 - bodyLift, 1, 1);
    } else if (pulse > 0.55) {
      ctx.fillStyle = theme.bruteSpark;
      ctx.fillRect(px + 1, py + 6 - bodyLift, 1, 1);
      ctx.fillRect(px + 14, py + 8 - bodyLift, 1, 1);
    }
  }

  function drawBrute(enemy) {
    if (!drawBruteSprite(enemy)) {
      drawBruteFallback(enemy);
    }
  }

  function drawWarden(enemy) {
    const px = visualX(enemy);
    const py = visualY(enemy);
    const theme = getThemeForEnemy(enemy);
    const pulse = (Math.sin(state.portalPulse * 1.4) + 1) * 0.5;
    const floatOffset = pulse > 0.6 ? 1 : 0;

    // Orbital shadow and floating body.
    ctx.fillStyle = theme.wardenShadow;
    ctx.fillRect(px + 3, py + 13, 10, 2);
    ctx.fillStyle = theme.wardenBodyDark;
    ctx.fillRect(px + 2, py + 4 - floatOffset, 12, 8);
    ctx.fillStyle = theme.wardenBody;
    ctx.fillRect(px + 3, py + 5 - floatOffset, 10, 7);

    // Crest and side horns.
    ctx.fillStyle = theme.wardenTrim;
    ctx.fillRect(px + 3, py + 4 - floatOffset, 10, 2);
    ctx.fillRect(px + 3, py + 11 - floatOffset, 10, 1);
    ctx.fillRect(px + 4, py + 3 - floatOffset, 2, 1);
    ctx.fillRect(px + 10, py + 3 - floatOffset, 2, 1);
    ctx.fillRect(px + 2, py + 7 - floatOffset, 1, 2);
    ctx.fillRect(px + 13, py + 7 - floatOffset, 1, 2);

    // Eyes and center rune.
    ctx.fillStyle = theme.wardenEye;
    ctx.fillRect(px + 6, py + 7 - floatOffset, 1, 1);
    ctx.fillRect(px + 9, py + 7 - floatOffset, 1, 1);
    ctx.fillRect(px + 7, py + 9 - floatOffset, 2, 1);

    // Ambient arcane sparkles.
    if (pulse > 0.3) {
      ctx.fillStyle = theme.wardenSpark;
      ctx.fillRect(px + 1, py + 5 - floatOffset, 1, 1);
      ctx.fillRect(px + 14, py + 5 - floatOffset, 1, 1);
      ctx.fillRect(px + 2, py + 12 - floatOffset, 1, 1);
      ctx.fillRect(px + 13, py + 12 - floatOffset, 1, 1);
    }
    if (pulse > 0.72) {
      ctx.fillStyle = theme.wardenCrown;
      ctx.fillRect(px + 7, py + 2 - floatOffset, 2, 1);
      ctx.fillRect(px + 7, py + 13 - floatOffset, 2, 1);
    }
  }

  function drawEnemy(enemy) {
    if (enemy.castFlash > 0) {
      const px = visualX(enemy);
      const py = visualY(enemy);
      const theme = getThemeForEnemy(enemy);
      const alpha = clamp(enemy.castFlash / 120, 0, 1);
      ctx.globalAlpha = 0.2 + alpha * 0.5;
      ctx.fillStyle = enemy.type === "warden" ? theme.wardenBolt : "#8bb4ff";
      ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      ctx.globalAlpha = 1;
    }

    if (enemy.type === "skeleton") {
      drawSkeleton(enemy);
    } else if (enemy.type === "brute") {
      drawBrute(enemy);
    } else if (enemy.type === "warden") {
      drawWarden(enemy);
    } else {
      drawSlime(enemy);
    }

    if (enemy.elite) {
      const px = visualX(enemy);
      const py = visualY(enemy);
      ctx.fillStyle = "#ffd77b";
      ctx.fillRect(px + 2, py + 2, 2, 1);
      ctx.fillRect(px + 12, py + 2, 2, 1);
    }

    // Enemy HP bar (always show if Scout's Lens, otherwise show if damaged)
    const showHpBar = hasRelic("scoutlens") || (enemy.hp < (enemy.maxHp || enemy.hp));
    if (showHpBar && enemy.maxHp > 0) {
      const px = visualX(enemy);
      const py = visualY(enemy);
      const barW = 12;
      const barH = 2;
      const barX = px + (TILE - barW) / 2;
      const barY = py + 1;
      const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
      // Background
      ctx.fillStyle = "#1a0505";
      ctx.fillRect(barX, barY, barW, barH);
      // HP fill
      const hpColor = hpRatio > 0.6 ? "#7bd389" : hpRatio > 0.3 ? "#f5ba4c" : "#e26f67";
      ctx.fillStyle = hpColor;
      ctx.fillRect(barX, barY, Math.max(1, Math.round(barW * hpRatio)), barH);
    }

    // Burn indicator
    if ((enemy.burnTurns || 0) > 0) {
      const px = visualX(enemy);
      const py = visualY(enemy);
      ctx.fillStyle = "#ff6a35";
      ctx.fillRect(px + 1, py + 14, 1, 1);
      ctx.fillRect(px + 14, py + 14, 1, 1);
    }

    // Frost Amulet indicator
    if (enemy.frozenThisTurn || (enemy.frostFx || 0) > 0) {
      const px = visualX(enemy);
      const py = visualY(enemy);
      const pulse = (Math.sin(state.portalPulse * 3.2 + enemy.x * 0.9 + enemy.y * 1.1) + 1) * 0.5;
      const fxRatio = clamp((enemy.frostFx || 0) / 820, 0, 1);
      const alpha = clamp((enemy.frozenThisTurn ? 0.55 : 0.2) + fxRatio * 0.38 + pulse * 0.1, 0.2, 0.92);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#9fd7ff";
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = "#d7efff";
      ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
      ctx.fillStyle = "#f3fbff";
      ctx.fillRect(px + 7, py + 11, 2, 1);
      ctx.fillRect(px + 7, py + 13, 2, 1);
      ctx.fillRect(px + 6, py + 12, 1, 1);
      ctx.fillRect(px + 9, py + 12, 1, 1);
      ctx.globalAlpha = 1;
    }
  }

  function drawAimingLines() {
    for (const enemy of state.enemies) {
      if (!enemy.aiming) continue;
      const fromX = visualX(enemy) + TILE / 2;
      const fromY = visualY(enemy) + TILE / 2;
      const toX = visualX(state.player) + TILE / 2;
      const toY = visualY(state.player) + TILE / 2;
      const pulse = (Math.sin(state.portalPulse * 3.5) + 1) * 0.5;

      ctx.globalAlpha = 0.25 + pulse * 0.45;
      ctx.strokeStyle = "#8bb4ff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "#d9e8ff";
      ctx.strokeRect(toX - 3, toY - 3, 6, 6);
      ctx.globalAlpha = 1;
    }
  }

  function drawDashAimArrow(centerX, centerY, dx, dy, alpha) {
    const upPattern = [
      [0, -3], [0, -2],
      [-1, -1], [0, -1], [1, -1],
      [0, 0], [0, 1]
    ];

    const rotateOffset = (ox, oy) => {
      if (dx === 0 && dy === -1) return { x: ox, y: oy }; // up
      if (dx === 0 && dy === 1) return { x: ox, y: -oy }; // down
      if (dx === 1 && dy === 0) return { x: -oy, y: ox }; // right
      return { x: oy, y: -ox }; // left
    };

    ctx.globalAlpha = Math.max(0.1, alpha * 0.35);
    ctx.fillStyle = "#0a1018";
    ctx.fillRect(centerX - 4, centerY - 4, 8, 8);

    ctx.globalAlpha = Math.max(0.2, alpha * 0.5);
    ctx.fillStyle = "#8fd9ff";
    for (const [ox, oy] of upPattern) {
      const point = rotateOffset(ox, oy);
      ctx.fillRect(centerX + point.x, centerY + point.y, 1, 1);
    }

    ctx.globalAlpha = Math.max(0.2, alpha * 0.7);
    ctx.fillStyle = "#e5f6ff";
    const tip = rotateOffset(0, -3);
    ctx.fillRect(centerX + tip.x, centerY + tip.y, 1, 1);
    ctx.globalAlpha = 1;
  }

  function drawDashAimArrows() {
    if (state.phase !== "playing" || !state.dashAimActive) return;
    const cx = visualX(state.player) + TILE / 2;
    const cy = visualY(state.player) + TILE / 2;
    const pulse = (Math.sin(state.portalPulse * 4.8) + 1) * 0.5;
    const alpha = 0.5 + pulse * 0.45;
    const offset = 11;

    ctx.globalAlpha = 0.1 + pulse * 0.15;
    ctx.strokeStyle = "#9fdcff";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 6, cy - 6, 12, 12);
    ctx.globalAlpha = 1;

    drawDashAimArrow(cx, cy - offset, 0, -1, alpha);
    drawDashAimArrow(cx, cy + offset, 0, 1, alpha);
    drawDashAimArrow(cx - offset, cy, -1, 0, alpha);
    drawDashAimArrow(cx + offset, cy, 1, 0, alpha);
  }

  function drawPlayerFallback(px, py) {
    const color = state.flash > 0 ? COLORS.playerHit : COLORS.player;
    ctx.fillStyle = color;
    ctx.fillRect(px + 5, py + 4, 6, 8);
    ctx.fillStyle = COLORS.playerCape;
    ctx.fillRect(px + 6, py + 10, 4, 3);
    ctx.fillStyle = "#1a1d23";
    ctx.fillRect(px + 6, py + 6, 1, 1);
    ctx.fillRect(px + 9, py + 6, 1, 1);
  }

  function getFacingFromDelta(dx, dy, fallback = "south") {
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) return "east";
      if (dx < 0) return "west";
      return fallback;
    }
    if (Math.abs(dy) > 0) {
      return dy > 0 ? "south" : "north";
    }
    return fallback;
  }

  function getPlayerFacing() {
    const dx = state.player.lastMoveX || 0;
    const dy = state.player.lastMoveY || 0;
    return getFacingFromDelta(dx, dy, "south");
  }

  function drawPlayerSprite(px, py) {
    const facing = getPlayerFacing();
    const spriteSet = playerSprites[facing];
    if (!spriteSet || spriteSet.readyCount <= 0) return false;
    const clip = PLAYER_SPRITE_CLIPS[facing] || { x: 0, y: 0, w: 56, h: 56 };
    const frameIndex = Math.floor(state.playerAnimTimer / 180) % spriteSet.frames.length;
    const img = spriteSet.frames[frameIndex] || spriteSet.frames.find(Boolean);
    if (!img) return false;

    const drawH = 16;
    const drawW = Math.max(8, Math.round((drawH * clip.w) / clip.h));
    const drawX = Math.round(px + (TILE - drawW) / 2);
    const drawY = Math.round(py + TILE - drawH);
    ctx.drawImage(img, clip.x, clip.y, clip.w, clip.h, drawX, drawY, drawW, drawH);

    if (state.flash > 0) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = COLORS.playerHit;
      ctx.fillRect(drawX + 1, drawY + 1, drawW - 2, drawH - 2);
      ctx.globalAlpha = 1;
    }
    return true;
  }

  function drawPlayer() {
    const px = visualX(state.player);
    const py = visualY(state.player);
    if (!drawPlayerSprite(px, py)) {
      drawPlayerFallback(px, py);
    }

    const effectiveFury = getEffectiveAdrenaline();
    if (effectiveFury > 0) {
      const sparks = [
        [2, 2],
        [13, 4],
        [2, 11],
        [13, 11],
        [7, 1],
        [8, 13]
      ];
      ctx.fillStyle = getFuryBlessingBonus() > 0 ? "#ffd66f" : "#f7bf5a";
      const sparkCount = Math.min(effectiveFury, sparks.length);
      for (let i = 0; i < sparkCount; i += 1) {
        const [sx, sy] = sparks[i];
        ctx.fillRect(px + sx, py + sy, 1, 1);
      }
    }
  }

  function drawShieldAura() {
    if (!isShieldActive()) return;
    const px = visualX(state.player);
    const py = visualY(state.player);
    const pulse = (Math.sin(state.portalPulse * 4.2) + 1) * 0.5;

    ctx.globalAlpha = 0.25 + pulse * 0.3;
    ctx.fillStyle = "#9ecbff";
    ctx.fillRect(px + 1, py + 1, 14, 1);
    ctx.fillRect(px + 1, py + 14, 14, 1);
    ctx.fillRect(px + 1, py + 1, 1, 14);
    ctx.fillRect(px + 14, py + 1, 1, 14);

    if (pulse > 0.45) {
      ctx.globalAlpha = 0.45 + pulse * 0.35;
      ctx.fillStyle = "#d9ecff";
      ctx.fillRect(px, py + 4, 1, 1);
      ctx.fillRect(px + 15, py + 4, 1, 1);
      ctx.fillRect(px, py + 11, 1, 1);
      ctx.fillRect(px + 15, py + 11, 1, 1);
      ctx.fillRect(px + 4, py, 1, 1);
      ctx.fillRect(px + 11, py, 1, 1);
      ctx.fillRect(px + 4, py + 15, 1, 1);
      ctx.fillRect(px + 11, py + 15, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    for (const particle of state.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawRangedBolts() {
    for (const bolt of state.rangedBolts) {
      const headX = bolt.fromX + (bolt.toX - bolt.fromX) * bolt.progress;
      const headY = bolt.fromY + (bolt.toY - bolt.fromY) * bolt.progress;
      const fade = clamp(bolt.life / bolt.maxLife, 0, 1);
      const tailT = clamp(bolt.progress - 0.22, 0, 1);
      const tailX = bolt.fromX + (bolt.toX - bolt.fromX) * tailT;
      const tailY = bolt.fromY + (bolt.toY - bolt.fromY) * tailT;

      ctx.globalAlpha = 0.25 + fade * 0.75;
      ctx.strokeStyle = bolt.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(headX - 1.5, headY - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawDashTrails() {
    for (const trail of state.dashTrails) {
      const fade = clamp(trail.life / trail.maxLife, 0, 1);
      ctx.globalAlpha = 0.1 + fade * 0.55;
      ctx.strokeStyle = trail.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(trail.fromX, trail.fromY);
      ctx.lineTo(trail.toX, trail.toY);
      ctx.stroke();

      ctx.globalAlpha = 0.08 + fade * 0.4;
      ctx.fillStyle = "#d9f4ff";
      ctx.fillRect(trail.toX - 1, trail.toY - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  function drawRangedImpacts() {
    for (const impact of state.rangedImpacts) {
      const fade = clamp(impact.life / impact.maxLife, 0, 1);
      ctx.globalAlpha = 0.15 + fade * 0.5;
      ctx.strokeStyle = impact.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, impact.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.1 + fade * 0.35;
      ctx.fillStyle = impact.color;
      ctx.fillRect(impact.x - 2, impact.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawShockwaveRings() {
    for (const ring of state.shockwaveRings) {
      const fade = clamp(ring.life / ring.maxLife, 0, 1);
      const pulse = 1 - fade;

      ctx.globalAlpha = 0.08 + fade * 0.24;
      ctx.fillStyle = ring.core;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.25 + fade * 0.65;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1.2 + pulse * 1.1;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.12 + fade * 0.35;
      ctx.strokeStyle = "#fff3d9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, Math.max(1, ring.radius - 2.4), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  function drawFrontBackdrop() {
    ctx.fillStyle = "#06080d";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  function getLowHpWarningIntensity() {
    if (state.phase !== "playing") return 0;
    const hp = Math.max(0, state.player.hp);
    if (hp <= 0 || hp > LOW_HP_THRESHOLD) return 0;
    if (hp <= LOW_HP_CRITICAL_THRESHOLD) return 1;
    if (hp <= scaledCombat(3)) return 0.75;
    return 0.5; // HP 40
  }

  function drawLowHpWarning() {
    const intensity = getLowHpWarningIntensity();
    if (intensity <= 0) return;

    const pulse = (Math.sin(state.portalPulse * 4.3) + 1) * 0.5;
    const edgeThickness = 7 + Math.round(intensity * 3);
    const edgeAlpha = 0.08 + intensity * (0.12 + pulse * 0.2);
    const glowAlpha = 0.03 + intensity * (0.08 + pulse * 0.14);

    // Pulse tint over the whole board.
    ctx.globalAlpha = glowAlpha;
    ctx.fillStyle = "#8f1f1f";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Stronger red vignette from edges.
    ctx.globalAlpha = edgeAlpha;
    ctx.fillStyle = "#a42525";
    ctx.fillRect(0, 0, CANVAS_SIZE, edgeThickness);
    ctx.fillRect(0, CANVAS_SIZE - edgeThickness, CANVAS_SIZE, edgeThickness);
    ctx.fillRect(0, 0, edgeThickness, CANVAS_SIZE);
    ctx.fillRect(CANVAS_SIZE - edgeThickness, 0, edgeThickness, CANVAS_SIZE);

    // Corner pressure makes the warning feel less flat.
    ctx.globalAlpha = edgeAlpha * 0.9;
    ctx.fillRect(0, 0, edgeThickness + 4, edgeThickness + 4);
    ctx.fillRect(CANVAS_SIZE - edgeThickness - 4, 0, edgeThickness + 4, edgeThickness + 4);
    ctx.fillRect(0, CANVAS_SIZE - edgeThickness - 4, edgeThickness + 4, edgeThickness + 4);
    ctx.fillRect(
      CANVAS_SIZE - edgeThickness - 4,
      CANVAS_SIZE - edgeThickness - 4,
      edgeThickness + 4,
      edgeThickness + 4
    );

    // Center warning flash synced with the pulse.
    ctx.globalAlpha = intensity * (0.04 + pulse * 0.09);
    ctx.fillStyle = "#ff8c8c";
    const centerSize = 18 + Math.round(10 * pulse);
    const centerX = Math.floor(CANVAS_SIZE / 2 - centerSize / 2);
    const centerY = Math.floor(CANVAS_SIZE / 2 - centerSize / 2);
    ctx.fillRect(centerX, centerY, centerSize, centerSize);

    ctx.globalAlpha = 1;
  }

  function updateRoomIntroOverlay() {
    if (!roomIntroOverlayEl) return;
    const shouldShow = state.phase === "playing" && state.roomIntroTimer > 0;
    if (!shouldShow) {
      roomIntroOverlayEl.classList.remove("visible", "boss");
      roomIntroOverlayEl.style.removeProperty("--room-intro-alpha");
      return;
    }

    if (!roomIntroOverlayEl.dataset.ready) {
      roomIntroOverlayEl.innerHTML = [
        `<div class="room-intro-card">`,
        `<p class="room-intro-title"></p>`,
        `<p class="room-intro-subtitle"></p>`,
        `</div>`
      ].join("");
      roomIntroOverlayEl.dataset.ready = "1";
    }

    const duration = Math.max(1, state.roomIntroDuration || 760);
    const remaining = clamp(state.roomIntroTimer / duration, 0, 1);
    const progress = 1 - remaining;
    const fadeIn = clamp(progress / 0.22, 0, 1);
    const fadeOut = clamp(remaining / 0.28, 0, 1);
    const alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0) {
      roomIntroOverlayEl.classList.remove("visible", "boss");
      return;
    }

    const titleEl = roomIntroOverlayEl.querySelector(".room-intro-title");
    const subtitleEl = roomIntroOverlayEl.querySelector(".room-intro-subtitle");
    if (titleEl) {
      titleEl.textContent = state.roomIntroTitle || `DEPTH ${state.depth}`;
    }
    if (subtitleEl) {
      subtitleEl.textContent = state.roomIntroSubtitle || "";
    }

    roomIntroOverlayEl.style.setProperty("--room-intro-alpha", alpha.toFixed(3));
    roomIntroOverlayEl.classList.add("visible");
    roomIntroOverlayEl.classList.toggle("boss", state.bossRoom);
  }

  function drawOverlay() {
    if (state.phase === "playing") return;

    if (state.phase === "boot") {
      return;
    }

    if (state.phase === "menu") {
      drawFrontBackdrop();
      return;
    }

    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  function updateEffects(dt) {
    state.portalPulse += dt * 0.014;
    state.playerAnimTimer = (state.playerAnimTimer + dt) % 100000;
    if (state.flash > 0) {
      state.flash = Math.max(0, state.flash - dt);
    }
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 0.015);
    }
    if (state.phase === "playing" && state.roomIntroTimer > 0) {
      state.roomIntroTimer = Math.max(0, state.roomIntroTimer - dt);
    }

    if (state.particles.length > 0) {
      for (const particle of state.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 0.0008 * dt;
        particle.life -= dt;
      }
      state.particles = state.particles.filter((particle) => particle.life > 0);
    }

    if (state.rangedBolts.length > 0) {
      for (const bolt of state.rangedBolts) {
        bolt.progress = Math.min(1, bolt.progress + dt * bolt.speed);
        bolt.life -= dt;
      }
      state.rangedBolts = state.rangedBolts.filter((bolt) => bolt.life > 0);
    }

    if (state.dashTrails.length > 0) {
      for (const trail of state.dashTrails) {
        trail.life -= dt;
      }
      state.dashTrails = state.dashTrails.filter((trail) => trail.life > 0);
    }

    if (state.rangedImpacts.length > 0) {
      for (const impact of state.rangedImpacts) {
        impact.radius += dt * 0.016;
        impact.life -= dt;
      }
      state.rangedImpacts = state.rangedImpacts.filter((impact) => impact.life > 0);
    }

    if (state.shockwaveRings.length > 0) {
      for (const ring of state.shockwaveRings) {
        ring.radius = Math.min(ring.maxRadius, ring.radius + dt * 0.11);
        ring.life -= dt;
      }
      state.shockwaveRings = state.shockwaveRings.filter((ring) => ring.life > 0);
    }

    updateTweens(dt);
    for (const enemy of state.enemies) {
      if (enemy.castFlash > 0) {
        enemy.castFlash = Math.max(0, enemy.castFlash - dt);
      }
      if ((enemy.frostFx || 0) > 0) {
        enemy.frostFx = Math.max(0, enemy.frostFx - dt);
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.save();
    if (state.shake > 0) {
      const intensity = Math.ceil(state.shake);
      const ox = randInt(-intensity, intensity);
      const oy = randInt(-intensity, intensity);
      ctx.translate(ox, oy);
    }

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        drawFloorTile(x, y);
      }
    }

    for (const spike of state.spikes) {
      drawSpikes(spike);
    }
    drawShrine();
    drawMerchant();
    drawPortal();
    for (const chest of state.chests) {
      drawChest(chest);
    }
    for (const enemy of state.enemies) {
      drawEnemy(enemy);
    }
    drawAimingLines();
    drawRangedBolts();
    drawDashTrails();
    drawRangedImpacts();
    drawShockwaveRings();
    drawShieldAura();
    drawPlayer();
    drawDashAimArrows();
    drawParticles();
    drawLowHpWarning();
    drawOverlay();
    ctx.restore();
  }

  function getDirectionFromKey(key) {
    if (key === "arrowup" || key === "w") return { dx: 0, dy: -1 };
    if (key === "arrowdown" || key === "s") return { dx: 0, dy: 1 };
    if (key === "arrowleft" || key === "a") return { dx: -1, dy: 0 };
    if (key === "arrowright" || key === "d") return { dx: 1, dy: 0 };
    return null;
  }

  function handleMovementKey(key) {
    const dir = getDirectionFromKey(key);
    if (!dir) return false;
    tryMove(dir.dx, dir.dy);
    return true;
  }

  function getCampUpgradeIndexFromKey(key) {
    if (key === "0") return 9;
    if (key >= "1" && key <= "9") return Number(key) - 1;
    return -1;
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const isConfirm = key === "enter" || key === " " || key === "spacebar";
    const isNameInputTarget = state.nameModalOpen && event.target && event.target.id === "nameInput";
    const allowNameTyping = isNameInputTarget && key !== "enter" && key !== "escape";
    const isControl =
      key === "arrowup" ||
      key === "arrowdown" ||
      key === "arrowleft" ||
      key === "arrowright" ||
      key === "w" ||
      key === "a" ||
      key === "s" ||
      key === "d" ||
      key === "f" ||
      key === "e" ||
      key === "q" ||
      key === "r" ||
      key === "z" ||
      key === "x" ||
      key === "c" ||
      key === "m" ||
      key === DEBUG_MENU_TOGGLE_KEY ||
      key === "escape" ||
      key === "enter" ||
      key === " " ||
      key === "1" ||
      key === "2" ||
      key === "3" ||
      key === "4" ||
      key === "5" ||
      key === "6" ||
      key === "7" ||
      key === "8" ||
      key === "9" ||
      key === "0" ||
      key === "y" ||
      key === "n" ||
      key === "t" ||
      key === "tab";
    if (!allowNameTyping && (isControl || state.phase === "boot" || state.phase === "splash" || state.phase === "menu")) {
      event.preventDefault();
      ensureAudio();
      if (state.phase !== "splash") {
        syncBgmWithState(true);
      }
    }
    if (event.repeat) return;

    if (key === "m") {
      toggleAudio();
      return;
    }

    if (canUseDebugCheats() && key === DEBUG_MENU_TOGGLE_KEY) {
      toggleDebugCheatMenu();
      return;
    }

    if (canUseDebugCheats() && state.debugCheatOpen) {
      if (key === "escape") {
        toggleDebugCheatMenu(false);
        return;
      }
      if (triggerDebugCheatHotkey(key)) {
        return;
      }
      return;
    }

    if (state.nameModalOpen) {
      if (key === "escape") {
        closeNameModal();
        return;
      }
      if (key === "enter") {
        submitNameModal();
        return;
      }
      return;
    }

    if (state.leaderboardModalOpen && state.phase === "menu") {
      if (key === "t" || key === "tab") {
        toggleLeaderboardSortMode();
        return;
      }
      if (key === "v") {
        toggleLeaderboardScope();
        return;
      }
      if (key === "arrowleft") {
        state.leaderboardSortMode = "score";
        if (isOnlineLeaderboardEnabled()) {
          refreshOnlineLeaderboard(true);
        }
        markUiDirty();
        return;
      }
      if (key === "arrowright") {
        state.leaderboardSortMode = "depth";
        if (isOnlineLeaderboardEnabled()) {
          refreshOnlineLeaderboard(true);
        }
        markUiDirty();
        return;
      }
      if (key === "escape" || isConfirm) {
        closeLeaderboardModal();
        return;
      }
      return;
    }

    if (state.phase === "playing" && state.dashAimActive && key === "escape") {
      cancelDashAim();
      return;
    }

    if (state.phase === "playing" && state.extractConfirm) {
      if (isConfirm || key === "y") {
        confirmEmergencyExtract();
        return;
      }
      if (key === "escape" || key === "n" || key === "q") {
        cancelEmergencyExtractConfirm();
        return;
      }
      return;
    }

    if (state.phase === "camp" && state.extractRelicPrompt) {
      if (isConfirm || key === "y") {
        resolveExtractRelicPrompt(true);
        return;
      }
      if (key === "escape" || key === "n") {
        resolveExtractRelicPrompt(false);
        return;
      }
      return;
    }

    if (state.phase === "dead" && state.finalGameOverPrompt) {
      if (key === "2") {
        enterMenu();
        openLeaderboardModal();
        return;
      }
      if (key === "1" || key === "escape" || isConfirm) {
        enterMenu();
        return;
      }
      return;
    }

    if (state.phase === "playing" && state.merchantMenuOpen) {
      if (state.roomType !== "merchant" || !isOnMerchant()) {
        closeMerchantMenu();
        return;
      }
      if (key === "escape" || key === "e") {
        closeMerchantMenu();
        return;
      }
      if (key === "1") {
        tryBuyPotionFromMerchant();
        return;
      }
      if (key === "2") {
        tryBuySkillUpgradeFromMerchant("dash");
        return;
      }
      if (key === "3") {
        tryBuySkillUpgradeFromMerchant("aoe");
        return;
      }
      if (key === "4") {
        tryBuySkillUpgradeFromMerchant("shield");
        return;
      }
      return;
    }

    if (key === "escape") {
      if (state.phase === "playing" || state.phase === "relic" || state.phase === "camp") {
        saveRunSnapshot();
        enterMenu();
        return;
      }
      if (state.phase === "dead") {
        enterMenu();
        return;
      }
    }

    if (state.phase === "boot") {
      enterSplash();
      return;
    }

    if (state.phase === "splash") {
      enterMenu();
      return;
    }

    if (state.phase === "menu") {
      if (key === "arrowup" || key === "w") {
        moveMenuSelection(-1);
        return;
      }
      if (key === "arrowdown" || key === "s") {
        moveMenuSelection(1);
        return;
      }
      if (isConfirm || key === "e") {
        activateMenuOption();
        return;
      }
      if (key >= "1" && key <= "9") {
        const optionIndex = Number(key) - 1;
        const options = getMenuOptions();
        if (optionIndex >= 0 && optionIndex < options.length) {
          activateMenuOption(optionIndex);
          return;
        }
      }
      if (key === "r") {
        activateMenuOption(0);
      }
      return;
    }

    if (key === "r") {
      if (state.phase === "camp" || state.phase === "dead") {
        if (state.phase === "camp") {
          startRun({ carriedRelics: [...state.relics] });
        } else {
          startRun();
        }
      } else if (state.phase === "playing" || state.phase === "relic") {
        pushLog("Restart disabled during a run. Use Esc -> menu if needed.", "bad");
      }
      return;
    }

    // [T] toggles camp panel between shop and mutators
    if (key === "t" && state.phase === "camp") {
      state.campPanelView = state.campPanelView === "shop" ? "mutators" : "shop";
      markUiDirty();
      return;
    }

    if (state.phase === "camp") {
      if (state.campPanelView === "mutators") {
        // In mutator view, number keys toggle mutators
        const mutIndex = key === "0" ? 9 : (key >= "1" && key <= "9" ? Number(key) - 1 : -1);
        if (mutIndex >= 0) {
          toggleMutator(mutIndex);
          return;
        }
      } else {
        const campUpgradeIndex = getCampUpgradeIndexFromKey(key);
        if (campUpgradeIndex >= 0) {
          buyCampUpgrade(campUpgradeIndex);
          return;
        }
      }
    }

    if ((key >= "1" && key <= "9") || key === "0") {
      const index = key === "0" ? 9 : Number(key) - 1;
      if (state.phase === "relic") {
        chooseRelic(index);
      } else if (state.phase === "dead") {
        toggleMutator(index);
      } else if (state.phase === "playing") {
        pushLog("Mutators can be changed in camp or menu.");
      }
      return;
    }

    if (state.phase !== "playing") return;

    if (state.dashAimActive) {
      const dashDir = getDirectionFromKey(key);
      if (dashDir) {
        tryUseDashSkill(dashDir.dx, dashDir.dy);
        return;
      }
      if (key === "z") {
        cancelDashAim();
        return;
      }
      pushLog("Dash armed: choose direction (WASD/Arrows) or Esc.", "bad");
      return;
    }

    if (tryUseSkillByKey(key)) {
      return;
    }

    if (key === "f") {
      drinkPotion();
      return;
    }
    if (key === "e") {
      if (state.roomType === "merchant" && isOnMerchant()) {
        if (state.merchantMenuOpen) {
          closeMerchantMenu();
        } else {
          openMerchantMenu();
        }
        return;
      }
      attemptDescend();
      return;
    }
    if (key === "q") {
      if (isOnPortal() && state.roomCleared) {
        extractRun();
      } else {
        openEmergencyExtractConfirm();
      }
      return;
    }

    handleMovementKey(key);
  });

  window.addEventListener("pointerdown", () => {
    ensureAudio();
    if (state.nameModalOpen) {
      const input = document.getElementById("nameInput");
      if (input) input.focus();
      return;
    }
    if (state.leaderboardModalOpen && state.phase === "menu") {
      return;
    }
    if (state.phase === "boot") {
      enterSplash();
      return;
    }
    if (state.phase === "splash") {
      enterMenu();
      return;
    }
    if (state.phase === "menu") {
      activateMenuOption();
      return;
    }
    syncBgmWithState(true);
  });

  if (screenOverlayEl) {
    screenOverlayEl.addEventListener("input", (event) => {
      const target = event.target;
      if (!target || target.id !== "nameInput") return;
      const cleaned = sanitizePlayerName(target.value);
      if (target.value !== cleaned) {
        target.value = cleaned;
      }
      state.nameDraft = cleaned;
    });
  }

  canvas.addEventListener("pointermove", (event) => {
    if (state.phase !== "playing") { hoveredEnemy = null; return; }
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    const cx = (event.clientX - rect.left) * scaleX;
    const cy = (event.clientY - rect.top) * scaleY;
    const tileX = Math.floor(cx / TILE);
    const tileY = Math.floor(cy / TILE);
    const enemy = getEnemyAt(tileX, tileY);
    if (enemy !== hoveredEnemy) {
      hoveredEnemy = enemy;
      markUiDirty();
    }
  });

  canvas.addEventListener("pointerleave", () => {
    if (hoveredEnemy) { hoveredEnemy = null; markUiDirty(); }
  });

  window.addEventListener("resize", updateCanvasScale);

  let previous = performance.now();
  function frame(now) {
    const dt = Math.min(32, now - previous);
    previous = now;
    updateEffects(dt);
    updateRoomIntroOverlay();
    updateUi();
    render();
    requestAnimationFrame(frame);
  }

  syncMutatorUnlocks();
  state.hasContinueRun = Boolean(localStorage.getItem(STORAGE_RUN_SAVE));
  state.phase = "boot";
  state.log = [];
  loadChestSprite();
  loadPortalSprite();
  loadSpikeSprite();
  loadTilesetSprite();
  loadPlayerSprites();
  loadSlimeSprites();
  loadSkeletonSprites();
  loadBruteSprites();
  updateCanvasScale();
  syncBgmWithState();
  markUiDirty();
  requestAnimationFrame(frame);
})();



