(function () {
  const BOSS_PROFILES = Object.freeze([
    Object.freeze({
      id: "descent",
      minDepth: 0,
      maxDepth: 19,
      name: "Gate Warden",
      label: "Gatekeeper",
      abilitySet: "gate",
      usesLegacyPulse: true,
      usesLegacyBurst: true,
      predictivePulse: false,
      hpMultiplier: 1.0,
      attackMultiplier: 1.0,
      pulseRange: 4,
      pulseCooldown: 3,
      pulseDamageMultiplier: 1.0,
      burstRange: 3,
      burstCooldown: 7,
      burstCancelCooldown: 7,
      burstDamageMultiplier: 1.15,
      smartAi: false,
      setupSpikePenalty: 22,
      meleeRetreatChance: 0.2,
      voidAegisEnabled: false,
      voidAegisShieldMultiplier: 0.0,
      voidAegisDurationTurns: 0,
      voidAegisCooldownTurns: 0,
      voidAegisMaxUses: 0,
      voidAegisCastHpRatio: 0.0,
      introText: "A patient gatekeeper testing the basics."
    }),
    Object.freeze({
      id: "corruption",
      minDepth: 20,
      maxDepth: 39,
      name: "Corrupt Warden",
      label: "Corrupter",
      abilitySet: "corruption",
      usesLegacyPulse: true,
      usesLegacyBurst: true,
      predictivePulse: true,
      hpMultiplier: 1.04,
      attackMultiplier: 1.05,
      pulseRange: 4,
      pulseCooldown: 3,
      pulseDamageMultiplier: 1.05,
      burstRange: 4,
      burstCooldown: 6,
      burstCancelCooldown: 3,
      burstDamageMultiplier: 1.2,
      smartAi: true,
      setupSpikePenalty: 55,
      meleeRetreatChance: 0.4,
      voidAegisEnabled: false,
      voidAegisShieldMultiplier: 0.0,
      voidAegisDurationTurns: 0,
      voidAegisCooldownTurns: 0,
      voidAegisMaxUses: 0,
      voidAegisCastHpRatio: 0.0,
      introText: "Now it starts punishing slow and messy runs."
    }),
    Object.freeze({
      id: "rupture",
      minDepth: 40,
      maxDepth: 59,
      name: "Rift Warden",
      label: "Riftbinder",
      abilitySet: "rupture",
      usesLegacyPulse: true,
      usesLegacyBurst: true,
      predictivePulse: true,
      hpMultiplier: 1.08,
      attackMultiplier: 1.08,
      pulseRange: 4,
      pulseCooldown: 3,
      pulseDamageMultiplier: 1.1,
      burstRange: 4,
      burstCooldown: 5,
      burstCancelCooldown: 3,
      burstDamageMultiplier: 1.25,
      smartAi: true,
      setupSpikePenalty: 58,
      meleeRetreatChance: 0.35,
      voidAegisEnabled: true,
      voidAegisShieldMultiplier: 0.30,
      voidAegisDurationTurns: 5,
      voidAegisCooldownTurns: 8,
      voidAegisMaxUses: 2,
      voidAegisCastHpRatio: 0.60,
      introText: "Rupture depths arm the Warden with Void Aegis."
    }),
    Object.freeze({
      id: "collapse",
      minDepth: 60,
      maxDepth: 79,
      name: "Collapse Warden",
      label: "Collapse Engine",
      abilitySet: "collapse",
      usesLegacyPulse: false,
      usesLegacyBurst: false,
      predictivePulse: false,
      latticeCooldown: 5,
      latticeDetonationDelayTurns: 2,
      latticeCastCount: 1,
      latticeDamageMultiplier: 0.90,
      voidStepCooldown: 6,
      voidStepDamageMultiplier: 0.70,
      latticeDoubleLine: false,
      hpMultiplier: 1.12,
      attackMultiplier: 1.12,
      pulseRange: 4,
      pulseCooldown: 2,
      pulseDamageMultiplier: 1.12,
      burstRange: 4,
      burstCooldown: 5,
      burstCancelCooldown: 2,
      burstDamageMultiplier: 1.3,
      smartAi: true,
      setupSpikePenalty: 64,
      meleeRetreatChance: 0.28,
      voidAegisEnabled: false,
      voidAegisShieldMultiplier: 0.34,
      voidAegisDurationTurns: 5,
      voidAegisCooldownTurns: 7,
      voidAegisMaxUses: 0,
      voidAegisCastHpRatio: 0.66,
      introText: "The model changes: Rift Lattice and Void Step replace the old pulse pattern."
    }),
    Object.freeze({
      id: "endgame",
      minDepth: 80,
      maxDepth: 999,
      name: "Abyssal Warden",
      label: "Abyssal Core",
      abilitySet: "abyssal",
      usesLegacyPulse: false,
      usesLegacyBurst: false,
      predictivePulse: false,
      latticeCooldown: 5,
      latticeDetonationDelayTurns: 2,
      latticeCastCount: 2,
      latticeDamageMultiplier: 1.00,
      voidStepCooldown: 5,
      voidStepDamageMultiplier: 0.80,
      latticeDoubleLine: false,
      hpMultiplier: 1.16,
      attackMultiplier: 1.16,
      pulseRange: 5,
      pulseCooldown: 2,
      pulseDamageMultiplier: 1.16,
      burstRange: 5,
      burstCooldown: 4,
      burstCancelCooldown: 2,
      burstDamageMultiplier: 1.35,
      smartAi: true,
      setupSpikePenalty: 70,
      meleeRetreatChance: 0.22,
      voidAegisEnabled: false,
      voidAegisShieldMultiplier: 0.38,
      voidAegisDurationTurns: 6,
      voidAegisCooldownTurns: 7,
      voidAegisMaxUses: 0,
      voidAegisCastHpRatio: 0.72,
      introText: "Abyssal Wardens cast two staggered Rift Lattices before entering cooldown."
    })
  ]);

  const FINAL_BOSS_PHASE_PROFILES = Object.freeze([
    Object.freeze({
      phase: 1,
      id: "final-warden-phase-1",
      name: "Abyssal Warden",
      label: "Phase I",
      abilitySet: "abyssal",
      usesLegacyPulse: false,
      usesLegacyBurst: false,
      predictivePulse: false,
      latticeCooldown: 5,
      latticeDetonationDelayTurns: 2,
      latticeCastCount: 2,
      latticeDamageMultiplier: 1.05,
      voidStepCooldown: 5,
      voidStepDamageMultiplier: 0.85,
      latticeDoubleLine: false,
      hpMultiplier: 1.2,
      attackMultiplier: 1.18,
      pulseRange: 5,
      pulseCooldown: 2,
      pulseDamageMultiplier: 1.2,
      burstRange: 5,
      burstCooldown: 4,
      burstCancelCooldown: 2,
      burstDamageMultiplier: 1.42,
      smartAi: true,
      setupSpikePenalty: 72,
      meleeRetreatChance: 0.18,
      voidAegisEnabled: false,
      voidAegisShieldMultiplier: 0.42,
      voidAegisDurationTurns: 6,
      voidAegisCooldownTurns: 6,
      voidAegisMaxUses: 0,
      voidAegisCastHpRatio: 0.75,
      introText: "Phase I uses the complete Abyssal kit from the deepest campaign."
    }),
    Object.freeze({
      phase: 2,
      id: "final-warden-phase-2",
      name: "Abyssal Warden Reborn",
      label: "Phase II",
      abilitySet: "reborn",
      usesLegacyPulse: false,
      usesLegacyBurst: false,
      predictivePulse: false,
      doomSigilCooldown: 5,
      doomSigilDamageMultiplier: 1.15,
      soulChainCooldown: 5,
      soulChainDamageMultiplier: 0.80,
      doomSigilCount: 3,
      hpMultiplier: 1.34,
      attackMultiplier: 1.28,
      pulseRange: 5,
      pulseCooldown: 1,
      pulseDamageMultiplier: 1.3,
      burstRange: 5,
      burstCooldown: 3,
      burstCancelCooldown: 1,
      burstDamageMultiplier: 1.55,
      smartAi: true,
      setupSpikePenalty: 78,
      meleeRetreatChance: 0.08,
      voidAegisEnabled: false,
      voidAegisShieldMultiplier: 0.48,
      voidAegisDurationTurns: 6,
      voidAegisCooldownTurns: 5,
      voidAegisMaxUses: 0,
      voidAegisCastHpRatio: 0.82,
      introText: "Phase II abandons the old kit for Doom Sigils and the Soul Chain."
    })
  ]);

  function getBossProfile(depth = 0) {
    const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
    for (const profile of BOSS_PROFILES) {
      if (safeDepth >= profile.minDepth && safeDepth <= profile.maxDepth) {
        return profile;
      }
    }
    return BOSS_PROFILES[BOSS_PROFILES.length - 1];
  }

  function getFinalBossPhaseProfile(phase = 1) {
    const normalizedPhase = Number(phase) === 2 ? 2 : 1;
    return FINAL_BOSS_PHASE_PROFILES[normalizedPhase - 1];
  }

  function getBossEncounterProfile(depth = 0, phase = 1) {
    const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
    if (safeDepth === 100) {
      return getFinalBossPhaseProfile(phase);
    }
    return getBossProfile(safeDepth);
  }

  const api = {
    BOSS_PROFILES,
    FINAL_BOSS_PHASE_PROFILES,
    getBossProfile,
    getFinalBossPhaseProfile,
    getBossEncounterProfile
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonBossCampaign = api;
  }
})();
