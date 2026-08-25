import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  V08_META_1_LOCAL_RELEASE_DESCRIPTOR,
  V08_META_1_POTION_MERCHANT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR
} from "../src/rulesets/releases.js";
import { COMPATIBLE_RULESET_HASHES } from "../src/rulesets/v08-meta-1/ruleset-hash-policy.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const require = createRequire(import.meta.url);
const protocol = require("../../../online-v3/ranked-v3-protocol.js");
const PREVIOUS_PRODUCTION_HASH =
  "sha256:bf17a65dc721066bf11a1c34063cc18254fe97766852827719eb6aabf36042fa";

test("bounded combat resources activate only on the new ruleset hash", () => {
  assert.equal(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash, manifest.rulesetHash);
  assert.equal(V08_META_1_LOCAL_RELEASE_DESCRIPTOR.rulesetHash, manifest.rulesetHash);
  assert.equal(
    V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities.boundedCombatResources,
    "v1"
  );
  assert.equal(
    V08_META_1_LOCAL_RELEASE_DESCRIPTOR.capabilities.boundedCombatResources,
    "v1"
  );
  assert.equal(
    V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities.canonicalPotionResources,
    "v1"
  );
  assert.equal(
    V08_META_1_LOCAL_RELEASE_DESCRIPTOR.capabilities.canonicalPotionResources,
    "v1"
  );

  const previous = V08_META_1_POTION_MERCHANT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;
  assert.equal(previous.rulesetHash, PREVIOUS_PRODUCTION_HASH);
  assert.equal(previous.capabilities.earlyBalanceOtterRepair, "v1");
  assert.equal(previous.capabilities.canonicalPotionResources, undefined);
  assert.equal(previous.capabilities.boundedCombatResources, undefined);

  assert.ok(COMPATIBLE_RULESET_HASHES.includes(manifest.rulesetHash));
  assert.ok(COMPATIBLE_RULESET_HASHES.includes(PREVIOUS_PRODUCTION_HASH));
  assert.equal(protocol.RULESET_HASH, manifest.rulesetHash);
  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_PRODUCTION_HASH));
  assert.deepEqual(protocol.BOUNDED_COMBAT_RESOURCES_RULESET_HASHES, [manifest.rulesetHash]);
  assert.equal(protocol.supportsBoundedCombatResources(manifest.rulesetHash), true);
  assert.equal(protocol.supportsBoundedCombatResources(PREVIOUS_PRODUCTION_HASH), false);
});
