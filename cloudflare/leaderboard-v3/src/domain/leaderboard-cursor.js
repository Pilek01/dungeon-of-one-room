export const LEADERBOARD_CURSOR_POLICY = Object.freeze({
  version: 1,
  integrity: "client_controlled_public_seek",
  malformedBehavior: "http_400",
  ordering: "score_desc_created_at_asc_run_id_asc"
});
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
  return btoa(JSON.stringify({ version: 1, ...value }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function decodeLeaderboardCursor(value) {
  if (!value) return null;
  try {
    if (typeof value !== "string" || value.length > 512 || !/^[A-Za-z0-9_-]+$/u.test(value)) {
      throw new TypeError("LEADERBOARD_CURSOR_INVALID");
    }
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const decoded = JSON.parse(atob(
      value.replaceAll("-", "+").replaceAll("_", "/") + padding
    ));
    if (
      !decoded ||
      typeof decoded !== "object" ||
      Array.isArray(decoded) ||
      Object.keys(decoded).sort().join(",") !== "createdAt,runId,score,version" ||
      decoded.version !== 1 ||
      !Number.isSafeInteger(decoded.score) ||
      decoded.score < 0 ||
      !Number.isSafeInteger(decoded.createdAt) ||
      decoded.createdAt < 0 ||
      typeof decoded.runId !== "string" ||
      !/^run_[a-f0-9]+$/u.test(decoded.runId)
    ) {
      throw new TypeError("LEADERBOARD_CURSOR_INVALID");
    }
    return {
      score: decoded.score,
      createdAt: decoded.createdAt,
      runId: decoded.runId
    };
  } catch {
    throw new TypeError("LEADERBOARD_CURSOR_INVALID");
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
