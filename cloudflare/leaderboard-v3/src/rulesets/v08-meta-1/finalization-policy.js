import { VERIFICATION_LEVEL } from "../../config.js";
import { assertTerminalEligibilityV08 } from "./outcome-policy.js";
import { deriveFinalScoreV08 } from "./score-policy.js";
import {
  buildFinalProjectionsV08,
  deriveFinalDurationV08
} from "./leaderboard-summary.js";
import { createLeaderboardSnapshot } from "../../domain/leaderboard-snapshot.js";

export const FINALIZATION_POLICY_VERSION = "v08-finalization-2";

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
  const publishesLeaderboard = outcome !== "extract";
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
  const leaderboardEntry = createLeaderboardSnapshot({
    runId: nextState.runId,
    profileId: nextState.profileId,
    season: nextState.season,
    playerName: nextState.playerName,
    score: scoreProjection.score,
    depth: scoreProjection.inputs.acceptedMaxDepth,
    gold: scoreProjection.inputs.acceptedRunGoldEarned,
    durationMs: durationProjection.durationMs,
    outcome,
    snapshotKind: "final",
    assistanceClass: state.assistanceClass || "none",
    build: structuredClone(projections.build),
    summary: structuredClone(projections.summary),
    verificationLevel: VERIFICATION_LEVEL,
    createdAt: finalizedAt
  });
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
      ...(publishesLeaderboard ? { leaderboardEntryId: nextState.runId } : {}),
      build: structuredClone(projections.build),
      summary: structuredClone(projections.publicSummary)
    },
    storageEffects: [
      { type: "finalize_run", expectedRevision: state.revision },
      ...(publishesLeaderboard
        ? [{ type: "upsert_leaderboard_snapshot", entry: leaderboardEntry }]
        : [])
    ]
  };
}
