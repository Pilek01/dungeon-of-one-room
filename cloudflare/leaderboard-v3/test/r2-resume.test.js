import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import { V08_META_1_LOCAL_RELEASE_DESCRIPTOR } from "../src/rulesets/releases.js";
import { decodeBoundaryToken } from "../src/security/checkpoint-token.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

function createHarness() {
  const repositories = createMemoryRepositories();
  let now = 1_910_000_000_000;
  let sequence = 1;
  const registry = createRulesetRegistry([V08_META_1_LOCAL_RELEASE_DESCRIPTOR]);
  const options = {
    rulesetRegistry: registry,
    rulesetEnvironment: "local",
    repositories,
    now: () => now,
    randomUUID() {
      const suffix = String(sequence).padStart(12, "0");
      sequence += 1;
      return `00000000-0000-4000-8000-${suffix}`;
    }
  };
  let worker = createWorker(options);
  const env = { RANKED_V3_HMAC_SECRET: TEST_SECRET };

  async function post(path, body, operationId = "op_0123456789abcdef0123456789abcdef") {
    const response = await worker.fetch(new Request(`https://resume.invalid${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": operationId
      },
      body: JSON.stringify(body)
    }), env);
    return { response, payload: await response.json() };
  }

  async function start(suffix) {
    const recoveryCredential = `recovery-${suffix}`.padEnd(43, suffix);
    const result = await post("/api/v3/runs/start", {
      playerName: `Resume ${suffix}`,
      season: "r2-local",
      gameVersion: "0.8.1",
      rulesetId: "v08-meta-1",
      rulesetHash: manifest.rulesetHash,
      clientInstallIdHash: `install_${suffix}_0123456789abcdef`,
      profileId: `profile_${suffix.padStart(32, "0")}`,
      profileCredential: suffix.repeat(43).slice(0, 43),
      recoveryCredential
    }, `start-r2-${suffix}`);
    return { ...result, recoveryCredential };
  }

  function resumeBody(started, operationId, credential = started.recoveryCredential) {
    return {
      operationId,
      runId: started.runId,
      recoveryCredential: credential,
      clientProtocolVersion: "ranked-v3-checkpoint-1",
      lastKnownRevision: started.revision
    };
  }

  return {
    post,
    start,
    resumeBody,
    advance(ms) { now += ms; },
    restart() { worker = createWorker(options); },
    repositories
  };
}

test("resume requires the independent credential and refreshes the correct token", async () => {
  const harness = createHarness();
  const firstResult = await harness.start("a");
  const secondResult = await harness.start("b");
  const first = { ...firstResult.payload, recoveryCredential: firstResult.recoveryCredential };
  const second = { ...secondResult.payload, recoveryCredential: secondResult.recoveryCredential };
  assert.match(first.recoveryCredential, /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(
    JSON.stringify(harness.repositories.snapshotRun(first.runId)).includes(first.recoveryCredential),
    false
  );

  harness.advance(20 * 60 * 1000);
  const operationId = "op_11111111111111111111111111111111";
  const resumed = await harness.post(
    "/api/v3/runs/resume",
    harness.resumeBody(first, operationId),
    operationId
  );
  assert.equal(resumed.response.status, 200);
  assert.equal(resumed.payload.metaState.status, "awaiting_starting_relic");
  assert.ok(resumed.payload.bootstrapToken);
  assert.ok(decodeBoundaryToken(resumed.payload.bootstrapToken).payload.expiresAt > 1_910_000_000_000);

  const wrong = await harness.post(
    "/api/v3/runs/resume",
    harness.resumeBody(first, "op_22222222222222222222222222222222", second.recoveryCredential),
    "op_22222222222222222222222222222222"
  );
  assert.equal(wrong.response.status, 401);
  assert.equal(wrong.payload.error.code, "RECOVERY_UNAUTHORIZED");

  const runIdOnly = await harness.post(
    "/api/v3/runs/resume",
    {
      operationId: "op_33333333333333333333333333333333",
      runId: first.runId,
      clientProtocolVersion: "ranked-v3-checkpoint-1",
      lastKnownRevision: 0
    },
    "op_33333333333333333333333333333333"
  );
  assert.equal(runIdOnly.response.status, 400);
});

test("resume survives Worker restart and returns terminal/finalized projections", async () => {
  const harness = createHarness();
  const startedResult = await harness.start("c");
  const started = { ...startedResult.payload, recoveryCredential: startedResult.recoveryCredential };
  const selected = (await harness.post("/api/v3/runs/event", {
    runId: started.runId,
    type: "select_starting_relic",
    bootstrapToken: started.bootstrapToken,
    offerId: started.metaState.startingRelicOffer.offerId,
    choiceId: started.metaState.startingRelicOffer.publicChoices[0].choiceId
  }, "select-c")).payload;
  const directive = selected.metaState.currentRoomDirective;
  const terminal = (await harness.post("/api/v3/runs/event", {
    runId: selected.runId,
    type: "request_extraction",
    checkpointToken: selected.checkpointToken,
    roomDirectiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
    payload: { mode: "emergency" }
  }, "extract-c")).payload;

  harness.restart();
  const terminalOp = "op_44444444444444444444444444444444";
  const terminalResume = await harness.post(
    "/api/v3/runs/resume",
    harness.resumeBody({
      ...terminal,
      recoveryCredential: started.recoveryCredential
    }, terminalOp),
    terminalOp
  );
  assert.equal(terminalResume.response.status, 200);
  assert.equal(terminalResume.payload.metaState.status, "extraction");
  assert.ok(terminalResume.payload.checkpointToken);

  const finalized = (await harness.post("/api/v3/runs/finalize", {
    runId: terminal.runId,
    checkpointToken: terminalResume.payload.checkpointToken
  }, "finalize-c")).payload;
  assert.equal(finalized.metaState.status, "finalized");

  const finalOp = "op_55555555555555555555555555555555";
  const finalResume = await harness.post(
    "/api/v3/runs/resume",
    harness.resumeBody({
      ...finalized,
      recoveryCredential: started.recoveryCredential
    }, finalOp),
    finalOp
  );
  assert.equal(finalResume.response.status, 200);
  assert.equal(finalResume.payload.metaState.status, "finalized");
  assert.equal(finalResume.payload.leaderboardEntryId, started.runId);
  assert.equal("checkpointToken" in finalResume.payload, false);
  assert.equal("bootstrapToken" in finalResume.payload, false);
});
