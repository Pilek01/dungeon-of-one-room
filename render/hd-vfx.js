(function attachHDVfx(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DungeonHDVfx = api;
})(typeof window !== "undefined" ? window : null, function createHDVfxApi() {
  "use strict";

  const TILE_SIZE = 64;
  const GRID_SIZE = 9;
  const LEGACY_SCALE = 4;
  const PROFILE_DATA = Object.freeze({
    high: Object.freeze({ particleBudget: 96, lightFlashOpacity: 0.32 }),
    medium: Object.freeze({ particleBudget: 48, lightFlashOpacity: 0.24 }),
    low: Object.freeze({ particleBudget: 24, lightFlashOpacity: 0.18 })
  });

  function clamp(value, minimum, maximum) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(maximum, Math.max(minimum, numeric)) : minimum;
  }

  function normalizeLifetime(life, maxLife) {
    const maximum = Number(maxLife);
    if (!Number.isFinite(maximum) || maximum <= 0) return 0;
    return clamp(Number(life) / maximum, 0, 1);
  }

  function normalizeTier(value) {
    return Math.max(0, Math.min(3, Math.floor(Number(value) || 0)));
  }

  function seededAngle(seed, index, count) {
    const base = ((Number(seed) || 0) % 997) / 997 * Math.PI * 2;
    return base + (Math.PI * 2 * index) / Math.max(1, count);
  }

  function getVfxProfile(options = {}) {
    const quality = Object.prototype.hasOwnProperty.call(PROFILE_DATA, options.quality) ? options.quality : "high";
    const base = PROFILE_DATA[quality];
    const reducedMotion = options.reducedMotion === true;
    const reducedFlash = options.reducedFlash === true;
    return Object.freeze({
      quality,
      particleBudget: reducedMotion ? Math.min(16, base.particleBudget) : base.particleBudget,
      lightFlashOpacity: reducedFlash ? Math.min(0.16, base.lightFlashOpacity) : base.lightFlashOpacity,
      motionScale: reducedMotion ? 0.35 : 1
    });
  }

  function runtimeOptions(environment) {
    const source = environment || (typeof globalThis === "object" ? globalThis : {});
    const width = Number(source.innerWidth);
    const quality = Number.isFinite(width) && width <= 480 ? "low" : Number.isFinite(width) && width <= 960 ? "medium" : "high";
    const matches = (query) => {
      try {
        return typeof source.matchMedia === "function" && source.matchMedia(query).matches === true;
      } catch (_error) {
        return false;
      }
    };
    return {
      quality,
      reducedMotion: matches("(prefers-reduced-motion: reduce)"),
      reducedFlash: matches("(prefers-reduced-transparency: reduce)") || matches("(prefers-reduced-motion: reduce)")
    };
  }

  function areaTiles(centerX, centerY, radius, gridSize = GRID_SIZE) {
    const size = Number.isInteger(gridSize) && gridSize > 0 ? gridSize : GRID_SIZE;
    const x = Math.round(Number(centerX));
    const y = Math.round(Number(centerY));
    const spread = Math.max(0, Math.floor(Number(radius) || 0));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    const tiles = [];
    for (let tileY = y - spread; tileY <= y + spread; tileY += 1) {
      for (let tileX = x - spread; tileX <= x + spread; tileX += 1) {
        if (tileX >= 0 && tileX < size && tileY >= 0 && tileY < size) tiles.push({ x: tileX, y: tileY });
      }
    }
    return tiles;
  }

  function pulseAt(nowMs, salt = 0) {
    return 0.5 + Math.sin((Math.max(0, Number(nowMs) || 0) + salt * 97) / 150) * 0.5;
  }

  function collectTelegraphCommands(snapshot, options = {}) {
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    const profile = getVfxProfile(options);
    const commands = [];
    const pulse = pulseAt(visual.nowMs);
    const vaultFrame = String((Math.floor(Math.max(0, Number(visual.nowMs) || 0) / 145) % 4) + 1).padStart(2, "0");
    for (const mine of Array.isArray(visual.mines) ? visual.mines : []) {
      if (!mine || mine.armed === false) continue;
      const radius = (Number(mine.fuseTurns) || 0) <= 1 ? 1 : 0;
      for (const tile of areaTiles(mine.x, mine.y, radius)) {
        commands.push({ kind: "mine-area", x: tile.x, y: tile.y, alpha: (0.06 + pulse * 0.10) * profile.motionScale });
      }
    }
    for (const burst of Array.isArray(visual.volatileBursts) ? visual.volatileBursts : []) {
      if (!burst || (Number(burst.fuseTurns) || 0) > 2) continue;
      for (const tile of areaTiles(burst.x, burst.y, 1)) {
        commands.push({
          kind: "volatile-area", x: tile.x, y: tile.y,
          color: burst.source === "totem" ? "#43d487" : "#a56cff",
          alpha: (0.06 + pulse * 0.11) * profile.motionScale
        });
      }
    }
    for (const vent of Array.isArray(visual.flameVents) ? visual.flameVents : []) {
      if (!vent || (Number(vent.fuseTurns) || 0) > 1) continue;
      const tiles = [
        { x: vent.x, y: vent.y }, { x: vent.x + 1, y: vent.y }, { x: vent.x - 1, y: vent.y },
        { x: vent.x, y: vent.y + 1 }, { x: vent.x, y: vent.y - 1 }
      ];
      for (const tile of tiles) {
        if (tile.x < 0 || tile.x >= GRID_SIZE || tile.y < 0 || tile.y >= GRID_SIZE) continue;
        commands.push({ kind: "flame-vent-area", x: tile.x, y: tile.y, color: "#ff6a35", alpha: (0.12 + pulse * 0.19) * profile.motionScale });
      }
    }
    for (const chest of Array.isArray(visual.chests) ? visual.chests : []) {
      if (!chest || chest.opened === true || chest.destroyed === true || chest.vaultCondemned !== true) continue;
      commands.push({
        kind: "vault-sentence-mark",
        x: clamp(chest.x, 0, 8),
        y: clamp(chest.y, 0, 8),
        turns: Math.max(0, Math.round(Number(chest.vaultCondemnTurns) || 0)),
        frame: vaultFrame,
        alpha: (0.48 + pulse * 0.36) * profile.motionScale
      });
    }
    const player = visual.player && typeof visual.player === "object" ? visual.player : {};
    if (visual.phase === "playing" && visual.dashAimActive === true) {
      commands.push({ kind: "dash-aim", x: clamp(player.x, 0, 8), y: clamp(player.y, 0, 8), alpha: 0.45 + pulse * 0.35 });
    }
    for (const enemy of Array.isArray(visual.enemies) ? visual.enemies : []) {
      if (!enemy) continue;
      if (enemy.vaultLockdownAiming === true) {
        const seen = new Set();
        for (const target of Array.isArray(enemy.vaultLockdownTargets) ? enemy.vaultLockdownTargets : []) {
          if (!target) continue;
          commands.push({
            kind: "vault-lockdown-anchor",
            x: clamp(target.x, 0, 8),
            y: clamp(target.y, 0, 8),
            color: "#ffe48a",
            frame: vaultFrame,
            alpha: (0.55 + pulse * 0.34) * profile.motionScale
          });
          for (const tile of [
            { x: target.x, y: target.y },
            { x: target.x + 1, y: target.y }, { x: target.x - 1, y: target.y },
            { x: target.x, y: target.y + 1 }, { x: target.x, y: target.y - 1 }
          ]) {
            if (tile.x < 0 || tile.x >= GRID_SIZE || tile.y < 0 || tile.y >= GRID_SIZE) continue;
            const key = `${tile.x},${tile.y}`;
            if (seen.has(key)) continue;
            seen.add(key);
            commands.push({
              kind: "vault-lockdown-area",
              x: tile.x,
              y: tile.y,
              color: "#62d8ff",
              frame: vaultFrame,
              alpha: (0.13 + pulse * 0.20) * profile.motionScale
            });
          }
        }
        continue;
      }
      if (enemy.riftAiming === true) continue;
      if (enemy.bulwarkBashAiming === true) {
        const delta = enemy.facing === "north" ? [0, -1] : enemy.facing === "east" ? [1, 0] : enemy.facing === "west" ? [-1, 0] : [0, 1];
        const x = clamp((Number(enemy.x) || 0) + delta[0], 0, 8);
        const y = clamp((Number(enemy.y) || 0) + delta[1], 0, 8);
        commands.push({ kind: "bulwark-bash-area", x, y, color: "#9ec5d8", alpha: (0.16 + pulse * 0.22) * profile.motionScale });
        continue;
      }
      if (enemy.blacksmithChainAiming === true) {
        for (const tile of Array.isArray(enemy.blacksmithChainTiles) ? enemy.blacksmithChainTiles : []) {
          commands.push({ kind: "forge-chain-area", x: clamp(tile.x, 0, 8), y: clamp(tile.y, 0, 8), color: "#ff9b4c", alpha: (0.13 + pulse * 0.2) * profile.motionScale });
        }
        continue;
      }
      if (![enemy.aiming, enemy.slamAiming, enemy.volleyAiming, enemy.burstAiming, enemy.anvilAiming].some(Boolean)) continue;
      const fromX = clamp(enemy.x, 0, 8);
      const fromY = clamp(enemy.y, 0, 8);
      const dx = Number(enemy.anvilDx);
      const dy = Number(enemy.anvilDy);
      const targetX = Number.isFinite(dx) && Number.isFinite(dy) && (dx !== 0 || dy !== 0)
        ? clamp(fromX + dx * 4, 0, 8) : clamp(player.x, 0, 8);
      const targetY = Number.isFinite(dx) && Number.isFinite(dy) && (dx !== 0 || dy !== 0)
        ? clamp(fromY + dy * 4, 0, 8) : clamp(player.y, 0, 8);
      if (enemy.type === "warden" && enemy.burstAiming === true) {
        commands.push({
          kind: "warden-burst-range",
          x: fromX,
          y: fromY,
          radius: clamp(visual.wardenBurstRange, 2, 8),
          alpha: (0.08 + pulse * 0.12) * profile.motionScale
        });
      }
      commands.push({ kind: "aim-line", x: fromX, y: fromY, targetX, targetY, alpha: 0.42 + pulse * 0.38 });
    }
    return commands;
  }

  function evenlySample(source, limit) {
    if (!Array.isArray(source) || limit <= 0) return [];
    if (source.length <= limit) return source.slice();
    const selected = [];
    const step = source.length / limit;
    for (let index = 0; index < limit; index += 1) selected.push(source[Math.floor(index * step)]);
    return selected;
  }

  function scaleLegacy(value) {
    return (Number(value) || 0) * LEGACY_SCALE;
  }

  function selectEventFrame(event, nowMs, frameCount) {
    const duration = Math.max(1, Number(event.durationMs) || 1);
    const elapsed = Math.max(0, Number(nowMs) - Number(event.startedAtMs));
    return Math.min(frameCount, Math.max(1, 1 + Math.floor(elapsed / (duration / frameCount))));
  }

  function assetCommand(key, gridX, gridY, size = TILE_SIZE, alpha = 1, offsetX = 0, offsetY = 0) {
    return {
      kind: "asset-vfx",
      key,
      x: gridX * TILE_SIZE + TILE_SIZE * 0.5 - size * 0.5 + offsetX,
      y: gridY * TILE_SIZE + TILE_SIZE * 0.5 - size * 0.5 + offsetY,
      width: size,
      height: size,
      alpha
    };
  }

  function collectVisualEventCommands(visual, profile) {
    const commands = [];
    const nowMs = Math.max(0, Number(visual.nowMs) || 0);
    const direction = (event) => ["north", "east", "south", "west"].includes(event.facing) ? event.facing : "south";
    for (const event of Array.isArray(visual.visualEvents) ? visual.visualEvents : []) {
      if (!event || nowMs < Number(event.startedAtMs) || nowMs - Number(event.startedAtMs) >= Number(event.durationMs)) continue;
      const alpha = profile.motionScale < 1 ? 0.82 : 1;
      if (["vault_hoard_sentence_cast", "vault_seal_break", "vault_lockdown_detonate"].includes(event.kind)) {
        const suffix = String(selectEventFrame(event, nowMs, 4)).padStart(2, "0");
        const prefix = event.kind === "vault_hoard_sentence_cast"
          ? "vfx.vault.hoard_sentence.cast.cast"
          : event.kind === "vault_seal_break"
            ? "vfx.vault.seal_break.break"
            : "vfx.vault.lockdown.detonation.detonation";
        const eventSize = event.kind === "vault_lockdown_detonate" ? 112 : 88;
        commands.push(assetCommand(`${prefix}${suffix}`, event.x, event.y, eventSize, alpha));
        continue;
      }
      let frameCount = 0;
      let prefix = "";
      let size = TILE_SIZE;
      if (event.kind === "riftweaver_rift_detonate") {
        frameCount = 8; prefix = "asset.vfx.expansion.riftweaver.spatial_rift.detonation.detonation"; size = 192 * 1.3;
      } else if (event.kind === "bulwark_shield_bash") {
        frameCount = 6; prefix = `asset.vfx.expansion.bulwark.shield_bash.${direction(event)}.bash`; size = 96;
      } else if (event.kind === "bulwark_blocked_hit") {
        frameCount = 4; prefix = "asset.vfx.expansion.bulwark.blocked_hit.blocked"; size = 96;
      } else if (event.kind === "bulwark_backstab_hit") {
        frameCount = 4; prefix = "asset.vfx.expansion.bulwark.backstab_hit.backstab"; size = 96;
      } else if (event.kind === "warden_voidstep_vanish") {
        frameCount = 6; prefix = "asset.vfx.expansion.warden.void_step.vanish.vanish"; size = 192;
      } else if (event.kind === "warden_voidstep_arrival") {
        frameCount = 6; prefix = "asset.vfx.expansion.warden.void_step.arrival.arrival"; size = 192;
      } else if (event.kind === "warden_doom_sigil_explode") {
        frameCount = 8; prefix = "asset.vfx.expansion.warden.doom_sigil.explosion.explosion"; size = 192;
      } else if (event.kind === "warden_soul_chain_impact") {
        frameCount = 6; prefix = "asset.vfx.expansion.warden.soul_chain.impact.impact"; size = 96;
      } else if (event.kind === "warden_soul_chain_pull") {
        frameCount = 4; prefix = "asset.vfx.expansion.warden.soul_chain.pull.pull"; size = 96;
      } else if (event.kind === "blacksmith_chain_hook_impact") {
        frameCount = 6; prefix = "asset.vfx.expansion.forge_guardian.chain_hook.impact.impact"; size = 96;
      } else if (event.kind === "blacksmith_chain_hook_pull") {
        frameCount = 4; prefix = "asset.vfx.expansion.forge_guardian.chain_hook.pull.pull"; size = 96;
      } else if (event.kind === "blacksmith_overheat_transition") {
        frameCount = 6; prefix = `asset.bosses.blacksmith_guardian.overheat.transition.${direction(event)}_overheat`; size = 128;
      } else if (event.kind === "warden_phase2_transform") {
        frameCount = 8; prefix = `asset.bosses.warden.phase_2_reborn.transformation.${direction(event)}_transform`; size = 192;
      } else if (event.kind === "warden_final_death") {
        frameCount = 8; prefix = `asset.bosses.warden.phase_2_reborn.final_death.${direction(event)}_final_death`; size = 192;
      }
      if (event.kind === "warden_lattice_burst") {
        const frame = selectEventFrame(event, nowMs, 6);
        const suffix = String(frame).padStart(2, "0");
        for (const tile of Array.isArray(event.tiles) ? event.tiles : []) {
          commands.push(assetCommand(`asset.vfx.expansion.warden.rift_lattice.burst.burst_${suffix}`, tile.x, tile.y, TILE_SIZE, alpha));
        }
        continue;
      }
      if (event.kind === "warden_soul_chain_fire" || event.kind === "blacksmith_chain_hook_fire") {
        const isForge = event.kind.startsWith("blacksmith");
        const base = isForge ? "asset.vfx.expansion.forge_guardian.chain_hook" : "asset.vfx.expansion.warden.soul_chain";
        const tiles = Array.isArray(event.tiles) ? event.tiles : [];
        const frame = selectEventFrame(event, nowMs, 4);
        const suffix = String(frame).padStart(2, "0");
        for (let index = 0; index < tiles.length; index += 1) {
          const tile = tiles[index];
          const previous = index > 0 ? tiles[index - 1] : { x: event.x, y: event.y };
          const orientation = tile.x === previous.x ? "vertical" : "horizontal";
          commands.push(assetCommand(`${base}.segment.${orientation}.segment_${suffix}`, tile.x, tile.y, TILE_SIZE, alpha));
        }
        const last = tiles[tiles.length - 1];
        if (last) commands.push(assetCommand(`${base}.hook.${direction(event)}.hook_${suffix}`, last.x, last.y, TILE_SIZE, alpha));
        continue;
      }
      if (!frameCount || !prefix) continue;
      const suffix = String(selectEventFrame(event, nowMs, frameCount)).padStart(2, "0");
      const offsetY = event.kind === "riftweaver_rift_detonate" ? -TILE_SIZE * 0.25 : 0;
      commands.push(assetCommand(`${prefix}_${suffix}`, event.x, event.y, size, alpha, 0, offsetY));
    }
    return commands;
  }

  function collectVfxCommands(snapshot, options = {}) {
    const visual = snapshot && typeof snapshot === "object" ? snapshot : {};
    const profile = getVfxProfile(options);
    const commands = [];
    for (const particle of evenlySample(visual.particles, profile.particleBudget)) {
      if (!particle) continue;
      commands.push({
        kind: "particle", x: scaleLegacy(particle.x), y: scaleLegacy(particle.y),
        size: Math.max(2, scaleLegacy(particle.size || 1)), color: particle.color || "#ffffff",
        alpha: normalizeLifetime(particle.life, particle.maxLife)
      });
    }
    for (const item of Array.isArray(visual.floatingTexts) ? visual.floatingTexts : []) {
      if (!item) continue;
      commands.push({
        kind: "floating-text", x: scaleLegacy(item.x), y: scaleLegacy(item.y),
        text: String(item.text || ""), color: item.color || "#ffffff",
        size: Math.max(12, scaleLegacy(item.size || 8)), alpha: normalizeLifetime(item.life, item.maxLife)
      });
    }
    for (const bolt of Array.isArray(visual.rangedBolts) ? visual.rangedBolts : []) {
      if (!bolt) continue;
      const progress = clamp(bolt.progress, 0, 1);
      const fromX = scaleLegacy(bolt.fromX); const fromY = scaleLegacy(bolt.fromY);
      const toX = scaleLegacy(bolt.toX); const toY = scaleLegacy(bolt.toY);
      commands.push({ kind: "bolt", fromX, fromY, toX, toY, progress, color: bolt.color || "#9fdcff", alpha: normalizeLifetime(bolt.life, bolt.maxLife) });
    }
    for (const impact of Array.isArray(visual.rangedImpacts) ? visual.rangedImpacts : []) {
      if (!impact) continue;
      commands.push({ kind: "impact", x: scaleLegacy(impact.x), y: scaleLegacy(impact.y), radius: Math.max(4, scaleLegacy(impact.radius)), color: impact.color || "#ffffff", alpha: normalizeLifetime(impact.life, impact.maxLife) });
    }
    for (const trail of Array.isArray(visual.dashTrails) ? visual.dashTrails : []) {
      if (!trail) continue;
      commands.push({
        kind: "dash-trail",
        fromX: scaleLegacy(trail.fromX), fromY: scaleLegacy(trail.fromY),
        toX: scaleLegacy(trail.toX), toY: scaleLegacy(trail.toY),
        color: trail.color || "#9fdcff",
        tier: normalizeTier(trail.tier),
        style: trail.style || "travel",
        seed: Number(trail.seed) || 0,
        alpha: normalizeLifetime(trail.life, trail.maxLife) * profile.motionScale,
        detailScale: profile.motionScale
      });
    }
    for (const ring of Array.isArray(visual.shockwaveRings) ? visual.shockwaveRings : []) {
      if (!ring) continue;
      commands.push({
        kind: "shockwave",
        x: scaleLegacy(ring.x), y: scaleLegacy(ring.y), radius: scaleLegacy(ring.radius),
        color: ring.color || "#f2cb92", core: ring.core || "#fff0cf",
        skill: ring.skill || "",
        tier: normalizeTier(ring.tier),
        style: ring.style || "primary",
        furySpent: Math.max(0, Math.floor(Number(ring.furySpent) || 0)),
        ringIndex: Math.max(1, Math.floor(Number(ring.ringIndex) || 1)),
        seed: Number(ring.seed) || 0,
        alpha: normalizeLifetime(ring.life, ring.maxLife),
        detailScale: profile.motionScale
      });
    }
    const player = visual.player && typeof visual.player === "object" ? visual.player : {};
    const afterline = player.dashAfterline && typeof player.dashAfterline === "object" ? player.dashAfterline : null;
    if (afterline && Array.isArray(afterline.tiles)) {
      const turns = Math.max(0, Number(afterline.turns) || 0);
      const maxTurns = Math.max(1, Number(afterline.maxTurns) || turns || 1);
      const fade = clamp(turns / maxTurns, 0, 1);
      for (let index = 0; index < afterline.tiles.length; index += 1) {
        const tile = afterline.tiles[index];
        if (!tile || !Number.isFinite(Number(tile.x)) || !Number.isFinite(Number(tile.y))) continue;
        commands.push({
          kind: "dash-afterline",
          x: Number(tile.x) * TILE_SIZE,
          y: Number(tile.y) * TILE_SIZE,
          index,
          pulse: pulseAt(visual.nowMs, index + 19),
          alpha: fade * profile.motionScale,
          detailScale: profile.motionScale
        });
      }
    }
    const hp = Number(player.hp); const maxHp = Number(player.maxHp);
    if (Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0 && hp > 0 && hp / maxHp <= 0.25) {
      commands.push({ kind: "low-hp", alpha: profile.lightFlashOpacity * (0.5 + pulseAt(visual.nowMs, 7) * 0.5) });
    }
    commands.push(...collectVisualEventCommands(visual, profile));
    return commands;
  }

  function withContext(context, draw) {
    if (!context || typeof draw !== "function") return;
    const canSave = typeof context.save === "function" && typeof context.restore === "function";
    if (canSave) context.save();
    try { draw(); } finally { if (canSave) context.restore(); }
  }

  function strokeSegment(context, fromX, fromY, toX, toY, color, width, alpha) {
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(toX, toY);
    context.stroke();
  }

  function drawDashTrailCommand(context, command) {
    const dx = command.toX - command.fromX;
    const dy = command.toY - command.fromY;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    const tier = command.tier;
    const voidStyle = tier >= 3 || command.style === "void";
    const edgeColor = voidStyle ? "#8b5cf6" : tier >= 2 ? "#67d8ff" : "#78c9ef";
    const coreColor = voidStyle ? "#f5efff" : "#e9fbff";

    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalCompositeOperation = "screen";
    strokeSegment(context, command.fromX, command.fromY, command.toX, command.toY, edgeColor, 10 + tier * 4, command.alpha * 0.18);
    strokeSegment(context, command.fromX, command.fromY, command.toX, command.toY, command.color, 5 + tier * 1.5, command.alpha * 0.72);
    strokeSegment(context, command.fromX, command.fromY, command.toX, command.toY, coreColor, 1.8 + tier * 0.7, command.alpha * 0.95);

    if (tier >= 1) {
      const offset = 5 + tier * 1.5;
      strokeSegment(context, command.fromX + nx * offset, command.fromY + ny * offset, command.toX + nx * offset, command.toY + ny * offset, edgeColor, 1.5 + tier * 0.4, command.alpha * 0.52);
      strokeSegment(context, command.fromX - nx * offset, command.fromY - ny * offset, command.toX - nx * offset, command.toY - ny * offset, edgeColor, 1.5 + tier * 0.4, command.alpha * 0.52);
    }

    if (tier >= 2 && command.detailScale > 0.5) {
      const ghosts = tier >= 3 ? 3 : 2;
      for (let index = 1; index <= ghosts; index += 1) {
        const t = index / (ghosts + 1);
        const x = command.fromX + dx * t;
        const y = command.fromY + dy * t;
        const size = 7 + tier * 2;
        context.globalAlpha = command.alpha * (0.22 + index * 0.04);
        context.strokeStyle = voidStyle && index % 2 === 0 ? "#c4a7ff" : "#bceeff";
        context.lineWidth = 1.6;
        context.beginPath();
        context.moveTo(x + dx / length * size, y + dy / length * size);
        context.lineTo(x + nx * size * 0.55, y + ny * size * 0.55);
        context.lineTo(x - dx / length * size, y - dy / length * size);
        context.lineTo(x - nx * size * 0.55, y - ny * size * 0.55);
        context.closePath();
        context.stroke();
      }
    }

    const rays = 4 + tier * 2;
    for (let index = 0; index < rays; index += 1) {
      const angle = seededAngle(command.seed, index, rays);
      const inner = 4 + tier;
      const outer = 10 + tier * 3 + (index % 2) * 3;
      strokeSegment(
        context,
        command.toX + Math.cos(angle) * inner,
        command.toY + Math.sin(angle) * inner,
        command.toX + Math.cos(angle) * outer,
        command.toY + Math.sin(angle) * outer,
        voidStyle && index % 2 ? "#b393ff" : coreColor,
        1.3 + tier * 0.35,
        command.alpha * 0.7
      );
    }
  }

  function drawDashAfterlineCommand(context, command) {
    const inset = 6;
    const centerX = command.x + TILE_SIZE * 0.5;
    const centerY = command.y + TILE_SIZE * 0.5;
    context.globalCompositeOperation = "screen";
    context.globalAlpha = command.alpha * (0.08 + command.pulse * 0.06);
    context.fillStyle = "#5b32a8";
    context.fillRect(command.x + inset, command.y + inset, TILE_SIZE - inset * 2, TILE_SIZE - inset * 2);
    context.globalAlpha = command.alpha * (0.38 + command.pulse * 0.22);
    context.strokeStyle = command.index % 2 === 0 ? "#8fdcff" : "#b997ff";
    context.lineWidth = 2;
    context.strokeRect(command.x + inset + 1, command.y + inset + 1, TILE_SIZE - inset * 2 - 2, TILE_SIZE - inset * 2 - 2);
    if (command.detailScale > 0.5) {
      context.globalAlpha = command.alpha * 0.65;
      context.strokeStyle = "#eee8ff";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(centerX - 9, centerY);
      context.lineTo(centerX, centerY - 9);
      context.lineTo(centerX + 9, centerY);
      context.lineTo(centerX, centerY + 9);
      context.closePath();
      context.stroke();
    }
  }

  function drawShockwaveCommand(context, command) {
    const tier = command.tier;
    const dashStyle = command.skill === "dash";
    const legendary = tier >= 3;
    const radius = Math.max(2, command.radius);
    const detailScale = command.detailScale;
    context.globalCompositeOperation = "screen";

    if (typeof context.createRadialGradient === "function") {
      const gradient = context.createRadialGradient(command.x, command.y, 0, command.x, command.y, Math.max(8, radius));
      gradient.addColorStop(0, command.core);
      gradient.addColorStop(0.34, legendary ? "rgba(255,238,211,0.34)" : dashStyle ? "rgba(190,238,255,0.26)" : "rgba(255,208,140,0.24)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.globalAlpha = command.alpha * (0.16 + tier * 0.035);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(command.x, command.y, radius, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = command.alpha * 0.95;
    context.strokeStyle = command.color;
    context.lineWidth = 4.5 + tier * 1.4;
    context.beginPath();
    context.arc(command.x, command.y, radius, 0, Math.PI * 2);
    context.stroke();

    context.globalAlpha = command.alpha * 0.72;
    context.strokeStyle = command.core;
    context.lineWidth = 1.5 + tier * 0.45;
    context.beginPath();
    context.arc(command.x, command.y, Math.max(1, radius - 5 - tier), 0, Math.PI * 2);
    context.stroke();

    const baseSpokes = dashStyle ? 6 : 8;
    const spokeCount = Math.max(4, Math.round((baseSpokes + tier * 2 + Math.min(3, command.furySpent) * 2) * Math.max(0.5, detailScale)));
    for (let index = 0; index < spokeCount; index += 1) {
      const angle = seededAngle(command.seed + command.ringIndex * 31, index, spokeCount);
      const inner = radius * (tier >= 1 ? 0.72 : 0.82);
      const outer = radius * (1.06 + (index % 3) * 0.035);
      strokeSegment(
        context,
        command.x + Math.cos(angle) * inner,
        command.y + Math.sin(angle) * inner,
        command.x + Math.cos(angle) * outer,
        command.y + Math.sin(angle) * outer,
        legendary && index % 2 ? "#c8a5ff" : command.color,
        1.2 + tier * 0.45,
        command.alpha * (0.34 + tier * 0.1)
      );
    }

    if (tier >= 2) {
      context.globalAlpha = command.alpha * 0.58;
      context.strokeStyle = legendary || command.style === "outer" ? "#c7a0ff" : "#ffdca7";
      context.lineWidth = 2.5 + tier * 0.6;
      if (typeof context.setLineDash === "function") context.setLineDash([10 + tier * 2, 7]);
      context.beginPath();
      context.arc(command.x, command.y, radius * 0.7, 0, Math.PI * 2);
      context.stroke();
      if (typeof context.setLineDash === "function") context.setLineDash([]);
    }

    if (legendary && detailScale > 0.5) {
      const arcRadius = radius * 1.16;
      context.globalAlpha = command.alpha * 0.7;
      context.strokeStyle = "#b88cff";
      context.lineWidth = 3;
      for (let index = 0; index < 4; index += 1) {
        const start = seededAngle(command.seed + 73, index, 4);
        context.beginPath();
        context.arc(command.x, command.y, arcRadius, start, start + Math.PI * 0.34);
        context.stroke();
      }
    }
  }

  function drawOptionalAsset(context, assets, key, centerX, centerY, size) {
    const image = assets instanceof Map ? assets.get(key) : null;
    if (!image || typeof context.drawImage !== "function") return false;
    context.drawImage(image, centerX - size / 2, centerY - size / 2, size, size);
    return true;
  }

  function drawTelegraphs(context, snapshot, options = runtimeOptions(), assets) {
    withContext(context, () => {
      for (const command of collectTelegraphCommands(snapshot, options)) {
        context.globalAlpha = command.alpha;
        if (command.kind === "warden-burst-range") {
          const centerX = command.x * TILE_SIZE + TILE_SIZE / 2;
          const centerY = command.y * TILE_SIZE + TILE_SIZE / 2;
          context.strokeStyle = "#bca4ef";
          context.lineWidth = 2;
          if (typeof context.setLineDash === "function") context.setLineDash([10, 8]);
          context.beginPath();
          context.arc(centerX, centerY, command.radius * TILE_SIZE, 0, Math.PI * 2);
          context.stroke();
          if (typeof context.setLineDash === "function") context.setLineDash([]);
          continue;
        }
        if (command.kind === "aim-line") {
          context.strokeStyle = "#ffb36b"; context.lineWidth = 3;
          context.beginPath(); context.moveTo(command.x * TILE_SIZE + 32, command.y * TILE_SIZE + 32);
          context.lineTo(command.targetX * TILE_SIZE + 32, command.targetY * TILE_SIZE + 32); context.stroke();
          continue;
        }
        if (command.kind === "dash-aim") {
          context.strokeStyle = "#9fdcff"; context.lineWidth = 3;
          context.strokeRect(command.x * TILE_SIZE + 6, command.y * TILE_SIZE + 6, 52, 52);
          continue;
        }
        if (command.kind === "vault-sentence-mark") {
          const centerX = command.x * TILE_SIZE + TILE_SIZE / 2;
          const centerY = command.y * TILE_SIZE + TILE_SIZE / 2;
          const assetDrawn = drawOptionalAsset(
            context, assets, `vfx.vault.hoard_sentence.mark.mark${command.frame}`,
            centerX, centerY, 76
          );
          if (!assetDrawn) {
            context.strokeStyle = command.turns <= 1 ? "#ff4d57" : "#ff9b55";
            context.lineWidth = command.turns <= 1 ? 5 : 3;
            context.beginPath();
            context.arc(centerX, centerY, 27, 0, Math.PI * 2);
            context.stroke();
            context.strokeStyle = "#ffe48a";
            context.lineWidth = 2;
            context.strokeRect(centerX - 19, centerY - 19, 38, 38);
          }
          if (typeof context.fillText === "function") {
            context.globalAlpha = Math.min(1, command.alpha + 0.25);
            context.fillStyle = "#fff0b5";
            context.font = "900 18px monospace";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(String(command.turns), centerX, centerY - 18);
          }
          continue;
        }
        if (command.kind === "vault-lockdown-anchor") {
          const px = command.x * TILE_SIZE;
          const py = command.y * TILE_SIZE;
          if (!drawOptionalAsset(context, assets, `vfx.vault.lockdown.anchor.anchor${command.frame}`, px + 32, py + 32, 82)) {
            context.strokeStyle = command.color;
            context.lineWidth = 4;
            context.strokeRect(px + 8, py + 8, 48, 48);
            context.beginPath();
            context.arc(px + 32, py + 32, 18, 0, Math.PI * 2);
            context.stroke();
          }
          continue;
        }
        if (command.kind === "vault-lockdown-area") {
          const centerX = command.x * TILE_SIZE + TILE_SIZE / 2;
          const centerY = command.y * TILE_SIZE + TILE_SIZE / 2;
          if (drawOptionalAsset(context, assets, `vfx.vault.lockdown.tile.tile${command.frame}`, centerX, centerY, 68)) continue;
        }
        context.fillStyle = command.color || (command.kind === "mine-area" ? "#ff685f" : "#a56cff");
        context.fillRect(command.x * TILE_SIZE + 3, command.y * TILE_SIZE + 3, 58, 58);
        context.strokeStyle = command.color || "#ffd0a8"; context.lineWidth = 2;
        context.strokeRect(command.x * TILE_SIZE + 4, command.y * TILE_SIZE + 4, 56, 56);
      }
    });
  }

  function drawVfx(context, snapshot, options = runtimeOptions(), assets) {
    withContext(context, () => {
      for (const command of collectVfxCommands(snapshot, options)) {
        context.globalAlpha = command.alpha;
        if (command.kind === "asset-vfx") {
          const image = assets instanceof Map ? assets.get(command.key) : null;
          if (image && typeof context.drawImage === "function") {
            context.drawImage(image, command.x, command.y, command.width, command.height);
          }
        } else if (command.kind === "particle") {
          context.fillStyle = command.color; context.fillRect(command.x, command.y, command.size, command.size);
        } else if (command.kind === "floating-text" && typeof context.fillText === "function") {
          context.textAlign = "center"; context.textBaseline = "middle"; context.font = `900 ${command.size}px monospace`;
          if (typeof context.strokeText === "function") { context.lineWidth = Math.max(2, command.size * 0.18); context.strokeStyle = "#000000"; context.strokeText(command.text, command.x, command.y); }
          context.fillStyle = command.color; context.fillText(command.text, command.x, command.y);
        } else if (command.kind === "bolt") {
          const progress = command.progress;
          const endX = command.fromX + (command.toX - command.fromX) * progress;
          const endY = command.fromY + (command.toY - command.fromY) * progress;
          context.strokeStyle = command.color; context.lineWidth = 7;
          context.beginPath(); context.moveTo(command.fromX, command.fromY); context.lineTo(endX, endY); context.stroke();
        } else if (command.kind === "dash-trail") {
          drawDashTrailCommand(context, command);
        } else if (command.kind === "dash-afterline") {
          drawDashAfterlineCommand(context, command);
        } else if (command.kind === "impact") {
          context.strokeStyle = command.color; context.lineWidth = 4;
          context.beginPath(); context.arc(command.x, command.y, Math.max(1, command.radius), 0, Math.PI * 2); context.stroke();
        } else if (command.kind === "shockwave") {
          if (command.skill === "aoe" || command.skill === "dash") {
            drawShockwaveCommand(context, command);
          } else {
            context.strokeStyle = command.color; context.lineWidth = 5;
            context.beginPath(); context.arc(command.x, command.y, Math.max(1, command.radius), 0, Math.PI * 2); context.stroke();
          }
        } else if (command.kind === "low-hp") {
          context.strokeStyle = "#ff4545"; context.lineWidth = 14; context.strokeRect(7, 7, 562, 562);
        }
      }
    });
  }

  return Object.freeze({
    normalizeLifetime,
    getVfxProfile,
    runtimeOptions,
    areaTiles,
    collectTelegraphCommands,
    collectVfxCommands,
    drawTelegraphs,
    drawVfx
  });
});
