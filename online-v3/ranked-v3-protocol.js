(function exposeRankedV3Protocol(root, factory) {
  "use strict";

  const api = factory();
  if (root) root.DungeonRankedV3Protocol = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createProtocolModule() {
  "use strict";

  const PROTOCOL_VERSION = "ranked-v3-checkpoint-1";
  const RULESET_ID = "v08-meta-1";
  const RULESET_HASH = "sha256:956251f158e55a0a47f9e43d5680d9aae66a22045c833bd76b8798cdc00e012e";
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
    abandon: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/abandon` }),
    camp: Object.freeze({ method: "POST", path: `${API_PREFIX}/profiles/camp` }),
    availability: Object.freeze({ method: "GET", path: `${API_PREFIX}/availability` }),
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

  function requireProtocolVersion(value) {
    if (value !== PROTOCOL_VERSION) throw new TypeError("PROTOCOL_VERSION_MISMATCH");
  }

  function requireOptionalRecord(value, field) {
    if (value !== null && value !== undefined && !isRecord(value)) {
      throw new TypeError(`PROTOCOL_PROJECTION_INVALID:${field}`);
    }
  }

  function requireOptionalArray(value, field) {
    if (value !== undefined && !Array.isArray(value)) {
      throw new TypeError(`PROTOCOL_PROJECTION_INVALID:${field}`);
    }
  }

  function validateOfferProjection(value, field) {
    requireOptionalRecord(value, field);
    if (value === null || value === undefined) return;
    const identity = value.offerId || value.transactionId || value.sourceId;
    requireText(identity, `${field}.identity`);
    requireOptionalArray(value.publicChoices, `${field}.publicChoices`);
    requireOptionalArray(value.choices, `${field}.choices`);
    requireOptionalArray(value.transactions, `${field}.transactions`);
  }

  function validateMetaState(value) {
    if (!isRecord(value)) throw new TypeError("PROTOCOL_META_STATE_INVALID");
    requireText(value.runId, "metaState.runId");
    requireText(value.rulesetId, "metaState.rulesetId");
    requireText(value.rulesetHash, "metaState.rulesetHash");
    requireProtocolVersion(value.protocolVersion);
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
      throw new TypeError("PROTOCOL_FIELD_INVALID:metaState.revision");
    }
    if (!["awaiting_starting_relic", "active", "victory", "defeat", "extraction", "finalized", "abandoned"].includes(value.status)) {
      throw new TypeError("PROTOCOL_STATUS_UNKNOWN");
    }
    requireOptionalRecord(value.currentRoomDirective, "currentRoomDirective");
    if (value.currentRoomDirective) {
      requireText(value.currentRoomDirective.directiveId, "currentRoomDirective.directiveId");
      requireText(value.currentRoomDirective.roomNonce, "currentRoomDirective.roomNonce");
      requireText(value.currentRoomDirective.roomType, "currentRoomDirective.roomType");
    }
    requireOptionalRecord(value.currentRewardEnvelope, "currentRewardEnvelope");
    if (value.currentRewardEnvelope) {
      requireText(value.currentRewardEnvelope.envelopeId, "currentRewardEnvelope.envelopeId");
      requireOptionalArray(value.currentRewardEnvelope.rewardSlots, "currentRewardEnvelope.rewardSlots");
    }
    requireOptionalRecord(value.build, "build");
    if (value.build) {
      requireOptionalArray(value.build.relics, "build.relics");
      requireOptionalArray(value.build.pacts, "build.pacts");
    }
    requireOptionalRecord(value.lifeState, "lifeState");
    if (value.lifeState && !Number.isSafeInteger(value.lifeState.currentLife)) {
      throw new TypeError("PROTOCOL_PROJECTION_INVALID:lifeState.currentLife");
    }
    validateOfferProjection(value.startingRelicOffer, "startingRelicOffer");
    validateOfferProjection(value.relicOffer, "relicOffer");
    validateOfferProjection(value.relicReplacement, "relicReplacement");
    validateOfferProjection(value.metaTransactionOffer, "metaTransactionOffer");
    requireOptionalRecord(value.campSession, "campSession");
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
    if (["finalized", "abandoned"].includes(value.metaState?.status)) return null;
    throw new TypeError("PROTOCOL_TOKEN_MISSING");
  }

  function validateMutationResponse(value, expected = {}) {
    if (!isRecord(value) || value.ok !== true) throw new TypeError("PROTOCOL_RESPONSE_INVALID");
    requireProtocolVersion(value.protocolVersion);
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
    if (value.acceptedBoundary !== undefined && ![
      "run_started",
      "starting_relic_selected",
      "room_cleared",
      "run_resumed",
      "run_abandoned",
      "run_finalized"
    ].includes(value.acceptedBoundary)) {
      throw new TypeError("PROTOCOL_RESPONSE_KIND_UNKNOWN");
    }
    if (value.acceptedEvent !== undefined && ![
      "issue_relic_offer",
      "select_relic",
      "commit_relic_replacement",
      "cancel_relic_replacement",
      "commit_relic_fallback",
      "open_meta_offer",
      "commit_meta_transaction",
      "report_fatal_event",
      "request_extraction"
    ].includes(value.acceptedEvent)) {
      throw new TypeError("PROTOCOL_RESPONSE_KIND_UNKNOWN");
    }
    const token = tokenFromResponse(value);
    if (expected.tokenKind && token?.kind !== expected.tokenKind) {
      throw new TypeError("PROTOCOL_TOKEN_KIND_MISMATCH");
    }
    return Object.freeze({ response: value, metaState, token });
  }

  function validateCampResponse(value) {
    if (!isRecord(value) || value.ok !== true) throw new TypeError("RANKED_CAMP_RESPONSE_INVALID");
    requireProtocolVersion(value.protocolVersion);
    requireText(value.profileId, "profileId");
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
      throw new TypeError("PROTOCOL_FIELD_INVALID:revision");
    }
    if (!isRecord(value.profile) || !isRecord(value.metaState)) {
      throw new TypeError("RANKED_CAMP_RESPONSE_INVALID");
    }
    validateOfferProjection(value.metaTransactionOffer, "metaTransactionOffer");
    return value;
  }

  function validateLeaderboardResponse(value, kind = "list") {
    if (!isRecord(value) || value.ok !== true) throw new TypeError("LEADERBOARD_RESPONSE_INVALID");
    if (kind === "list") {
      requireText(value.season, "season");
      if (!Array.isArray(value.entries)) throw new TypeError("LEADERBOARD_ENTRIES_INVALID");
      for (const entry of value.entries) {
        if (!isRecord(entry) || !/^run_[a-f0-9]+$/u.test(String(entry.runId || ""))) {
          throw new TypeError("LEADERBOARD_ENTRY_INVALID");
        }
      }
      if (value.cursor !== null && value.cursor !== undefined && typeof value.cursor !== "string") {
        throw new TypeError("LEADERBOARD_CURSOR_INVALID");
      }
    } else if (kind === "detail") {
      if (!isRecord(value.entry) || !/^run_[a-f0-9]+$/u.test(String(value.entry.runId || ""))) {
        throw new TypeError("LEADERBOARD_ENTRY_INVALID");
      }
      requireOptionalRecord(value.entry.build, "leaderboard.entry.build");
      requireOptionalRecord(value.entry.summary, "leaderboard.entry.summary");
    } else {
      throw new TypeError("LEADERBOARD_RESPONSE_KIND_UNKNOWN");
    }
    return value;
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
    validateMutationResponse,
    validateCampResponse,
    validateLeaderboardResponse
  });
});
