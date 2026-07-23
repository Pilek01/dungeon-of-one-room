(function exposeRankedV3LeaderboardUi(root, factory) {
  "use strict";

  const api = factory();
  if (root) root.DungeonRankedV3LeaderboardUi = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createLeaderboardUiModule() {
  "use strict";

  const SELECTORS = Object.freeze({
    root: "ranked-v3-leaderboard",
    list: "ranked-v3-leaderboard-list",
    row: "ranked-v3-leaderboard-row",
    rank: "ranked-v3-leaderboard-rank",
    detailsButton: "ranked-v3-leaderboard-details-button",
    detail: "ranked-v3-leaderboard-detail",
    build: "ranked-v3-leaderboard-build",
    status: "ranked-v3-leaderboard-status"
  });

  function integer(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function normalizeBuild(value) {
    const build = value && typeof value === "object" ? value : {};
    return {
      relics: Array.isArray(build.relics)
        ? build.relics.map((relic) => ({
          id: String(relic?.id || ""),
          stacks: Math.max(1, integer(relic?.stacks))
        })).filter((relic) => relic.id)
        : [],
      mutators: Array.isArray(build.mutators)
        ? build.mutators.filter((id) => typeof id === "string")
        : [],
      skillTiers: build.skillTiers && typeof build.skillTiers === "object"
        ? { ...build.skillTiers }
        : {},
      elixirs: Array.isArray(build.elixirs)
        ? build.elixirs.filter((id) => typeof id === "string")
        : [],
      bossDepthSummary: Array.isArray(build.bossDepthSummary)
        ? build.bossDepthSummary.map((item) => ({ ...item }))
        : []
    };
  }

  function toLeaderboardRow(entry, index = 0) {
    return Object.freeze({
      entryId: String(entry?.entryId || ""),
      runId: String(entry?.runId || ""),
      rank: Math.max(1, integer(entry?.rank) || index + 1),
      playerName: String(entry?.playerName || "Anonymous"),
      score: integer(entry?.score),
      depth: integer(entry?.depth),
      gold: integer(entry?.gold),
      lives: integer(entry?.lives),
      bossesCleared: integer(entry?.bossesCleared),
      finishedAt: String(entry?.finishedAt || ""),
      gameVersion: String(entry?.gameVersion || ""),
      build: normalizeBuild(entry?.build)
    });
  }

  function createLeaderboardViewModel(payload = {}) {
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    return Object.freeze({
      season: String(payload.season || ""),
      status: String(payload.status || "ready"),
      rows: Object.freeze(entries.slice(0, 20).map(toLeaderboardRow))
    });
  }

  return Object.freeze({
    SELECTORS,
    normalizeBuild,
    toLeaderboardRow,
    createLeaderboardViewModel
  });
});
