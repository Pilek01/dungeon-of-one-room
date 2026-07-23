const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function includesAll(source, needles) {
  for (const needle of needles) assert.ok(source.includes(needle), `missing integration hook: ${needle}`);
}

includesAll(html, [
  '<script src="expansion-content.js"></script>',
  '<script src="relic-data.js"></script>',
  '<script src="pact-room.js"></script>',
  '<script src="boss-campaign.js"></script>'
]);

includesAll(game, [
  'function startRiftweaverRift',
  'function startBulwarkBash',
  'function startWardenRiftLattice',
  'function advanceWardenRiftLattice',
  'function startWardenVoidStep',
  'function castWardenDoomSigils',
  'function startWardenSoulChain',
  'function startBlacksmithChainHook',
  'function castBlacksmithOverheat',
  'function tickFlameVents',
  'function triggerFrostRuneForPlayer',
  'function spawnArenaWave',
  'function buildCrossroadsRoom',
  'chest.type === "arena_reward"',
  'chest.type === "crossroads_power"',
  'chest.type === "crossroads_mercy"',
  'hasRelic("perfectrhythm")',
  'hasRelic("labyrinthheart")',
  'hasPact("chains")'
]);

assert.ok(game.includes('roomType === "ambush"'));
assert.ok(game.includes('roomType === "horde"'));
assert.ok(game.includes('roomType === "duel"'));
assert.ok(game.includes('state.flameVents = []'));
assert.ok(game.includes('state.frostRunes = []'));
assert.ok(game.includes('state.doomSigils = []'));
assert.ok(game.includes('const RIFTWEAVER_RIFT_DELAY_TURNS = 2;'));
assert.ok(game.includes('if ((Number(enemy.telegraphAge) || 0) < RIFTWEAVER_RIFT_DELAY_TURNS) return;'));
assert.ok(game.includes('You have 2 full turns to escape!'));

const endgameRegionStart = game.indexOf('endgame: Object.freeze({');
const campaignAnnouncementsStart = game.indexOf('const CAMPAIGN_REGION_ANNOUNCEMENTS', endgameRegionStart);
assert.ok(endgameRegionStart >= 0 && campaignAnnouncementsStart > endgameRegionStart, 'endgame region config must exist');
assert.match(game.slice(endgameRegionStart, campaignAnnouncementsStart), /bossAddCount:\s*2/, 'depth 80+ boss rooms must cap forced elite adds at two');

console.log("expansion-integration tests: OK");
