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

test("Ranked ledger shows only the five requested facts and elevates top three", () => {
  const ui = loadUi();
  const documentRef = createDocument();
  const opened = [];
  const rows = ui.createLeaderboardViewModel({
    entries: [
      { runId: "run_aaaaaaaa", playerName: "Ada", score: 43060, depth: 19, gold: 8550, outcome: "defeat", durationMs: 80000 },
      { runId: "run_bbbbbbbb", playerName: "Bryn", score: 30056, depth: 18, gold: 1778, outcome: "victory", durationMs: 90000 },
      { runId: "run_cccccccc", playerName: "Cato", score: 29000, depth: 17, gold: 1200 },
      { runId: "run_dddddddd", playerName: "Dara", score: 28000, depth: 16, gold: 1000 }
    ]
  }).rows;

  const archive = ui.renderList(documentRef, rows, (runId) => opened.push(runId));
  assert.equal(archive.className, "record-archive ranked-v3-leaderboard-list");
  assert.equal(visit(archive, (node) => node.className === "record-archive-podium-card").length, 3);
  assert.equal(visit(archive, (node) => node.className === "record-archive-ledger-row").length, 1);

  const facts = visit(archive, (node) => node.attributes.get("data-record-field"));
  assert.deepEqual(
    [...new Set(facts.map((node) => node.attributes.get("data-record-field")))].sort(),
    ["depth", "gold", "name", "rank", "score"]
  );
  assert.doesNotMatch(allText(archive), /defeat|victory|80s|90s/iu);

  const adaControls = visit(archive, (node) => node.tagName === "button" && node.textContent === "Ada");
  const inspectControls = visit(archive, (node) => node.tagName === "button" && node.textContent === "Inspect build");
  assert.equal(adaControls.length, 1);
  assert.equal(inspectControls.length, 4);
  adaControls[0].click();
  assert.deepEqual(opened, ["run_aaaaaaaa"]);
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
  assert.match(allText(chronicle), /Time Played.*1m 20s.*Rooms Cleared.*19.*Bosses Defeated.*3/isu);
});
