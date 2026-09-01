import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  botResultPath,
  listBotLeaderboard,
  mergeBotResult,
  writeBotResult
} from "../scripts/local-ranked-bot-results.mjs";

const COMMIT = "a".repeat(40);

function initialResult(overrides = {}) {
  return mergeBotResult(null, {
    sessionId: "session-20260901120000-abcd1234",
    botId: "bot-01",
    botName: "bot 1",
    commit: COMMIT,
    status: "starting",
    updatedAt: "2026-09-01T10:00:00.000Z",
    ...overrides
  });
}

test("merges stable launcher metrics and preserves immutable starting relic", () => {
  const running = mergeBotResult(initialResult(), {
    status: "running",
    startingRelic: { relicId: "fang", name: "Blood Fang" },
    updatedAt: "2026-09-01T10:01:00.000Z",
    sample: {
      game: { depth: 9, player: { hp: 54 } },
      observer: { lastDecision: "move" },
      relicNames: { fang: "Blood Fang", merchfavor1: "Merchant's Favor I" },
      snapshot: {
        publicState: {
          lives: 2,
          gold: 287,
          build: {
            relics: [
              { relicId: "fang", stacks: 1 },
              { relicId: "merchfavor1", stacks: 2 }
            ]
          },
          score: { score: 48_174, inputs: { acceptedRunGoldEarned: 1_942 } },
          mutatorProgress: { depthHighscore: 31 }
        }
      }
    }
  });
  const boundary = mergeBotResult(running, {
    status: "completed",
    startingRelic: { relicId: "chronoloop", name: "Chronoloop" },
    updatedAt: "2026-09-01T10:02:00.000Z",
    sample: {
      game: { phase: "defeat" },
      observer: { enabled: false },
      sessionState: "FINALIZED",
      snapshot: null
    }
  });

  assert.equal(boundary.depth, 9);
  assert.equal(boundary.depthHighscore, 31);
  assert.equal(boundary.score, 48_174);
  assert.equal(boundary.lives, 2);
  assert.equal(boundary.currentGold, 287);
  assert.equal(boundary.totalGoldEarned, 1_942);
  assert.equal(boundary.hp, 54);
  assert.equal(boundary.lastDecision, "move");
  assert.deepEqual(boundary.startingRelic, { relicId: "fang", name: "Blood Fang" });
  assert.deepEqual(boundary.relics, [
    { relicId: "fang", name: "Blood Fang", stacks: 1 },
    { relicId: "merchfavor1", name: "Merchant's Favor I", stacks: 2 }
  ]);
  assert.equal(boundary.buildLabel, "final_last_life");
  assert.equal(boundary.finishedAt, "2026-09-01T10:02:00.000Z");
});

test("uses latest explicit current values while keeping cumulative values monotonic", () => {
  const high = mergeBotResult(initialResult(), {
    status: "running",
    updatedAt: "2026-09-01T10:01:00.000Z",
    sample: {
      game: { depth: 12, player: { hp: 50 } },
      snapshot: { publicState: {
        lives: 3,
        gold: 400,
        score: { score: 900, inputs: { acceptedRunGoldEarned: 1_000 } },
        mutatorProgress: { depthHighscore: 12 }
      } }
    }
  });
  const nextLife = mergeBotResult(high, {
    status: "running",
    updatedAt: "2026-09-01T10:02:00.000Z",
    sample: {
      game: { depth: 1, player: { hp: 80 } },
      snapshot: { publicState: {
        lives: 2,
        gold: 20,
        score: { score: 850, inputs: { acceptedRunGoldEarned: 900 } },
        mutatorProgress: { depthHighscore: 1 }
      } }
    }
  });

  assert.equal(nextLife.depth, 1);
  assert.equal(nextLife.hp, 80);
  assert.equal(nextLife.lives, 2);
  assert.equal(nextLife.currentGold, 20);
  assert.equal(nextLife.score, 900);
  assert.equal(nextLife.depthHighscore, 12);
  assert.equal(nextLife.totalGoldEarned, 1_000);
});

test("creates only owned per-bot result paths", () => {
  const sessionRoot = path.resolve("D:/repo/output/multi-bot-runs/session-safe");
  assert.equal(
    botResultPath(sessionRoot, "bot-08"),
    path.join(sessionRoot, "bot-08", "bot-result.json")
  );
  assert.throws(() => botResultPath(sessionRoot, "../escape"), /bot-01 through bot-08/u);
});

test("writes results atomically in the owned bot directory", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dungeon-bot-result-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const resultPath = botResultPath(path.join(root, "session-20260901120000-abcd1234"), "bot-01");
  const result = initialResult({ status: "completed" });

  await writeBotResult(resultPath, result);

  assert.deepEqual(JSON.parse(await readFile(resultPath, "utf8")), result);
  await assert.rejects(readFile(`${resultPath}.tmp`, "utf8"), /ENOENT/u);
});

test("lists valid local records by score, depth, and time with Today scope", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dungeon-bot-leaderboard-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const records = [
    initialResult({ botId: "bot-01", botName: "bot 1", status: "completed", updatedAt: "2026-09-01T08:00:00.000Z" }),
    initialResult({ botId: "bot-02", botName: "bot 2", status: "failed", updatedAt: "2026-09-01T09:00:00.000Z" }),
    initialResult({ botId: "bot-03", botName: "bot 3", status: "completed", updatedAt: "2026-08-31T09:00:00.000Z" })
  ].map((record, index) => mergeBotResult(record, {
    status: record.status,
    updatedAt: record.updatedAt,
    sample: {
      game: { depth: index + 4, score: index === 0 ? 200 : 300 },
      snapshot: { publicState: { mutatorProgress: { depthHighscore: index === 1 ? 8 : 9 } } }
    }
  }));
  for (const record of records) {
    const target = botResultPath(path.join(root, record.sessionId), record.botId);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(record)}\n`, "utf8");
  }
  const malformed = path.join(root, "session-malformed", "bot-04");
  await mkdir(malformed, { recursive: true });
  await writeFile(path.join(malformed, "bot-result.json"), "not json", "utf8");
  const invalid = path.join(root, "session-invalid", "bot-04");
  await mkdir(invalid, { recursive: true });
  await writeFile(path.join(invalid, "bot-result.json"), JSON.stringify({
    ...records[0],
    sessionId: "session-invalid",
    botId: "bot-04",
    relics: [{ relicId: "fang", name: "Blood Fang", stacks: 0 }]
  }), "utf8");
  const oversized = path.join(root, "session-oversized", "bot-05");
  await mkdir(oversized, { recursive: true });
  await writeFile(path.join(oversized, "bot-result.json"), JSON.stringify({
    ...records[0],
    sessionId: "session-oversized",
    botId: "bot-05",
    error: "x".repeat(300_000)
  }), "utf8");

  const all = await listBotLeaderboard(root, { scope: "all" });
  assert.deepEqual(all.map((record) => record.botId), ["bot-03", "bot-02", "bot-01"]);

  const today = await listBotLeaderboard(root, {
    scope: "today",
    now: new Date("2026-09-01T12:00:00.000Z")
  });
  assert.deepEqual(today.map((record) => record.botId), ["bot-02", "bot-01"]);
});
