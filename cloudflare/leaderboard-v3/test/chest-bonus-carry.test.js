import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { createV08Meta1Ruleset } from "../src/rulesets/v08-meta-1/index.js";
import {
  createInitialMetaStateV08,
  assertMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  normalizeChestBonusesV08,
  projectChestBonusesV08,
  applyIssuedChestStatBonusV08
} from "../src/rulesets/v08-meta-1/chest-bonus-policy.js";
import {
  hydrateRunFromProfileV08,
  profileStateFromRunV08
} from "../src/rulesets/v08-meta-1/profile-policy.js";
import { applyCanonicalRunModifierSelection } from "../src/rulesets/v08-meta-1/run-modifiers.js";

const context = Object.freeze({
  runId: "run_chest_carry",
  season: "r2-local",
  startedAt: 1_900_000_000_000,
  now: 1_900_000_000_000,
  secret: "chest-carry-secret-0123456789abcdef",
  cryptoProvider: webcrypto
});

test("legacy and null chest ledgers normalize to empty bounded counters", () => {
  assert.deepEqual(normalizeChestBonusesV08(), {
    schemaVersion: 1,
    attackDepthBuckets: {},
    armorDepthBuckets: {},
    healthDepthBuckets: {}
  });
  assert.throws(() => normalizeChestBonusesV08(null), /CHEST_BONUS_INVALID/u);
});

test("chest projection derives exact low and tiered totals from depth buckets", () => {
  let campaign = { chestBonuses: normalizeChestBonusesV08() };
  for (const scalingDepth of [1, 20, 30, 40]) {
    campaign = applyIssuedChestStatBonusV08(campaign, { stat: "attack", scalingDepth });
  }
  for (const scalingDepth of [1, 20, 30]) {
    campaign = applyIssuedChestStatBonusV08(campaign, { stat: "armor", scalingDepth });
    campaign = applyIssuedChestStatBonusV08(campaign, { stat: "health", scalingDepth });
  }
  assert.deepEqual(projectChestBonusesV08(campaign.chestBonuses), {
    schemaVersion: 1,
    attackDepthBuckets: { 0: 1, 2: 1, 3: 1, 4: 1 },
    armorDepthBuckets: { 0: 1, 2: 1, 3: 1 },
    healthDepthBuckets: { 0: 1, 2: 1, 3: 1 },
    attackFlat: 14,
    armorFlat: 9,
    healthFlat: 17
  });
});

test("invalid chest ledger data is rejected instead of clamped", () => {
  assert.throws(() => normalizeChestBonusesV08({
    schemaVersion: 2,
    attackDepthBuckets: {},
    armorDepthBuckets: {},
    healthDepthBuckets: {}
  }), /CHEST_BONUS_SCHEMA_UNSUPPORTED/u);
  for (const count of [-1, 1.5, 6]) {
    assert.throws(() => normalizeChestBonusesV08({
      schemaVersion: 1,
      attackDepthBuckets: { 0: count },
      armorDepthBuckets: {},
      healthDepthBuckets: {}
    }), /CHEST_BONUS_COUNT_INVALID/u);
  }
  assert.throws(() => normalizeChestBonusesV08({
    schemaVersion: 1,
    attackDepthBuckets: { "01": 1 },
    armorDepthBuckets: {},
    healthDepthBuckets: {}
  }), /CHEST_BONUS_BUCKET_INVALID/u);
  assert.throws(() => normalizeChestBonusesV08({
    schemaVersion: 1,
    attackDepthBuckets: { 1001: 1 },
    armorDepthBuckets: {},
    healthDepthBuckets: {}
  }), /CHEST_BONUS_BUCKET_INVALID/u);
});

test("issued stat awards reject a sixth item in one depth bucket", () => {
  let campaign = { chestBonuses: normalizeChestBonusesV08() };
  for (let index = 0; index < 5; index += 1) {
    campaign = applyIssuedChestStatBonusV08(campaign, { stat: "attack", scalingDepth: 20 });
  }
  assert.equal(campaign.chestBonuses.attackDepthBuckets["2"], 5);
  assert.throws(
    () => applyIssuedChestStatBonusV08(campaign, { stat: "attack", scalingDepth: 20 }),
    /CHEST_BONUS_BUCKET_CAP/u
  );
});

test("profile extraction and hydration carry chest bonuses for the campaign", async () => {
  let state = createInitialMetaStateV08({}, context);
  state.status = "extraction";
  state.campaign = applyIssuedChestStatBonusV08(state.campaign, {
    stat: "health",
    scalingDepth: 31
  });
  const profile = profileStateFromRunV08(state, "profile_chest", 1);
  const next = createInitialMetaStateV08({}, { ...context, runId: "run_next_descent" });
  const hydrated = await hydrateRunFromProfileV08(next, profile, { cryptoProvider: webcrypto });
  assert.deepEqual(hydrated.campaign.chestBonuses, state.campaign.chestBonuses);
  assert.equal(projectChestBonusesV08(hydrated.campaign.chestBonuses).healthFlat, 7);
  assert.equal(hydrated.build.resources.maxHp, 107);
  assert.equal(hydrated.build.resources.hp, 107);
  assert.doesNotThrow(() => assertMetaStateV08(hydrated));
});

test("versioned profile hydration applies Practice maximum-HP order without changing historical runs", async () => {
  let state = createInitialMetaStateV08({}, context);
  state.build.campUpgrades.vitality = 3;
  state = await applyCanonicalRunModifierSelection(
    state,
    { modifierIds: ["berserker"], activationSource: "server-issued-run-start" },
    { authority: "TRUSTED_RULESET_DOMAIN", cryptoProvider: webcrypto }
  );
  for (let index = 0; index < 5; index += 1) {
    state.campaign = applyIssuedChestStatBonusV08(state.campaign, {
      stat: "health",
      scalingDepth: 1
    });
  }
  state.status = "extraction";

  const profile = profileStateFromRunV08(state, "profile_berserker_health", 1);
  const next = createInitialMetaStateV08({}, { ...context, runId: "run_berserker_health" });
  const legacy = await hydrateRunFromProfileV08(next, profile, { cryptoProvider: webcrypto });
  const hydrated = await hydrateRunFromProfileV08(next, profile, {
    cryptoProvider: webcrypto,
    capabilities: { rankedStartResourceParity: "v1" }
  });

  assert.equal(legacy.build.resources.maxHp, 155);
  // Practice order: round(100 * 1.3) -> round(130 * 0.75) -> +25 chest HP.
  assert.equal(hydrated.build.resources.maxHp, 123);
  assert.equal(hydrated.build.resources.hp, 123);
  assert.doesNotThrow(() => assertMetaStateV08(hydrated));
});

test("new Ranked campaign resets carried chest bonuses", async () => {
  const ruleset = createV08Meta1Ruleset({ secret: context.secret, cryptoProvider: webcrypto });
  const prior = createInitialMetaStateV08({}, context);
  prior.status = "extraction";
  prior.campaign = applyIssuedChestStatBonusV08(prior.campaign, {
    stat: "attack",
    scalingDepth: 40
  });
  const profile = profileStateFromRunV08(prior, "profile_chest_reset", 2);
  const fresh = await ruleset.createRun(
    { startDepth: 0, newCampaign: true, profileState: profile },
    { ...context, runId: "run_fresh_campaign" }
  );
  assert.deepEqual(fresh.campaign.chestBonuses, normalizeChestBonusesV08());
});
