import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "output", "pages-dist");
const outputRoot = path.join(root, "output") + path.sep;

if (!output.startsWith(outputRoot) || path.basename(output) !== "pages-dist") {
  throw new Error("Refusing to build Pages outside output/pages-dist.");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.(?:css|html|js)$/u.test(entry.name)) continue;
  await cp(path.join(root, entry.name), path.join(output, entry.name));
}

for (const directory of ["assets", "render", "online-v3"]) {
  const tracked = execFileSync(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, "ls-files", "-z", "--", directory],
    { cwd: root, encoding: "utf8" }
  ).split("\0").filter(Boolean);
  for (const relative of tracked) {
    const source = path.join(root, relative);
    const destination = path.join(output, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination);
  }
}

const configPath = path.join(output, "config.js");
let config = await readFile(configPath, "utf8");
for (const [source, replacement] of [
  ["window.DUNGEON_DEBUG_CHEATS_ENABLED = true;", "window.DUNGEON_DEBUG_CHEATS_ENABLED = false;"],
  ["window.DUNGEON_TEST_MODE = true;", "window.DUNGEON_TEST_MODE = false;"],
  ["window.DUNGEON_ONLINE_V3_API = \"\";", "window.DUNGEON_ONLINE_V3_API = window.location.origin;"],
  ["window.DUNGEON_ONLINE_V3_SEASON = \"local-m4\";", "window.DUNGEON_ONLINE_V3_SEASON = \"season-1\";"]
]) {
  if (!config.includes(source)) throw new Error(`Missing production config source: ${source}`);
  config = config.replace(source, replacement);
}
await writeFile(configPath, config, "utf8");

const gamePath = path.join(output, "game.js");
let game = await readFile(gamePath, "utf8");
const practiceSource = 'title: "Start New Game",';
if (!game.includes(practiceSource)) {
  throw new Error("Missing Practice menu source label.");
}
game = game.replace(practiceSource, 'title: "Practice (Offline)",');
await writeFile(gamePath, game, "utf8");

await writeFile(path.join(output, "_routes.json"), `${JSON.stringify({
  version: 1,
  include: ["/api/v3/*"],
  exclude: []
}, null, 2)}\n`, "utf8");

async function countFiles(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    count += entry.isDirectory() ? await countFiles(path.join(directory, entry.name)) : 1;
  }
  return count;
}

console.log(`Online v3 Pages bundle ready: ${await countFiles(output)} files`);
