import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

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

test("generated storage wrappers block Ranked writes and allow Practice writes", async () => {
  const game = await buildGeneratedGame();
  const shouldPersist = game.match(/  function shouldPersistToStorage\(\) \{[\s\S]*?\n  \}/u)?.[0] || "";
  const setStorage = game.match(/  function setStorageItem\([\s\S]*?\n  \}/u)?.[0] || "";
  const removeStorage = game.match(/  function removeStorageItem\([\s\S]*?\n  \}/u)?.[0] || "";
  assert.match(shouldPersist, /state\.onlineV3Ranked/u);
  assert.match(setStorage, /shouldPersistToStorage\(\)/u);
  assert.match(removeStorage, /shouldPersistToStorage\(\)/u);
  const writes = [];
  const context = {
    state: { onlineV3Ranked: true, simulation: { suppressPersistence: false } },
    isSimulationActive: () => false,
    warnStorageAccessError: () => {},
    localStorage: {
      setItem: (...args) => writes.push(["set", ...args]),
      removeItem: (...args) => writes.push(["remove", ...args])
    }
  };
  vm.runInNewContext(`${shouldPersist}\n${setStorage}\n${removeStorage}\nsetStorageItem("ranked", "blocked"); removeStorageItem("ranked");`, context);
  assert.deepEqual(writes, []);
  context.state.onlineV3Ranked = false;
  vm.runInNewContext('setStorageItem("practice", "allowed"); removeStorageItem("practice");', context);
  assert.deepEqual(writes, [["set", "practice", "allowed"], ["remove", "practice"]]);
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

test("canonical Ranked potion projection executes without mutating Fury or elixir fields", async () => {
  const game = await buildGeneratedGame();
  const projection = game.match(/  function syncRankedCanonicalPotionState\(publicState\) \{[\s\S]*?\n  \}/u)?.[0] || "";
  assert.match(projection, /state\.player\.maxPotions/u);
  assert.match(projection, /state\.player\.potions/u);
  assert.match(projection, /state\.runMods\.potionHealMult/u);
  const context = {
    state: {
      player: {
        potions: 99,
        maxPotions: 99,
        furyBlessingTurns: 7,
        elixirType: "fury_2",
        elixirTurns: 5,
        elixirAttackBonus: 12
      },
      elixirLoadout: { type: "fury_2", charges: 3 },
      runMods: { potionHealMult: 7 }
    },
    publicState: {
      potionPolicyVersion: "v1",
      build: { resources: { potions: 2, maxPotions: 5 } },
      runModifiers: { summary: { potionModifiers: { healMultiplier: 1.5 } } }
    },
    result: null
  };
  const before = structuredClone(context.state);
  vm.runInNewContext(projection + "\nresult = syncRankedCanonicalPotionState(publicState);", context);
  assert.equal(context.result, true);
  assert.equal(context.state.player.potions, 2);
  assert.equal(context.state.player.maxPotions, 5);
  assert.equal(context.state.runMods.potionHealMult, 1.5);
  assert.deepEqual(
    {
      furyBlessingTurns: context.state.player.furyBlessingTurns,
      elixirType: context.state.player.elixirType,
      elixirTurns: context.state.player.elixirTurns,
      elixirAttackBonus: context.state.player.elixirAttackBonus,
      elixirLoadout: context.state.elixirLoadout
    },
    {
      furyBlessingTurns: before.player.furyBlessingTurns,
      elixirType: before.player.elixirType,
      elixirTurns: before.player.elixirTurns,
      elixirAttackBonus: before.player.elixirAttackBonus,
      elixirLoadout: before.elixirLoadout
    }
  );
  assert.match(game, /if \(state\.onlineV3Ranked\) return;/u);
});
test("Practice return restores saved Practice meta state and clears Ranked boundary markers", async () => {
  const game = await buildGeneratedGame();
  const method = game.match(/    returnToPractice\(\) \{[\s\S]*?\n    \},\n    isRanked\(\)/u)?.[0]
    ?.replace(/,\n    isRanked\(\)[\s\S]*$/u, "") || "";
  assert.match(method, /state\.onlineV3Ranked = false/u);
  const storage = new Map([
    ["camp", { satchel: 2 }],
    ["skills", { dash: 3 }],
    ["elixir", { type: "iron_1", charges: 5 }]
  ]);
  const context = {
    mobileUi: { hintSeen: false },
    state: {
      onlineV3Ranked: true,
      onlineV3Directive: { directiveId: "ranked-room" },
      onlineV3NextDirective: { directiveId: "ranked-next" },
      onlineV3FatalPending: true,
      campUpgrades: { satchel: 5 },
      skillTiers: { dash: 1 },
      elixirLoadout: { type: "fury_2", charges: 1 },
      observerBot: {},
      player: { potions: 4, maxPotions: 6 }
    },
    STORAGE_CAMP_UPGRADES: "camp",
    STORAGE_SKILL_TIERS: "skills",
    STORAGE_ELIXIR_LOADOUT: "elixir",
    STORAGE_DEPTH: "depth",
    STORAGE_GOLD: "gold",
    STORAGE_DEATHS: "deaths",
    localStorage: { getItem: () => "0" },
    readJsonStorage: (key, fallback) => storage.has(key) ? structuredClone(storage.get(key)) : fallback,
    sanitizePlayerName: (value) => value,
    sanitizeLeaderboard: (value) => value,
    sanitizePendingLeaderboard: (value) => value,
    sanitizeObserverAiModel: (value) => value,
    sanitizeCampUpgrades: (value) => value,
    sanitizeSkillTiers: (value) => value,
    sanitizeElixirLoadout: (value) => value,
    sanitizeEnemySpeedMode: (value) => value,
    resetRunModifiers: () => {},
    resetSessionChestBonuses: () => { context.resetSessionChestBonusesCalled = true; },
    resetRankedCanonicalChestSlots: () => { context.resetRankedCanonicalChestSlotsCalled = true; },
    enterMenu: () => { context.enteredMenu = true; },
    bridge: null,
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    MAX_LIVES: 5
  };
  for (const key of new Set(method.match(/STORAGE_[A-Z0-9_]+/gu) || [])) if (!(key in context)) context[key] = key;
  for (const key of new Set(method.match(/\bsanitize[A-Z][A-Za-z0-9_]*/gu) || [])) if (!context[key]) context[key] = (value) => value;
  vm.runInNewContext("bridge = {" + method + "}", context);
  vm.runInNewContext("bridge.returnToPractice()", context);
  assert.equal(context.state.onlineV3Ranked, false);
  assert.equal(context.state.onlineV3Directive, null);
  assert.equal(context.state.onlineV3NextDirective, null);
  assert.equal(context.state.onlineV3FatalPending, false);
  assert.deepEqual(context.state.campUpgrades, { satchel: 2 });
  assert.deepEqual(context.state.skillTiers, { dash: 3 });
  assert.deepEqual(context.state.elixirLoadout, { type: "iron_1", charges: 5 });
  assert.deepEqual(
    { potions: context.state.player.potions, maxPotions: context.state.player.maxPotions },
    { potions: 4, maxPotions: 6 }
  );
  assert.equal(context.enteredMenu, true);
});
test("generated Practice load accepts an explicit zero potion count", async () => {
  const game = await buildGeneratedGame();
  assert.match(game, /const savedPotions = Number\(snapshot\.player\.potions\)/u);
  assert.match(game, /potions: Number\.isFinite\(savedPotions\) \? Math\.max\(0, savedPotions\) : 1/u);
  assert.match(game, /maxPotions: Number\.isFinite\(savedMaxPotions\) \? Math\.max\(1, savedMaxPotions\) : 5/u);
});
