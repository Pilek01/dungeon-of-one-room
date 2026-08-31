function nonNegativeSafeInteger(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(code);
  return value;
}

export function normalizeCampaignChronicleCarryV08(value) {
  const source = value === undefined ? {} : value;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError("CHRONICLE_CARRY_INVALID");
  }
  return {
    turns: nonNegativeSafeInteger(source.turns ?? 0, "CHRONICLE_CARRY_TURNS_INVALID"),
    wardensDefeated: nonNegativeSafeInteger(
      source.wardensDefeated ?? 0,
      "CHRONICLE_CARRY_WARDENS_INVALID"
    )
  };
}

export function deriveCampaignChronicleV08(state) {
  const enabled = Object.hasOwn(state?.campaign || {}, "chronicleCarry");
  const carry = normalizeCampaignChronicleCarryV08(
    enabled ? state.campaign.chronicleCarry : undefined
  );
  const extractedCarryAlreadyIncludesDescent = enabled && Boolean(state?.extraction) && (
    state?.status === "extraction" ||
    (state?.status === "finalized" && state?.outcome === "extract")
  );
  const activeTurns = extractedCarryAlreadyIncludesDescent
    ? 0
    : nonNegativeSafeInteger(
        state?.build?.resources?.turn ?? 0,
        "CHRONICLE_ACTIVE_TURNS_INVALID"
      );
  const activeWardens = extractedCarryAlreadyIncludesDescent
    ? 0
    : nonNegativeSafeInteger(
        (state?.statistics?.bossRoomsCompleted ?? 0) +
          (state?.statistics?.finalRoomsCompleted ?? 0),
        "CHRONICLE_ACTIVE_WARDENS_INVALID"
      );
  const turns = carry.turns + activeTurns;
  const wardensDefeated = carry.wardensDefeated + activeWardens;
  if (!Number.isSafeInteger(turns)) throw new TypeError("CHRONICLE_TURNS_OVERFLOW");
  if (!Number.isSafeInteger(wardensDefeated)) throw new TypeError("CHRONICLE_WARDENS_OVERFLOW");
  return { enabled, turns, wardensDefeated };
}

export function composeCampaignChronicleCarryV08(state) {
  const chronicle = deriveCampaignChronicleV08(state);
  if (!chronicle.enabled) return null;
  return {
    turns: chronicle.turns,
    wardensDefeated: chronicle.wardensDefeated
  };
}
