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
  let leaderboardCursor = null;
  let startedAt = 0;
  let pendingRoomSummary = null;
  let pendingExtractionMode = null;
  let extractedProfileReady = false;
  let currentCampResponse = null;
  let campMutationPending = false;
  let pendingFreshCampaign = false;
  let pendingElixirUsage = null;
  let pendingBotPassword = null;
  let currentMerchantOffer = null;
  let merchantMutationPending = false;
  let observerBotBoundaryPending = false;
  let observerBotAutomationHalted = false;
  const recoveryStore = root.DungeonRankedV3Storage.createStore(root.localStorage);

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
    extractedProfileReady = false;
    pendingFreshCampaign = false;
    pendingElixirUsage = null;
    pendingBotPassword = null;
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

  function leaderboardControls() {
    const controls = [
      ui.button("Close", () => ui.hide())
    ];
    if (leaderboardCursor) {
      controls.unshift(ui.button("Load next page", () => openLeaderboard(false)));
    }
    return controls;
  }

  function showLeaderboardRows() {
    if (!leaderboardRows.length) {
      ui.showMessage("Ranked Leaderboard", "No Ranked results have been published this season.", [
        ui.button("Close", () => ui.hide())
      ]);
      return;
    }
    const content = leaderboardUi.renderList(
      root.document,
      leaderboardRows,
      (runId) => openLeaderboardDetail(runId)
    );
    ui.showContent(
      "Ranked Leaderboard",
      "The strongest descents of the current season.",
      content,
      leaderboardControls()
    );
  }

  async function openLeaderboard(reset = true) {
    try {
      if (reset) {
        leaderboardRows = [];
        leaderboardCursor = null;
      }
      ui.showMessage("Ranked Leaderboard", "Loading season results...");
      const payload = await createLeaderboardClient().list({
        season: String(root.DUNGEON_ONLINE_V3_SEASON || "local-m4"),
        limit: 20,
        cursor: reset ? "" : leaderboardCursor
      });
      const page = leaderboardUi.createLeaderboardViewModel(payload, leaderboardRows.length);
      leaderboardRows = leaderboardRows.concat(page.rows);
      leaderboardCursor = page.cursor;
      showLeaderboardRows();
    } catch {
      ui.showMessage("Leaderboard unavailable", "Season results could not be loaded.", [
        ui.button("Retry", () => openLeaderboard(reset)),
        ui.button("Close", () => ui.hide())
      ]);
    }
  }

  async function openLeaderboardDetail(runId) {
    try {
      ui.showMessage("Build Chronicle", "Loading this descent...");
      const detail = leaderboardUi.createDetailViewModel(
        await createLeaderboardClient().detail(runId)
      );
      ui.showContent(
        "Build Chronicle",
        displaySeason(detail.season),
        leaderboardUi.renderDetail(root.document, detail),
        [
          ui.button("Back to leaderboard", showLeaderboardRows),
          ui.button("Close", () => ui.hide())
        ]
      );
    } catch {
      ui.showMessage("Build details unavailable", "This Ranked build could not be loaded.", [
        ui.button("Back to leaderboard", showLeaderboardRows),
        ui.button("Close", () => ui.hide())
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
    pendingBotPassword = null;
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
    pendingBotPassword = null;
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
    pendingBotPassword = null;
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
      if (pendingBotPassword !== null) {
        const password = pendingBotPassword;
        pendingBotPassword = null;
        const unlocked = await bridge.unlockRankedTestBot?.(password);
        if (!unlocked) ui.showMessage("Observer Bot locked", "The test password was not accepted.", [ui.button("Close", () => ui.hide())]);
      }
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
        gameVersion: String(root.DUNGEON_GAME_VERSION || root.GAME_VERSION || "v0.8.0"),
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
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
    await continueBoundary(response.metaState);
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

  async function presentMetaOffer(offer) {
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
      const resolved = await resolveCheckpoint({ onError: presentMerchantError, silent: true });
      if (resolved && options.enterPortal === true) {
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
    if (state.metaTransactionOffer) return presentMetaOffer(state.metaTransactionOffer);
    const slot = offers.pendingRewardSlots(state, {
      roomClearPending: Boolean(pendingRoomSummary)
    })[0];
    if (slot) return issueRelicSlot(slot);
    if (pendingRoomSummary) return resolveCheckpoint();
    if (state.currentRoomDirective) {
      const directive = directives.applyOnlineV3RoomDirective(state.currentRoomDirective);
      root.DungeonOnlineV3GameBridge.setNextDirective(directive);
      session.transition(root.DungeonRankedV3Session.STATES.next);
    }
    ui.hide();
  }

  async function resolveCheckpoint(options = {}) {
    const summary = pendingRoomSummary || {};
    pendingRoomSummary = null;
    try {
      if (session.getState() !== root.DungeonRankedV3Session.STATES.resolving) {
        session.transition(root.DungeonRankedV3Session.STATES.resolving);
      }
      if (options.silent !== true) ui.showSync("Saving progress...");
      const response = await createClient().checkpoint({
        turnCount: summary?.turnCount,
        elapsedMs: Math.max(0, Date.now() - startedAt),
        rewardClaims: appendElixirUsageClaim(summary?.rewardClaims || []),
        commands: []
      });
      pendingElixirUsage = null;
      const state = response.metaState;
      root.DungeonOnlineV3GameBridge.syncCanonicalProjection(state);
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
      await continueBoundary(state);
    } catch (error) {
      pendingRoomSummary = summary;
      (typeof options.onError === "function" ? options.onError : presentError)(error);
      return false;
    }
    return true;
  }


  function onForgeMode(mode) {
    if (!pendingRoomSummary || !["temper", "transmute"].includes(mode)) return false;
    if (isRankedObserverBotActive()) {
      void runObserverBotBoundary(async () => {
        session.transition(root.DungeonRankedV3Session.STATES.offer);
        const response = await createClient().event("open_meta_offer", { mode });
        await continueBoundary(response.metaState);
      });
      return true;
    }
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    createClient().event("open_meta_offer", { mode })
      .then((response) => continueBoundary(response.metaState))
      .catch(presentError);
    return true;
  }

  function onForgeLeave(options = {}) {
    if (isObserverBotBoundaryPending()) return true;
    if (!pendingRoomSummary) return false;
    Promise.resolve().then(async () => {
      const resolved = await resolveCheckpoint({ silent: true });
      if (resolved && options.enterPortal === true) {
        root.DungeonOnlineV3GameBridge?.enterNextDirective?.();
      }
    }).catch(presentError);
    return true;
  }
  async function onLocalRoomCleared(summary) {
    pendingRoomSummary = summary || {};
    const state = createClient().getSnapshot()?.publicState;
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
    if (session.getState() === root.DungeonRankedV3Session.STATES.next) {
      session.transition(root.DungeonRankedV3Session.STATES.active);
    }
    if (directive.roomType === "merchant") {
      currentMerchantOffer = null;
      merchantMutationPending = false;
      pendingRoomSummary = { turnCount: 0, rewardClaims: [] };
      ui.hide();
      return;
    }
    if (directive.roomType !== "crossroads") return;
    pendingRoomSummary = { turnCount: 0, rewardClaims: [] };
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
      ui.showSync("Checking your fate...");
      const previousState = createClient().getSnapshot()?.publicState;
      const previousDirectiveId = previousState?.currentRoomDirective?.directiveId || null;
      const fatalPayload = { classification: "local_fatal_event" };
      if (pendingElixirUsage && pendingElixirUsage.count > 0) fatalPayload.elixirUsage = { ...pendingElixirUsage };
      const response = await createClient().event("report_fatal_event", fatalPayload);
      pendingElixirUsage = null;
      const state = response.metaState;
      root.DungeonOnlineV3GameBridge.syncCanonicalProjection(state);
      if (["defeat", "victory", "extraction"].includes(state.status)) {
        session.transition(root.DungeonRankedV3Session.STATES.terminal);
        showTerminal(state);
        return;
      }
      const directive = directives.applyOnlineV3RoomDirective(state.currentRoomDirective);
      if (previousDirectiveId && directive.directiveId === previousDirectiveId) {
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
    } catch (error) {
      presentError(error);
    }
  }

  async function performExtraction(mode) {
    const resolving = root.DungeonRankedV3Session.STATES.resolving;
    if (session.getState() !== resolving) session.transition(resolving);
    root.DungeonOnlineV3GameBridge?.beginRankedExtraction?.();
    const response = await createClient().event("request_extraction", { mode });
    extractedProfileReady = response.metaState?.status === "extraction" && Boolean(response.profile);
    session.transition(root.DungeonRankedV3Session.STATES.terminal);
    await finalize();
  }

  async function onExtraction(mode) {
    const extractionMode = mode === "normal" ? "normal" : "emergency";
    if (session.getState() === root.DungeonRankedV3Session.STATES.resolving) {
      if (!pendingExtractionMode) pendingExtractionMode = extractionMode;
      root.DungeonOnlineV3GameBridge?.beginRankedExtraction?.();
      return;
    }
    try {
      await performExtraction(extractionMode);
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

  async function startRankedWithObserverBot() {
    const password = typeof root.prompt === "function" ? root.prompt("Observer Bot password") : "";
    if (password === null) return;
    prepareFreshRankedStart();
    pendingBotPassword = String(password || "");
    markFreshCampaign();
    await startRanked();
  }
  async function continueRankedWithObserverBot() {
    const password = typeof root.prompt === "function" ? root.prompt("Observer Bot password") : "";
    if (password === null) return;
    pendingBotPassword = String(password || "");
    await resumeRanked();
  }
  async function unlockTestBot() {
    const password = typeof root.prompt === "function" ? root.prompt("Observer Bot password") : "";
    if (password === null) return false;
    const unlocked = await root.DungeonOnlineV3GameBridge?.unlockRankedTestBot?.(password);
    if (!unlocked) ui.setStatus("The test password was not accepted.");
    else ui.hide();
    return Boolean(unlocked);
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
          ui.button("Start + Observer Bot", () => startRankedWithObserverBot().catch(presentError)),
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
        ...(testBotEnabled ? [
          ui.button("Continue + Observer Bot", () => continueRankedWithObserverBot().catch(presentError))
        ] : []),
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
    openLeaderboard: () => openLeaderboard(true)
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
    onLocalRoomCleared,
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
    leaveToMainMenu: returnToPractice,
    onForgeMode,
    onForgeLeave,
    isObserverBotBoundaryPending,
    getSessionState: () => session.getState(),
    getSnapshot: () => client?.getSnapshot() || null
  });
})(typeof globalThis === "object" ? globalThis : null);
