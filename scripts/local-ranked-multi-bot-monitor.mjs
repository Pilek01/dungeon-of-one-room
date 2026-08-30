import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const KNOWN_BOUNDARY_STATES = new Set([
  "STARTING_RUN",
  "AWAITING_STARTING_RELIC",
  "ENTERING_ROOM",
  "RESOLVING_ROOM",
  "AWAITING_REWARD_OR_TRANSACTION",
  "ENTERING_NEXT_ROOM",
  "TERMINAL_PENDING",
  "FINALIZING",
  "RETRYING",
]);

const FAILURE_CAPTURES = new WeakMap();
const FALLBACK_SCREENSHOT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

export function gameplayFingerprint(sample) {
  return JSON.stringify({
    phase: sample.game?.phase || "",
    depth: Number(sample.game?.depth) || 0,
    room: sample.game?.roomIndex ?? sample.game?.roomType ?? "",
    turn: sample.game?.turn ?? 0,
    x: Number(sample.game?.player?.x) || 0,
    y: Number(sample.game?.player?.y) || 0,
    enemies: Number(sample.game?.enemyCount ?? sample.game?.enemies?.length) || 0,
    enemyHp: Number(sample.game?.enemyHpTotal) || 0,
    portal: Boolean(sample.game?.portalVisible),
    decision: String(sample.observer?.lastDecision || "")
  });
}

function incident(kind, detail = "") {
  return Object.freeze({ kind, detail: String(detail || "") });
}

export function classifyImmediateFailure(sample) {
  if (sample?.intentionalStop === true) return null;
  if (isBotRunComplete(sample)) return null;
  if (sample?.pageClosed === true) return incident("unexpected_exit", "Chrome page closed unexpectedly.");
  if (sample?.fatal === true) return incident("fatal", sample.fatalReason);
  if (sample?.provisionalFailure === true) return incident("provisional_failure", sample.provisionalReason);
  if (Array.isArray(sample?.pageErrors) && sample.pageErrors.length > 0) {
    return incident("page_error", sample.pageErrors.at(-1));
  }

  const overlay = String(sample?.overlayText || "").toUpperCase();
  const eligibility = String(sample?.snapshot?.publicState?.rankEligibility || "").toLowerCase();
  if (eligibility === "provisional") {
    const reasons = sample?.snapshot?.publicState?.rankIntegrity?.reasonCodes;
    return incident("integrity", Array.isArray(reasons) ? reasons.join(",") : "Rank eligibility became provisional.");
  }
  if (overlay.includes("RANKED INTEGRITY CHECK FAILED")) {
    return incident("integrity", sample.overlayText);
  }
  if (
    overlay.includes("RANKED RECONNECT REQUIRED") ||
    ["RECONNECT_REQUIRED", "UNRECOVERABLE_PROTOCOL_ERROR"].includes(String(sample?.sessionState || "").toUpperCase())
  ) {
    return incident("reconnect", sample.overlayText || sample.sessionState);
  }
  if (sample?.observer && sample.observer.enabled === false && sample.expectObserver !== false) {
    return incident("observer_stopped", "Observer Bot became inactive unexpectedly.");
  }
  return null;
}

export function isBotRunComplete(sample) {
  return ["FINALIZED", "ABANDONED_LOCAL_SESSION"].includes(String(sample?.sessionState || "").toUpperCase());
}

function isKnownBoundaryWait(sample) {
  return sample?.boundaryWait === true ||
    KNOWN_BOUNDARY_STATES.has(String(sample?.sessionState || "").toUpperCase()) ||
    sample?.game?.rankedHudStatus?.syncing === true;
}

export class BotProgressMonitor {
  constructor(options = {}) {
    this.stallMs = Math.max(1, Number(options.stallMs) || 30_000);
    this.loopMs = Math.max(1, Number(options.loopMs) || 30_000);
    this.boundaryStallMs = Math.max(
      this.stallMs,
      Number(options.boundaryStallMs) || 60_000
    );
    this.lastFingerprint = null;
    this.lastProgressAt = null;
    this.boundaryFingerprint = null;
    this.boundaryStartedAt = null;
    this.history = [];
  }

  observe(sample, nowMs = Date.now()) {
    const immediate = classifyImmediateFailure(sample);
    if (immediate) return immediate;

    const fingerprint = gameplayFingerprint(sample);
    if (isKnownBoundaryWait(sample)) {
      if (fingerprint !== this.boundaryFingerprint) {
        this.boundaryFingerprint = fingerprint;
        this.boundaryStartedAt = nowMs;
      } else if (nowMs - this.boundaryStartedAt >= this.boundaryStallMs) {
        const boundary = String(sample?.sessionState || "SYNCING").toUpperCase();
        return incident(
          "boundary_stall",
          `Ranked boundary ${boundary} made no progress for ${this.boundaryStallMs} ms.`
        );
      }
      this.lastFingerprint = fingerprint;
      this.lastProgressAt = nowMs;
      this.history = [];
      return null;
    }

    this.boundaryFingerprint = null;
    this.boundaryStartedAt = null;

    if (this.lastFingerprint === null) {
      this.lastFingerprint = fingerprint;
      this.lastProgressAt = nowMs;
    } else if (fingerprint === this.lastFingerprint) {
      if (nowMs - this.lastProgressAt >= this.stallMs) {
        return incident("stall", `No gameplay progress for ${this.stallMs} ms.`);
      }
    } else {
      this.lastFingerprint = fingerprint;
      this.lastProgressAt = nowMs;
    }

    this.history.push(Object.freeze({ fingerprint, at: nowMs }));
    if (this.history.length > 32) this.history.splice(0, this.history.length - 32);
    for (let period = 2; period <= 4; period += 1) {
      if (this.history.length < period * 2) continue;
      const recent = this.history.slice(-period * 2);
      const repeats = recent.slice(0, period).every(
        (entry, index) => entry.fingerprint === recent[index + period].fingerprint
      );
      if (repeats && nowMs - recent[0].at >= this.loopMs) {
        return incident("loop", `Repeated ${period}-state gameplay cycle for ${this.loopMs} ms.`);
      }
    }
    return null;
  }
}

export async function sampleBotPage(runtime) {
  const sampled = await runtime.page.evaluate(() => {
    let game = {};
    try {
      game = JSON.parse(window.render_game_to_text?.() || "{}");
    } catch {
      game = {};
    }
    return {
      game,
      sessionState: window.DungeonOnlineV3?.getSessionState?.() || "",
      snapshot: window.DungeonOnlineV3?.getSnapshot?.() || null,
      observer: window.__DUNGEON_MULTI_BOT_TELEMETRY__?.observerState?.() || null,
      overlayText: document.querySelector(".ranked-v3-overlay:not(.hidden), #screenOverlay:not(.hidden)")?.innerText || ""
    };
  });
  return Object.freeze({
    ...sampled,
    pageClosed: runtime.page.isClosed?.() === true,
    pageErrors: [...(runtime.pageErrors || [])]
  });
}

function createCaptureRedactor(runtime, secrets = []) {
  const values = secrets.map(String).filter(Boolean).sort((left, right) => right.length - left.length);
  return (value) => {
    let text = runtime.redact ? runtime.redact(value) : String(value ?? "");
    for (const secret of values) text = text.replaceAll(secret, "[REDACTED]");
    return text;
  };
}

function sanitizedJson(value, redact) {
  return redact(JSON.stringify(value ?? null, null, 2));
}

async function performFailureCapture(runtime, failureIncident, options) {
  const artifactDir = runtime.bot.artifactDir;
  const redact = createCaptureRedactor(runtime, options.secrets || []);
  await mkdir(artifactDir, { recursive: true });

  let pageAvailable = true;
  let collectionError = "";
  let collected;
  try {
    collected = await runtime.page.evaluate(() => {
      let game = {};
      try {
        game = JSON.parse(window.render_game_to_text?.() || "{}");
      } catch {
        game = {};
      }
      return {
        game,
        sessionState: window.DungeonOnlineV3?.getSessionState?.() || "",
        snapshot: window.DungeonOnlineV3?.getSnapshot?.() || null,
        rankedDiagnostics: window.DungeonOnlineV3?.getDiagnostics?.() || [],
        observerTrace: window.__DUNGEON_MULTI_BOT_TELEMETRY__?.observerTrace?.() || ""
      };
    });
  } catch (error) {
    pageAvailable = false;
    collectionError = redact(error?.message || error);
    collected = {
      game: { unavailable: true, captureError: collectionError },
      sessionState: "PAGE_EXITED",
      snapshot: null,
      rankedDiagnostics: [],
      observerTrace: ""
    };
  }

  const screenshotPath = path.join(artifactDir, "screenshot.png");
  try {
    await runtime.page.screenshot({
      path: screenshotPath,
      fullPage: true,
      animations: "disabled"
    });
  } catch (error) {
    pageAvailable = false;
    if (!collectionError) collectionError = redact(error?.message || error);
    await writeFile(screenshotPath, FALLBACK_SCREENSHOT_PNG);
  }
  await Promise.all([
    writeFile(path.join(artifactDir, "failure-summary.json"), `${sanitizedJson({
      botId: runtime.bot.id,
      incident: failureIncident,
      sessionState: collected.sessionState,
      snapshot: collected.snapshot,
      captureError: collectionError
    }, redact)}\n`, "utf8"),
    writeFile(path.join(artifactDir, "ranked-diagnostics.json"), `${sanitizedJson(collected.rankedDiagnostics, redact)}\n`, "utf8"),
    writeFile(path.join(artifactDir, "observer-bot-trace.txt"), `${redact(collected.observerTrace).trimEnd()}\n`, "utf8"),
    writeFile(path.join(artifactDir, "game-state.json"), `${sanitizedJson(collected.game, redact)}\n`, "utf8"),
    writeFile(path.join(artifactDir, "console.log"), `${redact((runtime.consoleRing || []).join("\n")).trimEnd()}\n`, "utf8"),
    writeFile(path.join(artifactDir, "network-errors.json"), `${sanitizedJson(runtime.networkErrors || [], redact)}\n`, "utf8")
  ]);

  await runtime.page.evaluate(() => {
    window.__DUNGEON_MULTI_BOT_TELEMETRY__?.stopObserverBot?.();
    document.documentElement.style.outline = "8px solid #c5162e";
    document.title = `[FAILED] ${document.title.replace(/^\[FAILED\]\s*/u, "")}`;
  }).catch(() => {});

  return Object.freeze({
    botId: runtime.bot.id,
    artifactDir,
    incident: failureIncident,
    pageLeftOpen: pageAvailable
  });
}

export function captureBotFailure(runtime, failureIncident, options = {}) {
  if (FAILURE_CAPTURES.has(runtime)) return FAILURE_CAPTURES.get(runtime);
  const capture = performFailureCapture(runtime, failureIncident, options);
  FAILURE_CAPTURES.set(runtime, capture);
  return capture;
}
