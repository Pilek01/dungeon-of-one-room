import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { canonicalDigest } from "../src/security/digests.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER_ROOT = path.resolve(HERE, "..");
const REPOSITORY_ROOT = path.resolve(WORKER_ROOT, "..", "..");
const OUTPUT_ROOT = path.join(REPOSITORY_ROOT, "output");
const ARTIFACT_ROOT = path.join(OUTPUT_ROOT, "online-v3-real-ruleset-e2e");
const PERSIST_ROOT = path.join(ARTIFACT_ROOT, "state");
const XDG_ROOT = path.join(ARTIFACT_ROOT, "xdg");
const WRANGLER = path.join(
  WORKER_ROOT,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js"
);
const CONFIG = path.join(WORKER_ROOT, "wrangler.local.jsonc");
const DATABASE = "dungeon-online-v3-local";
const RULESET_ID = "v08-meta-1";
const RULESET_HASH = manifest.rulesetHash;
const SEASON = "real-ruleset-e2e";

let port;
let baseUrl;
let runtime = null;
let secret;
let runtimeLogs = "";

function assertScopedOutputPath(candidate) {
  const output = path.resolve(OUTPUT_ROOT);
  const resolved = path.resolve(candidate);
  assert(resolved.startsWith(`${output}${path.sep}`));
}

function cliEnvironment(extra = {}) {
  return {
    ...process.env,
    CI: "1",
    NO_COLOR: "1",
    WRANGLER_SEND_METRICS: "false",
    XDG_CONFIG_HOME: XDG_ROOT,
    ...extra
  };
}

async function runWrangler(args) {
  return execFileAsync(process.execPath, [WRANGLER, ...args], {
    cwd: WORKER_ROOT,
    env: cliEnvironment(),
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  });
}

async function acquirePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitForExit(child, timeoutMs = 5_000) {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

async function stopRuntime() {
  if (!runtime) return;
  const current = runtime;
  runtime = null;
  current.child.kill();
  await waitForExit(current.child);
  if (current.child.exitCode === null) {
    current.child.kill("SIGKILL");
    await waitForExit(current.child);
  }
  runtimeLogs += current.logs;
}

async function startRuntime() {
  await stopRuntime();
  const child = spawn(process.execPath, [
    WRANGLER,
    "dev",
    "--local",
    "--config",
    CONFIG,
    "--persist-to",
    PERSIST_ROOT,
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--log-level",
    "error"
  ], {
    cwd: WORKER_ROOT,
    env: cliEnvironment({
      CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
      RANKED_V3_HMAC_SECRET: secret
    }),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const holder = { child, logs: "" };
  runtime = holder;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    holder.logs += chunk;
  });
  child.stderr.on("data", (chunk) => {
    holder.logs += chunk;
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`wrangler dev exited (${child.exitCode}): ${holder.logs}`);
    }
    try {
      const response = await fetch(
        `${baseUrl}/api/v3/leaderboard?season=${SEASON}&limit=1`
      );
      if (response.status === 200) return;
    } catch {
      // Readiness polling is bounded by the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`real ruleset Wrangler runtime did not become ready: ${holder.logs}`);
}

async function d1Query(sql) {
  const { stdout } = await runWrangler([
    "d1",
    "execute",
    DATABASE,
    "--local",
    "--config",
    CONFIG,
    "--persist-to",
    PERSIST_ROOT,
    "--command",
    sql,
    "--json"
  ]);
  const result = JSON.parse(stdout)[0];
  assert.equal(result.success, true);
  return result.results || [];
}

async function request(pathname, body, idempotencyKey) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

function startBody(overrides = {}) {
  return {
    playerName: "WranglerReal",
    season: SEASON,
    gameVersion: "0.8.1",
    rulesetId: RULESET_ID,
    rulesetHash: RULESET_HASH,
    clientInstallIdHash: "install_real_e2e_0123456789",
    ...overrides
  };
}

async function startRun(key = `start-${randomUUID()}`, overrides = {}) {
  return request("/api/v3/runs/start", startBody(overrides), key);
}

function selectionBody(started, choiceIndex = 0, overrides = {}) {
  return {
    runId: started.runId,
    type: "select_starting_relic",
    bootstrapToken: started.bootstrapToken,
    offerId: started.metaState.startingRelicOffer.offerId,
    choiceId:
      started.metaState.startingRelicOffer.publicChoices[choiceIndex].choiceId,
    ...overrides
  };
}

async function selectStarting(started, key, choiceIndex = 0, overrides = {}) {
  return request(
    "/api/v3/runs/event",
    selectionBody(started, choiceIndex, overrides),
    key
  );
}

async function checkpoint(active, key) {
  const directive = active.metaState.currentRoomDirective;
  const commands = [{ code: "move", count: 3 }, { code: "attack", count: 2 }];
  return request("/api/v3/runs/checkpoint", {
    runId: active.runId,
    checkpointToken: active.checkpointToken,
    roomDirectiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
    roomResult: "cleared",
    turnCount: 5,
    elapsedMs: 1_500,
    commandJournalDigest: await canonicalDigest(commands),
    compactRoomProof: {
      roomDirectiveId: directive.directiveId,
      roomNonce: directive.roomNonce,
      commands
    }
  }, key);
}

describe("Online v3 real ruleset Wrangler and D1 lifecycle", {
  concurrency: 1
}, () => {
  before(async () => {
    assertScopedOutputPath(ARTIFACT_ROOT);
    await rm(ARTIFACT_ROOT, { recursive: true, force: true });
    await mkdir(PERSIST_ROOT, { recursive: true });
    await mkdir(XDG_ROOT, { recursive: true });
    port = await acquirePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const version = await runWrangler(["--version"]);
    assert.equal(version.stdout.trim(), "4.114.0");
    const migration = await runWrangler([
      "d1",
      "migrations",
      "apply",
      DATABASE,
      "--local",
      "--config",
      CONFIG,
      "--persist-to",
      PERSIST_ROOT
    ]);
    assert.match(migration.stdout, /0001_initial\.sql/u);
    secret = randomBytes(48).toString("base64url");
    await startRuntime();
  }, { timeout: 60_000 });

  after(async () => {
    await stopRuntime();
    assert.equal(runtimeLogs.includes(secret), false);
  });

  test("real bootstrap persists without room columns and exact start retry survives restart", async () => {
    const key = `real-start-${randomUUID()}`;
    const first = await startRun(key);
    assert.equal(first.response.status, 201);
    assert.equal(first.payload.metaState.status, "awaiting_starting_relic");
    assert.equal(first.payload.metaState.currentRoomDirective, null);
    const rows = await d1Query(`
      SELECT status, revision, room_directive_id, room_nonce
      FROM ranked_runs
      WHERE run_id = '${first.payload.runId}'
    `);
    assert.deepEqual(rows, [{
      status: "awaiting_starting_relic",
      revision: 0,
      room_directive_id: null,
      room_nonce: null
    }]);
    await startRuntime();
    const retry = await startRun(key);
    assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
    assert.deepEqual(retry.payload, first.payload);
  }, { timeout: 45_000 });

  test("selection persistence, exact retry and first directive survive restart", async () => {
    const started = (await startRun()).payload;
    const key = `real-select-${randomUUID()}`;
    const selected = await selectStarting(started, key);
    assert.equal(
      selected.response.status,
      200,
      selected.payload?.error?.code || "selection failed"
    );
    assert.equal(selected.payload.revision, 1);
    assert.equal(selected.payload.metaState.statistics.roomsIssued, 1);
    const directive = selected.payload.metaState.currentRoomDirective;
    const rows = await d1Query(`
      SELECT status, revision, room_directive_id, room_nonce
      FROM ranked_runs
      WHERE run_id = '${started.runId}'
    `);
    assert.deepEqual(rows, [{
      status: "active",
      revision: 1,
      room_directive_id: directive.directiveId,
      room_nonce: directive.roomNonce
    }]);
    await startRuntime();
    const retry = await selectStarting(started, key);
    assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
    assert.deepEqual(retry.payload, selected.payload);
  }, { timeout: 45_000 });

  test("concurrent conflicting starting choices persist one result and one directive", async () => {
    const started = (await startRun()).payload;
    const [left, right] = await Promise.all([
      selectStarting(started, `choice-left-${randomUUID()}`, 0),
      selectStarting(started, `choice-right-${randomUUID()}`, 1)
    ]);
    assert.equal(
      [left, right].filter((result) => result.response.status === 200).length,
      1
    );
    const rows = await d1Query(`
      SELECT revision, room_directive_id, room_nonce, canonical_state_json
      FROM ranked_runs
      WHERE run_id = '${started.runId}'
    `);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].revision, 1);
    assert(rows[0].room_directive_id);
    assert(rows[0].room_nonce);
    const state = JSON.parse(rows[0].canonical_state_json);
    assert.equal(state.statistics.roomsIssued, 1);
    assert.equal(state.offerSettlementHistory.length, 1);
  }, { timeout: 30_000 });

  test("real checkpoint is atomic, sequential and exactly replayed after restart", async () => {
    const started = (await startRun()).payload;
    const selected = (
      await selectStarting(started, `checkpoint-select-${randomUUID()}`)
    ).payload;
    const key = `checkpoint-${randomUUID()}`;
    const first = await checkpoint(selected, key);
    assert.equal(first.response.status, 200);
    assert.equal(first.payload.revision, 2);
    assert.equal(
      first.payload.metaState.currentRoomDirective.roomIndex,
      selected.metaState.currentRoomDirective.roomIndex + 1
    );
    await startRuntime();
    const retry = await checkpoint(selected, key);
    assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
    assert.deepEqual(retry.payload, first.payload);
  }, { timeout: 45_000 });

  test("real finalize dependency is fail closed and creates no leaderboard entry", async () => {
    const started = (await startRun()).payload;
    const selected = (
      await selectStarting(started, `finalize-select-${randomUUID()}`)
    ).payload;
    const directive = selected.metaState.currentRoomDirective;
    const result = await request("/api/v3/runs/finalize", {
      runId: selected.runId,
      checkpointToken: selected.checkpointToken,
      roomDirectiveId: directive.directiveId,
      roomNonce: directive.roomNonce,
      outcome: "defeat"
    }, `finalize-${randomUUID()}`);
    assert.equal(result.response.status, 409);
    assert.equal(
      result.payload.error.code,
      "REAL_RULESET_FINALIZATION_REQUIRES_M3"
    );
    const rows = await d1Query(`
      SELECT status, revision FROM ranked_runs WHERE run_id = '${selected.runId}'
    `);
    assert.deepEqual(rows, [{ status: "active", revision: 1 }]);
    const leaderboard = await d1Query(`
      SELECT COUNT(*) AS count FROM leaderboard_entries WHERE run_id = '${selected.runId}'
    `);
    assert.deepEqual(leaderboard, [{ count: 0 }]);
  }, { timeout: 30_000 });
});
