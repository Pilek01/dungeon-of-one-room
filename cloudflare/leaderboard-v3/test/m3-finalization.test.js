import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createWorker } from "../src/index.js";
import { RUN_TTL_MS } from "../src/config.js";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import { V08_META_1_LOCAL_RELEASE_DESCRIPTOR } from "../src/rulesets/releases.js";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { finalizeRunV08 } from "../src/rulesets/v08-meta-1/finalization-policy.js";
import {
  decodeBoundaryToken,
  signBoundaryToken
} from "../src/security/checkpoint-token.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const STARTED_AT = 1_830_000_000_000;
const fixtures = JSON.parse(await readFile(new URL(
  "../src/rulesets/v08-meta-1/test/m3-finalization-golden-fixtures.json",
  import.meta.url
), "utf8"));

function terminalState(fixture) {
  const state = createInitialMetaStateV08(
    { startDepth: 0 },
    {
      runId: "run_0000000000000001",
      season: "m3-season",
      startedAt: STARTED_AT
    }
  );
  state.playerName = "M3 Final";
  state.protocolVersion = "ranked-v3-checkpoint-1";
  state.gameVersion = "0.8.1";
  state.profileId = "profile_0123456789abcdef0123456789abcdef";
  state.expiresAt = STARTED_AT + RUN_TTL_MS;
  state.status = fixture.status;
  state.maxDepth = fixture.depth;
  state.depth = fixture.depth;
  state.goldLedger.earnedServerDerived = fixture.gold;
  state.terminalEligibility = {
    outcome: fixture.status,
    eligibleRevision: state.revision,
    reason: "golden_fixture"
  };
  return state;
}

function createRealHarness(options = {}) {
  const repositories = options.repositories || createMemoryRepositories();
  let now = STARTED_AT;
  let sequence = 1;
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([
      V08_META_1_LOCAL_RELEASE_DESCRIPTOR
    ]),
    rulesetEnvironment: "local",
    repositories,
    now: () => now,
    randomUUID() {
      const suffix = String(sequence).padStart(12, "0");
      sequence += 1;
      return `00000000-0000-4000-8000-${suffix}`;
    }
  });
  const env = { RANKED_V3_HMAC_SECRET: TEST_SECRET };

  async function call(path, body, key) {
    const response = await worker.fetch(new Request(`https://m3.invalid${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": key
      },
      body: JSON.stringify(body)
    }), env);
    return { response, payload: await response.json() };
  }

  async function terminalDefeat(prefix = "m3") {
    const started = (await call("/api/v3/runs/start", {
      playerName: "M3Runtime",
      season: "m3-season",
      gameVersion: "0.8.1",
      rulesetId: "v08-meta-1",
      rulesetHash: manifest.rulesetHash,
      clientInstallIdHash: "install_0123456789abcdef",
      profileId: "profile_0123456789abcdef0123456789abcdef",
      profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
      recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"
    }, `${prefix}-start`)).payload;
    let session = (await call("/api/v3/runs/event", {
      runId: started.runId,
      type: "select_starting_relic",
      bootstrapToken: started.bootstrapToken,
      offerId: started.metaState.startingRelicOffer.offerId,
      choiceId: started.metaState.startingRelicOffer.publicChoices[0].choiceId
    }, `${prefix}-select`)).payload;
    for (let index = 0; index < 8 && session.metaState.status === "active"; index += 1) {
      const directive = session.metaState.currentRoomDirective;
      session = (await call("/api/v3/runs/event", {
        runId: session.runId,
        checkpointToken: session.checkpointToken,
        roomDirectiveId: directive.directiveId,
        roomNonce: directive.roomNonce,
        type: "report_fatal_event",
        payload: { classification: "local_fatal_event" }
      }, `${prefix}-fatal-${index}`)).payload;
    }
    assert.equal(session.metaState.status, "defeat");
    assert.equal(decodeBoundaryToken(session.checkpointToken).payload.boundaryKind, "run_terminal");
    return session;
  }

  return {
    repositories,
    call,
    terminalDefeat,
    advance(ms) {
      now += ms;
    }
  };
}

test("M3 finalization golden corpus has 12 exact terminal cases", () => {
  assert.equal(fixtures.length, 12);
  assert.equal(new Set(fixtures.map((entry) => entry.fixtureId)).size, 12);
  for (const fixture of fixtures) {
    const state = terminalState(fixture);
    const before = structuredClone(state);
    const result = finalizeRunV08(state, {
      finalizedAt: STARTED_AT + fixture.durationMs
    });
    assert.deepEqual(state, before);
    assert.equal(result.nextState.status, "finalized");
    assert.equal(result.nextState.revision, state.revision + 1);
    assert.equal(result.response.outcome, fixture.outcome);
    assert.equal(result.response.score, fixture.score);
    assert.equal(result.response.durationMs, fixture.durationMs);
    const leaderboardEffect = result.storageEffects.find(
      (effect) => effect.type === "insert_leaderboard"
    );
    if (fixture.status === "extraction") {
      assert.equal(leaderboardEffect, undefined);
      assert.equal("leaderboardEntryId" in result.response, false);
    } else {
      assert.equal(leaderboardEffect.entry.runId, state.runId);
      assert.equal(leaderboardEffect.entry.profileId, state.profileId);
    }
  }
});

test("HTTP finalization is terminal-token-bound, server-derived and exactly retryable", async () => {
  const harness = createRealHarness();
  const terminal = await harness.terminalDefeat("exact");
  harness.advance(12_345);
  const body = {
    runId: terminal.runId,
    checkpointToken: terminal.checkpointToken
  };
  const first = await harness.call("/api/v3/runs/finalize", body, "exact-finalize");
  assert.equal(first.response.status, 200);
  assert.equal(first.payload.outcome, "defeat");
  assert.equal(first.payload.metaState.status, "finalized");
  assert.equal(first.payload.leaderboardEntryId, terminal.runId);
  assert.equal(harness.repositories.leaderboardCount(), 1);
  const retry = await harness.call("/api/v3/runs/finalize", body, "exact-finalize");
  assert.equal(retry.response.status, 200);
  assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
  assert.deepEqual(retry.payload, first.payload);
  assert.equal(harness.repositories.leaderboardCount(), 1);
});

test("client outcome, score, lives and extraction claims are forbidden", async () => {
  const harness = createRealHarness();
  const terminal = await harness.terminalDefeat("fake");
  for (const [field, value] of [
    ["outcome", "victory"],
    ["score", 999999],
    ["lives", 5],
    ["extraction", { mode: "normal" }],
    ["durationMs", 1]
  ]) {
    const result = await harness.call("/api/v3/runs/finalize", {
      runId: terminal.runId,
      checkpointToken: terminal.checkpointToken,
      [field]: value
    }, `fake-${field}`);
    assert.equal(result.response.status, 400);
    assert.equal(result.payload.error.code, "FINALIZE_REQUEST_FIELDS_INVALID");
  }
  assert.equal(harness.repositories.snapshotRun(terminal.runId).status, "defeat");
  assert.equal(harness.repositories.leaderboardCount(), 0);
});

test("conflicting retry and stale terminal boundary fail closed", async () => {
  const harness = createRealHarness();
  const terminal = await harness.terminalDefeat("conflict");
  const tokenPayload = decodeBoundaryToken(terminal.checkpointToken).payload;
  const alternateToken = await signBoundaryToken({
    ...tokenPayload,
    issuedAt: tokenPayload.issuedAt + 1,
    expiresAt: tokenPayload.expiresAt + 1
  }, TEST_SECRET);
  const first = await harness.call("/api/v3/runs/finalize", {
    runId: terminal.runId,
    checkpointToken: terminal.checkpointToken
  }, "conflict-finalize");
  assert.equal(first.response.status, 200);
  const conflict = await harness.call("/api/v3/runs/finalize", {
    runId: terminal.runId,
    checkpointToken: alternateToken
  }, "conflict-finalize");
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.payload.error.code, "IDEMPOTENCY_KEY_REUSED");
  const stale = await harness.call("/api/v3/runs/finalize", {
    runId: terminal.runId,
    checkpointToken: terminal.checkpointToken
  }, "stale-finalize");
  assert.equal(stale.response.status, 409);
  assert.equal(stale.payload.error.code, "REVISION_CONFLICT");
});

test("parallel finalizers publish at most one row", async () => {
  const harness = createRealHarness();
  const terminal = await harness.terminalDefeat("parallel");
  const body = {
    runId: terminal.runId,
    checkpointToken: terminal.checkpointToken
  };
  const results = await Promise.all([
    harness.call("/api/v3/runs/finalize", body, "parallel-final-a"),
    harness.call("/api/v3/runs/finalize", body, "parallel-final-b")
  ]);
  assert.equal(results.filter((entry) => entry.response.status === 200).length, 1);
  assert.equal(harness.repositories.leaderboardCount(), 1);
  assert.equal(harness.repositories.snapshotRun(terminal.runId).status, "finalized");
});

test("atomic storage failure rolls back both run and leaderboard", async () => {
  const base = createMemoryRepositories();
  const repositories = {
    ...base,
    runs: {
      ...base.runs,
      async finalizeAtomic() {
        return false;
      }
    }
  };
  const harness = createRealHarness({ repositories });
  const terminal = await harness.terminalDefeat("rollback");
  const result = await harness.call("/api/v3/runs/finalize", {
    runId: terminal.runId,
    checkpointToken: terminal.checkpointToken
  }, "rollback-final");
  assert.equal(result.response.status, 409);
  assert.equal(result.payload.error.code, "REVISION_CONFLICT");
  assert.equal(base.snapshotRun(terminal.runId).status, "defeat");
  assert.equal(base.leaderboardCount(), 0);
});

test("128 terminal seeds preserve exact outcome and bounded immutable projections", () => {
  for (let seed = 0; seed < 128; seed += 1) {
    const status = ["defeat", "extraction", "victory"][seed % 3];
    const depth = status === "victory" ? 100 : seed % 100;
    const gold = seed * 37;
    const fixture = { status, depth, gold };
    const state = terminalState(fixture);
    const result = finalizeRunV08(state, {
      finalizedAt: STARTED_AT + seed * 1000
    });
    assert.equal(result.response.outcome, status === "extraction" ? "extract" : status);
    assert.equal(
      result.response.score,
      depth * 1000 + gold * 2 + Math.floor(depth / 5) * 2500
    );
    assert(JSON.stringify(result.response).length < 16_384);
    const leaderboardEffect = result.storageEffects.find(
      (effect) => effect.type === "insert_leaderboard"
    );
    assert.equal(Boolean(leaderboardEffect), status !== "extraction");
    if (leaderboardEffect) {
      assert(JSON.stringify(leaderboardEffect.entry).length < 16_384);
    }
  }
});
