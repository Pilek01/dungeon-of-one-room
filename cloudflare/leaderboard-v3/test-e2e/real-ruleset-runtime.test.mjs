import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
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
const PROTOCOL_VERSION = "ranked-v3-checkpoint-1";

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

function deterministicCredential(label) {
  return createHash("sha256").update(label).digest("base64url");
}

function startBody(key, overrides = {}) {
  const identity = createHash("sha256").update(`profile:${key}`).digest("hex");
  return {
    playerName: "WranglerReal",
    season: SEASON,
    gameVersion: "0.8.1",
    rulesetId: RULESET_ID,
    rulesetHash: RULESET_HASH,
    clientProtocolVersion: PROTOCOL_VERSION,
    clientInstallIdHash: `install_${identity.slice(0, 24)}`,
    profileId: `profile_${identity.slice(0, 32)}`,
    profileCredential: deterministicCredential(`profile-credential:${key}`),
    recoveryCredential: deterministicCredential(`recovery-credential:${key}`),
    ...overrides
  };
}

async function startRun(key = `start-${randomUUID()}`, overrides = {}) {
  const body = startBody(key, overrides);
  return {
    ...await request("/api/v3/runs/start", body, key),
    requestBody: body
  };
}

function selectionBody(started, choiceIndex = 0, overrides = {}) {
  return {
    runId: started.runId,
    type: "select_starting_relic",
    bootstrapToken: started.bootstrapToken,
    offerId: started.metaState.startingRelicOffer.offerId,
    choiceId:
      started.metaState.startingRelicOffer.publicChoices[choiceIndex].choiceId,
    clientProtocolVersion: PROTOCOL_VERSION,
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
    },
    clientProtocolVersion: PROTOCOL_VERSION
  }, key);
}

async function event(active, type, payload, key) {
  const directive = active.metaState.currentRoomDirective;
  return request("/api/v3/runs/event", {
    runId: active.runId,
    checkpointToken: active.checkpointToken,
    roomDirectiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
    type,
    payload,
    clientProtocolVersion: PROTOCOL_VERSION
  }, key);
}

async function finalizeTerminal(terminal, key, overrides = {}) {
  return request("/api/v3/runs/finalize", {
    runId: terminal.runId,
    checkpointToken: terminal.checkpointToken,
    clientProtocolVersion: PROTOCOL_VERSION,
    ...overrides
  }, key);
}

async function reachDefeat(prefix) {
  const started = (await startRun(`${prefix}-start`)).payload;
  let session = (
    await selectStarting(started, `${prefix}-select`)
  ).payload;
  for (let index = 0; index < 8 && session.metaState.status === "active"; index += 1) {
    const result = await event(
      session,
      "report_fatal_event",
      { classification: "local_fatal_event" },
      `${prefix}-fatal-${index}`
    );
    assert.equal(result.response.status, 200);
    session = result.payload;
  }
  assert.equal(session.metaState.status, "defeat");
  assert.equal(session.metaState.lives, 0);
  return session;
}

async function getJson(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  return { response, payload: await response.json() };
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

  test("authenticated recovery survives Worker restart and raw credential never reaches D1", async () => {
    const key = `recovery-start-${randomUUID()}`;
    const startedResult = await startRun(key);
    assert.equal(startedResult.response.status, 201);
    await startRuntime();
    const operationId = "op_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const resumed = await request("/api/v3/runs/resume", {
      operationId,
      runId: startedResult.payload.runId,
      recoveryCredential: startedResult.requestBody.recoveryCredential,
      clientProtocolVersion: PROTOCOL_VERSION,
      lastKnownRevision: 0
    }, operationId);
    assert.equal(resumed.response.status, 200);
    assert.equal(resumed.payload.metaState.status, "awaiting_starting_relic");
    assert.equal(typeof resumed.payload.bootstrapToken, "string");

    const rows = await d1Query(`
      SELECT recovery_verifier, recent_ops_json, canonical_state_json
      FROM ranked_runs WHERE run_id = '${startedResult.payload.runId}'
    `);
    assert.equal(rows.length, 1);
    assert.equal(JSON.stringify(rows).includes(startedResult.requestBody.recoveryCredential), false);
    assert.notEqual(rows[0].recovery_verifier, startedResult.requestBody.recoveryCredential);

    const wrongOperationId = "op_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const wrong = await request("/api/v3/runs/resume", {
      operationId: wrongOperationId,
      runId: startedResult.payload.runId,
      recoveryCredential: deterministicCredential("wrong-run-credential"),
      clientProtocolVersion: PROTOCOL_VERSION,
      lastKnownRevision: 0
    }, wrongOperationId);
    assert.equal(wrong.response.status, 401);
    assert.equal(wrong.payload.error.code, "RECOVERY_UNAUTHORIZED");
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

  test("nonterminal finalize rejects a room token and creates no leaderboard entry", async () => {
    const started = (await startRun()).payload;
    const selected = (
      await selectStarting(started, `finalize-select-${randomUUID()}`)
    ).payload;
    const result = await request("/api/v3/runs/finalize", {
      runId: selected.runId,
      checkpointToken: selected.checkpointToken
    }, `finalize-${randomUUID()}`);
    assert.equal(result.response.status, 401);
    assert.equal(result.payload.error.code, "TOKEN_INVALID");
    const rows = await d1Query(`
      SELECT status, revision FROM ranked_runs WHERE run_id = '${selected.runId}'
    `);
    assert.deepEqual(rows, [{ status: "active", revision: 1 }]);
    const leaderboard = await d1Query(`
      SELECT COUNT(*) AS count FROM leaderboard_entries WHERE run_id = '${selected.runId}'
    `);
    assert.deepEqual(leaderboard, [{ count: 0 }]);
  }, { timeout: 30_000 });

  test("canonical defeat finalizes once and exact retry survives Worker restart", async () => {
    const terminal = await reachDefeat(`defeat-${randomUUID()}`);
    const key = `defeat-final-${randomUUID()}`;
    const first = await finalizeTerminal(terminal, key);
    assert.equal(first.response.status, 200);
    assert.equal(first.payload.outcome, "defeat");
    assert.equal(first.payload.metaState.status, "finalized");
    assert.equal(first.payload.metaState.lives, 0);
    assert.equal(first.payload.scoreVersion, "v08-score-1");
    assert.equal(first.payload.durationPolicyVersion, "server-wall-clock-v1");
    await startRuntime();
    const retry = await finalizeTerminal(terminal, key);
    assert.equal(retry.response.status, 200);
    assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
    assert.deepEqual(retry.payload, first.payload);
    const rows = await d1Query(`
      SELECT status, outcome, revision FROM ranked_runs
      WHERE run_id = '${terminal.runId}'
    `);
    assert.deepEqual(rows, [{
      status: "finalized",
      outcome: "defeat",
      revision: first.payload.revision
    }]);
    const entries = await d1Query(`
      SELECT score, depth, gold, duration_ms, outcome, summary_json
      FROM leaderboard_entries
      WHERE run_id = '${terminal.runId}'
    `);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].outcome, "defeat");
    assert.equal(entries[0].score, first.payload.score);
    assert.equal(
      JSON.parse(entries[0].summary_json).scoreVersion,
      "v08-score-1"
    );
  }, { timeout: 60_000 });

  test("normal extraction requires a clear and finalizes from canonical state", async () => {
    const started = (await startRun(`extract-start-${randomUUID()}`)).payload;
    let session = (
      await selectStarting(started, `extract-select-${randomUUID()}`)
    ).payload;
    const premature = await event(
      session,
      "request_extraction",
      { mode: "normal" },
      `extract-premature-${randomUUID()}`
    );
    assert.equal(premature.response.status, 422);
    assert.equal(
      premature.payload.error.code,
      "NORMAL_EXTRACTION_REQUIRES_ACCEPTED_ROOM_CLEAR"
    );
    session = (
      await checkpoint(session, `extract-checkpoint-${randomUUID()}`)
    ).payload;
    const extracted = await event(
      session,
      "request_extraction",
      { mode: "normal" },
      `extract-valid-${randomUUID()}`
    );
    assert.equal(extracted.response.status, 200);
    assert.equal(extracted.payload.metaState.status, "extraction");
    const fake = await finalizeTerminal(
      extracted.payload,
      `extract-fake-${randomUUID()}`,
      { outcome: "victory", score: 999999, lives: 5 }
    );
    assert.equal(fake.response.status, 400);
    assert.equal(fake.payload.error.code, "FINALIZE_REQUEST_FIELDS_INVALID");
    const finalized = await finalizeTerminal(
      extracted.payload,
      `extract-final-${randomUUID()}`
    );
    assert.equal(finalized.response.status, 200);
    assert.equal(finalized.payload.outcome, "extract");
    assert.equal(finalized.payload.summary.score, finalized.payload.score);
    const extractEntries = await d1Query(`
      SELECT score, outcome, snapshot_kind FROM leaderboard_entries
      WHERE run_id = '${session.runId}'
    `);
    assert.deepEqual(extractEntries, [{
      score: finalized.payload.score,
      outcome: "extract",
      snapshot_kind: "extract"
    }]);
  }, { timeout: 45_000 });

  test("extraction profile persists through restart and opens canonical Camp in real D1", async () => {
    const key = `camp-start-${randomUUID()}`;
    const startedResult = await startRun(key);
    let session = (
      await selectStarting(startedResult.payload, `camp-select-${randomUUID()}`)
    ).payload;
    session = (await event(
      session,
      "request_extraction",
      { mode: "emergency" },
      `camp-extract-${randomUUID()}`
    )).payload;
    assert.equal(session.metaState.status, "extraction");
    const finalized = await finalizeTerminal(session, `camp-finalize-${randomUUID()}`);
    assert.equal(finalized.response.status, 200);
    await startRuntime();

    const opened = await request("/api/v3/profiles/camp", {
      profileId: startedResult.requestBody.profileId,
      profileCredential: startedResult.requestBody.profileCredential,
      rulesetId: RULESET_ID,
      rulesetHash: RULESET_HASH,
      clientProtocolVersion: PROTOCOL_VERSION,
      action: "open"
    }, `camp-open-${randomUUID()}`);
    assert.equal(opened.response.status, 200);
    assert.equal(opened.payload.profile.profileId, startedResult.requestBody.profileId);
    assert.equal(opened.payload.profile.campSession.active, true);

    const profiles = await d1Query(`
      SELECT canonical_profile_json FROM ranked_profiles
      WHERE profile_id = '${startedResult.requestBody.profileId}'
    `);
    assert.equal(profiles.length, 1);
    const profile = JSON.parse(profiles[0].canonical_profile_json);
    assert.equal(profile.lastExtractedRunId, session.runId);
    assert.equal(profile.campSession.active, true);
  }, { timeout: 60_000 });
  test("accepted depth-100 final room is the only victory path", async () => {
    const started = (await startRun(`victory-start-${randomUUID()}`)).payload;
    let session = (
      await selectStarting(started, `victory-select-${randomUUID()}`)
    ).payload;
    for (let index = 0; index < 100 && session.metaState.status === "active"; index += 1) {
      const result = await checkpoint(
        session,
        `victory-checkpoint-${index}-${randomUUID()}`
      );
      assert.equal(
        result.response.status,
        200,
        result.payload?.error?.code || `checkpoint-${index}`
      );
      session = result.payload;
    }
    assert.equal(session.metaState.status, "victory");
    assert.equal(session.metaState.maxDepth, 100);
    assert.equal(session.metaState.statistics.finalRoomsCompleted, 1);
    const finalized = await finalizeTerminal(
      session,
      `victory-final-${randomUUID()}`
    );
    assert.equal(finalized.response.status, 200);
    assert.equal(finalized.payload.outcome, "victory");
    assert.equal(
      finalized.payload.score,
      100 * 1000 +
        finalized.payload.summary.goldEarned * 2 +
        Math.floor(100 / 5) * 2500
    );
    const detail = await getJson(`/api/v3/leaderboard/${session.runId}`);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.payload.entry.outcome, "victory");
    assert.equal(detail.payload.entry.summary.finalRoomsCompleted, 1);
    assert.equal(detail.payload.entry.summary.scoreVersion, "v08-score-1");
  }, { timeout: 120_000 });

  test("concurrent finalizers publish at most one result and finalized run is immutable", async () => {
    const terminal = await reachDefeat(`concurrent-${randomUUID()}`);
    const [left, right] = await Promise.all([
      finalizeTerminal(terminal, `concurrent-left-${randomUUID()}`),
      finalizeTerminal(terminal, `concurrent-right-${randomUUID()}`)
    ]);
    assert.equal(
      [left, right].filter((result) => result.response.status === 200).length,
      1
    );
    assert.equal(await d1Query(`
      SELECT COUNT(*) AS count FROM leaderboard_entries
      WHERE run_id = '${terminal.runId}'
    `).then((rows) => Number(rows[0].count)), 1);
    const postEvent = await request("/api/v3/runs/event", {
      runId: terminal.runId,
      checkpointToken: terminal.checkpointToken,
      roomDirectiveId: "directive_post_final",
      roomNonce: "nonce_post_final",
      type: "report_fatal_event",
      payload: { classification: "local_fatal_event" }
    }, `post-final-event-${randomUUID()}`);
    assert.notEqual(postEvent.response.status, 200);
    const postFinalize = await finalizeTerminal(
      terminal,
      `post-finalize-${randomUUID()}`
    );
    assert.equal(postFinalize.response.status, 409);
    assert.equal(postFinalize.payload.error.code, "REVISION_CONFLICT");
  }, { timeout: 60_000 });

  test("real leaderboard cursor and detail match frozen canonical results", async () => {
    const first = await getJson(
      `/api/v3/leaderboard?season=${SEASON}&limit=2`
    );
    assert.equal(first.response.status, 200);
    assert.equal(first.payload.entries.length, 2);
    assert(first.payload.cursor);
    const second = await getJson(
      `/api/v3/leaderboard?season=${SEASON}&limit=2&cursor=${
        encodeURIComponent(first.payload.cursor)
      }`
    );
    assert.equal(second.response.status, 200);
    const combined = [...first.payload.entries, ...second.payload.entries];
    assert.equal(new Set(combined.map((entry) => entry.runId)).size, combined.length);
    for (const entry of combined) {
      assert.equal("build" in entry, false);
      assert.equal("summary" in entry, false);
    }
    const detail = await getJson(
      `/api/v3/leaderboard/${first.payload.entries[0].runId}`
    );
    assert.equal(detail.response.status, 200);
    assert(detail.payload.entry.build.buildDigest);
    assert.equal(detail.payload.entry.summary.score, detail.payload.entry.score);
    assert.equal("clientInstallIdHash" in detail.payload.entry, false);
  }, { timeout: 30_000 });
});
