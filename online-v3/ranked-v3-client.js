(function exposeRankedV3Client(root, factory) {
  "use strict";

  const api = factory(
    root?.DungeonRankedV3Protocol,
    root?.DungeonRankedV3Transport,
    root?.DungeonRankedV3Storage,
    root?.DungeonRankedV3Coordination
  );
  if (root) root.DungeonRankedV3Client = api;
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./ranked-v3-protocol.js"),
      require("./ranked-v3-transport.js"),
      require("./ranked-v3-storage.js"),
      require("./ranked-v3-coordination.js")
    );
  }
})(typeof globalThis === "object" ? globalThis : null, function createClientModule(
  protocol,
  transportApi,
  storageApi,
  coordinationApi
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
        limit: String(Math.min(50, Math.max(1, Math.floor(Number(input.limit) || 20))))
      });
      if (input.cursor) query.set("cursor", String(input.cursor));
      const result = await transport.request({
        method: "GET",
        path: `${protocol.ENDPOINTS.leaderboard.path}?${query.toString()}`
      });
      protocol.validateLeaderboardResponse(result.payload, "list");
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
      protocol.validateLeaderboardResponse(result.payload, "detail");
      return clone(result.payload);
    }

    return Object.freeze({ list, detail });
  }

  function createRankedClient(options = {}) {
    const transport = options.transport || transportApi.createTransport(options);
    const store = options.store || storageApi.createStore(options.storage || globalThis.localStorage);
    const coordinator = options.coordinator || (store.loadWriterLease && store.saveWriterLease
      ? coordinationApi.createCoordinator({
          store,
          cryptoProvider: options.cryptoProvider || globalThis.crypto,
          now: options.now,
          ttlMs: options.leaseTtlMs,
          BroadcastChannel: options.BroadcastChannel,
          broadcastChannel: options.broadcastChannel
        })
      : Object.freeze({
          acquire: () => true,
          heartbeat: () => true,
          isOwner: () => true,
          release: () => true,
          close() {}
        }));
    let snapshot = store.loadSession();
    let mutationLocked = Boolean(snapshot?.pendingOperation);
    let operationGeneration = 0;

    function notifySnapshot() {
      try {
        options.onSnapshot?.(snapshot ? clone(snapshot) : null);
      } catch (cause) {
        options.log?.("snapshot_listener_error", {
          message: String(cause?.message || cause || "UNKNOWN_ERROR")
        });
      }
    }

    function persist(next) {
      snapshot = clone(next);
      store.saveSession(snapshot);
      notifySnapshot();
      return clone(snapshot);
    }

    function requireSnapshot() {
      if (!snapshot || typeof snapshot !== "object") throw new TypeError("RANKED_SESSION_MISSING");
      return snapshot;
    }

    function retireCampaignIdentity() {
      const runId = snapshot?.runId || null;
      snapshot = null;
      mutationLocked = false;
      store.clearSession();
      store.clearRecovery?.();
      store.clearProfile?.();
      options.recoveryRecord = null;
      options.profileIdentity = null;
      if (runId) coordinator.release(runId);
      notifySnapshot();
    }

    function retireCompletedCampaign(payload) {
      if (["defeat", "victory"].includes(String(payload?.outcome || ""))) {
        retireCampaignIdentity();
      }
    }

    async function execute(endpoint, operation) {
      const current = requireSnapshot();
      const generation = operationGeneration;
      if (!coordinator.isOwner(current.runId) && !coordinator.acquire(current.runId, current.revision)) {
        throw new TypeError("RANKED_WRITER_LEASE_HELD");
      }
      if (mutationLocked && current.pendingOperation?.operationId !== operation.operationId) {
        throw new TypeError("RANKED_MUTATION_LOCKED");
      }
      mutationLocked = true;
      persist({ ...current, pendingOperation: clone(operation) });
      const result = await transport.request(endpoint, {
        operationId: operation.operationId,
        body: operation.body
      });
      if (generation !== operationGeneration) return clone(result.payload);
      let validated;
      try {
        validated = protocol.validateMutationResponse(result.payload, {
          runId: snapshot.runId || undefined,
          rulesetId: protocol.RULESET_ID,
          rulesetHash: current.publicState?.rulesetHash || current.rulesetHash
        });
      } catch (cause) {
        if (/^(PROTOCOL_|LEADERBOARD_|RANKED_CAMP_)/u.test(String(cause?.message || ""))) {
          try {
            await resumeCanonical({
              runId: current.runId,
              lastKnownRevision: current.revision
            });
            cause.canonicalResyncCompleted = true;
          } catch (resyncCause) {
            cause.canonicalResyncCompleted = false;
            cause.resyncErrorCode = String(resyncCause?.code || resyncCause?.message || "RESYNC_FAILED");
          }
        }
        throw cause;
      }
      const nextPublicState = clone(validated.metaState);
      const previousAssistanceClass = String(current.publicState?.assistanceClass || "");
      if (
        operation.body?.type === "mark_test_assistance" &&
        protocol.supportsBoundarySettlement?.(nextPublicState.rulesetHash) &&
        nextPublicState.status === "active"
      ) {
        nextPublicState.currentRoomDirective ??= clone(current.publicState?.currentRoomDirective);
        nextPublicState.currentRewardEnvelope ??= clone(current.publicState?.currentRewardEnvelope);
        nextPublicState.assistanceClass ??= String(operation.body?.assistanceClass || "observer_bot");
      }
      if (
        nextPublicState.assistanceClass === undefined &&
        ["observer_bot", "cheats", "mixed"].includes(previousAssistanceClass)
      ) {
        nextPublicState.assistanceClass = previousAssistanceClass;
      }
      persist({
        ...snapshot,
        runId: validated.metaState.runId,
        revision: validated.metaState.revision,
        rulesetId: validated.metaState.rulesetId,
        rulesetHash: validated.metaState.rulesetHash,
        token: validated.token,
        publicState: nextPublicState,
        pendingOperation: null,
        lastAcknowledgedOperationId: operation.operationId
      });
      mutationLocked = false;
      coordinator.heartbeat(validated.metaState.runId, validated.metaState.revision);
      if (["finalized", "abandoned"].includes(validated.metaState.status)) {
        coordinator.release(validated.metaState.runId);
      }
      return clone(result.payload);
    }

    async function start(input) {
      const operationId = input.operationId || transport.createOperationId();
      const profile = ensureProfileIdentity(store, options);
      const recoveryCredential = base64Url(
        (options.cryptoProvider || globalThis.crypto).getRandomValues(new Uint8Array(32))
      );
      const body = {
        playerName: String(input.playerName || "Anonymous"),
        season: String(input.season || "local-m4"),
        gameVersion: String(input.gameVersion || "v0.8.2"),
        rulesetId: protocol.RULESET_ID,
        startDepth: Math.max(0, Math.floor(Number(input.startDepth) || 0)),
        rulesetHash: protocol.RULESET_HASH,
        clientInstallIdHash: String(input.clientInstallIdHash),
        profileId: profile.profileId,
        profileCredential: profile.profileCredential,
        recoveryCredential,
        clientProtocolVersion: protocol.PROTOCOL_VERSION,
        newCampaign: input.newCampaign === true
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
      const recoveryRecord = {
        runId: validated.metaState.runId,
        recoveryCredential,
        rulesetId: protocol.RULESET_ID,
        rulesetHash: protocol.RULESET_HASH
      };
      store.saveRecovery?.(recoveryRecord);
      options.recoveryRecord = recoveryRecord;
      persist({
        ...snapshot,
        runId: validated.metaState.runId,
        revision: validated.metaState.revision,
        token: validated.token,
        publicState: clone(validated.metaState),
        pendingOperation: null,
        lastAcknowledgedOperationId: operationId
      });
      mutationLocked = false;
      if (!coordinator.acquire(validated.metaState.runId, validated.metaState.revision)) {
        throw new TypeError("RANKED_WRITER_LEASE_HELD");
      }
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
        clientProtocolVersion: protocol.PROTOCOL_VERSION,
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
          choiceId,
          clientProtocolVersion: protocol.PROTOCOL_VERSION
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
        integrityVersion: 1,
        integritySignals: Array.isArray(input.integritySignals)
          ? [...new Set(input.integritySignals.map((entry) => String(entry || "")).filter(Boolean))].slice(0, 4)
          : [],
        reportedGoldDelta: Math.max(0, Math.floor(Number(input.reportedGoldDelta) || 0)),
        reportedGoldTotal: Math.max(0, Math.floor(Number(input.reportedGoldTotal) || 0)),
        turnCount: Math.max(0, Math.floor(Number(input.turnCount) || 0)),
        elapsedMs: Math.max(0, Math.floor(Number(input.elapsedMs) || 0)),
        ...(Object.hasOwn(input, "combatResources")
          ? { combatResources: clone(input.combatResources) }
          : {}),
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
      const result = await execute(protocol.ENDPOINTS.finalize, {
        endpoint: "finalize",
        operationId,
        body: { runId: current.runId, checkpointToken: current.token.value, clientProtocolVersion: protocol.PROTOCOL_VERSION }
      });
      retireCompletedCampaign(result);
      return result;
    }

    async function camp(action, input = {}, operationId = transport.createOperationId()) {
      const profile = ensureProfileIdentity(store, options);
      const recovery = store.loadRecovery?.() || options.recoveryRecord;
      const rulesetHash = snapshot?.publicState?.rulesetHash || snapshot?.rulesetHash ||
        recovery?.rulesetHash || protocol.RULESET_HASH;
      if (!protocol.isSupportedRulesetHash(rulesetHash)) {
        throw new TypeError("RANKED_RULESET_MISMATCH");
      }
      const body = {
        profileId: profile.profileId,
        profileCredential: profile.profileCredential,
        rulesetId: protocol.RULESET_ID,
        rulesetHash,
        clientProtocolVersion: protocol.PROTOCOL_VERSION,
        action,
        ...(action === "commit"
          ? { transactionId: String(input.transactionId), choiceId: String(input.choiceId) }
          : {})
      };
      const result = await transport.request(protocol.ENDPOINTS.camp, { operationId, body });
      protocol.validateCampResponse(result.payload);
      return clone(result.payload);
    }

    async function resumeCanonical(input = {}, operationId = transport.createOperationId()) {
      const generation = operationGeneration + 1;
      operationGeneration = generation;
      const recovery = store.loadRecovery?.() || options.recoveryRecord;
      if (!recovery?.runId || !recovery?.recoveryCredential) {
        throw new TypeError("RANKED_RECOVERY_CREDENTIAL_MISSING");
      }
      const current = snapshot;
      const rulesetHash = recovery.rulesetHash || current?.publicState?.rulesetHash ||
        current?.rulesetHash || protocol.RULESET_HASH;
      if (!protocol.isSupportedRulesetHash(rulesetHash)) {
        throw new TypeError("RANKED_RULESET_MISMATCH");
      }
      const body = {
        operationId,
        runId: String(input.runId || recovery.runId),
        recoveryCredential: String(input.recoveryCredential || recovery.recoveryCredential),
        clientProtocolVersion: protocol.PROTOCOL_VERSION,
        lastKnownRevision: Math.max(0, Number(input.lastKnownRevision ?? current?.revision) || 0)
      };
      const result = await transport.request(protocol.ENDPOINTS.resume, { operationId, body });
      if (generation !== operationGeneration) return clone(result.payload);
      const validated = protocol.validateMutationResponse(result.payload, {
        runId: body.runId,
        rulesetId: protocol.RULESET_ID,
        rulesetHash
      });
      const resumedPublicState = clone(validated.metaState);
      const previousAssistanceClass = String(current?.publicState?.assistanceClass || "");
      if (
        resumedPublicState.assistanceClass === undefined &&
        ["observer_bot", "cheats", "mixed"].includes(previousAssistanceClass)
      ) {
        resumedPublicState.assistanceClass = previousAssistanceClass;
      }
      persist({
        schemaVersion: 1,
        mode: "ranked",
        runId: validated.metaState.runId,
        revision: validated.metaState.revision,
        rulesetId: validated.metaState.rulesetId,
        rulesetHash: validated.metaState.rulesetHash,
        token: validated.token,
        publicState: resumedPublicState,
        pendingOperation: null,
        lastAcknowledgedOperationId: operationId
      });
      mutationLocked = false;
      if (!coordinator.acquire(validated.metaState.runId, validated.metaState.revision)) {
        throw new TypeError("RANKED_WRITER_LEASE_HELD");
      }
      return clone(result.payload);
    }

    async function abandonCanonical(operationId = transport.createOperationId()) {
      operationGeneration += 1;
      const recovery = store.loadRecovery?.() || options.recoveryRecord;
      if (!recovery?.runId || !recovery?.recoveryCredential) {
        throw new TypeError("RANKED_RECOVERY_CREDENTIAL_MISSING");
      }
      if (!coordinator.isOwner(recovery.runId) && !coordinator.acquire(recovery.runId, snapshot?.revision || 0)) {
        throw new TypeError("RANKED_WRITER_LEASE_HELD");
      }
      const rulesetHash = recovery.rulesetHash || snapshot?.publicState?.rulesetHash ||
        snapshot?.rulesetHash || protocol.RULESET_HASH;
      if (!protocol.isSupportedRulesetHash(rulesetHash)) {
        throw new TypeError("RANKED_RULESET_MISMATCH");
      }
      const body = {
        operationId,
        runId: recovery.runId,
        recoveryCredential: recovery.recoveryCredential,
        clientProtocolVersion: protocol.PROTOCOL_VERSION,
        lastKnownRevision: Math.max(0, Number(snapshot?.revision) || 0)
      };
      const result = await transport.request(protocol.ENDPOINTS.abandon, { operationId, body });
      protocol.validateMutationResponse(result.payload, {
        runId: recovery.runId,
        rulesetId: protocol.RULESET_ID,
        rulesetHash
      });
      snapshot = null;
      store.clearSession();
      store.clearRecovery?.();
      store.clearProfile?.();
      coordinator.release(recovery.runId);
      mutationLocked = false;
      options.recoveryRecord = null;
      options.profileIdentity = null;
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
        const recoveryRecord = {
          runId: validated.metaState.runId,
          recoveryCredential: pending.body.recoveryCredential,
          rulesetId: protocol.RULESET_ID,
          rulesetHash: protocol.RULESET_HASH
        };
        store.saveRecovery?.(recoveryRecord);
        options.recoveryRecord = recoveryRecord;
        persist({
          ...snapshot,
          runId: validated.metaState.runId,
          revision: validated.metaState.revision,
          token: validated.token,
          publicState: clone(validated.metaState),
          pendingOperation: null,
          lastAcknowledgedOperationId: pending.operationId
        });
        mutationLocked = false;
        if (!coordinator.acquire(validated.metaState.runId, validated.metaState.revision)) {
          throw new TypeError("RANKED_WRITER_LEASE_HELD");
        }
        return clone(result.payload);
      }
      const result = await execute(endpoint, pending);
      if (pending.endpoint === "finalize") retireCompletedCampaign(result);
      return result;
    }

    function discardFailedStart() {
      operationGeneration += 1;
      if (!snapshot) {
        mutationLocked = false;
        store.clearSession();
        return;
      }
      if (
        snapshot.runId ||
        snapshot.pendingOperation?.endpoint !== "start"
      ) {
        throw new TypeError("RANKED_FAILED_START_NOT_DISCARDABLE");
      }
      snapshot = null;
      mutationLocked = false;
      store.clearSession();
    }

    function resetProfileIdentity() {
      if (snapshot?.runId) {
        throw new TypeError("RANKED_PROFILE_RESET_ACTIVE_RUN");
      }
      store.clearProfile?.();
      options.profileIdentity = null;
    }

    return Object.freeze({
      mode: "ranked",
      start,
      selectStartingRelic,
      event,
      checkpoint,
      finalize,
      camp,
      resumeCanonical,
      abandonCanonical,
      retryPending,
      discardFailedStart,
      resetProfileIdentity,
      requestOwnership: () => {
        const current = requireSnapshot();
        return coordinator.acquire(current.runId, current.revision);
      },
      isWriter: () => Boolean(snapshot?.runId && coordinator.isOwner(snapshot.runId)),
      heartbeatWriter: () => Boolean(snapshot?.runId && coordinator.heartbeat(snapshot.runId, snapshot.revision)),
      releaseWriter: () => Boolean(snapshot?.runId && coordinator.release(snapshot.runId)),
      getSnapshot: () => clone(snapshot),
      clearRecovery: () => {
        store.clearRecovery?.();
        options.recoveryRecord = null;
      },
      clear: () => {
        operationGeneration += 1;
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
