function clone(value) {
  return value === null || value === undefined ? value : structuredClone(value);
}

export function createMemoryRepositories() {
  const runRows = new Map();
  const startKeys = new Map();
  const leaderboardRows = new Map();
  const metrics = {
    reads: 0,
    writes: 0,
    batches: 0,
    statements: []
  };

  function storeRun(state, metadata) {
    runRows.set(state.runId, {
      state: clone(state),
      stateDigest: metadata.stateDigest,
      recentOps: clone(metadata.recentOps)
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

    async updateConditional(state, expectedRevision, metadata) {
      metrics.writes += 1;
      metrics.statements.push("conditional_update_run");
      const current = runRows.get(state.runId);
      if (
        !current ||
        current.state.revision !== expectedRevision ||
        current.state.status !== "active"
      ) {
        return false;
      }
      storeRun(state, metadata);
      return true;
    },

    async finalizeAtomic(state, expectedRevision, metadata, leaderboardEntry) {
      metrics.batches += 1;
      metrics.writes += 2;
      metrics.statements.push("batch_finalize_run", "batch_insert_leaderboard");
      const current = runRows.get(state.runId);
      if (
        !current ||
        current.state.revision !== expectedRevision ||
        current.state.status !== "active" ||
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

  const leaderboard = {
    async list(season, options = {}) {
      metrics.reads += 1;
      metrics.statements.push("read_leaderboard");
      const limit = Math.max(1, Math.min(50, Number(options.limit) || 20));
      const entries = [...leaderboardRows.values()]
        .filter((entry) => entry.season === season)
        .sort((a, b) =>
          b.score - a.score ||
          a.createdAt - b.createdAt ||
          a.runId.localeCompare(b.runId)
        )
        .slice(0, limit)
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
      return { entries, cursor: null };
    },

    async detail(runId) {
      metrics.reads += 1;
      metrics.statements.push("read_leaderboard_detail");
      return clone(leaderboardRows.get(runId) || null);
    }
  };

  return {
    runs,
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
    leaderboardCount() {
      return leaderboardRows.size;
    }
  };
}
