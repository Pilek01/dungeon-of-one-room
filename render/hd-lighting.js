(function attachHDLighting(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DungeonHDLighting = api;
})(typeof window !== "undefined" ? window : null, function createHDLightingApi() {
  "use strict";

  const TILE_SIZE = 64;
  const GRID_SIZE = 9;
  const PROFILE_DATA = Object.freeze({
    high: Object.freeze({ ambientOpacity: 0.26, lightBudget: 18, glowOpacity: 0.13 }),
    medium: Object.freeze({ ambientOpacity: 0.23, lightBudget: 12, glowOpacity: 0.10 }),
    low: Object.freeze({ ambientOpacity: 0.20, lightBudget: 8, glowOpacity: 0.07 })
  });
  let overlayCanvas = null;

  function clamp(value, minimum, maximum) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(maximum, Math.max(minimum, numeric)) : minimum;
  }

  function getLightingProfile(options = {}) {
    const quality = Object.prototype.hasOwnProperty.call(PROFILE_DATA, options.quality) ? options.quality : "high";
    const base = PROFILE_DATA[quality];
    const reducedEffects = options.reducedEffects === true;
    return Object.freeze({
      quality,
      ambientOpacity: reducedEffects ? Math.min(0.14, base.ambientOpacity) : base.ambientOpacity,
      lightBudget: reducedEffects ? Math.min(6, base.lightBudget) : base.lightBudget,
      glowOpacity: reducedEffects ? Math.min(0.045, base.glowOpacity) : base.glowOpacity
    });
  }

  function runtimeOptions(environment) {
    const source = environment || (typeof globalThis === "object" ? globalThis : {});
    const width = Number(source.innerWidth);
    const quality = Number.isFinite(width) && width <= 480 ? "low" : Number.isFinite(width) && width <= 960 ? "medium" : "high";
    let reducedEffects = false;
    try {
      reducedEffects = typeof source.matchMedia === "function" && (
        source.matchMedia("(prefers-reduced-motion: reduce)").matches === true
        || source.matchMedia("(prefers-reduced-transparency: reduce)").matches === true
      );
    } catch (_error) {
      reducedEffects = false;
    }
    return { quality, reducedEffects };
  }

  function isGridCoordinate(value) {
    return Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) < GRID_SIZE;
  }

  function makeLight(kind, gridX, gridY, radius, color, strength, priority) {
    if (!isGridCoordinate(gridX) || !isGridCoordinate(gridY)) return null;
    return Object.freeze({
      kind,
      x: Number(gridX) * TILE_SIZE + TILE_SIZE * 0.5,
      y: Number(gridY) * TILE_SIZE + TILE_SIZE * 0.5,
      radius: clamp(radius, 48, 224),
      color,
      strength: clamp(strength, 0.15, 0.95),
      priority
    });
  }

  function collectLightingCommands(snapshot, options = {}) {
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    const profile = getLightingProfile(options);
    const lights = [];
    const add = (light) => { if (light) lights.push(light); };

    if (
      visual.portal
      && visual.roomCleared === true
      && (visual.phase === "playing" || visual.portal.active !== false)
    ) {
      add(makeLight("portal", visual.portal.x, visual.portal.y, 176, visual.portal.kind === "warden" ? "#e34a56" : "#6e9cff", 0.92, 100));
    }
    for (const enemy of Array.isArray(visual.enemies) ? visual.enemies : []) {
      if (!enemy) continue;
      if (enemy.type === "warden" && ((Number(enemy.voidAegisShield) || 0) > 0 || (Number(enemy.voidAegisTurns) || 0) > 0)) {
        add(makeLight("boss-aegis", enemy.x, enemy.y, 192, "#9a62ff", 0.88, 95));
      } else if (enemy.type === "blacksmith_guardian" && ((Number(enemy.blacksmithBarrier) || 0) > 0 || (Number(enemy.blacksmithBarrierTurns) || 0) > 0)) {
        add(makeLight("boss-barrier", enemy.x, enemy.y, 176, "#ff7a32", 0.84, 94));
      }
    }
    if (visual.forge && visual.forge.used !== true) {
      add(makeLight("forge", visual.forge.x, visual.forge.y, visual.forge.awakened ? 192 : 144, "#ff7a32", visual.forge.awakened ? 0.88 : 0.58, 90));
    }
    if (visual.pact && visual.pact.used !== true) {
      add(makeLight("pact", visual.pact.x, visual.pact.y, 144, "#bd62ff", 0.62, 84));
    }
    if (visual.player && visual.phase === "playing") {
      const abyssPresence = Number(visual.depth) >= 40;
      add(makeLight(
        "player-presence",
        visual.player.x,
        visual.player.y,
        abyssPresence ? 112 : 96,
        "#d5d9ea",
        abyssPresence ? 0.48 : 0.32,
        70
      ));
    }
    if (visual.player && ((Number(visual.player.skillShield) || 0) > 0 || (Number(visual.player.hpShield) || 0) > 0)) {
      add(makeLight("player-shield", visual.player.x, visual.player.y, 112, "#8ad8ff", 0.58, 80));
    }

    const floorPattern = Array.isArray(visual.floorPattern) ? visual.floorPattern : [];
    for (let y = 1; y < Math.min(GRID_SIZE - 1, floorPattern.length); y += 1) {
      const row = Array.isArray(floorPattern[y]) ? floorPattern[y] : [];
      for (let x = 1; x < Math.min(GRID_SIZE - 1, row.length); x += 1) {
        if (row[x] === 3 && visual.phase === "playing") {
          add(makeLight("torch", x, y, 112, "#ff9b45", 0.64, 20));
        }
      }
    }

    lights.sort((left, right) => right.priority - left.priority || left.y - right.y || left.x - right.x);
    const abyss = Number(visual.depth) >= 40;
    const ambientOpacity = abyss
      ? Math.min(options.reducedEffects === true ? 0.12 : 0.18, profile.ambientOpacity)
      : profile.ambientOpacity;
    return Object.freeze({
      ambient: Object.freeze({ opacity: ambientOpacity, color: abyss ? "#090716" : Number(visual.depth) >= 20 ? "#100814" : "#0a0d12" }),
      profile,
      lights: Object.freeze(lights.slice(0, profile.lightBudget))
    });
  }

  function acquireOverlay(width, height, options) {
    if (!overlayCanvas) {
      if (options && typeof options.createCanvas === "function") overlayCanvas = options.createCanvas(width, height);
      else if (typeof document !== "undefined" && typeof document.createElement === "function") overlayCanvas = document.createElement("canvas");
    }
    if (!overlayCanvas) return null;
    if (overlayCanvas.width !== width) overlayCanvas.width = width;
    if (overlayCanvas.height !== height) overlayCanvas.height = height;
    return overlayCanvas;
  }

  function drawLighting(context, snapshot, options = runtimeOptions()) {
    if (!context || !context.canvas || typeof context.drawImage !== "function") return false;
    const width = Number(context.canvas.width) || GRID_SIZE * TILE_SIZE;
    const height = Number(context.canvas.height) || GRID_SIZE * TILE_SIZE;
    const overlay = acquireOverlay(width, height, options);
    const overlayContext = overlay && typeof overlay.getContext === "function" ? overlay.getContext("2d") : null;
    if (!overlayContext || typeof overlayContext.createRadialGradient !== "function") return false;
    const commands = collectLightingCommands(snapshot, options);

    overlayContext.clearRect(0, 0, width, height);
    overlayContext.globalCompositeOperation = "source-over";
    overlayContext.globalAlpha = 1;
    overlayContext.fillStyle = commands.ambient.color;
    overlayContext.fillRect(0, 0, width, height);
    overlayContext.globalAlpha = commands.ambient.opacity;
    overlayContext.globalCompositeOperation = "destination-in";
    overlayContext.fillStyle = "#000000";
    overlayContext.fillRect(0, 0, width, height);
    overlayContext.globalAlpha = 1;
    overlayContext.globalCompositeOperation = "destination-out";
    for (const light of commands.lights) {
      const gradient = overlayContext.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
      gradient.addColorStop(0, `rgba(0,0,0,${light.strength})`);
      gradient.addColorStop(0.48, `rgba(0,0,0,${light.strength * 0.62})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      overlayContext.fillStyle = gradient;
      overlayContext.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2);
    }

    context.save();
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.drawImage(overlay, 0, 0, width, height);
    if (typeof context.createRadialGradient === "function") {
      context.globalCompositeOperation = "screen";
      for (const light of commands.lights) {
        const glow = context.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius * 0.72);
        glow.addColorStop(0, light.color);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        context.globalAlpha = commands.profile.glowOpacity * light.strength;
        context.fillStyle = glow;
        context.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2);
      }
    }
    context.restore();
    return true;
  }

  return Object.freeze({ getLightingProfile, runtimeOptions, collectLightingCommands, drawLighting });
});
