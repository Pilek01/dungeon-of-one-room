const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const DIRECTIONS = ["south", "north", "east", "west"];
const PROFILES = {
  "vault-guardian": { type: "guardian", phase: null, clip: "attack", size: 128 },
  "blacksmith-guardian": { type: "blacksmith_guardian", phase: null, clip: "attack", size: 128 },
  "warden/phase-1": { type: "warden", phase: 1, clip: "cast", size: 160 },
  "warden/phase-2": { type: "warden", phase: 2, clip: "cast", size: 192 }
};
const CLIPS = { idle: 4, move: 4, action: 4, hit: 2, death: 2 };
const PREP_SCRIPT = "scripts/prepare-boss-seed-assets.py";
const PREP_LOCK = "art/source/boss-hd/boss-seed-prep.lock.json";
const PROMPTS = "art/briefs/boss-hd-prompts.json";

function manifestPath(profile) {
  return path.join(ROOT, "assets", "hd", "bosses", profile, "boss-manifest.json");
}

function readManifest(profile) {
  return JSON.parse(fs.readFileSync(manifestPath(profile), "utf8"));
}

function pngHeader(file) {
  const bytes = fs.readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

test("boss seed preparation pins four identities and sixteen exact direction canvases", () => {
  for (const relative of [PREP_SCRIPT, PREP_LOCK, PROMPTS]) {
    assert.equal(fs.existsSync(path.join(ROOT, relative)), true, `missing ${relative}`);
  }
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, PREP_LOCK), "utf8"));
  const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, PROMPTS), "utf8"));
  assert.equal(lock.schemaVersion, 1);
  assert.equal(lock.chromaKey, "#ff00ff");
  assert.deepEqual(Object.keys(lock.seeds), Object.keys(PROFILES));
  assert.equal(Object.keys(lock.editCanvases).length, 16);
  assert.deepEqual(Object.keys(prompts.profiles), Object.keys(PROFILES));
  for (const [profile, contract] of Object.entries(PROFILES)) {
    const source = lock.seeds[profile].path;
    const bytes = fs.readFileSync(path.join(ROOT, source));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), lock.seeds[profile].sha256);
    assert.equal(lock.seeds[profile].finalSize, contract.size);
    for (const direction of DIRECTIONS) {
      const canvas = `art/source/boss-hd/${profile.replace("/", "-")}/${profile.replace("/", "-")}-animation-${direction}-edit-canvas-1024.png`;
      assert.deepEqual(
        [lock.editCanvases[canvas].width, lock.editCanvases[canvas].height, lock.editCanvases[canvas].mode],
        [1024, 1024, "RGB"]
      );
      const prompt = prompts.profiles[profile].prompts[direction];
      assert.match(prompt, /exactly sixteen isolated poses/i);
      assert.match(prompt, /R1 idle01, idle02, idle03, idle04/);
      assert.match(prompt, contract.clip === "cast" ? /R3 cast01, cast02, cast03, cast04/ : /R3 attack01, attack02, attack03, attack04/);
    }
  }
  const probe = spawnSync("python", [PREP_SCRIPT, "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
});

test("four boss profiles ship complete critical directional animation sets", () => {
  for (const [profile, contract] of Object.entries(PROFILES)) {
    const manifest = readManifest(profile);
    assert.deepEqual(manifest.frameSize, [contract.size, contract.size]);
    assert.deepEqual(manifest.renderSize, [contract.size, contract.size]);
    assert.deepEqual(manifest.anchor, [0.5, 1]);
    assert.equal(manifest.type, contract.type);
    assert.equal(manifest.phase ?? null, contract.phase);
    assert.equal(typeof manifest.renderSizeRationale, "string");
    assert.ok(manifest.renderSizeRationale.length > 20);
    assert.equal(manifest.frames.length, 64);
    assert.match(manifest.source.sha256, /^[a-f0-9]{64}$/);
    const actionName = contract.clip;
    for (const direction of DIRECTIONS) {
      for (const [alias, count] of Object.entries(CLIPS)) {
        const clip = alias === "action" ? actionName : alias;
        for (let frame = 1; frame <= count; frame += 1) {
          const suffix = String(frame).padStart(2, "0");
          const phasePart = contract.phase ? `.phase${contract.phase}` : "";
          const expectedKey = `boss.${contract.type}${phasePart}.${direction}.${clip}.${suffix}`;
          const record = manifest.frames.find((item) => item.key === expectedKey);
          assert.ok(record, `missing ${expectedKey}`);
          assert.equal(record.critical, true);
          assert.equal(record.group, "bosses");
          const header = pngHeader(path.join(ROOT, record.src));
          assert.deepEqual([header.width, header.height], [contract.size, contract.size]);
          assert.equal(header.colorType, 6, `${expectedKey} must be RGBA`);
        }
      }
    }
  }
});

test("barrier and Void Aegis overlays are optional four-frame bottom-center layers", () => {
  const overlays = [
    ["blacksmith-barrier", "boss.blacksmith_guardian.overlay.barrier"],
    ["warden-void-aegis", "boss.warden.overlay.voidaegis"]
  ];
  for (const [name, prefix] of overlays) {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "hd", "bosses", "overlays", `${name}-manifest.json`), "utf8"));
    assert.deepEqual(manifest.frameSize, [192, 192]);
    assert.deepEqual(manifest.anchor, [0.5, 1]);
    assert.equal(manifest.frames.length, 4);
    manifest.frames.forEach((frame, index) => {
      assert.equal(frame.key, `${prefix}.${String(index + 1).padStart(2, "0")}`);
      assert.equal(frame.critical, false);
      assert.deepEqual(Object.values(pngHeader(path.join(ROOT, frame.src))).slice(0, 2), [192, 192]);
    });
  }
});

test("active HD manifest includes every critical boss frame, Warden biome variant and optional overlay", () => {
  const manifest = require("../render/hd-asset-manifest.js");
  const bossEntries = manifest.entries.filter((entry) => entry.group === "bosses");
  assert.equal(bossEntries.filter((entry) => entry.critical).length, 448);
  assert.equal(bossEntries.filter((entry) => !entry.critical).length, 8);
  assert.equal(new Set(bossEntries.map((entry) => entry.key)).size, 456);
  for (const theme of ["descent", "corruption", "abyss"]) {
    for (const direction of DIRECTIONS) {
      assert.equal(
        manifest.getByKey(`boss.warden.${theme}.${direction}.idle.01`)?.src,
        `assets/hd/bosses/warden-biome-${theme}/frames/${direction}-idle-01.png`
      );
    }
  }
  for (const overlayName of ["blacksmith-barrier", "warden-void-aegis"]) {
    const overlay = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "hd", "bosses", "overlays", `${overlayName}-manifest.json`), "utf8"));
    for (const frame of overlay.frames) {
      assert.equal(manifest.getByKey(frame.key)?.src, frame.src, `${frame.key} must use its published overlay path`);
    }
  }
});

test("boss selector is pure and prioritizes death, hit, cast/attack, move, idle", () => {
  const layers = require("../render/hd-renderer-layers.js");
  assert.equal(typeof layers.selectBossVisual, "function");
  const cases = [
    [{ type: "guardian", hp: 0, hitFlash: 99, slamAiming: true }, 0, "death"],
    [{ type: "guardian", hp: 10, hitFlash: 99, slamAiming: true }, 0, "hit"],
    [{ type: "guardian", hp: 10, slamAiming: true, telegraphAge: 2 }, 0, "attack"],
    [{ type: "blacksmith_guardian", hp: 10, anvilAiming: true }, 0, "attack"],
    [{ type: "warden", hp: 10, castFlash: 100 }, 1, "cast"],
    [{ type: "warden", hp: 10, aiming: true }, 2, "cast"],
    [{ type: "warden", hp: 10, _tweenT: 60 }, 2, "move"],
    [{ type: "warden", hp: 10, _tweenT: 120 }, 2, "idle"]
  ];
  for (const [actor, phase, clip] of cases) {
    const snapshot = Object.freeze({ nowMs: 800, finalBossPhase: phase });
    const frozen = Object.freeze({ facing: "east", ...actor });
    const before = JSON.stringify(frozen);
    assert.equal(layers.selectBossVisual(snapshot, frozen).clip, clip);
    assert.equal(JSON.stringify(frozen), before);
  }
  assert.equal(layers.selectBossVisual({}, { type: "not-a-boss" }).diagnostic, true);
  assert.deepEqual(
    [360, 270, 180, 90].map((castFlash) =>
      layers.selectBossVisual({ finalBossPhase: 2 }, { type: "warden", hp: 10, castFlash }).frame
    ),
    [1, 2, 3, 4]
  );
  for (const depth of [5, 25, 45, 60]) {
    assert.match(layers.selectBossVisual({ depth }, { type: "guardian", hp: 10 }).key, /^boss\.guardian\.south/);
  }
  assert.match(layers.selectBossVisual({ depth: 5, finalBossPhase: 0 }, { type: "warden", hp: 10 }).key, /^boss\.warden\.descent\.south/);
  assert.match(layers.selectBossVisual({ depth: 25, finalBossPhase: 0 }, { type: "warden", hp: 10 }).key, /^boss\.warden\.corruption\.south/);
  assert.match(layers.selectBossVisual({ depth: 45, finalBossPhase: 0 }, { type: "warden", hp: 10 }).key, /^boss\.warden\.abyss\.south/);
  assert.match(layers.selectBossVisual({ depth: 60, finalBossPhase: 0 }, { type: "warden", hp: 10 }).key, /^boss\.warden\.phase1\.south/);
  assert.match(layers.selectBossVisual({ depth: 100, finalBossPhase: 1 }, { type: "warden", hp: 10 }).key, /^boss\.warden\.phase1\.south/);
  assert.match(layers.selectBossVisual({ depth: 100, finalBossPhase: 2 }, { type: "warden", hp: 10 }).key, /^boss\.warden\.phase2\.south/);
  assert.deepEqual(
    [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65].map((depth) => layers.getDepthBiome(depth)),
    ["descent", "descent", "descent", "corruption", "corruption", "corruption", "corruption", "abyss", "abyss", "abyss", "abyss", "beyond", "beyond"]
  );
  assert.equal(layers.getEnvironmentTheme(60), "beyond");
});

test("Warden biome variants ship complete prototype-derived directional animation sets", () => {
  for (const theme of ["descent", "corruption", "abyss"]) {
    const variant = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "hd", "bosses", `warden-biome-${theme}`, "boss-manifest.json"), "utf8"));
    assert.equal(variant.biome, theme);
    assert.equal(variant.type, "warden");
    assert.deepEqual(variant.renderSize, [160, 160]);
    assert.equal(variant.frames.length, 64);
    assert.match(variant.source.sha256, /^[a-f0-9]{64}$/);
    for (const direction of DIRECTIONS) {
      assert.equal(variant.source.sheets[direction].path, `art/source/boss-hd/warden-biome-${theme}/warden-biome-${theme}-animation-${direction}-source-1024.png`);
    }
  }
});

test("boss drawing uses bottom-center overhang and procedural overlay fallback", () => {
  const layers = require("../render/hd-renderer-layers.js");
  const calls = [];
  const context = {
    drawImage(...args) { calls.push(["image", ...args]); },
    fillRect(...args) { calls.push(["rect", ...args]); },
    set fillStyle(value) { this._fillStyle = value; }, get fillStyle() { return this._fillStyle; },
    fillText() {}, set font(_) {}, set textAlign(_) {}, set textBaseline(_) {}
  };
  const snapshot = { nowMs: 0, finalBossPhase: 2, enemies: [{ type: "warden", x: 4, y: 4, hp: 10, facing: "south", voidAegisShield: 20, voidAegisTurns: 2 }] };
  const selected = layers.selectBossVisual(snapshot, snapshot.enemies[0]);
  const assets = new Map([[selected.key, {}]]);
  assert.equal(layers.drawEnemiesLayer(context, snapshot, assets), true);
  const draw = calls.find((item) => item[0] === "image");
  assert.deepEqual(draw.slice(-4), [192, 128, 192, 192]);
  assert.ok(calls.some((item) => item[0] === "rect"), "missing optional aegis art must draw a procedural fallback");
});

test("visual snapshot and deterministic scenarios expose existing boss presentation state only", () => {
  const snapshotSource = fs.readFileSync(path.join(ROOT, "render", "visual-snapshot.js"), "utf8");
  for (const field of ["finalBossPhase", "facing", "hitFlash", "castFlash", "telegraphAge", "blacksmithBarrier", "blacksmithBarrierTurns", "voidAegisShield", "voidAegisTurns", "anvilAiming", "slamAiming", "aiming"]) {
    assert.match(snapshotSource, new RegExp(`\\"${field}\\"`));
  }
  const context = { window: {}, URLSearchParams };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "scenario-overrides.js"), "utf8"), context);
  const scenarios = context.window.DungeonScenarioOverrides;
  for (const id of ["vault_guardian_hd", "blacksmith_guardian_hd", "warden_phase1_hd", "warden_phase2_aegis_hd"]) {
    assert.equal(scenarios.SCENARIOS[id].forceBossHDShowcaseSetup, true);
  }
  assert.equal(scenarios.SCENARIOS.descent_warden_hd.depth, 5);
  assert.equal(scenarios.SCENARIOS.corruption_warden_hd.depth, 25);
  assert.equal(scenarios.SCENARIOS.vault_guardian_hd.depth, 30);
  assert.equal(scenarios.SCENARIOS.abyss_warden_hd.depth, 45);
  assert.equal(scenarios.SCENARIOS.beyond_warden_hd.depth, 65);
});

test("boss asset builder is pinned, checkable and transactional", () => {
  const source = fs.readFileSync(path.join(ROOT, "scripts", "build-boss-animation-assets.py"), "utf8");
  assert.match(source, /SUPPORTED_PILLOW_VERSION/);
  assert.match(source, /--check/);
  assert.match(source, /TemporaryDirectory|mkdtemp/);
  assert.match(source, /lock\.json/);
  assert.match(source, /expected exactly 16 meaningful components/);
  assert.match(source, /near chroma/i);
  assert.ok(source.indexOf("PLAYER_BUILDER_SHA256") < source.indexOf("exec_module(PIPE)"), "player helper hash must be declared before execution");
  assert.ok(source.indexOf("sha256(PLAYER_BUILDER)") < source.indexOf("exec_module(PIPE)"), "player helper must be verified before execution");
});

test("boss QA runner verifies mobile controls instead of accepting blank chrome", () => {
  const source = fs.readFileSync(path.join(ROOT, "scripts", "capture-hd-boss-qa.mjs"), "utf8");
  assert.match(source, /skillsBarVisible/);
  assert.match(source, /mobileControlsVisible/);
  assert.match(source, /viewportName\s*===\s*["']mobile["']/);
});
