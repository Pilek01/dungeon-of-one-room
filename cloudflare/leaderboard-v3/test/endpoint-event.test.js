import test from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./fixtures/harness.js";

test("POST /api/v3/runs/event applies only fixture-ruleset offers", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const checkpointed = (await harness.checkpoint(started)).payload;
  const selected = await harness.event(
    checkpointed,
    "relic_selected",
    { relicId: "fixture_ember" }
  );
  assert.equal(selected.response.status, 200);
  assert.deepEqual(selected.payload.metaState.build.relics, [
    { id: "fixture_ember", stacks: 1 }
  ]);
  assert.equal(selected.payload.metaState.rewardOffer, null);

  const rejectionHarness = createHarness();
  const rejectionStarted = (await rejectionHarness.start()).payload;
  const rejectionCheckpointed = (
    await rejectionHarness.checkpoint(rejectionStarted)
  ).payload;
  const unoffered = await rejectionHarness.event(
    rejectionCheckpointed,
    "relic_selected",
    { relicId: "client_injected" },
    "event-fixture-0002"
  );
  assert.equal(unoffered.response.status, 422);
  assert.equal(unoffered.payload.error.code, "RELIC_NOT_OFFERED");
});

test("merchant purchase uses authoritative inventory and gold", async () => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const checkpointed = (await harness.checkpoint(started)).payload;
  const item = checkpointed.metaState.merchantInventory[0];
  const purchase = await harness.event(
    checkpointed,
    "merchant_purchase",
    { itemId: item.id, cost: 0 }
  );
  assert.equal(purchase.response.status, 200);
  assert.equal(purchase.payload.metaState.gold, 3);
  assert.deepEqual(purchase.payload.metaState.merchantInventory, []);
});
