import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const recorderApi = require("../../../online-v3/ranked-v3-recorder.js");

async function settleSameGeneratedRankedEnemyTwice() {
  const root = new URL("../../..", import.meta.url);
  execFileSync(process.execPath, ["scripts/build-pages-v3.mjs", "--target", "test"], {
    cwd: root,
    stdio: "ignore"
  });

  const gameSource = await readFile(
    new URL("../../../output/pages-test-dist/game.js", import.meta.url),
    "utf8"
  );
  const start = gameSource.indexOf("  function killEnemy(");
  const end = gameSource.indexOf("  function getOtterRewardChest(", start);
  assert.ok(start >= 0 && end > start, "expected generated Ranked killEnemy runtime");
  const killEnemySource = gameSource.slice(start, end).replace(/^  /gmu, "");

  const recorder = recorderApi.createRewardClaimRecorder();
  const enemy = {
    type: "skeleton",
    name: "Elite Skeleton",
    x: 3,
    y: 4,
    elite: true,
    rewardBonus: 3
  };
  const state = {
    bossRoom: false,
    depth: 22,
    eliteKills: 0,
    eliteKillsThisRun: 0,
    enemies: [enemy],
    finalBossPhase: 0,
    killsThisRun: 0,
    player: {
      adrenaline: 0,
      gold: 0,
      maxAdrenaline: 5
    },
    roomType: "combat",
    runMods: { eliteGoldMult: 1 },
    totalKills: 0,
    wardensKilledThisGame: 0
  };
  const context = {
    STORAGE_ELITE_KILLS: "elite-kills",
    STORAGE_TOTAL_KILLS: "total-kills",
    applyShrineNoiseKnockbackOnKill: () => 0,
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    enemy,
    finalBossFlowApi: null,
    grantGold: (amount) => {
      state.player.gold += amount;
      return amount;
    },
    hasRelic: () => false,
    markUiDirty: () => {},
    onlineV3RewardRecorder: recorder,
    pushLog: () => {},
    queueTotemDeathBurstFromEnemy: () => {},
    queueVolatileBurstFromEnemy: () => {},
    releaseVaultChestsAfterGuardianDeath: () => {},
    removeEnemy: (target) => {
      state.enemies = state.enemies.filter((item) => item !== target);
    },
    result: null,
    rewardForEnemy: () => 7,
    setStorageItem: () => {},
    spawnParticles: () => {},
    state,
    syncMutatorUnlocks: () => {},
    triggerFinalBossPhaseShift: () => {}
  };

  vm.runInNewContext(`
${killEnemySource}
killEnemy(enemy, "first settlement");
killEnemy(enemy, "duplicate settlement");
result = {
  eliteKills: state.eliteKills,
  eliteKillsThisRun: state.eliteKillsThisRun,
  gold: state.player.gold,
  killsThisRun: state.killsThisRun,
  rewardClaims: onlineV3RewardRecorder.snapshot(),
  totalKills: state.totalKills
};
`, context);
  return JSON.parse(JSON.stringify(context.result));
}

test("generated Ranked combat settles one enemy at most once", async () => {
  assert.deepEqual(await settleSameGeneratedRankedEnemyTwice(), {
    eliteKills: 1,
    eliteKillsThisRun: 1,
    gold: 7,
    killsThisRun: 1,
    rewardClaims: [{
      claimType: "elite",
      claimId: "elite:skeleton",
      count: 1
    }],
    totalKills: 1
  });
});
