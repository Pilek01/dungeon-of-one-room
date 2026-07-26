import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import auditDocument from "../src/rulesets/v08-meta-1/data/special-relic-source-audit.generated.json" with { type: "json" };
import deferredDocument from "../src/rulesets/v08-meta-1/data/deferred-special-relic-spec.generated.json" with { type: "json" };
import classificationDocument from "../src/rulesets/v08-meta-1/data/vault-arena-relic-classification.generated.json" with { type: "json" };

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(WORKER_ROOT, "..", "..");
const RULESET_ROOT = path.join(WORKER_ROOT, "src", "rulesets", "v08-meta-1");
const fixtures = JSON.parse(await readFile(
  path.join(RULESET_ROOT, "test", "phase3b2b2b2-classification-fixtures.json"),
  "utf8"
));
const gameSource = await readFile(path.join(REPO_ROOT, "game.js"), "utf8");
const lootSource = await readFile(path.join(REPO_ROOT, "loot-tables.js"), "utf8");
const vaultSource = await readFile(path.join(REPO_ROOT, "vault-room.js"), "utf8");
const expansionSource = await readFile(path.join(REPO_ROOT, "expansion-content.js"), "utf8");
const metaStateSource = await readFile(path.join(RULESET_ROOT, "meta-state.js"), "utf8");
const generatorSource = await readFile(
  path.join(REPO_ROOT, "scripts", "generate-online-v3-meta-rules.mjs"),
  "utf8"
);

function source(sourceId) {
  return auditDocument.canonicalData.sources.find((entry) => entry.sourceId === sourceId);
}

function deferred(sourceId) {
  return deferredDocument.canonicalData.sources.find((entry) => entry.sourceId === sourceId);
}

function functionSlice(text, functionName) {
  const matches = [...text.matchAll(/function\s+([a-zA-Z0-9_]+)\s*\(/gu)];
  const index = matches.findIndex((match) => match[1] === functionName);
  assert.notEqual(index, -1, functionName);
  return text.slice(matches[index].index, matches[index + 1]?.index ?? text.length);
}

test("Phase 3B2B2B2 has exactly 14 honest classification fixtures", () => {
  assert.equal(fixtures.length, 14);
  assert.equal(new Set(fixtures.map((fixture) => fixture.fixtureId)).size, 14);
  for (const fixture of fixtures) {
    assert.deepEqual(
      Object.keys(fixture),
      ["fixtureId", "sourceId", "expectedClassification", "evidence", "expected"]
    );
    assert.ok(fixture.evidence);
    assert.ok(fixture.expected);
  }
});

test("Vault is mechanically NOT_AN_ACTIVE_RELIC_SOURCE", () => {
  const vault = source("vault-standard-chest");
  assert.equal(vault.deferredReason, "NOT_AN_ACTIVE_RELIC_SOURCE");
  assert.equal(vault.sourceCategory, "not_active_relic_source");
  assert.equal(vault.offerChoiceCount, 0);
  assert.deepEqual(vault.candidatePool, []);
  assert.equal(vault.rarityPolicy, null);
  assert.equal(vault.serverCanIssueExactly, false);
  assert.equal(deferred("vault-standard-chest").status, "NOT_AN_ACTIVE_RELIC_SOURCE");
  assert.equal(
    classificationDocument.canonicalData.vault.classification,
    "NOT_AN_ACTIVE_RELIC_SOURCE"
  );
});

test("Vault active outcome and relic-offer call graphs are closed and guarded", () => {
  const outcomes = new Set(["trap"]);
  for (const match of lootSource.matchAll(/outcome\s*=\s*"([^"]+)"/gu)) outcomes.add(match[1]);
  assert.deepEqual(
    [...outcomes].sort(),
    ["armor", "attack", "gold", "healing", "health", "map_fragment", "potion", "trap"]
  );
  assert.doesNotMatch(lootSource, /\brelic\b/iu);
  assert.doesNotMatch(vaultSource, /\brelic\b/iu);
  const openChest = functionSlice(gameSource, "openChest");
  assert.match(openChest, /lootTablesApi\.rollChestOutcome/u);
  assert.doesNotMatch(openChest, /chest\.type\s*===\s*"vault"/u);
  assert.match(generatorSource, /VAULT_RELIC_SOURCE_REVIEW_REQUIRED/u);
  assert.match(generatorSource, /RELIC_DRAFT_BUILDERS/u);
  assert.match(generatorSource, /OPEN_CHEST_DISPATCH/u);
});

test("Arena dependencies are resolved without implementing its offer", () => {
  const arena = source("arena-reward-cache");
  assert.equal(arena.sourceCategory, "special_room_reward");
  assert.equal(arena.deferredReason, "READY_FOR_IMPLEMENTATION");
  assert.equal(arena.serverCanIssueExactly, true);
  assert.equal(deferred("arena-reward-cache").status, "READY_FOR_IMPLEMENTATION");
  assert.equal(
    classificationDocument.canonicalData.arena.classification,
    "READY_FOR_IMPLEMENTATION"
  );
});

test("Arena lifecycle, eligibility, rarity, count and fallback evidence stays exact", () => {
  const classification = classificationDocument.canonicalData.arena;
  assert.equal(classification.minimumDepth, 40);
  assert.equal(classification.maximumDepth, 99);
  assert.equal(classification.completionCondition, "all 2 waves cleared; no enemies remain");
  assert.equal(classification.offerChoiceCount, "3 + extraRelicChoices (3 normally; 4 with Ascension)");
  assert.deepEqual(classification.allowedRarities, ["rare", "epic", "legendary", "mythic"]);
  assert.equal(classification.pityPolicy.rewardOfferPity, "NONE");
  assert.equal(classification.replacementBehavior, "CANONICAL_GLOBAL_REPLACEMENT_TRANSACTION");
  assert.match(expansionSource, /arena:\s*Object\.freeze\(\{[\s\S]*?minDepth:\s*40/u);
  assert.match(gameSource, /const ARENA_WAVE_COUNT = 2;/u);
  assert.match(functionSlice(gameSource, "spawnArenaRewardChest"), /3 \+ \(state\.runMods\.extraRelicChoices \|\| 0\)/u);
  assert.match(functionSlice(gameSource, "spawnArenaRewardChest"), /type:\s*"arena_reward"/u);
  assert.match(functionSlice(gameSource, "openStoredRelicChest"), /grantGold\(60\)/u);
});

test("Arena fallback dependencies remain resolved after the disconnected test-only policy is added", async () => {
  assert.match(metaStateSource, /runModifiers:\s*createEmptyRunModifierLedgerV08/u);
  assert.deepEqual(
    classificationDocument.canonicalData.arena.dependencyStatus,
    {
      canonicalRunModifierState: "RESOLVED",
      extraRelicChoicesProjection: "RESOLVED",
      globalRelicReplacementTransaction: "RESOLVED",
      emptyPoolPolicy: "RESOLVED",
      staleRewardPolicy: "RESOLVED",
      noLegalReplacementFallback: "RESOLVED",
      replacementRewardFallback: "RESOLVED"
    }
  );
  assert.deepEqual(classificationDocument.canonicalData.arena.exactIssuanceBlockers, []);
  const draft = functionSlice(gameSource, "buildRelicDraftChoices");
  const choose = functionSlice(gameSource, "chooseRelic");
  assert.doesNotMatch(draft, /canAcquireRelic|slotLimit|MAX_RELICS/u);
  assert.match(choose, /relicSwapPending/u);
  const files = await readdir(path.join(RULESET_ROOT, "data"));
  assert.equal(files.includes("arena-relic-offer-policy.generated.json"), true);
  const arenaPolicy = JSON.parse(await readFile(
    path.join(RULESET_ROOT, "data", "arena-relic-offer-policy.generated.json"),
    "utf8"
  ));
  assert.equal(
    arenaPolicy.canonicalData.implementationStatus,
    "phase-3b2c3b-disconnected-test-only"
  );
  const rewardPolicy = await readFile(path.join(RULESET_ROOT, "reward-policy.js"), "utf8");
  assert.match(rewardPolicy, /arenaRelicOfferPolicy|arena-relic-offer-policy/u);
});

for (const fixture of fixtures) {
  test(`classification fixture: ${fixture.fixtureId}`, () => {
    const record = fixture.sourceId === "vault-standard-chest"
      ? classificationDocument.canonicalData.vault
      : classificationDocument.canonicalData.arena;
    assert.equal(record.classification, fixture.expectedClassification);
  });
}
