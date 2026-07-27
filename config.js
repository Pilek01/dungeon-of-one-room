// Single source of truth for current build version.
window.GAME_VERSION = "v0.8.0";
window.DUNGEON_FORK_ID = "dungeon v2";

// Enable/disable debug cheat menu (F9).
// true  = cheats enabled
// false = cheats disabled
window.DUNGEON_DEBUG_CHEATS_ENABLED = true;

// Enable/disable test mode.
// true  = leaderboard fully disabled (no start/finalize/submit, no new entries)
// false = normal leaderboard behavior
window.DUNGEON_TEST_MODE = true;

// Shipping 64 px HD renderer. Set to false only for legacy fallback diagnostics.
window.DUNGEON_HD_GRAPHICS_ENABLED = true;

// Observer bot behavior profile.
// "safe"       = defensywny (mniej zgonów, częstszy extract)
// "balanced"   = środek
// "aggressive" = większe ryzyko i szybszy push
window.DUNGEON_BOT_PROFILE = "safe";

// Legacy aggregate-score uploads are permanently disabled. Ranked v1 uses a
// separate server-authoritative client and remains closed until its audited
// cutover; never place a production endpoint in this legacy variable.
window.DUNGEON_LEADERBOARD_API = "";

// Current leaderboard season id (used by "Current Season" scope).
// Change this only on major balance resets, not every patch version.
window.DUNGEON_LEADERBOARD_SEASON = "season-1";

// Online v3 production values are injected only into the Pages build output.
window.DUNGEON_ONLINE_V3_API = "";
window.DUNGEON_ONLINE_V3_SEASON = "local-m4";
window.DUNGEON_ONLINE_V3_DEBUG = false;
