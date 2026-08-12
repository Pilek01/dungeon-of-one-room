import { execFileSync } from "node:child_process";

export function readCurrentCheckoutBuildIdentity(root) {
  const runGit = (args) => execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
  return Object.freeze({
    commit: runGit(["rev-parse", "--short=7", "HEAD"]),
    date: runGit(["show", "-s", "--format=%cs", "HEAD"])
  });
}

export function injectCheckoutBuildIdentity(source, identity) {
  const base = Buffer.isBuffer(source) ? source.toString("utf8") : String(source || "");
  return [
    base.trimEnd(),
    "",
    "// Injected by current-tree local QA servers from the active checkout.",
    `window.DUNGEON_BUILD_COMMIT = ${JSON.stringify(identity.commit)};`,
    `window.DUNGEON_BUILD_COMMIT_DATE = ${JSON.stringify(identity.date)};`,
    ""
  ].join("\n");
}
