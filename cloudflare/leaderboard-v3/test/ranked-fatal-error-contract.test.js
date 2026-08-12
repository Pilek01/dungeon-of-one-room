import assert from "node:assert/strict";
import test from "node:test";

import { errorFromCause } from "../src/http/errors.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const protocol = require("../../../online-v3/ranked-v3-protocol.js");
const transportApi = require("../../../online-v3/ranked-v3-transport.js");

const FATAL_VALIDATION_CODES = [
  "FATAL_EVENT_PAYLOAD_INVALID",
  "FATAL_EVENT_PAYLOAD_INVALID_FIELDS",
  "FATAL_EVENT_CLASSIFICATION_INVALID",
  "FATAL_ELIXIR_USAGE_INVALID",
  "FATAL_ELIXIR_USAGE_UNAVAILABLE",
  "FATAL_PRESENTATION_CAUSE_INVALID"
];

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    async json() {
      return payload;
    }
  };
}

test("fatal request validation maps explicitly to 422 while internal fatal failures stay 500", () => {
  for (const code of FATAL_VALIDATION_CODES) {
    const mapped = errorFromCause(new TypeError(code));
    assert.equal(mapped.status, 422, code);
    assert.equal(mapped.code, code, code);
  }

  const internal = errorFromCause(new Error("FATAL_INTERNAL_STORAGE_FAILURE"));
  assert.equal(internal.status, 500);
  assert.equal(internal.code, "INTERNAL_ERROR");
});

test("transport performs one attempt for 422 and three identical retries for retryable fatal statuses", async () => {
  const cases = [
    { status: 422, code: "FATAL_EVENT_PAYLOAD_INVALID", attempts: 1 },
    { status: 500, code: "INTERNAL_ERROR", attempts: 3 },
    { status: 502, code: "UPSTREAM_FAILURE", attempts: 3 },
    { status: 503, code: "SERVICE_UNAVAILABLE", attempts: 3 }
  ];

  for (const expected of cases) {
    const calls = [];
    const operationId = "op_fatal_contract";
    const body = { type: "fatal", classification: "defeat" };
    const transport = transportApi.createTransport({
      baseUrl: "https://worker.test",
      retryPolicy: { ...protocol.RETRY_POLICY, baseDelayMs: 0, maxDelayMs: 0 },
      wait: async () => {},
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return response(expected.status, {
          error: { code: expected.code, message: expected.code }
        });
      }
    });

    await assert.rejects(
      transport.request(protocol.ENDPOINTS.event, { operationId, body }),
      (error) => error.status === expected.status && error.code === expected.code
    );
    assert.equal(calls.length, expected.attempts, `${expected.status} attempt count`);
    assert(calls.every(({ options }) => options.headers["Idempotency-Key"] === operationId));
    assert(calls.every(({ options }) => options.body === calls[0].options.body));
  }
});
