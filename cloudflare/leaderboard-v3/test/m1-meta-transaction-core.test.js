import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  META_TRANSACTION_RECEIPT_LIMIT,
  awardCanonicalGoldV08,
  commitMetaTransactionV08,
  computeMetaTransactionStateDigestV08,
  issueMetaTransactionOfferV08,
  projectPublicMetaTransactionOfferV08,
  spendCanonicalGoldV08
} from "../src/rulesets/v08-meta-1/meta-transaction.js";
import {
  assertMetaStateV08,
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(await readFile(
  path.join(
    WORKER_ROOT,
    "src",
    "rulesets",
    "v08-meta-1",
    "test",
    "m1-meta-transaction-core-golden-fixtures.json"
  ),
  "utf8"
));
const SECRET = "m1-meta-core:0123456789abcdef0123456789abcdef";

function oracle(seed) {
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
    }
  };
}

function context(runId, seed = runId) {
  return {
    runId,
    rulesetHash: manifest.rulesetHash,
    season: "season-m1",
    startedAt: 1_700_001_000_000,
    secret: SECRET,
    randomOracle: oracle(seed)
  };
}

function state(runId = "meta_core", runGold = 100, campGold = 40) {
  const resolvedContext = context(runId);
  const meta = createInitialMetaStateV08({}, resolvedContext);
  meta.status = "active";
  meta.gold = runGold;
  meta.goldLedger.earnedServerDerived = runGold;
  meta.campGold = campGold;
  meta.goldLedger.campEarnedServerDerived = campGold;
  return { meta, resolvedContext };
}

function offerSpec() {
  return {
    sourceType: "fixture",
    sourceId: "m1-core",
    sourcePolicyVersion: "fixture-1",
    sourceBinding: { fixture: true },
    choices: [
      {
        kind: "buy",
        label: "Buy",
        publicData: { price: 30, currency: "run_then_camp" },
        privateData: { cost: 30, currency: "run_then_camp" }
      },
      {
        kind: "award",
        label: "Award",
        publicData: { amount: 7, currency: "camp_gold" },
        privateData: { amount: 7, currency: "camp_gold" }
      }
    ]
  };
}

async function issued(runId = "meta_core", runGold = 100, campGold = 40, seed = runId) {
  const current = state(runId, runGold, campGold);
  current.resolvedContext.randomOracle = oracle(seed);
  current.meta = await issueMetaTransactionOfferV08(
    current.meta,
    offerSpec(),
    current.resolvedContext
  );
  return current;
}

function requestFor(meta, index = 0) {
  const choice = meta.pendingInventory.choices[index];
  return { transactionId: choice.transactionId, choiceId: choice.choiceId };
}

async function evaluator({ state: next, choice }) {
  if (choice.kind === "buy") {
    const payment = spendCanonicalGoldV08(
      next,
      choice.privateData.cost,
      choice.privateData.currency
    );
    return {
      nextState: next,
      consumeOffer: false,
      authoritativeCost: payment,
      publicResult: { purchased: true }
    };
  }
  const reward = awardCanonicalGoldV08(
    next,
    choice.privateData.amount,
    choice.privateData.currency
  );
  return {
    nextState: next,
    consumeOffer: true,
    authoritativeReward: reward,
    publicResult: { awarded: true }
  };
}

test("M1 core golden corpus has 12 explicit cases", () => {
  assert.equal(fixtures.length, 12);
  assert.equal(new Set(fixtures.map((fixture) => fixture.fixtureId)).size, 12);
  assert.ok(fixtures.every((fixture) => fixture.expected));
});

test("server issues canonical source, offer, choice and transaction IDs with private data hidden", async () => {
  const { meta } = await issued("core_ids");
  const offer = meta.pendingInventory;
  assert.match(offer.sourceInstanceId, /^meta_source_[a-f0-9]{32}$/u);
  assert.match(offer.offerId, /^meta_offer_[a-f0-9]{32}$/u);
  assert.match(offer.choices[0].transactionId, /^meta_tx_[a-f0-9]{32}$/u);
  assert.match(offer.choices[0].choiceId, /^meta_choice_[a-f0-9]{32}$/u);
  assert.equal(offer.runId, meta.runId);
  assert.equal(offer.rulesetHash, manifest.rulesetHash);
  assert.equal(offer.issuedRevision, meta.revision);
  assert.equal(offer.issuedBuildDigest, meta.build.buildDigest);
  assert.match(offer.issuedStateDigest, /^sha256:[a-f0-9]{64}$/u);
  const projected = projectPublicMetaTransactionOfferV08(offer);
  assert.equal(JSON.stringify(projected).includes("privateData"), false);
  assert.equal(projected.choices[0].price, 30);
});

test("immutable commit spends canonical run gold first, marks only one slot sold and rebinds the rest", async () => {
  const { meta, resolvedContext } = await issued("core_commit", 20, 20);
  const before = structuredClone(meta);
  const committed = await commitMetaTransactionV08(
    meta,
    requestFor(meta, 0),
    evaluator,
    resolvedContext
  );
  assert.deepEqual(meta, before);
  assert.equal(committed.gold, 0);
  assert.equal(committed.campGold, 10);
  assert.equal(committed.goldLedger.spentServerDerived, 20);
  assert.equal(committed.goldLedger.campSpentServerDerived, 10);
  assert.equal(committed.pendingInventory.choices[0].status, "sold");
  assert.equal(committed.pendingInventory.choices[1].status, "available");
  assert.notEqual(
    committed.pendingInventory.issuedStateDigest,
    meta.pendingInventory.issuedStateDigest
  );
  assertMetaStateV08(committed);
});

test("exact retry does not reapply and conflicting retry is rejected", async () => {
  const { meta, resolvedContext } = await issued("core_retry");
  const request = requestFor(meta, 0);
  const committed = await commitMetaTransactionV08(meta, request, evaluator, resolvedContext);
  assert.deepEqual(
    await commitMetaTransactionV08(committed, request, evaluator, resolvedContext),
    committed
  );
  await assert.rejects(
    commitMetaTransactionV08(
      committed,
      { transactionId: request.transactionId, choiceId: requestFor(meta, 1).choiceId },
      evaluator,
      resolvedContext
    ),
    /META_TRANSACTION_IDEMPOTENCY_PAYLOAD_MISMATCH/u
  );
});

test("unknown client price, amount, target, result and final state fields fail closed", async () => {
  for (const field of [
    "price",
    "amount",
    "gold",
    "target",
    "rarity",
    "stacks",
    "rngResult",
    "resultingBuild",
    "resultingState"
  ]) {
    const { meta, resolvedContext } = await issued(`core_fake_${field}`);
    await assert.rejects(
      commitMetaTransactionV08(
        meta,
        { ...requestFor(meta), [field]: "forged" },
        evaluator,
        resolvedContext
      ),
      new RegExp(`META_TRANSACTION_REQUEST_UNKNOWN_FIELD:${field}`, "u")
    );
  }
});

test("stale revision, build/state digest, run and ruleset bindings fail before mutation", async () => {
  const cases = [
    ["revision", (meta) => { meta.revision += 1; }, /META_TRANSACTION_STALE_REVISION/u],
    ["build", (meta) => { meta.build.buildDigest = "sha256:" + "0".repeat(64); }, /META_TRANSACTION_STALE_BUILD_DIGEST/u],
    ["state", (meta) => { meta.gold += 1; meta.goldLedger.earnedServerDerived += 1; }, /META_TRANSACTION_STALE_STATE_DIGEST/u]
  ];
  for (const [label, mutate, pattern] of cases) {
    const { meta, resolvedContext } = await issued(`core_stale_${label}`);
    mutate(meta);
    const before = structuredClone(meta);
    await assert.rejects(
      commitMetaTransactionV08(meta, requestFor(meta), evaluator, resolvedContext),
      pattern
    );
    assert.deepEqual(meta, before);
  }
  for (const [field, value] of [
    ["runId", "other-run"],
    ["rulesetHash", "sha256:other"]
  ]) {
    const { meta, resolvedContext } = await issued(`core_foreign_${field}`);
    await assert.rejects(
      commitMetaTransactionV08(
        meta,
        requestFor(meta),
        evaluator,
        { ...resolvedContext, [field]: value }
      ),
      /META_TRANSACTION_BINDING_MISMATCH/u
    );
  }
});

test("insufficient funds and evaluator failure roll back the complete input", async () => {
  {
    const { meta, resolvedContext } = await issued("core_insufficient", 4, 5);
    const before = structuredClone(meta);
    await assert.rejects(
      commitMetaTransactionV08(meta, requestFor(meta), evaluator, resolvedContext),
      /INSUFFICIENT_GOLD/u
    );
    assert.deepEqual(meta, before);
  }
  {
    const { meta, resolvedContext } = await issued("core_throw");
    const before = structuredClone(meta);
    await assert.rejects(
      commitMetaTransactionV08(meta, requestFor(meta), ({ state: next }) => {
        next.gold = 0;
        throw new TypeError("FIXTURE_FAILURE");
      }, resolvedContext),
      /FIXTURE_FAILURE/u
    );
    assert.deepEqual(meta, before);
  }
});

test("serialization, restart determinism, second choice and bounded receipts remain stable", async () => {
  const left = await issued("core_restart", 100, 40, "shared-seed");
  const right = await issued("core_restart", 100, 40, "shared-seed");
  assert.deepEqual(left.meta.pendingInventory, right.meta.pendingInventory);
  assert.deepEqual(JSON.parse(JSON.stringify(left.meta)), left.meta);
  let committed = await commitMetaTransactionV08(
    left.meta,
    requestFor(left.meta, 0),
    evaluator,
    left.resolvedContext
  );
  committed = await commitMetaTransactionV08(
    committed,
    requestFor(committed, 1),
    evaluator,
    left.resolvedContext
  );
  assert.equal(committed.campGold, 47);
  assert.equal(committed.pendingInventory, null);
  const bounded = await issued("core_bounded");
  bounded.meta.metaTransactionReceipts = Array.from(
    { length: META_TRANSACTION_RECEIPT_LIMIT },
    (_, index) => ({
      policyVersion: "old",
      transactionId: `old_tx_${index}`,
      choiceId: `old_choice_${index}`,
      requestDigest: `old_request_${index}`,
      resultingStateDigest: `old_state_${index}`,
      sourceType: "old",
      sourceId: "old",
      sourceInstanceId: "old",
      offerId: "old",
      kind: "old"
    })
  );
  const final = await commitMetaTransactionV08(
    bounded.meta,
    requestFor(bounded.meta),
    evaluator,
    bounded.resolvedContext
  );
  assert.equal(final.metaTransactionReceipts.length, META_TRANSACTION_RECEIPT_LIMIT);
  assert.equal(
    final.metaTransactionReceipts.at(-1).transactionId,
    requestFor(bounded.meta).transactionId
  );
  assert.match(await computeMetaTransactionStateDigestV08(final), /^sha256:/u);
});

test("256 seeded property cases preserve balances, deterministic IDs and at-most-once commit", async () => {
  const caseCount = 256;
  for (let seed = 0; seed < caseCount; seed += 1) {
    const runGold = seed % 61;
    const campGold = 40 - (seed % 11);
    const runId = `core_property_${seed}`;
    const first = await issued(runId, runGold, campGold, `seed-${seed}`);
    const second = await issued(runId, runGold, campGold, `seed-${seed}`);
    assert.deepEqual(first.meta.pendingInventory, second.meta.pendingInventory);
    const request = requestFor(first.meta);
    const committed = await commitMetaTransactionV08(
      first.meta,
      request,
      evaluator,
      first.resolvedContext
    );
    assert.equal(committed.gold + committed.campGold, runGold + campGold - 30);
    assert.equal(
      committed.goldLedger.spentServerDerived +
        committed.goldLedger.campSpentServerDerived,
      30
    );
    assert.deepEqual(
      await commitMetaTransactionV08(
        committed,
        request,
        evaluator,
        first.resolvedContext
      ),
      committed
    );
  }
  console.info(`M1 core property cases: ${caseCount}`);
});
