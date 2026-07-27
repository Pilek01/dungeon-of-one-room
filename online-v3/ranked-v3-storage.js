(function exposeRankedV3Storage(root, factory) {
  "use strict";

  const api = factory();
  if (root) root.DungeonRankedV3Storage = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createStorageModule() {
  "use strict";

  const STORAGE_VERSION = 2;
  const STORAGE_PREFIX = "dungeonRankedV3";
  const STORAGE_KEYS = Object.freeze({
    session: `${STORAGE_PREFIX}:sessionV2`,
    installationId: `${STORAGE_PREFIX}:installationIdV2`,
    leaderboardCache: `${STORAGE_PREFIX}:leaderboardCacheV2`,
    profile: `${STORAGE_PREFIX}:profileV1`,
    writerLease: `${STORAGE_PREFIX}:writerLeaseV1`,
    recovery: `${STORAGE_PREFIX}:recoveryV1`
  });

  function isOwnedKey(key) {
    return typeof key === "string" && key.startsWith(`${STORAGE_PREFIX}:`);
  }

  function serialize(value) {
    return JSON.stringify({ storageVersion: STORAGE_VERSION, value });
  }

  function deserialize(text, fallback = null) {
    try {
      const decoded = JSON.parse(String(text));
      return decoded?.storageVersion === STORAGE_VERSION ? decoded.value : fallback;
    } catch {
      return fallback;
    }
  }

  function createStore(storage) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new TypeError("RANKED_STORAGE_UNAVAILABLE");
    }
    return Object.freeze({
      loadSession() {
        return deserialize(storage.getItem(STORAGE_KEYS.session), null);
      },
      saveSession(snapshot) {
        storage.setItem(STORAGE_KEYS.session, serialize(snapshot));
      },
      clearSession() {
        storage.removeItem(STORAGE_KEYS.session);
      },
      loadProfile() {
        return deserialize(storage.getItem(STORAGE_KEYS.profile), null);
      },
      saveProfile(profile) {
        storage.setItem(STORAGE_KEYS.profile, serialize(profile));
      },
      loadRecovery() {
        return deserialize(storage.getItem(STORAGE_KEYS.recovery), null);
      },
      saveRecovery(recovery) {
        storage.setItem(STORAGE_KEYS.recovery, serialize(recovery));
      },
      clearRecovery() {
        storage.removeItem(STORAGE_KEYS.recovery);
      },
      loadWriterLease() {
        return deserialize(storage.getItem(STORAGE_KEYS.writerLease), null);
      },
      saveWriterLease(lease) {
        storage.setItem(STORAGE_KEYS.writerLease, serialize(lease));
      },
      clearWriterLease() {
        storage.removeItem(STORAGE_KEYS.writerLease);
      },
      getInstallationId(createId) {
        const current = String(storage.getItem(STORAGE_KEYS.installationId) || "");
        if (current) return current;
        const next = String(createId());
        storage.setItem(STORAGE_KEYS.installationId, next);
        return next;
      }
    });
  }

  return Object.freeze({
    STORAGE_VERSION,
    STORAGE_PREFIX,
    STORAGE_KEYS,
    isOwnedKey,
    serialize,
    deserialize,
    createStore
  });
});
