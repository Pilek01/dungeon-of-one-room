import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { errorFromCause } from "../src/http/errors.js";
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

const LEGACY_RELEASES = Object.freeze([
  V08_META_1_LEGACY_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_R2_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_WARDEN_HOTFIX_RELEASE_DESCRIPTOR,
  V08_META_1_SCORE_CARRY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_HD_BOOT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_BOUNDARY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR
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

function createHttpHarness(descriptor, environment) {
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

  async function post(path, body, key) {
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

  async function startSelect(prefix) {
    const recoveryCredential = `${prefix}-recovery`.padEnd(43, "r").slice(0, 43);
    const started = await post("/api/v3/runs/start", {
      playerName: "Compat",
      season: "compat-season",
      gameVersion: "0.8.1",
      rulesetId: descriptor.rulesetId,
      rulesetHash: descriptor.rulesetHash,
      clientInstallIdHash: `install_${prefix}_0123456789abcdef`,
      profileId: "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      profileCredential: `${prefix}-profile`.padEnd(43, "p").slice(0, 43),
      recoveryCredential,
      clientProtocolVersion: "ranked-v3-checkpoint-1"
    }, `${prefix}-start`);
    assert.equal(started.response.status, 201, JSON.stringify(started.payload));
    const selected = await post("/api/v3/runs/event", {
      runId: started.payload.runId,
      type: "select_starting_relic",
      bootstrapToken: started.payload.bootstrapToken,
      offerId: started.payload.metaState.startingRelicOffer.offerId,
      choiceId: started.payload.metaState.startingRelicOffer.publicChoices[0].choiceId
    }, `${prefix}-select`);
    assert.equal(selected.response.status, 200, JSON.stringify(selected.payload));
    return { recoveryCredential, session: selected.payload };
  }

  async function resume(started, prefix) {
    const operationId = "op_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const result = await post("/api/v3/runs/resume", {
      operationId,
      runId: started.session.runId,
      recoveryCredential: started.recoveryCredential,
      clientProtocolVersion: "ranked-v3-checkpoint-1",
      lastKnownRevision: started.session.metaState.revision
    }, operationId);
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
    return result.payload;
  }

  async function fatal(session, payload, key) {
    const directive = session.metaState.currentRoomDirective;
    return post("/api/v3/runs/event", {
      runId: session.runId,
      type: "report_fatal_event",
      checkpointToken: session.checkpointToken,
      roomDirectiveId: directive.directiveId,
      roomNonce: directive.roomNonce,
      payload
    }, key);
  }

  return { repositories, startSelect, resume, fatal };
}

test("historical production releases strip fatal causes while the activated release retains them", () => {
  for (const descriptor of LEGACY_RELEASES) {
    assert.deepEqual(descriptor.capabilities, { fatalPresentationCauseMode: "strip" }, descriptor.rulesetHash);
    assert.equal(Object.isFrozen(descriptor.capabilities), true, descriptor.rulesetHash);
    const ruleset = descriptor.createRuleset();
    assert.deepEqual(ruleset.capabilities, descriptor.capabilities, descriptor.rulesetHash);
    assert.equal(ruleset.rulesetHash, descriptor.rulesetHash);
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
      campaignChronicle: "v1",
      merchantExitBarrier: "v1",
      otterActualDepthEligibility: "v1",
      roomEliteBudgetByType: "v1"
    }
  );
  assert.deepEqual(
    V08_META_1_INTEGRITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.capabilities,
    { fatalPresentationCauseMode: "retain" }
  );
});

test("every retained production hash can create its own initial state", () => {
  for (const descriptor of [
    ...LEGACY_RELEASES,
    V08_META_1_INTEGRITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_POTION_MERCHANT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR
  ]) {
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

test("bc0d recovered runs report death with legacy payload shapes", async (t) => {
  await t.test("classification only", async () => {
    const harness = createHttpHarness(V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR, "production");
    const started = await harness.startSelect("bc-classification");
    const resumed = await harness.resume(started, "bcclassification");
    const result = await harness.fatal(resumed, {
      classification: "local_fatal_event"
    }, "bc-classification-fatal");
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
    assert.equal(result.payload.metaState.rulesetHash, V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash);
    assert.equal(result.payload.metaState.lives, 4);
  });

  await t.test("classification plus elixir usage", async () => {
    const harness = createHttpHarness(V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR, "production");
    const started = await harness.startSelect("bc-elixir");
    harness.repositories.markHistoricalElixir(started.session.runId);
    const resumed = await harness.resume(started, "bcelixir");
    const result = await harness.fatal(resumed, {
      classification: "local_fatal_event",
      elixirUsage: { elixirId: "fury_1", count: 1 }
    }, "bc-elixir-fatal");
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
    assert.equal(result.payload.metaState.rulesetHash, V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash);
    assert.equal(result.payload.metaState.build.elixirs[0].charges, 2);
    assert.equal(result.payload.metaState.lives, 4);
  });
});

test("supporting local ruleset accepts classification, elixir usage, and presentation cause", async () => {
  const harness = createHttpHarness(V08_META_1_LOCAL_RELEASE_DESCRIPTOR, "local");
  const started = await harness.startSelect("local-cause");
  harness.repositories.markHistoricalElixir(started.session.runId);
  const resumed = await harness.resume(started, "localcause");
  const result = await harness.fatal(resumed, {
    classification: "local_fatal_event",
    elixirUsage: { elixirId: "fury_1", count: 1 },
    presentationCause: "  Defeated   by The Hollow Seraph  "
  }, "local-cause-fatal");
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.metaState.build.elixirs[0].charges, 2);
  assert.equal(
    harness.repositories.snapshotRun(result.payload.runId).lifeLedger.history.at(-1).presentationCause,
    "Defeated by The Hollow Seraph"
  );
});

test("bc0d cause payload is accepted and stripped while unknown failures remain 500", async () => {
  const harness = createHttpHarness(V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR, "production");
  const started = await harness.startSelect("bc-cause");
  const result = await harness.fatal(started.session, {
    classification: "local_fatal_event",
    presentationCause: "Defeated by The Hollow Seraph"
  }, "bc-cause-fatal");
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  assert.equal(Object.hasOwn(harness.repositories.snapshotRun(result.payload.runId).lifeLedger.history.at(-1), "presentationCause"), false);

  const unknown = errorFromCause(new TypeError("UNEXPECTED_FATAL_STORAGE_FAILURE"));
  assert.equal(unknown.status, 500);
  assert.equal(unknown.code, "INTERNAL_ERROR");
});
