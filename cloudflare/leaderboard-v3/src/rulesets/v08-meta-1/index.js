import manifest from "./data/ruleset-manifest.json" with { type: "json" };
import { RULESET_ID, RULESET_STATUS } from "./constants.js";

export function createV08Meta1Ruleset() {
  throw new TypeError("RULESET_NOT_IMPLEMENTED:v08-meta-1");
}

export const V08_META_1_DESCRIPTOR = Object.freeze({
  rulesetId: RULESET_ID,
  rulesetHash: manifest.rulesetHash,
  status: RULESET_STATUS,
  createRuleset: createV08Meta1Ruleset
});

export { manifest as V08_META_1_MANIFEST };
