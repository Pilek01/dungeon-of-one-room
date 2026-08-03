import assert from "node:assert/strict";
import { execFile as nodeExecFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  prepareRevision,
  startLocalRankedTest
} from "../scripts/local-ranked-test-launcher-core.mjs";

const execFile = promisify(nodeExecFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assertTemporaryChild(candidate) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const resolved = path.resolve(candidate);
  const relative = path.relative(temporaryRoot, resolved);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

test("launches and stops a selected revision through the public local lifecycle", { timeout: 240_000 }, async () => {
  const hashResult = await execFile("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  const selected = { hash: hashResult.stdout.trim() };
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "dungeon-local-ranked-test-"));
  const temporaryRepository = path.join(temporaryRoot, "repository");
  let controller = null;

  assertTemporaryChild(temporaryRoot);
  try {
    await execFile("git", ["clone", "--no-local", repoRoot, temporaryRepository]);
    const prepared = await prepareRevision(selected, { repoRoot: temporaryRepository });
    assert.match(prepared.worktree, /local-ranked-test-launcher/u);

    controller = await startLocalRankedTest(selected, { repoRoot: temporaryRepository });
    assert.match(controller.url, /^http:\/\/127\.0\.0\.1:\d+$/u);
    const page = await fetch(`${controller.url}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<!doctype html>/iu);
    const leaderboard = await fetch(`${controller.url}/api/v3/leaderboard?season=local-m4&limit=1`);
    assert.equal(leaderboard.status, 200);
    assert.ok(Array.isArray(controller.workerArgs));
    assert.equal(controller.workerArgs.some((argument) => /deploy|--remote|tunnel|https:\/\//iu.test(argument)), false);

    await controller.stop();
    assert.equal(controller.hasExited(), true);
  } finally {
    if (controller) await controller.stop();
    assertTemporaryChild(temporaryRoot);
    await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});
