(function () {
  const PACTS = Object.freeze([
    Object.freeze({
      id: "hunger",
      name: "Pact of Hunger",
      minDepth: 25,
      upside: "+25% damage dealt",
      downside: "Potions heal 50% less",
      tags: Object.freeze(["damage", "glass"])
    }),
    Object.freeze({
      id: "precision",
      name: "Pact of Precision",
      minDepth: 25,
      upside: "+12% crit chance",
      downside: "-25% max HP",
      tags: Object.freeze(["crit", "glass"])
    }),
    Object.freeze({
      id: "velocity",
      name: "Pact of Velocity",
      minDepth: 25,
      upside: "Combat skill cooldowns recover 20% faster",
      downside: "Take +12% damage",
      tags: Object.freeze(["skill", "tempo"])
    }),
    Object.freeze({
      id: "avarice",
      name: "Pact of Avarice",
      minDepth: 30,
      upside: "+40% gold gain",
      downside: "Enemies and chests no longer drop potions. Merchant potion price +100%",
      tags: Object.freeze(["economy"])
    }),
    Object.freeze({
      id: "iron",
      name: "Pact of Iron",
      minDepth: 25,
      upside: "Gain Barrier equal to 35% of max HP at the start of every combat",
      downside: "Potions heal 35% less",
      tags: Object.freeze(["barrier", "tank"])
    }),
    Object.freeze({
      id: "blood",
      name: "Pact of Blood",
      minDepth: 30,
      upside: "Using a skill grants Barrier equal to 8% max HP",
      downside: "Base attack -20%",
      tags: Object.freeze(["skill", "barrier"])
    }),
    Object.freeze({
      id: "ruin",
      name: "Pact of Ruin",
      minDepth: 35,
      upside: "Skills deal +25% damage",
      downside: "Skills have +5 turns cooldown",
      tags: Object.freeze(["skill", "damage"])
    }),
    Object.freeze({
      id: "silence",
      name: "Pact of Silence",
      minDepth: 35,
      upside: "Basic attacks deal +25% damage",
      downside: "Skills deal 25% less damage and have +2 turns cooldown",
      tags: Object.freeze(["attack", "discipline"])
    }),
    Object.freeze({
      id: "cinders",
      name: "Pact of Cinders",
      minDepth: 40,
      upside: "Basic attacks ignite enemies for 12 damage per turn for 2 turns",
      downside: "Take +25% environmental damage",
      tags: Object.freeze(["burn", "hazard"])
    }),
    Object.freeze({
      id: "hunt",
      name: "Pact of the Hunt",
      minDepth: 45,
      upside: "+30% damage to elites and bosses",
      downside: "Non-elite enemies deal +15% damage",
      tags: Object.freeze(["elite", "boss"])
    }),
    Object.freeze({
      id: "chains",
      name: "Pact of Chains",
      minDepth: 40,
      upside: "+20 ARM and immunity to forced movement",
      downside: "Dash has +4 turns cooldown",
      tags: Object.freeze(["armor", "control"])
    })
  ]);

  const PACT_ROOM_PROFILES = Object.freeze([
    Object.freeze({ minDepth: 0, enabled: false, weight: 0 }),
    Object.freeze({ minDepth: 25, enabled: true, weight: 0.025 }),
    Object.freeze({ minDepth: 40, enabled: true, weight: 0.04 }),
    Object.freeze({ minDepth: 60, enabled: true, weight: 0.05 }),
    Object.freeze({ minDepth: 80, enabled: true, weight: 0.06 })
  ]);

  const PACT_ENCOUNTER_PROFILES = Object.freeze([
    Object.freeze({
      minDepth: 0,
      minEnemies: 4,
      maxEnemies: 7,
      eliteOnly: true,
      minMines: 4,
      maxMines: 5,
      minSpikes: 5,
      maxSpikes: 6
    })
  ]);

  function getPactRoomProfile(depth = 0) {
    const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
    let profile = PACT_ROOM_PROFILES[0];
    for (const candidate of PACT_ROOM_PROFILES) {
      if (safeDepth >= candidate.minDepth) {
        profile = candidate;
      }
    }
    return profile;
  }

  function getPactEncounterProfile(depth = 0) {
    const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
    let profile = PACT_ENCOUNTER_PROFILES[0];
    for (const candidate of PACT_ENCOUNTER_PROFILES) {
      if (safeDepth >= candidate.minDepth) {
        profile = candidate;
      }
    }
    return profile;
  }

  function canOfferPactRoom(depth = 0) {
    return Boolean(getPactRoomProfile(depth).enabled);
  }

  function getPactRoomWeight(depth = 0) {
    return Number(getPactRoomProfile(depth).weight) || 0;
  }

  function getActivePactIds(options = {}) {
    return new Set(Array.isArray(options.activePactIds) ? options.activePactIds.filter(Boolean) : []);
  }

  function isPactValid(pact, options = {}) {
    if (!pact) return false;
    const depth = Math.max(0, Math.floor(Number(options.depth) || 0));
    if (depth < pact.minDepth) return false;
    const active = getActivePactIds(options);
    if (active.has(pact.id)) return false;
    if (typeof options.isPactValid === "function") {
      return Boolean(options.isPactValid(pact, options));
    }
    return true;
  }

  function choosePactOffers(options = {}) {
    const random = typeof options.random === "function" ? options.random : Math.random;
    const count = Math.max(1, Math.floor(Number(options.count) || 2));
    const available = PACTS.filter((pact) => isPactValid(pact, options));
    const choices = [];
    const pool = available.slice();
    while (pool.length > 0 && choices.length < count) {
      const index = Math.max(0, Math.min(pool.length - 1, Math.floor(random() * pool.length)));
      choices.push(pool.splice(index, 1)[0]);
    }
    return {
      profile: getPactRoomProfile(options.depth),
      choices
    };
  }

  const api = {
    PACTS,
    getPactRoomProfile,
    getPactEncounterProfile,
    canOfferPactRoom,
    getPactRoomWeight,
    choosePactOffers,
    isPactValid
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonPactRoom = api;
  }
})();
