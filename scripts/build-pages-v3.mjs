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
const gameScript = '  <script src="game.js"></script>';
const rewardRecorderScript = '  <script src="online-v3/ranked-v3-recorder.js"></script>';
if (!index.includes(gameScript)) throw new Error("Missing production game script.");
index = index.replace(gameScript, `${rewardRecorderScript}\n${gameScript}`);
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
`      window.DungeonOnlineV3?.onExtraction?.(forced ? "emergency" : "normal");`,
`      window.DungeonOnlineV3?.onExtraction?.(forced && !state.roomCleared ? "emergency" : "normal");`
  ],  [
    "  let bootDismissPromise = null;",
    "  let bootDismissPromise = null;\n  let bootInputLocked = false;"
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
      if (publicState?.status === "defeat") {
        const finalDepth = Math.max(0, Number(publicState?.maxDepth) || getRunMaxDepth());
        const finalGold = Math.max(0, Number(publicState?.gold) || getRunGoldEarned());
        state.player.hp = 0;
        state.finalVictoryPrompt = null;
        state.finalGameOverPrompt = {
          depth: finalDepth,
          gold: finalGold,
          score: calculateScore(finalDepth, finalGold),
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
        stopDeathTrack(true);
        const usedFinalTrack = playFinalGameOverTrack();
        if (!usedFinalTrack && !state.audioMuted) playSfx("death");
        pushLog("GAME OVER. All Ranked lives lost.", "bad");
      }
      markUiDirty();
    },`
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
`    state.relics.splice(safeIndex, 1);
    normalizeRelicInventory();`,
`    if (state.onlineV3Ranked) {
      const accepted = window.DungeonOnlineV3?.onCampAction?.({ action: "relic_sale", relicId });
      if (!accepted) pushLog("That relic sale is not currently available.", "bad");
      state.campRelicSellPendingIndex = -1;
      markUiDirty();
      return accepted;
    }
    state.relics.splice(safeIndex, 1);
    normalizeRelicInventory();`
  ],
  [
`  function openCampStartDepthPrompt() {
    if (state.phase !== "camp") return false;
    if (state.extractRelicPrompt) return false;
    const available = getAvailableStartDepths();`,
`  function openCampStartDepthPrompt() {
    if (state.phase !== "camp") return false;
    if (state.extractRelicPrompt) return false;
    if (state.onlineV3Ranked) {
      return Boolean(window.DungeonOnlineV3?.onCampStartRun?.());
    }
    const available = getAvailableStartDepths();`
  ],
  [
`  function toggleMutator(index) {
    const mutator = MUTATORS[index];
    if (!mutator) return;`,
`  function toggleMutator(index) {
    const mutator = MUTATORS[index];
    if (!mutator) return;
    if (state.onlineV3Ranked && state.phase === "camp") {
      pushLog("Ranked mutators are fixed by the canonical run profile.", "bad");
      return;
    }`
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
    enterRankedCamp(profile, offer) {
      const wasCamp = state.phase === "camp";
      const build = profile?.build || {};
      state.onlineV3Ranked = true;
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
const rankedGoldGameReplacements = [
  [
`  const state = {`,
`  let onlineV3RewardRecorder = null;

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
`    chest.opened = true;
    clearVaultChestThreatState(chest);`,
`    chest.opened = true;
    const onlineV3ChestClaimId = onlineV3RewardRecorder?.openChest?.() || null;
    clearVaultChestThreatState(chest);`
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
      onlineV3RewardRecorder?.recordChestGold?.(onlineV3ChestClaimId, onlineV3GoldBase);`
  ],
  [
`      revealPortalFx();
      pushLog("Room cleared. Waiting for Online v3 checkpoint.", "good");
      window.DungeonOnlineV3?.onLocalRoomCleared?.({
        turnCount: Math.max(0, Number(state.turn) || 0),
        rewardClaims: []
      });`,
`      revealPortalFx();
      const roomClearBase = Math.max(0, Number(
        window.DungeonRankedV3Recorder?.roomClearBaseV08?.(state.depth, state.roomType)
      ) || 0);
      const scaled = grantGold(roomClearBase);
      pushLog("Room clear bonus: +" + scaled + " gold.", "good");
      window.DungeonOnlineV3?.onLocalRoomCleared?.({
        turnCount: Math.max(0, Number(state.turn) || 0),
        rewardClaims: onlineV3RewardRecorder?.snapshot() || []
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
`    if (state.onlineV3Ranked) {
      if (!state.onlineV3NextDirective) {
        pushLog("Online v3 is still resolving the next room.", "warn");
        return;
      }`,
`    if (state.onlineV3Ranked) {
      if (!state.onlineV3NextDirective) {
        if (state.roomType === "merchant") {
          window.DungeonOnlineV3?.onMerchantLeave?.({ enterPortal: true });
          return;
        }
        pushLog("Online v3 is still resolving the next room.", "warn");
        return;
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
      if (action === "potion") state.player.potions = Math.max(0, Number(resources.potions) || 0);
      state.player.maxPotions = Math.max(1, Number(resources.maxPotions) || state.player.maxPotions);
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

console.log(`Online v3 Pages bundle ready: ${await countFiles(output)} files`);
