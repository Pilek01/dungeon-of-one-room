function cursorFields(entry) {
  return {
    score: entry?.score,
    createdAt: entry?.createdAt ?? entry?.created_at,
    runId: entry?.runId ?? entry?.run_id
  };
}

export function compareLeaderboardEntries(left, right) {
  const a = cursorFields(left);
  const b = cursorFields(right);
  return (
    b.score - a.score ||
    a.createdAt - b.createdAt ||
    a.runId.localeCompare(b.runId)
  );
}

export function encodeLeaderboardCursor(entry) {
  if (!entry) return null;
  const value = cursorFields(entry);
  return btoa(JSON.stringify(value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function decodeLeaderboardCursor(value) {
  if (!value) return null;
  try {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const decoded = JSON.parse(atob(
      value.replaceAll("-", "+").replaceAll("_", "/") + padding
    ));
    if (
      !Number.isSafeInteger(decoded.score) ||
      decoded.score < 0 ||
      !Number.isSafeInteger(decoded.createdAt) ||
      decoded.createdAt < 0 ||
      typeof decoded.runId !== "string" ||
      !decoded.runId
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function isAfterLeaderboardCursor(entry, cursor) {
  if (!cursor) return true;
  const value = cursorFields(entry);
  return (
    value.score < cursor.score ||
    value.score === cursor.score && value.createdAt > cursor.createdAt ||
    value.score === cursor.score &&
      value.createdAt === cursor.createdAt &&
      value.runId > cursor.runId
  );
}
