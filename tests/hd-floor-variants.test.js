const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const manifest = require(path.join(ROOT, "render", "hd-asset-manifest.js"));
const layers = require(path.join(ROOT, "render", "hd-renderer-layers.js"));
const lighting = require(path.join(ROOT, "render", "hd-lighting.js"));
const THEMES = Object.freeze([
  ["descent", 1],
  ["corruption", 25],
  ["abyss", 45]
]);
const FLOOR_VARIANTS = Object.freeze(["base", "b", "c", "skull", "crack_cross", "var3", "var4"]);
const CLASSIC_HASHES = Object.freeze({
  "assets/sprite/tileset.png": "2d768e27bcbd08a5402a79551af67b2e18c523ece31b2e1245d8942c38413b79",
  "assets/sprite/tileset2.png": "8289c3addbdcfc7413148975a69d7b140fa3e4debbe6be9a128086c08fb3331d",
  "assets/sprite/tileset3.png": "f8f4d7735c0d5a0b4984344d8466dd656972a532a14072d663aaf1e0bfa31fac",
  "assets/sprite/torch.png": "46e7a7cf452a122da910f08e2f59f3132a42d2b34c0513db83202e19cf87ecb4",
  "assets/sprite/torch2.png": "c041466be155b50a5d0f9829d2ef9b6b46b5b907153e48d30a769ceec3de39a5",
  "assets/sprite/torch3.png": "11c39f5ed4b021c98b53349376c8ec6b437d7404259e9c894e2c7f320cb96380"
});

function sha256(relative) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, relative))).digest("hex");
}

function fakeAssets(keys) {
  return new Map(keys.map((key) => [key, Object.freeze({ key })]));
}

function drawingContext() {
  const calls = [];
  return {
    calls,
    fillStyle: "",
    drawImage(image, x, y, width, height) { calls.push({ key: image.key, x, y, width, height }); },
    fillRect() {},
    save() {},
    restore() {}
  };
}

test("Classic environment and torch references remain byte-identical", () => {
  for (const [relative, expected] of Object.entries(CLASSIC_HASHES)) {
    assert.equal(sha256(relative), expected, relative);
  }
});

test("HD floor selector preserves the Classic noise contract", () => {
  assert.equal(typeof layers.selectFloorVariant, "function", "selectFloorVariant must be exported");
  const expected = ["base", "b", "crack_cross", "base", "var3", "crack_cross", "c", "skull", "var4", "b"];
  for (let noise = 0; noise <= 9; noise += 1) {
    assert.equal(layers.selectFloorVariant(noise), expected[noise], `noise ${noise}`);
  }
  assert.equal(layers.selectFloorVariant(Number.NaN), "base");
});

test("semantic rare floors and braziers reject unrelated random decals", () => {
  assert.equal(typeof layers.canFloorReceiveDecal, "function", "canFloorReceiveDecal must be exported");
  for (const noise of [2, 3, 4, 5, 7]) assert.equal(layers.canFloorReceiveDecal(noise), false, `noise ${noise}`);
  for (const noise of [0, 1, 6, 8, 9]) assert.equal(layers.canFloorReceiveDecal(noise), true, `noise ${noise}`);
});

test("HD never renders or lights torch markers on wall tiles", () => {
  const pattern = Array.from({ length: 9 }, () => Array(9).fill(0));
  pattern[0][4] = 3;
  pattern[4][0] = 3;
  pattern[8][4] = 3;
  pattern[4][8] = 3;
  pattern[4][4] = 3;
  const context = drawingContext();
  layers.drawObjectsLayer(
    context,
    { depth: 1, phase: "playing", nowMs: 0, floorPattern: pattern },
    fakeAssets(["environment.descent.torch.lit01"])
  );
  assert.deepEqual(
    context.calls.filter((call) => call.key.includes("torch")).map(({ x, y }) => ({ x, y })),
    [{ x: 256, y: 256 }]
  );
  const commands = lighting.collectLightingCommands({ depth: 1, phase: "playing", floorPattern: pattern });
  assert.deepEqual(commands.lights.filter((light) => light.kind === "torch").map(({ x, y }) => ({ x, y })), [
    { x: 288, y: 288 }
  ]);
});

test("manifest exposes floor variants plus biome-specific spikes and mine states", () => {
  const byKey = new Map(manifest.entries.map((entry) => [entry.key, entry]));
  for (const [theme] of THEMES) {
    for (const variant of FLOOR_VARIANTS.slice(1)) {
      const key = `environment.${theme}.floor.${variant}`;
      const entry = byKey.get(key);
      assert.ok(entry, key);
      assert.equal(entry.src, `assets/hd/environment/${theme}/floor-${variant.replaceAll("_", "-")}.png`);
      assert.equal(entry.group, "environment");
      assert.equal(entry.critical, false);
    }
    const spike = byKey.get(`hazard.${theme}.spikes.armed`);
    assert.ok(spike, `hazard.${theme}.spikes.armed`);
    assert.equal(spike.src, `assets/hd/hazards/${theme}/spikes-armed.png`);
    assert.equal(spike.critical, false);
    for (const state of ["unarmed", "armed"]) {
      const mine = byKey.get(`hazard.${theme}.mine.${state}`);
      assert.ok(mine, `hazard.${theme}.mine.${state}`);
      assert.equal(mine.src, `assets/hd/hazards/${theme}/mine-${state}.png`);
      assert.equal(mine.critical, false);
    }
  }
});

test("floor layer selects the semantic tile and safely falls back to base", () => {
  const keys = [];
  for (const [theme] of THEMES) {
    for (const variant of FLOOR_VARIANTS) keys.push(`environment.${theme}.floor.${variant}`);
    for (const edge of ["wall.north", "wall.south", "wall.east", "wall.west", "corner.northwest", "corner.northeast", "corner.southwest", "corner.southeast"]) {
      keys.push(`environment.${theme}.${edge}`);
    }
  }
  const context = drawingContext();
  const pattern = Array.from({ length: 9 }, () => Array(9).fill(0));
  pattern[1].splice(1, 7, 0, 1, 2, 4, 6, 7, 8);
  layers.drawFloorLayer(context, { depth: 45, floorPattern: pattern }, fakeAssets(keys));
  const row = context.calls.filter((call) => call.y === 64 && call.x >= 64 && call.x <= 448);
  assert.deepEqual(row.map((call) => call.key), [
    "environment.abyss.floor.base",
    "environment.abyss.floor.b",
    "environment.abyss.floor.crack_cross",
    "environment.abyss.floor.var3",
    "environment.abyss.floor.c",
    "environment.abyss.floor.skull",
    "environment.abyss.floor.var4"
  ]);

  const fallbackAssets = fakeAssets(keys.filter((key) => key !== "environment.abyss.floor.skull"));
  const fallbackContext = drawingContext();
  layers.drawFloorLayer(fallbackContext, { depth: 45, floorPattern: pattern }, fallbackAssets);
  assert.ok(fallbackContext.calls.some((call) => call.x === 384 && call.y === 64 && call.key === "environment.abyss.floor.base"));
});

test("hazards prefer biome spike and mine assets and retain common fallbacks", () => {
  const themed = drawingContext();
  layers.drawHazardsLayer(themed, {
    depth: 45,
    spikes: [{ x: 2, y: 3, active: true }],
    mines: [{ x: 3, y: 3, armed: false }]
  }, fakeAssets([
    "hazard.abyss.spikes.armed", "hazard.common.spikes.armed",
    "hazard.abyss.mine.unarmed", "hazard.common.mine.unarmed"
  ]));
  assert.deepEqual(themed.calls.map((call) => call.key), [
    "hazard.abyss.spikes.armed", "hazard.abyss.mine.unarmed"
  ]);

  const fallback = drawingContext();
  layers.drawHazardsLayer(fallback, {
    depth: 45,
    spikes: [{ x: 2, y: 3, active: true }],
    mines: [{ x: 3, y: 3, armed: false }]
  }, fakeAssets([
    "hazard.common.spikes.armed", "hazard.common.mine.unarmed"
  ]));
  assert.deepEqual(fallback.calls.map((call) => call.key), [
    "hazard.common.spikes.armed", "hazard.common.mine.unarmed"
  ]);
});

test("seven unique floor assets ship per theme and Abyss midtones stay readable", () => {
  const probe = String.raw`
import hashlib, json, sys
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]); out=[]
for theme in ("descent","corruption","abyss"):
    rows=[]
    for name in ("base","b","c","skull","crack-cross","var3","var4"):
        path=root/"assets"/"hd"/"environment"/theme/f"floor-{name}.png"
        if name=="base": path=root/"assets"/"hd"/"environment"/theme/"floor-base.png"
        with Image.open(path) as source:
            image=source.convert("RGBA")
            values=[.2126*r+.7152*g+.0722*b for r,g,b,a in image.get_flattened_data() if a]
            rows.append({"name":name,"size":image.size,"hash":hashlib.sha256(image.tobytes()).hexdigest(),"mean":sum(values)/len(values)})
    out.append({"theme":theme,"rows":rows})
print(json.dumps(out))`;
  const result = spawnSync("python", ["-c", probe, ROOT], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const metrics = JSON.parse(result.stdout);
  for (const theme of metrics) {
    assert.ok(theme.rows.every((row) => row.size[0] === 64 && row.size[1] === 64), theme.theme);
    assert.equal(new Set(theme.rows.map((row) => row.hash)).size, 7, `${theme.theme} floor hashes`);
  }
  const abyss = metrics.find((theme) => theme.theme === "abyss");
  assert.ok(abyss.rows.every((row) => row.mean >= 56 && row.mean <= 62), JSON.stringify(abyss.rows));
});

test("Abyss ambient darkness is capped without changing earlier themes", () => {
  const highAbyss = lighting.collectLightingCommands({ depth: 45 }, { quality: "high" });
  const reducedAbyss = lighting.collectLightingCommands({ depth: 45 }, { quality: "high", reducedEffects: true });
  const highCorruption = lighting.collectLightingCommands({ depth: 25 }, { quality: "high" });
  const highDescent = lighting.collectLightingCommands({ depth: 1 }, { quality: "high" });
  assert.ok(highAbyss.ambient.opacity <= 0.18, highAbyss.ambient.opacity);
  assert.ok(reducedAbyss.ambient.opacity <= 0.12, reducedAbyss.ambient.opacity);
  assert.equal(highCorruption.ambient.opacity, 0.26);
  assert.equal(highDescent.ambient.opacity, 0.26);
});
