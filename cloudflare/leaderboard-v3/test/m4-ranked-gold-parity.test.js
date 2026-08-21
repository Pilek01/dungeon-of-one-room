import assert from "node:assert/strict";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { V08_LOCAL_ELITE_REWARD_BONUS } from "../src/domain/rank-eligibility.js";
import * as gamePatches from "../../../scripts/online-v3-game-patches.mjs";

const require = createRequire(import.meta.url);
const recorderApi = require("../../../online-v3/ranked-v3-recorder.js");

async function initialArenaEnemyRewardBonus({ onlineV3Ranked }) {
  assert.equal(
    typeof gamePatches.patchRankedArenaWaveGoldParity,
    "function",
    "the Pages build must expose the Ranked Arena parity patch"
  );
  const gameSource = await readFile(new URL("../../../game.js", import.meta.url), "utf8");
  const patched = gamePatches.patchRankedArenaWaveGoldParity(gameSource);
  const rewardDeclaration = patched.indexOf("    let roomEnemyRewardBonus = 0;");
  const arenaBranch = patched.indexOf('    if (state.roomType === "arena") {', rewardDeclaration);
  const nextBranch = patched.indexOf('    } else if (state.roomType === "ambush") {', arenaBranch);
  assert.ok(rewardDeclaration >= 0 && arenaBranch > rewardDeclaration && nextBranch > arenaBranch);
  const arenaSetup = patched.slice(arenaBranch, nextBranch).replace(/^    /gmu, "");
  const source = `
let roomEnemyRewardBonus = 0;
${arenaSetup}
}
const spawnedEnemy = createEnemy("skeleton", 1, 1, { elite: false });
if (roomEnemyRewardBonus > 0) {
  spawnedEnemy.rewardBonus = Math.max(0, Number(spawnedEnemy.rewardBonus) || 0) + roomEnemyRewardBonus;
}
result = spawnedEnemy.rewardBonus;`;
  const context = {
    ARENA_WAVE_COUNT: 2,
    createEnemy: (type, x, y, options = {}) => ({
      type,
      x,
      y,
      elite: Boolean(options.elite),
      hp: 10,
      maxHp: 10,
      rewardBonus: 0
    }),
    getArenaWaveEnemyCount: () => 1,
    pushLog: () => {},
    randInt: () => 1,
    state: {
      onlineV3Ranked,
      roomType: "arena",
      depth: 4,
      arena: null
    }
  };
  vm.runInNewContext(source, context);
  return context.result;
}

test("Ranked reward recorder preserves v0.8 room-clear and default combat gold", () => {
  assert.equal(recorderApi.roomClearBaseV08(4, "combat"), 4);

  const recorder = recorderApi.createRewardClaimRecorder();
  recorder.recordEnemy({ enemyType: "slime", elite: false });
  recorder.recordEnemy({ enemyType: "slime", elite: false });

  assert.deepEqual(recorder.snapshot(), [{
    claimType: "enemy",
    claimId: "enemy:slime",
    count: 2
  }]);
});

test("Ranked integrity elite adjustment stays bound to the v0.8 source bonus", async () => {
  const gameSource = await readFile(new URL("../../../game.js", import.meta.url), "utf8");
  assert.match(
    gameSource,
    new RegExp(`enemy\\.rewardBonus\\s*\\+=\\s*${V08_LOCAL_ELITE_REWARD_BONUS}`, "u")
  );
});

test("Ranked Arena wave one uses the canonical +2 enemy reward bonus", async () => {
  assert.equal(await initialArenaEnemyRewardBonus({ onlineV3Ranked: true }), 2);
});

test("Practice Arena keeps its existing initial-wave reward curve", async () => {
  assert.equal(await initialArenaEnemyRewardBonus({ onlineV3Ranked: false }), 0);
});

test("Ranked Arena parity patch is idempotent and wired into the Pages build", async () => {
  const gameSource = await readFile(new URL("../../../game.js", import.meta.url), "utf8");
  const patched = gamePatches.patchRankedArenaWaveGoldParity(gameSource);
  assert.equal(gamePatches.patchRankedArenaWaveGoldParity(patched), patched);

  const builder = await readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");
  assert.match(builder, /patchRankedArenaWaveGoldParity/u);
  assert.match(builder, /game = patchRankedArenaWaveGoldParity\(game\);/u);
});

test("Ranked Arena reserves the fourth elite slot for its forced second-wave elite", async () => {
  const gameSource = await readFile(new URL("../../../game.js", import.meta.url), "utf8");
  const patched = gamePatches.patchRankedArenaWaveGoldParity(gameSource);
  assert.match(
    patched,
    /eliteCount < \(state\.onlineV3Ranked && state\.roomType === "arena"\r?\n\s+\? MAX_ELITES_PER_ROOM - 1\r?\n\s+: MAX_ELITES_PER_ROOM\)/u
  );
});

test("Ranked reward recorder aggregates elite, hazard, and bounded chest evidence", () => {
  const recorder = recorderApi.createRewardClaimRecorder();
  recorder.recordEnemy({ enemyType: "skeleton", elite: true });
  recorder.recordHazard();
  const firstChest = recorder.openChest();
  const secondChest = recorder.openChest();
  const thirdChest = recorder.openChest();
  const fourthChest = recorder.openChest();
  recorder.recordChestGold(secondChest, 7);
  recorder.recordChestPotion(thirdChest, 1);
  recorder.recordChestMapFragment(fourthChest, 1);
  recorder.recordPotionUse();
  recorder.recordPotionUse();

  assert.deepEqual(recorder.snapshot(), [
    { claimType: "elite", claimId: "elite:skeleton", count: 1 },
    { claimType: "hazard", claimId: "hazard-kill", count: 1 },
    {
      claimType: "chest",
      claimId: firstChest,
      count: 1,
      localEvidence: { outcome: "opened" }
    },
    {
      claimType: "chest",
      claimId: secondChest,
      count: 1,
      localEvidence: { outcome: "gold", baseAmount: 7 }
    },
    {
      claimType: "chest",
      claimId: thirdChest,
      count: 1,
      localEvidence: { outcome: "potion", count: 1 }
    },
    {
      claimType: "chest",
      claimId: fourthChest,
      count: 1,
      localEvidence: { outcome: "map_fragment", count: 1 }
    },
    {
      claimType: "resource",
      claimId: "potion-use",
      count: 2
    }
  ]);
});

test("production build wires collected claims and the visible v0.8 room-clear bonus", async () => {
  const builder = await readFile(
    new URL("../../../scripts/build-pages-v3.mjs", import.meta.url),
    "utf8"
  );

  assert.match(builder, /ranked-v3-recorder\.js/u);
  assert.match(builder, /createRewardClaimRecorder/u);
  assert.match(builder, /recordEnemy/u);
  assert.match(builder, /recordHazard/u);
  assert.match(builder, /openChest/u);
  assert.match(builder, /recordChestGold/u);
  assert.match(builder, /recordChestPotion/u);
  assert.match(builder, /recordChestMapFragment/u);
  assert.match(builder, /recordPotionUse/u);
  assert.match(builder, /roomClearBaseV08/u);
  assert.match(builder, /Room clear bonus:/u);
  assert.match(builder, /rewardClaims: onlineV3RewardRecorder\?\.snapshot\(\) \|\| \[\]/u);
});
