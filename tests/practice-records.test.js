const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const gameSource = fs.readFileSync(path.resolve(__dirname, "..", "game.js"), "utf8");

function functionBody(name, nextName) {
  const start = gameSource.indexOf(`  function ${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const end = nextName ? gameSource.indexOf(`  function ${nextName}`, start + 1) : gameSource.length;
  assert.notEqual(end, -1, `missing ${nextName}`);
  return gameSource.slice(start, end);
}

test("Practice records are written only at terminal defeat or victory", () => {
  assert.doesNotMatch(gameSource, /recordRunOnLeaderboard\("extract"\)/);
  assert.match(functionBody("triggerDepth100Victory", "isWardenDeathReason"), /recordRunOnLeaderboard\("victory"/);

  const gameOver = functionBody("gameOver", "checkRoomClearBonus");
  const terminalBranch = gameOver.indexOf("if (state.lives <= 0)");
  assert.ok(terminalBranch > 0);
  assert.doesNotMatch(gameOver.slice(0, terminalBranch), /recordRunOnLeaderboard/);
  assert.match(gameOver.slice(terminalBranch), /recordRunOnLeaderboard\("death"/);
});

test("Practice records remain local and capture a terminal build chronicle", () => {
  const record = functionBody("recordRunOnLeaderboard", "formatLeaderboardTimestamp");
  assert.doesNotMatch(record, /queueLeaderboardEntryForOnline/);
  assert.doesNotMatch(record, /LEADERBOARD_MIN_TURNS|depth <= 0/);
  assert.doesNotMatch(functionBody("enterMenu", "getCampUpgradeLevel"), /flushPendingLeaderboardQueue|refreshOnlineLeaderboard/);
  assert.match(record, /buildPracticeRecordBuild\(\)/);
  assert.match(record, /buildPracticeTerminalSummary/);
  assert.match(record, /durationMs/);
  assert.match(gameSource, /campaignStartedAt/);
  assert.match(gameSource, /campaignRoomsCompleted/);
});

test("Practice and Ranked terminal routing use their canonical destinations", () => {
  const routing = functionBody("openTerminalRecords", "openLeaderboardModal");
  assert.match(routing, /onlineV3Ranked/);
  assert.match(routing, /DungeonOnlineV3/);
  assert.match(routing, /openLeaderboard/);
  assert.match(routing, /openPracticeRecordsModal/);

  const modal = functionBody("buildPracticeRecordsModalHtml", "buildMutatorPanel");
  assert.match(modal, /Practice Records/);
  assert.match(modal, /record-archive/);
  assert.doesNotMatch(modal, /Source:/);
  assert.doesNotMatch(modal, /Current Season|Legacy/);
});

test("Legacy Practice entries disclose unavailable build details", () => {
  const detail = functionBody("buildPracticeRecordDetail", "buildPracticeRecordsRows");
  assert.match(detail, /legacy Practice record/i);
  assert.match(detail, /unavailable/i);
  assert.match(detail, /data-record-tooltip/);
  assert.match(detail, /data-practice-record-back/);
});
