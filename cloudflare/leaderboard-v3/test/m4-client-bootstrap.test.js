import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const protocol = require("../../../online-v3/ranked-v3-protocol.js");
const clientApi = require("../../../online-v3/ranked-v3-client.js");
const sessionApi = require("../../../online-v3/ranked-v3-session.js");
const directives = require("../../../online-v3/ranked-v3-directives.js");

function memoryStore(initial = null) {
  let value = initial;
  return {
    loadSession: () => value,
    saveSession: (next) => { value = structuredClone(next); },
    clearSession: () => { value = null; }
  };
}

function meta(status, revision, directive = null) {
  return {
    runId: "run_a1",
    protocolVersion: protocol.PROTOCOL_VERSION,
    rulesetId: protocol.RULESET_ID,
    rulesetHash: protocol.RULESET_HASH,
    revision,
    status,
    currentRoomDirective: directive,
    build: { relics: [] },
    gold: 0,
    lives: 3
  };
}

test("M4 Ranked start persists exact pending action before sending", async () => {
  const store = memoryStore();
  let observed;
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "op_start",
      async request(endpoint, request) {
        observed = store.loadSession();
        assert.equal(endpoint.path, "/api/v3/runs/start");
        return {
          payload: {
            ok: true,
            protocolVersion: protocol.PROTOCOL_VERSION,
            runId: "run_a1",
            revision: 0,
            bootstrapToken: "bootstrap-secret",
            recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
            metaState: meta("awaiting_starting_relic", 0)
          }
        };
      }
    }
  });
  await client.start({ playerName: "M4", clientInstallIdHash: "install-hash-1234" });
  assert.equal(observed.pendingOperation.operationId, "op_start");
  assert.equal(client.getSnapshot().token.kind, "run_bootstrap");
  assert.equal(client.getSnapshot().pendingOperation, null);
});

test("M4 starting relic selection accepts only bootstrap token and first directive", async () => {
  const directive = {
    directiveId: "directive_a",
    runId: "run_a1",
    revision: 1,
    roomIndex: 1,
    depth: 1,
    roomType: "combat",
    roomCategory: "normal",
    directiveSeed: "seed",
    roomNonce: "nonce",
    rewardEnvelopeRef: "reward",
    specialRoomPayload: null
  };
  const store = memoryStore({
    runId: "run_a1",
    token: { kind: "run_bootstrap", value: "bootstrap-secret" },
    publicState: meta("awaiting_starting_relic", 0)
  });
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "op_relic",
      async request(_endpoint, request) {
        assert.equal(request.body.bootstrapToken, "bootstrap-secret");
        return {
          payload: {
            ok: true,
            protocolVersion: protocol.PROTOCOL_VERSION,
            runId: "run_a1",
            revision: 1,
            checkpointToken: "room-secret",
            metaState: meta("active", 1, directive)
          }
        };
      }
    }
  });
  await client.selectStartingRelic("offer", "opaque-choice");
  assert.equal(client.getSnapshot().token.kind, "room_checkpoint");
  assert.deepEqual(
    directives.applyOnlineV3RoomDirective(client.getSnapshot().publicState.currentRoomDirective),
    directive
  );
});

test("M4 directive adapter supports the complete active v08-meta-1 set and rejects unknown types", () => {
  for (const [index, roomType] of directives.SUPPORTED_TYPES.entries()) {
    const roomCategory = roomType === "boss" ? "boss" : roomType === "final" ? "final" : "normal";
    const result = directives.applyOnlineV3RoomDirective({
      directiveId: `d${index}`,
      runId: "run_a1",
      revision: 1,
      roomIndex: index + 1,
      depth: Math.min(100, index + 1),
      roomType,
      roomCategory,
      directiveSeed: "seed",
      roomNonce: `n${index}`,
      rewardEnvelopeRef: "reward"
    });
    assert.equal(result.roomType, roomType);
  }
  assert.throws(
    () => directives.applyOnlineV3RoomDirective({
      directiveId: "d",
      runId: "run_a1",
      revision: 1,
      roomIndex: 1,
      depth: 1,
      roomType: "invented",
      roomCategory: "special",
      directiveSeed: "seed",
      roomNonce: "n",
      rewardEnvelopeRef: "reward"
    }),
    /ROOM_TYPE_UNSUPPORTED/u
  );
});

test("M4 session state machine fails closed on illegal transitions", () => {
  const machine = sessionApi.createStateMachine();
  machine.transition(sessionApi.STATES.starting);
  machine.transition(sessionApi.STATES.startingRelic);
  machine.transition(sessionApi.STATES.entering);
  machine.transition(sessionApi.STATES.active);
  assert.throws(() => machine.transition(sessionApi.STATES.finalized), /TRANSITION_INVALID/u);
});

test("M4 session state permits only explicit room-boundary UI and portal transitions", () => {
  const offerMachine = sessionApi.createStateMachine(sessionApi.STATES.active);
  offerMachine.transition(sessionApi.STATES.offer);
  offerMachine.transition(sessionApi.STATES.resolving);
  offerMachine.transition(sessionApi.STATES.next);
  offerMachine.transition(sessionApi.STATES.active);
  assert.equal(offerMachine.getState(), sessionApi.STATES.active);
});

test("M4 game integration remains a narrow directive/checkpoint bridge", () => {
  const game = fs.readFileSync(new URL("../../../game.js", import.meta.url), "utf8");
  assert.match(game, /state\.onlineV3Ranked && state\.onlineV3Directive/u);
  assert.match(game, /DungeonOnlineV3\?\.onLocalRoomCleared/u);
  assert.match(game, /window\.DungeonOnlineV3GameBridge = Object\.freeze/u);
  assert.doesNotMatch(game, /fetch\s*\([^)]*\/api\/v3/u);
  assert.match(game, /if \(state\.onlineV3Ranked\) return;\s+if \(state\.phase/u);
});
