(() => {
  function normalizeSeasonId(value, fallback = "season-1") {
    const cleaned = String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 32);
    return cleaned || fallback;
  }

  function readGlobalFlag(name, fallback = false) {
    if (typeof window === "undefined") return Boolean(fallback);
    const raw = window[name];
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
    if (typeof raw === "string") {
      const normalized = raw.trim().toLowerCase();
      if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
      if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
    }
    return Boolean(fallback);
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
  const STORAGE_DEBUG_AI_OVERLAY = "dungeonOneRoomDebugAiOverlay";
  const STORAGE_ENEMY_SPEED = "dungeonOneRoomEnemySpeed";
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
  const STORAGE_WARDEN_FIRST_DROP_DEPTHS = "dungeonOneRoomWardenFirstDropDepths";
  const STORAGE_START_DEPTH_UNLOCKS = "dungeonOneRoomStartDepthUnlocksV1";
  const STORAGE_OBSERVER_AI_MODEL = "dungeonOneRoomObserverAiModelV2";
  const STORAGE_MOBILE_SWIPE_HINT_SEEN = "dungeonOneRoomMobileSwipeHintSeenV1";
  const GAME_VERSION = (() => {
    const raw = typeof window !== "undefined" ? window.GAME_VERSION : "";
    const normalized = typeof raw === "string" ? raw.trim() : "";
    return normalized || "dev";
  })();
  const MAX_DEPTH = 100;
  const START_DEPTH_CHECKPOINTS = Object.freeze([11, 21, 31, 41]);
  const START_DEPTH_UNLOCK_BOSS_DEPTHS = Object.freeze([10, 20, 30, 40]);
  const MAX_LIVES = 5;
  const MAX_RELICS = 8;
  const MAX_NORMAL_RELIC_STACK = 5;
  const LEADERBOARD_LIMIT = 25;
  const LEADERBOARD_MODAL_LIMIT = 20;
  const LEADERBOARD_PENDING_LIMIT = 200;
  const LEGENDARY_SKILL_TIER = 3;
  const LEGENDARY_SKILL_MIN_DEPTH = 20;
  const LEGENDARY_SKILL_REQUIRED_BOSS_DEPTH = 20;
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
  const BLADE_ATTACK_FLAT_PER_LEVEL = 1 * COMBAT_SCALE; // +10
  const BLADE_ATTACK_PERCENT_PER_LEVEL = 0.10; // +10% per blade level
  const CHEST_ATTACK_UPGRADE_FLAT = 2;
  const CHEST_ARMOR_UPGRADE_FLAT = 2;
  const CHEST_HEALTH_UPGRADE_FLAT = 5;
  const CHEST_UPGRADE_TIER_TWO_MIN_DEPTH = 11;
  const CHEST_UPGRADE_TIER_THREE_MIN_DEPTH = 21;
  const CHEST_UPGRADE_TIER_TWO_MULT = 1.2;
  const CHEST_UPGRADE_TIER_THREE_MULT = 1.35;
  const CHEST_HEALING_DROP_AMOUNT = 4 * COMBAT_SCALE; // 40 HP
  const CHEST_ATTACK_BUCKET_SIZE = 10;
  const CHEST_ATTACK_BUCKET_MAX = 5;
  const SPIKE_DAMAGE_BASE = Math.round(1.5 * COMBAT_SCALE); // 15
  const SPIKE_DAMAGE_STEP_DEPTH = 10;
  const SPIKE_DAMAGE_PER_STEP = Math.round(1.5 * COMBAT_SCALE); // +15 each step
  const SHRINE_BLESSING_MIN_TURNS = 100;
  const SHRINE_BLESSING_MAX_TURNS = 200;
  const SHRINE_BLESSING_DEPTH_SCALE_TIER_ONE = 20;
  const SHRINE_BLESSING_DEPTH_SCALE_TIER_TWO = 30;
  const SHRINE_MAX_HP_BLESSING_DEPTH_SCALE_TIER_ONE = 11;
  const SHRINE_MAX_HP_BLESSING_DEPTH_SCALE_TIER_TWO = 21;
  const SHRINE_SWAPPING_INTERVAL_TURNS = 15;
  const SHRINE_HUNGER_HEAL_PER_HIT = 5;
  const SHRINE_HUNGER_MISS_DAMAGE = 1;
  const ENEMY_LATE_SCALE_START_DEPTH = 20;
  const ENEMY_LATE_SCALE_STEP_DEPTH = 10;
  const ENEMY_LATE_SCALE_PER_STEP = 0.2;
  const ACOLYTE_SUPPORT_RANGE = 4;
  const ACOLYTE_HEAL_MIN_MISSING_HP_RATIO = 0.15;
  const ACOLYTE_HEAL_HP_RATIO_PRIORITY = 0.65;
  const ACOLYTE_SUPPORT_HEAL_MULT = 0.3;
  const ACOLYTE_SUPPORT_BUFF_ATTACK_MULT = 0.3;
  const ACOLYTE_SUPPORT_BUFF_TURNS = 3;
  const ACOLYTE_SUPPORT_HEAL_CAST_COOLDOWN = 4;
  const ACOLYTE_SUPPORT_BUFF_CAST_COOLDOWN = 4;
  const ACOLYTE_ATTACK_CAST_COOLDOWN = 4;
  const ACOLYTE_ATTACK_DAMAGE_MULT = 0.7;
  const ACOLYTE_SUPPORT_CANCEL_COOLDOWN = 2;
  const MAX_ACOLYTES_PER_ROOM = 2;
  const SKELETON_MELEE_DAMAGE_MULTIPLIER = 0.7;
  const GOLDEN_IDOL_GOLD_MULTIPLIER = 0.15;
  const THORNMAIL_REFLECT_MULTIPLIER = 0.2;
  const VAMPFANG_LIFESTEAL_MULTIPLIER = 0.1;
  const VAMPFANG_MAX_HEAL_PER_HIT = 2 * COMBAT_SCALE;
  const ENGINE_OF_WAR_TRIGGER_HP_RATIO = 0.3;
  const ENGINE_OF_WAR_SHIELD_BONUS = 10 * COMBAT_SCALE;
  const ENGINE_OF_WAR_DAMAGE_MULTIPLIER = 1.3;
  const ENGINE_OF_WAR_LIFESTEAL_MULTIPLIER = 0.2;
  const ENGINE_OF_WAR_TURNS = 3;
  const STORM_SIGIL_HIT_INTERVAL = 10;
  const STORM_SIGIL_BONUS_DAMAGE = 3 * COMBAT_SCALE;
  const GRAVE_WHISPER_ATK_PER_KILL = Math.max(1, Math.round(0.5 * COMBAT_SCALE));
  const GRAVE_WHISPER_ATK_CAP = Math.max(GRAVE_WHISPER_ATK_PER_KILL, Math.round(2.5 * COMBAT_SCALE));
  const FIELD_RATIONS_DEPTH_HEAL = 2 * COMBAT_SCALE;
  const QUICKLOADER_ATK_BONUS = 1 * COMBAT_SCALE;
  const QUICKLOADER_ATK_TURNS = 3;
  const FURY_ATTACK_POWER_PER_STACK = 0.05;
  const FURY_ATTACK_POWER_MAX_BONUS = 0.3;
  const PHASE_CLOAK_DODGE_COOLDOWN_TURNS = 3;
  const SOUL_HARVEST_KILL_INTERVAL = 30;
  const BURNING_BLADE_DOT_DAMAGE = 3 * COMBAT_SCALE;
  const CHRONO_LOOP_BURST_DAMAGE = 10 * COMBAT_SCALE;
  const CHRONO_LOOP_BURST_RADIUS = 2;
  const VOID_REAPER_CRIT_KILL_GOLD = 10;
  const SHIELD_HP_CAP_MULTIPLIER = 1.5;
  const SHIELD_BASE_HP_MULTIPLIER = 1.0;
  const SHIELD_RARE_HP_MULTIPLIER = 1.25;
  const SHIELD_EPIC_CHARGE_MAX = 2;
  const SHIELD_EPIC_CHARGE_REGEN_TURNS = 20;
  const SHIELD_EPIC_REFLECT_MULTIPLIER = 0.35;
  const SHIELD_LEGENDARY_STORE_MULTIPLIER = 0.25;
  const SHIELD_LEGENDARY_STORE_CAP_MULTIPLIER = 0.8;
  const SHIELD_LEGENDARY_BLAST_RING1_MULTIPLIER = 0.7;
  const SHIELD_LEGENDARY_BLAST_RING2_MULTIPLIER = 0.4;
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
  const ENEMY_SPEED_MODES = ["slow", "standard", "fast"];
  const ONLINE_LEADERBOARD_TIMEOUT_MS = 8000;
  const ONLINE_LEADERBOARD_REFRESH_MS = 12000;
  const LEADERBOARD_MIN_TURNS = 30;
  const ONLINE_RUN_TOKEN_MAX_LEN = 256;
  const ONLINE_FINALIZE_NONCE_MAX_LEN = 256;
  const OBSERVER_AI_MODEL_VERSION = 2;
  const OBSERVER_TRACE_MAX_EVENTS = 12000;
  const OBSERVER_TRACE_TURN_INTERVAL = 6;
  const PLAYER_COMBAT_TRAIL_MAX = 10;
  const OBSERVER_AI_DEFAULT_WEIGHTS = Object.freeze({
    survival: 1.25,
    kill: 1.1,
    progress: 1.0,
    utility: 0.85,
    economy: 1.0,
    lookahead: 0.9,
    spikeAversion: 1.3,
    extractBias: 1.0,
    potionBias: 1.0,
    bossDefense: 1.2
  });
  const TEST_MODE_ENABLED = readGlobalFlag("DUNGEON_TEST_MODE", false);
  const ONLINE_LEADERBOARD_API_BASE = (() => {
    if (TEST_MODE_ENABLED) return "";
    const raw = typeof window !== "undefined" ? window.DUNGEON_LEADERBOARD_API : "";
    const normalized = typeof raw === "string" ? raw.trim() : "";
    return normalized.replace(/\/+$/, "");
  })();
  const ONLINE_LEADERBOARD_SEASON = normalizeSeasonId(
    typeof window !== "undefined" ? window.DUNGEON_LEADERBOARD_SEASON : ""
  );
  const enemyBlackboardApi = typeof window !== "undefined" ? window.DungeonEnemyBlackboard : null;
  const enemyDirector = typeof window !== "undefined" ? window.DungeonEnemyDirector : null;
  const enemyTactics = typeof window !== "undefined" ? window.DungeonEnemyTactics : null;
  const enemyDebugOverlay = typeof window !== "undefined" ? window.DungeonEnemyDebugOverlay : null;
  const relicData = typeof window !== "undefined" ? window.DungeonRelicData : null;
  const relicRuntimeApi = typeof window !== "undefined" ? window.DungeonRelicRuntime : null;
  const campData = typeof window !== "undefined" ? window.DungeonCampData : null;
  const campRuntimeApi = typeof window !== "undefined" ? window.DungeonCampRuntime : null;
  const skillsData = typeof window !== "undefined" ? window.DungeonSkillsData : null;
  const skillsActionsApiFactory = typeof window !== "undefined" ? window.DungeonSkillsActions : null;
  const lootTablesApi = typeof window !== "undefined" ? window.DungeonLootTables : null;
  if (
    !relicData ||
    !relicRuntimeApi ||
    !campData ||
    !campRuntimeApi ||
    !skillsData ||
    !skillsActionsApiFactory ||
    !lootTablesApi
  ) {
    throw new Error("Missing gameplay data modules. Check script order in index.html.");
  }
  const DEBUG_CHEATS_ENABLED = readGlobalFlag("DUNGEON_DEBUG_CHEATS_ENABLED", true);
  const DEBUG_MENU_TOGGLE_KEY = "f9";
  const DEBUG_BOT_MENU_TOGGLE_KEY = "f10";
  const DEBUG_AI_OVERLAY_TOGGLE_KEY = "f8";
  const MUSIC_TRACKS = {
    normal: "assets/Dungeon Descent.mp3",
    deep: "assets/Haunted High Score.mp3",
    camp: "assets/camp.mp3",
    campLastLife: "assets/One light left on the wall,.mp3",
    boss: "assets/Dungeon Descent2.mp3",
    bossDeep: "assets/boss over 20.mp3"
  };
  const SPLASH_TRACK = "assets/Blue glow on my face.mp3";
  const DEATH_TRACK = "assets/death.mp3";
  const VICTORY_TRACK = "assets/DEPTH 100.mp3";
  const FINAL_GAME_OVER_TRACK = "assets/TRY AGAIN.mp3";
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
  const PORTAL_FRAME_MS = 220;
  const PORTAL_DRAW_SCALE = 1.25;
  const MERCHANT_SPRITE_FRAME_PATHS = [
    "assets/sprite/merchant/merchant1.png",
    "assets/sprite/merchant/merchant2.png",
    "assets/sprite/merchant/merchant3.png",
    "assets/sprite/merchant/merchant4.png"
  ];
  const MERCHANT_SPRITE_GIF_PATH = "assets/sprite/merchant/merchant.gif";
  const MERCHANT_SPRITE_VERSION = "20260216_002";
  const MERCHANT_FRAME_MS = 180;
  const MERCHANT_DRAW_SCALE = 1.2;
  const SHRINE_SPRITESHEET_PATH = "assets/sprite/shrine/shrine.png";
  const SHRINE_SPRITESHEET_VERSION = "20260217_001";
  const SHRINE_SPRITESHEET_COLS = 3;
  const SHRINE_SPRITESHEET_ROWS = 3;
  const SHRINE_FRAME_MS = 220;
  const SHRINE_DRAW_SCALE = 1.2;
  const SHIELD_SPRITESHEET_PATH = "assets/sprite/shield/shield.png";
  const SHIELD_SPRITESHEET_VERSION = "20260218_001";
  const SHIELD_SPRITESHEET_COLS = 4;
  const SHIELD_SPRITESHEET_ROWS = 1;
  const SHIELD_FRAME_MS = 140;
  const SHIELD_DRAW_SCALE = 1;
  const SHIELD_DRAW_OPACITY = 0.7;
  const SPIKE_SPRITE_PATH = "assets/sprite/spike.png";
  const SPIKE_SPRITE_VERSION = "20260213_001";
  const SPIKE_DEEP_SPRITE_PATH = "assets/sprite/spike2.png";
  const SPIKE_DEEP_SPRITE_VERSION = "20260219_001";
  const SPIKE_DRAW_SCALE = 1.4;
  const DEEP_THEME_START_DEPTH = 20;
  const TILESET_SPRITE_PATH = "assets/sprite/tileset.png";
  const TILESET_SPRITE_VERSION = "20260213_002";
  const TILESET_DEEP_SPRITE_PATH = "assets/sprite/tileset2.png";
  const TILESET_DEEP_SPRITE_VERSION = "20260219_001";
  const TILESET_TILE_SIZE = 16;
  const TILESET_COLUMNS = 4;
  const TORCH_SPRITESHEET_PATH = "assets/sprite/torch.png";
  const TORCH_SPRITESHEET_VERSION = "20260218_001";
  const TORCH_DEEP_SPRITESHEET_PATH = "assets/sprite/torch2.png";
  const TORCH_DEEP_SPRITESHEET_VERSION = "20260219_001";
  const TORCH_SPRITESHEET_COLS = 3;
  const TORCH_SPRITESHEET_ROWS = 1;
  const TORCH_FRAME_MS = 160;
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
  const WARDEN_SPRITESHEET_PATH = "assets/sprite/warden/spritesheetwarden2.png";
  const WARDEN_SPRITESHEET_VERSION = "20260217_002";
  const WARDEN_SPRITESHEET_COLS = 3;
  const WARDEN_SPRITESHEET_ROWS = 1;
  const WARDEN_FRAME_MS = 220;
  const WARDEN_DRAW_SCALE = 1.2;
  const ACOLYTE_SPRITESHEET_PATH = "assets/sprite/acolyte/acolyte.png";
  const ACOLYTE_SPRITESHEET_VERSION = "20260217_001";
  const ACOLYTE_SPRITESHEET_COLS = 3;
  const ACOLYTE_SPRITESHEET_ROWS = 1;
  const ACOLYTE_FRAME_MS = 220;
  const ACOLYTE_DRAW_SCALE = 1.2;
  const SKITTER_SPRITESHEET_PATH = "assets/sprite/skitter/skitter.png";
  const SKITTER_SPRITESHEET_VERSION = "20260217_001";
  const SKITTER_SPRITESHEET_COLS = 3;
  const SKITTER_SPRITESHEET_ROWS = 1;
  const SKITTER_FRAME_MS = 180;
  const SKITTER_DRAW_SCALE = 1.2;
  const GUARDIAN_SPRITESHEET_PATH = "assets/sprite/vault-guardian/vault-guardian.png";
  const GUARDIAN_SPRITESHEET_VERSION = "20260219_001";
  const GUARDIAN_SPRITESHEET_COLS = 3;
  const GUARDIAN_SPRITESHEET_ROWS = 1;
  const GUARDIAN_FRAME_MS = 180;
  const GUARDIAN_DRAW_SCALE = 1.2;

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
    acolyte: "#9c8dff",
    acolyteTrim: "#4b427f",
    brute: "#cb6d4f",
    bruteTrim: "#6a1f1f",
    skitter: "#f17d7d",
    skitterTrim: "#6b2a2a",
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
    if (enemy?.type === "brute" || enemy?.type === "guardian") return getBruteThemeByDepth(state.depth);
    return ENEMY_THEME_PRESETS.infernal;
  }

  const MUTATORS = [
    {
      id: "berserker", name: "Berserker", key: "1",
      bonus: "+25% ATK", drawback: "-25% Max HP",
      unlockText: "Kill 100 enemies"
    },
    {
      id: "bulwark", name: "Bulwark", key: "2",
      bonus: "+30% Armor", drawback: "-20% ATK",
      unlockText: "Reach depth 8"
    },
    {
      id: "alchemist", name: "Alchemist", key: "3",
      bonus: "+2 potion slots, potions heal +30%", drawback: "Chests don't restore HP",
      unlockText: "Buy 5 potions from merchant"
    },
    {
      id: "greed", name: "Greed", key: "4",
      bonus: "+40% gold", drawback: "+2 enemies/room, enemies +20% HP, shop +25%",
      unlockText: "Earn 1000 gold"
    },
    {
      id: "hunter", name: "Hunter", key: "5",
      bonus: "+20% Crit", drawback: "Enemies deal +25% more damage",
      unlockText: "Kill 10 elites"
    },
    {
      id: "resilience", name: "Resilience", key: "6",
      bonus: "Shield = 20% Max HP on room entry", drawback: "Enemies deal +20% more damage",
      unlockText: "Use shield skill 15 times"
    },
    {
      id: "momentum", name: "Momentum", key: "7",
      bonus: "+1.5% ATK per depth reached (stacks)", drawback: "Enemies deal +15% more damage",
      unlockText: "Reach depth 10"
    },
    {
      id: "famine", name: "Famine", key: "8",
      bonus: "+30% Max HP", drawback: "-50% potion heal, -3 max potion slots",
      unlockText: "Clear 10 rooms without using a potion"
    },
    {
      id: "elitist", name: "Elitist", key: "9",
      bonus: "Elites drop +60% gold", drawback: "+30% elite spawn, elites +25% HP",
      unlockText: "Kill 50 elites"
    },
    {
      id: "ascension", name: "Ascension", key: "0",
      bonus: "+1 relic choice per draft", drawback: "Enemies +3% ATK per 3 depths reached",
      unlockText: "Reach depth 15"
    }
  ];

  const ROOM_TYPE_LABELS = {
    combat: "Combat",
    treasure: "Treasure",
    shrine: "Shrine",
    cursed: "Cursed",
    vault: "Vault",
    merchant: "Merchant",
    boss: "Boss"
  };

  const { CAMP_UPGRADES } = campData;
  const {
    RARITY,
    RELIC_RETURN_VALUE,
    WARDEN_RELIC_DROP_TABLE,
    WARDEN_RELIC_PITY_BONUS_PER_MISS,
    WARDEN_RELIC_HARD_PITY_AFTER_MISSES,
    RELICS
  } = relicData;
  const {
    SKILLS,
    SKILL_BY_ID,
    DEFAULT_SKILL_COOLDOWNS,
    MAX_SKILL_TIER,
    SKILL_TIER_LABELS,
    DEFAULT_SKILL_TIERS,
    MERCHANT_SKILL_UPGRADES
  } = skillsData;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const screenOverlayEl = document.getElementById("screenOverlay");
  const roomIntroOverlayEl = document.getElementById("roomIntroOverlay");
  const depthBadgeEl = document.getElementById("depthBadge");
  const hudEl = document.getElementById("hud");
  const actionsEl = document.getElementById("actions");
  const activeEffectsEl = document.getElementById("activeEffects");
  const skillsBarEl = document.getElementById("skillsBar");
  const mutatorsEl = document.getElementById("mutators");
  const logEl = document.getElementById("log");
  const appVersionEl = document.getElementById("appVersion");
  const bootScreenEl = document.getElementById("bootScreen");
  const gameAppEl = document.getElementById("gameApp");
  const layoutEl = document.getElementById("layout");
  const layoutTrackEl = document.getElementById("layoutTrack");
  const mobileSwipeHintEl = document.getElementById("mobileSwipeHint");
  const mobileMenuButtonEl = document.getElementById("mobileMenuButton");
  const mobileControlsEl = document.getElementById("mobileControls");
  const MOBILE_LAYOUT_MEDIA_QUERY = "(max-width: 920px)";
  const MOBILE_PANE_LEFT = 0;
  const MOBILE_PANE_BOARD = 1;
  const MOBILE_PANE_RIGHT = 2;
  const MOBILE_SWIPE_MIN_DISTANCE = 42;
  const MOBILE_SWIPE_VERTICAL_RATIO_LIMIT = 0.65;
  const MOBILE_SWIPE_HINT_AUTO_HIDE_MS = 5600;
  const mobileLayoutMedia = typeof window.matchMedia === "function"
    ? window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY)
    : null;
  const mobileUi = {
    active: false,
    paneIndex: MOBILE_PANE_BOARD,
    swipePointerId: null,
    swipeStartX: 0,
    swipeStartY: 0,
    swipeLastX: 0,
    swipeLastY: 0,
    buttonPointerIds: new Set(),
    hintSeen: localStorage.getItem(STORAGE_MOBILE_SWIPE_HINT_SEEN) === "1",
    hintVisible: false,
    hintHideTimer: null
  };
  let hoveredEnemy = null;

  if (appVersionEl) {
    appVersionEl.textContent = `Version ${GAME_VERSION}`;
  }
  window.DUNGEON_GAME_VERSION = GAME_VERSION;

  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const chance = (p) => Math.random() < p;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);
  const escapeHtmlAttr = (value) =>
    String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const tileKey = (x, y) => `${x},${y}`;
  const inBounds = (x, y) => x >= 1 && x <= GRID_SIZE - 2 && y >= 1 && y <= GRID_SIZE - 2;
  const manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
  const scaledCombat = (base) => Math.round(base * COMBAT_SCALE);

  function isScreenOverlayVisible() {
    return Boolean(screenOverlayEl && screenOverlayEl.classList.contains("visible"));
  }

  function clearMobileSwipeHintTimer() {
    if (mobileUi.hintHideTimer != null) {
      clearTimeout(mobileUi.hintHideTimer);
      mobileUi.hintHideTimer = null;
    }
  }

  function dismissMobileSwipeHint() {
    clearMobileSwipeHintTimer();
    if (!mobileUi.hintVisible) return false;
    mobileUi.hintVisible = false;
    return true;
  }

  function markMobileSwipeHintSeen() {
    if (mobileUi.hintSeen) return false;
    mobileUi.hintSeen = true;
    setStorageItem(STORAGE_MOBILE_SWIPE_HINT_SEEN, "1");
    return true;
  }

  function shouldOfferMobileSwipeHint() {
    if (!mobileUi.active) return false;
    if (mobileUi.hintSeen) return false;
    if (mobileUi.paneIndex !== MOBILE_PANE_BOARD) return false;
    if (isScreenOverlayVisible()) return false;
    if (state.phase === "boot" || state.phase === "splash" || state.phase === "menu") return false;
    return true;
  }

  function shouldShowMobileSwipeHint() {
    if (!mobileUi.hintVisible) return false;
    if (!mobileUi.active) return false;
    if (mobileUi.paneIndex !== MOBILE_PANE_BOARD) return false;
    if (isScreenOverlayVisible()) return false;
    return true;
  }

  function revealMobileSwipeHint() {
    if (!shouldOfferMobileSwipeHint()) return false;
    markMobileSwipeHintSeen();
    mobileUi.hintVisible = true;
    clearMobileSwipeHintTimer();
    mobileUi.hintHideTimer = setTimeout(() => {
      mobileUi.hintHideTimer = null;
      if (!mobileUi.hintVisible) return;
      mobileUi.hintVisible = false;
      applyMobilePaneUiState();
    }, MOBILE_SWIPE_HINT_AUTO_HIDE_MS);
    return true;
  }

  function shouldShowMobileMenuButton() {
    if (!mobileUi.active) return false;
    if (mobileUi.paneIndex !== MOBILE_PANE_BOARD) return false;
    if (isScreenOverlayVisible()) return false;
    if (state.phase === "boot" || state.phase === "splash" || state.phase === "menu") return false;
    return true;
  }

  function applyMobilePaneUiState() {
    if (!layoutEl) return;
    layoutEl.classList.toggle("mobile-layout", mobileUi.active);
    if (mobileUi.active) {
      layoutEl.style.setProperty("--mobile-pane-index", String(mobileUi.paneIndex));
    } else {
      layoutEl.style.removeProperty("--mobile-pane-index");
    }
    if (mobileMenuButtonEl) {
      mobileMenuButtonEl.classList.toggle("visible", shouldShowMobileMenuButton());
    }
    if (mobileSwipeHintEl) {
      mobileSwipeHintEl.classList.toggle("visible", shouldShowMobileSwipeHint());
    }
    if (mobileControlsEl) {
      const phase = state.phase;
      const onBoard = mobileUi.active && mobileUi.paneIndex === MOBILE_PANE_BOARD && !isScreenOverlayVisible();
      const showPlaying = onBoard && phase === "playing";
      const showRestart = onBoard && (phase === "camp" || phase === "dead");
      mobileControlsEl.classList.toggle("hidden", !showPlaying && !showRestart);
      mobileControlsEl.classList.toggle("show-restart", showRestart);
    }
  }

  function syncMobileUiState(options = {}) {
    const shouldBeActive = Boolean(mobileLayoutMedia && mobileLayoutMedia.matches);
    if (mobileUi.active !== shouldBeActive) {
      mobileUi.active = shouldBeActive;
      mobileUi.swipePointerId = null;
      mobileUi.paneIndex = MOBILE_PANE_BOARD;
    }
    if (!mobileUi.active) {
      dismissMobileSwipeHint();
      mobileUi.paneIndex = MOBILE_PANE_BOARD;
      applyMobilePaneUiState();
      return;
    }
    const forceBoard = Boolean(options.forceBoard) || isScreenOverlayVisible();
    if (forceBoard) {
      mobileUi.paneIndex = MOBILE_PANE_BOARD;
    } else {
      mobileUi.paneIndex = clamp(mobileUi.paneIndex, MOBILE_PANE_LEFT, MOBILE_PANE_RIGHT);
    }
    if (shouldOfferMobileSwipeHint()) {
      revealMobileSwipeHint();
    } else if (!shouldShowMobileSwipeHint()) {
      dismissMobileSwipeHint();
    }
    applyMobilePaneUiState();
  }

  function setMobilePaneIndex(nextPaneIndex) {
    if (!mobileUi.active) return false;
    const next = clamp(Number(nextPaneIndex) || MOBILE_PANE_BOARD, MOBILE_PANE_LEFT, MOBILE_PANE_RIGHT);
    if (next === mobileUi.paneIndex) return false;
    mobileUi.paneIndex = next;
    dismissMobileSwipeHint();
    applyMobilePaneUiState();
    return true;
  }

  function canHandleMobileSwipe() {
    if (!mobileUi.active) return false;
    if (state.phase === "boot" || state.phase === "splash" || state.phase === "menu") return false;
    if (isScreenOverlayVisible()) return false;
    return true;
  }

  function onMobileSwipePointerDown(event) {
    if (!layoutTrackEl) return;
    if (!canHandleMobileSwipe()) return;
    if (event.pointerType !== "touch") return;
    if (mobileUi.swipePointerId != null) return;
    if (mobileUi.buttonPointerIds.has(event.pointerId)) return;
    mobileUi.swipePointerId = event.pointerId;
    mobileUi.swipeStartX = event.clientX;
    mobileUi.swipeStartY = event.clientY;
    mobileUi.swipeLastX = event.clientX;
    mobileUi.swipeLastY = event.clientY;
  }

  function onMobileSwipePointerMove(event) {
    if (mobileUi.swipePointerId == null) return;
    if (event.pointerId !== mobileUi.swipePointerId) return;
    mobileUi.swipeLastX = event.clientX;
    mobileUi.swipeLastY = event.clientY;
  }

  function onMobileSwipePointerEnd(event) {
    if (mobileUi.swipePointerId == null) return;
    if (event.pointerId !== mobileUi.swipePointerId) return;
    const endX = event.type === "pointerup" ? event.clientX : mobileUi.swipeLastX;
    const endY = event.type === "pointerup" ? event.clientY : mobileUi.swipeLastY;
    const deltaX = endX - mobileUi.swipeStartX;
    const deltaY = endY - mobileUi.swipeStartY;
    mobileUi.swipePointerId = null;
    if (!canHandleMobileSwipe()) return;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX < MOBILE_SWIPE_MIN_DISTANCE) return;
    if (absY > Math.max(16, absX * MOBILE_SWIPE_VERTICAL_RATIO_LIMIT)) return;
    dismissMobileSwipeHint();
    if (deltaX < 0) {
      setMobilePaneIndex(mobileUi.paneIndex + 1);
    } else {
      setMobilePaneIndex(mobileUi.paneIndex - 1);
    }
  }

  function onMobileSwipePointerCancel(event) {
    if (mobileUi.swipePointerId == null) return;
    if (!event || event.pointerId === mobileUi.swipePointerId) {
      mobileUi.swipePointerId = null;
    }
  }

  function openMainMenuFromMobileButton() {
    if (state.phase === "boot") {
      enterSplash();
      return;
    }
    if (state.phase === "splash") {
      enterMenu();
      return;
    }
    if (state.phase === "menu") return;
    if (state.phase === "playing" || state.phase === "relic" || state.phase === "camp") {
      if (state.phase === "playing" && isTurnInputLocked()) {
        pushLog("Wait for turn resolution before opening menu.", "bad");
        return;
      }
      saveRunSnapshot();
      enterMenu();
      return;
    }
    enterMenu();
  }

  function getFuryBlessingBonus() {
    return (state.player?.furyBlessingTurns || 0) > 0 ? 2 : 0;
  }

  function getEffectiveAdrenaline() {
    return Math.max(0, Number(state.player.adrenaline) || 0) + getFuryBlessingBonus();
  }

  function getEffectiveMaxAdrenaline() {
    return Math.max(0, Number(state.player.maxAdrenaline) || 0) + getFuryBlessingBonus();
  }

  function getFuryAttackPowerMultiplier(effectiveFury = getEffectiveAdrenaline()) {
    const stacks = Math.max(0, Number(effectiveFury) || 0);
    const bonus = clamp(stacks * FURY_ATTACK_POWER_PER_STACK, 0, FURY_ATTACK_POWER_MAX_BONUS);
    return 1 + bonus;
  }

  function rollShrineBlessingTurns() {
    return randInt(SHRINE_BLESSING_MIN_TURNS, SHRINE_BLESSING_MAX_TURNS);
  }

  function getShrineBlessingDepthMultiplier(depth = state.depth) {
    const safeDepth = Math.max(0, Number(depth) || 0);
    if (safeDepth >= SHRINE_BLESSING_DEPTH_SCALE_TIER_TWO) return 3;
    if (safeDepth >= SHRINE_BLESSING_DEPTH_SCALE_TIER_ONE) return 2;
    return 1;
  }

  function getShrineMaxHpBlessingBonus(depth = state.depth) {
    const safeDepth = Math.max(0, Number(depth) || 0);
    let mult = 1;
    if (safeDepth >= SHRINE_MAX_HP_BLESSING_DEPTH_SCALE_TIER_TWO) {
      mult = 3;
    } else if (safeDepth >= SHRINE_MAX_HP_BLESSING_DEPTH_SCALE_TIER_ONE) {
      mult = 2;
    }
    return scaledCombat(1) * mult;
  }

  function getShrineArmorBlessingBonus(depth = state.depth) {
    return scaledCombat(1) * getShrineBlessingDepthMultiplier(depth);
  }

  function isShrineBlessed() {
    return (
      (state.player?.furyBlessingTurns || 0) > 0 ||
      (state.player?.shrineAttackTurns || 0) > 0 ||
      (state.player?.shrineArmorTurns || 0) > 0 ||
      (state.player?.shrineMaxHpTurns || 0) > 0 ||
      (state.player?.shrineSwapTurns || 0) > 0 ||
      (state.player?.shrineNoiseTurns || 0) > 0 ||
      (state.player?.shrineHungerTurns || 0) > 0
    );
  }

  function getEnemyLateDepthMultiplier(depth = state.depth) {
    if (depth < ENEMY_LATE_SCALE_START_DEPTH) return 1;
    const steps = Math.floor((depth - ENEMY_LATE_SCALE_START_DEPTH) / ENEMY_LATE_SCALE_STEP_DEPTH) + 1;
    return 1 + steps * ENEMY_LATE_SCALE_PER_STEP;
  }

  function getSpikeDamageByDepth(depth = state.depth) {
    const safeDepth = Math.max(0, Number(depth) || 0);
    const steps = Math.floor(safeDepth / SPIKE_DAMAGE_STEP_DEPTH);
    return SPIKE_DAMAGE_BASE + steps * SPIKE_DAMAGE_PER_STEP;
  }

  function getEnemyAcolyteBuffAttackBonus(enemy) {
    if (!enemy || (Number(enemy.acolyteBuffTurns) || 0) <= 0) return 0;
    const baseAttack = Math.max(MIN_EFFECTIVE_DAMAGE, Number(enemy?.attack) || 0);
    return Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(baseAttack * ACOLYTE_SUPPORT_BUFF_ATTACK_MULT));
  }

  function getEnemyEffectiveAttack(enemy) {
    const baseAttack = Math.max(MIN_EFFECTIVE_DAMAGE, Number(enemy?.attack) || 0);
    const effectiveAtk = Math.round((baseAttack + getEnemyAcolyteBuffAttackBonus(enemy)) * (state.runMods.enemyAtkMult || 1.0) * (state.runMods.enemyDamageMult || 1.0));
    return Math.max(MIN_EFFECTIVE_DAMAGE, effectiveAtk);
  }

  function getBladeAttackMultiplier(level = getCampUpgradeLevel("blade")) {
    const safeLevel = Math.max(0, Number(level) || 0);
    return 1 + safeLevel * BLADE_ATTACK_PERCENT_PER_LEVEL;
  }

  function scaleFlatAttackByBlade(flatAmount, level = getCampUpgradeLevel("blade")) {
    const base = Math.round(Number(flatAmount) || 0);
    if (base === 0) return 0;
    const scaled = Math.round(base * getBladeAttackMultiplier(level));
    if (base > 0) return Math.max(1, scaled);
    return Math.min(-1, scaled);
  }

  function addScaledFlatAttack(flatAmount, level = getCampUpgradeLevel("blade")) {
    const gained = scaleFlatAttackByBlade(flatAmount, level);
    state.player.attack += gained;
    return gained;
  }

  const TWEEN_MS = 120;
  const ENTITY_HIT_FLASH_MS = 120;
  const CRIT_HIT_FLASH_MS = 210;
  const PORTAL_RING_PULSE_MS = 1200;
  const ENEMY_TURN_STEP_DELAY_BASE_MS = 77;
  const ENEMY_TURN_DELAY_MULTIPLIERS = {
    slow: 1.3,
    standard: 1,
    fast: 0.7
  };
  const ENEMY_ADJACENT_PRESSURE_CHANCE = 0.65;
  const ENEMY_ADJACENT_PRESSURE_MAX = 2;
  const WARDEN_SMART_DEPTH_THRESHOLD = 20;

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
    const compactMobile = Boolean(mobileLayoutMedia && mobileLayoutMedia.matches);
    const horizontalPadding = compactMobile ? 24 : 40;
    const verticalPadding = compactMobile ? 146 : 220;
    const viewportMax = Math.max(160, Math.min(window.innerWidth - horizontalPadding, window.innerHeight - verticalPadding, 576));
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

  function sanitizeChestAttackDepthBuckets(input) {
    const output = {};
    if (!input || typeof input !== "object") return output;
    for (const [rawBucket, rawCount] of Object.entries(input)) {
      const bucket = Math.floor(Number(rawBucket));
      if (!Number.isFinite(bucket) || bucket < 0) continue;
      const count = clamp(Number(rawCount) || 0, 0, CHEST_ATTACK_BUCKET_MAX);
      if (count <= 0) continue;
      output[String(bucket)] = count;
    }
    return output;
  }

  function sanitizeWardenFirstDropDepths(input) {
    const output = {};
    if (!input || typeof input !== "object") return output;
    for (const [rawDepth, rawFlag] of Object.entries(input)) {
      const depth = Math.floor(Number(rawDepth));
      if (!Number.isFinite(depth) || depth <= 0 || depth > MAX_DEPTH) continue;
      if (!Boolean(rawFlag)) continue;
      output[String(depth)] = true;
    }
    return output;
  }

  function sanitizeStartDepthUnlocks(input) {
    const output = {};
    if (!input || typeof input !== "object") return output;
    for (const depth of START_DEPTH_CHECKPOINTS) {
      output[String(depth)] = Boolean(input[String(depth)]);
    }
    return output;
  }

  function sanitizeObserverAiWeights(input) {
    const output = { ...OBSERVER_AI_DEFAULT_WEIGHTS };
    if (!input || typeof input !== "object") return output;
    for (const [key, fallback] of Object.entries(OBSERVER_AI_DEFAULT_WEIGHTS)) {
      const raw = Number(input[key]);
      output[key] = clamp(Number.isFinite(raw) ? raw : fallback, 0.2, 3.5);
    }
    return output;
  }

  function sanitizeObserverAiModel(input) {
    const fallback = {
      version: OBSERVER_AI_MODEL_VERSION,
      learningEnabled: true,
      updates: 0,
      lastUpdatedAt: 0,
      weights: { ...OBSERVER_AI_DEFAULT_WEIGHTS }
    };
    if (!input || typeof input !== "object") return fallback;
    return {
      version: clamp(Math.floor(Number(input.version) || OBSERVER_AI_MODEL_VERSION), 1, OBSERVER_AI_MODEL_VERSION),
      learningEnabled: input.learningEnabled !== false,
      updates: Math.max(0, Math.floor(Number(input.updates) || 0)),
      lastUpdatedAt: Math.max(0, Number(input.lastUpdatedAt) || 0),
      weights: sanitizeObserverAiWeights(input.weights)
    };
  }

  function sanitizeEnemySpeedMode(value, fallback = "standard") {
    const normalized = String(value || "").trim().toLowerCase();
    if (ENEMY_SPEED_MODES.includes(normalized)) return normalized;
    return fallback;
  }

  function sanitizePlayerName(value) {
    const base = String(value || "")
      .replace(/\s+/g, " ")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .trim();
    const clipped = base.slice(0, 18);
    return clipped;
  }

  function sanitizeRunToken(value) {
    const token = String(value || "")
      .trim()
      .slice(0, ONLINE_RUN_TOKEN_MAX_LEN);
    if (!token) return "";
    return /^[a-zA-Z0-9_-]+$/.test(token) ? token : "";
  }

  function sanitizeFinalizeNonce(value) {
    const nonce = String(value || "")
      .trim()
      .slice(0, ONLINE_FINALIZE_NONCE_MAX_LEN);
    if (!nonce) return "";
    return /^[a-zA-Z0-9_-]+$/.test(nonce) ? nonce : "";
  }

  function makeRunId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function calculateScore(depth, gold) {
    const safeDepth = Math.max(0, Number(depth) || 0);
    const safeGold = Math.max(0, Number(gold) || 0);
    const bossMilestones = Math.floor(safeDepth / 5);
    return Math.round(safeDepth * 1000 + safeGold * 2 + bossMilestones * 2500);
  }

  function getRunMaxDepth() {
    return Math.max(0, Number(state.runMaxDepth) || 0);
  }

  function getRunGoldEarned() {
    return Math.max(0, Number(state.runGoldEarned) || 0);
  }

  function sanitizeLeaderboardEntry(rawEntry) {
    if (!rawEntry || typeof rawEntry !== "object") return null;
    const depth = Math.max(0, Number(rawEntry.depth) || 0);
    const gold = Math.max(0, Number(rawEntry.gold) || 0);
    const startDepth = clamp(
      Math.max(0, Number(rawEntry.startDepth ?? rawEntry.start_depth) || 0),
      0,
      depth
    );
    const turns = Math.max(0, Number(rawEntry.turns) || Number(rawEntry.turn) || 0);
    const submitSeq = Math.max(
      1,
      Number(rawEntry.submitSeq ?? rawEntry.submit_seq ?? rawEntry.seq) || 1
    );
    const score = calculateScore(depth, gold);
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
      runToken: sanitizeRunToken(rawEntry.runToken),
      finalizeNonce: sanitizeFinalizeNonce(rawEntry.finalizeNonce ?? rawEntry.finalize_nonce),
      finalizeExpiresAt: Math.max(0, Number(rawEntry.finalizeExpiresAt ?? rawEntry.finalize_expires_at) || 0),
      playerName: sanitizePlayerName(rawEntry.playerName) || "Anonymous",
      ts,
      endedAt: typeof rawEntry.endedAt === "string" ? rawEntry.endedAt : new Date(ts).toISOString(),
      outcome,
      depth,
      gold,
      startDepth,
      turns,
      submitSeq,
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
  const initialWardenFirstDropDepths = sanitizeWardenFirstDropDepths(
    readJsonStorage(STORAGE_WARDEN_FIRST_DROP_DEPTHS, {})
  );
  const initialStartDepthUnlocks = sanitizeStartDepthUnlocks(
    readJsonStorage(STORAGE_START_DEPTH_UNLOCKS, {})
  );
  const initialObserverAiModel = sanitizeObserverAiModel(readJsonStorage(STORAGE_OBSERVER_AI_MODEL, null));
  const initialPlayerName = sanitizePlayerName(localStorage.getItem(STORAGE_PLAYER_NAME) || "");
  const initialEnemySpeedMode = sanitizeEnemySpeedMode(localStorage.getItem(STORAGE_ENEMY_SPEED) || "");

  const state = {
    phase: "boot",
    depth: 0,
    runMaxDepth: 0,
    runGoldEarned: 0,
    runStartDepth: 0,
    turn: 0,
    roomIndex: 0,
    bossRoom: false,
    roomType: "combat",
    runMerchantRoomsSeen: 0,
    highscore: Number(localStorage.getItem(STORAGE_DEPTH) || 0),
    bestGold: Number(localStorage.getItem(STORAGE_GOLD) || 0),
    deaths: Number(localStorage.getItem(STORAGE_DEATHS) || 0),
    eliteKills: Number(localStorage.getItem(STORAGE_ELITE_KILLS) || 0),
    totalKills: Number(localStorage.getItem(STORAGE_TOTAL_KILLS) || 0),
    totalGoldEarned: Number(localStorage.getItem(STORAGE_TOTAL_GOLD) || 0),
    totalMerchantPots: Number(localStorage.getItem(STORAGE_TOTAL_MERCHANT_POTS) || 0),
    potionFreeExtract: Number(localStorage.getItem(STORAGE_POTION_FREE_EXTRACT) || 0),
    killsThisRun: 0,
    eliteKillsThisRun: 0,
    shieldUsesThisRun: 0,
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
    simulation: {
      active: false,
      suppressLogs: false,
      suppressVisuals: false,
      suppressAudio: false,
      suppressPersistence: false,
      runIndex: 0,
      runSeed: "",
      lastGameOverReason: ""
    },
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
    treasureMapFragments: 0,
    forcedNextRoomType: "",
    playerHitEnemyThisTurn: false,
    playerShieldBrokeThisTurn: false,
    turnInProgress: false,
    enemyTurnInProgress: false,
    enemyTurnQueue: [],
    enemyTurnStepTimer: 0,
    enemyTurnStepIndex: 0,
    enemyMeleeCommitLimit: 1,
    enemyMeleeCommitted: 0,
    enemyMeleeOverflowCommitted: 0,
    enemyAcolyteBuffCastThisTurn: false,
    enemyBlackboard: null,
    enemyAntiStrafe: null,
    enemyDebugPlans: [],
    playerCombatTrail: [],
    extractConfirm: null,
    extractRelicPrompt: null,
    lastDeathRelicLossText: "",
    wardenRelicMissStreak: 0,
    wardenFirstDropDepths: initialWardenFirstDropDepths,
    startDepthUnlocks: initialStartDepthUnlocks,
    campStartDepthPromptOpen: false,
    campStartDepthSelectionIndex: 0,
    finalGameOverPrompt: null,
    finalVictoryPrompt: null,
    merchantMenuOpen: false,
    merchantUpgradeBoughtThisRoom: false,
    merchantSecondChancePurchases: 0,
    merchantRelicSlot: null,
    merchantServiceSlot: null,
    blackMarketPending: null,
    merchantRelicSwapPending: null,
    dashAimActive: false,
    relicDraft: null,
    legendarySwapPending: null,
    relicSwapPending: null,
    relics: [],
    shrine: null,
    merchant: null,
    lastExtract: null,
    currentRunId: null,
    currentRunToken: "",
    currentRunTokenExpiresAt: 0,
    currentRunSubmitSeq: 1,
    runLeaderboardSubmitted: false,
    lastBossClearDepthThisRun: 0,
    sessionChestAttackFlat: 0,
    sessionChestAttackDepthBuckets: {},
    sessionChestArmorFlat: 0,
    sessionChestArmorDepthBuckets: {},
    sessionChestHealthFlat: 0,
    sessionChestHealthDepthBuckets: {},
    menuIndex: 0,
    menuOptionsOpen: false,
    menuOptionsView: "root", // "root" | "enemy_speed" | "audio"
    menuOptionsIndex: 0,
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
    debugCheatBotOnly: false,
    debugCheatView: "actions", // "actions" | "relic_picker"
    debugCheatRelicPage: 0,
    debugCheatSectionIndex: 0,
    debugGodMode: false,
    debugAiOverlay: localStorage.getItem(STORAGE_DEBUG_AI_OVERLAY) === "1",
    observerBot: {
      enabled: false,
      actionIntervalMs: 270,
      actionTimerMs: 0,
      lastDecision: "idle",
      currentRoomIndex: -1,
      merchantPurchasesThisRoom: 0,
      merchantDoneRoomIndex: -1,
      stallTicks: 0,
      lastPosX: -1,
      lastPosY: -1,
      lastEnemyCount: 0,
      lastEnemyHpTotal: 0,
      pressureDepth: 0,
      pressureFailures: 0,
      farmMode: false,
      farmExtractDepth: 0,
      farmGoldTarget: 0,
      farmGuardTarget: 0,
      farmVitalityTarget: 0,
      farmBladeTarget: 0,
      aiModel: initialObserverAiModel,
      economyPlan: null,
      lastPolicy: "default",
      traceEnabled: true,
      traceSessionId: "",
      traceRunSeq: 0,
      traceEvents: [],
      traceLastSampleTurn: -1,
      traceLastDecision: "idle",
      traceLastPhase: "boot",
      traceLastVampfangHeal: 0,
      loopRecentPositions: [],
      loopPingPongTicks: 0,
      loopPingPongActive: false,
      loopAcolytePingPongTicks: 0
    },
    enemySpeedMode: initialEnemySpeedMode,
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
      vampfangHealRun: 0,
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
      gamblerEdgeArmorPenalty: 0,
      hpShield: 0,
      skillShield: 0,
      bloodVialShield: 0,
      engineOfWarTurns: 0,
      engineOfWarTriggeredDepth: -1,
      stormSigilHitCount: 0,
      graveWhisperAtkBonus: 0,
      quickloaderAtkBonus: 0,
      quickloaderAtkTurns: 0,
      soulHarvestCount: 0,
      soulHarvestGained: 0,
      chronoUsedThisRun: false,
      phaseCooldown: 0,
      titanAttackPenalty: 0,
      glassCannonHpPenalty: 0,
      chaosAtkBonus: 0,
      chaosAtkTurns: 0,
      chaosKillHeal: 0,
      chaosRollCounter: 0,
      hitFlash: 0,
      autoPotionCooldown: 0,
      dashImmunityTurns: 0,
      furyBlessingTurns: 0,
      combatBoostTurns: 0,
      hasSecondChance: false,
      shrineAttackBonus: 0,
      shrineAttackTurns: 0,
      shrineArmorBonus: 0,
      shrineArmorTurns: 0,
      shrineMaxHpBonus: 0,
      shrineMaxHpTurns: 0,
      shrineSwapTurns: 0,
      shrineSwapCounter: 0,
      shrineNoiseTurns: 0,
      shrineHungerTurns: 0,
      shieldCharges: 1,
      shieldChargeRegenTurns: 0,
      shieldStoredDamage: 0,
      dashAfterline: null
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
    floatingTexts: [],
    log: []
  };

  const relicRuntime = relicRuntimeApi.create({
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
  });

  const MERCHANT_RELIC_TIERS = [
    { rarity: "normal", weight: 60, price: 300 },
    { rarity: "rare", weight: 25, price: 600 },
    { rarity: "epic", weight: 12, price: 1000 },
    { rarity: "legendary", weight: 3, price: 2000 },
  ];
  const MERCHANT_SERVICE_POOL = ["fullheal", "combatboost", "secondchance", "blackmarket"];
  const MERCHANT_SECOND_CHANCE_MAX_PURCHASES = 5;

  const campRuntime = campRuntimeApi.create({
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
    MAX_RELICS,
    syncMutatorUnlocks,
    grantLife,
    MAX_LIVES
  });

  const skillsActionsApi = skillsActionsApiFactory.create({
    state,
    SKILL_BY_ID,
    getSkillTier,
    getSkillCooldownRemaining,
    pushLog,
    sign,
    scaledCombat,
    MIN_EFFECTIVE_DAMAGE,
    getEffectiveAdrenaline,
    getFuryAttackPowerMultiplier,
    inBounds,
    getChestAt,
    startTween,
    spawnDashTrail,
    getEnemyAt,
    triggerEnemyHitFlash,
    spawnFloatingText,
    spawnParticles,
    killEnemy,
    registerPlayerHitThisTurn,
    getPlayerAttackForDamage,
    getDashRelicDamageMultiplier,
    applyRelicDamageModsToHit,
    applyVampfangLifesteal,
    findDashKnockbackTile,
    getFacingFromDelta,
    applySpikeToEnemy,
    TILE,
    spawnShockwaveRing,
    playSfx,
    isOnShrine,
    activateShrine,
    setShake,
    getShieldChargesInfo,
    consumeShieldCharge,
    getPlayerHpShieldCap,
    capPlayerHpShield,
    putSkillOnCooldown,
    finalizeTurn,
    markUiDirty
  });

  const audio = {
    ctx: null,
    master: null,
    bgmNormal: null,
    bgmDeep: null,
    bgmCamp: null,
    bgmCampLastLife: null,
    bgmBoss: null,
    bgmBossDeep: null,
    currentBgm: null,
    bgmReady: false,
    bgmWarned: false,
    splash: null,
    deathSample: null,
    deathWarned: false,
    victorySample: null,
    victoryWarned: false,
    finalGameOverSample: null,
    finalGameOverWarned: false
  };

  const playerSprites = {};
  const slimeSprites = {};
  const skeletonSprites = {};
  const bruteSprites = {};
  const acolyteSprite = {
    sheet: null,
    ready: false,
    failed: false
  };
  const skitterSprite = {
    sheet: null,
    ready: false,
    failed: false
  };
  const guardianSprite = {
    sheet: null,
    ready: false,
    failed: false
  };
  const wardenSprite = {
    sheet: null,
    ready: false,
    failed: false
  };
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
  const merchantSprite = {
    frames: [],
    readyCount: 0,
    frameDurationsMs: [],
    frameDurationTotalMs: 0,
    failed: false,
    gif: null,
    gifReady: false
  };
  const shrineSprite = {
    sheet: null,
    ready: false,
    failed: false
  };
  const shieldSprite = {
    sheet: null,
    ready: false,
    failed: false
  };
  const spikeSprite = {
    img: null,
    ready: false,
    failed: false
  };
  const spikeDeepSprite = {
    img: null,
    ready: false,
    failed: false
  };
  const tilesetSprite = {
    img: null,
    ready: false,
    failed: false
  };
  const tilesetDeepSprite = {
    img: null,
    ready: false,
    failed: false
  };
  const torchSprite = {
    sheet: null,
    ready: false,
    failed: false
  };
  const torchDeepSprite = {
    sheet: null,
    ready: false,
    failed: false
  };

  function isSimulationActive() {
    return Boolean(state?.simulation?.active);
  }

  function markUiDirty() {
    if (isSimulationActive()) return;
    state.uiDirty = true;
  }

  function pushLog(text, type = "") {
    if (isSimulationActive() && state.simulation.suppressLogs) return;
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

  function isTurnInputLocked() {
    return state.phase === "playing" && (state.turnInProgress || state.enemyTurnInProgress);
  }

  function shouldPersistToStorage() {
    return !(isSimulationActive() && state.simulation.suppressPersistence);
  }

  function isObserverBotActive() {
    return !isSimulationActive() && Boolean(state?.observerBot?.enabled);
  }

  function setObserverBotEnabled(enabled, options = {}) {
    const next = Boolean(enabled);
    if (!state.observerBot || state.observerBot.enabled === next) return false;
    ensureObserverBotTraceState();
    state.observerBot.enabled = next;
    state.observerBot.actionTimerMs = 0;
    state.observerBot.currentRoomIndex = -1;
    state.observerBot.merchantPurchasesThisRoom = 0;
    state.observerBot.merchantDoneRoomIndex = -1;
    state.observerBot.lastDecision = next ? "online" : "offline";
    state.observerBot.traceLastVampfangHeal = Math.max(0, Number(state.player?.vampfangHealRun) || 0);
    resetObserverBotStallTracker();
    if (!options.silent) {
      pushLog(`Observer Bot ${next ? "ON" : "OFF"}.`, "warn");
    } else {
      markUiDirty();
    }
    appendObserverBotTrace(next ? "bot_on" : "bot_off", { silent: Boolean(options.silent) }, { force: true });
    return true;
  }

  function toggleObserverBot() {
    return setObserverBotEnabled(!isObserverBotActive());
  }

  function makeObserverTraceSessionId() {
    return `bottrace-${Date.now().toString(36)}-${Math.floor(Math.random() * 0x7fffffff).toString(36)}`;
  }

  function ensureObserverBotTraceState() {
    if (!state.observerBot) return null;
    const bot = state.observerBot;
    if (typeof bot.traceEnabled !== "boolean") bot.traceEnabled = true;
    if (typeof bot.traceSessionId !== "string" || bot.traceSessionId.length <= 0) {
      bot.traceSessionId = makeObserverTraceSessionId();
    }
    if (!Array.isArray(bot.traceEvents)) bot.traceEvents = [];
    bot.traceRunSeq = Math.max(0, Number(bot.traceRunSeq) || 0);
    bot.traceLastSampleTurn = Math.max(-1, Number(bot.traceLastSampleTurn) || -1);
    bot.traceLastDecision = String(bot.traceLastDecision || bot.lastDecision || "idle");
    bot.traceLastPhase = String(bot.traceLastPhase || state.phase || "boot");
    bot.traceLastVampfangHeal = Math.max(0, Number(bot.traceLastVampfangHeal) || 0);
    if (!Array.isArray(bot.loopRecentPositions)) bot.loopRecentPositions = [];
    bot.loopPingPongTicks = Math.max(0, Number(bot.loopPingPongTicks) || 0);
    bot.loopAcolytePingPongTicks = Math.max(0, Number(bot.loopAcolytePingPongTicks) || 0);
    bot.loopPingPongActive = Boolean(bot.loopPingPongActive);
    if (bot.traceEvents.length > OBSERVER_TRACE_MAX_EVENTS) {
      bot.traceEvents = bot.traceEvents.slice(bot.traceEvents.length - OBSERVER_TRACE_MAX_EVENTS);
    }
    return bot;
  }

  function getObserverEnemyTypeCounts() {
    const counts = {};
    if (!Array.isArray(state.enemies) || state.enemies.length <= 0) return counts;
    for (const enemy of state.enemies) {
      if (!enemy) continue;
      const type = String(enemy.type || "unknown");
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }

  function getObserverTargetType() {
    if (state.phase !== "playing") {
      if (state.phase === "camp") return "camp";
      if (state.phase === "relic") return "relic";
      if (state.phase === "menu") return "menu";
      return "none";
    }
    if (state.roomCleared) {
      const shrineTarget = getNearestShrineForBot();
      if (shrineTarget || isOnShrine()) return "shrine";
      if (getNearestChestForBot()) return "chest";
      if (state.roomType === "merchant" && state.merchant) {
        return isOnMerchant() ? "merchant_trade" : "merchant";
      }
      return "portal";
    }
    if (!Array.isArray(state.enemies) || state.enemies.length <= 0) return "none";
    const counts = getObserverEnemyTypeCounts();
    if ((counts.acolyte || 0) > 0 && Object.keys(counts).length === 1) {
      return "acolyte";
    }
    const nearest = getNearestEnemyForBot();
    return nearest?.type ? String(nearest.type) : "enemy";
  }

  function updateObserverBotLoopTracker() {
    if (!state.observerBot) return;
    const bot = state.observerBot;
    if (state.phase !== "playing") {
      bot.loopRecentPositions = [];
      bot.loopPingPongTicks = 0;
      bot.loopPingPongActive = false;
      bot.loopAcolytePingPongTicks = 0;
      return;
    }
    const posKey = `${state.player.x},${state.player.y}`;
    bot.loopRecentPositions.push(posKey);
    if (bot.loopRecentPositions.length > 8) {
      bot.loopRecentPositions.shift();
    }
    const recent = bot.loopRecentPositions;
    let pingPong = false;
    if (recent.length >= 4) {
      const a = recent[recent.length - 4];
      const b = recent[recent.length - 3];
      const c = recent[recent.length - 2];
      const d = recent[recent.length - 1];
      pingPong = a === c && b === d && a !== b;
    }
    if (pingPong && Array.isArray(state.enemies) && state.enemies.length > 0) {
      bot.loopPingPongTicks = Math.min(999, bot.loopPingPongTicks + 1);
      if (state.enemies.some((enemy) => enemy && enemy.type === "acolyte")) {
        bot.loopAcolytePingPongTicks = Math.min(999, bot.loopAcolytePingPongTicks + 1);
      } else {
        bot.loopAcolytePingPongTicks = 0;
      }
    } else {
      bot.loopPingPongTicks = 0;
      bot.loopAcolytePingPongTicks = 0;
    }
    bot.loopPingPongActive = bot.loopPingPongTicks >= 2;
  }

  function buildObserverTraceSnapshot() {
    const player = state.player || {};
    const enemyTypeCounts = getObserverEnemyTypeCounts();
    return {
      phase: state.phase,
      depth: Math.max(0, Number(state.depth) || 0),
      turn: Math.max(0, Number(state.turn) || 0),
      roomIndex: Math.max(0, Number(state.roomIndex) || 0),
      roomType: String(state.roomType || "combat"),
      bossRoom: Boolean(state.bossRoom),
      hp: Math.max(0, Number(player.hp) || 0),
      maxHp: Math.max(1, Number(player.maxHp) || 1),
      hpRatio: Number(((Number(player.hp) || 0) / Math.max(1, Number(player.maxHp) || 1)).toFixed(3)),
      armor: Math.max(0, Number(player.armor) || 0),
      attack: Math.max(0, Number(player.attack) || 0),
      vampfangHealRun: Math.max(0, Number(player.vampfangHealRun) || 0),
      hasVampfang: hasRelic("vampfang"),
      aoeTier: Math.max(0, Number(getSkillTier("aoe")) || 0),
      dashTier: Math.max(0, Number(getSkillTier("dash")) || 0),
      runGold: Math.max(0, Number(player.gold) || 0),
      campGold: Math.max(0, Number(state.campGold) || 0),
      potions: Math.max(0, Number(player.potions) || 0),
      maxPotions: Math.max(0, Number(player.maxPotions) || 0),
      lives: Math.max(0, Number(state.lives) || 0),
      enemies: Array.isArray(state.enemies) ? state.enemies.length : 0,
      enemyHpTotal: getBotEnemyHpTotal(),
      enemyTypeCounts,
      targetType: getObserverTargetType(),
      decision: String(state.observerBot?.lastDecision || "idle"),
      policy: String(state.observerBot?.lastPolicy || "default"),
      farmMode: Boolean(state.observerBot?.farmMode),
      pressureDepth: Math.max(0, Number(state.observerBot?.pressureDepth) || 0),
      pressureFailures: Math.max(0, Number(state.observerBot?.pressureFailures) || 0),
      farmExtractDepth: Math.max(0, Number(state.observerBot?.farmExtractDepth) || 0),
      farmGoldTarget: Math.max(0, Number(state.observerBot?.farmGoldTarget) || 0),
      farmGuardTarget: Math.max(0, Number(state.observerBot?.farmGuardTarget) || 0),
      farmVitalityTarget: Math.max(0, Number(state.observerBot?.farmVitalityTarget) || 0),
      farmBladeTarget: Math.max(0, Number(state.observerBot?.farmBladeTarget) || 0),
      loopPingPong: Boolean(state.observerBot?.loopPingPongActive),
      loopPingPongTicks: Math.max(0, Number(state.observerBot?.loopPingPongTicks) || 0),
      loopAcolytePingPongTicks: Math.max(0, Number(state.observerBot?.loopAcolytePingPongTicks) || 0)
    };
  }

  function appendObserverBotTrace(eventType, details = {}, options = {}) {
    const bot = ensureObserverBotTraceState();
    if (!bot || !bot.traceEnabled) return false;
    const force = Boolean(options.force);
    if (!force && !isObserverBotActive()) return false;
    const now = new Date();
    const snapshot = buildObserverTraceSnapshot();
    const prevVampfangHeal = Math.max(0, Number(bot.traceLastVampfangHeal) || 0);
    const currentVampfangHeal = Math.max(0, Number(snapshot.vampfangHealRun) || 0);
    const entry = {
      idx: bot.traceEvents.length + 1,
      ts: now.toISOString(),
      event: String(eventType || "tick"),
      runSeq: Math.max(0, Number(bot.traceRunSeq) || 0),
      vampfangHealDelta: Math.max(0, currentVampfangHeal - prevVampfangHeal),
      ...snapshot,
      ...details
    };
    bot.traceEvents.push(entry);
    if (bot.traceEvents.length > OBSERVER_TRACE_MAX_EVENTS) {
      bot.traceEvents.splice(0, bot.traceEvents.length - OBSERVER_TRACE_MAX_EVENTS);
    }
    bot.traceLastDecision = snapshot.decision;
    bot.traceLastPhase = snapshot.phase;
    bot.traceLastVampfangHeal = currentVampfangHeal;
    return true;
  }

  function buildObserverBotTraceText() {
    const bot = ensureObserverBotTraceState();
    const events = Array.isArray(bot?.traceEvents) ? bot.traceEvents : [];
    const decisionCounts = {};
    const eventCounts = {};
    const farmStartDepthCounts = {};
    const extractReasonCounts = {};
    const uniqueExtractKeys = new Set();
    let deathEventCount = 0;
    let deathHpRatioSum = 0;
    let deathHpSum = 0;
    let extractCount = 0;
    let emergencyExtractCount = 0;
    let farmTicks = 0;
    let loopPingPongTicks = 0;
    let loopAcolytePingPongTicks = 0;
    let vampfangHealTotal = 0;
    const classifyExtractReason = (row) => {
      if (!row || row.decision !== "extract") return "";
      if (row.farmMode && row.farmExtractDepth > 0 && row.depth >= row.farmExtractDepth) {
        return "farm_target_reached";
      }
      if (row.bossRoom) return "post_boss_bank";
      if ((Number(row.hpRatio) || 0) <= 0.45 && (Number(row.potions) || 0) <= 1) {
        return "low_survivability";
      }
      if ((Number(row.potions) || 0) <= 0 && (Number(row.depth) || 0) >= 8) {
        return "no_potions";
      }
      if ((Number(row.campGold) || 0) + (Number(row.runGold) || 0) >= (Number(row.farmGoldTarget) || Infinity)) {
        return "bank_gold_target";
      }
      return "strategic_bank";
    };
    for (const row of events) {
      const decision = String(row?.decision || "");
      const eventName = String(row?.event || "");
      if (decision) decisionCounts[decision] = (decisionCounts[decision] || 0) + 1;
      if (eventName) eventCounts[eventName] = (eventCounts[eventName] || 0) + 1;
      if (eventName === "farm_mode_configured") {
        const depthKey = Math.max(0, Number(row?.targetDepth) || Number(row?.depth) || 0);
        farmStartDepthCounts[depthKey] = (farmStartDepthCounts[depthKey] || 0) + 1;
      }
      if (eventName === "run_death") {
        deathEventCount += 1;
        deathHpRatioSum += Number(row?.hpRatio) || 0;
        deathHpSum += Number(row?.hp) || 0;
      }
      if (decision === "extract" || decision === "emergency_extract") {
        const extractKey = `${row?.runSeq || 0}:${row?.depth || 0}:${row?.turn || 0}:${decision}`;
        if (!uniqueExtractKeys.has(extractKey)) {
          uniqueExtractKeys.add(extractKey);
          extractCount += 1;
          if (decision === "emergency_extract") {
            emergencyExtractCount += 1;
            extractReasonCounts.emergency_low_hp = (extractReasonCounts.emergency_low_hp || 0) + 1;
          } else {
            const reason = classifyExtractReason(row);
            extractReasonCounts[reason] = (extractReasonCounts[reason] || 0) + 1;
          }
        }
      }
      if (row?.farmMode) farmTicks += 1;
      if (row?.loopPingPong) loopPingPongTicks += 1;
      if (row?.loopPingPong && (Number(row?.enemyTypeCounts?.acolyte) || 0) > 0) {
        loopAcolytePingPongTicks += 1;
      }
      vampfangHealTotal += Math.max(0, Number(row?.vampfangHealDelta) || 0);
    }
    const topDecisions = Object.entries(decisionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => `${name}:${count}`)
      .join(", ");
    const topEvents = Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => `${name}:${count}`)
      .join(", ");
    const topFarmStartDepths = Object.entries(farmStartDepthCounts)
      .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
      .slice(0, 5)
      .map(([depth, count]) => `d${depth}:${count}`)
      .join(", ");
    const topExtractReasons = Object.entries(extractReasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => `${reason}:${count}`)
      .join(", ");
    const avgHpOnDeath = deathEventCount > 0 ? Number((deathHpSum / deathEventCount).toFixed(2)) : 0;
    const avgHpRatioOnDeath = deathEventCount > 0 ? Number((deathHpRatioSum / deathEventCount).toFixed(3)) : 0;
    const lines = [];
    lines.push(`# Observer Bot Analysis Trace`);
    lines.push(`generated_at=${new Date().toISOString()}`);
    lines.push(`game_version=${GAME_VERSION}`);
    lines.push(`trace_session_id=${String(bot?.traceSessionId || "none")}`);
    lines.push(`events_total=${events.length}`);
    lines.push(`extract_count=${extractCount}`);
    lines.push(`emergency_extract_count=${emergencyExtractCount}`);
    lines.push(`farm_mode_tick_count=${farmTicks}`);
    lines.push(`loop_ping_pong_tick_count=${loopPingPongTicks}`);
    lines.push(`loop_ping_pong_with_acolyte_tick_count=${loopAcolytePingPongTicks}`);
    lines.push(`vampfang_heal_total=${Math.round(vampfangHealTotal)}`);
    lines.push(`top_decisions=${topDecisions || "none"}`);
    lines.push(`top_event_types=${topEvents || "none"}`);
    lines.push("");
    lines.push("# Mini Balance Report");
    lines.push("The extract reason labels are heuristic inferences from telemetry.");
    lines.push(`avg_hp_on_death=${avgHpOnDeath}`);
    lines.push(`avg_hp_ratio_on_death=${avgHpRatioOnDeath}`);
    lines.push(`farm_mode_start_depth_top=${topFarmStartDepths || "none"}`);
    lines.push(`extract_reason_top=${topExtractReasons || "none"}`);
    lines.push("");
    lines.push("# Schema");
    lines.push("Each line below is JSON with: ts,event,runSeq,vampfangHealDelta,phase,depth,turn,roomIndex,roomType,bossRoom,hp,maxHp,hpRatio,armor,attack,vampfangHealRun,hasVampfang,aoeTier,dashTier,runGold,campGold,potions,maxPotions,lives,enemies,enemyHpTotal,enemyTypeCounts,targetType,decision,policy,farmMode,pressureDepth,pressureFailures,farmExtractDepth,farmGoldTarget,farmGuardTarget,farmVitalityTarget,farmBladeTarget,loopPingPong,loopPingPongTicks,loopAcolytePingPongTicks plus event-specific fields.");
    lines.push("");
    lines.push("# Events (JSONL)");
    for (const row of events) {
      lines.push(JSON.stringify(row));
    }
    return lines.join("\n");
  }

  function downloadTextFile(filename, text) {
    if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") {
      return false;
    }
    const blob = new Blob([String(text || "")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  }

  function exportObserverBotTraceToFile() {
    const text = buildObserverBotTraceText();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `observer-bot-trace-${stamp}.txt`;
    if (downloadTextFile(filename, text)) {
      pushLog(`Observer Bot trace exported: ${filename}`, "good");
      return true;
    }
    pushLog("Observer Bot trace export failed (download API unavailable).", "bad");
    return false;
  }

  function setStorageItem(key, value) {
    if (!shouldPersistToStorage()) return;
    localStorage.setItem(key, value);
  }

  function removeStorageItem(key) {
    if (!shouldPersistToStorage()) return;
    localStorage.removeItem(key);
  }

  function persistObserverBotAiModel() {
    const model = sanitizeObserverAiModel(state.observerBot?.aiModel || null);
    state.observerBot.aiModel = model;
    setStorageItem(STORAGE_OBSERVER_AI_MODEL, JSON.stringify(model));
  }

  function getObserverBotAiModel() {
    if (!state.observerBot) return sanitizeObserverAiModel(null);
    if (!state.observerBot.aiModel) {
      state.observerBot.aiModel = sanitizeObserverAiModel(null);
    }
    return state.observerBot.aiModel;
  }

  function getObserverBotAiWeights() {
    return sanitizeObserverAiWeights(getObserverBotAiModel().weights);
  }

  function updateObserverBotAiWeights(mutator) {
    if (typeof mutator !== "function") return getObserverBotAiWeights();
    const model = getObserverBotAiModel();
    const nextWeights = sanitizeObserverAiWeights(mutator({ ...model.weights }) || model.weights);
    model.weights = nextWeights;
    model.updates = Math.max(0, Number(model.updates) || 0) + 1;
    model.lastUpdatedAt = Date.now();
    persistObserverBotAiModel();
    return nextWeights;
  }

  function resetObserverBotAiModel() {
    const model = sanitizeObserverAiModel(null);
    if (state.observerBot) {
      state.observerBot.aiModel = model;
    }
    setStorageItem(STORAGE_OBSERVER_AI_MODEL, JSON.stringify(model));
    return model;
  }

  function toggleDebugCheatMenu(forceOpen = null, options = {}) {
    if (!canUseDebugCheats()) return false;
    if (state.phase === "boot" || state.phase === "splash") return false;
    const botOnly = Boolean(options.botOnly);
    let next;
    if (forceOpen == null) {
      if (state.debugCheatOpen && state.debugCheatBotOnly !== botOnly) {
        next = true;
      } else {
        next = !state.debugCheatOpen;
      }
    } else {
      next = Boolean(forceOpen);
    }
    state.debugCheatOpen = next;
    state.debugCheatBotOnly = next ? botOnly : false;
    state.debugCheatView = "actions";
    state.debugCheatRelicPage = 0;
    state.debugCheatSectionIndex = 0;
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

  function getDebugCheatRelicPageSize() {
    return 10;
  }

  function getDebugCheatRelicEntries() {
    const rarityOrder = { normal: 0, rare: 1, epic: 2, legendary: 3 };
    return [...RELICS].sort((a, b) =>
      (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99) ||
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  }

  function getDebugCheatRelicPickerPageInfo() {
    const all = getDebugCheatRelicEntries();
    const pageSize = getDebugCheatRelicPageSize();
    const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
    state.debugCheatRelicPage = clamp(Number(state.debugCheatRelicPage) || 0, 0, totalPages - 1);
    const start = state.debugCheatRelicPage * pageSize;
    return {
      all,
      pageSize,
      totalPages,
      page: state.debugCheatRelicPage,
      entries: all.slice(start, start + pageSize)
    };
  }

  function openDebugRelicPicker() {
    state.debugCheatView = "relic_picker";
    state.debugCheatRelicPage = 0;
    markUiDirty();
  }

  function closeDebugRelicPicker() {
    if (state.debugCheatView !== "relic_picker") return;
    state.debugCheatView = "actions";
    markUiDirty();
  }

  function shiftDebugRelicPickerPage(delta) {
    const info = getDebugCheatRelicPickerPageInfo();
    const next = clamp((Number(info.page) || 0) + (delta >= 0 ? 1 : -1), 0, info.totalPages - 1);
    if (next === info.page) return;
    state.debugCheatRelicPage = next;
    markUiDirty();
  }

  function getDebugCheatRelicSlotHotkey(slotIndex) {
    return slotIndex === 9 ? "0" : String(slotIndex + 1);
  }

  function getDebugRelicUnavailableReason(relic) {
    if (!relic) return "Invalid relic.";
    const stackable = isRelicStackable(relic);
    if (state.relics.length >= MAX_RELICS) {
      return `Relic slots full (${state.relics.length}/${MAX_RELICS}).`;
    }
    if (stackable && isNormalRelicStackAtCap(relic.id)) {
      return `Stack max (${MAX_NORMAL_RELIC_STACK}/${MAX_NORMAL_RELIC_STACK}).`;
    }
    if (!stackable && hasRelic(relic.id)) {
      return "Already owned.";
    }
    if (relic.rarity === "legendary" && hasLegendaryRelic()) {
      return "Legendary slot already occupied.";
    }
    return "";
  }

  function tryDebugAddRelicBySlot(slotIndex) {
    const info = getDebugCheatRelicPickerPageInfo();
    const relic = info.entries[slotIndex];
    if (!relic) return false;
    const blockedReason = getDebugRelicUnavailableReason(relic);
    if (blockedReason) {
      pushLog(`Debug relic unavailable: ${relic.name}. ${blockedReason}`, "bad");
      markUiDirty();
      return true;
    }
    if (!applyRelic(relic.id)) {
      pushLog(`Debug relic failed: ${relic.name}.`, "bad");
      markUiDirty();
      return true;
    }
    pushLog(`Debug: relic added ${relic.name}.`, "warn");
    saveAfterDebugCheat();
    return true;
  }

  function getDebugCheatSections() {
    const actions = getVisibleDebugCheatActions();
    const available = new Set(
      actions.map((action) => action.section || "Misc")
    );
    const ordered = state.debugCheatBotOnly
      ? ["System", "Run", "Combat", "Meta", "Misc"].filter((name) => available.has(name))
      : ["Run", "Combat", "Meta", "System", "Misc"].filter((name) => available.has(name));
    return ordered.length > 0 ? ordered : ["Run"];
  }

  function getVisibleDebugCheatActions() {
    const actions = getDebugCheatActions();
    if (!state.debugCheatBotOnly) return actions;
    return actions.filter((action) => action.botMenu === true);
  }

  function getCurrentDebugCheatSection() {
    const sections = getDebugCheatSections();
    const maxIndex = Math.max(0, sections.length - 1);
    state.debugCheatSectionIndex = clamp(Number(state.debugCheatSectionIndex) || 0, 0, maxIndex);
    return sections[state.debugCheatSectionIndex] || sections[0];
  }

  function shiftDebugCheatSection(delta) {
    const sections = getDebugCheatSections();
    if (sections.length <= 1) return;
    const maxIndex = sections.length - 1;
    const direction = delta >= 0 ? 1 : -1;
    const next = clamp((Number(state.debugCheatSectionIndex) || 0) + direction, 0, maxIndex);
    if (next === state.debugCheatSectionIndex) return;
    state.debugCheatSectionIndex = next;
    markUiDirty();
  }

  function getDebugCheatActions() {
    return [
      {
        key: "1",
        section: "Run",
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
        section: "Meta",
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
        section: "Combat",
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
        section: "Meta",
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
        section: "Combat",
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
        section: "Run",
        name: "Relic Picker",
        desc: "Choose exactly which relic to add.",
        available: () => true,
        run: () => {
          openDebugRelicPicker();
        }
      },
      {
        key: "7",
        section: "Run",
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
        key: "x",
        section: "Run",
        name: "Clear All Relics",
        desc: "Remove all relics from current run/camp loadout.",
        available: () => state.relics.length > 0,
        run: () => {
          const removedCount = state.relics.length;
          while (state.relics.length > 0) {
            removeRelic(state.relics[0], { silent: true });
          }
          state.relicDraft = null;
          state.legendarySwapPending = null;
          state.relicSwapPending = null;
          pushLog(`Debug: removed all relics (${removedCount}).`, "warn");
          saveAfterDebugCheat();
        }
      },
      {
        key: "c",
        section: "System",
        name: "Sim Runner 1000",
        desc: "Run 1000 seeded bot sims (median depth + death causes).",
        botMenu: true,
        available: () => true,
        run: () => {
          const seed = `${GAME_VERSION}-debug-sim`;
          pushLog(`Debug sim start: 1000 runs (seed: ${seed}).`, "warn");
          markUiDirty();
          const report = runBalanceSimulation({
            runs: 1000,
            seed
          });
          const causeSummary = Object.entries(report.deathCauses || {})
            .slice(0, 3)
            .map(([cause, count]) => `${cause}:${count}`)
            .join(", ");
          pushLog(
            `Debug sim done: median depth ${report.medianDepth}. ${causeSummary ? `Top causes: ${causeSummary}.` : ""}`.trim(),
            "warn"
          );
          markUiDirty();
        }
      },
      {
        key: "v",
        section: "System",
        name: "Regression Suite",
        desc: "Run 5 fixed seeds x 200 sims and print p10/p50/p90 stats.",
        botMenu: true,
        available: () => true,
        run: () => {
          const seed = `${GAME_VERSION}-debug-regression`;
          pushLog(`Debug regression start: 5 seeds x 200 runs (suite: ${seed}).`, "warn");
          markUiDirty();
          const suite = runObserverBotRegressionSuite({
            seed,
            runsPerSeed: 200,
            learn: false
          });
          const aggregate = suite?.aggregate || {};
          pushLog(
            `Debug regression done: median ${aggregate.medianDepth || 0}, worst ${aggregate.worstMedianDepth || 0}, best ${aggregate.bestMedianDepth || 0}.`,
            "warn"
          );
          markUiDirty();
        }
      },
      {
        key: "l",
        section: "System",
        name: "Export Bot Trace",
        desc: "Save observer bot telemetry as .txt for balance analysis.",
        botMenu: true,
        available: () => true,
        run: () => {
          exportObserverBotTraceToFile();
          markUiDirty();
        }
      },
      {
        key: "b",
        section: "System",
        name: "Toggle Observer Bot",
        desc: "Auto-play visible run: skills, extract logic, camp upgrades, merchant.",
        botMenu: true,
        available: () => true,
        run: () => {
          toggleObserverBot();
        }
      },
      {
        key: "8",
        section: "System",
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
        section: "Combat",
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
        section: "Run",
        name: "Next Depth",
        desc: "Jump to next room depth.",
        available: () => state.phase === "playing",
        run: () => {
          if (state.depth >= MAX_DEPTH) {
            pushLog(`Debug: max depth ${MAX_DEPTH} reached.`, "bad");
            markUiDirty();
            return;
          }
          state.depth = Math.min(MAX_DEPTH, state.depth + 1);
          state.player.hp = Math.min(state.player.maxHp, state.player.hp + scaledCombat(1));
          saveMetaProgress();
          buildRoom();
          pushLog(`Debug: jumped to depth ${state.depth}.`, "warn");
          saveRunSnapshot();
          markUiDirty();
        }
      }
    ];
  }

  function triggerDebugCheatHotkey(key) {
    if (!canUseDebugCheats()) return false;
    const currentSection = getCurrentDebugCheatSection();
    const action = getVisibleDebugCheatActions().find((item) =>
      (item.section || "Misc") === currentSection && item.key === key
    );
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
    setStorageItem(STORAGE_MUT_UNLOCK, JSON.stringify(state.unlockedMutators));
    setStorageItem(STORAGE_MUT_ACTIVE, JSON.stringify(state.activeMutators));
  }

  function persistCampProgress() {
    setStorageItem(STORAGE_CAMP_GOLD, String(state.campGold));
    setStorageItem(STORAGE_LIVES, String(state.lives));
    setStorageItem(STORAGE_CAMP_UPGRADES, JSON.stringify(state.campUpgrades));
    setStorageItem(STORAGE_SKILL_TIERS, JSON.stringify(state.skillTiers));
    setStorageItem(STORAGE_START_DEPTH_UNLOCKS, JSON.stringify(sanitizeStartDepthUnlocks(state.startDepthUnlocks)));
  }

  function persistWardenFirstDropDepths() {
    setStorageItem(
      STORAGE_WARDEN_FIRST_DROP_DEPTHS,
      JSON.stringify(sanitizeWardenFirstDropDepths(state.wardenFirstDropDepths))
    );
  }

  function persistLeaderboard() {
    setStorageItem(STORAGE_LEADERBOARD, JSON.stringify(state.leaderboard || []));
  }

  function persistLeaderboardPending() {
    setStorageItem(STORAGE_LEADERBOARD_PENDING, JSON.stringify(state.leaderboardPending || []));
  }

  function clearLocalLeaderboard() {
    state.leaderboard = [];
    state.leaderboardPending = [];
    state.onlineLeaderboard = [];
    state.onlineLeaderboardError = "";
    state.onlineLeaderboardStatus = ONLINE_LEADERBOARD_API_BASE ? "idle" : "disabled";
    state.onlineLeaderboardUpdatedAt = 0;
    removeStorageItem(STORAGE_LEADERBOARD);
    removeStorageItem(STORAGE_LEADERBOARD_PENDING);
    markUiDirty();
  }

  function persistPlayerName() {
    if (state.playerName) {
      setStorageItem(STORAGE_PLAYER_NAME, state.playerName);
    } else {
      removeStorageItem(STORAGE_PLAYER_NAME);
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
    state.currentRunToken = "";
    state.currentRunTokenExpiresAt = 0;
    state.currentRunSubmitSeq = 1;
    state.runMaxDepth = 0;
    state.runGoldEarned = 0;
    state.runStartDepth = 0;
    state.runLeaderboardSubmitted = false;
    startRun({ resetMapFragments: true });
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
    if (isSimulationActive()) return false;
    if (TEST_MODE_ENABLED) return false;
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

  function getOnlineLeaderboardStartEndpoint() {
    const endpoint = getOnlineLeaderboardEndpoint();
    if (!endpoint) return "";
    return `${endpoint}/start`;
  }

  function getOnlineLeaderboardFinalizeEndpoint() {
    const endpoint = getOnlineLeaderboardEndpoint();
    if (!endpoint) return "";
    return `${endpoint}/finalize`;
  }

  async function requestOnlineRunSession(runId) {
    const normalizedRunId = String(runId || "").trim();
    if (!normalizedRunId || !isOnlineLeaderboardEnabled()) return null;
    const endpoint = getOnlineLeaderboardStartEndpoint();
    if (!endpoint) return null;
    const payload = await fetchJsonWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        runId: normalizedRunId,
        season: ONLINE_LEADERBOARD_SEASON,
        version: GAME_VERSION,
        game_version: GAME_VERSION
      })
    });
    const returnedRunId = String(payload?.runId || "").trim();
    const runToken = sanitizeRunToken(payload?.runToken);
    const expiresAt = Math.max(0, Number(payload?.expiresAt) || 0);
    const nextSubmitSeq = Math.max(1, Number(payload?.nextSubmitSeq) || 1);
    if (!returnedRunId || !runToken) return null;
    return {
      runId: returnedRunId,
      runToken,
      expiresAt,
      nextSubmitSeq
    };
  }

  async function requestOnlineFinalizeNonce(runId, runToken) {
    const normalizedRunId = String(runId || "").trim();
    const normalizedRunToken = sanitizeRunToken(runToken);
    if (!normalizedRunId || !normalizedRunToken || !isOnlineLeaderboardEnabled()) return null;
    const endpoint = getOnlineLeaderboardFinalizeEndpoint();
    if (!endpoint) return null;
    const payload = await fetchJsonWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        runId: normalizedRunId,
        runToken: normalizedRunToken,
        season: ONLINE_LEADERBOARD_SEASON,
        version: GAME_VERSION,
        game_version: GAME_VERSION
      })
    });
    const returnedRunId = String(payload?.runId || "").trim();
    const finalizeNonce = sanitizeFinalizeNonce(payload?.finalizeNonce);
    const finalizeExpiresAt = Math.max(0, Number(payload?.finalizeExpiresAt) || 0);
    if (!returnedRunId || !finalizeNonce || finalizeExpiresAt <= 0) return null;
    return {
      runId: returnedRunId,
      finalizeNonce,
      finalizeExpiresAt
    };
  }

  async function ensureOnlineRunSessionForCurrentRun(force = false) {
    if (!isOnlineLeaderboardEnabled()) return false;
    const runId = String(state.currentRunId || "").trim();
    if (!runId) return false;
    const hasValidToken = Boolean(state.currentRunToken);
    if (!force && hasValidToken) return true;
    try {
      const session = await requestOnlineRunSession(runId);
      if (!session) return false;
      state.currentRunId = session.runId;
      state.currentRunToken = session.runToken;
      state.currentRunTokenExpiresAt = session.expiresAt;
      state.currentRunSubmitSeq = Math.max(
        1,
        Number(state.currentRunSubmitSeq) || 1,
        Number(session.nextSubmitSeq) || 1
      );
      if (state.phase === "playing" || state.phase === "relic" || state.phase === "camp") {
        saveRunSnapshot();
      }
      markUiDirty();
      return true;
    } catch {
      return false;
    }
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
    if (TEST_MODE_ENABLED) return "Disabled (test mode)";
    if (!isOnlineLeaderboardEnabled()) return "Local";
    if (state.onlineLeaderboardUpdatedAt > 0) return "Online";
    if (state.onlineLeaderboardLoading || state.onlineSyncInFlight) return "Local (syncing online)";
    return "Local (offline fallback)";
  }

  function getLeaderboardStatusNote() {
    if (TEST_MODE_ENABLED) {
      return "Test mode enabled: leaderboard submit/sync is disabled.";
    }
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
    const runId = String(entry.runId || "").trim();
    if (!runId) return false;
    let runToken = sanitizeRunToken(entry.runToken);
    if (!runToken) {
      const session = await requestOnlineRunSession(runId);
      if (session && session.runId === runId) {
        runToken = sanitizeRunToken(session.runToken);
        entry.runToken = runToken;
        if (String(state.currentRunId || "") === runId) {
          state.currentRunToken = runToken;
          state.currentRunTokenExpiresAt = Math.max(0, Number(session.expiresAt) || 0);
          state.currentRunSubmitSeq = Math.max(
            1,
            Number(state.currentRunSubmitSeq) || 1,
            Number(session.nextSubmitSeq) || 1
          );
          saveRunSnapshot();
        }
      }
    }
    if (!runToken) {
      throw new Error("Missing run session.");
    }

    let finalizeNonce = sanitizeFinalizeNonce(entry.finalizeNonce);
    let finalizeExpiresAt = Math.max(0, Number(entry.finalizeExpiresAt) || 0);
    const nowTs = Date.now();
    if (!finalizeNonce || finalizeExpiresAt <= nowTs + 500) {
      const finalize = await requestOnlineFinalizeNonce(runId, runToken);
      if (!finalize || finalize.runId !== runId) {
        throw new Error("Missing finalize window.");
      }
      finalizeNonce = sanitizeFinalizeNonce(finalize.finalizeNonce);
      finalizeExpiresAt = Math.max(0, Number(finalize.finalizeExpiresAt) || 0);
      entry.finalizeNonce = finalizeNonce;
      entry.finalizeExpiresAt = finalizeExpiresAt;
      if (String(state.currentRunId || "") === runId) {
        saveRunSnapshot();
      }
    }
    if (!finalizeNonce) {
      throw new Error("Missing finalize window.");
    }

    let submitSeq = Math.max(1, Number(entry.submitSeq) || 0);
    if (!Number.isFinite(submitSeq) || submitSeq < 1) {
      submitSeq = String(state.currentRunId || "") === runId
        ? Math.max(1, Number(state.currentRunSubmitSeq) || 1)
        : 1;
      entry.submitSeq = submitSeq;
    }

    const payloadVersion =
      typeof entry.version === "string" && entry.version.trim()
        ? entry.version.trim()
        : GAME_VERSION;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const payload = {
        runId,
        playerName: sanitizePlayerName(entry.playerName) || "Anonymous",
        ts: Math.max(0, Number(entry.ts) || Date.now()),
        endedAt: entry.endedAt,
        outcome: entry.outcome === "extract" ? "extract" : "death",
        depth: Math.max(0, Number(entry.depth) || 0),
        gold: Math.max(0, Number(entry.gold) || 0),
        startDepth: clamp(
          Math.max(
            0,
            Number(
              entry.startDepth ??
              entry.start_depth ??
              (String(state.currentRunId || "") === runId ? state.runStartDepth : 0)
            ) || 0
          ),
          0,
          Math.max(0, Number(entry.depth) || 0)
        ),
        turns: Math.max(0, Number(entry.turns) || 0),
        submitSeq,
        score: Math.max(0, Number(entry.score) || 0),
        mutatorCount: Math.max(0, Number(entry.mutatorCount) || 0),
        mutatorIds: Array.isArray(entry.mutatorIds) ? entry.mutatorIds : [],
        version: payloadVersion,
        game_version: payloadVersion,
        season: normalizeSeasonId(entry.season || ONLINE_LEADERBOARD_SEASON),
        runToken,
        finalizeNonce
      };
      try {
        await fetchJsonWithTimeout(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        break;
      } catch (error) {
        const message = String(error && error.message ? error.message : "").toLowerCase();
        const canRetryFinalize = attempt === 0 && message.includes("finalize window expired");
        if (!canRetryFinalize) {
          throw error;
        }
        const refreshedFinalize = await requestOnlineFinalizeNonce(runId, runToken);
        if (!refreshedFinalize || refreshedFinalize.runId !== runId) {
          throw error;
        }
        finalizeNonce = sanitizeFinalizeNonce(refreshedFinalize.finalizeNonce);
        finalizeExpiresAt = Math.max(0, Number(refreshedFinalize.finalizeExpiresAt) || 0);
        entry.finalizeNonce = finalizeNonce;
        entry.finalizeExpiresAt = finalizeExpiresAt;
        if (!finalizeNonce) {
          throw error;
        }
      }
    }
    if (String(state.currentRunId || "") === runId) {
      state.currentRunSubmitSeq = Math.max(
        Number(state.currentRunSubmitSeq) || 1,
        submitSeq + 1
      );
      saveRunSnapshot();
    }
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
          persistLeaderboardPending();
          removePendingLeaderboardEntryByRunId(entry.runId);
        } catch (error) {
          const message = error && error.message ? String(error.message) : "";
          const lowered = message.toLowerCase();
          if (
            lowered.includes("run already finalized") ||
            lowered.includes("submission rejected") ||
            lowered.includes("invalid score payload") ||
            lowered.includes("missing run session")
          ) {
            removePendingLeaderboardEntryByRunId(entry.runId);
            continue;
          }
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
    const candidateSeq = Number(candidate?.submitSeq) || 0;
    const currentSeq = Number(current?.submitSeq) || 0;
    if (candidateSeq !== currentSeq) return candidateSeq > currentSeq;
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
    if (TEST_MODE_ENABLED) {
      state.runLeaderboardSubmitted = true;
      return;
    }
    if (state.runLeaderboardSubmitted && state.currentRunId) return;
    const depth = getRunMaxDepth();
    const gold = getRunGoldEarned();
    const turns = Math.max(0, Number(state.turn) || 0);
    if (turns < LEADERBOARD_MIN_TURNS) {
      state.runLeaderboardSubmitted = true;
      return;
    }
    if (depth <= 0 && gold <= 0) {
      state.runLeaderboardSubmitted = true;
      return;
    }

    const runId = String(state.currentRunId || makeRunId());
    state.currentRunId = runId;
    const submitSeq = Math.max(1, Number(state.currentRunSubmitSeq) || 1);
    state.currentRunSubmitSeq = submitSeq + 1;
    const ts = Date.now();
    const mutatorIds = getActiveMutatorIds();
    const startDepth = Math.max(0, Number(state.runStartDepth) || 0);
    const entry = {
      id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
      runId,
      runToken: sanitizeRunToken(state.currentRunToken),
      finalizeNonce: "",
      finalizeExpiresAt: 0,
      submitSeq,
      playerName: sanitizePlayerName(state.playerName) || "Anonymous",
      ts,
      endedAt: new Date(ts).toISOString(),
      outcome: outcome === "extract" ? "extract" : "death",
      depth,
      gold,
      turns,
      startDepth,
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
    state.currentRunToken = "";
    state.currentRunTokenExpiresAt = 0;
    state.currentRunSubmitSeq = 1;
    state.runLeaderboardSubmitted = false;
    state.lastBossClearDepthThisRun = 0;
    state.wardenRelicMissStreak = 0;
    state.wardenFirstDropDepths = {};
    state.startDepthUnlocks = sanitizeStartDepthUnlocks({});
    state.campStartDepthPromptOpen = false;
    state.campStartDepthSelectionIndex = 0;
    resetSessionChestBonuses();
    state.killsThisRun = 0;
    state.eliteKillsThisRun = 0;
    state.shieldUsesThisRun = 0;
    state.campVisitShopCostMult = 1;
    state.leaderboardModalOpen = false;
    state.nameModalOpen = false;
    state.nameModalAction = null;
    state.extractRelicPrompt = null;
    state.finalGameOverPrompt = null;
    state.finalVictoryPrompt = null;

    setStorageItem(STORAGE_DEPTH, "0");
    setStorageItem(STORAGE_GOLD, "0");
    setStorageItem(STORAGE_DEATHS, "0");
    persistMutatorState();
    persistCampProgress();
    persistWardenFirstDropDepths();
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
    setStorageItem(STORAGE_DEPTH, String(state.highscore));
    setStorageItem(STORAGE_GOLD, String(state.bestGold));
    setStorageItem(STORAGE_DEATHS, String(state.deaths));
    persistMutatorState();
    persistCampProgress();
    markUiDirty();
  }

  function clearRunSnapshot() {
    removeStorageItem(STORAGE_RUN_SAVE);
    state.hasContinueRun = false;
    markUiDirty();
  }

  function buildRunSnapshot() {
    return {
      gameVersion: GAME_VERSION,
      phase: state.phase,
      depth: state.depth,
      runStartDepth: state.runStartDepth,
      runMaxDepth: state.runMaxDepth,
      runGoldEarned: state.runGoldEarned,
      turn: state.turn,
      roomIndex: state.roomIndex,
      bossRoom: state.bossRoom,
      roomType: state.roomType,
      treasureMapFragments: state.treasureMapFragments,
      forcedNextRoomType: state.forcedNextRoomType,
      runMerchantRoomsSeen: state.runMerchantRoomsSeen || 0,
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
      currentRunToken: state.currentRunToken,
      currentRunTokenExpiresAt: state.currentRunTokenExpiresAt,
      currentRunSubmitSeq: state.currentRunSubmitSeq,
      runLeaderboardSubmitted: state.runLeaderboardSubmitted,
      lastBossClearDepthThisRun: state.lastBossClearDepthThisRun,
      wardenRelicMissStreak: state.wardenRelicMissStreak,
      wardenFirstDropDepths: state.wardenFirstDropDepths,
      startDepthUnlocks: state.startDepthUnlocks,
      campStartDepthPromptOpen: state.campStartDepthPromptOpen,
      campStartDepthSelectionIndex: state.campStartDepthSelectionIndex,
      sessionChestAttackFlat: state.sessionChestAttackFlat,
      sessionChestAttackDepthBuckets: state.sessionChestAttackDepthBuckets,
      sessionChestArmorFlat: state.sessionChestArmorFlat,
      sessionChestArmorDepthBuckets: state.sessionChestArmorDepthBuckets,
      sessionChestHealthFlat: state.sessionChestHealthFlat,
      sessionChestHealthDepthBuckets: state.sessionChestHealthDepthBuckets,
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
      potionsUsedThisRun: state.potionsUsedThisRun || 0,
      killsThisRun: state.killsThisRun || 0,
      eliteKillsThisRun: state.eliteKillsThisRun || 0,
      shieldUsesThisRun: state.shieldUsesThisRun || 0
    };
  }

  function saveRunSnapshot() {
    if (state.phase !== "playing" && state.phase !== "relic" && state.phase !== "camp") {
      return;
    }
    setStorageItem(STORAGE_RUN_SAVE, JSON.stringify(buildRunSnapshot()));
    state.hasContinueRun = true;
    markUiDirty();
  }

  function tryLoadRunSnapshot() {
    const snapshot = readJsonStorage(STORAGE_RUN_SAVE, null);
    if (!snapshot || !snapshot.player || !snapshot.portal) {
      removeStorageItem(STORAGE_RUN_SAVE);
      state.hasContinueRun = false;
      return false;
    }

    const nextPhase =
      snapshot.phase === "playing" || snapshot.phase === "relic" || snapshot.phase === "camp"
        ? snapshot.phase
        : "playing";

    state.phase = nextPhase;
    state.depth = Math.max(0, Number(snapshot.depth) || 0);
    state.runStartDepth = clamp(
      Math.max(0, Number(snapshot.runStartDepth) || 0),
      0,
      state.depth
    );
    const snapshotRunMaxDepth = Number(snapshot.runMaxDepth);
    if (Number.isFinite(snapshotRunMaxDepth) && snapshotRunMaxDepth >= 0) {
      state.runMaxDepth = Math.max(0, Math.floor(snapshotRunMaxDepth));
    } else {
      const inferredClearedDepth = state.depth - (Boolean(snapshot.roomCleared) ? 0 : 1);
      state.runMaxDepth = Math.max(0, inferredClearedDepth);
    }
    const maxAllowedClearedDepth = Math.max(0, state.depth - (Boolean(snapshot.roomCleared) ? 0 : 1));
    state.runMaxDepth = Math.min(state.runMaxDepth, maxAllowedClearedDepth);
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
    state.treasureMapFragments = Math.max(0, Number(snapshot.treasureMapFragments) || 0);
    const forcedRoomType = String(snapshot.forcedNextRoomType || "").trim();
    state.forcedNextRoomType = ROOM_TYPE_LABELS[forcedRoomType] ? forcedRoomType : "";
    state.runMerchantRoomsSeen = Math.max(
      0,
      Number(snapshot.runMerchantRoomsSeen) || (state.roomType === "merchant" ? 1 : 0)
    );
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
      const carriedRelics = Array.isArray(snapshot.extractRelicPrompt.carriedRelics)
        ? snapshot.extractRelicPrompt.carriedRelics.filter((id) => typeof id === "string")
        : [];
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
        carriedRelics,
        selectedIndices: sanitizeExtractRelicSelectionIndices(
          snapshot.extractRelicPrompt.selectedIndices,
          carriedRelics.length
        )
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
    state.currentRunToken = sanitizeRunToken(snapshot.currentRunToken);
    state.currentRunTokenExpiresAt = Math.max(0, Number(snapshot.currentRunTokenExpiresAt) || 0);
    state.currentRunSubmitSeq = Math.max(1, Number(snapshot.currentRunSubmitSeq) || 1);
    state.runLeaderboardSubmitted = Boolean(snapshot.runLeaderboardSubmitted);
    const snapshotBossClearDepth = Number(snapshot.lastBossClearDepthThisRun);
    state.lastBossClearDepthThisRun = Math.max(
      0,
      Number.isFinite(snapshotBossClearDepth)
        ? snapshotBossClearDepth
        : state.depth >= LEGENDARY_SKILL_REQUIRED_BOSS_DEPTH
          ? LEGENDARY_SKILL_REQUIRED_BOSS_DEPTH
          : 0
    );
    state.wardenRelicMissStreak = Math.max(0, Number(snapshot.wardenRelicMissStreak) || 0);
    state.wardenFirstDropDepths = sanitizeWardenFirstDropDepths(
      snapshot.wardenFirstDropDepths || state.wardenFirstDropDepths
    );
    state.startDepthUnlocks = sanitizeStartDepthUnlocks(
      snapshot.startDepthUnlocks || state.startDepthUnlocks
    );
    state.campStartDepthPromptOpen = nextPhase === "camp" && Boolean(snapshot.campStartDepthPromptOpen);
    state.campStartDepthSelectionIndex = Math.max(0, Number(snapshot.campStartDepthSelectionIndex) || 0);
    state.sessionChestAttackDepthBuckets = sanitizeChestAttackDepthBuckets(snapshot.sessionChestAttackDepthBuckets);
    const maxSessionChestFlat = Object.entries(state.sessionChestAttackDepthBuckets)
      .reduce((sum, [bucketKey, rawCount]) => {
        const bucketIndex = Math.max(0, Math.floor(Number(bucketKey) || 0));
        const count = Math.max(0, Number(rawCount) || 0);
        return sum + count * getChestUpgradeFlatByBucket(CHEST_ATTACK_UPGRADE_FLAT, bucketIndex);
      }, 0);
    state.sessionChestAttackFlat = clamp(
      Math.max(0, Number(snapshot.sessionChestAttackFlat) || 0),
      0,
      Math.max(0, maxSessionChestFlat)
    );
    state.sessionChestArmorDepthBuckets = sanitizeChestAttackDepthBuckets(snapshot.sessionChestArmorDepthBuckets);
    const maxSessionChestArmorFlat = Object.entries(state.sessionChestArmorDepthBuckets)
      .reduce((sum, [bucketKey, rawCount]) => {
        const bucketIndex = Math.max(0, Math.floor(Number(bucketKey) || 0));
        const count = Math.max(0, Number(rawCount) || 0);
        return sum + count * getChestUpgradeFlatByBucket(CHEST_ARMOR_UPGRADE_FLAT, bucketIndex);
      }, 0);
    state.sessionChestArmorFlat = clamp(
      Math.max(0, Number(snapshot.sessionChestArmorFlat) || 0),
      0,
      Math.max(0, maxSessionChestArmorFlat)
    );
    state.sessionChestHealthDepthBuckets = sanitizeChestAttackDepthBuckets(snapshot.sessionChestHealthDepthBuckets);
    const maxSessionChestHealthFlat = Object.entries(state.sessionChestHealthDepthBuckets)
      .reduce((sum, [bucketKey, rawCount]) => {
        const bucketIndex = Math.max(0, Math.floor(Number(bucketKey) || 0));
        const count = Math.max(0, Number(rawCount) || 0);
        return sum + count * getChestHealthUpgradeFlatByBucket(bucketIndex);
      }, 0);
    state.sessionChestHealthFlat = clamp(
      Math.max(0, Number(snapshot.sessionChestHealthFlat) || 0),
      0,
      Math.max(0, maxSessionChestHealthFlat)
    );

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
    state.killsThisRun = Number(snapshot.killsThisRun) || 0;
    state.eliteKillsThisRun = Number(snapshot.eliteKillsThisRun) || 0;
    state.merchantPotsThisRun = Number(snapshot.merchantPotsThisRun) || 0;
    state.shieldUsesThisRun = Number(snapshot.shieldUsesThisRun) || 0;
    state.potionFreeRoomStreak = Number(snapshot.potionFreeRoomStreak) || 0;
    state.potionUsedInRoom = Boolean(snapshot.potionUsedInRoom) || false;
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
      vampfangHealRun: Math.max(0, Number(snapshot.player.vampfangHealRun) || 0),
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
      gamblerEdgeArmorPenalty: Math.max(0, Number(snapshot.player.gamblerEdgeArmorPenalty) || 0),
      hpShield: Math.max(0, Number(snapshot.player.hpShield) || 0),
      skillShield: Math.max(0, Number(snapshot.player.skillShield) || 0),
      bloodVialShield: Math.max(0, Number(snapshot.player.bloodVialShield) || 0),
      engineOfWarTurns: Math.max(0, Number(snapshot.player.engineOfWarTurns) || 0),
      engineOfWarTriggeredDepth: Math.floor(Number(snapshot.player.engineOfWarTriggeredDepth)),
      stormSigilHitCount: Math.max(0, Number(snapshot.player.stormSigilHitCount) || 0),
      graveWhisperAtkBonus: Math.max(0, Number(snapshot.player.graveWhisperAtkBonus) || 0),
      quickloaderAtkBonus: Math.max(0, Number(snapshot.player.quickloaderAtkBonus) || 0),
      quickloaderAtkTurns: Math.max(0, Number(snapshot.player.quickloaderAtkTurns) || 0),
      maxAdrenaline: Math.max(3, Number(snapshot.player.maxAdrenaline) || 3),
      soulHarvestCount: Math.max(0, Number(snapshot.player.soulHarvestCount) || 0),
      soulHarvestGained: Math.max(0, Number(snapshot.player.soulHarvestGained) || 0),
      chronoUsedThisRun: Boolean(snapshot.player.chronoUsedThisRun),
      phaseCooldown: Math.max(0, Number(snapshot.player.phaseCooldown) || 0),
      titanAttackPenalty: Math.max(0, Number(snapshot.player.titanAttackPenalty) || 0),
      glassCannonHpPenalty: Math.max(0, Number(snapshot.player.glassCannonHpPenalty) || 0),
      chaosAtkBonus: Math.max(0, Number(snapshot.player.chaosAtkBonus) || 0),
      chaosAtkTurns: Math.max(0, Number(snapshot.player.chaosAtkTurns) || 0),
      chaosKillHeal: Math.max(0, Number(snapshot.player.chaosKillHeal) || 0),
      chaosRollCounter: clamp(
        Math.max(0, Number(snapshot.player.chaosRollCounter) || 0),
        0,
        CHAOS_ORB_ROLL_INTERVAL - 1
      ),
      hitFlash: Math.max(0, Number(snapshot.player.hitFlash) || 0),
      autoPotionCooldown: Math.max(0, Number(snapshot.player.autoPotionCooldown) || 0),
      dashImmunityTurns: Math.max(0, Number(snapshot.player.dashImmunityTurns) || 0),
      furyBlessingTurns: Math.max(0, Number(snapshot.player.furyBlessingTurns) || 0),
      combatBoostTurns: Math.max(0, Number(snapshot.player.combatBoostTurns) || 0),
      hasSecondChance: Boolean(snapshot.player.hasSecondChance),
      shrineAttackBonus: Math.max(0, Number(snapshot.player.shrineAttackBonus) || 0),
      shrineAttackTurns: Math.max(0, Number(snapshot.player.shrineAttackTurns) || 0),
      shrineArmorBonus: Math.max(0, Number(snapshot.player.shrineArmorBonus) || 0),
      shrineArmorTurns: Math.max(0, Number(snapshot.player.shrineArmorTurns) || 0),
      shrineMaxHpBonus: Math.max(0, Number(snapshot.player.shrineMaxHpBonus) || 0),
      shrineMaxHpTurns: Math.max(0, Number(snapshot.player.shrineMaxHpTurns) || 0),
      shrineSwapTurns: Math.max(0, Number(snapshot.player.shrineSwapTurns) || 0),
      shrineSwapCounter: Math.max(0, Number(snapshot.player.shrineSwapCounter) || 0),
      shrineNoiseTurns: Math.max(0, Number(snapshot.player.shrineNoiseTurns) || 0),
      shrineHungerTurns: Math.max(0, Number(snapshot.player.shrineHungerTurns) || 0),
      shieldCharges: Math.max(0, Number(snapshot.player.shieldCharges) || 0),
      shieldChargeRegenTurns: Math.max(0, Number(snapshot.player.shieldChargeRegenTurns) || 0),
      shieldStoredDamage: Math.max(0, Number(snapshot.player.shieldStoredDamage) || 0),
      dashAfterline:
        snapshot.player.dashAfterline &&
          typeof snapshot.player.dashAfterline === "object" &&
          Array.isArray(snapshot.player.dashAfterline.tiles)
          ? {
            turns: Math.max(0, Number(snapshot.player.dashAfterline.turns) || 0),
            tiles: snapshot.player.dashAfterline.tiles
              .filter((tile) => tile && Number.isFinite(tile.x) && Number.isFinite(tile.y))
              .map((tile) => ({ x: Math.round(tile.x), y: Math.round(tile.y) }))
          }
          : null
    };
    state.player.hp = clamp(state.player.hp, 1, state.player.maxHp);
    capPlayerHpShield();
    state.player.crit = clamp(state.player.crit, 0.01, CRIT_CHANCE_CAP);
    if (!Number.isFinite(state.player.engineOfWarTriggeredDepth)) {
      state.player.engineOfWarTriggeredDepth = -1;
    }
    state.playerHitEnemyThisTurn = false;
    state.playerShieldBrokeThisTurn = false;
    state.enemyAntiStrafe = null;
    state.playerCombatTrail = [{
      x: Math.round(Number(state.player.x) || 0),
      y: Math.round(Number(state.player.y) || 0)
    }];
    if (
      !state.player.dashAfterline ||
      state.player.dashAfterline.turns <= 0 ||
      !Array.isArray(state.player.dashAfterline.tiles) ||
      state.player.dashAfterline.tiles.length <= 0
    ) {
      state.player.dashAfterline = null;
    }
    if (!hasRelic("chaosorb")) {
      state.player.chaosAtkBonus = 0;
      state.player.chaosAtkTurns = 0;
      state.player.chaosKillHeal = 0;
      state.player.chaosRollCounter = 0;
    }
    if (!hasRelic("bloodvial")) {
      state.player.bloodVialShield = 0;
    }
    if (!hasRelic("engineofwar")) {
      state.player.engineOfWarTurns = 0;
      state.player.engineOfWarTriggeredDepth = -1;
    }
    if (!hasRelic("gambleredge")) {
      state.player.gamblerEdgeArmorPenalty = 0;
    }
    if (!hasRelic("stormsigil")) {
      state.player.stormSigilHitCount = 0;
    }
    if (!hasRelic("gravewhisper")) {
      state.player.graveWhisperAtkBonus = 0;
    }
    if (!hasRelic("quickloader")) {
      state.player.quickloaderAtkBonus = 0;
      state.player.quickloaderAtkTurns = 0;
    }
    if (!hasRelic("titanheart") && (state.player.titanAttackPenalty || 0) > 0) {
      state.player.attack += state.player.titanAttackPenalty;
      state.player.titanAttackPenalty = 0;
    }
    ensureShieldChargeState();
    snapVisual(state.player);

    state.portal = {
      x: Number(snapshot.portal.x) || 1,
      y: Number(snapshot.portal.y) || 1
    };

    state.enemies = Array.isArray(snapshot.enemies) ? snapshot.enemies : [];
    for (const enemy of state.enemies) {
      if (enemyTactics && typeof enemyTactics.ensureEnemyState === "function") {
        enemyTactics.ensureEnemyState(enemy);
      }
      if (enemy.cooldown == null) enemy.cooldown = 0;
      enemy.aiming = Boolean(enemy.aiming);
      enemy.slamAiming = Boolean(enemy.slamAiming);
      const castType = String(enemy.acolyteCastType || "").toLowerCase();
      enemy.acolyteCastType =
        castType === "heal" || castType === "buff" || castType === "attack"
          ? castType
          : "";
      enemy.intent = typeof enemy.intent === "string" ? enemy.intent : "chase";
      enemy.aiLastSeenX = Number.isFinite(enemy.aiLastSeenX) ? enemy.aiLastSeenX : enemy.x;
      enemy.aiLastSeenY = Number.isFinite(enemy.aiLastSeenY) ? enemy.aiLastSeenY : enemy.y;
      enemy.aiMemoryTtl = Math.max(0, Number(enemy.aiMemoryTtl) || 0);
      if (!Number.isFinite(enemy.aiPersonality)) {
        enemy.aiPersonality = Math.random() * 2 - 1;
      }
      enemy.castFlash = 0;
      enemy.frozenThisTurn = Boolean(enemy.frozenThisTurn);
      enemy.frostFx = Math.max(0, Number(enemy.frostFx) || 0);
      enemy.disorientedTurns = Math.max(0, Number(enemy.disorientedTurns) || 0);
      enemy.hitFlash = Math.max(0, Number(enemy.hitFlash) || 0);
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
    state.player.dashAfterline = null;
    state.dashAimActive = false;
    state.roomIntroTimer = 0;
    state.roomIntroDuration = 0;
    state.roomIntroTitle = "";
    state.roomIntroSubtitle = "";
    state.turnInProgress = false;
    state.playerShieldBrokeThisTurn = false;
    state.enemyTurnInProgress = false;
    state.enemyTurnQueue = [];
    state.enemyTurnStepTimer = 0;
    state.enemyTurnStepIndex = 0;
    state.enemyBlackboard = null;
    state.enemyDebugPlans = [];
    state.particles = [];
    state.floatingTexts = [];
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
    state.merchantSecondChancePurchases = Math.max(0, Number(snapshot.merchantSecondChancePurchases) || 0);
    state.merchantRelicSlot = null;
    state.merchantServiceSlot = null;
    state.blackMarketPending = null;
    state.merchantRelicSwapPending = null;

    state.hasContinueRun = true;
    ensureOnlineRunSessionForCurrentRun(false);
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

  function loadMerchantSprite() {
    merchantSprite.frames = new Array(MERCHANT_SPRITE_FRAME_PATHS.length).fill(null);
    merchantSprite.readyCount = 0;
    merchantSprite.frameDurationsMs = [];
    merchantSprite.frameDurationTotalMs = 0;
    merchantSprite.failed = false;
    merchantSprite.gifReady = false;

    const gif = new Image();
    merchantSprite.gif = gif;
    const gifUrl = `${MERCHANT_SPRITE_GIF_PATH}?v=${MERCHANT_SPRITE_VERSION}`;
    gif.onload = () => {
      merchantSprite.gifReady = true;
      markUiDirty();
    };
    gif.onerror = () => {
      if (!merchantSprite.failed) {
        merchantSprite.failed = true;
        pushLog(`Merchant sprite failed: ${MERCHANT_SPRITE_GIF_PATH}`, "bad");
      }
    };
    gif.src = gifUrl;

    MERCHANT_SPRITE_FRAME_PATHS.forEach((path, frameIndex) => {
      const img = new Image();
      img.onload = () => {
        merchantSprite.frames[frameIndex] = img;
        merchantSprite.readyCount += 1;
        markUiDirty();
      };
      img.onerror = () => {
        // Optional frame set: ignore missing png frames, gif/fallback will still render.
      };
      img.src = `${path}?v=${MERCHANT_SPRITE_VERSION}`;
    });

    void decodeMerchantGifFrames(gifUrl);
  }

  function loadShrineSprite() {
    const img = new Image();
    shrineSprite.sheet = img;
    shrineSprite.ready = false;
    shrineSprite.failed = false;
    img.onload = () => {
      shrineSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!shrineSprite.failed) {
        shrineSprite.failed = true;
        pushLog(`Shrine sprite failed: ${SHRINE_SPRITESHEET_PATH}`, "bad");
      }
    };
    img.src = `${SHRINE_SPRITESHEET_PATH}?v=${SHRINE_SPRITESHEET_VERSION}`;
  }

  function loadShieldSprite() {
    const img = new Image();
    shieldSprite.sheet = img;
    shieldSprite.ready = false;
    shieldSprite.failed = false;
    img.onload = () => {
      shieldSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!shieldSprite.failed) {
        shieldSprite.failed = true;
        pushLog(`Shield sprite failed: ${SHIELD_SPRITESHEET_PATH}`, "bad");
      }
    };
    img.src = `${SHIELD_SPRITESHEET_PATH}?v=${SHIELD_SPRITESHEET_VERSION}`;
  }

  async function decodeMerchantGifFrames(gifUrl) {
    if (typeof window === "undefined") return false;
    if (typeof window.ImageDecoder !== "function") return false;
    if (typeof createImageBitmap !== "function") return false;
    try {
      const response = await fetch(gifUrl, { cache: "no-store" });
      if (!response.ok) return false;
      const data = await response.arrayBuffer();
      const decoder = new window.ImageDecoder({ data, type: "image/gif" });
      await decoder.tracks.ready;
      const frameCount = Math.max(0, Number(decoder.tracks?.selectedTrack?.frameCount) || 0);
      if (frameCount <= 1) return false;

      const decodedFrames = [];
      const durationsMs = [];
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const result = await decoder.decode({ frameIndex });
        const frame = result.image;
        const bitmap = await createImageBitmap(frame);
        const durationUs = Math.max(0, Number(frame.duration) || 0);
        const durationMs = durationUs > 0
          ? Math.max(40, Math.round(durationUs / 1000))
          : MERCHANT_FRAME_MS;
        decodedFrames.push(bitmap);
        durationsMs.push(durationMs);
        frame.close();
      }

      // Prefer decoded GIF frames when no explicit PNG frame set loaded.
      if (merchantSprite.readyCount <= 0) {
        merchantSprite.frames = decodedFrames;
        merchantSprite.readyCount = decodedFrames.length;
      }
      merchantSprite.frameDurationsMs = durationsMs;
      merchantSprite.frameDurationTotalMs = durationsMs.reduce((sum, value) => sum + value, 0);
      markUiDirty();
      return true;
    } catch {
      return false;
    }
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

  function loadDeepSpikeSprite() {
    const img = new Image();
    spikeDeepSprite.img = img;
    spikeDeepSprite.ready = false;
    spikeDeepSprite.failed = false;
    img.onload = () => {
      spikeDeepSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!spikeDeepSprite.failed) {
        spikeDeepSprite.failed = true;
        pushLog(`Spike sprite failed: ${SPIKE_DEEP_SPRITE_PATH}`, "bad");
      }
    };
    img.src = `${SPIKE_DEEP_SPRITE_PATH}?v=${SPIKE_DEEP_SPRITE_VERSION}`;
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

  function loadDeepTilesetSprite() {
    const img = new Image();
    tilesetDeepSprite.img = img;
    tilesetDeepSprite.ready = false;
    tilesetDeepSprite.failed = false;
    img.onload = () => {
      tilesetDeepSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!tilesetDeepSprite.failed) {
        tilesetDeepSprite.failed = true;
        pushLog(`Tileset failed: ${TILESET_DEEP_SPRITE_PATH}`, "bad");
      }
    };
    img.src = `${TILESET_DEEP_SPRITE_PATH}?v=${TILESET_DEEP_SPRITE_VERSION}`;
  }

  function loadTorchSprite() {
    const img = new Image();
    torchSprite.sheet = img;
    torchSprite.ready = false;
    torchSprite.failed = false;
    img.onload = () => {
      torchSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!torchSprite.failed) {
        torchSprite.failed = true;
        pushLog(`Torch sprite failed: ${TORCH_SPRITESHEET_PATH}`, "bad");
      }
    };
    img.src = `${TORCH_SPRITESHEET_PATH}?v=${TORCH_SPRITESHEET_VERSION}`;
  }

  function loadDeepTorchSprite() {
    const img = new Image();
    torchDeepSprite.sheet = img;
    torchDeepSprite.ready = false;
    torchDeepSprite.failed = false;
    img.onload = () => {
      torchDeepSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!torchDeepSprite.failed) {
        torchDeepSprite.failed = true;
        pushLog(`Torch sprite failed: ${TORCH_DEEP_SPRITESHEET_PATH}`, "bad");
      }
    };
    img.src = `${TORCH_DEEP_SPRITESHEET_PATH}?v=${TORCH_DEEP_SPRITESHEET_VERSION}`;
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
    if (isSimulationActive() && state.simulation.suppressAudio) return;
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
    if (isSimulationActive() && state.simulation.suppressAudio) return false;
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

  function ensureVictoryTrack() {
    if (audio.victorySample) return;
    audio.victorySample = new Audio(VICTORY_TRACK);
    audio.victorySample.loop = false;
    audio.victorySample.preload = "auto";
    audio.victorySample.volume = 0.65;
    audio.victorySample.addEventListener("error", () => {
      pushLog(`Music file failed: ${VICTORY_TRACK}`, "bad");
    });
    audio.victorySample.load();
  }

  function stopVictoryTrack(resetTime = false) {
    if (!audio.victorySample) return;
    audio.victorySample.pause();
    if (resetTime) {
      audio.victorySample.currentTime = 0;
    }
  }

  function playVictoryTrack() {
    if (isSimulationActive() && state.simulation.suppressAudio) return false;
    if (state.audioMuted) return false;
    ensureVictoryTrack();
    if (!audio.victorySample) return false;
    stopVictoryTrack(true);
    const playPromise = audio.victorySample.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        if (!audio.victoryWarned) {
          pushLog("Browser blocked autoplay. Press any key or click game area.", "bad");
          audio.victoryWarned = true;
        }
      });
    }
    return true;
  }

  function ensureFinalGameOverTrack() {
    if (audio.finalGameOverSample) return;
    audio.finalGameOverSample = new Audio(FINAL_GAME_OVER_TRACK);
    audio.finalGameOverSample.loop = false;
    audio.finalGameOverSample.preload = "auto";
    audio.finalGameOverSample.volume = 0.65;
    audio.finalGameOverSample.addEventListener("error", () => {
      pushLog(`Music file failed: ${FINAL_GAME_OVER_TRACK}`, "bad");
    });
    audio.finalGameOverSample.load();
  }

  function stopFinalGameOverTrack(resetTime = false) {
    if (!audio.finalGameOverSample) return;
    audio.finalGameOverSample.pause();
    if (resetTime) {
      audio.finalGameOverSample.currentTime = 0;
    }
  }

  function playFinalGameOverTrack() {
    if (isSimulationActive() && state.simulation.suppressAudio) return false;
    if (state.audioMuted) return false;
    ensureFinalGameOverTrack();
    if (!audio.finalGameOverSample) return false;
    stopFinalGameOverTrack(true);
    const playPromise = audio.finalGameOverSample.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        if (!audio.finalGameOverWarned) {
          pushLog("Browser blocked autoplay. Press any key or click game area.", "bad");
          audio.finalGameOverWarned = true;
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
    audio.bgmDeep = createBgmTrack(MUSIC_TRACKS.deep, 0.38);
    audio.bgmCamp = createBgmTrack(MUSIC_TRACKS.camp, 0.34);
    audio.bgmCampLastLife = createBgmTrack(MUSIC_TRACKS.campLastLife, 0.34);
    audio.bgmBoss = createBgmTrack(MUSIC_TRACKS.boss, 0.4);
    audio.bgmBossDeep = createBgmTrack(MUSIC_TRACKS.bossDeep, 0.4);
    audio.bgmNormal.load();
    audio.bgmDeep.load();
    audio.bgmCamp.load();
    audio.bgmCampLastLife.load();
    audio.bgmBoss.load();
    audio.bgmBossDeep.load();
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
    pauseBgmTrack(audio.bgmDeep, resetTime);
    pauseBgmTrack(audio.bgmCamp, resetTime);
    pauseBgmTrack(audio.bgmCampLastLife, resetTime);
    pauseBgmTrack(audio.bgmBoss, resetTime);
    pauseBgmTrack(audio.bgmBossDeep, resetTime);
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
    if (isSimulationActive() && state.simulation.suppressAudio) {
      stopAllBgm(false);
      stopSplashTrack(false);
      stopDeathTrack(false);
      stopVictoryTrack(false);
      stopFinalGameOverTrack(false);
      return;
    }
    ensureBgmTracks();

    const allowMusic = state.phase === "playing" || state.phase === "relic" || state.phase === "camp";
    const splashPlaying = state.phase === "menu" || state.phase === "dead";
    if (state.audioMuted || !allowMusic) {
      stopAllBgm(false);
      if (!splashPlaying) {
        stopSplashTrack(false);
      }
      return;
    }

    stopSplashTrack(false);

    const target = state.phase === "camp"
      ? ((state.lives <= 1 && audio.bgmCampLastLife) ? audio.bgmCampLastLife : audio.bgmCamp)
      : state.bossRoom
        ? (state.depth >= DEEP_THEME_START_DEPTH && audio.bgmBossDeep ? audio.bgmBossDeep : audio.bgmBoss)
        : state.depth >= DEEP_THEME_START_DEPTH
          ? audio.bgmDeep
          : audio.bgmNormal;
    const allTracks = [audio.bgmNormal, audio.bgmDeep, audio.bgmCamp, audio.bgmCampLastLife, audio.bgmBoss, audio.bgmBossDeep];
    for (const track of allTracks) {
      if (!track || track === target) continue;
      pauseBgmTrack(track, true);
    }

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
    if (isSimulationActive() && state.simulation.suppressAudio) return;
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
    if (kind === "crit") {
      playTone(ctx, out, {
        at: now,
        frequency: 280,
        endFrequency: 520,
        duration: 0.08,
        type: "square",
        gain: 0.07
      });
      playTone(ctx, out, {
        at: now + 0.06,
        frequency: 620,
        endFrequency: 880,
        duration: 0.1,
        type: "triangle",
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
    if (kind === "shrine") {
      playTone(ctx, out, {
        at: now,
        frequency: 360,
        endFrequency: 560,
        duration: 0.12,
        type: "triangle",
        gain: 0.06
      });
      playTone(ctx, out, {
        at: now + 0.08,
        frequency: 520,
        endFrequency: 760,
        duration: 0.14,
        type: "sine",
        gain: 0.05
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
    setStorageItem(STORAGE_AUDIO_MUTED, state.audioMuted ? "1" : "0");
    if (state.audioMuted) {
      stopSplashTrack(false);
      stopDeathTrack(false);
      stopVictoryTrack(false);
      stopFinalGameOverTrack(false);
    }
    syncBgmWithState(true);
    pushLog(`Audio ${state.audioMuted ? "muted" : "enabled"}.`);
    markUiDirty();
  }

  function toggleDebugAiOverlay() {
    state.debugAiOverlay = !state.debugAiOverlay;
    setStorageItem(STORAGE_DEBUG_AI_OVERLAY, state.debugAiOverlay ? "1" : "0");
    pushLog(`AI debug overlay ${state.debugAiOverlay ? "ON" : "OFF"} (${DEBUG_AI_OVERLAY_TOGGLE_KEY.toUpperCase()}).`);
    markUiDirty();
  }

  function getEnemySpeedLabel(mode = state.enemySpeedMode) {
    const normalized = sanitizeEnemySpeedMode(mode);
    if (normalized === "slow") return "Slow";
    if (normalized === "fast") return "Fast";
    return "Standard";
  }

  function getEnemyTurnStepDelayMs() {
    const mode = sanitizeEnemySpeedMode(state.enemySpeedMode);
    const multiplier = Number(ENEMY_TURN_DELAY_MULTIPLIERS[mode]) || 1;
    return Math.max(20, Math.round(ENEMY_TURN_STEP_DELAY_BASE_MS * multiplier));
  }

  function setEnemySpeedMode(mode, options = {}) {
    const normalized = sanitizeEnemySpeedMode(mode);
    if (normalized === state.enemySpeedMode) return false;
    state.enemySpeedMode = normalized;
    setStorageItem(STORAGE_ENEMY_SPEED, normalized);
    if (!options.silent) {
      pushLog(`Enemy speed: ${getEnemySpeedLabel(normalized)}.`);
    }
    markUiDirty();
    return true;
  }

  function shiftEnemySpeedMode(step) {
    const current = sanitizeEnemySpeedMode(state.enemySpeedMode);
    const index = ENEMY_SPEED_MODES.indexOf(current);
    const nextIndex = (index + step + ENEMY_SPEED_MODES.length) % ENEMY_SPEED_MODES.length;
    setEnemySpeedMode(ENEMY_SPEED_MODES[nextIndex], { silent: true });
  }

  function getEnemySpeedOptionsItems() {
    return [
      { id: "slow", key: "1", label: "Slow" },
      { id: "standard", key: "2", label: "Standard" },
      { id: "fast", key: "3", label: "Fast" }
    ];
  }

  function getAudioOptionsItems() {
    return [
      { id: "on", key: "1", label: "On" },
      { id: "off", key: "2", label: "Off" }
    ];
  }

  function getMenuOptionsRootItems() {
    return [
      {
        id: "enemy_speed",
        key: "1",
        title: "Enemy Speed",
        desc: `Current: ${getEnemySpeedLabel()} (${getEnemyTurnStepDelayMs()} ms per enemy step).`
      },
      {
        id: "audio",
        key: "2",
        title: "Audio",
        desc: `Current: ${state.audioMuted ? "Off" : "On"}.`
      }
    ];
  }

  function getActiveMenuOptionsItems() {
    if (state.menuOptionsView === "enemy_speed") {
      return getEnemySpeedOptionsItems();
    }
    if (state.menuOptionsView === "audio") {
      return getAudioOptionsItems();
    }
    return getMenuOptionsRootItems();
  }

  function syncMenuOptionsIndex() {
    const items = getActiveMenuOptionsItems();
    if (!items.length) {
      state.menuOptionsIndex = 0;
      return;
    }
    state.menuOptionsIndex = clamp(state.menuOptionsIndex, 0, items.length - 1);
  }

  function moveMenuOptionsSelection(step) {
    const items = getActiveMenuOptionsItems();
    if (!items.length) return;
    const len = items.length;
    state.menuOptionsIndex = (state.menuOptionsIndex + step + len) % len;
    markUiDirty();
  }

  function openEnemySpeedOptions() {
    state.menuOptionsView = "enemy_speed";
    const idx = ENEMY_SPEED_MODES.indexOf(sanitizeEnemySpeedMode(state.enemySpeedMode));
    state.menuOptionsIndex = idx >= 0 ? idx : 1;
    markUiDirty();
  }

  function openAudioOptions() {
    state.menuOptionsView = "audio";
    state.menuOptionsIndex = state.audioMuted ? 1 : 0;
    markUiDirty();
  }

  function backFromMenuOptionsView() {
    if (state.menuOptionsView === "enemy_speed") {
      state.menuOptionsView = "root";
      state.menuOptionsIndex = 0;
      markUiDirty();
      return true;
    }
    if (state.menuOptionsView === "audio") {
      state.menuOptionsView = "root";
      state.menuOptionsIndex = 0;
      markUiDirty();
      return true;
    }
    return false;
  }

  function activateMenuOptionsSelection(index = state.menuOptionsIndex) {
    const items = getActiveMenuOptionsItems();
    if (!items.length) return;
    const item = items[clamp(index, 0, items.length - 1)];
    if (!item) return;

    if (state.menuOptionsView === "root") {
      if (item.id === "enemy_speed") {
        openEnemySpeedOptions();
      } else if (item.id === "audio") {
        openAudioOptions();
      }
      return;
    }
    if (state.menuOptionsView === "enemy_speed") {
      setEnemySpeedMode(item.id, { silent: true });
      const idx = ENEMY_SPEED_MODES.indexOf(sanitizeEnemySpeedMode(state.enemySpeedMode));
      state.menuOptionsIndex = idx >= 0 ? idx : 1;
      markUiDirty();
      return;
    }
    if (state.menuOptionsView === "audio") {
      if (item.id === "on" && state.audioMuted) {
        toggleAudio();
      } else if (item.id === "off" && !state.audioMuted) {
        toggleAudio();
      }
      state.menuOptionsIndex = state.audioMuted ? 1 : 0;
      markUiDirty();
    }
  }

  function openMenuOptions() {
    state.menuOptionsOpen = true;
    state.menuOptionsView = "root";
    state.menuOptionsIndex = 0;
    markUiDirty();
  }

  function closeMenuOptions() {
    if (!state.menuOptionsOpen) return;
    state.menuOptionsOpen = false;
    state.menuOptionsView = "root";
    state.menuOptionsIndex = 0;
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
      { id: "berserker", ok: state.killsThisRun >= 100 },
      { id: "bulwark", ok: (state.runMaxDepth || 0) >= 8 },
      { id: "alchemist", ok: (state.merchantPotsThisRun || 0) >= 5 },
      { id: "greed", ok: (state.runGoldEarned || 0) >= 1000 },
      { id: "hunter", ok: (state.eliteKillsThisRun || 0) >= 10 },
      { id: "resilience", ok: (state.shieldUsesThisRun || 0) >= 15 },
      { id: "momentum", ok: (state.runMaxDepth || 0) >= 10 },
      { id: "famine", ok: (state.potionFreeRoomStreak || 0) >= 10 },
      { id: "elitist", ok: (state.eliteKillsThisRun || 0) >= 50 },
      { id: "ascension", ok: (state.runMaxDepth || 0) >= 15 }
    ];

    for (const rule of rules) {
      if (rule.ok && unlockMutator(rule.id)) {
        const mutator = MUTATORS.find((item) => item.id === rule.id);
        if (mutator) newlyUnlocked.push(mutator);
      }
    }

    if (newlyUnlocked.length > 0) {
      for (const mutator of newlyUnlocked) {
        pushLog(`Mutator unlocked: ${mutator.name}! Activate at camp (${mutator.bonus}).`, "good");
      }
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
    // Mid-run (in dungeon): once activated, cannot deactivate — stat changes are permanent
    if (!willEnable && state.phase === "playing") {
      pushLog(`${mutator.name} cannot be deactivated during a run.`, "bad");
      return;
    }
    state.activeMutators[mutator.id] = willEnable;
    persistMutatorState();
    // Mid-run activation: apply effects immediately
    if (willEnable && state.phase === "playing") {
      applyMutatorMidRun(mutator.id);
      return;
    }
    // Camp (between runs): just flag for next run — applyMutatorsToRun() handles effects at run start
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
        title: "Options",
        desc: "Game settings.",
        disabled: false,
        action: () => openMenuOptions()
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
    state.menuOptionsOpen = false;
    state.menuOptionsView = "root";
    state.menuOptionsIndex = 0;
    state.leaderboardModalOpen = false;
    state.nameModalOpen = false;
    state.nameModalAction = null;
    state.lastDeathRelicLossText = "";
    state.finalGameOverPrompt = null;
    state.finalVictoryPrompt = null;
    const options = getMenuOptions();
    const firstEnabled = options.findIndex((item) => !item.disabled);
    state.menuIndex = firstEnabled >= 0 ? firstEnabled : 0;
    stopDeathTrack(true);
    stopVictoryTrack(true);
    stopFinalGameOverTrack(true);
    syncBgmWithState();
    playSplashTrack();
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
    const growth = Math.max(1, Number(def.costGrowth) || 2);
    const base = Math.round(def.baseCost * growth ** level);
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

  function applyCampUpgradeInstantPreview(def, previousLevel, nextLevel) {
    if (!def || nextLevel <= previousLevel) return;

    if (def.id === "vitality") {
      const oldMult = 1 + Math.max(0, previousLevel) * 0.1;
      const newMult = 1 + Math.max(0, nextLevel) * 0.1;
      const ratio = oldMult > 0 ? newMult / oldMult : 1;
      const prevMaxHp = Math.max(1, Number(state.player.maxHp) || scaledCombat(BASE_PLAYER_HP));
      const prevHp = Math.max(1, Number(state.player.hp) || prevMaxHp);
      state.player.maxHp = Math.max(1, Math.round(prevMaxHp * ratio));
      state.player.hp = clamp(Math.round(prevHp * ratio), 1, state.player.maxHp);
      return;
    }

    if (def.id === "blade") {
      const previousTotal = scaleFlatAttackByBlade(previousLevel * BLADE_ATTACK_FLAT_PER_LEVEL, previousLevel);
      const nextTotal = scaleFlatAttackByBlade(nextLevel * BLADE_ATTACK_FLAT_PER_LEVEL, nextLevel);
      const delta = nextTotal - previousTotal;
      if (delta !== 0) {
        state.player.attack += delta;
      }
      return;
    }

    if (def.id === "guard") {
      state.player.armor += scaledCombat(nextLevel - previousLevel);
      return;
    }

    if (def.id === "crit_chance") {
      state.player.crit = clamp(
        state.player.crit + (nextLevel - previousLevel) * 0.05,
        0.01,
        CRIT_CHANCE_CAP
      );
      return;
    }

    if (def.id === "satchel") {
      const gain = nextLevel - previousLevel;
      state.player.maxPotions = Math.max(1, state.player.maxPotions + gain);
      state.player.potions = Math.min(state.player.maxPotions, state.player.potions + gain);
    }
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
    applyCampUpgradeInstantPreview(def, level, level + 1);
    persistCampProgress();
    pushLog(`${def.name} upgraded to level ${level + 1}.`, "good");
    saveRunSnapshot();
    markUiDirty();
  }

  function chooseRoomType() {
    if (state.forcedNextRoomType === "vault" && !isBossDepth()) {
      state.forcedNextRoomType = "";
      pushLog("Treasure Map complete: forced Vault room this depth.", "good");
      return "vault";
    }
    const guaranteedMerchantRoom = state.roomIndex === 18 || (
      state.roomIndex === 8 && Math.max(0, Number(state.runMerchantRoomsSeen) || 0) <= 0
    );
    if (guaranteedMerchantRoom) {
      return "merchant";
    }

    const vaultChance = state.depth < 10 ? 0.003 : state.depth < 20 ? 0.005 : 0.007;
    if (state.depth >= 6 && chance(vaultChance)) {
      return "vault";
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
    // (noMerchants was removed; Famine no longer blocks merchants)
    return type;
  }

  function generateMerchantSlots() {
    // --- Relic slot ---
    const totalWeight = MERCHANT_RELIC_TIERS.reduce((s, t) => s + t.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosenTier = MERCHANT_RELIC_TIERS[MERCHANT_RELIC_TIERS.length - 1];
    for (const tier of MERCHANT_RELIC_TIERS) {
      roll -= tier.weight;
      if (roll <= 0) { chosenTier = tier; break; }
    }
    const relicsOfTier = relicRuntime.getRelicsByRarity(chosenTier.rarity);
    const unowned = relicsOfTier.filter(r => !state.relics.includes(r.id));
    const pool = unowned.length > 0 ? unowned : relicsOfTier;
    const chosenRelic = pool[Math.floor(Math.random() * pool.length)];
    let relicPrice = chosenTier.price;
    if (hasRelic("merchfavor")) relicPrice = Math.round(relicPrice * 0.5);
    state.merchantRelicSlot = chosenRelic ? { relicId: chosenRelic.id, price: relicPrice } : null;

    // --- Service slot ---
    const availableServices = MERCHANT_SERVICE_POOL.filter(s => {
      if (s === "secondchance" && state.merchantSecondChancePurchases >= MERCHANT_SECOND_CHANCE_MAX_PURCHASES) return false;
      return true;
    });
    // Very rare offer: +1 Life (~10% chance, only if below max lives)
    if (state.lives < MAX_LIVES && Math.random() < 0.10) {
      state.merchantServiceSlot = "onelife";
    } else {
      state.merchantServiceSlot = availableServices[Math.floor(Math.random() * availableServices.length)] || null;
    }
  }

  function merchantPotionCost() {
    const bought = state.merchantPotionsBought || 0;
    const base = Math.min(50, 10 * (bought + 1)); // 10, 20, 30, 40, 50 (cap)
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

  function canBuyLegendarySkillUpgrade(skillId) {
    const offer = getNextSkillUpgradeOffer(skillId);
    if (!offer || Number(offer.tier) < LEGENDARY_SKILL_TIER) return true;
    return (
      state.depth >= LEGENDARY_SKILL_MIN_DEPTH &&
      (Number(state.lastBossClearDepthThisRun) || 0) >= LEGENDARY_SKILL_REQUIRED_BOSS_DEPTH
    );
  }

  function getLegendarySkillUpgradeBlockReason(skillId) {
    const offer = getNextSkillUpgradeOffer(skillId);
    if (!offer || Number(offer.tier) < LEGENDARY_SKILL_TIER) return "";
    if (state.depth < LEGENDARY_SKILL_MIN_DEPTH) {
      return `Legendary unlocks at depth ${LEGENDARY_SKILL_MIN_DEPTH}+ (current: ${state.depth}).`;
    }
    if ((Number(state.lastBossClearDepthThisRun) || 0) < LEGENDARY_SKILL_REQUIRED_BOSS_DEPTH) {
      return `Defeat a Warden on depth ${LEGENDARY_SKILL_REQUIRED_BOSS_DEPTH}+ in this run first.`;
    }
    return "";
  }

  function merchantSkillUpgradeCost(skillId) {
    const offer = getNextSkillUpgradeOffer(skillId);
    if (!offer) return null;
    const discounted = hasRelic("merchfavor") ? Math.round(offer.cost * 0.5) : offer.cost;
    return Math.max(1, Math.round(discounted * (state.runMods?.shopCostMult || 1)));
  }

  function getMerchantUpgradeWalletTotal() {
    return campRuntime.getMerchantUpgradeWalletTotal();
  }

  function spendMerchantUpgradeGold(amount) {
    return campRuntime.spendMerchantUpgradeGold(amount);
  }

  function openMerchantMenu() {
    if (!state.merchantRelicSlot && !state.merchantServiceSlot) {
      generateMerchantSlots();
    }
    return campRuntime.openMerchantMenu();
  }

  function closeMerchantMenu(logText = "") {
    return campRuntime.closeMerchantMenu(logText);
  }

  function tryBuySkillUpgradeFromMerchant(skillId) {
    return campRuntime.tryBuySkillUpgradeFromMerchant(skillId);
  }

  function tryBuyPotionFromMerchant() {
    return campRuntime.tryBuyPotionFromMerchant();
  }

  function tryBuyRelicFromMerchant() {
    return campRuntime.tryBuyRelicFromMerchant();
  }

  function tryBuyFullHeal() {
    return campRuntime.tryBuyFullHeal();
  }

  function tryBuyCombatBoost() {
    return campRuntime.tryBuyCombatBoost();
  }

  function tryBuyOneLife() {
    return campRuntime.tryBuyOneLife();
  }

  function tryBuySecondChance() {
    return campRuntime.tryBuySecondChance();
  }

  function tryUseBlackMarket(relicId) {
    return campRuntime.tryUseBlackMarket(relicId);
  }

  function tryMerchantRelicSwap(idx) {
    return campRuntime.tryBuyRelicSwap(idx);
  }

  function pickEliteAffix() {
    const roll = Math.random();
    if (roll < 0.34) return "fast";
    if (roll < 0.67) return "tank";
    return "vampiric";
  }

  function hasRelic(id) {
    return relicRuntime.hasRelic(id);
  }

  function getRelicById(relicId) {
    return relicRuntime.getRelicById(relicId);
  }

  function formatRelicNameForOverlay(relic) {
    if (!relic) return "";
    const rarityInfo = RARITY[relic.rarity] || RARITY.normal;
    const safeName = escapeHtmlAttr(relic.name || "Unknown relic");
    return `<strong style="color:${rarityInfo.color}">${safeName}</strong>`;
  }

  function isLegendaryRelic(relicId) {
    return relicRuntime.isLegendaryRelic(relicId);
  }

  function hasLegendaryRelic(exceptRelicId = null) {
    return relicRuntime.hasLegendaryRelic(exceptRelicId);
  }

  function getRelicStackCount(relicId) {
    return relicRuntime.getRelicStackCount(relicId);
  }

  function isNormalRelicStackAtCap(relicId) {
    return relicRuntime.isNormalRelicStackAtCap(relicId);
  }

  function getRelicInventoryGroups() {
    return relicRuntime.getRelicInventoryGroups();
  }

  function getRelicInventoryGroupsFromList(relicIds) {
    return relicRuntime.getRelicInventoryGroupsFromList(relicIds);
  }

  function getRelicExchangeBreakdown(relicIds) {
    return relicRuntime.getRelicExchangeBreakdown(relicIds);
  }

  function relicHotkeyForIndex(index) {
    return relicRuntime.relicHotkeyForIndex(index);
  }

  function getRelicDiscardHotkeyHint() {
    return relicRuntime.getRelicDiscardHotkeyHint();
  }

  function getRelicDraftSkipIndex() {
    return relicRuntime.getRelicDraftSkipIndex();
  }

  function getRelicDraftSkipHotkey() {
    return relicRuntime.getRelicDraftSkipHotkey();
  }

  function isRelicStackable(relic) {
    return Boolean(
      relic &&
      relic.rarity === "normal" &&
      relic.id !== "shrineward" &&
      relic.id !== "ironboots" &&
      relic.id !== "scoutlens" &&
      relic.id !== "fieldrations"
    );
  }

  function getThornmailReflectDamage(incomingDamage) {
    const base = Math.max(0, Number(incomingDamage) || 0);
    return Math.max(1, Math.round(base * THORNMAIL_REFLECT_MULTIPLIER));
  }

  function healPlayer(amount, options = {}) {
    const healAmount = Math.max(0, Math.round(Number(amount) || 0));
    if (healAmount <= 0) {
      return { restored: 0, shielded: 0 };
    }
    const visuals = options.visuals !== false;
    const beforeHp = Math.max(0, Number(state.player.hp) || 0);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmount);
    const restored = Math.max(0, state.player.hp - beforeHp);
    let shielded = Math.max(0, healAmount - restored);
    if (shielded > 0 && !hasRelic("bloodvial")) {
      shielded = 0;
    }
    if (shielded > 0) {
      state.player.bloodVialShield = Math.max(0, Number(state.player.bloodVialShield) || 0) + shielded;
    }
    if (visuals && restored > 0) {
      spawnFloatingText(state.player.x, state.player.y, `+${restored}`, options.textColor || "#9ff7a9");
      spawnParticles(
        state.player.x,
        state.player.y,
        options.particleColor || "#7fe9a7",
        options.particleCount || 4,
        options.particleSpread || 0.8
      );
    }
    if (visuals && shielded > 0) {
      spawnFloatingText(state.player.x, state.player.y, `+${shielded} SH`, "#9fd9ff");
      spawnParticles(state.player.x, state.player.y, "#98ccff", 4, 0.85);
    }
    return { restored, shielded };
  }

  function getPlayerHpShieldCap() {
    const maxHp = Math.max(0, Math.round(Number(state.player.maxHp) || 0));
    return Math.max(0, Math.round(maxHp * SHIELD_HP_CAP_MULTIPLIER));
  }

  function capPlayerHpShield() {
    const cap = getPlayerHpShieldCap();
    const current = Math.max(0, Math.round(Number(state.player.hpShield) || 0));
    state.player.hpShield = Math.min(cap, current);
    return state.player.hpShield;
  }

  function getTotalPlayerShield() {
    const skillShield = Math.max(0, Number(state.player.skillShield) || 0);
    const hpShield = Math.max(0, Number(state.player.hpShield) || 0);
    const bloodShield = Math.max(0, Number(state.player.bloodVialShield) || 0);
    return skillShield + hpShield + bloodShield;
  }

  function clearCombatShield() {
    state.player.skillShield = 0;
    state.player.barrierTurns = 0;
    state.player.barrierArmor = 0;
    state.player.shieldStoredDamage = 0;
    state.playerShieldBrokeThisTurn = false;
  }

  function absorbPlayerShieldDamage(rawDamage) {
    const incoming = Math.max(0, Math.round(Number(rawDamage) || 0));
    if (incoming <= 0) {
      return { remaining: 0, absorbed: 0, skillShieldAbsorbed: 0, hpShieldAbsorbed: 0, bloodShieldAbsorbed: 0 };
    }
    let remaining = incoming;
    let totalAbsorbed = 0;
    let skillShieldAbsorbed = 0;
    let hpShieldAbsorbed = 0;
    let bloodShieldAbsorbed = 0;

    // 1) Shield skill pool absorbs first
    const skillShieldBefore = Math.max(0, Number(state.player.skillShield) || 0);
    if (skillShieldBefore > 0) {
      const skillShieldAbsorb = Math.min(remaining, skillShieldBefore);
      state.player.skillShield = skillShieldBefore - skillShieldAbsorb;
      remaining -= skillShieldAbsorb;
      totalAbsorbed += skillShieldAbsorb;
      skillShieldAbsorbed += skillShieldAbsorb;
      if (skillShieldAbsorb > 0 && state.player.skillShield <= 0) {
        state.player.skillShield = 0;
        state.playerShieldBrokeThisTurn = true;
      }
      if (skillShieldAbsorb > 0) {
        spawnFloatingText(state.player.x, state.player.y, `SH -${skillShieldAbsorb}`, "#cfe9ff");
        spawnParticles(state.player.x, state.player.y, "#9fd7ff", 5, 0.9);
      }
    }

    // 2) hpShield (mutators/shrine) absorbs next
    capPlayerHpShield();
    const mutatorShieldBefore = Math.max(0, Number(state.player.hpShield) || 0);
    if (mutatorShieldBefore > 0 && remaining > 0) {
      const hpShieldAbsorb = Math.min(remaining, mutatorShieldBefore);
      state.player.hpShield = mutatorShieldBefore - hpShieldAbsorb;
      remaining -= hpShieldAbsorb;
      totalAbsorbed += hpShieldAbsorb;
      hpShieldAbsorbed += hpShieldAbsorb;
      if (hpShieldAbsorb > 0 && state.player.hpShield <= 0) {
        state.player.hpShield = 0;
      }
      if (hpShieldAbsorb > 0) {
        spawnFloatingText(state.player.x, state.player.y, `SH -${hpShieldAbsorb}`, "#7be0ff");
        spawnParticles(state.player.x, state.player.y, "#60ccff", 4, 0.85);
      }
    }

    // 3) bloodVialShield (Blood Vial relic) absorbs last
    if (remaining > 0) {
      const bloodShieldBefore = Math.max(0, Number(state.player.bloodVialShield) || 0);
      if (bloodShieldBefore > 0) {
        const bloodAbsorb = Math.min(remaining, bloodShieldBefore);
        state.player.bloodVialShield = bloodShieldBefore - bloodAbsorb;
        remaining -= bloodAbsorb;
        totalAbsorbed += bloodAbsorb;
        bloodShieldAbsorbed += bloodAbsorb;
        if (bloodAbsorb > 0) {
          spawnFloatingText(state.player.x, state.player.y, `SH ${bloodAbsorb}`, "#9fd9ff");
          spawnParticles(state.player.x, state.player.y, "#90c6ff", 5, 0.9);
        }
      }
    }

    return {
      remaining: Math.max(0, remaining),
      absorbed: totalAbsorbed,
      skillShieldAbsorbed,
      hpShieldAbsorbed,
      bloodShieldAbsorbed
    };
  }

  function tryTriggerEngineOfWarEmergency(sourceLabel = "danger") {
    if (!hasRelic("engineofwar")) return false;
    if ((state.player.engineOfWarTurns || 0) > 0) return false;
    if ((state.player.hp || 0) <= 0) return false;
    const maxHp = Math.max(1, Number(state.player.maxHp) || 1);
    const hpRatio = (Number(state.player.hp) || 0) / maxHp;
    if (hpRatio >= ENGINE_OF_WAR_TRIGGER_HP_RATIO) return false;
    const depthKey = Math.max(0, Math.floor(Number(state.depth) || 0));
    if ((Number(state.player.engineOfWarTriggeredDepth) || -1) === depthKey) return false;

    state.player.engineOfWarTriggeredDepth = depthKey;
    state.player.engineOfWarTurns = ENGINE_OF_WAR_TURNS;
    state.player.bloodVialShield = Math.max(0, Number(state.player.bloodVialShield) || 0) + ENGINE_OF_WAR_SHIELD_BONUS;
    spawnShockwaveRing(state.player.x, state.player.y, {
      color: "#ffb86e",
      core: "#fff2d8",
      maxRadius: TILE * 2.2,
      life: 260
    });
    spawnParticles(state.player.x, state.player.y, "#ffbf66", 14, 1.3);
    pushLog(
      `Engine of War ignites (${sourceLabel}): +${ENGINE_OF_WAR_SHIELD_BONUS} shield, +30% damage, +20% lifesteal for ${ENGINE_OF_WAR_TURNS} turns.`,
      "good"
    );
    return true;
  }

  function applyQuickloaderPotionBuff() {
    if (!hasRelic("quickloader")) return;
    const prevBonus = Math.max(0, Number(state.player.quickloaderAtkBonus) || 0);
    if (prevBonus > 0) {
      state.player.attack = Math.max(MIN_EFFECTIVE_DAMAGE, state.player.attack - prevBonus);
    }
    state.player.quickloaderAtkBonus = QUICKLOADER_ATK_BONUS;
    state.player.quickloaderAtkTurns = QUICKLOADER_ATK_TURNS;
    state.player.attack += QUICKLOADER_ATK_BONUS;
    pushLog(`Quickloader: +${QUICKLOADER_ATK_BONUS} ATK for ${QUICKLOADER_ATK_TURNS} turns.`, "good");
  }

  function tickQuickloaderBuff() {
    if ((state.player.quickloaderAtkTurns || 0) <= 0) {
      state.player.quickloaderAtkTurns = 0;
      return;
    }
    state.player.quickloaderAtkTurns -= 1;
    if (state.player.quickloaderAtkTurns > 0) return;
    const bonus = Math.max(0, Number(state.player.quickloaderAtkBonus) || 0);
    state.player.quickloaderAtkBonus = 0;
    if (bonus > 0) {
      state.player.attack = Math.max(MIN_EFFECTIVE_DAMAGE, state.player.attack - bonus);
      pushLog("Quickloader buff fades.", "warn");
    }
  }

  function getPlayerRelicDamageMultiplier(enemy) {
    let mult = 1;
    if (hasRelic("risk")) mult *= 1.4;
    if (hasRelic("mirrorcarapace")) mult *= 0.9;
    if ((state.player.engineOfWarTurns || 0) > 0) mult *= ENGINE_OF_WAR_DAMAGE_MULTIPLIER;
    if (enemy) {
      const maxHp = Math.max(1, Number(enemy.maxHp) || Number(enemy.hp) || 1);
      const hp = Math.max(0, Number(enemy.hp) || 0);
      if (hasRelic("executionseal") && hp / maxHp <= 0.4) {
        mult *= 1.25;
      }
      if (hasRelic("sharpsight") && hp >= maxHp) {
        mult *= 1.1;
      }
    }
    return mult;
  }

  function getLastStandTorqueAttackBonus() {
    if (!hasRelic("laststandtorque")) return 0;
    const hp = Math.max(0, Number(state.player.hp) || 0);
    const maxHp = Math.max(1, Number(state.player.maxHp) || 1);
    return hp / maxHp < 0.5 ? scaledCombat(2) : 0;
  }

  function getPlayerAttackForDamage(options = {}) {
    const includeChaos = options.includeChaos !== false;
    const base = Math.max(0, Number(state.player.attack) || 0);
    const chaos = includeChaos ? Math.max(0, Number(state.player.chaosAtkBonus) || 0) : 0;
    return Math.max(MIN_EFFECTIVE_DAMAGE, base + chaos + getLastStandTorqueAttackBonus());
  }

  function getDashRelicDamageMultiplier() {
    return hasRelic("momentumengine") ? 1.2 : 1;
  }

  function applyRelicDamageModsToHit(baseDamage, enemy) {
    const base = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(Number(baseDamage) || 0));
    let damage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(base * getPlayerRelicDamageMultiplier(enemy)));
    let stormProc = false;
    if (hasRelic("stormsigil")) {
      state.player.stormSigilHitCount = Math.max(0, Number(state.player.stormSigilHitCount) || 0) + 1;
      if (state.player.stormSigilHitCount % STORM_SIGIL_HIT_INTERVAL === 0) {
        damage += STORM_SIGIL_BONUS_DAMAGE;
        stormProc = true;
      }
    }
    return { damage: Math.max(MIN_EFFECTIVE_DAMAGE, damage), stormProc };
  }

  function applyShrineHungerHitHeal() {
    if ((state.player.shrineHungerTurns || 0) <= 0) return 0;
    const healResult = healPlayer(SHRINE_HUNGER_HEAL_PER_HIT, {
      visuals: true,
      textColor: "#9ff7a9",
      particleColor: "#7fe9a7",
      particleCount: 4,
      particleSpread: 0.8
    });
    const restored = healResult.restored;
    if (restored > 0) {
      return restored;
    }
    return 0;
  }

  function registerPlayerHitThisTurn() {
    state.playerHitEnemyThisTurn = true;
    applyShrineHungerHitHeal();
  }

  function resetPlayerCombatTrail() {
    state.playerCombatTrail = [{
      x: Math.round(Number(state.player.x) || 0),
      y: Math.round(Number(state.player.y) || 0)
    }];
  }

  function recordPlayerCombatPosition() {
    const next = {
      x: Math.round(Number(state.player.x) || 0),
      y: Math.round(Number(state.player.y) || 0)
    };
    if (!Array.isArray(state.playerCombatTrail)) {
      state.playerCombatTrail = [];
    }
    const trail = state.playerCombatTrail;
    const last = trail.length > 0 ? trail[trail.length - 1] : null;
    if (last && last.x === next.x && last.y === next.y) return;
    trail.push(next);
    if (trail.length > PLAYER_COMBAT_TRAIL_MAX) {
      trail.splice(0, trail.length - PLAYER_COMBAT_TRAIL_MAX);
    }
  }

  function applyVampfangLifesteal(damageDealt, options = {}) {
    const dealt = Math.max(0, Number(damageDealt) || 0);
    if (dealt <= 0) return 0;
    let healAmount = 0;
    if (hasRelic("vampfang")) {
      const rawVampHealAmount = Math.max(1, Math.round(dealt * VAMPFANG_LIFESTEAL_MULTIPLIER));
      healAmount += Math.min(VAMPFANG_MAX_HEAL_PER_HIT, rawVampHealAmount);
    }
    if ((state.player.engineOfWarTurns || 0) > 0) {
      healAmount += Math.max(1, Math.round(dealt * ENGINE_OF_WAR_LIFESTEAL_MULTIPLIER));
    }
    if (healAmount <= 0) return 0;
    const healResult = healPlayer(healAmount, { visuals: options.visuals !== false });
    const restored = healResult.restored;
    state.player.vampfangHealRun = Math.max(0, Number(state.player.vampfangHealRun) || 0) + restored;
    return restored;
  }

  function applyRelicEffects(relicId, options = {}) {
    const onGain = options.onGain !== false;
    // Normal
    if (relicId === "fang") { addScaledFlatAttack(scaledCombat(1)); return; }
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
        healPlayer(scaledCombat(2), { visuals: false });
      } else {
        state.player.hp = Math.min(state.player.hp, state.player.maxHp);
      }
      return;
    }
    if (relicId === "ironboots") { return; } // passive: checked in spike logic
    if (relicId === "fieldrations") { return; } // passive: checked at room start
    if (relicId === "quickloader") { return; } // passive: checked on potion use
    // Rare
    if (relicId === "idol") { state.runMods.goldMultiplier += GOLDEN_IDOL_GOLD_MULTIPLIER; return; }
    if (relicId === "thornmail") { return; } // passive: checked in enemy melee
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
    if (relicId === "risk") { return; } // passive: checked in hit/potion hooks
    if (relicId === "sharpsight") { return; } // passive: checked in hit hooks
    if (relicId === "laststandtorque") { return; } // passive: checked in attack hooks
    if (relicId === "gambleredge") {
      state.player.crit = clamp(state.player.crit + 0.12, 0.01, CRIT_CHANCE_CAP);
      const armorPenalty = Math.min(Math.max(0, Number(state.player.armor) || 0), scaledCombat(2));
      state.player.gamblerEdgeArmorPenalty = armorPenalty;
      state.player.armor = Math.max(0, state.player.armor - armorPenalty);
      return;
    }
    // Epic
    if (relicId === "vampfang") { return; } // passive: checked in player damage hooks
    if (relicId === "glasscannon") {
      addScaledFlatAttack(scaledCombat(3));
      const maxReducible = Math.max(0, state.player.maxHp - scaledCombat(4));
      const hpPenalty = Math.min(maxReducible, Math.max(1, Math.round(state.player.maxHp * 0.55)));
      state.player.glassCannonHpPenalty = hpPenalty;
      state.player.maxHp = Math.max(scaledCombat(4), state.player.maxHp - hpPenalty);
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
      return;
    }
    if (relicId === "echostrike") { return; } // passive: checked in attackEnemy
    if (relicId === "phasecloak") {
      if (onGain) state.player.phaseCooldown = PHASE_CLOAK_DODGE_COOLDOWN_TURNS;
      return;
    }
    if (relicId === "soulharvest") { return; } // passive: checked in killEnemy
    if (relicId === "burnblade") { return; } // passive: checked in attackEnemy
    if (relicId === "frostamulet") { return; } // passive: checked in enemyTurn
    if (relicId === "bloodvial") {
      state.player.bloodVialShield = Math.max(0, Number(state.player.bloodVialShield) || 0);
      return;
    }
    if (relicId === "executionseal") { return; } // passive: checked in hit hooks
    if (relicId === "stormsigil") { return; } // passive: checked in hit hooks
    if (relicId === "gravewhisper") {
      state.player.graveWhisperAtkBonus = Math.max(0, Number(state.player.graveWhisperAtkBonus) || 0);
      return;
    }
    if (relicId === "mirrorcarapace") { return; } // passive: checked in incoming/outgoing damage hooks
    if (relicId === "momentumengine") { return; } // passive: checked in dash hooks
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
      const hpBonus = scaledCombat(6);
      const armorBonus = scaledCombat(1.2);
      const maxAtkPenalty = scaledCombat(2);
      const atkPenalty = Math.min(
        Math.max(0, state.player.attack - MIN_EFFECTIVE_DAMAGE),
        maxAtkPenalty
      );
      state.player.maxHp += hpBonus;
      state.player.armor += armorBonus;
      state.player.titanAttackPenalty = atkPenalty;
      state.player.attack = Math.max(MIN_EFFECTIVE_DAMAGE, state.player.attack - atkPenalty);
      if (onGain) {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + hpBonus);
      }
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
    if (relicId === "engineofwar") {
      state.player.engineOfWarTurns = 0;
      state.player.engineOfWarTriggeredDepth = -1;
      return;
    }
  }

  function removeRelicEffects(relicId) {
    // Normal
    if (relicId === "fang") {
      state.player.attack = Math.max(scaledCombat(1), state.player.attack - Math.max(1, scaleFlatAttackByBlade(scaledCombat(1))));
      return;
    }
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
    if (relicId === "fieldrations") { return; }
    if (relicId === "quickloader") {
      const bonus = Math.max(0, Number(state.player.quickloaderAtkBonus) || 0);
      if (bonus > 0) {
        state.player.attack = Math.max(MIN_EFFECTIVE_DAMAGE, state.player.attack - bonus);
      }
      state.player.quickloaderAtkBonus = 0;
      state.player.quickloaderAtkTurns = 0;
      return;
    }
    // Rare
    if (relicId === "idol") {
      state.runMods.goldMultiplier = Math.max(0.1, state.runMods.goldMultiplier - GOLDEN_IDOL_GOLD_MULTIPLIER);
      return;
    }
    if (relicId === "thornmail") { return; }
    if (relicId === "adrenal") {
      state.player.maxAdrenaline = Math.max(3, state.player.maxAdrenaline - 2);
      state.player.adrenaline = Math.min(state.player.adrenaline, state.player.maxAdrenaline);
      return;
    }
    if (relicId === "scoutlens") { return; }
    if (relicId === "magnet") { return; }
    if (relicId === "shrineward") { return; }
    if (relicId === "merchfavor") { return; }
    if (relicId === "risk") { return; }
    if (relicId === "sharpsight") { return; }
    if (relicId === "laststandtorque") { return; }
    if (relicId === "gambleredge") {
      state.player.crit = clamp(state.player.crit - 0.12, 0.01, CRIT_CHANCE_CAP);
      state.player.armor += Math.max(0, Number(state.player.gamblerEdgeArmorPenalty) || 0);
      state.player.gamblerEdgeArmorPenalty = 0;
      return;
    }
    // Epic
    if (relicId === "vampfang") { return; }
    if (relicId === "glasscannon") {
      state.player.attack = Math.max(scaledCombat(1), state.player.attack - Math.max(1, scaleFlatAttackByBlade(scaledCombat(3))));
      const refund = Math.max(0, Number(state.player.glassCannonHpPenalty) || 0);
      state.player.maxHp += refund;
      state.player.glassCannonHpPenalty = 0;
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
    if (relicId === "bloodvial") {
      state.player.bloodVialShield = 0;
      return;
    }
    if (relicId === "executionseal") { return; }
    if (relicId === "stormsigil") {
      state.player.stormSigilHitCount = 0;
      return;
    }
    if (relicId === "gravewhisper") {
      const bonus = Math.max(0, Number(state.player.graveWhisperAtkBonus) || 0);
      if (bonus > 0) {
        state.player.attack = Math.max(MIN_EFFECTIVE_DAMAGE, state.player.attack - bonus);
      }
      state.player.graveWhisperAtkBonus = 0;
      return;
    }
    if (relicId === "mirrorcarapace") { return; }
    if (relicId === "momentumengine") { return; }
    // Legendary
    if (relicId === "chronoloop") { return; }
    if (relicId === "voidreaper") {
      state.player.crit = clamp(state.player.crit - 0.15, 0.01, CRIT_CHANCE_CAP);
      return;
    }
    if (relicId === "titanheart") {
      state.player.maxHp = Math.max(scaledCombat(4), state.player.maxHp - scaledCombat(6));
      state.player.armor = Math.max(0, state.player.armor - scaledCombat(1.2));
      state.player.attack += Math.max(0, Number(state.player.titanAttackPenalty) || 0);
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
    if (relicId === "engineofwar") {
      state.player.engineOfWarTurns = 0;
      state.player.engineOfWarTriggeredDepth = -1;
      return;
    }
  }

  function applyRelic(relicId, options = {}) {
    const relic = getRelicById(relicId);
    if (!relic) return false;
    const canStack = isRelicStackable(relic);
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

  function loseRandomRelicOnDeath() {
    if (!Array.isArray(state.relics) || state.relics.length <= 0) return null;
    const randomIndex = randInt(0, state.relics.length - 1);
    const relicId = state.relics[randomIndex];
    const relic = getRelicById(relicId);
    const removed = removeRelic(relicId, { silent: true });
    if (!removed) return null;
    return relic || { id: relicId, name: relicId };
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
      const isStackableNormal = isRelicStackable(relic);
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
    return relicRuntime.getRelicReturnSummary(relicIds);
  }

  function getExtractPromptCarriedRelics(prompt = state.extractRelicPrompt) {
    return relicRuntime.getExtractPromptCarriedRelics(prompt);
  }

  function sanitizeExtractRelicSelectionIndices(indices, maxCount) {
    return relicRuntime.sanitizeExtractRelicSelectionIndices(indices, maxCount);
  }

  function getExtractPromptSelectedIndices(prompt = state.extractRelicPrompt) {
    return relicRuntime.getExtractPromptSelectedIndices(prompt);
  }

  function getExtractPromptSelectedRelics(prompt = state.extractRelicPrompt) {
    return relicRuntime.getExtractPromptSelectedRelics(prompt);
  }

  function getExtractPromptSelectedSummary(prompt = state.extractRelicPrompt) {
    return relicRuntime.getExtractPromptSelectedSummary(prompt);
  }

  function getWardenRelicTableEntry(depth = state.depth) {
    return relicRuntime.getWardenRelicTableEntry(depth);
  }

  function getWardenRelicDropChance(depth = state.depth) {
    return relicRuntime.getWardenRelicDropChance(depth);
  }

  function getWardenRelicDropRoll(depth = state.depth) {
    return relicRuntime.getWardenRelicDropRoll(depth);
  }

  function getWardenDepthKey(depth = state.depth) {
    return relicRuntime.getWardenDepthKey(depth);
  }

  function hasUsedWardenFirstDropAtDepth(depth = state.depth) {
    return relicRuntime.hasUsedWardenFirstDropAtDepth(depth);
  }

  function markWardenFirstDropUsedAtDepth(depth = state.depth) {
    return relicRuntime.markWardenFirstDropUsedAtDepth(depth);
  }

  function shouldForceWardenFirstDrop(depth = state.depth) {
    return relicRuntime.shouldForceWardenFirstDrop(depth);
  }

  function getUnlockedWardenRelicRarities(depth = state.depth) {
    const entry = getWardenRelicTableEntry(depth);
    if (!entry) return new Set();
    return new Set(
      Object.entries(entry.rarityWeights)
        .filter(([, weight]) => Number(weight) > 0)
        .map(([rarity]) => rarity)
    );
  }

  function rollRelicRarity(isBoss) {
    if (!isBoss) {
      const depthBonus = Math.floor(state.depth / 5);
      let legendaryChance = 0.02 + depthBonus * 0.008;
      let epicChance = 0.06 + depthBonus * 0.012;
      let rareChance = 0.17;
      const roll = Math.random();
      if (roll < legendaryChance) return "legendary";
      if (roll < legendaryChance + epicChance) return "epic";
      if (roll < legendaryChance + epicChance + rareChance) return "rare";
      return "normal";
    }

    const entry = getWardenRelicTableEntry(state.depth);
    if (!entry) return "normal";
    const roll = Math.random();
    let cumulative = 0;
    const order = ["normal", "rare", "epic", "legendary"];
    for (const rarity of order) {
      cumulative += Number(entry.rarityWeights[rarity]) || 0;
      if (roll < cumulative) return rarity;
    }
    return "normal";
  }

  function openRelicDraft(isBoss = false) {
    normalizeRelicInventory();
    const unlockedRarities = isBoss ? getUnlockedWardenRelicRarities(state.depth) : null;
    const pool = RELICS.filter(
      (relic) => {
        const stackable = isRelicStackable(relic);
        return (
          (!unlockedRarities || unlockedRarities.has(relic.rarity)) &&
          (
            (stackable && !isNormalRelicStackAtCap(relic.id)) ||
            (!stackable && !state.relics.includes(relic.id))
          )
        );
      }
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
    if (isRelicStackable(relic) && isNormalRelicStackAtCap(relic.id)) {
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
    const relicReturn = getRelicReturnSummary(state.relics);
    const gainedCampGold = baseGold;
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
      setStorageItem(STORAGE_POTION_FREE_EXTRACT, String(state.potionFreeExtract));
    }
    state.phase = "camp";
    syncBgmWithState();
    saveMetaProgress();
    const unlockedNow = syncMutatorUnlocks();
    pushLog(`Extraction success: +${gainedCampGold} camp gold.`, "good");
    if (relicReturn.count > 0) {
      state.extractRelicPrompt = {
        baseGold,
        relicReturn,
        carriedRelics: [...state.relics],
        selectedIndices: []
      };
      for (const mutator of unlockedNow) {
        pushLog(`Unlocked: [${mutator.key}] ${mutator.name}!`, "good");
      }
      pushLog(
        `Relics carried: ${relicReturn.count}. Select relics to sell (1-8 toggle, A all, C clear, Y sell selected, N keep all).`,
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
    pushLog("Camp shop: keys 1-0 buy upgrades. Press R to choose start depth.");
    saveRunSnapshot();
    markUiDirty();
  }

  function resolveExtractRelicPrompt(exchangeForGold) {
    const prompt = state.extractRelicPrompt;
    if (!prompt) return false;
    const carriedRelics = getExtractPromptCarriedRelics(prompt);

    if (exchangeForGold) {
      const selectedIndices = getExtractPromptSelectedIndices(prompt);
      const selectedIndexSet = new Set(selectedIndices);
      const soldRelics = selectedIndices
        .map((index) => carriedRelics[index])
        .filter((id) => typeof id === "string");
      const soldSummary = getRelicReturnSummary(soldRelics);
      if (soldSummary.total > 0) {
        state.campGold += soldSummary.total;
      }
      if (state.lastExtract) {
        state.lastExtract.campGold += soldSummary.total;
        state.lastExtract.relicReturned = soldSummary.count;
        state.lastExtract.relicGold = soldSummary.total;
      }
      state.relics = carriedRelics.filter((_, index) => !selectedIndexSet.has(index));
      normalizeRelicInventory();
      state.relicDraft = null;
      state.legendarySwapPending = null;
      state.relicSwapPending = null;
      state.extractRelicPrompt = null;
      if (soldSummary.count > 0) {
        pushLog(
          `Relics sold: ${soldSummary.count} for +${soldSummary.total} camp gold. Kept ${state.relics.length}. Camp shop: keys 1-0 buy upgrades. Press R to choose start depth.`,
          "good"
        );
      } else {
        pushLog(
          `No relics selected. Relics kept (${state.relics.length}). Camp shop: keys 1-0 buy upgrades. Press R to choose start depth.`,
          "good"
        );
      }
      saveMetaProgress();
      saveRunSnapshot();
      markUiDirty();
      return true;
    }

    state.relics = carriedRelics;
    normalizeRelicInventory();
    state.relicDraft = null;
    state.legendarySwapPending = null;
    state.relicSwapPending = null;
    state.extractRelicPrompt = null;
    pushLog(
      `Relics kept (${state.relics.length}). You can shop now. Press R to choose next run start depth.`,
      "good"
    );
    saveRunSnapshot();
    markUiDirty();
    return true;
  }

  function getAvailableStartDepths() {
    const depths = [0];
    const unlocks = sanitizeStartDepthUnlocks(state.startDepthUnlocks);
    for (const depth of START_DEPTH_CHECKPOINTS) {
      if (unlocks[String(depth)]) depths.push(depth);
    }
    return depths;
  }

  function isStartDepthUnlocked(depth) {
    const normalizedDepth = Math.max(0, Math.floor(Number(depth) || 0));
    if (normalizedDepth <= 0) return true;
    return Boolean(sanitizeStartDepthUnlocks(state.startDepthUnlocks)[String(normalizedDepth)]);
  }

  function getCampStartDepthBySelectionIndex(index = state.campStartDepthSelectionIndex) {
    const options = getAvailableStartDepths();
    if (options.length <= 0) return 0;
    const safeIndex = clamp(Math.floor(Number(index) || 0), 0, options.length - 1);
    return options[safeIndex];
  }

  function openCampStartDepthPrompt() {
    if (state.phase !== "camp") return false;
    if (state.extractRelicPrompt) return false;
    const options = getAvailableStartDepths();
    if (options.length <= 1) {
      startRun({ carriedRelics: [...state.relics], startDepth: 0 });
      return true;
    }
    state.campStartDepthPromptOpen = true;
    state.campStartDepthSelectionIndex = options.length - 1;
    markUiDirty();
    return true;
  }

  function closeCampStartDepthPrompt() {
    if (!state.campStartDepthPromptOpen) return false;
    state.campStartDepthPromptOpen = false;
    markUiDirty();
    return true;
  }

  function confirmCampStartDepthPrompt() {
    if (!state.campStartDepthPromptOpen) return false;
    const selectedDepth = getCampStartDepthBySelectionIndex();
    state.campStartDepthPromptOpen = false;
    startRun({ carriedRelics: [...state.relics], startDepth: selectedDepth });
    return true;
  }

  function tryUnlockStartDepthFromBossClear(depth = state.depth) {
    const bossDepth = Math.max(0, Math.floor(Number(depth) || 0));
    const unlockIndex = START_DEPTH_UNLOCK_BOSS_DEPTHS.indexOf(bossDepth);
    if (unlockIndex < 0) return false;
    const startDepth = START_DEPTH_CHECKPOINTS[unlockIndex];
    const key = String(startDepth);
    if (state.startDepthUnlocks[key]) return false;
    state.startDepthUnlocks[key] = true;
    persistCampProgress();
    pushLog(`Checkpoint unlocked: start depth ${startDepth} available in camp.`, "good");
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
    state.runMods.enemyHpMult = 1.0;
    state.runMods.enemyDamageMult = 1.0;
    state.runMods.enemyAtkMult = 1.0;
    state.runMods.eliteHpMult = 1.0;
    state.runMods.momentumAtkBonus = 0;
    state.runMods.momentumBaseAtk = 0;
  }

  function applyCampUpgradesToRun() {
    const vitalityLevel = getCampUpgradeLevel("vitality");
    if (vitalityLevel > 0) {
      const hpMult = 1 + vitalityLevel * 0.1;
      state.player.maxHp = Math.round(state.player.maxHp * hpMult);
    }
    const bladeFlat = getCampUpgradeLevel("blade") * BLADE_ATTACK_FLAT_PER_LEVEL;
    if (bladeFlat > 0) {
      addScaledFlatAttack(bladeFlat);
    }
    const satchelLevel = getCampUpgradeLevel("satchel");
    state.player.potions += satchelLevel;
    state.player.maxPotions += satchelLevel;
    state.player.armor += scaledCombat(getCampUpgradeLevel("guard"));
    state.player.crit += getCampUpgradeLevel("crit_chance") * 0.05;
  }

  function getPotionHealAmount() {
    const bonus = scaledCombat(getCampUpgradeLevel("potion_strength") * 2);
    const base = randInt(scaledCombat(4) + bonus, scaledCombat(6) + bonus);
    let heal = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(base * state.runMods.potionHealMult));
    // Titan's Heart: +30% potion healing.
    if (hasRelic("titanheart")) {
      heal = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(heal * 1.3));
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

  function getChestAttackBucketIndex(depth = state.depth) {
    const safeDepth = Math.max(0, Number(depth) || 0);
    return Math.floor(safeDepth / CHEST_ATTACK_BUCKET_SIZE);
  }

  function getChestUpgradeDepthMultiplier(depth = state.depth) {
    const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
    if (safeDepth >= CHEST_UPGRADE_TIER_THREE_MIN_DEPTH) return CHEST_UPGRADE_TIER_THREE_MULT;
    if (safeDepth >= CHEST_UPGRADE_TIER_TWO_MIN_DEPTH) return CHEST_UPGRADE_TIER_TWO_MULT;
    return 1;
  }

  function getChestUpgradeFlatByDepth(baseFlat, depth = state.depth) {
    const base = Math.max(1, Number(baseFlat) || 1);
    const mult = getChestUpgradeDepthMultiplier(depth);
    const scaled = Math.max(1, Math.round(base * mult));
    if (mult > 1 && scaled <= base) {
      return base + 1;
    }
    return scaled;
  }

  function getChestUpgradeFlatByBucket(baseFlat, bucketIndex) {
    const safeBucket = Math.max(0, Math.floor(Number(bucketIndex) || 0));
    const bucketStartDepth = safeBucket * CHEST_ATTACK_BUCKET_SIZE;
    return getChestUpgradeFlatByDepth(baseFlat, bucketStartDepth);
  }

  function getChestHealthUpgradeFlatByDepth(depth = state.depth) {
    const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
    if (safeDepth >= CHEST_UPGRADE_TIER_THREE_MIN_DEPTH) return 10;
    if (safeDepth >= CHEST_UPGRADE_TIER_TWO_MIN_DEPTH) return 7;
    return CHEST_HEALTH_UPGRADE_FLAT;
  }

  function getChestHealthUpgradeFlatByBucket(bucketIndex) {
    const safeBucket = Math.max(0, Math.floor(Number(bucketIndex) || 0));
    const bucketStartDepth = safeBucket * CHEST_ATTACK_BUCKET_SIZE;
    return getChestHealthUpgradeFlatByDepth(bucketStartDepth);
  }

  function getChestAttackBucketLabel(bucketIndex) {
    const safeBucket = Math.max(0, Math.floor(Number(bucketIndex) || 0));
    const start = safeBucket * CHEST_ATTACK_BUCKET_SIZE;
    const end = start + CHEST_ATTACK_BUCKET_SIZE - 1;
    return `${start}-${end}`;
  }

  function getChestBucketCount(bucketMap, bucketIndex) {
    const key = String(Math.max(0, Math.floor(Number(bucketIndex) || 0)));
    return clamp(Number(bucketMap?.[key]) || 0, 0, CHEST_ATTACK_BUCKET_MAX);
  }

  function incrementChestBucketCount(bucketMap, bucketIndex) {
    const key = String(Math.max(0, Math.floor(Number(bucketIndex) || 0)));
    const next = clamp(getChestBucketCount(bucketMap, bucketIndex) + 1, 0, CHEST_ATTACK_BUCKET_MAX);
    bucketMap[key] = next;
    return next;
  }

  function getChestAttackBucketCount(bucketIndex) {
    return getChestBucketCount(state.sessionChestAttackDepthBuckets, bucketIndex);
  }

  function incrementChestAttackBucketCount(bucketIndex) {
    return incrementChestBucketCount(state.sessionChestAttackDepthBuckets, bucketIndex);
  }

  function getChestArmorBucketCount(bucketIndex) {
    return getChestBucketCount(state.sessionChestArmorDepthBuckets, bucketIndex);
  }

  function incrementChestArmorBucketCount(bucketIndex) {
    return incrementChestBucketCount(state.sessionChestArmorDepthBuckets, bucketIndex);
  }

  function getChestHealthBucketCount(bucketIndex) {
    return getChestBucketCount(state.sessionChestHealthDepthBuckets, bucketIndex);
  }

  function incrementChestHealthBucketCount(bucketIndex) {
    return incrementChestBucketCount(state.sessionChestHealthDepthBuckets, bucketIndex);
  }

  function resetSessionChestBonuses() {
    state.sessionChestAttackFlat = 0;
    state.sessionChestAttackDepthBuckets = {};
    state.sessionChestArmorFlat = 0;
    state.sessionChestArmorDepthBuckets = {};
    state.sessionChestHealthFlat = 0;
    state.sessionChestHealthDepthBuckets = {};
  }

  function applySessionChestAttackBonusToRun() {
    const carryFlat = Math.max(0, Number(state.sessionChestAttackFlat) || 0);
    if (carryFlat <= 0) return 0;
    return addScaledFlatAttack(carryFlat);
  }

  function applySessionChestArmorBonusToRun() {
    const carryFlat = Math.max(0, Number(state.sessionChestArmorFlat) || 0);
    if (carryFlat <= 0) return 0;
    state.player.armor += carryFlat;
    return carryFlat;
  }

  function applySessionChestHealthBonusToRun() {
    const carryFlat = Math.max(0, Number(state.sessionChestHealthFlat) || 0);
    if (carryFlat <= 0) return 0;
    state.player.maxHp += carryFlat;
    return carryFlat;
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

  function getShieldChargeMaxByTier(tier = getSkillTier("shield")) {
    return tier >= 2 ? SHIELD_EPIC_CHARGE_MAX : 1;
  }

  function ensureShieldChargeState() {
    const tier = getSkillTier("shield");
    const maxCharges = getShieldChargeMaxByTier(tier);
    if (!Number.isFinite(state.player.shieldStoredDamage)) {
      state.player.shieldStoredDamage = 0;
    }
    if (tier < LEGENDARY_SKILL_TIER) {
      state.player.shieldStoredDamage = 0;
    }
    if (tier < 2) {
      state.player.shieldCharges = 1;
      state.player.shieldChargeRegenTurns = 0;
      return { enabled: false, max: 1, charges: 1, regenTurns: 0 };
    }
    if (!Number.isFinite(state.player.shieldCharges)) {
      state.player.shieldCharges = maxCharges;
    }
    if (!Number.isFinite(state.player.shieldChargeRegenTurns)) {
      state.player.shieldChargeRegenTurns = 0;
    }
    state.player.shieldCharges = clamp(Math.floor(state.player.shieldCharges), 0, maxCharges);
    state.player.shieldChargeRegenTurns = clamp(
      Math.floor(state.player.shieldChargeRegenTurns),
      0,
      SHIELD_EPIC_CHARGE_REGEN_TURNS
    );
    if (state.player.shieldCharges >= maxCharges) {
      state.player.shieldChargeRegenTurns = 0;
    } else if (state.player.shieldChargeRegenTurns <= 0) {
      state.player.shieldChargeRegenTurns = SHIELD_EPIC_CHARGE_REGEN_TURNS;
    }
    return {
      enabled: true,
      max: maxCharges,
      charges: state.player.shieldCharges,
      regenTurns: state.player.shieldChargeRegenTurns
    };
  }

  function getShieldChargesInfo() {
    return ensureShieldChargeState();
  }

  function consumeShieldCharge() {
    const info = ensureShieldChargeState();
    if (!info.enabled) return true;
    if (info.charges <= 0) return false;
    state.player.shieldCharges = Math.max(0, state.player.shieldCharges - 1);
    if (
      state.player.shieldCharges < info.max &&
      state.player.shieldChargeRegenTurns <= 0
    ) {
      state.player.shieldChargeRegenTurns = SHIELD_EPIC_CHARGE_REGEN_TURNS;
    }
    return true;
  }

  function tickShieldChargeRegen() {
    const info = ensureShieldChargeState();
    if (!info.enabled) return;
    if (state.player.shieldCharges >= info.max) {
      state.player.shieldChargeRegenTurns = 0;
      return;
    }
    if (state.player.shieldChargeRegenTurns > 0) {
      state.player.shieldChargeRegenTurns -= 1;
    }
    if (state.player.shieldChargeRegenTurns > 0) return;
    state.player.shieldCharges = Math.min(info.max, state.player.shieldCharges + 1);
    if (state.player.shieldCharges < info.max) {
      state.player.shieldChargeRegenTurns = SHIELD_EPIC_CHARGE_REGEN_TURNS;
    } else {
      state.player.shieldChargeRegenTurns = 0;
    }
    pushLog(`Shield charge restored (${state.player.shieldCharges}/${info.max}).`, "good");
  }

  function triggerLegendaryShieldBlast() {
    const stored = Math.max(0, Math.round(Number(state.player.shieldStoredDamage) || 0));
    if (stored <= 0 || state.phase !== "playing") return;
    const ring1Damage = Math.max(
      MIN_EFFECTIVE_DAMAGE,
      Math.round(stored * SHIELD_LEGENDARY_BLAST_RING1_MULTIPLIER)
    );
    const ring2Damage = Math.max(
      MIN_EFFECTIVE_DAMAGE,
      Math.round(stored * SHIELD_LEGENDARY_BLAST_RING2_MULTIPLIER)
    );
    let hitCount = 0;
    let killCount = 0;
    for (const enemy of [...state.enemies]) {
      if (!state.enemies.includes(enemy)) continue;
      const dist = Math.max(Math.abs(enemy.x - state.player.x), Math.abs(enemy.y - state.player.y));
      if (dist > 2) continue;
      const blastDamage = dist <= 1 ? ring1Damage : ring2Damage;
      enemy.hp -= blastDamage;
      triggerEnemyHitFlash(enemy);
      spawnFloatingText(enemy.x, enemy.y, `-${blastDamage}`, "#d7ecff");
      spawnParticles(enemy.x, enemy.y, "#b7d8ff", 8, 1.05);
      hitCount += 1;
      if (enemy.hp <= 0) {
        killEnemy(enemy, "aegis counter");
        killCount += 1;
      }
    }
    spawnShockwaveRing(state.player.x, state.player.y, {
      color: "#b7d8ff",
      core: "#ecf6ff",
      maxRadius: TILE * 2.1,
      life: 260
    });
    spawnShockwaveRing(state.player.x, state.player.y, {
      color: "#8fb8ff",
      core: "#d8e9ff",
      maxRadius: TILE * 3.6,
      life: 320
    });
    pushLog(
      `Aegis Counter bursts: ${hitCount} hit${hitCount === 1 ? "" : "s"}${killCount > 0 ? `, ${killCount} kill${killCount === 1 ? "" : "s"}` : ""
      }.`,
      "good"
    );
    state.player.shieldStoredDamage = 0;
  }

  function tickBarrier() {
    const shieldTier = getSkillTier("shield");
    const currentShield = Math.max(0, Math.floor(Number(state.player.skillShield) || 0));
    if (currentShield <= 0) {
      if (state.playerShieldBrokeThisTurn && shieldTier >= LEGENDARY_SKILL_TIER) {
        triggerLegendaryShieldBlast();
      } else if (shieldTier < LEGENDARY_SKILL_TIER) {
        state.player.shieldStoredDamage = 0;
      }
      state.player.skillShield = 0;
      state.playerShieldBrokeThisTurn = false;
      return;
    }
    if (state.playerShieldBrokeThisTurn) {
      state.playerShieldBrokeThisTurn = false;
      return;
    }
    const nextShield = Math.max(0, Math.floor(currentShield * 0.8));
    state.player.skillShield = nextShield;
    if (nextShield <= 0) {
      if (shieldTier >= LEGENDARY_SKILL_TIER) {
        triggerLegendaryShieldBlast();
      } else {
        state.player.shieldStoredDamage = 0;
      }
    }
  }

  function isShieldActive() {
    return Math.max(0, Number(state.player.skillShield) || 0) > 0;
  }

  function isEpicShieldReflectActive() {
    return isShieldActive() && getSkillTier("shield") >= 2;
  }

  function handleShieldAbsorbEffects(_sourceLabel, attacker = null, absorbedSkillShield = 0) {
    const absorbed = Math.max(0, Math.round(Number(absorbedSkillShield) || 0));
    if (absorbed <= 0) return false;

    spawnParticles(state.player.x, state.player.y, "#a9cfff", 6, 0.95);
    setShake(0.9);

    if (getSkillTier("shield") >= LEGENDARY_SKILL_TIER) {
      const storeGain = Math.max(
        0,
        Math.round(absorbed * SHIELD_LEGENDARY_STORE_MULTIPLIER)
      );
      if (storeGain > 0) {
        const storeCap = Math.max(
          MIN_EFFECTIVE_DAMAGE,
          Math.round(Math.max(1, Number(state.player.maxHp) || 1) * SHIELD_LEGENDARY_STORE_CAP_MULTIPLIER)
        );
        const nextStored = Math.max(0, Number(state.player.shieldStoredDamage) || 0) + storeGain;
        state.player.shieldStoredDamage = Math.min(storeCap, nextStored);
      }
    }

    const isMeleeAttacker = Boolean(
      attacker &&
      Number.isFinite(attacker.x) &&
      Number.isFinite(attacker.y) &&
      Math.max(Math.abs(attacker.x - state.player.x), Math.abs(attacker.y - state.player.y)) <= 1
    );
    if (
      attacker &&
      state.phase === "playing" &&
      getSkillTier("shield") >= 2 &&
      state.enemies.includes(attacker) &&
      isMeleeAttacker
    ) {
      const reflectDamage = Math.max(
        MIN_EFFECTIVE_DAMAGE,
        Math.round(absorbed * SHIELD_EPIC_REFLECT_MULTIPLIER)
      );
      attacker.hp -= reflectDamage;
      triggerEnemyHitFlash(attacker);
      spawnFloatingText(attacker.x, attacker.y, `-${reflectDamage}`, "#e6f2ff");
      spawnParticles(attacker.x, attacker.y, "#b7d8ff", 9, 1.1);
      pushLog(`Shield counter hits ${attacker.name} for ${reflectDamage}.`, "good");
      if (attacker.hp <= 0) {
        killEnemy(attacker, "shield reflect");
      }
    }
    markUiDirty();
    return true;
  }

  function tickDashAfterline() {
    const afterline = state.player.dashAfterline;
    if (!afterline || typeof afterline !== "object") return;
    const turns = Math.max(0, Number(afterline.turns) || 0);
    if (turns <= 0 || !Array.isArray(afterline.tiles) || afterline.tiles.length <= 0) {
      state.player.dashAfterline = null;
      return;
    }

    const tileSet = new Set(afterline.tiles.map((tile) => tileKey(tile.x, tile.y)));
    const afterlineDamage = Math.max(
      MIN_EFFECTIVE_DAMAGE,
      Math.round(Math.max(0, Number(state.player.attack) || 0) * 0.4)
    );
    let hitCount = 0;
    let killCount = 0;
    for (const enemy of [...state.enemies]) {
      if (!state.enemies.includes(enemy)) continue;
      if (!tileSet.has(tileKey(enemy.x, enemy.y))) continue;
      enemy.hp -= afterlineDamage;
      triggerEnemyHitFlash(enemy);
      spawnFloatingText(enemy.x, enemy.y, `-${afterlineDamage}`, "#bfe7ff");
      spawnParticles(enemy.x, enemy.y, "#7fc9ff", 7, 1.0);
      hitCount += 1;
      if (enemy.hp <= 0) {
        killEnemy(enemy, "void afterline");
        killCount += 1;
      }
    }

    afterline.turns = turns - 1;
    if (hitCount > 0) {
      pushLog(
        `Void afterline hits ${hitCount} ${hitCount === 1 ? "enemy" : "enemies"}${killCount > 0 ? ` (${killCount} kill${killCount === 1 ? "" : "s"})` : ""
        }.`,
        "good"
      );
    }
    if (afterline.turns <= 0) {
      state.player.dashAfterline = null;
      pushLog("Void afterline fades.", "warn");
    }
  }

  function tryAutoPotion(triggerLabel = "low HP") {
    if (state.phase !== "playing") return false;
    if (getCampUpgradeLevel("auto_potion") < 1) return false;
    if (hasRelic("risk")) return false;
    if (state.player.hp <= 0 || state.player.hp > AUTO_POTION_TRIGGER_HP) return false;
    if (state.player.autoPotionCooldown > 0) return false;
    if (state.player.potions <= 0) return false;

    state.player.potions -= 1;
    state.player.autoPotionCooldown = AUTO_POTION_INTERNAL_COOLDOWN_TURNS;
    state.potionsUsedThisRun = (state.potionsUsedThisRun || 0) + 1;
    state.potionUsedInRoom = true;
    state.potionFreeRoomStreak = 0;
    const healResult = healPlayer(getPotionHealAmount(), {
      visuals: true,
      textColor: "#9ff7a9",
      particleColor: "#8ce1a7",
      particleCount: 12,
      particleSpread: 1.1
    });
    applyQuickloaderPotionBuff();
    pushLog(
      `Auto Potion (${triggerLabel}): +${healResult.restored} HP${healResult.shielded > 0 ? `, +${healResult.shielded} shield` : ""} (CD ${AUTO_POTION_INTERNAL_COOLDOWN_TURNS} turns).`,
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

  function isDashImmunityActive() {
    return (state.player?.dashImmunityTurns || 0) > 0;
  }

  function tickDashImmunity() {
    if (state.player.dashImmunityTurns > 0) {
      state.player.dashImmunityTurns -= 1;
      if (state.player.dashImmunityTurns < 0) {
        state.player.dashImmunityTurns = 0;
      }
    }
  }

  function applyTimedShrineStatBlessing({
    bonusKey,
    turnsKey,
    statKey,
    bonusAmount,
    turns,
    minValue = 0
  }) {
    const safeBonus = Math.max(0, Math.round(Number(bonusAmount) || 0));
    const safeTurns = Math.max(1, Math.round(Number(turns) || 0));
    const prevBonus = Math.max(0, Number(state.player[bonusKey]) || 0);
    if (prevBonus > 0) {
      state.player[statKey] = Math.max(minValue, (Number(state.player[statKey]) || 0) - prevBonus);
    }
    state.player[bonusKey] = safeBonus;
    state.player[turnsKey] = safeTurns;
    state.player[statKey] = Math.max(minValue, (Number(state.player[statKey]) || 0) + safeBonus);
    if (statKey === "maxHp") {
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
    }
  }

  function tickTimedShrineStatBlessing({
    bonusKey,
    turnsKey,
    statKey,
    minValue = 0,
    fadeLog
  }) {
    if ((state.player[turnsKey] || 0) <= 0) {
      state.player[turnsKey] = 0;
      return false;
    }
    state.player[turnsKey] -= 1;
    if (state.player[turnsKey] > 0) return false;

    state.player[turnsKey] = 0;
    const bonus = Math.max(0, Number(state.player[bonusKey]) || 0);
    state.player[bonusKey] = 0;
    if (bonus <= 0) return false;

    state.player[statKey] = Math.max(minValue, (Number(state.player[statKey]) || 0) - bonus);
    if (statKey === "maxHp") {
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
    }
    if (fadeLog) {
      pushLog(fadeLog, "bad");
    }
    return true;
  }

  function tickCombatBoost() {
    if (state.player.combatBoostTurns > 0) {
      state.player.combatBoostTurns -= 1;
      if (state.player.combatBoostTurns <= 0) {
        state.player.combatBoostTurns = 0;
        state.player.attack = Math.max(MIN_EFFECTIVE_DAMAGE, state.player.attack - 20);
        state.player.armor = Math.max(0, state.player.armor - 20);
        pushLog("Combat Boost fades.", "bad");
      }
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
    tickTimedShrineStatBlessing({
      bonusKey: "shrineAttackBonus",
      turnsKey: "shrineAttackTurns",
      statKey: "attack",
      minValue: MIN_EFFECTIVE_DAMAGE,
      fadeLog: "Shrine blessing fades: Attack bonus expired."
    });
    tickTimedShrineStatBlessing({
      bonusKey: "shrineArmorBonus",
      turnsKey: "shrineArmorTurns",
      statKey: "armor",
      minValue: 0,
      fadeLog: "Shrine blessing fades: Armor bonus expired."
    });
    tickTimedShrineStatBlessing({
      bonusKey: "shrineMaxHpBonus",
      turnsKey: "shrineMaxHpTurns",
      statKey: "maxHp",
      minValue: scaledCombat(BASE_PLAYER_HP),
      fadeLog: "Shrine blessing fades: Max HP bonus expired."
    });
    if (state.player.shrineSwapTurns > 0) {
      state.player.shrineSwapTurns -= 1;
      if (state.player.shrineSwapTurns <= 0) {
        state.player.shrineSwapTurns = 0;
        state.player.shrineSwapCounter = 0;
        pushLog("Shrine blessing fades: Swapping expired.", "bad");
      }
    }
    if (state.player.shrineNoiseTurns > 0) {
      state.player.shrineNoiseTurns -= 1;
      if (state.player.shrineNoiseTurns <= 0) {
        state.player.shrineNoiseTurns = 0;
        pushLog("Shrine blessing fades: Noise expired.", "bad");
      }
    }
    if (state.player.shrineHungerTurns > 0) {
      state.player.shrineHungerTurns -= 1;
      if (state.player.shrineHungerTurns <= 0) {
        state.player.shrineHungerTurns = 0;
        pushLog("Shrine blessing fades: Hunger expired.", "bad");
      }
    }
    if (state.player.engineOfWarTurns > 0) {
      state.player.engineOfWarTurns -= 1;
      if (state.player.engineOfWarTurns <= 0) {
        state.player.engineOfWarTurns = 0;
        pushLog("Engine of War overdrive fades.", "warn");
      }
    }
  }

  function triggerShrineSwappingIfReady() {
    if ((state.player.shrineSwapTurns || 0) <= 0) {
      state.player.shrineSwapCounter = 0;
      return false;
    }
    state.player.shrineSwapCounter = Math.max(0, Number(state.player.shrineSwapCounter) || 0) + 1;
    if (state.player.shrineSwapCounter < SHRINE_SWAPPING_INTERVAL_TURNS) return false;
    if (!Array.isArray(state.enemies) || state.enemies.length <= 0) return false;
    state.player.shrineSwapCounter = 0;
    const randomEnemy = state.enemies[Math.floor(Math.random() * state.enemies.length)];
    if (!randomEnemy) return false;
    const px = state.player.x;
    const py = state.player.y;
    startTween(state.player);
    startTween(randomEnemy);
    state.player.x = randomEnemy.x;
    state.player.y = randomEnemy.y;
    randomEnemy.x = px;
    randomEnemy.y = py;
    spawnParticles(state.player.x, state.player.y, "#c0e7ff", 8, 1.1);
    spawnParticles(randomEnemy.x, randomEnemy.y, "#c0e7ff", 8, 1.1);
    pushLog(`Shrine of Swapping triggers: switched with ${randomEnemy.name}.`, "warn");
    return true;
  }

  function applyShrineHungerMissPenalty() {
    if ((state.player.shrineHungerTurns || 0) <= 0) return false;
    if (state.playerHitEnemyThisTurn) return false;
    if (isDebugGodModeActive()) {
      pushLog("Shrine of Hunger: miss penalty ignored (God Mode).", "warn");
      return false;
    }
    const hungerAbsorb = absorbPlayerShieldDamage(SHRINE_HUNGER_MISS_DAMAGE);
    handleShieldAbsorbEffects("hunger", null, hungerAbsorb.skillShieldAbsorbed);
    const hungerDamage = hungerAbsorb.remaining;
    if (hungerDamage <= 0) {
      pushLog("Shrine of Hunger: miss penalty absorbed by shield.", "good");
      return false;
    }
    state.player.hp -= hungerDamage;
    tryTriggerEngineOfWarEmergency("hunger");
    triggerPlayerHitFlash();
    spawnFloatingText(state.player.x, state.player.y, `-${hungerDamage}`, "#ff7676");
    // silent — log would spam every turn without a hit
    tryAutoPotion("hunger");
    if (state.player.hp <= 0) {
      if (tryTriggerChronoLoop("hunger")) {
        return true;
      }
      gameOver(`Hunger consumed you at depth ${state.depth}.`);
      return true;
    }
    return false;
  }

  function getAscensionEnemyAtkMult() {
    if (!isMutatorActive("ascension")) return 1.0;
    const levels = Math.floor((state.runMaxDepth || 0) / 3);
    return 1.0 + (levels * 0.03);
  }

  function updateMomentumBonus() {
    if (!isMutatorActive("momentum")) return;
    const baseAtk = state.runMods.momentumBaseAtk || state.player.attack;
    if (!state.runMods.momentumBaseAtk) {
      state.runMods.momentumBaseAtk = state.player.attack;
    }
    const newBonus = Math.round(baseAtk * (state.runMaxDepth || 0) * 0.015);
    const oldBonus = state.runMods.momentumAtkBonus || 0;
    const delta = newBonus - oldBonus;
    if (delta > 0) {
      state.player.attack += delta;
      state.runMods.momentumAtkBonus = newBonus;
    }
  }

  function updateDepthScalingMutators() {
    updateMomentumBonus();
    state.runMods.enemyAtkMult = getAscensionEnemyAtkMult();
  }

  function applyResilienceShield() {
    if (!isMutatorActive("resilience")) return;
    // Top up hpShield to at least 20% maxHp on room entry.
    // Math.max ensures we never reduce a higher shield (e.g. stacked from a shrine).
    const resShield = Math.floor(state.player.maxHp * 0.20);
    state.player.hpShield = Math.max(Number(state.player.hpShield) || 0, resShield);
    capPlayerHpShield();
  }

  function applyMutatorsToRun() {
    resetRunModifiers();

    if (isMutatorActive("berserker")) {
      state.player.attack = Math.round(state.player.attack * 1.25);
      state.player.maxHp = Math.round(state.player.maxHp * 0.75);
    }
    if (isMutatorActive("bulwark")) {
      state.player.armor = Math.round(state.player.armor * 1.30);
      state.player.attack = Math.round(state.player.attack * 0.80);
    }
    if (isMutatorActive("alchemist")) {
      state.player.maxPotions += 2;
      state.player.potions = Math.min(state.player.potions + 2, state.player.maxPotions);
      state.runMods.potionHealMult *= 1.30;
      state.runMods.chestHealPenalty = 999;
    }
    if (isMutatorActive("greed")) {
      state.runMods.goldMultiplier += 0.40;
      state.runMods.extraEnemies += 2;
      state.runMods.enemyHpMult *= 1.20;
      state.runMods.shopCostMult *= 1.25;
    }
    if (isMutatorActive("hunter")) {
      state.player.crit = Math.min(CRIT_CHANCE_CAP, state.player.crit + 0.20);
      state.runMods.enemyDamageMult *= 1.25;
    }
    if (isMutatorActive("resilience")) {
      state.runMods.enemyDamageMult *= 1.20;
    }
    if (isMutatorActive("momentum")) {
      state.runMods.enemyDamageMult *= 1.15;
    }
    if (isMutatorActive("famine")) {
      state.player.maxHp = Math.round(state.player.maxHp * 1.30);
      state.player.maxPotions = Math.max(1, state.player.maxPotions - 3);
      state.player.potions = Math.min(state.player.potions, state.player.maxPotions);
      state.runMods.potionHealMult *= 0.50;
      state.runMods.noMerchants = false;
    }
    if (isMutatorActive("elitist")) {
      state.runMods.eliteChance += 0.30;
      state.runMods.eliteHpMult *= 1.25;
      state.runMods.eliteGoldMult *= 1.60;
    }
    if (isMutatorActive("ascension")) {
      state.runMods.extraRelicChoices += 1;
    }

    // Task 8: Uniform gold bonus — +20% per active mutator except Greed
    for (const mutator of MUTATORS) {
      if (mutator.id === "greed") continue;
      if (isMutatorActive(mutator.id)) {
        state.runMods.goldMultiplier += 0.20;
      }
    }

    // Clamp player stats to sane bounds
    state.player.maxHp = clamp(state.player.maxHp, scaledCombat(4), scaledCombat(40));
    state.player.attack = clamp(state.player.attack, scaledCombat(1), scaledCombat(500));
    state.player.armor = clamp(state.player.armor, 0, scaledCombat(10));
    state.player.crit = clamp(state.player.crit, 0.01, CRIT_CHANCE_CAP);
    state.player.hp = Math.min(state.player.hp, state.player.maxHp);
  }

  function applyMutatorMidRun(id) {
    if (id === "berserker") {
      state.player.attack = Math.round(state.player.attack * 1.25);
      state.player.maxHp = Math.round(state.player.maxHp * 0.75);
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
    } else if (id === "bulwark") {
      state.player.armor = Math.round(state.player.armor * 1.30);
      state.player.attack = Math.round(state.player.attack * 0.80);
    } else if (id === "alchemist") {
      state.player.maxPotions += 2;
      state.runMods.potionHealMult = (state.runMods.potionHealMult || 1.0) * 1.30;
      state.runMods.chestHealPenalty = 999;
    } else if (id === "greed") {
      state.runMods.goldMultiplier += 0.40;
      state.runMods.extraEnemies += 2;
      state.runMods.enemyHpMult = (state.runMods.enemyHpMult || 1.0) * 1.20;
      state.runMods.shopCostMult = (state.runMods.shopCostMult || 1.0) * 1.25;
    } else if (id === "hunter") {
      state.player.crit = Math.min(CRIT_CHANCE_CAP, state.player.crit + 0.20);
      state.runMods.enemyDamageMult = (state.runMods.enemyDamageMult || 1.0) * 1.25;
    } else if (id === "resilience") {
      state.runMods.enemyDamageMult = (state.runMods.enemyDamageMult || 1.0) * 1.20;
      applyResilienceShield();
    } else if (id === "momentum") {
      state.runMods.enemyDamageMult = (state.runMods.enemyDamageMult || 1.0) * 1.15;
      updateDepthScalingMutators();
    } else if (id === "famine") {
      state.player.maxHp = Math.round(state.player.maxHp * 1.30);
      state.player.maxPotions = Math.max(1, state.player.maxPotions - 3);
      state.player.potions = Math.min(state.player.potions, state.player.maxPotions);
      state.runMods.potionHealMult = (state.runMods.potionHealMult || 1.0) * 0.50;
    } else if (id === "elitist") {
      state.runMods.eliteChance += 0.30;
      state.runMods.eliteHpMult = (state.runMods.eliteHpMult || 1.0) * 1.25;
      state.runMods.eliteGoldMult = (state.runMods.eliteGoldMult || 1.0) * 1.60;
    } else if (id === "ascension") {
      state.runMods.extraRelicChoices += 1;
      updateDepthScalingMutators();
    }
    if (id !== "greed") {
      state.runMods.goldMultiplier += 0.20;
    }
    const mutDef = MUTATORS.find(m => m.id === id);
    if (mutDef) {
      pushLog(`${mutDef.name} activated! Effects now in play.`, "good");
    }
    saveRunSnapshot();
    markUiDirty();
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
    setStorageItem(STORAGE_TOTAL_GOLD, String(state.totalGoldEarned));
    return scaled;
  }

  function grantPotion(count = 1) {
    const before = state.player.potions;
    state.player.potions = Math.min(state.player.maxPotions, state.player.potions + count);
    return state.player.potions - before;
  }

  function isBonfireFloorTile(x, y) {
    return getFloorTilesetId(state.floorPattern?.[y]?.[x] ?? 0) === TILESET_IDS.floorBonfire;
  }

  function randomFreeTile(occupied, options = {}) {
    const avoidBonfire = Boolean(options.avoidBonfire);
    const candidates = [];
    for (let y = 1; y <= GRID_SIZE - 2; y += 1) {
      for (let x = 1; x <= GRID_SIZE - 2; x += 1) {
        if (occupied.has(tileKey(x, y))) continue;
        if (avoidBonfire && isBonfireFloorTile(x, y)) continue;
        candidates.push({ x, y });
      }
    }
    if (candidates.length <= 0) return null;
    const choice = candidates[randInt(0, candidates.length - 1)];
    occupied.add(tileKey(choice.x, choice.y));
    return choice;
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
    if (state.depth <= 14) {
      if (roll < 0.38) return "slime";
      if (roll < 0.7) return "skeleton";
      if (roll < 0.92) return "brute";
      return "acolyte";
    }
    if (state.depth <= 24) {
      if (roll < 0.28) return "slime";
      if (roll < 0.52) return "skeleton";
      if (roll < 0.72) return "brute";
      if (roll < 0.88) return "acolyte";
      return "skitter";
    }
    if (roll < 0.2) return "slime";
    if (roll < 0.4) return "skeleton";
    if (roll < 0.58) return "brute";
    if (roll < 0.78) return "acolyte";
    return "skitter";
  }

  function countEnemiesByType(type) {
    let count = 0;
    for (const enemy of state.enemies) {
      if (enemy?.type === type) count += 1;
    }
    return count;
  }

  function rollEnemyTypeWithoutAcolyte() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const reroll = rollEnemyType();
      if (reroll !== "acolyte") return reroll;
    }
    if (state.depth >= 15) return "skitter";
    if (state.depth >= 11) return "brute";
    return "skeleton";
  }

  function rollEnemyTypeWithCaps() {
    let type = rollEnemyType();
    if (type === "acolyte" && countEnemiesByType("acolyte") >= MAX_ACOLYTES_PER_ROOM) {
      type = rollEnemyTypeWithoutAcolyte();
    }
    return type;
  }

  function createEnemy(type, x, y, options = {}) {
    const depthScale = Math.floor(state.depth / 2);
    let enemy;
    if (type === "skeleton") {
      enemy = {
        type,
        name: "Skeleton",
        x,
        y,
        hp: scaledCombat(4 + depthScale),
        attack: scaledCombat(1 + Math.floor(state.depth / 4)),
        range: 3,
        cooldown: 0,
        aiming: false
      };
    } else if (type === "acolyte") {
      enemy = {
        type,
        name: "Acolyte",
        x,
        y,
        hp: scaledCombat(4 + depthScale),
        attack: scaledCombat(2 + Math.floor(state.depth / 5)),
        range: 4,
        cooldown: 0,
        aiming: false
      };
    } else if (type === "skitter") {
      enemy = {
        type,
        name: "Skitter",
        x,
        y,
        hp: scaledCombat(3 + depthScale),
        attack: scaledCombat(2 + Math.floor(state.depth / 4)),
        cooldown: 0
      };
    } else if (type === "brute") {
      enemy = {
        type,
        name: "Brute",
        x,
        y,
        hp: scaledCombat(7 + state.depth),
        attack: scaledCombat(3 + Math.floor(state.depth / 3)),
        cooldown: 0,
        rests: false
      };
    } else if (type === "guardian") {
      enemy = {
        type,
        name: "Guardian",
        x,
        y,
        hp: scaledCombat(12 + Math.floor(state.depth * 1.8)),
        attack: scaledCombat(4 + Math.floor(state.depth / 3)),
        cooldown: 0,
        rests: false
      };
    } else if (type === "warden") {
      enemy = {
        type,
        name: "Warden",
        x,
        y,
        hp: scaledCombat(16 + state.depth * 2),
        attack: scaledCombat(4 + Math.floor(state.depth / 3)),
        range: 4,
        cooldown: 0,
        aiming: false
      };
    } else {
      enemy = {
        type: "slime",
        name: "Slime",
        x,
        y,
        hp: scaledCombat(3 + depthScale),
        attack: scaledCombat(1 + Math.floor(state.depth / 5))
      };
    }

    // Mutator: enemy HP multiplier (replaces old flat enemyHpBonus).
    if (state.runMods.enemyHpMult && state.runMods.enemyHpMult !== 1.0) {
      enemy.hp = Math.round(enemy.hp * state.runMods.enemyHpMult);
    }
    // (enemyAtkPerDepth removed — Ascension now uses getAscensionEnemyAtkMult() via getEnemyEffectiveAttack())

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
    enemy.disorientedTurns = 0;
    enemy.hitFlash = 0;
    enemy.facing = "south";
    enemy.intent = "chase";
    enemy.slamAiming = false;
    enemy.acolyteCastType = "";
    enemy.acolyteBuffTurns = Math.max(0, Number(enemy.acolyteBuffTurns) || 0);
    enemy.aiLastSeenX = x;
    enemy.aiLastSeenY = y;
    enemy.aiMemoryTtl = 0;
    enemy.aiPersonality = Math.random() * 2 - 1;
    if (enemyTactics && typeof enemyTactics.ensureEnemyState === "function") {
      enemyTactics.ensureEnemyState(enemy);
    }
    snapVisual(enemy);

    if (options.elite && enemy.type !== "warden" && state.depth >= 6) {
      enemy.elite = true;
      enemy.rewardBonus += 3;
      enemy.hp = Math.round(enemy.hp * 1.4);
      // Mutator: eliteHpMult applied after base elite scaling and after enemyHpMult.
      if (state.runMods.eliteHpMult && state.runMods.eliteHpMult !== 1.0) {
        enemy.hp = Math.round(enemy.hp * state.runMods.eliteHpMult);
      }
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
      const merchantSpot =
        randomFreeTile(occupied, { avoidBonfire: true }) ||
        randomFreeTile(occupied);
      if (!merchantSpot) return;
      state.merchant = { x: merchantSpot.x, y: merchantSpot.y };
      state.runMerchantRoomsSeen = Math.max(0, Number(state.runMerchantRoomsSeen) || 0) + 1;
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
    } else if (state.roomType === "vault") {
      enemyCount = 1;
      chestCount = randInt(5, 10);
      spikeCount = randInt(0, 2);
    }
    if (state.roomType !== "treasure" && state.roomType !== "vault") {
      chestCount = rollChestCountWithChance(chestCount, NON_TREASURE_CHEST_CHANCE);
    }

    // +500% spikes (x6) with hard cap (60% of room) and reserved space for player/portal.
    const shrineSlots = state.roomType === "shrine" ? 1 : 0;
    const reservedTiles = 2 + enemyCount + chestCount + shrineSlots;
    const maxSpikesByRoom = Math.max(
      0,
      Math.min(MAX_SPIKES_PER_ROOM, ROOM_INNER_TILES - reservedTiles)
    );
    spikeCount = clamp(Math.round(spikeCount * SPIKE_MULTIPLIER), 0, maxSpikesByRoom);

    const elitesEnabled = state.depth >= 6;
    let eliteChance = state.runMods.eliteChance + state.depth * 0.01;
    if (state.roomType === "treasure") eliteChance -= 0.06;
    if (state.roomType === "shrine") eliteChance += 0.03;
    if (state.roomType === "cursed") eliteChance += 0.22;
    eliteChance = clamp(eliteChance, 0.02, 0.75);

    for (let i = 0; i < enemyCount; i += 1) {
      const spot = randomFreeTile(occupied);
      const isVaultGuardian = state.roomType === "vault";
      const elite = !isVaultGuardian && elitesEnabled && chance(eliteChance);
      const enemyType = isVaultGuardian ? "guardian" : rollEnemyTypeWithCaps();
      state.enemies.push(createEnemy(enemyType, spot.x, spot.y, { elite }));
    }
    for (let i = 0; i < chestCount; i += 1) {
      const spot = randomFreeTile(occupied, { avoidBonfire: true });
      if (!spot) break;
      state.chests.push({ x: spot.x, y: spot.y, opened: false });
    }
    for (let i = 0; i < spikeCount; i += 1) {
      const spot = randomFreeTile(occupied, { avoidBonfire: true });
      if (!spot) break;
      state.spikes.push({ x: spot.x, y: spot.y });
    }

    if (state.roomType === "shrine") {
      const shrineSpot = randomFreeTile(occupied, { avoidBonfire: true });
      if (shrineSpot) {
        state.shrine = { x: shrineSpot.x, y: shrineSpot.y, used: false };
      }
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
      const type = rollEnemyTypeWithCaps();
      state.enemies.push(createEnemy(type, spot.x, spot.y, { elite: state.depth >= 6 && chance(0.3) }));
    }
    for (let i = 0; i < chestCount; i += 1) {
      const spot = randomFreeTile(occupied, { avoidBonfire: true });
      if (!spot) break;
      state.chests.push({ x: spot.x, y: spot.y, opened: false });
    }
    for (let i = 0; i < spikeCount; i += 1) {
      const spot = randomFreeTile(occupied, { avoidBonfire: true });
      if (!spot) break;
      state.spikes.push({ x: spot.x, y: spot.y });
    }
    pushLog(`Depth ${state.depth}: Warden chamber. Kill the mini-boss.`, "bad");
  }

  function buildRoom() {
    state.roomIndex += 1;
    state.roomCleared = false;
    state.potionUsedInRoom = false;
    state.extractConfirm = null;
    state.merchantMenuOpen = false;
    state.merchantUpgradeBoughtThisRoom = false;
    state.merchantRelicSlot = null;
    state.merchantServiceSlot = null;
    state.blackMarketPending = null;
    state.merchantRelicSwapPending = null;
    state.dashAimActive = false;
    state.bossRoom = isBossDepth();
    state.shrine = null;
    state.merchant = null;
    state.roomType = state.bossRoom ? "boss" : "combat";
    state.floorPattern = makeFloorPattern();
    state.player.x = 4;
    state.player.y = 4;
    state.enemyAntiStrafe = null;
    resetPlayerCombatTrail();
    snapVisual(state.player);
    state.player.adrenaline = hasRelic("adrenal") ? 2 : 0;
    if ((state.player.graveWhisperAtkBonus || 0) > 0) {
      state.player.attack = Math.max(
        MIN_EFFECTIVE_DAMAGE,
        (Number(state.player.attack) || 0) - Math.max(0, Number(state.player.graveWhisperAtkBonus) || 0)
      );
      state.player.graveWhisperAtkBonus = 0;
    }
    if (hasRelic("fieldrations")) {
      const fieldRationsHeal = healPlayer(FIELD_RATIONS_DEPTH_HEAL, {
        visuals: true,
        textColor: "#b8ef9b",
        particleColor: "#9ddf7f",
        particleCount: 8,
        particleSpread: 1.0
      });
      if (fieldRationsHeal.restored > 0 || fieldRationsHeal.shielded > 0) {
        pushLog(
          `Field Rations: +${fieldRationsHeal.restored} HP${fieldRationsHeal.shielded > 0 ? `, +${fieldRationsHeal.shielded} shield` : ""}.`,
          "good"
        );
      } else {
        pushLog("Field Rations consumed.", "good");
      }
    }

    const occupied = new Set([tileKey(state.player.x, state.player.y)]);
    state.enemies = [];
    state.chests = [];
    state.spikes = [];
    state.rangedBolts = [];
    state.rangedImpacts = [];
    state.shockwaveRings = [];
    state.dashTrails = [];
    state.floatingTexts = [];

    if (state.bossRoom) {
      buildBossRoom(occupied);
    } else {
      buildRegularRoom(occupied);
    }

    state.portal =
      randomFreeTile(occupied, { avoidBonfire: true }) ||
      randomFreeTile(occupied);
    carveSafeSpikePathToPortal();
    setupRoomIntroSplash();
    if (state.bossRoom) {
      playSfx("bosswarn");
    }
    syncBgmWithState();
    applyResilienceShield();
    markUiDirty();
  }

  function startRun(options = {}) {
    const carriedRelics = Array.isArray(options.carriedRelics)
      ? options.carriedRelics.filter((id) => typeof id === "string")
      : [];
    const carryRelics = carriedRelics.length > 0;
    const resetMapFragments = Boolean(options.resetMapFragments);
    const carriesSoulHarvest = carriedRelics.includes("soulharvest");
    const requestedStartDepth = clamp(Math.max(0, Math.floor(Number(options.startDepth) || 0)), 0, MAX_DEPTH);
    const selectedStartDepth = isStartDepthUnlocked(requestedStartDepth) ? requestedStartDepth : 0;
    const preservedSoulHarvestGained = carriesSoulHarvest
      ? clamp(Math.max(0, Number(state.player.soulHarvestGained) || 0), 0, 10)
      : 0;
    const preservedSoulHarvestCount = carriesSoulHarvest
      ? Math.max(0, Number(state.player.soulHarvestCount) || 0)
      : 0;
    stopSplashTrack(true);
    stopVictoryTrack(true);
    stopFinalGameOverTrack(true);
    state.phase = "playing";
    state.depth = selectedStartDepth;
    if (!state.currentRunId) {
      state.currentRunId = makeRunId();
      state.currentRunToken = "";
      state.currentRunTokenExpiresAt = 0;
      state.currentRunSubmitSeq = 1;
      state.runMaxDepth = 0;
      state.runGoldEarned = 0;
    }
    state.currentRunSubmitSeq = Math.max(1, Number(state.currentRunSubmitSeq) || 1);
    state.turn = 0;
    state.runStartDepth = selectedStartDepth;
    state.roomIndex = 0;
    state.bossRoom = false;
    state.roomType = "combat";
    if (resetMapFragments) {
      state.treasureMapFragments = 0;
      state.forcedNextRoomType = "";
    } else {
      state.treasureMapFragments = Math.max(0, Number(state.treasureMapFragments) || 0);
      state.forcedNextRoomType = state.forcedNextRoomType === "vault" ? "vault" : "";
    }
    state.runMerchantRoomsSeen = 0;
    state.shake = 0;
    state.flash = 0;
    state.turnInProgress = false;
    state.enemyTurnInProgress = false;
    state.enemyTurnQueue = [];
    state.enemyTurnStepTimer = 0;
    state.enemyTurnStepIndex = 0;
    state.enemyBlackboard = null;
    state.enemyAntiStrafe = null;
    state.enemyDebugPlans = [];
    state.particles = [];
    state.floatingTexts = [];
    state.rangedBolts = [];
    state.rangedImpacts = [];
    state.shockwaveRings = [];
    state.dashTrails = [];
    state.log = [];
    state.extractConfirm = null;
    state.extractRelicPrompt = null;
    state.campStartDepthPromptOpen = false;
    state.campStartDepthSelectionIndex = 0;
    state.lastDeathRelicLossText = "";
    state.finalGameOverPrompt = null;
    state.finalVictoryPrompt = null;
    state.simulation.lastGameOverReason = "";
    state.campVisitShopCostMult = 1;
    state.runLeaderboardSubmitted = false;
    state.lastBossClearDepthThisRun = 0;
    state.leaderboardModalOpen = false;
    state.nameModalOpen = false;
    state.nameModalAction = null;
    state.merchantMenuOpen = false;
    state.merchantUpgradeBoughtThisRoom = false;
    state.merchantSecondChancePurchases = 0;
    state.merchantRelicSlot = null;
    state.merchantServiceSlot = null;
    state.blackMarketPending = null;
    state.merchantRelicSwapPending = null;
    state.dashAimActive = false;
    state.relicDraft = null;
    state.legendarySwapPending = null;
    state.relicSwapPending = null;
    state.relics = [];
    state.wardenRelicMissStreak = 0;
    state.shrine = null;
    state.merchant = null;
    state.observerBot.currentRoomIndex = -1;
    state.observerBot.merchantPurchasesThisRoom = 0;
    state.observerBot.merchantDoneRoomIndex = -1;
    state.observerBot.stallTicks = 0;
    state.observerBot.lastDecision = "run_start";
    state.observerBot.traceRunSeq = Math.max(0, Number(state.observerBot.traceRunSeq) || 0) + 1;
    state.observerBot.traceLastSampleTurn = -1;
    state.observerBot.traceLastVampfangHeal = 0;

    state.merchantPotionsBought = 0;
    state.potionsUsedThisRun = 0;
    // killsThisRun, eliteKillsThisRun, shieldUsesThisRun are session-wide (reset only on game over)
    state.merchantPotsThisRun = 0;
    state.potionFreeRoomStreak = 0;
    state.potionUsedInRoom = false;
    state.player.hp = scaledCombat(BASE_PLAYER_HP);
    state.player.maxHp = scaledCombat(BASE_PLAYER_HP);
    state.player.attack = scaledCombat(BASE_PLAYER_ATTACK);
    state.player.vampfangHealRun = 0;
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
    state.player.gamblerEdgeArmorPenalty = 0;
    state.player.hpShield = 0;
    state.player.skillShield = 0;
    state.player.bloodVialShield = 0;
    state.player.engineOfWarTurns = 0;
    state.player.engineOfWarTriggeredDepth = -1;
    state.player.stormSigilHitCount = 0;
    state.player.graveWhisperAtkBonus = 0;
    state.player.quickloaderAtkBonus = 0;
    state.player.quickloaderAtkTurns = 0;
    state.player.soulHarvestCount = carriesSoulHarvest ? preservedSoulHarvestCount : 0;
    state.player.soulHarvestGained = carriesSoulHarvest ? preservedSoulHarvestGained : 0;
    state.player.chronoUsedThisRun = false;
    state.player.phaseCooldown = 0;
    state.player.titanAttackPenalty = 0;
    state.player.glassCannonHpPenalty = 0;
    state.player.chaosAtkBonus = 0;
    state.player.chaosAtkTurns = 0;
    state.player.chaosKillHeal = 0;
    state.player.chaosRollCounter = 0;
    state.player.hitFlash = 0;
    state.player.autoPotionCooldown = 0;
    state.player.dashImmunityTurns = 0;
    state.player.furyBlessingTurns = 0;
    state.player.combatBoostTurns = 0;
    state.player.hasSecondChance = false;
    state.player.shrineAttackBonus = 0;
    state.player.shrineAttackTurns = 0;
    state.player.shrineArmorBonus = 0;
    state.player.shrineArmorTurns = 0;
    state.player.shrineMaxHpBonus = 0;
    state.player.shrineMaxHpTurns = 0;
    state.player.shrineSwapTurns = 0;
    state.player.shrineSwapCounter = 0;
    state.player.shrineNoiseTurns = 0;
    state.player.shrineHungerTurns = 0;
    state.player.shieldCharges = 1;
    state.player.shieldChargeRegenTurns = 0;
    state.player.shieldStoredDamage = 0;
    state.player.dashAfterline = null;
    state.playerHitEnemyThisTurn = false;
    state.playerCombatTrail = [];
    state.skillCooldowns = sanitizeSkillCooldowns({});
    stopDeathTrack(true);

    // Note: unlockedMutators and activeMutators are NOT reset here.
    // Unlocks persist between runs within the same session.
    // Full reset happens in resetMetaProgressForFreshStart() on game over.

    applyCampUpgradesToRun();
    applyMutatorsToRun();
    if (carryRelics) {
      for (const relicId of carriedRelics) {
        applyRelic(relicId);
      }
      normalizeRelicInventory();
    }
    if (carriesSoulHarvest && preservedSoulHarvestGained > 0) {
      state.player.maxHp += preservedSoulHarvestGained * scaledCombat(1);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp);
    }
    ensureShieldChargeState();
    const carriedChestAttack = applySessionChestAttackBonusToRun();
    const carriedChestArmor = applySessionChestArmorBonusToRun();
    const carriedChestHealth = applySessionChestHealthBonusToRun();
    state.player.hp = state.player.maxHp;

    buildRoom();
    resetObserverBotStallTracker();
    syncBgmWithState(true);
    if (carryRelics) {
      pushLog(`New run started on depth ${selectedStartDepth} with ${state.relics.length} carried relics.`);
    } else {
      pushLog(`New run started on depth ${selectedStartDepth}.`);
    }
    if (carriedChestAttack > 0) {
      pushLog(`Session chest attack carried: +${carriedChestAttack} ATK.`, "good");
    }
    if (carriedChestArmor > 0) {
      pushLog(`Session chest armor carried: +${carriedChestArmor} ARM.`, "good");
    }
    if (carriedChestHealth > 0) {
      pushLog(`Session chest health carried: +${carriedChestHealth} Max HP.`, "good");
    }
    if (activeMutatorCount() > 0) {
      pushLog(`Active mutators: ${activeMutatorCount()}.`);
    }
    appendObserverBotTrace("run_start", {
      startDepth: selectedStartDepth,
      carriedRelics: state.relics.length,
      mutators: activeMutatorCount()
    }, { force: isObserverBotActive() });
    saveRunSnapshot();
    ensureOnlineRunSessionForCurrentRun(false);
    markUiDirty();
  }

  function launchVictoryFireworks() {
    const burstColors = ["#ffd95f", "#8ee9ff", "#ff8bc2", "#b78cff", "#8ce1a7"];
    state.flash = Math.max(state.flash, 260);
    setShake(6.8);
    for (let i = 0; i < 22; i += 1) {
      const x = randInt(1, GRID_SIZE - 2);
      const y = randInt(1, GRID_SIZE - 2);
      const color = burstColors[i % burstColors.length];
      spawnParticles(x, y, color, randInt(10, 20), 2.35);
      spawnShockwaveRing(x, y, {
        color,
        core: "#fff5dc",
        maxRadius: TILE * (1.8 + Math.random() * 2.1),
        life: randInt(260, 520)
      });
      if (chance(0.35)) {
        spawnRangedImpact(x, y, color);
      }
    }
    spawnParticles(state.player.x, state.player.y, "#ffe08e", 36, 2.8);
    spawnParticles(state.portal.x, state.portal.y, "#9deaff", 28, 2.4);
  }

  function triggerDepth100Victory() {
    if (state.phase !== "playing") return;
    const finalDepth = Math.max(MAX_DEPTH, Number(state.depth) || 0, getRunMaxDepth());
    state.depth = finalDepth;
    state.runMaxDepth = Math.max(state.runMaxDepth, finalDepth);
    const finalGold = getRunGoldEarned();
    const finalScore = calculateScore(finalDepth, finalGold);

    recordRunOnLeaderboard("extract");
    state.phase = "won";
    state.turnInProgress = false;
    state.playerShieldBrokeThisTurn = false;
    state.enemyTurnInProgress = false;
    state.enemyTurnQueue = [];
    state.enemyTurnStepTimer = 0;
    state.enemyTurnStepIndex = 0;
    state.enemyMeleeCommitLimit = 1;
    state.enemyMeleeCommitted = 0;
    state.enemyMeleeOverflowCommitted = 0;
    state.enemyBlackboard = null;
    state.enemyAntiStrafe = null;
    state.enemyDebugPlans = [];
    state.extractConfirm = null;
    state.merchantMenuOpen = false;
    state.relicDraft = null;
    state.legendarySwapPending = null;
    state.relicSwapPending = null;
    state.finalGameOverPrompt = null;
    state.simulation.lastGameOverReason = "";
    state.finalVictoryPrompt = {
      depth: finalDepth,
      gold: finalGold,
      score: finalScore
    };

    playSfx("portal");
    playSfx("chrono");
    launchVictoryFireworks();
    saveMetaProgress();
    clearRunSnapshot();
    syncBgmWithState();
    stopDeathTrack(true);
    stopFinalGameOverTrack(true);
    const usedVictoryTrack = playVictoryTrack();
    if (!usedVictoryTrack && !state.audioMuted) {
      playSfx("bosswarn");
    }
    pushLog(`DEPTH ${MAX_DEPTH} CONQUERED!`, "good");
    pushLog("Abyss shattered. You are the champion of the dungeon.", "good");
    pushLog("Victory achieved. 1 = Main Menu, 2 = Leaderboard.", "good");
    appendObserverBotTrace("run_victory", {
      finalDepth,
      finalGold,
      finalScore
    }, { force: isObserverBotActive() });
    markUiDirty();
  }

  function gameOver(reason) {
    if (state.phase !== "playing") return;
    if (state.player.hp <= 0 && tryTriggerChronoLoop("fatal blow")) {
      return;
    }
    if (state.player.hp <= 0 && state.player.hasSecondChance) {
      state.player.hasSecondChance = false;
      state.player.hp = Math.min(100, state.player.maxHp);
      pushLog("Second Chance activated! Survived with 100 HP.", "good");
      markUiDirty();
      return;
    }
    if (state.player.hp <= 0 && hasRelic("chronoloop") && state.player.chronoUsedThisRun) {
      pushLog("Chrono Loop was already spent this run.", "bad");
    }
    state.simulation.lastGameOverReason = String(reason || "");
    appendObserverBotTrace("run_death", {
      reason: String(reason || "")
    }, { force: isObserverBotActive() });
    registerObserverBotDepthFailure(state.depth, reason);
    recordRunOnLeaderboard("death");
    const lostRelic = loseRandomRelicOnDeath();
    const lostRelicOverlayName = formatRelicNameForOverlay(lostRelic);
    state.lastDeathRelicLossText = lostRelic
      ? `Death penalty: lost relic ${lostRelicOverlayName}.`
      : "Death penalty: no relic lost.";
    state.phase = "dead";
    state.finalVictoryPrompt = null;
    state.turnInProgress = false;
    state.playerShieldBrokeThisTurn = false;
    state.enemyTurnInProgress = false;
    state.enemyTurnQueue = [];
    state.enemyTurnStepTimer = 0;
    state.enemyTurnStepIndex = 0;
    state.enemyMeleeOverflowCommitted = 0;
    state.enemyBlackboard = null;
    state.enemyAntiStrafe = null;
    state.enemyDebugPlans = [];
    state.extractConfirm = null;
    state.merchantMenuOpen = false;
    if (state.player.combatBoostTurns > 0) {
      state.player.attack = Math.max(MIN_EFFECTIVE_DAMAGE, state.player.attack - 20);
      state.player.armor = Math.max(0, state.player.armor - 20);
      state.player.combatBoostTurns = 0;
    }
    syncBgmWithState();
    stopVictoryTrack(true);
    stopFinalGameOverTrack(true);
    const lossSummary = lostRelic ? ` Lost relic: ${lostRelic.name}.` : " No relic lost.";
    pushLog(`${reason}${lossSummary}`, "bad");
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
      stopDeathTrack(true);
      const usedFinalTrack = playFinalGameOverTrack();
      if (!usedFinalTrack && !state.audioMuted) {
        playSfx("death");
      }
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
    const usedDeathTrack = playDeathTrack();
    if (!usedDeathTrack && !state.audioMuted) {
      playSfx("death");
    }
    pushLog("Press 1-0 to toggle mutators, R to choose start depth.");
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

  function buildOccupiedTilesForShrineCurseSpawn() {
    const occupied = new Set();
    for (let y = 0; y < GRID_SIZE; y += 1) {
      occupied.add(tileKey(0, y));
      occupied.add(tileKey(GRID_SIZE - 1, y));
    }
    for (let x = 0; x < GRID_SIZE; x += 1) {
      occupied.add(tileKey(x, 0));
      occupied.add(tileKey(x, GRID_SIZE - 1));
    }
    occupied.add(tileKey(state.player.x, state.player.y));
    occupied.add(tileKey(state.portal.x, state.portal.y));
    if (state.shrine) {
      occupied.add(tileKey(state.shrine.x, state.shrine.y));
    }
    if (state.merchant) {
      occupied.add(tileKey(state.merchant.x, state.merchant.y));
    }
    for (const enemy of state.enemies) {
      occupied.add(tileKey(enemy.x, enemy.y));
    }
    for (const chest of state.chests) {
      if (!chest.opened) occupied.add(tileKey(chest.x, chest.y));
    }
    for (const spike of state.spikes) {
      occupied.add(tileKey(spike.x, spike.y));
    }
    return occupied;
  }

  function spawnShrineCurseEnemies(count) {
    const spawnCount = clamp(Math.max(0, Math.round(Number(count) || 0)), 0, 2);
    if (spawnCount <= 0) return 0;
    const occupied = buildOccupiedTilesForShrineCurseSpawn();
    let spawned = 0;
    for (let i = 0; i < spawnCount; i += 1) {
      const spot = randomFreeTile(occupied, { avoidBonfire: true }) || randomFreeTile(occupied);
      if (!spot) break;
      const enemyType = rollEnemyTypeWithCaps();
      const elite = state.depth >= 8 && chance(0.25);
      const enemy = createEnemy(enemyType, spot.x, spot.y, { elite });
      state.enemies.push(enemy);
      spawned += 1;
      spawnParticles(spot.x, spot.y, "#d7c6ff", 8, 1.1);
    }
    return spawned;
  }

  function activateShrine() {
    if (!isOnShrine()) return;
    state.shrine.used = true;
    playSfx("shrine");
    const shrineOutcome = lootTablesApi.rollShrineOutcome({
      hasShrineWard: hasRelic("shrineward"),
      rng: Math.random
    });
    if (shrineOutcome.type === "blessing") {
      if (shrineOutcome.blessing === "fury") {
        const duration = rollShrineBlessingTurns();
        state.player.adrenaline = Math.min(state.player.maxAdrenaline, state.player.adrenaline + 2);
        state.player.furyBlessingTurns = Math.max(state.player.furyBlessingTurns || 0, duration);
        pushLog(
          `Shrine blessing: Fury +2 now, Fury Blessing active for ${state.player.furyBlessingTurns} turns.`,
          "good"
        );
      } else if (shrineOutcome.blessing === "max_hp") {
        const duration = rollShrineBlessingTurns();
        const bonus = getShrineMaxHpBlessingBonus(state.depth);
        const healAmount = Math.max(scaledCombat(2), bonus * 2);
        applyTimedShrineStatBlessing({
          bonusKey: "shrineMaxHpBonus",
          turnsKey: "shrineMaxHpTurns",
          statKey: "maxHp",
          bonusAmount: bonus,
          turns: duration,
          minValue: scaledCombat(BASE_PLAYER_HP)
        });
        const healResult = healPlayer(healAmount, { visuals: true });
        pushLog(
          `Shrine blessing: +${bonus} max HP for ${state.player.shrineMaxHpTurns} turns and heal ${healResult.restored}${healResult.shielded > 0 ? ` (+${healResult.shielded} shield)` : ""}.`,
          "good"
        );
      } else if (shrineOutcome.blessing === "attack") {
        const duration = rollShrineBlessingTurns();
        const bonus = scaledCombat(1);
        applyTimedShrineStatBlessing({
          bonusKey: "shrineAttackBonus",
          turnsKey: "shrineAttackTurns",
          statKey: "attack",
          bonusAmount: bonus,
          turns: duration,
          minValue: MIN_EFFECTIVE_DAMAGE
        });
        pushLog(`Shrine blessing: +${bonus} ATK for ${state.player.shrineAttackTurns} turns.`, "good");
      } else if (shrineOutcome.blessing === "armor") {
        const duration = rollShrineBlessingTurns();
        const bonus = getShrineArmorBlessingBonus(state.depth);
        applyTimedShrineStatBlessing({
          bonusKey: "shrineArmorBonus",
          turnsKey: "shrineArmorTurns",
          statKey: "armor",
          bonusAmount: bonus,
          turns: duration,
          minValue: 0
        });
        pushLog(`Shrine blessing: +${bonus} ARM for ${state.player.shrineArmorTurns} turns.`, "good");
      } else if (shrineOutcome.blessing === "swapping") {
        const duration = rollShrineBlessingTurns();
        state.player.shrineSwapTurns = Math.max(state.player.shrineSwapTurns || 0, duration);
        state.player.shrineSwapCounter = 0;
        pushLog(
          `Shrine of Swapping: every ${SHRINE_SWAPPING_INTERVAL_TURNS} turns you swap with a random enemy (${state.player.shrineSwapTurns} turns).`,
          "good"
        );
      } else if (shrineOutcome.blessing === "noise") {
        const duration = rollShrineBlessingTurns();
        state.player.shrineNoiseTurns = Math.max(state.player.shrineNoiseTurns || 0, duration);
        pushLog(
          `Shrine of Noise: kills push nearby enemies (no damage) for ${state.player.shrineNoiseTurns} turns.`,
          "good"
        );
      } else if (shrineOutcome.blessing === "hunger") {
        const duration = rollShrineBlessingTurns();
        state.player.shrineHungerTurns = Math.max(state.player.shrineHungerTurns || 0, duration);
        pushLog(
          `Shrine of Hunger: +${SHRINE_HUNGER_HEAL_PER_HIT} HP per hit, but -${SHRINE_HUNGER_MISS_DAMAGE} HP each turn without a hit (${state.player.shrineHungerTurns} turns).`,
          "warn"
        );
      } else if (shrineOutcome.blessing === "shield") {
        const shieldGain = Math.floor(state.player.maxHp * 0.20);
        state.player.hpShield = (Number(state.player.hpShield) || 0) + shieldGain;
        capPlayerHpShield();
        spawnFloatingText(state.player.x, state.player.y, `+${shieldGain} SH`, "#7be0ff");
        spawnParticles(state.player.x, state.player.y, "#7be0ff", 12, 1.3);
        pushLog(`Shrine of Ward: +${shieldGain} HP shield. Total shield: ${state.player.hpShield}/${getPlayerHpShieldCap()}.`, "good");
      } else {
        grantPotion(1);
        pushLog("Shrine blessing: +1 potion.", "good");
      }
    } else {
      const curseType = String(shrineOutcome.curse || "pain");
      if (curseType === "summon") {
        const spawned = spawnShrineCurseEnemies(randInt(1, 2));
        if (spawned > 0) {
          state.roomCleared = false;
          pushLog(`Cursed Shrine: ${spawned} ${spawned === 1 ? "enemy emerges" : "enemies emerge"} from the dark.`, "bad");
        } else {
          pushLog("Cursed Shrine stirs, but no space to summon enemies.", "warn");
        }
      } else if (curseType === "swap") {
        if (!Array.isArray(state.enemies) || state.enemies.length <= 0) {
          pushLog("Cursed Swapping fizzles: no enemy to swap with.", "warn");
        } else {
          const randomEnemy = state.enemies[randInt(0, state.enemies.length - 1)];
          const px = state.player.x;
          const py = state.player.y;
          startTween(state.player);
          startTween(randomEnemy);
          state.player.x = randomEnemy.x;
          state.player.y = randomEnemy.y;
          randomEnemy.x = px;
          randomEnemy.y = py;
          spawnParticles(state.player.x, state.player.y, "#d8bbff", 8, 1.05);
          spawnParticles(randomEnemy.x, randomEnemy.y, "#d8bbff", 8, 1.05);
          pushLog(`Cursed Swapping: you switch places with ${randomEnemy.name}.`, "bad");
        }
      } else if (isDebugGodModeActive()) {
        pushLog("Shrine curse ignored (God Mode).", "warn");
      } else {
        const shrineCurseBaseDamage = scaledCombat(2);
        const shrineCurseAbsorb = absorbPlayerShieldDamage(shrineCurseBaseDamage);
        handleShieldAbsorbEffects("shrine curse", null, shrineCurseAbsorb.skillShieldAbsorbed);
        const shrineCurseDamage = shrineCurseAbsorb.remaining;
        if (shrineCurseDamage <= 0) {
          pushLog("Cursed Shrine: damage absorbed by shield.", "good");
          return;
        }
        state.player.hp -= shrineCurseDamage;
        tryTriggerEngineOfWarEmergency("shrine curse");
        triggerPlayerHitFlash();
        spawnFloatingText(state.player.x, state.player.y, `-${shrineCurseDamage}`, "#ff7676");
        pushLog(`Cursed Shrine: -${shrineCurseDamage} HP.`, "bad");
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
    if (isSimulationActive() && state.simulation.suppressVisuals) return;
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
    if (isSimulationActive() && state.simulation.suppressVisuals) return;
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
    if (isSimulationActive() && state.simulation.suppressVisuals) return;
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
    if (isSimulationActive() && state.simulation.suppressVisuals) return;
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
    if (isSimulationActive() && state.simulation.suppressVisuals) return;
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

  function triggerEnemyHitFlash(enemy, duration = ENTITY_HIT_FLASH_MS) {
    if (!enemy) return;
    enemy.hitFlash = Math.max(Number(enemy.hitFlash) || 0, duration);
  }

  function triggerPlayerHitFlash(duration = ENTITY_HIT_FLASH_MS) {
    state.player.hitFlash = Math.max(Number(state.player.hitFlash) || 0, duration);
  }

  function removeEnemy(enemy) {
    state.enemies = state.enemies.filter((item) => item !== enemy);
  }

  function rewardForEnemy(enemy) {
    let base = 2;
    if (enemy.type === "warden") base = 35;
    else if (enemy.type === "guardian") base = 16;
    else if (enemy.type === "acolyte") base = 5;
    else if (enemy.type === "skitter") base = 4;
    else if (enemy.type === "brute") base = 4;
    else if (enemy.type === "skeleton") base = 3;
    const eliteMult = enemy.elite ? (state.runMods.eliteGoldMult || 1) : 1;
    const boosted = (base + (enemy.rewardBonus || 0)) * getBountyContractMultiplier() * eliteMult;
    return Math.max(1, Math.round(boosted));
  }

  function tryKnockbackEnemyFromPoint(enemy, originX, originY) {
    if (!enemy || !state.enemies.includes(enemy)) return false;
    const dx = sign(enemy.x - originX);
    const dy = sign(enemy.y - originY);
    if (dx === 0 && dy === 0) return false;
    const nx = enemy.x + dx;
    const ny = enemy.y + dy;
    if (enemyTileBlocked(nx, ny, enemy)) return false;
    startTween(enemy);
    enemy.x = nx;
    enemy.y = ny;
    enemy.facing = getFacingFromDelta(dx, dy, enemy.facing);
    spawnParticles(enemy.x, enemy.y, "#cde6ff", 5, 0.9);
    applySpikeToEnemy(enemy);
    return true;
  }

  function applyShrineNoiseKnockbackOnKill(originX, originY) {
    if ((state.player.shrineNoiseTurns || 0) <= 0) return 0;
    if (!Array.isArray(state.enemies) || state.enemies.length <= 0) return 0;
    let pushed = 0;
    for (const enemy of [...state.enemies]) {
      if (!enemy) continue;
      const dist = Math.max(Math.abs(enemy.x - originX), Math.abs(enemy.y - originY));
      if (dist !== 1) continue;
      if (tryKnockbackEnemyFromPoint(enemy, originX, originY)) {
        pushed += 1;
      }
    }
    if (pushed > 0) {
      spawnShockwaveRing(originX, originY, {
        color: "#d0e8ff",
        core: "#f3fbff",
        maxRadius: TILE * 1.8,
        life: 220
      });
      pushLog(`Shrine of Noise: knockback ${pushed}.`, "good");
    }
    return pushed;
  }

  function killEnemy(enemy, reason) {
    const killX = enemy.x;
    const killY = enemy.y;
    removeEnemy(enemy);
    const reward = grantGold(rewardForEnemy(enemy));
    state.player.adrenaline = clamp(state.player.adrenaline + 1, 0, state.player.maxAdrenaline);
    state.totalKills += 1;
    state.killsThisRun += 1;                         // NEW
    setStorageItem(STORAGE_TOTAL_KILLS, String(state.totalKills));
    if (enemy.elite) {
      state.eliteKills += 1;
      state.eliteKillsThisRun += 1;                  // NEW
      setStorageItem(STORAGE_ELITE_KILLS, String(state.eliteKills));
    }
    syncMutatorUnlocks();
    spawnParticles(enemy.x, enemy.y, "#ffd57a", 8, 1.45);
    pushLog(`${enemy.name} down. +${reward} gold. ${reason ? `(${reason})` : ""}`, "good");
    applyShrineNoiseKnockbackOnKill(killX, killY);

    if (hasRelic("chaosorb") && (state.player.chaosKillHeal || 0) > 0) {
      const healAmount = Math.max(MIN_EFFECTIVE_DAMAGE, state.player.chaosKillHeal);
      const healResult = healPlayer(healAmount, {
        visuals: true,
        textColor: "#9ff7a9",
        particleColor: "#8ce1a7",
        particleCount: 6,
        particleSpread: 0.95
      });
      pushLog(
        `Chaos: kill heal +${healResult.restored} HP${healResult.shielded > 0 ? `, +${healResult.shielded} shield` : ""}.`,
        "good"
      );
    }

    // Soul Harvest: +10 max HP every 30 kills (cap +100)
    if (hasRelic("soulharvest") && (state.player.soulHarvestGained || 0) < 10) {
      state.player.soulHarvestCount = (state.player.soulHarvestCount || 0) + 1;
      if (state.player.soulHarvestCount % SOUL_HARVEST_KILL_INTERVAL === 0) {
        state.player.soulHarvestGained = (state.player.soulHarvestGained || 0) + 1;
        state.player.maxHp += scaledCombat(1);
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + scaledCombat(1));
        spawnParticles(enemy.x, enemy.y, "#b44dff", 8, 1.2);
        pushLog(`Soul Harvest: +10 max HP (${state.player.soulHarvestGained * 10}/100).`, "good");
      }
    }

    if (hasRelic("gravewhisper")) {
      const currentBonus = Math.max(0, Number(state.player.graveWhisperAtkBonus) || 0);
      if (currentBonus < GRAVE_WHISPER_ATK_CAP) {
        const gain = Math.min(GRAVE_WHISPER_ATK_PER_KILL, GRAVE_WHISPER_ATK_CAP - currentBonus);
        state.player.graveWhisperAtkBonus = currentBonus + gain;
        state.player.attack += gain;
        pushLog(
          `Grave Whisper: +${gain} ATK (${state.player.graveWhisperAtkBonus}/${GRAVE_WHISPER_ATK_CAP}) this encounter.`,
          "good"
        );
      }
    }

    markUiDirty();
  }

  function checkRoomClearBonus() {
    if (state.roomCleared || state.enemies.length > 0) return;
    state.roomCleared = true;
    if (!state.potionUsedInRoom) {
      state.potionFreeRoomStreak = (state.potionFreeRoomStreak || 0) + 1;
      syncMutatorUnlocks();
    } else {
      state.potionFreeRoomStreak = 0;
    }
    state.potionUsedInRoom = false;
    state.runMaxDepth = Math.max(state.runMaxDepth, state.depth);
    updateDepthScalingMutators();
    syncMutatorUnlocks();   // depth-based unlocks (bulwark, momentum, ascension) fire on room clear
    registerObserverBotDepthClear(state.depth);
    clearCombatShield();
    revealPortalFx();
    pushLog("Room cleared! Portal revealed.", "good");
    let goldBonus = 2 + Math.floor(state.depth / 2);
    let potionChance = 0.35;
    let shouldTriggerFinalVictory = false;

    if (!state.bossRoom) {
      if (state.roomType === "treasure") {
        goldBonus = Math.max(1, goldBonus - 1);
        potionChance = 0.22;
      } else if (state.roomType === "vault") {
        goldBonus = Math.max(1, goldBonus - 2);
        potionChance = 0.1;
      } else if (state.roomType === "shrine") {
        goldBonus += 1;
        potionChance = 0.45;
      } else if (state.roomType === "cursed") {
        goldBonus += 4;
        potionChance = 0.15;
      }
    }

    if (state.bossRoom) {
      state.lastBossClearDepthThisRun = Math.max(
        Number(state.lastBossClearDepthThisRun) || 0,
        Number(state.depth) || 0
      );
      tryUnlockStartDepthFromBossClear(state.depth);
      goldBonus += 10;
      if (state.depth >= MAX_DEPTH) {
        pushLog(`Final boss of depth ${MAX_DEPTH} defeated!`, "good");
        shouldTriggerFinalVictory = true;
      } else {
        if (shouldForceWardenFirstDrop(state.depth)) {
          markWardenFirstDropUsedAtDepth(state.depth);
          state.wardenRelicMissStreak = 0;
          pushLog(`Mini-boss defeated. First Warden kill on depth ${state.depth}: guaranteed relic drop!`, "good");
          openRelicDraft(true);
        } else {
          const relicDropRoll = getWardenRelicDropRoll(state.depth);
          if (chance(relicDropRoll.chance)) {
            state.wardenRelicMissStreak = 0;
            pushLog("Mini-boss defeated. Warden dropped a relic!", "good");
            openRelicDraft(true);
          } else {
            state.wardenRelicMissStreak = relicDropRoll.missStreak + 1;
            pushLog("Mini-boss defeated. No relic drop this time.", "warn");
          }
        }
      }
    }
    const scaled = grantGold(goldBonus);
    if (chance(potionChance)) {
      grantPotion(1);
      pushLog(`Room clear bonus: +${scaled} gold and +1 potion.`, "good");
    } else {
      pushLog(`Room clear bonus: +${scaled} gold.`, "good");
    }
    if (shouldTriggerFinalVictory) {
      triggerDepth100Victory();
      return;
    }
    markUiDirty();
  }

  function tryTriggerChronoLoop(sourceLabel = "fatal damage") {
    if (state.phase !== "playing") return false;
    if (!hasRelic("chronoloop") || state.player.chronoUsedThisRun) return false;

    state.player.chronoUsedThisRun = true;
    state.player.hp = Math.max(1, Math.floor(state.player.maxHp * 0.5));

    let hitCount = 0;
    let killCount = 0;
    for (const enemy of [...state.enemies]) {
      if (Math.max(Math.abs(enemy.x - state.player.x), Math.abs(enemy.y - state.player.y)) > CHRONO_LOOP_BURST_RADIUS) {
        continue;
      }
      hitCount += 1;
      enemy.hp -= CHRONO_LOOP_BURST_DAMAGE;
      triggerEnemyHitFlash(enemy, CRIT_HIT_FLASH_MS);
      spawnFloatingText(enemy.x, enemy.y, `-${CHRONO_LOOP_BURST_DAMAGE}`, "#ffd8ad", { life: 700, size: 9 });
      spawnParticles(enemy.x, enemy.y, "#ffb020", 12, 1.6);
      if (enemy.hp <= 0) {
        killEnemy(enemy, "chrono burst");
        killCount += 1;
      }
    }

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
      `CHRONO LOOP! Revived with ${state.player.hp} HP. Burst hit ${hitCount} nearby ${hitCount === 1 ? "enemy" : "enemies"}${killCount > 0 ? `, ${killCount} downed` : ""}.`,
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
    if (isDashImmunityActive()) {
      return;
    }
    // Phase Cloak: auto-dodge every 3 turns
    if (hasRelic("phasecloak") && state.player.phaseCooldown <= 0) {
      state.player.phaseCooldown = PHASE_CLOAK_DODGE_COOLDOWN_TURNS;
      spawnParticles(state.player.x, state.player.y, "#c9abff", 10, 1.3);
      pushLog(`Phase Cloak dodges ${source}!`, "good");
      markUiDirty();
      return;
    }
    const incomingDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(rawDamage));
    const shieldAbsorb = absorbPlayerShieldDamage(incomingDamage);
    handleShieldAbsorbEffects(source, attacker, shieldAbsorb.skillShieldAbsorbed);
    let remainingDamage = shieldAbsorb.remaining;
    if (remainingDamage <= 0) {
      pushLog(`${source} hits your shield.`, "good");
      markUiDirty();
      return;
    }
    const minDamageFromCap = Math.max(
      MIN_EFFECTIVE_DAMAGE,
      Math.ceil(remainingDamage * (1 - ARMOR_DAMAGE_REDUCTION_CAP))
    );
    const reducedByArmor = Math.max(MIN_EFFECTIVE_DAMAGE, remainingDamage - state.player.armor);
    let reduced = Math.max(minDamageFromCap, reducedByArmor);
    if (hasRelic("mirrorcarapace")) {
      reduced = Math.max(1, Math.round(reduced * 0.85));
    }
    state.player.hp -= reduced;
    tryTriggerEngineOfWarEmergency(source);
    triggerPlayerHitFlash();
    spawnFloatingText(state.player.x, state.player.y, `-${reduced}`, "#ff7676");
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
    if (isDashImmunityActive()) {
      return;
    }
    // Iron Boots: immune to spikes
    if (hasRelic("ironboots")) {
      return;
    }
    const spikeDamage = getSpikeDamageByDepth();
    const spikeAbsorb = absorbPlayerShieldDamage(spikeDamage);
    handleShieldAbsorbEffects("spikes", null, spikeAbsorb.skillShieldAbsorbed);
    const spikeFinalDamage = spikeAbsorb.remaining;
    if (spikeFinalDamage <= 0) {
      pushLog("Spikes hit your shield.", "good");
      markUiDirty();
      return;
    }
    state.player.hp -= spikeFinalDamage;
    tryTriggerEngineOfWarEmergency("spikes");
    triggerPlayerHitFlash();
    spawnFloatingText(state.player.x, state.player.y, `-${spikeFinalDamage}`, "#ff7676");
    state.flash = 60;
    setShake(1.6);
    spawnParticles(state.player.x, state.player.y, "#d86b6b", 6, 1.1);
    pushLog(`Spikes cut you for ${spikeFinalDamage}.`, "bad");
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
    const spikeDamage = getSpikeDamageByDepth();
    enemy.hp -= spikeDamage;
    triggerEnemyHitFlash(enemy);
    spawnFloatingText(enemy.x, enemy.y, `-${spikeDamage}`, "#ffffff");
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

  function applyChestCapFallback(inTreasureRoom, bucketLabel, statLabel) {
    const canHeal = state.runMods.chestHealPenalty < 999;
    const pickHeal = canHeal && chance(0.5);
    if (pickHeal) {
      const healAmount = Math.max(MIN_EFFECTIVE_DAMAGE, scaledCombat(4) - state.runMods.chestHealPenalty);
      const healResult = healPlayer(healAmount, { visuals: true });
      pushLog(
        `Chest ${statLabel} cap (${bucketLabel}) reached: converted to +${healResult.restored} HP${healResult.shielded > 0 ? `, +${healResult.shielded} shield` : ""}.`,
        "good"
      );
      return;
    }
    let rawGold = randInt(4, 8);
    if (inTreasureRoom) {
      rawGold = Math.round(rawGold * 6);
    }
    rawGold = Math.max(1, Math.round(rawGold * getTreasureSenseMultiplier()));
    const convertedGold = grantGold(rawGold);
    pushLog(`Chest ${statLabel} cap (${bucketLabel}) reached: converted to +${convertedGold} gold.`, "good");
  }

  function handleChestAttackUpgrade(inTreasureRoom) {
    const bucketIndex = getChestAttackBucketIndex(state.depth);
    const currentBucketCount = getChestAttackBucketCount(bucketIndex);
    const bucketLabel = getChestAttackBucketLabel(bucketIndex);

    if (currentBucketCount >= CHEST_ATTACK_BUCKET_MAX) {
      applyChestCapFallback(inTreasureRoom, bucketLabel, "ATK");
      return;
    }

    const nextBucketCount = incrementChestAttackBucketCount(bucketIndex);
    const chestAttackFlat = getChestUpgradeFlatByDepth(CHEST_ATTACK_UPGRADE_FLAT, state.depth);
    state.sessionChestAttackFlat += chestAttackFlat;
    const gainedAttack = addScaledFlatAttack(chestAttackFlat);
    pushLog(
      `Chest: Attack +${gainedAttack}. Depth ${bucketLabel} chest ATK ${nextBucketCount}/${CHEST_ATTACK_BUCKET_MAX}.`,
      "good"
    );
  }

  function handleChestArmorUpgrade(inTreasureRoom) {
    const bucketIndex = getChestAttackBucketIndex(state.depth);
    const currentBucketCount = getChestArmorBucketCount(bucketIndex);
    const bucketLabel = getChestAttackBucketLabel(bucketIndex);
    if (currentBucketCount >= CHEST_ATTACK_BUCKET_MAX) {
      applyChestCapFallback(inTreasureRoom, bucketLabel, "ARM");
      return;
    }
    const nextBucketCount = incrementChestArmorBucketCount(bucketIndex);
    const chestArmorFlat = getChestUpgradeFlatByDepth(CHEST_ARMOR_UPGRADE_FLAT, state.depth);
    state.sessionChestArmorFlat += chestArmorFlat;
    state.player.armor += chestArmorFlat;
    pushLog(
      `Chest: Armor +${chestArmorFlat}. Depth ${bucketLabel} chest ARM ${nextBucketCount}/${CHEST_ATTACK_BUCKET_MAX}.`,
      "good"
    );
  }

  function handleChestHealthUpgrade(inTreasureRoom) {
    const bucketIndex = getChestAttackBucketIndex(state.depth);
    const currentBucketCount = getChestHealthBucketCount(bucketIndex);
    const bucketLabel = getChestAttackBucketLabel(bucketIndex);
    if (currentBucketCount >= CHEST_ATTACK_BUCKET_MAX) {
      applyChestCapFallback(inTreasureRoom, bucketLabel, "HP");
      return;
    }
    const nextBucketCount = incrementChestHealthBucketCount(bucketIndex);
    const chestHealthFlat = getChestHealthUpgradeFlatByDepth(state.depth);
    state.sessionChestHealthFlat += chestHealthFlat;
    state.player.maxHp += chestHealthFlat;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + chestHealthFlat);
    pushLog(
      `Chest: Health +${chestHealthFlat}. Depth ${bucketLabel} chest HP ${nextBucketCount}/${CHEST_ATTACK_BUCKET_MAX}.`,
      "good"
    );
  }

  function handleChestHealingDrop() {
    const healResult = healPlayer(CHEST_HEALING_DROP_AMOUNT, {
      visuals: true,
      textColor: "#9ff7a9",
      particleColor: "#8ce1a7",
      particleCount: 8,
      particleSpread: 1.0
    });
    pushLog(
      `Chest: Healing +${healResult.restored}${healResult.shielded > 0 ? `, +${healResult.shielded} shield` : ""}.`,
      "good"
    );
  }

  function grantTreasureMapFragment(count = 1) {
    const gained = Math.max(0, Math.floor(Number(count) || 0));
    if (gained <= 0) return 0;
    state.treasureMapFragments = Math.max(0, Number(state.treasureMapFragments) || 0) + gained;
    let completions = 0;
    while (state.treasureMapFragments >= 10) {
      state.treasureMapFragments -= 10;
      completions += 1;
    }
    if (completions > 0) {
      state.forcedNextRoomType = "vault";
    }
    return completions;
  }

  function openChest(chest) {
    chest.opened = true;
    playSfx("chest");
    const inTreasureRoom = state.roomType === "treasure";
    const chestOutcome = lootTablesApi.rollChestOutcome({
      inTreasureRoom,
      hasShrineWard: hasRelic("shrineward"),
      rng: Math.random
    });
    if (chestOutcome.grantsLife) {
      grantLife("Chest blessing");
    }
    if (chestOutcome.outcome === "health") {
      if (state.runMods.chestHealPenalty >= 999) {
        // Alchemist: chests don't heal, give gold instead
        const fallbackGold = grantGold(randInt(2, 5));
        pushLog(`Chest: no heal (Alchemist), +${fallbackGold} gold.`);
      } else {
        handleChestHealthUpgrade(inTreasureRoom);
      }
    } else if (chestOutcome.outcome === "healing") {
      if (state.runMods.chestHealPenalty >= 999) {
        const fallbackGold = grantGold(randInt(2, 5));
        pushLog(`Chest: no heal (Alchemist), +${fallbackGold} gold.`);
      } else {
        handleChestHealingDrop();
      }
    } else if (chestOutcome.outcome === "attack") {
      handleChestAttackUpgrade(inTreasureRoom);
    } else if (chestOutcome.outcome === "armor") {
      handleChestArmorUpgrade(inTreasureRoom);
    } else if (chestOutcome.outcome === "potion") {
      grantPotion(1);
      pushLog("Chest: +1 potion.", "good");
    } else if (chestOutcome.outcome === "map_fragment") {
      const completions = grantTreasureMapFragment(1);
      if (completions > 0) {
        pushLog("Chest: Treasure Map Fragment (10/10). Next depth is forced Vault.", "good");
      } else {
        pushLog(`Chest: Treasure Map Fragment (${state.treasureMapFragments}/10).`, "good");
      }
    } else if (chestOutcome.outcome === "gold") {
      let raw = randInt(4, 8);
      if (inTreasureRoom) {
        raw = Math.round(raw * 6);
      }
      raw = Math.max(1, Math.round(raw * getTreasureSenseMultiplier()));
      const scaled = grantGold(raw);
      pushLog(`Chest: +${scaled} gold.`, "good");
    } else {
      if (isDebugGodModeActive()) {
        pushLog("Chest trap ignored (God Mode).", "warn");
      } else {
        const chestTrapBaseDamage = scaledCombat(3);
        const chestTrapAbsorb = absorbPlayerShieldDamage(chestTrapBaseDamage);
        handleShieldAbsorbEffects("chest trap", null, chestTrapAbsorb.skillShieldAbsorbed);
        const chestTrapDamage = chestTrapAbsorb.remaining;
        if (chestTrapDamage <= 0) {
          pushLog("Chest trap absorbed by shield.", "good");
        } else {
          state.player.hp -= chestTrapDamage;
          tryTriggerEngineOfWarEmergency("chest trap");
          triggerPlayerHitFlash();
          spawnFloatingText(state.player.x, state.player.y, `-${chestTrapDamage}`, "#ff7676");
          pushLog(`Chest trap! You take ${chestTrapDamage}.`, "bad");
          tryAutoPotion("chest trap");
          if (state.player.hp <= 0) {
            if (tryTriggerChronoLoop("chest trap")) {
              return;
            }
            gameOver(`You died from a chest trap on depth ${state.depth}.`);
          }
        }
      }
    }
    if (state.roomType === "vault") {
      const vaultGold = grantGold(50);
      pushLog(`Vault chest: +${vaultGold} gold.`, "good");
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
    return skillsActionsApi.cancelDashAim(logText);
  }

  function tryArmDashSkill() {
    return skillsActionsApi.tryArmDashSkill();
  }

  function tryUseDashSkill(forcedDx = null, forcedDy = null) {
    return skillsActionsApi.tryUseDashSkill(forcedDx, forcedDy);
  }

  function tryUseAoeSkill() {
    return skillsActionsApi.tryUseAoeSkill();
  }

  function tryUseShieldSkill() {
    const result = skillsActionsApi.tryUseShieldSkill();
    if (result) {
      state.shieldUsesThisRun = (state.shieldUsesThisRun || 0) + 1;
      syncMutatorUnlocks();
    }
    return result;
  }

  function tryUseSkillByKey(key) {
    return skillsActionsApi.tryUseSkillByKey(key);
  }

  function attackEnemy(enemy) {
    if (state.phase !== "playing") return;
    const furyMult = getFuryAttackPowerMultiplier();
    const base = Math.max(
      MIN_EFFECTIVE_DAMAGE,
      Math.round(getPlayerAttackForDamage({ includeChaos: true }) * furyMult)
    );
    const critical = chance(state.player.crit);
    const primaryHit = applyRelicDamageModsToHit(critical ? base * 2 : base, enemy);
    let damage = primaryHit.damage;
    enemy.hp -= damage;
    registerPlayerHitThisTurn();
    applyVampfangLifesteal(damage);
    triggerEnemyHitFlash(enemy, critical ? CRIT_HIT_FLASH_MS : ENTITY_HIT_FLASH_MS);
    spawnFloatingText(
      enemy.x,
      enemy.y,
      critical ? `CRIT ${damage}` : `-${damage}`,
      critical ? "#fff27d" : "#ffd4c8",
      critical ? { life: 680, size: 9 } : {}
    );
    playSfx(critical ? "crit" : "hit");
    spawnParticles(enemy.x, enemy.y, critical ? "#ffe694" : "#ff9d8d", critical ? 12 : 8, 1.35);
    setShake(critical ? 3.1 : 2.1);
    pushLog(
      `You hit ${enemy.name} for ${damage}${critical ? " (CRIT)" : ""}.`,
      critical ? "good" : ""
    );
    if (primaryHit.stormProc) {
      pushLog(`Storm Sigil procs: +${STORM_SIGIL_BONUS_DAMAGE} bonus damage.`, "good");
    }

    // Burning Blade: ignite enemy
    if (hasRelic("burnblade") && enemy.hp > 0) {
      enemy.burnTurns = (enemy.burnTurns || 0) + 3;
      pushLog(`${enemy.name} is burning (${BURNING_BLADE_DOT_DAMAGE}/turn)!`, "good");
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
        const voidGold = grantGold(VOID_REAPER_CRIT_KILL_GOLD);
        pushLog(`Void Reaper bonus: +${voidGold} gold.`, "good");
      }
      killEnemy(enemy, "final blow");
    }

    // Echo Strike: 25% chance to hit again
    if (hasRelic("echostrike") && state.enemies.includes(enemy) && enemy.hp > 0 && chance(0.25)) {
      const echoHit = applyRelicDamageModsToHit(
        Math.max(MIN_EFFECTIVE_DAMAGE, getPlayerAttackForDamage({ includeChaos: false })),
        enemy
      );
      const echoDmg = echoHit.damage;
      enemy.hp -= echoDmg;
      registerPlayerHitThisTurn();
      applyVampfangLifesteal(echoDmg);
      triggerEnemyHitFlash(enemy);
      spawnFloatingText(enemy.x, enemy.y, `-${echoDmg}`, "#bde3ff");
      spawnParticles(enemy.x, enemy.y, "#9fdcff", 8, 1.2);
      pushLog(`Echo Strike! Extra ${echoDmg} damage.`, "good");
      if (echoHit.stormProc) {
        pushLog(`Storm Sigil procs: +${STORM_SIGIL_BONUS_DAMAGE} bonus damage.`, "good");
      }
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

  function playerKnockbackTileBlocked(x, y) {
    if (!inBounds(x, y)) return true;
    if (state.chests.some((chest) => !chest.opened && chest.x === x && chest.y === y)) return true;
    if (state.enemies.some((enemy) => enemy.x === x && enemy.y === y)) return true;
    return false;
  }

  function useBruteKnockback(enemy) {
    const dx = sign(state.player.x - enemy.x);
    const dy = sign(state.player.y - enemy.y);
    if (dx === 0 && dy === 0) return false;

    let pushedTiles = 0;
    for (let i = 0; i < 2; i += 1) {
      const nx = state.player.x + dx;
      const ny = state.player.y + dy;
      if (playerKnockbackTileBlocked(nx, ny)) break;
      if (pushedTiles === 0) {
        startTween(state.player);
      }
      state.player.x = nx;
      state.player.y = ny;
      pushedTiles += 1;
    }

    if (pushedTiles <= 0) return false;
    applyDamageToPlayer(enemy.attack, `${enemy.name} slam`, enemy);
    if (state.phase !== "playing") {
      return true;
    }
    state.player.lastMoveX = dx;
    state.player.lastMoveY = dy;
    spawnParticles(state.player.x, state.player.y, "#ff8e83", 9, 1.2);
    setShake(2.4);
    pushLog(`Brute slam knocks you back ${pushedTiles} tile${pushedTiles > 1 ? "s" : ""}.`, "bad");
    applySpikeToPlayer();
    return true;
  }

  function forceMovePlayer(dx, dy, maxTiles = 1) {
    const steps = Math.max(1, Number(maxTiles) || 1);
    let movedTiles = 0;
    for (let i = 0; i < steps; i += 1) {
      const nx = state.player.x + dx;
      const ny = state.player.y + dy;
      if (playerKnockbackTileBlocked(nx, ny)) break;
      if (movedTiles === 0) {
        startTween(state.player);
      }
      state.player.x = nx;
      state.player.y = ny;
      movedTiles += 1;
    }
    if (movedTiles > 0) {
      state.player.lastMoveX = dx;
      state.player.lastMoveY = dy;
      applySpikeToPlayer();
    }
    return movedTiles;
  }

  function pullPlayerTowardEnemy(enemy, maxTiles = 1) {
    const dx = sign(enemy.x - state.player.x);
    const dy = sign(enemy.y - state.player.y);
    if (dx === 0 && dy === 0) return 0;
    return forceMovePlayer(dx, dy, maxTiles);
  }

  function executeWardenBurst(enemy) {
    const burstDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(getEnemyEffectiveAttack(enemy) * 1.25));
    enemy.cooldown = Math.max(Number(enemy.cooldown) || 0, 2);
    applyDamageToPlayer(burstDamage, `${enemy.name} gravity burst`, enemy);
    if (state.phase !== "playing") return;
    const pulled = pullPlayerTowardEnemy(enemy, 1);
    enemy.castFlash = 140;
    spawnShockwaveRing(enemy.x, enemy.y, {
      color: "#b995ff",
      core: "#efe1ff",
      maxRadius: TILE * 2.6,
      life: 320
    });
    spawnParticles(state.player.x, state.player.y, "#c8a7ff", 10, 1.2);
    if (pulled > 0) {
      pushLog(`Warden gravity burst pulls you ${pulled} tile${pulled > 1 ? "s" : ""}.`, "bad");
    } else {
      pushLog("Warden gravity burst detonates.", "bad");
    }
  }

  function loadWardenSprite() {
    const img = new Image();
    wardenSprite.sheet = img;
    wardenSprite.ready = false;
    wardenSprite.failed = false;
    img.onload = () => {
      wardenSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!wardenSprite.failed) {
        wardenSprite.failed = true;
        pushLog(`Warden sprite failed: ${WARDEN_SPRITESHEET_PATH}`, "bad");
      }
    };
    img.src = `${WARDEN_SPRITESHEET_PATH}?v=${WARDEN_SPRITESHEET_VERSION}`;
  }

  function loadAcolyteSprite() {
    const img = new Image();
    acolyteSprite.sheet = img;
    acolyteSprite.ready = false;
    acolyteSprite.failed = false;
    img.onload = () => {
      acolyteSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!acolyteSprite.failed) {
        acolyteSprite.failed = true;
        pushLog(`Acolyte sprite failed: ${ACOLYTE_SPRITESHEET_PATH}`, "bad");
      }
    };
    img.src = `${ACOLYTE_SPRITESHEET_PATH}?v=${ACOLYTE_SPRITESHEET_VERSION}`;
  }

  function loadSkitterSprite() {
    const img = new Image();
    skitterSprite.sheet = img;
    skitterSprite.ready = false;
    skitterSprite.failed = false;
    img.onload = () => {
      skitterSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!skitterSprite.failed) {
        skitterSprite.failed = true;
        pushLog(`Skitter sprite failed: ${SKITTER_SPRITESHEET_PATH}`, "bad");
      }
    };
    img.src = `${SKITTER_SPRITESHEET_PATH}?v=${SKITTER_SPRITESHEET_VERSION}`;
  }

  function loadGuardianSprite() {
    const img = new Image();
    guardianSprite.sheet = img;
    guardianSprite.ready = false;
    guardianSprite.failed = false;
    img.onload = () => {
      guardianSprite.ready = true;
      markUiDirty();
    };
    img.onerror = () => {
      if (!guardianSprite.failed) {
        guardianSprite.failed = true;
        pushLog(`Guardian sprite failed: ${GUARDIAN_SPRITESHEET_PATH}`, "bad");
      }
    };
    img.src = `${GUARDIAN_SPRITESHEET_PATH}?v=${GUARDIAN_SPRITESHEET_VERSION}`;
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

  function hasLineOfSightFromTile(fromX, fromY) {
    if (fromX === state.player.x) {
      const minY = Math.min(fromY, state.player.y);
      const maxY = Math.max(fromY, state.player.y);
      for (let y = minY + 1; y < maxY; y += 1) {
        if (state.chests.some((chest) => !chest.opened && chest.x === fromX && chest.y === y)) {
          return false;
        }
      }
      return true;
    }
    if (fromY === state.player.y) {
      const minX = Math.min(fromX, state.player.x);
      const maxX = Math.max(fromX, state.player.x);
      for (let x = minX + 1; x < maxX; x += 1) {
        if (state.chests.some((chest) => !chest.opened && chest.x === x && chest.y === fromY)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  function isSkeletonCastPositionAt(x, y, range = 3) {
    const dist = manhattan(x, y, state.player.x, state.player.y);
    return dist >= 2 && dist <= range && hasLineOfSightFromTile(x, y);
  }

  function isWardenCastPositionAt(x, y, range = 4, minRange = 2) {
    const dist = manhattan(x, y, state.player.x, state.player.y);
    return dist >= minRange && dist <= range && hasLineOfSightFromTile(x, y);
  }

  function getWardenSetupStep(enemy, options = {}) {
    if (!enemy) return null;
    const range = Math.max(2, Number(enemy.range) || 4);
    const smartMode = options.smartMode !== false && state.depth >= WARDEN_SMART_DEPTH_THRESHOLD;
    const wantsCast = Boolean(options.wantsCast);
    const preferRetreat = Boolean(options.preferRetreat);
    const startDistance = manhattan(enemy.x, enemy.y, state.player.x, state.player.y);
    const idealDistance = smartMode ? 3 : 2;
    const minCastDistance = smartMode ? 2 : 2;
    const optionsScored = [];
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        if (ox === 0 && oy === 0) continue;
        const x = enemy.x + ox;
        const y = enemy.y + oy;
        if (enemyTileBlocked(x, y, enemy)) continue;
        const dist = manhattan(x, y, state.player.x, state.player.y);
        const castReady = isWardenCastPositionAt(x, y, range, minCastDistance);
        const spikePenalty = isSpikeAt(x, y) ? 22 : 0;
        let score = 0;
        if (castReady) score += 56;
        score -= Math.abs(dist - idealDistance) * 6;
        if (dist === 1) score -= smartMode ? 36 : 24;
        score -= spikePenalty;
        if (preferRetreat) {
          if (dist > startDistance) score += 10;
          else score -= 6;
        }
        if (wantsCast && castReady) score += 8;
        optionsScored.push({ x, y, dist, score, castReady });
      }
    }
    if (optionsScored.length <= 0) return null;
    optionsScored.sort((a, b) =>
      b.score - a.score ||
      Number(b.castReady) - Number(a.castReady) ||
      Math.abs(a.dist - idealDistance) - Math.abs(b.dist - idealDistance)
    );
    return { x: optionsScored[0].x, y: optionsScored[0].y };
  }

  function getSkeletonSetupStep(enemy) {
    if (!enemy) return null;
    const range = Math.max(2, Number(enemy.range) || 3);
    const options = [];
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        if (ox === 0 && oy === 0) continue;
        const x = enemy.x + ox;
        const y = enemy.y + oy;
        if (enemyTileBlocked(x, y, enemy)) continue;
        const dist = manhattan(x, y, state.player.x, state.player.y);
        const castReady = isSkeletonCastPositionAt(x, y, range);
        const spikePenalty = isSpikeAt(x, y) ? 18 : 0;
        let score = 0;
        if (castReady) score += 45;
        score -= Math.abs(dist - 3) * 5;
        if (dist === 1) score -= 30;
        score -= spikePenalty;
        options.push({ x, y, dist, score, castReady });
      }
    }
    if (options.length <= 0) return null;
    options.sort((a, b) =>
      b.score - a.score ||
      Number(b.castReady) - Number(a.castReady) ||
      Math.abs(a.dist - 3) - Math.abs(b.dist - 3)
    );
    return { x: options[0].x, y: options[0].y };
  }

  function enemyMelee(enemy) {
    const damage = enemy.type === "skeleton"
      ? Math.max(
        MIN_EFFECTIVE_DAMAGE,
        Math.round(getEnemyEffectiveAttack(enemy) * SKELETON_MELEE_DAMAGE_MULTIPLIER)
      )
      : getEnemyEffectiveAttack(enemy);
    applyDamageToPlayer(damage, enemy.name, enemy);
    if (enemy.vampiric && state.phase === "playing") {
      enemy.hp = Math.min(enemy.maxHp || enemy.hp, enemy.hp + scaledCombat(1));
    }
    spawnParticles(state.player.x, state.player.y, "#ff7a7a", 7, 1.35);

    // Thorn Mail: reflect 20% of incoming melee damage
    if (hasRelic("thornmail") && state.phase === "playing" && state.enemies.includes(enemy)) {
      const reflectDamage = getThornmailReflectDamage(damage);
      enemy.hp -= reflectDamage;
      triggerEnemyHitFlash(enemy);
      spawnFloatingText(enemy.x, enemy.y, `-${reflectDamage}`, "#ffc8c8");
      spawnParticles(enemy.x, enemy.y, "#d86b6b", 5, 0.9);
      pushLog(`Thorn Mail reflects ${reflectDamage} to ${enemy.name}.`, "good");
      if (enemy.hp <= 0) {
        killEnemy(enemy, "thorns");
      }
    }
  }

  function enemyRanged(enemy, options = {}) {
    const boltColor = typeof options.color === "string"
      ? options.color
      : (enemy.type === "warden" ? "#c8a7ff" : "#8bb4ff");
    enemy.castFlash = 120;
    enemy.aiming = false;
    enemy.volleyAiming = false;
    enemy.burstAiming = false;
    const damageMultiplier = Math.max(0.1, Number(options.damageMultiplier) || 1);
    const damage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(getEnemyEffectiveAttack(enemy) * damageMultiplier));
    const sourceLabel = typeof options.source === "string"
      ? options.source
      : `${enemy.name} bolt`;
    spawnRangedBolt(enemy.x, enemy.y, state.player.x, state.player.y, boltColor);
    spawnRangedImpact(state.player.x, state.player.y, boltColor);
    applyDamageToPlayer(damage, sourceLabel, enemy);
    if (enemy.vampiric && state.phase === "playing") {
      enemy.hp = Math.min(enemy.maxHp || enemy.hp, enemy.hp + scaledCombat(1));
    }
    spawnParticles(state.player.x, state.player.y, boltColor, 7, 1.35);
  }

  function getAcolyteSupportPriority(enemy) {
    if (!enemy) return 0;
    if (enemy.type === "warden") return 6;
    if (enemy.type === "guardian" || enemy.type === "brute") return 5;
    if (enemy.type === "skeleton" || enemy.type === "skitter") return 4;
    if (enemy.type === "slime") return 3;
    if (enemy.type === "acolyte") return 1;
    return 2;
  }

  function getAcolyteHealTarget(caster, maxRange = ACOLYTE_SUPPORT_RANGE) {
    if (!caster || state.phase !== "playing") return null;
    const healCandidates = state.enemies
      .filter((enemy) =>
        enemy &&
        enemy !== caster &&
        manhattan(enemy.x, enemy.y, caster.x, caster.y) <= maxRange &&
        enemy.hp < enemy.maxHp
      )
      .map((enemy) => {
        const maxHp = Math.max(1, Number(enemy.maxHp) || 1);
        const missing = Math.max(0, maxHp - Math.max(0, Number(enemy.hp) || 0));
        const missingRatio = missing / maxHp;
        return {
          enemy,
          missing,
          missingRatio,
          dist: manhattan(enemy.x, enemy.y, caster.x, caster.y),
          priority: getAcolyteSupportPriority(enemy)
        };
      })
      .filter((item) =>
        item.missingRatio >= ACOLYTE_HEAL_MIN_MISSING_HP_RATIO ||
        (Number(item.enemy.hp) || 0) / Math.max(1, Number(item.enemy.maxHp) || 1) <= ACOLYTE_HEAL_HP_RATIO_PRIORITY
      )
      .sort((a, b) =>
        b.priority - a.priority ||
        b.missingRatio - a.missingRatio ||
        b.missing - a.missing ||
        a.dist - b.dist
      );
    return healCandidates[0]?.enemy || null;
  }

  function getAcolyteBuffTarget(caster, maxRange = ACOLYTE_SUPPORT_RANGE) {
    if (!caster || state.phase !== "playing") return null;
    const buffCandidates = state.enemies
      .filter((enemy) =>
        enemy &&
        enemy !== caster &&
        enemy.type !== "acolyte" &&
        manhattan(enemy.x, enemy.y, caster.x, caster.y) <= maxRange &&
        (Number(enemy.acolyteBuffTurns) || 0) <= 0
      )
      .map((enemy) => ({
        enemy,
        dist: manhattan(enemy.x, enemy.y, caster.x, caster.y),
        priority: getAcolyteSupportPriority(enemy)
      }))
      .sort((a, b) =>
        b.priority - a.priority ||
        a.dist - b.dist ||
        (b.hp || 0) - (a.hp || 0)
      );
    return buffCandidates[0]?.enemy || null;
  }

  function getAcolyteCastPlan(caster, options = {}) {
    const canAttackCast = Boolean(options.canAttackCast);
    const wantsCast = options.wantsCast !== false;
    const healTarget = getAcolyteHealTarget(caster, ACOLYTE_SUPPORT_RANGE);
    if (healTarget) {
      return { type: "heal", target: healTarget };
    }

    const buffTarget = getAcolyteBuffTarget(caster, ACOLYTE_SUPPORT_RANGE);
    const teamBuffLocked = Boolean(state.enemyAcolyteBuffCastThisTurn);
    if (buffTarget && !teamBuffLocked) {
      return { type: "buff", target: buffTarget };
    }
    if (!canAttackCast) return { type: "none", target: null };

    // Support-first behavior:
    // - If there are allies nearby and team buff is locked this turn, hold instead of instantly swapping to DPS.
    // - Attack only as a true fallback (no heal target and no available buff target).
    const nearbyNonAcolyteAllies = state.enemies.filter((enemy) =>
      enemy &&
      enemy !== caster &&
      enemy.type !== "acolyte" &&
      manhattan(enemy.x, enemy.y, caster.x, caster.y) <= ACOLYTE_SUPPORT_RANGE
    );
    if (nearbyNonAcolyteAllies.length > 0 && buffTarget && teamBuffLocked) {
      return { type: "none", target: null };
    }
    if (!wantsCast && nearbyNonAcolyteAllies.length > 0) {
      return { type: "none", target: null };
    }
    if (!buffTarget) {
      return { type: "attack", target: state.player };
    }
    return { type: "none", target: null };
  }

  function getAcolyteTelegraphTarget(caster, castType) {
    if (!caster || state.phase !== "playing") return null;
    if (castType === "heal") return getAcolyteHealTarget(caster, ACOLYTE_SUPPORT_RANGE);
    if (castType === "buff") return getAcolyteBuffTarget(caster, ACOLYTE_SUPPORT_RANGE);
    return state.player;
  }

  function getAcolyteCastTypeLabel(castType) {
    const normalized = String(castType || "").toLowerCase();
    if (normalized === "heal") return "HEAL";
    if (normalized === "buff") return "BUFF";
    if (normalized === "attack") return "BOLT";
    return "CAST";
  }

  function applyAcolyteHeal(caster, target) {
    if (!caster || !target || state.phase !== "playing") return false;
    const healAmount = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(Math.max(1, target.maxHp) * ACOLYTE_SUPPORT_HEAL_MULT));
    const beforeHp = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + healAmount);
    const healed = Math.max(0, target.hp - beforeHp);
    caster.castFlash = 120;
    spawnParticles(caster.x, caster.y, "#8edcc3", 8, 1.05);
    spawnParticles(target.x, target.y, "#baf7dc", 10, 1.05);
    if (healed > 0) {
      spawnFloatingText(target.x, target.y, `+${healed}`, "#c8ffe3");
    }
    pushLog(`${caster.name} restores ${target.name}${healed > 0 ? ` (+${healed} HP)` : ""}.`, "bad");
    return true;
  }

  function applyAcolyteBuff(caster, target) {
    if (!caster || !target || state.phase !== "playing") return false;
    if (target.type === "acolyte") return false;
    if ((Number(target.acolyteBuffTurns) || 0) > 0) return false;
    target.acolyteBuffTurns = ACOLYTE_SUPPORT_BUFF_TURNS;
    state.enemyAcolyteBuffCastThisTurn = true;
    caster.castFlash = 120;
    spawnParticles(caster.x, caster.y, "#b89dff", 8, 1.05);
    spawnParticles(target.x, target.y, "#cbb7ff", 10, 1.05);
    spawnFloatingText(target.x, target.y, "EMPOWER", "#e1d5ff");
    pushLog(`${caster.name} empowers ${target.name}.`, "bad");
    return true;
  }

  function executeAcolyteAttack(caster) {
    if (!caster || state.phase !== "playing") return false;
    enemyRanged(caster, {
      source: `${caster.name} shadow bolt`,
      damageMultiplier: ACOLYTE_ATTACK_DAMAGE_MULT,
      color: "#c88bff"
    });
    pushLog("Acolyte fires a shadow bolt.", "bad");
    return true;
  }

  function tryUseSkitterLunge(enemy) {
    if (!enemy || state.phase !== "playing") return false;
    const startDistance = manhattan(enemy.x, enemy.y, state.player.x, state.player.y);
    const maxSteps = startDistance >= 3 ? 2 : 1;
    let movedAny = false;

    for (let i = 0; i < maxSteps; i += 1) {
      const distance = manhattan(enemy.x, enemy.y, state.player.x, state.player.y);
      if (distance <= 1) break;
      const step = stepToward(enemy, state.player.x, state.player.y);
      if (!step) break;
      const move = applyEnemyMoveStep(enemy, step);
      movedAny = true;
      if (move.removed || state.phase !== "playing" || !state.enemies.includes(enemy)) {
        return true;
      }
    }
    if (movedAny) {
      enemy.cooldown = 6;
      pushLog(`${enemy.name} lunges into position.`, "bad");
    }
    return movedAny;
  }

  function getEnemyMeleeCommitLimit() {
    return state.enemies.length >= 6 ? 2 : 1;
  }

  function getEnemyTelegraphLimit() {
    return state.enemies.length >= 6 ? 3 : 2;
  }

  function createEnemyBlackboard() {
    if (!enemyBlackboardApi || typeof enemyBlackboardApi.createBlackboard !== "function") {
      return null;
    }
    const unopenedChests = state.chests
      .filter((chest) => !chest.opened)
      .map((chest) => ({ x: chest.x, y: chest.y }));
    return enemyBlackboardApi.createBlackboard({
      gridSize: GRID_SIZE,
      enemies: state.enemies,
      player: {
        x: state.player.x,
        y: state.player.y,
        hp: state.player.hp,
        maxHp: state.player.maxHp
      },
      spikes: state.spikes,
      chests: unopenedChests,
      playerRecentPositions: Array.isArray(state.playerCombatTrail) ? state.playerCombatTrail : [],
      currentTurn: Math.max(0, Number(state.turn) || 0),
      currentDepth: Math.max(0, Number(state.depth) || 0),
      antiStrafeState: state.enemyAntiStrafe || null,
      meleeLimit: getEnemyMeleeCommitLimit(),
      telegraphLimit: getEnemyTelegraphLimit(),
      playerLowHp: state.player.hp <= LOW_HP_THRESHOLD,
      playerShieldActive: isEpicShieldReflectActive()
    });
  }

  function canStartEnemyTelegraph() {
    if (enemyBlackboardApi && typeof enemyBlackboardApi.canStartTelegraph === "function") {
      return enemyBlackboardApi.canStartTelegraph(state.enemyBlackboard, state.enemies);
    }
    const fallbackActive = (enemyBlackboardApi && typeof enemyBlackboardApi.countActiveTelegraphs === "function")
      ? enemyBlackboardApi.countActiveTelegraphs(state.enemies)
      : state.enemies.filter((enemy) => enemy.aiming || enemy.slamAiming || enemy.volleyAiming || enemy.burstAiming).length;
    return fallbackActive < getEnemyTelegraphLimit();
  }

  function canEnemyCommitMelee(enemy) {
    if (isEpicShieldReflectActive()) return true;
    if (enemyBlackboardApi && typeof enemyBlackboardApi.canCommitMelee === "function") {
      return enemyBlackboardApi.canCommitMelee(state.enemyBlackboard);
    }
    return (state.enemyMeleeCommitted || 0) < (state.enemyMeleeCommitLimit || 1);
  }

  function registerEnemyMeleeCommit() {
    state.enemyMeleeCommitted = Math.max(0, Number(state.enemyMeleeCommitted) || 0) + 1;
    if (enemyBlackboardApi && typeof enemyBlackboardApi.registerMeleeCommit === "function") {
      enemyBlackboardApi.registerMeleeCommit(state.enemyBlackboard);
    }
  }

  function registerEnemyMeleeOverflowCommit() {
    state.enemyMeleeOverflowCommitted =
      Math.max(0, Number(state.enemyMeleeOverflowCommitted) || 0) + 1;
  }

  function tryEnemyAdjacentPressureMelee(enemy) {
    if (!enemy || state.phase !== "playing") return false;
    if (manhattan(enemy.x, enemy.y, state.player.x, state.player.y) !== 1) return false;
    const overflowUsed = Math.max(0, Number(state.enemyMeleeOverflowCommitted) || 0);
    if (overflowUsed >= ENEMY_ADJACENT_PRESSURE_MAX) return false;
    if (!chance(ENEMY_ADJACENT_PRESSURE_CHANCE)) return false;

    enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
    enemyMelee(enemy);
    if (state.phase !== "playing") return true;
    registerEnemyMeleeOverflowCommit();
    return true;
  }

  function buildEnemyDirectorPlan(enemy, distance) {
    if (!enemyDirector || typeof enemyDirector.decidePlan !== "function") {
      return {
        role: enemy?.type || "swarm",
        lane: "support",
        intent: "chase",
        moveTo: null
      };
    }
    const unopenedChests = state.chests
      .filter((chest) => !chest.opened)
      .map((chest) => ({ x: chest.x, y: chest.y }));
    const plan = enemyDirector.decidePlan({
      enemy,
      player: {
        x: state.player.x,
        y: state.player.y,
        hp: state.player.hp,
        maxHp: state.player.maxHp
      },
      portal: {
        x: state.portal.x,
        y: state.portal.y
      },
      enemies: state.enemies,
      chests: unopenedChests,
      spikes: state.spikes,
      inBounds,
      meleeSlotsUsed: state.enemyMeleeCommitted,
      meleeSlotsLimit: state.enemyMeleeCommitLimit,
      playerShieldActive: isEpicShieldReflectActive(),
      playerLowHp: state.player.hp <= LOW_HP_THRESHOLD,
      playerDistance: distance,
      depth: Math.max(0, Number(state.depth) || 0),
      blackboard: state.enemyBlackboard
    });
    if (!plan || typeof plan !== "object") {
      return {
        role: enemy?.type || "swarm",
        lane: "support",
        intent: "chase",
        moveTo: null
      };
    }
    const existingIndex = state.enemyDebugPlans.findIndex((item) => item.enemy === enemy);
    const debugPlan = {
      enemy,
      intent: plan.intent || "chase",
      moveTo: plan.moveTo || null,
      role: plan.role || enemy.type || "swarm",
      lane: plan.lane || "support"
    };
    if (existingIndex >= 0) {
      state.enemyDebugPlans[existingIndex] = debugPlan;
    } else {
      state.enemyDebugPlans.push(debugPlan);
    }
    return plan;
  }

  function buildEnemyDebugPreviewPlans() {
    if (!state.debugAiOverlay) return null;
    if (!enemyDirector || typeof enemyDirector.decidePlan !== "function") {
      return null;
    }
    const board = createEnemyBlackboard();
    const unopenedChests = state.chests
      .filter((chest) => !chest.opened)
      .map((chest) => ({ x: chest.x, y: chest.y }));
    const plans = [];
    for (const enemy of state.enemies) {
      if (!enemy || !state.enemies.includes(enemy)) continue;
      const distance = manhattan(enemy.x, enemy.y, state.player.x, state.player.y);
      const plan = enemyDirector.decidePlan({
        enemy,
        player: {
          x: state.player.x,
          y: state.player.y,
          hp: state.player.hp,
          maxHp: state.player.maxHp
        },
        portal: {
          x: state.portal.x,
          y: state.portal.y
        },
        enemies: state.enemies,
        chests: unopenedChests,
        spikes: state.spikes,
        inBounds,
        meleeSlotsUsed: 0,
        meleeSlotsLimit: board?.melee?.limit || getEnemyMeleeCommitLimit(),
        playerShieldActive: isEpicShieldReflectActive(),
        playerLowHp: state.player.hp <= LOW_HP_THRESHOLD,
        playerDistance: distance,
        depth: Math.max(0, Number(state.depth) || 0),
        blackboard: board,
        previewOnly: true
      });
      plans.push({
        enemy,
        intent: plan?.intent || "chase",
        moveTo: plan?.moveTo || null,
        role: plan?.role || enemy.type || "swarm",
        lane: plan?.lane || "support"
      });
    }
    return { board, plans };
  }

  function applyEnemyMoveStep(enemy, step) {
    if (!step) return { moved: false, removed: false };
    const oldX = enemy.x;
    const oldY = enemy.y;
    startTween(enemy);
    enemy.x = step.x;
    enemy.y = step.y;
    enemy.facing = getFacingFromDelta(step.x - oldX, step.y - oldY, enemy.facing);
    if (applySpikeToEnemy(enemy)) {
      return { moved: true, removed: true };
    }
    return { moved: true, removed: false };
  }

  function processSingleEnemyTurn(enemy) {
    if (state.phase !== "playing") return;
    if (!state.enemies.includes(enemy)) return;

    if ((enemy.disorientedTurns || 0) > 0) {
      enemy.disorientedTurns = Math.max(0, (Number(enemy.disorientedTurns) || 0) - 1);
      enemy.castFlash = Math.max(enemy.castFlash || 0, 80);
      spawnParticles(enemy.x, enemy.y, "#d7c7ff", 4, 0.55);
      return;
    }

    // Frost Amulet: skip frozen enemies
    if (enemy.frozenThisTurn) {
      if (isFrostImmuneEnemy(enemy)) {
        enemy.frozenThisTurn = false;
        enemy.frostFx = 0;
      } else {
        enemy.frozenThisTurn = false;
        enemy.frostFx = Math.max(enemy.frostFx || 0, 820);
        spawnParticles(enemy.x, enemy.y, "#cde9ff", 4, 0.55);
        return;
      }
    }
    if (enemyTactics && typeof enemyTactics.tickPassiveCooldowns === "function") {
      enemyTactics.tickPassiveCooldowns(enemy);
    }

    let currentDistance = manhattan(enemy.x, enemy.y, state.player.x, state.player.y);
    let lineDistance = Math.abs(enemy.x - state.player.x) + Math.abs(enemy.y - state.player.y);
    const usesCooldown =
      enemy.type === "brute" ||
      enemy.type === "guardian" ||
      enemy.type === "skeleton" ||
      enemy.type === "acolyte" ||
      enemy.type === "skitter" ||
      enemy.type === "warden";
    if (usesCooldown && enemy.cooldown > 0) {
      enemy.cooldown -= 1;
    }

    const epicShieldTauntActive = isEpicShieldReflectActive();
    let aiPlan = buildEnemyDirectorPlan(enemy, currentDistance);
    if (epicShieldTauntActive) {
      aiPlan = {
        ...aiPlan,
        intent: "chase",
        moveTo: null
      };
    }
    enemy.intent = typeof aiPlan.intent === "string" ? aiPlan.intent : "chase";
    let preferredMoveStep = null;

    if (enemy.type === "warden") {
      const smartWarden = state.depth >= WARDEN_SMART_DEPTH_THRESHOLD;
      const wardenCanLineShot = hasLineOfSight(enemy);
      if (enemyTactics && typeof enemyTactics.handleWarden === "function") {
        const wardenTactical = enemyTactics.handleWarden(enemy, {
          distance: currentDistance,
          depth: state.depth,
          focusMode: state.enemyBlackboard?.focusMode || "normal",
          intent: enemy.intent,
          hasLineShot: wardenCanLineShot,
          playerShieldActive: isEpicShieldReflectActive(),
          canStartTelegraph: canStartEnemyTelegraph()
        });
        if (wardenTactical.type === "start_burst") {
          pushLog("Warden weaves a gravity burst.", "bad");
          return;
        }
        if (wardenTactical.type === "hold_burst") {
          if ((enemy.telegraphAge || 0) === 1) {
            pushLog("Warden channels gravity...", "bad");
          }
          return;
        }
        if (wardenTactical.type === "cancel_burst") {
          pushLog("Warden's gravity burst fizzles.", "good");
          return;
        }
        if (wardenTactical.type === "execute_burst") {
          executeWardenBurst(enemy);
          return;
        }
      }

      const canBlast = wardenCanLineShot && lineDistance <= enemy.range && currentDistance > 1;
      if (enemy.aiming) {
        if (canBlast) {
          enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
          enemyRanged(enemy);
          enemy.cooldown = 2;
          enemy.aiming = false;
          pushLog("Warden casts a pulse blast.", "bad");
          return;
        }
        enemy.aiming = false;
      }
      const wantsCast = enemy.intent === "cast";
      if (canBlast && enemy.cooldown === 0 && wantsCast) {
        enemy.aiming = true;
        pushLog("Warden charges a pulse blast.", "bad");
        return;
      }
      if (smartWarden) {
        const alreadyInCastPosition = isWardenCastPositionAt(enemy.x, enemy.y, enemy.range, 2);
        const wantsReposition =
          (enemy.cooldown === 0 && wantsCast && !canBlast) ||
          (enemy.cooldown > 0 && currentDistance <= 2) ||
          (!alreadyInCastPosition && currentDistance > 1 && (enemy.cooldown > 0 || wantsCast));
        if (wantsReposition) {
          preferredMoveStep = getWardenSetupStep(enemy, {
            smartMode: true,
            wantsCast,
            preferRetreat: currentDistance <= 2
          }) || preferredMoveStep;
        }
      }
    }

    if (enemy.type === "skeleton") {
      const canLineShot = hasLineOfSight(enemy) && lineDistance >= 2 && lineDistance <= enemy.range;
      if (enemyTactics && typeof enemyTactics.handleSkeleton === "function") {
        const skeletonTactical = enemyTactics.handleSkeleton(enemy, {
          canLineShot,
          intent: enemy.intent,
          playerShieldActive: isEpicShieldReflectActive(),
          canStartTelegraph: canStartEnemyTelegraph()
        });
        if (skeletonTactical.type === "start_volley") {
          pushLog("Skeleton prepares a bone volley.", "bad");
          return;
        }
        if (skeletonTactical.type === "execute_volley") {
          enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
          enemyRanged(enemy, {
            source: `${enemy.name} bone volley`,
            damageMultiplier: 1.2,
            color: "#d4e8ff"
          });
          enemy.cooldown = 4;
          pushLog("Skeleton unleashes bone volley.", "bad");
          return;
        }
      }
      if (enemy.aiming) {
        if (canLineShot) {
          enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
          enemyRanged(enemy);
          enemy.cooldown = 4;
          return;
        }
        enemy.aiming = false;
      }
      const wantsCast = enemy.intent === "cast";
      if (canLineShot && enemy.cooldown === 0 && wantsCast) {
        if (isEpicShieldReflectActive()) {
          enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
          enemyRanged(enemy);
          enemy.cooldown = 4;
          return;
        }
        enemy.aiming = true;
        pushLog("Skeleton lines up a shot.", "bad");
        return;
      }
      const alreadyInCastPosition = isSkeletonCastPositionAt(enemy.x, enemy.y, enemy.range);
      if (currentDistance > 1) {
        if (enemy.cooldown > 0 && !alreadyInCastPosition) {
          preferredMoveStep = getSkeletonSetupStep(enemy) || stepToward(enemy, state.player.x, state.player.y);
        } else if (enemy.cooldown === 0 && wantsCast && !canLineShot) {
          preferredMoveStep = getSkeletonSetupStep(enemy) || stepToward(enemy, state.player.x, state.player.y);
        }
      }
    }

    if (enemy.type === "acolyte") {
      const canAcolyteAttackCast =
        hasLineOfSight(enemy) &&
        lineDistance >= 2 &&
        lineDistance <= enemy.range;
      const acolytePlan = getAcolyteCastPlan(enemy, {
        wantsCast: enemy.intent === "cast",
        canAttackCast: canAcolyteAttackCast
      });
      if (enemy.aiming) {
        const castType = String(enemy.acolyteCastType || "buff").toLowerCase();
        if (castType === "heal") {
          const healTarget = getAcolyteHealTarget(enemy, ACOLYTE_SUPPORT_RANGE);
          if (healTarget && state.enemies.includes(healTarget)) {
            enemy.facing = getFacingFromDelta(healTarget.x - enemy.x, healTarget.y - enemy.y, enemy.facing);
            applyAcolyteHeal(enemy, healTarget);
            enemy.cooldown = ACOLYTE_SUPPORT_HEAL_CAST_COOLDOWN;
            enemy.aiming = false;
            enemy.acolyteCastType = "";
            return;
          }
        } else if (castType === "attack") {
          if (canAcolyteAttackCast) {
            enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
            executeAcolyteAttack(enemy);
            enemy.cooldown = ACOLYTE_ATTACK_CAST_COOLDOWN;
            enemy.aiming = false;
            enemy.acolyteCastType = "";
            return;
          }
        } else {
          const buffTarget = getAcolyteBuffTarget(enemy, ACOLYTE_SUPPORT_RANGE);
          if (
            buffTarget &&
            state.enemies.includes(buffTarget) &&
            !state.enemyAcolyteBuffCastThisTurn
          ) {
            enemy.facing = getFacingFromDelta(buffTarget.x - enemy.x, buffTarget.y - enemy.y, enemy.facing);
            applyAcolyteBuff(enemy, buffTarget);
            enemy.cooldown = ACOLYTE_SUPPORT_BUFF_CAST_COOLDOWN;
            enemy.aiming = false;
            enemy.acolyteCastType = "";
            return;
          }
        }
        enemy.aiming = false;
        enemy.acolyteCastType = "";
        enemy.cooldown = Math.max(enemy.cooldown || 0, ACOLYTE_SUPPORT_CANCEL_COOLDOWN);
        return;
      }
      if (acolytePlan.type !== "none" && enemy.cooldown === 0 && canStartEnemyTelegraph()) {
        enemy.aiming = true;
        enemy.acolyteCastType = acolytePlan.type;
        if (acolytePlan.type === "heal") {
          pushLog("Acolyte begins a mending chant.", "bad");
        } else if (acolytePlan.type === "buff") {
          pushLog("Acolyte begins a dark blessing.", "bad");
        } else {
          pushLog("Acolyte gathers shadow energy.", "bad");
        }
        return;
      }
      if (
        acolytePlan.type === "attack" &&
        enemy.cooldown === 0 &&
        canAcolyteAttackCast &&
        !canStartEnemyTelegraph()
      ) {
        enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
        executeAcolyteAttack(enemy);
        enemy.cooldown = ACOLYTE_ATTACK_CAST_COOLDOWN;
        enemy.aiming = false;
        enemy.acolyteCastType = "";
        return;
      }
    }

    if (enemy.type === "brute" || enemy.type === "guardian") {
      const bruteTactical = enemyTactics && typeof enemyTactics.handleBrute === "function"
        ? enemyTactics.handleBrute(enemy, {
          distance: currentDistance,
          canStartTelegraph: canStartEnemyTelegraph()
        })
        : { type: "none" };
      if (bruteTactical.type === "cancel_slam") {
        enemy.rests = false;
      }
      enemy.rests = Boolean(enemy.slamAiming);
      if (bruteTactical.type === "start_slam") {
        if (!canEnemyCommitMelee(enemy)) {
          return;
        }
        pushLog(`${enemy.name} winds up a slam!`, "bad");
        return;
      }
      if (bruteTactical.type === "execute_slam") {
        if (!canEnemyCommitMelee(enemy)) {
          return;
        }
        enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
        if (!useBruteKnockback(enemy) && state.phase === "playing") {
          if (canEnemyCommitMelee(enemy)) {
            enemyMelee(enemy);
            if (state.phase !== "playing") return;
            registerEnemyMeleeCommit();
            pushLog(`${enemy.name} slam was blocked, but the hit still lands.`, "bad");
          }
        }
        enemy.cooldown = 3;
        if (state.phase === "playing") registerEnemyMeleeCommit();
        return;
      }
    }

    if (enemy.type === "skitter") {
      if (currentDistance === 3 && enemy.cooldown === 0 && canEnemyCommitMelee(enemy)) {
        if (tryUseSkitterLunge(enemy)) {
          return;
        }
      }
    }

    if (
      enemy.type === "warden" &&
      state.depth >= WARDEN_SMART_DEPTH_THRESHOLD &&
      currentDistance === 1
    ) {
      const retreatStep = getWardenSetupStep(enemy, {
        smartMode: true,
        wantsCast: enemy.intent === "cast",
        preferRetreat: true
      });
      if (
        retreatStep &&
        (retreatStep.x !== enemy.x || retreatStep.y !== enemy.y)
      ) {
        const retreatMove = applyEnemyMoveStep(enemy, retreatStep);
        if (retreatMove.removed) return;
        if (retreatMove.moved) return;
      }
    }

    if (currentDistance === 1 && !canEnemyCommitMelee(enemy)) {
      if (tryEnemyAdjacentPressureMelee(enemy)) {
        return;
      }
      if (
        aiPlan.moveTo &&
        (aiPlan.moveTo.x !== enemy.x || aiPlan.moveTo.y !== enemy.y) &&
        !enemyTileBlocked(aiPlan.moveTo.x, aiPlan.moveTo.y, enemy)
      ) {
        const moveOff = applyEnemyMoveStep(enemy, aiPlan.moveTo);
        if (moveOff.removed) return;
        if (moveOff.moved) return;
        currentDistance = manhattan(enemy.x, enemy.y, state.player.x, state.player.y);
        lineDistance = Math.abs(enemy.x - state.player.x) + Math.abs(enemy.y - state.player.y);
      }
    }

    if (currentDistance === 1 && canEnemyCommitMelee(enemy)) {
      enemy.facing = getFacingFromDelta(state.player.x - enemy.x, state.player.y - enemy.y, enemy.facing);
      enemyMelee(enemy);
      if (state.phase !== "playing") return;
      registerEnemyMeleeCommit();
      return;
    }
    if (currentDistance === 1 && !canEnemyCommitMelee(enemy)) {
      if (tryEnemyAdjacentPressureMelee(enemy)) {
        return;
      }
    }

    let step = preferredMoveStep || null;
    if (step && step.x === enemy.x && step.y === enemy.y) {
      step = null;
    }
    if (
      !step &&
      aiPlan.moveTo &&
      (aiPlan.moveTo.x !== enemy.x || aiPlan.moveTo.y !== enemy.y) &&
      !enemyTileBlocked(aiPlan.moveTo.x, aiPlan.moveTo.y, enemy)
    ) {
      step = aiPlan.moveTo;
    }
    if (!step) {
      step = stepToward(enemy, state.player.x, state.player.y);
    }
    if (!step) return;

    const moved = applyEnemyMoveStep(enemy, step);
    if (moved.removed) return;
    currentDistance = manhattan(enemy.x, enemy.y, state.player.x, state.player.y);
    lineDistance = Math.abs(enemy.x - state.player.x) + Math.abs(enemy.y - state.player.y);

    // Fast affix double move (skitter or fast affix)
    const hasDoubleMove = enemy.type === "skitter" ||
      enemy.affix === "fast";
    if (hasDoubleMove && state.phase === "playing" && state.enemies.includes(enemy)) {
      if (currentDistance > 1) {
        const bonusPlan = buildEnemyDirectorPlan(enemy, currentDistance);
        let bonusStep = null;
        if (
          bonusPlan.moveTo &&
          !enemyTileBlocked(bonusPlan.moveTo.x, bonusPlan.moveTo.y, enemy)
        ) {
          bonusStep = bonusPlan.moveTo;
        }
        if (!bonusStep) {
          bonusStep = stepToward(enemy, state.player.x, state.player.y);
        }
        if (bonusStep) {
          const bonusMove = applyEnemyMoveStep(enemy, bonusStep);
          if (bonusMove.removed) return;
          currentDistance = manhattan(enemy.x, enemy.y, state.player.x, state.player.y);
          lineDistance = Math.abs(enemy.x - state.player.x) + Math.abs(enemy.y - state.player.y);
        }
      }
    }
    return;
  }

  function clearEnemyTurnSequence() {
    state.enemyTurnInProgress = false;
    state.enemyTurnQueue = [];
    state.enemyTurnStepTimer = 0;
    state.enemyTurnStepIndex = 0;
    state.enemyMeleeCommitted = 0;
    state.enemyMeleeOverflowCommitted = 0;
    state.enemyAcolyteBuffCastThisTurn = false;
    state.enemyBlackboard = null;
    state.enemyDebugPlans = [];
  }

  function finishTurnAfterEnemySequence() {
    clearEnemyTurnSequence();
    if (state.phase !== "playing") {
      state.playerHitEnemyThisTurn = false;
      state.turnInProgress = false;
      markUiDirty();
      return;
    }

    tickDashAfterline();
    if (state.phase !== "playing") {
      state.playerHitEnemyThisTurn = false;
      state.turnInProgress = false;
      markUiDirty();
      return;
    }

    // Burning Blade: tick burn damage on enemies
    tickBurningEnemies();
    if (state.phase !== "playing") {
      state.playerHitEnemyThisTurn = false;
      state.turnInProgress = false;
      markUiDirty();
      return;
    }

    checkRoomClearBonus();
    if (state.phase !== "playing") {
      state.playerHitEnemyThisTurn = false;
      state.turnInProgress = false;
      markUiDirty();
      return;
    }

    triggerShrineSwappingIfReady();
    if (state.phase !== "playing") {
      state.playerHitEnemyThisTurn = false;
      state.turnInProgress = false;
      markUiDirty();
      return;
    }
    if (applyShrineHungerMissPenalty()) {
      state.playerHitEnemyThisTurn = false;
      state.turnInProgress = false;
      markUiDirty();
      return;
    }

    // Chaos Orb: rolls a random effect every 10 turns.
    tickChaosOrb();

    // Phase Cloak cooldown
    if (hasRelic("phasecloak") && state.player.phaseCooldown > 0) {
      state.player.phaseCooldown -= 1;
    }

    tickSkillCooldowns();
    tickShieldChargeRegen();
    tickAutoPotionCooldown();
    tickDashImmunity();
    tickQuickloaderBuff();
    tickFuryBlessing();
    tickCombatBoost();
    tickBarrier();
    state.playerHitEnemyThisTurn = false;
    saveMetaProgress();
    saveRunSnapshot();
    state.turnInProgress = false;
    markUiDirty();
  }

  function startEnemyTurnSequence() {
    if (state.phase !== "playing") {
      state.turnInProgress = false;
      return;
    }
    for (const enemy of state.enemies) {
      if (!enemy) continue;
      if ((enemy.acolyteBuffTurns || 0) > 0) {
        enemy.acolyteBuffTurns = Math.max(0, (Number(enemy.acolyteBuffTurns) || 0) - 1);
      }
    }
    state.enemyTurnQueue = [...state.enemies];
    state.enemyTurnStepIndex = 0;
    state.enemyTurnStepTimer = getEnemyTurnStepDelayMs();
    state.enemyMeleeCommitLimit = getEnemyMeleeCommitLimit();
    state.enemyMeleeCommitted = 0;
    state.enemyMeleeOverflowCommitted = 0;
    state.enemyAcolyteBuffCastThisTurn = false;
    state.enemyBlackboard = createEnemyBlackboard();
    if (state.enemyBlackboard && state.enemyBlackboard.antiStrafe) {
      state.enemyAntiStrafe = state.enemyBlackboard.antiStrafe;
    }
    if (state.enemyBlackboard && state.enemyBlackboard.melee) {
      state.enemyMeleeCommitLimit = state.enemyBlackboard.melee.limit || state.enemyMeleeCommitLimit;
    }
    state.enemyDebugPlans = [];
    state.enemyTurnInProgress = true;
    if (state.enemyTurnQueue.length <= 0) {
      finishTurnAfterEnemySequence();
      return;
    }
    markUiDirty();
  }

  function updateEnemyTurnSequence(dt) {
    if (!state.enemyTurnInProgress) return;
    if (state.phase !== "playing") {
      clearEnemyTurnSequence();
      state.turnInProgress = false;
      return;
    }

    state.enemyTurnStepTimer -= dt;
    if (state.enemyTurnStepTimer > 0) return;
    state.enemyTurnStepTimer = getEnemyTurnStepDelayMs();

    const enemy = state.enemyTurnQueue.shift();
    if (!enemy) {
      finishTurnAfterEnemySequence();
      return;
    }
    state.enemyTurnStepIndex += 1;
    processSingleEnemyTurn(enemy);
    if (state.phase !== "playing") {
      clearEnemyTurnSequence();
      state.turnInProgress = false;
      markUiDirty();
      return;
    }
    if (state.enemyTurnQueue.length <= 0) {
      finishTurnAfterEnemySequence();
    } else {
      markUiDirty();
    }
  }

  function enemyTurn() {
    startEnemyTurnSequence();
  }

  function tickBurningEnemies() {
    if (!hasRelic("burnblade")) return;
    for (const enemy of [...state.enemies]) {
      if (!state.enemies.includes(enemy)) continue;
      if ((enemy.burnTurns || 0) > 0) {
        enemy.burnTurns -= 1;
        enemy.hp -= BURNING_BLADE_DOT_DAMAGE;
        triggerEnemyHitFlash(enemy);
        spawnFloatingText(enemy.x, enemy.y, `-${BURNING_BLADE_DOT_DAMAGE}`, "#ffb17f", { life: 420, size: 7 });
        spawnParticles(enemy.x, enemy.y, "#ff6a35", 4, 0.8);
        if (enemy.hp <= 0) {
          killEnemy(enemy, "burn");
        }
      }
    }
  }

  function isFrostImmuneEnemy(enemy) {
    return Boolean(enemy && (enemy.elite || enemy.type === "warden" || enemy.type === "guardian"));
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
      triggerEnemyHitFlash(target);
      spawnFloatingText(target.x, target.y, `-${CHAOS_ORB_ENEMY_DAMAGE}`, "#ffd6f8", { life: 700, size: 9 });
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
    if (state.turnInProgress) return;
    state.turnInProgress = true;
    state.playerShieldBrokeThisTurn = false;
    const hasCombatTurn = state.enemies.length > 0 || state.playerHitEnemyThisTurn;

    // Magnetic Shard: auto-loot adjacent chests
    tickMagneticShard();
    if (state.phase !== "playing") {
      state.playerShieldBrokeThisTurn = false;
      state.turnInProgress = false;
      return;
    }

    applySpikeToPlayer();
    if (state.phase !== "playing") {
      state.playerShieldBrokeThisTurn = false;
      state.turnInProgress = false;
      return;
    }

    // Out-of-combat movement should not advance turn-based timers/cooldowns.
    if (!hasCombatTurn) {
      state.playerHitEnemyThisTurn = false;
      state.playerShieldBrokeThisTurn = false;
      saveMetaProgress();
      saveRunSnapshot();
      state.turnInProgress = false;
      markUiDirty();
      return;
    }

    recordPlayerCombatPosition();
    state.turn += 1;

    // Frost Amulet: freeze nearby enemies before their turn
    tickFrostAmulet();

    enemyTurn();
    if (state.phase !== "playing") {
      state.turnInProgress = false;
      return;
    }
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
    if (hasRelic("risk")) {
      pushLog("Risk prevents potion use.", "bad");
      return;
    }
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
    state.potionUsedInRoom = true;
    state.potionFreeRoomStreak = 0;
    const healResult = healPlayer(getPotionHealAmount(), {
      visuals: true,
      textColor: "#9ff7a9",
      particleColor: "#8ce1a7",
      particleCount: 10,
      particleSpread: 1.05
    });
    applyQuickloaderPotionBuff();
    pushLog(
      `Potion used. +${healResult.restored} HP${healResult.shielded > 0 ? `, +${healResult.shielded} shield` : ""}.`,
      "good"
    );
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
    if (state.depth >= MAX_DEPTH) {
      pushLog(`Depth cap reached (${MAX_DEPTH}). Defeat the final boss to win.`, "bad");
      return;
    }
    state.depth = Math.min(MAX_DEPTH, state.depth + 1);
    healPlayer(scaledCombat(1), {
      visuals: true,
      textColor: "#9ff7a9",
      particleColor: "#8ce1a7",
      particleCount: 7,
      particleSpread: 0.95
    });
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
      if (activeEffectsEl) {
        activeEffectsEl.innerHTML = "";
      }
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
    const armorCapPct = Math.round(ARMOR_DAMAGE_REDUCTION_CAP * 100);
    const statRow = (label, value, tooltip = "") =>
      `<div class="statline"><span${tooltip ? ` title="${escapeHtmlAttr(tooltip)}"` : ""}>${label}</span><strong>${value}</strong></div>`;

    const combatRows = [
      statRow("Player", state.playerName || "Not set", "Your current nickname used for leaderboard entries."),
      statRow("Lives", `${state.lives}/${MAX_LIVES}`, "Lives are lost on death. At 0 lives, meta progress resets."),
      statRow("HP", (() => {
        const totalShield = Math.max(0, Math.round(getTotalPlayerShield()));
        const base = `${state.player.hp}/${state.player.maxHp}`;
        return totalShield > 0
          ? `${base} <span style="color:#7be0ff;font-weight:700">(+${totalShield})</span>`
          : base;
      })(), "Current and maximum health. Reaching 0 HP kills the run."),
      statRow(
        "ATK",
        `${state.player.attack}${chaosAtkBonus > 0 ? ` (+${chaosAtkBonus})` : ""}`,
        "Base damage for attacks and many skills before crits and modifiers."
      ),
      statRow(
        "ARM",
        state.player.armor,
        `Flat damage reduction on incoming hits. Armor cannot reduce more than ${armorCapPct}% of one hit.`
      ),
      statRow(
        "Crit",
        `${Math.round(state.player.crit * 100)}%`,
        `Chance to deal critical damage (x2). Crit chance cap is ${Math.round(CRIT_CHANCE_CAP * 100)}%.`
      )
    ];

    const runMetaRows = [
      statRow("Depth", state.depth, "Current dungeon depth in this run."),
      statRow("Depth Highscore", state.highscore, "Best depth reached across all runs."),
      statRow("Run Score", calculateScore(getRunMaxDepth(), getRunGoldEarned()), "Combined performance score for the current run."),
      statRow("Room", ROOM_TYPE_LABELS[state.roomType], "Current room type."),
      statRow(
        "Map Fragments",
        `${state.treasureMapFragments}/10${state.forcedNextRoomType === "vault" ? " (Vault queued)" : ""}`,
        "Collect 10 Treasure Map Fragments from chests to force the next eligible depth into a Vault room."
      ),
      statRow("Turn", state.turn, "Total turns played in current run."),
      statRow("Camp Gold", state.campGold, "Persistent currency for camp upgrades."),
      statRow("Deaths", state.deaths, "Total deaths across your profile.")
    ];
    if (hasRelic("chaosorb")) {
      runMetaRows.push(
        statRow("Chaos Roll", `${chaosTurnsLeft}T`, "Turns left until the next Chaos Orb roll.")
      );
    }
    if (state.player.chaosKillHeal > 0) {
      runMetaRows.push(
        statRow("Chaos Heal", `+${state.player.chaosKillHeal}/kill`, "Chaos Orb effect: heal this amount on each kill.")
      );
    }

    const relicGroups = getRelicInventoryGroups();
    const relicItems = relicGroups.map(({ relicId, count }) => {
      const rel = RELICS.find((r) => r.id === relicId);
      if (!rel) return "";
      const ri = RARITY[rel.rarity] || RARITY.normal;
      const chronoSpent = relicId === "chronoloop" && state.player.chronoUsedThisRun;
      const relicColor = chronoSpent ? "#ff5f5f" : ri.color;
      const stackSuffix = count > 1
        ? rel.rarity === "normal"
          ? ` x${count}/${MAX_NORMAL_RELIC_STACK}`
          : ` x${count}`
        : "";
      const tooltip = `${rel.desc} | Rarity: ${ri.label}${count > 1 ? ` | Stack: ${count}` : ""}`;
      return `<div class="hud-relic-item" style="color:${relicColor}" title="${escapeHtmlAttr(tooltip)}">${rel.name}${stackSuffix}</div>`;
    }).filter(Boolean);

    const section = (bodyHtml) => [
      `<div class="hud-section">`,
      bodyHtml,
      `</div>`
    ].join("");

    const relicBody = [
      statRow("Relics", `${state.relics.length}/${MAX_RELICS}`, "Equipped relics for the current run."),
      relicItems.length > 0
        ? relicItems.join("")
        : `<div class="hud-relic-empty">No relics</div>`
    ].join("");

    const activeEffectRows = [];
    if (hasRelic("vampfang")) {
      activeEffectRows.push(
        statRow(
          "Lifesteal",
          `${Math.round(VAMPFANG_LIFESTEAL_MULTIPLIER * 100)}% (cap ${VAMPFANG_MAX_HEAL_PER_HIT}/hit)`,
          "Vampiric Fang heals a percent of damage dealt, capped per hit."
        )
      );
    }
    if (hasRelic("laststandtorque")) {
      const bonus = getLastStandTorqueAttackBonus();
      activeEffectRows.push(
        statRow(
          "Last Stand",
          bonus > 0 ? `+${bonus} ATK (active)` : "inactive",
          "Below 50% HP grants +20 ATK."
        )
      );
    }
    if (hasRelic("momentumengine")) {
      activeEffectRows.push(
        statRow(
          "Momentum",
          "+20% Dash DMG",
          "Momentum Engine increases Dash damage by 20%."
        )
      );
    }
    if (hasRelic("engineofwar") || (state.player.engineOfWarTurns || 0) > 0) {
      const engineUsedThisDepth = (Number(state.player.engineOfWarTriggeredDepth) || -1) === Math.max(0, Number(state.depth) || 0);
      const engineLabel = (state.player.engineOfWarTurns || 0) > 0
        ? `${state.player.engineOfWarTurns}T | +30% DMG | +20% LS`
        : (engineUsedThisDepth ? "spent this depth" : "ready");
      activeEffectRows.push(
        statRow(
          "Engine of War",
          engineLabel,
          "Below 30% HP: gain shield and a short overdrive. Triggers once per depth."
        )
      );
    }
    if (hasRelic("bloodvial") || (state.player.bloodVialShield || 0) > 0) {
      activeEffectRows.push(
        statRow(
          "Blood Shield",
          `${Math.max(0, Number(state.player.bloodVialShield) || 0)}`,
          "Blood Vial converts overheal into a shield that absorbs incoming damage."
        )
      );
    }
    if (hasRelic("stormsigil")) {
      const hitCount = Math.max(0, Number(state.player.stormSigilHitCount) || 0);
      const cyclePos = hitCount % STORM_SIGIL_HIT_INTERVAL;
      const toProc = cyclePos === 0 ? STORM_SIGIL_HIT_INTERVAL : (STORM_SIGIL_HIT_INTERVAL - cyclePos);
      activeEffectRows.push(
        statRow(
          "Storm Sigil",
          `+${STORM_SIGIL_BONUS_DAMAGE} every ${STORM_SIGIL_HIT_INTERVAL}th hit (next ${toProc})`,
          "Every 10th successful hit deals bonus damage."
        )
      );
    }
    if ((state.player.graveWhisperAtkBonus || 0) > 0) {
      activeEffectRows.push(
        statRow(
          "Grave Whisper",
          `+${state.player.graveWhisperAtkBonus}/${GRAVE_WHISPER_ATK_CAP} ATK`,
          "Encounter-only attack bonus from kills."
        )
      );
    }
    if ((state.player.quickloaderAtkTurns || 0) > 0 && (state.player.quickloaderAtkBonus || 0) > 0) {
      activeEffectRows.push(
        statRow(
          "Quickloader",
          `+${state.player.quickloaderAtkBonus} (${state.player.quickloaderAtkTurns}T)`,
          "Potion buff: temporary attack power."
        )
      );
    }
    if (hasRelic("burnblade")) {
      activeEffectRows.push(
        statRow(
          "Burn DPS",
          `${BURNING_BLADE_DOT_DAMAGE}/turn`,
          "Burning Blade applies this damage each turn for 3 turns."
        )
      );
    }
    if (hasRelic("soulharvest") || (state.player.soulHarvestGained || 0) > 0) {
      const gainedStacks = Math.max(0, Number(state.player.soulHarvestGained) || 0);
      const killProgress = Math.max(0, Number(state.player.soulHarvestCount) || 0) % SOUL_HARVEST_KILL_INTERVAL;
      const perStackHp = scaledCombat(1);
      const gainedHp = gainedStacks * perStackHp;
      const capHp = 10 * perStackHp;
      const killsToNext = gainedStacks >= 10
        ? "CAP"
        : String(Math.max(1, SOUL_HARVEST_KILL_INTERVAL - killProgress));
      activeEffectRows.push(
        statRow(
          "Soul Harvest",
          `Next +${perStackHp} in ${killsToNext} | Gained +${gainedHp}/${capHp} Max HP`,
          "Shows kills remaining to next Soul Harvest bonus and total max HP gained this run."
        )
      );
    }
    if (state.sessionChestAttackFlat > 0) {
      activeEffectRows.push(
        statRow(
          "Chest ATK",
          `+${state.sessionChestAttackFlat}`,
          "Flat attack gained from chest upgrades in this run."
        )
      );
    }
    if (state.sessionChestArmorFlat > 0) {
      activeEffectRows.push(
        statRow(
          "Chest ARM",
          `+${state.sessionChestArmorFlat}`,
          "Flat armor gained from chest upgrades in this run."
        )
      );
    }
    if (state.sessionChestHealthFlat > 0) {
      activeEffectRows.push(
        statRow(
          "Chest Max HP",
          `+${state.sessionChestHealthFlat}`,
          "Flat max HP gained from chest upgrades in this run."
        )
      );
    }
    if (state.player.furyBlessingTurns > 0) {
      activeEffectRows.push(
        statRow("Fury Bless", `${state.player.furyBlessingTurns}T`, "Fury Blessing active: +2 effective Fury.")
      );
    }
    if (state.player.combatBoostTurns > 0) {
      activeEffectRows.push(
        statRow("Combat Boost", `+20 ATK/ARM (${state.player.combatBoostTurns}T)`, "Temporary combat boost from merchant: +20 ATK and +20 ARM.")
      );
    }
    if (state.player.hasSecondChance) {
      activeEffectRows.push(
        statRow("Second Chance", "Ready", "You will survive the next fatal blow with 100 HP.")
      );
    }
    if (state.player.shrineAttackTurns > 0 && state.player.shrineAttackBonus > 0) {
      activeEffectRows.push(
        statRow(
          "Shrine ATK",
          `+${state.player.shrineAttackBonus} (${state.player.shrineAttackTurns}T)`,
          "Temporary attack bonus from shrine blessing."
        )
      );
    }
    if (state.player.shrineArmorTurns > 0 && state.player.shrineArmorBonus > 0) {
      activeEffectRows.push(
        statRow(
          "Shrine ARM",
          `+${state.player.shrineArmorBonus} (${state.player.shrineArmorTurns}T)`,
          "Temporary armor bonus from shrine blessing."
        )
      );
    }
    if (state.player.shrineMaxHpTurns > 0 && state.player.shrineMaxHpBonus > 0) {
      activeEffectRows.push(
        statRow(
          "Shrine Max HP",
          `+${state.player.shrineMaxHpBonus} (${state.player.shrineMaxHpTurns}T)`,
          "Temporary max HP bonus from shrine blessing."
        )
      );
    }
    if (state.player.shrineSwapTurns > 0) {
      const turnsUntilSwap = Math.max(
        1,
        SHRINE_SWAPPING_INTERVAL_TURNS - Math.max(0, Number(state.player.shrineSwapCounter) || 0)
      );
      activeEffectRows.push(
        statRow(
          "Shrine Swap",
          `${state.player.shrineSwapTurns}T | next ${turnsUntilSwap}T`,
          "Every 15 turns swaps your position with a random enemy."
        )
      );
    }
    if (state.player.shrineNoiseTurns > 0) {
      activeEffectRows.push(
        statRow(
          "Shrine Noise",
          `${state.player.shrineNoiseTurns}T`,
          "Killing an enemy knocks back nearby enemies without dealing damage."
        )
      );
    }
    if (state.player.shrineHungerTurns > 0) {
      activeEffectRows.push(
        statRow(
          "Shrine Hunger",
          `+${SHRINE_HUNGER_HEAL_PER_HIT}/hit | ${state.player.shrineHungerTurns}T`,
          `If you do not hit any enemy in a turn, you lose ${SHRINE_HUNGER_MISS_DAMAGE} HP.`
        )
      );
    }
    if (state.player.chaosAtkTurns > 0 && state.player.chaosAtkBonus > 0) {
      activeEffectRows.push(
        statRow(
          "Chaos ATK",
          `+${state.player.chaosAtkBonus} (${state.player.chaosAtkTurns}T)`,
          "Chaos Orb attack bonus while this effect lasts."
        )
      );
    }
    const activeEffectsBody = [
      statRow("Active Effects", `${Math.max(0, activeEffectRows.length)}`, "Current temporary and relic-driven combat effects."),
      activeEffectRows.length > 0 ? activeEffectRows.join("") : `<div class="hud-relic-empty">No active effects</div>`
    ].join("");

    hudEl.innerHTML = [
      section(combatRows.join("")),
      section(runMetaRows.join("")),
      section(relicBody)
    ].join("");
    if (activeEffectsEl) {
      if (state.phase === "camp") {
        activeEffectsEl.innerHTML = "";
        activeEffectsEl.style.display = "none";
      } else {
        activeEffectsEl.innerHTML = activeEffectsBody;
        activeEffectsEl.style.display = "";
      }
    }
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
    let leftMetaTop = "";
    let leftMetaTopTooltip = "";
    let leftMetaBottom = "";
    let rightMetaTop = "";
    let rightMetaBottom = "";
    const observerBotTag = isObserverBotActive() ? " | BOT ON" : "";

    if (state.phase === "playing" || state.phase === "relic") {
      const roomLabel = ROOM_TYPE_LABELS[state.roomType] || "Room";
      const bossStatus = state.bossRoom ? "BOSS NOW" : `BOSS IN ${getRoomsUntilBoss()}`;
      const furyNow = Math.max(0, Number(state.player.adrenaline) || 0);
      const furyMax = Math.max(0, Number(state.player.maxAdrenaline) || 0);
      const furyBonus = Math.max(0, Number(getFuryBlessingBonus()) || 0);
      const effectiveFury = getEffectiveAdrenaline();
      const effectiveMaxFury = getEffectiveMaxAdrenaline();
      const furyPctPerStack = Math.round(FURY_ATTACK_POWER_PER_STACK * 100);
      const furyPctCap = Math.round(FURY_ATTACK_POWER_MAX_BONUS * 100);
      title = `Depth ${state.depth}`;
      subtitle = `${roomLabel} Room - ${bossStatus}${observerBotTag}`;
      leftMetaTop = `Fury ${effectiveFury}/${effectiveMaxFury}`;
      leftMetaTopTooltip = `Current Fury: ${furyNow}/${furyMax}${furyBonus > 0 ? ` (+${furyBonus} from Fury Blessing)` : ""}. Effective Fury is ${effectiveFury}/${effectiveMaxFury}. Fury is gained mainly on kill (+1, capped by max). Fury grants +${furyPctPerStack}% attack power per stack (cap +${furyPctCap}%). This scales basic attacks and the base damage of Dash/Shockwave. Shockwave still spends all current Fury on cast.`;
      rightMetaTop = `Run Gold ${state.player.gold}`;
      rightMetaBottom = `Potions ${state.player.potions}/${state.player.maxPotions}`;
    } else if (state.phase === "won") {
      const victoryDepth = Math.max(0, Number(state.finalVictoryPrompt?.depth) || MAX_DEPTH);
      title = "VICTORY";
      subtitle = `Final depth ${victoryDepth} conquered`;
    } else if (state.phase === "camp") {
      const lastDepth = state.lastExtract?.depth ?? state.depth;
      title = "Camp";
      subtitle = `Last run depth ${lastDepth}${observerBotTag}`;
    } else if (state.phase === "dead") {
      title = `Depth ${state.depth}`;
      subtitle = "Run Over";
    } else {
      title = "Main Menu";
      subtitle = state.hasContinueRun ? "Continue available" : "Fresh run ready";
    }

    depthBadgeEl.innerHTML = [
      `<div class="depth-badge-meta">`,
      `<div class="depth-meta-column depth-meta-left">`,
      `<span class="depth-meta"${leftMetaTopTooltip ? ` title="${escapeHtmlAttr(leftMetaTopTooltip)}"` : ""}>${leftMetaTop || "&nbsp;"}</span>`,
      `<span class="depth-meta">${leftMetaBottom || "&nbsp;"}</span>`,
      `</div>`,
      `<div class="depth-meta-column depth-meta-right">`,
      `<span class="depth-meta">${rightMetaTop || "&nbsp;"}</span>`,
      `<span class="depth-meta">${rightMetaBottom || "&nbsp;"}</span>`,
      `</div>`,
      `</div>`,
      `<strong>${title}</strong>`,
      `<span class="depth-subtitle">${subtitle}</span>`
    ].join("");

    const inBossRoom = state.phase === "playing" && state.bossRoom;
    depthBadgeEl.classList.remove("hidden");
    depthBadgeEl.classList.toggle("boss", inBossRoom);
    canvas.classList.toggle("boss-pulse", inBossRoom);
  }

  function getSkillTierEffectsSummary(skillId) {
    const tier = getSkillTier(skillId);
    if (skillId === "dash") {
      if (tier >= 3) return "4-tile pierce, x2 dmg, first hit +60%, splash, afterline 4T";
      if (tier >= 2) return "4-tile pierce, x2 dmg, landing splash";
      if (tier >= 1) return "3-tile pierce, x2 damage";
      return "3-tile pierce + knockback";
    }
    if (skillId === "aoe") {
      if (tier >= 3) return "R2 overload: ring1 120%, ring2 80%, +20%/Fury, ring1 disorient 2T";
      if (tier >= 2) return "Base 60% dmg, +20% per Fury spent, knockback, ring2 falloff";
      if (tier >= 1) return "Base 60% dmg, +20% per Fury spent, knockback";
      return "Base 60% damage, +20% per Fury spent";
    }
    if (skillId === "shield") {
      if (tier >= 3) return "125% shield, decays 20%/turn, knockback, 2 charges, melee reflect, stores absorbed dmg for blast";
      if (tier >= 2) return "125% shield, decays 20%/turn, knockback, 2 charges (20T), melee reflect";
      if (tier >= 1) return "125% shield, decays 20%/turn, cast knockback";
      return "100% Max HP shield, decays 20% each combat turn";
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
      const shieldCharges = skill.id === "shield" ? getShieldChargesInfo() : null;
      const activeShield = skill.id === "shield"
        ? Math.max(0, Math.round(Number(state.player.skillShield) || 0))
        : 0;
      const tierClass = tier >= 3 ? "tier-legendary" : tier >= 2 ? "tier-epic" : tier >= 1 ? "tier-rare" : "tier-base";
      const dashArmed = inRun && skill.id === "dash" && state.dashAimActive;
      const ready = inRun && (
        skill.id === "shield" && shieldCharges?.enabled
          ? shieldCharges.charges > 0 && activeShield <= 0
          : skill.id === "shield"
            ? (cd <= 0 && activeShield <= 0)
            : cd <= 0
      );
      const stateClass = dashArmed
        ? "armed"
        : ready
          ? "ready"
          : (skill.id === "shield" && shieldCharges?.enabled && shieldCharges.charges <= 0) ||
            cd > 0 || (skill.id === "shield" && activeShield > 0)
            ? "cooling"
            : "idle";
      const cardClass = `skill-card ${stateClass} ${tierClass}`;
      const status = dashArmed
        ? "ARMED"
        : skill.id === "shield" && activeShield > 0
          ? "ACTIVE"
          : skill.id === "shield" && shieldCharges?.enabled
            ? shieldCharges.charges > 0
              ? `CH ${shieldCharges.charges}/${shieldCharges.max}`
              : `${shieldCharges.regenTurns}T`
          : cd > 0
            ? `${cd}T`
            : inRun
              ? "READY"
              : "IDLE";
      const detail =
        dashArmed
          ? "Choose direction (WASD/Arrows)"
          : skill.id === "shield" && activeShield > 0
            ? `Shield active (${activeShield})`
            : skill.id === "shield" && shieldCharges?.enabled
              ? `Charges ${shieldCharges.charges}/${shieldCharges.max}${shieldCharges.charges < shieldCharges.max ? ` (+1 in ${shieldCharges.regenTurns}T)` : ""}`
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
      if (state.menuOptionsOpen) {
        if (state.menuOptionsView === "enemy_speed") {
          actionsEl.textContent = "Enemy Speed: 1 Slow, 2 Standard, 3 Fast. Enter to apply. Esc - back.";
        } else if (state.menuOptionsView === "audio") {
          actionsEl.textContent = "Audio: 1 On, 2 Off. Enter to apply. Esc - back.";
        } else {
          actionsEl.textContent = "Options: choose a category. Enter to open. Esc to close.";
        }
      } else {
        actionsEl.textContent = "Navigate with W/S or Arrows. Enter to select.";
      }
      return;
    }
    if (state.phase === "camp") {
      if (state.extractRelicPrompt) {
        const selected = getExtractPromptSelectedSummary(state.extractRelicPrompt);
        actionsEl.textContent =
          `Relic exchange: 1-8 toggle, A all, C clear. Selected ${selected.count} for +${selected.total}. ` +
          "Y/Enter sell selected, N/Esc keep all.";
        return;
      }
      const summary = state.lastExtract
        ? `Last run: depth ${state.lastExtract.depth}, +${state.lastExtract.campGold} camp gold${state.lastExtract.relicReturned > 0
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
    if (state.phase === "won") {
      const finalDepth = Math.max(0, Number(state.finalVictoryPrompt?.depth) || MAX_DEPTH);
      const finalScore = Math.max(
        0,
        Number(state.finalVictoryPrompt?.score) || calculateScore(finalDepth, getRunGoldEarned())
      );
      actionsEl.textContent = `VICTORY! Depth ${finalDepth} cleared (${finalScore} pts). 1 = Main Menu, 2 = Leaderboard.`;
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
      actionsEl.textContent = `Lose ${emergencyLossPercent}% gold? Y/Enter - confirm, N/Esc - cancel.`;
      return;
    }
    if (state.phase === "playing" && state.merchantMenuOpen) {
      const relicSlot = state.merchantRelicSlot;
      const serviceSlot = state.merchantServiceSlot;
      const relicHint = relicSlot ? `5 relic (${relicSlot.price}g)` : "";
      const serviceHints = {
        fullheal: "6 Full Heal (150g)",
        combatboost: "6 Combat Boost (200g)",
        secondchance: "6 Second Chance (800g)",
        blackmarket: "6 Black Market (trade)",
      };
      const serviceHint = serviceSlot ? (serviceHints[serviceSlot] || "") : "";
      const extras = [relicHint, serviceHint].filter(Boolean).join(", ");
      actionsEl.textContent = `Merchant: 1 potion, 2/3/4 skill upgrades${extras ? ", " + extras : ""}. E/Esc close.`;
      return;
    }
    if (state.phase === "playing" && state.dashAimActive) {
      actionsEl.textContent = "Dash armed: choose direction (WASD/Arrows), Esc to cancel.";
      return;
    }
    if (state.phase === "playing" && isTurnInputLocked()) {
      const remaining = Math.max(0, (state.enemyTurnQueue || []).length);
      actionsEl.textContent = remaining > 0
        ? `Enemy turn... ${remaining} enemies acting.`
        : "Resolving turn...";
      return;
    }
    if (state.phase === "playing" && hoveredEnemy && state.enemies.includes(hoveredEnemy)) {
      const e = hoveredEnemy;
      let info = `${e.name} - HP: ${e.hp}/${e.maxHp}, ATK: ${getEnemyEffectiveAttack(e)}`;
      if (e.range) info += `, Range: ${e.range}`;
      if (e.aiming) {
        if (e.type === "acolyte") {
          info += `, Aiming ${getAcolyteCastTypeLabel(e.acolyteCastType)}!`;
        } else {
          info += ", Aiming!";
        }
      }
      if (e.slamAiming) info += ", Slam Ready!";
      if (e.volleyAiming) info += ", Volley Ready!";
      if (e.burstAiming) info += ", Burst Ready!";
      if (e.intent) info += `, Intent: ${String(e.intent).toUpperCase()}`;
      if ((e.volleyCooldown || 0) > 0) info += `, VolleyCD:${e.volleyCooldown}`;
      if ((e.burstCooldown || 0) > 0) info += `, BurstCD:${e.burstCooldown}`;
      if ((e.acolyteBuffTurns || 0) > 0) info += `, Buff(${e.acolyteBuffTurns})`;
      if ((e.disorientedTurns || 0) > 0) info += `, Disoriented(${e.disorientedTurns})`;
      if (e.frozenThisTurn || (e.frostFx || 0) > 0) info += ", Frozen";
      if ((e.burnTurns || 0) > 0) info += `, Burn(${e.burnTurns})`;
      if (e.elite) info += ` [${e.affix || "elite"}]`;
      actionsEl.textContent = info;
      return;
    }
    if (isOnMerchant()) {
      actionsEl.textContent = `Merchant: Press E to open shop. Press Q for emergency extract. Press F for potion.`;
      return;
    }
    if (isOnPortal()) {
      if (state.enemies.length > 0) {
        actionsEl.textContent = "Portal locked - clear the room first. Press Q for emergency extract. Press F for potion.";
      } else {
        actionsEl.textContent = "Press E to descend deeper. Press Q for full extract (keep all gold). Press F for potion.";
      }
      return;
    }
    if (state.roomCleared) {
      actionsEl.textContent = `Room cleared! Portal revealed. Head to the portal. Press Q for emergency extract (-${emergencyLossPercent}%). Press F for potion.`;
      return;
    }
    actionsEl.textContent = "Move into enemies to attack. Press Q for emergency extract. Press F for potion.";
  }

  function buildMutatorRows(canToggle) {
    return MUTATORS.map((mutator) => {
      const unlocked = state.unlockedMutators[mutator.id];
      const active = isMutatorActive(mutator.id);
      const rowClass = unlocked ? (active ? "mut-row mut-on" : "mut-row") : "mut-row mut-locked";
      const status = unlocked ? (active ? "ON" : "OFF") : "LOCKED";
      const goldSuffix = mutator.id !== "greed" ? ` | +20% gold` : "";
      const desc = unlocked
        ? `${mutator.bonus} | ${mutator.drawback}${goldSuffix}`
        : `Locked: ${mutator.unlockText}`;
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
    const active = MUTATORS.filter((m) => isMutatorActive(m.id));
    const unlockedNotActive = MUTATORS.filter((m) => state.unlockedMutators && state.unlockedMutators[m.id] && !isMutatorActive(m.id));
    if (active.length === 0 && unlockedNotActive.length === 0) {
      return `<h3>Mutators</h3><small>None unlocked yet</small>`;
    }
    const rows = active.map((m) => {
      return `<div class="mut-row mut-on"><span class="mut-key">${m.key}</span><div class="mut-body"><strong>${m.name}</strong><small>${m.bonus}</small></div></div>`;
    }).join("");
    const unlockedNotice = unlockedNotActive.length > 0
      ? `<small style="color:#ffd700">${unlockedNotActive.length} mutator(s) unlocked — activate at camp</small>`
      : "";
    return `<h3>Mutators (${active.length}/3)</h3>${rows}${unlockedNotice}`;
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
      const mutatorLabel = entry.mutatorCount > 0 ? `Mut ${entry.mutatorCount}` : "No Mut";
      const versionLabel = state.leaderboardScope === "legacy"
        ? `Ver ${entry.version || "unknown"}`
        : "";
      const rank = index + 1;
      const rankClass = rank <= 3 ? ` leaderboard-rank-${rank}` : "";
      const rankBadge = rank === 1 ? "I"
        : rank === 2 ? "II"
          : rank === 3 ? "III"
            : String(rank);
      return [
        `<div class="leaderboard-entry${rankClass}">`,
        `<div class="leaderboard-rank">#${rankBadge}</div>`,
        `<div class="leaderboard-main">`,
        `<strong class="leaderboard-name">${entry.playerName}</strong>`,
        `<div class="leaderboard-stats">`,
        `<span>${entry.score} pts</span>`,
        `<span>Depth ${entry.depth}</span>`,
        `<span>Gold ${entry.gold}</span>`,
        `<span>${outcomeLabel}</span>`,
        versionLabel ? `<span>${versionLabel}</span>` : "",
        `</div>`,
        `<small class="leaderboard-meta">${formatLeaderboardTimestamp(entry.ts)} | ${mutatorLabel}</small>`,
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

    if (state.phase === "won") {
      const finalDepth = Math.max(0, Number(state.finalVictoryPrompt?.depth) || MAX_DEPTH);
      mutatorsEl.innerHTML = `<h3>Victory</h3><small>Depth ${finalDepth} conquered. 1 menu | 2 leaderboard</small>`;
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
      if (state.debugCheatView === "relic_picker") {
        const picker = getDebugCheatRelicPickerPageInfo();
        const rows = picker.entries.map((relic, index) => {
          const hotkey = getDebugCheatRelicSlotHotkey(index);
          const rarityInfo = RARITY[relic.rarity] || RARITY.normal;
          const stackable = isRelicStackable(relic);
          const stackCount = getRelicStackCount(relic.id);
          const blockedReason = getDebugRelicUnavailableReason(relic);
          const classes = [
            "overlay-menu-row",
            blockedReason ? "disabled" : ""
          ].join(" ").trim();
          const suffix = stackable
            ? `x${stackCount}/${MAX_NORMAL_RELIC_STACK}`
            : (stackCount > 0 ? "Owned" : "Unique");
          return [
            `<div class="${classes}">`,
            `<div class="overlay-menu-key">${hotkey}</div>`,
            `<div><strong style="color:${rarityInfo.color}">${relic.name} <em>${rarityInfo.label}</em></strong><br /><span>${relic.desc} | ${suffix}${blockedReason ? ` | ${blockedReason}` : ""}</span></div>`,
            `</div>`
          ].join("");
        }).join("");
        const pageLabel = `${picker.page + 1}/${picker.totalPages}`;
        screenOverlayEl.className = "screen-overlay visible";
        screenOverlayEl.innerHTML = [
          `<div class="overlay-card overlay-card-wide">`,
          `<h2 class="overlay-title">Debug Relic Picker</h2>`,
          `<p class="overlay-sub">Relics ${state.relics.length}/${MAX_RELICS} | Page ${pageLabel}</p>`,
          `<div class="overlay-menu">${rows}</div>`,
          `<p class="overlay-hint">1-0 add relic | A/D or arrows page | R back | Esc close</p>`,
          `</div>`
        ].join("");
        return;
      }

      const sections = getDebugCheatSections();
      const currentSection = getCurrentDebugCheatSection();
      const visibleActions = getVisibleDebugCheatActions();
      const sectionRows = visibleActions
        .filter((action) => (action.section || "Misc") === currentSection)
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
      const sectionTabs = sections
        .map((section, index) => {
          const active = index === state.debugCheatSectionIndex;
          return active ? `[${section}]` : section;
        })
        .join("  ");
      const sectionLabel = `${state.debugCheatSectionIndex + 1}/${sections.length}`;
      const closeKey = state.debugCheatBotOnly ? DEBUG_BOT_MENU_TOGGLE_KEY : DEBUG_MENU_TOGGLE_KEY;
      const menuTitle = state.debugCheatBotOnly ? "Observer Bot Menu" : "Debug Cheats";
      const menuHint = state.debugCheatBotOnly
        ? `A/D or arrows switch section | listed letter key execute | ${closeKey.toUpperCase()} or Esc close`
        : `A/D or arrows switch section | 1-0 / listed letter key execute | ${closeKey.toUpperCase()} or Esc close`;

      screenOverlayEl.className = "screen-overlay visible";
      screenOverlayEl.innerHTML = [
        `<div class="overlay-card overlay-card-wide">`,
        `<h2 class="overlay-title">${menuTitle}</h2>`,
        `<p class="overlay-sub">God Mode: ${state.debugGodMode ? "ON" : "OFF"} | Observer Bot: ${isObserverBotActive() ? "ON" : "OFF"} | Test Mode: ${TEST_MODE_ENABLED ? "ON" : "OFF"} | Phase: ${state.phase}</p>`,
        `<p class="overlay-sub">Section ${sectionLabel}: ${sectionTabs}</p>`,
        `<p class="overlay-hint">${menuHint}</p>`,
        `<div class="overlay-menu">${sectionRows}</div>`,
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
        `<div class="overlay-card overlay-card-wide overlay-card-leaderboard">`,
        `<h2 class="overlay-title">Leaderboard</h2>`,
        `<p class="overlay-sub">Top ${Math.min(LEADERBOARD_MODAL_LIMIT, LEADERBOARD_LIMIT)} | Scope: ${scopeLabel} | Sort: ${modeLabel} | Source: ${sourceLabel}</p>`,
        statusNote ? `<p class="overlay-sub">${statusNote}</p>` : "",
        `<div class="overlay-menu leaderboard-modal-list">${rows}</div>`,
        `<p class="overlay-hint">T - switch Points/Depth | V - switch Current/Legacy | Esc/Enter - close</p>`,
        `</div>`
      ].join("");
      return;
    }

    if (state.phase === "menu" && state.menuOptionsOpen) {
      syncMenuOptionsIndex();
      const rootView = state.menuOptionsView === "root";
      const enemySpeedView = state.menuOptionsView === "enemy_speed";
      const rows = rootView
        ? getMenuOptionsRootItems().map((item, index) => {
          const classes = [
            "overlay-menu-row",
            state.menuOptionsIndex === index ? "selected" : ""
          ].join(" ").trim();
          return [
            `<div class="${classes}">`,
            `<div class="overlay-menu-key">${item.key}</div>`,
            `<div><strong>${item.title}</strong><br /><span>${item.desc}</span></div>`,
            `</div>`
          ].join("");
        }).join("")
        : enemySpeedView
          ? getEnemySpeedOptionsItems().map((option, index) => {
            const optionDelay = Math.max(
              20,
              Math.round(ENEMY_TURN_STEP_DELAY_BASE_MS * (Number(ENEMY_TURN_DELAY_MULTIPLIERS[option.id]) || 1))
            );
            const active = sanitizeEnemySpeedMode(state.enemySpeedMode) === option.id;
            const classes = [
              "overlay-menu-row",
              state.menuOptionsIndex === index ? "selected" : ""
            ].join(" ").trim();
            return [
              `<div class="${classes}">`,
              `<div class="overlay-menu-key">${option.key}</div>`,
              `<div><strong>${option.label}${active ? " (Active)" : ""}</strong><br /><span>${optionDelay} ms per enemy step</span></div>`,
              `</div>`
            ].join("");
          }).join("")
          : getAudioOptionsItems().map((option, index) => {
            const active = (option.id === "off" && state.audioMuted) || (option.id === "on" && !state.audioMuted);
            const classes = [
              "overlay-menu-row",
              state.menuOptionsIndex === index ? "selected" : ""
            ].join(" ").trim();
            return [
              `<div class="${classes}">`,
              `<div class="overlay-menu-key">${option.key}</div>`,
              `<div><strong>${option.label}${active ? " (Active)" : ""}</strong><br /><span>Game music and sound</span></div>`,
              `</div>`
            ].join("");
          }).join("");
      screenOverlayEl.className = "screen-overlay visible";
      screenOverlayEl.innerHTML = [
        `<div class="overlay-card">`,
        `<h2 class="overlay-title">Options</h2>`,
        `<p class="overlay-sub">${rootView ? "Choose a category" : enemySpeedView ? "Enemy Speed" : "Audio"
        }</p>`,
        `<div class="overlay-menu">${rows}</div>`,
        `<p class="overlay-hint">${rootView
          ? "W/S or Arrows - move | Enter - open | Esc - close"
          : enemySpeedView
            ? "W/S or Arrows - move | Enter - apply | 1-3 quick set | Esc - back"
            : "W/S or Arrows - move | Enter - apply | 1-2 quick set | Esc - back"
        }</p>`,
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

    if (state.phase === "won" && state.finalVictoryPrompt) {
      const finalDepth = Math.max(0, Number(state.finalVictoryPrompt.depth) || MAX_DEPTH);
      const finalGold = Math.max(0, Number(state.finalVictoryPrompt.gold) || 0);
      const finalScore = Math.max(
        0,
        Number(state.finalVictoryPrompt.score) || calculateScore(finalDepth, finalGold)
      );
      const rows = [
        `<div class="overlay-menu-row">`,
        `<div class="overlay-menu-key">1</div>`,
        `<div><strong>Main Menu</strong><br /><span>Return to menu after this victory.</span></div>`,
        `</div>`,
        `<div class="overlay-menu-row">`,
        `<div class="overlay-menu-key">2</div>`,
        `<div><strong>Leaderboard</strong><br /><span>Show ranking and your winning score.</span></div>`,
        `</div>`
      ].join("");
      screenOverlayEl.className = "screen-overlay visible";
      screenOverlayEl.innerHTML = [
        `<div class="overlay-card overlay-card-wide overlay-card-success">`,
        `<h2 class="overlay-title">VICTORY</h2>`,
        `<p class="overlay-sub">Depth ${MAX_DEPTH} completed. The dungeon has fallen.</p>`,
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
      const prompt = state.extractRelicPrompt;
      const relicReturn = prompt.relicReturn || { count: 0, total: 0, byRarity: {} };
      const carried = Math.max(0, Number(relicReturn.count) || 0);
      const gainIfAllSold = Math.max(0, Number(relicReturn.total) || 0);
      const baseGold = Math.max(0, Number(prompt.baseGold) || 0);
      const bonusGold = Math.max(0, Number(prompt.bonusGold) || 0);
      const extractedNow = baseGold + bonusGold;
      const carriedRelics = getExtractPromptCarriedRelics(prompt);
      const selectedIndices = getExtractPromptSelectedIndices(prompt);
      const selectedIndexSet = new Set(selectedIndices);
      const selectedSummary = getExtractPromptSelectedSummary(prompt);
      const relicRowsHtml = carriedRelics.length > 0
        ? carriedRelics.map((relicId, index) => {
          const relic = getRelicById(relicId);
          const rarity = RELIC_RETURN_VALUE[relic?.rarity] != null ? relic.rarity : "normal";
          const rarityInfo = RARITY[rarity] || RARITY.normal;
          const unitValue = RELIC_RETURN_VALUE[rarity];
          const selected = selectedIndexSet.has(index);
          const hotkeyLabel = index < 8 ? String(index + 1) : "-";
          return [
            `<div class="relic-exchange-row" style="border-color:${selected ? rarityInfo.color : rarityInfo.border};background:${rarityInfo.bg};opacity:${selected ? 1 : 0.78}">`,
            `<div class="relic-exchange-main">`,
            `<strong style="color:${rarityInfo.color}">[${hotkeyLabel}] ${relic?.name || relicId}</strong>`,
            `<span>${rarityInfo.label} | +${unitValue} camp gold${selected ? " | SELECTED" : ""}</span>`,
            `</div>`,
            `<div class="relic-exchange-gold">${selected ? "SELL" : "KEEP"}</div>`,
            `</div>`
          ].join("");
        }).join("")
        : `<div class="relic-exchange-empty">No relics to exchange.</div>`;
      screenOverlayEl.className = "screen-overlay visible";
      screenOverlayEl.innerHTML = [
        `<div class="overlay-card overlay-card-wide overlay-card-success">`,
        `<h2 class="overlay-title">Relic Exchange</h2>`,
        `<p class="overlay-sub">You extracted with ${carried} relics. Current extract already banked: +${extractedNow} camp gold.</p>`,
        `<p class="overlay-sub">Selected now: <strong>${selectedSummary.count}</strong> relics for <strong>+${selectedSummary.total}</strong> camp gold.</p>`,
        `<p class="overlay-sub">If all are sold: +${gainIfAllSold} camp gold.</p>`,
        `<p class="overlay-sub">N:${relicReturn.byRarity?.normal || 0} R:${relicReturn.byRarity?.rare || 0} E:${relicReturn.byRarity?.epic || 0} L:${relicReturn.byRarity?.legendary || 0}</p>`,
        `<div class="relic-exchange-list">${relicRowsHtml}</div>`,
        `<p class="overlay-hint">1-8 toggle | A all | C clear | Y/Enter sell selected | N/Esc keep all</p>`,
        `</div>`
      ].join("");
      return;
    }

    if (state.phase === "camp" && state.campStartDepthPromptOpen) {
      const options = getAvailableStartDepths();
      const safeIndex = clamp(
        Math.floor(Number(state.campStartDepthSelectionIndex) || 0),
        0,
        Math.max(0, options.length - 1)
      );
      state.campStartDepthSelectionIndex = safeIndex;
      const rows = options.map((depth, index) => {
        const selected = index === safeIndex;
        const rowClass = ["overlay-menu-row", selected ? "selected" : ""].join(" ").trim();
        return [
          `<div class="${rowClass}">`,
          `<div class="overlay-menu-key">${index + 1}</div>`,
          `<div><strong>Start Depth ${depth}</strong><br /><span>${depth === 0 ? "Full run (farm/economy)." : "Checkpoint start for push."}</span></div>`,
          `</div>`
        ].join("");
      }).join("");
      screenOverlayEl.className = "screen-overlay visible";
      screenOverlayEl.innerHTML = [
        `<div class="overlay-card overlay-card-wide">`,
        `<h2 class="overlay-title">Choose Start Depth</h2>`,
        `<p class="overlay-sub">Unlocked checkpoints this life: ${options.join(", ")}</p>`,
        `<div class="overlay-menu">${rows}</div>`,
        `<p class="overlay-hint">W/S or Arrows - move | 1-${options.length} quick select | Enter/Y confirm | Esc/N cancel</p>`,
        `</div>`
      ].join("");
      return;
    }

    let title = "Paused";
    let subtitle = "";
    let subtitleDetail = "";
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
      hint = "1 potion | 2 dash | 3 shockwave | 4 shield | 5 relic | 6 service | E/Esc close";
    } else if (state.phase === "boot") {
      // Boot handled by HTML overlay
      return;
    } else if (state.phase === "menu") {
      title = "Main Menu";
      subtitle = "W/S or Arrows + Enter";
    } else if (state.phase === "dead") {
      title = "Run Over";
      subtitle = `Depth ${state.depth} | Gold ${state.player.gold} | Lives ${state.lives}/${MAX_LIVES}`;
      subtitleDetail = state.lastDeathRelicLossText || "Death penalty: no relic lost.";
    } else if (state.phase === "camp") {
      title = "Camp Shop";
      subtitle = `Camp Gold <span style="color:#ffd700;font-weight:700">${state.campGold}</span> | Lives <span style="color:#ff4d7e;font-weight:700">${state.lives}/${MAX_LIVES}</span>`;
      subtitleDetail = `Unlocked start depths: ${getAvailableStartDepths().join(", ")}`;
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
    if (state.phase === "camp") {
      hint = state.campPanelView === "mutators"
        ? "1-0 toggle mutators | T shop | R choose start depth"
        : "1-0 buy upgrade | T mutators | R choose start depth";
    }
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
      const getMerchantTierClass = (tierLabel) => {
        const normalized = String(tierLabel || "").trim().toLowerCase();
        if (normalized === "rare") return "merchant-tier-rare";
        if (normalized === "epic") return "merchant-tier-epic";
        if (normalized === "legendary") return "merchant-tier-legendary";
        if (normalized === "life") return "merchant-tier-life";
        return "";
      };

      const buildMerchantRow = (key, titleText, body, options = {}) => {
        const disabled = Boolean(options && options.disabled);
        const tierLabel = options && typeof options.tierLabel === "string" ? options.tierLabel : "";
        const tierClass = options && typeof options.tierClass === "string" ? options.tierClass : "";
        const classes = [
          "overlay-menu-row",
          tierClass,
          disabled ? "disabled" : ""
        ].join(" ").trim();
        const badgeHtml = tierLabel
          ? ` <em class="merchant-tier-badge ${tierClass}">${tierLabel}</em>`
          : "";
        return [
          `<div class="${classes}">`,
          `<div class="overlay-menu-key">${key}</div>`,
          `<div><strong>${titleText}${badgeHtml}</strong><br /><span>${body}</span></div>`,
          `</div>`
        ].join("");
      };

      const potionCost = merchantPotionCost();
      const potionFull = state.player.potions >= state.player.maxPotions;
      const potionBody = potionFull
        ? `Potion bag full (${state.player.potions}/${state.player.maxPotions})`
        : `+1 potion for ${potionCost} gold (run + camp).`;
      const potionDisabled = potionFull || getMerchantUpgradeWalletTotal() < potionCost;

      const buildSkillRow = (key, skillId) => {
        const skill = SKILL_BY_ID[skillId];
        const currentTier = getSkillTier(skillId);
        const currentLabel = getSkillTierLabelByValue(currentTier);
        const offer = getNextSkillUpgradeOffer(skillId);
        if (!offer) {
          const maxTierClass = getMerchantTierClass(currentLabel);
          return buildMerchantRow(
            key,
            `${skill.name} [${currentLabel} MAX]`,
            `Already ${currentLabel} (max tier).`,
            {
              disabled: true,
              tierLabel: currentLabel,
              tierClass: maxTierClass
            }
          );
        }
        const nextLabel = getSkillTierLabelByValue(offer.tier);
        const tierClass = getMerchantTierClass(nextLabel);
        const cost = merchantSkillUpgradeCost(skillId);
        const wallet = getMerchantUpgradeWalletTotal();
        const legendaryLocked = !canBuyLegendarySkillUpgrade(skillId);
        const lockReason = legendaryLocked ? getLegendarySkillUpgradeBlockReason(skillId) : "";
        const cannotAfford = wallet < cost;
        const disabled = legendaryLocked || cannotAfford;
        const reason = legendaryLocked
          ? lockReason
          : cannotAfford
            ? `Need ${cost} gold (run + camp).`
            : `Upgrade to ${nextLabel}: ${offer.desc}. Cost ${cost} gold (run + camp).`;
        return buildMerchantRow(
          key,
          `${skill.name} [${currentLabel} -> ${nextLabel}]`,
          reason,
          {
            disabled,
            tierLabel: nextLabel,
            tierClass
          }
        );
      };

      // Slot 5 — Relic
      const relicSlot = state.merchantRelicSlot;
      let relicRow = "";
      if (relicSlot) {
        const slotRelic = getRelicById(relicSlot.relicId);
        const slotRelicName = slotRelic ? slotRelic.name : relicSlot.relicId;
        const slotRelicDesc = slotRelic ? slotRelic.desc : "";
        const relicRarityLabel = slotRelic ? (RARITY[slotRelic.rarity]?.label || slotRelic.rarity) : "";
        const relicTierClass = getMerchantTierClass(relicRarityLabel);
        const relicCanAfford = getMerchantUpgradeWalletTotal() >= relicSlot.price;
        relicRow = buildMerchantRow(
          "5",
          `${slotRelicName}`,
          `${slotRelicDesc ? slotRelicDesc + " " : ""}Cost ${relicSlot.price} gold.${!relicCanAfford ? ` Need ${relicSlot.price} gold.` : ""}`,
          { disabled: !relicCanAfford, tierLabel: relicRarityLabel, tierClass: relicTierClass }
        );
      } else {
        relicRow = buildMerchantRow("5", "Relic", "No relic available.", { disabled: true });
      }

      // Slot 6 — Service
      const serviceSlot = state.merchantServiceSlot;
      let serviceRow = "";
      if (serviceSlot === "fullheal") {
        const healCost = hasRelic("merchfavor") ? 75 : 150;
        const alreadyFull = state.player.hp >= state.player.maxHp;
        const canAffordHeal = getMerchantUpgradeWalletTotal() >= healCost;
        serviceRow = buildMerchantRow(
          "6", "Full Heal",
          alreadyFull ? "Already at full HP." : `Restore HP to max. Cost ${healCost} gold.`,
          { disabled: alreadyFull || !canAffordHeal }
        );
      } else if (serviceSlot === "combatboost") {
        const boostCost = hasRelic("merchfavor") ? 100 : 200;
        const alreadyActive = state.player.combatBoostTurns > 0;
        const canAffordBoost = getMerchantUpgradeWalletTotal() >= boostCost;
        serviceRow = buildMerchantRow(
          "6", "Combat Boost",
          alreadyActive ? "Already active." : `+20 ATK & ARM for 100 turns. Cost ${boostCost} gold.`,
          { disabled: alreadyActive || !canAffordBoost }
        );
      } else if (serviceSlot === "secondchance") {
        const scCost = hasRelic("merchfavor") ? 400 : 800;
        const alreadyHas = state.player.hasSecondChance;
        const canAffordSC = getMerchantUpgradeWalletTotal() >= scCost;
        serviceRow = buildMerchantRow(
          "6", "Second Chance",
          alreadyHas ? "Already active." : `Survive next fatal blow with 100 HP. Cost ${scCost} gold.`,
          { disabled: alreadyHas || !canAffordSC }
        );
      } else if (serviceSlot === "onelife") {
        const lifeCost = hasRelic("merchfavor") ? 1000 : 2000;
        const atMaxLives = state.lives >= MAX_LIVES;
        const canAffordLife = getMerchantUpgradeWalletTotal() >= lifeCost;
        serviceRow = buildMerchantRow(
          "6", "Extra Life",
          atMaxLives ? "Already at max lives." : `+1 life (${state.lives}/${MAX_LIVES}). Cost ${lifeCost} gold.`,
          { disabled: atMaxLives || !canAffordLife, tierLabel: "Life", tierClass: "merchant-tier-life" }
        );
      } else if (serviceSlot === "blackmarket") {
        const eligibleRelics = state.relics.filter(id => {
          const r = getRelicById(id);
          return r && (r.rarity === "normal" || r.rarity === "rare");
        });
        const hasEligible = eligibleRelics.length > 0;
        serviceRow = buildMerchantRow(
          "6", "Black Market",
          hasEligible
            ? `Trade a Normal/Rare relic for a higher tier. Press 6 to choose.`
            : `No eligible relics (need Normal or Rare).`,
          { disabled: !hasEligible }
        );
      } else {
        serviceRow = buildMerchantRow("6", "Service", "No service available today.", { disabled: true });
      }

      // Black Market mode: show eligible relics to trade up
      if (state.blackMarketPending) {
        const bmRelic = getRelicById(state.blackMarketPending[0]);
        const targetRarity = bmRelic?.rarity === "normal" ? "Rare" : "Epic";
        hint = `Choose a relic to trade for a ${targetRarity}. Press 6 or E/Esc to cancel.`;
        const bmRows = state.blackMarketPending.map((relicId, index) => {
          const r = getRelicById(relicId);
          const rarityLabel = r ? (RARITY[r.rarity]?.label || r.rarity) : "";
          const tierClass = getMerchantTierClass(rarityLabel);
          return buildMerchantRow(
            String(index + 1),
            r ? r.name : relicId,
            r ? r.desc : "",
            { tierLabel: rarityLabel, tierClass }
          );
        }).join("");
        menuBlock = `<div class="overlay-menu">${bmRows}</div>`;
        // Relic swap mode: show current relics to pick which to replace
      } else if (state.merchantRelicSwapPending) {
        const swapRelic = getRelicById(state.merchantRelicSwapPending.relicId);
        const swapRows = state.relics.map((relicId, index) => {
          const r = getRelicById(relicId);
          const rarityLabel = r ? (RARITY[r.rarity]?.label || r.rarity) : "";
          const tierClass = getMerchantTierClass(rarityLabel);
          return buildMerchantRow(
            String(index + 1),
            r ? r.name : relicId,
            r ? r.desc : "",
            { tierLabel: rarityLabel, tierClass }
          );
        }).join("");
        menuBlock = `<div class="overlay-menu">${swapRows}</div>`;
      } else {
        const rows = [
          buildMerchantRow("1", "Potion", potionBody, { disabled: potionDisabled }),
          buildSkillRow("2", "dash"),
          buildSkillRow("3", "aoe"),
          buildSkillRow("4", "shield"),
          relicRow,
          serviceRow
        ].join("");
        menuBlock = `<div class="overlay-menu">${rows}</div>`;
      }
    }

    screenOverlayEl.className = "screen-overlay visible";
    screenOverlayEl.innerHTML = [
      `<div class="overlay-card">`,
      `<h2 class="overlay-title">${title}</h2>`,
      subtitle ? `<p class="overlay-sub">${subtitle}</p>` : "",
      subtitleDetail ? `<p class="overlay-sub">${subtitleDetail}</p>` : "",
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
    syncMobileUiState({ forceBoard: isScreenOverlayVisible() });
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

  function spawnFloatingText(tileX, tileY, text, color = "#ffffff", options = {}) {
    if (isSimulationActive() && state.simulation.suppressVisuals) return;
    if (!text) return;
    const centerX = tileX * TILE + TILE / 2;
    const centerY = tileY * TILE + TILE / 2;
    const life = Math.max(220, Number(options.life) || 520);
    state.floatingTexts.push({
      x: centerX + (Number(options.offsetX) || 0),
      y: centerY - 2 + (Number(options.offsetY) || 0),
      vx: Number(options.vx) || (Math.random() - 0.5) * 0.05,
      vy: Number(options.vy) || -0.07,
      life,
      maxLife: life,
      text: String(text),
      color,
      size: Math.max(10, Math.min(14, Number(options.size) || 11))
    });
  }

  function getActiveTilesetSprite() {
    if (
      state.depth >= DEEP_THEME_START_DEPTH &&
      tilesetDeepSprite.ready &&
      tilesetDeepSprite.img
    ) {
      return tilesetDeepSprite;
    }
    if (tilesetSprite.ready && tilesetSprite.img) {
      return tilesetSprite;
    }
    return null;
  }

  function getActiveTorchSprite() {
    if (
      state.depth >= DEEP_THEME_START_DEPTH &&
      torchDeepSprite.ready &&
      torchDeepSprite.sheet
    ) {
      return torchDeepSprite;
    }
    if (torchSprite.ready && torchSprite.sheet) {
      return torchSprite;
    }
    return null;
  }

  function drawTilesetTile(tileId, px, py) {
    const activeTileset = getActiveTilesetSprite();
    if (!activeTileset || !activeTileset.img) return false;
    const tilesetImage = activeTileset.img;
    const activeTorch = getActiveTorchSprite();
    if (tileId === TILESET_IDS.floorBonfire && activeTorch && activeTorch.sheet) {
      // Keep a stable floor base under torch frames in case spritesheet has transparency.
      const baseTileId = TILESET_IDS.floorA;
      const baseSx = (baseTileId % TILESET_COLUMNS) * TILESET_TILE_SIZE;
      const baseSy = Math.floor(baseTileId / TILESET_COLUMNS) * TILESET_TILE_SIZE;
      ctx.drawImage(
        tilesetImage,
        baseSx, baseSy, TILESET_TILE_SIZE, TILESET_TILE_SIZE,
        px, py, TILE, TILE
      );

      const sheet = activeTorch.sheet;
      const frameW = Math.floor((sheet.naturalWidth || 0) / TORCH_SPRITESHEET_COLS);
      const frameH = Math.floor((sheet.naturalHeight || 0) / TORCH_SPRITESHEET_ROWS);
      if (frameW > 0 && frameH > 0) {
        const frameCount = TORCH_SPRITESHEET_COLS * TORCH_SPRITESHEET_ROWS;
        const frameIndex = Math.floor(state.playerAnimTimer / TORCH_FRAME_MS) % frameCount;
        const sxTorch = (frameIndex % TORCH_SPRITESHEET_COLS) * frameW;
        const syTorch = Math.floor(frameIndex / TORCH_SPRITESHEET_COLS) * frameH;
        ctx.drawImage(
          sheet,
          sxTorch, syTorch, frameW, frameH,
          px, py, TILE, TILE
        );
        return true;
      }
    }
    const sx = (tileId % TILESET_COLUMNS) * TILESET_TILE_SIZE;
    const sy = Math.floor(tileId / TILESET_COLUMNS) * TILESET_TILE_SIZE;
    ctx.drawImage(
      tilesetImage,
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
    if (!getActiveTilesetSprite()) return false;
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
    const pulse = (Math.sin((state.playerAnimTimer / PORTAL_RING_PULSE_MS) * Math.PI * 2) + 1) * 0.5;
    const ringAlpha = 0.2 + pulse * 0.35;
    ctx.save();
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = "#9deaff";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
    ctx.globalAlpha = 0.1 + pulse * 0.2;
    ctx.fillStyle = "#49c9f7";
    ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    ctx.restore();

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
    const idlePulse = (Math.sin(state.portalPulse) + 1) * 0.5;
    const lockedColor = state.enemies.length > 0 ? "#8b5d5d" : COLORS.portalGlow;
    ctx.fillStyle = lockedColor;
    ctx.fillRect(px + 3, py + 3, 10, 10);
    ctx.fillStyle = COLORS.portalCore;
    ctx.fillRect(px + 5, py + 5, 6, 6);
    const edge = idlePulse > 0.5 ? 2 : 1;
    ctx.fillStyle = "#b2f5ff";
    ctx.fillRect(px + edge, py + edge, TILE - edge * 2, 1);
    ctx.fillRect(px + edge, py + TILE - edge - 1, TILE - edge * 2, 1);
  }

  function drawChest(chest) {
    const px = chest.x * TILE;
    const py = chest.y * TILE;
    if (chest.opened) {
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
    const activeSpikeSprite = (
      state.depth >= DEEP_THEME_START_DEPTH &&
      spikeDeepSprite.ready &&
      spikeDeepSprite.img
    )
      ? spikeDeepSprite
      : (spikeSprite.ready && spikeSprite.img ? spikeSprite : null);
    if (activeSpikeSprite && activeSpikeSprite.img) {
      const sw = activeSpikeSprite.img.naturalWidth || TILE;
      const sh = activeSpikeSprite.img.naturalHeight || TILE;
      ctx.drawImage(activeSpikeSprite.img, 0, 0, sw, sh, drawX, drawY, drawSize, drawSize);
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
    if (!state.shrine || state.shrine.used) return;
    const px = state.shrine.x * TILE;
    const py = state.shrine.y * TILE;
    if (shrineSprite.ready && shrineSprite.sheet) {
      const img = shrineSprite.sheet;
      const totalFrames = SHRINE_SPRITESHEET_COLS * SHRINE_SPRITESHEET_ROWS;
      if (totalFrames > 0) {
        const frameIndex = Math.floor(state.playerAnimTimer / SHRINE_FRAME_MS) % totalFrames;
        const frameCol = frameIndex % SHRINE_SPRITESHEET_COLS;
        const frameRow = Math.floor(frameIndex / SHRINE_SPRITESHEET_COLS);
        const sw = Math.floor((img.naturalWidth || 0) / SHRINE_SPRITESHEET_COLS);
        const sh = Math.floor((img.naturalHeight || 0) / SHRINE_SPRITESHEET_ROWS);
        if (sw > 0 && sh > 0) {
          const drawSize = Math.round(TILE * SHRINE_DRAW_SCALE);
          const drawX = Math.round(px + (TILE - drawSize) / 2);
          const drawY = Math.round(py + (TILE - drawSize) / 2);
          ctx.drawImage(
            img,
            frameCol * sw,
            frameRow * sh,
            sw,
            sh,
            drawX,
            drawY,
            drawSize,
            drawSize
          );
          return;
        }
      }
    }
    ctx.fillStyle = "#7f68d8";
    ctx.fillRect(px + 4, py + 4, 8, 8);
    ctx.fillStyle = "#d5c4ff";
    ctx.fillRect(px + 7, py + 2, 2, 2);
    ctx.fillRect(px + 7, py + 12, 2, 2);
    ctx.fillRect(px + 2, py + 7, 2, 2);
    ctx.fillRect(px + 12, py + 7, 2, 2);
  }

  function drawMerchant() {
    if (!state.merchant) return;
    const px = state.merchant.x * TILE;
    const py = state.merchant.y * TILE;

    if (merchantSprite.readyCount > 0 && merchantSprite.frames.length > 0) {
      const frameCount = merchantSprite.frames.length;
      let frameIndex = Math.floor(state.playerAnimTimer / MERCHANT_FRAME_MS) % frameCount;
      if (
        merchantSprite.frameDurationTotalMs > 0 &&
        merchantSprite.frameDurationsMs.length >= frameCount
      ) {
        let elapsed = state.playerAnimTimer % merchantSprite.frameDurationTotalMs;
        for (let i = 0; i < frameCount; i += 1) {
          const duration = Math.max(1, Number(merchantSprite.frameDurationsMs[i]) || MERCHANT_FRAME_MS);
          if (elapsed < duration) {
            frameIndex = i;
            break;
          }
          elapsed -= duration;
        }
      }
      const frame =
        merchantSprite.frames[frameIndex] ||
        merchantSprite.frames.find((img) => Boolean(img));
      if (frame) {
        const drawSize = Math.round(TILE * MERCHANT_DRAW_SCALE);
        const drawX = Math.round(px + (TILE - drawSize) / 2);
        const drawY = Math.round(py + (TILE - drawSize) / 2);
        const sw = frame.naturalWidth || frame.videoWidth || frame.width || TILE;
        const sh = frame.naturalHeight || frame.videoHeight || frame.height || TILE;
        ctx.drawImage(frame, 0, 0, sw, sh, drawX, drawY, drawSize, drawSize);
        return;
      }
    }

    if (merchantSprite.gifReady && merchantSprite.gif) {
      const drawSize = Math.round(TILE * MERCHANT_DRAW_SCALE);
      const drawX = Math.round(px + (TILE - drawSize) / 2);
      const drawY = Math.round(py + (TILE - drawSize) / 2);
      const sw = merchantSprite.gif.naturalWidth || TILE;
      const sh = merchantSprite.gif.naturalHeight || TILE;
      ctx.drawImage(merchantSprite.gif, 0, 0, sw, sh, drawX, drawY, drawSize, drawSize);
      return;
    }

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

  function drawAcolyteSprite(enemy) {
    if (!acolyteSprite.ready || !acolyteSprite.sheet) return false;
    const img = acolyteSprite.sheet;
    const totalFrames = ACOLYTE_SPRITESHEET_COLS * ACOLYTE_SPRITESHEET_ROWS;
    if (totalFrames <= 0) return false;
    const frameIndex = Math.floor(state.playerAnimTimer / ACOLYTE_FRAME_MS) % totalFrames;
    const frameCol = frameIndex % ACOLYTE_SPRITESHEET_COLS;
    const frameRow = Math.floor(frameIndex / ACOLYTE_SPRITESHEET_COLS);
    const sw = Math.floor((img.naturalWidth || 0) / ACOLYTE_SPRITESHEET_COLS);
    const sh = Math.floor((img.naturalHeight || 0) / ACOLYTE_SPRITESHEET_ROWS);
    if (sw <= 0 || sh <= 0) return false;

    const px = visualX(enemy);
    const py = visualY(enemy);
    const bob = Math.sin(state.playerAnimTimer * 0.012 + enemy.x * 0.36 + enemy.y * 0.24) > 0.56 ? 1 : 0;
    const drawSize = Math.round(TILE * ACOLYTE_DRAW_SCALE);
    const drawX = Math.round(px + (TILE - drawSize) / 2);
    const drawY = Math.round(py + (TILE - drawSize) / 2 - bob);

    ctx.drawImage(
      img,
      frameCol * sw,
      frameRow * sh,
      sw,
      sh,
      drawX,
      drawY,
      drawSize,
      drawSize
    );
    return true;
  }

  function drawAcolyteFallback(enemy) {
    const px = visualX(enemy);
    const py = visualY(enemy);
    const pulse = (Math.sin(state.playerAnimTimer * 0.015 + enemy.x * 0.3 + enemy.y * 0.2) + 1) * 0.5;
    const bob = pulse > 0.55 ? 1 : 0;
    ctx.fillStyle = COLORS.acolyteTrim;
    ctx.fillRect(px + 4, py + 12 - bob, 8, 2);
    ctx.fillStyle = COLORS.acolyte;
    ctx.fillRect(px + 4, py + 5 - bob, 8, 7);
    ctx.fillRect(px + 6, py + 3 - bob, 4, 2);
    ctx.fillStyle = "#e7deff";
    ctx.fillRect(px + 6, py + 7 - bob, 1, 1);
    ctx.fillRect(px + 9, py + 7 - bob, 1, 1);
    ctx.fillStyle = "#c4b1ff";
    ctx.fillRect(px + 12, py + 5 - bob, 1, 6);
    if (pulse > 0.62) {
      ctx.fillStyle = "#f2e7ff";
      ctx.fillRect(px + 12, py + 4 - bob, 1, 1);
    }
  }

  function drawAcolyte(enemy) {
    if (!drawAcolyteSprite(enemy)) {
      drawAcolyteFallback(enemy);
    }
  }

  function drawSkitter(enemy) {
    if (drawSkitterSprite(enemy)) {
      return;
    }
    drawSkitterFallback(enemy);
  }

  function getSkitterSpriteLayout(img) {
    const w = img?.naturalWidth || 0;
    const h = img?.naturalHeight || 0;
    // Future-ready: if sheet looks like 3 horizontal square frames (e.g. 48x16), animate 3 frames.
    const looksLikeThreeFrameSheet =
      w >= 3 &&
      h > 0 &&
      w % SKITTER_SPRITESHEET_COLS === 0 &&
      Math.abs(Math.round(w / SKITTER_SPRITESHEET_COLS) - h) <= 1;
    if (looksLikeThreeFrameSheet) {
      return { cols: SKITTER_SPRITESHEET_COLS, rows: SKITTER_SPRITESHEET_ROWS };
    }
    return { cols: 1, rows: 1 };
  }

  function drawSkitterSprite(enemy) {
    if (!skitterSprite.ready || !skitterSprite.sheet) return false;
    const img = skitterSprite.sheet;
    const layout = getSkitterSpriteLayout(img);
    const cols = Math.max(1, layout.cols);
    const rows = Math.max(1, layout.rows);
    const totalFrames = cols * rows;
    if (totalFrames <= 0) return false;

    const frameIndex = Math.floor(state.playerAnimTimer / SKITTER_FRAME_MS) % totalFrames;
    const frameCol = frameIndex % cols;
    const frameRow = Math.floor(frameIndex / cols);
    const sw = Math.floor((img.naturalWidth || 0) / cols);
    const sh = Math.floor((img.naturalHeight || 0) / rows);
    if (sw <= 0 || sh <= 0) return false;

    const px = visualX(enemy);
    const py = visualY(enemy);
    const bob = Math.sin(state.playerAnimTimer * 0.02 + enemy.x * 0.65 + enemy.y * 0.33) > 0.52 ? 1 : 0;
    const drawSize = Math.round(TILE * SKITTER_DRAW_SCALE);
    const drawX = Math.round(px + (TILE - drawSize) / 2);
    const drawY = Math.round(py + (TILE - drawSize) / 2 - bob);

    ctx.drawImage(
      img,
      frameCol * sw,
      frameRow * sh,
      sw,
      sh,
      drawX,
      drawY,
      drawSize,
      drawSize
    );
    return true;
  }

  function drawSkitterFallback(enemy) {
    const px = visualX(enemy);
    const py = visualY(enemy);
    const twitch = Math.sin(state.playerAnimTimer * 0.04 + enemy.x * 0.7 + enemy.y * 0.4) > 0.35 ? 1 : 0;
    ctx.fillStyle = COLORS.skitterTrim;
    ctx.fillRect(px + 3, py + 11, 10, 2);
    ctx.fillStyle = COLORS.skitter;
    ctx.fillRect(px + 4, py + 6 - twitch, 8, 5);
    ctx.fillStyle = "#ffd6d6";
    ctx.fillRect(px + 6, py + 7 - twitch, 1, 1);
    ctx.fillRect(px + 9, py + 7 - twitch, 1, 1);
    ctx.fillStyle = COLORS.skitterTrim;
    ctx.fillRect(px + 2, py + 9 - twitch, 2, 1);
    ctx.fillRect(px + 12, py + 9 - twitch, 2, 1);
  }

  function drawGuardian(enemy) {
    if (!drawGuardianSprite(enemy)) {
      drawBruteFallback(enemy);
    }
  }

  function getGuardianSpriteLayout(img) {
    const w = img?.naturalWidth || 0;
    const h = img?.naturalHeight || 0;
    const looksLikeThreeFrameSheet =
      w >= 3 &&
      h > 0 &&
      w % GUARDIAN_SPRITESHEET_COLS === 0 &&
      Math.abs(Math.round(w / GUARDIAN_SPRITESHEET_COLS) - h) <= 1;
    if (looksLikeThreeFrameSheet) {
      return { cols: GUARDIAN_SPRITESHEET_COLS, rows: GUARDIAN_SPRITESHEET_ROWS };
    }
    return { cols: 1, rows: 1 };
  }

  function drawGuardianSprite(enemy) {
    if (!guardianSprite.ready || !guardianSprite.sheet) return false;
    const img = guardianSprite.sheet;
    const layout = getGuardianSpriteLayout(img);
    const cols = Math.max(1, layout.cols);
    const rows = Math.max(1, layout.rows);
    const totalFrames = cols * rows;
    if (totalFrames <= 0) return false;

    const frameIndex = Math.floor(state.playerAnimTimer / GUARDIAN_FRAME_MS) % totalFrames;
    const frameCol = frameIndex % cols;
    const frameRow = Math.floor(frameIndex / cols);
    const sw = Math.floor((img.naturalWidth || 0) / cols);
    const sh = Math.floor((img.naturalHeight || 0) / rows);
    if (sw <= 0 || sh <= 0) return false;

    const px = visualX(enemy);
    const py = visualY(enemy);
    const bob = Math.sin(state.playerAnimTimer * 0.02 + enemy.x * 0.55 + enemy.y * 0.35) > 0.45 ? 1 : 0;
    const drawSize = Math.round(TILE * GUARDIAN_DRAW_SCALE);
    const drawX = Math.round(px + (TILE - drawSize) / 2);
    const drawY = Math.round(py + (TILE - drawSize) / 2 - bob);

    ctx.drawImage(
      img,
      frameCol * sw,
      frameRow * sh,
      sw,
      sh,
      drawX,
      drawY,
      drawSize,
      drawSize
    );
    return true;
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

  function drawWardenSprite(enemy) {
    if (!wardenSprite.ready || !wardenSprite.sheet) return false;
    const img = wardenSprite.sheet;
    const totalFrames = WARDEN_SPRITESHEET_COLS * WARDEN_SPRITESHEET_ROWS;
    if (totalFrames <= 0) return false;
    const frameIndex = Math.floor(state.playerAnimTimer / WARDEN_FRAME_MS) % totalFrames;
    const frameCol = frameIndex % WARDEN_SPRITESHEET_COLS;
    const frameRow = Math.floor(frameIndex / WARDEN_SPRITESHEET_COLS);
    const sw = Math.floor((img.naturalWidth || 0) / WARDEN_SPRITESHEET_COLS);
    const sh = Math.floor((img.naturalHeight || 0) / WARDEN_SPRITESHEET_ROWS);
    if (sw <= 0 || sh <= 0) return false;

    const px = visualX(enemy);
    const py = visualY(enemy);
    const bob = Math.sin(state.playerAnimTimer * 0.01 + enemy.x * 0.4 + enemy.y * 0.22) > 0.52 ? 1 : 0;
    const drawSize = Math.round(TILE * WARDEN_DRAW_SCALE);
    const drawX = Math.round(px + (TILE - drawSize) / 2);
    const drawY = Math.round(py + (TILE - drawSize) / 2 - bob);

    ctx.drawImage(
      img,
      frameCol * sw,
      frameRow * sh,
      sw,
      sh,
      drawX,
      drawY,
      drawSize,
      drawSize
    );
    return true;
  }

  function drawWarden(enemy) {
    if (drawWardenSprite(enemy)) {
      return;
    }
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
      ctx.fillStyle =
        enemy.type === "warden"
          ? theme.wardenBolt
          : enemy.type === "acolyte"
            ? "#b89dff"
            : "#8bb4ff";
      ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      ctx.globalAlpha = 1;
    }

    if (enemy.type === "skeleton") {
      drawSkeleton(enemy);
    } else if (enemy.type === "acolyte") {
      drawAcolyte(enemy);
    } else if (enemy.type === "skitter") {
      drawSkitter(enemy);
    } else if (enemy.type === "guardian") {
      drawGuardian(enemy);
    } else if (enemy.type === "brute") {
      drawBrute(enemy);
    } else if (enemy.type === "warden") {
      drawWarden(enemy);
    } else {
      drawSlime(enemy);
    }

    if ((enemy.hitFlash || 0) > 0) {
      const px = visualX(enemy);
      const py = visualY(enemy);
      const alpha = clamp((enemy.hitFlash || 0) / ENTITY_HIT_FLASH_MS, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.18 + alpha * 0.62;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px - 1, py - 2, TILE + 2, TILE + 4);
      ctx.restore();
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
      const burnPulse = (Math.sin(state.portalPulse * 6 + enemy.x * 0.8 + enemy.y * 0.7) + 1) * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.18 + burnPulse * 0.28;
      ctx.fillStyle = "#ff6a35";
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.restore();
      ctx.fillStyle = burnPulse > 0.5 ? "#ffd17f" : "#ff6a35";
      ctx.fillRect(px + 1, py + 14, 1, 1);
      ctx.fillRect(px + 7, py + 13, 2, 1);
      ctx.fillRect(px + 14, py + 14, 1, 1);
    }

    if ((enemy.acolyteBuffTurns || 0) > 0) {
      const px = visualX(enemy);
      const py = visualY(enemy);
      ctx.fillStyle = "#d7c6ff";
      ctx.fillRect(px + 7, py + 2, 2, 1);
      ctx.fillRect(px + 6, py + 3, 4, 1);
    }

    if ((enemy.disorientedTurns || 0) > 0) {
      const px = visualX(enemy);
      const py = visualY(enemy);
      const pulse = (Math.sin(state.portalPulse * 4.2 + enemy.x * 0.7 + enemy.y * 0.6) + 1) * 0.5;
      ctx.globalAlpha = 0.2 + pulse * 0.3;
      ctx.fillStyle = "#c9a4ff";
      ctx.fillRect(px + 4, py + 1, 8, 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#efd8ff";
      ctx.fillRect(px + 6, py + 1, 1, 1);
      ctx.fillRect(px + 9, py + 2, 1, 1);
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
      const telegraphKind = enemyTactics && typeof enemyTactics.getTelegraphKind === "function"
        ? enemyTactics.getTelegraphKind(enemy)
        : (enemy.aiming ? "cast" : "");
      if (!telegraphKind) continue;
      const fromX = visualX(enemy) + TILE / 2;
      const fromY = visualY(enemy) + TILE / 2;
      const isAcolyteCast = enemy.type === "acolyte" && telegraphKind === "cast";
      const acolyteCastType = isAcolyteCast
        ? String(enemy.acolyteCastType || "buff").toLowerCase()
        : "";
      const acolyteTarget = isAcolyteCast
        ? getAcolyteTelegraphTarget(enemy, acolyteCastType)
        : null;
      const toX = acolyteTarget
        ? visualX(acolyteTarget) + TILE / 2
        : visualX(state.player) + TILE / 2;
      const toY = acolyteTarget
        ? visualY(acolyteTarget) + TILE / 2
        : visualY(state.player) + TILE / 2;
      const pulse = (Math.sin(state.portalPulse * 3.5) + 1) * 0.5;

      if (telegraphKind === "slam") {
        ctx.globalAlpha = 0.25 + pulse * 0.35;
        ctx.strokeStyle = "#ff9e84";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(fromX, fromY, TILE * 0.7 + pulse * 1.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }

      const style = isAcolyteCast
        ? acolyteCastType === "heal"
          ? { stroke: "#8ecfb4", target: "#d8f5e8", icon: "#b6ffe0", dash: [1, 1] }
          : acolyteCastType === "attack"
            ? { stroke: "#f39bc3", target: "#ffd8ea", icon: "#ffd4e9", dash: [2, 1] }
            : { stroke: "#be9aff", target: "#ead8ff", icon: "#ead8ff", dash: [1, 1] }
        : telegraphKind === "burst"
          ? { stroke: "#cda8ff", target: "#f0e2ff", icon: "#f0e2ff", dash: [3, 2] }
          : telegraphKind === "volley"
            ? { stroke: "#d4e8ff", target: "#eef7ff", icon: "#eef7ff", dash: [1, 2] }
            : { stroke: "#8bb4ff", target: "#d9e8ff", icon: "#d9e8ff", dash: [2, 2] };

      ctx.globalAlpha = 0.25 + pulse * 0.45;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = 1.5;
      if (!isAcolyteCast || acolyteTarget) {
        ctx.setLineDash(style.dash);
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = style.target;
      ctx.strokeRect(toX - 3, toY - 3, 6, 6);

      if (telegraphKind === "burst") {
        ctx.globalAlpha = 0.15 + pulse * 0.28;
        ctx.strokeStyle = "#cda8ff";
        ctx.beginPath();
        ctx.arc(fromX, fromY, TILE * 3.1, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (isAcolyteCast) {
        const iconX = fromX;
        const iconY = fromY - 9;
        ctx.globalAlpha = 0.26 + pulse * 0.38;
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(iconX, iconY, 4 + pulse * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.38 + pulse * 0.52;
        ctx.fillStyle = style.icon;
        if (acolyteCastType === "attack") {
          ctx.fillRect(iconX - 2, iconY - 2, 4, 1);
          ctx.fillRect(iconX - 1, iconY - 1, 2, 3);
          ctx.fillRect(iconX - 2, iconY + 2, 4, 1);
        } else {
          ctx.fillRect(iconX - 1, iconY - 3, 2, 6);
          ctx.fillRect(iconX - 3, iconY - 1, 6, 2);
        }

        if (acolyteTarget) {
          ctx.globalAlpha = 0.22 + pulse * 0.45;
          ctx.strokeStyle = style.stroke;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(toX, toY, 5 + pulse * 0.9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.4 + pulse * 0.45;
          ctx.fillStyle = style.icon;
          if (acolyteCastType === "attack") {
            ctx.fillRect(toX - 2, toY - 2, 4, 1);
            ctx.fillRect(toX - 1, toY - 1, 2, 3);
            ctx.fillRect(toX - 2, toY + 2, 4, 1);
          } else {
            ctx.fillRect(toX - 1, toY - 2, 2, 4);
            ctx.fillRect(toX - 2, toY - 1, 4, 2);
          }
        }
      }
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
    const hitAlpha = clamp((state.player.hitFlash || 0) / ENTITY_HIT_FLASH_MS, 0, 1);
    const color = hitAlpha > 0 ? COLORS.playerHit : COLORS.player;
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

    const hitAlpha = clamp((state.player.hitFlash || 0) / ENTITY_HIT_FLASH_MS, 0, 1);
    if (hitAlpha > 0) {
      ctx.globalAlpha = 0.2 + hitAlpha * 0.35;
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

    if (isShrineBlessed()) {
      const pulse = (Math.sin(state.playerAnimTimer * 0.015) + 1) * 0.5;
      const markerY = py - 4;
      const primaryColor = (state.player.furyBlessingTurns || 0) > 0 ? "#ffd66f" : "#b6ddff";
      const accentColor = (state.player.shrineArmorTurns || 0) > 0 ? "#b4f4ff" : "#efd6ff";
      ctx.save();
      ctx.globalAlpha = 0.55 + pulse * 0.35;
      ctx.fillStyle = primaryColor;
      ctx.fillRect(px + 6, markerY, 4, 1);
      ctx.fillRect(px + 7, markerY - 1, 2, 1);
      ctx.fillRect(px + 7, markerY + 1, 2, 1);
      if (pulse > 0.45) {
        ctx.fillStyle = accentColor;
        ctx.fillRect(px + 5, markerY, 1, 1);
        ctx.fillRect(px + 10, markerY, 1, 1);
      }
      ctx.restore();
    }
  }

  function drawShieldAura() {
    const totalShield = Math.max(0, Math.round(getTotalPlayerShield()));
    if (totalShield <= 0) return;
    const px = visualX(state.player);
    const py = visualY(state.player);
    if (shieldSprite.ready && shieldSprite.sheet) {
      const sheet = shieldSprite.sheet;
      const frameW = Math.floor((sheet.naturalWidth || 0) / SHIELD_SPRITESHEET_COLS);
      const frameH = Math.floor((sheet.naturalHeight || 0) / SHIELD_SPRITESHEET_ROWS);
      if (frameW > 0 && frameH > 0) {
        const frameCount = SHIELD_SPRITESHEET_COLS * SHIELD_SPRITESHEET_ROWS;
        const time = Math.max(0, state.playerAnimTimer);
        const frameIndex = Math.floor(time / SHIELD_FRAME_MS) % frameCount;
        const sx = (frameIndex % SHIELD_SPRITESHEET_COLS) * frameW;
        const sy = Math.floor(frameIndex / SHIELD_SPRITESHEET_COLS) * frameH;
        const drawSize = Math.round(TILE * SHIELD_DRAW_SCALE);
        const drawX = Math.round(px + (TILE - drawSize) / 2);
        const drawY = Math.round(py + (TILE - drawSize) / 2);
        ctx.save();
        ctx.globalAlpha = SHIELD_DRAW_OPACITY;
        ctx.drawImage(sheet, sx, sy, frameW, frameH, drawX, drawY, drawSize, drawSize);
        ctx.restore();
        return;
      }
    }

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

  function drawFloatingTexts() {
    if (!state.floatingTexts || state.floatingTexts.length <= 0) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const item of state.floatingTexts) {
      const alpha = clamp(item.life / item.maxLife, 0, 1);
      const visibleAlpha = Math.max(0.18, alpha);
      const size = Math.max(7, Number(item.size) || 8);
      const drawX = Math.round(item.x);
      const drawY = Math.round(item.y);
      ctx.font = `900 ${size}px monospace`;
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(2, Math.round(size * 0.22));
      ctx.globalAlpha = visibleAlpha;
      ctx.strokeStyle = "#000000";
      ctx.strokeText(item.text, drawX, drawY);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = item.color || "#ffffff";
      ctx.fillText(item.text, drawX, drawY);
    }
    ctx.restore();
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

  function drawDashAfterline() {
    const afterline = state.player?.dashAfterline;
    if (!afterline || !Array.isArray(afterline.tiles) || afterline.tiles.length <= 0) return;
    const turns = Math.max(0, Number(afterline.turns) || 0);
    const maxTurns = Math.max(turns, Number(afterline.maxTurns) || 0, 1);
    if (turns <= 0) return;
    const fade = clamp(turns / maxTurns, 0, 1);
    for (const tile of afterline.tiles) {
      if (!tile || !Number.isFinite(tile.x) || !Number.isFinite(tile.y)) continue;
      const px = tile.x * TILE;
      const py = tile.y * TILE;
      ctx.globalAlpha = 0.08 + fade * 0.2;
      ctx.fillStyle = "#8fd9ff";
      ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      ctx.globalAlpha = 0.2 + fade * 0.35;
      ctx.strokeStyle = "#d7efff";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
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

  function drawEnemyDebugOverlay() {
    if (!state.debugAiOverlay || state.phase !== "playing") return;
    if (!enemyDebugOverlay || typeof enemyDebugOverlay.draw !== "function") return;

    let board = state.enemyBlackboard;
    let plans = state.enemyDebugPlans;
    if (!board || !Array.isArray(plans) || plans.length <= 0) {
      const preview = buildEnemyDebugPreviewPlans();
      if (preview && typeof preview === "object") {
        board = preview.board || board;
        plans = preview.plans || plans;
      }
    }
    enemyDebugOverlay.draw(ctx, {
      enabled: true,
      gridSize: GRID_SIZE,
      tileSize: TILE,
      blackboard: board,
      threatMap: board?.threatMap || null,
      plans: Array.isArray(plans) ? plans : []
    });
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
    if ((state.player.hitFlash || 0) > 0) {
      state.player.hitFlash = Math.max(0, state.player.hitFlash - dt);
    }
    if (state.phase === "playing" && state.roomIntroTimer > 0) {
      state.roomIntroTimer = Math.max(0, state.roomIntroTimer - dt);
    }
    updateEnemyTurnSequence(dt);
    updateObserverBot(dt);

    if (state.particles.length > 0) {
      for (const particle of state.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 0.0008 * dt;
        particle.life -= dt;
      }
      state.particles = state.particles.filter((particle) => particle.life > 0);
    }

    if (state.floatingTexts.length > 0) {
      for (const item of state.floatingTexts) {
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        item.vy -= 0.00005 * dt;
        item.life -= dt;
      }
      state.floatingTexts = state.floatingTexts.filter((item) => item.life > 0);
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
      if ((enemy.hitFlash || 0) > 0) {
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
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
    drawEnemyDebugOverlay();

    for (const spike of state.spikes) {
      drawSpikes(spike);
    }
    drawDashAfterline();
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
    drawFloatingTexts();
    drawLowHpWarning();
    drawOverlay();
    ctx.restore();
  }

  const BOT_CARDINAL_DIRECTIONS = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
  ];

  function deepCloneValue(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function captureLocalStorageSnapshot() {
    const snapshot = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      snapshot[key] = localStorage.getItem(key);
    }
    return snapshot;
  }

  function restoreLocalStorageSnapshot(snapshot) {
    const nextSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
    const currentKeys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) currentKeys.push(key);
    }
    for (const key of currentKeys) {
      if (!Object.prototype.hasOwnProperty.call(nextSnapshot, key)) {
        localStorage.removeItem(key);
      }
    }
    for (const [key, value] of Object.entries(nextSnapshot)) {
      localStorage.setItem(key, value == null ? "" : String(value));
    }
  }

  function restoreStateFromSnapshot(snapshot) {
    const next = deepCloneValue(snapshot);
    for (const key of Object.keys(state)) {
      delete state[key];
    }
    Object.assign(state, next);
  }

  function hashSeedToUint32(seedValue) {
    const text = String(seedValue || "seed");
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
      hash >>>= 0;
    }
    return hash >>> 0;
  }

  function createSeededRandom(seedValue) {
    let seed = hashSeedToUint32(seedValue) || 0x9e3779b9;
    return () => {
      seed += 0x6d2b79f5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function withSeededRandom(seedValue, callback) {
    const previousRandom = Math.random;
    Math.random = createSeededRandom(seedValue);
    try {
      return callback();
    } finally {
      Math.random = previousRandom;
    }
  }

  function calculateMedian(values) {
    if (!Array.isArray(values) || values.length <= 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function calculateMean(values) {
    if (!Array.isArray(values) || values.length <= 0) return 0;
    const total = values.reduce((sum, value) => sum + value, 0);
    return total / values.length;
  }

  function calculatePercentile(values, percentile) {
    if (!Array.isArray(values) || values.length <= 0) return 0;
    const p = clamp(Number(percentile) || 0, 0, 1);
    if (values.length === 1) return Number(values[0]) || 0;
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * p;
    const lowerIndex = Math.floor(pos);
    const upperIndex = Math.min(sorted.length - 1, lowerIndex + 1);
    if (lowerIndex === upperIndex) return sorted[lowerIndex];
    const weight = pos - lowerIndex;
    return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
  }

  function classifyDeathCause(reason) {
    const text = String(reason || "").toLowerCase();
    if (!text) return "unknown";
    if (text.includes("spike")) return "spikes";
    if (text.includes("chest trap")) return "chest_trap";
    if (text.includes("shrine curse")) return "shrine_curse";
    if (text.includes("died on depth")) return "enemy_damage";
    if (text.includes("timeout")) return "timeout";
    return "other";
  }

  function summarizeCauseCounts(causeCounts) {
    return Object.fromEntries(
      Object.entries(causeCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    );
  }

  function getCauseRateFromCounts(causeCounts, cause, totalRuns) {
    const runs = Math.max(1, Math.floor(Number(totalRuns) || 0));
    return Math.max(0, Number(causeCounts?.[cause]) || 0) / runs;
  }

  function findBotStepToTarget(targetX, targetY, options = {}) {
    const allowTargetEnemy = Boolean(options.allowTargetEnemy);
    const avoidSpikes = options.avoidSpikes !== false;
    if (state.player.x === targetX && state.player.y === targetY) return null;

    const queue = [{ x: state.player.x, y: state.player.y, firstStep: null }];
    const visited = new Set([tileKey(state.player.x, state.player.y)]);
    let index = 0;

    while (index < queue.length) {
      const node = queue[index];
      index += 1;

      for (const dir of BOT_CARDINAL_DIRECTIONS) {
        const nx = node.x + dir.dx;
        const ny = node.y + dir.dy;
        if (!inBounds(nx, ny)) continue;
        const isTarget = nx === targetX && ny === targetY;
        const key = tileKey(nx, ny);
        if (visited.has(key)) continue;
        const enemy = getEnemyAt(nx, ny);
        if (enemy && !(isTarget && allowTargetEnemy)) continue;
        if (avoidSpikes && isSpikeAt(nx, ny) && !isTarget) continue;

        const firstStep = node.firstStep || dir;
        if (isTarget) return firstStep;
        visited.add(key);
        queue.push({ x: nx, y: ny, firstStep });
      }
    }

    return null;
  }

  function getSortedEnemiesForBot() {
    if (!Array.isArray(state.enemies) || state.enemies.length <= 0) return [];
    return [...state.enemies].sort((a, b) => {
      const distA = manhattan(state.player.x, state.player.y, a.x, a.y);
      const distB = manhattan(state.player.x, state.player.y, b.x, b.y);
      if (distA !== distB) return distA - distB;
      const hpA = Math.max(0, Number(a.hp) || 0);
      const hpB = Math.max(0, Number(b.hp) || 0);
      if (hpA !== hpB) return hpA - hpB;
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
  }

  function getNearestEnemyForBot() {
    const sorted = getSortedEnemiesForBot();
    return sorted.length > 0 ? sorted[0] : null;
  }

  function getBotEnemyHpTotal() {
    if (!Array.isArray(state.enemies) || state.enemies.length <= 0) return 0;
    let total = 0;
    for (const enemy of state.enemies) {
      total += Math.max(0, Number(enemy.hp) || 0);
    }
    return total;
  }

  function getNearestChestForBot() {
    const unopened = (state.chests || []).filter((chest) => !chest.opened);
    if (unopened.length <= 0) return null;
    let best = null;
    let bestDist = Infinity;
    for (const chest of unopened) {
      const dist = manhattan(state.player.x, state.player.y, chest.x, chest.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = chest;
      }
    }
    return best;
  }

  function getNearestShrineForBot() {
    if (!state.shrine || state.shrine.used) return null;
    return { x: state.shrine.x, y: state.shrine.y };
  }

  function getBestEnemyChaseStepForBot(options = {}) {
    const forceSpikeRisk = Boolean(options.forceSpikeRisk);
    const candidates = getSortedEnemiesForBot();
    if (candidates.length <= 0) return null;

    for (const enemy of candidates) {
      const safeStep = findBotStepToTarget(enemy.x, enemy.y, {
        allowTargetEnemy: true,
        avoidSpikes: true
      });
      if (safeStep) {
        return { enemy, step: safeStep, risky: false };
      }
    }

    if (!forceSpikeRisk && !shouldBotRiskSpikeStep("combat")) {
      return null;
    }

    for (const enemy of candidates) {
      const riskyStep = findBotStepToTarget(enemy.x, enemy.y, {
        allowTargetEnemy: true,
        avoidSpikes: false
      });
      if (riskyStep) {
        return { enemy, step: riskyStep, risky: true };
      }
    }

    return null;
  }

  function resetObserverBotStallTracker() {
    if (!state.observerBot) return;
    state.observerBot.stallTicks = 0;
    state.observerBot.lastPosX = Math.max(0, Number(state.player?.x) || 0);
    state.observerBot.lastPosY = Math.max(0, Number(state.player?.y) || 0);
    state.observerBot.lastEnemyCount = Array.isArray(state.enemies) ? state.enemies.length : 0;
    state.observerBot.lastEnemyHpTotal = getBotEnemyHpTotal();
    state.observerBot.loopRecentPositions = [];
    state.observerBot.loopPingPongTicks = 0;
    state.observerBot.loopPingPongActive = false;
    state.observerBot.loopAcolytePingPongTicks = 0;
  }

  function shouldObserverBotForceAggro() {
    if (!state.observerBot || state.phase !== "playing") return false;

    const enemyCount = Array.isArray(state.enemies) ? state.enemies.length : 0;
    const enemyHpTotal = getBotEnemyHpTotal();
    if (state.roomCleared || enemyCount <= 0) {
      resetObserverBotStallTracker();
      return false;
    }

    const bot = state.observerBot;
    const prevX = Math.max(0, Number(bot.lastPosX) || 0);
    const prevY = Math.max(0, Number(bot.lastPosY) || 0);
    const prevEnemyCount = Math.max(0, Number(bot.lastEnemyCount) || 0);
    const prevEnemyHpTotal = Math.max(0, Number(bot.lastEnemyHpTotal) || 0);
    const moved = prevX !== state.player.x || prevY !== state.player.y;
    const madeProgress = moved || enemyCount < prevEnemyCount || enemyHpTotal < prevEnemyHpTotal;

    if (madeProgress) {
      bot.stallTicks = 0;
    } else {
      bot.stallTicks = Math.min(999, Math.max(0, Number(bot.stallTicks) || 0) + 1);
    }

    bot.lastPosX = state.player.x;
    bot.lastPosY = state.player.y;
    bot.lastEnemyCount = enemyCount;
    bot.lastEnemyHpTotal = enemyHpTotal;
    return bot.stallTicks >= 5;
  }

  function shouldBotRiskSpikeStep(context = "combat") {
    if (hasRelic("ironboots")) return true;
    const hpRatio = getBotHpRatio();
    const potions = Math.max(0, Number(state.player.potions) || 0);
    if (context === "extract") {
      return hpRatio >= 0.52 || potions >= 1;
    }
    if (context === "utility") {
      return hpRatio >= 0.72 && (potions >= 1 || state.player.hp >= scaledCombat(6));
    }
    if (context === "combat") {
      return hpRatio >= 0.62 || potions >= 2;
    }
    return hpRatio >= 0.68 || potions >= 1;
  }

  function findBotStepWithSpikePolicy(targetX, targetY, options = {}) {
    const allowTargetEnemy = Boolean(options.allowTargetEnemy);
    const context = typeof options.context === "string" ? options.context : "combat";
    const safeStep = findBotStepToTarget(targetX, targetY, {
      allowTargetEnemy,
      avoidSpikes: true
    });
    if (safeStep) return safeStep;
    if (!shouldBotRiskSpikeStep(context)) return null;
    return findBotStepToTarget(targetX, targetY, {
      allowTargetEnemy,
      avoidSpikes: false
    });
  }

  function getAdjacentEnemyStepForBot() {
    let best = null;
    let bestHp = Infinity;
    for (const dir of BOT_CARDINAL_DIRECTIONS) {
      const nx = state.player.x + dir.dx;
      const ny = state.player.y + dir.dy;
      const enemy = getEnemyAt(nx, ny);
      if (!enemy) continue;
      const hp = Math.max(0, Number(enemy.hp) || 0);
      if (hp < bestHp) {
        bestHp = hp;
        best = dir;
      }
    }
    return best;
  }

  function getFallbackStepForBot() {
    const candidates = [];
    for (const dir of BOT_CARDINAL_DIRECTIONS) {
      const nx = state.player.x + dir.dx;
      const ny = state.player.y + dir.dy;
      if (!inBounds(nx, ny)) continue;
      if (getEnemyAt(nx, ny)) continue;
      candidates.push({ dir, spike: isSpikeAt(nx, ny) });
    }
    if (candidates.length <= 0) return null;
    const safe = candidates.filter((candidate) => !candidate.spike);
    if (safe.length <= 0 && !shouldBotRiskSpikeStep("fallback")) {
      return null;
    }
    const pool = safe.length > 0 ? safe : candidates;
    const pick = pool[randInt(0, pool.length - 1)];
    return pick.dir;
  }

  function shouldBotDrinkPotion() {
    if (hasRelic("risk")) return false;
    if (state.player.potions <= 0) return false;
    if (state.player.hp >= state.player.maxHp) return false;
    const hpRatio = state.player.hp / Math.max(1, state.player.maxHp);
    return hpRatio <= 0.35;
  }

  function hasLineOfSightBetweenTilesForBot(fromX, fromY, toX, toY, chestsOverride = null) {
    const unopenedChests = Array.isArray(chestsOverride)
      ? chestsOverride
      : (state.chests || []).filter((chest) => !chest.opened);
    if (fromX === toX) {
      const minY = Math.min(fromY, toY);
      const maxY = Math.max(fromY, toY);
      for (let y = minY + 1; y < maxY; y += 1) {
        if (unopenedChests.some((chest) => chest.x === fromX && chest.y === y)) return false;
      }
      return true;
    }
    if (fromY === toY) {
      const minX = Math.min(fromX, toX);
      const maxX = Math.max(fromX, toX);
      for (let x = minX + 1; x < maxX; x += 1) {
        if (unopenedChests.some((chest) => chest.x === x && chest.y === fromY)) return false;
      }
      return true;
    }
    return false;
  }

  function getEnemyRangedRangeForBot(enemy) {
    if (!enemy) return 0;
    if (enemy.type === "skeleton") return Math.max(2, Number(enemy.range) || 3);
    // Acolyte has support cast (ally buff), not a direct ranged damage attack.
    // Treating it as ranged threat makes bot over-defensive and causes stalls.
    if (enemy.type === "acolyte") return 0;
    if (enemy.type === "warden") return Math.max(2, Number(enemy.range) || 4);
    return 0;
  }

  function isAcolyteOnlyRoomForBot() {
    if (!Array.isArray(state.enemies) || state.enemies.length <= 0) return false;
    return state.enemies.every((enemy) => enemy && enemy.type === "acolyte");
  }

  function buildObserverBotThreatMap(options = {}) {
    const depth = Math.max(0, Number(options.depth ?? state.depth) || 0);
    const playerArmor = Math.max(0, Number(options.playerArmor ?? state.player.armor) || 0);
    const enemies = Array.isArray(options.enemies) ? options.enemies : state.enemies;
    const spikes = Array.isArray(options.spikes) ? options.spikes : state.spikes;
    const chests = Array.isArray(options.chests)
      ? options.chests
      : (state.chests || []).filter((chest) => !chest.opened);
    const spikeSet = new Set(spikes.map((spike) => tileKey(spike.x, spike.y)));
    const chestSet = new Set(chests.map((chest) => tileKey(chest.x, chest.y)));
    const riskMap = {};
    const damageMap = {};
    const spikeDamage = getSpikeDamageByDepth(depth);

    for (let y = 1; y <= GRID_SIZE - 2; y += 1) {
      for (let x = 1; x <= GRID_SIZE - 2; x += 1) {
        const key = tileKey(x, y);
        let risk = 0;
        let expectedDamage = 0;

        if (spikeSet.has(key)) {
          risk += 24;
          expectedDamage += Math.max(MIN_EFFECTIVE_DAMAGE, spikeDamage - Math.round(playerArmor * 0.25));
        }
        if (chestSet.has(key)) {
          risk += 8;
        }

        for (const enemy of enemies) {
          if (!enemy) continue;
          const dist = manhattan(x, y, enemy.x, enemy.y);
          const baseAttack = Math.max(MIN_EFFECTIVE_DAMAGE, Number(enemy.attack) || 0);
          const telegraphing = Boolean(enemy.aiming || enemy.volleyAiming || enemy.burstAiming || enemy.slamAiming);

          if (dist === 1) {
            const meleeDamage = Math.max(
              MIN_EFFECTIVE_DAMAGE,
              Math.round(baseAttack * 0.9) - Math.round(playerArmor * 0.35)
            );
            expectedDamage += meleeDamage;
            risk += 22;
            if (enemy.slamAiming) {
              expectedDamage += Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(baseAttack * 0.65));
              risk += 18;
            }
          } else if (dist === 2) {
            risk += 10;
          }

          const rangedRange = getEnemyRangedRangeForBot(enemy);
          if (
            rangedRange > 0 &&
            dist >= 2 &&
            dist <= rangedRange &&
            hasLineOfSightBetweenTilesForBot(enemy.x, enemy.y, x, y, chests)
          ) {
            const rangedDamage = Math.max(
              MIN_EFFECTIVE_DAMAGE,
              Math.round(baseAttack * (telegraphing ? 0.9 : 0.35)) - Math.round(playerArmor * 0.2)
            );
            expectedDamage += rangedDamage;
            risk += telegraphing ? 24 : 10;
          }

          if (enemy.burstAiming && dist <= 3 && hasLineOfSightBetweenTilesForBot(enemy.x, enemy.y, x, y, chests)) {
            expectedDamage += Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(baseAttack * 0.7));
            risk += 14;
          }
        }

        riskMap[key] = clamp(Math.round(risk), 0, 300);
        damageMap[key] = Math.max(0, Math.round(expectedDamage));
      }
    }

    return {
      riskAt(x, y) {
        return Number(riskMap[tileKey(x, y)]) || 0;
      },
      damageAt(x, y) {
        return Number(damageMap[tileKey(x, y)]) || 0;
      }
    };
  }

  function getObserverBotPolicyProfile(options = {}) {
    const hpRatio = Number(options.hpRatio ?? getBotHpRatio()) || 0;
    const roomType = String((options.roomType ?? state.roomType) || "combat");
    const bossRoom = Boolean(options.bossRoom ?? state.bossRoom);
    const depth = Math.max(0, Number(options.depth ?? state.depth) || 0);
    const mutators = getObserverBotMutatorContext();
    let mode = "default";
    let aggression = 1;
    let survival = 1;
    let utility = 1;
    let economy = 1;
    let lookaheadTurns = 2;

    if (bossRoom) {
      mode = "boss";
      aggression = 0.92;
      survival = 1.45;
      utility = 1.1;
      economy = 1.2;
      lookaheadTurns = 3;
    } else if (roomType === "cursed") {
      mode = "cursed";
      aggression = 0.96;
      survival = 1.3;
      utility = 1;
      economy = 1.05;
      lookaheadTurns = 3;
    } else if (roomType === "treasure") {
      mode = "treasure";
      aggression = 1.12;
      survival = 0.95;
      utility = 0.92;
      economy = 1.15;
    } else if (roomType === "shrine") {
      mode = "shrine";
      aggression = 1.02;
      survival = 1.08;
      utility = 1.18;
      economy = 1.08;
    } else if (roomType === "merchant") {
      mode = "merchant";
      aggression = 1.05;
      survival = 1.02;
      utility = 1;
      economy = 1.25;
    } else if (roomType === "vault") {
      mode = "vault";
      aggression = 1.08;
      survival = 1.18;
      utility = 0.9;
      economy = 1.2;
      lookaheadTurns = 3;
    }

    if (hpRatio < 0.45) {
      survival += 0.28;
      aggression -= 0.14;
      economy += 0.12;
    }
    if (hpRatio < 0.3) {
      survival += 0.2;
      aggression -= 0.12;
    }

    // Depth pacing: early game can push tempo, late game should value safer lines.
    if (depth <= 20) {
      aggression += 0.12;
      survival -= 0.05;
      economy += 0.04;
    } else {
      aggression -= 0.1;
      survival += 0.18;
      utility += 0.06;
      lookaheadTurns = 3;
      if (depth >= 35) {
        aggression -= 0.05;
        survival += 0.08;
      }
    }

    if (mutators.berserker) {
      aggression += 0.14;
      survival += hpRatio < 0.45 ? 0.22 : 0.08;
    }
    if (mutators.bulwark) {
      aggression += 0.05;
      survival += 0.12;
    }
    if (mutators.resilience) {
      survival += 0.16;
      utility += 0.06;
    }
    if (mutators.hunter) {
      survival += 0.12;
      aggression -= 0.02;
    }
    if (mutators.greed) {
      economy += 0.2;
      survival += 0.08;
      aggression -= 0.04;
    }
    if (mutators.famine) {
      survival += 0.22;
      economy += 0.18;
      aggression -= 0.08;
      lookaheadTurns = 3;
    }
    if (mutators.alchemist) {
      survival += 0.1;
      economy += 0.05;
    }
    if (mutators.haste) {
      survival += 0.14;
      lookaheadTurns = 3;
    }
    if (mutators.ascension) {
      const ascLevels = Math.max(0, Math.floor(Math.max(depth, Number(state.runMaxDepth) || 0) / 3));
      survival += Math.min(0.28, ascLevels * 0.015);
    }
    if (mutators.momentum) {
      aggression += 0.08;
    }
    if (mutators.elitist) {
      survival += 0.08;
      economy += 0.06;
    }

    return {
      mode,
      aggression: clamp(aggression, 0.4, 1.8),
      survival: clamp(survival, 0.5, 2.2),
      utility: clamp(utility, 0.5, 2),
      economy: clamp(economy, 0.5, 2),
      lookaheadTurns: clamp(lookaheadTurns, 2, 3)
    };
  }

  function getObserverBotMutatorContext() {
    return {
      berserker: isMutatorActive("berserker"),
      bulwark: isMutatorActive("bulwark"),
      alchemist: isMutatorActive("alchemist"),
      greed: isMutatorActive("greed"),
      hunter: isMutatorActive("hunter"),
      haste: isMutatorActive("haste"),
      famine: isMutatorActive("famine"),
      elitist: isMutatorActive("elitist"),
      ascension: isMutatorActive("ascension"),
      resilience: isMutatorActive("resilience"),
      momentum: isMutatorActive("momentum")
    };
  }

  function buildObserverBotEconomyPlan(options = {}) {
    const depth = Math.max(0, Number(options.depth ?? state.depth) || 0);
    const hpRatio = Number(options.hpRatio ?? getBotHpRatio()) || 0;
    const nextDepths = [];
    for (let i = 1; i <= 3; i += 1) {
      const d = depth + i;
      if (d <= MAX_DEPTH) nextDepths.push(d);
    }
    const upcomingBossDepth = nextDepths.find((d) => d % 5 === 0) || 0;
    const guardLevel = getCampUpgradeLevel("guard");
    const vitalityLevel = getCampUpgradeLevel("vitality");
    const bladeLevel = getCampUpgradeLevel("blade");
    const bossTier = upcomingBossDepth > 0 ? Math.max(1, Math.floor((upcomingBossDepth - 1) / 5) + 1) : 0;
    const guardTarget = clamp(
      guardLevel + (upcomingBossDepth > 0 ? Math.max(1, bossTier - Math.floor(guardLevel / 2)) : 0),
      guardLevel,
      getCampUpgradeMaxForBot("guard")
    );
    const vitalityTarget = clamp(
      vitalityLevel + (upcomingBossDepth > 0 ? Math.max(1, Math.ceil(bossTier * 0.8)) : 0),
      vitalityLevel,
      getCampUpgradeMaxForBot("vitality")
    );
    const bladeTarget = clamp(
      bladeLevel + (depth >= 12 ? 1 : 0),
      bladeLevel,
      getCampUpgradeMaxForBot("blade")
    );
    const shopMult = Math.max(0.1, Number(state.runMods?.shopCostMult) || Number(state.campVisitShopCostMult) || 1);
    const guardNeed = estimateCampUpgradeCostToTargetForBot("guard", guardTarget, { visitMult: shopMult });
    const vitalityNeed = estimateCampUpgradeCostToTargetForBot("vitality", vitalityTarget, { visitMult: shopMult });
    const bladeNeed = estimateCampUpgradeCostToTargetForBot("blade", bladeTarget, { visitMult: shopMult });
    const campGoldReserve = Math.round(guardNeed + vitalityNeed * 0.85 + bladeNeed * 0.55 + 70 + bossTier * 25);
    const runGoldReserve = Math.round(20 + (upcomingBossDepth > 0 ? 40 : 20));
    const potionTarget = upcomingBossDepth > 0 ? 2 : 1;
    const shouldBankSoon = depth >= 10 && (
      upcomingBossDepth > 0 ||
      hpRatio < 0.58 ||
      state.player.potions < potionTarget
    );
    return {
      depth,
      nextDepths,
      upcomingBossDepth,
      guardTarget,
      vitalityTarget,
      bladeTarget,
      campGoldReserve: Math.max(0, campGoldReserve),
      runGoldReserve: Math.max(0, runGoldReserve),
      potionTarget,
      shouldBankSoon,
      runGoldBankThreshold: upcomingBossDepth > 0 ? 95 : 130
    };
  }

  function refreshObserverBotEconomyPlan() {
    if (!state.observerBot) return buildObserverBotEconomyPlan();
    const plan = buildObserverBotEconomyPlan();
    state.observerBot.economyPlan = plan;
    return plan;
  }

  function getObserverBotEconomyPlan(options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);
    if (!state.observerBot) return buildObserverBotEconomyPlan();
    const cached = state.observerBot.economyPlan;
    const currentDepth = Math.max(0, Number(state.depth) || 0);
    const cachedDepth = Math.max(0, Number(cached?.depth) || 0);
    if (forceRefresh || !cached || cachedDepth !== currentDepth) {
      return refreshObserverBotEconomyPlan();
    }
    return cached;
  }

  function getObserverBotExpectedMeleeDamage() {
    const furyMult = getFuryAttackPowerMultiplier();
    const base = Math.max(
      MIN_EFFECTIVE_DAMAGE,
      Math.round(getPlayerAttackForDamage({ includeChaos: true }) * furyMult)
    );
    let relicMult = 1;
    if (hasRelic("risk")) relicMult *= 1.4;
    if (hasRelic("mirrorcarapace")) relicMult *= 0.9;
    const critExpectedMult = 1 + Math.max(0, Number(state.player.crit) || 0) * 0.35;
    return Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(base * critExpectedMult * relicMult));
  }

  function estimateObserverBotDashLandingPosition(dx, dy) {
    const dashTier = getSkillTier("dash");
    const maxDashTiles = dashTier >= 2 ? 4 : 3;
    let cx = state.player.x;
    let cy = state.player.y;
    let moved = 0;
    for (let i = 0; i < maxDashTiles; i += 1) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) break;
      if (getChestAt(nx, ny)) break;
      cx = nx;
      cy = ny;
      moved += 1;
    }
    return { x: cx, y: cy, moved };
  }

  function buildObserverBotCombatActionCandidates(options = {}) {
    const forceAggro = Boolean(options.forceAggro);
    const out = [];
    const seen = new Set();
    const addCandidate = (candidate) => {
      if (!candidate || typeof candidate !== "object") return;
      const key = `${candidate.kind}:${candidate.dx || 0}:${candidate.dy || 0}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(candidate);
    };

    if (!hasRelic("risk") && state.player.potions > 0 && state.player.hp < state.player.maxHp) {
      addCandidate({ kind: "potion" });
    }

    if (typeof canObserverBotUseShieldNow === "function" && canObserverBotUseShieldNow()) {
      addCandidate({ kind: "shield" });
    }
    if (getSkillCooldownRemaining("aoe") <= 0) {
      addCandidate({ kind: "aoe" });
    }
    if (getSkillCooldownRemaining("dash") <= 0) {
      for (const dir of BOT_CARDINAL_DIRECTIONS) {
        const dashEval = evaluateObserverBotDashDirection(dir.dx, dir.dy);
        if (dashEval) {
          addCandidate({ kind: "dash", dx: dir.dx, dy: dir.dy, dashEval });
        }
      }
    }

    for (const dir of BOT_CARDINAL_DIRECTIONS) {
      const nx = state.player.x + dir.dx;
      const ny = state.player.y + dir.dy;
      if (!inBounds(nx, ny)) continue;
      const targetEnemy = getEnemyAt(nx, ny);
      addCandidate({
        kind: "move",
        dx: dir.dx,
        dy: dir.dy,
        attack: Boolean(targetEnemy),
        targetEnemy: targetEnemy || null,
        onSpike: isSpikeAt(nx, ny),
        onChest: Boolean(getChestAt(nx, ny))
      });
    }

    const chasePlan = getBestEnemyChaseStepForBot({ forceSpikeRisk: forceAggro });
    if (chasePlan && chasePlan.step) {
      const nx = state.player.x + chasePlan.step.dx;
      const ny = state.player.y + chasePlan.step.dy;
      addCandidate({
        kind: "move",
        dx: chasePlan.step.dx,
        dy: chasePlan.step.dy,
        chase: true,
        risky: Boolean(chasePlan.risky),
        attack: Boolean(getEnemyAt(nx, ny)),
        targetEnemy: getEnemyAt(nx, ny),
        onSpike: isSpikeAt(nx, ny),
        onChest: Boolean(getChestAt(nx, ny))
      });
    }

    const fallback = getFallbackStepForBot();
    if (fallback) {
      const nx = state.player.x + fallback.dx;
      const ny = state.player.y + fallback.dy;
      addCandidate({
        kind: "move",
        dx: fallback.dx,
        dy: fallback.dy,
        fallback: true,
        attack: Boolean(getEnemyAt(nx, ny)),
        targetEnemy: getEnemyAt(nx, ny),
        onSpike: isSpikeAt(nx, ny),
        onChest: Boolean(getChestAt(nx, ny))
      });
    }
    return out;
  }

  function evaluateObserverBotCombatAction(candidate, context = {}) {
    if (!candidate) return { score: -Infinity };
    const weights = context.weights || getObserverBotAiWeights();
    const policy = context.policy || getObserverBotPolicyProfile();
    const threatMap = context.threatMap || buildObserverBotThreatMap();
    const nearestEnemy = context.nearestEnemy || getNearestEnemyForBot();
    const mutators = context.mutators || getObserverBotMutatorContext();
    const currentDist = nearestEnemy
      ? manhattan(state.player.x, state.player.y, nearestEnemy.x, nearestEnemy.y)
      : 0;

    let resultX = state.player.x;
    let resultY = state.player.y;
    let score = 0;
    let outgoingDamage = 0;
    let kills = 0;

    if (candidate.kind === "potion") {
      if (hasRelic("risk")) {
        return { score: -Infinity };
      }
      if (state.player.potions <= 0 || state.player.hp >= state.player.maxHp) {
        return { score: -Infinity };
      }
      const healAmount = getPotionHealAmount();
      const effectiveHeal = Math.min(Math.max(0, state.player.maxHp - state.player.hp), healAmount);
      const incoming = threatMap.damageAt(state.player.x, state.player.y);
      score += weights.potionBias * policy.survival * (effectiveHeal * 0.42 + incoming * 0.74);
      if (state.player.hp / Math.max(1, state.player.maxHp) > 0.82) score -= 65;
      if (mutators.famine || mutators.alchemist) {
        score += 14;
      }
    } else if (candidate.kind === "shield") {
      const incoming = threatMap.damageAt(state.player.x, state.player.y);
      const closeThreat = getBotEnemyCountWithinDistanceFrom(state.player.x, state.player.y, 1) * 2 +
        getBotEnemyCountWithinDistanceFrom(state.player.x, state.player.y, 2);
      const hpRatio = getBotHpRatio();
      const shieldTier = getSkillTier("shield");
      const currentShield = Math.max(0, Number(state.player.skillShield) || 0);
      const shieldGain = Math.max(
        MIN_EFFECTIVE_DAMAGE,
        Math.round(
          Math.max(1, Number(state.player.maxHp) || 1) *
          (shieldTier >= 1 ? SHIELD_RARE_HP_MULTIPLIER : SHIELD_BASE_HP_MULTIPLIER)
        )
      );
      const effectiveGain = currentShield > 0 ? 0 : shieldGain;
      score += weights.survival * policy.survival * (incoming * 0.95 + closeThreat * 16 + effectiveGain * 0.18);
      if (state.bossRoom) score += weights.bossDefense * 34;
      if (effectiveGain <= 0) score -= 140;
      if (hpRatio > 0.82 && incoming < scaledCombat(2) && closeThreat <= 1) score -= 36;
      if (shieldTier >= 2) {
        const chargeInfo = getShieldChargesInfo();
        if (
          chargeInfo &&
          chargeInfo.enabled &&
          chargeInfo.charges <= 1 &&
          !state.bossRoom &&
          closeThreat <= 1 &&
          incoming < scaledCombat(3)
        ) {
          score -= 28;
        }
      }
      if (mutators.haste || mutators.hunter) score += 10;
      if (mutators.famine && hpRatio < 0.7) score += 12;
    } else if (candidate.kind === "aoe") {
      if (getSkillCooldownRemaining("aoe") > 0) return { score: -Infinity };
      const aoeTier = getSkillTier("aoe");
      const radius = aoeTier >= 2 ? 2 : 1;
      const furySpent = Math.max(0, Math.floor(Number(state.player.adrenaline) || 0));
      const furyMult = getFuryAttackPowerMultiplier();
      let baseDamage = Math.max(
        MIN_EFFECTIVE_DAMAGE,
        Math.round(getPlayerAttackForDamage({ includeChaos: false }) * furyMult)
      );
      if (aoeTier >= 1) {
        baseDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(baseDamage * 1.5));
      }
      const targets = state.enemies.filter(
        (enemy) => Math.abs(enemy.x - state.player.x) <= radius && Math.abs(enemy.y - state.player.y) <= radius
      );
      if (targets.length <= 0) return { score: -Infinity };
      let predictedKills = 0;
      let totalPredictedDamage = 0;
      for (const enemy of targets) {
        const predicted = estimateObserverBotAoeDamage(enemy, aoeTier, furySpent, baseDamage);
        totalPredictedDamage += Math.min(Math.max(0, Number(enemy.hp) || 0), predicted);
        if ((Number(enemy.hp) || 0) <= predicted) predictedKills += 1;
      }
      outgoingDamage = totalPredictedDamage;
      kills = predictedKills;
      score += weights.kill * policy.aggression * (targets.length * 22 + predictedKills * 68 + totalPredictedDamage * 0.14);
      if (state.bossRoom && targets.length <= 1 && predictedKills <= 0) score -= 18;
      if (mutators.haste || mutators.hunter || mutators.ascension) {
        score += targets.length * 4 + predictedKills * 10;
      }
      if (mutators.famine && getBotHpRatio() < 0.5) {
        score += predictedKills * 16;
      }
    } else if (candidate.kind === "dash") {
      if (getSkillCooldownRemaining("dash") > 0) return { score: -Infinity };
      const dashEval = candidate.dashEval || evaluateObserverBotDashDirection(candidate.dx, candidate.dy);
      if (!dashEval) return { score: -Infinity };
      const landing = estimateObserverBotDashLandingPosition(candidate.dx, candidate.dy);
      resultX = landing.x;
      resultY = landing.y;
      outgoingDamage = (dashEval.hits || 0) * getPlayerAttackForDamage({ includeChaos: false });
      kills = Math.max(0, Number(dashEval.kills) || 0);
      score += weights.progress * policy.aggression * (Number(dashEval.score) || 0) * 0.8;
      score += weights.kill * policy.aggression * ((dashEval.hits || 0) * 19 + kills * 76);
      if (isSpikeAt(resultX, resultY) && !hasRelic("ironboots")) {
        score -= 24 * weights.spikeAversion;
      }
      if (mutators.haste || mutators.hunter) {
        score += (dashEval.hits || 0) * 4 + kills * 12;
      }
      if (mutators.greed && (Number(state.player.gold) || 0) < 100) {
        score += kills * 6;
      }
    } else if (candidate.kind === "move") {
      if (!Number.isFinite(candidate.dx) || !Number.isFinite(candidate.dy)) return { score: -Infinity };
      const nx = state.player.x + candidate.dx;
      const ny = state.player.y + candidate.dy;
      if (!inBounds(nx, ny)) return { score: -Infinity };
      if (candidate.attack) {
        const enemy = candidate.targetEnemy || getEnemyAt(nx, ny);
        if (enemy) {
          const predictedDamage = Math.min(Math.max(0, Number(enemy.hp) || 0), getObserverBotExpectedMeleeDamage());
          outgoingDamage = predictedDamage;
          kills = (Number(enemy.hp) || 0) <= predictedDamage ? 1 : 0;
          score += weights.kill * policy.aggression * (28 + predictedDamage * 0.22 + kills * 70);
          if (enemy.type === "acolyte" && isAcolyteOnlyRoomForBot()) {
            // If only acolytes remain, clean them up aggressively instead of kiting.
            score += 38;
          }
        }
      } else {
        resultX = nx;
        resultY = ny;
      }
      if (candidate.onChest && !state.roomCleared) {
        score -= 110;
      }
      if (candidate.onSpike && !hasRelic("ironboots")) {
        score -= 36 * weights.spikeAversion;
      }
      if (candidate.chase) score += 12;
      if (candidate.risky) score -= 10;
      if (candidate.fallback) score -= 4;
    } else {
      return { score: -Infinity };
    }

    const riskAtResult = threatMap.riskAt(resultX, resultY);
    const damageAtResult = threatMap.damageAt(resultX, resultY);
    const distAfter = nearestEnemy ? manhattan(resultX, resultY, nearestEnemy.x, nearestEnemy.y) : 0;
    if (nearestEnemy) {
      score += weights.progress * policy.aggression * (currentDist - distAfter) * 12;
    }
    score += weights.survival * policy.survival * (55 - riskAtResult * 0.42 - damageAtResult * 0.15);
    score += weights.utility * policy.utility * (outgoingDamage * 0.06 + kills * 8);
    return {
      score,
      resultX,
      resultY,
      riskAtResult,
      damageAtResult,
      outgoingDamage,
      kills
    };
  }

  function projectObserverBotCombatLookahead(candidate, context = {}) {
    if (!candidate) return 0;
    const turns = clamp(Math.floor(Number(context.lookaheadTurns) || 2), 2, 3);
    const armor = Math.max(0, Number(state.player.armor) || 0);
    const shieldTier = getSkillTier("shield");
    let simX = state.player.x;
    let simY = state.player.y;
    let simHp = Math.max(1, Number(state.player.hp) || 1);
    let simPotions = Math.max(0, Number(state.player.potions) || 0);
    const simShieldGainOnCast = Math.max(
      MIN_EFFECTIVE_DAMAGE,
      Math.round(
        Math.max(1, Number(state.player.maxHp) || 1) *
        (shieldTier >= 1 ? SHIELD_RARE_HP_MULTIPLIER : SHIELD_BASE_HP_MULTIPLIER)
      )
    );
    let simShieldPool = Math.max(0, Number(getTotalPlayerShield()) || 0);
    let simEnemies = state.enemies.map((enemy) => ({
      x: enemy.x,
      y: enemy.y,
      hp: Math.max(0, Number(enemy.hp) || 0),
      attack: Math.max(MIN_EFFECTIVE_DAMAGE, Number(enemy.attack) || 0),
      type: enemy.type,
      aiming: Boolean(enemy.aiming),
      slamAiming: Boolean(enemy.slamAiming),
      volleyAiming: Boolean(enemy.volleyAiming),
      burstAiming: Boolean(enemy.burstAiming)
    }));

    if (candidate.kind === "move") {
      const nx = state.player.x + candidate.dx;
      const ny = state.player.y + candidate.dy;
      if (candidate.attack) {
        const idx = simEnemies.findIndex((enemy) => enemy.x === nx && enemy.y === ny);
        if (idx >= 0) {
          simEnemies[idx].hp -= getObserverBotExpectedMeleeDamage();
          if (simEnemies[idx].hp <= 0) simEnemies.splice(idx, 1);
        }
      } else {
        simX = nx;
        simY = ny;
      }
    } else if (candidate.kind === "potion") {
      if (simPotions > 0) {
        simHp = Math.min(state.player.maxHp, simHp + getPotionHealAmount());
        simPotions -= 1;
      }
    } else if (candidate.kind === "shield") {
      simShieldPool += simShieldGainOnCast;
    } else if (candidate.kind === "aoe") {
      const aoeTier = getSkillTier("aoe");
      const radius = aoeTier >= 2 ? 2 : 1;
      const furySpent = Math.max(0, Math.floor(Number(state.player.adrenaline) || 0));
      const furyMult = getFuryAttackPowerMultiplier();
      let baseDamage = Math.max(
        MIN_EFFECTIVE_DAMAGE,
        Math.round(getPlayerAttackForDamage({ includeChaos: false }) * furyMult)
      );
      if (aoeTier >= 1) {
        baseDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(baseDamage * 1.5));
      }
      simEnemies = simEnemies.filter((enemy) => {
        if (Math.abs(enemy.x - simX) <= radius && Math.abs(enemy.y - simY) <= radius) {
          const predicted = estimateObserverBotAoeDamage(enemy, aoeTier, furySpent, baseDamage);
          enemy.hp -= predicted;
        }
        return enemy.hp > 0;
      });
    } else if (candidate.kind === "dash") {
      const landing = estimateObserverBotDashLandingPosition(candidate.dx, candidate.dy);
      simX = landing.x;
      simY = landing.y;
      const dashTier = getSkillTier("dash");
      const furyMult = getFuryAttackPowerMultiplier();
      const dashRelicMult = getDashRelicDamageMultiplier();
      const lineDamage = Math.max(
        MIN_EFFECTIVE_DAMAGE,
        Math.round((getPlayerAttackForDamage({ includeChaos: false }) + scaledCombat(1)) * furyMult * dashRelicMult)
      );
      for (const enemy of simEnemies) {
        if (
          (candidate.dx !== 0 && enemy.y === simY && Math.sign(enemy.x - state.player.x) === Math.sign(candidate.dx)) ||
          (candidate.dy !== 0 && enemy.x === simX && Math.sign(enemy.y - state.player.y) === Math.sign(candidate.dy))
        ) {
          enemy.hp -= dashTier >= 1 ? Math.round(lineDamage * 1.7) : lineDamage;
        }
      }
      simEnemies = simEnemies.filter((enemy) => enemy.hp > 0);
    }

    let score = 0;
    for (let turn = 1; turn <= turns; turn += 1) {
      const futureThreat = buildObserverBotThreatMap({
        depth: state.depth,
        playerArmor: armor,
        enemies: simEnemies,
        spikes: state.spikes,
        chests: (state.chests || []).filter((chest) => !chest.opened)
      });
      let incoming = futureThreat.damageAt(simX, simY);
      incoming = Math.max(0, incoming - Math.round(armor * 0.25));
      if (simShieldPool > 0 && incoming > 0) {
        const absorbed = Math.min(incoming, simShieldPool);
        simShieldPool = Math.max(0, simShieldPool - absorbed);
        incoming -= absorbed;
      }
      if (simShieldPool > 0) {
        simShieldPool = Math.max(0, Math.floor(simShieldPool * 0.8));
      }
      simHp -= incoming;
      if (simHp <= 0) {
        return -260 + simHp;
      }
      score += (simHp / Math.max(1, state.player.maxHp)) * 14;
      score -= futureThreat.riskAt(simX, simY) * 0.08;

      const occupied = new Set(simEnemies.map((enemy) => tileKey(enemy.x, enemy.y)));
      for (const enemy of simEnemies) {
        const dist = manhattan(enemy.x, enemy.y, simX, simY);
        if (dist <= 1) continue;
        let best = null;
        let bestDist = dist;
        for (const dir of BOT_CARDINAL_DIRECTIONS) {
          const nx = enemy.x + dir.dx;
          const ny = enemy.y + dir.dy;
          const key = tileKey(nx, ny);
          if (!inBounds(nx, ny)) continue;
          if (occupied.has(key)) continue;
          if (getChestAt(nx, ny)) continue;
          const d = manhattan(nx, ny, simX, simY);
          if (d < bestDist) {
            best = { x: nx, y: ny };
            bestDist = d;
          }
        }
        if (best) {
          occupied.delete(tileKey(enemy.x, enemy.y));
          enemy.x = best.x;
          enemy.y = best.y;
          occupied.add(tileKey(enemy.x, enemy.y));
        }
      }
    }

    let nearestDist = 0;
    if (simEnemies.length > 0) {
      nearestDist = Math.min(...simEnemies.map((enemy) => manhattan(enemy.x, enemy.y, simX, simY)));
      score -= nearestDist * 3.5;
      score += (state.enemies.length - simEnemies.length) * 11;
    }
    return score;
  }

  function chooseBestObserverBotCombatAction(options = {}) {
    const forceAggro = Boolean(options.forceAggro);
    const weights = getObserverBotAiWeights();
    const policy = getObserverBotPolicyProfile();
    const threatMap = buildObserverBotThreatMap();
    const nearestEnemy = getNearestEnemyForBot();
    const mutators = getObserverBotMutatorContext();
    const candidates = buildObserverBotCombatActionCandidates({ forceAggro });
    if (candidates.length <= 0) return { best: null, ranked: [] };

    const scored = [];
    for (const candidate of candidates) {
      const evaluation = evaluateObserverBotCombatAction(candidate, {
        weights,
        policy,
        threatMap,
        nearestEnemy,
        mutators
      });
      if (!Number.isFinite(evaluation.score)) continue;
      scored.push({
        ...candidate,
        ...evaluation,
        immediateScore: evaluation.score,
        score: evaluation.score,
        lookaheadBonus: 0
      });
    }
    if (scored.length <= 0) return { best: null, ranked: [] };

    scored.sort((a, b) => b.immediateScore - a.immediateScore);
    const topCount = Math.min(6, scored.length);
    for (let i = 0; i < topCount; i += 1) {
      const lookaheadBonus = projectObserverBotCombatLookahead(scored[i], {
        lookaheadTurns: policy.lookaheadTurns
      });
      scored[i].lookaheadBonus = lookaheadBonus;
      scored[i].score = scored[i].immediateScore + weights.lookahead * lookaheadBonus;
    }
    scored.sort((a, b) => b.score - a.score || b.immediateScore - a.immediateScore);
    return { best: scored[0], ranked: scored, policy, weights };
  }

  function getObserverBotDecisionLabel(candidate) {
    if (!candidate) return "no_action";
    if (candidate.kind === "move") {
      if (candidate.attack) return "melee";
      if (candidate.chase && candidate.risky) return "chase_enemy_risky";
      if (candidate.chase) return "chase_enemy";
      if (candidate.fallback) return "fallback_move";
      return "move";
    }
    if (candidate.kind === "shield") return "skill_shield";
    if (candidate.kind === "aoe") return "skill_aoe";
    if (candidate.kind === "dash") return "skill_dash";
    if (candidate.kind === "potion") return "drink_potion";
    return "act";
  }

  function executeObserverBotCombatAction(candidate) {
    if (!candidate) return false;
    if (candidate.kind === "potion") {
      if (hasRelic("risk")) return false;
      if (state.player.potions <= 0 || state.player.hp >= state.player.maxHp) return false;
      drinkPotion();
      return true;
    }
    if (candidate.kind === "shield") {
      return tryUseShieldSkill();
    }
    if (candidate.kind === "aoe") {
      return tryUseAoeSkill();
    }
    if (candidate.kind === "dash") {
      return tryUseDashSkill(candidate.dx, candidate.dy);
    }
    if (candidate.kind === "move") {
      tryMove(candidate.dx, candidate.dy);
      return true;
    }
    return false;
  }

  function runSmartBotCombatAction(options = {}) {
    const forceAggro = Boolean(options.forceAggro);
    const updateObserverDecision = Boolean(options.updateObserverDecision);
    const decision = chooseBestObserverBotCombatAction({ forceAggro });
    const ranked = Array.isArray(decision.ranked) ? decision.ranked : [];
    if (state.observerBot && decision.policy) {
      state.observerBot.lastPolicy = decision.policy.mode;
    }
    for (const candidate of ranked.slice(0, 8)) {
      if (executeObserverBotCombatAction(candidate)) {
        if (updateObserverDecision && state.observerBot) {
          state.observerBot.lastDecision = getObserverBotDecisionLabel(candidate);
        }
        return true;
      }
    }
    return false;
  }

  function runBotRelicDecision() {
    if (state.phase !== "relic") return false;
    if (state.legendarySwapPending) {
      chooseRelic(1);
      return true;
    }
    if (state.relicSwapPending) {
      chooseRelic(0);
      return true;
    }
    if (Array.isArray(state.relicDraft) && state.relicDraft.length > 0) {
      for (let i = 0; i < state.relicDraft.length; i += 1) {
        chooseRelic(i);
        if (state.phase !== "relic") {
          return true;
        }
      }
    }
    chooseRelic(getRelicDraftSkipIndex());
    return true;
  }

  function flushBotTurnResolution(maxSteps = 256) {
    let steps = 0;
    while (state.phase === "playing" && isTurnInputLocked() && steps < maxSteps) {
      if (state.enemyTurnInProgress) {
        updateEnemyTurnSequence(9999);
      } else if (state.turnInProgress) {
        finishTurnAfterEnemySequence();
      } else {
        break;
      }
      steps += 1;
    }
    return steps < maxSteps;
  }

  function runSingleBotAction() {
    if (state.phase !== "playing") return false;

    if (state.roomCleared) {
      if (isOnShrine()) {
        activateShrine();
        return true;
      }
      const shrineTarget = getNearestShrineForBot();
      if (shrineTarget) {
        const shrineStep = findBotStepWithSpikePolicy(shrineTarget.x, shrineTarget.y, { context: "utility" });
        if (shrineStep) {
          tryMove(shrineStep.dx, shrineStep.dy);
          return true;
        }
      }
      const postClearChest = getNearestChestForBot();
      if (postClearChest) {
        const chestStep = findBotStepWithSpikePolicy(postClearChest.x, postClearChest.y, { context: "utility" });
        if (chestStep) {
          tryMove(chestStep.dx, chestStep.dy);
          return true;
        }
      }
      if (isOnPortal()) {
        attemptDescend();
        return true;
      }
      const step = findBotStepWithSpikePolicy(state.portal.x, state.portal.y, { context: "extract" });
      if (step) {
        tryMove(step.dx, step.dy);
        return true;
      }
      return false;
    }

    if (isOnShrine()) {
      activateShrine();
      return true;
    }

    if (runSmartBotCombatAction({ updateObserverDecision: false })) {
      return true;
    }

    const fallbackStep = getFallbackStepForBot();
    if (fallbackStep) {
      tryMove(fallbackStep.dx, fallbackStep.dy);
      return true;
    }

    return false;
  }

  function runSingleBotSimulation(maxActionsPerRun = 8000) {
    startRun();
    let actions = 0;
    let stalledSteps = 0;
    const maxActions = Math.max(200, Number(maxActionsPerRun) || 8000);

    while (actions < maxActions) {
      if (state.phase === "dead" || state.phase === "won") break;

      if (state.phase === "relic") {
        runSmartBotRelicDecision();
        actions += 1;
        continue;
      }

      if (state.phase !== "playing") break;

      if (isTurnInputLocked()) {
        if (!flushBotTurnResolution()) {
          state.simulation.lastGameOverReason = "turn resolution timeout";
          break;
        }
        continue;
      }

      const acted = runSingleBotAction();
      actions += 1;
      if (!acted) {
        stalledSteps += 1;
        if (stalledSteps >= 8) {
          state.simulation.lastGameOverReason = "bot stalled";
          break;
        }
      } else {
        stalledSteps = 0;
      }

      if (state.phase === "playing" && isTurnInputLocked()) {
        if (!flushBotTurnResolution()) {
          state.simulation.lastGameOverReason = "turn resolution timeout";
          break;
        }
      }
    }

    if (state.phase === "playing" && actions >= maxActions && !state.simulation.lastGameOverReason) {
      state.simulation.lastGameOverReason = "simulation timeout";
    }

    let deathCause = "unknown";
    if (state.phase === "won") {
      deathCause = "victory";
    } else if (state.phase === "dead") {
      deathCause = classifyDeathCause(state.simulation.lastGameOverReason);
    } else if (state.simulation.lastGameOverReason) {
      deathCause = classifyDeathCause(state.simulation.lastGameOverReason);
    } else {
      deathCause = "other";
    }

    return {
      depth: getRunMaxDepth(),
      deathCause,
      reason: state.simulation.lastGameOverReason || "",
      phase: state.phase,
      turns: Math.max(0, Number(state.turn) || 0),
      potionsUsed: Math.max(0, Number(state.potionsUsedThisRun) || 0),
      goldEarned: Math.max(0, Number(getRunGoldEarned()) || 0),
      bossClears: Math.max(0, Math.floor(Math.max(0, Number(state.lastBossClearDepthThisRun) || 0) / 5))
    };
  }

  function runBalanceSimulation(options = {}) {
    const runCount = clamp(Math.floor(Number(options.runs) || 1000), 1, 10000);
    const baseSeed = String(options.seed ?? "balance-seed");
    const maxActionsInput = options.maxActionsPerRun ?? options.maxActions ?? options.maxTurns;
    const maxActionsPerRun = clamp(Math.floor(Number(maxActionsInput) || 8000), 200, 100000);
    const shouldLearn = options.learn === true;
    const originalStateSnapshot = deepCloneValue(state);
    const baselineStateSnapshot = deepCloneValue(state);
    const localStorageSnapshot = captureLocalStorageSnapshot();
    const results = [];
    const depths = [];
    const turns = [];
    const potionsUsed = [];
    const goldEarned = [];
    const bossClears = [];
    const causeCounts = {};
    let victories = 0;
    let bossClearRuns = 0;
    let totalBossClears = 0;

    try {
      stopAllBgm(true);
      stopSplashTrack(true);
      stopDeathTrack(true);
      stopVictoryTrack(true);
      stopFinalGameOverTrack(true);

      for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
        restoreStateFromSnapshot(baselineStateSnapshot);
        state.simulation.active = true;
        state.simulation.suppressLogs = true;
        state.simulation.suppressVisuals = true;
        state.simulation.suppressAudio = true;
        state.simulation.suppressPersistence = true;
        state.simulation.runIndex = runIndex + 1;
        state.simulation.runSeed = `${baseSeed}:${runIndex + 1}`;
        state.simulation.lastGameOverReason = "";
        state.currentRunId = null;
        state.currentRunToken = "";
        state.currentRunTokenExpiresAt = 0;
        state.currentRunSubmitSeq = 1;
        state.runLeaderboardSubmitted = false;
        state.runMaxDepth = 0;
        state.runGoldEarned = 0;
        state.lives = MAX_LIVES;
        state.deaths = 0;

        let runResult;
        try {
          runResult = withSeededRandom(state.simulation.runSeed, () => runSingleBotSimulation(maxActionsPerRun));
        } catch (error) {
          runResult = {
            depth: getRunMaxDepth(),
            deathCause: "error",
            reason: error instanceof Error ? error.message : String(error),
            phase: state.phase,
            turns: Math.max(0, Number(state.turn) || 0),
            potionsUsed: 0,
            goldEarned: Math.max(0, Number(getRunGoldEarned()) || 0),
            bossClears: Math.max(0, Math.floor(Math.max(0, Number(state.lastBossClearDepthThisRun) || 0) / 5))
          };
        }

        const normalizedDepth = Math.max(0, Number(runResult.depth) || 0);
        const normalizedTurns = Math.max(0, Number(runResult.turns) || 0);
        const normalizedPotionsUsed = Math.max(0, Number(runResult.potionsUsed) || 0);
        const normalizedGoldEarned = Math.max(0, Number(runResult.goldEarned) || 0);
        const normalizedBossClears = Math.max(0, Number(runResult.bossClears) || 0);
        const normalizedDeathCause = String(runResult.deathCause || "other");
        depths.push(normalizedDepth);
        turns.push(normalizedTurns);
        potionsUsed.push(normalizedPotionsUsed);
        goldEarned.push(normalizedGoldEarned);
        bossClears.push(normalizedBossClears);
        causeCounts[normalizedDeathCause] = (causeCounts[normalizedDeathCause] || 0) + 1;
        if (normalizedDeathCause === "victory") {
          victories += 1;
        }
        if (normalizedBossClears > 0) {
          bossClearRuns += 1;
        }
        totalBossClears += normalizedBossClears;
        results.push({
          run: runIndex + 1,
          seed: state.simulation.runSeed,
          depth: normalizedDepth,
          deathCause: normalizedDeathCause,
          reason: runResult.reason,
          phase: runResult.phase,
          turns: normalizedTurns,
          potionsUsed: normalizedPotionsUsed,
          goldEarned: normalizedGoldEarned,
          bossClears: normalizedBossClears
        });
      }
    } finally {
      restoreStateFromSnapshot(originalStateSnapshot);
      restoreLocalStorageSnapshot(localStorageSnapshot);
      markUiDirty();
      syncBgmWithState(true);
    }

    const minDepth = depths.length > 0 ? Math.min(...depths) : 0;
    const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
    const medianDepth = calculateMedian(depths);
    const p10Depth = calculatePercentile(depths, 0.1);
    const p90Depth = calculatePercentile(depths, 0.9);
    const meanDepth = calculateMean(depths);
    const meanTurns = calculateMean(turns);
    const meanPotionsUsed = calculateMean(potionsUsed);
    const meanGoldEarned = calculateMean(goldEarned);
    const meanBossClears = calculateMean(bossClears);
    const totalPotionsUsed = potionsUsed.reduce((sum, value) => sum + value, 0);
    const totalGoldEarned = goldEarned.reduce((sum, value) => sum + value, 0);
    const totalDepth = depths.reduce((sum, value) => sum + value, 0);
    const potionEfficiency = totalPotionsUsed > 0 ? totalDepth / totalPotionsUsed : 0;
    const victoryRate = runCount > 0 ? victories / runCount : 0;
    const bossClearRate = runCount > 0 ? bossClearRuns / runCount : 0;
    const deathCauses = summarizeCauseCounts(causeCounts);
    const causeRows = Object.entries(deathCauses).map(([cause, count]) => ({
      cause,
      count,
      percent: Number(((count / runCount) * 100).toFixed(2))
    }));

    const report = {
      runs: runCount,
      seed: baseSeed,
      maxActionsPerRun,
      medianDepth,
      p10Depth,
      p90Depth,
      meanDepth,
      minDepth,
      maxDepth,
      victories,
      deathCauses,
      metrics: {
        victoryRate,
        bossClearRate,
        meanBossClears,
        totalBossClears,
        meanTurns,
        meanPotionsUsed,
        meanGoldEarned,
        totalGoldEarned,
        potionEfficiency
      },
      results
    };

    let learning = null;
    if (shouldLearn) {
      learning = learnObserverBotWeightsFromSimulation(report, {
        targetMedianDepth: options.targetMedianDepth ?? options.targetMedian,
        targetP10Depth: options.targetP10Depth,
        learningRate: options.learningRate
      });
      if (learning) {
        report.learning = learning;
      }
    }

    window.DungeonLastSimReport = report;
    console.info(
      `[SimRunner] ${runCount} runs | seed="${baseSeed}" | p10=${p10Depth.toFixed(2)} median=${medianDepth} p90=${p90Depth.toFixed(2)} | mean=${meanDepth.toFixed(2)}`
    );
    console.table(causeRows);
    if (learning?.applied) {
      console.info(
        `[SimRunner][Learn] updated AI weights (lr=${learning.learningRate.toFixed(3)} | updates=${learning.updates})`
      );
    }
    return report;
  }

  function learnObserverBotWeightsFromSimulation(report, options = {}) {
    if (!report || typeof report !== "object") return null;
    const model = getObserverBotAiModel();
    if (model.learningEnabled === false && options.force !== true) {
      return {
        applied: false,
        reason: "learning_disabled",
        updates: Math.max(0, Number(model.updates) || 0),
        weights: getObserverBotAiWeights()
      };
    }

    const runs = Math.max(
      1,
      Math.floor(Number(report.runs) || (Array.isArray(report.results) ? report.results.length : 0) || 1)
    );
    const results = Array.isArray(report.results) ? report.results : [];
    const depths = results.map((entry) => Math.max(0, Number(entry?.depth) || 0));
    const medianDepth = Math.max(0, Number(report.medianDepth) || calculateMedian(depths));
    const p10Depth = Math.max(0, Number(report.p10Depth) || calculatePercentile(depths, 0.1));
    const p90Depth = Math.max(0, Number(report.p90Depth) || calculatePercentile(depths, 0.9));
    const causeCounts = report.deathCauses || {};
    const enemyRate = getCauseRateFromCounts(causeCounts, "enemy_damage", runs);
    const spikeRate = getCauseRateFromCounts(causeCounts, "spikes", runs);
    const timeoutRate = getCauseRateFromCounts(causeCounts, "timeout", runs);
    const victoryRate = Math.max(0, Number(report.victories) || 0) / runs;
    const bossClearRate = clamp(Number(report.metrics?.bossClearRate) || 0, 0, 1);

    let bossFailRuns = 0;
    for (const entry of results) {
      const depth = Math.max(0, Number(entry?.depth) || 0);
      if (entry?.deathCause === "enemy_damage" && depth > 0 && depth % 5 === 0) {
        bossFailRuns += 1;
      }
    }
    const bossFailRate = bossFailRuns / runs;

    const targetMedianDepth = Math.max(4, Number(options.targetMedianDepth ?? options.targetMedian ?? 18) || 18);
    const targetP10Depth = Math.max(
      2,
      Number(options.targetP10Depth ?? Math.round(targetMedianDepth * 0.45)) || Math.round(targetMedianDepth * 0.45)
    );
    const confidence = clamp(Math.sqrt(runs / 1000), 0.35, 1.5);
    const learningRate = clamp(Number(options.learningRate) || 0.45, 0.05, 1.25) * confidence;

    const medianGap = targetMedianDepth - medianDepth;
    const p10Gap = targetP10Depth - p10Depth;
    const survivalPressure = clamp(
      enemyRate * 1.2 + Math.max(0, medianGap) * 0.035 + Math.max(0, p10Gap) * 0.045 - victoryRate * 0.12,
      -0.8,
      1.3
    );
    const aggressionPressure = clamp(timeoutRate * 1.15 + Math.max(0, -medianGap) * 0.03 - enemyRate * 0.45, -0.9, 1.1);
    const spikePressure = clamp(spikeRate * 1.7 - timeoutRate * 0.25, -0.7, 1.2);
    const economyPressure = clamp(Math.max(0, medianGap) * 0.03 + bossFailRate * 0.35 - victoryRate * 0.18, -0.7, 1.1);
    const bossPressure = clamp(bossFailRate * 1.5 + Math.max(0, 0.35 - bossClearRate), -0.6, 1.2);
    const rawDeltas = {
      survival: survivalPressure * 0.22 - aggressionPressure * 0.05,
      kill: aggressionPressure * 0.18 - survivalPressure * 0.06 + victoryRate * 0.03,
      progress: aggressionPressure * 0.22 - survivalPressure * 0.07,
      utility: survivalPressure * 0.04 + spikePressure * 0.08,
      economy: economyPressure * 0.2 + survivalPressure * 0.04,
      lookahead: survivalPressure * 0.08 + spikePressure * 0.07 - timeoutRate * 0.07,
      spikeAversion: spikePressure * 0.26 + survivalPressure * 0.03,
      extractBias: economyPressure * 0.18 + survivalPressure * 0.08 - aggressionPressure * 0.05,
      potionBias: survivalPressure * 0.2 + enemyRate * 0.12 + bossPressure * 0.05,
      bossDefense: bossPressure * 0.24 + survivalPressure * 0.1
    };

    const beforeWeights = getObserverBotAiWeights();
    const plannedDeltas = {};
    let absoluteDeltaTotal = 0;
    for (const [key, fallback] of Object.entries(OBSERVER_AI_DEFAULT_WEIGHTS)) {
      const safeCurrent = Number.isFinite(Number(beforeWeights[key])) ? Number(beforeWeights[key]) : fallback;
      const raw = clamp(Number(rawDeltas[key]) || 0, -0.3, 0.3);
      const candidate = clamp(safeCurrent + raw * learningRate, 0.2, 3.5);
      const appliedDelta = candidate - safeCurrent;
      plannedDeltas[key] = appliedDelta;
      absoluteDeltaTotal += Math.abs(appliedDelta);
    }

    const rates = {
      enemyRate: Number(enemyRate.toFixed(4)),
      spikeRate: Number(spikeRate.toFixed(4)),
      timeoutRate: Number(timeoutRate.toFixed(4)),
      victoryRate: Number(victoryRate.toFixed(4)),
      bossFailRate: Number(bossFailRate.toFixed(4)),
      bossClearRate: Number(bossClearRate.toFixed(4))
    };
    const baseSummary = {
      learningRate: Number(learningRate.toFixed(3)),
      targetMedianDepth,
      targetP10Depth,
      baselineMedianDepth: medianDepth,
      baselineP10Depth: p10Depth,
      baselineP90Depth: p90Depth,
      rates
    };

    if (absoluteDeltaTotal <= 0.0001) {
      return {
        applied: false,
        reason: "no_change",
        updates: Math.max(0, Number(model.updates) || 0),
        ...baseSummary,
        weightsBefore: beforeWeights,
        weightsAfter: beforeWeights
      };
    }

    const nextWeights = updateObserverBotAiWeights((weights) => {
      for (const [key, fallback] of Object.entries(OBSERVER_AI_DEFAULT_WEIGHTS)) {
        const current = Number.isFinite(Number(weights[key])) ? Number(weights[key]) : fallback;
        weights[key] = clamp(current + (plannedDeltas[key] || 0), 0.2, 3.5);
      }
      return weights;
    });

    const deltas = {};
    for (const [key] of Object.entries(OBSERVER_AI_DEFAULT_WEIGHTS)) {
      deltas[key] = Number((Number(nextWeights[key]) - Number(beforeWeights[key])).toFixed(4));
    }
    return {
      applied: true,
      updates: Math.max(0, Number(getObserverBotAiModel().updates) || 0),
      ...baseSummary,
      deltas,
      weightsBefore: beforeWeights,
      weightsAfter: nextWeights
    };
  }

  function runObserverBotRegressionSuite(options = {}) {
    const runsPerSeed = clamp(Math.floor(Number(options.runsPerSeed ?? options.runs) || 200), 20, 5000);
    const suiteSeed = String(options.seed ?? "observer-regression");
    const maxActionsInput = options.maxActionsPerRun ?? options.maxActions ?? options.maxTurns;
    const maxActionsPerRun = clamp(Math.floor(Number(maxActionsInput) || 8000), 200, 100000);
    const requestedSeeds = Array.isArray(options.seeds) && options.seeds.length > 0
      ? options.seeds
      : ["baseline", "boss-check", "spike-check", "merchant-check", "long-run"];
    const seedNames = [];
    for (const rawSeed of requestedSeeds) {
      const normalized = String(rawSeed || "").trim().slice(0, 48);
      if (!normalized) continue;
      if (seedNames.includes(normalized)) continue;
      seedNames.push(normalized);
      if (seedNames.length >= 20) break;
    }
    if (seedNames.length <= 0) {
      seedNames.push("baseline");
    }

    const includeReports = options.includeReports === true;
    const allowLearning = options.learn === true;
    const seedRows = [];
    const reports = [];
    for (const name of seedNames) {
      const report = runBalanceSimulation({
        runs: runsPerSeed,
        seed: `${suiteSeed}:${name}`,
        maxActionsPerRun,
        learn: allowLearning,
        targetMedianDepth: options.targetMedianDepth,
        targetP10Depth: options.targetP10Depth,
        learningRate: options.learningRate
      });
      const runs = Math.max(1, Number(report.runs) || runsPerSeed);
      const deathCauses = report.deathCauses || {};
      const row = {
        seed: name,
        medianDepth: Number(report.medianDepth) || 0,
        p10Depth: Number(report.p10Depth) || 0,
        p90Depth: Number(report.p90Depth) || 0,
        meanDepth: Number(report.meanDepth) || 0,
        victoryRate: Number((((Number(report.victories) || 0) / runs) * 100).toFixed(2)),
        bossClearRate: Number((Math.max(0, Number(report.metrics?.bossClearRate) || 0) * 100).toFixed(2)),
        enemyDeathRate: Number((getCauseRateFromCounts(deathCauses, "enemy_damage", runs) * 100).toFixed(2)),
        spikeDeathRate: Number((getCauseRateFromCounts(deathCauses, "spikes", runs) * 100).toFixed(2)),
        timeoutRate: Number((getCauseRateFromCounts(deathCauses, "timeout", runs) * 100).toFixed(2)),
        potionEfficiency: Number((Number(report.metrics?.potionEfficiency) || 0).toFixed(3))
      };
      seedRows.push(row);
      if (includeReports) {
        reports.push({ seed: name, report });
      }
    }

    const medianDepths = seedRows.map((row) => row.medianDepth);
    const aggregate = {
      suites: seedRows.length,
      totalRuns: seedRows.length * runsPerSeed,
      medianDepth: calculateMedian(medianDepths),
      p10MedianDepth: calculatePercentile(medianDepths, 0.1),
      p90MedianDepth: calculatePercentile(medianDepths, 0.9),
      worstMedianDepth: medianDepths.length > 0 ? Math.min(...medianDepths) : 0,
      bestMedianDepth: medianDepths.length > 0 ? Math.max(...medianDepths) : 0,
      meanVictoryRate: Number(calculateMean(seedRows.map((row) => row.victoryRate)).toFixed(2)),
      meanBossClearRate: Number(calculateMean(seedRows.map((row) => row.bossClearRate)).toFixed(2)),
      meanEnemyDeathRate: Number(calculateMean(seedRows.map((row) => row.enemyDeathRate)).toFixed(2)),
      meanTimeoutRate: Number(calculateMean(seedRows.map((row) => row.timeoutRate)).toFixed(2)),
      meanPotionEfficiency: Number(calculateMean(seedRows.map((row) => row.potionEfficiency)).toFixed(3))
    };
    const suiteReport = {
      suiteSeed,
      runsPerSeed,
      maxActionsPerRun,
      aggregate,
      seeds: seedRows
    };
    if (includeReports) {
      suiteReport.reports = reports;
    }

    window.DungeonLastRegressionReport = suiteReport;
    console.info(
      `[Regression] ${seedRows.length} seeds x ${runsPerSeed} runs | median depth=${aggregate.medianDepth} | worst=${aggregate.worstMedianDepth} | best=${aggregate.bestMedianDepth}`
    );
    console.table(seedRows);
    return suiteReport;
  }

  const BOT_RELIC_BASE_SCORES = {
    fang: 48,
    plating: 52,
    lucky: 58,
    flask: 62,
    lifebloom: 68,
    ironboots: 74,
    idol: 78,
    thornmail: 84,
    vampfang: 102,
    adrenal: 92,
    scoutlens: 22,
    magnet: 68,
    shrineward: 76,
    merchfavor: 80,
    glasscannon: 70,
    echostrike: 114,
    phasecloak: 112,
    soulharvest: 96,
    burnblade: 110,
    frostamulet: 92,
    chronoloop: 160,
    voidreaper: 148,
    titanheart: 165,
    chaosorb: 134
  };

  function getBotHpRatio() {
    return state.player.hp / Math.max(1, state.player.maxHp);
  }

  function getBotRecommendedArmorForBossDepth(depth) {
    const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
    const bossTier = Math.max(1, Math.floor((safeDepth - 1) / 5) + 1);
    return scaledCombat(2 + (bossTier - 1));
  }

  function getObserverBotCapabilityDepth() {
    return Math.max(
      0,
      Number(state.highscore) || 0,
      Number(state.runMaxDepth) || 0,
      Number(state.lastBossClearDepthThisRun) || 0
    );
  }

  function getGuardUpgradeForBot() {
    return CAMP_UPGRADES.find((upgrade) => upgrade.id === "guard") || null;
  }

  function getCampUpgradeDefForBot(id) {
    return CAMP_UPGRADES.find((upgrade) => upgrade.id === id) || null;
  }

  function getCampUpgradeMaxForBot(id) {
    const def = getCampUpgradeDefForBot(id);
    return def ? Math.max(0, Number(def.max) || 0) : 0;
  }

  function estimateCampUpgradeCostToTargetForBot(id, targetLevel, options = {}) {
    const def = getCampUpgradeDefForBot(id);
    if (!def) return 0;
    const currentLevel = clamp(Math.floor(getCampUpgradeLevel(id)), 0, Math.max(0, Number(def.max) || 0));
    const cappedTarget = clamp(
      Math.floor(Number(targetLevel) || 0),
      currentLevel,
      Math.max(0, Number(def.max) || 0)
    );
    if (cappedTarget <= currentLevel) return 0;
    const growth = Math.max(1, Number(def.costGrowth) || 2);
    const visitMultRaw = options.visitMult ?? (
      state.phase === "camp"
        ? (state.campVisitShopCostMult || 1)
        : (state.runMods?.shopCostMult || 1)
    );
    const visitMult = Math.max(0.1, Number(visitMultRaw) || 1);
    let total = 0;
    for (let level = currentLevel; level < cappedTarget; level += 1) {
      const baseCost = Math.round(def.baseCost * growth ** level);
      total += Math.round(baseCost * visitMult);
    }
    return total;
  }

  function clearObserverBotDepthPressure() {
    if (!state.observerBot) return;
    state.observerBot.pressureDepth = 0;
    state.observerBot.pressureFailures = 0;
    state.observerBot.farmMode = false;
    state.observerBot.farmExtractDepth = 0;
    state.observerBot.farmGoldTarget = 0;
    state.observerBot.farmGuardTarget = 0;
    state.observerBot.farmVitalityTarget = 0;
    state.observerBot.farmBladeTarget = 0;
  }

  function getObserverBotDepthPressureStatus(options = {}) {
    if (!state.observerBot) {
      return {
        active: false,
        ready: true,
        pressureDepth: 0,
        failures: 0,
        extractDepth: 0,
        guardTarget: 0,
        vitalityTarget: 0,
        bladeTarget: 0,
        guardMissing: 0,
        vitalityMissing: 0,
        bladeMissing: 0,
        upgradeMissing: 0,
        goldTarget: 0,
        projectedCampGold: Math.max(0, Number(state.campGold) || 0),
        goldShortage: 0,
        remainingUpgradeCost: 0
      };
    }
    const bot = state.observerBot;
    const pressureDepth = Math.max(0, Number(bot.pressureDepth) || 0);
    const active = Boolean(bot.farmMode) && pressureDepth > 0;
    const guardTarget = Math.max(0, Number(bot.farmGuardTarget) || 0);
    const vitalityTarget = Math.max(0, Number(bot.farmVitalityTarget) || 0);
    const bladeTarget = Math.max(0, Number(bot.farmBladeTarget) || 0);
    const guardMissing = Math.max(0, guardTarget - getCampUpgradeLevel("guard"));
    const vitalityMissing = Math.max(0, vitalityTarget - getCampUpgradeLevel("vitality"));
    const bladeMissing = Math.max(0, bladeTarget - getCampUpgradeLevel("blade"));
    const upgradeMissing = guardMissing + vitalityMissing + bladeMissing;
    const includeRunGold = Boolean(options.includeRunGold);
    const projectedCampGold = Math.max(0, Number(state.campGold) || 0) + (
      includeRunGold ? Math.max(0, Number(state.player?.gold) || 0) : 0
    );
    const goldTarget = Math.max(0, Number(bot.farmGoldTarget) || 0);
    const goldShortage = Math.max(0, goldTarget - projectedCampGold);
    const remainingUpgradeCost =
      estimateCampUpgradeCostToTargetForBot("guard", guardTarget) +
      estimateCampUpgradeCostToTargetForBot("vitality", vitalityTarget) +
      estimateCampUpgradeCostToTargetForBot("blade", bladeTarget);
    const ready = !active || upgradeMissing <= 0;
    return {
      active,
      ready,
      pressureDepth,
      failures: Math.max(0, Number(bot.pressureFailures) || 0),
      extractDepth: Math.max(0, Number(bot.farmExtractDepth) || 0),
      guardTarget,
      vitalityTarget,
      bladeTarget,
      guardMissing,
      vitalityMissing,
      bladeMissing,
      upgradeMissing,
      goldTarget,
      projectedCampGold,
      goldShortage,
      remainingUpgradeCost
    };
  }

  function configureObserverBotDepthPressure(depth, failures = 1) {
    if (!state.observerBot) return;
    const targetDepth = clamp(Math.floor(Number(depth) || 0), 0, MAX_DEPTH);
    if (targetDepth <= 0) {
      clearObserverBotDepthPressure();
      return;
    }

    const safeFailures = clamp(Math.floor(Number(failures) || 1), 1, 99);
    const tier = Math.max(1, Math.floor((targetDepth - 1) / 5) + 1);
    const bossDepth = targetDepth > 0 && targetDepth % 5 === 0;

    let guardTarget = 1 + tier + (bossDepth ? 1 : 0);
    let vitalityTarget = 1 + tier + (bossDepth ? 1 : 0) + (targetDepth >= 10 ? 1 : 0);
    let bladeTarget = Math.max(1, tier - 1) + (targetDepth >= 15 ? 1 : 0);
    if (safeFailures >= 2) guardTarget += 1;
    if (safeFailures >= 3) vitalityTarget += 1;
    if (safeFailures >= 4) bladeTarget += 1;
    if (safeFailures >= 5) guardTarget += 1;

    guardTarget = clamp(guardTarget, 0, getCampUpgradeMaxForBot("guard"));
    vitalityTarget = clamp(vitalityTarget, 0, getCampUpgradeMaxForBot("vitality"));
    bladeTarget = clamp(bladeTarget, 0, getCampUpgradeMaxForBot("blade"));

    const projectedShopMult = Math.max(
      0.1,
      Number(state.runMods?.shopCostMult) || Number(state.campVisitShopCostMult) || 1
    );
    const guardCostNeed = estimateCampUpgradeCostToTargetForBot("guard", guardTarget, { visitMult: projectedShopMult });
    const vitalityCostNeed = estimateCampUpgradeCostToTargetForBot("vitality", vitalityTarget, { visitMult: projectedShopMult });
    const bladeCostNeed = estimateCampUpgradeCostToTargetForBot("blade", bladeTarget, { visitMult: projectedShopMult });
    const reserve = 70 + tier * 20 + safeFailures * 25;
    const goldTarget = Math.max(
      reserve,
      guardCostNeed + vitalityCostNeed + Math.round(bladeCostNeed * 0.7) + reserve
    );

    state.observerBot.pressureDepth = targetDepth;
    state.observerBot.pressureFailures = safeFailures;
    state.observerBot.farmMode = true;
    state.observerBot.farmExtractDepth = clamp(targetDepth - 1, 3, Math.max(3, targetDepth - 1));
    state.observerBot.farmGoldTarget = Math.max(0, Math.round(goldTarget));
    state.observerBot.farmGuardTarget = guardTarget;
    state.observerBot.farmVitalityTarget = vitalityTarget;
    state.observerBot.farmBladeTarget = bladeTarget;
    appendObserverBotTrace("farm_mode_configured", {
      targetDepth,
      failures: safeFailures,
      guardTarget,
      vitalityTarget,
      bladeTarget,
      goldTarget
    });
  }

  function registerObserverBotDepthFailure(depth, reason = "") {
    if (!isObserverBotActive()) return;
    const safeDepth = clamp(Math.floor(Number(depth) || 0), 0, MAX_DEPTH);
    if (safeDepth < 4) return;
    const text = String(reason || "").toLowerCase();
    if (text.includes("chest trap") || text.includes("shrine curse")) return;

    const prevDepth = Math.max(0, Number(state.observerBot.pressureDepth) || 0);
    const prevFailures = Math.max(0, Number(state.observerBot.pressureFailures) || 0);
    const failures = prevDepth === safeDepth ? prevFailures + 1 : 1;
    if (safeDepth <= 10 && failures < 2) {
      state.observerBot.pressureDepth = safeDepth;
      state.observerBot.pressureFailures = failures;
      state.observerBot.farmMode = false;
      state.observerBot.farmExtractDepth = 0;
      state.observerBot.farmGoldTarget = 0;
      state.observerBot.farmGuardTarget = 0;
      state.observerBot.farmVitalityTarget = 0;
      state.observerBot.farmBladeTarget = 0;
      appendObserverBotTrace("depth_failed_retry", {
        failedDepth: safeDepth,
        failures,
        reason: String(reason || "")
      });
      pushLog(`Observer Bot: depth ${safeDepth} failed once. Retrying without farm mode.`, "warn");
      return;
    }
    configureObserverBotDepthPressure(safeDepth, failures);
    appendObserverBotTrace("depth_failed_farm", {
      failedDepth: safeDepth,
      failures,
      reason: String(reason || "")
    });
    pushLog(
      `Observer Bot: depth ${safeDepth} too hard. Farming for Guard ${state.observerBot.farmGuardTarget}, Vitality ${state.observerBot.farmVitalityTarget}, Blade ${state.observerBot.farmBladeTarget}.`,
      "warn"
    );
  }

  function registerObserverBotDepthClear(depth) {
    if (!isObserverBotActive() || !state.observerBot?.farmMode) return;
    const safeDepth = clamp(Math.floor(Number(depth) || 0), 0, MAX_DEPTH);
    const pressureDepth = Math.max(0, Number(state.observerBot.pressureDepth) || 0);
    if (pressureDepth <= 0) {
      clearObserverBotDepthPressure();
      return;
    }
    if (safeDepth >= pressureDepth) {
      clearObserverBotDepthPressure();
      appendObserverBotTrace("farm_mode_cleared", {
        clearedDepth: safeDepth,
        previousPressureDepth: pressureDepth
      });
      pushLog(`Observer Bot: depth ${safeDepth} stabilized. Farming mode disabled.`, "good");
      return;
    }
    if (safeDepth >= pressureDepth - 1) {
      state.observerBot.pressureFailures = Math.max(
        1,
        Math.floor(Math.max(1, Number(state.observerBot.pressureFailures) || 1) * 0.6)
      );
    }
  }

  function getObserverBotRunGoldReserveForFarm() {
    const status = getObserverBotDepthPressureStatus({ includeRunGold: false });
    if (!status.active || status.ready || status.upgradeMissing <= 0) return 0;
    const reserveFromShortage = Math.round(Math.max(0, status.goldTarget - Math.max(0, Number(state.campGold) || 0)) * 0.7);
    return Math.max(
      0,
      Math.min(Math.max(0, Number(state.player.gold) || 0), reserveFromShortage)
    );
  }

  function getBotEnemyCountWithinDistanceFrom(x, y, maxDistance) {
    if (!Array.isArray(state.enemies) || state.enemies.length <= 0) return 0;
    let count = 0;
    for (const enemy of state.enemies) {
      if (manhattan(x, y, enemy.x, enemy.y) <= maxDistance) {
        count += 1;
      }
    }
    return count;
  }

  function getBotRelicScore(relic) {
    if (!relic) return -9999;
    const rarityScore = {
      normal: 36,
      rare: 74,
      epic: 112,
      legendary: 154
    };
    let score = (rarityScore[relic.rarity] || 30) + (BOT_RELIC_BASE_SCORES[relic.id] || 0);
    const hpRatio = getBotHpRatio();
    const stackCount = getRelicStackCount(relic.id);
    if (isRelicStackable(relic) && stackCount > 0) {
      score -= stackCount * 9;
    }
    if (relic.id === "glasscannon" && hpRatio < 0.65 && !hasRelic("titanheart")) {
      score -= 45;
    }
    if (relic.id === "flask" && state.player.potions <= 1) {
      score += 16;
    }
    if (relic.id === "merchfavor" && state.roomType === "merchant") {
      score += 22;
    }
    if (hpRatio < 0.5 && ["chronoloop", "titanheart", "phasecloak", "vampfang", "plating", "lifebloom", "flask"].includes(relic.id)) {
      score += 24;
    }
    if (state.bossRoom && ["voidreaper", "echostrike", "burnblade", "adrenal"].includes(relic.id)) {
      score += 12;
    }
    return score;
  }

  function runSmartBotRelicDecision() {
    if (state.phase !== "relic") return false;
    if (state.legendarySwapPending) {
      const incoming = getRelicById(state.legendarySwapPending.incomingRelicId);
      const current = getRelicById(state.legendarySwapPending.currentRelicId);
      const incomingScore = getBotRelicScore(incoming);
      const currentScore = getBotRelicScore(current);
      chooseRelic(incomingScore >= currentScore + 6 ? 1 : 0);
      return true;
    }

    if (state.relicSwapPending) {
      let worstIndex = 0;
      let worstScore = Infinity;
      for (let i = 0; i < state.relics.length; i += 1) {
        const relic = getRelicById(state.relics[i]);
        const score = getBotRelicScore(relic);
        if (score < worstScore) {
          worstScore = score;
          worstIndex = i;
        }
      }
      chooseRelic(worstIndex);
      return true;
    }

    const choices = Array.isArray(state.relicDraft) ? state.relicDraft : [];
    if (choices.length <= 0) {
      chooseRelic(getRelicDraftSkipIndex());
      return true;
    }
    let bestIndex = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < choices.length; i += 1) {
      const score = getBotRelicScore(choices[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0 && bestScore > 35) {
      chooseRelic(bestIndex);
      return true;
    }
    chooseRelic(getRelicDraftSkipIndex());
    return true;
  }

  function resolveCampRelicPromptForBot() {
    const prompt = state.extractRelicPrompt;
    if (!prompt) return false;
    const carried = getExtractPromptCarriedRelics(prompt);
    if (carried.length <= 0) {
      resolveExtractRelicPrompt(false);
      state.observerBot.lastDecision = "camp_relics_keep";
      return true;
    }

    const scored = carried.map((relicId, index) => {
      const relic = getRelicById(relicId);
      return {
        index,
        relicId,
        relic,
        score: getBotRelicScore(relic)
      };
    });
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    const keepTarget = clamp(state.depth >= 12 ? 6 : 5, 3, 8);
    const keepSet = new Set(
      scored
        .filter((entry) => entry.relic && entry.relic.rarity === "legendary")
        .map((entry) => entry.index)
    );
    for (const entry of scored) {
      if (keepSet.size >= keepTarget) break;
      keepSet.add(entry.index);
    }
    const selectedIndices = scored
      .filter((entry) => !keepSet.has(entry.index))
      .map((entry) => entry.index);
    prompt.selectedIndices = selectedIndices;
    resolveExtractRelicPrompt(selectedIndices.length > 0);
    state.observerBot.lastDecision = selectedIndices.length > 0
      ? `camp_relics_sell_${selectedIndices.length}`
      : "camp_relics_keep";
    return true;
  }

  function getObserverBotSkillSavingsTarget(options = {}) {
    const progressDepth = Math.max(
      0,
      Math.floor(Number(
        options.depth ?? Math.max(
          Number(state.depth) || 0,
          Number(state.highscore) || 0,
          Number(state.runMaxDepth) || 0,
          Number(state.lastExtract?.depth) || 0
        )
      ) || 0)
    );
    const maxPlannedUpgrades =
      progressDepth >= 22 ? 3 :
        progressDepth >= 12 ? 2 :
          progressDepth >= 6 ? 1 : 0;
    if (maxPlannedUpgrades <= 0) {
      return { reserve: 0, planned: [] };
    }

    const candidates = [];
    for (const skillId of ["shield", "dash", "aoe"]) {
      const tier = getSkillTier(skillId);
      if (tier >= MAX_SKILL_TIER) continue;
      const offer = getNextSkillUpgradeOffer(skillId);
      if (!offer) continue;
      const nextTier = tier + 1;
      if (nextTier === 2 && progressDepth < 11) continue;
      if (nextTier >= LEGENDARY_SKILL_TIER && progressDepth < 20) continue;
      if (
        nextTier >= LEGENDARY_SKILL_TIER &&
        typeof canBuyLegendarySkillUpgrade === "function" &&
        !canBuyLegendarySkillUpgrade(skillId)
      ) {
        continue;
      }
      const cost = merchantSkillUpgradeCost(skillId);
      if (!Number.isFinite(cost) || cost <= 0) continue;

      let priority = skillId === "shield" ? 300 : skillId === "dash" ? 250 : 220;
      priority += nextTier * 46;
      if (nextTier === 1) priority += 34;
      if (nextTier === 2 && progressDepth >= 14) priority += 42;
      if (nextTier >= LEGENDARY_SKILL_TIER && progressDepth >= 24) priority += 64;
      candidates.push({ skillId, nextTier, cost, priority });
    }

    candidates.sort((a, b) => b.priority - a.priority || a.cost - b.cost);
    const planned = candidates.slice(0, maxPlannedUpgrades);
    const reserveRaw = planned.reduce((sum, entry) => sum + Math.round(entry.cost * 0.92), 0);
    const reserveCap = progressDepth >= 24 ? 2200 : progressDepth >= 16 ? 1500 : 850;
    const reserve = clamp(reserveRaw + (planned.length > 0 ? 50 : 0), 0, reserveCap);
    return { reserve, planned };
  }

  function getBotCampUpgradeScore(upgrade, cost) {
    if (!upgrade || cost <= 0) return -Infinity;
    const level = getCampUpgradeLevel(upgrade.id);
    const survivabilityLevel = getCampUpgradeLevel("vitality") + getCampUpgradeLevel("guard");
    const lastExtractDepth = Math.max(0, Number(state.lastExtract?.depth) || 0);
    const justExtractedBeforeBoss = lastExtractDepth > 0 && lastExtractDepth % 5 === 4;
    let value = 0;
    if (upgrade.id === "vitality") {
      value = 135 - level * 9;
      if (level < 4) value += 44;
      if (survivabilityLevel < 7) value += 20;
      if (justExtractedBeforeBoss) value += 26;
    } else if (upgrade.id === "blade") {
      value = 130 - level * 8;
      if (level < 4) value += 38;
      if (justExtractedBeforeBoss) value -= 24;
    } else if (upgrade.id === "satchel") {
      value = 108 - level * 16;
      if (level < 2) value += 46;
      if (level >= 4) value -= 30;
    } else if (upgrade.id === "guard") {
      value = 122 - level * 8;
      if (level < 3) value += 30;
      if (justExtractedBeforeBoss) value += 90;
      if (level < 6 && justExtractedBeforeBoss) value += 28;
    } else if (upgrade.id === "auto_potion") {
      value = level > 0 ? -999 : 220;
      if (state.lives <= 2) value += 25;
    } else if (upgrade.id === "potion_strength") {
      value = 96 - level * 14;
      if (getCampUpgradeLevel("satchel") >= 2) value += 18;
    } else if (upgrade.id === "crit_chance") {
      value = 90 - level * 18;
      if (getCampUpgradeLevel("blade") >= 4) value += 12;
    } else if (upgrade.id === "treasure_sense") {
      value = 82 - level * 13;
      if (survivabilityLevel >= 8) value += 16;
    } else if (upgrade.id === "emergency_stash") {
      value = 74 - level * 20;
      if (state.lives <= 2) value += 20;
    } else if (upgrade.id === "bounty_contract") {
      value = 84 - level * 13;
      if (survivabilityLevel >= 8) value += 20;
    }
    const farmStatus = getObserverBotDepthPressureStatus({ includeRunGold: false });
    if (farmStatus.active && !farmStatus.ready && farmStatus.upgradeMissing > 0) {
      if (upgrade.id === "guard" && farmStatus.guardMissing > 0) {
        value += 260 + farmStatus.guardMissing * 36;
      } else if (upgrade.id === "vitality" && farmStatus.vitalityMissing > 0) {
        value += 240 + farmStatus.vitalityMissing * 32;
      } else if (upgrade.id === "blade" && farmStatus.bladeMissing > 0) {
        value += 180 + farmStatus.bladeMissing * 24;
      } else if (!["guard", "vitality", "blade"].includes(upgrade.id)) {
        value -= 120;
      }
    }
    if (value <= 0) return -Infinity;
    const costFactor = Math.max(1, cost / 60);
    return value / costFactor;
  }

  function chooseBestCampUpgradeIndexForBot() {
    const farmStatus = getObserverBotDepthPressureStatus({ includeRunGold: false });
    const coreOnly = farmStatus.active && !farmStatus.ready && farmStatus.upgradeMissing > 0;
    const neededCore = new Set();
    if (farmStatus.guardMissing > 0) neededCore.add("guard");
    if (farmStatus.vitalityMissing > 0) neededCore.add("vitality");
    if (farmStatus.bladeMissing > 0) neededCore.add("blade");
    const skillSavings = getObserverBotSkillSavingsTarget();
    const skillReserveFloor = Math.max(0, Math.round(Number(skillSavings.reserve) || 0));

    let bestIndex = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < CAMP_UPGRADES.length; i += 1) {
      const upgrade = CAMP_UPGRADES[i];
      if (coreOnly && !neededCore.has(upgrade.id)) continue;
      const level = getCampUpgradeLevel(upgrade.id);
      if (level >= upgrade.max) continue;
      const cost = getCampUpgradeCost(upgrade);
      if (cost > state.campGold) continue;
      if (!coreOnly && skillReserveFloor > 0 && state.campGold - cost < skillReserveFloor) continue;
      const score = getBotCampUpgradeScore(upgrade, cost);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  function canBotSpendMerchantGold(cost, options = {}) {
    const ignoreFarmReserve = Boolean(options.ignoreFarmReserve);
    const ignoreEconomyPlan = Boolean(options.ignoreEconomyPlan);
    let reserveCampGold = 220;
    let reserveRunGold = 0;
    if (!ignoreEconomyPlan) {
      const economyPlan = getObserverBotEconomyPlan();
      if (economyPlan) {
        reserveCampGold = Math.max(0, Math.max(
          reserveCampGold,
          Math.round(Number(economyPlan.campGoldReserve) || 0)
        ));
        reserveRunGold = Math.max(0, Math.max(
          reserveRunGold,
          Math.round(Number(economyPlan.runGoldReserve) || 0)
        ));
        if (economyPlan.shouldBankSoon) {
          reserveRunGold = Math.max(
            reserveRunGold,
            Math.round(Math.max(0, Number(economyPlan.runGoldBankThreshold) || 0) * 0.6)
          );
        }
      }
    }
    if (!ignoreFarmReserve) {
      const farmStatus = getObserverBotDepthPressureStatus({ includeRunGold: false });
      if (farmStatus.active && !farmStatus.ready && farmStatus.upgradeMissing > 0) {
        reserveCampGold = Math.max(reserveCampGold, farmStatus.remainingUpgradeCost + 40);
        reserveRunGold = Math.max(reserveRunGold, getObserverBotRunGoldReserveForFarm());
      }
    }
    const spendableRun = Math.max(0, (Number(state.player.gold) || 0) - reserveRunGold);
    const spendableCamp = Math.max(0, (Number(state.campGold) || 0) - reserveCampGold);
    const spendable = spendableRun + spendableCamp;
    return spendable >= Math.max(0, Number(cost) || 0);
  }

  function getBotMerchantUpgradeScore(skillId, cost, nextTier) {
    if (cost <= 0) return -Infinity;
    const hpRatio = getBotHpRatio();
    const progressDepth = Math.max(
      0,
      Number(state.depth) || 0,
      Number(state.highscore) || 0,
      Number(state.runMaxDepth) || 0,
      Number(state.lastExtract?.depth) || 0
    );
    let value = 0;
    if (skillId === "shield") {
      value = nextTier === 1 ? 152 : nextTier === 2 ? 186 : 224;
      if (hpRatio < 0.55) value += 30;
      if (hpRatio < 0.35) value += 18;
      if (state.bossRoom) value += 20;
    } else if (skillId === "dash") {
      value = nextTier === 1 ? 138 : nextTier === 2 ? 178 : 212;
      if (state.bossRoom) value += 10;
    } else if (skillId === "aoe") {
      value = nextTier === 1 ? 122 : nextTier === 2 ? 168 : 206;
      if (state.enemies.length >= 4) value += 16;
    }
    if (nextTier === 1 && progressDepth >= 6) value += 26;
    if (nextTier === 2 && progressDepth >= 12) value += 38;
    if (nextTier >= LEGENDARY_SKILL_TIER && progressDepth >= 20) value += 58;

    const costPenalty = Math.pow(Math.max(1, cost) / 380, 0.72);
    return value / Math.max(0.6, costPenalty);
  }

  function runObserverMerchantAction() {
    if (state.phase !== "playing" || state.roomType !== "merchant" || !isOnMerchant()) return false;
    if (state.observerBot.merchantPurchasesThisRoom >= 6) return false;

    const hpRatio = getBotHpRatio();
    const walletTotal = Math.max(0, Number(state.player.gold) || 0) + Math.max(0, Number(state.campGold) || 0);
    const potionCost = merchantPotionCost();
    const economyPlan = getObserverBotEconomyPlan({ forceRefresh: true });
    const potionTarget = clamp(Math.floor(Number(economyPlan?.potionTarget) || 1), 1, state.player.maxPotions);
    const farmStatus = getObserverBotDepthPressureStatus({ includeRunGold: true });
    const preserveForFarm = (
      farmStatus.active &&
      !farmStatus.ready &&
      farmStatus.upgradeMissing > 0
    );
    const preserveGoldForCamp = preserveForFarm || (
      economyPlan &&
      economyPlan.shouldBankSoon &&
      walletTotal <
      Math.max(0, Number(economyPlan.campGoldReserve) || 0)
    );
    const emergencyPotionBuy = state.player.potions <= 0 && hpRatio < 0.65;
    const allowPotionSpend = !preserveGoldForCamp || emergencyPotionBuy || state.player.potions < potionTarget;
    if (
      allowPotionSpend &&
      state.player.potions <= potionTarget &&
      state.player.potions < state.player.maxPotions &&
      canBotSpendMerchantGold(potionCost, {
        ignoreFarmReserve: emergencyPotionBuy,
        ignoreEconomyPlan: emergencyPotionBuy
      }) &&
      (state.player.potions <= 0 || state.player.potions < potionTarget || hpRatio < 0.8 || potionCost <= 20)
    ) {
      if (tryBuyPotionFromMerchant()) {
        state.observerBot.merchantPurchasesThisRoom += 1;
        state.observerBot.lastDecision = "merchant_potion";
        return true;
      }
    }

    const missingSkillIds = [];
    const candidates = [];
    let best = null;
    for (const skillId of ["shield", "dash", "aoe"]) {
      const tier = getSkillTier(skillId);
      if (tier >= MAX_SKILL_TIER) continue;
      missingSkillIds.push(skillId);
      const nextTier = tier + 1;
      if (
        nextTier >= LEGENDARY_SKILL_TIER &&
        typeof canBuyLegendarySkillUpgrade === "function" &&
        !canBuyLegendarySkillUpgrade(skillId)
      ) {
        continue;
      }
      const cost = merchantSkillUpgradeCost(skillId);
      if (!Number.isFinite(cost) || cost <= 0 || walletTotal < cost) continue;
      const score = getBotMerchantUpgradeScore(skillId, cost, nextTier);
      candidates.push({ skillId, score, cost, nextTier });
      if (!best || score > best.score) {
        best = { skillId, score, cost, nextTier };
      }
    }

    const campReserveTarget = Math.max(0, Number(economyPlan?.campGoldReserve) || 0);
    const onlyAoeMissing = missingSkillIds.length === 1 && missingSkillIds[0] === "aoe";
    const aoeCandidate = candidates.find((entry) => entry.skillId === "aoe") || null;
    if (
      onlyAoeMissing &&
      aoeCandidate &&
      canBotSpendMerchantGold(aoeCandidate.cost, { ignoreEconomyPlan: true })
    ) {
      if (tryBuySkillUpgradeFromMerchant("aoe")) {
        state.observerBot.merchantPurchasesThisRoom += 1;
        state.observerBot.lastDecision = "merchant_upgrade_aoe_finisher";
        return true;
      }
    }
    const bankingReserveRatio = best
      ? (best.nextTier >= LEGENDARY_SKILL_TIER ? 0.92 : best.nextTier === 2 ? 0.78 : 0.62)
      : 1;
    const canBuyBestWithReserves = Boolean(best) && canBotSpendMerchantGold(best.cost);
    const canBuyBestWhileBanking = Boolean(best) &&
      !preserveForFarm &&
      walletTotal >= best.cost &&
      walletTotal - best.cost >= Math.round(campReserveTarget * bankingReserveRatio);
    if (best && (canBuyBestWithReserves || canBuyBestWhileBanking)) {
      if (tryBuySkillUpgradeFromMerchant(best.skillId)) {
        state.observerBot.merchantPurchasesThisRoom += 1;
        state.observerBot.lastDecision = `merchant_upgrade_${best.skillId}`;
        return true;
      }
    }

    if (preserveGoldForCamp) {
      state.observerBot.lastDecision = "merchant_save_gold";
      return false;
    }

    if (!preserveGoldForCamp && state.player.potions < potionTarget && state.player.potions < state.player.maxPotions &&
      canBotSpendMerchantGold(potionCost) && (potionCost <= 26 || hpRatio < 0.72)
    ) {
      if (tryBuyPotionFromMerchant()) {
        state.observerBot.merchantPurchasesThisRoom += 1;
        state.observerBot.lastDecision = "merchant_potion";
        return true;
      }
    }
    return false;
  }

  function shouldObserverBotEmergencyExtractNow() {
    if (state.phase !== "playing" || state.roomCleared) return false;
    if (state.depth < 4) return false;
    if (state.player.gold < 25) return false;
    const hpRatio = getBotHpRatio();
    const closeThreat = getBotEnemyCountWithinDistanceFrom(state.player.x, state.player.y, 2);
    if (state.player.potions > 0 && hpRatio > 0.16) return false;
    if (hpRatio <= 0.12) return true;
    if (hpRatio <= 0.2 && closeThreat >= 3) return true;
    if (state.lives <= 1 && hpRatio <= 0.25 && closeThreat >= 2) return true;
    return false;
  }

  function shouldObserverBotExtractNow() {
    if (state.phase !== "playing" || !state.roomCleared) return false;
    const depth = Math.max(0, Number(state.depth) || 0);
    if (depth < 3) return false;
    const nextDepth = Math.min(MAX_DEPTH, depth + 1);
    const nextIsBoss = nextDepth > 0 && nextDepth % 5 === 0;
    const hpRatio = getBotHpRatio();
    const potions = Math.max(0, Number(state.player.potions) || 0);
    const gold = Math.max(0, Number(state.player.gold) || 0);
    const armor = Math.max(0, Number(state.player.armor) || 0);
    const hpShield = Math.max(0, Number(state.player.hpShield) || 0);
    const projectedCampGold = Math.max(0, Number(state.campGold) || 0) + gold;
    const farmStatus = getObserverBotDepthPressureStatus({ includeRunGold: true });
    const economyPlan = getObserverBotEconomyPlan({ forceRefresh: true });
    const capabilityDepth = getObserverBotCapabilityDepth();
    const mutators = getObserverBotMutatorContext();

    if (farmStatus.active && farmStatus.ready) {
      clearObserverBotDepthPressure();
    }

    const recommendedArmor = nextIsBoss ? getBotRecommendedArmorForBossDepth(nextDepth) : 0;
    const armorGap = Math.max(0, recommendedArmor - armor);
    const armorStep = Math.max(1, scaledCombat(1));

    let riskScore = 0;
    riskScore += clamp((0.68 - hpRatio) * 130, 0, 80);
    if (hpRatio < 0.5) riskScore += 10;
    if (potions <= 0) {
      riskScore += 28;
    } else if (potions === 1) {
      riskScore += 10;
    }
    if (state.lives <= 1) riskScore += 18;
    if (depth >= 12) riskScore += 4;
    if (mutators.haste) riskScore += 8;
    if (mutators.hunter) riskScore += 6;
    if (mutators.ascension) {
      riskScore += Math.min(14, Math.floor(Math.max(depth, Number(state.runMaxDepth) || 0) / 6) * 2);
    }
    if (mutators.famine && (potions <= 1 || hpRatio < 0.6)) {
      riskScore += 12;
    }
    if (nextIsBoss) {
      riskScore += Math.round((armorGap / armorStep) * 16);
      if (hpRatio < 0.72) riskScore += 14;
      if (potions <= 0) riskScore += 18;
    }

    let resilienceScore = 0;
    if (capabilityDepth >= nextDepth + 10) {
      resilienceScore += 24;
    } else if (capabilityDepth >= nextDepth + 5) {
      resilienceScore += 12;
    }
    if (hpRatio >= 0.78) resilienceScore += 12;
    if (potions >= 2) {
      resilienceScore += 16;
    } else if (potions === 1) {
      resilienceScore += 7;
    }
    if (state.lives >= 3) resilienceScore += 7;
    if (nextIsBoss && armorGap <= 0) resilienceScore += 12;
    if (mutators.resilience && hpShield > 0) resilienceScore += 6;
    if (mutators.bulwark) resilienceScore += 6;

    const dangerScore = riskScore - resilienceScore;
    let economyUrgency = 0;
    if (economyPlan) {
      const reserveTarget = Math.max(0, Number(economyPlan.campGoldReserve) || 0);
      const runBankThreshold = Math.max(0, Number(economyPlan.runGoldBankThreshold) || 0);
      const potionTarget = Math.max(0, Number(economyPlan.potionTarget) || 0);
      const upcomingBossDepth = Math.max(0, Number(economyPlan.upcomingBossDepth) || 0);
      const meaningfulBank = gold >= Math.max(25, Math.round(runBankThreshold * 0.75));
      if (economyPlan.shouldBankSoon && meaningfulBank) economyUrgency += 12;
      if (reserveTarget > 0 && projectedCampGold >= reserveTarget && meaningfulBank) economyUrgency += 10;
      if (
        upcomingBossDepth > 0 &&
        depth >= Math.max(3, upcomingBossDepth - 1) &&
        gold >= Math.max(35, runBankThreshold - 20)
      ) {
        economyUrgency += 8;
      }
      if (
        upcomingBossDepth > 0 &&
        potions < potionTarget &&
        depth >= Math.max(3, upcomingBossDepth - 2) &&
        gold >= 30
      ) {
        economyUrgency += 8;
      }
      if (mutators.greed && gold >= 120) {
        economyUrgency += 8;
      }
    }

    if (farmStatus.active && !farmStatus.ready) {
      const allowShallowRetry = (
        capabilityDepth >= 20 &&
        farmStatus.pressureDepth > 0 &&
        farmStatus.pressureDepth <= 10 &&
        farmStatus.failures <= 2
      );
      const nearPressureDepth = farmStatus.pressureDepth > 0 && depth >= Math.max(3, farmStatus.pressureDepth - 1);
      const atFarmExtractDepth = depth >= Math.max(3, Number(farmStatus.extractDepth) || 0);
      const farmCashReady = (
        farmStatus.projectedCampGold >= farmStatus.goldTarget ||
        farmStatus.goldShortage <= Math.max(30, Math.round(farmStatus.remainingUpgradeCost * 0.2))
      );
      if (!allowShallowRetry && nearPressureDepth) economyUrgency += 14;
      if (!allowShallowRetry && atFarmExtractDepth && farmCashReady) economyUrgency += 12;
    }

    const weightedDanger = dangerScore + economyUrgency * 0.65;
    const extractThreshold = nextIsBoss ? 32 : 38;

    if (gold >= 20 && potions <= 0 && hpRatio <= 0.24) return true;
    if (gold >= 25 && state.lives <= 1 && hpRatio <= 0.34 && potions <= 1) return true;

    if (nextIsBoss) {
      if (weightedDanger >= 26 && gold >= 25) return true;
      if (armorGap >= armorStep * 2 && hpRatio < 0.56 && gold >= 25) return true;
    }

    if (farmStatus.active && !farmStatus.ready) {
      if (weightedDanger >= 24 && depth >= Math.max(3, Number(farmStatus.extractDepth) || 0) && gold >= 20) {
        return true;
      } else if (gold >= 30 && hpRatio < 0.52 && (armorGap >= scaledCombat(2) || potions <= 0)) {
        return true;
      }
    }

    if (weightedDanger >= extractThreshold && gold >= 20) return true;
    return false;
  }

  function canObserverBotUseShieldNow() {
    if (!Array.isArray(state.enemies) || state.enemies.length <= 0) return false;
    if (Math.max(0, Number(state.player.skillShield) || 0) > 0) return false;
    const tier = getSkillTier("shield");
    if (tier >= 2) {
      const charges = getShieldChargesInfo();
      return Boolean(charges && charges.enabled && charges.charges > 0);
    }
    return getSkillCooldownRemaining("shield") <= 0;
  }

  function maybeObserverBotUseShield() {
    if (!canObserverBotUseShieldNow()) return false;
    const hpRatio = getBotHpRatio();
    const adjacent = getBotEnemyCountWithinDistanceFrom(state.player.x, state.player.y, 1);
    const close = getBotEnemyCountWithinDistanceFrom(state.player.x, state.player.y, 2);
    const shieldNow = Math.max(0, Number(state.player.skillShield) || 0);
    const shieldRatio = shieldNow / Math.max(1, Number(state.player.maxHp) || 1);
    const incomingCast = state.enemies.some((enemy) => enemy.aiming || enemy.volleyAiming || enemy.burstAiming || enemy.slamAiming);
    if (
      shieldRatio < 0.5 &&
      adjacent >= 2 ||
      close >= 3 ||
      (hpRatio < 0.5 && close >= 1) ||
      (state.bossRoom && (close >= 1 || incomingCast)) ||
      (incomingCast && hpRatio < 0.7)
    ) {
      if (tryUseShieldSkill()) {
        state.observerBot.lastDecision = "skill_shield";
        return true;
      }
    }
    return false;
  }

  function estimateObserverBotAoeDamage(enemy, aoeTier, furySpent, baseDamage) {
    const dist = Math.max(Math.abs(enemy.x - state.player.x), Math.abs(enemy.y - state.player.y));
    if (aoeTier >= LEGENDARY_SKILL_TIER) {
      const ring1 = 1.2 + furySpent * 0.2;
      const ring2 = 0.8 + furySpent * 0.2;
      const mult = dist <= 1 ? ring1 : ring2;
      return Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(baseDamage * mult));
    }
    const furyMult = 0.6 + furySpent * 0.2;
    const falloff = aoeTier >= 2 && dist >= 2 ? 0.7 : 1;
    return Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(baseDamage * furyMult * falloff));
  }

  function maybeObserverBotUseAoe() {
    if (getSkillCooldownRemaining("aoe") > 0) return false;
    const aoeTier = getSkillTier("aoe");
    const radius = aoeTier >= 2 ? 2 : 1;
    const furySpent = Math.max(0, Math.floor(Number(state.player.adrenaline) || 0));
    const furyMult = getFuryAttackPowerMultiplier();
    let baseDamage = Math.max(
      MIN_EFFECTIVE_DAMAGE,
      Math.round(getPlayerAttackForDamage({ includeChaos: false }) * furyMult)
    );
    if (aoeTier >= 1) {
      baseDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(baseDamage * 1.5));
    }
    const targets = state.enemies.filter(
      (enemy) => Math.abs(enemy.x - state.player.x) <= radius && Math.abs(enemy.y - state.player.y) <= radius
    );
    if (targets.length <= 0) return false;

    let predictedKills = 0;
    for (const enemy of targets) {
      const predicted = estimateObserverBotAoeDamage(enemy, aoeTier, furySpent, baseDamage);
      if ((Number(enemy.hp) || 0) <= predicted) predictedKills += 1;
    }
    const adjacentThreat = getBotEnemyCountWithinDistanceFrom(state.player.x, state.player.y, 1);
    if (
      targets.length >= 3 ||
      (predictedKills >= 1 && targets.length >= 2) ||
      (state.bossRoom && targets.length >= 2) ||
      (adjacentThreat >= 2 && targets.length >= 2)
    ) {
      if (tryUseAoeSkill()) {
        state.observerBot.lastDecision = "skill_aoe";
        return true;
      }
    }
    return false;
  }

  function evaluateObserverBotDashDirection(dx, dy) {
    const dashTier = getSkillTier("dash");
    const maxDashTiles = dashTier >= 2 ? 4 : 3;
    const furyMult = getFuryAttackPowerMultiplier();
    const dashRelicMult = getDashRelicDamageMultiplier();
    let dashDamage = Math.max(
      MIN_EFFECTIVE_DAMAGE,
      Math.round((getPlayerAttackForDamage({ includeChaos: false }) + scaledCombat(1)) * furyMult * dashRelicMult)
    );
    if (dashTier >= 1) {
      dashDamage = Math.max(MIN_EFFECTIVE_DAMAGE, dashDamage * 2);
    }
    const path = [];
    let cx = state.player.x;
    let cy = state.player.y;
    for (let i = 0; i < maxDashTiles; i += 1) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) break;
      if (getChestAt(nx, ny)) break;
      path.push({ x: nx, y: ny });
      cx = nx;
      cy = ny;
    }
    if (path.length <= 0) return null;

    let score = path.length * 2;
    let hits = 0;
    let kills = 0;
    const hitSet = new Set();
    let firstHitBoost = false;
    for (const step of path) {
      const enemy = getEnemyAt(step.x, step.y);
      if (!enemy || !state.enemies.includes(enemy) || hitSet.has(enemy)) continue;
      const strikeDamage =
        dashTier >= LEGENDARY_SKILL_TIER && !firstHitBoost
          ? Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(dashDamage * 1.6))
          : dashDamage;
      if (dashTier >= LEGENDARY_SKILL_TIER && !firstHitBoost) {
        firstHitBoost = true;
      }
      hits += 1;
      hitSet.add(enemy);
      score += 38;
      if ((Number(enemy.hp) || 0) <= strikeDamage) {
        kills += 1;
        score += 70;
      } else if ((Number(enemy.hp) || 0) <= strikeDamage * 1.4) {
        score += 22;
      }
    }
    if (dashTier >= 2) {
      const landing = path[path.length - 1];
      for (const enemy of state.enemies) {
        if (hitSet.has(enemy)) continue;
        if (Math.abs(enemy.x - landing.x) <= 1 && Math.abs(enemy.y - landing.y) <= 1) {
          score += 14;
        }
      }
    }
    if (!hasRelic("ironboots")) {
      for (const step of path) {
        if (isSpikeAt(step.x, step.y)) {
          score -= 9;
        }
      }
    }
    const landing = path[path.length - 1];
    const currentThreat = getBotEnemyCountWithinDistanceFrom(state.player.x, state.player.y, 1) * 1.5 +
      getBotEnemyCountWithinDistanceFrom(state.player.x, state.player.y, 2) * 0.5;
    const landingThreat = getBotEnemyCountWithinDistanceFrom(landing.x, landing.y, 1) * 1.5 +
      getBotEnemyCountWithinDistanceFrom(landing.x, landing.y, 2) * 0.5;
    score += Math.max(0, Math.round((currentThreat - landingThreat) * 10));
    if (!hasRelic("ironboots") && isSpikeAt(landing.x, landing.y)) {
      score -= 22;
    }
    return { dx, dy, score, hits, kills };
  }

  function maybeObserverBotUseDash() {
    if (getSkillCooldownRemaining("dash") > 0) return false;
    const candidates = [];
    for (const dir of BOT_CARDINAL_DIRECTIONS) {
      const evaluation = evaluateObserverBotDashDirection(dir.dx, dir.dy);
      if (evaluation) candidates.push(evaluation);
    }
    if (candidates.length <= 0) return false;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const hpRatio = getBotHpRatio();
    const closeThreat = getBotEnemyCountWithinDistanceFrom(state.player.x, state.player.y, 1);
    const threshold = closeThreat >= 2 || hpRatio < 0.55 ? 20 : (state.bossRoom ? 28 : 52);
    if (best.score < threshold) return false;
    if (tryUseDashSkill(best.dx, best.dy)) {
      state.observerBot.lastDecision = "skill_dash";
      return true;
    }
    return false;
  }

  function runObserverBotPlayingAction() {
    if (state.phase !== "playing") return false;
    const bot = state.observerBot;
    const roomChanged = bot.currentRoomIndex !== state.roomIndex;
    if (roomChanged) {
      bot.currentRoomIndex = state.roomIndex;
      bot.merchantPurchasesThisRoom = 0;
      bot.merchantDoneRoomIndex = bot.merchantDoneRoomIndex === state.roomIndex
        ? bot.merchantDoneRoomIndex
        : -1;
      bot.lastDecision = `room_${state.roomIndex}`;
      bot.lastPolicy = getObserverBotPolicyProfile().mode;
      resetObserverBotStallTracker();
    }
    getObserverBotEconomyPlan({ forceRefresh: roomChanged });

    if (state.extractConfirm) {
      confirmEmergencyExtract();
      bot.lastDecision = "emergency_extract_confirm";
      return true;
    }
    if (shouldObserverBotEmergencyExtractNow()) {
      openEmergencyExtractConfirm();
      confirmEmergencyExtract();
      bot.lastDecision = "emergency_extract";
      return true;
    }

    const merchantRoomActive = state.roomType === "merchant" && state.roomCleared && state.merchant;
    if (merchantRoomActive && bot.merchantDoneRoomIndex !== state.roomIndex) {
      if (!isOnMerchant()) {
        const merchantStep = findBotStepWithSpikePolicy(state.merchant.x, state.merchant.y, { context: "utility" });
        if (merchantStep) {
          tryMove(merchantStep.dx, merchantStep.dy);
          bot.lastDecision = "to_merchant";
          return true;
        }
      } else {
        if (runObserverMerchantAction()) {
          return true;
        }
        bot.merchantDoneRoomIndex = state.roomIndex;
        bot.lastDecision = "merchant_done";
      }
    }

    if (state.roomCleared) {
      resetObserverBotStallTracker();
      if (isOnShrine()) {
        activateShrine();
        bot.lastDecision = "use_shrine_post_clear";
        return true;
      }
      const shrineTarget = getNearestShrineForBot();
      if (shrineTarget) {
        const shrineStep = findBotStepWithSpikePolicy(shrineTarget.x, shrineTarget.y, { context: "utility" });
        if (shrineStep) {
          tryMove(shrineStep.dx, shrineStep.dy);
          bot.lastDecision = "to_shrine_post_clear";
          return true;
        }
      }
      const postClearChest = getNearestChestForBot();
      if (postClearChest) {
        const chestStep = findBotStepWithSpikePolicy(postClearChest.x, postClearChest.y, { context: "utility" });
        if (chestStep) {
          tryMove(chestStep.dx, chestStep.dy);
          bot.lastDecision = "to_chest_post_clear";
          return true;
        }
      }
      if (isOnPortal()) {
        if (shouldObserverBotExtractNow()) {
          extractRun();
          bot.lastDecision = "extract";
          return true;
        }
        attemptDescend();
        bot.lastDecision = "descend";
        return true;
      }
      const portalStep = findBotStepWithSpikePolicy(state.portal.x, state.portal.y, { context: "extract" });
      if (portalStep) {
        tryMove(portalStep.dx, portalStep.dy);
        bot.lastDecision = "to_portal";
        return true;
      }
      return false;
    }

    const forceAggro = shouldObserverBotForceAggro();

    if (isOnShrine()) {
      activateShrine();
      bot.lastDecision = "use_shrine";
      return true;
    }

    if (runSmartBotCombatAction({ forceAggro, updateObserverDecision: true })) {
      return true;
    }

    const fallbackStep = getFallbackStepForBot();
    if (fallbackStep) {
      tryMove(fallbackStep.dx, fallbackStep.dy);
      bot.lastDecision = "fallback_move";
      return true;
    }
    return false;
  }

  function chooseObserverBotCampStartDepth() {
    const options = getAvailableStartDepths();
    if (options.length <= 0) return 0;
    if (options.length === 1) return options[0];
    if (state.observerBot?.farmMode) return 0;
    const pressureStatus = getObserverBotDepthPressureStatus({ includeRunGold: false });
    if (pressureStatus.active) return 0;
    return options[options.length - 1];
  }

  function runObserverBotCampAction() {
    if (state.phase !== "camp") return false;
    if (state.extractRelicPrompt) {
      return resolveCampRelicPromptForBot();
    }
    const pressureStatus = getObserverBotDepthPressureStatus({ includeRunGold: false });
    if (pressureStatus.active && pressureStatus.ready) {
      clearObserverBotDepthPressure();
      pushLog(`Observer Bot: farm target reached. Retrying depth ${pressureStatus.pressureDepth}.`, "good");
    }
    const bestUpgradeIndex = chooseBestCampUpgradeIndexForBot();
    if (bestUpgradeIndex >= 0) {
      const upgrade = CAMP_UPGRADES[bestUpgradeIndex];
      const beforeLevel = getCampUpgradeLevel(upgrade.id);
      buyCampUpgrade(bestUpgradeIndex);
      const afterLevel = getCampUpgradeLevel(upgrade.id);
      if (afterLevel > beforeLevel) {
        state.observerBot.lastDecision = `camp_upgrade_${upgrade.id}`;
        return true;
      }
    }
    const startDepth = chooseObserverBotCampStartDepth();
    startRun({ carriedRelics: [...state.relics], startDepth });
    state.observerBot.lastDecision = "camp_start_run";
    return true;
  }

  function runObserverBotStep() {
    if (!isObserverBotActive()) return false;
    if (state.phase === "boot" || state.phase === "splash") return false;

    if (state.phase === "menu") {
      if (state.menuOptionsOpen || state.leaderboardModalOpen || state.nameModalOpen) return false;
      if (state.hasContinueRun && tryLoadRunSnapshot()) {
        state.observerBot.lastDecision = "load_continue";
        return true;
      }
      startRun({ carriedRelics: [...state.relics], resetMapFragments: true });
      state.observerBot.lastDecision = "menu_start_run";
      return true;
    }

    if (state.phase === "relic") {
      return runSmartBotRelicDecision();
    }

    if (state.phase === "camp") {
      return runObserverBotCampAction();
    }

    if (state.phase === "dead") {
      if (state.finalGameOverPrompt) {
        setObserverBotEnabled(false, { silent: true });
        pushLog("Observer Bot stopped: final GAME OVER reached.", "bad");
        return false;
      }
      startRun({ carriedRelics: [...state.relics] });
      state.observerBot.lastDecision = "restart_after_death";
      return true;
    }

    if (state.phase === "won") {
      enterMenu();
      state.observerBot.lastDecision = "post_win_menu";
      return true;
    }

    if (state.phase !== "playing") return false;
    if (isTurnInputLocked()) return false;
    return runObserverBotPlayingAction();
  }

  function updateObserverBot(dt) {
    if (!isObserverBotActive()) return;
    state.observerBot.actionTimerMs -= dt;
    if (state.observerBot.actionTimerMs > 0) return;
    const prevDecision = String(state.observerBot.lastDecision || "idle");
    const prevPhase = String(state.phase || "playing");
    const prevDepth = Math.max(0, Number(state.depth) || 0);
    const prevRoomIndex = Math.max(0, Number(state.roomIndex) || 0);
    const prevFarmMode = Boolean(state.observerBot.farmMode);
    state.observerBot.actionTimerMs = Math.max(30, Number(state.observerBot.actionIntervalMs) || 180);
    const acted = Boolean(runObserverBotStep());
    updateObserverBotLoopTracker();
    const nextDecision = String(state.observerBot.lastDecision || "idle");
    const nextPhase = String(state.phase || "playing");
    const nextDepth = Math.max(0, Number(state.depth) || 0);
    const nextRoomIndex = Math.max(0, Number(state.roomIndex) || 0);
    const decisionChanged = nextDecision !== prevDecision;
    const phaseChanged = nextPhase !== prevPhase;
    const depthChanged = nextDepth !== prevDepth;
    const roomChanged = nextRoomIndex !== prevRoomIndex;
    const farmModeChanged = Boolean(state.observerBot.farmMode) !== prevFarmMode;
    const traceTurn = Math.max(0, Number(state.turn) || 0);
    const periodicTick = traceTurn % OBSERVER_TRACE_TURN_INTERVAL === 0 &&
      traceTurn !== Math.max(-1, Number(state.observerBot.traceLastSampleTurn) || -1);
    if (acted || decisionChanged || phaseChanged || depthChanged || roomChanged || farmModeChanged || periodicTick) {
      appendObserverBotTrace("tick", {
        acted,
        decisionChanged,
        phaseChanged,
        depthChanged,
        roomChanged,
        farmModeChanged,
        prevDecision,
        nextDecision
      });
      state.observerBot.traceLastSampleTurn = traceTurn;
    }
  }

  // Console API: DungeonSimRunner.run({ runs: 1000, seed: "patch-xyz" })
  window.DungeonSimRunner = {
    run: runBalanceSimulation,
    regression: runObserverBotRegressionSuite,
    learn(options = {}) {
      const sourceReport = options && typeof options === "object" && options.report && typeof options.report === "object"
        ? options.report
        : window.DungeonLastSimReport;
      return learnObserverBotWeightsFromSimulation(sourceReport, options);
    },
    getModel() {
      return deepCloneValue(getObserverBotAiModel());
    },
    setLearningEnabled(enabled = true) {
      const model = getObserverBotAiModel();
      model.learningEnabled = Boolean(enabled);
      persistObserverBotAiModel();
      return deepCloneValue(model);
    },
    resetModel() {
      return deepCloneValue(resetObserverBotAiModel());
    },
    clearFarmMode() {
      clearObserverBotDepthPressure();
      return getObserverBotDepthPressureStatus({ includeRunGold: true });
    },
    getFarmMode() {
      return getObserverBotDepthPressureStatus({ includeRunGold: true });
    }
  };

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
      key === "b" ||
      key === "m" ||
      key === DEBUG_AI_OVERLAY_TOGGLE_KEY ||
      key === DEBUG_MENU_TOGGLE_KEY ||
      key === DEBUG_BOT_MENU_TOGGLE_KEY ||
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
      key === "v" ||
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

    if (key === DEBUG_AI_OVERLAY_TOGGLE_KEY) {
      toggleDebugAiOverlay();
      return;
    }

    if (canUseDebugCheats() && key === DEBUG_MENU_TOGGLE_KEY) {
      toggleDebugCheatMenu(null, { botOnly: false });
      return;
    }

    if (canUseDebugCheats() && key === DEBUG_BOT_MENU_TOGGLE_KEY) {
      toggleDebugCheatMenu(null, { botOnly: true });
      return;
    }

    if (canUseDebugCheats() && state.debugCheatOpen) {
      if (key === "escape") {
        toggleDebugCheatMenu(false);
        return;
      }
      if (state.debugCheatView === "relic_picker") {
        if (key === "r" || key === "backspace") {
          closeDebugRelicPicker();
          return;
        }
        if (key === "arrowleft" || key === "a") {
          shiftDebugRelicPickerPage(-1);
          return;
        }
        if (key === "arrowright" || key === "d") {
          shiftDebugRelicPickerPage(1);
          return;
        }
        if (key === "0") {
          if (tryDebugAddRelicBySlot(9)) return;
        }
        if (key >= "1" && key <= "9") {
          const slotIndex = Number(key) - 1;
          if (tryDebugAddRelicBySlot(slotIndex)) return;
        }
        return;
      }
      if (key === "arrowleft" || key === "a") {
        shiftDebugCheatSection(-1);
        return;
      }
      if (key === "arrowright" || key === "d") {
        shiftDebugCheatSection(1);
        return;
      }
      if (triggerDebugCheatHotkey(key)) {
        return;
      }
      return;
    }

    if (state.phase === "camp" && state.campStartDepthPromptOpen) {
      const options = getAvailableStartDepths();
      if (key === "arrowup" || key === "w") {
        state.campStartDepthSelectionIndex = (state.campStartDepthSelectionIndex - 1 + options.length) % options.length;
        markUiDirty();
        return;
      }
      if (key === "arrowdown" || key === "s") {
        state.campStartDepthSelectionIndex = (state.campStartDepthSelectionIndex + 1) % options.length;
        markUiDirty();
        return;
      }
      if (key >= "1" && key <= "9") {
        const index = Number(key) - 1;
        if (index >= 0 && index < options.length) {
          state.campStartDepthSelectionIndex = index;
          confirmCampStartDepthPrompt();
        }
        return;
      }
      if (isConfirm || key === "y" || key === "r") {
        confirmCampStartDepthPrompt();
        return;
      }
      if (key === "escape" || key === "n") {
        closeCampStartDepthPrompt();
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

    if (state.phase === "menu" && state.menuOptionsOpen) {
      if (key === "escape") {
        if (backFromMenuOptionsView()) return;
        closeMenuOptions();
        return;
      }
      if (key === "arrowup" || key === "w") {
        moveMenuOptionsSelection(-1);
        return;
      }
      if (key === "arrowdown" || key === "s") {
        moveMenuOptionsSelection(1);
        return;
      }
      if (isConfirm || key === "e") {
        activateMenuOptionsSelection();
        return;
      }
      if (state.menuOptionsView === "enemy_speed" && (key === "arrowleft" || key === "a")) {
        shiftEnemySpeedMode(-1);
        const idx = ENEMY_SPEED_MODES.indexOf(sanitizeEnemySpeedMode(state.enemySpeedMode));
        state.menuOptionsIndex = idx >= 0 ? idx : 1;
        markUiDirty();
        return;
      }
      if (state.menuOptionsView === "enemy_speed" && (key === "arrowright" || key === "d")) {
        shiftEnemySpeedMode(1);
        const idx = ENEMY_SPEED_MODES.indexOf(sanitizeEnemySpeedMode(state.enemySpeedMode));
        state.menuOptionsIndex = idx >= 0 ? idx : 1;
        markUiDirty();
        return;
      }
      if (state.menuOptionsView === "audio" && (key === "arrowleft" || key === "a")) {
        if (state.audioMuted) {
          toggleAudio();
        }
        state.menuOptionsIndex = 0;
        markUiDirty();
        return;
      }
      if (state.menuOptionsView === "audio" && (key === "arrowright" || key === "d")) {
        if (!state.audioMuted) {
          toggleAudio();
        }
        state.menuOptionsIndex = 1;
        markUiDirty();
        return;
      }
      if (key >= "1" && key <= "9") {
        const index = Number(key) - 1;
        if (state.menuOptionsView === "root") {
          const items = getMenuOptionsRootItems();
          if (index >= 0 && index < items.length) {
            state.menuOptionsIndex = index;
            activateMenuOptionsSelection(index);
          }
          return;
        }
        if (state.menuOptionsView === "enemy_speed") {
          if (index >= 0 && index < ENEMY_SPEED_MODES.length) {
            state.menuOptionsIndex = index;
            activateMenuOptionsSelection(index);
          }
          return;
        }
        if (state.menuOptionsView === "audio") {
          if (index >= 0 && index < getAudioOptionsItems().length) {
            state.menuOptionsIndex = index;
            activateMenuOptionsSelection(index);
          }
          return;
        }
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
      const prompt = state.extractRelicPrompt;
      const carriedRelics = getExtractPromptCarriedRelics(prompt);
      const relicHotkey = Number(key);
      if (Number.isInteger(relicHotkey) && relicHotkey >= 1 && relicHotkey <= 8) {
        const selectionIndex = relicHotkey - 1;
        if (selectionIndex < carriedRelics.length) {
          const selectedIndexSet = new Set(getExtractPromptSelectedIndices(prompt));
          if (selectedIndexSet.has(selectionIndex)) {
            selectedIndexSet.delete(selectionIndex);
          } else {
            selectedIndexSet.add(selectionIndex);
          }
          prompt.selectedIndices = sanitizeExtractRelicSelectionIndices(
            [...selectedIndexSet],
            carriedRelics.length
          );
          saveRunSnapshot();
          markUiDirty();
        }
        return;
      }
      if (key === "a") {
        prompt.selectedIndices = carriedRelics.map((_, index) => index);
        saveRunSnapshot();
        markUiDirty();
        return;
      }
      if (key === "c") {
        prompt.selectedIndices = [];
        saveRunSnapshot();
        markUiDirty();
        return;
      }
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

    if (state.phase === "won" && state.finalVictoryPrompt) {
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
      // Relic swap mode: player picks which relic to replace (inventory full)
      if (state.merchantRelicSwapPending) {
        const idx = parseInt(key, 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < state.relics.length) {
          tryMerchantRelicSwap(idx);
        }
        return;
      }
      // Black Market relic selection mode: pick which relic to trade up
      if (state.blackMarketPending) {
        const idx = parseInt(key, 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < state.blackMarketPending.length) {
          tryUseBlackMarket(state.blackMarketPending[idx]);
          state.blackMarketPending = null;
        }
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
      if (key === "5") {
        tryBuyRelicFromMerchant();
        return;
      }
      if (key === "6") {
        const s = state.merchantServiceSlot;
        if (s === "fullheal") {
          tryBuyFullHeal();
        } else if (s === "combatboost") {
          tryBuyCombatBoost();
        } else if (s === "secondchance") {
          tryBuySecondChance();
        } else if (s === "onelife") {
          tryBuyOneLife();
        } else if (s === "blackmarket") {
          if (state.blackMarketPending) {
            state.blackMarketPending = null;
            pushLog("Black Market: cancelled.", "neutral");
            markUiDirty();
          } else {
            const eligible = state.relics.filter(id => {
              const r = getRelicById(id);
              return r && (r.rarity === "normal" || r.rarity === "rare");
            });
            if (eligible.length === 0) {
              pushLog("Black Market: no eligible relics to trade (need Normal or Rare relic).", "bad");
            } else if (eligible.length === 1) {
              tryUseBlackMarket(eligible[0]);
            } else {
              state.blackMarketPending = eligible;
              pushLog(`Black Market: choose which relic to trade up (see shop). Press 6 or E/Esc to cancel.`, "neutral");
              markUiDirty();
            }
          }
        } else {
          pushLog("No service available today.", "bad");
        }
        return;
      }
      return;
    }

    if (key === "escape") {
      if (state.phase === "playing" || state.phase === "relic" || state.phase === "camp") {
        if (state.phase === "playing" && isTurnInputLocked()) {
          pushLog("Wait for turn resolution before opening menu.", "bad");
          return;
        }
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
      if (state.phase === "camp") {
        openCampStartDepthPrompt();
      } else if (state.phase === "dead") {
        startRun({ carriedRelics: [...state.relics], startDepth: 0 });
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

    if (isTurnInputLocked()) {
      return;
    }

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

  if (layoutTrackEl) {
    layoutTrackEl.addEventListener("pointerdown", onMobileSwipePointerDown, { passive: true });
    layoutTrackEl.addEventListener("pointermove", onMobileSwipePointerMove, { passive: true });
    layoutTrackEl.addEventListener("pointerup", onMobileSwipePointerEnd, { passive: true });
    layoutTrackEl.addEventListener("pointercancel", onMobileSwipePointerCancel, { passive: true });
  }
  window.addEventListener("pointerup", onMobileSwipePointerEnd, { passive: true });
  window.addEventListener("pointercancel", onMobileSwipePointerCancel, { passive: true });

  if (mobileMenuButtonEl) {
    mobileMenuButtonEl.addEventListener("click", () => {
      dismissMobileSwipeHint();
      openMainMenuFromMobileButton();
      syncMobileUiState({ forceBoard: true });
    });
  }

  // Mobile on-screen controls (D-pad + action buttons)
  function bindMobileButton(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("pointerdown", (e) => {
      mobileUi.buttonPointerIds.add(e.pointerId);
      ensureAudio();
      handler(e);
    });
    const clearId = (e) => { mobileUi.buttonPointerIds.delete(e.pointerId); };
    el.addEventListener("pointerup", clearId);
    el.addEventListener("pointercancel", clearId);
    el.addEventListener("pointerleave", clearId);
  }

  function mobileMoveHandler(dx, dy) {
    return () => {
      if (state.phase !== "playing") return;
      if (isTurnInputLocked()) return;
      if (state.dashAimActive) {
        tryUseDashSkill(dx, dy);
        return;
      }
      tryMove(dx, dy);
    };
  }

  bindMobileButton("mbtnUp", mobileMoveHandler(0, -1));
  bindMobileButton("mbtnDown", mobileMoveHandler(0, 1));
  bindMobileButton("mbtnLeft", mobileMoveHandler(-1, 0));
  bindMobileButton("mbtnRight", mobileMoveHandler(1, 0));

  bindMobileButton("mbtnZ", () => {
    if (state.phase !== "playing") return;
    if (isTurnInputLocked()) return;
    tryUseSkillByKey("z");
  });
  bindMobileButton("mbtnX", () => {
    if (state.phase !== "playing") return;
    if (isTurnInputLocked()) return;
    tryUseSkillByKey("x");
  });
  bindMobileButton("mbtnC", () => {
    if (state.phase !== "playing") return;
    if (isTurnInputLocked()) return;
    tryUseSkillByKey("c");
  });

  bindMobileButton("mbtnF", () => {
    if (state.phase !== "playing") return;
    if (isTurnInputLocked()) return;
    drinkPotion();
  });
  bindMobileButton("mbtnE", () => {
    if (state.phase !== "playing") return;
    if (isTurnInputLocked()) return;
    if (state.roomType === "merchant" && isOnMerchant()) {
      if (state.merchantMenuOpen) {
        closeMerchantMenu();
      } else {
        openMerchantMenu();
      }
      return;
    }
    attemptDescend();
  });
  bindMobileButton("mbtnQ", () => {
    if (state.phase !== "playing") return;
    if (isTurnInputLocked()) return;
    if (isOnPortal() && state.roomCleared) {
      extractRun();
    } else {
      openEmergencyExtractConfirm();
    }
  });
  bindMobileButton("mbtnR", () => {
    if (state.phase === "camp") {
      openCampStartDepthPrompt();
    } else if (state.phase === "dead") {
      startRun({ carriedRelics: [...state.relics], startDepth: 0 });
    }
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
      if (state.menuOptionsOpen) {
        closeMenuOptions();
        return;
      }
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

  function handleViewportChange() {
    updateCanvasScale();
    syncMobileUiState({ forceBoard: isScreenOverlayVisible() });
  }

  window.addEventListener("resize", handleViewportChange);
  if (mobileLayoutMedia) {
    if (typeof mobileLayoutMedia.addEventListener === "function") {
      mobileLayoutMedia.addEventListener("change", handleViewportChange);
    } else if (typeof mobileLayoutMedia.addListener === "function") {
      mobileLayoutMedia.addListener(handleViewportChange);
    }
  }

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
  loadMerchantSprite();
  loadShrineSprite();
  loadShieldSprite();
  loadSpikeSprite();
  loadDeepSpikeSprite();
  loadTilesetSprite();
  loadDeepTilesetSprite();
  loadTorchSprite();
  loadDeepTorchSprite();
  loadPlayerSprites();
  loadSlimeSprites();
  loadSkeletonSprites();
  loadBruteSprites();
  loadAcolyteSprite();
  loadSkitterSprite();
  loadGuardianSprite();
  loadWardenSprite();
  handleViewportChange();
  syncBgmWithState();
  markUiDirty();
  requestAnimationFrame(frame);
})();




