import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

function element() {
  return {
    hidden: false,
    tabIndex: 0,
    className: "",
    textContent: "",
    addEventListener() {},
    append() {},
    appendChild() {},
    setAttribute() {},
    querySelector() { return null; },
    getClientRects() { return []; }
  };
}

function metaState(overrides = {}) {
  return {
    runId: "run_integrity",
    status: "active",
    rankEligibility: "official",
    currentRoomDirective: {
      directiveId: "directive_2",
      depth: 2,
      roomType: "combat"
    },
    ...overrides
  };
}

function createHarness(options = {}) {
  const calls = [];
  const directives = [];
  const forgePresentations = [];
  const forgeCompletions = [];
  const replacementPresentations = [];
  const replacementCompletions = [];
  const uiChoiceCalls = [];
  const uiMessages = [];
  const uiMenus = [];
  const integrityContexts = [];
  let snapshot = {
    publicState: metaState({
      currentRoomDirective: {
        directiveId: "directive_1",
        depth: 1,
        roomType: options.roomType || "combat"
      },
      rewardSlots: options.rewardSlots || []
    })
  };
  const client = {
    getSnapshot() { return snapshot; },
    async event(action, payload) {
      calls.push({ action, payload });
      const response = await options.onEvent(action, payload);
      snapshot = { publicState: response.metaState };
      return response;
    },
    async checkpoint(payload) {
      calls.push({ action: "checkpoint", payload });
      const response = typeof options.onCheckpoint === "function"
        ? await options.onCheckpoint(payload)
        : { metaState: metaState() };
      snapshot = { publicState: response.metaState };
      return response;
    },
    async resumeCanonical() {
      calls.push({ action: "resume" });
      const response = await options.onResume();
      snapshot = { publicState: response.metaState };
      return response;
    },
    releaseWriter() {},
    clear() {}
  };
  const states = {
    abandoned: "ABANDONED_LOCAL_SESSION",
    active: "ROOM_ACTIVE",
    offer: "AWAITING_REWARD_OR_TRANSACTION",
    resolving: "RESOLVING_ROOM",
    next: "ENTERING_NEXT_ROOM",
    terminal: "TERMINAL",
    finalized: "FINALIZED",
    starting: "STARTING",
    startingRelic: "STARTING_RELIC",
    retrying: "RETRYING",
    finalizing: "FINALIZING",
    reconnect: "RECONNECT_REQUIRED",
    protocolError: "UNRECOVERABLE_PROTOCOL_ERROR"
  };
  const store = {
    clearSession() {},
    clearWriterLease() {},
    clearRecovery() {},
    clearProfile() {},
    loadRecovery() { return options.hasRecovery ? { runId: "run_integrity" } : null; },
    loadProfile() { return null; },
    getInstallationId() { return "installation"; }
  };
  const uiEntry = element();
  const ui = {
    entry: uiEntry,
    overlay: element(),
    button(label, onClick) { return { ...element(), label, onClick }; },
    hide() {},
    setStatus() {},
    setEntryVisible() {},
    showChoices(...args) { uiChoiceCalls.push(args); },
    showMenu(...args) { uiMenus.push(args); },
    showMessage(...args) { uiMessages.push(args); },
    showSync() {}
  };
  const root = {
    console,
    URL,
    Promise,
    Date,
    Object,
    String,
    Number,
    Boolean,
    Array,
    Math,
    TypeError,
    Error,
    setTimeout,
    clearTimeout,
    location: { href: "https://example.test/" },
    document: {
      body: { append() {} },
      createElement: element
    },
    localStorage: (() => {
      const values = new Map();
      return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
      };
    })(),
    crypto: {
      randomUUID() { return "00000000-0000-4000-8000-000000000000"; }
    },
    addEventListener() {},
    setInterval() { return 0; },
    DungeonRankedV3Protocol: {
      isSupportedRulesetHash() { return true; },
      supportsBoundarySettlement() { return options.boundarySettlement === true; }
    },
    DungeonRankedV3Client: {
      createRankedClient() { return client; },
      createLeaderboardClient() { return {}; },
      async sha256Hex() { return "hash"; }
    },
    DungeonRankedV3Directives: {
      applyOnlineV3RoomDirective(directive) { return directive; }
    },
    DungeonRankedV3Offers: {
      relicChoices(offer) {
        return offer.publicChoices.map((choice) => ({ ...choice }));
      },
      replacementChoices(replacement) {
        return replacement.publicChoices.map((choice) => ({ ...choice }));
      },
      metaChoices(offer) {
        return offer.choices.map((choice) => ({
          choiceId: choice.choiceId,
          disabled: choice.status !== "available"
        }));
      },
      pendingRewardSlots(state) { return state.rewardSlots || []; },
      lostRelicId() { return null; }
    },
    DungeonRankedV3LeaderboardUi: {},
    DungeonRankedV3Ui: {
      createUi() { return ui; },
      relicDetails() { return { name: "Test relic" }; }
    },
    DungeonRankedV3Session: {
      STATES: states,
      createStateMachine(initial = states.active) {
        let state = initial;
        return {
          getState() { return state; },
          transition(next) { state = next; }
        };
      }
    },
    DungeonRankedV3Storage: {
      createStore() { return store; }
    },
    DungeonOnlineV3GameBridge: {
      isRankedTestBotActive() { return options.observerBotActive !== false; },
      syncCanonicalProjection() {},
      captureRankedBoundary() {
        return {
          turnCount: 4,
          rewardClaims: [],
          reportedGoldDelta: 0
        };
      },
      beginRankedExtraction() {},
      returnToPractice() {},
      startRanked(directive) { directives.push(directive); },
      setRoomIntegrityContext(context) { integrityContexts.push(context); },
      setNextDirective(directive) { directives.push(directive); },
      enterRankedForge(publicState, offer, context) {
        forgePresentations.push({ publicState, offer, context });
      },
      completeRankedForge(publicState) { forgeCompletions.push(publicState); },
      enterRankedRelicReplacement(publicState, replacement, choices) {
        replacementPresentations.push({ publicState, replacement, choices });
        return true;
      },
      completeRankedRelicReplacement(publicState) {
        replacementCompletions.push(publicState);
      }
    }
  };
  return {
    root,
    calls,
    directives,
    forgePresentations,
    forgeCompletions,
    replacementPresentations,
    replacementCompletions,
    uiChoiceCalls,
    uiMessages,
    uiMenus,
    integrityContexts
  };
}

async function installRuntime(harness, options = {}) {
  if (options.realSession === true) {
    const sessionSource = await readFile(new URL("../../../online-v3/ranked-v3-session.js", import.meta.url), "utf8");
    vm.runInNewContext(sessionSource, harness.root, { filename: "ranked-v3-session.js" });
  }
  const source = await readFile(new URL("../../../online-v3/ranked-v3-runtime.js", import.meta.url), "utf8");
  vm.runInNewContext(source, harness.root, { filename: "ranked-v3-runtime.js" });
  return harness.root.DungeonOnlineV3;
}

async function waitForBoundary(runtime) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (!runtime.isObserverBotBoundaryPending()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("Observer Bot boundary did not settle");
}

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(message);
}

test("portal entry restores a missing persisted Ranked boundary before Observer Bot settlement", async () => {
  const firstRoom = {
    directiveId: "directive_1",
    roomNonce: "nonce_1",
    depth: 1,
    roomType: "combat"
  };
  const restoredRoom = metaState({
    revision: 1,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: firstRoom,
    currentRewardEnvelope: { envelopeId: "reward_1", fixedAwards: [] }
  });
  const harness = createHarness({
    observerBotActive: true,
    boundarySettlement: true,
    hasRecovery: true,
    async onResume() {
      return { metaState: restoredRoom };
    },
    async onCheckpoint() {
      return { metaState: metaState({ revision: 2, rulesetHash: "sha256:boundary" }) };
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered(firstRoom);
  const client = harness.root.DungeonRankedV3Client.createRankedClient();
  client.getSnapshot().publicState = metaState({
    revision: 1,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: null,
    currentRewardEnvelope: null
  });
  await runtime.onLocalRoomCleared({
    turnCount: 4,
    rewardClaims: [],
    reportedGoldDelta: 0,
    completionCapability: harness.integrityContexts[0].completionCapability
  });

  assert.doesNotThrow(() => assert.equal(runtime.onPortalEntry(), true));
  await waitFor(
    () => harness.calls.some((entry) => entry.action === "checkpoint"),
    "portal settlement did not continue after canonical boundary recovery"
  );
  assert.deepEqual(harness.calls.map((entry) => entry.action), ["resume", "checkpoint"]);
});

test("a local room clear without its active capability emits an integrity downgrade signal", async () => {
  const harness = createHarness({
    observerBotActive: false,
    async onCheckpoint() { return { metaState: metaState() }; }
  });
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered(metaState().currentRoomDirective);
  await runtime.onLocalRoomCleared({
    turnCount: 4,
    rewardClaims: [],
    reportedGoldDelta: 2
  });
  const payload = harness.calls.find((entry) => entry.action === "checkpoint").payload;
  assert.equal(
    Array.from(payload.integritySignals).join(","),
    "local_room_completion_capability_invalid"
  );
  assert.equal(payload.reportedGoldDelta, 2);
});

test("a valid room capability stays private to the bridge and sends no downgrade signal", async () => {
  const harness = createHarness({
    observerBotActive: false,
    async onCheckpoint() { return { metaState: metaState() }; }
  });
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered({
    directiveId: "directive_1",
    depth: 1,
    roomType: "combat"
  });
  assert.equal(harness.integrityContexts.length, 1);
  const completionCapability = harness.integrityContexts[0].completionCapability;
  await runtime.onLocalRoomCleared({
    turnCount: 4,
    rewardClaims: [],
    reportedGoldDelta: 2,
    completionCapability
  });
  const payload = harness.calls.find((entry) => entry.action === "checkpoint").payload;
  assert.equal(Array.from(payload.integritySignals).join(","), "");
});

test("a provisional response shows the continuation notice only once per run", async () => {
  const harness = createHarness({
    observerBotActive: false,
    async onCheckpoint() {
      return {
        metaState: metaState({
          rankEligibility: "provisional",
          rankIntegrity: {
            reasonCodes: ["REPORTED_GOLD_TOTAL_MISMATCH"],
            firstDetectedRevision: 2
          }
        })
      };
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered(metaState().currentRoomDirective);
  await runtime.onLocalRoomCleared({
    turnCount: 4,
    rewardClaims: [],
    reportedGoldDelta: 2,
    completionCapability: harness.integrityContexts[0].completionCapability
  });
  assert.equal(harness.uiMessages.length, 1);
  assert.equal(harness.uiMessages[0][0], "Ranked integrity check failed.");
  assert.match(harness.uiMessages[0][1], /REPORTED_GOLD_TOTAL_MISMATCH/u);
  assert.deepEqual(Array.from(runtime.getDiagnostics().at(-1)?.reasonCodes || []), [
    "REPORTED_GOLD_TOTAL_MISMATCH"
  ]);
  await harness.uiMessages[0][2][0].onClick();
  await waitFor(() => harness.directives.length === 1, "notice did not continue the boundary");
  await runtime.onRoomEntered(metaState().currentRoomDirective);
  await runtime.onLocalRoomCleared({
    turnCount: 5,
    rewardClaims: [],
    reportedGoldDelta: 2,
    completionCapability: harness.integrityContexts[1].completionCapability
  });
  assert.equal(harness.uiMessages.length, 1);
});

test("normal extraction intent survives a reconnect Main Menu round trip after the room checkpoint committed", async () => {
  const nextRoom = metaState({
    revision: 2,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: {
      directiveId: "directive_2",
      roomNonce: "nonce_2",
      depth: 2,
      roomType: "combat"
    },
    currentRewardEnvelope: { envelopeId: "reward_2" }
  });
  const harness = createHarness({
    observerBotActive: false,
    boundarySettlement: true,
    hasRecovery: true,
    async onCheckpoint() {
      throw new TypeError("CHECKPOINT_RESPONSE_REJECTED_AFTER_COMMIT");
    },
    async onResume() {
      return { metaState: nextRoom };
    },
    async onEvent(action) {
      assert.equal(action, "request_extraction");
      return {
        metaState: metaState({
          revision: 2,
          rulesetHash: "sha256:boundary",
          status: "extraction",
          currentRoomDirective: null,
          currentRewardEnvelope: null
        }),
        profile: { profileId: "profile_integrity" }
      };
    }
  });
  const runtime = await installRuntime(harness);
  const firstRoom = {
    directiveId: "directive_1",
    roomNonce: "nonce_1",
    depth: 1,
    roomType: "combat"
  };
  harness.root.DungeonRankedV3Client.createRankedClient().getSnapshot().publicState = metaState({
    revision: 1,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: firstRoom,
    currentRewardEnvelope: { envelopeId: "reward_1" }
  });
  await runtime.onRoomEntered(firstRoom);
  await runtime.onLocalRoomCleared({
    turnCount: 4,
    rewardClaims: [],
    reportedGoldDelta: 0,
    completionCapability: harness.integrityContexts[0].completionCapability
  });
  await runtime.onExtraction("normal");

  assert.equal(harness.uiMessages.at(-1)[0], "Ranked reconnect required");
  runtime.leaveToMainMenu();
  harness.root.DungeonOnlineV3Menu.openRanked();
  const continueButton = harness.uiMenus.at(-1)[2].find((button) => button.label === "Continue Ranked");
  await continueButton.onClick();
  await waitFor(
    () => harness.calls.some((entry) => entry.action === "request_extraction"),
    "saved normal extraction intent did not continue after canonical resync"
  );
});

test("normal extraction intent is cancelled when resync returns the same uncommitted room", async () => {
  const firstRoom = {
    directiveId: "directive_1",
    roomNonce: "nonce_1",
    depth: 1,
    roomType: "combat"
  };
  const sameRoom = metaState({
    revision: 1,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: firstRoom,
    currentRewardEnvelope: { envelopeId: "reward_1" },
    statistics: { roomsCompleted: 0 }
  });
  const harness = createHarness({
    observerBotActive: false,
    boundarySettlement: true,
    hasRecovery: true,
    async onCheckpoint() {
      const error = new Error("Checkpoint token is expired.");
      error.code = "TOKEN_EXPIRED";
      error.status = 401;
      error.traceId = "trace-expired-checkpoint";
      error.traceId = "trace-expired-checkpoint";
      error.checkpointToken = "secret-checkpoint-token";
      error.payload = { recoveryCredential: "secret-recovery-credential" };
      throw error;
    },
    async onResume() {
      return { metaState: sameRoom };
    },
    async onEvent() {
      throw new Error("normal extraction must not run before the room checkpoint commits");
    }
  });
  const runtime = await installRuntime(harness);
  harness.root.DungeonRankedV3Client.createRankedClient().getSnapshot().publicState = metaState({
    revision: 1,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: firstRoom,
    currentRewardEnvelope: { envelopeId: "reward_1" },
    statistics: { roomsCompleted: 0 }
  });
  harness.root.DungeonRankedV3Client.createRankedClient().getSnapshot().pendingOperation = {
    endpoint: "checkpoint",
    operationId: "op_diagnostic",
    body: { checkpointToken: "secret-checkpoint-token" }
  };
  await runtime.onRoomEntered(firstRoom);
  await runtime.onLocalRoomCleared({
    turnCount: 4,
    rewardClaims: [],
    reportedGoldDelta: 0,
    completionCapability: harness.integrityContexts[0].completionCapability
  });

  await runtime.onExtraction("normal");
  assert.equal(harness.uiMessages.at(-1)?.[0], "Ranked reconnect required");
  const resync = harness.uiMessages.at(-1)?.[2].find((button) => button.label === "Resync Ranked Run");
  assert.ok(resync, "reconnect did not offer canonical resync");
  await resync.onClick();

  assert.equal(
    harness.calls.some((entry) => entry.action === "request_extraction"),
    false,
    "same-room resync incorrectly continued normal extraction"
  );
  assert.equal(harness.directives.at(-1)?.directiveId, firstRoom.directiveId);
  const diagnostics = runtime.getDiagnostics();
  assert.equal(diagnostics.at(-1)?.kind, "client_error");
  assert.equal(diagnostics.at(-1)?.code, "TOKEN_EXPIRED");
  assert.equal(diagnostics.at(-1)?.status, 401);
  assert.equal(diagnostics.at(-1)?.endpoint, "checkpoint");
  assert.equal(diagnostics.at(-1)?.runId, "run_integrity");
  assert.equal(diagnostics.at(-1)?.revision, 1);
  assert.equal(diagnostics.at(-1)?.traceId, "trace-expired-checkpoint");
  assert.equal(diagnostics.at(-1)?.traceId, "trace-expired-checkpoint");
  assert.doesNotMatch(JSON.stringify(diagnostics), /checkpointToken|recoveryCredential|secret-/u);
  assert.match(harness.uiMessages[0][1], /TOKEN_EXPIRED/u);
  assert.match(harness.uiMessages[0][1], /run_integrity/u);
});

test("Main Menu is idempotent after the local Ranked session is already abandoned", async () => {
  const harness = createHarness({
    observerBotActive: false,
    hasRecovery: true,
    async onResume() { throw new Error("resume unavailable"); },
    async onEvent() { throw new Error("unexpected event"); }
  });
  const runtime = await installRuntime(harness, { realSession: true });

  harness.root.DungeonOnlineV3Menu.openRanked();
  const continueButton = harness.uiMenus.at(-1)[2].find((button) => button.label === "Continue Ranked");
  await continueButton.onClick();
  assert.equal(runtime.getSessionState(), "RECONNECT_REQUIRED");
  assert.doesNotThrow(() => runtime.leaveToMainMenu());
  assert.equal(runtime.getSessionState(), "ABANDONED_LOCAL_SESSION");
  assert.doesNotThrow(() => runtime.leaveToMainMenu());
  assert.equal(runtime.getSessionState(), "ABANDONED_LOCAL_SESSION");
});

test("Observer Bot resolves relic and replacement choices before checkpoint", async () => {
  const harness = createHarness({
    rewardSlots: [{ slotId: "slot_1" }],
    async onEvent(action, payload) {
      if (action === "issue_relic_offer") {
        return { metaState: metaState({
          relicOffer: {
            offerId: "offer_1",
            publicChoices: [
              { choiceId: "choice_z" },
              { choiceId: "choice_a" }
            ]
          }
        }) };
      }
      if (action === "select_relic") {
        return { metaState: metaState({
          relicReplacement: {
            transactionId: "replace_1",
            cancelAllowed: false,
            publicChoices: [
              { replacementChoiceId: "replace_z" },
              { replacementChoiceId: "replace_a" }
            ]
          }
        }) };
      }
      if (action === "commit_relic_replacement") return { metaState: metaState() };
      throw new Error(`Unexpected event: ${action} ${JSON.stringify(payload)}`);
    }
  });
  const runtime = await installRuntime(harness);
  const boundary = runtime.onLocalRoomCleared({ turnCount: 4, rewardClaims: [] });
  assert.equal(runtime.isObserverBotBoundaryPending(), true);
  await boundary;
  await waitForBoundary(runtime);
  assert.deepEqual(harness.calls.map((entry) => entry.action), [
    "issue_relic_offer",
    "select_relic",
    "commit_relic_replacement",
    "checkpoint"
  ]);
  assert.equal(harness.calls[1].payload.choiceId, "choice_a");
  assert.equal(harness.calls[2].payload.replacementChoiceId, "replace_a");
  assert.equal(harness.directives.length, 1);
});

test("player relic replacement uses the native game surface instead of generic choices", async () => {
  const harness = createHarness({
    observerBotActive: false,
    rewardSlots: [{ slotId: "slot_1" }],
    async onEvent(action) {
      if (action === "issue_relic_offer") {
        return { metaState: metaState({
          relicOffer: {
            offerId: "offer_1",
            publicChoices: [{ choiceId: "choice_a", relicId: "vampfang" }]
          }
        }) };
      }
      if (action === "select_relic") {
        return { metaState: metaState({
          build: { relics: [{ relicId: "fang", stacks: 1 }] },
          relicReplacement: {
            transactionId: "replace_1",
            incoming: { relicId: "vampfang", rarity: "rare", stacks: 1 },
            cancelAllowed: true,
            publicChoices: [{
              replacementChoiceId: "replace_fang",
              incomingRelicId: "vampfang",
              removalRelicIds: ["fang"]
            }]
          }
        }) };
      }
      if (action === "commit_relic_replacement") return { metaState: metaState() };
      throw new Error(`Unexpected event: ${action}`);
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onLocalRoomCleared({ turnCount: 4, rewardClaims: [] });
  assert.equal(harness.uiChoiceCalls.length, 1);
  harness.uiChoiceCalls[0][3]("choice_a");
  await waitFor(
    () => harness.replacementPresentations.length === 1,
    "replacement was not handed to the native game surface"
  );
  assert.equal(harness.uiChoiceCalls.length, 1);
  assert.equal(
    harness.replacementPresentations[0].replacement.incoming.relicId,
    "vampfang"
  );
  assert.equal(runtime.onRelicReplacementChoice("replace_fang"), true);
  await waitFor(
    () => harness.replacementCompletions.length === 1,
    "replacement completion did not return to the native surface"
  );
});

test("Observer Bot completes Forge choice and checkpoint under one busy boundary", async () => {
  const harness = createHarness({
    roomType: "forge",
    async onEvent(action, payload) {
      if (action === "open_meta_offer") {
        assert.equal(payload.mode, "temper");
        return { metaState: metaState({
          metaTransactionOffer: {
            sourceType: "forge",
            choices: [
              {
                transactionId: "forge_1",
                choiceId: "choice_z",
                status: "available",
                kind: "forge_temper"
              },
              {
                transactionId: "forge_1",
                choiceId: "choice_a",
                status: "available",
                kind: "forge_temper"
              },
              {
                transactionId: "forge_1",
                choiceId: "leave",
                status: "available",
                kind: "leave"
              }
            ]
          }
        }) };
      }
      if (action === "commit_meta_transaction") return { metaState: metaState() };
      throw new Error(`Unexpected event: ${action} ${JSON.stringify(payload)}`);
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onLocalRoomCleared({ turnCount: 2, rewardClaims: [] });
  assert.equal(runtime.onForgeMode("temper"), true);
  assert.equal(runtime.isObserverBotBoundaryPending(), true);
  await waitForBoundary(runtime);
  assert.deepEqual(harness.calls.map((entry) => entry.action), [
    "open_meta_offer",
    "commit_meta_transaction",
    "checkpoint"
  ]);
  assert.equal(harness.calls[1].payload.choiceId, "choice_a");
  assert.equal(harness.directives.length, 1);
});

test("player Forge offer stays on the native Practice surface through canonical commit", async () => {
  const harness = createHarness({
    roomType: "forge",
    observerBotActive: false,
    async onEvent(action, payload) {
      if (action === "open_meta_offer") {
        assert.equal(payload.mode, "transmute");
        assert.equal(payload.sacrificeRelicId, "fang");
        return { metaState: metaState({
          build: { relics: [{ relicId: "fang", stacks: 1 }] },
          metaTransactionOffer: {
            sourceType: "forge",
            sourceId: "forge-transmute",
            choices: [
              {
                transactionId: "forge_2",
                choiceId: "fang_to_vamp",
                status: "available",
                kind: "forge_transmute",
                action: "transmute",
                sacrificeRelicId: "fang",
                resultRelicId: "vampfang"
              },
              {
                transactionId: "forge_2",
                choiceId: "idol_to_lucky",
                status: "available",
                kind: "forge_transmute",
                action: "transmute",
                sacrificeRelicId: "idol",
                resultRelicId: "lucky"
              },
              {
                transactionId: "forge_2",
                choiceId: "forge_leave",
                status: "available",
                kind: "forge_transmute_leave",
                action: "leave",
                mode: "transmute"
              }
            ]
          }
        }) };
      }
      if (action === "commit_meta_transaction") {
        assert.equal(payload.transactionId, "forge_2");
        assert.equal(payload.choiceId, "fang_to_vamp");
        return { metaState: metaState({
          build: { relics: [{ relicId: "vampfang", stacks: 1 }] }
        }) };
      }
      throw new Error(`Unexpected event: ${action} ${JSON.stringify(payload)}`);
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onLocalRoomCleared({ turnCount: 3, rewardClaims: [] });

  assert.equal(runtime.onForgeMode("transmute", { sacrificeRelicId: "fang" }), true);
  await waitFor(
    () => harness.forgePresentations.length === 1,
    "Ranked Forge offer was not handed to the native Practice presentation"
  );
  assert.equal(harness.uiChoiceCalls.length, 0, "generic Ranked choices must stay hidden for Forge");
  assert.equal(harness.forgePresentations[0].context.mode, "transmute");
  assert.equal(harness.forgePresentations[0].context.sacrificeRelicId, "fang");

  assert.equal(runtime.onForgeChoice("fang_to_vamp"), true);
  await waitFor(
    () => harness.forgeCompletions.length === 1 && harness.directives.length === 1,
    "canonical Forge commit did not finish the native presentation and checkpoint"
  );
  assert.deepEqual(harness.calls.map((entry) => entry.action), [
    "open_meta_offer",
    "commit_meta_transaction",
    "checkpoint"
  ]);
  assert.deepEqual(harness.forgeCompletions[0].build, {
    relics: [{ relicId: "vampfang", stacks: 1 }]
  });
});
