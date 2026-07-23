const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.resolve(__dirname, "..", "style-hd-composition.css"), "utf8");
assert.match(css, /body\.graphics-hd-ui:has\(#game\.graphics-hd\)\s*\{/);

assert.match(css, /--hd-outer-void:\s*#010202/);
assert.match(css, /radial-gradient\(ellipse at 50% 48%, #0c0e11c7 0%, #050607ed 62%, var\(--hd-outer-void\) 100%\)/);
assert.match(css, /background-repeat:\s*no-repeat, repeat/);
assert.match(css, /background-size:\s*100% 100%, 512px 512px/);
assert.match(css, /body\.graphics-hd-ui \.app\s*\{[\s\S]*0 0 44px 18px #000d/);

console.log("HD outer background contract tests passed");
