import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import { V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR } from "../src/rulesets/releases.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";

const PRODUCTION_HASH = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash;

function createHarness() {
  const repositories = createMemoryRepositories();
  let sequence = 1;
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "production",
    repositories,
    now: () => 1_991_000_000_000,
    randomUUID() {
      const suffix = String(sequence).padStart(12, "0");
      sequence += 1;
      return `00000000-0000-4000-8000-${suffix}`;
    }
  });
  const env = {
    RANKED_V3_HMAC_SECRET: TEST_SECRET,
    RANKED_V3_ABUSE_CONTROL: { async limit() { return { success: true }; } }
  };

  async function call(path, body, key) {
    const response = await worker.fetch(new Request(`https://recovery.invalid${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": key
      },
      body: JSON.stringify(body)
    }), env);
    return { response, payload: await response.json() };
  }

  async function startSelect(prefix) {
    const recoveryCredential = "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr";
    const start = await call("/api/v3/runs/start", {
      playerName: "Recovery",
      season: "compat-season",
      gameVersion: "0.8.2",
      rulesetId: V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.rulesetId,
      rulesetHash: PRODUCTION_HASH,
      clientInstallIdHash: "install_0123456789abcdef",
      profileId: "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
      recoveryCredential,
      clientProtocolVersion: "ranked-v3-checkpoint-1"
    }, `${prefix}-start`);
    assert.equal(start.response.status, 201, JSON.stringify(start.payload));
    const select = await call("/api/v3/runs/event", {
      runId: start.payload.runId,
      type: "select_starting_relic",
      bootstrapToken: start.payload.bootstrapToken,
      offerId: start.payload.metaState.startingRelicOffer.offerId,
      choiceId: start.payload.metaState.startingRelicOffer.publicChoices[0].choiceId
    }, `${prefix}-select`);
    assert.equal(select.response.status, 200, JSON.stringify(select.payload));
    return { recoveryCredential, session: select.payload };
  }

  function fatalBody(session, payload) {
    const directive = session.metaState.currentRoomDirective;
    return {
      runId: session.runId,
      type: "report_fatal_event",
      checkpointToken: session.checkpointToken,
      roomDirectiveId: directive.directiveId,
      roomNonce: directive.roomNonce,
      payload
    };
  }

  return { repositories, call, startSelect, fatalBody };
}

test("an identical cause-bearing retry replays while a changed raw payload conflicts", async () => {
  const harness = createHarness();
  const started = await harness.startSelect("replay");
  const key = "replay-fatal";
  const body = harness.fatalBody(started.session, {
    classification: "local_fatal_event",
    presentationCause: "Defeated by The Hollow Seraph"
  });
  const first = await harness.call("/api/v3/runs/event", body, key);
  assert.equal(first.response.status, 200, JSON.stringify(first.payload));
  const replay = await harness.call("/api/v3/runs/event", body, key);
  assert.equal(replay.response.status, 200, JSON.stringify(replay.payload));
  assert.equal(replay.response.headers.get("x-idempotent-replay"), "1");
  assert.deepEqual(replay.payload, first.payload);
  const conflict = await harness.call("/api/v3/runs/event", {
    ...body,
    payload: { classification: "local_fatal_event" }
  }, key);
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.payload.error.code, "IDEMPOTENCY_KEY_REUSED");
  assert.equal(harness.repositories.snapshotRun(started.session.runId).revision, first.payload.revision);
});

test("a preexisting bc0d cause-bearing history resumes without rewriting stored history", async () => {
  const harness = createHarness();
  const started = await harness.startSelect("persisted");
  const stored = harness.repositories.snapshotRun(started.session.runId);
  stored.lifeLedger.history.push({
    fatalEvent: 1,
    resolution: "life_lost",
    livesBefore: 5,
    livesAfter: 4,
    lostRelicId: null,
    elixirUsage: null,
    presentationCause: "Historical f67 cause"
  });
  const existing = harness.repositories.runs;
  const injected = {
    ...harness.repositories,
    runs: {
      ...existing,
      async get(runId) {
        if (runId === stored.runId) return structuredClone(stored);
        return existing.get(runId);
      },
      async getRecovery(runId) {
        const recovery = await existing.getRecovery(runId);
        if (runId !== stored.runId || !recovery) return recovery;
        return { ...recovery, state: structuredClone(stored) };
      }
    }
  };
  let sequence = 100;
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "production",
    repositories: injected,
    now: () => 1_991_000_000_000,
    randomUUID() {
      sequence += 1;
      return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
    }
  });
  const response = await worker.fetch(new Request("https://recovery.invalid/api/v3/runs/resume", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": "op_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    body: JSON.stringify({
      operationId: "op_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      runId: started.session.runId,
      recoveryCredential: started.recoveryCredential,
      clientProtocolVersion: "ranked-v3-checkpoint-1",
      lastKnownRevision: stored.revision
    })
  }), {
    RANKED_V3_HMAC_SECRET: TEST_SECRET,
    RANKED_V3_ABUSE_CONTROL: { async limit() { return { success: true }; } }
  });
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload.metaState.rulesetHash, PRODUCTION_HASH);
  const recoveredAfterResume = await injected.runs.getRecovery(started.session.runId);
  assert.equal(
    recoveredAfterResume.state.lifeLedger.history.at(-1).presentationCause,
    "Historical f67 cause"
  );
  assert.equal(stored.lifeLedger.history.at(-1).presentationCause, "Historical f67 cause");
});
