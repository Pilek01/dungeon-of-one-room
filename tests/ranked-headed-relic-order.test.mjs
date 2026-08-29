import assert from "node:assert/strict";
import test from "node:test";

import {
  getCanonicalRelicReplacementKey,
  shouldDismissCampGuide,
  triggerCheckpointWithRetry,
  triggerPortalWithRetry
} from "../scripts/ranked-headed-relic-order.mjs";

test("Forge replacement keys use the expanded local relic order", () => {
  const replacement = getCanonicalRelicReplacementKey({
    build: {
      relics: [
        { relicId: "fang", stacks: 2 },
        { relicId: "idol", stacks: 1 }
      ]
    },
    metaTransactionOffer: {
      choices: [
        { removals: [{ relicId: "idol" }] }
      ]
    }
  });

  assert.deepEqual(replacement, { relicId: "idol", key: "3" });
});

test("Forge replacement maps the tenth expanded relic slot to zero", () => {
  const replacement = getCanonicalRelicReplacementKey({
    build: {
      relics: [
        { relicId: "fang", stacks: 9 },
        { relicId: "idol", stacks: 1 }
      ]
    },
    metaTransactionOffer: {
      choices: [
        { removals: [{ relicId: "idol" }] }
      ]
    }
  });

  assert.deepEqual(replacement, { relicId: "idol", key: "0" });
});

test("Camp QA dismisses an opened guide even when the Camp DOM was already mounted", () => {
  assert.equal(shouldDismissCampGuide({
    nativeCamp: true,
    game: { overlayText: "Camp Guide\nPrepare for the next descent." }
  }), true);
});

test("Camp QA retries checkpoint input when the first key press is consumed", async () => {
  let triggerCount = 0;
  let markCheckpointStarted;
  const checkpointStarted = new Promise((resolve) => {
    markCheckpointStarted = resolve;
  });

  const successfulAttempt = await triggerCheckpointWithRetry({
    checkpointStarted,
    timeoutMs: 5,
    trigger() {
      triggerCount += 1;
      if (triggerCount === 2) markCheckpointStarted();
    }
  });

  assert.equal(successfulAttempt, 2);
  assert.equal(triggerCount, 2);
});

test("checkpoint retry reports the named QA action when all attempts are consumed", async () => {
  await assert.rejects(
    triggerCheckpointWithRetry({
      trigger() {},
      checkpointStarted: new Promise(() => {}),
      timeoutMs: 1,
      attempts: 1,
      failureLabel: "Ranked F9 assistance request"
    }),
    /Ranked F9 assistance request did not start after 1 attempts/u
  );
});

test("Ranked QA retries portal entry while a Merchant boundary is still busy", async () => {
  let triggerCount = 0;

  const successfulAttempt = await triggerPortalWithRetry({
    trigger() {
      triggerCount += 1;
    },
    waitForProgress() {
      if (triggerCount < 2) throw new Error("boundary still busy");
    }
  });

  assert.equal(successfulAttempt, 2);
  assert.equal(triggerCount, 2);
});
