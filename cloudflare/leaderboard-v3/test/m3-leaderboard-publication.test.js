import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";

const SEASON = "m3-public-season";

function entry(runId, score, createdAt, overrides = {}) {
  return {
    runId,
    profileId: overrides.profileId ?? `profile_${runId.slice(4).padStart(32, "0")}`,
    season: SEASON,
    playerName: `Player-${runId.slice(-2)}`,
    score,
    depth: overrides.depth ?? 10,
    gold: overrides.gold ?? 25,
    durationMs: overrides.durationMs ?? 1000,
    outcome: overrides.outcome ?? "defeat",
    verificationLevel: "checkpoint_verified_v3",
    createdAt,
    build: {
      relics: [],
      pacts: [],
      campUpgrades: {},
      skillTiers: {},
      elixirs: {},
      runModifiers: [],
      buildDigest: `sha256:${runId}`
    },
    summary: {
      scoreVersion: "v08-score-1",
      durationPolicyVersion: "server-wall-clock-v1",
      rulesetId: "v08-meta-1",
      rulesetHash: "sha256:m3",
      verificationLevel: "checkpoint_verified_v3"
    }
  };
}

async function publish(repositories, value) {
  const initial = {
    runId: value.runId,
    status: "defeat",
    revision: 0
  };
  await repositories.runs.insert(initial, {
    stateDigest: `before:${value.runId}`,
    recentOps: [],
    startIdempotencyKey: `start:${value.runId}`,
    startRequestDigest: `request:${value.runId}`
  });
  return repositories.runs.finalizeAtomic(
    {
      ...initial,
      status: "finalized",
      revision: 1
    },
    0,
    {
      stateDigest: `after:${value.runId}`,
      recentOps: [],
      expectedStateDigest: `before:${value.runId}`,
      expectedStatus: "defeat"
    },
    value
  );
}

async function get(worker, path) {
  const response = await worker.fetch(new Request(`https://m3.invalid${path}`), {});
  return { response, payload: await response.json() };
}

test("leaderboard cursor preserves score DESC, createdAt ASC, runId ASC", async () => {
  const repositories = createMemoryRepositories();
  for (const value of [
    entry("run_0000000000000006", 90, 100),
    entry("run_0000000000000003", 100, 200),
    entry("run_0000000000000002", 100, 100),
    entry("run_0000000000000001", 110, 300),
    entry("run_0000000000000004", 100, 200),
    entry("run_0000000000000005", 90, 50)
  ]) {
    assert.equal(await publish(repositories, value), true);
  }
  const pages = [];
  let cursor = "";
  do {
    const page = await repositories.leaderboard.list(SEASON, {
      limit: 2,
      cursor
    });
    pages.push(...page.entries.map((value) => value.runId));
    cursor = page.cursor || "";
  } while (cursor);
  assert.deepEqual(pages, [
    "run_0000000000000001",
    "run_0000000000000002",
    "run_0000000000000003",
    "run_0000000000000004",
    "run_0000000000000005",
    "run_0000000000000006"
  ]);
  assert.equal(new Set(pages).size, pages.length);
});

test("public list is compact while detail exposes only frozen public projections", async () => {
  const repositories = createMemoryRepositories();
  const value = entry("run_0000000000000010", 12345, 500);
  assert.equal(await publish(repositories, value), true);
  const worker = createWorker({ repositories });
  const list = await get(
    worker,
    `/api/v3/leaderboard?season=${SEASON}&limit=20`
  );
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.entries.length, 1);
  for (const forbidden of ["build", "summary", "stateDigest", "clientInstallIdHash"]) {
    assert.equal(forbidden in list.payload.entries[0], false);
  }
  const detail = await get(worker, `/api/v3/leaderboard/${value.runId}`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.payload.entry.summary.scoreVersion, "v08-score-1");
  assert.equal(detail.payload.entry.summary.rulesetId, "v08-meta-1");
  assert.deepEqual(detail.payload.entry.build, value.build);
  for (const forbidden of ["canonicalState", "recentOps", "clientInstallIdHash"]) {
    assert.equal(forbidden in detail.payload.entry, false);
  }
});

test("run uniqueness rejects a second publication without replacing the first", async () => {
  const repositories = createMemoryRepositories();
  const original = entry("run_0000000000000020", 100, 100);
  assert.equal(await publish(repositories, original), true);
  const replaced = await repositories.runs.finalizeAtomic(
    {
      runId: original.runId,
      status: "finalized",
      revision: 1
    },
    0,
    {
      stateDigest: "replacement",
      recentOps: [],
      expectedStatus: "defeat"
    },
    { ...original, score: 999999 }
  );
  assert.equal(replaced, false);
  assert.equal(repositories.leaderboardCount(), 1);
  assert.equal(
    (await repositories.leaderboard.detail(original.runId)).score,
    original.score
  );
});

test("season and campaign profile publish at most one leaderboard row", async () => {
  const repositories = createMemoryRepositories();
  const profileId = "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const first = entry("run_0000000000000030", 100, 100, { profileId });
  const final = entry("run_0000000000000031", 200, 200, { profileId });
  assert.equal(await publish(repositories, first), true);
  assert.equal(await publish(repositories, final), true);
  assert.equal(repositories.leaderboardCount(), 1);
  assert.equal(await repositories.leaderboard.detail(first.runId), null);
  assert.equal(
    (await repositories.leaderboard.detail(final.runId)).profileId,
    profileId
  );
});


test("legacy extraction entries are hidden from public list and detail", async () => {
  const repositories = createMemoryRepositories();
  const legacy = entry("run_0000000000000099", 99999, 50, { outcome: "extract" });
  assert.equal(await publish(repositories, legacy), true);
  const worker = createWorker({ repositories });
  const list = await get(worker, `/api/v3/leaderboard?season=${SEASON}&limit=20`);
  assert.equal(list.response.status, 200);
  assert.deepEqual(list.payload.entries, []);
  const detail = await get(worker, `/api/v3/leaderboard/${legacy.runId}`);
  assert.equal(detail.response.status, 404);
});
