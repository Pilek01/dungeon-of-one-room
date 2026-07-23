const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const game = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");

function section(startMarker, endMarker) {
  const start = game.indexOf(startMarker);
  assert.notEqual(start, -1, "Missing " + startMarker);
  const end = game.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, "Missing " + endMarker);
  return game.slice(start, end);
}

const classicRelic = section(
  "function buildClassicRelicDraftOverlayContent()",
  "function buildRelicDraftOverlayContent()"
);
assert.doesNotMatch(classicRelic, /<img\b|assets\/hd\//);
assert.match(classicRelic, /overlay-menu-row/);
assert.match(game, /graphicsPreferenceApi\.isHd\(graphicsPreference\)\s*\? buildRelicDraftOverlayContent\(\)\s*:\s*buildClassicRelicDraftOverlayContent\(\)/);

const classicCamp = section(
  "function buildClassicCampOverlayContent()",
  "function buildClassicRelicDraftOverlayContent()"
);
assert.doesNotMatch(classicCamp, /<img\b|assets\/hd\//);
assert.match(classicCamp, /camp-overlay-stats/);
assert.match(game, /graphicsPreferenceApi\.isHd\(graphicsPreference\)\s*\? buildCampOverlayContent\(\)\s*:\s*buildClassicCampOverlayContent\(\)/);
assert.match(game, /graphicsPreferenceApi\.isHd\(graphicsPreference\)\s*\? buildActiveMutatorSummary\(\)\s*:\s*buildClassicCampSidePanel\(\)/);

assert.match(game, /const isHdRelicOverlay\s*=\s*graphicsPreferenceApi\.isHd/);
assert.match(game, /isHdRelicOverlay[\s\S]*overlay-card-relic-draft/);
assert.match(game, /isCrimsonRelicDraft\s*\? "overlay-card overlay-card-crimson"\s*:\s*"overlay-card"/);

console.log("Classic UI isolation contract tests passed");

