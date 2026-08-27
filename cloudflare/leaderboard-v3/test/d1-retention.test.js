import assert from "node:assert/strict";
import test from "node:test";
import { createD1RunRepository } from "../src/storage/d1-runs.js";

test("D1 retention removes non-finalized leaderboard children before expired runs", async () => {
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return { sql, values };
        }
      };
    },
    async batch(statements) {
      batches.push(statements);
      return [
        { meta: { changes: 1 } },
        { meta: { changes: 2 } }
      ];
    }
  };
  const repository = createD1RunRepository(db, {}, null);

  const deleted = await repository.deleteExpired(1_900_000_000_000);

  assert.equal(deleted, 2);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 2);
  assert.match(batches[0][0].sql, /DELETE FROM leaderboard_entries/u);
  assert.match(batches[0][0].sql, /status <> 'finalized'/u);
  assert.match(batches[0][1].sql, /DELETE FROM ranked_runs/u);
  assert.match(batches[0][1].sql, /status <> 'finalized'/u);
  assert.deepEqual(batches[0].map((statement) => statement.values), [
    [1_900_000_000_000],
    [1_900_000_000_000]
  ]);
});
