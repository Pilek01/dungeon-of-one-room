import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  beginCampSessionV08,
  commitCampTransactionV08,
  issueCampTransactionsV08
} from "../src/rulesets/v08-meta-1/camp-policy.js";
import {
  commitPactTransactionV08,
  issuePactOfferV08
} from "../src/rulesets/v08-meta-1/pact-policy.js";
import {
  applyRelicAcquisition,
  assertCanonicalRelicBuildV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import {
  assertMetaStateV08,
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import campPolicyDocument from "../src/rulesets/v08-meta-1/data/camp-transaction-policy.generated.json" with { type: "json" };
import pactPolicyDocument from "../src/rulesets/v08-meta-1/data/pact-transaction-policy.generated.json" with { type: "json" };
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(await readFile(
  path.join(
    WORKER_ROOT,
    "src",
    "rulesets",
    "v08-meta-1",
    "test",
    "m1-camp-pact-golden-fixtures.json"
  ),
  "utf8"
));
const campPolicy = campPolicyDocument.canonicalData;
const pactPolicy = pactPolicyDocument.canonicalData;
const SECRET = "m1-camp-pact:0123456789abcdef0123456789abcdef";

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

function baseSetup(runId, controls = {}) {
  const context = {
    runId,
    rulesetHash: manifest.rulesetHash,
    season: "season-m1",
    startedAt: 1_700_001_400_000,
    secret: SECRET,
    randomOracle: oracle(runId, controls)
  };
  const meta = createInitialMetaStateV08({}, context);
  meta.status = "active";
  return { meta, context };
}

async function campSetup(runId, campGold = 5000) {
  const result = baseSetup(runId);
  result.meta.campGold = campGold;
  result.meta.goldLedger.campEarnedServerDerived = campGold;
  result.meta.build.resources.highestUnlockedDepth = 50;
  result.meta = await beginCampSessionV08(result.meta, result.context);
  return result;
}

function pactSetup(runId, depth = 45, controls = {}) {
  const result = baseSetup(runId, controls);
  result.meta.currentRoomDirective = {
    directiveId: `pact_directive_${runId}`,
    runId,
    revision: result.meta.revision,
    depth,
    roomIndex: depth,
    roomType: "pact"
  };
  return result;
}

async function addRelic(meta, relicId) {
  meta.build = await applyRelicAcquisition(meta.build, {
    relicId,
    acquiredRevision: meta.revision,
    acquisitionSource: "fixture",
    sourceOfferId: `camp_fixture_${relicId}`
  });
  return meta;
}

function request(choice, extras = {}) {
  return {
    transactionId: choice.transactionId,
    choiceId: choice.choiceId,
    ...extras
  };
}

function findChoice(meta, predicate) {
  const choice = meta.pendingInventory.choices.find(predicate);
  assert.ok(choice, "expected Camp/Pact choice");
  return choice;
}

test("M1 Camp/Pact golden corpus has 32 source-bound cases", () => {
  assert.equal(fixtures.length, 32);
  assert.equal(new Set(fixtures.map((fixture) => fixture.fixtureId)).size, 32);
  assert.equal(fixtures.filter((fixture) => fixture.system === "camp").length, 16);
  assert.equal(fixtures.filter((fixture) => fixture.system === "pact").length, 16);
});

test("Camp and Pact policies preserve exact active baseline tables", () => {
  assert.equal(campPolicy.upgrades.length, 10);
  assert.deepEqual(
    campPolicy.upgrades.map(({ id, baseCost, max }) => ({ id, baseCost, max })),
    [
      { id: "vitality", baseCost: 30, max: 20 },
      { id: "blade", baseCost: 30, max: 15 },
      { id: "satchel", baseCost: 15, max: 6 },
      { id: "guard", baseCost: 30, max: 15 },
      { id: "auto_potion", baseCost: 600, max: 1 },
      { id: "potion_strength", baseCost: 80, max: 5 },
      { id: "crit_chance", baseCost: 100, max: 4 },
      { id: "treasure_sense", baseCost: 80, max: 5 },
      { id: "emergency_stash", baseCost: 120, max: 3 },
      { id: "bounty_contract", baseCost: 70, max: 5 }
    ]
  );
  assert.equal(campPolicy.elixirStackMaximum, 5);
  assert.equal(campPolicy.elixirDurationTurns, 5);
  assert.equal(campPolicy.elixirDiscardRefundRatio, 0.5);
  assert.equal(pactPolicy.offerCount, 2);
  assert.equal(pactPolicy.maximumActivePacts, 1);
  assert.equal(pactPolicy.pacts.length, 11);
});

test("Camp upgrade cost, level, resources and exact retry are canonical", async () => {
  const result = await campSetup("camp_upgrade");
  result.meta = await issueCampTransactionsV08(result.meta, result.context);
  const vitality = findChoice(
    result.meta,
    (entry) =>
      entry.privateData.action === "upgrade" &&
      entry.privateData.upgradeId === "vitality"
  );
  assert.equal(vitality.publicData.price, 30);
  const committed = await commitCampTransactionV08(
    result.meta,
    request(vitality),
    result.context
  );
  assert.equal(committed.campGold, 4970);
  assert.equal(committed.build.campUpgrades.vitality, 1);
  assert.equal(committed.build.resources.maxHp, 110);
  assert.equal(committed.build.resources.hp, 110);
  assert.deepEqual(
    await commitCampTransactionV08(committed, request(vitality), result.context),
    committed
  );
  assert.equal(committed.metaTransactionReceipts.length, 1);
  let next = await issueCampTransactionsV08(committed, result.context);
  const vitality2 = findChoice(
    next,
    (entry) =>
      entry.privateData.action === "upgrade" &&
      entry.privateData.upgradeId === "vitality"
  );
  assert.equal(vitality2.publicData.price, 42);
});

test("Camp rejects insufficient gold and forged price, level, amount or final state", async () => {
  const result = await campSetup("camp_insufficient", 0);
  result.meta = await issueCampTransactionsV08(result.meta, result.context);
  const upgrade = findChoice(result.meta, (entry) => entry.privateData.action === "upgrade");
  const before = structuredClone(result.meta);
  await assert.rejects(
    commitCampTransactionV08(result.meta, request(upgrade), result.context),
    /INSUFFICIENT_CAMP_GOLD/u
  );
  assert.deepEqual(result.meta, before);
  for (const [field, value] of [
    ["price", 0],
    ["level", 99],
    ["amount", 0],
    ["gold", 999999],
    ["target", "forged"],
    ["finalState", {}]
  ]) {
    await assert.rejects(
      commitCampTransactionV08(
        result.meta,
        request(upgrade, { [field]: value }),
        result.context
      ),
      new RegExp(`META_TRANSACTION_REQUEST_UNKNOWN_FIELD:${field}`, "u")
    );
  }
});

test("Camp elixir buy, proportional refill and discard refund use one loadout", async () => {
  const buy = await campSetup("camp_elixir_buy");
  buy.meta = await issueCampTransactionsV08(buy.meta, buy.context);
  const iron = findChoice(
    buy.meta,
    (entry) =>
      entry.privateData.action === "elixir_buy_refill" &&
      entry.privateData.elixirId === "iron_1"
  );
  let committed = await commitCampTransactionV08(
    buy.meta,
    request(iron),
    buy.context
  );
  assert.deepEqual(committed.build.elixirs, [{ elixirId: "iron_1", charges: 5 }]);
  assert.equal(committed.campGold, 4925);

  const refill = await campSetup("camp_elixir_refill");
  refill.meta.build.elixirs = [{ elixirId: "iron_1", charges: 2 }];
  refill.meta = await issueCampTransactionsV08(refill.meta, refill.context);
  const refillChoice = findChoice(
    refill.meta,
    (entry) => entry.kind === "camp_elixir_refill"
  );
  assert.equal(refillChoice.publicData.price, 45);
  committed = await commitCampTransactionV08(
    refill.meta,
    request(refillChoice),
    refill.context
  );
  assert.deepEqual(committed.build.elixirs, [{ elixirId: "iron_1", charges: 5 }]);
  assert.equal(committed.campGold, 4955);

  const discard = await campSetup("camp_elixir_discard");
  discard.meta.build.elixirs = [{ elixirId: "iron_1", charges: 2 }];
  discard.meta = await issueCampTransactionsV08(discard.meta, discard.context);
  const discardChoice = findChoice(
    discard.meta,
    (entry) => entry.kind === "camp_elixir_discard"
  );
  assert.equal(discardChoice.publicData.refund, 15);
  committed = await commitCampTransactionV08(
    discard.meta,
    request(discardChoice),
    discard.context
  );
  assert.deepEqual(committed.build.elixirs, []);
  assert.equal(committed.campGold, 5015);
});

test("Camp relic sale consumes one canonical stack and awards camp gold once", async () => {
  const result = await campSetup("camp_relic_sale");
  result.meta = await addRelic(result.meta, "fang");
  result.meta = await addRelic(result.meta, "fang");
  result.meta = await issueCampTransactionsV08(result.meta, result.context);
  const sale = findChoice(
    result.meta,
    (entry) =>
      entry.privateData.action === "relic_sale" &&
      entry.privateData.relicId === "fang"
  );
  assert.equal(sale.publicData.requiresConfirmation, true);
  assert.equal(sale.publicData.reward, 50);
  const committed = await commitCampTransactionV08(
    result.meta,
    request(sale),
    result.context
  );
  assert.equal(
    committed.build.relics.find((entry) => entry.relicId === "fang").stacks,
    1
  );
  assert.equal(committed.campGold, 5050);
  assert.deepEqual(
    await commitCampTransactionV08(committed, request(sale), result.context),
    committed
  );
  assertCanonicalRelicBuildV08(committed.build);
});

test("Camp serialization, stale session and corrupted authority roll back completely", async () => {
  const result = await campSetup("camp_rollback");
  result.meta = await addRelic(result.meta, "fang");
  result.meta = await issueCampTransactionsV08(result.meta, result.context);
  result.meta = JSON.parse(JSON.stringify(result.meta));
  const sale = findChoice(result.meta, (entry) => entry.privateData.action === "relic_sale");
  {
    const stale = structuredClone(result.meta);
    stale.campSession.sessionId = "foreign_session";
    const before = structuredClone(stale);
    await assert.rejects(
      commitCampTransactionV08(stale, request(sale), result.context),
      /META_TRANSACTION_STALE_STATE_DIGEST/u
    );
    assert.deepEqual(stale, before);
  }
  {
    const corrupted = structuredClone(result.meta);
    const target = corrupted.pendingInventory.choices.find(
      (entry) => entry.transactionId === sale.transactionId
    );
    target.privateData.relicId = "unknown_relic";
    const before = structuredClone(corrupted);
    await assert.rejects(
      commitCampTransactionV08(corrupted, request(sale), result.context),
      /CAMP_RELIC_SALE_TARGET_STALE/u
    );
    assert.deepEqual(corrupted, before);
  }
});

test("Pact offer is deterministic, depth-gated, unique and excludes active pact", async () => {
  const left = pactSetup("pact_deterministic", 45);
  const right = pactSetup("pact_deterministic", 45);
  left.meta.build.pacts = ["avarice"];
  right.meta.build.pacts = ["avarice"];
  left.meta = await issuePactOfferV08(left.meta, left.context);
  right.meta = await issuePactOfferV08(right.meta, right.context);
  assert.deepEqual(left.meta.pendingInventory, right.meta.pendingInventory);
  const pactChoices = left.meta.pendingInventory.choices.filter(
    (entry) => entry.privateData.action === "apply"
  );
  assert.equal(pactChoices.length, 2);
  assert.equal(new Set(pactChoices.map((entry) => entry.privateData.pactId)).size, 2);
  assert.ok(pactChoices.every((entry) => entry.privateData.pactId !== "avarice"));
  assert.ok(left.meta.pendingInventory.choices.some((entry) => entry.kind === "pact_break"));
});

test("Pact apply, replace and break consume the room exactly once at zero gold", async () => {
  {
    const result = pactSetup("pact_apply", 45);
    result.meta = await issuePactOfferV08(result.meta, result.context);
    const apply = findChoice(result.meta, (entry) => entry.privateData.action === "apply");
    const committed = await commitPactTransactionV08(
      result.meta,
      request(apply),
      result.context
    );
    assert.deepEqual(committed.build.pacts, [apply.privateData.pactId]);
    assert.equal(committed.gold, 0);
    assert.equal(committed.metaSourceConsumptions.length, 1);
    assert.deepEqual(
      await commitPactTransactionV08(committed, request(apply), result.context),
      committed
    );
  }
  {
    const result = pactSetup("pact_replace", 45);
    result.meta.build.pacts = ["avarice"];
    result.meta = await issuePactOfferV08(result.meta, result.context);
    const replace = findChoice(result.meta, (entry) => entry.privateData.action === "apply");
    const committed = await commitPactTransactionV08(
      result.meta,
      request(replace),
      result.context
    );
    assert.deepEqual(committed.build.pacts, [replace.privateData.pactId]);
    assert.notEqual(replace.privateData.pactId, "avarice");
  }
  {
    const result = pactSetup("pact_break", 45);
    result.meta.build.pacts = ["avarice"];
    result.meta = await issuePactOfferV08(result.meta, result.context);
    const breakChoice = findChoice(result.meta, (entry) => entry.privateData.action === "break");
    const committed = await commitPactTransactionV08(
      result.meta,
      request(breakChoice),
      result.context
    );
    assert.deepEqual(committed.build.pacts, []);
    assert.equal(committed.metaSourceConsumptions.length, 1);
  }
});

test("Pact leave keeps the room reusable and fake pact, price or result fields fail", async () => {
  const result = pactSetup("pact_leave", 45);
  result.meta = await issuePactOfferV08(result.meta, result.context);
  const leave = findChoice(result.meta, (entry) => entry.privateData.action === "leave");
  const committed = await commitPactTransactionV08(
    result.meta,
    request(leave),
    result.context
  );
  assert.deepEqual(committed.build.pacts, []);
  assert.equal(committed.metaSourceConsumptions.length, 0);
  const reopened = await issuePactOfferV08(committed, result.context);
  assert.ok(reopened.pendingInventory);
  const apply = findChoice(reopened, (entry) => entry.privateData.action === "apply");
  for (const [field, value] of [
    ["pactId", "avarice"],
    ["price", 0],
    ["gold", 999999],
    ["result", "forged"],
    ["finalState", {}]
  ]) {
    const before = structuredClone(reopened);
    await assert.rejects(
      commitPactTransactionV08(
        reopened,
        request(apply, { [field]: value }),
        result.context
      ),
      new RegExp(`META_TRANSACTION_REQUEST_UNKNOWN_FIELD:${field}`, "u")
    );
    assert.deepEqual(reopened, before);
  }
});

test("Pact stale revision, digest, source, run and ruleset roll back", async () => {
  const mutations = [
    (meta) => { meta.revision += 1; },
    (meta) => { meta.build.pacts = ["avarice"]; },
    (meta) => { meta.currentRoomDirective.directiveId = "foreign_pact"; }
  ];
  for (const [index, mutate] of mutations.entries()) {
    const result = pactSetup(`pact_stale_${index}`, 45);
    result.meta = await issuePactOfferV08(result.meta, result.context);
    const apply = findChoice(result.meta, (entry) => entry.privateData.action === "apply");
    mutate(result.meta);
    const before = structuredClone(result.meta);
    await assert.rejects(
      commitPactTransactionV08(result.meta, request(apply), result.context),
      /META_TRANSACTION_STALE_/u
    );
    assert.deepEqual(result.meta, before);
  }
  {
    const result = pactSetup("pact_wrong_binding", 45);
    result.meta = await issuePactOfferV08(result.meta, result.context);
    const apply = findChoice(result.meta, (entry) => entry.privateData.action === "apply");
    await assert.rejects(
      commitPactTransactionV08(
        result.meta,
        request(apply),
        { ...result.context, runId: "wrong" }
      ),
      /META_TRANSACTION_BINDING_MISMATCH/u
    );
    await assert.rejects(
      commitPactTransactionV08(
        result.meta,
        request(apply),
        { ...result.context, rulesetHash: "sha256:wrong" }
      ),
      /META_TRANSACTION_BINDING_MISMATCH/u
    );
  }
});

test("128 seeded Camp and 128 seeded Pact cases are deterministic and atomic", async () => {
  const caseCount = 128;
  for (let seed = 0; seed < caseCount; seed += 1) {
    const camp = await campSetup(`camp_property_${seed}`, 10000);
    camp.meta = await issueCampTransactionsV08(camp.meta, camp.context);
    const selected = findChoice(
      camp.meta,
      (entry) =>
        entry.privateData.action === "upgrade" &&
        entry.privateData.upgradeId === campPolicy.upgrades[seed % 10].id
    );
    const committed = await commitCampTransactionV08(
      camp.meta,
      request(selected),
      camp.context
    );
    assert.equal(committed.metaTransactionReceipts.length, 1);
    assertCanonicalRelicBuildV08(committed.build);
  }
  for (let seed = 0; seed < caseCount; seed += 1) {
    const runId = `pact_property_${seed}`;
    const left = pactSetup(runId, 25 + seed % 40);
    const right = pactSetup(runId, 25 + seed % 40);
    left.meta = await issuePactOfferV08(left.meta, left.context);
    right.meta = await issuePactOfferV08(right.meta, right.context);
    assert.deepEqual(left.meta.pendingInventory, right.meta.pendingInventory);
    const selected = findChoice(left.meta, (entry) => entry.privateData.action === "apply");
    const committed = await commitPactTransactionV08(
      left.meta,
      request(selected),
      left.context
    );
    assert.equal(committed.metaSourceConsumptions.length, 1);
    assertMetaStateV08(committed);
  }
  console.info(`M1 Camp property cases: ${caseCount}`);
  console.info(`M1 Pact property cases: ${caseCount}`);
});
