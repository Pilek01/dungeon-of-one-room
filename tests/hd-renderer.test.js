const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const layersPath = path.join(projectRoot, "render", "hd-renderer-layers.js");
const rendererPath = path.join(projectRoot, "render", "hd-renderer.js");
const assetLoaderPath = path.join(projectRoot, "render", "hd-asset-loader.js");
const realAssetLoader = require(assetLoaderPath);

function loadLayers() {
  return require(layersPath);
}

function loadRenderer() {
  return require(rendererPath);
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

function createCanvas() {
  const classes = new Set();
  return {
    width: 999,
    height: 999,
    dataset: {},
    classList: {
      contains(name) {
        return classes.has(name);
      },
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      }
    }
  };
}

function createContext(events = []) {
  return {
    clearRect(...args) {
      events.push(["clearRect", ...args]);
    },
    save() {
      events.push(["save"]);
    },
    restore() {
      events.push(["restore"]);
    }
  };
}

function successResult(assets = new Map([["environment.descent.floor.base", { id: "floor" }]])) {
  return {
    ready: true,
    fallbackRequired: false,
    loaded: assets,
    failures: []
  };
}

async function exerciseLoaderResult(result, options = {}) {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  const context = createContext();
  const diagnostics = [];
  const frames = [];
  const snapshot = Object.freeze({ id: "same-snapshot" });
  const manifest = options.manifest || [{
    key: "critical.asset",
    src: "assets/hd/critical-asset.png",
    group: "test",
    critical: true
  }];
  const controller = renderer.createGraphicsController({
    canvas,
    context,
    loader: { loadAssets: async () => result },
    manifest,
    renderHD(receivedSnapshot, receivedContext, assets) {
      frames.push({ mode: "hd", snapshot: receivedSnapshot, context: receivedContext, assets });
    },
    renderLegacy(receivedSnapshot, receivedContext) {
      frames.push({ mode: "legacy", snapshot: receivedSnapshot, context: receivedContext });
    },
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });

  const outcome = await controller.initialize(true);
  controller.render(snapshot);
  return { canvas, context, controller, diagnostics, frames, outcome, snapshot };
}

async function exerciseReentrantLoaderResult(createResult) {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  const context = createContext();
  const diagnostics = [];
  const frames = [];
  const snapshot = Object.freeze({ id: "reentrant-snapshot" });
  let controller;
  const result = createResult(() => controller.initialize(false));
  controller = renderer.createGraphicsController({
    canvas,
    context,
    loader: { loadAssets: async () => result },
    manifest: [{
      key: "critical.asset",
      src: "assets/hd/critical-asset.png",
      group: "test",
      critical: true
    }],
    renderHD(receivedSnapshot, receivedContext, assets) {
      frames.push({ mode: "hd", snapshot: receivedSnapshot, context: receivedContext, assets });
    },
    renderLegacy(receivedSnapshot, receivedContext) {
      frames.push({ mode: "legacy", snapshot: receivedSnapshot, context: receivedContext });
    },
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });

  const outcome = await controller.initialize(true);
  controller.render(snapshot);
  return { canvas, context, controller, diagnostics, frames, outcome, snapshot };
}

test("uses a 64 px, 9 by 9 world with checked grid coordinates", () => {
  const api = loadRenderer();

  assert.equal(api.TILE_SIZE, 64);
  assert.equal(api.GRID_SIZE, 9);
  assert.equal(api.WORLD_SIZE, 576);
  assert.deepEqual(api.gridToScreen(0, 0), { x: 0, y: 0 });
  assert.deepEqual(api.gridToScreen(8, 8), { x: 512, y: 512 });

  for (const invalid of [
    [-1, 0],
    [0, -1],
    [9, 0],
    [0, 9],
    [1.5, 2],
    [2, Number.NaN]
  ]) {
    assert.throws(() => api.gridToScreen(...invalid), /grid|coordinate|integer|range/i);
  }
});

test("bottom-center anchoring lets 128 px and 192 px bosses overhang one logical tile", () => {
  const api = loadRenderer();

  assert.deepEqual(api.BOTTOM_CENTER_ANCHOR, { x: 0.5, y: 1 });
  assert.deepEqual(api.getAnchoredDestinationRect(4, 4, 128, 128), {
    x: 224,
    y: 192,
    width: 128,
    height: 128
  });
  assert.deepEqual(api.getAnchoredDestinationRect(4, 4, 192, 192), {
    x: 192,
    y: 128,
    width: 192,
    height: 192
  });
  assert.deepEqual(api.gridToScreen(4, 4), { x: 256, y: 256 }, "the logical tile is unchanged");
  assert.throws(() => api.getAnchoredDestinationRect(4, 4, 0, 128), /width|size/i);
});

test("clears the HD world and invokes isolated layers in the exact approved order", () => {
  const renderer = loadRenderer();
  const layersApi = loadLayers();
  const expectedOrder = [
    "floor",
    "decals",
    "hazards",
    "objects",
    "telegraphs",
    "vfx",
    "enemies",
    "player",
    "lighting"
  ];
  const events = [];
  const context = createContext(events);
  const snapshot = Object.freeze({ marker: "visual-only" });
  const assets = new Map([["actor.player.south.idle", Object.freeze({ id: "player" })]]);
  const layers = {};

  for (const name of expectedOrder) {
    layers[name] = (receivedContext, receivedSnapshot, receivedAssets) => {
      assert.strictEqual(receivedContext, context);
      assert.strictEqual(receivedSnapshot, snapshot);
      assert.strictEqual(receivedAssets, assets);
      events.push(["layer", name]);
    };
  }

  renderer.renderHDFrame(snapshot, context, assets, layers);

  assert.deepEqual(renderer.LAYER_ORDER, expectedOrder);
  assert.strictEqual(renderer.LAYER_ORDER, layersApi.LAYER_ORDER);
  assert.deepEqual(events[0], ["clearRect", 0, 0, 576, 576]);
  assert.deepEqual(events.slice(1), expectedOrder.flatMap((name) => [
    ["save"],
    ["layer", name],
    ["restore"]
  ]));
});

test("restores canvas state even when a layer throws", () => {
  const renderer = loadRenderer();
  const events = [];
  const context = createContext(events);
  const layers = Object.fromEntries(renderer.LAYER_ORDER.map((name) => [name, () => {}]));
  layers.hazards = () => {
    events.push(["layer", "hazards"]);
    throw new Error("layer failed");
  };

  assert.throws(
    () => renderer.renderHDFrame({}, context, new Map(), layers),
    /layer failed/
  );
  assert.deepEqual(events.slice(-2), [["layer", "hazards"], ["restore"]]);
});

test("disabled mode stays synchronously legacy and never touches the HD loader", () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  const context = createContext();
  const calls = [];
  const controller = renderer.createGraphicsController({
    canvas,
    context,
    loader: {
      loadAssets() {
        calls.push("load");
        throw new Error("disabled mode must not load");
      }
    },
    manifest: [{ critical: true }],
    renderHD() {
      calls.push("hd");
    },
    renderLegacy(snapshot) {
      calls.push(["legacy", snapshot]);
    }
  });
  const snapshot = Object.freeze({ id: "same-snapshot" });

  const initialization = controller.initialize(false);
  controller.render(snapshot);

  assert.equal(typeof initialization.then, "undefined", "the disabled decision is synchronous");
  assert.equal(controller.getMode(), "legacy");
  assert.equal(canvas.width, 144);
  assert.equal(canvas.height, 144);
  assert.equal(canvas.dataset.graphicsMode, "legacy");
  assert.equal(canvas.classList.contains("graphics-legacy"), true);
  assert.equal(canvas.classList.contains("graphics-hd"), false);
  assert.deepEqual(calls, [["legacy", snapshot]]);
});

test("successful critical preload switches intrinsic size and renders HD only", async () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  const context = createContext();
  const assets = new Map([["critical.asset", Object.freeze({ id: "critical" })]]);
  const snapshots = [];
  const manifest = Object.freeze([{ key: "critical.asset", critical: true }]);
  const controller = renderer.createGraphicsController({
    canvas,
    context,
    loader: {
      async loadAssets(receivedManifest) {
        assert.strictEqual(receivedManifest, manifest);
        return successResult(assets);
      }
    },
    manifest,
    renderHD(snapshot, receivedContext, receivedAssets) {
      assert.strictEqual(receivedContext, context);
      assert.notStrictEqual(receivedAssets, assets);
      assert.deepEqual([...receivedAssets], [...assets]);
      snapshots.push(snapshot);
    },
    renderLegacy() {
      assert.fail("legacy must not render after HD activation");
    }
  });
  const snapshot = Object.freeze({ id: "same-snapshot" });

  const outcome = await controller.initialize(true);
  controller.render(snapshot);

  assert.equal(outcome.mode, "hd");
  assert.equal(controller.getMode(), "hd");
  assert.equal(canvas.width, 576);
  assert.equal(canvas.height, 576);
  assert.equal(canvas.dataset.graphicsMode, "hd");
  assert.equal(canvas.classList.contains("graphics-hd"), true);
  assert.equal(canvas.classList.contains("graphics-legacy"), false);
  assert.deepEqual(snapshots, [snapshot]);
});

test("intrinsic canvas switches restore pixel-art smoothing invariants", async () => {
  const renderer = loadRenderer();
  const context = createContext();
  context.imageSmoothingEnabled = false;
  const canvas = createCanvas();
  let intrinsicWidth = 144;
  let intrinsicHeight = 144;
  Object.defineProperties(canvas, {
    width: {
      configurable: true,
      get: () => intrinsicWidth,
      set(value) {
        intrinsicWidth = value;
        context.imageSmoothingEnabled = true;
      }
    },
    height: {
      configurable: true,
      get: () => intrinsicHeight,
      set(value) {
        intrinsicHeight = value;
        context.imageSmoothingEnabled = true;
      }
    }
  });
  const controller = renderer.createGraphicsController({
    canvas,
    context,
    loader: { loadAssets: async () => successResult() },
    manifest: [],
    renderHD() {},
    renderLegacy() {}
  });

  await controller.initialize(true);
  assert.equal(context.imageSmoothingEnabled, false, "HD activation keeps nearest-neighbor pixels");

  controller.fallback(new Error("fallback probe"));
  assert.equal(context.imageSmoothingEnabled, false, "legacy fallback restores nearest-neighbor pixels");
});

test("a ready result missing a critical manifest key cannot activate HD", async () => {
  const renderer = loadRenderer();
  const diagnostics = [];
  const canvas = createCanvas();
  const controller = renderer.createGraphicsController({
    canvas,
    context: createContext(),
    loader: { loadAssets: async () => successResult(new Map()) },
    manifest: [
      { key: "critical.asset", src: "assets/hd/critical.png", group: "test", critical: true },
      { key: "optional.asset", src: "assets/hd/optional.png", group: "test", critical: false }
    ],
    renderHD() {
      assert.fail("HD must not activate without every critical asset");
    },
    renderLegacy() {},
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });

  const outcome = await controller.initialize(true);

  assert.equal(outcome.mode, "legacy");
  assert.equal(controller.getMode(), "legacy");
  assert.equal(canvas.width, 144);
  assert.match(diagnostics[0].message, /critical\.asset|critical|missing/i);
});

test("nullish, primitive, and array critical asset values cannot activate HD", async () => {
  for (const invalidAsset of [undefined, null, 0, false, "not-an-image", []]) {
    const run = await exerciseLoaderResult(successResult(new Map([
      ["critical.asset", invalidAsset]
    ])));

    assert.equal(run.outcome.mode, "legacy", String(invalidAsset));
    assert.equal(run.controller.getMode(), "legacy", String(invalidAsset));
    assert.equal(run.canvas.width, 144, String(invalidAsset));
    assert.deepEqual(run.frames.map((frame) => frame.mode), ["legacy"], String(invalidAsset));
    assert.equal(run.diagnostics.length, 1, String(invalidAsset));
    assert.match(run.diagnostics[0].message, /critical\.asset|asset|object|function|fallback/i);
  }
});

test("critical asset functions remain valid loaded values", async () => {
  const fakeCallableAsset = function fakeCallableAsset() {};
  const run = await exerciseLoaderResult(successResult(new Map([
    ["critical.asset", fakeCallableAsset]
  ])));

  assert.equal(run.outcome.mode, "hd");
  assert.equal(run.canvas.width, 576);
  assert.deepEqual(run.frames.map((frame) => frame.mode), ["hd"]);
  assert.strictEqual(run.frames[0].assets.get("critical.asset"), fakeCallableAsset);
});

test("a ready result with missing failures falls back as malformed", async () => {
  const result = {
    ready: true,
    fallbackRequired: false,
    loaded: new Map([["critical.asset", {}]])
  };

  const run = await exerciseLoaderResult(result);

  assert.equal(run.outcome.mode, "legacy");
  assert.equal(run.canvas.width, 144);
  assert.deepEqual(run.frames.map((frame) => frame.mode), ["legacy"]);
  assert.equal(run.diagnostics.length, 1);
  assert.match(run.diagnostics[0].message, /malformed|failures|array|fallback|legacy/i);
});

test("a ready result with non-array failures falls back as malformed", async () => {
  const result = {
    ready: true,
    fallbackRequired: false,
    loaded: new Map([["critical.asset", {}]]),
    failures: { critical: false }
  };

  const run = await exerciseLoaderResult(result);

  assert.equal(run.outcome.mode, "legacy");
  assert.equal(run.canvas.width, 144);
  assert.deepEqual(run.frames.map((frame) => frame.mode), ["legacy"]);
  assert.equal(run.diagnostics.length, 1);
  assert.match(run.diagnostics[0].message, /malformed|failures|array|fallback|legacy/i);
});

test("a claimed-ready result with a critical failure can never activate HD", async () => {
  const result = successResult(new Map([["critical.asset", {}]]));
  result.failures.push({
    key: "critical.asset",
    src: "assets/hd/critical-asset.png",
    critical: true,
    reason: "timeout"
  });

  const run = await exerciseLoaderResult(result);

  assert.equal(run.outcome.mode, "legacy");
  assert.equal(run.canvas.width, 144);
  assert.deepEqual(run.frames.map((frame) => frame.mode), ["legacy"]);
  assert.equal(run.diagnostics.length, 1);
  assert.match(run.diagnostics[0].message, /critical\.asset|critical|timeout/i);
});

test("contradictory readiness flag combinations always fall back", async () => {
  for (const flags of [
    { ready: true, fallbackRequired: true },
    { ready: false, fallbackRequired: false }
  ]) {
    const run = await exerciseLoaderResult({
      ...flags,
      loaded: new Map([["critical.asset", {}]]),
      failures: []
    });

    assert.equal(run.outcome.mode, "legacy", JSON.stringify(flags));
    assert.equal(run.canvas.width, 144, JSON.stringify(flags));
    assert.deepEqual(run.frames.map((frame) => frame.mode), ["legacy"], JSON.stringify(flags));
    assert.equal(run.diagnostics.length, 1, JSON.stringify(flags));
  }
});

test("malformed failure entries fall back with a clear diagnostic", async () => {
  const malformedEntries = [
    null,
    "not-an-object",
    { key: "optional.asset", reason: "error" },
    { key: "optional.asset", critical: "false", reason: "error" }
  ];

  for (const failure of malformedEntries) {
    const run = await exerciseLoaderResult({
      ready: true,
      fallbackRequired: false,
      loaded: new Map([["critical.asset", {}]]),
      failures: [failure]
    });

    assert.equal(run.outcome.mode, "legacy", JSON.stringify(failure));
    assert.deepEqual(run.frames.map((frame) => frame.mode), ["legacy"], JSON.stringify(failure));
    assert.equal(run.diagnostics.length, 1, JSON.stringify(failure));
    assert.match(run.diagnostics[0].message, /malformed|failure|critical|fallback|legacy/i);
  }
});

test("a valid optional failure can coexist with a ready HD result", async () => {
  const result = successResult(new Map([["critical.asset", {}]]));
  result.failures.push({
    key: "optional.asset",
    src: "assets/hd/optional-asset.png",
    critical: false,
    reason: "error"
  });

  const run = await exerciseLoaderResult(result);

  assert.equal(run.outcome.mode, "hd");
  assert.equal(run.canvas.width, 576);
  assert.deepEqual(run.frames.map((frame) => frame.mode), ["hd"]);
  assert.equal(run.diagnostics.length, 0);
});

test("loader results are snapshotted before caller mutation can affect HD frames", async () => {
  const loaded = new Map([["critical.asset", Object.freeze({ id: "critical" })]]);
  const failures = [];
  const result = { ready: true, fallbackRequired: false, loaded, failures };
  const run = await exerciseLoaderResult(result);

  assert.notStrictEqual(run.outcome.result, result);
  assert.notStrictEqual(run.outcome.result.loaded, loaded);
  assert.notStrictEqual(run.outcome.result.failures, failures);
  assert.equal(Object.isFrozen(run.outcome.result), true);
  assert.equal(Object.isFrozen(run.outcome.result.failures), true);

  loaded.clear();
  failures.push({ key: "critical.asset", critical: true, reason: "timeout" });
  run.outcome.result.loaded.clear();

  assert.equal(run.frames[0].mode, "hd");
  assert.equal(run.frames[0].assets.has("critical.asset"), true);
  assert.deepEqual(run.outcome.result.failures, []);
});

test("ready accessor reentrancy cannot let an older HD initialization override legacy", async () => {
  let readyReads = 0;
  const run = await exerciseReentrantLoaderResult((reenter) => ({
    get ready() {
      readyReads += 1;
      reenter();
      return true;
    },
    fallbackRequired: false,
    loaded: new Map([["critical.asset", {}]]),
    failures: []
  }));

  assert.equal(readyReads, 1);
  assert.equal(run.outcome.stale, true);
  assert.equal(run.outcome.mode, "legacy");
  assert.equal(run.controller.getMode(), "legacy");
  assert.equal(run.canvas.width, 144);
  assert.equal(run.canvas.height, 144);
  assert.equal(run.canvas.dataset.graphicsMode, "legacy");
  assert.equal(run.canvas.classList.contains("graphics-legacy"), true);
  assert.equal(run.canvas.classList.contains("graphics-hd"), false);
  assert.deepEqual(run.frames.map((frame) => frame.mode), ["legacy"]);
  assert.strictEqual(run.frames[0].snapshot, run.snapshot);
  assert.equal(run.diagnostics.length, 0);
});

test("failures accessor reentrancy leaves the newer legacy decision authoritative", async () => {
  let failureReads = 0;
  const run = await exerciseReentrantLoaderResult((reenter) => ({
    ready: true,
    fallbackRequired: false,
    loaded: new Map([["critical.asset", {}]]),
    get failures() {
      failureReads += 1;
      reenter();
      return [];
    }
  }));

  assert.equal(failureReads, 1);
  assert.equal(run.outcome.stale, true);
  assert.equal(run.controller.getMode(), "legacy");
  assert.equal(run.canvas.width, 144);
  assert.deepEqual(run.frames.map((frame) => frame.mode), ["legacy"]);
  assert.equal(run.diagnostics.length, 0);
});

test("loaded Map iterator reentrancy cannot activate stale HD assets", async () => {
  let iteratorCalls = 0;
  const run = await exerciseReentrantLoaderResult((reenter) => {
    class ReentrantLoadedMap extends Map {
      [Symbol.iterator]() {
        iteratorCalls += 1;
        reenter();
        return super[Symbol.iterator]();
      }
    }
    return {
      ready: true,
      fallbackRequired: false,
      loaded: new ReentrantLoadedMap([["critical.asset", {}]]),
      failures: []
    };
  });

  assert.equal(iteratorCalls, 1);
  assert.equal(run.outcome.stale, true);
  assert.equal(run.controller.getMode(), "legacy");
  assert.equal(run.canvas.width, 144);
  assert.deepEqual(run.frames.map((frame) => frame.mode), ["legacy"]);
  assert.equal(run.diagnostics.length, 0);
});

test("reentrant throw or malformed data cannot override or diagnose an obsolete request", async () => {
  const cases = [
    (reenter) => ({
      get ready() {
        reenter();
        throw new Error("reentrant ready failure");
      },
      fallbackRequired: false,
      loaded: new Map([["critical.asset", {}]]),
      failures: []
    }),
    (reenter) => ({
      ready: true,
      fallbackRequired: false,
      loaded: new Map([["critical.asset", {}]]),
      get failures() {
        reenter();
        return null;
      }
    })
  ];

  for (const createResult of cases) {
    const run = await exerciseReentrantLoaderResult(createResult);
    assert.equal(run.outcome.stale, true);
    assert.equal(run.controller.getMode(), "legacy");
    assert.equal(run.canvas.width, 144);
    assert.deepEqual(run.frames.map((frame) => frame.mode), ["legacy"]);
    assert.equal(run.diagnostics.length, 0);
  }
});

test("accepts and rejects the real Task 3 loader result shapes", async () => {
  const readyResult = await realAssetLoader.loadAssets([]);
  const readyRun = await exerciseLoaderResult(readyResult, { manifest: [] });
  assert.equal(readyRun.outcome.mode, "hd");

  const criticalManifest = [{
    key: "environment.test.floor",
    src: "assets/hd/test-critical.png",
    group: "test",
    critical: true
  }];
  const failedResult = await realAssetLoader.loadAssets(criticalManifest, {
    imageFactory() {
      const image = { onload: null, onerror: null };
      Object.defineProperty(image, "src", {
        set() {
          queueMicrotask(() => image.onerror(new Error("missing")));
        }
      });
      return image;
    },
    timeoutMs: 100
  });
  const failedRun = await exerciseLoaderResult(failedResult, { manifest: criticalManifest });

  assert.equal(failedRun.outcome.mode, "legacy");
  assert.equal(failedRun.diagnostics.length, 1);
  assert.match(failedRun.diagnostics[0].message, /environment\.test\.floor|critical|error/i);
});

test("accepts a real Task 3 loader image object for a critical asset", async () => {
  const criticalManifest = [{
    key: "environment.test.floor",
    src: "assets/hd/test-critical.png",
    group: "test",
    critical: true
  }];
  let createdImage;
  const loadedResult = await realAssetLoader.loadAssets(criticalManifest, {
    imageFactory() {
      const image = { onload: null, onerror: null };
      Object.defineProperty(image, "src", {
        set() {
          queueMicrotask(() => image.onload());
        }
      });
      createdImage = image;
      return image;
    },
    timeoutMs: 100
  });
  const run = await exerciseLoaderResult(loadedResult, { manifest: criticalManifest });

  assert.equal(run.outcome.mode, "hd");
  assert.equal(run.canvas.width, 576);
  assert.strictEqual(run.frames[0].assets.get("environment.test.floor"), createdImage);
});

test("critical timeout result falls back with a diagnostic and legacy frames", async () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  const context = createContext();
  const diagnostics = [];
  const rendered = [];
  const failedResult = {
    ready: false,
    fallbackRequired: true,
    loaded: new Map(),
    failures: [{ key: "critical.asset", critical: true, reason: "timeout" }]
  };
  const controller = renderer.createGraphicsController({
    canvas,
    context,
    loader: { loadAssets: async () => failedResult },
    manifest: [],
    renderHD() {
      assert.fail("HD must not render after critical timeout");
    },
    renderLegacy(snapshot) {
      rendered.push(snapshot);
    },
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });
  const snapshot = Object.freeze({ id: "same-snapshot" });

  const outcome = await controller.initialize(true);
  controller.render(snapshot);

  assert.equal(outcome.mode, "legacy");
  assert.equal(controller.getMode(), "legacy");
  assert.equal(canvas.width, 144);
  assert.equal(canvas.height, 144);
  assert.notStrictEqual(outcome.result, failedResult);
  assert.deepEqual(outcome.result.failures, failedResult.failures);
  assert.match(diagnostics[0].message, /fallback|legacy|critical|timeout/i);
  assert.deepEqual(rendered, [snapshot]);
});

test("loader throws and rejects without escaping the fallback boundary", async (t) => {
  const renderer = loadRenderer();

  for (const [label, loadAssets] of [
    ["throw", () => { throw new Error("synchronous loader failure"); }],
    ["rejection", async () => { throw new Error("asynchronous loader failure"); }]
  ]) {
    await t.test(label, async () => {
      const diagnostics = [];
      const canvas = createCanvas();
      const controller = renderer.createGraphicsController({
        canvas,
        context: createContext(),
        loader: { loadAssets },
        manifest: [],
        renderHD() {},
        renderLegacy() {},
        onDiagnostic(diagnostic) {
          diagnostics.push(diagnostic);
        }
      });

      const outcome = await controller.initialize(true);

      assert.equal(outcome.mode, "legacy");
      assert.equal(canvas.width, 144);
      assert.match(diagnostics[0].message, /loader|fallback|legacy/i);
      assert.match(String(diagnostics[0].cause), /loader failure/i);
    });
  }
});

test("missing loader dependencies and malformed results fall back instead of crashing", async () => {
  const renderer = loadRenderer();
  const cases = [
    { label: "missing loader", loader: undefined },
    { label: "null result", loader: { loadAssets: async () => null } },
    {
      label: "non-Map assets",
      loader: { loadAssets: async () => ({ ready: true, fallbackRequired: false, loaded: {} }) }
    },
    {
      label: "contradictory readiness",
      loader: {
        loadAssets: async () => ({ ready: true, fallbackRequired: true, loaded: new Map(), failures: [] })
      }
    }
  ];

  for (const current of cases) {
    const diagnostics = [];
    const controller = renderer.createGraphicsController({
      canvas: createCanvas(),
      context: createContext(),
      loader: current.loader,
      manifest: [],
      renderHD() {},
      renderLegacy() {},
      onDiagnostic(diagnostic) {
        diagnostics.push(diagnostic);
      }
    });

    const outcome = await controller.initialize(true);

    assert.equal(outcome.mode, "legacy", current.label);
    assert.equal(controller.getMode(), "legacy", current.label);
    assert.equal(diagnostics.length, 1, current.label);
  }
});

test("a stale async result cannot overwrite a newer graphics decision", async () => {
  const renderer = loadRenderer();
  const first = deferred();
  const second = deferred();
  let loadCalls = 0;
  const diagnostics = [];
  const canvas = createCanvas();
  const controller = renderer.createGraphicsController({
    canvas,
    context: createContext(),
    loader: {
      loadAssets() {
        loadCalls += 1;
        return loadCalls === 1 ? first.promise : second.promise;
      }
    },
    manifest: [],
    renderHD() {},
    renderLegacy() {},
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });

  const staleInitialization = controller.initialize(true);
  controller.initialize(false);
  const currentInitialization = controller.initialize(true);
  second.resolve(successResult(new Map([["current", {}]])));
  await currentInitialization;
  first.resolve({
    ready: false,
    fallbackRequired: true,
    loaded: new Map(),
    failures: [{ key: "stale", critical: true, reason: "timeout" }]
  });
  const staleOutcome = await staleInitialization;

  assert.equal(staleOutcome.stale, true);
  assert.equal(controller.getMode(), "hd");
  assert.equal(canvas.width, 576);
  assert.equal(diagnostics.length, 0, "a stale failure emits no current diagnostic");
});

test("same-HD reentry from a manifest getter shares one pending promise and load", async () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  let controller;
  let nestedPromise;
  let getterCalls = 0;
  let loadCalls = 0;
  let reenter = true;
  const manifestEntry = {
    key: "critical.asset",
    src: "assets/hd/critical-asset.png",
    group: "test"
  };
  Object.defineProperty(manifestEntry, "critical", {
    enumerable: true,
    get() {
      getterCalls += 1;
      if (reenter) {
        reenter = false;
        nestedPromise = controller.initialize(true);
      }
      return true;
    }
  });
  controller = renderer.createGraphicsController({
    canvas,
    context: createContext(),
    loader: {
      loadAssets() {
        loadCalls += 1;
        return successResult(new Map([["critical.asset", {}]]));
      }
    },
    manifest: [manifestEntry],
    renderHD() {},
    renderLegacy() {}
  });

  const outerPromise = controller.initialize(true);
  const outcome = await outerPromise;

  assert.strictEqual(nestedPromise, outerPromise);
  assert.equal(loadCalls, 1);
  assert.equal(getterCalls, 1);
  assert.equal(outcome.mode, "hd");
  assert.equal(controller.getMode(), "hd");
  assert.equal(canvas.width, 576);
});

test("same-HD reentry from loader invocation returns the exact pending promise", async () => {
  const renderer = loadRenderer();
  let controller;
  let nestedPromise;
  let loadCalls = 0;
  controller = renderer.createGraphicsController({
    canvas: createCanvas(),
    context: createContext(),
    loader: {
      loadAssets() {
        loadCalls += 1;
        if (loadCalls === 1) nestedPromise = controller.initialize(true);
        return successResult(new Map([["critical.asset", {}]]));
      }
    },
    manifest: [{ key: "critical.asset", critical: true }],
    renderHD() {},
    renderLegacy() {}
  });

  const outerPromise = controller.initialize(true);
  const outcome = await outerPromise;

  assert.strictEqual(nestedPromise, outerPromise);
  assert.equal(loadCalls, 1);
  assert.equal(outcome.mode, "hd");
});

test("real loader onProgress legacy reentry keeps later legacy initialization synchronous", async () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  const diagnostics = [];
  const frames = [];
  let controller;
  let progressCalls = 0;
  controller = renderer.createGraphicsController({
    canvas,
    context: createContext(),
    loader: realAssetLoader,
    manifest: [],
    loaderOptions: {
      onProgress() {
        progressCalls += 1;
        if (progressCalls === 1) controller.initialize(false);
      }
    },
    renderHD() {
      frames.push("hd");
    },
    renderLegacy() {
      frames.push("legacy");
    },
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });

  const stalePromise = controller.initialize(true);
  const repeatedLegacy = controller.initialize(false);
  const staleOutcome = await stalePromise;
  controller.render(Object.freeze({ id: "legacy" }));

  assert.equal(typeof repeatedLegacy.then, "undefined");
  assert.equal(repeatedLegacy.mode, "legacy");
  assert.equal(staleOutcome.stale, true);
  assert.equal(controller.getMode(), "legacy");
  assert.equal(canvas.width, 144);
  assert.deepEqual(frames, ["legacy"]);
  assert.equal(diagnostics.length, 0);
});

test("stale outer completion cannot replace or clear a newer pending HD record", async () => {
  const renderer = loadRenderer();
  const oldLoad = deferred();
  const newLoad = deferred();
  const diagnostics = [];
  let controller;
  let newerPromise;
  let loadCalls = 0;
  controller = renderer.createGraphicsController({
    canvas: createCanvas(),
    context: createContext(),
    loader: {
      loadAssets() {
        loadCalls += 1;
        if (loadCalls === 1) {
          controller.initialize(false);
          newerPromise = controller.initialize(true);
          return oldLoad.promise;
        }
        return newLoad.promise;
      }
    },
    manifest: [],
    renderHD() {},
    renderLegacy() {},
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });

  const oldPromise = controller.initialize(true);
  assert.strictEqual(controller.initialize(true), newerPromise);
  assert.equal(loadCalls, 2);

  oldLoad.resolve(successResult(new Map()));
  const oldOutcome = await oldPromise;
  assert.equal(oldOutcome.stale, true);
  assert.strictEqual(controller.initialize(true), newerPromise);
  assert.equal(loadCalls, 2, "old cleanup did not start a replacement load");

  newLoad.resolve(successResult(new Map()));
  const newOutcome = await newerPromise;
  assert.equal(newOutcome.mode, "hd");
  assert.equal(controller.getMode(), "hd");
  assert.equal(diagnostics.length, 0);
});

test("an initialize-time canvas failure cannot strand the pending HD record", async () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  const context = createContext();
  let smoothingWrites = 0;
  Object.defineProperty(context, "imageSmoothingEnabled", {
    configurable: true,
    get: () => false,
    set() {
      smoothingWrites += 1;
      if (smoothingWrites === 2) throw new Error("mode setter failed");
    }
  });
  let loadCalls = 0;
  const controller = renderer.createGraphicsController({
    canvas,
    context,
    loader: {
      loadAssets() {
        loadCalls += 1;
        return successResult(new Map());
      }
    },
    manifest: [],
    renderHD() {},
    renderLegacy() {}
  });

  assert.throws(() => controller.initialize(true), /mode setter failed/);
  const timeoutSentinel = Symbol("pending record remained stranded");
  const retryOutcome = await Promise.race([
    controller.initialize(true),
    new Promise((resolve) => setImmediate(() => resolve(timeoutSentinel)))
  ]);

  assert.notStrictEqual(retryOutcome, timeoutSentinel);
  assert.equal(retryOutcome.mode, "hd");
  assert.equal(controller.getMode(), "hd");
  assert.equal(canvas.width, 576);
  assert.equal(loadCalls, 1, "the failed mode switch never invoked the loader");
});

test("HD width-setter reentry reconciles to the newer legacy presentation", async () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  let intrinsicWidth = 999;
  let intrinsicHeight = 999;
  let armed = false;
  let triggered = false;
  let controller;
  let newerLegacyOutcome;
  Object.defineProperties(canvas, {
    width: {
      configurable: true,
      get: () => intrinsicWidth,
      set(value) {
        intrinsicWidth = value;
        if (armed && value === 576 && !triggered) {
          triggered = true;
          newerLegacyOutcome = controller.initialize(false);
        }
      }
    },
    height: {
      configurable: true,
      get: () => intrinsicHeight,
      set(value) {
        intrinsicHeight = value;
      }
    }
  });
  const context = createContext();
  const frames = [];
  const diagnostics = [];
  controller = renderer.createGraphicsController({
    canvas,
    context,
    loader: {
      loadAssets() {
        armed = true;
        return successResult(new Map());
      }
    },
    manifest: [],
    renderHD() {
      frames.push("hd");
    },
    renderLegacy() {
      frames.push("legacy");
    },
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });

  const oldOutcome = await controller.initialize(true);
  const repeatedLegacy = controller.initialize(false);
  controller.render(Object.freeze({ id: "legacy" }));

  assert.equal(oldOutcome.stale, true);
  assert.equal(oldOutcome.mode, "legacy");
  assert.strictEqual(repeatedLegacy, newerLegacyOutcome);
  assert.equal(typeof repeatedLegacy.then, "undefined");
  assert.equal(controller.getMode(), "legacy");
  assert.equal(canvas.width, 144);
  assert.equal(canvas.height, 144);
  assert.equal(context.imageSmoothingEnabled, false);
  assert.equal(canvas.dataset.graphicsMode, "legacy");
  assert.equal(canvas.classList.contains("graphics-legacy"), true);
  assert.equal(canvas.classList.contains("graphics-hd"), false);
  assert.deepEqual(frames, ["legacy"]);
  assert.equal(diagnostics.length, 0);
});

test("HD smoothing-setter reentry is reconciled and cannot publish stale success", async () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  const context = createContext();
  let smoothing = true;
  let armed = false;
  let triggered = false;
  let controller;
  let newerLegacyOutcome;
  Object.defineProperty(context, "imageSmoothingEnabled", {
    configurable: true,
    get: () => smoothing,
    set(value) {
      smoothing = value;
      if (armed && !triggered) {
        triggered = true;
        newerLegacyOutcome = controller.initialize(false);
      }
    }
  });
  controller = renderer.createGraphicsController({
    canvas,
    context,
    loader: {
      loadAssets() {
        armed = true;
        return successResult(new Map());
      }
    },
    manifest: [],
    renderHD() {},
    renderLegacy() {}
  });

  const oldOutcome = await controller.initialize(true);

  assert.equal(oldOutcome.stale, true);
  assert.equal(oldOutcome.mode, "legacy");
  assert.strictEqual(controller.initialize(false), newerLegacyOutcome);
  assert.equal(controller.getMode(), "legacy");
  assert.equal(canvas.width, 144);
  assert.equal(canvas.height, 144);
  assert.equal(context.imageSmoothingEnabled, false);
  assert.equal(canvas.dataset.graphicsMode, "legacy");
  assert.equal(canvas.classList.contains("graphics-legacy"), true);
  assert.equal(canvas.classList.contains("graphics-hd"), false);
});

test("failure-mode apply reentry suppresses obsolete failure publication and diagnostics", async () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  const context = createContext();
  let smoothing = true;
  let armed = false;
  let triggered = false;
  let controller;
  let newerLegacyOutcome;
  Object.defineProperty(context, "imageSmoothingEnabled", {
    configurable: true,
    get: () => smoothing,
    set(value) {
      smoothing = value;
      if (armed && !triggered) {
        triggered = true;
        newerLegacyOutcome = controller.initialize(false);
      }
    }
  });
  const diagnostics = [];
  controller = renderer.createGraphicsController({
    canvas,
    context,
    loader: {
      loadAssets() {
        armed = true;
        return {
          ready: false,
          fallbackRequired: true,
          loaded: new Map(),
          failures: [{ key: "critical.asset", critical: true, reason: "timeout" }]
        };
      }
    },
    manifest: [],
    renderHD() {},
    renderLegacy() {},
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });

  const oldOutcome = await controller.initialize(true);

  assert.equal(oldOutcome.stale, true);
  assert.equal(oldOutcome.mode, "legacy");
  assert.strictEqual(controller.initialize(false), newerLegacyOutcome);
  assert.equal(controller.getMode(), "legacy");
  assert.equal(canvas.width, 144);
  assert.equal(canvas.height, 144);
  assert.equal(context.imageSmoothingEnabled, false);
  assert.equal(canvas.dataset.graphicsMode, "legacy");
  assert.equal(canvas.classList.contains("graphics-legacy"), true);
  assert.equal(canvas.classList.contains("graphics-hd"), false);
  assert.equal(diagnostics.length, 0);
});

test("diagnostic callback reentry preserves the newer outcome after callback return", async () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  const diagnostics = [];
  let controller;
  let newerLegacyOutcome;
  controller = renderer.createGraphicsController({
    canvas,
    context: createContext(),
    loader: {
      loadAssets() {
        return {
          ready: false,
          fallbackRequired: true,
          loaded: new Map(),
          failures: [{ key: "critical.asset", critical: true, reason: "timeout" }]
        };
      }
    },
    manifest: [],
    renderHD() {},
    renderLegacy() {},
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
      if (diagnostics.length === 1) newerLegacyOutcome = controller.initialize(false);
    }
  });

  const oldOutcome = await controller.initialize(true);
  const repeatedLegacy = controller.initialize(false);

  assert.equal(diagnostics.length, 1);
  assert.equal(oldOutcome.stale, true);
  assert.equal(oldOutcome.mode, "legacy");
  assert.strictEqual(repeatedLegacy, newerLegacyOutcome);
  assert.equal(typeof repeatedLegacy.then, "undefined");
  assert.equal(controller.getMode(), "legacy");
  assert.equal(canvas.width, 144);
  assert.equal(canvas.height, 144);
  assert.equal(canvas.dataset.graphicsMode, "legacy");
  assert.equal(canvas.classList.contains("graphics-legacy"), true);
  assert.equal(canvas.classList.contains("graphics-hd"), false);
});

test("a stale interrupted HD apply still reconciles the newer legacy presentation", async () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  let intrinsicWidth = 999;
  let intrinsicHeight = 999;
  let armed = false;
  let triggered = false;
  let controller;
  let newerLegacyOutcome;
  Object.defineProperties(canvas, {
    width: {
      configurable: true,
      get: () => intrinsicWidth,
      set(value) {
        intrinsicWidth = value;
        if (armed && value === 576 && !triggered) {
          triggered = true;
          newerLegacyOutcome = controller.initialize(false);
        }
      }
    },
    height: {
      configurable: true,
      get: () => intrinsicHeight,
      set(value) {
        if (armed && value === 576) throw new Error("HD height rejected");
        intrinsicHeight = value;
      }
    }
  });
  const context = createContext();
  controller = renderer.createGraphicsController({
    canvas,
    context,
    loader: {
      loadAssets() {
        armed = true;
        return successResult(new Map());
      }
    },
    manifest: [],
    renderHD() {},
    renderLegacy() {}
  });

  const oldOutcome = await controller.initialize(true);

  assert.equal(oldOutcome.stale, true);
  assert.equal(oldOutcome.mode, "legacy");
  assert.strictEqual(controller.initialize(false), newerLegacyOutcome);
  assert.equal(controller.getMode(), "legacy");
  assert.equal(canvas.width, 144);
  assert.equal(canvas.height, 144);
  assert.equal(context.imageSmoothingEnabled, false);
  assert.equal(canvas.dataset.graphicsMode, "legacy");
  assert.equal(canvas.classList.contains("graphics-legacy"), true);
  assert.equal(canvas.classList.contains("graphics-hd"), false);
});

test("same-cause fallback reentry from diagnostics is exactly idempotent", () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  const cause = new Error("runtime render failure");
  const diagnostics = [];
  let controller;
  let reentrantOutcome;
  controller = renderer.createGraphicsController({
    canvas,
    context: createContext(),
    loader: { loadAssets: () => successResult(new Map()) },
    manifest: [],
    renderHD() {},
    renderLegacy() {},
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
      if (diagnostics.length === 1) reentrantOutcome = controller.fallback(cause);
    }
  });

  const outerOutcome = controller.fallback(cause);

  assert.equal(diagnostics.length, 1);
  assert.strictEqual(reentrantOutcome, outerOutcome);
  assert.strictEqual(controller.fallback(cause), outerOutcome);
  assert.equal(outerOutcome.stale, false);
  assert.equal(outerOutcome.mode, "legacy");
  assert.equal(controller.getMode(), "legacy");
  assert.equal(canvas.width, 144);
  assert.equal(canvas.height, 144);
  assert.equal(canvas.dataset.graphicsMode, "legacy");
  assert.equal(canvas.classList.contains("graphics-legacy"), true);
  assert.equal(canvas.classList.contains("graphics-hd"), false);
});

test("same-cause fallback retries presentation after an interrupted apply", async () => {
  const renderer = loadRenderer();
  const canvas = createCanvas();
  const context = createContext();
  let smoothing = true;
  let rejectNextSmoothingWrite = false;
  Object.defineProperty(context, "imageSmoothingEnabled", {
    configurable: true,
    get: () => smoothing,
    set(value) {
      if (rejectNextSmoothingWrite) {
        rejectNextSmoothingWrite = false;
        throw new Error("smoothing write rejected");
      }
      smoothing = value;
    }
  });
  const cause = new Error("runtime render failure");
  const diagnostics = [];
  const controller = renderer.createGraphicsController({
    canvas,
    context,
    loader: { loadAssets: () => successResult(new Map()) },
    manifest: [],
    renderHD() {},
    renderLegacy() {},
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });
  await controller.initialize(true);
  rejectNextSmoothingWrite = true;

  assert.throws(() => controller.fallback(cause), /smoothing write rejected/);
  const retryOutcome = controller.fallback(cause);

  assert.equal(retryOutcome.stale, false);
  assert.equal(retryOutcome.mode, "legacy");
  assert.strictEqual(controller.fallback(cause), retryOutcome);
  assert.equal(diagnostics.length, 1);
  assert.equal(controller.getMode(), "legacy");
  assert.equal(canvas.width, 144);
  assert.equal(canvas.height, 144);
  assert.equal(context.imageSmoothingEnabled, false);
  assert.equal(canvas.dataset.graphicsMode, "legacy");
  assert.equal(canvas.classList.contains("graphics-legacy"), true);
  assert.equal(canvas.classList.contains("graphics-hd"), false);
});

test("repeated initialization, rendering, and explicit fallback are idempotent and state-safe", async () => {
  const renderer = loadRenderer();
  const load = deferred();
  let loadCalls = 0;
  const diagnostics = [];
  const snapshots = [];
  const canvas = createCanvas();
  const controller = renderer.createGraphicsController({
    canvas,
    context: createContext(),
    loader: {
      loadAssets() {
        loadCalls += 1;
        return load.promise;
      }
    },
    manifest: [],
    renderHD(snapshot) {
      snapshots.push(snapshot);
    },
    renderLegacy(snapshot) {
      snapshots.push(snapshot);
    },
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });
  const simulation = Object.freeze({ turn: 7, player: Object.freeze({ hp: 10 }) });
  const snapshot = Object.freeze({ simulationMarker: simulation });

  const firstInitialization = controller.initialize(true);
  const duplicateInitialization = controller.initialize(true);
  assert.strictEqual(duplicateInitialization, firstInitialization);
  assert.equal(loadCalls, 1);
  load.resolve(successResult());
  await firstInitialization;
  await controller.initialize(true);
  assert.equal(loadCalls, 1, "completed initialization is reused");

  controller.render(snapshot);
  assert.strictEqual(snapshots[0], snapshot);
  assert.deepEqual(simulation, { turn: 7, player: { hp: 10 } });

  const fallbackReason = new Error("manual fallback");
  controller.fallback(fallbackReason);
  controller.fallback(fallbackReason);
  controller.render(snapshot);

  assert.equal(controller.getMode(), "legacy");
  assert.equal(canvas.width, 144);
  assert.equal(diagnostics.length, 1);
  assert.strictEqual(snapshots[1], snapshot);
  assert.deepEqual(simulation, { turn: 7, player: { hp: 10 } });
});

test("both renderer files support CommonJS and browser UMD attachment", () => {
  const commonJsLayers = loadLayers();
  const commonJsRenderer = loadRenderer();
  assert.equal(typeof commonJsLayers.renderLayers, "function");
  assert.equal(typeof commonJsRenderer.createGraphicsController, "function");

  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(layersPath, "utf8"), context, { filename: layersPath });
  vm.runInContext(fs.readFileSync(rendererPath, "utf8"), context, { filename: rendererPath });

  assert.equal(typeof context.window.DungeonHDRendererLayers.renderLayers, "function");
  assert.equal(typeof context.window.DungeonHDRenderer.renderHDFrame, "function");
});

test("renderer modules construct no per-frame images and make no audio calls", () => {
  for (const filePath of [layersPath, rendererPath]) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.doesNotMatch(source, /\bnew\s+Image\s*\(/);
    assert.doesNotMatch(source, /\bnew\s+Audio\s*\(/);
    assert.doesNotMatch(source, /\.play\s*\(/);
  }
});

test("shipping config enables HD and game loads the complete controller dependency boundary", () => {
  const configSource = fs.readFileSync(path.join(projectRoot, "config.js"), "utf8");
  const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const gameSource = fs.readFileSync(path.join(projectRoot, "game.js"), "utf8");
  const scripts = [
    "render/hd-asset-manifest.js",
    "render/hd-asset-loader.js",
    "render/hd-vfx.js",
    "render/hd-lighting.js",
    "render/hd-renderer-layers.js",
    "render/hd-renderer.js",
    "game.js"
  ];
  const indices = scripts.map((script) => indexHtml.indexOf(`<script src="${script}"></script>`));

  assert.match(configSource, /window\.DUNGEON_HD_GRAPHICS_ENABLED\s*=\s*true\s*;/);
  assert.ok(indices.every((index) => index >= 0), "all renderer scripts are loaded");
  assert.deepEqual([...indices].sort((a, b) => a - b), indices, "renderer dependencies load in order");
  assert.match(gameSource, /createGraphicsController\s*\(/);
  assert.match(gameSource, /initializeGraphicsMode\s*\(/);
  assert.match(gameSource, /graphicsController\.render\(snapshot\)/);
  assert.match(gameSource, /DUNGEON_HD_GRAPHICS_ENABLED/);
  assert.doesNotMatch(gameSource, /DUNGEON_HD_GRAPHICS_ENABLED\s*\|\|\s*true/);
});

test("game-level emergency fallback restores legacy canvas pixel invariants", () => {
  const gameSource = fs.readFileSync(path.join(projectRoot, "game.js"), "utf8");
  const helperMatch = gameSource.match(
    /function resetLegacyCanvasMode\s*\(\)\s*{([\s\S]*?)\n\s{2}}/
  );
  assert.ok(helperMatch, "game.js defines one centralized legacy canvas reset");
  assert.ok(
    (gameSource.match(/resetLegacyCanvasMode\(\);/g) || []).length >= 2,
    "missing-module and controller-construction failures share the reset"
  );

  const context = { imageSmoothingEnabled: true };
  const canvas = createCanvas();
  let intrinsicWidth = 576;
  let intrinsicHeight = 576;
  Object.defineProperties(canvas, {
    width: {
      configurable: true,
      get: () => intrinsicWidth,
      set(value) {
        intrinsicWidth = value;
        context.imageSmoothingEnabled = true;
      }
    },
    height: {
      configurable: true,
      get: () => intrinsicHeight,
      set(value) {
        intrinsicHeight = value;
        context.imageSmoothingEnabled = true;
      }
    }
  });
  const resetLegacyCanvasMode = new Function(
    "canvas",
    "ctx",
    "CANVAS_SIZE",
    helperMatch[1]
  );

  resetLegacyCanvasMode(canvas, context, 144);

  assert.equal(canvas.width, 144);
  assert.equal(canvas.height, 144);
  assert.equal(context.imageSmoothingEnabled, false);
  assert.equal(canvas.dataset.graphicsMode, "legacy");
  assert.equal(canvas.classList.contains("graphics-legacy"), true);
  assert.equal(canvas.classList.contains("graphics-hd"), false);
});
