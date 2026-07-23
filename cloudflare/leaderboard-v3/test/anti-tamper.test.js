import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeCheckpointToken,
  signCheckpointToken
} from "../src/security/checkpoint-token.js";
import { createHarness, TEST_SECRET } from "./fixtures/harness.js";

async function checkpointedHarness() {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const checkpointed = (await harness.checkpoint(started)).payload;
  return { harness, started, checkpointed };
}

test("anti-tamper fixture matrix", async (parent) => {
  await parent.test("1. client cannot set gold=10000", async () => {
    const harness = createHarness();
    const started = (await harness.start()).payload;
    const result = await harness.checkpoint(started, {
      gold: 10_000,
      clientSummary: { gold: 10_000 }
    });
    assert.equal(result.payload.metaState.gold, 10);
  });

  await parent.test("2. client cannot set depth=99", async () => {
    const harness = createHarness();
    const started = (await harness.start()).payload;
    const result = await harness.checkpoint(started, {
      depth: 99,
      clientSummary: { depth: 99 }
    });
    assert.equal(result.payload.metaState.depth, 1);
  });

  await parent.test("3. relic outside reward offer is rejected", async () => {
    const { harness, checkpointed } = await checkpointedHarness();
    const result = await harness.event(
      checkpointed,
      "relic_selected",
      { relicId: "unoffered_relic" }
    );
    assert.equal(result.payload.error.code, "RELIC_NOT_OFFERED");
  });

  await parent.test("4. mutator outside offer is rejected", async () => {
    const { harness, checkpointed } = await checkpointedHarness();
    const result = await harness.event(
      checkpointed,
      "mutator_selected",
      { mutatorId: "unoffered_mutator" }
    );
    assert.equal(result.payload.error.code, "MUTATOR_NOT_OFFERED");
  });

  await parent.test("5. merchant cost supplied as zero does not create a free purchase", async () => {
    const { harness, checkpointed } = await checkpointedHarness();
    const item = checkpointed.metaState.merchantInventory[0];
    const result = await harness.event(
      checkpointed,
      "merchant_purchase",
      { itemId: item.id, cost: 0 }
    );
    assert.equal(result.payload.metaState.gold, 3);
  });

  await parent.test("6. reward cannot be claimed twice", async () => {
    const { harness, checkpointed } = await checkpointedHarness();
    const first = (await harness.event(
      checkpointed,
      "relic_selected",
      { relicId: "fixture_ember" }
    )).payload;
    const second = await harness.event(
      first,
      "relic_selected",
      { relicId: "fixture_ember" },
      "event-reward-second-0001"
    );
    assert.equal(second.response.status, 409);
    assert.equal(second.payload.error.code, "REWARD_ALREADY_CLAIMED");
  });

  await parent.test("7. old token cannot mutate a newer revision", async () => {
    const { harness, started } = await checkpointedHarness();
    const result = await harness.event(
      started,
      "life_lost",
      {},
      "event-old-token-0001"
    );
    assert.equal(result.payload.error.code, "REVISION_CONFLICT");
  });

  await parent.test("8. old roomNonce cannot be reused", async () => {
    const { harness, started, checkpointed } = await checkpointedHarness();
    const result = await harness.event(
      checkpointed,
      "life_lost",
      {},
      "event-old-nonce-0001",
      { roomNonce: started.metaState.roomDirective.roomNonce }
    );
    assert.equal(result.payload.error.code, "ROOM_NONCE_MISMATCH");
  });

  await parent.test("9. roomDirectiveId substitution is rejected", async () => {
    const { harness, checkpointed } = await checkpointedHarness();
    const result = await harness.event(
      checkpointed,
      "life_lost",
      {},
      "event-wrong-directive-0001",
      { roomDirectiveId: "directive_substituted" }
    );
    assert.equal(result.payload.error.code, "ROOM_DIRECTIVE_MISMATCH");
  });

  await parent.test("10. client cannot force a special room", async () => {
    const harness = createHarness();
    const started = (await harness.start()).payload;
    const result = await harness.checkpoint(started, {
      roomType: "vault",
      clientSummary: { roomType: "vault" }
    });
    assert.equal(result.payload.metaState.roomDirective.roomType, "merchant");
    assert.notEqual(result.payload.metaState.roomDirective.roomType, "vault");
  });

  await parent.test("11. client-provided score is ignored", async () => {
    const { harness, checkpointed } = await checkpointedHarness();
    const result = await harness.finalize(checkpointed, "defeat", undefined, {
      score: 999_999
    });
    assert.equal(result.payload.score, 200);
  });

  await parent.test("12. duplicate finalize creates one leaderboard row", async () => {
    const harness = createHarness();
    const started = (await harness.start()).payload;
    await harness.finalize(started);
    const retry = await harness.finalize(started);
    assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
    assert.equal(harness.repositories.leaderboardCount(), 1);
  });

  await parent.test("13. duplicate checkpoint does not award twice", async () => {
    const harness = createHarness();
    const started = (await harness.start()).payload;
    await harness.checkpoint(started);
    const retry = await harness.checkpoint(started);
    assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
    assert.equal(harness.repositories.snapshotRun(started.runId).gold, 10);
  });

  await parent.test("14. duplicate purchase does not charge or grant twice", async () => {
    const { harness, checkpointed } = await checkpointedHarness();
    const item = checkpointed.metaState.merchantInventory[0];
    const first = await harness.event(
      checkpointed,
      "merchant_purchase",
      { itemId: item.id },
      "event-purchase-duplicate-0001"
    );
    const retry = await harness.event(
      checkpointed,
      "merchant_purchase",
      { itemId: item.id },
      "event-purchase-duplicate-0001"
    );
    assert.deepEqual(retry.payload, first.payload);
    assert.equal(harness.repositories.snapshotRun(checkpointed.runId).gold, 3);
  });

  await parent.test("15. stale revision returns REVISION_CONFLICT", async () => {
    const { harness, started } = await checkpointedHarness();
    const result = await harness.checkpoint(
      started,
      {},
      "checkpoint-stale-new-key-0001"
    );
    assert.equal(result.response.status, 409);
    assert.equal(result.payload.error.code, "REVISION_CONFLICT");
  });

  await parent.test("16. token from another run is rejected", async () => {
    const harness = createHarness();
    const first = (await harness.start({}, "start-first-run-0001")).payload;
    const second = (await harness.start({}, "start-second-run-0001")).payload;
    const result = await harness.event(
      second,
      "life_lost",
      {},
      "event-other-run-0001",
      { checkpointToken: first.checkpointToken }
    );
    assert.equal(result.response.status, 401);
    assert.equal(result.payload.error.code, "TOKEN_RUN_MISMATCH");
  });

  await parent.test("17. token from another season is rejected", async () => {
    const harness = createHarness();
    const started = (await harness.start()).payload;
    const decoded = decodeCheckpointToken(started.checkpointToken);
    const token = await signCheckpointToken(
      { ...decoded.payload, season: "other-season" },
      TEST_SECRET
    );
    const result = await harness.event(
      started,
      "life_lost",
      {},
      "event-other-season-0001",
      { checkpointToken: token }
    );
    assert.equal(result.response.status, 401);
    assert.equal(result.payload.error.code, "TOKEN_INVALID");
  });

  await parent.test("18. expired token is rejected", async () => {
    const harness = createHarness();
    const started = (await harness.start()).payload;
    harness.advanceTime(16 * 60 * 1000);
    const result = await harness.checkpoint(
      started,
      {},
      "checkpoint-expired-0001"
    );
    assert.equal(result.response.status, 401);
    assert.equal(result.payload.error.code, "TOKEN_EXPIRED");
  });

  await parent.test("19. invalid HMAC is rejected", async () => {
    const harness = createHarness();
    const started = (await harness.start()).payload;
    const [body, signature] = started.checkpointToken.split(".");
    const changed = signature.endsWith("A") ? "B" : "A";
    const result = await harness.event(
      started,
      "life_lost",
      {},
      "event-invalid-hmac-0001",
      { checkpointToken: `${body}.${signature.slice(0, -1)}${changed}` }
    );
    assert.equal(result.response.status, 401);
    assert.equal(result.payload.error.code, "TOKEN_INVALID");
  });

  await parent.test("20. idempotency key cannot be reused with another payload", async () => {
    const { harness, checkpointed } = await checkpointedHarness();
    await harness.event(
      checkpointed,
      "life_lost",
      {},
      "event-idem-reuse-0001"
    );
    const conflict = await harness.event(
      checkpointed,
      "extract",
      {},
      "event-idem-reuse-0001"
    );
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.payload.error.code, "IDEMPOTENCY_KEY_REUSED");
  });
});
