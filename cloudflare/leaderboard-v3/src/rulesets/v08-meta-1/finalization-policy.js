import { VERIFICATION_LEVEL } from "../../config.js";
import { assertTerminalEligibilityV08 } from "./outcome-policy.js";
import { deriveFinalScoreV08 } from "./score-policy.js";
import {
  buildFinalProjectionsV08,
  deriveFinalDurationV08
} from "./leaderboard-summary.js";

export const FINALIZATION_POLICY_VERSION = "v08-finalization-1";

function finalOutcome(status) {
  if (status === "victory") return "victory";
  if (status === "defeat") return "defeat";
  if (status === "extraction") return "extract";
  throw new TypeError("RUN_NOT_TERMINAL_ELIGIBLE");
}

export function finalizeRunV08(state, context = {}) {
  assertTerminalEligibilityV08(state);
  const finalizedAt = context.finalizedAt;
  const outcome = finalOutcome(state.status);
  const scoreProjection = deriveFinalScoreV08(state);
  const durationProjection = deriveFinalDurationV08(state, finalizedAt);
  const projections = buildFinalProjectionsV08(state, {
    outcome,
    scoreProjection,
    durationProjection
  });
  const nextState = structuredClone(state);
  nextState.status = "finalized";
  nextState.revision += 1;
  nextState.finalizedAt = finalizedAt;
  nextState.outcome = outcome;
  nextState.finalization = {
    policyVersion: FINALIZATION_POLICY_VERSION,
    outcome,
    scoreProjection: structuredClone(scoreProjection),
    durationProjection: structuredClone(durationProjection),
    build: structuredClone(projections.build),
    summary: structuredClone(projections.summary)
  };
  const leaderboardEntry = {
    runId: nextState.runId,
    season: nextState.season,
    playerName: nextState.playerName,
    score: scoreProjection.score,
    depth: scoreProjection.inputs.acceptedMaxDepth,
    gold: scoreProjection.inputs.acceptedRunGoldEarned,
    durationMs: durationProjection.durationMs,
    outcome,
    build: structuredClone(projections.build),
    summary: structuredClone(projections.summary),
    verificationLevel: VERIFICATION_LEVEL,
    createdAt: finalizedAt
  };
  return {
    nextState,
    response: {
      acceptedBoundary: "run_finalized",
      outcome,
      score: scoreProjection.score,
      scoreVersion: scoreProjection.scoreVersion,
      durationMs: durationProjection.durationMs,
      durationPolicyVersion: durationProjection.durationPolicyVersion,
      verificationLevel: VERIFICATION_LEVEL,
      leaderboardEntryId: nextState.runId,
      build: structuredClone(projections.build),
      summary: structuredClone(projections.publicSummary)
    },
    storageEffects: [
      { type: "finalize_run", expectedRevision: state.revision },
      { type: "insert_leaderboard", entry: leaderboardEntry }
    ]
  };
}
