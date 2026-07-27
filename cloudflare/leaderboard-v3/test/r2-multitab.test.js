import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const storageApi = require("../../../online-v3/ranked-v3-storage.js");
const coordinationApi = require("../../../online-v3/ranked-v3-coordination.js");

function sharedStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

test("one tab owns a run until release or lease expiry", () => {
  const local = sharedStorage();
  const firstStore = storageApi.createStore(local);
  const secondStore = storageApi.createStore(local);
  let now = 10_000;
  const first = coordinationApi.createCoordinator({
    store: firstStore,
    tabId: "tab_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    now: () => now,
    ttlMs: 2_000,
    broadcastChannel: false
  });
  const second = coordinationApi.createCoordinator({
    store: secondStore,
    tabId: "tab_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    now: () => now,
    ttlMs: 2_000,
    broadcastChannel: false
  });
  const runId = "run_a1";

  assert.equal(first.acquire(runId, 2), true);
  assert.equal(second.acquire(runId, 2), false);
  assert.equal(first.heartbeat(runId, 3), true);
  assert.equal(firstStore.loadWriterLease().lastKnownRevision, 3);

  now += 2_001;
  assert.equal(second.acquire(runId, 4), true);
  assert.equal(first.isOwner(runId), false);
  assert.equal(first.release(runId), false);
  assert.equal(second.release(runId), true);
  assert.equal(secondStore.loadWriterLease(), null);
});

test("BroadcastChannel is advisory and localStorage remains the fallback", () => {
  const local = sharedStorage();
  const messages = [];
  class FakeChannel {
    postMessage(value) { messages.push(value); }
    close() {}
  }
  const coordinator = coordinationApi.createCoordinator({
    store: storageApi.createStore(local),
    tabId: "tab_cccccccccccccccccccccccccccccccc",
    now: () => 20_000,
    BroadcastChannel: FakeChannel
  });
  assert.equal(coordinator.acquire("run_c1", 1), true);
  assert.equal(messages[0].kind, "acquired");

  const fallback = coordinationApi.createCoordinator({
    store: storageApi.createStore(local),
    tabId: "tab_dddddddddddddddddddddddddddddddd",
    now: () => 20_000,
    BroadcastChannel: class BrokenChannel {
      constructor() { throw new Error("unavailable"); }
    }
  });
  assert.equal(fallback.acquire("run_c1", 1), false);
});

test("runtime and client enforce ownership, heartbeat and one pending mutation", async () => {
  const client = await readFile(new URL(
    "../../../online-v3/ranked-v3-client.js",
    import.meta.url
  ), "utf8");
  const runtime = await readFile(new URL(
    "../../../online-v3/ranked-v3-runtime.js",
    import.meta.url
  ), "utf8");
  const index = await readFile(new URL("../../../index.html", import.meta.url), "utf8");

  assert.match(client, /RANKED_WRITER_LEASE_HELD/u);
  assert.match(client, /RANKED_MUTATION_LOCKED/u);
  assert.match(client, /current\.pendingOperation\?\.operationId !== operation\.operationId/u);
  assert.match(runtime, /heartbeatWriter/u);
  assert.match(runtime, /beforeunload[\s\S]*releaseWriter/u);
  assert.match(runtime, /Request control/u);
  assert(
    index.indexOf("ranked-v3-coordination.js") <
    index.indexOf("ranked-v3-client.js")
  );
});
