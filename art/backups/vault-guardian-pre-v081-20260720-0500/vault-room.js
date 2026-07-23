(function () {
  const VAULT_GUARDIAN_HP_MULTIPLIER = 3;
  const VAULT_ENCOUNTER_PROFILE = Object.freeze({
    minMines: 4,
    maxMines: 7,
    minSpikes: 10,
    maxSpikes: 15,
    minChests: 7
  });

  function sign(value) {
    if (value > 0) return 1;
    if (value < 0) return -1;
    return 0;
  }

  function getVaultEncounterProfile() {
    return VAULT_ENCOUNTER_PROFILE;
  }

  function scoreGuardianSlamDirection(candidate, defaultDx, defaultDy) {
    if (!candidate || candidate.pushedTiles <= 0) return -Infinity;
    const mineBonus = candidate.mineHits * 120;
    const spikeBonus = candidate.spikeHits * 80;
    const hazardStepBonus = candidate.firstHazardStep > 0
      ? (3 - candidate.firstHazardStep) * 12
      : 0;
    const pushBonus = candidate.pushedTiles * 3;
    const defaultAlignment = candidate.dx === defaultDx && candidate.dy === defaultDy ? 4 : 0;
    return mineBonus + spikeBonus + hazardStepBonus + pushBonus + defaultAlignment;
  }

  function chooseGuardianSlamPlan(options = {}) {
    const enemyX = Number(options.enemyX) || 0;
    const enemyY = Number(options.enemyY) || 0;
    const playerX = Number(options.playerX) || 0;
    const playerY = Number(options.playerY) || 0;
    const maxPush = Math.max(1, Number(options.maxPush) || 2);
    const isBlocked = typeof options.isBlocked === "function" ? options.isBlocked : () => false;
    const hasSpike = typeof options.hasSpike === "function" ? options.hasSpike : () => false;
    const hasMine = typeof options.hasMine === "function" ? options.hasMine : () => false;

    const defaultDx = sign(playerX - enemyX);
    const defaultDy = sign(playerY - enemyY);
    const directions = [
      { dx: defaultDx, dy: defaultDy },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 }
    ].filter((dir, index, arr) => {
      if (dir.dx === 0 && dir.dy === 0) return false;
      return arr.findIndex((other) => other.dx === dir.dx && other.dy === dir.dy) === index;
    });

    let best = null;
    let bestScore = -Infinity;

    for (const direction of directions) {
      let x = playerX;
      let y = playerY;
      let pushedTiles = 0;
      let mineHits = 0;
      let spikeHits = 0;
      let firstHazardStep = 0;

      for (let step = 1; step <= maxPush; step += 1) {
        const nx = x + direction.dx;
        const ny = y + direction.dy;
        if (isBlocked(nx, ny)) break;
        x = nx;
        y = ny;
        pushedTiles += 1;
        const mine = Boolean(hasMine(x, y));
        const spike = Boolean(hasSpike(x, y));
        if (mine) mineHits += 1;
        if (spike) spikeHits += 1;
        if (!firstHazardStep && (mine || spike)) {
          firstHazardStep = step;
        }
      }

      const candidate = {
        dx: direction.dx,
        dy: direction.dy,
        pushedTiles,
        targetX: x,
        targetY: y,
        mineHits,
        spikeHits,
        firstHazardStep,
        hitsHazard: mineHits > 0 || spikeHits > 0
      };
      const score = scoreGuardianSlamDirection(candidate, defaultDx, defaultDy);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (!best || !best.hitsHazard) return null;
    return best;
  }

  const api = {
    VAULT_GUARDIAN_HP_MULTIPLIER,
    getVaultEncounterProfile,
    chooseGuardianSlamPlan
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonVaultRoom = api;
  }
})();
