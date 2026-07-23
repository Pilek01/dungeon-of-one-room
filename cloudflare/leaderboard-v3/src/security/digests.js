import { canonicalJson } from "./canonical-json.js";

const encoder = new TextEncoder();

export function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function base64UrlEncode(bytes) {
  const values = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const value of values) binary += String.fromCharCode(value);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function base64UrlDecode(value) {
  const text = String(value);
  if (!/^[A-Za-z0-9_-]+$/u.test(text)) {
    throw new TypeError("Invalid base64url.");
  }
  const padding = "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/") + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256Hex(value) {
  const text = typeof value === "string" ? value : canonicalJson(value);
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return bytesToHex(digest);
}

export async function canonicalDigest(value) {
  return sha256Hex(canonicalJson(value));
}
