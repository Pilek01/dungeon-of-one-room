(function () {
  function shouldTriggerFinalBossPhaseShiftOnKill(options = {}) {
    const bossRoom = Boolean(options.bossRoom);
    const depth = Math.max(0, Math.floor(Number(options.depth) || 0));
    const finalBossPhase = Math.max(0, Math.floor(Number(options.finalBossPhase) || 0));
    const enemyType = String(options.enemyType || "").trim().toLowerCase();
    return bossRoom && depth >= 100 && finalBossPhase === 1 && enemyType === "warden";
  }

  const api = {
    shouldTriggerFinalBossPhaseShiftOnKill
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonFinalBossFlow = api;
  }
})();
