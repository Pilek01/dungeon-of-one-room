const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.resolve(__dirname, "..", "style.css"), "utf8");
const rankedUi = fs.readFileSync(
  path.resolve(__dirname, "..", "online-v3", "ranked-v3-leaderboard-ui.js"),
  "utf8"
);

test("shared record archive styles cover podium, ledger, tooltip and accessibility", () => {
  assert.match(css, /\.record-archive-podium-card/);
  assert.match(css, /data-record-rank="1"/);
  assert.match(css, /data-record-rank="2"/);
  assert.match(css, /data-record-rank="3"/);
  assert.match(css, /\.record-archive-ledger-row/);
  assert.match(css, /\[data-record-tooltip\]:focus-visible/);
  assert.match(css, /@media \(max-width:/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(rankedUi, /floor-skull\.png/);
});
