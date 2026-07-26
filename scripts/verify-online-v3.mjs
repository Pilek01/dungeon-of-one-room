import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = path.join(ROOT, "cloudflare", "leaderboard-v3");
const OUTPUT_ROOT = path.join(ROOT, "output", "verification");
const MODE = process.argv[2];
const MODES = new Set(["fast", "phase", "baseline", "full"]);
const NPM_CLI = process.env.npm_execpath || path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const SAFE_ROOT = ROOT.replaceAll("\\", "/");
const CURRENT_PHASE_TEST_PREFIX = "phase3b2c3b";
const CORE_FAST_TESTS = Object.freeze([
  "test/baseline-guard.test.js",
  "test/ruleset-manifest.test.js",
  "test/ruleset-registry.test.js"
]);

if (!MODES.has(MODE)) {
  console.error("Usage: node scripts/verify-online-v3.mjs <fast|phase|baseline|full>");
  process.exit(2);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.]/gu, "").replace("Z", "Z");
}

function seconds(started) {
  return `${((Date.now() - started) / 1000).toFixed(1)}s`;
}

function displayCommand(command, args) {
  return [command, ...args.map((value) => /\s/u.test(value) ? JSON.stringify(value) : value)].join(" ");
}

async function runProcess(command, args, options = {}) {
  const chunks = [];
  const child = spawn(command, args, {
    cwd: options.cwd || ROOT,
    env: options.env || process.env,
    windowsHide: true,
    shell: false
  });
  child.stdout.on("data", (chunk) => chunks.push(chunk.toString()));
  child.stderr.on("data", (chunk) => chunks.push(chunk.toString()));
  const code = await new Promise((resolve) => {
    child.once("error", (error) => {
      chunks.push(`${error.stack || error}\n`);
      resolve(1);
    });
    child.once("close", (value) => resolve(value ?? 1));
  });
  return {
    code,
    output: chunks.join(""),
    display: options.display || displayCommand(command, args)
  };
}

function tapTotals(output) {
  const result = { tests: 0, pass: 0, fail: 0, skipped: 0, suites: 0 };
  const patterns = {
    tests: /^(?:#|ℹ) tests (\d+)\r?$/gmu,
    pass: /^(?:#|ℹ) pass (\d+)\r?$/gmu,
    fail: /^(?:#|ℹ) fail (\d+)\r?$/gmu,
    skipped: /^(?:#|ℹ) skipped (\d+)\r?$/gmu,
    suites: /^(?:#|ℹ) suites (\d+)\r?$/gmu
  };
  let found = false;
  for (const [key, pattern] of Object.entries(patterns)) {
    const matches = [...output.matchAll(pattern)];
    if (matches.length) {
      result[key] = Number(matches.at(-1)[1]);
      found = true;
    }
  }
  return found ? result : null;
}

function totalsText(totals) {
  if (!totals) return "tests n/a";
  return `tests ${totals.tests}, pass ${totals.pass}, fail ${totals.fail}, skipped ${totals.skipped}`;
}

function mergeTotals(target, source) {
  if (!source) return;
  for (const key of Object.keys(target)) target[key] += source[key];
}

async function changedJavaScriptCheck() {
  const tracked = await runProcess("git", [
    "-c", `safe.directory=${SAFE_ROOT}`,
    "diff", "--name-only", "--diff-filter=ACMR", "HEAD", "--"
  ]);
  if (tracked.code !== 0) return tracked;
  const untracked = await runProcess("git", [
    "-c", `safe.directory=${SAFE_ROOT}`,
    "ls-files", "--others", "--exclude-standard"
  ]);
  if (untracked.code !== 0) return untracked;
  const files = [...new Set(`${tracked.output}\n${untracked.output}`
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => /\.(?:c?js|mjs)$/iu.test(value)))]
    .sort();
  const chunks = [];
  for (const relative of files) {
    const result = await runProcess(process.execPath, ["--check", relative]);
    chunks.push(`$ ${result.display}\n${result.output}`);
    if (result.code !== 0) {
      return { code: result.code, output: chunks.join(""), display: "node --check <changed JavaScript>" };
    }
  }
  if (!files.length) chunks.push("No changed JavaScript files.\n");
  return { code: 0, output: chunks.join(""), display: "node --check <changed JavaScript>" };
}

async function fastTests() {
  const entries = await fs.readdir(path.join(WORKER, "test"));
  const current = entries
    .filter((name) => name.startsWith(CURRENT_PHASE_TEST_PREFIX) && name.endsWith(".test.js"))
    .map((name) => `test/${name}`)
    .sort();
  const files = [...CORE_FAST_TESTS, ...current];
  return runProcess(
    process.execPath,
    ["--test", "--test-concurrency=1", ...files],
    { cwd: WORKER }
  );
}

async function cleanBaselineSmoke() {
  const tempRoot = path.resolve(os.tmpdir());
  const checkout = path.join(tempRoot, `dungeon-online-v3-baseline-${process.pid}-${Date.now()}`);
  if (!checkout.startsWith(`${tempRoot}${path.sep}`) || !path.basename(checkout).startsWith("dungeon-online-v3-baseline-")) {
    return { code: 1, output: "Unsafe temporary baseline path.\n", display: "clean headed baseline smoke" };
  }
  const chunks = [];
  const add = await runProcess("git", [
    "-c", `safe.directory=${SAFE_ROOT}`,
    "worktree", "add", "--detach", checkout, "HEAD"
  ]);
  chunks.push(`$ ${add.display}\n${add.output}`);
  if (add.code !== 0) return { code: add.code, output: chunks.join(""), display: "clean headed baseline smoke" };

  let result;
  try {
    result = await runProcess(process.execPath, ["scripts/online-v3-baseline-smoke.mjs"], { cwd: checkout });
    chunks.push(`$ ${result.display}\n${result.output}`);
  } finally {
    const remove = await runProcess("git", [
      "-c", `safe.directory=${SAFE_ROOT}`,
      "worktree", "remove", "--force", checkout
    ]);
    chunks.push(`$ ${remove.display}\n${remove.output}`);
    if (remove.code !== 0 && (!result || result.code === 0)) result = remove;
    await fs.rm(checkout, { recursive: true, force: true });
  }
  return {
    code: result?.code ?? 1,
    output: chunks.join(""),
    display: "clean headed baseline smoke"
  };
}

const generator = () => runProcess(process.execPath, ["scripts/generate-online-v3-meta-rules.mjs", "--check"]);
const diffCheck = () => runProcess("git", ["-c", `safe.directory=${SAFE_ROOT}`, "diff", "--check"]);
const workerUnit = () => runProcess(process.execPath, [NPM_CLI, "run", "validate:unit"], { cwd: WORKER, display: "npm run validate:unit" });
const workerE2e = () => runProcess(process.execPath, [NPM_CLI, "run", "test:e2e:local"], { cwd: WORKER, display: "npm run test:e2e:local" });
const protectedGuard = () => runProcess(
  process.execPath,
  ["--test", "--test-concurrency=1", "test/baseline-guard.test.js"],
  { cwd: WORKER }
);

const actions = {
  fast: [
    ["generator drift", generator],
    ["current ruleset checks", fastTests],
    ["changed JavaScript syntax", changedJavaScriptCheck],
    ["whitespace diff", diffCheck]
  ],
  phase: [
    ["generator drift", generator],
    ["Worker unit, fixture, property, and regression suite", workerUnit],
    ["changed JavaScript syntax", changedJavaScriptCheck],
    ["whitespace diff", diffCheck]
  ],
  baseline: [
    ["protected baseline guard", protectedGuard],
    ["headed game baseline smoke", cleanBaselineSmoke],
    ["whitespace diff", diffCheck]
  ],
  full: [
    ["generator drift", generator],
    ["Worker unit, fixture, property, and regression suite", workerUnit],
    ["changed JavaScript syntax", changedJavaScriptCheck],
    ["local Wrangler and D1 E2E", workerE2e],
    ["protected baseline guard", protectedGuard],
    ["headed game baseline smoke", cleanBaselineSmoke],
    ["whitespace diff", diffCheck]
  ]
};

await fs.mkdir(OUTPUT_ROOT, { recursive: true });
const stamp = timestamp();
const logPath = path.join(OUTPUT_ROOT, `${MODE}-${stamp}.log`);
const relativeLog = path.relative(ROOT, logPath).replaceAll("\\", "/");
await fs.writeFile(logPath, `Online v3 verification\nmode: ${MODE}\nstarted: ${new Date().toISOString()}\n\n`, "utf8");

const combined = { tests: 0, pass: 0, fail: 0, skipped: 0, suites: 0 };
const modeStarted = Date.now();
for (const [name, action] of actions[MODE]) {
  const started = Date.now();
  let result;
  try {
    result = await action();
  } catch (error) {
    result = { code: 1, output: `${error.stack || error}\n`, display: name };
  }
  const totals = tapTotals(result.output);
  mergeTotals(combined, totals);
  await fs.appendFile(
    logPath,
    `=== ${name} ===\n$ ${result.display}\n${result.output}${result.output.endsWith("\n") ? "" : "\n"}\n`,
    "utf8"
  );
  const status = result.code === 0 ? "PASS" : "FAIL";
  console.log(`[${status}] ${name} | ${seconds(started)} | ${totalsText(totals)} | ${relativeLog}`);
  if (result.code !== 0) {
    const tail = result.output.trim().split(/\r?\n/u).slice(-18).join("\n");
    if (tail) console.error(tail);
    await fs.appendFile(logPath, `RESULT: FAIL\nfinished: ${new Date().toISOString()}\n`, "utf8");
    process.exit(result.code || 1);
  }
}

await fs.appendFile(
  logPath,
  `RESULT: PASS\nduration: ${seconds(modeStarted)}\n${totalsText(combined)}\nfinished: ${new Date().toISOString()}\n`,
  "utf8"
);
console.log(`[PASS] verify:${MODE} | ${seconds(modeStarted)} | ${totalsText(combined)} | ${relativeLog}`);