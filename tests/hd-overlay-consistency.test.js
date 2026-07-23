const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const css = fs.readFileSync(path.join(root, "style-hd-composition.css"), "utf8");

assert.match(game, /overlay-card overlay-card-options/);
assert.match(game, /tutorialContext \|\| tutorialView[\s\S]*overlay-card overlay-card-options overlay-card-options-tutorial/);
assert.match(game, /if \(state\.nameModalOpen\)[\s\S]*overlay-card overlay-card-wide overlay-card-dialog/);
assert.match(game, /overlay-card overlay-card-wide overlay-card-danger overlay-card-confirm/);
assert.match(game, /selectedRow\.scrollIntoView\(\{ block: "nearest" \}\)/);
assert.match(game, /state\.phase === "playing" && state\.extractConfirm[\s\S]*overlay-card overlay-card-confirm/);
assert.match(game, /overlay-card overlay-card-wide tutorial-overlay-card/);
assert.match(game, /overlay-card overlay-card-merchant/);

assert.match(css, /\.screen-overlay\.visible:has\([\s\S]*\.overlay-card-options[\s\S]*\.tutorial-overlay-card[\s\S]*\.overlay-card-merchant[\s\S]*\.overlay-card-confirm[\s\S]*\.overlay-card-dialog/);
assert.match(css, /:is\([\s\S]*\.overlay-card-options[\s\S]*\.tutorial-overlay-card[\s\S]*\.overlay-card-merchant[\s\S]*\.overlay-card-confirm[\s\S]*\.overlay-card-dialog[\s\S]*background-image:[\s\S]*menu-frame\.png/);
assert.match(css, /\.overlay-card-merchant\s*\{\s*width:\s*min\(590px, 100%\)/);
assert.match(css, /\.overlay-card-options \.overlay-menu-row\s*\{[\s\S]*min-height:\s*38px[\s\S]*padding:\s*4px 6px/);
assert.match(css, /\.tutorial-overlay-card\s*\{[\s\S]*height:\s*min\(680px, 100%\)[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto[\s\S]*overflow:\s*hidden/);
assert.match(css, /\.tutorial-overlay-card > \.tutorial-sections\s*\{[\s\S]*overflow-y:\s*auto/);
assert.match(css, /\.tutorial-overlay-card \.tutorial-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(92px, 128px\) minmax\(0, 1fr\)/);
assert.match(css, /\.overlay-card-options-tutorial\s*\{[\s\S]*height:\s*min\(640px, 100%\)[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto/);
assert.match(css, /\.overlay-card-confirm:has\(> \.overlay-menu\)\s*\{[\s\S]*grid-template-rows:\s*auto auto auto minmax\(0, 1fr\) auto/);
assert.match(css, /\.overlay-card-confirm\s*\{[\s\S]*width:\s*min\(560px, 100%\)/);
assert.match(css, /\.overlay-card-confirm:has\(> \.overlay-menu\) > \.overlay-menu\s*\{[\s\S]*align-content:\s*start[\s\S]*grid-auto-rows:\s*minmax\(66px, auto\)/);
assert.match(css, /\.overlay-card-confirm \.overlay-menu-row\s*\{[\s\S]*min-height:\s*66px/);
assert.match(css, /\.overlay-card-confirm \.overlay-menu-row span\s*\{[\s\S]*display:\s*block[\s\S]*font-size:\s*clamp\(0\.68rem/);
assert.match(css, /> \.overlay-menu\s*\{[\s\S]*max-height:[\s\S]*overflow-y:\s*auto/);

console.log("HD overlay consistency tests passed");
