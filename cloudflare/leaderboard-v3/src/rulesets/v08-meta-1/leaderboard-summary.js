import { RUN_TTL_MS, VERIFICATION_LEVEL } from "../../config.js";
import sourceAuditDocument from "./data/m3-finalization-source-audit.generated.json" with { type: "json" };
import {
  getRelicCatalogEntryV08
} from "./relic-policy.js";
import { projectPublicRunModifiers } from "./run-modifiers.js";

export const DURATION_POLICY_VERSION =
  sourceAuditDocument.canonicalData.duration.version;

export const LEADERBOARD_SUMMARY_SPEC = Object.freeze({
  authority: "SERVER_DERIVED",
  verificationLevel: VERIFICATION_LEVEL,
  durationPolicyVersion: DURATION_POLICY_VERSION,
  publicFields: Object.freeze([
    "runId",
    "playerName",
    "score",
    "depth",
    "gold",
    "durationMs",
    "outcome",
    "verificationLevel",
    "createdAt",
    "publicBuild",
    "publicSummary"
  ]),
  implementationStatus: "m3-canonical"
});

function requireTimestamp(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(code);
  return value;
}

function requireOutcome(value) {
  if (!["victory", "defeat", "extract", "death"].includes(value)) {
    throw new TypeError("FINAL_OUTCOME_INVALID");
  }
  return value;
}

export function deriveFinalDurationV08(state, finalizedAtInput) {
  const startedAt = requireTimestamp(state?.startedAt, "RUN_STARTED_AT_INVALID");
  const expiresAt = requireTimestamp(state?.expiresAt, "RUN_EXPIRES_AT_INVALID");
  const finalizedAt = requireTimestamp(finalizedAtInput, "RUN_FINALIZED_AT_INVALID");
  if (expiresAt !== startedAt + RUN_TTL_MS) {
    throw new TypeError("RUN_EXPIRATION_POLICY_INVALID");
  }
  if (finalizedAt < startedAt) throw new TypeError("FINALIZE_CLOCK_REGRESSION");
  if (finalizedAt > expiresAt) throw new TypeError("RUN_EXPIRED");
  return {
    durationPolicyVersion: DURATION_POLICY_VERSION,
    startedAt,
    finalizedAt,
    durationMs: finalizedAt - startedAt
  };
}

function publicRelics(build) {
  return build.relics.map((entry) => ({
    relicId: entry.relicId,
    stacks: entry.stacks,
    rarity: getRelicCatalogEntryV08(entry.relicId).rarity
  }));
}

function terminalDefeatPresentationCause(state, outcome) {
  if (outcome !== "defeat") return null;
  const receipt = Array.isArray(state?.lifeLedger?.history)
    ? state.lifeLedger.history.slice().reverse().find((entry) => entry?.resolution === "terminal_defeat")
    : null;
  const cause = receipt?.presentationCause;
  return typeof cause === "string" && cause ? cause : null;
}

export function buildFinalProjectionsV08(state, final) {
  const outcome = requireOutcome(final?.outcome);
  const score = final?.scoreProjection;
  const duration = final?.durationProjection;
  if (!score || !Number.isSafeInteger(score.score) || score.score < 0) {
    throw new TypeError("FINAL_SCORE_PROJECTION_INVALID");
  }
  if (!duration || !Number.isSafeInteger(duration.durationMs) || duration.durationMs < 0) {
    throw new TypeError("FINAL_DURATION_PROJECTION_INVALID");
  }
  const build = {
    relics: publicRelics(state.build),
    relicSlotBase: state.build.relicSlotBase,
    relicSlotBonus: state.build.relicSlotBonus,
    relicSlotLimit: state.build.relicSlotLimit,
    relicSlotsUsed: state.build.relicSlotsUsed,
    totalRelicStacks: state.build.totalRelicStacks,
    pacts: structuredClone(state.build.pacts),
    campUpgrades: structuredClone(state.build.campUpgrades),
    skillTiers: structuredClone(state.build.skillTiers),
    elixirs: structuredClone(state.build.elixirs),
    runModifiers: projectPublicRunModifiers(state),
    buildDigest: state.build.buildDigest
  };
  const goldEarned = score.inputs.acceptedRunGoldEarned;
  const presentationCause = terminalDefeatPresentationCause(state, outcome);
  const summary = {
    outcome,
    finalDepth: score.inputs.acceptedMaxDepth,
    score: score.score,
    scoreVersion: score.scoreVersion,
    scoreComponents: structuredClone(score.components),
    gold: {
      earned: goldEarned,
      spent: state.goldLedger.spentServerDerived,
      finalWallet: state.gold,
      finalCampWallet: state.campGold
    },
    durationMs: duration.durationMs,
    durationPolicyVersion: duration.durationPolicyVersion,
    lives: {
      remaining: state.lives,
      maximum: state.lifeLedger.maximumLives,
      fatalEvents: state.lifeLedger.fatalEvents,
      preventedDeaths: state.lifeLedger.preventedDeaths,
      lifeLosses: state.lifeLedger.lifeLosses
    },
    roomsCompleted: state.statistics.roomsCompleted,
    bossesCompleted: state.statistics.bossRoomsCompleted,
    finalRoomsCompleted: state.statistics.finalRoomsCompleted || 0,
    metaTransactionsCompleted: state.metaTransactionReceipts.length,
    rulesetId: state.rulesetId,
    rulesetHash: state.rulesetHash,
    verificationLevel: VERIFICATION_LEVEL,
    ...(presentationCause ? { presentationCause } : {})
  };
  return {
    build,
    summary,
    publicSummary: {
      outcome: summary.outcome,
      finalDepth: summary.finalDepth,
      score: summary.score,
      scoreVersion: summary.scoreVersion,
      goldEarned: summary.gold.earned,
      durationMs: summary.durationMs,
      livesRemaining: summary.lives.remaining,
      roomsCompleted: summary.roomsCompleted,
      bossesCompleted: summary.bossesCompleted,
      rulesetId: summary.rulesetId,
      rulesetHash: summary.rulesetHash,
      verificationLevel: summary.verificationLevel
    }
  };
}
