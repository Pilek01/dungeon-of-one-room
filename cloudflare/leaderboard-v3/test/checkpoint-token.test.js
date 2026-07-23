import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  decodeCheckpointToken,
  signCheckpointToken,
  verifyCheckpointToken
} from "../src/security/checkpoint-token.js";
import { canonicalJson } from "../src/security/canonical-json.js";
import { base64UrlEncode } from "../src/security/digests.js";
import { TEST_SECRET } from "./fixtures/harness.js";

const encoder = new TextEncoder();

function payload(overrides = {}) {
  return {
    protocolVersion: "ranked-v3-checkpoint-1",
    runId: "run_0123456789abcdef",
    revision: 4,
    season: "fixture-season",
    rulesetHash: "sha256:fixture",
    stateDigest: "a".repeat(64),
    roomDirectiveId: "directive_fixture",
    roomNonce: "nonce_fixture",
    issuedAt: 1_800_000_000_000,
    expiresAt: 1_800_000_900_000,
    ...overrides
  };
}

async function signRawSegment(segment, secret = TEST_SECRET) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(segment));
  return `${segment}.${base64UrlEncode(signature)}`;
}

test("valid compact HMAC checkpoint token verifies", async () => {
  const value = payload();
  const token = await signCheckpointToken(value, TEST_SECRET);
  const verified = await verifyCheckpointToken(token, TEST_SECRET, {
    now: value.issuedAt + 1,
    runId: value.runId,
    revision: value.revision,
    season: value.season,
    rulesetHash: value.rulesetHash,
    stateDigest: value.stateDigest
  });
  assert.deepEqual(verified, value);
  assert.equal(token.split(".").length, 2);
});

test("changed payload is rejected", async () => {
  const token = await signCheckpointToken(payload(), TEST_SECRET);
  const decoded = decodeCheckpointToken(token);
  const changed = await signCheckpointToken(
    { ...decoded.payload, runId: "run_changed" },
    "different-secret-with-at-least-32-bytes"
  );
  await assert.rejects(
    verifyCheckpointToken(changed, TEST_SECRET, { now: payload().issuedAt + 1 }),
    /signature/iu
  );
});

test("changed signature and wrong secret are rejected", async () => {
  const token = await signCheckpointToken(payload(), TEST_SECRET);
  const [body, signature] = token.split(".");
  const replacement = signature.endsWith("A") ? "B" : "A";
  await assert.rejects(
    verifyCheckpointToken(`${body}.${signature.slice(0, -1)}${replacement}`, TEST_SECRET, {
      now: payload().issuedAt + 1
    }),
    /signature/iu
  );
  await assert.rejects(
    verifyCheckpointToken(token, "wrong-secret-with-at-least-32-bytes", {
      now: payload().issuedAt + 1
    }),
    /signature/iu
  );
});

test("expired token is rejected", async () => {
  const value = payload();
  const token = await signCheckpointToken(value, TEST_SECRET);
  await assert.rejects(
    verifyCheckpointToken(token, TEST_SECRET, { now: value.expiresAt }),
    /expired/iu
  );
});

test("token from another season or ruleset is rejected", async () => {
  const value = payload();
  const token = await signCheckpointToken(value, TEST_SECRET);
  await assert.rejects(
    verifyCheckpointToken(token, TEST_SECRET, {
      now: value.issuedAt + 1,
      season: "other-season"
    }),
    /season/iu
  );
  await assert.rejects(
    verifyCheckpointToken(token, TEST_SECRET, {
      now: value.issuedAt + 1,
      rulesetHash: "sha256:other"
    }),
    /rulesetHash/iu
  );
});

test("future and stale revision are rejected", async () => {
  const future = payload({ revision: 9 });
  const futureToken = await signCheckpointToken(future, TEST_SECRET);
  await assert.rejects(
    verifyCheckpointToken(futureToken, TEST_SECRET, {
      now: future.issuedAt + 1,
      revision: 4
    }),
    /revision/iu
  );

  const stale = payload({ revision: 2 });
  const staleToken = await signCheckpointToken(stale, TEST_SECRET);
  await assert.rejects(
    verifyCheckpointToken(staleToken, TEST_SECRET, {
      now: stale.issuedAt + 1,
      revision: 4
    }),
    /revision/iu
  );
});

test("noncanonical payload serialization is rejected even with a valid HMAC", async () => {
  const value = payload();
  const noncanonical = JSON.stringify({
    runId: value.runId,
    protocolVersion: value.protocolVersion,
    revision: value.revision,
    season: value.season,
    rulesetHash: value.rulesetHash,
    stateDigest: value.stateDigest,
    roomDirectiveId: value.roomDirectiveId,
    roomNonce: value.roomNonce,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt
  });
  const token = await signRawSegment(base64UrlEncode(encoder.encode(noncanonical)));
  await assert.rejects(
    verifyCheckpointToken(token, TEST_SECRET, { now: value.issuedAt + 1 }),
    /canonical/iu
  );
});

test("additional checkpoint token claims are rejected", async () => {
  const extended = { ...payload(), clientRole: "admin" };
  const segment = base64UrlEncode(encoder.encode(canonicalJson(extended)));
  const token = await signRawSegment(segment);
  await assert.rejects(
    verifyCheckpointToken(token, TEST_SECRET, { now: extended.issuedAt + 1 }),
    /fields/iu
  );
});

test("verification delegates signature comparison to Web Crypto", async () => {
  const source = await readFile(
    new URL("../src/security/checkpoint-token.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /crypto\.subtle\.verify/u);
  assert.doesNotMatch(source, /signature\s*===|===\s*signature/u);
});
