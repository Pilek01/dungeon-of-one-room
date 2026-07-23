import { createWorker } from "../../src/index.js";
import { canonicalDigest } from "../../src/security/digests.js";
import { fixtureRuleset, FIXTURE_RULESET_HASH } from "./fixture-ruleset.js";
import { createMemoryRepositories } from "./memory-repositories.js";

export const TEST_SECRET = "fixture-only-secret-32-bytes-minimum-not-production";
export const TEST_SEASON = "fixture-season";

export function createHarness(options = {}) {
  const repositories = options.repositories || createMemoryRepositories();
  let now = options.now || 1_800_000_000_000;
  let sequence = 1;
  const randomUUID = () => {
    const suffix = String(sequence).padStart(12, "0");
    sequence += 1;
    return `00000000-0000-4000-8000-${suffix}`;
  };
  const worker = createWorker({
    ruleset: options.ruleset === undefined ? fixtureRuleset : options.ruleset,
    repositories,
    now: () => now,
    randomUUID
  });
  const env = {
    RANKED_V3_HMAC_SECRET: options.secret === undefined ? TEST_SECRET : options.secret
  };

  async function call(method, path, body = undefined, requestOptions = {}) {
    const headers = new Headers(requestOptions.headers || {});
    if (body !== undefined) headers.set("content-type", "application/json");
    if (requestOptions.idempotencyKey) {
      headers.set("Idempotency-Key", requestOptions.idempotencyKey);
    }
    const request = new Request(`https://fixture.invalid${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const response = await worker.fetch(request, env);
    const payload = await response.json();
    return { response, payload };
  }

  async function start(overrides = {}, idempotencyKey = "start-fixture-0001") {
    return call("POST", "/api/v3/runs/start", {
      playerName: "FixturePlayer",
      season: TEST_SEASON,
      gameVersion: "v0.8.0",
      rulesetHash: FIXTURE_RULESET_HASH,
      clientInstallIdHash: "install_hash_fixture_1234567890",
      ...overrides
    }, { idempotencyKey });
  }

  async function checkpoint(session, overrides = {}, idempotencyKey = "checkpoint-fixture-0001") {
    const commands = overrides.commands || [
      { code: "move", count: 4 },
      { code: "attack", count: 2 }
    ];
    const commandJournalDigest = overrides.commandJournalDigest ||
      await canonicalDigest(commands);
    const meta = session.metaState;
    return call("POST", "/api/v3/runs/checkpoint", {
      runId: session.runId,
      checkpointToken: session.checkpointToken,
      roomDirectiveId: meta.roomDirective.id,
      roomNonce: meta.roomDirective.roomNonce,
      roomResult: "cleared",
      turnCount: 6,
      elapsedMs: 12_000,
      commandJournalDigest,
      compactRoomProof: {
        roomDirectiveId: meta.roomDirective.id,
        roomNonce: meta.roomDirective.roomNonce,
        commands
      },
      clientSummary: {},
      ...overrides,
      commands: undefined
    }, { idempotencyKey });
  }

  async function event(session, type, payload = {}, idempotencyKey = "event-fixture-0001", overrides = {}) {
    const meta = session.metaState;
    return call("POST", "/api/v3/runs/event", {
      runId: session.runId,
      checkpointToken: session.checkpointToken,
      roomDirectiveId: meta.roomDirective.id,
      roomNonce: meta.roomDirective.roomNonce,
      type,
      payload,
      ...overrides
    }, { idempotencyKey });
  }

  async function finalize(session, outcome = "defeat", idempotencyKey = "finalize-fixture-0001", overrides = {}) {
    const meta = session.metaState;
    return call("POST", "/api/v3/runs/finalize", {
      runId: session.runId,
      checkpointToken: session.checkpointToken,
      roomDirectiveId: meta.roomDirective.id,
      roomNonce: meta.roomDirective.roomNonce,
      outcome,
      ...overrides
    }, { idempotencyKey });
  }

  return {
    worker,
    env,
    repositories,
    call,
    start,
    checkpoint,
    event,
    finalize,
    advanceTime(milliseconds) {
      now += milliseconds;
    },
    now() {
      return now;
    }
  };
}
