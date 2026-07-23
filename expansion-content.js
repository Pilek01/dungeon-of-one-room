(function () {
  const ROOM_TYPES = Object.freeze({
    ambush: Object.freeze({
      id: "ambush",
      label: "Ambush",
      category: "normal",
      minDepth: 15,
      regionWeights: Object.freeze({ descent: 0.025, corruption: 0.045, rupture: 0.050, collapse: 0.055, endgame: 0.060 })
    }),
    horde: Object.freeze({
      id: "horde",
      label: "Horde",
      category: "normal",
      minDepth: 25,
      regionWeights: Object.freeze({ descent: 0, corruption: 0.035, rupture: 0.045, collapse: 0.050, endgame: 0.055 })
    }),
    duel: Object.freeze({
      id: "duel",
      label: "Duel",
      category: "normal",
      minDepth: 35,
      regionWeights: Object.freeze({ descent: 0, corruption: 0.020, rupture: 0.035, collapse: 0.045, endgame: 0.050 })
    }),
    crossroads: Object.freeze({
      id: "crossroads",
      label: "Crossroads",
      category: "special",
      minDepth: 30,
      regionWeights: Object.freeze({ descent: 0, corruption: 0.018, rupture: 0.024, collapse: 0.028, endgame: 0.030 })
    }),
    arena: Object.freeze({
      id: "arena",
      label: "Blood Arena",
      category: "special",
      minDepth: 40,
      regionWeights: Object.freeze({ descent: 0, corruption: 0, rupture: 0.030, collapse: 0.040, endgame: 0.050 })
    })
  });

  const ENEMY_TYPES = Object.freeze({
    riftweaver: Object.freeze({
      id: "riftweaver",
      name: "Riftweaver",
      minDepth: 45,
      maxPerRoom: 1,
      role: "zoning",
      visualBaseType: "acolyte"
    }),
    bulwark: Object.freeze({
      id: "bulwark",
      name: "Abyss Bulwark",
      minDepth: 65,
      maxPerRoom: 1,
      role: "frontline",
      visualBaseType: "brute"
    })
  });

  const TRAP_TYPES = Object.freeze({
    flameVent: Object.freeze({
      id: "flameVent",
      label: "Flame Vent",
      minDepth: 35,
      maxPerRoom: 2,
      replacementChance: 0.14,
      cycleTurns: 3
    }),
    frostRune: Object.freeze({
      id: "frostRune",
      label: "Frost Rune",
      minDepth: 50,
      maxPerRoom: 2,
      replacementChance: 0.12
    })
  });

  function normalizeDepth(depth) {
    return Math.max(0, Math.floor(Number(depth) || 0));
  }

  function isRoomTypeUnlocked(roomType, depth) {
    const def = ROOM_TYPES[String(roomType || "")];
    return Boolean(def && normalizeDepth(depth) >= def.minDepth);
  }

  function getRoomWeightMap(regionId, depth) {
    const safeRegionId = String(regionId || "descent");
    const safeDepth = normalizeDepth(depth);
    const weights = {};
    for (const def of Object.values(ROOM_TYPES)) {
      weights[def.id] = safeDepth >= def.minDepth
        ? Math.max(0, Number(def.regionWeights?.[safeRegionId]) || 0)
        : 0;
    }
    return weights;
  }

  function isEnemyTypeUnlocked(enemyType, depth) {
    const def = ENEMY_TYPES[String(enemyType || "")];
    return Boolean(def && normalizeDepth(depth) >= def.minDepth);
  }

  function getEnemyTypeCap(enemyType) {
    const def = ENEMY_TYPES[String(enemyType || "")];
    return def ? Math.max(0, Math.floor(Number(def.maxPerRoom) || 0)) : 0;
  }

  function isTrapTypeUnlocked(trapType, depth) {
    const def = TRAP_TYPES[String(trapType || "")];
    return Boolean(def && normalizeDepth(depth) >= def.minDepth);
  }

  function getTrapProfile(trapType) {
    return TRAP_TYPES[String(trapType || "")] || null;
  }

  const api = {
    ROOM_TYPES,
    ENEMY_TYPES,
    TRAP_TYPES,
    isRoomTypeUnlocked,
    getRoomWeightMap,
    isEnemyTypeUnlocked,
    getEnemyTypeCap,
    isTrapTypeUnlocked,
    getTrapProfile
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonExpansionContent = api;
  }
})();
