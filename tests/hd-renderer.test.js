const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const layersPath = path.join(projectRoot, "render", "hd-renderer-layers.js");
const rendererPath = path.join(projectRoot, "render", "hd-renderer.js");

function loadLayers() {
  return require(layersPath);
}

function loadRenderer() {
  delete require.cache[require.resolve(rendererPath)];
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
    imageSmoothingEnabled: true,
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

function successResult(assets = new Map([["critical.asset", { id: "critical" }]])) {
  return {
    ready: true,
    fallbackRequired: false,
    loaded: assets,
    failures: []
  };
}

function criticalFailureResult() {
  return {
    ready: false,
    fallbackRequired: true,
    loaded: new Map(),
    failures: [{
      key: "critical.asset",
      src: "assets/hd/critical.png",
      critical: true,
      reason: "timeout"
    }]
  };
}

function createController(options = {}) {
  const renderer = loadRenderer();
  const canvas = options.canvas || createCanvas();
  const context = options.context || createContext();
  const diagnostics = [];
  const frames = [];
  const manifest = options.manifest === undefined
    ? [{ key: "critical.asset", src: "assets/hd/critical.png", group: "test", critical: true }]
    : options.manifest;
  const loader = options.loader === undefined
    ? { loadAssets: async () => successResult() }
    : options.loader;
  const controller = renderer.createGraphicsController({
    canvas,
    context,
    loader,
    manifest,
    renderHD(snapshot, receivedContext, assets) {
      frames.push({ snapshot, context: receivedContext, assets });
    },
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });
  return { renderer, canvas, context, diagnostics, frames, controller };
}

test("uses a 64 px, 9 by 9 world with checked grid coordinates", () => {
  const api = loadRenderer();
  assert.equal(api.TILE_SIZE, 64);
  assert.equal(api.GRID_SIZE, 9);
  assert.equal(api.WORLD_SIZE, 576);
  assert.deepEqual(api.gridToScreen(0, 0), { x: 0, y: 0 });
  assert.deepEqual(api.gridToScreen(8, 8), { x: 512, y: 512 });
  for (const invalid of [[-1, 0], [0, -1], [9, 0], [0, 9], [1.5, 2], [2, Number.NaN]]) {
    assert.throws(() => api.gridToScreen(...invalid), /grid|coordinate|integer|range/i);
  }
});

test("bottom-center anchoring lets large bosses overhang one logical tile", () => {
  const api = loadRenderer();
  assert.deepEqual(api.BOTTOM_CENTER_ANCHOR, { x: 0.5, y: 1 });
  assert.deepEqual(api.getAnchoredDestinationRect(4, 4, 128, 128), {
    x: 224, y: 192, width: 128, height: 128
  });
  assert.deepEqual(api.getAnchoredDestinationRect(4, 4, 192, 192), {
    x: 192, y: 128, width: 192, height: 192
  });
  assert.throws(() => api.getAnchoredDestinationRect(4, 4, 0, 128), /width|size/i);
});

test("clears the HD world and invokes isolated layers in the approved order", () => {
  const renderer = loadRenderer();
  const expectedOrder = ["floor", "decals", "hazards", "objects", "telegraphs", "vfx", "enemies", "player", "lighting"];
  const events = [];
  const context = createContext(events);
  const snapshot = Object.freeze({ marker: "visual-only" });
  const assets = new Map([["actor.player.south.idle", { id: "player" }]]);
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
  assert.deepEqual(events[0], ["clearRect", 0, 0, 576, 576]);
  assert.deepEqual(events.slice(1), expectedOrder.flatMap((name) => [["save"], ["layer", name], ["restore"]]));
});

test("restores canvas state even when an HD layer throws", () => {
  const renderer = loadRenderer();
  const events = [];
  const context = createContext(events);
  const layers = Object.fromEntries(renderer.LAYER_ORDER.map((name) => [name, () => {}]));
  layers.hazards = () => {
    events.push(["layer", "hazards"]);
    throw new Error("layer failed");
  };
  assert.throws(() => renderer.renderHDFrame({}, context, new Map(), layers), /layer failed/);
  assert.deepEqual(events.slice(-2), [["layer", "hazards"], ["restore"]]);
});

test("controller presents HD before assets resolve and renders with a safe empty Map", async () => {
  const pending = deferred();
  const run = createController({ loader: { loadAssets: () => pending.promise } });
  assert.equal(run.controller.getMode(), "hd");
  assert.equal(run.canvas.width, 576);
  assert.equal(run.canvas.height, 576);
  assert.equal(run.canvas.dataset.graphicsMode, "hd");
  assert.equal(run.canvas.classList.contains("graphics-hd"), true);
  assert.equal(run.canvas.classList.contains("graphics-legacy"), false);
  assert.equal(run.context.imageSmoothingEnabled, false);

  const initialization = run.controller.initialize();
  run.controller.render({ id: "pending" });
  assert.ok(run.frames[0].assets instanceof Map);
  assert.equal(run.frames[0].assets.size, 0);

  pending.resolve(successResult());
  const outcome = await initialization;
  assert.equal(outcome.mode, "hd");
  assert.equal(outcome.ready, true);
  run.controller.render({ id: "ready" });
  assert.equal(run.frames[1].assets.has("critical.asset"), true);
});

test("initialize false cannot select Classic and still loads HD", async () => {
  let loads = 0;
  const run = createController({
    loader: {
      async loadAssets() {
        loads += 1;
        return successResult();
      }
    }
  });
  const outcome = await run.controller.initialize(false);
  assert.equal(loads, 1);
  assert.equal(outcome.mode, "hd");
  assert.equal(outcome.ready, true);
  assert.equal(run.controller.getMode(), "hd");
  assert.equal(run.canvas.width, 576);
});

test("controller does not require or expose a legacy renderer", () => {
  const run = createController();
  assert.equal(typeof run.controller.fallback, "undefined");
  run.controller.render({ id: "hd-only" });
  assert.equal(run.frames.length, 1);
  assert.ok(run.frames[0].assets instanceof Map);
});

test("critical asset failure remains HD and reports fail-closed status", async () => {
  const run = createController({ loader: { loadAssets: async () => criticalFailureResult() } });
  const outcome = await run.controller.initialize();
  assert.equal(outcome.mode, "hd");
  assert.equal(outcome.ready, false);
  assert.equal(run.controller.getMode(), "hd");
  assert.equal(run.canvas.width, 576);
  assert.equal(run.canvas.dataset.graphicsMode, "hd");
  assert.equal(run.diagnostics.length, 1);
  assert.equal(run.diagnostics[0].code, "hd-assets-unavailable");
  assert.match(run.diagnostics[0].message, /HD assets|critical\.asset|timeout/i);
  run.controller.render({ id: "after-failure" });
  assert.ok(run.frames[0].assets instanceof Map);
});

test("failed preload preserves safe partial HD assets for fail-closed rendering", async () => {
  const partial = Object.freeze({ id: "partial" });
  const result = criticalFailureResult();
  result.loaded.set("optional.partial", partial);
  const run = createController({ loader: { loadAssets: async () => result } });
  const outcome = await run.controller.initialize();
  run.controller.render({ id: "partial-frame" });
  assert.equal(outcome.ready, false);
  assert.strictEqual(run.frames[0].assets.get("optional.partial"), partial);
});

test("sparse manifests and sparse failure arrays fail closed", async () => {
  const sparseManifest = createController({
    manifest: new Array(1),
    loader: { loadAssets: async () => successResult(new Map()) }
  });
  const manifestOutcome = await sparseManifest.controller.initialize();
  assert.equal(manifestOutcome.ready, false);
  assert.equal(sparseManifest.diagnostics[0].code, "hd-assets-unavailable");

  const sparseFailures = createController({
    manifest: [],
    loader: {
      loadAssets: async () => ({
        ready: true,
        fallbackRequired: false,
        loaded: new Map(),
        failures: new Array(1)
      })
    }
  });
  const failuresOutcome = await sparseFailures.controller.initialize();
  assert.equal(failuresOutcome.ready, false);
  assert.equal(sparseFailures.diagnostics[0].code, "hd-assets-unavailable");
});

test("presentation failure during async completion settles as an HD failure", async () => {
  const canvas = createCanvas();
  let smoothing = true;
  let armed = false;
  const context = createContext();
  Object.defineProperty(context, "imageSmoothingEnabled", {
    configurable: true,
    get: () => smoothing,
    set(value) {
      if (armed) throw new Error("smoothing denied");
      smoothing = value;
    }
  });
  const pending = deferred();
  const run = createController({ canvas, context, loader: { loadAssets: () => pending.promise } });
  const initialization = run.controller.initialize();
  armed = true;
  pending.resolve(successResult());
  const outcome = await Promise.race([
    initialization,
    new Promise((_, reject) => setTimeout(() => reject(new Error("initialization did not settle")), 100))
  ]);
  assert.equal(outcome.mode, "hd");
  assert.equal(outcome.ready, false);
  assert.equal(run.diagnostics[0].code, "hd-assets-unavailable");
});

test("presentation setter reentry shares the current initialization", async () => {
  const canvas = createCanvas();
  let width = canvas.width;
  let armed = false;
  let reentered = null;
  let controller;
  let loads = 0;
  Object.defineProperty(canvas, "width", {
    configurable: true,
    get: () => width,
    set(value) {
      if (armed && !reentered) reentered = controller.initialize(false);
      width = value;
    }
  });
  const run = createController({
    canvas,
    loader: {
      async loadAssets() {
        loads += 1;
        return successResult();
      }
    }
  });
  controller = run.controller;
  width = 144;
  armed = true;
  const initialization = controller.initialize();
  const outcome = await initialization;
  assert.strictEqual(reentered, initialization);
  assert.equal(loads, 1);
  assert.equal(outcome.ready, true);
  assert.equal(controller.getMode(), "hd");
  assert.equal(canvas.width, 576);
});
test("hostile loader rejection values cannot strand initialization", async () => {
  const hostile = {};
  Object.defineProperty(hostile, "message", {
    get() {
      throw new Error("message getter denied");
    }
  });
  const run = createController({
    loader: { loadAssets: async () => { throw hostile; } }
  });
  const outcome = await Promise.race([
    run.controller.initialize(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("initialization did not settle")), 100))
  ]);
  assert.equal(outcome.mode, "hd");
  assert.equal(outcome.ready, false);
  assert.equal(run.diagnostics[0].code, "hd-assets-unavailable");
});

test("loader exceptions and malformed results stay inside the HD failure boundary", async () => {
  const cases = [
    { loadAssets: async () => { throw new Error("network down"); } },
    { loadAssets: async () => null },
    { loadAssets: async () => ({ ready: true, fallbackRequired: false, loaded: {}, failures: [] }) },
    null
  ];
  for (const loader of cases) {
    const run = createController({ loader });
    const outcome = await run.controller.initialize();
    assert.equal(outcome.mode, "hd");
    assert.equal(outcome.ready, false);
    assert.equal(run.controller.getMode(), "hd");
    assert.equal(run.canvas.width, 576);
    assert.equal(run.diagnostics[0].code, "hd-assets-unavailable");
  }
});

test("missing or invalid critical assets fail closed without changing presentation", async () => {
  const invalidValues = [undefined, null, 0, false, "not-an-image", []];
  for (const value of invalidValues) {
    const run = createController({
      loader: { loadAssets: async () => successResult(new Map([["critical.asset", value]])) }
    });
    const outcome = await run.controller.initialize();
    assert.equal(outcome.mode, "hd", String(value));
    assert.equal(outcome.ready, false, String(value));
    assert.equal(run.canvas.dataset.graphicsMode, "hd", String(value));
    assert.equal(run.diagnostics[0].code, "hd-assets-unavailable", String(value));
  }

  const missing = createController({
    loader: { loadAssets: async () => successResult(new Map()) }
  });
  const outcome = await missing.controller.initialize();
  assert.equal(outcome.mode, "hd");
  assert.equal(outcome.ready, false);
  assert.match(missing.diagnostics[0].message, /critical\.asset|HD assets/i);
});

test("optional failures coexist with a ready HD result", async () => {
  const result = successResult();
  result.failures.push({
    key: "optional.asset",
    src: "assets/hd/optional.png",
    critical: false,
    reason: "error"
  });
  const run = createController({ loader: { loadAssets: async () => result } });
  const outcome = await run.controller.initialize();
  assert.equal(outcome.mode, "hd");
  assert.equal(outcome.ready, true);
  assert.equal(run.diagnostics.length, 0);
});

test("loader results are snapshotted before caller mutation reaches frames", async () => {
  const asset = Object.freeze({ id: "critical" });
  const loaded = new Map([["critical.asset", asset]]);
  const failures = [];
  const source = { ready: true, fallbackRequired: false, loaded, failures };
  const run = createController({ loader: { loadAssets: async () => source } });
  const outcome = await run.controller.initialize();
  loaded.clear();
  failures.push({ key: "critical.asset", critical: true, reason: "late mutation" });
  run.controller.render({ id: "snapshot" });
  assert.equal(outcome.ready, true);
  assert.notStrictEqual(outcome.result, source);
  assert.notStrictEqual(outcome.result.loaded, loaded);
  assert.equal(Object.isFrozen(outcome.result), true);
  assert.equal(Object.isFrozen(outcome.result.failures), true);
  assert.strictEqual(run.frames[0].assets.get("critical.asset"), asset);
});

test("concurrent initialization shares one pending HD load", async () => {
  const pending = deferred();
  let loads = 0;
  const run = createController({
    loader: {
      loadAssets() {
        loads += 1;
        return pending.promise;
      }
    }
  });
  const first = run.controller.initialize(true);
  const second = run.controller.initialize(false);
  assert.strictEqual(second, first);
  assert.equal(loads, 1);
  pending.resolve(successResult());
  const [a, b] = await Promise.all([first, second]);
  assert.strictEqual(a, b);
  assert.equal(a.ready, true);
  assert.equal(run.controller.getMode(), "hd");
});

test("repeated initialization and rendering remain idempotent", async () => {
  let loads = 0;
  const run = createController({
    loader: {
      async loadAssets() {
        loads += 1;
        return successResult();
      }
    }
  });
  const first = await run.controller.initialize();
  const second = await run.controller.initialize(false);
  run.controller.render({ turn: 1 });
  run.controller.render({ turn: 2 });
  assert.equal(loads, 1);
  assert.strictEqual(second, first);
  assert.deepEqual(run.frames.map((frame) => frame.snapshot.turn), [1, 2]);
  assert.strictEqual(run.frames[0].assets, run.frames[1].assets);
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
    assert.doesNotMatch(source, /\bnew\s+Image\s*\(/u);
    assert.doesNotMatch(source, /\bnew\s+Audio\s*\(/u);
    assert.doesNotMatch(source, /\.play\s*\(/u);
  }
});

test("graphics controller source contains no Classic mode or fallback API", () => {
  const source = fs.readFileSync(rendererPath, "utf8");
  assert.doesNotMatch(source, /renderLegacy|LEGACY_WORLD_SIZE|applyMode\("legacy"\)|mode\s*=\s*"legacy"/u);
  assert.doesNotMatch(source, /\bfallback\s*[,}]/u);
  assert.match(source, /code:\s*"hd-assets-unavailable"/u);
});
