import catalogDocument from "./data/run-modifier-catalog.generated.json" with { type: "json" };

export const MUTATOR_PROGRESS_VERSION = 1;

const COUNTER_KEYS = Object.freeze([
  "totalKills",
  "eliteKills",
  "depthHighscore",
  "totalGoldEarned",
  "totalMerchantPots",
  "shieldUsesThisGame",
  "potionFreeExtract"
]);
const COUNTER_KEY_SET = new Set(COUNTER_KEYS);
const catalog = catalogDocument.canonicalData;
const modifierIds = Object.freeze([...catalog.modifierIds].sort());
const modifierIdSet = new Set(modifierIds);
const unlockRules = Object.freeze(catalog.modifiers.map((entry) => Object.freeze({
  modifierId: entry.modifierId,
  metric: entry.unlockSource.metric,
  threshold: entry.unlockSource.threshold
})));

function requireCounter(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("MUTATOR_PROGRESS_COUNTER_INVALID");
  }
  return value;
}

function normalizeIds(ids, errorCode) {
  if (!Array.isArray(ids)) throw new TypeError(errorCode);
  const normalized = [];
  for (const rawId of ids) {
    const modifierId = String(rawId || "");
    if (!modifierIdSet.has(modifierId)) {
      throw new TypeError(`${errorCode}:${modifierId}`);
    }
    if (!normalized.includes(modifierId)) normalized.push(modifierId);
  }
  return normalized.sort();
}

function deriveUnlockedIds(progress, preservedIds = []) {
  const unlocked = new Set(preservedIds);
  for (const rule of unlockRules) {
    if (progress[rule.metric] >= rule.threshold) unlocked.add(rule.modifierId);
  }
  return [...unlocked].sort();
}

export function createEmptyMutatorProgressV08(options = {}) {
  return {
    progressVersion: MUTATOR_PROGRESS_VERSION,
    totalKills: 0,
    eliteKills: 0,
    depthHighscore: 0,
    totalGoldEarned: 0,
    totalMerchantPots: 0,
    shieldUsesThisGame: 0,
    potionFreeExtract: 0,
    unlockedMutatorIds: [],
    importConsumed: Boolean(options.importConsumed),
    importedAt: options.importedAt == null ? null : requireCounter(options.importedAt)
  };
}

export function normalizeMutatorProgressV08(value, options = {}) {
  const activeModifierIds = normalizeIds(
    options.activeModifierIds || [],
    "MUTATOR_ACTIVE_ID_UNKNOWN"
  );
  if (value == null) {
    const empty = createEmptyMutatorProgressV08();
    empty.unlockedMutatorIds = activeModifierIds;
    return empty;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("MUTATOR_PROGRESS_INVALID");
  }
  if (value.progressVersion !== MUTATOR_PROGRESS_VERSION) {
    throw new TypeError("MUTATOR_PROGRESS_VERSION_UNSUPPORTED");
  }
  const normalized = createEmptyMutatorProgressV08({
    importConsumed: value.importConsumed,
    importedAt: value.importedAt
  });
  for (const key of COUNTER_KEYS) normalized[key] = requireCounter(value[key]);
  const storedIds = normalizeIds(
    value.unlockedMutatorIds,
    "MUTATOR_PROGRESS_ID_UNKNOWN"
  );
  normalized.unlockedMutatorIds = deriveUnlockedIds(normalized, [
    ...storedIds,
    ...activeModifierIds
  ]);
  return normalized;
}

export function applyMutatorProgressDeltaV08(value, counters = {}) {
  const current = normalizeMutatorProgressV08(value);
  if (!counters || typeof counters !== "object" || Array.isArray(counters)) {
    throw new TypeError("MUTATOR_PROGRESS_DELTA_INVALID");
  }
  const next = structuredClone(current);
  for (const [key, rawValue] of Object.entries(counters)) {
    if (!COUNTER_KEY_SET.has(key)) {
      throw new TypeError(`MUTATOR_PROGRESS_COUNTER_UNKNOWN:${key}`);
    }
    const counter = requireCounter(rawValue);
    if (counter < current[key]) throw new TypeError(`MUTATOR_PROGRESS_DECREASE:${key}`);
    next[key] = counter;
  }
  next.unlockedMutatorIds = deriveUnlockedIds(next, current.unlockedMutatorIds);
  return next;
}

export function applyPracticeMutatorImportV08(value, payload = {}, options = {}) {
  const current = normalizeMutatorProgressV08(value);
  if (current.importConsumed) throw new TypeError("MUTATOR_PRACTICE_IMPORT_CONSUMED");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("MUTATOR_PRACTICE_IMPORT_INVALID");
  }
  const metrics = payload.metrics || {};
  const imported = applyMutatorProgressDeltaV08(current, metrics);
  const historicalIds = normalizeIds(
    payload.historicalUnlockedMutatorIds || [],
    "MUTATOR_IMPORT_ID_UNKNOWN"
  );
  imported.unlockedMutatorIds = deriveUnlockedIds(
    imported,
    historicalIds.includes("resilience") ? ["resilience"] : []
  );
  imported.importConsumed = true;
  imported.importedAt = options.importedAt == null ? 0 : requireCounter(options.importedAt);
  return imported;
}

export function resetMutatorCampaignProgressV08(value) {
  const current = normalizeMutatorProgressV08(value);
  return createEmptyMutatorProgressV08({
    importConsumed: current.importConsumed,
    importedAt: current.importedAt
  });
}

export function projectPublicMutatorProgressV08(value) {
  const progress = normalizeMutatorProgressV08(value);
  return {
    progressVersion: progress.progressVersion,
    totalKills: progress.totalKills,
    eliteKills: progress.eliteKills,
    depthHighscore: progress.depthHighscore,
    totalGoldEarned: progress.totalGoldEarned,
    totalMerchantPots: progress.totalMerchantPots,
    shieldUsesThisGame: progress.shieldUsesThisGame,
    potionFreeExtract: progress.potionFreeExtract,
    unlockedMutatorIds: [...progress.unlockedMutatorIds],
    importConsumed: progress.importConsumed
  };
}

export const V08_MUTATOR_UNLOCK_RULES = unlockRules;
