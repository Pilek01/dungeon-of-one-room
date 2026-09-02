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

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const open = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
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

test("Observer Bot Forge recovery is bot-only and latched once per run/room", () => {
  const recoveryBody = sourceBetween(
    "function maybeObserverBotRecoverFromForgeBlockedTile()",
    "function getObserverBotPendingBlastMap()"
  );
  assert.match(recoveryBody, /isObserverBotActive\(\)/u);
  assert.match(recoveryBody, /isForgeBlockedTile\(state\.player\.x, state\.player\.y\)/u);
  assert.match(recoveryBody, /currentRunId/u);
  assert.match(recoveryBody, /roomIndex/u);
  assert.match(recoveryBody, /openEmergencyExtractConfirm\(\)/u);
  assert.match(recoveryBody, /confirmEmergencyExtract\(\)/u);

  const actionBody = sourceBetween(
    "function runObserverBotPlayingAction()",
    "function chooseObserverBotCampStartDepth()"
  );
  assert.match(actionBody, /maybeObserverBotRecoverFromForgeBlockedTile\(\)/u);
  assert.match(
    actionBody,
    /if \(maybeObserverBotRecoverFromForgeBlockedTile\(\)\) \{\s*return true;/u
  );
  assert.match(actionBody, /bot\.forgeRecoveryRunId\s*=\s*""[\s\S]*bot\.forgeRecoveryRoomIndex\s*=\s*-1/u);

  const initialStateStart = gameSource.indexOf("observerBot: {");
  const initialStateEnd = gameSource.indexOf("\n    },", initialStateStart);
  assert.ok(initialStateStart >= 0 && initialStateEnd > initialStateStart, "Observer Bot state is present");
  const initialState = gameSource.slice(initialStateStart, initialStateEnd);
  assert.match(initialState, /forgeRecoveryRunId/u);
  assert.match(initialState, /forgeRecoveryRoomIndex/u);

  const startRunStart = gameSource.indexOf("function startRun(options = {}) {");
  assert.ok(startRunStart >= 0, "startRun function is present");
  const startRunBody = gameSource.slice(startRunStart, startRunStart + 6000);
  assert.match(startRunBody, /forgeRecoveryRunId\s*=\s*""/u);
  assert.match(startRunBody, /forgeRecoveryRoomIndex\s*=\s*-1/u);

  const makeRecovery = new Function(
    "isObserverBotActive",
    "state",
    "isForgeBlockedTile",
    "confirmEmergencyExtract",
    "openEmergencyExtractConfirm",
    `return (${extractFunction(gameSource, "maybeObserverBotRecoverFromForgeBlockedTile")});`
  );

  let openCalls = 0;
  let confirmCalls = 0;
  const humanState = {
    phase: "playing",
    player: { x: 4, y: 1 },
    observerBot: { forgeRecoveryRunId: "", forgeRecoveryRoomIndex: -1 },
    currentRunId: "run-human",
    roomIndex: 2,
    extractConfirm: null
  };
  const humanRecovery = makeRecovery(
    () => false,
    humanState,
    () => true,
    () => { confirmCalls += 1; return true; },
    () => { openCalls += 1; return true; }
  );
  assert.equal(humanRecovery(), false);
  assert.equal(openCalls, 0, "human runs never trigger Forge recovery");
  assert.equal(confirmCalls, 0, "human runs never confirm emergency extraction");

  const botState = {
    phase: "playing",
    player: { x: 4, y: 1 },
    observerBot: { forgeRecoveryRunId: "", forgeRecoveryRoomIndex: -1 },
    currentRunId: "run-bot",
    roomIndex: 2,
    extractConfirm: null
  };
  openCalls = 0;
  confirmCalls = 0;
  const botRecovery = makeRecovery(
    () => true,
    botState,
    () => true,
    () => { confirmCalls += 1; return true; },
    () => { openCalls += 1; return true; }
  );
  assert.equal(botRecovery(), true);
  assert.equal(openCalls, 1);
  assert.equal(confirmCalls, 1);
  assert.equal(botState.observerBot.forgeRecoveryRunId, "run-bot");
  assert.equal(botState.observerBot.forgeRecoveryRoomIndex, 2);
  assert.equal(botRecovery(), false, "same run/room is latched after one recovery");
  assert.equal(openCalls, 1);
  assert.equal(confirmCalls, 1);

  botState.roomIndex = 3;
  assert.equal(botRecovery(), true, "new room resets recovery eligibility");
  assert.equal(botRecovery(), false, "new room identity is also latched after one recovery");
  assert.equal(openCalls, 2);
  assert.equal(confirmCalls, 2);
  botState.currentRunId = "run-bot-2";
  assert.equal(botRecovery(), true, "new run resets recovery eligibility");
  assert.equal(botRecovery(), false, "new run identity is also latched after one recovery");
  assert.equal(openCalls, 3);
  assert.equal(confirmCalls, 3);
});
