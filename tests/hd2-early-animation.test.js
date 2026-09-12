const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(file, enabled) {
  const context = { window: { location: { search: enabled ? '?hd2=1' : '' } }, URLSearchParams };
  vm.runInNewContext(fs.readFileSync(require.resolve('../render/' + file), 'utf8'), context);
  return context.window;
}
test('HD2 plays eight poses inside the unchanged 120ms player and enemy step', () => {
  const layers = load('hd-renderer-layers.js', true).DungeonHDRendererLayers;
  for (let frame = 1; frame <= 8; frame++) {
    const time = (frame - 1) * 15;
    const player = { x: 1, y: 1, hp: 100, facing: 'east', _tweenT: time, lastMoveX: 1 };
    const snapshot = { player, playerAnimTimer: 90000, nowMs: 90000 };
    const before = structuredClone(snapshot);
    assert.equal(layers.selectPlayerVisual(snapshot).frame, frame);
    for (const type of ['slime', 'skeleton']) {
      assert.equal(layers.selectEnemyVisual(snapshot, { type, hp: 10, facing: 'east', _tweenT: time }).frame, frame);
    }
    assert.deepEqual(snapshot, before);
  }
});
test('HD2 skeleton holds full draw while aiming and releases only on castFlash', () => {
  const layers = load('hd-renderer-layers.js', true).DungeonHDRendererLayers;
  assert.equal(layers.selectEnemyVisual({ nowMs: 90000 }, { type: 'skeleton', hp: 10, aiming: true, telegraphAge: 20 }).frame, 5);
  assert.equal(layers.selectEnemyVisual({}, { type: 'skeleton', hp: 10, castFlash: 140 }).frame, 6);
});
test('HD2 player uses all attack poses, immediate melee starts on impact and actor data stays unchanged', () => {
  const layers = load('hd-renderer-layers.js', true).DungeonHDRendererLayers;
  for (let frame = 1; frame <= 8; frame++) {
    const player = { hp: 100, visualAction: 'attack', visualActionTimer: 240 - (frame - 1) * 30 };
    assert.equal(layers.selectPlayerVisual({ player }).frame, frame);
    const slime = { id: 'slime', type: 'slime', hp: 10 };
    const before = structuredClone(slime);
    const selection = layers.selectEnemyVisual({ nowMs: (frame - 1) * 17.5, visualEvents: [{ kind: 'npc_melee', sourceId: 'slime', startedAtMs: 0, durationMs: 140 }] }, slime);
    assert.equal(selection.clip, 'attack');
    assert.ok(selection.frame >= 6 && selection.frame <= 8);
    assert.deepEqual(slime, before);
  }
  for (let frame = 1; frame <= 4; frame++) {
    const hitFlash = 120 - (frame - 1) * 30;
    assert.equal(layers.selectPlayerVisual({ player: { hp: 100, hitFlash } }).frame, frame);
    assert.equal(layers.selectEnemyVisual({}, { type: 'slime', hp: 10, hitFlash }).frame, frame);
  }
  assert.equal(layers.selectPlayerVisual({ player: { hp: 0, visualDeathTimer: 9999 } }).frame, 4);
  assert.equal(layers.selectEnemyVisual({}, { type: 'skeleton', hp: 10, castFlash: 1 }).frame, 8);
});
test('every HD2 runtime key resolves to a packaged 128px RGBA PNG', () => {
  const path = require('node:path');
  const manifest = load('hd-asset-manifest.js', true).DungeonHDAssetManifest;
  const entries = manifest.entries.filter(e => e.src.startsWith('assets/hd/early-v2/'));
  assert.equal(entries.length, 384);
  for (const entry of entries) {
    const bytes = fs.readFileSync(path.resolve(__dirname, '..', entry.src));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG', entry.src);
    assert.equal(bytes.readUInt32BE(16), 128, entry.src);
    assert.equal(bytes.readUInt32BE(20), 128, entry.src);
    assert.equal(bytes[25], 6, 'RGBA required: ' + entry.src);
  }
});
test('HD2 is opt-in and does not redirect non-actor assets or the original manifest', () => {
  const old = load('hd-asset-manifest.js', false).DungeonHDAssetManifest;
  const next = load('hd-asset-manifest.js', true).DungeonHDAssetManifest;
  const oldEntries = old.entries || old;
  const newEntries = next.entries || next;
  assert.ok(Array.isArray(oldEntries));
  const newPlayer = newEntries.filter(e => e.key.startsWith('actor.player.') && /\.\d\d$/.test(e.key));
  assert.equal(newPlayer.length, 128);
  assert.ok(newPlayer.every(e => e.src.startsWith('assets/hd/early-v2/player/')));
  for (const entry of oldEntries.filter(e => !/^(actor\.|enemy\.|boss\.)/.test(e.key))) {
    assert.equal(newEntries.find(e => e.key === entry.key).src, entry.src);
  }
});
