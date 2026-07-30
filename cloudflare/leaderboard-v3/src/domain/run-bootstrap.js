import {
  PROTOCOL_VERSION,
  RUN_TTL_MS,
  TOKEN_TTL_MS
} from "../config.js";

function requireText(value, code) {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(code);
  return text;
}

function requireTimestamp(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(code);
  return value;
}

export function assertBootstrapRuleset(ruleset, binding = {}) {
  if (!ruleset || typeof ruleset !== "object") {
    throw new TypeError("RULESET_UNAVAILABLE");
  }
  for (const field of ["rulesetId", "rulesetHash"]) {
    requireText(ruleset[field], `RULESET_${field === "rulesetId" ? "ID" : "HASH"}_MISSING`);
  }
  if (binding.rulesetId && ruleset.rulesetId !== binding.rulesetId) {
    throw new TypeError("RULESET_ID_MISMATCH");
  }
  if (binding.rulesetHash && ruleset.rulesetHash !== binding.rulesetHash) {
    throw new TypeError("RULESET_HASH_MISMATCH");
  }
  for (const method of [
    "createRun",
    "selectStartingRelic",
    "projectPublicStartingRelicOffer"
  ]) {
    if (typeof ruleset[method] !== "function") {
      throw new TypeError(`RULESET_METHOD_MISSING:${method}`);
    }
  }
  return ruleset;
}

export function assertAwaitingRunBootstrap(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new TypeError("RUN_BOOTSTRAP_STATE_INVALID");
  }
  if (state.status !== "awaiting_starting_relic") {
    throw new TypeError("RUN_BOOTSTRAP_STATUS_INVALID");
  }
  if (state.currentRoomDirective !== null || "roomDirective" in state) {
    throw new TypeError("RUN_BOOTSTRAP_ROOM_DIRECTIVE_FORBIDDEN");
  }
  if (!state.pendingOffer || state.pendingOffer.offerType !== "starting_relic") {
    throw new TypeError("RUN_BOOTSTRAP_STARTING_OFFER_REQUIRED");
  }
  if (
    !state.bootstrapBoundary ||
    state.bootstrapBoundary.status !== "awaiting_selection" ||
    state.bootstrapBoundary.startingOfferId !== state.pendingOffer.offerId
  ) {
    throw new TypeError("RUN_BOOTSTRAP_BOUNDARY_INVALID");
  }
  requireText(state.bootstrapBoundary.bootstrapNonce, "RUN_BOOTSTRAP_NONCE_REQUIRED");
  if (state.bootstrapBoundary.issuedRevision !== state.revision) {
    throw new TypeError("RUN_BOOTSTRAP_REVISION_MISMATCH");
  }
  return state;
}

export async function createAuthenticatedRunBootstrap(input, context) {
  const ruleset = assertBootstrapRuleset(context?.ruleset, {
    rulesetId: input?.rulesetId,
    rulesetHash: input?.rulesetHash
  });
  const now = requireTimestamp(context?.now, "STARTED_AT_INVALID");
  const runId = requireText(context?.runId, "RUN_ID_REQUIRED");
  const bootstrapNonce = requireText(
    context?.bootstrapNonce,
    "RUN_BOOTSTRAP_NONCE_REQUIRED"
  );
  const canonical = await ruleset.createRun({
    startDepth: Math.max(0, Math.floor(Number(input?.startDepth) || 0)),
    profileState: context.profileState || null
  }, {
    runId,
    season: requireText(input?.season, "SEASON_REQUIRED"),
    startedAt: now,
    now,
    secret: context.secret,
    cryptoProvider: context.cryptoProvider,
    randomOracle: context.randomOracle
  });
  if (
    canonical.runId !== runId ||
    canonical.rulesetId !== ruleset.rulesetId ||
    canonical.rulesetHash !== ruleset.rulesetHash
  ) {
    throw new TypeError("RUN_BOOTSTRAP_RULESET_OUTPUT_MISMATCH");
  }
  const nextState = {
    ...canonical,
    protocolVersion: PROTOCOL_VERSION,
    gameVersion: requireText(input?.gameVersion, "GAME_VERSION_REQUIRED"),
    playerName: requireText(input?.playerName, "PLAYER_NAME_REQUIRED"),
    clientInstallIdHash: requireText(
      input?.clientInstallIdHash,
      "CLIENT_INSTALL_ID_HASH_REQUIRED"
    ),
    profileId: context.profileId || null,
    bootstrapBoundary: canonical.status === "awaiting_starting_relic"
      ? {
          boundaryVersion: 1,
          status: "awaiting_selection",
          bootstrapNonce,
          startingOfferId: canonical.pendingOffer?.offerId || "",
          issuedRevision: canonical.revision
        }
      : null,
    journalDigest: "",
    anomalyScore: 0,
    expiresAt: now + RUN_TTL_MS,
    finalizedAt: null,
    outcome: null
  };
  if (nextState.status === "awaiting_starting_relic") {
    assertAwaitingRunBootstrap(nextState);
  } else if (nextState.status !== "active" || !nextState.currentRoomDirective) {
    throw new TypeError("RUN_START_PROFILE_STATE_INVALID");
  }
  return {
    nextState,
    response: {
      acceptedBoundary: nextState.status === "active"
        ? "run_profile_loaded"
        : "run_bootstrap_created"
    },
    storageEffects: [{ type: "insert_run" }]
  };
}

export function bootstrapTokenPayloadForState(state, stateDigest, now) {
  assertAwaitingRunBootstrap(state);
  return {
    tokenVersion: 2,
    boundaryKind: "run_bootstrap",
    runId: state.runId,
    rulesetId: state.rulesetId,
    rulesetHash: state.rulesetHash,
    revision: state.revision,
    startingOfferId: state.pendingOffer.offerId,
    stateDigest: requireText(stateDigest, "STATE_DIGEST_REQUIRED"),
    bootstrapNonce: state.bootstrapBoundary.bootstrapNonce,
    issuedAt: requireTimestamp(now, "TOKEN_ISSUED_AT_INVALID"),
    expiresAt: now + TOKEN_TTL_MS
  };
}

export function terminalTokenPayloadForState(state, stateDigest, now) {
  if (!["victory", "defeat", "extraction"].includes(state?.status)) {
    throw new TypeError("RUN_TERMINAL_BOUNDARY_STATUS_INVALID");
  }
  if (
    state.currentRoomDirective !== null ||
    state.currentRewardEnvelope !== null ||
    state.pendingOffer !== null ||
    state.pendingRelicTransaction !== null ||
    state.pendingInventory !== null
  ) {
    throw new TypeError("RUN_TERMINAL_BOUNDARY_HAS_BLOCKING_WORK");
  }
  return {
    tokenVersion: 2,
    boundaryKind: "run_terminal",
    runId: requireText(state.runId, "RUN_ID_REQUIRED"),
    rulesetId: requireText(state.rulesetId, "RULESET_ID_REQUIRED"),
    rulesetHash: requireText(state.rulesetHash, "RULESET_HASH_REQUIRED"),
    revision: state.revision,
    stateDigest: requireText(stateDigest, "STATE_DIGEST_REQUIRED"),
    issuedAt: requireTimestamp(now, "TOKEN_ISSUED_AT_INVALID"),
    expiresAt: now + TOKEN_TTL_MS
  };
}

function normalizeStartingRelicSelection(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("STARTING_RELIC_SELECTION_INVALID");
  }
  if (Object.keys(request).sort().join(",") !== "choiceId,offerId") {
    throw new TypeError("STARTING_RELIC_SELECTION_FIELDS_INVALID");
  }
  return {
    offerId: requireText(request.offerId, "STARTING_RELIC_OFFER_ID_REQUIRED"),
    choiceId: requireText(request.choiceId, "STARTING_RELIC_CHOICE_ID_REQUIRED")
  };
}

function assertFirstRoomDirective(state) {
  const directive = state?.currentRoomDirective;
  if (!directive || typeof directive !== "object") {
    throw new TypeError("FIRST_ROOM_DIRECTIVE_REQUIRED");
  }
  if (
    directive.runId !== state.runId ||
    directive.revision !== state.revision ||
    !String(directive.directiveId || "") ||
    !String(directive.roomNonce || "")
  ) {
    throw new TypeError("FIRST_ROOM_DIRECTIVE_BINDING_INVALID");
  }
  return directive;
}

function selectionResponse(state, replayed) {
  return {
    acceptedBoundary: "starting_relic_selected",
    replayed,
    selectedOfferId: state.bootstrapBoundary.startingOfferId,
    selectedChoiceId: state.bootstrapBoundary.selectedChoiceId,
    firstRoomDirective: structuredClone(assertFirstRoomDirective(state))
  };
}

export async function selectAuthenticatedStartingRelic(
  state,
  rawRequest,
  context
) {
  const request = normalizeStartingRelicSelection(rawRequest);
  const ruleset = assertBootstrapRuleset(context?.ruleset, {
    rulesetId: state?.rulesetId,
    rulesetHash: state?.rulesetHash
  });
  if (state?.bootstrapBoundary?.status === "completed") {
    if (
      request.offerId !== state.bootstrapBoundary.startingOfferId ||
      request.choiceId !== state.bootstrapBoundary.selectedChoiceId
    ) {
      throw new TypeError("STARTING_RELIC_BOOTSTRAP_ALREADY_COMPLETED_CONFLICT");
    }
    return {
      nextState: structuredClone(state),
      response: selectionResponse(state, true),
      storageEffects: []
    };
  }
  assertAwaitingRunBootstrap(state);
  if (request.offerId !== state.bootstrapBoundary.startingOfferId) {
    throw new TypeError("STARTING_RELIC_OFFER_UNKNOWN");
  }
  const before = structuredClone(state);
  const selected = await ruleset.selectStartingRelic(
    structuredClone(state),
    request,
    {
      runId: state.runId,
      rulesetHash: state.rulesetHash,
      secret: context.secret,
      cryptoProvider: context.cryptoProvider,
      randomOracle: context.randomOracle
    }
  );
  if (
    selected.runId !== state.runId ||
    selected.rulesetId !== state.rulesetId ||
    selected.rulesetHash !== state.rulesetHash
  ) {
    throw new TypeError("STARTING_RELIC_TRANSITION_BINDING_CHANGED");
  }
  if (
    selected.status !== "active" ||
    selected.revision !== state.revision + 1 ||
    selected.pendingOffer !== null
  ) {
    throw new TypeError("STARTING_RELIC_TRANSITION_INVALID");
  }
  assertFirstRoomDirective(selected);
  if (JSON.stringify(state) !== JSON.stringify(before)) {
    throw new TypeError("STARTING_RELIC_TRANSITION_MUTATED_INPUT");
  }
  const nextState = {
    ...selected,
    bootstrapBoundary: {
      ...state.bootstrapBoundary,
      status: "completed",
      selectedChoiceId: request.choiceId,
      completedRevision: selected.revision,
      firstRoomDirectiveId: selected.currentRoomDirective.directiveId,
      firstRoomNonce: selected.currentRoomDirective.roomNonce
    }
  };
  return {
    nextState,
    response: selectionResponse(nextState, false),
    storageEffects: [{
      type: "update_run",
      expectedRevision: state.revision
    }]
  };
}

export function roomTokenPayloadForState(state, stateDigest, now) {
  const directive = assertFirstRoomDirective(state);
  if (state.status !== "active") {
    throw new TypeError("ROOM_TOKEN_RUN_NOT_ACTIVE");
  }
  return {
    tokenVersion: 2,
    boundaryKind: "room_checkpoint",
    runId: state.runId,
    rulesetId: state.rulesetId,
    rulesetHash: state.rulesetHash,
    revision: state.revision,
    stateDigest: requireText(stateDigest, "STATE_DIGEST_REQUIRED"),
    roomDirectiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
    issuedAt: requireTimestamp(now, "TOKEN_ISSUED_AT_INVALID"),
    expiresAt: now + TOKEN_TTL_MS
  };
}
