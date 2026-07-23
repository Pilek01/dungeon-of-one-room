(() => {
  // Fixed showcase tiles: six torch markers (3) plus deterministic restrained floor variation.
  const DESCENT_HD_FLOOR_PATTERN = Object.freeze([
    [0, 1, 6, 8, 9, 8, 6, 1, 0],
    [1, 3, 0, 6, 8, 6, 0, 3, 1],
    [6, 0, 1, 8, 9, 8, 1, 0, 6],
    [8, 6, 8, 0, 1, 0, 8, 6, 8],
    [9, 8, 3, 1, 0, 1, 3, 8, 9],
    [8, 6, 8, 0, 1, 0, 8, 6, 8],
    [6, 0, 1, 8, 9, 8, 1, 0, 6],
    [1, 3, 0, 6, 8, 6, 0, 3, 1],
    [0, 1, 6, 8, 9, 8, 6, 1, 0]
  ].map((row) => Object.freeze(row)));

  // Keeps the actor comparison lanes clear of tall brazier markers (semantic 3).
  const ACTOR_PROPORTIONS_HD_FLOOR_PATTERN = Object.freeze([
    [0, 1, 6, 8, 9, 8, 6, 1, 0],
    [1, 0, 8, 6, 1, 6, 8, 0, 1],
    [6, 8, 1, 0, 9, 0, 1, 8, 6],
    [8, 6, 0, 1, 6, 1, 0, 6, 8],
    [9, 1, 9, 6, 0, 6, 9, 1, 9],
    [8, 6, 0, 1, 6, 1, 0, 6, 8],
    [6, 8, 1, 0, 9, 0, 1, 8, 6],
    [1, 0, 8, 6, 1, 6, 8, 0, 1],
    [0, 1, 6, 8, 9, 8, 6, 1, 0]
  ].map((row) => Object.freeze(row)));

  const FLOOR_VARIANT_HD_PATTERN = Object.freeze([
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 3, 4, 5, 6, 0],
    [0, 7, 8, 9, 0, 1, 2, 3, 0],
    [0, 4, 5, 6, 7, 8, 9, 0, 0],
    [0, 1, 2, 3, 4, 5, 6, 7, 0],
    [0, 8, 9, 0, 1, 2, 3, 4, 0],
    [0, 5, 6, 7, 8, 9, 0, 1, 0],
    [0, 2, 3, 4, 5, 6, 7, 8, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ].map((row) => Object.freeze(row)));

  const FLOOR_VARIANT_HD_MATRIX = Object.fromEntries(
    [["descent", 1], ["corruption", 25], ["abyss", 45]].map(([theme, depth]) => {
      const id = `${theme}_floor_variants_hd`;
      return [id, Object.freeze({
        id,
        label: `${theme} HD floor variants`,
        autoStart: true,
        depth,
        roomType: "combat",
        forcedNextRoomType: "combat",
        forceRoomHDShowcaseSetup: true,
        floorVariantShowcase: true,
        floorPattern: FLOOR_VARIANT_HD_PATTERN
      })];
    })
  );

  const STATUS_EMBLEM_COVERAGE = Object.freeze({
    player: Object.freeze(["bleed", "poison", "shield", "barrier", "fury", "shrine_blessing", "elixir"]),
    enemy: Object.freeze(["freeze", "burn", "disorient", "enemy_buff"]),
    crests: Object.freeze(["elite", "relentless", "juggernaut", "blooddrinker", "thorned", "volatile"])
  });

  const ROOM_HD_MATRIX = Object.fromEntries(
    [
      ["corruption", 25],
      ["abyss", 45]
    ].flatMap(([theme, depth]) => (
      ["combat", "treasure", "shrine", "cursed", "merchant", "vault", "otter", "forge", "pact", "boss"]
        .map((roomType) => {
          const id = `${theme}_${roomType}_hd`;
          return [id, Object.freeze({
            id,
            label: `${theme} ${roomType} HD showcase`,
            autoStart: true,
            depth,
            roomType,
            bossRoom: roomType === "boss",
            finalBossPhase: theme === "abyss" && roomType === "boss" ? 2 : 0,
            forcedNextRoomType: roomType === "boss" ? "combat" : roomType,
            forceRoomHDShowcaseSetup: true,
            floorPattern: DESCENT_HD_FLOOR_PATTERN
          })];
        })
    ))
  );

  const SCENARIOS = Object.freeze({
    descent_hd: Object.freeze({
      id: "descent_hd",
      label: "Descent HD Showcase",
      autoStart: true,
      depth: 1,
      forcedNextRoomType: "shrine",
      forceDescentHDShowcaseSetup: true,
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    enemy_roster_hd: Object.freeze({
      id: "enemy_roster_hd",
      label: "Enemy Roster HD Showcase",
      autoStart: true,
      depth: 1,
      forcedNextRoomType: "combat",
      forceEnemyHDShowcaseSetup: true,
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    actor_proportions_hd: Object.freeze({
      id: "actor_proportions_hd",
      label: "HD Actor Proportions Showcase",
      autoStart: true,
      depth: 25,
      roomType: "merchant",
      forcedNextRoomType: "merchant",
      forceActorProportionsHDShowcaseSetup: true,
      floorPattern: ACTOR_PROPORTIONS_HD_FLOOR_PATTERN
    }),
    merchant_buyback_hd: Object.freeze({
      id: "merchant_buyback_hd",
      label: "HD Merchant Buyback Showcase",
      autoStart: true,
      depth: 25,
      roomType: "merchant",
      forcedNextRoomType: "merchant",
      forceMerchantBuybackHDShowcaseSetup: true,
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    vfx_showcase_hd: Object.freeze({
      id: "vfx_showcase_hd",
      label: "Combat VFX HD Showcase",
      autoStart: true,
      depth: 32,
      forcedNextRoomType: "cursed",
      forceVfxHDShowcaseSetup: true,
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    skill_vfx_tiers_hd: Object.freeze({
      id: "skill_vfx_tiers_hd",
      label: "Skill VFX Tier Showcase",
      autoStart: true,
      depth: 32,
      forcedNextRoomType: "combat",
      forceSkillVfxTierShowcaseSetup: true,
      floorPattern: ACTOR_PROPORTIONS_HD_FLOOR_PATTERN
    }),
    player_shield_hd: Object.freeze({
      id: "player_shield_hd",
      label: "Player Shield HD Showcase",
      autoStart: true,
      depth: 1,
      forcedNextRoomType: "shrine",
      forcePlayerProtectionHDShowcaseSetup: "shield",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    player_barrier_hd: Object.freeze({
      id: "player_barrier_hd",
      label: "Player Barrier HD Showcase",
      autoStart: true,
      depth: 1,
      forcedNextRoomType: "shrine",
      forcePlayerProtectionHDShowcaseSetup: "barrier",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    status_emblems_hd: Object.freeze({
      id: "status_emblems_hd",
      label: "Status Emblems HD Showcase",
      autoStart: true,
      depth: 25,
      forcedNextRoomType: "combat",
      forceStatusEmblemsHDShowcaseSetup: true,
      statusCoverage: STATUS_EMBLEM_COVERAGE,
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    vault_guardian_hd: Object.freeze({
      id: "vault_guardian_hd",
      label: "Vault Guardian HD Showcase",
      autoStart: true,
      depth: 30,
      forcedNextRoomType: "vault",
      forceBossHDShowcaseSetup: true,
      bossProfile: "vault-guardian",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    descent_warden_hd: Object.freeze({
      id: "descent_warden_hd",
      label: "Descent Warden HD Showcase",
      autoStart: true,
      depth: 5,
      forcedNextRoomType: "boss",
      forceBossHDShowcaseSetup: true,
      bossProfile: "warden-biome",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    corruption_warden_hd: Object.freeze({
      id: "corruption_warden_hd",
      label: "Corruption Warden HD Showcase",
      autoStart: true,
      depth: 25,
      forcedNextRoomType: "boss",
      forceBossHDShowcaseSetup: true,
      bossProfile: "warden-biome",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    abyss_warden_hd: Object.freeze({
      id: "abyss_warden_hd",
      label: "Abyss Warden HD Showcase",
      autoStart: true,
      depth: 45,
      forcedNextRoomType: "boss",
      forceBossHDShowcaseSetup: true,
      bossProfile: "warden-biome",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    beyond_warden_hd: Object.freeze({
      id: "beyond_warden_hd",
      label: "Beyond Warden HD Showcase",
      autoStart: true,
      depth: 65,
      forcedNextRoomType: "boss",
      forceBossHDShowcaseSetup: true,
      bossProfile: "warden-biome",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    beyond_pit_hd: Object.freeze({
      id: "beyond_pit_hd",
      label: "Beyond Pit HD Showcase",
      autoStart: true,
      depth: 61,
      forcedNextRoomType: "combat",
      forceBeyondPitHDShowcaseSetup: true,
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    expansion_enemies_hd: Object.freeze({
      id: "expansion_enemies_hd",
      label: "Expansion Enemies HD Showcase",
      autoStart: true,
      depth: 70,
      forcedNextRoomType: "combat",
      forceExpansionHDShowcaseSetup: "enemies",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    expansion_traps_hd: Object.freeze({
      id: "expansion_traps_hd",
      label: "Expansion Traps HD Showcase",
      autoStart: true,
      depth: 70,
      forcedNextRoomType: "combat",
      forceExpansionHDShowcaseSetup: "traps",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    expansion_crossroads_hd: Object.freeze({
      id: "expansion_crossroads_hd",
      label: "Expansion Crossroads HD Showcase",
      autoStart: true,
      depth: 42,
      forcedNextRoomType: "crossroads",
      forceExpansionHDShowcaseSetup: "crossroads",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    expansion_arena_hd: Object.freeze({
      id: "expansion_arena_hd",
      label: "Expansion Arena HD Showcase",
      autoStart: true,
      depth: 55,
      forcedNextRoomType: "arena",
      forceExpansionHDShowcaseSetup: "arena",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    expansion_endgame_boss_adds_hd: Object.freeze({
      id: "expansion_endgame_boss_adds_hd",
      label: "Endgame Boss Adds HD Showcase",
      autoStart: true,
      depth: 85,
      forcedNextRoomType: "boss",
      forceExpansionHDShowcaseSetup: "warden-endgame-adds",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),    expansion_warden_lattice_sequence_hd: Object.freeze({
      id: "expansion_warden_lattice_sequence_hd",
      label: "Endgame Warden Rift Lattice Sequence HD Showcase",
      autoStart: true,
      depth: 85,
      forcedNextRoomType: "boss",
      forceExpansionHDShowcaseSetup: "warden-lattice-sequence",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),    expansion_warden_collapse_hd: Object.freeze({
      id: "expansion_warden_collapse_hd",
      label: "Collapse Warden HD Showcase",
      autoStart: true,
      depth: 65,
      forcedNextRoomType: "boss",
      forceExpansionHDShowcaseSetup: "warden-collapse",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    expansion_warden_reborn_hd: Object.freeze({
      id: "expansion_warden_reborn_hd",
      label: "Reborn Warden HD Showcase",
      autoStart: true,
      depth: 100,
      forcedNextRoomType: "boss",
      forceExpansionHDShowcaseSetup: "warden-reborn",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    expansion_warden_doom_sigils_hd: Object.freeze({
      id: "expansion_warden_doom_sigils_hd",
      label: "Reborn Warden Doom Sigils HD Showcase",
      autoStart: true,
      depth: 100,
      forcedNextRoomType: "boss",
      forceExpansionHDShowcaseSetup: "warden-doom-sigils",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    expansion_forge_boss_hd: Object.freeze({
      id: "expansion_forge_boss_hd",
      label: "Expanded Forge Boss HD Showcase",
      autoStart: true,
      depth: 45,
      forcedNextRoomType: "forge",
      forceExpansionHDShowcaseSetup: "forge-boss",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    expansion_vault_guardian_hd: Object.freeze({
      id: "expansion_vault_guardian_hd",
      label: "Expanded Vault Guardian HD Showcase",
      autoStart: true,
      depth: 55,
      forcedNextRoomType: "vault",
      forceExpansionHDShowcaseSetup: "vault-guardian-abilities",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    blacksmith_guardian_hd: Object.freeze({
      id: "blacksmith_guardian_hd",
      label: "Blacksmith Guardian HD Showcase",
      autoStart: true,
      depth: 25,
      forcedNextRoomType: "forge",
      forceBossHDShowcaseSetup: true,
      bossProfile: "blacksmith-guardian",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    warden_phase1_hd: Object.freeze({
      id: "warden_phase1_hd",
      label: "Warden Phase One HD Showcase",
      autoStart: true,
      depth: 100,
      forcedNextRoomType: "boss",
      forceBossHDShowcaseSetup: true,
      bossProfile: "warden-phase-1",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    warden_phase2_aegis_hd: Object.freeze({
      id: "warden_phase2_aegis_hd",
      label: "Warden Phase Two Aegis HD Showcase",
      autoStart: true,
      depth: 100,
      forcedNextRoomType: "boss",
      forceBossHDShowcaseSetup: true,
      bossProfile: "warden-phase-2",
      floorPattern: DESCENT_HD_FLOOR_PATTERN
    }),
    forge: Object.freeze({
      id: "forge",
      label: "Forge Chamber",
      autoStart: true,
      depth: 24,
      forcedNextRoomType: "forge"
    }),
    forge_transmute: Object.freeze({
      id: "forge_transmute",
      label: "Forge Chamber Transmute",
      autoStart: true,
      depth: 24,
      forcedNextRoomType: "forge",
      forceForgeTransmuteSetup: true
    }),
    relic_exchange: Object.freeze({
      id: "relic_exchange",
      label: "Camp Relic Management",
      autoStart: true,
      depth: 35,
      forceRelicExchangeSetup: true
    }),
    pact: Object.freeze({
      id: "pact",
      label: "Pact Chamber",
      autoStart: true,
      depth: 34,
      forcedNextRoomType: "pact"
    }),
    final_chamber_transition: Object.freeze({
      id: "final_chamber_transition",
      label: "Final Chamber Transition",
      autoStart: true,
      depth: 100,
      forceBossPhaseTransitionSetup: true
    }),
    ...FLOOR_VARIANT_HD_MATRIX,
    ...ROOM_HD_MATRIX
  });

  function cloneScenario(definition, options = {}) {
    return {
      ...definition,
      floorPattern: Array.isArray(definition.floorPattern)
        ? definition.floorPattern.map((row) => Array.from(row))
        : undefined,
      depth: definition.id === "final_chamber_transition"
        ? Math.max(1, Number(options.maxDepth) || 100)
        : definition.depth
    };
  }

  function parseScenarioRequest(search = "", options = {}) {
    const params = new URLSearchParams(String(search || ""));
    const id = String(params.get("scenario") || "").trim().toLowerCase();
    if (!id || !Object.prototype.hasOwnProperty.call(SCENARIOS, id)) return null;
    return cloneScenario(SCENARIOS[id], options);
  }

  function createFloorPatternForScenario(scenario, randomPatternFactory) {
    if (scenario && (
      scenario.id === "descent_hd"
      || scenario.id === "enemy_roster_hd"
      || scenario.forceActorProportionsHDShowcaseSetup === true
      || scenario.forceMerchantBuybackHDShowcaseSetup === true
      || scenario.forceVfxHDShowcaseSetup === true
      || scenario.forceSkillVfxTierShowcaseSetup === true
      || scenario.forceBeyondPitHDShowcaseSetup === true
      || Boolean(scenario.forceExpansionHDShowcaseSetup)
      || scenario.forceBossHDShowcaseSetup === true
      || scenario.forceRoomHDShowcaseSetup === true
    )) {
      const source = Array.isArray(scenario.floorPattern)
        ? scenario.floorPattern
        : DESCENT_HD_FLOOR_PATTERN;
      return source.map((row) => Array.from(row));
    }
    if (typeof randomPatternFactory !== "function") {
      throw new TypeError("randomPatternFactory must be a function");
    }
    return randomPatternFactory();
  }

  window.DungeonScenarioOverrides = Object.freeze({
    SCENARIOS,
    ROOM_HD_MATRIX,
    DESCENT_HD_FLOOR_PATTERN,
    FLOOR_VARIANT_HD_PATTERN,
    FLOOR_VARIANT_HD_MATRIX,
    parseScenarioRequest,
    createFloorPatternForScenario
  });
})();
