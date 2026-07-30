ALTER TABLE leaderboard_entries ADD COLUMN profile_id TEXT;

UPDATE leaderboard_entries
SET profile_id = (
  SELECT ranked_runs.profile_id
  FROM ranked_runs
  WHERE ranked_runs.run_id = leaderboard_entries.run_id
);

DELETE FROM leaderboard_entries
WHERE profile_id IS NULL;

DELETE FROM leaderboard_entries
WHERE run_id IN (
  SELECT run_id
  FROM (
    SELECT
      run_id,
      ROW_NUMBER() OVER (
        PARTITION BY season, profile_id
        ORDER BY score DESC, depth DESC, gold DESC, created_at ASC, run_id ASC
      ) AS campaign_rank
    FROM leaderboard_entries
  )
  WHERE campaign_rank > 1
);

CREATE UNIQUE INDEX leaderboard_entries_season_profile
  ON leaderboard_entries(season, profile_id);
