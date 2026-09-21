import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as releases from "../src/rulesets/releases.js";
import { isCompatibleRulesetHashV08 } from "../src/rulesets/v08-meta-1/ruleset-hash-policy.js";
const protocol = createRequire(import.meta.url)("../../../online-v3/ranked-v3-protocol.js");

test("checkpoint-result candidate retains the deployed hash with unchanged capabilities", () => {
  const previous = releases.V08_META_1_CHECKPOINT_RESULT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;
  const old = "sha256:f3101eee949400ce36eb65ebe4ccf211125960d4e5223855e451693d55bd1f2b";
  assert.equal(previous?.rulesetHash, old);
  const { respawnPotionResources, ...unchanged } = releases.V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities;
  assert.equal(respawnPotionResources, "v1");
  assert.deepEqual(previous.capabilities, unchanged);
  assert(isCompatibleRulesetHashV08(old));
  assert.equal(protocol.RULESET_HASH, releases.V08_META_1_PRODUCTION_RULESET_HASH);
  for (const [name, values] of Object.entries(protocol)) {
    if (name.endsWith("RULESET_HASHES") && Array.isArray(values) && values.includes(protocol.RULESET_HASH)) {
      assert(values.includes(old), name);
    }
  }
});
