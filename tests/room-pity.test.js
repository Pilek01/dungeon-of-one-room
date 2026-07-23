const assert = require("node:assert/strict");

const {
  FORGE_PITY_DEPTH,
  OTTER_PITY_DEPTH,
  getGuaranteedCampaignRoom
} = require("../room-pity.js");

function run() {
  assert.equal(FORGE_PITY_DEPTH, 21);
  assert.equal(OTTER_PITY_DEPTH, 41);

  assert.equal(
    getGuaranteedCampaignRoom({
      depth: 21,
      forgeSeenThisGame: false,
      forgePityUsedThisGame: false
    }),
    "forge"
  );

  assert.equal(
    getGuaranteedCampaignRoom({
      depth: 21,
      forgeSeenThisGame: true,
      forgePityUsedThisGame: false
    }),
    ""
  );

  assert.equal(
    getGuaranteedCampaignRoom({
      depth: 21,
      forgeSeenThisGame: false,
      forgePityUsedThisGame: true
    }),
    ""
  );

  assert.equal(
    getGuaranteedCampaignRoom({
      depth: 41,
      otterSeenThisGame: false,
      otterPityUsedThisGame: false
    }),
    "otter"
  );

  assert.equal(
    getGuaranteedCampaignRoom({
      depth: 41,
      otterSeenThisGame: true,
      otterPityUsedThisGame: false
    }),
    ""
  );

  assert.equal(
    getGuaranteedCampaignRoom({
      depth: 41,
      otterSeenThisGame: false,
      otterPityUsedThisGame: true
    }),
    ""
  );

  assert.equal(
    getGuaranteedCampaignRoom({
      depth: 21,
      bossDepth: true,
      forgeSeenThisGame: false,
      forgePityUsedThisGame: false
    }),
    ""
  );

  assert.equal(
    getGuaranteedCampaignRoom({
      depth: 30,
      forgeSeenThisGame: false,
      forgePityUsedThisGame: false,
      otterSeenThisGame: false,
      otterPityUsedThisGame: false
    }),
    ""
  );

  console.log("room-pity tests: OK");
}

run();
