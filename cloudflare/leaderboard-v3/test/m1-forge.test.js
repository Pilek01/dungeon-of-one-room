import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  commitForgeTransactionV08,
  issueForgeTemperOfferV08,
  issueForgeTransmuteOfferV08
} from "../src/rulesets/v08-meta-1/forge-policy.js";
import {
  applyRelicAcquisition,
  assertCanonicalRelicBuildV08,
  getRelicCatalogEntryV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import {
  assertMetaStateV08,
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import policyDocument from "../src/rulesets/v08-meta-1/data/forge-transaction-policy.generated.json" with { type: "json" };
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(await readFile(
  path.join(
    WORKER_ROOT,
    "src",
    "rulesets",
    "v08-meta-1",
    "test",
    "m1-forge-golden-fixtures.json"
  ),
  "utf8"
));
const policy = policyDocument.canonicalData;
const SECRET = "m1-forge:0123456789abcdef0123456789abcdef";

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

function setup(runId, depth = 25, controls = {}, gold = 0) {
  const context = {
    runId,
    rulesetHash: manifest.rulesetHash,
    season: "season-m1",
    startedAt: 1_700_001_200_000,
    secret: SECRET,
    randomOracle: oracle(runId, controls)
  };
  const meta = createInitialMetaStateV08({}, context);
  meta.status = "active";
  meta.gold = gold;
  meta.goldLedger.earnedServerDerived = gold;
  meta.currentRoomDirective = {
    directiveId: `forge_directive_${runId}`,
    runId,
    revision: meta.revision,
    depth,
    roomIndex: depth,
    roomType: "forge"
  };
  return { meta, context };
}

async function addRelics(meta, relicIds) {
  for (const [index, relicId] of relicIds.entries()) {
    meta.build = await applyRelicAcquisition(meta.build, {
      relicId,
      acquiredRevision: index,
      acquisitionSource: "fixture",
      sourceOfferId: `forge_fixture_${index}`
    });
  }
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
  assert.ok(choice, "expected Forge choice");
  return choice;
}

test("M1 Forge golden corpus has 24 source-bound cases", () => {
  assert.equal(fixtures.length, 24);
  assert.equal(new Set(fixtures.map((fixture) => fixture.fixtureId)).size, 24);
  assert.ok(policy.sourceEvidence.length >= 3);
});

test("Forge policy preserves profiles, zero cost, consumption and cancel rules", () => {
  assert.deepEqual(
    policy.profiles.map(({ minDepth, label, allowedRarities }) => ({
      minDepth,
      label,
      allowedRarities
    })),
    [
      { minDepth: 0, label: "Tempered", allowedRarities: ["rare", "epic"] },
      {
        minDepth: 20,
        label: "Masterwork",
        allowedRarities: ["rare", "epic", "legendary"]
      },
      {
        minDepth: 40,
        label: "Mythforged",
        allowedRarities: ["epic", "legendary", "mythic"]
      }
    ]
  );
  assert.deepEqual(policy.cost, { amount: 0, currency: "run_gold" });
  assert.equal(policy.temper.outputCount, 1);
  assert.equal(policy.transmute.outputCount, 3);
  assert.equal(policy.transmute.uniqueOutputs, true);
});

test("Temper is deterministic, server-bound, zero-cost and consumes its source once", async () => {
  const left = setup("forge_temper_deterministic", 25);
  const right = setup("forge_temper_deterministic", 25);
  left.meta = await issueForgeTemperOfferV08(left.meta, left.context);
  right.meta = await issueForgeTemperOfferV08(right.meta, right.context);
  assert.deepEqual(left.meta.pendingInventory, right.meta.pendingInventory);
  assert.deepEqual(left.meta.metaSourceConsumptions, right.meta.metaSourceConsumptions);
  assert.equal(left.meta.metaSourceConsumptions.length, 1);
  const acquire = findChoice(left.meta, (entry) => entry.privateData.action === "temper");
  const beforeGold = left.meta.gold;
  const committed = await commitForgeTransactionV08(
    left.meta,
    request(acquire),
    left.context
  );
  assert.equal(committed.gold, beforeGold);
  assert.equal(committed.pendingInventory, null);
  assertCanonicalRelicBuildV08(committed.build);
  await assert.rejects(
    issueForgeTemperOfferV08(committed, left.context),
    /FORGE_SOURCE_ALREADY_CONSUMED/u
  );
});

test("Temper replacement is immutable and exact retry never duplicates the relic", async () => {
  const result = setup("forge_temper_replacement", 25);
  result.meta = await addRelics(result.meta, [
    "fang",
    "plating",
    "lucky",
    "flask",
    "lifebloom",
    "idol",
    "quickloader",
    "bloodvial"
  ]);
  result.meta = await issueForgeTemperOfferV08(result.meta, result.context);
  const choice = findChoice(
    result.meta,
    (entry) => entry.privateData.action === "temper"
  );
  const committed = await commitForgeTransactionV08(
    result.meta,
    request(choice),
    result.context
  );
  assert.deepEqual(
    await commitForgeTransactionV08(committed, request(choice), result.context),
    committed
  );
  assert.equal(committed.metaTransactionReceipts.length, 1);
  await assert.rejects(
    commitForgeTransactionV08(
      committed,
      {
        transactionId: choice.transactionId,
        choiceId: "conflicting_choice"
      },
      result.context
    ),
    /META_TRANSACTION_IDEMPOTENCY_PAYLOAD_MISMATCH/u
  );
  assertCanonicalRelicBuildV08(committed.build);
});

test("Transmute binds canonical sacrifice and result and commits both atomically", async () => {
  const result = setup("forge_transmute_atomic", 25);
  result.meta = await addRelics(result.meta, ["fang", "idol"]);
  const before = structuredClone(result.meta.build);
  result.meta = await issueForgeTransmuteOfferV08(result.meta, result.context);
  const choice = findChoice(
    result.meta,
    (entry) =>
      entry.privateData.action === "transmute" &&
      entry.privateData.sacrificeRelicId === "fang"
  );
  const resultRelic = getRelicCatalogEntryV08(choice.privateData.resultRelicId);
  assert.notEqual(choice.privateData.resultRelicId, "fang");
  assert.ok(["rare", "epic", "legendary"].includes(resultRelic.rarity));
  const committed = await commitForgeTransactionV08(
    result.meta,
    request(choice),
    result.context
  );
  assert.equal(
    committed.build.relics.some((entry) => entry.relicId === "fang"),
    false
  );
  assert.equal(
    committed.build.relics.some(
      (entry) => entry.relicId === choice.privateData.resultRelicId
    ),
    true
  );
  assert.notDeepEqual(committed.build, before);
  assertCanonicalRelicBuildV08(committed.build);
  assert.deepEqual(
    await commitForgeTransactionV08(committed, request(choice), result.context),
    committed
  );
});

test("Transmute with eight relics offers exactly three results for the selected sacrifice", async () => {
  const result = setup("forge_transmute_full_selected", 25);
  result.meta = await addRelics(result.meta, [
    "fang", "plating", "lucky", "flask",
    "lifebloom", "idol", "quickloader", "bloodvial"
  ]);
  result.meta = await issueForgeTransmuteOfferV08(result.meta, {
    ...result.context,
    sacrificeRelicId: "fang"
  });
  const choices = result.meta.pendingInventory.choices.filter(
    (entry) => entry.privateData.action === "transmute"
  );
  assert.equal(choices.length, 3);
  assert.equal(choices.every(
    (entry) => entry.privateData.sacrificeRelicId === "fang"
  ), true);
  assert.equal(new Set(choices.map(
    (entry) => entry.privateData.resultRelicId
  )).size, 3);
});

test("Transmute rejects a sacrifice that is not in the canonical build", async () => {
  const result = setup("forge_transmute_missing_selected", 25);
  result.meta = await addRelics(result.meta, ["fang"]);
  await assert.rejects(
    issueForgeTransmuteOfferV08(result.meta, {
      ...result.context,
      sacrificeRelicId: "idol"
    }),
    /FORGE_TRANSMUTE_SACRIFICE_NOT_OWNED/u
  );
  assert.equal(result.meta.pendingInventory, null);
  assert.equal(result.meta.currentRoomDirective.forgeConsumed, undefined);
});

test("leave retains build while Forge stays consumed across serialization restart", async () => {
  const result = setup("forge_transmute_leave", 45);
  result.meta = await addRelics(result.meta, ["quickloader"]);
  result.meta = await issueForgeTransmuteOfferV08(result.meta, result.context);
  const serialized = JSON.parse(JSON.stringify(result.meta));
  const leave = findChoice(serialized, (entry) => entry.privateData.action === "leave");
  const committed = await commitForgeTransactionV08(
    serialized,
    request(leave),
    result.context
  );
  assert.deepEqual(committed.build, result.meta.build);
  assert.equal(committed.metaSourceConsumptions.length, 1);
  assertMetaStateV08(committed);
  assert.deepEqual(
    await commitForgeTransactionV08(committed, request(leave), result.context),
    committed
  );
});

test("fake price, gold, target and RNG result fail closed with no mutation", async () => {
  const result = setup("forge_fake_fields", 25);
  result.meta = await addRelics(result.meta, ["fang"]);
  result.meta = await issueForgeTransmuteOfferV08(result.meta, result.context);
  const choice = findChoice(result.meta, (entry) => entry.privateData.action === "transmute");
  for (const [field, value] of [
    ["price", 0],
    ["gold", 999999],
    ["target", "forged_target"],
    ["result", "forged_result"],
    ["rarity", "mythic"],
    ["stacks", 99]
  ]) {
    const before = structuredClone(result.meta);
    await assert.rejects(
      commitForgeTransactionV08(
        result.meta,
        request(choice, { [field]: value }),
        result.context
      ),
      new RegExp(`META_TRANSACTION_REQUEST_UNKNOWN_FIELD:${field}`, "u")
    );
    assert.deepEqual(result.meta, before);
  }
  const corrupted = structuredClone(result.meta);
  const corruptedChoice = corrupted.pendingInventory.choices.find(
    (entry) => entry.transactionId === choice.transactionId
  );
  corruptedChoice.privateData.resultRelicId = "unknown_relic";
  const beforeCorrupted = structuredClone(corrupted);
  await assert.rejects(
    commitForgeTransactionV08(corrupted, request(choice), result.context),
    /RELIC_UNKNOWN/u
  );
  assert.deepEqual(corrupted, beforeCorrupted);
});

test("stale revision, state, source, run and ruleset bindings roll back completely", async () => {
  const mutations = [
    (meta) => { meta.revision += 1; },
    (meta) => { meta.gold += 1; meta.goldLedger.earnedServerDerived += 1; },
    (meta) => { meta.currentRoomDirective.directiveId = "foreign_forge"; }
  ];
  for (const [index, mutate] of mutations.entries()) {
    const result = setup(`forge_stale_${index}`, 25);
    result.meta = await issueForgeTemperOfferV08(result.meta, result.context);
    const choice = findChoice(result.meta, (entry) => entry.privateData.action === "temper");
    mutate(result.meta);
    const before = structuredClone(result.meta);
    await assert.rejects(
      commitForgeTransactionV08(result.meta, request(choice), result.context),
      /META_TRANSACTION_STALE_/u
    );
    assert.deepEqual(result.meta, before);
  }
  {
    const result = setup("forge_wrong_run", 25);
    result.meta = await issueForgeTemperOfferV08(result.meta, result.context);
    const choice = findChoice(result.meta, (entry) => entry.privateData.action === "temper");
    await assert.rejects(
      commitForgeTransactionV08(
        result.meta,
        request(choice),
        { ...result.context, runId: "wrong_run" }
      ),
      /META_TRANSACTION_BINDING_MISMATCH/u
    );
  }
  {
    const result = setup("forge_wrong_ruleset", 25);
    result.meta = await issueForgeTemperOfferV08(result.meta, result.context);
    const choice = findChoice(result.meta, (entry) => entry.privateData.action === "temper");
    await assert.rejects(
      commitForgeTransactionV08(
        result.meta,
        request(choice),
        { ...result.context, rulesetHash: "sha256:wrong" }
      ),
      /META_TRANSACTION_BINDING_MISMATCH/u
    );
  }
});

test("128 seeded Forge cases preserve deterministic offers, legal builds and at-most-once sources", async () => {
  const caseCount = 128;
  for (let seed = 0; seed < caseCount; seed += 1) {
    const runId = `forge_property_${seed}`;
    const depth = seed % 3 === 0 ? 10 : seed % 3 === 1 ? 25 : 45;
    const left = setup(runId, depth);
    const right = setup(runId, depth);
    if (seed % 2 === 0) {
      left.meta = await issueForgeTemperOfferV08(left.meta, left.context);
      right.meta = await issueForgeTemperOfferV08(right.meta, right.context);
    } else {
      left.meta = await addRelics(left.meta, ["fang"]);
      right.meta = await addRelics(right.meta, ["fang"]);
      left.meta = await issueForgeTransmuteOfferV08(left.meta, left.context);
      right.meta = await issueForgeTransmuteOfferV08(right.meta, right.context);
    }
    assert.deepEqual(left.meta.pendingInventory, right.meta.pendingInventory);
    assert.deepEqual(left.meta.metaSourceConsumptions, right.meta.metaSourceConsumptions);
    const actionable = findChoice(
      left.meta,
      (entry) => entry.privateData.action !== "leave"
    );
    const committed = await commitForgeTransactionV08(
      left.meta,
      request(actionable),
      left.context
    );
    assertCanonicalRelicBuildV08(committed.build);
    assert.equal(committed.metaSourceConsumptions.length, 1);
    assert.equal(committed.metaTransactionReceipts.length, 1);
  }
  console.info(`M1 Forge property cases: ${caseCount}`);
});
