const assert = require("node:assert/strict");

const {
  FORGE_PITY_DEPTH,
  OTTER_PITY_DEPTH,
  SPECIAL_ROOM_GLOBAL_GAP_DEPTHS,
  SPECIAL_ROOM_COOLDOWN_DEPTHS,
  getGuaranteedCampaignRoom,
  isScheduledMerchantRoom,
  isNaturalSpecialRoomEligible,
  recordIssuedSpecialRoom
} = require("../room-pity.js");

function run() {
  assert.equal(FORGE_PITY_DEPTH, 21);
  assert.equal(OTTER_PITY_DEPTH, 41);
  assert.equal(SPECIAL_ROOM_GLOBAL_GAP_DEPTHS, 2);
  assert.deepEqual(SPECIAL_ROOM_COOLDOWN_DEPTHS, {
    forge: 20,
    pact: 10,
    crossroads: 15,
    arena: 10,
    otter: 20
  });

  assert.equal(isScheduledMerchantRoom(8), true);
  assert.equal(isScheduledMerchantRoom(18), true);
  assert.equal(isScheduledMerchantRoom(98), true);
  assert.equal(isScheduledMerchantRoom(7), false);
  assert.equal(isScheduledMerchantRoom(99), false);

  const forgeCooldown = {
    lastNaturalSpecialDepth: 20,
    lastIssuedDepthByType: { forge: 11 }
  };
  assert.equal(isNaturalSpecialRoomEligible("forge", 30, forgeCooldown), false);
  assert.equal(isNaturalSpecialRoomEligible("forge", 31, forgeCooldown), true);
  assert.equal(isNaturalSpecialRoomEligible("pact", 22, forgeCooldown), false);
  assert.equal(isNaturalSpecialRoomEligible("pact", 23, forgeCooldown), true);
  assert.equal(isNaturalSpecialRoomEligible("combat", 21, forgeCooldown), true);
  assert.equal(isNaturalSpecialRoomEligible("forge", 1, {}), true);

  assert.deepEqual(recordIssuedSpecialRoom({}, "combat", 1, "weighted-room"), {
    lastNaturalSpecialDepth: null,
    lastIssuedDepthByType: {}
  });

  const afterForge = recordIssuedSpecialRoom({}, "forge", 11, "weighted-room");
  assert.equal(afterForge.lastNaturalSpecialDepth, 11);
  assert.deepEqual(afterForge.lastIssuedDepthByType, { forge: 11 });
  const afterMerchant = recordIssuedSpecialRoom(afterForge, "merchant", 19, "merchant-schedule");
  assert.deepEqual(afterMerchant, afterForge);
  const afterVault = recordIssuedSpecialRoom(afterMerchant, "vault", 20, "treasure-map-forced-vault");
  assert.deepEqual(afterVault, afterForge);
  const afterDebugForge = recordIssuedSpecialRoom(afterVault, "forge", 30, "debug-forced");
  assert.deepEqual(afterDebugForge, afterForge);
  const afterOtterPity = recordIssuedSpecialRoom(afterDebugForge, "otter", 41, "otter-pity");
  assert.equal(afterOtterPity.lastNaturalSpecialDepth, 41);
  assert.equal(afterOtterPity.lastIssuedDepthByType.otter, 41);

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
