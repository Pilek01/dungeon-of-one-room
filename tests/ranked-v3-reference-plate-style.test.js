const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.resolve(__dirname, "..", "style.css"), "utf8");
const rankedUi = fs.readFileSync(path.resolve(__dirname, "..", "online-v3", "ranked-v3-ui.js"), "utf8");

test("Ranked reference plates use isolated desktop artwork, focus, and reduced-motion rules", () => {
  assert.match(css, /ranked-leaderboard-desktop-plate\.png/u);
  assert.match(css, /ranked-build-inspect-desktop-plate\.png/u);
  assert.match(css, /aspect-ratio:\s*1536\s*\/\s*1080/u);
  assert.match(css, /\.ranked-v3-reference-plate--leaderboard/u);
  assert.match(css, /\.ranked-v3-reference-plate--inspect/u);
  assert.match(css, /\.ranked-v3-reference-plate[^\n]*:focus-visible/u);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/u);
  assert.match(css, /@media \(min-width:\s*761px\)/u);
  assert.match(css, /\.record-archive-podium-card/u);
  assert.match(css, /\.record-archive-ledger-row/u);
  assert.match(rankedUi, /ranked-v3-card-reference-plate/u);
  assert.match(rankedUi, /ranked-v3-reference-plate/u);
});