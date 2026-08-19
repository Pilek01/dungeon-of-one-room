(function attachVisualSnapshot(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.DungeonVisualSnapshot = api;
  }
})(typeof window !== "undefined" ? window : null, function createVisualSnapshotApi() {
  "use strict";

  const ROOT_FIELDS = [
    "phase",
    "depth",
    "roomType",
    "bossRoom",
    "roomCleared",
    "finalBossPhase",
    "portalPulse",
    "shake",
    "flash",
    "playerAnimTimer",
    "roomIntroTimer",
    "roomIntroDuration",
    "roomIntroTitle",
    "roomIntroSubtitle",
    "dashAimActive"
  ];
  const PLAYER_FIELDS = [
    "x",
    "y",
    "hp",
    "maxHp",
    "facing",
    "lastMoveX",
    "lastMoveY",
    "visualAction",
    "visualActionTimer",
    "visualDeathTimer",
    "_tweenT",
    "_tweenFromX",
    "_tweenFromY",
    "hitFlash",
    "barrierArmor",
    "barrierTurns",
    "hpShield",
    "fracturedShieldBarrier",
    "skillShield",
    "bloodVialShield",
    "crownShield",
    "crownShieldTurnsLeft",
    "shieldCharges",
    "elixirType",
    "elixirTurns",
    "frozenMoveTurns"
  ];
  const ENEMY_FIELDS = [
    "id",
    "type",
    "renderType",
    "name",
    "x",
    "y",
    "hp",
    "maxHp",
    "facing",
    "_tweenT",
    "_tweenFromX",
    "_tweenFromY",
    "elite",
    "affix",
    "hitFlash",
    "castFlash",
    "frostFx",
    "frozenThisTurn",
    "disorientedTurns",
    "aiming",
    "slamAiming",
    "volleyAiming",
    "burstAiming",
    "anvilAiming",
    "anvilDx",
    "anvilDy",
    "riftAiming",
    "riftTargetX",
    "riftTargetY",
    "bulwarkBashAiming",
    "latticeAiming",
    "latticeCooldown",
    "latticeTurnsRemaining",
    "latticeCastsRemaining",
    "voidStepAiming",
    "voidStepOriginX",
    "voidStepOriginY",
    "voidStepCooldown",
    "doomSigilCooldown",
    "soulChainAiming",
    "soulChainCooldown",
    "blacksmithChainAiming",
    "blacksmithChainCooldown",
    "blacksmithOverheated",
    "vaultSentenceCooldown",
    "vaultLockdownCooldown",
    "vaultLockdownAiming",
    "vaultChestDestroyedTurn",
    "wardenAbilityCycle",
    "telegraphAge",
    "rests",
    "acolyteCastType",
    "acolyteBuffTurns",
    "blacksmithBarrier",
    "blacksmithBarrierTurns",
    "voidAegisShield",
    "voidAegisTurns",
    "burnTurns"
  ];
  const TILE_FIELDS = ["x", "y"];
  const SPIKE_FIELDS = ["x", "y", "active"];
  const MINE_FIELDS = ["x", "y", "armed", "fuseTurns"];
  const FLAME_VENT_FIELDS = ["x", "y", "fuseTurns", "activeFlash"];
  const FROST_RUNE_FIELDS = ["x", "y", "spent", "activeFlash"];
  const DOOM_SIGIL_FIELDS = ["x", "y", "damage", "fuseTurns", "placement"];
  const CHEST_FIELDS = [
    "id", "type", "x", "y", "opened", "confirmPending", "destroyed",
    "vaultCondemned", "vaultCondemnTurns", "vaultCondemnMaxTurns"
  ];
  const OTTER_CHEST_FIELDS = ["x", "y", "opened"];
  const SHRINE_FIELDS = ["x", "y", "used"];
  const FORGE_FIELDS = [
    "x",
    "y",
    "originX",
    "originY",
    "width",
    "height",
    "awakened",
    "used"
  ];
  const PACT_FIELDS = ["x", "y", "awakened", "used"];
  const MERCHANT_FIELDS = ["x", "y"];
  const PORTAL_FIELDS = ["x", "y", "active"];
  const VOLATILE_BURST_FIELDS = ["x", "y", "source", "fuseTurns"];
  const PARTICLE_FIELDS = ["x", "y", "vx", "vy", "life", "maxLife", "size", "color"];
  const FLOATING_TEXT_FIELDS = ["x", "y", "vx", "vy", "life", "maxLife", "text", "color", "size"];
  const RANGED_BOLT_FIELDS = ["fromX", "fromY", "toX", "toY", "color", "progress", "speed", "life", "maxLife"];
  const RANGED_IMPACT_FIELDS = ["x", "y", "color", "radius", "life", "maxLife"];
  const DASH_TRAIL_FIELDS = ["fromX", "fromY", "toX", "toY", "color", "life", "maxLife", "tier", "style", "seed"];
  const BLOOD_STAIN_FIELDS = ["x", "y", "life", "maxLife", "seed"];
  const SHOCKWAVE_RING_FIELDS = [
    "x", "y", "radius", "maxRadius", "life", "maxLife", "color", "core",
    "skill", "tier", "style", "furySpent", "ringIndex", "seed"
  ];
  const DASH_AFTERLINE_FIELDS = ["turns", "maxTurns"];
  const VISUAL_EVENT_FIELDS = ["kind", "x", "y", "facing", "startedAtMs", "durationMs", "sourceId"];
  const PLAYER_SHRINE_TURN_FIELDS = [
    "furyBlessingTurns",
    "shrineAttackTurns",
    "shrineArmorTurns",
    "shrineMaxHpTurns",
    "shrineSwapTurns",
    "shrineNoiseTurns",
    "shrineHungerTurns"
  ];
  const SPECIAL_PORTAL_KINDS = new Set(["vault", "forge", "otter"]);
  const FURY_BLESSING_VISUAL_BONUS = 2;

  function hasOwn(source, field) {
    return Object.prototype.hasOwnProperty.call(source, field);
  }

  function copyRecord(source, fields) {
    if (source == null) return source;
    if (typeof source !== "object" || Array.isArray(source)) return undefined;

    const copy = {};
    for (const field of fields) {
      if (hasOwn(source, field)) {
        const value = source[field];
        if (value === null || (typeof value !== "object" && typeof value !== "function")) {
          copy[field] = value;
        }
      }
    }
    return copy;
  }

  function copyRecordArray(source, fields) {
    if (source == null) return source;
    if (!Array.isArray(source)) return undefined;
    return source.map((item) => copyRecord(item, fields));
  }

  function copyFloorPattern(source) {
    if (source == null) return source;
    if (!Array.isArray(source)) return undefined;
    return source.map((row) => {
      if (!Array.isArray(row)) return [];
      return Array.from(row, (tileId) => (
        tileId === null || (typeof tileId === "number" && Number.isFinite(tileId))
          ? tileId
          : null
      ));
    });
  }

  function copyDashAfterline(source) {
    const copy = copyRecord(source, DASH_AFTERLINE_FIELDS);
    if (!copy || !hasOwn(source, "tiles")) return copy;
    copy.tiles = copyRecordArray(source.tiles, TILE_FIELDS);
    return copy;
  }

  function copyVisualEvents(source, nowMs) {
    if (!Array.isArray(source)) return source == null ? source : undefined;
    const now = Math.max(0, Number(nowMs) || 0);
    return source
      .filter((event) => event && now - Number(event.startedAtMs) < Number(event.durationMs))
      .map((event) => {
        const copy = copyRecord(event, VISUAL_EVENT_FIELDS);
        if (copy && Array.isArray(event.tiles)) copy.tiles = copyRecordArray(event.tiles, TILE_FIELDS);
        return copy;
      });
  }

  function copyPlayer(source) {
    const copy = copyRecord(source, PLAYER_FIELDS);
    if (!copy) return copy;

    const furyBlessed = (Number(source.furyBlessingTurns) || 0) > 0;
    copy.effectiveAdrenaline = Math.max(0, Number(source.adrenaline) || 0) +
      (furyBlessed ? FURY_BLESSING_VISUAL_BONUS : 0);
    copy.furyBlessed = furyBlessed;
    copy.bleeding = (Number(source.bleedTurns) || 0) > 0;
    copy.poisoned = (Number(source.poisonTurns) || 0) > 0;
    copy.shrineBlessed = PLAYER_SHRINE_TURN_FIELDS.some((field) => (Number(source[field]) || 0) > 0);
    copy.shrineArmorBlessed = (Number(source.shrineArmorTurns) || 0) > 0;
    if (hasOwn(source, "dashAfterline")) {
      copy.dashAfterline = copyDashAfterline(source.dashAfterline);
    }
    return copy;
  }

  function copyForge(source) {
    const copy = copyRecord(source, FORGE_FIELDS);
    if (!copy || !hasOwn(source, "blockedTiles")) return copy;
    copy.blockedTiles = copyRecordArray(source.blockedTiles, TILE_FIELDS);
    return copy;
  }

  function copyEnemies(source, hasScoutLens) {
    if (source == null) return source;
    if (!Array.isArray(source)) return undefined;
    return source.map((enemy) => {
      const copy = copyRecord(enemy, ENEMY_FIELDS);
      if (!copy) return copy;
      copy.showHpBar = hasScoutLens || enemy.hp < (enemy.maxHp || enemy.hp);
      if (Array.isArray(enemy.latticeRows)) {
        copy.latticeRows = enemy.latticeRows.filter((value) => Number.isFinite(Number(value))).map(Number).slice(0, 2);
      }
      if (Array.isArray(enemy.latticeColumns)) {
        copy.latticeColumns = enemy.latticeColumns.filter((value) => Number.isFinite(Number(value))).map(Number).slice(0, 2);
      }
      if (Array.isArray(enemy.latticePatterns)) {
        copy.latticePatterns = enemy.latticePatterns.slice(0, 2).map((pattern, index) => ({
          rows: Array.isArray(pattern?.rows) ? pattern.rows.filter((value) => Number.isFinite(Number(value))).map(Number).slice(0, 1) : [],
          columns: Array.isArray(pattern?.columns) ? pattern.columns.filter((value) => Number.isFinite(Number(value))).map(Number).slice(0, 1) : [],
          turnsRemaining: Math.max(0, Math.round(Number(pattern?.turnsRemaining) || 0)),
          sequenceIndex: Math.max(1, Math.min(2, Math.round(Number(pattern?.sequenceIndex) || index + 1)))
        }));
      }
      if (Array.isArray(enemy.soulChainTiles)) {
        copy.soulChainTiles = copyRecordArray(enemy.soulChainTiles, TILE_FIELDS);
      }
      if (Array.isArray(enemy.blacksmithChainTiles)) {
        copy.blacksmithChainTiles = copyRecordArray(enemy.blacksmithChainTiles, TILE_FIELDS);
      }
      if (Array.isArray(enemy.vaultLockdownTargets)) {
        copy.vaultLockdownTargets = copyRecordArray(enemy.vaultLockdownTargets, TILE_FIELDS);
      }
      return copy;
    });
  }

  function copyPortal(source, visualState) {
    const copy = copyRecord(source, PORTAL_FIELDS);
    if (!copy) return copy;

    const nextDepth = Math.max(0, Number(visualState.depth) || 0) + 1;
    const nextRoomIsBoss = nextDepth > 0 && nextDepth % 5 === 0;
    const rankedNextRoomType = visualState.onlineV3NextDirective?.roomType;
    const nextRoomIsWarden = nextRoomIsBoss || (
      visualState.onlineV3Ranked === true &&
      (rankedNextRoomType === "boss" || rankedNextRoomType === "final")
    );
    const forcedKind = visualState.forcedNextRoomType;
    copy.kind = nextRoomIsWarden
      ? "warden"
      : !nextRoomIsBoss && SPECIAL_PORTAL_KINDS.has(forcedKind)
        ? forcedKind
        : "default";
    return copy;
  }

  function createVisualSnapshot(source, nowMs) {
    const visualState = source && typeof source === "object" ? source : {};
    const snapshot = copyRecord(visualState, ROOT_FIELDS) || {};

    snapshot.nowMs = nowMs;
    snapshot.tileSize = 64;
    snapshot.gridSize = 9;
    snapshot.floorPattern = copyFloorPattern(visualState.floorPattern);
    snapshot.player = copyPlayer(visualState.player);
    const hasScoutLens = Array.isArray(visualState.relics) && visualState.relics.includes("scoutlens");
    snapshot.enemies = copyEnemies(visualState.enemies, hasScoutLens);
    snapshot.pits = copyRecordArray(visualState.pits, TILE_FIELDS);
    snapshot.spikes = copyRecordArray(visualState.spikes, SPIKE_FIELDS);
    snapshot.mines = copyRecordArray(visualState.mines, MINE_FIELDS);
    snapshot.flameVents = copyRecordArray(visualState.flameVents, FLAME_VENT_FIELDS);
    snapshot.frostRunes = copyRecordArray(visualState.frostRunes, FROST_RUNE_FIELDS);
    snapshot.doomSigils = copyRecordArray(visualState.doomSigils, DOOM_SIGIL_FIELDS);
    snapshot.chests = copyRecordArray(visualState.chests, CHEST_FIELDS);
    const otterChestSource = visualState.otterChest || (
      Array.isArray(visualState.chests)
        ? visualState.chests.find((chest) => chest && chest.type === "otter_red")
        : undefined
    );
    snapshot.otterChest = copyRecord(otterChestSource, OTTER_CHEST_FIELDS);
    snapshot.vaultCleared = typeof visualState.vaultCleared === "boolean"
      ? visualState.vaultCleared
      : visualState.roomType === "vault"
        ? visualState.roomCleared === true
        : undefined;
    snapshot.shrine = copyRecord(visualState.shrine, SHRINE_FIELDS);
    snapshot.forge = copyForge(visualState.forge);
    snapshot.pact = copyRecord(visualState.pact, PACT_FIELDS);
    snapshot.merchant = copyRecord(visualState.merchant, MERCHANT_FIELDS);
    snapshot.portal = copyPortal(visualState.portal, visualState);
    snapshot.volatileBursts = copyRecordArray(visualState.volatileBursts, VOLATILE_BURST_FIELDS);
    snapshot.particles = copyRecordArray(visualState.particles, PARTICLE_FIELDS);
    snapshot.floatingTexts = copyRecordArray(visualState.floatingTexts, FLOATING_TEXT_FIELDS);
    snapshot.rangedBolts = copyRecordArray(visualState.rangedBolts, RANGED_BOLT_FIELDS);
    snapshot.rangedImpacts = copyRecordArray(visualState.rangedImpacts, RANGED_IMPACT_FIELDS);
    snapshot.dashTrails = copyRecordArray(visualState.dashTrails, DASH_TRAIL_FIELDS);
    snapshot.bloodStains = copyRecordArray(visualState.bloodStains, BLOOD_STAIN_FIELDS);
    snapshot.shockwaveRings = copyRecordArray(visualState.shockwaveRings, SHOCKWAVE_RING_FIELDS);
    snapshot.visualEvents = copyVisualEvents(visualState.visualEvents, nowMs);

    return snapshot;
  }

  const api = { createVisualSnapshot };
  api.renderFrame = function renderFrame(source, nowMs, renderSelectedFrame) {
    if (typeof renderSelectedFrame !== "function") {
      throw new TypeError("renderSelectedFrame must be a function");
    }
    const snapshot = api.createVisualSnapshot(source, nowMs);
    renderSelectedFrame(snapshot);
    return snapshot;
  };
  return api;
});
