import { PROTOCOL_VERSION, RUN_TTL_MS } from "../config.js";
import { validateRoomDirective } from "./room-directives.js";
import { assertRulesetV3 } from "./ruleset-interface.js";

function nonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer.`);
  }
  return value;
}

function normalizeBuild(build = {}) {
  return {
    relics: Array.isArray(build.relics)
      ? build.relics.map((relic) => ({
        id: String(relic?.id || ""),
        stacks: Math.max(1, Math.floor(Number(relic?.stacks) || 1))
      })).filter((relic) => relic.id)
      : [],
    mutators: Array.isArray(build.mutators)
      ? build.mutators.filter((value) => typeof value === "string")
      : [],
    skillTiers: build.skillTiers && typeof build.skillTiers === "object"
      ? { ...build.skillTiers }
      : {},
    elixirs: Array.isArray(build.elixirs)
      ? build.elixirs.filter((value) => typeof value === "string")
      : [],
    bossDepthSummary: Array.isArray(build.bossDepthSummary)
      ? build.bossDepthSummary.map((entry) => ({ ...entry }))
      : []
  };
}

export function createInitialRun(input, context) {
  const ruleset = assertRulesetV3(context.ruleset, input.rulesetHash);
  const now = nonNegativeInteger(context.now, "now");
  const initialMeta = ruleset.createInitialMetaState({
    playerName: input.playerName,
    season: input.season,
    gameVersion: input.gameVersion,
    clientInstallIdHash: input.clientInstallIdHash
  });
  const base = {
    protocolVersion: PROTOCOL_VERSION,
    runId: String(context.runId),
    season: String(input.season),
    gameVersion: String(input.gameVersion),
    rulesetHash: ruleset.rulesetHash,
    status: "active",
    revision: 0,
    playerName: String(input.playerName),
    depth: 0,
    roomIndex: 0,
    gold: nonNegativeInteger(initialMeta.gold, "gold"),
    lives: nonNegativeInteger(initialMeta.lives, "lives"),
    build: normalizeBuild(initialMeta.build),
    statistics: initialMeta.statistics && typeof initialMeta.statistics === "object"
      ? { ...initialMeta.statistics }
      : {},
    rewardOffer: initialMeta.rewardOffer || null,
    merchantInventory: Array.isArray(initialMeta.merchantInventory)
      ? initialMeta.merchantInventory.map((entry) => ({ ...entry }))
      : [],
    offers: initialMeta.offers && typeof initialMeta.offers === "object"
      ? { ...initialMeta.offers }
      : {},
    specialRoomSchedule: Array.isArray(initialMeta.specialRoomSchedule)
      ? initialMeta.specialRoomSchedule.map((entry) => ({ ...entry }))
      : [],
    extractRequested: false,
    outcome: null,
    journalDigest: "",
    anomalyScore: 0,
    startedAt: now,
    updatedAt: now,
    expiresAt: now + RUN_TTL_MS,
    finalizedAt: null
  };
  const directive = validateRoomDirective(ruleset.issueRoomDirective(base, {
    previousDirective: null,
    nonce: context.roomNonce,
    directiveId: context.roomDirectiveId
  }));
  const nextState = {
    ...base,
    roomIndex: directive.roomIndex,
    roomDirective: directive
  };
  return {
    nextState,
    response: {
      acceptedBoundary: "run_started"
    },
    storageEffects: [{ type: "insert_run" }]
  };
}

export function stateForDigest(state) {
  const clone = structuredClone(state);
  delete clone.recentOps;
  delete clone.stateDigest;
  return clone;
}

export function publicMetaState(state) {
  return {
    runId: state.runId,
    protocolVersion: state.protocolVersion,
    season: state.season,
    gameVersion: state.gameVersion,
    rulesetHash: state.rulesetHash,
    status: state.status,
    revision: state.revision,
    depth: state.depth,
    roomIndex: state.roomIndex,
    roomDirective: structuredClone(state.roomDirective),
    gold: state.gold,
    lives: state.lives,
    build: structuredClone(state.build),
    statistics: structuredClone(state.statistics),
    rewardOffer: structuredClone(state.rewardOffer),
    merchantInventory: structuredClone(state.merchantInventory),
    offers: structuredClone(state.offers),
    specialRoomSchedule: structuredClone(state.specialRoomSchedule),
    extractRequested: state.extractRequested,
    outcome: state.outcome
  };
}
