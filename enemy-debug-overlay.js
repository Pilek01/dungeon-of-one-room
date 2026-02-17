(() => {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function tileCenter(tileSize, x, y) {
    return {
      x: x * tileSize + tileSize / 2,
      y: y * tileSize + tileSize / 2
    };
  }

  function drawThreatMap(ctx, options) {
    const {
      gridSize,
      tileSize,
      threatMap
    } = options;
    if (!threatMap) return;

    for (let y = 1; y <= gridSize - 2; y += 1) {
      for (let x = 1; x <= gridSize - 2; x += 1) {
        const key = `${x},${y}`;
        const threat = Number(threatMap[key]) || 0;
        if (threat <= 0) continue;
        const alpha = clamp(threat / 100, 0, 1) * 0.22;
        const px = x * tileSize;
        const py = y * tileSize;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ff6655";
        ctx.fillRect(px, py, tileSize, tileSize);
      }
    }
    ctx.globalAlpha = 1;
  }

  function intentColor(intent) {
    if (intent === "cast") return "#9dc9ff";
    if (intent === "cutoff") return "#ffad66";
    if (intent === "retreat") return "#8ce1a7";
    if (intent === "flank") return "#f5d17a";
    if (intent === "hold") return "#d0b9ff";
    return "#ffffff";
  }

  function intentGlyph(intent) {
    if (intent === "cast") return "C";
    if (intent === "cutoff") return "X";
    if (intent === "retreat") return "R";
    if (intent === "flank") return "F";
    if (intent === "hold") return "H";
    return "A";
  }

  function drawEnemyPlans(ctx, options) {
    const { tileSize, plans = [] } = options;
    if (!Array.isArray(plans) || plans.length <= 0) return;

    for (const item of plans) {
      const enemy = item?.enemy;
      if (!enemy) continue;
      const color = intentColor(item.intent);
      const from = tileCenter(tileSize, enemy.x, enemy.y);
      const to = item.moveTo ? tileCenter(tileSize, item.moveTo.x, item.moveTo.y) : from;

      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      if (to.x !== from.x || to.y !== from.y) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.fillRect(to.x - 1, to.y - 1, 2, 2);
      }

      ctx.globalAlpha = 0.95;
      ctx.fillStyle = "#0a1018";
      ctx.fillRect(from.x - 4, from.y - 9, 8, 6);
      ctx.fillStyle = color;
      ctx.font = "6px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(intentGlyph(item.intent), from.x, from.y - 6);
    }
    ctx.globalAlpha = 1;
  }

  function drawLegend(ctx, options) {
    const { blackboard } = options;
    if (!blackboard) return;
    const meleeLimit = Number(blackboard?.melee?.limit) || 1;
    const meleeCommitted = Number(blackboard?.melee?.committed) || 0;
    const teleLimit = Number(blackboard?.telegraph?.limit) || 1;
    const teleActive = Number(blackboard?.telegraph?.active) || 0;
    const focus = String(blackboard?.focusMode || "normal").toUpperCase();

    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "#060b12";
    ctx.fillRect(2, 2, 108, 20);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#d9ecff";
    ctx.font = "5px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`AI:${focus} M:${meleeCommitted}/${meleeLimit} T:${teleActive}/${teleLimit}`, 4, 4);
    ctx.fillText("F flank  C cast  X cutoff", 4, 11);
  }

  function draw(ctx, options = {}) {
    if (!ctx || !options.enabled) return;
    drawThreatMap(ctx, options);
    drawEnemyPlans(ctx, options);
    drawLegend(ctx, options);
  }

  window.DungeonEnemyDebugOverlay = {
    draw
  };
})();
