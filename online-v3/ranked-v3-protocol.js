(function exposeRankedV3Protocol(root, factory) {
  "use strict";

  const api = factory();
  if (root) root.DungeonRankedV3Protocol = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createProtocolModule() {
  "use strict";

  const PROTOCOL_VERSION = "ranked-v3-checkpoint-1";
  const RULESET_ID = "v08-meta-1";
  const RULESET_HASH = "sha256:b3f6434bbc05436936d95ce99179c46cc1ebcaf584af1228f7ee4d5b1ef75731";
  const API_PREFIX = "/api/v3";
  const TOKEN_KINDS = Object.freeze({
    bootstrap: "run_bootstrap",
    room: "room_checkpoint",
    terminal: "run_terminal"
  });
  const ENDPOINTS = Object.freeze({
    start: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/start` }),
    checkpoint: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/checkpoint` }),
    event: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/event` }),
    finalize: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/finalize` }),
    resume: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/resume` }),
    camp: Object.freeze({ method: "POST", path: `${API_PREFIX}/profiles/camp` }),
    leaderboard: Object.freeze({ method: "GET", path: `${API_PREFIX}/leaderboard` }),
    detail: Object.freeze({ method: "GET", path: `${API_PREFIX}/leaderboard/:runId` })
  });
  const RETRY_POLICY = Object.freeze({
    retryableStatus: Object.freeze([408, 425, 429, 500, 502, 503, 504]),
    maxAttempts: 3,
    baseDelayMs: 250,
    maxDelayMs: 1500,
    timeoutMs: 8000,
    requiresSameOperationId: true
  });

  function isRecord(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function isV3Path(path) {
    return typeof path === "string" && (
      path === API_PREFIX ||
      path.startsWith(`${API_PREFIX}/`)
    );
  }

  function requireText(value, field) {
    if (typeof value !== "string" || !value) throw new TypeError(`PROTOCOL_FIELD_INVALID:${field}`);
    return value;
  }

  function validateMetaState(value) {
    if (!isRecord(value)) throw new TypeError("PROTOCOL_META_STATE_INVALID");
    requireText(value.runId, "metaState.runId");
    requireText(value.rulesetId, "metaState.rulesetId");
    requireText(value.rulesetHash, "metaState.rulesetHash");
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
      throw new TypeError("PROTOCOL_FIELD_INVALID:metaState.revision");
    }
    if (!["awaiting_starting_relic", "active", "victory", "defeat", "extraction", "finalized"].includes(value.status)) {
      throw new TypeError("PROTOCOL_STATUS_UNKNOWN");
    }
    return value;
  }

  function tokenFromResponse(value) {
    if (typeof value.bootstrapToken === "string" && value.bootstrapToken) {
      return { kind: TOKEN_KINDS.bootstrap, value: value.bootstrapToken };
    }
    if (typeof value.checkpointToken === "string" && value.checkpointToken) {
      const terminal = ["victory", "defeat", "extraction"].includes(value.metaState?.status);
      return {
        kind: terminal ? TOKEN_KINDS.terminal : TOKEN_KINDS.room,
        value: value.checkpointToken
      };
    }
    if (value.metaState?.status === "finalized") return null;
    throw new TypeError("PROTOCOL_TOKEN_MISSING");
  }

  function validateMutationResponse(value, expected = {}) {
    if (!isRecord(value) || value.ok !== true) throw new TypeError("PROTOCOL_RESPONSE_INVALID");
    requireText(value.runId, "runId");
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
      throw new TypeError("PROTOCOL_FIELD_INVALID:revision");
    }
    const metaState = validateMetaState(value.metaState);
    if (value.runId !== metaState.runId || value.revision !== metaState.revision) {
      throw new TypeError("PROTOCOL_RESPONSE_BINDING_MISMATCH");
    }
    if (expected.runId && value.runId !== expected.runId) throw new TypeError("PROTOCOL_RUN_MISMATCH");
    if (expected.rulesetId && metaState.rulesetId !== expected.rulesetId) {
      throw new TypeError("PROTOCOL_RULESET_ID_MISMATCH");
    }
    if (expected.rulesetHash && metaState.rulesetHash !== expected.rulesetHash) {
      throw new TypeError("PROTOCOL_RULESET_HASH_MISMATCH");
    }
    const token = tokenFromResponse(value);
    if (expected.tokenKind && token?.kind !== expected.tokenKind) {
      throw new TypeError("PROTOCOL_TOKEN_KIND_MISMATCH");
    }
    return Object.freeze({ response: value, metaState, token });
  }

  function validateEnvelope(value, tokenKind = TOKEN_KINDS.room) {
    const errors = [];
    if (!isRecord(value)) return Object.freeze(["envelope must be an object"]);
    if (typeof value.runId !== "string" || !value.runId) errors.push("runId is required");
    const tokenField = tokenKind === TOKEN_KINDS.bootstrap ? "bootstrapToken" : "checkpointToken";
    if (typeof value[tokenField] !== "string" || !value[tokenField]) {
      errors.push(`${tokenField} is required`);
    }
    return Object.freeze(errors);
  }

  return Object.freeze({
    PROTOCOL_VERSION,
    RULESET_ID,
    RULESET_HASH,
    API_PREFIX,
    TOKEN_KINDS,
    ENDPOINTS,
    RETRY_POLICY,
    isV3Path,
    validateEnvelope,
    validateMetaState,
    validateMutationResponse
  });
});
