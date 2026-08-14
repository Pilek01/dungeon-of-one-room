import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

test("0001 migration creates exactly two tables and the leaderboard index", async () => {
  const sql = await readFile(
    new URL("../migrations/0001_initial.sql", import.meta.url),
    "utf8"
  );
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(sql);
  const tables = database.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all().map((row) => row.name);
  assert.deepEqual(tables, ["leaderboard_entries", "ranked_runs"]);
  const index = database.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type = 'index' AND name = 'leaderboard_entries_season_score_created'
  `).get();
  assert.match(index.sql, /season,\s*score DESC,\s*created_at ASC/iu);
  assert.doesNotMatch(sql, /CREATE TABLE\s+(?:events|moves|commands|journal)/iu);
  database.close();
});

test("migration exposes every required authoritative column", async () => {
  const sql = await readFile(
    new URL("../migrations/0001_initial.sql", import.meta.url),
    "utf8"
  );
  const required = [
    "canonical_state_json",
    "state_digest",
    "journal_digest",
    "recent_ops_json",
    "anomaly_score",
    "duration_ms",
    "build_json",
    "summary_json",
    "verification_level"
  ];
  for (const column of required) assert.match(sql, new RegExp(`\\b${column}\\b`, "u"));
});
test("R2 migrations are additive and expose profile plus recovery retention state", async () => {
  const migrations = await Promise.all([
    "0001_initial.sql",
    "0002_r2_ranked_profiles.sql",
    "0003_r2_run_recovery.sql"
  ].map((name) => readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8")));
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  for (const sql of migrations) database.exec(sql);

  const tables = database.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all().map((row) => row.name);
  assert.deepEqual(tables, [
    "leaderboard_entries",
    "ranked_profiles",
    "ranked_runs"
  ]);

  const runColumns = database.prepare("PRAGMA table_info(ranked_runs)").all()
    .map((row) => row.name);
  for (const column of [
    "profile_id",
    "recovery_verifier",
    "recovery_issued_at",
    "last_accessed_at"
  ]) {
    assert(runColumns.includes(column), `missing ranked_runs.${column}`);
  }

  const profileColumns = database.prepare("PRAGMA table_info(ranked_profiles)").all()
    .map((row) => row.name);
  for (const column of [
    "profile_id",
    "credential_verifier",
    "canonical_profile_json",
    "recent_ops_json",
    "expires_at"
  ]) {
    assert(profileColumns.includes(column), `missing ranked_profiles.${column}`);
  }

  const indexes = database.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'index'
    ORDER BY name
  `).all().map((row) => row.name);
  assert(indexes.includes("ranked_runs_profile_status_expires"));
  assert(indexes.includes("idx_ranked_runs_recovery_retention"));
  database.close();
});

test("0004 and 0005 preserve legacy rows while indexing terminal leaderboard queries", async () => {
  const names = [
    "0001_initial.sql",
    "0002_r2_ranked_profiles.sql",
    "0003_r2_run_recovery.sql"
  ];
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  for (const name of names) {
    database.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
  const insertRun = database.prepare(`
    INSERT INTO ranked_runs (
      run_id, profile_id, season, protocol_version, ruleset_hash, status,
      revision, player_name, depth, room_index, gold, lives,
      canonical_state_json, state_digest, recent_ops_json, started_at,
      updated_at, expires_at, start_idempotency_key, start_request_digest
    ) VALUES (?, ?, 'season-a', 'ranked-v3-checkpoint-1', 'sha256:test',
      'finalized', 1, 'Player', 10, 10, 10, 0, '{}', ?, '[]', 1, 2, 3, ?, ?)
  `);
  const insertEntry = database.prepare(`
    INSERT INTO leaderboard_entries (
      run_id, season, player_name, score, depth, gold, duration_ms,
      outcome, build_json, summary_json, verification_level,
      state_digest, created_at
    ) VALUES (?, 'season-a', 'Player', ?, ?, ?, 1000, ?, '{}', '{}',
      'checkpoint_verified_v3', ?, ?)
  `);
  const rows = [
    ["run_duplicate_low", "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 100, 10, 20, "defeat", 100],
    ["run_duplicate_best", "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 100, 11, 5, "defeat", 200],
    ["run_other_profile", "profile_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", 90, 20, 40, "victory", 300],
    ["run_old_extract", "profile_cccccccccccccccccccccccccccccccc", 500, 30, 80, "extract", 400],
    ["run_legacy_no_profile", null, 999, 99, 99, "defeat", 50]
  ];
  for (const [runId, profileId, score, depth, gold, outcome, createdAt] of rows) {
    insertRun.run(runId, profileId, `digest:${runId}`, `start:${runId}`, `request:${runId}`);
    insertEntry.run(runId, score, depth, gold, outcome, `digest:${runId}`, createdAt);
  }
  for (const name of [
    "0004_r2_leaderboard_campaign_identity.sql",
    "0005_r2_terminal_leaderboard_filter.sql"
  ]) {
    database.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
  const columns = database.prepare("PRAGMA table_info(leaderboard_entries)").all()
    .map((row) => row.name);
  assert(columns.includes("profile_id"));
  const published = database.prepare(`
    SELECT run_id, profile_id FROM leaderboard_entries ORDER BY run_id
  `).all().map((row) => ({ ...row }));
  assert.deepEqual(published, [
    {
      run_id: "run_duplicate_best",
      profile_id: "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    {
      run_id: "run_old_extract",
      profile_id: "profile_cccccccccccccccccccccccccccccccc"
    },
    {
      run_id: "run_other_profile",
      profile_id: "profile_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    }
  ]);
  const indexes = database.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name
  `).all().map((row) => row.name);
  assert(indexes.includes("leaderboard_entries_season_profile"));
  assert(indexes.includes("leaderboard_entries_terminal_season_score_created"));
  assert.throws(() => database.prepare(`
    INSERT INTO leaderboard_entries (
      run_id, profile_id, season, player_name, score, depth, gold, duration_ms,
      outcome, build_json, summary_json, verification_level, state_digest,
      created_at
    ) VALUES ('run_conflict', 'profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'season-a', 'Player', 1, 1, 1, 1, 'defeat', '{}', '{}',
      'checkpoint_verified_v3', 'digest', 999)
  `).run(), /UNIQUE constraint failed/iu);
  database.close();
});

test("0006 adds ranked snapshots and separates official from assisted campaign rows", async () => {
  const database = new DatabaseSync(":memory:");
  for (const name of [
    "0001_initial.sql",
    "0002_r2_ranked_profiles.sql",
    "0003_r2_run_recovery.sql",
    "0004_r2_leaderboard_campaign_identity.sql",
    "0005_r2_terminal_leaderboard_filter.sql",
    "0006_leaderboard_snapshots.sql"
  ]) {
    database.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
  const columns = database.prepare("PRAGMA table_info(leaderboard_entries)").all();
  assert.equal(columns.find((row) => row.name === "snapshot_kind").dflt_value, "'final'");
  assert.equal(columns.find((row) => row.name === "assistance_class").dflt_value, "'none'");
  const indexes = database.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name
  `).all().map((row) => row.name);
  assert(indexes.includes("leaderboard_entries_season_profile_assistance"));
  assert(indexes.includes("leaderboard_entries_official_season_score_created"));
  assert.equal(indexes.includes("leaderboard_entries_season_profile"), false);
  assert.equal(indexes.includes("leaderboard_entries_terminal_season_score_created"), false);

  const insertRun = database.prepare(`
    INSERT INTO ranked_runs (
      run_id, season, protocol_version, ruleset_hash, status, revision,
      player_name, depth, room_index, gold, lives, canonical_state_json,
      state_digest, recent_ops_json, started_at, updated_at, expires_at,
      start_idempotency_key, start_request_digest
    ) VALUES (?, 'season-a', 'ranked-v3-checkpoint-1', 'sha256:test',
      'active', 1, 'Player', 1, 1, 1, 1, '{}', 'digest', '[]', 1, 1, 2, ?, ?)
  `);
  for (const runId of [
    "run_snapshot_official",
    "run_snapshot_official_conflict",
    "run_snapshot_assisted"
  ]) {
    insertRun.run(runId, `start:${runId}`, `request:${runId}`);
  }
  const insert = database.prepare(`
    INSERT INTO leaderboard_entries (
      run_id, profile_id, season, player_name, score, depth, gold, duration_ms,
      outcome, build_json, summary_json, verification_level, state_digest,
      created_at, snapshot_kind, assistance_class
    ) VALUES (?, 'profile_snapshot_test', 'season-a', 'Player', 1, 1, 1, 1,
      'defeat', '{}', '{}', 'checkpoint_verified_v3', 'digest', 1, ?, ?)
  `);
  insert.run("run_snapshot_official", "death", "none");
  assert.throws(
    () => insert.run("run_snapshot_official_conflict", "extract", "none"),
    /UNIQUE constraint failed/iu
  );
  assert.doesNotThrow(
    () => insert.run("run_snapshot_assisted", "death", "observer_bot")
  );
  database.close();
});
