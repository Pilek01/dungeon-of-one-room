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

function rankedIdentityStore(initial = {}) {
  let session = structuredClone(initial.session ?? null);
  let recovery = structuredClone(initial.recovery ?? null);
  let profile = structuredClone(initial.profile ?? null);
  return {
    loadSession: () => structuredClone(session),
    saveSession: (next) => { session = structuredClone(next); },
    clearSession: () => { session = null; },
    loadRecovery: () => structuredClone(recovery),
    saveRecovery: (next) => { recovery = structuredClone(next); },
    clearRecovery: () => { recovery = null; },
    loadProfile: () => structuredClone(profile),
    saveProfile: (next) => { profile = structuredClone(next); },
    clearProfile: () => { profile = null; },
    snapshot: () => structuredClone({ session, recovery, profile })
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

test("M4 Ranked start never serializes Practice progress", async () => {
  const store = memoryStore();
  let observed;
  const snapshotNotifications = [];
  const client = clientApi.createRankedClient({
    store,
    onSnapshot(snapshot) {
      snapshotNotifications.push(snapshot);
    },
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
  await client.start({
    playerName: "M4",
    clientInstallIdHash: "install-hash-1234",
    newCampaign: true,
    practiceMutatorImport: {
      metrics: { totalKills: 200 },
      historicalUnlockedMutatorIds: ["berserker"]
    }
  });
  assert.equal(observed.pendingOperation.operationId, "op_start");
  assert.equal(observed.pendingOperation.body.newCampaign, true);
  assert.equal(Object.hasOwn(observed.pendingOperation.body, "practiceMutatorImport"), false);
  assert.equal(client.getSnapshot().token.kind, "run_bootstrap");
  assert.equal(client.getSnapshot().pendingOperation, null);
  assert.deepEqual(
    snapshotNotifications.map((snapshot) => Boolean(snapshot?.pendingOperation)),
    [true, false]
  );
});

test("M4 exact start retry persists recovery before entering Ranked", async () => {
  let recovery = null;
  const pendingBody = {
    playerName: "M4",
    season: "local-m4",
    gameVersion: "v0.8.0",
    rulesetId: protocol.RULESET_ID,
    rulesetHash: protocol.RULESET_HASH,
    clientInstallIdHash: "install-hash-1234",
    profileId: "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
    recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
    clientProtocolVersion: protocol.PROTOCOL_VERSION
  };
  const sessionStore = memoryStore({
    schemaVersion: 1,
    mode: "ranked",
    runId: "",
    revision: 0,
    pendingOperation: {
      endpoint: "start",
      operationId: "op_start",
      body: pendingBody
    }
  });
  const store = {
    ...sessionStore,
    loadRecovery: () => structuredClone(recovery),
    saveRecovery: (next) => { recovery = structuredClone(next); },
    clearRecovery: () => { recovery = null; }
  };
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "op_unused",
      async request(endpoint, request) {
        assert.equal(endpoint.path, "/api/v3/runs/start");
        assert.equal(request.operationId, "op_start");
        return {
          payload: {
            ok: true,
            protocolVersion: protocol.PROTOCOL_VERSION,
            runId: "run_a1",
            revision: 0,
            bootstrapToken: "bootstrap-secret",
            metaState: meta("awaiting_starting_relic", 0)
          }
        };
      }
    }
  });
  await client.retryPending();
  assert.deepEqual(recovery, {
    runId: "run_a1",
    recoveryCredential: pendingBody.recoveryCredential,
    rulesetId: protocol.RULESET_ID,
    rulesetHash: protocol.RULESET_HASH
  });
  assert.equal(client.getSnapshot().pendingOperation, null);
});
test("M4 stale profile repair clears a failed start and rotates only Ranked identity", async () => {
  const staleProfile = {
    profileId: "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    profileCredential: "sssssssssssssssssssssssssssssssssssssssssss"
  };
  const store = rankedIdentityStore({
    profile: staleProfile,
    session: {
      schemaVersion: 1,
      mode: "ranked",
      runId: "",
      revision: 0,
      pendingOperation: {
        endpoint: "start",
        operationId: "op_stale",
        body: {}
      }
    },
    recovery: {
      runId: "run_stale",
      recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"
    }
  });
  const client = clientApi.createRankedClient({
    store,
    randomUUID: () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    cryptoProvider: {
      randomUUID: () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      getRandomValues(bytes) {
        bytes.fill(7);
        return bytes;
      }
    },
    transport: {
      createOperationId: () => "op_retry",
      async request() {
        return {
          payload: {
            ok: true,
            protocolVersion: protocol.PROTOCOL_VERSION,
            runId: "run_b1",
            revision: 0,
            bootstrapToken: "bootstrap-secret",
            metaState: { ...meta("awaiting_starting_relic", 0), runId: "run_b1" }
          }
        };
      }
    }
  });

  client.discardFailedStart();
  client.resetProfileIdentity();
  assert.deepEqual(store.snapshot(), {
    session: null,
    recovery: {
      runId: "run_stale",
      recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"
    },
    profile: null
  });

  store.clearRecovery();
  await client.start({ playerName: "M4", clientInstallIdHash: "install-hash-1234" });
  const repaired = store.snapshot();
  assert.equal(repaired.profile.profileId, "profile_bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb");
  assert.notEqual(repaired.profile.profileCredential, staleProfile.profileCredential);
  assert.equal(repaired.recovery.runId, "run_b1");
  assert.equal(repaired.session.pendingOperation, null);
});

test("M4 failed-start cleanup tolerates a local failure before a session exists", () => {
  const store = rankedIdentityStore();
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "op_unused",
      request: async () => {
        throw new Error("unused");
      }
    }
  });
  assert.doesNotThrow(() => client.discardFailedStart());
  assert.equal(store.snapshot().session, null);
});
test("M4 failed-start cleanup refuses to erase a canonical Ranked run", () => {
  const store = rankedIdentityStore({
    session: {
      runId: "run_live",
      revision: 1,
      pendingOperation: null
    }
  });
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "op_unused",
      request: async () => {
        throw new Error("unused");
      }
    }
  });
  assert.throws(() => client.discardFailedStart(), /RANKED_FAILED_START_NOT_DISCARDABLE/u);
  assert.throws(() => client.resetProfileIdentity(), /RANKED_PROFILE_RESET_ACTIVE_RUN/u);
  assert.equal(store.snapshot().session.runId, "run_live");
});

test("M4 recovery keeps the saved released ruleset hash", async () => {
  const savedHash = "sha256:956251f158e55a0a47f9e43d5680d9aae66a22045c833bd76b8798cdc00e012e";
  const store = rankedIdentityStore({
    session: {
      schemaVersion: 1,
      mode: "ranked",
      runId: "run_a1",
      revision: 0,
      rulesetId: protocol.RULESET_ID,
      rulesetHash: savedHash,
      publicState: {
        ...meta("active", 0),
        rulesetHash: savedHash,
        assistanceClass: "observer_bot"
      },
      pendingOperation: null
    },
    recovery: {
      runId: "run_a1",
      recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
      rulesetId: protocol.RULESET_ID,
      rulesetHash: savedHash
    }
  });
  let calls = 0;
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "op_resume_saved_hash",
      async request(endpoint) {
        calls += 1;
        assert.equal(endpoint.path, protocol.ENDPOINTS.resume.path);
        return {
          payload: {
            ok: true,
            protocolVersion: protocol.PROTOCOL_VERSION,
            acceptedBoundary: "run_resumed",
            runId: "run_a1",
            revision: 0,
            bootstrapToken: "bootstrap-secret",
            metaState: {
              ...meta("awaiting_starting_relic", 0),
              rulesetHash: savedHash
            }
          }
        };
      }
    }
  });

  await client.resumeCanonical();
  assert.equal(calls, 1);
  assert.equal(client.getSnapshot().rulesetHash, savedHash);
  assert.equal(client.getSnapshot().publicState.rulesetHash, savedHash);
  assert.equal(client.getSnapshot().publicState.assistanceClass, "observer_bot");
});

test("M4 recovery rejects an unknown saved ruleset hash before transport", async () => {
  const store = rankedIdentityStore({
    recovery: {
      runId: "run_a1",
      recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
      rulesetId: protocol.RULESET_ID,
      rulesetHash: "sha256:" + "f".repeat(64)
    }
  });
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "op_resume_unknown_hash",
      async request() {
        throw new Error("transport must not be called");
      }
    }
  });
  await assert.rejects(client.resumeCanonical(), /RANKED_RULESET_MISMATCH/u);
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

test("M4 directive adapter preserves and validates special-room scaling depth", () => {
  const result = directives.applyOnlineV3RoomDirective({
    directiveId: "vault_12",
    runId: "run_a1",
    revision: 12,
    roomIndex: 12,
    depth: 12,
    roomType: "vault",
    roomCategory: "special",
    directiveSeed: "seed",
    roomNonce: "nonce",
    rewardEnvelopeRef: "reward",
    specialRoomPayload: {
      policySource: "vault-roll",
      scheduleStateVersion: 1,
      scalingDepth: 50
    }
  });
  assert.equal(result.specialRoomPayload.scalingDepth, 50);
  assert.throws(
    () => directives.applyOnlineV3RoomDirective({
      ...result,
      specialRoomPayload: { ...result.specialRoomPayload, scalingDepth: 11 }
    }),
    /RANKED_DIRECTIVE_SCALING_DEPTH_INVALID/u
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

test("M4 test-assistance event preserves the active Ranked boundary binding", async () => {
  const directive = {
    directiveId: "directive_a",
    runId: "run_a1",
    revision: 4,
    roomIndex: 1,
    depth: 0,
    roomType: "combat",
    roomCategory: "normal",
    directiveSeed: "seed",
    roomNonce: "nonce_a",
    rewardEnvelopeRef: "envelope_a",
    specialRoomPayload: null
  };
  const rewardEnvelope = {
    envelopeId: "envelope_a",
    rewardSlots: [],
    fixedAwards: []
  };
  const store = memoryStore({
    schemaVersion: 1,
    mode: "ranked",
    runId: "run_a1",
    revision: 4,
    rulesetId: protocol.RULESET_ID,
    rulesetHash: protocol.RULESET_HASH,
    token: { kind: protocol.TOKEN_KINDS.room, value: "room-secret-4" },
    publicState: {
      ...meta("active", 4, directive),
      currentRewardEnvelope: rewardEnvelope
    },
    pendingOperation: null
  });
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "op_test_assistance",
      async request(endpoint, request) {
        const assistance = request.body.type === "mark_test_assistance";
        return {
          payload: {
            ok: true,
            protocolVersion: protocol.PROTOCOL_VERSION,
            runId: "run_a1",
            revision: assistance ? 5 : 6,
            acceptedEvent: assistance ? "mark_test_assistance" : "request_extraction",
            checkpointToken: assistance ? "room-secret-5" : "room-secret-6",
            metaState: {
              ...meta("active", assistance ? 5 : 6),
              rankEligibility: "official"
            }
          }
        };
      }
    }
  });

  await client.event("mark_test_assistance", { assistanceClass: "observer_bot" });

  const snapshot = client.getSnapshot();
  assert.deepEqual(snapshot.publicState.currentRoomDirective, directive);
  assert.deepEqual(snapshot.publicState.currentRewardEnvelope, rewardEnvelope);
  assert.equal(snapshot.publicState.assistanceClass, "observer_bot");
  assert.equal(snapshot.revision, 5);
  assert.equal(snapshot.token.value, "room-secret-5");

  await client.event("request_extraction", { mode: "normal" });
  const reloadedClient = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "unused",
      async request() { throw new Error("unused"); }
    }
  });
  assert.equal(reloadedClient.getSnapshot().publicState.assistanceClass, "observer_bot");
  assert.equal(reloadedClient.getSnapshot().revision, 6);
});

test("M4 checkpoint sends the versioned integrity envelope with gold telemetry", async () => {
  const directive = {
    directiveId: "directive_integrity_1",
    roomNonce: "nonce_integrity_1",
    depth: 1,
    roomType: "combat"
  };
  const store = memoryStore({
    schemaVersion: 1,
    mode: "ranked",
    runId: "run_a1",
    revision: 1,
    token: { kind: protocol.TOKEN_KINDS.room, value: "checkpoint-secret" },
    publicState: meta("active", 1, directive),
    pendingOperation: null
  });
  let sentBody = null;
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "op_integrity_checkpoint",
      async request(endpoint, request) {
        assert.equal(endpoint.path, "/api/v3/runs/checkpoint");
        sentBody = structuredClone(request.body);
        return {
          payload: {
            ok: true,
            protocolVersion: protocol.PROTOCOL_VERSION,
            runId: "run_a1",
            revision: 2,
            checkpointToken: "checkpoint-next",
            acceptedBoundary: "room_cleared",
            metaState: meta("active", 2, {
              ...directive,
              directiveId: "directive_integrity_2",
              roomNonce: "nonce_integrity_2",
              depth: 2
            })
          }
        };
      }
    }
  });
  await client.checkpoint({
    turnCount: 7,
    elapsedMs: 2_000,
    rewardClaims: [],
    reportedGoldDelta: 11,
    reportedGoldTotal: 21,
    integritySignals: ["local_room_completion_capability_invalid"],
    commands: []
  });
  assert.equal(sentBody.integrityVersion, 1);
  assert.equal(sentBody.reportedGoldDelta, 11);
  assert.equal(sentBody.reportedGoldTotal, 21);
  assert.deepEqual(sentBody.integritySignals, [
    "local_room_completion_capability_invalid"
  ]);
});

test("M4 canonical resync prevents a late checkpoint response from replacing newer state", async () => {
  const firstDirective = {
    directiveId: "directive_generation_1",
    roomNonce: "nonce_generation_1",
    depth: 1,
    roomType: "combat"
  };
  const resyncedDirective = {
    directiveId: "directive_generation_3",
    roomNonce: "nonce_generation_3",
    depth: 3,
    roomType: "combat"
  };
  const lateDirective = {
    directiveId: "directive_generation_2_late",
    roomNonce: "nonce_generation_2_late",
    depth: 2,
    roomType: "combat"
  };
  const store = rankedIdentityStore({
    session: {
      schemaVersion: 1,
      mode: "ranked",
      runId: "run_a1",
      revision: 1,
      rulesetId: protocol.RULESET_ID,
      rulesetHash: protocol.RULESET_HASH,
      token: { kind: protocol.TOKEN_KINDS.room, value: "checkpoint-generation-1" },
      publicState: meta("active", 1, firstDirective),
      pendingOperation: null
    },
    recovery: {
      runId: "run_a1",
      recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
      rulesetId: protocol.RULESET_ID,
      rulesetHash: protocol.RULESET_HASH
    }
  });
  let releaseCheckpoint;
  let markCheckpointStarted;
  const checkpointStarted = new Promise((resolve) => { markCheckpointStarted = resolve; });
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: (() => {
        let sequence = 0;
        return () => `op_generation_${sequence += 1}`;
      })(),
      async request(endpoint) {
        if (endpoint.path === protocol.ENDPOINTS.checkpoint.path) {
          markCheckpointStarted();
          return new Promise((resolve) => { releaseCheckpoint = resolve; });
        }
        assert.equal(endpoint.path, protocol.ENDPOINTS.resume.path);
        return {
          payload: {
            ok: true,
            protocolVersion: protocol.PROTOCOL_VERSION,
            runId: "run_a1",
            revision: 3,
            checkpointToken: "checkpoint-generation-3",
            metaState: meta("active", 3, resyncedDirective)
          }
        };
      }
    }
  });

  const lateCheckpoint = client.checkpoint({
    turnCount: 4,
    elapsedMs: 1_000,
    rewardClaims: [],
    reportedGoldDelta: 0,
    reportedGoldTotal: 0,
    commands: []
  });
  await checkpointStarted;
  await client.resumeCanonical();
  assert.equal(client.getSnapshot().revision, 3);
  assert.equal(client.getSnapshot().publicState.currentRoomDirective.directiveId, resyncedDirective.directiveId);

  releaseCheckpoint({
    payload: {
      ok: true,
      protocolVersion: protocol.PROTOCOL_VERSION,
      runId: "run_a1",
      revision: 2,
      checkpointToken: "checkpoint-generation-2",
      acceptedBoundary: "room_cleared",
      metaState: meta("active", 2, lateDirective)
    }
  });
  await lateCheckpoint;

  assert.equal(client.getSnapshot().revision, 3);
  assert.equal(client.getSnapshot().publicState.currentRoomDirective.directiveId, resyncedDirective.directiveId);
});

test("M4 game integration remains a narrow directive/checkpoint bridge", () => {
  const game = fs.readFileSync(new URL("../../../game.js", import.meta.url), "utf8");
  const runtime = fs.readFileSync(new URL("../../../online-v3/ranked-v3-runtime.js", import.meta.url), "utf8");
  const builder = fs.readFileSync(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");
  assert.match(game, /state\.onlineV3Ranked && state\.onlineV3Directive/u);
  assert.match(game, /DungeonOnlineV3\?\.onLocalRoomCleared/u);
  assert.match(game, /window\.DungeonOnlineV3GameBridge = Object\.freeze/u);
  assert.doesNotMatch(game, /fetch\s*\([^)]*\/api\/v3/u);
  assert.match(game, /if \(state\.onlineV3Ranked\) return;\s+if \(state\.phase/u);
  assert.doesNotMatch(
    runtime,
    /onRoomEntered\(directive\)[\s\S]*?\["merchant", "crossroads"\][\s\S]*?openMetaOffer\(directive\.roomType\)/u
  );
  assert.match(runtime, /async function onMerchantOpen\(\)/u);
  assert.match(runtime, /function onMerchantAction\(request = \{\}\)/u);
  assert.match(runtime, /async function onMerchantLeave\(options = \{\}\)/u);
  assert.match(builder, /enterRankedMerchant\(publicState, offer, request = \{\}\)/u);
  assert.match(builder, /onMerchantOpen\?\.\(\)/u);
  assert.match(builder, /onMerchantAction\?\.\(\{ action: "skill_upgrade", skillId \}\)/u);
  assert.match(builder, /onMerchantLeave\?\.\(\{ enterPortal: true \}\)/u);
});

test("public Ranked state carries the canonical potion capability marker only for v1", () => {
  const runtime = fs.readFileSync(new URL("../src/domain/ruleset-runtime.js", import.meta.url), "utf8");
  assert.match(runtime, /\.\.\.\(state\.potionPolicyVersion === "v1"/u);
  assert.match(runtime, /potionPolicyVersion: "v1"/u);
});
