export const GOLD_POLICY_SPEC = Object.freeze({
  moduleFile: "gold-policy.js",
  recommendedModel: "room-manifest-with-bounded-combat-attestation",
  authority: Object.freeze({
    deterministicTransactions: "SERVER_DERIVED",
    issuedRoomRewards: "SERVER_ISSUED",
    combatKillCounts: "BOUNDED_CLIENT_ATTESTED",
    hitOrCritTriggeredGold: "HEURISTIC_ONLY"
  }),
  implementationStatus: "not-implemented"
});
