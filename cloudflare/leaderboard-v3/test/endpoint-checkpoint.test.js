import test from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./fixtures/harness.js";

test("POST /api/v3/runs/checkpoint advances one sequential depth", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const result = await harness.checkpoint(started, {
    gold: 10_000,
    depth: 99,
    relics: ["forged_relic"],
    clientSummary: {
      gold: 10_000,
      depth: 99,
      roomType: "vault",
      score: 999_999
    }
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.revision, 1);
  assert.equal(result.payload.metaState.depth, 1);
  assert.equal(result.payload.metaState.gold, 10);
  assert.deepEqual(result.payload.metaState.build.relics, []);
  assert.equal(result.payload.metaState.roomDirective.roomType, "merchant");
});

test("checkpoint validates supplied command journal digest", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const result = await harness.checkpoint(started, {
    commandJournalDigest: "0".repeat(64)
  });
  assert.equal(result.response.status, 422);
  assert.equal(result.payload.error.code, "JOURNAL_DIGEST_MISMATCH");
});

test("checkpoint rejects directive and nonce mismatches", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const wrongDirective = await harness.checkpoint(started, {
    roomDirectiveId: "directive_tampered",
    compactRoomProof: {
      roomDirectiveId: "directive_tampered",
      roomNonce: started.metaState.roomDirective.roomNonce,
      commands: [{ code: "move" }]
    },
    commands: [{ code: "move" }]
  });
  assert.equal(wrongDirective.response.status, 409);
  assert.equal(wrongDirective.payload.error.code, "ROOM_DIRECTIVE_MISMATCH");

  const wrongNonce = await harness.checkpoint(started, {
    roomNonce: "nonce_reused",
    compactRoomProof: {
      roomDirectiveId: started.metaState.roomDirective.id,
      roomNonce: "nonce_reused",
      commands: [{ code: "move" }]
    },
    commands: [{ code: "move" }]
  }, "checkpoint-fixture-0002");
  assert.equal(wrongNonce.response.status, 409);
  assert.equal(wrongNonce.payload.error.code, "ROOM_NONCE_MISMATCH");
});
