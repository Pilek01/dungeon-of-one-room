export function patchObserverBotCampStart(gameSource) {
  const source = String(gameSource);
  const canonicalStart = /^[ \t]*const startDepth = chooseObserverBotCampStartDepth\(\);\r?\n[ \t]*if \(state\.onlineV3Ranked\) \{\r?\n[ \t]*const accepted = window\.DungeonOnlineV3\?\.onCampStartRun\?\.\(startDepth\);/mu;
  if (canonicalStart.test(source)) return source;
  const localStart = /^([ \t]*)const startDepth = chooseObserverBotCampStartDepth\(\);\r?\n\1startRun\(\{ carriedRelics: \[\.\.\.state\.relics\], startDepth \}\);\r?\n\1state\.observerBot\.lastDecision = "camp_start_run";/mu;
  if (!localStart.test(source)) {
    throw new Error("Missing Observer Bot Camp start marker.");
  }
  return source.replace(localStart, (_match, indent) => `${indent}const startDepth = chooseObserverBotCampStartDepth();
${indent}if (state.onlineV3Ranked) {
${indent}  const accepted = window.DungeonOnlineV3?.onCampStartRun?.(startDepth);
${indent}  if (!accepted) return false;
${indent}} else {
${indent}  startRun({ carriedRelics: [...state.relics], startDepth });
${indent}}
${indent}state.observerBot.lastDecision = "camp_start_run";`);
}

export function patchRankedEmergencyExtraction(gameSource) {
  const source = String(gameSource);
  const rankedBranch = /function confirmEmergencyExtract\(\) \{\r?\n\s+if \(!state\.extractConfirm\) return false;\r?\n\s+if \(state\.onlineV3Ranked\) \{/u;
  if (rankedBranch.test(source)) return source;
  const marker = /(function confirmEmergencyExtract\(\) \{\r?\n\s+if \(!state\.extractConfirm\) return false;)/u;
  if (!marker.test(source)) {
    throw new Error("Missing Ranked emergency extraction marker.");
  }
  return source.replace(marker, `$1
    if (state.onlineV3Ranked) {
      state.extractConfirm = null;
      extractRun({ forced: true });
      return true;
    }`);
}

export function patchRankedFatalPendingFreeze(gameSource) {
  let source = String(gameSource);
  const turnGuard = "(state.onlineV3Ranked && state.onlineV3FatalPending)";
  const clearGuard = "if (state.onlineV3Ranked && state.onlineV3FatalPending) return;";
  const botGuard = `if (state.onlineV3Ranked && state.onlineV3FatalPending) {
      state.observerBot.lastDecision = "online_v3_fatal_wait";
      return false;
    }`;

  if (!source.includes(turnGuard)) {
    const inputLock = /(^[ \t]*)function isTurnInputLocked\(\) \{\r?\n([ \t]*)return state\.phase === "playing" && \(state\.turnInProgress \|\| state\.enemyTurnInProgress\);\r?\n\1\}/mu;
    if (!inputLock.test(source)) {
      throw new Error("Missing Ranked fatal-pending input-lock marker.");
    }
    source = source.replace(inputLock, (_match, functionIndent, bodyIndent) => `${functionIndent}function isTurnInputLocked() {
${bodyIndent}return state.phase === "playing" && (
${bodyIndent}  state.turnInProgress ||
${bodyIndent}  state.enemyTurnInProgress ||
${bodyIndent}  ${turnGuard}
${bodyIndent});
${functionIndent}}`);
  }

  const checkRoomClearStart = /(^[ \t]*)function checkRoomClearBonus\(\) \{\r?\n([ \t]*)if \(state\.roomCleared \|\| state\.enemies\.length > 0\) return;/mu;
  if (!source.includes(clearGuard)) {
    if (!checkRoomClearStart.test(source)) {
      throw new Error("Missing Ranked fatal-pending room-clear marker.");
    }
    source = source.replace(checkRoomClearStart, (_match, functionIndent, bodyIndent) => `${functionIndent}function checkRoomClearBonus() {
${bodyIndent}${clearGuard}
${bodyIndent}if (state.roomCleared || state.enemies.length > 0) return;`);
  }

  if (!source.includes(botGuard)) {
    const botStepStart = /(^[ \t]*)function runObserverBotStep\(\) \{\r?\n([ \t]*)if \(!isObserverBotActive\(\)\) return false;/mu;
    if (!botStepStart.test(source)) {
      throw new Error("Missing Ranked fatal-pending Observer Bot marker.");
    }
    source = source.replace(botStepStart, (_match, functionIndent, bodyIndent) => `${functionIndent}function runObserverBotStep() {
${bodyIndent}if (!isObserverBotActive()) return false;
${bodyIndent}${botGuard}`);
  }

  return source;
}

export function patchRankedRoomClearOnce(gameSource) {
  const source = String(gameSource);
  const guardCondition = "state.onlineV3Ranked && onlineV3RoomClearReported";
  if (source.includes(guardCondition)) return source;
  const checkRoomClearStart = /(^[ \t]*)function checkRoomClearBonus\(\) \{\r?\n/mu;
  if (!checkRoomClearStart.test(source)) {
    throw new Error("Missing Ranked one-clear-per-room marker.");
  }
  return source.replace(
    checkRoomClearStart,
    (_match, functionIndent) => `${functionIndent}function checkRoomClearBonus() {
${functionIndent}  if (${guardCondition}) {
${functionIndent}    if (state.enemies.length > 0) return;
${functionIndent}    state.roomCleared = true;
${functionIndent}    markUiDirty();
${functionIndent}    return;
${functionIndent}  }
`
  );
}

export function patchRankedArenaWaveGoldParity(gameSource) {
  let source = String(gameSource);
  const rankedBonus = "roomEnemyRewardBonus = state.onlineV3Ranked ? 2 : 0;";
  if (!source.includes(rankedBonus)) {
    const arenaMarker = /(if \(state\.roomType === "arena"\) \{\r?\n\s+state\.arena = \{ wave: 1, maxWaves: ARENA_WAVE_COUNT, rewardSpawned: false \};)/u;
    if (!arenaMarker.test(source)) {
      throw new Error("Missing Ranked Arena wave gold marker.");
    }
    source = source.replace(
      arenaMarker,
      `$1\n      ${rankedBonus}`
    );
  }

  const rankedEliteCap = `eliteCount < (state.onlineV3Ranked && state.roomType === "arena"
        ? MAX_ELITES_PER_ROOM - 1
        : MAX_ELITES_PER_ROOM)`;
  if (!source.includes(rankedEliteCap)) {
    const eliteCapMarker = /(forceEliteOnly \|\| \(elitesEnabled &&\r?\n\s+)eliteCount < MAX_ELITES_PER_ROOM/u;
    if (!eliteCapMarker.test(source)) {
      throw new Error("Missing Ranked Arena elite reservation marker.");
    }
    source = source.replace(eliteCapMarker, `$1${rankedEliteCap}`);
  }
  return source;
}
