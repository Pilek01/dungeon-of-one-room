const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const gameSource = fs.readFileSync(path.resolve(__dirname, "..", "game.js"), "utf8");
const practiceAdapterSource = fs.readFileSync(path.resolve(__dirname, "..", "practice-records-adapter.js"), "utf8");
const rankedRuntimeSource = fs.readFileSync(path.resolve(__dirname, "..", "online-v3", "ranked-v3-runtime.js"), "utf8");

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
  assert.match(gameSource, /DungeonOnlineV3\?\.openLeaderboard\?\.\(opener\)/u);
  assert.match(gameSource, /Practice Records/u);
  assert.match(functionBody("buildPracticeRecordsModalHtml", "buildMutatorPanel"), /data-practice-record-archive/u);
  assert.doesNotMatch(practiceAdapterSource, /fetch\(|\/api\/v3\/leaderboard/u);
});

test("Practice mounts the canonical reference-plate lifecycle without the legacy renderer", () => {
  const mount = functionBody("renderPracticeRecordsMount", "buildPracticeRecordsModalHtml");
  const modal = functionBody("buildPracticeRecordsModalHtml", "buildMutatorPanel");
  assert.match(mount, /DungeonRankedV3LeaderboardUi/u);
  assert.match(mount, /createLeaderboardPresentation/u);
  assert.match(mount, /renderList/u);
  assert.match(mount, /renderDetail/u);
  assert.doesNotMatch(mount, /DungeonRecordArchiveUi/u);
  assert.match(gameSource, /screenOverlayEl\.className = "screen-overlay visible ranked-v3-overlay"/u);
  assert.match(gameSource, /screenOverlayEl\.dataset\.view = "reference-plate"/u);
  assert.match(modal, /ranked-v3-card-reference-plate/u);
  assert.match(modal, /ranked-v3-body-reference-plate/u);
  assert.doesNotMatch(modal, /record-archive-v2/u);
  assert.match(gameSource, /practiceRecordPage:\s*1/u);
  assert.match(gameSource, /practiceRecordFocusToken:\s*null/u);
  assert.match(gameSource, /practiceRecordReturnFocus:\s*null/u);
  assert.match(mount, /createReferencePlateFocusToken/u);
  assert.match(mount, /focusReferencePlateAction/u);
});

test("Practice archive keeps T as its only global sort shortcut and remains local", () => {
  const keydownStart = gameSource.indexOf('window.addEventListener("keydown"');
  const branchStart = gameSource.indexOf('if (state.leaderboardModalOpen && state.phase === "menu") {', keydownStart);
  const branchEnd = gameSource.indexOf('if (state.phase === "menu" && state.menuNewGameConfirmOpen)', branchStart);
  assert.ok(branchStart >= 0);
  assert.ok(branchEnd > branchStart);
  const practiceBranch = gameSource.slice(branchStart, branchEnd);
  assert.match(practiceBranch, /key === "t"/u);
  assert.doesNotMatch(practiceBranch, /key === "tab"|key === "arrowleft"|key === "arrowright"|isConfirm/u);
  assert.doesNotMatch(functionBody("renderPracticeRecordsMount", "buildPracticeRecordsModalHtml"), /fetch\(|\/api\/v3\/leaderboard/u);
});

test("Online leaderboard owns external opener and canonical detail rank/focus lifecycle", () => {
  assert.match(rankedRuntimeSource, /leaderboardReturnFocus/u);
  assert.match(rankedRuntimeSource, /createReferencePlateFocusToken/u);
  assert.match(rankedRuntimeSource, /focusReferencePlateAction/u);
  assert.match(rankedRuntimeSource, /createLeaderboardPresentation\(leaderboardRows, leaderboardPage\)/u);
  assert.match(rankedRuntimeSource, /renderList\(root\.document, presentation/u);
  assert.match(rankedRuntimeSource, /renderDetail\(root\.document, detail/u);
  assert.match(rankedRuntimeSource, /entry\.rank|rank:\s*selected/u);
  assert.match(rankedRuntimeSource, /closeLeaderboardOverlay/u);
  assert.match(rankedRuntimeSource, /openLeaderboard:\s*\(opener = null\) => openLeaderboard\(true, opener\)/u);
  assert.doesNotMatch(rankedRuntimeSource, /if \(!leaderboardRows\.length\)\s*\{/u);
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


  const complete = {
    runId: "run_2",
    playerName: "Bryn",
    score: 400,
    depth: 8,
    gold: 60,
    durationMs: 125000,
    outcome: "victory",
    build: {
      relics: [{ relicId: "fang", stacks: 2 }],
      pacts: ["blood-pact"],
      skillTiers: { slash: 3 },
      campUpgrades: { forge: 2 },
      elixir: { type: "iron_guard" }
    },
    summary: { roomsCompleted: 6, bossesCompleted: 1, damageDone: 12 },
    mutatorIds: ["greed"]
  };
  const payload = adapter.createReferencePlatePayload(complete, {
    rank: 4,
    describeMutator: () => ({ key: "G", name: "Greed" })
  });
  assert.equal(payload.entry.rank, 4);
  assert.equal(payload.entry.runId, "run_2");
  assert.equal(payload.entry.score, 400);
  assert.equal(payload.entry.depth, 8);
  assert.equal(payload.entry.gold, 60);
  assert.equal(payload.entry.durationMs, 125000);
  assert.equal(payload.entry.outcome, "victory");
  assert.equal(payload.entry.detailsAvailable, true);
  assert.deepEqual(payload.entry.build.relics, [{ relicId: "fang", stacks: 2 }]);
  assert.deepEqual(payload.entry.build.pacts, ["blood-pact"]);
  assert.deepEqual(payload.entry.build.skillTiers, { slash: 3 });
  assert.deepEqual(payload.entry.build.campUpgrades, { forge: 2 });
  assert.deepEqual(payload.entry.build.elixirs, [{ type: "iron_guard" }]);
  assert.deepEqual(payload.entry.build.runModifiers.active, [
    { modifierId: "greed", stacks: 1 }
  ]);
  assert.equal(payload.entry.summary.durationMs, 125000);
  assert.equal(payload.entry.summary.gold.earned, complete.gold);
  assert.equal(payload.entry.summary.roomsCompleted, 6);
  assert.equal(payload.entry.summary.bossesCompleted, 1);
  assert.equal(payload.entry.summary.damageDone, 12);

  const legacyProjection = adapter.createReferencePlatePayload({
    runId: "legacy",
    playerName: "Legacy",
    score: 200,
    depth: 6
  }, { rank: 4 });
  assert.equal(legacyProjection.entry.detailsAvailable, false);
  assert.match(legacyProjection.entry.detailsUnavailableNotice, /unavailable/iu);
  assert.equal(Object.hasOwn(legacyProjection.entry, "gold"), false);
  assert.equal(Object.hasOwn(legacyProjection.entry, "build"), false);
  assert.equal(Object.hasOwn(legacyProjection.entry, "summary"), false);

  const sparseLegacy = adapter.createReferencePlatePayload({
    runId: "sparse",
    playerName: "Sparse",
    score: 50
  }, { rank: 2 });
  assert.equal(sparseLegacy.entry.detailsAvailable, false);
  assert.equal(Object.hasOwn(sparseLegacy.entry, "depth"), false);
  assert.equal(Object.hasOwn(sparseLegacy.entry, "durationMs"), false);
  assert.equal(Object.hasOwn(sparseLegacy.entry, "outcome"), false);

  const rowsWithMetadata = adapter.createListModel([
    { ...complete, durationMs: 125000, outcome: "victory" }
  ]).rows;
  assert.equal(rowsWithMetadata[0].durationMs, 125000);
  assert.equal(rowsWithMetadata[0].outcome, "victory");
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
