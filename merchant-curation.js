(function () {
  function chooseMerchantRelicOffer(options = {}) {
    const tierPool = Array.isArray(options.tierPool) ? options.tierPool.filter(Boolean) : [];
    const random = typeof options.random === "function" ? options.random : Math.random;
    if (tierPool.length <= 0) {
      return { relic: null, tag: "", ranked: [], build: null };
    }
    const choiceIndex = Math.max(0, Math.min(tierPool.length - 1, Math.floor(random() * tierPool.length)));
    const relic = tierPool[choiceIndex] || tierPool[0] || null;
    return { relic, tag: "", ranked: tierPool.slice(), build: null };
  }

  const api = {
    chooseMerchantRelicOffer
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonMerchantCuration = api;
  }
})();
