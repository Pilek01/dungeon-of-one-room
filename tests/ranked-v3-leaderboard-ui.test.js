const assert = require("node:assert/strict");
const path = require("node:path");
const { readFileSync } = require("node:fs");
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
  const archivePath = path.resolve(__dirname, "..", "record-archive-ui.js");
  delete require.cache[archivePath];
  global.DungeonRecordArchiveUi = require(archivePath);
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
  assert.equal(archive.className, "record-archive record-archive-list");
  const hasClass = (node, className) => String(node.className).split(/\s+/u).includes(className);
  assert.equal(visit(archive, (node) => hasClass(node, "record-archive-podium-card")).length, 3);
  assert.equal(visit(archive, (node) => hasClass(node, "record-archive-ledger-row")).length, 1);
  assert.equal(visit(archive, (node) => node.attributes.get("data-record-rank")).length, 4);

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
test("Ranked adapter delegates list DOM to the shared archive renderer", () => {
  const ui = loadUi();
  const documentRef = createDocument();
  const rendered = ui.renderList(documentRef, [{
    runId: "run_adapter",
    rank: 1,
    playerName: "Ada",
    score: 10,
    depth: 2,
    gold: 3
  }], () => {});

  assert.equal(rendered.className, "record-archive record-archive-list");
  const source = readFileSync(path.resolve(__dirname, "..", "online-v3", "ranked-v3-leaderboard-ui.js"), "utf8");
  assert.doesNotMatch(source, /record-archive-podium|record-archive-ledger/u);
});
