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
