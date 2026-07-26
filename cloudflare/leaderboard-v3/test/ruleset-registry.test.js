import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_RELEASE_STATES,
  createRulesetRegistry
} from "../src/rulesets/registry.js";
import {
  V08_META_1_LOCAL_RELEASE_DESCRIPTOR
} from "../src/rulesets/releases.js";
import {
  V08_META_1_DESCRIPTOR,
  createV08Meta1Ruleset
} from "../src/rulesets/v08-meta-1/index.js";
import {
  chooseIndex,
  deriveIntInclusive,
  deriveRandomBytes,
  deriveShuffleOrder,
  deriveUint32
} from "../src/rulesets/v08-meta-1/rng.js";

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VECTOR_SECRET = "0123456789abcdef0123456789abcdef";
const VECTOR_INPUT = Object.freeze({
  secret: VECTOR_SECRET,
  rulesetId: "v08-meta-1",
  runId: "run_vector",
  revision: 7,
  purpose: "fixture-vector",
  counter: 3
});

function descriptor(
  hash,
  marker,
  status = RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
  options = {}
) {
  return {
    rulesetId: options.rulesetId || marker,
    rulesetHash: hash,
    status,
    ...(options.allowedEnvironments
      ? { allowedEnvironments: options.allowedEnvironments }
      : {}),
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

test("v08-meta-1 is recognized as test-only but cannot activate through registry", () => {
  const registry = createRulesetRegistry([V08_META_1_DESCRIPTOR]);
  assert.equal(registry.describe(V08_META_1_DESCRIPTOR.rulesetHash)?.status, "test-only");
  assert.throws(
    () => registry.resolve(V08_META_1_DESCRIPTOR.rulesetHash),
    /RULESET_NOT_RELEASED:test-only/u
  );
  const direct = createV08Meta1Ruleset({ secret: VECTOR_SECRET });
  assert.equal(direct.status, "test-only");
  assert.equal(direct.rulesetHash, V08_META_1_DESCRIPTOR.rulesetHash);
});

test("v08-meta-1 local release candidate resolves only for exact local binding", () => {
  const registry = createRulesetRegistry([V08_META_1_LOCAL_RELEASE_DESCRIPTOR]);
  const binding = {
    rulesetId: "v08-meta-1",
    rulesetHash: V08_META_1_DESCRIPTOR.rulesetHash,
    environment: "local",
    lifecycle: "ranked"
  };
  const resolved = registry.resolve(binding);
  assert.equal(resolved.rulesetId, "v08-meta-1");
  assert.equal(resolved.rulesetHash, V08_META_1_DESCRIPTOR.rulesetHash);
  assert.equal(
    registry.describe(binding)?.status,
    RULESET_RELEASE_STATES.LOCAL_RELEASE_CANDIDATE
  );
  assert.throws(
    () => registry.resolve({ ...binding, environment: "production" }),
    /RULESET_PRODUCTION_UNAVAILABLE/u
  );
  assert.throws(
    () => registry.resolve({ ...binding, rulesetId: "v08-meta-other" }),
    /RULESET_ID_UNSUPPORTED/u
  );
  const otherIdSameHash = {
    ...V08_META_1_LOCAL_RELEASE_DESCRIPTOR,
    rulesetId: "v08-meta-other",
    rulesetHash: `sha256:${"9".repeat(64)}`
  };
  const mismatched = createRulesetRegistry([
    V08_META_1_LOCAL_RELEASE_DESCRIPTOR,
    otherIdSameHash
  ]);
  assert.throws(
    () => mismatched.resolve({
      ...binding,
      rulesetId: "v08-meta-other"
    }),
    /RULESET_ID_HASH_MISMATCH/u
  );
});

test("registry separates fixture, test-only, local, production, and deprecated states", () => {
  const fixtureHash = `sha256:${"3".repeat(64)}`;
  const testHash = `sha256:${"4".repeat(64)}`;
  const localHash = `sha256:${"5".repeat(64)}`;
  const productionHash = `sha256:${"6".repeat(64)}`;
  const deprecatedHash = `sha256:${"7".repeat(64)}`;
  const registry = createRulesetRegistry([
    descriptor(fixtureHash, "fixture", RULESET_RELEASE_STATES.FIXTURE_TEST),
    descriptor(testHash, "test", RULESET_RELEASE_STATES.TEST_ONLY),
    descriptor(localHash, "local", RULESET_RELEASE_STATES.LOCAL_RELEASE_CANDIDATE),
    descriptor(productionHash, "production", RULESET_RELEASE_STATES.PRODUCTION_RELEASED),
    descriptor(deprecatedHash, "deprecated", RULESET_RELEASE_STATES.DEPRECATED)
  ]);
  assert.equal(
    registry.resolve({
      rulesetId: "fixture",
      rulesetHash: fixtureHash,
      environment: "test",
      lifecycle: "fixture"
    }).marker,
    "fixture"
  );
  assert.throws(
    () => registry.resolve({
      rulesetId: "fixture",
      rulesetHash: fixtureHash,
      environment: "test",
      lifecycle: "ranked"
    }),
    /FIXTURE_RULESET_RANKED_FORBIDDEN/u
  );
  assert.throws(
    () => registry.resolve({
      rulesetId: "test",
      rulesetHash: testHash,
      environment: "local",
      lifecycle: "ranked"
    }),
    /RULESET_NOT_RELEASED:test-only/u
  );
  assert.equal(
    registry.resolve({
      rulesetId: "local",
      rulesetHash: localHash,
      environment: "local",
      lifecycle: "ranked"
    }).marker,
    "local"
  );
  assert.equal(
    registry.resolve({
      rulesetId: "production",
      rulesetHash: productionHash,
      environment: "production",
      lifecycle: "ranked"
    }).marker,
    "production"
  );
  assert.throws(
    () => registry.resolve({
      rulesetId: "deprecated",
      rulesetHash: deprecatedHash,
      environment: "test",
      lifecycle: "fixture"
    }),
    /RULESET_DEPRECATED/u
  );
});

test("ruleset RNG matches deterministic HMAC-SHA-256 fixture vectors", async () => {
  const bytes = await deriveRandomBytes({ ...VECTOR_INPUT, length: 48 });
  assert.equal(
    Buffer.from(bytes).toString("hex"),
    "d66e43a706cb24ddb90989d22804e50df179a9cfaa9493af1c1c063d2cab5d79b64d0902b19e5538f839ce476471bdfd"
  );
  assert.equal(await deriveUint32(VECTOR_INPUT), 2455657910);
  assert.equal(await deriveIntInclusive(5, 5_000_000_000, VECTOR_INPUT), 3196366757);
  assert.equal(await chooseIndex(17, VECTOR_INPUT), 3);
  assert.deepEqual(await deriveShuffleOrder(8, VECTOR_INPUT), [1, 2, 6, 4, 0, 5, 7, 3]);
});

test("ruleset RNG validates boundaries and domain inputs", async () => {
  assert.deepEqual(
    await deriveRandomBytes({ ...VECTOR_INPUT, length: 0 }),
    new Uint8Array(0)
  );
  assert.equal((await deriveRandomBytes({ ...VECTOR_INPUT, length: 1 })).byteLength, 1);
  assert.equal(await deriveIntInclusive(99, 99, VECTOR_INPUT), 99);
  assert.ok(Number.isSafeInteger(
    await deriveIntInclusive(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, VECTOR_INPUT)
  ));
  await assert.rejects(
    deriveRandomBytes({ ...VECTOR_INPUT, secret: "short", length: 1 }),
    /RULESET_RNG_SECRET_INVALID/u
  );
  await assert.rejects(
    deriveRandomBytes({ ...VECTOR_INPUT, counter: -1, length: 1 }),
    /RULESET_RNG_COUNTER_INVALID/u
  );
  await assert.rejects(
    deriveRandomBytes({ ...VECTOR_INPUT, purpose: "", length: 1 }),
    /RULESET_RNG_PURPOSE_INVALID/u
  );
});

test("ruleset RNG separates purpose, run, revision, counter, and secret", async () => {
  const base = await deriveRandomBytes({ ...VECTOR_INPUT, length: 32 });
  for (const variant of [
    { purpose: "other-purpose" },
    { runId: "run_other" },
    { revision: VECTOR_INPUT.revision + 1 },
    { counter: VECTOR_INPUT.counter + 1 },
    { secret: "fedcba9876543210fedcba9876543210" }
  ]) {
    assert.notDeepEqual(
      await deriveRandomBytes({ ...VECTOR_INPUT, ...variant, length: 32 }),
      base
    );
  }
  const source = await readFile(
    path.join(WORKER_ROOT, "src", "rulesets", "v08-meta-1", "rng.js"),
    "utf8"
  );
  assert.doesNotMatch(source, /Math\.random|Date\.now/u);
  assert.match(source, /HMAC/u);
  assert.match(source, /SHA-256/u);
  assert.doesNotMatch(source, /console\./u);
});
