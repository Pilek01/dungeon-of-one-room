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
    status: "active",
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
      const response = { metaState: metaState() };
      snapshot = { publicState: response.metaState };
      return response;
    },
    releaseWriter() {},
    clear() {}
  };
  const states = {
    abandoned: "ABANDONED",
    active: "ROOM_ACTIVE",
    offer: "AWAITING_REWARD_OR_TRANSACTION",
    resolving: "RESOLVING_ROOM",
    next: "ENTERING_NEXT_ROOM",
    terminal: "TERMINAL",
    finalized: "FINALIZED",
    starting: "STARTING",
    startingRelic: "STARTING_RELIC",
    retrying: "RETRYING",
    finalizing: "FINALIZING"
  };
  const store = {
    clearSession() {},
    clearWriterLease() {},
    clearRecovery() {},
    clearProfile() {},
    loadRecovery() { return null; },
    loadProfile() { return null; },
    getInstallationId() { return "installation"; }
  };
  const uiEntry = element();
  const ui = {
    entry: uiEntry,
    overlay: element(),
    button() { return element(); },
    hide() {},
    setStatus() {},
    setEntryVisible() {},
    showChoices() {},
    showMenu() {},
    showMessage() {},
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
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    crypto: {
      randomUUID() { return "00000000-0000-4000-8000-000000000000"; }
    },
    addEventListener() {},
    setInterval() { return 0; },
    DungeonRankedV3Protocol: {
      isSupportedRulesetHash() { return true; }
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
      isRankedTestBotActive() { return true; },
      syncCanonicalProjection() {},
      setNextDirective(directive) { directives.push(directive); }
    }
  };
  return { root, calls, directives };
}

async function installRuntime(harness) {
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
