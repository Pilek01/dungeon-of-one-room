const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, "render", "hd-asset-manifest.js");
const loaderPath = path.join(projectRoot, "render", "hd-asset-loader.js");
const manifestApi = require(manifestPath);
const loaderApi = require(loaderPath);

const REQUIRED_KEYS = [
  "environment.descent.floor.base",
  "environment.corruption.wall.north",
  "actor.player.south.idle",
  "enemy.slime.south.move.01",
  "boss.warden.phase2.idle",
  "object.shrine.active",
  "hazard.mine.armed",
  "fx.shockwave.base"
];

function entry(key, overrides = {}) {
  return {
    key,
    src: `assets/hd/${key.replaceAll(".", "/")}.png`,
    group: "test",
    critical: false,
    ...overrides
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createImageFactory(behaviors, created = []) {
  let index = 0;
  return function imageFactory() {
    const behavior = behaviors[index++];
    assert.ok(behavior, "test image behavior is configured");
    const image = { onload: null, onerror: null, assignedSrc: null };

    if (behavior.decode) {
      image.decode = behavior.decode;
    }
    Object.defineProperty(image, "src", {
      configurable: true,
      get() {
        return image.assignedSrc;
      },
      set(value) {
        image.assignedSrc = value;
        if (behavior.onSrc) behavior.onSrc(image, value);
      }
    });
    created.push(image);
    return image;
  };
}

test("manifest exposes planned assets through stable semantic keys and groups", () => {
  assert.equal(manifestApi.validateManifest(manifestApi.entries), true);

  for (const key of REQUIRED_KEYS) {
    const asset = manifestApi.getByKey(key);
    assert.equal(asset.key, key);
    assert.match(asset.src, /^assets\/hd\//);
    assert.equal(typeof asset.group, "string");
    assert.equal(typeof asset.critical, "boolean");
  }

  const environment = manifestApi.selectGroup("environment");
  assert.ok(environment.length >= 2);
  assert.ok(environment.every((asset) => asset.group === "environment"));
  assert.strictEqual(manifestApi.getByKey("missing.asset.key"), undefined);
});

test("manifest validation rejects duplicate, malformed, unsafe, and audio entries", () => {
  const valid = entry("object.decal.crack", { group: "objects" });

  assert.throws(() => manifestApi.validateManifest([valid, { ...valid }]), /duplicate/i);
  assert.throws(
    () => manifestApi.validateManifest([entry("Object Raw Filename.png")]),
    /key/i
  );
  assert.throws(
    () => manifestApi.validateManifest([entry("object.decal.crack", { src: "assets/hd/../secret.png" })]),
    /path|src/i
  );
  assert.throws(
    () => manifestApi.validateManifest([entry("object.decal.crack", { src: "/assets/hd/crack.png" })]),
    /path|src/i
  );
  assert.throws(
    () => manifestApi.validateManifest([entry("audio.music.boss", { src: "assets/hd/audio/boss.mp3" })]),
    /audio|image|extension/i
  );
  assert.throws(
    () => manifestApi.validateManifest([entry("fx.music.boss", { group: "audio" })]),
    /audio/i
  );
  assert.throws(
    () => manifestApi.validateManifest([entry("fx.music.boss", { src: "assets/hd/audio/boss.png" })]),
    /audio/i
  );
});

test("loads a selected group asynchronously into a Map without loading other groups", async () => {
  const assets = [
    entry("object.shrine.active", { group: "objects" }),
    entry("hazard.mine.armed", { group: "hazards" })
  ];
  const created = [];
  const imageFactory = createImageFactory([{
    onSrc(image) {
      queueMicrotask(() => image.onload());
    }
  }], created);

  const resultPromise = loaderApi.loadGroup("objects", {
    manifest: assets,
    imageFactory,
    timeoutMs: 100
  });
  assert.ok(resultPromise instanceof Promise);
  const result = await resultPromise;

  assert.equal(result.ready, true);
  assert.equal(result.fallbackRequired, false);
  assert.ok(result.loaded instanceof Map);
  assert.deepEqual([...result.loaded.keys()], ["object.shrine.active"]);
  assert.strictEqual(result.loaded.get("object.shrine.active"), created[0]);
  assert.deepEqual(result.failures, []);
});

test("bounds browser image decoding concurrency for production-sized manifests", async () => {
  const manifest = Array.from({ length: 24 }, (_unused, index) => entry(`enemy.slime.south.idle.${String(index + 1).padStart(2, "0")}`, { critical: true }));
  let active = 0;
  let maximum = 0;
  const releases = [];
  const loading = loaderApi.loadAssets(manifest, {
    timeoutMs: 15000,
    setTimeoutFn() { return 1; },
    clearTimeoutFn() {},
    imageFactory() {
      return {
        onload: null,
        onerror: null,
        set src(_value) {},
        decode() {
          active += 1;
          maximum = Math.max(maximum, active);
          return new Promise((resolve) => releases.push(() => { active -= 1; resolve(); }));
        }
      };
    }
  });
  await Promise.resolve();
  assert.equal(maximum, 8, "default loader concurrency must be capped at eight images");
  while (releases.length > 0 || active > 0) {
    const batch = releases.splice(0);
    batch.forEach((release) => release());
    await new Promise((resolve) => setImmediate(resolve));
  }
  const result = await loading;
  assert.equal(result.ready, true);
  assert.equal(result.loaded.size, 24);
  assert.ok(maximum <= 8);
});

test("reports monotonic progress ending at complete even when assets fail", async () => {
  const assets = [
    entry("object.shrine.active"),
    entry("hazard.mine.armed"),
    entry("fx.shockwave.base")
  ];
  const first = deferred();
  const second = deferred();
  const third = deferred();
  const progress = [];
  const promise = loaderApi.loadAssets(assets, {
    imageFactory: createImageFactory([
      { decode: () => first.promise },
      { decode: () => second.promise },
      { decode: () => third.promise }
    ]),
    timeoutMs: 1000,
    onProgress(update) {
      progress.push(update);
    }
  });

  second.reject(new Error("optional missing"));
  await Promise.resolve();
  third.resolve();
  await Promise.resolve();
  first.resolve();
  const result = await promise;

  assert.equal(result.failures.length, 1);
  assert.deepEqual(progress.map((update) => update.completed), [0, 1, 2, 3]);
  assert.deepEqual(progress.map((update) => update.ratio), [0, 1 / 3, 2 / 3, 1]);
  assert.ok(progress.every((update, index) => index === 0 || update.ratio >= progress[index - 1].ratio));
  assert.ok(progress.slice(0, -1).every((update) => update.complete === false));
  assert.equal(progress.at(-1).complete, true);
  assert.equal(progress.at(-1).total, 3);
});

test("optional failure is recorded while the critical-ready contract remains satisfied", async () => {
  const optional = entry("object.decal.crack");
  const result = await loaderApi.loadAssets([optional], {
    imageFactory: createImageFactory([{
      onSrc(image) {
        queueMicrotask(() => image.onerror(new Error("missing")));
      }
    }]),
    timeoutMs: 100
  });

  assert.equal(result.ready, true);
  assert.equal(result.fallbackRequired, false);
  assert.deepEqual([...result.loaded], []);
  assert.deepEqual(result.failures.map((failure) => failure.key), [optional.key]);
  assert.equal(result.failures[0].reason, "error");
});

test("critical player or environment failure requires the legacy fallback", async () => {
  for (const asset of [
    entry("actor.player.south.idle", { group: "player", critical: true }),
    entry("environment.descent.floor.base", { group: "environment", critical: true })
  ]) {
    const result = await loaderApi.loadAssets([asset], {
      imageFactory: createImageFactory([{
        onSrc(image) {
          queueMicrotask(() => image.onerror(new Error("critical missing")));
        }
      }]),
      timeoutMs: 100
    });

    assert.equal(result.ready, false, `${asset.key} must prevent HD readiness`);
    assert.equal(result.fallbackRequired, true, `${asset.key} must request legacy fallback`);
    assert.equal(result.failures[0].critical, true);
  }
});

test("records multiple failures deterministically in manifest order", async () => {
  const first = deferred();
  const second = deferred();
  const assets = [entry("object.first.missing"), entry("object.second.missing")];
  const promise = loaderApi.loadAssets(assets, {
    imageFactory: createImageFactory([
      { decode: () => first.promise },
      { decode: () => second.promise }
    ]),
    timeoutMs: 1000
  });

  second.reject(new Error("second finished first"));
  await Promise.resolve();
  first.reject(new Error("first finished second"));
  const result = await promise;

  assert.deepEqual(result.failures.map((failure) => failure.key), [
    "object.first.missing",
    "object.second.missing"
  ]);
});

test("uses decode when available and cleans handlers after successful decoding", async () => {
  const decoded = deferred();
  const created = [];
  const asset = entry("enemy.slime.south.move");
  const promise = loaderApi.loadAssets([asset], {
    imageFactory: createImageFactory([{ decode: () => decoded.promise }], created),
    timeoutMs: 100
  });

  assert.equal(created[0].assignedSrc, asset.src);
  decoded.resolve();
  const result = await promise;

  assert.strictEqual(result.loaded.get(asset.key), created[0]);
  assert.strictEqual(created[0].onload, null);
  assert.strictEqual(created[0].onerror, null);
});

test("falls back to onload when decode is unavailable", async () => {
  const created = [];
  const asset = entry("object.shrine.active");
  const result = await loaderApi.loadAssets([asset], {
    imageFactory: createImageFactory([{
      onSrc(image) {
        queueMicrotask(() => image.onload());
      }
    }], created),
    timeoutMs: 100
  });

  assert.strictEqual(result.loaded.get(asset.key), created[0]);
  assert.deepEqual(result.failures, []);
});

test("records decode rejection without an unhandled or double settlement", async () => {
  const created = [];
  const asset = entry("fx.shockwave.base");
  const result = await loaderApi.loadAssets([asset], {
    imageFactory: createImageFactory([{
      decode: () => Promise.reject(new Error("corrupt image")),
      onSrc(image) {
        setImmediate(() => {
          if (image.onerror) image.onerror(new Error("late error"));
        });
      }
    }], created),
    timeoutMs: 100
  });

  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].reason, "decode");
  assert.strictEqual(created[0].onerror, null);
});

test("handles deterministic timeout and clears timers and image handlers", async () => {
  const timers = new Map();
  const cleared = [];
  const created = [];
  let nextTimerId = 1;
  const asset = entry("hazard.mine.armed");
  const promise = loaderApi.loadAssets([asset], {
    imageFactory: createImageFactory([{ decode: () => new Promise(() => {}) }], created),
    timeoutMs: 25,
    setTimeoutFn(callback, delay) {
      assert.equal(delay, 25);
      const id = nextTimerId++;
      timers.set(id, callback);
      return id;
    },
    clearTimeoutFn(id) {
      cleared.push(id);
      timers.delete(id);
    }
  });

  assert.equal(timers.size, 1);
  [...timers.values()][0]();
  const result = await promise;

  assert.equal(result.failures[0].reason, "timeout");
  assert.deepEqual(cleared, [1]);
  assert.equal(timers.size, 0);
  assert.strictEqual(created[0].onload, null);
  assert.strictEqual(created[0].onerror, null);
});

test("does not mutate manifest entries or share result state across loads", async () => {
  const assets = [entry("object.shrine.active")];
  const before = JSON.parse(JSON.stringify(assets));
  const success = () => ({
    onSrc(image) {
      queueMicrotask(() => image.onload());
    }
  });

  const first = await loaderApi.loadAssets(assets, {
    imageFactory: createImageFactory([success()]),
    timeoutMs: 100
  });
  first.loaded.clear();
  first.failures.push({ key: "consumer.mutation.test" });
  const second = await loaderApi.loadAssets(assets, {
    imageFactory: createImageFactory([success()]),
    timeoutMs: 100
  });

  assert.deepEqual(assets, before);
  assert.notStrictEqual(first.loaded, second.loaded);
  assert.notStrictEqual(first.failures, second.failures);
  assert.deepEqual([...second.loaded.keys()], [assets[0].key]);
  assert.deepEqual(second.failures, []);
});

test("snapshots descriptors before progress can mutate caller-owned entries", async () => {
  const asset = entry("environment.descent.floor.base", {
    group: "environment",
    critical: true
  });
  const safeSrc = asset.src;
  const created = [];
  const progress = [];
  const result = await loaderApi.loadAssets([asset], {
    imageFactory: createImageFactory([{
      onSrc(image) {
        queueMicrotask(() => image.onerror(new Error("critical missing")));
      }
    }], created),
    timeoutMs: 100,
    onProgress(update) {
      progress.push(update.completed);
      if (update.completed === 0) {
        asset.src = "https://attacker.invalid/external.png";
        asset.critical = false;
      }
    }
  });

  assert.equal(asset.src, "https://attacker.invalid/external.png", "the external mutation occurred");
  assert.equal(asset.critical, false, "the external mutation occurred");
  assert.equal(created[0].assignedSrc, safeSrc, "loading uses the validated descriptor snapshot");
  assert.deepEqual(progress, [0, 1]);
  assert.equal(result.ready, false);
  assert.equal(result.fallbackRequired, true);
  assert.equal(result.failures[0].critical, true);
});

test("reads accessor-backed descriptor properties exactly once and never rereads caller state", async () => {
  const reads = { key: 0, src: 0, group: 0, critical: 0 };
  const safe = entry("environment.corruption.wall.north", {
    group: "environment",
    critical: true
  });
  const unsafe = {
    key: "audio.attacker.payload",
    src: "https://attacker.invalid/external.png",
    group: "audio",
    critical: false
  };
  const asset = {};
  for (const property of Object.keys(reads)) {
    Object.defineProperty(asset, property, {
      configurable: true,
      enumerable: true,
      get() {
        reads[property] += 1;
        return reads[property] === 1 ? safe[property] : unsafe[property];
      }
    });
  }
  const originalDescriptors = Object.getOwnPropertyDescriptors(asset);
  const created = [];

  const result = await loaderApi.loadAssets([asset], {
    imageFactory: createImageFactory([{
      onSrc(image) {
        queueMicrotask(() => image.onerror(new Error("critical missing")));
      }
    }], created),
    timeoutMs: 100
  });

  assert.deepEqual(reads, { key: 1, src: 1, group: 1, critical: 1 });
  assert.equal(created[0].assignedSrc, safe.src);
  assert.equal(result.ready, false);
  assert.equal(result.fallbackRequired, true);
  assert.equal(result.failures[0].key, safe.key);
  assert.equal(result.failures[0].critical, true);
  assert.deepEqual(Object.getOwnPropertyDescriptors(asset), originalDescriptors);
});

test("settles deterministically when clearTimeoutFn throws during cleanup", async () => {
  let timeoutCallback;
  let progressCalls = 0;
  const promise = loaderApi.loadAssets([entry("hazard.mine.armed")], {
    imageFactory: createImageFactory([{ decode: () => new Promise(() => {}) }]),
    timeoutMs: 25,
    onProgress() {
      progressCalls += 1;
    },
    setTimeoutFn(callback) {
      timeoutCallback = callback;
      return 1;
    },
    clearTimeoutFn() {
      throw new Error("hostile timer cleanup");
    }
  });

  assert.doesNotThrow(() => timeoutCallback());
  const timeoutSentinel = Symbol("did not settle");
  const result = await Promise.race([
    promise,
    new Promise((resolve) => setImmediate(() => resolve(timeoutSentinel)))
  ]);

  assert.notStrictEqual(result, timeoutSentinel);
  assert.equal(result.failures[0].reason, "timeout");
  assert.equal(progressCalls, 2, "initial and final progress are each reported once");
});

test("hostile handler cleanup cannot strand decode rejection or create an unhandled rejection", async () => {
  const unhandled = [];
  const onUnhandled = (reason) => {
    unhandled.push(reason);
  };
  let onloadAssignments = 0;
  let onerrorAssignments = 0;
  let storedOnError = null;
  const image = {};
  Object.defineProperties(image, {
    onload: {
      configurable: true,
      get() {
        return null;
      },
      set() {
        onloadAssignments += 1;
        if (onloadAssignments > 1) throw new Error("hostile onload cleanup");
      }
    },
    onerror: {
      configurable: true,
      get() {
        return storedOnError;
      },
      set(value) {
        onerrorAssignments += 1;
        if (onerrorAssignments > 1) throw new Error("hostile onerror cleanup");
        storedOnError = value;
      }
    },
    src: {
      configurable: true,
      set() {}
    }
  });
  image.decode = () => Promise.reject(new Error("decode failed"));

  process.prependListener("unhandledRejection", onUnhandled);
  let result;
  try {
    const timeoutSentinel = Symbol("did not settle");
    result = await Promise.race([
      loaderApi.loadAssets([entry("fx.shockwave.base")], {
        imageFactory: () => image,
        timeoutMs: 100
      }),
      new Promise((resolve) => setImmediate(() => resolve(timeoutSentinel)))
    ]);
    assert.notStrictEqual(result, timeoutSentinel);
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    process.removeListener("unhandledRejection", onUnhandled);
  }

  assert.equal(result.failures[0].reason, "decode");
  assert.deepEqual(unhandled, []);
  assert.equal(onloadAssignments, 2, "the loader attempted normal handler cleanup once");
  assert.equal(onerrorAssignments, 2, "cleanup remains best-effort after the first hostile setter");
});

test("rejects explicitly supplied falsy dependency options instead of defaulting them", async () => {
  for (const optionName of ["imageFactory", "setTimeoutFn", "clearTimeoutFn"]) {
    for (const invalidValue of [null, false, 0, ""]) {
      await assert.rejects(
        loaderApi.loadAssets([], { [optionName]: invalidValue }),
        {
          name: "TypeError",
          message: new RegExp(optionName)
        },
        `${optionName}=${JSON.stringify(invalidValue)} must be rejected`
      );
    }
  }

  const result = await loaderApi.loadAssets([], {
    imageFactory: undefined,
    setTimeoutFn: undefined,
    clearTimeoutFn: undefined
  });
  assert.equal(result.ready, true);
});

test("rejects a wholly sparse manifest consistently across validation and loading APIs", async () => {
  const sparse = new Array(1);
  const expectedError = /manifest entry 0.*(?:missing|present|hole)/i;

  assert.throws(() => manifestApi.validateManifest(sparse), expectedError);
  await assert.rejects(
    Promise.resolve().then(() => loaderApi.loadAssets(sparse)),
    expectedError
  );
  await assert.rejects(
    Promise.resolve().then(() => loaderApi.loadGroup("objects", { manifest: sparse })),
    expectedError
  );
});

test("rejects a partially sparse manifest at the exact missing index", async () => {
  const sparse = [
    entry("object.first.present"),
    ,
    entry("object.third.present")
  ];
  const expectedError = /manifest entry 1.*(?:missing|present|hole)/i;

  assert.throws(() => manifestApi.validateManifest(sparse), expectedError);
  await assert.rejects(
    Promise.resolve().then(() => loaderApi.loadAssets(sparse)),
    expectedError
  );
});

test("rejects an index deleted by an earlier descriptor accessor during snapshotting", async () => {
  let keyReads = 0;
  const later = entry("object.second.deleted");
  const earlier = entry("object.first.mutator");
  const manifest = [earlier, later];
  Object.defineProperty(earlier, "key", {
    configurable: true,
    enumerable: true,
    get() {
      keyReads += 1;
      delete manifest[1];
      return "object.first.mutator";
    }
  });

  await assert.rejects(
    Promise.resolve().then(() => loaderApi.loadAssets(manifest)),
    /manifest entry 1.*(?:missing|present|hole)/i
  );
  assert.equal(keyReads, 1, "the earlier accessor is still read exactly once");
});

test("defines dense empty manifests as ready and keeps normal dense manifests valid", async () => {
  assert.equal(manifestApi.validateManifest([]), true);
  const progress = [];
  const emptyResult = await loaderApi.loadAssets([], {
    onProgress(update) {
      progress.push(update);
    }
  });

  assert.equal(emptyResult.ready, true);
  assert.equal(emptyResult.fallbackRequired, false);
  assert.deepEqual([...emptyResult.loaded], []);
  assert.deepEqual(emptyResult.failures, []);
  assert.deepEqual(progress, [{ completed: 0, total: 0, ratio: 1, complete: true }]);

  const dense = [entry("object.first.present"), entry("object.second.present")];
  assert.equal(manifestApi.validateManifest(dense), true);
  assert.deepEqual(
    manifestApi.selectGroup("test", dense).map((asset) => asset.key),
    ["object.first.present", "object.second.present"]
  );
});

test("UMD asset scripts attach in dependency order before the graphics controller", () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(manifestPath, "utf8"), context);
  vm.runInContext(fs.readFileSync(loaderPath, "utf8"), context);

  assert.equal(typeof context.window.DungeonHDAssetManifest.getByKey, "function");
  assert.equal(typeof context.window.DungeonHDAssetLoader.loadGroup, "function");

  const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const manifestIndex = indexHtml.indexOf('<script src="render/hd-asset-manifest.js"></script>');
  const loaderIndex = indexHtml.indexOf('<script src="render/hd-asset-loader.js"></script>');
  const gameIndex = indexHtml.indexOf('<script src="game.js"></script>');
  assert.ok(manifestIndex >= 0, "manifest script is loaded");
  assert.ok(loaderIndex > manifestIndex, "loader is loaded after its manifest dependency");
  assert.ok(gameIndex > loaderIndex, "both HD preload modules load before game.js");

  const gameSource = fs.readFileSync(path.join(projectRoot, "game.js"), "utf8");
  assert.match(gameSource, /loader:\s*window\.DungeonHDAssetLoader/);
  assert.match(gameSource, /manifest:\s*window\.DungeonHDAssetManifest\s*&&\s*window\.DungeonHDAssetManifest\.entries/);
  assert.match(gameSource, /graphicsController\.initialize\(\)/);
});
