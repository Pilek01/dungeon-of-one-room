const CHEST_BONUS_SCHEMA_VERSION = 1;
const MAX_BUCKET_COUNT = 5;
const MAX_BUCKET_INDEX = 1000;

function emptyChestBonuses() {
  return {
    schemaVersion: CHEST_BONUS_SCHEMA_VERSION,
    attackDepthBuckets: {},
    armorDepthBuckets: {},
    healthDepthBuckets: {}
  };
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
  const keys = Object.keys(value).sort();
  const expected = ["armorDepthBuckets", "attackDepthBuckets", "healthDepthBuckets", "schemaVersion"];
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    invalid("CHEST_BONUS_FIELDS_INVALID");
  }
  if (value.schemaVersion !== CHEST_BONUS_SCHEMA_VERSION) {
    invalid("CHEST_BONUS_SCHEMA_UNSUPPORTED");
  }
  return {
    schemaVersion: CHEST_BONUS_SCHEMA_VERSION,
    attackDepthBuckets: normalizeBucketMap(value.attackDepthBuckets, "attackDepthBuckets"),
    armorDepthBuckets: normalizeBucketMap(value.armorDepthBuckets, "armorDepthBuckets"),
    healthDepthBuckets: normalizeBucketMap(value.healthDepthBuckets, "healthDepthBuckets")
  };
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
  return {
    ...normalized,
    attackFlat: sumFlat(normalized.attackDepthBuckets, attackArmorFlatForBucket),
    armorFlat: sumFlat(normalized.armorDepthBuckets, attackArmorFlatForBucket),
    healthFlat: sumFlat(normalized.healthDepthBuckets, healthFlatForBucket)
  };
}

function statField(value) {
  const raw = value?.stat ?? value?.statType ?? value?.kind ?? value?.outcome;
  const normalized = typeof raw === "string" ? raw.toLowerCase() : "";
  if (["attack", "atk"].includes(normalized)) return "attackDepthBuckets";
  if (["armor", "arm"].includes(normalized)) return "armorDepthBuckets";
  if (["health", "hp"].includes(normalized)) return "healthDepthBuckets";
  invalid("CHEST_BONUS_STAT_INVALID");
}

export function applyIssuedChestStatBonusV08(campaign, award) {
  if (!campaign || typeof campaign !== "object" || Array.isArray(campaign)) {
    invalid("CHEST_BONUS_CAMPAIGN_INVALID");
  }
  if (!award || typeof award !== "object" || Array.isArray(award)) {
    invalid("CHEST_BONUS_AWARD_INVALID");
  }
  const field = statField(award);
  const scalingDepth = award.scalingDepth;
  if (!Number.isSafeInteger(scalingDepth) || scalingDepth < 0) {
    invalid("CHEST_BONUS_SCALING_DEPTH_INVALID");
  }
  const bucket = Math.floor(scalingDepth / 10);
  if (bucket > MAX_BUCKET_INDEX) invalid("CHEST_BONUS_BUCKET_INVALID");
  const next = structuredClone(campaign);
  const chestBonuses = normalizeChestBonusesV08(campaign.chestBonuses);
  const current = chestBonuses[field][String(bucket)] || 0;
  if (current >= MAX_BUCKET_COUNT) {
    invalid("CHEST_BONUS_BUCKET_CAP");
  }
  chestBonuses[field][String(bucket)] = current + 1;
  next.chestBonuses = chestBonuses;
  return next;
}

export const V08_CHEST_BONUS_SCHEMA_VERSION = CHEST_BONUS_SCHEMA_VERSION;
export const V08_CHEST_BONUS_MAX_BUCKET_COUNT = MAX_BUCKET_COUNT;
