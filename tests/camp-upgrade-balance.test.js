const assert = require("node:assert/strict");

global.window = {};
require("../camp-data.js");
const upgrades = global.window.DungeonCampData.CAMP_UPGRADES;
delete global.window;

assert.equal(upgrades.length, 12);
assert.deepEqual(upgrades.map((entry) => entry.id), [
  "vitality", "blade", "satchel", "guard", "auto_potion", "relic_ward",
  "potion_strength", "crit_chance", "treasure_sense", "emergency_stash", "bounty_contract", "relic_appraisal"
]);
assert.equal(upgrades.find((entry) => entry.id === "vitality").max, 25);
assert.equal(upgrades.find((entry) => entry.id === "blade").max, 25);
assert.equal(upgrades.find((entry) => entry.id === "relic_ward").max, 3);
assert.equal(upgrades.find((entry) => entry.id === "relic_appraisal").max, 3);
assert.equal(upgrades.find((entry) => entry.id === "relic_ward").key, "-");
assert.equal(upgrades.find((entry) => entry.id === "relic_appraisal").key, "=");

console.log("Camp upgrade balance tests passed");
