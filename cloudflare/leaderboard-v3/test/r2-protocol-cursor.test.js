import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { PROTOCOL_VERSION } from "../src/config.js";
import {
  decodeLeaderboardCursor,
  encodeLeaderboardCursor
} from "../src/domain/leaderboard-cursor.js";
import { createWorker } from "../src/index.js";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import {
  V08_META_1_LOCAL_RELEASE_DESCRIPTOR,
  V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR
} from "../src/rulesets/releases.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";

const require = createRequire(import.meta.url);
const protocol = require("../../../online-v3/ranked-v3-protocol.js");
const clientApi = require("../../../online-v3/ranked-v3-client.js");
const recorder = require("../../../online-v3/ranked-v3-recorder.js");
const checkpoints = require("../../../online-v3/ranked-v3-checkpoints.js");

function registeredWorker() {
  return createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_LOCAL_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "local",
    repositories: createMemoryRepositories(),
    now: () => 1_800_000_000_000,
    randomUUID: () => "00000000-0000-4000-8000-000000000001"
  });
}

function registeredProductionWorker() {
  return createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "local",
    repositories: createMemoryRepositories(),
    now: () => 1_800_000_000_000,
    randomUUID: () => "00000000-0000-4000-8000-000000000001"
  });
}

function startBody(overrides = {}) {
  return {
    playerName: "Protocol",
    season: "r2-protocol",
    gameVersion: "0.8.1",
    rulesetId: "v08-meta-1",
    rulesetHash: manifest.rulesetHash,
    clientInstallIdHash: "install_0123456789abcdef",
    profileId: "profile_0123456789abcdef0123456789abcdef",
    profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
    recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
    clientProtocolVersion: PROTOCOL_VERSION,
    ...overrides
  };
}

async function postStart(worker, body) {
  return worker.fetch(new Request("https://r2.invalid/api/v3/runs/start", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": "r2-protocol-start-0001"
    },
    body: JSON.stringify(body)
  }), { RANKED_V3_HMAC_SECRET: TEST_SECRET });
}

test("R2 registered mutations reject unknown fields and protocol mismatch", async () => {
  const worker = registeredWorker();
  const unknown = await postStart(worker, startBody({ surprise: true }));
  assert.equal(unknown.status, 400);
  assert.equal((await unknown.json()).error.code, "REQUEST_FIELDS_INVALID");

  const mismatch = await postStart(worker, startBody({
    clientProtocolVersion: "ranked-v3-unsupported"
  }));
  assert.equal(mismatch.status, 409);
  assert.equal((await mismatch.json()).error.code, "PROTOCOL_VERSION_MISMATCH");
});

test("R2 client schema accepts bootstrap from the activated ruleset", async () => {
  const localWorker = registeredWorker();
  const localStartedResponse = await postStart(localWorker, startBody());
  assert.equal(localStartedResponse.status, 201);
  const localStarted = await localStartedResponse.json();
  protocol.validateMutationResponse(localStarted);

  const worker = registeredProductionWorker();
  const startedResponse = await postStart(worker, startBody({
    rulesetHash: V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash
  }));
  assert.equal(startedResponse.status, 201);
  const started = await startedResponse.json();
  protocol.validateMutationResponse(started);
  const selectedResponse = await worker.fetch(new Request("https://r2.invalid/api/v3/runs/event", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": "r2-protocol-select-0001"
    },
    body: JSON.stringify({
      runId: started.runId,
      type: "select_starting_relic",
      bootstrapToken: started.bootstrapToken,
      offerId: started.metaState.startingRelicOffer.offerId,
      choiceId: started.metaState.startingRelicOffer.publicChoices[0].choiceId,
      clientProtocolVersion: PROTOCOL_VERSION
    })
  }), { RANKED_V3_HMAC_SECRET: TEST_SECRET });
  assert.equal(selectedResponse.status, 200);
  protocol.validateMutationResponse(await selectedResponse.json());
});
test("R2 availability descriptor is explicit and does not require D1", async () => {
  const worker = createWorker({ rulesetEnvironment: "local" });
  const compatible = await worker.fetch(new Request(
    `https://r2.invalid/api/v3/availability?clientProtocolVersion=${PROTOCOL_VERSION}`
  ), {});
  assert.equal(compatible.status, 200);
  const descriptor = await compatible.json();
  assert.equal(descriptor.compatible, true);
  assert.equal(descriptor.productionActivated, false);
  assert.equal(descriptor.requestSchemaPolicy.mutationPolicy, "reject_unknown_fields");

  const mismatch = await worker.fetch(new Request(
    "https://r2.invalid/api/v3/availability?clientProtocolVersion=old"
  ), {});
  assert.equal(mismatch.status, 409);
  assert.equal((await mismatch.json()).compatible, false);
});

test("R2 public seek cursor is versioned, strict, and malformed input returns 400", async () => {
  const cursor = encodeLeaderboardCursor({
    runId: "run_ab12",
    score: 12,
    createdAt: 34
  });
  assert.deepEqual(decodeLeaderboardCursor(cursor), {
    runId: "run_ab12",
    score: 12,
    createdAt: 34
  });
  assert.throws(
    () => decodeLeaderboardCursor("eyJzY29yZSI6MTJ9"),
    /LEADERBOARD_CURSOR_INVALID/u
  );

  const worker = registeredWorker();
  const response = await worker.fetch(new Request(
    "https://r2.invalid/api/v3/leaderboard?season=r2-protocol&cursor=not%2Ba%2Bcursor"
  ), { RANKED_V3_HMAC_SECRET: TEST_SECRET });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "LEADERBOARD_CURSOR_INVALID");
});

test("R2 client accepts current and retained released save hashes and rejects unknown hashes", () => {
  assert.equal(protocol.RULESET_HASH, V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash);
  assert.equal(protocol.RULESET_HASH, manifest.rulesetHash);
  assert.equal(protocol.isSupportedRulesetHash(manifest.rulesetHash), true);
  for (const hash of protocol.SUPPORTED_RULESET_HASHES) {
    assert.equal(protocol.isSupportedRulesetHash(hash), true);
  }
  assert.equal(
    protocol.isSupportedRulesetHash("sha256:" + "f".repeat(64)),
    false
  );
});
test("R2 client fails closed on malformed nested projections and unknown response kinds", () => {
  const base = {
    ok: true,
    protocolVersion: protocol.PROTOCOL_VERSION,
    runId: "run_ab12",
    revision: 2,
    checkpointToken: "opaque-token",
    acceptedBoundary: "room_cleared",
    metaState: {
      runId: "run_ab12",
      protocolVersion: protocol.PROTOCOL_VERSION,
      rulesetId: protocol.RULESET_ID,
      rulesetHash: protocol.RULESET_HASH,
      revision: 2,
      status: "active",
      currentRoomDirective: {
        directiveId: "directive-1",
        roomNonce: "nonce-1",
        roomType: "combat"
      },
      currentRewardEnvelope: null,
      build: { relics: [], pacts: [] },
      lifeState: { currentLife: 1 },
      startingRelicOffer: null,
      relicOffer: null,
      relicReplacement: null,
      metaTransactionOffer: null,
      campSession: null
    }
  };
  assert.equal(protocol.validateMutationResponse(base).metaState.status, "active");
  const withCanonicalScore = {
    ...base,
    metaState: {
      ...base.metaState,
      score: {
        scoreVersion: "v08-score-1",
        score: 4492,
        inputs: { acceptedMaxDepth: 4, acceptedRunGoldEarned: 246 },
        components: { depthPoints: 4000, goldPoints: 492, bossMilestonePoints: 0 }
      }
    }
  };
  assert.equal(protocol.validateMutationResponse(withCanonicalScore).metaState.score.score, 4492);
  assert.throws(
    () => protocol.validateMutationResponse({
      ...withCanonicalScore,
      metaState: {
        ...withCanonicalScore.metaState,
        score: { ...withCanonicalScore.metaState.score, score: 1 }
      }
    }),
    /PROTOCOL_PROJECTION_INVALID:score\.total/u
  );
  assert.throws(
    () => protocol.validateMutationResponse({
      ...base,
      metaState: { ...base.metaState, currentRoomDirective: "forged" }
    }),
    /PROTOCOL_PROJECTION_INVALID:currentRoomDirective/u
  );
  assert.throws(
    () => protocol.validateMutationResponse({
      ...base,
      acceptedBoundary: "server_claimed_combat_verified"
    }),
    /PROTOCOL_RESPONSE_KIND_UNKNOWN/u
  );
});

test("R2 local projection failure performs canonical resume without fallback", async () => {
  let session = {
    schemaVersion: 1,
    mode: "ranked",
    runId: "run_ab12",
    revision: 2,
    rulesetId: protocol.RULESET_ID,
    rulesetHash: protocol.RULESET_HASH,
    token: { kind: protocol.TOKEN_KINDS.room, value: "room-token" },
    publicState: {
      runId: "run_ab12",
      protocolVersion: protocol.PROTOCOL_VERSION,
      rulesetId: protocol.RULESET_ID,
      rulesetHash: protocol.RULESET_HASH,
      revision: 2,
      status: "active",
      currentRoomDirective: {
        directiveId: "directive-2",
        roomNonce: "nonce-2",
        roomType: "combat"
      }
    },
    pendingOperation: null
  };
  const recovery = {
    runId: "run_ab12",
    recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"
  };
  const calls = [];
  const canonicalMeta = {
    ...session.publicState,
    revision: 3,
    currentRewardEnvelope: null,
    build: { relics: [], pacts: [] },
    lifeState: { currentLife: 1 },
    startingRelicOffer: null,
    relicOffer: null,
    relicReplacement: null,
    metaTransactionOffer: null,
    campSession: null
  };
  const client = clientApi.createRankedClient({
    store: {
      loadSession: () => structuredClone(session),
      saveSession: (value) => { session = structuredClone(value); },
      clearSession: () => { session = null; },
      loadRecovery: () => recovery
    },
    transport: {
      createOperationId: () => `op_${String(calls.length + 1).padStart(32, "0")}`,
      async request(endpoint) {
        calls.push(endpoint.path);
        if (endpoint.path === protocol.ENDPOINTS.resume.path) {
          return {
            payload: {
              ok: true,
              protocolVersion: protocol.PROTOCOL_VERSION,
              acceptedBoundary: "run_resumed",
              runId: "run_ab12",
              revision: 3,
              checkpointToken: "fresh-room-token",
              metaState: canonicalMeta
            }
          };
        }
        return {
          payload: {
            ok: true,
            protocolVersion: protocol.PROTOCOL_VERSION,
            acceptedBoundary: "room_cleared",
            runId: "run_ab12",
            revision: 3,
            checkpointToken: "committed-token",
            metaState: {
              ...canonicalMeta,
              currentRoomDirective: "malformed-after-commit"
            }
          }
        };
      }
    }
  });
  await assert.rejects(
    client.event("open_meta_offer", {}),
    (error) => error.canonicalResyncCompleted === true
  );
  assert.deepEqual(calls, [
    protocol.ENDPOINTS.event.path,
    protocol.ENDPOINTS.resume.path
  ]);
  assert.equal(client.getSnapshot().revision, 3);
  assert.equal(client.getSnapshot().token.value, "fresh-room-token");
});
test("R2 browser reward evidence remains explicitly non-authoritative", () => {
  assert.deepEqual(recorder.ASSURANCE, {
    status: "active_bounded_client_attestation",
    activeCombatSecurity: false,
    note: "Records bounded local reward claims; it is not evidence of server-authoritative combat."
  });
  assert.equal(checkpoints.ASSURANCE.status, "test_spec_only");
  assert.equal(checkpoints.ASSURANCE.activeCombatSecurity, false);
});
