import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { stateForDigest } from "../src/domain/run-state.js";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import {
  V08_META_1_BOUNDARY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_HD_BOOT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_INTEGRITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_LEGACY_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_LOCAL_RELEASE_DESCRIPTOR,
  V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_POTION_MERCHANT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_R2_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_SCORE_CARRY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_WARDEN_HOTFIX_RELEASE_DESCRIPTOR
} from "../src/rulesets/releases.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";

const LEGACY_PRODUCTION_RELEASES = Object.freeze([
  V08_META_1_LEGACY_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_R2_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_WARDEN_HOTFIX_RELEASE_DESCRIPTOR,
  V08_META_1_SCORE_CARRY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_HD_BOOT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_BOUNDARY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR
]);
const PRODUCTION_RELEASES = Object.freeze([
  ...LEGACY_PRODUCTION_RELEASES,
  V08_META_1_INTEGRITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_POTION_MERCHANT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR
]);

function createRecoverableRepositories() {
  const base = createMemoryRepositories();
  const elixirRuns = new Set();
  function withHistoricalElixir(state) {
    if (!state || !elixirRuns.has(state.runId)) return state;
    const seeded = structuredClone(state);
    seeded.build.elixirs = [{ elixirId: "fury_1", charges: 3 }];
    return seeded;
  }
  return {
    ...base,
    runs: {
      ...base.runs,
      async get(runId) {
        return withHistoricalElixir(await base.runs.get(runId));
      },
      async getRecovery(runId) {
        const record = await base.runs.getRecovery(runId);
        if (!record) return record;
        return { ...record, state: withHistoricalElixir(record.state) };
      }
    },
    markHistoricalElixir(runId) {
      elixirRuns.add(runId);
    }
  };
}

function createHttpHarness(descriptor, environment = "production") {
  const repositories = createRecoverableRepositories();
  let sequence = 1;
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([descriptor]),
    rulesetEnvironment: environment,
    repositories,
    now: () => 1_990_000_000_000,
    randomUUID() {
      const suffix = String(sequence).padStart(12, "0");
      sequence += 1;
      return `00000000-0000-4000-8000-${suffix}`;
    }
  });
  const env = {
    RANKED_V3_HMAC_SECRET: TEST_SECRET,
    RANKED_V3_ABUSE_CONTROL: {
      async limit() {
        return { success: true };
      }
    }
  };

  async function call(path, body, key) {
    const response = await worker.fetch(new Request(`https://compat.invalid${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": key
      },
      body: JSON.stringify(body)
    }), env);
    return { response, payload: await response.json() };
  }

  async function get(path) {
    const response = await worker.fetch(new Request(`https://compat.invalid${path}`), env);
    return { response, payload: await response.json() };
  }

  async function startSelect(prefix = "compat") {
    const recoveryCredential = "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr";
    const started = await call("/api/v3/runs/start", {
      playerName: "Compat",
      season: "compat-season",
      gameVersion: "0.8.2",
      rulesetId: descriptor.rulesetId,
      rulesetHash: descriptor.rulesetHash,
      clientInstallIdHash: "install_0123456789abcdef",
      profileId: "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
      recoveryCredential,
      clientProtocolVersion: "ranked-v3-checkpoint-1"
    }, `${prefix}-start`);
    assert.equal(started.response.status, 201, JSON.stringify(started.payload));
    const selected = await call("/api/v3/runs/event", {
      runId: started.payload.runId,
      type: "select_starting_relic",
      bootstrapToken: started.payload.bootstrapToken,
      offerId: started.payload.metaState.startingRelicOffer.offerId,
      choiceId: started.payload.metaState.startingRelicOffer.publicChoices[0].choiceId
    }, `${prefix}-select`);
    assert.equal(selected.response.status, 200, JSON.stringify(selected.payload));
    return { recoveryCredential, session: selected.payload };
  }

  async function resume(started, key = "op_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") {
    const result = await call("/api/v3/runs/resume", {
      operationId: key,
      runId: started.session.runId,
      recoveryCredential: started.recoveryCredential,
      clientProtocolVersion: "ranked-v3-checkpoint-1",
      lastKnownRevision: started.session.metaState.revision
    }, key);
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
    return result.payload;
  }

  async function fatal(session, payload, key) {
    const directive = session.metaState.currentRoomDirective;
    return call("/api/v3/runs/event", {
      runId: session.runId,
      type: "report_fatal_event",
      checkpointToken: session.checkpointToken,
      roomDirectiveId: directive.directiveId,
      roomNonce: directive.roomNonce,
      payload
    }, key);
  }

  async function finalize(session, key) {
    return call("/api/v3/runs/finalize", {
      runId: session.runId,
      checkpointToken: session.checkpointToken
    }, key);
  }

  return { repositories, startSelect, resume, fatal, finalize, get };
}

function operationComparableState(repositories, runId) {
  return stateForDigest(repositories.snapshotRun(runId));
}

test("historical production descriptors strip fatal cause while current production retains it", () => {
  for (const descriptor of LEGACY_PRODUCTION_RELEASES) {
    assert.deepEqual(
      descriptor.capabilities,
      { fatalPresentationCauseMode: "strip" },
      descriptor.rulesetHash
    );
    assert.equal(Object.isFrozen(descriptor.capabilities), true, descriptor.rulesetHash);
    assert.equal(
      descriptor.createRuleset().capabilities.fatalPresentationCauseMode,
      "strip",
      descriptor.rulesetHash
    );
  }
  assert.deepEqual(
    V08_META_1_LOCAL_RELEASE_DESCRIPTOR.capabilities,
    {
      fatalPresentationCauseMode: "retain",
      boundarySettlementMode: "event-journal-v1",
      postRoomPactSettlement: "post-room-pact-v1",
      boundedProcClaims: "v1",
      canonicalChestOutcomes: "v1",
      earlyBalanceOtterRepair: "v1",
      canonicalPotionResources: "v1",
      boundedCombatResources: "v1",
      rankedStartResourceParity: "v1",
      potionClaimOrdering: "v1",
      mapFragmentMinDepth: "v1",
      exactChestStatCarry: "v1",
      campaignChronicle: "v1",
      merchantExitBarrier: "v1",
      otterActualDepthEligibility: "v1",
      roomEliteBudgetByType: "v1"
    }
  );
  assert.deepEqual(
    V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities,
    {
      fatalPresentationCauseMode: "retain",
      boundarySettlementMode: "event-journal-v1",
      postRoomPactSettlement: "post-room-pact-v1",
      boundedProcClaims: "v1",
      canonicalChestOutcomes: "v1",
      earlyBalanceOtterRepair: "v1",
      canonicalPotionResources: "v1",
      boundedCombatResources: "v1",
      rankedStartResourceParity: "v1",
      potionClaimOrdering: "v1",
      mapFragmentMinDepth: "v1",
      exactChestStatCarry: "v1",
      campaignChronicle: "v1"
    }
  );
  assert.deepEqual(
    V08_META_1_INTEGRITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.capabilities,
    { fatalPresentationCauseMode: "retain" }
  );
});

test("every retained production hash can create its own initial state", () => {
  for (const descriptor of PRODUCTION_RELEASES) {
    const state = descriptor.createRuleset().createInitialMetaState({
      rulesetHash: descriptor.rulesetHash
    }, {
      runId: `run_${descriptor.rulesetHash.slice(-16)}`,
      season: "compat-season",
      startedAt: 1_990_000_000_000
    });
    assert.equal(state.rulesetHash, descriptor.rulesetHash);
  }
});

for (const useElixir of [false, true]) {
  test(`bc0d cause-bearing and omitted fatal requests are canonical equivalents${useElixir ? " with elixir usage" : ""}`, async () => {
    const omittedHarness = createHttpHarness(V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR);
    const causedHarness = createHttpHarness(V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR);
    const omittedStart = await omittedHarness.startSelect("equivalent");
    const causedStart = await causedHarness.startSelect("equivalent");
    if (useElixir) {
      omittedHarness.repositories.markHistoricalElixir(omittedStart.session.runId);
      causedHarness.repositories.markHistoricalElixir(causedStart.session.runId);
    }
    const basePayload = {
      classification: "local_fatal_event",
      ...(useElixir ? { elixirUsage: { elixirId: "fury_1", count: 1 } } : {})
    };
    const omitted = await omittedHarness.fatal(
      omittedStart.session,
      basePayload,
      "equivalent-fatal"
    );
    const caused = await causedHarness.fatal(
      causedStart.session,
      { ...basePayload, presentationCause: "Defeated by The Hollow Seraph" },
      "equivalent-fatal"
    );
    assert.equal(omitted.response.status, 200, JSON.stringify(omitted.payload));
    assert.equal(caused.response.status, 200, JSON.stringify(caused.payload));
    assert.deepEqual(caused.payload.metaState, omitted.payload.metaState);
    assert.equal(caused.payload.publicStateDigest, omitted.payload.publicStateDigest);
    assert.equal(caused.payload.checkpointToken, omitted.payload.checkpointToken);
    assert.deepEqual(
      operationComparableState(causedHarness.repositories, caused.payload.runId),
      operationComparableState(omittedHarness.repositories, omitted.payload.runId)
    );
    assert.equal(
      Object.hasOwn(
        causedHarness.repositories.snapshotRun(caused.payload.runId).lifeLedger.history.at(-1),
        "presentationCause"
      ),
      false
    );
  });
}

test("a recovered bc0d run accepts the live f67 cause-bearing fatal payload", async () => {
  const harness = createHttpHarness(V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR);
  const started = await harness.startSelect("recovered");
  const resumed = await harness.resume(started);
  const result = await harness.fatal(resumed, {
    classification: "local_fatal_event",
    presentationCause: "You bled out."
  }, "recovered-fatal");
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.metaState.rulesetHash, V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash);
  assert.equal(result.payload.metaState.lives, 4);
});

test("bc0d terminal summary is cause-free while current production retains the normalized cause", async () => {
  const historical = createHttpHarness(V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR);
  const current = createHttpHarness(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR);
  let historicalSession = (await historical.startSelect("terminal-historical")).session;
  let currentSession = (await current.startSelect("terminal-current")).session;
  for (let index = 0; index < 5; index += 1) {
    const historicalFatal = await historical.fatal(historicalSession, {
      classification: "local_fatal_event",
      presentationCause: "Defeated by The Hollow Seraph"
    }, `terminal-historical-fatal-${index}`);
    const currentFatal = await current.fatal(currentSession, {
      classification: "local_fatal_event",
      presentationCause: "  Defeated   by The Hollow Seraph  "
    }, `terminal-current-fatal-${index}`);
    assert.equal(historicalFatal.response.status, 200, JSON.stringify(historicalFatal.payload));
    assert.equal(currentFatal.response.status, 200, JSON.stringify(currentFatal.payload));
    historicalSession = historicalFatal.payload;
    currentSession = currentFatal.payload;
  }
  assert.equal(historicalSession.metaState.status, "defeat");
  assert.equal(currentSession.metaState.status, "defeat");
  const historicalFinal = await historical.finalize(historicalSession, "terminal-historical-finalize");
  const currentFinal = await current.finalize(currentSession, "terminal-current-finalize");
  assert.equal(historicalFinal.response.status, 200, JSON.stringify(historicalFinal.payload));
  assert.equal(currentFinal.response.status, 200, JSON.stringify(currentFinal.payload));
  const historicalDetail = await historical.get(`/api/v3/leaderboard/${historicalSession.runId}`);
  const currentDetail = await current.get(`/api/v3/leaderboard/${currentSession.runId}`);
  assert.equal(Object.hasOwn(historicalDetail.payload.entry.summary, "presentationCause"), false);
  assert.equal(
    currentDetail.payload.entry.summary.presentationCause,
    "Defeated by The Hollow Seraph"
  );
});
