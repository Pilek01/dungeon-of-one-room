(function attachHDRendererLayers(root, factory) {
  const vfxApi = typeof module === "object" && module.exports
    ? require("./hd-vfx.js")
    : root && root.DungeonHDVfx;
  const lightingApi = typeof module === "object" && module.exports
    ? require("./hd-lighting.js")
    : root && root.DungeonHDLighting;
  const statusApi = typeof module === "object" && module.exports
    ? require("./hd-status-emblems.js")
    : root && root.DungeonHDStatusEmblems;
  const pitApi = typeof module === "object" && module.exports
    ? require("../pit-hazard.js")
    : root && root.DungeonPitHazard;
  const api = factory(vfxApi, lightingApi, statusApi, pitApi);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.DungeonHDRendererLayers = api;
  }
})(typeof window !== "undefined" ? window : null, function createHDRendererLayersApi(vfxApi, lightingApi, statusApi, pitApi) {
  "use strict";

  const LAYER_ORDER = Object.freeze([
    "floor",
    "decals",
    "hazards",
    "objects",
    "telegraphs",
    "vfx",
    "enemies",
    "player",
    "lighting"
  ]);

  const TILE_SIZE = 64;
  const STANDARD_CHEST_RENDER_SIZE = TILE_SIZE * 0.7;
  const PLAYER_RENDER_SIZE = 80;
  const MERCHANT_RENDER_SIZE = 96;
  const LEGACY_TILE_SIZE = 16;
  const PLAYER_TWEEN_MS = 120;
  const PLAYER_ATTACK_VISUAL_MS = 240;
  const ENEMY_TWEEN_MS = 120;
  const ENEMY_ROSTER = Object.freeze(["slime", "skeleton", "brute", "acolyte", "skitter", "totem", "otter", "riftweaver", "bulwark"]);
  const ENEMY_RENDER_PROFILES = Object.freeze({
    brute: Object.freeze({ renderSize: 80 }),
    totem: Object.freeze({ renderSize: 80 }),
    riftweaver: Object.freeze({ renderSize: 72 }),
    bulwark: Object.freeze({ renderSize: 114 })
  });
  const BOSS_TYPES = Object.freeze(["guardian", "blacksmith_guardian", "warden"]);
  const ENEMY_CLIPS = Object.freeze({ idle: 4, move: 4, attack: 4, awaken: 4, cast: 4, hit: 2, death: 2 });
  const GRID_SIZE = 9;
  const ANIMATION_FRAME_MS = 160;
  const EXPANSION_ENEMY_ACTION_VISUAL_MS = 320;
  const WARDEN_CAST_VISUAL_MS = 360;
  const PORTAL_SWIRL_FRAME_MS = 80;
  const MINE_INACTIVE_FRAME_MS = 280;
  const MINE_ACTIVE_FRAME_MS = 140;
  const PROTECTION_FRAME_MS = 90;
  const PROTECTION_PROFILES = Object.freeze({
    "player-shield": Object.freeze({ size: 112, offsetY: 6, color: "#f0b230" }),
    "player-barrier": Object.freeze({ size: 124, offsetY: 8, color: "#2cc3f4" }),
    "blacksmith-barrier": Object.freeze({ size: 208, offsetY: 22, color: "#f46519" }),
    "warden-aegis": Object.freeze({ size: 232, offsetY: 10, color: "#7446f4" })
  });
  const DECAL_SUFFIXES = Object.freeze([
    "decal.crack",
    "grate.base",
    "rubble.base",
    "decal.stain01",
    "decal.stain02",
    "decal.stain03",
    "decal.sigil",
    "decal.vein",
    "decal.dust",
    "decal.scar",
    "decal.residue"
  ]);
  const TORCH_FRAME_KEYS = Object.freeze([
    "object.common.torch.lit01",
    "object.common.torch.lit02",
    "object.common.torch.lit03"
  ]);
  const PORTAL_FRAME_KEYS = Object.freeze([
    "object.common.portal.active01",
    "object.common.portal.active02",
    "object.common.portal.active03"
  ]);
  const PORTAL_SWIRL_STATES = Object.freeze(
    Array.from({ length: 8 }, (_, index) => `swirl${String(index + 1).padStart(2, "0")}`)
  );
  const PLAYER_DIRECTIONS = Object.freeze(["south", "north", "east", "west"]);
  const PLAYER_CLIPS = Object.freeze({
    idle: Object.freeze({ frameCount: 4, fps: 4, loop: true }),
    move: Object.freeze({ frameCount: 4, fps: 8, loop: true }),
    attack: Object.freeze({ frameCount: 4, fps: 12, loop: false }),
    hit: Object.freeze({ frameCount: 2, fps: 10, loop: false }),
    death: Object.freeze({ frameCount: 2, fps: 6, loop: false })
  });

  function getAsset(assets, key) {
    return assets instanceof Map ? assets.get(key) : undefined;
  }

  function drawAsset(context, assets, key, x, y, width = TILE_SIZE, height = TILE_SIZE) {
    const image = getAsset(assets, key);
    if (!image || !context || typeof context.drawImage !== "function") return false;
    context.drawImage(image, x, y, width, height);
    return true;
  }

  function drawGridAsset(context, assets, key, gridX, gridY) {
    if (!isGridCoordinate(gridX) || !isGridCoordinate(gridY)) return false;
    return drawAsset(context, assets, key, gridX * TILE_SIZE, gridY * TILE_SIZE);
  }

  function isGridCoordinate(value) {
    return Number.isInteger(value) && value >= 0 && value < GRID_SIZE;
  }

  function visualHash(depth, x, y, salt = 0) {
    let value = Math.imul((Number(depth) | 0) ^ 0x9e3779b9, 0x85ebca6b);
    value ^= Math.imul((Number(x) | 0) + 0x632be5ab, 0xc2b2ae35);
    value ^= Math.imul((Number(y) | 0) + 0x85157af5, 0x27d4eb2f);
    value ^= Number(salt) | 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    value ^= value >>> 16;
    return value >>> 0;
  }

  function getDepthBiome(depth) {
    const normalized = Math.max(0, Math.floor(Number(depth) || 0));
    if (normalized < 20) return "descent";
    if (normalized < 40) return "corruption";
    if (normalized < 60) return "abyss";
    return "beyond";
  }

  function getEnvironmentTheme(depth) {
    return getDepthBiome(depth);
  }

  function selectStandardChestAsset(snapshot) {
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    const specialRoom = ["forge", "pact", "vault", "otter"].includes(visual.roomType)
      ? visual.roomType
      : "";
    return `object.chest.${specialRoom || getEnvironmentTheme(visual.depth)}`;
  }

  function hashText(value) {
    const text = String(value == null ? "" : value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function visualVariantHash(depth, roomType, bossRoom, finalBossPhase, x, y, salt = 0) {
    let value = visualHash(depth, x, y, salt);
    value ^= hashText(roomType);
    value ^= bossRoom === true ? 0x6a09e667 : 0;
    value ^= Math.imul(Number(finalBossPhase) | 0, 0xbb67ae85);
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    return value >>> 0;
  }

  function selectStandardRoomBackground(snapshot) {
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    if (visual.bossRoom === true || ["forge", "vault", "otter"].includes(visual.roomType)) return "";
    const theme = getEnvironmentTheme(visual.depth);
    const variantCounts = { descent: 3, corruption: 3, abyss: 3, beyond: 3 };
    const count = variantCounts[theme] || 0;
    if (count <= 0) return "";
    const variant = visualVariantHash(
      visual.depth, visual.roomType, visual.bossRoom, visual.finalBossPhase, 0, 0, 0x4d2f9a31
    ) % count + 1;
    return `environment.${theme}.room${String(variant).padStart(2, "0")}`;
  }

  function selectBossRoomBackground(snapshot) {
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    if (visual.bossRoom !== true && visual.roomType !== "boss") return "";
    return `environment.${getEnvironmentTheme(visual.depth)}.bossroom`;
  }

  function hasFullRoomBackground(snapshot, assets) {
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    const fixedKey = ["forge", "vault", "otter"].includes(visual.roomType)
      ? `environment.${visual.roomType}.room`
      : (selectBossRoomBackground(visual) || selectStandardRoomBackground(visual));
    return Boolean(fixedKey && getAsset(assets, fixedKey));
  }

  function selectAnimationFrame(nowMs, keys, frameDurationMs = ANIMATION_FRAME_MS) {
    if (!Array.isArray(keys) || keys.length === 0) return undefined;
    const elapsed = Math.max(0, Number(nowMs) || 0);
    const duration = Number.isFinite(frameDurationMs) && frameDurationMs > 0
      ? frameDurationMs
      : ANIMATION_FRAME_MS;
    return keys[Math.floor(elapsed / duration) % keys.length];
  }

  function selectFloorVariant(noise) {
    const variants = ["base", "b", "crack_cross", "base", "var3", "crack_cross", "c", "skull", "var4", "b"];
    const index = Number(noise);
    return Number.isInteger(index) && index >= 0 && index < variants.length ? variants[index] : "base";
  }

  function canFloorReceiveDecal(noise) {
    const value = Number(noise);
    if (!Number.isInteger(value)) return true;
    return value !== 2 && value !== 3 && value !== 4 && value !== 5 && value !== 7;
  }

  function drawFloorLayer(context, snapshot, assets) {
    const fixedRoom = snapshot && ["forge", "vault", "otter"].includes(snapshot.roomType)
      ? snapshot.roomType
      : "";
    if (fixedRoom
        && drawAsset(context, assets, `environment.${fixedRoom}.room`, 0, 0, GRID_SIZE * TILE_SIZE, GRID_SIZE * TILE_SIZE)) {
      return;
    }
    const bossRoom = selectBossRoomBackground(snapshot);
    if (bossRoom
        && drawAsset(context, assets, bossRoom, 0, 0, GRID_SIZE * TILE_SIZE, GRID_SIZE * TILE_SIZE)) {
      return;
    }
    const standardRoom = selectStandardRoomBackground(snapshot);
    if (standardRoom
        && drawAsset(context, assets, standardRoom, 0, 0, GRID_SIZE * TILE_SIZE, GRID_SIZE * TILE_SIZE)) {
      return;
    }
    const theme = getEnvironmentTheme(snapshot && snapshot.depth);
    const floorPattern = snapshot && Array.isArray(snapshot.floorPattern) ? snapshot.floorPattern : [];
    for (let y = 0; y < GRID_SIZE; y += 1) {
      const row = Array.isArray(floorPattern[y]) ? floorPattern[y] : [];
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const variant = selectFloorVariant(row[x]);
        const preferred = `environment.${theme}.floor.${variant}`;
        if (!drawGridAsset(context, assets, preferred, x, y) && variant !== "base") {
          drawGridAsset(context, assets, `environment.${theme}.floor.base`, x, y);
        }
      }
    }

    const max = GRID_SIZE - 1;
    for (let offset = 1; offset < max; offset += 1) {
      drawGridAsset(context, assets, `environment.${theme}.wall.north`, offset, 0);
      drawGridAsset(context, assets, `environment.${theme}.wall.south`, offset, max);
      drawGridAsset(context, assets, `environment.${theme}.wall.west`, 0, offset);
      drawGridAsset(context, assets, `environment.${theme}.wall.east`, max, offset);
    }
    drawGridAsset(context, assets, `environment.${theme}.corner.northwest`, 0, 0);
    drawGridAsset(context, assets, `environment.${theme}.corner.northeast`, max, 0);
    drawGridAsset(context, assets, `environment.${theme}.corner.southwest`, 0, max);
    drawGridAsset(context, assets, `environment.${theme}.corner.southeast`, max, max);
  }

  function drawBloodStains(context, snapshot) {
    const stains = snapshot && Array.isArray(snapshot.bloodStains) ? snapshot.bloodStains : [];
    for (const stain of stains) {
      if (!stain || !isGridCoordinate(stain.x) || !isGridCoordinate(stain.y)) continue;
      const fade = Math.max(0, Math.min(1, Number(stain.life) / Math.max(1, Number(stain.maxLife) || 1)));
      const seed = Math.max(0, Number(stain.seed) || 0);
      const ageFadeIn = Math.min(1, ((Number(stain.maxLife) || 0) - (Number(stain.life) || 0) + 180) / 300);
      const centerX = stain.x * TILE_SIZE + TILE_SIZE * 0.5;
      const centerY = stain.y * TILE_SIZE + TILE_SIZE * 0.56;
      context.save();
      context.globalAlpha = (0.22 + fade * 0.55) * ageFadeIn;
      context.fillStyle = "#5e080c";
      context.beginPath();
      context.ellipse(centerX, centerY, 19 + seed % 4, 11 + seed % 3, (seed % 9) * 0.13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#a0161c";
      context.beginPath();
      context.arc(centerX - 16 + seed % 6, centerY - 11, 4, 0, Math.PI * 2);
      context.arc(centerX + 17, centerY + 6 - seed % 4, 3, 0, Math.PI * 2);
      context.arc(centerX + 5 - seed % 5, centerY - 15, 2.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawDecalsLayer(context, snapshot, assets) {
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    const theme = getEnvironmentTheme(visual.depth);
    const floorPattern = Array.isArray(visual.floorPattern) ? visual.floorPattern : [];
    if (!hasFullRoomBackground(visual, assets)) {
      for (let y = 1; y < GRID_SIZE - 1; y += 1) {
        const row = Array.isArray(floorPattern[y]) ? floorPattern[y] : [];
        for (let x = 1; x < GRID_SIZE - 1; x += 1) {
          if (!canFloorReceiveDecal(row[x])) continue;
          const selection = visualVariantHash(
            visual.depth, visual.roomType, visual.bossRoom, visual.finalBossPhase, x, y, 0x51ed270b
          ) % 89;
          if (selection < DECAL_SUFFIXES.length) {
            drawGridAsset(context, assets, `environment.${theme}.${DECAL_SUFFIXES[selection]}`, x, y);
          }
        }
      }
    }
    if (visual.roomType === "vault" || visual.roomType === "otter") {
      const group = visual.roomType === "otter" ? "otter" : "vault";
      const key = visual.roomCleared === true ? `object.${group}.seal.cleared` : `object.${group}.seal.blocked`;
      drawCentered(context, assets, key, 4, 4, TILE_SIZE * 2, TILE_SIZE * 2);
    }
    if (visual.bossRoom === true) {
      const phase = Number(visual.finalBossPhase) >= 2 ? "phase02" : "phase01";
      drawCentered(context, assets, `object.boss.floorseal.${phase}`, 4, 4, TILE_SIZE * 3, TILE_SIZE * 3);
    }
    const roomOverlay = {
      crossroads: "crossroads_overlay",
      arena: "blood_arena_overlay",
      ambush: "ambush_overlay",
      horde: "horde_overlay",
      duel: "duel_overlay"
    }[visual.roomType];
    if (roomOverlay) {
      drawAsset(context, assets, `asset.environment.expansion.rooms.${roomOverlay}`, 0, 0, GRID_SIZE * TILE_SIZE, GRID_SIZE * TILE_SIZE);
    }
    drawBloodStains(context, visual);
  }

  function drawFlameVentMarker(context, vent, nowMs, assets) {
    if (!context || !vent || typeof context.fillRect !== "function") return;
    const flash = Math.max(0, Number(vent.activeFlash) || 0);
    const fuse = Math.max(0, Math.round(Number(vent.fuseTurns) || 0));
    let state = "idle";
    let frameCount = 2;
    let frame = (Math.floor(nowMs / 180) % frameCount) + 1;
    if (flash > 0) {
      state = "eruption";
      frameCount = 6;
      frame = Math.min(frameCount, Math.max(1, 1 + Math.floor((260 - Math.min(260, flash)) / (260 / frameCount))));
    } else if (fuse <= 1) {
      state = "warning";
      frameCount = 2;
      frame = (Math.floor(nowMs / 110) % frameCount) + 1;
    } else if (fuse === 2) {
      state = "heating";
      frameCount = 3;
      frame = (Math.floor(nowMs / 150) % frameCount) + 1;
    }
    const key = `asset.hazards.expansion.flame_vent.${state}_${String(frame).padStart(2, "0")}`;
    const assetDrawn = drawGridAsset(context, assets, key, vent.x, vent.y);
    if (assetDrawn && state === "eruption") {
      const crossKey = `asset.hazards.expansion.flame_vent.cross_eruption.cross_eruption_${String(frame).padStart(2, "0")}`;
      drawCentered(context, assets, crossKey, vent.x, vent.y, 192, 192);
    }
    if (assetDrawn) return;
    const px = vent.x * TILE_SIZE;
    const py = vent.y * TILE_SIZE;
    const pulse = 0.5 + Math.sin((nowMs + vent.x * 83 + vent.y * 47) / 135) * 0.5;
    context.fillStyle = "#321b18";
    context.fillRect(px + 11, py + 11, 42, 42);
    context.strokeStyle = "#c9552f";
    context.lineWidth = 3;
    if (typeof context.strokeRect === "function") context.strokeRect(px + 12.5, py + 12.5, 39, 39);
    context.fillStyle = pulse > 0.48 ? "#ffb052" : "#df6637";
    context.fillRect(px + 29, py + 17, 6, 30);
    context.fillRect(px + 17, py + 29, 30, 6);
  }

  function drawFrostRuneMarker(context, rune, nowMs, assets) {
    if (!context || !rune || typeof context.fillRect !== "function") return;
    const flash = Math.max(0, Number(rune.activeFlash) || 0);
    let state = rune.spent === true ? "spent" : "pulse";
    let frameCount = rune.spent === true ? 1 : 4;
    let frame = (Math.floor(nowMs / 160) % frameCount) + 1;
    if (flash > 0) {
      state = "trigger";
      frameCount = 6;
      frame = Math.min(frameCount, Math.max(1, 1 + Math.floor((220 - Math.min(220, flash)) / (220 / frameCount))));
    }
    const key = `asset.hazards.expansion.frost_rune.${state}_${String(frame).padStart(2, "0")}`;
    if (drawGridAsset(context, assets, key, rune.x, rune.y)) return;
    if (rune.spent === true) return;
    const px = rune.x * TILE_SIZE;
    const py = rune.y * TILE_SIZE;
    const pulse = 0.5 + Math.sin((nowMs + rune.x * 59 + rune.y * 71) / 170) * 0.5;
    context.globalAlpha = 0.55 + pulse * 0.35;
    context.fillStyle = "#7edcff";
    context.fillRect(px + 30, py + 12, 4, 40);
    context.fillRect(px + 12, py + 30, 40, 4);
    context.fillStyle = "#dff8ff";
    context.fillRect(px + 21, py + 21, 22, 22);
    context.fillStyle = "#568ec7";
    context.fillRect(px + 27, py + 27, 10, 10);
    context.globalAlpha = 1;
  }

  function drawDoomSigilMarker(context, sigil, nowMs, assets) {
    if (!context || !sigil || typeof context.fillRect !== "function") return;
    const frame = (Math.floor(nowMs / 140) % 4) + 1;
    const key = `asset.vfx.expansion.warden.doom_sigil.charge.charge_${String(frame).padStart(2, "0")}`;
    if (drawGridAsset(context, assets, key, sigil.x, sigil.y)) return;
    const px = sigil.x * TILE_SIZE;
    const py = sigil.y * TILE_SIZE;
    const pulse = 0.5 + Math.sin((nowMs + sigil.x * 97 + sigil.y * 31) / 105) * 0.5;
    context.globalAlpha = 0.58 + pulse * 0.3;
    context.fillStyle = "#5c176e";
    context.fillRect(px + 10, py + 10, 44, 44);
    context.strokeStyle = "#ef72ff";
    context.lineWidth = 3;
    if (typeof context.strokeRect === "function") context.strokeRect(px + 12.5, py + 12.5, 39, 39);
    context.fillStyle = "#ffd7ff";
    context.fillRect(px + 29, py + 18, 6, 28);
    context.fillRect(px + 18, py + 29, 28, 6);
    context.globalAlpha = 1;
  }

  function drawHazardsLayer(context, snapshot, assets) {
    const pits = snapshot && Array.isArray(snapshot.pits) ? snapshot.pits : [];
    const spikes = snapshot && Array.isArray(snapshot.spikes) ? snapshot.spikes : [];
    const mines = snapshot && Array.isArray(snapshot.mines) ? snapshot.mines : [];
    const flameVents = snapshot && Array.isArray(snapshot.flameVents) ? snapshot.flameVents : [];
    const frostRunes = snapshot && Array.isArray(snapshot.frostRunes) ? snapshot.frostRunes : [];
    const doomSigils = snapshot && Array.isArray(snapshot.doomSigils) ? snapshot.doomSigils : [];
    const theme = getEnvironmentTheme(snapshot && snapshot.depth);
    const nowMs = Math.max(0, Number(snapshot && snapshot.nowMs) || 0);
    for (const pit of pits) {
      if (!pit) continue;
      const mask = pitApi && typeof pitApi.getPitMask === "function"
        ? pitApi.getPitMask(pits, pit.x, pit.y)
        : 0;
      drawGridAsset(context, assets, `hazard.beyond.pit.${String(mask).padStart(2, "0")}`, pit.x, pit.y);
    }
    for (const spike of spikes) {
      if (spike && spike.active !== false) {
        if (!drawCentered(context, assets, `hazard.${theme}.spikes.armed`, spike.x, spike.y, 56, 56)) {
          drawCentered(context, assets, "hazard.common.spikes.armed", spike.x, spike.y, 56, 56);
        }
      }
    }
    for (const mine of mines) {
      if (!mine) continue;
      const frameDuration = mine.armed === false ? MINE_INACTIVE_FRAME_MS : MINE_ACTIVE_FRAME_MS;
      const state = selectAnimationFrame(nowMs, ["unarmed", "armed"], frameDuration);
      if (!drawCentered(context, assets, `hazard.${theme}.mine.${state}`, mine.x, mine.y, 46, 46)) {
        drawCentered(context, assets, `hazard.common.mine.${state}`, mine.x, mine.y, 46, 46);
      }
    }
    for (const vent of flameVents) drawFlameVentMarker(context, vent, nowMs, assets);
    for (const rune of frostRunes) drawFrostRuneMarker(context, rune, nowMs, assets);
    for (const sigil of doomSigils) drawDoomSigilMarker(context, sigil, nowMs, assets);
  }

  function drawBottomCentered(context, assets, key, gridX, gridY, width, height) {
    if (!isGridCoordinate(gridX) || !isGridCoordinate(gridY)) return false;
    const x = gridX * TILE_SIZE + TILE_SIZE * 0.5 - width * 0.5;
    const y = gridY * TILE_SIZE + TILE_SIZE - height;
    return drawAsset(context, assets, key, x, y, width, height);
  }

  function drawCentered(context, assets, key, gridX, gridY, width, height, offsetX = 0, offsetY = 0) {
    if (!isGridCoordinate(gridX) || !isGridCoordinate(gridY)) return false;
    const x = gridX * TILE_SIZE + TILE_SIZE * 0.5 - width * 0.5 + offsetX;
    const y = gridY * TILE_SIZE + TILE_SIZE * 0.5 - height * 0.5 + offsetY;
    return drawAsset(context, assets, key, x, y, width, height);
  }

  function drawBottomCenteredFallback(context, assets, preferredKey, fallbackKey, gridX, gridY, width, height) {
    if (drawBottomCentered(context, assets, preferredKey, gridX, gridY, width, height)) return true;
    return fallbackKey
      ? drawBottomCentered(context, assets, fallbackKey, gridX, gridY, width, height)
      : false;
  }

  function drawObjectsLayer(context, snapshot, assets) {
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    const theme = getEnvironmentTheme(visual.depth);
    const floorPattern = Array.isArray(visual.floorPattern) ? visual.floorPattern : [];
    const torchState = visual.phase === "playing"
      ? selectAnimationFrame(visual.nowMs, ["lit01", "lit02", "lit03"])
      : "unlit";
    const torchKey = `environment.${theme}.torch.${torchState}`;
    const commonTorchKey = `object.common.torch.${torchState}`;
    if (!hasFullRoomBackground(visual, assets)) {
      for (let y = 1; y < Math.min(GRID_SIZE - 1, floorPattern.length); y += 1) {
        const row = Array.isArray(floorPattern[y]) ? floorPattern[y] : [];
        for (let x = 1; x < Math.min(GRID_SIZE - 1, row.length); x += 1) {
          if (row[x] === 3 && !drawGridAsset(context, assets, torchKey, x, y)) {
            drawGridAsset(context, assets, commonTorchKey, x, y);
          }
        }
      }
    }

    const occupiedRoomTiles = new Set();
    const reserveTile = (item) => {
      if (item && isGridCoordinate(item.x) && isGridCoordinate(item.y)) occupiedRoomTiles.add(`${item.x},${item.y}`);
    };
    reserveTile(visual.player);
    reserveTile(visual.portal);
    for (const group of [visual.enemies, visual.chests, visual.spikes, visual.mines, visual.flameVents, visual.frostRunes, visual.doomSigils]) {
      for (const item of Array.isArray(group) ? group : []) reserveTile(item);
    }
    const propKeysByRoom = {
      ambush: ["ambush_debris", "ambush_shadow"],
      horde: ["horde_banner", "horde_bones", "horde_nest"],
      duel: ["duel_banner", "duel_ring", "duel_weapons"]
    };
    const propKeys = propKeysByRoom[visual.roomType];
    if (propKeys) {
      const candidates = [[1, 1], [7, 1], [1, 7], [7, 7]];
      const count = 2 + visualHash(visual.depth, 4, 4, hashText(visual.roomType)) % 3;
      for (let index = 0; index < Math.min(count, candidates.length); index += 1) {
        const candidate = candidates[(index + visualHash(visual.depth, index, count)) % candidates.length];
        if (occupiedRoomTiles.has(`${candidate[0]},${candidate[1]}`)) continue;
        const name = propKeys[index % propKeys.length];
        drawGridAsset(context, assets, `asset.objects.expansion.room_props.${visual.roomType}.${name}`, candidate[0], candidate[1]);
      }
    }
    if (visual.roomType === "arena") {
      drawGridAsset(context, assets, "asset.objects.expansion.blood_arena.gate.closed_01", 4, 1);
      drawGridAsset(context, assets, "asset.objects.expansion.blood_arena.banner.banner_01", 1, 1);
      drawGridAsset(context, assets, "asset.objects.expansion.blood_arena.banner.banner_02", 7, 1);
    }

    const chests = Array.isArray(visual.chests) ? visual.chests : [];
    const chestKey = selectStandardChestAsset(visual);
    const drawCrossroadsChoiceLabel = (chest) => {
      if (typeof context.fillText !== "function") return;
      const isPower = chest?.type === "crossroads_power";
      const isMercy = chest?.type === "crossroads_mercy";
      if (!isPower && !isMercy) return;
      const panelWidth = TILE_SIZE * 4;
      const panelHeight = 88;
      const boardWidth = GRID_SIZE * TILE_SIZE;
      const chestCenterX = Number(chest.x) * TILE_SIZE + TILE_SIZE * 0.5;
      const panelX = Math.max(8, Math.min(boardWidth - panelWidth - 8, chestCenterX - panelWidth * 0.5));
      const panelY = Math.max(8, (Number(chest.y) - 2) * TILE_SIZE + 8);
      const accent = isPower ? "#d55cff" : "#7de8d4";
      const title = isPower
        ? (chest.confirmPending ? "POWER \u2014 PRESS E TO CONFIRM" : "POWER \u2014 Epic+ Relic Choice")
        : "MERCY \u2014 Recovery";
      const detailLines = isPower
        ? ["-15% Max HP for 100 turns"]
        : ["Heal to Max HP", "reset cooldowns, refill potions"];
      context.save();
      context.globalAlpha = 0.88;
      context.fillStyle = "#090b10";
      context.fillRect(panelX, panelY, panelWidth, panelHeight);
      context.globalAlpha = 1;
      context.strokeStyle = accent;
      context.lineWidth = 2;
      context.strokeRect(panelX + 1, panelY + 1, panelWidth - 2, panelHeight - 2);
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = accent;
      context.font = "700 17px Georgia, serif";
      context.fillText(title, panelX + panelWidth / 2, panelY + 24);
      context.fillStyle = "#e9e4d7";
      context.font = "600 14px Georgia, serif";
      detailLines.forEach((line, index) => {
        context.fillText(line, panelX + panelWidth / 2, panelY + 51 + index * 19);
      });
      context.restore();
    };
    const drawSpecialChestAura = (chest) => {
      const color = chest?.type === "crossroads_power"
        ? "#d55cff"
        : chest?.type === "crossroads_mercy"
          ? "#7de8d4"
          : chest?.type === "arena_reward"
            ? "#ffc85a"
            : "";
      if (!color || typeof context.strokeRect !== "function") return;
      const pulse = 0.5 + Math.sin((Math.max(0, Number(visual.nowMs) || 0) + chest.x * 83 + chest.y * 41) / 120) * 0.5;
      context.save();
      context.globalAlpha = 0.45 + pulse * 0.35;
      context.strokeStyle = color;
      context.lineWidth = 3;
      context.strokeRect(chest.x * TILE_SIZE + 7.5, chest.y * TILE_SIZE + 7.5, TILE_SIZE - 15, TILE_SIZE - 15);
      context.globalAlpha = 0.12 + pulse * 0.12;
      context.fillStyle = color;
      context.fillRect(chest.x * TILE_SIZE + 8, chest.y * TILE_SIZE + 8, TILE_SIZE - 16, TILE_SIZE - 16);
      context.restore();
    };
    const vaultGuardianAlive = visual.roomType === "vault" &&
      (Array.isArray(visual.enemies) ? visual.enemies : []).some((enemy) =>
        enemy && enemy.type === "guardian" && (Number(enemy.hp) || 0) > 0
      );
    const drawVaultChestLock = (chest) => {
      if (!vaultGuardianAlive || !chest || chest.opened || chest.destroyed) return;
      const px = chest.x * TILE_SIZE;
      const py = chest.y * TILE_SIZE;
      const nowMs = Math.max(0, Number(visual.nowMs) || 0);
      const frame = String((Math.floor((nowMs + chest.x * 29 + chest.y * 17) / 145) % 4) + 1).padStart(2, "0");
      if (drawAsset(context, assets, `object.vault.chest_lock.lock${frame}`, px - 8, py - 12, 80, 80)) return;
      const pulse = 0.5 + Math.sin((nowMs + chest.x * 73 + chest.y * 37) / 135) * 0.5;
      context.save();
      context.globalAlpha = 0.38 + pulse * 0.28;
      context.strokeStyle = "#e2c15e";
      context.lineWidth = 3;
      context.strokeRect(px + 8, py + 8, 48, 48);
      context.fillStyle = "#ffeaa0";
      context.fillRect(px + 25, py + 13, 14, 8);
      context.fillRect(px + 21, py + 20, 22, 19);
      context.fillStyle = "#8b6522";
      context.fillRect(px + 30, py + 27, 4, 9);
      context.globalAlpha = 0.42;
      context.fillStyle = "#d5b852";
      context.fillRect(px + 9, py + 29, 46, 4);
      context.restore();
    };
    const drawDestroyedVaultChest = (chest) => {
      if (!chest || visual.roomType !== "vault") return;
      const px = chest.x * TILE_SIZE;
      const py = chest.y * TILE_SIZE;
      if (drawAsset(context, assets, "object.vault.chest_destroyed.debris04", px - 10, py - 12, 84, 84)) return;
      context.save();
      context.globalAlpha = 0.94;
      context.fillStyle = "#241817";
      context.fillRect(px + 13, py + 45, 38, 10);
      context.fillStyle = "#6e3a25";
      context.fillRect(px + 9, py + 48, 13, 8);
      context.fillRect(px + 43, py + 42, 12, 13);
      context.fillStyle = "#b57b36";
      context.fillRect(px + 25, py + 39, 7, 7);
      context.fillRect(px + 37, py + 49, 8, 4);
      context.globalAlpha = 0.2;
      context.fillStyle = "#8f2732";
      context.fillRect(px + 8, py + 25, 48, 30);
      context.restore();
    };
    for (const chest of chests) {
      if (!chest || chest.type === "otter_red") continue;
      if (chest.destroyed) {
        drawDestroyedVaultChest(chest);
        continue;
      }
      if (!chest.opened) {
        drawCrossroadsChoiceLabel(chest);
        drawSpecialChestAura(chest);
        let specialDrawn = false;
        if (chest.type === "crossroads_power" || chest.type === "crossroads_mercy") {
          const choice = chest.type === "crossroads_power" ? "power" : "mercy";
          const state = chest.confirmPending ? "selected" : "idle";
          const frame = (Math.floor(Math.max(0, Number(visual.nowMs) || 0) / 150) % 4) + 1;
          specialDrawn = drawBottomCentered(
            context, assets,
            `asset.objects.expansion.crossroads.${choice}.${state}_${String(frame).padStart(2, "0")}`,
            chest.x, chest.y, TILE_SIZE, TILE_SIZE
          );
        } else if (chest.type === "arena_reward") {
          specialDrawn = drawBottomCentered(
            context, assets, "asset.objects.expansion.blood_arena.reward_chest.closed_01",
            chest.x, chest.y, TILE_SIZE, TILE_SIZE
          );
          const glowFrame = (Math.floor(Math.max(0, Number(visual.nowMs) || 0) / 130) % 4) + 1;
          drawBottomCentered(
            context, assets,
            `asset.objects.expansion.blood_arena.reward_chest.glow_${String(glowFrame).padStart(2, "0")}`,
            chest.x, chest.y, TILE_SIZE, TILE_SIZE
          );
        }
        if (!specialDrawn && !drawBottomCentered(
          context, assets, chestKey, chest.x, chest.y,
          STANDARD_CHEST_RENDER_SIZE, STANDARD_CHEST_RENDER_SIZE
        )) {
          drawBottomCentered(
            context, assets, "object.common.chest.normal", chest.x, chest.y,
            STANDARD_CHEST_RENDER_SIZE, STANDARD_CHEST_RENDER_SIZE
          );
        }
        drawVaultChestLock(chest);
      }
    }

    if (visual.otterChest) {
      const state = visual.otterChest.opened ? "opened" : "ready";
      const fallback = state === "ready" ? "object.common.chest.normal" : undefined;
      drawBottomCenteredFallback(
        context, assets, `object.otter.chest.${state}`, fallback,
        visual.otterChest.x, visual.otterChest.y, TILE_SIZE, TILE_SIZE
      );
    }

    if (visual.shrine) {
      const shrineKey = visual.shrine.used
        ? "object.common.shrine.inactive"
        : "object.common.shrine.active";
      drawBottomCentered(
        context,
        assets,
        shrineKey,
        visual.shrine.x,
        visual.shrine.y,
        TILE_SIZE * 2,
        TILE_SIZE * 2
      );
    }


    if (visual.merchant) {
      const merchantKey = selectAnimationFrame(visual.nowMs, [
        "object.merchant.idle01", "object.merchant.idle02",
        "object.merchant.idle03", "object.merchant.idle04"
      ]);
      drawBottomCentered(
        context,
        assets,
        merchantKey,
        visual.merchant.x,
        visual.merchant.y,
        MERCHANT_RENDER_SIZE,
        MERCHANT_RENDER_SIZE
      );
    }

    if (visual.forge) {
      const forgeState = selectAnimationFrame(visual.nowMs, ["ready01", "ready02"]);
      const widthTiles = Number.isInteger(visual.forge.width) && visual.forge.width > 0
        ? visual.forge.width
        : 3;
      const heightTiles = Number.isInteger(visual.forge.height) && visual.forge.height > 0
        ? visual.forge.height
        : 3;
      if (isGridCoordinate(visual.forge.originX) && isGridCoordinate(visual.forge.originY)) {
        drawAsset(
          context, assets, `object.forge.${forgeState}`,
          visual.forge.originX * TILE_SIZE,
          visual.forge.originY * TILE_SIZE,
          widthTiles * TILE_SIZE,
          heightTiles * TILE_SIZE
        );
      } else {
        drawBottomCentered(
          context, assets, `object.forge.${forgeState}`,
          visual.forge.x, visual.forge.y, widthTiles * TILE_SIZE, heightTiles * TILE_SIZE
        );
      }
    }

    if (visual.pact) {
      const pactState = visual.pact.used
        ? "used"
        : visual.pact.awakened
          ? selectAnimationFrame(visual.nowMs, ["ready01", "ready02"])
          : "dormant";
      drawBottomCentered(
        context, assets, `object.pact.${pactState}`,
        visual.pact.x, visual.pact.y, TILE_SIZE * 2, TILE_SIZE * 2
      );
    }

    if (visual.portal && visual.roomCleared === true) {
      const kind = ["vault", "forge", "otter", "warden"].includes(visual.portal.kind)
        ? visual.portal.kind
        : "default";
      const active = visual.phase === "playing" || visual.portal.active !== false;
      const state = active
        ? selectAnimationFrame(visual.nowMs, ["active01", "active02", "active03"])
        : "inactive";
      const preferredKey = kind === "default"
        ? `object.common.portal.${state}`
        : `object.${kind}.portal.${state}`;
      const fallbackKey = `object.common.portal.${state}`;
      const portalGroup = kind === "default" ? "common" : kind;
      const swirlState = selectAnimationFrame(visual.nowMs, PORTAL_SWIRL_STATES, PORTAL_SWIRL_FRAME_MS);
      const frameKey = `object.${portalGroup}.portal.frame`;
      const swirlKey = `object.${portalGroup}.portal.${swirlState}`;
      const commonFrameKey = "object.common.portal.frame";
      const commonSwirlKey = `object.common.portal.${swirlState}`;
      const portalRenderSize = ["default", "warden"].includes(kind) ? TILE_SIZE * 1.5 : TILE_SIZE * 2;
      const separatedAvailable = active && getAsset(assets, frameKey) && getAsset(assets, swirlKey);
      const commonSeparatedAvailable = active && getAsset(assets, commonFrameKey) && getAsset(assets, commonSwirlKey);
      if (separatedAvailable || commonSeparatedAvailable) {
        const selectedFrame = separatedAvailable ? frameKey : commonFrameKey;
        const selectedSwirl = separatedAvailable ? swirlKey : commonSwirlKey;
        drawBottomCentered(context, assets, selectedFrame, visual.portal.x, visual.portal.y, portalRenderSize, portalRenderSize);
        drawBottomCentered(context, assets, selectedSwirl, visual.portal.x, visual.portal.y, portalRenderSize, portalRenderSize);
      } else {
        drawBottomCenteredFallback(
          context,
          assets,
          preferredKey,
          fallbackKey,
          visual.portal.x,
          visual.portal.y,
          portalRenderSize,
          portalRenderSize
        );
      }
    }
  }

  function drawDiagnosticActor(context, actor, color) {
    if (!context || typeof context.fillRect !== "function" || !actor) return;
    if (!isGridCoordinate(actor.x) || !isGridCoordinate(actor.y)) return;
    const x = actor.x * TILE_SIZE;
    const y = actor.y * TILE_SIZE;
    context.fillStyle = "#17131f";
    context.fillRect(x + 16, y + 52, 32, 6);
    context.fillStyle = color;
    context.fillRect(x + 22, y + 16, 20, 38);
  }

  function getEnemyOverlayProfile(name) {
    if (!statusApi || typeof statusApi.selectEnemyCrests !== "function") return null;
    const selected = name === "elite"
      ? statusApi.selectEnemyCrests({ elite: true })
      : statusApi.selectEnemyCrests({ affix: name });
    return selected[0] || null;
  }

  function selectEnemyDirection(enemy) {
    const visualType = String(enemy && (enemy.renderType || enemy.type) || "");
    if (visualType === "totem") return "base";
    return PLAYER_DIRECTIONS.includes(enemy && enemy.facing) ? enemy.facing : "south";
  }

  function selectEnemyVisual(snapshot, enemy) {
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    const actor = enemy && typeof enemy === "object" ? enemy : {};
    const renderType = ["riftweaver", "bulwark"].includes(actor.type)
      ? actor.type
      : ENEMY_ROSTER.includes(actor.renderType) ? actor.renderType : actor.type;
    if (!ENEMY_ROSTER.includes(renderType)) return Object.freeze({ diagnostic: true });
    const direction = selectEnemyDirection({ ...actor, renderType });
    let clip = "idle";
    if (Number(actor.hp) <= 0) clip = "death";
    else if ((Number(actor.hitFlash) || 0) > 0) clip = "hit";
    else if (actor.type === "totem" && (Number(actor.castFlash) || 0) > 0) clip = "cast";
    else if (actor.type === "skeleton" && (actor.aiming === true || actor.volleyAiming === true || ((Number(actor.castFlash) || 0) > 0 && !(actor.disoriented || (Number(actor.disorientedTurns) || 0) > 0)))) clip = "attack";
    else if (actor.type === "riftweaver" && (actor.riftAiming === true || (Number(actor.castFlash) || 0) > 0)) clip = "attack";
    else if (actor.type === "bulwark" && (actor.bulwarkBashAiming === true || (Number(actor.castFlash) || 0) > 0)) clip = "attack";
    else if (renderType === "acolyte" && (actor.aiming === true || (Number(actor.castFlash) || 0) > 0)) clip = "attack";
    else if (renderType === "brute" && (actor.slamAiming === true || actor.rests === true)) clip = "attack";
    else if (Number.isFinite(Number(actor._tweenT)) && Number(actor._tweenT) >= 0 && Number(actor._tweenT) < ENEMY_TWEEN_MS) clip = "move";
    const frameCount = ENEMY_CLIPS[clip];
    const elapsed = Math.max(0, Number(visual.nowMs) || 0);
    let frame = 1;
    if (clip === "idle") {
      frame = (Math.floor(elapsed / 250) % frameCount) + 1;
    } else if (clip === "move") {
      const tweenProgress = Math.max(0, Math.min(1, (Number(actor._tweenT) || 0) / ENEMY_TWEEN_MS));
      frame = Math.min(frameCount, Math.floor(tweenProgress * frameCount) + 1);
    } else if (clip === "hit") {
      frame = (Number(actor.hitFlash) || 0) > 60 ? 1 : 2;
    } else if (clip === "cast" || ((clip === "attack") && (Number(actor.castFlash) || 0) > 0)) {
      const actionDurationMs = ["riftweaver", "bulwark"].includes(actor.type)
        ? EXPANSION_ENEMY_ACTION_VISUAL_MS
        : 140;
      const remaining = Math.max(0, Math.min(actionDurationMs, Number(actor.castFlash) || 0));
      frame = Math.min(frameCount, 1 + Math.floor((actionDurationMs - remaining) / (actionDurationMs / frameCount)));
    } else if (clip === "attack") {
      if (actor.type === "riftweaver") {
        frame = Math.min(2, 1 + Math.max(0, Math.floor(Number(actor.telegraphAge) || 0)));
      } else if (actor.type === "bulwark") {
        frame = Math.min(2, 1 + Math.max(0, Math.floor(Number(actor.telegraphAge) || 0)));
      } else {
        frame = Math.min(frameCount, 1 + Math.max(0, Math.floor(Number(actor.telegraphAge) || 0)));
      }
    } else if (clip === "death") {
      frame = (Math.floor(elapsed / 180) % frameCount) + 1;
    }
    const key = `enemy.${renderType}.${direction}.${clip}.${String(frame).padStart(2, "0")}`;
    return Object.freeze({ type: renderType, logicalType: actor.type, direction, clip, frame, key });
  }

  function selectBulwarkGuardVisual(enemy) {
    const actor = enemy && typeof enemy === "object" ? enemy : {};
    if (actor.type !== "bulwark" || actor.bulwarkBashAiming !== true || Number(actor.hp) <= 0) return null;
    const direction = selectEnemyDirection(actor);
    const frame = Math.min(2, 1 + Math.max(0, Math.floor(Number(actor.telegraphAge) || 0)));
    const key = `asset.vfx.expansion.bulwark.guard.${direction}.guard_${String(frame).padStart(2, "0")}`;
    return Object.freeze({ direction, frame, key });
  }

  function getEnemyRenderSize(type) {
    return ENEMY_RENDER_PROFILES[type]?.renderSize || TILE_SIZE;
  }

  const BOSS_PROFILES = Object.freeze({
    guardian: Object.freeze({ key: "guardian", action: "attack", renderSize: 128 }),
    blacksmith_guardian: Object.freeze({ key: "blacksmith_guardian", action: "attack", renderSize: 128 }),
    warden1: Object.freeze({ key: "warden.phase1", action: "cast", renderSize: 160 }),
    warden2: Object.freeze({ key: "warden.phase2reborn", action: "cast", renderSize: 192 })
  });

  function selectBossVisual(snapshot, enemy) {
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    const actor = enemy && typeof enemy === "object" ? enemy : {};
    if (!BOSS_TYPES.includes(actor.type)) return Object.freeze({ diagnostic: true });
    const phase = actor.type === "warden" && Number(visual.finalBossPhase) >= 2 ? 2 : 1;
    const profile = actor.type === "warden" ? BOSS_PROFILES[`warden${phase}`] : BOSS_PROFILES[actor.type];
    const isFinalWarden = actor.type === "warden" && Number(visual.finalBossPhase) > 0;
    const wardenBiome = actor.type === "warden" && !isFinalWarden ? getDepthBiome(visual.depth) : null;
    const profileKey = actor.type === "blacksmith_guardian" && actor.blacksmithOverheated === true
      ? "blacksmith_guardian.overheat"
      : wardenBiome && wardenBiome !== "beyond"
        ? `warden.${wardenBiome}`
        : profile.key;
    const direction = PLAYER_DIRECTIONS.includes(actor.facing) ? actor.facing : "south";
    let clip = "idle";
    if (Number(actor.hp) <= 0) clip = "death";
    else if ((Number(actor.hitFlash) || 0) > 0) clip = "hit";
    else if (
      (actor.type === "warden" && (actor.aiming === true || actor.burstAiming === true || (Number(actor.castFlash) || 0) > 0))
      || (actor.type === "blacksmith_guardian" && (actor.anvilAiming === true || actor.rests === true || (Number(actor.castFlash) || 0) > 0))
      || (actor.type === "guardian" && (actor.slamAiming === true || actor.rests === true || (Number(actor.castFlash) || 0) > 0))
    ) clip = profile.action;
    else if (Number.isFinite(Number(actor._tweenT)) && Number(actor._tweenT) >= 0 && Number(actor._tweenT) < ENEMY_TWEEN_MS) clip = "move";

    const frameCount = clip === "hit" || clip === "death" ? 2 : 4;
    let frame = 1;
    if (clip === "idle" || clip === "move") {
      const fps = clip === "move" ? 8 : 4;
      frame = (Math.floor(Math.max(0, Number(visual.nowMs) || 0) / (1000 / fps)) % frameCount) + 1;
    } else if (clip === "hit") {
      frame = (Number(actor.hitFlash) || 0) > 60 ? 1 : 2;
    } else if (clip === profile.action) {
      if ((Number(actor.castFlash) || 0) > 0) {
        const actionDurationMs = actor.type === "warden" ? WARDEN_CAST_VISUAL_MS : 140;
        const remaining = Math.max(0, Math.min(actionDurationMs, Number(actor.castFlash) || 0));
        frame = Math.min(frameCount, 1 + Math.floor((actionDurationMs - remaining) / (actionDurationMs / frameCount)));
      } else {
        frame = Math.min(frameCount, 1 + Math.max(0, Math.floor(Number(actor.telegraphAge) || 0)));
      }
    } else if (clip === "death") {
      frame = Math.min(2, 1 + Math.floor(Math.max(0, Number(visual.nowMs) || 0) / 180) % 2);
    }
    return Object.freeze({
      type: actor.type,
      phase,
      direction,
      clip,
      frame,
      renderSize: profile.renderSize,
      key: `boss.${profileKey}.${direction}.${clip}.${String(frame).padStart(2, "0")}`
    });
  }

  function drawBossOverlayFallback(context, kind, x, y, size) {
    if (!context || typeof context.fillRect !== "function") return;
    const unit = Math.max(2, Math.round(size / 64));
    context.fillStyle = kind === "barrier" ? "#ff8a32" : "#9a62ff";
    const center = x + size / 2;
    const top = y + Math.round(size * 0.18);
    const bottom = y + Math.round(size * 0.9);
    context.fillRect(center - unit, top, unit * 2, unit * 4);
    context.fillRect(x + Math.round(size * 0.18), y + Math.round(size * 0.42), unit * 4, unit * 2);
    context.fillRect(x + Math.round(size * 0.76), y + Math.round(size * 0.42), unit * 4, unit * 2);
    context.fillRect(center - unit * 3, bottom, unit * 6, unit * 2);
  }

  function drawBossOverlay(context, snapshot, assets, enemy, logicalX, logicalY) {
    let prefix = "";
    let kind = "";
    if (enemy.type === "blacksmith_guardian" && ((Number(enemy.blacksmithBarrier) || 0) > 0 || (Number(enemy.blacksmithBarrierTurns) || 0) > 0)) {
      prefix = "boss.blacksmith_guardian.overlay.barrier";
      kind = "barrier";
    } else if (enemy.type === "warden" && ((Number(enemy.voidAegisShield) || 0) > 0 || (Number(enemy.voidAegisTurns) || 0) > 0)) {
      prefix = "boss.warden.overlay.voidaegis";
      kind = "aegis";
    }
    if (!prefix) return false;
    const size = 192;
    const x = logicalX * TILE_SIZE + TILE_SIZE * 0.5 - size * 0.5;
    const y = logicalY * TILE_SIZE + TILE_SIZE - size;
    const frame = (Math.floor(Math.max(0, Number(snapshot && snapshot.nowMs) || 0) / 120) % 4) + 1;
    const key = `${prefix}.${String(frame).padStart(2, "0")}`;
    if (drawAsset(context, assets, key, x, y, size, size)) return true;
    drawBossOverlayFallback(context, kind, x, y, size);
    return true;
  }

  function selectProtectionEffects(snapshot, actor, options = {}) {
    if (!actor || typeof actor !== "object") return Object.freeze([]);
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    const kinds = [];
    const isPlayer = actor === visual.player || (!actor.type && visual.player && actor.x === visual.player.x && actor.y === visual.player.y);
    if (isPlayer) {
      if ((Number(actor.skillShield) || 0) > 0) kinds.push("player-shield");
      const barrier = ["hpShield", "fracturedShieldBarrier", "bloodVialShield", "crownShield"]
        .reduce((total, field) => total + Math.max(0, Number(actor[field]) || 0), 0);
      if (barrier > 0) kinds.push("player-barrier");
    } else if (actor.type === "blacksmith_guardian" && ((Number(actor.blacksmithBarrier) || 0) > 0 || (Number(actor.blacksmithBarrierTurns) || 0) > 0)) {
      kinds.push("blacksmith-barrier");
    } else if (actor.type === "warden" && ((Number(actor.voidAegisShield) || 0) > 0 || (Number(actor.voidAegisTurns) || 0) > 0)) {
      kinds.push("warden-aegis");
    }
    const frame = options.reducedMotion === true
      ? 1
      : (Math.floor(Math.max(0, Number(visual.nowMs) || 0) / PROTECTION_FRAME_MS) % 8) + 1;
    const hitStrength = Math.max(0, Math.min(1, (Number(actor.hitFlash) || 0) / 120));
    return Object.freeze(kinds.map((kind) => {
      const profile = PROTECTION_PROFILES[kind];
      return Object.freeze({
        kind,
        frame,
        size: profile.size,
        offsetY: profile.offsetY,
        color: profile.color,
        alpha: Math.min(1, 0.78 + hitStrength * 0.2)
      });
    }));
  }

  function drawProtectionFallback(context, descriptor, x, y, phase) {
    if (!context) return;
    const front = phase === "front";
    if (typeof context.beginPath !== "function" || typeof context.arc !== "function" || typeof context.stroke !== "function") {
      if (typeof context.fillRect !== "function") return;
      context.fillStyle = descriptor.color;
      const unit = Math.max(2, Math.round(descriptor.size / 64));
      context.fillRect(x + descriptor.size * 0.18, y + descriptor.size * (front ? 0.76 : 0.22), unit * 4, unit * 2);
      context.fillRect(x + descriptor.size * 0.76 - unit * 4, y + descriptor.size * (front ? 0.76 : 0.22), unit * 4, unit * 2);
      return;
    }
    context.strokeStyle = descriptor.color;
    context.lineWidth = Math.max(3, Math.round(descriptor.size / 48));
    context.beginPath();
    context.arc(
      x + descriptor.size / 2,
      y + descriptor.size / 2,
      descriptor.size * 0.42,
      front ? 0 : Math.PI,
      front ? Math.PI : Math.PI * 2
    );
    context.stroke();
  }

  function drawProtectionPass(context, snapshot, assets, actor, logicalX, logicalY, phase, options = {}) {
    if (phase !== "rear" && phase !== "front") return false;
    if (!Number.isFinite(Number(logicalX)) || !Number.isFinite(Number(logicalY))) return false;
    const effects = selectProtectionEffects(snapshot, actor, options);
    let drewAny = false;
    for (const descriptor of effects) {
      const suffix = String(descriptor.frame).padStart(2, "0");
      const key = `fx.protection.${descriptor.kind.replaceAll("-", "_")}.${phase}.${suffix}`;
      const x = Number(logicalX) * TILE_SIZE + TILE_SIZE * 0.5 - descriptor.size * 0.5;
      const y = Number(logicalY) * TILE_SIZE + TILE_SIZE - descriptor.size + descriptor.offsetY;
      const originalAlpha = Number.isFinite(Number(context.globalAlpha)) ? Number(context.globalAlpha) : 1;
      context.globalAlpha = originalAlpha * descriptor.alpha;
      const drawn = drawAsset(context, assets, key, x, y, descriptor.size, descriptor.size);
      if (!drawn) drawProtectionFallback(context, descriptor, x, y, phase);
      context.globalAlpha = originalAlpha;
      drewAny = drawn || drewAny;
    }
    return drewAny;
  }

  function drawUnknownEnemy(context, enemy) {
    if (!context || !enemy || !Number.isFinite(Number(enemy.x)) || !Number.isFinite(Number(enemy.y))) return;
    const x = Number(enemy.x) * TILE_SIZE;
    const y = Number(enemy.y) * TILE_SIZE;
    context.fillStyle = "#17131f"; context.fillRect(x + 12, y + 12, 40, 40);
    context.fillStyle = "#ff00ff";
    context.fillRect(x + 12, y + 12, 12, 12); context.fillRect(x + 40, y + 12, 12, 12);
    context.fillRect(x + 26, y + 26, 12, 12); context.fillRect(x + 12, y + 40, 12, 12); context.fillRect(x + 40, y + 40, 12, 12);
    if (typeof context.fillText === "function") {
      context.fillStyle = "#ffffff"; context.font = "bold 28px monospace"; context.textAlign = "center"; context.textBaseline = "middle";
      context.fillText("?", x + 32, y + 32);
    }
  }

  function drawStatusRail(context, actor, assets, options = {}) {
    if (!statusApi || typeof statusApi.selectActorStatuses !== "function") {
      return Object.freeze({ drawn: 0, overflow: 0 });
    }
    const kind = options.kind === "enemy" ? "enemy" : "player";
    const limit = Math.max(0, Math.floor(Number(options.limit) || 3));
    const centerX = Number(options.centerX);
    const topY = Number(options.topY);
    if (!Number.isFinite(centerX) || !Number.isFinite(topY)) {
      return Object.freeze({ drawn: 0, overflow: 0 });
    }
    const selection = statusApi.selectActorStatuses(actor, { kind, limit });
    const drawable = selection.visible.filter((descriptor) => getAsset(assets, descriptor.key));
    const iconSize = 20;
    const gap = 2;
    const overflowWidth = selection.overflow > 0 ? 18 : 0;
    const iconWidth = drawable.length > 0
      ? drawable.length * iconSize + (drawable.length - 1) * gap
      : 0;
    const totalWidth = iconWidth + (overflowWidth > 0 && iconWidth > 0 ? gap : 0) + overflowWidth;
    let x = Math.round(centerX - totalWidth / 2);
    const y = Math.round(topY);
    for (const descriptor of drawable) {
      drawAsset(context, assets, descriptor.key, x, y, iconSize, iconSize);
      x += iconSize + gap;
    }
    if (selection.overflow > 0 && context && typeof context.fillRect === "function") {
      context.fillStyle = "#11131de8";
      context.fillRect(x, y + 1, overflowWidth, 18);
      if (typeof context.fillText === "function") {
        context.fillStyle = "#f1eadc";
        context.font = "bold 9px monospace";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(`+${selection.overflow}`, x + overflowWidth / 2, y + 10);
      }
    }
    return Object.freeze({ drawn: drawable.length, overflow: selection.overflow, x: Math.round(centerX - totalWidth / 2), y, width: totalWidth, height: iconSize });
  }

  function drawEnemyCrests(context, enemy, assets, options = {}) {
    if (!statusApi || typeof statusApi.selectEnemyCrests !== "function") return Object.freeze([]);
    const left = Number(options.left);
    const right = Number(options.right);
    const top = Number(options.top);
    if (![left, right, top].every(Number.isFinite)) return Object.freeze([]);
    const descriptors = statusApi.selectEnemyCrests(enemy)
      .filter((descriptor) => getAsset(assets, descriptor.key));
    const iconSize = 16;
    const gap = 2;
    const totalWidth = descriptors.length > 0
      ? descriptors.length * iconSize + (descriptors.length - 1) * gap
      : 0;
    let x = Math.round((left + right - totalWidth) / 2);
    const y = Math.round(top);
    const drawn = [];
    for (const descriptor of descriptors) {
      drawAsset(context, assets, descriptor.key, x, y, iconSize, iconSize);
      drawn.push(Object.freeze({ id: descriptor.id, x, y, width: iconSize, height: iconSize }));
      x += iconSize + gap;
    }
    return Object.freeze(drawn);
  }

  function drawEnemyHpBar(context, enemy, x, y, renderSize) {
    if (!context || typeof context.fillRect !== "function") return;
    if (enemy.showHpBar && Number(enemy.maxHp) > 0) {
      const ratio = Math.max(0, Math.min(1, Number(enemy.hp) / Number(enemy.maxHp)));
      const railX = x + (renderSize - 48) / 2;
      context.fillStyle="#17131f"; context.fillRect(railX,y+2,48,5); context.fillStyle="#d94b64"; context.fillRect(railX+1,y+3,46*ratio,3);
    }
  }

  function drawFreezeOverlay(context, snapshot, assets, logicalX, logicalY, size = 96) {
    if (!Number.isFinite(Number(logicalX)) || !Number.isFinite(Number(logicalY))) return false;
    const frame = (Math.floor(Math.max(0, Number(snapshot && snapshot.nowMs) || 0) / 90) % 6) + 1;
    const key = `asset.hazards.expansion.frost_rune.freeze_overlay.freeze_${String(frame).padStart(2, "0")}`;
    return drawBottomCentered(context, assets, key, Number(logicalX), Number(logicalY), size, size);
  }

  function drawEnemiesLayer(context, snapshot, assets) {
    const enemies = snapshot && Array.isArray(snapshot.enemies) ? snapshot.enemies : [];
    let drewKnown = false;
    for (const enemy of enemies) {
      const isBoss = BOSS_TYPES.includes(enemy && enemy.type);
      const selection = isBoss ? selectBossVisual(snapshot, enemy) : selectEnemyVisual(snapshot, enemy);
      if (selection.diagnostic) {
        if (typeof enemy.type === "string" && enemy.type) drawUnknownEnemy(context, enemy);
        else drawDiagnosticActor(context, enemy, "#b84b52");
        continue;
      }
      let logicalX = Number(enemy.x), logicalY = Number(enemy.y);
      const tweenTime = Number(enemy._tweenT), fromX = Number(enemy._tweenFromX), fromY = Number(enemy._tweenFromY);
      if (Number.isFinite(tweenTime) && tweenTime >= 0 && tweenTime < ENEMY_TWEEN_MS && Number.isFinite(fromX) && Number.isFinite(fromY)) {
        const progress = Math.max(0, Math.min(1, tweenTime / ENEMY_TWEEN_MS));
        const eased = progress * (2 - progress);
        logicalX = fromX / LEGACY_TILE_SIZE + (logicalX - fromX / LEGACY_TILE_SIZE) * eased;
        logicalY = fromY / LEGACY_TILE_SIZE + (logicalY - fromY / LEGACY_TILE_SIZE) * eased;
      }
      if (!Number.isFinite(logicalX) || !Number.isFinite(logicalY)) continue;
      const isElite = !isBoss && enemy.elite === true;
      const baseRenderSize = isBoss ? selection.renderSize : getEnemyRenderSize(selection.type);
      const renderSize = isElite ? Math.round(baseRenderSize * 1.2) : baseRenderSize;
      const drawX = logicalX * TILE_SIZE + TILE_SIZE * 0.5 - renderSize * 0.5;
      const drawY = logicalY * TILE_SIZE + TILE_SIZE - renderSize;
      if (isBoss) drawProtectionPass(context, snapshot, assets, enemy, logicalX, logicalY, "rear");
      if (enemy.type === "blacksmith_guardian" && enemy.blacksmithOverheated === true) {
        const auraFrame = (Math.floor(Math.max(0, Number(snapshot && snapshot.nowMs) || 0) / 120) % 4) + 1;
        const auraSize = Math.round(192 * 0.7);
        const auraOffset = {
          south: { x: -2, y: 16 },
          north: { x: 4, y: 17 },
          east: { x: 4, y: 14 },
          west: { x: -4, y: 16 }
        }[selection.direction] || { x: 0, y: 16 };
        drawAsset(
          context,
          assets,
          `asset.vfx.expansion.forge_guardian.overheat_aura.aura_${String(auraFrame).padStart(2, "0")}`,
          logicalX * TILE_SIZE + TILE_SIZE * 0.5 - auraSize * 0.5 + auraOffset.x,
          logicalY * TILE_SIZE + TILE_SIZE - auraSize + auraOffset.y,
          auraSize,
          auraSize
        );
      }
      const canStyleElite = isElite && typeof context.save === "function" && typeof context.restore === "function";
      if (canStyleElite) {
        context.save();
        context.shadowColor = "rgba(151, 112, 207, 0.72)";
        context.shadowBlur = 8;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
      }
      const drawn = drawAsset(context, assets, selection.key, drawX, drawY, renderSize, renderSize);
      if (canStyleElite) context.restore();
      if (!drawn) drawDiagnosticActor(context, enemy, "#b84b52");
      else drewKnown = true;
      const bulwarkGuard = drawn ? selectBulwarkGuardVisual(enemy) : null;
      if (bulwarkGuard) {
        drawAsset(context, assets, bulwarkGuard.key, drawX, drawY, renderSize, renderSize);
      }
      if (isBoss) drawProtectionPass(context, snapshot, assets, enemy, logicalX, logicalY, "front");
      if ((Number(enemy.frostFx) || 0) > 0 || enemy.frozenThisTurn === true) {
        drawFreezeOverlay(context, snapshot, assets, logicalX, logicalY, Math.max(96, renderSize));
      }
      drawEnemyCrests(context, enemy, assets, {
        left: drawX,
        right: drawX + renderSize,
        top: drawY - 40
      });
      drawStatusRail(context, enemy, assets, {
        kind: "enemy",
        centerX: drawX + renderSize / 2,
        topY: drawY - 22,
        limit: 3
      });
      drawEnemyHpBar(context, enemy, drawX, drawY, renderSize);
    }
    return drewKnown;
  }

  function selectPlayerDirection(player) {
    if (player && PLAYER_DIRECTIONS.includes(player.facing)) return player.facing;
    const dx = Number(player && player.lastMoveX) || 0;
    const dy = Number(player && player.lastMoveY) || 0;
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "west" : "east";
    if (dy !== 0) return dy < 0 ? "north" : "south";
    return "south";
  }

  function selectPlayerVisual(snapshot) {
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    const player = visual.player && typeof visual.player === "object" ? visual.player : {};
    const direction = selectPlayerDirection(player);
    let clip = "idle";
    if (visual.phase === "dead" || Number(player.hp) <= 0) {
      clip = "death";
    } else if ((Number(player.hitFlash) || 0) > 0) {
      clip = "hit";
    } else if (player.visualAction === "attack") {
      clip = "attack";
    } else if (
      Number.isFinite(Number(player._tweenT))
      && Number(player._tweenT) < PLAYER_TWEEN_MS
      && ((Number(player.lastMoveX) || 0) !== 0 || (Number(player.lastMoveY) || 0) !== 0)
    ) {
      clip = "move";
    }

    const descriptor = PLAYER_CLIPS[clip];
    let elapsed = Math.max(0, Number(visual.playerAnimTimer ?? visual.nowMs) || 0);
    if (clip === "attack" && Number.isFinite(Number(player.visualActionTimer))) {
      elapsed = Math.max(0, PLAYER_ATTACK_VISUAL_MS - Number(player.visualActionTimer));
    } else if (clip === "hit") {
      elapsed = Math.max(0, 120 - (Number(player.hitFlash) || 0));
    } else if (clip === "death" && Number.isFinite(Number(player.visualDeathTimer))) {
      elapsed = Math.max(0, Number(player.visualDeathTimer));
    }
    const rawIndex = clip === "attack" && Number.isFinite(Number(player.visualActionTimer))
      ? Math.floor(elapsed / (PLAYER_ATTACK_VISUAL_MS / descriptor.frameCount))
      : Math.floor(elapsed / (1000 / descriptor.fps));
    const frameIndex = descriptor.loop
      ? rawIndex % descriptor.frameCount
      : Math.min(descriptor.frameCount - 1, rawIndex);
    const frame = frameIndex + 1;
    const suffix = String(frame).padStart(2, "0");
    return Object.freeze({
      direction,
      clip,
      frame,
      key: `actor.player.${direction}.${clip}.${suffix}`
    });
  }

  function drawPlayerLayer(context, snapshot, assets) {
    const player = snapshot && snapshot.player;
    if (!player) return false;
    const selection = selectPlayerVisual(snapshot);
    let logicalX = Number(player.x);
    let logicalY = Number(player.y);
    const tweenTime = Number(player._tweenT);
    const fromX = Number(player._tweenFromX);
    const fromY = Number(player._tweenFromY);
    if (
      Number.isFinite(logicalX)
      && Number.isFinite(logicalY)
      && Number.isFinite(tweenTime)
      && tweenTime >= 0
      && tweenTime < PLAYER_TWEEN_MS
      && Number.isFinite(fromX)
      && Number.isFinite(fromY)
    ) {
      const progress = Math.max(0, Math.min(1, tweenTime / PLAYER_TWEEN_MS));
      const eased = progress * (2 - progress);
      logicalX = fromX / LEGACY_TILE_SIZE + (logicalX - fromX / LEGACY_TILE_SIZE) * eased;
      logicalY = fromY / LEGACY_TILE_SIZE + (logicalY - fromY / LEGACY_TILE_SIZE) * eased;
    }
    const drawX = logicalX * TILE_SIZE + TILE_SIZE * 0.5 - PLAYER_RENDER_SIZE * 0.5;
    const drawY = logicalY * TILE_SIZE + TILE_SIZE - PLAYER_RENDER_SIZE;
    if (Number.isFinite(drawX) && Number.isFinite(drawY)) {
      drawProtectionPass(context, snapshot, assets, player, logicalX, logicalY, "rear");
    }
    const drawn = Number.isFinite(drawX) && Number.isFinite(drawY)
      ? drawAsset(
          context,
          assets,
          selection.key,
          drawX,
          drawY,
          PLAYER_RENDER_SIZE,
          PLAYER_RENDER_SIZE
        )
      : false;
    if (!drawn) drawDiagnosticActor(context, player, "#d8c7ff");
    if (Number.isFinite(drawX) && Number.isFinite(drawY)) {
      drawProtectionPass(context, snapshot, assets, player, logicalX, logicalY, "front");
      if ((Number(player.frozenMoveTurns) || 0) > 0) {
        drawFreezeOverlay(context, snapshot, assets, logicalX, logicalY, 96);
      }
      drawStatusRail(context, player, assets, {
        kind: "player",
        centerX: drawX + PLAYER_RENDER_SIZE / 2,
        topY: drawY - 22,
        limit: 3
      });
    }
    return drawn;
  }

  function drawNothing() {}

  function drawTelegraphsLayer(context, snapshot, assets) {
    if (vfxApi && typeof vfxApi.drawTelegraphs === "function") vfxApi.drawTelegraphs(context, snapshot, undefined, assets);
    const nowMs = Math.max(0, Number(snapshot && snapshot.nowMs) || 0);
    const frame4 = String((Math.floor(nowMs / 150) % 4) + 1).padStart(2, "0");
    for (const enemy of Array.isArray(snapshot && snapshot.enemies) ? snapshot.enemies : []) {
      if (!enemy) continue;
      if (enemy.riftAiming === true) {
        const riftSize = 192 * 1.3;
        drawCentered(
          context, assets,
          `asset.vfx.expansion.riftweaver.spatial_rift.telegraph.telegraph_${frame4}`,
          enemy.riftTargetX, enemy.riftTargetY, riftSize, riftSize, 0, -TILE_SIZE * 0.25
        );
      }
      if (enemy.voidStepAiming === true) {
        drawCentered(
          context, assets,
          `asset.vfx.expansion.warden.void_step.afterimage.afterimage_${frame4}`,
          enemy.voidStepOriginX, enemy.voidStepOriginY, 192, 192
        );
      }
      if (enemy.latticeAiming === true) {
        const patterns = Array.isArray(enemy.latticePatterns) && enemy.latticePatterns.length > 0
          ? enemy.latticePatterns
          : [{ rows: enemy.latticeRows, columns: enemy.latticeColumns }];
        const rows = [...new Set(patterns.flatMap((pattern) => Array.isArray(pattern?.rows) ? pattern.rows : []))];
        const columns = [...new Set(patterns.flatMap((pattern) => Array.isArray(pattern?.columns) ? pattern.columns : []))];
        for (const row of rows) for (let x = 1; x < GRID_SIZE - 1; x += 1) {
          const crossing = columns.includes(x);
          const key = crossing
            ? `asset.vfx.expansion.warden.rift_lattice.intersection.intersection_${frame4}`
            : `asset.vfx.expansion.warden.rift_lattice.horizontal.horizontal_${frame4}`;
          drawGridAsset(context, assets, key, x, row);
        }
        for (const column of columns) for (let y = 1; y < GRID_SIZE - 1; y += 1) {
          if (rows.includes(y)) continue;
          drawGridAsset(context, assets, `asset.vfx.expansion.warden.rift_lattice.vertical.vertical_${frame4}`, column, y);
        }
      }
      const chainTiles = enemy.soulChainAiming === true
        ? enemy.soulChainTiles
        : enemy.blacksmithChainAiming === true
          ? enemy.blacksmithChainTiles
          : null;
      if (Array.isArray(chainTiles)) {
        const base = enemy.blacksmithChainAiming === true
          ? "asset.vfx.expansion.forge_guardian.chain_hook"
          : "asset.vfx.expansion.warden.soul_chain";
        for (let index = 0; index < chainTiles.length; index += 1) {
          const tile = chainTiles[index];
          const previous = index > 0 ? chainTiles[index - 1] : enemy;
          const orientation = tile.x === previous.x ? "vertical" : "horizontal";
          drawGridAsset(context, assets, `${base}.segment.${orientation}.segment_${frame4}`, tile.x, tile.y);
        }
        const last = chainTiles[chainTiles.length - 1];
        const facing = ["north", "east", "south", "west"].includes(enemy.facing) ? enemy.facing : "south";
        if (last) drawGridAsset(context, assets, `${base}.hook.${facing}.hook_${frame4}`, last.x, last.y);
      }
    }
  }

  function drawVfxLayer(context, snapshot, assets) {
    if (vfxApi && typeof vfxApi.drawVfx === "function") vfxApi.drawVfx(context, snapshot, undefined, assets);
  }

  function drawLightingLayer(context, snapshot) {
    if (lightingApi && typeof lightingApi.drawLighting === "function") lightingApi.drawLighting(context, snapshot);
  }

  const DEFAULT_LAYERS = Object.freeze({
    floor: drawFloorLayer,
    decals: drawDecalsLayer,
    hazards: drawHazardsLayer,
    objects: drawObjectsLayer,
    enemies: drawEnemiesLayer,
    player: drawPlayerLayer,
    telegraphs: drawTelegraphsLayer,
    vfx: drawVfxLayer,
    lighting: drawLightingLayer
  });

  function renderLayers(context, snapshot, assets, layers = DEFAULT_LAYERS) {
    if (!context || typeof context.save !== "function" || typeof context.restore !== "function") {
      throw new TypeError("HD layer rendering requires a canvas context with save/restore");
    }
    if (!layers || typeof layers !== "object") {
      throw new TypeError("HD layers must be an object");
    }

    for (let index = 0; index < LAYER_ORDER.length; index += 1) {
      const name = LAYER_ORDER[index];
      const drawLayer = layers[name];
      if (typeof drawLayer !== "function") {
        throw new TypeError(`HD layer ${name} must be a function`);
      }

      context.save();
      try {
        drawLayer(context, snapshot, assets);
      } finally {
        context.restore();
      }
    }
  }

  return Object.freeze({
    LAYER_ORDER,
    DEFAULT_LAYERS,
    visualHash,
    getDepthBiome,
    getEnvironmentTheme,
    visualVariantHash,
    selectStandardRoomBackground,
    selectBossRoomBackground,
    selectAnimationFrame,
    selectFloorVariant,
    canFloorReceiveDecal,
    drawFloorLayer,
    drawDecalsLayer,
    drawHazardsLayer,
    drawObjectsLayer,
    drawEnemiesLayer,
    selectEnemyVisual,
    selectBulwarkGuardVisual,
    selectBossVisual,
    selectProtectionEffects,
    drawProtectionPass,
    getEnemyOverlayProfile,
    drawStatusRail,
    drawEnemyCrests,
    selectPlayerVisual,
    drawPlayerLayer,
    renderLayers
  });
});
