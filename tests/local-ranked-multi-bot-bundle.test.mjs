import assert from "node:assert/strict";
import test from "node:test";

import { injectMultiBotTelemetry } from "../scripts/local-ranked-multi-bot-bundle.mjs";
import { assertNoLocalMultiBotTelemetry } from "../scripts/verify-pages-production-bundle.mjs";

const marker = "  window.DungeonOnlineV3GameBridge = Object.freeze({";
const source = `(() => {
  function buildObserverBotTraceText() { return "trace"; }
  function isObserverBotActive() { return true; }
  function setObserverBotEnabled() { return true; }
  const state = { observerBot: { lastDecision: "move" } };
${marker}
  });
})();`;

test("injects read-only Observer telemetry only into test bundles", () => {
  const instrumented = injectMultiBotTelemetry(source, "test");
  assert.match(instrumented, /__DUNGEON_MULTI_BOT_TELEMETRY__/u);
  assert.match(instrumented, /observerTrace: \(\) => buildObserverBotTraceText\(\)/u);
  assert.equal(injectMultiBotTelemetry(source, "release"), source);
});

test("fails closed when the game bridge marker drifts", () => {
  assert.throws(
    () => injectMultiBotTelemetry("(() => {})();", "test"),
    /game bridge marker/u
  );
});

test("production verification rejects a leaked local telemetry bridge", () => {
  assert.throws(
    () => assertNoLocalMultiBotTelemetry("window.__DUNGEON_MULTI_BOT_TELEMETRY__ = {};"),
    /must not contain local multi-bot telemetry/u
  );
  assert.doesNotThrow(() => assertNoLocalMultiBotTelemetry("window.DungeonOnlineV3GameBridge = {};"));
});
