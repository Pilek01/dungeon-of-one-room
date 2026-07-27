import { canonicalJson } from "../security/canonical-json.js";
import { assertStoredRecentOperations } from "../domain/idempotency.js";

function changes(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

function profileFromRow(row) {
  if (!row) return null;
  return {
    profileId: row.profile_id,
    rulesetId: row.ruleset_id,
    rulesetHash: row.ruleset_hash,
    credentialVerifier: row.credential_verifier,
    revision: row.revision,
    state: JSON.parse(row.canonical_profile_json),
    recentOps: assertStoredRecentOperations(JSON.parse(row.recent_ops_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at
  };
}

export function createD1ProfileRepository(db) {
  return {
    async get(profileId) {
      const row = await db.prepare(`
        SELECT profile_id, ruleset_id, ruleset_hash, credential_verifier,
               revision, canonical_profile_json, recent_ops_json, created_at,
               updated_at, expires_at
        FROM ranked_profiles
        WHERE profile_id = ?
      `).bind(profileId).first();
      return profileFromRow(row);
    },

    async insert(profile) {
      await db.prepare(`
        INSERT INTO ranked_profiles (
          profile_id, ruleset_id, ruleset_hash, credential_verifier, revision,
          canonical_profile_json, recent_ops_json, created_at, updated_at,
          expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        profile.profileId,
        profile.rulesetId,
        profile.rulesetHash,
        profile.credentialVerifier,
        profile.revision,
        canonicalJson(profile.state),
        canonicalJson(profile.recentOps),
        profile.createdAt,
        profile.updatedAt,
        profile.expiresAt
      ).run();
      return true;
    },

    prepareConditionalUpdate(profile, expectedRevision) {
      return db.prepare(`
        UPDATE ranked_profiles SET
          revision = ?, canonical_profile_json = ?, recent_ops_json = ?,
          updated_at = ?, expires_at = ?
        WHERE profile_id = ? AND revision = ?
      `).bind(
        profile.revision,
        canonicalJson(profile.state),
        canonicalJson(profile.recentOps),
        profile.updatedAt,
        profile.expiresAt,
        profile.profileId,
        expectedRevision
      );
    },

    async updateConditional(profile, expectedRevision) {
      return changes(
        await this.prepareConditionalUpdate(profile, expectedRevision).run()
      ) === 1;
    },

    async countActiveRuns(profileId, now) {
      const row = await db.prepare(`
        SELECT COUNT(*) AS active_count
        FROM ranked_runs
        WHERE profile_id = ?
          AND status NOT IN ('finalized', 'abandoned')
          AND expires_at > ?
      `).bind(profileId, now).first();
      return Math.max(0, Number(row?.active_count) || 0);
    }
  };
}
