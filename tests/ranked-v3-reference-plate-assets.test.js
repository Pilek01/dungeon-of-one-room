const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");

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


function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function readPngPixels(filePath) {
  const bytes = fs.readFileSync(filePath);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  assert.equal(bitDepth, 8, `${path.basename(filePath)} must use 8-bit channels`);
  assert.ok(colorType === 2 || colorType === 6, `${path.basename(filePath)} must use RGB or RGBA pixels`);
  const channels = colorType === 6 ? 4 : 3;
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const filtered = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[sourceOffset];
    sourceOffset += 1;
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = filtered[sourceOffset + x];
      const left = x >= channels ? pixels[rowOffset + x - channels] : 0;
      const above = y > 0 ? pixels[rowOffset - stride + x] : 0;
      const upperLeft = y > 0 && x >= channels ? pixels[rowOffset - stride + x - channels] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? above
            : filter === 3 ? Math.floor((left + above) / 2)
              : filter === 4 ? paeth(left, above, upperLeft)
                : Number.NaN;
      assert.equal(Number.isNaN(predictor), false, `${path.basename(filePath)} uses unsupported PNG filter ${filter}`);
      pixels[rowOffset + x] = (raw + predictor) & 255;
    }
    sourceOffset += stride;
  }
  return { width, height, channels, pixels };
}

function regionContrast(image, [left, top, right, bottom]) {
  const x0 = Math.floor(left * image.width);
  const y0 = Math.floor(top * image.height);
  const x1 = Math.ceil(right * image.width);
  const y1 = Math.ceil(bottom * image.height);
  let count = 0;
  let sum = 0;
  let squareSum = 0;
  let bright = 0;
  for (let y = y0; y < y1; y += 3) {
    for (let x = x0; x < x1; x += 3) {
      const offset = (y * image.width + x) * image.channels;
      const luminance = image.pixels[offset] * 0.2126 + image.pixels[offset + 1] * 0.7152 + image.pixels[offset + 2] * 0.0722;
      count += 1;
      sum += luminance;
      squareSum += luminance * luminance;
      if (luminance > 100) bright += 1;
    }
  }
  const mean = sum / count;
  return {
    deviation: Math.sqrt(Math.max(0, squareSum / count - mean * mean)),
    brightFraction: bright / count
  };
}

test("Ranked plates retain the ornamental skull medallions instead of blank mounts", () => {
  const leaderboard = readPngPixels(path.join(ROOT, PLATES[0]));
  const leaderboardMounts = [
    [0.21, 0.24, 0.34, 0.43],
    [0.41, 0.19, 0.59, 0.43],
    [0.65, 0.24, 0.78, 0.43]
  ].map((region) => regionContrast(leaderboard, region));
  for (const [index, contrast] of leaderboardMounts.entries()) {
    assert.ok(contrast.deviation > 30, `leaderboard medallion ${index + 1} lost its detailed skull artwork`);
    assert.ok(contrast.brightFraction > 0.035, `leaderboard medallion ${index + 1} is an empty dark mount`);
  }

  const inspect = readPngPixels(path.join(ROOT, PLATES[1]));
  const rankMedallion = regionContrast(inspect, [0.14, 0.08, 0.30, 0.30]);
  assert.ok(rankMedallion.deviation > 28, "Inspect header lost its crowned rank skull artwork");
  assert.ok(rankMedallion.brightFraction > 0.03, "Inspect header rank mount is empty");
});
