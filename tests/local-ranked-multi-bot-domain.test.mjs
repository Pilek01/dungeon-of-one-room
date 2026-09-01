import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  MULTI_BOT_COUNT,
  assignedStartingRelicIndex,
  assertOwnedSessionChild,
  calculatePortraitTiles,
  createBotDescriptors,
  createMultiBotSessionPaths
} from "../scripts/local-ranked-multi-bot-domain.mjs";

test("distributes eight bots evenly across every available starting relic", () => {
  const assignments = Array.from(
    { length: 8 },
    (_, index) => assignedStartingRelicIndex(index + 1, 3)
  );
  assert.deepEqual(assignments, [0, 1, 2, 0, 1, 2, 0, 1]);
  assert.deepEqual([...new Set(assignments)].sort(), [0, 1, 2]);
});

test("tiles eight windows across the portrait working area", () => {
  assert.equal(MULTI_BOT_COUNT, 8);
  assert.deepEqual(calculatePortraitTiles({ x: 3440, y: 0, width: 1080, height: 1872 }), [
    { x: 3440, y: 0, width: 540, height: 468 },
    { x: 3980, y: 0, width: 540, height: 468 },
    { x: 3440, y: 468, width: 540, height: 468 },
    { x: 3980, y: 468, width: 540, height: 468 },
    { x: 3440, y: 936, width: 540, height: 468 },
    { x: 3980, y: 936, width: 540, height: 468 },
    { x: 3440, y: 1404, width: 540, height: 468 },
    { x: 3980, y: 1404, width: 540, height: 468 }
  ]);
});

test("creates exact bot names and isolated paths", () => {
  const root = path.resolve("D:/repo/output/multi-bot-runs/session-a");
  const bots = createBotDescriptors(root);
  assert.deepEqual(bots.map((bot) => bot.name), [
    "bot 1", "bot 2", "bot 3", "bot 4",
    "bot 5", "bot 6", "bot 7", "bot 8"
  ]);
  assert.equal(new Set(bots.map((bot) => bot.profileDir)).size, 8);
  assert.equal(new Set(bots.map((bot) => bot.artifactDir)).size, 8);
  assert.equal(new Set(bots.map((bot) => bot.resultPath)).size, 8);
  assert.equal(bots[0].resultPath, path.join(root, "bot-01", "bot-result.json"));
});

test("rejects cleanup paths outside the owned session root", () => {
  const paths = createMultiBotSessionPaths("D:/repo", "session-a");
  assert.throws(
    () => assertOwnedSessionChild(paths.sessionRoot, "D:/repo/output"),
    /outside the owned multi-bot session/u
  );
});
