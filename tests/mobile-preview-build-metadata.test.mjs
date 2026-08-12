import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { startMobilePreviewServer } from "../scripts/mobile-v1-lan-preview.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("all current-tree mobile QA servers reuse checkout build identity injection", () => {
  for (const relative of [
    "scripts/mobile-v1-lan-preview.mjs",
    "scripts/mobile-v1-smoke.mjs",
    "scripts/online-v3-baseline-smoke.mjs"
  ]) {
    const source = readFileSync(path.join(ROOT, relative), "utf8");
    assert.match(source, /injectCheckoutBuildIdentity/u, `${relative} must inject current checkout metadata`);
  }
});

test("mobile preview injects the current checkout build identity into config.js", async () => {
  const expectedCommit = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8"
  }).trim();
  const expectedDate = execFileSync("git", ["show", "-s", "--format=%cs", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8"
  }).trim();
  const preview = await startMobilePreviewServer();
  try {
    const response = await fetch(new URL("config.js", preview.url));
    assert.equal(response.status, 200);
    const source = await response.text();
    assert.match(source, new RegExp(`window\\.DUNGEON_BUILD_COMMIT = ${JSON.stringify(expectedCommit)}`));
    assert.match(source, new RegExp(`window\\.DUNGEON_BUILD_COMMIT_DATE = ${JSON.stringify(expectedDate)}`));
  } finally {
    await new Promise((resolve) => preview.server.close(resolve));
  }
});
