const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const gothic = fs.readFileSync(path.join(root, "style-mobile-gothic.css"), "utf8");

test("portrait touch keeps the game active and leaves rotate prompt inert", () => {
  assert.match(game, /function\s+syncMobileBackgroundInert\s*\(/);
  assert.match(game, /mobileUi\.portraitBlocked\s*=\s*false/);
  assert.match(game, /mobileRotateOverlayEl\.hidden\s*=\s*true/);
  assert.match(gothic, /body\.mobile-touch\.mobile-portrait/iu);
});

test("mobile exposes one deliberate live game status and semantic control groups", () => {
  assert.match(index, /id="mobileGameStatus"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.doesNotMatch(index, /id="(?:hud|depthBadge|skillsBar|mobileSwipeHint|appVersion)"[^>]*aria-live=/);
  assert.match(index, /id="mobileControls"[^>]*role="group"/);
  assert.match(index, /class="mobile-dpad"[^>]*role="group"/);
  assert.match(index, /id="mobileActionDock"[^>]*role="group"/);
});

test("touch overlays replace keyboard-era guidance with touch language", () => {
  assert.match(game, /Swipe to scroll/);
  assert.match(game, /Tap a forge action/);
  assert.match(game, /Tap an oath/);
  assert.match(game, /Tap to bind/);
  assert.match(game, /Tap to leave/);
  assert.match(game, /Tap Continue or Main Menu/);
  assert.match(game, /Tap a relic to claim it/);
  assert.match(game, /Tap Extract Now or Stay in Dungeon/);
  assert.match(game, /Tap Keep Current Relic or Take New Legendary/);
  assert.match(game, /data-relic-key="Escape"[\s\S]{0,200}Keep Current Setup/);
  assert.match(gothic, /\.overlay-menu-key[\s\S]{0,500}display\s*:\s*none/);
  assert.match(gothic, /\.overlay-card-options[\s\S]{0,500}\.overlay-hint[\s\S]{0,200}display\s*:\s*none/);
  assert.doesNotMatch(index, /Start\s*\/\s*Restart\s*\(R\)/);
  assert.match(gothic, /body\.mobile-touch\.mobile-landscape\s+#mobileActionDock\s+\.mobile-action-key[\s\S]{0,300}font-size\s*:\s*0/);
});

test("mobile text and scroll surfaces meet the repair readability contract", () => {
  assert.match(gothic, /--mg-mobile-label-size\s*:\s*clamp\(11px/);
  assert.match(gothic, /--mg-mobile-status-size\s*:\s*clamp\(9px/);
  assert.match(gothic, /--mg-mobile-support-size\s*:\s*clamp\(10px/);
  assert.match(gothic, /\.camp-revamp-copy small[\s\S]{0,500}-webkit-line-clamp\s*:\s*2/);
  assert.match(gothic, /scrollbar-color\s*:\s*var\(--mg-gold\)/);
  assert.match(gothic, /::-webkit-scrollbar-thumb/);
});

test("reduced motion disables decorative overlay motion, not only button transitions", () => {
  assert.match(gothic, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*#screenOverlay\s+\*[\s\S]*#screenOverlay\s+\*::before[\s\S]*#screenOverlay\s+\*::after/);
  assert.match(gothic, /animation\s*:\s*none\s*!important/);
  assert.match(gothic, /transition\s*:\s*none\s*!important/);
});
