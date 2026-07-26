import test from "node:test";
import assert from "node:assert/strict";
import {
  createAuthenticatedRunBootstrap,
  roomTokenPayloadForState,
  selectAuthenticatedStartingRelic
} from "../src/domain/run-bootstrap.js";
import { createV08Meta1Ruleset } from "../src/rulesets/v08-meta-1/index.js";
import { canonicalDigest } from "../src/security/digests.js";
import { stateForDigest } from "../src/domain/run-state.js";
import {
  BOUNDARY_KINDS,
  signBoundaryToken,
  verifyBoundaryToken
} from "../src/security/checkpoint-token.js";
import { TEST_SECRET } from "./fixtures/harness.js";

const NOW = 1_800_000_000_000;
const RULESET_HASH = "sha256:2fcc9df6032f7966ff0ede0e723dc1f0f3b0b28cc0d77533caaeb7ae886a8594";

async function setup(seed = 0, ruleset = createV08Meta1Ruleset({ secret: TEST_SECRET })) {
  const transition = await createAuthenticatedRunBootstrap({
    playerName: "Selector",
    season: "fixture-season",
    gameVersion: "0.8.1",
    rulesetId: "v08-meta-1",
    rulesetHash: RULESET_HASH,
    clientInstallIdHash: "install_0123456789abcdef"
  }, {
    ruleset,
    secret: TEST_SECRET,
    now: NOW + seed,
    runId: `run_${seed.toString(16).padStart(16, "0")}`,
    bootstrapNonce: `bootstrap_nonce_${seed}`
  });
  const state = transition.nextState;
  return {
    state,
    ruleset,
    request: {
      offerId: state.pendingOffer.offerId,
      choiceId: state.pendingOffer.choices[seed % state.pendingOffer.choices.length].choiceId
    }
  };
}

async function select(setupValue) {
  return selectAuthenticatedStartingRelic(
    setupValue.state,
    setupValue.request,
    { ruleset: setupValue.ruleset, secret: TEST_SECRET }
  );
}

test("starting relic selection atomically creates the first canonical room directive", async () => {
  const value = await setup(5);
  const before = structuredClone(value.state);
  const transition = await select(value);
  const next = transition.nextState;
  assert.deepEqual(value.state, before);
  assert.equal(next.status, "active");
  assert.equal(next.revision, 1);
  assert.equal(next.pendingOffer, null);
  assert.equal(next.bootstrapBoundary.status, "completed");
  assert.equal(next.bootstrapBoundary.selectedChoiceId, value.request.choiceId);
  assert.equal(next.build.relics.length, 1);
  assert.equal(next.currentRoomDirective.runId, next.runId);
  assert.equal(next.currentRoomDirective.revision, next.revision);
  assert.equal(
    next.bootstrapBoundary.firstRoomDirectiveId,
    next.currentRoomDirective.directiveId
  );
  assert.equal(Object.hasOwn(next, "roomDirective"), false);
});

test("exact retry and restart preserve the selected relic, build and first directive", async () => {
  const value = await setup(9);
  const first = await select(value);
  const restarted = JSON.parse(JSON.stringify(first.nextState));
  const retry = await selectAuthenticatedStartingRelic(
    restarted,
    value.request,
    { ruleset: value.ruleset, secret: TEST_SECRET }
  );
  assert.equal(retry.response.replayed, true);
  assert.deepEqual(retry.nextState, first.nextState);
  assert.deepEqual(
    retry.response.firstRoomDirective,
    first.response.firstRoomDirective
  );
  assert.equal(retry.storageEffects.length, 0);
});

test("conflicting retry, fake target, result and extra authoritative fields fail closed", async () => {
  const value = await setup(17);
  const first = await select(value);
  const otherChoice = value.state.pendingOffer.choices.find(
    (choice) => choice.choiceId !== value.request.choiceId
  );
  await assert.rejects(
    selectAuthenticatedStartingRelic(
      first.nextState,
      { ...value.request, choiceId: otherChoice.choiceId },
      { ruleset: value.ruleset, secret: TEST_SECRET }
    ),
    /ALREADY_COMPLETED_CONFLICT/u
  );
  for (const request of [
    { offerId: "offer_fake", choiceId: value.request.choiceId },
    { offerId: value.request.offerId, choiceId: "choice_fake" },
    { ...value.request, relicId: "relic_fake" },
    { ...value.request, build: { relics: [] } },
    { ...value.request, roomDirectiveId: "directive_fake" }
  ]) {
    await assert.rejects(
      selectAuthenticatedStartingRelic(
        value.state,
        request,
        { ruleset: value.ruleset, secret: TEST_SECRET }
      )
    );
  }
});

test("failure after canonical selection rolls back the entire bootstrap state", async () => {
  const value = await setup(21);
  const before = structuredClone(value.state);
  const failingRuleset = {
    ...value.ruleset,
    async selectStartingRelic(state, request, context) {
      await value.ruleset.selectStartingRelic(state, request, context);
      throw new TypeError("DIRECTIVE_PERSISTENCE_SIMULATED_FAILURE");
    }
  };
  await assert.rejects(
    selectAuthenticatedStartingRelic(
      value.state,
      value.request,
      { ruleset: failingRuleset, secret: TEST_SECRET }
    ),
    /SIMULATED_FAILURE/u
  );
  assert.deepEqual(value.state, before);
});

test("room boundary token is kind-separated and bound to the first directive", async () => {
  const value = await setup(25);
  const { nextState } = await select(value);
  const digest = await canonicalDigest(stateForDigest(nextState));
  const payload = roomTokenPayloadForState(nextState, digest, NOW + 25);
  const token = await signBoundaryToken(payload, TEST_SECRET);
  await verifyBoundaryToken(token, TEST_SECRET, {
    now: NOW + 26,
    boundaryKind: BOUNDARY_KINDS.ROOM_CHECKPOINT,
    runId: nextState.runId,
    rulesetId: nextState.rulesetId,
    rulesetHash: nextState.rulesetHash,
    revision: nextState.revision,
    stateDigest: digest,
    roomDirectiveId: nextState.currentRoomDirective.directiveId,
    roomNonce: nextState.currentRoomDirective.roomNonce
  });
  await assert.rejects(
    verifyBoundaryToken(token, TEST_SECRET, {
      now: NOW + 26,
      boundaryKind: BOUNDARY_KINDS.RUN_BOOTSTRAP
    }),
    /TOKEN_BOUNDARY_KIND_MISMATCH/u
  );
});

test("64 seed property matrix is deterministic and consumes one offer and directive once", async () => {
  for (let seed = 0; seed < 64; seed += 1) {
    const firstInput = await setup(seed);
    const secondInput = await setup(seed);
    const first = await select(firstInput);
    const second = await select(secondInput);
    assert.deepEqual(second, first);
    assert.equal(first.nextState.offerSettlementHistory.length, 1);
    assert.equal(first.nextState.statistics.roomsIssued, 1);
    assert.equal(first.nextState.revision, 1);
  }
});
