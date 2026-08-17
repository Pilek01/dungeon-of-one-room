import {
  DEFAULT_LEADERBOARD_LIMIT,
  MAX_LEADERBOARD_LIMIT
} from "../config.js";
import {
  decodeLeaderboardCursor,
  encodeLeaderboardCursor
} from "../domain/leaderboard-cursor.js";
import { canonicalJson } from "../security/canonical-json.js";

function compactEntry(row) {
  return {
    runId: row.run_id,
    playerName: row.player_name,
    score: row.score,
    depth: row.depth,
    gold: row.gold,
    durationMs: row.duration_ms,
    outcome: row.outcome,
    snapshotKind: row.snapshot_kind,
    assistanceClass: row.assistance_class,
    verificationLevel: row.verification_level,
    createdAt: row.created_at
  };
}

export function createD1LeaderboardRepository(db) {
  return {
    prepareUpsert(entry) {
      return db.prepare(`
        INSERT INTO leaderboard_entries (
          run_id, profile_id, season, player_name, score, depth, gold,
          duration_ms, outcome, build_json, summary_json,
          verification_level, state_digest, created_at, snapshot_kind,
          assistance_class
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE changes() = 1
        ON CONFLICT(season, profile_id, assistance_class) DO UPDATE SET
          run_id = excluded.run_id,
          player_name = excluded.player_name,
          score = excluded.score,
          depth = excluded.depth,
          gold = excluded.gold,
          duration_ms = excluded.duration_ms,
          outcome = excluded.outcome,
          build_json = excluded.build_json,
          summary_json = excluded.summary_json,
          verification_level = excluded.verification_level,
          state_digest = excluded.state_digest,
          created_at = excluded.created_at,
          snapshot_kind = excluded.snapshot_kind
        WHERE
          excluded.score > leaderboard_entries.score OR
          (excluded.score = leaderboard_entries.score AND excluded.depth > leaderboard_entries.depth) OR
          (excluded.score = leaderboard_entries.score AND excluded.depth = leaderboard_entries.depth AND excluded.gold > leaderboard_entries.gold) OR
          (excluded.score = leaderboard_entries.score AND excluded.depth = leaderboard_entries.depth AND excluded.gold = leaderboard_entries.gold AND excluded.run_id = leaderboard_entries.run_id AND
            CASE excluded.snapshot_kind WHEN 'final' THEN 2 WHEN 'extract' THEN 1 ELSE 0 END >
            CASE leaderboard_entries.snapshot_kind WHEN 'final' THEN 2 WHEN 'extract' THEN 1 ELSE 0 END) OR
          (excluded.score = leaderboard_entries.score AND excluded.depth = leaderboard_entries.depth AND excluded.gold = leaderboard_entries.gold AND excluded.created_at < leaderboard_entries.created_at AND
            (excluded.run_id <> leaderboard_entries.run_id OR
              CASE excluded.snapshot_kind WHEN 'final' THEN 2 WHEN 'extract' THEN 1 ELSE 0 END =
              CASE leaderboard_entries.snapshot_kind WHEN 'final' THEN 2 WHEN 'extract' THEN 1 ELSE 0 END)) OR
          (excluded.score = leaderboard_entries.score AND excluded.depth = leaderboard_entries.depth AND excluded.gold = leaderboard_entries.gold AND excluded.created_at = leaderboard_entries.created_at AND excluded.run_id < leaderboard_entries.run_id)
      `).bind(
        entry.runId,
        entry.profileId || entry.runId,
        entry.season,
        entry.playerName,
        entry.score,
        entry.depth,
        entry.gold,
        entry.durationMs,
        entry.outcome,
        canonicalJson(entry.build),
        canonicalJson(entry.summary),
        entry.verificationLevel,
        entry.stateDigest,
        entry.createdAt,
        entry.snapshotKind || "final",
        entry.assistanceClass || "none"
      );
    },

    prepareInsert(entry) {
      return this.prepareUpsert(entry);
    },

    prepareDeleteRun(runId) {
      return db.prepare(`
        DELETE FROM leaderboard_entries
        WHERE run_id = ? AND changes() = 1
      `).bind(runId);
    },

    async list(season, options = {}) {
      const limit = Math.min(
        MAX_LEADERBOARD_LIMIT,
        Math.max(1, Math.floor(Number(options.limit) || DEFAULT_LEADERBOARD_LIMIT))
      );
      const cursor = decodeLeaderboardCursor(options.cursor);
      const cursorClause = cursor
        ? `AND (
            score < ? OR
            (score = ? AND created_at > ?) OR
            (score = ? AND created_at = ? AND run_id > ?)
          )`
        : "";
      const statement = db.prepare(`
        SELECT run_id, player_name, score, depth, gold, duration_ms,
               outcome, verification_level, created_at, snapshot_kind,
               assistance_class
        FROM leaderboard_entries
        WHERE season = ? ${cursorClause}
        ORDER BY score DESC, created_at ASC, run_id ASC
        LIMIT ?
      `);
      const bound = cursor
        ? statement.bind(
          season,
          cursor.score,
          cursor.score,
          cursor.createdAt,
          cursor.score,
          cursor.createdAt,
          cursor.runId,
          limit + 1
        )
        : statement.bind(season, limit + 1);
      const result = await bound.all();
      const rows = Array.isArray(result.results) ? result.results : [];
      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);
      return {
        entries: page.map(compactEntry),
        cursor: hasMore ? encodeLeaderboardCursor(page.at(-1)) : null
      };
    },

    async detail(runId) {
      const row = await db.prepare(`
        SELECT run_id, season, player_name, score, depth, gold, duration_ms,
               outcome, build_json, summary_json, verification_level,
               state_digest, created_at, snapshot_kind, assistance_class
        FROM leaderboard_entries
        WHERE run_id = ?
      `).bind(runId).first();
      if (!row) return null;
      return {
        ...compactEntry(row),
        season: row.season,
        build: JSON.parse(row.build_json),
        summary: JSON.parse(row.summary_json),
        stateDigest: row.state_digest
      };
    }
  };
}
