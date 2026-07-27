import { base64UrlEncode, canonicalDigest } from "./digests.js";

const CREDENTIAL_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;

export function requireRecoveryCredential(value, field = "recoveryCredential") {
  const credential = String(value || "");
  if (!CREDENTIAL_PATTERN.test(credential)) {
    throw new TypeError(`CREDENTIAL_INVALID:${field}`);
  }
  return credential;
}

export function createRecoveryCredential(cryptoProvider = crypto) {
  const bytes = new Uint8Array(32);
  cryptoProvider.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createCredentialVerifier(credential, purpose) {
  return canonicalDigest({
    purpose: String(purpose || ""),
    credential: requireRecoveryCredential(credential)
  });
}

function hexBytes(value) {
  if (!/^[a-f0-9]{64}$/u.test(String(value || ""))) return null;
  return Uint8Array.from(
    String(value).match(/.{2}/gu),
    (pair) => Number.parseInt(pair, 16)
  );
}

export function timingSafeVerifierEqual(left, right) {
  const a = hexBytes(left);
  const b = hexBytes(right);
  if (!a || !b) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}
