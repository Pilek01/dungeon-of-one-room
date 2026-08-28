const LEGACY_CHEST_BONUS_SCHEMA_VERSION = 1;
const EXACT_CHEST_BONUS_SCHEMA_VERSION = 2;
const MAX_BUCKET_COUNT = 5;
const MAX_BUCKET_INDEX = 1000;

function emptyChestBonuses(schemaVersion = LEGACY_CHEST_BONUS_SCHEMA_VERSION) {
  const bonuses = {
    schemaVersion,
    attackDepthBuckets: {},
    armorDepthBuckets: {},
    healthDepthBuckets: {}
  };
  if (schemaVersion === EXACT_CHEST_BONUS_SCHEMA_VERSION) {
    bonuses.attackFlat = 0;
    bonuses.armorFlat = 0;
    bonuses.healthFlat = 0;
  }
  return bonuses;
}

function invalid(code) {
  throw new TypeError(code);
}

function normalizeBucketMap(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid(`CHEST_BONUS_BUCKETS_INVALID:${field}`);
  }
  const normalized = {};
  for (const [rawBucket, rawCount] of Object.entries(value)) {
    if (!/^(?:0|[1-9]\d{0,3})$/u.test(rawBucket)) {
      invalid(`CHEST_BONUS_BUCKET_INVALID:${field}`);
    }
    const bucket = Number(rawBucket);
    if (!Number.isSafeInteger(bucket) || bucket < 0 || bucket > MAX_BUCKET_INDEX) {
      invalid(`CHEST_BONUS_BUCKET_INVALID:${field}`);
    }
    if (!Number.isSafeInteger(rawCount) || rawCount < 0 || rawCount > MAX_BUCKET_COUNT) {
      invalid(`CHEST_BONUS_COUNT_INVALID:${field}`);
    }
    normalized[String(bucket)] = rawCount;
  }
  return normalized;
}

export function normalizeChestBonusesV08(value) {
  if (value === undefined) return emptyChestBonuses();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid("CHEST_BONUS_INVALID");
  }
  if (
    value.schemaVersion !== LEGACY_CHEST_BONUS_SCHEMA_VERSION &&
    value.schemaVersion !== EXACT_CHEST_BONUS_SCHEMA_VERSION
  ) {
    invalid("CHEST_BONUS_SCHEMA_UNSUPPORTED");
  }
  const keys = Object.keys(value).sort();
  const legacyExpected = ["armorDepthBuckets", "attackDepthBuckets", "healthDepthBuckets", "schemaVersion"];
  const exactExpected = [
    "armorDepthBuckets",
    "armorFlat",
    "attackDepthBuckets",
    "attackFlat",
    "healthDepthBuckets",
    "healthFlat",
    "schemaVersion"
  ];
  const expected = value.schemaVersion === EXACT_CHEST_BONUS_SCHEMA_VERSION
    ? exactExpected
    : legacyExpected;
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    invalid("CHEST_BONUS_FIELDS_INVALID");
  }
  const normalized = {
    schemaVersion: value.schemaVersion,
    attackDepthBuckets: normalizeBucketMap(value.attackDepthBuckets, "attackDepthBuckets"),
    armorDepthBuckets: normalizeBucketMap(value.armorDepthBuckets, "armorDepthBuckets"),
    healthDepthBuckets: normalizeBucketMap(value.healthDepthBuckets, "healthDepthBuckets")
  };
  if (value.schemaVersion === EXACT_CHEST_BONUS_SCHEMA_VERSION) {
    normalized.attackFlat = normalizeExactFlat(
      value.attackFlat,
      "attackFlat",
      normalized.attackDepthBuckets,
      "attack"
    );
    normalized.armorFlat = normalizeExactFlat(
      value.armorFlat,
      "armorFlat",
      normalized.armorDepthBuckets,
      "armor"
    );
    normalized.healthFlat = normalizeExactFlat(
      value.healthFlat,
      "healthFlat",
      normalized.healthDepthBuckets,
      "health"
    );
  }
  return normalized;
}

function flatForDepth(stat, depth) {
  if (stat === "health") {
    if (depth >= 31) return 10;
    if (depth >= 21) return 7;
    return 5;
  }
  if (depth >= 40) return 5;
  if (depth >= 21) return 4;
  if (depth >= 11) return 3;
  return 2;
}

function possibleBucketContributions(stat, bucket, count) {
  const amounts = new Set();
  const startDepth = bucket * 10;
  for (let depth = startDepth; depth < startDepth + 10; depth += 1) {
    amounts.add(flatForDepth(stat, depth));
  }
  let totals = new Set([0]);
  for (let index = 0; index < count; index += 1) {
    const next = new Set();
    for (const total of totals) {
      for (const amount of amounts) next.add(total + amount);
    }
    totals = next;
  }
  return totals;
}

function possibleFlatTotals(map, stat) {
  let totals = new Set([0]);
  for (const [rawBucket, count] of Object.entries(map)) {
    const contributions = possibleBucketContributions(stat, Number(rawBucket), count);
    const next = new Set();
    for (const total of totals) {
      for (const contribution of contributions) next.add(total + contribution);
    }
    totals = next;
  }
  return totals;
}

function normalizeExactFlat(value, field, buckets, stat) {
  if (!Number.isSafeInteger(value) || value < 0 || !possibleFlatTotals(buckets, stat).has(value)) {
    invalid(`CHEST_BONUS_FLAT_INVALID:${field}`);
  }
  return value;
}

function attackArmorFlatForBucket(bucket) {
  // Buckets are projected using their canonical start depth, matching the client.
  const multiplier = bucket <= 1 ? 1 : bucket === 2 ? 1.5 : bucket === 3 ? 2 : 2.5;
  return Math.round(2 * multiplier);
}

function healthFlatForBucket(bucket) {
  return bucket <= 2 ? 5 : bucket === 3 ? 7 : 10;
}

function sumFlat(map, amountForBucket) {
  return Object.entries(map).reduce(
    (total, [bucket, count]) => total + amountForBucket(Number(bucket)) * count,
    0
  );
}

export function projectChestBonusesV08(value) {
  const normalized = normalizeChestBonusesV08(value);
  if (normalized.schemaVersion === EXACT_CHEST_BONUS_SCHEMA_VERSION) {
    return normalized;
  }
  return {
    ...normalized,
    attackFlat: sumFlat(normalized.attackDepthBuckets, attackArmorFlatForBucket),
    armorFlat: sumFlat(normalized.armorDepthBuckets, attackArmorFlatForBucket),
    healthFlat: sumFlat(normalized.healthDepthBuckets, healthFlatForBucket)
  };
}

function statFields(value) {
  const raw = value?.stat ?? value?.statType ?? value?.kind ?? value?.outcome;
  const normalized = typeof raw === "string" ? raw.toLowerCase() : "";
  if (["attack", "atk"].includes(normalized)) {
    return { stat: "attack", bucketField: "attackDepthBuckets", flatField: "attackFlat" };
  }
  if (["armor", "arm"].includes(normalized)) {
    return { stat: "armor", bucketField: "armorDepthBuckets", flatField: "armorFlat" };
  }
  if (["health", "hp"].includes(normalized)) {
    return { stat: "health", bucketField: "healthDepthBuckets", flatField: "healthFlat" };
  }
  invalid("CHEST_BONUS_STAT_INVALID");
}

export function applyIssuedChestStatBonusV08(campaign, award, options = {}) {
  if (!campaign || typeof campaign !== "object" || Array.isArray(campaign)) {
    invalid("CHEST_BONUS_CAMPAIGN_INVALID");
  }
  if (!award || typeof award !== "object" || Array.isArray(award)) {
    invalid("CHEST_BONUS_AWARD_INVALID");
  }
  const { stat, bucketField, flatField } = statFields(award);
  const scalingDepth = award.scalingDepth;
  if (!Number.isSafeInteger(scalingDepth) || scalingDepth < 0) {
    invalid("CHEST_BONUS_SCALING_DEPTH_INVALID");
  }
  const bucket = Math.floor(scalingDepth / 10);
  if (bucket > MAX_BUCKET_INDEX) invalid("CHEST_BONUS_BUCKET_INVALID");
  const next = structuredClone(campaign);
  let chestBonuses = normalizeChestBonusesV08(campaign.chestBonuses);
  if (
    options.exactStatCarry === true &&
    chestBonuses.schemaVersion === LEGACY_CHEST_BONUS_SCHEMA_VERSION
  ) {
    chestBonuses = {
      ...projectChestBonusesV08(chestBonuses),
      schemaVersion: EXACT_CHEST_BONUS_SCHEMA_VERSION
    };
  }
  const current = chestBonuses[bucketField][String(bucket)] || 0;
  if (current >= MAX_BUCKET_COUNT) {
    invalid("CHEST_BONUS_BUCKET_CAP");
  }
  chestBonuses[bucketField][String(bucket)] = current + 1;
  if (chestBonuses.schemaVersion === EXACT_CHEST_BONUS_SCHEMA_VERSION) {
    chestBonuses[flatField] += flatForDepth(stat, scalingDepth);
  }
  next.chestBonuses = chestBonuses;
  return next;
}

export const V08_CHEST_BONUS_SCHEMA_VERSION = LEGACY_CHEST_BONUS_SCHEMA_VERSION;
export const V08_CHEST_BONUS_EXACT_SCHEMA_VERSION = EXACT_CHEST_BONUS_SCHEMA_VERSION;
export const V08_CHEST_BONUS_MAX_BUCKET_COUNT = MAX_BUCKET_COUNT;
