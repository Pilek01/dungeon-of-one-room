import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceCrossroadsTurnsV08,
  commitCrossroadsTransactionV08,
  issueCrossroadsOfferV08
} from "../src/rulesets/v08-meta-1/crossroads-policy.js";
import {
  assertCanonicalRelicBuildV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import {
  assertMetaStateV08,
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  issueMetaTransactionOfferV08,
  projectPublicMetaTransactionOfferV08
} from "../src/rulesets/v08-meta-1/meta-transaction.js";
import policyDocument from "../src/rulesets/v08-meta-1/data/crossroads-transaction-policy.generated.json" with { type: "json" };
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(await readFile(
  path.join(
    WORKER_ROOT,
    "src",
    "rulesets",
    "v08-meta-1",
    "test",
    "m1-crossroads-golden-fixtures.json"
  ),
  "utf8"
));
const policy = policyDocument.canonicalData;
const SECRET = "m1-crossroads:0123456789abcdef0123456789abcdef";

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

function setup(runId, depth = 25, controls = {}) {
  const context = {
    runId,
    rulesetHash: manifest.rulesetHash,
    season: "season-m1",
    startedAt: 1_700_001_300_000,
    secret: SECRET,
    randomOracle: oracle(runId, controls)
  };
  const meta = createInitialMetaStateV08({}, context);
  meta.status = "active";
  meta.build.resources.hp = 20;
  meta.build.resources.maxHp = 100;
  meta.build.resources.potions = 0;
  meta.build.resources.maxPotions = 3;
  meta.build.resources.skillCooldowns = { dash: 2, aoe: 3, shield: 4 };
  meta.currentRoomDirective = {
    directiveId: `crossroads_directive_${runId}`,
    runId,
    revision: meta.revision,
    depth,
    roomIndex: depth,
    roomType: "crossroads"
  };
  return { meta, context };
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
  assert.ok(choice, "expected Crossroads choice");
  return choice;
}

test("M1 Crossroads golden corpus has 24 source-bound cases", () => {
  assert.equal(fixtures.length, 24);
  assert.equal(new Set(fixtures.map((fixture) => fixture.fixtureId)).size, 24);
  assert.ok(policy.sourceEvidence.length >= 3);
});

test("Crossroads policy preserves POWER and MERCY baseline constants", () => {
  assert.equal(policy.power.requiresConfirmation, true);
  assert.equal(policy.power.maxHpCostMultiplier, 0.15);
  assert.equal(policy.power.minimumMaxHpCost, 1);
  assert.equal(policy.power.durationTurns, 100);
  assert.deepEqual(policy.power.eligibleRarities, ["epic", "legendary", "mythic"]);
  assert.equal(policy.power.baseChoiceCount, 3);
  assert.equal(policy.power.emptyPoolFallback.baseGold, 80);
  assert.equal(policy.mercy.requiresConfirmation, false);
  assert.equal(policy.mercy.avarice.baseGoldPerEmptySlot, 12);
});

test("canonical offer is deterministic, source-bound and hides private authority", async () => {
  const left = setup("crossroads_deterministic", 30);
  const right = setup("crossroads_deterministic", 30);
  left.meta = await issueCrossroadsOfferV08(left.meta, left.context);
  right.meta = await issueCrossroadsOfferV08(right.meta, right.context);
  assert.deepEqual(left.meta.pendingInventory, right.meta.pendingInventory);
  const offer = left.meta.pendingInventory;
  assert.equal(offer.sourceBinding.directiveId, left.meta.currentRoomDirective.directiveId);
  const publicOffer = projectPublicMetaTransactionOfferV08(offer);
  assert.equal(JSON.stringify(publicOffer).includes("privateData"), false);
  assert.ok(publicOffer.choices.every((choice) => choice.transactionId && choice.choiceId));
  assert.equal(
    publicOffer.choices.filter((choice) => choice.kind === "crossroads_mercy").length,
    1
  );
});

test("POWER applies rounded max-HP cost, canonical relic and exact retry once", async () => {
  const result = setup("crossroads_power", 30);
  result.meta = await issueCrossroadsOfferV08(result.meta, result.context);
  const power = findChoice(
    result.meta,
    (entry) => entry.privateData.action === "power_acquire"
  );
  const committed = await commitCrossroadsTransactionV08(
    result.meta,
    request(power),
    result.context
  );
  assert.equal(committed.build.resources.maxHp, 85);
  assert.equal(committed.build.resources.hp, 20);
  assert.equal(committed.build.resources.crossroadsPowerMaxHpPenalty, 15);
  assert.equal(committed.build.resources.crossroadsPowerExpireTurn, 100);
  assert.equal(committed.specialRoomScheduleState.crossroadsPenaltyActive, true);
  assert.equal(committed.metaSourceConsumptions.length, 1);
  assert.equal(committed.pendingInventory, null);
  assertCanonicalRelicBuildV08(committed.build);
  assert.deepEqual(
    await commitCrossroadsTransactionV08(committed, request(power), result.context),
    committed
  );
  assert.equal(committed.metaTransactionReceipts.length, 1);
  await assert.rejects(
    commitCrossroadsTransactionV08(
      committed,
      { transactionId: power.transactionId, choiceId: "conflict" },
      result.context
    ),
    /META_TRANSACTION_IDEMPOTENCY_PAYLOAD_MISMATCH/u
  );
});

test("POWER skip keeps the penalty and expiry restores exactly once", async () => {
  const result = setup("crossroads_power_skip", 30);
  result.meta.build.resources.hp = 100;
  result.meta = await issueCrossroadsOfferV08(result.meta, result.context);
  const skip = findChoice(
    result.meta,
    (entry) => entry.privateData.action === "power_skip"
  );
  const committed = await commitCrossroadsTransactionV08(
    result.meta,
    request(skip),
    result.context
  );
  assert.equal(committed.build.relics.length, 0);
  assert.equal(committed.build.resources.maxHp, 85);
  assert.equal(committed.build.resources.hp, 85);
  const beforeExpiry = advanceCrossroadsTurnsV08(committed, 99);
  assert.equal(beforeExpiry.build.resources.maxHp, 85);
  const expired = advanceCrossroadsTurnsV08(beforeExpiry, 1);
  assert.equal(expired.build.resources.maxHp, 100);
  assert.equal(expired.build.resources.crossroadsPowerMaxHpPenalty, 0);
  assert.equal(expired.build.resources.crossroadsPowerExpireTurn, -1);
  assert.equal(expired.specialRoomScheduleState.crossroadsPenaltyActive, false);
});

test("MERCY heals, resets cooldowns, refills potions and closes POWER", async () => {
  const result = setup("crossroads_mercy", 30);
  result.meta = await issueCrossroadsOfferV08(result.meta, result.context);
  const mercy = findChoice(result.meta, (entry) => entry.privateData.action === "mercy");
  const committed = await commitCrossroadsTransactionV08(
    result.meta,
    request(mercy),
    result.context
  );
  assert.equal(committed.build.resources.hp, 100);
  assert.equal(committed.build.resources.potions, 3);
  assert.deepEqual(
    committed.build.resources.skillCooldowns,
    { dash: 0, aoe: 0, shield: 0 }
  );
  assert.equal(committed.gold, 0);
  assert.equal(committed.metaSourceConsumptions.length, 1);
  await assert.rejects(
    issueCrossroadsOfferV08(committed, result.context),
    /CROSSROADS_SOURCE_ALREADY_CONSUMED/u
  );
});

test("MERCY with Avarice converts empty potion slots to modified canonical gold", async () => {
  const result = setup("crossroads_mercy_avarice", 30);
  result.meta.build.pacts = ["avarice"];
  result.meta = await issueCrossroadsOfferV08(result.meta, result.context);
  const mercy = findChoice(result.meta, (entry) => entry.privateData.action === "mercy");
  const committed = await commitCrossroadsTransactionV08(
    result.meta,
    request(mercy),
    result.context
  );
  assert.equal(committed.build.resources.potions, 0);
  assert.equal(committed.gold, 50);
  assert.equal(committed.goldLedger.earnedServerDerived, 50);
  assert.equal(
    committed.metaTransactionReceipts.at(-1).authoritativeReward.avariceBaseGold,
    36
  );
});

test("empty POWER fallback retains penalty and awards only canonical modified base 80 gold", async () => {
  const result = setup("crossroads_power_fallback", 30);
  result.meta = await issueMetaTransactionOfferV08(result.meta, {
    sourceType: "crossroads",
    sourceId: "crossroads-choice",
    sourcePolicyVersion: policy.policyVersion,
    sourceBinding: {
      directiveId: result.meta.currentRoomDirective.directiveId,
      depth: 30,
      roomIndex: 30
    },
    choices: [{
      kind: "crossroads_power_fallback",
      label: "Confirm POWER empty fallback",
      publicData: { action: "power_fallback", baseGold: 80 },
      privateData: { action: "power_fallback" }
    }]
  }, result.context);
  const fallback = result.meta.pendingInventory.choices[0];
  const committed = await commitCrossroadsTransactionV08(
    result.meta,
    request(fallback),
    result.context
  );
  assert.equal(committed.gold, 80);
  assert.equal(committed.build.resources.maxHp, 85);
  assert.equal(committed.metaTransactionReceipts.at(-1).authoritativeReward.baseGold, 80);
});

test("fake price, amount, HP, target, rarity and result fail before mutation at zero gold", async () => {
  const result = setup("crossroads_fake_fields", 30);
  result.meta = await issueCrossroadsOfferV08(result.meta, result.context);
  const power = findChoice(
    result.meta,
    (entry) => entry.privateData.action === "power_acquire"
  );
  for (const [field, value] of [
    ["price", 1],
    ["amount", 0],
    ["gold", 999999],
    ["hp", 999],
    ["target", "forged"],
    ["rarity", "mythic"],
    ["result", "forged"]
  ]) {
    const before = structuredClone(result.meta);
    await assert.rejects(
      commitCrossroadsTransactionV08(
        result.meta,
        request(power, { [field]: value }),
        result.context
      ),
      new RegExp(`META_TRANSACTION_REQUEST_UNKNOWN_FIELD:${field}`, "u")
    );
    assert.deepEqual(result.meta, before);
  }
  const corrupted = structuredClone(result.meta);
  const corruptedChoice = corrupted.pendingInventory.choices.find(
    (entry) => entry.transactionId === power.transactionId
  );
  corruptedChoice.privateData.relicId = "unknown_relic";
  const before = structuredClone(corrupted);
  await assert.rejects(
    commitCrossroadsTransactionV08(corrupted, request(power), result.context),
    /RELIC_UNKNOWN/u
  );
  assert.deepEqual(corrupted, before);
});

test("stale revision, digest, source, run and ruleset fail closed after restart", async () => {
  const mutations = [
    (meta) => { meta.revision += 1; },
    (meta) => { meta.build.resources.hp += 1; },
    (meta) => { meta.currentRoomDirective.directiveId = "foreign_crossroads"; }
  ];
  for (const [index, mutate] of mutations.entries()) {
    const result = setup(`crossroads_stale_${index}`, 30);
    result.meta = await issueCrossroadsOfferV08(result.meta, result.context);
    const mercy = findChoice(result.meta, (entry) => entry.privateData.action === "mercy");
    result.meta = JSON.parse(JSON.stringify(result.meta));
    mutate(result.meta);
    const before = structuredClone(result.meta);
    await assert.rejects(
      commitCrossroadsTransactionV08(result.meta, request(mercy), result.context),
      /META_TRANSACTION_STALE_/u
    );
    assert.deepEqual(result.meta, before);
  }
  {
    const result = setup("crossroads_binding", 30);
    result.meta = await issueCrossroadsOfferV08(result.meta, result.context);
    const mercy = findChoice(result.meta, (entry) => entry.privateData.action === "mercy");
    await assert.rejects(
      commitCrossroadsTransactionV08(
        result.meta,
        request(mercy),
        { ...result.context, runId: "wrong" }
      ),
      /META_TRANSACTION_BINDING_MISMATCH/u
    );
    await assert.rejects(
      commitCrossroadsTransactionV08(
        result.meta,
        request(mercy),
        { ...result.context, rulesetHash: "sha256:wrong" }
      ),
      /META_TRANSACTION_BINDING_MISMATCH/u
    );
  }
});

test("128 seeded Crossroads cases preserve deterministic choices and single consumption", async () => {
  const caseCount = 128;
  for (let seed = 0; seed < caseCount; seed += 1) {
    const runId = `crossroads_property_${seed}`;
    const left = setup(runId, 10 + seed % 50);
    const right = setup(runId, 10 + seed % 50);
    left.meta = await issueCrossroadsOfferV08(left.meta, left.context);
    right.meta = await issueCrossroadsOfferV08(right.meta, right.context);
    assert.deepEqual(left.meta.pendingInventory, right.meta.pendingInventory);
    const selected = seed % 2 === 0
      ? findChoice(left.meta, (entry) => entry.privateData.action === "mercy")
      : findChoice(
          left.meta,
          (entry) => ["power_acquire", "power_skip"].includes(entry.privateData.action)
        );
    const committed = await commitCrossroadsTransactionV08(
      left.meta,
      request(selected),
      left.context
    );
    assertCanonicalRelicBuildV08(committed.build);
    assertMetaStateV08(committed);
    assert.equal(committed.metaSourceConsumptions.length, 1);
    assert.equal(committed.metaTransactionReceipts.length, 1);
    assert.deepEqual(
      await commitCrossroadsTransactionV08(committed, request(selected), left.context),
      committed
    );
  }
  console.info(`M1 Crossroads property cases: ${caseCount}`);
});
