const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const gameSource = fs.readFileSync(path.resolve(__dirname, "..", "game.js"), "utf8");

test("Aegis Counter kills are followed by a final room-clear check", () => {
  const start = gameSource.indexOf("function finishTurnAfterEnemySequence()");
  const end = gameSource.indexOf("function startEnemyTurnSequence()", start);
  assert.ok(start >= 0 && end > start, "finishTurnAfterEnemySequence source boundary");
  const body = gameSource.slice(start, end);
  const aegisCounterEffect = body.indexOf("tickBarrier();");
  const finalClearCheck = body.indexOf("checkRoomClearBonus();", aegisCounterEffect);
  assert.ok(aegisCounterEffect >= 0, "Aegis Counter remains a late-turn barrier effect");
  assert.ok(finalClearCheck > aegisCounterEffect, "Aegis Counter kills must reveal the portal");
});

test("the first portal tutorial lets E and Q continue to their normal portal actions", () => {
  const start = gameSource.indexOf('if (\n      state.tutorialModalOpen &&\n      state.tutorialModalKind === "portal"');
  const end = gameSource.indexOf('if (state.phase === "dead"', start);
  assert.ok(start >= 0 && end > start, "tutorial input source boundary");
  const body = gameSource.slice(start, end);
  assert.match(
    body,
    /state\.tutorialModalKind === "portal"[\s\S]*state\.phase === "playing"[\s\S]*isOnPortal\(\)[\s\S]*\(key === "e" \|\| key === "q"\)[\s\S]*closeTutorialModal\(\);[\s\S]*else if \(state\.tutorialModalOpen\)/u
  );
});
