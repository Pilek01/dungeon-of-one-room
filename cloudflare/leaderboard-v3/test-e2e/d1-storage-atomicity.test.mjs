import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { createInitialRun, stateForDigest } from "../src/domain/run-state.js";
import { finalizeRun } from "../src/domain/transitions.js";
import { canonicalDigest } from "../src/security/digests.js";
import {
  createD1LeaderboardRepository
} from "../src/storage/d1-leaderboard.js";
import { createD1RunRepository } from "../src/storage/d1-runs.js";
import {
  fixtureRuleset,
  FIXTURE_RULESET_HASH
} from "../test/fixtures/fixture-ruleset.js";
import { RUN_TTL_MS } from "../src/config.js";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { finalizeRunV08 } from "../src/rulesets/v08-meta-1/finalization-policy.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER_ROOT = path.resolve(HERE, "..");
const REPOSITORY_ROOT = path.resolve(WORKER_ROOT, "..", "..");
const OUTPUT_ROOT = path.join(REPOSITORY_ROOT, "output");
const PERSIST_ROOT = path.join(
  OUTPUT_ROOT,
  "online-v3-worker-atomicity",
  "state"
);

function assertScopedOutputPath(candidate) {
  const resolvedOutput = path.resolve(OUTPUT_ROOT);
  const resolvedCandidate = path.resolve(candidate);
  assert(
    resolvedCandidate.startsWith(`${resolvedOutput}${path.sep}`),
    `Refusing to mutate path outside output: ${resolvedCandidate}`
  );
}

async function databaseState(db, runId) {
  const run = await db.prepare(`
    SELECT status, revision
    FROM ranked_runs
    WHERE run_id = ?
  `).bind(runId).first();
  const entry = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM leaderboard_entries
    WHERE run_id = ?
  `).bind(runId).first();
  return {
    status: run.status,
    revision: Number(run.revision),
    leaderboardRows: Number(entry.count)
  };
}

test("real D1 finalize batch never leaves a split run/leaderboard state", {
  timeout: 30_000
}, async () => {
  assertScopedOutputPath(PERSIST_ROOT);
  await rm(path.dirname(PERSIST_ROOT), { recursive: true, force: true });
  await mkdir(PERSIST_ROOT, { recursive: true });
  const miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('fixture'); } }",
    compatibilityDate: "2026-07-23",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
    d1Persist: PERSIST_ROOT
  });

  try {
    const db = await miniflare.getD1Database("DB");
    const migration = await readFile(
      path.join(WORKER_ROOT, "migrations", "0001_initial.sql"),
      "utf8"
    );
    const migrationStatements = migration
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => db.prepare(statement));
    assert.equal(migrationStatements.length, 3);
    await db.batch(migrationStatements);

    const initial = createInitialRun({
      playerName: "AtomicityFixture",
      season: "fixture-season",
      gameVersion: "v0.8.0",
      rulesetHash: FIXTURE_RULESET_HASH,
      clientInstallIdHash: "atomicity_fixture_install_hash"
    }, {
      ruleset: fixtureRuleset,
      now: 1_800_000_000_000,
      runId: "run_a70a1c",
      roomDirectiveId: "directive_atomicity_1",
      roomNonce: "nonce_atomicity_1"
    });
    const state = initial.nextState;
    const initialDigest = await canonicalDigest(stateForDigest(state));
    const leaderboard = createD1LeaderboardRepository(db);
    const runs = createD1RunRepository(db, leaderboard);
    await runs.insert(state, {
      stateDigest: initialDigest,
      recentOps: [],
      startIdempotencyKey: "atomicity-start-key",
      startRequestDigest: "atomicity-start-digest"
    });

    const transition = finalizeRun(state, {
      roomDirectiveId: state.roomDirective.id,
      roomNonce: state.roomDirective.roomNonce,
      outcome: "defeat",
      now: 1_800_000_001_000
    }, fixtureRuleset);
    const nextState = {
      ...transition.nextState,
      updatedAt: 1_800_000_001_000
    };
    const finalDigest = await canonicalDigest(stateForDigest(nextState));
    const entry = transition.storageEffects.find(
      (effect) => effect.type === "insert_leaderboard"
    ).entry;

    const beforeBatchFailure = createD1RunRepository(db, {
      prepareInsert() {
        throw new Error("CONTROLLED_BEFORE_BATCH_FAILURE");
      }
    });
    await assert.rejects(
      beforeBatchFailure.finalizeAtomic(
        nextState,
        state.revision,
        { stateDigest: finalDigest, recentOps: [] },
        entry
      ),
      /CONTROLLED_BEFORE_BATCH_FAILURE/u
    );
    assert.deepEqual(await databaseState(db, state.runId), {
      status: "active",
      revision: 0,
      leaderboardRows: 0
    });

    const duringBatchFailure = createD1RunRepository(db, {
      prepareInsert() {
        return db.prepare(`
          INSERT INTO leaderboard_table_that_does_not_exist (run_id)
          VALUES (?)
        `).bind(state.runId);
      }
    });
    await assert.rejects(
      duringBatchFailure.finalizeAtomic(
        nextState,
        state.revision,
        { stateDigest: finalDigest, recentOps: [] },
        entry
      )
    );
    assert.deepEqual(await databaseState(db, state.runId), {
      status: "active",
      revision: 0,
      leaderboardRows: 0
    });

    let responseWasLost = false;
    try {
      const committed = await runs.finalizeAtomic(
        nextState,
        state.revision,
        { stateDigest: finalDigest, recentOps: [] },
        entry
      );
      assert.equal(committed, true);
      throw new Error("CONTROLLED_AFTER_BATCH_RESPONSE_LOSS");
    } catch (cause) {
      assert.match(String(cause), /CONTROLLED_AFTER_BATCH_RESPONSE_LOSS/u);
      responseWasLost = true;
    }
    assert.equal(responseWasLost, true);
    assert.deepEqual(await databaseState(db, state.runId), {
      status: "finalized",
      revision: 1,
      leaderboardRows: 1
    });

    const realStartedAt = 1_810_000_000_000;
    const realState = createInitialMetaStateV08(
      { startDepth: 0 },
      {
        runId: "run_08a70a1c",
        season: "real-atomicity-season",
        startedAt: realStartedAt
      }
    );
    Object.assign(realState, {
      playerName: "RealAtomicity",
      protocolVersion: "ranked-v3-checkpoint-1",
      gameVersion: "0.8.1",
      clientInstallIdHash: "real_atomicity_install_hash",
      status: "defeat",
      expiresAt: realStartedAt + RUN_TTL_MS,
      finalizedAt: null,
      outcome: null,
      journalDigest: "",
      anomalyScore: 0,
      terminalEligibility: {
        outcome: "defeat",
        eligibleRevision: realState.revision,
        reason: "canonical_lives_exhausted"
      }
    });
    const realInitialDigest = await canonicalDigest(stateForDigest(realState));
    await runs.insert(realState, {
      stateDigest: realInitialDigest,
      recentOps: [],
      startIdempotencyKey: "real-atomicity-start-key",
      startRequestDigest: "real-atomicity-start-digest"
    });
    const realTransition = finalizeRunV08(realState, {
      finalizedAt: realStartedAt + 12_345
    });
    const realNextState = {
      ...realTransition.nextState,
      updatedAt: realStartedAt + 12_345
    };
    const realFinalDigest = await canonicalDigest(stateForDigest(realNextState));
    const realEntry = realTransition.storageEffects.find(
      (effect) => effect.type === "insert_leaderboard"
    ).entry;
    const realDuringBatchFailure = createD1RunRepository(db, {
      prepareInsert() {
        return db.prepare(`
          INSERT INTO leaderboard_table_that_does_not_exist (run_id)
          VALUES (?)
        `).bind(realState.runId);
      }
    });
    await assert.rejects(
      realDuringBatchFailure.finalizeAtomic(
        realNextState,
        realState.revision,
        {
          stateDigest: realFinalDigest,
          recentOps: [],
          expectedStateDigest: realInitialDigest,
          expectedStatus: "defeat"
        },
        realEntry
      )
    );
    assert.deepEqual(await databaseState(db, realState.runId), {
      status: "defeat",
      revision: 0,
      leaderboardRows: 0
    });
    assert.equal(await runs.finalizeAtomic(
      realNextState,
      realState.revision,
      {
        stateDigest: realFinalDigest,
        recentOps: [],
        expectedStateDigest: realInitialDigest,
        expectedStatus: "defeat"
      },
      realEntry
    ), true);
    assert.deepEqual(await databaseState(db, realState.runId), {
      status: "finalized",
      revision: 1,
      leaderboardRows: 1
    });
    assert.equal(await runs.finalizeAtomic(
      realNextState,
      realState.revision,
      {
        stateDigest: realFinalDigest,
        recentOps: [],
        expectedStateDigest: realInitialDigest,
        expectedStatus: "defeat"
      },
      realEntry
    ), false);
  } finally {
    await miniflare.dispose();
  }
});
