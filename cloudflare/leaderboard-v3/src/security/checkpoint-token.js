import { PROTOCOL_VERSION } from "../config.js";
import { canonicalJson, assertCanonicalJson } from "./canonical-json.js";
import { base64UrlDecode, base64UrlEncode } from "./digests.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CHECKPOINT_TOKEN_FIELDS = Object.freeze([
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
const BOUNDARY_TOKEN_VERSION = 2;
const BOUNDARY_KINDS = Object.freeze({
  RUN_BOOTSTRAP: "run_bootstrap",
  ROOM_CHECKPOINT: "room_checkpoint",
  RUN_TERMINAL: "run_terminal"
});
const BOUNDARY_COMMON_FIELDS = Object.freeze([
  "tokenVersion",
  "boundaryKind",
  "runId",
  "rulesetId",
  "rulesetHash",
  "revision",
  "stateDigest",
  "issuedAt",
  "expiresAt"
]);
const BOUNDARY_KIND_FIELDS = Object.freeze({
  [BOUNDARY_KINDS.RUN_BOOTSTRAP]: Object.freeze([
    ...BOUNDARY_COMMON_FIELDS,
    "startingOfferId",
    "bootstrapNonce"
  ]),
  [BOUNDARY_KINDS.ROOM_CHECKPOINT]: Object.freeze([
    ...BOUNDARY_COMMON_FIELDS,
    "roomDirectiveId",
    "roomNonce"
  ]),
  [BOUNDARY_KINDS.RUN_TERMINAL]: BOUNDARY_COMMON_FIELDS
});

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

function hasExactFields(payload, fields) {
  return (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Object.keys(payload).sort().join("\n") === [...fields].sort().join("\n")
  );
}

function requireTimestamps(payload, label) {
  if (!Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt)) {
    throw new TypeError(`${label} timestamps are invalid.`);
  }
  if (payload.expiresAt <= payload.issuedAt) {
    throw new TypeError(`${label} expiration is invalid.`);
  }
}

function requireCheckpointTokenPayload(payload) {
  if (
    !hasExactFields(payload, CHECKPOINT_TOKEN_FIELDS)
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
  requireTimestamps(payload, "Checkpoint token");
  return payload;
}

function requireBoundaryTokenPayload(payload) {
  const fields = BOUNDARY_KIND_FIELDS[payload?.boundaryKind];
  if (payload?.tokenVersion !== BOUNDARY_TOKEN_VERSION || !fields) {
    throw new TypeError("Boundary token version or kind is invalid.");
  }
  if (!hasExactFields(payload, fields)) {
    throw new TypeError("Boundary token fields are invalid.");
  }
  for (const field of [
    "boundaryKind",
    "runId",
    "rulesetId",
    "rulesetHash",
    "stateDigest",
    ...(payload.boundaryKind === BOUNDARY_KINDS.RUN_BOOTSTRAP
      ? ["startingOfferId", "bootstrapNonce"]
      : payload.boundaryKind === BOUNDARY_KINDS.ROOM_CHECKPOINT
        ? ["roomDirectiveId", "roomNonce"]
        : [])
  ]) {
    if (typeof payload[field] !== "string" || !payload[field]) {
      throw new TypeError(`Boundary token requires ${field}.`);
    }
  }
  if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) {
    throw new TypeError("Boundary token revision is invalid.");
  }
  requireTimestamps(payload, "Boundary token");
  return payload;
}

function decodeToken(token, requirePayload) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new TypeError("Boundary token format is invalid.");
  }
  const payloadText = decoder.decode(base64UrlDecode(parts[0]));
  const payload = requirePayload(assertCanonicalJson(payloadText));
  return {
    payload,
    payloadSegment: parts[0],
    signatureSegment: parts[1]
  };
}

export function decodeCheckpointToken(token) {
  return decodeToken(token, requireCheckpointTokenPayload);
}

export function decodeBoundaryToken(token) {
  return decodeToken(token, requireBoundaryTokenPayload);
}

async function signToken(payload, secret, requirePayload) {
  const canonicalPayload = canonicalJson(requirePayload({ ...payload }));
  const payloadSegment = base64UrlEncode(encoder.encode(canonicalPayload));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadSegment));
  return `${payloadSegment}.${base64UrlEncode(signature)}`;
}

export async function signCheckpointToken(payload, secret) {
  return signToken(payload, secret, requireCheckpointTokenPayload);
}

export async function signBoundaryToken(payload, secret) {
  return signToken(payload, secret, requireBoundaryTokenPayload);
}

async function verifySignedToken(decoded, secret, label) {
  const key = await importHmacKey(secret);
  const signature = base64UrlDecode(decoded.signatureSegment);
  const validSignature = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(decoded.payloadSegment)
  );
  if (!validSignature) throw new TypeError(`${label} signature is invalid.`);
  return decoded.payload;
}

export async function verifyCheckpointToken(token, secret, expected = {}) {
  const payload = await verifySignedToken(
    decodeCheckpointToken(token),
    secret,
    "Checkpoint token"
  );
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

export async function verifyBoundaryToken(token, secret, expected = {}) {
  const payload = await verifySignedToken(
    decodeBoundaryToken(token),
    secret,
    "Boundary token"
  );
  const now = Number.isSafeInteger(expected.now) ? expected.now : Date.now();
  if (!expected.allowExpired && payload.expiresAt <= now) {
    throw new TypeError("Boundary token is expired.");
  }
  if (expected.boundaryKind && payload.boundaryKind !== expected.boundaryKind) {
    throw new TypeError(
      `TOKEN_BOUNDARY_KIND_MISMATCH:${expected.boundaryKind}:${payload.boundaryKind}`
    );
  }
  const equalityChecks = {
    runId: expected.runId,
    rulesetId: expected.rulesetId,
    rulesetHash: expected.rulesetHash,
    revision: expected.revision,
    stateDigest: expected.stateDigest,
    startingOfferId: expected.startingOfferId,
    bootstrapNonce: expected.bootstrapNonce,
    roomDirectiveId: expected.roomDirectiveId,
    roomNonce: expected.roomNonce
  };
  for (const [field, expectedValue] of Object.entries(equalityChecks)) {
    if (expectedValue !== undefined && payload[field] !== expectedValue) {
      throw new TypeError(`Boundary token ${field} does not match.`);
    }
  }
  return payload;
}

export {
  BOUNDARY_KINDS,
  BOUNDARY_TOKEN_VERSION
};
