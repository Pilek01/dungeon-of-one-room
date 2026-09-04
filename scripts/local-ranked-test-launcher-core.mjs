import { execFile as nodeExecFile, spawn as nodeSpawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { startMultiBotWall as defaultStartMultiBotWall } from "./local-ranked-multi-bot-controller.mjs";
import { listBotLeaderboard as defaultListBotLeaderboard } from "./local-ranked-bot-results.mjs";
import { createMultiBotSessionPaths } from "./local-ranked-multi-bot-domain.mjs";

const FULL_COMMIT_HASH = /^[0-9a-f]{40}$/u;

function freezeRecord(record) {
  return Object.freeze(record);
}

function validTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function nullFields(value) {
  return String(value || "")
    .split("\0")
    .map((field) => field.trim());
}

function requireFullCommitHash(value) {
  const hash = String(value || "");
  if (!FULL_COMMIT_HASH.test(hash)) {
    throw new TypeError("A full commit hash must contain exactly 40 lowercase hexadecimal characters.");
  }
  return hash;
}

function safeChildPath(root, ...segments) {
  const candidate = path.resolve(root, ...segments);
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new TypeError("Launcher cache path escapes its owned output root.");
  }
  return candidate;
}

export function parseBranchTips(value) {
  const branches = [];
  const rows = String(value || "").split(/\r?\n/u);

  for (const row of rows) {
    const fields = nullFields(row);
    for (let index = 0; index + 2 < fields.length; index += 3) {
      const [name, hash, date] = fields.slice(index, index + 3);
      const timestamp = validTimestamp(date);
      if (!name || !FULL_COMMIT_HASH.test(hash) || timestamp === null) continue;
      branches.push(freezeRecord({ name, hash, date, timestamp }));
    }
  }

  return Object.freeze(branches);
}

export function chooseNewestBranch(branches, options = {}) {
  const excludedBranchName = String(options.excludedBranchName || "");
  const eligible = Array.from(branches || []).filter((branch) => branch?.name !== excludedBranchName);

  eligible.sort((left, right) => (
    right.timestamp - left.timestamp ||
    String(left.name).localeCompare(String(right.name))
  ));

  if (!eligible.length) throw new Error("No eligible local branch is available.");
  return eligible[0];
}

export function parseCommitHistory(value) {
  const fields = nullFields(value);
  const commits = [];
  const seen = new Set();

  for (let index = 0; index + 2 < fields.length; index += 3) {
    const [hash, date, subject] = fields.slice(index, index + 3);
    if (!FULL_COMMIT_HASH.test(hash) || validTimestamp(date) === null || seen.has(hash)) continue;
    seen.add(hash);
    commits.push(freezeRecord({ hash, date, subject }));
    if (commits.length === 5) break;
  }

  return Object.freeze(commits);
}

export function selectListedCommit(commits, value) {
  const hash = requireFullCommitHash(value);
  const selected = Array.from(commits || []).find((commit) => commit?.hash === hash);
  if (!selected) throw new RangeError("Selected commit is not one of the displayed commits.");
  return selected;
}

export function launcherPaths(repoRoot, value) {
  const hash = requireFullCommitHash(value);
  const root = path.resolve(String(repoRoot || ""));
  const cacheRoot = safeChildPath(root, "output", "local-ranked-test-launcher");

  return Object.freeze({
    root,
    hash,
    cacheRoot,
    worktree: safeChildPath(cacheRoot, "worktrees", hash),
    stateRoot: safeChildPath(root, "output", "r", hash)
  });
}


const execFileAsync = promisify(nodeExecFile);

async function defaultPathExists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function prepareRevision(selectedCommit, options = {}) {
  const hash = requireFullCommitHash(selectedCommit?.hash);
  const repoRoot = path.resolve(String(options.repoRoot || process.cwd()));
  const paths = launcherPaths(repoRoot, hash);
  const execFile = options.execFile || execFileAsync;
  const pathExists = options.pathExists || defaultPathExists;
  const mkdir = options.mkdir || fs.mkdir;

  if (!await pathExists(paths.worktree)) {
    await mkdir(path.dirname(paths.worktree), { recursive: true });
    await execFile("git", ["-c", "core.longpaths=true", "worktree", "add", "--detach", paths.worktree, hash], { cwd: repoRoot });
  } else {
    const result = await execFile(
      "git",
      ["-C", paths.worktree, "rev-parse", "HEAD"],
      { cwd: repoRoot }
    );
    const actualHash = String(result?.stdout || "").trim().toLowerCase();
    if (actualHash !== hash) {
      throw new Error("Cached launcher worktree does not match the selected commit.");
    }
  }

  const workerRoot = path.join(paths.worktree, "cloudflare", "leaderboard-v3");
  const wranglerPath = path.join(workerRoot, "node_modules", "wrangler", "bin", "wrangler.js");
  if (!await pathExists(wranglerPath)) {
    await execFile(process.env.ComSpec || process.env.COMSPEC || "cmd.exe", ["/d", "/s", "/c", "npm.cmd ci"], { cwd: workerRoot });
  }

  return Object.freeze({
    ...paths,
    workerRoot,
    bundleRoot: path.join(paths.worktree, "output", "pages-test-dist"),
    manifestPath: path.join(workerRoot, "src", "rulesets", "v08-meta-1", "data", "ruleset-manifest.json"),
    wranglerPath
  });
}
function requireRulesetHash(value) {
  const hash = String(value || "");
  if (!/^sha256:.+/u.test(hash)) {
    throw new TypeError("A sha256 ruleset hash is required.");
  }
  return hash;
}

export function patchProtocolRulesetHash(source, value) {
  const rulesetHash = requireRulesetHash(value);
  const pattern = /^  const RULESET_HASH = "[^"]+";$/gmu;
  const matches = String(source || "").match(pattern) || [];
  if (matches.length !== 1) {
    throw new Error("Expected exactly one RULESET_HASH declaration in the test bundle.");
  }
  return String(source).replace(pattern, `  const RULESET_HASH = ${JSON.stringify(rulesetHash)};`);
}

export function createTestBuildEnvironment(baseEnv = {}, observerPassword = "") {
  const environment = { ...baseEnv };
  delete environment.DUNGEON_ONLINE_TEST_BOT_PASSWORD;
  if (String(observerPassword || "")) {
    environment.DUNGEON_ONLINE_TEST_BOT_PASSWORD = String(observerPassword);
  }
  return Object.freeze(environment);
}

function requireLoopbackPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError("A valid loopback port is required.");
  }
  return port;
}

export function createWorkerLaunchPlan(prepared, options = {}) {
  const workerRoot = path.resolve(String(prepared?.workerRoot || ""));
  const bundleRoot = path.resolve(String(prepared?.bundleRoot || ""));
  const stateRoot = path.resolve(String(prepared?.stateRoot || ""));
  const wranglerPath = path.resolve(String(prepared?.wranglerPath || ""));
  const port = requireLoopbackPort(options.port);
  const secret = String(options.secret || randomBytes(48).toString("base64"));
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new TypeError("Worker signing secret must contain at least 32 UTF-8 bytes.");
  }
  const workerEnv = { ...(options.baseEnv || {}) };
  delete workerEnv.DUNGEON_ONLINE_TEST_BOT_PASSWORD;
  workerEnv.CLOUDFLARE_INCLUDE_PROCESS_ENV = "true";
  workerEnv.RANKED_V3_HMAC_SECRET = secret;
  if (String(options.wranglerLogPath || "")) {
    workerEnv.WRANGLER_LOG_PATH = path.resolve(String(options.wranglerLogPath));
    workerEnv.WRANGLER_LOG_SANITIZE = "true";
  }
  const configPath = path.join(workerRoot, "wrangler.local.jsonc");
  const workerArgs = Object.freeze([
    "dev",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    stateRoot,
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--assets",
    bundleRoot,
    "--log-level",
    "error"
  ]);
  return Object.freeze({
    command: process.execPath,
    args: Object.freeze([wranglerPath, ...workerArgs]),
    workerArgs,
    workerEnv: Object.freeze(workerEnv),
    url: `http://127.0.0.1:${port}`
  });
}

export function redactLaunchLog(value, secrets = []) {
  const uniqueSecrets = [...new Set(secrets.map((secret) => String(secret || "")).filter(Boolean))]
    .sort((left, right) => right.length - left.length);
  return uniqueSecrets.reduce(
    (text, secret) => text.split(secret).join("[redacted]"),
    String(value || "")
  );
}
export async function buildSelectedTestBundle(prepared, options = {}) {
  const execFile = options.execFile || execFileAsync;
  const readFile = options.readFile || fs.readFile;
  const writeFile = options.writeFile || fs.writeFile;
  const environment = createTestBuildEnvironment(
    options.baseEnv || process.env,
    options.observerPassword
  );

  await execFile(
    process.execPath,
    ["scripts/build-pages-v3.mjs", "--target", "test"],
    { cwd: prepared.worktree, env: environment }
  );
  const manifest = JSON.parse(await readFile(prepared.manifestPath, "utf8"));
  const rulesetHash = requireRulesetHash(manifest?.rulesetHash);
  const protocolPath = path.join(prepared.bundleRoot, "online-v3", "ranked-v3-protocol.js");
  const protocolSource = await readFile(protocolPath, "utf8");
  await writeFile(protocolPath, patchProtocolRulesetHash(protocolSource, rulesetHash), "utf8");

  return Object.freeze({ rulesetHash, protocolPath });
}

export async function applyLocalMigrations(prepared, options = {}) {
  const execFile = options.execFile || execFileAsync;
  const workerRoot = path.resolve(String(prepared?.workerRoot || ""));
  const workerEnv = options.workerEnv || process.env;
  await execFile(process.execPath, [
    prepared.wranglerPath,
    "d1",
    "migrations",
    "apply",
    "dungeon-online-v3-local",
    "--local",
    "--config",
    path.join(workerRoot, "wrangler.local.jsonc"),
    "--persist-to",
    prepared.stateRoot
  ], {
    cwd: workerRoot,
    env: workerEnv,
    windowsHide: true
  });
}
export async function acquireLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!address || typeof address === "string") {
    throw new Error("Unable to acquire a loopback port.");
  }
  return address.port;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createLocalWorkerHealthMonitor(url, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  const setIntervalImpl = options.setInterval || globalThis.setInterval;
  const clearIntervalImpl = options.clearInterval || globalThis.clearInterval;
  const intervalMs = Math.max(100, Math.floor(Number(options.intervalMs) || 500));
  const failureThreshold = Math.max(1, Math.floor(Number(options.failureThreshold) || 2));
  const onUnavailable = typeof options.onUnavailable === "function" ? options.onUnavailable : () => {};
  const onRecovered = typeof options.onRecovered === "function" ? options.onRecovered : () => {};
  let consecutiveFailures = 0;
  let confirmedOutageFailures = 0;
  let outage = false;
  let checking = false;
  let stopped = false;

  async function checkNow() {
    if (stopped || checking) return;
    checking = true;
    let healthy = false;
    try {
      const response = await fetchImpl(`${String(url).replace(/\/+$/u, "")}/api/v3/availability`, {
        cache: "no-store"
      });
      healthy = response?.ok === true;
    } catch {}

    try {
      if (healthy) {
        if (outage) {
          const failures = confirmedOutageFailures;
          outage = false;
          consecutiveFailures = 0;
          confirmedOutageFailures = 0;
          await onRecovered(Object.freeze({ url: String(url), failures }));
        } else {
          consecutiveFailures = 0;
        }
        return;
      }

      consecutiveFailures += 1;
      if (!outage && consecutiveFailures >= failureThreshold) {
        outage = true;
        confirmedOutageFailures = consecutiveFailures;
        await onUnavailable(Object.freeze({ url: String(url), failures: consecutiveFailures }));
      } else if (outage) {
        confirmedOutageFailures = consecutiveFailures;
      }
    } finally {
      checking = false;
    }
  }

  const timer = setIntervalImpl(() => { checkNow().catch(() => {}); }, intervalMs);
  timer?.unref?.();

  return Object.freeze({
    checkNow,
    stop() {
      if (stopped) return;
      stopped = true;
      clearIntervalImpl(timer);
    }
  });
}

export async function waitForLocalReady(url, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleep = options.sleep || wait;
  const timeoutMs = Number(options.timeoutMs || 15_000);
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetchImpl(`${url}/api/v3/availability`);
      if (response?.ok) return;
      lastError = new Error(`Local Worker returned HTTP ${response?.status || "unknown"}.`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }

  const detail = String(lastError?.message || "no response");
  throw new Error(`Local Worker did not become ready within ${timeoutMs}ms: ${detail}`);
}

function attachLogStream(stream, append) {
  if (!stream?.on) return;
  stream.setEncoding?.("utf8");
  stream.on("data", append);
}

function awaitChildExit(child) {
  if (child.exitCode !== null && child.exitCode !== undefined) return Promise.resolve();
  return new Promise((resolve) => child.once?.("exit", resolve) || resolve());
}

function defaultIsPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}
export async function forceStopLocalWorker(child, options = {}) {
  const forceSignal = () => child?.kill?.("SIGKILL");
  const platform = options.platform || process.platform;
  const pid = Number(child?.pid);
  if (platform !== "win32" || !Number.isInteger(pid) || pid < 1) {
    forceSignal();
    return false;
  }
  const execFile = options.execFile || execFileAsync;
  const isPidAlive = options.isPidAlive || defaultIsPidAlive;
  try {
    await execFile("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
    return true;
  } catch {
    if (!isPidAlive(pid)) return true;
    forceSignal();
    return false;
  }
}

export async function startLocalRankedTest(selectedCommit, options = {}) {
  const prepare = options.prepareRevision || prepareRevision;
  const build = options.buildSelectedTestBundle || buildSelectedTestBundle;
  const acquirePort = options.acquirePort || acquireLoopbackPort;
  const spawn = options.spawn || nodeSpawn;
  const waitForReady = options.waitForLocalReady || waitForLocalReady;
  const createHealthMonitor = options.createLocalWorkerHealthMonitor || createLocalWorkerHealthMonitor;
  const applyMigrations = options.applyLocalMigrations || applyLocalMigrations;
  const forceStop = options.forceStopLocalWorker || forceStopLocalWorker;
  const baseEnv = options.baseEnv || process.env;
  const prepared = await prepare(selectedCommit, { repoRoot: options.repoRoot });
  const bundle = await build(prepared, {
    baseEnv,
    observerPassword: options.observerPassword
  });
  const port = await acquirePort();
  const launch = createWorkerLaunchPlan(prepared, {
    baseEnv,
    port,
    secret: options.secret,
    wranglerLogPath: options.wranglerLogPath
  });
  await applyMigrations(prepared, { workerEnv: launch.workerEnv });
  let logs = "";
  const append = (chunk) => {
    logs = redactLaunchLog(
      `${logs}${String(chunk || "")}`.slice(-100_000),
      [launch.workerEnv.RANKED_V3_HMAC_SECRET, options.observerPassword]
    );
  };
  let stopped = false;
  let forceStopped = false;
  let terminalExited = false;
  let initialReady = false;
  let currentChild = null;
  let healthMonitor = null;
  let healthOutageChild = null;
  let restartPromise = null;
  let consecutiveRestartAttempts = 0;
  const maxWorkerRestarts = Math.max(0, Math.min(10, Math.floor(
    options.maxWorkerRestarts === undefined ? 3 : Number(options.maxWorkerRestarts)
  )));
  const restartDelayMs = Math.max(0, Math.min(10_000,
    options.restartDelayMs === undefined ? 250 : Number(options.restartDelayMs)
  ));
  const exitListeners = new Set();
  const restartListeners = new Set();

  function notifyExit(event) {
    for (const listener of exitListeners) {
      Promise.resolve(listener(event)).catch(() => {});
    }
  }

  function notifyRestart(event) {
    for (const listener of restartListeners) {
      Promise.resolve(listener(event)).catch(() => {});
    }
  }

  async function stopChild(child) {
    if (!child || (child.exitCode !== null && child.exitCode !== undefined)) return;
    let forceConfirmed = false;
    child.kill();
    await Promise.race([awaitChildExit(child), wait(5_000)]);
    if (child.exitCode === null) {
      forceConfirmed = await forceStop(child);
      forceStopped = forceStopped || forceConfirmed;
      await Promise.race([awaitChildExit(child), wait(5_000)]);
    }
    if (child.exitCode === null && !forceConfirmed) {
      throw new Error("Local Worker did not exit after Stop.");
    }
  }

  async function recoverWorker(initialEvent) {
    let lastEvent = initialEvent;
    let lastError = null;
    while (!stopped && consecutiveRestartAttempts < maxWorkerRestarts) {
      consecutiveRestartAttempts += 1;
      const attempt = consecutiveRestartAttempts;
      append(`\n[launcher] Shared local Worker exited (${lastEvent.code ?? "unknown"}); restart ${attempt}/${maxWorkerRestarts}.\n`);
      if (restartDelayMs > 0) await wait(restartDelayMs);
      if (stopped) return;
      const replacement = spawnWorker();
      try {
        await waitForReady(launch.url, { fetchImpl: options.fetchImpl });
        if (replacement.exitCode !== null && replacement.exitCode !== undefined) {
          throw new Error(`Replacement local Worker exited (${replacement.exitCode}) before readiness.`);
        }
        if (stopped) {
          await stopChild(replacement);
          return;
        }
        append(`[launcher] Shared local Worker restart ${attempt} is ready at ${launch.url}.\n`);
        consecutiveRestartAttempts = 0;
        notifyRestart({
          attempt,
          previousCode: initialEvent.code,
          previousSignal: initialEvent.signal,
          url: launch.url
        });
        return;
      } catch (error) {
        lastError = error;
        append(`[launcher] Shared local Worker restart ${attempt} failed: ${error?.message || error}.\n`);
        await stopChild(replacement).catch(() => {});
        lastEvent = {
          code: replacement.exitCode,
          signal: null
        };
      }
    }
    if (stopped) return;
    terminalExited = true;
    healthMonitor?.stop();
    notifyExit({
      expected: false,
      code: initialEvent.code,
      signal: initialEvent.signal,
      restartAttempts: consecutiveRestartAttempts,
      error: String(lastError?.message || "Local Worker restart budget exhausted.")
    });
  }

  function spawnWorker() {
    const child = spawn(launch.command, launch.args, {
      cwd: prepared.workerRoot,
      env: launch.workerEnv,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    currentChild = child;
    attachLogStream(child.stdout, append);
    attachLogStream(child.stderr, append);
    child.on?.("exit", (code, signal) => {
      if (child !== currentChild) return;
      if (stopped) {
        notifyExit({ expected: true, code, signal });
        return;
      }
      if (!initialReady) return;
      if (restartPromise) return;
      restartPromise = recoverWorker({ code, signal }).finally(() => {
        restartPromise = null;
      });
    });
    return child;
  }

  spawnWorker();
  const exitHandler = () => {
    stopped = true;
    if (currentChild?.exitCode === null) currentChild.kill();
  };
  process.once("exit", exitHandler);

  async function stop() {
    if (stopped) return;
    stopped = true;
    process.removeListener("exit", exitHandler);
    healthMonitor?.stop();
    await stopChild(currentChild);
    terminalExited = true;
  }

  try {
    await waitForReady(launch.url, { fetchImpl: options.fetchImpl });
    if (currentChild?.exitCode !== null && currentChild?.exitCode !== undefined) {
      throw new Error(`Local Worker exited (${currentChild.exitCode}) before initial readiness.`);
    }
    initialReady = true;
    healthMonitor = createHealthMonitor(launch.url, {
      fetchImpl: options.fetchImpl,
      intervalMs: options.healthCheckIntervalMs,
      failureThreshold: options.healthFailureThreshold,
      onUnavailable(event) {
        healthOutageChild = currentChild;
        append(`\n[launcher] Shared local Worker availability was lost after ${event.failures} failed probes.\n`);
      },
      async onRecovered(event) {
        const outageChild = healthOutageChild;
        healthOutageChild = null;
        if (
          stopped ||
          !outageChild ||
          outageChild !== currentChild ||
          restartPromise ||
          outageChild.exitCode !== null && outageChild.exitCode !== undefined
        ) return;
        append(`[launcher] Shared local Worker recovered internally after ${event.failures} failed probes.\n`);
        notifyRestart({
          attempt: 1,
          previousCode: null,
          previousSignal: null,
          url: launch.url,
          internalRuntime: true,
          healthFailures: event.failures
        });
      }
    });
  } catch (error) {
    await stop();
    throw error;
  }

  return Object.freeze({
    url: launch.url,
    prepared,
    bundle,
    workerArgs: launch.workerArgs,
    hasExited: () => stopped || forceStopped || terminalExited,
    getLogs: () => logs,
    onExit(listener) {
      if (typeof listener !== "function") throw new TypeError("A Worker exit listener is required.");
      exitListeners.add(listener);
      return () => exitListeners.delete(listener);
    },
    onRestart(listener) {
      if (typeof listener !== "function") throw new TypeError("A Worker restart listener is required.");
      restartListeners.add(listener);
      return () => restartListeners.delete(listener);
    },
    stop
  });
}
export async function listLocalCandidates(options = {}) {
  const execFile = options.execFile || execFileAsync;
  const repoRoot = path.resolve(String(options.repoRoot || process.cwd()));
  const commandOptions = { cwd: repoRoot, maxBuffer: 256 * 1024 };
  const hostResult = await execFile("git", ["branch", "--show-current"], commandOptions);
  const excludedBranchName = String(hostResult?.stdout || "").trim();
  if (!excludedBranchName) {
    throw new Error("Local launcher must run from its named host branch.");
  }
  const branchResult = await execFile(
    "git",
    ["for-each-ref", "refs/heads", "--format=%(refname:short)%00%(objectname)%00%(committerdate:iso-strict)"],
    commandOptions
  );
  const branches = parseBranchTips(branchResult?.stdout);
  const branch = excludedBranchName === "main"
    ? branches.find((candidate) => candidate.name === "main") || chooseNewestBranch(branches)
    : chooseNewestBranch(branches, { excludedBranchName });
  const historyResult = await execFile(
    "git",
    ["log", branch.name, "-5", "--format=%H%x00%cI%x00%s%x00"],
    commandOptions
  );
  const commits = parseCommitHistory(historyResult?.stdout);
  if (!commits.length) {
    throw new Error("The selected local branch has no eligible commits.");
  }
  return Object.freeze({ excludedBranchName, branch, commits });
}

function readCliOption(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function readPortraitMonitor(args) {
  const monitor = {
    x: Number(readCliOption(args, "--monitor-x")),
    y: Number(readCliOption(args, "--monitor-y")),
    width: Number(readCliOption(args, "--monitor-width")),
    height: Number(readCliOption(args, "--monitor-height"))
  };
  if (
    !Object.values(monitor).every(Number.isInteger) ||
    monitor.width < 800 ||
    monitor.height <= monitor.width
  ) {
    throw new TypeError("Eight-bot mode requires four integer bounds for a portrait monitor.");
  }
  return Object.freeze(monitor);
}

function createMultiBotSessionId() {
  const timestamp = new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
  return `session-${timestamp}-${randomBytes(4).toString("hex")}`;
}

function writeJsonLine(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function launchErrorMessage(error) {
  const message = String(error?.message || "Unknown local launcher error.");
  return redactLaunchLog(message, [process.env.RANKED_V3_HMAC_SECRET, process.env.DUNGEON_ONLINE_TEST_BOT_PASSWORD]);
}

export async function runLauncherCli(args = process.argv.slice(2), options = {}) {
  const command = args[0];
  const emit = options.emit || writeJsonLine;
  const repoRoot = options.repoRoot || process.cwd();
  const listCandidates = options.listLocalCandidates || listLocalCandidates;
  const listBotLeaderboard = options.listBotLeaderboard || defaultListBotLeaderboard;
  const startWorker = options.startLocalRankedTest || startLocalRankedTest;
  const startWall = options.startMultiBotWall || defaultStartMultiBotWall;
  if (command === "list" && args.includes("--json")) {
    return listCandidates({ repoRoot, execFile: options.execFile });
  }
  if (command === "leaderboard" && args.includes("--json")) {
    const scope = String(readCliOption(args, "--scope") || "all").toLowerCase();
    if (!["today", "all"].includes(scope)) {
      throw new TypeError("Local bot leaderboard scope must be today or all.");
    }
    const records = await listBotLeaderboard(
      path.join(path.resolve(repoRoot), "output", "multi-bot-runs"),
      { scope }
    );
    return Object.freeze({ records });
  }
  if (command !== "start" || !args.includes("--json-events")) {
    throw new Error("Use 'list --json', 'leaderboard --json --scope today|all', single 'start --commit <full-hash> --json-events', or 'start --multi-bot --json-events' with monitor bounds.");
  }

  try {
    const multiBot = args.includes("--multi-bot");
    if (multiBot && args.includes("--commit")) {
      throw new TypeError("Eight-bot mode does not accept --commit; it always uses the newest displayed commit.");
    }
    const monitor = multiBot ? readPortraitMonitor(args) : null;
    const candidates = await listCandidates({ repoRoot, execFile: options.execFile });
    const selectedCommit = multiBot
      ? selectListedCommit(candidates.commits, candidates.commits[0]?.hash)
      : selectListedCommit(candidates.commits, readCliOption(args, "--commit"));
    const baseEnv = options.baseEnv || process.env;
    const observerPassword = options.observerPassword ?? process.env.DUNGEON_ONLINE_TEST_BOT_PASSWORD;

    if (multiBot) {
      const workerSecret = options.workerSecret || randomBytes(48).toString("base64");
      const sessionId = options.sessionId || createMultiBotSessionId();
      const sessionPaths = createMultiBotSessionPaths(repoRoot, sessionId);
      emit({ type: "wall_starting", branch: candidates.branch.name, commit: selectedCommit.hash });
      const worker = await startWorker(selectedCommit, {
        repoRoot,
        observerPassword,
        baseEnv,
        secret: workerSecret,
        wranglerLogPath: sessionPaths.wranglerLogPath,
        restartDelayMs: options.restartDelayMs,
        maxWorkerRestarts: options.maxWorkerRestarts,
        prepareRevision: options.prepareRevision,
        buildSelectedTestBundle: options.buildSelectedTestBundle,
        acquirePort: options.acquirePort,
        spawn: options.spawn,
        waitForLocalReady: options.waitForLocalReady,
        applyLocalMigrations: options.applyLocalMigrations,
        forceStopLocalWorker: options.forceStopLocalWorker
      });
      try {
        const wall = await startWall({
          repoRoot,
          sessionId,
          commit: selectedCommit.hash,
          monitor,
          worker,
          password: observerPassword,
          secret: workerSecret,
          chromeExecutable: options.chromeExecutable,
          emit
        });
        emit({ type: "wall_ready", url: worker.url, commit: selectedCommit.hash });
        return wall;
      } catch (error) {
        await worker.stop().catch(() => {});
        throw error;
      }
    }

    emit({ type: "starting", branch: candidates.branch.name, commit: selectedCommit.hash });
    const controller = await startWorker(selectedCommit, {
      repoRoot,
      observerPassword,
      baseEnv,
      prepareRevision: options.prepareRevision,
      buildSelectedTestBundle: options.buildSelectedTestBundle,
      acquirePort: options.acquirePort,
      spawn: options.spawn,
      waitForLocalReady: options.waitForLocalReady
    });
    emit({ type: "ready", url: controller.url, commit: selectedCommit.hash });
    return controller;
  } catch (error) {
    emit({ type: "failed", message: launchErrorMessage(error) });
    throw error;
  }
}

export function attachLauncherCommandInput(input, controller, emit = writeJsonLine) {
  let buffer = "";
  let chain = Promise.resolve();

  const enqueue = (line) => {
    if (!line.trim()) return;
    chain = chain.then(async () => {
      try {
        const command = JSON.parse(line);
        if (command?.type === "stop") {
          await controller.stop();
          emit({ type: "stopped" });
          return;
        }
        if (!/^bot-0[1-8]$/u.test(String(command?.botId || ""))) {
          throw new TypeError("A bot command requires bot-01 through bot-08.");
        }
        if (command.type === "stop_bot") {
          await controller.stopBot(command.botId);
          return;
        }
        if (command.type === "focus_bot") {
          await controller.focusBot(command.botId);
          return;
        }
        throw new TypeError("Unknown launcher command.");
      } catch (error) {
        emit({ type: "command_failed", message: launchErrorMessage(error) });
      }
    });
  };

  input.setEncoding?.("utf8");
  input.on("data", (chunk) => {
    buffer += String(chunk || "");
    const lines = buffer.split(/\r?\n/u);
    buffer = lines.pop() || "";
    for (const line of lines) enqueue(line);
  });
  input.on("end", () => {
    if (buffer.trim()) enqueue(buffer);
    buffer = "";
  });

  return Object.freeze({
    async drain() {
      await Promise.resolve();
      return chain;
    }
  });
}

async function runCliEntrypoint() {
  let controller = null;
  try {
    if (["list", "leaderboard"].includes(process.argv[2])) {
      writeJsonLine(await runLauncherCli());
      return;
    }
    controller = await runLauncherCli();
    let exiting = false;
    const stop = async () => {
      if (exiting) return;
      exiting = true;
      await controller.stop();
      writeJsonLine({ type: "stopped" });
      process.exit(0);
    };
    if (process.argv.includes("--multi-bot")) {
      attachLauncherCommandInput(process.stdin, controller, (event) => {
        writeJsonLine(event);
        if (event.type === "stopped") process.exit(0);
      });
      process.stdin.resume();
    }
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  } catch (error) {
    if (process.argv[2] !== "start") {
      writeJsonLine({ type: "failed", message: launchErrorMessage(error) });
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runCliEntrypoint();
}
