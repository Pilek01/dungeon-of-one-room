const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const ROSTER = Object.freeze(["slime", "skeleton", "brute", "acolyte", "skitter", "totem", "otter"]);
const MOBILE = Object.freeze(ROSTER.filter((type) => type !== "totem"));
const DIRECTIONS = Object.freeze(["south", "north", "east", "west"]);
const MOBILE_CLIPS = Object.freeze({ idle: 4, move: 4, attack: 4, hit: 2, death: 2 });
const TOTEM_CLIPS = Object.freeze({ idle: 4, awaken: 4, cast: 4, hit: 2, death: 2 });
const AFFixes = Object.freeze(["relentless", "juggernaut", "blooddrinker", "thorned", "volatile"]);
const PROMPTS = "art/briefs/enemy-hd-prompts.json";
const BUILD_SCRIPT = "scripts/build-enemy-animation-assets.py";
const BUILD_LOCK = "art/source/enemy-hd/enemy-animation-assets.lock.json";
const SEED_PREP_SCRIPT = "scripts/prepare-enemy-seed-assets.py";
const SEED_PREP_LOCK = "art/source/enemy-hd/enemy-seed-prep.lock.json";

function absolute(relative) { return path.join(ROOT, ...relative.split("/")); }
function readJson(relative) { return JSON.parse(fs.readFileSync(absolute(relative), "utf8")); }
function suffix(frame) { return String(frame).padStart(2, "0"); }

function expectedFrames() {
  const frames = [];
  for (const type of MOBILE) {
    for (const direction of DIRECTIONS) {
      for (const [clip, count] of Object.entries(MOBILE_CLIPS)) {
        for (let frame = 1; frame <= count; frame += 1) {
          frames.push({
            type, direction, clip, frame,
            key: `enemy.${type}.${direction}.${clip}.${suffix(frame)}`,
            src: `assets/hd/enemies/${type}/frames/${direction}-${clip}-${suffix(frame)}.png`
          });
        }
      }
    }
  }
  for (const [clip, count] of Object.entries(TOTEM_CLIPS)) {
    for (let frame = 1; frame <= count; frame += 1) {
      frames.push({
        type: "totem", direction: "base", clip, frame,
        key: `enemy.totem.base.${clip}.${suffix(frame)}`,
        src: `assets/hd/enemies/totem/frames/base-${clip}-${suffix(frame)}.png`
      });
    }
  }
  return frames;
}

const FINAL_FRAMES = Object.freeze(expectedFrames());

test("pre-generation brief freezes the seven silhouettes, 4x4 sheet contract and existing-signal limitations", () => {
  const brief = readJson(PROMPTS);
  assert.equal(brief.schemaVersion, 1);
  assert.deepEqual(Object.keys(brief.roster), ROSTER);
  assert.deepEqual(brief.frameSize, [64, 64]);
  assert.deepEqual(brief.anchor, [0.5, 1]);
  assert.equal(brief.chromaKey, "#ff00ff");
  assert.equal(brief.sourceSheet.layout, "4x4");
  for (const type of ROSTER) {
    assert.ok(brief.roster[type].seedPrompt.length > 80, `${type} needs a resolved seed prompt`);
    assert.match(brief.roster[type].seedPrompt, type === "totem" ? /base idle/i : /south-facing idle/i);
  }
  assert.deepEqual(brief.affixes, AFFixes);
  assert.ok(brief.existingSignalOnly.limitations.some((note) => /must not add simulation signals/i.test(note)));
  assert.ok(brief.existingSignalOnly.limitations.some((note) => /removed before a death clip/i.test(note)));
  assert.ok(brief.existingSignalOnly.limitations.some((note) => /totem awaken/i.test(note)));
});

test("contract enumerates exactly 384 mobile and 16 totem final frames", () => {
  assert.equal(FINAL_FRAMES.filter((frame) => frame.type !== "totem").length, 384);
  assert.equal(FINAL_FRAMES.filter((frame) => frame.type === "totem").length, 16);
  assert.equal(FINAL_FRAMES.length, 400);
  assert.equal(new Set(FINAL_FRAMES.map((frame) => frame.key)).size, 400);
  assert.equal(new Set(FINAL_FRAMES.map((frame) => frame.src)).size, 400);
});

test("DEFERRED seed-prep gate: seven immutable seeds produce 64 px previews and 25 exact edit canvases", () => {
  assert.equal(fs.existsSync(absolute(SEED_PREP_SCRIPT)), true, `missing ${SEED_PREP_SCRIPT}`);
  assert.equal(fs.existsSync(absolute(SEED_PREP_LOCK)), true, `missing ${SEED_PREP_LOCK}`);
  const lock = readJson(SEED_PREP_LOCK);
  assert.equal(lock.schemaVersion, 1);
  assert.equal(lock.chromaKey, "#ff00ff");
  assert.deepEqual(Object.keys(lock.seeds), ROSTER);
  assert.equal(Object.keys(lock.editCanvases).length, 25);
  for (const type of ROSTER) {
    const source = `art/source/enemy-hd/${type}-south-idle-seed.png`;
    const preview = `art/source/enemy-hd/${type}/${type}-south-idle-preview-64.png`;
    assert.equal(lock.seeds[type].path, source);
    assert.match(lock.seeds[type].sha256, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(absolute(source)), true, `missing ${source}`);
    assert.equal(fs.existsSync(absolute(preview)), true, `missing ${preview}`);
    assert.equal(
      crypto.createHash("sha256").update(fs.readFileSync(absolute(source))).digest("hex"),
      lock.seeds[type].sha256,
      `${type} seed bytes changed`
    );
    const directions = type === "totem" ? ["base"] : DIRECTIONS;
    for (const direction of directions) {
      const canvas = `art/source/enemy-hd/${type}/${type}-animation-${direction}-edit-canvas-1024.png`;
      assert.equal(lock.editCanvases[canvas].width, 1024);
      assert.equal(lock.editCanvases[canvas].height, 1024);
      assert.equal(lock.editCanvases[canvas].mode, "RGB");
      assert.equal(fs.existsSync(absolute(canvas)), true, `missing ${canvas}`);
    }
  }
  const probe = spawnSync("python", [SEED_PREP_SCRIPT, "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
});

test("DEFERRED source gate: every direction sheet is preserved and pinned by the immutable build lock", () => {
  assert.equal(fs.existsSync(absolute(BUILD_LOCK)), true, `missing Task 7 source lock ${BUILD_LOCK}`);
  const lock = readJson(BUILD_LOCK);
  assert.equal(lock.schemaVersion, 1);
  assert.equal(lock.chromaKey, "#ff00ff");
  assert.deepEqual(lock.frameSize, [64, 64]);
  assert.deepEqual(lock.anchor, [0.5, 1]);
  const expectedSheets = MOBILE.flatMap((type) => DIRECTIONS.map((direction) =>
    `art/source/enemy-hd/${type}/${type}-animation-${direction}-source-1024.png`
  )).concat(["art/source/enemy-hd/totem/totem-animation-base-source-1024.png"]);
  assert.deepEqual(Object.keys(lock.sourceSheets).sort(), expectedSheets.sort());
  for (const source of expectedSheets) {
    assert.equal(fs.existsSync(absolute(source)), true, `missing source bytes ${source}`);
    const actual = crypto.createHash("sha256").update(fs.readFileSync(absolute(source))).digest("hex");
    assert.match(lock.sourceSheets[source], /^[a-f0-9]{64}$/);
    assert.equal(actual, lock.sourceSheets[source], `source bytes changed: ${source}`);
  }
});

test("DEFERRED asset gate: per-type manifests cover 400 active critical bottom-centered RGBA frames with no chroma residue", () => {
  const errors = [];
  const manifestRows = [];
  for (const type of ROSTER) {
    const relative = `assets/hd/enemies/${type}/${type}-manifest.json`;
    if (!fs.existsSync(absolute(relative))) { errors.push(`missing ${relative}`); continue; }
    const manifest = readJson(relative);
    if (manifest.schemaVersion !== 1) errors.push(`${relative}: schemaVersion`);
    if (JSON.stringify(manifest.frameSize) !== "[64,64]") errors.push(`${relative}: frameSize`);
    if (JSON.stringify(manifest.renderSize) !== "[64,64]") errors.push(`${relative}: renderSize`);
    if (JSON.stringify(manifest.anchor) !== "[0.5,1]") errors.push(`${relative}: anchor`);
    if (manifest.group !== "enemies") errors.push(`${relative}: group`);
    if (!Array.isArray(manifest.clips) || manifest.clips.length !== 5) errors.push(`${relative}: clips`);
    if (type === "totem" && manifest.clips?.find((clip) => clip.name === "cast")?.fps !== 10) errors.push(`${relative}: totem cast fps`);
    if (!Array.isArray(manifest.frames)) errors.push(`${relative}: frames`);
    else manifestRows.push(...manifest.frames);
  }
  assert.deepEqual(errors, [], `Task 7 manifests are incomplete:\n${errors.join("\n")}`);
  assert.equal(manifestRows.length, 400);
  const byKey = new Map(manifestRows.map((entry) => [entry.key, entry]));
  for (const expected of FINAL_FRAMES) {
    assert.deepEqual(byKey.get(expected.key), { ...expected, group: "enemies", critical: true });
  }

  const missing = FINAL_FRAMES.map((frame) => frame.src).filter((src) => !fs.existsSync(absolute(src)));
  assert.deepEqual(missing, [], `missing final enemy frames:\n${missing.slice(0, 20).join("\n")}`);
  const probe = spawnSync("python", ["-c", String.raw`
from PIL import Image
import json, sys
bad=[]
for item in json.load(sys.stdin):
  with Image.open(item) as im:
    rgba=im.convert('RGBA')
    exact=near=0
    for r,g,b,a in rgba.getdata():
      if a and r==255 and g==0 and b==255: exact+=1
      if a and r>=240 and b>=240 and g<=20: near+=1
    if im.size!=(64,64) or im.mode!='RGBA' or exact or near:
      bad.append({'path':item,'size':im.size,'mode':im.mode,'exact':exact,'near':near})
print(json.dumps(bad))
`], {
    cwd: ROOT,
    encoding: "utf8",
    input: JSON.stringify(FINAL_FRAMES.map((frame) => absolute(frame.src))),
    maxBuffer: 8 * 1024 * 1024
  });
  assert.equal(probe.status, 0, probe.stderr);
  assert.deepEqual(JSON.parse(probe.stdout), []);
});

test("DEFERRED manifest gate: all 400 enemy frames are active critical entries", () => {
  const api = require(absolute("render/hd-asset-manifest.js"));
  const byKey = new Map(api.entries.map((entry) => [entry.key, entry]));
  for (const frame of FINAL_FRAMES) {
    assert.deepEqual(byKey.get(frame.key), { key: frame.key, src: frame.src, group: "enemies", critical: true });
  }
});

test("DEFERRED selector gate: existing snapshot signals select direction and clip without mutation", () => {
  const layers = require(absolute("render/hd-renderer-layers.js"));
  assert.equal(typeof layers.selectEnemyVisual, "function", "missing selectEnemyVisual(snapshot, enemy)");
  const cases = [
    [{ type: "slime", facing: "east" }, "idle", "east"],
    [{ type: "slime", facing: "west", _tweenT: 60 }, "move", "west"],
    [{ type: "skeleton", facing: "north", aiming: true }, "attack", "north"],
    [{ type: "skeleton", volleyAiming: true }, "attack", "south"],
    [{ type: "acolyte", castFlash: 1, acolyteCastType: "heal" }, "attack", "south"],
    [{ type: "brute", slamAiming: true }, "attack", "south"],
    [{ type: "brute", rests: true }, "attack", "south"],
    [{ type: "totem", castFlash: 1 }, "cast", "base"],
    [{ type: "otter", hitFlash: 1 }, "hit", "south"],
    [{ type: "skitter", hp: 0 }, "death", "south"]
  ];
  for (const [enemy, clip, direction] of cases) {
    const frozen = JSON.stringify(enemy);
    const selected = layers.selectEnemyVisual({ nowMs: 0 }, enemy);
    assert.equal(selected.clip, clip);
    assert.equal(selected.direction, direction);
    assert.equal(JSON.stringify(enemy), frozen, "selector mutated the enemy snapshot");
  }
  const unknown = layers.selectEnemyVisual({ nowMs: 0 }, { type: "unknown_type" });
  assert.equal(unknown.diagnostic, true);
  assert.equal(unknown.key, undefined);
  assert.equal(layers.selectEnemyVisual({ nowMs: 10000 }, { type: "otter", hitFlash: 120 }).frame, 1, "hit cannot inherit global runtime age");
  assert.equal(layers.selectEnemyVisual({ nowMs: 10000 }, { type: "totem", castFlash: 140 }).frame, 1, "cast cannot inherit global runtime age");
  assert.equal(layers.selectEnemyVisual({ nowMs: 10000 }, { type: "skeleton", aiming: true, telegraphAge: 0 }).frame, 1, "attack cannot inherit global runtime age");
  assert.equal(layers.selectEnemyVisual({ nowMs: 10000 }, { type: "skeleton", aiming: true, telegraphAge: 2 }).frame, 3, "telegraph age should advance attack frames");
});

test("DEFERRED renderer gate: 120 ms legacy tween is eased in HD and unknown/missing overlays stay visible", () => {
  const layers = require(absolute("render/hd-renderer-layers.js"));
  const calls = { images: [], fills: [], text: [] };
  const context = {
    fillStyle: "", font: "", textAlign: "", textBaseline: "",
    drawImage(...args) { calls.images.push(args); },
    fillRect(...args) { calls.fills.push([this.fillStyle, ...args]); },
    fillText(...args) { calls.text.push([this.fillStyle, ...args]); }
  };
  const baseKey = "enemy.slime.east.move.01";
  const assets = new Map([[baseKey, { id: "slime" }]]);
  layers.drawEnemiesLayer(context, { nowMs: 0, enemies: [{
    type: "slime", facing: "east", x: 2, y: 2, _tweenT: 60,
    _tweenFromX: 16, _tweenFromY: 32, elite: true, affix: "volatile"
  }] }, assets);
  assert.equal(calls.images.length >= 1, true, "missing optional elite/affix overlay hid the base actor");
  assert.equal(calls.images[0][1], 112, "120ms ease must map legacy x=1 to x=1.75 at t=60ms in HD");
  assert.equal(calls.images[0][2], 128, "bottom-center y must retain the legacy tween origin");

  calls.images.length = calls.fills.length = calls.text.length = 0;
  layers.drawEnemiesLayer(context, { nowMs: 0, enemies: [{ type: "unknown_type", x: 1, y: 1 }] }, new Map());
  assert.equal(calls.images.length, 0);
  assert.ok(calls.fills.some(([color]) => color === "#ff00ff"), "unknown placeholder needs magenta geometry");
  assert.ok(calls.text.some(([, value]) => value === "?"), "unknown placeholder needs a visible question mark");
});

test("HD enemy render profiles preserve bottom-center anchoring and a tile-centered HP rail", () => {
  const layers = require(absolute("render/hd-renderer-layers.js"));
  const calls = { images: [], fills: [] };
  const context = {
    fillStyle: "",
    drawImage(...args) { calls.images.push(args); },
    fillRect(...args) { calls.fills.push([this.fillStyle, ...args]); }
  };
  const assets = new Map([
    ["enemy.brute.south.idle.01", { id: "brute" }],
    ["enemy.totem.base.idle.01", { id: "totem" }],
    ["enemy.skeleton.south.idle.01", { id: "skeleton" }]
  ]);

  layers.drawEnemiesLayer(context, { nowMs: 0, enemies: [
    { type: "brute", x: 2, y: 2, hp: 8, maxHp: 10, showHpBar: true },
    { type: "totem", x: 4, y: 4 },
    { type: "skeleton", x: 6, y: 6 }
  ] }, assets);

  assert.deepEqual(calls.images, [
    [{ id: "brute" }, 120, 112, 80, 80],
    [{ id: "totem" }, 248, 240, 80, 80],
    [{ id: "skeleton" }, 384, 384, 64, 64]
  ]);
  assert.ok(
    calls.fills.some((call) => JSON.stringify(call) === JSON.stringify(["#17131f", 136, 114, 48, 5])),
    "brute HP rail must stay 48px wide and centered on its logical tile"
  );
});

test("elite and five affixes resolve to distinct optional Gothic crest assets without procedural fallback", () => {
  const layers = require(absolute("render/hd-renderer-layers.js"));
  assert.equal(typeof layers.getEnemyOverlayProfile, "function", "missing semantic crest profiles");
  const profiles = ["elite", ...AFFixes].map((name) => layers.getEnemyOverlayProfile(name));
  assert.ok(profiles.every((profile) => profile && profile.key.startsWith("ui.status.") && profile.src.endsWith(".png")));
  assert.equal(new Set(profiles.map((profile) => profile.key)).size, profiles.length);
  const source = fs.readFileSync(absolute("render/hd-renderer-layers.js"), "utf8");
  assert.doesNotMatch(source, /fallback:\s*["']procedural|drawProceduralOverlay/);
});

test("DEFERRED builder gate: pipeline is pinned, transactional, deterministic and supports --check", () => {
  assert.equal(fs.existsSync(absolute(BUILD_SCRIPT)), true, `missing Task 7 builder ${BUILD_SCRIPT}`);
  const source = fs.readFileSync(absolute(BUILD_SCRIPT), "utf8");
  assert.match(source, /--check/);
  assert.match(source, /lock/i);
  assert.match(source, /sha256/i);
  assert.match(source, /TemporaryDirectory|mkdtemp|staging/i);
  assert.match(source, /os\.replace|Path\.replace|rename/i);
  assert.doesNotMatch(source, /pip\s+install|subprocess.*pip/i);
  const lock = readJson(BUILD_LOCK);
  assert.match(lock.helper.playerBuilderSha256, /^[a-f0-9]{64}$/, "imported player builder helper must be pinned");
  // The locked 400-frame rebuild can exceed two minutes on a cold Windows
  // worktree once later HD batches increase filesystem and antivirus pressure.
  const check = spawnSync("python", [absolute(BUILD_SCRIPT), "--check"], { cwd: ROOT, encoding: "utf8", timeout: 240000 });
  assert.equal(check.status, 0, `${check.stdout}\n${check.stderr}`);
});
