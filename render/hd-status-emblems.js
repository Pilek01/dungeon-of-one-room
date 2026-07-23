(function attachHDStatusEmblems(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DungeonHDStatusEmblems = api;
})(typeof window !== "undefined" ? window : null, function createHDStatusEmblemsApi() {
  "use strict";

  const CATALOG = [
    ["bleed", "harmful", "Bleed", 10], ["poison", "harmful", "Poison", 20],
    ["burn", "harmful", "Burn", 20], ["freeze", "harmful", "Freeze", 10],
    ["disorient", "harmful", "Disorient", 30], ["enemy_buff", "arcane", "Enemy Buff", 40],
    ["fury", "positive", "Fury", 50], ["attack_up", "positive", "Attack Up", 50],
    ["armor_up", "positive", "Armor Up", 50], ["max_hp_up", "positive", "Max HP Up", 50],
    ["lifesteal", "positive", "Lifesteal", 50], ["elixir", "positive", "Elixir", 60],
    ["shield", "protection", "Shield", 30], ["barrier", "protection", "Barrier", 40],
    ["second_chance", "positive", "Second Chance", 60],
    ["shrine_blessing", "positive", "Shrine Blessing", 70],
    ["chaos", "special", "Chaos", 80], ["pact", "special", "Pact", 80],
    ["hunger", "harmful", "Hunger", 25], ["swap", "special", "Swap", 80],
    ["noise", "harmful", "Noise", 25], ["soul_harvest", "special", "Soul Harvest", 80],
    ["storm_sigil", "special", "Storm Sigil", 80], ["quickloader", "positive", "Quickloader", 60],
    ["chest_upgrade", "positive", "Chest Upgrade", 60], ["last_stand", "positive", "Last Stand", 60],
    ["elite", "elite", "Elite", 0], ["relentless", "affix", "Relentless", 1],
    ["juggernaut", "affix", "Juggernaut", 1], ["blooddrinker", "affix", "Blooddrinker", 1],
    ["thorned", "affix", "Thorned", 1], ["volatile", "affix", "Volatile", 1]
  ];
  const entries = Object.freeze(CATALOG.map(([id, tone, label, priority]) => Object.freeze({
    id,
    key: `ui.status.${id}`,
    src: `assets/hd/ui/status/${id.replaceAll("_", "-")}.png`,
    tone,
    label,
    priority
  })));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const AFFIX_ALIASES = Object.freeze({ fast: "relentless", tank: "juggernaut", vampiric: "blooddrinker" });
  const HUD_LABELS = Object.freeze({
    "grave whisper": "attack_up", "fractured sigil": "barrier", "burn dps": "burn",
    "shrine arm": "shrine_blessing", "shrine atk": "shrine_blessing",
    "shrine max hp": "shrine_blessing", "blood barrier": "barrier", "crown pulse": "barrier",
    "borrowed time": "barrier", "thin buckler": "barrier", momentum: "quickloader",
    "engine of war": "fury", "chest atk": "chest_upgrade", "chest arm": "chest_upgrade",
    "chest max hp": "chest_upgrade", "fury bless": "fury", "combat boost": "attack_up",
    "last resort": "last_stand", "chaos atk": "chaos", bleed: "bleed", poison: "poison", burn: "burn",
    freeze: "freeze", disorient: "disorient", fury: "fury", shield: "shield", barrier: "barrier",
    elixir: "elixir", lifesteal: "lifesteal", "second chance": "second_chance",
    chaos: "chaos", pact: "pact", hunger: "hunger", swap: "swap", noise: "noise",
    "soul harvest": "soul_harvest", "storm sigil": "storm_sigil", quickloader: "quickloader",
    "chest upgrade": "chest_upgrade", "last stand": "last_stand"
  });

  function getDescriptor(id) {
    return byId.get(String(id || "").trim().toLowerCase()) || null;
  }

  function getHudStatusId(label) {
    const normalized = String(label || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (Object.prototype.hasOwnProperty.call(HUD_LABELS, normalized)) return HUD_LABELS[normalized];
    return normalized.startsWith("shrine ") ? "shrine_blessing" : null;
  }

  function hasPositiveNumber(record, fields) {
    return fields.some((field) => (Number(record[field]) || 0) > 0);
  }

  function selectActorStatuses(actor, options = {}) {
    const source = actor && typeof actor === "object" ? actor : {};
    const kind = options.kind === "enemy" ? "enemy" : "player";
    const limit = Math.max(0, Math.floor(Number(options.limit) || 3));
    const ids = [];
    if (kind === "enemy") {
      if (source.frozen === true || source.frost === true || source.frostFx || source.frozenThisTurn === true) ids.push("freeze");
      if (source.burn === true || (Number(source.burnTurns) || 0) > 0) ids.push("burn");
      if (source.disoriented === true || (Number(source.disorientedTurns) || 0) > 0) ids.push("disorient");
      if (source.acolyteBuff === true || (Number(source.acolyteBuffTurns) || 0) > 0) ids.push("enemy_buff");
    } else {
      if (source.bleeding === true) ids.push("bleed");
      if (source.poisoned === true) ids.push("poison");
      if (hasPositiveNumber(source, ["skillShield", "bloodVialShield", "crownShield"])) ids.push("shield");
      if (hasPositiveNumber(source, ["hpShield", "fracturedShieldBarrier", "barrierArmor", "barrierTurns"])) ids.push("barrier");
      if (source.furyBlessed === true) ids.push("fury");
      if ((Number(source.elixirTurns) || 0) > 0) ids.push("elixir");
      if (source.shrineBlessed === true) ids.push("shrine_blessing");
    }
    const ordered = ids.map(getDescriptor).filter(Boolean)
      .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
    const visible = Object.freeze(ordered.slice(0, limit));
    return Object.freeze({ visible, overflow: Math.max(0, ordered.length - visible.length) });
  }

  function selectEnemyCrests(enemy) {
    const source = enemy && typeof enemy === "object" ? enemy : {};
    const result = [];
    if (source.elite === true) result.push(getDescriptor("elite"));
    const rawAffix = String(source.affix || "").trim().toLowerCase();
    const canonical = AFFIX_ALIASES[rawAffix] || rawAffix;
    const descriptor = getDescriptor(canonical);
    if (descriptor && descriptor.tone === "affix") result.push(descriptor);
    return Object.freeze(result);
  }

  return Object.freeze({ entries, getDescriptor, getHudStatusId, selectActorStatuses, selectEnemyCrests });
});
