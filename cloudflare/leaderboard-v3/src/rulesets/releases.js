import { RULESET_RELEASE_STATES } from "./registry.js";
import {
  V08_META_1_DESCRIPTOR,
  createV08Meta1Ruleset
} from "./v08-meta-1/index.js";
import { normalizeFatalPresentationCauseV08 } from "./v08-meta-1/life-policy.js";

const LEGACY_FATAL_CAPABILITIES = Object.freeze({
  fatalPresentationCauseMode: "strip"
});
const CURRENT_FATAL_CAPABILITIES = Object.freeze({
  fatalPresentationCauseMode: "retain"
});
const LOCAL_ENVIRONMENTS = Object.freeze(["test", "local"]);
const PRODUCTION_ENVIRONMENTS = Object.freeze(["test", "local", "production"]);

function compatibleFatalRequest(request, capabilities) {
  if (
    !request ||
    typeof request !== "object" ||
    !Object.hasOwn(request, "presentationCause")
  ) return request;
  const presentationCause = normalizeFatalPresentationCauseV08(request);
  if (capabilities.fatalPresentationCauseMode === "retain") {
    return { ...request, presentationCause };
  }
  const legacyRequest = { ...request };
  delete legacyRequest.presentationCause;
  return legacyRequest;
}

function createCapabilityBoundRuleset(rulesetHash, capabilities) {
  const ruleset = createV08Meta1Ruleset({ rulesetHash });
  return Object.freeze({
    ...ruleset,
    capabilities,
    async reportFatalEvent(state, request, context = {}) {
      return ruleset.reportFatalEvent(
        state,
        compatibleFatalRequest(request, capabilities),
        context
      );
    }
  });
}

function createReleaseDescriptor(rulesetHash, status, allowedEnvironments, capabilities) {
  return Object.freeze({
    ...V08_META_1_DESCRIPTOR,
    rulesetHash,
    status,
    allowedEnvironments,
    capabilities,
    createRuleset: () => createCapabilityBoundRuleset(rulesetHash, capabilities)
  });
}

export const V08_META_1_LOCAL_RELEASE_DESCRIPTOR = createReleaseDescriptor(
  V08_META_1_DESCRIPTOR.rulesetHash,
  RULESET_RELEASE_STATES.LOCAL_RELEASE_CANDIDATE,
  LOCAL_ENVIRONMENTS,
  CURRENT_FATAL_CAPABILITIES
);

export const V08_META_1_PRODUCTION_RULESET_HASH =
  "sha256:0672eb9aaae11865ebae75a4c6d6dc77cc29f4a079afe562355172d26f073bca";

export const V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RULESET_HASH =
  "sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711";

export const V08_META_1_BOUNDARY_PREVIOUS_PRODUCTION_RULESET_HASH =
  "sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3";

export const V08_META_1_HD_BOOT_PREVIOUS_PRODUCTION_RULESET_HASH =
  "sha256:7027a84ff06d6d9304e3d8e4343dbd6b3071c8bec734fad10b85981fa92347e8";

export const V08_META_1_SCORE_CARRY_PREVIOUS_PRODUCTION_RULESET_HASH =
  "sha256:e4175a6cb29f576a3ad85357a433d6595eb7e9d19a6c5f47ed125ecfe9ae538e";

export const V08_META_1_R2_PRODUCTION_RULESET_HASH =
  "sha256:956251f158e55a0a47f9e43d5680d9aae66a22045c833bd76b8798cdc00e012e";

export const V08_META_1_WARDEN_HOTFIX_RULESET_HASH =
  "sha256:31124ece34ef1c82a28bb977467d169eade8b34c0c13360d7054ab1684e5fe36";

export const V08_META_1_PREVIOUS_PRODUCTION_RULESET_HASH =
  "sha256:08dfa4f97d91b4f21dbfae7232246125ddbbc6a0270cf81a9e1ed012e5f5d403";

export const V08_META_1_LEGACY_PRODUCTION_RULESET_HASH =
  "sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6";

export const V08_META_1_LEGACY_PRODUCTION_RELEASE_DESCRIPTOR = createReleaseDescriptor(
  V08_META_1_LEGACY_PRODUCTION_RULESET_HASH,
  RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  PRODUCTION_ENVIRONMENTS,
  LEGACY_FATAL_CAPABILITIES
);

export const V08_META_1_R2_PRODUCTION_RELEASE_DESCRIPTOR = createReleaseDescriptor(
  V08_META_1_R2_PRODUCTION_RULESET_HASH,
  RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  PRODUCTION_ENVIRONMENTS,
  LEGACY_FATAL_CAPABILITIES
);

export const V08_META_1_WARDEN_HOTFIX_RELEASE_DESCRIPTOR = createReleaseDescriptor(
  V08_META_1_WARDEN_HOTFIX_RULESET_HASH,
  RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  PRODUCTION_ENVIRONMENTS,
  LEGACY_FATAL_CAPABILITIES
);

export const V08_META_1_SCORE_CARRY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR = createReleaseDescriptor(
  V08_META_1_SCORE_CARRY_PREVIOUS_PRODUCTION_RULESET_HASH,
  RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  PRODUCTION_ENVIRONMENTS,
  LEGACY_FATAL_CAPABILITIES
);

export const V08_META_1_HD_BOOT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR = createReleaseDescriptor(
  V08_META_1_HD_BOOT_PREVIOUS_PRODUCTION_RULESET_HASH,
  RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  PRODUCTION_ENVIRONMENTS,
  LEGACY_FATAL_CAPABILITIES
);

export const V08_META_1_BOUNDARY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR = createReleaseDescriptor(
  V08_META_1_BOUNDARY_PREVIOUS_PRODUCTION_RULESET_HASH,
  RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  PRODUCTION_ENVIRONMENTS,
  LEGACY_FATAL_CAPABILITIES
);

export const V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR = createReleaseDescriptor(
  V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RULESET_HASH,
  RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  PRODUCTION_ENVIRONMENTS,
  LEGACY_FATAL_CAPABILITIES
);

export const V08_META_1_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR = createReleaseDescriptor(
  V08_META_1_PREVIOUS_PRODUCTION_RULESET_HASH,
  RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  PRODUCTION_ENVIRONMENTS,
  LEGACY_FATAL_CAPABILITIES
);

export const V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR = createReleaseDescriptor(
  V08_META_1_PRODUCTION_RULESET_HASH,
  RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  PRODUCTION_ENVIRONMENTS,
  CURRENT_FATAL_CAPABILITIES
);
