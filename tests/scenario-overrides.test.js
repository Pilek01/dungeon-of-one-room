const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const file = path.resolve(__dirname, "..", "scenario-overrides.js");
const code = fs.readFileSync(file, "utf8");
const sandbox = { window: {}, URLSearchParams, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: file });
const api = sandbox.window.DungeonScenarioOverrides;
const EXPECTED_DESCENT_HD_FLOOR_PATTERN = [
  [0, 1, 6, 8, 9, 8, 6, 1, 0],
  [1, 3, 0, 6, 8, 6, 0, 3, 1],
  [6, 0, 1, 8, 9, 8, 1, 0, 6],
  [8, 6, 8, 0, 1, 0, 8, 6, 8],
  [9, 8, 3, 1, 0, 1, 3, 8, 9],
  [8, 6, 8, 0, 1, 0, 8, 6, 8],
  [6, 0, 1, 8, 9, 8, 1, 0, 6],
  [1, 3, 0, 6, 8, 6, 0, 3, 1],
  [0, 1, 6, 8, 9, 8, 6, 1, 0]
];
const EXPECTED_FLOOR_VARIANT_PATTERN = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 2, 3, 4, 5, 6, 0],
  [0, 7, 8, 9, 0, 1, 2, 3, 0],
  [0, 4, 5, 6, 7, 8, 9, 0, 0],
  [0, 1, 2, 3, 4, 5, 6, 7, 0],
  [0, 8, 9, 0, 1, 2, 3, 4, 0],
  [0, 5, 6, 7, 8, 9, 0, 1, 0],
  [0, 2, 3, 4, 5, 6, 7, 8, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0]
];

assert(api, "DungeonScenarioOverrides should be defined");
assert.strictEqual(typeof api.parseScenarioRequest, "function", "parseScenarioRequest should exist");

const forge = api.parseScenarioRequest("?scenario=forge", { maxDepth: 100 });
assert(forge, "forge scenario should parse");
assert.strictEqual(forge.id, "forge");
assert.strictEqual(forge.autoStart, true);
assert.strictEqual(forge.depth, 24);
assert.strictEqual(forge.forcedNextRoomType, "forge");

const forgeTransmute = api.parseScenarioRequest("?scenario=forge_transmute", { maxDepth: 100 });
assert(forgeTransmute, "forge_transmute scenario should parse");
assert.strictEqual(forgeTransmute.id, "forge_transmute");
assert.strictEqual(forgeTransmute.depth, 24);
assert.strictEqual(forgeTransmute.forcedNextRoomType, "forge");
assert.strictEqual(forgeTransmute.forceForgeTransmuteSetup, true);

const pact = api.parseScenarioRequest("?scenario=pact", { maxDepth: 100 });
assert(pact, "pact scenario should parse");
assert.strictEqual(pact.id, "pact");
assert.strictEqual(pact.depth, 34);
assert.strictEqual(pact.forcedNextRoomType, "pact");

const descentHd = api.parseScenarioRequest("?scenario=descent_hd", { maxDepth: 100 });
assert(descentHd, "descent_hd scenario should parse");
assert.strictEqual(descentHd.id, "descent_hd");
assert.strictEqual(descentHd.autoStart, true);
assert.strictEqual(descentHd.depth, 1);
assert.strictEqual(descentHd.forcedNextRoomType, "shrine");
assert.strictEqual(descentHd.forceDescentHDShowcaseSetup, true);
assert(Array.isArray(descentHd.floorPattern), "descent_hd must expose its fixed floor pattern");
assert.deepStrictEqual(JSON.parse(JSON.stringify(descentHd.floorPattern)), EXPECTED_DESCENT_HD_FLOOR_PATTERN);

for (const [theme, depth] of [["descent", 1], ["corruption", 25], ["abyss", 45]]) {
  const id = `${theme}_floor_variants_hd`;
  const scenario = api.parseScenarioRequest(`?scenario=${id}`, { maxDepth: 100 });
  assert(scenario, `${id} scenario should parse`);
  assert.strictEqual(scenario.depth, depth);
  assert.strictEqual(scenario.roomType, "combat");
  assert.strictEqual(scenario.forceRoomHDShowcaseSetup, true);
  assert.strictEqual(scenario.floorVariantShowcase, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(scenario.floorPattern)), EXPECTED_FLOOR_VARIANT_PATTERN);
  assert.deepStrictEqual(
    [...new Set(scenario.floorPattern.flat())].sort((left, right) => left - right),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    `${id} must expose every Classic semantic floor value`
  );
  let randomCalls = 0;
  const built = api.createFloorPatternForScenario(scenario, () => {
    randomCalls += 1;
    return [];
  });
  assert.strictEqual(randomCalls, 0, `${id} must not consume gameplay RNG`);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(built)), EXPECTED_FLOOR_VARIANT_PATTERN);
}

for (const [id, kind] of [["player_shield_hd", "shield"], ["player_barrier_hd", "barrier"]]) {
  const protection = api.parseScenarioRequest(`?scenario=${id}`, { maxDepth: 100 });
  assert(protection, `${id} scenario should parse`);
  assert.strictEqual(protection.id, id);
  assert.strictEqual(protection.autoStart, true);
  assert.strictEqual(protection.forcePlayerProtectionHDShowcaseSetup, kind);
  assert(Array.isArray(protection.floorPattern), `${id} must expose its fixed floor pattern`);
}

const enemyRosterHd = api.parseScenarioRequest("?scenario=enemy_roster_hd", { maxDepth: 100 });
assert(enemyRosterHd, "enemy_roster_hd scenario should parse");
assert.strictEqual(enemyRosterHd.id, "enemy_roster_hd");
assert.strictEqual(enemyRosterHd.autoStart, true);
assert.strictEqual(enemyRosterHd.depth, 1);
assert.strictEqual(enemyRosterHd.forcedNextRoomType, "combat");
assert.strictEqual(enemyRosterHd.forceEnemyHDShowcaseSetup, true);

const statusEmblemsHd = api.parseScenarioRequest("?scenario=status_emblems_hd", { maxDepth: 100 });
assert(statusEmblemsHd, "status_emblems_hd scenario should parse");
assert.strictEqual(statusEmblemsHd.id, "status_emblems_hd");
assert.strictEqual(statusEmblemsHd.autoStart, true);
assert.strictEqual(statusEmblemsHd.depth, 25);
assert.strictEqual(statusEmblemsHd.forcedNextRoomType, "combat");
assert.strictEqual(statusEmblemsHd.forceStatusEmblemsHDShowcaseSetup, true);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(statusEmblemsHd.statusCoverage)),
  {
    player: ["bleed", "poison", "shield", "barrier", "fury", "shrine_blessing", "elixir"],
    enemy: ["freeze", "burn", "disorient", "enemy_buff"],
    crests: ["elite", "relentless", "juggernaut", "blooddrinker", "thorned", "volatile"]
  }
);

const actorProportionsHd = api.parseScenarioRequest("?scenario=actor_proportions_hd", { maxDepth: 100 });
assert(actorProportionsHd, "actor_proportions_hd scenario should parse");
assert.strictEqual(actorProportionsHd.id, "actor_proportions_hd");
assert.strictEqual(actorProportionsHd.autoStart, true);
assert.strictEqual(actorProportionsHd.depth, 25);
assert.strictEqual(actorProportionsHd.roomType, "merchant");
assert.strictEqual(actorProportionsHd.forcedNextRoomType, "merchant");
assert.strictEqual(actorProportionsHd.forceActorProportionsHDShowcaseSetup, true);
assert(Array.isArray(actorProportionsHd.floorPattern), "actor proportions must use a fixed floor pattern");
assert(!actorProportionsHd.floorPattern.flat().includes(3), "actor proportions must not place braziers behind comparison actors");

let scenarioPatternRandomCalls = 0;
const scenarioPattern = api.createFloorPatternForScenario(descentHd, () => {
  scenarioPatternRandomCalls += 1;
  throw new Error("descent_hd must not consume floor RNG");
});
assert.strictEqual(scenarioPatternRandomCalls, 0);
assert.deepStrictEqual(JSON.parse(JSON.stringify(scenarioPattern)), EXPECTED_DESCENT_HD_FLOOR_PATTERN);
scenarioPattern[0][0] = 99;
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(api.createFloorPatternForScenario(descentHd, () => []))),
  EXPECTED_DESCENT_HD_FLOOR_PATTERN,
  "each deterministic scenario pattern must be an independent clone"
);

let normalPatternRandomCalls = 0;
const normalPattern = api.createFloorPatternForScenario(forge, () => {
  normalPatternRandomCalls += 1;
  return [[7]];
});
assert.strictEqual(normalPatternRandomCalls, 1);
assert.deepStrictEqual(JSON.parse(JSON.stringify(normalPattern)), [[7]]);

const gameCode = fs.readFileSync(path.resolve(__dirname, "..", "game.js"), "utf8");
assert.match(
  gameCode,
  /createFloorPatternForScenario\(\s*state\.testScenario,\s*makeFloorPattern\s*\)/,
  "buildRoom must bypass makeFloorPattern for deterministic scenarios before RNG is consumed"
);
assert.match(gameCode, /forceEnemyHDShowcaseSetup/, "game must expose the Task 7 visual-only roster QA setup");
assert.match(gameCode, /forcePlayerProtectionHDShowcaseSetup/, "game must expose player protection VFX QA setup");
assert.match(gameCode, /forceStatusEmblemsHDShowcaseSetup/, "game must expose the deterministic status-emblem QA setup");
assert.match(gameCode, /forceActorProportionsHDShowcaseSetup/, "game must expose the deterministic actor-proportion QA setup");
const actorProportionsSetup = gameCode.match(
  /if \(scenario\.forceActorProportionsHDShowcaseSetup\) \{([\s\S]*?)\n    \}\n    if \(scenario\./
);
assert(actorProportionsSetup, "actor-proportion QA setup must remain an isolated scenario branch");
assert.match(actorProportionsSetup[1], /state\.roomType\s*=\s*["']merchant["']/);
assert.match(actorProportionsSetup[1], /state\.merchant\s*=\s*\{\s*x:\s*7,\s*y:\s*7\s*\}/);
assert.match(actorProportionsSetup[1], /type:\s*["']skeleton["'][\s\S]*?x:\s*1,\s*y:\s*2/);
assert.match(actorProportionsSetup[1], /type:\s*["']brute["'][\s\S]*?x:\s*7,\s*y:\s*2/);
assert.match(actorProportionsSetup[1], /type:\s*["']totem["'][\s\S]*?x:\s*1,\s*y:\s*7/);
assert.match(actorProportionsSetup[1], /type:\s*["']skeleton["'][\s\S]*?hp:\s*3,\s*maxHp:\s*4[\s\S]*?frozenThisTurn:\s*true/);
assert.match(actorProportionsSetup[1], /type:\s*["']brute["'][\s\S]*?hp:\s*6,\s*maxHp:\s*8[\s\S]*?burnTurns:\s*99/);
assert.match(actorProportionsSetup[1], /type:\s*["']totem["'][\s\S]*?hp:\s*4,\s*maxHp:\s*6[\s\S]*?acolyteBuffTurns:\s*99/);
assert.match(actorProportionsSetup[1], /state\.player\.x\s*=\s*4/);
assert.match(actorProportionsSetup[1], /state\.player\.y\s*=\s*5/);
assert.match(actorProportionsSetup[1], /state\.spikes\s*=\s*\[\]/);
assert.match(actorProportionsSetup[1], /state\.mines\s*=\s*\[\]/);
assert.match(actorProportionsSetup[1], /state\.volatileBursts\s*=\s*\[\]/);
const statusSetup = gameCode.match(
  /if \(scenario\.forceStatusEmblemsHDShowcaseSetup\) \{([\s\S]*?)\n    \}\n    if \(scenario\./
);
assert(statusSetup, "status-emblem QA setup must remain an isolated scenario branch");
for (const field of [
  "bleedTurns", "poisonTurns", "skillShield", "hpShield", "furyBlessingTurns",
  "shrineAttackTurns", "elixirTurns", "frozenThisTurn", "burnTurns",
  "disorientedTurns", "acolyteBuffTurns"
]) {
  assert.match(statusSetup[1], new RegExp(`${field}:?\\s*|${field}\\s*=`), `status setup must populate ${field}`);
}
for (const affix of ["relentless", "juggernaut", "blooddrinker", "thorned", "volatile"]) {
  assert.match(statusSetup[1], new RegExp(`affix:\\s*["']${affix}["']`), `status setup must include ${affix}`);
}
assert.match(statusSetup[1], /state\.spikes\s*=\s*\[\]/);
assert.match(statusSetup[1], /state\.mines\s*=\s*\[\]/);
assert.match(statusSetup[1], /state\.volatileBursts\s*=\s*\[\]/);
for (const type of ["slime", "skeleton", "brute", "acolyte", "skitter", "totem", "otter"]) {
  assert.match(gameCode, new RegExp(`type:\\s*["']${type}["']`), `roster QA setup must include ${type}`);
}

const dungeonVariationQa = fs.readFileSync(
  path.resolve(__dirname, "..", "scripts", "capture-hd-dungeon-variation-qa.mjs"),
  "utf8"
);
for (const scenario of [
  "descent_floor_variants_hd",
  "corruption_floor_variants_hd",
  "abyss_floor_variants_hd",
  "abyss_combat_hd"
]) {
  assert.match(dungeonVariationQa, new RegExp(`"${scenario}"`), `QA matrix must capture ${scenario}`);
}
assert.match(dungeonVariationQa, /1440[\s\S]*1000/);
assert.match(dungeonVariationQa, /390[\s\S]*844/);
assert.match(dungeonVariationQa, /meanLuminance[\s\S]*45[\s\S]*55/);
assert.match(dungeonVariationQa, /nearMagentaPixels/);
assert.match(dungeonVariationQa, /consoleErrors/);

const statusEmblemQaPath = path.resolve(__dirname, "..", "scripts", "capture-hd-status-emblems-qa.mjs");
assert(fs.existsSync(statusEmblemQaPath), "status-emblem browser QA runner must ship");
const statusEmblemQa = fs.readFileSync(statusEmblemQaPath, "utf8");
assert.match(statusEmblemQa, /status_emblems_hd/);
assert.match(statusEmblemQa, /1440[\s\S]*1000/);
assert.match(statusEmblemQa, /390[\s\S]*844/);
assert.match(statusEmblemQa, /classic/i);
assert.match(statusEmblemQa, /nearMagentaPixels/);
assert.match(statusEmblemQa, /activeEffectsInsidePanel/);
assert.match(statusEmblemQa, /actorRailsInsideCanvas/);
assert.match(statusEmblemQa, /mobileControlsVisible/);
assert.match(statusEmblemQa, /skillsBarVisible/);
assert.match(statusEmblemQa, /consoleErrors/);

const final = api.parseScenarioRequest("?scenario=final_chamber_transition", { maxDepth: 100 });
assert(final, "final_chamber_transition should parse");
assert.strictEqual(final.id, "final_chamber_transition");
assert.strictEqual(final.depth, 100);
assert.strictEqual(final.forceBossPhaseTransitionSetup, true);

const unknown = api.parseScenarioRequest("?scenario=unknown", { maxDepth: 100 });
assert.strictEqual(unknown, null, "unknown scenario should be ignored");

console.log("scenario-overrides tests passed");
