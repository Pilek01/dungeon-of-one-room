const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  chooseMerchantRelicOffer
} = require("../merchant-curation.js");

  const game = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
  assert.match(game, /function buildObserverMerchantDecision\(context\s*=\s*\{\}\)/u);
  assert.match(game, /offer_pending|no_canonical_choice|bag_full|stock_sufficient/u);
  assert.match(game, /normalCeiling|potionUseTurns/u);

function run() {
  {
    const pool = [
      { id: "idol", rarity: "rare", name: "Golden Idol" },
      { id: "echostrike", rarity: "epic", name: "Echo Strike" },
      { id: "bloodvial", rarity: "epic", name: "Blood Vial" }
    ];

    const choice = chooseMerchantRelicOffer({
      tierPool: pool,
      loadout: [],
      random: () => 0
    });

    assert.equal(choice.relic.id, "idol");
    assert.equal(choice.tag, "");
  }

  {
    const loadout = [];
    const pool = [
      { id: "idol", rarity: "rare", name: "Golden Idol" },
      { id: "bloodvial", rarity: "epic", name: "Blood Vial" }
    ];

    const choice = chooseMerchantRelicOffer({
      tierPool: pool,
      loadout,
      random: () => 0
    });

    assert.ok(choice.relic);
    assert.equal(choice.tag, "");
  }

  {
    const pool = [
      { id: "idol", rarity: "rare", name: "Golden Idol" },
      { id: "borrowedtime", rarity: "epic", name: "Borrowed Time" },
      { id: "phasecloak", rarity: "epic", name: "Phase Cloak" }
    ];

    const choice = chooseMerchantRelicOffer({
      tierPool: pool,
      loadout: [],
      random: () => 0.99
    });

    assert.equal(choice.relic.id, "phasecloak");
    assert.equal(choice.tag, "");
  }

  console.log("merchant-curation tests: OK");
}

run();

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const open = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

const buildObserverMerchantDecision = new Function(
  `return (${extractFunction(game, "buildObserverMerchantDecision")});`
)();

function policyState(overrides = {}) {
  return {
    observerBot: { merchantPurchasesThisRoom: 0, potionUseTurns: [] },
    player: { hp: 80, maxHp: 100, potions: 0, maxPotions: 8, gold: 300 },
    campGold: 0,
    lives: 3,
    turn: 12,
    ...overrides
  };
}

{
  const decision = buildObserverMerchantDecision({
    state: policyState(),
    choices: [{ kind: "merchant_potion", choiceId: "potion", price: 20, status: "available" }],
    potionUseTurns: [2, 8, 11],
    nextIsBoss: true
  });
  assert.equal(decision.action, "potion");
  assert.deepEqual(decision.request, { action: "potion" });
}

{
  const decision = buildObserverMerchantDecision({
    state: policyState({ player: { hp: 100, maxHp: 100, potions: 2, maxPotions: 8, gold: 300 } }),
    choices: [{ kind: "merchant_potion", choiceId: "potion", price: 20, status: "available" }]
  });
  assert.equal(decision.action, "leave");
  assert.equal(decision.reason, "stock_sufficient");
}

{
  const decision = buildObserverMerchantDecision({
    state: policyState({ player: { hp: 100, maxHp: 100, potions: 0, maxPotions: 8, gold: 10 }, campGold: 200 }),
    choices: [{ kind: "merchant_potion", choiceId: "potion", price: 50, status: "available" }]
  });
  assert.equal(decision.action, "leave");
  assert.equal(decision.reason, "camp_reserve");
}

{
  const decision = buildObserverMerchantDecision({
    state: policyState({ player: { hp: 100, maxHp: 100, potions: 2, maxPotions: 8, gold: 100 } }),
    choices: [{ kind: "merchant_skill_upgrade", choiceId: "shield", skillId: "shield", price: 20, status: "available" }]
  });
  assert.deepEqual(decision.request, { action: "skill_upgrade", skillId: "shield" });
}


function merchantDecision(overrides = {}) {
  return buildObserverMerchantDecision({
    state: policyState(),
    choices: [],
    ...overrides
  });
}

for (const [name, context, reason] of [
  ["pending", { mutationState: { status: "pending" } }, "offer_pending"],
  ["uncertain", { mutationState: { status: "uncertain" } }, "offer_pending"],
  ["resyncing", { mutationState: { status: "resyncing" } }, "offer_pending"],
  ["backoff", { mutationState: { status: "backoff" } }, "failure_backoff"],
  ["purchase limit", { state: policyState({ observerBot: { merchantPurchasesThisRoom: 6 } }) }, "purchase_limit"],
  ["absent offer", {}, "no_canonical_choice"],
  ["full bag", { state: policyState({ player: { hp: 80, maxHp: 100, potions: 8, maxPotions: 8, gold: 300 } }), choices: [{ kind: "merchant_potion", price: 20, status: "available" }] }, "bag_full"],
  ["empty wallet", { choices: [{ kind: "merchant_potion", price: 50, status: "available" }], state: policyState({ player: { hp: 80, maxHp: 100, potions: 0, maxPotions: 8, gold: 0 } }) }, "insufficient_wallet"],
  ["run reserve", { choices: [{ kind: "merchant_potion", price: 100, status: "available" }], state: policyState({ player: { hp: 80, maxHp: 100, potions: 0, maxPotions: 8, gold: 10 }, campGold: 300 }) }, "run_reserve"],
  ["no useful upgrade", { state: policyState({ player: { hp: 100, maxHp: 100, potions: 2, maxPotions: 8, gold: 300 } }), choices: [{ kind: "merchant_unknown", price: 20, status: "available" }] }, "no_useful_upgrade"]
]) {
  const decision = merchantDecision({ ...context });
  assert.equal(decision.action, "leave", `${name} must close the controller`);
  assert.equal(decision.reason, reason, `${name} must use the canonical closed reason`);
}

{
  const decision = merchantDecision({
    state: policyState({ player: { hp: 80, maxHp: 100, potions: 3, maxPotions: 8, gold: 300 }, turn: 30 }),
    potionUseTurns: [5, 10, 15, 20, 25, 29],
    choices: [{ kind: "merchant_potion", price: 20, status: "available" }]
  });
  assert.equal(decision.action, "potion", "six recent uses must raise the 2/8 potion target");
}

{
  const decision = merchantDecision({
    state: policyState({ player: { hp: 80, maxHp: 100, potions: 2, maxPotions: 8, gold: 300 }, lives: 2 }),
    nextIsBoss: true,
    choices: [{ kind: "merchant_potion", price: 20, status: "available" }]
  });
  assert.equal(decision.action, "potion", "boss and low-life pressure must raise potion target");
}

{
  const skill = merchantDecision({
    state: policyState({ player: { hp: 100, maxHp: 100, potions: 2, maxPotions: 8, gold: 100 } }),
    choices: [{ kind: "merchant_skill_upgrade", skillId: "dash", price: 20, status: "available" }]
  });
  assert.deepEqual(skill.request, { action: "skill_upgrade", skillId: "dash" });

  const relic = merchantDecision({
    state: policyState({ player: { hp: 100, maxHp: 100, potions: 2, maxPotions: 8, gold: 100 } }),
    choices: [{ kind: "merchant_relic_purchase", relicId: "idol", price: 20, status: "available" }]
  });
  assert.deepEqual(relic.request, { action: "relic_purchase", relicId: "idol" });

  const service = merchantDecision({
    state: policyState({ player: { hp: 70, maxHp: 100, potions: 2, maxPotions: 8, gold: 100 } }),
    choices: [{ kind: "merchant_service", serviceId: "fullheal", price: 20, status: "available" }]
  });
  assert.deepEqual(service.request, { action: "service", serviceId: "fullheal" });

  const blackMarket = merchantDecision({
    state: policyState({ player: { hp: 100, maxHp: 100, potions: 2, maxPotions: 8, gold: 100 } }),
    choices: [{ kind: "merchant_black_market", targetRelicId: "idol", price: 20, status: "available" }]
  });
  assert.deepEqual(blackMarket.request, { action: "black_market", relicId: "idol" });
}

{
  const noPotionSynthesis = merchantDecision({
    state: policyState({ player: { hp: 80, maxHp: 100, potions: 0, maxPotions: 8, gold: 300 } }),
    choices: [{ kind: "merchant_skill_upgrade", skillId: "shield", price: 20, status: "available" }]
  });
  assert.equal(noPotionSynthesis.reason, "no_canonical_choice");
}
