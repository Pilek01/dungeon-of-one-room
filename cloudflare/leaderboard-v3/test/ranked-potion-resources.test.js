import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  applyPotionResourceTransitionV08,
  assertCanonicalPotionResourcesV08,
  derivePotionMaximumV08,
  initializePotionResourcesV08
} from "../src/rulesets/v08-meta-1/index.js";
import {
  applyCanonicalRunModifierSelection,
  projectPublicRunModifiers
} from "../src/rulesets/v08-meta-1/run-modifiers.js";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  hydrateRunFromProfileV08,
  profileStateFromRunV08
} from "../src/rulesets/v08-meta-1/profile-policy.js";
import {
  applyRelicAcquisition,
  applyRelicRemovalV08,
  applyRelicReplacementBuildV08,
  createEmptyRelicBuildV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";

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
function relicAcquisition(relicId, acquiredRevision = 0) {
  return {
    relicId,
    acquiredRevision,
    acquisitionSource: "fixture",
    sourceOfferId: `fixture_${relicId}_${acquiredRevision}`
  };
}

test("acquiring Flask stacks atomically grants one potion per new capacity slot", async () => {
  let build = createEmptyRelicBuildV08();
  build = await applyRelicAcquisition(build, relicAcquisition("flask"));
  assert.equal(build.resources.maxPotions, 4);
  assert.equal(build.resources.potions, 4);
  for (let revision = 1; revision < 5; revision += 1) {
    build = await applyRelicAcquisition(build, relicAcquisition("flask", revision));
  }
  assert.equal(build.relics.find((entry) => entry.relicId === "flask").stacks, 5);
  assert.equal(build.resources.maxPotions, 8);
  assert.equal(build.resources.potions, 8);
});

test("non-Flask acquisition leaves canonical potion resources unchanged", async () => {
  const build = createEmptyRelicBuildV08();
  const next = await applyRelicAcquisition(build, relicAcquisition("fang"));
  assert.deepEqual(next.resources, build.resources);
});

test("removing one Flask stack reduces capacity and clamps current potions", async () => {
  let build = createEmptyRelicBuildV08();
  build = await applyRelicAcquisition(build, relicAcquisition("flask"));
  build = await applyRelicAcquisition(build, relicAcquisition("flask", 1));
  const removed = await applyRelicRemovalV08(build, { relicId: "flask", stacks: 1 });
  assert.equal(removed.resources.maxPotions, 4);
  assert.equal(removed.resources.potions, 4);
  const partiallyUsed = structuredClone(build);
  partiallyUsed.resources.potions = 2;
  const usedRemoval = await applyRelicRemovalV08(partiallyUsed, { relicId: "flask", stacks: 1 });
  assert.equal(usedRemoval.resources.maxPotions, 4);
  assert.equal(usedRemoval.resources.potions, 2);
});

test("replacement applies only the net Flask stack delta", async () => {
  let flaskBuild = createEmptyRelicBuildV08();
  flaskBuild = await applyRelicAcquisition(flaskBuild, relicAcquisition("flask"));
  const flaskToOther = await applyRelicReplacementBuildV08(
    flaskBuild,
    [{ relicId: "flask", stacks: 1 }],
    relicAcquisition("fang", 1)
  );
  assert.equal(flaskToOther.resources.maxPotions, 3);
  assert.equal(flaskToOther.resources.potions, 3);

  let otherBuild = createEmptyRelicBuildV08();
  otherBuild = await applyRelicAcquisition(otherBuild, relicAcquisition("fang"));
  const otherToFlask = await applyRelicReplacementBuildV08(
    otherBuild,
    [{ relicId: "fang", stacks: 1 }],
    relicAcquisition("flask", 1)
  );
  assert.equal(otherToFlask.resources.maxPotions, 4);
  assert.equal(otherToFlask.resources.potions, 4);

  const unchanged = await applyRelicReplacementBuildV08(
    otherBuild,
    [{ relicId: "fang", stacks: 1 }],
    relicAcquisition("plating", 1)
  );
  assert.equal(unchanged.resources.maxPotions, 3);
  assert.equal(unchanged.resources.potions, 3);
});

test("Flask stack six is rejected before canonical mutation", async () => {
  let build = createEmptyRelicBuildV08();
  for (let revision = 0; revision < 5; revision += 1) {
    build = await applyRelicAcquisition(build, relicAcquisition("flask", revision));
  }
  const before = structuredClone(build);
  await assert.rejects(
    applyRelicAcquisition(build, relicAcquisition("flask", 5)),
    /RELIC_STACK_LIMIT_REACHED:flask/u
  );
  assert.deepEqual(build, before);
});

function modifierState(runId = "potion-transition") {
  return createInitialMetaStateV08({}, {
    runId,
    season: "potion-tests",
    startedAt: 1_900_000_000_000,
    cryptoProvider: webcrypto
  });
}

test("run-start Alchemist and Famine effects initialize canonical potions", async () => {
  const alchemist = await applyCanonicalRunModifierSelection(
    modifierState("potion-alchemist"),
    { modifierIds: ["alchemist"], activationSource: "server-issued-run-start" },
    { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto }
  );
  assert.deepEqual(
    { potions: alchemist.build.resources.potions, maxPotions: alchemist.build.resources.maxPotions },
    { potions: 5, maxPotions: 5 }
  );

  const both = await applyCanonicalRunModifierSelection(
    modifierState("potion-both"),
    { modifierIds: ["famine", "alchemist"], activationSource: "server-issued-run-start" },
    { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto }
  );
  assert.deepEqual(
    { potions: both.build.resources.potions, maxPotions: both.build.resources.maxPotions },
    { potions: 2, maxPotions: 2 }
  );
});

test("mid-run modifier transitions change capacity without reconstructing current potions", async () => {
  let state = modifierState("potion-mid-run");
  state = await applyCanonicalRunModifierSelection(
    state,
    { modifierIds: ["alchemist"], activationSource: "server-issued-mid-run" },
    { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto }
  );
  assert.deepEqual(
    { potions: state.build.resources.potions, maxPotions: state.build.resources.maxPotions },
    { potions: 3, maxPotions: 5 }
  );
  state = await applyCanonicalRunModifierSelection(
    state,
    { modifierIds: ["alchemist", "famine"], activationSource: "server-issued-mid-run" },
    { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto }
  );
  assert.deepEqual(
    { potions: state.build.resources.potions, maxPotions: state.build.resources.maxPotions },
    { potions: 2, maxPotions: 2 }
  );
});

test("profile hydration applies modifier effects and carried Flask once", async () => {
  let source = modifierState("potion-profile-source");
  source = await applyCanonicalRunModifierSelection(
    source,
    { modifierIds: ["alchemist"], activationSource: "server-issued-run-start" },
    { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto }
  );
  source.status = "extraction";
  source.build = await applyRelicAcquisition(source.build, relicAcquisition("flask", 0));
  source.build = await applyRelicAcquisition(source.build, relicAcquisition("flask", 1));
  source.build.campUpgrades = { satchel: 1 };
  const profile = profileStateFromRunV08(source, "potion-profile", 1);
  const hydrated = await hydrateRunFromProfileV08(
    modifierState("potion-profile-next"),
    profile,
    { cryptoProvider: webcrypto }
  );
  assert.deepEqual(
    { potions: hydrated.build.resources.potions, maxPotions: hydrated.build.resources.maxPotions },
    { potions: 6, maxPotions: 8 }
  );
  const repeated = await hydrateRunFromProfileV08(
    modifierState("potion-profile-repeat"),
    profile,
    { cryptoProvider: webcrypto }
  );
  assert.deepEqual(repeated.build.resources, hydrated.build.resources);
});

test("public modifier projection exposes an immutable potion modifier summary", async () => {
  let state = modifierState("potion-public");
  state = await applyCanonicalRunModifierSelection(
    state,
    { modifierIds: ["alchemist", "famine"], activationSource: "server-issued-run-start" },
    { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto }
  );
  const projection = projectPublicRunModifiers(state);
  assert.deepEqual(projection.summary.potionModifiers, {
    maximumSlotsAdditive: -1,
    minimumMaximumSlots: 1,
    startingPotionsAdditive: 2,
    healMultiplier: 0.65
  });
  projection.summary.potionModifiers.maximumSlotsAdditive = 999;
  assert.equal(projectPublicRunModifiers(state).summary.potionModifiers.maximumSlotsAdditive, -1);
});

test("run-start modifier selection rejects late depleted runs and preserves Flask grants", async () => {
  const depleted = modifierState("potion-late-start");
  depleted.build.resources.potions = 1;
  const before = structuredClone(depleted);
  await assert.rejects(
    applyCanonicalRunModifierSelection(
      depleted,
      { modifierIds: ["alchemist"], activationSource: "server-issued-run-start" },
      { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto }
    ),
    /RUN_MODIFIER_RUN_START_RESOURCES_NOT_PRISTINE/u
  );
  assert.deepEqual(depleted, before);

  const carried = modifierState("potion-start-flask");
  carried.build = await applyRelicAcquisition(
    carried.build,
    relicAcquisition("flask"),
    { cryptoProvider: webcrypto }
  );
  carried.build.resources.hp = 77;
  carried.build.resources.turn = 9;
  const selected = await applyCanonicalRunModifierSelection(
    carried,
    { modifierIds: ["alchemist"], activationSource: "server-issued-run-start" },
    { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto }
  );
  assert.deepEqual(
    { potions: selected.build.resources.potions, maxPotions: selected.build.resources.maxPotions },
    { potions: 6, maxPotions: 6 }
  );
  assert.equal(selected.build.resources.hp, 77);
  assert.equal(selected.build.resources.turn, 9);

  const famineThenAlchemist = await applyCanonicalRunModifierSelection(
    modifierState("potion-order-a"),
    { modifierIds: ["famine", "alchemist"], activationSource: "server-issued-run-start" },
    { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto }
  );
  const alchemistThenFamine = await applyCanonicalRunModifierSelection(
    modifierState("potion-order-b"),
    { modifierIds: ["alchemist", "famine"], activationSource: "server-issued-run-start" },
    { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto }
  );
  assert.deepEqual(famineThenAlchemist.build.resources, alchemistThenFamine.build.resources);
});

test("canonical Satchel capacity covers levels zero through five", () => {
  for (let satchelLevel = 0; satchelLevel <= 5; satchelLevel += 1) {
    assert.equal(
      derivePotionMaximumV08({ baseMaximum: 3, satchelLevel, modifierMaximumSlotsAdditive: 0, flaskStacks: 0 }),
      3 + satchelLevel
    );
  }
});

test("Famine floor remains canonical across Flask acquisition and removal", async () => {
  let state = modifierState("potion-famine-flask");
  state = await applyCanonicalRunModifierSelection(
    state,
    { modifierIds: ["famine"], activationSource: "server-issued-run-start" },
    { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto }
  );
  const potionContext = { cryptoProvider: webcrypto, runModifiers: state.runModifiers };
  state.build = await applyRelicAcquisition(state.build, relicAcquisition("flask"), potionContext);
  assert.deepEqual(
    { potions: state.build.resources.potions, maxPotions: state.build.resources.maxPotions },
    { potions: 1, maxPotions: 1 }
  );
  state.build = await applyRelicRemovalV08(state.build, { relicId: "flask", stacks: 1 }, potionContext);
  assert.deepEqual(
    { potions: state.build.resources.potions, maxPotions: state.build.resources.maxPotions },
    { potions: 1, maxPotions: 1 }
  );
});
