const BRIDGE_MARKER = "  window.DungeonOnlineV3GameBridge = Object.freeze({";

export function injectMultiBotTelemetry(source, target) {
  if (target === "release") return String(source);
  if (target !== "test") throw new TypeError("Unknown Pages build target.");

  const text = String(source);
  if (text.split(BRIDGE_MARKER).length !== 2) {
    throw new Error("Expected exactly one game bridge marker for multi-bot telemetry.");
  }

  const hook = `  window.__DUNGEON_MULTI_BOT_TELEMETRY__ = Object.freeze({
    relicName: (relicId) => String(getRelicById(relicId)?.name || relicId || ""),
    observerTrace: () => buildObserverBotTraceText(),
    observerState: () => ({
      enabled: isObserverBotActive(),
      lastDecision: String(state.observerBot?.lastDecision || "idle"),
      lastPolicy: String(state.observerBot?.lastPolicy || "default"),
      loopPingPongActive: Boolean(state.observerBot?.loopPingPongActive),
      loopPingPongTicks: Math.max(0, Number(state.observerBot?.loopPingPongTicks) || 0),
      loopAcolytePingPongTicks: Math.max(0, Number(state.observerBot?.loopAcolytePingPongTicks) || 0)
    }),
    stopObserverBot: () => setObserverBotEnabled(false, { silent: true })
  });

`;

  return text.replace(BRIDGE_MARKER, hook + BRIDGE_MARKER);
}
