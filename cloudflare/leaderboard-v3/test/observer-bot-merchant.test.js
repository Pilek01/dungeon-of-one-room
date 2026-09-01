import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const GENERATED_ROOT = new URL("../../../output/pages-test-dist/", import.meta.url);
let generatedBuild;

async function ensureGeneratedBuild() {
  if (generatedBuild) return generatedBuild;
  generatedBuild = Promise.resolve().then(() => {
    if (existsSync(path.join(ROOT_PATH, "output", "pages-test-dist", "game.js"))) return;
    const result = spawnSync(process.execPath, [
      path.join(ROOT_PATH, "scripts", "build-pages-v3.mjs"),
      "--target",
      "test"
    ], { cwd: ROOT_PATH, encoding: "utf8" });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });
  return generatedBuild;
}

async function source(name) {
  await ensureGeneratedBuild();
  return readFile(new URL(name, GENERATED_ROOT), "utf8");
}

function functionBody(text, name, nextName) {
  const start = text.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = text.indexOf(`function ${nextName}`, start);
  assert.ok(end > start, `missing ${nextName} boundary`);
  return text.slice(start, end);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("Ranked Observer Bot opens the canonical Merchant offer before choosing a skill", async () => {
  const game = await source("game.js");
  const merchantAction = functionBody(
    game,
    "runObserverMerchantAction",
    "shouldObserverBotEmergencyExtractNow"
  );
  const openIndex = merchantAction.indexOf("openMerchantMenu()");
  const firstPurchaseIndex = merchantAction.search(/tryBuy(?:Potion|SkillUpgrade)FromMerchant\(/u);

  assert.ok(
    openIndex >= 0,
    "Ranked bot must request the server-issued Merchant offer before attempting a purchase"
  );
  assert.ok(
    firstPurchaseIndex >= 0 && openIndex < firstPurchaseIndex,
    "Merchant offer opening must precede every bot purchase attempt"
  );
});

test("a missing Merchant choice cannot be counted as a successful bot purchase", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const merchantAction = functionBody(
    runtime,
    "onMerchantAction",
    "onMerchantLeave"
  );
  const noChoice = merchantAction.match(/if \(!choice\) \{([\s\S]*?)\n\s*\}/u)?.[1] || "";

  assert.match(noChoice, /failRankedMerchantRequest/u);
  assert.doesNotMatch(
    noChoice,
    /return true;/u,
    "a rejected/no-offer action must not report success to the bot purchase counter"
  );
});

test("Ranked Merchant bot actions wait while the canonical open or commit is pending", async () => {
  const game = await source("game.js");
  const botStep = functionBody(
    game,
    "runObserverBotStep",
    "updateObserverBot"
  );

  assert.match(
    botStep,
    /state\.onlineV3Ranked[\s\S]{0,220}(?:state\.turnInProgress|isRankedAutomationBlocked|isObserverBotBoundaryPending)/u,
    "the Ranked bot must stop issuing Merchant actions while the canonical request is unresolved"
  );
});

test("a room-attached Merchant offer enters the Merchant directive instead of the generic choice overlay", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const boundary = functionBody(runtime, "continueBoundary", "continueResolvedCheckpoint")
    .replace(/\s*async\s*$/u, "");
  const calls = [];
  const context = {
    pendingRoomSummary: null,
    pendingBoundaryExit: null,
    root: {
      DungeonOnlineV3GameBridge: {
        syncCanonicalProjection() { calls.push("sync"); },
        setNextDirective(directive) { calls.push({ kind: "directive", directive }); }
      },
      DungeonRankedV3Session: {
        STATES: { offer: "OFFER", resolving: "RESOLVING", active: "ACTIVE", next: "NEXT" }
      }
    },
    isCurrentBoundaryOperation: () => true,
    hasRoomAttachedMerchantOffer: (state) => (
      state?.metaTransactionOffer?.sourceType === "merchant" &&
      state?.currentRoomDirective?.roomType === "merchant" &&
      state.currentRoomDirective.consumed !== true
    ),
    presentReplacement() { calls.push("replacement"); },
    presentRelicOffer() { calls.push("relic"); },
    presentMetaOffer() { calls.push("generic-meta"); },
    offers: { pendingRewardSlots: () => [] },
    isOtterCrimsonSlot: () => false,
    presentOtterCrimsonChest: () => false,
    issueRelicSlot() {},
    resolveCheckpoint() {},
    usesBoundarySettlement: () => true,
    directives: { applyOnlineV3RoomDirective: (directive) => directive },
    session: {
      getState: () => "ACTIVE",
      transition(next) { calls.push({ kind: "transition", next }); }
    },
    ui: { hide() { calls.push("hide"); } }
  };
  const runBoundary = vm.runInNewContext(`(async ${boundary})`, context);
  const directive = { directiveId: "merchant-room-4", roomType: "merchant", depth: 4 };
  await runBoundary({
    currentRoomDirective: directive,
    metaTransactionOffer: { sourceType: "merchant", choices: [] }
  });

  assert.equal(calls.includes("generic-meta"), false);
  assert.deepEqual(calls.find((entry) => entry?.kind === "directive")?.directive, directive);
  assert.equal(calls.find((entry) => entry?.kind === "transition")?.next, "NEXT");
});

test("opening a Ranked Merchant reuses its canonical room-attached offer without a second network request", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const merchantOpen = functionBody(runtime, "onMerchantOpen", "merchantErrorIsDeterministic");
  const offer = { sourceType: "merchant", sourceId: "merchant-room-4", choices: [] };
  const publicState = { currentRoomDirective: { roomType: "merchant" }, metaTransactionOffer: offer };
  let presented = null;
  let errors = 0;
  const context = {
    merchantMutationPending: false,
    currentMerchantOffer: null,
    hasRoomAttachedMerchantOffer: (state) => (
      state?.metaTransactionOffer?.sourceType === "merchant" &&
      state?.currentRoomDirective?.roomType === "merchant" &&
      state.currentRoomDirective.consumed !== true
    ),
    root: { DungeonOnlineV3GameBridge: { beginRankedMerchantRequest() {} } },
    createClient: () => ({
      getSnapshot: () => ({ publicState }),
      async event() { throw new Error("duplicate open_meta_offer"); }
    }),
    presentNativeMerchant(state) { presented = state; },
    presentMerchantError() { errors += 1; }
  };
  const openMerchant = vm.runInNewContext(`(async ${merchantOpen})`, context);

  assert.equal(await openMerchant(), true);
  assert.equal(errors, 0);
  assert.equal(presented, publicState);
});

test("native Merchant presentation normalizes a recovered offer state back to ROOM_ACTIVE", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const nativeMerchant = functionBody(runtime, "presentNativeMerchant", "presentMerchantError");
  const transitions = [];
  let current = "OFFER";
  let entered = false;
  const context = {
    currentMerchantOffer: null,
    merchantResetForOffer() {},
    session: {
      getState: () => current,
      transition(next) { transitions.push(next); current = next; }
    },
    root: {
      DungeonRankedV3Session: {
        STATES: { offer: "OFFER", resolving: "RESOLVING", active: "ACTIVE" }
      },
      DungeonOnlineV3GameBridge: {
        enterRankedMerchant() { entered = true; }
      }
    },
    ui: { hide() {} }
  };
  const present = vm.runInNewContext(`(${nativeMerchant})`, context);
  present({ metaTransactionOffer: { sourceType: "merchant", choices: [] } });

  assert.deepEqual(transitions, ["RESOLVING", "ACTIVE"]);
  assert.equal(current, "ACTIVE");
  assert.equal(entered, true);
});

test("Ranked Merchant exposes confirmed-only lifecycle callbacks and public mutation state", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  assert.match(runtime, /function completeRankedMerchantAction\(result\s*=\s*\{\}\)/u);
  assert.match(runtime, /function failRankedMerchantAction\(result\s*=\s*\{\}\)/u);
  assert.match(runtime, /function getRankedMerchantMutationState\(\)/u);
  assert.match(runtime, /getRankedMerchantMutationState,/u);
  assert.match(runtime, /merchantOperation\.status\s*=\s*"pending"/u);
  assert.doesNotMatch(
    runtime,
    /merchantPurchasesThisRoom\s*\+=\s*1/u,
    "runtime submission must never mutate the confirmed purchase counter"
  );
});

test("Merchant action submission uses a stable operation identity and resyncs uncertain transport", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  assert.match(runtime, /operationId:\s*merchantOperation\.operationId/u);
  assert.match(runtime, /resumeCanonical\(/u);
  assert.match(runtime, /failure_backoff/u);
  assert.match(runtime, /attempts\s*<\s*2/u);
});


function generatedMerchantActionRunner(game, decision, options = {}) {
  const start = game.indexOf("function runObserverMerchantAction()");
  const end = game.indexOf("\n  function ", start + 1);
  assert.ok(start >= 0 && end > start, "missing generated Observer Merchant action");
  const merchantAction = game.slice(start, end);
  const calls = [];
  const state = {
    phase: "playing",
    roomType: "merchant",
    onlineV3Ranked: true,
    merchantMenuOpen: true,
    turnInProgress: false,
    observerBot: {}
  };
  const context = {
    state,
    isOnMerchant: () => true,
    buildObserverMerchantDecision: () => decision,
    openMerchantMenu() { calls.push({ kind: "open" }); return true; },
    closeMerchantMenu() {
      calls.push({ kind: "close" });
      state.merchantMenuOpen = false;
      return true;
    },
    tryBuyPotionFromMerchant() { calls.push({ kind: "potion" }); return true; },
    tryBuySkillUpgradeFromMerchant() { calls.push({ kind: "skill" }); return true; },
    tryBuyRelicFromMerchant() { calls.push({ kind: "relic_wrapper" }); return true; },
    tryReserveRelicFromMerchant() { calls.push({ kind: "reserve_wrapper" }); return true; },
    tryBuyReservedRelicFromMerchant() { calls.push({ kind: "claim_wrapper" }); return true; },
    tryBuyFullHeal() { calls.push({ kind: "fullheal" }); return true; },
    tryBuyCombatBoost() { calls.push({ kind: "combatboost" }); return true; },
    tryBuySecondChance() { calls.push({ kind: "secondchance" }); return true; },
    tryBuyOneLife() { calls.push({ kind: "onelife" }); return true; },
    tryUseBlackMarket() { calls.push({ kind: "blackmarket" }); return true; },
    window: {
      DungeonOnlineV3: {
        getRankedAutomationBlockState: () => options.blockState || { blocked: false, reasons: [] },
        isRankedAutomationBlocked: () => false,
        isObserverBotBoundaryPending: () => false,
        onMerchantAction(request) { calls.push({ kind: "action", request }); return true; },
        onMerchantLeave() { calls.push({ kind: "leave" }); return true; }
      }
    }
  };
  const run = vm.runInNewContext(`(${merchantAction})`, context);
  return { result: run(), calls, state };
}

test("generated Ranked policy forwards exact replacement and reserved-claim requests without UI detours", async () => {
  const game = await source("game.js");
  const replacement = generatedMerchantActionRunner(game, {
    action: "relic_purchase",
    request: { action: "relic_purchase", relicId: "vampfang", removalRelicId: "fang" },
    reason: "useful_upgrade"
  });
  assert.deepEqual(plain(replacement.result), { status: "acted", reason: "relic_purchase" });
  assert.deepEqual(replacement.calls, [{
    kind: "action",
    request: { action: "relic_purchase", relicId: "vampfang", removalRelicId: "fang" }
  }]);
  const claim = generatedMerchantActionRunner(game, {
    action: "claim_reserved",
    request: { action: "claim_reserved", relicId: "idol", removalRelicId: "fang" },
    reason: "useful_upgrade"
  });
  assert.deepEqual(plain(claim.result), { status: "acted", reason: "claim_reserved" });
  assert.deepEqual(claim.calls, [{
    kind: "action",
    request: { action: "claim_reserved", relicId: "idol", removalRelicId: "fang" }
  }]);
});

test("generated Ranked policy closes the native Merchant before the bot walks to the portal", async () => {
  const game = await source("game.js");
  const result = generatedMerchantActionRunner(game, {
    action: "leave",
    request: { action: "leave" },
    reason: "purchase_limit"
  });
  assert.deepEqual(plain(result.result), { status: "done", reason: "purchase_limit" });
  assert.deepEqual(result.calls, [{ kind: "close" }]);
  assert.equal(result.state.merchantMenuOpen, false);
});

test("generated Ranked Merchant reports waiting separately from completion", async () => {
  const game = await source("game.js");
  const result = generatedMerchantActionRunner(game, {
    action: "leave",
    request: { action: "leave" },
    reason: "failure_backoff"
  }, {
    blockState: { blocked: true, reasons: ["merchant_operation_pending"] }
  });

  assert.deepEqual(plain(result.result), {
    status: "waiting",
    reason: "merchant_operation_pending"
  });
  assert.deepEqual(result.calls, []);
  assert.equal(result.state.merchantMenuOpen, true);
});

test("safe Merchant backoff is terminal for purchasing but does not globally block leaving", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const blockStateSource = functionBody(
    runtime,
    "getRankedAutomationBlockState",
    "isRankedAutomationBlocked"
  );
  const context = {
    isRankedObserverBotActive: () => true,
    observerBotBoundaryPending: false,
    observerBotAutomationHalted: false,
    session: { getState: () => "ROOM_ACTIVE" },
    root: {
      DungeonRankedV3Session: {
        isObserverAutomationTransitionState: () => false
      },
      DungeonOnlineV3GameBridge: {
        isRankedCanonicalLifeRestartReady: () => false
      }
    },
    merchantOperation: {
      status: "backoff",
      reason: "insufficient_wallet",
      leaveAllowed: true
    },
    merchantExitOperation: null,
    boundaryOperation: null,
    campMutationPending: false,
    merchantMutationPending: false,
    metaMutationPending: false,
    forgeMutationPending: false,
    pendingNativeRelicReplacement: null
  };
  const getBlockState = vm.runInNewContext(`(${blockStateSource})`, context);

  assert.deepEqual(plain(getBlockState()), {
    blocked: false,
    reasons: [],
    sessionState: "ROOM_ACTIVE",
    merchantOperation: {
      status: "backoff",
      action: "",
      reason: "insufficient_wallet",
      operationId: "",
      leaveAllowed: true
    }
  });
});

test("Ranked Merchant leave proceeds after a safe local backoff", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const merchantLeave = functionBody(runtime, "onMerchantLeave", "availableCampChoices");
  let checkpoints = 0;
  let leaveCommits = 0;
  const offer = {
    sourceType: "merchant",
    choices: [{
      kind: "leave",
      transactionId: "merchant-transaction-safe-backoff",
      choiceId: "merchant-leave-safe-backoff",
      status: "available"
    }]
  };
  const publicState = {
    currentRoomDirective: {
      directiveId: "merchant-directive-safe-backoff",
      roomType: "merchant",
      consumed: false
    },
    metaTransactionOffer: offer
  };
  const context = {
    activeRoomDirectiveId: "merchant-directive-safe-backoff",
    merchantLeaveCompletedDirectiveId: "",
    merchantMutationPending: false,
    merchantMutationFlight: null,
    merchantExitOperation: null,
    merchantOperation: { status: "backoff", leaveAllowed: true },
    currentMerchantOffer: offer,
    pendingRoomSummary: null,
    pendingBoundaryExit: null,
    boundaryOperation: null,
    root: {
      DungeonOnlineV3GameBridge: {
        beginRankedMerchantRequest() {},
        syncCanonicalProjection() {},
        enterNextDirective() {}
      }
    },
    merchantChoiceFor: () => offer.choices[0],
    createClient: () => ({
      getSnapshot: () => ({ publicState }),
      async event() {
        leaveCommits += 1;
        return {
          metaState: {
            currentRoomDirective: { ...publicState.currentRoomDirective, consumed: true },
            metaTransactionOffer: null
          }
        };
      }
    }),
    hasRoomAttachedMerchantOffer: (state) => Boolean(
      state?.metaTransactionOffer?.sourceType === "merchant" &&
      state?.currentRoomDirective?.roomType === "merchant" &&
      state.currentRoomDirective.consumed !== true
    ),
    usesBoundarySettlement: () => true,
    captureRankedBoundary: () => ({ summary: { turnCount: 0 } }),
    mergeCapturedBoundary: (captured) => captured,
    resolveCheckpoint: async () => { checkpoints += 1; return true; },
    presentMerchantError() {}
  };
  const leave = vm.runInNewContext(`(async ${merchantLeave})`, context);

  assert.equal(await leave({ enterPortal: true }), true);
  assert.equal(leaveCommits, 1);
  assert.equal(checkpoints, 1);
});

test("Ranked Merchant leave checkpoints a local directive at most once", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const merchantLeave = functionBody(runtime, "onMerchantLeave", "availableCampChoices");
  let checkpoints = 0;
  const context = {
    activeRoomDirectiveId: "merchant-directive-3",
    merchantLeaveCompletedDirectiveId: "",
    merchantMutationPending: false,
    merchantMutationFlight: null,
    merchantExitOperation: null,
    merchantOperation: null,
    currentMerchantOffer: null,
    pendingRoomSummary: null,
    pendingBoundaryExit: null,
    boundaryOperation: null,
    root: {
      DungeonOnlineV3GameBridge: {
        beginRankedMerchantRequest() {},
        syncCanonicalProjection() {},
        enterNextDirective() {}
      }
    },
    merchantChoiceFor: () => null,
    createClient: () => ({ event: async () => ({ metaState: {} }) }),
    hasRoomAttachedMerchantOffer: () => false,
    usesBoundarySettlement: () => true,
    captureRankedBoundary: () => ({ summary: { turnCount: 0 } }),
    mergeCapturedBoundary: (captured) => captured,
    resolveCheckpoint: async () => { checkpoints += 1; return true; },
    presentMerchantError() {}
  };
  const leave = vm.runInNewContext(`(async ${merchantLeave})`, context);

  assert.equal(await leave(), true);
  assert.equal(await leave(), true);
  assert.equal(checkpoints, 1);
});

test("consecutive Ranked Merchant directives checkpoint independently", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const merchantLeave = functionBody(runtime, "onMerchantLeave", "availableCampChoices");
  const checkpoints = [];
  const context = {
    activeRoomDirectiveId: "merchant-directive-first",
    merchantLeaveCompletedDirectiveId: "",
    merchantMutationPending: false,
    merchantMutationFlight: null,
    merchantExitOperation: null,
    merchantOperation: null,
    currentMerchantOffer: null,
    pendingRoomSummary: null,
    pendingBoundaryExit: null,
    boundaryOperation: null,
    root: {
      DungeonOnlineV3GameBridge: {
        beginRankedMerchantRequest() {},
        syncCanonicalProjection() {},
        enterNextDirective() {}
      }
    },
    merchantChoiceFor: () => null,
    createClient: () => ({ event: async () => ({ metaState: {} }) }),
    hasRoomAttachedMerchantOffer: () => false,
    usesBoundarySettlement: () => true,
    captureRankedBoundary: () => ({ summary: { turnCount: 0 } }),
    mergeCapturedBoundary: (captured) => captured,
    resolveCheckpoint: async () => {
      checkpoints.push(context.activeRoomDirectiveId);
      if (context.activeRoomDirectiveId === "merchant-directive-first") {
        context.activeRoomDirectiveId = "merchant-directive-second";
      }
      return true;
    },
    presentMerchantError() {}
  };
  const leave = vm.runInNewContext(`(async ${merchantLeave})`, context);

  assert.equal(await leave({ enterPortal: true }), true);
  assert.equal(context.merchantLeaveCompletedDirectiveId, "merchant-directive-first");
  assert.equal(await leave({ enterPortal: true }), true);
  assert.deepEqual(checkpoints, ["merchant-directive-first", "merchant-directive-second"]);
});

test("Ranked Merchant leave waits for the previous room boundary before checkpointing", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const merchantLeave = functionBody(runtime, "onMerchantLeave", "availableCampChoices");
  let checkpoints = 0;
  let previousBoundaryResolved = false;
  let resolvePreviousBoundary;
  const context = {
    activeRoomDirectiveId: "merchant-directive-9",
    merchantLeaveCompletedDirectiveId: "",
    merchantMutationPending: false,
    merchantMutationFlight: null,
    merchantExitOperation: null,
    merchantOperation: null,
    currentMerchantOffer: null,
    pendingRoomSummary: null,
    pendingBoundaryExit: null,
    boundaryOperation: null,
    root: {
      DungeonOnlineV3GameBridge: {
        beginRankedMerchantRequest() {},
        syncCanonicalProjection() {},
        enterNextDirective() {}
      }
    },
    merchantChoiceFor: () => null,
    createClient: () => ({ event: async () => ({ metaState: {} }) }),
    hasRoomAttachedMerchantOffer: () => false,
    usesBoundarySettlement: () => true,
    captureRankedBoundary: () => ({ summary: { turnCount: 0 } }),
    mergeCapturedBoundary: (captured) => captured,
    resolveCheckpoint: async () => {
      checkpoints += 1;
      return true;
    },
    presentMerchantError() {}
  };
  const previousBoundaryPromise = new Promise((resolve) => {
    resolvePreviousBoundary = () => {
      previousBoundaryResolved = true;
      context.boundaryOperation = null;
      resolve(true);
    };
  });
  context.boundaryOperation = { promise: previousBoundaryPromise };
  const leave = vm.runInNewContext(`(async ${merchantLeave})`, context);

  const resultPromise = leave({ enterPortal: true });
  await Promise.resolve();
  const checkpointsBeforePreviousBoundary = checkpoints;
  resolvePreviousBoundary();

  assert.equal(await resultPromise, true);
  assert.equal(previousBoundaryResolved, true);
  assert.equal(checkpointsBeforePreviousBoundary, 0);
  assert.equal(checkpoints, 1);
  assert.equal(context.pendingBoundaryExit, "portal");
});

test("Ranked Merchant leave requested during a purchase is queued and checkpoints once", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const merchantLeave = functionBody(runtime, "onMerchantLeave", "availableCampChoices");
  let finishPurchase;
  let checkpoints = 0;
  const purchaseFlight = new Promise((resolve) => { finishPurchase = resolve; });
  const context = {
    activeRoomDirectiveId: "merchant-directive-race",
    merchantLeaveCompletedDirectiveId: "",
    merchantMutationPending: true,
    merchantMutationFlight: purchaseFlight,
    merchantExitOperation: null,
    merchantOperation: null,
    currentMerchantOffer: null,
    pendingRoomSummary: null,
    pendingBoundaryExit: null,
    boundaryOperation: null,
    root: {
      DungeonOnlineV3GameBridge: {
        beginRankedMerchantRequest() {},
        syncCanonicalProjection() {},
        enterNextDirective() {}
      }
    },
    merchantChoiceFor: () => null,
    createClient: () => ({ event: async () => ({ metaState: {} }) }),
    hasRoomAttachedMerchantOffer: () => false,
    usesBoundarySettlement: () => true,
    captureRankedBoundary: () => ({ summary: { turnCount: 0 } }),
    mergeCapturedBoundary: (captured) => captured,
    resolveCheckpoint: async () => { checkpoints += 1; return true; },
    presentMerchantError() {}
  };
  const leave = vm.runInNewContext(`(async ${merchantLeave})`, context);

  const first = leave({ enterPortal: true });
  const duplicate = leave({ enterPortal: true });
  await Promise.resolve();
  assert.equal(checkpoints, 0, "the checkpoint must wait for the purchase result");
  finishPurchase(true);

  assert.equal(await first, true);
  assert.equal(await duplicate, true);
  assert.equal(checkpoints, 1, "duplicate portal callbacks must share one leave flight");
  assert.equal(context.pendingBoundaryExit, "portal");
});

test("normal and emergency extraction from Merchant use the canonical Merchant exit", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const extraction = functionBody(runtime, "onExtraction", "resumeRanked")
    .replace(/\s*async\s*$/u, "");
  const merchantExits = [];
  let genericBoundaries = 0;
  const context = {
    boundaryOperation: null,
    session: {
      getState: () => "ROOM_ACTIVE"
    },
    root: {
      DungeonRankedV3Session: {
        STATES: { resolving: "ROOM_RESOLVING" }
      },
      DungeonOnlineV3GameBridge: {
        beginRankedExtraction() {}
      }
    },
    createClient: () => ({
      getSnapshot: () => ({
        publicState: {
          currentRoomDirective: {
            directiveId: "merchant-extract-directive",
            roomType: "merchant",
            consumed: false
          }
        }
      })
    }),
    onMerchantLeave: async (options) => {
      merchantExits.push(options.extractionMode);
      return true;
    },
    usesBoundarySettlement: () => true,
    startBoundaryOperation: async () => {
      genericBoundaries += 1;
      return true;
    },
    presentError() {}
  };
  const extract = vm.runInNewContext(`(async ${extraction})`, context);

  assert.equal(await extract("normal"), true);
  assert.equal(await extract("emergency"), true);
  assert.deepEqual(merchantExits, ["normal", "emergency"]);
  assert.equal(genericBoundaries, 0);
});

test("generated Merchant completion consumes the offer and clears stale UI state", async () => {
  const game = await source("game.js");
  const start = game.indexOf("    completeRankedMerchantAction(result = {}) {");
  const end = game.indexOf("    failRankedMerchantAction(result = {}) {", start);
  assert.ok(start >= 0 && end > start, "missing generated Merchant completion bridge");
  const method = game.slice(start, end).trim().replace(/,\s*$/u, "");
  const state = {
    onlineV3Ranked: true,
    merchantMenuOpen: true,
    onlineV3MerchantChoices: [{ choiceId: "stale" }],
    merchantRelicSlot: { relicId: "vampfang" },
    merchantServiceSlot: { serviceId: "fullheal" },
    merchantRelicSwapPending: { relicId: "vampfang" },
    merchantLegendarySwapPending: { relicId: "vampfang" },
    merchantBuybackPending: { relicId: "fang" },
    blackMarketPending: { relicId: "idol" },
    merchantConfirmedReceiptKeys: [],
    observerBot: { merchantPurchasesThisRoom: 0 }
  };
  const complete = vm.runInNewContext(`({${method}}).completeRankedMerchantAction`, {
    state,
    markUiDirty() {}
  });
  assert.equal(complete({ receiptKey: "merchant-receipt-1", action: "relic_purchase", offerConsumed: true }), true);
  assert.equal(state.merchantMenuOpen, false);
  assert.equal(state.onlineV3MerchantChoices.length, 0);
  assert.equal(state.merchantRelicSlot, null);
  assert.equal(state.merchantServiceSlot, null);
  assert.equal(state.merchantRelicSwapPending, null);
  assert.equal(state.merchantLegendarySwapPending, null);
  assert.equal(state.merchantBuybackPending, null);
  assert.equal(state.blackMarketPending, null);
  assert.equal(state.merchantConfirmedReceiptKeys.length, 1);
  assert.equal(state.merchantConfirmedReceiptKeys[0], "merchant-receipt-1");
  assert.equal(complete({ receiptKey: "merchant-receipt-1", action: "relic_purchase", offerConsumed: true }), false);
  assert.equal(state.merchantConfirmedReceiptKeys.length, 1);
});
