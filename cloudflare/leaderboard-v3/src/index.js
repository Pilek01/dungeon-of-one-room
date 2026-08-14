import {
  ABANDONED_RUN_TTL_MS,
  ABUSE_CONTROL_BINDING,
  HMAC_SECRET_BINDING,
  MAX_ACTIVE_RUNS_PER_PROFILE,
  PROTOCOL_VERSION,
  PROFILE_TTL_MS,
  RECENT_OPS_LIMIT,
  TOKEN_TTL_MS
} from "./config.js";
import {
  applyCheckpoint,
  applyMetaEvent,
  finalizeRun
} from "./domain/transitions.js";
import {
  appendVersionedRecentOperation,
  createCompactOperationRecord,
  createRecentOperationsV2,
  resolveIdempotentReplay
} from "./domain/idempotency.js";
import {
  bootstrapTokenPayloadForState,
  createAuthenticatedRunBootstrap,
  roomTokenPayloadForState,
  selectAuthenticatedStartingRelic,
  terminalTokenPayloadForState
} from "./domain/run-bootstrap.js";
import {
  applyRulesetCheckpoint,
  applyRulesetEvent,
  finalizeRulesetRun,
  publicRulesetMetaState,
} from "./domain/ruleset-runtime.js";
import {
  createInitialRun,
  publicMetaState,
  stateForDigest
} from "./domain/run-state.js";
import { assertRulesetV3 } from "./domain/ruleset-interface.js";
import { cleanupExpiredRuns } from "./domain/retention.js";
import { errorFromCause, HttpError } from "./http/errors.js";
import {
  parseLeaderboardQuery,
  readJsonRequest,
  requireIdempotencyKey,
  requireString
} from "./http/request.js";
import { errorResponse, jsonResponse } from "./http/response.js";
import {
  REGISTERED_MUTATION_FIELDS,
  REQUEST_SCHEMA_POLICY_VERSION,
  rejectUnknownRequestFields
} from "./http/schema-policy.js";
import {
  BOUNDARY_KINDS,
  decodeBoundaryToken,
  decodeCheckpointToken,
  signBoundaryToken,
  signCheckpointToken,
  verifyBoundaryToken,
  verifyCheckpointToken
} from "./security/checkpoint-token.js";
import { canonicalDigest } from "./security/digests.js";
import { createD1LeaderboardRepository } from "./storage/d1-leaderboard.js";
import { createD1RunRepository } from "./storage/d1-runs.js";
import { createD1ProfileRepository } from "./storage/d1-profiles.js";
import {
  createCredentialVerifier,
  requireRecoveryCredential,
  timingSafeVerifierEqual
} from "./security/credential-verifier.js";

export const R2_METRIC_NAMES = Object.freeze([
  "run_starts",
  "rejected_starts",
  "active_runs",
  "cleanup_deleted",
  "resume_success",
  "resume_failure",
  "invalid_recovery_credentials",
  "stale_conflicts",
  "finalizations",
  "leaderboard_reads",
  "d1_write_failures"
]);

function recordMetric(env, options, name, value = 1, dimension = "") {
  if (!R2_METRIC_NAMES.includes(name)) return;
  const safeDimension = String(dimension || "").slice(0, 64);
  options.metrics?.increment?.(name, value, safeDimension);
  env?.RANKED_V3_METRICS?.writeDataPoint?.({
    blobs: [name, safeDimension],
    doubles: [Number(value) || 0],
    indexes: [name]
  });
}

async function enforceAbuseControlGate(env, options, actorKey) {
  if (options.rulesetEnvironment !== "production") return;
  const limiter = env?.[ABUSE_CONTROL_BINDING];
  if (!limiter || typeof limiter.limit !== "function") {
    throw new HttpError(
      503,
      "ABUSE_CONTROL_REQUIRED",
      "Production Ranked start requires configured edge abuse control."
    );
  }
  const result = await limiter.limit({ key: `ranked-start:${actorKey}` });
  if (!result?.success) {
    recordMetric(env, options, "rejected_starts", 1, "edge_rate_limit");
    throw new HttpError(
      429,
      "START_RATE_LIMITED",
      "Too many Ranked starts. Try again shortly."
    );
  }
}

function randomIdentifier(prefix, randomUUID) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function tokenPayloadForState(state, stateDigest, now) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    runId: state.runId,
    revision: state.revision,
    season: state.season,
    rulesetHash: state.rulesetHash,
    stateDigest,
    roomDirectiveId: state.roomDirective.id,
    roomNonce: state.roomDirective.roomNonce,
    issuedAt: now,
    expiresAt: now + TOKEN_TTL_MS
  };
}

function requireSecret(env) {
  const secret = String(env?.[HMAC_SECRET_BINDING] || "");
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new HttpError(503, "TOKEN_SECRET_UNAVAILABLE", "Checkpoint token signing is unavailable.");
  }
  return secret;
}

function resolveRepositories(env, options) {
  if (options.repositories) return options.repositories;
  if (!env?.DB) throw new HttpError(503, "D1_UNAVAILABLE", "D1 binding is unavailable.");
  const leaderboard = createD1LeaderboardRepository(env.DB);
  const profiles = createD1ProfileRepository(env.DB);
  const runs = createD1RunRepository(env.DB, leaderboard, profiles);
  return { runs, leaderboard, profiles };
}

function resolveRuleset(env, options, requestedHash = "") {
  return assertRulesetV3(options.ruleset || env?.RANKED_V3_RULESET, requestedHash);
}

function resolveRegisteredRuleset(options, binding) {
  if (!options.rulesetRegistry) throw new TypeError("RULESET_REGISTRY_UNAVAILABLE");
  return options.rulesetRegistry.resolve({
    rulesetId: binding.rulesetId,
    rulesetHash: binding.rulesetHash,
    environment: options.rulesetEnvironment,
    lifecycle: "ranked"
  });
}

function validateStartBody(body) {
  return {
    playerName: requireString(body.playerName, "playerName", { maximum: 18 }),
    season: requireString(body.season, "season", {
      maximum: 64,
      pattern: /^[A-Za-z0-9._:-]+$/u
    }),
    gameVersion: requireString(body.gameVersion, "gameVersion", { maximum: 32 }),
    rulesetHash: requireString(body.rulesetHash, "rulesetHash", { maximum: 128 }),
    startDepth: body.startDepth === undefined
      ? 0
      : Number.isSafeInteger(body.startDepth) && body.startDepth >= 0 && body.startDepth <= 100
      ? body.startDepth
      : (() => { throw new TypeError("startDepth is invalid"); })(),
    clientInstallIdHash: requireString(body.clientInstallIdHash, "clientInstallIdHash", {
      minimum: 16,
      maximum: 128,
      pattern: /^[A-Za-z0-9._:-]+$/u
    })
  };
}

function validatePracticeMutatorImport(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("practiceMutatorImport is invalid");
  }
  const allowedFields = ["historicalUnlockedMutatorIds", "metrics"];
  if (Object.keys(value).some((field) => !allowedFields.includes(field))) {
    throw new TypeError("practiceMutatorImport fields are invalid");
  }
  const metrics = value.metrics;
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    throw new TypeError("practiceMutatorImport metrics are invalid");
  }
  const maximumByMetric = {
    totalKills: 10_000_000,
    eliteKills: 10_000_000,
    depthHighscore: 100,
    totalGoldEarned: 1_000_000_000,
    totalMerchantPots: 1_000_000,
    shieldUsesThisGame: 1_000_000,
    potionFreeExtract: 100_000
  };
  const normalizedMetrics = {};
  for (const [metric, amount] of Object.entries(metrics)) {
    if (!Object.hasOwn(maximumByMetric, metric) || !Number.isSafeInteger(amount) || amount < 0 || amount > maximumByMetric[metric]) {
      throw new TypeError("practiceMutatorImport metrics are invalid");
    }
    normalizedMetrics[metric] = amount;
  }
  const ids = value.historicalUnlockedMutatorIds;
  if (!Array.isArray(ids) || ids.length > 10 || ids.some((id) => typeof id !== "string" || id.length < 1 || id.length > 32)) {
    throw new TypeError("practiceMutatorImport IDs are invalid");
  }
  return { metrics: normalizedMetrics, historicalUnlockedMutatorIds: [...new Set(ids)] };
}

function validateRegisteredStartBody(body) {
  rejectUnknownRequestFields(body, "start");
  return {
    ...validateStartBody(body),
    rulesetId: requireString(body.rulesetId, "rulesetId", {
      maximum: 80,
      pattern: /^[A-Za-z0-9._:-]+$/u
    }),
    profileId: requireString(body.profileId, "profileId", {
      maximum: 80,
      pattern: /^profile_[a-f0-9]{32}$/u
    }),
    profileCredential: requireRecoveryCredential(
      body.profileCredential,
      "profileCredential"
    ),
    recoveryCredential: requireRecoveryCredential(
      body.recoveryCredential,
      "recoveryCredential"
    ),
    clientProtocolVersion: body.clientProtocolVersion === undefined
      ? PROTOCOL_VERSION
      : requireString(body.clientProtocolVersion, "clientProtocolVersion", { maximum: 64 }),
    practiceMutatorImport: validatePracticeMutatorImport(body.practiceMutatorImport),
    newCampaign: body.newCampaign === undefined
      ? false
      : typeof body.newCampaign === "boolean"
        ? body.newCampaign
        : (() => { throw new TypeError("newCampaign is invalid"); })()
  };
}

function normalizeProfileCampLedger(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new TypeError("PROFILE_STATE_INVALID");
  }
  const next = structuredClone(state);
  const startedAt = next.startedAt ?? 0;
  const updatedAt = next.updatedAt ?? startedAt + next.revision;
  if (
    !Number.isSafeInteger(startedAt) ||
    startedAt < 0 ||
    !Number.isSafeInteger(updatedAt) ||
    updatedAt < startedAt
  ) {
    throw new TypeError("PROFILE_TIMESTAMPS_INVALID");
  }
  const campGold = next.campGold ?? 0;
  if (!Number.isSafeInteger(campGold) || campGold < 0) {
    throw new TypeError("PROFILE_CAMP_GOLD_INVALID");
  }
  if (!next.goldLedger || typeof next.goldLedger !== "object") {
    throw new TypeError("PROFILE_GOLD_LEDGER_INVALID");
  }
  const runGold = next.gold ?? (
    next.goldLedger.earnedServerDerived +
    next.goldLedger.earnedBoundedAttested -
    next.goldLedger.spentServerDerived
  );
  if (!Number.isSafeInteger(runGold) || runGold < 0) {
    throw new TypeError("PROFILE_RUN_GOLD_INVALID");
  }
  const earned = next.goldLedger.campEarnedServerDerived ?? 0;
  const spent = next.goldLedger.campSpentServerDerived ?? 0;
  if (
    !Number.isSafeInteger(earned) ||
    earned < 0 ||
    !Number.isSafeInteger(spent) ||
    spent < 0
  ) {
    throw new TypeError("PROFILE_CAMP_GOLD_LEDGER_INVALID");
  }
  const normalizedEarned = spent + campGold;
  if (!Number.isSafeInteger(normalizedEarned)) {
    throw new TypeError("PROFILE_CAMP_GOLD_LEDGER_INVALID");
  }
  next.campGold = campGold;
  next.gold = runGold;
  next.startedAt = startedAt;
  next.updatedAt = updatedAt;
  next.goldLedger.campEarnedServerDerived =
    earned >= spent && earned - spent === campGold ? earned : normalizedEarned;
  next.goldLedger.campSpentServerDerived = spent;
  return next;
}

function profileStateForRulesetBootstrap(profileState) {
  if (!profileState) return { carried: null, input: null };
  const carried = normalizeProfileCampLedger(profileState);
  const input = structuredClone(carried);
  input.campGold = 0;
  input.goldLedger.campEarnedServerDerived = 0;
  input.goldLedger.campSpentServerDerived = 0;
  return { carried, input };
}

async function loadRankedProfile(body, repositories, now) {
  if (!repositories.profiles) {
    throw new HttpError(503, "PROFILE_STORAGE_UNAVAILABLE", "Ranked profile storage is unavailable.");
  }
  const verifier = await createCredentialVerifier(
    body.profileCredential,
    "ranked-profile-v1"
  );
  const existing = await repositories.profiles.get(body.profileId);
  if (!existing) return { existing: null, verifier };
  if (
    existing.rulesetId !== body.rulesetId ||
    existing.rulesetHash !== body.rulesetHash ||
    existing.expiresAt <= now ||
    !timingSafeVerifierEqual(existing.credentialVerifier, verifier)
  ) {
    throw new HttpError(401, "PROFILE_UNAUTHORIZED", "Ranked profile credential is invalid.");
  }
  return { existing, verifier };
}

function validateMutationEnvelope(body) {
  return {
    ...body,
    runId: requireString(body.runId, "runId", {
      maximum: 80,
      pattern: /^run_[a-f0-9]+$/u
    }),
    checkpointToken: requireString(body.checkpointToken, "checkpointToken", {
      maximum: 4096
    }),
    roomDirectiveId: requireString(body.roomDirectiveId, "roomDirectiveId", {
      maximum: 96
    }),
    roomNonce: requireString(body.roomNonce, "roomNonce", { maximum: 128 })
  };
}

async function operationRecord({
  idempotencyKey,
  operationType,
  requestDigest,
  responseKind,
  responseStatus,
  responseBody,
  runId,
  rulesetId,
  rulesetHash,
  revisionBefore,
  resultingRevision,
  stateDigest,
  createdAt
}) {
  const retainedResponseBody = structuredClone(responseBody);
  delete retainedResponseBody.recoveryCredential;
  delete retainedResponseBody.profileCredential;
  return createCompactOperationRecord({
    operationId: idempotencyKey,
    operationType,
    requestDigest,
    responseKind,
    runId,
    rulesetId,
    rulesetHash,
    revisionBefore,
    revisionAfter: resultingRevision,
    responseStatus,
    responseBody: retainedResponseBody,
    stateDigest,
    createdAt
  });
}

async function replayOrConflict(state, idempotencyKey, requestDigest) {
  const resolution = await resolveIdempotentReplay(
    state.recentOps,
    idempotencyKey,
    requestDigest
  );
  if (resolution.kind === "conflict") {
    throw new HttpError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "Idempotency-Key was already used with a different request."
    );
  }
  if (resolution.kind === "replay") {
    return jsonResponse(resolution.responseBody, resolution.responseStatus, {
      "x-idempotent-replay": "1"
    });
  }
  return null;
}

async function verifyMutationToken(body, state, secret, now) {
  const decoded = decodeCheckpointToken(body.checkpointToken);
  if (decoded.payload.runId !== body.runId) {
    throw new HttpError(401, "TOKEN_RUN_MISMATCH", "Checkpoint token belongs to another run.");
  }
  const payload = await verifyCheckpointToken(body.checkpointToken, secret, {
    now,
    allowExpired: true,
    runId: state.runId,
    season: state.season,
    rulesetHash: state.rulesetHash
  });
  return payload;
}

function enforceCurrentToken(payload, state, now) {
  if (payload.expiresAt <= now) {
    throw new HttpError(401, "TOKEN_EXPIRED", "Checkpoint token is expired.");
  }
  if (payload.revision !== state.revision) {
    throw new HttpError(409, "REVISION_CONFLICT", "Checkpoint token revision is stale or ahead.");
  }
  if (payload.stateDigest !== state.stateDigest) {
    throw new HttpError(409, "STATE_DIGEST_CONFLICT", "Checkpoint token state digest is stale.");
  }
  if (
    payload.roomDirectiveId !== state.roomDirective.id ||
    payload.roomNonce !== state.roomDirective.roomNonce
  ) {
    throw new HttpError(409, "ROOM_TOKEN_CONFLICT", "Checkpoint token room claims are stale.");
  }
}

async function validateJournalDigest(body) {
  const commands = body.compactRoomProof?.commands;
  if (!Array.isArray(commands)) return;
  const actual = await canonicalDigest(commands);
  if (actual !== body.commandJournalDigest) {
    throw new HttpError(422, "JOURNAL_DIGEST_MISMATCH", "Command journal digest does not match.");
  }
}

function validateRegisteredRunId(value) {
  return requireString(value, "runId", {
    maximum: 80,
    pattern: /^run_[a-f0-9]+$/u
  });
}

function validateBootstrapSelectionBody(body) {
  rejectUnknownRequestFields(body, "bootstrapEvent", "BOOTSTRAP_REQUEST_FIELDS_INVALID");
  if (body.type !== "select_starting_relic") {
    throw new HttpError(422, "EVENT_TYPE_INVALID", "Starting relic event type is invalid.");
  }
  return {
    runId: validateRegisteredRunId(body.runId),
    type: body.type,
    bootstrapToken: requireString(body.bootstrapToken, "bootstrapToken", {
      maximum: 4096
    }),
    offerId: requireString(body.offerId, "offerId", { maximum: 160 }),
    choiceId: requireString(body.choiceId, "choiceId", { maximum: 160 }),
    clientProtocolVersion: body.clientProtocolVersion === undefined
      ? PROTOCOL_VERSION
      : requireString(body.clientProtocolVersion, "clientProtocolVersion", { maximum: 64 })
  };
}

function validateRegisteredRoomEnvelope(body, policyName) {
  rejectUnknownRequestFields(body, policyName);
  return {
    ...body,
    runId: validateRegisteredRunId(body.runId),
    checkpointToken: requireString(body.checkpointToken, "checkpointToken", {
      maximum: 4096
    }),
    roomDirectiveId: requireString(body.roomDirectiveId, "roomDirectiveId", {
      maximum: 160
    }),
    roomNonce: requireString(body.roomNonce, "roomNonce", { maximum: 160 }),
    clientProtocolVersion: body.clientProtocolVersion === undefined
      ? PROTOCOL_VERSION
      : requireString(body.clientProtocolVersion, "clientProtocolVersion", { maximum: 64 })
  };
}

function validateRegisteredFinalizeBody(body) {
  rejectUnknownRequestFields(body, "finalize", "FINALIZE_REQUEST_FIELDS_INVALID");
  return {
    runId: validateRegisteredRunId(body.runId),
    checkpointToken: requireString(body.checkpointToken, "checkpointToken", {
      maximum: 4096
    }),
    clientProtocolVersion: body.clientProtocolVersion === undefined
      ? PROTOCOL_VERSION
      : requireString(body.clientProtocolVersion, "clientProtocolVersion", { maximum: 64 })
  };
}

function enforceSupportedProtocol(body) {
  if (body.clientProtocolVersion !== PROTOCOL_VERSION) {
    throw new HttpError(409, "PROTOCOL_VERSION_MISMATCH", "Client protocol version is unsupported.");
  }
}

function enforceRegisteredBoundary(payload, state, kind, now) {
  if (payload.expiresAt <= now) {
    throw new HttpError(401, "TOKEN_EXPIRED", "Boundary token is expired.");
  }
  if (payload.revision !== state.revision) {
    throw new HttpError(409, "REVISION_CONFLICT", "Boundary token revision is stale or ahead.");
  }
  if (payload.stateDigest !== state.stateDigest) {
    throw new HttpError(409, "STATE_DIGEST_CONFLICT", "Boundary token state digest is stale.");
  }
  if (kind === BOUNDARY_KINDS.RUN_BOOTSTRAP) {
    if (
      state.status !== "awaiting_starting_relic" ||
      payload.startingOfferId !== state.pendingOffer?.offerId ||
      payload.bootstrapNonce !== state.bootstrapBoundary?.bootstrapNonce
    ) {
      throw new HttpError(
        409,
        "BOOTSTRAP_TOKEN_CONFLICT",
        "Bootstrap token claims are stale."
      );
    }
    return;
  }
  if (kind === BOUNDARY_KINDS.RUN_TERMINAL) {
    if (
      !["victory", "defeat", "extraction"].includes(state.status) ||
      state.currentRoomDirective ||
      state.currentRewardEnvelope ||
      state.pendingOffer ||
      state.pendingRelicTransaction ||
      state.pendingInventory
    ) {
      throw new HttpError(
        409,
        "TERMINAL_TOKEN_CONFLICT",
        "Terminal token claims are stale."
      );
    }
    return;
  }
  if (
    state.status !== "active" ||
    payload.roomDirectiveId !== state.currentRoomDirective?.directiveId ||
    payload.roomNonce !== state.currentRoomDirective?.roomNonce
  ) {
    throw new HttpError(409, "ROOM_TOKEN_CONFLICT", "Room token claims are stale.");
  }
}

async function loadRegisteredMutationContext({
  request,
  env,
  options,
  repositories,
  path,
  body,
  token,
  boundaryKind
}) {
  const idempotencyKey = requireIdempotencyKey(request);
  const requestDigest = await canonicalDigest({ method: request.method, path, body });
  const decoded = decodeBoundaryToken(token);
  if (decoded.payload.runId !== body.runId) {
    throw new HttpError(401, "TOKEN_RUN_MISMATCH", "Boundary token belongs to another run.");
  }
  const state = await repositories.runs.get(body.runId);
  if (!state) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found.");
  const ruleset = resolveRegisteredRuleset(options, state);
  const secret = requireSecret(env);
  const now = options.now();
  const tokenPayload = await verifyBoundaryToken(token, secret, {
    now,
    allowExpired: true,
    boundaryKind,
    runId: state.runId,
    rulesetId: state.rulesetId,
    rulesetHash: state.rulesetHash
  });
  const replay = await replayOrConflict(state, idempotencyKey, requestDigest);
  if (replay) return { replay };
  enforceRegisteredBoundary(tokenPayload, state, boundaryKind, now);
  return {
    body,
    idempotencyKey,
    requestDigest,
    state,
    ruleset,
    secret,
    now
  };
}

async function persistRegisteredMutation(context, transition, repositories, options = {}) {
  const nextState = {
    ...transition.nextState,
    updatedAt: context.now
  };
  const stateDigest = await canonicalDigest(stateForDigest(nextState));
  let checkpointToken = null;
  if (nextState.status === "active" && nextState.currentRoomDirective) {
    checkpointToken = await signBoundaryToken(
      roomTokenPayloadForState(nextState, stateDigest, context.now),
      context.secret
    );
  } else if (["victory", "defeat", "extraction"].includes(nextState.status)) {
    checkpointToken = await signBoundaryToken(
      terminalTokenPayloadForState(nextState, stateDigest, context.now),
      context.secret
    );
  }
  let profileMutation = null;
  if (options.profileExtraction === true) {
    const currentProfile = await repositories.profiles?.get(nextState.profileId);
    if (!currentProfile) {
      throw new HttpError(409, "PROFILE_NOT_FOUND", "Ranked profile is unavailable.");
    }
    const profileRevision = currentProfile.revision + 1;
    const profileState = normalizeProfileCampLedger(
      context.ruleset.profileStateFromRun(
        nextState,
        nextState.profileId,
        profileRevision
      )
    );
    profileMutation = {
      expectedRevision: currentProfile.revision,
      next: {
        ...currentProfile,
        revision: profileRevision,
        state: profileState,
        updatedAt: context.now,
        expiresAt: context.now + PROFILE_TTL_MS
      }
    };
  }
  const responseBody = {
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    ...transition.response,
    runId: nextState.runId,
    revision: nextState.revision,
    publicStateDigest: stateDigest,
    ...(checkpointToken ? { checkpointToken } : {}),
    metaState: publicRulesetMetaState(nextState, context.ruleset),
    ...(profileMutation
      ? { profile: context.ruleset.publicProfileState(profileMutation.next.state) }
      : {})
  };
  const operationType = options.operationType || "mutation";
  const recentOps = await appendVersionedRecentOperation(
    context.state.recentOps,
    await operationRecord({
      idempotencyKey: context.idempotencyKey,
      operationType,
      requestDigest: context.requestDigest,
      responseKind: options.responseKind || operationType,
      responseStatus: 200,
      responseBody,
      runId: nextState.runId,
      rulesetId: nextState.rulesetId,
      rulesetHash: nextState.rulesetHash,
      revisionBefore: context.state.revision,
      resultingRevision: nextState.revision,
      stateDigest,
      createdAt: context.now
    }),
    RECENT_OPS_LIMIT
  );
  const metadata = {
    stateDigest,
    recentOps,
    expectedStateDigest: context.state.stateDigest,
    expectedStatus: context.state.status
  };
  const leaderboardSnapshot = options.leaderboardSnapshot || options.leaderboardEntry;
  const persisted = profileMutation && leaderboardSnapshot
    ? await repositories.runs.updateWithProfileAndLeaderboardAtomic(
        nextState,
        context.state.revision,
        metadata,
        profileMutation.next,
        profileMutation.expectedRevision,
        {
          ...leaderboardSnapshot,
          stateDigest
        }
      )
    : profileMutation
      ? await repositories.runs.updateWithProfileAtomic(
        nextState,
        context.state.revision,
        metadata,
        profileMutation.next,
        profileMutation.expectedRevision
      )
    : leaderboardSnapshot
      ? await repositories.runs.updateWithLeaderboardAtomic(
          nextState,
          context.state.revision,
          metadata,
          {
            ...leaderboardSnapshot,
            stateDigest
          }
        )
      : await repositories.runs.updateConditional(
          nextState,
          context.state.revision,
          metadata
        );
  if (!persisted) {
    throw new HttpError(409, "REVISION_CONFLICT", "Run changed before this operation committed.");
  }
  return jsonResponse(responseBody, 200);
}

function validateProfileCampBody(body) {
  const allowed = [
    "profileId",
    "profileCredential",
    "rulesetId",
    "rulesetHash",
    "clientProtocolVersion",
    "action",
    "transactionId",
    "choiceId"
  ];
  if (Object.keys(body).some((field) => !allowed.includes(field))) {
    throw new HttpError(400, "PROFILE_CAMP_REQUEST_FIELDS_INVALID", "Camp request fields are invalid.");
  }
  const action = requireString(body.action, "action", { maximum: 32 });
  if (!["open", "commit", "close"].includes(action)) {
    throw new HttpError(422, "PROFILE_CAMP_ACTION_INVALID", "Camp action is invalid.");
  }
  return {
    profileId: requireString(body.profileId, "profileId", {
      maximum: 80,
      pattern: /^profile_[a-f0-9]{32}$/u
    }),
    profileCredential: requireRecoveryCredential(body.profileCredential, "profileCredential"),
    rulesetId: requireString(body.rulesetId, "rulesetId", { maximum: 80 }),
    rulesetHash: requireString(body.rulesetHash, "rulesetHash", { maximum: 128 }),
    clientProtocolVersion: requireString(body.clientProtocolVersion, "clientProtocolVersion", { maximum: 64 }),
    action,
    ...(action === "commit"
      ? {
          transactionId: requireString(body.transactionId, "transactionId", { maximum: 192 }),
          choiceId: requireString(body.choiceId, "choiceId", { maximum: 192 })
        }
      : {})
  };
}

async function handleProfileCamp(request, env, options, repositories) {
  const idempotencyKey = requireIdempotencyKey(request);
  const body = validateProfileCampBody(await readJsonRequest(request));
  if (body.clientProtocolVersion !== PROTOCOL_VERSION) {
    throw new HttpError(409, "PROTOCOL_VERSION_MISMATCH", "Client protocol version is unsupported.");
  }
  const now = options.now();
  const access = await loadRankedProfile(body, repositories, now);
  const current = access.existing;
  if (!current) throw new HttpError(404, "PROFILE_NOT_FOUND", "Ranked profile not found.");
  if (!current.state?.lastExtractedRunId) {
    throw new HttpError(409, "CAMP_EXTRACTION_REQUIRED", "Camp requires a canonical extraction.");
  }
  const extractedRun = await repositories.runs.get(current.state.lastExtractedRunId);
  if (!extractedRun || extractedRun.status !== "finalized") {
    throw new HttpError(409, "CAMP_FINALIZATION_REQUIRED", "Finalize the extracted run before opening Camp.");
  }
  const requestDigest = await canonicalDigest({
    method: request.method,
    path: "/api/v3/profiles/camp",
    body
  });
  const replay = await replayOrConflict(current, idempotencyKey, requestDigest);
  if (replay) return replay;
  const ruleset = resolveRegisteredRuleset(options, current);
  let state = normalizeProfileCampLedger(current.state);
  if (body.action === "open") {
    state.revision += 1;
    state = await ruleset.beginCampSession(state, { secret: requireSecret(env) });
    state = await ruleset.issueCampTransactions(state, { secret: requireSecret(env) });
  } else if (body.action === "commit") {
    state = await ruleset.commitCampTransaction(state, {
      transactionId: body.transactionId,
      choiceId: body.choiceId
    }, { secret: requireSecret(env) });
    state.revision += 1;
  } else {
    if (state.pendingInventory) {
      throw new HttpError(409, "CAMP_TRANSACTION_PENDING", "Resolve the current Camp choice before closing.");
    }
    state.campSession = null;
    state.revision += 1;
  }
  const publicProfile = ruleset.publicProfileState(state);
  const responseBody = {
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    profileId: current.profileId,
    revision: state.revision,
    profile: publicProfile,
    metaState: publicProfile,
    metaTransactionOffer: ruleset.projectPublicCampTransactions(state)
  };
  const stateDigest = await canonicalDigest(state);
  const recentOps = await appendVersionedRecentOperation(
    current.recentOps,
    await operationRecord({
      idempotencyKey,
      operationType: `profile_camp_${body.action}`,
      requestDigest,
      responseKind: `profile_camp_${body.action}`,
      responseStatus: 200,
      responseBody,
      runId: current.profileId,
      rulesetId: current.rulesetId,
      rulesetHash: current.rulesetHash,
      revisionBefore: current.revision,
      resultingRevision: current.revision + 1,
      stateDigest,
      createdAt: now
    }),
    RECENT_OPS_LIMIT
  );
  const next = {
    ...current,
    revision: current.revision + 1,
    state,
    recentOps,
    updatedAt: now,
    expiresAt: now + PROFILE_TTL_MS
  };
  if (!await repositories.profiles.updateConditional(next, current.revision)) {
    throw new HttpError(409, "PROFILE_REVISION_CONFLICT", "Ranked profile changed before Camp committed.");
  }
  return jsonResponse(responseBody, 200);
}

function validateResumeBody(body) {
  const allowed = [
    "operationId",
    "runId",
    "recoveryCredential",
    "clientProtocolVersion",
    "lastKnownRevision"
  ];
  if (Object.keys(body).some((field) => !allowed.includes(field))) {
    throw new HttpError(400, "RESUME_REQUEST_FIELDS_INVALID", "Resume request fields are invalid.");
  }
  const lastKnownRevision = Number(body.lastKnownRevision);
  if (!Number.isSafeInteger(lastKnownRevision) || lastKnownRevision < 0) {
    throw new HttpError(400, "RESUME_REVISION_INVALID", "Resume revision is invalid.");
  }
  let recoveryCredential;
  try {
    recoveryCredential = requireRecoveryCredential(body.recoveryCredential);
  } catch {
    throw new HttpError(400, "RECOVERY_CREDENTIAL_INVALID", "Recovery credential is invalid.");
  }
  return {
    operationId: requireString(body.operationId, "operationId", {
      maximum: 96,
      pattern: /^op_[a-f0-9]{32}$/u
    }),
    runId: validateRegisteredRunId(body.runId),
    recoveryCredential,
    clientProtocolVersion: requireString(body.clientProtocolVersion, "clientProtocolVersion", { maximum: 64 }),
    lastKnownRevision
  };
}

async function handleRegisteredResume(request, env, options, repositories) {
  const idempotencyKey = requireIdempotencyKey(request);
  const body = validateResumeBody(await readJsonRequest(request));
  if (body.operationId !== idempotencyKey) {
    throw new HttpError(400, "RESUME_OPERATION_ID_MISMATCH", "Resume operation identity is inconsistent.");
  }
  if (body.clientProtocolVersion !== PROTOCOL_VERSION) {
    throw new HttpError(409, "PROTOCOL_VERSION_MISMATCH", "Client protocol version is unsupported.");
  }
  const recovery = await repositories.runs.getRecovery(body.runId);
  if (!recovery) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found.");
  const state = recovery.state;
  const expectedVerifier = await createCredentialVerifier(
    body.recoveryCredential,
    `ranked-run-recovery-v1:${state.runId}:${state.rulesetHash}`
  );
  if (!recovery.recoveryVerifier || !timingSafeVerifierEqual(
    recovery.recoveryVerifier,
    expectedVerifier
  )) {
    recordMetric(env, options, "invalid_recovery_credentials", 1, "resume");
    recordMetric(env, options, "resume_failure", 1, "unauthorized");
    throw new HttpError(401, "RECOVERY_UNAUTHORIZED", "Run recovery credential is invalid.");
  }
  const now = options.now();
  if (state.expiresAt <= now || ["expired", "abandoned"].includes(state.status)) {
    throw new HttpError(410, "RUN_RECOVERY_UNAVAILABLE", "Run recovery retention has ended.");
  }
  const ruleset = resolveRegisteredRuleset(options, state);
  const secret = requireSecret(env);
  const stateDigest = state.stateDigest || await canonicalDigest(stateForDigest(state));
  let tokenField = null;
  let token = null;
  if (state.status === "awaiting_starting_relic") {
    tokenField = "bootstrapToken";
    token = await signBoundaryToken(
      bootstrapTokenPayloadForState(state, stateDigest, now),
      secret
    );
  } else if (state.status === "active") {
    tokenField = "checkpointToken";
    token = await signBoundaryToken(
      roomTokenPayloadForState(state, stateDigest, now),
      secret
    );
  } else if (["victory", "defeat", "extraction"].includes(state.status)) {
    tokenField = "checkpointToken";
    token = await signBoundaryToken(
      terminalTokenPayloadForState(state, stateDigest, now),
      secret
    );
  } else if (state.status !== "finalized") {
    throw new HttpError(409, "RUN_RECOVERY_STATE_UNSUPPORTED", "Run cannot be resumed from this state.");
  }
  const responseBody = {
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    acceptedBoundary: "run_resumed",
    runId: state.runId,
    revision: state.revision,
    publicStateDigest: stateDigest,
    ...(tokenField ? { [tokenField]: token } : {}),
    metaState: publicRulesetMetaState(state, ruleset),
    ...(state.status === "finalized" ? { leaderboardEntryId: state.runId } : {})
  };
  recordMetric(env, options, "resume_success", 1, state.status);
  return jsonResponse(responseBody, 200, { "cache-control": "no-store" });
}

async function handleRegisteredAbandon(request, env, options, repositories) {
  const idempotencyKey = requireIdempotencyKey(request);
  const body = validateResumeBody(await readJsonRequest(request));
  if (body.operationId !== idempotencyKey) {
    throw new HttpError(400, "ABANDON_OPERATION_ID_MISMATCH", "Abandon operation identity is inconsistent.");
  }
  const recovery = await repositories.runs.getRecovery(body.runId);
  if (!recovery) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found.");
  const state = recovery.state;
  const verifier = await createCredentialVerifier(
    body.recoveryCredential,
    `ranked-run-recovery-v1:${state.runId}:${state.rulesetHash}`
  );
  if (!recovery.recoveryVerifier || !timingSafeVerifierEqual(recovery.recoveryVerifier, verifier)) {
    throw new HttpError(401, "RECOVERY_UNAUTHORIZED", "Run recovery credential is invalid.");
  }
  const requestDigest = await canonicalDigest({
    method: request.method,
    path: "/api/v3/runs/abandon",
    body
  });
  const replay = await replayOrConflict(state, idempotencyKey, requestDigest);
  if (replay) return replay;
  if (state.status === "finalized") {
    throw new HttpError(409, "FINALIZED_RUN_IMMUTABLE", "A finalized run cannot be abandoned.");
  }
  if (state.status === "abandoned") {
    const ruleset = resolveRegisteredRuleset(options, state);
    return jsonResponse({
      ok: true,
      protocolVersion: PROTOCOL_VERSION,
      acceptedBoundary: "run_abandoned",
      runId: state.runId,
      revision: state.revision,
      metaState: publicRulesetMetaState(state, ruleset)
    }, 200, {
      "cache-control": "no-store",
      "x-idempotent-replay": "1"
    });
  }
  const now = options.now();
  const nextState = {
    ...state,
    status: "abandoned",
    revision: state.revision + 1,
    currentRoomDirective: null,
    currentRewardEnvelope: null,
    pendingOffer: null,
    pendingRelicTransaction: null,
    pendingInventory: null,
    updatedAt: now,
    expiresAt: now + ABANDONED_RUN_TTL_MS,
    outcome: "abandoned"
  };
  const ruleset = resolveRegisteredRuleset(options, state);
  const stateDigest = await canonicalDigest(stateForDigest(nextState));
  const responseBody = {
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    acceptedBoundary: "run_abandoned",
    runId: nextState.runId,
    revision: nextState.revision,
    metaState: publicRulesetMetaState(nextState, ruleset)
  };
  const recentOps = await appendVersionedRecentOperation(
    state.recentOps,
    await operationRecord({
      idempotencyKey,
      operationType: "abandon",
      requestDigest,
      responseKind: "run_abandoned",
      responseStatus: 200,
      responseBody,
      runId: state.runId,
      rulesetId: state.rulesetId,
      rulesetHash: state.rulesetHash,
      revisionBefore: state.revision,
      resultingRevision: nextState.revision,
      stateDigest,
      createdAt: now
    }),
    RECENT_OPS_LIMIT
  );
  const persisted = await repositories.runs.updateConditional(
    nextState,
    state.revision,
    {
      stateDigest,
      recentOps,
      expectedStateDigest: state.stateDigest,
      expectedStatus: state.status
    }
  );
  if (!persisted) {
    throw new HttpError(409, "REVISION_CONFLICT", "Run changed before abandonment committed.");
  }
  return jsonResponse(responseBody, 200);
}

async function handleRegisteredStart(request, env, options, repositories) {
  const idempotencyKey = requireIdempotencyKey(request);
  const body = validateRegisteredStartBody(await readJsonRequest(request));
  enforceSupportedProtocol(body);
  await enforceAbuseControlGate(env, options, body.profileId);
  const ruleset = resolveRegisteredRuleset(options, body);
  const secret = requireSecret(env);
  const requestDigest = await canonicalDigest({
    method: request.method,
    path: "/api/v3/runs/start",
    body
  });
  const priorStart = await repositories.runs.findByStartOperation(idempotencyKey);
  if (priorStart) {
    const replay = await replayOrConflict(priorStart, idempotencyKey, requestDigest);
    if (replay) return replay;
  }
  const now = options.now();
  const profileAccess = await loadRankedProfile(body, repositories, now);
  if (body.practiceMutatorImport && profileAccess.existing && !body.newCampaign) {
    const importedState = ruleset.applyPracticeMutatorImportToProfile(
      profileAccess.existing.state,
      body.practiceMutatorImport,
      { now }
    );
    if (JSON.stringify(importedState) !== JSON.stringify(profileAccess.existing.state)) {
      const importedProfile = {
        ...profileAccess.existing,
        revision: profileAccess.existing.revision + 1,
        state: importedState,
        updatedAt: now,
        expiresAt: now + PROFILE_TTL_MS
      };
      if (!await repositories.profiles.updateConditional(importedProfile, profileAccess.existing.revision)) {
        throw new HttpError(409, "PROFILE_REVISION_CONFLICT", "Ranked profile changed before Practice import committed.");
      }
      profileAccess.existing = importedProfile;
    }
  }
  const activeRuns = await repositories.profiles.countActiveRuns(body.profileId, now);
  recordMetric(env, options, "active_runs", activeRuns, "start");
  if (activeRuns >= MAX_ACTIVE_RUNS_PER_PROFILE) {
    recordMetric(env, options, "rejected_starts", 1, "active_run_cap");
    throw new HttpError(429, "ACTIVE_RUN_LIMIT", "The Ranked profile has too many active runs.");
  }
  const runId = randomIdentifier("run", options.randomUUID);
  const recoveryVerifier = await createCredentialVerifier(
    body.recoveryCredential,
    `ranked-run-recovery-v1:${runId}:${body.rulesetHash}`
  );
  const profileBootstrap = profileStateForRulesetBootstrap(
    profileAccess.existing?.state || null
  );
  const transition = await createAuthenticatedRunBootstrap(body, {
    ruleset,
    secret,
    now,
    runId,
    bootstrapNonce: randomIdentifier("bootstrap", options.randomUUID),
    profileId: body.profileId,
    profileState: profileBootstrap.input
  });
  const state = transition.nextState;
  if (profileBootstrap.carried) {
    state.campGold = profileBootstrap.carried.campGold;
    state.goldLedger.campEarnedServerDerived =
      profileBootstrap.carried.goldLedger.campEarnedServerDerived;
    state.goldLedger.campSpentServerDerived =
      profileBootstrap.carried.goldLedger.campSpentServerDerived;
  }
  const stateDigest = await canonicalDigest(stateForDigest(state));
  let boundaryToken;
  let boundaryField;
  if (state.status === "awaiting_starting_relic") {
    boundaryToken = await signBoundaryToken(
      bootstrapTokenPayloadForState(state, stateDigest, now),
      secret
    );
    boundaryField = "bootstrapToken";
  } else {
    boundaryToken = await signBoundaryToken(
      roomTokenPayloadForState(state, stateDigest, now),
      secret
    );
    boundaryField = "checkpointToken";
  }
  let profile = profileAccess.existing;
  if (profile && body.newCampaign) {
    const resetState = ruleset.createInitialProfileState(state, body.profileId);
    const resetProfile = {
      ...profile,
      revision: profile.revision + 1,
      state: resetState,
      updatedAt: now,
      expiresAt: now + PROFILE_TTL_MS
    };
    if (!await repositories.profiles.updateConditional(resetProfile, profile.revision)) {
      throw new HttpError(409, "PROFILE_REVISION_CONFLICT", "Ranked profile changed before campaign reset committed.");
    }
    profile = resetProfile;
  }
  if (!profile) {
    profile = {
      profileId: body.profileId,
      rulesetId: body.rulesetId,
      rulesetHash: body.rulesetHash,
      credentialVerifier: profileAccess.verifier,
      revision: 0,
      state: ruleset.createInitialProfileState(state, body.profileId),
      recentOps: createRecentOperationsV2(),
      createdAt: now,
      updatedAt: now,
      expiresAt: now + PROFILE_TTL_MS
    };
    await repositories.profiles.insert(profile);
  }
  const responseBody = {
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    runId: state.runId,
    revision: state.revision,
    [boundaryField]: boundaryToken,
    publicStateDigest: stateDigest,
    metaState: publicRulesetMetaState(state, ruleset),
    profile: ruleset.publicProfileState(profile.state)
  };
  const recentOps = await appendVersionedRecentOperation(
    createRecentOperationsV2(),
    await operationRecord({
      idempotencyKey,
      operationType: "start",
      requestDigest,
      responseKind: state.status === "active" ? "profile_run_started" : "run_bootstrap",
      responseStatus: 201,
      responseBody,
      runId: state.runId,
      rulesetId: state.rulesetId,
      rulesetHash: state.rulesetHash,
      revisionBefore: state.revision,
      resultingRevision: state.revision,
      stateDigest,
      createdAt: now
    }),
    RECENT_OPS_LIMIT
  );
  try {
    await repositories.runs.insert(state, {
      stateDigest,
      recentOps,
      startIdempotencyKey: idempotencyKey,
      startRequestDigest: requestDigest,
      recoveryVerifier,
      recoveryIssuedAt: now
    });
  } catch (cause) {
    if (cause?.code !== "START_OPERATION_CONFLICT") throw cause;
    const existing = await repositories.runs.findByStartOperation(idempotencyKey);
    if (!existing) throw cause;
    const replay = await replayOrConflict(existing, idempotencyKey, requestDigest);
    if (replay) return replay;
    throw new HttpError(
      409,
      "IDEMPOTENCY_WINDOW_EXPIRED",
      "The original start response is outside retained retry history."
    );
  }
  recordMetric(env, options, "run_starts", 1, "accepted");
  return jsonResponse(responseBody, 201);
}
async function handleRegisteredEvent(request, env, options, repositories) {
  const rawBody = await readJsonRequest(request);
  if (["begin_camp_session", "open_camp_offer"].includes(rawBody.type)) {
    throw new HttpError(409, "CAMP_EXTRACTION_REQUIRED", "Ranked Camp is available only through an extracted profile.");
  }
  if (rawBody.type === "select_starting_relic") {
    const body = validateBootstrapSelectionBody(rawBody);
    enforceSupportedProtocol(body);
    const context = await loadRegisteredMutationContext({
      request,
      env,
      options,
      repositories,
      path: "/api/v3/runs/event",
      body,
      token: body.bootstrapToken,
      boundaryKind: BOUNDARY_KINDS.RUN_BOOTSTRAP
    });
    if (context.replay) return context.replay;
    const transition = await selectAuthenticatedStartingRelic(
      context.state,
      { offerId: body.offerId, choiceId: body.choiceId },
      {
        ruleset: context.ruleset,
        secret: context.secret
      }
    );
    return persistRegisteredMutation(context, transition, repositories, {
      operationType: "select_starting_relic",
      responseKind: "starting_relic_selected"
    });
  }
  const body = validateRegisteredRoomEnvelope(rawBody, "roomEvent");
  enforceSupportedProtocol(body);
  const context = await loadRegisteredMutationContext({
    request,
    env,
    options,
    repositories,
    path: "/api/v3/runs/event",
    body,
    token: body.checkpointToken,
    boundaryKind: BOUNDARY_KINDS.ROOM_CHECKPOINT
  });
  if (context.replay) return context.replay;
  if (
    body.roomDirectiveId !== context.state.currentRoomDirective?.directiveId ||
    body.roomNonce !== context.state.currentRoomDirective?.roomNonce
  ) {
    throw new HttpError(409, "ROOM_TOKEN_CONFLICT", "Room request claims are stale.");
  }
  const transition = await applyRulesetEvent(
    context.state,
    body,
    context.ruleset,
    { secret: context.secret, now: context.now }
  );
  const snapshotEffect = transition.storageEffects.find(
    (effect) => effect.type === "upsert_leaderboard_snapshot"
  );
  return persistRegisteredMutation(context, transition, repositories, {
    operationType: "event",
    responseKind: body.type,
    profileExtraction: body.type === "request_extraction",
    leaderboardSnapshot: snapshotEffect?.entry
  });
}

async function handleRegisteredCheckpoint(request, env, options, repositories) {
  const body = validateRegisteredRoomEnvelope(await readJsonRequest(request), "checkpoint");
  enforceSupportedProtocol(body);
  const context = await loadRegisteredMutationContext({
    request,
    env,
    options,
    repositories,
    path: "/api/v3/runs/checkpoint",
    body,
    token: body.checkpointToken,
    boundaryKind: BOUNDARY_KINDS.ROOM_CHECKPOINT
  });
  if (context.replay) return context.replay;
  if (
    body.roomDirectiveId !== context.state.currentRoomDirective?.directiveId ||
    body.roomNonce !== context.state.currentRoomDirective?.roomNonce
  ) {
    throw new HttpError(409, "ROOM_TOKEN_CONFLICT", "Room request claims are stale.");
  }
  await validateJournalDigest(body);
  const transition = await applyRulesetCheckpoint(
    context.state,
    body,
    context.ruleset,
    { secret: context.secret }
  );
  return persistRegisteredMutation(context, transition, repositories, {
    operationType: "checkpoint",
    responseKind: "checkpoint"
  });
}

async function handleRegisteredFinalize(request, env, options, repositories) {
  const body = validateRegisteredFinalizeBody(await readJsonRequest(request));
  enforceSupportedProtocol(body);
  const context = await loadRegisteredMutationContext({
    request,
    env,
    options,
    repositories,
    path: "/api/v3/runs/finalize",
    body,
    token: body.checkpointToken,
    boundaryKind: BOUNDARY_KINDS.RUN_TERMINAL
  });
  if (context.replay) return context.replay;
  const transition = finalizeRulesetRun(
    context.state,
    context.ruleset,
    { now: context.now }
  );
  const leaderboardEffect = transition.storageEffects.find(
    (effect) => effect.type === "upsert_leaderboard_snapshot"
  );
  recordMetric(env, options, "finalizations", 1, transition.nextState.outcome || "terminal");
  return persistRegisteredMutation(context, transition, repositories, {
    operationType: "finalize",
    responseKind: "finalize",
    leaderboardSnapshot: leaderboardEffect?.entry
  });
}

async function handleStart(request, env, options, repositories) {
  const idempotencyKey = requireIdempotencyKey(request);
  const body = validateStartBody(await readJsonRequest(request));
  const ruleset = resolveRuleset(env, options, body.rulesetHash);
  const secret = requireSecret(env);
  const requestDigest = await canonicalDigest({
    method: request.method,
    path: "/api/v3/runs/start",
    body
  });
  const now = options.now();
  const transition = createInitialRun(body, {
    ruleset,
    now,
    runId: randomIdentifier("run", options.randomUUID),
    roomDirectiveId: randomIdentifier("directive", options.randomUUID),
    roomNonce: randomIdentifier("nonce", options.randomUUID)
  });
  const state = transition.nextState;
  const stateDigest = await canonicalDigest(stateForDigest(state));
  const checkpointToken = await signCheckpointToken(
    tokenPayloadForState(state, stateDigest, now),
    secret
  );
  const responseBody = {
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    runId: state.runId,
    revision: state.revision,
    checkpointToken,
    metaState: publicMetaState(state)
  };
  const recentOps = await appendVersionedRecentOperation(
    createRecentOperationsV2(),
    await operationRecord({
    idempotencyKey,
    operationType: "start",
    requestDigest,
    responseKind: "start",
    responseStatus: 201,
    responseBody,
    runId: state.runId,
    rulesetId: ruleset.rulesetId || "",
    rulesetHash: state.rulesetHash,
    revisionBefore: state.revision,
    resultingRevision: state.revision,
    stateDigest,
    createdAt: now
  }), RECENT_OPS_LIMIT);

  try {
    await repositories.runs.insert(state, {
      stateDigest,
      recentOps,
      startIdempotencyKey: idempotencyKey,
      startRequestDigest: requestDigest
    });
  } catch (cause) {
    if (cause?.code !== "START_OPERATION_CONFLICT") throw cause;
    const existing = await repositories.runs.findByStartOperation(idempotencyKey);
    if (!existing) throw cause;
    const replay = await replayOrConflict(existing, idempotencyKey, requestDigest);
    if (replay) return replay;
    throw new HttpError(
      409,
      "IDEMPOTENCY_WINDOW_EXPIRED",
      "The original start response is outside retained retry history."
    );
  }
  return jsonResponse(responseBody, 201);
}

async function loadMutationContext(request, env, options, repositories, path) {
  const idempotencyKey = requireIdempotencyKey(request);
  const body = validateMutationEnvelope(await readJsonRequest(request));
  const requestDigest = await canonicalDigest({ method: request.method, path, body });
  const decoded = decodeCheckpointToken(body.checkpointToken);
  if (decoded.payload.runId !== body.runId) {
    throw new HttpError(401, "TOKEN_RUN_MISMATCH", "Checkpoint token belongs to another run.");
  }
  const state = await repositories.runs.get(body.runId);
  if (!state) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found.");
  const ruleset = resolveRuleset(env, options, state.rulesetHash);
  const secret = requireSecret(env);
  const now = options.now();
  const tokenPayload = await verifyMutationToken(body, state, secret, now);
  const replay = await replayOrConflict(state, idempotencyKey, requestDigest);
  if (replay) return { replay };
  enforceCurrentToken(tokenPayload, state, now);
  return {
    body,
    idempotencyKey,
    requestDigest,
    state,
    ruleset,
    secret,
    now
  };
}

async function persistMutation(context, transition, repositories, options = {}) {
  const nextState = {
    ...transition.nextState,
    updatedAt: context.now
  };
  const stateDigest = await canonicalDigest(stateForDigest(nextState));
  let checkpointToken = null;
  if (nextState.status === "active") {
    checkpointToken = await signCheckpointToken(
      tokenPayloadForState(nextState, stateDigest, context.now),
      context.secret
    );
  }
  const responseBody = {
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    ...transition.response,
    runId: nextState.runId,
    revision: nextState.revision,
    ...(checkpointToken ? { checkpointToken } : {}),
    metaState: publicMetaState(nextState)
  };
  const operationType = options.operationType || "mutation";
  const recentOps = await appendVersionedRecentOperation(
    context.state.recentOps,
    await operationRecord({
      idempotencyKey: context.idempotencyKey,
      operationType,
      requestDigest: context.requestDigest,
      responseKind: options.responseKind || operationType,
      responseStatus: 200,
      responseBody,
      runId: nextState.runId,
      rulesetId: context.ruleset.rulesetId || "",
      rulesetHash: nextState.rulesetHash,
      revisionBefore: context.state.revision,
      resultingRevision: nextState.revision,
      stateDigest,
      createdAt: context.now
    }),
    RECENT_OPS_LIMIT
  );
  let persisted;
  if (options.leaderboardEntry) {
    persisted = await repositories.runs.finalizeAtomic(
      nextState,
      context.state.revision,
      {
        stateDigest,
        recentOps,
        expectedStateDigest: context.state.stateDigest,
        expectedStatus: context.state.status
      },
      {
        ...options.leaderboardEntry,
        stateDigest
      }
    );
  } else {
    persisted = await repositories.runs.updateConditional(
      nextState,
      context.state.revision,
      {
        stateDigest,
        recentOps,
        expectedStateDigest: context.state.stateDigest,
        expectedStatus: context.state.status
      }
    );
  }
  if (!persisted) {
    throw new HttpError(409, "REVISION_CONFLICT", "Run changed before this operation committed.");
  }
  return jsonResponse(responseBody, 200);
}

async function handleCheckpoint(request, env, options, repositories) {
  const context = await loadMutationContext(
    request,
    env,
    options,
    repositories,
    "/api/v3/runs/checkpoint"
  );
  if (context.replay) return context.replay;
  await validateJournalDigest(context.body);
  const transition = applyCheckpoint({
    ...context.state,
    stateDigest: undefined,
    recentOps: undefined
  }, {
    ...context.body,
    nextRoomDirectiveId: randomIdentifier("directive", options.randomUUID),
    nextRoomNonce: randomIdentifier("nonce", options.randomUUID)
  }, context.ruleset);
  return persistMutation(context, transition, repositories, {
    operationType: "checkpoint",
    responseKind: "checkpoint"
  });
}

async function handleEvent(request, env, options, repositories) {
  const context = await loadMutationContext(
    request,
    env,
    options,
    repositories,
    "/api/v3/runs/event"
  );
  if (context.replay) return context.replay;
  const transition = applyMetaEvent({
    ...context.state,
    stateDigest: undefined,
    recentOps: undefined
  }, context.body, context.ruleset);
  return persistMutation(context, transition, repositories, {
    operationType: "event",
    responseKind: context.body.type
  });
}

async function handleFinalize(request, env, options, repositories) {
  const context = await loadMutationContext(
    request,
    env,
    options,
    repositories,
    "/api/v3/runs/finalize"
  );
  if (context.replay) return context.replay;
  const transition = finalizeRun({
    ...context.state,
    stateDigest: undefined,
    recentOps: undefined
  }, {
    ...context.body,
    now: context.now
  }, context.ruleset);
  const leaderboardEffect = transition.storageEffects.find(
    (effect) => effect.type === "upsert_leaderboard_snapshot"
  );
  return persistMutation(context, transition, repositories, {
    operationType: "finalize",
    responseKind: "finalize",
    leaderboardEntry: leaderboardEffect?.entry
  });
}

async function handleLeaderboard(url, repositories, env, options) {
  const query = parseLeaderboardQuery(url);
  recordMetric(env, options, "leaderboard_reads", 1, "list");
  const page = await repositories.leaderboard.list(query.season, query);
  return jsonResponse({ ok: true, season: query.season, ...page });
}

async function handleLeaderboardDetail(runId, repositories, env, options) {
  recordMetric(env, options, "leaderboard_reads", 1, "detail");
  const detail = await repositories.leaderboard.detail(runId);
  if (!detail) throw new HttpError(404, "LEADERBOARD_ENTRY_NOT_FOUND", "Entry not found.");
  return jsonResponse({ ok: true, entry: detail });
}

function handleAvailability(url, options) {
  const activation = options.productionActivation;
  const requestedVersion = String(url.searchParams.get("clientProtocolVersion") || "");
  const compatible = !requestedVersion || requestedVersion === PROTOCOL_VERSION;
  return jsonResponse({
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    supportedClientProtocolVersions: [PROTOCOL_VERSION],
    requestSchemaPolicy: {
      version: REQUEST_SCHEMA_POLICY_VERSION,
      mutationPolicy: "reject_unknown_fields",
      endpoints: Object.keys(REGISTERED_MUTATION_FIELDS)
    },
    compatible,
    availability: activation
      ? "active"
      : options.rulesetEnvironment === "production"
      ? "production_gated"
      : "test_only",
    productionActivated: Boolean(activation),
    ...(activation || {})
  }, compatible ? 200 : 409, { "cache-control": "no-store" });
}

export function createWorker(workerOptions = {}) {
  const options = {
    ruleset: workerOptions.ruleset,
    rulesetRegistry: workerOptions.rulesetRegistry,
    rulesetEnvironment: workerOptions.rulesetEnvironment || "test",
    repositories: workerOptions.repositories,
    metrics: workerOptions.metrics,
    onError: workerOptions.onError,
    now: workerOptions.now || (() => Date.now()),
    randomUUID: workerOptions.randomUUID || (() => crypto.randomUUID()),
    productionActivation: workerOptions.productionActivation
      ? Object.freeze({ ...workerOptions.productionActivation })
      : null
  };
  return {
    async fetch(request, env) {
      const traceId = crypto.randomUUID();
      try {
        const url = new URL(request.url);
        if (request.method === "GET" && url.pathname === "/api/v3/availability") {
          return handleAvailability(url, options);
        }
        const repositories = resolveRepositories(env, options);
        if (request.method === "POST" && url.pathname === "/api/v3/runs/abandon") {
          if (!options.rulesetRegistry) {
            throw new HttpError(404, "ROUTE_NOT_FOUND", "Route not found.");
          }
          return await handleRegisteredAbandon(request, env, options, repositories);
        }
        if (request.method === "POST" && url.pathname === "/api/v3/runs/resume") {
          if (!options.rulesetRegistry) {
            throw new HttpError(404, "ROUTE_NOT_FOUND", "Route not found.");
          }
          return await handleRegisteredResume(request, env, options, repositories);
        }
        if (request.method === "POST" && url.pathname === "/api/v3/profiles/camp") {
          if (!options.rulesetRegistry) {
            throw new HttpError(404, "ROUTE_NOT_FOUND", "Route not found.");
          }
          return await handleProfileCamp(request, env, options, repositories);
        }
        if (request.method === "POST" && url.pathname === "/api/v3/runs/start") {
          if (options.rulesetRegistry) {
            return await handleRegisteredStart(request, env, options, repositories);
          }
          return await handleStart(request, env, options, repositories);
        }
        if (request.method === "POST" && url.pathname === "/api/v3/runs/checkpoint") {
          if (options.rulesetRegistry) {
            return await handleRegisteredCheckpoint(request, env, options, repositories);
          }
          return await handleCheckpoint(request, env, options, repositories);
        }
        if (request.method === "POST" && url.pathname === "/api/v3/runs/event") {
          if (options.rulesetRegistry) {
            return await handleRegisteredEvent(request, env, options, repositories);
          }
          return await handleEvent(request, env, options, repositories);
        }
        if (request.method === "POST" && url.pathname === "/api/v3/runs/finalize") {
          if (options.rulesetRegistry) {
            return await handleRegisteredFinalize(request, env, options, repositories);
          }
          return await handleFinalize(request, env, options, repositories);
        }
        if (request.method === "GET" && url.pathname === "/api/v3/leaderboard") {
          return await handleLeaderboard(url, repositories, env, options);
        }
        const detailMatch = /^\/api\/v3\/leaderboard\/(run_[a-f0-9]+)$/u.exec(url.pathname);
        if (request.method === "GET" && detailMatch) {
          return await handleLeaderboardDetail(detailMatch[1], repositories, env, options);
        }
        throw new HttpError(404, "ROUTE_NOT_FOUND", "Route not found.");
      } catch (cause) {
        if (["REVISION_CONFLICT", "STATE_DIGEST_CONFLICT", "ROOM_TOKEN_CONFLICT"].includes(cause?.code || cause?.message)) {
          recordMetric(env, options, "stale_conflicts", 1, String(cause?.code || cause?.message));
        }
        if (/D1|storage|database/iu.test(String(cause?.code || cause?.message || ""))) {
          recordMetric(env, options, "d1_write_failures", 1, "worker_error");
        }
        options.onError?.(cause);
        return errorResponse(errorFromCause(cause), traceId);
      }
    },
    async scheduled(_controller, env) {
      const repositories = resolveRepositories(env, options);
      const result = await cleanupExpiredRuns(repositories.runs, options.now());
      recordMetric(env, options, "cleanup_deleted", result.deleted, "scheduled");
      return result;
    }
  };
}

export default createWorker();
