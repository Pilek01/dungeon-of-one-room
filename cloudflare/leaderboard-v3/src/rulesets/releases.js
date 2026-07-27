import { RULESET_RELEASE_STATES } from "./registry.js";
import { V08_META_1_DESCRIPTOR } from "./v08-meta-1/index.js";

export const V08_META_1_LOCAL_RELEASE_DESCRIPTOR = Object.freeze({
  ...V08_META_1_DESCRIPTOR,
  status: RULESET_RELEASE_STATES.LOCAL_RELEASE_CANDIDATE,
  allowedEnvironments: Object.freeze(["test", "local"])
});

export const V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR = Object.freeze({
  ...V08_META_1_DESCRIPTOR,
  status: RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  allowedEnvironments: Object.freeze(["test", "local", "production"])
});
