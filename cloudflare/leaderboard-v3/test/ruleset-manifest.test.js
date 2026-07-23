import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULESET_ROOT = path.join(WORKER_ROOT, "src", "rulesets", "v08-meta-1");

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

test("canonical ruleset manifest hashes every declared byte exactly", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(RULESET_ROOT, "data", "ruleset-manifest.json"), "utf8")
  );
  assert.equal(manifest.rulesetId, "v08-meta-1");
  assert.equal(manifest.status, "spec-only");
  assert.equal(manifest.manifestVersion, 1);
  assert.ok(manifest.files.length >= 15);

  for (const entry of manifest.files) {
    const bytes = await readFile(path.join(RULESET_ROOT, entry.file));
    assert.equal(entry.byteLength, bytes.byteLength, entry.file);
    assert.equal(entry.sha256, sha256(bytes), entry.file);
  }
  const hashInput = {
    manifestVersion: manifest.manifestVersion,
    rulesetId: manifest.rulesetId,
    files: manifest.files
  };
  assert.equal(manifest.rulesetHash, `sha256:${sha256(canonicalJson(hashInput))}`);
  assert.match(manifest.rulesetHash, /^sha256:[a-f0-9]{64}$/u);
});

test("source drift manifest references active baseline files only", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(RULESET_ROOT, "data", "generated-source-manifest.json"), "utf8")
  );
  const files = new Set(manifest.sources.map((source) => source.file));
  for (const required of [
    "game.js",
    "camp-data.js",
    "relic-data.js",
    "loot-tables.js",
    "mutator-data.js",
    "skills-data.js",
    "elixir-data.js",
    "merchant-curation.js",
    "forge-room.js",
    "pact-room.js",
    "pact-effects.js",
    "room-pity.js",
    "expansion-content.js",
    "boss-campaign.js"
  ]) {
    assert.ok(files.has(required), required);
  }
  for (const source of manifest.sources) {
    assert.doesNotMatch(source.file, /archive|archieve|Dungeon-v0\.8\.1-Vault-Guardian-Codex-Pack/iu);
    assert.match(source.sha256, /^[a-f0-9]{64}$/u);
    assert.ok(source.byteLength > 0);
    assert.ok(source.evidenceSymbols.length > 0);
  }
});
