const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifest = require("../render/hd-asset-manifest.js");
const suppliedExpansionEntries = require("../render/hd-expansion-art-entries.js");
const layers = require("../render/hd-renderer-layers.js");
const vfx = require("../render/hd-vfx.js");
const visualSnapshot = require("../render/visual-snapshot.js");

const projectRoot = path.resolve(__dirname, "..");

test("expansion art manifest is unique and every production path exists", () => {
  assert.equal(new Set(manifest.entries.map((entry) => entry.key)).size, manifest.entries.length);
  assert.equal(suppliedExpansionEntries.length, 639);
  for (const entry of suppliedExpansionEntries) {
    assert.equal(manifest.getByKey(entry.key)?.src, entry.src, entry.key);
  }
  assert.deepEqual(
    suppliedExpansionEntries.filter((entry) => !fs.existsSync(path.join(projectRoot, entry.src))),
    []
  );
});

test("HD actors use dedicated expansion keys even when legacy aliases remain on state", () => {
  const rift = layers.selectEnemyVisual({ nowMs: 0 }, {
    type: "riftweaver", renderType: "acolyte", facing: "south", hp: 10, maxHp: 10
  });
  const bulwark = layers.selectEnemyVisual({ nowMs: 0 }, {
    type: "bulwark", renderType: "brute", facing: "west", hp: 10, maxHp: 10
  });
  assert.match(rift.key, /^enemy\.riftweaver\.south\./);
  assert.equal(rift.type, "riftweaver");
  assert.match(bulwark.key, /^enemy\.bulwark\.west\./);
  assert.equal(bulwark.type, "bulwark");

  assert.deepEqual(
    [0, 30, 60, 90].map((_tweenT) => layers.selectEnemyVisual(
      { nowMs: 500 }, { type: "riftweaver", hp: 10, _tweenT }
    ).frame),
    [1, 2, 3, 4]
  );
  assert.deepEqual(
    [0, 1, 2].map((telegraphAge) => layers.selectEnemyVisual(
      { nowMs: 500 }, { type: "riftweaver", hp: 10, riftAiming: true, telegraphAge }
    ).frame),
    [1, 2, 2]
  );
  assert.deepEqual(
    [0, 500, 1000].map((nowMs) => layers.selectEnemyVisual(
      { nowMs }, { type: "riftweaver", hp: 10, riftAiming: true, telegraphAge: 1 }
    ).frame),
    [2, 2, 2]
  );
  assert.deepEqual(
    [0, 1, 2].map((telegraphAge) => layers.selectEnemyVisual(
      { nowMs: 500 }, { type: "bulwark", hp: 10, bulwarkBashAiming: true, telegraphAge }
    ).frame),
    [1, 2, 2]
  );
  assert.equal(layers.selectEnemyVisual(
    { nowMs: 500 }, { type: "bulwark", hp: 10, rests: true }
  ).clip, "idle");
  assert.equal(layers.selectBulwarkGuardVisual({ type: "bulwark", hp: 10, rests: true }), null);
  assert.deepEqual(
    layers.selectBulwarkGuardVisual({ type: "bulwark", facing: "west", hp: 10, bulwarkBashAiming: true, telegraphAge: 1 }),
    {
      direction: "west",
      frame: 2,
      key: "asset.vfx.expansion.bulwark.guard.west.guard_02"
    }
  );
  assert.deepEqual(
    [320, 240, 160, 80].map((castFlash) => layers.selectEnemyVisual(
      { nowMs: 500 }, { type: "bulwark", hp: 10, castFlash }
    ).frame),
    [1, 2, 3, 4]
  );
  const warden = layers.selectBossVisual({ finalBossPhase: 2, nowMs: 0 }, {
    type: "warden", facing: "north", hp: 100, maxHp: 100
  });
  const forge = layers.selectBossVisual({ finalBossPhase: 0, nowMs: 0 }, {
    type: "blacksmith_guardian", facing: "east", hp: 100, maxHp: 100, blacksmithOverheated: true
  });
  assert.match(warden.key, /^boss\.warden\.phase2reborn\.north\./);
  assert.match(forge.key, /^boss\.blacksmith_guardian\.overheat\.east\./);
});

test("HD hazards prefer new art while retaining callable fallbacks", () => {
  const drawn = [];
  const context = {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    drawImage(image, x, y, width, height) { drawn.push({ image, x, y, width, height }); },
    fillRect() {},
    strokeRect() {}
  };
  const image = {};
  const assets = new Map([
    ["asset.hazards.expansion.flame_vent.warning_01", image],
    ["asset.hazards.expansion.frost_rune.spent_01", image],
    ["asset.vfx.expansion.warden.doom_sigil.charge.charge_01", image]
  ]);
  layers.drawHazardsLayer(context, {
    nowMs: 0,
    depth: 70,
    pits: [], spikes: [], mines: [],
    flameVents: [{ x: 2, y: 2, fuseTurns: 1, activeFlash: 0 }],
    frostRunes: [{ x: 3, y: 3, spent: true, activeFlash: 0 }],
    doomSigils: [{ x: 4, y: 4, fuseTurns: 2 }]
  }, assets);
  assert.equal(drawn.length, 3);

  const telegraphAssets = new Map([
    ["asset.vfx.expansion.warden.void_step.afterimage.afterimage_01", { key: "void-step" }],
    ["asset.vfx.expansion.warden.rift_lattice.horizontal.horizontal_01", { key: "lattice-horizontal" }],
    ["asset.vfx.expansion.warden.rift_lattice.vertical.vertical_01", { key: "lattice-vertical" }],
    ["asset.vfx.expansion.warden.rift_lattice.intersection.intersection_01", { key: "lattice-intersection" }],
    ["asset.vfx.expansion.warden.soul_chain.segment.horizontal.segment_01", { key: "soul-chain-segment" }],
    ["asset.vfx.expansion.warden.soul_chain.hook.south.hook_01", { key: "soul-chain-hook" }]
  ]);
  context.save = () => {};
  context.restore = () => {};
  layers.DEFAULT_LAYERS.telegraphs(context, {
    nowMs: 0,
    enemies: [{
      type: "warden", x: 4, y: 4, facing: "south",
      voidStepAiming: true, voidStepOriginX: 4, voidStepOriginY: 4,
      latticeAiming: true, latticeRows: [4], latticeColumns: [4],
      soulChainAiming: true, soulChainTiles: [{ x: 5, y: 4 }]
    }]
  }, telegraphAssets);
  const animatedTelegraphs = new Set(drawn.map((entry) => entry.image.key).filter(Boolean));
  for (const key of ["void-step", "lattice-horizontal", "lattice-vertical", "lattice-intersection", "soul-chain-segment", "soul-chain-hook"]) {
    assert.ok(animatedTelegraphs.has(key), key);
  }
  const procedural = vfx.collectTelegraphCommands({
    nowMs: 0,
    enemies: [{
      latticeAiming: true, latticeRows: [4], latticeColumns: [4],
      voidStepAiming: true, voidStepOriginX: 4, voidStepOriginY: 4,
      soulChainAiming: true, soulChainTiles: [{ x: 5, y: 4 }]
    }]
  }, { quality: "high" });
  assert.ok(procedural.every((command) => !["lattice-area", "voidstep-area", "soul-chain-area"].includes(command.kind)));
});

test("visual events are defensively snapshotted and resolve to expansion frames", () => {
  const source = {
    visualEvents: [{
      kind: "riftweaver_rift_detonate",
      x: 4,
      y: 4,
      facing: "south",
      startedAtMs: 100,
      durationMs: 400,
      tiles: [{ x: 4, y: 4 }]
    }]
  };
  const snapshot = visualSnapshot.createVisualSnapshot(source, 200);
  source.visualEvents[0].tiles[0].x = 1;
  assert.equal(snapshot.visualEvents[0].tiles[0].x, 4);
  const commands = vfx.collectVfxCommands(snapshot, { quality: "high" });
  const spatialRift = commands.find((command) => (
    command.kind === "asset-vfx" &&
    command.key.startsWith("asset.vfx.expansion.riftweaver.spatial_rift.detonation.detonation_")
  ));
  assert.equal(spatialRift.width, 192 * 1.3);
  assert.equal(spatialRift.height, 192 * 1.3);
  assert.equal(spatialRift.y, 4 * 64 + 32 - (192 * 1.3) / 2 - 64 * 0.25);
  const telegraphs = vfx.collectTelegraphCommands({
    nowMs: 200,
    enemies: [{ riftAiming: true, riftTargetX: 4, riftTargetY: 4 }]
  }, { quality: "high" });
  assert.ok(telegraphs.every((command) => command.kind !== "rift-area"));
});