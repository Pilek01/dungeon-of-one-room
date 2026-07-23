import manifest from "./data/ruleset-manifest.json" with { type: "json" };
import progressionDocument from "./data/run-progression.generated.json" with { type: "json" };
import {
  CONSUMED_DIRECTIVE_HISTORY_LIMIT,
  RULESET_ID
} from "./constants.js";

const progression = progressionDocument.canonicalData;

function requireText(value, code) {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(code);
  return text;
}

function requireTimestamp(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(code);
  return value;
}

function normalizeStartDepth(input) {
  const requested = Number(input.startDepth ?? progression.entranceStartDepth);
  if (!Number.isSafeInteger(requested)) throw new TypeError("START_DEPTH_INVALID");
  if (!progression.allowedStartDepths.includes(requested)) {
    throw new TypeError("START_DEPTH_NOT_ALLOWED");
  }
  if (requested !== progression.entranceStartDepth) {
    const unlocked = new Set(
      Array.isArray(input.unlockedStartDepths)
        ? input.unlockedStartDepths.filter(Number.isSafeInteger)
        : []
    );
    if (!unlocked.has(requested)) throw new TypeError("START_DEPTH_LOCKED");
  }
  return requested;
}

function emptyBuild() {
  return {
    relics: [],
    mutators: [],
    skillTiers: {},
    elixirs: []
  };
}

function createScheduleState(history = {}) {
  return {
    schemaVersion: 1,
    counts: {},
    runMerchantRoomsSeen: 0,
    otterRoomsSeenThisRun: 0,
    forgeSeenInGame: Boolean(history.forgeSeenInGame),
    forgePityUsedInGame: Boolean(history.forgePityUsedInGame),
    otterSeenInGame: Boolean(history.otterSeenInGame),
    otterPityUsedInGame: Boolean(history.otterPityUsedInGame),
    crossroadsPenaltyActive: false,
    lastIssuedSpecialDepth: null,
    lastIssuedRoomType: null
  };
}

export function createInitialMetaStateV08(input = {}, context = {}) {
  const runId = requireText(context.runId ?? input.runId, "RUN_ID_REQUIRED");
  const season = requireText(context.season ?? input.season, "SEASON_REQUIRED");
  const startedAt = requireTimestamp(context.startedAt ?? context.now, "STARTED_AT_INVALID");
  const startDepth = normalizeStartDepth(input);
  const firstDirectiveDepth = startDepth === progression.entranceStartDepth
    ? progression.firstPlayableDepth
    : startDepth;

  return {
    rulesetId: RULESET_ID,
    rulesetHash: manifest.rulesetHash,
    runId,
    season,
    status: "active",
    revision: progression.initialRevision,
    startDepth,
    depth: firstDirectiveDepth - progression.depthTransition,
    roomIndex: progression.initialRoomIndex,
    currentRoomDirective: null,
    consumedDirectiveIds: [],
    consumedDirectiveNonces: [],
    consumedDirectiveHistoryLimit: CONSUMED_DIRECTIVE_HISTORY_LIMIT,
    gold: progression.initialGold,
    lives: progression.initialLives,
    build: emptyBuild(),
    pendingOffer: null,
    pendingInventory: null,
    specialRoomScheduleState: createScheduleState(input.specialRoomHistory),
    statistics: {
      roomsIssued: 0,
      roomsCompleted: 0,
      bossRoomsIssued: 0,
      bossRoomsCompleted: 0,
      specialRoomsIssued: 0,
      finalRoomsIssued: 0
    },
    startedAt,
    updatedAt: startedAt,
    elapsedMs: 0,
    anomalies: Array.isArray(input.anomalies)
      ? input.anomalies.filter((entry) => typeof entry === "string").slice(0, 32)
      : [],
    verificationLevel: "checkpoint_verified_v3"
  };
}

export function cloneMetaStateV08(state) {
  return structuredClone(state);
}

export function assertMetaStateV08(state) {
  if (!state || typeof state !== "object") throw new TypeError("META_STATE_INVALID");
  if (state.rulesetId !== RULESET_ID) throw new TypeError("RULESET_ID_MISMATCH");
  if (state.rulesetHash !== manifest.rulesetHash) throw new TypeError("RULESET_HASH_MISMATCH");
  if (!["active", "victory"].includes(state.status)) throw new TypeError("RUN_STATUS_INVALID");
  for (const [field, minimum] of [
    ["revision", 0],
    ["depth", 0],
    ["roomIndex", 0],
    ["gold", 0],
    ["lives", 0],
    ["elapsedMs", 0]
  ]) {
    if (!Number.isSafeInteger(state[field]) || state[field] < minimum) {
      throw new TypeError(`META_STATE_INVALID:${field}`);
    }
  }
  requireText(state.runId, "META_STATE_INVALID:runId");
  requireText(state.season, "META_STATE_INVALID:season");
  if (!state.build || typeof state.build !== "object") throw new TypeError("META_STATE_INVALID:build");
  if (!state.specialRoomScheduleState || typeof state.specialRoomScheduleState !== "object") {
    throw new TypeError("META_STATE_INVALID:specialRoomScheduleState");
  }
  return state;
}

export const V08_RUN_PROGRESSION = progression;
