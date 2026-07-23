export const MERCHANT_POLICY_SPEC = Object.freeze({
  moduleFile: "merchant-policy.js",
  authority: "SERVER_ISSUED",
  inventoryKinds: Object.freeze([
    "relic",
    "service",
    "skill-upgrade",
    "reserved-relic",
    "buyback",
    "black-market"
  ]),
  invalidation: "accepted purchase, room transition, run finalization, or newer revision",
  implementationStatus: "not-implemented"
});
