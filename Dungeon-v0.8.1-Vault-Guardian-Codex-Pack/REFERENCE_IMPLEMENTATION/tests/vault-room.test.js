const assert = require("node:assert/strict");

const {
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
} = require("../vault-room.js");

function run() {
  {
    assert.equal(VAULT_GUARDIAN_HP_MULTIPLIER, 3);
    assert.equal(VAULT_GUARDIAN_SLAM_COOLDOWN_TURNS, 5);
    assert.equal(VAULT_SENTENCE_FIRST_DELAY_TURNS, 10);
    assert.equal(VAULT_SENTENCE_COOLDOWN_TURNS, 10);
    assert.equal(VAULT_SENTENCE_FUSE_TURNS, 5);
    assert.equal(VAULT_LOCKDOWN_FIRST_DELAY_TURNS, 4);
    assert.equal(VAULT_LOCKDOWN_COOLDOWN_TURNS, 10);
    assert.equal(VAULT_LOCKDOWN_TARGET_COUNT, 2);
    assert.equal(VAULT_LOCKDOWN_DAMAGE_MULTIPLIER, 0.65);
    assert.equal(VAULT_LOCKDOWN_PUSH_TILES, 1);
    assert.deepEqual(getVaultEncounterProfile(), {
      minMines: 4,
      maxMines: 7,
      minSpikes: 10,
      maxSpikes: 15,
      minChests: 7
    });
  }

  {
    const guardian = initializeVaultGuardianState({ type: "guardian" });
    assert.equal(guardian.vaultSentenceCooldown, 10);
    assert.equal(guardian.vaultLockdownCooldown, 4);
    assert.equal(guardian.vaultLockdownAiming, false);
    assert.deepEqual(guardian.vaultLockdownTargets, []);
    assert.equal(guardian.vaultChestDestroyedTurn, -1);

    const restored = initializeVaultGuardianState({
      type: "guardian",
      vaultSentenceCooldown: 3,
      vaultLockdownCooldown: 2,
      vaultLockdownAiming: true,
      vaultLockdownTargets: [{ x: 2.4, y: 5.6 }, null, { x: "bad", y: 3 }],
      vaultChestDestroyedTurn: 42
    });
    assert.equal(restored.vaultSentenceCooldown, 3);
    assert.equal(restored.vaultLockdownCooldown, 2);
    assert.equal(restored.vaultLockdownAiming, true);
    assert.deepEqual(restored.vaultLockdownTargets, [{ x: 2, y: 6 }]);
    assert.equal(restored.vaultChestDestroyedTurn, 42);
  }

  {
    const chest = sanitizeVaultChestState({
      x: 2,
      y: 3,
      opened: false,
      destroyed: false,
      vaultCondemned: true,
      vaultCondemnTurns: 99,
      vaultCondemnMaxTurns: 99
    });
    assert.equal(isVaultChestAvailable(chest), true);
    assert.equal(chest.vaultCondemnTurns, 5);
    assert.equal(chest.vaultCondemnMaxTurns, 5);
    assert.equal(isVaultChestLocked({ roomType: "vault", guardianAlive: true, chest }), true);
    assert.equal(isVaultChestLocked({ roomType: "vault", guardianAlive: false, chest }), false);

    const destroyed = sanitizeVaultChestState({ opened: false, destroyed: true, vaultCondemned: true });
    assert.equal(destroyed.opened, true);
    assert.equal(destroyed.vaultCondemned, false);
    assert.equal(isVaultChestAvailable(destroyed), false);
  }

  {
    const chests = [
      { x: 1, y: 1, opened: false },
      { x: 2, y: 2, opened: false, vaultCondemned: true },
      { x: 3, y: 3, opened: true },
      { x: 4, y: 4, opened: false },
      { x: 5, y: 5, opened: false, destroyed: true }
    ];
    const target = chooseVaultSentenceChest({
      chests,
      lockdownTargets: [{ x: 1, y: 1 }],
      random: () => 0
    });
    assert.deepEqual(target, chests[3]);
    assert.equal(chooseVaultSentenceChest({ chests: [], random: () => 0 }), null);
  }

  {
    const targets = chooseVaultLockdownTargets({
      chests: [
        { x: 4, y: 5, opened: false },
        { x: 4, y: 6, opened: false },
        { x: 1, y: 1, opened: false },
        { x: 7, y: 7, opened: false },
        { x: 2, y: 2, opened: false, vaultCondemned: true }
      ],
      playerX: 4,
      playerY: 4,
      count: 2
    });
    assert.deepEqual(targets[0], { x: 4, y: 5 });
    assert.equal(targets.length, 2);
    assert.deepEqual(targets[1], { x: 1, y: 1 });
  }

  {
    const tiles = getVaultLockdownBlastTiles([{ x: 1, y: 1 }, { x: 2, y: 1 }], 9);
    const keys = new Set(tiles.map((tile) => `${tile.x},${tile.y}`));
    assert.equal(keys.size, tiles.length);
    assert.ok(keys.has("1,1"));
    assert.ok(keys.has("0,1"));
    assert.ok(keys.has("2,1"));
    assert.ok(keys.has("3,1"));
    assert.ok(keys.has("1,0"));
    assert.ok(keys.has("2,2"));
  }

  {
    const guardian = initializeVaultGuardianState({ type: "guardian" });
    guardian.vaultSentenceCooldown = 2;
    guardian.vaultLockdownCooldown = 3;
    assert.equal(shouldReserveGuardianMajorAbility(guardian, 20), false);
    guardian.vaultSentenceCooldown = 1;
    assert.equal(shouldReserveGuardianMajorAbility(guardian, 20), true);
    guardian.vaultSentenceCooldown = 5;
    guardian.vaultChestDestroyedTurn = 20;
    assert.equal(shouldReserveGuardianMajorAbility(guardian, 20), true);
    guardian.vaultChestDestroyedTurn = 19;
    guardian.vaultLockdownAiming = true;
    assert.equal(shouldReserveGuardianMajorAbility(guardian, 20), true);
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
