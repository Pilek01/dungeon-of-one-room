CREATE TABLE ranked_runs (
  run_id TEXT PRIMARY KEY,
  season TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  ruleset_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  revision INTEGER NOT NULL,
  player_name TEXT,
  depth INTEGER NOT NULL,
  room_index INTEGER NOT NULL,
  room_directive_id TEXT,
  room_type TEXT,
  room_nonce TEXT,
  gold INTEGER NOT NULL,
  lives INTEGER NOT NULL,
  canonical_state_json TEXT NOT NULL,
  state_digest TEXT NOT NULL,
  journal_digest TEXT,
  recent_ops_json TEXT NOT NULL,
  anomaly_score INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  finalized_at INTEGER,
  outcome TEXT,
  start_idempotency_key TEXT NOT NULL UNIQUE,
  start_request_digest TEXT NOT NULL
);

CREATE TABLE leaderboard_entries (
  run_id TEXT PRIMARY KEY,
  season TEXT NOT NULL,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  depth INTEGER NOT NULL,
  gold INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  build_json TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  verification_level TEXT NOT NULL,
  state_digest TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES ranked_runs(run_id)
);

CREATE INDEX leaderboard_entries_season_score_created
  ON leaderboard_entries(season, score DESC, created_at ASC);
