import assert from "node:assert/strict";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  attachLauncherCommandInput,
  chooseNewestBranch,
  launcherPaths,
  listLocalCandidates,
  parseBranchTips,
  parseCommitHistory,
  runLauncherCli,
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

test("launcher running from main selects main even when a safety branch is newer", async () => {
  const calls = [];
  const result = await listLocalCandidates({
    repoRoot: path.resolve("D:/repo"),
    async execFile(command, args) {
      calls.push([command, args]);
      if (args[0] === "branch") return { stdout: "main\n" };
      if (args[0] === "for-each-ref") {
        return {
          stdout: [
            "main", HASH_A, "2026-08-03T12:00:00Z",
            "codex/safety-pre-consolidation", HASH_B, "2026-08-04T12:00:00Z"
          ].join("\0")
        };
      }
      if (args[0] === "log") {
        return { stdout: [HASH_A, "2026-08-03T12:00:00Z", "main commit"].join("\0") };
      }
      throw new Error(`Unexpected git command: ${args.join(" ")}`);
    }
  });

  assert.equal(result.branch.name, "main");
  assert.deepEqual(calls.at(-1)[1].slice(0, 2), ["log", "main"]);
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

test("multi-bot CLI always selects the newest listed commit and starts one shared Worker", async () => {
  const events = [];
  const calls = [];
  const worker = { url: "http://127.0.0.1:9123", stop: async () => {} };
  const wall = { sessionRoot: path.resolve("D:/repo/output/multi-bot-runs/session-a"), stop: async () => {} };
  const result = await runLauncherCli([
    "start", "--multi-bot", "--json-events",
    "--monitor-x", "3440", "--monitor-y", "0",
    "--monitor-width", "1080", "--monitor-height", "1872"
  ], {
    repoRoot: path.resolve("D:/repo"),
    emit: (event) => events.push(event),
    sessionId: "session-a",
    listLocalCandidates: async () => ({ branch: { name: "main" }, commits: [
      { hash: HASH_A, subject: "newest" }, { hash: HASH_B, subject: "older" }
    ] }),
    startLocalRankedTest: async (commit) => { calls.push(["worker", commit.hash]); return worker; },
    startMultiBotWall: async (options) => {
      calls.push(["wall", options.commit, options.worker]);
      options.emit({ type: "artifact_root", path: wall.sessionRoot });
      return wall;
    }
  });

  assert.equal(result, wall);
  assert.deepEqual(calls, [["worker", HASH_A], ["wall", HASH_A, worker]]);
  assert.deepEqual(events.map((event) => event.type), ["wall_starting", "artifact_root", "wall_ready"]);
});

test("multi-bot CLI rejects commit overrides and non-portrait monitor bounds", async () => {
  const base = ["start", "--multi-bot", "--json-events", "--monitor-x", "0", "--monitor-y", "0"];
  await assert.rejects(
    runLauncherCli([...base, "--monitor-width", "1080", "--monitor-height", "1872", "--commit", HASH_A], { emit() {} }),
    /does not accept --commit/u
  );
  await assert.rejects(
    runLauncherCli([...base, "--monitor-width", "1920", "--monitor-height", "1080"], { emit() {} }),
    /portrait monitor/u
  );
});

test("leaderboard CLI reads only repo-owned local bot results for the requested scope", async () => {
  const calls = [];
  const records = [{ botId: "bot-02", score: 900 }];
  const result = await runLauncherCli([
    "leaderboard", "--json", "--scope", "today"
  ], {
    repoRoot: path.resolve("D:/repo"),
    async listBotLeaderboard(outputRoot, options) {
      calls.push([outputRoot, options.scope]);
      return records;
    },
    listLocalCandidates: async () => { throw new Error("git must not run"); },
    startLocalRankedTest: async () => { throw new Error("Worker must not start"); }
  });

  assert.deepEqual(result, { records });
  assert.deepEqual(calls, [[
    path.resolve("D:/repo/output/multi-bot-runs"),
    "today"
  ]]);
});

test("leaderboard CLI rejects unsupported scopes", async () => {
  await assert.rejects(
    runLauncherCli(["leaderboard", "--json", "--scope", "week"], {
      repoRoot: path.resolve("D:/repo"),
      listBotLeaderboard: async () => []
    }),
    /today or all/u
  );
});

test("line-buffered stdin commands isolate bot actions and report invalid input without stopping the wall", async () => {
  const input = new PassThrough();
  const events = [];
  const actions = [];
  const controller = {
    async focusBot(id) { actions.push(`focus:${id}`); },
    async stopBot(id) { actions.push(`stop:${id}`); },
    async stop() { actions.push("stop:all"); }
  };
  const commands = attachLauncherCommandInput(input, controller, (event) => events.push(event));
  input.write('{"type":"focus_bot","botId":"bot-04"}\nnot-json\n');
  input.write('{"type":"stop_bot","botId":"bot-04"}\n{"type":"stop"}\n');
  await commands.drain();

  assert.deepEqual(actions, ["focus:bot-04", "stop:bot-04", "stop:all"]);
  assert.equal(events.filter((event) => event.type === "command_failed").length, 1);
  assert.equal(events.at(-1).type, "stopped");
});
