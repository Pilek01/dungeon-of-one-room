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

function runtimeContext(state, context = {}) {
  return {
    runId: state.runId,
    rulesetHash: state.rulesetHash,
    secret: context.secret,
    cryptoProvider: context.cryptoProvider,
    randomOracle: context.randomOracle,
    elapsedMs: context.elapsedMs
  };
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
  return {
    runId: state.runId,
    profileId: state.profileId || null,
    protocolVersion: state.protocolVersion,
    season: state.season,
    gameVersion: state.gameVersion,
    rulesetId: state.rulesetId,
    rulesetHash: state.rulesetHash,
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
    verificationLevel: state.verificationLevel
  };
}

export async function applyRulesetCheckpoint(state, body, ruleset, context = {}) {
  if (state.status !== "active") throw new TypeError("RUN_NOT_ACTIVE");
  const directive = state.currentRoomDirective;
  if (!directive) throw new TypeError("ROOM_DIRECTIVE_REQUIRED");
  if (body.roomResult !== "cleared") throw new TypeError("ROOM_RESULT_INVALID");
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
      claims: Array.isArray(body.rewardClaims)
        ? structuredClone(body.rewardClaims)
        : [],
      reportedGoldDelta: 0,
      reportedGoldTotal: state.gold,
      turnCount: body.turnCount,
      elapsedMs: body.elapsedMs,
      commandJournalDigest: body.commandJournalDigest,
      compactRoomProof: JSON.stringify(body.compactRoomProof)
    }
  };
  const nextState = await ruleset.consumeRoomDirective(
    structuredClone(state),
    operation,
    runtimeContext(state, {
      ...context,
      elapsedMs: body.elapsedMs
    })
  );
  if (nextState.revision !== state.revision + 1) {
    throw new TypeError("ROOM_CHECKPOINT_REVISION_INVALID");
  }
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
    storageEffects: [{
      type: "update_run",
      expectedRevision: state.revision
    }]
  };
}

async function issueMetaOffer(state, payload, ruleset, context) {
  const roomType = state.currentRoomDirective?.roomType;
  if (roomType === "merchant") {
    exactPayload(payload, [], "MERCHANT_OPEN_PAYLOAD_INVALID");
    return ruleset.issueMerchantInventory(state, context);
  }
  if (roomType === "forge") {
    const request = exactPayload(payload, ["mode"], "FORGE_OPEN_PAYLOAD_INVALID");
    if (request.mode === "temper") {
      return ruleset.issueForgeTemperOffer(state, context);
    }
    if (request.mode === "transmute") {
      return ruleset.issueForgeTransmuteOffer(state, context);
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
  const rulesetContext = runtimeContext(state, context);
  let nextState;
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
      const fatalFields = Object.keys(fatalPayload).sort();
      const fatalAllowed = [
        "classification",
        "classification,elixirUsage",
        "classification,presentationCause",
        "classification,elixirUsage,presentationCause"
      ].includes(fatalFields.join(","));
      if (!fatalAllowed) throw new TypeError("FATAL_EVENT_PAYLOAD_INVALID_FIELDS");
      const request = fatalPayload;
      const result = await ruleset.reportFatalEvent(
        structuredClone(state),
        request,
        rulesetContext
      );
      nextState = result.nextState;
      break;
    }
    case "request_extraction": {
      const request = exactPayload(
        body.payload,
        ["mode"],
        "EXTRACTION_PAYLOAD_INVALID"
      );
      const result = ruleset.requestExtraction(
        structuredClone(state),
        request
      );
      nextState = result.nextState;
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
    storageEffects: [{
      type: "update_run",
      expectedRevision: state.revision
    }]
  };
}

export function finalizeRulesetRun(state, ruleset, context = {}) {
  if (typeof ruleset?.finalizeRun !== "function") {
    throw new TypeError("RULESET_METHOD_MISSING:finalizeRun");
  }
  return ruleset.finalizeRun(structuredClone(state), {
    finalizedAt: context.now
  });
}
