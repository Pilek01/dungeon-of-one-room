import path from "node:path";

export const MULTI_BOT_COUNT = 8;

export function assignedStartingRelicIndex(botIndex, choiceCount) {
  const normalizedBotIndex = Number(botIndex);
  const normalizedChoiceCount = Number(choiceCount);
  if (
    !Number.isSafeInteger(normalizedBotIndex) || normalizedBotIndex < 1 ||
    !Number.isSafeInteger(normalizedChoiceCount) || normalizedChoiceCount < 1
  ) {
    throw new TypeError("Starting relic assignment requires positive integer bot and choice counts.");
  }
  return (normalizedBotIndex - 1) % normalizedChoiceCount;
}

export function assertOwnedSessionChild(sessionRoot, candidate) {
  const root = path.resolve(sessionRoot);
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new TypeError("Path is outside the owned multi-bot session.");
  }
  return resolved;
}

function ownedChild(root, ...segments) {
  return assertOwnedSessionChild(root, path.resolve(root, ...segments));
}

export function createMultiBotSessionPaths(repoRoot, sessionId) {
  if (!/^[0-9A-Za-z_-]{8,80}$/u.test(String(sessionId || ""))) {
    throw new TypeError("A safe multi-bot session ID is required.");
  }
  const outputRoot = path.resolve(repoRoot, "output", "multi-bot-runs");
  const sessionRoot = ownedChild(outputRoot, sessionId);
  return Object.freeze({
    outputRoot,
    sessionRoot,
    manifestPath: ownedChild(sessionRoot, "manifest.json"),
    workerLogPath: ownedChild(sessionRoot, "worker.log"),
    profilesRoot: ownedChild(sessionRoot, "profiles")
  });
}

export function createBotDescriptors(sessionRoot) {
  return Object.freeze(Array.from({ length: MULTI_BOT_COUNT }, (_, offset) => {
    const index = offset + 1;
    const id = `bot-${String(index).padStart(2, "0")}`;
    return Object.freeze({
      id,
      index,
      name: `bot ${index}`,
      profileDir: ownedChild(sessionRoot, "profiles", id),
      artifactDir: ownedChild(sessionRoot, id)
    });
  }));
}

export function calculatePortraitTiles(bounds, count = MULTI_BOT_COUNT) {
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  if (![x, y, width, height].every(Number.isInteger) || width < 800 || height <= width || count !== 8) {
    throw new TypeError("Eight-bot mode requires an integer portrait monitor working area.");
  }
  const widths = [Math.floor(width / 2), width - Math.floor(width / 2)];
  const baseHeight = Math.floor(height / 4);
  const heights = [baseHeight, baseHeight, baseHeight, height - (baseHeight * 3)];
  const result = [];
  let top = y;
  for (const rowHeight of heights) {
    let left = x;
    for (const columnWidth of widths) {
      result.push(Object.freeze({ x: left, y: top, width: columnWidth, height: rowHeight }));
      left += columnWidth;
    }
    top += rowHeight;
  }
  return Object.freeze(result);
}
