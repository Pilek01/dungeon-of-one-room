const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const html = read("index.html");
const game = read("game.js");
const css = read("style.css");
const smoke = read("scripts/mobile-v1-smoke.mjs");
const mobileHd = read("style-mobile-hd.css");
const mobileGothic = read("style-mobile-gothic.css");
const mobileHdPortraitGuard = read("style-mobile-hd.css");
const mobileGothicPortraitGuard = read("style-mobile-gothic.css");
const scenarios = read("scenario-overrides.js");

test("mobile DOM exposes orientation guard and the seven-action dock", () => {
  assert.match(html, /viewport-fit\s*=\s*cover/iu);
  assert.match(html, /id="mobileRotateOverlay"/u);
  assert.match(html, /id="mobileActionDock"/u);
  for (const id of ["mbtnZ", "mbtnX", "mbtnC", "mbtnF", "mbtnG", "mbtnE", "mbtnQ"]) {
    assert.match(html, new RegExp('id="' + id + '"', "u"), id + " action button must exist");
  }
  assert.match(html, /aria-live\s*=\s*["'](?:polite|assertive)["']/iu);
  assert.match(html, /mobileRotateOverlay[^>]*[\s\S]*?tabindex\s*=\s*["']-1["']/iu);
});

test("mobile capability uses coarse touch through the 1200px boundary instead of a dead-end UA lock", () => {
  assert.match(game, /1200/iu);
  assert.match(game, /pointer:\s*coarse/iu);
  assert.match(game, /orientationchange/iu);
  assert.match(game, /mobile(?:Portrait|Landscape|Orientation)|mobile-portrait|mobile-landscape/iu);
  assert.doesNotMatch(game, /MOBILE_UNSUPPORTED_BLOCKED/iu);
  assert.doesNotMatch(game, /Mobile Not Supported Yet/iu);
});

test("portrait touch stays playable across the dedicated smoke matrix", () => {
  assert.doesNotMatch(game, /mobileUi\.portraitBlocked\s*=\s*mobilePortrait/iu);
  assert.doesNotMatch(game, /shouldBeActive\s*=\s*!orientation\.mobilePortrait/iu);
  assert.match(smoke, /portrait must keep gameplay active/iu);
  assert.match(smoke, /360/iu);
  assert.match(smoke, /640/iu);
  assert.match(smoke, /430/iu);
  assert.match(smoke, /932/iu);
});

test("portrait mobile shell repeats the square-board layout guard", () => {
  const source = `${mobileHd}\\n${mobileGothic}`;
  assert.match(source, /body\.mobile-touch\.mobile-portrait\s*\{[^}]*--mobile-safe-bottom\s*:\s*env\(safe-area-inset-bottom/iu);
  assert.match(source, /mobile-portrait \.layout-track > \.board\s*\{[^}]*grid-template-rows/iu);
  assert.match(source, /mobile-portrait \.room-stage \.canvas-wrap\s*\{[^}]*aspect-ratio\s*:\s*1\s*\/\s*1/iu);
  assert.match(source, /mobile-portrait #mobileActionDock\s*\{[^}]*grid-template-columns\s*:\s*repeat\(2/iu);
  assert.match(source, /mobile-portrait[^\{]*\.(?:dpad-btn|mact-btn)[^\{]*\{[^}]*min-height\s*:\s*48px/iu);
});

test("portrait touch stays playable instead of activating the rotate gate", () => {
  assert.doesNotMatch(game, /mobileUi\.portraitBlocked\s*=\s*mobilePortrait/iu);
  assert.doesNotMatch(game, /shouldBeActive\s*=\s*!orientation\.mobilePortrait/iu);
  assert.match(smoke, /portrait must keep gameplay active/iu);
  assert.match(smoke, /360/iu);
  assert.match(smoke, /640/iu);
  assert.match(smoke, /430/iu);
  assert.match(smoke, /932/iu);
});

test("portrait mobile shell owns a square board and two-column action bank", () => {
  const source = `${mobileHd}\\n${mobileGothic}`;
  assert.match(source, /body\.mobile-touch\.mobile-portrait\s*\{[^}]*--mobile-safe-bottom\s*:\s*env\(safe-area-inset-bottom/iu);
  assert.match(source, /mobile-portrait \.layout-track > \.board\s*\{[^}]*grid-template-rows/iu);
  assert.match(source, /mobile-portrait \.room-stage \.canvas-wrap\s*\{[^}]*aspect-ratio\s*:\s*1\s*\/\s*1/iu);
  assert.match(source, /mobile-portrait #mobileActionDock\s*\{[^}]*grid-template-columns\s*:\s*repeat\(2/iu);
  assert.match(source, /mobile-portrait[^\{]*\.(?:dpad-btn|mact-btn)[^\{]*\{[^}]*min-height\s*:\s*48px/iu);
});

test("touch movement is cardinal, deadzone-gated, bounded, and dash-compatible", () => {
  assert.match(game, /deadzone/iu);
  assert.match(game, /pointerdown/iu);
  assert.match(game, /pointerup/iu);
  assert.match(game, /pointercancel/iu);
  assert.match(game, /(?:setTimeout|setInterval)/iu);
  assert.match(game, /tryMove\s*\(/u);
  assert.match(game, /dash/iu);
  assert.match(game, /pointerId/iu);
  assert.match(game, /isPrimary\s*===\s*false/iu);
  assert.match(game, /pointerleave[\s\S]*onMobileBoardPointerEnd/iu);
});

test("mobile actions and generic overlay taps reuse canonical action semantics", () => {
  assert.match(html, /data-(?:mobile-)?action(?:-key)?=/iu);
  assert.match(game, /(?:mobileAction|canonicalAction|resolve.*Action)/iu);
  assert.match(game, /closest\s*\([^)]*(?:data-action|data-key|overlay-menu-row)/iu);
  assert.match(game, /stopPropagation|cancelBubble/iu);
  assert.match(game, /(?:mbtnG|elixir)/iu);
  assert.match(game, /dispatchCanonicalMobileKey/iu);
  assert.match(game, /camp-overlay-action[^>]*data-action-key=["']r["']/iu);
  assert.match(game, /death-mini-action[^>]*data-action-key=["'](?:r|Escape)["']/iu);
  assert.match(game, /mobile-overlay-action[^>]*data-action-key=["'](?:Escape|Enter)["']/iu);
});

test("mobile CSS provides side dock, safe areas, dynamic viewport, and scrollable fixed overlays", () => {
  assert.match(css, /max-width\s*:\s*1200px/iu);
  assert.match(css, /env\s*\(\s*safe-area-inset-(?:top|right|bottom|left)/iu);
  assert.match(css, /100dvh/iu);
  assert.match(css, /100vh[\s\S]*100dvh/iu);
  assert.match(css, /mobile[-_]?(?:rotate|portrait)/iu);
  assert.match(css, /position\s*:\s*fixed/iu);
  assert.match(css, /overflow(?:-y)?\s*:\s*auto/iu);
  assert.match(css, /mobileActionDock|mobile-action-dock/iu);
  assert.match(css, /mobile(?:Controls|[-_]dpad)[^}]*display\s*:\s*none/isu);
});

test("real-touch smoke runner declares the required contexts and assertions", () => {
  assert.match(smoke, /iPhone|iOS|Android/iu);
  assert.match(smoke, /portrait/iu);
  assert.match(smoke, /landscape/iu);
  assert.match(smoke, /hasTouch\s*:\s*(?:true|profile\.touch)/iu);
  assert.match(smoke, /isMobile\s*:\s*(?:true|profile\.touch)/iu);
  assert.match(smoke, /render_game_to_text/iu);
  assert.match(smoke, /mobileRotateOverlay/iu);
  assert.match(smoke, /mobileActionDock/iu);
  assert.match(smoke, /horizontalOverflow|scrollWidth/iu);
  assert.match(smoke, /consoleErrors|pageErrors/iu);
});

test("mobile journey QA exposes deterministic reward, extraction, end-state, records, and nickname surfaces", () => {
  for (const id of [
    "reward_choice_mobile",
    "forge_reward_mobile",
    "extract_exchange_mobile",
    "emergency_extract_mobile",
    "death_mobile",
    "gameover_mobile",
    "victory_mobile",
    "records_mobile",
    "nickname_mobile",
    "camp_start_mobile"
  ]) {
    assert.match(scenarios, new RegExp(id, "u"), id + " scenario must exist");
  }
  assert.match(game, /forceMobileSurfaceSetup/iu);
});
