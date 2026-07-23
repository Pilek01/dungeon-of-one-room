const assert = require("node:assert/strict");

const {
  analyzeRelicLoadout,
  scoreRelicForBuild,
  rankDraftChoices
} = require("../build-identity.js");

function run() {
  {
    const profile = analyzeRelicLoadout([
      { id: "lucky", rarity: "normal" },
      { id: "deadeyeprism", rarity: "epic" },
      { id: "voidreaper", rarity: "legendary" }
    ]);

    assert.equal(profile.primary.id, "crit");
    assert.ok(profile.scores.crit > profile.scores.economy);
  }

  {
    const profile = analyzeRelicLoadout([
      { id: "lucky", rarity: "normal" },
      { id: "deadeyeprism", rarity: "epic" }
    ]);

    const critSynergy = scoreRelicForBuild({ id: "echostrike", rarity: "epic" }, profile);
    const economyPick = scoreRelicForBuild({ id: "idol", rarity: "rare" }, profile);

    assert.ok(critSynergy > economyPick);
  }

  {
    const loadout = [
      { id: "lucky", rarity: "normal" },
      { id: "deadeyeprism", rarity: "epic" }
    ];
    const choices = [
      { id: "idol", rarity: "rare" },
      { id: "echostrike", rarity: "epic" },
      { id: "bloodvial", rarity: "epic" }
    ];

    const ranked = rankDraftChoices(choices, loadout);

    assert.equal(ranked[0].id, "echostrike");
  }

  console.log("build-identity tests: OK");
}

run();
