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

  function base64Url(bytes) {
    let binary = "";
    for (const value of bytes) binary += String.fromCharCode(value);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  }

  function ensureProfileIdentity(store, options) {
    const current = store.loadProfile?.() || options.profileIdentity;
    if (
      current &&
      /^profile_[a-f0-9]{32}$/u.test(String(current.profileId || "")) &&
      /^[A-Za-z0-9_-]{43,128}$/u.test(String(current.profileCredential || ""))
    ) {
      return current;
    }
    const cryptoProvider = options.cryptoProvider || globalThis.crypto;
    const randomUUID = options.randomUUID || (() => cryptoProvider.randomUUID());
    const profile = {
      profileId: `profile_${randomUUID().replaceAll("-", "")}`,
      profileCredential: base64Url(cryptoProvider.getRandomValues(new Uint8Array(32)))
    };
    store.saveProfile?.(profile);
    options.profileIdentity = profile;
    return profile;
  }
  function createLeaderboardClient(options = {}) {
    const transport = options.transport || transportApi.createTransport(options);

    async function list(input = {}) {
      const query = new URLSearchParams({
        season: String(input.season || "local-m4"),
        limit: String(Math.min(20, Math.max(1, Math.floor(Number(input.limit) || 20))))
      });
      if (input.cursor) query.set("cursor", String(input.cursor));
      const result = await transport.request({
        method: "GET",
        path: `${protocol.ENDPOINTS.leaderboard.path}?${query.toString()}`
      });
      return clone(result.payload);
    }

    async function detail(runId) {
      const canonicalRunId = String(runId || "");
      if (!/^run_[a-f0-9]+$/u.test(canonicalRunId)) {
        throw new TypeError("LEADERBOARD_RUN_ID_INVALID");
      }
      const result = await transport.request({
        method: "GET",
        path: protocol.ENDPOINTS.detail.path.replace(":runId", encodeURIComponent(canonicalRunId))
      });
      return clone(result.payload);
    }

    return Object.freeze({ list, detail });
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
      const profile = ensureProfileIdentity(store, options);
      const body = {
        playerName: String(input.playerName || "Anonymous"),
        season: String(input.season || "local-m4"),
        gameVersion: String(input.gameVersion || "v0.8.0"),
        rulesetId: protocol.RULESET_ID,
        rulesetHash: protocol.RULESET_HASH,
        clientInstallIdHash: String(input.clientInstallIdHash),
        profileId: profile.profileId,
        profileCredential: profile.profileCredential
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
        rulesetHash: protocol.RULESET_HASH
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
        endpoint: "event",
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
        endpoint: "event",
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
      return execute(protocol.ENDPOINTS.checkpoint, {
        endpoint: "checkpoint",
        operationId,
        body
      });
    }

    async function finalize(operationId = transport.createOperationId()) {
      const current = requireSnapshot();
      if (current.token?.kind !== protocol.TOKEN_KINDS.terminal) {
        throw new TypeError("RANKED_TERMINAL_TOKEN_REQUIRED");
      }
      return execute(protocol.ENDPOINTS.finalize, {
        endpoint: "finalize",
        operationId,
        body: { runId: current.runId, checkpointToken: current.token.value }
      });
    }

    async function camp(action, input = {}, operationId = transport.createOperationId()) {
      const profile = ensureProfileIdentity(store, options);
      const body = {
        profileId: profile.profileId,
        profileCredential: profile.profileCredential,
        rulesetId: protocol.RULESET_ID,
        rulesetHash: protocol.RULESET_HASH,
        clientProtocolVersion: protocol.PROTOCOL_VERSION,
        action,
        ...(action === "commit"
          ? { transactionId: String(input.transactionId), choiceId: String(input.choiceId) }
          : {})
      };
      const result = await transport.request(protocol.ENDPOINTS.camp, { operationId, body });
      if (!result.payload || result.payload.ok !== true || !result.payload.profile) {
        throw new TypeError("RANKED_CAMP_RESPONSE_INVALID");
      }
      return clone(result.payload);
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
      camp,
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
    createLeaderboardClient,
    sha256Hex
  });
});
