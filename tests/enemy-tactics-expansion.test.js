const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "enemy-tactics.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: "enemy-tactics.js" });

const tactics = sandbox.window.DungeonEnemyTactics;
const riftweaver = { riftAiming: true, telegraphAge: 1 };
tactics.tickPassiveCooldowns(riftweaver);
assert.equal(riftweaver.telegraphAge, 1, "expansion telegraph age must not be reset or double-incremented");

riftweaver.riftAiming = false;
tactics.tickPassiveCooldowns(riftweaver);
assert.equal(riftweaver.telegraphAge, 0, "inactive telegraph age should still reset");

const skeleton = { volleyAiming: true, telegraphAge: 1 };
tactics.tickPassiveCooldowns(skeleton);
assert.equal(skeleton.telegraphAge, 2, "native telegraphs should retain their existing increment behavior");
