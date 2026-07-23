const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const gameSource = fs.readFileSync(path.resolve(__dirname, "..", "game.js"), "utf8");

test("late turn kills are followed by a final room-clear check", () => {
  const start = gameSource.indexOf("function finishTurnAfterEnemySequence()");
  const end = gameSource.indexOf("function startEnemyTurnSequence()", start);
  assert.ok(start >= 0 && end > start, "finishTurnAfterEnemySequence source boundary");
  const body = gameSource.slice(start, end);
  const lateEffect = body.indexOf("tickChaosOrb();");
  const finalClearCheck = body.indexOf("checkRoomClearBonus();", lateEffect);
  assert.ok(lateEffect >= 0, "Chaos Orb remains a late-turn effect");
  assert.ok(finalClearCheck > lateEffect, "late-turn kills must reveal the portal");
});
