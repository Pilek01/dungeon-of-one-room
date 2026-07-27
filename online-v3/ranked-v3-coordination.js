(function exposeRankedV3Coordination(root, factory) {
  "use strict";
  const api = factory();
  if (root) root.DungeonRankedV3Coordination = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createCoordinationModule() {
  "use strict";

  const DEFAULT_LEASE_TTL_MS = 12_000;

  function opaqueTabId(cryptoProvider) {
    if (typeof cryptoProvider?.randomUUID === "function") {
      return `tab_${cryptoProvider.randomUUID().replaceAll("-", "")}`;
    }
    const bytes = cryptoProvider.getRandomValues(new Uint8Array(16));
    return `tab_${Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("")}`;
  }

  function validLease(value) {
    return Boolean(
      value &&
      /^run_[a-f0-9]+$/u.test(String(value.runId || "")) &&
      /^tab_[a-f0-9]{32}$/u.test(String(value.tabId || "")) &&
      Number.isSafeInteger(value.leaseVersion) &&
      value.leaseVersion > 0 &&
      Number.isSafeInteger(value.expiresAt) &&
      Number.isSafeInteger(value.lastKnownRevision)
    );
  }

  function createCoordinator(options = {}) {
    const store = options.store;
    if (!store?.loadWriterLease || !store?.saveWriterLease) {
      throw new TypeError("RANKED_WRITER_LEASE_STORAGE_REQUIRED");
    }
    const cryptoProvider = options.cryptoProvider || globalThis.crypto;
    const now = options.now || (() => Date.now());
    const ttlMs = Math.max(1_000, Number(options.ttlMs) || DEFAULT_LEASE_TTL_MS);
    const tabId = options.tabId || opaqueTabId(cryptoProvider);
    let channel = null;
    if (options.broadcastChannel !== false) {
      const Channel = options.BroadcastChannel || globalThis.BroadcastChannel;
      if (typeof Channel === "function") {
        try {
          channel = new Channel("dungeon-ranked-v3-writer-v1");
        } catch {
          channel = null;
        }
      }
    }

    function current() {
      const lease = store.loadWriterLease();
      return validLease(lease) ? lease : null;
    }

    function announce(kind, lease) {
      channel?.postMessage?.({ kind, lease });
    }

    function acquire(runId, lastKnownRevision = 0) {
      const canonicalRunId = String(runId || "");
      if (!/^run_[a-f0-9]+$/u.test(canonicalRunId)) {
        throw new TypeError("RANKED_WRITER_RUN_ID_INVALID");
      }
      const observed = current();
      const timestamp = now();
      if (
        observed &&
        observed.runId === canonicalRunId &&
        observed.tabId !== tabId &&
        observed.expiresAt > timestamp
      ) {
        return false;
      }
      const lease = {
        runId: canonicalRunId,
        tabId,
        leaseVersion: Math.max(0, Number(observed?.leaseVersion) || 0) + 1,
        heartbeatAt: timestamp,
        expiresAt: timestamp + ttlMs,
        lastKnownRevision: Math.max(0, Number(lastKnownRevision) || 0)
      };
      store.saveWriterLease(lease);
      const confirmed = current();
      const owned = confirmed?.runId === canonicalRunId && confirmed?.tabId === tabId;
      if (owned) announce("acquired", confirmed);
      return owned;
    }

    function heartbeat(runId, lastKnownRevision = 0) {
      const observed = current();
      if (
        !observed ||
        observed.runId !== runId ||
        observed.tabId !== tabId ||
        observed.expiresAt <= now()
      ) {
        return false;
      }
      const lease = {
        ...observed,
        heartbeatAt: now(),
        expiresAt: now() + ttlMs,
        lastKnownRevision: Math.max(
          observed.lastKnownRevision,
          Number(lastKnownRevision) || 0
        )
      };
      store.saveWriterLease(lease);
      announce("heartbeat", lease);
      return true;
    }

    function isOwner(runId) {
      const observed = current();
      return Boolean(
        observed &&
        observed.runId === runId &&
        observed.tabId === tabId &&
        observed.expiresAt > now()
      );
    }

    function release(runId) {
      const observed = current();
      if (!observed || observed.runId !== runId || observed.tabId !== tabId) return false;
      store.clearWriterLease();
      announce("released", observed);
      return true;
    }

    function close() {
      channel?.close?.();
    }

    return Object.freeze({
      tabId,
      acquire,
      heartbeat,
      isOwner,
      release,
      current,
      close
    });
  }

  return Object.freeze({
    DEFAULT_LEASE_TTL_MS,
    validLease,
    createCoordinator
  });
});
