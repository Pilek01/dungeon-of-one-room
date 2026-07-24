import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import catalogDocument from "../src/rulesets/v08-meta-1/data/run-modifier-catalog.generated.json" with { type: "json" };
import effectsDocument from "../src/rulesets/v08-meta-1/data/run-modifier-effects.generated.json" with { type: "json" };
import metadataDocument from "../src/rulesets/v08-meta-1/data/run-modifier-metadata.generated.json" with { type: "json" };
import selectionDocument from "../src/rulesets/v08-meta-1/data/run-modifier-selection-policy.generated.json" with { type: "json" };
import otterPolicyDocument from "../src/rulesets/v08-meta-1/data/otter-relic-offer-policy.generated.json" with { type: "json" };
import regularPolicyDocument from "../src/rulesets/v08-meta-1/data/regular-relic-offer-policy.generated.json" with { type: "json" };
import startingPolicyDocument from "../src/rulesets/v08-meta-1/data/starting-relic-policy.generated.json" with { type: "json" };
import {
  assertMetaStateV08,
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import { calculateMultipliedGoldV08 } from "../src/rulesets/v08-meta-1/gold-policy.js";
import { createEmptyRelicBuildV08 } from "../src/rulesets/v08-meta-1/relic-policy.js";
import { createV08Meta1Ruleset } from "../src/rulesets/v08-meta-1/index.js";
import {
  applyCanonicalRunModifierSelection,
  assertCanonicalRunModifierDigestV08,
  assertCanonicalRunModifierLedgerV08,
  deriveRunModifierEffects,
  getFutureArenaRelicChoiceCountV08,
  projectLeaderboardRunModifiers,
  projectPublicRunModifiers
} from "../src/rulesets/v08-meta-1/run-modifiers.js";

const TEST_ROOT = path.dirname(fileURLToPath(import.meta.url));
const RULESET_ROOT = path.resolve(TEST_ROOT, "../src/rulesets/v08-meta-1");
const fixtures = JSON.parse(await readFile(
  path.join(RULESET_ROOT, "test", "phase3b2c1-golden-fixtures.json"),
  "utf8"
));
const catalog = catalogDocument.canonicalData;
const modifierIds = catalog.modifierIds;
const trustedContext = Object.freeze({ authority: "TRUSTED_RULESET_DOMAIN" });

function initial(runId = "phase3b2c1") {
  return createInitialMetaStateV08({}, {
    runId,
    season: "season-phase3b2c1",
    startedAt: 1_700_000_000_000
  });
}

async function selected(ids, runId = "phase3b2c1") {
  return applyCanonicalRunModifierSelection(initial(runId), {
    modifierIds: ids,
    activationSource: "server-issued-run-start"
  }, trustedContext);
}

async function rejectsSelection(ids, pattern, request = {}) {
  const state = initial();
  const before = structuredClone(state);
  await assert.rejects(
    applyCanonicalRunModifierSelection(state, {
      modifierIds: ids,
      activationSource: "server-issued-run-start",
      ...request
    }, trustedContext),
    pattern
  );
  assert.deepEqual(state, before);
}

const runners = {
  "empty-run-mod-ledger": async () => {
    const state = initial();
    assert.deepEqual(state.runModifiers.active, []);
    await assertCanonicalRunModifierDigestV08(state.runModifiers);
  },
  "one-legal-mutator": async () => {
    assert.equal((await selected(["greed"])).runModifiers.activeCount, 1);
  },
  "each-canonical-catalog-entry": async () => {
    for (const modifierId of modifierIds) {
      const state = await selected([modifierId], `catalog_${modifierId}`);
      assert.equal(state.runModifiers.active[0].modifierId, modifierId);
    }
  },
  "unknown-modifier-id": () => rejectsSelection(["unknown"], /RUN_MODIFIER_UNKNOWN/u),
  "client-only-modifier": () => rejectsSelection(["client_only"], /RUN_MODIFIER_UNKNOWN/u),
  "profile-scoped-modifier": () => rejectsSelection(["profile_unlock_state"], /RUN_MODIFIER_UNKNOWN/u),
  "first-legal-stack": async () => {
    assert.equal((await selected(["berserker"])).runModifiers.active[0].stacks, 1);
  },
  "exact-stack-cap": async () => {
    assert.ok(catalog.modifiers.every((entry) => entry.maximumStacks === 1));
  },
  "over-stack-cap": async () => {
    const ledger = structuredClone((await selected(["berserker"])).runModifiers);
    ledger.active[0].stacks = 2;
    assert.throws(() => assertCanonicalRunModifierLedgerV08(ledger), /RUN_MODIFIER_STACK_LIMIT/u);
  },
  "non-stackable-duplicate": () => rejectsSelection(
    ["ascension", "ascension"],
    /RUN_MODIFIER_SELECTION_DUPLICATE/u
  ),
  "mutual-exclusion-inventory": async () => {
    assert.ok(catalog.modifiers.every((entry) => entry.mutuallyExclusiveWith.length === 0));
  },
  "maximum-active-mutators": async () => {
    assert.equal((await selected(modifierIds.slice(0, 3))).runModifiers.activeCount, 3);
  },
  "over-active-limit": () => rejectsSelection(
    modifierIds.slice(0, 4),
    /RUN_MODIFIER_ACTIVE_LIMIT_EXCEEDED/u
  ),
  "canonical-digest": async () => {
    await assertCanonicalRunModifierDigestV08((await selected(["greed"])).runModifiers);
  },
  "digest-order-stability": async () => {
    const left = await selected(["greed", "ascension"], "order");
    const right = await selected(["ascension", "greed"], "order");
    assert.equal(left.runModifiers.modifierDigest, right.runModifiers.modifierDigest);
  },
  "save-round-trip": async () => {
    const state = await selected(["greed"]);
    assert.deepEqual(JSON.parse(JSON.stringify(state.runModifiers)), state.runModifiers);
  },
  "restart-determinism": async () => {
    assert.deepEqual(
      (await selected(["greed", "ascension"], "restart")).runModifiers,
      (await selected(["greed", "ascension"], "restart")).runModifiers
    );
  },
  "exact-retry": async () => {
    const state = await selected(["greed"]);
    const retry = await applyCanonicalRunModifierSelection(state, {
      modifierIds: ["greed"],
      activationSource: "server-issued-run-start"
    }, trustedContext);
    assert.deepEqual(retry, state);
  },
  "unknown-activation-source": () => rejectsSelection(
    ["greed"],
    /RUN_MODIFIER_ACTIVATION_SOURCE_UNKNOWN/u,
    { activationSource: "client" }
  ),
  "public-projection": async () => {
    const projection = projectPublicRunModifiers(await selected(["greed"]));
    assert.deepEqual(Object.keys(projection.active[0]).sort(), ["metadataId", "modifierId", "stacks"]);
    assert.equal(JSON.stringify(projection).includes("activationSource"), false);
  },
  "leaderboard-projection": async () => {
    const projection = projectLeaderboardRunModifiers(await selected(["greed"]));
    assert.deepEqual(projection, {
      modifiers: [{ modifierId: "greed", stacks: 1 }],
      flags: ["greed"]
    });
  },
  "derived-empty": async () => {
    const derived = deriveRunModifierEffects(initial().runModifiers);
    assert.equal(derived.extraRelicChoices, 0);
    assert.equal(derived.goldMultiplierAdditive, 0);
  },
  "derived-single": async () => {
    const derived = deriveRunModifierEffects((await selected(["greed"])).runModifiers);
    assert.equal(derived.goldMultiplierAdditive, 0.4);
    assert.equal(derived.enemyScalingModifiers.hpMultiplier, 1.2);
  },
  "derived-legal-combination": async () => {
    const derived = deriveRunModifierEffects(
      (await selected(["hunter", "resilience", "momentum"])).runModifiers
    );
    assert.ok(Math.abs(derived.goldMultiplierAdditive - 0.6) < Number.EPSILON);
    assert.equal(derived.enemyScalingModifiers.damageMultiplier, 1.25 * 1.2 * 1.15);
  },
  "fake-client-effects-ignored": async () => {
    const ledger = (await selected(["greed"])).runModifiers;
    const derived = deriveRunModifierEffects(ledger, {
      extraRelicChoices: 99,
      goldMultiplierAdditive: 99,
      mutators: ["ascension"]
    });
    assert.equal(derived.extraRelicChoices, 0);
    assert.equal(derived.goldMultiplierAdditive, 0.4);
  },
  "ascension-inactive": async () => {
    assert.equal(deriveRunModifierEffects(initial().runModifiers).extraRelicChoices, 0);
  },
  "ascension-active": async () => {
    assert.equal(
      deriveRunModifierEffects((await selected(["ascension"])).runModifiers).extraRelicChoices,
      1
    );
  },
  "ascension-duplicate": () => rejectsSelection(
    ["ascension", "ascension"],
    /RUN_MODIFIER_SELECTION_DUPLICATE/u
  ),
  "ascension-serialization": async () => {
    const restored = JSON.parse(JSON.stringify((await selected(["ascension"])).runModifiers));
    assert.equal(deriveRunModifierEffects(restored).extraRelicChoices, 1);
  },
  "arena-choice-count-three": async () => {
    assert.equal(getFutureArenaRelicChoiceCountV08(initial()), 3);
  },
  "arena-choice-count-four": async () => {
    assert.equal(getFutureArenaRelicChoiceCountV08(await selected(["ascension"])), 4);
  },
  "gold-without-mutator": async () => {
    assert.equal(calculateMultipliedGoldV08({
      canonicalBuild: createEmptyRelicBuildV08(),
      canonicalRunModifiers: initial().runModifiers,
      sourceId: "room-clear",
      baseAmount: 10
    }), 10);
  },
  "gold-with-active-mutator": async () => {
    assert.equal(calculateMultipliedGoldV08({
      canonicalBuild: createEmptyRelicBuildV08(),
      canonicalRunModifiers: (await selected(["greed"])).runModifiers,
      sourceId: "room-clear",
      baseAmount: 10
    }), 14);
  },
  "gold-rounding": async () => {
    assert.equal(calculateMultipliedGoldV08({
      canonicalBuild: createEmptyRelicBuildV08(),
      canonicalRunModifiers: (await selected(["berserker"])).runModifiers,
      sourceId: "room-clear",
      baseAmount: 3
    }), 4);
  },
  "gold-fake-client-mutator": async () => {
    const fakeBuild = { ...createEmptyRelicBuildV08(), mutators: ["greed"] };
    assert.equal(calculateMultipliedGoldV08({
      canonicalBuild: fakeBuild,
      canonicalRunModifiers: initial().runModifiers,
      sourceId: "room-clear",
      baseAmount: 10
    }), 10);
  },
  "starting-offer-regression": async () => {
    assert.equal(startingPolicyDocument.canonicalData.choiceCount, 3);
  },
  "warden-offer-regression": async () => {
    assert.equal(regularPolicyDocument.canonicalData.offerChoiceCount, 3);
    const runId = "ascension_warden";
    const context = {
      runId,
      season: "season-phase3b2c1",
      startedAt: 1_700_000_000_000,
      secret: "phase3b2c1:0123456789abcdef0123456789abcdef",
      randomOracle: {
        async deriveRandomBytes(options) {
          const purpose = Array.from(String(options.purpose || "")).reduce(
            (sum, character) => sum + character.codePointAt(0),
            0
          );
          return Uint8Array.from(
            { length: options.length },
            (_, index) => (purpose + Number(options.counter || 0) * 31 + index) & 255
          );
        },
        async deriveIntInclusive(minimum) {
          return minimum;
        }
      }
    };
    const ruleset = createV08Meta1Ruleset({
      secret: context.secret,
      randomOracle: context.randomOracle
    });
    let state = await ruleset.createRun({ startDepth: 0 }, context);
    state = await ruleset.selectStartingRelic(state, {
      offerId: state.pendingOffer.offerId,
      choiceId: state.pendingOffer.choices[0].choiceId
    }, context);
    state = await applyCanonicalRunModifierSelection(state, {
      modifierIds: ["ascension"],
      activationSource: "server-issued-run-start"
    }, { ...context, authority: "TRUSTED_RULESET_DOMAIN" });
    state.depth = 24;
    state.roomIndex = 24;
    state.currentRoomDirective = null;
    state.currentRewardEnvelope = null;
    state = await ruleset.issueRoomDirective(state, context);
    const slot = state.currentRewardEnvelope.rewardSlots[0];
    state = await ruleset.issueRegularRelicOffer(state, {
      rewardEnvelopeId: state.currentRewardEnvelope.envelopeId,
      rewardSlotId: slot.slotId,
      sourceDirectiveId: state.currentRoomDirective.directiveId
    }, context);
    assert.equal(state.pendingOffer.choices.length, 4);
  },
  "otter-offer-regression": async () => {
    assert.equal(otterPolicyDocument.canonicalData.offerChoiceCount, 9);
  },
  "arena-adapter-derived-only": async () => {
    const source = await readFile(path.join(RULESET_ROOT, "run-modifiers.js"), "utf8");
    const adapter = source.match(
      /export function getFutureArenaRelicChoiceCountV08[\s\S]*?\n\}/u
    )?.[0] || "";
    assert.match(adapter, /deriveRunModifierEffects/u);
    assert.doesNotMatch(adapter, /ascension|modifierId/u);
  },
  "ruleset-hash-mismatch": async () => {
    const state = initial();
    state.rulesetHash = "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    assert.throws(() => assertMetaStateV08(state), /RULESET_HASH_MISMATCH/u);
  }
};

test("Phase 3B2C1 has exactly 40 executable golden fixtures", () => {
  assert.equal(fixtures.length, 40);
  assert.deepEqual(fixtures.map((entry) => entry.fixtureId).sort(), Object.keys(runners).sort());
});

test("active baseline and canonical run modifier inventories are identical", () => {
  assert.deepEqual(metadataDocument.canonicalData.activeBaselineModifierIds, modifierIds);
  assert.deepEqual(
    effectsDocument.canonicalData.modifiers.map((entry) => entry.modifierId).sort(),
    modifierIds
  );
});

test("generated run-modifier documents are source-bound, stable, and schema-complete", () => {
  const documents = [
    catalogDocument,
    effectsDocument,
    metadataDocument,
    selectionDocument
  ];
  for (const document of documents) {
    assert.equal(document.rulesetId, "v08-meta-1");
    assert.equal(document.sourceCommit.length, 40);
    assert.ok(document.sources.length >= 2);
    assert.ok(document.sources.every((source) => /^[a-f0-9]{64}$/u.test(source.sha256)));
    assert.equal(Object.hasOwn(document, "generatedAt"), false);
  }
  const requiredFields = [
    "modifierId", "displayName", "modifierKind", "legacySourceFiles",
    "legacyFunctionOrSymbol", "scope", "unlockSource", "selectionMoment",
    "stackable", "maximumStacks", "mutuallyExclusiveWith", "gameplayEffects",
    "goldEffects", "rewardEffects", "relicOfferEffects",
    "roomGenerationEffects", "enemyEffects", "scoreEffects",
    "leaderboardMetadata", "profileDependency", "serverCanRepresentExactly",
    "implementedInThisPhase", "deferredReason", "sourceEvidence"
  ];
  for (const entry of catalog.modifiers) {
    for (const field of requiredFields) {
      assert.ok(Object.hasOwn(entry, field), `${entry.modifierId}:${field}`);
    }
  }
  assert.equal(selectionDocument.canonicalData.maximumActiveModifiers, 3);
});

for (const fixture of fixtures) {
  test(`golden 3B2C1: ${fixture.fixtureId}`, runners[fixture.fixtureId]);
}
