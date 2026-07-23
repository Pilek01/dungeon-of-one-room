const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const manifestApi = require(path.join(projectRoot, "render", "hd-asset-manifest.js"));
const layersApi = require(path.join(projectRoot, "render", "hd-renderer-layers.js"));
const visualSnapshotApi = require(path.join(projectRoot, "render", "visual-snapshot.js"));
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ORIGINAL_SOURCE_SHA256 = "95d42f7402d5e8be87d9739069b090fd6c9f3269a6e0adb3e28565da065883d2";
const EXPECTED_HELPER_SHA256 = "7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea";
const LOCK_PATH = path.join(projectRoot, "art", "source", "abyssal-gothic-hd", "descent-environment-assets.lock.json");

const FINAL_ASSETS = Object.freeze([
  asset("environment.descent.floor.base", "assets/hd/environment/descent/floor-base.png", "environment", true),
  ...["b", "c", "skull", "crack_cross", "var3", "var4"].map((variant) =>
    asset(
      `environment.descent.floor.${variant}`,
      `assets/hd/environment/descent/floor-${variant.replaceAll("_", "-")}.png`,
      "environment",
      false
    )),
  asset("environment.descent.wall.north", "assets/hd/environment/descent/wall-north.png", "environment", true),
  asset("environment.descent.wall.south", "assets/hd/environment/descent/wall-south.png", "environment", true),
  asset("environment.descent.wall.east", "assets/hd/environment/descent/wall-east.png", "environment", true),
  asset("environment.descent.wall.west", "assets/hd/environment/descent/wall-west.png", "environment", true),
  asset("environment.descent.corner.northwest", "assets/hd/environment/descent/wall-corner-northwest.png", "environment", true),
  asset("environment.descent.corner.northeast", "assets/hd/environment/descent/wall-corner-northeast.png", "environment", true),
  asset("environment.descent.corner.southwest", "assets/hd/environment/descent/wall-corner-southwest.png", "environment", true),
  asset("environment.descent.corner.southeast", "assets/hd/environment/descent/wall-corner-southeast.png", "environment", true),
  asset("environment.descent.decal.crack", "assets/hd/environment/descent/decal-crack.png", "environment", false, 64, 64, true),
  asset("environment.descent.grate.base", "assets/hd/environment/descent/grate.png", "environment", false, 64, 64, true),
  asset("environment.descent.rubble.base", "assets/hd/environment/descent/rubble.png", "environment", false, 64, 64, true),
  asset("environment.descent.decal.stain01", "assets/hd/environment/descent/decal-stain-01.png", "environment", false, 64, 64, true),
  asset("environment.descent.decal.stain02", "assets/hd/environment/descent/decal-stain-02.png", "environment", false, 64, 64, true),
  asset("environment.descent.decal.stain03", "assets/hd/environment/descent/decal-stain-03.png", "environment", false, 64, 64, true),
  asset("object.common.torch.unlit", "assets/hd/objects/common/torch-unlit.png", "objects", false, 64, 64, true),
  asset("object.common.torch.lit01", "assets/hd/objects/common/torch-lit-01.png", "objects", false, 64, 64, true),
  asset("object.common.torch.lit02", "assets/hd/objects/common/torch-lit-02.png", "objects", false, 64, 64, true),
  asset("object.common.torch.lit03", "assets/hd/objects/common/torch-lit-03.png", "objects", false, 64, 64, true),
  asset("object.common.chest.normal", "assets/hd/objects/common/chest-normal.png", "objects", false, 64, 64, true),
  asset("object.common.shrine.inactive", "assets/hd/objects/common/shrine-inactive.png", "objects", false, 128, 128, true),
  asset("object.common.shrine.active", "assets/hd/objects/common/shrine-active.png", "objects", false, 128, 128, true),
  asset("object.common.portal.inactive", "assets/hd/objects/common/portal-inactive.png", "objects", false, 128, 128, true),
  asset("object.common.portal.active01", "assets/hd/objects/common/portal-active-01.png", "objects", false, 128, 128, true),
  asset("object.common.portal.active02", "assets/hd/objects/common/portal-active-02.png", "objects", false, 128, 128, true),
  asset("object.common.portal.active03", "assets/hd/objects/common/portal-active-03.png", "objects", false, 128, 128, true),
  asset("object.common.portal.frame", "assets/hd/objects/common/portal-frame.png", "objects", false, 128, 128, true),
  ...Array.from({ length: 8 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    return asset(`object.common.portal.swirl${suffix}`, `assets/hd/objects/common/portal-swirl-${suffix}.png`, "objects", false, 128, 128, true);
  }),
  asset("hazard.common.spikes.armed", "assets/hd/hazards/common/spikes-armed.png", "hazards", false, 64, 64, true),
  asset("hazard.descent.spikes.armed", "assets/hd/hazards/descent/spikes-armed.png", "hazards", false, 64, 64, true),
  asset("hazard.common.mine.unarmed", "assets/hd/hazards/common/mine-unarmed.png", "hazards", false, 64, 64, true),
  asset("hazard.common.mine.armed", "assets/hd/hazards/common/mine-armed.png", "hazards", false, 64, 64, true),
  asset("hazard.descent.mine.unarmed", "assets/hd/hazards/descent/mine-unarmed.png", "hazards", false, 64, 64, true),
  asset("hazard.descent.mine.armed", "assets/hd/hazards/descent/mine-armed.png", "hazards", false, 64, 64, true)
]);

const CHEST_ASSETS = Object.freeze(
  ["descent", "corruption", "abyss", "forge", "pact", "vault", "otter"].map((variant) =>
    asset(`object.chest.${variant}`, `assets/hd/objects/chest/${variant}.png`, "objects", false, 64, 64, true))
);

function asset(key, src, group, critical, width = 64, height = 64, alpha = false) {
  return Object.freeze({ key, src, group, critical, width, height, alpha });
}

function inspectPng(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.ok(buffer.length >= 33, `${filePath} must contain a complete PNG IHDR`);
  assert.ok(buffer.subarray(0, 8).equals(PNG_SIGNATURE), `${filePath} must have the PNG signature`);
  assert.equal(buffer.readUInt32BE(8), 13, `${filePath} must begin with a 13-byte IHDR chunk`);
  assert.equal(buffer.toString("ascii", 12, 16), "IHDR", `${filePath} must begin with IHDR`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25]
  };
}

function fakeAssets(keys) {
  return new Map(keys.map((key) => [key, Object.freeze({ key })]));
}

function drawingContext() {
  const calls = [];
  const fills = [];
  return {
    calls,
    fills,
    fillStyle: "",
    drawImage(image, x, y, width, height) {
      calls.push({ key: image.key, x, y, width, height });
    },
    fillRect(x, y, width, height) {
      fills.push({ fillStyle: this.fillStyle, x, y, width, height });
    }
  };
}

const ALPHA_PIXEL_PROBE = String.raw`
import json
import sys
from pathlib import Path
from PIL import Image

results = []
for raw_path in sys.argv[1:]:
    path = Path(raw_path)
    with Image.open(path) as source:
        image = source.convert("RGBA")
        pixels = list(image.get_flattened_data())
        exact = [alpha for red, green, blue, alpha in pixels
                 if alpha > 0 and (red, green, blue) == (255, 0, 255)]
        near = [alpha for red, green, blue, alpha in pixels
                if 0 < alpha <= 128
                and (red - 255) ** 2 + green ** 2 + (blue - 255) ** 2 <= 48 ** 2
                and red - green >= 96 and blue - green >= 96
                and abs(red - blue) <= 64]
        violet = sum(1 for red, green, blue, alpha in pixels
                     if alpha >= 64 and blue >= 80 and red >= 40
                     and blue >= green + 24 and red >= green + 12
                     and (red - 255) ** 2 + green ** 2 + (blue - 255) ** 2 > 100 ** 2)
        turquoise = sum(1 for red, green, blue, alpha in pixels
                        if alpha >= 64 and green >= 70 and blue >= 70
                        and green >= red + 20 and blue >= red + 20)
        visible = sum(1 for red, green, blue, alpha in pixels if alpha > 0)
        unique_visible = len({(red, green, blue) for red, green, blue, alpha in pixels if alpha >= 64})
        corners = [image.getpixel(point)[3] for point in (
            (0, 0), (image.width - 1, 0),
            (0, image.height - 1), (image.width - 1, image.height - 1),
        )]
        results.append({
            "path": raw_path.replace("\\\\", "/"),
            "width": image.width,
            "height": image.height,
            "exactCount": len(exact),
            "exactMaxAlpha": max(exact, default=0),
            "nearCount": len(near),
            "nearMaxAlpha": max(near, default=0),
            "visible": visible,
            "violet": violet,
            "turquoise": turquoise,
            "uniqueVisible": unique_visible,
            "corners": corners,
        })
print(json.dumps(results))
`;

function inspectAlphaAssets() {
  const alphaAssets = FINAL_ASSETS.filter((asset) => asset.alpha);
  const paths = alphaAssets.map((asset) => path.join(projectRoot, ...asset.src.split("/")));
  const probe = spawnSync("python", ["-c", ALPHA_PIXEL_PROBE, ...paths], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  assert.equal(probe.status, 0, probe.stderr || "alpha pixel probe failed");
  const metrics = JSON.parse(probe.stdout);
  assert.equal(metrics.length, alphaAssets.length, "every final alpha PNG must be inspected");
  return metrics.map((metric, index) => ({ ...metric, asset: alphaAssets[index] }));
}

function formatChromaViolations(metrics, countField, maxAlphaField) {
  return metrics
    .filter((metric) => metric[countField] > 0)
    .map((metric) => `${metric.asset.src}: count=${metric[countField]}, maxAlpha=${metric[maxAlphaField]}`)
    .join("\n");
}

function inspectAnimationInvariants(specs) {
  const probe = String.raw`
import json, sys
from pathlib import Path
from PIL import Image, ImageChops

specs=json.loads(sys.argv[1])
results=[]
for spec in specs:
    frames=[]
    for relative in spec["frames"]:
        with Image.open(Path(sys.argv[2]) / relative) as source:
            frames.append(source.convert("RGBA"))
    base=frames[0]
    width,height=base.size
    allowed=set()
    for shape in spec["motion"]:
        if shape[0] == "ellipse":
            _,cx,cy,rx,ry=shape
            for y in range(height):
                for x in range(width):
                    if ((x-cx)/rx)**2 + ((y-cy)/ry)**2 <= 1: allowed.add((x,y))
        else:
            _,left,top,right,bottom=shape
            allowed.update((x,y) for y in range(top,bottom) for x in range(left,right))
    outside=[]
    for index,frame in enumerate(frames[1:],1):
        changed=sum(1 for y in range(height) for x in range(width)
                    if (x,y) not in allowed and frame.getpixel((x,y)) != base.getpixel((x,y)))
        outside.append(changed)
    bounds=[frame.getchannel("A").getbbox() for frame in frames]
    lower_diffs=[]
    if "baseTop" in spec:
        crop=(0,spec["baseTop"],width,height)
        lower_diffs=[ImageChops.difference(base.crop(crop), frame.crop(crop)).getbbox() is not None
                     for frame in frames[1:]]
    visible_bbox=base.getchannel("A").getbbox()
    results.append({"name":spec["name"],"outside":outside,"bounds":bounds,
                    "lowerDiffs":lower_diffs,"visibleBbox":visible_bbox})
print(json.dumps(results))`;
  const result = spawnSync("python", ["-c", probe, JSON.stringify(specs), projectRoot], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function inspectMineStateInvariants() {
  const probe = String.raw`
import json, sys
from pathlib import Path
from PIL import Image

root = Path(sys.argv[1]); results=[]
for theme in ("descent", "corruption", "abyss"):
    with Image.open(root / f"assets/hd/hazards/{theme}/mine-unarmed.png") as source:
        unarmed = source.convert("RGBA")
    with Image.open(root / f"assets/hd/hazards/{theme}/mine-armed.png") as source:
        armed = source.convert("RGBA")
    inside_changes=outside_changes=unarmed_center_alpha=accent_gain=0
    for y in range(64):
        for x in range(64):
            before=unarmed.getpixel((x,y)); after=armed.getpixel((x,y))
            inside=(x-32)**2+(y-31)**2<=11**2
            if before != after:
                if inside: inside_changes += 1
                else: outside_changes += 1
            if inside and before[3] >= 64: unarmed_center_alpha += 1
            if inside:
                channel={"descent":0,"corruption":1,"abyss":2}[theme]
                accent_gain += max(0, after[channel]-before[channel])
    results.append({
        "theme":theme, "sizes":[unarmed.size,armed.size],
        "bounds":[unarmed.getchannel("A").getbbox(),armed.getchannel("A").getbbox()],
        "alphaEqual":unarmed.getchannel("A").tobytes()==armed.getchannel("A").tobytes(),
        "insideChanges":inside_changes,"outsideChanges":outside_changes,
        "unarmedCenterAlpha":unarmed_center_alpha,"accentGain":accent_gain,
    })
print(json.dumps(results))`;
  const result = spawnSync("python", ["-c", probe, projectRoot], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("Descent manifest covers the required environment kit and classifications", () => {
  const issues = [];

  for (const expected of FINAL_ASSETS) {
    const actual = manifestApi.entries.find((entry) => entry.key === expected.key);
    if (!actual) {
      issues.push(`missing manifest key ${expected.key}`);
      continue;
    }
    for (const field of ["src", "group", "critical"]) {
      if (actual[field] !== expected[field]) {
        issues.push(`${expected.key} ${field}: expected ${expected[field]}, received ${actual[field]}`);
      }
    }
  }

  assert.deepEqual(issues, []);
});

test("HD manifest includes every themed standard chest", () => {
  for (const expected of CHEST_ASSETS) {
    const actual = manifestApi.entries.find((entry) => entry.key === expected.key);
    assert.deepEqual(
      actual && { key: actual.key, src: actual.src, group: actual.group, critical: actual.critical },
      { key: expected.key, src: expected.src, group: expected.group, critical: expected.critical }
    );
    const filePath = path.join(projectRoot, ...expected.src.split("/"));
    const metadata = inspectPng(filePath);
    assert.equal(metadata.width, 64, expected.src);
    assert.equal(metadata.height, 64, expected.src);
    assert.equal(metadata.colorType, 6, `${expected.src} must retain alpha`);
  }
});

test("common portal keeps a byte-identical shell while only its inner swirl animates", () => {
  const [portal] = inspectAnimationInvariants([{
    name: "common-portal",
    frames: [
      "assets/hd/objects/common/portal-active-01.png",
      "assets/hd/objects/common/portal-active-02.png",
      "assets/hd/objects/common/portal-active-03.png"
    ],
    motion: [["ellipse", 64, 61, 36, 35]]
  }]);
  assert.deepEqual(portal.outside, [0, 0], "the common portal frame must not move or morph");
  assert.equal(new Set(portal.bounds.map(JSON.stringify)).size, 1, "portal alpha bounds must stay fixed");
});

test("common active portal ships one complete static frame and eight swirl-only layers", () => {
  const framePath = path.join(projectRoot, "assets", "hd", "objects", "common", "portal-frame.png");
  const swirlPaths = Array.from({ length: 8 }, (_, index) =>
    path.join(projectRoot, "assets", "hd", "objects", "common", `portal-swirl-${String(index + 1).padStart(2, "0")}.png`));
  const probe = String.raw`
import json, sys
from PIL import Image, ImageChops
frame_path,*swirl_paths=sys.argv[1:]
with Image.open(frame_path) as source: frame=source.convert("RGBA")
swirls=[]
for raw in swirl_paths:
    with Image.open(raw) as source: swirls.append(source.convert("RGBA"))
bottom_visible=sum(1 for y in range(104,128) for x in range(128) if frame.getpixel((x,y))[3] > 16)
bounds=[image.getchannel("A").getbbox() for image in swirls]
centroids=[]
for image in swirls:
    weights=list(image.getchannel("A").get_flattened_data()); total=sum(weights)
    centroids.append((sum((index%128)*value for index,value in enumerate(weights))/total,
                      sum((index//128)*value for index,value in enumerate(weights))/total))
outside=[]
for image in swirls:
    outside.append(sum(1 for y in range(128) for x in range(128)
                       if (((x-64)/35)**2+((y-61)/34)**2 > 1) and image.getpixel((x,y))[3] > 0))
diffs=[ImageChops.difference(swirls[0].convert("RGB"), image.convert("RGB")).getbbox() is not None for image in swirls[1:]]
print(json.dumps({"frameBounds":frame.getchannel("A").getbbox(),"bottomVisible":bottom_visible,
                  "swirlBounds":bounds,"outside":outside,"diffs":diffs,
                  "jitter":[max(p[0] for p in centroids)-min(p[0] for p in centroids),
                            max(p[1] for p in centroids)-min(p[1] for p in centroids)]}))`;
  const result = spawnSync("python", ["-c", probe, framePath, ...swirlPaths], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const metrics = JSON.parse(result.stdout);
  assert.ok(metrics.frameBounds[3] >= 122, "the complete frame must retain its full lower structure");
  assert.ok(metrics.bottomVisible >= 350, "the lower portal frame/platform must not be cut away");
  assert.equal(new Set(metrics.swirlBounds.map(JSON.stringify)).size, 1, "every swirl phase must keep identical bounds");
  assert.deepEqual(metrics.outside, Array(8).fill(0), "swirl layers must contain no frame pixels");
  assert.ok(metrics.diffs.every(Boolean), "every swirl phase must advance the same texture");
  assert.ok(Math.max(...metrics.jitter) <= 0.5, `common portal swirl may not orbit (${metrics.jitter})`);
});

test("common technical torch assets render a grounded brazier with a fixed base", () => {
  const [brazier] = inspectAnimationInvariants([{
    name: "common-brazier",
    frames: [
      "assets/hd/objects/common/torch-unlit.png",
      "assets/hd/objects/common/torch-lit-01.png",
      "assets/hd/objects/common/torch-lit-02.png",
      "assets/hd/objects/common/torch-lit-03.png"
    ],
    motion: [["ellipse", 32, 22, 15, 21]],
    baseTop: 35
  }]);
  assert.deepEqual(brazier.lowerDiffs, [false, false, false], "brazier bowl and base must be immutable");
  const [left, top, right, bottom] = brazier.visibleBbox;
  assert.ok(right - left >= 32, "a brazier must have a broad floor-standing silhouette");
  assert.ok(bottom - top <= 54, "a brazier must not retain a tall wall-torch silhouette");
  assert.ok(bottom >= 60, "the brazier must remain bottom anchored");
});
test("HD manifest keys and assets/hd paths remain unique and safe", () => {
  assert.equal(manifestApi.validateManifest(manifestApi.entries), true);
  assert.equal(manifestApi.validateManifest(manifestApi.stagedEntries), true);
  const catalog = [...manifestApi.entries, ...manifestApi.stagedEntries];
  const keys = catalog.map((entry) => entry.key);
  const sources = catalog.map((entry) => entry.src);

  assert.equal(new Set(keys).size, keys.length, "manifest semantic keys must be unique");
  assert.equal(new Set(sources).size, sources.length, "manifest source paths must be unique");
  for (const src of sources) {
    assert.match(src, /^assets\/hd\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.png$/);
    assert.doesNotMatch(src, /\\|\.\.|\/\//);
  }
});

test("required shipping Descent assets preload while future semantic keys remain discoverable", () => {
  assert.ok(manifestApi.entries.length >= FINAL_ASSETS.length);
  assert.ok(Array.isArray(manifestApi.stagedEntries));
  assert.ok(manifestApi.stagedEntries.length > 0);
  assert.ok(manifestApi.stagedEntries.every((entry) => entry.critical === false));
  assert.ok(manifestApi.stagedEntries.every((entry) => !manifestApi.entries.includes(entry)));
  assert.equal(manifestApi.getByKey("actor.player.south.idle").group, "player");
  assert.ok(Array.isArray(manifestApi.selectGroup("player")), "future active player art is permitted");
});

test("Descent final PNGs have the required signatures, dimensions, and alpha channels", () => {
  const issues = [];

  for (const expected of FINAL_ASSETS) {
    const filePath = path.join(projectRoot, ...expected.src.split("/"));
    if (!fs.existsSync(filePath)) {
      issues.push(`missing ${expected.src}`);
      continue;
    }

    try {
      const png = inspectPng(filePath);
      if (png.width !== expected.width || png.height !== expected.height) {
        issues.push(
          `${expected.src} dimensions: expected ${expected.width}x${expected.height}, ` +
          `received ${png.width}x${png.height}`
        );
      }
      if (expected.width % 64 !== 0 || expected.height % 64 !== 0) {
        issues.push(`${expected.src} expected dimensions must be exact 64 px tile multiples`);
      }
      if (expected.alpha && png.colorType !== 4 && png.colorType !== 6) {
        issues.push(`${expected.src} must encode an alpha channel (PNG color type 4 or 6)`);
      }
    } catch (error) {
      issues.push(error.message);
    }
  }

  assert.deepEqual(issues, []);
});

test("every final alpha PNG contains zero nontransparent exact #ff00ff pixels", () => {
  const metrics = inspectAlphaAssets();
  const violations = metrics.filter((metric) => metric.exactCount > 0);

  assert.deepEqual(
    violations,
    [],
    `exact chroma pixels remain:\n${formatChromaViolations(metrics, "exactCount", "exactMaxAlpha")}`
  );
});

test("every final alpha PNG contains zero visible near-key magenta fringe pixels", () => {
  const metrics = inspectAlphaAssets();
  const violations = metrics.filter((metric) => metric.nearCount > 0);

  assert.deepEqual(
    violations,
    [],
    `near-key fringe remains:\n${formatChromaViolations(metrics, "nearCount", "nearMaxAlpha")}`
  );
});

test("strict chroma cleanup preserves transparent corners, alpha coverage, and intended magic", () => {
  const metrics = inspectAlphaAssets();
  const nonWall = metrics.filter((metric) => !metric.asset.key.startsWith("environment.descent.wall."));
  const magic = metrics.filter((metric) => /(?:shrine|portal)-/.test(path.basename(metric.asset.src)));

  for (const metric of metrics) {
    assert.ok(
      metric.visible >= metric.width * metric.height * 0.15,
      `${metric.asset.src} lost meaningful alpha coverage (${metric.visible} visible pixels)`
    );
  }
  for (const metric of nonWall) {
    assert.deepEqual(metric.corners, [0, 0, 0, 0], `${metric.asset.src} must retain transparent corners`);
  }
  for (const metric of magic) {
    const basename = path.basename(metric.asset.src);
    const inactiveShrine = basename === "shrine-inactive.png";
    const inactivePortal = basename === "portal-inactive.png" || basename === "portal-frame.png";
    const minimumViolet = inactiveShrine ? 0 : inactivePortal ? 125 : basename.startsWith("shrine-") ? 200 : 250;
    assert.ok(metric.violet >= minimumViolet, `${metric.asset.src} lost intended non-key violet magic`);
    const minimumUnique = inactiveShrine || inactivePortal ? 2000 : /portal-swirl-/.test(basename) ? 750 : 3000;
    assert.ok(metric.uniqueVisible >= minimumUnique, `${metric.asset.src} lost visual entropy`);
  }
  assert.ok(
    magic.reduce((total, metric) => total + metric.turquoise, 0) >= 400,
    "shrine/portal kit lost intended turquoise magic"
  );
});

test("biome mine states keep one closed housing and energize only the central shutter", () => {
  const mines = inspectMineStateInvariants();
  assert.deepEqual(mines.map((mine) => mine.theme), ["descent", "corruption", "abyss"]);
  for (const mine of mines) {
    assert.deepEqual(mine.sizes, [[64, 64], [64, 64]]);
    assert.deepEqual(mine.bounds[0], mine.bounds[1], `${mine.theme} anchor`);
    assert.equal(mine.alphaEqual, true, `${mine.theme} silhouette`);
    assert.equal(mine.outsideChanges, 0, `${mine.theme} static housing`);
    assert.ok(mine.insideChanges >= 100, `${mine.theme} energized shutter`);
    assert.ok(mine.unarmedCenterAlpha >= 250, `${mine.theme} dormant shutter must stay visibly closed`);
    assert.ok(mine.accentGain >= 1000, `${mine.theme} active accent`);
  }
});

test("the rebuild validator enforces the exact same strict chroma policy", () => {
  const scriptPath = path.join(projectRoot, "scripts", "build-descent-environment-assets.py");
  const policyProbe = String.raw`
import runpy
import sys
from pathlib import Path
from PIL import Image

namespace = runpy.run_path(sys.argv[1])
validate = namespace.get("validate_chroma_policy")
assert callable(validate), "builder must expose validate_chroma_policy"

clean = Image.new("RGBA", (4, 4), (0, 0, 0, 0))
clean.putpixel((1, 1), (120, 30, 210, 128))
clean.putpixel((2, 1), (20, 180, 210, 128))
validate(clean, Path("clean-intended-magic.png"))

def expect_rejection(pixel, message):
    image = Image.new("RGBA", (4, 4), (0, 0, 0, 0))
    image.putpixel((1, 1), pixel)
    try:
        validate(image, Path(message + ".png"))
    except ValueError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError("validator accepted " + message)

expect_rejection((255, 0, 255, 1), "exact chroma")
expect_rejection((240, 10, 245, 105), "near-key fringe")
print("strict chroma policy enforced")
`;
  const probe = spawnSync("python", ["-c", policyProbe, scriptPath], {
    cwd: projectRoot,
    encoding: "utf8"
  });

  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
  assert.match(probe.stdout, /strict chroma policy enforced/);
});

test("asset build preserves the generated source and normalizes one exact 1024 px atlas", () => {
  const sourceRoot = path.join(projectRoot, "art", "source", "abyssal-gothic-hd");
  const originalPath = path.join(sourceRoot, "descent-environment-source-original-1254.png");
  const normalizedPath = path.join(sourceRoot, "descent-environment-source-1024.png");
  const scriptPath = path.join(projectRoot, "scripts", "build-descent-environment-assets.py");

  assert.equal(fs.existsSync(scriptPath), true, "the reproducible Pillow build script must exist");
  assert.equal(fs.existsSync(originalPath), true, "the untouched 1254 px ImageGen output must be retained");
  const original = fs.readFileSync(originalPath);
  assert.equal(crypto.createHash("sha256").update(original).digest("hex"), ORIGINAL_SOURCE_SHA256);
  assert.deepEqual(inspectPng(originalPath), {
    width: 1254,
    height: 1254,
    bitDepth: 8,
    colorType: 2
  });
  assert.deepEqual(inspectPng(normalizedPath), {
    width: 1024,
    height: 1024,
    bitDepth: 8,
    colorType: 2
  });
  assert.match(fs.readFileSync(path.join(projectRoot, ".gitignore"), "utf8"), /^art\/work\/$/m);
});

test("asset build pins Pillow, helper identity, and every generated artifact in a deterministic lock", () => {
  const requirementsPath = path.join(projectRoot, "requirements-hd-assets.txt");
  assert.equal(fs.readFileSync(requirementsPath, "utf8").trim(), "Pillow==12.1.1");
  assert.equal(fs.existsSync(LOCK_PATH), true, "the committed artifact lock must exist");

  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  assert.equal(lock.pipelineSchema, 2);
  assert.equal(lock.pillowVersion, "12.1.1");
  assert.equal(lock.helper.sha256, EXPECTED_HELPER_SHA256);
  assert.equal(lock.source.sha256, ORIGINAL_SOURCE_SHA256);
  assert.match(lock.portalSource.sha256, /^[a-f0-9]{64}$/);
  assert.equal(lock.normalizedAtlas.path, "art/source/abyssal-gothic-hd/descent-environment-source-1024.png");
  assert.match(lock.normalizedAtlas.sha256, /^[a-f0-9]{64}$/);
  assert.equal(lock.normalizedPortalSource.path, "art/source/abyssal-gothic-hd/common-portal-source-1024.png");
  assert.match(lock.normalizedPortalSource.sha256, /^[a-f0-9]{64}$/);
  assert.equal(lock.hazardSpikesSource.sha256, "792cd2cbdc4a705d36c433f091e274663d4b103576d1ca3078a086b48635c29b");
  assert.equal(lock.hazardMineSource.sha256, "064236cc6c46eef1b4c008e01dcbc33543c68b7a4cdecd905c20b800606fcaaa");
  assert.match(lock.normalizedHazardSpikesSource.sha256, /^[a-f0-9]{64}$/);
  assert.match(lock.normalizedHazardMineSource.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(lock.assets).sort(), FINAL_ASSETS.map((asset) => asset.src).sort());
  for (const asset of FINAL_ASSETS) {
    const bytes = fs.readFileSync(path.join(projectRoot, ...asset.src.split("/")));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), lock.assets[asset.src], asset.src);
  }
});

test("a full isolated locked rebuild verifies without publishing", () => {
  const scriptPath = path.join(projectRoot, "scripts", "build-descent-environment-assets.py");
  const before = FINAL_ASSETS.map((asset) => {
    const bytes = fs.readFileSync(path.join(projectRoot, ...asset.src.split("/")));
    return crypto.createHash("sha256").update(bytes).digest("hex");
  });
  const result = spawnSync("python", [scriptPath, "--check"], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Lock verification passed/);
  const after = FINAL_ASSETS.map((asset) => {
    const bytes = fs.readFileSync(path.join(projectRoot, ...asset.src.split("/")));
    return crypto.createHash("sha256").update(bytes).digest("hex");
  });
  assert.deepEqual(after, before, "--check must never publish staged outputs");
  assert.equal(fs.existsSync(path.join(projectRoot, "art", "work", "descent-environment")), false);
});

test("late publish failure rolls back all 29 targets and removes the transaction tree", () => {
  const scriptPath = path.join(projectRoot, "scripts", "build-descent-environment-assets.py");
  const probe = String.raw`
import runpy
import tempfile
from pathlib import Path

namespace = runpy.run_path(__import__('sys').argv[1])
publish = namespace.get('publish_transaction')
assert callable(publish), 'builder must expose publish_transaction'

with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    work = root / 'art' / 'work' / 'transaction'
    staged = work / 'staged'
    targets = root / 'targets'
    staged.mkdir(parents=True)
    targets.mkdir()
    pairs = []
    old = {}
    for index in range(29):
        source = staged / f'staged-{index:02d}.bin'
        target = targets / f'target-{index:02d}.bin'
        source.write_bytes(f'new-{index}'.encode())
        if index != 5:
            target.write_bytes(f'old-{index}'.encode())
            old[target] = target.read_bytes()
        pairs.append((source, target))

    calls = 0
    def fail_late(source, target):
        global calls
        calls += 1
        if calls == 28:
            raise OSError('injected late publish failure')
        source.replace(target)

    try:
        publish(pairs, work, replace_fn=fail_late)
    except OSError as error:
        assert 'injected late publish failure' in str(error)
    else:
        raise AssertionError('late publish failure did not propagate')

    assert not work.exists(), 'transaction tree survived rollback'
    for target, expected in old.items():
        assert target.read_bytes() == expected, target
    assert not (targets / 'target-05.bin').exists(), 'new target survived rollback'
print('rollback preserved all targets')
`;
  const result = spawnSync("python", ["-c", probe, scriptPath], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /rollback preserved all targets/);
});

test("helper failures report slot, helper, return code, stdout, and stderr", () => {
  const scriptPath = path.join(projectRoot, "scripts", "build-descent-environment-assets.py");
  const probe = String.raw`
import runpy
import subprocess
import sys
from pathlib import Path

namespace = runpy.run_path(sys.argv[1])
run_helper = namespace.get('run_chroma_helper')
assert callable(run_helper), 'builder must expose run_chroma_helper'
slot = Path('slots/slot-16.png')
helper = Path('tools/remove_chroma_key.py')

def fail(*args, **kwargs):
    raise subprocess.CalledProcessError(7, args[0], output='captured stdout', stderr='captured stderr')

try:
    run_helper(slot, Path('keyed/slot-16.png'), helper, run_fn=fail)
except RuntimeError as error:
    message = str(error)
    for expected in (str(slot), str(helper), 'return code 7', 'captured stdout', 'captured stderr'):
        assert expected in message, message
else:
    raise AssertionError('helper failure did not propagate diagnostically')
print('helper diagnostics complete')
`;
  const result = spawnSync("python", ["-c", probe, scriptPath], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /helper diagnostics complete/);
});

test("floor layer covers the 9x9 board and maps every wall edge and corner explicitly", () => {
  const keys = FINAL_ASSETS.filter((asset) => asset.critical).map((asset) => asset.key);
  const assets = fakeAssets(keys);
  const context = drawingContext();
  const snapshot = Object.freeze({ depth: 3, nowMs: 0 });

  layersApi.drawFloorLayer(context, snapshot, assets);

  const floorCalls = context.calls.filter((call) => call.key === "environment.descent.floor.base");
  assert.equal(floorCalls.length, 81);
  assert.deepEqual(floorCalls[0], {
    key: "environment.descent.floor.base", x: 0, y: 0, width: 64, height: 64
  });
  assert.deepEqual(floorCalls.at(-1), {
    key: "environment.descent.floor.base", x: 512, y: 512, width: 64, height: 64
  });

  const borderCalls = context.calls.filter((call) => call.key !== "environment.descent.floor.base");
  assert.equal(borderCalls.length, 32);
  assert.ok(borderCalls.some((call) => call.key === "environment.descent.corner.northwest" && call.x === 0 && call.y === 0));
  assert.ok(borderCalls.some((call) => call.key === "environment.descent.corner.southeast" && call.x === 512 && call.y === 512));
  assert.ok(borderCalls.some((call) => call.key === "environment.descent.wall.north" && call.x === 64 && call.y === 0));
  assert.ok(borderCalls.some((call) => call.key === "environment.descent.wall.south" && call.x === 64 && call.y === 512));
  assert.ok(borderCalls.some((call) => call.key === "environment.descent.wall.west" && call.x === 0 && call.y === 64));
  assert.ok(borderCalls.some((call) => call.key === "environment.descent.wall.east" && call.x === 512 && call.y === 64));
});

test("decoration selection is deterministic, depth-aware, visual-only, and never consumes Math.random", () => {
  const keys = [
    "environment.descent.decal.crack",
    "environment.descent.grate.base",
    "environment.descent.rubble.base",
    "environment.descent.decal.stain01",
    "environment.descent.decal.stain02",
    "environment.descent.decal.stain03"
  ];
  const assets = fakeAssets(keys);
  const snapshot = { depth: 4, nowMs: 640, roomType: "combat" };
  const before = JSON.stringify(snapshot);
  const first = drawingContext();
  const second = drawingContext();
  const deeper = drawingContext();
  const originalRandom = Math.random;

  Math.random = () => {
    throw new Error("visual decoration must not consume gameplay RNG");
  };
  try {
    layersApi.drawDecalsLayer(first, snapshot, assets);
    layersApi.drawDecalsLayer(second, snapshot, assets);
    layersApi.drawDecalsLayer(deeper, { ...snapshot, depth: 5 }, assets);
  } finally {
    Math.random = originalRandom;
  }

  assert.deepEqual(first.calls, second.calls);
  assert.notDeepEqual(first.calls, deeper.calls);
  assert.ok(first.calls.length > 0 && first.calls.length <= 6, "dressing remains low-frequency");
  assert.equal(JSON.stringify(snapshot), before, "drawing cannot mutate the snapshot");
});

test("hazard and object layers select state frames and preserve logical anchors", () => {
  const keys = [...FINAL_ASSETS, ...CHEST_ASSETS].filter((asset) => !asset.critical).map((asset) => asset.key);
  const assets = fakeAssets(keys);
  const floorPattern = Array.from({ length: 9 }, () => Array(9).fill(0));
  floorPattern[2][2] = 3;
  const snapshot = {
    phase: "playing",
    roomCleared: true,
    nowMs: 320,
    floorPattern,
    spikes: [{ x: 1, y: 2, active: true }],
    mines: [
      { x: 2, y: 3, armed: true, fuseTurns: 2 },
      { x: 3, y: 4, armed: false, fuseTurns: 0 }
    ],
    chests: [{ id: "normal", type: "normal", x: 3, y: 3, opened: false }],
    shrine: { x: 4, y: 4, used: false },
    portal: { x: 5, y: 5, active: true }
  };
  const before = JSON.stringify(snapshot);
  const hazards = drawingContext();
  const objects = drawingContext();

  layersApi.drawHazardsLayer(hazards, snapshot, assets);
  layersApi.drawObjectsLayer(objects, snapshot, assets);

  assert.deepEqual(hazards.calls, [
    { key: "hazard.descent.spikes.armed", x: 68, y: 132, width: 56, height: 56 },
    { key: "hazard.descent.mine.unarmed", x: 137, y: 201, width: 46, height: 46 },
    { key: "hazard.descent.mine.armed", x: 201, y: 265, width: 46, height: 46 }
  ]);
  assert.ok(objects.calls.some((call) => call.key === "object.common.torch.lit03" && call.x === 128 && call.y === 128));
  assert.ok(objects.calls.some((call) =>
    call.key === "object.chest.descent"
    && call.x === 201.6
    && call.y === 211.2
    && call.width === 44.8
    && call.height === 44.8));
  assert.ok(objects.calls.some((call) => call.key === "object.common.shrine.active" && call.x === 224 && call.y === 192 && call.width === 128));
  assert.ok(objects.calls.some((call) => call.key === "object.common.portal.frame" && call.x === 304 && call.y === 288 && call.height === 96));
  assert.ok(objects.calls.some((call) => call.key === "object.common.portal.swirl05" && call.x === 304 && call.y === 288 && call.height === 96));
  assert.equal(JSON.stringify(snapshot), before);
});

test("inactive mines blink continuously while active mines blink twice as fast", () => {
  const assets = fakeAssets([
    "hazard.descent.mine.unarmed",
    "hazard.descent.mine.armed"
  ]);
  const drawMineAt = (nowMs, armed) => {
    const context = drawingContext();
    layersApi.drawHazardsLayer(context, {
      depth: 0,
      nowMs,
      mines: [{ x: 3, y: 3, armed }]
    }, assets);
    return context.calls[0]?.key;
  };

  assert.equal(drawMineAt(0, false), "hazard.descent.mine.unarmed");
  assert.equal(drawMineAt(140, false), "hazard.descent.mine.unarmed");
  assert.equal(drawMineAt(280, false), "hazard.descent.mine.armed");
  assert.equal(drawMineAt(0, true), "hazard.descent.mine.unarmed");
  assert.equal(drawMineAt(140, true), "hazard.descent.mine.armed");
  assert.equal(drawMineAt(280, true), "hazard.descent.mine.unarmed");
});

test("standard chest art follows biome and special-room themes", () => {
  const keys = ["descent", "corruption", "abyss", "forge", "pact", "vault", "otter"]
    .map((variant) => `object.chest.${variant}`);
  const assets = fakeAssets(keys);
  const cases = [
    [{ depth: 0, roomType: "combat" }, "object.chest.descent"],
    [{ depth: 20, roomType: "treasure" }, "object.chest.corruption"],
    [{ depth: 40, roomType: "cursed" }, "object.chest.abyss"],
    ...["forge", "pact", "vault", "otter"].map((roomType) => [
      { depth: 0, roomType },
      `object.chest.${roomType}`
    ])
  ];

  for (const [snapshot, expectedKey] of cases) {
    const context = drawingContext();
    layersApi.drawObjectsLayer(context, {
      ...snapshot,
      chests: [{ type: "normal", x: 3, y: 3, opened: false }]
    }, assets);
    assert.ok(context.calls.some((call) =>
      call.key === expectedKey && call.width === 44.8 && call.height === 44.8), expectedKey);
  }
});

test("inactive object states and missing optional assets are handled without throwing", () => {
  const assets = fakeAssets([
    "object.common.torch.unlit",
    "object.common.shrine.inactive",
    "object.common.portal.inactive"
  ]);
  const floorPattern = Array.from({ length: 9 }, () => Array(9).fill(0));
  floorPattern[1][1] = 3;
  const context = drawingContext();
  const snapshot = {
    phase: "camp",
    roomCleared: true,
    nowMs: 0,
    floorPattern,
    spikes: [{ x: 1, y: 1, active: false }],
    mines: [{ x: 2, y: 2, armed: false }],
    chests: [{ x: 3, y: 3, opened: false }],
    shrine: { x: 4, y: 4, used: true },
    portal: { x: 5, y: 5, active: false }
  };

  assert.doesNotThrow(() => layersApi.drawFloorLayer(context, snapshot, new Map()));
  assert.doesNotThrow(() => layersApi.drawDecalsLayer(context, snapshot, new Map()));
  assert.doesNotThrow(() => layersApi.drawHazardsLayer(context, snapshot, new Map()));
  assert.doesNotThrow(() => layersApi.drawObjectsLayer(context, snapshot, assets));
  assert.ok(context.calls.some((call) => call.key === "object.common.torch.unlit"));
  assert.ok(context.calls.some((call) => call.key === "object.common.shrine.inactive"));
  assert.ok(context.calls.some((call) => call.key === "object.common.portal.inactive"));
});

test("normal portals stay hidden until room clearance, then animate through the visual snapshot boundary", () => {
  const assets = fakeAssets(["object.common.portal.frame", "object.common.portal.swirl03"]);
  const uncleared = drawingContext();
  const cleared = drawingContext();

  layersApi.drawObjectsLayer(uncleared, visualSnapshotApi.createVisualSnapshot({
    phase: "playing",
    roomCleared: false,
    portal: { x: 3, y: 4 }
  }, 160), assets);
  layersApi.drawObjectsLayer(cleared, visualSnapshotApi.createVisualSnapshot({
    phase: "playing",
    roomCleared: true,
    portal: { x: 3, y: 4, active: false }
  }, 160), assets);

  assert.deepEqual(uncleared.calls, []);
  assert.deepEqual(cleared.calls, [
    { key: "object.common.portal.frame", x: 176, y: 224, width: 96, height: 96 },
    { key: "object.common.portal.swirl03", x: 176, y: 224, width: 96, height: 96 }
  ]);
});

test("temporary code-native actor silhouettes keep the HD slice playable without sprite placeholders", () => {
  const context = drawingContext();
  const snapshot = {
    player: { x: 4, y: 4, hp: 10, maxHp: 10 },
    enemies: [{ id: "diagnostic-enemy", x: 2, y: 3, hp: 5, maxHp: 5 }]
  };
  const before = JSON.stringify(snapshot);

  layersApi.drawEnemiesLayer(context, snapshot, new Map());
  layersApi.drawPlayerLayer(context, snapshot, new Map());

  assert.equal(context.fills.length, 4, "each actor gets one shadow and one restrained silhouette");
  assert.ok(context.fills.some((fill) => fill.fillStyle === "#d8c7ff" && fill.x >= 256 && fill.x < 320));
  assert.ok(context.fills.some((fill) => fill.fillStyle === "#b84b52" && fill.x >= 128 && fill.x < 192));
  assert.equal(JSON.stringify(snapshot), before);
  assert.strictEqual(layersApi.DEFAULT_LAYERS.player, layersApi.drawPlayerLayer);
  assert.strictEqual(layersApi.DEFAULT_LAYERS.enemies, layersApi.drawEnemiesLayer);
});
