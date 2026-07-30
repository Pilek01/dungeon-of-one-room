import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const recorderApi = require("../../../online-v3/ranked-v3-recorder.js");

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
