const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
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

function loadArchiveUi() {
  const modulePath = path.resolve(__dirname, "..", "record-archive-ui.js");
  delete require.cache[modulePath];
  return require(modulePath);
}

const archive = Object.freeze({
  context: "ranked",
  rows: Object.freeze([
    { runId: "run_1", rank: 1, playerName: "Ada", score: 400, depth: 9, gold: 80 },
    { runId: "run_2", rank: 2, playerName: "Bryn", score: 300, depth: 8, gold: 60 },
    { runId: "run_3", rank: 3, playerName: "Cato", score: 200, depth: 7, gold: 40 },
    { runId: "run_4", rank: 4, playerName: "Dara", score: 100, depth: 6, gold: 20 }
  ])
});

test("shared archive renderer exposes top three, five ledger facts, and immutable inspect rows", () => {
  const ui = loadArchiveUi();
  const documentRef = createDocument();
  const opened = [];
  const rendered = ui.renderList(documentRef, archive, {
    onInspect(row) {
      opened.push(row);
    }
  });

  const hasClass = (node, className) => String(node.className).split(/\s+/u).includes(className);
  assert.equal(visit(rendered, (node) => hasClass(node, "record-archive-podium-card")).length, 3);
  assert.equal(visit(rendered, (node) => hasClass(node, "record-archive-ledger-row")).length, 1);
  assert.deepEqual(
    [...new Set(visit(rendered, (node) => node.attributes.get("data-record-field"))
      .map((node) => node.attributes.get("data-record-field")))].sort(),
    ["depth", "gold", "name", "rank", "score"]
  );

  const names = visit(rendered, (node) => node.tagName === "button" && node.textContent === "Ada");
  const inspect = visit(rendered, (node) => node.tagName === "button" && node.textContent === "Inspect build");
  names[0].click();
  inspect[0].click();
  assert.equal(opened.length, 2);
  assert.equal(opened[0], opened[1]);
  assert.equal(opened[0].runId, "run_1");
  assert.equal(Object.isFrozen(opened[0]), true);
});

test("shared archive renderer keeps text safe and preserves a present numeric zero", () => {
  const ui = loadArchiveUi();
  const documentRef = createDocument();
  const fact = ui.presentFact({ score: 0 }, "score", "Score");
  assert.deepEqual(fact, { key: "score", label: "Score", value: "0" });
  assert.equal(ui.presentFact({}, "score", "Score"), null);

  const rendered = ui.renderList(documentRef, {
    context: "ranked",
    rows: [{ runId: "run_safe", rank: 1, playerName: "<img src=x>", score: 0, depth: 0, gold: 0 }]
  });
  const nodes = visit(rendered, () => true);
  assert.equal(nodes.some((node) => Object.hasOwn(node, "innerHTML")), false);
  assert.equal(nodes.some((node) => node.textContent === "<img src=x>"), true);
});

test("shared archive renderer has no Ranked, Practice, API, or storage lookup", () => {
  const source = readFileSync(path.resolve(__dirname, "..", "record-archive-ui.js"), "utf8");
  assert.doesNotMatch(source, /fetch\(|localStorage|DungeonRanked|DungeonPractice|\/api\//u);
});
test("shared archive renderer displays an explicit unavailable-detail notice", () => {
  const ui = loadArchiveUi();
  const rendered = ui.renderDetail(createDocument(), {
    playerName: "Legacy",
    score: 0,
    notice: "Build Chronicle unavailable for this legacy Practice record."
  });
  assert.equal(visit(rendered, (node) => /unavailable/i.test(node.textContent)).length, 1);
});
