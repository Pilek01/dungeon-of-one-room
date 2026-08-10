const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const configSource = fs.readFileSync(path.join(root, "config.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const hdLayers = fs.readFileSync(path.join(root, "render", "hd-renderer-layers.js"), "utf8");
const { RELIC_BUILD_TAGS } = require("../build-identity.js");
const { PACTS } = require("../pact-room.js");

assert.match(configSource, /window\.GAME_VERSION\s*=\s*["']v0\.8\.2["']/);
assert.match(html, /<link\s+rel=["']icon["']\s+href=["']data:image\/svg\+xml/);

const expansionRelics = [
  "trapweave", "cachekey", "duelistseal", "afterimageboots", "alchemistscoil",
  "executionchain", "aegisdynamo", "hazardprism", "perfectrhythm", "labyrinthheart"
];
for (const id of expansionRelics) {
  assert.ok(RELIC_BUILD_TAGS[id], `missing build-identity tags for ${id}`);
  assert.ok(Object.values(RELIC_BUILD_TAGS[id]).some((score) => Number(score) > 0), `${id} must have a positive build tag`);
}

const cinders = PACTS.find((pact) => pact.id === "cinders");
assert.ok(cinders, "Pact of Cinders must exist");
assert.match(cinders.upside, /^Basic attacks ignite/);
assert.match(game, /enemy\.burnSource\s*=\s*["']cinders["']/);

const scenarioCode = fs.readFileSync(path.join(root, "scenario-overrides.js"), "utf8");
const sandbox = { window: {}, URLSearchParams, console };
vm.createContext(sandbox);
vm.runInContext(scenarioCode, sandbox, { filename: "scenario-overrides.js" });
const scenarios = sandbox.window.DungeonScenarioOverrides;
assert.ok(scenarios, "scenario override API must load");

const expectedScenarios = {
  expansion_enemies_hd: "enemies",
  expansion_traps_hd: "traps",
  expansion_crossroads_hd: "crossroads",
  expansion_arena_hd: "arena",
  expansion_endgame_boss_adds_hd: "warden-endgame-adds",
  expansion_warden_lattice_sequence_hd: "warden-lattice-sequence",
  expansion_warden_collapse_hd: "warden-collapse",
  expansion_warden_reborn_hd: "warden-reborn",
  expansion_warden_doom_sigils_hd: "warden-doom-sigils",
  expansion_forge_boss_hd: "forge-boss"
};
for (const [id, setup] of Object.entries(expectedScenarios)) {
  const scenario = scenarios.parseScenarioRequest(`?scenario=${id}`, { maxDepth: 100 });
  assert.ok(scenario, `${id} must be available`);
  assert.equal(scenario.id, id);
  assert.equal(scenario.forceExpansionHDShowcaseSetup, setup);
  assert.equal(scenario.autoStart, true);
}

for (const chestType of ["crossroads_power", "crossroads_mercy", "arena_reward"]) {
  assert.ok(game.includes(`chest.type === "${chestType}"`), `Classic renderer must handle ${chestType}`);
  assert.match(hdLayers, new RegExp(`chest\\?\\.type\\s*===\\s*["\\']${chestType}["\\']`), `HD renderer must handle ${chestType}`);
}

console.log("expansion-release tests: OK");
