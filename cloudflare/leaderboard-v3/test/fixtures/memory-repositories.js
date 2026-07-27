import {
  compareLeaderboardEntries,
  decodeLeaderboardCursor,
  encodeLeaderboardCursor,
  isAfterLeaderboardCursor
} from "../../src/domain/leaderboard-cursor.js";

function clone(value) {
  return value === null || value === undefined ? value : structuredClone(value);
}

export function createMemoryRepositories() {
  const runRows = new Map();
  const startKeys = new Map();
  const leaderboardRows = new Map();
  const profileRows = new Map();
  const metrics = {
    reads: 0,
    writes: 0,
    batches: 0,
    statements: []
  };

  function storeRun(state, metadata) {
    const current = runRows.get(state.runId);
    runRows.set(state.runId, {
      state: clone(state),
      stateDigest: metadata.stateDigest,
      recentOps: clone(metadata.recentOps),
      recoveryVerifier: metadata.recoveryVerifier ?? current?.recoveryVerifier ?? null,
      recoveryIssuedAt: metadata.recoveryIssuedAt ?? current?.recoveryIssuedAt ?? null,
      lastAccessedAt: metadata.recoveryIssuedAt ?? current?.lastAccessedAt ?? null
    });
  }

  const runs = {
    async insert(state, metadata) {
      metrics.writes += 1;
      metrics.statements.push("insert_run");
      const startKey = metadata.startIdempotencyKey;
      if (startKeys.has(startKey) || runRows.has(state.runId)) {
        const error = new Error("START_OPERATION_CONFLICT");
        error.code = "START_OPERATION_CONFLICT";
        throw error;
      }
      startKeys.set(startKey, state.runId);
      storeRun(state, metadata);
      return true;
    },

    async findByStartOperation(idempotencyKey) {
      metrics.reads += 1;
      metrics.statements.push("read_start_operation");
      const runId = startKeys.get(idempotencyKey);
      return runId ? this.peek(runId) : null;
    },

    async get(runId) {
      metrics.reads += 1;
      metrics.statements.push("read_run");
      return this.peek(runId);
    },

    peek(runId) {
      const row = runRows.get(runId);
      if (!row) return null;
      return {
        ...clone(row.state),
        stateDigest: row.stateDigest,
        recentOps: clone(row.recentOps)
      };
    },

    async getRecovery(runId) {
      metrics.reads += 1;
      metrics.statements.push("read_run_recovery");
      const row = runRows.get(runId);
      if (!row) return null;
      return {
        state: this.peek(runId),
        recoveryVerifier: row.recoveryVerifier,
        recoveryIssuedAt: row.recoveryIssuedAt,
        lastAccessedAt: row.lastAccessedAt
      };
    },

    async updateConditional(state, expectedRevision, metadata) {
      metrics.writes += 1;
      metrics.statements.push("conditional_update_run");
      const current = runRows.get(state.runId);
      if (
        !current ||
        current.state.revision !== expectedRevision ||
        current.state.status !== (metadata.expectedStatus || "active") ||
        metadata.expectedStateDigest !== undefined &&
          current.stateDigest !== metadata.expectedStateDigest
      ) {
        return false;
      }
      storeRun(state, metadata);
      return true;
    },

    async updateWithProfileAtomic(
      state,
      expectedRevision,
      metadata,
      profile,
      expectedProfileRevision
    ) {
      metrics.batches += 1;
      metrics.writes += 2;
      metrics.statements.push("batch_update_run", "batch_update_profile");
      const current = runRows.get(state.runId);
      const currentProfile = profileRows.get(profile.profileId);
      if (
        !current ||
        !currentProfile ||
        current.state.revision !== expectedRevision ||
        current.state.status !== (metadata.expectedStatus || "active") ||
        currentProfile.revision !== expectedProfileRevision ||
        metadata.expectedStateDigest !== undefined &&
          current.stateDigest !== metadata.expectedStateDigest
      ) {
        return false;
      }
      storeRun(state, metadata);
      profileRows.set(profile.profileId, clone(profile));
      return true;
    },
    async deleteExpired(now) {
      let deleted = 0;
      for (const [runId, row] of runRows) {
        if (row.state.status !== "finalized" && row.state.expiresAt <= now) {
          runRows.delete(runId);
          deleted += 1;
        }
      }
      metrics.writes += deleted;
      metrics.statements.push("delete_expired_runs");
      return deleted;
    },

    async finalizeAtomic(state, expectedRevision, metadata, leaderboardEntry) {
      metrics.batches += 1;
      metrics.writes += 2;
      metrics.statements.push("batch_finalize_run", "batch_insert_leaderboard");
      const current = runRows.get(state.runId);
      if (
        !current ||
        current.state.revision !== expectedRevision ||
        current.state.status !== (metadata.expectedStatus || "active") ||
        metadata.expectedStateDigest !== undefined &&
          current.stateDigest !== metadata.expectedStateDigest ||
        leaderboardRows.has(state.runId)
      ) {
        return false;
      }
      storeRun(state, metadata);
      leaderboardRows.set(state.runId, clone({
        ...leaderboardEntry,
        stateDigest: metadata.stateDigest
      }));
      return true;
    }
  };

  const profiles = {
    async get(profileId) {
      metrics.reads += 1;
      metrics.statements.push("read_profile");
      return clone(profileRows.get(profileId) || null);
    },

    async insert(profile) {
      metrics.writes += 1;
      metrics.statements.push("insert_profile");
      if (profileRows.has(profile.profileId)) {
        throw new Error("PROFILE_CONFLICT");
      }
      profileRows.set(profile.profileId, clone(profile));
      return true;
    },

    async updateConditional(profile, expectedRevision) {
      metrics.writes += 1;
      metrics.statements.push("conditional_update_profile");
      const current = profileRows.get(profile.profileId);
      if (!current || current.revision !== expectedRevision) return false;
      profileRows.set(profile.profileId, clone(profile));
      return true;
    },

    async countActiveRuns(profileId, now) {
      return [...runRows.values()].filter((row) =>
        row.state.profileId === profileId &&
        !["finalized", "abandoned"].includes(row.state.status) &&
        row.state.expiresAt > now
      ).length;
    }
  };
  const leaderboard = {
    async list(season, options = {}) {
      metrics.reads += 1;
      metrics.statements.push("read_leaderboard");
      const limit = Math.max(1, Math.min(50, Number(options.limit) || 20));
      const cursor = decodeLeaderboardCursor(options.cursor);
      const rows = [...leaderboardRows.values()]
        .filter((entry) => entry.season === season)
        .sort(compareLeaderboardEntries)
        .filter((entry) => isAfterLeaderboardCursor(entry, cursor))
        .slice(0, limit + 1);
      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);
      const entries = page
        .map((entry) => ({
          runId: entry.runId,
          playerName: entry.playerName,
          score: entry.score,
          depth: entry.depth,
          gold: entry.gold,
          durationMs: entry.durationMs,
          outcome: entry.outcome,
          verificationLevel: entry.verificationLevel,
          createdAt: entry.createdAt
        }));
      return {
        entries,
        cursor: hasMore ? encodeLeaderboardCursor(page.at(-1)) : null
      };
    },

    async detail(runId) {
      metrics.reads += 1;
      metrics.statements.push("read_leaderboard_detail");
      return clone(leaderboardRows.get(runId) || null);
    }
  };

  return {
    runs,
    profiles,
    leaderboard,
    metrics,
    resetMetrics() {
      metrics.reads = 0;
      metrics.writes = 0;
      metrics.batches = 0;
      metrics.statements.length = 0;
    },
    snapshotRun(runId) {
      return runs.peek(runId);
    },
    snapshotProfile(profileId) {
      return clone(profileRows.get(profileId) || null);
    },
    leaderboardCount() {
      return leaderboardRows.size;
    }
  };
}
