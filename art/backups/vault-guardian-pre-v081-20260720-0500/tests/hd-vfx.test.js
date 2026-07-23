const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const vfx = require(path.join(ROOT, "render", "hd-vfx.js"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("effect lifetime normalization is finite and clamped", () => {
  assert.equal(vfx.normalizeLifetime(50, 100), 0.5);
  assert.equal(vfx.normalizeLifetime(150, 100), 1);
  assert.equal(vfx.normalizeLifetime(-10, 100), 0);
  assert.equal(vfx.normalizeLifetime(10, 0), 0);
  assert.equal(vfx.normalizeLifetime("bad", 100), 0);
});

test("quality and accessibility profiles bound particles and flash", () => {
  assert.deepEqual(vfx.getVfxProfile({ quality: "high" }), {
    quality: "high", particleBudget: 96, lightFlashOpacity: 0.32, motionScale: 1
  });
  assert.equal(vfx.getVfxProfile({ quality: "medium" }).particleBudget, 48);
  assert.equal(vfx.getVfxProfile({ quality: "low" }).particleBudget, 24);
  assert.deepEqual(vfx.getVfxProfile({ quality: "high", reducedMotion: true, reducedFlash: true }), {
    quality: "high", particleBudget: 16, lightFlashOpacity: 0.16, motionScale: 0.35
  });
});

test("tile-safe area telegraphs clip to the 9x9 board and remain unique", () => {
  assert.deepEqual(vfx.areaTiles(0, 0, 1), [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }
  ]);
  assert.equal(vfx.areaTiles(4, 4, 1).length, 9);
  assert.deepEqual(vfx.areaTiles(8, 8, 1), [
    { x: 7, y: 7 }, { x: 8, y: 7 }, { x: 7, y: 8 }, { x: 8, y: 8 }
  ]);
});

test("telegraph commands map existing mine, volatile, dash aim and enemy aim state only", () => {
  const snapshot = {
    phase: "playing",
    nowMs: 400,
    dashAimActive: true,
    player: { x: 4, y: 6 },
    mines: [{ x: 0, y: 0, armed: true, fuseTurns: 1 }],
    volatileBursts: [{ x: 8, y: 8, source: "volatile", fuseTurns: 1 }],
    enemies: [{ x: 4, y: 2, anvilAiming: true, anvilDx: 1, anvilDy: 0 }]
  };
  const before = clone(snapshot);
  const commands = vfx.collectTelegraphCommands(snapshot, { quality: "high" });
  assert.deepEqual(snapshot, before);
  assert.ok(commands.some((command) => command.kind === "mine-area" && command.x === 0 && command.y === 0));
  assert.ok(commands.some((command) => command.kind === "volatile-area" && command.x === 8 && command.y === 8));
  assert.ok(commands.some((command) => command.kind === "dash-aim"));
  assert.ok(commands.some((command) => command.kind === "aim-line"));
  assert.ok(commands.filter((command) => command.kind.endsWith("-area")).every((command) => command.alpha <= 0.18));
  assert.ok(commands.every((command) => command.x === undefined || (command.x >= 0 && command.x <= 8)));
  assert.ok(commands.every((command) => command.y === undefined || (command.y >= 0 && command.y <= 8)));
});

test("HD Warden burst telegraph includes its subtle ability range", () => {
  const commands = vfx.collectTelegraphCommands({
    phase: "playing",
    depth: 25,
    wardenBurstRange: 4,
    nowMs: 400,
    player: { x: 4, y: 7 },
    enemies: [{ type: "warden", x: 4, y: 3, burstAiming: true }]
  }, { quality: "high" });
  const range = commands.find((command) => command.kind === "warden-burst-range");
  assert.ok(range);
  assert.equal(range.radius, 4);
  assert.ok(range.alpha > 0 && range.alpha <= 0.24);
  assert.ok(commands.some((command) => command.kind === "aim-line"));
});

test("VFX collection is deterministic, budgeted, pure and never consumes Math.random", () => {
  const snapshot = {
    nowMs: 1000,
    player: { x: 4, y: 4, skillShield: 10, hpShield: 5 },
    particles: Array.from({ length: 120 }, (_, index) => ({
      x: index % 144, y: (index * 7) % 144, life: 80, maxLife: 100, size: 1, color: "#ffaa55"
    })),
    floatingTexts: [{ x: 72, y: 48, life: 90, maxLife: 100, text: "-10", color: "#ffffff", size: 8 }],
    rangedBolts: [{ fromX: 8, fromY: 8, toX: 120, toY: 120, progress: 0.5, life: 100, maxLife: 200, color: "#99ddff" }],
    rangedImpacts: [{ x: 80, y: 64, radius: 3, life: 60, maxLife: 120, color: "#99ddff" }],
    dashTrails: [{ fromX: 8, fromY: 8, toX: 40, toY: 8, life: 90, maxLife: 180, color: "#9fdcff" }],
    shockwaveRings: [{ x: 72, y: 72, radius: 8, maxRadius: 24, life: 170, maxLife: 340, color: "#ffaa55", core: "#ffffff" }]
  };
  const before = clone(snapshot);
  const originalRandom = Math.random;
  Math.random = () => { throw new Error("renderer consumed gameplay RNG"); };
  try {
    const first = vfx.collectVfxCommands(snapshot, { quality: "low" });
    const second = vfx.collectVfxCommands(snapshot, { quality: "low" });
    assert.deepEqual(first, second);
    assert.deepEqual(snapshot, before);
    assert.ok(first.filter((command) => command.kind === "particle").length <= 24);
    assert.ok(first.some((command) => command.kind === "floating-text"));
    assert.equal(first.some((command) => command.kind === "shield"), false, "actor layers own protection VFX");
  } finally {
    Math.random = originalRandom;
  }
});

test("Dash and Shockwave commands preserve tier identity and expose Legendary afterline", () => {
  const snapshot = {
    nowMs: 900,
    player: {
      x: 4,
      y: 4,
      dashAfterline: { turns: 3, maxTurns: 4, tiles: [{ x: 2, y: 4 }, { x: 3, y: 4 }] }
    },
    dashTrails: Array.from({ length: 4 }, (_, tier) => ({
      fromX: 16,
      fromY: 16 + tier * 8,
      toX: 48,
      toY: 16 + tier * 8,
      life: 90,
      maxLife: 180,
      tier,
      style: tier === 3 ? "void" : "travel",
      seed: tier + 1
    })),
    shockwaveRings: Array.from({ length: 4 }, (_, tier) => ({
      x: 72,
      y: 72,
      radius: 8,
      maxRadius: 24,
      life: 170,
      maxLife: 340,
      skill: "aoe",
      tier,
      furySpent: tier,
      ringIndex: tier >= 2 ? 2 : 1,
      seed: tier + 11
    }))
  };
  const commands = vfx.collectVfxCommands(snapshot, { quality: "high" });
  assert.deepEqual(commands.filter((command) => command.kind === "dash-trail").map((command) => command.tier), [0, 1, 2, 3]);
  assert.deepEqual(commands.filter((command) => command.kind === "shockwave").map((command) => command.tier), [0, 1, 2, 3]);
  assert.equal(commands.filter((command) => command.kind === "dash-afterline").length, 2);
  assert.equal(commands.find((command) => command.kind === "shockwave" && command.tier === 3).furySpent, 3);
  const reduced = vfx.collectVfxCommands(snapshot, { quality: "high", reducedMotion: true });
  assert.ok(reduced.filter((command) => command.kind.startsWith("dash-")).every((command) => command.detailScale === 0.35));
});

test("non-skill rings keep the legacy renderer path", () => {
  const commands = vfx.collectVfxCommands({
    shockwaveRings: [{ x: 72, y: 72, radius: 8, life: 170, maxLife: 340, color: "#ffaa55" }]
  }, { quality: "high" });
  assert.equal(commands.find((command) => command.kind === "shockwave").skill, "");

  const counts = { stroke: 0, fill: 0 };
  const context = {
    save() {}, restore() {}, beginPath() {}, arc() {},
    stroke() { counts.stroke += 1; }, fill() { counts.fill += 1; }
  };
  vfx.drawVfx(context, {
    shockwaveRings: [{ x: 72, y: 72, radius: 8, life: 170, maxLife: 340, color: "#ffaa55" }]
  }, { quality: "high" });
  assert.deepEqual(counts, { stroke: 1, fill: 0 });
});

test("higher skill tiers produce progressively richer procedural draw passes", () => {
  function drawingContext() {
    const counts = { stroke: 0, fill: 0 };
    return {
      counts,
      save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, arc() {},
      stroke() { counts.stroke += 1; }, fill() { counts.fill += 1; }, fillRect() { counts.fill += 1; }, strokeRect() { counts.stroke += 1; },
      setLineDash() {},
      createRadialGradient() { return { addColorStop() {} }; }
    };
  }
  const drawTier = (tier) => {
    const context = drawingContext();
    vfx.drawVfx(context, {
      dashTrails: [{ fromX: 16, fromY: 32, toX: 64, toY: 32, life: 90, maxLife: 180, tier, style: tier === 3 ? "void" : "travel", seed: 5 }],
      shockwaveRings: [{ x: 72, y: 72, radius: 9, maxRadius: 24, life: 170, maxLife: 340, skill: "aoe", tier, furySpent: tier, seed: 7 }]
    }, { quality: "high" });
    return context.counts.stroke + context.counts.fill;
  };
  const complexity = [0, 1, 2, 3].map(drawTier);
  assert.ok(complexity[1] > complexity[0], complexity);
  assert.ok(complexity[2] > complexity[1], complexity);
  assert.ok(complexity[3] > complexity[2], complexity);
});

test("renderer wiring loads HD VFX before layers and replaces both no-op slots", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const layersSource = fs.readFileSync(path.join(ROOT, "render", "hd-renderer-layers.js"), "utf8");
  assert.ok(html.indexOf("render/hd-vfx.js") < html.indexOf("render/hd-renderer-layers.js"));
  assert.match(layersSource, /DungeonHDVfx/);
  assert.match(layersSource, /telegraphs:\s*drawTelegraphsLayer/);
  assert.match(layersSource, /vfx:\s*drawVfxLayer/);
});

test("debug-only VFX showcase exposes every production adapter without balance changes", () => {
  const scenarios = fs.readFileSync(path.join(ROOT, "scenario-overrides.js"), "utf8");
  const game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
  assert.match(scenarios, /vfx_showcase_hd/);
  assert.match(scenarios, /skill_vfx_tiers_hd/);
  assert.match(scenarios, /forceVfxHDShowcaseSetup:\s*true/);
  assert.match(game, /scenario\.forceVfxHDShowcaseSetup/);
  assert.match(game, /scenario\.forceSkillVfxTierShowcaseSetup/);
  assert.match(game, /maxLife:\s*1000000000/);
  for (const field of ["particles", "floatingTexts", "rangedBolts", "rangedImpacts", "dashTrails", "shockwaveRings", "volatileBursts"]) {
    assert.match(game, new RegExp(`state\\.${field}\\s*=`), `${field} needs deterministic scenario state`);
  }
});
