import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const protocol = require("../../../online-v3/ranked-v3-protocol.js");
const storage = require("../../../online-v3/ranked-v3-storage.js");
const transportApi = require("../../../online-v3/ranked-v3-transport.js");

function response(status, payload, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] || null },
    async json() { return payload; }
  };
}

test("M4 transport keeps one operation identity across an exact retry", async () => {
  const calls = [];
  const transport = transportApi.createTransport({
    baseUrl: "http://worker.test",
    retryPolicy: { maxAttempts: 2, timeoutMs: 1000, baseDelayMs: 0 },
    wait: async () => {},
    cryptoProvider: { randomUUID: () => "11111111-2222-3333-4444-555555555555" },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) throw new TypeError("lost response");
      return response(200, { ok: true });
    }
  });
  const result = await transport.request(protocol.ENDPOINTS.event, { body: { type: "x" } });
  assert.equal(result.operationId, "op_11111111222233334444555555555555");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers["Idempotency-Key"], calls[1].options.headers["Idempotency-Key"]);
  assert.equal(calls[0].options.body, calls[1].options.body);
});

test("M4 transport reports conflicting retry without retrying", async () => {
  let count = 0;
  const transport = transportApi.createTransport({
    baseUrl: "",
    retryPolicy: { maxAttempts: 3, timeoutMs: 1000 },
    fetchImpl: async () => {
      count += 1;
      return response(409, { error: { code: "IDEMPOTENCY_KEY_REUSED", message: "conflict" } });
    }
  });
  await assert.rejects(
    transport.request(protocol.ENDPOINTS.event, {
      operationId: "op_existing",
      body: { type: "x" }
    }),
    (error) => error.conflict && error.code === "IDEMPOTENCY_KEY_REUSED"
  );
  assert.equal(count, 1);
});

test("M4 response validation distinguishes bootstrap, room and terminal tokens", () => {
  const base = {
    ok: true,
    runId: "run_a",
    revision: 0,
    bootstrapToken: "secret-bootstrap",
    metaState: {
      runId: "run_a",
      rulesetId: protocol.RULESET_ID,
      rulesetHash: protocol.RULESET_HASH,
      revision: 0,
      status: "awaiting_starting_relic"
    }
  };
  assert.equal(
    protocol.validateMutationResponse(base, { tokenKind: protocol.TOKEN_KINDS.bootstrap }).token.kind,
    "run_bootstrap"
  );
  const active = {
    ...base,
    bootstrapToken: undefined,
    checkpointToken: "secret-room",
    revision: 1,
    metaState: { ...base.metaState, revision: 1, status: "active" }
  };
  assert.equal(protocol.validateMutationResponse(active).token.kind, "room_checkpoint");
  const terminal = {
    ...active,
    metaState: { ...active.metaState, status: "victory" }
  };
  assert.equal(protocol.validateMutationResponse(terminal).token.kind, "run_terminal");
  assert.throws(
    () => protocol.validateMutationResponse(active, { tokenKind: protocol.TOKEN_KINDS.terminal }),
    /PROTOCOL_TOKEN_KIND_MISMATCH/u
  );
});

test("M4 storage is separate, versioned and fail-closed", () => {
  const values = new Map();
  const local = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
  const store = storage.createStore(local);
  store.saveSession({ runId: "run_a", token: "secret" });
  assert.deepEqual(store.loadSession(), { runId: "run_a", token: "secret" });
  assert.equal(storage.deserialize('{"storageVersion":1,"value":{"runId":"old"}}'), null);
  assert(Object.values(storage.STORAGE_KEYS).every((key) => key.startsWith("dungeonRankedV3:")));
  assert.equal([...values.keys()].some((key) => key.startsWith("dungeonOneRoom")), false);
});

test("M4 structured logging redacts all token and digest fields", () => {
  assert.deepEqual(
    transportApi.redact({
      checkpointToken: "secret",
      nested: { publicStateDigest: "digest", safe: "visible" }
    }),
    {
      checkpointToken: "[redacted]",
      nested: { publicStateDigest: "[redacted]", safe: "visible" }
    }
  );
});
