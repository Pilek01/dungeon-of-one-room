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
  leaderboardEntry.textContent = "Online v3 Leaderboard";
  leaderboardEntry.hidden = true;
  leaderboardEntry.setAttribute("aria-label", "Open the canonical Online v3 leaderboard.");
  root.document.body.append(leaderboardEntry);
  const session = root.DungeonRankedV3Session.createStateMachine();
  let client = null;
  let leaderboardClient = null;
  let leaderboardRows = [];
  let leaderboardCursor = null;
  let startedAt = 0;
  let pendingRoomSummary = null;
  let extractedProfileReady = false;
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
      ui.showMessage("Online v3 Leaderboard", "No canonical results are published for this season.", [
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
      "Online v3 Leaderboard",
      "Server order is preserved. Cursor pagination is canonical.",
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
      ui.showMessage("Online v3 Leaderboard", "Loading canonical results...");
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
      ui.showMessage("Leaderboard unavailable", "Canonical results could not be loaded.", [
        ui.button("Retry", () => openLeaderboard(reset)),
        ui.button("Close", () => ui.hide())
      ]);
    }
  }

  async function openLeaderboardDetail(runId) {
    try {
      ui.showMessage("Ranked build details", "Loading the immutable public projection...");
      const detail = leaderboardUi.createDetailViewModel(
        await createLeaderboardClient().detail(runId)
      );
      ui.showContent(
        "Ranked build details",
        `${detail.verificationLevel} · ${detail.season}`,
        leaderboardUi.renderDetail(root.document, detail),
        [
          ui.button("Back to leaderboard", showLeaderboardRows),
          ui.button("Close", () => ui.hide())
        ]
      );
    } catch {
      ui.showMessage("Build details unavailable", "The canonical public run projection could not be loaded.", [
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
    ui.setStatus("Resyncing the canonical Ranked state...");
    await acceptResponse(await createClient().resumeCanonical());
  }

  function returnToPractice() {
    if (![root.DungeonRankedV3Session.STATES.reconnect, root.DungeonRankedV3Session.STATES.protocolError].includes(session.getState())) {
      moveToRecoveryState(root.DungeonRankedV3Session.STATES.reconnect);
    }
    client?.clear();
    client = null;
    session.transition(root.DungeonRankedV3Session.STATES.abandoned);
    root.DungeonOnlineV3GameBridge?.returnToPractice?.();
    ui.hide();
  }

  async function abandonCanonical() {
    ui.setStatus("Abandoning the canonical Ranked run...");
    await createClient().abandonCanonical();
    client = null;
    moveToRecoveryState(root.DungeonRankedV3Session.STATES.abandoned);
    root.DungeonOnlineV3GameBridge?.returnToPractice?.();
    ui.hide();
  }

  function confirmAbandon() {
    ui.showMessage(
      "Abandon Ranked Run?",
      "This permanently ends the canonical run and removes local recovery. No leaderboard result will be published.",
      [
        ui.button("Confirm abandonment", () => abandonCanonical().catch(presentError)),
        ui.button("Keep recovery", () => presentError({ code: "RECOVERY_PRESERVED", status: 0 }))
      ]
    );
  }

  function presentError(error) {
    const code = String(error?.code || "");
    const conflict = error?.conflict || error?.status === 409;
    const protocolFailure = error instanceof TypeError || [
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
    const controls = [];
    if (error?.retryable || ["NETWORK_ERROR", "TIMEOUT"].includes(code)) {
      controls.push(ui.button("Retry exact action", retryPending));
    }
    controls.push(
      ui.button("Resync Ranked Run", () => resyncCanonical().catch(presentError)),
      ui.button("Return to Practice", returnToPractice),
      ui.button("Abandon Ranked Run", confirmAbandon)
    );
    ui.showMessage(
      conflict ? "Ranked state conflict" : "Ranked reconnect required",
      conflict
        ? "The canonical run changed. Resync before sending another action."
        : "Recovery is preserved. Return to Practice does not abandon the Ranked run.",
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
    ui.showMessage(
      `Ranked ${state.status}`,
      "Canonical terminal state is ready to finalize.",
      [ui.button("Finalize", () => finalize().catch(presentError))]
    );
  }

  async function finalize() {
    session.transition(root.DungeonRankedV3Session.STATES.finalizing);
    ui.setStatus("Publishing one canonical result...");
    acceptFinal(await createClient().finalize());
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
        "Choose your Ranked relic",
        "These choices were issued by the Online v3 ruleset.",
        offer?.publicChoices || [],
        async (choiceId) => {
          try {
            ui.setStatus("Confirming canonical choice...");
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
      showTerminal(state);
      return;
    }
    if (state.status === "finalized") {
      acceptFinal(response);
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
      ui.showMessage("Connecting to Ranked", "Creating one canonical run...");
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

  async function commitReplacement(replacement, replacementChoiceId) {
    ui.setStatus("Committing canonical replacement...");
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
      `Incoming: ${replacement.incoming?.relicId || "canonical relic"}.`,
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
      "Canonical relic reward",
      "Select one server-issued opaque choice.",
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
    ui.setStatus("Committing canonical transaction...");
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
      "Costs and effects come from the canonical projection.",
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
      ui.showMessage("Canonical Forge", "Choose the Forge operation.", [
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

  function presentCampOffer(response) {
    const offer = response.metaTransactionOffer;
    const choices = Array.isArray(offer?.choices) ? offer.choices : [];
    if (!choices.length) {
      ui.showMessage("Ranked Camp", "No canonical Camp actions are currently available.", [
        ui.button("Leave Camp", () => { client.clear(); ui.hide(); })
      ]);
      return;
    }
    ui.showChoices(
      "Ranked Camp",
      `Canonical Camp Gold: ${Number(response.profile?.campGold) || 0}.`,
      choices.filter((choice) => choice.status === "available"),
      async (choiceId) => {
        try {
          const choice = choices.find((entry) => entry.choiceId === choiceId);
          if (!choice) throw new TypeError("RANKED_CAMP_CHOICE_INVALID");
          ui.setStatus("Committing canonical Camp choice...");
          await createClient().camp("commit", {
            transactionId: choice.transactionId,
            choiceId
          });
          await openCamp();
        } catch (error) {
          presentError(error);
        }
      }
    );
    ui.overlay.querySelector(".ranked-v3-actions")?.append(
      ui.button("Leave Camp", () => { client.clear(); ui.hide(); })
    );
  }

  async function openCamp() {
    ui.setStatus("Opening canonical Camp session...");
    presentCampOffer(await createClient().camp("open"));
  }

  async function continueBoundary(state) {
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(state);
    if (state.relicReplacement) return presentReplacement(state.relicReplacement);
    if (state.relicOffer) return presentRelicOffer(state.relicOffer);
    if (state.metaTransactionOffer) return presentMetaOffer(state.metaTransactionOffer);
    const slot = offers.pendingRewardSlots(state)[0];
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
      ui.showMessage("Resolving room", "Waiting for the canonical checkpoint...");
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
      ui.showMessage(
        roomType === "forge" ? "Forge awakened" : "Pact sigil awakened",
        "Open the canonical server-issued choices.",
        [ui.button("Open", () => openMetaOffer(roomType).catch(presentError))]
      );
      return;
    }
    if (offers.pendingRewardSlots(state).length > 0) {
      await continueBoundary(state);
      return;
    }
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    ui.showMessage("Room cleared", "Resolve the canonical checkpoint to continue.", [
      ui.button("Resolve checkpoint", () => resolveCheckpoint().catch(presentError))
    ]);
  }

  async function onRoomEntered(directive) {
    if (!directive) return;
    if (session.getState() === root.DungeonRankedV3Session.STATES.next) {
      session.transition(root.DungeonRankedV3Session.STATES.active);
    }
    if (!["merchant", "crossroads"].includes(directive.roomType)) return;
    pendingRoomSummary = { turnCount: 0, rewardClaims: [] };
    session.transition(root.DungeonRankedV3Session.STATES.offer);
    ui.showMessage(
      directive.roomType === "merchant" ? "Canonical Merchant" : "Canonical Crossroads",
      "Open the server-issued choices before leaving this room.",
      [ui.button("Open", () => openMetaOffer(directive.roomType).catch(presentError))]
    );
  }

  function acceptFinal(response) {
    session.transition(root.DungeonRankedV3Session.STATES.finalized);
    const controls = extractedProfileReady
      ? [
          ui.button("Open Camp", () => openCamp().catch(presentError)),
          ui.button("Close", () => { client.clear(); ui.hide(); })
        ]
      : [ui.button("Close", () => { client.clear(); ui.hide(); })];
    ui.showMessage(
      "Ranked run finalized",
      `Score ${Number(response.score) || 0}. One canonical leaderboard result was published.`,
      controls
    );
    if (!extractedProfileReady) client.clear();
  }

  async function onFatalEvent() {
    try {
      session.transition(root.DungeonRankedV3Session.STATES.resolving);
      ui.showMessage("Resolving fatal event", "The server owns lives and prevention entitlements.");
      const previousDirectiveId =
        createClient().getSnapshot()?.publicState?.currentRoomDirective?.directiveId || null;
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
      root.DungeonOnlineV3GameBridge.resumeAfterFatal(directive, state);
      session.transition(root.DungeonRankedV3Session.STATES.next);
      session.transition(root.DungeonRankedV3Session.STATES.active);
      ui.hide();
    } catch (error) {
      presentError(error);
    }
  }

  async function onExtraction(mode) {
    try {
      session.transition(root.DungeonRankedV3Session.STATES.resolving);
      ui.showMessage("Requesting extraction", "Waiting for canonical outcome and gold conversion...");
      const response = await createClient().event("request_extraction", { mode });
      extractedProfileReady = response.metaState?.status === "extraction" && Boolean(response.profile);
      session.transition(root.DungeonRankedV3Session.STATES.terminal);
      showTerminal(response.metaState);
    } catch (error) {
      presentError(error);
    }
  }

  async function resumeRanked() {
    try {
      moveToRecoveryState(root.DungeonRankedV3Session.STATES.retrying);
      ui.showMessage("Recovering Ranked", "Loading the canonical server state...");
      await acceptResponse(await createClient().resumeCanonical());
    } catch (error) {
      presentError(error);
    }
  }

  async function openRankedEntry() {
    if (recoveryStore.loadRecovery()) await resumeRanked();
    else await startRanked();
  }

  ui.entry.addEventListener("click", () => openRankedEntry().catch(presentError));
  leaderboardEntry.addEventListener("click", () => openLeaderboard(true));
  root.setInterval(() => {
    let phase = "";
    try {
      phase = JSON.parse(root.render_game_to_text?.() || "{}").phase || "";
    } catch {
      phase = "";
    }
    const menuIdle = phase === "menu" && ["IDLE", "ABANDONED_LOCAL_SESSION"].includes(session.getState());
    ui.setEntryVisible(menuIdle);
    leaderboardEntry.hidden = !menuIdle;
  }, 250);

  root.DungeonOnlineV3 = Object.freeze({
    mode: "practice",
    startRanked,
    onLocalRoomCleared,
    onRoomEntered,
    onFatalEvent,
    onExtraction,
    getSessionState: session.getState,
    getSnapshot: () => client?.getSnapshot() || null
  });
})(typeof globalThis === "object" ? globalThis : null);
