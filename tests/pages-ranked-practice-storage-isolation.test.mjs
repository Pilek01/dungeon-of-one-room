import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(root, "scripts", "build-pages-v3.mjs");

async function buildGeneratedGame() {
  const built = spawnSync(process.execPath, [builder, "--target", "test"], {
    cwd: root,
    env: process.env,
    encoding: "utf8"
  });
  assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);
  return readFile(path.join(root, "output", "pages-test-dist", "game.js"), "utf8");
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
});

test("generated Ranked client resumes canonical chest slots after consumed fatal settlement", async () => {
  const game = await buildGeneratedGame();
  assert.match(game, /slot\.consumed === true && sawUnconsumed/u);
  assert.match(game, /const firstUnconsumed = onlineV3CanonicalChestSlots\.findIndex/u);
  assert.match(game, /resetRankedCanonicalChestSlots\(publicState\);/u);
  assert.doesNotMatch(
    game,
    /resetRankedBoundaryRecorder\(\) \{[\s\S]*?for \(const slot of onlineV3CanonicalChestSlots\) slot\.consumed = false/u
  );
});
