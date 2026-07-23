const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const pits = require("../pit-hazard.js");

function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function pngSize(relative) {
  const bytes = fs.readFileSync(path.join(ROOT, relative));
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20), bytes[25]];
}

test("pits start at depth 61 and exclude bosses and every special room", () => {
  assert.equal(pits.isPitRoomEligible({ depth: 60, roomType: "combat", bossRoom: false }), false);
  assert.equal(pits.isPitRoomEligible({ depth: 61, roomType: "combat", bossRoom: false }), true);
  assert.equal(pits.isPitRoomEligible({ depth: 61, roomType: "boss", bossRoom: true }), false);
  for (const roomType of ["merchant", "forge", "vault", "otter", "pact"]) {
    assert.equal(pits.isPitRoomEligible({ depth: 81, roomType, bossRoom: false }), false, roomType);
  }
  for (const roomType of ["combat", "cursed", "treasure", "shrine"]) {
    assert.equal(pits.isPitRoomEligible({ depth: 61, roomType, bossRoom: false }), true, roomType);
  }
});

test("pit generator respects reservations, perspective edges and portal reachability", () => {
  for (const depth of [61, 79, 80, 99]) {
    const generated = pits.generatePitTiles({
      depth,
      roomType: "combat",
      bossRoom: false,
      gridSize: 9,
      player: { x: 4, y: 4 },
      portal: { x: 7, y: 7 },
      reservedTiles: [
        { x: 4, y: 4, margin: 1 },
        { x: 7, y: 7, margin: 1 },
        { x: 2, y: 3, margin: 0 }
      ],
      random: seededRandom(depth)
    });
    const [minimum, maximum] = pits.pitCountRange(depth);
    assert.ok(generated.length >= minimum && generated.length <= maximum, `${depth}: ${generated.length}`);
    assert.ok(generated.every((pit) => pit.x >= 2 && pit.x <= 6));
    assert.ok(generated.every((pit) => pit.y >= 3 && pit.y <= 6));
    assert.ok(generated.every((pit) => Math.max(Math.abs(pit.x - 4), Math.abs(pit.y - 4)) > 1));
    assert.ok(generated.every((pit) => !(pit.x === 2 && pit.y === 3)));
  }
});

test("pit masks and Chrono safe-tile search are deterministic", () => {
  const cluster = [{ x: 4, y: 4 }, { x: 4, y: 3 }, { x: 5, y: 4 }];
  assert.equal(pits.getPitMask(cluster, 4, 4), 3);
  assert.equal(pits.getPitMask(cluster, 4, 3), 4);
  assert.deepEqual(
    pits.findNearestSafeTile({ fromX: 4, fromY: 4, preferred: { x: 4, y: 5 }, pits: cluster, gridSize: 9 }),
    { x: 4, y: 5 }
  );
});

test("enemy director treats pits as hard movement blockers", () => {
  const previousWindow = global.window;
  global.window = {};
  delete require.cache[require.resolve("../enemy-director.js")];
  require("../enemy-director.js");
  const plan = global.window.DungeonEnemyDirector.decidePlan({
    enemy: { type: "slime", x: 4, y: 4 },
    player: { x: 6, y: 4, hp: 100, maxHp: 100 },
    portal: { x: 7, y: 4 },
    enemies: [],
    chests: [],
    spikes: [],
    pits: [{ x: 5, y: 4 }],
    inBounds: (x, y) => x >= 0 && x < 9 && y >= 0 && y < 9,
    depth: 61
  });
  assert.notDeepEqual(plan.moveTo, { x: 5, y: 4 });
  global.window = previousWindow;
});

test("Beyond publishes three standard rooms, boss room and sixteen RGBA pit tiles", () => {
  const manifest = require("../render/hd-asset-manifest.js");
  const layers = require("../render/hd-renderer-layers.js");
  assert.equal(layers.getEnvironmentTheme(60), "beyond");
  assert.match(layers.selectStandardRoomBackground({ depth: 61, roomType: "combat", bossRoom: false }), /^environment\.beyond\.room0[1-3]$/);
  assert.equal(layers.selectBossRoomBackground({ depth: 60, roomType: "boss", bossRoom: true }), "environment.beyond.bossroom");
  for (let variant = 1; variant <= 3; variant += 1) {
    assert.deepEqual(pngSize(`assets/hd/environment/beyond/room-0${variant}.png`).slice(0, 2), [576, 576]);
  }
  assert.deepEqual(pngSize("assets/hd/environment/beyond/boss-room.png").slice(0, 2), [576, 576]);
  for (let mask = 0; mask < 16; mask += 1) {
    const suffix = String(mask).padStart(2, "0");
    const key = `hazard.beyond.pit.${suffix}`;
    assert.equal(manifest.getByKey(key)?.src, `assets/hd/hazards/beyond/pit-${suffix}.png`);
    assert.deepEqual(pngSize(`assets/hd/hazards/beyond/pit-${suffix}.png`), [64, 64, 6]);
  }
});

test("game integration resolves direct movement, knockback, Chrono rescue and enemy falls", () => {
  const game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
  const skills = fs.readFileSync(path.join(ROOT, "skills-actions.js"), "utf8");
  for (const token of ["generateBeyondPits", "resolvePlayerPitFall", "resolveEnemyPitFall", "tryTriggerChronoLoop", "state.pits"]) {
    assert.match(game, new RegExp(token));
  }
  assert.match(game, /resolvePlayerPitFall\(previous\)/);
  assert.match(game, /resolvePlayerPitFall\(\{ x: nx - dx, y: ny - dy \}\)/);
  assert.match(game, /killEnemy\(enemy, "cast into the Beyond", \{ suppressDeathBursts: true \}\)/);
  assert.match(skills, /resolvePlayerPitFall\(previous\)/);
  assert.ok((skills.match(/resolveEnemyPitFall/g) || []).length >= 5);
});
