import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  chooseNewestBranch,
  launcherPaths,
  parseBranchTips,
  parseCommitHistory,
  selectListedCommit
} from "../scripts/local-ranked-test-launcher-core.mjs";

const HASH_A = "a".repeat(40);
const HASH_B = "b".repeat(40);
const HASH_C = "c".repeat(40);
const HASH_D = "d".repeat(40);
const HASH_E = "e".repeat(40);
const HASH_F = "f".repeat(40);

test("chooses the newest local branch after excluding the launcher host branch", () => {
  const branches = parseBranchTips([
    "main", HASH_A, "2026-08-01T10:00:00Z",
    "codex/record-repair", HASH_B, "2026-08-03T12:00:00Z",
    "codex/local-test-launcher", HASH_C, "2026-08-03T20:10:00Z"
  ].join("\0"));

  assert.equal(
    chooseNewestBranch(branches, { excludedBranchName: "codex/local-test-launcher" }).name,
    "codex/record-repair"
  );
});

test("breaks equal branch timestamps by full branch name", () => {
  const branches = parseBranchTips([
    "codex/zeta", HASH_A, "2026-08-03T12:00:00Z",
    "codex/alpha", HASH_B, "2026-08-03T12:00:00Z"
  ].join("\0"));

  assert.equal(chooseNewestBranch(branches).name, "codex/alpha");
});

test("rejects malformed branch-tip rows and an excluded-only candidate list", () => {
  assert.deepEqual(parseBranchTips(["main", HASH_A].join("\0")), []);
  assert.throws(
    () => chooseNewestBranch([], { excludedBranchName: "codex/local-test-launcher" }),
    /No eligible local branch/u
  );
});

test("shows exactly the newest five commits and rejects every other hash", () => {
  const commits = parseCommitHistory([
    HASH_A, "2026-08-03T20:10:00Z", "first",
    HASH_B, "2026-08-03T19:10:00Z", "second",
    HASH_C, "2026-08-03T18:10:00Z", "third",
    HASH_D, "2026-08-03T17:10:00Z", "fourth",
    HASH_E, "2026-08-03T16:10:00Z", "fifth",
    HASH_F, "2026-08-03T15:10:00Z", "sixth"
  ].join("\0"));

  assert.deepEqual(commits.map((commit) => commit.hash), [HASH_A, HASH_B, HASH_C, HASH_D, HASH_E]);
  assert.equal(selectListedCommit(commits, HASH_D).subject, "fourth");
  assert.throws(() => selectListedCommit(commits, HASH_F), /not one of the displayed commits/u);
  assert.throws(() => selectListedCommit(commits, HASH_A.slice(0, 12)), /full commit hash/u);
});

test("deduplicates repeated commit rows and ignores malformed commit rows", () => {
  const commits = parseCommitHistory([
    HASH_A, "2026-08-03T20:10:00Z", "first",
    HASH_A, "2026-08-03T20:10:00Z", "first duplicate",
    "broken", "invalid-date", "bad"
  ].join("\0"));

  assert.deepEqual(commits.map((commit) => commit.hash), [HASH_A]);
});

test("keeps isolated D1 state on a short per-commit output path", () => {
  const root = path.resolve("D:/repo");
  const paths = launcherPaths(root, HASH_A);

  assert.equal(paths.cacheRoot, path.join(root, "output", "local-ranked-test-launcher"));
  assert.equal(paths.worktree, path.join(paths.cacheRoot, "worktrees", HASH_A));
  assert.equal(paths.stateRoot, path.join(root, "output", "r", HASH_A));
  assert.throws(() => launcherPaths(root, "../main"), /full commit hash/u);
});
test("parses the line-delimited NUL records emitted by git for-each-ref", () => {
  const branches = parseBranchTips(
    `main\x00${HASH_A}\x002026-08-03T01:35:36+02:00\n` +
    `codex/observer-bot-record-archive-repair\x00${HASH_B}\x002026-08-03T18:33:48+02:00\n`
  );

  assert.deepEqual(branches.map((branch) => branch.name), [
    "main",
    "codex/observer-bot-record-archive-repair"
  ]);
});
