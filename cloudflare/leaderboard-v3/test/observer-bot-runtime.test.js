import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { decideBotPotionUse } = require("../../../bot-safety.js");
const recorderApi = require("../../../online-v3/ranked-v3-recorder.js");

test("Observer potion policy preserves deterministic hazard action identities", () => {
  const base = { hp: 40, maxHp: 100, incomingDamage: 45, effectiveHeal: 25, potions: 1, turn: 3, enemyTurn: 0, hazardIdentity: "mine:2,2:0" };
  const first = decideBotPotionUse(base);
  const repeat = decideBotPotionUse({ ...base });
  const changed = decideBotPotionUse({ ...base, hazardIdentity: "mine:2,2:1" });
  assert.equal(first.reason, "prevent_lethal");
  assert.deepEqual(repeat, first);
  assert.notEqual(changed.actionKey, first.actionKey);
});
test("Observer Bot potion use shares ordinary locks without anti-cheat exceptions", () => {
  const base = {
    hp: 40,
    maxHp: 100,
    incomingDamage: 45,
    effectiveHeal: 25,
    potions: 1,
    turn: 3,
    enemyTurn: 0,
    hazardIdentity: "ordinary"
  };
  for (const [field, value, reason] of [
    ["hasRisk", true, "blocked_risk"],
    ["oathPotionLockTurns", 1, "blocked_oath"],
    ["potions", 0, "blocked_empty"],
    ["hp", 0, "blocked_dead"],
    ["boundaryPending", true, "blocked_boundary"],
    ["turnInProgress", true, "blocked_turn"],
    ["cooldownTurns", 1, "blocked_cooldown"]
  ]) {
    const decision = decideBotPotionUse({ ...base, [field]: value });
    assert.equal(decision.use, false, field);
    assert.equal(decision.reason, reason, field);
    assert.match(decision.actionKey, /^potion:/u);
  }
  const ordinary = decideBotPotionUse(base);
  assert.equal(ordinary.use, true);
  assert.equal(ordinary.reason, "prevent_lethal");
  assert.equal(
    decideBotPotionUse({ ...base, lastPotionActionKey: ordinary.actionKey }).reason,
    "blocked_duplicate_action"
  );
});
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
  const uiSyncCalls = [];
  const integrityContexts = [];
  const otterChestPresentations = [];
  const scheduledTimers = [];
  const merchantRequests = [];
  const merchantCompletions = [];
  const merchantFailures = [];
  const merchantPresentations = [];
  const runtimeSnapshots = [];
  const diagnosticExports = [];
  const rankedDiagnostics = [];
  const botProfileStarts = [];
  let snapshot = {
    publicState: metaState({
      currentRoomDirective: {
        directiveId: "directive_1",
        depth: 1,
        roomType: options.roomType || "combat"
      },
      rewardSlots: options.rewardSlots || [],
      ...(options.publicState || {})
    })
  };
  const client = {
    getSnapshot() { return snapshot; },
    async start(input) {
      calls.push({ action: "start", payload: input });
      const response = await options.onStart(input);
      snapshot = { publicState: response.metaState };
      return response;
    },
    async selectStartingRelic(offerId, choiceId) {
      calls.push({ action: "select_starting_relic", payload: { offerId, choiceId } });
      const response = await options.onSelectStartingRelic(offerId, choiceId);
      snapshot = { publicState: response.metaState };
      return response;
    },
    async event(action, payload, operationId) {
      calls.push({ action, payload, operationId });
      const response = await options.onEvent(action, payload, operationId);
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
    async resumeCanonical(input = {}, operationId) {
      calls.push({ action: "resume", payload: input, operationId });
      const response = await options.onResume(input, operationId);
      snapshot = { publicState: response.metaState, lastAcknowledgedOperationId: operationId };
      return response;
    },
    async finalize() {
      calls.push({ action: "finalize" });
      const response = await options.onFinalize();
      snapshot = { publicState: response.metaState };
      return response;
    },
    async abandonCanonical() {
      calls.push({ action: "abandon" });
      const response = typeof options.onAbandonCanonical === "function"
        ? await options.onAbandonCanonical()
        : { metaState: metaState({ status: "abandoned" }) };
      snapshot = { publicState: response.metaState };
      return response;
    },
    async camp(action, input) {
      calls.push({ action: `camp:${action}`, payload: input });
      return options.onCamp(action, input);
    },
    releaseWriter() {},
    clear() {},
    clearRecovery() {}
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
    showSync(message) { uiSyncCalls.push(message); }
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
    setTimeout: options.manualTimers
      ? (callback, delay = 0) => {
          const timer = { callback, delay, cleared: false };
          scheduledTimers.push(timer);
          return timer;
        }
      : setTimeout,
    clearTimeout: options.manualTimers
      ? (timer) => { if (timer) timer.cleared = true; }
      : clearTimeout,
    location: { href: "https://example.test/" },
    prompt: () => options.botPassword ?? "",
    DUNGEON_ONLINE_TEST_BOT_ENABLED: options.testBotEnabled === true,
    DUNGEON_OBSERVER_TEST_PROFILE: options.preconfiguredBotProfile,
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
    DungeonRankedV3Transport: {
      randomOperationId(crypto) { return `op_${crypto.randomUUID().replaceAll("-", "")}`; }
    },
    DungeonRankedV3Protocol: {
      isSupportedRulesetHash() { return true; },
      supportsBoundarySettlement() { return options.boundarySettlement === true; },
      supportsBoundedCombatResources() { return options.boundedCombatResources === true; }
    },
    DungeonRankedV3Recorder: recorderApi,
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
          transition(next) {
            if (state === states.finalized) {
              throw new TypeError(`INVALID_TRANSITION:${state}:${next}`);
            }
            state = next;
          }
        };
      }
    },
    DungeonRankedV3Storage: {
      createStore() { return store; }
    },
    DungeonOnlineV3GameBridge: {
      async unlockRankedTestBot(password) {
        return typeof options.unlockTestBot === "function"
          ? options.unlockTestBot(password)
          : false;
      },
      startRankedTestBot(profile) {
        botProfileStarts.push(profile);
        return true;
      },
      isRankedTestBotActive() { return options.observerBotActive !== false; },
      requiresRankedTestAssistance() { return options.testAssistanceRequired === true; },
      syncCanonicalProjection() {},
      captureRankedBoundary() {
        return {
          turnCount: 4,
          rewardClaims: [],
          reportedGoldDelta: 0,
          ...(options.localCombatResources || {})
        };
      },
      beginRankedExtraction() {},
      beginRankedMerchantRequest() { merchantRequests.push('begin'); },
      enterRankedMerchant(publicState, offer, context) { merchantPresentations.push({ publicState, offer, context }); },
      completeRankedMerchantAction(result) { merchantCompletions.push(result); },
      failRankedMerchantAction(result) { merchantFailures.push(result); },
      enterRankedCamp() {},
      returnToPractice() {},
      startRanked(directive, state, options) { directives.push(directive); runtimeSnapshots.push({ directive, state, options }); },
      setRoomIntegrityContext(context) { integrityContexts.push(context); },
      setNextDirective(directive) { directives.push(directive); },
      showRankedOtterRewardChest(slot) {
        if (!otterChestPresentations.some((entry) => entry.slotId === slot.slotId)) {
          otterChestPresentations.push(slot);
        }
        return true;
      },
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
      },
      exportRankedDiagnostics(filename, text) {
        diagnosticExports.push({ filename, text });
        return true;
      },
      recordRankedDiagnostic(diagnostic) {
        rankedDiagnostics.push(diagnostic);
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
    uiSyncCalls,
    integrityContexts,
    otterChestPresentations,
    scheduledTimers,
    merchantRequests,
    merchantCompletions,
    merchantFailures,
    merchantPresentations,
    runtimeSnapshots,
    diagnosticExports,
    rankedDiagnostics,
    botProfileStarts
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

async function waitForTimer(predicate, message) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.fail(message);
}

test("password unlock presents all profiles and starts the selected Observer Bot immediately", async () => {
  const harness = createHarness({
    testBotEnabled: true,
    botPassword: "chosen-locally",
    unlockTestBot(password) { return password === "chosen-locally"; }
  });
  await installRuntime(harness);

  assert.equal(await harness.root.DungeonOnlineV3.requestTestControlsUnlock(), true);
  assert.deepEqual(harness.botProfileStarts, []);
  const [title, description, buttons] = harness.uiMenus.at(-1);
  assert.equal(title, "Observer Bot Profile");
  assert.match(description, /starts immediately/u);
  assert.deepEqual(Array.from(buttons, (button) => button.label), [
    "1 · Endurance D50",
    "2 · Player-like",
    "3 · Endgame coverage"
  ]);

  await buttons[0].onClick();
  assert.deepEqual(harness.botProfileStarts, ["endurance_d50"]);
});

test("a launcher-preconfigured profile bypasses the chooser and starts immediately", async () => {
  const harness = createHarness({
    testBotEnabled: true,
    botPassword: "chosen-locally",
    preconfiguredBotProfile: "endgame_coverage",
    unlockTestBot(password) { return password === "chosen-locally"; }
  });
  await installRuntime(harness);

  assert.equal(await harness.root.DungeonOnlineV3.requestTestControlsUnlock(), true);
  assert.deepEqual(harness.botProfileStarts, ["endgame_coverage"]);
  assert.equal(harness.uiMenus.length, 0);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("a post-Camp Observer Bot run is marked assisted before gameplay starts", async () => {
  const freshRoom = metaState({
    runId: "run_post_camp_bot",
    revision: 1,
    currentRoomDirective: {
      directiveId: "directive_post_camp",
      depth: 5,
      roomType: "boss"
    }
  });
  const harness = createHarness({
    observerBotActive: true,
    testAssistanceRequired: true,
    async onStart() { return { metaState: freshRoom }; },
    async onEvent(action, payload) {
      assert.equal(action, "mark_test_assistance");
      assert.equal(payload.assistanceClass, "observer_bot");
      return {
        acceptedEvent: "mark_test_assistance",
        metaState: {
          ...freshRoom,
          revision: 2
        }
      };
    }
  });
  const runtime = await installRuntime(harness);

  assert.equal(runtime.onCampStartRun(4), true);
  await waitFor(() => harness.directives.length === 1, "fresh bot run did not enter gameplay");

  assert.deepEqual(harness.calls.map((entry) => entry.action), [
    "start",
    "mark_test_assistance"
  ]);
  assert.equal(harness.directives[0].directiveId, "directive_post_camp");
});

test("a post-Camp Observer Bot run stays out of gameplay when assistance marking fails", async () => {
  const markError = Object.assign(new Error("TEST_ASSISTANCE_MARK_FAILED"), {
    code: "TEST_ASSISTANCE_MARK_FAILED",
    status: 503
  });
  const harness = createHarness({
    observerBotActive: true,
    testAssistanceRequired: true,
    async onStart() {
      return {
        metaState: metaState({
          runId: "run_unmarked_bot",
          revision: 1,
          currentRoomDirective: {
            directiveId: "directive_unmarked",
            depth: 1,
            roomType: "combat"
          }
        })
      };
    },
    async onEvent(action) {
      assert.equal(action, "mark_test_assistance");
      throw markError;
    }
  });
  const runtime = await installRuntime(harness);

  assert.equal(runtime.onCampStartRun(0), true);
  await waitFor(
    () => harness.uiMessages.length > 0 || harness.uiMenus.length > 0,
    "failed assistance mark did not surface a recovery state"
  );

  assert.equal(harness.directives.length, 0);
  assert.deepEqual(harness.calls.map((entry) => entry.action), [
    "start",
    "mark_test_assistance"
  ]);
});

test("an ordinary post-Camp Ranked run starts without test assistance", async () => {
  const harness = createHarness({
    observerBotActive: false,
    testAssistanceRequired: false,
    async onStart() {
      return {
        metaState: metaState({
          runId: "run_manual_post_camp",
          currentRoomDirective: {
            directiveId: "directive_manual",
            depth: 1,
            roomType: "combat"
          }
        })
      };
    },
    async onEvent(action) {
      throw new Error(`ordinary run emitted unexpected event: ${action}`);
    }
  });
  const runtime = await installRuntime(harness);

  assert.equal(runtime.onCampStartRun(0), true);
  await waitFor(() => harness.directives.length === 1, "ordinary run did not enter gameplay");

  assert.deepEqual(harness.calls.map((entry) => entry.action), ["start"]);
});

test("synchronous initial Crossroads entry opens its meta offer in a real session", async () => {
  const initialRoom = {
    directiveId: "directive_initial_crossroads",
    roomNonce: "nonce_initial_crossroads",
    depth: 1,
    roomType: "crossroads"
  };
  const metaOffer = {
    offerId: "offer_initial_crossroads",
    sourceType: "crossroads",
    choices: [{ choiceId: "choice_initial_crossroads", status: "available" }]
  };
  let runtime = null;
  let roomEntry = null;
  const harness = createHarness({
    observerBotActive: false,
    async onStart() {
      return {
        metaState: metaState({
          currentRoomDirective: initialRoom,
          metaTransactionOffer: null
        })
      };
    },
    async onEvent(action) {
      assert.equal(action, "open_meta_offer");
      return {
        metaState: metaState({
          currentRoomDirective: initialRoom,
          metaTransactionOffer: metaOffer
        })
      };
    }
  });
  harness.root.DungeonOnlineV3GameBridge.startRanked = (directive, state, options) => {
    roomEntry = runtime.onRoomEntered(directive);
  };
  runtime = await installRuntime(harness, { realSession: true });

  await runtime.startRanked();
  await roomEntry;
  assert.equal(runtime.getSessionState(), "AWAITING_REWARD_OR_TRANSACTION");
  assert.equal(harness.calls.at(-1)?.action, "open_meta_offer");
});

test("Start New Ranked abandons recovery before starting a clean campaign", async () => {
  const staleState = metaState({
    runId: "run_stale_recovery",
    build: {
      resources: { potions: 7, maxPotions: 8, highestUnlockedDepth: 42 },
      relics: [{ relicId: "flask", stacks: 2 }],
      merchant: { reservedRelic: { relicId: "fang" } }
    },
    runModifiers: { active: [{ modifierId: "alchemist" }] },
    pendingInventory: { offerId: "merchant-stale", choices: [] },
    metaTransactionOffer: { offerId: "merchant-stale", sourceType: "merchant" }
  });
  const freshState = metaState({
    runId: "run_fresh_campaign",
    build: {
      resources: { potions: 3, maxPotions: 3, highestUnlockedDepth: 0 },
      relics: [],
      merchant: { reservedRelic: null }
    },
    runModifiers: { active: [] },
    pendingInventory: null,
    metaTransactionOffer: null,
    currentRoomDirective: {
      directiveId: "directive_fresh_campaign",
      depth: 1,
      roomType: "combat"
    }
  });
  let startedPayload = null;
  const harness = createHarness({
    observerBotActive: false,
    hasRecovery: true,
    publicState: staleState,
    async onAbandonCanonical() {
      return { metaState: metaState({ runId: "run_abandoned", status: "abandoned", currentRoomDirective: null }) };
    },
    async onStart(input) {
      startedPayload = input;
      return { metaState: freshState };
    }
  });
  await installRuntime(harness);

  harness.root.DungeonOnlineV3Menu.openRanked();
  const startNew = harness.uiMenus.at(-1)[2].find((button) => button.label === "Start New Ranked");
  assert.ok(startNew, "recovery menu should expose Start New Ranked");
  await startNew.onClick();
  await waitFor(() => harness.runtimeSnapshots.length === 1, "fresh Ranked state did not enter gameplay");

  assert.deepEqual(harness.calls.map((entry) => entry.action), ["abandon", "start"]);
  assert.equal(startedPayload.newCampaign, true);
  assert.equal(harness.runtimeSnapshots[0].options.newCampaign, true);
  const runtimeState = harness.runtimeSnapshots[0].state;
  assert.equal(runtimeState.runId, "run_fresh_campaign");
  assert.deepEqual(runtimeState.build.resources, { potions: 3, maxPotions: 3, highestUnlockedDepth: 0 });
  assert.deepEqual(runtimeState.build.relics, []);
  assert.deepEqual(runtimeState.runModifiers.active, []);
  assert.equal(runtimeState.pendingInventory, null);
  assert.equal(runtimeState.metaTransactionOffer, null);
  assert.equal(harness.directives[0].directiveId, "directive_fresh_campaign");
});
test("test assistance waits for starting relic activation but still precedes gameplay", async () => {
  const activeRoom = metaState({
    runId: "run_fresh_campaign_bot",
    revision: 2,
    currentRoomDirective: {
      directiveId: "directive_fresh_campaign",
      depth: 1,
      roomType: "combat"
    }
  });
  const harness = createHarness({
    observerBotActive: true,
    testAssistanceRequired: true,
    async onStart() {
      return {
        metaState: metaState({
          runId: "run_fresh_campaign_bot",
          revision: 1,
          status: "awaiting_starting_relic",
          currentRoomDirective: null,
          startingRelicOffer: {
            offerId: "starting_offer",
            publicChoices: [{ choiceId: "fang", relicId: "fang" }]
          }
        })
      };
    },
    async onSelectStartingRelic(offerId, choiceId) {
      assert.equal(offerId, "starting_offer");
      assert.equal(choiceId, "fang");
      return { metaState: activeRoom };
    },
    async onEvent(action) {
      assert.equal(action, "mark_test_assistance");
      return {
        acceptedEvent: "mark_test_assistance",
        metaState: {
          ...activeRoom,
          revision: 3,
          assistanceClass: "observer_bot",
          testAssistance: { class: "observer_bot" }
        }
      };
    }
  });
  const runtime = await installRuntime(harness);

  assert.equal(runtime.onCampStartRun(0), true);
  await waitFor(() => harness.uiChoiceCalls.length === 1, "starting relic choice was not shown");
  assert.deepEqual(harness.calls.map((entry) => entry.action), ["start"]);

  await harness.uiChoiceCalls[0][3]("fang");
  await waitFor(() => harness.directives.length === 1, "fresh campaign did not enter gameplay");

  assert.deepEqual(harness.calls.map((entry) => entry.action), [
    "start",
    "select_starting_relic",
    "mark_test_assistance"
  ]);
});

test("gameplay stays blocked when the assistance response is not canonically marked", async () => {
  const activeRoom = metaState({
    runId: "run_unconfirmed_assistance",
    revision: 1,
    assistanceClass: "none",
    currentRoomDirective: {
      directiveId: "directive_unconfirmed",
      depth: 1,
      roomType: "combat"
    }
  });
  const harness = createHarness({
    observerBotActive: true,
    testAssistanceRequired: true,
    async onStart() { return { metaState: activeRoom }; },
    async onEvent(action) {
      assert.equal(action, "mark_test_assistance");
      return {
        acceptedEvent: "mark_test_assistance",
        metaState: { ...activeRoom, revision: 2, assistanceClass: "none" }
      };
    }
  });
  const runtime = await installRuntime(harness);

  assert.equal(runtime.onCampStartRun(0), true);
  await waitFor(
    () => harness.uiMessages.length > 0 || harness.uiMenus.length > 0,
    "unconfirmed assistance did not surface a recovery state"
  );

  assert.equal(harness.directives.length, 0);
  assert.equal(runtime.getDiagnostics().at(-1)?.code, "RANKED_TEST_ASSISTANCE_UNCONFIRMED");
});

test("finalized extraction keeps Camp recovery separate from Ranked run resync", async () => {
  let campAttempts = 0;
  const campError = Object.assign(new Error("CAMP_SESSION_PENDING_TRANSACTION"), {
    code: "CAMP_SESSION_PENDING_TRANSACTION",
    status: 422,
    traceId: "trace-camp-reopen"
  });
  const harness = createHarness({
    observerBotActive: true,
    async onEvent(action) {
      assert.equal(action, "request_extraction");
      return {
        metaState: metaState({ status: "extraction", rulesetHash: "sha256:boundary" }),
        profile: { profileId: "profile_test" }
      };
    },
    async onFinalize() {
      return { metaState: metaState({ status: "finalized", rulesetHash: "sha256:boundary" }) };
    },
    async onCamp(action) {
      assert.equal(action, "open");
      campAttempts += 1;
      if (campAttempts === 1) throw campError;
      return {
        ok: true,
        protocolVersion: "ranked-v3-checkpoint-1",
        profileId: "profile_test",
        revision: 8,
        profile: { profileId: "profile_test" },
        metaState: { profileId: "profile_test" },
        metaTransactionOffer: { choices: [] }
      };
    }
  });
  const runtime = await installRuntime(harness);

  await runtime.onExtraction("emergency");

  assert.equal(runtime.getSessionState(), "FINALIZED");
  assert.equal(harness.uiSyncCalls.at(-1), "Synchronizing Camp…");
  assert.equal(harness.uiMessages.at(-1)?.[0], "Camp synchronization needed");
  const actions = harness.uiMessages.at(-1)?.[2] || [];
  assert.ok(actions.some((button) => button.label === "Retry Camp"));
  assert.equal(actions.some((button) => button.label === "Resync Ranked Run"), false);
  assert.equal(runtime.getDiagnostics().at(-1)?.code, "CAMP_SESSION_PENDING_TRANSACTION");
  assert.equal(runtime.isObserverBotBoundaryPending(), true);

  await actions.find((button) => button.label === "Retry Camp").onClick();

  assert.equal(campAttempts, 2);
  assert.equal(runtime.isObserverBotBoundaryPending(), false);
});

test("Main Menu preserves finalized Camp recovery for a later Continue Ranked", async () => {
  const campError = Object.assign(new Error("CAMP_SESSION_PENDING_TRANSACTION"), {
    code: "CAMP_SESSION_PENDING_TRANSACTION",
    status: 422
  });
  const harness = createHarness({
    observerBotActive: false,
    hasRecovery: true,
    async onEvent() {
      return {
        metaState: metaState({ status: "extraction", rulesetHash: "sha256:boundary" }),
        profile: { profileId: "profile_test" }
      };
    },
    async onFinalize() {
      return { metaState: metaState({ status: "finalized", rulesetHash: "sha256:boundary" }) };
    },
    async onCamp() { throw campError; }
  });
  const runtime = await installRuntime(harness);
  await runtime.onExtraction("emergency");

  const mainMenu = harness.uiMessages.at(-1)[2]
    .find((button) => button.label === "Main Menu");
  mainMenu.onClick();

  assert.equal(runtime.getSessionState(), "ABANDONED_LOCAL_SESSION");
  harness.root.DungeonOnlineV3Menu.openRanked();
  assert.ok(
    harness.uiMenus.at(-1)[2].some((button) => button.label === "Continue Ranked")
  );
});

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

test("portal checkpoint projects local missing HP onto canonical Ranked max HP", async () => {
  const room = {
    directiveId: "directive_hp_projection_11",
    roomNonce: "nonce_hp_projection_11",
    depth: 11,
    roomType: "combat"
  };
  const harness = createHarness({
    observerBotActive: true,
    boundarySettlement: true,
    boundedCombatResources: true,
    localCombatResources: { hp: 80, maxHp: 101 },
    publicState: {
      rulesetHash: "sha256:boundary",
      currentRoomDirective: room,
      currentRewardEnvelope: { envelopeId: "reward_hp_projection", fixedAwards: [] },
      build: { resources: { hp: 163, maxHp: 163 } }
    },
    async onCheckpoint() {
      return { metaState: metaState({ revision: 2, rulesetHash: "sha256:boundary" }) };
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered(room);
  await runtime.onLocalRoomCleared({
    turnCount: 4,
    rewardClaims: [],
    reportedGoldDelta: 0,
    completionCapability: harness.integrityContexts[0].completionCapability
  });

  assert.equal(runtime.onPortalEntry(), true);
  await waitFor(
    () => harness.calls.some((entry) => entry.action === "checkpoint"),
    "projected HP checkpoint did not start"
  );

  const checkpoint = harness.calls.find((entry) => entry.action === "checkpoint");
  assert.deepEqual(checkpoint.payload.combatResources, { hp: 142, maxHp: 163 });
});

test("rapid repeated portal entry shares one checkpoint flight for player and Observer Bot", async () => {
  for (const observerBotActive of [false, true]) {
    const checkpoint = deferred();
    const room = {
      directiveId: `directive_single_flight_${observerBotActive ? "bot" : "player"}`,
      roomNonce: "nonce_single_flight",
      depth: 7,
      roomType: "combat"
    };
    const harness = createHarness({
      observerBotActive,
      boundarySettlement: true,
      async onCheckpoint() { return checkpoint.promise; }
    });
    const client = harness.root.DungeonRankedV3Client.createRankedClient();
    client.getSnapshot().publicState = metaState({
      revision: 7,
      rulesetHash: "sha256:boundary",
      currentRoomDirective: room,
      currentRewardEnvelope: { envelopeId: "reward_single_flight", fixedAwards: [] }
    });
    const runtime = await installRuntime(harness);
    await runtime.onRoomEntered(room);
    await runtime.onLocalRoomCleared({
      turnCount: 4,
      rewardClaims: [],
      reportedGoldDelta: 0,
      completionCapability: harness.integrityContexts[0].completionCapability
    });

    assert.equal(runtime.onPortalEntry(), true);
    assert.equal(runtime.onPortalEntry(), true);
    assert.equal(runtime.onPortalEntry(), true);
    await waitFor(
      () => harness.calls.some((entry) => entry.action === "checkpoint"),
      "portal checkpoint request did not start"
    );
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      harness.calls.filter((entry) => entry.action === "checkpoint").length,
      1,
      `duplicate ${observerBotActive ? "Observer Bot/player" : "player"} portal entry started another checkpoint`
    );
    assert.equal(runtime.getSessionState(), "RESOLVING_ROOM");
    assert.equal(runtime.getDiagnostics().length, 0, "duplicate portal entry forced the active flight into recovery");
    assert.equal(runtime.isRankedAutomationBlocked(), observerBotActive);

    checkpoint.resolve({
      metaState: metaState({
        revision: 8,
        rulesetHash: "sha256:boundary",
        currentRoomDirective: {
          directiveId: "directive_after_single_flight",
          roomNonce: "nonce_after_single_flight",
          depth: 8,
          roomType: "combat"
        },
        currentRewardEnvelope: { envelopeId: "reward_after_single_flight" }
      })
    });
    await waitFor(
      () => harness.directives.some((entry) => entry.directiveId === "directive_after_single_flight"),
      "single portal checkpoint did not continue to the next directive"
    );
  }
});

test("portal loading stays hidden until the boundary flight exceeds 180ms", async () => {
  const checkpoint = deferred();
  const room = {
    directiveId: "directive_delayed_loading",
    roomNonce: "nonce_delayed_loading",
    depth: 8,
    roomType: "combat"
  };
  const harness = createHarness({
    observerBotActive: false,
    boundarySettlement: true,
    manualTimers: true,
    async onCheckpoint() { return checkpoint.promise; }
  });
  const client = harness.root.DungeonRankedV3Client.createRankedClient();
  client.getSnapshot().publicState = metaState({
    revision: 8,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: room,
    currentRewardEnvelope: { envelopeId: "reward_delayed_loading", fixedAwards: [] }
  });
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered(room);
  await runtime.onLocalRoomCleared({
    turnCount: 2,
    rewardClaims: [],
    reportedGoldDelta: 0,
    completionCapability: harness.integrityContexts[0].completionCapability
  });

  runtime.onPortalEntry();
  await waitFor(
    () => harness.calls.some((entry) => entry.action === "checkpoint"),
    "delayed checkpoint did not begin"
  );
  assert.equal(harness.uiSyncCalls.length, 0);
  const loadingTimer = harness.scheduledTimers.find((timer) => timer.delay === 180 && !timer.cleared);
  assert.ok(loadingTimer, "portal flight did not schedule the delayed loading indicator");
  loadingTimer.callback();
  assert.deepEqual(harness.uiSyncCalls, ["Loading next depth…"]);

  checkpoint.resolve({
    metaState: metaState({
      revision: 9,
      rulesetHash: "sha256:boundary",
      currentRoomDirective: {
        directiveId: "directive_after_delayed_loading",
        depth: 9,
        roomType: "combat"
      }
    })
  });
  await waitFor(
    () => harness.directives.some((entry) => entry.directiveId === "directive_after_delayed_loading"),
    "delayed portal operation did not finish"
  );
});

test("a late checkpoint callback is ignored after recovery invalidates its generation", async () => {
  const checkpoint = deferred();
  const room = {
    directiveId: "directive_stale_callback",
    roomNonce: "nonce_stale_callback",
    depth: 9,
    roomType: "combat"
  };
  const recoveryError = Object.assign(new TypeError("Protocol version mismatch."), {
    code: "PROTOCOL_VERSION_MISMATCH",
    status: 409,
    traceId: "trace-root-protocol"
  });
  const harness = createHarness({
    observerBotActive: false,
    boundarySettlement: true,
    async onCheckpoint() { return checkpoint.promise; },
    async onResume() { throw recoveryError; }
  });
  const client = harness.root.DungeonRankedV3Client.createRankedClient();
  client.getSnapshot().publicState = metaState({
    revision: 9,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: room,
    currentRewardEnvelope: { envelopeId: "reward_stale_callback", fixedAwards: [] }
  });
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered(room);
  await runtime.onLocalRoomCleared({
    turnCount: 3,
    rewardClaims: [],
    reportedGoldDelta: 0,
    completionCapability: harness.integrityContexts[0].completionCapability
  });
  runtime.onPortalEntry();
  await waitFor(
    () => harness.calls.some((entry) => entry.action === "checkpoint"),
    "checkpoint did not reach the delayed response boundary"
  );

  await runtime.resumeRanked();
  assert.equal(runtime.getSessionState(), "UNRECOVERABLE_PROTOCOL_ERROR");
  checkpoint.resolve({
    metaState: metaState({
      revision: 10,
      rulesetHash: "sha256:boundary",
      currentRoomDirective: {
        directiveId: "directive_must_stay_ignored",
        depth: 10,
        roomType: "boss"
      }
    })
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(runtime.getSessionState(), "UNRECOVERABLE_PROTOCOL_ERROR");
  assert.equal(
    harness.directives.some((entry) => entry.directiveId === "directive_must_stay_ignored"),
    false
  );
  assert.equal(runtime.getDiagnostics().at(-1)?.code, "PROTOCOL_VERSION_MISMATCH");
});

test("a transient checkpoint failure auto-resyncs calmly and continues exactly once", async () => {
  const room = {
    directiveId: "directive_auto_resync_before",
    roomNonce: "nonce_auto_resync_before",
    depth: 11,
    roomType: "combat"
  };
  const nextRoom = metaState({
    revision: 12,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: {
      directiveId: "directive_auto_resync_after",
      roomNonce: "nonce_auto_resync_after",
      depth: 12,
      roomType: "combat"
    },
    currentRewardEnvelope: { envelopeId: "reward_auto_resync_after" }
  });
  const networkError = Object.assign(new Error("Temporary network loss."), {
    code: "NETWORK_ERROR",
    status: 0,
    retryable: true,
    traceId: "trace-root-network"
  });
  const harness = createHarness({
    observerBotActive: false,
    boundarySettlement: true,
    async onCheckpoint() { throw networkError; },
    async onResume() { return { metaState: nextRoom }; }
  });
  const client = harness.root.DungeonRankedV3Client.createRankedClient();
  client.getSnapshot().publicState = metaState({
    revision: 11,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: room,
    currentRewardEnvelope: { envelopeId: "reward_auto_resync_before", fixedAwards: [] }
  });
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered(room);
  await runtime.onLocalRoomCleared({
    turnCount: 3,
    rewardClaims: [],
    reportedGoldDelta: 0,
    completionCapability: harness.integrityContexts[0].completionCapability
  });

  runtime.onPortalEntry();
  await waitForTimer(
    () => harness.calls.some((entry) => entry.action === "resume"),
    "transient failure did not schedule one automatic canonical resync"
  );
  await waitFor(
    () => harness.directives.filter((entry) => entry.directiveId === "directive_auto_resync_after").length === 1,
    `automatic resync did not restore the canonical next room (state ${runtime.getSessionState()})`
  );

  assert.deepEqual(harness.calls.map((entry) => entry.action), ["checkpoint", "resume"]);
  assert.equal(harness.uiMessages.length, 0, "transient recovery showed a technical blocking popup");
  assert.ok(harness.uiSyncCalls.includes("Synchronizing Ranked…"));
  assert.equal(runtime.onPortalEntry(), false, "completed portal intent survived successful resync");
  assert.equal(harness.calls.filter((entry) => entry.action === "resume").length, 1);
});

test("a retryable unreadable checkpoint response remains recoverable and canonically resyncs", async () => {
  const room = {
    directiveId: "directive_unreadable_before",
    roomNonce: "nonce_unreadable_before",
    depth: 53,
    roomType: "duel"
  };
  const nextRoom = metaState({
    revision: 4,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: {
      directiveId: "directive_unreadable_after",
      roomNonce: "nonce_unreadable_after",
      depth: 54,
      roomType: "duel"
    },
    currentRewardEnvelope: { envelopeId: "reward_unreadable_after" }
  });
  const unreadableError = Object.assign(new Error("Worker returned an unreadable response."), {
    code: "RESPONSE_NOT_JSON",
    status: 500,
    retryable: true
  });
  const harness = createHarness({
    observerBotActive: false,
    boundarySettlement: true,
    async onCheckpoint() { throw unreadableError; },
    async onResume() { return { metaState: nextRoom }; }
  });
  const client = harness.root.DungeonRankedV3Client.createRankedClient();
  client.getSnapshot().publicState = metaState({
    revision: 3,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: room,
    currentRewardEnvelope: { envelopeId: "reward_unreadable_before", fixedAwards: [] }
  });
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered(room);
  await runtime.onLocalRoomCleared({
    turnCount: 21,
    rewardClaims: [],
    reportedGoldDelta: 54,
    completionCapability: harness.integrityContexts[0].completionCapability
  });

  runtime.onPortalEntry();
  await waitForTimer(
    () => harness.calls.some((entry) => entry.action === "resume"),
    "retryable unreadable response did not schedule canonical resync"
  );
  await waitFor(
    () => harness.directives.some((entry) => entry.directiveId === "directive_unreadable_after"),
    `unreadable-response recovery did not restore the next room (state ${runtime.getSessionState()})`
  );

  assert.deepEqual(harness.calls.map((entry) => entry.action), ["checkpoint", "resume"]);
  assert.equal(harness.uiMessages.length, 0);
  assert.ok(harness.uiSyncCalls.includes("Synchronizing Ranked…"));
  assert.equal(runtime.getSessionState(), "ROOM_ACTIVE");
});

test("a retryable internal checkpoint error stops safely instead of rebuilding the room", async () => {
  const room = {
    directiveId: "directive_internal_error",
    roomNonce: "nonce_internal_error",
    depth: 12,
    roomType: "combat"
  };
  const internalError = Object.assign(new Error("Internal checkpoint failure."), {
    code: "INTERNAL_ERROR",
    status: 500,
    retryable: true,
    traceId: "trace-internal-checkpoint"
  });
  const harness = createHarness({
    observerBotActive: false,
    boundarySettlement: true,
    async onCheckpoint() { throw internalError; },
    async onResume() {
      throw new Error("generic server errors must not trigger automatic resync");
    }
  });
  const client = harness.root.DungeonRankedV3Client.createRankedClient();
  client.getSnapshot().publicState = metaState({
    revision: 12,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: room,
    currentRewardEnvelope: { envelopeId: "reward_internal_error", fixedAwards: [] }
  });
  client.getSnapshot().pendingOperation = {
    endpoint: "checkpoint",
    operationId: "op_internal_checkpoint",
    body: {
      checkpointToken: "secret-checkpoint-token",
      recoveryCredential: "secret-recovery-credential",
      commandJournalDigest: "secret-command-digest",
      unexpectedPayload: { privateValue: "secret-private-value" }
    }
  };
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered(room);
  await runtime.onLocalRoomCleared({
    turnCount: 3,
    rewardClaims: [],
    reportedGoldDelta: 0,
    completionCapability: harness.integrityContexts[0].completionCapability
  });

  runtime.onPortalEntry();
  await waitFor(
    () => harness.uiMessages.at(-1)?.[0] === "Ranked reconnect required",
    "internal checkpoint failure did not stop in recoverable UI"
  );

  assert.deepEqual(harness.calls.map((entry) => entry.action), ["checkpoint"]);
  assert.equal(harness.directives.some((entry) => entry.directiveId === room.directiveId), false);
  const diagnostic = runtime.getDiagnostics().at(-1);
  assert.deepEqual({
    code: diagnostic.code,
    traceId: diagnostic.traceId,
    endpoint: diagnostic.endpoint,
    operationId: diagnostic.operationId,
    action: diagnostic.action,
    roomDirectiveId: diagnostic.roomDirectiveId,
    depth: diagnostic.depth,
    roomType: diagnostic.roomType,
    rulesetHash: diagnostic.rulesetHash
  }, {
    code: "INTERNAL_ERROR",
    traceId: "trace-internal-checkpoint",
    endpoint: "checkpoint",
    operationId: "op_internal_checkpoint",
    action: "checkpoint",
    roomDirectiveId: room.directiveId,
    depth: 12,
    roomType: "combat",
    rulesetHash: "sha256:boundary"
  });
  const reconnect = harness.uiMessages.at(-1);
  assert.match(reconnect[1], /trace trace-internal-checkpoint/u);
  const exportButton = reconnect[2].find((button) => button.label === "Export diagnostics");
  assert.ok(exportButton, "reconnect should expose a diagnostic export");
  exportButton.onClick();
  assert.equal(harness.diagnosticExports.length, 1);
  const exported = JSON.parse(harness.diagnosticExports[0].text);
  assert.equal(exported.format, "dungeon-ranked-diagnostics-v1");
  assert.equal(exported.rootDiagnostic.traceId, "trace-internal-checkpoint");
  assert.equal(exported.diagnostics.at(-1).operationId, "op_internal_checkpoint");
  assert.doesNotMatch(
    harness.diagnosticExports[0].text,
    /secret-checkpoint-token|secret-recovery-credential|secret-command-digest|secret-private-value/u
  );
});

test("a blocking Observer Bot error records one redacted Ranked trace event", async () => {
  const room = {
    directiveId: "directive_observer_diagnostic",
    roomNonce: "nonce_observer_diagnostic",
    depth: 10,
    roomType: "boss"
  };
  const internalError = Object.assign(new Error("Internal event failure."), {
    code: "INTERNAL_ERROR",
    status: 500,
    retryable: true,
    traceId: "trace-observer-internal"
  });
  const harness = createHarness({
    observerBotActive: true,
    boundarySettlement: true,
    async onCheckpoint() { throw internalError; }
  });
  const client = harness.root.DungeonRankedV3Client.createRankedClient();
  client.getSnapshot().publicState = metaState({
    revision: 10,
    rulesetHash: "sha256:observer-diagnostic",
    assistanceClass: "observer_bot",
    currentRoomDirective: room,
    currentRewardEnvelope: { envelopeId: "reward_observer_diagnostic", fixedAwards: [] }
  });
  client.getSnapshot().pendingOperation = {
    endpoint: "checkpoint",
    operationId: "op_observer_diagnostic",
    body: { checkpointToken: "secret-observer-token" }
  };
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered(room);
  await runtime.onLocalRoomCleared({
    turnCount: 3,
    rewardClaims: [],
    reportedGoldDelta: 0,
    completionCapability: harness.integrityContexts[0].completionCapability
  });

  runtime.onPortalEntry();
  await waitFor(
    () => harness.uiMessages.at(-1)?.[0] === "Ranked reconnect required",
    "Observer diagnostic error did not enter recovery"
  );

  assert.equal(harness.rankedDiagnostics.length, 1);
  assert.deepEqual({
    code: harness.rankedDiagnostics[0].code,
    traceId: harness.rankedDiagnostics[0].traceId,
    operationId: harness.rankedDiagnostics[0].operationId,
    depth: harness.rankedDiagnostics[0].depth,
    roomType: harness.rankedDiagnostics[0].roomType
  }, {
    code: "INTERNAL_ERROR",
    traceId: "trace-observer-internal",
    operationId: "op_observer_diagnostic",
    depth: 10,
    roomType: "boss"
  });
  assert.doesNotMatch(JSON.stringify(harness.rankedDiagnostics), /secret-observer-token/u);
});

test("persisted Ranked diagnostics discard unrecognized local fields", async () => {
  const harness = createHarness({ observerBotActive: false });
  harness.root.localStorage.setItem("dungeonOnlineV3Diagnostics:v1", JSON.stringify([{
    at: "2026-08-28T00:00:00.000Z",
    kind: "client_error",
    code: "INTERNAL_ERROR",
    traceId: "trace-persisted-safe",
    runId: "run_persisted_safe",
    revision: 4,
    endpoint: "event",
    checkpointToken: "secret-persisted-token",
    recoveryCredential: "secret-persisted-credential",
    nested: { privateValue: "secret-persisted-value" }
  }]));

  const runtime = await installRuntime(harness);
  const diagnostics = runtime.getDiagnostics();

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].traceId, "trace-persisted-safe");
  assert.doesNotMatch(
    JSON.stringify(diagnostics),
    /checkpointToken|recoveryCredential|secret-persisted/u
  );
});

test("failed automatic resync keeps the first diagnostic as the recovery root error", async () => {
  const room = {
    directiveId: "directive_root_diagnostic",
    roomNonce: "nonce_root_diagnostic",
    depth: 13,
    roomType: "combat"
  };
  const rootError = Object.assign(new Error("Temporary network loss."), {
    code: "NETWORK_ERROR",
    retryable: true,
    traceId: "trace-first-root"
  });
  const secondaryError = Object.assign(new TypeError("Response was not JSON."), {
    code: "RESPONSE_NOT_JSON",
    status: 502,
    traceId: "trace-secondary-resync"
  });
  const harness = createHarness({
    observerBotActive: false,
    boundarySettlement: true,
    async onCheckpoint() { throw rootError; },
    async onResume() { throw secondaryError; }
  });
  const client = harness.root.DungeonRankedV3Client.createRankedClient();
  client.getSnapshot().publicState = metaState({
    revision: 13,
    rulesetHash: "sha256:boundary",
    currentRoomDirective: room,
    currentRewardEnvelope: { envelopeId: "reward_root_diagnostic", fixedAwards: [] }
  });
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered(room);
  await runtime.onLocalRoomCleared({
    turnCount: 3,
    rewardClaims: [],
    reportedGoldDelta: 0,
    completionCapability: harness.integrityContexts[0].completionCapability
  });

  runtime.onPortalEntry();
  await waitForTimer(() => harness.uiMessages.length === 1, "failed automatic resync did not surface recovery controls");

  assert.equal(harness.calls.filter((entry) => entry.action === "resume").length, 1);
  assert.match(harness.uiMessages[0][1], /NETWORK_ERROR/u);
  assert.doesNotMatch(harness.uiMessages[0][1], /RANKED_STATE_TRANSITION_INVALID/u);
  assert.equal(runtime.getDiagnostics()[0]?.code, "NETWORK_ERROR");
});

test("legacy non-boundary portal handling remains unchanged", async () => {
  const harness = createHarness({
    observerBotActive: false,
    boundarySettlement: false,
    async onCheckpoint() { return { metaState: metaState() }; }
  });
  const runtime = await installRuntime(harness);

  assert.equal(runtime.onPortalEntry(), false);
  assert.equal(harness.calls.length, 0);
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

test("Ranked Otter clear presents one canonical Crimson chest and opens one server offer", async () => {
  const otterSlot = { slotId: "slot_otter", sourceId: "otter-crimson-chest", consumed: false };
  const otterState = metaState({
    currentRoomDirective: { directiveId: "directive_otter", depth: 41, roomType: "otter" },
    rewardSlots: [otterSlot]
  });
  const harness = createHarness({
    observerBotActive: false,
    roomType: "otter",
    rewardSlots: [otterSlot],
    async onEvent(action, payload) {
      assert.equal(action, "issue_relic_offer");
      assert.equal(payload.rewardSlotId, "slot_otter");
      return {
        metaState: {
          ...otterState,
          rewardSlots: [{ ...otterSlot, consumed: true }],
          relicOffer: {
            offerId: "offer_otter",
            sourceType: "otter",
            sourceId: "otter-crimson-chest",
            publicChoices: [{ choiceId: "canonical_choice", relicId: "fang" }]
          }
        }
      };
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onRoomEntered(otterState.currentRoomDirective);
  await runtime.onLocalRoomCleared({
    turnCount: 4,
    rewardClaims: [],
    completionCapability: harness.integrityContexts[0].completionCapability
  });

  assert.equal(harness.otterChestPresentations.length, 1);
  assert.equal(harness.calls.filter((entry) => entry.action === "issue_relic_offer").length, 0);
  assert.equal(runtime.onOtterChestOpen(), true);
  assert.equal(runtime.onOtterChestOpen(), true);
  await waitFor(() => harness.uiChoiceCalls.length === 1, "canonical Otter offer was not presented");
  assert.equal(harness.calls.filter((entry) => entry.action === "issue_relic_offer").length, 1);
  assert.equal(harness.uiChoiceCalls[0][2][0].choiceId, "canonical_choice");
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
  assert.equal(runtime.getSnapshot()?.publicState?.rankEligibility, "provisional");
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
  assert.equal(runtime.getSnapshot()?.publicState?.rankEligibility, "provisional");
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

test("automatic resync retries the preserved checkpoint when the same uncommitted room returns", async () => {
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
  await waitForTimer(
    () => harness.calls.filter((entry) => entry.action === "checkpoint").length === 2,
    "automatic resync did not retry the preserved checkpoint"
  );
  await waitFor(
    () => harness.uiMessages.at(-1)?.[0] === "Ranked reconnect required",
    "the failed preserved checkpoint retry did not stop safely"
  );

  assert.equal(
    harness.calls.some((entry) => entry.action === "request_extraction"),
    false,
    "same-room resync incorrectly continued normal extraction"
  );
  assert.deepEqual(harness.calls.map((entry) => entry.action), ["checkpoint", "resume", "checkpoint"]);
  assert.equal(
    harness.directives.some((entry) => entry.directiveId === firstRoom.directiveId),
    false,
    "same-room resync rebuilt a locally completed room"
  );
  assert.ok(harness.uiSyncCalls.includes("Synchronizing Ranked…"));
  const diagnostics = runtime.getDiagnostics();
  assert.equal(diagnostics.at(-1)?.kind, "client_error");
  assert.equal(diagnostics.at(-1)?.code, "TOKEN_EXPIRED");
  assert.equal(diagnostics.at(-1)?.status, 401);
  assert.equal(diagnostics[0]?.endpoint, "checkpoint");
  assert.equal(diagnostics.at(-1)?.runId, "run_integrity");
  assert.equal(diagnostics.at(-1)?.revision, 1);
  assert.equal(diagnostics.at(-1)?.traceId, "trace-expired-checkpoint");
  assert.equal(diagnostics.at(-1)?.traceId, "trace-expired-checkpoint");
  assert.doesNotMatch(JSON.stringify(diagnostics), /checkpointToken|recoveryCredential|secret-/u);
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

test("Observer Bot Warden reward extraction stays in one boundary operation", async () => {
  const harness = createHarness({
    observerBotActive: true,
    boundarySettlement: true,
    rewardSlots: [{ slotId: "warden_slot_1" }],
    publicState: {
      currentRoomDirective: {
        directiveId: "directive_warden_5",
        depth: 5,
        roomType: "boss"
      },
      currentRewardEnvelope: {
        envelopeId: "reward_warden_5",
        fixedAwards: []
      }
    },
    async onEvent(action) {
      if (action === "issue_relic_offer") {
        return { metaState: metaState({
          currentRoomDirective: {
            directiveId: "directive_warden_5",
            depth: 5,
            roomType: "boss"
          },
          relicOffer: {
            offerId: "warden_offer_1",
            publicChoices: [{ choiceId: "warden_choice_1" }]
          }
        }) };
      }
      if (action === "select_relic") {
        return { metaState: metaState({
          currentRoomDirective: {
            directiveId: "directive_warden_5",
            depth: 5,
            roomType: "boss"
          },
          relicReplacement: {
            transactionId: "warden_replace_1",
            cancelAllowed: false,
            publicChoices: [{ replacementChoiceId: "warden_replace_choice_1" }]
          }
        }) };
      }
      if (action === "commit_relic_replacement") return { metaState: metaState() };
      if (action === "request_extraction") {
        return {
          metaState: metaState({
            status: "extraction",
            currentRoomDirective: null
          }),
          profile: { profileId: "profile_warden" }
        };
      }
      throw new Error(`Unexpected event: ${action}`);
    },
    async onCheckpoint() {
      return { metaState: metaState({
        currentRoomDirective: {
          directiveId: "directive_after_warden",
          depth: 6,
          roomType: "combat"
        }
      }) };
    },
    async onFinalize() {
      return { metaState: metaState({ status: "finalized", currentRoomDirective: null }) };
    },
    async onCamp(action) {
      assert.equal(action, "open");
      return {
        profile: { profileId: "profile_warden" },
        metaTransactionOffer: { choices: [] }
      };
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onLocalRoomCleared({ turnCount: 11, rewardClaims: [] });

  const extraction = runtime.onExtraction("normal");
  const repeatedExtraction = runtime.onExtraction("normal");
  await waitFor(
    () => harness.calls.some((entry) => entry.action === "camp:open"),
    "Warden reward extraction did not reach Camp"
  );
  await Promise.all([extraction, repeatedExtraction]);

  assert.deepEqual(harness.calls.map((entry) => entry.action), [
    "issue_relic_offer",
    "select_relic",
    "commit_relic_replacement",
    "checkpoint",
    "request_extraction",
    "finalize",
    "camp:open"
  ]);
  assert.equal(runtime.getSessionState(), "FINALIZED");
  assert.equal(runtime.isObserverBotBoundaryPending(), false);
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

function merchantOfferState(overrides = {}) {
  return metaState({
    revision: 1,
    gold: 100,
    campGold: 0,
    build: { relics: [], merchant: { reservedRelic: null } },
    currentRoomDirective: { directiveId: "directive_merchant", depth: 2, roomType: "merchant" },
    metaTransactionOffer: {
      sourceType: "merchant",
      offerId: "merchant_offer_1",
      choices: [
        { transactionId: "merchant_tx_1", choiceId: "potion_1", kind: "merchant_potion", status: "available", price: 20 }
      ]
    },
    ...overrides
  });
}

function merchantCommittedState(overrides = {}) {
  return merchantOfferState({
    revision: 2,
    metaTransactionOffer: {
      sourceType: "merchant",
      offerId: "merchant_offer_1",
      choices: [
        { transactionId: "merchant_tx_1", choiceId: "potion_1", kind: "merchant_potion", status: "sold", price: 20 }
      ]
    },
    metaTransactionReceipts: [
      { transactionId: "merchant_tx_1", choiceId: "potion_1", receiptKey: "merchant-receipt-1", completedRevision: 2 }
    ],
    ...overrides
  });
}

test("pending Merchant submission dispatches once and duplicate receipts are idempotent", async () => {
  const commit = deferred();
  let commitCalls = 0;
  const harness = createHarness({
    observerBotActive: false,
    async onEvent(action) {
      if (action === "open_meta_offer") return { metaState: merchantOfferState() };
      if (action === "commit_meta_transaction") {
        commitCalls += 1;
        return commit.promise;
      }
      throw new Error(`unexpected Merchant event: ${action}`);
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();
  assert.equal(runtime.onMerchantAction({ action: "potion" }), true);
  assert.equal(runtime.completeRankedMerchantAction({
    canonicalConfirmed: true,
    operationId: "op_attacker",
    receiptKey: "attacker-receipt"
  }), false);
  assert.equal(runtime.onMerchantAction({ action: "potion" }), true);
  assert.equal(commitCalls, 1);
  assert.equal(runtime.getRankedMerchantMutationState().status, "pending");
  assert.equal(harness.merchantCompletions.length, 0);

  commit.resolve({ metaState: merchantCommittedState() });
  await new Promise((resolve) => setImmediate(resolve));
  await waitFor(
    () => runtime.getRankedMerchantMutationState().status === "confirmed",
    "Merchant commit did not settle canonically"
  );
  assert.equal(harness.merchantCompletions.length, 1);
  assert.equal(runtime.completeRankedMerchantAction({ receiptKey: "merchant-receipt-1" }), false);
  assert.equal(harness.merchantCompletions.length, 1);
});

test("deterministic Merchant rejection and missing choice fail without a confirmed purchase", async () => {
  const deterministicError = Object.assign(new Error("choice unavailable"), { status: 422, code: "CHOICE_UNAVAILABLE" });
  const harness = createHarness({
    observerBotActive: false,
    async onEvent(action) {
      if (action === "open_meta_offer") return { metaState: merchantOfferState() };
      if (action === "commit_meta_transaction") throw deterministicError;
      throw new Error(`unexpected Merchant event: ${action}`);
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();
  assert.equal(runtime.onMerchantAction({ action: "skill_upgrade", skillId: "shield" }), false);
  assert.equal(harness.merchantCompletions.length, 0);
  assert.equal(runtime.getRankedMerchantMutationState().reason, "no_canonical_choice");

  assert.equal(runtime.onMerchantAction({ action: "potion" }), true);
  await waitFor(
    () => runtime.getRankedMerchantMutationState().status === "rejected",
    "deterministic Merchant rejection did not settle"
  );
  assert.equal(harness.merchantCompletions.length, 0);
  assert.equal(harness.merchantFailures.at(-1)?.reason, "commit_rejected");
});

test("Merchant refuses an unaffordable stale choice before dispatch", async () => {
  let commitCalls = 0;
  const state = merchantOfferState({
    gold: 60,
    campGold: 0,
    build: { relics: [], merchant: { reservedRelic: null } },
    metaTransactionOffer: {
      sourceType: "merchant",
      offerId: "merchant_offer_low_wallet",
      choices: [
        {
          transactionId: "merchant_tx_aoe",
          choiceId: "aoe_1",
          kind: "merchant_skill_upgrade",
          skillId: "aoe",
          tier: 1,
          status: "available",
          currency: "run_then_camp",
          price: 600
        }
      ]
    }
  });
  const harness = createHarness({
    observerBotActive: false,
    async onEvent(action) {
      if (action === "open_meta_offer") return { metaState: state };
      if (action === "commit_meta_transaction") commitCalls += 1;
      throw new Error(`unexpected Merchant event: ${action}`);
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();

  assert.equal(runtime.onMerchantAction({ action: "skill_upgrade", skillId: "aoe" }), false);
  assert.equal(commitCalls, 0);
  assert.equal(runtime.getRankedMerchantMutationState().status, "rejected");
  assert.equal(runtime.getRankedMerchantMutationState().reason, "insufficient_wallet");
});

test("Merchant refuses stale Black Market choices for relics no longer owned", async () => {
  let commitCalls = 0;
  const state = merchantOfferState({
    gold: 134,
    campGold: 983,
    build: {
      relics: [{ relicId: "trapweave", stacks: 1 }],
      merchant: { reservedRelic: null }
    },
    metaTransactionOffer: {
      sourceType: "merchant",
      offerId: "merchant_offer_stale_black_market",
      choices: [
        {
          transactionId: "merchant_tx_black_market",
          choiceId: "black_market_removed_relic",
          kind: "merchant_black_market",
          targetRelicId: "laststandtorque",
          status: "available",
          currency: "run_gold",
          price: 0
        }
      ]
    }
  });
  const harness = createHarness({
    observerBotActive: true,
    async onEvent(action) {
      if (action === "open_meta_offer") return { metaState: state };
      if (action === "commit_meta_transaction") commitCalls += 1;
      throw new Error(`unexpected Merchant event: ${action}`);
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();

  assert.equal(runtime.onMerchantAction({ action: "black_market", relicId: "laststandtorque" }), false);
  assert.equal(commitCalls, 0);
  assert.equal(runtime.getRankedMerchantMutationState().status, "backoff");
  assert.equal(runtime.getRankedMerchantMutationState().reason, "relic_unavailable");
});

test("uncertain Merchant transport resumes before one retry with the same operation identity", async () => {
  const calls = [];
  let commitCalls = 0;
  const harness = createHarness({
    observerBotActive: false,
    async onEvent(action, payload, operationId) {
      calls.push({ action, payload, operationId });
      if (action === "open_meta_offer") return { metaState: merchantOfferState() };
      if (action === "commit_meta_transaction") {
        commitCalls += 1;
        if (commitCalls === 1) throw new Error("network timeout");
        return { metaState: merchantCommittedState() };
      }
      throw new Error(`unexpected Merchant event: ${action}`);
    },
    async onResume() {
      calls.push({ action: "resume" });
      return { metaState: merchantOfferState() };
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();
  assert.equal(runtime.onMerchantAction({ action: "potion" }), true);
  await waitFor(
    () => runtime.getRankedMerchantMutationState().status === "confirmed",
    "uncertain Merchant operation did not retry and confirm"
  );
  const commits = calls.filter((entry) => entry.action === "commit_meta_transaction");
  assert.equal(commits.length, 2);
  assert.equal(calls.findIndex((entry) => entry.action === "resume") > 0, true);
  assert.match(commits[0].operationId, /^op_[0-9a-f]{32}$/u);
  assert.equal(commits[0].operationId, commits[1].operationId);
  const resumeCall = calls.find((entry) => entry.action === "resume");
  assert.notEqual(resumeCall.operationId, commits[0].operationId);
  assert.equal(harness.merchantCompletions.length, 1);
});

test("Merchant resync adopts a committed canonical receipt without a second commit", async () => {
  let commitCalls = 0;
  const harness = createHarness({
    observerBotActive: false,
    async onEvent(action) {
      if (action === "open_meta_offer") return { metaState: merchantOfferState() };
      if (action === "commit_meta_transaction") {
        commitCalls += 1;
        throw new Error("response lost after commit");
      }
      throw new Error(`unexpected Merchant event: ${action}`);
    },
    async onResume() {
      return { metaState: merchantCommittedState({ metaTransactionReceipts: undefined }) };
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();
  runtime.onMerchantAction({ action: "potion" });
  await waitFor(
    () => runtime.getRankedMerchantMutationState().status === "confirmed",
    "resync did not adopt the committed Merchant receipt"
  );
  assert.equal(commitCalls, 1);
  assert.equal(harness.merchantCompletions.length, 1);
  assert.equal(harness.merchantCompletions[0].adopted, true);
  assert.equal(harness.merchantCompletions[0].receiptKey, "op_00000000000040008000000000000000");
});

test("three deterministic Merchant failures enter bounded backoff and block further attempts", async () => {
  const deterministicError = Object.assign(new Error("stale choice"), { status: 422, code: "STALE_CHOICE" });
  let commitCalls = 0;
  const harness = createHarness({
    observerBotActive: false,
    async onEvent(action) {
      if (action === "open_meta_offer") return { metaState: merchantOfferState() };
      if (action === "commit_meta_transaction") {
        commitCalls += 1;
        throw deterministicError;
      }
      throw new Error(`unexpected Merchant event: ${action}`);
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.equal(runtime.onMerchantAction({ action: "potion" }), true);
    await waitFor(
      () => ["rejected", "backoff"].includes(runtime.getRankedMerchantMutationState().status),
      `Merchant failure ${attempt + 1} did not settle`
    );
  }
  assert.equal(commitCalls, 3);
  assert.equal(runtime.getRankedMerchantMutationState().status, "backoff");
  assert.equal(runtime.getRankedMerchantMutationState().reason, "failure_backoff");
  assert.equal(runtime.onMerchantAction({ action: "potion" }), true);
  assert.equal(commitCalls, 3);
  assert.equal(harness.merchantCompletions.length, 0);
});

test("Merchant operation IDs use transport format, fresh resume identity, and original retry identity", async () => {
  const calls = [];
  let commits = 0;
  const harness = createHarness({
    observerBotActive: false,
    async onEvent(action, payload, operationId) {
      calls.push({ action, payload, operationId });
      if (action === "open_meta_offer") return { metaState: merchantOfferState() };
      if (action === "commit_meta_transaction") {
        commits += 1;
        if (commits === 1) throw new Error("transport timeout");
        return { metaState: merchantCommittedState() };
      }
      throw new Error(`unexpected Merchant event: ${action}`);
    },
    async onResume(input, operationId) {
      calls.push({ action: "resume", payload: input, operationId: operationId || "resume-fresh" });
      return { metaState: merchantOfferState() };
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();
  runtime.onMerchantAction({ action: "potion" });
  await waitFor(() => runtime.getRankedMerchantMutationState().status === "confirmed", "identity test did not confirm");
  const commitCalls = calls.filter((entry) => entry.action === "commit_meta_transaction");
  const resumeCall = calls.find((entry) => entry.action === "resume");
  assert.match(commitCalls[0].operationId, /^op_[0-9a-f]{32}$/u);
  assert.equal(commitCalls[0].operationId, commitCalls[1].operationId);
  assert.notEqual(resumeCall.operationId, commitCalls[0].operationId);
});

test("a 409 Merchant conflict resyncs and retries instead of deterministic failure", async () => {
  let commits = 0;
  const conflict = Object.assign(new Error("revision conflict"), { status: 409, code: "REVISION_CONFLICT" });
  const harness = createHarness({
    observerBotActive: false,
    async onEvent(action) {
      if (action === "open_meta_offer") return { metaState: merchantOfferState() };
      if (action === "commit_meta_transaction") {
        commits += 1;
        if (commits === 1) throw conflict;
        return { metaState: merchantCommittedState() };
      }
      throw new Error(`unexpected Merchant event: ${action}`);
    },
    async onResume() { return { metaState: merchantOfferState() }; }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();
  runtime.onMerchantAction({ action: "potion" });
  await waitFor(() => runtime.getRankedMerchantMutationState().status === "confirmed", "409 conflict did not retry");
  assert.equal(commits, 2);
});

test("advanced changed Merchant state without exact proof never retries a stale choice", async () => {
  let commits = 0;
  const harness = createHarness({
    observerBotActive: false,
    async onEvent(action) {
      if (action === "open_meta_offer") return { metaState: merchantOfferState() };
      if (action === "commit_meta_transaction") {
        commits += 1;
        throw new Error("response lost");
      }
      throw new Error(`unexpected Merchant event: ${action}`);
    },
    async onResume() {
      return { metaState: merchantOfferState({
        revision: 2,
        metaTransactionOffer: {
          sourceType: "merchant",
          offerId: "merchant_offer_changed",
          choices: [{ transactionId: "merchant_tx_1", choiceId: "potion_1", kind: "merchant_potion", status: "available", price: 20 }]
        }
      }) };
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();
  runtime.onMerchantAction({ action: "potion" });
  await waitFor(() => runtime.getRankedMerchantMutationState().status === "rejected", "false-positive resync did not close");
  assert.equal(runtime.getRankedMerchantMutationState().reason, "resync_required");
  assert.equal(commits, 1);
});

test("direct Merchant success completes before consuming a null offer", async () => {
  const harness = createHarness({
    observerBotActive: false,
    async onEvent(action) {
      if (action === "open_meta_offer") return { metaState: merchantOfferState() };
      if (action === "commit_meta_transaction") return { metaState: merchantOfferState({ revision: 2, metaTransactionOffer: undefined }) };
      throw new Error(`unexpected Merchant event: ${action}`);
    }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();
  runtime.onMerchantAction({ action: "potion" });
  await waitFor(() => runtime.getRankedMerchantMutationState().status === "confirmed", "null-offer success did not confirm");
  assert.equal(harness.merchantCompletions.length, 1);
  assert.equal(harness.merchantCompletions[0].offerConsumed, true);
  assert.equal(harness.merchantPresentations.length, 1);
});


test("claim resync adopts canonical build merchant reservation and top-level wallet debit", async () => {
  let commitCalls = 0;
  const initial = merchantOfferState({
    gold: 80,
    campGold: 10,
    build: {
      merchant: { reservedRelic: { relicId: "vampfang" } },
      relics: []
    },
    metaTransactionOffer: {
      sourceType: "merchant",
      offerId: "merchant_offer_claim",
      choices: [
        { transactionId: "merchant_tx_claim", choiceId: "claim_vampfang", kind: "merchant_reserved_claim", relicId: "vampfang", status: "available", price: 30 }
      ]
    }
  });
  const adopted = merchantOfferState({
    revision: 2,
    gold: 50,
    campGold: 10,
    build: {
      merchant: { reservedRelic: null },
      relics: [{ relicId: "vampfang", stacks: 1 }]
    },
    metaTransactionOffer: undefined
  });
  const harness = createHarness({
    observerBotActive: false,
    async onEvent(action) {
      if (action === "open_meta_offer") return { metaState: initial };
      if (action === "commit_meta_transaction") {
        commitCalls += 1;
        throw new Error("response lost after claim commit");
      }
      throw new Error(`unexpected Merchant event: ${action}`);
    },
    async onResume() { return { metaState: adopted }; }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();
  assert.equal(runtime.onMerchantAction({ action: "claim_reserved", relicId: "vampfang" }), true);
  await waitFor(() => runtime.getRankedMerchantMutationState().status === "confirmed", "claim adoption did not confirm");
  assert.equal(commitCalls, 1);
  assert.equal(harness.merchantCompletions[0].adopted, true);
});

test("discard resync adopts canonical build reservation clear without charging top-level wallet", async () => {
  let commitCalls = 0;
  const initial = merchantOfferState({
    gold: 80,
    campGold: 10,
    build: { merchant: { reservedRelic: { relicId: "vampfang" } }, relics: [] },
    metaTransactionOffer: {
      sourceType: "merchant",
      offerId: "merchant_offer_discard",
      choices: [
        { transactionId: "merchant_tx_discard", choiceId: "discard_vampfang", kind: "merchant_reserved_discard", relicId: "vampfang", status: "available", price: 0 }
      ]
    }
  });
  const adopted = merchantOfferState({
    revision: 2,
    gold: 80,
    campGold: 10,
    build: { merchant: { reservedRelic: null }, relics: [] },
    metaTransactionOffer: undefined
  });
  const harness = createHarness({
    observerBotActive: false,
    async onEvent(action) {
      if (action === "open_meta_offer") return { metaState: initial };
      if (action === "commit_meta_transaction") {
        commitCalls += 1;
        throw new Error("response lost after discard commit");
      }
      throw new Error(`unexpected Merchant event: ${action}`);
    },
    async onResume() { return { metaState: adopted }; }
  });
  const runtime = await installRuntime(harness);
  await runtime.onMerchantOpen();
  assert.equal(runtime.onMerchantAction({ action: "discard_reserved", relicId: "vampfang" }), true);
  await waitFor(() => runtime.getRankedMerchantMutationState().status === "confirmed", "discard adoption did not confirm");
  assert.equal(commitCalls, 1);
  assert.equal(harness.merchantCompletions[0].adopted, true);
});
