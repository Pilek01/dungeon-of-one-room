import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runMultiBotSmoke } from "../scripts/local-ranked-multi-bot-smoke.mjs";

const COMMIT = "a".repeat(40);
const ARTIFACT_FILES = [
  "failure-summary.json",
  "screenshot.png",
  "ranked-diagnostics.json",
  "observer-bot-trace.txt",
  "game-state.json",
  "console.log",
  "network-errors.json"
];

test("smoke orchestration proves two-profile isolation and stops all owned resources", async (context) => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "dungeon-multi-bot-smoke-unit-"));
  context.after(() => rm(repoRoot, { recursive: true, force: true }));
  const sessionRoot = path.join(repoRoot, "output", "multi-bot-runs", "session-smoke");
  const calls = [];
  const worker = { url: "http://127.0.0.1:9123", async stop() { calls.push("worker:stop"); } };
  const identities = new Map([
    ["bot-01", { name: "bot 1", graphicsMode: "hd", installationHash: "install-a", profileId: "profile-a", runId: "run-a", observerActive: true, progress: "A" }],
    ["bot-02", { name: "bot 2", graphicsMode: "hd", installationHash: "install-b", profileId: "profile-b", runId: "run-b", observerActive: true, progress: "B" }]
  ]);
  const bots = ["bot-01", "bot-02"].map((id) => ({ runtime: { bot: { id, artifactDir: path.join(sessionRoot, id) } } }));
  const wall = {
    sessionRoot,
    bots,
    async captureBot(id, incident) {
      calls.push(`capture:${id}:${incident.kind}`);
      const artifactDir = path.join(sessionRoot, id);
      await mkdir(artifactDir, { recursive: true });
      await Promise.all(ARTIFACT_FILES.map((name) => writeFile(path.join(artifactDir, name), name)));
      identities.get(id).observerActive = false;
      return { artifactDir };
    },
    async stop() { calls.push("wall:stop"); }
  };

  const summary = await runMultiBotSmoke({
    repoRoot,
    commit: COMMIT,
    sessionId: "session-smoke",
    chromeExecutable: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    startLocalRankedTest: async (selected) => { calls.push(`worker:start:${selected.hash}`); return worker; },
    startMultiBotWall: async (options) => { calls.push(`wall:start:${options.testBotCount}`); return wall; },
    inspectBot: async (entry) => ({ ...identities.get(entry.runtime.bot.id) }),
    waitForBotProgress: async (entry) => ({ ...identities.get(entry.runtime.bot.id), progress: "advanced" })
  });

  assert.deepEqual(calls, [
    `worker:start:${COMMIT}`,
    "wall:start:2",
    "capture:bot-01:acceptance_capture",
    "wall:stop"
  ]);
  assert.equal(summary.bot1.runId, "run-a");
  assert.equal(summary.bot2.runId, "run-b");
  assert.equal(summary.bot1.observerActive, false);
  assert.equal(summary.bot2.observerActive, true);
  assert.equal(summary.bot2.progress, "advanced");
});

test("real two-bot smoke", { skip: process.env.DUNGEON_RUN_MULTI_BOT_SMOKE !== "1" }, async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  await runMultiBotSmoke({ repoRoot, commit });
});
