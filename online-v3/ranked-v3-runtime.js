(function installRankedV3Runtime(root) {
  "use strict";

  if (!root || !root.document) return;
  const protocol = root.DungeonRankedV3Protocol;
  const clientApi = root.DungeonRankedV3Client;
  const directives = root.DungeonRankedV3Directives;
  const ui = root.DungeonRankedV3Ui.createUi(root.document);
  const session = root.DungeonRankedV3Session.createStateMachine();
  let client = null;
  let startedAt = 0;

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

  async function onLocalRoomCleared(summary) {
    try {
      session.transition(root.DungeonRankedV3Session.STATES.resolving);
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
        ui.showMessage(`Ranked ${state.status}`, "Canonical terminal state is ready to finalize.", [
          ui.button("Finalize", async () => {
            try {
              session.transition(root.DungeonRankedV3Session.STATES.finalizing);
              await acceptFinal(await createClient().finalize());
            } catch (error) {
              presentError(error);
            }
          })
        ]);
        return;
      }
      const directive = directives.applyOnlineV3RoomDirective(state.currentRoomDirective);
      root.DungeonOnlineV3GameBridge.setNextDirective(directive);
      session.transition(root.DungeonRankedV3Session.STATES.next);
      ui.hide();
    } catch (error) {
      presentError(error);
    }
  }

  function acceptFinal(response) {
    session.transition(root.DungeonRankedV3Session.STATES.finalized);
    ui.showMessage(
      "Ranked run finalized",
      `Score ${Number(response.metaState?.finalScore || response.finalSummary?.score || 0)}. One canonical leaderboard result was published.`,
      [ui.button("Close", () => ui.hide())]
    );
    client.clear();
  }

  ui.entry.addEventListener("click", startRanked);
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
    getSessionState: session.getState,
    getSnapshot: () => client?.getSnapshot() || null
  });
})(typeof globalThis === "object" ? globalThis : null);
