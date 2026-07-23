import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(WORKER_ROOT, "..", "..");
const SAFE_REPO = REPO_ROOT.replaceAll("\\", "/");
const BASELINE_SHA = "f98820c99066d810169e100beb23a54a332734bd";

const PROTECTED_PATHS = [
  "game.js",
  "index.html",
  "style.css",
  "style-hd-boot.css",
  "style-hd-composition.css",
  "style-hd-defeat.css",
  "style-hd-forge.css",
  "style-hd-menu.css",
  "style-hd-merchant.css",
  "style-hd-pact.css",
  "style-hd-relic-draft.css",
  "skills-actions.js",
  "vault-room.js",
  "assets"
];

test("Phase 2 protected baseline paths match f98820c", () => {
  const changed = execFileSync(
    "git",
    [
      "-c",
      `safe.directory=${SAFE_REPO}`,
      "diff",
      "--name-only",
      BASELINE_SHA,
      "--",
      ...PROTECTED_PATHS
    ],
    { cwd: REPO_ROOT, encoding: "utf8" }
  ).trim();
  assert.equal(changed, "");
});

test("Worker remains disconnected from index.html and gameplay modules", async () => {
  const index = await readFile(path.join(REPO_ROOT, "index.html"), "utf8");
  assert.doesNotMatch(index, /leaderboard-v3|online-v3\/ranked-v3/iu);

  const workerFiles = execFileSync(
    "git",
    [
      "-c",
      `safe.directory=${SAFE_REPO}`,
      "status",
      "--short",
      "--untracked-files=all",
      "--",
      "cloudflare/leaderboard-v3"
    ],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
  assert.doesNotMatch(workerFiles, /game\.js|index\.html|style|assets/iu);
});

test("Worker source imports no game, DOM, audio, HUD, renderer, or Ranked v2 code", async () => {
  const sourceFiles = [
    "src/index.js",
    "src/domain/run-state.js",
    "src/domain/transitions.js",
    "src/storage/d1-runs.js",
    "src/storage/d1-leaderboard.js"
  ];
  for (const relative of sourceFiles) {
    const source = await readFile(path.join(WORKER_ROOT, relative), "utf8");
    assert.doesNotMatch(
      source,
      /game\.js|ranked-runtime|sim-core|presentationDirector|\/api\/ranked\/v2|document\.|window\./iu
    );
  }
});
