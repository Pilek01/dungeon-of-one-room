import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const protocol = require("../../../online-v3/ranked-v3-protocol.js");
const LEGACY_HASHES = Object.freeze([
  "sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711",
  "sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3",
  "sha256:7027a84ff06d6d9304e3d8e4343dbd6b3071c8bec734fad10b85981fa92347e8",
  "sha256:e4175a6cb29f576a3ad85357a433d6595eb7e9d19a6c5f47ed125ecfe9ae538e",
  "sha256:31124ece34ef1c82a28bb977467d169eade8b34c0c13360d7054ab1684e5fe36",
  "sha256:956251f158e55a0a47f9e43d5680d9aae66a22045c833bd76b8798cdc00e012e",
  "sha256:08dfa4f97d91b4f21dbfae7232246125ddbbc6a0270cf81a9e1ed012e5f5d403",
  "sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6"
]);
const SUPPORTING_HASH = "sha256:3f6044453414e636c6a41f40ceaf00dc221624ea54af2f61489b930b27c628e3";

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

function createHarness(rulesetHash) {
  const calls = [];
  let snapshot = {
    publicState: {
      status: "active",
      rulesetHash,
      currentRoomDirective: {
        directiveId: "directive_1",
        depth: 1,
        roomType: "combat"
      }
    }
  };
  const nextState = {
    status: "active",
    rulesetHash,
    currentRoomDirective: {
      directiveId: "directive_2",
      depth: 2,
      roomType: "combat"
    }
  };
  const client = {
    getSnapshot() { return snapshot; },
    async event(action, payload) {
      calls.push({ action, payload });
      snapshot = { publicState: nextState };
      return { metaState: nextState };
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
  const ui = {
    entry: element(),
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
    DungeonRankedV3Protocol: protocol,
    DungeonRankedV3Client: {
      createRankedClient() { return client; },
      createLeaderboardClient() { return {}; },
      async sha256Hex() { return "hash"; }
    },
    DungeonRankedV3Directives: {
      applyOnlineV3RoomDirective(directive) { return directive; }
    },
    DungeonRankedV3Offers: {
      relicChoices() { return []; },
      replacementChoices() { return []; },
      metaChoices() { return []; },
      pendingRewardSlots() { return []; },
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
      isRanked() { return true; },
      isRankedTestBotActive() { return false; },
      syncCanonicalProjection() {},
      resumeAfterFatal() {},
      resumePreventedFatal() {}
    }
  };
  return { root, calls };
}

async function captureFatalPayload(rulesetHash, options = {}) {
  const harness = createHarness(rulesetHash);
  const source = await readFile(new URL("../../../online-v3/ranked-v3-runtime.js", import.meta.url), "utf8");
  vm.runInNewContext(source, harness.root, { filename: "ranked-v3-runtime.js" });
  if (options.elixir) {
    assert.equal(harness.root.DungeonOnlineV3.onElixirUsed({ elixirId: "ember" }), true);
  }
  await harness.root.DungeonOnlineV3.onFatalEvent({ reason: options.reason });
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.calls[0].action, "report_fatal_event");
  return JSON.parse(JSON.stringify(harness.calls[0].payload));
}

test("fatal presentation capability is explicit and fail-closed for production history", () => {
  assert.equal(typeof protocol.supportsFatalPresentationCause, "function");
  for (const hash of LEGACY_HASHES) {
    assert.equal(protocol.supportsFatalPresentationCause(hash), false, hash);
  }
  assert.equal(protocol.supportsFatalPresentationCause(SUPPORTING_HASH), true);
  assert.equal(protocol.supportsFatalPresentationCause("sha256:unknown"), false);
});


test("a patched non-production compiled ruleset hash opts into presentation cause", async () => {
  const source = await readFile(new URL("../../../online-v3/ranked-v3-protocol.js", import.meta.url), "utf8");
  const candidateHash = "sha256:7eb0f0a14ada566c5d161563d310a8635d1bc7c55e6bfbee2531124e205e77df";
  const patched = source.replace(
    `const RULESET_HASH = "${protocol.RULESET_HASH}";`,
    `const RULESET_HASH = "${candidateHash}";`
  );
  assert.notEqual(patched, source);
  const context = { module: { exports: {} } };
  vm.runInNewContext(patched, context, { filename: "ranked-v3-protocol-local.js" });
  assert.equal(context.module.exports.RULESET_HASH, candidateHash);
  assert.equal(context.module.exports.supportsFatalPresentationCause(candidateHash), true);
});
test("bc0d fatal payload omits presentation cause with and without elixir usage", async () => {
  assert.deepEqual(
    await captureFatalPayload(LEGACY_HASHES[0], { reason: "You bled out." }),
    { classification: "local_fatal_event" }
  );
  assert.deepEqual(
    await captureFatalPayload(LEGACY_HASHES[0], { elixir: true, reason: "You bled out." }),
    {
      classification: "local_fatal_event",
      elixirUsage: { elixirId: "ember", count: 1 }
    }
  );
});

test("supporting fatal payload normalizes presentation cause with and without elixir usage", async () => {
  assert.deepEqual(
    await captureFatalPayload(SUPPORTING_HASH, { reason: " \u0001You   bled\tout. \u007f " }),
    {
      classification: "local_fatal_event",
      presentationCause: "You bled out."
    }
  );
  assert.deepEqual(
    await captureFatalPayload(SUPPORTING_HASH, { elixir: true, reason: "You bled out." }),
    {
      classification: "local_fatal_event",
      elixirUsage: { elixirId: "ember", count: 1 },
      presentationCause: "You bled out."
    }
  );
  assert.deepEqual(
    await captureFatalPayload(SUPPORTING_HASH, { reason: "x".repeat(161) }),
    {
      classification: "local_fatal_event",
      presentationCause: "x".repeat(160)
    }
  );
});
