const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const runnerPath = path.join(root, "scripts", "capture-hd-final-audit.mjs");

test("final screenshot audit covers boot UI, both viewports, all wall themes and production showcases", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  for (const viewport of ["desktop", "mobile"]) assert.match(source, new RegExp(`${viewport}:`));
  for (const scenario of [
    "descent_hd", "enemy_roster_hd", "corruption_combat_hd", "corruption_cursed_hd",
    "corruption_merchant_hd", "corruption_forge_hd", "corruption_vault_hd",
    "abyss_combat_hd", "abyss_pact_hd", "abyss_otter_hd", "abyss_vault_hd",
    "vfx_showcase_hd", "vault_guardian_hd", "blacksmith_guardian_hd",
    "warden_phase1_hd", "warden_phase2_aegis_hd"
  ]) assert.match(source, new RegExp(`"${scenario}"`));
  assert.match(source, /boot\/viewport\.png/);
  assert.match(source, /bootMenuVisible/);
  assert.match(source, /bootGraphics/);
  assert.match(source, /hdUi/);
  assert.match(source, /bootLogoVisible/);
  assert.match(source, /hdBrandVisible/);
});
test("final screenshot audit rejects layout, console, blank-frame and color-key defects", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  assert.match(source, /horizontalOverflow/);
  assert.match(source, /scrollY/);
  assert.match(source, /consoleErrors\.length/);
  assert.match(source, /nonTransparentRatio/);
  assert.match(source, /magentaKeyRatio/);
  assert.match(source, /meanLuminance/);
  assert.match(source, /mobileControlsVisible/);
  assert.match(source, /skillsBarVisible/);
});

test("final screenshot audit recycles Chromium before decoded HD assets can accumulate", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  assert.match(source, /const AUDIT_BATCH_SIZE = 8/);
  assert.match(source, /scenarios\.slice\(batchStart, batchStart \+ AUDIT_BATCH_SIZE\)/);
  assert.match(source, /for \(const batchScenarios of scenarioBatches\)/);
  assert.match(source, /await browser\.close\(\)/);
});
test("HD browser audit captures forbidden Classic requests and live version across reload", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  assert.match(source, /forbiddenClassicRequests/u);
  assert.match(source, /pathname === ["']\/assets\/logo\.png["']/u);
  assert.match(source, /pathname\.startsWith\(["']\/assets\/sprite\/["']\)/u);
  assert.match(source, /DUNGEON_GAME_VERSION[^\n]*v0\.8\.3/u);
  assert.match(source, /page\.reload\(/u);
  assert.match(source, /reload[^\n]*forbiddenClassicRequests|forbiddenClassicRequests[^\n]*reload/iu);
});

test("HD baseline and graphics QA no longer exercise Classic mode or preference storage", () => {
  const baseline = fs.readFileSync(path.join(root, "scripts", "online-v3-baseline-smoke.mjs"), "utf8");
  const graphics = fs.readFileSync(path.join(root, "scripts", "capture-graphics-toggle-qa.mjs"), "utf8");
  assert.doesNotMatch(baseline, /classic-shrine|GRAPHICS_KEY|data-graphics-mode.*legacy|graphicsMode.*classic/iu);
  assert.match(baseline, /forbiddenClassicRequests/u);
  assert.match(baseline, /assets\/sprite\//u);
  assert.match(baseline, /assets\/logo\.png/u);
  assert.doesNotMatch(graphics, /Classic|classic|dungeonOneRoomGraphicsMode|Digit[1236]/u);
  assert.match(graphics, /forbiddenClassicRequests|assets\/sprite\//u);
});

test("live Ranked client/runtime/headed fallbacks identify v0.8.3", () => {
  for (const relative of [
    "online-v3/ranked-v3-client.js",
    "online-v3/ranked-v3-runtime.js",
    "scripts/online-v3-ranked-headed.mjs"
  ]) {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    assert.doesNotMatch(source, /v0\.8\.0/gu, relative);
    assert.match(source, /v0\.8\.3/u, relative);
  }
});
