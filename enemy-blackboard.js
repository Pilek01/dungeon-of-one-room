(() => {
  const ANTI_STRAFE_TRIGGER_CYCLES = 3;
  const ANTI_STRAFE_ACTIVE_TURNS = 4;
  const ANTI_STRAFE_COOLDOWN_TURNS = 8;
  const ANTI_STRAFE_MIN_ENEMIES = 2;

  function tileKey(x, y) {
    return `${x},${y}`;
  }

  function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function countActiveTelegraphs(enemies = []) {
    let count = 0;
    for (const enemy of enemies) {
      if (!enemy) continue;
      if (enemy.aiming || enemy.slamAiming || enemy.volleyAiming || enemy.burstAiming) {
        count += 1;
      }
    }
    return count;
  }

  function buildThreatMap({ gridSize = 9, player, spikes = [], chests = [], enemies = [] }) {
    const out = {};
    const spikeSet = new Set((Array.isArray(spikes) ? spikes : []).map((spike) => tileKey(spike.x, spike.y)));
    const blockedChestSet = new Set((Array.isArray(chests) ? chests : []).map((chest) => tileKey(chest.x, chest.y)));

    for (let y = 1; y <= gridSize - 2; y += 1) {
      for (let x = 1; x <= gridSize - 2; x += 1) {
        let threat = 0;
        if (spikeSet.has(tileKey(x, y))) threat += 40;
        if (blockedChestSet.has(tileKey(x, y))) threat += 24;

        const dPlayer = manhattan(x, y, player.x, player.y);
        if (dPlayer === 1) threat += 18;
        else if (dPlayer === 2) threat += 8;

        const nearbyEnemies = enemies.filter((enemy) =>
          enemy && Math.abs(enemy.x - x) <= 1 && Math.abs(enemy.y - y) <= 1
        ).length;
        if (nearbyEnemies > 2) threat += (nearbyEnemies - 2) * 4;

        out[tileKey(x, y)] = clamp(Math.round(threat), 0, 100);
      }
    }
    return out;
  }

  function buildRoleAssignments(enemies, player) {
    const items = [...enemies]
      .filter(Boolean)
      .map((enemy) => ({
        enemy,
        d: manhattan(enemy.x, enemy.y, player.x, player.y)
      }))
      .sort((a, b) => a.d - b.d);

    const frontlineCount = clamp(Math.ceil(items.length * 0.34), 1, 2);
    const map = new Map();
    for (let i = 0; i < items.length; i += 1) {
      const lane = i < frontlineCount ? "frontline" : "support";
      map.set(items[i].enemy, lane);
    }
    return map;
  }

  function sanitizePosition(value) {
    return {
      x: Math.round(Number(value?.x) || 0),
      y: Math.round(Number(value?.y) || 0)
    };
  }

  function isSamePos(a, b) {
    return Boolean(a && b && a.x === b.x && a.y === b.y);
  }

  function detectStrafePattern(recentPositions = []) {
    if (!Array.isArray(recentPositions) || recentPositions.length < 4) {
      return { active: false, predicted: null, axis: "", cycles: 0 };
    }

    const sequence = recentPositions.map(sanitizePosition);
    const last = sequence[sequence.length - 1];
    const prev = sequence[sequence.length - 2];
    if (!last || !prev || isSamePos(last, prev) || manhattan(last.x, last.y, prev.x, prev.y) !== 1) {
      return { active: false, predicted: null, axis: "", cycles: 0 };
    }

    let alternatingLength = 2;
    for (let i = sequence.length - 3; i >= 0; i -= 1) {
      const expected = alternatingLength % 2 === 0 ? last : prev;
      const candidate = sequence[i];
      if (!isSamePos(candidate, expected)) break;
      alternatingLength += 1;
    }

    const cycles = Math.max(0, Math.floor((alternatingLength - 1) / 2));
    if (cycles <= 0) {
      return { active: false, predicted: null, axis: "", cycles: 0 };
    }

    const axis = last.x !== prev.x ? "x" : "y";
    // A-B-A-B... => next likely previous tile.
    const predicted = { x: prev.x, y: prev.y };
    return { active: true, predicted, axis, cycles };
  }

  function getAntiStrafeDepthBand(depth) {
    const safeDepth = Math.max(0, Math.floor(Number(depth) || 0));
    if (safeDepth >= 40) return "late";
    if (safeDepth >= 20) return "mid";
    return "early";
  }

  function getAntiStrafeWindowBonuses(depthBand) {
    if (depthBand === "late") {
      return { meleeBonus: 1, telegraphBonus: 1 };
    }
    if (depthBand === "mid") {
      return { meleeBonus: 1, telegraphBonus: 0 };
    }
    return { meleeBonus: 0, telegraphBonus: 0 };
  }

  function normalizeAntiStrafeState(input) {
    if (!input || typeof input !== "object") {
      return {
        activeUntilTurn: 0,
        cooldownUntilTurn: 0,
        triggeredAtTurn: -1,
        active: false,
        coolingDown: false,
        turnsRemaining: 0,
        cooldownRemaining: 0,
        triggered: false
      };
    }
    return {
      activeUntilTurn: Math.max(0, Number(input.activeUntilTurn) || 0),
      cooldownUntilTurn: Math.max(0, Number(input.cooldownUntilTurn) || 0),
      triggeredAtTurn: Math.floor(Number(input.triggeredAtTurn) || -1),
      active: false,
      coolingDown: false,
      turnsRemaining: 0,
      cooldownRemaining: 0,
      triggered: false
    };
  }

  function resolveAntiStrafeState(input = {}) {
    const currentTurn = Math.max(0, Number(input.currentTurn) || 0);
    const currentDepth = Math.max(0, Math.floor(Number(input.currentDepth) || 0));
    const depthBand = getAntiStrafeDepthBand(currentDepth);
    const enemiesCount = Math.max(0, Number(input.enemiesCount) || 0);
    const strafe = input.strafe || { active: false, cycles: 0 };
    const state = normalizeAntiStrafeState(input.previousState);

    state.active = currentTurn < state.activeUntilTurn;
    state.coolingDown = currentTurn < state.cooldownUntilTurn;
    state.turnsRemaining = state.active ? Math.max(0, state.activeUntilTurn - currentTurn) : 0;
    state.cooldownRemaining = state.coolingDown ? Math.max(0, state.cooldownUntilTurn - currentTurn) : 0;

    const canTrigger =
      !state.active &&
      !state.coolingDown &&
      Boolean(strafe.active) &&
      Math.max(0, Number(strafe.cycles) || 0) >= ANTI_STRAFE_TRIGGER_CYCLES &&
      enemiesCount >= ANTI_STRAFE_MIN_ENEMIES;

    if (!canTrigger) {
      state.depthBand = depthBand;
      return state;
    }

    const activeUntilTurn = currentTurn + ANTI_STRAFE_ACTIVE_TURNS;
    const cooldownUntilTurn = activeUntilTurn + ANTI_STRAFE_COOLDOWN_TURNS;
    return {
      activeUntilTurn,
      cooldownUntilTurn,
      triggeredAtTurn: currentTurn,
      depthBand,
      active: true,
      coolingDown: true,
      turnsRemaining: ANTI_STRAFE_ACTIVE_TURNS,
      cooldownRemaining: ANTI_STRAFE_ACTIVE_TURNS + ANTI_STRAFE_COOLDOWN_TURNS,
      triggered: true
    };
  }

  function createBlackboard(input = {}) {
    const enemies = Array.isArray(input.enemies) ? input.enemies : [];
    const player = input.player || { x: 4, y: 4, hp: 100, maxHp: 100 };
    const meleeLimit = clamp(Number(input.meleeLimit) || 1, 1, 3);
    const telegraphLimit = clamp(
      Number(input.telegraphLimit) || (enemies.length >= 6 ? 3 : 2),
      1,
      4
    );
    const playerLowHp = Boolean(input.playerLowHp);
    const playerShieldActive = Boolean(input.playerShieldActive);
    const strafe = detectStrafePattern(input.playerRecentPositions || []);
    const antiStrafe = resolveAntiStrafeState({
      currentTurn: input.currentTurn,
      currentDepth: input.currentDepth,
      previousState: input.antiStrafeState,
      strafe,
      enemiesCount: enemies.length
    });
    const antiStrafeBonuses = getAntiStrafeWindowBonuses(antiStrafe.depthBand);
    const boostedMeleeLimit = antiStrafe.active ? meleeLimit + antiStrafeBonuses.meleeBonus : meleeLimit;
    const boostedTelegraphLimit = antiStrafe.active ? telegraphLimit + antiStrafeBonuses.telegraphBonus : telegraphLimit;
    const focusMode = (antiStrafe.active || strafe.active)
      ? "intercept"
      : playerShieldActive
        ? "bait"
        : (playerLowHp ? "pressure" : "normal");

    return {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      focusMode,
      strafe,
      antiStrafe,
      melee: {
        limit: clamp(boostedMeleeLimit, 1, 3),
        committed: 0
      },
      telegraph: {
        limit: clamp(boostedTelegraphLimit, 1, 4),
        active: countActiveTelegraphs(enemies)
      },
      threatMap: buildThreatMap({
        gridSize: Number(input.gridSize) || 9,
        player,
        spikes: input.spikes || [],
        chests: input.chests || [],
        enemies
      }),
      roleAssignments: buildRoleAssignments(enemies, player)
    };
  }

  function getThreatAt(blackboard, x, y) {
    if (!blackboard || !blackboard.threatMap) return 0;
    return Number(blackboard.threatMap[tileKey(x, y)]) || 0;
  }

  function getEnemyLane(blackboard, enemy) {
    if (!blackboard || !blackboard.roleAssignments || !enemy) return "support";
    return blackboard.roleAssignments.get(enemy) || "support";
  }

  function canCommitMelee(blackboard) {
    if (!blackboard || !blackboard.melee) return true;
    return (blackboard.melee.committed || 0) < (blackboard.melee.limit || 1);
  }

  function registerMeleeCommit(blackboard) {
    if (!blackboard || !blackboard.melee) return;
    blackboard.melee.committed = Math.max(0, Number(blackboard.melee.committed) || 0) + 1;
  }

  function canStartTelegraph(blackboard, enemies = []) {
    if (!blackboard || !blackboard.telegraph) return true;
    const active = countActiveTelegraphs(enemies);
    blackboard.telegraph.active = active;
    return active < (blackboard.telegraph.limit || 1);
  }

  window.DungeonEnemyBlackboard = {
    createBlackboard,
    getThreatAt,
    getEnemyLane,
    canCommitMelee,
    registerMeleeCommit,
    canStartTelegraph,
    countActiveTelegraphs
  };
})();
