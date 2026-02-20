(() => {
  const CHEST_BLESSING_LIFE_CHANCE = 0;
  const SHRINE_BLESSING_CHANCE = 0.85;

  const CHEST_THRESHOLD_TREASURE = {
    health: 0.12,
    healing: 0.23,
    attack: 0.38,
    armor: 0.48,
    potion: 0.59,
    map_fragment: 0.84,
    gold: 0.97
  };

  const CHEST_THRESHOLD_STANDARD = {
    health: 0.18,
    healing: 0.38,
    attack: 0.62,
    armor: 0.78,
    potion: 0.9,
    map_fragment: 0.94,
    gold: 0.97
  };

  function rollChestOutcome({ inTreasureRoom = false, hasShrineWard = false, rng = Math.random } = {}) {
    const table = inTreasureRoom ? CHEST_THRESHOLD_TREASURE : CHEST_THRESHOLD_STANDARD;
    const roll = rng();
    let outcome = "trap";
    if (roll < table.health) outcome = "health";
    else if (roll < table.healing) outcome = "healing";
    else if (roll < table.attack) outcome = "attack";
    else if (roll < table.armor) outcome = "armor";
    else if (roll < table.potion) outcome = "potion";
    else if (roll < table.map_fragment) outcome = "map_fragment";
    else if (roll < table.gold) outcome = "gold";
    if (outcome === "trap" && hasShrineWard) {
      outcome = "gold";
    }
    return {
      outcome,
      grantsLife: rng() < CHEST_BLESSING_LIFE_CHANCE
    };
  }

  function rollShrineOutcome({
    hasShrineWard = false,
    rng = Math.random
  } = {}) {
    const blessing = hasShrineWard || rng() < SHRINE_BLESSING_CHANCE;
    if (!blessing) {
      const curseRoll = Math.floor(rng() * 3) + 1;
      if (curseRoll === 1) return { type: "curse", curse: "pain" };
      if (curseRoll === 2) return { type: "curse", curse: "summon" };
      return { type: "curse", curse: "swap" };
    }
    const roll = Math.floor(rng() * 8) + 1;
    if (roll === 1) return { type: "blessing", blessing: "max_hp" };
    if (roll === 2) return { type: "blessing", blessing: "attack" };
    if (roll === 3) return { type: "blessing", blessing: "armor" };
    if (roll === 4) return { type: "blessing", blessing: "potion" };
    if (roll === 5) return { type: "blessing", blessing: "fury" };
    if (roll === 6) return { type: "blessing", blessing: "swapping" };
    if (roll === 7) return { type: "blessing", blessing: "noise" };
    return { type: "blessing", blessing: "hunger" };
  }

  window.DungeonLootTables = {
    CHEST_BLESSING_LIFE_CHANCE,
    SHRINE_BLESSING_CHANCE,
    CHEST_THRESHOLD_TREASURE,
    CHEST_THRESHOLD_STANDARD,
    rollChestOutcome,
    rollShrineOutcome
  };
})();
