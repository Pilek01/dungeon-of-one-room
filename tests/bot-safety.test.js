const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const game = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");

const {
  canBotDrinkPotion,
  decideBotEmergencyExtract,
  decideBotOffensiveMine,
  decideBotPotionUse,
  getBotEarlyPotionUpgradePlan,
  getBotCombatChestAdjustment,
  getBotGoldBankingPressure,
  getBotSkillSavingsUpgradeCount,
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
  assert.equal(decideBotPotionUse({ hp: 50, maxHp: 100, incomingDamage: 20, effectiveHeal: 20, potions: 1 }).reason, "prevent_critical");
  assert.equal(decideBotPotionUse({ hp: 30, maxHp: 100, incomingDamage: 10, effectiveHeal: 20, potions: 1 }).reason, "low_hp_useful_heal");
  assert.equal(decideBotPotionUse({ hp: 40, maxHp: 100, incomingDamage: 35, poisonTurns: 1, poisonDamage: 5, effectiveHeal: 0, potions: 1 }).reason, "prevent_lethal");
  assert.equal(decideBotPotionUse({ hp: 80, maxHp: 100, incomingDamage: 1, effectiveHeal: 20, potions: 1 }).reason, "high_hp_low_threat");
  assert.equal(decideBotPotionUse({ hp: 80, maxHp: 100, incomingDamage: 1, poisonTurns: 2, poisonDamage: 5, effectiveHeal: 20, potions: 1 }).reason, "cleanse_poison");
  assert.equal(decideBotPotionUse({ hp: 80, maxHp: 100, incomingDamage: 1, poisonTurns: 1, poisonDamage: 1, effectiveHeal: 20, potions: 1 }).reason, "high_hp_low_threat");
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
  assert.match(game, /bot\.potionUseTurns = turns\.slice\(-32\)/);
  const startRunIndex = game.indexOf("function startRun(options = {}) {");
  assert.ok(startRunIndex >= 0);
  assert.ok(game.indexOf('state.observerBot.lastPotionActionKey = "";', startRunIndex) > startRunIndex);
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

  assert.deepEqual(
    getBotEarlyPotionUpgradePlan({
      depth: 5,
      campGold: 120,
      satchelLevel: 0,
      potionStrengthLevel: 0,
      hpRatio: 0.9,
      lives: 3,
      survivabilityLevel: 6
    }),
    {
      active: true,
      satchelTarget: 2,
      potionStrengthTarget: 1,
      recommendedUpgrade: "satchel",
      reason: "early_capacity"
    }
  );
  assert.equal(
    getBotEarlyPotionUpgradePlan({
      depth: 8,
      campGold: 120,
      satchelLevel: 2,
      potionStrengthLevel: 0,
      hpRatio: 0.9,
      lives: 3,
      survivabilityLevel: 6
    }).recommendedUpgrade,
    "potion_strength"
  );
  assert.deepEqual(
    getBotEarlyPotionUpgradePlan({
      depth: 10,
      campGold: 360,
      satchelLevel: 2,
      potionStrengthLevel: 1,
      hpRatio: 0.82,
      lives: 3,
      survivabilityLevel: 7
    }),
    {
      active: true,
      satchelTarget: 3,
      potionStrengthTarget: 1,
      recommendedUpgrade: "satchel",
      reason: "funded_capacity"
    }
  );
  assert.deepEqual(
    getBotEarlyPotionUpgradePlan({
      depth: 12,
      campGold: 560,
      satchelLevel: 3,
      potionStrengthLevel: 1,
      hpRatio: 0.48,
      lives: 2,
      survivabilityLevel: 4
    }),
    {
      active: true,
      satchelTarget: 3,
      potionStrengthTarget: 2,
      recommendedUpgrade: "potion_strength",
      reason: "survival_healing"
    }
  );
  assert.deepEqual(
    getBotEarlyPotionUpgradePlan({
      depth: 12,
      campGold: 800,
      satchelLevel: 3,
      potionStrengthLevel: 1,
      hpRatio: 0.9,
      lives: 3,
      survivabilityLevel: 8
    }),
    {
      active: true,
      satchelTarget: 3,
      potionStrengthTarget: 2,
      recommendedUpgrade: "potion_strength",
      reason: "funded_healing"
    }
  );
  assert.deepEqual(
    getBotEarlyPotionUpgradePlan({
      depth: 70,
      campGold: 1000,
      satchelLevel: 1,
      potionStrengthLevel: 0,
      hpRatio: 0.4,
      lives: 1,
      survivabilityLevel: 2
    }),
    {
      active: false,
      satchelTarget: 1,
      potionStrengthTarget: 0,
      recommendedUpgrade: null,
      reason: "outside_early_game"
    }
  );

  const shallowGold = getBotGoldBankingPressure({ depth: 5, gold: 1000, profile: "balanced" });
  const deepGold = getBotGoldBankingPressure({ depth: 70, gold: 1000, profile: "balanced" });
  assert.equal(shallowGold.threshold, 700);
  assert.equal(shallowGold.strong, true);
  assert.equal(deepGold.threshold, 1870);
  assert.equal(deepGold.strong, false);
  assert.ok(shallowGold.score > deepGold.score);
  assert.ok(
    getBotGoldBankingPressure({ depth: 30, gold: 1000 }).threshold < deepGold.threshold,
    "gold bank threshold must scale upward with depth"
  );

  assert.equal(typeof getBotSkillSavingsUpgradeCount, "function");
  for (const [depth, expected] of [
    [0, 0],
    [10, 0],
    [11, 1],
    [15, 1],
    [16, 2],
    [70, 2]
  ]) {
    assert.equal(
      getBotSkillSavingsUpgradeCount(depth),
      expected,
      `depth ${depth} must reserve for ${expected} planned skill upgrades`
    );
  }

  assert.equal(
    getBotCombatChestAdjustment({ onChest: true, roomCleared: false, chase: false }),
    -110,
    "a random combat chest must keep the existing penalty"
  );
  assert.equal(
    getBotCombatChestAdjustment({ onChest: true, roomCleared: false, chase: true }),
    36,
    "a chest on the selected enemy route must become a positive transit action"
  );
  assert.equal(
    getBotCombatChestAdjustment({ onChest: true, roomCleared: true, chase: true }),
    0,
    "post-clear chest routing must remain unchanged"
  );
  assert.match(game, /if \(candidate\.chase && candidate\.onChest\) return "open_chest_to_enemy";/);

  const profitableMine = decideBotOffensiveMine({
    dashAvailable: true,
    mineArmed: false,
    adjacent: true,
    playerHp: 100,
    playerMaxHp: 100,
    playerBarrier: 0,
    entryDamage: 18,
    mineDamage: 75,
    expectedMeleeDamage: 45,
    enemies: [
      { hp: 100, inBlast: true },
      { hp: 70, inBlast: true },
      { hp: 35, inBlast: true }
    ],
    escapes: [
      { dx: 1, dy: 0, passable: true, distanceFromMine: 3, hazard: false, pendingBlastDamage: 0, expectedDamage: 8, risk: 18 }
    ]
  });
  assert.equal(profitableMine.use, true);
  assert.equal(profitableMine.reason, "profitable_safe_setup");
  assert.deepEqual(profitableMine.escape, { dx: 1, dy: 0 });
  assert.equal(profitableMine.enemyHits, 3);
  assert.equal(profitableMine.predictedKills, 2);
  assert.equal(profitableMine.expectedEnemyDamage, 180);

  for (const [name, input, reason] of [
    ["dash cooldown", { dashAvailable: false }, "dash_unavailable"],
    ["armed mine", { mineArmed: true }, "mine_not_available"],
    ["unsafe entry", { playerHp: 30, playerMaxHp: 100, entryDamage: 20 }, "unsafe_entry"],
    ["thin crowd", { enemies: [{ hp: 100, inBlast: true }] }, "poor_trade"],
    ["unsafe landing", { escapes: [{ dx: 1, dy: 0, passable: true, distanceFromMine: 1, hazard: false, pendingBlastDamage: 75, expectedDamage: 0, risk: 0 }] }, "no_safe_escape"]
  ]) {
    const decision = decideBotOffensiveMine({
      dashAvailable: true,
      mineArmed: false,
      adjacent: true,
      playerHp: 100,
      playerMaxHp: 100,
      playerBarrier: 0,
      entryDamage: 10,
      mineDamage: 75,
      expectedMeleeDamage: 45,
      enemies: [
        { hp: 100, inBlast: true },
        { hp: 70, inBlast: true },
        { hp: 35, inBlast: true }
      ],
      escapes: [{ dx: 1, dy: 0, passable: true, distanceFromMine: 3, hazard: false, pendingBlastDamage: 0, expectedDamage: 5, risk: 10 }],
      ...input
    });
    assert.equal(decision.use, false, name);
    assert.equal(decision.reason, reason, name);
  }

  const lethalBase = {
    hp: 20,
    maxHp: 100,
    incomingDamage: 25,
    barrier: 0,
    bleedTurns: 0,
    bleedDamage: 0,
    poisonTurns: 0,
    poisonDamage: 0
  };
  assert.deepEqual(decideBotEmergencyExtract(lethalBase), {
    extract: true,
    reason: "certain_lethal_no_survival",
    projectedDamage: 25
  });
  assert.equal(decideBotEmergencyExtract({ ...lethalBase, barrier: 10 }).reason, "not_lethal");
  assert.equal(decideBotEmergencyExtract({
    ...lethalBase,
    potion: { available: true, reliable: true, heal: 30, clearsStatuses: true }
  }).reason, "survives_with_potion");
  assert.equal(decideBotEmergencyExtract({
    ...lethalBase,
    shield: { available: true, reliable: true, amount: 10 }
  }).reason, "survives_with_shield");
  assert.equal(decideBotEmergencyExtract({ ...lethalBase, safeStepDamage: 0 }).reason, "survives_with_safe_step");
  assert.equal(decideBotEmergencyExtract({ ...lethalBase, safeDashDamage: 5 }).reason, "survives_with_safe_dash");
  assert.equal(decideBotEmergencyExtract({
    ...lethalBase,
    potion: { available: true, reliable: false, heal: 100, clearsStatuses: true }
  }).extract, true, "an unreliable defense must not suppress emergency extract");
  assert.equal(decideBotEmergencyExtract({
    ...lethalBase,
    incomingDamage: 12,
    hp: 16,
    bleedTurns: 2,
    bleedDamage: 5
  }).extract, true, "lethal status damage must be included");
  assert.equal(decideBotEmergencyExtract({
    ...lethalBase,
    incomingDamage: 12,
    bleedTurns: 3,
    bleedDamage: 3
  }).reason, "not_lethal", "future status ticks must not create false certainty about the next turn");

  assert.match(game, /getBotEarlyPotionUpgradePlan: getBotEarlyPotionUpgradePlanSafe/);
  assert.match(game, /getBotGoldBankingPressure: getBotGoldBankingPressureSafe/);
  assert.match(game, /decideBotOffensiveMine: decideBotOffensiveMineSafe/);
  assert.match(game, /decideBotEmergencyExtract: decideBotEmergencyExtractSafe/);
  assert.match(game, /function maybeObserverBotSetUpOffensiveMine\(\)/);
  assert.match(game, /decideBotEmergencyExtractSafe\(/);
  assert.match(game, /getBotGoldBankingPressureSafe\(/);

  console.log("bot-safety tests: OK");
}

run();
