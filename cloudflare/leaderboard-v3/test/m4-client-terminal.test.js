import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const protocol = require("../../../online-v3/ranked-v3-protocol.js");
const clientApi = require("../../../online-v3/ranked-v3-client.js");

function memoryStore(initial) {
  let value = structuredClone(initial);
  return {
    loadSession: () => structuredClone(value),
    saveSession: (next) => { value = structuredClone(next); },
    clearSession: () => { value = null; }
  };
}

function terminalSession(pendingOperation = null) {
  return {
    runId: "run_a1",
    rulesetId: protocol.RULESET_ID,
    rulesetHash: protocol.RULESET_HASH,
    revision: 5,
    token: { kind: protocol.TOKEN_KINDS.terminal, value: "terminal-secret" },
    publicState: {
      runId: "run_a1",
      protocolVersion: protocol.PROTOCOL_VERSION,
      rulesetId: protocol.RULESET_ID,
      rulesetHash: protocol.RULESET_HASH,
      revision: 5,
      status: "defeat"
    },
    pendingOperation
  };
}

test("M4 finalization sends only run and terminal token and clears recovery after acknowledgement", async () => {
  const store = memoryStore(terminalSession());
  let body;
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "op_finalize",
      async request(endpoint, request) {
        assert.equal(endpoint.path, "/api/v3/runs/finalize");
        body = request.body;
        return {
          payload: {
            ok: true,
            protocolVersion: protocol.PROTOCOL_VERSION,
            runId: "run_a1",
            revision: 6,
            score: 1234,
            metaState: {
              ...terminalSession().publicState,
              revision: 6,
              status: "finalized"
            }
          }
        };
      }
    }
  });
  const result = await client.finalize();
  assert.deepEqual(body, {
    runId: "run_a1",
    checkpointToken: "terminal-secret",
    clientProtocolVersion: protocol.PROTOCOL_VERSION
  });
  assert.equal(result.score, 1234);
  assert.equal(client.getSnapshot().token, null);
  client.clear();
  assert.equal(store.loadSession(), null);
});

test("M4 lost finalize response recovery reuses exact operation and body", async () => {
  const pending = {
    endpoint: "finalize",
    operationId: "op_final_exact",
    body: { runId: "run_a1", checkpointToken: "terminal-secret" }
  };
  const store = memoryStore(terminalSession(pending));
  let observed;
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "must-not-be-used",
      async request(endpoint, request) {
        observed = { endpoint, request };
        return {
          payload: {
            ok: true,
            protocolVersion: protocol.PROTOCOL_VERSION,
            runId: "run_a1",
            revision: 6,
            score: 1234,
            metaState: {
              ...terminalSession().publicState,
              revision: 6,
              status: "finalized"
            }
          }
        };
      }
    }
  });
  await client.retryPending();
  assert.equal(observed.endpoint.path, "/api/v3/runs/finalize");
  assert.equal(observed.request.operationId, "op_final_exact");
  assert.deepEqual(observed.request.body, pending.body);
});

test("M4 recovery record never reads or writes Practice save keys", () => {
  const storageApi = require("../../../online-v3/ranked-v3-storage.js");
  const source = require("node:fs").readFileSync(
    new URL("../../../online-v3/ranked-v3-storage.js", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /dungeonOneRoomRunSave|dungeonOneRoomLives/u);
  assert.equal(storageApi.STORAGE_KEYS.session, "dungeonRankedV3:sessionV2");
});
