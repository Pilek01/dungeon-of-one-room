(function () {
  const ARCHETYPES = Object.freeze({
    assault: { id: "assault", label: "Assault" },
    crit: { id: "crit", label: "Crit" },
    sustain: { id: "sustain", label: "Sustain" },
    barrier: { id: "barrier", label: "Barrier" },
    skills: { id: "skills", label: "Skill Engine" },
    economy: { id: "economy", label: "Greed" },
    control: { id: "control", label: "Control" },
    attrition: { id: "attrition", label: "Attrition" }
  });

  const RELIC_BUILD_TAGS = Object.freeze({
    fang: { assault: 2 },
    plating: { barrier: 1, sustain: 1 },
    lucky: { crit: 2 },
    flask: { sustain: 1 },
    lifebloom: { sustain: 2 },
    ironboots: { sustain: 1 },
    fieldrations: { sustain: 2 },
    quickloader: { skills: 1, assault: 1 },
    trapweave: { sustain: 1, control: 2 },
    cachekey: { barrier: 2, economy: 1 },
    idol: { economy: 3 },
    thornmail: { barrier: 1, control: 1 },
    adrenal: { skills: 2, assault: 1 },
    scoutlens: { control: 1 },
    magnet: { economy: 2 },
    shrineward: { sustain: 1, control: 1 },
    merchfavor1: { economy: 2 },
    merchfavor: { economy: 3 },
    merchfavor3: { economy: 4 },
    risk: { assault: 3 },
    sharpsight: { assault: 2, crit: 1 },
    gambleredge: { crit: 3 },
    laststandtorque: { assault: 2, sustain: 1 },
    thinbuckler: { barrier: 3 },
    duelistseal: { assault: 3, control: 1 },
    afterimageboots: { skills: 2, barrier: 2 },
    alchemistscoil: { skills: 3, sustain: 1 },
    vampfang: { sustain: 3, assault: 1 },
    glasscannon: { assault: 4 },
    echostrike: { crit: 2, assault: 2 },
    phasecloak: { barrier: 2, skills: 1 },
    soulharvest: { sustain: 2, attrition: 1 },
    burnblade: { attrition: 3, assault: 1 },
    frostamulet: { control: 3 },
    bloodvial: { barrier: 3, sustain: 1 },
    executionseal: { assault: 3 },
    stormsigil: { skills: 2, assault: 1 },
    gravewhisper: { attrition: 2, assault: 2 },
    mirrorcarapace: { barrier: 2, sustain: 1 },
    momentumengine: { skills: 2, assault: 1 },
    executionchain: { skills: 3, assault: 1 },
    aegisdynamo: { barrier: 3, assault: 2 },
    hazardprism: { control: 3, attrition: 2 },
    fracturedsigil: { barrier: 4 },
    borrowedtime: { barrier: 3, skills: 1 },
    deadeyeprism: { crit: 4 },
    chronoloop: { sustain: 3, barrier: 1 },
    voidreaper: { crit: 4, economy: 1 },
    titanheart: { sustain: 3, barrier: 2 },
    engineofwar: { barrier: 2, assault: 2, sustain: 1 },
    lastresort: { skills: 2, sustain: 2 },
    crownofoneroom: { barrier: 4 },
    chaosorb: { skills: 2, assault: 1, economy: 1 },
    perfectrhythm: { assault: 4, control: 1 },
    labyrinthheart: { sustain: 3, assault: 2 },
    oathofruin: { skills: 4, assault: 1 },
    abyssalreliquary: { economy: 1 },
    crownconcord: { economy: 1, skills: 1, assault: 1 }
  });

  const RARITY_SCORE = Object.freeze({
    normal: 0.2,
    rare: 0.45,
    epic: 0.8,
    legendary: 1.1,
    mythic: 1.3
  });

  function createEmptyScores() {
    return Object.keys(ARCHETYPES).reduce((out, key) => {
      out[key] = 0;
      return out;
    }, {});
  }

  function normalizeRelic(relic) {
    if (!relic) return null;
    if (typeof relic === "string") {
      return { id: relic, rarity: "normal" };
    }
    if (typeof relic.id !== "string") return null;
    return {
      id: relic.id,
      rarity: typeof relic.rarity === "string" ? relic.rarity : "normal"
    };
  }

  function getRelicWeights(relic) {
    const normalized = normalizeRelic(relic);
    if (!normalized) return {};
    return RELIC_BUILD_TAGS[normalized.id] || {};
  }

  function sortArchetypes(scores) {
    return Object.values(ARCHETYPES)
      .map((entry) => ({ ...entry, score: Number(scores[entry.id]) || 0 }))
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  }

  function analyzeRelicLoadout(relics) {
    const normalized = (relics || []).map(normalizeRelic).filter(Boolean);
    const scores = createEmptyScores();

    for (const relic of normalized) {
      const weights = getRelicWeights(relic);
      for (const [archetypeId, value] of Object.entries(weights)) {
        scores[archetypeId] = (Number(scores[archetypeId]) || 0) + Number(value || 0);
      }
    }

    const ranked = sortArchetypes(scores);
    return {
      relicCount: normalized.length,
      scores,
      ranked,
      primary: ranked[0],
      secondary: ranked[1]
    };
  }

  function scoreRelicForBuild(relic, buildProfile) {
    const normalized = normalizeRelic(relic);
    if (!normalized) return 0;
    const profile = buildProfile && buildProfile.scores ? buildProfile : analyzeRelicLoadout([]);
    const weights = getRelicWeights(normalized);
    let score = Number(RARITY_SCORE[normalized.rarity]) || 0;

    for (const [archetypeId, value] of Object.entries(weights)) {
      const buildStrength = Number(profile.scores[archetypeId]) || 0;
      score += Number(value || 0) * (1 + buildStrength * 0.75);
    }

    if (profile.primary && weights[profile.primary.id]) {
      score += 1.5;
    }
    if (profile.secondary && weights[profile.secondary.id]) {
      score += 0.8;
    }

    return score;
  }

  function rankDraftChoices(choices, loadout) {
    const profile = analyzeRelicLoadout(loadout || []);
    return [...(choices || [])]
      .map((relic) => ({
        ...relic,
        buildScore: scoreRelicForBuild(relic, profile)
      }))
      .sort((a, b) =>
        b.buildScore - a.buildScore ||
        ((Number(RARITY_SCORE[b.rarity]) || 0) - (Number(RARITY_SCORE[a.rarity]) || 0)) ||
        String(a.name || a.id).localeCompare(String(b.name || b.id))
      );
  }

  function getBuildIdentitySummary(relics) {
    const profile = analyzeRelicLoadout(relics);
    if (!profile.primary || profile.primary.score <= 0) {
      return {
        title: "Unshaped Run",
        detail: "No dominant build yet.",
        profile
      };
    }
    const parts = [profile.primary.label];
    if (profile.secondary && profile.secondary.score > 0) {
      parts.push(profile.secondary.label);
    }
    return {
      title: parts.join(" / "),
      detail: `${profile.primary.label} is currently leading this run.`,
      profile
    };
  }

  const api = {
    ARCHETYPES,
    RELIC_BUILD_TAGS,
    analyzeRelicLoadout,
    scoreRelicForBuild,
    rankDraftChoices,
    getBuildIdentitySummary
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonBuildIdentity = api;
  }
})();
