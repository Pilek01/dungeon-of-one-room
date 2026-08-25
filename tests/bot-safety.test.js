const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const game = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");

const {
  canBotDrinkPotion,
  decideBotPotionUse,
  getForgeTargetForBot,
  getPendingBlastZones
} = require("../bot-safety.js");

function run() {
  assert.equal(canBotDrinkPotion({ potions: 2, hp: 30, maxHp: 100, oathPotionLockTurns: 0 }), true);
  assert.equal(canBotDrinkPotion({ potions: 1, hp: 100, maxHp: 100, poisonTurns: 3, poisonDamage: 8 }), true);
  assert.equal(canBotDrinkPotion({ potions: 1, hp: 100, maxHp: 100, poisonTurns: 1, poisonDamage: 1 }), false);
  assert.equal(canBotDrinkPotion({ potions: 2, hp: 30, maxHp: 100, oathPotionLockTurns: 2 }), false);
  assert.equal(canBotDrinkPotion({ potions: 2, hp: 30, maxHp: 100, hasRisk: true }), false);
  assert.equal(decideBotPotionUse({ hp: 90, maxHp: 100, incomingDamage: 5, effectiveHeal: 20, potions: 2 }).use, false);
  assert.equal(decideBotPotionUse({ hp: 40, maxHp: 100, incomingDamage: 45, effectiveHeal: 25, potions: 2 }).reason, "prevent_lethal");
  assert.equal(decideBotPotionUse({ hp: 100, maxHp: 100, poisonTurns: 3, poisonDamage: 8, potions: 1 }).reason, "cleanse_poison");
  assert.equal(decideBotPotionUse({ hp: 100, maxHp: 100, bleedTurns: 2, bleedDamage: 12, potions: 1 }).reason, "cleanse_bleed");
  for (const [options, reason] of [
    [{ hp: 50, maxHp: 100, incomingDamage: 1, effectiveHeal: 20, potions: 1, hasRisk: true }, "blocked_risk"],
    [{ hp: 50, maxHp: 100, incomingDamage: 1, effectiveHeal: 20, potions: 1, oathPotionLockTurns: 1 }, "blocked_oath"],
    [{ hp: 50, maxHp: 100, incomingDamage: 1, effectiveHeal: 20, potions: 0 }, "blocked_empty"],
    [{ hp: 0, maxHp: 100, incomingDamage: 1, effectiveHeal: 20, potions: 1 }, "blocked_dead"],
    [{ hp: 50, maxHp: 100, incomingDamage: 1, effectiveHeal: 20, potions: 1, boundaryPending: true }, "blocked_boundary"],
    [{ hp: 50, maxHp: 100, incomingDamage: 1, effectiveHeal: 20, potions: 1, turnInProgress: true }, "blocked_turn"],
    [{ hp: 50, maxHp: 100, incomingDamage: 1, effectiveHeal: 20, potions: 1, cooldownTurns: 2 }, "blocked_cooldown"],
    [{ hp: 50, maxHp: 100, incomingDamage: 1, effectiveHeal: 20, potions: 1, enemyTurnPending: true }, "blocked_turn"],
  ]) {
    assert.equal(decideBotPotionUse(options).reason, reason);
  }
  const duplicate = decideBotPotionUse({
    hp: 50, maxHp: 100, incomingDamage: 1, effectiveHeal: 20, potions: 1,
    turn: 7, enemyTurn: 2, hazardIdentity: "mine:3,4:1", lastPotionActionKey: "potion:7:2:mine%3A3%2C4%3A1"
  });
  assert.equal(duplicate.reason, "blocked_duplicate_action");
  assert.equal(decideBotPotionUse({ hp: 30, maxHp: 100, incomingDamage: 50, barrier: 20, effectiveHeal: 20, potions: 1 }).use, true);
  assert.equal(decideBotPotionUse({ hp: 30, maxHp: 100, incomingDamage: 1, effectiveHeal: 5, potions: 1 }).reason, "heal_waste");
  assert.match(game, /const potionDecision = getObserverBotPotionDecision\(\);\s*if \(potionDecision\.use\)/);
  assert.match(game, /recordObserverBotPotionUse\(potionDecision\.actionKey\)/);

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
