const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const game = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
function section(start, end) { const a = game.indexOf(start); const b = game.indexOf(end, a + start.length); assert.ok(a >= 0 && b >= 0); return game.slice(a, b); }
test("active overlay orchestration is HD-only", () => {
  const active = section("function buildScreenOverlay()", "function updateUi()");
  assert.match(active, /buildCampOverlayContent\(\)/u);
  assert.match(active, /buildRelicDraftOverlayContent\(\)/u);
  assert.doesNotMatch(active, /buildClassicCampOverlayContent|buildClassicCampSidePanel|buildClassicRelicDraftOverlayContent/u);
});

test("Classic overlay builders have definitions but no active call sites", () => {
  for (const name of [
    "buildClassicCampOverlayContent",
    "buildClassicCampSidePanel",
    "buildClassicRelicDraftOverlayContent"
  ]) {
    const references = game.match(new RegExp("\\b" + name + "\\s*\\(", "gu")) || [];
    assert.equal(references.length, 1, name + " may remain as dead source only");
  }
});
