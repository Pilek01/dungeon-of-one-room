import test from "node:test";
import assert from "node:assert/strict";
import {
  BOUNDARY_KINDS,
  decodeBoundaryToken,
  signBoundaryToken,
  verifyBoundaryToken
} from "../src/security/checkpoint-token.js";
import {
  assertAwaitingRunBootstrap,
  bootstrapTokenPayloadForState,
  createAuthenticatedRunBootstrap
} from "../src/domain/run-bootstrap.js";
import { createV08Meta1Ruleset } from "../src/rulesets/v08-meta-1/index.js";
import { canonicalDigest } from "../src/security/digests.js";
import { stateForDigest } from "../src/domain/run-state.js";
import { TEST_SECRET } from "./fixtures/harness.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const NOW = 1_800_000_000_000;
const RULESET_HASH = manifest.rulesetHash;

function startInput() {
  return {
    playerName: "Bootstrap",
    season: "fixture-season",
    gameVersion: "0.8.1",
    rulesetId: "v08-meta-1",
    rulesetHash: RULESET_HASH,
    clientInstallIdHash: "install_0123456789abcdef"
  };
}

async function bootstrap(seed = 0) {
  return createAuthenticatedRunBootstrap(startInput(), {
    ruleset: createV08Meta1Ruleset({ secret: TEST_SECRET }),
    secret: TEST_SECRET,
    now: NOW + seed,
    runId: `run_${seed.toString(16).padStart(16, "0")}`,
    bootstrapNonce: `bootstrap_nonce_${seed}`
  });
}

test("golden authenticated bootstrap has a canonical offer and no room directive", async () => {
  const transition = await bootstrap(7);
  const state = assertAwaitingRunBootstrap(transition.nextState);
  assert.equal(state.status, "awaiting_starting_relic");
  assert.equal(state.revision, 0);
  assert.equal(state.currentRoomDirective, null);
  assert.equal(Object.hasOwn(state, "roomDirective"), false);
  assert.equal(state.pendingOffer.offerType, "starting_relic");
  assert.equal(state.pendingOffer.choices.length, 3);
  assert.equal(state.bootstrapBoundary.startingOfferId, state.pendingOffer.offerId);
  assert.deepEqual(transition.response, {
    acceptedBoundary: "run_bootstrap_created"
  });
});

test("bootstrap token v2 binds exact run, ruleset, revision, offer, digest and nonce", async () => {
  const { nextState: state } = await bootstrap(11);
  const stateDigest = await canonicalDigest(stateForDigest(state));
  const payload = bootstrapTokenPayloadForState(state, stateDigest, NOW + 11);
  const token = await signBoundaryToken(payload, TEST_SECRET);
  assert.deepEqual(decodeBoundaryToken(token).payload, payload);
  assert.deepEqual(
    await verifyBoundaryToken(token, TEST_SECRET, {
      now: NOW + 12,
      boundaryKind: BOUNDARY_KINDS.RUN_BOOTSTRAP,
      runId: state.runId,
      rulesetId: state.rulesetId,
      rulesetHash: state.rulesetHash,
      revision: state.revision,
      startingOfferId: state.pendingOffer.offerId,
      stateDigest,
      bootstrapNonce: state.bootstrapBoundary.bootstrapNonce
    }),
    payload
  );
  await assert.rejects(
    verifyBoundaryToken(token, TEST_SECRET, {
      now: NOW + 12,
      boundaryKind: BOUNDARY_KINDS.ROOM_CHECKPOINT
    }),
    /TOKEN_BOUNDARY_KIND_MISMATCH:room_checkpoint:run_bootstrap/u
  );
});

test("bootstrap token rejects stale or cross-boundary claims and unknown fields", async () => {
  const { nextState: state } = await bootstrap(13);
  const stateDigest = await canonicalDigest(stateForDigest(state));
  const payload = bootstrapTokenPayloadForState(state, stateDigest, NOW + 13);
  const token = await signBoundaryToken(payload, TEST_SECRET);
  for (const expected of [
    { revision: 1 },
    { runId: "run_other" },
    { rulesetId: "fixture-v3" },
    { rulesetHash: "sha256:other" },
    { stateDigest: "b".repeat(64) },
    { startingOfferId: "offer_other" },
    { bootstrapNonce: "nonce_other" }
  ]) {
    await assert.rejects(
      verifyBoundaryToken(token, TEST_SECRET, { now: NOW + 14, ...expected }),
      /does not match/u
    );
  }
  await assert.rejects(
    signBoundaryToken({ ...payload, roomDirectiveId: "directive_fake" }, TEST_SECRET),
    /fields/iu
  );
});

test("bootstrap construction is deterministic across 64 explicit seeds and restart serialization", async () => {
  for (let seed = 0; seed < 64; seed += 1) {
    const first = (await bootstrap(seed)).nextState;
    const second = (await bootstrap(seed)).nextState;
    assert.deepEqual(second, first);
    assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
    assert.equal(first.currentRoomDirective, null);
    assert.equal(first.pendingOffer.choices.length, 3);
  }
});
