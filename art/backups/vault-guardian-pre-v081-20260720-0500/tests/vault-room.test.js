const assert = require("node:assert/strict");

const {
  VAULT_GUARDIAN_HP_MULTIPLIER,
  getVaultEncounterProfile,
  chooseGuardianSlamPlan
} = require("../vault-room.js");

function run() {
  {
    assert.equal(VAULT_GUARDIAN_HP_MULTIPLIER, 3);
    assert.deepEqual(getVaultEncounterProfile(), {
      minMines: 4,
      maxMines: 7,
      minSpikes: 10,
      maxSpikes: 15,
      minChests: 7
    });
  }

  {
    const blocked = new Set();
    const spikes = new Set(["6,5"]);
    const mines = new Set(["7,5"]);
    const plan = chooseGuardianSlamPlan({
      enemyX: 4,
      enemyY: 5,
      playerX: 5,
      playerY: 5,
      maxPush: 2,
      isBlocked: (x, y) => blocked.has(`${x},${y}`),
      hasSpike: (x, y) => spikes.has(`${x},${y}`),
      hasMine: (x, y) => mines.has(`${x},${y}`)
    });
    assert.ok(plan);
    assert.equal(plan.dx, 1);
    assert.equal(plan.dy, 0);
    assert.equal(plan.pushedTiles, 2);
    assert.equal(plan.spikeHits, 1);
    assert.equal(plan.mineHits, 1);
    assert.equal(plan.targetX, 7);
    assert.equal(plan.targetY, 5);
  }

  {
    const blocked = new Set(["6,5"]);
    const spikes = new Set(["5,6"]);
    const mines = new Set();
    const plan = chooseGuardianSlamPlan({
      enemyX: 4,
      enemyY: 5,
      playerX: 5,
      playerY: 5,
      maxPush: 2,
      isBlocked: (x, y) => blocked.has(`${x},${y}`),
      hasSpike: (x, y) => spikes.has(`${x},${y}`),
      hasMine: (x, y) => mines.has(`${x},${y}`)
    });
    assert.ok(plan);
    assert.equal(plan.dx, 0);
    assert.equal(plan.dy, 1);
    assert.equal(plan.targetX, 5);
    assert.equal(plan.targetY, 7);
  }

  {
    const plan = chooseGuardianSlamPlan({
      enemyX: 4,
      enemyY: 5,
      playerX: 5,
      playerY: 5,
      maxPush: 2,
      isBlocked: () => false,
      hasSpike: () => false,
      hasMine: () => false
    });
    assert.equal(plan, null);
  }

  console.log("vault-room tests: OK");
}

run();
