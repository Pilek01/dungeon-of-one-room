import test from "node:test";
import assert from "node:assert/strict";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { issueNextRoomDirectiveV08 } from "../src/rulesets/v08-meta-1/room-policy.js";

function oracleReturningMaximum() {
  return {
    async deriveRandomBytes({ length }) {
      return new Uint8Array(length);
    },
    async deriveIntInclusive(_min, max) {
      return max;
    }
  };
}

function oracleForcingLegacyVault() {
  return {
    async deriveRandomBytes({ length }) {
      return new Uint8Array(length);
    },
    async deriveIntInclusive(min, max, options) {
      if (options.purpose === "room-type/vault") return min;
      return max;
    }
  };
}

function oracleControllingOtter(forceOtter) {
  return {
    async deriveRandomBytes({ length }) {
      return new Uint8Array(length);
    },
    async deriveIntInclusive(min, max, options) {
      if (options.purpose === "room-type/otter-queue") return forceOtter ? min : max;
      return max;
    }
  };
}

function context(runId) {
  return {
    runId,
    season: "special-room-rotation",
    startedAt: 1_700_000_000_000,
    randomOracle: oracleReturningMaximum(),
    capabilities: { specialRoomRotation: "v1" }
  };
}

function activeState(runId, depth, roomIndex) {
  const runtimeContext = context(runId);
  const state = createInitialMetaStateV08({}, runtimeContext);
  state.status = "active";
  state.depth = depth;
  state.roomIndex = roomIndex;
  return { state, runtimeContext };
}

test("historical rotation retains merchants on indexes 8..98 and excludes random merchants", async () => {
  for (const roomIndex of [8, 18, 28, 98]) {
    const { state, runtimeContext } = activeState(`merchant_${roomIndex}`, roomIndex - 1, roomIndex - 1);
    const issued = await issueNextRoomDirectiveV08(state, runtimeContext);
    assert.equal(issued.currentRoomDirective.depth, roomIndex);
    assert.equal(issued.currentRoomDirective.roomType, "merchant");
    assert.equal(issued.currentRoomDirective.specialRoomPayload.policySource, "merchant-schedule");
  }

  const { state, runtimeContext } = activeState("merchant_not_random", 8, 8);
  const issued = await issueNextRoomDirectiveV08(state, runtimeContext);
  assert.notEqual(issued.currentRoomDirective.roomType, "merchant");
});

test("a completed map waits through a scheduled Merchant and then forces exactly one Vault", async () => {
  const { state, runtimeContext } = activeState("map_waits_for_merchant", 7, 7);
  state.campaign.forcedNextRoomType = "vault";

  const merchant = await issueNextRoomDirectiveV08(state, runtimeContext);
  assert.equal(merchant.currentRoomDirective.roomType, "merchant");
  assert.equal(merchant.campaign.forcedNextRoomType, "vault");

  merchant.currentRoomDirective = null;
  merchant.currentRewardEnvelope = null;
  merchant.depth = 8;
  merchant.roomIndex = 8;
  const vault = await issueNextRoomDirectiveV08(merchant, runtimeContext);
  assert.equal(vault.currentRoomDirective.roomType, "vault");
  assert.equal(vault.currentRoomDirective.specialRoomPayload.policySource, "treasure-map-forced-vault");
  assert.equal(vault.campaign.forcedNextRoomType, "");
});

test("Vault cannot be selected without a completed treasure map", async () => {
  const { state, runtimeContext } = activeState("vault_not_random", 11, 11);
  runtimeContext.randomOracle = oracleForcingLegacyVault();
  const issued = await issueNextRoomDirectiveV08(state, runtimeContext);
  assert.notEqual(issued.currentRoomDirective.roomType, "vault");
  assert.notEqual(issued.currentRoomDirective.specialRoomPayload?.policySource, "vault-roll");
});

test("natural special-room cooldowns and global spacing filter weighted candidates", async () => {
  const { state, runtimeContext } = activeState("special_cooldowns", 46, 46);
  state.specialRoomScheduleState.lastIssuedDepthByType = {
    forge: 29,
    pact: 39,
    crossroads: 33,
    arena: 39,
    otter: 29
  };
  state.specialRoomScheduleState.lastNaturalSpecialDepth = 45;

  const blocked = await issueNextRoomDirectiveV08(state, runtimeContext);
  assert.equal(blocked.currentRoomDirective.roomCategory, "normal");

  state.specialRoomScheduleState.lastNaturalSpecialDepth = 43;
  state.specialRoomScheduleState.lastIssuedDepthByType.forge = 27;
  state.specialRoomScheduleState.lastIssuedDepthByType.arena = 37;
  const eligible = await issueNextRoomDirectiveV08(state, runtimeContext);
  assert.equal(eligible.currentRoomDirective.roomType, "arena");
  assert.equal(eligible.specialRoomScheduleState.lastNaturalSpecialDepth, 47);
  assert.equal(eligible.specialRoomScheduleState.lastIssuedDepthByType.arena, 47);
});

test("Otter on depth 22 remains a chance roll rather than a fixed room", async () => {
  const skippedSetup = activeState("d22_otter_skipped", 21, 21);
  skippedSetup.state.statistics.roomsCompleted = 21;
  skippedSetup.runtimeContext.randomOracle = oracleControllingOtter(false);
  const skipped = await issueNextRoomDirectiveV08(skippedSetup.state, skippedSetup.runtimeContext);
  assert.notEqual(skipped.currentRoomDirective.roomType, "otter");

  const rolledSetup = activeState("d22_otter_rolled", 21, 21);
  rolledSetup.state.statistics.roomsCompleted = 21;
  rolledSetup.runtimeContext.randomOracle = oracleControllingOtter(true);
  const rolled = await issueNextRoomDirectiveV08(rolledSetup.state, rolledSetup.runtimeContext);
  assert.equal(rolled.currentRoomDirective.roomType, "otter");
  assert.equal(rolled.currentRoomDirective.specialRoomPayload.policySource, "queued-otter");
});

test("special-room cooldown state survives a new descent in the same campaign", () => {
  const runtimeContext = context("rotation_campaign_carry");
  const carried = createInitialMetaStateV08({
    campaign: {
      specialRoomRotationState: {
        lastNaturalSpecialDepth: 37,
        lastIssuedDepthByType: { forge: 31, arena: 37 }
      }
    }
  }, runtimeContext);
  assert.equal(carried.specialRoomScheduleState.lastNaturalSpecialDepth, 37);
  assert.deepEqual(carried.specialRoomScheduleState.lastIssuedDepthByType, {
    forge: 31,
    arena: 37
  });
});

test("depth-based merchants use depth 9..99 regardless of room index", async () => {
  for (const roomIndex of [0, 7, 17, 50]) {
    for (const depth of [7,8,9,17,18,19,29,39,49,59,69,79,89,99,100]) {
      const { state, runtimeContext } = activeState('depth_' + depth + '_' + roomIndex, depth - 1, roomIndex);
      runtimeContext.capabilities.merchantDepthSchedule = 'v1';
      const issued = await issueNextRoomDirectiveV08(state, runtimeContext);
      assert.equal(issued.currentRoomDirective.depth, depth);
      assert.equal(issued.currentRoomDirective.roomType === 'merchant', depth % 10 === 9, 'depth ' + depth + ', index ' + roomIndex);
    }
  }
});

test("local and production descriptors share the corrected schedule; retained runs keep theirs", async () => {
  const releases = await import('../src/rulesets/releases.js');
  for (const [descriptor, merchantDepth] of [
    [releases.V08_META_1_LOCAL_RELEASE_DESCRIPTOR, 9],
    [releases.V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR, 9],
    [releases.V08_META_1_MERCHANT_DEPTH_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR, 8]
  ]) {
    for (const depth of [8, 9]) {
      const { state, runtimeContext } = activeState('bound_' + depth, depth - 1, depth - 1);
      state.rulesetHash = descriptor.rulesetHash;
      delete runtimeContext.capabilities;
      const issued = await descriptor.createRuleset().issueRoomDirective(state, runtimeContext);
      assert.equal(issued.currentRoomDirective.depth, depth);
      assert.equal(issued.currentRoomDirective.roomType === 'merchant', depth === merchantDepth);
    }
  }
});
