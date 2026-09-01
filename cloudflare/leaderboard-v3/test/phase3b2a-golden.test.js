import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  issueNextRoomDirectiveV08
} from "../src/rulesets/v08-meta-1/room-policy.js";
import {
  createRoomRewardEnvelopeV3,
  settleRoomRewardEnvelopeV3
} from "../src/rulesets/v08-meta-1/reward-policy.js";
import {
  createV08Meta1Ruleset
} from "../src/rulesets/v08-meta-1/index.js";
import {
  applyRelicAcquisition,
  createEmptyRelicBuildV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import {
  applyCanonicalRunModifierSelection
} from "../src/rulesets/v08-meta-1/run-modifiers.js";

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(await readFile(
  path.join(
    WORKER_ROOT,
    "src",
    "rulesets",
    "v08-meta-1",
    "test",
    "phase3b2a-golden-fixtures.json"
  ),
  "utf8"
));

function zeroOracle() {
  return {
    async deriveRandomBytes(options) {
      const bytes = new Uint8Array(options.length);
      let offset = 0;
      let block = 0;
      while (offset < bytes.length) {
        const digest = createHash("sha256")
          .update(JSON.stringify({
            runId: options.runId,
            revision: options.revision,
            purpose: options.purpose,
            counter: options.counter,
            block
          }))
          .digest();
        const take = Math.min(digest.length, bytes.length - offset);
        bytes.set(digest.subarray(0, take), offset);
        offset += take;
        block += 1;
      }
      return bytes;
    },
    async deriveIntInclusive(min) {
      return min;
    }
  };
}

function context(runId = "run_phase3b2a") {
  return {
    runId,
    season: "season-phase3b2a",
    startedAt: 1_700_000_000_000,
    elapsedMs: 1_000,
    secret: "phase3b2a:0123456789abcdef0123456789abcdef",
    randomOracle: zeroOracle()
  };
}

async function issuedState(options = {}) {
  const resolvedContext = context(options.runId);
  let state = createInitialMetaStateV08(
    { runId: resolvedContext.runId, season: resolvedContext.season },
    resolvedContext
  );
  if (Number.isSafeInteger(options.depth)) {
    state.depth = options.depth;
    state.roomIndex = options.depth;
  }
  state.status = "active";
  if (options.build) {
    let build = createEmptyRelicBuildV08();
    for (const relicId of options.build.relics || []) {
      build = await applyRelicAcquisition(build, {
        relicId,
        acquiredRevision: state.revision,
        acquisitionSource: "phase3b2a_fixture",
        sourceOfferId: `fixture_${relicId}`
      });
    }
    for (const field of ["pacts", "campUpgrades", "skillTiers", "elixirs"]) {
      build[field] = structuredClone(options.build[field] ?? build[field]);
    }
    state.build = build;
  }
  if (options.modifierIds) {
    state = await applyCanonicalRunModifierSelection(state, {
      modifierIds: options.modifierIds,
      activationSource: "server-issued-run-start"
    }, {
      authority: "TRUSTED_RULESET_DOMAIN"
    });
  }
  return issueNextRoomDirectiveV08(state, resolvedContext);
}

function validRequest(state, overrides = {}) {
  const fixed = state.currentRewardEnvelope.fixedAwards.reduce(
    (sum, award) => sum + award.amount,
    0
  );
  return {
    envelopeId: state.currentRewardEnvelope.envelopeId,
    roomDirectiveId: state.currentRoomDirective.directiveId,
    roomNonce: state.currentRoomDirective.roomNonce,
    claims: [],
    reportedGoldDelta: fixed,
    reportedGoldTotal: state.gold + fixed,
    turnCount: 10,
    elapsedMs: 1_000,
    commandJournalDigest: "journal_0123456789abcdef",
    compactRoomProof: "proof_0123456789abcdef",
    ...overrides
  };
}

function operationFor(state, overrides = {}) {
  const directive = state.currentRoomDirective;
  return {
    directiveId: directive.directiveId,
    runId: state.runId,
    rulesetHash: state.rulesetHash,
    revision: state.revision,
    roomIndex: directive.roomIndex,
    depth: directive.depth,
    roomType: directive.roomType,
    roomNonce: directive.roomNonce,
    completionAttestation: "local-room-completed",
    ...overrides
  };
}

async function settleWithClaims(claims, options = {}) {
  const state = await issuedState(options);
  const request = validRequest(state, { claims, ...options.request });
  const result = await settleRoomRewardEnvelopeV3(state, request);
  return { state, request, result };
}

async function expectRejected(state, request, pattern, settlementContext = {}) {
  const before = structuredClone(state);
  await assert.rejects(
    settleRoomRewardEnvelopeV3(state, request, settlementContext),
    pattern
  );
  assert.deepEqual(state, before);
}

const commonAccepted = new Set([
  "fixed-room-reward",
  "gold-never-negative"
]);

test("boss reward envelope accepts the v0.8 Warden kill reward", async () => {
  const { result } = await settleWithClaims([
    { claimType: "enemy", claimId: "enemy:warden", count: 1 }
  ], { depth: 4 });
  assert.equal(result.authoritativeGoldDelta, 49);
});

async function pactRoomIssuedState(capabilities = { roomEliteBudgetByType: "v1" }) {
  const resolvedContext = context("run_pact_elite_budget");
  const state = await issuedState({ runId: resolvedContext.runId, depth: 24 });
  const directive = {
    ...state.currentRoomDirective,
    roomType: "pact",
    roomCategory: "special",
    specialRoomPayload: { scalingDepth: 25 }
  };
  state.currentRoomDirective = directive;
  state.currentRewardEnvelope = await createRoomRewardEnvelopeV3({
    state,
    directive,
    envelopeId: "envelope_pact_elite_budget",
    cryptoProvider: globalThis.crypto,
    capabilities,
    randomOracle: resolvedContext.randomOracle,
    secret: resolvedContext.secret
  });
  return state;
}

test("Pact room accepts its source-authored maximum of seven elite enemies", async () => {
  const capabilities = { roomEliteBudgetByType: "v1" };
  const state = await pactRoomIssuedState(capabilities);
  const eliteClaims = [
    { claimType: "elite", claimId: "elite:slime", count: 2 },
    { claimType: "elite", claimId: "elite:skeleton", count: 2 },
    { claimType: "elite", claimId: "elite:brute", count: 2 },
    { claimType: "elite", claimId: "elite:acolyte", count: 1 }
  ];

  const result = await settleRoomRewardEnvelopeV3(
    state,
    validRequest(state, { claims: eliteClaims }),
    { capabilities }
  );

  assert.equal(result.state.mutatorProgress.eliteKills, 7);
});

test("Pact room rejects an eighth elite while ordinary rooms retain the cap of four", async () => {
  const capabilities = { roomEliteBudgetByType: "v1" };
  const pactState = await pactRoomIssuedState(capabilities);
  await expectRejected(
    pactState,
    validRequest(pactState, {
      claims: [
        { claimType: "elite", claimId: "elite:slime", count: 2 },
        { claimType: "elite", claimId: "elite:skeleton", count: 2 },
        { claimType: "elite", claimId: "elite:brute", count: 2 },
        { claimType: "elite", claimId: "elite:acolyte", count: 2 }
      ]
    }),
    /REWARD_CLAIM_ROOM_ELITE_BUDGET/u,
    { capabilities }
  );

  const ordinaryState = await issuedState();
  await expectRejected(
    ordinaryState,
    validRequest(ordinaryState, {
      claims: [
        { claimType: "elite", claimId: "elite:slime", count: 2 },
        { claimType: "elite", claimId: "elite:skeleton", count: 2 },
        { claimType: "elite", claimId: "elite:brute", count: 1 }
      ]
    }),
    /REWARD_CLAIM_ROOM_ELITE_BUDGET/u
  );
});

test("historical rulesets retain the legacy global elite cap", async () => {
  const state = await pactRoomIssuedState({});
  const request = validRequest(state, {
    claims: [
      { claimType: "elite", claimId: "elite:slime", count: 2 },
      { claimType: "elite", claimId: "elite:skeleton", count: 2 },
      { claimType: "elite", claimId: "elite:brute", count: 1 }
    ]
  });

  await expectRejected(
    state,
    request,
    /REWARD_CLAIM_ROOM_ELITE_BUDGET/u
  );
});

test("legacy boss envelope without a Warden definition is repaired at settlement", async () => {
  const state = await issuedState({ depth: 4 });
  state.currentRewardEnvelope.boundedClaims =
    state.currentRewardEnvelope.boundedClaims.filter(
      (claim) => claim.claimId !== "enemy:warden"
    );
  state.currentRewardEnvelope.maximumGoldDelta = 20;
  const request = validRequest(state, {
    claims: [{ claimType: "enemy", claimId: "enemy:warden", count: 1 }]
  });
  const result = await settleRoomRewardEnvelopeV3(state, request);
  assert.equal(result.authoritativeGoldDelta, 49);
  assert.equal(
    state.currentRewardEnvelope.boundedClaims.some(
      (claim) => claim.claimId === "enemy:warden"
    ),
    false
  );
});

const runners = Object.fromEntries(fixtures.map((fixture) => [
  fixture.fixtureId,
  async () => {
    if (commonAccepted.has(fixture.fixtureId)) {
      const { result } = await settleWithClaims([]);
      assert.equal(result.authoritativeGoldDelta, 2);
      assert.equal(result.state.gold, 2);
      assert.ok(result.state.gold >= 0);
      return;
    }
    switch (fixture.fixtureId) {
      case "normal-room-no-claims": {
        const state = await issuedState();
        assert.equal(state.gold, 0);
        assert.equal(state.goldLedger.roomClaimsAccepted, 0);
        assert.equal(state.currentRewardEnvelope.consumed, false);
        return;
      }
      case "enemy-claims-within-limit": {
        const { result } = await settleWithClaims([
          { claimType: "enemy", claimId: "enemy:slime", count: 1, localEvidence: { evidenceId: "kill_1" } }
        ]);
        assert.equal(result.authoritativeGoldDelta, 4);
        return;
      }
      case "enemy-claim-over-limit":
      case "elite-claim-over-limit": {
        const state = await issuedState();
        const claimType = fixture.fixtureId.startsWith("elite") ? "elite" : "enemy";
        const request = validRequest(state, {
          claims: [{ claimType, claimId: `${claimType}:slime`, count: 99 }]
        });
        await expectRejected(state, request, /REWARD_CLAIM_COUNT_LIMIT/u);
        return;
      }
      case "elite-claim-within-limit": {
        const { result } = await settleWithClaims([
          { claimType: "elite", claimId: "elite:slime", count: 1 }
        ]);
        assert.equal(result.authoritativeGoldDelta, 4);
        return;
      }
      case "chest-slot-claim": {
        const { result } = await settleWithClaims([
          { claimType: "chest", claimId: "chest_1", count: 1, localEvidence: { outcome: "gold", baseAmount: 4 } }
        ]);
        assert.equal(result.authoritativeGoldDelta, 6);
        assert.equal(result.state.currentRewardEnvelope.claimSlots[0].consumed, true);
        return;
      }
      case "chest-slot-reuse": {
        const state = await issuedState();
        const firstRequest = validRequest(state, {
          claims: [{
            claimType: "chest",
            claimId: "chest_1",
            count: 1,
            localEvidence: { outcome: "gold", baseAmount: 4 }
          }]
        });
        const first = await settleRoomRewardEnvelopeV3(state, firstRequest);
        await assert.rejects(
          settleRoomRewardEnvelopeV3(first.state, {
            ...firstRequest,
            claims: [{
              ...firstRequest.claims[0],
              localEvidence: { outcome: "gold", baseAmount: 8 }
            }]
          }),
          /REWARD_IDEMPOTENCY_PAYLOAD_MISMATCH/u
        );
        assert.equal(first.state.currentRewardEnvelope.claimSlots[0].consumed, true);
        return;
      }
      case "envelope-reuse":
      case "changed-payload-same-idempotency": {
        const state = await issuedState();
        const firstRequest = validRequest(state);
        const first = await settleRoomRewardEnvelopeV3(state, firstRequest);
        await assert.rejects(
          settleRoomRewardEnvelopeV3(
            first.state,
            { ...firstRequest, reportedGoldTotal: 999 }
          ),
          /REWARD_IDEMPOTENCY_PAYLOAD_MISMATCH/u
        );
        assert.equal(first.state.gold, 2);
        return;
      }
      case "boss-fixed-reward": {
        const { result } = await settleWithClaims([], { depth: 4 });
        assert.equal(result.state.currentRoomDirective.roomType, "boss");
        assert.equal(result.authoritativeGoldDelta, 14);
        return;
      }
      case "reported-gold-delta-10000": {
        const { result } = await settleWithClaims([], { request: { reportedGoldDelta: 10_000 } });
        assert.equal(result.state.gold, 2);
        assert.ok(result.anomalies.includes("REPORTED_GOLD_DELTA_MISMATCH"));
        return;
      }
      case "reported-gold-total-10000": {
        const { result } = await settleWithClaims([], { request: { reportedGoldTotal: 10_000 } });
        assert.equal(result.state.gold, 2);
        assert.ok(result.anomalies.includes("REPORTED_GOLD_TOTAL_MISMATCH"));
        return;
      }
      case "unknown-claim-type":
      case "unknown-claim-id":
      case "negative-count":
      case "duplicate-claim-entry": {
        const state = await issuedState();
        let claims;
        let pattern;
        if (fixture.fixtureId === "unknown-claim-type") {
          claims = [{ claimType: "coins", claimId: "enemy:slime", count: 1 }];
          pattern = /REWARD_CLAIM_TYPE_UNKNOWN/u;
        } else if (fixture.fixtureId === "unknown-claim-id") {
          claims = [{ claimType: "enemy", claimId: "enemy:dragon", count: 1 }];
          pattern = /REWARD_CLAIM_ID_UNKNOWN/u;
        } else if (fixture.fixtureId === "negative-count") {
          claims = [{ claimType: "enemy", claimId: "enemy:slime", count: -1 }];
          pattern = /REWARD_CLAIM_COUNT_INVALID/u;
        } else {
          claims = [
            { claimType: "enemy", claimId: "enemy:slime", count: 1 },
            { claimType: "enemy", claimId: "enemy:slime", count: 1 }
          ];
          pattern = /REWARD_CLAIM_DUPLICATE/u;
        }
        await expectRejected(state, validRequest(state, { claims }), pattern);
        return;
      }
      case "stale-envelope":
      case "old-revision-envelope": {
        const state = await issuedState();
        state.currentRewardEnvelope.revision += 1;
        await expectRejected(
          state,
          validRequest(state),
          /REWARD_ENVELOPE_REVISION_MISMATCH/u
        );
        return;
      }
      case "other-run-envelope": {
        const state = await issuedState();
        state.currentRewardEnvelope.runId = "run_other";
        await expectRejected(state, validRequest(state), /REWARD_ENVELOPE_RUN_MISMATCH/u);
        return;
      }
      case "wrong-directive-envelope": {
        const state = await issuedState();
        state.currentRewardEnvelope.directiveId = "directive_other";
        await expectRejected(state, validRequest(state), /REWARD_ENVELOPE_DIRECTIVE_MISMATCH/u);
        return;
      }
      case "exact-retry": {
        const state = await issuedState();
        const request = validRequest(state);
        const first = await settleRoomRewardEnvelopeV3(state, request);
        const second = await settleRoomRewardEnvelopeV3(first.state, request);
        assert.equal(second.replayed, true);
        assert.deepEqual(second.state, first.state);
        return;
      }
      case "canonical-build-modifier":
      case "rounding": {
        const { result } = await settleWithClaims(
          [{ claimType: "enemy", claimId: "enemy:brute", count: 1 }],
          { build: { relics: ["idol"], pacts: [], campUpgrades: {}, skillTiers: {}, elixirs: [] } }
        );
        assert.equal(result.authoritativeGoldDelta, 7);
        return;
      }
      case "fake-client-modifier": {
        const state = await issuedState();
        const request = validRequest(state, {
          clientBuild: { relics: ["idol", "idol", "idol", "idol", "idol"] },
          claimedModifiers: ["golden-idol"]
        });
        const result = await settleRoomRewardEnvelopeV3(state, request);
        assert.equal(result.authoritativeGoldDelta, 2);
        return;
      }
      case "modifier-stack-cap": {
        const { result } = await settleWithClaims([], {
          build: {
            relics: ["idol"],
            pacts: [],
            campUpgrades: {},
            skillTiers: {},
            elixirs: []
          }
        });
        assert.equal(result.authoritativeGoldDelta, 2);
        return;
      }
      case "room-type-mismatch": {
        const state = await issuedState();
        await expectRejected(
          state,
          validRequest(state, { roomType: "vault" }),
          /REWARD_CLAIM_ROOM_TYPE_MISMATCH/u
        );
        return;
      }
      case "missing-completion-attestation": {
        const state = await issuedState();
        const ruleset = createV08Meta1Ruleset({
          secret: context().secret,
          randomOracle: zeroOracle()
        });
        await assert.rejects(
          ruleset.consumeRoomDirective(
            state,
            operationFor(state, { completionAttestation: "" }),
            context()
          ),
          /ROOM_COMPLETION_ATTESTATION_REQUIRED/u
        );
        return;
      }
      case "command-journal-anomaly": {
        const { result } = await settleWithClaims([], {
          request: { commandJournalDigest: "" }
        });
        assert.ok(result.anomalies.includes("COMMAND_JOURNAL_DIGEST_MISSING"));
        return;
      }
      case "elapsed-turn-anomaly": {
        const { result } = await settleWithClaims([], {
          request: { elapsedMs: 1, turnCount: -1 }
        });
        assert.ok(result.anomalies.includes("ELAPSED_MS_BELOW_MINIMUM"));
        assert.ok(result.anomalies.includes("TURN_COUNT_OUT_OF_BOUNDS"));
        return;
      }
      case "fixed-plus-bounded": {
        const { result } = await settleWithClaims([
          { claimType: "enemy", claimId: "enemy:skeleton", count: 1 }
        ]);
        assert.equal(result.authoritativeGoldDelta, 5);
        assert.equal(result.state.goldLedger.earnedServerDerived, 2);
        assert.equal(result.state.goldLedger.earnedBoundedAttested, 3);
        return;
      }
      case "serialized-state-round-trip": {
        const state = await issuedState();
        const restored = JSON.parse(JSON.stringify(state));
        const result = await settleRoomRewardEnvelopeV3(restored, validRequest(restored));
        assert.equal(result.state.gold, 2);
        return;
      }
      case "ruleset-restart-deterministic": {
        const left = await issuedState({ runId: "restart_run" });
        const right = await issuedState({ runId: "restart_run" });
        const leftResult = await settleRoomRewardEnvelopeV3(left, validRequest(left));
        const rightResult = await settleRoomRewardEnvelopeV3(right, validRequest(right));
        assert.deepEqual(leftResult, rightResult);
        return;
      }
      case "maximum-envelope": {
        const state = await issuedState({
          depth: 89,
          build: {
            relics: ["idol"],
            pacts: ["avarice"],
            campUpgrades: { treasure_sense: 5, bounty_contract: 5 },
            skillTiers: {},
            elixirs: []
          },
          modifierIds: ["greed", "elitist", "ascension"]
        });
        assert.ok(state.currentRewardEnvelope.maximumGoldDelta <= 10_000);
        assert.ok(state.currentRewardEnvelope.maximumGoldDelta > 0);
        return;
      }
      case "gold-ledger-counters": {
        const { result } = await settleWithClaims([
          { claimType: "enemy", claimId: "enemy:slime", count: 1 }
        ]);
        assert.deepEqual(
          {
            earnedServerDerived: result.state.goldLedger.earnedServerDerived,
            earnedBoundedAttested: result.state.goldLedger.earnedBoundedAttested,
            spentServerDerived: result.state.goldLedger.spentServerDerived,
            lastDelta: result.state.goldLedger.lastDelta,
            roomClaimsAccepted: result.state.goldLedger.roomClaimsAccepted
          },
          fixture.expectedLedger
        );
        return;
      }
      default:
        assert.fail(`Missing runner for ${fixture.fixtureId}`);
    }
  }
]));

test("Phase 3B2A golden corpus has the required executable fixture contract", () => {
  assert.equal(fixtures.length, 36);
  const requiredFields = [
    "fixtureId",
    "legacySourceEvidence",
    "initialMetaState",
    "roomDirective",
    "rewardEnvelope",
    "clientClaims",
    "expectedAuthoritativeGoldDelta",
    "expectedGold",
    "expectedLedger",
    "expectedAnomalies",
    "expectedResult"
  ];
  for (const fixture of fixtures) {
    for (const field of requiredFields) assert.ok(Object.hasOwn(fixture, field), `${fixture.fixtureId}:${field}`);
  }
  assert.deepEqual(
    fixtures.map((fixture) => fixture.fixtureId).sort(),
    Object.keys(runners).sort()
  );
});

for (const fixture of fixtures) {
  test(`golden 3B2A: ${fixture.fixtureId}`, runners[fixture.fixtureId]);
}
