import manifest from "./data/ruleset-manifest.json" with { type: "json" };

const COMPATIBLE_RULESET_HASHES = Object.freeze([
  manifest.rulesetHash,
  "sha256:5ba35a1c03cf160787c553d55782ddb1ec4612a9a08f2dc26da562feeccc73c2",
  "sha256:78ae2f6f797063b7f364e5652e3367f6b26d651302f5c6038576d304dc442ec3",
  "sha256:25dbdb962a478b3a46375ad5b25a3603041edd95ff45b51e2846b13ce7ea2989",
  "sha256:9d6069993fd07784ecfdc146825a8a7b82cde1fd7412f351aeba1ab86c539dbe",
  "sha256:48b5bd86604a5f8dae58a4dcf2b1ed9a72252b3e4942fc20693b3e0a8e91438e",
  "sha256:bf17a65dc721066bf11a1c34063cc18254fe97766852827719eb6aabf36042fa",
  "sha256:91065f3c515fbc2f996ba74a9fbbcab3d2ce013077af306afd51929e64e1af59",
  "sha256:5bf4a0fbf2583b9b59ae050eebdd324bc09038b3aed6d2090cb3a4e5481f79eb",
  "sha256:51a86cf41299257475530a356b98381ac828fdb0ec22e77eff0ded99f1758617",
  "sha256:0a922d5567e7cfba56644e915ac0e331ac74aa3fcc3a2aed478440d64e9878f7",
  "sha256:35707f6b5ea8b1ad18251dce5e6c18b87653893aad705b6c5543fdd140b88067",
  "sha256:76514cf9e5c89079571a5be117ce84f949d7a3f5ed441d973adc05c95c6dde3c",
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
