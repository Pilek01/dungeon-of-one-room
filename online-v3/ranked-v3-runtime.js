(function installRankedV3Runtime(root) {
  "use strict";

  if (!root || !root.document) return;
  const protocol = root.DungeonRankedV3Protocol;
  const clientApi = root.DungeonRankedV3Client;
  const directives = root.DungeonRankedV3Directives;
  const offers = root.DungeonRankedV3Offers;
  const leaderboardUi = root.DungeonRankedV3LeaderboardUi;
  const ui = root.DungeonRankedV3Ui.createUi(root.document);
  const leaderboardEntry = root.document.createElement("button");
  leaderboardEntry.type = "button";
  leaderboardEntry.className = "ranked-v3-leaderboard-entry";
  leaderboardEntry.textContent = "Ranked Leaderboard";
  leaderboardEntry.hidden = true;
  leaderboardEntry.tabIndex = -1;
  leaderboardEntry.setAttribute("aria-hidden", "true");
  root.document.body.append(leaderboardEntry);
  let session = root.DungeonRankedV3Session.createStateMachine();
  let client = null;
  let leaderboardClient = null;
  let leaderboardRows = [];
  let leaderboardPage = 1;
  let leaderboardReturnFocus = null;
  let leaderboardFocusToken = null;
  let startedAt = 0;
  let pendingRoomSummary = null;
  let pendingBoundaryExit = null;
  let pendingExtractionMode = null;
  let pendingExtractionSource = null;
  let extractedProfileReady = false;
  let currentCampResponse = null;
  let campMutationPending = false;
  let pendingFreshCampaign = false;
  let pendingTestAssistance = false;
  let knownHudAssistanceClass = "none";
  let rankedHudSyncing = false;
  let lastRankedHudStatus = null;
  let pendingElixirUsage = null;
  let currentMerchantOffer = null;
  let merchantMutationPending = false;
  let merchantLeaveCompletedDirectiveId = "";
  const MERCHANT_FAILURE_LIMIT = 3;
  const MERCHANT_REASONS = new Set([
    "offer_pending", "no_canonical_choice", "bag_full", "stock_sufficient",
    "insufficient_wallet", "camp_reserve", "run_reserve", "no_useful_upgrade",
    "purchase_limit", "commit_rejected", "resync_required", "failure_backoff"
  ]);
  let merchantOperation = null;
  let merchantFailureCount = 0;
  const merchantConfirmedReceipts = new Set();
  let metaMutationPending = false;
  let postRoomPactOfferPending = false;
  let currentForgeOffer = null;
  let currentForgeContext = null;
  let forgeMutationPending = false;
  let otterChestMutationPending = false;
  let pendingNativeRelicReplacement = null;
  let observerBotBoundaryPending = false;
  let observerBotAutomationHalted = false;
  let boundaryOperation = null;
  let boundaryOperationGeneration = 0;
  let recoveryRootDiagnostic = null;
  let automaticResyncPending = false;
  let activeRoomIntegrity = null;
  let activeRoomDirectiveId = "";
  const shownRankIntegrityNotices = new Set();
  const recoveryStore = root.DungeonRankedV3Storage.createStore(root.localStorage);

  const ROOM_COMPLETION_CAPABILITY_INVALID = "local_room_completion_capability_invalid";
  const RANK_INTEGRITY_NOTICE_PREFIX = "dungeonOnlineV3RankIntegrityNotice:";
  const RANKED_DIAGNOSTICS_KEY = "dungeonOnlineV3Diagnostics:v1";
  const RANKED_DIAGNOSTICS_LIMIT = 20;
  let diagnosticEntries = loadDiagnostics();

  function sanitizeDiagnosticEntry(value = {}) {
    const reasonCodes = Array.isArray(value.reasonCodes)
      ? value.reasonCodes.map((entry) => String(entry || "").slice(0, 96)).filter(Boolean).slice(0, 16)
      : [];
    return {
      at: String(value.at || "").slice(0, 64),
      kind: String(value.kind || "unknown").slice(0, 48),
      code: String(value.code || "UNKNOWN").slice(0, 96),
      status: Math.max(0, Math.floor(Number(value.status) || 0)),
      traceId: String(value.traceId || "").slice(0, 128),
      runId: String(value.runId || "unknown").slice(0, 80),
      revision: Math.max(0, Math.floor(Number(value.revision) || 0)),
      sessionState: String(value.sessionState || "unknown").slice(0, 64),
      endpoint: String(value.endpoint || "unknown").slice(0, 48),
      operationId: String(value.operationId || "").slice(0, 128),
      action: String(value.action || "unknown").slice(0, 64),
      roomDirectiveId: String(value.roomDirectiveId || "").slice(0, 128),
      depth: Math.max(0, Math.floor(Number(value.depth) || 0)),
      roomType: String(value.roomType || "unknown").slice(0, 48),
      rulesetHash: String(value.rulesetHash || "unknown").slice(0, 96),
      gameVersion: String(value.gameVersion || "unknown").slice(0, 64),
      rankEligibility: String(value.rankEligibility || "unknown").slice(0, 32),
      reasonCodes
    };
  }

  function loadDiagnostics() {
    try {
      const parsed = JSON.parse(root.localStorage.getItem(RANKED_DIAGNOSTICS_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-RANKED_DIAGNOSTICS_LIMIT).filter((entry) => (
        entry && typeof entry === "object" && !Array.isArray(entry)
      )).map(sanitizeDiagnosticEntry);
    } catch {
      return [];
    }
  }

  function persistDiagnostics() {
    try {
      root.localStorage.setItem(RANKED_DIAGNOSTICS_KEY, JSON.stringify(diagnosticEntries));
    } catch {}
  }

  function diagnosticSnapshot() {
    const snapshot = client?.getSnapshot?.() || null;
    return {
      snapshot,
      state: snapshot?.publicState || null
    };
  }

  function recordDiagnostic(kind, input = {}) {
    const { snapshot, state } = diagnosticSnapshot();
    const pendingOperation = snapshot?.pendingOperation && typeof snapshot.pendingOperation === "object"
      ? snapshot.pendingOperation
      : null;
    const endpoint = String(input.endpoint || pendingOperation?.endpoint || "unknown").slice(0, 48);
    const action = String(pendingOperation?.body?.type || endpoint || "unknown").slice(0, 64);
    const directive = state?.currentRoomDirective && typeof state.currentRoomDirective === "object"
      ? state.currentRoomDirective
      : null;
    const reasonCodes = Array.isArray(input.reasonCodes)
      ? input.reasonCodes.map((entry) => String(entry || "")).filter(Boolean).slice(0, 16)
      : [];
    const entry = {
      at: new root.Date().toISOString(),
      kind: String(kind || "unknown").slice(0, 48),
      code: String(input.code || "UNKNOWN").slice(0, 96),
      status: Math.max(0, Math.floor(Number(input.status) || 0)),
      traceId: String(input.traceId || "").slice(0, 128),
      runId: String(state?.runId || snapshot?.runId || "unknown").slice(0, 80),
      revision: Math.max(0, Math.floor(Number(state?.revision ?? snapshot?.revision) || 0)),
      sessionState: String(session?.getState?.() || "unknown").slice(0, 64),
      endpoint,
      operationId: String(pendingOperation?.operationId || "").slice(0, 128),
      action,
      roomDirectiveId: String(directive?.directiveId || "").slice(0, 128),
      depth: Math.max(0, Math.floor(Number(directive?.depth ?? state?.depth) || 0)),
      roomType: String(directive?.roomType || state?.roomType || "unknown").slice(0, 48),
      rulesetHash: String(state?.rulesetHash || snapshot?.rulesetHash || "unknown").slice(0, 96),
      gameVersion: String(root.GAME_VERSION || state?.gameVersion || "unknown").slice(0, 64),
      rankEligibility: String(state?.rankEligibility || "unknown").slice(0, 32),
      reasonCodes
    };
    diagnosticEntries = [...diagnosticEntries, entry].slice(-RANKED_DIAGNOSTICS_LIMIT);
    persistDiagnostics();
    if (isRankedObserverBotActive()) {
      try {
        root.DungeonOnlineV3GameBridge?.recordRankedDiagnostic?.({
          ...entry,
          reasonCodes: [...reasonCodes]
        });
      } catch {}
    }
    return entry;
  }

  function diagnosticLabel(entry) {
    const runId = String(entry?.runId || "unknown");
    const shortRunId = runId.length > 16 ? `${runId.slice(0, 16)}…` : runId;
    const traceId = String(entry?.traceId || "none");
    return `${entry?.code || "UNKNOWN"} · ${shortRunId} · rev ${entry?.revision ?? 0} · ${entry?.endpoint || "unknown"} · trace ${traceId}`;
  }

  function exportDiagnostics(rootDiagnostic) {
    const payload = {
      format: "dungeon-ranked-diagnostics-v1",
      generatedAt: new root.Date().toISOString(),
      rootDiagnostic: rootDiagnostic ? sanitizeDiagnosticEntry(rootDiagnostic) : null,
      diagnostics: diagnosticEntries.map(sanitizeDiagnosticEntry)
    };
    const stamp = payload.generatedAt.replace(/[:.]/gu, "-");
    const filename = `ranked-diagnostics-${stamp}.json`;
    return root.DungeonOnlineV3GameBridge?.exportRankedDiagnostics?.(
      filename,
      JSON.stringify(payload, null, 2)
    ) === true;
  }

  function clearPendingExtractionIntent() {
    pendingExtractionMode = null;
    pendingExtractionSource = null;
  }

  function clearRecoveredPortalIntent() {
    if (pendingBoundaryExit !== "portal") return;
    pendingBoundaryExit = null;
    pendingRoomSummary = null;
  }

  function sameCanonicalDirective(left, right) {
    const leftId = String(left?.directiveId || "");
    const rightId = String(right?.directiveId || "");
    if (!leftId || leftId !== rightId) return false;
    const leftNonce = String(left?.roomNonce || "");
    const rightNonce = String(right?.roomNonce || "");
    return leftNonce === rightNonce;
  }

  function rememberPendingExtraction(mode) {
    if (pendingExtractionMode) return;
    const state = createClient().getSnapshot()?.publicState;
    pendingExtractionMode = mode;
    pendingExtractionSource = {
      directiveId: String(state?.currentRoomDirective?.directiveId || ""),
      revision: Math.max(0, Math.floor(Number(state?.revision) || 0)),
      roomsCompleted: Math.max(0, Math.floor(Number(state?.statistics?.roomsCompleted) || 0))
    };
  }

  function extractionCheckpointCommitted(state) {
    if (pendingExtractionMode !== "normal" || !pendingExtractionSource) return true;
    const directiveId = String(state?.currentRoomDirective?.directiveId || "");
    const revision = Math.max(0, Math.floor(Number(state?.revision) || 0));
    const roomsCompleted = Math.max(0, Math.floor(Number(state?.statistics?.roomsCompleted) || 0));
    return Boolean(
      (
        directiveId !== pendingExtractionSource.directiveId &&
        revision > pendingExtractionSource.revision
      ) ||
      roomsCompleted > pendingExtractionSource.roomsCompleted
    );
  }

  function presentRankIntegrityNotice(state, onContinue) {
    if (state?.rankEligibility !== "provisional") return false;
    const runId = String(state.runId || "unknown");
    const storageKey = `${RANK_INTEGRITY_NOTICE_PREFIX}${runId}`;
    let alreadyShown = shownRankIntegrityNotices.has(runId);
    try {
      alreadyShown ||= root.localStorage.getItem(storageKey) === "1";
    } catch {}
    if (alreadyShown) return false;
    shownRankIntegrityNotices.add(runId);
    try {
      root.localStorage.setItem(storageKey, "1");
    } catch {}
    const reasons = Array.isArray(state?.rankIntegrity?.reasonCodes)
      ? state.rankIntegrity.reasonCodes
      : [];
    const diagnostic = recordDiagnostic("rank_integrity_provisional", {
      code: reasons[0] || "RANK_INTEGRITY_PROVISIONAL",
      reasonCodes: reasons,
      endpoint: "integrity"
    });
    ui.showMessage(
      "Ranked integrity check failed.",
      `You can continue playing, but this run will not be submitted to the leaderboard. Diagnostic: ${diagnosticLabel(diagnostic)}.`,
      [ui.button("Continue", onContinue)]
    );
    return true;
  }

  function installRoomIntegrityContext(directive) {
    const completionCapability = root.crypto.randomUUID();
    activeRoomIntegrity = {
      directiveId: String(directive?.directiveId || ""),
      completionCapability
    };
    const startingGold = Math.max(
      0,
      Math.floor(Number(createClient().getSnapshot()?.publicState?.gold) || 0)
    );
    const rulesetHash = createClient().getSnapshot()?.publicState?.rulesetHash;
    root.DungeonOnlineV3GameBridge?.setRoomIntegrityContext?.({
      completionCapability,
      startingGold,
      boundedProcClaims: protocol.supportsBoundedProcClaims?.(rulesetHash) === true,
      boundedCombatResources: protocol.supportsBoundedCombatResources?.(rulesetHash) === true,
      orderedPotionClaims: protocol.supportsPotionClaimOrdering?.(rulesetHash) === true
    });
  }

  function usesBoundarySettlement() {
    const rulesetHash = createClient().getSnapshot()?.publicState?.rulesetHash;
    return protocol.supportsBoundarySettlement?.(rulesetHash) === true;
  }

  function supportsPostRoomPactSettlement(state = null) {
    const publicState = state || createClient().getSnapshot()?.publicState;
    const rulesetHash = publicState?.rulesetHash;
    if (typeof protocol.supportsPostRoomPact === "function") {
      return protocol.supportsPostRoomPact(rulesetHash) === true;
    }
    return false;
  }

  function hasRankedBoundaryBinding(state) {
    return Boolean(state?.currentRoomDirective && state?.currentRewardEnvelope);
  }

  async function ensureRankedBoundaryBinding() {
    const current = createClient().getSnapshot()?.publicState;
    if (hasRankedBoundaryBinding(current)) return current;
    const response = await createClient().resumeCanonical();
    const restored = response?.metaState || createClient().getSnapshot()?.publicState;
    if (!hasRankedBoundaryBinding(restored)) {
      throw new TypeError("RANKED_BOUNDARY_BINDING_UNAVAILABLE");
    }
    const restoredDirectiveId = String(restored.currentRoomDirective.directiveId || "");
    if (activeRoomDirectiveId && restoredDirectiveId !== activeRoomDirectiveId) {
      throw new TypeError("RANKED_BOUNDARY_BINDING_MISMATCH");
    }
    return restored;
  }

  function captureRankedBoundary() {
    const captured = root.DungeonOnlineV3GameBridge?.captureRankedBoundary?.();
    if (!captured || typeof captured !== "object") {
      throw new TypeError("RANKED_BOUNDARY_CAPTURE_UNAVAILABLE");
    }
    const snapshot = createClient().getSnapshot()?.publicState;
    const directive = snapshot?.currentRoomDirective;
    const envelope = snapshot?.currentRewardEnvelope;
    if (!directive || !envelope) throw new TypeError("RANKED_BOUNDARY_BINDING_UNAVAILABLE");
    const reportedGoldDelta = Math.max(0, Math.floor(Number(captured.reportedGoldDelta) || 0));
    const turnCount = Math.max(0, Math.floor(Number(captured.turnCount) || 0));
    const boundaryRevision = Math.max(0, Math.floor(Number(snapshot.revision) || 0));
    const boundaryFatalEvents = Math.max(0, Math.floor(Number(snapshot.lifeState?.fatalEvents) || 0));
    const boundedCombatResources = protocol.supportsBoundedCombatResources?.(snapshot?.rulesetHash) === true
      ? { hp: Math.max(0, Math.floor(Number(captured.hp) || 0)), maxHp: Math.max(0, Math.floor(Number(captured.maxHp) || 0)) }
      : null;
    return {
      summary: {
        turnCount,
        rewardClaims: Array.isArray(captured.rewardClaims) ? captured.rewardClaims : [],
        reportedGoldDelta,
        ...(boundedCombatResources ? { combatResources: boundedCombatResources } : {}),
        integritySignals: Array.isArray(pendingRoomSummary?.integritySignals)
          ? pendingRoomSummary.integritySignals
          : []
      },
      eventPayload: {
        envelopeId: envelope.envelopeId,
        roomDirectiveId: directive.directiveId,
        roomNonce: directive.roomNonce,
        claims: Array.isArray(captured.rewardClaims) ? captured.rewardClaims : [],
        reportedGoldDelta,
        reportedGoldTotal: Math.max(0, Math.floor(Number(snapshot.gold) || 0)) + reportedGoldDelta,
        turnCount,
        elapsedMs: Math.max(0, Date.now() - startedAt),
        commandJournalDigest: `boundary:${directive.directiveId}:${boundaryRevision}:${boundaryFatalEvents}:${turnCount}`,
        ...(boundedCombatResources ? { combatResources: boundedCombatResources } : {}),
        compactRoomProof: JSON.stringify({
          version: 1,
          roomDirectiveId: directive.directiveId,
          roomNonce: directive.roomNonce
        })
      }
    };
  }

  function mergeCapturedBoundary(captured) {
    const previousGoldDelta = Math.max(
      0,
      Math.floor(Number(pendingRoomSummary?.reportedGoldDelta) || 0)
    );
    const capturedGoldDelta = Math.max(
      0,
      Math.floor(Number(captured?.summary?.reportedGoldDelta) || 0)
    );
    const reportedGoldDelta = Math.max(previousGoldDelta, capturedGoldDelta);
    return {
      summary: {
        ...captured.summary,
        reportedGoldDelta
      },
      eventPayload: {
        ...captured.eventPayload,
        reportedGoldDelta,
        reportedGoldTotal:
          Math.max(0, Number(captured.eventPayload?.reportedGoldTotal) || 0) - capturedGoldDelta + reportedGoldDelta
      }
    };
  }

  function normalizePresentationCause(value) {
    if (typeof value !== "string") return "";
    return value
      .replace(/[\u0000-\u001f\u007f]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 160);
  }
  function publicName() {
    return String(root.localStorage.getItem("dungeonOneRoomPlayerName") || "Anonymous").slice(0, 18);
  }

  async function installationHash() {
    const store = root.DungeonRankedV3Storage.createStore(root.localStorage);
    const id = store.getInstallationId(() => root.crypto.randomUUID());
    return clientApi.sha256Hex(id, root.crypto);
  }

  function createClient() {
    if (client) return client;
    client = clientApi.createRankedClient({
      baseUrl: String(root.DUNGEON_ONLINE_V3_API || ""),
      storage: root.localStorage,
      cryptoProvider: root.crypto,
      onSnapshot(snapshot) {
        rankedHudSyncing = Boolean(snapshot?.pendingOperation);
        root.DungeonOnlineV3GameBridge?.refreshRankedHud?.();
      },
      log(kind, detail) {
        if (root.DUNGEON_ONLINE_V3_DEBUG === true) console.debug(`[Online v3] ${kind}`, detail);
      }
    });
    return client;
  }

  function setRankedHudSyncing(syncing) {
    rankedHudSyncing = syncing === true;
    root.DungeonOnlineV3GameBridge?.refreshRankedHud?.();
  }

  function isBoundaryOperationBlockedState(state = session.getState()) {
    return [
      root.DungeonRankedV3Session.STATES.reconnect,
      root.DungeonRankedV3Session.STATES.protocolError,
      root.DungeonRankedV3Session.STATES.abandoned,
      root.DungeonRankedV3Session.STATES.finalized
    ].includes(state);
  }

  function isCurrentBoundaryOperation(operation) {
    return Boolean(
      operation &&
      boundaryOperation === operation &&
      operation.generation === boundaryOperationGeneration
    );
  }

  function isCurrentOperationGeneration(operation) {
    return Boolean(
      operation &&
      operation.generation === boundaryOperationGeneration &&
      !isBoundaryOperationBlockedState()
    );
  }

  function clearBoundaryLoading(operation) {
    if (operation?.loadingTimer !== null && operation?.loadingTimer !== undefined) {
      root.clearTimeout(operation.loadingTimer);
      operation.loadingTimer = null;
    }
  }

  function invalidateBoundaryOperations() {
    boundaryOperationGeneration += 1;
    clearBoundaryLoading(boundaryOperation);
    boundaryOperation = null;
    observerBotBoundaryPending = false;
  }

  function startBoundaryOperation(task, options = {}) {
    if (boundaryOperation) return boundaryOperation.promise;
    if (isBoundaryOperationBlockedState()) return Promise.resolve(false);
    const operation = {
      generation: boundaryOperationGeneration + 1,
      loadingTimer: null,
      promise: null
    };
    boundaryOperationGeneration = operation.generation;
    boundaryOperation = operation;
    if (isRankedObserverBotActive()) observerBotBoundaryPending = true;
    const loadingMessage = String(options.loadingMessage || "");
    if (loadingMessage && options.silent !== true) {
      operation.loadingTimer = root.setTimeout(() => {
        if (isCurrentBoundaryOperation(operation)) ui.showSync(loadingMessage);
      }, 180);
    }
    let taskResult;
    try {
      taskResult = task(operation);
    } catch (error) {
      taskResult = Promise.reject(error);
    }
    operation.promise = Promise.resolve(taskResult)
      .catch((error) => {
        if (isCurrentBoundaryOperation(operation)) {
          (typeof options.onError === "function" ? options.onError : presentError)(error);
        }
        return false;
      })
      .finally(() => {
        clearBoundaryLoading(operation);
        if (isCurrentBoundaryOperation(operation)) {
          boundaryOperation = null;
          observerBotBoundaryPending = false;
        }
      });
    return operation.promise;
  }

  function getRankedHudStatus() {
    if (!root.DungeonOnlineV3GameBridge?.isRanked?.()) {
      lastRankedHudStatus = null;
      return null;
    }
    const snapshot = client?.getSnapshot?.() || null;
    const publicState = snapshot?.publicState && typeof snapshot.publicState === "object"
      ? {
          ...snapshot.publicState,
          assistanceClass: snapshot.publicState.assistanceClass || knownHudAssistanceClass
        }
      : null;
    const syncing = rankedHudSyncing || Boolean(snapshot?.pendingOperation);
    lastRankedHudStatus = root.DungeonRankedV3Ui.deriveHudRunStatus(publicState, {
      ranked: true,
      syncing,
      previous: lastRankedHudStatus
    });
    return lastRankedHudStatus;
  }

  function isRankedObserverBotActive() {
    const active = Boolean(root.DungeonOnlineV3GameBridge?.isRankedTestBotActive?.());
    if (!active) {
      observerBotBoundaryPending = false;
      observerBotAutomationHalted = false;
    }
    return active;
  }

  function isObserverBotBoundaryPending() {
    return Boolean(
      isRankedObserverBotActive() &&
      (observerBotBoundaryPending || observerBotAutomationHalted)
    );
  }

  function isRankedAutomationBlocked() {
    return Boolean(
      isRankedObserverBotActive() &&
      (observerBotBoundaryPending ||
        observerBotAutomationHalted ||
        ["pending", "uncertain", "resyncing", "backoff"].includes(merchantOperation?.status) ||
        boundaryOperation ||
        campMutationPending ||
        merchantMutationPending ||
        metaMutationPending ||
        forgeMutationPending ||
        pendingNativeRelicReplacement)
    );
  }

  async function runObserverBotBoundary(task) {
    if (!isRankedObserverBotActive()) return task();
    if (observerBotAutomationHalted) return false;
    const nested = observerBotBoundaryPending;
    if (!nested) observerBotBoundaryPending = true;
    try {
      return await task();
    } catch (error) {
      observerBotAutomationHalted = true;
      presentError(error);
      return false;
    } finally {
      if (!nested) observerBotBoundaryPending = false;
    }
  }

  function stableObserverBotChoice(entries, idField, preferAction = false) {
    const available = Array.isArray(entries)
      ? entries.filter((entry) =>
          entry &&
          (!entry.status || entry.status === "available") &&
          String(entry[idField] || "")
        )
      : [];
    const actionable = preferAction
      ? available.filter((entry) => String(entry.kind || "") !== "leave")
      : available;
    const pool = actionable.length > 0 ? actionable : available;
    return pool.sort((left, right) => {
      const leftId = String(left[idField] || "");
      const rightId = String(right[idField] || "");
      return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    })[0] || null;
  }

  function resetLocalRankedSession() {
    invalidateBoundaryOperations();
    recoveryRootDiagnostic = null;
    automaticResyncPending = false;
    clearPendingExtractionIntent();
    pendingBoundaryExit = null;
    extractedProfileReady = false;
    pendingFreshCampaign = false;
    pendingTestAssistance = false;
    pendingElixirUsage = null;
    currentForgeOffer = null;
    currentForgeContext = null;
    forgeMutationPending = false;
    metaMutationPending = false;
    postRoomPactOfferPending = false;
    pendingNativeRelicReplacement = null;
    observerBotAutomationHalted = false;
    client?.releaseWriter?.();
    client?.clear?.();
    client = null;
    recoveryStore.clearSession();
    recoveryStore.clearWriterLease();
  }

  function prepareFreshRankedStart(clearProfile = false) {
    if (recoveryStore.loadRecovery()) return false;
    resetLocalRankedSession();
    recoveryStore.clearRecovery();
    if (clearProfile) recoveryStore.clearProfile();
    session = root.DungeonRankedV3Session.createStateMachine(
      root.DungeonRankedV3Session.STATES.abandoned
    );
    return true;
  }

  function markFreshCampaign() {
    pendingFreshCampaign = true;
  }
  function recordElixirUsage(payload = {}) {
    if (!root.DungeonOnlineV3GameBridge?.isRanked?.()) return false;
    const elixirId = String(payload.elixirId || "");
    if (!elixirId) return false;
    if (pendingElixirUsage && pendingElixirUsage.elixirId !== elixirId) return false;
    pendingElixirUsage = {
      elixirId,
      count: Math.min(5, Math.max(0, Number(pendingElixirUsage?.count) || 0) + 1)
    };
    return true;
  }
  function appendElixirUsageClaim(claims) {
    const next = Array.isArray(claims) ? claims.map((claim) => ({ ...claim })) : [];
    if (!pendingElixirUsage || pendingElixirUsage.count <= 0) return next;
    next.push({
      claimType: "resource",
      claimId: "elixir-use",
      count: pendingElixirUsage.count,
      localEvidence: { elixirId: pendingElixirUsage.elixirId }
    });
    return next;
  }

  function returnFromFailedStartToMainMenu() {
    resetLocalRankedSession();
    currentCampResponse = null;
    session = root.DungeonRankedV3Session.createStateMachine(
      root.DungeonRankedV3Session.STATES.abandoned
    );
    pendingFreshCampaign = false;
    pendingElixirUsage = null;
    root.DungeonOnlineV3GameBridge?.returnToPractice?.();
    ui.hide();
  }

  function createLeaderboardClient() {
    if (leaderboardClient) return leaderboardClient;
    leaderboardClient = clientApi.createLeaderboardClient({
      baseUrl: String(root.DUNGEON_ONLINE_V3_API || ""),
      cryptoProvider: root.crypto,
      log(kind, detail) {
        if (root.DUNGEON_ONLINE_V3_DEBUG === true) console.debug(`[Online v3] ${kind}`, detail);
      }
    });
    return leaderboardClient;
  }

  function scheduleLeaderboardFocus(callback) {
    if (typeof root.requestAnimationFrame === "function") {
      root.requestAnimationFrame(callback);
      return;
    }
    callback();
  }

  function connectedLeaderboardFocusTarget(target) {
    return Boolean(target && target.isConnected !== false && typeof target.focus === "function");
  }

  function restoreLeaderboardFocus() {
    const target = leaderboardReturnFocus;
    leaderboardReturnFocus = null;
    leaderboardFocusToken = null;
    scheduleLeaderboardFocus(() => {
      if (connectedLeaderboardFocusTarget(target)) {
        target.focus();
        return;
      }
      root.document.activeElement?.blur?.();
    });
  }

  function closeLeaderboardOverlay() {
    ui.hide();
    restoreLeaderboardFocus();
  }

  function focusLeaderboardContent(content, detailOpen = false) {
    scheduleLeaderboardFocus(() => {
      if (detailOpen) {
        const target = content.querySelector?.('[data-record-nav-region="equipment"], [data-record-nav-region="detail-action"]');
        if (target) {
          target.focus?.();
          return;
        }
      }
      leaderboardUi.focusReferencePlateAction(content, leaderboardFocusToken || {}, true);
    });
  }

  function showLeaderboardRows() {
    const presentation = leaderboardUi.createLeaderboardPresentation(leaderboardRows, leaderboardPage);
    leaderboardPage = presentation.page;
    const content = leaderboardUi.renderList(root.document, presentation, {
      onOpen: (runId, action) => {
        leaderboardFocusToken = leaderboardUi.createReferencePlateFocusToken(runId, action);
        openLeaderboardDetail(runId);
      },
      onPage: (page) => {
        leaderboardPage = page;
        leaderboardFocusToken = null;
        showLeaderboardRows();
      },
      onClose: closeLeaderboardOverlay
    });
    ui.showContent(
      "Ranked Leaderboard",
      leaderboardRows.length
        ? "The strongest descents of the current season."
        : "No Ranked results have been published this season.",
      content
    );
    focusLeaderboardContent(content);
  }

  async function openLeaderboard(reset = true, opener = null) {
    try {
      if (reset) {
        const active = connectedLeaderboardFocusTarget(opener) ? opener : root.document.activeElement;
        if (active && active !== root.document.body && !ui.overlay.contains?.(active)) {
          leaderboardReturnFocus = active;
        }
        leaderboardRows = [];
        leaderboardPage = 1;
        leaderboardFocusToken = null;
      }
      ui.showMessage("Ranked Leaderboard", "Loading season results...");
      leaderboardRows = await leaderboardUi.collectLeaderboardRows(
        (request) => createLeaderboardClient().list(request),
        { season: String(root.DUNGEON_ONLINE_V3_SEASON || "local-m4") }
      );
      showLeaderboardRows();
    } catch {
      ui.showMessage("Leaderboard unavailable", "Season results could not be loaded.", [
        ui.button("Retry", () => openLeaderboard(false)),
        ui.button("Close", closeLeaderboardOverlay)
      ]);
    }
  }

  async function openLeaderboardDetail(runId) {
    try {
      ui.showMessage("Build Chronicle", "Loading this descent...");
      const selected = leaderboardRows.find((row) => String(row?.runId || "") === String(runId || ""));
      const payload = await createLeaderboardClient().detail(runId);
      const sourceEntry = payload?.entry && typeof payload.entry === "object" ? payload.entry : {};
      const entry = { ...(selected || {}), ...sourceEntry };
      if (selected && (!Number.isInteger(entry.rank) || entry.rank <= 0)) {
        entry.rank = selected.rank;
      }
      const detail = leaderboardUi.createDetailViewModel({
        ...(payload && typeof payload === "object" ? payload : {}),
        entry
      });
      const content = leaderboardUi.renderDetail(root.document, detail, {
        onBack: showLeaderboardRows,
        onClose: closeLeaderboardOverlay
      });
      ui.showContent("Build Chronicle", displaySeason(detail.season), content);
      focusLeaderboardContent(content, true);
    } catch {
      ui.showMessage("Build details unavailable", "This Ranked build could not be loaded.", [
        ui.button("Back to leaderboard", showLeaderboardRows),
        ui.button("Close", closeLeaderboardOverlay)
      ]);
    }
  }

  function moveToRecoveryState(target) {
    if (session.getState() === target) return;
    try {
      session.transition(target);
    } catch {
      if (target !== root.DungeonRankedV3Session.STATES.protocolError) {
        throw new TypeError(`RANKED_RECOVERY_TRANSITION_INVALID:${session.getState()}:${target}`);
      }
    }
  }

  async function resyncCanonical(options = {}) {
    invalidateBoundaryOperations();
    setRankedHudSyncing(true);
    moveToRecoveryState(root.DungeonRankedV3Session.STATES.retrying);
    if (options.automatic !== true) ui.setStatus("Synchronizing Ranked…");
    return startBoundaryOperation(async (operation) => {
      const previousDirective = createClient().getSnapshot()?.publicState?.currentRoomDirective;
      const shouldPreserveBoundary = Boolean(pendingRoomSummary);
      const response = await createClient().resumeCanonical();
      if (!isCurrentBoundaryOperation(operation)) return true;
      if (
        shouldPreserveBoundary &&
        sameCanonicalDirective(previousDirective, response.metaState?.currentRoomDirective)
      ) {
        const resolved = await resolveCheckpoint({
          loadingMessage: pendingBoundaryExit === "portal" ? "Loading next depth…" : "Saving progress...",
          onError(error) {
            automaticResyncPending = false;
            presentError(error, {
              automaticResyncFailed: true,
              rootDiagnostic: options.rootDiagnostic || recoveryRootDiagnostic
            });
          }
        }, operation);
        if (!resolved || !isCurrentBoundaryOperation(operation)) return resolved;
        recoveryRootDiagnostic = null;
        automaticResyncPending = false;
        observerBotAutomationHalted = false;
        return true;
      }
      clearRecoveredPortalIntent();
      await acceptResponse(response, operation);
      if (!isCurrentBoundaryOperation(operation)) return true;
      recoveryRootDiagnostic = null;
      automaticResyncPending = false;
      observerBotAutomationHalted = false;
      return true;
    }, {
      loadingMessage: "Synchronizing Ranked…",
      onError(error) {
        automaticResyncPending = false;
        presentError(error, {
          automaticResyncFailed: options.automatic === true,
          rootDiagnostic: options.rootDiagnostic || recoveryRootDiagnostic
        });
      }
    });
  }

  function returnToPractice() {
    invalidateBoundaryOperations();
    recoveryRootDiagnostic = null;
    automaticResyncPending = false;
    knownHudAssistanceClass = "none";
    rankedHudSyncing = false;
    lastRankedHudStatus = null;
    pendingFreshCampaign = false;
    pendingElixirUsage = null;
    metaMutationPending = false;
    postRoomPactOfferPending = false;
    if (session.getState() === root.DungeonRankedV3Session.STATES.abandoned) {
      root.DungeonOnlineV3GameBridge?.returnToPractice?.();
      ui.hide();
      return;
    }
    if (session.getState() === root.DungeonRankedV3Session.STATES.finalized) {
      clearEndedRecovery();
      return;
    }
    if (![root.DungeonRankedV3Session.STATES.reconnect, root.DungeonRankedV3Session.STATES.protocolError].includes(session.getState())) {
      moveToRecoveryState(root.DungeonRankedV3Session.STATES.reconnect);
    }
    client?.releaseWriter?.();
    client?.clear();
    client = null;
    const abandonedLocalSession = root.DungeonRankedV3Session.STATES.abandoned;
    if (abandonedLocalSession !== "ABANDONED_LOCAL_SESSION") {
      throw new TypeError("RANKED_ABANDONED_STATE_MISMATCH");
    }
    session.transition(abandonedLocalSession);
    root.DungeonOnlineV3GameBridge?.returnToPractice?.();
    ui.hide();
  }

  function clearEndedRecovery() {
    invalidateBoundaryOperations();
    recoveryRootDiagnostic = null;
    automaticResyncPending = false;
    pendingFreshCampaign = false;
    pendingElixirUsage = null;
    metaMutationPending = false;
    postRoomPactOfferPending = false;
    client?.releaseWriter?.();
    client?.clearRecovery?.();
    client?.clear();
    recoveryStore.clearProfile();
    client = null;
    const abandonedLocalSession = root.DungeonRankedV3Session.STATES.abandoned;
    if (abandonedLocalSession !== "ABANDONED_LOCAL_SESSION") {
      throw new TypeError("RANKED_ABANDONED_STATE_MISMATCH");
    }
    session = root.DungeonRankedV3Session.createStateMachine(abandonedLocalSession);
    root.DungeonOnlineV3GameBridge?.returnToPractice?.();
    ui.hide();
  }

  async function startAfterEndedRecovery() {
    clearEndedRecovery();
    markFreshCampaign();
    await startRanked();
  }

  const endedRecoveryCodes = Object.freeze([
    "RUN_RECOVERY_UNAVAILABLE",
    "RUN_NOT_FOUND",
    "FINALIZED_RUN_IMMUTABLE"
  ]);

  function isEndedRecoveryError(error) {
    return endedRecoveryCodes.includes(String(error?.code || ""));
  }

  function isUnrecoverableLocalSave(error) {
    return ["RECOVERY_UNAUTHORIZED", "RECOVERY_CREDENTIAL_INVALID"].includes(String(error?.code || "")) ||
      String(error?.message || "") === "RANKED_RECOVERY_CREDENTIAL_MISSING";
  }

  async function startFromUnrecoverableRecovery() {
    clearEndedRecovery();
    markFreshCampaign();
    await startRanked();
  }

  async function abandonCanonical() {
    invalidateBoundaryOperations();
    automaticResyncPending = false;
    pendingFreshCampaign = false;
    pendingElixirUsage = null;
    ui.setStatus("Abandoning your Ranked run...");
    await createClient().abandonCanonical();
    client = null;
    moveToRecoveryState(root.DungeonRankedV3Session.STATES.abandoned);
    root.DungeonOnlineV3GameBridge?.returnToPractice?.();
    ui.hide();
  }

  async function startNewRanked() {
    if (recoveryStore.loadRecovery()) {
      moveToRecoveryState(root.DungeonRankedV3Session.STATES.retrying);
      ui.setStatus("Ending the saved Ranked run...");
      try {
        await createClient().abandonCanonical();
        client = null;
        session = root.DungeonRankedV3Session.createStateMachine(
          root.DungeonRankedV3Session.STATES.abandoned
        );
      } catch (error) {
        if (!isEndedRecoveryError(error) && !isUnrecoverableLocalSave(error)) throw error;
        clearEndedRecovery();
      }
    }
    markFreshCampaign();
    await startRanked();
  }

  function confirmAbandon() {
    ui.showMessage(
      "Abandon Ranked Run?",
      "This permanently ends this run. It will not appear on the leaderboard.",
      [
        ui.button("Confirm abandonment", () => abandonCanonical().catch(presentError)),
        ui.button("Keep recovery", () => presentError({ code: "RECOVERY_PRESERVED", status: 0 }))
      ]
    );
  }

  function isTransientRecoveryError(error) {
    const code = String(error?.code || "");
    return Boolean(
      error?.conflict ||
      error?.status === 409 ||
      [
        "NETWORK_ERROR",
        "TIMEOUT",
        "TOKEN_EXPIRED",
        "REVISION_CONFLICT",
        "STATE_DIGEST_CONFLICT",
        "ROOM_TOKEN_CONFLICT"
      ].includes(code)
    );
  }

  function presentError(error, options = {}) {
    invalidateBoundaryOperations();
    setRankedHudSyncing(true);
    if (isRankedObserverBotActive()) observerBotAutomationHalted = true;
    const code = String(error?.code || "");
    const diagnostic = recordDiagnostic("client_error", {
      code: code || String(error?.message || "UNKNOWN_ERROR"),
      status: error?.status,
      traceId: error?.traceId
    });
    if (!recoveryRootDiagnostic) recoveryRootDiagnostic = options.rootDiagnostic || diagnostic;
    const rootDiagnostic = options.rootDiagnostic || recoveryRootDiagnostic || diagnostic;
    const rootCode = String(rootDiagnostic?.code || code);
    const conflict = error?.conflict || error?.status === 409;
    const writerHeld = ["RANKED_WRITER_LEASE_HELD", "RANKED_MUTATION_LOCKED"].includes(String(error?.message || ""));
    const protocolFailure = error instanceof TypeError && !writerHeld || [
      "PROTOCOL_VERSION_MISMATCH",
      "RESPONSE_NOT_JSON"
    ].includes(code);
    moveToRecoveryState(protocolFailure
      ? root.DungeonRankedV3Session.STATES.protocolError
      : root.DungeonRankedV3Session.STATES.reconnect);
    if (root.DUNGEON_ONLINE_V3_DEBUG === true) {
      console.debug("[Online v3] client error", {
        name: String(error?.name || "Error"),
        code,
        status: Number(error?.status) || 0,
        message: String(error?.message || "")
      });
    }
    if (
      options.automaticResyncFailed !== true &&
      !protocolFailure &&
      isTransientRecoveryError(error)
    ) {
      ui.showSync("Synchronizing Ranked…");
      if (!automaticResyncPending) {
        automaticResyncPending = true;
        root.setTimeout(() => {
          resyncCanonical({ automatic: true, rootDiagnostic }).catch((resyncError) => {
            automaticResyncPending = false;
            presentError(resyncError, { automaticResyncFailed: true, rootDiagnostic });
          });
        }, 0);
      }
      return;
    }
    automaticResyncPending = false;
    if (isEndedRecoveryError(error)) {
      ui.showMessage(
        "Ranked Run Ended",
        "This Ranked run has already ended. Clear it to begin a new descent.",
        [
          ui.button("Start New Ranked Run", () => startAfterEndedRecovery().catch(presentError)),
          ui.button("Main Menu", clearEndedRecovery)
        ]
      );
      return;
    }
    if (isUnrecoverableLocalSave(error)) {
      ui.showMenu(
        "Ranked Save Cannot Be Continued",
        "This browser cannot verify that old Ranked save. Start a new run or return to the Main Menu.",
        [
          ui.button("Start New Ranked", () => startFromUnrecoverableRecovery().catch(presentError)),
          ui.button("Main Menu", returnFromFailedStartToMainMenu)
        ]
      );
      return;
    }
    const controls = [];
    if (error?.retryable || ["NETWORK_ERROR", "TIMEOUT"].includes(rootCode)) {
      controls.push(ui.button("Retry exact action", retryPending));
    }
    if (writerHeld) {
      controls.push(ui.button("Request control", async () => {
        if (!createClient().requestOwnership()) {
          throw new TypeError("RANKED_WRITER_LEASE_HELD");
        }
        await resyncCanonical();
      }));
    }
    controls.push(ui.button("Export diagnostics", () => exportDiagnostics(rootDiagnostic)));
    controls.push(
      ui.button("Resync Ranked Run", () => resyncCanonical().catch(presentError)),
      ui.button("Main Menu", returnToPractice),
      ui.button("Abandon Ranked Run", confirmAbandon)
    );
    ui.showMessage(
      conflict ? "Ranked state conflict" : "Ranked reconnect required",
      conflict
        ? `Your Ranked run changed. Refresh it before continuing. Diagnostic: ${diagnosticLabel(rootDiagnostic)}.`
        : `Recovery is preserved. Main Menu does not abandon the Ranked run. Diagnostic: ${diagnosticLabel(rootDiagnostic)}.`,
      controls
    );
  }

  async function retryPending() {
    try {
      setRankedHudSyncing(true);
      session.transition(root.DungeonRankedV3Session.STATES.retrying);
      ui.setStatus("Retrying the exact operation...");
      const response = await createClient().retryPending();
      pendingElixirUsage = null;
      clearRecoveredPortalIntent();
      await acceptResponse(response);
      recoveryRootDiagnostic = null;
      observerBotAutomationHalted = false;
    } catch (error) {
      presentError(error);
    }
  }

  function showTerminal(state) {
    root.DungeonOnlineV3GameBridge?.holdTerminal?.(state);
    ui.hide();
    root.setTimeout(() => finalize().catch(presentError), 0);
  }

  async function finalize() {
    session.transition(root.DungeonRankedV3Session.STATES.finalizing);
    await acceptFinal(await createClient().finalize());
  }

  async function acceptResponse(response, operation = null) {
    if (operation && !isCurrentBoundaryOperation(operation)) return;
    let state = response.metaState;
    if (pendingTestAssistance && state?.status === "active") {
      if (String(state.assistanceClass || "none") === "none") {
        response = await createClient().event("mark_test_assistance", {
          assistanceClass: "observer_bot"
        });
        if (operation && !isCurrentBoundaryOperation(operation)) return;
        state = response.metaState;
      }
      const assistanceClassProjected = Object.prototype.hasOwnProperty.call(
        state && typeof state === "object" ? state : {},
        "assistanceClass"
      );
      if (
        response.acceptedEvent !== "mark_test_assistance" ||
        (assistanceClassProjected &&
          !["observer_bot", "cheats", "mixed"].includes(String(state.assistanceClass || "none")))
      ) {
        throw new TypeError("RANKED_TEST_ASSISTANCE_UNCONFIRMED");
      }
      pendingTestAssistance = false;
    }
    if (!state || !protocol.isSupportedRulesetHash(state.rulesetHash)) {
      throw new TypeError("RANKED_RULESET_MISMATCH");
    }
    if (["none", "observer_bot", "cheats", "mixed"].includes(String(state.assistanceClass || ""))) {
      knownHudAssistanceClass = String(state.assistanceClass);
    }
    setRankedHudSyncing(false);
    if (presentRankIntegrityNotice(state, () => {
      acceptResponse(response).catch(presentError);
    })) return;
    if (state.status === "awaiting_starting_relic") {
      session.transition(root.DungeonRankedV3Session.STATES.startingRelic);
      const offer = state.startingRelicOffer;
      ui.showChoices(
        "Choose Starting Relic",
        "Choose one relic to carry into the dungeon.",
        offer?.publicChoices || [],
        async (choiceId) => {
          try {
            ui.setStatus("Confirming your relic...");
            const selected = await createClient().selectStartingRelic(offer.offerId, choiceId);
            await acceptResponse(selected);
          } catch (error) {
            presentError(error);
          }
        }
      );
      return;
    }
    if (
      state.status === "active" &&
      state.metaTransactionOffer?.sourceType === "pact"
    ) {
      postRoomPactOfferPending = state.currentRoomDirective?.consumed === true;
      await presentMetaOffer(state.metaTransactionOffer, state);
      return;
    }
    if (state.status === "active" && state.currentRoomDirective) {
      if (pendingExtractionMode) {
        if (extractionCheckpointCommitted(state)) {
          const extractionMode = pendingExtractionMode;
          clearPendingExtractionIntent();
          await performExtraction(extractionMode, null, operation);
          return;
        }
        clearPendingExtractionIntent();
        pendingBoundaryExit = null;
        pendingRoomSummary = null;
      }
      const directive = directives.applyOnlineV3RoomDirective(state.currentRoomDirective);
      session.transition(root.DungeonRankedV3Session.STATES.entering);
      ui.hide();
      const bridge = root.DungeonOnlineV3GameBridge;
      if (!bridge || typeof bridge.startRanked !== "function") {
        throw new TypeError("RANKED_GAME_BRIDGE_UNAVAILABLE");
      }
      const newCampaign = pendingFreshCampaign;
      bridge.startRanked(directive, state, { newCampaign });
      pendingFreshCampaign = false;
      session.transition(root.DungeonRankedV3Session.STATES.active);
      return;
    }
    if (["victory", "defeat", "extraction"].includes(state.status)) {
      session.transition(root.DungeonRankedV3Session.STATES.terminal);
      extractedProfileReady = state.status === "extraction" && Boolean(response.profile);
      if (extractedProfileReady) {
        root.DungeonOnlineV3GameBridge?.beginRankedExtraction?.();
        await finalize();
      } else {
        showTerminal(state);
      }
      return;
    }
    if (state.status === "finalized") {
      await acceptFinal(response);
      return;
    }
    throw new TypeError("RANKED_RESPONSE_STATE_UNSUPPORTED");
  }

  function discardFailedStart(resetProfile = false) {
    const failedClient = createClient();
    failedClient.discardFailedStart();
    if (resetProfile) {
      failedClient.resetProfileIdentity();
      failedClient.clearRecovery?.();
    }
    failedClient.clear();
    client = null;
    session = root.DungeonRankedV3Session.createStateMachine(
      root.DungeonRankedV3Session.STATES.abandoned
    );
  }

  function presentStartError(error) {
    const code = String(error?.code || "");
    const rateLimited = code === "START_RATE_LIMITED";
    const activeLimit = code === "ACTIVE_RUN_LIMIT";
    const storageFull = code === "RANKED_STORAGE_FULL";
    const offline = error?.retryable || ["NETWORK_ERROR", "TIMEOUT"].includes(code);
    const message = rateLimited
      ? "Too many start attempts. Wait a moment, then try again."
      : activeLimit
        ? "This Ranked profile still has active runs. Try Continue or wait for them to expire."
        : storageFull
          ? "Browser storage is full. Ranked cannot safely save recovery. Practice data was not deleted."
          : offline
            ? "Ranked could not connect. Your Practice save is unchanged."
            : "Ranked could not start. Try again or return to the Main Menu.";
    ui.showMenu("Ranked Unavailable", message, [
      ui.button("Try Again", () => startRanked()),
      ui.button("Main Menu", returnFromFailedStartToMainMenu)
    ]);
  }

  async function startRanked(startDepth = 0) {
    return startRankedAttempt(true, startDepth);
  }

  async function startRankedAttempt(allowProfileRepair, startDepth = 0) {
    if (new URL(root.location.href).searchParams.has("scenario") || root.DUNGEON_DEBUG_SCENARIO_ACTIVE) {
      ui.showMessage("Ranked unavailable", "Scenario and debug overrides cannot enter Ranked.", [
        ui.button("Close", () => ui.hide())
      ]);
      return;
    }
    let acceptedStart = false;
    try {
      knownHudAssistanceClass = "none";
      lastRankedHudStatus = null;
      setRankedHudSyncing(true);
      metaMutationPending = false;
      postRoomPactOfferPending = false;
      session.transition(root.DungeonRankedV3Session.STATES.starting);
      ui.showMessage("Entering Ranked", "Preparing your descent...");
      startedAt = Date.now();
      let response = await createClient().start({
        playerName: publicName(),
        season: String(root.DUNGEON_ONLINE_V3_SEASON || "local-m4"),
        gameVersion: String(root.DUNGEON_GAME_VERSION || root.GAME_VERSION || "v0.8.2"),
        startDepth: Math.max(0, Math.floor(Number(startDepth) || 0)),
        newCampaign: pendingFreshCampaign,
        clientInstallIdHash: await installationHash()
      });
      acceptedStart = true;
      pendingTestAssistance = Boolean(
        root.DungeonOnlineV3GameBridge?.requiresRankedTestAssistance?.()
      );
      await acceptResponse(response);
    } catch (error) {
      if (acceptedStart) {
        presentError(error);
        return;
      }
      const repairProfile = allowProfileRepair && String(error?.code || "") === "PROFILE_UNAUTHORIZED";
      try {
        discardFailedStart(repairProfile);
      } catch (cleanupError) {
        presentError(cleanupError);
        return;
      }
      if (repairProfile) {
        await startRankedAttempt(false, startDepth);
        return;
      }
      presentStartError(error);
    }
  }


  function displaySeason(value) {
    const clean = String(value || "")
      .replace(/^season[_ -]*/iu, "")
      .replace(/[_-]+/gu, " ")
      .trim();
    return clean ? `Season ${clean.replace(/\b\w/gu, (letter) => letter.toUpperCase())}` : "Current season";
  }

  function displayRelicName(relicId) {
    return root.DungeonRankedV3Ui.relicDetails({ relicId })?.name || "new relic";
  }
  async function commitReplacement(replacement, replacementChoiceId, operation = null) {
    ui.setStatus("Replacing your relic...");
    const response = await createClient().event("commit_relic_replacement", {
      transactionId: replacement.transactionId,
      replacementChoiceId
    });
    pendingNativeRelicReplacement = null;
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
    root.DungeonOnlineV3GameBridge?.completeRankedRelicReplacement?.(response.metaState);
    await continueBoundary(response.metaState, operation);
  }

  function onRelicReplacementChoice(replacementChoiceId) {
    const replacement = pendingNativeRelicReplacement;
    const choiceId = String(replacementChoiceId || "");
    const choices = offers.replacementChoices(replacement);
    if (
      !replacement ||
      !choiceId ||
      !choices.some((choice) => choice.replacementChoiceId === choiceId)
    ) return false;
    root.DungeonOnlineV3GameBridge?.beginRankedRelicReplacementCommit?.();
    commitReplacement(replacement, choiceId).catch((error) => {
      root.DungeonOnlineV3GameBridge?.failRankedRelicReplacement?.(
        "That relic replacement is no longer available."
      );
      presentError(error);
    });
    return true;
  }

  function onRelicReplacementCancel() {
    const replacement = pendingNativeRelicReplacement;
    if (!replacement?.cancelAllowed) return false;
    root.DungeonOnlineV3GameBridge?.beginRankedRelicReplacementCommit?.();
    createClient().event("cancel_relic_replacement", {
      transactionId: replacement.transactionId
    }).then(async (response) => {
      pendingNativeRelicReplacement = null;
      root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
      root.DungeonOnlineV3GameBridge?.completeRankedRelicReplacement?.(response.metaState);
      await continueBoundary(response.metaState);
    }).catch((error) => {
      root.DungeonOnlineV3GameBridge?.failRankedRelicReplacement?.(
        "The incoming relic could not be declined."
      );
      presentError(error);
    });
    return true;
  }

  async function presentReplacement(replacement, operation = null) {
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    const choices = offers.replacementChoices(replacement);
    if (isRankedObserverBotActive()) {
      ui.hide();
      const choice = stableObserverBotChoice(choices, "replacementChoiceId");
      return runObserverBotBoundary(async () => {
        if (choice) return commitReplacement(replacement, choice.replacementChoiceId, operation);
        if (!replacement.cancelAllowed) throw new TypeError("RANKED_BOT_REPLACEMENT_UNAVAILABLE");
        const response = await createClient().event("cancel_relic_replacement", {
          transactionId: replacement.transactionId
        });
        return continueBoundary(response.metaState, operation);
      });
    }
    pendingNativeRelicReplacement = replacement;
    const bridge = root.DungeonOnlineV3GameBridge;
    if (bridge?.enterRankedRelicReplacement?.(
      createClient().getSnapshot()?.publicState || null,
      replacement,
      choices
    )) {
      ui.hide();
      return;
    }
    pendingNativeRelicReplacement = null;
    ui.showChoices(
      "Choose a relic to replace",
      `Incoming: ${displayRelicName(replacement.incoming?.relicId)}.`,
      choices,
      (choiceId) => commitReplacement(replacement, choiceId).catch(presentError)
    );
    if (replacement.cancelAllowed) {
      const cancel = ui.button("Cancel incoming relic", async () => {
        try {
          const response = await createClient().event("cancel_relic_replacement", {
            transactionId: replacement.transactionId
          });
          await continueBoundary(response.metaState);
        } catch (error) {
          presentError(error);
        }
      });
      ui.overlay.querySelector(".ranked-v3-actions")?.append(cancel);
    }
  }

  async function selectRelicOffer(offer, choiceId, operation = null) {
    const response = await createClient().event("select_relic", {
      offerId: offer.offerId,
      choiceId
    });
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
    await continueBoundary(response.metaState, operation);
  }

  async function presentRelicOffer(offer, operation = null) {
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    const choices = offers.relicChoices(offer);
    if (isRankedObserverBotActive()) {
      ui.hide();
      const choice = stableObserverBotChoice(choices, "choiceId");
      if (!choice) throw new TypeError("RANKED_BOT_RELIC_CHOICE_UNAVAILABLE");
      return runObserverBotBoundary(() => selectRelicOffer(offer, choice.choiceId, operation));
    }
    ui.showChoices(
      "Choose a Relic",
      "Choose one relic to carry into the next room.",
      choices,
      (choiceId) => selectRelicOffer(offer, choiceId).catch(presentError)
    );
  }

  async function issueRelicSlot(slot, operation = null) {
    const response = await createClient().event("issue_relic_offer", {
      rewardSlotId: slot.slotId
    });
    await continueBoundary(response.metaState, operation);
  }

  function isOtterCrimsonSlot(slot) {
    return String(slot?.sourceId || "") === "otter-crimson-chest";
  }

  function presentOtterCrimsonChest(slot) {
    if (!isOtterCrimsonSlot(slot)) return false;
    return root.DungeonOnlineV3GameBridge?.showRankedOtterRewardChest?.({
      slotId: String(slot.slotId || ""),
      sourceId: "otter-crimson-chest"
    }) === true;
  }

  function onOtterChestOpen() {
    if (!pendingRoomSummary || otterChestMutationPending) return Boolean(otterChestMutationPending);
    otterChestMutationPending = true;
    Promise.resolve()
      .then(async () => {
        const state = usesBoundarySettlement()
          ? await ensureRankedBoundaryBinding()
          : createClient().getSnapshot()?.publicState;
        const slot = offers.pendingRewardSlots(state, { roomClearPending: true })
          .find(isOtterCrimsonSlot);
        if (!slot) throw new TypeError("RANKED_OTTER_REWARD_SLOT_UNAVAILABLE");
        await issueRelicSlot(slot);
      })
      .catch(presentError)
      .finally(() => { otterChestMutationPending = false; });
    return true;
  }

  function normalizedForgeContext(offer, context = {}) {
    const sourceId = String(offer?.sourceId || "");
    const requestedMode = String(context.mode || "");
    const mode = ["temper", "transmute"].includes(requestedMode)
      ? requestedMode
      : sourceId.includes("transmute") ? "transmute" : "temper";
    const firstAction = Array.isArray(offer?.choices)
      ? offer.choices.find((choice) => {
          const data = choice?.publicData && typeof choice.publicData === "object"
            ? choice.publicData
            : choice;
          return choice?.status === "available" && data?.action !== "leave";
        })
      : null;
    const firstActionData = firstAction?.publicData && typeof firstAction.publicData === "object"
      ? firstAction.publicData
      : firstAction;
    return {
      mode,
      sacrificeRelicId: mode === "transmute"
        ? String(context.sacrificeRelicId || firstActionData?.sacrificeRelicId || "")
        : ""
    };
  }

  function presentNativeForge(state, context = {}) {
    const offer = state?.metaTransactionOffer;
    if (!offer || offer.sourceType !== "forge") {
      throw new TypeError("RANKED_FORGE_OFFER_INVALID");
    }
    const bridge = root.DungeonOnlineV3GameBridge;
    if (!bridge || typeof bridge.enterRankedForge !== "function") {
      throw new TypeError("RANKED_FORGE_BRIDGE_UNAVAILABLE");
    }
    const normalizedContext = normalizedForgeContext(offer, context);
    currentForgeOffer = offer;
    currentForgeContext = normalizedContext;
    forgeMutationPending = false;
    const accepted = bridge.enterRankedForge(state, offer, normalizedContext);
    if (accepted === false) throw new TypeError("RANKED_FORGE_PRESENTATION_UNAVAILABLE");
    ui.hide();
  }

  function presentForgeError(error) {
    if (root.DUNGEON_ONLINE_V3_DEBUG === true) {
      console.debug("[Online v3] Forge error", error);
    }
    root.DungeonOnlineV3GameBridge?.failRankedForgeRequest?.();
    ui.hide();
  }

  async function commitForgeChoice(choice) {
    const context = currentForgeContext || normalizedForgeContext(currentForgeOffer, {});
    root.DungeonOnlineV3GameBridge?.beginRankedForgeRequest?.();
    const response = await createClient().event("commit_meta_transaction", {
      transactionId: choice.transactionId,
      choiceId: choice.choiceId
    });
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
    currentForgeOffer = null;
    currentForgeContext = null;
    root.DungeonOnlineV3GameBridge?.completeRankedForge?.(response.metaState, {
      ...context,
      choiceId: choice.choiceId
    });
    await continueBoundary(response.metaState);
  }

  function onForgeChoice(choiceId) {
    if (forgeMutationPending || !currentForgeOffer) return false;
    const choice = currentForgeOffer.choices?.find((entry) =>
      entry?.status === "available" && String(entry.choiceId || "") === String(choiceId || "")
    );
    if (!choice) {
      root.DungeonOnlineV3GameBridge?.failRankedForgeRequest?.("That Forge choice is no longer available.");
      return false;
    }
    forgeMutationPending = true;
    commitForgeChoice(choice)
      .catch(presentForgeError)
      .finally(() => { forgeMutationPending = false; });
    return true;
  }
  async function commitMetaChoice(offer, choiceId) {
    if (metaMutationPending) return false;
    const choice = offer.choices.find((entry) => entry.choiceId === choiceId);
    if (!choice || choice.status !== "available") throw new TypeError("RANKED_META_CHOICE_UNAVAILABLE");
    metaMutationPending = true;
    ui.setStatus("Confirming your choice...");
    try {
      const response = await createClient().event("commit_meta_transaction", {
        transactionId: choice.transactionId,
        choiceId: choice.choiceId
      });
      if (postRoomPactOfferPending) {
        postRoomPactOfferPending = false;
        pendingBoundaryExit = null;
        pendingRoomSummary = null;
        await acceptResponse(response);
      } else if (pendingBoundaryExit === "portal") {
        root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
        await continueResolvedCheckpoint(response.metaState);
      } else {
        root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
        await continueBoundary(response.metaState);
      }
    } finally {
      metaMutationPending = false;
    }
  }

  async function presentMetaOffer(offer, state) {
    if (offer?.sourceType === "pact") {
      postRoomPactOfferPending ||= state?.currentRoomDirective?.consumed === true;
    }
    if (offer?.sourceType === "forge" && !isRankedObserverBotActive()) {
      return presentNativeForge(state, currentForgeContext || {});
    }
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    const choices = offers.metaChoices(offer).filter((choice) => !choice.disabled);
    if (isRankedObserverBotActive()) {
      ui.hide();
      const choice = stableObserverBotChoice(offer.choices, "choiceId", true);
      if (!choice && offer.sourceType === "pact") {
        observerBotAutomationHalted = true;
        return false;
      }
      return runObserverBotBoundary(() =>
        choice ? commitMetaChoice(offer, choice.choiceId) : resolveCheckpoint({ silent: true })
      );
    }
    ui.showChoices(
      `${offer.sourceType || "Ranked"} choices`,
      "Choose how to shape your build.",
      choices,
      (choiceId) => commitMetaChoice(offer, choiceId).catch(presentError)
    );
    if (offer.sourceType !== "pact") {
      ui.overlay.querySelector(".ranked-v3-actions")?.append(
        ui.button("Done", () => resolveCheckpoint().catch(presentError))
      );
    }
  }

  async function openMetaOffer(roomType) {
    let payload = {};
    const response = await createClient().event("open_meta_offer", payload);
    await continueBoundary(response.metaState);
  }

  function merchantPublicState() {
    return createClient().getSnapshot()?.publicState || {};
  }

  function merchantRevision(state = merchantPublicState()) {
    return Math.max(0, Math.floor(Number(state?.revision) || 0));
  }

  function merchantReason(reason, fallback = "commit_rejected") {
    const value = String(reason || fallback);
    return MERCHANT_REASONS.has(value) ? value : fallback;
  }

  function getRankedMerchantMutationState() {
    const operation = merchantOperation;
    return {
      status: String(operation?.status || "idle"),
      receiptKey: String(operation?.receiptKey || ""),
      action: String(operation?.action || ""),
      reason: String(operation?.reason || "")
    };
  }

  function merchantOfferIdentity(offer) {
    return String(offer?.offerId || "") + ":" + String(offer?.sourceInstanceId || "");
  }

  function merchantReceiptKey(response, operation) {
    const state = response?.metaState || response?.publicState || {};
    const direct = response?.receipt || response?.metaTransactionReceipt;
    const receipts = Array.isArray(state?.metaTransactionReceipts)
      ? state.metaTransactionReceipts
      : [];
    const receipt = direct && typeof direct === "object"
      ? direct
      : receipts.find((entry) =>
        String(entry?.transactionId || "") === String(operation?.transactionId || "") &&
        String(entry?.choiceId || "") === String(operation?.choiceId || "")
      );
    if (receipt) {
      return String(
        receipt.receiptKey ||
        receipt.idempotencyKey ||
        String(receipt.transactionId) + ":" + String(receipt.choiceId) + ":" + String(receipt.completedRevision ?? merchantRevision(state))
      );
    }
    return String(operation?.operationId || "");
  }

  function merchantReservationId(state) {
    return String(
      state?.build?.merchant?.reservedRelic?.relicId ||
      state?.build?.merchant?.reservedRelicId ||
      state?.merchantReservedRelic?.relicId ||
      state?.merchantReservedRelicId ||
      state?.reservedRelic?.relicId ||
      ""
    );
  }

  function merchantRelicStacks(state, relicId) {
    const relics = Array.isArray(state?.build?.relics) ? state.build.relics :
      Array.isArray(state?.relics) ? state.relics : [];
    const entry = relics.find((relic) => String(relic?.relicId || relic?.id || "") === String(relicId || ""));
    return Math.max(0, Number(entry?.stacks ?? entry?.count ?? (entry ? 1 : 0)) || 0);
  }

  function merchantFacts(state, choice, request) {
    const price = Math.max(0, Number(choice?.totalPrice ?? choice?.price) || 0);
    return {
      runGold: Math.max(0, Number(state?.gold) || 0),
      campGold: Math.max(0, Number(state?.campGold) || 0),
      reservationId: merchantReservationId(state),
      relicId: String(request?.relicId || choice?.relicId || ""),
      relicStacks: merchantRelicStacks(state, request?.relicId || choice?.relicId),
      price
    };
  }

  function merchantCanonicalProof(state, operation) {
    if (!state || !operation) return "";
    const revision = merchantRevision(state);
    const offer = state.metaTransactionOffer;
    const sameOffer = offer?.sourceType === "merchant" && merchantOfferIdentity(offer) === operation.startingOfferKey;
    const choice = sameOffer && Array.isArray(offer.choices)
      ? offer.choices.find((entry) => String(entry?.choiceId || "") === operation.choiceId)
      : null;
    if (revision === operation.startingRevision && sameOffer && choice?.status === "available") return "retry";
    if (revision <= operation.startingRevision) return "";
    if (sameOffer && choice?.status === "sold") return "adopt";
    const facts = operation.startingFacts || {};
    const reservationCleared = facts.reservationId && merchantReservationId(state) !== facts.reservationId;
    const currentStacks = merchantRelicStacks(state, facts.relicId);
    const walletBefore = Number(facts.runGold || 0) + Number(facts.campGold || 0);
    const walletAfter = Math.max(0, Number(state?.gold) || 0) + Math.max(0, Number(state?.campGold) || 0);
    if (operation.action === "claim_reserved" && reservationCleared && currentStacks > Number(facts.relicStacks || 0) &&
      walletAfter === Math.max(0, walletBefore - Number(facts.price || 0))) return "adopt";
    if (operation.action === "discard_reserved" && reservationCleared && walletAfter === walletBefore) return "adopt";
    return "";
  }

  function merchantResetForOffer(offer) {
    const offerKey = merchantOfferIdentity(offer);
    if (merchantOperation?.offerKey === offerKey) return;
    merchantOperation = null;
    merchantFailureCount = 0;
  }

  function failRankedMerchantAction(result = {}) {
    const reason = merchantReason(result.reason, "commit_rejected");
    const operation = merchantOperation;
    merchantFailureCount = Math.min(MERCHANT_FAILURE_LIMIT, merchantFailureCount + 1);
    if (operation) {
      operation.status = merchantFailureCount >= MERCHANT_FAILURE_LIMIT ? "backoff" : "rejected";
      operation.reason = merchantFailureCount >= MERCHANT_FAILURE_LIMIT
        ? "failure_backoff"
        : reason;
    } else {
      merchantOperation = {
        status: "rejected",
        receiptKey: "",
        action: String(result.action || ""),
        reason
      };
    }
    merchantMutationPending = false;
    root.DungeonOnlineV3GameBridge?.failRankedMerchantAction?.({
      ...result,
      reason: operation?.reason || reason
    });
    if (result.requestNotified !== true) {
      root.DungeonOnlineV3GameBridge?.failRankedMerchantRequest?.(
        result.message || "That Merchant choice was not confirmed."
      );
    }
    return false;
  }

  function completeRankedMerchantAction(result = {}) {
    const operation = merchantOperation;
    if (!operation || operation.status === "confirmed") return false;
    if (result.canonicalConfirmed !== true || String(result.operationId || "") !== String(operation.operationId || "")) return false;
    const receiptKey = String(result.receiptKey || merchantReceiptKey(result, operation));
    if (!receiptKey || merchantConfirmedReceipts.has(receiptKey)) return false;
    merchantConfirmedReceipts.add(receiptKey);
    while (merchantConfirmedReceipts.size > 64) merchantConfirmedReceipts.delete(merchantConfirmedReceipts.values().next().value);
    operation.status = "confirmed";
    operation.receiptKey = receiptKey;
    operation.reason = "";
    merchantFailureCount = 0;
    merchantMutationPending = false;
    root.DungeonOnlineV3GameBridge?.completeRankedMerchantAction?.({
      ...result,
      receiptKey,
      action: operation.action
    });
    return true;
  }

  function settleMerchantSuccess(response, operation, request, options = {}) {
    const state = response?.metaState || response?.publicState || merchantPublicState();
    root.DungeonOnlineV3GameBridge?.syncCanonicalProjection?.(state);
    const offer = state?.metaTransactionOffer;
    const completed = completeRankedMerchantAction({
      ...response,
      metaState: state,
      canonicalConfirmed: true,
      operationId: operation.operationId,
      receiptKey: merchantReceiptKey(response, operation),
      adopted: options.adopted === true,
      offerConsumed: !(offer && offer.sourceType === "merchant")
    });
    if (!completed) return false;
    if (offer && offer.sourceType === "merchant") {
      presentNativeMerchant(state, request);
    } else {
      currentMerchantOffer = null;
    }
    return true;
  }

  async function resyncRankedMerchantOperation(operation, error) {
    operation.status = "resyncing";
    operation.reason = "resync_required";
    try {
      const response = await createClient().resumeCanonical({
        lastKnownRevision: operation.startingRevision
      });
      const state = response?.metaState || merchantPublicState();
      const proof = merchantCanonicalProof(state, operation);
      if (proof === "adopt") {
        settleMerchantSuccess(response, operation, operation.request, { adopted: true });
        return true;
      }
      const retryAllowed = operation.attempts < 2;
      if (proof !== "retry" || !retryAllowed) {
        failRankedMerchantAction({ reason: "resync_required", error });
        return false;
      }
      operation.attempts += 1;
      operation.status = "pending";
      merchantMutationPending = true;
      const retryIdentity = { operationId: merchantOperation.operationId };
      const retry = await createClient().event("commit_meta_transaction", {
        transactionId: operation.transactionId,
        choiceId: operation.choiceId
      }, retryIdentity.operationId);
      settleMerchantSuccess(retry, operation, operation.request);
      return true;
    } catch (resyncError) {
      failRankedMerchantAction({ reason: "resync_required", error: resyncError });
      return false;
    }
  }
  function availableMerchantChoices() {
    const choices = currentMerchantOffer?.choices;
    return Array.isArray(choices)
      ? choices.filter((choice) => choice?.status === "available")
      : [];
  }

  function merchantChoiceFor(request = {}) {
    const action = String(request.action || "");
    const relicId = String(request.relicId || "");
    const removalRelicId = String(request.removalRelicId || "");
    return availableMerchantChoices().find((choice) => {
      if (action === "potion") return choice.kind === "merchant_potion";
      if (action === "skill_upgrade") {
        return choice.kind === "merchant_skill_upgrade" && choice.skillId === request.skillId;
      }
      if (action === "relic_purchase") {
        if (!["merchant_relic_purchase", "merchant_relic_replacement"].includes(choice.kind)) return false;
        if (relicId && choice.relicId !== relicId) return false;
        return removalRelicId
          ? choice.kind === "merchant_relic_replacement" && choice.removals?.some((entry) => entry?.relicId === removalRelicId)
          : choice.kind === "merchant_relic_purchase" && choice.replacement !== true;
      }
      if (action === "reserve_relic") return choice.kind === "merchant_relic_reserve" && (!relicId || choice.relicId === relicId);
      if (action === "claim_reserved") {
        if (!["merchant_reserved_claim", "merchant_relic_replacement"].includes(choice.kind)) return false;
        if (relicId && choice.relicId !== relicId) return false;
        return removalRelicId
          ? choice.kind === "merchant_relic_replacement" && choice.removals?.some((entry) => entry?.relicId === removalRelicId)
          : choice.kind === "merchant_reserved_claim" && choice.replacement !== true;
      }
      if (action === "discard_reserved") return choice.kind === "merchant_reserved_discard" && (!relicId || choice.relicId === relicId);
      if (action === "buyback") return choice.kind === "merchant_buyback" && choice.relicId === relicId;
      if (action === "service") return choice.kind === "merchant_service" && choice.serviceId === request.serviceId;
      if (action === "black_market") return choice.kind === "merchant_black_market" && choice.targetRelicId === relicId;
      if (action === "leave") return choice.kind === "leave";
      return false;
    }) || null;
  }

  function merchantReplacementChoices(request = {}) {
    const relicId = String(request.relicId || "");
    return availableMerchantChoices().filter((choice) =>
      choice.kind === "merchant_relic_replacement" &&
      (!relicId || choice.relicId === relicId)
    );
  }

  function presentNativeMerchant(state, request = {}) {
    const offer = state?.metaTransactionOffer;
    if (!offer || offer.sourceType !== "merchant") {
      throw new TypeError("RANKED_MERCHANT_OFFER_INVALID");
    }
    currentMerchantOffer = offer;
    merchantResetForOffer(offer);
    root.DungeonOnlineV3GameBridge.enterRankedMerchant(state, offer, request);
    ui.hide();
  }

  function presentMerchantError(error) {
    if (root.DUNGEON_ONLINE_V3_DEBUG === true) {
      console.debug("[Online v3] Merchant error", error);
    }
    if (isRankedObserverBotActive()) observerBotAutomationHalted = true;
    if (session.getState() === root.DungeonRankedV3Session.STATES.resolving) {
      session.transition(root.DungeonRankedV3Session.STATES.active);
    }
    root.DungeonOnlineV3GameBridge?.failRankedMerchantRequest?.();
    ui.hide();
  }

  async function onMerchantOpen() {
    if (merchantMutationPending) return true;
    merchantMutationPending = true;
    root.DungeonOnlineV3GameBridge?.beginRankedMerchantRequest?.();
    try {
      if (currentMerchantOffer?.sourceType === "merchant") {
        presentNativeMerchant(createClient().getSnapshot()?.publicState || {}, {});
        return true;
      }
      const response = await createClient().event("open_meta_offer", {});
      presentNativeMerchant(response.metaState, {});
    } catch (error) {
      presentMerchantError(error);
    } finally {
      merchantMutationPending = false;
    }
    return true;
  }

  function merchantErrorIsDeterministic(error) {
    const status = Number(error?.status) || 0;
    const code = String(error?.code || "").toUpperCase();
    return status === 400 || status === 422 ||
      /STALE|CHOICE|UNAVAILABLE|REJECT/u.test(code);
  }

  async function submitRankedMerchantOperation(operation, request) {
    try {
      const response = await createClient().event("commit_meta_transaction", {
        transactionId: operation.transactionId,
        choiceId: operation.choiceId
      }, operation.operationId);
      settleMerchantSuccess(response, operation, request);
    } catch (error) {
      if (merchantErrorIsDeterministic(error)) {
        failRankedMerchantAction({ reason: "commit_rejected", error });
      } else {
        await resyncRankedMerchantOperation(operation, error);
      }
    } finally {
      if (merchantOperation === operation && operation.status !== "resyncing") {
        merchantMutationPending = false;
      }
    }
  }

  function onMerchantAction(request = {}) {
    if (merchantMutationPending || ["pending", "uncertain", "resyncing", "backoff"].includes(merchantOperation?.status)) {
      return true;
    }
    const choice = merchantChoiceFor(request);
    if (!choice && ["relic_purchase", "claim_reserved"].includes(String(request.action || ""))) {
      const replacements = merchantReplacementChoices(request);
      if (replacements.length > 0) {
        root.DungeonOnlineV3GameBridge?.beginRankedMerchantReplacement?.({
          source: request.action === "claim_reserved" ? "reserved" : "offer",
          relicId: replacements[0].relicId,
          price: replacements[0].price,
          removalRelicIds: replacements.flatMap((entry) =>
            Array.isArray(entry.removals) ? entry.removals.map((removal) => removal?.relicId).filter(Boolean) : []
          )
        });
        return true;
      }
    }
    if (!choice) {
      root.DungeonOnlineV3GameBridge?.failRankedMerchantRequest?.("That Merchant offer is not available.");
      failRankedMerchantAction({
        action: request.action,
        reason: "no_canonical_choice",
        message: "That Merchant offer is not available.",
        requestNotified: true
      });
      return false;
    }
    const state = merchantPublicState();
    const operationId = root.DungeonRankedV3Transport.randomOperationId(root.crypto);
    const operation = {
      status: "pending",
      operationId,
      transactionId: String(choice.transactionId || ""),
      choiceId: String(choice.choiceId || ""),
      startingRevision: merchantRevision(state),
      startingOfferKey: merchantOfferIdentity(currentMerchantOffer),
      action: String(request.action || ""),
      request: { ...request },
      startingFacts: merchantFacts(state, choice, request),
      receiptKey: "",
      reason: "offer_pending",
      attempts: 1,
      offerKey: merchantOfferIdentity(currentMerchantOffer)
    };
    merchantOperation = operation;
    merchantOperation.status = "pending";
    merchantMutationPending = true;
    root.DungeonOnlineV3GameBridge?.beginRankedMerchantRequest?.();
    submitRankedMerchantOperation(operation, request).catch((error) => {
      failRankedMerchantAction({ reason: "commit_rejected", error });
    });
    return true;
  }
  async function onMerchantLeave(options = {}) {
    if (merchantMutationPending) return true;
    if (
      activeRoomDirectiveId &&
      merchantLeaveCompletedDirectiveId === activeRoomDirectiveId
    ) return true;
    merchantMutationPending = true;
    root.DungeonOnlineV3GameBridge?.beginRankedMerchantRequest?.();
    try {
      const leave = merchantChoiceFor({ action: "leave" });
      if (leave) {
        const response = await createClient().event("commit_meta_transaction", {
          transactionId: leave.transactionId,
          choiceId: leave.choiceId
        });
        currentMerchantOffer = null;
        root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
      }
      if (usesBoundarySettlement()) {
        const captured = mergeCapturedBoundary(captureRankedBoundary());
        pendingRoomSummary = captured.summary;
        if (options.enterPortal === true) pendingBoundaryExit = "portal";
      }
      const resolved = await resolveCheckpoint({
        onError: presentMerchantError,
        silent: true,
        loadingMessage: options.enterPortal === true ? "Loading next depth…" : ""
      });
      if (resolved) merchantLeaveCompletedDirectiveId = activeRoomDirectiveId;
      if (resolved && options.enterPortal === true && !usesBoundarySettlement()) {
        root.DungeonOnlineV3GameBridge?.enterNextDirective?.();
      }
    } catch (error) {
      presentMerchantError(error);
    } finally {
      merchantMutationPending = false;
    }
    return true;
  }

  function availableCampChoices() {
    const choices = currentCampResponse?.metaTransactionOffer?.choices;
    return Array.isArray(choices)
      ? choices.filter((choice) => !choice.status || choice.status === "available")
      : [];
  }

  function campChoiceFor(request = {}) {
    const action = String(request.action || "");
    return availableCampChoices().find((choice) => {
      const data = choice.publicData || choice;
      if (action === "upgrade") {
        return data.action === "upgrade" && data.upgradeId === request.upgradeId;
      }
      if (action === "elixir_buy_refill") {
        return ["elixir_buy", "elixir_refill"].includes(data.action) && data.elixirId === request.elixirId;
      }
      if (action === "elixir_discard") {
        return data.action === "elixir_discard" && data.elixirId === request.elixirId;
      }
      if (action === "relic_sale") {
        return data.action === "relic_sale" && data.relicId === request.relicId;
      }
      if (action === "mutator_add" || action === "mutator_remove") {
        return data.action === action && data.mutatorId === request.mutatorId;
      }
      return false;
    }) || null;
  }

  function presentNativeCamp(response) {
    const bridge = root.DungeonOnlineV3GameBridge;
    if (!bridge || typeof bridge.enterRankedCamp !== "function") {
      throw new TypeError("RANKED_CAMP_BRIDGE_UNAVAILABLE");
    }
    currentCampResponse = response;
    client?.clearRecovery?.();
    bridge.enterRankedCamp(response.profile, response.metaTransactionOffer);
    observerBotAutomationHalted = false;
    ui.hide();
  }

  async function openCamp() {
    ui.showSync("Synchronizing Camp…");
    const response = await createClient().camp("open");
    presentNativeCamp(response);
    return response;
  }

  function leaveFinalizedCampPending() {
    invalidateBoundaryOperations();
    recoveryRootDiagnostic = null;
    automaticResyncPending = false;
    pendingFreshCampaign = false;
    pendingElixirUsage = null;
    client?.releaseWriter?.();
    client?.clear?.();
    client = null;
    session = root.DungeonRankedV3Session.createStateMachine(
      root.DungeonRankedV3Session.STATES.abandoned
    );
    root.DungeonOnlineV3GameBridge?.returnToPractice?.();
    ui.hide();
  }

  function presentFinalizedCampError(error) {
    if (isRankedObserverBotActive()) observerBotAutomationHalted = true;
    const diagnostic = recordDiagnostic("client_error", {
      code: String(error?.code || error?.message || "CAMP_SYNC_FAILED"),
      status: error?.status,
      traceId: error?.traceId
    });
    ui.showMessage(
      "Camp synchronization needed",
      `Your completed Ranked run is safe. Camp could not be synchronized yet. Diagnostic: ${diagnosticLabel(diagnostic)}.`,
      [
        ui.button("Retry Camp", () => openCamp().catch(presentFinalizedCampError)),
        ui.button("Main Menu", leaveFinalizedCampPending)
      ]
    );
  }

  function presentCampError(error) {
    if (root.DUNGEON_ONLINE_V3_DEBUG === true) {
      console.debug("[Online v3] Camp error", error);
    }
    if (currentCampResponse) {
      root.DungeonOnlineV3GameBridge?.reportCampError?.();
      ui.hide();
      return;
    }
    presentError(error);
  }

  function onCampAction(request = {}) {
    if (campMutationPending) return false;
    const choice = campChoiceFor(request);
    if (!choice) return false;
    campMutationPending = true;
    createClient().camp("commit", {
      transactionId: choice.transactionId,
      choiceId: choice.choiceId
    })
      .then(() => openCamp())
      .catch(presentCampError)
      .finally(() => { campMutationPending = false; });
    return true;
  }

  function onCampStartRun(startDepth = 0) {
    if (campMutationPending) return false;
    campMutationPending = true;
    Promise.resolve()
      .then(() => {
        client?.clearRecovery?.();
        recoveryStore.clearRecovery();
        prepareFreshRankedStart(false);
        pendingFreshCampaign = false;
        pendingElixirUsage = null;
        currentCampResponse = null;
        ui.hide();
        return startRanked(startDepth);
      })
      .catch(presentCampError)
      .finally(() => { campMutationPending = false; });
    return true;
  }

  async function continueBoundary(state, operation = null) {
    if (operation && !isCurrentBoundaryOperation(operation)) return true;
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(state);
    if (state.relicReplacement) return presentReplacement(state.relicReplacement, operation);
    if (state.relicOffer) return presentRelicOffer(state.relicOffer, operation);
    if (state.metaTransactionOffer) return presentMetaOffer(state.metaTransactionOffer, state);
    const slot = offers.pendingRewardSlots(state, {
      roomClearPending: Boolean(pendingRoomSummary)
    })[0];
    if (slot) {
      if (isOtterCrimsonSlot(slot)) {
        if (!presentOtterCrimsonChest(slot)) {
          throw new TypeError("RANKED_OTTER_CHEST_PRESENTATION_UNAVAILABLE");
        }
        return;
      }
      return issueRelicSlot(slot, operation);
    }
    if (pendingRoomSummary && pendingBoundaryExit) {
      return resolveCheckpoint({
        loadingMessage: pendingBoundaryExit === "portal" ? "Loading next depth…" : "Extracting…"
      }, operation);
    }
    if (pendingRoomSummary) {
      if (usesBoundarySettlement()) {
        if (session.getState() === root.DungeonRankedV3Session.STATES.offer) {
          session.transition(root.DungeonRankedV3Session.STATES.resolving);
        }
        if (session.getState() !== root.DungeonRankedV3Session.STATES.active) {
          session.transition(root.DungeonRankedV3Session.STATES.active);
        }
        ui.hide();
        return;
      }
      return resolveCheckpoint({}, operation);
    }
    if (state.currentRoomDirective) {
      const directive = directives.applyOnlineV3RoomDirective(state.currentRoomDirective);
      root.DungeonOnlineV3GameBridge.setNextDirective(directive);
      session.transition(root.DungeonRankedV3Session.STATES.next);
    }
    ui.hide();
  }

  async function continueResolvedCheckpoint(state, operation = null) {
    if (operation && !isCurrentBoundaryOperation(operation)) return true;
    if (["victory", "defeat", "extraction"].includes(state.status)) {
      session.transition(root.DungeonRankedV3Session.STATES.terminal);
      showTerminal(state);
      return;
    }
    if (pendingExtractionMode) {
      const extractionMode = pendingExtractionMode;
      clearPendingExtractionIntent();
      await performExtraction(extractionMode, null, operation);
      return;
    }
    if (state.metaTransactionOffer) {
      await continueBoundary(state, operation);
      return;
    }
    if (pendingBoundaryExit === "portal") {
      pendingBoundaryExit = null;
      const directive = directives.applyOnlineV3RoomDirective(state.currentRoomDirective);
      root.DungeonOnlineV3GameBridge.setNextDirective(directive);
      session.transition(root.DungeonRankedV3Session.STATES.next);
      ui.hide();
      root.DungeonOnlineV3GameBridge?.enterNextDirective?.();
      return;
    }
    await continueBoundary(state, operation);
  }

  async function resolveCheckpoint(options = {}, operation = null) {
    if (!operation) {
      return startBoundaryOperation(
        (activeOperation) => resolveCheckpoint(options, activeOperation),
        {
          loadingMessage: options.loadingMessage || (options.silent === true ? "" : "Saving progress..."),
          silent: options.silent === true,
          onError: options.onError
        }
      );
    }
    if (!isCurrentBoundaryOperation(operation) || isBoundaryOperationBlockedState()) return false;
    const summary = pendingRoomSummary || {};
    pendingRoomSummary = null;
    try {
      setRankedHudSyncing(true);
      if (!isCurrentBoundaryOperation(operation) || isBoundaryOperationBlockedState()) {
        pendingRoomSummary = summary;
        return false;
      }
      if (session.getState() !== root.DungeonRankedV3Session.STATES.resolving) {
        session.transition(root.DungeonRankedV3Session.STATES.resolving);
      }
      const checkpointState = createClient().getSnapshot()?.publicState;
      const fixedAwardGold = usesBoundarySettlement()
        ? (Array.isArray(checkpointState?.currentRewardEnvelope?.fixedAwards)
            ? checkpointState.currentRewardEnvelope.fixedAwards
            : [])
          .reduce((sum, award) => sum + Math.max(0, Math.floor(Number(award?.amount) || 0)), 0)
        : 0;
      const reportedGoldDelta = fixedAwardGold + Math.max(
        0,
        Math.floor(Number(summary?.reportedGoldDelta) || 0)
      );
      const canonicalGoldBeforeSettlement = Math.max(
        0,
        Math.floor(Number(checkpointState?.gold) || 0)
      );
      const response = await createClient().checkpoint({
        turnCount: summary?.turnCount,
        elapsedMs: Math.max(0, Date.now() - startedAt),
        rewardClaims: appendElixirUsageClaim(summary?.rewardClaims || []),
        integritySignals: Array.isArray(summary?.integritySignals)
          ? summary.integritySignals
          : [],
        reportedGoldDelta,
        reportedGoldTotal: canonicalGoldBeforeSettlement + reportedGoldDelta,
        ...(summary?.combatResources ? { combatResources: summary.combatResources } : {}),
        commands: []
      });
      if (!isCurrentBoundaryOperation(operation)) return true;
      root.DungeonOnlineV3GameBridge?.showRankedRoomClearAward?.(fixedAwardGold);
      pendingElixirUsage = null;
      const state = response.metaState;
      root.DungeonOnlineV3GameBridge.syncCanonicalProjection(state);
      if (presentRankIntegrityNotice(state, () => {
        if (!isCurrentOperationGeneration(operation)) return;
        continueResolvedCheckpoint(state).catch(presentError);
      })) return true;
      await continueResolvedCheckpoint(state, operation);
    } catch (error) {
      if (!isCurrentBoundaryOperation(operation)) return true;
      pendingRoomSummary = summary;
      (typeof options.onError === "function" ? options.onError : presentError)(error);
      return false;
    }
    return true;
  }


  function onForgeMode(mode, context = {}) {
    if (!pendingRoomSummary || forgeMutationPending || !["temper", "transmute"].includes(mode)) return false;
    if (isRankedObserverBotActive()) {
      void runObserverBotBoundary(async () => {
        session.transition(root.DungeonRankedV3Session.STATES.offer);
        const payload = mode === "transmute"
          ? { mode, sacrificeRelicId: String(context.sacrificeRelicId || "") }
          : { mode };
        const response = await createClient().event("open_meta_offer", payload);
        await continueBoundary(response.metaState);
      });
      return true;
    }
    currentForgeContext = {
      mode,
      sacrificeRelicId: mode === "transmute" ? String(context.sacrificeRelicId || "") : ""
    };
    forgeMutationPending = true;
    root.DungeonOnlineV3GameBridge?.beginRankedForgeRequest?.();
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    const payload = mode === "transmute"
      ? { mode, sacrificeRelicId: currentForgeContext.sacrificeRelicId }
      : { mode };
    createClient().event("open_meta_offer", payload)
      .then((response) => continueBoundary(response.metaState))
      .catch(presentForgeError)
      .finally(() => { forgeMutationPending = false; });
    return true;
  }

  function onForgeLeave(options = {}) {
    if (isObserverBotBoundaryPending() || boundaryOperation || isBoundaryOperationBlockedState()) return true;
    if (!pendingRoomSummary) return false;
    void startBoundaryOperation(async (operation) => {
      if (usesBoundarySettlement()) {
        await ensureRankedBoundaryBinding();
        if (!isCurrentBoundaryOperation(operation)) return true;
        const captured = mergeCapturedBoundary(captureRankedBoundary());
        pendingRoomSummary = captured.summary;
        if (options.enterPortal === true) pendingBoundaryExit = "portal";
      }
      const resolved = await resolveCheckpoint({
        silent: true,
        loadingMessage: options.enterPortal === true ? "Loading next depth…" : ""
      }, operation);
      if (resolved && options.enterPortal === true && !usesBoundarySettlement()) {
        root.DungeonOnlineV3GameBridge?.enterNextDirective?.();
      }
      return resolved;
    }, {
      loadingMessage: options.enterPortal === true ? "Loading next depth…" : "",
      silent: options.enterPortal !== true
    });
    return true;
  }

  function onPortalEntry() {
    if (!usesBoundarySettlement() || !pendingRoomSummary) return false;
    if (
      boundaryOperation ||
      observerBotBoundaryPending ||
      isBoundaryOperationBlockedState() ||
      session.getState() === root.DungeonRankedV3Session.STATES.resolving
    ) return true;
    void startBoundaryOperation(async (operation) => {
      const state = await ensureRankedBoundaryBinding();
      if (!isCurrentBoundaryOperation(operation)) return true;
      const captured = mergeCapturedBoundary(captureRankedBoundary());
      const integritySignals = Array.isArray(pendingRoomSummary?.integritySignals)
        ? pendingRoomSummary.integritySignals
        : [];
      pendingRoomSummary = {
        ...captured.summary,
        integritySignals
      };
      pendingBoundaryExit = "portal";
      return continueBoundary(state, operation);
    }, { loadingMessage: "Loading next depth…" });
    return true;
  }
  async function onLocalRoomCleared(summary) {
    const sourceSummary = summary && typeof summary === "object" ? summary : {};
    const completionCapability = sourceSummary.completionCapability;
    const roomSummary = { ...sourceSummary };
    delete roomSummary.completionCapability;
    const state = createClient().getSnapshot()?.publicState;
    const directiveId = String(state?.currentRoomDirective?.directiveId || "");
    const completionValid = Boolean(
      activeRoomIntegrity &&
      activeRoomIntegrity.directiveId === directiveId &&
      completionCapability === activeRoomIntegrity.completionCapability
    );
    activeRoomIntegrity = null;
    const integritySignals = completionValid
      ? []
      : [ROOM_COMPLETION_CAPABILITY_INVALID];
    if (usesBoundarySettlement()) {
      pendingRoomSummary = {
        ...roomSummary,
        roomCleared: true,
        integritySignals
      };
      const slot = offers.pendingRewardSlots(state, { roomClearPending: true })
        .find(isOtterCrimsonSlot);
      if (slot) presentOtterCrimsonChest(slot);
      ui.hide();
      return;
    }
    pendingRoomSummary = {
      ...roomSummary,
      integritySignals: completionValid
        ? []
        : [ROOM_COMPLETION_CAPABILITY_INVALID]
    };
    const roomType = state?.currentRoomDirective?.roomType;
    if (roomType === "forge") {
      ui.hide();
      return;
    }
    const finishBoundary = async () => {
      if (roomType === "pact") {
        session.transition(root.DungeonRankedV3Session.STATES.offer);
        await openMetaOffer(roomType);
        return;
      }
      if (offers.pendingRewardSlots(state, {
        roomClearPending: Boolean(pendingRoomSummary)
      }).length > 0) {
        await continueBoundary(state);
        return;
      }
      session.transition(root.DungeonRankedV3Session.STATES.offer);
      await resolveCheckpoint();
    };
    return isRankedObserverBotActive()
      ? runObserverBotBoundary(finishBoundary)
      : finishBoundary();
  }

  async function onRoomEntered(directive) {
    if (!directive) return;
    activeRoomDirectiveId = String(directive.directiveId || "");
    installRoomIntegrityContext(directive);
    if (session.getState() === root.DungeonRankedV3Session.STATES.next) {
      session.transition(root.DungeonRankedV3Session.STATES.active);
    }
    if (directive.roomType === "merchant") {
      currentMerchantOffer = null;
      merchantOperation = null;
      merchantFailureCount = 0;
      merchantMutationPending = false;
      merchantConfirmedReceipts.clear();
      pendingRoomSummary = {
        turnCount: 0,
        rewardClaims: [],
        reportedGoldDelta: 0,
        integritySignals: []
      };
      ui.hide();
      return;
    }
    if (directive.roomType !== "crossroads") return;
    pendingRoomSummary = {
      turnCount: 0,
      rewardClaims: [],
      reportedGoldDelta: 0,
      integritySignals: []
    };
    const openBoundary = async () => {
      session.transition(root.DungeonRankedV3Session.STATES.offer);
      await openMetaOffer(directive.roomType);
    };
    return isRankedObserverBotActive()
      ? runObserverBotBoundary(openBoundary)
      : openBoundary();
  }

  async function acceptFinal() {
    if (session.getState() !== root.DungeonRankedV3Session.STATES.finalized) {
      session.transition(root.DungeonRankedV3Session.STATES.finalized);
    }
    if (extractedProfileReady) {
      try {
        await openCamp();
      } catch (error) {
        presentFinalizedCampError(error);
      }
      return;
    }
    client?.clearRecovery?.();
    client?.clear?.();
    ui.hide();
  }

  async function onFatalEvent(context = {}) {
    try {
      session.transition(root.DungeonRankedV3Session.STATES.resolving);
      const boundaryEnabled = usesBoundarySettlement();
      if (!boundaryEnabled) ui.showSync("Checking your fate...");
      const previousState = createClient().getSnapshot()?.publicState;
      const previousDirectiveId = previousState?.currentRoomDirective?.directiveId || null;
      const fatalPayload = { classification: "local_fatal_event" };
      if (boundaryEnabled) {
        await ensureRankedBoundaryBinding();
        fatalPayload.boundarySettlement = mergeCapturedBoundary(captureRankedBoundary()).eventPayload;
        pendingRoomSummary = null;
      }
      if (pendingElixirUsage && pendingElixirUsage.count > 0) fatalPayload.elixirUsage = { ...pendingElixirUsage };
      const presentationCause = normalizePresentationCause(context?.reason);
      if (
        presentationCause && protocol.supportsFatalPresentationCause?.(previousState?.rulesetHash) === true
      ) fatalPayload.presentationCause = presentationCause;
      const response = await createClient().event("report_fatal_event", fatalPayload);
      pendingElixirUsage = null;
      const state = response.metaState;
      root.DungeonOnlineV3GameBridge.syncCanonicalProjection(state);
      const continueFatal = () => {
        if (["defeat", "victory", "extraction"].includes(state.status)) {
          session.transition(root.DungeonRankedV3Session.STATES.terminal);
          showTerminal(state);
          return;
        }
        const directive = directives.applyOnlineV3RoomDirective(state.currentRoomDirective);
        if (previousDirectiveId && directive.directiveId === previousDirectiveId) {
          root.DungeonOnlineV3GameBridge?.resetRankedBoundaryRecorder?.();
          installRoomIntegrityContext(state.currentRoomDirective);
          root.DungeonOnlineV3GameBridge.resumePreventedFatal(state);
          session.transition(root.DungeonRankedV3Session.STATES.active);
          ui.hide();
          return;
        }
        root.DungeonOnlineV3GameBridge.resumeAfterFatal(directive, state, {
          reason: String(context?.reason || ""),
          lostRelicId: offers.lostRelicId(previousState?.build, state?.build)
        });
        session.transition(root.DungeonRankedV3Session.STATES.next);
        // The native death screen remains visible until the player starts the next canonical life.
        ui.hide();
      };
      if (presentRankIntegrityNotice(state, continueFatal)) return;
      continueFatal();
    } catch (error) {
      presentError(error);
    }
  }

  async function performExtraction(mode, boundarySettlement = null, operation = null) {
    if (operation && !isCurrentBoundaryOperation(operation)) return true;
    if (isBoundaryOperationBlockedState()) return false;
    const resolving = root.DungeonRankedV3Session.STATES.resolving;
    if (session.getState() !== resolving) session.transition(resolving);
    root.DungeonOnlineV3GameBridge?.beginRankedExtraction?.();
    pendingBoundaryExit = null;
    const payload = boundarySettlement ? { mode, boundarySettlement } : { mode };
    const response = await createClient().event("request_extraction", payload);
    if (operation && !isCurrentBoundaryOperation(operation)) return true;
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
    const finishExtraction = async () => {
      if (operation && !isCurrentOperationGeneration(operation)) return;
      extractedProfileReady = response.metaState?.status === "extraction" && Boolean(response.profile);
      session.transition(root.DungeonRankedV3Session.STATES.terminal);
      await finalize();
    };
    if (presentRankIntegrityNotice(response.metaState, () => {
      finishExtraction().catch(presentError);
    })) return;
    await finishExtraction();
  }

  async function onExtraction(mode) {
    const extractionMode = mode === "normal" ? "normal" : "emergency";
    if (boundaryOperation) return;
    if (session.getState() === root.DungeonRankedV3Session.STATES.resolving) {
      rememberPendingExtraction(extractionMode);
      root.DungeonOnlineV3GameBridge?.beginRankedExtraction?.();
      return;
    }
    try {
      if (!usesBoundarySettlement()) {
        await performExtraction(extractionMode);
        return;
      }
      await startBoundaryOperation(async (operation) => {
        await ensureRankedBoundaryBinding();
        if (!isCurrentBoundaryOperation(operation)) return true;
        const captured = mergeCapturedBoundary(captureRankedBoundary());
        if (extractionMode === "emergency") {
          pendingRoomSummary = null;
          return performExtraction(extractionMode, captured.eventPayload, operation);
        }
        pendingRoomSummary = captured.summary;
        rememberPendingExtraction(extractionMode);
        pendingBoundaryExit = "normal_extract";
        return continueBoundary(createClient().getSnapshot()?.publicState, operation);
      }, { loadingMessage: "Extracting…" });
    } catch (error) {
      presentError(error);
    }
  }

  async function resumeRanked() {
    pendingFreshCampaign = false;
    try {
      setRankedHudSyncing(true);
      moveToRecoveryState(root.DungeonRankedV3Session.STATES.retrying);
      ui.showMessage("Recovering Ranked", "Loading your last saved room...");
      await acceptResponse(await createClient().resumeCanonical());
      recoveryRootDiagnostic = null;
      automaticResyncPending = false;
      observerBotAutomationHalted = false;
    } catch (error) {
      presentError(error);
    }
  }

  async function markTestAssistance(assistanceClass) {
    const requestedClass = String(assistanceClass || "");
    const response = await createClient().event("mark_test_assistance", {
      assistanceClass: requestedClass
    });
    const projectedClass = String(response?.metaState?.assistanceClass || requestedClass);
    if (["observer_bot", "cheats", "mixed"].includes(projectedClass)) {
      knownHudAssistanceClass = projectedClass;
    }
    setRankedHudSyncing(false);
    return response;
  }
  async function unlockTestBot() {
    const password = typeof root.prompt === "function" ? root.prompt("Observer Bot password") : "";
    if (password === null) return false;
    try {
      const unlocked = await root.DungeonOnlineV3GameBridge?.unlockRankedTestBot?.(password);
      if (!unlocked) ui.setStatus("The test password was not accepted.");
      else ui.hide();
      return Boolean(unlocked);
    } catch (error) {
      presentError(error);
      return false;
    }
  }
  function openRankedEntry() {
    const hasRecovery = Boolean(recoveryStore.loadRecovery());
    const testBotEnabled = root.DUNGEON_ONLINE_TEST_BOT_ENABLED === true;
    if (!hasRecovery) {
      if (testBotEnabled) {
        ui.showMenu("Ranked (Online)", "Start a connected Ranked descent.", [
          ui.button("Start Ranked", () => {
            prepareFreshRankedStart();
            markFreshCampaign();
            startRanked().catch(presentError);
          }),
          ui.button("Cancel", () => ui.hide())
        ]);
      } else {
        prepareFreshRankedStart();
        markFreshCampaign();
        startRanked();
      }
      return;
    }
    ui.showMenu(
      "Ranked (Online)",
      "Start a new Ranked run or continue the saved Ranked run.",
      [
        ui.button("Start New Ranked", () => startNewRanked().catch(presentError)),
        ui.button("Continue Ranked", () => resumeRanked().catch(presentError)),
        ui.button("Cancel", () => ui.hide())
      ]
    );
  }

  const menuEnabled = Boolean(String(root.DUNGEON_ONLINE_V3_API || "").trim());
  root.DungeonOnlineV3Menu = Object.freeze({
    extendOptions(baseOptions) {
      if (!menuEnabled || !Array.isArray(baseOptions)) return baseOptions;
      const options = new Map(baseOptions.map((option) => [option.id, option]));
      const practice = options.get("practice");
      const ranked = {
        id: "ranked-online",
        key: "2",
        title: "Ranked (Online)",
        desc: recoveryStore.loadRecovery()
          ? "Continue your active Ranked descent."
          : "Start a connected Ranked descent.",
        disabled: false,
        action: openRankedEntry
      };
      const leaderboard = options.get("leaderboard");
      const ordered = [
        practice ? { ...practice, title: "Practice (Offline)" } : null,
        ranked,
        leaderboard ? {
          ...leaderboard,
          title: "Ranked Leaderboard",
          desc: "View the current Ranked season.",
          action: () => openLeaderboard(true)
        } : null,
        options.get("nickname"),
        options.get("tutorial"),
        options.get("options")
      ].filter(Boolean);
      return ordered.map((option, index) => ({ ...option, key: String(index + 1) }));
    },
    openRanked: openRankedEntry,
    openLeaderboard: (opener = null) => openLeaderboard(true, opener)
  });

  ui.entry.addEventListener("click", openRankedEntry);
  leaderboardEntry.addEventListener("click", () => openLeaderboard(true));
  root.addEventListener("beforeunload", () => client?.releaseWriter?.());
  root.setInterval(() => {
    client?.heartbeatWriter?.();
    ui.setEntryVisible(false);
    leaderboardEntry.hidden = true;
  }, 250);

  root.DungeonOnlineV3 = Object.freeze({
    mode: "practice",
    startRanked,
    resumeRanked,
    usesBoundarySettlement,
    onLocalRoomCleared,
    onOtterChestOpen,
    onPortalEntry,
    onRoomEntered,
    completeRankedMerchantAction,
    failRankedMerchantAction,
    getRankedMerchantMutationState,
    onMerchantOpen,
    onMerchantAction,
    onMerchantLeave,
    onFatalEvent,
    onExtraction,
    onCampAction,
    onCampStartRun,
    onElixirUsed: recordElixirUsage,
    unlockTestBot,
    requestTestControlsUnlock: unlockTestBot,
    markTestAssistance,
    getRankedHudStatus,
    openLeaderboard: (opener = null) => openLeaderboard(true, opener),
    leaveToMainMenu: returnToPractice,
    onForgeMode,
    onForgeChoice,
    onForgeLeave,
    onRelicReplacementChoice,
    onRelicReplacementCancel,
    supportsPostRoomPactSettlement,
    isRankedAutomationBlocked,
    isObserverBotBoundaryPending,
    getSessionState: () => session.getState(),
    getSnapshot: () => client?.getSnapshot() || null,
    getDiagnostics: () => diagnosticEntries.map(sanitizeDiagnosticEntry),
    clearDiagnostics: () => {
      diagnosticEntries = [];
      try { root.localStorage.removeItem(RANKED_DIAGNOSTICS_KEY); } catch {}
    }
  });
})(typeof globalThis === "object" ? globalThis : null);
