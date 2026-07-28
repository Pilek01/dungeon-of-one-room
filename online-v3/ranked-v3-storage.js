(function exposeRankedV3Storage(root, factory) {
  "use strict";

  const api = factory();
  if (root) root.DungeonRankedV3Storage = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createStorageModule() {
  "use strict";

  const STORAGE_VERSION = 2;
  const STORAGE_PREFIX = "dungeonRankedV3";
  const LEGACY_RANKED_V2_KEY = "dungeonRankedV2Active";
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

  function isQuotaExceeded(error) {
    return error?.name === "QuotaExceededError" || error?.code === 22 || error?.code === 1014;
  }

  function storageFullError(cause) {
    const error = new Error("RANKED_STORAGE_FULL", { cause });
    error.name = "RankedV3StorageError";
    error.code = "RANKED_STORAGE_FULL";
    return error;
  }

  function reclaimRetiredRankedStorage(storage) {
    for (const key of [LEGACY_RANKED_V2_KEY, STORAGE_KEYS.leaderboardCache]) {
      try {
        storage.removeItem(key);
      } catch {
        // Best effort only. Critical writes below still fail safely.
      }
    }
  }

  function setCriticalItem(storage, key, value) {
    try {
      storage.setItem(key, value);
      return;
    } catch (error) {
      if (!isQuotaExceeded(error)) throw error;
    }
    reclaimRetiredRankedStorage(storage);
    try {
      storage.setItem(key, value);
    } catch (error) {
      if (!isQuotaExceeded(error)) throw error;
      throw storageFullError(error);
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
        setCriticalItem(storage, STORAGE_KEYS.session, serialize(snapshot));
      },
      clearSession() {
        storage.removeItem(STORAGE_KEYS.session);
      },
      loadProfile() {
        return deserialize(storage.getItem(STORAGE_KEYS.profile), null);
      },
      saveProfile(profile) {
        setCriticalItem(storage, STORAGE_KEYS.profile, serialize(profile));
      },
      clearProfile() {
        storage.removeItem(STORAGE_KEYS.profile);
      },
      loadRecovery() {
        return deserialize(storage.getItem(STORAGE_KEYS.recovery), null);
      },
      saveRecovery(recovery) {
        setCriticalItem(storage, STORAGE_KEYS.recovery, serialize(recovery));
      },
      clearRecovery() {
        storage.removeItem(STORAGE_KEYS.recovery);
      },
      loadWriterLease() {
        return deserialize(storage.getItem(STORAGE_KEYS.writerLease), null);
      },
      saveWriterLease(lease) {
        setCriticalItem(storage, STORAGE_KEYS.writerLease, serialize(lease));
      },
      clearWriterLease() {
        storage.removeItem(STORAGE_KEYS.writerLease);
      },
      getInstallationId(createId) {
        const current = String(storage.getItem(STORAGE_KEYS.installationId) || "");
        if (current) return current;
        const next = String(createId());
        setCriticalItem(storage, STORAGE_KEYS.installationId, next);
        return next;
      }
    });
  }

  return Object.freeze({
    STORAGE_VERSION,
    STORAGE_PREFIX,
    STORAGE_KEYS,
    LEGACY_RANKED_V2_KEY,
    isOwnedKey,
    serialize,
    deserialize,
    createStore
  });
});
