(function attachRoomObjectPlacement(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DungeonRoomObjectPlacement = api;
})(typeof window !== "undefined" ? window : null, function createRoomObjectPlacementApi() {
  "use strict";

  const GRID_SIZE = 9;
  const LARGE_OBJECT_EDGE_INSET = 2;
  const LARGE_OBJECT_FOOTPRINT_MARGIN = 1;

  function tileKey(x, y) {
    return `${x},${y}`;
  }

  function isLargeObjectCenter(x, y, edgeInset = LARGE_OBJECT_EDGE_INSET) {
    const inset = Math.max(1, Math.round(Number(edgeInset) || LARGE_OBJECT_EDGE_INSET));
    return Number.isInteger(x) && Number.isInteger(y)
      && x >= inset && y >= inset
      && x <= GRID_SIZE - 1 - inset
      && y <= GRID_SIZE - 1 - inset;
  }

  function footprintTiles(point, margin = LARGE_OBJECT_FOOTPRINT_MARGIN) {
    if (!point || !Number.isInteger(point.x) || !Number.isInteger(point.y)) return [];
    const radius = Math.max(0, Math.round(Number(margin) || 0));
    const tiles = [];
    for (let y = point.y - radius; y <= point.y + radius; y += 1) {
      for (let x = point.x - radius; x <= point.x + radius; x += 1) {
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  function canPlaceLargeObject(occupied, point, options = {}) {
    if (!isLargeObjectCenter(point?.x, point?.y, options.edgeInset)) return false;
    const blocked = occupied instanceof Set ? occupied : new Set();
    const isBlocked = typeof options.isBlocked === "function" ? options.isBlocked : () => false;
    return footprintTiles(point, options.margin).every((tile) => (
      !blocked.has(tileKey(tile.x, tile.y)) && !isBlocked(tile.x, tile.y)
    ));
  }

  function reserveLargeObject(occupied, point, margin = LARGE_OBJECT_FOOTPRINT_MARGIN) {
    if (!(occupied instanceof Set) || !point) return;
    for (const tile of footprintTiles(point, margin)) occupied.add(tileKey(tile.x, tile.y));
  }

  function chooseLargeObjectTile(occupied, options = {}) {
    const blocked = occupied instanceof Set ? occupied : new Set();
    const edgeInset = Math.max(1, Math.round(Number(options.edgeInset) || LARGE_OBJECT_EDGE_INSET));
    const margin = Math.max(0, Math.round(Number(options.margin) || 0));
    const random = typeof options.random === "function" ? options.random : Math.random;
    const candidates = [];
    for (let y = edgeInset; y <= GRID_SIZE - 1 - edgeInset; y += 1) {
      for (let x = edgeInset; x <= GRID_SIZE - 1 - edgeInset; x += 1) {
        const point = { x, y };
        if (canPlaceLargeObject(blocked, point, { ...options, edgeInset, margin })) candidates.push(point);
      }
    }
    if (candidates.length === 0) return null;
    const normalizedRandom = Math.max(0, Math.min(0.999999, Number(random()) || 0));
    const choice = candidates[Math.floor(normalizedRandom * candidates.length)];
    reserveLargeObject(blocked, choice, margin);
    return choice;
  }

  function chooseCriticalLargeObjectTile(occupied, options = {}) {
    const attempts = [
      { edgeInset: 2, margin: 1 },
      { edgeInset: 2, margin: 0 },
      { edgeInset: 1, margin: 0 }
    ];
    for (const attempt of attempts) {
      const point = chooseLargeObjectTile(occupied, {
        ...options,
        ...attempt,
        random: () => 0
      });
      if (point) return point;
    }
    return null;
  }

  return Object.freeze({
    GRID_SIZE,
    LARGE_OBJECT_EDGE_INSET,
    LARGE_OBJECT_FOOTPRINT_MARGIN,
    tileKey,
    isLargeObjectCenter,
    footprintTiles,
    canPlaceLargeObject,
    reserveLargeObject,
    chooseLargeObjectTile,
    chooseCriticalLargeObjectTile
  });
});
