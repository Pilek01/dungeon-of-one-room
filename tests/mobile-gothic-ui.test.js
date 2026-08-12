const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const gothicPath = path.join(root, "style-mobile-gothic.css");
const gothic = fs.existsSync(gothicPath) ? fs.readFileSync(gothicPath, "utf8") : "";

test("loads one authoritative mobile gothic layer after the mobile HD layout", () => {
  const hd = index.indexOf('href="style-mobile-hd.css"');
  const gothicLink = index.indexOf('href="style-mobile-gothic.css"');
  assert.ok(hd >= 0, "mobile HD layout stylesheet is present");
  assert.ok(gothicLink > hd, "mobile gothic stylesheet must be loaded last");
});

test("uses project-backed gothic assets for gameplay buttons and D-pad", () => {
  assert.match(gothic, /gothic-button-frame\.png/);
  assert.match(gothic, /gothic-dpad-plate\.png/);
  assert.match(gothic, /#mobileActionDock[\s\S]*\.mact-btn/);
  assert.match(gothic, /\.mobile-dpad/);
  assert.match(gothic, /\.mobile-details-button/);
  assert.match(gothic, /#mobileMenuButton/);
  assert.match(gothic, /#mobileRestartRow/);
  assert.doesNotMatch(gothic, /background\s*:\s*linear-gradient\([^;]*(?:#28384a|#1b3950|rgba\(27,\s*57,\s*80)/i);
});

test("skins every player-facing mobile overlay family", () => {
  const families = [
    "overlay-card-main-menu",
    "overlay-card-options",
    "tutorial-overlay-card",
    "overlay-card-dialog",
    "overlay-card-confirm",
    "record-archive-shell",
    "overlay-card-leaderboard",
    "overlay-card-camp",
    "camp-revamp",
    "forge-sanctuary",
    "merchant-sanctuary",
    "overlay-card-pact-sanctum",
    "relic-draft",
    "emergency-extract-confirm",
    "overlay-card-death-mini",
    "overlay-card-gameover",
    "overlay-card-success",
    "mobile-overlay-action"
  ];
  for (const family of families) {
    assert.match(gothic, new RegExp(`\\.${family}\\b`), `missing ${family} gothic coverage`);
  }
});

test("keeps touch actions reachable and exposes complete interaction states", () => {
  assert.match(gothic, /min-height\s*:\s*48px/);
  assert.match(gothic, /:focus-visible/);
  assert.match(gothic, /:active/);
  assert.match(gothic, /(?:\[aria-disabled="true"\]|\.is-(?:cooling|empty)|:disabled)/);
  assert.match(gothic, /position\s*:\s*sticky/);
  assert.match(gothic, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("keeps the final visual layer scoped to real touch mobile HD", () => {
  assert.match(gothic, /body\.mobile-touch/);
  assert.match(gothic, /graphics-hd-ui/);
  assert.doesNotMatch(gothic, /(^|\n)\s*(?:button|\.overlay-card|\.mact-btn)\s*\{/);
});
