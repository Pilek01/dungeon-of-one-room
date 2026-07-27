import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const offers = require("../../../online-v3/ranked-v3-offers.js");

test("M4 shared meta adapter renders only canonical projected cost and IDs", () => {
  const result = offers.metaChoices({
    choices: [{
      transactionId: "tx_opaque",
      choiceId: "choice_opaque",
      kind: "merchant_relic",
      label: "<b>Server label</b>",
      status: "available",
      cost: 12,
      currency: "run_gold",
      privatePrice: 1
    }]
  });
  assert.deepEqual(result, [{
    transactionId: "tx_opaque",
    choiceId: "choice_opaque",
    label: "<b>Server label</b>",
    description: "Cost: 12 · run_gold",
    disabled: false
  }]);
  assert.equal(Object.hasOwn(result[0], "privatePrice"), false);
});

test("M4 relic and replacement adapters keep opaque choices and public stack data", () => {
  assert.deepEqual(offers.relicChoices({
    publicChoices: [{
      choiceId: "relic_choice",
      relicId: "idol",
      name: "Golden Idol",
      description: "Gold.",
      rarity: "rare",
      currentStacks: 1,
      resultingStacks: 2
    }]
  })[0], {
    choiceId: "relic_choice",
    relicId: "idol",
    name: "Golden Idol",
    description: "Gold.",
    rarity: "rare",
    currentStacks: 1,
    resultingStacks: 2
  });
  const replacement = offers.replacementChoices({
    choices: [{
      replacementChoiceId: "replace_opaque",
      removals: [{ relicId: "old", currentStacks: 2, resultingStacks: 1 }],
      resultingSlotsUsed: 8,
      resultingSlotLimit: 8
    }]
  })[0];
  assert.equal(replacement.choiceId, "replace_opaque");
  assert.match(replacement.label, /old \(2→1\)/u);
});

test("M4 reward-slot adapter recognizes Warden, Otter and Arena without inventing rewards", () => {
  const pending = offers.pendingRewardSlots({
    currentRewardEnvelope: {
      rewardSlots: [
        { slotId: "w", sourceId: "warden-relic", consumed: false },
        { slotId: "o", sourceId: "otter-cache", consumed: false },
        { slotId: "a", sourceId: "arena-reward-cache", consumed: false },
        { slotId: "gold", sourceId: "gold", slotType: "chest", consumed: false },
        { slotId: "done", sourceId: "warden", consumed: true }
      ]
    }
  });
  assert.deepEqual(pending.map((slot) => slot.slotId), ["w", "o", "a"]);
});

test("M4 UI adapters preserve text as text instead of producing HTML", () => {
  const choice = offers.metaChoices({
    choices: [{
      transactionId: "tx",
      choiceId: "choice",
      label: "<img src=x onerror=alert(1)>",
      status: "available"
    }]
  })[0];
  assert.equal(choice.label, "<img src=x onerror=alert(1)>");
  assert.equal(choice.label.includes("&lt;"), false);
});
