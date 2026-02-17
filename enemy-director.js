(() => {
  const DIRECTIONS = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 }
  ];

  function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function sign(value) {
    return value > 0 ? 1 : value < 0 ? -1 : 0;
  }

  function roleForEnemy(enemy) {
    if (!enemy || !enemy.type) return "swarm";
    if (enemy.type === "skeleton") return "ranged";
    if (enemy.type === "acolyte") return "ranged";
    if (enemy.type === "warden") return "zoning";
    if (enemy.type === "brute") return "bruiser";
    if (enemy.type === "skitter") return "bruiser";
    return "swarm";
  }

  function hasLineOfSightFrom(fromX, fromY, toX, toY, chests) {
    if (fromX === toX) {
      const minY = Math.min(fromY, toY);
      const maxY = Math.max(fromY, toY);
      for (let y = minY + 1; y < maxY; y += 1) {
        if (chests.some((chest) => chest.x === fromX && chest.y === y)) return false;
      }
      return true;
    }
    if (fromY === toY) {
      const minX = Math.min(fromX, toX);
      const maxX = Math.max(fromX, toX);
      for (let x = minX + 1; x < maxX; x += 1) {
        if (chests.some((chest) => chest.x === x && chest.y === fromY)) return false;
      }
      return true;
    }
    return false;
  }

  function canCastFrom(enemy, tile, player, chests) {
    const lineDistance = Math.abs(tile.x - player.x) + Math.abs(tile.y - player.y);
    const hasLine = hasLineOfSightFrom(tile.x, tile.y, player.x, player.y, chests);
    if (enemy.type === "skeleton") {
      return hasLine && lineDistance >= 2 && lineDistance <= (enemy.range || 3);
    }
    if (enemy.type === "acolyte") {
      return hasLine && lineDistance >= 2 && lineDistance <= (enemy.range || 4);
    }
    if (enemy.type === "warden") {
      return hasLine && lineDistance > 1 && lineDistance <= (enemy.range || 4);
    }
    return false;
  }

  function ensureMemory(enemy) {
    if (!enemy) return;
    if (!Number.isFinite(enemy.aiLastSeenX)) enemy.aiLastSeenX = enemy.x;
    if (!Number.isFinite(enemy.aiLastSeenY)) enemy.aiLastSeenY = enemy.y;
    if (!Number.isFinite(enemy.aiMemoryTtl)) enemy.aiMemoryTtl = 0;
    if (!Number.isFinite(enemy.aiPersonality)) enemy.aiPersonality = Math.random() * 2 - 1;
  }

  function updateMemory(enemy, canSeePlayer, player) {
    ensureMemory(enemy);
    if (canSeePlayer) {
      enemy.aiLastSeenX = player.x;
      enemy.aiLastSeenY = player.y;
      enemy.aiMemoryTtl = 2;
      return;
    }
    enemy.aiMemoryTtl = Math.max(0, (Number(enemy.aiMemoryTtl) || 0) - 1);
  }

  function countAdjacentAllies(tile, enemies, self) {
    let count = 0;
    for (const enemy of enemies) {
      if (!enemy || enemy === self) continue;
      if (Math.abs(enemy.x - tile.x) <= 1 && Math.abs(enemy.y - tile.y) <= 1) {
        count += 1;
      }
    }
    return count;
  }

  function isBlocked(tile, enemy, enemies, chests, inBounds) {
    if (!inBounds(tile.x, tile.y)) return true;
    if (chests.some((chest) => chest.x === tile.x && chest.y === tile.y)) return true;
    if (enemies.some((other) => other !== enemy && other.x === tile.x && other.y === tile.y)) return true;
    return false;
  }

  function chooseIntent(role, enemy, distance, canCastNow, canSeePlayer, context) {
    const playerLowHp = context.playerLowHp;
    const playerShieldActive = context.playerShieldActive;
    const focusMode = context.focusMode || "normal";
    const lane = context.lane || "support";
    const wantsPressure = playerLowHp && !playerShieldActive;

    if (role === "zoning" || role === "ranged") {
      if (enemy.aiming || canCastNow) {
        if (playerShieldActive) {
          return Math.random() < 0.7 ? "hold" : "flank";
        }
        return "cast";
      }
      if (distance <= 1) return "retreat";
      if (focusMode === "pressure" && canSeePlayer) return "cast";
      if (!canSeePlayer && (enemy.aiMemoryTtl || 0) > 0) return "chase";
      return "flank";
    }

    if (role === "bruiser") {
      if (distance <= 1 && (enemy.cooldown || 0) <= 0) return "cast";
      if (wantsPressure && Math.random() < 0.35) return "cutoff";
      if (!canSeePlayer && (enemy.aiMemoryTtl || 0) > 0) return "chase";
      return distance <= 2 ? "chase" : "flank";
    }

    if (lane === "frontline" && canSeePlayer) {
      return wantsPressure ? "chase" : "flank";
    }
    if (wantsPressure && Math.random() < 0.4) return "chase";
    if (focusMode === "bait" && canSeePlayer && Math.random() < 0.45) return "hold";
    if (!canSeePlayer && (enemy.aiMemoryTtl || 0) > 0) return "chase";
    return distance <= 1 ? "hold" : (Math.random() < 0.5 ? "flank" : "chase");
  }

  function scoreTile(tile, context) {
    const {
      enemy,
      player,
      portal,
      intent,
      role,
      currentDistance,
      enemies,
      spikes,
      chests,
      meleeSlotsUsed,
      meleeSlotsLimit,
      playerShieldActive,
      blackboard
    } = context;

    const distance = manhattan(tile.x, tile.y, player.x, player.y);
    const portalDistance = manhattan(tile.x, tile.y, portal.x, portal.y);
    const sameAxis = tile.x === player.x || tile.y === player.y;
    const flankBonus = !sameAxis && distance <= 2 ? 5 : 0;
    const castFromTile = canCastFrom(enemy, tile, player, chests);
    const allyDensity = countAdjacentAllies(tile, enemies, enemy);
    const onSpike = spikes.has(`${tile.x},${tile.y}`);
    const meleeRange = distance === 1;
    const tileThreat = Number(blackboard?.threatMap?.[`${tile.x},${tile.y}`]) || 0;
    const focusMode = String(blackboard?.focusMode || "normal");

    let score = 0;
    if (intent === "chase") {
      score += 36 - distance * 10;
      score += flankBonus;
    } else if (intent === "flank") {
      score += 28 - Math.abs(distance - 2) * 8;
      score += flankBonus * 2;
    } else if (intent === "hold") {
      const desired = role === "zoning" || role === "ranged" ? 3 : 1;
      score += 22 - Math.abs(distance - desired) * 8;
    } else if (intent === "retreat") {
      score += distance * 8;
      if (castFromTile) score += 6;
    } else if (intent === "cast") {
      score += castFromTile ? 30 : 14 - Math.abs(distance - 3) * 6;
      if (role === "zoning") score += 4;
    } else if (intent === "cutoff") {
      score += 18 - portalDistance * 6;
      score += 12 - Math.abs(distance - 2) * 5;
    }

    if (castFromTile && (role === "zoning" || role === "ranged")) score += 5;
    if (onSpike) score -= 26;
    score -= tileThreat * 0.22;
    score -= allyDensity * 3.5;

    if (playerShieldActive && (role === "zoning" || role === "ranged") && castFromTile) {
      score -= 12;
    }

    if (focusMode === "pressure" && distance <= 2) score += 3;
    if (focusMode === "bait" && castFromTile) score -= 3;

    if (meleeRange && meleeSlotsUsed >= meleeSlotsLimit && role !== "bruiser") {
      score -= 22;
    }

    if (intent === "chase" && distance > currentDistance) score -= 4;
    if (intent === "retreat" && distance < currentDistance) score -= 4;

    const personality = Number(enemy.aiPersonality) || 0;
    const noise = (Math.random() * 2 - 1) * 2.2; // 5-10% movement variance
    score += personality * 1.4 + noise;
    return score;
  }

  function decidePlan(input) {
    const enemy = input?.enemy;
    if (!enemy || !input?.player || !input?.inBounds) {
      return { intent: "chase", moveTo: null, role: "swarm" };
    }

    const player = input.player;
    const portal = input.portal || { x: player.x, y: player.y };
    const enemies = Array.isArray(input.enemies) ? input.enemies : [];
    const chests = Array.isArray(input.chests) ? input.chests : [];
    const spikes = new Set((Array.isArray(input.spikes) ? input.spikes : []).map((spike) => `${spike.x},${spike.y}`));
    const meleeSlotsUsed = Math.max(0, Number(input.meleeSlotsUsed) || 0);
    const meleeSlotsLimit = Math.max(1, Number(input.meleeSlotsLimit) || 1);
    const playerShieldActive = Boolean(input.playerShieldActive);
    const playerLowHp = Boolean(input.playerLowHp);
    const blackboard = input.blackboard || null;

    const role = roleForEnemy(enemy);
    const lane = blackboard?.roleAssignments?.get(enemy) || "support";
    const currentDistance = manhattan(enemy.x, enemy.y, player.x, player.y);
    const canSeePlayer =
      hasLineOfSightFrom(enemy.x, enemy.y, player.x, player.y, chests) ||
      currentDistance <= 2;
    const canCastNow = canCastFrom(enemy, enemy, player, chests);

    if (!input.previewOnly) {
      updateMemory(enemy, canSeePlayer, player);
    } else {
      ensureMemory(enemy);
    }
    const intent = chooseIntent(role, enemy, currentDistance, canCastNow, canSeePlayer, {
      playerLowHp,
      playerShieldActive,
      focusMode: blackboard?.focusMode || "normal",
      lane
    });

    const candidates = [];
    for (const dir of DIRECTIONS) {
      const tile = { x: enemy.x + dir.x, y: enemy.y + dir.y };
      if (dir.x === 0 && dir.y === 0) {
        // holding position is always legal
      } else if (isBlocked(tile, enemy, enemies, chests, input.inBounds)) {
        continue;
      }
      const score = scoreTile(tile, {
        enemy,
        player,
        portal,
        intent,
        role,
        currentDistance,
        enemies,
        spikes,
        chests,
        meleeSlotsUsed,
        meleeSlotsLimit,
        playerShieldActive,
        blackboard
      });
      candidates.push({
        tile,
        score,
        onSpike: spikes.has(`${tile.x},${tile.y}`)
      });
    }

    let bestTile = { x: enemy.x, y: enemy.y };
    let bestScore = Number.NEGATIVE_INFINITY;
    const hasNonSpikeCandidate = candidates.some((candidate) => !candidate.onSpike);
    const preferredCandidates = hasNonSpikeCandidate
      ? candidates.filter((candidate) => !candidate.onSpike)
      : candidates;
    for (const candidate of preferredCandidates) {
      if (candidate.score > bestScore) {
        bestScore = candidate.score;
        bestTile = candidate.tile;
      }
    }

    if (
      !canSeePlayer &&
      (enemy.aiMemoryTtl || 0) > 0 &&
      bestTile.x === enemy.x &&
      bestTile.y === enemy.y
    ) {
      const memDx = sign((enemy.aiLastSeenX || enemy.x) - enemy.x);
      const memDy = sign((enemy.aiLastSeenY || enemy.y) - enemy.y);
      const memoryTile = { x: enemy.x + memDx, y: enemy.y + memDy };
      if (
        !isBlocked(memoryTile, enemy, enemies, chests, input.inBounds) &&
        (!hasNonSpikeCandidate || !spikes.has(`${memoryTile.x},${memoryTile.y}`))
      ) {
        bestTile = memoryTile;
      }
    }

    const moveTo =
      bestTile.x === enemy.x && bestTile.y === enemy.y
        ? null
        : { x: bestTile.x, y: bestTile.y };

    return {
      role,
      lane,
      intent,
      canSeePlayer,
      canCastNow,
      moveTo,
      threatAtCurrentTile: Number(blackboard?.threatMap?.[`${enemy.x},${enemy.y}`]) || 0
    };
  }

  window.DungeonEnemyDirector = {
    decidePlan
  };
})();
