import path from "node:path";

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

