export const REWARD_POLICY_SPEC = Object.freeze({
  moduleFile: "reward-policy.js",
  authority: "SERVER_ISSUED",
  offerKinds: Object.freeze([
    "chest",
    "room-clear",
    "relic-draft",
    "boss-drop",
    "otter-reward"
  ]),
  selectionBinding: "runId+revision+roomDirectiveId+offerId",
  implementationStatus: "not-implemented"
});
