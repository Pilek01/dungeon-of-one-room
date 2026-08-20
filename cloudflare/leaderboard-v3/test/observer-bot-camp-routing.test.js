import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { patchObserverBotCampStart } from "../../../scripts/online-v3-game-patches.mjs";

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
