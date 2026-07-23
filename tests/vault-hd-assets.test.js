const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = require("../render/hd-asset-manifest.js");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const layers = fs.readFileSync(path.join(root, "render", "hd-renderer-layers.js"), "utf8");
const vfx = fs.readFileSync(path.join(root, "render", "hd-vfx.js"), "utf8");

const expectedPrefixes = [
  "object.vault.chest_lock.lock",
  "object.vault.chest_destroyed.debris",
  "vfx.vault.hoard_sentence.mark.mark",
  "vfx.vault.hoard_sentence.cast.cast",
  "vfx.vault.seal_break.break",
  "vfx.vault.lockdown.tile.tile",
  "vfx.vault.lockdown.anchor.anchor",
  "vfx.vault.lockdown.detonation.detonation"
];

const vaultEntries = manifest.entries.filter((entry) =>
  expectedPrefixes.some((prefix) => entry.key.startsWith(prefix))
);
assert.equal(vaultEntries.length, 32);
for (const entry of vaultEntries) {
  assert.equal(entry.critical, false, `${entry.key} must remain optional`);
  const assetPath = path.join(root, entry.src);
  assert.equal(fs.existsSync(assetPath), true, `${entry.key} path must exist`);
  const png = fs.readFileSync(assetPath);
  assert.equal(png.readUInt32BE(16), 128, `${entry.key} width`);
  assert.equal(png.readUInt32BE(20), 128, `${entry.key} height`);
  assert.equal(png[25], 6, `${entry.key} must be RGBA PNG`);
}

assert.match(layers, /object\.vault\.chest_lock\.lock\$\{frame\}/);
assert.match(layers, /object\.vault\.chest_destroyed\.debris04/);
assert.match(layers, /drawTelegraphs\(context, snapshot, undefined, assets\)/);
assert.match(vfx, /vfx\.vault\.hoard_sentence\.mark\.mark\$\{command\.frame\}/);
assert.match(vfx, /vfx\.vault\.lockdown\.tile\.tile\$\{command\.frame\}/);
assert.match(vfx, /vfx\.vault\.lockdown\.anchor\.anchor\$\{command\.frame\}/);
assert.match(game, /emitVisualEvent\("vault_hoard_sentence_cast"/);
assert.match(game, /emitVisualEvent\("vault_lockdown_detonate"/);
assert.match(game, /emitVisualEvent\("vault_seal_break"/);
assert.doesNotMatch(game, /vault_guardian_spell_frames/);

console.log("vault HD asset tests: OK");