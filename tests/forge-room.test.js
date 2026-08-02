const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  getForgeProfileForDepth,
  getForgeEncounterProfileForDepth,
  getForgeSetpieceLayout,
  getForgeActionsForState,
  planForgeTemper,
  planForgeTransmute
} = require("../forge-room.js");

function run() {
  {
    const profile = getForgeProfileForDepth(10);
    assert.deepEqual(profile.allowedRarities, ["rare", "epic"]);
    assert.equal(profile.choiceCount, 1);
  }

  {
    const encounter = getForgeEncounterProfileForDepth(12);
    assert.equal(encounter.enemyType, "blacksmith_guardian");
    assert.equal(encounter.spikeMin, 4);
    assert.equal(encounter.spikeMax, 6);
    assert.equal(encounter.mineMin, 2);
    assert.equal(encounter.mineMax, 3);
    assert.equal(encounter.flameVentMin, 2);
    assert.equal(encounter.flameVentMax, 3);
  }

  {
    const layout = getForgeSetpieceLayout();
    assert.equal(layout.originX, 3);
    assert.equal(layout.originY, 0);
    assert.equal(layout.width, 3);
    assert.equal(layout.height, 3);
    assert.equal(layout.interactX, 4);
    assert.equal(layout.interactY, 3);
    assert.equal(layout.guardianSpawnX, 4);
    assert.equal(layout.guardianSpawnY, 3);
    assert.equal(layout.playerSpawnX, 4);
    assert.equal(layout.playerSpawnY, 7);
    assert.equal(layout.blockedTiles.length, 6);
    assert.ok(layout.blockedTiles.some((tile) => tile.x === 5 && tile.y === 2));
    assert.ok(layout.blockedTiles.some((tile) => tile.x === 3 && tile.y === 1));
    assert.ok(!layout.blockedTiles.some((tile) => tile.x === 4 && tile.y === 3));
  }

  {
    assert.equal(getForgeActionsForState({ loadout: [] }).canTransmute, false);
    assert.equal(getForgeActionsForState({ loadout: [{ id: "idol", rarity: "rare" }] }).canTransmute, true);
    assert.equal(getForgeActionsForState({ loadout: [] }).canTemper, true);
  }

  {
    const result = planForgeTemper({
      pool: [
        { id: "idol", rarity: "rare", name: "Golden Idol" },
        { id: "borrowedtime", rarity: "epic", name: "Borrowed Time" },
        { id: "titanheart", rarity: "legendary", name: "Titan's Heart" }
      ],
      loadout: [{ id: "deadeyeprism", rarity: "epic", name: "Deadeye Prism" }],
      depth: 25,
      random: () => 0
    });
    assert.ok(result.relic);
    assert.equal(result.profile.choiceCount, 1);
    assert.ok(["rare", "epic", "legendary"].includes(result.relic.rarity));
  }

  {
    const result = planForgeTemper({
      pool: [
        { id: "borrowedtime", rarity: "epic", name: "Borrowed Time" },
        { id: "titanheart", rarity: "legendary", name: "Titan's Heart" },
        { id: "oathofruin", rarity: "mythic", name: "Oath of Ruin" },
        { id: "deadeyeprism", rarity: "epic", name: "Deadeye Prism" }
      ],
      loadout: [],
      depth: 60,
      random: () => 0.99
    });
    assert.ok(result.relic);
    assert.ok(["epic", "legendary", "mythic"].includes(result.relic.rarity));
  }

  {
    const result = planForgeTransmute({
      depth: 45,
      sacrificedRelic: { id: "idol", rarity: "rare", name: "Golden Idol" },
      loadout: [{ id: "deadeyeprism", rarity: "epic", name: "Deadeye Prism" }],
      pool: [
        { id: "idol", rarity: "rare", name: "Golden Idol" },
        { id: "vampfang", rarity: "epic", name: "Vampiric Fang" },
        { id: "titanheart", rarity: "legendary", name: "Titan's Heart" },
        { id: "borrowedtime", rarity: "epic", name: "Borrowed Time" }
      ],
      random: () => 0,
      canTakeRelic: (relic) => relic.id !== "titanheart"
    });
    const ids = result.choices.map((entry) => entry.id);
    assert.ok(!ids.includes("idol"));
    assert.ok(!ids.includes("titanheart"));
    assert.equal(new Set(ids).size, ids.length);
  }

  {
    const result = planForgeTransmute({
      depth: 5,
      sacrificedRelic: { id: "lucky", rarity: "normal", name: "Lucky Coin" },
      loadout: [],
      pool: [
        { id: "idol", rarity: "rare", name: "Golden Idol" },
        { id: "plating", rarity: "normal", name: "Bone Plating" },
        { id: "fang", rarity: "normal", name: "Fang Charm" }
      ],
      random: () => 0
    });
    assert.ok(result.choices.every((choice) => choice.rarity !== "normal"));
  }

  {
    const root = path.resolve(__dirname, "..");
    const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
    const css = fs.readFileSync(path.join(root, "style-hd-composition.css"), "utf8");
    assert.match(game, /function placeForgeFlameVents\(occupied, requestedCount\)/);
    assert.match(game, /placedFlameVentCount = placeForgeFlameVents\(occupied, flameVentCount\)/);
    assert.match(game, /overlay-card-forge-mode/);
    assert.match(game, /forge-choice-grid/);
    assert.match(game, /forge-relic-grid/);
    assert.match(game, /aria-disabled="\$\{transmuteAvailable \? "false" : "true"\}"/);
    assert.match(game, /data-forge-key="Escape"/);
    assert.match(game, /activateForgeControl/);
    assert.match(css, /\.overlay-card-forge\s*\{[\s\S]*width:\s*min\(1040px, calc\(100vw - 28px\)\)[\s\S]*height:\s*min\(600px, calc\(100vh - 28px\)\)/);
    assert.match(css, /\.overlay-card-forge\s*\{[\s\S]*padding:\s*clamp\(68px, 8\.4vh, 76px\) clamp\(108px, 10\.5vw, 122px\) clamp\(66px, 8vh, 74px\)/);
    assert.match(css, /\.forge-choice-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,/);
    assert.match(css, /\.forge-choice\.disabled/);
  }

  {
    const root = path.resolve(__dirname, "..");
    const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
    const roomClearStart = game.indexOf("function checkRoomClearBonus()");
    const rankedCheckpoint = game.indexOf("window.DungeonOnlineV3?.onLocalRoomCleared?.(", roomClearStart);
    const forgeAwakening = game.indexOf("state.forge.awakened = true;", roomClearStart);
    assert.ok(roomClearStart >= 0, "room-clear handler is present");
    assert.ok(rankedCheckpoint > roomClearStart, "Ranked checkpoint request is present");
    assert.ok(
      forgeAwakening > roomClearStart && forgeAwakening < rankedCheckpoint,
      "a cleared Ranked Forge awakens before its checkpoint is requested"
    );
  }

  console.log("forge-room tests: OK");
}

run();
