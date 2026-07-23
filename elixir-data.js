(() => {
  const ELIXIR_STACK_MAX = 5;
  const ELIXIR_DURATION_TURNS = 5;
  const ELIXIR_DISCARD_REFUND_RATIO = 0.5;

  const ELIXIRS = Object.freeze([
    {
      id: "iron_1",
      key: "1",
      tier: 1,
      unlockDepth: 0,
      name: "Ironskin Elixir I",
      statLabel: "+20 ARM",
      duration: ELIXIR_DURATION_TURNS,
      cost: 75,
      armorBonus: 2
    },
    {
      id: "fury_1",
      key: "2",
      tier: 1,
      unlockDepth: 0,
      name: "Battle Tonic I",
      statLabel: "+20 ATK",
      duration: ELIXIR_DURATION_TURNS,
      cost: 75,
      attackBonus: 2
    },
    {
      id: "focus_1",
      key: "3",
      tier: 1,
      unlockDepth: 0,
      name: "Focus Elixir I",
      statLabel: "+10% Crit",
      duration: ELIXIR_DURATION_TURNS,
      cost: 75,
      critBonus: 0.1
    },
    {
      id: "iron_2",
      key: "4",
      tier: 2,
      unlockDepth: 20,
      name: "Ironskin Elixir II",
      statLabel: "+40 ARM",
      duration: ELIXIR_DURATION_TURNS,
      cost: 200,
      armorBonus: 4
    },
    {
      id: "fury_2",
      key: "5",
      tier: 2,
      unlockDepth: 20,
      name: "Battle Tonic II",
      statLabel: "+40 ATK",
      duration: ELIXIR_DURATION_TURNS,
      cost: 200,
      attackBonus: 4
    },
    {
      id: "focus_2",
      key: "6",
      tier: 2,
      unlockDepth: 20,
      name: "Focus Elixir II",
      statLabel: "+20% Crit",
      duration: ELIXIR_DURATION_TURNS,
      cost: 200,
      critBonus: 0.2
    },
    {
      id: "iron_3",
      key: "7",
      tier: 3,
      unlockDepth: 40,
      name: "Ironskin Elixir III",
      statLabel: "+60 ARM",
      duration: ELIXIR_DURATION_TURNS,
      cost: 500,
      armorBonus: 6
    },
    {
      id: "fury_3",
      key: "8",
      tier: 3,
      unlockDepth: 40,
      name: "Battle Tonic III",
      statLabel: "+60 ATK",
      duration: ELIXIR_DURATION_TURNS,
      cost: 500,
      attackBonus: 6
    },
    {
      id: "focus_3",
      key: "9",
      tier: 3,
      unlockDepth: 40,
      name: "Focus Elixir III",
      statLabel: "+30% Crit",
      duration: ELIXIR_DURATION_TURNS,
      cost: 500,
      critBonus: 0.3
    }
  ]);

  window.DungeonElixirData = Object.freeze({
    ELIXIR_STACK_MAX,
    ELIXIR_DURATION_TURNS,
    ELIXIR_DISCARD_REFUND_RATIO,
    ELIXIRS
  });
})();
