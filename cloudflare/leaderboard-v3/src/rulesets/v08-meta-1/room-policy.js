import eligibilityDocument from "./data/room-eligibility.generated.json" with { type: "json" };
import roomTypesDocument from "./data/room-types.generated.json" with { type: "json" };
import specialPolicyDocument from "./data/special-room-policy.generated.json" with { type: "json" };
import {
  CONSUMED_DIRECTIVE_HISTORY_LIMIT,
  RULESET_ID
} from "./constants.js";
import {
  assertMetaStateV08,
  cloneMetaStateV08,
  V08_RUN_PROGRESSION
} from "./meta-state.js";
import {
  assertRoomDirectiveV3,
  createRoomDirectiveV3
} from "./room-directive.js";
import {
  createRoomRewardEnvelopeV3,
  settleRoomRewardEnvelopeV3
} from "./reward-policy.js";
import { assertCanonicalRelicBuildDigestV08 } from "./relic-policy.js";
import {
  deriveIntInclusive,
  deriveRandomBytes
} from "./rng.js";

const eligibility = eligibilityDocument.canonicalData;
const specialPolicy = specialPolicyDocument.canonicalData;
const roomTypes = new Map(
  roomTypesDocument.canonicalData.roomTypes.map((entry) => [entry.id, entry])
);
const expansionRooms = new Map(
  eligibility.expansionRooms.map((entry) => [entry.id, entry])
);
const roomEligibility = new Map(
  eligibility.roomEligibility.map((entry) => [entry.id, entry])
);
const ONE_MILLION = 1_000_000;
const MAX_DEPTH_SCALED_SPECIAL_ROOMS = new Set(["vault", "forge", "otter"]);

export function specialRoomScalingDepthV08(state, roomType, roomDepth) {
  const depth = Math.max(1, Math.floor(Number(roomDepth) || 1));
  if (!MAX_DEPTH_SCALED_SPECIAL_ROOMS.has(String(roomType || ""))) return depth;
  const activeMaxDepth = Math.max(0, Math.floor(Number(state?.maxDepth) || 0));
  const campaignMaxDepth = Math.max(
    0,
    Math.floor(Number(state?.campaign?.scoreCarry?.highWaterDepth) || 0)
  );
  return Math.max(depth, activeMaxDepth, campaignMaxDepth);
}

export const ROOM_POLICY_SPEC = Object.freeze({
  moduleFile: "room-policy.js",
  authority: "SERVER_ISSUED",
  implementationStatus: "phase-3b2a-test-only",
  controls: Object.freeze([
    "roomType",
    "roomCategory",
    "directiveId",
    "roomNonce",
    "directiveSeed",
    "rewardEnvelopeRef",
    "sequentialDepth",
    "sequentialRoomIndex"
  ]),
  doesNotControl: Object.freeze([
    "physicalLayout",
    "playerPosition",
    "enemyPositions",
    "enemyAI",
    "combatOutcome"
  ])
});

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requireContext(state, context = {}) {
  const oracle = context.randomOracle || {
    deriveRandomBytes,
    deriveIntInclusive
  };
  if (
    typeof oracle.deriveRandomBytes !== "function" ||
    typeof oracle.deriveIntInclusive !== "function"
  ) {
    throw new TypeError("RULESET_RANDOM_ORACLE_INVALID");
  }
  return {
    oracle,
    secret: context.secret,
    base: {
      secret: context.secret,
      rulesetId: RULESET_ID,
      runId: state.runId,
      revision: state.revision
    }
  };
}

async function randomBytes(state, context, purpose, counter, length) {
  const resolved = requireContext(state, context);
  return resolved.oracle.deriveRandomBytes({
    ...resolved.base,
    purpose,
    counter,
    length
  });
}

async function randomInt(state, context, min, max, purpose, counter) {
  const resolved = requireContext(state, context);
  return resolved.oracle.deriveIntInclusive(min, max, {
    ...resolved.base,
    purpose,
    counter
  });
}

function regionForDepth(depth) {
  return eligibility.regions.find(
    (region) => depth >= region.minDepth && depth <= region.maxDepth
  ) || eligibility.regions[eligibility.regions.length - 1];
}

function pactWeightForDepth(depth) {
  let selected = eligibility.pactProfiles[0];
  for (const profile of eligibility.pactProfiles) {
    if (depth >= profile.minDepth) selected = profile;
  }
  return selected.enabled ? selected.weight : 0;
}

function weightedEntriesForDepth(depth, scheduleState) {
  const region = regionForDepth(depth);
  const config = eligibility.regionConfigs[region.id];
  const weights = { ...config.roomWeights };
  for (const expansion of expansionRooms.values()) {
    weights[expansion.id] = depth >= expansion.minDepth
      ? Math.max(0, Number(expansion.regionWeights[region.id]) || 0)
      : 0;
  }
  weights.pact = pactWeightForDepth(depth);
  if (scheduleState.crossroadsPenaltyActive) weights.crossroads = 0;
  return Object.entries(weights)
    .map(([roomType, weight]) => ({
      roomType,
      weight: Math.max(0, Math.round(Number(weight) * ONE_MILLION))
    }))
    .filter((entry) => entry.weight > 0);
}

async function chooseWeightedRoom(state, context, depth, counter) {
  const entries = weightedEntriesForDepth(depth, state.specialRoomScheduleState);
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return { roomType: "combat", source: "weighted-fallback" };
  let roll = await randomInt(
    state,
    context,
    1,
    total,
    "room-type/weighted",
    counter
  );
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) {
      let roomType = entry.roomType;
      const policy = roomEligibility.get(roomType);
      if (policy && depth < policy.minDepth) {
        roomType = roomType === "cursed" || roomType === "forge" ? "treasure" : "combat";
      }
      return { roomType, source: "weighted-room" };
    }
  }
  return { roomType: "combat", source: "weighted-fallback" };
}

function canIssueOtter(state, depth) {
  const policy = specialPolicy.otter;
  return (
    state.statistics.roomsCompleted > 0 &&
    depth >= policy.minDepth &&
    depth % V08_RUN_PROGRESSION.bossInterval !== 0 &&
    state.specialRoomScheduleState.otterRoomsSeenThisRun < policy.maxPerRun
  );
}

async function selectRoomType(state, context, depth, roomIndex) {
  if (depth === V08_RUN_PROGRESSION.terminalDepth) {
    return { roomType: "final", source: "final-priority" };
  }
  if (depth % V08_RUN_PROGRESSION.bossInterval === 0) {
    return { roomType: "boss", source: "boss-priority" };
  }

  if (state.campaign?.forcedNextRoomType === "vault") {
    return { roomType: "vault", source: "treasure-map-forced-vault" };
  }

  const schedule = state.specialRoomScheduleState;
  if (canIssueOtter(state, depth)) {
    const chance = depth >= specialPolicy.otter.ultraStartDepth
      ? specialPolicy.otter.ultraChance
      : specialPolicy.otter.chance;
    const roll = await randomInt(
      state,
      context,
      0,
      ONE_MILLION - 1,
      "room-type/otter-queue",
      roomIndex
    );
    if (roll < Math.round(chance * ONE_MILLION)) {
      return { roomType: "otter", source: "queued-otter" };
    }
  }

  if (
    depth === specialPolicy.forgePityDepth &&
    !schedule.forgeSeenInGame &&
    !schedule.forgePityUsedInGame &&
    !state.campaign.forgeSeenInCampaign &&
    !state.campaign.forgePityUsedInCampaign
  ) {
    return { roomType: "forge", source: "forge-pity" };
  }
  if (
    depth === specialPolicy.otterPityDepth &&
    !schedule.otterSeenInGame &&
    !schedule.otterPityUsedInGame &&
    schedule.otterRoomsSeenThisRun < specialPolicy.otter.maxPerRun
  ) {
    return { roomType: "otter", source: "otter-pity" };
  }

  if (
    roomIndex === specialPolicy.guaranteedMerchantRoomIndexes[1] ||
    (
      roomIndex === specialPolicy.guaranteedMerchantRoomIndexes[0] &&
      schedule.runMerchantRoomsSeen <= 0
    )
  ) {
    return { roomType: "merchant", source: "merchant-guarantee" };
  }

  const region = regionForDepth(depth);
  const vaultChance = Math.max(0, Number(eligibility.regionConfigs[region.id].vaultChance) || 0);
  if (depth >= roomEligibility.get("vault").minDepth && vaultChance > 0) {
    const roll = await randomInt(
      state,
      context,
      0,
      ONE_MILLION - 1,
      "room-type/vault",
      roomIndex
    );
    if (roll < Math.round(vaultChance * ONE_MILLION)) {
      return { roomType: "vault", source: "vault-roll" };
    }
  }

  return chooseWeightedRoom(state, context, depth, roomIndex);
}

function updateScheduleForIssuedRoom(scheduleState, roomType, depth) {
  const next = structuredClone(scheduleState);
  next.counts[roomType] = Math.max(0, Number(next.counts[roomType]) || 0) + 1;
  next.lastIssuedRoomType = roomType;
  const category = roomTypes.get(roomType)?.category || "normal";
  if (category === "special") next.lastIssuedSpecialDepth = depth;
  if (roomType === "merchant") next.runMerchantRoomsSeen += 1;
  if (roomType === "forge") next.forgeSeenInGame = true;
  if (roomType === "otter") {
    next.otterSeenInGame = true;
    next.otterRoomsSeenThisRun += 1;
  }
  if (roomType === "forge" && depth === specialPolicy.forgePityDepth) {
    next.forgePityUsedInGame = true;
  }
  if (roomType === "otter" && depth === specialPolicy.otterPityDepth) {
    next.otterPityUsedInGame = true;
  }
  return next;
}

export async function issueNextRoomDirectiveV08(state, context = {}) {
  assertMetaStateV08(state);
  await assertCanonicalRelicBuildDigestV08(state.build, context.cryptoProvider);
  if (state.status !== "active") throw new TypeError("RUN_NOT_ACTIVE");
  if (state.currentRoomDirective && !state.currentRoomDirective.consumed) {
    assertRoomDirectiveV3(state.currentRoomDirective);
    return cloneMetaStateV08(state);
  }

  const roomIndex = state.roomIndex + 1;
  const depth = state.depth + V08_RUN_PROGRESSION.depthTransition;
  if (depth > V08_RUN_PROGRESSION.terminalDepth) {
    throw new TypeError("TERMINAL_DEPTH_EXCEEDED");
  }
  const selection = await selectRoomType(state, context, depth, roomIndex);
  const roomDefinition = roomTypes.get(selection.roomType);
  if (!roomDefinition) throw new TypeError("ROOM_TYPE_UNSUPPORTED");
  const scalingDepth = specialRoomScalingDepthV08(
    state,
    selection.roomType,
    depth
  );
  const directiveIdBytes = await randomBytes(
    state,
    context,
    "room-directive/id",
    roomIndex,
    16
  );
  const nonceBytes = await randomBytes(
    state,
    context,
    "room-directive/nonce",
    roomIndex,
    16
  );
  const seedBytes = await randomBytes(
    state,
    context,
    "room-directive/seed",
    roomIndex,
    16
  );
  const envelopeIdBytes = await randomBytes(
    state,
    context,
    "room-reward-envelope/id",
    roomIndex,
    16
  );
  const envelopeId = `reward_${bytesToHex(envelopeIdBytes)}`;
  const directive = createRoomDirectiveV3({
    directiveId: `directive_${bytesToHex(directiveIdBytes)}`,
    runId: state.runId,
    revision: state.revision,
    roomIndex,
    depth,
    roomType: selection.roomType,
    roomCategory: roomDefinition.category,
    directiveSeed: bytesToHex(seedBytes),
    roomNonce: `nonce_${bytesToHex(nonceBytes)}`,
    rewardEnvelopeRef: envelopeId,
    specialRoomPayload: roomDefinition.category === "special"
      ? {
          policySource: selection.source,
          scheduleStateVersion: state.specialRoomScheduleState.schemaVersion,
          scalingDepth
        }
      : null,
    issuedAt: state.startedAt + state.revision
  });

  const next = cloneMetaStateV08(state);
  const rewardEnvelope = await createRoomRewardEnvelopeV3({
    state,
    directive,
    envelopeId,
    cryptoProvider: context.cryptoProvider
  });
  next.roomIndex = roomIndex;
  next.currentRoomDirective = directive;
  next.currentRewardEnvelope = rewardEnvelope;
  if (selection.source === "treasure-map-forced-vault") {
    next.campaign.forcedNextRoomType = "";
  }
  next.specialRoomScheduleState = updateScheduleForIssuedRoom(
    next.specialRoomScheduleState,
    directive.roomType,
    directive.depth
  );
  if (directive.roomType === "forge") {
    next.campaign.forgeSeenInCampaign = true;
  }
  if (selection.source === "forge-pity") {
    next.campaign.forgePityUsedInCampaign = true;
  }
  next.statistics.roomsIssued += 1;
  if (directive.roomCategory === "boss") next.statistics.bossRoomsIssued += 1;
  if (directive.roomCategory === "special") next.statistics.specialRoomsIssued += 1;
  if (directive.roomCategory === "final") next.statistics.finalRoomsIssued += 1;
  next.updatedAt = directive.issuedAt;
  return next;
}

function appendBounded(values, value) {
  const next = [...values, value];
  return next.slice(Math.max(0, next.length - CONSUMED_DIRECTIVE_HISTORY_LIMIT));
}

function assertOperationMatches(state, operation) {
  const directive = assertRoomDirectiveV3(state.currentRoomDirective);
  if (state.consumedDirectiveIds.includes(operation.directiveId)) {
    throw new TypeError("ROOM_DIRECTIVE_ALREADY_CONSUMED");
  }
  if (state.consumedDirectiveNonces.includes(operation.roomNonce)) {
    throw new TypeError("ROOM_NONCE_REUSED");
  }
  if (operation.runId !== state.runId || operation.runId !== directive.runId) {
    throw new TypeError("ROOM_DIRECTIVE_RUN_MISMATCH");
  }
  if (operation.rulesetHash !== state.rulesetHash) {
    throw new TypeError("RULESET_HASH_MISMATCH");
  }
  if (operation.revision !== state.revision || operation.revision !== directive.revision) {
    throw new TypeError("ROOM_DIRECTIVE_REVISION_MISMATCH");
  }
  if (operation.directiveId !== directive.directiveId) {
    throw new TypeError("ROOM_DIRECTIVE_ID_MISMATCH");
  }
  if (operation.roomNonce !== directive.roomNonce) {
    throw new TypeError("ROOM_NONCE_MISMATCH");
  }
  if (operation.roomIndex !== directive.roomIndex) {
    throw new TypeError("ROOM_INDEX_SEQUENCE_INVALID");
  }
  if (operation.depth !== directive.depth) {
    throw new TypeError(operation.depth > directive.depth ? "DEPTH_SKIP_REJECTED" : "DEPTH_REGRESSION_REJECTED");
  }
  if (operation.roomType !== directive.roomType) {
    throw new TypeError("ROOM_TYPE_NOT_ISSUED");
  }
  if (operation.completionAttestation !== "local-room-completed") {
    throw new TypeError("ROOM_COMPLETION_ATTESTATION_REQUIRED");
  }
  return directive;
}

export async function consumeRoomDirectiveV08(state, operation = {}, context = {}) {
  assertMetaStateV08(state);
  if (state.status !== "active") throw new TypeError("RUN_NOT_ACTIVE");
  if (!state.currentRoomDirective) throw new TypeError("ROOM_DIRECTIVE_REQUIRED");
  const directive = assertOperationMatches(state, operation);
  const livesBefore = state.lives;
  const fixedDelta = state.currentRewardEnvelope.fixedAwards.reduce(
    (sum, award) => sum + award.amount,
    0
  );
  const rewardClaim = operation.rewardClaim || {
    envelopeId: state.currentRewardEnvelope.envelopeId,
    roomDirectiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
    claims: [],
    reportedGoldDelta: fixedDelta,
    reportedGoldTotal: state.gold + fixedDelta,
    turnCount: 0,
    elapsedMs: Math.max(100, Number(context.elapsedMs) || 100),
    commandJournalDigest: "room-completion-attestation",
    compactRoomProof: "room-completed"
  };
  const settlement = await settleRoomRewardEnvelopeV3(state, rewardClaim, context);
  const next = settlement.state;
  const settledBuild = JSON.stringify(next.build);
  next.depth = directive.depth;
  next.maxDepth = Math.max(next.maxDepth, directive.depth);
  next.revision += 1;
  next.currentRoomDirective = null;
  next.currentRewardEnvelope = null;
  next.consumedDirectiveIds = appendBounded(next.consumedDirectiveIds, directive.directiveId);
  next.consumedDirectiveNonces = appendBounded(next.consumedDirectiveNonces, directive.roomNonce);
  next.statistics.roomsCompleted += 1;
  if (directive.roomCategory === "boss") next.statistics.bossRoomsCompleted += 1;
  if (directive.roomCategory === "final") next.statistics.finalRoomsCompleted =
    Math.max(0, Number(next.statistics.finalRoomsCompleted) || 0) + 1;
  if (Number.isSafeInteger(context.elapsedMs) && context.elapsedMs >= next.elapsedMs) {
    next.elapsedMs = context.elapsedMs;
  }
  next.updatedAt = next.startedAt + next.revision;

  const postRoomPact = context.postRoomPactSettlement === "post-room-pact-v1" && directive.roomType === "pact";
  if (postRoomPact) {
    // Keep a consumed directive sentinel so the existing boundary token and
    // recovery path remain revision-bound while the Pact offer is pending.
    next.currentRoomDirective = {
      ...directive,
      revision: next.revision,
      issuedAt: next.updatedAt,
      consumed: true
    };
    next.pendingPostRoomPact = {
      completedDirectiveId: directive.directiveId,
      completedDirectiveNonce: directive.roomNonce,
      completedRevision: directive.revision,
      completedDepth: directive.depth,
      completedRoomIndex: directive.roomIndex,
      postSettlementRevision: next.revision,
      postSettlementBuildDigest: next.build.buildDigest
    };
  } else if (directive.roomCategory === "final") {
    next.status = "victory";
    next.terminalEligibility = {
      outcome: "victory",
      eligibleRevision: next.revision,
      reason: "accepted_final_boss_clear"
    };
  } else {
    const issued = await issueNextRoomDirectiveV08(next, context);
    Object.assign(next, issued);
  }

  if (
    next.lives !== livesBefore ||
    JSON.stringify(next.build) !== settledBuild
  ) {
    throw new Error("PHASE_3B2A_META_SCOPE_VIOLATION");
  }
  return next;
}

export const V08_ROOM_POLICY_DATA = Object.freeze({
  eligibility,
  specialPolicy,
  roomTypes: Object.freeze(Array.from(roomTypes.values()))
});
