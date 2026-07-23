import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID, webcrypto } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { canonicalDigest } from "../src/security/digests.js";
import {
  decodeCheckpointToken,
  signCheckpointToken
} from "../src/security/checkpoint-token.js";
import {
  FIXTURE_RULESET_HASH
} from "../test/fixtures/fixture-ruleset.js";

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER_ROOT = path.resolve(HERE, "..");
const REPOSITORY_ROOT = path.resolve(WORKER_ROOT, "..", "..");
const OUTPUT_ROOT = path.join(REPOSITORY_ROOT, "output");
const ARTIFACT_ROOT = path.join(OUTPUT_ROOT, "online-v3-worker-e2e");
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
const DATABASE = "dungeon-online-v3-local-fixture";
const FIXTURE_SEASON = "fixture-season";
const OTHER_SEASON = "fixture-season-other";
const encoder = new TextEncoder();

let port;
let baseUrl;
let runtime = null;
let activeSecret = "";
let allRuntimeLogs = "";
const issuedTokens = new Set();
const runtimeSecrets = new Set();
const report = {
  wranglerVersion: "",
  migration: {},
  schema: {},
  endpoints: {},
  idempotency: {},
  concurrency: {},
  persistence: {},
  hmac: {},
  networkLoss: {},
  finalization: {},
  leaderboard: {},
  sizes: {},
  logs: {}
};

function assertScopedOutputPath(candidate) {
  const resolvedOutput = path.resolve(OUTPUT_ROOT);
  const resolvedCandidate = path.resolve(candidate);
  assert(
    resolvedCandidate.startsWith(`${resolvedOutput}${path.sep}`),
    `Refusing to mutate path outside output: ${resolvedCandidate}`
  );
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

async function runWrangler(args, options = {}) {
  const result = await execFileAsync(process.execPath, [WRANGLER, ...args], {
    cwd: WORKER_ROOT,
    env: cliEnvironment(options.env),
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr
  };
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
  const parsed = JSON.parse(stdout);
  assert.equal(parsed[0]?.success, true, stdout);
  return parsed[0].results || [];
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function acquirePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const selected = address.port;
  await new Promise((resolve) => server.close(resolve));
  return selected;
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

async function stopRuntime() {
  if (!runtime) return;
  const closing = runtime;
  runtime = null;
  closing.child.kill();
  await waitForExit(closing.child, 5_000);
  if (closing.child.exitCode === null) {
    closing.child.kill("SIGKILL");
    await waitForExit(closing.child, 5_000);
  }
  allRuntimeLogs += closing.logs;
}

async function startRuntime(secret) {
  await stopRuntime();
  activeSecret = secret;
  runtimeSecrets.add(secret);
  const child = (await import("node:child_process")).spawn(
    process.execPath,
    [
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
    ],
    {
      cwd: WORKER_ROOT,
      env: cliEnvironment({
        CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
        RANKED_V3_HMAC_SECRET: secret
      }),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    }
  );
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
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`wrangler dev exited early (${child.exitCode}): ${holder.logs}`);
    }
    try {
      const response = await fetch(
        `${baseUrl}/api/v3/leaderboard?season=${FIXTURE_SEASON}&limit=1`
      );
      if (response.status === 200) return;
      lastError = new Error(`readiness returned ${response.status}`);
    } catch (cause) {
      lastError = cause;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`wrangler dev did not become ready: ${lastError}\n${holder.logs}`);
}

function uniqueKey(label) {
  return `${label}-${randomUUID()}`;
}

function jsonBytes(value) {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

async function signRawTokenPayload(payloadText, secret) {
  const payloadSegment = Buffer.from(payloadText, "utf8").toString("base64url");
  const key = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await webcrypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadSegment)
  );
  return `${payloadSegment}.${Buffer.from(signature).toString("base64url")}`;
}

async function httpRequest(method, pathname, body, options = {}) {
  const headers = new Headers(options.headers || {});
  if (body !== undefined) headers.set("content-type", "application/json");
  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey);
  }
  const serializedBody = body === undefined ? undefined : JSON.stringify(body);
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: serializedBody
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    // Assertions below report the non-JSON response.
  }
  if (payload?.checkpointToken) issuedTokens.add(payload.checkpointToken);
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    payload,
    text,
    responseBytes: encoder.encode(text).byteLength,
    requestBytes: serializedBody ? encoder.encode(serializedBody).byteLength : 0
  };
}

function assertJsonResponse(result, expectedStatus) {
  assert.equal(result.status, expectedStatus, result.text);
  assert.match(result.headers["content-type"] || "", /^application\/json\b/u);
  assert(result.payload && typeof result.payload === "object", result.text);
}

function startBody(overrides = {}) {
  return {
    playerName: "FixturePlayer",
    season: FIXTURE_SEASON,
    gameVersion: "v0.8.0",
    rulesetHash: FIXTURE_RULESET_HASH,
    clientInstallIdHash: "local_e2e_install_hash_1234567890",
    ...overrides
  };
}

async function startRun(options = {}) {
  const body = options.body || startBody();
  const key = options.key || uniqueKey("start");
  const result = await httpRequest("POST", "/api/v3/runs/start", body, {
    idempotencyKey: key
  });
  assertJsonResponse(result, options.expectedStatus || 201);
  return { ...result, body, key };
}

async function checkpointBody(session, overrides = {}) {
  const commands = overrides.commands || [
    { code: "move", count: 4 },
    { code: "attack", count: 2 }
  ];
  const meta = session.metaState;
  return {
    runId: session.runId,
    checkpointToken: session.checkpointToken,
    roomDirectiveId: meta.roomDirective.id,
    roomNonce: meta.roomDirective.roomNonce,
    roomResult: "cleared",
    turnCount: 6,
    elapsedMs: 12_000,
    commandJournalDigest: await canonicalDigest(commands),
    compactRoomProof: {
      roomDirectiveId: meta.roomDirective.id,
      roomNonce: meta.roomDirective.roomNonce,
      commands
    },
    clientSummary: {},
    ...overrides,
    commands: undefined
  };
}

async function checkpointRun(session, options = {}) {
  const body = options.body || await checkpointBody(session, options.overrides);
  const key = options.key || uniqueKey("checkpoint");
  const result = await httpRequest("POST", "/api/v3/runs/checkpoint", body, {
    idempotencyKey: key
  });
  assertJsonResponse(result, options.expectedStatus || 200);
  return { ...result, body, key };
}

function eventBody(session, type, payload = {}, overrides = {}) {
  const meta = session.metaState;
  return {
    runId: session.runId,
    checkpointToken: session.checkpointToken,
    roomDirectiveId: meta.roomDirective.id,
    roomNonce: meta.roomDirective.roomNonce,
    type,
    payload,
    ...overrides
  };
}

async function eventRun(session, type, payload = {}, options = {}) {
  const body = options.body || eventBody(session, type, payload, options.overrides);
  const key = options.key || uniqueKey("event");
  const result = await httpRequest("POST", "/api/v3/runs/event", body, {
    idempotencyKey: key
  });
  assertJsonResponse(result, options.expectedStatus || 200);
  return { ...result, body, key };
}

function finalizeBody(session, outcome = "defeat", overrides = {}) {
  const meta = session.metaState;
  return {
    runId: session.runId,
    checkpointToken: session.checkpointToken,
    roomDirectiveId: meta.roomDirective.id,
    roomNonce: meta.roomDirective.roomNonce,
    outcome,
    ...overrides
  };
}

async function finalizeRunHttp(session, options = {}) {
  const body = options.body || finalizeBody(
    session,
    options.outcome || "defeat",
    options.overrides
  );
  const key = options.key || uniqueKey("finalize");
  const result = await httpRequest("POST", "/api/v3/runs/finalize", body, {
    idempotencyKey: key
  });
  assertJsonResponse(result, options.expectedStatus || 200);
  return { ...result, body, key };
}

async function runRow(runId) {
  const rows = await d1Query(`
    SELECT run_id, status, revision, depth, gold, lives, state_digest,
           canonical_state_json, recent_ops_json
    FROM ranked_runs
    WHERE run_id = ${sqlText(runId)}
  `);
  assert.equal(rows.length, 1, `Expected one run row for ${runId}`);
  return rows[0];
}

async function leaderboardCount(runId) {
  const rows = await d1Query(`
    SELECT COUNT(*) AS count
    FROM leaderboard_entries
    WHERE run_id = ${sqlText(runId)}
  `);
  return Number(rows[0].count);
}

async function discardHttpResponse(method, pathname, body, key) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": key
    },
    body: JSON.stringify(body)
  });
  await response.arrayBuffer();
  return response.status;
}

describe("Online v3 local Wrangler runtime and persistent D1", {
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
    report.wranglerVersion = version.stdout.trim();
    assert.equal(report.wranglerVersion, "4.114.0");

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
    assert.match(migration.stdout, /4 commands executed successfully/u);
    report.migration = {
      file: "0001_initial.sql",
      commands: 4,
      local: true
    };

    activeSecret = randomBytes(48).toString("base64url");
    await startRuntime(activeSecret);
  }, { timeout: 60_000 });

  after(async () => {
    await stopRuntime();
    for (const token of issuedTokens) {
      assert.equal(allRuntimeLogs.includes(token), false, "Runtime logs exposed a checkpoint token.");
    }
    for (const secret of runtimeSecrets) {
      assert.equal(
        allRuntimeLogs.includes(secret),
        false,
        "Runtime logs exposed an HMAC secret."
      );
    }
    report.logs = {
      checkpointTokensExposed: false,
      hmacSecretExposed: false,
      bytesCaptured: encoder.encode(allRuntimeLogs).byteLength
    };
    await writeFile(
      path.join(ARTIFACT_ROOT, "local-e2e-summary.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      path.join(ARTIFACT_ROOT, "wrangler-runtime.log"),
      allRuntimeLogs,
      "utf8"
    );
  }, { timeout: 30_000 });

  test("migration exposes exactly the two application tables and required index", {
    timeout: 30_000
  }, async () => {
    const schema = await d1Query(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_schema
      WHERE name NOT LIKE 'sqlite_%'
      ORDER BY type, name
    `);
    const applicationTables = schema
      .filter((entry) =>
        entry.type === "table" &&
        !["_cf_METADATA", "d1_migrations"].includes(entry.name)
      )
      .map((entry) => entry.name);
    assert.deepEqual(applicationTables, [
      "leaderboard_entries",
      "ranked_runs"
    ]);
    assert.equal(
      schema.some((entry) =>
        entry.type === "index" &&
        entry.name === "leaderboard_entries_season_score_created"
      ),
      true
    );
    assert.equal(schema.some((entry) => /command|event/iu.test(entry.name)), false);

    const runColumns = await d1Query("PRAGMA table_info(ranked_runs)");
    const entryColumns = await d1Query("PRAGMA table_info(leaderboard_entries)");
    const runByName = new Map(runColumns.map((column) => [column.name, column]));
    const entryByName = new Map(entryColumns.map((column) => [column.name, column]));
    assert.equal(runByName.get("run_id").type, "TEXT");
    assert.equal(Number(runByName.get("run_id").pk), 1);
    assert.equal(Number(runByName.get("canonical_state_json").notnull), 1);
    assert.equal(Number(runByName.get("recent_ops_json").notnull), 1);
    assert.equal(Number(runByName.get("revision").notnull), 1);
    assert.equal(entryByName.get("run_id").type, "TEXT");
    assert.equal(Number(entryByName.get("run_id").pk), 1);
    assert.equal(Number(entryByName.get("build_json").notnull), 1);
    assert.equal(Number(entryByName.get("verification_level").notnull), 1);
    report.schema = {
      applicationTables,
      internalTables: ["_cf_METADATA", "d1_migrations"],
      leaderboardIndex: "leaderboard_entries_season_score_created",
      runColumnCount: runColumns.length,
      leaderboardColumnCount: entryColumns.length
    };
  });

  test("all six endpoints work through HTTP and persist authoritative rows", {
    timeout: 60_000
  }, async () => {
    const started = await startRun();
    assert.equal(started.payload.ok, true);
    assert.equal(started.payload.revision, 0);
    assert.equal(started.payload.metaState.depth, 0);
    assert.match(started.payload.checkpointToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
    let stored = await runRow(started.payload.runId);
    assert.equal(stored.status, "active");
    assert.equal(Number(stored.revision), 0);

    const checkpointed = await checkpointRun(started.payload);
    assert.equal(checkpointed.payload.revision, 1);
    assert.equal(checkpointed.payload.metaState.depth, 1);
    assert.equal(checkpointed.payload.metaState.gold, 10);
    stored = await runRow(started.payload.runId);
    assert.equal(Number(stored.revision), 1);
    assert.equal(Number(stored.depth), 1);
    assert.equal(Number(stored.gold), 10);

    const evented = await eventRun(
      checkpointed.payload,
      "reward_selected",
      { relicId: "fixture_ember" }
    );
    assert.equal(evented.payload.revision, 2);
    assert.deepEqual(evented.payload.metaState.build.relics, [
      { id: "fixture_ember", stacks: 1 }
    ]);
    stored = await runRow(started.payload.runId);
    assert.equal(Number(stored.revision), 2);
    assert.deepEqual(JSON.parse(stored.canonical_state_json).build.relics, [
      { id: "fixture_ember", stacks: 1 }
    ]);

    const finalized = await finalizeRunHttp(evented.payload);
    assert.equal(finalized.payload.revision, 3);
    assert.equal(finalized.payload.verificationLevel, "checkpoint_verified_v3");
    stored = await runRow(started.payload.runId);
    assert.equal(stored.status, "finalized");
    assert.equal(Number(stored.revision), 3);
    assert.equal(await leaderboardCount(started.payload.runId), 1);

    const list = await httpRequest(
      "GET",
      `/api/v3/leaderboard?season=${FIXTURE_SEASON}&limit=20`
    );
    assertJsonResponse(list, 200);
    assert(list.payload.entries.some((entry) => entry.runId === started.payload.runId));
    assert.equal("build" in list.payload.entries[0], false);

    const detail = await httpRequest(
      "GET",
      `/api/v3/leaderboard/${started.payload.runId}`
    );
    assertJsonResponse(detail, 200);
    assert.deepEqual(detail.payload.entry.build.relics, [
      { id: "fixture_ember", stacks: 1 }
    ]);
    assert.equal(detail.text.includes("canonical_state_json"), false);
    assert.equal(detail.text.includes("recent_ops_json"), false);
    assert.equal(detail.text.includes("checkpointToken"), false);
    report.endpoints = {
      start: 201,
      checkpoint: 200,
      event: 200,
      finalize: 200,
      leaderboard: 200,
      detail: 200,
      persistedRevision: 3,
      publicCanonicalStateExposed: false
    };
  });

  test("start idempotency survives loss and a real parallel race", {
    timeout: 60_000
  }, async () => {
    const body = startBody({ playerName: "ConcurrentStart" });
    const key = uniqueKey("concurrent-start");
    const [first, second] = await Promise.all([
      httpRequest("POST", "/api/v3/runs/start", body, { idempotencyKey: key }),
      httpRequest("POST", "/api/v3/runs/start", body, { idempotencyKey: key })
    ]);
    assertJsonResponse(first, 201);
    assertJsonResponse(second, 201);
    assert.equal(first.payload.runId, second.payload.runId);
    assert.deepEqual(first.payload, second.payload);
    assert(
      [first, second].some((result) => result.headers["x-idempotent-replay"] === "1")
    );
    const rows = await d1Query(`
      SELECT run_id
      FROM ranked_runs
      WHERE season = ${sqlText(FIXTURE_SEASON)}
        AND start_idempotency_key = ${sqlText(key)}
    `);
    assert.equal(rows.length, 1);

    const changed = await httpRequest(
      "POST",
      "/api/v3/runs/start",
      { ...body, playerName: "ChangedPayload" },
      { idempotencyKey: key }
    );
    assertJsonResponse(changed, 409);
    assert.equal(changed.payload.error.code, "IDEMPOTENCY_KEY_REUSED");
    const changedSeason = await httpRequest(
      "POST",
      "/api/v3/runs/start",
      { ...body, season: OTHER_SEASON },
      { idempotencyKey: key }
    );
    assertJsonResponse(changedSeason, 409);
    assert.equal(changedSeason.payload.error.code, "IDEMPOTENCY_KEY_REUSED");
    report.idempotency.start = {
      parallelStatuses: [first.status, second.status],
      sameRunId: true,
      rowCount: 1,
      changedPayloadStatus: changed.status,
      changedSeasonStatus: changedSeason.status
    };
  });

  test("conditional revisions settle checkpoint, reward, purchase, and finalize once", {
    timeout: 90_000
  }, async () => {
    const started = await startRun({
      body: startBody({ playerName: "ConcurrencyRun" })
    });
    const checkpointRequest = await checkpointBody(started.payload);
    const checkpointResults = await Promise.all([
      httpRequest("POST", "/api/v3/runs/checkpoint", checkpointRequest, {
        idempotencyKey: uniqueKey("checkpoint-race-a")
      }),
      httpRequest("POST", "/api/v3/runs/checkpoint", checkpointRequest, {
        idempotencyKey: uniqueKey("checkpoint-race-b")
      })
    ]);
    assert.deepEqual(
      checkpointResults.map((result) => result.status).sort(),
      [200, 409]
    );
    const checkpointWinner = checkpointResults.find((result) => result.status === 200);
    let stored = await runRow(started.payload.runId);
    assert.equal(Number(stored.revision), 1);
    assert.equal(Number(stored.depth), 1);
    assert.equal(Number(stored.gold), 10);

    const rewardRequest = eventBody(
      checkpointWinner.payload,
      "relic_selected",
      { relicId: "fixture_ember" }
    );
    const rewardResults = await Promise.all([
      httpRequest("POST", "/api/v3/runs/event", rewardRequest, {
        idempotencyKey: uniqueKey("reward-race-a")
      }),
      httpRequest("POST", "/api/v3/runs/event", rewardRequest, {
        idempotencyKey: uniqueKey("reward-race-b")
      })
    ]);
    assert.deepEqual(
      rewardResults.map((result) => result.status).sort(),
      [200, 409]
    );
    const rewardWinner = rewardResults.find((result) => result.status === 200);
    stored = await runRow(started.payload.runId);
    assert.equal(Number(stored.revision), 2);
    assert.deepEqual(JSON.parse(stored.canonical_state_json).build.relics, [
      { id: "fixture_ember", stacks: 1 }
    ]);

    const item = rewardWinner.payload.metaState.merchantInventory[0];
    const purchaseRequest = eventBody(
      rewardWinner.payload,
      "merchant_purchase",
      { itemId: item.id, cost: 0 }
    );
    const purchaseResults = await Promise.all([
      httpRequest("POST", "/api/v3/runs/event", purchaseRequest, {
        idempotencyKey: uniqueKey("purchase-race-a")
      }),
      httpRequest("POST", "/api/v3/runs/event", purchaseRequest, {
        idempotencyKey: uniqueKey("purchase-race-b")
      })
    ]);
    assert.deepEqual(
      purchaseResults.map((result) => result.status).sort(),
      [200, 409]
    );
    const purchaseWinner = purchaseResults.find((result) => result.status === 200);
    stored = await runRow(started.payload.runId);
    assert.equal(Number(stored.revision), 3);
    assert.equal(Number(stored.gold), 3);
    assert.equal(JSON.parse(stored.canonical_state_json).merchantInventory.length, 0);

    const invalid = await finalizeRunHttp(purchaseWinner.payload, {
      outcome: "client_forced",
      expectedStatus: 422
    });
    assert.equal(invalid.payload.error.code, "FINALIZE_OUTCOME_INVALID");
    stored = await runRow(started.payload.runId);
    assert.equal(stored.status, "active");
    assert.equal(await leaderboardCount(started.payload.runId), 0);

    const finalizeRequest = finalizeBody(purchaseWinner.payload);
    const finalizeResults = await Promise.all([
      httpRequest("POST", "/api/v3/runs/finalize", finalizeRequest, {
        idempotencyKey: uniqueKey("finalize-race-a")
      }),
      httpRequest("POST", "/api/v3/runs/finalize", finalizeRequest, {
        idempotencyKey: uniqueKey("finalize-race-b")
      })
    ]);
    assert.deepEqual(
      finalizeResults.map((result) => result.status).sort(),
      [200, 409]
    );
    stored = await runRow(started.payload.runId);
    assert.equal(stored.status, "finalized");
    assert.equal(Number(stored.revision), 4);
    assert.equal(await leaderboardCount(started.payload.runId), 1);
    assert(JSON.parse(stored.recent_ops_json).length <= 24);
    report.concurrency = {
      checkpoint: checkpointResults.map((result) => result.status).sort(),
      reward: rewardResults.map((result) => result.status).sort(),
      merchantPurchase: purchaseResults.map((result) => result.status).sort(),
      finalize: finalizeResults.map((result) => result.status).sort(),
      finalRevision: 4,
      depth: 1,
      gold: 3
    };
    report.finalization = {
      invalidBeforeBatch: "no changes",
      runStatus: stored.status,
      leaderboardRows: 1,
      inconsistentStateObserved: false
    };
  });

  test("persistent D1 and HMAC tokens survive a same-secret restart", {
    timeout: 90_000
  }, async () => {
    const persistentSecret = activeSecret;
    const started = await startRun({
      body: startBody({ playerName: "PersistentRun" })
    });
    const checkpointed = await checkpointRun(started.payload);
    const beforeRestart = await runRow(started.payload.runId);
    assert.equal(Number(beforeRestart.revision), 1);

    await startRuntime(persistentSecret);
    const afterRestartBeforeMutation = await runRow(started.payload.runId);
    assert.equal(Number(afterRestartBeforeMutation.revision), 1);
    assert.equal(afterRestartBeforeMutation.state_digest, beforeRestart.state_digest);
    const evented = await eventRun(checkpointed.payload, "life_lost");
    assert.equal(evented.payload.revision, 2);
    assert.equal(evented.payload.metaState.lives, 2);

    const tokenBeforeWrongSecretRestart = evented.payload.checkpointToken;
    const currentClaims = decodeCheckpointToken(
      tokenBeforeWrongSecretRestart
    ).payload;
    const noncanonicalPayload = JSON.stringify({
      runId: currentClaims.runId,
      protocolVersion: currentClaims.protocolVersion,
      revision: currentClaims.revision,
      season: currentClaims.season,
      rulesetHash: currentClaims.rulesetHash,
      stateDigest: currentClaims.stateDigest,
      roomDirectiveId: currentClaims.roomDirectiveId,
      roomNonce: currentClaims.roomNonce,
      issuedAt: currentClaims.issuedAt,
      expiresAt: currentClaims.expiresAt
    });
    const alteredTokens = {
      expired: await signCheckpointToken({
        ...currentClaims,
        issuedAt: currentClaims.issuedAt - 2_000,
        expiresAt: currentClaims.issuedAt - 1_000
      }, persistentSecret),
      season: await signCheckpointToken({
        ...currentClaims,
        season: OTHER_SEASON
      }, persistentSecret),
      ruleset: await signCheckpointToken({
        ...currentClaims,
        rulesetHash: "sha256:other-runtime-ruleset"
      }, persistentSecret),
      noncanonical: await signRawTokenPayload(
        noncanonicalPayload,
        persistentSecret
      )
    };
    const alteredStatuses = {};
    for (const [label, checkpointToken] of Object.entries(alteredTokens)) {
      issuedTokens.add(checkpointToken);
      const rejectedToken = await httpRequest(
        "POST",
        "/api/v3/runs/event",
        {
          ...eventBody(evented.payload, "life_lost"),
          checkpointToken
        },
        { idempotencyKey: uniqueKey(`altered-token-${label}`) }
      );
      assertJsonResponse(rejectedToken, 401);
      alteredStatuses[label] = rejectedToken.payload.error.code;
    }
    assert.equal(alteredStatuses.expired, "TOKEN_EXPIRED");
    assert.equal(alteredStatuses.season, "TOKEN_INVALID");
    assert.equal(alteredStatuses.ruleset, "TOKEN_INVALID");
    assert.equal(alteredStatuses.noncanonical, "TOKEN_INVALID");

    const wrongSecret = randomBytes(48).toString("base64url");
    await startRuntime(wrongSecret);
    const rejected = await httpRequest(
      "POST",
      "/api/v3/runs/event",
      eventBody(evented.payload, "life_lost"),
      { idempotencyKey: uniqueKey("wrong-secret") }
    );
    assertJsonResponse(rejected, 401);
    assert.equal(rejected.payload.error.code, "TOKEN_INVALID");
    const afterRejected = await runRow(started.payload.runId);
    assert.equal(Number(afterRejected.revision), 2);

    await startRuntime(persistentSecret);
    const checkpointedAgain = await checkpointRun(evented.payload);
    assert.equal(checkpointedAgain.payload.revision, 3);
    assert.notEqual(checkpointedAgain.payload.checkpointToken, tokenBeforeWrongSecretRestart);
    const finalized = await finalizeRunHttp(checkpointedAgain.payload);
    assert.equal(finalized.payload.revision, 4);
    const detail = await httpRequest(
      "GET",
      `/api/v3/leaderboard/${started.payload.runId}`
    );
    assertJsonResponse(detail, 200);
    report.persistence = {
      revisionBeforeRestart: 1,
      revisionAfterSameSecretRestart: 2,
      revisionAfterSecondCheckpoint: 3,
      finalizedRevision: 4,
      stateDigestPreservedBeforeMutation:
        afterRestartBeforeMutation.state_digest === beforeRestart.state_digest
    };
    report.hmac = {
      sameSecretRestart: "accepted",
      differentSecretRestart: rejected.status,
      differentSecretCode: rejected.payload.error.code,
      expiredToken: alteredStatuses.expired,
      otherSeasonToken: alteredStatuses.season,
      otherRulesetToken: alteredStatuses.ruleset,
      noncanonicalToken: alteredStatuses.noncanonical,
      compactBase64UrlToken: /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(
        tokenBeforeWrongSecretRestart
      )
    };
    activeSecret = persistentSecret;
  });

  test("HTTP retries after discarded responses replay start, checkpoint, event, and finalize", {
    timeout: 90_000
  }, async () => {
    const startRequest = startBody({ playerName: "NetworkLoss" });
    const startKey = uniqueKey("loss-start");
    assert.equal(
      await discardHttpResponse("POST", "/api/v3/runs/start", startRequest, startKey),
      201
    );
    const startRetry = await httpRequest("POST", "/api/v3/runs/start", startRequest, {
      idempotencyKey: startKey
    });
    assertJsonResponse(startRetry, 201);
    assert.equal(startRetry.headers["x-idempotent-replay"], "1");

    const checkpointRequest = await checkpointBody(startRetry.payload);
    const checkpointKey = uniqueKey("loss-checkpoint");
    assert.equal(
      await discardHttpResponse(
        "POST",
        "/api/v3/runs/checkpoint",
        checkpointRequest,
        checkpointKey
      ),
      200
    );
    const checkpointRetry = await httpRequest(
      "POST",
      "/api/v3/runs/checkpoint",
      checkpointRequest,
      { idempotencyKey: checkpointKey }
    );
    assertJsonResponse(checkpointRetry, 200);
    assert.equal(checkpointRetry.headers["x-idempotent-replay"], "1");
    let stored = await runRow(startRetry.payload.runId);
    assert.equal(Number(stored.revision), 1);
    assert.equal(Number(stored.gold), 10);

    const eventRequest = eventBody(checkpointRetry.payload, "life_lost");
    const eventKey = uniqueKey("loss-event");
    assert.equal(
      await discardHttpResponse("POST", "/api/v3/runs/event", eventRequest, eventKey),
      200
    );
    const eventRetry = await httpRequest("POST", "/api/v3/runs/event", eventRequest, {
      idempotencyKey: eventKey
    });
    assertJsonResponse(eventRetry, 200);
    assert.equal(eventRetry.headers["x-idempotent-replay"], "1");

    const finalizeRequest = finalizeBody(eventRetry.payload);
    const finalizeKey = uniqueKey("loss-finalize");
    assert.equal(
      await discardHttpResponse(
        "POST",
        "/api/v3/runs/finalize",
        finalizeRequest,
        finalizeKey
      ),
      200
    );
    const finalizeRetry = await httpRequest(
      "POST",
      "/api/v3/runs/finalize",
      finalizeRequest,
      { idempotencyKey: finalizeKey }
    );
    assertJsonResponse(finalizeRetry, 200);
    assert.equal(finalizeRetry.headers["x-idempotent-replay"], "1");
    stored = await runRow(startRetry.payload.runId);
    assert.equal(stored.status, "finalized");
    assert.equal(await leaderboardCount(startRetry.payload.runId), 1);
    report.networkLoss = {
      start: "exact replay",
      checkpoint: "exact replay",
      event: "exact replay",
      finalize: "exact replay",
      finalRevision: Number(stored.revision),
      duplicateLeaderboardRows: 0
    };
  });

  test("leaderboard cursor, tie order, season filter, and build details are stable", {
    timeout: 120_000
  }, async () => {
    const countRows = await d1Query(`
      SELECT COUNT(*) AS count
      FROM leaderboard_entries
      WHERE season = ${sqlText(FIXTURE_SEASON)}
    `);
    const needed = Math.max(0, 22 - Number(countRows[0].count));
    for (let index = 0; index < needed; index += 1) {
      const started = await startRun({
        body: startBody({ playerName: `Cursor${String(index).padStart(2, "0")}` })
      });
      await finalizeRunHttp(started.payload);
    }

    const expected = await d1Query(`
      SELECT run_id, score, created_at
      FROM leaderboard_entries
      WHERE season = ${sqlText(FIXTURE_SEASON)}
      ORDER BY score DESC, created_at ASC, run_id ASC
      LIMIT 6
    `);
    const first = await httpRequest(
      "GET",
      `/api/v3/leaderboard?season=${FIXTURE_SEASON}&limit=3`
    );
    assertJsonResponse(first, 200);
    assert.equal(first.payload.entries.length, 3);
    assert(first.payload.cursor);
    const second = await httpRequest(
      "GET",
      `/api/v3/leaderboard?season=${FIXTURE_SEASON}&limit=3&cursor=${encodeURIComponent(first.payload.cursor)}`
    );
    assertJsonResponse(second, 200);
    assert.equal(second.payload.entries.length, 3);
    const pagedRunIds = [
      ...first.payload.entries,
      ...second.payload.entries
    ].map((entry) => entry.runId);
    assert.deepEqual(pagedRunIds, expected.map((entry) => entry.run_id));
    assert.equal(new Set(pagedRunIds).size, 6);

    const detailRunId = first.payload.entries[0].runId;
    const detail = await httpRequest("GET", `/api/v3/leaderboard/${detailRunId}`);
    assertJsonResponse(detail, 200);
    assert(detail.payload.entry.build);
    assert.equal(detail.text.includes("canonical_state_json"), false);
    assert.equal(detail.text.includes("checkpointToken"), false);

    const missing = await httpRequest("GET", "/api/v3/leaderboard/run_aaaaaaaa");
    assertJsonResponse(missing, 404);
    assert.equal(missing.payload.error.code, "LEADERBOARD_ENTRY_NOT_FOUND");

    const otherSeason = await httpRequest(
      "GET",
      `/api/v3/leaderboard?season=${OTHER_SEASON}&limit=20`
    );
    assertJsonResponse(otherSeason, 200);
    assert.deepEqual(otherSeason.payload.entries, []);
    report.leaderboard = {
      firstPage: 3,
      secondPage: 3,
      stableCursorOrder: true,
      duplicateRunIds: 0,
      detailBuild: true,
      canonicalStateExposed: false,
      missingRunStatus: 404,
      otherSeasonEntries: 0
    };
  });

  test("real payload and persisted-record sizes stay bounded", {
    timeout: 150_000
  }, async () => {
    const body = startBody({ playerName: "BudgetRun" });
    const started = await startRun({ body });
    const startRequestBytes = jsonBytes(body);
    const tokenBytes = encoder.encode(started.payload.checkpointToken).byteLength;
    let session = started.payload;
    let checkpointRequestBytes = 0;
    for (let index = 0; index < 24; index += 1) {
      const requestBody = await checkpointBody(session);
      if (index === 0) checkpointRequestBytes = jsonBytes(requestBody);
      const checkpointed = await checkpointRun(session, {
        body: requestBody,
        key: uniqueKey(`budget-checkpoint-${index}`)
      });
      session = checkpointed.payload;
    }

    const eventRequest = eventBody(session, "life_lost");
    const finalizeRequest = finalizeBody(session);
    const record = (await d1Query(`
      SELECT
        length(canonical_state_json) AS canonical_bytes,
        length(recent_ops_json) AS recent_ops_bytes,
        json_array_length(recent_ops_json) AS recent_ops_count
      FROM ranked_runs
      WHERE run_id = ${sqlText(started.payload.runId)}
    `))[0];
    assert.equal(Number(record.recent_ops_count), 24);
    assert(Number(record.recent_ops_bytes) < 64 * 1024);
    assert.equal(
      JSON.stringify(await checkpointBody(session)).includes("fullSave"),
      false
    );

    const leaderboard20 = await httpRequest(
      "GET",
      `/api/v3/leaderboard?season=${FIXTURE_SEASON}&limit=20`
    );
    assertJsonResponse(leaderboard20, 200);
    assert.equal(leaderboard20.payload.entries.length, 20);
    const detail = await httpRequest(
      "GET",
      `/api/v3/leaderboard/${leaderboard20.payload.entries[0].runId}`
    );
    assertJsonResponse(detail, 200);
    const buildRow = (await d1Query(`
      SELECT length(build_json) AS build_bytes
      FROM leaderboard_entries
      WHERE run_id = ${sqlText(leaderboard20.payload.entries[0].runId)}
    `))[0];
    const tables = await d1Query(`
      SELECT name
      FROM sqlite_schema
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
    `);
    assert.equal(tables.some((entry) => /command|event|frame/iu.test(entry.name)), false);
    const canonical = JSON.parse((await runRow(started.payload.runId)).canonical_state_json);
    assert.equal("commands" in canonical, false);
    assert.equal("combatReplay" in canonical, false);

    report.sizes = {
      startRequestBytes,
      checkpointRequestBytes,
      eventRequestBytes: jsonBytes(eventRequest),
      finalizeRequestBytes: jsonBytes(finalizeRequest),
      tokenBytes,
      canonicalStateBytes: Number(record.canonical_bytes),
      recentOpsBytesAt24: Number(record.recent_ops_bytes),
      recentOpsCount: Number(record.recent_ops_count),
      leaderboard20ResponseBytes: leaderboard20.responseBytes,
      buildDetailResponseBytes: detail.responseBytes,
      buildJsonBytes: Number(buildRow.build_bytes)
    };
  });
});
