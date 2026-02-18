(() => {
  const CHEST_BLESSING_LIFE_CHANCE = 0.005;
  const SHRINE_BLESSING_CHANCE = 0.85;

  const CHEST_THRESHOLD_TREASURE = {
    health: 0.14,
    healing: 0.28,
    attack: 0.46,
    armor: 0.58,
    potion: 0.72,
    gold: 0.97
  };

  const CHEST_THRESHOLD_STANDARD = {
    health: 0.18,
    healing: 0.38,
    attack: 0.62,
    armor: 0.78,
    potion: 0.9,
    gold: 0.97
  };

  function rollChestOutcome({ inTreasureRoom = false, rng = Math.random } = {}) {
    const table = inTreasureRoom ? CHEST_THRESHOLD_TREASURE : CHEST_THRESHOLD_STANDARD;
    const roll = rng();
    let outcome = "trap";
    if (roll < table.health) outcome = "health";
    else if (roll < table.healing) outcome = "healing";
    else if (roll < table.attack) outcome = "attack";
    else if (roll < table.armor) outcome = "armor";
    else if (roll < table.potion) outcome = "potion";
    else if (roll < table.gold) outcome = "gold";
    return {
      outcome,
      grantsLife: rng() < CHEST_BLESSING_LIFE_CHANCE
    };
  }

  function rollShrineOutcome({
    hasShrineWard = false,
    furyChance = 0.1,
    rng = Math.random
  } = {}) {
    const blessing = hasShrineWard || rng() < SHRINE_BLESSING_CHANCE;
    if (!blessing) {
      return { type: "curse" };
    }
    if (rng() < furyChance) {
      return { type: "blessing", blessing: "fury" };
    }
    const roll = Math.floor(rng() * 4) + 1;
    if (roll === 1) return { type: "blessing", blessing: "max_hp" };
    if (roll === 2) return { type: "blessing", blessing: "attack" };
    if (roll === 3) return { type: "blessing", blessing: "armor" };
    return { type: "blessing", blessing: "potion" };
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
