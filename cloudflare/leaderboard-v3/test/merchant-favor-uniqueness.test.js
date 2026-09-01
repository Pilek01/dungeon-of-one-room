import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRelicAcquisition,
  createEmptyRelicBuildV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import { getRegularRelicCandidatePoolV08 } from "../src/rulesets/v08-meta-1/regular-relic-offer.js";
import {
  V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_ROOM_ELITE_BUDGET_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR
} from "../src/rulesets/releases.js";

const UNIQUE_MERCHANT_FAVOR = Object.freeze({
  capabilities: { merchantFavorTierOneUnique: "v1" }
});

function acquisition(revision, offerId) {
  return {
    relicId: "merchfavor1",
    acquiredRevision: revision,
    acquisitionSource: "merchant",
    sourceOfferId: offerId
  };
}

test("new rulesets reject a second Merchant's Favor I copy", async () => {
  const first = await applyRelicAcquisition(
    createEmptyRelicBuildV08(),
    acquisition(1, "merchant-favor-first"),
    UNIQUE_MERCHANT_FAVOR
  );

  await assert.rejects(
    applyRelicAcquisition(
      first,
      acquisition(2, "merchant-favor-duplicate"),
      UNIQUE_MERCHANT_FAVOR
    ),
    /RELIC_UNIQUE_DUPLICATE:merchfavor1/u
  );
});

test("historical rulesets can still hydrate and extend their legacy stack", async () => {
  const first = await applyRelicAcquisition(
    createEmptyRelicBuildV08(),
    acquisition(1, "legacy-merchant-favor-first")
  );
  const second = await applyRelicAcquisition(
    first,
    acquisition(2, "legacy-merchant-favor-second")
  );

  assert.deepEqual(
    second.relics.find((entry) => entry.relicId === "merchfavor1"),
    {
      relicId: "merchfavor1",
      stacks: 2,
      acquiredRevision: 1,
      acquisitionSource: "merchant",
      sourceOfferId: "legacy-merchant-favor-first"
    }
  );
});

test("new rulesets remove owned Merchant's Favor I from regular relic offers", async () => {
  const build = await applyRelicAcquisition(
    createEmptyRelicBuildV08(),
    acquisition(1, "merchant-favor-offer-filter"),
    UNIQUE_MERCHANT_FAVOR
  );

  assert.equal(
    getRegularRelicCandidatePoolV08(
      { build },
      25,
      UNIQUE_MERCHANT_FAVOR
    ).includes("merchfavor1"),
    false
  );
  assert.equal(
    getRegularRelicCandidatePoolV08({ build }, 25).includes("merchfavor1"),
    true
  );
});

test("only the new release descriptor enables Merchant's Favor I uniqueness", () => {
  assert.equal(
    V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities
      .merchantFavorTierOneUnique,
    "v1"
  );
  assert.equal(
    V08_META_1_ROOM_ELITE_BUDGET_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR
      .capabilities.merchantFavorTierOneUnique,
    undefined
  );
});
