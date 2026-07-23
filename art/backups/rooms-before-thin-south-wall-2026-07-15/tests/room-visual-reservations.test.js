const test = require("node:test");
const assert = require("node:assert/strict");
const {
  collectProtectedTiles,
  sanitizeRoomVisualConflicts
} = require("../room-visual-reservations.js");

function torchPattern() {
  return Array.from({ length: 9 }, () => Array(9).fill(3));
}

test("portal and special setpieces reserve a one-tile visual safety margin", () => {
  const room = {
    floorPattern: torchPattern(),
    roomType: "forge",
    portal: { x: 7, y: 7 },
    shrine: { x: 1, y: 4 },
    pact: { x: 7, y: 4 },
    forge: { originX: 3, originY: 0, width: 3, height: 3 },
    chests: [{ x: 1, y: 7, type: "otter_red", opened: false }],
    spikes: [{ x: 7, y: 6 }, { x: 1, y: 2 }],
    mines: [{ x: 2, y: 3 }, { x: 1, y: 2 }]
  };

  const protectedTiles = collectProtectedTiles(room);
  assert.equal(protectedTiles.has("7,6"), true, "portal margin");
  assert.equal(protectedTiles.has("2,3"), true, "forge footprint margin");
  assert.equal(protectedTiles.has("1,1"), true, "north floor edge is protected");
  assert.equal(protectedTiles.has("1,2"), false, "unrelated floor remains available");

  const result = sanitizeRoomVisualConflicts(room);
  assert.equal(room.floorPattern[0][4], 0, "wall torch is always removed");
  assert.equal(room.floorPattern[7][7], 0, "portal torch is removed");
  assert.equal(room.floorPattern[3][2], 0, "forge-margin torch is removed");
  assert.equal(room.floorPattern[1][1], 0, "north-edge torch is removed");
  assert.equal(room.floorPattern[2][1], 3, "unrelated interior torch remains");
  assert.deepEqual(room.spikes, [{ x: 1, y: 2 }]);
  assert.deepEqual(room.mines, [{ x: 1, y: 2 }]);
  assert.ok(result.removedTorches > 0);
});

test("boss and vault artwork reserve their complete HD footprints", () => {
  const boss = {
    roomType: "boss",
    bossRoom: true,
    floorPattern: torchPattern(),
    spikes: [{ x: 2, y: 2 }, { x: 3, y: 1 }, { x: 4, y: 4 }, { x: 3, y: 7 }, { x: 1, y: 2 }],
    mines: [{ x: 6, y: 6 }, { x: 1, y: 2 }]
  };
  sanitizeRoomVisualConflicts(boss);
  assert.deepEqual(boss.spikes, [{ x: 1, y: 2 }]);
  assert.deepEqual(boss.mines, [{ x: 1, y: 2 }]);
  assert.equal(boss.floorPattern[4][4], 0, "center seal");
  assert.equal(boss.floorPattern[1][4], 0, "north relief");
  assert.equal(boss.floorPattern[7][4], 0, "south relief");

  const vault = {
    roomType: "vault",
    floorPattern: torchPattern(),
    spikes: [{ x: 2, y: 4 }, { x: 1, y: 2 }],
    mines: [{ x: 6, y: 4 }, { x: 7, y: 6 }]
  };
  sanitizeRoomVisualConflicts(vault);
  assert.deepEqual(vault.spikes, [{ x: 1, y: 2 }]);
  assert.deepEqual(vault.mines, [{ x: 7, y: 6 }]);

  const otter = {
    roomType: "otter",
    floorPattern: torchPattern(),
    spikes: [{ x: 4, y: 2 }, { x: 1, y: 2 }],
    mines: [{ x: 6, y: 4 }, { x: 7, y: 6 }]
  };
  sanitizeRoomVisualConflicts(otter);
  assert.deepEqual(otter.spikes, [{ x: 1, y: 2 }]);
  assert.deepEqual(otter.mines, [{ x: 7, y: 6 }]);
});

test("hazards cannot survive on walls or the north and south floor edges", () => {
  const room = {
    floorPattern: torchPattern(),
    spikes: [{ x: 0, y: 4 }, { x: 4, y: 1 }, { x: 4, y: 2 }],
    mines: [{ x: 8, y: 4 }, { x: 4, y: 7 }, { x: 4, y: 6 }]
  };

  const result = sanitizeRoomVisualConflicts(room);
  assert.deepEqual(room.spikes, [{ x: 4, y: 2 }]);
  assert.deepEqual(room.mines, [{ x: 4, y: 6 }]);
  assert.equal(result.removedSpikes, 2);
  assert.equal(result.removedMines, 2);
});
