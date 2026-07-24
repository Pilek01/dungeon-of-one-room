import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULESET_ROOT = path.join(WORKER_ROOT, "src", "rulesets", "v08-meta-1");
const DATA_ROOT = path.join(RULESET_ROOT, "data");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashInputFor(manifest, files = manifest.files) {
  return {
    manifestVersion: manifest.manifestVersion,
    rulesetId: manifest.rulesetId,
    status: manifest.status,
    sourceCommit: manifest.sourceCommit,
    schemas: [...manifest.schemas].sort((left, right) => left.file.localeCompare(right.file)),
    files: [...files].sort((left, right) => left.file.localeCompare(right.file))
  };
}

async function listFiles(root, relative = "") {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.posix.join(relative.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, child));
    else if (child !== "data/ruleset-manifest.json") files.push(child);
  }
  return files.sort();
}

test("canonical ruleset manifest hashes every module and data byte exactly", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(DATA_ROOT, "ruleset-manifest.json"), "utf8")
  );
  assert.equal(manifest.rulesetId, "v08-meta-1");
  assert.equal(manifest.status, "test-only");
  assert.equal(manifest.manifestVersion, 2);
  assert.equal(
    manifest.sourceCommit,
    "f98820c99066d810169e100beb23a54a332734bd"
  );

  const actualFiles = await listFiles(RULESET_ROOT);
  assert.deepEqual(manifest.files.map((entry) => entry.file), actualFiles);
  for (const entry of manifest.files) {
    const bytes = await readFile(path.join(RULESET_ROOT, entry.file));
    assert.equal(entry.byteLength, bytes.byteLength, entry.file);
    assert.equal(entry.sha256, sha256(bytes), entry.file);
  }
  const expectedHash = `sha256:${sha256(canonicalJson(hashInputFor(manifest)))}`;
  assert.equal(manifest.rulesetHash, expectedHash);
  assert.match(manifest.rulesetHash, /^sha256:[a-f0-9]{64}$/u);
});

test("ruleset hash is file-order independent and changes with any file byte", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(DATA_ROOT, "ruleset-manifest.json"), "utf8")
  );
  const forward = sha256(canonicalJson(hashInputFor(manifest)));
  const reverse = sha256(canonicalJson(hashInputFor(manifest, [...manifest.files].reverse())));
  assert.equal(forward, reverse);

  const changed = structuredClone(manifest.files);
  changed[0].sha256 = sha256(`${changed[0].sha256}:changed`);
  assert.notEqual(sha256(canonicalJson(hashInputFor(manifest, changed))), forward);
});

test("generated Phase 3B1, 3B2A and 3B2B1 data is canonical and source-bound", async () => {
  const names = [
    "source-manifest.generated.json",
    "run-progression.generated.json",
    "room-types.generated.json",
    "room-eligibility.generated.json",
    "special-room-policy.generated.json",
    "gold-sources.generated.json",
    "gold-modifiers.generated.json",
    "relic-catalog.generated.json",
    "relic-stack-policy.generated.json",
    "relic-slot-policy.generated.json",
    "starting-relic-policy.generated.json",
    "relic-build-metadata.generated.json",
    "room-reward-bounds.generated.json",
    "chest-reward-bounds.generated.json"
  ];
  for (const name of names) {
    const document = JSON.parse(await readFile(path.join(DATA_ROOT, name), "utf8"));
    assert.ok(Number.isSafeInteger(document.schemaVersion), name);
    assert.equal(document.rulesetId, "v08-meta-1", name);
    assert.equal(
      document.sourceCommit,
      "f98820c99066d810169e100beb23a54a332734bd",
      name
    );
    assert.ok(Array.isArray(document.sources) && document.sources.length > 0, name);
    for (const source of document.sources) {
      assert.doesNotMatch(source.file, /archive|archieve|pack|online-v2/iu);
      assert.match(source.sha256, /^[a-f0-9]{64}$/u);
      assert.ok(source.byteLength > 0);
    }
    assert.equal(Object.hasOwn(document, "generatedAt"), false, name);
  }
});

test("source manifest contains only active through Phase 3B2B2B1 baseline sources", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(DATA_ROOT, "source-manifest.generated.json"), "utf8")
  );
  assert.deepEqual(
    manifest.sources.map((source) => source.file),
    [
      "boss-campaign.js",
      "camp-data.js",
      "camp-runtime.js",
      "expansion-content.js",
      "forge-room.js",
      "game.js",
      "loot-tables.js",
      "merchant-curation.js",
      "mutator-data.js",
      "pact-room.js",
      "relic-data.js",
      "relic-runtime.js",
      "room-pity.js",
      "vault-room.js"
    ]
  );
  const forbiddenDeferredSources = [
    "skills-data.js",
    "elixir-data.js",
    "pact-effects.js"
  ];
  for (const forbidden of forbiddenDeferredSources) {
    assert.ok(!manifest.sources.some((source) => source.file === forbidden), forbidden);
  }
});
