(function attachHDAssetLoader(root, factory) {
  const manifestApi = typeof module === "object" && module.exports
    ? require("./hd-asset-manifest.js")
    : root && root.DungeonHDAssetManifest;
  const api = factory(manifestApi);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.DungeonHDAssetLoader = api;
  }
})(typeof window !== "undefined" ? window : null, function createHDAssetLoaderApi(manifestApi) {
  "use strict";

  if (!manifestApi || typeof manifestApi.validateManifest !== "function") {
    throw new Error("DungeonHDAssetManifest must load before DungeonHDAssetLoader");
  }

  const DEFAULT_TIMEOUT_MS = 15000;
  const DEFAULT_CONCURRENCY = 8;

  function defaultImageFactory() {
    if (typeof Image !== "function") {
      throw new Error("Image is unavailable; provide imageFactory outside the browser");
    }
    return new Image();
  }

  function defaultSetTimeout(callback, delay) {
    return setTimeout(callback, delay);
  }

  function defaultClearTimeout(timerId) {
    clearTimeout(timerId);
  }

  function normalizeOptions(options) {
    const source = options && typeof options === "object" ? options : {};
    const timeoutMs = source.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : source.timeoutMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      throw new TypeError("timeoutMs must be a non-negative finite number");
    }
    const concurrency = source.concurrency === undefined ? DEFAULT_CONCURRENCY : source.concurrency;
    if (!Number.isInteger(concurrency) || concurrency <= 0) {
      throw new TypeError("concurrency must be a positive integer");
    }

    const imageFactory = source.imageFactory === undefined ? defaultImageFactory : source.imageFactory;
    const setTimeoutFn = source.setTimeoutFn === undefined ? defaultSetTimeout : source.setTimeoutFn;
    const clearTimeoutFn = source.clearTimeoutFn === undefined ? defaultClearTimeout : source.clearTimeoutFn;
    if (typeof imageFactory !== "function") throw new TypeError("imageFactory must be a function");
    if (typeof setTimeoutFn !== "function") throw new TypeError("setTimeoutFn must be a function");
    if (typeof clearTimeoutFn !== "function") throw new TypeError("clearTimeoutFn must be a function");
    if (source.onProgress !== undefined && typeof source.onProgress !== "function") {
      throw new TypeError("onProgress must be a function");
    }

    return {
      imageFactory,
      concurrency,
      timeoutMs,
      onProgress: source.onProgress,
      setTimeoutFn,
      clearTimeoutFn
    };
  }

  function loadImage(asset, options) {
    return new Promise((resolve) => {
      let image = null;
      let settled = false;
      let decodeRejected = false;
      let timerId;
      let timerScheduled = false;

      function clearTimer() {
        if (!timerScheduled) return;
        timerScheduled = false;
        try {
          options.clearTimeoutFn(timerId);
        } catch (_error) {
          // Injected cleanup is best-effort and cannot prevent settlement.
        }
      }

      function cleanup() {
        clearTimer();
        if (image && (typeof image === "object" || typeof image === "function")) {
          try {
            image.onload = null;
          } catch (_error) {
            // Hostile image properties cannot prevent the remaining cleanup.
          }
          try {
            image.onerror = null;
          } catch (_error) {
            // Settlement remains authoritative even when handler cleanup fails.
          }
        }
      }

      function settle(ok, reason) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(ok
          ? { ok: true, asset, image }
          : {
              ok: false,
              failure: {
                key: asset.key,
                src: asset.src,
                critical: asset.critical,
                reason
              }
            });
      }

      try {
        image = options.imageFactory();
      } catch (_error) {
        settle(false, "factory");
        return;
      }
      if (!image || (typeof image !== "object" && typeof image !== "function")) {
        settle(false, "factory");
        return;
      }

      const canDecode = typeof image.decode === "function";
      image.onerror = function handleImageError() {
        settle(false, decodeRejected ? "decode" : "error");
      };
      image.onload = function handleImageLoad() {
        settle(true);
      };

      try {
        timerId = options.setTimeoutFn(() => settle(false, "timeout"), options.timeoutMs);
        timerScheduled = true;
        if (settled) clearTimer();
      } catch (_error) {
        settle(false, "timeout");
        return;
      }

      try {
        image.src = asset.src;
      } catch (_error) {
        settle(false, "error");
        return;
      }

      if (canDecode && !settled) {
        let decodeResult;
        try {
          decodeResult = image.decode();
        } catch (_error) {
          decodeRejected = true;
          return;
        }
        Promise.resolve(decodeResult).then(
          () => settle(true),
          () => {
            decodeRejected = true;
          }
        );
      }
    });
  }

  function reportProgress(onProgress, completed, total) {
    if (!onProgress) return;
    const update = Object.freeze({
      completed,
      total,
      ratio: total === 0 ? 1 : completed / total,
      complete: completed === total
    });
    try {
      onProgress(update);
    } catch (_error) {
      // Progress observers cannot invalidate a completed preload operation.
    }
  }

  async function loadSnapshotAssets(assets, options) {
    const normalizedOptions = normalizeOptions(options);
    let completed = 0;
    reportProgress(normalizedOptions.onProgress, completed, assets.length);

    const outcomes = new Array(assets.length);
    let nextIndex = 0;
    async function worker() {
      while (nextIndex < assets.length) {
        const index = nextIndex;
        nextIndex += 1;
        outcomes[index] = await loadImage(assets[index], normalizedOptions);
        completed += 1;
        reportProgress(normalizedOptions.onProgress, completed, assets.length);
      }
    }
    const workerCount = Math.min(normalizedOptions.concurrency, assets.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    const loaded = new Map();
    const failures = [];

    outcomes.forEach((outcome) => {
      if (outcome.ok) {
        loaded.set(outcome.asset.key, outcome.image);
      } else {
        failures.push({ ...outcome.failure });
      }
    });

    const fallbackRequired = failures.some((failure) => failure.critical);
    return {
      ready: !fallbackRequired,
      fallbackRequired,
      loaded,
      failures
    };
  }

  function loadAssets(candidate, options) {
    const assets = manifestApi.snapshotManifest(candidate);
    return loadSnapshotAssets(assets, options);
  }

  function loadGroup(group, options) {
    const source = options && typeof options === "object" ? options : {};
    const candidate = source.manifest === undefined ? manifestApi.entries : source.manifest;
    const selected = manifestApi.selectGroup(group, candidate);
    return loadSnapshotAssets(selected, source);
  }

  return Object.freeze({ loadAssets, loadGroup });
});
