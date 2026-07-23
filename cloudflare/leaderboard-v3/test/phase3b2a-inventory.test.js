import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(WORKER_ROOT, "..", "..");
const DATA_ROOT = path.join(WORKER_ROOT, "src", "rulesets", "v08-meta-1", "data");
const inventory = JSON.parse(await readFile(
  path.join(DATA_ROOT, "gold-sources.generated.json"),
  "utf8"
));

const REQUIRED_FIELDS = [
  "sourceId",
  "legacySourceFile",
  "legacyFunctionOrConstant",
  "authorityClass",
  "calculationInputs",
  "serverKnownInputs",
  "clientAttestedInputs",
  "maximumPerRoomKnown",
  "maximumPerRunKnown",
  "stackingRules",
  "roundingRules",
  "appliedOrder",
  "eligibleRoomTypes",
  "generatedDataRef",
  "notes"
];

test("gold source inventory is complete, classified, and source-bound", async () => {
  const entries = inventory.canonicalData.goldSources;
  assert.equal(entries.length, 26);
  assert.equal(new Set(entries.map((entry) => entry.sourceId)).size, entries.length);
  for (const entry of entries) {
    assert.deepEqual(Object.keys(entry), REQUIRED_FIELDS, entry.sourceId);
    assert.ok([
      "SERVER_DERIVED",
      "SERVER_ISSUED",
      "BOUNDED_CLIENT_ATTESTED",
      "HEURISTIC_ONLY",
      "CLIENT_ONLY"
    ].includes(entry.authorityClass), entry.sourceId);
    assert.ok(entry.legacySourceFile && entry.legacyFunctionOrConstant, entry.sourceId);
  }
  for (const requiredId of [
    "enemy-kill",
    "elite-kill",
    "boss-kill",
    "chest-gold",
    "room-clear",
    "merchant-buyback",
    "shrine-direct-gold",
    "vault-chest-bonus",
    "otter-crimson-empty",
    "arena-cache-empty",
    "pact-room-direct-gold",
    "forge-direct-gold",
    "crossroads-power-empty",
    "extract-transfer",
    "terminal-victory-direct-gold",
    "elite-affix-direct-gold",
    "void-reaper-crit-kill",
    "chaos-orb-gold-roll"
  ]) {
    assert.ok(entries.some((entry) => entry.sourceId === requiredId), requiredId);
  }

  const gameSource = await readFile(path.join(REPO_ROOT, "game.js"), "utf8");
  const activeCalls = Array.from(
    gameSource.matchAll(/\bgrantGold\(([^;\r\n]*)\)/gu),
    (match) => match[1].replace(/\s+/gu, " ").trim()
  ).filter((argument) => argument !== "amount, options = {}").sort();
  assert.deepEqual(activeCalls, inventory.canonicalData.grantGoldCallArguments);
});

test("generated gold documents carry active source hashes and no timestamp", async () => {
  for (const name of [
    "gold-sources.generated.json",
    "gold-modifiers.generated.json",
    "room-reward-bounds.generated.json",
    "chest-reward-bounds.generated.json"
  ]) {
    const document = JSON.parse(await readFile(path.join(DATA_ROOT, name), "utf8"));
    assert.equal(document.rulesetId, "v08-meta-1");
    assert.equal(Object.hasOwn(document, "generatedAt"), false);
    assert.ok(document.sources.length > 0);
    for (const source of document.sources) {
      assert.match(source.sha256, /^[a-f0-9]{64}$/u);
      assert.ok(source.byteLength > 0);
    }
  }
});

test("deferred offers and transactions are inventory-only", () => {
  const byId = new Map(
    inventory.canonicalData.goldSources.map((entry) => [entry.sourceId, entry])
  );
  for (const id of [
    "merchant-buyback",
    "merchant-spend",
    "crossroads-power-empty",
    "crossroads-mercy-avarice",
    "arena-cache-empty",
    "otter-crimson-empty"
  ]) {
    assert.match(byId.get(id).notes, /deferred|not implemented|Inventory only/iu);
  }
});
