const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toLowerCase();
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = "";
    this.textContent = "";
    this.type = "";
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  addEventListener(name, listener) {
    this.listeners.set(String(name), listener);
  }

  click() {
    this.listeners.get("click")?.();
  }
}

function createDocument() {
  return Object.freeze({
    createElement(tagName) {
      return new FakeElement(tagName);
    }
  });
}

function visit(node, predicate, result = []) {
  if (predicate(node)) result.push(node);
  for (const child of node.children || []) visit(child, predicate, result);
  return result;
}

function allText(node) {
  return [node.textContent, ...(node.children || []).map(allText)].join(" ");
}

function loadUi() {
  const modulePath = path.resolve(__dirname, "..", "online-v3", "ranked-v3-leaderboard-ui.js");
  delete require.cache[modulePath];
  global.DungeonRelicData = {
    RELICS: [
      {
        id: "crownconcord",
        name: "Crown Concord",
        desc: "You can equip up to 2 legendary relics",
        icon: "assets/hd/ui/relics/crownconcord.png"
      },
      { id: "second-relic", name: "Second Relic", desc: "Second relic description" }
    ]
  };
  global.DungeonMutatorData = {
    MUTATORS: [{
      id: "greed",
      key: "G",
      name: "Greed",
      bonus: "+50% gold",
      drawback: "Enemies hit harder"
    }]
  };
  return require(modulePath);
}

function loadPracticeAdapter() {
  const modulePath = path.resolve(__dirname, "..", "practice-records-adapter.js");
  delete require.cache[modulePath];
  return require(modulePath);
}

function classShape(node) {
  return [node.tagName, node.className, (node.children || []).map(classShape)];
}

test("Ranked leaderboard plate keeps Top 3 and renders seven interactive ledger slots", () => {
  const ui = loadUi();
  const documentRef = createDocument();
  const opened = [];
  const pages = [];
  const closed = [];
  const rows = ui.createLeaderboardViewModel({
    entries: Array.from({ length: 17 }, (_, index) => ({
      runId: `run_${String(index + 1).padStart(8, "0")}`,
      playerName: index === 10 ? "<img src=x onerror=alert(1)>" : `Player ${index + 1}`,
      score: 43_600 - index,
      depth: 19 - index,
      gold: 8_550 - index
    }))
  }).rows;
  const presentation = ui.createLeaderboardPresentation(rows, 2);
  const plate = ui.renderList(documentRef, presentation, {
    onOpen: (runId) => opened.push(runId),
    onPage: (page) => pages.push(page),
    onClose: () => closed.push(true)
  });
  const hasClass = (node, className) => String(node.className).split(/\s+/u).includes(className);

  assert.equal(hasClass(plate, "ranked-v3-reference-plate"), true);
  assert.equal(hasClass(plate, "ranked-v3-reference-plate--leaderboard"), true);
  assert.equal(hasClass(plate, "ranked-v3-leaderboard-list"), true);
  const art = visit(plate, (node) => hasClass(node, "ranked-v3-reference-plate-art"));
  assert.equal(art.length, 1);
  assert.equal(art[0].attributes.get("aria-hidden"), "true");
  assert.equal(visit(plate, (node) => hasClass(node, "ranked-v3-podium-slot")).length, 3);
  const podiumRanks = visit(plate, (node) => hasClass(node, "ranked-v3-podium-slot"))
    .flatMap((slot) => visit(slot, (node) => hasClass(node, "ranked-v3-leaderboard-rank")));
  assert.deepEqual(podiumRanks.map((node) => node.textContent), ["1", "2", "3"]);
  assert.deepEqual(podiumRanks.map((node) => node.attributes.get("aria-hidden")), ["true", "true", "true"]);
  const accessibleRanks = visit(plate, (node) => hasClass(node, "ranked-v3-rank-label"));
  assert.deepEqual(accessibleRanks.map((node) => node.textContent), ["Rank 1", "Rank 2", "Rank 3"]);
  assert.equal(visit(plate, (node) => hasClass(node, "ranked-v3-ledger-slot")).length, 7);
  const scoreValues = visit(plate, (node) => hasClass(node, "ranked-v3-score-value"));
  const scoreUnits = visit(plate, (node) => hasClass(node, "ranked-v3-score-unit"));
  assert.equal(scoreValues.length, 10);
  assert.equal(scoreUnits.length, 10);
  assert.equal(scoreValues[0].textContent, "43,600");
  assert.equal(scoreUnits[0].textContent, "pts");

  const playerEleven = visit(plate, (node) => node.tagName === "button" && node.textContent === "<img src=x onerror=alert(1)>");
  assert.equal(playerEleven.length, 1);
  playerEleven[0].click();
  assert.deepEqual(opened, ["run_00000011"]);
  assert.match(allText(plate), /Page 2 \/ 2.*Ranks 11-17/isu);
  assert.doesNotMatch(allText(plate), /defeat|victory|duration/iu);

  const previous = visit(plate, (node) => node.tagName === "button" && node.textContent === "Previous page");
  const next = visit(plate, (node) => node.tagName === "button" && node.textContent === "Next page");
  const close = visit(plate, (node) => node.tagName === "button" && node.textContent === "Close");
  assert.equal(previous.length, 1);
  assert.equal(next.length, 1);
  assert.equal(next[0].disabled, true);
  previous[0].click();
  close[0].click();
  assert.deepEqual(pages, [1]);
  assert.deepEqual(closed, [true]);
});
test("Ranked presentation keeps the Top 3 while paging ranks 4 through 73", () => {
  const ui = loadUi();
  const entries = Array.from({ length: 73 }, (_, index) => ({
    runId: `run_${String(index + 1).padStart(8, "0")}`,
    playerName: `Player ${index + 1}`,
    score: 100_000 - index,
    depth: 73 - index,
    gold: index * 10
  }));
  const rows = ui.createLeaderboardViewModel({ entries }).rows;

  const pageTwo = ui.createLeaderboardPresentation(rows, 2);
  assert.deepEqual(pageTwo.podium.map((row) => row.rank), [1, 2, 3]);
  assert.deepEqual(pageTwo.ledger.map((row) => row.rank), [11, 12, 13, 14, 15, 16, 17]);
  assert.equal(pageTwo.page, 2);
  assert.equal(pageTwo.pageCount, 10);
  assert.equal(pageTwo.pageLabel, "Page 2 / 10");
  assert.equal(pageTwo.rangeLabel, "Ranks 11-17");
  assert.equal(pageTwo.canGoPrevious, true);
  assert.equal(pageTwo.canGoNext, true);

  const finalPage = ui.createLeaderboardPresentation(rows, 99);
  assert.equal(finalPage.page, 10);
  assert.deepEqual(finalPage.ledger.map((row) => row.rank), [67, 68, 69, 70, 71, 72, 73]);
  assert.equal(finalPage.canGoNext, false);
});

test("Practice adapter rows use the canonical leaderboard presentation and DOM shape", () => {
  const ui = loadUi();
  const adapter = loadPracticeAdapter();
  const entries = Array.from({ length: 20 }, (_, index) => ({
    runId: `practice_${index + 1}`,
    playerName: `Practice ${index + 1}`,
    score: 20_000 - index,
    depth: 20 - index,
    gold: index
  }));
  const practiceRows = adapter.createListModel(entries, { sortMode: "score", limit: 20 }).rows;
  const practicePresentation = ui.createLeaderboardPresentation(practiceRows, 2);
  const practicePlate = ui.renderList(createDocument(), practicePresentation);
  const onlineRows = ui.createLeaderboardViewModel({ entries }).rows;
  const onlinePlate = ui.renderList(createDocument(), ui.createLeaderboardPresentation(onlineRows, 2));
  const hasClass = (node, className) => String(node.className).split(/\s+/u).includes(className);
  const ledger = visit(practicePlate, (node) => hasClass(node, "ranked-v3-ledger-slot"));

  assert.deepEqual(classShape(practicePlate), classShape(onlinePlate));
  assert.equal(visit(practicePlate, (node) => hasClass(node, "ranked-v3-podium-slot")).length, 3);
  assert.equal(ledger.length, 7);
  assert.deepEqual(ledger.map((slot) => slot.attributes.get("data-record-rank")), ["11", "12", "13", "14", "15", "16", "17"]);
  assert.match(allText(practicePlate), /Page 2 \/ 3.*Ranks 11-17/isu);
});

test("Practice reference payload renders the canonical Inspect root and ten equipment slots", () => {
  const ui = loadUi();
  const adapter = loadPracticeAdapter();
  const payload = adapter.createReferencePlatePayload({
    runId: "practice_complete",
    playerName: "Practice Ada",
    score: 4_200,
    depth: 8,
    gold: 120,
    durationMs: 125_000,
    outcome: "victory",
    build: { relics: [{ relicId: "crownconcord", stacks: 2 }] },
    summary: { roomsCompleted: 6, bossesCompleted: 1 }
  }, { rank: 4 });
  const detail = ui.createDetailViewModel(payload);
  const practicePlate = ui.renderDetail(createDocument(), detail);
  const onlinePlate = ui.renderDetail(createDocument(), ui.createDetailViewModel({
    entry: { ...payload.entry, detailsAvailable: undefined }
  }));
  const hasClass = (node, className) => String(node.className).split(/\s+/u).includes(className);

  assert.equal(detail.detailsAvailable, true);
  assert.equal(detail.detailsUnavailableNotice, "");
  assert.deepEqual(classShape(practicePlate), classShape(onlinePlate));
  assert.equal(hasClass(practicePlate, "ranked-v3-reference-plate"), true);
  assert.equal(hasClass(practicePlate, "ranked-v3-reference-plate--inspect"), true);
  assert.equal(visit(practicePlate, (node) => hasClass(node, "ranked-v3-inspect-equipment-slot")).length, 10);
});

test("Inspect detail preserves explicit availability flags and renders a neutral legacy notice", () => {
  const ui = loadUi();
  const available = ui.createDetailViewModel({ entry: { playerName: "Online" } });
  const unavailable = ui.createDetailViewModel({
    entry: {
      runId: "legacy_practice",
      rank: 73,
      playerName: "Legacy Practice",
      score: 88,
      depth: 6,
      detailsAvailable: false,
      detailsUnavailableNotice: "Build Chronicle unavailable for this legacy Practice record."
    }
  });
  assert.equal(available.detailsAvailable, true);
  assert.equal(available.detailsUnavailableNotice, "");
  assert.equal(unavailable.detailsAvailable, false);
  assert.equal(unavailable.detailsUnavailableNotice, "Build Chronicle unavailable for this legacy Practice record.");

  const returned = [];
  const plate = ui.renderDetail(createDocument(), unavailable, { onBack: () => returned.push(true) });
  const hasClass = (node, className) => String(node.className).split(/\s+/u).includes(className);
  const notice = visit(plate, (node) => hasClass(node, "ranked-v3-inspect-unavailable"));
  const back = visit(plate, (node) => hasClass(node, "ranked-v3-inspect-back"));

  assert.equal(hasClass(plate, "ranked-v3-reference-plate"), true);
  assert.equal(visit(plate, (node) => hasClass(node, "ranked-v3-reference-plate-art")).length, 1);
  assert.equal(notice.length, 1);
  assert.equal(notice[0].textContent, unavailable.detailsUnavailableNotice);
  const loadout = visit(plate, (node) => hasClass(node, "ranked-v3-inspect-loadout"));
  assert.equal(loadout.length, 1);
  assert.equal(visit(loadout[0], (node) => hasClass(node, "ranked-v3-inspect-unavailable")).length, 1);
  assert.deepEqual(visit(plate, (node) => hasClass(node, "ranked-v3-score-value")).map((node) => node.textContent), ["88"]);
  assert.match(allText(plate), /Depth.*6/isu);
  assert.equal(visit(plate, (node) => hasClass(node, "ranked-v3-inspect-gold")).length, 0);
  assert.equal(visit(plate, (node) => hasClass(node, "ranked-v3-inspect-equipment-slot")).length, 0);
  assert.equal(visit(plate, (node) => hasClass(node, "ranked-v3-inspect-chronicle-row")).length, 0);
  assert.equal(visit(plate, (node) => hasClass(node, "ranked-v3-inspect-terminal")).length, 0);
  assert.doesNotMatch(allText(plate), /Game Over|Cause not recorded|\b0\b/iu);
  assert.equal(back.length, 1);
  back[0].click();
  assert.deepEqual(returned, [true]);
});

test("Inspect rank exposes numeric rank and single or double digit metadata", () => {
  const ui = loadUi();
  const hasClass = (node, className) => String(node.className).split(/\s+/u).includes(className);
  for (const [rank, digits] of [[1, "single"], [9, "single"], [10, "double"], [73, "double"]]) {
    const detail = ui.createDetailViewModel({ entry: { rank, playerName: "Ranked", score: 1 } });
    const plate = ui.renderDetail(createDocument(), detail);
    const rankNode = visit(plate, (node) => hasClass(node, "ranked-v3-inspect-rank"))[0];
    assert.equal(rankNode.attributes.get("data-record-rank"), String(rank));
    assert.equal(rankNode.attributes.get("data-rank-digits"), digits);
  }
});

test("Ranked collection follows opaque cursors once and caps the authoritative order at 73", async () => {
  const ui = loadUi();
  const calls = [];
  const makeEntries = (start, count) => Array.from({ length: count }, (_, index) => ({
    runId: `run_${String(start + index).padStart(8, "0")}`,
    playerName: `Player ${start + index}`,
    score: 100000 - start - index,
    depth: 80 - start - index,
    gold: start + index
  }));
  const rows = await ui.collectLeaderboardRows(async (request) => {
    calls.push(request);
    return request.cursor
      ? { season: "season-a", entries: makeEntries(51, 23), cursor: "third-page-must-not-load" }
      : { season: "season-a", entries: makeEntries(1, 50), cursor: "opaque+/cursor==" };
  }, { season: "season-a" });

  assert.deepEqual(calls, [
    { season: "season-a", limit: 50, cursor: "" },
    { season: "season-a", limit: 50, cursor: "opaque+/cursor==" }
  ]);
  assert.equal(rows.length, 73);
  assert.deepEqual(rows.slice(0, 3).map((row) => row.runId), ["run_00000001", "run_00000002", "run_00000003"]);
  assert.deepEqual(rows.slice(-3).map((row) => row.runId), ["run_00000071", "run_00000072", "run_00000073"]);
  assert.deepEqual(rows.slice(-3).map((row) => row.rank), [71, 72, 73]);
});
test("Ranked inspect plate renders only the approved build and Chronicle fields", () => {
  const ui = loadUi();
  const documentRef = createDocument();
  const returned = [];
  const closed = [];
  const detail = ui.createDetailViewModel({
    entry: {
      runId: "run_aaaaaaaa",
      playerName: "Ada",
      rank: 1,
      score: 43600,
      depth: 19,
      gold: 700,
      outcome: "defeat",
      build: {
        relics: [
          { relicId: "crownconcord", stacks: 2 },
          { relicId: "second-relic", stacks: 1 },
          { relicId: "third-relic", stacks: 1 },
          { relicId: "fourth-relic", stacks: 1 },
          { relicId: "fifth-relic", stacks: 1 },
          { relicId: "sixth-relic", stacks: 1 },
          { relicId: "seventh-relic", stacks: 1 },
          { relicId: "eighth-relic", stacks: 1 },
          { relicId: "ninth-relic", stacks: 1 },
          { relicId: "tenth-relic", stacks: 1 },
          { relicId: "ignored-relic", stacks: 1 }
        ],
        pacts: ["glass-cannon"],
        skillTiers: { dash: 2 },
        campUpgrades: { hp: 1 },
        elixirs: [{ elixirId: "haste" }],
        runModifiers: { active: [{ modifierId: "greed", stacks: 1 }] }
      },
      summary: {
        durationMs: 3723000,
        roomsCompleted: 312,
        bossesCompleted: 7,
        gold: { earned: 8550 },
        presentationCause: "Defeated by The Hollow Seraph",
        rulesetId: "v08-meta-1",
        scoreVersion: "v08-score-1"
      }
    }
  });
  const plate = ui.renderDetail(documentRef, detail, {
    onBack: () => returned.push(true),
    onClose: () => closed.push(true)
  });
  const hasClass = (node, className) => String(node.className).split(/\s+/u).includes(className);
  const text = allText(plate);

  assert.equal(hasClass(plate, "ranked-v3-reference-plate"), true);
  assert.equal(hasClass(plate, "ranked-v3-reference-plate--inspect"), true);
  const art = visit(plate, (node) => hasClass(node, "ranked-v3-reference-plate-art"));
  assert.equal(art.length, 1);
  assert.equal(art[0].attributes.get("aria-hidden"), "true");
  const depthStat = visit(plate, (node) => hasClass(node, "ranked-v3-inspect-depth"));
  const goldStat = visit(plate, (node) => hasClass(node, "ranked-v3-inspect-gold"));
  assert.deepEqual(
    depthStat[0].children.map((node) => [node.className, node.textContent]),
    [
      ["ranked-v3-inspect-stat-label", "Depth"],
      ["ranked-v3-inspect-stat-value", "19"]
    ]
  );
  assert.deepEqual(
    goldStat[0].children.map((node) => [node.className, node.textContent]),
    [
      ["ranked-v3-inspect-stat-label", "Gold"],
      ["ranked-v3-inspect-stat-value", "700"]
    ]
  );
  const slots = visit(plate, (node) => hasClass(node, "ranked-v3-inspect-equipment-slot"));
  assert.equal(slots.length, 10);
  assert.equal(slots.filter((slot) => slot.attributes.get("aria-hidden") === "true").length, 0);
  assert.equal(visit(plate, (node) => hasClass(node, "ranked-v3-inspect-equipment-label")).length, 0);
  assert.doesNotMatch(text, /Crown Concord|Second Relic/iu);
  assert.equal(slots[0].attributes.get("tabindex"), "0");
  assert.equal(
    slots[0].attributes.get("data-record-tooltip"),
    "Crown Concord | You can equip up to 2 legendary relics | Stack x2"
  );
  assert.equal(slots[0].attributes.get("aria-label"), slots[0].attributes.get("data-record-tooltip"));
  assert.equal(slots[0].attributes.has("title"), false);
  assert.equal(
    slots[1].attributes.get("data-record-tooltip"),
    "Second Relic | Second relic description | Stack x1"
  );
  assert.doesNotMatch(text, /Ignored Relic|Carried/iu);

  const chronicleRows = visit(plate, (node) => hasClass(node, "ranked-v3-inspect-chronicle-row"));
  assert.deepEqual(chronicleRows.map((row) => row.children[0].textContent), [
    "Time Played", "Rooms Cleared", "Bosses Defeated", "Mutators", "Highest Depth", "Gold Earned", "Final Score"
  ]);
  assert.match(text, /01:02:03.*312.*7.*19.*8,550.*43,600/isu);
  const tooltip = visit(plate, (node) => hasClass(node, "ranked-v3-inspect-mutators"));
  assert.equal(tooltip.length, 1);
  assert.equal(tooltip[0].attributes.get("tabindex"), "0");
  assert.equal(tooltip[0].textContent, "1");
  assert.match(tooltip[0].attributes.get("data-record-tooltip"), /\[G\].*Greed.*\+50% gold.*Enemies hit harder/iu);
  assert.match(text, /Game Over.*Defeated by The Hollow Seraph/isu);
  assert.doesNotMatch(text, /Pacts|Skill Tiers|Camp Upgrades|Elixirs|Final Chronicle|Damage Done|v08-meta-1|v08-score-1/iu);

  const inspectActions = visit(plate, (node) => (
    node.tagName === "button"
    && (hasClass(node, "ranked-v3-inspect-back") || hasClass(node, "ranked-v3-inspect-close"))
  ));
  assert.deepEqual(inspectActions.map((node) => node.textContent), ["Back to Leaderboard"]);
  inspectActions[0].click();
  assert.deepEqual(returned, [true]);
  assert.deepEqual(closed, []);
});

test("Ranked inspect plate never invents a missing defeat cause", () => {
  const ui = loadUi();
  const detail = ui.createDetailViewModel({
    entry: { playerName: "Legacy", outcome: "defeat", summary: {} }
  });
  const plate = ui.renderDetail(createDocument(), detail);
  const slots = visit(plate, (node) => String(node.className).split(/\s+/u).includes("ranked-v3-inspect-equipment-slot"));
  assert.equal(slots.length, 10);
  assert.equal(slots.filter((slot) => slot.attributes.get("aria-hidden") === "true").length, 10);
  assert.match(allText(plate), /Game Over.*Cause not recorded\./isu);
});