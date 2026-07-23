import {
  HMAC_SECRET_BINDING,
  PROTOCOL_VERSION,
  RECENT_OPS_LIMIT,
  TOKEN_TTL_MS
} from "./config.js";
import {
  applyCheckpoint,
  applyMetaEvent,
  finalizeRun
} from "./domain/transitions.js";
import {
  appendRecentOperation,
  resolveIdempotentReplay
} from "./domain/idempotency.js";
import {
  createInitialRun,
  publicMetaState,
  stateForDigest
} from "./domain/run-state.js";
import { assertRulesetV3 } from "./domain/ruleset-interface.js";
import { errorFromCause, HttpError } from "./http/errors.js";
import {
  parseLeaderboardQuery,
  readJsonRequest,
  requireIdempotencyKey,
  requireString
} from "./http/request.js";
import { errorResponse, jsonResponse } from "./http/response.js";
import {
  decodeCheckpointToken,
  signCheckpointToken,
  verifyCheckpointToken
} from "./security/checkpoint-token.js";
import { canonicalDigest } from "./security/digests.js";
import { createD1LeaderboardRepository } from "./storage/d1-leaderboard.js";
import { createD1RunRepository } from "./storage/d1-runs.js";

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
  const runs = createD1RunRepository(env.DB, leaderboard);
  return { runs, leaderboard };
}

function resolveRuleset(env, options, requestedHash = "") {
  return assertRulesetV3(options.ruleset || env?.RANKED_V3_RULESET, requestedHash);
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
    clientInstallIdHash: requireString(body.clientInstallIdHash, "clientInstallIdHash", {
      minimum: 16,
      maximum: 128,
      pattern: /^[A-Za-z0-9._:-]+$/u
    })
  };
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

function operationRecord({
  idempotencyKey,
  requestDigest,
  responseStatus,
  responseBody,
  resultingRevision,
  createdAt
}) {
  return {
    idempotencyKey,
    requestDigest,
    responseStatus,
    responseBody,
    resultingRevision,
    createdAt
  };
}

function replayOrConflict(state, idempotencyKey, requestDigest) {
  const resolution = resolveIdempotentReplay(
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
  const recentOps = appendRecentOperation([], operationRecord({
    idempotencyKey,
    requestDigest,
    responseStatus: 201,
    responseBody,
    resultingRevision: state.revision,
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
    const replay = replayOrConflict(existing, idempotencyKey, requestDigest);
    if (replay) return replay;
    throw cause;
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
  const replay = replayOrConflict(state, idempotencyKey, requestDigest);
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
    ...transition.response,
    runId: nextState.runId,
    revision: nextState.revision,
    ...(checkpointToken ? { checkpointToken } : {}),
    metaState: publicMetaState(nextState)
  };
  const recentOps = appendRecentOperation(
    context.state.recentOps,
    operationRecord({
      idempotencyKey: context.idempotencyKey,
      requestDigest: context.requestDigest,
      responseStatus: 200,
      responseBody,
      resultingRevision: nextState.revision,
      createdAt: context.now
    }),
    RECENT_OPS_LIMIT
  );
  let persisted;
  if (options.leaderboardEntry) {
    persisted = await repositories.runs.finalizeAtomic(
      nextState,
      context.state.revision,
      { stateDigest, recentOps },
      {
        ...options.leaderboardEntry,
        stateDigest
      }
    );
  } else {
    persisted = await repositories.runs.updateConditional(
      nextState,
      context.state.revision,
      { stateDigest, recentOps }
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
  return persistMutation(context, transition, repositories);
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
  return persistMutation(context, transition, repositories);
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
    (effect) => effect.type === "insert_leaderboard"
  );
  return persistMutation(context, transition, repositories, {
    leaderboardEntry: leaderboardEffect.entry
  });
}

async function handleLeaderboard(url, repositories) {
  const query = parseLeaderboardQuery(url);
  const page = await repositories.leaderboard.list(query.season, query);
  return jsonResponse({ ok: true, season: query.season, ...page });
}

async function handleLeaderboardDetail(runId, repositories) {
  const detail = await repositories.leaderboard.detail(runId);
  if (!detail) throw new HttpError(404, "LEADERBOARD_ENTRY_NOT_FOUND", "Entry not found.");
  return jsonResponse({ ok: true, entry: detail });
}

export function createWorker(workerOptions = {}) {
  const options = {
    ruleset: workerOptions.ruleset,
    repositories: workerOptions.repositories,
    now: workerOptions.now || (() => Date.now()),
    randomUUID: workerOptions.randomUUID || (() => crypto.randomUUID())
  };
  return {
    async fetch(request, env) {
      const traceId = crypto.randomUUID();
      try {
        const url = new URL(request.url);
        const repositories = resolveRepositories(env, options);
        if (request.method === "POST" && url.pathname === "/api/v3/runs/start") {
          return await handleStart(request, env, options, repositories);
        }
        if (request.method === "POST" && url.pathname === "/api/v3/runs/checkpoint") {
          return await handleCheckpoint(request, env, options, repositories);
        }
        if (request.method === "POST" && url.pathname === "/api/v3/runs/event") {
          return await handleEvent(request, env, options, repositories);
        }
        if (request.method === "POST" && url.pathname === "/api/v3/runs/finalize") {
          return await handleFinalize(request, env, options, repositories);
        }
        if (request.method === "GET" && url.pathname === "/api/v3/leaderboard") {
          return await handleLeaderboard(url, repositories);
        }
        const detailMatch = /^\/api\/v3\/leaderboard\/(run_[a-f0-9]+)$/u.exec(url.pathname);
        if (request.method === "GET" && detailMatch) {
          return await handleLeaderboardDetail(detailMatch[1], repositories);
        }
        throw new HttpError(404, "ROUTE_NOT_FOUND", "Route not found.");
      } catch (cause) {
        return errorResponse(errorFromCause(cause), traceId);
      }
    }
  };
}

export default createWorker();
