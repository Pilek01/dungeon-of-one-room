(function exposeRankedV3Storage(root, factory) {
  "use strict";

  const api = factory();
  if (root) root.DungeonRankedV3Storage = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createStorageModule() {
  "use strict";

  const STORAGE_PREFIX = "dungeonRankedV3";
  const STORAGE_KEYS = Object.freeze({
    activeRun: `${STORAGE_PREFIX}:activeRun`,
    pendingCheckpoint: `${STORAGE_PREFIX}:pendingCheckpoint`,
    pendingEvents: `${STORAGE_PREFIX}:pendingEvents`,
    leaderboardCache: `${STORAGE_PREFIX}:leaderboardCache`,
    installationId: `${STORAGE_PREFIX}:installationId`
  });

  function isOwnedKey(key) {
    return typeof key === "string" && key.startsWith(STORAGE_PREFIX);
  }

  function serialize(value) {
    return JSON.stringify({
      storageVersion: 1,
      value
    });
  }

  function deserialize(text, fallback = null) {
    try {
      const decoded = JSON.parse(String(text));
      return decoded?.storageVersion === 1 ? decoded.value : fallback;
    } catch {
      return fallback;
    }
  }

  return Object.freeze({
    STORAGE_PREFIX,
    STORAGE_KEYS,
    isOwnedKey,
    serialize,
    deserialize
  });
});
