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