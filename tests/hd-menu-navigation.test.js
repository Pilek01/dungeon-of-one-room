const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const css = fs.readFileSync(path.join(root, "style-hd-composition.css"), "utf8");

assert.match(game, /const HD_MENU_NAV_SELECTOR = \[/);
assert.match(game, /function moveWithinCampGrid\(current, direction, controls\)/);
assert.match(game, /data-camp-grid-row="\$\{index % 5\}" data-camp-grid-column="\$\{Math\.floor\(index \/ 5\)\}"/);
assert.match(game, /const campGridMove = moveWithinCampGrid\(current, direction, controls\);/);
assert.match(game, /if \(candidateRowValue === null \|\| candidateColumnValue === null\) return false;/);
assert.match(game, /function syncHdMenuNavigation\(options = \{\}\)/);
assert.match(game, /function moveHdMenuNavigation\(direction\)/);
assert.match(game, /const score = primary \+ secondary \* 2\.5 \+ Math\.min\(secondary \/ primary, 1\) \* 80;/);
assert.match(game, /function handleHdMenuNavigationKey\(key\)/);
assert.match(game, /buildScreenOverlay\(\);\s*syncHdMenuNavigation\(\);/);
assert.match(game, /handleHdMenuNavigationKey\(key\)/);
assert.match(game, /data-hd-key="\$\{index \+ 1\}" role="button"/);
assert.match(game, /data-hd-key="y" role="button"/);
assert.match(game, /state\.phase === "won"\) return Boolean\(state\.finalVictoryPrompt\)/);
assert.match(game, /overlay-menu-row" data-hd-key="1" role="button" tabindex="0"/);
assert.match(game, /Arrows - move \| Enter - select \| Esc - Main Menu/);
assert.match(game, /merchant-buyback-row" data-merchant-key="\$\{index \+ 1\}"/);
assert.match(game, /const activateHdKeyControl = \(control\) =>/);
assert.match(game, /screenOverlayEl\.addEventListener\("pointerover"[\s\S]*setHdMenuNavigationSelection/);

const extractStart = game.indexOf("function enterCampFromExtract()");
const extractEnd = game.indexOf("function resolveExtractRelicPrompt", extractStart);
assert.ok(extractStart >= 0 && extractEnd > extractStart);
const extractFlow = game.slice(extractStart, extractEnd);
assert.doesNotMatch(extractFlow, /state\.extractRelicPrompt\s*=\s*\{/);
assert.doesNotMatch(extractFlow, /state\.relics\s*=\s*\[\]/);
assert.match(extractFlow, /Relics kept:/);
assert.match(game, /function sellCampRelicAtIndex\(index\)[\s\S]*campRelicSellPendingIndex !== safeIndex[\s\S]*state\.relics\.splice\(safeIndex, 1\)/);

assert.match(css, /\.hd-nav-selected/);
assert.match(css, /\.camp-revamp-relic\.pending-sale/);

assert.match(game, /gameAppEl\.classList\.remove\("app-hidden"\)[\s\S]*requestAnimationFrame\(\(\) => syncHdMenuNavigation\(\)\)/);
console.log("HD menu navigation contract tests passed");
