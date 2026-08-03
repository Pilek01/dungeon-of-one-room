import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import test from "node:test";

import {
  buildSelectedTestBundle,
  startLocalRankedTest
} from "../scripts/local-ranked-test-launcher-core.mjs";

const HASH_A = "a".repeat(40);
const prepared = Object.freeze({
  hash: HASH_A,
  worktree: path.resolve("D:/launcher/worktree"),
  workerRoot: path.resolve("D:/launcher/worktree/cloudflare/leaderboard-v3"),
  bundleRoot: path.resolve("D:/launcher/worktree/output/pages-test-dist"),
  stateRoot: path.resolve("D:/launcher/state/" + HASH_A),
  manifestPath: path.resolve("D:/launcher/worktree/cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/ruleset-manifest.json"),
  wranglerPath: path.resolve("D:/launcher/worktree/cloudflare/leaderboard-v3/node_modules/wrangler/bin/wrangler.js")
});

test("builds the selected test bundle and patches only its local protocol hash", async () => {
  const calls = [];
  const writes = [];
  await buildSelectedTestBundle(prepared, {
    observerPassword: "local-bot-test",
    baseEnv: { PATH: "fixture" },
    async execFile(command, args, options) {
      calls.push([command, args, options]);
      return { stdout: "", stderr: "" };
    },
    async readFile(filePath) {
      if (filePath === prepared.manifestPath) {
        return JSON.stringify({ rulesetHash: "sha256:fixture" });
      }
      return "  const RULESET_HASH = \"sha256:old\";\n";
    },
    async writeFile(filePath, text, encoding) {
      writes.push([filePath, text, encoding]);
    }
  });

  assert.deepEqual(calls, [[
    process.execPath,
    ["scripts/build-pages-v3.mjs", "--target", "test"],
    {
      cwd: prepared.worktree,
      env: {
        PATH: "fixture",
        DUNGEON_ONLINE_TEST_BOT_PASSWORD: "local-bot-test"
      }
    }
  ]]);
  assert.deepEqual(writes, [[
    path.join(prepared.bundleRoot, "online-v3", "ranked-v3-protocol.js"),
    "  const RULESET_HASH = \"sha256:fixture\";\n",
    "utf8"
  ]]);
});

test("starts only the tracked loopback Worker and stops that child", async () => {
  const output = new EventEmitter();
  const errors = new EventEmitter();
  output.setEncoding = () => {};
  errors.setEncoding = () => {};
  const child = new EventEmitter();
  child.stdout = output;
  child.stderr = errors;
  child.exitCode = null;
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    child.exitCode = 0;
    child.emit("exit", 0);
    return true;
  };

  let spawnCall = null;
  const controller = await startLocalRankedTest({ hash: HASH_A }, {
    baseEnv: { PATH: "fixture" },
    secret: "s".repeat(64),
    prepareRevision: async () => prepared,
    buildSelectedTestBundle: async () => {},
    acquirePort: async () => 9234,
    waitForLocalReady: async (url) => {
      assert.equal(url, "http://127.0.0.1:9234");
    },
    spawn(command, args, options) {
      spawnCall = [command, args, options];
      return child;
    }
  });

  assert.deepEqual(spawnCall, [
    process.execPath,
    [
      prepared.wranglerPath,
      "dev",
      "--local",
      "--config",
      path.join(prepared.workerRoot, "wrangler.local.jsonc"),
      "--persist-to",
      prepared.stateRoot,
      "--ip",
      "127.0.0.1",
      "--port",
      "9234",
      "--assets",
      prepared.bundleRoot,
      "--log-level",
      "error"
    ],
    {
      cwd: prepared.workerRoot,
      env: {
        PATH: "fixture",
        CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
        RANKED_V3_HMAC_SECRET: "s".repeat(64)
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    }
  ]);
  assert.equal(controller.url, "http://127.0.0.1:9234");
  await controller.stop();
  assert.equal(child.killed, true);
});
