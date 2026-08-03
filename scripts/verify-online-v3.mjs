import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = path.join(ROOT, "cloudflare", "leaderboard-v3");
const OUTPUT_ROOT = path.join(ROOT, "output", "verification");
function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const REQUESTED_MODE = process.argv[2];
const MODE = REQUESTED_MODE === "fast"
  ? "guard"
  : REQUESTED_MODE === "release"
    ? "full"
    : REQUESTED_MODE;
const FORCE = process.argv.includes("--force");
const MODES = new Set(["guard", "phase", "ui-current", "baseline", "ranked-headed", "full"]);
const SCENARIOS_BY_MODE = Object.freeze({
  "ui-current": new Set(["all", "boot", "hd", "save"]),
  "ranked-headed": new Set(["all", "recovery", "lifecycle", "camp"])
});
const HAS_SCENARIO_OPTION = process.argv.includes("--scenario");
const SCENARIO = HAS_SCENARIO_OPTION ? optionValue("--scenario") : "all";
const RECEIPT_SCHEMA = 1;
const NPM_CLI = process.env.npm_execpath || path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const SAFE_ROOT = ROOT.replaceAll("\\", "/");
const CORE_FAST_TESTS = Object.freeze([
  "test/baseline-guard.test.js",
  "test/ruleset-manifest.test.js",
  "test/ruleset-registry.test.js"
]);

if (!MODES.has(MODE)) {
  console.error(
    "Usage: node scripts/verify-online-v3.mjs " +
    "<guard|fast|phase|ui-current|baseline|ranked-headed|full|release> " +
    "[--scenario <name>] [--force]"
  );
  process.exit(2);
}
if (SCENARIOS_BY_MODE[MODE] && !SCENARIOS_BY_MODE[MODE].has(SCENARIO)) {
  console.error(`Unsupported ${MODE} scenario: ${SCENARIO}`);
  process.exit(2);
}
if (!SCENARIOS_BY_MODE[MODE] && HAS_SCENARIO_OPTION) {
  console.error(`verify:${MODE} does not accept --scenario`);
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

async function requiredGitOutput(args) {
  const result = await runProcess("git", [
    "-c", `safe.directory=${SAFE_ROOT}`,
    ...args
  ]);
  if (result.code !== 0) {
    throw new Error(`${result.display} failed:\n${result.output}`);
  }
  return result.output;
}

async function readPackageVersion(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    try {
      const manifest = JSON.parse(await fs.readFile(candidate, "utf8"));
      if (manifest?.version) return String(manifest.version);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return "unavailable";
}

function nulEntries(value) {
  return value.split("\0").filter(Boolean);
}

async function verificationInput() {
  const [headOutput, branchOutput, statusOutput, rawDiffOutput, changedOutput, untrackedOutput] =
    await Promise.all([
      requiredGitOutput(["rev-parse", "HEAD"]),
      requiredGitOutput(["branch", "--show-current"]),
      requiredGitOutput([
        "status", "--porcelain=v1", "-z", "--untracked-files=all",
        "--", ".", ":(exclude).wrangler"
      ]),
      requiredGitOutput(["diff", "--raw", "-z", "HEAD", "--"]),
      requiredGitOutput(["diff", "--name-only", "-z", "--diff-filter=ACMR", "HEAD", "--"]),
      requiredGitOutput([
        "ls-files", "--others", "--exclude-standard", "-z",
        "--", ".", ":(exclude).wrangler"
      ])
    ]);
  const playwrightRoot = process.env.DUNGEON_PLAYWRIGHT_NODE_MODULES;
  const workerModulesRoot = process.env.DUNGEON_ONLINE_V3_WORKER_NODE_MODULES;
  const [wranglerVersion, playwrightVersion] = await Promise.all([
    readPackageVersion([
      path.join(WORKER, "node_modules", "wrangler", "package.json")
    ]),
    readPackageVersion([
      playwrightRoot && path.join(playwrightRoot, "playwright", "package.json"),
      path.join(process.env.USERPROFILE || "", ".codex", "skills", "develop-web-game", "node_modules", "playwright", "package.json"),
      path.join(ROOT, "node_modules", "playwright", "package.json")
    ])
  ]);
  const files = [...new Set([
    ...nulEntries(changedOutput),
    ...nulEntries(untrackedOutput)
  ])].sort();
  const hash = createHash("sha256");
  const environment = {
    mode: MODE,
    scenario: SCENARIOS_BY_MODE[MODE] ? SCENARIO : null,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    wranglerVersion,
    playwrightVersion,
    playwrightRoot: playwrightRoot || "",
    workerModulesRoot: workerModulesRoot || ""
  };
  hash.update(JSON.stringify(environment));
  hash.update("\0status\0");
  hash.update(statusOutput);
  hash.update("\0raw-diff\0");
  hash.update(rawDiffOutput);
  for (const relative of files) {
    hash.update("\0file\0");
    hash.update(relative);
    hash.update("\0");
    try {
      hash.update(await fs.readFile(path.join(ROOT, relative)));
    } catch (error) {
      if (!["ENOENT", "EISDIR"].includes(error?.code)) throw error;
      hash.update(`[${error?.code || "unreadable"}]`);
    }
  }
  return {
    schema: RECEIPT_SCHEMA,
    mode: MODE,
    scenario: SCENARIOS_BY_MODE[MODE] ? SCENARIO : null,
    head: headOutput.trim(),
    branch: branchOutput.trim() || "(detached)",
    dirtyEntries: nulEntries(statusOutput).length,
    node: process.version,
    platform: `${process.platform}-${process.arch}-${os.release()}`,
    wranglerVersion,
    playwrightVersion,
    fingerprint: `sha256:${hash.digest("hex")}`
  };
}

function receiptPathFor(mode) {
  const scenarioSuffix = SCENARIOS_BY_MODE[mode] ? `-${SCENARIO}` : "";
  return path.join(OUTPUT_ROOT, `receipt-${mode}${scenarioSuffix}.json`);
}

function modeLabel() {
  return SCENARIOS_BY_MODE[MODE] ? `${MODE}:${SCENARIO}` : MODE;
}

async function reusableReceipt(input) {
  if (FORCE) return null;
  try {
    const receipt = JSON.parse(await fs.readFile(receiptPathFor(MODE), "utf8"));
    if (
      receipt?.schema === RECEIPT_SCHEMA &&
      receipt?.mode === MODE &&
      receipt?.result === "PASS" &&
      receipt?.fingerprint === input.fingerprint
    ) {
      return receipt;
    }
  } catch (error) {
    if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }
  return null;
}

async function writeReceipt(input, details) {
  const receiptPath = receiptPathFor(MODE);
  const temporaryPath = `${receiptPath}.${process.pid}.tmp`;
  const receipt = {
    ...input,
    ...details,
    schema: RECEIPT_SCHEMA,
    mode: MODE,
    result: "PASS"
  };
  await fs.writeFile(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, receiptPath);
  return receiptPath;
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

async function guardTests() {
  return runProcess(
    process.execPath,
    ["--test", "--test-concurrency=1", ...CORE_FAST_TESTS],
    { cwd: WORKER }
  );
}

async function cleanCommittedBrowser(script, args, display) {
  const tempRoot = path.resolve(os.tmpdir());
  const slug = display.replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "");
  const checkout = path.join(tempRoot, `dungeon-online-v3-${slug}-${process.pid}-${Date.now()}`);
  if (!checkout.startsWith(`${tempRoot}${path.sep}`) || !path.basename(checkout).startsWith("dungeon-online-v3-")) {
    return { code: 1, output: "Unsafe temporary browser-check path.\n", display };
  }
  const chunks = [];
  const add = await runProcess("git", [
    "-c", `safe.directory=${SAFE_ROOT}`,
    "worktree", "add", "--detach", checkout, "HEAD"
  ]);
  chunks.push(`$ ${add.display}\n${add.output}`);
  if (add.code !== 0) return { code: add.code, output: chunks.join(""), display };

  let result;
  try {
    result = await runProcess(process.execPath, [script, ...args], {
      cwd: checkout,
      env: {
        ...process.env,
        DUNGEON_ONLINE_V3_WORKER_NODE_MODULES: path.join(WORKER, "node_modules")
      }
    });
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
    display
  };
}

const cleanBaselineSmoke = () => cleanCommittedBrowser(
  "scripts/online-v3-baseline-smoke.mjs",
  ["--scenario", "all"],
  "clean committed baseline smoke"
);
const cleanRankedHeaded = () => cleanCommittedBrowser(
  "scripts/online-v3-ranked-headed.mjs",
  ["--scenario", "all"],
  "clean committed Ranked lifecycle"
);

const generator = () => runProcess(process.execPath, ["scripts/generate-online-v3-meta-rules.mjs", "--check"]);
const recordArchiveVisuals = () => runProcess(process.execPath, ["scripts/verify-record-archive-visuals.mjs"]);
const diffCheck = () => runProcess("git", ["-c", `safe.directory=${SAFE_ROOT}`, "diff", "--check"]);
const workerUnit = () => runProcess(process.execPath, [NPM_CLI, "run", "validate:unit"], { cwd: WORKER, display: "npm run validate:unit" });
const workerE2e = () => runProcess(process.execPath, [NPM_CLI, "run", "test:e2e:local"], { cwd: WORKER, display: "npm run test:e2e:local" });
const uiCurrent = () => runProcess(
  process.execPath,
  ["scripts/online-v3-baseline-smoke.mjs", "--scenario", SCENARIO]
);
const rankedHeadedCurrent = () => runProcess(
  process.execPath,
  ["scripts/online-v3-ranked-headed.mjs", "--scenario", SCENARIO],
  {
    env: {
      ...process.env,
      DUNGEON_ONLINE_V3_WORKER_NODE_MODULES: path.join(WORKER, "node_modules")
    }
  }
);
const protectedGuard = () => runProcess(
  process.execPath,
  ["--test", "--test-concurrency=1", "test/baseline-guard.test.js"],
  { cwd: WORKER }
);

const actions = {
  guard: [
    ["generator drift", generator],
    ["core safety checks (not feature regressions)", guardTests],
    ["changed JavaScript syntax", changedJavaScriptCheck],
    ["whitespace diff", diffCheck]
  ],
  phase: [
    ["generator drift", generator],
    ["Worker unit, fixture, property, and regression suite", workerUnit],
    ["changed JavaScript syntax", changedJavaScriptCheck],
    ["whitespace diff", diffCheck]
  ],
  "ui-current": [
    ["current working-tree browser scenario", uiCurrent],
    ["whitespace diff", diffCheck]
  ],
  baseline: [
    ["protected baseline guard", protectedGuard],
    ["clean committed game baseline", cleanBaselineSmoke],
    ["whitespace diff", diffCheck]
  ],
  "ranked-headed": [
    ["current working-tree Ranked browser scenario", rankedHeadedCurrent],
    ["whitespace diff", diffCheck]
  ],
  full: [
    ["reviewed record archive visuals", recordArchiveVisuals],
    ["generator drift", generator],
    ["Worker unit, fixture, property, and regression suite", workerUnit],
    ["changed JavaScript syntax", changedJavaScriptCheck],
    ["local Wrangler and D1 E2E", workerE2e],
    ["protected baseline guard", protectedGuard],
    ["clean committed game baseline", cleanBaselineSmoke],
    ["clean committed Ranked lifecycle", cleanRankedHeaded],
    ["whitespace diff", diffCheck]
  ]
};

await fs.mkdir(OUTPUT_ROOT, { recursive: true });
const input = await verificationInput();
const previousReceipt = await reusableReceipt(input);
if (previousReceipt) {
  const relativeReceipt = path.relative(ROOT, receiptPathFor(MODE)).split(path.sep).join("/");
  console.log(
    `[REUSED] verify:${modeLabel()} | identical input passed ${previousReceipt.finishedAt} | ` +
    `${totalsText(previousReceipt.totals)} | ${relativeReceipt} | use --force to rerun`
  );
  process.exit(0);
}
if (FORCE) await fs.rm(receiptPathFor(MODE), { force: true });

const stamp = timestamp();
const logPath = path.join(OUTPUT_ROOT, `${MODE}-${stamp}.log`);
const relativeLog = path.relative(ROOT, logPath).replaceAll("\\", "/");
await fs.writeFile(
  logPath,
  `Online v3 verification\nmode: ${MODE}\n` +
  `scenario: ${SCENARIOS_BY_MODE[MODE] ? SCENARIO : "n/a"}\nstarted: ${new Date().toISOString()}\n` +
  `head: ${input.head}\nbranch: ${input.branch}\ndirty entries: ${input.dirtyEntries}\n` +
  `node: ${input.node}\nplatform: ${input.platform}\nwrangler: ${input.wranglerVersion}\n` +
  `playwright: ${input.playwrightVersion}\nfingerprint: ${input.fingerprint}\n` +
  `forced: ${FORCE}\n\n`,
  "utf8"
);

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

const durationSeconds = Number(((Date.now() - modeStarted) / 1000).toFixed(1));
await fs.appendFile(
  logPath,
  `RESULT: PASS\nduration: ${durationSeconds.toFixed(1)}s\n${totalsText(combined)}\nfinished: ${new Date().toISOString()}\n`,
  "utf8"
);
const finishedAt = new Date().toISOString();
const receiptPath = await writeReceipt(input, {
  finishedAt,
  durationSeconds,
  totals: combined,
  log: relativeLog
});
console.log(
  `[PASS] verify:${modeLabel()} | ${durationSeconds.toFixed(1)}s | ${totalsText(combined)} | ` +
  `${relativeLog} | receipt ${path.relative(ROOT, receiptPath).split(path.sep).join("/")}`
);
