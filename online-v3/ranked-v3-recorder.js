(function exposeRankedV3Recorder(root, factory) {
  "use strict";

  const api = factory();
  if (root) root.DungeonRankedV3Recorder = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createRecorderModule() {
  "use strict";

  const ASSURANCE = Object.freeze({
    status: "active_bounded_client_attestation",
    activeCombatSecurity: false,
    note: "Records bounded local reward claims; it is not evidence of server-authoritative combat."
  });
  const JOURNAL_VERSION = 1;
  const MAX_JOURNAL_COMMANDS = 4096;

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    }
    return result;
  }

  function canonicalJson(value) {
    return JSON.stringify(canonicalize(value));
  }

  function fnv1a32(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function createRecorder(options = {}) {
    const runId = String(options.runId || "");
    const commands = [];
    let sequence = 0;
    let previousDigest = "00000000";

    function recordCommand(command) {
      if (commands.length >= MAX_JOURNAL_COMMANDS) return null;
      const normalized = canonicalize({
        sequence: sequence + 1,
        roomIndex: Math.max(0, Number(command?.roomIndex) || 0),
        roomNonce: String(command?.roomNonce || ""),
        turn: Math.max(0, Number(command?.turn) || 0),
        type: String(command?.type || "unknown"),
        payload: command?.payload && typeof command.payload === "object"
          ? command.payload
          : {},
        previousDigest
      });
      sequence += 1;
      previousDigest = fnv1a32(canonicalJson(normalized));
      const entry = Object.freeze({ ...normalized, digest: previousDigest });
      commands.push(entry);
      return entry;
    }

    function compactProof() {
      return Object.freeze({
        version: JOURNAL_VERSION,
        runId,
        commandCount: commands.length,
        firstSequence: commands[0]?.sequence || 0,
        lastSequence: commands.at(-1)?.sequence || 0,
        journalDigest: previousDigest
      });
    }

    function snapshot() {
      return Object.freeze({
        ...compactProof(),
        commands: Object.freeze(commands.slice())
      });
    }

    return Object.freeze({
      recordCommand,
      compactProof,
      snapshot
    });
  }

  function roomClearBaseV08(depth, roomType) {
    const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
    const safeRoomType = String(roomType || "combat");
    if (safeRoomType === "merchant" || safeRoomType === "crossroads") return 0;
    let base = 2 + Math.floor(safeDepth / 2);
    if (safeRoomType === "treasure") base = Math.max(1, base - 1);
    else if (safeRoomType === "vault") base = Math.max(1, base - 2);
    else if (safeRoomType === "shrine") base += 1;
    else if (safeRoomType === "cursed") base += 4;
    if (safeRoomType === "boss" || safeRoomType === "final") base += 10;
    return Math.max(1, base);
  }

  function createRewardClaimRecorder(options = {}) {
    const claims = new Map();
    let chestCount = Math.max(0, Math.floor(Number(options.initialChestCount) || 0));
    let sealedSnapshot = null;

    const canonicalChestOutcomes = new Set([
      "health",
      "healing",
      "attack",
      "armor",
      "potion",
      "map_fragment",
      "gold",
      "trap",
      "fallback_gold"
    ]);

    function aggregate(claimType, claimId) {
      if (sealedSnapshot) return false;
      const key = `${claimType}:${claimId}`;
      const current = claims.get(key);
      if (current) current.count += 1;
      else claims.set(key, { claimType, claimId, count: 1 });
      return true;
    }

    function recordEnemy(input = {}) {
      const enemyType = String(input.enemyType || "");
      if (!/^[a-z][a-z0-9_]*$/u.test(enemyType)) return false;
      const claimType = input.elite ? "elite" : "enemy";
      return aggregate(claimType, `${claimType}:${enemyType}`);
    }

    function recordHazard() {
      return aggregate("hazard", "hazard-kill");
    }

    function openChest(canonicalOutcome = null) {
      if (sealedSnapshot) return null;
      const hasCanonicalOutcome = canonicalOutcome !== null && canonicalOutcome !== undefined;
      if (hasCanonicalOutcome) {
        if (
          !canonicalOutcome ||
          typeof canonicalOutcome !== "object" ||
          Array.isArray(canonicalOutcome) ||
          typeof canonicalOutcome.awardId !== "string" ||
          !canonicalOutcome.awardId.trim() ||
          !canonicalChestOutcomes.has(canonicalOutcome.outcome) ||
          JSON.stringify(Object.keys(canonicalOutcome).sort()) !== JSON.stringify(["awardId", "outcome"])
        ) return null;
      }
      chestCount += 1;
      const claimId = `chest_${chestCount}`;
      claims.set(`chest:${claimId}`, {
        claimType: "chest",
        claimId,
        count: 1,
        localEvidence: hasCanonicalOutcome
          ? { outcome: canonicalOutcome.outcome, awardId: canonicalOutcome.awardId }
          : { outcome: "opened" }
      });
      return claimId;
    }

    function updateChestEvidence(claimId, outcome, field, value, minimum, maximum) {
      if (sealedSnapshot) return false;
      const claim = claims.get(`chest:${String(claimId || "")}`);
      const amount = Number(value);
      if (!claim || !Number.isSafeInteger(amount) || amount < minimum || amount > maximum) return false;
      const current = claim.localEvidence;
      if (!current || typeof current !== "object") return false;
      if (current.outcome !== "opened" && current.outcome !== outcome) return false;
      claim.localEvidence = current.awardId
        ? { outcome, awardId: current.awardId, [field]: amount }
        : { outcome, [field]: amount };
      return true;
    }

    function recordChestGold(claimId, baseAmount) {
      const amount = Number(baseAmount);
      return updateChestEvidence(claimId, "gold", "baseAmount", amount, 0, Number.MAX_SAFE_INTEGER);
    }

    function recordChestFallbackGold(claimId, baseAmount) {
      const amount = Number(baseAmount);
      return updateChestEvidence(claimId, "fallback_gold", "baseAmount", amount, 2, 5);
    }

    function recordChestResource(claimId, outcome, count = 1) {
      const amount = Number(count);
      if (!["potion", "map_fragment"].includes(outcome)) {
        return false;
      }
      return updateChestEvidence(claimId, outcome, "count", amount, 1, 1);
    }

    function recordPotionUse() {
      return aggregate("resource", "potion-use");
    }

    function recordShieldUse() {
      return aggregate("resource", "shield-use");
    }

    function recordVoidReaperCritKill() {
      return aggregate("proc", "void-reaper-crit-kill");
    }

    function recordChaosOrbGoldRoll() {
      return aggregate("proc", "chaos-orb-gold-roll");
    }

    function snapshot() {
      if (!sealedSnapshot) {
        sealedSnapshot = Object.freeze(Array.from(claims.values(), (claim) =>
          Object.freeze({
            ...claim,
            ...(claim.localEvidence
              ? { localEvidence: Object.freeze({ ...claim.localEvidence }) }
              : {})
          })
        ));
      }
      return sealedSnapshot;
    }

    return Object.freeze({
      recordEnemy,
      recordHazard,
      openChest,
      recordChestGold,
      recordChestPotion: (claimId, count) =>
        recordChestResource(claimId, "potion", count),
      recordChestFallbackGold,
      recordChestMapFragment: (claimId, count) =>
        recordChestResource(claimId, "map_fragment", count),
      recordPotionUse,
      recordShieldUse,
      recordVoidReaperCritKill,
      recordChaosOrbGoldRoll,
      snapshot
    });
  }
  return Object.freeze({
    ASSURANCE,
    JOURNAL_VERSION,
    MAX_JOURNAL_COMMANDS,
    canonicalJson,
    createRecorder,
    roomClearBaseV08,
    createRewardClaimRecorder
  });
});
