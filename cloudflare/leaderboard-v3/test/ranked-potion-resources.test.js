import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPotionResourceTransitionV08,
  assertCanonicalPotionResourcesV08,
  derivePotionMaximumV08,
  initializePotionResourcesV08
} from "../src/rulesets/v08-meta-1/index.js";

test("derives canonical potion maximum from base, Satchel, modifiers, and Flask stacks", () => {
  for (const row of [
    { name: "base", baseMaximum: 3, satchelLevel: 0, modifierMaximumSlotsAdditive: 0, flaskStacks: 0, expected: 3 },
    { name: "satchel+alchemist", baseMaximum: 3, satchelLevel: 2, modifierMaximumSlotsAdditive: 2, flaskStacks: 0, expected: 7 },
    { name: "famine floor", baseMaximum: 3, satchelLevel: 0, modifierMaximumSlotsAdditive: -3, flaskStacks: 0, expected: 1 },
    { name: "all sources", baseMaximum: 3, satchelLevel: 2, modifierMaximumSlotsAdditive: -1, flaskStacks: 5, expected: 9 }
  ]) {
    assert.equal(derivePotionMaximumV08(row), row.expected, row.name);
  }
});

test("rejects malformed or unsafe potion capacity inputs", () => {
  for (const input of [
    { baseMaximum: 1.5 },
    { satchelLevel: Number.MAX_SAFE_INTEGER + 1 },
    { modifierMaximumSlotsAdditive: Number.NaN },
    { flaskStacks: -1 },
    { flaskStacks: 6 },
    { baseMaximum: Number.MAX_SAFE_INTEGER, satchelLevel: 1 }
  ]) {
    assert.throws(() => derivePotionMaximumV08(input), TypeError);
  }
});

test("initializes current potions before clamping against final capacity", () => {
  assert.deepEqual(
    initializePotionResourcesV08({
      baseMaximum: 3,
      satchelLevel: 0,
      modifierMaximumSlotsAdditive: -1,
      startingPotionsAdditive: 2,
      flaskStacks: 0
    }),
    { potions: 2, maxPotions: 2 }
  );
  assert.deepEqual(
    initializePotionResourcesV08({
      baseMaximum: 3,
      satchelLevel: 2,
      modifierMaximumSlotsAdditive: 0,
      startingPotionsAdditive: 0,
      flaskStacks: 5
    }),
    { potions: 5, maxPotions: 10 }
  );
});
test("initialization is independent of modifier selection order for equivalent effects", () => {
  const alchemistThenFamine = initializePotionResourcesV08({
    baseMaximum: 3,
    satchelLevel: 0,
    modifierMaximumSlotsAdditive: 2 - 3,
    startingPotionsAdditive: 2,
    flaskStacks: 0
  });
  const famineThenAlchemist = initializePotionResourcesV08({
    flaskStacks: 0,
    startingPotionsAdditive: 2,
    modifierMaximumSlotsAdditive: -3 + 2,
    satchelLevel: 0,
    baseMaximum: 3
  });
  assert.deepEqual(famineThenAlchemist, alchemistThenFamine);
});

test("applies an absolute maximum and only the transition grant", () => {
  const resources = { potions: 2, maxPotions: 3, highestUnlockedDepth: 4 };
  const next = applyPotionResourceTransitionV08(resources, {
    nextMaximum: 4,
    currentGrant: 3
  });
  assert.deepEqual(next, { potions: 4, maxPotions: 4, highestUnlockedDepth: 4 });
  assert.deepEqual(resources, { potions: 2, maxPotions: 3, highestUnlockedDepth: 4 });
});

test("does not refill on reprojection and clamps current above a reduced maximum", () => {
  const resources = { potions: 4, maxPotions: 5 };
  assert.deepEqual(
    applyPotionResourceTransitionV08(resources, { nextMaximum: 2, currentGrant: 0 }),
    { potions: 2, maxPotions: 2 }
  );
  assert.deepEqual(
    applyPotionResourceTransitionV08(resources, { nextMaximum: 5, currentGrant: 0 }),
    { potions: 4, maxPotions: 5 }
  );
});

test("asserts canonical potion resources without mutating them", () => {
  const resources = { potions: 2, maxPotions: 3 };
  assert.equal(assertCanonicalPotionResourcesV08(resources, 3), resources);
  assert.deepEqual(resources, { potions: 2, maxPotions: 3 });
  assert.throws(() => assertCanonicalPotionResourcesV08({ potions: 4, maxPotions: 3 }, 3), TypeError);
  assert.throws(() => assertCanonicalPotionResourcesV08({ potions: -1, maxPotions: 3 }, 3), TypeError);
  assert.throws(() => assertCanonicalPotionResourcesV08(resources, 2), TypeError);
});
