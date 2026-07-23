function isEnemyImmuneToPlayerForcedMovement(enemy) {
  return String(enemy?.type || "") === "blacksmith_guardian";
}

function canLandEnemyForcedMovement({
  x,
  y,
  playerX,
  playerY,
  chests,
  enemies,
  targetEnemy,
  inBounds,
  isForgeBlockedTile
}) {
  if (!inBounds(x, y)) return false;
  if (x === playerX && y === playerY) return false;
  if (typeof isForgeBlockedTile === "function" && isForgeBlockedTile(x, y)) return false;
  if (Array.isArray(chests) && chests.some((chest) => !chest.opened && chest.x === x && chest.y === y)) {
    return false;
  }
  if (Array.isArray(enemies) && enemies.some((enemy) => enemy !== targetEnemy && enemy.x === x && enemy.y === y)) {
    return false;
  }
  return true;
}

const forcedMovementApi = {
  isEnemyImmuneToPlayerForcedMovement,
  canLandEnemyForcedMovement
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = forcedMovementApi;
}

if (typeof globalThis !== "undefined") {
  globalThis.forcedMovementApi = forcedMovementApi;
}
