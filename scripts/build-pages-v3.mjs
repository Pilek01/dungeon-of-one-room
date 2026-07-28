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

const indexPath = path.join(output, "index.html");
let index = await readFile(indexPath, "utf8");
const bootPrompt = '      <p class="boot-press">Press any button to start</p>';
const bootLoading = `${bootPrompt}
      <div class="boot-loading" role="status" aria-live="polite">
        <span>Preparing the dungeon...</span>
        <div class="boot-loading-track" aria-hidden="true"><i></i></div>
      </div>`;
if (!index.includes(bootPrompt)) throw new Error("Missing production boot prompt.");
index = index.replace(bootPrompt, bootLoading);
await writeFile(indexPath, index, "utf8");

const bootStylePath = path.join(output, "style-hd-boot.css");
let bootStyle = await readFile(bootStylePath, "utf8");
const bootLoadingCss = `
.boot-loading {
  display: none;
}

.boot-screen.loading {
  cursor: wait;
}

.boot-screen.loading .boot-press {
  display: none;
}

.boot-screen.loading .boot-loading {
  position: absolute;
  z-index: 2;
  bottom: clamp(76px, 8.5vh, 92px);
  left: 50%;
  width: min(430px, 76vw);
  display: grid;
  gap: 10px;
  color: #a99d8e;
  font: 700 clamp(0.62rem, 0.9vw, 0.75rem)/1.2 "Courier Prime", "Cascadia Mono", monospace;
  letter-spacing: clamp(1.4px, 0.24vw, 2.8px);
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 2px #000;
  transform: translateX(-50%);
}

.boot-loading-track {
  position: relative;
  height: 10px;
  padding: 2px;
  overflow: hidden;
  border: 1px solid #665b4d;
  background: #050607e8;
  box-shadow: inset 0 0 10px #000, 0 0 18px #000a;
}

.boot-loading-track i {
  display: block;
  width: 12%;
  height: 100%;
  background: linear-gradient(90deg, #6f5131, #c5a160 72%, #ead59b);
  box-shadow: 0 0 12px #c28b3c75;
  transition: width 180ms ease-out;
}

.boot-screen.loading:not(.ready) .boot-loading-track i {
  animation: hdBootLoadingProgress 2.8s cubic-bezier(0.16, 0.72, 0.26, 1) forwards;
}

.boot-screen.loading.ready .boot-loading-track i {
  width: 100%;
}

@keyframes hdBootLoadingProgress {
  from { width: 12%; }
  to { width: 88%; }
}

@media (max-width: 700px) {
  .boot-screen.loading .boot-loading {
    bottom: 70px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .boot-screen.loading:not(.ready) .boot-loading-track i {
    width: 72%;
    animation: none;
  }
}`;
bootStyle = `${bootStyle.trimEnd()}\n${bootLoadingCss}\n`;
await writeFile(bootStylePath, bootStyle, "utf8");
const gamePath = path.join(output, "game.js");
let game = await readFile(gamePath, "utf8");
const practiceSource = 'title: "Start New Game",';
if (!game.includes(practiceSource)) {
  throw new Error("Missing Practice menu source label.");
}
game = game.replace(practiceSource, 'title: "Practice (Offline)",');
const menuStart = game.indexOf("  function getMenuOptions() {");
const menuEnd = game.indexOf("  function getMenuNewGameConfirmOptions()", menuStart);
if (menuStart < 0 || menuEnd < 0) throw new Error("Missing main menu function boundaries.");
let menuSource = game.slice(menuStart, menuEnd);
const menuReplacements = [
  ["    return [", "    const baseOptions = ["],
  ['      {\n        key: "1",\n        title: "Practice (Offline)",', '      {\n        id: "practice",\n        key: "1",\n        title: "Practice (Offline)",'],
  ['      {\n        key: "2",\n        title: "Continue",', '      {\n        id: "continue",\n        key: "2",\n        title: "Continue",'],
  ['      {\n        key: "3",\n        title: "Leaderboard",', '      {\n        id: "leaderboard",\n        key: "3",\n        title: "Leaderboard",'],
  ['      {\n        key: "4",\n        title: state.playerName ?', '      {\n        id: "nickname",\n        key: "4",\n        title: state.playerName ?'],
  ['      {\n        key: "5",\n        title: "Tutorial",', '      {\n        id: "tutorial",\n        key: "5",\n        title: "Tutorial",'],
  ['      {\n        key: "6",\n        title: "Options",', '      {\n        id: "options",\n        key: "6",\n        title: "Options",']
];
for (const [sourceText, replacement] of menuReplacements) {
  if (!menuSource.includes(sourceText)) throw new Error(`Missing production menu source: ${sourceText}`);
  menuSource = menuSource.replace(sourceText, replacement);
}
const menuReturn = "    ];\n  }\n\n";
const menuExtension = `    ];
    if (isRunPauseMenuActive()) return baseOptions;
    const extendOptions = window.DungeonOnlineV3Menu?.extendOptions;
    if (typeof extendOptions !== "function") return baseOptions;
    try {
      const extended = extendOptions(baseOptions);
      return Array.isArray(extended) && extended.length ? extended : baseOptions;
    } catch {
      return baseOptions;
    }
  }

`;
if (!menuSource.endsWith(menuReturn)) throw new Error("Unexpected main menu function ending.");
menuSource = `${menuSource.slice(0, -menuReturn.length)}${menuExtension}`;
game = `${game.slice(0, menuStart)}${menuSource}${game.slice(menuEnd)}`;

const menuRenderStart = game.indexOf('    } else if (state.phase === "menu") {', game.indexOf('    let menuBlock = "";'));
const menuRenderEnd = game.indexOf('    } else if (state.phase === "relic") {', menuRenderStart);
if (menuRenderStart < 0 || menuRenderEnd < 0) throw new Error("Missing main menu renderer boundaries.");
let menuRenderSource = game.slice(menuRenderStart, menuRenderEnd);
const mainMenuRow = '`<div class="${classes}">`,';
const productionMenuRow = '`<div class="${classes}" data-menu-index="${index}" role="button" tabindex="${option.disabled ? "-1" : "0"}" aria-disabled="${option.disabled ? "true" : "false"}">`,';
if (!menuRenderSource.includes(mainMenuRow)) throw new Error("Missing production main menu row.");
menuRenderSource = menuRenderSource.replace(mainMenuRow, productionMenuRow);
game = `${game.slice(0, menuRenderStart)}${menuRenderSource}${game.slice(menuRenderEnd)}`;

const productionGameReplacements = [
  [
    "  let bootDismissPromise = null;",
    "  let bootDismissPromise = null;\n  let bootInputLocked = false;"
  ],
  [
`  function dismissBootScreen() {
    if (bootDismissPromise) return bootDismissPromise;
    bootDismissPromise = Promise.resolve(initialGraphicsReady).then(() => {
      if (gameAppEl) {
        gameAppEl.classList.remove("app-hidden");
        requestAnimationFrame(() => syncHdMenuNavigation());
      }
      if (bootScreenEl) {
        bootScreenEl.classList.add("fading");
        bootScreenEl.addEventListener("transitionend", () => {
          bootScreenEl.classList.add("hidden");
        }, { once: true });
      }
    });
    return bootDismissPromise;
  }`,
`  function dismissBootScreen() {
    if (bootDismissPromise) return bootDismissPromise;
    bootInputLocked = true;
    bootScreenEl?.classList.add("loading");
    bootDismissPromise = Promise.resolve(initialGraphicsReady)
      .then(() => {
        if (gameAppEl) {
          gameAppEl.classList.remove("app-hidden");
          requestAnimationFrame(() => syncHdMenuNavigation());
        }
        bootScreenEl?.classList.add("ready");
        return new Promise((resolve) => window.setTimeout(resolve, 180));
      })
      .then(() => new Promise((resolve) => {
        if (!bootScreenEl) {
          resolve();
          return;
        }
        let hidden = false;
        const hideBoot = () => {
          if (hidden) return;
          hidden = true;
          bootScreenEl.classList.add("hidden");
          resolve();
        };
        bootScreenEl.classList.add("fading");
        bootScreenEl.addEventListener("transitionend", hideBoot, { once: true });
        window.setTimeout(hideBoot, 700);
      }))
      .finally(() => {
        bootInputLocked = false;
      });
    return bootDismissPromise;
  }`
  ],
  [
`  window.addEventListener("keydown", (event) => {
    if (MOBILE_UNSUPPORTED_BLOCKED) return;`,
`  window.addEventListener("keydown", (event) => {
    if (MOBILE_UNSUPPORTED_BLOCKED) return;
    if (bootInputLocked) {
      event.preventDefault();
      return;
    }`
  ],
  [
`  window.addEventListener("pointerdown", () => {
    if (MOBILE_UNSUPPORTED_BLOCKED) return;`,
`  window.addEventListener("pointerdown", (event) => {
    if (MOBILE_UNSUPPORTED_BLOCKED) return;
    if (bootInputLocked) {
      event.preventDefault();
      return;
    }`
  ],
  [
`    if (state.phase === "menu") {
      if (state.menuNewGameConfirmOpen) {`,
`    if (state.phase === "menu") {
      const menuRow = event.target?.closest?.("[data-menu-index]");
      if (menuRow && screenOverlayEl?.contains(menuRow)) {
        const menuIndex = Number(menuRow.dataset.menuIndex);
        if (Number.isInteger(menuIndex)) {
          state.menuIndex = menuIndex;
          activateMenuOption(menuIndex);
          return;
        }
      }
      if (state.menuNewGameConfirmOpen) {`
  ]
];
for (const [sourceText, replacement] of productionGameReplacements) {
  if (!game.includes(sourceText)) throw new Error(`Missing production game source: ${sourceText.slice(0, 80)}`);
  game = game.replace(sourceText, replacement);
}
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
