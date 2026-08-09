const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const baseCss = fs.readFileSync(path.join(root, "style.css"), "utf8");
const renderer = fs.readFileSync(path.join(root, "record-archive-ui.js"), "utf8");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");

test("record archive styles are isolated in a v2 stylesheet", () => {
  const archiveCss = fs.readFileSync(path.join(root, "style-record-archive.css"), "utf8");
  assert(index.indexOf('href="style.css"') < index.indexOf('href="style-record-archive.css"'));
  assert.match(archiveCss, /\.record-archive-v2/);
  assert.doesNotMatch(archiveCss, /\.ranked-v3-/);
  assert.doesNotMatch(baseCss, /\/\* Shared Ranked Leaderboard and Practice Records archive\.\*\//);
  assert.doesNotMatch(renderer, /ranked-v3-leaderboard-details-button/);
  assert.match(game, /record-archive-v2" data-practice-record-archive/u);
  assert.match(game, /state\.phase === "menu" && state\.leaderboardModalOpen/u);
  assert.match(archiveCss, /\.screen-overlay\.visible:has\(\.record-archive-v2\.record-archive-shell\)/u);
  assert.doesNotMatch(game, /class="record-archive" data-practice-record-archive/u);
  assert.match(archiveCss, /grid-template-areas/);
  assert.match(archiveCss, /:focus-visible/);
  assert.match(archiveCss, /@media \(max-width:/);
  assert.match(archiveCss, /prefers-reduced-motion/);
});
