const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.resolve(__dirname, "..", "style.css"), "utf8");
const rankedUi = fs.readFileSync(path.resolve(__dirname, "..", "online-v3", "ranked-v3-ui.js"), "utf8");
const rankedRuntime = fs.readFileSync(path.resolve(__dirname, "..", "online-v3", "ranked-v3-runtime.js"), "utf8");

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
  assert.match(rankedRuntime, /onClose:\s*closeLeaderboardOverlay/u);
  assert.match(rankedRuntime, /onBack:\s*showLeaderboardRows/u);
  assert.match(rankedRuntime, /focusReferencePlateAction/u);
  assert.match(css, /--ranked-ledger-name-shift:\s*2\.1cqw/u);
  assert.match(css, /--ranked-ledger-depth-shift:\s*-2\.1cqw/u);
  assert.match(css, /ranked-v3-leaderboard-column:nth-child\(2\),\s*body[^{]*ranked-v3-ledger-slot \.record-archive-name\s*\{[^}]*translateX\(var\(--ranked-ledger-name-shift\)\)/u);
  assert.match(css, /ranked-v3-leaderboard-column:nth-child\(4\),\s*body[^{]*ranked-v3-ledger-slot \.ranked-v3-leaderboard-depth\s*\{[^}]*translateX\(var\(--ranked-ledger-depth-shift\)\)/u);
  assert.match(css, /ranked-v3-inspect-rank\[data-rank-digits="single"\]\s*\{[^}]*translateX\(\.35cqw\)/u);
  assert.doesNotMatch(css, /ranked-v3-inspect-rank\[data-rank-digits="double"\]\s*\{[^}]*transform:/u);
  assert.match(css, /\.ranked-v3-inspect-tooltip\s*\{[^}]*width:\s*min\(48cqw,\s*740px\)/u);
  assert.match(css, /\.ranked-v3-inspect-tooltip\s*\{[^}]*font:\s*600\s+clamp\(1rem,\s*2cqw,\s*1\.95rem\)\/1\.35/u);
  assert.match(css, /\.ranked-v3-inspect-tooltip\s*\{[^}]*padding:\s*clamp\(\.75rem,\s*1\.2cqw,\s*1\.25rem\)/u);
  assert.match(css, /ranked-v3-reference-plate--inspect\s+\[data-record-tooltip\]::after\s*\{[^}]*content:\s*none\s*!important/u);
  assert.match(css, /@media \(max-width:\s*760px\)\s*\{\s*\.ranked-v3-inspect-tooltip\s*\{[^}]*width:\s*min\(calc\(100vw - 32px\),\s*100%\)/u);
});