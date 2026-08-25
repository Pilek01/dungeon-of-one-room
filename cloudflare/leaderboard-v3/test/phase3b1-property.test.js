import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createV08Meta1Ruleset } from "../src/rulesets/v08-meta-1/index.js";
import { deriveRandomBytes } from "../src/rulesets/v08-meta-1/rng.js";

function seededOracle(seed) {
  function digest(options, suffix = "") {
    return createHash("sha256")
      .update(`${seed}|${options.runId}|${options.revision}|${options.purpose}|${options.counter}|${suffix}`)
      .digest();
  }
  return {
    async deriveRandomBytes(options) {
      const output = new Uint8Array(options.length);
      let offset = 0;
      let block = 0;
      while (offset < output.length) {
        const bytes = digest(options, block);
        const take = Math.min(bytes.length, output.length - offset);
        output.set(bytes.subarray(0, take), offset);
        offset += take;
        block += 1;
      }
      return output;
    },
    async deriveIntInclusive(min, max, options) {
      const bytes = digest(options);
      const value = bytes.readBigUInt64BE(0);
      const span = BigInt(max) - BigInt(min) + 1n;
      return Number(BigInt(min) + (value % span));
    }
  };
}

function operationFor(state) {
  const directive = state.currentRoomDirective;
  return {
    directiveId: directive.directiveId,
    runId: state.runId,
    rulesetHash: state.rulesetHash,
    revision: state.revision,
    roomIndex: directive.roomIndex,
    depth: directive.depth,
    roomType: directive.roomType,
    roomNonce: directive.roomNonce,
    completionAttestation: "local-room-completed"
  };
}

async function runToVictory(seed) {
  const randomOracle = seededOracle(seed);
  const ruleset = createV08Meta1Ruleset({ randomOracle });
  const context = {
    runId: `property_run_${seed}`,
    season: "property-season",
    startedAt: 1_700_000_000_000 + seed,
    randomOracle
  };
  let state = await ruleset.createRun({ startDepth: 0 }, context);
  state = await ruleset.selectStartingRelic(state, {
    offerId: state.pendingOffer.offerId,
    choiceId: state.pendingOffer.choices[0].choiceId
  }, context);
  const directiveIds = new Set();
  let previousDepth = 0;
  let previousRoomIndex = 0;
  const initialBuild = structuredClone(state.build);

  while (state.status === "active") {
    const directive = state.currentRoomDirective;
    assert.ok(directive.depth >= previousDepth);
    assert.ok(directive.depth - previousDepth <= 1);
    assert.ok(directive.roomIndex > previousRoomIndex);
    assert.ok(!directiveIds.has(directive.directiveId));
    directiveIds.add(directive.directiveId);
    if (directive.depth === 100) {
      assert.equal(directive.roomType, "final");
      assert.equal(directive.roomCategory, "final");
    } else if (directive.depth % 5 === 0) {
      assert.equal(directive.roomType, "boss");
      assert.equal(directive.roomCategory, "boss");
    }
    previousRoomIndex = directive.roomIndex;
    const next = await ruleset.consumeRoomDirective(
      state,
      operationFor(state),
      { ...context, elapsedMs: state.elapsedMs + 1_000 }
    );
    assert.ok(next.depth >= previousDepth);
    assert.ok(next.depth - previousDepth <= 1);
    assert.ok(next.gold >= state.gold);
    assert.equal(
      next.gold,
      next.goldLedger.earnedServerDerived +
        next.goldLedger.earnedBoundedAttested -
        next.goldLedger.spentServerDerived
    );
    assert.equal(next.lives, 5);
    const expectedBuild = structuredClone(initialBuild);
    expectedBuild.resources.highestUnlockedDepth =
      Math.max(initialBuild.resources.highestUnlockedDepth, next.depth);
    assert.deepEqual(next.build, expectedBuild);
    previousDepth = next.depth;
    state = next;
  }
  return { state, directiveIds };
}

test("property: depth, roomIndex, directive uniqueness, priority, limits and scope hold", async () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const { state, directiveIds } = await runToVictory(seed);
    assert.equal(state.depth, 100);
    assert.equal(state.status, "victory");
    assert.equal(state.currentRoomDirective, null);
    assert.equal(state.statistics.roomsCompleted, 100);
    assert.equal(directiveIds.size, 100);
    assert.ok(state.specialRoomScheduleState.otterRoomsSeenThisRun <= 3);
    assert.ok(state.consumedDirectiveIds.length <= state.consumedDirectiveHistoryLimit);
    assert.ok(state.consumedDirectiveNonces.length <= state.consumedDirectiveHistoryLimit);
  }
});

test("property: retry and serialized state round-trip preserve schedule state", async () => {
  const randomOracle = seededOracle(77);
  const ruleset = createV08Meta1Ruleset({ randomOracle });
  const context = {
    runId: "property_retry",
    season: "property-season",
    startedAt: 1_700_000_100_000,
    randomOracle
  };
  let state = await ruleset.createRun({ startDepth: 0 }, context);
  state = await ruleset.selectStartingRelic(state, {
    offerId: state.pendingOffer.offerId,
    choiceId: state.pendingOffer.choices[0].choiceId
  }, context);
  for (let index = 0; index < 12; index += 1) {
    state = await ruleset.consumeRoomDirective(state, operationFor(state), context);
  }
  const serialized = JSON.stringify(state);
  const restored = JSON.parse(serialized);
  assert.deepEqual(restored.specialRoomScheduleState, state.specialRoomScheduleState);
  const originalNext = await ruleset.issueRoomDirective(state, context);
  const restoredNext = await ruleset.issueRoomDirective(restored, context);
  assert.deepEqual(restoredNext, originalNext);
});

test("property: different RNG counter yields a different stream", async () => {
  const options = {
    secret: "counter-property:0123456789abcdef0123456789abcdef",
    rulesetId: "v08-meta-1",
    runId: "property_counter",
    revision: 12,
    purpose: "property-counter",
    length: 64
  };
  const first = await deriveRandomBytes({ ...options, counter: 0 });
  const second = await deriveRandomBytes({ ...options, counter: 1 });
  assert.notDeepEqual(first, second);
});

test("property: consumed directives never return after bounded-history rollover", async () => {
  const { state } = await runToVictory(101);
  assert.equal(new Set(state.consumedDirectiveIds).size, state.consumedDirectiveIds.length);
  assert.equal(new Set(state.consumedDirectiveNonces).size, state.consumedDirectiveNonces.length);
  assert.equal(state.consumedDirectiveIds.length, 64);
  assert.equal(state.consumedDirectiveNonces.length, 64);
});
