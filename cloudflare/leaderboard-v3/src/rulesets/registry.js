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
  return Object.freeze({ ...descriptor });
}

export function createRulesetRegistry(descriptors = []) {
  const byHash = new Map();

  for (const input of descriptors) {
    const descriptor = requireDescriptor(input);
    if (byHash.has(descriptor.rulesetHash)) {
      throw new TypeError(`RULESET_HASH_DUPLICATE:${descriptor.rulesetHash}`);
    }
    byHash.set(descriptor.rulesetHash, descriptor);
  }

  return Object.freeze({
    describe(rulesetHash) {
      return byHash.get(String(rulesetHash || "")) || null;
    },

    resolve(rulesetHash) {
      const hash = String(rulesetHash || "");
      if (!hash) throw new TypeError("RULESET_HASH_REQUIRED");
      const descriptor = byHash.get(hash);
      if (!descriptor) throw new TypeError("RULESET_HASH_UNSUPPORTED");
      if (descriptor.status !== "supported") {
        throw new TypeError(`RULESET_NOT_ACTIVE:${descriptor.status}`);
      }
      return descriptor.createRuleset();
    },

    list() {
      return Array.from(byHash.values());
    }
  });
}
