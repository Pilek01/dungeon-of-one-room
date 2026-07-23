const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const manifest = require(path.join(root, "render", "hd-asset-manifest.js"));
const layers = require(path.join(root, "render", "hd-renderer-layers.js"));
const snapshots = require(path.join(root, "render", "visual-snapshot.js"));

const THEMES = Object.freeze(["corruption", "abyss"]);
const ENVIRONMENT_SLOTS = Object.freeze([
  ["floor.base", "floor-base.png", true],
  ...["b", "c", "skull", "crack_cross", "var3", "var4"].map((variant) =>
    [`floor.${variant}`, `floor-${variant.replaceAll("_", "-")}.png`, false]),
  ["wall.north", "wall-north.png", true],
  ["wall.south", "wall-south.png", true],
  ["wall.east", "wall-east.png", true],
  ["wall.west", "wall-west.png", true],
  ["corner.northwest", "wall-corner-northwest.png", true],
  ["corner.northeast", "wall-corner-northeast.png", true],
  ["corner.southwest", "wall-corner-southwest.png", true],
  ["corner.southeast", "wall-corner-southeast.png", true],
  ["decal.crack", "decal-crack.png", false],
  ["grate.base", "grate.png", false],
  ["rubble.base", "rubble.png", false],
  ["decal.stain01", "decal-stain-01.png", false],
  ["decal.stain02", "decal-stain-02.png", false],
  ["decal.stain03", "decal-stain-03.png", false],
  ["decal.sigil", "decal-sigil.png", false],
  ["decal.vein", "decal-vein.png", false],
  ["decal.dust", "decal-dust.png", false],
  ["decal.scar", "decal-scar.png", false],
  ["decal.residue", "decal-residue.png", false],
  ["torch.unlit", "torch-unlit.png", false],
  ["torch.lit01", "torch-lit-01.png", false],
  ["torch.lit02", "torch-lit-02.png", false],
  ["torch.lit03", "torch-lit-03.png", false]
]);

const THEMED_ROOM_BACKGROUNDS = Object.freeze(["boss-room.png", "room-01.png", "room-02.png", "room-03.png"]);

const PROP_SPECS = Object.freeze([
  ...Array.from({ length: 4 }, (_, index) => [`object.merchant.idle${String(index + 1).padStart(2, "0")}`, `merchant/idle-${String(index + 1).padStart(2, "0")}.png`, 96, "bottom-center", "objects", 128]),
  ...["dormant", "ready01", "ready02", "used"].map((state) => [`object.forge.${state}`, `forge/${state}.png`, 192, "bottom-center", "objects"]),
  ...["dormant", "ready01", "ready02", "used"].map((state) => [`object.pact.${state}`, `pact/${state}.png`, 128, "bottom-center", "objects"]),
  ...["blocked", "cleared"].map((state) => [`object.vault.seal.${state}`, `vault/seal-${state}.png`, 128, "center", "decals"]),
  ...["inactive", "active01", "active02", "active03"].map((state) => [`object.vault.portal.${state}`, `vault/portal-${state}.png`, 128, "bottom-center", "objects"]),
  ...["ready", "opened"].map((state) => [`object.otter.chest.${state}`, `otter/chest-${state}.png`, 64, "bottom-center", "objects"]),
  ...["blocked", "cleared"].map((state) => [`object.otter.seal.${state}`, `otter/seal-${state}.png`, 128, "center", "decals"]),
  ...["inactive", "active01", "active02", "active03"].map((state) => [`object.otter.portal.${state}`, `otter/portal-${state}.png`, 128, "bottom-center", "objects"]),
  ...["inactive", "active01", "active02", "active03"].map((state) => [`object.forge.portal.${state}`, `forge/portal-${state}.png`, 128, "bottom-center", "objects"]),
  ...["vault", "otter", "forge"].flatMap((group) => [
    [`object.${group}.portal.frame`, `${group}/portal-frame.png`, 128, "bottom-center", "objects"],
    ...Array.from({ length: 8 }, (_, index) => {
      const suffix = String(index + 1).padStart(2, "0");
      return [`object.${group}.portal.swirl${suffix}`, `${group}/portal-swirl${suffix}.png`, 128, "bottom-center", "objects"];
    })
  ]),
  ...["phase01", "phase02"].map((state) => [`object.boss.floorseal.${state}`, `boss/floorseal-${state}.png`, 192, "center", "decals"]),
  ...["north", "south"].map((state) => [`object.boss.relief.${state}`, `boss/relief-${state}.png`, 64, "center", "decals"])
]);

function inspectPng(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.deepEqual(Array.from(bytes.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10], filePath);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

function sha(filePath) {
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

function inspectThemedAnimationInvariants() {
  const specs = [
    ...["vault", "forge", "otter"].map((theme) => ({
      name: `${theme}-portal`,
      frames: [1, 2, 3].map((frame) => `assets/hd/objects/${theme}/portal-active0${frame}.png`),
      motion: theme === "forge"
        ? [["ellipse", 64, 64, 34, 34]]
        : theme === "otter"
          ? [["ellipse", 64, 64, 34, 34]]
          : [["ellipse", 64, 65, 33, 39]]
    })),
    ...THEMES.map((theme) => ({
      name: `${theme}-brazier`,
      frames: ["unlit", "lit-01", "lit-02", "lit-03"].map((state) =>
        `assets/hd/environment/${theme}/torch-${state}.png`),
      motion: [["ellipse", 32, 22, 15, 21]],
      baseTop: 35
    }))
  ];
  const script = String.raw`
import json, sys
from pathlib import Path
from PIL import Image, ImageChops
specs=json.loads(sys.argv[1]); root=Path(sys.argv[2]); out=[]
for spec in specs:
    frames=[]
    for relative in spec["frames"]:
        with Image.open(root/relative) as source: frames.append(source.convert("RGBA"))
    base=frames[0]; w,h=base.size; allowed=set()
    for shape in spec["motion"]:
        if shape[0]=="ellipse":
            _,cx,cy,rx,ry=shape
            allowed.update((x,y) for y in range(h) for x in range(w)
                           if ((x-cx)/rx)**2+((y-cy)/ry)**2<=1)
        else:
            _,l,t,r,b=shape; allowed.update((x,y) for y in range(t,b) for x in range(l,r))
    outside=[sum(1 for y in range(h) for x in range(w)
                 if (x,y) not in allowed and frame.getpixel((x,y))!=base.getpixel((x,y)))
             for frame in frames[1:]]
    bounds=[frame.getchannel("A").getbbox() for frame in frames]
    lower=[]
    if "baseTop" in spec:
        crop=(0,spec["baseTop"],w,h)
        lower=[ImageChops.difference(base.crop(crop),frame.crop(crop)).getbbox() is not None for frame in frames[1:]]
    bbox=base.getchannel("A").getbbox()
    out.append({"name":spec["name"],"outside":outside,"bounds":bounds,"lower":lower,"bbox":bbox})
print(json.dumps(out))`;
  const result = spawnSync("python", ["-c", script, JSON.stringify(specs), root], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("Corruption and Abyss ship 30 environment tiles plus four full-room backgrounds", () => {
  for (const theme of THEMES) {
    const directory = path.join(root, "assets", "hd", "environment", theme);
    const expectedNames = [...ENVIRONMENT_SLOTS.map((slot) => slot[1]), ...THEMED_ROOM_BACKGROUNDS].sort();
    const actualNames = fs.readdirSync(directory).filter((name) => name.endsWith(".png")).sort();
    assert.deepEqual(actualNames, expectedNames, theme + " must contain exactly 30 environment tiles and four room backgrounds");
    for (const [suffix, filename, critical] of ENVIRONMENT_SLOTS) {
      const key = `environment.${theme}.${suffix}`;
      const entry = manifest.entries.find((candidate) => candidate.key === key);
      assert.deepEqual(entry, {
        key,
        src: `assets/hd/environment/${theme}/${filename}`,
        group: "environment",
        critical
      });
      const png = inspectPng(path.join(directory, filename));
      assert.deepEqual(png, { width: 64, height: 64, colorType: 6 });
    }
  }
});

test("themed portals keep fixed shells and themed technical torches are grounded braziers", () => {
  const results = inspectThemedAnimationInvariants();
  for (const portal of results.filter((entry) => entry.name.endsWith("-portal"))) {
    assert.deepEqual(portal.outside, [0, 0], `${portal.name} shell must be byte-identical`);
    assert.equal(new Set(portal.bounds.map(JSON.stringify)).size, 1, `${portal.name} bounds must stay fixed`);
  }
  for (const brazier of results.filter((entry) => entry.name.endsWith("-brazier"))) {
    assert.deepEqual(brazier.lower, [false, false, false], `${brazier.name} must keep one fixed base`);
    const [left, top, right, bottom] = brazier.bbox;
    assert.ok(right - left >= 32, `${brazier.name} must be broad enough to read as a brazier`);
    assert.ok(bottom - top <= 54, `${brazier.name} must not look like a tall torch`);
    assert.ok(bottom >= 60, `${brazier.name} must be floor anchored`);
  }
});

test("the exact 61 optional setpiece and portal-layer assets ship with stable contracts", () => {
  assert.equal(PROP_SPECS.length, 61);
  const profilesPath = path.join(root, "assets", "hd", "objects", "room-profiles.json");
  const profiles = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
  assert.equal(Object.keys(profiles).length, 61);
  for (const [key, relative, size, anchor, layer, sourceSize = size] of PROP_SPECS) {
    const src = `assets/hd/objects/${relative}`;
    assert.deepEqual(manifest.entries.find((entry) => entry.key === key), {
      key, src, group: "objects", critical: false
    });
    assert.deepEqual(inspectPng(path.join(root, ...src.split("/"))), {
      width: sourceSize, height: sourceSize, colorType: 6
    });
    assert.deepEqual(profiles[key], { anchor, layer, width: size, height: size });
  }
});

test("Task 8 generator reproduces the published room profile metadata", () => {
  const buildPath = path.join(root, "scripts", "build-hd-room-assets.py");
  const script = String.raw`
import json, runpy, sys
pipeline = runpy.run_path(sys.argv[1])
print(json.dumps(pipeline["profile_data"](), sort_keys=True))`;
  const result = spawnSync("python", ["-c", script, buildPath], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(
    JSON.parse(result.stdout),
    JSON.parse(fs.readFileSync(path.join(root, "assets", "hd", "objects", "room-profiles.json"), "utf8"))
  );
});

test("every themed portal keeps a complete static frame and eight fixed-aperture swirl layers", () => {
  const specs = {
    vault: [64, 64, 29, 104],
    forge: [64, 64, 33, 104],
    otter: [64, 64, 33, 96]
  };
  const script = String.raw`
import json, sys
from pathlib import Path
from PIL import Image, ImageChops
root=Path(sys.argv[1]); specs=json.loads(sys.argv[2]); out={}
for theme,(cx,cy,r,bottom_top) in specs.items():
    with Image.open(root/theme/"portal-frame.png") as source: frame=source.convert("RGBA")
    swirls=[]
    for index in range(1,9):
        with Image.open(root/theme/f"portal-swirl{index:02d}.png") as source: swirls.append(source.convert("RGBA"))
    bounds=[image.getchannel("A").getbbox() for image in swirls]
    centroids=[]
    for image in swirls:
        weights=list(image.getchannel("A").get_flattened_data()); total=sum(weights)
        centroids.append((sum((index%128)*value for index,value in enumerate(weights))/total,
                          sum((index//128)*value for index,value in enumerate(weights))/total))
    outside=[sum(1 for y in range(128) for x in range(128)
                 if ((x-cx)**2+(y-cy)**2 > (r+1)**2) and image.getpixel((x,y))[3] > 0)
             for image in swirls]
    bottom=sum(1 for y in range(bottom_top,128) for x in range(128) if frame.getpixel((x,y))[3]>16)
    diffs=[ImageChops.difference(swirls[0].convert("RGB"),image.convert("RGB")).getbbox() is not None for image in swirls[1:]]
    out[theme]={"frameBounds":frame.getchannel("A").getbbox(),"bottom":bottom,
                "bounds":bounds,"outside":outside,"diffs":diffs,
                "jitter":[max(p[0] for p in centroids)-min(p[0] for p in centroids),
                          max(p[1] for p in centroids)-min(p[1] for p in centroids)]}
print(json.dumps(out))`;
  const result = spawnSync("python", ["-c", script, path.join(root, "assets", "hd", "objects"), JSON.stringify(specs)], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const metrics = JSON.parse(result.stdout);
  for (const [theme, values] of Object.entries(metrics)) {
    assert.ok(values.frameBounds[3] >= 124, `${theme} frame must retain its complete bottom`);
    assert.ok(values.bottom >= 300, `${theme} lower frame/platform must remain visible`);
    assert.equal(new Set(values.bounds.map(JSON.stringify)).size, 1, `${theme} swirl bounds must be fixed`);
    assert.deepEqual(values.outside, Array(8).fill(0), `${theme} swirls must not contain frame pixels`);
    assert.ok(values.diffs.every(Boolean), `${theme} must ship eight distinct rotation phases`);
    assert.ok(Math.max(...values.jitter) <= 0.5, `${theme} portal swirl may not orbit (${values.jitter})`);
  }
});

test("all new alpha assets contain zero visible exact or near-key magenta", () => {
  const paths = [
    ...THEMES.flatMap((theme) => ENVIRONMENT_SLOTS.map((slot) => path.join(root, "assets", "hd", "environment", theme, slot[1]))),
    ...PROP_SPECS.map((spec) => path.join(root, "assets", "hd", "objects", spec[1]))
  ];
  const script = String.raw`
import json, sys
from PIL import Image
bad=[]
for raw in sys.argv[1:]:
    with Image.open(raw) as source:
        image=source.convert("RGBA")
        exact=near=0
        for r,g,b,a in image.getdata():
            if a <= 0: continue
            if (r,g,b)==(255,0,255): exact += 1
            if a <= 128 and (r-255)**2+g**2+(b-255)**2 <= 48**2 and r-g>=96 and b-g>=96 and abs(r-b)<=64: near += 1
        if exact or near: bad.append({"path":raw,"exact":exact,"near":near})
print(json.dumps(bad))`;
  const result = spawnSync("python", ["-c", script, ...paths], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), []);
});

test("theme selection and room visual hashing are deterministic and simulation-safe", () => {
  assert.equal(layers.getEnvironmentTheme(0), "descent");
  assert.equal(layers.getEnvironmentTheme(19), "descent");
  assert.equal(layers.getEnvironmentTheme(20), "corruption");
  assert.equal(layers.getEnvironmentTheme(39), "corruption");
  assert.equal(layers.getEnvironmentTheme(40), "abyss");
  assert.equal(layers.getEnvironmentTheme(59), "abyss");
  assert.equal(layers.getEnvironmentTheme(60), "beyond");

  const frozen = Object.freeze({ depth: 44, roomType: "boss", bossRoom: true, finalBossPhase: 2, x: 4, y: 5 });
  const before = JSON.stringify(frozen);
  const oldRandom = Math.random;
  Math.random = () => { throw new Error("visual selection consumed simulation RNG"); };
  try {
    const first = layers.visualVariantHash(frozen.depth, frozen.roomType, frozen.bossRoom, frozen.finalBossPhase, frozen.x, frozen.y, 17);
    const second = layers.visualVariantHash(frozen.depth, frozen.roomType, frozen.bossRoom, frozen.finalBossPhase, frozen.x, frozen.y, 17);
    assert.equal(first, second);
    assert.notEqual(first, layers.visualVariantHash(45, "boss", true, 2, 4, 5, 17));
  } finally {
    Math.random = oldRandom;
  }
  assert.equal(JSON.stringify(frozen), before);
});

test("renderer selects themed floors and deterministic themed decals without hardcoded Descent", () => {
  for (const [depth, theme] of [[25, "corruption"], [45, "abyss"]]) {
    const keys = ENVIRONMENT_SLOTS.map(([suffix]) => `environment.${theme}.${suffix}`);
    const context = drawingContext();
    const snapshot = Object.freeze({ depth, roomType: "combat", bossRoom: false, finalBossPhase: 0 });
    layers.drawFloorLayer(context, snapshot, fakeAssets(keys));
    assert.ok(context.calls.some((call) => call.key === `environment.${theme}.floor.base`));
    assert.ok(context.calls.some((call) => call.key === `environment.${theme}.corner.northwest`));
    assert.equal(context.calls.some((call) => call.key.startsWith("environment.descent.")), false);

    const first = drawingContext();
    const second = drawingContext();
    layers.drawDecalsLayer(first, snapshot, fakeAssets(keys));
    layers.drawDecalsLayer(second, snapshot, fakeAssets(keys));
    assert.deepEqual(first.calls, second.calls);
    assert.ok(first.calls.every((call) => call.key.startsWith(`environment.${theme}.`)));
  }
});

test("Forge Room uses one fixed dedicated background without procedural variants, decals, or technical torches", () => {
  const backgroundPath = path.join(root, "assets", "hd", "environment", "forge", "room.png");
  assert.deepEqual(inspectPng(backgroundPath), { width: 576, height: 576, colorType: 6 });
  assert.deepEqual(manifest.entries.find((entry) => entry.key === "environment.forge.room"), {
    key: "environment.forge.room",
    src: "assets/hd/environment/forge/room.png",
    group: "environment",
    critical: false
  });

  const snapshot = {
    depth: 25,
    roomType: "forge",
    phase: "playing",
    nowMs: 200,
    floorPattern: Array.from({ length: 9 }, () => Array(9).fill(3))
  };
  const assets = fakeAssets(["environment.forge.room", "environment.corruption.torch.lit01"]);
  const floor = drawingContext();
  layers.drawFloorLayer(floor, snapshot, assets);
  assert.deepEqual(floor.calls, [
    { key: "environment.forge.room", x: 0, y: 0, width: 576, height: 576 }
  ]);
  const decals = drawingContext();
  layers.drawDecalsLayer(decals, snapshot, assets);
  assert.deepEqual(decals.calls, []);
  const objects = drawingContext();
  layers.drawObjectsLayer(objects, snapshot, assets);
  assert.deepEqual(objects.calls, []);
});

test("Vault Room uses one fixed dedicated background while retaining its central seal layer", () => {
  const backgroundPath = path.join(root, "assets", "hd", "environment", "vault", "room.png");
  assert.deepEqual(inspectPng(backgroundPath), { width: 576, height: 576, colorType: 6 });
  assert.deepEqual(manifest.entries.find((entry) => entry.key === "environment.vault.room"), {
    key: "environment.vault.room",
    src: "assets/hd/environment/vault/room.png",
    group: "environment",
    critical: false
  });

  const snapshot = {
    depth: 30,
    roomType: "vault",
    roomCleared: false,
    phase: "playing",
    nowMs: 200,
    floorPattern: Array.from({ length: 9 }, () => Array(9).fill(3))
  };
  const assets = fakeAssets([
    "environment.vault.room",
    "environment.corruption.torch.lit01",
    "object.vault.seal.blocked"
  ]);
  const floor = drawingContext();
  layers.drawFloorLayer(floor, snapshot, assets);
  assert.deepEqual(floor.calls, [
    { key: "environment.vault.room", x: 0, y: 0, width: 576, height: 576 }
  ]);
  const decals = drawingContext();
  layers.drawDecalsLayer(decals, snapshot, assets);
  assert.deepEqual(decals.calls, [
    { key: "object.vault.seal.blocked", x: 224, y: 224, width: 128, height: 128 }
  ]);
  const objects = drawingContext();
  layers.drawObjectsLayer(objects, snapshot, assets);
  assert.deepEqual(objects.calls, []);
});

test("Otter Room uses one fixed dedicated background while retaining its central seal layer", () => {
  const backgroundPath = path.join(root, "assets", "hd", "environment", "otter", "room.png");
  assert.deepEqual(inspectPng(backgroundPath), { width: 576, height: 576, colorType: 6 });
  assert.deepEqual(manifest.entries.find((entry) => entry.key === "environment.otter.room"), {
    key: "environment.otter.room",
    src: "assets/hd/environment/otter/room.png",
    group: "environment",
    critical: false
  });

  const snapshot = {
    depth: 25,
    roomType: "otter",
    roomCleared: false,
    phase: "playing",
    nowMs: 200,
    floorPattern: Array.from({ length: 9 }, () => Array(9).fill(3))
  };
  const assets = fakeAssets([
    "environment.otter.room",
    "environment.corruption.torch.lit01",
    "object.otter.seal.blocked"
  ]);
  const floor = drawingContext();
  layers.drawFloorLayer(floor, snapshot, assets);
  assert.deepEqual(floor.calls, [
    { key: "environment.otter.room", x: 0, y: 0, width: 576, height: 576 }
  ]);
  const decals = drawingContext();
  layers.drawDecalsLayer(decals, snapshot, assets);
  assert.deepEqual(decals.calls, [
    { key: "object.otter.seal.blocked", x: 224, y: 224, width: 128, height: 128 }
  ]);
  const objects = drawingContext();
  layers.drawObjectsLayer(objects, snapshot, assets);
  assert.deepEqual(objects.calls, []);
});

test("Descent standard rooms deterministically select three coherent full-room variants", () => {
  const keys = Array.from({ length: 3 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    const filePath = path.join(root, "assets", "hd", "environment", "descent", `room-${suffix}.png`);
    assert.deepEqual(inspectPng(filePath), { width: 576, height: 576, colorType: 6 });
    const key = `environment.descent.room${suffix}`;
    assert.deepEqual(manifest.entries.find((entry) => entry.key === key), {
      key,
      src: `assets/hd/environment/descent/room-${suffix}.png`,
      group: "environment",
      critical: false
    });
    return key;
  });

  const selected = new Set();
  for (let depth = 0; depth < 20; depth += 1) {
    for (const roomType of ["combat", "cursed", "merchant", "shrine"]) {
      const snapshot = { depth, roomType, bossRoom: false, finalBossPhase: 0 };
      const first = layers.selectStandardRoomBackground(snapshot);
      const second = layers.selectStandardRoomBackground(snapshot);
      assert.equal(first, second);
      assert.ok(keys.includes(first), first);
      selected.add(first);
    }
  }
  assert.deepEqual([...selected].sort(), keys);

  const snapshot = {
    depth: 3,
    roomType: "combat",
    bossRoom: false,
    phase: "playing",
    nowMs: 200,
    floorPattern: Array.from({ length: 9 }, () => Array(9).fill(3))
  };
  const assets = fakeAssets([...keys, "object.common.torch.lit01"]);
  const floor = drawingContext();
  layers.drawFloorLayer(floor, snapshot, assets);
  assert.equal(floor.calls.length, 1);
  assert.ok(keys.includes(floor.calls[0].key));
  assert.deepEqual({ ...floor.calls[0], key: "room" }, { key: "room", x: 0, y: 0, width: 576, height: 576 });
  const decals = drawingContext();
  layers.drawDecalsLayer(decals, snapshot, assets);
  assert.deepEqual(decals.calls, []);
  const objects = drawingContext();
  layers.drawObjectsLayer(objects, snapshot, assets);
  assert.deepEqual(objects.calls, []);
});

test("Corruption standard rooms deterministically select three coherent full-room variants", () => {
  const keys = Array.from({ length: 3 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    const filePath = path.join(root, "assets", "hd", "environment", "corruption", `room-${suffix}.png`);
    assert.deepEqual(inspectPng(filePath), { width: 576, height: 576, colorType: 6 });
    const key = `environment.corruption.room${suffix}`;
    assert.deepEqual(manifest.entries.find((entry) => entry.key === key), {
      key,
      src: `assets/hd/environment/corruption/room-${suffix}.png`,
      group: "environment",
      critical: false
    });
    return key;
  });

  const selected = new Set();
  for (let depth = 20; depth < 40; depth += 1) {
    for (const roomType of ["combat", "cursed", "merchant", "shrine"]) {
      const snapshot = { depth, roomType, bossRoom: false, finalBossPhase: 0 };
      const first = layers.selectStandardRoomBackground(snapshot);
      const second = layers.selectStandardRoomBackground(snapshot);
      assert.equal(first, second);
      assert.ok(keys.includes(first), first);
      selected.add(first);
    }
  }
  assert.deepEqual([...selected].sort(), keys);

  const snapshot = {
    depth: 23,
    roomType: "combat",
    bossRoom: false,
    phase: "playing",
    nowMs: 200,
    floorPattern: Array.from({ length: 9 }, () => Array(9).fill(3))
  };
  const assets = fakeAssets([...keys, "environment.corruption.torch.lit01"]);
  const floor = drawingContext();
  layers.drawFloorLayer(floor, snapshot, assets);
  assert.equal(floor.calls.length, 1);
  assert.ok(keys.includes(floor.calls[0].key));
  assert.deepEqual({ ...floor.calls[0], key: "room" }, { key: "room", x: 0, y: 0, width: 576, height: 576 });
  const decals = drawingContext();
  layers.drawDecalsLayer(decals, snapshot, assets);
  assert.deepEqual(decals.calls, []);
  const objects = drawingContext();
  layers.drawObjectsLayer(objects, snapshot, assets);
  assert.deepEqual(objects.calls, []);
});

test("Abyss standard rooms deterministically select three coherent full-room variants", () => {
  const keys = Array.from({ length: 3 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    const filePath = path.join(root, "assets", "hd", "environment", "abyss", `room-${suffix}.png`);
    assert.deepEqual(inspectPng(filePath), { width: 576, height: 576, colorType: 6 });
    const key = `environment.abyss.room${suffix}`;
    assert.deepEqual(manifest.entries.find((entry) => entry.key === key), {
      key,
      src: `assets/hd/environment/abyss/room-${suffix}.png`,
      group: "environment",
      critical: false
    });
    return key;
  });

  const selected = new Set();
  for (let depth = 40; depth < 60; depth += 1) {
    for (const roomType of ["combat", "cursed", "merchant", "shrine"]) {
      const snapshot = { depth, roomType, bossRoom: false, finalBossPhase: 0 };
      const first = layers.selectStandardRoomBackground(snapshot);
      const second = layers.selectStandardRoomBackground(snapshot);
      assert.equal(first, second);
      assert.ok(keys.includes(first), first);
      selected.add(first);
    }
  }
  assert.deepEqual([...selected].sort(), keys);

  const snapshot = {
    depth: 45,
    roomType: "combat",
    bossRoom: false,
    phase: "playing",
    nowMs: 200,
    floorPattern: Array.from({ length: 9 }, () => Array(9).fill(3))
  };
  const assets = fakeAssets([...keys, "environment.abyss.torch.lit01"]);
  const floor = drawingContext();
  layers.drawFloorLayer(floor, snapshot, assets);
  assert.equal(floor.calls.length, 1);
  assert.ok(keys.includes(floor.calls[0].key));
  assert.deepEqual({ ...floor.calls[0], key: "room" }, { key: "room", x: 0, y: 0, width: 576, height: 576 });
  const decals = drawingContext();
  layers.drawDecalsLayer(decals, snapshot, assets);
  assert.deepEqual(decals.calls, []);
  const objects = drawingContext();
  layers.drawObjectsLayer(objects, snapshot, assets);
  assert.deepEqual(objects.calls, []);
});

test("each biome boss room uses one open epic background beneath the existing seal", () => {
  const cases = [
    ["descent", 1],
    ["corruption", 25],
    ["abyss", 45]
  ];
  const keys = cases.map(([theme]) => `environment.${theme}.bossroom`);
  for (const [theme, depth] of cases) {
    const key = `environment.${theme}.bossroom`;
    const filePath = path.join(root, "assets", "hd", "environment", theme, "boss-room.png");
    assert.deepEqual(inspectPng(filePath), { width: 576, height: 576, colorType: 6 });
    assert.deepEqual(manifest.entries.find((entry) => entry.key === key), {
      key,
      src: `assets/hd/environment/${theme}/boss-room.png`,
      group: "environment",
      critical: false
    });
    assert.equal(layers.selectBossRoomBackground({ depth, roomType: "boss", bossRoom: true }), key);
  }

  const snapshot = {
    depth: 25,
    roomType: "boss",
    bossRoom: true,
    finalBossPhase: 1,
    phase: "playing",
    nowMs: 200,
    floorPattern: Array.from({ length: 9 }, () => Array(9).fill(3))
  };
  const assets = fakeAssets([
    ...keys,
    "object.boss.floorseal.phase01",
    "object.common.torch.lit01"
  ]);
  const floor = drawingContext();
  layers.drawFloorLayer(floor, snapshot, assets);
  assert.deepEqual(floor.calls, [
    { key: "environment.corruption.bossroom", x: 0, y: 0, width: 576, height: 576 }
  ]);
  const decals = drawingContext();
  layers.drawDecalsLayer(decals, snapshot, assets);
  assert.deepEqual(decals.calls.map((call) => call.key), ["object.boss.floorseal.phase01"]);
  const objects = drawingContext();
  layers.drawObjectsLayer(objects, snapshot, assets);
  assert.deepEqual(objects.calls, []);
});

test("all Forge states keep one connected silhouette without a floating upper component", () => {
  const probe = String.raw`
import json, sys
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]); out=[]
for state in ("dormant","ready01","ready02","used"):
    with Image.open(root/f"{state}.png") as source: alpha=source.convert("RGBA").getchannel("A")
    pixels=alpha.load(); seen=set(); components=[]
    for y in range(alpha.height):
        for x in range(alpha.width):
            if pixels[x,y] <= 16 or (x,y) in seen: continue
            stack=[(x,y)]; seen.add((x,y)); count=0
            while stack:
                px,py=stack.pop(); count += 1
                for ny in range(max(0,py-1),min(alpha.height,py+2)):
                    for nx in range(max(0,px-1),min(alpha.width,px+2)):
                        if pixels[nx,ny] > 16 and (nx,ny) not in seen:
                            seen.add((nx,ny)); stack.append((nx,ny))
            if count >= 8: components.append(count)
    out.append({"state":state,"components":sorted(components,reverse=True),"bounds":alpha.getbbox()})
print(json.dumps(out))`;
  const result = spawnSync("python", ["-c", probe, path.join(root, "assets", "hd", "objects", "forge")], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const metrics = JSON.parse(result.stdout);
  assert.ok(metrics.every((entry) => entry.components.length === 1), JSON.stringify(metrics));
  assert.equal(new Set(metrics.map((entry) => JSON.stringify(entry.bounds))).size, 1);
});

test("special room props map snapshot states and seals remain below hazards", () => {
  assert.ok(layers.LAYER_ORDER.indexOf("decals") < layers.LAYER_ORDER.indexOf("hazards"));
  const allKeys = PROP_SPECS.map((spec) => spec[0]);
  const cases = [
    [{ roomType: "merchant", merchant: { x: 4, y: 4 }, nowMs: 0 }, "objects", "object.merchant.idle01"],
    [{ roomType: "forge", forge: { x: 4, y: 4, awakened: false, used: false }, nowMs: 0 }, "objects", "object.forge.ready01"],
    [{ roomType: "forge", forge: { x: 4, y: 4, awakened: true, used: true }, nowMs: 200 }, "objects", "object.forge.ready02"],
    [{ roomType: "forge", forge: { x: 4, y: 4, awakened: true, used: false }, nowMs: 200 }, "objects", "object.forge.ready02"],
    [{ roomType: "pact", pact: { x: 4, y: 4, awakened: true, used: true } }, "objects", "object.pact.used"],
    [{ roomType: "vault", roomCleared: false }, "decals", "object.vault.seal.blocked"],
    [{ roomType: "vault", roomCleared: true, portal: { x: 4, y: 4, active: true }, nowMs: 200 }, "objects", "object.vault.portal.frame"],
    [{ roomType: "otter", roomCleared: false }, "decals", "object.otter.seal.blocked"],
    [{ roomType: "otter", roomCleared: true }, "decals", "object.otter.seal.cleared"],
    [{ roomType: "otter", roomCleared: false, otterChest: { x: 4, y: 4, opened: false } }, "objects", "object.otter.chest.ready"],
    [{ bossRoom: true, finalBossPhase: 2 }, "decals", "object.boss.floorseal.phase02"]
  ];
  for (const [snapshot, layer, expected] of cases) {
    const context = drawingContext();
    layers.DEFAULT_LAYERS[layer](context, snapshot, fakeAssets(allKeys));
    assert.ok(context.calls.some((call) => call.key === expected), `${expected} must render in ${layer}`);
  }
});

test("HD merchant renders at 96x96 with a bottom-center tile anchor", () => {
  const context = drawingContext();
  layers.drawObjectsLayer(context, {
    roomType: "merchant",
    merchant: { x: 4, y: 4 },
    nowMs: 0
  }, fakeAssets(["object.merchant.idle01"]));

  assert.deepEqual(context.calls, [
    { key: "object.merchant.idle01", x: 240, y: 224, width: 96, height: 96 }
  ]);
});

test("forge setpiece uses the production 3x3 origin instead of the interaction tile", () => {
  const context = drawingContext();
  layers.drawObjectsLayer(context, {
    roomType: "forge",
    forge: {
      x: 4,
      y: 3,
      originX: 3,
      originY: 0,
      width: 3,
      height: 3,
      awakened: false,
      used: false
    }
  }, fakeAssets(["object.forge.ready01"]));

  assert.deepEqual(context.calls, [
    { key: "object.forge.ready01", x: 192, y: 0, width: 192, height: 192 }
  ]);
  const gameSource = fs.readFileSync(path.join(root, "game.js"), "utf8");
  assert.match(
    gameSource,
    /roomType === "forge"[\s\S]*?\{ x: 4, y: 3, originX: 3, originY: 0, width: 3, height: 3/,
    "forge QA scenario must use the real production layout"
  );
});

test("cleared forge rooms choose the orange forge portal before the common fallback", () => {
  const context = drawingContext();
  layers.drawObjectsLayer(context, {
    roomType: "forge",
    roomCleared: true,
    portal: { x: 7, y: 7, active: true },
    nowMs: 0
  }, fakeAssets([
    "object.forge.portal.active01",
    "object.common.portal.active01"
  ]));

  assert.ok(context.calls.some((call) => call.key === "object.forge.portal.active01"));
  assert.equal(context.calls.some((call) => call.key === "object.common.portal.active01"), false);
});

test("optional props skip or use a semantically valid common fallback while critical theme failures request legacy mode", async () => {
  const optionalContext = drawingContext();
  layers.drawObjectsLayer(optionalContext, {
    roomType: "vault", roomCleared: true, portal: { x: 4, y: 4, active: true }, nowMs: 0
  }, fakeAssets(["object.common.portal.active01"]));
  assert.ok(optionalContext.calls.some((call) => call.key === "object.common.portal.active01"));

  const loader = require(path.join(root, "render", "hd-asset-loader.js"));
  const outcome = await loader.loadAssets([
    { key: "environment.corruption.floor.base", src: "assets/hd/environment/corruption/floor-base.png", group: "environment", critical: true }
  ], {
    imageFactory() { return { decode: () => Promise.reject(new Error("missing")), set src(_value) {} }; },
    setTimeoutFn() { return 1; }, clearTimeoutFn() {}
  });
  assert.equal(outcome.fallbackRequired, true);
  assert.equal(outcome.ready, false);
});

test("visual snapshot exposes only copied render state needed by vault, otter, and final seals", () => {
  const source = {
    roomType: "otter", roomCleared: true, bossRoom: true, finalBossPhase: 2,
    otterChest: { x: 4, y: 5, opened: true, loot: ["secret"] },
    vaultCleared: true,
    saveGame: { forbidden: true }
  };
  const before = JSON.stringify(source);
  const snapshot = snapshots.createVisualSnapshot(source, 50);
  assert.deepEqual(snapshot.otterChest, { x: 4, y: 5, opened: true });
  assert.equal(snapshot.vaultCleared, true);
  assert.equal(snapshot.finalBossPhase, 2);
  assert.equal("saveGame" in snapshot, false);
  snapshot.otterChest.x = 99;
  assert.equal(JSON.stringify(source), before);
});

test("fixed corruption and abyss QA scenarios cover the exact room matrix", () => {
  const code = fs.readFileSync(path.join(root, "scenario-overrides.js"), "utf8");
  const vm = require("node:vm");
  const sandbox = { window: {}, URLSearchParams };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const api = sandbox.window.DungeonScenarioOverrides;
  const rooms = ["combat", "treasure", "shrine", "cursed", "merchant", "vault", "otter", "forge", "pact", "boss"];
  for (const [theme, depth] of [["corruption", 25], ["abyss", 45]]) {
    for (const room of rooms) {
      const scenario = api.parseScenarioRequest(`?scenario=${theme}_${room}_hd`, { maxDepth: 100 });
      assert.equal(scenario.id, `${theme}_${room}_hd`);
      assert.equal(scenario.depth, depth);
      assert.equal(scenario.roomType, room);
      assert.equal(scenario.bossRoom, room === "boss");
      assert.equal(scenario.finalBossPhase, room === "boss" && theme === "abyss" ? 2 : 0);
      assert.equal(scenario.forceRoomHDShowcaseSetup, true);
    }
  }
  const gameSource = fs.readFileSync(path.join(root, "game.js"), "utf8");
  assert.match(
    gameSource,
    /function bootstrapScenarioOverride\(\)[\s\S]*?dismissBootScreen\(\);[\s\S]*?startRun/,
    "auto-start QA scenarios must reveal the game instead of leaving the boot overlay above the canvas"
  );
});

test("Task 8 sources and deterministic transactional build are locked and reproducible", () => {
  const sourceRoot = path.join(root, "art", "source", "task8-hd");
  const lockPath = path.join(sourceRoot, "room-assets.lock.json");
  const buildPath = path.join(root, "scripts", "build-hd-room-assets.py");
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  assert.equal(lock.pipelineSchema, 1);
  assert.equal(lock.pillowVersion, "12.1.1");
  assert.equal(Object.keys(lock.sources).length, 30);
  for (const [relative, expected] of Object.entries(lock.sources)) {
    const filePath = path.join(root, ...relative.split("/"));
    assert.equal(sha(filePath), expected.sha256, relative);
  }
  assert.equal(Object.keys(lock.assets).length, 142);
  for (const [relative, expected] of Object.entries(lock.assets)) {
    assert.equal(sha(path.join(root, ...relative.split("/"))), expected, relative);
  }
  const before = sha(lockPath);
  const first = spawnSync("python", [buildPath, "--check"], { cwd: root, encoding: "utf8" });
  const second = spawnSync("python", [buildPath, "--check"], { cwd: root, encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(first.stdout, /Lock verification passed/);
  assert.equal(sha(lockPath), before, "--check must not publish or rewrite the lock");
});

test("concurrent locked Task 8 checks isolate their transaction trees", async () => {
  const buildPath = path.join(root, "scripts", "build-hd-room-assets.py");
  function runCheck() {
    return new Promise((resolve, reject) => {
      const child = spawn("python", [buildPath, "--check"], {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", reject);
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
  }

  const results = await Promise.all([runCheck(), runCheck(), runCheck()]);
  for (const [index, result] of results.entries()) {
    assert.equal(result.status, 0, `concurrent check ${index + 1} failed:\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Lock verification passed/);
    assert.equal(result.stderr, "");
  }
});

test("browser QA runner declares the required themed-room desktop/mobile screenshot matrix", () => {
  const scriptPath = path.join(root, "scripts", "capture-hd-room-qa.mjs");
  const source = fs.readFileSync(scriptPath, "utf8");
  for (const theme of ["corruption", "abyss"]) assert.match(source, new RegExp(`"${theme}"`));
  for (const room of ["combat", "cursed", "merchant", "forge", "pact", "vault", "otter", "boss"]) {
    assert.match(source, new RegExp(`"${room}"`));
  }
  assert.match(source, /1440[\s\S]*1000/);
  assert.match(source, /390[\s\S]*844/);
  assert.match(source, /graphicsMode[\s\S]*hd/);
  assert.match(source, /consoleErrors/);
  assert.match(source, /scrollTo\(0, 0\)[\s\S]*scrollY[\s\S]*=== 0/);
  assert.match(source, /const resume = process\.argv\.includes\("--resume"\)/);
  assert.match(source, /if \(\s*resume\s*&&\s*prior/);
});
