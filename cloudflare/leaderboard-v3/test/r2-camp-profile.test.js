import test from "node:test";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import { V08_META_1_LOCAL_RELEASE_DESCRIPTOR } from "../src/rulesets/releases.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const require = createRequire(import.meta.url);
const sessionApi = require("../../../online-v3/ranked-v3-session.js");

const PROFILE_ID = "profile_0123456789abcdef0123456789abcdef";
const PROFILE_CREDENTIAL = "ppppppppppppppppppppppppppppppppppppppppppp";

function createHarness() {
  const repositories = createMemoryRepositories();
  let sequence = 1;
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_LOCAL_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "local",
    repositories,
    now: () => 1_900_000_000_000,
    randomUUID() {
      const suffix = String(sequence).padStart(12, "0");
      sequence += 1;
      return `00000000-0000-4000-8000-${suffix}`;
    }
  });
  const env = { RANKED_V3_HMAC_SECRET: TEST_SECRET };

  async function post(path, body, operationId) {
    const response = await worker.fetch(new Request(`https://r2.invalid${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": operationId
      },
      body: JSON.stringify(body)
    }), env);
    return { response, payload: await response.json() };
  }

  function profileBody(extra = {}) {
    return {
      profileId: PROFILE_ID,
      profileCredential: PROFILE_CREDENTIAL,
      rulesetId: "v08-meta-1",
      rulesetHash: manifest.rulesetHash,
      clientProtocolVersion: "ranked-v3-checkpoint-1",
      ...extra
    };
  }

  async function start(operationId) {
    return post("/api/v3/runs/start", {
      playerName: "R2 Camp",
      season: "r2-local",
      gameVersion: "0.8.1",
      rulesetId: "v08-meta-1",
      rulesetHash: manifest.rulesetHash,
      clientInstallIdHash: "install_0123456789abcdef",
      profileId: PROFILE_ID,
      profileCredential: PROFILE_CREDENTIAL,
      recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"
    }, operationId);
  }

  return { post, profileBody, start, repositories };
}

test("ordinary Ranked room cannot open Camp", async () => {
  const harness = createHarness();
  const started = (await harness.start("r2-camp-start-ordinary")).payload;
  const selected = (await harness.post("/api/v3/runs/event", {
    runId: started.runId,
    type: "select_starting_relic",
    bootstrapToken: started.bootstrapToken,
    offerId: started.metaState.startingRelicOffer.offerId,
    choiceId: started.metaState.startingRelicOffer.publicChoices[0].choiceId
  }, "r2-camp-select-ordinary")).payload;
  const directive = selected.metaState.currentRoomDirective;
  const rejected = await harness.post("/api/v3/runs/event", {
    runId: selected.runId,
    type: "begin_camp_session",
    checkpointToken: selected.checkpointToken,
    roomDirectiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
    payload: {}
  }, "r2-camp-illegal-ordinary");
  assert.equal(rejected.response.status, 409);
  assert.equal(rejected.payload.error.code, "CAMP_EXTRACTION_REQUIRED");
});

test("canonical extraction creates an authenticated profile Camp and next run", async () => {
  const harness = createHarness();
  const started = (await harness.start("r2-camp-start-extract")).payload;
  const selected = (await harness.post("/api/v3/runs/event", {
    runId: started.runId,
    type: "select_starting_relic",
    bootstrapToken: started.bootstrapToken,
    offerId: started.metaState.startingRelicOffer.offerId,
    choiceId: started.metaState.startingRelicOffer.publicChoices[0].choiceId
  }, "r2-camp-select-extract")).payload;
  const directive = selected.metaState.currentRoomDirective;
  const extracted = (await harness.post("/api/v3/runs/event", {
    runId: selected.runId,
    type: "request_extraction",
    checkpointToken: selected.checkpointToken,
    roomDirectiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
    payload: { mode: "emergency" }
  }, "r2-camp-extract")).payload;
  assert.equal(extracted.metaState.status, "extraction");
  assert.equal(extracted.profile.profileId, PROFILE_ID);

  const beforeFinalize = await harness.post(
    "/api/v3/profiles/camp",
    harness.profileBody({ action: "open" }),
    "r2-camp-open-too-early"
  );
  assert.equal(beforeFinalize.response.status, 409);
  assert.equal(beforeFinalize.payload.error.code, "CAMP_FINALIZATION_REQUIRED");

  const finalized = await harness.post("/api/v3/runs/finalize", {
    runId: extracted.runId,
    checkpointToken: extracted.checkpointToken
  }, "r2-camp-finalize");
  assert.equal(finalized.response.status, 200);

  const wrongCredential = await harness.post(
    "/api/v3/profiles/camp",
    harness.profileBody({
      profileCredential: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      action: "open"
    }),
    "r2-camp-wrong-credential"
  );
  assert.equal(wrongCredential.response.status, 401);

  const opened = await harness.post(
    "/api/v3/profiles/camp",
    harness.profileBody({ action: "open" }),
    "r2-camp-open"
  );
  assert.equal(opened.response.status, 200);
  assert.equal(opened.payload.profile.profileId, PROFILE_ID);
  assert.equal(opened.payload.profile.campSession.active, true);

  const nextRun = await harness.start("r2-camp-next-run");
  assert.equal(nextRun.response.status, 201);
  assert.equal(nextRun.payload.metaState.profileId, PROFILE_ID);
  assert.equal(nextRun.payload.metaState.status, "active");
  assert.ok(nextRun.payload.metaState.build.relics.length > 0);
  assert.equal(
    harness.repositories.snapshotProfile(PROFILE_ID).state.lastExtractedRunId,
    extracted.runId
  );
});
test("profile-backed start may enter the first room without a new relic bootstrap", () => {
  const session = sessionApi.createStateMachine();
  session.transition(sessionApi.STATES.starting);
  session.transition(sessionApi.STATES.entering);
  session.transition(sessionApi.STATES.active);
  assert.equal(session.getState(), sessionApi.STATES.active);
});