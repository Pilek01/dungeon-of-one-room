const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");

test("boot screen exposes version, commit, and commit date below the author credit", () => {
  assert.match(html, /Made by Kamil Matysek[\s\S]*id="bootBuildMetadata"/u);
  assert.match(css, /\.boot-build-metadata\s*\{/u);
  assert.match(game, /DUNGEON_BUILD_COMMIT/u);
  assert.match(game, /DUNGEON_BUILD_COMMIT_DATE/u);
  assert.match(game, /`\$\{GAME_VERSION\} · \$\{GAME_BUILD_COMMIT\} · \$\{GAME_BUILD_COMMIT_DATE\}`/u);
});

test("menu structure and original soundtrack-facing boot copy remain intact", () => {
  assert.match(html, /id="bootScreen"/);
  assert.match(html, /assets\/logo\.png/);
  assert.match(html, /Press any button to start/);
  assert.match(html, /Made by Kamil Matysek/);
  assert.match(html, /id="mobileMenuButton"/);
});
test("UI polish adds a coherent focus token and keyboard-visible controls", () => {
  assert.match(css, /--focus-ring:\s*#[0-9a-fA-F]{6}/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline:\s*2px solid var\(--focus-ring\)/);
});

test("mobile interactive controls meet a 48px touch target", () => {
  assert.match(css, /\.dpad-btn\s*\{[^}]*min-width:\s*48px[^}]*min-height:\s*48px/s);
  assert.match(css, /\.mact-btn\s*\{[^}]*min-height:\s*48px/s);
  assert.match(css, /\.mobile-menu-button\s*\{[^}]*min-height:\s*48px/s);
});

test("nonessential UI motion respects reduced-motion preference", () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.boot-content[^}]*animation:\s*none/s);
  assert.match(css, /\.boot-press[^}]*animation:\s*none/s);
  assert.match(css, /\.hud-relic-item\.rarity-mythic[^}]*animation:\s*none/s);
});

test("boot prompt remains readable at the dimmest pulse frame", () => {
  assert.match(css, /@keyframes bootPulse\s*\{[^}]*0%\s*\{\s*opacity:\s*0\.6\s*;/s);
  assert.match(css, /100%\s*\{\s*opacity:\s*0\.6\s*;\s*\}/s);
});

test("HD status rows use a compact responsive emblem layout", () => {
  assert.match(css, /\.status-emblem\s*\{[^}]*width:\s*24px[^}]*height:\s*24px/s);
  assert.match(css, /\.status-emblem-label\s*\{[^}]*display:\s*inline-flex/s);
  assert.match(css, /\.status-emblem-pill\s*\{[^}]*display:\s*inline-flex/s);
  assert.match(css, /\.status-emblem-row\.tone-harmful/);
  assert.match(css, /\.status-emblem-row\.tone-protection/);
  assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.active-effects \.statline/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.status-emblem[^}]*animation:\s*none/s);
});
