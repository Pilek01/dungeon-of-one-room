import { RULESET_RELEASE_STATES } from "./registry.js";
import {
  V08_META_1_DESCRIPTOR,
  createV08Meta1Ruleset
} from "./v08-meta-1/index.js";

export const V08_META_1_LOCAL_RELEASE_DESCRIPTOR = Object.freeze({
  ...V08_META_1_DESCRIPTOR,
  status: RULESET_RELEASE_STATES.LOCAL_RELEASE_CANDIDATE,
  allowedEnvironments: Object.freeze(["test", "local"])
});

export const V08_META_1_PREVIOUS_PRODUCTION_RULESET_HASH =
  "sha256:08dfa4f97d91b4f21dbfae7232246125ddbbc6a0270cf81a9e1ed012e5f5d403";

export const V08_META_1_LEGACY_PRODUCTION_RULESET_HASH =
  "sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6";

export const V08_META_1_LEGACY_PRODUCTION_RELEASE_DESCRIPTOR = Object.freeze({
  ...V08_META_1_DESCRIPTOR,
  rulesetHash: V08_META_1_LEGACY_PRODUCTION_RULESET_HASH,
  status: RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  allowedEnvironments: Object.freeze(["test", "local", "production"]),
  createRuleset: () => createV08Meta1Ruleset({
    rulesetHash: V08_META_1_LEGACY_PRODUCTION_RULESET_HASH
  })
});

export const V08_META_1_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR = Object.freeze({
  ...V08_META_1_DESCRIPTOR,
  rulesetHash: V08_META_1_PREVIOUS_PRODUCTION_RULESET_HASH,
  status: RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  allowedEnvironments: Object.freeze(["test", "local", "production"]),
  createRuleset: () => createV08Meta1Ruleset({
    rulesetHash: V08_META_1_PREVIOUS_PRODUCTION_RULESET_HASH
  })
});

export const V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR = Object.freeze({
  ...V08_META_1_DESCRIPTOR,
  status: RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  allowedEnvironments: Object.freeze(["test", "local", "production"])
});
