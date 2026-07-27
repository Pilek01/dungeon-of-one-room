ALTER TABLE ranked_runs ADD COLUMN profile_id TEXT;

CREATE TABLE ranked_profiles (
  profile_id TEXT PRIMARY KEY,
  ruleset_id TEXT NOT NULL,
  ruleset_hash TEXT NOT NULL,
  credential_verifier TEXT NOT NULL,
  revision INTEGER NOT NULL,
  canonical_profile_json TEXT NOT NULL,
  recent_ops_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX ranked_runs_profile_status_expires
  ON ranked_runs(profile_id, status, expires_at);
