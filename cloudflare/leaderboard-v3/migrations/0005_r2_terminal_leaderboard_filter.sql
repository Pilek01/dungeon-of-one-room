CREATE INDEX leaderboard_entries_terminal_season_score_created
  ON leaderboard_entries(season, score DESC, created_at ASC, run_id ASC)
  WHERE outcome IN ('defeat', 'victory');
