(function () {
  const VAULT_GUARDIAN_HP_MULTIPLIER = 3;
  const VAULT_GUARDIAN_SLAM_COOLDOWN_TURNS = 5;
  const VAULT_SENTENCE_FIRST_DELAY_TURNS = 10;
  const VAULT_SENTENCE_COOLDOWN_TURNS = 10;
  const VAULT_SENTENCE_FUSE_TURNS = 5;
  const VAULT_LOCKDOWN_FIRST_DELAY_TURNS = 4;
  const VAULT_LOCKDOWN_COOLDOWN_TURNS = 10;
  const VAULT_LOCKDOWN_TARGET_COUNT = 2;
  const VAULT_LOCKDOWN_DAMAGE_MULTIPLIER = 0.65;
  const VAULT_LOCKDOWN_PUSH_TILES = 1;

  const VAULT_ENCOUNTER_PROFILE = Object.freeze({
    minMines: 4,
    maxMines: 7,
    minFrostRunes: 2,
    maxFrostRunes: 3,
    minSpikes: 10,
    maxSpikes: 15,
    minChests: 7
  });

  function sign(value) {
    if (value > 0) return 1;
    if (value < 0) return -1;
    return 0;
  }

  function clampInt(value, minimum, maximum) {
    const numeric = Math.round(Number(value) || 0);
    return Math.max(minimum, Math.min(maximum, numeric));
  }

  function chestKey(chest) {
    return `${Math.round(Number(chest?.x) || 0)},${Math.round(Number(chest?.y) || 0)}`;
  }

  function getVaultEncounterProfile() {
    return VAULT_ENCOUNTER_PROFILE;
  }

  function isVaultChestAvailable(chest) {
    return Boolean(chest && !chest.opened && !chest.destroyed);
  }

  function isVaultChestLocked(options = {}) {
    return Boolean(
      options.roomType === "vault" &&
      options.guardianAlive &&
      isVaultChestAvailable(options.chest)
    );
  }

  function initializeVaultGuardianState(enemy) {
    if (!enemy || enemy.type !== "guardian") return enemy;
    enemy.vaultSentenceCooldown = Math.max(
      0,
      Number.isFinite(Number(enemy.vaultSentenceCooldown))
        ? Math.round(Number(enemy.vaultSentenceCooldown))
        : VAULT_SENTENCE_FIRST_DELAY_TURNS
    );
    enemy.vaultLockdownCooldown = Math.max(
      0,
      Number.isFinite(Number(enemy.vaultLockdownCooldown))
        ? Math.round(Number(enemy.vaultLockdownCooldown))
        : VAULT_LOCKDOWN_FIRST_DELAY_TURNS
    );
    enemy.vaultLockdownAiming = Boolean(enemy.vaultLockdownAiming);
    enemy.vaultLockdownTargets = Array.isArray(enemy.vaultLockdownTargets)
      ? enemy.vaultLockdownTargets
        .filter((tile) => tile && Number.isFinite(Number(tile.x)) && Number.isFinite(Number(tile.y)))
        .map((tile) => ({ x: Math.round(Number(tile.x)), y: Math.round(Number(tile.y)) }))
        .slice(0, VAULT_LOCKDOWN_TARGET_COUNT)
      : [];
    enemy.vaultChestDestroyedTurn = Number.isFinite(Number(enemy.vaultChestDestroyedTurn))
      ? Math.round(Number(enemy.vaultChestDestroyedTurn))
      : -1;
    return enemy;
  }

  function sanitizeVaultChestState(chest) {
    if (!chest || typeof chest !== "object") return chest;
    chest.destroyed = Boolean(chest.destroyed);
    chest.vaultCondemned = Boolean(chest.vaultCondemned) && !chest.destroyed && !chest.opened;
    chest.vaultCondemnTurns = chest.vaultCondemned
      ? clampInt(chest.vaultCondemnTurns, 0, VAULT_SENTENCE_FUSE_TURNS)
      : 0;
    chest.vaultCondemnMaxTurns = chest.vaultCondemned
      ? Math.max(1, clampInt(chest.vaultCondemnMaxTurns || VAULT_SENTENCE_FUSE_TURNS, 1, VAULT_SENTENCE_FUSE_TURNS))
      : 0;
    if (chest.destroyed) chest.opened = true;
    return chest;
  }

  function chooseVaultSentenceChest(options = {}) {
    const chests = Array.isArray(options.chests) ? options.chests : [];
    const targetKeys = new Set(
      (Array.isArray(options.lockdownTargets) ? options.lockdownTargets : []).map(chestKey)
    );
    const candidates = chests
      .filter((chest) =>
        isVaultChestAvailable(chest) &&
        !chest.vaultCondemned &&
        !targetKeys.has(chestKey(chest))
      )
      .slice()
      .sort((a, b) => (Number(a.y) - Number(b.y)) || (Number(a.x) - Number(b.x)));
    if (candidates.length <= 0) return null;
    const random = typeof options.random === "function" ? options.random : Math.random;
    const roll = Math.max(0, Math.min(0.999999, Number(random()) || 0));
    return candidates[Math.floor(roll * candidates.length)] || candidates[0];
  }

  function chooseVaultLockdownTargets(options = {}) {
    const chests = Array.isArray(options.chests) ? options.chests : [];
    const playerX = Number(options.playerX) || 0;
    const playerY = Number(options.playerY) || 0;
    const count = Math.max(1, Math.floor(Number(options.count) || VAULT_LOCKDOWN_TARGET_COUNT));
    const candidates = chests
      .filter((chest) => isVaultChestAvailable(chest) && !chest.vaultCondemned)
      .map((chest) => ({
        x: Math.round(Number(chest.x) || 0),
        y: Math.round(Number(chest.y) || 0),
        playerDistance: Math.abs((Number(chest.x) || 0) - playerX) + Math.abs((Number(chest.y) || 0) - playerY)
      }))
      .sort((a, b) => a.playerDistance - b.playerDistance || a.y - b.y || a.x - b.x);
    if (candidates.length <= 0) return [];

    const selected = [candidates.shift()];
    while (selected.length < count && candidates.length > 0) {
      let bestIndex = 0;
      let bestScore = -Infinity;
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const separation = Math.min(...selected.map((picked) =>
          Math.abs(candidate.x - picked.x) + Math.abs(candidate.y - picked.y)
        ));
        // Prefer readable, separated telegraphs while still keeping pressure near the player.
        const score = separation * 20 - candidate.playerDistance * 2 - candidate.y * 0.01 - candidate.x * 0.001;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
      selected.push(candidates.splice(bestIndex, 1)[0]);
    }
    return selected.map(({ x, y }) => ({ x, y }));
  }

  function getVaultLockdownBlastTiles(targets, gridSize = 9) {
    const size = Math.max(1, Math.floor(Number(gridSize) || 9));
    const seen = new Set();
    const tiles = [];
    for (const target of Array.isArray(targets) ? targets : []) {
      if (!target) continue;
      const x = Math.round(Number(target.x) || 0);
      const y = Math.round(Number(target.y) || 0);
      const cross = [
        { x, y },
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      ];
      for (const tile of cross) {
        if (tile.x < 0 || tile.x >= size || tile.y < 0 || tile.y >= size) continue;
        const key = chestKey(tile);
        if (seen.has(key)) continue;
        seen.add(key);
        tiles.push(tile);
      }
    }
    return tiles;
  }

  function shouldReserveGuardianMajorAbility(enemy, currentTurn) {
    if (!enemy || enemy.type !== "guardian") return false;
    initializeVaultGuardianState(enemy);
    if (enemy.vaultLockdownAiming) return true;
    if (enemy.vaultSentenceCooldown <= 1) return true;
    if (enemy.vaultLockdownCooldown <= 1) return true;
    return Number(enemy.vaultChestDestroyedTurn) === Number(currentTurn);
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
    VAULT_GUARDIAN_SLAM_COOLDOWN_TURNS,
    VAULT_SENTENCE_FIRST_DELAY_TURNS,
    VAULT_SENTENCE_COOLDOWN_TURNS,
    VAULT_SENTENCE_FUSE_TURNS,
    VAULT_LOCKDOWN_FIRST_DELAY_TURNS,
    VAULT_LOCKDOWN_COOLDOWN_TURNS,
    VAULT_LOCKDOWN_TARGET_COUNT,
    VAULT_LOCKDOWN_DAMAGE_MULTIPLIER,
    VAULT_LOCKDOWN_PUSH_TILES,
    getVaultEncounterProfile,
    isVaultChestAvailable,
    isVaultChestLocked,
    initializeVaultGuardianState,
    sanitizeVaultChestState,
    chooseVaultSentenceChest,
    chooseVaultLockdownTargets,
    getVaultLockdownBlastTiles,
    shouldReserveGuardianMajorAbility,
    chooseGuardianSlamPlan
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonVaultRoom = api;
  }
})();
