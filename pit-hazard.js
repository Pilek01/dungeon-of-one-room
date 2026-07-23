(function attachPitHazard(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DungeonPitHazard = api;
})(typeof globalThis !== "undefined" ? globalThis : null, function createPitHazardApi() {
  "use strict";

  const ELIGIBLE_ROOM_TYPES = new Set(["combat", "cursed", "treasure", "shrine"]);
  const CARDINALS = Object.freeze([
    Object.freeze({ dx: 0, dy: -1, bit: 1 }),
    Object.freeze({ dx: 1, dy: 0, bit: 2 }),
    Object.freeze({ dx: 0, dy: 1, bit: 4 }),
    Object.freeze({ dx: -1, dy: 0, bit: 8 })
  ]);

  function tileKey(x, y) {
    return `${Math.round(Number(x) || 0)},${Math.round(Number(y) || 0)}`;
  }

  function isPitRoomEligible({ depth, bossRoom, roomType } = {}) {
    return Math.floor(Number(depth) || 0) >= 61 && bossRoom !== true && ELIGIBLE_ROOM_TYPES.has(String(roomType || ""));
  }

  function pitCountRange(depth) {
    return Math.floor(Number(depth) || 0) >= 80 ? [3, 5] : [1, 3];
  }

  function randomIndex(length, random) {
    return Math.max(0, Math.min(length - 1, Math.floor(random() * length)));
  }

  function isReserved(x, y, reserved) {
    return reserved.some((tile) => {
      const margin = Math.max(0, Math.floor(Number(tile.margin) || 0));
      return Math.max(Math.abs(x - tile.x), Math.abs(y - tile.y)) <= margin;
    });
  }

  function hasPath(start, goal, blocked, gridSize) {
    if (!start || !goal) return true;
    const startKey = tileKey(start.x, start.y);
    const goalKey = tileKey(goal.x, goal.y);
    if (blocked.has(startKey) || blocked.has(goalKey)) return false;
    const queue = [{ x: start.x, y: start.y }];
    const visited = new Set([startKey]);
    while (queue.length > 0) {
      const current = queue.shift();
      if (tileKey(current.x, current.y) === goalKey) return true;
      for (const { dx, dy } of CARDINALS) {
        const x = current.x + dx;
        const y = current.y + dy;
        const key = tileKey(x, y);
        if (x < 1 || y < 1 || x > gridSize - 2 || y > gridSize - 2) continue;
        if (blocked.has(key) || visited.has(key)) continue;
        visited.add(key);
        queue.push({ x, y });
      }
    }
    return false;
  }

  function growCluster(seed, available, pits, desired, random) {
    const frontier = [seed];
    while (frontier.length > 0 && pits.size < desired) {
      const current = frontier[randomIndex(frontier.length, random)];
      const neighbors = CARDINALS
        .map(({ dx, dy }) => ({ x: current.x + dx, y: current.y + dy }))
        .filter((tile) => available.has(tileKey(tile.x, tile.y)) && !pits.has(tileKey(tile.x, tile.y)));
      if (neighbors.length <= 0) {
        frontier.splice(frontier.indexOf(current), 1);
        continue;
      }
      const next = neighbors[randomIndex(neighbors.length, random)];
      pits.set(tileKey(next.x, next.y), next);
      frontier.push(next);
    }
  }

  function generatePitTiles(options = {}) {
    if (!isPitRoomEligible(options)) return [];
    const gridSize = Math.max(5, Math.floor(Number(options.gridSize) || 9));
    const random = typeof options.random === "function" ? options.random : Math.random;
    const reserved = Array.isArray(options.reservedTiles)
      ? options.reservedTiles.filter(Boolean).map((tile) => ({
          x: Math.round(Number(tile.x) || 0),
          y: Math.round(Number(tile.y) || 0),
          margin: Math.max(0, Math.floor(Number(tile.margin) || 0))
        }))
      : [];
    const candidates = [];
    for (let y = 3; y <= gridSize - 3; y += 1) {
      for (let x = 2; x <= gridSize - 3; x += 1) {
        if (!isReserved(x, y, reserved)) candidates.push({ x, y });
      }
    }
    if (candidates.length <= 0) return [];
    const available = new Map(candidates.map((tile) => [tileKey(tile.x, tile.y), tile]));
    const [minimum, maximum] = pitCountRange(options.depth);
    const desired = Math.min(candidates.length, minimum + randomIndex(maximum - minimum + 1, random));
    const clusterCount = Number(options.depth) >= 80 && desired >= 4 && random() >= 0.5 ? 2 : 1;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const pits = new Map();
      for (let cluster = 0; cluster < clusterCount && pits.size < desired; cluster += 1) {
        const remaining = candidates.filter((tile) => !pits.has(tileKey(tile.x, tile.y)));
        if (remaining.length <= 0) break;
        const seed = remaining[randomIndex(remaining.length, random)];
        pits.set(tileKey(seed.x, seed.y), seed);
        const clusterTarget = clusterCount === 1
          ? desired
          : Math.min(desired, pits.size + Math.ceil((desired - pits.size) / (clusterCount - cluster)));
        growCluster(seed, available, pits, clusterTarget, random);
      }
      if (pits.size < minimum) continue;
      const blocked = new Set(pits.keys());
      if (!hasPath(options.player, options.portal, blocked, gridSize)) continue;
      return Array.from(pits.values()).slice(0, desired);
    }
    return [];
  }

  function getPitMask(pits, x, y) {
    const keys = new Set((Array.isArray(pits) ? pits : []).map((pit) => tileKey(pit.x, pit.y)));
    return CARDINALS.reduce((mask, direction) => (
      keys.has(tileKey(x + direction.dx, y + direction.dy)) ? mask | direction.bit : mask
    ), 0);
  }

  function findNearestSafeTile(options = {}) {
    const gridSize = Math.max(5, Math.floor(Number(options.gridSize) || 9));
    const pits = new Set((Array.isArray(options.pits) ? options.pits : []).map((pit) => tileKey(pit.x, pit.y)));
    const isBlocked = typeof options.isBlocked === "function" ? options.isBlocked : () => false;
    const start = options.preferred && !pits.has(tileKey(options.preferred.x, options.preferred.y)) && !isBlocked(options.preferred.x, options.preferred.y)
      ? { x: options.preferred.x, y: options.preferred.y }
      : { x: Math.round(Number(options.fromX) || 4), y: Math.round(Number(options.fromY) || 4) };
    const queue = [start];
    const visited = new Set([tileKey(start.x, start.y)]);
    while (queue.length > 0) {
      const current = queue.shift();
      const currentKey = tileKey(current.x, current.y);
      if (current.x >= 1 && current.y >= 1 && current.x <= gridSize - 2 && current.y <= gridSize - 2 && !pits.has(currentKey) && !isBlocked(current.x, current.y)) {
        return current;
      }
      for (const { dx, dy } of CARDINALS) {
        const next = { x: current.x + dx, y: current.y + dy };
        const key = tileKey(next.x, next.y);
        if (next.x < 1 || next.y < 1 || next.x > gridSize - 2 || next.y > gridSize - 2 || visited.has(key)) continue;
        visited.add(key);
        queue.push(next);
      }
    }
    return { x: 4, y: 4 };
  }

  return Object.freeze({
    ELIGIBLE_ROOM_TYPES,
    isPitRoomEligible,
    pitCountRange,
    generatePitTiles,
    getPitMask,
    findNearestSafeTile
  });
});
