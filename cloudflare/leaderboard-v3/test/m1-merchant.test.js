import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  commitMerchantTransactionV08,
  issueMerchantInventoryV08
} from "../src/rulesets/v08-meta-1/merchant-policy.js";
import {
  applyRelicAcquisition,
  assertCanonicalRelicBuildV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import {
  assertMetaStateV08,
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  projectPublicMetaTransactionOfferV08
} from "../src/rulesets/v08-meta-1/meta-transaction.js";
import policyDocument from "../src/rulesets/v08-meta-1/data/merchant-transaction-policy.generated.json" with { type: "json" };
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(await readFile(
  path.join(
    WORKER_ROOT,
    "src",
    "rulesets",
    "v08-meta-1",
    "test",
    "m1-merchant-golden-fixtures.json"
  ),
  "utf8"
));
const policy = policyDocument.canonicalData;
const SECRET = "m1-merchant:0123456789abcdef0123456789abcdef";

function oracle(seed, controls = {}) {
  return {
    async deriveRandomBytes(options) {
      const output = new Uint8Array(options.length);
      let offset = 0;
      let block = 0;
      while (offset < output.length) {
        const digest = createHash("sha256")
          .update([
            seed,
            options.runId,
            options.revision,
            options.purpose,
            options.counter,
            block
          ].join("|"))
          .digest();
        const take = Math.min(digest.length, output.length - offset);
        output.set(digest.subarray(0, take), offset);
        offset += take;
        block += 1;
      }
      return output;
    },
    async deriveIntInclusive(minimum, maximum, options) {
      const forced = controls[options.purpose];
      if (Number.isSafeInteger(forced)) {
        return Math.max(minimum, Math.min(maximum, forced));
      }
      const digest = createHash("sha256")
        .update([seed, options.runId, options.purpose, options.counter].join("|"))
        .digest();
      return minimum + digest.readUInt32BE(0) % (maximum - minimum + 1);
    }
  };
}

function setup(runId, controls = {}, balances = { run: 5000, camp: 1000 }) {
  const context = {
    runId,
    rulesetHash: manifest.rulesetHash,
    season: "season-m1",
    startedAt: 1_700_001_100_000,
    secret: SECRET,
    randomOracle: oracle(runId, controls)
  };
  const meta = createInitialMetaStateV08({}, context);
  meta.status = "active";
  meta.gold = balances.run;
  meta.goldLedger.earnedServerDerived = balances.run;
  meta.campGold = balances.camp;
  meta.goldLedger.campEarnedServerDerived = balances.camp;
  meta.build.resources.potions = 0;
  meta.build.resources.hp = 50;
  meta.build.resources.highestUnlockedDepth = 50;
  meta.currentRoomDirective = {
    directiveId: `merchant_directive_${runId}`,
    runId,
    revision: meta.revision,
    depth: 11,
    roomIndex: 11,
    roomType: "merchant"
  };
  return { meta, context };
}

async function issued(runId, controls = {}, balances) {
  const result = setup(runId, controls, balances);
  result.meta = await issueMerchantInventoryV08(
    result.meta,
    result.context
  );
  return result;
}

function choiceBy(meta, kind, predicate = () => true) {
  const choice = meta.pendingInventory.choices.find(
    (entry) => entry.kind === kind && predicate(entry)
  );
  assert.ok(choice, `missing ${kind}`);
  return choice;
}

function request(choice, extras = {}) {
  return {
    transactionId: choice.transactionId,
    choiceId: choice.choiceId,
    ...extras
  };
}

async function buildWith(meta, relicIds) {
  for (const [index, relicId] of relicIds.entries()) {
    meta.build = await applyRelicAcquisition(meta.build, {
      relicId,
      acquiredRevision: index,
      acquisitionSource: "fixture",
      sourceOfferId: `merchant_fixture_${index}`
    });
  }
  return meta;
}

test("M1 Merchant golden corpus has 24 source-bound cases", () => {
  assert.equal(fixtures.length, 24);
  assert.equal(new Set(fixtures.map((fixture) => fixture.fixtureId)).size, 24);
  assert.ok(policy.sourceEvidence.length >= 6);
});

test("Merchant policy preserves v0.8 pools, prices, services and consumption rules", () => {
  assert.deepEqual(
    policy.relicTiers.map(({ rarity, weight, price }) => ({ rarity, weight, price })),
    [
      { rarity: "normal", weight: 60, price: 300 },
      { rarity: "rare", weight: 25, price: 600 },
      { rarity: "epic", weight: 12, price: 1000 },
      { rarity: "legendary", weight: 3, price: 2000 }
    ]
  );
  assert.equal(policy.reservationDepositRatio, 0.25);
  assert.equal(policy.reservationDepositRefundable, false);
  assert.equal(policy.buybackRatio, 0.5);
  assert.deepEqual(policy.potionPrice.sequence, [10, 20, 30, 40, 50]);
  assert.equal(policy.maximumSecondChancePurchases, 5);
  assert.equal(policy.legendarySkillRequiredDepth, 20);
});

test("canonical inventory is deterministic, server-bound and hides private RNG results", async () => {
  const controls = {
    "merchant/relic-rarity": 60,
    "merchant/relic-candidate": 0,
    "merchant/service-life": 99,
    "merchant/service-choice": 0
  };
  const left = await issued("merchant_deterministic", controls);
  const right = await issued("merchant_deterministic", controls);
  assert.deepEqual(left.meta.pendingInventory, right.meta.pendingInventory);
  const offer = left.meta.pendingInventory;
  assert.equal(offer.sourceType, "merchant");
  assert.equal(offer.sourceBinding.directiveId, left.meta.currentRoomDirective.directiveId);
  const publicOffer = projectPublicMetaTransactionOfferV08(offer);
  assert.equal(JSON.stringify(publicOffer).includes("privateData"), false);
  assert.equal(JSON.stringify(publicOffer).includes("resultRelicId"), false);
  assert.ok(publicOffer.choices.every((choice) => choice.transactionId && choice.choiceId));
});

test("potion and skill purchases use server prices, unlock sequential slots and retry exactly", async () => {
  const result = await issued("merchant_sequences");
  const potion1 = choiceBy(result.meta, "merchant_potion", (entry) => entry.publicData.price === 10);
  const beforeTotal = result.meta.gold + result.meta.campGold;
  let committed = await commitMerchantTransactionV08(
    result.meta,
    request(potion1),
    result.context
  );
  assert.equal(committed.build.resources.potions, 1);
  assert.equal(committed.build.merchant.potionsBought, 1);
  assert.equal(committed.gold + committed.campGold, beforeTotal - 10);
  assert.deepEqual(
    await commitMerchantTransactionV08(committed, request(potion1), result.context),
    committed
  );
  const potion2 = choiceBy(
    committed,
    "merchant_potion",
    (entry) => entry.privateData.expectedBought === 1
  );
  assert.equal(potion2.status, "available");
  committed = await commitMerchantTransactionV08(
    committed,
    request(potion2),
    result.context
  );
  assert.equal(committed.build.resources.potions, 2);
  const dash1 = choiceBy(
    committed,
    "merchant_skill_upgrade",
    (entry) => entry.publicData.skillId === "dash" && entry.publicData.tier === 1
  );
  committed = await commitMerchantTransactionV08(
    committed,
    request(dash1),
    result.context
  );
  assert.equal(committed.build.skillTiers.dash, 1);
  const dash2 = choiceBy(
    committed,
    "merchant_skill_upgrade",
    (entry) => entry.publicData.skillId === "dash" && entry.publicData.tier === 2
  );
  assert.equal(dash2.status, "available");
  assertMetaStateV08(committed);
});

test("direct relic purchase and full-build replacement are atomic canonical build changes", async () => {
  {
    const result = await issued("merchant_direct", {
      "merchant/relic-rarity": 0,
      "merchant/relic-candidate": 0,
      "merchant/service-life": 99,
      "merchant/service-choice": 0
    });
    const relicChoice = choiceBy(result.meta, "merchant_relic_purchase");
    const committed = await commitMerchantTransactionV08(
      result.meta,
      request(relicChoice),
      result.context
    );
    assert.ok(committed.build.relics.some(
      (entry) => entry.relicId === relicChoice.privateData.relicId
    ));
    assert.equal(relicChoice.publicData.price, 300);
    assertCanonicalRelicBuildV08(committed.build);
  }
  {
    const prepared = setup("merchant_replacement", {
      "merchant/relic-rarity": 60,
      "merchant/relic-candidate": 0,
      "merchant/service-life": 99,
      "merchant/service-choice": 0
    });
    await buildWith(prepared.meta, [
      "fang",
      "plating",
      "lucky",
      "flask",
      "lifebloom",
      "ironboots",
      "fieldrations",
      "quickloader"
    ]);
    prepared.meta = await issueMerchantInventoryV08(prepared.meta, prepared.context);
    const replacement = choiceBy(prepared.meta, "merchant_relic_replacement");
    const before = structuredClone(prepared.meta);
    const committed = await commitMerchantTransactionV08(
      prepared.meta,
      request(replacement),
      prepared.context
    );
    assert.deepEqual(prepared.meta, before);
    assert.ok(committed.build.relics.some(
      (entry) => entry.relicId === replacement.privateData.relicId
    ));
    assert.equal(committed.build.relicSlotsUsed <= committed.build.relicSlotLimit, true);
    assertCanonicalRelicBuildV08(committed.build);
  }
});

test("reservation charges 25% once, unlocks claim, and never refunds deposit", async () => {
  const result = await issued("merchant_reserve", {
    "merchant/relic-rarity": 0,
    "merchant/relic-candidate": 0,
    "merchant/service-life": 99,
    "merchant/service-choice": 0
  });
  const reserve = choiceBy(result.meta, "merchant_relic_reserve");
  const before = result.meta.gold + result.meta.campGold;
  let committed = await commitMerchantTransactionV08(
    result.meta,
    request(reserve),
    result.context
  );
  assert.equal(committed.gold + committed.campGold, before - 75);
  assert.equal(committed.build.merchant.reservedRelic.depositPaid, 75);
  const claim = choiceBy(committed, "merchant_reserved_claim");
  assert.equal(claim.status, "available");
  committed = await commitMerchantTransactionV08(
    committed,
    request(claim),
    result.context
  );
  assert.equal(committed.gold + committed.campGold, before - 300);
  assert.equal(committed.build.merchant.reservedRelic, null);
});

test("reserved relic IDs suppress aggregated buybacks and reject crafted commits before payout", async () => {
  const prepared = setup("merchant_reserved_buyback_guard");
  await buildWith(prepared.meta, ["fang", "fang", "plating"]);
  prepared.meta.build.merchant.reservedRelic = {
    relicId: "fang",
    totalPrice: 300,
    depositPaid: 75,
    remainingPrice: 225
  };
  prepared.meta = await issueMerchantInventoryV08(prepared.meta, prepared.context);

  assert.equal(
    prepared.meta.pendingInventory.choices.some(
      (entry) => entry.kind === "merchant_buyback" && entry.publicData.relicId === "fang"
    ),
    false
  );
  const platingBuyback = choiceBy(
    prepared.meta,
    "merchant_buyback",
    (entry) => entry.privateData.relicId === "plating"
  );
  assert.equal(platingBuyback.publicData.stacksAvailable, 1);

  const forged = prepared.meta.pendingInventory.choices.find(
    (entry) => entry.transactionId === platingBuyback.transactionId
  );
  forged.privateData.relicId = "fang";
  const before = structuredClone(prepared.meta);
  await assert.rejects(
    commitMerchantTransactionV08(
      prepared.meta,
      request(forged),
      prepared.context
    ),
    /MERCHANT_RESERVED_RELIC_BUYBACK_FORBIDDEN/u
  );
  assert.deepEqual(prepared.meta.build, before.build);
  assert.equal(prepared.meta.gold, before.gold);
  assert.equal(prepared.meta.campGold, before.campGold);
});

test("discarding or claiming a reservation restores its relic buyback eligibility", async () => {
  for (const mode of ["discard", "claim"]) {
    const prepared = setup("merchant_reserved_release_" + mode);
    await buildWith(prepared.meta, ["fang", "fang"]);
    let releaseChoice;
    if (mode === "discard") {
      prepared.meta.build.merchant.reservedRelic = {
        relicId: "fang",
        totalPrice: 300,
        depositPaid: 75,
        remainingPrice: 225
      };
      prepared.meta = await issueMerchantInventoryV08(prepared.meta, prepared.context);
      releaseChoice = choiceBy(prepared.meta, "merchant_reserved_discard");
    } else {
      prepared.meta = await issueMerchantInventoryV08(prepared.meta, {
        ...prepared.context,
        randomOracle: oracle(prepared.meta.runId, {
          "merchant/relic-rarity": 0,
          "merchant/relic-candidate": 0,
          "merchant/service-life": 99,
          "merchant/service-choice": 0
        })
      });
      const reserve = choiceBy(prepared.meta, "merchant_relic_reserve");
      const reserved = await commitMerchantTransactionV08(
        prepared.meta,
        request(reserve),
        prepared.context
      );
      releaseChoice = choiceBy(reserved, "merchant_reserved_claim");
      prepared.meta = reserved;
    }
    const released = await commitMerchantTransactionV08(
      prepared.meta,
      request(releaseChoice),
      prepared.context
    );
    assert.equal(released.build.merchant.reservedRelic, null);

    const refreshed = await issueMerchantInventoryV08(released, prepared.context);
    assert.ok(
      refreshed.pendingInventory.choices.some(
        (entry) => entry.kind === "merchant_buyback" && entry.publicData.relicId === "fang"
      ),
      mode + " must restore the reserved relic buyback"
    );
  }
});
test("buyback and services mutate canonical ledgers at most once", async () => {
  {
    const prepared = setup("merchant_buyback");
    await buildWith(prepared.meta, ["fang"]);
    prepared.meta = await issueMerchantInventoryV08(prepared.meta, prepared.context);
    const buyback = choiceBy(prepared.meta, "merchant_buyback");
    const beforeGold = prepared.meta.gold;
    const committed = await commitMerchantTransactionV08(
      prepared.meta,
      request(buyback),
      prepared.context
    );
    assert.equal(committed.gold, beforeGold + 25);
    assert.equal(committed.build.relics.some((entry) => entry.relicId === "fang"), false);
    assert.deepEqual(
      await commitMerchantTransactionV08(committed, request(buyback), prepared.context),
      committed
    );
  }
  {
    const prepared = setup("merchant_flask_buyback");
    await buildWith(prepared.meta, ["flask"]);
    prepared.meta = await issueMerchantInventoryV08(prepared.meta, prepared.context);
    const buyback = choiceBy(
      prepared.meta,
      "merchant_buyback",
      (entry) => entry.privateData.relicId === "flask"
    );
    const committed = await commitMerchantTransactionV08(
      prepared.meta,
      request(buyback),
      prepared.context
    );
    assert.equal(committed.build.resources.maxPotions, 3);
    assert.equal(committed.build.resources.potions, 1);
    assert.equal(committed.build.relics.some((entry) => entry.relicId === "flask"), false);
  }
  {
    const result = await issued("merchant_fullheal", {
      "merchant/service-life": 99,
      "merchant/service-choice": 0
    });
    const service = choiceBy(
      result.meta,
      "merchant_service",
      (entry) => entry.publicData.serviceId === "fullheal"
    );
    const committed = await commitMerchantTransactionV08(
      result.meta,
      request(service),
      result.context
    );
    assert.equal(committed.build.resources.hp, committed.build.resources.maxHp);
    assert.equal(result.meta.gold + result.meta.campGold - committed.gold - committed.campGold, 150);
  }
});

test("conflicting retry, fake fields, stale source and insufficient gold fail with full rollback", async () => {
  {
    const result = await issued("merchant_conflict");
    const potion = choiceBy(result.meta, "merchant_potion");
    const committed = await commitMerchantTransactionV08(
      result.meta,
      request(potion),
      result.context
    );
    const other = choiceBy(committed, "merchant_skill_upgrade");
    await assert.rejects(
      commitMerchantTransactionV08(
        committed,
        { transactionId: potion.transactionId, choiceId: other.choiceId },
        result.context
      ),
      /META_TRANSACTION_IDEMPOTENCY_PAYLOAD_MISMATCH/u
    );
  }
  for (const field of ["price", "gold", "target", "resultingBuild", "rngResult"]) {
    const result = await issued(`merchant_fake_${field}`);
    const choice = choiceBy(result.meta, "merchant_potion");
    await assert.rejects(
      commitMerchantTransactionV08(
        result.meta,
        request(choice, { [field]: 0 }),
        result.context
      ),
      new RegExp(`META_TRANSACTION_REQUEST_UNKNOWN_FIELD:${field}`, "u")
    );
  }
  {
    const result = await issued(
      "merchant_insufficient",
      {},
      { run: 0, camp: 0 }
    );
    const choice = choiceBy(result.meta, "merchant_potion");
    const before = structuredClone(result.meta);
    await assert.rejects(
      commitMerchantTransactionV08(result.meta, request(choice), result.context),
      /INSUFFICIENT_GOLD/u
    );
    assert.deepEqual(result.meta, before);
  }
  {
    const result = await issued("merchant_stale");
    const choice = choiceBy(result.meta, "merchant_potion");
    result.meta.currentRoomDirective.directiveId = "foreign";
    const before = structuredClone(result.meta);
    await assert.rejects(
      commitMerchantTransactionV08(result.meta, request(choice), result.context),
      /META_TRANSACTION_STALE_STATE_DIGEST/u
    );
    assert.deepEqual(result.meta, before);
  }
});

test("128 seeded Merchant invariant cases preserve deterministic inventory and exact leave retry", async () => {
  const caseCount = 128;
  for (let seed = 0; seed < caseCount; seed += 1) {
    const controls = {
      "merchant/relic-rarity": seed % 100,
      "merchant/relic-candidate": seed,
      "merchant/service-life": seed % 100,
      "merchant/service-choice": seed
    };
    const runId = `merchant_property_${seed}`;
    const left = await issued(runId, controls);
    const right = await issued(runId, controls);
    assert.deepEqual(left.meta.pendingInventory, right.meta.pendingInventory);
    const leave = choiceBy(left.meta, "leave");
    const committed = await commitMerchantTransactionV08(
      left.meta,
      request(leave),
      left.context
    );
    assert.equal(committed.pendingInventory, null);
    assert.deepEqual(
      await commitMerchantTransactionV08(committed, request(leave), left.context),
      committed
    );
    assert.equal(committed.gold, left.meta.gold);
    assert.equal(committed.campGold, left.meta.campGold);
  }
  console.info(`M1 Merchant property cases: ${caseCount}`);
});
