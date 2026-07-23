(function () {
  const FORGE_PITY_DEPTH = 21;
  const OTTER_PITY_DEPTH = 41;

  function getGuaranteedCampaignRoom(options = {}) {
    const depth = Math.max(0, Math.floor(Number(options.depth) || 0));
    const bossDepth = Boolean(options.bossDepth);
    if (bossDepth) return "";

    const forgeSeenThisGame = Boolean(options.forgeSeenThisGame);
    const forgePityUsedThisGame = Boolean(options.forgePityUsedThisGame);
    if (depth === FORGE_PITY_DEPTH && !forgeSeenThisGame && !forgePityUsedThisGame) {
      return "forge";
    }

    const otterSeenThisGame = Boolean(options.otterSeenThisGame);
    const otterPityUsedThisGame = Boolean(options.otterPityUsedThisGame);
    if (depth === OTTER_PITY_DEPTH && !otterSeenThisGame && !otterPityUsedThisGame) {
      return "otter";
    }

    return "";
  }

  const api = {
    FORGE_PITY_DEPTH,
    OTTER_PITY_DEPTH,
    getGuaranteedCampaignRoom
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.roomPityApi = api;
  }
})();
