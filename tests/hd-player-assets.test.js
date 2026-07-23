const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const manifestApi = require(path.join(projectRoot, "render", "hd-asset-manifest.js"));
const layersApi = require(path.join(projectRoot, "render", "hd-renderer-layers.js"));
const rendererApi = require(path.join(projectRoot, "render", "hd-renderer.js"));
const visualSnapshotApi = require(path.join(projectRoot, "render", "visual-snapshot.js"));

const DIRECTIONS = Object.freeze(["south", "north", "east", "west"]);
const CLIPS = Object.freeze([
  Object.freeze({ name: "idle", frameCount: 4, fps: 4, loop: true }),
  Object.freeze({ name: "move", frameCount: 4, fps: 8, loop: true }),
  Object.freeze({ name: "attack", frameCount: 4, fps: 12, loop: false }),
  Object.freeze({ name: "hit", frameCount: 2, fps: 10, loop: false }),
  Object.freeze({ name: "death", frameCount: 2, fps: 6, loop: false })
]);
const FRAME_SIZE = Object.freeze([64, 64]);
const ANCHOR = Object.freeze([0.5, 1]);
const SEED_SOURCE = "art/source/player-hd/player-south-idle-seed.png";
const KEYED_SEED = "art/source/player-hd/player-south-idle-keyed.png";
const NORMALIZED_SEED = "art/source/player-hd/player-south-idle-preview-64.png";
const COMPARISON_PREVIEW = "art/source/player-hd/player-seed-comparison.png";
const REJECTED_ATLAS = "art/source/player-hd/player-animation-atlas-rejected-layout.png";
const REJECTED_ANALYSIS = "art/source/player-hd/player-animation-rejected-layout-analysis.json";
const REJECTED_PREVIEW = "art/source/player-hd/player-animation-rejected-layout-components.png";
const DIRECTION_ANCHOR_PREVIEW = "art/source/player-hd/player-direction-anchor-comparison.png";
const DIRECTION_PROMPTS = "art/briefs/player-hd-direction-prompts.json";
const OBSOLETE_EDIT_CANVAS = "art/source/player-hd/player-animation-edit-canvas-1024.png";
const SOURCE_SHEETS = Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => [
  direction,
  `art/source/player-hd/player-animation-${direction}-source-1024.png`
])));
const NORMALIZED_SHEETS = Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => [
  direction,
  `art/source/player-hd/player-animation-${direction}-normalized-1024.png`
])));
const SOURCE_SHEET_SHA256 = Object.freeze({
  south: "8945c8f41ea083cf5717072058466fd9ec19c8ebee77653956e1fcaea04e66d3",
  north: "ff130a2efd2677d758048a14bf697f7e0714d3167d0571444b9fcb648d74c861",
  east: "19da543aea6592de7cbdd398bcf6be551abef96eb1c323906f0338eb39a6fe40",
  west: "25f525a787acf7dca43b62fb51c31a1406d0e9f30da876cffb3ddaca7324db24"
});
const SOURCE_LAYOUT_REPORT = "art/source/player-hd/player-animation-source-layout.json";
const PLAYER_CONTACT_SHEET = "art/source/player-hd/player-animation-contact-sheet.png";
const PLAYER_BUILD_LOCK = "art/source/player-hd/player-animation-assets.lock.json";
const PLAYER_BUILD_SCRIPT = "scripts/build-player-animation-assets.py";
const EDIT_CANVASES = Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => [
  direction,
  `art/source/player-hd/player-animation-${direction}-edit-canvas-1024.png`
])));
const DIRECTION_ANCHORS = Object.freeze({
  south: NORMALIZED_SEED,
  north: "art/source/player-hd/player-north-idle-anchor-preview-64.png",
  east: "art/source/player-hd/player-east-idle-anchor-preview-64.png",
  west: "art/source/player-hd/player-west-idle-anchor-preview-64.png"
});
const SEED_PREP_LOCK = "art/source/player-hd/player-seed-prep.lock.json";
const SEED_PREP_SCRIPT = "scripts/prepare-player-seed-assets.py";
const SEED_SOURCE_SHA256 = "c890fc3c09eb7537faa2350793a1d6919f64dc31a6a85d2232d3d37ae46f474d";
const REJECTED_ATLAS_SHA256 = "3ae0de590ca039525d1db721c1539df146affc57a90939631cfccbc667d96d64";
const CHROMA_HELPER_SHA256 = "7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea";
const PLAYER_MANIFEST = "assets/hd/actors/player/player-manifest.json";

function expectedFrames() {
  const frames = [];
  for (const direction of DIRECTIONS) {
    for (const clip of CLIPS) {
      for (let frame = 1; frame <= clip.frameCount; frame += 1) {
        const suffix = String(frame).padStart(2, "0");
        frames.push(Object.freeze({
          direction,
          clip: clip.name,
          frame,
          key: `actor.player.${direction}.${clip.name}.${suffix}`,
          src: `assets/hd/actors/player/frames/${direction}-${clip.name}-${suffix}.png`,
          group: "player",
          critical: true
        }));
      }
    }
  }
  return Object.freeze(frames);
}

const FINAL_FRAMES = expectedFrames();

function absolute(relativePath) {
  return path.join(projectRoot, ...relativePath.split("/"));
}

function readPlayerManifest() {
  if (!fs.existsSync(absolute(PLAYER_MANIFEST))) return null;
  return JSON.parse(fs.readFileSync(absolute(PLAYER_MANIFEST), "utf8"));
}

function createCanvas() {
  const classes = new Set();
  return {
    width: 999,
    height: 999,
    dataset: {},
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      }
    }
  };
}

test("the approved south-facing seed source exists before production expansion", () => {
  const sourcePath = absolute(SEED_SOURCE);
  assert.equal(fs.existsSync(sourcePath), true, `missing ImageGen seed source ${SEED_SOURCE}`);
  const bytes = fs.readFileSync(sourcePath);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), SEED_SOURCE_SHA256);

  const probe = spawnSync("python", ["-c", String.raw`
from PIL import Image
import sys
with Image.open(sys.argv[1]) as image:
    print(f"{image.width}x{image.height} {image.mode}")
`, sourcePath], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr);
  assert.equal(probe.stdout.trim(), "1254x1254 RGB");
});

test("the rejected atlas is preserved as immutable evidence and diagnosed as 70 poses in a 10x7 layout", () => {
  const rejectedPath = absolute(REJECTED_ATLAS);
  assert.equal(fs.existsSync(rejectedPath), true, `missing rejected ImageGen evidence ${REJECTED_ATLAS}`);
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(rejectedPath)).digest("hex"),
    REJECTED_ATLAS_SHA256
  );
  assert.equal(fs.existsSync(absolute(REJECTED_ANALYSIS)), true, `missing ${REJECTED_ANALYSIS}`);
  assert.equal(fs.existsSync(absolute(REJECTED_PREVIEW)), true, `missing ${REJECTED_PREVIEW}`);
  const analysis = JSON.parse(fs.readFileSync(absolute(REJECTED_ANALYSIS), "utf8"));
  assert.equal(analysis.schemaVersion, 1);
  assert.deepEqual(analysis.source, {
    path: REJECTED_ATLAS,
    sha256: REJECTED_ATLAS_SHA256,
    width: 1254,
    height: 1254,
    mode: "RGB"
  });
  assert.equal(analysis.shippable, false);
  assert.equal(analysis.helperDetectedKey, "#f603f4");
  assert.equal(analysis.componentCount, 70);
  assert.equal(analysis.rawComponentCount, 72);
  assert.equal(analysis.detectedLayout, "10x7");
  assert.equal(analysis.requiredLayout, "8x8");
  assert.equal(analysis.columnClusters.length, 10);
  assert.ok(analysis.columnClusters.every((cluster) => cluster.count === 7));
  assert.equal(analysis.rowClusters.length, 7);
  assert.ok(analysis.rowClusters.every((cluster) => cluster.count === 10));
  assert.match(analysis.rejectionReason, /70|10x7|64|8x8|semantic/i);
  assert.deepEqual(analysis.directionAnchors.north.grid, [3, 1]);
  assert.deepEqual(analysis.directionAnchors.east.grid, [4, 1]);
  assert.deepEqual(analysis.directionAnchors.west.grid, [6, 1]);

  const previewProbe = spawnSync("python", ["-c", String.raw`
from PIL import Image
import sys
with Image.open(sys.argv[1]) as image:
    print(f"{image.width}x{image.height} {image.mode}")
`, absolute(REJECTED_PREVIEW)], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(previewProbe.status, 0, previewProbe.stderr);
  assert.equal(previewProbe.stdout.trim(), "1400x1400 RGBA");
});

test("rejected-atlas key evidence is parsed from the pinned helper diagnostic", () => {
  const probe = spawnSync("python", ["-c", String.raw`
import runpy
import sys

namespace = runpy.run_path(sys.argv[1])
parse = namespace.get("parse_helper_key")
assert callable(parse), "seed prep must expose parse_helper_key"
assert parse("Wrote output.png\nKey color: #f603f4\nTransparent pixels: 10/20\n") == "#f603f4"
assert parse("Key color: #ABCDEF\n") == "#abcdef"
try:
    parse("no key diagnostic")
except RuntimeError as error:
    assert "Key color" in str(error)
else:
    raise AssertionError("missing helper key diagnostic was accepted")
print("helper key diagnostic parsed")
`, absolute(SEED_PREP_SCRIPT)], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
  assert.match(probe.stdout, /helper key diagnostic parsed/);
});

test("prepared seed outputs remove chroma and preserve a meaningful bottom-centered silhouette", () => {
  const required = [KEYED_SEED, NORMALIZED_SEED, COMPARISON_PREVIEW];
  const missing = required.filter((relativePath) => !fs.existsSync(absolute(relativePath)));
  assert.deepEqual(missing, [], `missing prepared seed outputs: ${missing.join(", ")}`);

  const probe = spawnSync("python", ["-c", String.raw`
import json
import sys
from PIL import Image

results = []
for raw_path in sys.argv[1:]:
    with Image.open(raw_path) as source:
        source.load()
        image = source.convert("RGBA")
        pixels = list(image.get_flattened_data())
        visible = [(i % image.width, i // image.width) for i, pixel in enumerate(pixels) if pixel[3] > 0]
        exact = sum(1 for red, green, blue, alpha in pixels if alpha > 0 and (red, green, blue) == (255, 0, 255))
        near = sum(1 for red, green, blue, alpha in pixels
                   if 0 < alpha <= 128
                   and (red - 255) ** 2 + green ** 2 + (blue - 255) ** 2 <= 48 ** 2
                   and red - green >= 96 and blue - green >= 96
                   and abs(red - blue) <= 64)
        if visible:
            xs = [point[0] for point in visible]
            ys = [point[1] for point in visible]
            bounds = [min(xs), min(ys), max(xs), max(ys)]
        else:
            bounds = None
        results.append({
            "mode": source.mode,
            "size": list(source.size),
            "visible": len(visible),
            "exact": exact,
            "near": near,
            "bounds": bounds,
            "corners": [image.getpixel(point)[3] for point in (
                (0, 0), (image.width - 1, 0),
                (0, image.height - 1), (image.width - 1, image.height - 1),
            )],
        })
print(json.dumps(results))
`, ...required.map(absolute)], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || "prepared seed pixel probe failed");
  const [keyed, normalized, comparison] = JSON.parse(probe.stdout);

  assert.equal(keyed.mode, "RGBA");
  assert.deepEqual(keyed.size, [1254, 1254]);
  assert.equal(keyed.exact, 0);
  assert.equal(keyed.near, 0);
  assert.ok(keyed.visible >= 250000 && keyed.visible <= 650000, "keyed source lost or retained implausible coverage");
  assert.deepEqual(keyed.corners, [0, 0, 0, 0]);

  assert.equal(normalized.mode, "RGBA");
  assert.deepEqual(normalized.size, [64, 64]);
  assert.equal(normalized.exact, 0);
  assert.equal(normalized.near, 0);
  assert.ok(normalized.visible >= 700 && normalized.visible <= 2200, "64 px preview has implausible coverage");
  assert.deepEqual(normalized.corners, [0, 0, 0, 0]);
  assert.ok(normalized.bounds);
  const [left, top, right, bottom] = normalized.bounds;
  assert.ok(top >= 2 && top <= 10, `64 px seed top padding drifted to ${top}`);
  assert.ok(bottom >= 59 && bottom <= 61, `64 px seed root drifted to ${bottom}`);
  assert.ok((left + right) / 2 >= 30 && (left + right) / 2 <= 34, "64 px seed is not bottom-center aligned");
  assert.ok(right - left + 1 <= 58, "64 px seed lost horizontal padding");

  assert.equal(comparison.mode, "RGBA");
  assert.deepEqual(comparison.size, [1440, 360]);
});

test("north east and west preview anchors share the 64 px root and have a labeled confidence preview", () => {
  const required = [...DIRECTIONS.slice(1).map((direction) => DIRECTION_ANCHORS[direction]), DIRECTION_ANCHOR_PREVIEW];
  const missing = required.filter((relativePath) => !fs.existsSync(absolute(relativePath)));
  assert.deepEqual(missing, [], `missing direction anchor previews: ${missing.join(", ")}`);
  const probe = spawnSync("python", ["-c", String.raw`
import json
import sys
from PIL import Image

results = []
for raw_path in sys.argv[1:]:
    with Image.open(raw_path) as source:
        image = source.convert("RGBA")
        points = [(i % image.width, i // image.width) for i, pixel in enumerate(image.get_flattened_data()) if pixel[3] > 0]
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        results.append({
            "mode": source.mode,
            "size": list(source.size),
            "visible": len(points),
            "bounds": [min(xs), min(ys), max(xs), max(ys)] if points else None,
        })
print(json.dumps(results))
`, ...DIRECTIONS.slice(1).map((direction) => absolute(DIRECTION_ANCHORS[direction])), absolute(DIRECTION_ANCHOR_PREVIEW)], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  assert.equal(probe.status, 0, probe.stderr || "direction anchor probe failed");
  const results = JSON.parse(probe.stdout);
  for (let index = 0; index < 3; index += 1) {
    const direction = DIRECTIONS[index + 1];
    const result = results[index];
    assert.equal(result.mode, "RGBA", direction);
    assert.deepEqual(result.size, [64, 64], direction);
    assert.ok(result.visible >= 700 && result.visible <= 2200, `${direction}: implausible anchor coverage`);
    assert.ok(result.bounds);
    assert.ok(result.bounds[1] >= 2 && result.bounds[1] <= 12, `${direction}: top padding drifted`);
    assert.ok(result.bounds[3] >= 59 && result.bounds[3] <= 61, `${direction}: root drifted`);
    assert.ok((result.bounds[0] + result.bounds[2]) / 2 >= 28 && (result.bounds[0] + result.bounds[2]) / 2 <= 36, `${direction}: center drifted`);
  }
  assert.equal(results[3].mode, "RGBA");
  assert.deepEqual(results[3].size, [1120, 320]);
});

test("four direction edit canvases are exact flat-key 4x4 targets with only idle01 populated", () => {
  assert.equal(
    fs.existsSync(absolute(OBSOLETE_EDIT_CANVAS)),
    false,
    "obsolete generic 8x8 edit canvas must not remain selectable"
  );
  const missing = DIRECTIONS.filter((direction) => !fs.existsSync(absolute(EDIT_CANVASES[direction])));
  assert.deepEqual(missing, [], `missing direction edit canvases: ${missing.join(", ")}`);
  const probe = spawnSync("python", ["-c", String.raw`
import json
import sys
from PIL import Image

results = []
for raw_path in sys.argv[1:]:
    with Image.open(raw_path) as source:
        source.load()
        assert source.mode == "RGB", source.mode
        assert source.size == (1024, 1024), source.size
        key = (255, 0, 255)
        outside_non_key = 0
        inside = []
        points = []
        for y in range(source.height):
            for x in range(source.width):
                pixel = source.getpixel((x, y))
                if x < 256 and y < 256:
                    inside.append(pixel)
                    if pixel != key:
                        points.append((x, y))
                elif pixel != key:
                    outside_non_key += 1
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        results.append({
            "outsideNonKey": outside_non_key,
            "insideNonKey": len(points),
            "insideKey": sum(pixel == key for pixel in inside),
            "bounds": [min(xs), min(ys), max(xs), max(ys)] if points else None,
        })
print(json.dumps(results))
`, ...DIRECTIONS.map((direction) => absolute(EDIT_CANVASES[direction]))], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || "edit canvas probe failed");
  const results = JSON.parse(probe.stdout);
  assert.equal(results.length, 4);
  for (let index = 0; index < results.length; index += 1) {
    const metrics = results[index];
    const direction = DIRECTIONS[index];
    assert.equal(metrics.outsideNonKey, 0, `${direction}: all 15 unused slots must remain flat #ff00ff`);
    assert.ok(metrics.insideNonKey >= 10000 && metrics.insideNonKey <= 40000, `${direction}: implausible R1C1 coverage`);
    assert.ok(metrics.insideKey > 25000, `${direction}: R1C1 needs generous key-color padding`);
    assert.ok(metrics.bounds);
    const [left, top, right, bottom] = metrics.bounds;
    assert.ok(top >= 8 && top <= 40, `${direction}: top padding drifted`);
    assert.ok(bottom >= 238 && bottom <= 246, `${direction}: edit-canvas root drifted to ${bottom}`);
    assert.ok((left + right) / 2 >= 120 && (left + right) / 2 <= 136, `${direction}: center drifted`);
    assert.ok(left >= 8 && right <= 247, `${direction}: R1C1 needs horizontal padding`);
  }
});

test("four generated direction sources are immutable 1254 px evidence with an unambiguous 4x4 semantic layout", () => {
  const missing = DIRECTIONS.filter((direction) => !fs.existsSync(absolute(SOURCE_SHEETS[direction])));
  assert.deepEqual(missing, [], `missing generated direction source sheets: ${missing.join(", ")}`);
  for (const direction of DIRECTIONS) {
    const bytes = fs.readFileSync(absolute(SOURCE_SHEETS[direction]));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), SOURCE_SHEET_SHA256[direction]);
  }

  assert.equal(fs.existsSync(absolute(SOURCE_LAYOUT_REPORT)), true, `missing ${SOURCE_LAYOUT_REPORT}`);
  const report = JSON.parse(fs.readFileSync(absolute(SOURCE_LAYOUT_REPORT), "utf8"));
  assert.equal(report.schemaVersion, 1);
  assert.deepEqual(report.directionOrder, DIRECTIONS);
  for (const direction of DIRECTIONS) {
    const source = report.sources[direction];
    assert.deepEqual(source.identity, {
      path: SOURCE_SHEETS[direction],
      sha256: SOURCE_SHEET_SHA256[direction],
      width: 1254,
      height: 1254,
      mode: "RGB"
    });
    assert.equal(source.semanticLayout, "4x4");
    assert.equal(source.occupiedSlotCount, 16);
    assert.equal(source.crossingComponentCount, 0);
    assert.deepEqual(Object.keys(source.slots), [
      "R1C1", "R1C2", "R1C3", "R1C4",
      "R2C1", "R2C2", "R2C3", "R2C4",
      "R3C1", "R3C2", "R3C3", "R3C4",
      "R4C1", "R4C2", "R4C3", "R4C4"
    ]);
    assert.ok(Object.values(source.slots).every((slot) => slot.meaningfulPixels >= 2000));
  }
  assert.equal(report.sources.north.slots.R4C4.meaningfulComponentCount, 2);
  assert.equal(report.sources.north.slots.R4C4.detachedProp, "sword");
});

test("semantic source validation rejects horizontal or vertical cross-slot overlap", () => {
  const probe = spawnSync("python", ["-c", String.raw`
import runpy
import sys

namespace = runpy.run_path(sys.argv[1])
find_crossing = namespace.get("find_crossing_components")
assert callable(find_crossing), "builder must expose find_crossing_components"

def component(left, top, right, bottom):
    return {"area": 1000, "bounds": [left, top, right, bottom], "points": []}

slots = {}
for row in range(4):
    for column in range(4):
        slots[f"R{row + 1}C{column + 1}"] = [component(column * 30 + 2, row * 30 + 2, column * 30 + 20, row * 30 + 20)]
assert find_crossing(slots) == []
slots["R1C1"][0]["bounds"][2] = slots["R1C2"][0]["bounds"][0]
assert len(find_crossing(slots)) == 2, "horizontal overlap was accepted"
slots["R1C1"][0]["bounds"][2] = 20
slots["R1C1"][0]["bounds"][3] = slots["R2C1"][0]["bounds"][1]
assert len(find_crossing(slots)) == 2, "vertical overlap was accepted"
print("cross-slot overlap rejected")
`, absolute(PLAYER_BUILD_SCRIPT)], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
  assert.match(probe.stdout, /cross-slot overlap rejected/);
});

test("normalized 1024 px 4x4 sheets preserve all semantic slots with flat chroma padding", () => {
  const missing = DIRECTIONS.filter((direction) => !fs.existsSync(absolute(NORMALIZED_SHEETS[direction])));
  assert.deepEqual(missing, [], `missing normalized direction sheets: ${missing.join(", ")}`);
  const probe = spawnSync("python", ["-c", String.raw`
import json
import sys
from PIL import Image

results = []
for raw_path in sys.argv[1:]:
    with Image.open(raw_path) as source:
        source.load()
        key = source.getpixel((0, 0))
        slot_counts = []
        border_non_key = 0
        for row in range(4):
            for column in range(4):
                crop = source.crop((column * 256, row * 256, (column + 1) * 256, (row + 1) * 256))
                pixels = list(crop.getdata())
                slot_counts.append(sum(pixel != key for pixel in pixels))
                for offset in range(256):
                    border_non_key += int(crop.getpixel((offset, 0)) != key)
                    border_non_key += int(crop.getpixel((offset, 255)) != key)
                    border_non_key += int(crop.getpixel((0, offset)) != key)
                    border_non_key += int(crop.getpixel((255, offset)) != key)
        results.append({"mode": source.mode, "size": list(source.size), "slotCounts": slot_counts, "borderNonKey": border_non_key})
print(json.dumps(results))
`, ...DIRECTIONS.map((direction) => absolute(NORMALIZED_SHEETS[direction]))], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || "normalized direction-sheet probe failed");
  for (const [index, result] of JSON.parse(probe.stdout).entries()) {
    const direction = DIRECTIONS[index];
    assert.equal(result.mode, "RGB", direction);
    assert.deepEqual(result.size, [1024, 1024], direction);
    assert.equal(result.slotCounts.length, 16, direction);
    assert.ok(result.slotCounts.every((count) => count >= 1500), `${direction}: every normalized slot needs one meaningful pose`);
    assert.equal(result.borderNonKey, 0, `${direction}: normalized poses must retain flat-key border padding`);
  }
});

test("four built-in edit prompts resolve identity, rejected reference, target canvas, and direction", () => {
  assert.equal(fs.existsSync(absolute(DIRECTION_PROMPTS)), true, `missing ${DIRECTION_PROMPTS}`);
  const prompts = JSON.parse(fs.readFileSync(absolute(DIRECTION_PROMPTS), "utf8"));
  assert.equal(prompts.schemaVersion, 1);
  assert.deepEqual(prompts.inputOrder, [SEED_SOURCE, REJECTED_ATLAS, "directionEditCanvas"]);
  assert.deepEqual(Object.keys(prompts.prompts), DIRECTIONS);
  for (const direction of DIRECTIONS) {
    const prompt = prompts.prompts[direction];
    assert.equal(typeof prompt, "string");
    assert.match(prompt, new RegExp(`one ${direction}-facing direction`, "i"));
    assert.ok(prompt.includes(`Image 1: ${SEED_SOURCE}`));
    assert.ok(prompt.includes(`Image 2: ${REJECTED_ATLAS}`));
    assert.ok(prompt.includes(`Image 3: ${EDIT_CANVASES[direction]}`));
    assert.ok(prompt.includes(`Output destination after generation: ${SOURCE_SHEETS[direction]}`));
    assert.match(prompt, /exactly 16 isolated full-body poses/i);
    assert.match(prompt, /4-column by 4-row/i);
    assert.match(prompt, /R1: idle01, idle02, idle03, idle04/);
    assert.match(prompt, /R4: hit01, hit02, death01, death02/);
    assert.doesNotMatch(prompt, /8-column|8x8|64 isolated/);
    assert.doesNotMatch(prompt, /<direction>/i);
  }
});

test("seed preparation is pinned, locked, isolated, and deterministic", () => {
  assert.equal(fs.existsSync(absolute(SEED_PREP_SCRIPT)), true, `missing ${SEED_PREP_SCRIPT}`);
  assert.equal(fs.existsSync(absolute(SEED_PREP_LOCK)), true, `missing ${SEED_PREP_LOCK}`);
  const lock = JSON.parse(fs.readFileSync(absolute(SEED_PREP_LOCK), "utf8"));
  assert.equal(lock.pipelineSchema, 2);
  assert.equal(lock.pillowVersion, "12.1.1");
  assert.equal(lock.helper.sha256, CHROMA_HELPER_SHA256);
  assert.deepEqual(lock.source, { path: SEED_SOURCE, sha256: SEED_SOURCE_SHA256, width: 1254, height: 1254, mode: "RGB" });
  assert.deepEqual(lock.rejectedSource, { path: REJECTED_ATLAS, sha256: REJECTED_ATLAS_SHA256, width: 1254, height: 1254, mode: "RGB" });

  const lockedOutputs = [
    KEYED_SEED,
    NORMALIZED_SEED,
    COMPARISON_PREVIEW,
    REJECTED_ANALYSIS,
    REJECTED_PREVIEW,
    DIRECTION_ANCHOR_PREVIEW,
    DIRECTION_PROMPTS,
    ...DIRECTIONS.slice(1).map((direction) => DIRECTION_ANCHORS[direction]),
    ...DIRECTIONS.map((direction) => EDIT_CANVASES[direction])
  ];
  assert.deepEqual(Object.keys(lock.outputs).sort(), [...lockedOutputs].sort());
  const before = lockedOutputs.map((relativePath) => {
    const bytes = fs.readFileSync(absolute(relativePath));
    const digest = crypto.createHash("sha256").update(bytes).digest("hex");
    assert.equal(digest, lock.outputs[relativePath], relativePath);
    return digest;
  });

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const check = spawnSync("python", [absolute(SEED_PREP_SCRIPT), "--check"], {
      cwd: projectRoot,
      encoding: "utf8"
    });
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.match(check.stdout, /Seed preparation lock verification passed/);
    assert.equal(fs.existsSync(absolute("art/work/player-seed-prep")), false, "staging tree survived --check");
  }

  const after = lockedOutputs.map((relativePath) => {
    const bytes = fs.readFileSync(absolute(relativePath));
    return crypto.createHash("sha256").update(bytes).digest("hex");
  });
  assert.deepEqual(after, before, "deterministic checks must not publish or alter prepared outputs");
});

test("concurrent seed preparation checks keep independent staging trees", async () => {
  function runCheck() {
    return new Promise((resolve) => {
      const child = spawn("python", [absolute(SEED_PREP_SCRIPT), "--check"], {
        cwd: projectRoot,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
  }

  const results = await Promise.all([runCheck(), runCheck()]);
  for (const result of results) {
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Seed preparation lock verification passed/);
  }
  assert.equal(
    fs.existsSync(absolute("art/work/player-seed-prep")),
    false,
    "seed-prep staging parent survived concurrent checks"
  );
});

test("seed preparation cleans its isolated staging tree after setup validation failure", () => {
  const missingHelper = absolute("art/work/missing-player-seed-helper.py");
  const result = spawnSync("python", [absolute(SEED_PREP_SCRIPT), "--check", "--helper", missingHelper], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0, "missing helper must fail seed preparation");
  assert.match(result.stderr, /chroma helper does not exist|FileNotFoundError/);
  assert.equal(
    fs.existsSync(absolute("art/work/player-seed-prep")),
    false,
    "seed-prep staging parent survived setup validation failure"
  );
});

test("player animation production is pinned, locked, deterministic, and preserves source bytes", () => {
  assert.equal(fs.existsSync(absolute(PLAYER_BUILD_SCRIPT)), true, `missing ${PLAYER_BUILD_SCRIPT}`);
  assert.equal(fs.existsSync(absolute(PLAYER_BUILD_LOCK)), true, `missing ${PLAYER_BUILD_LOCK}`);
  const lock = JSON.parse(fs.readFileSync(absolute(PLAYER_BUILD_LOCK), "utf8"));
  assert.equal(lock.pipelineSchema, 1);
  assert.equal(lock.pillowVersion, "12.1.1");
  assert.equal(lock.helper.sha256, CHROMA_HELPER_SHA256);
  assert.deepEqual(lock.sourceOrder, DIRECTIONS);
  for (const direction of DIRECTIONS) {
    assert.deepEqual(lock.sources[direction], {
      path: SOURCE_SHEETS[direction],
      sha256: SOURCE_SHEET_SHA256[direction],
      width: 1254,
      height: 1254,
      mode: "RGB"
    });
  }

  const lockedOutputs = [
    SOURCE_LAYOUT_REPORT,
    PLAYER_CONTACT_SHEET,
    ...DIRECTIONS.map((direction) => NORMALIZED_SHEETS[direction]),
    ...FINAL_FRAMES.map((frame) => frame.src),
    PLAYER_MANIFEST
  ];
  assert.deepEqual(Object.keys(lock.outputs).sort(), [...lockedOutputs].sort());
  const sourceBefore = DIRECTIONS.map((direction) => (
    crypto.createHash("sha256").update(fs.readFileSync(absolute(SOURCE_SHEETS[direction]))).digest("hex")
  ));
  const outputBefore = lockedOutputs.map((relativePath) => {
    const digest = crypto.createHash("sha256").update(fs.readFileSync(absolute(relativePath))).digest("hex");
    assert.equal(digest, lock.outputs[relativePath], relativePath);
    return digest;
  });

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const check = spawnSync("python", [absolute(PLAYER_BUILD_SCRIPT), "--check"], {
      cwd: projectRoot,
      encoding: "utf8"
    });
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.match(check.stdout, /Player animation lock verification passed/);
  }
  assert.deepEqual(DIRECTIONS.map((direction) => (
    crypto.createHash("sha256").update(fs.readFileSync(absolute(SOURCE_SHEETS[direction]))).digest("hex")
  )), sourceBefore, "source sheets changed during deterministic checks");
  assert.deepEqual(lockedOutputs.map((relativePath) => (
    crypto.createHash("sha256").update(fs.readFileSync(absolute(relativePath))).digest("hex")
  )), outputBefore, "deterministic checks altered published outputs");
  assert.equal(fs.existsSync(absolute("art/work/player-animation-build")), false, "staging tree survived checks");
});

test("the active HD manifest contains exactly the required 64 critical player frames", () => {
  const issues = [];
  const activePlayer = manifestApi.entries.filter((entry) => entry.group === "player");
  const expectedKeys = new Set(FINAL_FRAMES.map((frame) => frame.key));

  if (activePlayer.length !== FINAL_FRAMES.length) {
    issues.push(`expected 64 active player entries, received ${activePlayer.length}`);
  }
  for (const expected of FINAL_FRAMES) {
    const actual = activePlayer.find((entry) => entry.key === expected.key);
    if (!actual) {
      issues.push(`missing manifest key ${expected.key}`);
      continue;
    }
    for (const field of ["src", "group", "critical"]) {
      if (actual[field] !== expected[field]) {
        issues.push(`${expected.key} ${field}: expected ${expected[field]}, received ${actual[field]}`);
      }
    }
  }
  for (const actual of activePlayer) {
    if (!expectedKeys.has(actual.key)) issues.push(`unexpected active player key ${actual.key}`);
  }

  assert.deepEqual(issues, []);
});

test("player frame paths are unique even when the future catalog contains other assets", () => {
  const catalog = [...manifestApi.entries, ...manifestApi.stagedEntries];
  const allSources = catalog.map((entry) => entry.src);
  assert.equal(new Set(allSources).size, allSources.length, "HD catalog paths must not be duplicated");

  const expectedSources = FINAL_FRAMES.map((frame) => frame.src);
  assert.equal(new Set(expectedSources).size, 64, "the production player contract must have 64 unique paths");
  for (const src of expectedSources) {
    assert.match(src, /^assets\/hd\/actors\/player\/frames\/[a-z]+-[a-z]+-[0-9]{2}\.png$/);
  }
});

test("all 64 final player PNGs are 64x64 RGBA with meaningful anchored silhouettes", () => {
  const missing = FINAL_FRAMES.filter((frame) => !fs.existsSync(absolute(frame.src)));
  assert.deepEqual(missing.map((frame) => frame.src), [], `missing ${missing.length} final player PNGs`);

  const probeSource = String.raw`
import json
import sys
from pathlib import Path
from PIL import Image

results = []
for raw_path in sys.argv[1:]:
    path = Path(raw_path)
    with Image.open(path) as source:
        source.load()
        mode = source.mode
        image = source.convert("RGBA")
        pixels = list(image.getdata())
        visible_points = [
            (index % image.width, index // image.width)
            for index, (red, green, blue, alpha) in enumerate(pixels)
            if alpha > 0
        ]
        exact_chroma = sum(
            1 for red, green, blue, alpha in pixels
            if alpha > 0 and (red, green, blue) == (255, 0, 255)
        )
        near_chroma = sum(
            1 for red, green, blue, alpha in pixels
            if 0 < alpha <= 128
            and (red - 255) ** 2 + green ** 2 + (blue - 255) ** 2 <= 48 ** 2
            and red - green >= 96 and blue - green >= 96
            and abs(red - blue) <= 64
        )
        if visible_points:
            xs = [point[0] for point in visible_points]
            ys = [point[1] for point in visible_points]
            bounds = [min(xs), min(ys), max(xs), max(ys)]
        else:
            bounds = None
        results.append({
            "path": raw_path.replace("\\\\", "/"),
            "mode": mode,
            "width": image.width,
            "height": image.height,
            "visible": len(visible_points),
            "exactChroma": exact_chroma,
            "nearChroma": near_chroma,
            "bounds": bounds,
            "corners": [image.getpixel(point)[3] for point in (
                (0, 0), (image.width - 1, 0),
                (0, image.height - 1), (image.width - 1, image.height - 1),
            )],
        })
print(json.dumps(results))
`;
  const paths = FINAL_FRAMES.map((frame) => absolute(frame.src));
  const probe = spawnSync("python", ["-c", probeSource, ...paths], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  assert.equal(probe.status, 0, probe.stderr || "player PNG probe failed");
  const metrics = JSON.parse(probe.stdout);
  assert.equal(metrics.length, 64);

  const nonDeathHeights = [];
  for (let index = 0; index < metrics.length; index += 1) {
    const metric = metrics[index];
    const expected = FINAL_FRAMES[index];
    assert.equal(metric.mode, "RGBA", `${expected.src} must be stored as RGBA`);
    assert.deepEqual([metric.width, metric.height], FRAME_SIZE, expected.src);
    assert.equal(metric.exactChroma, 0, `${expected.src} contains visible #ff00ff`);
    assert.equal(metric.nearChroma, 0, `${expected.src} contains visible near-key magenta fringe`);
    assert.ok(metric.visible >= 220 && metric.visible <= 2800, `${expected.src} has implausible coverage`);
    assert.deepEqual(metric.corners, [0, 0, 0, 0], `${expected.src} needs transparent padding`);
    assert.ok(metric.bounds, `${expected.src} has no visible silhouette`);
    const [left, top, right, bottom] = metric.bounds;
    const width = right - left + 1;
    const height = bottom - top + 1;
    assert.ok(width >= 12 && width <= 60, `${expected.src} width is outside shared scale bounds`);
    assert.ok(height >= 12 && height <= 60, `${expected.src} height is outside shared scale bounds`);
    assert.ok(bottom >= 56 && bottom <= 62, `${expected.src} drifts from the bottom-center stance`);
    assert.ok((left + right) / 2 >= 23 && (left + right) / 2 <= 41, `${expected.src} drifts from center`);
    if (expected.clip !== "death") nonDeathHeights.push(height);
  }
  assert.ok(
    Math.max(...nonDeathHeights) - Math.min(...nonDeathHeights) <= 18,
    "non-death frames must retain one shared character scale"
  );
});

test("player-manifest fixes direction, clip, timing, anchor, and frame order", () => {
  const playerManifest = readPlayerManifest();
  assert.ok(playerManifest, `missing ${PLAYER_MANIFEST}`);
  assert.equal(playerManifest.schemaVersion, 1);
  assert.equal(playerManifest.actor, "player");
  assert.deepEqual(playerManifest.frameSize, FRAME_SIZE);
  assert.deepEqual(playerManifest.anchor, ANCHOR);
  assert.deepEqual(playerManifest.directions, DIRECTIONS);
  assert.deepEqual(playerManifest.clips, CLIPS);
  assert.deepEqual(
    playerManifest.frames,
    FINAL_FRAMES.map(({ direction, clip, frame, key, src }) => ({ direction, clip, frame, key, src }))
  );
  assert.equal(new Set(playerManifest.frames.map((frame) => frame.src)).size, 64);
});

test("player visual selection reads snapshot direction and visual signals without mutating simulation", () => {
  assert.equal(
    typeof layersApi.selectPlayerVisual,
    "function",
    "HD layers must export selectPlayerVisual(snapshot)"
  );

  const cases = [
    { name: "idle", source: { phase: "playing", player: { hp: 10, lastMoveX: 0, lastMoveY: 1, _tweenT: 120, hitFlash: 0 } }, direction: "south", clip: "idle" },
    { name: "move", source: { phase: "playing", player: { hp: 10, lastMoveX: -1, lastMoveY: 0, _tweenT: 40, hitFlash: 0 } }, direction: "west", clip: "move" },
    { name: "attack", source: { phase: "playing", player: { hp: 10, facing: "east", visualAction: "attack", _tweenT: 120, hitFlash: 0 } }, direction: "east", clip: "attack" },
    { name: "hit", source: { phase: "playing", player: { hp: 10, facing: "north", visualAction: "attack", _tweenT: 20, hitFlash: 80 } }, direction: "north", clip: "hit" },
    { name: "death", source: { phase: "dead", player: { hp: 0, facing: "south", visualAction: "attack", _tweenT: 20, hitFlash: 80 } }, direction: "south", clip: "death" }
  ];

  for (const item of cases) {
    const before = structuredClone(item.source);
    const snapshot = visualSnapshotApi.createVisualSnapshot(item.source, 240);
    const selected = layersApi.selectPlayerVisual(snapshot);
    assert.deepEqual(item.source, before, `${item.name} selection mutated simulation state`);
    assert.equal(selected.direction, item.direction, item.name);
    assert.equal(selected.clip, item.clip, item.name);
    assert.match(selected.key, new RegExp(`^actor\\.player\\.${item.direction}\\.${item.clip}\\.[0-9]{2}$`));
  }
});

test("one-shot player clips reach their first and final frames from action-local timers", () => {
  const attacks = [240, 180, 120, 60].map((visualActionTimer) => layersApi.selectPlayerVisual(
    visualSnapshotApi.createVisualSnapshot({
      phase: "playing",
      playerAnimTimer: 90000,
      player: { x: 4, y: 4, hp: 10, facing: "east", visualAction: "attack", visualActionTimer }
    }, 90000)
  ).frame);
  assert.deepEqual(attacks, [1, 2, 3, 4], "attack must expose all four frames before its visual marker clears");

  const deaths = [0, 167].map((visualDeathTimer) => layersApi.selectPlayerVisual(
    visualSnapshotApi.createVisualSnapshot({
      phase: "dead",
      playerAnimTimer: 90000,
      player: { x: 4, y: 4, hp: 0, facing: "south", visualDeathTimer }
    }, 90000)
  ).frame);
  assert.deepEqual(deaths, [1, 2], "death must start at frame one independently of the global animation clock");
});

test("player layer draws the selected critical frame bottom-centered on the HD tile", () => {
  const calls = [];
  const image = Object.freeze({ id: "east-attack" });
  const context = {
    drawImage(...args) { calls.push(args); },
    fillRect() { assert.fail("shipping player art must replace the diagnostic rectangle"); }
  };
  const snapshot = visualSnapshotApi.createVisualSnapshot({
    phase: "playing",
    player: { x: 2, y: 3, hp: 10, facing: "east", visualAction: "attack", _tweenT: 120 }
  }, 0);
  const selected = layersApi.selectPlayerVisual(snapshot);
  const drawn = layersApi.drawPlayerLayer(context, snapshot, new Map([[selected.key, image]]));
  assert.equal(drawn, true);
  assert.deepEqual(calls, [[image, 120, 176, 80, 80]]);
});

test("player layer preserves the existing 120 ms eased movement tween in HD coordinates", () => {
  const calls = [];
  const image = Object.freeze({ id: "east-move" });
  const context = { drawImage(...args) { calls.push(args); }, fillRect() {} };
  const snapshot = visualSnapshotApi.createVisualSnapshot({
    phase: "playing",
    player: {
      x: 3,
      y: 3,
      hp: 10,
      lastMoveX: 1,
      lastMoveY: 0,
      _tweenT: 60,
      _tweenFromX: 32,
      _tweenFromY: 48
    }
  }, 0);
  const selected = layersApi.selectPlayerVisual(snapshot);
  assert.equal(selected.clip, "move");
  const drawn = layersApi.drawPlayerLayer(context, snapshot, new Map([[selected.key, image]]));
  assert.equal(drawn, true);
  assert.deepEqual(calls, [[image, 168, 176, 80, 80]]);
});

test("a missing critical player frame blocks HD through the existing graphics controller", async () => {
  const playerEntries = manifestApi.entries.filter((entry) => entry.group === "player");
  assert.equal(playerEntries.length, 64, "shipping player group must be active before fallback can be exercised");
  assert.ok(playerEntries.every((entry) => entry.critical === true));

  const missingKey = playerEntries[0].key;
  const loaded = new Map(
    manifestApi.entries
      .filter((entry) => entry.critical && entry.key !== missingKey)
      .map((entry) => [entry.key, Object.freeze({ key: entry.key })])
  );
  const diagnostics = [];
  const controller = rendererApi.createGraphicsController({
    canvas: createCanvas(),
    context: { clearRect() {}, save() {}, restore() {} },
    manifest: manifestApi.entries,
    loader: {
      loadAssets: async () => ({ ready: true, fallbackRequired: false, loaded, failures: [] })
    },
    renderHD() {
      assert.fail("HD must not activate with a missing critical player frame");
    },
    renderLegacy() {},
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });

  const outcome = await controller.initialize(true);
  assert.equal(outcome.mode, "legacy");
  assert.equal(controller.getMode(), "legacy");
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0].message, new RegExp(`${missingKey}|critical|missing`, "i"));
});
