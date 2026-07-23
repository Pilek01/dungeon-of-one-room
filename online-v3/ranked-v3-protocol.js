(function exposeRankedV3Protocol(root, factory) {
  "use strict";

  const api = factory();
  if (root) root.DungeonRankedV3Protocol = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createProtocolModule() {
  "use strict";

  const PROTOCOL_VERSION = "ranked-v3-checkpoint-1";
  const API_PREFIX = "/api/v3";
  const ENDPOINTS = Object.freeze({
    start: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/start` }),
    checkpoint: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/checkpoint` }),
    event: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/event` }),
    finalize: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/finalize` }),
    leaderboard: Object.freeze({ method: "GET", path: `${API_PREFIX}/leaderboard` }),
    detail: Object.freeze({ method: "GET", path: `${API_PREFIX}/leaderboard/:runId` })
  });

  const ERROR_CODES = Object.freeze({
    invalidSchema: "invalid_schema",
    invalidToken: "invalid_token",
    expiredToken: "expired_token",
    staleRevision: "stale_revision",
    revisionGap: "revision_gap",
    idempotencyConflict: "idempotency_conflict",
    roomNonceMismatch: "room_nonce_mismatch",
    rulesetMismatch: "ruleset_mismatch",
    runNotActive: "run_not_active",
    proofRejected: "proof_rejected",
    rateLimited: "rate_limited",
    serviceUnavailable: "service_unavailable"
  });

  const RETRY_POLICY = Object.freeze({
    retryableStatus: Object.freeze([408, 425, 429, 500, 502, 503, 504]),
    maxAttempts: 5,
    baseDelayMs: 500,
    maxDelayMs: 8000,
    jitter: "full",
    requiresSameIdempotencyKey: true,
    inputLoopMayWait: false
  });

  function isV3Path(path) {
    return typeof path === "string" && (
      path === API_PREFIX ||
      path.startsWith(`${API_PREFIX}/`)
    );
  }

  function validateEnvelope(value) {
    const errors = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return Object.freeze(["envelope must be an object"]);
    }
    if (typeof value.runId !== "string" || !value.runId) errors.push("runId is required");
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
      errors.push("revision must be a non-negative safe integer");
    }
    if (typeof value.idempotencyKey !== "string" || !value.idempotencyKey) {
      errors.push("idempotencyKey is required");
    }
    if (typeof value.signedRunToken !== "string" || !value.signedRunToken) {
      errors.push("signedRunToken is required");
    }
    return Object.freeze(errors);
  }

  return Object.freeze({
    PROTOCOL_VERSION,
    API_PREFIX,
    ENDPOINTS,
    ERROR_CODES,
    RETRY_POLICY,
    isV3Path,
    validateEnvelope
  });
});
