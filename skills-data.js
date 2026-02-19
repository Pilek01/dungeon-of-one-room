(() => {
  const SKILLS = [
    {
      id: "dash",
      key: "Z",
      name: "Dash",
      cooldown: 10,
      desc: "3-tile pierce + knockback"
    },
    {
      id: "aoe",
      key: "X",
      name: "Shockwave",
      cooldown: 30,
      desc: "Base 60% damage, +20% per Fury spent"
    },
    {
      id: "shield",
      key: "C",
      name: "Shield",
      cooldown: 20,
      desc: "Full immunity for 3 turns after cast"
    }
  ];

  const SKILL_BY_ID = Object.fromEntries(SKILLS.map((skill) => [skill.id, skill]));
  const DEFAULT_SKILL_COOLDOWNS = Object.fromEntries(SKILLS.map((skill) => [skill.id, 0]));
  const MAX_SKILL_TIER = 3;
  const SKILL_TIER_LABELS = ["Base", "Rare", "Epic", "Legendary"];
  const DEFAULT_SKILL_TIERS = Object.fromEntries(SKILLS.map((skill) => [skill.id, 0]));
  const MERCHANT_SKILL_UPGRADES = {
    dash: [
      { tier: 1, label: "Rare", cost: 400, desc: "+100% dash damage" },
      { tier: 2, label: "Epic", cost: 800, desc: "Range +1 and landing splash damage" },
      { tier: 3, label: "Legendary", cost: 1600, desc: "First dash hit +60% damage. Leaves afterline for 4 turns (40% ATK)." }
    ],
    aoe: [
      { tier: 1, label: "Rare", cost: 600, desc: "Damage x1.5 + knockback" },
      { tier: 2, label: "Epic", cost: 1200, desc: "Radius 2 with falloff (ring1 100%, ring2 70%)" },
      { tier: 3, label: "Legendary", cost: 2400, desc: "Overload Wave: ring1 120%, ring2 80%. Ring1 disorients for 2 turns." }
    ],
    shield: [
      { tier: 1, label: "Rare", cost: 300, desc: "Shield stores 2 charges. One returns every 20 turns. Cast pushes nearby enemies." },
      { tier: 2, label: "Epic", cost: 600, desc: "Keeps Rare charge system. Blocking reflects x2 damage and taunts enemies." },
      { tier: 3, label: "Legendary", cost: 1200, desc: "Aegis Counter: store 40% blocked damage. On fade, blast 2 rings." }
    ]
  };

  window.DungeonSkillsData = {
    SKILLS,
    SKILL_BY_ID,
    DEFAULT_SKILL_COOLDOWNS,
    MAX_SKILL_TIER,
    SKILL_TIER_LABELS,
    DEFAULT_SKILL_TIERS,
    MERCHANT_SKILL_UPGRADES
  };
})();
