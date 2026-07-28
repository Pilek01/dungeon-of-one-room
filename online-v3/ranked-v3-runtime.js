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
  let extractedProfileReady = false;
  let currentCampResponse = null;
  let campMutationPending = false;
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
      ui.showMessage("Ranked Build", "Loading this descent...");
      const detail = leaderboardUi.createDetailViewModel(
        await createLeaderboardClient().detail(runId)
      );
      ui.showContent(
        "Ranked Build",
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
    client?.releaseWriter?.();
    client?.clearRecovery?.();
    client?.clear();
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

  async function forgetLocalRecoveryAndStartNew() {
    clearEndedRecovery();
    await startRanked();
  }

  function confirmForgetLocalRecovery() {
    ui.showMessage(
      "Forget Local Ranked Save?",
      "This browser cannot recover that save. Forget it here to start a new Ranked run.",
      [
        ui.button("Forget and Start New", () => forgetLocalRecoveryAndStartNew().catch(presentError)),
        ui.button("Keep Local Save", openRankedEntry)
      ]
    );
  }

  async function abandonCanonical() {
    ui.setStatus("Abandoning your Ranked run...");
    await createClient().abandonCanonical();
    client = null;
    moveToRecoveryState(root.DungeonRankedV3Session.STATES.abandoned);
    root.DungeonOnlineV3GameBridge?.returnToPractice?.();
    ui.hide();
  }

  async function abandonAndStartNewRanked() {
    ui.setStatus("Ending the saved Ranked run...");
    try {
      await createClient().abandonCanonical();
      client = null;
      session = root.DungeonRankedV3Session.createStateMachine(
        root.DungeonRankedV3Session.STATES.abandoned
      );
    } catch (error) {
      if (!isEndedRecoveryError(error)) throw error;
      clearEndedRecovery();
    }
    await startRanked();
  }

  function confirmStartNewRanked() {
    if (!recoveryStore.loadRecovery()) {
      startRanked().catch(presentError);
      return;
    }
    ui.showMessage(
      "Start New Ranked Run?",
      "This permanently ends the saved Ranked run before starting a new one.",
      [
        ui.button("Confirm New Ranked", () => abandonAndStartNewRanked().catch(presentError)),
        ui.button("Keep Saved Run", openRankedEntry)
      ]
    );
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
      ui.showMessage(
        "Ranked Save Cannot Be Recovered",
        "The saved Ranked run cannot be verified by this browser.",
        [
          ui.button("Forget Local Ranked Save", confirmForgetLocalRecovery),
          ui.button("Main Menu", () => ui.hide())
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
    if (!state || state.rulesetHash !== protocol.RULESET_HASH) {
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
      const directive = directives.applyOnlineV3RoomDirective(state.currentRoomDirective);
      session.transition(root.DungeonRankedV3Session.STATES.entering);
      ui.hide();
      const bridge = root.DungeonOnlineV3GameBridge;
      if (!bridge || typeof bridge.startRanked !== "function") {
        throw new TypeError("RANKED_GAME_BRIDGE_UNAVAILABLE");
      }
      bridge.startRanked(directive, state);
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

  async function startRanked() {
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
        clientInstallIdHash: await installationHash()
      });
      await acceptResponse(response);
    } catch (error) {
      presentError(error);
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
    ui.showChoices(
      "Choose a relic to replace",
      `Incoming: ${displayRelicName(replacement.incoming?.relicId)}.`,
      offers.replacementChoices(replacement),
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

  async function presentRelicOffer(offer) {
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    ui.showChoices(
      "Choose a Relic",
      "Choose one relic to carry into the next room.",
      offers.relicChoices(offer),
      async (choiceId) => {
        try {
          const response = await createClient().event("select_relic", {
            offerId: offer.offerId,
            choiceId
          });
          root.DungeonOnlineV3GameBridge.syncCanonicalProjection(response.metaState);
          await continueBoundary(response.metaState);
        } catch (error) {
          presentError(error);
        }
      }
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

  function presentMetaOffer(offer) {
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    ui.showChoices(
      `${offer.sourceType || "Ranked"} choices`,
      "Choose how to shape your build.",
      offers.metaChoices(offer).filter((choice) => !choice.disabled),
      (choiceId) => commitMetaChoice(offer, choiceId).catch(presentError)
    );
    ui.overlay.querySelector(".ranked-v3-actions")?.append(
      ui.button("Done", () => resolveCheckpoint().catch(presentError))
    );
  }

  async function openMetaOffer(roomType) {
    let payload = {};
    if (roomType === "forge") {
      ui.showMessage("Forge", "Choose the Forge operation.", [
        ui.button("Temper", async () => {
          try {
            await continueBoundary((await createClient().event("open_meta_offer", { mode: "temper" })).metaState);
          } catch (error) { presentError(error); }
        }),
        ui.button("Transmute", async () => {
          try {
            await continueBoundary((await createClient().event("open_meta_offer", { mode: "transmute" })).metaState);
          } catch (error) { presentError(error); }
        })
      ]);
      return;
    }
    const response = await createClient().event("open_meta_offer", payload);
    await continueBoundary(response.metaState);
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
    ui.showMessage("Camp unavailable", "Your Ranked Camp state is preserved.", [
      ui.button("Retry Camp", () => openCamp().catch(presentCampError)),
      ui.button("Back to Camp", () => ui.hide())
    ]);
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

  function onCampStartRun() {
    if (campMutationPending) return false;
    campMutationPending = true;
    Promise.resolve()
      .then(() => {
        client?.clearRecovery?.();
        client?.clear?.();
        client = null;
        currentCampResponse = null;
        extractedProfileReady = false;
        session = root.DungeonRankedV3Session.createStateMachine();
        ui.hide();
        return startRanked();
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

  async function resolveCheckpoint() {
    const summary = pendingRoomSummary || {};
    pendingRoomSummary = null;
    try {
      if (session.getState() !== root.DungeonRankedV3Session.STATES.resolving) {
        session.transition(root.DungeonRankedV3Session.STATES.resolving);
      }
      ui.showSync("Saving progress...");
      const response = await createClient().checkpoint({
        turnCount: summary?.turnCount,
        elapsedMs: Math.max(0, Date.now() - startedAt),
        rewardClaims: summary?.rewardClaims || [],
        commands: []
      });
      const state = response.metaState;
      root.DungeonOnlineV3GameBridge.syncCanonicalProjection(state);
      if (["victory", "defeat", "extraction"].includes(state.status)) {
        session.transition(root.DungeonRankedV3Session.STATES.terminal);
        showTerminal(state);
        return;
      }
      await continueBoundary(state);
    } catch (error) {
      pendingRoomSummary = summary;
      presentError(error);
    }
  }

  async function onLocalRoomCleared(summary) {
    pendingRoomSummary = summary || {};
    const state = createClient().getSnapshot()?.publicState;
    const roomType = state?.currentRoomDirective?.roomType;
    if (["forge", "pact"].includes(roomType)) {
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
  }

  async function onRoomEntered(directive) {
    if (!directive) return;
    if (session.getState() === root.DungeonRankedV3Session.STATES.next) {
      session.transition(root.DungeonRankedV3Session.STATES.active);
    }
    if (!["merchant", "crossroads"].includes(directive.roomType)) return;
    pendingRoomSummary = { turnCount: 0, rewardClaims: [] };
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    await openMetaOffer(directive.roomType);
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
      const response = await createClient().event("report_fatal_event", {
        classification: "local_fatal_event"
      });
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

  async function onExtraction(mode) {
    try {
      session.transition(root.DungeonRankedV3Session.STATES.resolving);
      root.DungeonOnlineV3GameBridge?.beginRankedExtraction?.();
      const response = await createClient().event("request_extraction", { mode });
      extractedProfileReady = response.metaState?.status === "extraction" && Boolean(response.profile);
      session.transition(root.DungeonRankedV3Session.STATES.terminal);
      await finalize();
    } catch (error) {
      presentError(error);
    }
  }

  async function resumeRanked() {
    try {
      moveToRecoveryState(root.DungeonRankedV3Session.STATES.retrying);
      ui.showMessage("Recovering Ranked", "Loading your last saved room...");
      await acceptResponse(await createClient().resumeCanonical());
    } catch (error) {
      presentError(error);
    }
  }

  function openRankedEntry() {
    const hasRecovery = Boolean(recoveryStore.loadRecovery());
    ui.showMessage(
      "Ranked (Online)",
      hasRecovery
        ? "Start a new Ranked run or continue the saved Ranked run."
        : "Start a new Ranked run. No Ranked save is available in this browser.",
      [
        ui.button("Start New Ranked", confirmStartNewRanked),
        ui.button("Continue Ranked", () => resumeRanked().catch(presentError), !hasRecovery),
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
    onFatalEvent,
    onExtraction,
    onCampAction,
    onCampStartRun,
    leaveToMainMenu: returnToPractice,
    getSessionState: () => session.getState(),
    getSnapshot: () => client?.getSnapshot() || null
  });
})(typeof globalThis === "object" ? globalThis : null);
