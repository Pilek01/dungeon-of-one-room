const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "elixir-data.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(source, context, { filename: "elixir-data.js" });

const data = context.window.DungeonElixirData;
assert.equal(data.ELIXIR_DURATION_TURNS, 6);
assert.equal(data.ELIXIR_STACK_MAX, 5);
assert.equal(data.ELIXIR_DISCARD_REFUND_RATIO, 0.5);

const expected = {
  iron_1: { armorBonus: 3, statLabel: "+30 ARM" },
  fury_1: { attackBonus: 3, statLabel: "+30 ATK" },
  focus_1: { critBonus: 0.15, statLabel: "+15% Crit" },
  iron_2: { armorBonus: 6, statLabel: "+60 ARM" },
  fury_2: { attackBonus: 6, statLabel: "+60 ATK" },
  focus_2: { critBonus: 0.3, statLabel: "+30% Crit" },
  iron_3: { armorBonus: 9, statLabel: "+90 ARM" },
  fury_3: { attackBonus: 9, statLabel: "+90 ATK" },
  focus_3: { critBonus: 0.45, statLabel: "+45% Crit" }
};

for (const elixir of data.ELIXIRS) {
  assert.equal(elixir.duration, 6, elixir.id);
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(expected[elixir.id]).map((key) => [key, elixir[key]])
    ),
    expected[elixir.id],
    elixir.id
  );
}

console.log("Elixir duration and +50% power tests passed");
