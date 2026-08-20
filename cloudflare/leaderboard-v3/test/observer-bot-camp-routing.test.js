import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import {
  patchObserverBotCampStart,
  patchRankedEmergencyExtraction
} from "../../../scripts/online-v3-game-patches.mjs";

function runCampStart(onlineV3Ranked) {
  const original = `
    const calls = [];
    const state = {
      onlineV3Ranked: ${JSON.stringify(onlineV3Ranked)},
      relics: ["fang"],
      observerBot: { lastDecision: "" }
    };
    const window = {
      DungeonOnlineV3: {
        onCampStartRun(depth) { calls.push(["online", depth]); return true; }
      }
    };
    function chooseObserverBotCampStartDepth() { return 4; }
    function startRun(options) { calls.push(["local", options.startDepth]); }
    function runObserverBotCampAction() {
      const startDepth = chooseObserverBotCampStartDepth();
      startRun({ carriedRelics: [...state.relics], startDepth });
      state.observerBot.lastDecision = "camp_start_run";
      return true;
    }
    result = { accepted: runObserverBotCampAction(), calls, decision: state.observerBot.lastDecision };
  `;
  const source = patchObserverBotCampStart(original);
  const context = {};
  vm.runInNewContext(source, context);
  return context.result;
}

function runEmergencyExtraction(onlineV3Ranked) {
  const original = `
    const calls = [];
    const state = {
      onlineV3Ranked: ${JSON.stringify(onlineV3Ranked)},
      player: { gold: 70 },
      extractConfirm: { forced: true }
    };
    function getEmergencyExtractLossRatio() { return 0.7; }
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function pushLog() {}
    function extractRun(options) { calls.push({ goldAtBoundary: state.player.gold, options }); }
    function confirmEmergencyExtract() {
      if (!state.extractConfirm) return false;
      const lossRatio = clamp(
        Number(state.extractConfirm.lossRatio) || getEmergencyExtractLossRatio(),
        0,
        0.95
      );
      const keepRatio = 1 - lossRatio;
      const currentGold = Math.max(0, state.player.gold);
      const keptGold = Math.max(0, Math.floor(currentGold * keepRatio));
      const lostGold = currentGold - keptGold;
      state.player.gold = keptGold;
      state.extractConfirm = null;
      pushLog(\`Emergency extract: lost \${lostGold} gold, kept \${keptGold}.\`, "bad");
      extractRun({ forced: true });
      return true;
    }
    result = { accepted: confirmEmergencyExtract(), calls, finalGold: state.player.gold };
  `;
  const context = {};
  vm.runInNewContext(patchRankedEmergencyExtraction(original), context);
  return context.result;
}

test("Observer Bot Camp build patch is safe to apply more than once", () => {
  const original = `
    const startDepth = chooseObserverBotCampStartDepth();
    startRun({ carriedRelics: [...state.relics], startDepth });
    state.observerBot.lastDecision = "camp_start_run";
  `;
  const patched = patchObserverBotCampStart(original);
  assert.equal(patchObserverBotCampStart(patched), patched);
});

test("Pages patch applies to the canonical game source", async () => {
  const game = await readFile(new URL("../../../game.js", import.meta.url), "utf8");
  const patched = patchObserverBotCampStart(game);
  assert.match(
    patched,
    /function runObserverBotCampAction\(\)[\s\S]*if \(state\.onlineV3Ranked\)[\s\S]*onCampStartRun\?\.\(startDepth\)[\s\S]*else \{[\s\S]*startRun\(\{ carriedRelics/u
  );
});

test("Ranked Observer Bot starts its post-extraction run through the canonical Camp boundary", () => {
  const result = runCampStart(true);
  assert.equal(result.accepted, true);
  assert.deepEqual(Array.from(result.calls, (entry) => Array.from(entry)), [["online", 4]]);
  assert.equal(result.decision, "camp_start_run");
});

test("Practice Observer Bot keeps using the local Camp start", () => {
  const result = runCampStart(false);
  assert.equal(result.accepted, true);
  assert.deepEqual(Array.from(result.calls, (entry) => Array.from(entry)), [["local", 4]]);
});

test("Ranked emergency extraction captures the room boundary before applying any local gold loss", () => {
  const result = runEmergencyExtraction(true);

  assert.equal(result.accepted, true);
  assert.equal(result.calls[0].goldAtBoundary, 70);
  assert.equal(result.finalGold, 70);
});

test("Practice emergency extraction keeps its local gold-loss behavior", () => {
  const result = runEmergencyExtraction(false);

  assert.equal(result.accepted, true);
  assert.equal(result.calls[0].goldAtBoundary, 21);
  assert.equal(result.finalGold, 21);
});

test("Pages emergency extraction patch applies to the canonical game source", async () => {
  const game = await readFile(new URL("../../../game.js", import.meta.url), "utf8");
  const builder = await readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");
  const patched = patchRankedEmergencyExtraction(game);

  assert.equal(patchRankedEmergencyExtraction(patched), patched);
  assert.match(builder, /game = patchRankedEmergencyExtraction\(game\)/u);
  assert.match(
    patched,
    /if \(state\.onlineV3Ranked\)[\s\S]*extractRun\(\{ forced: true \}\)[\s\S]*const keptGold/u
  );
});

test("Pages bridge exposes persisted test controls as an assistance requirement", async () => {
  const builder = await readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");

  assert.match(
    builder,
    /requiresRankedTestAssistance\(\)[\s\S]*state\.onlineV3Ranked && state\.onlineV3TestBotUnlocked/u
  );
});
