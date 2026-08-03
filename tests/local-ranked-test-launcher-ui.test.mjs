import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cmdPath = path.join(repoRoot, "Launch-Local-Ranked-Test.cmd");
const scriptPath = path.join(repoRoot, "scripts", "local-ranked-test-launcher.ps1");

test("Windows launcher exposes only the local Ranked test controls", async () => {
  const [cmdSource, psSource] = await Promise.all([
    readFile(cmdPath, "utf8"),
    readFile(scriptPath, "utf8")
  ]);

  assert.match(cmdSource, /local-ranked-test-launcher\.ps1/u);
  assert.match(cmdSource, /-NoProfile/u);
  assert.match(psSource, /System\.Windows\.Forms/u);
  assert.match(psSource, /list --json/u);
  assert.match(psSource, /start --commit/u);
  assert.match(psSource, /--json-events/u);
  assert.match(psSource, /Start \+ Observer Bot/u);
  assert.match(psSource, /SelectedIndexChanged/u);
  assert.match(psSource, /function Quote-ProcessArgument/u);
  assert.match(psSource, /\.Arguments\s*=/u);
  assert.doesNotMatch(psSource, /\.ArgumentList/u);
  assert.match(psSource, /Ready|Failed|Stopped/u);
  assert.doesNotMatch(psSource, /wrangler\s+deploy|pages\s+deploy|--remote|\btunnel\b/u);
  assert.doesNotMatch(psSource, /DUNGEON_ONLINE_TEST_BOT_PASSWORD\s*=/u);
});
