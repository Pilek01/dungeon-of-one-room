import { RNG_DOMAIN } from "./constants.js";

const encoder = new TextEncoder();

function encodeField(value) {
  const text = String(value);
  return `${encoder.encode(text).byteLength}:${text}`;
}

export async function deriveRandomBytes(secret, runId, revision, purpose, counter) {
  const secretBytes = typeof secret === "string" ? encoder.encode(secret) : secret;
  if (!(secretBytes instanceof Uint8Array) || secretBytes.byteLength < 32) {
    throw new TypeError("RULESET_RNG_SECRET_INVALID");
  }
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new TypeError("RULESET_RNG_REVISION_INVALID");
  }
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new TypeError("RULESET_RNG_COUNTER_INVALID");
  }
  if (!String(runId || "") || !String(purpose || "")) {
    throw new TypeError("RULESET_RNG_DOMAIN_INPUT_INVALID");
  }

  const message = [
    RNG_DOMAIN,
    encodeField(runId),
    encodeField(revision),
    encodeField(purpose),
    encodeField(counter)
  ].join("|");
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return new Uint8Array(signature);
}
