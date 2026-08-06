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
    RELICS: [{ id: "crownconcord", name: "Crown Concord", icon: "assets/hd/ui/relics/crownconcord.png" }]
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
  assert.equal(visit(plate, (node) => hasClass(node, "ranked-v3-ledger-slot")).length, 7);

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
test("Build Chronicle exposes exact active mutators through a focusable tooltip", () => {
  const ui = loadUi();
  const documentRef = createDocument();
  const detail = ui.createDetailViewModel({
    entry: {
      runId: "run_aaaaaaaa",
      playerName: "Ada",
      score: 43060,
      depth: 19,
      gold: 8550,
      createdAt: 0,
      build: {
        relics: [{ relicId: "crownconcord", stacks: 1 }],
        runModifiers: { active: [{ modifierId: "greed", stacks: 1 }] }
      },
      summary: {
        durationMs: 80000,
        roomsCompleted: 19,
        bossesCompleted: 3,
        damageDone: 1234,
        damageTaken: 456,
        totalKills: 77,
        lives: { remaining: 0, maximum: 5 }
      }
    }
  });

  const chronicle = ui.renderDetail(documentRef, detail);
  const tooltip = visit(chronicle, (node) => node.className === "record-archive-mutators");
  assert.equal(tooltip.length, 1);
  assert.equal(tooltip[0].attributes.get("tabindex"), "0");
  assert.match(tooltip[0].attributes.get("data-record-tooltip"), /Greed.*\+50% gold.*Enemies hit harder/iu);
  assert.match(allText(chronicle), /Crown Concord/iu);
  const relicIcons = visit(chronicle, (node) => node.tagName === "img" && /crownconcord\.png$/u.test(node.src || ""));
  assert.equal(relicIcons.length, 1);
  assert.match(allText(chronicle), /Time Played.*1m 20s.*Rooms Cleared.*19.*Bosses Defeated.*3/isu);
  assert.match(allText(chronicle), /Final Chronicle.*Damage Done.*1234.*Damage Taken.*456.*Total Kills.*77/isu);
});
