import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { verifyPagesProductionBundle } from "../scripts/verify-pages-production-bundle.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(root, "scripts", "build-pages-v3.mjs");
const outputConfig = path.join(root, "output", "pages-dist", "config.js");
const TEST_PASSWORD = "ephemeral-observer-password";

function buildRelease(environment) {
  return spawnSync(process.execPath, [builder, "--target", "release"], {
    cwd: root,
    env: environment,
    encoding: "utf8"
  });
}

test("release package enables the Observer Bot through a hash only", async () => {
  const built = buildRelease({
    ...process.env,
    DUNGEON_ONLINE_TEST_BOT_PASSWORD: TEST_PASSWORD
  });
  assert.equal(built.status, 0, built.stderr);

  const config = await readFile(outputConfig, "utf8");
  assert.match(config, /DUNGEON_ONLINE_TEST_BOT_ENABLED = true/u);
  assert.match(config, /DUNGEON_ONLINE_TEST_BOT_PASSWORD_HASH = "sha256:[a-f0-9]{64}"/u);
  assert.doesNotMatch(config, /ephemeral-observer-password/u);
  await verifyPagesProductionBundle({ root });
});

test("release package fails before build when the Observer Bot password is absent", () => {
  const environment = { ...process.env };
  delete environment.DUNGEON_ONLINE_TEST_BOT_PASSWORD;
  const built = buildRelease(environment);
  assert.notEqual(built.status, 0);
  assert.match(
    `${built.stdout}\n${built.stderr}`,
    /DUNGEON_ONLINE_TEST_BOT_PASSWORD is required for release builds\./u
  );
});
