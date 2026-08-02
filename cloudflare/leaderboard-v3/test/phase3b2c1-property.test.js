import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import catalogDocument from "../src/rulesets/v08-meta-1/data/run-modifier-catalog.generated.json" with { type: "json" };
import metadataDocument from "../src/rulesets/v08-meta-1/data/run-modifier-metadata.generated.json" with { type: "json" };
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { calculateMultipliedGoldV08 } from "../src/rulesets/v08-meta-1/gold-policy.js";
import { createEmptyRelicBuildV08 } from "../src/rulesets/v08-meta-1/relic-policy.js";
import {
  applyCanonicalRunModifierSelection,
  assertCanonicalRunModifierDigestV08,
  assertCanonicalRunModifierLedgerV08,
  deriveRunModifierEffects
} from "../src/rulesets/v08-meta-1/run-modifiers.js";

const TEST_ROOT = path.dirname(fileURLToPath(import.meta.url));
const RULESET_ROOT = path.resolve(TEST_ROOT, "../src/rulesets/v08-meta-1");
const catalog = catalogDocument.canonicalData;
const modifierIds = catalog.modifierIds;
const authority = Object.freeze({ authority: "TRUSTED_RULESET_DOMAIN" });

function initial(seed) {
  return createInitialMetaStateV08({}, {
    runId: `property_3b2c1_${seed}`,
    season: "season-phase3b2c1-property",
    startedAt: 1_700_000_000_000
  });
}

function selectionForSeed(seed) {
  let value = (seed * 2654435761) >>> 0;
  const pool = [...modifierIds];
  const count = value % 4;
  const result = [];
  for (let index = 0; index < count; index += 1) {
    value = (Math.imul(value ^ (value >>> 15), 2246822519) + index) >>> 0;
    result.push(pool.splice(value % pool.length, 1)[0]);
  }
  return result;
}

test("5000 seeded legal combinations preserve canonical run-modifier invariants", async () => {
  for (let seed = 1; seed <= 5_000; seed += 1) {
    const ids = selectionForSeed(seed);
    const base = initial(seed);
    const selected = await applyCanonicalRunModifierSelection(base, {
      modifierIds: ids,
      activationSource: "server-issued-run-start",
      clientDerivedEffects: { extraRelicChoices: 99 }
    }, authority);
    assertCanonicalRunModifierLedgerV08(selected.runModifiers);
    await assertCanonicalRunModifierDigestV08(selected.runModifiers);
    assert.equal(selected.runModifiers.activeCount, ids.length);
    assert.ok(selected.runModifiers.active.every((entry) => (
      modifierIds.includes(entry.modifierId) &&
      entry.stacks === 1
    )));
    assert.deepEqual(
      selected.runModifiers.active.map((entry) => entry.modifierId),
      [...ids].sort()
    );
    const derived = deriveRunModifierEffects(selected.runModifiers, {
      clientDerivedEffects: { extraRelicChoices: 99, goldMultiplierAdditive: 99 }
    });
    const repeated = deriveRunModifierEffects(selected.runModifiers);
    assert.deepEqual(derived, repeated);
    assert.ok([0, 1].includes(derived.extraRelicChoices));
    const restored = JSON.parse(JSON.stringify(selected));
    assert.deepEqual(deriveRunModifierEffects(restored.runModifiers), derived);
    const retry = await applyCanonicalRunModifierSelection(restored, {
      modifierIds: [...ids].reverse(),
      activationSource: "server-issued-run-start"
    }, authority);
    assert.deepEqual(retry, restored);
    const goldInput = {
      canonicalBuild: createEmptyRelicBuildV08(),
      canonicalRunModifiers: selected.runModifiers,
      sourceId: "room-clear",
      baseAmount: 7
    };
    assert.equal(
      calculateMultipliedGoldV08(goldInput),
      calculateMultipliedGoldV08(goldInput)
    );
  }
});

test("illegal selection cannot mutate gold, depth, lives or relic build", async () => {
  const state = initial("illegal");
  const before = structuredClone(state);
  await assert.rejects(
    applyCanonicalRunModifierSelection(state, {
      modifierIds: ["greed", "greed"],
      activationSource: "server-issued-run-start"
    }, authority),
    /RUN_MODIFIER_SELECTION_DUPLICATE/u
  );
  assert.deepEqual(
    {
      gold: state.gold,
      depth: state.depth,
      lives: state.lives,
      build: state.build
    },
    {
      gold: before.gold,
      depth: before.depth,
      lives: before.lives,
      build: before.build
    }
  );
});

test("scope classification is complete and binds canonical profile progression", () => {
  const rows = metadataDocument.canonicalData.scopeRows;
  assert.deepEqual(rows.map((entry) => entry.modifierId).sort(), modifierIds);
  assert.ok(rows.every((entry) => (
    entry.selectionScope === "RUN_SCOPED" &&
    entry.runtimeScope === "RUN_SCOPED" &&
    entry.deferredDependency === "NONE"
  )));
  assert.equal(metadataDocument.canonicalData.profileUnlockState, "CANONICAL_PROFILE_PROGRESS");
  assert.equal(metadataDocument.canonicalData.gameSessionState, "DEFERRED_GAME_SESSION_STATE");
});

test("gold and regular relic policies consume the shared derived projector", async () => {
  const goldSource = await readFile(path.join(RULESET_ROOT, "gold-policy.js"), "utf8");
  const relicSource = await readFile(path.join(RULESET_ROOT, "regular-relic-offer.js"), "utf8");
  assert.match(goldSource, /deriveRunModifierEffects/u);
  assert.match(relicSource, /deriveRunModifierEffects/u);
  for (const modifierId of modifierIds) {
    assert.doesNotMatch(goldSource, new RegExp(`includes\\("${modifierId}"\\)`, "u"));
    assert.doesNotMatch(relicSource, new RegExp(`includes\\("${modifierId}"\\)`, "u"));
  }
  assert.doesNotMatch(goldSource, /canonicalBuild\.mutators|build\.mutators/u);
});
