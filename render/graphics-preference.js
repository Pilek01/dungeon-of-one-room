(function attachGraphicsPreference(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DungeonGraphicsPreference = api;
})(typeof window !== "undefined" ? window : null, function createGraphicsPreferenceApi() {
  "use strict";

  const STORAGE_KEY = "dungeonOneRoomGraphicsMode";
  const MODES = Object.freeze(["hd", "classic"]);

  function normalizeMode(value, fallback = "classic") {
    const normalizedFallback = String(fallback || "").trim().toLowerCase() === "hd" ? "hd" : "classic";
    const normalized = String(value || "").trim().toLowerCase();
    return MODES.includes(normalized) ? normalized : normalizedFallback;
  }

  function defaultMode(hdEnabled) {
    return hdEnabled ? "hd" : "classic";
  }

  function readPreference(storage, hdEnabled) {
    const fallback = defaultMode(hdEnabled);
    if (!storage || typeof storage.getItem !== "function") return fallback;
    try {
      return normalizeMode(storage.getItem(STORAGE_KEY), fallback);
    } catch (_error) {
      return fallback;
    }
  }

  function writePreference(storage, mode) {
    const normalized = normalizeMode(mode, "classic");
    if (!storage || typeof storage.setItem !== "function") return normalized;
    try {
      storage.setItem(STORAGE_KEY, normalized);
    } catch (_error) {
      // A blocked storage backend must not block the renderer switch.
    }
    return normalized;
  }

  function isHd(mode) {
    return normalizeMode(mode, "classic") === "hd";
  }

  return Object.freeze({
    STORAGE_KEY,
    MODES,
    normalizeMode,
    defaultMode,
    readPreference,
    writePreference,
    isHd
  });
});
