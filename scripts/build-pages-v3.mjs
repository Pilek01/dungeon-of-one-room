import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { observerBotReleaseConfig } from "./pages-release-preflight.mjs";
import {
  patchObserverBotCampStart,
  patchRankedArenaWaveGoldParity,
  patchRankedEmergencyExtraction,
  patchRankedFatalPendingFreeze,
  patchRankedRoomClearOnce
} from "./online-v3-game-patches.mjs";
import { RELEASE_RECEIPT_FILE, sanitizedReleaseReceipt, verifyRecordArchiveVisualApproval } from "./record-archive-visual-receipt.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetIndex = process.argv.indexOf("--target");
const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : "release";
const outputName = target === "release"
  ? "pages-dist"
  : target === "test"
    ? "pages-test-dist"
    : "";
if (!outputName || (targetIndex >= 0 && !process.argv[targetIndex + 1])) {
  throw new Error("Usage: node scripts/build-pages-v3.mjs [--target release|test]");
}
const output = path.join(root, "output", outputName);
const outputRoot = path.join(root, "output") + path.sep;

if (!output.startsWith(outputRoot) || path.basename(output) !== outputName) {
  throw new Error(`Refusing to build Pages outside output/${outputName}.`);
}

function readGitBuildValue(args, label) {
  let value = "";
  try {
    value = execFileSync(
      "git",
      ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
      { cwd: root, encoding: "utf8" }
    ).trim();
  } catch (error) {
    throw new Error(`Unable to read ${label} for the Pages build.`, { cause: error });
  }
  if (!value) throw new Error(`Git returned an empty ${label} for the Pages build.`);
  return value;
}

function versionLinkedFirstPartyAssets(html, version) {
  const isRelative = (source) => !/^(?:[a-z]+:|\/\/|\/|#)/iu.test(source);
  const rewrite = (match, prefix, source, suffix, extension) => {
    if (!isRelative(source)) return match;
    const sourcePath = source.split(/[?#]/u, 1)[0];
    if (!sourcePath.toLowerCase().endsWith(extension)) return match;
    if (/[?#]/u.test(source)) {
      throw new Error(`Refusing to duplicate a version query or fragment for ${source}.`);
    }
    return `${prefix}${source}?v=${version}${suffix}`;
  };
  let versioned = html.replace(
    /(<script\b[^>]*\bsrc=")([^"]+)(")/gu,
    (match, prefix, source, suffix) => rewrite(
      match,
      prefix,
      source,
      suffix,
      ".js"
    )
  );
  versioned = versioned.replace(
    /(<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref=")([^"]+)(")/gu,
    (match, prefix, source, suffix) => rewrite(match, prefix, source, suffix, ".css")
  );
  return versioned;
}

const buildCommit = readGitBuildValue(["rev-parse", "--short=7", "HEAD"], "commit hash");
const buildCommitDate = readGitBuildValue(["show", "-s", "--format=%cs", "HEAD"], "commit date");

const observerBotConfig = observerBotReleaseConfig(process.env, target);
const visualApproval = target === "release" ? await verifyRecordArchiveVisualApproval({ root }) : null;

const RETIRED_PRESENTATION_PATHS = new Set([
  "assets/logo.png",
  "render/graphics-preference.js"
]);

function isRetiredClassicPresentation(relative) {
  const normalized = relative.replaceAll("\\", "/");
  return RETIRED_PRESENTATION_PATHS.has(normalized) || normalized.startsWith("assets/sprite/");
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
    if (isRetiredClassicPresentation(relative)) continue;
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
config += "\nwindow.DUNGEON_ONLINE_TEST_BOT_ENABLED = " + JSON.stringify(observerBotConfig.enabled) + ";\n";
config += "window.DUNGEON_ONLINE_TEST_BOT_PASSWORD_HASH = " + JSON.stringify(observerBotConfig.passwordHash) + ";\n";
config += "window.DUNGEON_BUILD_COMMIT = " + JSON.stringify(buildCommit) + ";\n";
config += "window.DUNGEON_BUILD_COMMIT_DATE = " + JSON.stringify(buildCommitDate) + ";\n";
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
const gameScript = '  <script src="game.js"></script>';
const rewardRecorderScript = '  <script src="online-v3/ranked-v3-recorder.js"></script>';
if (!index.includes(gameScript)) throw new Error("Missing production game script.");
index = index.replace(gameScript, `${rewardRecorderScript}\n${gameScript}`);
index = versionLinkedFirstPartyAssets(index, buildCommit);
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
game = patchObserverBotCampStart(game);
game = patchRankedArenaWaveGoldParity(game);
game = patchRankedEmergencyExtraction(game);
game = patchRankedFatalPendingFreeze(game);
game = patchRankedRoomClearOnce(game);
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
    if (isRunPauseMenuActive()) {
      const rankedPause = Boolean(window.DungeonOnlineV3GameBridge?.isRanked?.());
      return baseOptions.map((option) => option.id === "practice" ? {
        ...option,
        title: "Main Menu",
        desc: rankedPause
          ? "Keep this Ranked run saved and return to the main menu."
          : "Save this Practice run and return to the main menu.",
        action: () => {
          if (rankedPause) {
            window.DungeonOnlineV3?.leaveToMainMenu?.();
            return;
          }
          enterMenu();
        }
      } : option);
    }
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

const menuConfirmRenderStart = game.indexOf('    if (state.phase === "menu" && state.menuNewGameConfirmOpen) {');
const menuConfirmRenderEnd = game.indexOf('    if (state.phase === "menu" && state.menuOptionsOpen) {', menuConfirmRenderStart);
if (menuConfirmRenderStart < 0 || menuConfirmRenderEnd < 0) throw new Error("Missing New/Continue renderer boundaries.");
let menuConfirmRenderSource = game.slice(menuConfirmRenderStart, menuConfirmRenderEnd);
const menuConfirmRow = '`<div class="${classes}">`,';
const productionMenuConfirmRow = '`<div class="${classes}" data-menu-new-game-index="${index}" role="button" tabindex="0">`,';
if (!menuConfirmRenderSource.includes(menuConfirmRow)) throw new Error("Missing New/Continue menu row.");
menuConfirmRenderSource = menuConfirmRenderSource.replace(menuConfirmRow, productionMenuConfirmRow);
game = `${game.slice(0, menuConfirmRenderStart)}${menuConfirmRenderSource}${game.slice(menuConfirmRenderEnd)}`;
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
`    const chaosAtkBonus = Math.max(0, Number(state.player.chaosAtkBonus) || 0);`,
`    const rankedHudStatus = window.DungeonOnlineV3?.getRankedHudStatus?.() || null;
    const rankedPlayerValue = (() => {
      const playerName = escapeHtmlAttr(state.playerName || "Not set");
      if (!rankedHudStatus) return playerName;
      const kind = ["official", "observer", "invalid"].includes(rankedHudStatus.kind)
        ? rankedHudStatus.kind
        : "invalid";
      const syncing = rankedHudStatus.syncing === true;
      const label = escapeHtmlAttr(rankedHudStatus.label || "Ranked status");
      const tooltip = escapeHtmlAttr(rankedHudStatus.tooltip || rankedHudStatus.label || "Ranked status");
      return '<span class="ranked-run-player-status' + (syncing ? ' is-syncing' : '') + '"' +
        ' data-ranked-status="' + kind + '" data-ui-tooltip-title="' + label + '" data-ui-tooltip="' + tooltip + '"' +
        ' role="group" aria-label="Player ' + playerName + '. ' + label + '" aria-busy="' + (syncing ? 'true' : 'false') + '"' +
        ' tabindex="0" aria-describedby="hdUiTooltip">' +
        '<span class="ranked-run-status-dot ranked-run-status-' + kind + '" role="img" aria-label="' + label + '"></span>' +
        '<span class="ranked-run-player-name">' + playerName + '</span></span>';
    })();

    const chaosAtkBonus = Math.max(0, Number(state.player.chaosAtkBonus) || 0);`
  ],
  [
`      statRow("Player", state.playerName || "Not set", "Your current nickname used for leaderboard entries."),`,
`      statRow("Player", rankedPlayerValue, "Your current nickname used for leaderboard entries."),`
  ],
  [
`  function renderGameToText() {
    const payload = {`,
`  function renderGameToText() {
    const rankedHudStatus = window.DungeonOnlineV3?.getRankedHudStatus?.() || null;
    const payload = {`
  ],
  [
`      scenario: state.testScenario ? state.testScenario.id : "",`,
`      scenario: state.testScenario ? state.testScenario.id : "",
      rankedHudStatus: rankedHudStatus
        ? {
            kind: rankedHudStatus.kind,
            syncing: rankedHudStatus.syncing === true,
            label: rankedHudStatus.label
          }
        : null,`
  ],
  [
`  function openPactRoom() {
    if (!isOnPact()) return false;`,
`  function openPactRoom() {
    if (state.onlineV3Ranked) return false;
    if (!isOnPact()) return false;`
  ],
  [
`  function applyPactChoice(pactId) {
    const pact = pactRoomApi?.PACTS?.find((entry) => entry.id === pactId) || null;`,
`  function applyPactChoice(pactId) {
    if (state.onlineV3Ranked) return false;
    const pact = pactRoomApi?.PACTS?.find((entry) => entry.id === pactId) || null;`
  ],
  [
`  function breakCurrentPact() {
    const currentPactId = getCurrentPactId();`,
`  function breakCurrentPact() {
    if (state.onlineV3Ranked) return false;
    const currentPactId = getCurrentPactId();`
  ],
  [
`  function shouldPersistToStorage() {
    return !(isSimulationActive() && state.simulation.suppressPersistence);
  }`,
`  function shouldPersistToStorage() {
    return !state.onlineV3Ranked && !(isSimulationActive() && state.simulation.suppressPersistence);
  }`
  ],
  [
`      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }`,
`      for (const key of keysToRemove) {
        removeStorageItem(key);
      }`
  ],
  [
`  function restoreLocalStorageSnapshot(snapshot) {
    const nextSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};`,
`  function restoreLocalStorageSnapshot(snapshot) {
    if (state.onlineV3Ranked) return;
    const nextSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};`
  ],
  [
`    for (const key of currentKeys) {
      if (!Object.prototype.hasOwnProperty.call(nextSnapshot, key)) {
        localStorage.removeItem(key);
      }
    }`,
`    for (const key of currentKeys) {
      if (!Object.prototype.hasOwnProperty.call(nextSnapshot, key)) {
        removeStorageItem(key);
      }
    }`
  ],
  [
`    for (const [key, value] of Object.entries(nextSnapshot)) {
      localStorage.setItem(key, value == null ? "" : String(value));
    }`,
`    for (const [key, value] of Object.entries(nextSnapshot)) {
      setStorageItem(key, value == null ? "" : String(value));
    }`
  ],
  [
`  function syncBgmWithState(force = false) {
    if (isSimulationActive() && state.simulation.suppressAudio) {`,
`  function syncBgmWithState(force = false) {
    if (window.DUNGEON_ONLINE_TEST_MUSIC_OFF === true) {
      ensureBgmTracks();
      stopAllBgm(false);
      stopSplashTrack(false);
      return;
    }
    if (isSimulationActive() && state.simulation.suppressAudio) {`
  ],
  [
`    state.onlineV3Ranked = true;
      state.onlineV3Directive = directive;`,
`    state.onlineV3Ranked = true;
      syncRankedRunModifiers(publicState, { hydrateOnly: true });
      state.onlineV3Directive = directive;`
  ],
  [
`  function canUseDebugCheats() {
    return DEBUG_CHEATS_ENABLED;
  }`,
`  function canUseDebugCheats() {
    return DEBUG_CHEATS_ENABLED || Boolean(state.onlineV3Ranked && state.onlineV3TestBotUnlocked);
  }`
  ],
  [
`  function runObserverBotStep() {
    if (!isObserverBotActive()) return false;`,
`  function runObserverBotStep() {
    if (!isObserverBotActive()) return false;
    if (state.onlineV3Ranked && (
      state.turnInProgress ||
      window.DungeonOnlineV3?.isRankedAutomationBlocked?.() ||
      window.DungeonOnlineV3?.isObserverBotBoundaryPending?.()
    )) {
      state.observerBot.lastDecision = "online_v3_wait";
      return false;
    }`
  ],
  [
`    state.elixirLoadout.charges = Math.max(0, charges - 1);`,
`    state.elixirLoadout.charges = Math.max(0, charges - 1);
    window.DungeonOnlineV3?.onElixirUsed?.({
      elixirId: elixir.id,
      charges: state.elixirLoadout.charges
    });`
  ],
  [
`    startRanked(directive, publicState) {`,
`    startRanked(directive, publicState, options = {}) {
      state.onlineV3FatalPending = false;
      state.observerBot.unlimitedGold = false;
      state.observerBot.unlimitedGoldRunBaseline = 0;
      state.observerBot.unlimitedGoldCampBaseline = 0;
      state.observerBot.lastPotionActionKey = "";
      state.observerBot.potionUseTurns = [];
      state.pactBasePlayerStats = null;
      onlineV3RoomClearDirectiveId = String(directive?.directiveId || "");
      onlineV3RoomClearReported = false;
      if (options.newCampaign === true) resetMetaProgressForFreshStart({ persist: false });
      hydrateRankedChestCarry(publicState, { applyDelta: false });
      resetRankedCanonicalChestSlots(publicState);`
  ],
  [
`    returnToPractice() {
      state.onlineV3Ranked = false;`,
`    returnToPractice() {
      state.onlineV3TestBotUnlocked = false;
      resetSessionChestBonuses();
      resetRankedCanonicalChestSlots();
      state.onlineV3Ranked = false;
      state.debugCheatOpen = false;
      state.debugCheatBotOnly = false;
      state.debugCheatMerchantActive = false;
      state.debugGodMode = false;
      state.highscore = Math.max(0, Number(localStorage.getItem(STORAGE_DEPTH) || 0));
      state.bestGold = Math.max(0, Number(localStorage.getItem(STORAGE_GOLD) || 0));
      state.deaths = Math.max(0, Number(localStorage.getItem(STORAGE_DEATHS) || 0));
      state.eliteKills = Math.max(0, Number(localStorage.getItem(STORAGE_ELITE_KILLS) || 0));
      state.totalKills = Math.max(0, Number(localStorage.getItem(STORAGE_TOTAL_KILLS) || 0));
      state.totalGoldEarned = Math.max(0, Number(localStorage.getItem(STORAGE_TOTAL_GOLD) || 0));
      state.totalMerchantPots = Math.max(0, Number(localStorage.getItem(STORAGE_TOTAL_MERCHANT_POTS) || 0));
      state.potionFreeExtract = Math.max(0, Number(localStorage.getItem(STORAGE_POTION_FREE_EXTRACT) || 0));
      state.wardensKilledThisGame = Math.max(0, Number(localStorage.getItem(STORAGE_WARDENS_KILLED) || 0));
      state.campGold = Math.max(0, Number(
        localStorage.getItem(STORAGE_CAMP_GOLD) || localStorage.getItem(STORAGE_ESSENCE_LEGACY) || 0
      ));
      state.lives = clamp(Number(localStorage.getItem(STORAGE_LIVES) || MAX_LIVES), 0, MAX_LIVES);
      state.audioMuted = localStorage.getItem(STORAGE_AUDIO_MUTED) === "1";
      state.debugAiOverlay = localStorage.getItem(STORAGE_DEBUG_AI_OVERLAY) === "1";
      state.enemySpeedMode = sanitizeEnemySpeedMode(localStorage.getItem(STORAGE_ENEMY_SPEED) || "");
      mobileUi.hintSeen = localStorage.getItem(STORAGE_MOBILE_SWIPE_HINT_SEEN) === "1";
      state.playerName = sanitizePlayerName(localStorage.getItem(STORAGE_PLAYER_NAME) || "")
        || (ACTIVE_SCENARIO_OVERRIDE ? "QA" : "");
      state.tutorialRunSeen = localStorage.getItem(STORAGE_TUTORIAL_RUN_SEEN) === "1";
      state.tutorialCampSeen = localStorage.getItem(STORAGE_TUTORIAL_CAMP_SEEN) === "1";
      state.tutorialMerchantSeen = localStorage.getItem(STORAGE_TUTORIAL_MERCHANT_SEEN) === "1";
      state.tutorialPortalSeen = localStorage.getItem(STORAGE_TUTORIAL_PORTAL_SEEN) === "1";
      state.tutorialWardenDeathTipSeen = localStorage.getItem(STORAGE_TUTORIAL_WARDEN_DEATH_TIP_SEEN) === "1";
      state.leaderboard = sanitizeLeaderboard(readJsonStorage(STORAGE_LEADERBOARD, []));
      state.leaderboardPending = sanitizePendingLeaderboard(readJsonStorage(STORAGE_LEADERBOARD_PENDING, []));
      state.observerBot.aiModel = sanitizeObserverAiModel(readJsonStorage(STORAGE_OBSERVER_AI_MODEL, null));
      state.hasContinueRun = Boolean(readJsonStorage(STORAGE_RUN_SAVE, null));
      state.activeMutators = sanitizeMutatorMap(readJsonStorage(STORAGE_MUT_ACTIVE, {}));
      state.unlockedMutators = sanitizeMutatorMap(readJsonStorage(STORAGE_MUT_UNLOCK, {}));
      state.campUpgrades = sanitizeCampUpgrades(readJsonStorage(STORAGE_CAMP_UPGRADES, {}));
      state.skillTiers = sanitizeSkillTiers(readJsonStorage(STORAGE_SKILL_TIERS, {}));
      state.startDepthUnlocks = sanitizeStartDepthUnlocks(readJsonStorage(STORAGE_START_DEPTH_UNLOCKS, {}));
      state.elixirLoadout = sanitizeElixirLoadout(readJsonStorage(STORAGE_ELIXIR_LOADOUT, {}));
      state.wardenFirstDropDepths = sanitizeWardenFirstDropDepths(
        readJsonStorage(STORAGE_WARDEN_FIRST_DROP_DEPTHS, {})
      );
      state.activePacts = [];
      state.pactBasePlayerStats = null;
      resetRunModifiers();`
  ],
  [
`      window.DungeonOnlineV3?.onExtraction?.(forced ? "emergency" : "normal");`,
`      window.DungeonOnlineV3?.onExtraction?.(forced && !state.roomCleared ? "emergency" : "normal");`
  ],  [
    "  let bootDismissPromise = null;",
    "  let bootDismissPromise = null;\n  let bootInputLocked = false;\n  let bootInputUnlockAt = 0;"
  ],
  [
`  function enterMenu(menuConfig = {}) {
    const preserveRunContext = Boolean(menuConfig.preserveRunContext)`,
`  function enterMenu(menuConfig = {}) {
    if (state.onlineV3Ranked) {
      window.DungeonOnlineV3?.leaveToMainMenu?.();
      return;
    }
    const preserveRunContext = Boolean(menuConfig.preserveRunContext)`
  ],
  [
`  function startRun(options = {}) {
    const carriedRelics = Array.isArray(options.carriedRelics)`,
`  function startRun(options = {}) {
    const rankedFatalDirective =
      state.onlineV3Ranked && state.phase === "dead" ? state.onlineV3NextDirective : null;
    if (rankedFatalDirective) {
      state.onlineV3Directive = rankedFatalDirective;
      state.onlineV3NextDirective = null;
      const canonicalRelics = Array.isArray(state.relics) ? [...state.relics] : [];
      options = { ...options, carriedRelics: canonicalRelics, startDepth: 0 };
    }
    const carriedRelics = Array.isArray(options.carriedRelics)`
  ],
  [
`    state.player.hp = state.player.maxHp;

    buildRoom();
    resetObserverBotStallTracker();`,
`    state.player.hp = state.player.maxHp;

    buildRoom();
    if (rankedFatalDirective) {
      window.DungeonOnlineV3?.onRoomEntered?.(state.onlineV3Directive);
    }
    resetObserverBotStallTracker();`
  ],
  [
`    resumeAfterFatal(directive, publicState) {
      state.onlineV3FatalPending = false;
      state.turnInProgress = false;
      state.phase = "playing";
      state.onlineV3Directive = directive;
      state.onlineV3NextDirective = null;
      state.player.hp = Math.max(1, Number(state.player.maxHp) || 1);
      state.lives = Math.max(0, Number(publicState?.lives) || 0);
      buildRoom();
      pushLog(\`Canonical life \${publicState?.lifeState?.currentLife || 1} begins.\`, "good");
      markUiDirty();
    },`,
`    resumeAfterFatal(directive, publicState, presentation = {}) {
      state.onlineV3FatalPending = false;
      state.onlineV3NextDirective = directive;
      const build = publicState?.build || {};
      state.campUpgrades = sanitizeCampUpgrades(build.campUpgrades || {});
      state.skillTiers = sanitizeSkillTiers(build.skillTiers || {});
      const canonicalElixir = Array.isArray(build.elixirs) ? build.elixirs[0] : null;
      state.elixirLoadout = sanitizeElixirLoadout(canonicalElixir
        ? { type: canonicalElixir.elixirId, charges: canonicalElixir.charges }
        : {});
      state.relics = (Array.isArray(build.relics) ? build.relics : []).flatMap((relic) =>
        Array.from(
          { length: Math.max(1, Number(relic.stacks) || 1) },
          () => String(relic.relicId || relic.id || "")
        )
      ).filter(Boolean);
      normalizeRelicInventory();
      state.lives = Math.max(0, Number(publicState?.lives) || 0);
      state.simulation.lastGameOverReason = String(presentation?.reason || "You fell in battle.");
      const lostRelic = getRelicById(String(presentation?.lostRelicId || ""));
      const lostRelicOverlayName = formatRelicNameForOverlay(lostRelic);
      state.lastDeathRelicLossText = lostRelic
        ? "Death penalty: lost relic " + lostRelicOverlayName + "."
        : "Death penalty: no relic lost.";
      state.phase = "dead";
      state.deathScreenSelection = 0;
      state.player.hp = 0;
      state.player.visualDeathTimer = 0;
      state.wardenDeathTipPromptOpen = false;
      state.finalVictoryPrompt = null;
      state.finalGameOverPrompt = null;
      state.turnInProgress = false;
      state.playerShieldBrokeThisTurn = false;
      state.enemyTurnInProgress = false;
      state.enemyTurnQueue = [];
      state.enemyTurnStepTimer = 0;
      state.enemyTurnStepIndex = 0;
      state.enemyMeleeOverflowCommitted = 0;
      state.enemyBlackboard = null;
      state.enemyAntiStrafe = null;
      state.enemyDebugPlans = [];
      state.extractConfirm = null;
      state.merchantMenuOpen = false;
      clearElixirCombatState();
      syncBgmWithState();
      stopVictoryTrack(true);
      stopFinalGameOverTrack(true);
      const usedDeathTrack = playDeathTrack();
      if (!usedDeathTrack) playSfx("death");
      const lossSummary = lostRelic ? " Lost relic: " + lostRelic.name + "." : " No relic lost.";
      pushLog(state.simulation.lastGameOverReason + lossSummary, "bad");
      pushLog("Life lost. " + state.lives + "/" + MAX_LIVES + " remaining.", "bad");
      pushLog("Press R or Enter to rise again.", "good");
      markUiDirty();
    },`
  ],
  [
`    holdTerminal(publicState) {
      state.onlineV3FatalPending = false;
      state.turnInProgress = true;
      state.phase = publicState?.status === "victory" ? "won" : "dead";
      state.lives = Math.max(0, Number(publicState?.lives) || 0);
      markUiDirty();
    },`,
`    holdTerminal(publicState) {
      state.onlineV3FatalPending = false;
      state.turnInProgress = false;
      state.phase = publicState?.status === "victory" ? "won" : "dead";
      state.lives = Math.max(0, Number(publicState?.lives) || 0);
      syncRankedScoreProjection(publicState);
      const canonicalScore = publicState?.score;
      const canonicalInputs = canonicalScore?.inputs || {};
      const projectedScore = Number(canonicalScore?.score);
      const projectedDepth = Number(canonicalInputs.acceptedMaxDepth);
      const projectedGold = Number(canonicalInputs.acceptedRunGoldEarned);
      const finalDepth = Number.isSafeInteger(projectedDepth) && projectedDepth >= 0
        ? projectedDepth
        : getRunMaxDepth();
      const finalGold = Number.isSafeInteger(projectedGold) && projectedGold >= 0
        ? projectedGold
        : getRunGoldEarned();
      const finalScore = Number.isSafeInteger(projectedScore) && projectedScore >= 0
        ? projectedScore
        : calculateScore(finalDepth, finalGold);
      if (publicState?.status === "defeat") {
        state.player.hp = 0;
        state.finalVictoryPrompt = null;
        state.finalGameOverPrompt = {
          depth: finalDepth,
          gold: finalGold,
          score: finalScore,
          totalGoldCollected: Math.max(0, Number(state.totalGoldEarned) || 0),
          damageDone: Math.max(0, Number(state.damageDoneThisGame) || 0),
          damageTaken: Math.max(0, Number(state.damageTakenThisGame) || 0),
          potionsUsed: Math.max(0, Number(state.potionsUsedThisGame) || 0),
          elixirsUsed: Math.max(0, Number(state.elixirsUsedThisGame) || 0),
          wardensKilled: Math.max(0, Number(state.wardensKilledThisGame) || 0),
          totalKills: Math.max(0, Number(state.totalKills) || 0),
          eliteKills: Math.max(0, Number(state.eliteKills) || 0),
          deaths: Math.max(
            Math.max(0, Number(state.deaths) || 0) + 1,
            MAX_LIVES - state.lives
          ),
          totalMerchantPots: Math.max(0, Number(state.totalMerchantPots) || 0),
          potionFreeExtracts: Math.max(0, Number(state.potionFreeExtract) || 0),
          shieldUses: Math.max(0, Number(state.shieldUsesThisRun) || 0),
          depthHighscore: Math.max(0, Number(state.highscore) || 0, finalDepth),
          bestGold: Math.max(0, Number(state.bestGold) || 0, finalGold),
          reason: String(state.simulation.lastGameOverReason || "All lives lost.")
        };
        state.finalGameOverSelection = 0;
        syncBgmWithState();
        stopDeathTrack(true);
        const usedFinalTrack = playFinalGameOverTrack();
        if (!usedFinalTrack && !state.audioMuted) playSfx("death");
        pushLog("GAME OVER. All Ranked lives lost.", "bad");
      } else if (publicState?.status === "victory") {
        state.finalGameOverPrompt = null;
        state.finalVictoryPrompt = {
          depth: finalDepth,
          gold: finalGold,
          score: finalScore
        };
        pushLog("RANKED VICTORY. Canonical score confirmed.", "good");
      }
      markUiDirty();
    },`
  ],
  [
`  function dismissBootScreen() {
    if (bootDismissPromise) return bootDismissPromise;
    bootDismissPromise = Promise.resolve(initialGraphicsReady).then((outcome) => {
      if (!outcome || outcome.ready !== true) {
        showHdLoadFailure();
        return false;
      }
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
      return true;
    }, () => {
      showHdLoadFailure();
      return false;
    });
    return bootDismissPromise;
  }`,
`  function dismissBootScreen() {
    if (bootDismissPromise) return bootDismissPromise;
    bootInputLocked = true;
    bootScreenEl?.classList.add("loading");
    bootDismissPromise = Promise.resolve(initialGraphicsReady)
      .then((outcome) => {
        if (!outcome || outcome.ready !== true) {
          showHdLoadFailure();
          return false;
        }
        if (gameAppEl) {
          gameAppEl.classList.remove("app-hidden");
          requestAnimationFrame(() => syncHdMenuNavigation());
        }
        bootScreenEl?.classList.add("ready");
        return new Promise((resolve) => window.setTimeout(() => resolve(true), 180));
      }, () => {
        showHdLoadFailure();
        return false;
      })
      .then((ready) => {
        if (ready !== true) return false;
        return new Promise((resolve) => {
          if (!bootScreenEl) {
            resolve(true);
            return;
          }
          let hidden = false;
          const hideBoot = () => {
            if (hidden) return;
            hidden = true;
            bootScreenEl.classList.add("hidden");
            resolve(true);
          };
          bootScreenEl.classList.add("fading");
          bootScreenEl.addEventListener("transitionend", hideBoot, { once: true });
          window.setTimeout(hideBoot, 700);
        });
      })
      .finally(() => {
        bootInputLocked = false;
        bootInputUnlockAt = performance.now() + 250;
      });
    return bootDismissPromise;
  }`
  ],  [
`  window.addEventListener("keydown", (event) => {
    if (isMobilePortraitBlocked()) return;`,
`  window.addEventListener("keydown", (event) => {
    if (isMobilePortraitBlocked()) return;
    if (bootInputLocked || performance.now() < bootInputUnlockAt) {
      event.preventDefault();
      return;
    }`
  ],
  [
`  window.addEventListener("pointerdown", (event) => {
    if (isMobilePortraitBlocked()) return;`,
`  window.addEventListener("pointerdown", (event) => {
    if (isMobilePortraitBlocked()) return;
    if (bootInputLocked || performance.now() < bootInputUnlockAt) {
      event.preventDefault();
      return;
    }`
  ],
  [
`      state.onlineV3Directive = state.onlineV3NextDirective;
      state.onlineV3NextDirective = null;
      playSfx("portal");
      buildRoom();`,
`      state.onlineV3Directive = state.onlineV3NextDirective;
      state.onlineV3NextDirective = null;
      playSfx("portal");
      buildRoom();
      window.DungeonOnlineV3?.onRoomEntered?.(state.onlineV3Directive);`
  ],
  [
`    const def = CAMP_UPGRADES[index];
    if (!def) return;

    const level =`,
`    const def = CAMP_UPGRADES[index];
    if (!def) return;
    if (state.onlineV3Ranked) {
      const accepted = window.DungeonOnlineV3?.onCampAction?.({ action: "upgrade", upgradeId: def.id });
      if (!accepted) pushLog("That Camp upgrade is not currently available.", "bad");
      return;
    }

    const level =`
  ],
  [
`    state.campGold -= cost;
    state.elixirLoadout = {`,
`    if (state.onlineV3Ranked) {
      const accepted = window.DungeonOnlineV3?.onCampAction?.({ action: "elixir_buy_refill", elixirId: elixir.id });
      if (!accepted) pushLog("That elixir action is not currently available.", "bad");
      return accepted;
    }
    state.campGold -= cost;
    state.elixirLoadout = {`
  ],
  [
`    state.campGold += Math.max(0, refund);
    state.elixirLoadout = { type: "", charges: 0 };`,
`    if (state.onlineV3Ranked) {
      const accepted = window.DungeonOnlineV3?.onCampAction?.({ action: "elixir_discard", elixirId: elixir.id });
      if (!accepted) pushLog("That elixir action is not currently available.", "bad");
      return accepted;
    }
    state.campGold += Math.max(0, refund);
    state.elixirLoadout = { type: "", charges: 0 };`
  ],
  [
`    const matchingCopies = state.relics.filter((ownedId) => ownedId === relicId).length;
    state.relics.splice(safeIndex, 1);
    if (relicId === state.protectedStarterRelicId && matchingCopies <= 1) {
      state.protectedStarterRelicId = "";
    }
    normalizeRelicInventory();`,
`    if (state.onlineV3Ranked) {
      const accepted = window.DungeonOnlineV3?.onCampAction?.({ action: "relic_sale", relicId });
      if (!accepted) pushLog("That relic sale is not currently available.", "bad");
      state.campRelicSellPendingIndex = -1;
      markUiDirty();
      return accepted;
    }
    const matchingCopies = state.relics.filter((ownedId) => ownedId === relicId).length;
    state.relics.splice(safeIndex, 1);
    if (relicId === state.protectedStarterRelicId && matchingCopies <= 1) {
      state.protectedStarterRelicId = "";
    }
    normalizeRelicInventory();`
  ],
  [
`  function openForgeRoom() {
    if (!forgeRoomApi) return false;`,
`  function openRankedForgeRoom() {
    if (!isOnForge()) return false;
    clearForgeFlowState();
    state.forgePrompt = { step: "mode" };
    pushLog("Forge Chamber: 1 Temper, 2 Transmute, Esc leave.", "good");
    markUiDirty();
    return true;
  }

  function openForgeRoom() {
    if (state.onlineV3Ranked) return openRankedForgeRoom();
    if (!forgeRoomApi) return false;`
  ],
  [
`  function executeForgeTemper() {
    normalizeRelicInventory();`,
`  function executeForgeTemper() {
    normalizeRelicInventory();
    if (state.onlineV3Ranked) {
      state.forge.used = true;
      state.forgePrompt = null;
      markUiDirty();
      return Boolean(window.DungeonOnlineV3?.onForgeMode?.("temper"));
    }`
  ],
  [
`  function executeForgeTransmute(relicIndex) {
    const sacrificedRelicId = state.relics[relicIndex];`,
`  function executeForgeTransmute(relicIndex) {
    const sacrificedRelicId = state.relics[relicIndex];
    if (state.onlineV3Ranked) {
      if (!sacrificedRelicId) return false;
      state.forge.used = true;
      state.forgePrompt = null;
      markUiDirty();
      return Boolean(window.DungeonOnlineV3?.onForgeMode?.("transmute", { sacrificeRelicId }));
    }`
  ],
  [
`  function chooseRelic(index) {
    if (state.phase !== "relic") return;`,
`  function chooseRelic(index) {
    if (state.phase !== "relic") return;
    if (state.onlineV3Ranked && state.onlineV3RelicReplacementPresentation) {
      const presentation = state.onlineV3RelicReplacementPresentation;
      const outgoingRelicId = String(state.relics[index] || "");
      const replacement = presentation.choices.find((choice) =>
        choice.removalRelicIds.includes(outgoingRelicId)
      );
      if (!replacement) {
        pushLog("That carried relic cannot be replaced by this offer.", "bad");
        return;
      }
      const accepted = window.DungeonOnlineV3?.onRelicReplacementChoice?.(
        replacement.replacementChoiceId
      );
      if (!accepted) {
        pushLog("That relic replacement is still resolving.", "warn");
        return;
      }
      state.turnInProgress = true;
      markUiDirty();
      return;
    }
    if (state.onlineV3Ranked && state.onlineV3ForgePresentation) {
      const presentation = state.onlineV3ForgePresentation;
      const skipIndex = getRelicDraftSkipIndex();
      if (index === skipIndex) {
        const accepted = window.DungeonOnlineV3?.onForgeChoice?.(presentation.leaveChoiceId);
        if (!accepted) pushLog("That Forge choice is still resolving.", "warn");
        return;
      }
      if (state.relicSwapPending && Number.isInteger(presentation.pendingRewardIndex)) {
        const outgoingRelicId = String(state.relics[index] || "");
        const pendingReward = presentation.rewardChoices[presentation.pendingRewardIndex];
        const replacement = pendingReward?.replacementChoices?.find((choice) =>
          choice.removalRelicIds.includes(outgoingRelicId)
        );
        if (!replacement) {
          pushLog("That relic cannot be offered to this Forge result.", "bad");
          return;
        }
        const accepted = window.DungeonOnlineV3?.onForgeChoice?.(replacement.choiceId);
        if (!accepted) pushLog("That Forge choice is still resolving.", "warn");
        return;
      }
      const reward = presentation.rewardChoices[index];
      if (!reward) return;
      if (reward.directChoiceId) {
        const accepted = window.DungeonOnlineV3?.onForgeChoice?.(reward.directChoiceId);
        if (!accepted) pushLog("That Forge choice is still resolving.", "warn");
        return;
      }
      if (reward.replacementChoices.length > 0) {
        presentation.pendingRewardIndex = index;
        state.relicSwapPending = reward.relicId;
        state.relicSwapAdditionalDiscards = 0;
        pushLog("Relic inventory full. Choose the relic the Forge should replace.", "warn");
        markUiDirty();
        return;
      }
      pushLog("That Forge result is unavailable.", "bad");
      return;
    }`,
  ],
  [
`      if (key === "escape" || key === "n") {
        clearForgeFlowState();`,
`      if (key === "escape" || key === "n") {
        if (state.onlineV3Ranked) window.DungeonOnlineV3?.onForgeLeave?.();
        clearForgeFlowState();`
  ],
  [
`      if (!state.onlineV3NextDirective) {
        pushLog("Online v3 is still resolving the next room.", "warn");
        return;`,
`      if (!state.onlineV3NextDirective) {
        if (state.roomType === "merchant") {
          window.DungeonOnlineV3?.onMerchantLeave?.({ enterPortal: true });
          return;
        }
        if (state.roomType === "forge" && window.DungeonOnlineV3?.onForgeLeave?.({ enterPortal: true })) {
          pushLog("Saving Forge choice and descending...", "good");
          return;
        }
        if (window.DungeonOnlineV3?.onPortalEntry?.()) {
          pushLog("Descending...", "good");
          return;
        }
        pushLog("Online v3 is still resolving the next room.", "warn");
        return;`
  ],
  [
`  function openCampStartDepthPrompt() {
    if (state.phase !== "camp") return false;
    if (state.extractRelicPrompt) return false;
    const available = getAvailableStartDepths();`,
`  function openCampStartDepthPrompt() {
    if (state.phase !== "camp") return false;
    if (state.extractRelicPrompt) return false;
    if (state.onlineV3Ranked) syncRankedStartDepthUnlocks(window.DungeonOnlineV3?.getSnapshot?.()?.publicState?.campaign);
    const available = getAvailableStartDepths();`
  ],
  [
`    if (available.length <= 1) {
      startRun({ carriedRelics: [...state.relics], startDepth: 0 });`,
`    if (available.length <= 1) {
      if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onCampStartRun?.(0));
      startRun({ carriedRelics: [...state.relics], startDepth: 0 });`
  ],
  [
`    state.campStartDepthPromptOpen = false;
    startRun({ carriedRelics: [...state.relics], startDepth: selectedDepth });`,
`    state.campStartDepthPromptOpen = false;
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onCampStartRun?.(selectedDepth));
    startRun({ carriedRelics: [...state.relics], startDepth: selectedDepth });`
  ],
  [
`  function toggleMutator(index) {
    const mutator = MUTATORS[index];
    if (!mutator) return;`,
`  function toggleMutator(index) {
    const mutator = MUTATORS[index];
    if (!mutator) return;
    if (state.onlineV3Ranked && state.phase === "camp") {
      const action = state.activeMutators[mutator.id] ? "mutator_remove" : "mutator_add";
      const accepted = window.DungeonOnlineV3?.onCampAction?.({ action, mutatorId: mutator.id });
      if (!accepted) pushLog("That Ranked mutator is not currently available.", "bad");
      return;
    }`
  ],
  [
`      startRun({ carriedRelics, resetMapFragments: true });
      state.player.gold = Math.max(0, Number(publicState?.gold) || 0);`,
`      const campaign = publicState?.campaign || {};
      hydrateRankedChestCarry(publicState, { applyDelta: false });
      resetRankedCanonicalChestSlots(publicState);
      startRun({ carriedRelics, startDepth: Math.max(0, Number(publicState?.startDepth) || 0) });
      state.treasureMapFragments = Math.max(0, Number(campaign.treasureMapFragments) || 0);
      state.forcedNextRoomType = String(campaign.forcedNextRoomType || "");
      syncRankedStartDepthUnlocks(campaign);
      syncRankedCanonicalPotionState(publicState);
      state.player.gold = Math.max(0, Number(publicState?.gold) || 0);
      syncRankedScoreProjection(publicState);`
  ],
  [
`      state.runMaxDepth = Math.max(0, Number(publicState?.maxDepth) || state.runMaxDepth);
      markUiDirty();`,
`      if (!syncRankedScoreProjection(publicState)) {
        state.runMaxDepth = Math.max(0, Number(publicState?.maxDepth) || state.runMaxDepth);
      }
      const resources = publicState?.build?.resources || {};
      const campaign = publicState?.campaign || {};
      syncRankedCanonicalPotionState(publicState);
      if (Array.isArray(publicState?.build?.relics)) {
        syncRankedCanonicalRelics(publicState?.build || {});
      }
      state.treasureMapFragments = Math.max(0, Number(campaign.treasureMapFragments) || 0);
      state.forcedNextRoomType = String(campaign.forcedNextRoomType || "");
      syncRankedStartDepthUnlocks(campaign);
      syncRankedRunModifiers(publicState);
      hydrateRankedChestCarry(publicState, { applyDelta: true });
      resetRankedCanonicalChestSlots(publicState);
      markUiDirty();`
  ],
  [
`    setNextDirective(directive) {`,
`    beginRankedExtraction() {
      if (!state.onlineV3Ranked) return;
      state.extractConfirm = null;
      state.merchantMenuOpen = false;
      state.turnInProgress = true;
      markUiDirty();
    },
    isRankedTestBotActive() {
      return Boolean(state.onlineV3Ranked && state.onlineV3TestBotUnlocked && isObserverBotActive());
    },
    requiresRankedTestAssistance() {
      return Boolean(state.onlineV3Ranked && state.onlineV3TestBotUnlocked);
    },
    async unlockRankedTestBot(password) {
      if (!state.onlineV3Ranked || window.DUNGEON_ONLINE_TEST_BOT_ENABLED !== true) return false;
      const expected = String(window.DUNGEON_ONLINE_TEST_BOT_PASSWORD_HASH || "");
      if (!expected || !window.crypto?.subtle) return false;
      const bytes = new TextEncoder().encode(String(password || ""));
      const digest = await window.crypto.subtle.digest("SHA-256", bytes);
      const actual = "sha256:" + Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
      if (actual !== expected) return false;
      await window.DungeonOnlineV3?.markTestAssistance?.("observer_bot");
      state.onlineV3TestBotUnlocked = true;
      state.audioMuted = true;
      setStorageItem(STORAGE_AUDIO_MUTED, "1");
      syncBgmWithState(true);
      toggleDebugCheatMenu(true, { botOnly: false });
      pushLog("Ranked test controls unlocked for this run.", "warn");
      markUiDirty();
      return true;
    },
    enterRankedCamp(profile, offer) {
      const wasCamp = state.phase === "camp";
      const build = profile?.build || {};
      state.onlineV3Ranked = true;
      hydrateRankedChestCarry({ campaign: profile?.campaign }, { applyDelta: false });
      state.onlineV3FatalPending = false;
      state.onlineV3Directive = null;
      state.onlineV3NextDirective = null;
      state.turnInProgress = false;
      state.extractConfirm = null;
      state.extractRelicPrompt = null;
      state.merchantMenuOpen = false;
      state.legendarySwapPending = null;
      state.relicSwapPending = null;
      state.relicSwapAdditionalDiscards = 0;
      state.campStartDepthPromptOpen = false;
      state.campRelicSellPendingIndex = -1;
      if (!wasCamp) state.campPanelView = "shop";
      state.campGold = Math.max(0, Number(profile?.campGold) || 0);
      state.lives = Math.max(0, Number(profile?.lives) || 0);
      state.treasureMapFragments = Math.max(0, Number(profile?.campaign?.treasureMapFragments) || 0);
      state.forcedNextRoomType = String(profile?.campaign?.forcedNextRoomType || "");
      syncRankedStartDepthUnlocks(profile?.campaign);
      state.campUpgrades = sanitizeCampUpgrades(build.campUpgrades || {});
      state.skillTiers = sanitizeSkillTiers(build.skillTiers || {});
      const canonicalElixir = Array.isArray(build.elixirs) ? build.elixirs[0] : null;
      state.elixirLoadout = sanitizeElixirLoadout(canonicalElixir
        ? { type: canonicalElixir.elixirId, charges: canonicalElixir.charges }
        : {});
      state.relics = (Array.isArray(build.relics) ? build.relics : []).flatMap((relic) =>
        Array.from({ length: Math.max(1, Number(relic.stacks) || 1) }, () => String(relic.relicId || relic.id || ""))
      ).filter(Boolean);
      normalizeRelicInventory();
      const choices = Array.isArray(offer?.choices) ? offer.choices : [];
      syncRankedRunModifiers({
        runModifiers: profile?.runModifiers,
        mutatorProgress: profile?.mutatorProgress
      });
      syncRankedCanonicalPotionState(profile);
      const pricedUpgrade = choices.find((choice) => choice?.action === "upgrade");
      const pricedDef = CAMP_UPGRADES.find((entry) => entry.id === pricedUpgrade?.upgradeId);
      const pricedLevel = Math.max(0, Number(pricedUpgrade?.currentLevel) || 0);
      const basePrice = pricedDef
        ? Math.round(pricedDef.baseCost * Math.max(1, Number(pricedDef.costGrowth) || 2) ** pricedLevel)
        : 0;
      state.campVisitShopCostMult = basePrice > 0
        ? Math.max(0, Number(pricedUpgrade.price) || 0) / basePrice
        : 1;
      state.phase = "camp";
      if (!wasCamp) {
        pushLog("Extraction success. Ranked result secured.", "good");
        pushLog("Camp: use arrows to choose a tab or action, then press Enter.");
      }
      syncBgmWithState();
      markUiDirty();
    },
    reportCampError() {
      if (!state.onlineV3Ranked || state.phase !== "camp") return;
      state.turnInProgress = false;
      pushLog("Camp action could not be completed. Try again.", "bad");
      markUiDirty();
    },
    setNextDirective(directive) {`
  ],  [
`    if (state.phase === "menu") {
      if (state.menuNewGameConfirmOpen) {`,
`    if (state.phase === "menu") {
      const newGameRow = event.target?.closest?.("[data-menu-new-game-index]");
      if (state.menuNewGameConfirmOpen && newGameRow && screenOverlayEl?.contains(newGameRow)) {
        const newGameIndex = Number(newGameRow.dataset.menuNewGameIndex);
        if (Number.isInteger(newGameIndex)) {
          state.menuNewGameConfirmIndex = newGameIndex;
          activateMenuNewGameConfirmSelection(newGameIndex);
          return;
        }
      }
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
const rankedSpecialRoomScalingReplacements = [
  [
`  function getCampaignRegionConfig(depth = state.depth) {
    const region = getCampaignRegion(depth);
    return CAMPAIGN_REGION_CONFIGS[region.id] || CAMPAIGN_REGION_CONFIGS.descent;
  }`,
`  function getCampaignRegionConfig(depth = state.depth) {
    const region = getCampaignRegion(depth);
    return CAMPAIGN_REGION_CONFIGS[region.id] || CAMPAIGN_REGION_CONFIGS.descent;
  }

  function getRankedSpecialRoomScalingDepth() {
    if (!state.onlineV3Ranked || !["vault", "forge", "otter"].includes(state.roomType)) {
      return Math.max(0, Math.floor(Number(state.depth) || 0));
    }
    return Math.max(
      Math.max(0, Math.floor(Number(state.depth) || 0)),
      Math.max(
        0,
        Math.floor(Number(state.onlineV3Directive?.specialRoomPayload?.scalingDepth) || 0)
      )
    );
  }`
  ],
  [
`  function createEnemy(type, x, y, options = {}) {
    const depthScale = Math.floor(state.depth / 2);`,
`  function createEnemy(type, x, y, options = {}) {
    const encounterDepth = Math.max(0, Math.floor(Number(options.depthOverride) || state.depth));
    const depthScale = Math.floor(encounterDepth / 2);`
  ],
  [
`        hp: scaledCombat(2 + Math.floor(state.depth / 5)),
        attack: scaledCombat(1 + Math.floor(state.depth / 12)),`,
`        hp: scaledCombat(2 + Math.floor(encounterDepth / 5)),
        attack: scaledCombat(1 + Math.floor(encounterDepth / 12)),`
  ],
  [
`        hp: Math.round(scaledCombat(12 + Math.floor(state.depth * 1.8)) * vaultGuardianHpMultiplier),
        attack: scaledCombat(4 + Math.floor(state.depth / 3)),`,
`        hp: Math.round(scaledCombat(12 + Math.floor(encounterDepth * 1.8)) * vaultGuardianHpMultiplier),
        attack: scaledCombat(4 + Math.floor(encounterDepth / 3)),`
  ],
  [
`        hp: Math.round(scaledCombat(12 + Math.floor(state.depth * 1.8)) * BLACKSMITH_GUARDIAN_HP_MULTIPLIER),
        attack: scaledCombat(4 + Math.floor(state.depth / 3)),`,
`        hp: Math.round(scaledCombat(12 + Math.floor(encounterDepth * 1.8)) * BLACKSMITH_GUARDIAN_HP_MULTIPLIER),
        attack: scaledCombat(4 + Math.floor(encounterDepth / 3)),`
  ],
  [
`    const lateScale = getEnemyLateDepthMultiplier(state.depth);`,
`    const lateScale = getEnemyLateDepthMultiplier(encounterDepth);`
  ],
  [
`  function handleChestAttackUpgrade(inTreasureRoom) {
    const bucketIndex = getChestAttackBucketIndex(state.depth);`,
`  function handleChestAttackUpgrade(inTreasureRoom) {
    const rewardDepth = getRankedSpecialRoomScalingDepth();
    const bucketIndex = getChestAttackBucketIndex(rewardDepth);`
  ],
  [
`    const chestAttackFlat = getChestUpgradeFlatByDepth(CHEST_ATTACK_UPGRADE_FLAT, state.depth);
    state.sessionChestAttackFlat += chestAttackFlat;`,
`    const chestAttackFlat = getChestUpgradeFlatByDepth(CHEST_ATTACK_UPGRADE_FLAT, rewardDepth);
    state.sessionChestAttackFlat += chestAttackFlat;`
  ],
  [
`  function handleChestArmorUpgrade(inTreasureRoom) {
    const bucketIndex = getChestAttackBucketIndex(state.depth);`,
`  function handleChestArmorUpgrade(inTreasureRoom) {
    const rewardDepth = getRankedSpecialRoomScalingDepth();
    const bucketIndex = getChestAttackBucketIndex(rewardDepth);`
  ],
  [
`    const chestArmorFlat = getChestUpgradeFlatByDepth(CHEST_ARMOR_UPGRADE_FLAT, state.depth);
    state.sessionChestArmorFlat += chestArmorFlat;`,
`    const chestArmorFlat = getChestUpgradeFlatByDepth(CHEST_ARMOR_UPGRADE_FLAT, rewardDepth);
    state.sessionChestArmorFlat += chestArmorFlat;`
  ],
  [
`  function handleChestHealthUpgrade(inTreasureRoom) {
    const bucketIndex = getChestAttackBucketIndex(state.depth);`,
`  function handleChestHealthUpgrade(inTreasureRoom) {
    const rewardDepth = getRankedSpecialRoomScalingDepth();
    const bucketIndex = getChestAttackBucketIndex(rewardDepth);`
  ],
  [
`  function handleChestHealingDrop() {`,
`  function applyRankedCanonicalChestStatOutcome(outcome, inTreasureRoom) {
    if (!state.onlineV3Ranked || !["health", "attack", "armor"].includes(outcome)) return false;
    const rewardDepth = getRankedSpecialRoomScalingDepth();
    const bucketIndex = getChestAttackBucketIndex(rewardDepth);
    const bucketLabel = getChestAttackBucketLabel(bucketIndex);
    if (outcome === "attack") {
      const current = getChestAttackBucketCount(bucketIndex);
      const next = Math.min(CHEST_ATTACK_BUCKET_MAX, current + 1);
      const flat = getChestUpgradeFlatByDepth(CHEST_ATTACK_UPGRADE_FLAT, rewardDepth);
      state.sessionChestAttackDepthBuckets[String(bucketIndex)] = next;
      state.sessionChestAttackFlat += flat;
      state.player.attack += scaleFlatAttackByBlade(flat);
      pushTestModeLog(\`Ranked canonical chest ATK @d\${rewardDepth}: +\${flat}, bucket \${bucketLabel} \${next}/\${CHEST_ATTACK_BUCKET_MAX}.\`);
      pushLog(\`Chest: Attack +\${flat}. Depth \${bucketLabel} chest ATK \${next}/\${CHEST_ATTACK_BUCKET_MAX}.\`, "good");
      return true;
    }
    if (outcome === "armor") {
      const current = getChestArmorBucketCount(bucketIndex);
      const next = Math.min(CHEST_ATTACK_BUCKET_MAX, current + 1);
      const flat = getChestUpgradeFlatByDepth(CHEST_ARMOR_UPGRADE_FLAT, rewardDepth);
      state.sessionChestArmorDepthBuckets[String(bucketIndex)] = next;
      state.sessionChestArmorFlat += flat;
      state.player.armor += flat;
      pushTestModeLog(\`Ranked canonical chest ARM @d\${rewardDepth}: +\${flat}, bucket \${bucketLabel} \${next}/\${CHEST_ATTACK_BUCKET_MAX}.\`);
      pushLog(\`Chest: Armor +\${flat}. Depth \${bucketLabel} chest ARM \${next}/\${CHEST_ATTACK_BUCKET_MAX}.\`, "good");
      return true;
    }
    const current = getChestHealthBucketCount(bucketIndex);
    const next = Math.min(CHEST_ATTACK_BUCKET_MAX, current + 1);
    const flat = getChestHealthUpgradeFlatByDepth(rewardDepth);
    state.sessionChestHealthDepthBuckets[String(bucketIndex)] = next;
    state.sessionChestHealthFlat += flat;
    state.player.maxHp += flat;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + flat);
    pushTestModeLog(\`Ranked canonical chest HP @d\${rewardDepth}: +\${flat}, bucket \${bucketLabel} \${next}/\${CHEST_ATTACK_BUCKET_MAX}.\`);
    pushLog(\`Chest: Health +\${flat}. Depth \${bucketLabel} chest HP \${next}/\${CHEST_ATTACK_BUCKET_MAX}.\`, "good");
    return true;
  }

  function handleChestHealingDrop() {`
  ],
  [
`    const chestHealthFlat = getChestHealthUpgradeFlatByDepth(state.depth);
    state.sessionChestHealthFlat += chestHealthFlat;`,
`    const chestHealthFlat = getChestHealthUpgradeFlatByDepth(rewardDepth);
    state.sessionChestHealthFlat += chestHealthFlat;`
  ],
  [
`    state.roomType = state.onlineV3Ranked && state.onlineV3Directive
      ? state.onlineV3Directive.roomType
      : chooseRoomType();`,
`    state.roomType = state.onlineV3Ranked && state.onlineV3Directive
      ? state.onlineV3Directive.roomType
      : chooseRoomType();
    const specialRoomScalingDepth = getRankedSpecialRoomScalingDepth();`
  ],
  [
`        ? forgeRoomApi.getForgeEncounterProfileForDepth(state.depth)`,
`        ? forgeRoomApi.getForgeEncounterProfileForDepth(specialRoomScalingDepth)`
  ],
  [
`      const extra = Math.floor(Math.max(0, Number(state.depth) || 0) / OTTER_ROOM_ENEMY_DEPTH_STEP) * OTTER_ROOM_ENEMY_STEP_GAIN;`,
`      const extra = Math.floor(specialRoomScalingDepth / OTTER_ROOM_ENEMY_DEPTH_STEP) * OTTER_ROOM_ENEMY_STEP_GAIN;`
  ],
  [
`        ? vaultRoomApi.getVaultEncounterProfile(state.depth)`,
`        ? vaultRoomApi.getVaultEncounterProfile(specialRoomScalingDepth)`
  ],
  [
`      const spawnedEnemy = createEnemy(enemyType, spot.x, spot.y, { elite });`,
`      const spawnedEnemy = createEnemy(enemyType, spot.x, spot.y, { elite, depthOverride: specialRoomScalingDepth });`
  ]
];
for (const [sourceText, replacement] of rankedSpecialRoomScalingReplacements) {
  if (!game.includes(sourceText)) {
    throw new Error(`Missing Ranked special-room scaling source: ${sourceText.slice(0, 80)}`);
  }
  game = game.replace(sourceText, replacement);
}
const rankedGoldGameReplacements = [
  [
`  window.DungeonOnlineV3GameBridge = Object.freeze({`,
`  window.DungeonOnlineV3GameBridge = Object.freeze({
    refreshRankedHud() {
      markUiDirty();
    },
    setRoomIntegrityContext(context = {}) {
      const directiveId = String(state.onlineV3Directive?.directiveId || "");
      if (directiveId && directiveId !== onlineV3RoomClearDirectiveId) {
        onlineV3RoomClearDirectiveId = directiveId;
        onlineV3RoomClearReported = false;
      }
      onlineV3RoomCompletionCapability = context.completionCapability || null;
      onlineV3BoundedProcClaims = context.boundedProcClaims === true;
      onlineV3RoomStartingGold = Math.max(
        0,
        Math.floor(Number(context.startingGold) || 0)
      );
      onlineV3RoomStartingTurn = Math.max(0, Math.floor(Number(state.turn) || 0));
    },
    captureRankedBoundary() {
      if (!state.onlineV3Ranked) return null;
      const boundary = {
        turnCount: Math.max(
          0,
          Math.floor(Number(state.turn) || 0) - onlineV3RoomStartingTurn
        ),
        rewardClaims: onlineV3RewardRecorder?.snapshot() || [],
        reportedGoldDelta: Math.max(
          0,
          Math.floor(Number(state.player.gold) || 0) - onlineV3RoomStartingGold
        ),
        completionCapability: onlineV3RoomCompletionCapability
      };
      onlineV3RoomCompletionCapability = null;
      return boundary;
    },
    resetRankedBoundaryRecorder() {
      if (!state.onlineV3Ranked) return false;
      onlineV3ActiveChestClaimId = null;
      const firstUnconsumed = onlineV3CanonicalChestSlots.findIndex((slot) => !slot.consumed);
      onlineV3CanonicalChestSlotCursor = firstUnconsumed >= 0
        ? firstUnconsumed
        : onlineV3CanonicalChestSlots.length;
      const consumedChestCount = onlineV3CanonicalChestSlots.reduce(
        (count, slot) => count + (slot.consumed ? 1 : 0),
        0
      );
      onlineV3RewardRecorder = window.DungeonRankedV3Recorder?.createRewardClaimRecorder?.({
        initialChestCount: consumedChestCount
      }) || null;
      onlineV3RoomStartingGold = Math.max(0, Math.floor(Number(state.player.gold) || 0));
      onlineV3RoomStartingTurn = Math.max(0, Math.floor(Number(state.turn) || 0));
      return true;
    },
    showRankedRoomClearAward(amount) {
      const canonicalAmount = Math.max(0, Math.floor(Number(amount) || 0));
      if (!state.onlineV3Ranked || canonicalAmount <= 0) return false;
      pushLog("Room clear bonus: +" + canonicalAmount + " gold.", "good");
      return true;
    },`
  ],
  [
`  function persistMutatorState() {
    setStorageItem(STORAGE_MUT_UNLOCK, JSON.stringify(state.unlockedMutators));`,
`  function persistMutatorState() {
    if (state.onlineV3Ranked) return;
    setStorageItem(STORAGE_MUT_UNLOCK, JSON.stringify(state.unlockedMutators));`
  ],
  [
`  function saveMetaProgress() {
    state.highscore = Math.max(state.highscore, getRunMaxDepth());`,
`  function saveMetaProgress() {
    if (state.onlineV3Ranked) return;
    state.highscore = Math.max(state.highscore, getRunMaxDepth());`
  ],
  [
`  const state = {`,
`  let onlineV3RewardRecorder = null;
  let onlineV3ActiveChestClaimId = null;
  let onlineV3CanonicalChestSlots = [];
  let onlineV3CanonicalChestSlotCursor = 0;
  let onlineV3CanonicalChestMode = false;
  let onlineV3RoomCompletionCapability = null;
  let onlineV3BoundedProcClaims = false;
  let onlineV3RoomStartingGold = 0;
  let onlineV3RoomStartingTurn = 0;
  let onlineV3RoomClearDirectiveId = "";
  let onlineV3RoomClearReported = false;
  const ONLINE_V3_CANONICAL_CHEST_ROOMS = new Set([
    "combat", "boss", "final", "cursed", "duel", "horde", "treasure", "vault", "ambush", "shrine"
  ]);
  const ONLINE_V3_SPECIAL_CHEST_TYPES = new Set([
    "arena_reward", "otter_red", "crossroads_power", "crossroads_mercy"
  ]);
  function resetRankedCanonicalChestSlots(publicState = null) {
    onlineV3CanonicalChestSlots = [];
    onlineV3CanonicalChestSlotCursor = 0;
    onlineV3CanonicalChestMode = false;
    const envelope = publicState?.currentRewardEnvelope;
    const slots = Array.isArray(envelope?.claimSlots) ? envelope.claimSlots : [];
    const roomType = String(envelope?.roomType || state.onlineV3Directive?.roomType || "");
    const marker = envelope?.canonicalChestOutcomesVersion;
    if (marker !== undefined && marker !== "v1") throw new TypeError("RANKED_CANONICAL_CHEST_MARKER_INVALID");
    if (marker !== "v1") return true;
    if (!ONLINE_V3_CANONICAL_CHEST_ROOMS.has(roomType)) return true;
    if (!Array.isArray(envelope?.claimSlots)) throw new TypeError("RANKED_CANONICAL_CHEST_SLOTS_MISSING");
    if (slots.some((slot) => {
      const outcome = slot?.canonicalOutcome;
      return !slot || typeof slot.slotId !== "string" ||
        !outcome || typeof outcome !== "object" || Array.isArray(outcome) ||
        typeof outcome.awardId !== "string" || !outcome.awardId.trim() ||
        JSON.stringify(Object.keys(outcome).sort()) !== JSON.stringify(["awardId", "outcome"]) ||
        slot.slotId !== "chest_" + (slots.indexOf(slot) + 1) ||
        (slot.consumed !== undefined && typeof slot.consumed !== "boolean") ||
        !["health", "healing", "attack", "armor", "potion", "map_fragment", "gold", "trap", "fallback_gold"].includes(outcome.outcome);
    })) throw new TypeError("RANKED_CANONICAL_CHEST_SLOT_INVALID");
    let sawUnconsumed = false;
    for (const slot of slots) {
      if (slot.consumed === true && sawUnconsumed) {
        throw new TypeError("RANKED_CANONICAL_CHEST_SLOT_ORDER_INVALID");
      }
      if (slot.consumed !== true) sawUnconsumed = true;
    }
    onlineV3CanonicalChestSlots = slots.map((slot) => ({
      slotId: String(slot.slotId),
      canonicalOutcome: { awardId: String(slot.canonicalOutcome.awardId), outcome: slot.canonicalOutcome.outcome },
      consumed: slot.consumed === true
    }));
    const firstUnconsumed = onlineV3CanonicalChestSlots.findIndex((slot) => !slot.consumed);
    onlineV3CanonicalChestSlotCursor = firstUnconsumed >= 0
      ? firstUnconsumed
      : onlineV3CanonicalChestSlots.length;
    onlineV3CanonicalChestMode = true;
    return true;
  }
  function getRankedCanonicalChestOutcome(chest) {
    if (!state.onlineV3Ranked || !onlineV3CanonicalChestMode) return null;
    const roomType = String(state.onlineV3Directive?.roomType || state.roomType || "");
    if (!ONLINE_V3_CANONICAL_CHEST_ROOMS.has(roomType) || ONLINE_V3_SPECIAL_CHEST_TYPES.has(String(chest?.type || ""))) return null;
    const slot = onlineV3CanonicalChestSlots[onlineV3CanonicalChestSlotCursor];
    if (!slot || slot.consumed) throw new TypeError("RANKED_CANONICAL_CHEST_SLOT_ORDER_INVALID");
    onlineV3CanonicalChestSlotCursor += 1;
    slot.consumed = true;
    return slot.canonicalOutcome;
  }
  function hydrateRankedChestCarry(publicState = {}, options = {}) {
    const bonuses = publicState?.campaign?.chestBonuses || {};
    const nextAttackBuckets = sanitizeChestAttackDepthBuckets(bonuses.attackDepthBuckets);
    const nextArmorBuckets = sanitizeChestAttackDepthBuckets(bonuses.armorDepthBuckets);
    const nextHealthBuckets = sanitizeChestAttackDepthBuckets(bonuses.healthDepthBuckets);
    const flatFor = (buckets, base, health = false) => Object.entries(buckets).reduce((sum, [bucket, count]) =>
      sum + Number(count || 0) * (health
        ? getChestHealthUpgradeFlatByBucket(Number(bucket))
        : getChestUpgradeFlatByBucket(base, Number(bucket))), 0);
    const next = {
      attack: flatFor(nextAttackBuckets, CHEST_ATTACK_UPGRADE_FLAT),
      armor: flatFor(nextArmorBuckets, CHEST_ARMOR_UPGRADE_FLAT),
      health: flatFor(nextHealthBuckets, CHEST_HEALTH_UPGRADE_FLAT, true)
    };
    const previous = {
      attack: Math.max(0, Number(state.sessionChestAttackFlat) || 0),
      armor: Math.max(0, Number(state.sessionChestArmorFlat) || 0),
      health: Math.max(0, Number(state.sessionChestHealthFlat) || 0)
    };
    state.sessionChestAttackDepthBuckets = nextAttackBuckets;
    state.sessionChestArmorDepthBuckets = nextArmorBuckets;
    state.sessionChestHealthDepthBuckets = nextHealthBuckets;
    state.sessionChestAttackFlat = next.attack;
    state.sessionChestArmorFlat = next.armor;
    state.sessionChestHealthFlat = next.health;
    if (options.applyDelta === true && state.phase === "playing") {
      const attackDelta = next.attack - previous.attack;
      const armorDelta = next.armor - previous.armor;
      const healthDelta = next.health - previous.health;
      if (attackDelta) state.player.attack += scaleFlatAttackByBlade(attackDelta);
      if (armorDelta) state.player.armor = Math.max(0, state.player.armor + armorDelta);
      if (healthDelta) {
        state.player.maxHp = Math.max(1, state.player.maxHp + healthDelta);
        state.player.hp = clamp(state.player.hp, 0, state.player.maxHp);
      }
    }
    return next;
  }
  function syncRankedCanonicalPotionState(publicState) {
    if (!publicState || publicState.potionPolicyVersion === undefined) return false;
    if (publicState.potionPolicyVersion !== "v1") throw new TypeError("RANKED_POTION_POLICY_MARKER_INVALID");
    const resources = publicState?.build?.resources;
    const canonicalPotions = resources?.potions;
    const canonicalMaxPotions = resources?.maxPotions;
    const canonicalHealMultiplier = publicState?.runModifiers?.summary?.potionModifiers?.healMultiplier;
    if (
      !Number.isSafeInteger(canonicalPotions) || canonicalPotions < 0 ||
      !Number.isSafeInteger(canonicalMaxPotions) || canonicalMaxPotions < 1 ||
      !Number.isFinite(canonicalHealMultiplier) || canonicalHealMultiplier <= 0
    ) throw new TypeError("RANKED_CANONICAL_POTION_STATE_INVALID");
    state.player.maxPotions = canonicalMaxPotions;
    state.player.potions = Math.min(canonicalMaxPotions, canonicalPotions);
    state.runMods.potionHealMult = canonicalHealMultiplier;
    return true;
  }
  function syncRankedCanonicalRelics(build = {}) {
    const canonicalRelics = (Array.isArray(build?.relics) ? build.relics : []).flatMap((relic) =>
      Array.from(
        { length: Math.max(1, Number(relic?.stacks) || 1) },
        () => String(relic?.relicId || relic?.id || "")
      )
    ).filter(Boolean);
    const previousIdolStacks = state.relics.reduce(
      (count, relicId) => count + (relicId === "idol" ? 1 : 0),
      0
    );
    const canonicalIdolStacks = canonicalRelics.reduce(
      (count, relicId) => count + (relicId === "idol" ? 1 : 0),
      0
    );
    const idolStackDelta = canonicalIdolStacks - previousIdolStacks;
    if (idolStackDelta !== 0) {
      state.runMods.goldMultiplier = Math.max(
        0.1,
        Number(state.runMods.goldMultiplier || 1) + idolStackDelta * GOLDEN_IDOL_GOLD_MULTIPLIER
      );
    }
    state.relics = [...canonicalRelics];
    normalizeRelicInventory();
  }
  function syncRankedStartDepthUnlocks(campaign = {}) {
    const unlocked = Array.isArray(campaign?.unlockedStartDepths)
      ? campaign.unlockedStartDepths
      : [];
    state.startDepthUnlocks = Object.fromEntries(
      unlocked
        .map((depth) => Math.max(0, Math.floor(Number(depth) || 0)))
        .filter((depth) => depth > 0)
        .map((depth) => [String(depth), true])
    );
  }

  function syncRankedScoreProjection(publicState) {
    const score = publicState?.score;
    const inputs = score?.inputs;
    const scoreValue = Number(score?.score);
    const depth = Number(inputs?.acceptedMaxDepth);
    const earnedGold = Number(inputs?.acceptedRunGoldEarned);
    if (
      !Number.isSafeInteger(scoreValue) || scoreValue < 0 ||
      !Number.isSafeInteger(depth) || depth < 0 ||
      !Number.isSafeInteger(earnedGold) || earnedGold < 0
    ) {
      return false;
    }
    state.runMaxDepth = depth;
    state.runGoldEarned = earnedGold;
    state.highscore = depth;
    return true;
  }

  function syncRankedRunModifiers(publicState, options = {}) {
    const activeIds = new Set(
      (Array.isArray(publicState?.runModifiers?.active) ? publicState.runModifiers.active : [])
        .map((entry) => String(entry?.modifierId || ""))
        .filter(Boolean)
    );
    const unlockedIds = new Set(
      (Array.isArray(publicState?.mutatorProgress?.unlockedMutatorIds)
        ? publicState.mutatorProgress.unlockedMutatorIds
        : [])
        .map((id) => String(id || ""))
        .filter(Boolean)
    );
    state.activeMutators = Object.fromEntries(
      MUTATORS.map((mutator) => [mutator.id, activeIds.has(mutator.id)])
    );
    state.unlockedMutators = Object.fromEntries(
      MUTATORS.map((mutator) => [mutator.id, unlockedIds.has(mutator.id) || activeIds.has(mutator.id)])
    );
    const legalPactIds = new Set((pactRoomApi?.PACTS || []).map((pact) => pact.id));
    const canonicalPacts = (Array.isArray(publicState?.build?.pacts) ? publicState.build.pacts : [])
      .map((id) => String(id || ""))
      .filter((id, index, values) => legalPactIds.has(id) && values.indexOf(id) === index)
      .slice(-1);
    const previousPacts = Array.isArray(state.activePacts) ? state.activePacts : [];
    const pactChanged = canonicalPacts.join("|") !== previousPacts.join("|");
    if (options.hydrateOnly === true) {
      state.activePacts = canonicalPacts;
      state.pactBasePlayerStats = null;
      return;
    }
    if (pactChanged && previousPacts.length > 0 && state.pactBasePlayerStats &&
      pactEffectsApi && typeof pactEffectsApi.removeSinglePactEffect === "function") {
      for (const pactId of previousPacts) {
        pactEffectsApi.removeSinglePactEffect(state.player, pactId, {
          critCap: CRIT_CHANCE_CAP,
          minEffectiveDamage: MIN_EFFECTIVE_DAMAGE,
          chainsArmorBonus: scaledCombat(2),
          basePlayer: state.pactBasePlayerStats
        });
      }
    }
    if (pactChanged) {
      state.pactBasePlayerStats = null;
    }
    state.activePacts = canonicalPacts;
    if (pactChanged && canonicalPacts.length > 0 && state.phase === "playing") {
      capturePactBasePlayerStats();
      if (pactEffectsApi && typeof pactEffectsApi.applySinglePactEffect === "function") {
        pactEffectsApi.applySinglePactEffect(state.player, canonicalPacts[0], {
          critCap: CRIT_CHANCE_CAP,
          minEffectiveDamage: MIN_EFFECTIVE_DAMAGE,
          chainsArmorBonus: scaledCombat(2)
        });
      }
    }
  }

  const state = {`
  ],
  [
`  function buildRoom() {
    if (state.onlineV3Ranked && state.onlineV3Directive) {`,
`  function buildRoom() {
    onlineV3RewardRecorder = state.onlineV3Ranked
      ? window.DungeonRankedV3Recorder?.createRewardClaimRecorder?.() || null
      : null;
    if (state.onlineV3Ranked && state.onlineV3Directive) {`
  ],
  [
`    const reward = grantGold(rewardForEnemy(enemy));
    state.player.adrenaline = clamp(state.player.adrenaline + 1, 0, state.player.maxAdrenaline);`,
`    const reward = grantGold(rewardForEnemy(enemy));
    onlineV3RewardRecorder?.recordEnemy?.({ enemyType: enemy.type, elite: Boolean(enemy.elite) });
    state.player.adrenaline = clamp(state.player.adrenaline + 1, 0, state.player.maxAdrenaline);`
  ],
  [
`      removeEnemy(enemy);
      const reward = grantGold(1);`,
`      removeEnemy(enemy);
      const reward = grantGold(1);
      onlineV3RewardRecorder?.recordHazard?.();`
  ],
  [
`    if (enemy.hp <= 0) {
      const reward = grantGold(1);
      const hazardKill = globalThis.hazardKillApi;`,
`    if (enemy.hp <= 0) {
      const reward = grantGold(1);
      onlineV3RewardRecorder?.recordHazard?.();
      const hazardKill = globalThis.hazardKillApi;`
  ],
  [
`    if (chestOutcome.outcome === "health") {`,
`    if (onlineV3CanonicalChestOutcome && applyRankedCanonicalChestStatOutcome(chestOutcome.outcome, inTreasureRoom)) {
      // Canonical stat outcomes bypass local cap/fallback policy.
    } else if (chestOutcome.outcome === "fallback_gold") {
      const onlineV3FallbackBase = randInt(2, 5);
      const fallbackGold = grantGold(onlineV3FallbackBase);
      onlineV3RewardRecorder?.recordChestFallbackGold?.(onlineV3ActiveChestClaimId, onlineV3FallbackBase);
      pushLog("Chest: fallback gold +" + fallbackGold + ".", "warn");
    } else if (chestOutcome.outcome === "health") {`
  ],
  [
`      // Void Reaper crit kill gold bonus
      if (hasRelic("voidreaper") && critical) {
        const voidGold = grantGold(VOID_REAPER_CRIT_KILL_GOLD);
        pushLog(\`Void Reaper bonus: +\${voidGold} gold.\`, "good");
      }`,
`      // Void Reaper crit kill gold bonus
      if (hasRelic("voidreaper") && critical) {
        const voidGold = grantGold(VOID_REAPER_CRIT_KILL_GOLD);
        if (onlineV3BoundedProcClaims && voidGold > 0) {
          onlineV3RewardRecorder?.recordVoidReaperCritKill?.();
        }
        pushLog(\`Void Reaper bonus: +\${voidGold} gold.\`, "good");
      }`
  ],
  [
`      const chaosGold = grantGold(CHAOS_ORB_GOLD_BONUS, { applyMultiplier: false });
      pushLog(\`Chaos roll [3]: +\${chaosGold} gold.\`, "good");`,
`      const chaosGold = grantGold(CHAOS_ORB_GOLD_BONUS, { applyMultiplier: false });
      if (onlineV3BoundedProcClaims && chaosGold > 0) {
        onlineV3RewardRecorder?.recordChaosOrbGoldRoll?.();
      }
      pushLog(\`Chaos roll [3]: +\${chaosGold} gold.\`, "good");`
  ],
  [
`    chest.opened = true;
    clearVaultChestThreatState(chest);`,
`    chest.opened = true;
    const onlineV3CanonicalChestOutcome = getRankedCanonicalChestOutcome(chest);
    onlineV3ActiveChestClaimId = onlineV3RewardRecorder?.openChest?.(onlineV3CanonicalChestOutcome) || null;
    clearVaultChestThreatState(chest);`
  ],
  [
`    const chestOutcome = lootTablesApi.rollChestOutcome({
      inTreasureRoom,
      hasShrineWard: hasRelic("shrineward"),
      rng: Math.random
    });`,
`    const chestOutcome = onlineV3CanonicalChestOutcome || lootTablesApi.rollChestOutcome({
      inTreasureRoom,
      hasShrineWard: hasRelic("shrineward"),
      rng: Math.random
    });`
  ],
  [
`      let raw = randInt(4, 8);
      if (inTreasureRoom) {
        raw = Math.round(raw * 6);
      }
      raw = Math.max(1, Math.round(raw * getTreasureSenseMultiplier()));
      const scaled = grantGold(raw);`,
`      let raw = randInt(4, 8);
      if (inTreasureRoom) {
        raw = Math.round(raw * 6);
      }
      const onlineV3GoldBase = raw;
      raw = Math.max(1, Math.round(raw * getTreasureSenseMultiplier()));
      const scaled = grantGold(raw);
      onlineV3RewardRecorder?.recordChestGold?.(onlineV3ActiveChestClaimId, onlineV3GoldBase);`
  ],
  [
`    let rawGold = randInt(4, 8);
    if (inTreasureRoom) {
      rawGold = Math.round(rawGold * 6);
    }
    rawGold = Math.max(1, Math.round(rawGold * getTreasureSenseMultiplier()));`,
`    let rawGold = randInt(4, 8);
    if (inTreasureRoom) {
      rawGold = Math.round(rawGold * 6);
    }
    const onlineV3GoldBase = rawGold;
    rawGold = Math.max(1, Math.round(rawGold * getTreasureSenseMultiplier()));
    onlineV3RewardRecorder?.recordChestGold?.(onlineV3ActiveChestClaimId, onlineV3GoldBase);`
  ],
  [
`        const fallbackGold = grantGold(randInt(2, 5));
        pushLog(` + "`Chest: no heal (Alchemist), +${fallbackGold} gold.`" + `);`,
`        const onlineV3FallbackBase = randInt(2, 5);
        const fallbackGold = grantGold(onlineV3FallbackBase);
        onlineV3RewardRecorder?.recordChestFallbackGold?.(onlineV3ActiveChestClaimId, onlineV3FallbackBase);
        pushLog(` + "`Chest: no heal (Alchemist), +${fallbackGold} gold.`" + `);`
  ],
  [
`        const fallbackGold = grantGold(randInt(2, 5));
        pushLog(` + "`Chest: no heal (Alchemist), +${fallbackGold} gold.`" + `);`,
`        const onlineV3FallbackBase = randInt(2, 5);
        const fallbackGold = grantGold(onlineV3FallbackBase);
        onlineV3RewardRecorder?.recordChestFallbackGold?.(onlineV3ActiveChestClaimId, onlineV3FallbackBase);
        pushLog(` + "`Chest: no heal (Alchemist), +${fallbackGold} gold.`" + `);`
  ],
  [
`        const fallbackGold = grantGold(randInt(2, 5));
        pushLog(` + "`Chest: potion sealed by Pact of Avarice, +${fallbackGold} gold.`" + `, "warn");`,
`        const onlineV3FallbackBase = randInt(2, 5);
        const fallbackGold = grantGold(onlineV3FallbackBase);
        onlineV3RewardRecorder?.recordChestFallbackGold?.(onlineV3ActiveChestClaimId, onlineV3FallbackBase);
        pushLog(` + "`Chest: potion sealed by Pact of Avarice, +${fallbackGold} gold.`" + `, "warn");`
  ],
  [
`        const gained = grantPotion(1);
        pushLog(gained > 0 ? "Chest: +" + gained + " potion" + (gained === 1 ? "" : "s") + "." : "Chest: potion bag already full.", "good");`,
`        const gained = grantPotion(1);
        onlineV3RewardRecorder?.recordChestPotion?.(onlineV3ActiveChestClaimId, 1);
        pushLog(gained > 0 ? "Chest: +" + gained + " potion" + (gained === 1 ? "" : "s") + "." : "Chest: potion bag already full.", "good");`
  ],
  [
`      const completions = grantTreasureMapFragment(1);`,
`      const completions = grantTreasureMapFragment(1);
      onlineV3RewardRecorder?.recordChestMapFragment?.(onlineV3ActiveChestClaimId, 1);`
  ],
  [
`    state.player.potions -= 1;
    state.player.autoPotionCooldown = AUTO_POTION_INTERNAL_COOLDOWN_TURNS;`,
`    state.player.potions -= 1;
    onlineV3RewardRecorder?.recordPotionUse?.();
    state.player.autoPotionCooldown = AUTO_POTION_INTERNAL_COOLDOWN_TURNS;`
  ],
  [
`    state.player.potions -= 1;
    state.potionsUsedThisRun = (state.potionsUsedThisRun || 0) + 1;`,
`    state.player.potions -= 1;
    onlineV3RewardRecorder?.recordPotionUse?.();
    state.potionsUsedThisRun = (state.potionsUsedThisRun || 0) + 1;`
  ],
  [
`      state.shieldUsesThisRun = (state.shieldUsesThisRun || 0) + 1;
      syncMutatorUnlocks();`,
`      state.shieldUsesThisRun = (state.shieldUsesThisRun || 0) + 1;
      onlineV3RewardRecorder?.recordShieldUse?.();
      syncMutatorUnlocks();`
  ],
  [
`      revealPortalFx();
      pushLog("Room cleared. Waiting for Online v3 checkpoint.", "good");
      window.DungeonOnlineV3?.onLocalRoomCleared?.({
        turnCount: Math.max(0, Number(state.turn) || 0),
        rewardClaims: []
      });`,
`      revealPortalFx();
      const completionCapability = onlineV3RoomCompletionCapability;
      let rewardClaims = [];
      if (!window.DungeonOnlineV3?.usesBoundarySettlement?.()) {
        const roomClearBase = Math.max(0, Number(
          window.DungeonRankedV3Recorder?.roomClearBaseV08?.(state.depth, state.roomType)
        ) || 0);
        const scaled = grantGold(roomClearBase);
        pushLog("Room clear bonus: +" + scaled + " gold.", "good");
        rewardClaims = onlineV3RewardRecorder?.snapshot() || [];
      }
      onlineV3RoomClearReported = window.DungeonOnlineV3?.usesBoundarySettlement?.() === true;
      window.DungeonOnlineV3?.onLocalRoomCleared?.({
        turnCount: Math.max(
          0,
          Math.floor(Number(state.turn) || 0) - onlineV3RoomStartingTurn
        ),
        rewardClaims,
        reportedGoldDelta: Math.max(
          0,
          Math.floor(Number(state.player.gold) || 0) - onlineV3RoomStartingGold
        ),
        completionCapability
      });`
  ]
];
for (const [sourceText, replacement] of rankedGoldGameReplacements) {
  if (!game.includes(sourceText)) {
    throw new Error(`Missing Ranked gold source: ${sourceText.slice(0, 80)}`);
  }
  game = game.replace(sourceText, replacement);
}
const rankedMerchantGameReplacements = [
  [
`  function runObserverMerchantAction() {
    if (state.phase !== "playing" || state.roomType !== "merchant" || !isOnMerchant()) return false;`,
`  function runObserverMerchantAction() {
    if (state.phase !== "playing" || state.roomType !== "merchant" || !isOnMerchant()) return false;
    if (state.onlineV3Ranked && !state.merchantMenuOpen) {
      openMerchantMenu();
      state.observerBot.lastDecision = "merchant_open";
      return true;
    }
    if (state.onlineV3Ranked && (
      state.turnInProgress ||
      window.DungeonOnlineV3?.isRankedAutomationBlocked?.() ||
      window.DungeonOnlineV3?.isObserverBotBoundaryPending?.()
    )) return false;`
  ],
  [
`  function openMerchantMenu() {
    if (state.debugCheatMerchantActive) return openDebugCheatMerchantMenu();`,
`  function openMerchantMenu() {
    if (state.onlineV3Ranked) {
      window.DungeonOnlineV3?.onMerchantOpen?.();
      return true;
    }
    if (state.debugCheatMerchantActive) return openDebugCheatMerchantMenu();`
  ],
  [
`  function tryBuySkillUpgradeFromMerchant(skillId) {
    return campRuntime.tryBuySkillUpgradeFromMerchant(skillId);
  }`,
`  function tryBuySkillUpgradeFromMerchant(skillId) {
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({ action: "skill_upgrade", skillId }));
    return campRuntime.tryBuySkillUpgradeFromMerchant(skillId);
  }`
  ],
  [
`  function tryBuyPotionFromMerchant() {
    return campRuntime.tryBuyPotionFromMerchant();
  }`,
`  function tryBuyPotionFromMerchant() {
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({ action: "potion" }));
    return campRuntime.tryBuyPotionFromMerchant();
  }`
  ],
  [
`  function tryBuyRelicFromMerchant() {
    return campRuntime.tryBuyRelicFromMerchant();
  }`,
`  function tryBuyRelicFromMerchant() {
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({ action: "relic_purchase", relicId: state.merchantRelicSlot?.relicId || "" }));
    return campRuntime.tryBuyRelicFromMerchant();
  }`
  ],
  [
`  function tryReserveRelicFromMerchant() {
    return campRuntime.tryReserveRelicFromMerchant();
  }`,
`  function tryReserveRelicFromMerchant() {
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({ action: "reserve_relic", relicId: state.merchantRelicSlot?.relicId || "" }));
    return campRuntime.tryReserveRelicFromMerchant();
  }`
  ],
  [
`  function tryBuyReservedRelicFromMerchant() {
    return campRuntime.tryBuyReservedRelicFromMerchant();
  }`,
`  function tryBuyReservedRelicFromMerchant() {
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({ action: "claim_reserved", relicId: state.merchantReservedRelic?.relicId || "" }));
    return campRuntime.tryBuyReservedRelicFromMerchant();
  }`
  ],
  [
`  function tryDiscardReservedRelicFromMerchant() {
    return campRuntime.tryDiscardReservedRelicFromMerchant();
  }`,
`  function tryDiscardReservedRelicFromMerchant() {
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({ action: "discard_reserved", relicId: state.merchantReservedRelic?.relicId || "" }));
    return campRuntime.tryDiscardReservedRelicFromMerchant();
  }`
  ],
  [
`  function resolveMerchantLegendarySwap(acceptIncoming) {
    return campRuntime.resolveMerchantLegendarySwap(acceptIncoming);
  }`,
`  function resolveMerchantLegendarySwap(acceptIncoming) {
    if (state.onlineV3Ranked) {
      const pending = state.merchantLegendarySwapPending;
      if (!pending) return false;
      state.merchantLegendarySwapPending = null;
      if (!acceptIncoming) {
        markUiDirty();
        return true;
      }
      return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({
        action: pending.source === "reserved" ? "claim_reserved" : "relic_purchase",
        relicId: pending.relicId || "",
        removalRelicId: pending.currentLegendaryId || ""
      }));
    }
    return campRuntime.resolveMerchantLegendarySwap(acceptIncoming);
  }`
  ],
  [
`  function tryBuyFullHeal() {
    return campRuntime.tryBuyFullHeal();
  }`,
`  function tryBuyFullHeal() {
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({ action: "service", serviceId: "fullheal" }));
    return campRuntime.tryBuyFullHeal();
  }`
  ],
  [
`  function tryBuyCombatBoost() {
    return campRuntime.tryBuyCombatBoost();
  }`,
`  function tryBuyCombatBoost() {
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({ action: "service", serviceId: "combatboost" }));
    return campRuntime.tryBuyCombatBoost();
  }`
  ],
  [
`  function tryBuyOneLife() {
    return campRuntime.tryBuyOneLife();
  }`,
`  function tryBuyOneLife() {
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({ action: "service", serviceId: "onelife" }));
    return campRuntime.tryBuyOneLife();
  }`
  ],
  [
`  function tryBuySecondChance() {
    return campRuntime.tryBuySecondChance();
  }`,
`  function tryBuySecondChance() {
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({ action: "service", serviceId: "secondchance" }));
    return campRuntime.tryBuySecondChance();
  }`
  ],
  [
`  function tryUseBlackMarket(relicId) {
    return campRuntime.tryUseBlackMarket(relicId);
  }`,
`  function tryUseBlackMarket(relicId) {
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({ action: "black_market", relicId }));
    return campRuntime.tryUseBlackMarket(relicId);
  }`
  ],
  [
`  function tryMerchantRelicSwap(idx) {
    return campRuntime.tryBuyRelicSwap(idx);
  }`,
`  function tryMerchantRelicSwap(idx) {
    if (state.onlineV3Ranked) {
      const pending = state.merchantRelicSwapPending;
      const removalRelicId = state.relics[idx] || "";
      state.merchantRelicSwapPending = null;
      return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({
        action: pending?.source === "reserved" ? "claim_reserved" : "relic_purchase",
        relicId: pending?.relicId || "",
        removalRelicId
      }));
    }
    return campRuntime.tryBuyRelicSwap(idx);
  }`
  ],
  [
`  function trySellRelicToMerchant(relicId) {
    return campRuntime.trySellRelicToMerchant(relicId);
  }`,
`  function trySellRelicToMerchant(relicId) {
    if (state.onlineV3Ranked) return Boolean(window.DungeonOnlineV3?.onMerchantAction?.({ action: "buyback", relicId }));
    return campRuntime.trySellRelicToMerchant(relicId);
  }`
  ],
  [
`    enterNextDirective() {
      if (!state.onlineV3Ranked || !state.onlineV3NextDirective) return false;
      state.onlineV3Directive = state.onlineV3NextDirective;
      state.onlineV3NextDirective = null;
      buildRoom();
      window.DungeonOnlineV3?.onRoomEntered?.(state.onlineV3Directive);
      return true;
    },`,
`    enterNextDirective() {
      if (!state.onlineV3Ranked || !state.onlineV3NextDirective) return false;
      state.onlineV3Directive = state.onlineV3NextDirective;
      state.onlineV3NextDirective = null;
      playSfx("portal");
      buildRoom();
      pushLog("Canonical portal entered.", "good");
      markUiDirty();
      window.DungeonOnlineV3?.onRoomEntered?.(state.onlineV3Directive);
      return true;
    },`
  ]
];
for (const [sourceText, replacement] of rankedMerchantGameReplacements) {
  if (!game.includes(sourceText)) throw new Error(`Missing Ranked Merchant source: ${sourceText.slice(0, 80)}`);
  game = game.replace(sourceText, replacement);
}

const rankedObserverPactStart = game.indexOf("  function runObserverBotPlayingAction() {");
const rankedObserverPactEnd = game.indexOf("  function chooseObserverBotCampStartDepth()", rankedObserverPactStart);
if (rankedObserverPactStart < 0 || rankedObserverPactEnd <= rankedObserverPactStart) {
  throw new Error("Missing Ranked Observer Bot playing action boundaries.");
}
let rankedObserverPactSource = game.slice(rankedObserverPactStart, rankedObserverPactEnd);
const rankedPactPhaseSource = `  function runObserverBotPlayingAction() {
    if (state.phase !== "playing") return false;`;
const rankedPactPhaseReplacement = `  function runObserverBotPlayingAction() {
    if (state.phase !== "playing") return false;
    const rankedPactRoom = Boolean(
      state.onlineV3Ranked && state.roomType === "pact" && state.roomCleared
    );`;
if (!rankedObserverPactSource.includes(rankedPactPhaseSource)) {
  throw new Error("Missing Ranked Observer Bot Pact phase source.");
}
rankedObserverPactSource = rankedObserverPactSource.replace(
  rankedPactPhaseSource,
  rankedPactPhaseReplacement
);
if (!rankedObserverPactSource.includes("      if (isOnPact()) {")) {
  throw new Error("Missing Ranked Observer Bot Pact altar source.");
}
rankedObserverPactSource = rankedObserverPactSource.replace(
  "      if (isOnPact()) {",
  "      if (!rankedPactRoom && isOnPact()) {"
);
if (!rankedObserverPactSource.includes("      if (state.pact && !state.pact.used) {")) {
  throw new Error("Missing Ranked Observer Bot Pact routing source.");
}
rankedObserverPactSource = rankedObserverPactSource.replace(
  "      if (state.pact && !state.pact.used) {",
  "      if (!rankedPactRoom && state.pact && !state.pact.used) {"
);
game = `${game.slice(0, rankedObserverPactStart)}${rankedObserverPactSource}${game.slice(rankedObserverPactEnd)}`;

const rankedMerchantBridgeMarker = `    enterRankedCamp(profile, offer) {`;
const rankedMerchantBridge = `    beginRankedMerchantRequest() {
      if (!state.onlineV3Ranked) return;
      state.turnInProgress = true;
      markUiDirty();
    },
    failRankedMerchantRequest(message = "Merchant connection failed. Press E to try again.") {
      if (!state.onlineV3Ranked) return;
      state.turnInProgress = false;
      pushLog(String(message || "Merchant connection failed. Press E to try again."), "bad");
      markUiDirty();
    },
    beginRankedMerchantReplacement(pending = {}) {
      if (!state.onlineV3Ranked) return;
      state.turnInProgress = false;
      const incoming = getRelicById(pending.relicId);
      const removals = Array.isArray(pending.removalRelicIds)
        ? [...new Set(pending.removalRelicIds.filter((relicId) => typeof relicId === "string" && relicId))]
        : [];
      const uniqueSwap = incoming && ["legendary", "mythic"].includes(incoming.rarity) && removals.length === 1;
      if (uniqueSwap) {
        state.merchantLegendarySwapPending = {
          source: pending.source === "reserved" ? "reserved" : "offer",
          relicId: pending.relicId,
          price: Math.max(0, Number(pending.price) || 0),
          currentLegendaryId: removals[0]
        };
        state.merchantRelicSwapPending = null;
      } else {
        state.merchantRelicSwapPending = {
          source: pending.source === "reserved" ? "reserved" : "offer",
          relicId: pending.relicId,
          price: Math.max(0, Number(pending.price) || 0),
          allowedRemovalRelicIds: removals
        };
        state.merchantLegendarySwapPending = null;
      }
      markUiDirty();
    },
    enterRankedMerchant(publicState, offer, request = {}) {
      if (!state.onlineV3Ranked || state.roomType !== "merchant" || !isOnMerchant()) return;
      const build = publicState?.build || {};
      const resources = build.resources || {};
      const merchant = build.merchant || {};
      const action = String(request.action || "");
      state.turnInProgress = false;
      state.player.gold = Math.max(0, Number(publicState?.gold) || 0);
      state.campGold = Math.max(0, Number(publicState?.campGold) || 0);
      state.lives = Math.max(0, Number(publicState?.lives) || 0);
      state.skillTiers = sanitizeSkillTiers(build.skillTiers || {});
      state.relics = (Array.isArray(build.relics) ? build.relics : []).flatMap((relic) =>
        Array.from({ length: Math.max(1, Number(relic.stacks) || 1) }, () => String(relic.relicId || relic.id || ""))
      ).filter(Boolean);
      normalizeRelicInventory();
      state.merchantPotionsBought = Math.max(0, Number(merchant.potionsBought) || 0);
      state.merchantSecondChancePurchases = Math.max(0, Number(merchant.secondChancePurchases) || 0);
      state.merchantReservedRelic = sanitizeMerchantReservedRelic(merchant.reservedRelic);
      state.merchantSlotsInitialized = true;
      syncRankedCanonicalPotionState(publicState);
      if (action === "service" && request.serviceId === "fullheal") {
        state.player.maxHp = Math.max(1, Number(resources.maxHp) || state.player.maxHp);
        state.player.hp = Math.max(1, Math.min(state.player.maxHp, Number(resources.hp) || state.player.maxHp));
      }
      if (action === "service" && request.serviceId === "secondchance") state.player.hasSecondChance = Boolean(resources.hasSecondChance);
      if (action === "service" && request.serviceId === "combatboost") {
        const previousAttack = Math.max(0, Number(state.onlineV3MerchantBoostAttack) || 0);
        const previousArmor = Math.max(0, Number(state.onlineV3MerchantBoostArmor) || 0);
        const nextAttack = Math.max(0, Number(resources.combatBoostAttack) || 0);
        const nextArmor = Math.max(0, Number(resources.combatBoostArmor) || 0);
        state.player.attack = Math.max(MIN_EFFECTIVE_DAMAGE, state.player.attack - previousAttack + nextAttack);
        state.player.armor = Math.max(0, state.player.armor - previousArmor + nextArmor);
        state.player.combatBoostTurns = Math.max(0, Number(resources.combatBoostTurns) || 0);
        state.onlineV3MerchantBoostAttack = nextAttack;
        state.onlineV3MerchantBoostArmor = nextArmor;
      }
      const choices = Array.isArray(offer?.choices) ? offer.choices : [];
      const available = choices.filter((choice) => choice?.status === "available");
      const liveRelic = state.merchantReservedRelic ? null : available.find((choice) =>
        ["merchant_relic_purchase", "merchant_relic_replacement", "merchant_relic_reserve"].includes(choice.kind) && choice.relicId
      );
      state.merchantRelicSlot = liveRelic
        ? sanitizeMerchantRelicSlot({ relicId: liveRelic.relicId, price: liveRelic.totalPrice || liveRelic.price, offerTag: "" })
        : null;
      const service = available.find((choice) => choice.kind === "merchant_service");
      state.merchantServiceSlot = sanitizeMerchantServiceSlot(
        service?.serviceId || (available.some((choice) => choice.kind === "merchant_black_market") ? "blackmarket" : "")
      );
      state.merchantRelicSwapPending = null;
      state.merchantLegendarySwapPending = null;
      state.merchantBuybackPending = null;
      state.blackMarketPending = null;
      state.merchantMenuOpen = true;
      markUiDirty();
    },
    enterRankedCamp(profile, offer) {`;
if (!game.includes(rankedMerchantBridgeMarker)) throw new Error("Missing Ranked Merchant bridge marker.");
game = game.replace(rankedMerchantBridgeMarker, rankedMerchantBridge);

const rankedForgeBridgeMarker = `    enterRankedCamp(profile, offer) {`;
const rankedForgeBridge = `    enterRankedRelicReplacement(publicState, replacement, choices = []) {
      if (!state.onlineV3Ranked) return false;
      const incomingRelicId = String(replacement?.incoming?.relicId || "");
      const incoming = getRelicById(incomingRelicId);
      const mappedChoices = (Array.isArray(choices) ? choices : [])
        .map((choice) => ({
          replacementChoiceId: String(choice?.replacementChoiceId || choice?.choiceId || ""),
          removalRelicIds: (Array.isArray(choice?.removalRelicIds)
            ? choice.removalRelicIds
            : []
          ).map((relicId) => String(relicId || "")).filter(Boolean)
        }))
        .filter((choice) => choice.replacementChoiceId && choice.removalRelicIds.length > 0);
      if (!incoming || !mappedChoices.length) return false;
      const buildRelics = Array.isArray(publicState?.build?.relics)
        ? publicState.build.relics
        : [];
      state.relics = buildRelics.flatMap((relic) =>
        Array.from(
          { length: Math.max(1, Number(relic?.stacks) || 1) },
          () => String(relic?.relicId || relic?.id || "")
        )
      ).filter(Boolean);
      normalizeRelicInventory();
      state.turnInProgress = false;
      state.onlineV3RelicReplacementPresentation = {
        transactionId: String(replacement?.transactionId || ""),
        incomingRelicId,
        cancelAllowed: replacement?.cancelAllowed === true,
        choices: mappedChoices
      };
      state.legendarySwapPending = null;
      state.relicSwapPending = incomingRelicId;
      state.relicSwapAdditionalDiscards = 0;
      state.relicDraft = [incoming];
      state.startingRelicDraft = false;
      state.phase = "relic";
      syncBgmWithState();
      pushLog("Inventory full. Choose a carried relic to replace with " + incoming.name + ".", "warn");
      markUiDirty();
      return true;
    },
    beginRankedRelicReplacementCommit() {
      if (!state.onlineV3Ranked || !state.onlineV3RelicReplacementPresentation) return;
      state.turnInProgress = true;
      markUiDirty();
    },
    failRankedRelicReplacement(message = "Relic replacement failed. Try again.") {
      if (!state.onlineV3Ranked || !state.onlineV3RelicReplacementPresentation) return;
      state.turnInProgress = false;
      pushLog(String(message || "Relic replacement failed. Try again."), "bad");
      markUiDirty();
    },
    completeRankedRelicReplacement(publicState) {
      if (!state.onlineV3Ranked) return;
      state.turnInProgress = false;
      state.onlineV3RelicReplacementPresentation = null;
      state.legendarySwapPending = null;
      state.relicSwapPending = null;
      state.relicSwapAdditionalDiscards = 0;
      state.relicDraft = null;
      state.phase = "playing";
      syncBgmWithState();
      pushLog("Canonical relic replacement resolved.", "good");
      markUiDirty();
    },
    beginRankedForgeRequest() {
      if (!state.onlineV3Ranked) return;
      state.turnInProgress = true;
      markUiDirty();
    },
    failRankedForgeRequest(message = "Forge connection failed. Try the choice again.") {
      if (!state.onlineV3Ranked) return;
      state.turnInProgress = false;
      if (!state.onlineV3ForgePresentation && state.phase === "playing" && state.forge) {
        state.forge.used = false;
        state.forgePrompt = { step: "mode" };
      }
      pushLog(String(message || "Forge connection failed. Try the choice again."), "bad");
      markUiDirty();
    },
    enterRankedForge(publicState, offer, context = {}) {
      if (!state.onlineV3Ranked || state.roomType !== "forge") return false;
      const available = Array.isArray(offer?.choices)
        ? offer.choices.filter((choice) => choice?.status === "available")
        : [];
      const sourceId = String(offer?.sourceId || "");
      const mode = ["temper", "transmute"].includes(String(context.mode || ""))
        ? String(context.mode)
        : sourceId.includes("transmute") ? "transmute" : "temper";
      const sacrificeRelicId = mode === "transmute" ? String(context.sacrificeRelicId || "") : "";
      const rewardGroups = new Map();
      let leaveChoiceId = "";
      for (const choice of available) {
        const data = choice.publicData && typeof choice.publicData === "object"
          ? choice.publicData
          : choice;
        if (data.action === "leave") {
          leaveChoiceId = String(choice.choiceId || leaveChoiceId);
          continue;
        }
        if (mode === "temper" && data.action !== "temper") continue;
        if (mode === "transmute") {
          if (data.action !== "transmute") continue;
          if (sacrificeRelicId && String(data.sacrificeRelicId || "") !== sacrificeRelicId) continue;
        }
        const relicId = String(mode === "transmute" ? data.resultRelicId : data.relicId);
        const relic = getRelicById(relicId);
        if (!relic) continue;
        if (!rewardGroups.has(relicId)) {
          rewardGroups.set(relicId, {
            relicId,
            relic,
            directChoiceId: "",
            replacementChoices: []
          });
        }
        const group = rewardGroups.get(relicId);
        const removalRelicIds = (Array.isArray(data.removals) ? data.removals : [])
          .map((entry) => String(entry?.relicId || ""))
          .filter(Boolean);
        if (data.replacement === true || removalRelicIds.length > 0) {
          group.replacementChoices.push({
            choiceId: String(choice.choiceId || ""),
            removalRelicIds
          });
        } else {
          group.directChoiceId = String(choice.choiceId || "");
        }
      }
      const rewardChoices = Array.from(rewardGroups.values());
      if (!rewardChoices.length || !leaveChoiceId) return false;
      state.turnInProgress = false;
      state.onlineV3ForgePresentation = {
        mode,
        sacrificeRelicId,
        leaveChoiceId,
        pendingRewardIndex: -1,
        rewardChoices: rewardChoices.map((choice) => ({
          relicId: choice.relicId,
          directChoiceId: choice.directChoiceId,
          replacementChoices: choice.replacementChoices
        }))
      };
      state.forge.used = true;
      state.forgePrompt = null;
      state.forgeRewardMode = mode;
      state.forgeTransmutePending = mode === "transmute" ? { sacrificedRelicId: sacrificeRelicId } : null;
      state.legendarySwapPending = null;
      state.relicSwapPending = null;
      state.relicSwapAdditionalDiscards = 0;
      state.relicDraft = rewardChoices.map((choice) => choice.relic);
      state.startingRelicDraft = false;
      state.phase = "relic";
      syncBgmWithState();
      pushLog(mode === "temper"
        ? "Forge Temper: take the forged relic or leave it."
        : "Forge Transmute: choose one replacement or keep the sacrificed relic.", "good");
      markUiDirty();
      return true;
    },
    completeRankedForge(publicState, context = {}) {
      if (!state.onlineV3Ranked) return;
      const mode = String(context.mode || state.onlineV3ForgePresentation?.mode || "forge");
      state.turnInProgress = false;
      state.onlineV3ForgePresentation = null;
      state.forgePrompt = null;
      state.forgeRewardMode = "";
      state.forgeTransmutePending = null;
      state.legendarySwapPending = null;
      state.relicSwapPending = null;
      state.relicSwapAdditionalDiscards = 0;
      state.relicDraft = null;
      state.startingRelicDraft = false;
      state.phase = "playing";
      syncBgmWithState();
      pushLog(mode === "transmute" ? "Forge Transmute complete." : "Forge Temper complete.", "good");
      markUiDirty();
    },
    enterRankedCamp(profile, offer) {`;
if (!game.includes(rankedForgeBridgeMarker)) throw new Error("Missing Ranked Forge bridge marker.");
game = game.replace(rankedForgeBridgeMarker, rankedForgeBridge);
const rankedRelicReplacementCancelSource = `  function cancelRelicSwapPendingKeepCurrent() {
    if (state.phase !== "relic") return false;`;
const rankedRelicReplacementCancel = `  function cancelRelicSwapPendingKeepCurrent() {
    if (state.phase !== "relic") return false;
    if (state.onlineV3Ranked && state.onlineV3RelicReplacementPresentation) {
      if (!state.onlineV3RelicReplacementPresentation.cancelAllowed) {
        pushLog("This incoming relic cannot be declined.", "warn");
        return true;
      }
      const accepted = window.DungeonOnlineV3?.onRelicReplacementCancel?.();
      if (accepted) {
        state.turnInProgress = true;
        markUiDirty();
      }
      return true;
    }`;
if (!game.includes(rankedRelicReplacementCancelSource)) {
  throw new Error("Missing Ranked relic replacement cancel source.");
}
game = game.replace(rankedRelicReplacementCancelSource, rankedRelicReplacementCancel);
const rankedSetNextMarker = `    setNextDirective(directive) {
      state.onlineV3NextDirective = directive;`;
if (!game.includes(rankedSetNextMarker)) throw new Error("Missing Ranked setNextDirective marker.");
game = game.replace(rankedSetNextMarker, `    setNextDirective(directive) {
      state.turnInProgress = false;
      state.onlineV3NextDirective = directive;`);

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

if (target === "test") {
  await writeFile(
    path.join(output, "QA_ONLY_BUILD.txt"),
    "QA-only instrumented build. Never deploy this directory.\n",
    "utf8"
  );
}

if (visualApproval) {
  await writeFile(
    path.join(output, RELEASE_RECEIPT_FILE),
    `${JSON.stringify(sanitizedReleaseReceipt(visualApproval), null, 2)}\n`,
    "utf8"
  );
}

console.log(`Online v3 ${target} Pages bundle ready: ${await countFiles(output)} files`);
