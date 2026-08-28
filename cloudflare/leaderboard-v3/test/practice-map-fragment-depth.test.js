import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadLootTables() {
  const source = await readFile(new URL("../../../loot-tables.js", import.meta.url), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.DungeonLootTables;
}

function sequenceRng(...values) {
  let index = 0;
  return () => values[index++] ?? 0.5;
}

test("Practice map-fragment rolls become gold before depth 11 and unlock at depth 11", async () => {
  const lootTables = await loadLootTables();

  assert.equal(lootTables.rollChestOutcome({
    depth: 10,
    rng: sequenceRng(0.92, 0.5)
  }).outcome, "gold");
  assert.equal(lootTables.rollChestOutcome({
    depth: 11,
    rng: sequenceRng(0.92, 0.5)
  }).outcome, "map_fragment");
  assert.equal(lootTables.rollChestOutcome({
    depth: 10,
    inTreasureRoom: true,
    rng: sequenceRng(0.7, 0.5)
  }).outcome, "gold");
  assert.equal(lootTables.rollChestOutcome({
    depth: 11,
    inTreasureRoom: true,
    rng: sequenceRng(0.7, 0.5)
  }).outcome, "map_fragment");
});
