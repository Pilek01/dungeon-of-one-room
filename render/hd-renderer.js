(function attachHDRenderer(root, factory) {
  const layersApi = typeof module === "object" && module.exports
    ? require("./hd-renderer-layers.js")
    : root && root.DungeonHDRendererLayers;
  const api = factory(layersApi);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.DungeonHDRenderer = api;
  }
})(typeof window !== "undefined" ? window : null, function createHDRendererApi(layersApi) {
  "use strict";

  if (!layersApi || !Array.isArray(layersApi.LAYER_ORDER) || typeof layersApi.renderLayers !== "function") {
    throw new Error("DungeonHDRendererLayers must load before DungeonHDRenderer");
  }

  const TILE_SIZE = 64;
  const GRID_SIZE = 9;
  const WORLD_SIZE = TILE_SIZE * GRID_SIZE;
  const LEGACY_WORLD_SIZE = 144;
  const LAYER_ORDER = layersApi.LAYER_ORDER;
  const BOTTOM_CENTER_ANCHOR = Object.freeze({ x: 0.5, y: 1 });

  function assertGridCoordinate(value, name) {
    if (!Number.isInteger(value) || value < 0 || value >= GRID_SIZE) {
      throw new RangeError(`${name} grid coordinate must be an integer from 0 to ${GRID_SIZE - 1}`);
    }
  }

  function gridToScreen(gridX, gridY) {
    assertGridCoordinate(gridX, "x");
    assertGridCoordinate(gridY, "y");
    return { x: gridX * TILE_SIZE, y: gridY * TILE_SIZE };
  }

  function getAnchoredDestinationRect(
    gridX,
    gridY,
    width,
    height,
    anchor = BOTTOM_CENTER_ANCHOR
  ) {
    const tile = gridToScreen(gridX, gridY);
    if (!Number.isFinite(width) || width <= 0) {
      throw new RangeError("sprite width must be a positive finite size");
    }
    if (!Number.isFinite(height) || height <= 0) {
      throw new RangeError("sprite height must be a positive finite size");
    }
    if (
      !anchor ||
      typeof anchor !== "object" ||
      !Number.isFinite(anchor.x) ||
      !Number.isFinite(anchor.y)
    ) {
      throw new TypeError("sprite anchor must have finite x and y values");
    }

    return {
      x: tile.x + TILE_SIZE * 0.5 - width * anchor.x,
      y: tile.y + TILE_SIZE - height * anchor.y,
      width,
      height
    };
  }

  function renderHDFrame(snapshot, context, assets, layers = layersApi.DEFAULT_LAYERS) {
    if (!snapshot || typeof snapshot !== "object") {
      throw new TypeError("HD rendering requires a visual snapshot");
    }
    if (!context || typeof context.clearRect !== "function") {
      throw new TypeError("HD rendering requires a canvas context");
    }
    if (!(assets instanceof Map)) {
      throw new TypeError("HD rendering requires a loaded asset Map");
    }

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
    const renderLegacy = source.renderLegacy;
    const onDiagnostic = source.onDiagnostic;

    if (!canvas || typeof canvas !== "object") {
      throw new TypeError("graphics controller requires an injected canvas");
    }
    if (!context || typeof context !== "object") {
      throw new TypeError("graphics controller requires an injected canvas context");
    }
    if (typeof renderHD !== "function") {
      throw new TypeError("renderHD must be a function");
    }
    if (typeof renderLegacy !== "function") {
      throw new TypeError("renderLegacy must be a function");
    }
    if (onDiagnostic !== undefined && typeof onDiagnostic !== "function") {
      throw new TypeError("onDiagnostic must be a function");
    }

    let mode = "legacy";
    let loadedAssets = null;
    let generation = 0;
    let pendingInitialization = null;
    let requestedEnabled = null;
    let lastOutcome = null;
    let lastFallbackCause = null;
    let applyingMode = false;

    function writeModePresentation(presentationMode) {
      const hd = presentationMode === "hd";
      const intrinsicSize = hd ? WORLD_SIZE : LEGACY_WORLD_SIZE;
      if (canvas.width !== intrinsicSize) canvas.width = intrinsicSize;
      if (canvas.height !== intrinsicSize) canvas.height = intrinsicSize;
      context.imageSmoothingEnabled = false;
      if (canvas.dataset && typeof canvas.dataset === "object") {
        canvas.dataset.graphicsMode = presentationMode;
      }
      if (canvas.classList && typeof canvas.classList.toggle === "function") {
        canvas.classList.toggle("graphics-hd", hd);
        canvas.classList.toggle("graphics-legacy", !hd);
      }
    }

    function applyMode(nextMode) {
      mode = nextMode;
      if (applyingMode) return;

      applyingMode = true;
      let appliedMode;
      try {
        do {
          appliedMode = mode;
          writeModePresentation(appliedMode);
        } while (appliedMode !== mode);
      } catch (error) {
        try {
          while (appliedMode !== mode) {
            appliedMode = mode;
            writeModePresentation(appliedMode);
          }
        } catch (_reconciliationError) {
          // Preserve the original apply failure after best-effort reconciliation.
        }
        throw error;
      } finally {
        applyingMode = false;
      }
    }

    function status(nextMode, extra) {
      return Object.freeze(Object.assign({ mode: nextMode, stale: false }, extra));
    }

    function reportDiagnostic(diagnostic) {
      if (!onDiagnostic) return;
      try {
        onDiagnostic(Object.freeze(diagnostic));
      } catch (_error) {
        // Diagnostics must not break rendering or fallback.
      }
    }

    function describeFailures(result) {
      if (!result || !Array.isArray(result.failures) || result.failures.length === 0) return "";
      return result.failures.map((failure) => {
        const key = failure && failure.key ? failure.key : "unknown";
        const reason = failure && failure.reason ? failure.reason : "failure";
        return `${key}: ${reason}`;
      }).join(", ");
    }

    function isCurrentInitialization(token, pendingRecord) {
      return token === generation && pendingInitialization === pendingRecord;
    }

    function completeFailure(token, pendingRecord, cause, result) {
      if (!isCurrentInitialization(token, pendingRecord)) {
        return status(mode, { stale: true });
      }

      loadedAssets = null;
      applyMode("legacy");
      if (!isCurrentInitialization(token, pendingRecord)) {
        return status(mode, { stale: true });
      }
      const failureDetails = describeFailures(result);
      const causeDetails = cause && cause.message ? ` (${cause.message})` : "";
      const message = failureDetails
        ? `HD asset preload requires legacy fallback (${failureDetails})`
        : `HD graphics initialization failed; using the legacy renderer fallback${causeDetails}`;
      reportDiagnostic({
        code: "hd-graphics-fallback",
        message,
        cause: cause || null,
        result: result || null
      });
      if (!isCurrentInitialization(token, pendingRecord)) {
        return status(mode, { stale: true });
      }
      lastOutcome = status("legacy", { cause: cause || null, result: result || null });
      return lastOutcome;
    }

    function collectCriticalAssetKeys(candidate) {
      if (!Array.isArray(candidate)) {
        throw new TypeError("HD asset manifest must be an array");
      }

      const criticalKeys = [];
      for (let index = 0; index < candidate.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(candidate, index)) {
          throw new TypeError(`HD asset manifest entry ${index} must be present`);
        }
        const asset = candidate[index];
        if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
          throw new TypeError(`HD asset manifest entry ${index} must be an object`);
        }
        if (asset.critical === true) {
          if (typeof asset.key !== "string" || asset.key.length === 0) {
            throw new TypeError(`HD critical manifest entry ${index} must have a key`);
          }
          criticalKeys.push(asset.key);
        }
      }
      return criticalKeys;
    }

    function snapshotLoaderResult(candidate) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        throw new TypeError("HD asset loader returned a malformed result");
      }

      let ready;
      let fallbackRequired;
      let loadedSource;
      let failuresSource;
      try {
        ready = candidate.ready;
        fallbackRequired = candidate.fallbackRequired;
        loadedSource = candidate.loaded;
        failuresSource = candidate.failures;
      } catch (error) {
        const detail = error && error.message ? `: ${error.message}` : "";
        throw new TypeError(`HD asset loader result properties are unreadable${detail}`);
      }

      if (typeof ready !== "boolean" || typeof fallbackRequired !== "boolean") {
        throw new TypeError("HD asset loader ready and fallbackRequired flags must be booleans");
      }
      if (!(loadedSource instanceof Map)) {
        throw new TypeError("HD asset loader result.loaded must be a Map");
      }
      if (!Array.isArray(failuresSource)) {
        throw new TypeError("HD asset loader result.failures must be an array");
      }

      const loaded = new Map(loadedSource);
      const failureCount = failuresSource.length;
      const failures = new Array(failureCount);
      for (let index = 0; index < failureCount; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(failuresSource, index)) {
          throw new TypeError(`HD asset loader failure ${index} must be present`);
        }
        const failure = failuresSource[index];
        if (!failure || typeof failure !== "object" || Array.isArray(failure)) {
          throw new TypeError(`HD asset loader failure ${index} must be an object`);
        }

        let key;
        let critical;
        let reason;
        let src;
        const hasSrc = Object.prototype.hasOwnProperty.call(failure, "src");
        try {
          key = failure.key;
          critical = failure.critical;
          reason = failure.reason;
          if (hasSrc) src = failure.src;
        } catch (error) {
          const detail = error && error.message ? `: ${error.message}` : "";
          throw new TypeError(`HD asset loader failure ${index} is unreadable${detail}`);
        }

        if (typeof key !== "string" || key.length === 0) {
          throw new TypeError(`HD asset loader failure ${index} key must be a non-empty string`);
        }
        if (typeof critical !== "boolean") {
          throw new TypeError(`HD asset loader failure ${index} critical must be a boolean`);
        }
        if (typeof reason !== "string" || reason.length === 0) {
          throw new TypeError(`HD asset loader failure ${index} reason must be a non-empty string`);
        }
        if (hasSrc && typeof src !== "string") {
          throw new TypeError(`HD asset loader failure ${index} src must be a string when present`);
        }

        const failureSnapshot = { key, critical, reason };
        if (hasSrc) failureSnapshot.src = src;
        failures[index] = Object.freeze(failureSnapshot);
      }

      return Object.freeze({
        ready,
        fallbackRequired,
        loaded,
        failures: Object.freeze(failures)
      });
    }

    function validateReadyResult(result, criticalKeys) {
      if (result.ready !== true || result.fallbackRequired !== false) {
        return false;
      }
      for (let index = 0; index < result.failures.length; index += 1) {
        if (result.failures[index].critical) return false;
      }
      for (let index = 0; index < criticalKeys.length; index += 1) {
        const key = criticalKeys[index];
        if (!result.loaded.has(key)) {
          throw new TypeError(`HD asset loader result is missing critical asset: ${key}`);
        }
        const asset = result.loaded.get(key);
        const assetType = typeof asset;
        if (
          asset === null ||
          (assetType !== "object" && assetType !== "function") ||
          Array.isArray(asset)
        ) {
          throw new TypeError(`HD critical asset ${key} must be a non-null object or function`);
        }
      }
      return true;
    }

    function createPendingRecord(token) {
      let resolve;
      let reject;
      const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      return { token, promise, resolve, reject };
    }

    function initialize(enabled) {
      const wantsHD = enabled === true;
      if (requestedEnabled === wantsHD) {
        if (pendingInitialization) return pendingInitialization.promise;
        if (lastOutcome) return wantsHD ? Promise.resolve(lastOutcome) : lastOutcome;
      }

      requestedEnabled = wantsHD;
      lastOutcome = null;
      lastFallbackCause = null;
      const token = ++generation;

      if (!wantsHD) {
        pendingInitialization = null;
        loadedAssets = null;
        applyMode("legacy");
        if (token !== generation) return status(mode, { stale: true });
        lastOutcome = status("legacy");
        return lastOutcome;
      }

      const pendingRecord = createPendingRecord(token);
      pendingInitialization = pendingRecord;
      pendingRecord.promise.then(
        () => {
          if (pendingInitialization === pendingRecord) pendingInitialization = null;
        },
        () => {
          if (pendingInitialization === pendingRecord) pendingInitialization = null;
        }
      );

      try {
        applyMode("legacy");
      } catch (error) {
        if (pendingInitialization === pendingRecord) pendingInitialization = null;
        pendingRecord.reject(error);
        throw error;
      }
      if (!isCurrentInitialization(token, pendingRecord)) {
        pendingRecord.resolve(status(mode, { stale: true }));
        return pendingRecord.promise;
      }
      let loadResult;
      let criticalKeys;
      try {
        criticalKeys = collectCriticalAssetKeys(manifest);
        if (!isCurrentInitialization(token, pendingRecord)) {
          pendingRecord.resolve(status(mode, { stale: true }));
          return pendingRecord.promise;
        }
        if (!loader || typeof loader.loadAssets !== "function") {
          throw new Error("HD asset loader is unavailable");
        }
        loadResult = loader.loadAssets(manifest, loaderOptions);
      } catch (error) {
        loadResult = Promise.reject(error);
      }

      const initialization = Promise.resolve(loadResult).then(
        (result) => {
          if (!isCurrentInitialization(token, pendingRecord)) return status(mode, { stale: true });
          const resultSnapshot = snapshotLoaderResult(result);
          if (!isCurrentInitialization(token, pendingRecord)) return status(mode, { stale: true });
          if (!validateReadyResult(resultSnapshot, criticalKeys)) {
            return completeFailure(token, pendingRecord, null, resultSnapshot);
          }

          loadedAssets = new Map(resultSnapshot.loaded);
          applyMode("hd");
          if (!isCurrentInitialization(token, pendingRecord)) return status(mode, { stale: true });
          lastOutcome = status("hd", { result: resultSnapshot });
          return lastOutcome;
        },
        (error) => completeFailure(token, pendingRecord, error, null)
      ).catch((error) => completeFailure(token, pendingRecord, error, null));

      initialization.then(pendingRecord.resolve, pendingRecord.reject);
      return pendingRecord.promise;
    }

    function fallback(cause) {
      if (requestedEnabled === false && mode === "legacy" && lastFallbackCause === cause && lastOutcome) {
        return lastOutcome;
      }

      const shouldReport = lastFallbackCause !== cause;
      const token = ++generation;
      pendingInitialization = null;
      requestedEnabled = false;
      loadedAssets = null;
      const fallbackOutcome = status("legacy", { cause: cause || null });
      lastFallbackCause = cause;
      lastOutcome = fallbackOutcome;
      try {
        applyMode("legacy");
      } catch (error) {
        if (token === generation && lastOutcome === fallbackOutcome) {
          lastFallbackCause = null;
          lastOutcome = null;
        }
        throw error;
      }
      if (token !== generation) return status(mode, { stale: true });
      if (shouldReport) {
        reportDiagnostic({
          code: "hd-graphics-fallback",
          message: "HD graphics were disabled; using the legacy renderer fallback",
          cause: cause || null,
          result: null
        });
        if (token !== generation) return status(mode, { stale: true });
      }
      return fallbackOutcome;
    }

    function render(snapshot) {
      if (mode === "hd") {
        renderHD(snapshot, context, loadedAssets);
        return;
      }
      renderLegacy(snapshot, context);
    }

    applyMode("legacy");

    return Object.freeze({ initialize, fallback, render, getMode: () => mode });
  }

  return Object.freeze({
    TILE_SIZE,
    GRID_SIZE,
    WORLD_SIZE,
    LAYER_ORDER,
    BOTTOM_CENTER_ANCHOR,
    gridToScreen,
    getAnchoredDestinationRect,
    renderHDFrame,
    createGraphicsController
  });
});
