(function installRankedV3Runtime(root) {
  "use strict";

  if (!root || !root.document) return;
  const protocol = root.DungeonRankedV3Protocol;
  const clientApi = root.DungeonRankedV3Client;
  const directives = root.DungeonRankedV3Directives;
  const offers = root.DungeonRankedV3Offers;
  const ui = root.DungeonRankedV3Ui.createUi(root.document);
  const session = root.DungeonRankedV3Session.createStateMachine();
  let client = null;
  let startedAt = 0;
  let pendingRoomSummary = null;
  const recoveryStore = root.DungeonRankedV3Storage.createStore(root.localStorage);
  const recoveryAtBoot = recoveryStore.loadSession();

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

  function presentError(error) {
    const conflict = error?.conflict || error?.status === 409;
    ui.showMessage(
      conflict ? "Ranked state conflict" : "Ranked unavailable",
      conflict
        ? "This action conflicts with the canonical run. The run was not changed locally."
        : "The Online v3 Worker could not acknowledge this action. You can retry with the same operation.",
      [
        ui.button("Retry exact action", retryPending),
        ui.button("Return to Practice", abandon)
      ]
    );
  }

  function abandon() {
    client?.clear();
    client = null;
    session.transition(root.DungeonRankedV3Session.STATES.abandoned);
    ui.hide();
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

  async function openCamp() {
    ui.setStatus("Opening canonical Camp session...");
    await createClient().event("begin_camp_session", {});
    const response = await createClient().event("open_camp_offer", {});
    await continueBoundary(response.metaState);
  }

  async function continueBoundary(state) {
    root.DungeonOnlineV3GameBridge.syncCanonicalProjection(state);
    if (state.relicReplacement) return presentReplacement(state.relicReplacement);
    if (state.relicOffer) return presentRelicOffer(state.relicOffer);
    if (state.metaTransactionOffer) return presentMetaOffer(state.metaTransactionOffer);
    const slot = offers.pendingRewardSlots(state)[0];
    if (slot) return issueRelicSlot(slot);
    if (pendingRoomSummary) return resolveCheckpoint();
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
      const directive = directives.applyOnlineV3RoomDirective(state.currentRoomDirective);
      root.DungeonOnlineV3GameBridge.setNextDirective(directive);
      session.transition(root.DungeonRankedV3Session.STATES.next);
      ui.hide();
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
    ui.showMessage("Room cleared", "Choose the next canonical boundary.", [
      ui.button("Resolve checkpoint", () => resolveCheckpoint().catch(presentError)),
      ui.button("Visit Camp", () => openCamp().catch(presentError))
    ]);
  }

  async function onRoomEntered(directive) {
    if (!directive || !["merchant", "crossroads"].includes(directive.roomType)) return;
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
    ui.showMessage(
      "Ranked run finalized",
      `Score ${Number(response.score) || 0}. One canonical leaderboard result was published.`,
      [ui.button("Close", () => ui.hide())]
    );
    client.clear();
  }

  async function onFatalEvent() {
    try {
      session.transition(root.DungeonRankedV3Session.STATES.resolving);
      ui.showMessage("Resolving fatal event", "The server owns lives and prevention entitlements.");
      const previousDirectiveId = snapshot?.publicState?.currentRoomDirective?.directiveId || null;
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
      session.transition(root.DungeonRankedV3Session.STATES.terminal);
      showTerminal(response.metaState);
    } catch (error) {
      presentError(error);
    }
  }

  async function resumeRanked() {
    try {
      const saved = createClient().getSnapshot();
      if (!saved) throw new TypeError("RANKED_SESSION_MISSING");
      session.transition(root.DungeonRankedV3Session.STATES.retrying);
      if (saved.pendingOperation) {
        ui.showMessage("Recovering Ranked", "Retrying the exact interrupted action...");
        await acceptResponse(await createClient().retryPending());
        return;
      }
      const state = saved.publicState;
      if (!state) throw new TypeError("RANKED_RECOVERY_STATE_MISSING");
      if (state.status === "awaiting_starting_relic") {
        await acceptResponse({ metaState: state });
      } else if (["victory", "defeat", "extraction"].includes(state.status)) {
        session.transition(root.DungeonRankedV3Session.STATES.terminal);
        showTerminal(state);
      } else if (state.relicReplacement || state.relicOffer || state.metaTransactionOffer) {
        session.transition(root.DungeonRankedV3Session.STATES.offer);
        await continueBoundary(state);
      } else if (state.currentRoomDirective) {
        await acceptResponse({ metaState: state });
      } else {
        throw new TypeError("RANKED_RECOVERY_BOUNDARY_UNSUPPORTED");
      }
    } catch (error) {
      presentError(error);
    }
  }

  if (recoveryAtBoot) ui.entry.textContent = "Resume Ranked Online v3";
  ui.entry.addEventListener("click", recoveryAtBoot ? resumeRanked : startRanked);
  root.setInterval(() => {
    let phase = "";
    try {
      phase = JSON.parse(root.render_game_to_text?.() || "{}").phase || "";
    } catch {
      phase = "";
    }
    ui.setEntryVisible(phase === "menu" && session.getState() === "IDLE");
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
