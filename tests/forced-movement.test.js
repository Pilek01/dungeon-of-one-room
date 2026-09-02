const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  isEnemyImmuneToPlayerForcedMovement,
  canLandEnemyForcedMovement
} = require("../forced-movement.js");

const game = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const open = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

const makeChaosSafeTeleportTiles = new Function(
  "GRID_SIZE",
  "state",
  "isHazardAt",
  "isForgeBlockedTile",
  "getEnemyAt",
  `return (${extractFunction(game, "getChaosSafeTeleportTiles")});`
);

const makeFallbackStepForBot = new Function(
  "BOT_CARDINAL_DIRECTIONS",
  "state",
  "inBounds",
  "isForgeBlockedTile",
  "getEnemyAt",
  "isHazardAt",
  "shouldBotRiskSpikeStep",
  "randInt",
  `return (${extractFunction(game, "getFallbackStepForBot")});`
);

function run() {
  assert.equal(isEnemyImmuneToPlayerForcedMovement({ type: "blacksmith_guardian" }), true);
  assert.equal(isEnemyImmuneToPlayerForcedMovement({ type: "guardian" }), false);

  const canLand = canLandEnemyForcedMovement({
    x: 4,
    y: 1,
    playerX: 4,
    playerY: 4,
    chests: [],
    enemies: [],
    targetEnemy: null,
    inBounds: () => true,
    isForgeBlockedTile: (x, y) => x === 4 && y === 1
  });
  assert.equal(canLand, false);

  const normalLand = canLandEnemyForcedMovement({
    x: 4,
    y: 2,
    playerX: 4,
    playerY: 4,
    chests: [],
    enemies: [],
    targetEnemy: null,
    inBounds: () => true,
    isForgeBlockedTile: () => false
  });
  assert.equal(normalLand, true);

  const chaosStart = game.indexOf("function getChaosSafeTeleportTiles()");
  const chaosEnd = game.indexOf("function tickChaosOrb()", chaosStart);
  assert.ok(chaosStart >= 0 && chaosEnd > chaosStart, "Chaos teleport helper is present");
  assert.match(
    game.slice(chaosStart, chaosEnd),
    /isForgeBlockedTile\(x, y\)/,
    "Chaos teleport candidates must exclude Forge blocked tiles"
  );

  const fallbackStart = game.indexOf("function getFallbackStepForBot()");
  const fallbackEnd = game.indexOf("function canObserverBotDrinkPotion()", fallbackStart);
  assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart, "Observer fallback helper is present");
  assert.match(
    game.slice(fallbackStart, fallbackEnd),
    /isForgeBlockedTile\(nx, ny\)/,
    "Observer fallback candidates must exclude Forge blocked tiles"
  );

  const blocked = { x: 4, y: 1 };
  const chaosState = {
    player: { x: 4, y: 4 },
    chests: [],
    enemies: [],
    merchant: null,
    shrine: null,
    forge: { used: false },
    pact: null
  };
  const chaosTiles = makeChaosSafeTeleportTiles(
    9,
    chaosState,
    () => false,
    (x, y) => x === blocked.x && y === blocked.y,
    () => null
  )();
  assert.equal(chaosTiles.some((tile) => tile.x === blocked.x && tile.y === blocked.y), false);

  const fallbackState = { player: { x: 4, y: 2 }, enemies: [] };
  const fallback = makeFallbackStepForBot(
    [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }],
    fallbackState,
    () => true,
    (x, y) => x === blocked.x && y === blocked.y,
    () => null,
    () => false,
    () => true,
    (min, max) => min
  )();
  assert.notDeepEqual(fallback, { dx: 0, dy: -1 }, "Observer fallback must never choose blocked Forge neighbor");

  console.log("forced-movement tests: OK");
}

run();
