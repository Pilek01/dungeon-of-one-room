import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rankedRecorder = require("../online-v3/ranked-v3-recorder.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(root, "scripts", "build-pages-v3.mjs");

async function buildGeneratedGame() {
  if (buildGeneratedGame.promise) return buildGeneratedGame.promise;
  buildGeneratedGame.promise = (async () => {
  const built = spawnSync(process.execPath, [builder, "--target", "test"], {
    cwd: root,
    env: process.env,
    encoding: "utf8"
  });
  assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);
  return readFile(path.join(root, "output", "pages-test-dist", "game.js"), "utf8");
  })();
  return buildGeneratedGame.promise;
}

test("generated Ranked client isolates every Practice storage write and reloads Practice counters", async () => {
  const game = await buildGeneratedGame();
  const storageGate = game.match(/  function shouldPersistToStorage\(\) \{[\s\S]*?\n  \}/u)?.[0] || "";
  assert.match(storageGate, /state\.onlineV3Ranked/u);
  assert.match(storageGate, /return .*state\.onlineV3Ranked/u);

  const returnToPractice = game.match(/    returnToPractice\(\) \{[\s\S]*?\n    \},\n    isRanked\(\)/u)?.[0] || "";
  for (const key of [
    "STORAGE_TOTAL_GOLD",
    "STORAGE_TOTAL_KILLS",
    "STORAGE_ELITE_KILLS",
    "STORAGE_WARDENS_KILLED",
    "STORAGE_POTION_FREE_EXTRACT",
    "STORAGE_CAMP_GOLD",
    "STORAGE_LIVES",
    "STORAGE_CAMP_UPGRADES",
    "STORAGE_SKILL_TIERS",
    "STORAGE_ELIXIR_LOADOUT"
  ]) {
    assert.match(returnToPractice, new RegExp(key, "u"), `${key} is not restored on Ranked exit`);
  }
  assert.match(returnToPractice, /STORAGE_AUDIO_MUTED/u);
  assert.match(returnToPractice, /STORAGE_DEBUG_AI_OVERLAY/u);
  assert.match(returnToPractice, /STORAGE_ENEMY_SPEED/u);
  assert.match(returnToPractice, /STORAGE_MOBILE_SWIPE_HINT_SEEN/u);
  assert.match(returnToPractice, /state\.debugCheatOpen = false/u);
  assert.match(returnToPractice, /state\.debugGodMode = false/u);
});

test("generated Ranked debug and simulation storage paths stay guarded", async () => {
  const game = await buildGeneratedGame();
  const campRuntime = await readFile(path.join(root, "output", "pages-test-dist", "camp-runtime.js"), "utf8");
  const reset = game.match(/  function resetLocalGameDataForFirstTime\(\) \{[\s\S]*?\n  \}/u)?.[0] || "";
  assert.doesNotMatch(reset, /localStorage\.removeItem/u);
  assert.match(reset, /removeStorageItem\(key\)/u);

  const restore = game.match(/  function restoreLocalStorageSnapshot\(snapshot\) \{[\s\S]*?\n  \}/u)?.[0] || "";
  assert.match(restore, /if \(state\.onlineV3Ranked\) return;/u);
  assert.doesNotMatch(restore, /localStorage\.(?:removeItem|setItem)/u);
  assert.match(restore, /removeStorageItem\(key\)/u);
  assert.match(restore, /setStorageItem\(key,/u);
  assert.doesNotMatch(campRuntime, /localStorage\.(?:removeItem|setItem)/u);
  assert.match(game, /setStorageItem,\n    STORAGE_TOTAL_MERCHANT_POTS,/u);
  assert.equal(
    [...game.matchAll(/localStorage\.(?:removeItem|setItem)\(/gu)].length,
    2,
    "generated game should keep direct storage writes confined to guarded wrappers"
  );
});

test("generated Ranked client resumes canonical chest slots after consumed fatal settlement", async () => {
  const game = await buildGeneratedGame();
  assert.match(game, /slot\.consumed === true && sawUnconsumed/u);
  assert.match(game, /const firstUnconsumed = onlineV3CanonicalChestSlots\.findIndex/u);
  assert.match(game, /initialChestCount: consumedChestCount/u);
  assert.match(game, /resetRankedCanonicalChestSlots\(publicState\);/u);
  assert.doesNotMatch(
    game,
    /resetRankedBoundaryRecorder\(\) \{[\s\S]*?for \(const slot of onlineV3CanonicalChestSlots\) slot\.consumed = false/u
  );
});

test("Ranked reward recorder resumes chest claim IDs after consumed prefix", () => {
  const recorder = rankedRecorder.createRewardClaimRecorder({ initialChestCount: 1 });
  assert.equal(
    recorder.openChest({ awardId: "award_2", outcome: "map_fragment" }),
    "chest_2"
  );
  assert.equal(recorder.snapshot().find((claim) => claim.claimType === "chest")?.claimId, "chest_2");
});

test("generated Practice load accepts an explicit zero potion count", async () => {
  const game = await buildGeneratedGame();
  assert.match(game, /const savedPotions = Number\(snapshot\.player\.potions\)/u);
  assert.match(game, /potions: Number\.isFinite\(savedPotions\) \? Math\.max\(0, savedPotions\) : 1/u);
  assert.match(game, /maxPotions: Number\.isFinite\(savedMaxPotions\) \? Math\.max\(1, savedMaxPotions\) : 5/u);
});
