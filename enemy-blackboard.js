(() => {
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

  function detectStrafePattern(recentPositions = []) {
    if (!Array.isArray(recentPositions) || recentPositions.length < 4) {
      return { active: false, predicted: null, axis: "" };
    }
    const last4 = recentPositions.slice(-4).map((item) => ({
      x: Math.round(Number(item?.x) || 0),
      y: Math.round(Number(item?.y) || 0)
    }));
    const a = last4[0];
    const b = last4[1];
    const c = last4[2];
    const d = last4[3];
    const toggles =
      a.x === c.x &&
      a.y === c.y &&
      b.x === d.x &&
      b.y === d.y &&
      !(a.x === b.x && a.y === b.y) &&
      manhattan(a.x, a.y, b.x, b.y) === 1;
    if (!toggles) {
      return { active: false, predicted: null, axis: "" };
    }
    const axis = a.x !== b.x ? "x" : "y";
    // Pattern A-B-A-B => next likely A (the position from 2 turns ago).
    const predicted = { x: c.x, y: c.y };
    return { active: true, predicted, axis };
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
    const focusMode = strafe.active
      ? "intercept"
      : playerShieldActive
        ? "bait"
        : (playerLowHp ? "pressure" : "normal");

    return {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      focusMode,
      strafe,
      melee: {
        limit: meleeLimit,
        committed: 0
      },
      telegraph: {
        limit: telegraphLimit,
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
