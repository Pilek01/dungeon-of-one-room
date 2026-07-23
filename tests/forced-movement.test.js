const assert = require("node:assert/strict");

const {
  isEnemyImmuneToPlayerForcedMovement,
  canLandEnemyForcedMovement
} = require("../forced-movement.js");

function run() {
  assert.equal(isEnemyImmuneToPlayerForcedMovement({ type: "blacksmith_guardian" }), true);
  assert.equal(isEnemyImmuneToPlayerForcedMovement({ type: "guardian" }), false);

  const canLand = canLandEnemyForcedMovement({
    x: 4,
    y: 1,
    playerX: 4,
    playerY: 4,
    chests: [],
    enemies: [],
    targetEnemy: null,
    inBounds: () => true,
    isForgeBlockedTile: (x, y) => x === 4 && y === 1
  });
  assert.equal(canLand, false);

  const normalLand = canLandEnemyForcedMovement({
    x: 4,
    y: 2,
    playerX: 4,
    playerY: 4,
    chests: [],
    enemies: [],
    targetEnemy: null,
    inBounds: () => true,
    isForgeBlockedTile: () => false
  });
  assert.equal(normalLand, true);

  console.log("forced-movement tests: OK");
}

run();
