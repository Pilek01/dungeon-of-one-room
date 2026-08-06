const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const PLATES = [
  "assets/hd/ui/ranked-reference-plates/ranked-leaderboard-desktop-plate.png",
  "assets/hd/ui/ranked-reference-plates/ranked-build-inspect-desktop-plate.png"
];

function readPngDimensions(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${path.basename(filePath)} must be a PNG file`
  );
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
}

test("Ranked reference plates are present as 1536 x 1080 PNG assets", () => {
  for (const relativePath of PLATES) {
    const filePath = path.join(ROOT, relativePath);
    assert.equal(fs.existsSync(filePath), true, `${relativePath} must exist`);
    assert.deepEqual(readPngDimensions(filePath), { width: 1536, height: 1080 });
  }
});
