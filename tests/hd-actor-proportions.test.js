const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const runnerPath = path.resolve(__dirname, "..", "scripts", "capture-hd-actor-proportions-qa.mjs");
assert(fs.existsSync(runnerPath), "actor-proportion browser QA runner must ship");

const runner = fs.readFileSync(runnerPath, "utf8");
assert.match(runner, /actor_proportions_hd/);
assert.match(runner, /1440[\s\S]*1000/);
assert.match(runner, /390[\s\S]*844/);
assert.match(runner, /576/);
for (const artifact of ["viewport.png", "canvas.png", "state.json", "metrics.json", "diagnostics.json", "summary.json"]) {
  assert.match(runner, new RegExp(artifact.replace(".", "\\.")), `runner must write ${artifact}`);
}
assert.match(runner, /horizontalOverflow/);
assert.match(runner, /metrics\.verticalOverflow/);
assert.match(runner, /scrollY/);
assert.match(runner, /consoleErrors/);
assert.match(runner, /expectedPositions/);
assert.match(runner, /logicalPositionsUnchanged/);
assert.match(runner, /state\.enemies/);
assert.match(runner, /state\.player/);
assert.match(runner, /brute[\s\S]*totem[\s\S]*skeleton/);

console.log("HD actor-proportion runner contract tests passed");
