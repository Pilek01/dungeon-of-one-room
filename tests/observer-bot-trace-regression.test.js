const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const gameSource = fs.readFileSync(path.resolve(__dirname, "..", "game.js"), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = gameSource.indexOf(startMarker);
  const end = gameSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${startMarker} source boundary`);
  return gameSource.slice(start, end);
}

test("Observer Bot trace captures portal and turn-finalization state", () => {
  const snapshotBody = sourceBetween(
    "function buildObserverTraceSnapshot()",
    "function appendObserverBotTrace("
  );

  for (const field of [
    "roomCleared",
    "portalPresent",
    "portalActive",
    "portalX",
    "portalY",
    "turnInProgress",
    "enemyTurnInProgress",
    "shieldTier",
    "skillShield",
    "fracturedShieldBarrier",
    "shieldStoredDamage",
    "playerShieldBrokeThisTurn"
  ]) {
    assert.match(snapshotBody, new RegExp(`\\b${field}:`), `${field} is exported in every trace snapshot`);
  }
});

test("Observer Bot trace schema documents portal and shield diagnostics", () => {
  const traceTextBody = sourceBetween(
    "function buildObserverBotTraceText()",
    "function downloadTextFile("
  );

  for (const field of [
    "roomCleared",
    "portalPresent",
    "portalActive",
    "turnInProgress",
    "enemyTurnInProgress",
    "shieldTier",
    "shieldStoredDamage",
    "playerShieldBrokeThisTurn"
  ]) {
    assert.match(traceTextBody, new RegExp(`\\b${field}\\b`), `${field} is documented in the trace schema`);
  }
});
