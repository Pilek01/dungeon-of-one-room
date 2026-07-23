const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const MODULE = path.join(ROOT, "render", "hd-status-emblems.js");
const BUILDER = path.join(ROOT, "scripts", "build-status-emblem-assets.py");
const SOURCE_ROOT = path.join(ROOT, "art", "source", "status-emblems-hd");
const ASSET_ROOT = path.join(ROOT, "assets", "hd", "ui", "status");
const LOCK = path.join(SOURCE_ROOT, "status-emblems.lock.json");
const METADATA = path.join(ASSET_ROOT, "status-emblems.json");
const CONTACT_SHEET = path.join(SOURCE_ROOT, "status-emblems-contact-sheet.png");

const COMBAT = Object.freeze([
  "bleed", "poison", "burn", "freeze", "disorient", "enemy_buff",
  "fury", "attack_up", "armor_up", "max_hp_up", "lifesteal", "elixir",
  "shield", "barrier", "second_chance", "shrine_blessing"
]);
const SPECIAL = Object.freeze([
  "chaos", "pact", "hunger", "swap", "noise", "soul_harvest",
  "storm_sigil", "quickloader", "chest_upgrade", "last_stand",
  "elite", "relentless", "juggernaut", "blooddrinker", "thorned", "volatile"
]);
const IDS = Object.freeze([...COMBAT, ...SPECIAL]);

function loadStatus() {
  assert.equal(fs.existsSync(MODULE), true, "render/hd-status-emblems.js must exist");
  delete require.cache[require.resolve(MODULE)];
  return require(MODULE);
}

function pythonJson(source, args = []) {
  const result = spawnSync("python", ["-B", "-c", source, ...args], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("status catalog exposes exactly thirty-two immutable Gothic emblems", () => {
  const status = loadStatus();
  assert.deepEqual(status.entries.map((entry) => entry.id), IDS);
  assert.equal(Object.isFrozen(status), true);
  assert.equal(Object.isFrozen(status.entries), true);

  const keys = new Set();
  const sources = new Set();
  for (const descriptor of status.entries) {
    for (const field of ["id", "key", "src", "tone", "label", "priority"]) {
      assert.ok(Object.hasOwn(descriptor, field), `${descriptor.id} is missing ${field}`);
    }
    assert.equal(Object.isFrozen(descriptor), true);
    assert.match(descriptor.key, /^ui\.status\.[a-z0-9_]+$/);
    assert.match(descriptor.src, /^assets\/hd\/ui\/status\/[a-z0-9_-]+\.png$/);
    assert.equal(Number.isFinite(descriptor.priority), true);
    assert.equal(keys.has(descriptor.key), false, `duplicate key ${descriptor.key}`);
    assert.equal(sources.has(descriptor.src), false, `duplicate src ${descriptor.src}`);
    keys.add(descriptor.key);
    sources.add(descriptor.src);
  }
});

test("player status selection is deterministic, prioritized, limited, and non-mutating", () => {
  const status = loadStatus();
  const player = {
    bleeding: true,
    poisoned: true,
    skillShield: 20,
    hpShield: 15,
    furyBlessed: true,
    shrineBlessed: true
  };
  const before = structuredClone(player);
  const selected = status.selectActorStatuses(player, { kind: "player", limit: 3 });

  assert.deepEqual(selected.visible.map((item) => item.id), ["bleed", "poison", "shield"]);
  assert.equal(selected.overflow, 3);
  assert.deepEqual(player, before);
  assert.equal(Object.isFrozen(selected), true);
  assert.equal(Object.isFrozen(selected.visible), true);

  const again = status.selectActorStatuses(player, { kind: "player", limit: 3 });
  assert.deepEqual(again.visible.map((item) => item.id), ["bleed", "poison", "shield"]);
  assert.equal(again.overflow, selected.overflow);
  assert.doesNotMatch(fs.readFileSync(MODULE, "utf8"), /Math\.random/);
});

test("enemy dynamic statuses and independent canonical crests use fixed semantics", () => {
  const status = loadStatus();
  const dynamic = status.selectActorStatuses({
    frozenThisTurn: true,
    burnTurns: 2,
    disorientedTurns: 1,
    acolyteBuffTurns: 3
  }, { kind: "enemy", limit: 3 });
  assert.deepEqual(dynamic.visible.map((item) => item.id), ["freeze", "burn", "disorient"]);
  assert.equal(dynamic.overflow, 1);

  assert.deepEqual(
    status.selectEnemyCrests({ elite: true, affix: "vampiric" }).map((item) => item.id),
    ["elite", "blooddrinker"]
  );
  assert.equal(status.selectEnemyCrests({ affix: "fast" })[0].id, "relentless");
  assert.equal(status.selectEnemyCrests({ affix: "tank" })[0].id, "juggernaut");
  assert.equal(status.selectEnemyCrests({ affix: "vampiric" })[0].id, "blooddrinker");
});

test("HUD labels map to semantic emblems and unknown labels stay text-only", () => {
  const status = loadStatus();
  assert.equal(status.getHudStatusId("Grave Whisper"), "attack_up");
  assert.equal(status.getHudStatusId("Fractured Sigil"), "barrier");
  assert.equal(status.getHudStatusId("Burn DPS"), "burn");
  assert.equal(status.getHudStatusId("Shrine ARM"), "shrine_blessing");
  assert.equal(status.getHudStatusId("Blood Barrier"), "barrier");
  assert.equal(status.getHudStatusId("Momentum"), "quickloader");
  assert.equal(status.getHudStatusId("Engine of War"), "fury");
  assert.equal(status.getHudStatusId("Chest ATK"), "chest_upgrade");
  assert.equal(status.getHudStatusId("Fury Bless"), "fury");
  assert.equal(status.getHudStatusId("Combat Boost"), "attack_up");
  assert.equal(status.getHudStatusId("Last Resort"), "last_stand");
  assert.equal(status.getHudStatusId("Chaos ATK"), "chaos");
  assert.equal(status.getHudStatusId("Future Unknown Status"), null);
});

test("source atlases are immutable 4x4 magenta-backed originals", () => {
  const sources = [
    path.join(SOURCE_ROOT, "combat-status-atlas-source-original-v2.png"),
    path.join(SOURCE_ROOT, "special-affix-atlas-source-original-v2.png")
  ];
  for (const source of sources) {
    assert.equal(fs.existsSync(source), true, `missing ${path.relative(ROOT, source)}`);
  }
  const inspected = pythonJson(String.raw`
import hashlib, json, sys
from PIL import Image
result = []
for filename in sys.argv[1:]:
    with Image.open(filename) as image:
        rgb = image.convert("RGB")
        corners = [rgb.getpixel(point) for point in [(0,0), (rgb.width-1,0), (0,rgb.height-1), (rgb.width-1,rgb.height-1)]]
        result.append({
            "size": list(image.size),
            "mode": image.mode,
            "sha256": hashlib.sha256(open(filename, "rb").read()).hexdigest(),
            "corners": corners
        })
print(json.dumps(result))
`, sources);
  for (const source of inspected) {
    assert.equal(source.size[0], source.size[1], "source atlas must remain square");
    assert.ok(source.size[0] >= 1024, "source atlas must retain at least 1024px of source detail");
    assert.match(source.mode, /^(RGB|RGBA)$/);
    assert.match(source.sha256, /^[0-9a-f]{64}$/);
    for (const [red, green, blue] of source.corners) {
      assert.ok(red >= 220 && green <= 40 && blue >= 220, "source corners must remain near the requested #ff00ff key");
    }
  }
});

test("final status emblems are unique readable 64px RGBA assets", () => {
  assert.equal(fs.existsSync(METADATA), true, "status-emblems.json must exist");
  assert.equal(fs.existsSync(CONTACT_SHEET), true, "status-emblems-contact-sheet.png must exist");
  const metadata = JSON.parse(fs.readFileSync(METADATA, "utf8"));
  assert.deepEqual(metadata.emblems.map((item) => item.id), IDS);

  const files = IDS.map((id) => path.join(ASSET_ROOT, `${id.replaceAll("_", "-")}.png`));
  const inspected = pythonJson(String.raw`
import hashlib, json, sys
from PIL import Image
result = []
for filename in sys.argv[1:]:
    with Image.open(filename) as image:
        rgba = image.convert("RGBA")
        pixels = list(rgba.getdata())
        visible = [pixel for pixel in pixels if pixel[3] > 8]
        near_key = sum(1 for r,g,b,a in visible if r >= 238 and g <= 22 and b >= 238)
        small = rgba.resize((20, 20), Image.Resampling.LANCZOS)
        result.append({
            "size": list(rgba.size),
            "mode": rgba.mode,
            "corners": [rgba.getpixel(point)[3] for point in [(0,0),(63,0),(0,63),(63,63)]],
            "coverage": len(visible) / 4096,
            "nearKey": near_key,
            "entropy": len(set(small.getdata())),
            "hash": hashlib.sha256(rgba.tobytes()).hexdigest()
        })
print(json.dumps(result))
`, files);
  assert.equal(inspected.length, 32);
  assert.equal(new Set(inspected.map((item) => item.hash)).size, 32);
  for (const emblem of inspected) {
    assert.deepEqual(emblem.size, [64, 64]);
    assert.equal(emblem.mode, "RGBA");
    assert.deepEqual(emblem.corners, [0, 0, 0, 0]);
    assert.ok(emblem.coverage >= 0.04 && emblem.coverage <= 0.8);
    assert.equal(emblem.nearKey, 0);
    assert.ok(emblem.entropy >= 12, "20px preview must remain nonblank and readable");
  }
});

test("locked status build is reproducible and non-publishing", () => {
  assert.equal(fs.existsSync(BUILDER), true, "status emblem builder must exist");
  assert.equal(fs.existsSync(LOCK), true, "status emblem lock must exist");
  const tracked = [LOCK, METADATA, CONTACT_SHEET, ...IDS.map((id) => (
    path.join(ASSET_ROOT, `${id.replaceAll("_", "-")}.png`)
  ))];
  const before = new Map(tracked.map((file) => [file, crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]));
  const result = spawnSync("python", ["-B", BUILDER, "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const file of tracked) {
    const after = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    assert.equal(after, before.get(file), `${path.relative(ROOT, file)} changed during --check`);
  }
});

test("manifest and boot order expose all status emblems as optional UI assets", () => {
  const manifest = require(path.join(ROOT, "render", "hd-asset-manifest.js"));
  for (const id of IDS) {
    const entry = manifest.getByKey(`ui.status.${id}`);
    assert.ok(entry, `missing ui.status.${id}`);
    assert.equal(entry.group, "ui-status");
    assert.equal(entry.critical, false);
  }
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const modulePosition = index.indexOf("render/hd-status-emblems.js");
  assert.ok(modulePosition >= 0, "status module must be loaded");
  for (const consumer of ["render/visual-snapshot.js", "render/hd-renderer-layers.js", "game.js"]) {
    assert.ok(modulePosition < index.indexOf(consumer), `status module must load before ${consumer}`);
  }
});

test("HD HUD uses real semantic images while preserving the legacy status path", () => {
  const game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
  assert.match(game, /function hdStatusIcon\(id, accessibleLabel\)/);
  assert.match(game, /canvas\.dataset\.graphicsMode !== "hd"/);
  assert.match(game, /<img class="status-emblem/);
  assert.match(game, /descriptor\.src/);
  assert.match(game, /alt="" aria-hidden="true"/);
  assert.match(game, /getHudStatusId\(label\)/);
  assert.match(game, /hdStatusPill\("bleed"/);
  assert.match(game, /hdStatusPill\("poison"/);
  assert.match(game, /hdStatusPill\("shield"/);
  assert.match(game, /hdStatusPill\("barrier"/);
  assert.match(game, /display:inline-block;width:8px;height:8px;background:#ff5c5c/);
  assert.match(game, /SH:\$\{skillShield\}/);
  assert.match(game, /BR:\$\{barrierShield\}/);
  assert.match(
    game,
    /initialization\.then\([\s\S]{0,400}markUiDirty\(\)/,
    "HUD must rebuild after the asynchronous graphics mode settles"
  );
});

test("actor status rail uses fixed 20px geometry, three slots, and a compact overflow marker", () => {
  const layers = require(path.join(ROOT, "render", "hd-renderer-layers.js"));
  assert.equal(typeof layers.drawStatusRail, "function");
  const calls = { images: [], fills: [], text: [] };
  const context = {
    fillStyle: "", font: "", textAlign: "", textBaseline: "",
    drawImage(image, x, y, width, height) { calls.images.push({ key: image.key, x, y, width, height }); },
    fillRect(x, y, width, height) { calls.fills.push({ color: this.fillStyle, x, y, width, height }); },
    fillText(value, x, y) { calls.text.push({ value, x, y }); }
  };
  const keys = ["bleed", "poison", "shield"].map((id) => `ui.status.${id}`);
  const assets = new Map(keys.map((key) => [key, Object.freeze({ key })]));
  const actor = {
    bleeding: true, poisoned: true, skillShield: 10, hpShield: 12,
    furyBlessed: true, shrineBlessed: true, facing: "north"
  };
  const first = layers.drawStatusRail(context, actor, assets, {
    kind: "player", centerX: 160, topY: 100, limit: 3
  });
  assert.deepEqual(calls.images, [
    { key: "ui.status.bleed", x: 118, y: 100, width: 20, height: 20 },
    { key: "ui.status.poison", x: 140, y: 100, width: 20, height: 20 },
    { key: "ui.status.shield", x: 162, y: 100, width: 20, height: 20 }
  ]);
  assert.equal(first.overflow, 3);
  assert.deepEqual(calls.text.map((entry) => entry.value), ["+3"]);
  assert.deepEqual(calls.fills.map(({ x, y, width, height }) => ({ x, y, width, height })), [
    { x: 184, y: 101, width: 18, height: 18 }
  ]);

  calls.images.length = calls.fills.length = calls.text.length = 0;
  layers.drawStatusRail(context, { ...actor, facing: "west" }, assets, {
    kind: "player", centerX: 160, topY: 100, limit: 3
  });
  assert.deepEqual(calls.images.map(({ x, y }) => ({ x, y })), [
    { x: 118, y: 100 }, { x: 140, y: 100 }, { x: 162, y: 100 }
  ]);
});

test("enemy crests are independent optional images with no procedural substitute", () => {
  const layers = require(path.join(ROOT, "render", "hd-renderer-layers.js"));
  assert.equal(typeof layers.drawEnemyCrests, "function");
  const calls = [];
  const context = {
    drawImage(image, x, y, width, height) { calls.push({ key: image.key, x, y, width, height }); },
    fillRect() { assert.fail("missing optional crest must not invoke procedural geometry"); }
  };
  const assets = new Map([["ui.status.elite", Object.freeze({ key: "ui.status.elite" })]]);
  layers.drawEnemyCrests(context, { elite: true, affix: "vampiric" }, assets, {
    left: 128, right: 192, top: 128
  });
  assert.deepEqual(calls, [{ key: "ui.status.elite", x: 152, y: 128, width: 16, height: 16 }]);

  const rendererSource = fs.readFileSync(path.join(ROOT, "render", "hd-renderer-layers.js"), "utf8");
  assert.doesNotMatch(rendererSource, /drawProceduralOverlay|crown-chevrons|double-wing|broken-diamond/);
});
