const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const gameSource = fs.readFileSync(path.resolve(__dirname, "..", "game.js"), "utf8");
const practiceAdapterSource = fs.readFileSync(path.resolve(__dirname, "..", "practice-records-adapter.js"), "utf8");

function functionBody(name, nextName) {
  const start = gameSource.indexOf("  function " + name);
  assert.notEqual(start, -1, "missing " + name);
  const end = nextName ? gameSource.indexOf("  function " + nextName, start + 1) : gameSource.length;
  assert.notEqual(end, -1, "missing " + nextName);
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
  assert.match(record, /buildPracticeRecordBuild\(\)/);
  assert.match(record, /buildPracticeTerminalSummary/);
  assert.match(record, /durationMs/);
});

test("Practice and Ranked terminal routing keep canonical destinations and local presentation", () => {
  assert.match(gameSource, /state\.onlineV3Ranked[\s\S]*DungeonOnlineV3\?\.openLeaderboard/u);
  assert.match(gameSource, /Practice Records/u);
  assert.match(functionBody("buildPracticeRecordsModalHtml", "buildMutatorPanel"), /data-practice-record-archive/u);
  assert.doesNotMatch(practiceAdapterSource, /fetch\(|\/api\/v3\/leaderboard/u);
});

test("Practice adapter keeps records local, sorted, and explicit about legacy detail", () => {
  const adapterPath = path.resolve(__dirname, "..", "practice-records-adapter.js");
  delete require.cache[adapterPath];
  const adapter = require(adapterPath);
  const entries = [
    { runId: "run_3", playerName: "Cato", score: 300, depth: 7, gold: 40, ts: 3 },
    { runId: "run_1", playerName: "Ada", score: 500, depth: 9, gold: 80, ts: 1 },
    { runId: "run_4", playerName: "Dara", score: 200, depth: 6, gold: 20, ts: 4 },
    { runId: "run_2", playerName: "Bryn", score: 400, depth: 8, gold: 60, ts: 2 }
  ];
  const list = adapter.createListModel(entries, { sortMode: "score", limit: 4 });
  assert.deepEqual(list.rows.map((row) => row.runId), ["run_1", "run_2", "run_3", "run_4"]);
  assert.deepEqual(list.rows.map((row) => row.rank), [1, 2, 3, 4]);

  const detail = adapter.createDetailModel({
    ...entries[0],
    build: { relics: [{ relicId: "fang", stacks: 1 }], pacts: ["glass-cannon"] },
    durationMs: 0,
    summary: { roomsCompleted: 0, bossesCompleted: 0, damageDone: 0 },
    mutatorIds: ["greed"]
  }, {
    rank: 3,
    describeRelic: (id) => ({ name: id === "fang" ? "Fang Charm" : id, icon: "" }),
    describeMutator: () => ({ key: "G", name: "Greed", bonus: "+50% gold", drawback: "Enemies hit harder" })
  });
  assert.equal(detail.rank, 3);
  assert.match(detail.mutators.tooltip, /Greed.*\+50% gold.*Enemies hit harder/u);
  assert.equal(detail.chronicleFacts.find((fact) => fact.key === "time-played").value, "0s");

  const fourth = adapter.createDetailModel({
    ...entries[3],
    build: { relics: [{ relicId: "fang", stacks: 2 }], pacts: ["blood-pact"], skillTiers: {}, campUpgrades: {}, elixir: { type: "iron_guard" } },
    durationMs: 125000,
    summary: { roomsCompleted: 6, bossesCompleted: 1, livesRemaining: 0, damageDone: 12, deaths: 5 },
    mutatorIds: ["greed"]
  }, {
    rank: 4,
    describeRelic: (id) => ({ name: id === "fang" ? "Fang Charm" : id, icon: "" }),
    describeMutator: () => ({ key: "G", name: "Greed", bonus: "+50% gold", drawback: "Enemies hit harder" })
  });
  assert.equal(fourth.rank, 4);
  assert.equal(fourth.chronicleFacts.find((fact) => fact.key === "time-played").value, "2m 05s");
  assert.deepEqual(fourth.terminalFacts.map((fact) => fact.key), ["damageDone", "deaths"]);
  assert.match(fourth.mutators.tooltip, /Greed.*\+50% gold.*Enemies hit harder/u);

  const legacy = adapter.createDetailModel(entries[3], { rank: 4 });
  assert.match(legacy.notice, /unavailable/i);
  assert.equal(legacy.rank, 4);
});
