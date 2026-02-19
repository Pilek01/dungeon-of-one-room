// Single source of truth for current build version.
window.GAME_VERSION = "v0.2.15";

// Enable/disable debug cheat menu (F9).
// true  = cheats enabled
// false = cheats disabled
window.DUNGEON_DEBUG_CHEATS_ENABLED = true;

// Enable/disable test mode.
// true  = leaderboard fully disabled (no start/finalize/submit, no new entries)
// false = normal leaderboard behavior
window.DUNGEON_TEST_MODE = false;

// Optional online leaderboard endpoint.
// Example:
// window.DUNGEON_LEADERBOARD_API = "https://dungeon-one-room-leaderboard.<your-subdomain>.workers.dev";
window.DUNGEON_LEADERBOARD_API = "https://dungeon-one-room-leaderboard.pileksoftware.workers.dev";

// Current leaderboard season id (used by "Current Season" scope).
// Change this only on major balance resets, not every patch version.
window.DUNGEON_LEADERBOARD_SEASON = "season-3";
