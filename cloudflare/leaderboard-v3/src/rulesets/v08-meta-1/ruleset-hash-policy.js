import manifest from "./data/ruleset-manifest.json" with { type: "json" };

const COMPATIBLE_RULESET_HASHES = Object.freeze([
  manifest.rulesetHash,
  "sha256:5c3df81af373b68fce4d8fa242fb61c29b7c3d4ca78d6865d2ee51a58bbab3dd",
  "sha256:87c30b2c011b5103398f9b03f6bf018d71f2a35427c0a04ef7a31b2559a7a6d9",
  "sha256:0672eb9aaae11865ebae75a4c6d6dc77cc29f4a079afe562355172d26f073bca",
  "sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711",
  "sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3",
  "sha256:7027a84ff06d6d9304e3d8e4343dbd6b3071c8bec734fad10b85981fa92347e8",
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
