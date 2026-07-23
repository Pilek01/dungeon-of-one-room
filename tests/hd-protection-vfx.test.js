const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const BUILDER = path.join(ROOT, "scripts", "build-protection-vfx-assets.py");
const LOCK = path.join(ROOT, "art", "source", "protection-vfx-hd", "protection-vfx-assets.lock.json");
const CLASSIC_SOURCES = Object.freeze({
  shield: ["assets/sprite/shield/shield.png", "953e7fe0e492a3f96da7bf6e0f2e00713d3ef5d74239e10687e816953fba2d48"],
  barrier: ["assets/sprite/shield/barrier.png", "7ed2afaf5ee81113a8c2ea72cb1499d46d06c46bcba3f81f7e705c8d21b07613"],
  aegis: ["assets/sprite/shield/voidaegis.png", "261972fe3dad253b6914467f99f7feee5a34b6a9063551d0292910f511d6e017"]
});
const EFFECTS = Object.freeze([
  ["player-shield", 128],
  ["player-barrier", 128],
  ["blacksmith-barrier", 256],
  ["warden-aegis", 256]
]);

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function expectedFrames() {
  return EFFECTS.flatMap(([effect, size]) => ["rear", "front"].flatMap((layer) => (
    Array.from({ length: 8 }, (_, index) => {
      const suffix = String(index + 1).padStart(2, "0");
      const semanticEffect = effect.replaceAll("-", "_");
      return {
        effect,
        layer,
        size,
        suffix,
        key: `fx.protection.${semanticEffect}.${layer}.${suffix}`,
        src: `assets/hd/vfx/protection/${effect}/${layer}-${suffix}.png`
      };
    })
  )));
}

function drawingContext() {
  const calls = [];
  return {
    calls,
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    drawImage(image, x, y, width, height) {
      calls.push({ key: image.key, x, y, width, height, alpha: this.globalAlpha });
    },
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    arc() {},
    stroke() {},
    save() {},
    restore() {}
  };
}

function fakeAssets(keys) {
  return new Map(keys.map((key) => [key, Object.freeze({ key })]));
}

test("Classic protection references remain immutable", () => {
  for (const [relative, expectedHash] of Object.values(CLASSIC_SOURCES)) {
    const absolute = path.join(ROOT, ...relative.split("/"));
    assert.equal(fs.existsSync(absolute), true, `${relative} must remain available`);
    assert.equal(sha256(absolute), expectedHash, `${relative} must remain byte-identical`);
  }
});

test("protection pipeline publishes 64 optional semantic frames and a reproducible lock", () => {
  assert.equal(fs.existsSync(BUILDER), true, "the protection VFX builder must exist");
  assert.equal(fs.existsSync(LOCK), true, "the protection VFX lock must exist");
  const manifest = require(path.join(ROOT, "render", "hd-asset-manifest.js"));
  const expected = expectedFrames();
  for (const frame of expected) {
    const entry = manifest.getByKey(frame.key);
    assert.ok(entry, `missing manifest key ${frame.key}`);
    assert.equal(entry.src, frame.src);
    assert.equal(entry.group, "fx");
    assert.equal(entry.critical, false);
    assert.equal(fs.existsSync(path.join(ROOT, ...frame.src.split("/"))), true, `missing ${frame.src}`);
  }
  const lock = JSON.parse(fs.readFileSync(LOCK, "utf8"));
  assert.equal(lock.pipelineSchema, 1);
  assert.equal(lock.pillowVersion, "12.1.1");
  assert.deepEqual(Object.keys(lock.assets).sort(), expected.map((frame) => frame.src).sort());
  const check = spawnSync("python", [BUILDER, "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test("protection frames keep stable shells while contained energy changes phase", () => {
  const probe = String.raw`
import json, sys
from pathlib import Path
from PIL import Image, ImageChops

root=Path(sys.argv[1])
specs=json.loads(sys.argv[2])
results=[]
for effect,size in specs:
    effect_result={"effect":effect,"size":size,"layers":{}}
    for layer in ("rear","front"):
        frames=[]
        for index in range(1,9):
            path=root/f"assets/hd/vfx/protection/{effect}/{layer}-{index:02d}.png"
            with Image.open(path) as source:
                frames.append(source.convert("RGBA"))
        bounds=[frame.getchannel("A").getbbox() for frame in frames]
        corners=[[frame.getpixel(point)[3] for point in ((0,0),(size-1,0),(0,size-1),(size-1,size-1))] for frame in frames]
        changes=[sum(1 for pixel in ImageChops.difference(frames[0], frame).getdata() if pixel != (0,0,0,0)) for frame in frames[1:]]
        visible=[sum(1 for pixel in frame.getdata() if pixel[3] > 0) for frame in frames]
        chroma=sum(1 for frame in frames for r,g,b,a in frame.getdata() if a > 0 and (r,g,b)==(255,0,255))
        effect_result["layers"][layer]={"bounds":bounds,"corners":corners,"changes":changes,"visible":visible,"chroma":chroma}
    results.append(effect_result)
print(json.dumps(results))`;
  const run = spawnSync("python", ["-c", probe, ROOT, JSON.stringify(EFFECTS)], { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  for (const effect of JSON.parse(run.stdout)) {
    for (const [layer, metrics] of Object.entries(effect.layers)) {
      assert.ok(metrics.bounds.every((bounds) => JSON.stringify(bounds) === JSON.stringify(metrics.bounds[0])), `${effect.effect} ${layer} must keep stable bounds`);
      assert.ok(metrics.corners.flat().every((alpha) => alpha <= 8), `${effect.effect} ${layer} corners must stay clear`);
      assert.ok(metrics.changes.every((count) => count >= 40), `${effect.effect} ${layer} must animate internally`);
      assert.ok(metrics.visible.every((count) => count >= effect.size * 2), `${effect.effect} ${layer} must retain readable coverage`);
      assert.equal(metrics.chroma, 0, `${effect.effect} ${layer} must contain no chroma key`);
    }
  }
});

test("pure selection distinguishes all four effects, hit response, and reduced motion", () => {
  const layers = require(path.join(ROOT, "render", "hd-renderer-layers.js"));
  assert.equal(typeof layers.selectProtectionEffects, "function");
  const player = { x: 4, y: 4, skillShield: 20, hpShield: 15, hitFlash: 80 };
  const selected = layers.selectProtectionEffects({ nowMs: 450, player }, player);
  assert.deepEqual(selected.map((entry) => entry.kind), ["player-shield", "player-barrier"]);
  assert.ok(selected.every((entry) => entry.frame === 6));
  assert.ok(selected.every((entry) => entry.alpha > 0.8));
  const reduced = layers.selectProtectionEffects({ nowMs: 9999, player }, player, { reducedMotion: true });
  assert.ok(reduced.every((entry) => entry.frame === 1));
  assert.deepEqual(
    layers.selectProtectionEffects({ nowMs: 0 }, { type: "blacksmith_guardian", blacksmithBarrier: 1 }).map((entry) => entry.kind),
    ["blacksmith-barrier"]
  );
  assert.deepEqual(
    layers.selectProtectionEffects({ nowMs: 0 }, { type: "warden", voidAegisShield: 1 }).map((entry) => entry.kind),
    ["warden-aegis"]
  );
});

test("player protection draws rear layers, actor, then front layers with stable nesting", () => {
  const layers = require(path.join(ROOT, "render", "hd-renderer-layers.js"));
  const snapshot = {
    phase: "playing",
    nowMs: 0,
    player: { x: 4, y: 4, hp: 100, facing: "south", skillShield: 20, hpShield: 15 }
  };
  const keys = [
    "fx.protection.player_shield.rear.01",
    "fx.protection.player_barrier.rear.01",
    "actor.player.south.idle.01",
    "fx.protection.player_shield.front.01",
    "fx.protection.player_barrier.front.01",
    "ui.status.shield",
    "ui.status.barrier"
  ];
  const context = drawingContext();
  layers.drawPlayerLayer(context, snapshot, fakeAssets(keys));
  assert.deepEqual(context.calls.map((call) => call.key), keys);
  const protection = context.calls.filter((call) => call.key.startsWith("fx.protection"));
  assert.ok(protection.every((call) => Math.abs((call.x + call.width / 2) - (4 * 64 + 32)) < 0.001));
  const shield = protection.find((call) => call.key.includes("player_shield.rear"));
  const barrier = protection.find((call) => call.key.includes("player_barrier.rear"));
  assert.ok(barrier.width > shield.width, "persistent barrier must surround the inner Shield");
});

test("existing boss overlay identifiers remain available during the additive migration", () => {
  const manifest = require(path.join(ROOT, "render", "hd-asset-manifest.js"));
  for (const key of ["boss.blacksmith_guardian.overlay.barrier.01", "boss.warden.overlay.voidaegis.01"]) {
    assert.ok(manifest.getByKey(key), `${key} must not be renamed or removed`);
  }
});
