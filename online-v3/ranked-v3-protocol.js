(function exposeRankedV3Protocol(root, factory) {
  "use strict";

  const api = factory();
  if (root) root.DungeonRankedV3Protocol = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createProtocolModule() {
  "use strict";

  const PROTOCOL_VERSION = "ranked-v3-checkpoint-1";
  const RULESET_ID = "v08-meta-1";
  const RULESET_HASH = "sha256:1b3103342a34e570842c73cd4454c9b2e5fa9b7895aac5835d18d4f1ee95b89b";
  const CHRONICLE_PREVIOUS_RULESET_HASH = "sha256:9e6dfc472f9eb0ffd773e42f80cd3ecf7b579a1d76766affdb72417086016b7f";
  const AEGIS_PORTAL_PREVIOUS_RULESET_HASH = "sha256:91843a42a08ca6213e664cc0607e511fbd2c89f2bbfd749b45c0244924da067f";
  const PORTAL_CLEAR_PREVIOUS_RULESET_HASH = "sha256:5ba35a1c03cf160787c553d55782ddb1ec4612a9a08f2dc26da562feeccc73c2";
  const GOLD_PARITY_PREVIOUS_RULESET_HASH = "sha256:78ae2f6f797063b7f364e5652e3367f6b26d651302f5c6038576d304dc442ec3";
  const MAP_FRAGMENT_DEPTH_PREVIOUS_RULESET_HASH = "sha256:25dbdb962a478b3a46375ad5b25a3603041edd95ff45b51e2846b13ce7ea2989";
  const PREVIOUS_RULESET_HASH = "sha256:9d6069993fd07784ecfdc146825a8a7b82cde1fd7412f351aeba1ab86c539dbe";
  const CHEST_HP_PREVIOUS_RULESET_HASH = "sha256:48b5bd86604a5f8dae58a4dcf2b1ed9a72252b3e4942fc20693b3e0a8e91438e";
  const SUPPORTED_RULESET_HASHES = Object.freeze([
    RULESET_HASH,
    CHRONICLE_PREVIOUS_RULESET_HASH,
    AEGIS_PORTAL_PREVIOUS_RULESET_HASH,
    PORTAL_CLEAR_PREVIOUS_RULESET_HASH,
    GOLD_PARITY_PREVIOUS_RULESET_HASH,
    MAP_FRAGMENT_DEPTH_PREVIOUS_RULESET_HASH,
    PREVIOUS_RULESET_HASH,
    CHEST_HP_PREVIOUS_RULESET_HASH,
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
  const supportedRulesetHashes = new Set(SUPPORTED_RULESET_HASHES);
  const LEGACY_FATAL_PRESENTATION_CAUSE_RULESET_HASHES = Object.freeze([
    "sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711",
    "sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3",
    "sha256:7027a84ff06d6d9304e3d8e4343dbd6b3071c8bec734fad10b85981fa92347e8",
    "sha256:e4175a6cb29f576a3ad85357a433d6595eb7e9d19a6c5f47ed125ecfe9ae538e",
    "sha256:31124ece34ef1c82a28bb977467d169eade8b34c0c13360d7054ab1684e5fe36",
    "sha256:956251f158e55a0a47f9e43d5680d9aae66a22045c833bd76b8798cdc00e012e",
    "sha256:08dfa4f97d91b4f21dbfae7232246125ddbbc6a0270cf81a9e1ed012e5f5d403",
    "sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6"
  ]);
  const legacyFatalPresentationCauseRulesetHashes = new Set(LEGACY_FATAL_PRESENTATION_CAUSE_RULESET_HASHES);
  const FATAL_PRESENTATION_CAUSE_RULESET_HASHES = Object.freeze([
    RULESET_HASH,
    CHRONICLE_PREVIOUS_RULESET_HASH,
    AEGIS_PORTAL_PREVIOUS_RULESET_HASH,
    PORTAL_CLEAR_PREVIOUS_RULESET_HASH,
    GOLD_PARITY_PREVIOUS_RULESET_HASH,
    MAP_FRAGMENT_DEPTH_PREVIOUS_RULESET_HASH,
    PREVIOUS_RULESET_HASH,
    CHEST_HP_PREVIOUS_RULESET_HASH,
    "sha256:bf17a65dc721066bf11a1c34063cc18254fe97766852827719eb6aabf36042fa",
    "sha256:91065f3c515fbc2f996ba74a9fbbcab3d2ce013077af306afd51929e64e1af59",
    "sha256:5bf4a0fbf2583b9b59ae050eebdd324bc09038b3aed6d2090cb3a4e5481f79eb",
    "sha256:51a86cf41299257475530a356b98381ac828fdb0ec22e77eff0ded99f1758617",
    "sha256:0a922d5567e7cfba56644e915ac0e331ac74aa3fcc3a2aed478440d64e9878f7",
    "sha256:35707f6b5ea8b1ad18251dce5e6c18b87653893aad705b6c5543fdd140b88067",
    "sha256:76514cf9e5c89079571a5be117ce84f949d7a3f5ed441d973adc05c95c6dde3c",
    "sha256:87c30b2c011b5103398f9b03f6bf018d71f2a35427c0a04ef7a31b2559a7a6d9",
    "sha256:3f6044453414e636c6a41f40ceaf00dc221624ea54af2f61489b930b27c628e3"
  ]);
  const fatalPresentationCauseRulesetHashes = new Set(FATAL_PRESENTATION_CAUSE_RULESET_HASHES);
  const BOUNDARY_SETTLEMENT_RULESET_HASHES = Object.freeze([
    RULESET_HASH,
    CHRONICLE_PREVIOUS_RULESET_HASH,
    AEGIS_PORTAL_PREVIOUS_RULESET_HASH,
    PORTAL_CLEAR_PREVIOUS_RULESET_HASH,
    GOLD_PARITY_PREVIOUS_RULESET_HASH,
    MAP_FRAGMENT_DEPTH_PREVIOUS_RULESET_HASH,
    PREVIOUS_RULESET_HASH,
    CHEST_HP_PREVIOUS_RULESET_HASH,
    "sha256:bf17a65dc721066bf11a1c34063cc18254fe97766852827719eb6aabf36042fa",
    "sha256:91065f3c515fbc2f996ba74a9fbbcab3d2ce013077af306afd51929e64e1af59",
    "sha256:5bf4a0fbf2583b9b59ae050eebdd324bc09038b3aed6d2090cb3a4e5481f79eb",
    "sha256:51a86cf41299257475530a356b98381ac828fdb0ec22e77eff0ded99f1758617",
    "sha256:0a922d5567e7cfba56644e915ac0e331ac74aa3fcc3a2aed478440d64e9878f7",
    "sha256:35707f6b5ea8b1ad18251dce5e6c18b87653893aad705b6c5543fdd140b88067",
    "sha256:76514cf9e5c89079571a5be117ce84f949d7a3f5ed441d973adc05c95c6dde3c",
    "sha256:5c3df81af373b68fce4d8fa242fb61c29b7c3d4ca78d6865d2ee51a58bbab3dd",
    "sha256:87c30b2c011b5103398f9b03f6bf018d71f2a35427c0a04ef7a31b2559a7a6d9"
  ]);
  const boundarySettlementRulesetHashes = new Set(BOUNDARY_SETTLEMENT_RULESET_HASHES);
  const POST_ROOM_PACT_RULESET_HASHES = Object.freeze([
    RULESET_HASH,
    CHRONICLE_PREVIOUS_RULESET_HASH,
    AEGIS_PORTAL_PREVIOUS_RULESET_HASH,
    PORTAL_CLEAR_PREVIOUS_RULESET_HASH,
    GOLD_PARITY_PREVIOUS_RULESET_HASH,
    MAP_FRAGMENT_DEPTH_PREVIOUS_RULESET_HASH,
    PREVIOUS_RULESET_HASH,
    CHEST_HP_PREVIOUS_RULESET_HASH,
    "sha256:bf17a65dc721066bf11a1c34063cc18254fe97766852827719eb6aabf36042fa",
    "sha256:91065f3c515fbc2f996ba74a9fbbcab3d2ce013077af306afd51929e64e1af59",
    "sha256:5bf4a0fbf2583b9b59ae050eebdd324bc09038b3aed6d2090cb3a4e5481f79eb",
    "sha256:51a86cf41299257475530a356b98381ac828fdb0ec22e77eff0ded99f1758617",
    "sha256:0a922d5567e7cfba56644e915ac0e331ac74aa3fcc3a2aed478440d64e9878f7",
    "sha256:35707f6b5ea8b1ad18251dce5e6c18b87653893aad705b6c5543fdd140b88067",
    "sha256:76514cf9e5c89079571a5be117ce84f949d7a3f5ed441d973adc05c95c6dde3c"
  ]);
  const postRoomPactRulesetHashes = new Set(POST_ROOM_PACT_RULESET_HASHES);
  const BOUNDED_PROC_CLAIMS_RULESET_HASHES = Object.freeze([
    RULESET_HASH,
    CHRONICLE_PREVIOUS_RULESET_HASH,
    AEGIS_PORTAL_PREVIOUS_RULESET_HASH,
    PORTAL_CLEAR_PREVIOUS_RULESET_HASH,
    GOLD_PARITY_PREVIOUS_RULESET_HASH,
    MAP_FRAGMENT_DEPTH_PREVIOUS_RULESET_HASH,
    PREVIOUS_RULESET_HASH,
    CHEST_HP_PREVIOUS_RULESET_HASH,
    "sha256:bf17a65dc721066bf11a1c34063cc18254fe97766852827719eb6aabf36042fa",
    "sha256:91065f3c515fbc2f996ba74a9fbbcab3d2ce013077af306afd51929e64e1af59",
    "sha256:5bf4a0fbf2583b9b59ae050eebdd324bc09038b3aed6d2090cb3a4e5481f79eb",
    "sha256:51a86cf41299257475530a356b98381ac828fdb0ec22e77eff0ded99f1758617",
    "sha256:0a922d5567e7cfba56644e915ac0e331ac74aa3fcc3a2aed478440d64e9878f7",
    "sha256:35707f6b5ea8b1ad18251dce5e6c18b87653893aad705b6c5543fdd140b88067"
  ]);
  const boundedProcClaimsRulesetHashes = new Set(BOUNDED_PROC_CLAIMS_RULESET_HASHES);
  const BOUNDED_COMBAT_RESOURCES_RULESET_HASHES = Object.freeze([
    RULESET_HASH,
    CHRONICLE_PREVIOUS_RULESET_HASH,
    AEGIS_PORTAL_PREVIOUS_RULESET_HASH,
    PORTAL_CLEAR_PREVIOUS_RULESET_HASH,
    GOLD_PARITY_PREVIOUS_RULESET_HASH,
    MAP_FRAGMENT_DEPTH_PREVIOUS_RULESET_HASH,
    PREVIOUS_RULESET_HASH,
    CHEST_HP_PREVIOUS_RULESET_HASH
  ]);
  const boundedCombatResourcesRulesetHashes = new Set(BOUNDED_COMBAT_RESOURCES_RULESET_HASHES);
  const CANONICAL_CHEST_OUTCOMES_RULESET_HASHES = Object.freeze([
    RULESET_HASH,
    CHRONICLE_PREVIOUS_RULESET_HASH,
    AEGIS_PORTAL_PREVIOUS_RULESET_HASH,
    PORTAL_CLEAR_PREVIOUS_RULESET_HASH,
    GOLD_PARITY_PREVIOUS_RULESET_HASH,
    MAP_FRAGMENT_DEPTH_PREVIOUS_RULESET_HASH,
    PREVIOUS_RULESET_HASH,
    CHEST_HP_PREVIOUS_RULESET_HASH,
    "sha256:bf17a65dc721066bf11a1c34063cc18254fe97766852827719eb6aabf36042fa",
    "sha256:91065f3c515fbc2f996ba74a9fbbcab3d2ce013077af306afd51929e64e1af59",
    "sha256:5bf4a0fbf2583b9b59ae050eebdd324bc09038b3aed6d2090cb3a4e5481f79eb",
    "sha256:51a86cf41299257475530a356b98381ac828fdb0ec22e77eff0ded99f1758617",
    "sha256:0a922d5567e7cfba56644e915ac0e331ac74aa3fcc3a2aed478440d64e9878f7"
  ]);
  const canonicalChestOutcomesRulesetHashes = new Set(CANONICAL_CHEST_OUTCOMES_RULESET_HASHES);
  const POTION_CLAIM_ORDERING_RULESET_HASHES = Object.freeze([
    RULESET_HASH,
    CHRONICLE_PREVIOUS_RULESET_HASH,
    AEGIS_PORTAL_PREVIOUS_RULESET_HASH,
    PORTAL_CLEAR_PREVIOUS_RULESET_HASH,
    GOLD_PARITY_PREVIOUS_RULESET_HASH,
    MAP_FRAGMENT_DEPTH_PREVIOUS_RULESET_HASH
  ]);
  const potionClaimOrderingRulesetHashes = new Set(POTION_CLAIM_ORDERING_RULESET_HASHES);
  const API_PREFIX = "/api/v3";
  const TOKEN_KINDS = Object.freeze({
    bootstrap: "run_bootstrap",
    room: "room_checkpoint",
    terminal: "run_terminal"
  });
  const ENDPOINTS = Object.freeze({
    start: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/start` }),
    checkpoint: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/checkpoint` }),
    event: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/event` }),
    finalize: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/finalize` }),
    resume: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/resume` }),
    abandon: Object.freeze({ method: "POST", path: `${API_PREFIX}/runs/abandon` }),
    camp: Object.freeze({ method: "POST", path: `${API_PREFIX}/profiles/camp` }),
    availability: Object.freeze({ method: "GET", path: `${API_PREFIX}/availability` }),
    leaderboard: Object.freeze({ method: "GET", path: `${API_PREFIX}/leaderboard` }),
    detail: Object.freeze({ method: "GET", path: `${API_PREFIX}/leaderboard/:runId` })
  });
  const RETRY_POLICY = Object.freeze({
    retryableStatus: Object.freeze([408, 425, 429, 500, 502, 503, 504]),
    maxAttempts: 3,
    baseDelayMs: 250,
    maxDelayMs: 1500,
    timeoutMs: 8000,
    requiresSameOperationId: true
  });

  function isRecord(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function isV3Path(path) {
    return typeof path === "string" && (
      path === API_PREFIX ||
      path.startsWith(`${API_PREFIX}/`)
    );
  }

  function requireText(value, field) {
    if (typeof value !== "string" || !value) throw new TypeError(`PROTOCOL_FIELD_INVALID:${field}`);
    return value;
  }

  function requireProtocolVersion(value) {
    if (value !== PROTOCOL_VERSION) throw new TypeError("PROTOCOL_VERSION_MISMATCH");
  }

  function isSupportedRulesetHash(value) {
    return supportedRulesetHashes.has(String(value || ""));
  }

  function supportsFatalPresentationCause(value) {
    const hash = String(value || "");
    return !legacyFatalPresentationCauseRulesetHashes.has(hash) && fatalPresentationCauseRulesetHashes.has(hash);
  }

  function supportsBoundarySettlement(value) {
    return boundarySettlementRulesetHashes.has(String(value || ""));
  }

  function supportsPostRoomPact(value) {
    const rulesetHash = typeof value === "string" ? value : value && value.rulesetHash;
    return postRoomPactRulesetHashes.has(rulesetHash);
  }

  function supportsBoundedProcClaims(value) {
    const rulesetHash = typeof value === "string" ? value : value && value.rulesetHash;
    return boundedProcClaimsRulesetHashes.has(String(rulesetHash || ""));
  }

  function supportsBoundedCombatResources(value) {
    const rulesetHash = typeof value === "string" ? value : value && value.rulesetHash;
    return boundedCombatResourcesRulesetHashes.has(String(rulesetHash || ""));
  }

  function supportsCanonicalChestOutcomes(value) {
    const rulesetHash = typeof value === "string" ? value : value && value.rulesetHash;
    return canonicalChestOutcomesRulesetHashes.has(String(rulesetHash || ""));
  }

  function supportsPotionClaimOrdering(value) {
    const rulesetHash = typeof value === "string" ? value : value && value.rulesetHash;
    return potionClaimOrderingRulesetHashes.has(String(rulesetHash || ""));
  }

  function requireOptionalRecord(value, field) {
    if (value !== null && value !== undefined && !isRecord(value)) {
      throw new TypeError(`PROTOCOL_PROJECTION_INVALID:${field}`);
    }
  }

  function requireOptionalArray(value, field) {
    if (value !== undefined && !Array.isArray(value)) {
      throw new TypeError(`PROTOCOL_PROJECTION_INVALID:${field}`);
    }
  }

  function validateOfferProjection(value, field) {
    requireOptionalRecord(value, field);
    if (value === null || value === undefined) return;
    const identity = value.offerId || value.transactionId || value.sourceId;
    requireText(identity, `${field}.identity`);
    requireOptionalArray(value.publicChoices, `${field}.publicChoices`);
    requireOptionalArray(value.choices, `${field}.choices`);
    requireOptionalArray(value.transactions, `${field}.transactions`);
  }

  function validateScoreProjection(value) {
    requireOptionalRecord(value, "score");
    if (value === null || value === undefined) return;
    requireText(value.scoreVersion, "score.scoreVersion");
    requireOptionalRecord(value.inputs, "score.inputs");
    requireOptionalRecord(value.components, "score.components");
    for (const field of [
      "score",
      "inputs.acceptedMaxDepth",
      "inputs.acceptedRunGoldEarned",
      "components.depthPoints",
      "components.goldPoints",
      "components.bossMilestonePoints"
    ]) {
      const parts = field.split(".");
      const numeric = parts.reduce((current, key) => current?.[key], value);
      if (!Number.isSafeInteger(numeric) || numeric < 0) {
        throw new TypeError(`PROTOCOL_PROJECTION_INVALID:score.${field}`);
      }
    }
    const expected = value.components.depthPoints +
      value.components.goldPoints +
      value.components.bossMilestonePoints;
    if (value.score !== expected) {
      throw new TypeError("PROTOCOL_PROJECTION_INVALID:score.total");
    }
  }

  function validateMetaState(value) {
    if (!isRecord(value)) throw new TypeError("PROTOCOL_META_STATE_INVALID");
    requireText(value.runId, "metaState.runId");
    requireText(value.rulesetId, "metaState.rulesetId");
    requireText(value.rulesetHash, "metaState.rulesetHash");
    if (value.rulesetId !== RULESET_ID) throw new TypeError("PROTOCOL_RULESET_ID_MISMATCH");
    if (!isSupportedRulesetHash(value.rulesetHash)) throw new TypeError("PROTOCOL_RULESET_HASH_UNSUPPORTED");
    requireProtocolVersion(value.protocolVersion);
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
      throw new TypeError("PROTOCOL_FIELD_INVALID:metaState.revision");
    }
    if (
      value.assistanceClass !== undefined &&
      !["none", "observer_bot", "cheats", "mixed"].includes(value.assistanceClass)
    ) {
      throw new TypeError("PROTOCOL_PROJECTION_INVALID:metaState.assistanceClass");
    }
    requireOptionalRecord(value.rankIntegrity, "rankIntegrity");
    if (value.rankIntegrity) {
      requireOptionalArray(value.rankIntegrity.reasonCodes, "rankIntegrity.reasonCodes");
      if (
        !Array.isArray(value.rankIntegrity.reasonCodes) ||
        value.rankIntegrity.reasonCodes.length > 16 ||
        value.rankIntegrity.reasonCodes.some((entry) => typeof entry !== "string" || !entry)
      ) {
        throw new TypeError("PROTOCOL_PROJECTION_INVALID:rankIntegrity.reasonCodes");
      }
      if (
        value.rankIntegrity.firstDetectedRevision !== null &&
        (!Number.isSafeInteger(value.rankIntegrity.firstDetectedRevision) ||
          value.rankIntegrity.firstDetectedRevision < 0)
      ) {
        throw new TypeError("PROTOCOL_PROJECTION_INVALID:rankIntegrity.firstDetectedRevision");
      }
    }
    if (!["awaiting_starting_relic", "active", "victory", "defeat", "extraction", "finalized", "abandoned"].includes(value.status)) {
      throw new TypeError("PROTOCOL_STATUS_UNKNOWN");
    }
    requireOptionalRecord(value.currentRoomDirective, "currentRoomDirective");
    if (value.currentRoomDirective) {
      requireText(value.currentRoomDirective.directiveId, "currentRoomDirective.directiveId");
      requireText(value.currentRoomDirective.roomNonce, "currentRoomDirective.roomNonce");
      requireText(value.currentRoomDirective.roomType, "currentRoomDirective.roomType");
    }
    requireOptionalRecord(value.currentRewardEnvelope, "currentRewardEnvelope");
    if (value.currentRewardEnvelope) {
      requireText(value.currentRewardEnvelope.envelopeId, "currentRewardEnvelope.envelopeId");
      const canonicalMarker = value.currentRewardEnvelope.canonicalChestOutcomesVersion;
      if (canonicalMarker !== undefined && canonicalMarker !== "v1") {
        throw new TypeError("PROTOCOL_PROJECTION_INVALID:canonicalChestOutcomesVersion");
      }
      const ordinaryCanonicalRooms = new Set([
        "combat", "boss", "final", "cursed", "duel", "horde", "treasure", "vault", "ambush", "shrine"
      ]);
      const requiresCanonicalOrdinarySlots = canonicalMarker === "v1" &&
        ordinaryCanonicalRooms.has(value.currentRewardEnvelope.roomType);
      requireOptionalArray(value.currentRewardEnvelope.rewardSlots, "currentRewardEnvelope.rewardSlots");
      requireOptionalArray(value.currentRewardEnvelope.claimSlots, "currentRewardEnvelope.claimSlots");
      if (requiresCanonicalOrdinarySlots && !Array.isArray(value.currentRewardEnvelope.claimSlots)) {
        throw new TypeError("PROTOCOL_PROJECTION_INVALID:claimSlots.canonicalOutcome");
      }
      if (Array.isArray(value.currentRewardEnvelope.claimSlots)) {
        const slots = value.currentRewardEnvelope.claimSlots;
        const slotIds = new Set();
        for (const [index, slot] of slots.entries()) {
          if (!isRecord(slot) || typeof slot.slotId !== "string" || !slot.slotId) {
            throw new TypeError("PROTOCOL_PROJECTION_INVALID:claimSlots");
          }
          if (slotIds.has(slot.slotId)) throw new TypeError("PROTOCOL_PROJECTION_INVALID:claimSlots.duplicate");
          slotIds.add(slot.slotId);
          if (!requiresCanonicalOrdinarySlots) continue;
          if (!Object.hasOwn(slot, "canonicalOutcome") || !isRecord(slot.canonicalOutcome)) {
            throw new TypeError("PROTOCOL_PROJECTION_INVALID:claimSlots.canonicalOutcome");
          }
          const outcome = slot.canonicalOutcome;
          if (
            typeof outcome.awardId !== "string" || !outcome.awardId.trim() ||
            !["health", "healing", "attack", "armor", "potion", "map_fragment", "gold", "trap", "fallback_gold"].includes(outcome.outcome)
          ) throw new TypeError("PROTOCOL_PROJECTION_INVALID:claimSlots.canonicalOutcome");
          if (JSON.stringify(Object.keys(outcome).sort()) !== JSON.stringify(["awardId", "outcome"])) {
            throw new TypeError("PROTOCOL_PROJECTION_INVALID:claimSlots.canonicalOutcome");
          }
          if (slot.consumed !== undefined && typeof slot.consumed !== "boolean") {
            throw new TypeError("PROTOCOL_PROJECTION_INVALID:claimSlots.consumed");
          }
          if (slot.slotId !== `chest_${index + 1}`) {
            throw new TypeError("PROTOCOL_PROJECTION_INVALID:claimSlots.order");
          }
        }
      }
    }
    requireOptionalRecord(value.build, "build");
    if (value.build) {
      requireOptionalArray(value.build.relics, "build.relics");
      requireOptionalArray(value.build.pacts, "build.pacts");
    }
    requireOptionalRecord(value.lifeState, "lifeState");
    if (value.lifeState && !Number.isSafeInteger(value.lifeState.currentLife)) {
      throw new TypeError("PROTOCOL_PROJECTION_INVALID:lifeState.currentLife");
    }
    validateScoreProjection(value.score);
    validateOfferProjection(value.startingRelicOffer, "startingRelicOffer");
    validateOfferProjection(value.relicOffer, "relicOffer");
    validateOfferProjection(value.relicReplacement, "relicReplacement");
    validateOfferProjection(value.metaTransactionOffer, "metaTransactionOffer");
    requireOptionalRecord(value.campSession, "campSession");
    return value;
  }

  function tokenFromResponse(value) {
    if (typeof value.bootstrapToken === "string" && value.bootstrapToken) {
      return { kind: TOKEN_KINDS.bootstrap, value: value.bootstrapToken };
    }
    if (typeof value.checkpointToken === "string" && value.checkpointToken) {
      const terminal = ["victory", "defeat", "extraction"].includes(value.metaState?.status);
      return {
        kind: terminal ? TOKEN_KINDS.terminal : TOKEN_KINDS.room,
        value: value.checkpointToken
      };
    }
    if (["finalized", "abandoned"].includes(value.metaState?.status)) return null;
    throw new TypeError("PROTOCOL_TOKEN_MISSING");
  }

  function validateMutationResponse(value, expected = {}) {
    if (!isRecord(value) || value.ok !== true) throw new TypeError("PROTOCOL_RESPONSE_INVALID");
    requireProtocolVersion(value.protocolVersion);
    requireText(value.runId, "runId");
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
      throw new TypeError("PROTOCOL_FIELD_INVALID:revision");
    }
    const metaState = validateMetaState(value.metaState);
    if (value.runId !== metaState.runId || value.revision !== metaState.revision) {
      throw new TypeError("PROTOCOL_RESPONSE_BINDING_MISMATCH");
    }
    if (expected.runId && value.runId !== expected.runId) throw new TypeError("PROTOCOL_RUN_MISMATCH");
    if (expected.rulesetId && metaState.rulesetId !== expected.rulesetId) {
      throw new TypeError("PROTOCOL_RULESET_ID_MISMATCH");
    }
    if (expected.rulesetHash && metaState.rulesetHash !== expected.rulesetHash) {
      throw new TypeError("PROTOCOL_RULESET_HASH_MISMATCH");
    }
    if (value.acceptedBoundary !== undefined && ![
      "run_started",
      "starting_relic_selected",
      "room_cleared",
      "run_resumed",
      "run_abandoned",
      "run_finalized"
    ].includes(value.acceptedBoundary)) {
      throw new TypeError("PROTOCOL_RESPONSE_KIND_UNKNOWN");
    }
    if (value.acceptedEvent !== undefined && ![
      "issue_relic_offer",
      "select_relic",
      "commit_relic_replacement",
      "cancel_relic_replacement",
      "commit_relic_fallback",
      "open_meta_offer",
      "commit_meta_transaction",
      "report_fatal_event",
      "request_extraction",
      "mark_test_assistance"
    ].includes(value.acceptedEvent)) {
      throw new TypeError("PROTOCOL_RESPONSE_KIND_UNKNOWN");
    }
    const token = tokenFromResponse(value);
    if (expected.tokenKind && token?.kind !== expected.tokenKind) {
      throw new TypeError("PROTOCOL_TOKEN_KIND_MISMATCH");
    }
    return Object.freeze({ response: value, metaState, token });
  }

  function validateCampResponse(value) {
    if (!isRecord(value) || value.ok !== true) throw new TypeError("RANKED_CAMP_RESPONSE_INVALID");
    requireProtocolVersion(value.protocolVersion);
    requireText(value.profileId, "profileId");
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
      throw new TypeError("PROTOCOL_FIELD_INVALID:revision");
    }
    if (!isRecord(value.profile) || !isRecord(value.metaState)) {
      throw new TypeError("RANKED_CAMP_RESPONSE_INVALID");
    }
    validateOfferProjection(value.metaTransactionOffer, "metaTransactionOffer");
    return value;
  }

  function validateLeaderboardResponse(value, kind = "list") {
    if (!isRecord(value) || value.ok !== true) throw new TypeError("LEADERBOARD_RESPONSE_INVALID");
    if (kind === "list") {
      requireText(value.season, "season");
      if (!Array.isArray(value.entries)) throw new TypeError("LEADERBOARD_ENTRIES_INVALID");
      for (const entry of value.entries) {
        if (!isRecord(entry) || !/^run_[a-f0-9]+$/u.test(String(entry.runId || ""))) {
          throw new TypeError("LEADERBOARD_ENTRY_INVALID");
        }
      }
      if (value.cursor !== null && value.cursor !== undefined && typeof value.cursor !== "string") {
        throw new TypeError("LEADERBOARD_CURSOR_INVALID");
      }
    } else if (kind === "detail") {
      if (!isRecord(value.entry) || !/^run_[a-f0-9]+$/u.test(String(value.entry.runId || ""))) {
        throw new TypeError("LEADERBOARD_ENTRY_INVALID");
      }
      requireOptionalRecord(value.entry.build, "leaderboard.entry.build");
      requireOptionalRecord(value.entry.summary, "leaderboard.entry.summary");
    } else {
      throw new TypeError("LEADERBOARD_RESPONSE_KIND_UNKNOWN");
    }
    return value;
  }
  function validateEnvelope(value, tokenKind = TOKEN_KINDS.room) {
    const errors = [];
    if (!isRecord(value)) return Object.freeze(["envelope must be an object"]);
    if (typeof value.runId !== "string" || !value.runId) errors.push("runId is required");
    const tokenField = tokenKind === TOKEN_KINDS.bootstrap ? "bootstrapToken" : "checkpointToken";
    if (typeof value[tokenField] !== "string" || !value[tokenField]) {
      errors.push(`${tokenField} is required`);
    }
    return Object.freeze(errors);
  }

  return Object.freeze({
    PROTOCOL_VERSION,
    RULESET_ID,
    RULESET_HASH,
    CHRONICLE_PREVIOUS_RULESET_HASH,
    AEGIS_PORTAL_PREVIOUS_RULESET_HASH,
    PORTAL_CLEAR_PREVIOUS_RULESET_HASH,
    SUPPORTED_RULESET_HASHES,
    isSupportedRulesetHash,
    supportsFatalPresentationCause,
    BOUNDARY_SETTLEMENT_RULESET_HASHES,
    supportsBoundarySettlement,
    POST_ROOM_PACT_RULESET_HASHES,
    supportsPostRoomPact,
    BOUNDED_PROC_CLAIMS_RULESET_HASHES,
    supportsBoundedProcClaims,
    BOUNDED_COMBAT_RESOURCES_RULESET_HASHES,
    supportsBoundedCombatResources,
    CANONICAL_CHEST_OUTCOMES_RULESET_HASHES,
    supportsCanonicalChestOutcomes,
    POTION_CLAIM_ORDERING_RULESET_HASHES,
    supportsPotionClaimOrdering,
    API_PREFIX,
    TOKEN_KINDS,
    ENDPOINTS,
    RETRY_POLICY,
    isV3Path,
    validateEnvelope,
    validateMetaState,
    validateMutationResponse,
    validateCampResponse,
    validateLeaderboardResponse
  });
});
