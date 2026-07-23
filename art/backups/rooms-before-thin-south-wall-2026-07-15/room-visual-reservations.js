(function attachRoomVisualReservations(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DungeonRoomVisualReservations = api;
})(typeof window !== "undefined" ? window : null, function createRoomVisualReservationsApi() {
  "use strict";

  const GRID_SIZE = 9;
  const TORCH_NOISE = 3;
  const SAFE_FLOOR_NOISE = 0;

  function tileKey(x, y) {
    return `${x},${y}`;
  }

  function isInteriorTile(x, y) {
    return Number.isInteger(x) && Number.isInteger(y)
      && x > 0 && y > 0 && x < GRID_SIZE - 1 && y < GRID_SIZE - 1;
  }

  function addTile(tiles, x, y) {
    if (isInteriorTile(x, y)) tiles.add(tileKey(x, y));
  }

  function addPointMargin(tiles, point, margin = 1) {
    if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return;
    const centerX = Math.round(Number(point.x));
    const centerY = Math.round(Number(point.y));
    for (let y = centerY - margin; y <= centerY + margin; y += 1) {
      for (let x = centerX - margin; x <= centerX + margin; x += 1) addTile(tiles, x, y);
    }
  }

  function addRectMargin(tiles, x, y, width, height, margin = 1) {
    const left = Math.round(Number(x));
    const top = Math.round(Number(y));
    const safeWidth = Math.max(1, Math.round(Number(width) || 1));
    const safeHeight = Math.max(1, Math.round(Number(height) || 1));
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    for (let tileY = top - margin; tileY < top + safeHeight + margin; tileY += 1) {
      for (let tileX = left - margin; tileX < left + safeWidth + margin; tileX += 1) addTile(tiles, tileX, tileY);
    }
  }

  function collectProtectedTiles(room) {
    const visual = room && typeof room === "object" ? room : {};
    const tiles = new Set();

    // Perspective-heavy north/south walls intrude into the adjacent visual row in HD.
    // Reserve those rows in shared room state so Classic and HD keep identical hazards.
    for (let x = 1; x < GRID_SIZE - 1; x += 1) {
      addTile(tiles, x, 1);
      addTile(tiles, x, GRID_SIZE - 2);
    }

    addPointMargin(tiles, visual.portal);
    addPointMargin(tiles, visual.shrine);
    addPointMargin(tiles, visual.merchant);
    addPointMargin(tiles, visual.pact);

    const chests = Array.isArray(visual.chests) ? visual.chests : [];
    for (const chest of chests) {
      if (chest && chest.type === "otter_red" && !chest.opened) addPointMargin(tiles, chest);
    }
    if (visual.otterChest && !visual.otterChest.opened) addPointMargin(tiles, visual.otterChest);

    if (visual.forge) {
      if (Number.isFinite(Number(visual.forge.originX)) && Number.isFinite(Number(visual.forge.originY))) {
        addRectMargin(
          tiles,
          visual.forge.originX,
          visual.forge.originY,
          visual.forge.width || 3,
          visual.forge.height || 3
        );
      } else {
        const blockedTiles = Array.isArray(visual.forge.blockedTiles) ? visual.forge.blockedTiles : [];
        for (const tile of blockedTiles) addPointMargin(tiles, tile);
        addPointMargin(tiles, visual.forge);
      }
    }

    if (visual.roomType === "vault" || visual.roomType === "otter") {
      // The two-tile HD seal plus one tile of breathing room.
      addPointMargin(tiles, { x: 4, y: 4 }, 2);
    }

    if (visual.bossRoom === true || visual.roomType === "boss") {
      // Three-tile center seal plus one-tile margin.
      addRectMargin(tiles, 3, 3, 3, 3);
      // North/south wall reliefs and their adjacent playable rows.
      addPointMargin(tiles, { x: 4, y: 0 });
      addPointMargin(tiles, { x: 4, y: GRID_SIZE - 1 });
    }

    return tiles;
  }

  function sanitizeRoomVisualConflicts(room) {
    const visual = room && typeof room === "object" ? room : {};
    const protectedTiles = collectProtectedTiles(visual);
    const floorPattern = Array.isArray(visual.floorPattern) ? visual.floorPattern : [];
    let removedTorches = 0;

    for (let y = 0; y < Math.min(GRID_SIZE, floorPattern.length); y += 1) {
      const row = Array.isArray(floorPattern[y]) ? floorPattern[y] : [];
      for (let x = 0; x < Math.min(GRID_SIZE, row.length); x += 1) {
        const wall = x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1;
        if (row[x] === TORCH_NOISE && (wall || protectedTiles.has(tileKey(x, y)))) {
          row[x] = SAFE_FLOOR_NOISE;
          removedTorches += 1;
        }
      }
    }

    const spikes = Array.isArray(visual.spikes) ? visual.spikes : [];
    const mines = Array.isArray(visual.mines) ? visual.mines : [];
    const canKeepHazard = (hazard) => hazard
      && isInteriorTile(hazard.x, hazard.y)
      && !protectedTiles.has(tileKey(hazard.x, hazard.y));
    visual.spikes = spikes.filter(canKeepHazard);
    visual.mines = mines.filter(canKeepHazard);

    return Object.freeze({
      protectedTiles,
      removedTorches,
      removedSpikes: spikes.length - visual.spikes.length,
      removedMines: mines.length - visual.mines.length
    });
  }

  return Object.freeze({ GRID_SIZE, TORCH_NOISE, collectProtectedTiles, sanitizeRoomVisualConflicts });
});
