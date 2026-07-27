import manifest from "./data/ruleset-manifest.json" with { type: "json" };
import progressionDocument from "./data/run-progression.generated.json" with { type: "json" };
import {
  CONSUMED_DIRECTIVE_HISTORY_LIMIT,
  RULESET_ID
} from "./constants.js";
import { assertGoldLedgerV08 } from "./gold-policy.js";
import {
  assertCanonicalRelicBuildV08,
  createEmptyRelicBuildV08
} from "./relic-policy.js";
import {
  assertCanonicalRunModifierLedgerV08,
  createEmptyRunModifierLedgerV08
} from "./run-modifiers.js";
import { assertPendingRelicTransactionV08 } from "./relic-replacement.js";
import {
  assertMetaTransactionReceiptsV08,
  assertPendingMetaTransactionOfferV08
} from "./meta-transaction.js";
import {
  assertLifeLedgerV08,
  createLifeLedgerV08
} from "./life-policy.js";
import { TERMINAL_ELIGIBLE_STATUSES } from "./outcome-policy.js";

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

function createGoldLedger() {
  return {
    earnedServerDerived: 0,
    earnedBoundedAttested: 0,
    spentServerDerived: 0,
    lastDelta: 0,
    lastEnvelopeId: null,
    roomClaimsAccepted: 0,
    roomClaimsRejected: 0,
    anomalyScore: 0,
    anomalyFlags: [],
    maximumClaimStreak: 0,
    campEarnedServerDerived: 0,
    campSpentServerDerived: 0
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

function createRelicOfferState() {
  return {
    offersIssuedBySource: {},
    rarityMissStreaks: {},
    sourceSpecificCounters: {
      wardenDropMissStreak: 0
    },
    firstDropFlags: {}
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
    status: "awaiting_starting_relic",
    revision: progression.initialRevision,
    startDepth,
    depth: firstDirectiveDepth - progression.depthTransition,
    roomIndex: progression.initialRoomIndex,
    currentRoomDirective: null,
    currentRewardEnvelope: null,
    consumedDirectiveIds: [],
    consumedDirectiveNonces: [],
    consumedDirectiveHistoryLimit: CONSUMED_DIRECTIVE_HISTORY_LIMIT,
    gold: progression.initialGold,
    campGold: 0,
    goldLedger: createGoldLedger(),
    rewardSettlementHistory: [],
    lives: progression.initialLives,
    maxDepth: 0,
    lifeLedger: createLifeLedgerV08(),
    build: createEmptyRelicBuildV08(),
    runModifiers: createEmptyRunModifierLedgerV08(),
    pendingOffer: null,
    offerSettlementHistory: [],
    pendingRelicTransaction: null,
    relicReplacementHistory: [],
    relicFallbackHistory: [],
    relicOfferState: createRelicOfferState(),
    pendingInventory: null,
    metaTransactionReceipts: [],
    metaSourceConsumptions: [],
    campSession: null,
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
  if (
    ![
      "awaiting_starting_relic",
      "active",
      ...TERMINAL_ELIGIBLE_STATUSES,
      "finalized"
    ].includes(state.status)
  ) {
    throw new TypeError("RUN_STATUS_INVALID");
  }
  for (const [field, minimum] of [
    ["revision", 0],
    ["depth", 0],
    ["roomIndex", 0],
    ["gold", 0],
    ["campGold", 0],
    ["lives", 0],
    ["maxDepth", 0],
    ["elapsedMs", 0]
  ]) {
    if (!Number.isSafeInteger(state[field]) || state[field] < minimum) {
      throw new TypeError(`META_STATE_INVALID:${field}`);
    }
  }
  requireText(state.runId, "META_STATE_INVALID:runId");
  requireText(state.season, "META_STATE_INVALID:season");
  if (!state.build || typeof state.build !== "object") throw new TypeError("META_STATE_INVALID:build");
  assertCanonicalRelicBuildV08(state.build);
  assertCanonicalRunModifierLedgerV08(state.runModifiers);
  assertLifeLedgerV08(state);
  assertGoldLedgerV08(state);
  assertPendingMetaTransactionOfferV08(state.pendingInventory);
  assertMetaTransactionReceiptsV08(state.metaTransactionReceipts);
  if (
    !Array.isArray(state.metaSourceConsumptions) ||
    state.metaSourceConsumptions.length > 64
  ) {
    throw new TypeError("META_STATE_INVALID:metaSourceConsumptions");
  }
  if (
    state.campSession !== null &&
    (
      typeof state.campSession !== "object" ||
      typeof state.campSession.sessionId !== "string" ||
      !state.campSession.sessionId ||
      state.campSession.active !== true ||
      !Number.isFinite(state.campSession.shopCostMultiplier) ||
      state.campSession.shopCostMultiplier < 0
    )
  ) {
    throw new TypeError("META_STATE_INVALID:campSession");
  }
  if (!Array.isArray(state.offerSettlementHistory) || state.offerSettlementHistory.length > 64) {
    throw new TypeError("META_STATE_INVALID:offerSettlementHistory");
  }
  assertPendingRelicTransactionV08(state.pendingRelicTransaction);
  if (
    !Array.isArray(state.relicReplacementHistory) ||
    state.relicReplacementHistory.length > 64
  ) {
    throw new TypeError("META_STATE_INVALID:relicReplacementHistory");
  }
  if (
    !Array.isArray(state.relicFallbackHistory) ||
    state.relicFallbackHistory.length > 64
  ) {
    throw new TypeError("META_STATE_INVALID:relicFallbackHistory");
  }
  if (
    state.pendingOffer !== null &&
    !["starting_relic", "relic_reward"].includes(state.pendingOffer?.offerType)
  ) {
    throw new TypeError("META_STATE_INVALID:pendingOffer");
  }
  if (!state.relicOfferState || typeof state.relicOfferState !== "object") {
    throw new TypeError("META_STATE_INVALID:relicOfferState");
  }
  for (const field of [
    "offersIssuedBySource",
    "rarityMissStreaks",
    "sourceSpecificCounters",
    "firstDropFlags"
  ]) {
    if (
      !state.relicOfferState[field] ||
      typeof state.relicOfferState[field] !== "object" ||
      Array.isArray(state.relicOfferState[field])
    ) {
      throw new TypeError(`META_STATE_INVALID:relicOfferState.${field}`);
    }
  }
  const missStreak = state.relicOfferState.sourceSpecificCounters.wardenDropMissStreak;
  if (!Number.isSafeInteger(missStreak) || missStreak < 0) {
    throw new TypeError("META_STATE_INVALID:relicOfferState.wardenDropMissStreak");
  }
  if (state.status === "awaiting_starting_relic" && state.currentRoomDirective) {
    throw new TypeError("META_STATE_STARTING_RELIC_ROOM_DIRECTIVE_FORBIDDEN");
  }
  if (!Array.isArray(state.rewardSettlementHistory) || state.rewardSettlementHistory.length > 64) {
    throw new TypeError("META_STATE_INVALID:rewardSettlementHistory");
  }
  if (!state.specialRoomScheduleState || typeof state.specialRoomScheduleState !== "object") {
    throw new TypeError("META_STATE_INVALID:specialRoomScheduleState");
  }
  return state;
}

export const V08_RUN_PROGRESSION = progression;
