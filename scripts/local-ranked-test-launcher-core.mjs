import { execFile as nodeExecFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

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
  const fields = nullFields(value);
  const branches = [];

  for (let index = 0; index + 2 < fields.length; index += 3) {
    const [name, hash, date] = fields.slice(index, index + 3);
    const timestamp = validTimestamp(date);
    if (!name || !FULL_COMMIT_HASH.test(hash) || timestamp === null) continue;
    branches.push(freezeRecord({ name, hash, date, timestamp }));
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
    stateRoot: safeChildPath(cacheRoot, "state", hash)
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
    await execFile("git", ["worktree", "add", "--detach", paths.worktree, hash], { cwd: repoRoot });
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
    await execFile("npm.cmd", ["ci"], { cwd: workerRoot });
  }

  return Object.freeze({
    ...paths,
    workerRoot,
    bundleRoot: path.join(paths.worktree, "output", "pages-test-dist"),
    manifestPath: path.join(workerRoot, "src", "rulesets", "v08-meta-1", "data", "ruleset-manifest.json"),
    wranglerPath
  });
}