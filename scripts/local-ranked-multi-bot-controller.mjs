import { mkdir as fsMkdir, rm as fsRm, writeFile as fsWriteFile } from "node:fs/promises";

import {
  launchBotWindow as defaultLaunchBotWindow,
  resolveChromeExecutable as defaultResolveChromeExecutable,
  startBotRun as defaultStartBotRun
} from "./local-ranked-multi-bot-browser.mjs";
import {
  assertOwnedSessionChild,
  calculatePortraitTiles,
  createBotDescriptors,
  createMultiBotSessionPaths
} from "./local-ranked-multi-bot-domain.mjs";
import {
  BotProgressMonitor,
  captureBotFailure as defaultCaptureBotFailure,
  isBotRunComplete,
  sampleBotPage as defaultSampleBotPage
} from "./local-ranked-multi-bot-monitor.mjs";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeEventStatus(entry, sample = {}) {
  return {
    type: "bot_status",
    botId: entry.runtime.bot.id,
    name: entry.runtime.bot.name,
    status: entry.status,
    depth: Math.max(0, Number(sample.game?.depth) || 0),
    score: Math.max(0, Number(sample.game?.score) || 0),
    hp: Math.max(0, Number(sample.game?.player?.hp ?? sample.game?.hp) || 0),
    lastDecision: String(sample.observer?.lastDecision || ""),
    error: String(entry.error || "")
  };
}

function buildManifest(options, paths, descriptors) {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: options.sessionId,
    sessionRoot: paths.sessionRoot,
    commit: options.commit,
    workerUrl: options.worker.url,
    createdAt: new Date().toISOString(),
    bots: descriptors.map((bot) => ({
      id: bot.id,
      name: bot.name,
      artifactDir: bot.artifactDir
    }))
  });
}

function createTextRedactor(secrets) {
  const values = secrets.map(String).filter(Boolean).sort((left, right) => right.length - left.length);
  return (value) => values.reduce(
    (text, secret) => text.replaceAll(secret, "[REDACTED]"),
    String(value ?? "")
  );
}

export async function startMultiBotWall(options) {
  const chromeExecutable = options.chromeExecutable || await (options.resolveChromeExecutable || defaultResolveChromeExecutable)();
  const paths = createMultiBotSessionPaths(options.repoRoot, options.sessionId);
  const testBotCount = options.testBotCount === undefined ? 8 : Number(options.testBotCount);
  if (![2, 8].includes(testBotCount)) {
    throw new TypeError("The multi-bot supervisor supports eight bots or the gated two-bot smoke override.");
  }
  const descriptors = createBotDescriptors(paths.sessionRoot).slice(0, testBotCount);
  const tiles = calculatePortraitTiles(options.monitor).slice(0, testBotCount);
  const mkdir = options.mkdir || fsMkdir;
  const rm = options.rm || fsRm;
  const writeFile = options.writeFile || fsWriteFile;
  const writeManifest = options.writeManifest || (async (manifestPath, manifest) => {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  });
  const launchBotWindow = options.launchBotWindow || defaultLaunchBotWindow;
  const startBotRun = options.startBotRun || defaultStartBotRun;
  const captureBotFailure = options.captureBotFailure || defaultCaptureBotFailure;
  const sampleBotPage = options.sampleBotPage || defaultSampleBotPage;
  const wait = options.wait || sleep;
  const setIntervalImpl = options.setInterval || globalThis.setInterval;
  const clearIntervalImpl = options.clearInterval || globalThis.clearInterval;
  const emit = options.emit || (() => {});
  const redact = createTextRedactor([options.password, options.secret]);

  await mkdir(paths.profilesRoot, { recursive: true });
  await writeManifest(paths.manifestPath, buildManifest(options, paths, descriptors));
  emit({ type: "artifact_root", path: paths.sessionRoot });

  const entries = [];
  const capturePromises = new Map();
  const stoppedBotIds = new Set();
  let wallStopped = false;
  let stopPromise = null;
  let workerExitHandled = false;
  let workerLogFlushed = false;
  let unsubscribeWorkerExit = () => {};

  async function flushWorkerLog() {
    if (workerLogFlushed) return;
    workerLogFlushed = true;
    await writeFile(paths.workerLogPath, `${redact(options.worker.getLogs?.() || "").trimEnd()}\n`, "utf8");
  }

  function clearEntryTimer(entry) {
    if (!entry.timer) return;
    clearIntervalImpl(entry.timer);
    entry.timer = null;
  }

  function findEntry(botId) {
    const entry = entries.find((candidate) => candidate.runtime.bot.id === botId);
    if (!entry) throw new RangeError(`Unknown multi-bot id: ${botId}`);
    return entry;
  }

  async function captureBot(botId, failureIncident) {
    const entry = findEntry(botId);
    if (capturePromises.has(botId)) return capturePromises.get(botId);
    clearEntryTimer(entry);
    entry.status = "failed";
    entry.error = String(failureIncident?.kind || "failure");
    emit(safeEventStatus(entry));
    const promise = captureBotFailure(entry.runtime, failureIncident, {
      secrets: [options.password, options.secret]
    }).then((record) => {
      emit({
        type: "bot_failure",
        botId,
        kind: String(failureIncident?.kind || "failure"),
        artifactDir: record.artifactDir
      });
      return record;
    }).catch(async (error) => {
      entry.error = redact(error?.message || error);
      await entry.runtime.page?.evaluate?.(() => {
        window.__DUNGEON_MULTI_BOT_TELEMETRY__?.stopObserverBot?.();
        document.documentElement.style.outline = "8px solid #c5162e";
      }).catch(() => {});
      emit(safeEventStatus(entry));
      throw error;
    });
    capturePromises.set(botId, promise);
    return promise;
  }

  function beginMonitoring(entry) {
    const monitor = new BotProgressMonitor({ stallMs: 30_000, loopMs: 30_000 });
    let polling = false;
    const poll = async () => {
      if (polling || wallStopped || entry.status !== "running") return;
      polling = true;
      try {
        const sample = await sampleBotPage(entry.runtime);
        if (isBotRunComplete(sample)) {
          entry.status = "completed";
          clearEntryTimer(entry);
          emit(safeEventStatus(entry, sample));
          return;
        }
        emit(safeEventStatus(entry, sample));
        const failureIncident = monitor.observe(sample, Date.now());
        if (failureIncident) await captureBot(entry.runtime.bot.id, failureIncident);
      } catch (error) {
        await captureBot(entry.runtime.bot.id, {
          kind: "page_error",
          detail: redact(error?.message || error)
        }).catch(() => {});
      } finally {
        polling = false;
      }
    };
    entry.timer = setIntervalImpl(poll, Number(options.pollMs) || 1_000);
    entry.timer?.unref?.();
  }

  async function stopBot(botId) {
    const entry = findEntry(botId);
    if (stoppedBotIds.has(botId)) return;
    stoppedBotIds.add(botId);
    clearEntryTimer(entry);
    entry.status = "stopped";
    await entry.runtime.stop();
    emit(safeEventStatus(entry));
  }

  async function focusBot(botId) {
    await findEntry(botId).runtime.focus();
  }

  async function handleUnexpectedWorkerExit(event = {}) {
    if (event.expected === true || workerExitHandled || wallStopped) return;
    workerExitHandled = true;
    for (const entry of entries) {
      clearEntryTimer(entry);
      entry.status = "blocked";
      entry.error = `Shared local Worker exited${event.code === undefined ? "" : ` (${event.code})`}.`;
      emit(safeEventStatus(entry));
    }
    await flushWorkerLog();
  }

  async function stop() {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      wallStopped = true;
      unsubscribeWorkerExit();
      let firstError = null;
      const rememberError = (error) => {
        if (!firstError) firstError = error instanceof Error ? error : new Error(String(error));
      };
      for (const entry of entries) clearEntryTimer(entry);
      for (const entry of entries) {
        if (stoppedBotIds.has(entry.runtime.bot.id)) continue;
        stoppedBotIds.add(entry.runtime.bot.id);
        try {
          await entry.runtime.stop();
        } catch (error) {
          rememberError(error);
        }
      }
      try {
        await flushWorkerLog();
      } catch (error) {
        rememberError(error);
      }
      try {
        await options.worker.stop();
      } catch (error) {
        rememberError(error);
      }
      try {
        const profilesRoot = assertOwnedSessionChild(paths.sessionRoot, paths.profilesRoot);
        await rm(profilesRoot, { recursive: true, force: true });
      } catch (error) {
        rememberError(error);
      }
      if (firstError) throw firstError;
    })();
    return stopPromise;
  }

  try {
    for (let index = 0; index < descriptors.length; index += 1) {
      const bot = descriptors[index];
      emit({ type: "bot_status", botId: bot.id, name: bot.name, status: "starting" });
      const runtime = await launchBotWindow({
        bot,
        bounds: tiles[index],
        chromeExecutable,
        url: options.worker.url,
        commit: options.commit,
        password: options.password,
        secrets: [options.password, options.secret],
        emit
      });
      const entry = { runtime, status: "starting", error: "", timer: null };
      entries.push(entry);
      await startBotRun(runtime, {
        url: options.worker.url,
        commit: options.commit,
        password: options.password
      });
      entry.status = "running";
      emit(safeEventStatus(entry));
      beginMonitoring(entry);
      if (index + 1 < descriptors.length) await wait(150);
    }
    if (typeof options.worker.onExit === "function") {
      unsubscribeWorkerExit = options.worker.onExit(handleUnexpectedWorkerExit) || (() => {});
    }
  } catch (error) {
    wallStopped = true;
    for (const entry of entries) {
      clearEntryTimer(entry);
      await entry.runtime.stop().catch(() => {});
    }
    await flushWorkerLog().catch(() => {});
    await options.worker.stop().catch(() => {});
    const profilesRoot = assertOwnedSessionChild(paths.sessionRoot, paths.profilesRoot);
    await rm(profilesRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  return Object.freeze({
    sessionRoot: paths.sessionRoot,
    bots: entries,
    stopBot,
    focusBot,
    captureBot,
    stop
  });
}
