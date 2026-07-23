import {
  ALLOWED_COMMAND_CODES,
  ALLOWED_META_EVENTS,
  MAX_COMPACT_PROOF_BYTES,
  MAX_ELAPSED_MS,
  MAX_JOURNAL_COMMANDS,
  MAX_TURN_COUNT,
  VERIFICATION_LEVEL
} from "../config.js";
import { canonicalJson } from "../security/canonical-json.js";
import { assertCurrentRoom, validateRoomDirective } from "./room-directives.js";
import { assertRulesetV3 } from "./ruleset-interface.js";
import { normalizeFinalScore } from "./score.js";

function integerInRange(value, minimum, maximum, code) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(code);
  }
  return value;
}

function validateCompactRoomProof(proof, turnCount) {
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
    throw new TypeError("ROOM_PROOF_INVALID");
  }
  if (canonicalJson(proof).length > MAX_COMPACT_PROOF_BYTES) {
    throw new TypeError("ROOM_PROOF_TOO_LARGE");
  }
  const commands = proof.commands;
  if (commands !== undefined) {
    if (!Array.isArray(commands) || commands.length > MAX_JOURNAL_COMMANDS) {
      throw new TypeError("COMMAND_JOURNAL_INVALID");
    }
    for (const command of commands) {
      if (!command || !ALLOWED_COMMAND_CODES.includes(command.code)) {
        throw new TypeError("COMMAND_CODE_INVALID");
      }
    }
    if (commands.length > turnCount * 8) {
      throw new TypeError("COMMAND_JOURNAL_IMPLAUSIBLE");
    }
  }
  return proof;
}

export function applyCheckpoint(runState, checkpointRequest, rulesetInput) {
  const ruleset = assertRulesetV3(rulesetInput, runState.rulesetHash);
  if (runState.status !== "active") throw new TypeError("RUN_NOT_ACTIVE");
  assertCurrentRoom(runState, checkpointRequest);
  if (checkpointRequest.roomResult !== "cleared") {
    throw new TypeError("ROOM_RESULT_INVALID");
  }
  const turnCount = integerInRange(
    checkpointRequest.turnCount,
    1,
    MAX_TURN_COUNT,
    "TURN_COUNT_INVALID"
  );
  integerInRange(checkpointRequest.elapsedMs, 1, MAX_ELAPSED_MS, "ELAPSED_MS_INVALID");
  validateCompactRoomProof(checkpointRequest.compactRoomProof, turnCount);
  if (
    checkpointRequest.compactRoomProof.roomDirectiveId !== checkpointRequest.roomDirectiveId ||
    checkpointRequest.compactRoomProof.roomNonce !== checkpointRequest.roomNonce
  ) {
    throw new TypeError("ROOM_PROOF_INVALID");
  }
  if (
    typeof checkpointRequest.commandJournalDigest !== "string" ||
    !/^[a-f0-9]{8,64}$/u.test(checkpointRequest.commandJournalDigest)
  ) {
    throw new TypeError("JOURNAL_DIGEST_INVALID");
  }

  const settlement = ruleset.resolveCheckpointRewards(runState, checkpointRequest);
  if (!settlement || typeof settlement !== "object") {
    throw new TypeError("RULESET_CHECKPOINT_INVALID");
  }
  const depthDelta = Number(settlement.depthDelta);
  if (depthDelta !== 1) throw new TypeError("SEQUENTIAL_DEPTH_REQUIRED");
  const nextDepth = runState.depth + 1;
  const nextStatistics = {
    ...runState.statistics,
    roomsCleared: Math.max(0, Number(runState.statistics.roomsCleared) || 0) + 1,
    ...(settlement.statistics || {})
  };
  const settledState = {
    ...runState,
    depth: nextDepth,
    gold: Math.max(0, runState.gold + Number(settlement.goldDelta || 0)),
    build: settlement.build ? structuredClone(settlement.build) : structuredClone(runState.build),
    statistics: nextStatistics,
    rewardOffer: settlement.rewardOffer ? structuredClone(settlement.rewardOffer) : null,
    merchantInventory: Array.isArray(settlement.merchantInventory)
      ? settlement.merchantInventory.map((entry) => ({ ...entry }))
      : [],
    offers: settlement.offers && typeof settlement.offers === "object"
      ? structuredClone(settlement.offers)
      : {},
    specialRoomSchedule: Array.isArray(settlement.specialRoomSchedule)
      ? settlement.specialRoomSchedule.map((entry) => ({ ...entry }))
      : structuredClone(runState.specialRoomSchedule),
    journalDigest: checkpointRequest.commandJournalDigest
  };
  const nextDirective = validateRoomDirective(ruleset.issueRoomDirective(settledState, {
    previousDirective: runState.roomDirective,
    nonce: checkpointRequest.nextRoomNonce,
    directiveId: checkpointRequest.nextRoomDirectiveId
  }));
  const nextState = {
    ...settledState,
    revision: runState.revision + 1,
    roomIndex: nextDirective.roomIndex,
    roomDirective: structuredClone(nextDirective)
  };
  return {
    nextState,
    response: {
      acceptedBoundary: "room_cleared",
      authoritativeDelta: {
        depth: nextState.depth,
        gold: nextState.gold,
        rewardOffer: structuredClone(nextState.rewardOffer)
      }
    },
    storageEffects: [{ type: "update_run", expectedRevision: runState.revision }]
  };
}

export function applyMetaEvent(runState, eventRequest, rulesetInput) {
  const ruleset = assertRulesetV3(rulesetInput, runState.rulesetHash);
  if (runState.status !== "active") throw new TypeError("RUN_NOT_ACTIVE");
  if (!ALLOWED_META_EVENTS.includes(eventRequest.type)) {
    throw new TypeError("EVENT_TYPE_INVALID");
  }
  assertCurrentRoom(runState, eventRequest);
  const resolution = ruleset.validateMetaEvent(runState, eventRequest);
  if (!resolution || resolution.accepted !== true || !resolution.nextMeta) {
    throw new TypeError(resolution?.code || "META_EVENT_REJECTED");
  }
  const nextState = {
    ...runState,
    ...structuredClone(resolution.nextMeta),
    depth: runState.depth,
    roomIndex: runState.roomIndex,
    roomDirective: structuredClone(runState.roomDirective),
    revision: runState.revision + 1
  };
  return {
    nextState,
    response: {
      acceptedEvent: eventRequest.type,
      eventResult: structuredClone(resolution.publicResult || {})
    },
    storageEffects: [{ type: "update_run", expectedRevision: runState.revision }]
  };
}

export function finalizeRun(runState, finalizeRequest, rulesetInput) {
  const ruleset = assertRulesetV3(rulesetInput, runState.rulesetHash);
  if (runState.status === "finalized") throw new TypeError("RUN_ALREADY_FINALIZED");
  if (runState.status !== "active") throw new TypeError("RUN_NOT_ACTIVE");
  assertCurrentRoom(runState, finalizeRequest);
  const outcome = finalizeRequest.outcome === "victory"
    ? "victory"
    : finalizeRequest.outcome === "defeat"
      ? "defeat"
      : finalizeRequest.outcome === "extract" && runState.extractRequested
        ? "extract"
        : null;
  if (!outcome) throw new TypeError("FINALIZE_OUTCOME_INVALID");

  const score = normalizeFinalScore(ruleset.computeFinalScore(runState, { outcome }));
  const summary = ruleset.buildLeaderboardSummary(runState, { outcome, score });
  const finalizedAt = finalizeRequest.now;
  const nextState = {
    ...runState,
    status: "finalized",
    revision: runState.revision + 1,
    outcome,
    finalizedAt
  };
  const leaderboardEntry = {
    runId: runState.runId,
    season: runState.season,
    playerName: runState.playerName,
    score,
    depth: runState.depth,
    gold: runState.gold,
    durationMs: Math.max(0, finalizedAt - runState.startedAt),
    outcome,
    build: structuredClone(summary.build),
    summary: structuredClone(summary.summary),
    verificationLevel: VERIFICATION_LEVEL,
    stateDigest: "",
    createdAt: finalizedAt
  };
  return {
    nextState,
    response: {
      outcome,
      score,
      verificationLevel: VERIFICATION_LEVEL
    },
    storageEffects: [
      { type: "finalize_run", expectedRevision: runState.revision },
      { type: "insert_leaderboard", entry: leaderboardEntry }
    ]
  };
}
