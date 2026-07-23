const assert = require("node:assert/strict");

const {
  PACTS,
  canOfferPactRoom,
  getPactRoomWeight,
  getPactEncounterProfile,
  choosePactOffers,
  isPactValid
} = require("../pact-room.js");

function run() {
  {
    const summary = PACTS.map((pact) => ({
      id: pact.id,
      minDepth: pact.minDepth,
      upside: pact.upside,
      downside: pact.downside
    }));
    assert.deepEqual(summary, [
      {
        id: "hunger",
        minDepth: 25,
        upside: "+25% damage dealt",
        downside: "Potions heal 50% less"
      },
      {
        id: "precision",
        minDepth: 25,
        upside: "+12% crit chance",
        downside: "-25% max HP"
      },
      {
        id: "velocity",
        minDepth: 25,
        upside: "Combat skill cooldowns recover 20% faster",
        downside: "Take +12% damage"
      },
      {
        id: "avarice",
        minDepth: 30,
        upside: "+40% gold gain",
        downside: "Enemies and chests no longer drop potions. Merchant potion price +100%"
      },
      {
        id: "iron",
        minDepth: 25,
        upside: "Gain Barrier equal to 35% of max HP at the start of every combat",
        downside: "Potions heal 35% less"
      },
      {
        id: "blood",
        minDepth: 30,
        upside: "Using a skill grants Barrier equal to 8% max HP",
        downside: "Base attack -20%"
      },
      {
        id: "ruin",
        minDepth: 35,
        upside: "Skills deal +25% damage",
        downside: "Skills have +5 turns cooldown"
      },
      {
        id: "silence",
        minDepth: 35,
        upside: "Basic attacks deal +25% damage",
        downside: "Skills deal 25% less damage and have +2 turns cooldown"
      },
      {
        id: "cinders",
        minDepth: 40,
        upside: "Basic attacks ignite enemies for 12 damage per turn for 2 turns",
        downside: "Take +25% environmental damage"
      },
      {
        id: "hunt",
        minDepth: 45,
        upside: "+30% damage to elites and bosses",
        downside: "Non-elite enemies deal +15% damage"
      },
      {
        id: "chains",
        minDepth: 40,
        upside: "+20 ARM and immunity to forced movement",
        downside: "Dash has +4 turns cooldown"
      }
    ]);
  }

  {
    assert.equal(canOfferPactRoom(10), false);
    assert.equal(canOfferPactRoom(24), false);
    assert.equal(canOfferPactRoom(25), true);
    assert.equal(getPactRoomWeight(25), 0.025);
    assert.equal(getPactRoomWeight(40), 0.04);
    assert.equal(getPactRoomWeight(60), 0.05);
    assert.equal(getPactRoomWeight(80), 0.06);
  }

  {
    const profile = getPactEncounterProfile(50);
    assert.equal(profile.minEnemies, 4);
    assert.equal(profile.maxEnemies, 7);
    assert.equal(profile.eliteOnly, true);
    assert.equal(profile.minMines, 4);
    assert.equal(profile.maxMines, 5);
    assert.equal(profile.minSpikes, 5);
    assert.equal(profile.maxSpikes, 6);
  }

  {
    const result = choosePactOffers({
      depth: 35,
      random: () => 0
    });
    assert.equal(result.choices.length, 2);
    assert.equal(new Set(result.choices.map((pact) => pact.id)).size, 2);
  }

  {
    const result = choosePactOffers({
      depth: 35,
      activePactIds: ["precision", "velocity"],
      random: () => 0
    });
    const ids = result.choices.map((pact) => pact.id);
    assert.ok(!ids.includes("precision"));
    assert.ok(!ids.includes("velocity"));
  }

  {
    const result = choosePactOffers({
      depth: 28,
      random: () => 0
    });
    const ids = result.choices.map((pact) => pact.id);
    assert.ok(!ids.includes("avarice"));
    assert.ok(!ids.includes("blood"));
    assert.ok(!ids.includes("ruin"));
  }

  {
    const hunger = choosePactOffers({ depth: 25, random: () => 0 }).choices[0];
    assert.equal(isPactValid(hunger, { depth: 25 }), true);
    assert.equal(isPactValid(hunger, { depth: 25, activePactIds: [hunger.id] }), false);
  }

  console.log("pact-room tests: OK");
}

run();
