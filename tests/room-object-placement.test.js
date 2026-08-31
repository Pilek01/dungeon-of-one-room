const test = require("node:test");
const assert = require("node:assert/strict");
const {
  chooseCriticalLargeObjectTile,
  chooseLargeObjectTile,
  footprintTiles,
  isLargeObjectCenter
} = require("../room-object-placement.js");

test("critical portal placement deterministically falls back to a free inner tile", () => {
  const occupied = new Set();
  for (let y = 1; y <= 7; y += 1) {
    for (let x = 1; x <= 7; x += 1) {
      if (x !== 1 || y !== 1) occupied.add(`${x},${y}`);
    }
  }
  const point = chooseCriticalLargeObjectTile(occupied);
  assert.deepEqual(point, { x: 1, y: 1 });
  assert.equal(occupied.has("1,1"), true);
});

test("large room objects never select wall-adjacent centers", () => {
  for (let index = 0; index < 25; index += 1) {
    const occupied = new Set();
    const point = chooseLargeObjectTile(occupied, {
      margin: 1,
      random: () => index / 25
    });
    assert.equal(isLargeObjectCenter(point.x, point.y), true);
    assert.ok(point.x >= 2 && point.x <= 6);
    assert.ok(point.y >= 2 && point.y <= 6);
  }
});

test("large object placement reserves its complete three-by-three footprint", () => {
  const occupied = new Set();
  const first = chooseLargeObjectTile(occupied, { margin: 1, random: () => 0 });
  const firstFootprint = new Set(footprintTiles(first, 1).map(({ x, y }) => `${x},${y}`));
  assert.equal(firstFootprint.size, 9);
  for (const key of firstFootprint) assert.equal(occupied.has(key), true);

  const second = chooseLargeObjectTile(occupied, { margin: 1, random: () => 0 });
  const secondFootprint = footprintTiles(second, 1).map(({ x, y }) => `${x},${y}`);
  assert.equal(secondFootprint.some((key) => firstFootprint.has(key)), false);
});

test("large object placement fails safely when no complete footprint remains", () => {
  const occupied = new Set();
  for (let y = 1; y <= 7; y += 1) {
    for (let x = 1; x <= 7; x += 1) occupied.add(`${x},${y}`);
  }
  assert.equal(chooseLargeObjectTile(occupied, { margin: 1, random: () => 0.5 }), null);
});
