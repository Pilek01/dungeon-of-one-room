import {
  mkdir as fsMkdir,
  readFile as fsReadFile,
  readdir as fsReaddir,
  rename as fsRename,
  stat as fsStat,
  writeFile as fsWriteFile
} from "node:fs/promises";
import path from "node:path";

import { assertOwnedSessionChild } from "./local-ranked-multi-bot-domain.mjs";

export const BOT_RESULT_SCHEMA_VERSION = 1;

const BOT_ID_PATTERN = /^bot-0[1-8]$/u;
const SESSION_ID_PATTERN = /^[0-9A-Za-z_-]{8,80}$/u;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const STATUSES = new Set(["starting", "running", "completed", "failed", "blocked", "stopped"]);
const TERMINAL_STATUSES = new Set(["completed", "failed", "blocked", "stopped"]);
const MAX_LEADERBOARD_RECORDS = 5_000;
const MAX_RESULT_BYTES = 256 * 1024;

function validTimestamp(value) {
  return Number.isFinite(Date.parse(value)) ? String(value) : null;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function nonEmptyString(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function maxMetric(previous, candidate) {
  const prior = nonNegativeInteger(previous) ?? 0;
  const next = nonNegativeInteger(candidate);
  return next === null ? prior : Math.max(prior, next);
}

function latestMetric(previous, candidate) {
  const next = nonNegativeInteger(candidate);
  return next === null ? nonNegativeInteger(previous) ?? 0 : next;
}

function normalizeStartingRelic(value) {
  const relicId = nonEmptyString(value?.relicId || value?.id);
  if (!relicId) return null;
  return Object.freeze({
    relicId,
    name: nonEmptyString(value?.name) || relicId
  });
}

export function normalizeRelics(value, names = {}) {
  if (!Array.isArray(value)) return Object.freeze([]);
  const grouped = new Map();
  for (const candidate of value) {
    const relicId = nonEmptyString(candidate?.relicId || candidate?.id);
    if (!relicId) continue;
    const stacks = Math.max(1, nonNegativeInteger(candidate?.stacks) ?? 1);
    const existing = grouped.get(relicId);
    if (existing) {
      existing.stacks = Math.min(Number.MAX_SAFE_INTEGER, existing.stacks + stacks);
      continue;
    }
    grouped.set(relicId, {
      relicId,
      name: nonEmptyString(candidate?.name || names?.[relicId]) || relicId,
      stacks
    });
  }
  return Object.freeze([...grouped.values()].map((relic) => Object.freeze(relic)));
}

function buildLabel(status) {
  if (status === "completed") return "final_last_life";
  if (TERMINAL_STATUSES.has(status)) return "last_observed";
  return "live";
}

export function mergeBotResult(previous, update = {}) {
  const prior = previous && typeof previous === "object" ? previous : {};
  const sample = update.sample && typeof update.sample === "object" ? update.sample : {};
  const publicState = sample.snapshot?.publicState && typeof sample.snapshot.publicState === "object"
    ? sample.snapshot.publicState
    : {};
  const game = sample.game && typeof sample.game === "object" ? sample.game : {};
  const observer = sample.observer && typeof sample.observer === "object" ? sample.observer : {};
  const statusCandidate = nonEmptyString(update.status) || nonEmptyString(prior.status) || "starting";
  const status = STATUSES.has(statusCandidate) ? statusCandidate : "starting";
  const updatedAt = validTimestamp(update.updatedAt) || new Date().toISOString();
  const startedAt = validTimestamp(prior.startedAt) || validTimestamp(update.startedAt) || updatedAt;
  const previousStartingRelic = normalizeStartingRelic(prior.startingRelic);
  const startingRelic = previousStartingRelic || normalizeStartingRelic(update.startingRelic);
  const canonicalRelics = publicState.build && Array.isArray(publicState.build.relics)
    ? normalizeRelics(publicState.build.relics, sample.relicNames)
    : null;
  const relics = canonicalRelics && canonicalRelics.length > 0
    ? canonicalRelics
    : normalizeRelics(prior.relics);
  const lastDecision = nonEmptyString(observer.lastDecision) ||
    nonEmptyString(update.lastDecision) ||
    nonEmptyString(prior.lastDecision) ||
    "";
  const error = nonEmptyString(update.error) || nonEmptyString(prior.error) || "";
  const finishedAt = TERMINAL_STATUSES.has(status)
    ? validTimestamp(update.finishedAt) || validTimestamp(prior.finishedAt) || updatedAt
    : null;

  return Object.freeze({
    schemaVersion: BOT_RESULT_SCHEMA_VERSION,
    sessionId: nonEmptyString(prior.sessionId) || nonEmptyString(update.sessionId) || "",
    botId: nonEmptyString(prior.botId) || nonEmptyString(update.botId) || "",
    botName: nonEmptyString(prior.botName) || nonEmptyString(update.botName) || "",
    commit: nonEmptyString(prior.commit) || nonEmptyString(update.commit) || "",
    startedAt,
    updatedAt,
    finishedAt,
    status,
    error,
    depth: latestMetric(prior.depth, game.depth),
    depthHighscore: maxMetric(
      prior.depthHighscore,
      publicState.mutatorProgress?.depthHighscore
    ),
    score: maxMetric(prior.score, publicState.score?.score ?? game.score),
    lives: latestMetric(prior.lives, publicState.lives),
    currentGold: latestMetric(prior.currentGold, publicState.gold),
    totalGoldEarned: maxMetric(
      prior.totalGoldEarned,
      publicState.score?.inputs?.acceptedRunGoldEarned
    ),
    hp: latestMetric(prior.hp, game.player?.hp ?? game.hp),
    lastDecision,
    startingRelic,
    relics,
    buildLabel: buildLabel(status)
  });
}

export function botResultPath(sessionRoot, botId) {
  const normalizedBotId = String(botId || "");
  if (!BOT_ID_PATTERN.test(normalizedBotId)) {
    throw new TypeError("A bot result path requires bot-01 through bot-08.");
  }
  return assertOwnedSessionChild(
    sessionRoot,
    path.join(path.resolve(sessionRoot), normalizedBotId, "bot-result.json")
  );
}

function validResult(value) {
  if (!value || typeof value !== "object" || value.schemaVersion !== BOT_RESULT_SCHEMA_VERSION) return false;
  if (!SESSION_ID_PATTERN.test(String(value.sessionId || ""))) return false;
  if (!BOT_ID_PATTERN.test(String(value.botId || ""))) return false;
  if (!COMMIT_PATTERN.test(String(value.commit || ""))) return false;
  if (!STATUSES.has(String(value.status || ""))) return false;
  if (!validTimestamp(value.updatedAt) || !validTimestamp(value.startedAt)) return false;
  if (value.finishedAt !== null && value.finishedAt !== undefined && !validTimestamp(value.finishedAt)) return false;
  if (String(value.botName || "").length > 100) return false;
  if (String(value.error || "").length > 4_000 || String(value.lastDecision || "").length > 500) return false;
  if (!["live", "final_last_life", "last_observed"].includes(String(value.buildLabel || ""))) return false;
  if (value.startingRelic !== null && value.startingRelic !== undefined) {
    if (!value.startingRelic || typeof value.startingRelic !== "object") return false;
    if (!nonEmptyString(value.startingRelic.relicId) || String(value.startingRelic.relicId).length > 100) return false;
    if (!nonEmptyString(value.startingRelic.name) || String(value.startingRelic.name).length > 200) return false;
  }
  for (const key of [
    "depth", "depthHighscore", "score", "lives", "currentGold",
    "totalGoldEarned", "hp"
  ]) {
    if (nonNegativeInteger(value[key]) === null) return false;
  }
  if (!Array.isArray(value.relics) || value.relics.length > 32) return false;
  if (!value.relics.every((relic) => (
    relic && typeof relic === "object" &&
    Boolean(nonEmptyString(relic.relicId)) &&
    String(relic.relicId).length <= 100 &&
    Boolean(nonEmptyString(relic.name)) &&
    String(relic.name).length <= 200 &&
    Number.isSafeInteger(Number(relic.stacks)) &&
    Number(relic.stacks) >= 1
  ))) return false;
  return true;
}

export async function writeBotResult(resultPath, result, options = {}) {
  if (!validResult(result)) throw new TypeError("Cannot persist an invalid local bot result.");
  const mkdir = options.mkdir || fsMkdir;
  const writeFile = options.writeFile || fsWriteFile;
  const rename = options.rename || fsRename;
  const target = path.resolve(resultPath);
  const botId = path.basename(path.dirname(target));
  const sessionRoot = path.dirname(path.dirname(target));
  if (target !== botResultPath(sessionRoot, botId)) {
    throw new TypeError("The local bot result target is outside its owned bot directory.");
  }
  const temporary = `${target}.tmp`;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await rename(temporary, target);
}

function sameLocalDay(left, right) {
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

function leaderboardSort(left, right) {
  return right.score - left.score ||
    right.depthHighscore - left.depthHighscore ||
    Date.parse(right.finishedAt || right.updatedAt) - Date.parse(left.finishedAt || left.updatedAt);
}

export async function listBotLeaderboard(outputRoot, options = {}) {
  const scope = String(options.scope || "all").toLowerCase();
  if (!["today", "all"].includes(scope)) {
    throw new TypeError("Local bot leaderboard scope must be today or all.");
  }
  const readdir = options.readdir || fsReaddir;
  const readFile = options.readFile || fsReadFile;
  const stat = options.stat || fsStat;
  const now = options.now instanceof Date ? options.now : new Date();
  const root = path.resolve(outputRoot);
  let sessionEntries;
  try {
    sessionEntries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return Object.freeze([]);
    throw error;
  }
  const records = [];
  for (const session of sessionEntries) {
    if (records.length >= MAX_LEADERBOARD_RECORDS) break;
    if (!session.isDirectory() || !SESSION_ID_PATTERN.test(session.name)) continue;
    const sessionRoot = path.join(root, session.name);
    let botEntries;
    try {
      botEntries = await readdir(sessionRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const bot of botEntries) {
      if (records.length >= MAX_LEADERBOARD_RECORDS) break;
      if (!bot.isDirectory() || !BOT_ID_PATTERN.test(bot.name)) continue;
      let parsed;
      try {
        const resultPath = botResultPath(sessionRoot, bot.name);
        const fileStat = await stat(resultPath);
        if (!fileStat.isFile() || fileStat.size > MAX_RESULT_BYTES) continue;
        parsed = JSON.parse(await readFile(resultPath, "utf8"));
      } catch {
        continue;
      }
      if (!validResult(parsed) || parsed.sessionId !== session.name || parsed.botId !== bot.name) continue;
      const recordDate = new Date(parsed.finishedAt || parsed.updatedAt);
      if (scope === "today" && !sameLocalDay(recordDate, now)) continue;
      records.push(mergeBotResult(parsed, {
        status: parsed.status,
        updatedAt: parsed.updatedAt,
        finishedAt: parsed.finishedAt
      }));
    }
  }
  records.sort(leaderboardSort);
  return Object.freeze(records);
}
