const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const game = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");

const {
  canBotDrinkPotion,
  getForgeTargetForBot,
  getPendingBlastZones
} = require("../bot-safety.js");

function run() {
  assert.equal(canBotDrinkPotion({ potions: 2, hp: 30, maxHp: 100, oathPotionLockTurns: 0 }), true);
  assert.equal(canBotDrinkPotion({ potions: 2, hp: 30, maxHp: 100, oathPotionLockTurns: 2 }), false);
  assert.equal(canBotDrinkPotion({ potions: 2, hp: 30, maxHp: 100, hasRisk: true }), false);
  assert.match(game, /if \(canObserverBotDrinkPotion\(\)\) \{\s*addCandidate\(\{ kind: "potion" \}\);/);
  assert.match(game, /if \(!canObserverBotDrinkPotion\(\)\) return false;\s*const hpBefore/);

  assert.equal(getForgeTargetForBot(null), null);
  assert.equal(
    getForgeTargetForBot({ x: 4, y: 3, interactX: 4, interactY: 3, awakened: false, used: false }),
    null
  );
  assert.deepEqual(
    getForgeTargetForBot({ x: 4, y: 3, interactX: 4, interactY: 3, awakened: true, used: false }),
    { x: 4, y: 3 }
  );
  assert.equal(
    getForgeTargetForBot({ x: 4, y: 3, interactX: 4, interactY: 3, awakened: true, used: true }),
    null
  );

  const mineZones = getPendingBlastZones({
    mines: [{ x: 4, y: 4, armed: true, fuseTurns: 1, damage: 90 }],
    inBounds: (x, y) => x >= 0 && y >= 0 && x < 9 && y < 9
  });
  assert.equal(mineZones["4,4"].source, "mine");
  assert.ok(mineZones["3,3"]);
  assert.ok(mineZones["5,5"]);
  assert.equal(mineZones["4,4"].turnsUntilBlast, 1);

  const volatileZones = getPendingBlastZones({
    volatileBursts: [{ x: 2, y: 2, fuseTurns: 2, damage: 70, source: "volatile" }],
    inBounds: (x, y) => x >= 0 && y >= 0 && x < 9 && y < 9
  });
  assert.equal(volatileZones["2,2"].source, "volatile");
  assert.equal(volatileZones["2,2"].turnsUntilBlast, 2);

  const totemZones = getPendingBlastZones({
    volatileBursts: [{ x: 6, y: 6, fuseTurns: 1, damage: 60, source: "totem" }],
    inBounds: (x, y) => x >= 0 && y >= 0 && x < 9 && y < 9
  });
  assert.equal(totemZones["6,6"].source, "totem");
  assert.ok(totemZones["5,5"]);
  assert.ok(totemZones["7,7"]);

  console.log("bot-safety tests: OK");
}

run();
