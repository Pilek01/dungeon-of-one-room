(function exposeRankedV3Checkpoints(root, factory) {
  "use strict";

  const api = factory();
  if (root) root.DungeonRankedV3Checkpoints = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createCheckpointModule() {
  "use strict";

  const ASSURANCE = Object.freeze({
    status: "test_spec_only",
    activeCombatSecurity: false,
    note: "Projection helper only; active Ranked assurance remains checkpoint-authoritative meta-progression."
  });
  const RANKED_STATE_VERSION = 1;
  const TERMINAL_STATUSES = Object.freeze(["finalized", "abandoned", "rejected"]);

  function nonNegativeInteger(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function stringList(value) {
    return Array.isArray(value)
      ? value.filter((item) => typeof item === "string")
      : [];
  }

  function createRankedStateV3(input = {}) {
    const build = input.build && typeof input.build === "object" ? input.build : {};
    const statistics = input.statistics && typeof input.statistics === "object"
      ? input.statistics
      : {};
    return {
      schemaVersion: RANKED_STATE_VERSION,
      runId: String(input.runId || ""),
      revision: nonNegativeInteger(input.revision),
      season: String(input.season || ""),
      gameVersion: String(input.gameVersion || ""),
      rulesetHash: String(input.rulesetHash || ""),
      status: String(input.status || "active"),
      depth: nonNegativeInteger(input.depth),
      roomIndex: nonNegativeInteger(input.roomIndex),
      roomDirectiveId: String(input.roomDirectiveId || ""),
      roomType: String(input.roomType || "combat"),
      roomNonce: String(input.roomNonce || ""),
      gold: nonNegativeInteger(input.gold),
      lives: nonNegativeInteger(input.lives),
      build: {
        relics: Array.isArray(build.relics)
          ? build.relics.map((relic) => ({
            id: String(relic?.id || ""),
            stacks: Math.max(1, nonNegativeInteger(relic?.stacks))
          })).filter((relic) => relic.id)
          : [],
        mutators: stringList(build.mutators),
        skillTiers: build.skillTiers && typeof build.skillTiers === "object"
          ? { ...build.skillTiers }
          : {},
        elixirs: stringList(build.elixirs)
      },
      statistics: {
        kills: nonNegativeInteger(statistics.kills),
        eliteKills: nonNegativeInteger(statistics.eliteKills),
        bossesCleared: nonNegativeInteger(statistics.bossesCleared),
        damageDone: nonNegativeInteger(statistics.damageDone),
        damageTaken: nonNegativeInteger(statistics.damageTaken),
        potionsUsed: nonNegativeInteger(statistics.potionsUsed),
        elixirsUsed: nonNegativeInteger(statistics.elixirsUsed),
        roomsCleared: nonNegativeInteger(statistics.roomsCleared),
        commandsAccepted: nonNegativeInteger(statistics.commandsAccepted)
      },
      rewardOffer: input.rewardOffer && typeof input.rewardOffer === "object"
        ? { ...input.rewardOffer }
        : null,
      merchantInventory: Array.isArray(input.merchantInventory)
        ? input.merchantInventory.map((item) => ({ ...item }))
        : [],
      specialRoomSchedule: Array.isArray(input.specialRoomSchedule)
        ? input.specialRoomSchedule.map((item) => ({ ...item }))
        : [],
      journalDigest: String(input.journalDigest || ""),
      compactProof: input.compactProof && typeof input.compactProof === "object"
        ? { ...input.compactProof }
        : null
    };
  }

  function validateRankedStateV3(value) {
    const errors = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return Object.freeze(["state must be an object"]);
    }
    if (value.schemaVersion !== RANKED_STATE_VERSION) errors.push("schemaVersion is unsupported");
    if (typeof value.runId !== "string" || !value.runId) errors.push("runId is required");
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) errors.push("revision is invalid");
    if (typeof value.season !== "string" || !value.season) errors.push("season is required");
    if (typeof value.gameVersion !== "string" || !value.gameVersion) errors.push("gameVersion is required");
    if (typeof value.rulesetHash !== "string" || !value.rulesetHash) errors.push("rulesetHash is required");
    if (typeof value.roomNonce !== "string" || !value.roomNonce) errors.push("roomNonce is required");
    if (!value.build || !Array.isArray(value.build.relics)) errors.push("build.relics is required");
    return Object.freeze(errors);
  }

  function createCompactRoomProof(input = {}) {
    return Object.freeze({
      version: 1,
      roomDirectiveId: String(input.roomDirectiveId || ""),
      roomNonce: String(input.roomNonce || ""),
      roomIndex: nonNegativeInteger(input.roomIndex),
      roomType: String(input.roomType || "combat"),
      generationDigest: String(input.generationDigest || ""),
      clearDigest: String(input.clearDigest || ""),
      commandCount: nonNegativeInteger(input.commandCount),
      journalDigest: String(input.journalDigest || "")
    });
  }

  function isTerminalState(value) {
    return Boolean(value && TERMINAL_STATUSES.includes(value.status));
  }

  return Object.freeze({
    ASSURANCE,
    RANKED_STATE_VERSION,
    TERMINAL_STATUSES,
    createRankedStateV3,
    createCompactRoomProof,
    validateRankedStateV3,
    isTerminalState
  });
});
