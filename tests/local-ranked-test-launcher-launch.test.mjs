import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  createTestBuildEnvironment,
  createWorkerLaunchPlan,
  patchProtocolRulesetHash,
  redactLaunchLog
} from "../scripts/local-ranked-test-launcher-core.mjs";

const prepared = Object.freeze({
  workerRoot: path.resolve("D:/launcher/worktree/cloudflare/leaderboard-v3"),
  bundleRoot: path.resolve("D:/launcher/worktree/output/pages-test-dist"),
  stateRoot: path.resolve("D:/launcher/output/local-ranked-test-launcher/state/" + "a".repeat(40)),
  wranglerPath: path.resolve("D:/launcher/worktree/cloudflare/leaderboard-v3/node_modules/wrangler/bin/wrangler.js")
});

test("patches exactly one local ruleset hash declaration", () => {
  const patched = patchProtocolRulesetHash(
    "const unrelated = true;\n  const RULESET_HASH = \"sha256:old\";\n",
    "sha256:fixture"
  );

  assert.match(patched, /^  const RULESET_HASH = "sha256:fixture";$/mu);
  assert.throws(
    () => patchProtocolRulesetHash("const RULESET_HASH = \"sha256:one\";\nconst RULESET_HASH = \"sha256:two\";", "sha256:fixture"),
    /exactly one RULESET_HASH/u
  );
  assert.throws(
    () => patchProtocolRulesetHash("const missing = true;", "sha256:fixture"),
    /exactly one RULESET_HASH/u
  );
});

test("build environment carries an Observer Bot password only when explicitly enabled", () => {
  const normal = createTestBuildEnvironment({
    PATH: "fixture",
    DUNGEON_ONLINE_TEST_BOT_PASSWORD: "inherited-value"
  });
  const observer = createTestBuildEnvironment({ PATH: "fixture" }, "local-bot-test");

  assert.equal(normal.PATH, "fixture");
  assert.equal(normal.DUNGEON_ONLINE_TEST_BOT_PASSWORD, undefined);
  assert.equal(observer.DUNGEON_ONLINE_TEST_BOT_PASSWORD, "local-bot-test");
});

test("constructs loopback-only Worker arguments and a process-local signing secret", () => {
  const secret = "s".repeat(64);
  const launch = createWorkerLaunchPlan(prepared, {
    port: 9123,
    secret,
    baseEnv: {
      PATH: "fixture",
      RANKED_V3_HMAC_SECRET: "old-secret",
      DUNGEON_ONLINE_TEST_BOT_PASSWORD: "must-not-reach-worker"
    }
  });

  assert.deepEqual(launch.workerArgs.slice(0, 4), [
    "dev",
    "--local",
    "--config",
    path.join(prepared.workerRoot, "wrangler.local.jsonc")
  ]);
  assert.equal(launch.workerArgs.includes("--remote"), false);
  assert.equal(launch.workerArgs.includes("tunnel"), false);
  assert.equal(launch.workerArgs.includes("--ip"), true);
  assert.equal(launch.workerEnv.CLOUDFLARE_INCLUDE_PROCESS_ENV, "true");
  assert.equal(launch.workerEnv.RANKED_V3_HMAC_SECRET, secret);
  assert.equal(launch.workerEnv.DUNGEON_ONLINE_TEST_BOT_PASSWORD, undefined);
  assert.equal(launch.url, "http://127.0.0.1:9123");
});

test("redacts the HMAC secret and local Observer Bot password from launcher output", () => {
  const secret = "s".repeat(64);
  const redacted = redactLaunchLog(
    "secret=" + secret + " password=local-bot-test",
    [secret, "local-bot-test"]
  );

  assert.equal(redacted.includes(secret), false);
  assert.equal(redacted.includes("local-bot-test"), false);
  assert.match(redacted, /\[redacted\]/u);
});
