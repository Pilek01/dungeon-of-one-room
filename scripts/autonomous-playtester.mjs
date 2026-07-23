import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(scriptDir, "..");
const projectRoot = path.resolve(gameRoot, "..");
const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || os.homedir(), ".codex");

const args = new Map();
for (const arg of process.argv.slice(2)) {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
  if (match) args.set(match[1], match[2] ?? true);
}

const smoke = args.has("smoke");
const durationMs = Number(args.get("duration-ms") || (smoke ? 30_000 : 20 * 60_000));
const seed = String(args.get("seed") || `dungeon-one-room-${new Date().toISOString().slice(0, 10)}-${smoke ? "smoke" : "full"}`);
const requestedUrl = args.get("url");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputRoot = path.resolve(
  String(args.get("output") || path.join(gameRoot, "output", "playwright", `dungeon-one-room-playtest-${stamp}`))
);
const screenshotRoot = path.join(outputRoot, "screenshots");
const videoRoot = path.join(outputRoot, "video");
const tracePath = path.join(outputRoot, "dungeon.trace.zip");
const telemetryPath = path.join(outputRoot, "telemetry.json");
const consolePath = path.join(outputRoot, "browser-console.json");
const reportPath = path.join(outputRoot, "qa-report.md");
const MAX_STATE_SCREENSHOTS = 48;

fs.mkdirSync(screenshotRoot, { recursive: true });
fs.mkdirSync(videoRoot, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clampLabel = (value) => String(value || "state").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "state";
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

function seededRandom(seedText) {
  let h = 2166136261;
  for (const char of seedText) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createStaticServer(root) {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".webp": "image/webp",
    ".aseprite": "application/octet-stream"
  };
  const server = http.createServer((request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const target = path.resolve(root, `.${relative}`);
      if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, { "Content-Type": mime[path.extname(target).toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(target).pipe(response);
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  return server;
}

async function loadPlaywright() {
  const candidates = [
    path.join(gameRoot, "node_modules", "playwright", "index.js"),
    path.join(codexHome, "skills", "develop-web-game", "node_modules", "playwright", "index.js"),
    path.join(codexHome, "skills", "playwright", "node_modules", "playwright", "index.js")
  ];
  const playwrightPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!playwrightPath) throw new Error(`Playwright runtime not found. Checked: ${candidates.join(", ")}`);
  const module = await import(pathToFileURL(playwrightPath).href);
  return module.default || module;
}

function attachDiagnostics(page, diagnostics) {
  page.on("console", (message) => {
    diagnostics.console.push({
      ts: new Date().toISOString(),
      type: message.type(),
      text: message.text(),
      location: message.location()
    });
  });
  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push({ ts: new Date().toISOString(), text: String(error?.stack || error) });
  });
  page.on("requestfailed", (request) => {
    diagnostics.network.push({
      ts: new Date().toISOString(),
      url: request.url(),
      method: request.method(),
      failure: request.failure()
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      diagnostics.http.push({ ts: new Date().toISOString(), status: response.status(), url: response.url() });
    }
  });
}

async function collectSnapshot(page) {
  return page.evaluate(() => {
    const text = (selector) => document.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim() || "";
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
    let state = null;
    let adapterError = "";
    try {
      state = typeof window.render_game_to_text === "function" ? JSON.parse(window.render_game_to_text()) : null;
    } catch (error) {
      adapterError = String(error?.stack || error);
    }
    return {
      ts: new Date().toISOString(),
      state,
      adapterError,
      dom: {
        hud: text("#hud"),
        actions: text("#actions"),
        activeEffects: text("#activeEffects"),
        mutators: text("#mutators"),
        skills: text("#skillsBar"),
        log: text("#log"),
        overlay: text("#screenOverlay"),
        overlayVisible: visible("#screenOverlay"),
        bootVisible: visible("#bootScreen"),
        appVisible: visible("#gameApp"),
        canvasMode: document.querySelector("#game")?.dataset?.graphicsMode || "",
        buttons: [...document.querySelectorAll("button")].filter((button) => visibleForReport(button)).map((button) => ({
          id: button.id,
          label: button.textContent?.replace(/\s+/g, " ").trim() || "",
          disabled: Boolean(button.disabled)
        }))
      }
    };

    function visibleForReport(element) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    }
  });
}

function stateSignature(snapshot) {
  const state = snapshot?.state || {};
  const player = state.player || {};
  return JSON.stringify({
    phase: state.phase,
    depth: state.depth,
    roomType: state.roomType,
    roomCleared: state.roomCleared,
    turn: state.turn,
    x: player.x,
    y: player.y,
    hp: player.hp,
    enemies: (state.enemies || []).map((enemy) => [enemy.type, enemy.x, enemy.y, enemy.hp]).sort()
  });
}

function invariantFindings(snapshot) {
  const state = snapshot?.state;
  if (!state) return [];
  const findings = [];
  const player = state.player || {};
  const add = (actual, expected, subsystem) => findings.push({ actual, expected, subsystem });
  if (!Number.isFinite(Number(state.depth)) || Number(state.depth) < 0) add(`depth=${state.depth}`, "Depth is a non-negative finite number.", "run progression");
  if (!Number.isFinite(Number(player.hp)) || Number(player.hp) < 0) add(`player.hp=${player.hp}`, "HP is a finite non-negative number.", "combat state");
  if (Number(player.maxHp) > 0 && Number(player.hp) > Number(player.maxHp)) add(`player.hp=${player.hp}, maxHp=${player.maxHp}`, "HP does not exceed maximum HP.", "combat state");
  for (const resource of ["potions", "gold"]) {
    if (Number(player[resource]) < 0) add(`player.${resource}=${player[resource]}`, `${resource} never becomes negative.`, "resource economy");
  }
  for (const enemy of state.enemies || []) {
    if (Number(enemy.hp) < 0) add(`${enemy.type || "enemy"}.hp=${enemy.hp}`, "Enemy HP is not negative in player-visible state.", "enemy combat");
  }
  return findings;
}

function markdownBug(finding) {
  return [
    `### ${finding.severity} — ${finding.title}`,
    `- severity: ${finding.severity}`,
    `- confidence: ${finding.confidence}`,
    `- what the player experienced: ${finding.experience}`,
    `- exact reproduction steps: ${finding.steps}`,
    `- expected result: ${finding.expected}`,
    `- actual result: ${finding.actual}`,
    `- evidence filename: ${finding.evidence || "none"}`,
    `- likely owning subsystem: ${finding.subsystem}`,
    `- reproduced more than once: ${finding.reproduced ? "yes" : "no"}`,
    ""
  ].join("\n");
}

async function main() {
  const diagnostics = { console: [], pageErrors: [], network: [], http: [] };
  const telemetry = [];
  const screenshots = [];
  const capturedStateReasons = new Set();
  const majorDecisionPoints = [];
  const deaths = [];
  const findings = [];
  let server = null;
  let browser = null;
  let context = null;
  let page = null;
  let video = null;
  let lastSnapshot = null;
  let finalSnapshot = null;
  let lastSignature = "";
  let lastProgressAt = Date.now();
  let recoveryAttempts = 0;
  let previousPhase = "";
  let previousDepth = -1;
  let previousRoom = "";
  let previousDeathCount = 0;
  let sessionError = null;

  try {
    let baseUrl = requestedUrl;
    if (!baseUrl) {
      server = createStaticServer(gameRoot);
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      baseUrl = `http://127.0.0.1:${server.address().port}/index.html`;
    }

    const { chromium } = await loadPlaywright();
    browser = await chromium.launch({
      headless: false,
      slowMo: 60,
      args: ["--autoplay-policy=no-user-gesture-required"]
    });
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      recordVideo: { dir: videoRoot, size: { width: 1440, height: 1000 } }
    });
    // A long video session already records visual evidence. Keeping the trace
    // without DOM snapshots/sources avoids multi-gigabyte trace archives.
    await context.tracing.start({ screenshots: true, snapshots: false, sources: false });
    await context.addInitScript(({ randomSeed }) => {
      let h = 2166136261;
      for (const char of randomSeed) {
        h ^= char.charCodeAt(0);
        h = Math.imul(h, 16777619);
      }
      Math.random = () => {
        h += 0x6D2B79F5;
        let t = h;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      localStorage.setItem("dungeonOneRoomGraphicsMode", "hd");
      localStorage.removeItem("dungeonOneRoomPlayerName");
      window.__dungeonPlaytester = { seed: randomSeed, startedAt: new Date().toISOString() };
    }, { randomSeed: seed });
    page = await context.newPage();
    video = page.video();
    attachDiagnostics(page, diagnostics);

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#bootScreen", { timeout: 60_000 });
    await page.screenshot({ path: path.join(screenshotRoot, "00-boot.png"), fullPage: true });
    screenshots.push({ file: "screenshots/00-boot.png", reason: "boot" });

    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#gameApp")?.classList.contains("app-hidden") === false, { timeout: 15_000 });

    // Begin through the visible player-name flow. The empty fresh context makes
    // Start New Game open the modal; submitting "codex" starts the run.
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "menu", { timeout: 15_000 });
    await page.keyboard.press("1");
    await page.waitForSelector("#nameInput", { state: "visible", timeout: 10_000 });
    await page.screenshot({ path: path.join(screenshotRoot, "01-name-entry.png"), fullPage: true });
    screenshots.push({ file: "screenshots/01-name-entry.png", reason: "player-name-entry" });
    await page.locator("#nameInput").fill("codex");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => {
      const state = JSON.parse(window.render_game_to_text());
      return state.phase === "relic" || state.phase === "playing";
    }, { timeout: 15_000 });
    await page.screenshot({ path: path.join(screenshotRoot, "02-run-started-as-codex.png"), fullPage: true });
    screenshots.push({ file: "screenshots/02-run-started-as-codex.png", reason: "run-started-as-codex" });

    // The existing observer bot is a player-facing, visible-information controller.
    // F10 opens its debug-only control surface; B enables it; F10 closes the surface.
    await page.keyboard.press("F10");
    await page.waitForTimeout(150);
    await page.keyboard.press("b");
    await page.waitForTimeout(150);
    await page.keyboard.press("F10");
    await page.waitForTimeout(1_000);

    const sessionStart = Date.now();
    const sessionEnd = sessionStart + durationMs;
    while (Date.now() < sessionEnd && !page.isClosed()) {
      const snapshot = await collectSnapshot(page);
      lastSnapshot = snapshot;
      telemetry.push({ elapsedMs: Date.now() - sessionStart, ...snapshot });

      const state = snapshot.state || {};
      const signature = stateSignature(snapshot);
      if (signature !== lastSignature) {
        lastSignature = signature;
        lastProgressAt = Date.now();
        recoveryAttempts = 0;
      }

      for (const invariant of invariantFindings(snapshot)) {
        const key = `${invariant.actual}|${invariant.expected}|${invariant.subsystem}`;
        if (!findings.some((finding) => finding.key === key)) {
          const evidence = `screenshots/invariant-${screenshots.length}.png`;
          await page.screenshot({ path: path.join(outputRoot, evidence), fullPage: true });
          findings.push({
            key,
            severity: "P1",
            confidence: "high",
            title: "Player-visible state invariant violation",
            experience: `The visible state reported ${invariant.actual}.`,
            steps: "Start a run with the autonomous playtester and observe the telemetry at the recorded timestamp.",
            expected: invariant.expected,
            actual: invariant.actual,
            evidence,
            subsystem: invariant.subsystem,
            reproduced: false
          });
        } else {
          const existing = findings.find((finding) => finding.key === key);
          if (existing) existing.reproduced = true;
        }
      }

      const roomState = `${state.roomType || "unknown"}:${state.roomCleared ? "cleared" : "active"}`;
      if (state.phase !== previousPhase || state.depth !== previousDepth || roomState !== previousRoom) {
        const reason = state.phase !== previousPhase ? `phase-${state.phase}` : state.depth !== previousDepth ? `depth-${state.depth}` : `room-${roomState}`;
        if (!capturedStateReasons.has(reason) && screenshots.length < MAX_STATE_SCREENSHOTS) {
          const file = `screenshots/${String(screenshots.length).padStart(3, "0")}-${clampLabel(reason)}.png`;
          await page.screenshot({ path: path.join(outputRoot, file), fullPage: true });
          screenshots.push({ file, reason, elapsedMs: Date.now() - sessionStart });
          capturedStateReasons.add(reason);
        }
        majorDecisionPoints.push({ ts: snapshot.ts, elapsedMs: Date.now() - sessionStart, reason, state, visibleActions: snapshot.dom.actions, visibleLog: snapshot.dom.log });
        previousPhase = state.phase || "";
        previousDepth = Number(state.depth ?? -1);
        previousRoom = roomState;
      }

      if (state.phase === "dead" && previousDeathCount < deaths.length + 1) {
        const file = `screenshots/${String(screenshots.length).padStart(3, "0")}-death-${deaths.length + 1}.png`;
        await page.screenshot({ path: path.join(outputRoot, file), fullPage: true });
        screenshots.push({ file, reason: "death", elapsedMs: Date.now() - sessionStart });
        deaths.push({ ts: snapshot.ts, depth: state.depth, cause: snapshot.dom.log || snapshot.dom.overlay || "Unknown from visible UI", evidence: file });
        previousDeathCount = deaths.length;
      }

      if (snapshot.adapterError) {
        findings.push({
          key: `adapter-${snapshot.adapterError}`,
          severity: "P1",
          confidence: "high",
          title: "Read-only QA state adapter failed",
          experience: "The playtester could not read the player-visible state adapter.",
          steps: "Start the game and run the autonomous playtester until a telemetry sample reports the adapter error.",
          expected: "render_game_to_text() returns valid JSON during the session.",
          actual: snapshot.adapterError,
          evidence: "telemetry.json",
          subsystem: "development instrumentation",
          reproduced: false
        });
      }

      const secondsWithoutProgress = (Date.now() - lastProgressAt) / 1000;
      if (state.phase === "playing" && secondsWithoutProgress >= 30 && recoveryAttempts < 3) {
        const recoveryKey = ["ArrowUp", "ArrowRight", "Escape"][recoveryAttempts];
        recoveryAttempts += 1;
        majorDecisionPoints.push({ ts: new Date().toISOString(), elapsedMs: Date.now() - sessionStart, reason: `watchdog-recovery-${recoveryKey}`, state, visibleActions: snapshot.dom.actions, visibleLog: snapshot.dom.log });
        await page.keyboard.press(recoveryKey);
        await page.waitForTimeout(2_000);
      } else if (state.phase === "playing" && secondsWithoutProgress >= 38 && recoveryAttempts >= 3) {
        const key = `softlock-${state.depth}-${state.roomType}-${state.turn}`;
        if (!findings.some((finding) => finding.key === key)) {
          const evidence = `screenshots/${String(screenshots.length).padStart(3, "0")}-suspected-softlock.png`;
          await page.screenshot({ path: path.join(outputRoot, evidence), fullPage: true });
          screenshots.push({ file: evidence, reason: "suspected-softlock", elapsedMs: Date.now() - sessionStart });
          findings.push({
            key,
            severity: "P1",
            confidence: "medium",
            title: "Possible gameplay softlock",
            experience: `The visible run stayed at depth ${state.depth}, turn ${state.turn}, room ${state.roomType} without progress for over 38 seconds.`,
            steps: "Start a run, enable the observer bot, wait for the recorded depth/room, then allow the watchdog to attempt ArrowUp, ArrowRight, and Escape recovery inputs.",
            expected: "A normal visible recovery action advances or changes the room state.",
            actual: "The state remained unchanged after three normal recovery inputs.",
            evidence,
            subsystem: "turn resolution / input handling",
            reproduced: false
          });
        }
        lastProgressAt = Date.now();
      }

      await page.waitForTimeout(1_000);
    }
  } catch (error) {
    sessionError = String(error?.stack || error);
    findings.push({
      key: `runner-${sessionError}`,
      severity: "P0",
      confidence: "high",
      title: "Playtest runner failed",
      experience: "The autonomous playtester could not complete its browser session.",
      steps: "Run the command recorded in the report and inspect browser-console.json and dungeon.trace.zip.",
      expected: "The visible headed session remains controllable for the requested duration.",
      actual: sessionError,
      evidence: "browser-console.json",
      subsystem: "playtest harness",
      reproduced: false
    });
  } finally {
    if (page && !page.isClosed()) {
      try {
        finalSnapshot = await collectSnapshot(page);
        lastSnapshot = finalSnapshot;
        telemetry.push({ elapsedMs: durationMs, final: true, ...finalSnapshot });
        const finalFile = "screenshots/final-state.png";
        await page.screenshot({ path: path.join(outputRoot, finalFile), fullPage: true });
        screenshots.push({ file: finalFile, reason: "final-state" });
      } catch (error) {
        diagnostics.pageErrors.push({ ts: new Date().toISOString(), text: `final capture: ${String(error?.stack || error)}` });
      }
    }
    if (context) {
      try { await context.tracing.stop({ path: tracePath }); } catch (error) { diagnostics.pageErrors.push({ ts: new Date().toISOString(), text: `trace: ${String(error)}` }); }
      try { await context.close(); } catch (error) { diagnostics.pageErrors.push({ ts: new Date().toISOString(), text: `context: ${String(error)}` }); }
    }
    if (browser) {
      try { await browser.close(); } catch (error) { diagnostics.pageErrors.push({ ts: new Date().toISOString(), text: `browser: ${String(error)}` }); }
    }
    if (server) await new Promise((resolve) => server.close(resolve));
  }

  const finalState = finalSnapshot?.state || lastSnapshot?.state || {};
  const observedDeathCount = Math.max(
    deaths.length,
    ...telemetry.map((sample) => {
      const match = String(sample?.dom?.hud || "").match(/Deaths\s*(\d+)/i);
      return match ? Math.max(0, Number(match[1]) || 0) : 0;
    })
  );
  const maxDepth = Math.max(0, ...telemetry.map((sample) => Math.max(0, Number(sample?.state?.depth) || 0)));
  const timeByDepthMs = {};
  for (let index = 0; index < telemetry.length - 1; index += 1) {
    const sample = telemetry[index];
    const nextSample = telemetry[index + 1];
    const depth = Math.max(0, Number(sample?.state?.depth) || 0);
    const elapsed = Math.max(0, Number(nextSample?.elapsedMs) - Number(sample?.elapsedMs));
    timeByDepthMs[depth] = (timeByDepthMs[depth] || 0) + elapsed;
  }
  const timeByDepthSummary = Object.entries(timeByDepthMs)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([depth, elapsed]) => `D${depth}: ${Math.round(Number(elapsed) / 1000)}s`)
    .join(", ") || "none";
  const durationSeconds = Math.max(0, Math.round((telemetry.length ? Date.parse(telemetry.at(-1).ts) - Date.parse(telemetry[0].ts) : durationMs) / 1000));
  const actionableNetwork = diagnostics.network.filter((entry) => {
    const abortedAudio = entry.failure?.errorText === "net::ERR_ABORTED" && /\.(mp3|wav|ogg)(?:$|\?)/i.test(new URL(entry.url).pathname);
    return !abortedAudio;
  });
  const actionableHttp = diagnostics.http.filter((entry) => !entry.url.endsWith("/favicon.ico"));
  const consoleBugCount = diagnostics.pageErrors.length + actionableNetwork.length + actionableHttp.length;
  for (const error of diagnostics.pageErrors) {
    const key = `pageerror-${error.text}`;
    if (!findings.some((finding) => finding.key === key)) {
      findings.push({
        key,
        severity: "P1",
        confidence: "high",
        title: "Uncaught browser exception",
        experience: "The browser reported an uncaught exception during play.",
        steps: "Start the game and follow the automated run until the timestamp in browser-console.json.",
        expected: "No uncaught exception occurs during ordinary play.",
        actual: error.text,
        evidence: "browser-console.json",
        subsystem: "runtime",
        reproduced: diagnostics.pageErrors.filter((candidate) => candidate.text === error.text).length > 1
      });
    }
  }
  for (const error of actionableNetwork) {
    const key = `network-${error.url}-${error.failure?.errorText || "failed"}`;
    if (!findings.some((finding) => finding.key === key)) {
      findings.push({
        key,
        severity: "P1",
        confidence: "high",
        title: "Network request failed",
        experience: `The browser failed to load ${error.url}.`,
        steps: "Start the game and follow the automated run until the failed request appears in browser-console.json.",
        expected: "All required game resources load successfully.",
        actual: error.failure?.errorText || "request failed",
        evidence: "browser-console.json",
        subsystem: "asset/network loading",
        reproduced: actionableNetwork.filter((candidate) => candidate.url === error.url).length > 1
      });
    }
  }

  const confirmed = findings.filter((finding) => finding.severity === "P0" || (finding.confidence === "high" && !finding.title.includes("Possible")));
  const probable = findings.filter((finding) => !confirmed.includes(finding));
  const finalBuild = {
    player: finalState.player || {},
    visibleMutators: lastSnapshot?.dom?.mutators || "",
    visibleEffects: lastSnapshot?.dom?.activeEffects || "",
    visibleSkills: lastSnapshot?.dom?.skills || ""
  };
  const report = [
    `session duration: ${durationSeconds}s (${smoke ? "smoke" : "full"} run; requested ${Math.round(durationMs / 1000)}s)`,
    `maximum depth: ${maxDepth}`,
    `deaths: ${observedDeathCount}`,
    `final build: ${JSON.stringify(finalBuild)}`,
    `random seed: ${seed}`,
    `confirmed bugs: ${confirmed.length}`,
    `probable bugs: ${probable.length}`,
    `UX concerns: 0`,
    `balance concerns: 0`,
    "",
    "# Dungeon of One Room — Autonomous Playtest QA Report",
    "",
    `Mode: ${smoke ? "short smoke test" : `visible ${Math.round(durationMs / 1000)}-second gameplay session`}. The existing in-game Observer Bot was enabled through the visible debug control surface and was observed externally through the player-visible adapter and DOM.`,
    "",
    `Artifacts: [session video](video/), [Playwright trace](dungeon.trace.zip), [telemetry](telemetry.json), [browser console](browser-console.json).`,
    "",
    "## Run summary",
    "",
    `- Session started: ${telemetry[0]?.ts || "unknown"}`,
    `- Session ended: ${telemetry.at(-1)?.ts || "unknown"}`,
    `- Highest observed depth: ${maxDepth}`,
    `- Time spent at each depth: ${timeByDepthSummary}`,
    `- Death causes from visible UI: ${deaths.length ? deaths.map((death) => `depth ${death.depth}: ${String(death.cause).slice(0, 240)}`).join("; ") : observedDeathCount > 0 ? `${observedDeathCount} death(s) observed in the HUD; an immediate revive did not expose a death screen or visible cause.` : "none observed"}`,
    `- Major decision points recorded: ${majorDecisionPoints.length}`,
    `- Browser console entries: ${diagnostics.console.length}; page errors: ${diagnostics.pageErrors.length}; network failures: ${diagnostics.network.length}; HTTP failures: ${consoleBugCount}`,
    "",
    "## Findings",
    "",
    findings.length ? findings.sort((a, b) => String(a.severity).localeCompare(String(b.severity))).map(markdownBug).join("\n") : "No confirmed or probable bugs observed in this session.\n",
    "## UX and balance observations",
    "",
    "No UX or balance concern was promoted from this single run. The report retains screenshots, visible action text, decision-point telemetry, and the full video so repeated runs can be compared before classifying a concern.",
    "",
    "## Reproduction / rerun",
    "",
    "- Smoke: `node scripts/autonomous-playtester.mjs --smoke --seed=" + seed + "`",
    "- Full: `node scripts/autonomous-playtester.mjs --seed=" + seed + "`",
    "- The run uses a headed browser, moderate Playwright slow motion, seeded Math.random, video recording, trace recording, periodic telemetry, and watchdog recovery actions.",
    ""
  ].join("\n");

  writeJson(telemetryPath, {
    session: { seed, smoke, requestedDurationMs: durationMs, outputRoot, sessionError },
    finalState,
    maxDepth,
    timeByDepthMs,
    deaths,
    observedDeathCount,
    majorDecisionPoints,
    screenshots,
    diagnosticsSummary: {
      consoleEntries: diagnostics.console.length,
      pageErrors: diagnostics.pageErrors.length,
      networkFailures: actionableNetwork.length,
      httpFailures: actionableHttp.length
    },
    samples: telemetry
  });
  writeJson(consolePath, diagnostics);
  fs.writeFileSync(reportPath, report);

  console.log(JSON.stringify({
    report: reportPath,
    telemetry: telemetryPath,
    trace: tracePath,
    screenshots: screenshotRoot,
    video: videoRoot,
    seed,
    smoke,
    maxDepth,
    deaths: observedDeathCount,
    confirmedBugs: confirmed.length,
    probableBugs: probable.length
  }, null, 2));
}

await main();
