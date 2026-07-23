import { PROTOCOL_VERSION } from "../config.js";
import { canonicalJson, assertCanonicalJson } from "./canonical-json.js";
import { base64UrlDecode, base64UrlEncode } from "./digests.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const TOKEN_FIELDS = Object.freeze([
  "protocolVersion",
  "runId",
  "revision",
  "season",
  "rulesetHash",
  "stateDigest",
  "roomDirectiveId",
  "roomNonce",
  "issuedAt",
  "expiresAt"
]);

async function importHmacKey(secret) {
  const value = String(secret || "");
  if (encoder.encode(value).byteLength < 32) {
    throw new TypeError("RANKED_V3_HMAC_SECRET must contain at least 32 UTF-8 bytes.");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(value),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function requireTokenPayload(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    Object.keys(payload).sort().join("\n") !== [...TOKEN_FIELDS].sort().join("\n")
  ) {
    throw new TypeError("Checkpoint token fields are invalid.");
  }
  const stringFields = [
    "protocolVersion",
    "runId",
    "season",
    "rulesetHash",
    "stateDigest",
    "roomDirectiveId",
    "roomNonce"
  ];
  for (const field of stringFields) {
    if (typeof payload?.[field] !== "string" || !payload[field]) {
      throw new TypeError(`Checkpoint token requires ${field}.`);
    }
  }
  if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) {
    throw new TypeError("Checkpoint token revision is invalid.");
  }
  if (!Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt)) {
    throw new TypeError("Checkpoint token timestamps are invalid.");
  }
  if (payload.expiresAt <= payload.issuedAt) {
    throw new TypeError("Checkpoint token expiration is invalid.");
  }
  return payload;
}

export function decodeCheckpointToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new TypeError("Checkpoint token format is invalid.");
  }
  const payloadText = decoder.decode(base64UrlDecode(parts[0]));
  const payload = requireTokenPayload(assertCanonicalJson(payloadText));
  return {
    payload,
    payloadSegment: parts[0],
    signatureSegment: parts[1]
  };
}

export async function signCheckpointToken(payload, secret) {
  const canonicalPayload = canonicalJson(requireTokenPayload({ ...payload }));
  const payloadSegment = base64UrlEncode(encoder.encode(canonicalPayload));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadSegment));
  return `${payloadSegment}.${base64UrlEncode(signature)}`;
}

export async function verifyCheckpointToken(token, secret, expected = {}) {
  const decoded = decodeCheckpointToken(token);
  const key = await importHmacKey(secret);
  const signature = base64UrlDecode(decoded.signatureSegment);
  const validSignature = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(decoded.payloadSegment)
  );
  if (!validSignature) throw new TypeError("Checkpoint token signature is invalid.");

  const payload = decoded.payload;
  const now = Number.isSafeInteger(expected.now) ? expected.now : Date.now();
  if (payload.protocolVersion !== (expected.protocolVersion || PROTOCOL_VERSION)) {
    throw new TypeError("Checkpoint token protocol does not match.");
  }
  if (!expected.allowExpired && payload.expiresAt <= now) {
    throw new TypeError("Checkpoint token is expired.");
  }
  const equalityChecks = {
    runId: expected.runId,
    season: expected.season,
    rulesetHash: expected.rulesetHash,
    revision: expected.revision,
    stateDigest: expected.stateDigest,
    roomDirectiveId: expected.roomDirectiveId,
    roomNonce: expected.roomNonce
  };
  for (const [field, expectedValue] of Object.entries(equalityChecks)) {
    if (expectedValue !== undefined && payload[field] !== expectedValue) {
      throw new TypeError(`Checkpoint token ${field} does not match.`);
    }
  }
  return payload;
}
