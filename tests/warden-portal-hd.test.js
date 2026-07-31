const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const manifest = require(path.join(root, "render", "hd-asset-manifest.js"));
const layers = require(path.join(root, "render", "hd-renderer-layers.js"));
const sourceRoot = path.join(root, "assets", "hd", "objects", "common");
const wardenRoot = path.join(root, "assets", "hd", "objects", "warden");
const lock = JSON.parse(fs.readFileSync(
  path.join(root, "art", "source", "warden-portal-hd", "warden-portal-hd.lock.json"),
  "utf8"
));

const ASSET_PAIRS = Object.freeze([
  ["portal-frame.png", "portal-frame.png"],
  ["portal-inactive.png", "portal-inactive.png"],
  ...[1, 2, 3].map((index) => { const suffix = String(index).padStart(2, "0"); return [`portal-active-${suffix}.png`, `portal-active${suffix}.png`]; }),
  ...Array.from({ length: 8 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    return [`portal-swirl-${suffix}.png`, `portal-swirl${suffix}.png`];
  })
]);

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function fakeAssets(keys) {
  return new Map(keys.map((key) => [key, Object.freeze({ key })]));
}

function drawingContext() {
  const calls = [];
  return {
    calls,
    fillStyle: "",
    save() {}, restore() {}, fillRect() {},
    drawImage(image, x, y, width, height) { calls.push({ key: image.key, x, y, width, height }); }
  };
}

test("Warden HD portal assets match the locked ordinary-portal derivation", () => {
  assert.equal(lock.formatVersion, 1);
  assert.equal(lock.invariants.swirlFrameMs, 80);
  assert.deepEqual(
    fs.readdirSync(wardenRoot).filter((name) => name.endsWith(".png")).sort(),
    ASSET_PAIRS.map(([, target]) => target).sort()
  );

  for (const [sourceName, targetName] of ASSET_PAIRS) {
    const sourcePath = path.join(sourceRoot, sourceName);
    const targetPath = path.join(wardenRoot, targetName);
    assert.equal(sha256(sourcePath), lock.sourceAssets[`assets/hd/objects/common/${sourceName}`]);
    assert.equal(sha256(targetPath), lock.outputAssets[`assets/hd/objects/warden/${targetName}`]);
  }
  assert.equal(
    sha256(path.join(sourceRoot, "portal-frame.png")),
    sha256(path.join(wardenRoot, "portal-frame.png")),
    "Warden frame must be the ordinary portal frame"
  );
  assert.equal(
    sha256(path.join(sourceRoot, "portal-inactive.png")),
    sha256(path.join(wardenRoot, "portal-inactive.png")),
    "Warden inactive portal must be the ordinary inactive portal"
  );
});

test("Warden animation preserves the ordinary portal silhouette while replacing energy with crimson", () => {
  const script = String.raw`
import json, sys
from pathlib import Path
from PIL import Image
source_root=Path(sys.argv[1]); target_root=Path(sys.argv[2]); pairs=json.loads(sys.argv[3]); result=[]
for source_name,target_name in pairs:
    with Image.open(source_root/source_name) as source_image, Image.open(target_root/target_name) as target_image:
        source=source_image.convert("RGBA"); target=target_image.convert("RGBA")
        source_pixels=list(source.get_flattened_data()); target_pixels=list(target.get_flattened_data())
        changed=[(before,after) for before,after in zip(source_pixels,target_pixels) if before!=after]
        result.append({
            "source":source_name,
            "target":target_name,
            "size":[source.width,source.height],
            "alphaChanged":sum(before[3]!=after[3] for before,after in zip(source_pixels,target_pixels)),
            "sourceBounds":source.getchannel("A").getbbox(),
            "targetBounds":target.getchannel("A").getbbox(),
            "changed":len(changed),
            "crimsonChanged":sum(after[3]>0 and after[0]>after[1]*1.08 and after[0]>after[2]*1.08 for before,after in changed),
            "blueChanged":sum(after[3]>0 and after[2]>after[0]*1.08 and after[2]>after[1]*1.08 for before,after in changed)
        })
print(json.dumps(result))`;
  const result = spawnSync("python", [
    "-c", script, sourceRoot, wardenRoot, JSON.stringify(ASSET_PAIRS)
  ], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const metrics = JSON.parse(result.stdout);
  for (const metric of metrics) {
    assert.deepEqual(metric.size, [128, 128]);
    assert.equal(metric.alphaChanged, 0, `${metric.target} changed alpha`);
    assert.deepEqual(metric.targetBounds, metric.sourceBounds, `${metric.target} changed its silhouette`);
    if (metric.target === "portal-frame.png" || metric.target === "portal-inactive.png") {
      assert.equal(metric.changed, 0, `${metric.target} must remain byte-identical in pixels`);
    } else {
      assert.ok(metric.changed > 0, `${metric.target} must replace blue energy`);
      assert.equal(metric.crimsonChanged, metric.changed, `${metric.target} must be crimson`);
      assert.equal(metric.blueChanged, 0, `${metric.target} must contain no replaced blue energy`);
    }
  }
});

test("Warden portal registers its own HD art but renders at ordinary portal scale", () => {
  const expectedEntries = [
    ...["inactive", "active01", "active02", "active03"].map((state) => [
      `object.warden.portal.${state}`,
      `assets/hd/objects/warden/portal-${state}.png`
    ]),
    ["object.warden.portal.frame", "assets/hd/objects/warden/portal-frame.png"],
    ...Array.from({ length: 8 }, (_, index) => {
      const suffix = String(index + 1).padStart(2, "0");
      return [`object.warden.portal.swirl${suffix}`, `assets/hd/objects/warden/portal-swirl${suffix}.png`];
    })
  ];
  for (const [key, src] of expectedEntries) {
    assert.deepEqual(manifest.entries.find((entry) => entry.key === key), {
      key, src, group: "objects", critical: false
    });
  }

  const wardenContext = drawingContext();
  layers.drawObjectsLayer(wardenContext, {
    roomCleared: true,
    portal: { x: 7, y: 7, active: true, kind: "warden" },
    nowMs: 0
  }, fakeAssets(["object.warden.portal.frame", "object.warden.portal.swirl01"]));
  assert.deepEqual(wardenContext.calls.map((call) => call.key), [
    "object.warden.portal.frame",
    "object.warden.portal.swirl01"
  ]);

  const normalContext = drawingContext();
  layers.drawObjectsLayer(normalContext, {
    roomCleared: true,
    portal: { x: 7, y: 7, active: true },
    nowMs: 0
  }, fakeAssets(["object.common.portal.frame", "object.common.portal.swirl01"]));
  assert.deepEqual(normalContext.calls.map((call) => call.key), [
    "object.common.portal.frame",
    "object.common.portal.swirl01"
  ]);
  assert.deepEqual(
    wardenContext.calls.map(({ width, height }) => ({ width, height })),
    normalContext.calls.map(({ width, height }) => ({ width, height }))
  );
  assert.deepEqual(wardenContext.calls.map(({ width, height }) => ({ width, height })), [
    { width: 96, height: 96 },
    { width: 96, height: 96 }
  ]);

  const fallbackContext = drawingContext();
  layers.drawObjectsLayer(fallbackContext, {
    roomCleared: true,
    portal: { x: 7, y: 7, active: true, kind: "warden" },
    nowMs: 0
  }, fakeAssets(["object.common.portal.frame", "object.common.portal.swirl01"]));
  assert.deepEqual(fallbackContext.calls.map((call) => call.key), [
    "object.common.portal.frame",
    "object.common.portal.swirl01"
  ]);
  assert.deepEqual(fallbackContext.calls.map(({ width, height }) => ({ width, height })), [
    { width: 96, height: 96 },
    { width: 96, height: 96 }
  ]);
});