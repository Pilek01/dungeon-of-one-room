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


function generatedMerchantActionRunner(game, decision) {
  const start = game.indexOf("function runObserverMerchantAction()");
  const end = game.indexOf("function shouldObserverBotEmergencyExtractNow", start);
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
  assert.equal(replacement.result, true);
  assert.deepEqual(replacement.calls, [{
    kind: "action",
    request: { action: "relic_purchase", relicId: "vampfang", removalRelicId: "fang" }
  }]);
  const claim = generatedMerchantActionRunner(game, {
    action: "claim_reserved",
    request: { action: "claim_reserved", relicId: "idol", removalRelicId: "fang" },
    reason: "useful_upgrade"
  });
  assert.equal(claim.result, true);
  assert.deepEqual(claim.calls, [{
    kind: "action",
    request: { action: "claim_reserved", relicId: "idol", removalRelicId: "fang" }
  }]);
});

test("generated Ranked policy marks the Merchant visit done after requesting leave", async () => {
  const game = await source("game.js");
  const result = generatedMerchantActionRunner(game, {
    action: "leave",
    request: { action: "leave" },
    reason: "purchase_limit"
  });
  assert.equal(result.result, false);
  assert.deepEqual(result.calls, [{ kind: "leave" }]);
});

test("Ranked Merchant leave checkpoints a local directive at most once", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const merchantLeave = functionBody(runtime, "onMerchantLeave", "availableCampChoices");
  let checkpoints = 0;
  const context = {
    activeRoomDirectiveId: "merchant-directive-3",
    merchantLeaveCompletedDirectiveId: "",
    merchantMutationPending: false,
    currentMerchantOffer: null,
    pendingRoomSummary: null,
    pendingBoundaryExit: null,
    root: {
      DungeonOnlineV3GameBridge: {
        beginRankedMerchantRequest() {},
        syncCanonicalProjection() {},
        enterNextDirective() {}
      }
    },
    merchantChoiceFor: () => null,
    createClient: () => ({ event: async () => ({ metaState: {} }) }),
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
