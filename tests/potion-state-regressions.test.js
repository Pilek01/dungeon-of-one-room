import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gamePath = new URL("../game.js", import.meta.url);
const builderPath = new URL("../scripts/build-pages-v3.mjs", import.meta.url);

test("Practice snapshot parsing preserves zero potions and clamps only to one slot", async () => {
  const game = await readFile(gamePath, "utf8");
  const savedPotions = game.match(/const savedPotions = Number\(snapshot\.player\.potions\);/u)?.[0];
  const savedMaxPotions = game.match(/const savedMaxPotions = Number\(snapshot\.player\.maxPotions\);/u)?.[0];
  const potionsField = game.match(/^\s+potions: Number\.isFinite\(savedPotions\) \? Math\.max\(0, savedPotions\) : 1,/mu)?.[0]?.trim();
  const maxPotionsField = game.match(/^\s+maxPotions: Number\.isFinite\(savedMaxPotions\) \? Math\.max\(1, savedMaxPotions\) : 5,/mu)?.[0]?.trim();
  assert.ok(savedPotions && savedMaxPotions && potionsField && maxPotionsField);
  const context = { result: null, snapshot: { player: { potions: 0, maxPotions: 2 } } };
  vm.runInNewContext(`${savedPotions}\n${savedMaxPotions}\nconst player = { ${potionsField} ${maxPotionsField} }; result = player;`, context);
  assert.deepEqual({ potions: context.result.potions, maxPotions: context.result.maxPotions }, { potions: 0, maxPotions: 2 });
  const fallbackContext = { result: null, snapshot: { player: {} } };
  vm.runInNewContext(`${savedPotions}\n${savedMaxPotions}\nconst player = { ${potionsField} ${maxPotionsField} }; result = player;`, fallbackContext);
  assert.deepEqual({ potions: fallbackContext.result.potions, maxPotions: fallbackContext.result.maxPotions }, { potions: 1, maxPotions: 5 });
});

test("Ranked potion projection is absolute, capability-gated, and multiplier-safe", async () => {
  const builder = await readFile(builderPath, "utf8");
  assert.match(builder, /function syncRankedCanonicalPotionState\(publicState\)/u);
  const start = builder.indexOf("function syncRankedCanonicalPotionState(publicState)");
  const end = builder.indexOf("\n  function syncRankedCanonicalRelics", start);
  assert.ok(start >= 0 && end > start, "expected canonical potion projection helper");
  const helper = builder.slice(start, end);
  assert.match(helper, /publicState\.potionPolicyVersion !== "v1"/u);
  assert.match(helper, /RANKED_POTION_POLICY_MARKER_INVALID/u);
  assert.match(helper, /Number\.isSafeInteger\(canonicalPotions\)/u);
  assert.match(helper, /Number\.isSafeInteger\(canonicalMaxPotions\)/u);
  assert.match(helper, /state\.player\.potions = Math\.min\(canonicalMaxPotions, canonicalPotions\)/u);
  assert.match(helper, /state\.runMods\.potionHealMult = canonicalHealMultiplier/u);
  assert.doesNotMatch(helper, /state\.player\.potionHealMultiplier\s*\*=/u);
  const context = {
    state: { player: { potions: 99, maxPotions: 99 }, runMods: { potionHealMult: 7 } },
    canonical: { potionPolicyVersion: "v1", build: { resources: { potions: 4, maxPotions: 5 } }, runModifiers: { summary: { potionModifiers: { healMultiplier: 1.5 } } } },
    result: null
  };
  vm.runInNewContext(helper, context);
  vm.runInNewContext("result = syncRankedCanonicalPotionState(canonical);", context);
  assert.equal(context.result, true);
  assert.equal(context.state.player.potions, 4);
  assert.equal(context.state.player.maxPotions, 5);
  assert.equal(context.state.runMods.potionHealMult, 1.5);
  vm.runInNewContext("result = syncRankedCanonicalPotionState(canonical);", context);
  assert.equal(context.result, true);
  assert.equal(context.state.player.potions, 4);
  assert.equal(context.state.player.maxPotions, 5);
  assert.equal(context.state.runMods.potionHealMult, 1.5);
  context.canonical = { ...context.canonical, build: { resources: { potions: 1, maxPotions: 2 } }, runModifiers: { summary: { potionModifiers: { healMultiplier: 2 } } } };
  vm.runInNewContext("result = syncRankedCanonicalPotionState(canonical);", context);
  assert.equal(context.result, true);
  assert.equal(context.state.player.potions, 1);
  assert.equal(context.state.player.maxPotions, 2);
  assert.equal(context.state.runMods.potionHealMult, 2);
  vm.runInNewContext("result = syncRankedCanonicalPotionState({});", context);
  assert.equal(context.result, false);
  assert.equal(context.state.player.potions, 1);
  assert.equal(context.state.player.maxPotions, 2);
  assert.throws(() => vm.runInNewContext("syncRankedCanonicalPotionState({ potionPolicyVersion: \"v2\" });", context), /RANKED_POTION_POLICY_MARKER_INVALID/u);
  const invalidCases = [
    { potionPolicyVersion: "v1", build: { resources: { potions: Number.MAX_SAFE_INTEGER + 1, maxPotions: 2 } }, runModifiers: context.canonical.runModifiers },
    { potionPolicyVersion: "v1", build: { resources: { potions: -1, maxPotions: 2 } }, runModifiers: context.canonical.runModifiers },
    { potionPolicyVersion: "v1", build: { resources: { potions: 1.5, maxPotions: 2 } }, runModifiers: context.canonical.runModifiers },
    { potionPolicyVersion: "v1", build: { resources: { potions: 1, maxPotions: 0 } }, runModifiers: context.canonical.runModifiers },
    { potionPolicyVersion: "v1", build: { resources: { potions: 1, maxPotions: 2.5 } }, runModifiers: context.canonical.runModifiers },
    { potionPolicyVersion: "v1", build: { resources: { potions: 1, maxPotions: 2 } }, runModifiers: { summary: { potionModifiers: { healMultiplier: 0 } } } },
    { potionPolicyVersion: "v1", build: { resources: { potions: 1, maxPotions: 2 } }, runModifiers: { summary: { potionModifiers: { healMultiplier: -1 } } } },
    { potionPolicyVersion: "v1", build: { resources: { potions: 1, maxPotions: 2 } }, runModifiers: { summary: { potionModifiers: { healMultiplier: NaN } } } }
  ];
  context.invalidCases = invalidCases;
  for (const invalidCase of invalidCases) {
    context.invalidCase = invalidCase;
    assert.throws(() => vm.runInNewContext("syncRankedCanonicalPotionState(invalidCase);", context), /RANKED_CANONICAL_POTION_STATE_INVALID/u);
  }
});

test("Room and chest potion messages report only the integer grant", async () => {
  const [game, builder] = await Promise.all([
    readFile(gamePath, "utf8"),
    readFile(builderPath, "utf8")
  ]);
  assert.match(game, /const gained = grantPotion\(1\)/u);
  assert.match(game, /gained > 0/u);
  assert.match(builder, /const gained = grantPotion\(1\)/u);
  assert.match(builder, /gained > 0/u);
  const roomStart = game.indexOf("      const gained = grantPotion(1);");
  const roomEnd = game.indexOf("\n    } else {", roomStart);
  const chestStart = game.indexOf("        const gained = grantPotion(1);");
  const chestEnd = game.indexOf("\n      }\n    } else if (chestOutcome.outcome === \"map_fragment\")", chestStart);
  assert.ok(roomStart >= 0 && roomEnd > roomStart && chestStart >= 0 && chestEnd > chestStart);
  const runRewardSnippet = (snippet, gained) => {
    const context = { scaled: 7, grantPotion: () => gained, result: null, pushLog: (message) => { context.result = message; } };
    vm.runInNewContext(snippet.replace(/^    /gmu, "") + "\nresult = result;", context);
    return context.result;
  };
  const roomEmpty = runRewardSnippet(game.slice(roomStart, roomEnd), 0);
  const roomGained = runRewardSnippet(game.slice(roomStart, roomEnd), 1);
  assert.equal(roomEmpty, "Room clear bonus: +7 gold.");
  assert.doesNotMatch(roomEmpty, /\+1 potion/u);
  assert.match(roomGained, /\+1 potion/u);
  const chestEmpty = runRewardSnippet(game.slice(chestStart, chestEnd), 0);
  const chestGained = runRewardSnippet(game.slice(chestStart, chestEnd), 1);
  assert.match(chestEmpty, /potion bag already full/u);
  assert.doesNotMatch(chestEmpty, /\+1 potion/u);
  assert.equal(chestGained, "Chest: +1 potion.");
  const grantStart = game.indexOf("  function grantPotion(count = 1)");
  const grantEnd = game.indexOf("  function isBonfireFloorTile", grantStart);
  const grantContext = { state: { player: { potions: 2, maxPotions: 2 } }, result: null };
});

test("Oath lock preserves the activation turn and blocks exactly three later turns", async () => {
  const game = await readFile(gamePath, "utf8");
  assert.match(game, /oathPotionLockAppliedTurn:/u);
  assert.match(game, /if \(state\.player\.oathPotionLockAppliedTurn === state\.turn\)/u);
  assert.match(game, /state\.player\.oathPotionLockAppliedTurn = -1/u);
  assert.match(game, /state\.player\.oathPotionLockTurns = OATH_OF_RUIN_POTION_LOCK_TURNS/u);
  assert.match(game, /if \(\(state\.player\.oathPotionLockTurns \|\| 0\) > 0\) return false/u);
  const tickStart = game.indexOf("  function tickOathPotionLock()");
  const tickEnd = game.indexOf("  function drainOathBarrierCost", tickStart);
  const drinkStart = game.indexOf("  function drinkPotion()");
  const drinkEnd = game.indexOf("  function attemptDescend", drinkStart);
  const context = {
    state: { turn: 1, phase: "playing", player: { potions: 2, maxPotions: 2, hp: 10, maxHp: 20, oathPotionLockTurns: 3, oathPotionLockAppliedTurn: 1 } },
    hasRelic: () => false,
    pushLog: () => {},
    result: null
  };
  const extracted = `${game.slice(tickStart, tickEnd).replace(/^  /gmu, "")}\n${game.slice(drinkStart, drinkEnd).replace(/^  /gmu, "")}`;
  vm.runInNewContext(`${extracted}\nresult = []; tickOathPotionLock(); result.push(state.player.oathPotionLockTurns); for (const turn of [2, 3, 4]) { state.turn = turn; drinkPotion(); result.push(state.player.oathPotionLockTurns); tickOathPotionLock(); }`, context);
  assert.deepEqual(Array.from(context.result), [3, 3, 2, 1]);
  assert.equal(context.state.player.potions, 2, "all three later attempts remain blocked");
  assert.equal(context.state.player.oathPotionLockTurns, 0);
});
