export const RULESET_RELEASE_STATES = Object.freeze({
  FIXTURE_TEST: "fixture-test",
  TEST_ONLY: "test-only",
  LOCAL_RELEASE_CANDIDATE: "local-release-candidate",
  PRODUCTION_RELEASED: "production-released",
  DEPRECATED: "deprecated"
});

const RELEASE_STATES = new Set(Object.values(RULESET_RELEASE_STATES));
const ENVIRONMENTS = new Set(["test", "local", "production"]);

function requireDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object") {
    throw new TypeError("RULESET_DESCRIPTOR_INVALID");
  }
  for (const field of ["rulesetId", "rulesetHash", "status"]) {
    if (typeof descriptor[field] !== "string" || !descriptor[field]) {
      throw new TypeError(`RULESET_DESCRIPTOR_INVALID:${field}`);
    }
  }
  if (typeof descriptor.createRuleset !== "function") {
    throw new TypeError("RULESET_DESCRIPTOR_INVALID:createRuleset");
  }
  if (!RELEASE_STATES.has(descriptor.status)) {
    throw new TypeError("RULESET_DESCRIPTOR_INVALID:status");
  }
  const allowedEnvironments = Array.isArray(descriptor.allowedEnvironments)
    ? [...new Set(descriptor.allowedEnvironments)]
    : descriptor.status === RULESET_RELEASE_STATES.PRODUCTION_RELEASED
      ? ["test", "local", "production"]
      : descriptor.status === RULESET_RELEASE_STATES.LOCAL_RELEASE_CANDIDATE
        ? ["test", "local"]
        : ["test"];
  if (
    allowedEnvironments.length === 0 ||
    allowedEnvironments.some((environment) => !ENVIRONMENTS.has(environment))
  ) {
    throw new TypeError("RULESET_DESCRIPTOR_INVALID:allowedEnvironments");
  }
  return Object.freeze({
    ...descriptor,
    allowedEnvironments: Object.freeze(allowedEnvironments)
  });
}

export function createRulesetRegistry(descriptors = []) {
  const byHash = new Map();
  const byId = new Map();

  for (const input of descriptors) {
    const descriptor = requireDescriptor(input);
    if (byHash.has(descriptor.rulesetHash)) {
      throw new TypeError(`RULESET_HASH_DUPLICATE:${descriptor.rulesetHash}`);
    }
    byHash.set(descriptor.rulesetHash, descriptor);
    const versions = byId.get(descriptor.rulesetId) || [];
    versions.push(descriptor);
    byId.set(descriptor.rulesetId, versions);
  }

  function resolutionRequest(input, legacyOptions = {}) {
    if (typeof input === "string") {
      const descriptor = byHash.get(input);
      return {
        rulesetId: descriptor?.rulesetId || "",
        rulesetHash: input,
        environment: legacyOptions.environment || "test",
        lifecycle: legacyOptions.lifecycle || "fixture"
      };
    }
    if (!input || typeof input !== "object") {
      throw new TypeError("RULESET_RESOLUTION_INVALID");
    }
    return {
      rulesetId: String(input.rulesetId || ""),
      rulesetHash: String(input.rulesetHash || ""),
      environment: String(input.environment || ""),
      lifecycle: String(input.lifecycle || "ranked")
    };
  }

  return Object.freeze({
    describe(input) {
      if (typeof input === "string") {
        return byHash.get(input) || null;
      }
      const request = resolutionRequest(input);
      const descriptor = byHash.get(request.rulesetHash);
      if (!descriptor || descriptor.rulesetId !== request.rulesetId) return null;
      return descriptor;
    },

    resolve(input, legacyOptions = {}) {
      const request = resolutionRequest(input, legacyOptions);
      if (!request.rulesetHash) throw new TypeError("RULESET_HASH_REQUIRED");
      const descriptor = byHash.get(request.rulesetHash);
      if (!descriptor) throw new TypeError("RULESET_HASH_UNSUPPORTED");
      if (!request.rulesetId) throw new TypeError("RULESET_ID_REQUIRED");
      if (!ENVIRONMENTS.has(request.environment)) {
        throw new TypeError("RULESET_ENVIRONMENT_INVALID");
      }
      if (!byId.has(request.rulesetId)) {
        throw new TypeError("RULESET_ID_UNSUPPORTED");
      }
      if (descriptor.rulesetId !== request.rulesetId) {
        throw new TypeError("RULESET_ID_HASH_MISMATCH");
      }
      if (descriptor.status === RULESET_RELEASE_STATES.DEPRECATED) {
        throw new TypeError("RULESET_DEPRECATED");
      }
      if (descriptor.status === RULESET_RELEASE_STATES.TEST_ONLY) {
        throw new TypeError(`RULESET_NOT_RELEASED:${descriptor.status}`);
      }
      if (
        descriptor.status === RULESET_RELEASE_STATES.FIXTURE_TEST &&
        request.lifecycle !== "fixture"
      ) {
        throw new TypeError("FIXTURE_RULESET_RANKED_FORBIDDEN");
      }
      if (!descriptor.allowedEnvironments.includes(request.environment)) {
        if (request.environment === "production") {
          throw new TypeError("RULESET_PRODUCTION_UNAVAILABLE");
        }
        throw new TypeError(`RULESET_NOT_RELEASED:${descriptor.status}`);
      }
      return descriptor.createRuleset();
    },

    list() {
      return Array.from(byHash.values());
    }
  });
}
