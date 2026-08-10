import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(root, "scripts", "build-pages-v3.mjs");

test("test Pages build embeds the checked-out commit hash and date", async () => {
  const built = spawnSync(process.execPath, [builder, "--target", "test"], {
    cwd: root,
    env: process.env,
    encoding: "utf8"
  });
  assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);

  const expectedCommit = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  const expectedDate = execFileSync("git", ["show", "-s", "--format=%cs", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  const output = path.join(root, "output", "pages-test-dist");
  const config = await readFile(path.join(output, "config.js"), "utf8");
  for (const relative of [
    "assets/logo.png",
    "assets/sprite/chest.png",
    "render/graphics-preference.js"
  ]) {
    await assert.rejects(access(path.join(output, relative)), { code: "ENOENT" });
  }
  const builtIndex = await readFile(path.join(output, "index.html"), "utf8");
  assert.doesNotMatch(builtIndex, /assets\/logo\.png|graphics-preference\.js/u);
  assert.match(config, /window\.GAME_VERSION\s*=\s*"v0\.8\.2"/u);


  assert.match(config, new RegExp(`window\\.DUNGEON_BUILD_COMMIT = ${JSON.stringify(expectedCommit)}`));
  assert.match(config, new RegExp(`window\\.DUNGEON_BUILD_COMMIT_DATE = ${JSON.stringify(expectedDate)}`));
});
