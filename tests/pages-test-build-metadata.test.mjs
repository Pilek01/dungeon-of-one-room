import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
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
  const config = await readFile(path.join(root, "output", "pages-test-dist", "config.js"), "utf8");

  assert.match(config, new RegExp(`window\\.DUNGEON_BUILD_COMMIT = ${JSON.stringify(expectedCommit)}`));
  assert.match(config, new RegExp(`window\\.DUNGEON_BUILD_COMMIT_DATE = ${JSON.stringify(expectedDate)}`));
});
