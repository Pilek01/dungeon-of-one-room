import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(WORKER_ROOT, "..", "..");
const RULESET_ROOT = path.join(WORKER_ROOT, "src", "rulesets", "v08-meta-1");
const DOCS_ROOT = path.join(REPO_ROOT, "docs");

const MATRIX_FIELDS = Object.freeze([
  "featureId",
  "legacySourceFile",
  "legacyFunctionOrData",
  "description",
  "inputDependencies",
  "authorityClass",
  "serverCanDeriveExactly",
  "clientMustReport",
  "maximumBoundKnown",
  "tamperImpact",
  "leaderboardImpact",
  "recommendedValidation",
  "recommendedStorage",
  "notes"
]);

const AUTHORITY_CLASSES = new Set([
  "SERVER_DERIVED",
  "SERVER_ISSUED",
  "BOUNDED_CLIENT_ATTESTED",
  "HEURISTIC_ONLY",
  "CLIENT_ONLY"
]);

async function authorityRows() {
  const markdown = await readFile(
    path.join(DOCS_ROOT, "ONLINE_V3_RULESET_AUTHORITY_MATRIX.md"),
    "utf8"
  );
  const match = /```jsonl\r?\n([\s\S]*?)\r?\n```/u.exec(markdown);
  assert.ok(match, "authority matrix JSONL block");
  return match[1].split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
}

test("authority matrix is complete, unique, and covers every audit family", async () => {
  const rows = await authorityRows();
  assert.ok(rows.length >= 80, `expected at least 80 audited rules, got ${rows.length}`);
  const ids = new Set();
  for (const row of rows) {
    assert.deepEqual(Object.keys(row), MATRIX_FIELDS, row.featureId);
    assert.ok(!ids.has(row.featureId), `duplicate ${row.featureId}`);
    ids.add(row.featureId);
    assert.ok(AUTHORITY_CLASSES.has(row.authorityClass), row.featureId);
    assert.equal(typeof row.serverCanDeriveExactly, "boolean", row.featureId);
    for (const field of MATRIX_FIELDS.filter((name) => !["serverCanDeriveExactly"].includes(name))) {
      assert.notEqual(row[field], "", `${row.featureId}:${field}`);
    }
  }
  for (const prefix of [
    "run.",
    "campaign.",
    "room.",
    "gold.",
    "spend.",
    "reward.",
    "build.",
    "merchant.",
    "camp.",
    "forge.",
    "pact.",
    "life.",
    "score.",
    "leaderboard.",
    "progress.",
    "combat."
  ]) {
    assert.ok(rows.some((row) => row.featureId.startsWith(prefix)), prefix);
  }
  for (const authorityClass of AUTHORITY_CLASSES) {
    assert.ok(rows.some((row) => row.authorityClass === authorityClass), authorityClass);
  }
});

test("golden fixture manifest and corpus follow the Phase 3B1 schema", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(RULESET_ROOT, "data", "golden-fixtures.manifest.json"), "utf8")
  );
  const fixtures = JSON.parse(
    await readFile(path.join(RULESET_ROOT, "test", "phase3b1-golden-fixtures.json"), "utf8")
  );
  assert.equal(manifest.rulesetId, "v08-meta-1");
  assert.equal(manifest.status, "test-only");
  assert.equal(manifest.phase, "3B1");
  assert.equal(manifest.scenarios.length, 25);
  assert.equal(new Set(manifest.scenarios).size, 25);
  assert.equal(fixtures.length, 25);
  const required = manifest.requiredFixtureFields;
  for (const fixture of fixtures) {
    assert.deepEqual(Object.keys(fixture), required, fixture.fixtureId);
    assert.ok(fixture.sourceEvidence.length > 0);
    assert.ok(manifest.scenarios.includes(fixture.fixtureId));
    assert.equal(fixture.expectedRulesetHash, "manifest.rulesetHash");
  }
});

test("generator --check detects no generated data drift", () => {
  const output = execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, "scripts", "generate-online-v3-meta-rules.mjs"), "--check"],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
  assert.match(output, /generator check: PASS/u);
});

test("Phase 3A documentation uses the narrow verification contract consistently", async () => {
  const names = (await readdir(DOCS_ROOT)).filter((name) => name.startsWith("ONLINE_V3_"));
  const documents = await Promise.all(names.map((name) => readFile(path.join(DOCS_ROOT, name), "utf8")));
  const combined = documents.join("\n");
  assert.match(combined, /Checkpoint Verified/u);
  assert.match(combined, /checkpoint_verified_v3/u);
  assert.doesNotMatch(combined, /Fully Verified|Server-authoritative combat|Cheat-proof/u);
  assert.match(combined, /Combat (runs|stays) local/u);
  assert.match(combined, /not a complete anti-cheat/u);
});

test("ruleset remains disconnected from active Worker while M4 client is explicitly loaded", async () => {
  const workerIndex = await readFile(path.join(WORKER_ROOT, "src", "index.js"), "utf8");
  const fixtureEntry = await readFile(path.join(WORKER_ROOT, "src", "local-fixture-entry.js"), "utf8");
  const gameIndex = await readFile(path.join(REPO_ROOT, "index.html"), "utf8");
  assert.doesNotMatch(workerIndex, /rulesets\/registry|v08-meta-1/u);
  assert.match(fixtureEntry, /test\/fixtures\/fixture-ruleset\.js/u);
  assert.match(gameIndex, /online-v3\/ranked-v3-runtime\.js/iu);
  assert.doesNotMatch(gameIndex, /cloudflare\/leaderboard-v3|src\/local-ruleset-entry/iu);
});
