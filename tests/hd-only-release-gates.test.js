const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const config = fs.readFileSync(path.join(root, "config.js"), "utf8");

test("the document starts in HD and does not load retired presentation modules", () => {
  assert.match(index, /<body\b[^>]*class="[^"]*\bgraphics-hd-ui\b[^"]*"/u);
  const canvasTag = index.match(/<canvas\b[^>]*\bid="game"[^>]*>/u)?.[0];
  assert.ok(canvasTag, "the game canvas must remain discoverable");
  assert.match(canvasTag, /\bwidth="576"/u);
  assert.match(canvasTag, /\bheight="576"/u);
  assert.match(canvasTag, /\bclass="[^"]*\bgraphics-hd\b[^"]*"/u);
  assert.match(canvasTag, /\bdata-graphics-mode="hd"/u);
  assert.doesNotMatch(index, /assets\/logo\.png|render\/graphics-preference\.js/u);
});

test("startup never invokes Classic sprite preloaders", () => {
  const startupStart = game.lastIndexOf("syncMutatorUnlocks();");
  const startupEnd = game.lastIndexOf("requestAnimationFrame(frame);");
  assert.notEqual(startupStart, -1, "startup marker must remain discoverable");
  assert.notEqual(startupEnd, -1, "frame scheduling marker must remain discoverable");
  assert.ok(startupEnd > startupStart, "startup markers must remain ordered");
  const startup = game.slice(startupStart, startupEnd);
  assert.doesNotMatch(startup, /\bload[A-Z][A-Za-z0-9]*(?:Sprite|Sprites)\s*\(/u);
});

test("live version is v0.8.2", () => {
  assert.match(config, /window\.GAME_VERSION\s*=\s*"v0\.8\.2"/u);
});
