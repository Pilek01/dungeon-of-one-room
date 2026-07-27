import { MAX_REQUEST_BYTES } from "../config.js";
import { decodeLeaderboardCursor } from "../domain/leaderboard-cursor.js";
import { HttpError } from "./errors.js";

const decoder = new TextDecoder();

export async function readJsonRequest(request, maximumBytes = MAX_REQUEST_BYTES) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected application/json.");
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maximumBytes) {
    throw new HttpError(413, "REQUEST_TOO_LARGE", "Request body exceeds the limit.");
  }
  if (!request.body) throw new HttpError(400, "INVALID_JSON", "Request body is required.");

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new HttpError(413, "REQUEST_TOO_LARGE", "Request body exceeds the limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(decoder.decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("Body must be an object.");
    }
    return parsed;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }
}

export function requireIdempotencyKey(request) {
  const value = String(request.headers.get("Idempotency-Key") || "");
  if (!/^[A-Za-z0-9._:-]{8,128}$/u.test(value)) {
    throw new HttpError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key must contain 8-128 safe characters."
    );
  }
  return value;
}

export function requireString(value, field, options = {}) {
  const text = String(value ?? "").trim();
  const minimum = options.minimum ?? 1;
  const maximum = options.maximum ?? 128;
  if (text.length < minimum || text.length > maximum) {
    throw new HttpError(400, "INVALID_REQUEST", `${field} is invalid.`);
  }
  if (options.pattern && !options.pattern.test(text)) {
    throw new HttpError(400, "INVALID_REQUEST", `${field} is invalid.`);
  }
  return text;
}

export function parseLeaderboardQuery(url) {
  const season = requireString(url.searchParams.get("season"), "season", {
    maximum: 64,
    pattern: /^[A-Za-z0-9._:-]+$/u
  });
  const rawLimit = Number(url.searchParams.get("limit") || 20);
  const limit = Number.isSafeInteger(rawLimit) ? rawLimit : 20;
  const cursor = String(url.searchParams.get("cursor") || "");
  if (cursor) {
    try {
      decodeLeaderboardCursor(cursor);
    } catch {
      throw new HttpError(
        400,
        "LEADERBOARD_CURSOR_INVALID",
        "Leaderboard cursor is malformed or unsupported."
      );
    }
  }
  return {
    season,
    limit,
    cursor
  };
}
