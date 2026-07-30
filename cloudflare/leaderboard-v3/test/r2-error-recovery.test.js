import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { createWorker } from "../src/index.js";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import { V08_META_1_LOCAL_RELEASE_DESCRIPTOR } from "../src/rulesets/releases.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const require = createRequire(import.meta.url);
const clientApi = require("../../../online-v3/ranked-v3-client.js");
const protocol = require("../../../online-v3/ranked-v3-protocol.js");
const sessionApi = require("../../../online-v3/ranked-v3-session.js");

function recoveryStore() {
  let session = { runId: "run_a1", revision: 0 };
  let recovery = {
    runId: "run_a1",
    recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"
  };
  let profile = {
    profileId: "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp"
  };
  return {
    loadSession: () => structuredClone(session),
    saveSession: (value) => { session = structuredClone(value); },
    clearSession: () => { session = null; },
    loadRecovery: () => structuredClone(recovery),
    saveRecovery: (value) => { recovery = structuredClone(value); },
    clearRecovery: () => { recovery = null; },
    loadProfile: () => structuredClone(profile),
    saveProfile: (value) => { profile = structuredClone(value); },
    clearProfile: () => { profile = null; },
    snapshot: () => ({ session, recovery, profile })
  };
}

test("canonical abandon is authenticated, exactly retryable and never publishes", async () => {
  const repositories = createMemoryRepositories();
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_LOCAL_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "local",
    repositories,
    now: () => 1_920_000_000_000,
    randomUUID: () => "00000000-0000-4000-8000-000000000001"
  });
  const env = { RANKED_V3_HMAC_SECRET: TEST_SECRET };
  const credential = "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr";

  async function post(path, body, operationId) {
    const response = await worker.fetch(new Request(`https://abandon.invalid${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": operationId
      },
      body: JSON.stringify(body)
    }), env);
    return { response, payload: await response.json() };
  }

  const started = (await post("/api/v3/runs/start", {
    playerName: "Abandon",
    season: "r2-local",
    gameVersion: "0.8.1",
    rulesetId: "v08-meta-1",
    rulesetHash: manifest.rulesetHash,
    clientInstallIdHash: "install_abandon_123456",
    profileId: "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
    recoveryCredential: credential
  }, "abandon-start")).payload;
  const operationId = "op_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const body = {
    operationId,
    runId: started.runId,
    recoveryCredential: credential,
    clientProtocolVersion: "ranked-v3-checkpoint-1",
    lastKnownRevision: 0
  };
  const first = await post("/api/v3/runs/abandon", body, operationId);
  const replay = await post("/api/v3/runs/abandon", body, operationId);
  const recoveryAfterLostAcknowledgement = await post(
    "/api/v3/runs/abandon",
    {
      ...body,
      operationId: "op_dddddddddddddddddddddddddddddddd"
    },
    "op_dddddddddddddddddddddddddddddddd"
  );
  assert.equal(first.response.status, 200);
  assert.equal(first.payload.metaState.status, "abandoned");
  assert.deepEqual(replay.payload, first.payload);
  assert.equal(replay.response.headers.get("x-idempotent-replay"), "1");
  assert.equal(recoveryAfterLostAcknowledgement.response.status, 200);
  assert.equal(recoveryAfterLostAcknowledgement.payload.metaState.status, "abandoned");
  assert.equal(recoveryAfterLostAcknowledgement.payload.revision, first.payload.revision);
  assert.equal(
    recoveryAfterLostAcknowledgement.response.headers.get("x-idempotent-replay"),
    "1"
  );
  assert.equal(repositories.snapshotRun(started.runId).status, "abandoned");
  assert.equal(repositories.leaderboardCount(), 0);

  const resumed = await post(
    "/api/v3/runs/resume",
    { ...body, operationId: "op_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    "op_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  );
  assert.equal(resumed.response.status, 410);
});

test("client clears recovery only after acknowledged abandonment", async () => {
  const store = recoveryStore();
  let resolveRequest;
  const client = clientApi.createRankedClient({
    store,
    transport: {
      createOperationId: () => "op_cccccccccccccccccccccccccccccccc",
      request: () => new Promise((resolve) => { resolveRequest = resolve; })
    }
  });
  const pending = client.abandonCanonical();
  assert.ok(store.snapshot().session);
  assert.ok(store.snapshot().recovery);
  resolveRequest({
    payload: {
      ok: true,
      protocolVersion: protocol.PROTOCOL_VERSION,
      runId: "run_a1",
      revision: 1,
      metaState: {
        runId: "run_a1",
        protocolVersion: protocol.PROTOCOL_VERSION,
        rulesetId: protocol.RULESET_ID,
        rulesetHash: protocol.RULESET_HASH,
        revision: 1,
        status: "abandoned"
      }
    }
  });
  await pending;
  assert.equal(store.snapshot().session, null);
  assert.equal(store.snapshot().recovery, null);
  assert.equal(store.snapshot().profile, null);
});

test("runtime preserves recovery for Practice exit and resyncs canonical state", async () => {
  const runtime = await readFile(new URL(
    "../../../online-v3/ranked-v3-runtime.js",
    import.meta.url
  ), "utf8");
  assert.doesNotMatch(runtime, /const recoveryAtBoot = recoveryStore\.loadSession/u);
  assert.match(runtime, /Main Menu[\s\S]*returnToPractice/u);
  assert.match(runtime, /Abandon Ranked Run[\s\S]*confirmAbandon/u);
  assert.match(runtime, /resumeCanonical\(\)/u);
  assert.match(runtime, /RUN_RECOVERY_UNAVAILABLE[\s\S]*Ranked Run Ended[\s\S]*Start New Ranked Run/u);
  assert.match(runtime, /clearEndedRecovery[\s\S]*clearRecovery\?\.\(\)/u);
  assert.match(runtime, /client\?\.clear\(\)[\s\S]*ABANDONED_LOCAL_SESSION/u);
});
test("runtime exposes explicit Ranked selection and terminal abandonment recovery", async () => {
  const runtime = await readFile(new URL(
    "../../../online-v3/ranked-v3-runtime.js",
    import.meta.url
  ), "utf8");
  assert.match(runtime, /Start New Ranked/u);
  assert.match(runtime, /Continue Ranked/u);
  assert.doesNotMatch(runtime, /openRankedEntry\(\)\.catch/u);
  assert.match(runtime, /Cancel/u);
  assert.match(runtime, /if \(!hasRecovery\)[\s\S]*startRanked/u);
  assert.match(runtime, /prepareFreshRankedStart[\s\S]*clearProfile/u);
  assert.match(runtime, /extractedProfileReady[\s\S]*openCamp/u);
  assert.match(runtime, /if \(resetProfile\)[\s\S]*resetProfileIdentity/u);
  assert.match(runtime, /repairProfile[\s\S]*PROFILE_UNAUTHORIZED/u);
  assert.match(runtime, /discardFailedStart/u);
  assert.match(runtime, /presentStartError/u);
  assert.doesNotMatch(runtime, /Forget Local Ranked Save/u);
  assert.doesNotMatch(runtime, /Forget and Start New/u);
  assert.doesNotMatch(runtime, /Confirm New Ranked/u);
  assert.doesNotMatch(
    runtime,
    /if \(recoveryStore\.loadRecovery\(\)\) await resumeRanked\(\);\s*else await startRanked\(\);/u
  );
  assert.match(runtime, /FINALIZED_RUN_IMMUTABLE[\s\S]*Ranked Run Ended/u);
  assert.match(runtime, /RECOVERY_UNAUTHORIZED[\s\S]*Start New Ranked/u);
  assert.match(runtime, /Main Menu/u);
  assert.match(runtime, /returnToPractice[\s\S]*releaseWriter\?\.\(\)/u);
  assert.match(runtime, /clearEndedRecovery[\s\S]*releaseWriter\?\.\(\)/u);
});
test("Ranked message actions use the compact gothic menu treatment", async () => {
  const style = await readFile(new URL("../../../style.css", import.meta.url), "utf8");
  const ui = await readFile(new URL(
    "../../../online-v3/ranked-v3-ui.js",
    import.meta.url
  ), "utf8");
  assert.match(ui, /ranked-v3-card-menu/u);
  assert.match(style, /\.ranked-v3-card-menu[\s\S]*width:\s*min\(500px/u);
  assert.match(style, /\.ranked-v3-card-menu \.ranked-v3-actions[\s\S]*max-width:\s*360px/u);
  assert.match(style, /\.ranked-v3-button::before[\s\S]*\.ranked-v3-button::after/u);
});
test("Ranked start presents browser storage exhaustion explicitly", async () => {
  const runtime = await readFile(
    new URL("../../../online-v3/ranked-v3-runtime.js", import.meta.url),
    "utf8"
  );
  assert.match(runtime, /code === "RANKED_STORAGE_FULL"/u);
  assert.match(runtime, /Browser storage is full/u);
});

test("cleared-room extraction queues across checkpoint and stays normal", async () => {
  const [runtime, sessionSource, builder] = await Promise.all([
    readFile(new URL("../../../online-v3/ranked-v3-runtime.js", import.meta.url), "utf8"),
    readFile(new URL("../../../online-v3/ranked-v3-session.js", import.meta.url), "utf8"),
    readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8")
  ]);
  const session = sessionApi.createStateMachine(sessionApi.STATES.next);
  assert.doesNotThrow(() => session.transition(sessionApi.STATES.resolving));
  assert.match(runtime, /pendingExtractionMode/u);
  assert.match(runtime, /if \(pendingExtractionMode\)[\s\S]*performExtraction/u);
  assert.match(builder, /forced && !state\.roomCleared \? "emergency" : "normal"/u);
  assert.match(sessionSource, /ENTERING_NEXT_ROOM[^\n]*RESOLVING_ROOM/u);
});

test("fresh Ranked start clears only transient Ranked state and failed-start Main Menu exits Camp", async () => {
  const runtime = await readFile(
    new URL("../../../online-v3/ranked-v3-runtime.js", import.meta.url),
    "utf8"
  );
  assert.match(runtime, /prepareFreshRankedStart/u);
  assert.match(runtime, /clearWriterLease/u);
  assert.match(runtime, /returnFromFailedStartToMainMenu/u);
  assert.match(runtime, /ui\.button\("Main Menu", returnFromFailedStartToMainMenu\)/u);
  assert.doesNotMatch(runtime, /ui\.button\("Main Menu", \(\) => ui\.hide\(\)\)/u);
});
