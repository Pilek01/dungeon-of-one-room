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
  let extractedProfileReady = false;
  let currentCampResponse = null;
  let campMutationPending = false;
  let pendingFreshCampaign = false;
  let pendingElixirUsage = null;
  let currentMerchantOffer = null;
  let merchantMutationPending = false;
  let currentForgeOffer = null;
  let currentForgeContext = null;
  let forgeMutationPending = false;
  let pendingNativeRelicReplacement = null;
  let observerBotBoundaryPending = false;
  let observerBotAutomationHalted = false;
  let activeRoomIntegrity = null;
  const shownRankIntegrityNotices = new Set();
  const recoveryStore = root.DungeonRankedV3Storage.createStore(root.localStorage);

  const ROOM_COMPLETION_CAPABILITY_INVALID = "local_room_completion_capability_invalid";
  const RANK_INTEGRITY_NOTICE_PREFIX = "dungeonOnlineV3RankIntegrityNotice:";

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
    ui.showMessage(
      "Ranked integrity check failed.",
      "You can continue playing, but this run will not be submitted to the leaderboard.",
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
    root.DungeonOnlineV3GameBridge?.setRoomIntegrityContext?.({
      completionCapability,
      startingGold
    });
  }

  function usesBoundarySettlement() {
    const rulesetHash = createClient().getSnapshot()?.publicState?.rulesetHash;
    return protocol.supportsBoundarySettlement?.(rulesetHash) === true;
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
    return {
      summary: {
        turnCount: Math.max(0, Math.floor(Number(captured.turnCount) || 0)),
        rewardClaims: Array.isArray(captured.rewardClaims) ? captured.rewardClaims : [],
        reportedGoldDelta,
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
        turnCount: Math.max(0, Math.floor(Number(captured.turnCount) || 0)),
        elapsedMs: Math.max(0, Date.now() - startedAt),
        commandJournalDigest: `boundary:${directive.directiveId}:${Math.max(0, Math.floor(Number(captured.turnCount) || 0))}`,
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
      log(kind, detail) {
        if (root.DUNGEON_ONLINE_V3_DEBUG === true) console.debug(`[Online v3] ${kind}`, detail);
      }
    });
    return client;
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
    pendingExtractionMode = null;
    pendingBoundaryExit = null;
    extractedProfileReady = false;
    pendingFreshCampaign = false;
    pendingElixirUsage = null;
    currentForgeOffer = null;
    currentForgeContext = null;
    forgeMutationPending = false;
    pendingNativeRelicReplacement = null;
    observerBotBoundaryPending = false;
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

  async function resyncCanonical() {
    moveToRecoveryState(root.DungeonRankedV3Session.STATES.retrying);
    ui.setStatus("Refreshing your Ranked run...");
    await acceptResponse(await createClient().resumeCanonical());
  }

  function returnToPractice() {
    pendingFreshCampaign = false;
    pendingElixirUsage = null;
    if (session.getState() === root.DungeonRankedV3Session.STATES.finalized) {
      clearEndedRecovery();
      return;
    }
    pendingExtractionMode = null;
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
    pendingFreshCampaign = false;
    pendingElixirUsage = null;
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

  function presentError(error) {
    if (isRankedObserverBotActive()) observerBotAutomationHalted = true;
    const code = String(error?.code || "");
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
    if (error?.retryable || ["NETWORK_ERROR", "TIMEOUT"].includes(code)) {
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
    controls.push(
      ui.button("Resync Ranked Run", () => resyncCanonical().catch(presentError)),
      ui.button("Main Menu", returnToPractice),
      ui.button("Abandon Ranked Run", confirmAbandon)
    );
    ui.showMessage(
      conflict ? "Ranked state conflict" : "Ranked reconnect required",
      conflict
        ? "Your Ranked run changed. Refresh it before continuing."
        : "Recovery is preserved. Main Menu does not abandon the Ranked run.",
      controls
    );
    if ((conflict || ["TOKEN_EXPIRED", "REVISION_CONFLICT", "STATE_DIGEST_CONFLICT", "ROOM_TOKEN_CONFLICT"].includes(code)) && !protocolFailure) {
      root.setTimeout(() => resyncCanonical().catch(presentError), 0);
    }
  }

  async function retryPending() {
    try {
      session.transition(root.DungeonRankedV3Session.STATES.retrying);
      ui.setStatus("Retrying the exact operation...");
      const response = await createClient().retryPending();
      pendingElixirUsage = null;
      await acceptResponse(response);
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

  async function acceptResponse(response) {
    const state = response.metaState;
    if (!state || !protocol.isSupportedRulesetHash(state.rulesetHash)) {
      throw new TypeError("RANKED_RULESET_MISMATCH");
    }
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
    if (state.status === "active" && state.currentRoomDirective) {
      if (pendingExtractionMode) {
        const extractionMode = pendingExtractionMode;
        pendingExtractionMode = null;
        await performExtraction(extractionMode);
        return;
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
    try {
      session.transition(root.DungeonRankedV3Session.STATES.starting);
      ui.showMessage("Entering Ranked", "Preparing your descent...");
      startedAt = Date.now();
      const response = await createClient().start({
        playerName: publicName(),
        season: String(root.DUNGEON_ONLINE_V3_SEASON || "local-m4"),
        gameVersion: String(root.DUNGEON_GAME_VERSION || root.GAME_VERSION || "v0.8.2"),
        startDepth: Math.max(0, Math.floor(Number(startDepth) || 0)),
        practiceMutatorImport: root.DungeonOnlineV3GameBridge?.getPracticeMutatorImport?.() || null,
        newCampaign: pendingFreshCampaign,
        clientInstallIdHash: await installationHash()
      });
      await acceptResponse(response);
    } catch (error) {
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
  async function commitReplacement(replacement, replacementChoiceId) {
    ui.setStatus("Replacing your relic...");
    const response = await createClient().event("commit_relic_replacement", {
      transactionId: replacement.transactionId,
      replacementChoiceId
    });
    pendingNativeRelicReplacement = null;
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
    root.DungeonOnlineV3GameBridge?.completeRankedRelicReplacement?.(response.metaState);
    await continueBoundary(response.metaState);
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

  async function presentReplacement(replacement) {
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    const choices = offers.replacementChoices(replacement);
    if (isRankedObserverBotActive()) {
      ui.hide();
      const choice = stableObserverBotChoice(choices, "replacementChoiceId");
      return runObserverBotBoundary(async () => {
        if (choice) return commitReplacement(replacement, choice.replacementChoiceId);
        if (!replacement.cancelAllowed) throw new TypeError("RANKED_BOT_REPLACEMENT_UNAVAILABLE");
        const response = await createClient().event("cancel_relic_replacement", {
          transactionId: replacement.transactionId
        });
        return continueBoundary(response.metaState);
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

  async function selectRelicOffer(offer, choiceId) {
    const response = await createClient().event("select_relic", {
      offerId: offer.offerId,
      choiceId
    });
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
    await continueBoundary(response.metaState);
  }

  async function presentRelicOffer(offer) {
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    const choices = offers.relicChoices(offer);
    if (isRankedObserverBotActive()) {
      ui.hide();
      const choice = stableObserverBotChoice(choices, "choiceId");
      if (!choice) throw new TypeError("RANKED_BOT_RELIC_CHOICE_UNAVAILABLE");
      return runObserverBotBoundary(() => selectRelicOffer(offer, choice.choiceId));
    }
    ui.showChoices(
      "Choose a Relic",
      "Choose one relic to carry into the next room.",
      choices,
      (choiceId) => selectRelicOffer(offer, choiceId).catch(presentError)
    );
  }

  async function issueRelicSlot(slot) {
    const response = await createClient().event("issue_relic_offer", {
      rewardSlotId: slot.slotId
    });
    await continueBoundary(response.metaState);
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
    const choice = offer.choices.find((entry) => entry.choiceId === choiceId);
    if (!choice || choice.status !== "available") throw new TypeError("RANKED_META_CHOICE_UNAVAILABLE");
    ui.setStatus("Confirming your choice...");
    const response = await createClient().event("commit_meta_transaction", {
      transactionId: choice.transactionId,
      choiceId: choice.choiceId
    });
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
    await continueBoundary(response.metaState);
  }

  async function presentMetaOffer(offer, state) {
    if (offer?.sourceType === "forge" && !isRankedObserverBotActive()) {
      return presentNativeForge(state, currentForgeContext || {});
    }
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    const choices = offers.metaChoices(offer).filter((choice) => !choice.disabled);
    if (isRankedObserverBotActive()) {
      ui.hide();
      const choice = stableObserverBotChoice(offer.choices, "choiceId", true);
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
    ui.overlay.querySelector(".ranked-v3-actions")?.append(
      ui.button("Done", () => resolveCheckpoint().catch(presentError))
    );
  }

  async function openMetaOffer(roomType) {
    let payload = {};
    const response = await createClient().event("open_meta_offer", payload);
    await continueBoundary(response.metaState);
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
    root.DungeonOnlineV3GameBridge.enterRankedMerchant(state, offer, request);
    ui.hide();
  }

  function presentMerchantError(error) {
    if (root.DUNGEON_ONLINE_V3_DEBUG === true) {
      console.debug("[Online v3] Merchant error", error);
    }
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

  function onMerchantAction(request = {}) {
    if (merchantMutationPending) return true;
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
      return true;
    }
    merchantMutationPending = true;
    root.DungeonOnlineV3GameBridge?.beginRankedMerchantRequest?.();
    createClient().event("commit_meta_transaction", {
      transactionId: choice.transactionId,
      choiceId: choice.choiceId
    })
      .then((response) => {
        root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
        presentNativeMerchant(response.metaState, request);
      })
      .catch(presentMerchantError)
      .finally(() => { merchantMutationPending = false; });
    return true;
  }

  async function onMerchantLeave(options = {}) {
    if (merchantMutationPending) return true;
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
    ui.hide();
  }

  async function openCamp() {
    const response = await createClient().camp("open");
    presentNativeCamp(response);
    return response;
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

  async function continueBoundary(state) {
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(state);
    if (state.relicReplacement) return presentReplacement(state.relicReplacement);
    if (state.relicOffer) return presentRelicOffer(state.relicOffer);
    if (state.metaTransactionOffer) return presentMetaOffer(state.metaTransactionOffer, state);
    const slot = offers.pendingRewardSlots(state, {
      roomClearPending: Boolean(pendingRoomSummary)
    })[0];
    if (slot) return issueRelicSlot(slot);
    if (pendingRoomSummary && pendingBoundaryExit) {
      return resolveCheckpoint({
        loadingMessage: pendingBoundaryExit === "portal" ? "Loading next depth…" : "Extracting…"
      });
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
      return resolveCheckpoint();
    }
    if (state.currentRoomDirective) {
      const directive = directives.applyOnlineV3RoomDirective(state.currentRoomDirective);
      root.DungeonOnlineV3GameBridge.setNextDirective(directive);
      session.transition(root.DungeonRankedV3Session.STATES.next);
    }
    ui.hide();
  }

  async function continueResolvedCheckpoint(state) {
    if (["victory", "defeat", "extraction"].includes(state.status)) {
      session.transition(root.DungeonRankedV3Session.STATES.terminal);
      showTerminal(state);
      return;
    }
    if (pendingExtractionMode) {
      const extractionMode = pendingExtractionMode;
      pendingExtractionMode = null;
      await performExtraction(extractionMode);
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
    await continueBoundary(state);
  }

  async function resolveCheckpoint(options = {}) {
    const summary = pendingRoomSummary || {};
    pendingRoomSummary = null;
    let loadingTimer = null;
    try {
      if (session.getState() !== root.DungeonRankedV3Session.STATES.resolving) {
        session.transition(root.DungeonRankedV3Session.STATES.resolving);
      }
      if (options.loadingMessage) {
        loadingTimer = root.setTimeout(() => ui.showSync(options.loadingMessage), 180);
      } else if (options.silent !== true) {
        ui.showSync("Saving progress...");
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
        commands: []
      });
      if (loadingTimer !== null) root.clearTimeout(loadingTimer);
      root.DungeonOnlineV3GameBridge?.showRankedRoomClearAward?.(fixedAwardGold);
      pendingElixirUsage = null;
      const state = response.metaState;
      root.DungeonOnlineV3GameBridge.syncCanonicalProjection(state);
      if (presentRankIntegrityNotice(state, () => {
        continueResolvedCheckpoint(state).catch(presentError);
      })) return true;
      await continueResolvedCheckpoint(state);
    } catch (error) {
      if (loadingTimer !== null) root.clearTimeout(loadingTimer);
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
    if (isObserverBotBoundaryPending()) return true;
    if (!pendingRoomSummary) return false;
    Promise.resolve().then(async () => {
      if (usesBoundarySettlement()) {
        const captured = mergeCapturedBoundary(captureRankedBoundary());
        pendingRoomSummary = captured.summary;
        if (options.enterPortal === true) pendingBoundaryExit = "portal";
      }
      const resolved = await resolveCheckpoint({
        silent: true,
        loadingMessage: options.enterPortal === true ? "Loading next depth…" : ""
      });
      if (resolved && options.enterPortal === true && !usesBoundarySettlement()) {
        root.DungeonOnlineV3GameBridge?.enterNextDirective?.();
      }
    }).catch(presentError);
    return true;
  }

  function onPortalEntry() {
    if (!usesBoundarySettlement() || !pendingRoomSummary) return false;
    if (session.getState() === root.DungeonRankedV3Session.STATES.resolving) return true;
    const captured = mergeCapturedBoundary(captureRankedBoundary());
    pendingRoomSummary = {
      ...captured.summary,
      integritySignals: pendingRoomSummary.integritySignals || []
    };
    pendingBoundaryExit = "portal";
    const state = createClient().getSnapshot()?.publicState;
    const task = () => continueBoundary(state);
    void (isRankedObserverBotActive() ? runObserverBotBoundary(task) : task()).catch(presentError);
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
    installRoomIntegrityContext(directive);
    if (session.getState() === root.DungeonRankedV3Session.STATES.next) {
      session.transition(root.DungeonRankedV3Session.STATES.active);
    }
    if (directive.roomType === "merchant") {
      currentMerchantOffer = null;
      merchantMutationPending = false;
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
    session.transition(root.DungeonRankedV3Session.STATES.finalized);
    if (extractedProfileReady) {
      await openCamp();
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

  async function performExtraction(mode, boundarySettlement = null) {
    const resolving = root.DungeonRankedV3Session.STATES.resolving;
    if (session.getState() !== resolving) session.transition(resolving);
    root.DungeonOnlineV3GameBridge?.beginRankedExtraction?.();
    pendingBoundaryExit = null;
    const payload = boundarySettlement ? { mode, boundarySettlement } : { mode };
    const response = await createClient().event("request_extraction", payload);
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
    const finishExtraction = async () => {
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
    if (session.getState() === root.DungeonRankedV3Session.STATES.resolving) {
      if (!pendingExtractionMode) pendingExtractionMode = extractionMode;
      root.DungeonOnlineV3GameBridge?.beginRankedExtraction?.();
      return;
    }
    try {
      if (!usesBoundarySettlement()) {
        await performExtraction(extractionMode);
        return;
      }
      ui.showSync("Extracting…");
      const captured = mergeCapturedBoundary(captureRankedBoundary());
      if (extractionMode === "emergency") {
        pendingRoomSummary = null;
        await performExtraction(extractionMode, captured.eventPayload);
        return;
      }
      pendingRoomSummary = captured.summary;
      pendingExtractionMode = extractionMode;
      pendingBoundaryExit = "normal_extract";
      await continueBoundary(createClient().getSnapshot()?.publicState);
    } catch (error) {
      presentError(error);
    }
  }

  async function resumeRanked() {
    pendingFreshCampaign = false;
    try {
      moveToRecoveryState(root.DungeonRankedV3Session.STATES.retrying);
      ui.showMessage("Recovering Ranked", "Loading your last saved room...");
      await acceptResponse(await createClient().resumeCanonical());
    } catch (error) {
      presentError(error);
    }
  }

  async function markTestAssistance(assistanceClass) {
    return createClient().event("mark_test_assistance", {
      assistanceClass: String(assistanceClass || "")
    });
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
    usesBoundarySettlement,
    onLocalRoomCleared,
    onPortalEntry,
    onRoomEntered,
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
    openLeaderboard: (opener = null) => openLeaderboard(true, opener),
    leaveToMainMenu: returnToPractice,
    onForgeMode,
    onForgeChoice,
    onForgeLeave,
    onRelicReplacementChoice,
    onRelicReplacementCancel,
    isObserverBotBoundaryPending,
    getSessionState: () => session.getState(),
    getSnapshot: () => client?.getSnapshot() || null
  });
})(typeof globalThis === "object" ? globalThis : null);
