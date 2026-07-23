const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const layers = require(path.join(ROOT, "render", "hd-renderer-layers.js"));
const THEMES = Object.freeze([
  ["descent", 1],
  ["corruption", 20],
  ["abyss", 40]
]);
const CORNERS = Object.freeze([
  ["northwest", "NW", "SE", 0, 0],
  ["northeast", "NE", "SW", 512, 0],
  ["southwest", "SW", "NE", 0, 512],
  ["southeast", "SE", "NW", 512, 512]
]);

const CORNER_PROBE = String.raw`
import json
import sys
from pathlib import Path
from PIL import Image

root = Path(sys.argv[1])
quadrants = {
    "NW": (0, 0, 32, 32),
    "NE": (32, 0, 64, 32),
    "SW": (0, 32, 32, 64),
    "SE": (32, 32, 64, 64),
}
corners = {
    "northwest": ("NW", "SE"),
    "northeast": ("NE", "SW"),
    "southwest": ("SW", "NE"),
    "southeast": ("SE", "NW"),
}
metrics = []
for theme in ("descent", "corruption", "abyss"):
    directory = root / "assets" / "hd" / "environment" / theme
    for name, (outer_name, interior_name) in corners.items():
        alpha = Image.open(directory / f"wall-corner-{name}.png").convert("RGBA").getchannel("A")
        def coverage(quadrant):
            x0, y0, x1, y1 = quadrants[quadrant]
            visible = sum(alpha.getpixel((x, y)) > 24 for y in range(y0, y1) for x in range(x0, x1))
            return visible / ((x1 - x0) * (y1 - y0))
        metrics.append({
            "theme": theme,
            "corner": name,
            "outer": coverage(outer_name),
            "interior": coverage(interior_name),
        })
print(json.dumps(metrics))
`;

function allEnvironmentAssets() {
  const entries = [];
  for (const [theme] of THEMES) {
    for (const suffix of [
      "floor.base",
      "wall.north",
      "wall.south",
      "wall.east",
      "wall.west",
      "corner.northwest",
      "corner.northeast",
      "corner.southwest",
      "corner.southeast"
    ]) {
      const key = `environment.${theme}.${suffix}`;
      entries.push([key, Object.freeze({ key })]);
    }
  }
  return new Map(entries);
}

test("wall corners keep the solid outer corner and open the room-facing quadrant", () => {
  const probe = spawnSync("python", ["-c", CORNER_PROBE, ROOT], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30000
  });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
  const metrics = JSON.parse(probe.stdout);
  assert.equal(metrics.length, 12);
  for (const metric of metrics) {
    assert.ok(
      metric.outer >= metric.interior + 0.12,
      `${metric.theme} ${metric.corner} appears reversed: outer=${metric.outer.toFixed(3)}, interior=${metric.interior.toFixed(3)}`
    );
  }
});

test("renderer places every semantic corner at the matching physical board corner", () => {
  const assets = allEnvironmentAssets();
  for (const [theme, depth] of THEMES) {
    const calls = [];
    const context = {
      drawImage(image, x, y, width, height) {
        calls.push({ key: image.key, x, y, width, height });
      }
    };
    layers.drawFloorLayer(context, {
      depth,
      floorPattern: Array.from({ length: 9 }, () => Array(9).fill(0))
    }, assets);
    for (const [corner, , , x, y] of CORNERS) {
      assert.ok(
        calls.some((call) => call.key === `environment.${theme}.corner.${corner}` && call.x === x && call.y === y),
        `${theme} ${corner} must draw at ${x},${y}`
      );
    }
  }
});
