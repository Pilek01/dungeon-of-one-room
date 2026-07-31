import manifest from "./data/ruleset-manifest.json" with { type: "json" };

const COMPATIBLE_RULESET_HASHES = Object.freeze([
  manifest.rulesetHash,
  "sha256:e4175a6cb29f576a3ad85357a433d6595eb7e9d19a6c5f47ed125ecfe9ae538e",
  "sha256:31124ece34ef1c82a28bb977467d169eade8b34c0c13360d7054ab1684e5fe36",
  "sha256:956251f158e55a0a47f9e43d5680d9aae66a22045c833bd76b8798cdc00e012e",
  "sha256:08dfa4f97d91b4f21dbfae7232246125ddbbc6a0270cf81a9e1ed012e5f5d403",
  "sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6"
]);
const compatibleRulesetHashes = new Set(COMPATIBLE_RULESET_HASHES);

export function isCompatibleRulesetHashV08(value) {
  return compatibleRulesetHashes.has(String(value || ""));
}

export function requireCompatibleRulesetHashV08(value) {
  const hash = String(value || "");
  if (!isCompatibleRulesetHashV08(hash)) {
    throw new TypeError("RULESET_HASH_MISMATCH");
  }
  return hash;
}

export { COMPATIBLE_RULESET_HASHES };
