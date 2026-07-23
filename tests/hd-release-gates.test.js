const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const gameSource = fs.readFileSync(path.join(root, "game.js"), "utf8");

function functionBody(name) {
  const start = gameSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = gameSource.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < gameSource.length; index += 1) {
    if (gameSource[index] === "{") depth += 1;
    if (gameSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return gameSource.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test("run saves remain renderer-agnostic and backward-compatible", () => {
  const build = functionBody("buildRunSnapshot");
  const load = functionBody("tryLoadRunSnapshot");
  assert.doesNotMatch(build, /DUNGEON_HD|graphicsMode|loadedAssets|assetManifest|renderer/i);
  assert.doesNotMatch(load, /DUNGEON_HD|graphicsMode|loadedAssets|assetManifest|renderer/i);
  assert.match(load, /snapshot\.player/);
  assert.match(load, /snapshot\.portal/);
});
test("browser performance gate measures desktop and mobile frame pacing with bounded thresholds", () => {
  const source = fs.readFileSync(path.join(root, "scripts", "benchmark-hd-render.mjs"), "utf8");
  assert.match(source, /vfx_showcase_hd/);
  assert.match(source, /desktop/);
  assert.match(source, /mobile/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /meanFrameMs/);
  assert.match(source, /p95FrameMs/);
  assert.match(source, /meanFrameMs\s*>\s*24/);
  assert.match(source, /p95FrameMs\s*>\s*40/);
});
