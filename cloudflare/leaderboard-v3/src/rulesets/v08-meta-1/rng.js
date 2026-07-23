import { RNG_DOMAIN, RULESET_ID } from "./constants.js";

const encoder = new TextEncoder();
const MAX_RANDOM_LENGTH = 65_536;
const UINT64_SPACE = 1n << 64n;

function encodeField(value) {
  const text = String(value);
  return `${encoder.encode(text).byteLength}:${text}`;
}

function requireSafeInteger(value, code, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(code);
  }
  return value;
}

function normalizeSecret(secret) {
  const bytes = typeof secret === "string" ? encoder.encode(secret) : secret;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 32) {
    throw new TypeError("RULESET_RNG_SECRET_INVALID");
  }
  return bytes;
}

function requireText(value, code) {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(code);
  return text;
}

function requireCryptoProvider(provider) {
  const cryptoProvider = provider || globalThis.crypto;
  if (
    !cryptoProvider ||
    typeof cryptoProvider.subtle?.importKey !== "function" ||
    typeof cryptoProvider.subtle?.sign !== "function"
  ) {
    throw new TypeError("RULESET_RNG_CRYPTO_UNAVAILABLE");
  }
  return cryptoProvider;
}

function normalizeRequest(options) {
  if (!options || typeof options !== "object") {
    throw new TypeError("RULESET_RNG_INPUT_INVALID");
  }
  return {
    secret: normalizeSecret(options.secret),
    rulesetId: requireText(options.rulesetId || RULESET_ID, "RULESET_RNG_RULESET_ID_INVALID"),
    runId: requireText(options.runId, "RULESET_RNG_RUN_ID_INVALID"),
    revision: requireSafeInteger(options.revision, "RULESET_RNG_REVISION_INVALID"),
    purpose: requireText(options.purpose, "RULESET_RNG_PURPOSE_INVALID"),
    counter: requireSafeInteger(options.counter, "RULESET_RNG_COUNTER_INVALID"),
    length: requireSafeInteger(options.length ?? 32, "RULESET_RNG_LENGTH_INVALID"),
    cryptoProvider: requireCryptoProvider(options.cryptoProvider)
  };
}

function buildMessage(request, blockIndex) {
  return [
    RNG_DOMAIN,
    encodeField(request.rulesetId),
    encodeField(request.runId),
    encodeField(request.revision),
    encodeField(request.purpose),
    encodeField(request.counter),
    encodeField(request.length),
    encodeField(blockIndex)
  ].join("|");
}

export async function deriveRandomBytes(options) {
  const request = normalizeRequest(options);
  if (request.length > MAX_RANDOM_LENGTH) {
    throw new RangeError("RULESET_RNG_LENGTH_TOO_LARGE");
  }
  if (request.length === 0) return new Uint8Array(0);

  const key = await request.cryptoProvider.subtle.importKey(
    "raw",
    request.secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const result = new Uint8Array(request.length);
  let offset = 0;
  let blockIndex = 0;
  while (offset < result.byteLength) {
    const signature = new Uint8Array(await request.cryptoProvider.subtle.sign(
      "HMAC",
      key,
      encoder.encode(buildMessage(request, blockIndex))
    ));
    const remaining = result.byteLength - offset;
    const take = Math.min(remaining, signature.byteLength);
    result.set(signature.subarray(0, take), offset);
    offset += take;
    blockIndex += 1;
  }
  return result;
}

export async function deriveUint32(options) {
  const bytes = await deriveRandomBytes({ ...options, length: 4 });
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
}

function uint64FromBytes(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return (BigInt(view.getUint32(0, false)) << 32n) | BigInt(view.getUint32(4, false));
}

export async function deriveIntInclusive(min, max, options) {
  requireSafeInteger(min, "RULESET_RNG_MIN_INVALID", Number.MIN_SAFE_INTEGER);
  requireSafeInteger(max, "RULESET_RNG_MAX_INVALID", Number.MIN_SAFE_INTEGER);
  if (max < min) throw new RangeError("RULESET_RNG_RANGE_INVALID");
  if (min === max) return min;
  const span = BigInt(max) - BigInt(min) + 1n;
  if (span > UINT64_SPACE) throw new RangeError("RULESET_RNG_RANGE_TOO_LARGE");
  const limit = UINT64_SPACE - (UINT64_SPACE % span);
  const baseCounter = requireSafeInteger(options?.counter, "RULESET_RNG_COUNTER_INVALID");
  for (let attempt = 0; attempt < 1024; attempt += 1) {
    const counter = baseCounter + attempt;
    if (!Number.isSafeInteger(counter)) throw new RangeError("RULESET_RNG_COUNTER_EXHAUSTED");
    const bytes = await deriveRandomBytes({
      ...options,
      purpose: `${requireText(options?.purpose, "RULESET_RNG_PURPOSE_INVALID")}/int-inclusive`,
      counter,
      length: 8
    });
    const sample = uint64FromBytes(bytes);
    if (sample < limit) return Number(BigInt(min) + (sample % span));
  }
  throw new Error("RULESET_RNG_REJECTION_LIMIT");
}

export async function chooseIndex(length, options) {
  requireSafeInteger(length, "RULESET_RNG_CHOICE_LENGTH_INVALID", 1);
  return deriveIntInclusive(0, length - 1, {
    ...options,
    purpose: `${requireText(options?.purpose, "RULESET_RNG_PURPOSE_INVALID")}/choose-index`
  });
}

export async function deriveShuffleOrder(length, options) {
  requireSafeInteger(length, "RULESET_RNG_SHUFFLE_LENGTH_INVALID");
  const purpose = requireText(options?.purpose, "RULESET_RNG_PURPOSE_INVALID");
  const baseCounter = requireSafeInteger(options?.counter, "RULESET_RNG_COUNTER_INVALID");
  const order = Array.from({ length }, (_, index) => index);
  for (let index = length - 1; index > 0; index -= 1) {
    const offset = length - 1 - index;
    const counter = baseCounter + offset;
    if (!Number.isSafeInteger(counter)) throw new RangeError("RULESET_RNG_COUNTER_EXHAUSTED");
    const selected = await chooseIndex(index + 1, {
      ...options,
      purpose: `${purpose}/shuffle/${index}`,
      counter
    });
    [order[index], order[selected]] = [order[selected], order[index]];
  }
  return order;
}
