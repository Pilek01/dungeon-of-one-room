import { canonicalJson } from "../security/canonical-json.js";
import { stateForDigest } from "../domain/run-state.js";
import { assertStoredRecentOperations } from "../domain/idempotency.js";

function changes(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

function stateFromRow(row) {
  if (!row) return null;
  const recentOps = assertStoredRecentOperations(JSON.parse(row.recent_ops_json));
  return {
    ...JSON.parse(row.canonical_state_json),
    stateDigest: row.state_digest,
    recentOps
  };
}

function runValues(state, stateDigest, recentOps) {
  const directive = state.roomDirective || state.currentRoomDirective;
  return [
    state.season,
    state.protocolVersion,
    state.rulesetHash,
    state.status,
    state.revision,
    state.playerName,
    state.depth,
    state.roomIndex,
    directive?.id || directive?.directiveId || null,
    directive?.roomType || null,
    directive?.roomNonce || null,
    state.gold,
    state.lives,
    canonicalJson(stateForDigest(state)),
    stateDigest,
    state.journalDigest || null,
    canonicalJson(recentOps),
    Math.max(0, Number(state.anomalyScore) || 0),
    state.updatedAt,
    state.expiresAt,
    state.finalizedAt,
    state.outcome
  ];
}

export function createD1RunRepository(db, leaderboardRepository, profileRepository) {
  return {
    async insert(state, metadata) {
      const directive = state.roomDirective || state.currentRoomDirective;
      try {
        await db.prepare(`
          INSERT INTO ranked_runs (
            run_id, profile_id, season, protocol_version, ruleset_hash, status, revision,
            player_name, depth, room_index, room_directive_id, room_type,
            room_nonce, gold, lives, canonical_state_json, state_digest,
            journal_digest, recent_ops_json, anomaly_score, started_at,
            updated_at, expires_at, finalized_at, outcome,
            start_idempotency_key, start_request_digest, recovery_verifier,
            recovery_issued_at, last_accessed_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
        `).bind(
          state.runId,
          state.profileId || null,
          state.season,
          state.protocolVersion,
          state.rulesetHash,
          state.status,
          state.revision,
          state.playerName,
          state.depth,
          state.roomIndex,
          directive?.id || directive?.directiveId || null,
          directive?.roomType || null,
          directive?.roomNonce || null,
          state.gold,
          state.lives,
          canonicalJson(stateForDigest(state)),
          metadata.stateDigest,
          state.journalDigest || null,
          canonicalJson(metadata.recentOps),
          Math.max(0, Number(state.anomalyScore) || 0),
          state.startedAt,
          state.updatedAt,
          state.expiresAt,
          state.finalizedAt,
          state.outcome,
          metadata.startIdempotencyKey,
          metadata.startRequestDigest,
          metadata.recoveryVerifier,
          metadata.recoveryIssuedAt,
          metadata.recoveryIssuedAt
        ).run();
        return true;
      } catch (cause) {
        if (!/unique constraint|constraint failed/iu.test(String(cause?.message || cause))) {
          throw cause;
        }
        const error = new Error("START_OPERATION_CONFLICT", { cause });
        error.code = "START_OPERATION_CONFLICT";
        throw error;
      }
    },

    async findByStartOperation(idempotencyKey) {
      const row = await db.prepare(`
        SELECT canonical_state_json, state_digest, recent_ops_json
        FROM ranked_runs
        WHERE start_idempotency_key = ?
      `).bind(idempotencyKey).first();
      return stateFromRow(row);
    },

    async get(runId) {
      const row = await db.prepare(`
        SELECT canonical_state_json, state_digest, recent_ops_json
        FROM ranked_runs
        WHERE run_id = ?
      `).bind(runId).first();
      return stateFromRow(row);
    },

    async getRecovery(runId) {
      const row = await db.prepare(`
        SELECT canonical_state_json, state_digest, recent_ops_json,
               recovery_verifier, recovery_issued_at, last_accessed_at
        FROM ranked_runs
        WHERE run_id = ?
      `).bind(runId).first();
      const state = stateFromRow(row);
      return state ? {
        state,
        recoveryVerifier: row.recovery_verifier,
        recoveryIssuedAt: row.recovery_issued_at,
        lastAccessedAt: row.last_accessed_at
      } : null;
    },

    async updateConditional(state, expectedRevision, metadata) {
      const result = await db.prepare(`
        UPDATE ranked_runs SET
          season = ?, protocol_version = ?, ruleset_hash = ?, status = ?,
          revision = ?, player_name = ?, depth = ?, room_index = ?,
          room_directive_id = ?, room_type = ?, room_nonce = ?, gold = ?,
          lives = ?, canonical_state_json = ?, state_digest = ?,
          journal_digest = ?, recent_ops_json = ?, anomaly_score = ?,
          updated_at = ?, expires_at = ?, finalized_at = ?, outcome = ?
        WHERE run_id = ? AND revision = ? AND status = ?
          AND (? IS NULL OR state_digest = ?)
      `).bind(
        ...runValues(state, metadata.stateDigest, metadata.recentOps),
        state.runId,
        expectedRevision,
        metadata.expectedStatus || "active",
        metadata.expectedStateDigest ?? null,
        metadata.expectedStateDigest ?? null
      ).run();
      return changes(result) === 1;
    },

    async updateWithProfileAtomic(
      state,
      expectedRevision,
      metadata,
      profile,
      expectedProfileRevision
    ) {
      if (!profileRepository) throw new TypeError("PROFILE_REPOSITORY_REQUIRED");
      const updateRun = db.prepare(`
        UPDATE ranked_runs SET
          season = ?, protocol_version = ?, ruleset_hash = ?, status = ?,
          revision = ?, player_name = ?, depth = ?, room_index = ?,
          room_directive_id = ?, room_type = ?, room_nonce = ?, gold = ?,
          lives = ?, canonical_state_json = ?, state_digest = ?,
          journal_digest = ?, recent_ops_json = ?, anomaly_score = ?,
          updated_at = ?, expires_at = ?, finalized_at = ?, outcome = ?
        WHERE run_id = ? AND revision = ? AND status = ?
          AND (? IS NULL OR state_digest = ?)
      `).bind(
        ...runValues(state, metadata.stateDigest, metadata.recentOps),
        state.runId,
        expectedRevision,
        metadata.expectedStatus || "active",
        metadata.expectedStateDigest ?? null,
        metadata.expectedStateDigest ?? null
      );
      const updateProfile = profileRepository.prepareConditionalUpdate(
        profile,
        expectedProfileRevision
      );
      const results = await db.batch([updateRun, updateProfile]);
      return changes(results[0]) === 1 && changes(results[1]) === 1;
    },
    async deleteExpired(now) {
      const result = await db.prepare(`
        DELETE FROM ranked_runs
        WHERE expires_at <= ?
          AND status <> 'finalized'
      `).bind(now).run();
      return changes(result);
    },

    async finalizeAtomic(state, expectedRevision, metadata, leaderboardEntry) {
      const update = db.prepare(`
        UPDATE ranked_runs SET
          season = ?, protocol_version = ?, ruleset_hash = ?, status = ?,
          revision = ?, player_name = ?, depth = ?, room_index = ?,
          room_directive_id = ?, room_type = ?, room_nonce = ?, gold = ?,
          lives = ?, canonical_state_json = ?, state_digest = ?,
          journal_digest = ?, recent_ops_json = ?, anomaly_score = ?,
          updated_at = ?, expires_at = ?, finalized_at = ?, outcome = ?
        WHERE run_id = ? AND revision = ? AND status = ?
          AND (? IS NULL OR state_digest = ?)
      `).bind(
        ...runValues(state, metadata.stateDigest, metadata.recentOps),
        state.runId,
        expectedRevision,
        metadata.expectedStatus || "active",
        metadata.expectedStateDigest ?? null,
        metadata.expectedStateDigest ?? null
      );
      const insert = leaderboardRepository.prepareInsert({
        ...leaderboardEntry,
        stateDigest: metadata.stateDigest,
        resultingRevision: state.revision
      });
      const results = await db.batch([update, insert]);
      return changes(results[0]) === 1 && changes(results[1]) === 1;
    }
  };
}
