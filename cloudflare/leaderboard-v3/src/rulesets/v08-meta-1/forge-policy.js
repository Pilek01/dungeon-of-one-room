export const FORGE_POLICY_SPEC = Object.freeze({
  moduleFile: "forge-policy.js",
  authority: "SERVER_ISSUED",
  actions: Object.freeze(["temper", "transmute"]),
  offerBinding: "runId+revision+roomDirectiveId+offerId+sacrificeId",
  implementationStatus: "not-implemented"
});
