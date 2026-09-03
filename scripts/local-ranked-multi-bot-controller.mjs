import { mkdir as fsMkdir, rm as fsRm, writeFile as fsWriteFile } from "node:fs/promises";

import {
  launchBotWindow as defaultLaunchBotWindow,
  recoverBotAfterWorkerRestart as defaultRecoverBotAfterWorkerRestart,
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
import {
  mergeBotResult,
  writeBotResult as defaultWriteBotResult
} from "./local-ranked-bot-results.mjs";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeEventStatus(entry) {
  const result = entry.result || {};
  return {
    type: "bot_status",
    botId: entry.runtime.bot.id,
    name: entry.runtime.bot.name,
    profile: String(result.botProfile?.label || entry.runtime.bot.botProfile?.label || ""),
    profileId: String(result.botProfile?.id || entry.runtime.bot.botProfile?.id || ""),
    status: entry.status,
    depth: Math.max(0, Number(result.depth) || 0),
    depthHighscore: Math.max(0, Number(result.depthHighscore) || 0),
    score: Math.max(0, Number(result.score) || 0),
    lives: Math.max(0, Number(result.lives) || 0),
    currentGold: Math.max(0, Number(result.currentGold) || 0),
    totalGoldEarned: Math.max(0, Number(result.totalGoldEarned) || 0),
    hp: Math.max(0, Number(result.hp) || 0),
    startingRelic: String(result.startingRelic?.name || result.startingRelic?.relicId || ""),
    relics: Array.isArray(result.relics) ? result.relics : [],
    lastDecision: String(result.lastDecision || ""),
    error: String(entry.error || ""),
    updatedAt: String(result.updatedAt || new Date().toISOString())
  };
}

function buildManifest(options, paths, descriptors) {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: options.sessionId,
    sessionRoot: paths.sessionRoot,
    commit: options.commit,
    workerUrl: options.worker.url,
    workerLogPath: paths.workerLogPath,
    wranglerLogPath: paths.wranglerLogPath,
    createdAt: new Date().toISOString(),
    bots: descriptors.map((bot) => ({
      id: bot.id,
      name: bot.name,
      botProfile: bot.botProfile,
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
  const recoverBotAfterWorkerRestart = options.recoverBotAfterWorkerRestart || defaultRecoverBotAfterWorkerRestart;
  const sampleBotPage = options.sampleBotPage || defaultSampleBotPage;
  const writeBotResult = options.writeBotResult || defaultWriteBotResult;
  const wait = options.wait || sleep;
  const now = options.now || (() => Date.now());
  const resultPersistMs = Math.max(1_000, Number(options.resultPersistMs) || 10_000);
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
  let unsubscribeWorkerRestart = () => {};

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

  function updateEntryResult(entry, sample = null, extra = {}) {
    entry.result = mergeBotResult(entry.result, {
      status: entry.status,
      error: entry.error,
      sample,
      updatedAt: new Date(now()).toISOString(),
      ...extra
    });
    return entry.result;
  }

  async function persistEntry(entry, force = false) {
    const timestamp = now();
    if (!force && timestamp - entry.lastPersistedAt < resultPersistMs) return;
    entry.lastPersistedAt = timestamp;
    const result = entry.result;
    entry.persistPromise = entry.persistPromise.then(
      () => writeBotResult(entry.runtime.bot.resultPath, result)
    ).catch((error) => {
      emit({
        type: "result_write_failed",
        botId: entry.runtime.bot.id,
        message: redact(error?.message || error)
      });
    });
    await entry.persistPromise;
  }

  async function captureBot(botId, failureIncident) {
    const entry = findEntry(botId);
    if (capturePromises.has(botId)) return capturePromises.get(botId);
    clearEntryTimer(entry);
    entry.status = "failed";
    entry.error = String(failureIncident?.kind || "failure");
    updateEntryResult(entry, entry.lastSample);
    emit(safeEventStatus(entry));
    await persistEntry(entry, true);
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
      updateEntryResult(entry, entry.lastSample);
      emit(safeEventStatus(entry));
      await persistEntry(entry, true);
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
        entry.lastSample = sample;
        updateEntryResult(entry, sample);
        if (isBotRunComplete(sample)) {
          entry.status = "completed";
          updateEntryResult(entry, sample);
          clearEntryTimer(entry);
          emit(safeEventStatus(entry));
          await persistEntry(entry, true);
          return;
        }
        emit(safeEventStatus(entry));
        await persistEntry(entry);
        const failureIncident = monitor.observe(sample, now());
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
    updateEntryResult(entry, entry.lastSample);
    emit(safeEventStatus(entry));
    await persistEntry(entry, true);
    await entry.runtime.stop();
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
      updateEntryResult(entry, entry.lastSample);
      emit(safeEventStatus(entry));
      await persistEntry(entry, true);
    }
    await flushWorkerLog();
  }

  async function handleWorkerRestart(event = {}) {
    if (wallStopped) return;
    const activeEntries = entries.filter((entry) => entry.status === "running");
    const outcomes = await Promise.all(activeEntries.map(async (entry) => {
      try {
        return await recoverBotAfterWorkerRestart(entry.runtime);
      } catch (error) {
        emit({
          type: "worker_bot_recovery_failed",
          botId: entry.runtime.bot.id,
          message: redact(error?.message || error)
        });
        return "failed";
      }
    }));
    emit({
      type: "worker_restarted",
      attempt: Math.max(1, Number(event.attempt) || 1),
      previousCode: event.previousCode,
      recoveredBots: outcomes.filter((outcome) => outcome !== "failed").length,
      recoveryActions: outcomes
    });
  }

  async function stop() {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      wallStopped = true;
      unsubscribeWorkerExit();
      unsubscribeWorkerRestart();
      let firstError = null;
      const rememberError = (error) => {
        if (!firstError) firstError = error instanceof Error ? error : new Error(String(error));
      };
      for (const entry of entries) clearEntryTimer(entry);
      for (const entry of entries) {
        if (stoppedBotIds.has(entry.runtime.bot.id)) continue;
        stoppedBotIds.add(entry.runtime.bot.id);
        if (!["completed", "failed", "blocked", "stopped"].includes(entry.status)) {
          entry.status = "stopped";
          updateEntryResult(entry, entry.lastSample);
          emit(safeEventStatus(entry));
          await persistEntry(entry, true);
        }
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

  if (typeof options.worker.onExit === "function") {
    unsubscribeWorkerExit = options.worker.onExit(handleUnexpectedWorkerExit) || (() => {});
  }
  if (typeof options.worker.onRestart === "function") {
    unsubscribeWorkerRestart = options.worker.onRestart(handleWorkerRestart) || (() => {});
  }

  try {
    for (let index = 0; index < descriptors.length; index += 1) {
      const bot = descriptors[index];
      emit({
        type: "bot_status",
        botId: bot.id,
        name: bot.name,
        profile: bot.botProfile.label,
        profileId: bot.botProfile.id,
        status: "starting",
        depth: 0,
        depthHighscore: 0,
        score: 0,
        lives: 0,
        currentGold: 0,
        totalGoldEarned: 0,
        hp: 0,
        startingRelic: "",
        relics: [],
        lastDecision: "",
        error: "",
        updatedAt: new Date().toISOString()
      });
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
      const entry = {
        runtime,
        status: "starting",
        error: "",
        timer: null,
        lastSample: null,
        lastPersistedAt: 0,
        persistPromise: Promise.resolve(),
        result: mergeBotResult(null, {
          sessionId: options.sessionId,
          botId: bot.id,
          botName: bot.name,
          botProfile: bot.botProfile,
          commit: options.commit,
          status: "starting",
          updatedAt: new Date(now()).toISOString()
        })
      };
      entries.push(entry);
      const started = await startBotRun(runtime, {
        url: options.worker.url,
        commit: options.commit,
        password: options.password
      });
      entry.status = "running";
      updateEntryResult(entry, null, {
        botProfile: started?.botProfile || bot.botProfile,
        startingRelic: started?.startingRelic
      });
      emit(safeEventStatus(entry));
      await persistEntry(entry, true);
      beginMonitoring(entry);
      if (index + 1 < descriptors.length) await wait(150);
    }
  } catch (error) {
    wallStopped = true;
    unsubscribeWorkerExit();
    unsubscribeWorkerRestart();
    for (const entry of entries) {
      clearEntryTimer(entry);
      if (!["completed", "failed", "blocked", "stopped"].includes(entry.status)) {
        entry.status = "stopped";
        updateEntryResult(entry, entry.lastSample);
        emit(safeEventStatus(entry));
        await persistEntry(entry, true);
      }
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
