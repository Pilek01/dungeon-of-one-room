function normalizeNumber(value) {
  if (!Number.isFinite(value)) {
    throw new TypeError("Canonical JSON does not support non-finite numbers.");
  }
  if (Object.is(value, -0)) return 0;
  return value;
}

export function canonicalize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") return normalizeNumber(value);
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object") {
    throw new TypeError(`Canonical JSON does not support ${typeof value}.`);
  }

  const result = {};
  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item === undefined) continue;
    result[key] = canonicalize(item);
  }
  return result;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function assertCanonicalJson(text) {
  const decoded = JSON.parse(String(text));
  if (canonicalJson(decoded) !== text) {
    throw new TypeError("JSON serialization is not canonical.");
  }
  return decoded;
}
