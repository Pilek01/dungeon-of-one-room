ALTER TABLE leaderboard_entries
  ADD COLUMN snapshot_kind TEXT NOT NULL DEFAULT 'final';

ALTER TABLE leaderboard_entries
  ADD COLUMN assistance_class TEXT NOT NULL DEFAULT 'none';

DROP INDEX leaderboard_entries_season_profile;

CREATE UNIQUE INDEX leaderboard_entries_season_profile_assistance
  ON leaderboard_entries(season, profile_id, assistance_class);

DROP INDEX leaderboard_entries_terminal_season_score_created;

CREATE INDEX leaderboard_entries_official_season_score_created
  ON leaderboard_entries(season, score DESC, created_at ASC, run_id ASC)
  WHERE assistance_class = 'none';
