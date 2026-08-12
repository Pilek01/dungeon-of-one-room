import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const protocol = require("../../../online-v3/ranked-v3-protocol.js");
const transportApi = require("../../../online-v3/ranked-v3-transport.js");
const OPERATION_ID = "op_11111111222233334444555555555555";

function response(status, code) {
  return {
    ok: false,
    status,
    headers: { get() { return null; } },
    async json() {
      return {
        ok: false,
        error: { code, message: code },
        traceId: `trace-${status}`
      };
    }
  };
}

async function captureFailure(status, code) {
  const calls = [];
  const waits = [];
  const transport = transportApi.createTransport({
    baseUrl: "https://worker.invalid",
    retryPolicy: {
      ...protocol.RETRY_POLICY,
      baseDelayMs: 0,
      maxDelayMs: 0,
      timeoutMs: 1000
    },
    wait: async (milliseconds) => waits.push(milliseconds),
    cryptoProvider: {
      randomUUID() { return "11111111-2222-3333-4444-555555555555"; }
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(status, code);
    }
  });
  let error;
  try {
    await transport.request(protocol.ENDPOINTS.event, {
      body: { type: "report_fatal_event" }
    });
  } catch (cause) {
    error = cause;
  }
  assert.ok(error instanceof transportApi.RankedV3HttpError);
  return { calls, waits, error };
}

test("HTTP 422 is non-retryable and preserves the fatal validation code", async () => {
  const result = await captureFailure(422, "FATAL_EVENT_PAYLOAD_INVALID_FIELDS");
  assert.equal(result.calls.length, 1);
  assert.equal(result.waits.length, 0);
  assert.equal(result.error.status, 422);
  assert.equal(result.error.code, "FATAL_EVENT_PAYLOAD_INVALID_FIELDS");
  assert.equal(result.error.retryable, false);
  assert.equal(result.calls[0].options.headers["Idempotency-Key"], OPERATION_ID);
});

for (const status of [500, 502, 503]) {
  test(`HTTP ${status} retries exactly three times with one operation identity`, async () => {
    const result = await captureFailure(status, `SERVER_${status}`);
    assert.equal(result.calls.length, 3);
    assert.equal(result.waits.length, 2);
    assert.equal(result.error.status, status);
    assert.equal(result.error.retryable, true);
    assert.deepEqual(
      result.calls.map((call) => call.options.headers["Idempotency-Key"]),
      [OPERATION_ID, OPERATION_ID, OPERATION_ID]
    );
    assert.equal(new Set(result.calls.map((call) => call.options.body)).size, 1);
  });
}
