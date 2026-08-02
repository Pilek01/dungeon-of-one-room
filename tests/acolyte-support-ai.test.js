const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function loadDirector(random = () => 0.5) {
  const previousWindow = global.window;
  const previousRandom = Math.random;
  global.window = {};
  Math.random = random;
  delete require.cache[require.resolve("../enemy-director.js")];
  require("../enemy-director.js");
  return {
    director: global.window.DungeonEnemyDirector,
    restore() {
      Math.random = previousRandom;
      global.window = previousWindow;
    }
  };
}

function planInput(enemy, enemies, overrides = {}) {
  return {
    enemy,
    player: { x: 8, y: 4, hp: 100, maxHp: 100 },
    portal: { x: 8, y: 8 },
    enemies,
    chests: [],
    spikes: [],
    pits: [],
    inBounds: (x, y) => x >= 0 && x < 9 && y >= 0 && y < 9,
    meleeSlotsUsed: 0,
    meleeSlotsLimit: 1,
    playerShieldActive: false,
    playerLowHp: false,
    depth: 10,
    blackboard: null,
    supportRange: 4,
    ...overrides
  };
}

test("Acolyte support positioning never leaves a reachable anchor outside support range", () => {
  const loaded = loadDirector();
  try {
    for (let ax = 1; ax <= 7; ax += 1) {
      for (let ay = 1; ay <= 7; ay += 1) {
        for (let tx = 1; tx <= 7; tx += 1) {
          for (let ty = 1; ty <= 7; ty += 1) {
            const before = Math.abs(ax - tx) + Math.abs(ay - ty);
            if (before < 1 || before > 4) continue;
            const acolyte = { type: "acolyte", x: ax, y: ay, range: 4, cooldown: 2, aiming: false, aiPersonality: 0 };
            const ally = { type: "brute", x: tx, y: ty, hp: 10, maxHp: 10 };
            const plan = loaded.director.decidePlan(planInput(
              acolyte,
              [acolyte, ally],
              { supportTarget: { x: ally.x, y: ally.y } }
            ));
            const next = plan.moveTo || acolyte;
            const after = Math.abs(next.x - ally.x) + Math.abs(next.y - ally.y);
            assert.equal(plan.role, "support");
            assert.equal(plan.intent, "support");
            assert.ok(after <= 4, `${ax},${ay} -> ${next.x},${next.y}; ally ${tx},${ty}`);
          }
        }
      }
    }
  } finally {
    loaded.restore();
  }
});

test("Acolyte outside support range closes distance to its anchor", () => {
  const loaded = loadDirector();
  try {
    const acolyte = { type: "acolyte", x: 7, y: 7, range: 4, cooldown: 2, aiming: false, aiPersonality: 0 };
    const ally = { type: "warden", x: 1, y: 1, hp: 30, maxHp: 40 };
    const plan = loaded.director.decidePlan(planInput(
      acolyte,
      [acolyte, ally],
      { supportTarget: { x: ally.x, y: ally.y } }
    ));
    const next = plan.moveTo || acolyte;
    assert.ok(
      Math.abs(next.x - ally.x) + Math.abs(next.y - ally.y) <
        Math.abs(acolyte.x - ally.x) + Math.abs(acolyte.y - ally.y)
    );
  } finally {
    loaded.restore();
  }
});

test("solo Acolyte reports support role but keeps ranged attack fallback", () => {
  const loaded = loadDirector();
  try {
    const acolyte = { type: "acolyte", x: 4, y: 4, range: 4, cooldown: 0, aiming: false, aiPersonality: 0 };
    const plan = loaded.director.decidePlan(planInput(acolyte, [acolyte], { supportTarget: null }));
    assert.equal(plan.role, "support");
    assert.equal(plan.intent, "cast");
    assert.equal(plan.canCastNow, true);
  } finally {
    loaded.restore();
  }
});

test("Skeleton remains a ranged player-facing role", () => {
  const loaded = loadDirector();
  try {
    const skeleton = { type: "skeleton", x: 4, y: 4, range: 3, cooldown: 0, aiming: false, aiPersonality: 0 };
    const plan = loaded.director.decidePlan(planInput(skeleton, [skeleton]));
    assert.equal(plan.role, "ranged");
  } finally {
    loaded.restore();
  }
});

test("game cast plan keeps heal before buff and attack as the final fallback", () => {
  const game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
  const planStart = game.indexOf("function getAcolyteCastPlan");
  const heal = game.indexOf("const healTarget = getAcolyteHealTarget", planStart);
  const buff = game.indexOf("const buffTarget = getAcolyteBuffTarget", planStart);
  const attack = game.indexOf("if (!buffTarget)", planStart);
  assert.ok(planStart >= 0);
  assert.ok(heal > planStart);
  assert.ok(buff > heal);
  assert.ok(attack > buff);
});

test("game resolves Acolyte support movement before generic melee and player chase", () => {
  const game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
  const acolyteTurn = game.indexOf("const acolytePlan = getAcolyteCastPlan");
  const supportMove = game.indexOf(
    'if (enemy.type === "acolyte" && aiPlan.intent === "support")',
    acolyteTurn
  );
  const blacksmithTurn = game.indexOf('if (enemy.type === "blacksmith_guardian")', acolyteTurn);
  const genericChase = game.indexOf("stepToward(enemy, state.player.x, state.player.y)", blacksmithTurn);
  assert.ok(acolyteTurn >= 0);
  assert.ok(supportMove > acolyteTurn);
  assert.ok(supportMove < blacksmithTurn);
  assert.ok(genericChase > blacksmithTurn);
});
