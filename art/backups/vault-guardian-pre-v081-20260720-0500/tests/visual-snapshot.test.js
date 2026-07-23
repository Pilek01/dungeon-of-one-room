const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const api = require(path.join(projectRoot, "render", "visual-snapshot.js"));

test("creates the base visual snapshot as an independent render DTO", () => {
  const source = {
    phase: "playing",
    depth: 25,
    roomType: "cursed",
    bossRoom: false,
    player: { x: 4, y: 7, hp: 80, maxHp: 100, facing: "north" },
    enemies: [{ id: "e1", type: "slime", x: 2, y: 3, hp: 5, maxHp: 10 }],
    pits: [{ x: 5, y: 4 }],
    spikes: [{ x: 1, y: 1, active: true }],
    mines: [],
    chests: [],
    particles: [],
    floatingTexts: []
  };

  const snapshot = api.createVisualSnapshot(source, 1200);

  assert.notStrictEqual(snapshot.player, source.player);
  snapshot.player.x = 99;
  assert.strictEqual(source.player.x, 4);
  assert.strictEqual(snapshot.nowMs, 1200);
  assert.strictEqual(snapshot.tileSize, 64);
  assert.strictEqual(snapshot.gridSize, 9);
  assert.deepStrictEqual(snapshot.enemies, [{
    id: "e1",
    type: "slime",
    x: 2,
    y: 3,
    hp: 5,
    maxHp: 10,
    showHpBar: true
  }]);
  assert.notStrictEqual(snapshot.enemies, source.enemies);
  assert.notStrictEqual(snapshot.enemies[0], source.enemies[0]);
  assert.deepStrictEqual(snapshot.pits, [{ x: 5, y: 4 }]);
  assert.notStrictEqual(snapshot.pits, source.pits);
});

test("clones nested render structures without cloning arbitrary fields", () => {
  const source = {
    phase: "playing",
    floorPattern: [[1, 2], [3, 4]],
    player: {
      x: 3,
      y: 4,
      _tweenT: 40,
      _tweenFromX: 32,
      _tweenFromY: 48,
      hp: 60,
      maxHp: 100,
      hitFlash: 70,
      dashAfterline: {
        turns: 2,
        maxTurns: 3,
        tiles: [{ x: 2, y: 4, simulationSecret: "omit" }],
        controller: { mode: "omit" }
      }
    },
    enemies: [{
      id: "warden-1",
      type: "warden",
      x: 4,
      y: 2,
      hp: 300,
      maxHp: 500,
      facing: "south",
      elite: true,
      aiming: true,
      volleyAiming: true,
      telegraphAge: 1,
      _tweenT: 25,
      _tweenFromX: 48,
      _tweenFromY: 32,
      voidAegisShield: 40,
      brain: { target: "player" }
    }],
    spikes: [{ x: 1, y: 1, active: true, damage: 999 }],
    mines: [{ x: 5, y: 5, armed: true, fuseTurns: 1, damage: 999 }],
    chests: [{ id: "c1", type: "normal", x: 6, y: 6, opened: false, loot: ["secret"] }],
    shrine: { x: 2, y: 2, used: false, reward: { id: "secret" } },
    forge: {
      x: 3,
      y: 3,
      originX: 2,
      originY: 2,
      width: 3,
      height: 3,
      awakened: true,
      used: false,
      blockedTiles: [{ x: 2, y: 2, collisionCode: 7 }],
      rewardTable: ["secret"]
    },
    pact: { x: 4, y: 4, awakened: true, used: false, offerIds: ["secret"] },
    merchant: { x: 5, y: 4, inventory: ["secret"] },
    portal: { x: 1, y: 1, destination: { depth: 26 } },
    volatileBursts: [{ x: 7, y: 7, source: "volatile", fuseTurns: 2, damage: 999 }],
    particles: [{ x: 10, y: 11, vx: 0.2, vy: -0.1, life: 50, maxLife: 100, size: 2, color: "#fff", owner: {} }],
    floatingTexts: [{ x: 12, y: 13, vx: 0, vy: -0.1, life: 40, maxLife: 80, text: "-5", color: "#f00", size: 10 }],
    rangedBolts: [{ fromX: 1, fromY: 2, toX: 3, toY: 4, color: "#fff", progress: 0.5, speed: 0.01, life: 10, maxLife: 20 }],
    rangedImpacts: [{ x: 3, y: 4, color: "#fff", radius: 2, life: 10, maxLife: 20 }],
    dashTrails: [{ fromX: 1, fromY: 2, toX: 3, toY: 4, color: "#fff", life: 10, maxLife: 20, tier: 3, style: "void", seed: 17 }],
    shockwaveRings: [{ x: 3, y: 4, radius: 2, maxRadius: 10, life: 10, maxLife: 20, color: "#fff", core: "#000", skill: "aoe", tier: 3, style: "outer", furySpent: 2, ringIndex: 2, seed: 23 }]
  };

  const snapshot = api.createVisualSnapshot(source, 5000);

  snapshot.floorPattern[0][0] = 99;
  snapshot.player.dashAfterline.tiles[0].x = 99;
  snapshot.forge.blockedTiles[0].x = 99;
  snapshot.particles[0].x = 99;
  assert.equal(snapshot.dashTrails[0].tier, 3);
  assert.equal(snapshot.dashTrails[0].style, "void");
  assert.equal(snapshot.shockwaveRings[0].furySpent, 2);
  assert.equal(snapshot.shockwaveRings[0].ringIndex, 2);
  assert.strictEqual(source.floorPattern[0][0], 1);
  assert.strictEqual(source.player.dashAfterline.tiles[0].x, 2);
  assert.strictEqual(source.forge.blockedTiles[0].x, 2);
  assert.strictEqual(source.particles[0].x, 10);
  assert.strictEqual(snapshot.player._tweenT, 40);
  assert.strictEqual(snapshot.enemies[0]._tweenFromY, 32);

  assert.strictEqual("simulationSecret" in snapshot.player.dashAfterline.tiles[0], false);
  assert.strictEqual("controller" in snapshot.player.dashAfterline, false);
  assert.strictEqual("brain" in snapshot.enemies[0], false);
  assert.strictEqual("damage" in snapshot.spikes[0], false);
  assert.strictEqual("damage" in snapshot.mines[0], false);
  assert.strictEqual("loot" in snapshot.chests[0], false);
  assert.strictEqual("reward" in snapshot.shrine, false);
  assert.strictEqual("rewardTable" in snapshot.forge, false);
  assert.strictEqual("offerIds" in snapshot.pact, false);
  assert.strictEqual("inventory" in snapshot.merchant, false);
  assert.strictEqual("destination" in snapshot.portal, false);
  assert.strictEqual("damage" in snapshot.volatileBursts[0], false);
  assert.strictEqual("owner" in snapshot.particles[0], false);
});

test("sanitizes malformed floor pattern rows and cells without reference leaks", () => {
  const objectCell = { tileId: 2 };
  const nestedArrayCell = [3];
  const malformedRow = { 0: 4 };
  const source = {
    floorPattern: [
      [1, null, objectCell],
      malformedRow,
      [nestedArrayCell, 5]
    ]
  };

  const snapshot = api.createVisualSnapshot(source, 100);

  assert.deepStrictEqual(snapshot.floorPattern, [
    [1, null, null],
    [],
    [null, 5]
  ]);
  assert.notStrictEqual(snapshot.floorPattern[0], source.floorPattern[0]);
  assert.notStrictEqual(snapshot.floorPattern[1], malformedRow);
  assert.notStrictEqual(snapshot.floorPattern[2][0], nestedArrayCell);
  snapshot.floorPattern[0][0] = 99;
  assert.strictEqual(source.floorPattern[0][0], 1);
});

test("excludes functions, audio, persistence, bot, and network state", () => {
  const source = {
    phase: "playing",
    roomType() {},
    player: { x: 4, y: 4, hp: 100, maxHp: 100, facing() {}, onDraw() {} },
    enemies: [],
    audioMuted: false,
    audio: { currentTrack: "boss" },
    bgmTracks: [{ play() {} }],
    localStorage: { save: "opaque" },
    saveMetadata: { slot: 1 },
    currentRunToken: "secret-token",
    observerBot: { enabled: true },
    simulation: { active: true },
    leaderboard: [{ name: "player" }],
    onlineLeaderboard: [{ name: "remote" }],
    network: { connected: true },
    renderHook() {}
  };

  const snapshot = api.createVisualSnapshot(source, 0);
  const forbiddenRootFields = [
    "audioMuted",
    "audio",
    "bgmTracks",
    "localStorage",
    "saveMetadata",
    "currentRunToken",
    "observerBot",
    "simulation",
    "leaderboard",
    "onlineLeaderboard",
    "network",
    "renderHook"
  ];

  for (const field of forbiddenRootFields) {
    assert.strictEqual(field in snapshot, false, `unexpected nonvisual field: ${field}`);
  }
  assert.strictEqual("onDraw" in snapshot.player, false);
  assert.strictEqual("roomType" in snapshot, false);
  assert.strictEqual("facing" in snapshot.player, false);
  assert.strictEqual(Object.values(snapshot).some((value) => typeof value === "function"), false);
});

test("preserves null and undefined category semantics", () => {
  const snapshot = api.createVisualSnapshot({
    player: null,
    enemies: undefined,
    shrine: null,
    forge: undefined,
    particles: null
  }, undefined);

  assert.strictEqual(snapshot.player, null);
  assert.strictEqual(snapshot.enemies, undefined);
  assert.strictEqual(snapshot.shrine, null);
  assert.strictEqual(snapshot.forge, undefined);
  assert.strictEqual(snapshot.particles, null);
  assert.strictEqual(snapshot.nowMs, undefined);
});

test("derives portal appearance without exposing room routing state", () => {
  for (const kind of ["vault", "forge", "otter"]) {
    const snapshot = api.createVisualSnapshot({
      depth: 25,
      forcedNextRoomType: kind,
      portal: { x: 1, y: 1 }
    }, 100);

    assert.deepStrictEqual(snapshot.portal, { x: 1, y: 1, kind });
    assert.strictEqual("forcedNextRoomType" in snapshot, false);
  }

  const normal = api.createVisualSnapshot({
    depth: 25,
    forcedNextRoomType: "pact",
    portal: { x: 1, y: 1 }
  }, 100);
  const bossNext = api.createVisualSnapshot({
    depth: 24,
    forcedNextRoomType: "vault",
    portal: { x: 1, y: 1 }
  }, 100);

  assert.strictEqual(normal.portal.kind, "default");
  assert.strictEqual(bossNext.portal.kind, "default");
});

test("copies enemy freeze, frost, and disorientation presentation status", () => {
  const source = {
    enemies: [{
      id: "e1",
      type: "slime",
      x: 2,
      y: 3,
      frozenThisTurn: true,
      frostFx: 620,
      disorientedTurns: 2
    }]
  };

  const snapshot = api.createVisualSnapshot(source, 100);

  assert.strictEqual(snapshot.enemies[0].frozenThisTurn, true);
  assert.strictEqual(snapshot.enemies[0].frostFx, 620);
  assert.strictEqual(snapshot.enemies[0].disorientedTurns, 2);
});

test("hides a full-health enemy HP bar without Scout's Lens", () => {
  const snapshot = api.createVisualSnapshot({
    relics: [],
    enemies: [{ id: "e1", type: "slime", hp: 10, maxHp: 10 }]
  }, 100);

  assert.strictEqual(snapshot.enemies[0].showHpBar, false);
  assert.strictEqual("relics" in snapshot, false);
});

test("shows a full-health enemy HP bar with Scout's Lens", () => {
  const snapshot = api.createVisualSnapshot({
    relics: ["scoutlens"],
    enemies: [{ id: "e1", type: "slime", hp: 10, maxHp: 10 }]
  }, 100);

  assert.strictEqual(snapshot.enemies[0].showHpBar, true);
  assert.strictEqual("relics" in snapshot, false);
});

test("shows a damaged enemy HP bar without Scout's Lens", () => {
  const snapshot = api.createVisualSnapshot({
    relics: [],
    enemies: [{ id: "e1", type: "slime", hp: 6, maxHp: 10 }]
  }, 100);

  assert.strictEqual(snapshot.enemies[0].showHpBar, true);
  assert.strictEqual("relics" in snapshot, false);
});

test("derives player adrenaline, bleed, poison, and shrine presentation state", () => {
  const source = {
    player: {
      x: 4,
      y: 4,
      adrenaline: 3,
      furyBlessingTurns: 2,
      bleedTurns: 1,
      poisonTurns: 2,
      shrineAttackTurns: 0,
      shrineArmorTurns: 4,
      shrineMaxHpTurns: 0,
      shrineSwapTurns: 0,
      shrineNoiseTurns: 0,
      shrineHungerTurns: 0
    }
  };

  const snapshot = api.createVisualSnapshot(source, 100);

  assert.strictEqual(snapshot.player.effectiveAdrenaline, 5);
  assert.strictEqual(snapshot.player.furyBlessed, true);
  assert.strictEqual(snapshot.player.bleeding, true);
  assert.strictEqual(snapshot.player.poisoned, true);
  assert.strictEqual(snapshot.player.shrineBlessed, true);
  assert.strictEqual(snapshot.player.shrineArmorBlessed, true);
  for (const simulationField of [
    "adrenaline",
    "furyBlessingTurns",
    "bleedTurns",
    "poisonTurns",
    "shrineAttackTurns",
    "shrineArmorTurns",
    "shrineMaxHpTurns",
    "shrineSwapTurns",
    "shrineNoiseTurns",
    "shrineHungerTurns"
  ]) {
    assert.strictEqual(simulationField in snapshot.player, false, `unexpected raw player field: ${simulationField}`);
  }

  const inactive = api.createVisualSnapshot({
    player: {
      adrenaline: 0,
      furyBlessingTurns: 0,
      bleedTurns: 0,
      poisonTurns: 0,
      shrineArmorTurns: 0
    }
  }, 100);
  assert.strictEqual(inactive.player.effectiveAdrenaline, 0);
  assert.strictEqual(inactive.player.furyBlessed, false);
  assert.strictEqual(inactive.player.bleeding, false);
  assert.strictEqual(inactive.player.poisoned, false);
  assert.strictEqual(inactive.player.shrineBlessed, false);
  assert.strictEqual(inactive.player.shrineArmorBlessed, false);
});

test("keeps forge appearance while excluding simulation-only coordinates", () => {
  const snapshot = api.createVisualSnapshot({
    forge: {
      x: 3,
      y: 3,
      originX: 2,
      originY: 2,
      width: 3,
      height: 3,
      awakened: true,
      used: false,
      interactX: 4,
      interactY: 5,
      guardianSpawnX: 6,
      guardianSpawnY: 7,
      blockedTiles: [{ x: 2, y: 2 }]
    }
  }, 100);

  assert.deepStrictEqual(snapshot.forge, {
    x: 3,
    y: 3,
    originX: 2,
    originY: 2,
    width: 3,
    height: 3,
    awakened: true,
    used: false,
    blockedTiles: [{ x: 2, y: 2 }]
  });
});

test("renderFrame creates and renders exactly one shared snapshot", () => {
  const source = { phase: "playing" };
  const expectedSnapshot = { marker: "same-snapshot" };
  const originalCreateVisualSnapshot = api.createVisualSnapshot;
  let createCalls = 0;
  let renderCalls = 0;
  let renderedSnapshot = null;

  api.createVisualSnapshot = (receivedSource, receivedNowMs) => {
    createCalls += 1;
    assert.strictEqual(receivedSource, source);
    assert.strictEqual(receivedNowMs, 777);
    return expectedSnapshot;
  };

  try {
    const returnedSnapshot = api.renderFrame(source, 777, (snapshot) => {
      renderCalls += 1;
      renderedSnapshot = snapshot;
    });

    assert.strictEqual(createCalls, 1);
    assert.strictEqual(renderCalls, 1);
    assert.strictEqual(renderedSnapshot, expectedSnapshot);
    assert.strictEqual(returnedSnapshot, expectedSnapshot);
  } finally {
    api.createVisualSnapshot = originalCreateVisualSnapshot;
  }
});

test("loads the snapshot module before game.js and wires the tested frame boundary", () => {
  const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const gameSource = fs.readFileSync(path.join(projectRoot, "game.js"), "utf8");
  const snapshotScriptIndex = indexHtml.indexOf('<script src="render/visual-snapshot.js"></script>');
  const gameScriptIndex = indexHtml.indexOf('<script src="game.js"></script>');

  assert.ok(snapshotScriptIndex >= 0, "visual snapshot script is loaded");
  assert.ok(snapshotScriptIndex < gameScriptIndex, "visual snapshot script loads before game.js");
  assert.strictEqual((gameSource.match(/visualSnapshotApi\.createVisualSnapshot\s*\(/g) || []).length, 0);
  assert.strictEqual((gameSource.match(/visualSnapshotApi\.renderFrame\s*\(/g) || []).length, 1);
  assert.match(gameSource, /function renderSelectedFrame\s*\(snapshot\)/);
  assert.match(
    gameSource,
    /function renderVisualFrame\s*\(nowMs\)\s*{\s*visualSnapshotApi\.renderFrame\(state, nowMs, \(snapshot\) => {\s*snapshot\.wardenBurstRange = getWardenBurstRange\(snapshot\.depth\);\s*renderSelectedFrame\(snapshot\);\s*}\);\s*}/
  );
  assert.strictEqual((gameSource.match(/renderVisualFrame\s*\(/g) || []).length, 3);
});
