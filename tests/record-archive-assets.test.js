const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const assets = Object.freeze([
  { rank: 1, role: "champion", path: "assets/hd/ui/leaderboard/skull-medallion-gold.png" },
  { rank: 2, role: "runner_up", path: "assets/hd/ui/leaderboard/skull-medallion-silver.png" },
  { rank: 3, role: "third_place", path: "assets/hd/ui/leaderboard/skull-medallion-bronze.png" }
]);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function inspectPng(relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE), `${relativePath} must be a PNG`);
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR", `${relativePath} must have an IHDR`);
  return Object.freeze({
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
    sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  });
}

function inspectAlpha(relativePath) {
  const probe = [
    "from PIL import Image",
    "import json, sys",
    "image = Image.open(sys.argv[1]).convert('RGBA')",
    "alpha = [pixel[3] for pixel in image.getdata()]",
    "print(json.dumps({'transparent': sum(value == 0 for value in alpha), 'minAlpha': min(alpha), 'corners': [image.getpixel(point)[3] for point in ((0, 0), (255, 0), (0, 255), (255, 255))]}))"
  ].join("\n");
  const result = spawnSync("python", ["-c", probe, path.join(root, relativePath)], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || "alpha inspection failed");
  return JSON.parse(result.stdout);
}

test("Gothic podium medallions are distinct transparent 256px assets with an exact manifest", () => {
  const manifestPath = path.join(root, "assets/hd/ui/leaderboard/medallions-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const hashes = new Set();

  for (const asset of assets) {
    const png = inspectPng(asset.path);
    assert.equal(png.width, 256, `${asset.path} width`);
    assert.equal(png.height, 256, `${asset.path} height`);
    assert.equal(png.colorType, 6, `${asset.path} must be RGBA`);
    const alpha = inspectAlpha(asset.path);
    assert.ok(alpha.transparent > 0 && alpha.minAlpha === 0, `${asset.path} must contain transparent pixels`);
    assert.deepEqual(alpha.corners, [0, 0, 0, 0], `${asset.path} must have transparent corners`);
    hashes.add(png.sha256);
    assert.deepEqual(manifest.medallions.find((entry) => entry.rank === asset.rank), {
      rank: asset.rank,
      role: asset.role,
      path: asset.path,
      width: 256,
      height: 256,
      colorType: "rgba",
      sha256: png.sha256
    });
  }

  assert.equal(hashes.size, assets.length, "each podium rank must use unique final bytes");
});

test("shared archive maps each podium rank to its dedicated medallion without a floor-skull fallback", () => {
  const source = fs.readFileSync(path.join(root, "record-archive-ui.js"), "utf8");
  for (const asset of assets) {
    assert.match(source, new RegExp(`${asset.rank}:\\s*"${asset.path}"`));
  }
  assert.doesNotMatch(source, /floor-skull\.png/);
  assert.doesNotMatch(source, /filter:\s*(?:sepia|grayscale)/);
});
