const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("lighting quality profiles cap darkness and dynamic light count", () => {
  const lighting = require("../render/hd-lighting.js");
  const high = lighting.getLightingProfile({ quality: "high" });
  const low = lighting.getLightingProfile({ quality: "low" });
  const accessible = lighting.getLightingProfile({ quality: "high", reducedEffects: true });
  assert.ok(high.ambientOpacity >= 0.18 && high.ambientOpacity <= 0.38);
  assert.ok(low.ambientOpacity >= 0.18 && low.ambientOpacity <= high.ambientOpacity);
  assert.ok(high.lightBudget > low.lightBudget);
  assert.ok(accessible.ambientOpacity < high.ambientOpacity);
  assert.ok(accessible.lightBudget <= high.lightBudget);
});
test("lighting commands derive deterministic bounded lights from visible snapshot state", () => {
  const lighting = require("../render/hd-lighting.js");
  const snapshot = {
    nowMs: 1250,
    phase: "playing",
    depth: 42,
    roomType: "forge",
    roomCleared: true,
    floorPattern: [
      Array(9).fill(0),
      [0, 3, 0, 0, 0, 0, 0, 3, 0],
      ...Array.from({ length: 7 }, () => Array(9).fill(0))
    ],
    portal: { x: 7, y: 7, active: false },
    forge: { x: 4, y: 3, awakened: true, used: false },
    player: { x: 4, y: 6, skillShield: 10 },
    enemies: [{ type: "warden", x: 4, y: 2, voidAegisShield: 20 }]
  };
  const before = JSON.stringify(snapshot);
  const first = lighting.collectLightingCommands(snapshot, { quality: "high" });
  const second = lighting.collectLightingCommands(snapshot, { quality: "high" });
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(snapshot), before);
  assert.ok(first.lights.some((light) => light.kind === "torch"));
  assert.ok(first.lights.some((light) => light.kind === "portal"));
  assert.ok(first.lights.some((light) => light.kind === "forge"));
  assert.ok(first.lights.some((light) => light.kind === "player-presence"));
  assert.ok(first.lights.some((light) => light.kind === "player-shield"));
  assert.ok(first.lights.some((light) => light.kind === "boss-aegis"));
  assert.ok(first.lights.length <= first.profile.lightBudget);
  assert.ok(first.lights.every((light) => light.radius >= 48 && light.radius <= 224));
});

test("Abyss reduces only the final ambient veil and preserves earlier depth profiles", () => {
  const lighting = require("../render/hd-lighting.js");
  const descent = lighting.collectLightingCommands({ depth: 1 }, { quality: "high" });
  const corruption = lighting.collectLightingCommands({ depth: 25 }, { quality: "high" });
  const abyss = lighting.collectLightingCommands({ depth: 45 }, { quality: "high" });
  const reducedAbyss = lighting.collectLightingCommands(
    { depth: 45 },
    { quality: "high", reducedEffects: true }
  );

  assert.equal(descent.ambient.opacity, 0.26);
  assert.equal(corruption.ambient.opacity, 0.26);
  assert.equal(abyss.ambient.opacity, 0.18);
  assert.equal(reducedAbyss.ambient.opacity, 0.12);
  assert.equal(abyss.profile.lightBudget, descent.profile.lightBudget);
});

test("Abyss strengthens only the existing player-presence separation light", () => {
  const lighting = require("../render/hd-lighting.js");
  const snapshot = { phase: "playing", player: { x: 4, y: 6 } };
  const descent = lighting.collectLightingCommands({ ...snapshot, depth: 1 });
  const abyss = lighting.collectLightingCommands({ ...snapshot, depth: 45 });
  const descentPresence = descent.lights.find((light) => light.kind === "player-presence");
  const abyssPresence = abyss.lights.find((light) => light.kind === "player-presence");

  assert.deepEqual(
    { radius: descentPresence.radius, strength: descentPresence.strength },
    { radius: 96, strength: 0.32 }
  );
  assert.deepEqual(
    { radius: abyssPresence.radius, strength: abyssPresence.strength },
    { radius: 112, strength: 0.48 }
  );
});

test("low quality retains critical portal and boss lights while dropping decorative torches first", () => {
  const lighting = require("../render/hd-lighting.js");
  const floorPattern = Array.from({ length: 9 }, () => Array(9).fill(3));
  const commands = lighting.collectLightingCommands({
    phase: "playing", roomCleared: true, floorPattern,
    portal: { x: 7, y: 7, active: true },
    enemies: [{ type: "warden", x: 4, y: 2, voidAegisShield: 10 }]
  }, { quality: "low" });
  assert.ok(commands.lights.some((light) => light.kind === "portal"));
  assert.ok(commands.lights.some((light) => light.kind === "boss-aegis"));
  assert.ok(commands.lights.length <= commands.profile.lightBudget);
});

test("HTML and HD renderer wire lighting before the renderer and replace the no-op layer", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const layers = fs.readFileSync(path.join(root, "render/hd-renderer-layers.js"), "utf8");
  assert.ok(html.indexOf('render/hd-lighting.js') > html.indexOf('render/hd-vfx.js'));
  assert.ok(html.indexOf('render/hd-lighting.js') < html.indexOf('render/hd-renderer-layers.js'));
  assert.match(layers, /DungeonHDLighting/);
  assert.match(layers, /lighting:\s*drawLightingLayer/);
  assert.doesNotMatch(layers, /lighting:\s*drawNothing/);
});

test("Warden portals keep the standard portal light contract but use crimson", () => {
  const lighting = require("../render/hd-lighting.js");
  const base = { phase: "playing", roomCleared: true, portal: { x: 7, y: 7, active: true } };
  const normal = lighting.collectLightingCommands(base).lights.find((light) => light.kind === "portal");
  const warden = lighting.collectLightingCommands({
    ...base,
    portal: { ...base.portal, kind: "warden" }
  }).lights.find((light) => light.kind === "portal");

  assert.equal(normal.color, "#6e9cff");
  assert.equal(warden.color, "#e34a56");
  assert.deepEqual(
    { x: warden.x, y: warden.y, radius: warden.radius, strength: warden.strength, priority: warden.priority },
    { x: normal.x, y: normal.y, radius: normal.radius, strength: normal.strength, priority: normal.priority }
  );
});