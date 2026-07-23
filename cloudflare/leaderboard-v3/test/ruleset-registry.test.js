import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import {
  V08_META_1_DESCRIPTOR,
  createV08Meta1Ruleset
} from "../src/rulesets/v08-meta-1/index.js";
import { deriveRandomBytes } from "../src/rulesets/v08-meta-1/rng.js";

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function descriptor(hash, marker, status = "supported") {
  return {
    rulesetId: marker,
    rulesetHash: hash,
    status,
    createRuleset: () => ({ marker })
  };
}

test("ruleset registry fails closed and retains exact old hashes", () => {
  const oldHash = `sha256:${"1".repeat(64)}`;
  const newHash = `sha256:${"2".repeat(64)}`;
  const registry = createRulesetRegistry([
    descriptor(oldHash, "old"),
    descriptor(newHash, "new")
  ]);

  assert.equal(registry.resolve(oldHash).marker, "old");
  assert.equal(registry.resolve(newHash).marker, "new");
  assert.equal(registry.list().length, 2);
  assert.throws(() => registry.resolve(""), /RULESET_HASH_REQUIRED/u);
  assert.throws(() => registry.resolve(`sha256:${"3".repeat(64)}`), /RULESET_HASH_UNSUPPORTED/u);
  assert.throws(
    () => createRulesetRegistry([descriptor(oldHash, "a"), descriptor(oldHash, "b")]),
    /RULESET_HASH_DUPLICATE/u
  );
});

test("v08-meta-1 remains visible as spec-only but cannot instantiate", () => {
  const registry = createRulesetRegistry([V08_META_1_DESCRIPTOR]);
  assert.equal(registry.describe(V08_META_1_DESCRIPTOR.rulesetHash)?.status, "spec-only");
  assert.throws(
    () => registry.resolve(V08_META_1_DESCRIPTOR.rulesetHash),
    /RULESET_NOT_ACTIVE:spec-only/u
  );
  assert.throws(() => createV08Meta1Ruleset(), /RULESET_NOT_IMPLEMENTED:v08-meta-1/u);
});

test("ruleset RNG is deterministic and domain-separated without Math.random", async () => {
  const secret = new Uint8Array(32).fill(7);
  const first = await deriveRandomBytes(secret, "run_example", 4, "merchant-inventory", 0);
  const again = await deriveRandomBytes(secret, "run_example", 4, "merchant-inventory", 0);
  const otherPurpose = await deriveRandomBytes(secret, "run_example", 4, "relic-draft", 0);
  const otherCounter = await deriveRandomBytes(secret, "run_example", 4, "merchant-inventory", 1);
  assert.equal(first.byteLength, 32);
  assert.deepEqual(first, again);
  assert.notDeepEqual(first, otherPurpose);
  assert.notDeepEqual(first, otherCounter);

  const source = await readFile(
    path.join(WORKER_ROOT, "src", "rulesets", "v08-meta-1", "rng.js"),
    "utf8"
  );
  assert.doesNotMatch(source, /Math\.random/u);
  assert.match(source, /HMAC/u);
  assert.match(source, /SHA-256/u);
});
