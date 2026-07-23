const assert = require("node:assert/strict");

const {
  chooseMerchantRelicOffer
} = require("../merchant-curation.js");

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
