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
