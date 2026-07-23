export const PACT_POLICY_SPEC = Object.freeze({
  moduleFile: "pact-policy.js",
  authority: "SERVER_ISSUED",
  actions: Object.freeze(["select", "replace", "break", "leave"]),
  maximumActive: 1,
  implementationStatus: "not-implemented"
});
