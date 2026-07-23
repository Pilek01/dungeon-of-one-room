const assert = require("node:assert/strict");
const content = require("../expansion-content.js");
const relicData = require("../relic-data.js");
const pactRoom = require("../pact-room.js");
const snapshots = require("../render/visual-snapshot.js");
const vfx = require("../render/hd-vfx.js");

function run() {
  assert.deepEqual(Object.keys(content.ROOM_TYPES), ["ambush", "horde", "duel", "crossroads", "arena"]);
  assert.equal(content.ROOM_TYPES.ambush.category, "normal");
  assert.equal(content.ROOM_TYPES.crossroads.category, "special");
  assert.equal(content.isRoomTypeUnlocked("arena", 39), false);
  assert.equal(content.isRoomTypeUnlocked("arena", 40), true);
  assert.equal(content.getRoomWeightMap("endgame", 100).arena, 0.05);

  assert.deepEqual(Object.keys(content.ENEMY_TYPES), ["riftweaver", "bulwark"]);
  assert.equal(content.isEnemyTypeUnlocked("riftweaver", 44), false);
  assert.equal(content.isEnemyTypeUnlocked("riftweaver", 45), true);
  assert.equal(content.isEnemyTypeUnlocked("bulwark", 64), false);
  assert.equal(content.getEnemyTypeCap("bulwark"), 1);

  assert.deepEqual(Object.keys(content.TRAP_TYPES), ["flameVent", "frostRune"]);
  assert.equal(content.isTrapTypeUnlocked("flameVent", 34), false);
  assert.equal(content.isTrapTypeUnlocked("flameVent", 35), true);
  assert.equal(content.getTrapProfile("frostRune").maxPerRoom, 2);

  const expansionRelics = [
    "trapweave", "cachekey", "duelistseal", "afterimageboots", "alchemistscoil",
    "executionchain", "aegisdynamo", "hazardprism", "perfectrhythm", "labyrinthheart"
  ];
  const relics = relicData.RELICS || relicData.relics;
  assert.ok(Array.isArray(relics));
  for (const id of expansionRelics) assert.ok(relics.some((relic) => relic.id === id), `missing relic ${id}`);
  assert.equal(new Set(relics.map((relic) => relic.id)).size, relics.length, "relic ids must remain unique");

  const expansionPacts = ["silence", "cinders", "hunt", "chains"];
  for (const id of expansionPacts) assert.ok(pactRoom.PACTS.some((pact) => pact.id === id), `missing pact ${id}`);

  const source = {
    phase: "playing", depth: 100, roomType: "arena", player: { x: 4, y: 4, hp: 10, maxHp: 10 },
    relics: [], pits: [], spikes: [], mines: [], chests: [],
    flameVents: [{ x: 2, y: 2, fuseTurns: 1, activeFlash: 0 }],
    frostRunes: [{ x: 3, y: 3, spent: false, activeFlash: 0 }],
    doomSigils: [{ x: 4, y: 4, damage: 20, fuseTurns: 2 }],
    enemies: [{
      id: "w", type: "warden", x: 5, y: 5, hp: 50, maxHp: 50,
      latticeAiming: true, latticeRows: [4], latticeColumns: [4],
      soulChainTiles: [{ x: 5, y: 5 }, { x: 4, y: 4 }]
    }]
  };
  const snap = snapshots.createVisualSnapshot(source, 1000);
  assert.deepEqual(snap.flameVents[0], source.flameVents[0]);
  assert.deepEqual(snap.frostRunes[0], source.frostRunes[0]);
  assert.deepEqual(snap.doomSigils[0], source.doomSigils[0]);
  assert.notEqual(snap.enemies[0].latticeRows, source.enemies[0].latticeRows);

  const commands = vfx.collectTelegraphCommands(snap, { quality: "high" });
  assert.ok(commands.some((command) => command.kind === "flame-vent-area"));
  assert.ok(commands.some((command) => command.kind === "doom-sigil-area"));
  assert.ok(commands.some((command) => command.kind === "lattice-area"));

  console.log("expansion-content tests: OK");
}

run();
