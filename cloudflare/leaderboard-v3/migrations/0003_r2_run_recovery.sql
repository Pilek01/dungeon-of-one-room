ALTER TABLE ranked_runs ADD COLUMN recovery_verifier TEXT;
ALTER TABLE ranked_runs ADD COLUMN recovery_issued_at INTEGER;
ALTER TABLE ranked_runs ADD COLUMN last_accessed_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_ranked_runs_recovery_retention
  ON ranked_runs (status, expires_at, last_accessed_at);
