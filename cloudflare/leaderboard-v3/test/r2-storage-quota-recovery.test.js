import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const storageApi = require("../../../online-v3/ranked-v3-storage.js");

function limitedStorage(capacity, seed = {}) {
  const values = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)]));
  const used = (candidate = values) => [...candidate.entries()]
    .reduce((total, [key, value]) => total + key.length + value.length, 0);
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      const next = new Map(values);
      next.set(String(key), String(value));
      if (used(next) > capacity) {
        throw new DOMException("Browser storage is full.", "QuotaExceededError");
      }
      values.clear();
      for (const entry of next) values.set(...entry);
    },
    removeItem(key) {
      values.delete(String(key));
    },
    snapshot() {
      return Object.fromEntries(values);
    }
  };
}

test("Ranked v3 reclaims retired Ranked v2 data and cache before retrying a critical write", () => {
  const practiceKey = "dungeonOneRoomRunSave";
  const practiceV2Key = "dungeonPracticeV2Active";
  const seed = {
    dungeonRankedV2Active: "x".repeat(2_000),
    [storageApi.STORAGE_KEYS.leaderboardCache]: "y".repeat(500),
    [practiceKey]: "practice-save",
    [practiceV2Key]: "practice-v2-save"
  };
  const capacity = Object.entries(seed)
    .reduce((total, [key, value]) => total + key.length + value.length, 0) + 10;
  const storage = limitedStorage(capacity, seed);
  storageApi.createStore(storage).saveSession({ pendingOperation: { endpoint: "start" } });
  const after = storage.snapshot();

  assert.equal(after.dungeonRankedV2Active, undefined);
  assert.equal(after[storageApi.STORAGE_KEYS.leaderboardCache], undefined);
  assert.equal(after[practiceKey], "practice-save");
  assert.equal(after[practiceV2Key], "practice-v2-save");
  assert.match(after[storageApi.STORAGE_KEYS.session], /"endpoint":"start"/u);
});

test("Ranked v3 reports a stable storage-full code without deleting Practice data", () => {
  const practiceKey = "dungeonOneRoomRunSave";
  const storage = limitedStorage(
    practiceKey.length + 2_000,
    { [practiceKey]: "p".repeat(2_000) }
  );

  assert.throws(
    () => storageApi.createStore(storage).saveSession({ pendingOperation: { endpoint: "start" } }),
    (error) => error?.code === "RANKED_STORAGE_FULL"
  );
  assert.equal(storage.getItem(practiceKey), "p".repeat(2_000));
});