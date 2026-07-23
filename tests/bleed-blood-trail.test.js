const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const renderer = fs.readFileSync(path.join(root, "render", "hd-renderer-layers.js"), "utf8");
const snapshotApi = require(path.join(root, "render", "visual-snapshot.js"));

assert.match(game, /function leavePlayerBloodStain\(x, y\)/);
assert.match(game, /startTween\(state\.player\);\s*leavePlayerBloodStain\(previous\.x, previous\.y\);\s*state\.player\.x = nx/);
assert.match(game, /state\.bloodStains = state\.bloodStains\.filter\(\(stain\) => stain\.life > 0\)/);
assert.match(game, /function drawBloodStainsClassic\(\)/);
assert.match(renderer, /function drawBloodStains\(context, snapshot\)/);
assert.match(renderer, /drawBloodStains\(context, visual\)/);

const snapshot = snapshotApi.createVisualSnapshot({
  player: { x: 4, y: 4, bleedTurns: 2 },
  bloodStains: [{ x: 4, y: 5, life: 6100, maxLife: 6500, seed: 17 }]
}, 1000);

assert.deepEqual(snapshot.bloodStains, [
  { x: 4, y: 5, life: 6100, maxLife: 6500, seed: 17 }
]);

console.log("Bleed blood trail tests passed");
