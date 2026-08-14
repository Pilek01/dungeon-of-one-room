import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createInitialRun } from "../src/domain/run-state.js";
import {
  applyCheckpoint,
  applyMetaEvent,
  finalizeRun
} from "../src/domain/transitions.js";
import {
  fixtureRuleset,
  FIXTURE_RULESET_HASH
} from "./fixtures/fixture-ruleset.js";

function assertTransition(result, effectType) {
  assert.deepEqual(Object.keys(result).sort(), [
    "nextState",
    "response",
    "storageEffects"
  ]);
  assert.equal(result.storageEffects[0].type, effectType);
}

test("pure domain boundaries return state, response, and declarative effects", () => {
  const initial = createInitialRun({
    playerName: "DomainFixture",
    season: "fixture-season",
    gameVersion: "v0.8.0",
    rulesetHash: FIXTURE_RULESET_HASH,
    clientInstallIdHash: "fixture-install-hash"
  }, {
    ruleset: fixtureRuleset,
    now: 1_800_000_000_000,
    runId: "run_domain_fixture",
    roomDirectiveId: "directive_domain_1",
    roomNonce: "nonce_domain_1"
  });
  assertTransition(initial, "insert_run");
  assert.equal(initial.nextState.revision, 0);

  const initialSnapshot = structuredClone(initial.nextState);
  const checkpoint = applyCheckpoint(initial.nextState, {
    roomDirectiveId: "directive_domain_1",
    roomNonce: "nonce_domain_1",
    roomResult: "cleared",
    turnCount: 2,
    elapsedMs: 1_000,
    commandJournalDigest: "abcdef12",
    compactRoomProof: {
      roomDirectiveId: "directive_domain_1",
      roomNonce: "nonce_domain_1",
      commands: [{ code: "move", count: 1 }]
    },
    nextRoomDirectiveId: "directive_domain_2",
    nextRoomNonce: "nonce_domain_2"
  }, fixtureRuleset);
  assertTransition(checkpoint, "update_run");
  assert.deepEqual(initial.nextState, initialSnapshot);
  assert.equal(checkpoint.nextState.revision, 1);
  assert.equal(checkpoint.nextState.depth, 1);

  const checkpointSnapshot = structuredClone(checkpoint.nextState);
  const event = applyMetaEvent(checkpoint.nextState, {
    roomDirectiveId: "directive_domain_2",
    roomNonce: "nonce_domain_2",
    type: "relic_selected",
    payload: { relicId: "fixture_ember" }
  }, fixtureRuleset);
  assertTransition(event, "update_run");
  assert.deepEqual(checkpoint.nextState, checkpointSnapshot);
  assert.equal(event.nextState.revision, 2);
  assert.deepEqual(event.nextState.build.relics, [
    { id: "fixture_ember", stacks: 1 }
  ]);

  const eventSnapshot = structuredClone(event.nextState);
  const finalized = finalizeRun(event.nextState, {
    roomDirectiveId: "directive_domain_2",
    roomNonce: "nonce_domain_2",
    outcome: "defeat",
    now: 1_800_000_010_000
  }, fixtureRuleset);
  assert.deepEqual(
    Object.keys(finalized).sort(),
    ["nextState", "response", "storageEffects"]
  );
  assert.deepEqual(
    finalized.storageEffects.map((effect) => effect.type),
    ["finalize_run", "upsert_leaderboard_snapshot"]
  );
  assert.deepEqual(event.nextState, eventSnapshot);
  assert.equal(finalized.nextState.status, "finalized");
  assert.equal(finalized.response.verificationLevel, "checkpoint_verified_v3");
});

test("pure domain modules do not depend on HTTP, D1, or cryptography", async () => {
  const sources = await Promise.all([
    readFile(new URL("../src/domain/run-state.js", import.meta.url), "utf8"),
    readFile(new URL("../src/domain/transitions.js", import.meta.url), "utf8")
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, /\bfetch\b|crypto\.subtle|RANKED_V3_HMAC_SECRET|\.prepare\(/u);
  }
});
