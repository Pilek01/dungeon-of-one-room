(function attachHDRenderer(root, factory) {
  const layersApi = typeof module === "object" && module.exports ? require("./hd-renderer-layers.js") : root && root.DungeonHDRendererLayers;
  const api = factory(layersApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DungeonHDRenderer = api;
})(typeof window !== "undefined" ? window : null, function createHDRendererApi(layersApi) {
  "use strict";
  if (!layersApi || !Array.isArray(layersApi.LAYER_ORDER) || typeof layersApi.renderLayers !== "function") throw new Error("DungeonHDRendererLayers must load before DungeonHDRenderer");
  const TILE_SIZE = 64;
  const GRID_SIZE = 9;
  const WORLD_SIZE = TILE_SIZE * GRID_SIZE;
  const LAYER_ORDER = layersApi.LAYER_ORDER;
  const BOTTOM_CENTER_ANCHOR = Object.freeze({ x: 0.5, y: 1 });
  function assertGridCoordinate(value, name) {
    if (!Number.isInteger(value) || value < 0 || value >= GRID_SIZE) throw new RangeError(`${name} grid coordinate must be an integer from 0 to ${GRID_SIZE - 1}`);
  }
  function gridToScreen(gridX, gridY) {
    assertGridCoordinate(gridX, "x");
    assertGridCoordinate(gridY, "y");
    return { x: gridX * TILE_SIZE, y: gridY * TILE_SIZE };
  }
  function getAnchoredDestinationRect(gridX, gridY, width, height, anchor = BOTTOM_CENTER_ANCHOR) {
    const tile = gridToScreen(gridX, gridY);
    if (!Number.isFinite(width) || width <= 0) throw new RangeError("sprite width must be a positive finite size");
    if (!Number.isFinite(height) || height <= 0) throw new RangeError("sprite height must be a positive finite size");
    if (!anchor || typeof anchor !== "object" || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) throw new TypeError("sprite anchor must have finite x and y values");
    return { x: tile.x + TILE_SIZE * 0.5 - width * anchor.x, y: tile.y + TILE_SIZE - height * anchor.y, width, height };
  }
  function renderHDFrame(snapshot, context, assets, layers = layersApi.DEFAULT_LAYERS) {
    if (!snapshot || typeof snapshot !== "object") throw new TypeError("HD rendering requires a visual snapshot");
    if (!context || typeof context.clearRect !== "function") throw new TypeError("HD rendering requires a canvas context");
    if (!(assets instanceof Map)) throw new TypeError("HD rendering requires a loaded asset Map");
    context.clearRect(0, 0, WORLD_SIZE, WORLD_SIZE);
    layersApi.renderLayers(context, snapshot, assets, layers);
  }
  function createGraphicsController(options) {
    const source = options && typeof options === "object" ? options : {};
    const canvas = source.canvas;
    const context = source.context;
    const loader = source.loader;
    const manifest = source.manifest;
    const loaderOptions = source.loaderOptions;
    const renderHD = source.renderHD === undefined ? renderHDFrame : source.renderHD;
    const onDiagnostic = source.onDiagnostic;
    if (!canvas || typeof canvas !== "object") throw new TypeError("graphics controller requires an injected canvas");
    if (!context || typeof context !== "object") throw new TypeError("graphics controller requires an injected canvas context");
    if (typeof renderHD !== "function") throw new TypeError("renderHD must be a function");
    if (onDiagnostic !== undefined && typeof onDiagnostic !== "function") throw new TypeError("onDiagnostic must be a function");
    let mode = "hd";
    let loadedAssets = new Map();
    let generation = 0;
    let pendingInitialization = null;
    let requested = false;
    let lastOutcome = null;
    function writePresentation() {
      if (canvas.width !== WORLD_SIZE) canvas.width = WORLD_SIZE;
      if (canvas.height !== WORLD_SIZE) canvas.height = WORLD_SIZE;
      context.imageSmoothingEnabled = false;
      if (canvas.dataset && typeof canvas.dataset === "object") canvas.dataset.graphicsMode = "hd";
      if (canvas.classList && typeof canvas.classList.toggle === "function") {
        canvas.classList.toggle("graphics-hd", true);
        canvas.classList.toggle("graphics-legacy", false);
      }
    }
    function status(extra) { return Object.freeze(Object.assign({ mode: "hd", stale: false }, extra)); }
    function reportDiagnostic(diagnostic) { if (onDiagnostic) { try { onDiagnostic(Object.freeze(diagnostic)); } catch (_) {} } }
    function describeCause(cause) {
      if (!cause) return "";
      try {
        const message = typeof cause.message === "string" ? cause.message : "";
        return message ? ` (${message})` : "";
      } catch (_) {
        return " (unreadable error)";
      }
    }
    function isCurrent(token, record) { return token === generation && pendingInitialization === record; }
    function criticalKeys(candidate) {
      if (!Array.isArray(candidate)) throw new TypeError("HD asset manifest must be an array");
      const keys = [];
      for (let index = 0; index < candidate.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(candidate, index)) {
          throw new TypeError(`HD asset manifest entry ${index} must be present`);
        }
        const asset = candidate[index];
        if (!asset || typeof asset !== "object" || Array.isArray(asset)) throw new TypeError(`HD asset manifest entry ${index} must be an object`);
        if (asset.critical === true) {
          if (typeof asset.key !== "string" || asset.key.length === 0) throw new TypeError(`HD critical manifest entry ${index} must have a key`);
          keys.push(asset.key);
        }
      }
      return keys;
    }
    function snapshotResult(candidate) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new TypeError("HD asset loader returned a malformed result");
      if (typeof candidate.ready !== "boolean" || typeof candidate.fallbackRequired !== "boolean") throw new TypeError("HD asset loader ready and fallbackRequired flags must be booleans");
      if (!(candidate.loaded instanceof Map)) throw new TypeError("HD asset loader result.loaded must be a Map");
      if (!Array.isArray(candidate.failures)) throw new TypeError("HD asset loader result.failures must be an array");
      const failures = new Array(candidate.failures.length);
      for (let index = 0; index < candidate.failures.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(candidate.failures, index)) {
          throw new TypeError(`HD asset loader failure ${index} must be present`);
        }
        const failure = candidate.failures[index];
        if (!failure || typeof failure !== "object" || Array.isArray(failure)) throw new TypeError(`HD asset loader failure ${index} must be an object`);
        if (typeof failure.key !== "string" || !failure.key) throw new TypeError(`HD asset loader failure ${index} key must be a non-empty string`);
        if (typeof failure.critical !== "boolean") throw new TypeError(`HD asset loader failure ${index} critical must be a boolean`);
        if (typeof failure.reason !== "string" || !failure.reason) throw new TypeError(`HD asset loader failure ${index} reason must be a non-empty string`);
        const copy = { key: failure.key, critical: failure.critical, reason: failure.reason };
        if (Object.prototype.hasOwnProperty.call(failure, "src")) { if (typeof failure.src !== "string") throw new TypeError(`HD asset loader failure ${index} src must be a string when present`); copy.src = failure.src; }
        failures[index] = Object.freeze(copy);
      }
      return Object.freeze({ ready: candidate.ready, fallbackRequired: candidate.fallbackRequired, loaded: new Map(candidate.loaded), failures: Object.freeze(failures) });
    }
    function validate(result, required) {
      if (result.ready !== true || result.fallbackRequired !== false) return false;
      if (result.failures.some((failure) => failure.critical)) return false;
      for (const key of required) {
        if (!result.loaded.has(key)) throw new TypeError(`HD asset loader result is missing critical asset: ${key}`);
        const value = result.loaded.get(key);
        const type = typeof value;
        if (value === null || (type !== "object" && type !== "function") || Array.isArray(value)) throw new TypeError(`HD critical asset ${key} must be a non-null object or function`);
      }
      return true;
    }
    function completeFailure(token, record, cause, result) {
      if (!isCurrent(token, record)) return status({ stale: true });
      if (result && result.loaded instanceof Map) loadedAssets = new Map(result.loaded);
      let presentationCause = null;
      try {
        writePresentation();
      } catch (error) {
        presentationCause = error;
      }
      const failureCause = cause || presentationCause;
      const details = result && result.failures && result.failures.length ? ` (${result.failures.map((failure) => `${failure.key}: ${failure.reason}`).join(", ")})` : "";
      const message = `HD assets unavailable${details}${describeCause(failureCause)}`;
      reportDiagnostic({ code: "hd-assets-unavailable", message, cause: failureCause || null, result: result || null });
      const outcome = status({ ready: false, cause: failureCause || null, result: result || null });
      lastOutcome = outcome;
      return outcome;
    }
    function initialize(_enabled) {
      if (requested) { if (pendingInitialization) return pendingInitialization.promise; if (lastOutcome) return Promise.resolve(lastOutcome); }
      requested = true;
      lastOutcome = null;
      const token = ++generation;
      let resolve;
      const promise = new Promise((res) => { resolve = res; });
      const record = { promise };
      pendingInitialization = record;
      let loadResult;
      try {
        writePresentation();
        const required = criticalKeys(manifest);
        if (!loader || typeof loader.loadAssets !== "function") throw new Error("HD asset loader is unavailable");
        loadResult = loader.loadAssets(manifest, loaderOptions);
        Promise.resolve(loadResult).then((raw) => {
          if (!isCurrent(token, record)) return resolve(status({ stale: true }));
          try {
            const result = snapshotResult(raw);
            if (!validate(result, required)) return resolve(completeFailure(token, record, null, result));
            loadedAssets = new Map(result.loaded);
            writePresentation();
            const outcome = status({ ready: true, result });
            lastOutcome = outcome;
            resolve(outcome);
          } catch (error) { resolve(completeFailure(token, record, error, null)); }
        }, (error) => resolve(completeFailure(token, record, error, null))).finally(() => { if (pendingInitialization === record) pendingInitialization = null; });
      } catch (error) { resolve(completeFailure(token, record, error, null)); pendingInitialization = null; }
      return promise;
    }
    function render(snapshot) { renderHD(snapshot, context, loadedAssets instanceof Map ? loadedAssets : new Map()); }
    writePresentation();
    return Object.freeze({ initialize, render, getMode: () => mode });
  }
  return Object.freeze({ TILE_SIZE, GRID_SIZE, WORLD_SIZE, LAYER_ORDER, BOTTOM_CENTER_ANCHOR, gridToScreen, getAnchoredDestinationRect, renderHDFrame, createGraphicsController });
});