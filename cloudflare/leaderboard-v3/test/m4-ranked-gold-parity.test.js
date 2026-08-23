import assert from "node:assert/strict";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { V08_LOCAL_ELITE_REWARD_BONUS } from "../src/domain/rank-eligibility.js";
import {
  calculateChestGoldV08,
  calculateEnemyGoldV08
} from "../src/rulesets/v08-meta-1/gold-policy.js";
import * as gamePatches from "../../../scripts/online-v3-game-patches.mjs";

const require = createRequire(import.meta.url);
const recorderApi = require("../../../online-v3/ranked-v3-recorder.js");
const protocolApi = require("../../../online-v3/ranked-v3-protocol.js");

function runModifierLedger(...modifierIds) {
  const active = [...modifierIds].sort().map((modifierId) => ({
    modifierId,
    stacks: 1,
    activatedRevision: 0,
    activationSource: "server-issued-run-start"
  }));
  return {
    active,
    activeCount: active.length,
    modifierDigest: `sha256:${"0".repeat(64)}`,
    derivedEffectsVersion: "v08-run-modifier-effects-1"
  };
}

async function localRankedGoldProjection(modifierIds) {
  const gameSource = await readFile(new URL("../../../game.js", import.meta.url), "utf8");
  const extractFunction = (name, nextName) => {
    const start = gameSource.indexOf(`  function ${name}(`);
    const end = gameSource.indexOf(`  function ${nextName}(`, start);
    assert.ok(start >= 0 && end > start, `Could not extract ${name}`);
    return gameSource.slice(start, end).replace(/^  /gmu, "");
  };
  const context = {
    result: null,
    state: {
      player: {
        attack: 20,
        maxHp: 100,
        hp: 100,
        armor: 0,
        crit: 0.1,
        potions: 1,
        maxPotions: 5,
        gold: 0
      },
      runMods: {},
      runGoldEarned: 0,
      totalGoldEarned: 0
    },
    MUTATORS: modifierIds.map((id) => ({ id })),
    isMutatorActive: (id) => modifierIds.includes(id),
    scaledCombat: (amount) => amount * 10,
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    CRIT_CHANCE_CAP: 0.55,
    getBountyContractMultiplier: () => 1.3,
    getPactGoldGainMultiplier: () => 1.4,
    setStorageItem: () => {},
    STORAGE_TOTAL_GOLD: "test"
  };
  vm.runInNewContext(`
${extractFunction("resetRunModifiers", "applyCampUpgradesToRun")}
${extractFunction("applyMutatorsToRun", "applyMutatorMidRun")}
${extractFunction("grantGold", "grantPotion")}
${extractFunction("rewardForEnemy", "tryKnockbackEnemyFromPoint")}
applyMutatorsToRun();
state.runMods.goldMultiplier += 0.15;
const normalBase = rewardForEnemy({ type: "skeleton", elite: false, rewardBonus: 0 });
const eliteBase = rewardForEnemy({ type: "skeleton", elite: true, rewardBonus: 0 });
const normal = grantGold(normalBase);
state.player.gold = 0;
const elite = grantGold(eliteBase);
state.player.gold = 0;
const chest = grantGold(Math.round(8 * 1.4));
result = { runMods: { ...state.runMods }, normal, elite, chest };
`, context);
  return context.result;
}

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

test("Ranked start rebuilds local modifier and pact effects from the canonical build", async () => {
  const gameSource = await readFile(new URL("../../../game.js", import.meta.url), "utf8");
  const builder = await readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(
    gameSource,
    /if \(!state\.onlineV3Ranked\) \{\s*applyMutatorsToRun\(\);\s*applyPersistentPactsToRun\(\);\s*\}/u,
    "Ranked must reset and apply numeric run effects instead of inheriting stale runMods"
  );
  assert.match(
    gameSource,
    /applyCampUpgradesToRun\(\);\s*applyMutatorsToRun\(\);\s*applyPersistentPactsToRun\(\);/u
  );
  assert.match(
    builder,
    /const canonicalPacts = \(Array\.isArray\(publicState\?\.build\?\.pacts\)[\s\S]*state\.activePacts = canonicalPacts;/u,
    "the Pages bridge must hydrate canonical pacts before the run starts"
  );
  assert.match(
    builder,
    /state\.observerBot\.unlimitedGold = false;[\s\S]*startRun\(/u,
    "Ranked must not inherit the Observer Bot unlimited-gold test toggle"
  );
  assert.match(
    builder,
    /returnToPractice\(\)[\s\S]*STORAGE_MUT_ACTIVE[\s\S]*STORAGE_MUT_UNLOCK[\s\S]*state\.activePacts = \[\];/u,
    "returning to Practice must restore local mutators and clear the Ranked pact"
  );
});

test("three mutators compose with Camp enemy and chest upgrades in canonical rounding order", async () => {
  const canonicalRunModifiers = runModifierLedger("berserker", "elitist", "greed");
  const canonicalBuild = {
    relics: [{ relicId: "idol", stacks: 1 }],
    pacts: ["avarice"],
    campUpgrades: {
      bounty_contract: 3,
      treasure_sense: 4
    }
  };

  assert.equal(calculateEnemyGoldV08({
    canonicalBuild,
    canonicalRunModifiers,
    enemyType: "skeleton",
    elite: false
  }), 11);
  assert.equal(calculateEnemyGoldV08({
    canonicalBuild,
    canonicalRunModifiers,
    enemyType: "skeleton",
    elite: true
  }), 16);
  assert.equal(calculateChestGoldV08({
    canonicalBuild,
    canonicalRunModifiers,
    baseAmount: 8
  }), 30);

  const local = await localRankedGoldProjection(["berserker", "elitist", "greed"]);
  assert.ok(Math.abs(local.runMods.goldMultiplier - 1.95) < 1e-12);
  assert.equal(local.runMods.eliteGoldMult, 1.6);
  assert.deepEqual(
    { normal: local.normal, elite: local.elite, chest: local.chest },
    { normal: 11, elite: 16, chest: 30 }
  );
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

test("canonical chest recorder seals exact award evidence and rejects mismatched helpers", () => {
  const recorder = recorderApi.createRewardClaimRecorder();
  const canonical = recorder.openChest({ awardId: "award_health_1", outcome: "health" });
  assert.equal(recorder.recordChestGold(canonical, 7), false);
  assert.equal(recorder.recordChestPotion(canonical, 1), false);
  const gold = recorder.openChest({ awardId: "award_gold_1", outcome: "gold" });
  assert.equal(recorder.recordChestGold(gold, 7), true);
  assert.deepEqual(recorder.snapshot(), [{
    claimType: "chest",
    claimId: canonical,
    count: 1,
    localEvidence: { outcome: "health", awardId: "award_health_1" }
  }, {
    claimType: "chest",
    claimId: gold,
    count: 1,
    localEvidence: {
      outcome: "gold",
      awardId: "award_gold_1",
      baseAmount: 7
    }
  }]);
  assert.deepEqual(recorder.snapshot()[1].localEvidence, {
    outcome: "gold",
    awardId: "award_gold_1",
    baseAmount: 7
  });
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

test("production bridge consumes ordered canonical chest outcomes", async () => {
  const builder = await readFile(
    new URL("../../../scripts/build-pages-v3.mjs", import.meta.url),
    "utf8"
  );
  assert.match(builder, /currentRewardEnvelope[\s\S]*claimSlots/u);
  assert.match(builder, /canonicalOutcome/u);
  assert.match(builder, /resetRankedCanonicalChestSlots/u);
  assert.match(builder, /getRankedCanonicalChestOutcome/u);
  assert.match(builder, /applyRankedCanonicalChestStatOutcome/u);
});

test("protocol fails closed when the canonical marker strips an ordinary slot outcome", () => {
  const state = {
    runId: "run_protocol_marker",
    rulesetId: protocolApi.RULESET_ID,
    rulesetHash: protocolApi.RULESET_HASH,
    protocolVersion: protocolApi.PROTOCOL_VERSION,
    revision: 0,
    status: "active",
    currentRewardEnvelope: {
      envelopeId: "reward_protocol_marker",
      canonicalChestOutcomesVersion: "v1",
      roomType: "combat",
      claimSlots: [{ slotId: "chest_1", consumed: false }]
    }
  };
  assert.throws(() => protocolApi.validateMetaState(state), /claimSlots\.canonicalOutcome/u);
});

test("markerless canonical envelopes remain legacy-compatible", () => {
  const state = {
    runId: "run_protocol_legacy",
    rulesetId: protocolApi.RULESET_ID,
    rulesetHash: protocolApi.RULESET_HASH,
    protocolVersion: protocolApi.PROTOCOL_VERSION,
    revision: 0,
    status: "active",
    currentRewardEnvelope: {
      envelopeId: "reward_protocol_legacy",
      roomType: "combat",
      claimSlots: [{
        slotId: "chest_1",
        consumed: false,
        canonicalOutcome: { awardId: "legacy_award", outcome: "health" }
      }, {
        slotId: "chest_2",
        consumed: false
      }]
    }
  };
  assert.equal(protocolApi.validateMetaState(state), state);
});

test("canonical issued health bypasses a stale capped local bucket without fallback gold", async () => {
  let generated;
  try {
    generated = await readFile(new URL("../../../output/pages-test-dist/game.js", import.meta.url), "utf8");
  } catch {
    execFileSync(process.execPath, ["scripts/build-pages-v3.mjs", "--target", "test"], {
      cwd: new URL("../../../", import.meta.url),
      stdio: "ignore"
    });
    generated = await readFile(new URL("../../../output/pages-test-dist/game.js", import.meta.url), "utf8");
  }
  const start = generated.indexOf("  function applyRankedCanonicalChestStatOutcome(");
  const end = generated.indexOf("  function handleChestHealingDrop(", start);
  assert.ok(start >= 0 && end > start);
  const helper = generated.slice(start, end).replace(/^  /gmu, "");
  const context = {
    state: {
      onlineV3Ranked: true,
      sessionChestHealthDepthBuckets: { "0": 5 },
      sessionChestHealthFlat: 0,
      player: { maxHp: 100, hp: 80 }
    },
    CHEST_ATTACK_BUCKET_MAX: 5,
    getRankedSpecialRoomScalingDepth: () => 1,
    getChestAttackBucketIndex: () => 0,
    getChestAttackBucketLabel: () => "0-9",
    getChestHealthBucketCount: () => 5,
    getChestHealthUpgradeFlatByDepth: () => 7,
    pushTestModeLog: () => {},
    pushLog: () => {}
  };
  vm.runInNewContext(helper, context);
  assert.equal(context.applyRankedCanonicalChestStatOutcome("health", false), true);
  assert.equal(context.state.player.maxHp, 107);
  assert.equal(context.state.player.hp, 87);
  assert.equal(context.state.sessionChestHealthFlat, 7);
  assert.equal(context.state.sessionChestHealthDepthBuckets["0"], 5);
  assert.equal(context.state.player.gold, undefined);
});
