(function exposeRankedV3Offers(root, factory) {
  "use strict";
  const api = factory();
  if (root) root.DungeonRankedV3Offers = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createOfferModule() {
  "use strict";

  function safeText(value) {
    return typeof value === "string" ? value : "";
  }

  function metaChoices(offer) {
    if (!offer || !Array.isArray(offer.choices)) return [];
    return offer.choices.map((choice) => Object.freeze({
      choiceId: safeText(choice.choiceId),
      transactionId: safeText(choice.transactionId),
      label: safeText(choice.label) || safeText(choice.kind),
      description: [
        Number.isSafeInteger(choice.cost) ? `Cost: ${choice.cost}` : "",
        safeText(choice.currency),
        safeText(choice.description)
      ].filter(Boolean).join(" · "),
      disabled: choice.status !== "available"
    }));
  }

  function relicChoices(offer) {
    if (!offer || !Array.isArray(offer.publicChoices)) return [];
    return offer.publicChoices.map((choice) => Object.freeze({
      choiceId: safeText(choice.choiceId),
      relicId: safeText(choice.relicId),
      name: safeText(choice.name) || safeText(choice.relicId),
      description: safeText(choice.description),
      rarity: safeText(choice.rarity),
      currentStacks: Math.max(0, Number(choice.currentStacks) || 0),
      resultingStacks: Math.max(0, Number(choice.resultingStacks) || 0)
    }));
  }

  function replacementChoices(replacement) {
    if (!replacement || !Array.isArray(replacement.choices)) return [];
    return replacement.choices.map((choice) => Object.freeze({
      choiceId: safeText(choice.replacementChoiceId),
      replacementChoiceId: safeText(choice.replacementChoiceId),
      label: (choice.removals || []).map((removal) =>
        `${safeText(removal.relicId)} (${removal.currentStacks}→${removal.resultingStacks})`
      ).join(", "),
      description: `Slots ${Number(choice.resultingSlotsUsed) || 0}/${Number(choice.resultingSlotLimit) || 0}`
    }));
  }

  function pendingRewardSlots(publicState) {
    const slots = publicState?.currentRewardEnvelope?.rewardSlots;
    if (!Array.isArray(slots)) return [];
    return slots.filter((slot) =>
      !slot.consumed && (
        safeText(slot.slotType).includes("relic") ||
        safeText(slot.sourceType).includes("relic") ||
        ["warden", "otter", "arena"].some((source) => safeText(slot.sourceId).includes(source))
      )
    );
  }

  return Object.freeze({
    metaChoices,
    relicChoices,
    replacementChoices,
    pendingRewardSlots
  });
});
