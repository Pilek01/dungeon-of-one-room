import {
  applyCheckpointRankEligibility,
  captureRankIntegrityRoomContext,
  checkpointGoldIntegrityReasons,
  initializeRankEligibility,
  isOfficialRankEligible,
  rankEligibilityOf,
  rankIntegrityRoomState
} from "./rank-eligibility.js";
import {
  normalizeCheckpointCombatResourcesForIssuedHealthV08
} from "./checkpoint-boundary-compat.js";

function requireObject(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(code);
  }
  return value;
}

function exactPayload(payload, fields, code) {
  const value = payload === undefined ? {} : requireObject(payload, code);
  if (Object.keys(value).sort().join(",") !== [...fields].sort().join(",")) {
    throw new TypeError(`${code}_FIELDS`);
  }
  return value;
}

function runtimeContext(state, context = {}, capabilities) {
  return {
    runId: state.runId,
    rulesetHash: state.rulesetHash,
    runModifiers: structuredClone(state.runModifiers),
    authority: "TRUSTED_RULESET_DOMAIN",
    potionPolicyVersion: state.potionPolicyVersion === "v1" ? "v1" : "legacy",
    secret: context.secret,
    cryptoProvider: context.cryptoProvider,
    randomOracle: context.randomOracle,
    elapsedMs: context.elapsedMs,
    now: context.now,
    capabilities: capabilities || context.capabilities
  };
}

function supportsEventJournalBoundary(ruleset) {
  return ruleset?.capabilities?.boundarySettlementMode === "event-journal-v1";
}

function exactBoundarySettlement(payload, capabilities = {}) {
  const fields = [
    "envelopeId",
    "roomDirectiveId",
    "roomNonce",
    "claims",
    "reportedGoldDelta",
    "reportedGoldTotal",
    "turnCount",
    "elapsedMs",
    "commandJournalDigest",
    "compactRoomProof"
  ];
  const bounded = capabilities?.boundedCombatResources === "v1";
  if (bounded) {
    if (!Object.hasOwn(payload || {}, "combatResources")) {
      throw new TypeError("BOUNDARY_SETTLEMENT_PAYLOAD_INVALID_FIELDS");
    }
    fields.push("combatResources");
  }
  return exactPayload(payload, fields, "BOUNDARY_SETTLEMENT_PAYLOAD_INVALID");
}

async function settleEventJournalBoundary(state, payload, outcome, ruleset, context) {
  if (!supportsEventJournalBoundary(ruleset) || typeof ruleset.settleBoundaryRewardEnvelope !== "function") {
    throw new TypeError("BOUNDARY_SETTLEMENT_UNSUPPORTED");
  }
  const request = exactBoundarySettlement(payload, ruleset.capabilities);
  const roomIntegrityState = rankIntegrityRoomState(state);
  let settlement;
  let boundaryInvalid = false;
  try {
    settlement = await ruleset.settleBoundaryRewardEnvelope(
      structuredClone(state),
      request,
      { outcome },
      runtimeContext(state, { ...context, elapsedMs: request.elapsedMs }, ruleset.capabilities)
    );
  } catch (error) {
    if (error instanceof TypeError && error.message === "REWARD_IDEMPOTENCY_PAYLOAD_MISMATCH") {
      throw error;
    }
    if (!(error instanceof TypeError) || !/^REWARD_/u.test(String(error.message || ""))) {
      throw error;
    }
    boundaryInvalid = true;
    settlement = await ruleset.settleBoundaryRewardEnvelope(
      structuredClone(state),
      {
        ...request,
        envelopeId: state.currentRewardEnvelope.envelopeId,
        roomDirectiveId: state.currentRoomDirective.directiveId,
        roomNonce: state.currentRoomDirective.roomNonce,
        claims: [],
        reportedGoldDelta: 0,
        reportedGoldTotal: state.gold,
        commandJournalDigest: "invalid-boundary-settlement",
        compactRoomProof: "invalid-boundary-settlement"
      },
      { outcome },
      runtimeContext(state, { ...context, elapsedMs: request.elapsedMs }, ruleset.capabilities)
    );
  }
  applyCheckpointRankEligibility(settlement.state, {
    integrityVersion: 1,
    integritySignals: [],
    goldIntegrityReasons: outcome === "emergency" && !boundaryInvalid
      ? checkpointGoldIntegrityReasons(
        roomIntegrityState || state,
        {
          ...request,
          integrityVersion: 1,
          rewardClaims: request.claims
        },
        settlement.authoritativeGoldDelta
      )
      : []
  });
  if (boundaryInvalid) {
    initializeRankEligibility(settlement.state, { integrityVersion: 1 });
    settlement.state.rankEligibility = "provisional";
    settlement.state.rankIntegrity.reasonCodes = [...new Set([
      ...settlement.state.rankIntegrity.reasonCodes,
      "BOUNDARY_SETTLEMENT_INVALID"
    ])].slice(0, 16);
    if (settlement.state.rankIntegrity.firstDetectedRevision === null) {
      settlement.state.rankIntegrity.firstDetectedRevision = settlement.state.revision;
    }
  }
  return settlement.state;
}

function publicPendingOffer(state, ruleset) {
  if (!state.pendingOffer) return null;
  if (state.pendingOffer.offerType === "starting_relic") {
    return ruleset.projectPublicStartingRelicOffer(state.pendingOffer);
  }
  if (state.pendingOffer.offerType === "relic_reward") {
    return ruleset.projectPublicRegularRelicOffer(state.pendingOffer);
  }
  throw new TypeError("PUBLIC_PENDING_OFFER_TYPE_INVALID");
}

function publicInventory(state, ruleset) {
  const source = state.pendingInventory?.sourceType;
  if (!source) return null;
  const projector = {
    merchant: "projectPublicMerchantInventory",
    forge: "projectPublicForgeOffer",
    crossroads: "projectPublicCrossroadsOffer",
    camp: "projectPublicCampTransactions",
    pact: "projectPublicPactOffer"
  }[source];
  if (!projector || typeof ruleset[projector] !== "function") {
    throw new TypeError("PUBLIC_META_TRANSACTION_SOURCE_INVALID");
  }
  return ruleset[projector](state);
}

export function publicRulesetMetaState(state, ruleset) {
  const pendingReplacement = state.pendingRelicTransaction
    ? ruleset.projectPublicRelicReplacement(state)
    : null;
  const score = ruleset.computeFinalScore(state);
  const rankEligibility = rankEligibilityOf(state);
  return {
    runId: state.runId,
    profileId: state.profileId || null,
    protocolVersion: state.protocolVersion,
    season: state.season,
    gameVersion: state.gameVersion,
    rulesetId: state.rulesetId,
    rulesetHash: state.rulesetHash,
    ...(state.potionPolicyVersion === "v1" ? { potionPolicyVersion: "v1" } : {}),
    status: state.status,
    revision: state.revision,
    startDepth: state.startDepth,
    depth: state.depth,
    roomIndex: state.roomIndex,
    currentRoomDirective: structuredClone(state.currentRoomDirective),
    currentRewardEnvelope: structuredClone(state.currentRewardEnvelope),
    gold: state.gold,
    campGold: state.campGold,
    lives: state.lives,
    maxDepth: state.maxDepth,
    score: structuredClone(score),
    runModifiers: typeof ruleset.projectPublicRunModifiers === "function"
      ? ruleset.projectPublicRunModifiers(state)
      : null,
    mutatorProgress: typeof ruleset.projectPublicMutatorProgress === "function"
      ? ruleset.projectPublicMutatorProgress(state)
      : null,
    lifeState: {
      maximumLives: state.lifeLedger.maximumLives,
      fatalEvents: state.lifeLedger.fatalEvents,
      preventedDeaths: state.lifeLedger.preventedDeaths,
      lifeLosses: state.lifeLedger.lifeLosses,
      currentLife: state.lifeLedger.currentLife
    },
    campaign: structuredClone(state.campaign),
    build: structuredClone(state.build),
    statistics: structuredClone(state.statistics),
    startingRelicOffer:
      state.status === "awaiting_starting_relic"
        ? publicPendingOffer(state, ruleset)
        : null,
    relicOffer:
      state.pendingOffer?.offerType === "relic_reward"
        ? publicPendingOffer(state, ruleset)
        : null,
    relicReplacement: pendingReplacement,
    metaTransactionOffer: publicInventory(state, ruleset),
    campSession: state.campSession
      ? {
          sessionId: state.campSession.sessionId,
          active: state.campSession.active
        }
      : null,
    rankEligibility,
    ...(rankEligibility === "provisional"
      ? {
          rankIntegrity: {
            reasonCodes: [...new Set(
              (Array.isArray(state.rankIntegrity?.reasonCodes)
                ? state.rankIntegrity.reasonCodes
                : [])
                .map((entry) => String(entry || ""))
                .filter(Boolean)
            )].slice(0, 16),
            firstDetectedRevision: Number.isSafeInteger(state.rankIntegrity?.firstDetectedRevision)
              ? state.rankIntegrity.firstDetectedRevision
              : null
          }
        }
      : {}),
    verificationLevel: state.verificationLevel
  };
}

export async function applyRulesetCheckpoint(state, body, ruleset, context = {}) {
  if (state.status !== "active") throw new TypeError("RUN_NOT_ACTIVE");
  if (
    ruleset.capabilities?.postRoomPactSettlement === "post-room-pact-v1" &&
    (state.pendingPostRoomPact || state.pendingInventory?.sourceType === "pact")
  ) {
    throw new TypeError("PACT_POST_ROOM_TRANSACTION_PENDING");
  }
  const directive = state.currentRoomDirective;
  if (!directive) throw new TypeError("ROOM_DIRECTIVE_REQUIRED");
  const boundedCombatResources = ruleset.capabilities?.boundedCombatResources === "v1";
  if (boundedCombatResources !== Object.hasOwn(body, "combatResources")) {
    throw new TypeError("BOUNDARY_COMBAT_RESOURCES_CAPABILITY_MISMATCH");
  }
  if (body.roomResult !== "cleared") throw new TypeError("ROOM_RESULT_INVALID");
  const wasOfficialRankEligible = isOfficialRankEligible(state);
  const rewardClaims = Array.isArray(body.rewardClaims)
    ? structuredClone(body.rewardClaims)
    : [];
  const combatResources = body.combatResources === undefined
    ? undefined
    : normalizeCheckpointCombatResourcesForIssuedHealthV08({
        state,
        rewardClaims,
        combatResources: body.combatResources,
        capabilities: ruleset.capabilities
      });
  const operation = {
    directiveId: directive.directiveId,
    runId: state.runId,
    rulesetHash: state.rulesetHash,
    revision: state.revision,
    roomIndex: directive.roomIndex,
    depth: directive.depth,
    roomType: directive.roomType,
    roomNonce: directive.roomNonce,
    completionAttestation: "local-room-completed",
    rewardClaim: {
      envelopeId: state.currentRewardEnvelope.envelopeId,
      roomDirectiveId: directive.directiveId,
      roomNonce: directive.roomNonce,
      claims: rewardClaims,
      reportedGoldDelta: body.integrityVersion === 1
        ? body.reportedGoldDelta
        : 0,
      reportedGoldTotal: body.integrityVersion === 1
        ? body.reportedGoldTotal
        : state.gold,
      turnCount: body.turnCount,
      elapsedMs: body.elapsedMs,
      commandJournalDigest: body.commandJournalDigest,
      compactRoomProof: JSON.stringify(body.compactRoomProof),
      ...(combatResources !== undefined
        ? { combatResources }
        : {})
    }
  };
  const rulesetContext = runtimeContext(state, {
    ...context,
    elapsedMs: body.elapsedMs
  }, ruleset.capabilities);
  const roomIntegrityState = body.integrityVersion === 1
    ? rankIntegrityRoomState(state)
    : null;
  const postRoomPact = ruleset.capabilities?.postRoomPactSettlement === "post-room-pact-v1" && directive.roomType === "pact";
  let nextState = await ruleset.consumeRoomDirective(
    structuredClone(state),
    operation,
    {
      ...rulesetContext,
      postRoomPactSettlement: postRoomPact ? "post-room-pact-v1" : undefined,
      rewardGoldContext: roomIntegrityState
        ? {
            build: structuredClone(roomIntegrityState.build),
            runModifiers: structuredClone(roomIntegrityState.runModifiers)
          }
        : null
    }
  );
  if (nextState.revision !== state.revision + 1) {
    throw new TypeError("ROOM_CHECKPOINT_REVISION_INVALID");
  }
  if (postRoomPact) {
    nextState = await ruleset.issuePactOffer(nextState, rulesetContext);
  }
  const authoritativeGoldDelta = Math.max(
    0,
    Number(nextState.rewardSettlementHistory?.at(-1)?.authoritativeGoldDelta) || 0
  );
  applyCheckpointRankEligibility(nextState, {
    integrityVersion: body.integrityVersion,
    integritySignals: body.integritySignals,
    goldIntegrityReasons: checkpointGoldIntegrityReasons(
      roomIntegrityState || state,
      body,
      authoritativeGoldDelta
    )
  });
  captureRankIntegrityRoomContext(nextState);
  const becameProvisional = wasOfficialRankEligible && !isOfficialRankEligible(nextState);
  return {
    nextState,
    response: {
      acceptedBoundary: "room_cleared",
      authoritativeDelta: {
        depth: nextState.depth,
        gold: nextState.gold,
        rewardOffer: nextState.pendingOffer
          ? publicPendingOffer(nextState, ruleset)
          : null
      }
    },
    storageEffects: [
      {
        type: "update_run",
        expectedRevision: state.revision
      },
      ...(becameProvisional
        ? [{ type: "delete_leaderboard_snapshot", runId: state.runId }]
        : [])
    ]
  };
}

async function issueMetaOffer(state, payload, ruleset, context) {
  const roomType = state.currentRoomDirective?.roomType;
  if (roomType === "merchant") {
    exactPayload(payload, [], "MERCHANT_OPEN_PAYLOAD_INVALID");
    return ruleset.issueMerchantInventory(state, context);
  }
  if (roomType === "forge") {
    const rawRequest = requireObject(payload, "FORGE_OPEN_PAYLOAD_INVALID");
    const request = rawRequest.mode === "transmute"
      ? exactPayload(
        rawRequest,
        ["mode", "sacrificeRelicId"],
        "FORGE_OPEN_PAYLOAD_INVALID"
      )
      : exactPayload(rawRequest, ["mode"], "FORGE_OPEN_PAYLOAD_INVALID");
    if (request.mode === "temper") {
      return ruleset.issueForgeTemperOffer(state, context);
    }
    if (request.mode === "transmute") {
      if (!String(request.sacrificeRelicId || "")) {
        throw new TypeError("FORGE_TRANSMUTE_SACRIFICE_REQUIRED");
      }
      return ruleset.issueForgeTransmuteOffer(state, {
        ...context,
        sacrificeRelicId: String(request.sacrificeRelicId)
      });
    }
    throw new TypeError("FORGE_MODE_INVALID");
  }
  if (roomType === "crossroads") {
    exactPayload(payload, [], "CROSSROADS_OPEN_PAYLOAD_INVALID");
    return ruleset.issueCrossroadsOffer(state, context);
  }
  if (roomType === "pact") {
    exactPayload(payload, [], "PACT_OPEN_PAYLOAD_INVALID");
    return ruleset.issuePactOffer(state, context);
  }
  throw new TypeError("META_TRANSACTION_ROOM_UNAVAILABLE");
}

async function commitMetaOffer(state, payload, ruleset, context) {
  const request = exactPayload(
    payload,
    ["transactionId", "choiceId"],
    "META_TRANSACTION_PAYLOAD_INVALID"
  );
  const source = state.pendingInventory?.sourceType;
  const method = {
    merchant: "commitMerchantTransaction",
    forge: "commitForgeTransaction",
    crossroads: "commitCrossroadsTransaction",
    camp: "commitCampTransaction",
    pact: "commitPactTransaction"
  }[source];
  if (!method || typeof ruleset[method] !== "function") {
    throw new TypeError("META_TRANSACTION_NOT_FOUND");
  }
  return ruleset[method](state, request, context);
}

export async function applyRulesetEvent(state, body, ruleset, context = {}) {
  if (state.status !== "active") throw new TypeError("RUN_NOT_ACTIVE");
  if (state.pendingPostRoomPact && body.type !== "commit_meta_transaction") {
    throw new TypeError("PACT_POST_ROOM_TRANSACTION_PENDING");
  }
  if (
    ruleset.capabilities?.postRoomPactSettlement === "post-room-pact-v1" &&
    state.pendingInventory?.sourceType === "pact" &&
    !state.pendingPostRoomPact
  ) {
    throw new TypeError("PACT_POST_ROOM_SETTLEMENT_REQUIRED");
  }
  const rulesetContext = runtimeContext(state, context, ruleset.capabilities);
  let nextState;
  const storageEffects = [{
    type: "update_run",
    expectedRevision: state.revision
  }];
  switch (body.type) {
    case "issue_relic_offer": {
      const request = exactPayload(
        body.payload,
        ["rewardSlotId"],
        "RELIC_REWARD_ISSUE_PAYLOAD_INVALID"
      );
      nextState = await ruleset.issueRegularRelicOffer(
        structuredClone(state),
        {
          rewardEnvelopeId: state.currentRewardEnvelope?.envelopeId,
          rewardSlotId: request.rewardSlotId,
          sourceDirectiveId: state.currentRoomDirective?.directiveId
        },
        rulesetContext
      );
      break;
    }
    case "select_relic": {
      const request = exactPayload(
        body.payload,
        ["offerId", "choiceId"],
        "RELIC_SELECTION_PAYLOAD_INVALID"
      );
      nextState = await ruleset.selectRegularRelic(
        structuredClone(state),
        request,
        rulesetContext
      );
      break;
    }
    case "commit_relic_replacement": {
      const request = exactPayload(
        body.payload,
        ["transactionId", "replacementChoiceId"],
        "RELIC_REPLACEMENT_PAYLOAD_INVALID"
      );
      nextState = await ruleset.commitRelicReplacement(
        structuredClone(state),
        request,
        rulesetContext
      );
      break;
    }
    case "cancel_relic_replacement": {
      const request = exactPayload(
        body.payload,
        ["transactionId"],
        "RELIC_REPLACEMENT_CANCEL_PAYLOAD_INVALID"
      );
      nextState = await ruleset.cancelRelicReplacement(
        structuredClone(state),
        request,
        rulesetContext
      );
      break;
    }
    case "commit_relic_fallback": {
      const request = exactPayload(
        body.payload,
        ["rewardSlotId"],
        "RELIC_FALLBACK_PAYLOAD_INVALID"
      );
      const slot = state.currentRewardEnvelope?.rewardSlots?.find(
        (entry) => entry.slotId === request.rewardSlotId
      );
      if (!slot) throw new TypeError("RELIC_REWARD_SLOT_UNKNOWN");
      nextState = await ruleset.commitRelicRewardFallback(
        structuredClone(state),
        {
          sourceType: slot.sourceType,
          sourceId: slot.sourceId,
          sourceDirectiveId: state.currentRoomDirective?.directiveId,
          rewardEnvelopeId: state.currentRewardEnvelope?.envelopeId,
          rewardSlotId: slot.slotId,
          acquisitionContext:
            slot.availabilityMode === "stored_reward"
              ? "stored_reward"
              : "pre_offer"
        },
        rulesetContext
      );
      break;
    }
    case "open_meta_offer":
      nextState = await issueMetaOffer(
        structuredClone(state),
        body.payload,
        ruleset,
        rulesetContext
      );
      break;
    case "commit_meta_transaction":
      nextState = await commitMetaOffer(
        structuredClone(state),
        body.payload,
        ruleset,
        rulesetContext
      );
      break;
    case "begin_camp_session":
      exactPayload(body.payload, [], "CAMP_BEGIN_PAYLOAD_INVALID");
      nextState = await ruleset.beginCampSession(
        structuredClone(state),
        rulesetContext
      );
      break;
    case "report_fatal_event": {
      const fatalPayload = body.payload === undefined ? {} : requireObject(body.payload, "FATAL_EVENT_PAYLOAD_INVALID");
      const boundarySettlement = fatalPayload.boundarySettlement;
      const fatalFields = Object.keys(fatalPayload)
        .filter((field) => field !== "boundarySettlement")
        .sort();
      const fatalAllowed = [
        "classification",
        "classification,elixirUsage",
        "classification,presentationCause",
        "classification,elixirUsage,presentationCause"
      ].includes(fatalFields.join(","));
      if (
        !fatalAllowed ||
        (boundarySettlement !== undefined && !supportsEventJournalBoundary(ruleset))
      ) throw new TypeError("FATAL_EVENT_PAYLOAD_INVALID_FIELDS");
      const eventState = boundarySettlement === undefined
        ? state
        : await settleEventJournalBoundary(
          state,
          boundarySettlement,
          "fatal",
          ruleset,
          context
        );
      const request = { ...fatalPayload };
      delete request.boundarySettlement;
      const result = await ruleset.reportFatalEvent(
        structuredClone(eventState),
        request,
        rulesetContext
      );
      nextState = result.nextState;
      if (
        result.publicResult?.resolution === "life_lost" &&
        isOfficialRankEligible(nextState)
      ) {
        storageEffects.push({
          type: "upsert_leaderboard_snapshot",
          entry: ruleset.createLeaderboardSnapshot(nextState, {
            snapshotKind: "death",
            outcome: "death",
            createdAt: context.now
          })
        });
      }
      break;
    }
    case "request_extraction": {
      const rawRequest = requireObject(body.payload, "EXTRACTION_PAYLOAD_INVALID");
      const hasBoundarySettlement = Object.hasOwn(rawRequest, "boundarySettlement");
      const request = exactPayload(rawRequest, hasBoundarySettlement
        ? ["mode", "boundarySettlement"]
        : ["mode"], "EXTRACTION_PAYLOAD_INVALID");
      if (hasBoundarySettlement && !supportsEventJournalBoundary(ruleset)) {
        throw new TypeError("EXTRACTION_PAYLOAD_INVALID_FIELDS");
      }
      const eventState = hasBoundarySettlement
        ? await settleEventJournalBoundary(
          state,
          request.boundarySettlement,
          "emergency",
          ruleset,
          context
        )
        : state;
      const result = ruleset.requestExtraction(
        structuredClone(eventState),
        { mode: request.mode }
      );
      nextState = result.nextState;
      if (isOfficialRankEligible(nextState)) {
        storageEffects.push({
          type: "upsert_leaderboard_snapshot",
          entry: ruleset.createLeaderboardSnapshot(nextState, {
            snapshotKind: "extract",
            outcome: "extract",
            createdAt: context.now
          })
        });
      }
      break;
    }
    case "mark_test_assistance": {
      const request = exactPayload(
        body.payload,
        ["assistanceClass"],
        "TEST_ASSISTANCE_PAYLOAD_INVALID"
      );
      nextState = ruleset.markTestAssistance(
        structuredClone(state),
        request
      );
      break;
    }
    case "open_camp_offer":
      exactPayload(body.payload, [], "CAMP_OPEN_PAYLOAD_INVALID");
      nextState = await ruleset.issueCampTransactions(
        structuredClone(state),
        rulesetContext
      );
      break;
    default:
      throw new TypeError("EVENT_TYPE_INVALID");
  }
  if (
    nextState.runId !== state.runId ||
    nextState.rulesetId !== state.rulesetId ||
    nextState.rulesetHash !== state.rulesetHash
  ) {
    throw new TypeError("RUNTIME_EVENT_BINDING_CHANGED");
  }
  if (typeof ruleset.refreshRewardEnvelope === "function") {
    await ruleset.refreshRewardEnvelope(nextState, rulesetContext);
  }
  captureRankIntegrityRoomContext(nextState);
  return {
    nextState,
    response: {
      acceptedEvent: body.type,
      eventResult: {
        pendingOffer: nextState.pendingOffer
          ? publicPendingOffer(nextState, ruleset)
          : null,
        pendingMetaTransaction: publicInventory(nextState, ruleset),
        pendingRelicReplacement: nextState.pendingRelicTransaction
          ? ruleset.projectPublicRelicReplacement(nextState)
          : null
      }
    },
    storageEffects
  };
}

export function finalizeRulesetRun(state, ruleset, context = {}) {
  if (typeof ruleset?.finalizeRun !== "function") {
    throw new TypeError("RULESET_METHOD_MISSING:finalizeRun");
  }
  const transition = ruleset.finalizeRun(structuredClone(state), {
    finalizedAt: context.now
  });
  initializeRankEligibility(transition.nextState);
  const rankEligibility = rankEligibilityOf(transition.nextState);
  transition.response.rankEligibility = rankEligibility;
  if (rankEligibility === "provisional") {
    delete transition.response.leaderboardEntryId;
    transition.storageEffects = transition.storageEffects.filter(
      (effect) => effect.type !== "upsert_leaderboard_snapshot"
    );
  }
  return transition;
}
