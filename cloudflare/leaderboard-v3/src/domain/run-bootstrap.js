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
    startDepth: 0
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
    bootstrapBoundary: {
      boundaryVersion: 1,
      status: "awaiting_selection",
      bootstrapNonce,
      startingOfferId: canonical.pendingOffer?.offerId || "",
      issuedRevision: canonical.revision
    },
    journalDigest: "",
    anomalyScore: 0,
    expiresAt: now + RUN_TTL_MS,
    finalizedAt: null,
    outcome: null
  };
  assertAwaitingRunBootstrap(nextState);
  return {
    nextState,
    response: {
      acceptedBoundary: "run_bootstrap_created"
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
