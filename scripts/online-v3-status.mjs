import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAFE_ROOT = ROOT.split(path.sep).join("/");
const GROUPS = Object.freeze([
  {
    key: "protected-vault-wip",
    label: "protected Vault Guardian WIP",
    prefix: "Dungeon-v0.8.1-Vault-Guardian-Codex-Pack/"
  },
  {
    key: "local-wrangler-state",
    label: "local .wrangler state",
    prefix: ".wrangler/"
  }
]);

function git(args) {
  return execFileSync(
    "git",
    ["-c", `safe.directory=${SAFE_ROOT}`, ...args],
    { cwd: ROOT, encoding: "utf8" }
  );
}

function parseStatus(raw) {
  const records = raw.split("\0");
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    const relative = record.slice(3).split(path.sep).join("/");
    const entry = { status, relative, original: null };
    if (/[RC]/u.test(status)) {
      entry.original = String(records[index + 1] || "").split(path.sep).join("/");
      index += 1;
    }
    entries.push(entry);
  }
  return entries;
}

async function fingerprint(entries) {
  const hash = createHash("sha256");
  for (const entry of [...entries].sort((left, right) => (
    `${left.status}\0${left.relative}`.localeCompare(
      `${right.status}\0${right.relative}`
    )
  ))) {
    hash.update(entry.status);
    hash.update("\0");
    hash.update(entry.relative);
    hash.update("\0");
    hash.update(entry.original || "");
    hash.update("\0");
    try {
      hash.update(await readFile(path.join(ROOT, entry.relative)));
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "EISDIR") throw error;
    }
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function display(entry) {
  return `${entry.status} ${entry.relative}${entry.original ? ` <- ${entry.original}` : ""}`;
}

const branch = git(["branch", "--show-current"]).trim() || "(detached)";
const head = git(["rev-parse", "--short", "HEAD"]).trim();
const rawStatus = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
const entries = parseStatus(rawStatus);
const groupedPaths = new Set();

console.log(`Online v3 workspace: ${branch} @ ${head}`);

for (const group of GROUPS) {
  const matches = entries.filter((entry) => entry.relative.startsWith(group.prefix));
  for (const entry of matches) groupedPaths.add(entry.relative);
  const staged = matches.filter((entry) => entry.status[0] !== " " && entry.status[0] !== "?");
  console.log(
    `- ${group.label}: ${matches.length} entries | ${await fingerprint(matches)}` +
    (staged.length ? ` | WARNING: ${staged.length} staged` : "")
  );
}

const ordinary = entries.filter((entry) => !groupedPaths.has(entry.relative));
if (!ordinary.length) {
  console.log("- ordinary changes: none");
} else {
  console.log(`- ordinary changes: ${ordinary.length}`);
  for (const entry of ordinary) console.log(`  ${display(entry)}`);
}

if (process.argv.includes("--full")) {
  console.log("- full status:");
  for (const entry of entries) console.log(`  ${display(entry)}`);
}
