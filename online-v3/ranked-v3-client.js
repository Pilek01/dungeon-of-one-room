(function exposeRankedV3Client(root, factory) {
  "use strict";

  const api = factory(
    root?.DungeonRankedV3Protocol,
    root?.DungeonRankedV3Transport,
    root?.DungeonRankedV3Storage
  );
  if (root) root.DungeonRankedV3Client = api;
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./ranked-v3-protocol.js"),
      require("./ranked-v3-transport.js"),
      require("./ranked-v3-storage.js")
    );
  }
})(typeof globalThis === "object" ? globalThis : null, function createClientModule(
  protocol,
  transportApi,
  storageApi
) {
  "use strict";

  function createPracticeClient() {
    return Object.freeze({
      mode: "practice",
      emit() {},
      recordCommand() {},
      requestCheckpoint() {},
      getRoomDirective() { return null; },
      openLeaderboard() {}
    });
  }

  function isPracticeClient(value) {
    return Boolean(value && value.mode === "practice" && value.getRoomDirective() === null);
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  async function sha256Hex(text, cryptoProvider = globalThis.crypto) {
    const bytes = new TextEncoder().encode(String(text));
    const digest = await cryptoProvider.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function createRankedClient(options = {}) {
    const transport = options.transport || transportApi.createTransport(options);
    const store = options.store || storageApi.createStore(options.storage || globalThis.localStorage);
    let snapshot = store.loadSession();

    function persist(next) {
      snapshot = clone(next);
      store.saveSession(snapshot);
      return clone(snapshot);
    }

    function requireSnapshot() {
      if (!snapshot || typeof snapshot !== "object") throw new TypeError("RANKED_SESSION_MISSING");
      return snapshot;
    }

    async function execute(endpoint, operation) {
      persist({ ...requireSnapshot(), pendingOperation: clone(operation) });
      const result = await transport.request(endpoint, {
        operationId: operation.operationId,
        body: operation.body
      });
      const validated = protocol.validateMutationResponse(result.payload, {
        runId: snapshot.runId || undefined,
        rulesetId: protocol.RULESET_ID,
        rulesetHash: protocol.RULESET_HASH
      });
      persist({
        ...snapshot,
        runId: validated.metaState.runId,
        revision: validated.metaState.revision,
        token: validated.token,
        publicState: clone(validated.metaState),
        pendingOperation: null,
        lastAcknowledgedOperationId: operation.operationId
      });
      return clone(result.payload);
    }

    async function start(input) {
      const operationId = input.operationId || transport.createOperationId();
      const body = {
        playerName: String(input.playerName || "Anonymous"),
        season: String(input.season || "local-m4"),
        gameVersion: String(input.gameVersion || "v0.8.0"),
        rulesetId: protocol.RULESET_ID,
        rulesetHash: protocol.RULESET_HASH,
        clientInstallIdHash: String(input.clientInstallIdHash)
      };
      persist({
        schemaVersion: 1,
        mode: "ranked",
        runId: "",
        revision: 0,
        rulesetId: protocol.RULESET_ID,
        rulesetHash: protocol.RULESET_HASH,
        token: null,
        publicState: null,
        pendingOperation: { operationId, endpoint: "start", body }
      });
      const result = await transport.request(protocol.ENDPOINTS.start, { operationId, body });
      const validated = protocol.validateMutationResponse(result.payload, {
        rulesetId: protocol.RULESET_ID,
        rulesetHash: protocol.RULESET_HASH,
        tokenKind: protocol.TOKEN_KINDS.bootstrap
      });
      persist({
        ...snapshot,
        runId: validated.metaState.runId,
        revision: validated.metaState.revision,
        token: validated.token,
        publicState: clone(validated.metaState),
        pendingOperation: null,
        lastAcknowledgedOperationId: operationId
      });
      return clone(result.payload);
    }

    function roomBinding(type, payload) {
      const current = requireSnapshot();
      if (!current.token || ![protocol.TOKEN_KINDS.room, protocol.TOKEN_KINDS.terminal].includes(current.token.kind)) {
        throw new TypeError("RANKED_ROOM_TOKEN_REQUIRED");
      }
      const directive = current.publicState?.currentRoomDirective;
      return {
        runId: current.runId,
        type,
        checkpointToken: current.token.value,
        roomDirectiveId: directive?.directiveId,
        roomNonce: directive?.roomNonce,
        ...(payload === undefined ? {} : { payload })
      };
    }

    async function selectStartingRelic(offerId, choiceId, operationId = transport.createOperationId()) {
      const current = requireSnapshot();
      if (current.token?.kind !== protocol.TOKEN_KINDS.bootstrap) {
        throw new TypeError("RANKED_BOOTSTRAP_TOKEN_REQUIRED");
      }
      return execute(protocol.ENDPOINTS.event, {
        operationId,
        body: {
          runId: current.runId,
          type: "select_starting_relic",
          bootstrapToken: current.token.value,
          offerId,
          choiceId
        }
      });
    }

    async function event(type, payload, operationId = transport.createOperationId()) {
      return execute(protocol.ENDPOINTS.event, {
        operationId,
        body: roomBinding(type, payload)
      });
    }

    async function checkpoint(input = {}, operationId = transport.createOperationId()) {
      const current = requireSnapshot();
      const directive = current.publicState?.currentRoomDirective;
      const commands = Array.isArray(input.commands) ? clone(input.commands) : [];
      const commandJournalDigest = await sha256Hex(
        JSON.stringify(commands),
        options.cryptoProvider || globalThis.crypto
      );
      const body = {
        ...roomBinding(undefined),
        roomResult: "cleared",
        rewardClaims: Array.isArray(input.rewardClaims) ? clone(input.rewardClaims) : [],
        turnCount: Math.max(0, Math.floor(Number(input.turnCount) || 0)),
        elapsedMs: Math.max(0, Math.floor(Number(input.elapsedMs) || 0)),
        commandJournalDigest,
        compactRoomProof: {
          version: 1,
          roomDirectiveId: directive.directiveId,
          roomNonce: directive.roomNonce,
          commands
        }
      };
      delete body.type;
      return execute(protocol.ENDPOINTS.checkpoint, { operationId, body });
    }

    async function finalize(operationId = transport.createOperationId()) {
      const current = requireSnapshot();
      if (current.token?.kind !== protocol.TOKEN_KINDS.terminal) {
        throw new TypeError("RANKED_TERMINAL_TOKEN_REQUIRED");
      }
      return execute(protocol.ENDPOINTS.finalize, {
        operationId,
        body: { runId: current.runId, checkpointToken: current.token.value }
      });
    }

    async function retryPending() {
      const pending = requireSnapshot().pendingOperation;
      if (!pending) throw new TypeError("RANKED_PENDING_OPERATION_MISSING");
      const endpoint = protocol.ENDPOINTS[pending.endpoint] || (
        pending.body?.type ? protocol.ENDPOINTS.event : protocol.ENDPOINTS.checkpoint
      );
      if (pending.endpoint === "start") {
        const result = await transport.request(endpoint, {
          operationId: pending.operationId,
          body: pending.body
        });
        const validated = protocol.validateMutationResponse(result.payload, {
          rulesetId: protocol.RULESET_ID,
          rulesetHash: protocol.RULESET_HASH
        });
        persist({
          ...snapshot,
          runId: validated.metaState.runId,
          revision: validated.metaState.revision,
          token: validated.token,
          publicState: clone(validated.metaState),
          pendingOperation: null,
          lastAcknowledgedOperationId: pending.operationId
        });
        return clone(result.payload);
      }
      return execute(endpoint, pending);
    }

    return Object.freeze({
      mode: "ranked",
      start,
      selectStartingRelic,
      event,
      checkpoint,
      finalize,
      retryPending,
      getSnapshot: () => clone(snapshot),
      clear: () => {
        snapshot = null;
        store.clearSession();
      }
    });
  }

  return Object.freeze({
    createPracticeClient,
    isPracticeClient,
    createRankedClient,
    sha256Hex
  });
});
