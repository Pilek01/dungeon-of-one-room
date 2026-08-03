import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  launcherPaths,
  prepareRevision
} from "../scripts/local-ranked-test-launcher-core.mjs";

const HASH_A = "a".repeat(40);
const HASH_B = "b".repeat(40);

function fakePreparation(options = {}) {
  const repoRoot = path.resolve("D:/launcher-repository");
  const paths = launcherPaths(repoRoot, HASH_A);
  const calls = [];
  const directories = [];

  return {
    repoRoot,
    paths,
    calls,
    directories,
    dependencies: {
      async mkdir(directory, mkdirOptions) {
        directories.push([directory, mkdirOptions]);
      },
      async pathExists(candidate) {
        if (candidate === paths.worktree) return options.cachedWorktree === true;
        if (candidate === path.join(paths.worktree, "cloudflare", "leaderboard-v3", "node_modules", "wrangler", "bin", "wrangler.js")) {
          return options.wranglerPresent === true;
        }
        return false;
      },
      async execFile(command, args, execOptions) {
        calls.push([command, args, execOptions]);
        if (command === "git" && args[0] === "-C" && args.at(-2) === "rev-parse") {
          return { stdout: `${options.cachedHash || HASH_A}\n`, stderr: "" };
        }
        return { stdout: "", stderr: "" };
      }
    }
  };
}

test("creates a detached launcher-owned worktree and installs selected Worker dependencies", async () => {
  const fixture = fakePreparation();
  const prepared = await prepareRevision({ hash: HASH_A }, {
    repoRoot: fixture.repoRoot,
    ...fixture.dependencies
  });

  assert.deepEqual(fixture.calls[0], [
    "git",
    ["worktree", "add", "--detach", fixture.paths.worktree, HASH_A],
    { cwd: fixture.repoRoot }
  ]);
  assert.deepEqual(fixture.calls.at(-1), [
    "npm.cmd",
    ["ci"],
    { cwd: path.join(fixture.paths.worktree, "cloudflare", "leaderboard-v3") }
  ]);
  assert.equal(
    fixture.calls.some(([command, args]) => command === "git" && (args.includes("checkout") || args.includes("merge"))),
    false
  );
  assert.equal(prepared.workerRoot, path.join(fixture.paths.worktree, "cloudflare", "leaderboard-v3"));
});

test("reuses only a cached worktree at the selected full commit and skips an existing Wrangler install", async () => {
  const fixture = fakePreparation({ cachedWorktree: true, wranglerPresent: true });
  await prepareRevision({ hash: HASH_A }, {
    repoRoot: fixture.repoRoot,
    ...fixture.dependencies
  });

  assert.equal(fixture.calls.some(([, args]) => args.includes("worktree")), false);
  assert.deepEqual(fixture.calls, [[
    "git",
    ["-C", fixture.paths.worktree, "rev-parse", "HEAD"],
    { cwd: fixture.repoRoot }
  ]]);
});

test("rejects a cached launcher path at another commit rather than reusing it", async () => {
  const fixture = fakePreparation({ cachedWorktree: true, cachedHash: HASH_B });

  await assert.rejects(
    prepareRevision({ hash: HASH_A }, {
      repoRoot: fixture.repoRoot,
      ...fixture.dependencies
    }),
    /does not match the selected commit/u
  );
  assert.equal(fixture.calls.some(([, args]) => args.includes("checkout") || args.includes("merge")), false);
});

