import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import catalogDocument from "../src/rulesets/v08-meta-1/data/relic-catalog.generated.json" with { type: "json" };
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };
import {
  applyRelicAcquisition,
  applyRelicReplacementBuildV08,
  assertCanonicalRelicBuildDigestV08,
  createEmptyRelicBuildV08,
  getRelicCatalogEntryV08
} from "../src/rulesets/v08-meta-1/relic-policy.js";
import {
  cancelRelicReplacement,
  commitRelicReplacement,
  createPendingRelicTransactionV08,
  evaluateRelicAcquisition,
  projectPublicRelicReplacement
} from "../src/rulesets/v08-meta-1/relic-replacement.js";
import {
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  createV08Meta1Ruleset
} from "../src/rulesets/v08-meta-1/index.js";
import fixtures, {
  PHASE3B2C2_FIXTURE_FIELDS
} from "../src/rulesets/v08-meta-1/test/phase3b2c2-golden-fixtures.js";

const catalog = catalogDocument.canonicalData.relics;
const WORKSPACE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const context = Object.freeze({
  runId: "replacement-run",
  rulesetHash: manifest.rulesetHash,
  secret: "phase3b2c2:0123456789abcdef0123456789abcdef"
});
const fullIds = [
  "fang", "plating", "lucky", "ironboots",
  "fieldrations", "trapweave", "cachekey", "scoutlens"
];

function state(runId = "replacement-run") {
  const next = createInitialMetaStateV08({}, {
    runId,
    season: "season-phase3b2c2",
    startedAt: 1_700_000_400_000
  });
  next.status = "active";
  return next;
}

async function buildWith(ids) {
  let build = createEmptyRelicBuildV08();
  for (const [revision, relicId] of ids.entries()) {
    build = await applyRelicAcquisition(build, {
      relicId,
      acquiredRevision: revision,
      acquisitionSource: "boss_drop",
      sourceOfferId: `fixture_${revision}_${relicId}`
    });
  }
  return build;
}

function acquisition(relicId, overrides = {}) {
  return {
    incomingRelicId: relicId,
    incomingStacks: 1,
    acquisitionSource: "boss_drop",
    sourceOfferId: "offer_replacement",
    sourceChoiceId: "choice_incoming",
    sourceRewardSlotId: "slot_relic",
    ...overrides
  };
}

async function decisionFor(ids, relicId, overrides = {}) {
  const meta = state(overrides.runId);
  meta.build = await buildWith(ids);
  const decision = await evaluateRelicAcquisition(
    meta,
    acquisition(relicId, overrides.acquisition),
    context
  );
  return { meta, decision };
}

async function pendingFor(ids = fullIds, relicId = "adrenal", overrides = {}) {
  const { meta, decision } = await decisionFor(ids, relicId, overrides);
  assert.equal(decision.decision, "REQUIRE_REPLACEMENT");
  meta.pendingOffer = {
    offerId: "offer_replacement",
    offerType: "relic_reward",
    choices: [{ choiceId: "choice_incoming", privateRelicId: relicId }],
    selectionPending: true,
    selectedChoiceId: "choice_incoming"
  };
  meta.currentRewardEnvelope = {
    rewardSlots: [{
      slotId: "slot_relic",
      offerId: "offer_replacement",
      consumed: false,
      resolution: "selection_pending"
    }]
  };
  meta.pendingRelicTransaction = await createPendingRelicTransactionV08(
    meta,
    decision,
    context
  );
  return meta;
}

function candidateFor(transaction, relicId) {
  return transaction.candidates.find(
    (candidate) => candidate.removals.some((removal) => removal.relicId === relicId)
  );
}

test("Phase 3B2C2 has exactly 60 schema-complete executable fixtures", () => {
  assert.equal(fixtures.length, 60);
  assert.equal(new Set(fixtures.map((fixture) => fixture.fixtureId)).size, 60);
  for (const fixture of fixtures) {
    assert.deepEqual(Object.keys(fixture), PHASE3B2C2_FIXTURE_FIELDS);
    assert.ok(fixture.legacySourceEvidence.length > 0);
    assert.equal(fixture.expectedRulesetHash, "manifest.rulesetHash");
  }
});

test("replacement source audit is complete before implementation and contains the required characterization", async () => {
  const audit = await readFile(
    path.join(WORKSPACE_ROOT, "docs", "ONLINE_V3_PHASE3B2C2.md"),
    "utf8"
  );
  for (const flowId of [
    "GLOBAL_LEGENDARY_DUEL_V08",
    "GLOBAL_CAPACITY_REPLACEMENT_V08",
    "GLOBAL_ABYSSAL_REBALANCE_V08",
    "FORGE_TRANSMUTE_V08",
    "MERCHANT_RELIC_SWAP_V08",
    "STORED_REWARD_EMPTY_FALLBACK_V08"
  ]) {
    assert.match(audit, new RegExp(flowId, "u"));
  }
  for (const field of [
    "flowId", "legacySourceFiles", "legacyFunctionOrSymbol", "trigger",
    "incomingRelicType / stacks", "reason / pendingStateFields",
    "candidateSelectionRules and exclusions", "removal / stack semantics",
    "legendary / mythic / slots / exclusions",
    "cancel, consumption, commit, fallback, resume", "sourceEvidence"
  ]) {
    assert.match(audit, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
});

test("direct acquisition regressions cover starting, Warden-source and Otter-source", async () => {
  for (const [relicId, acquisitionSource] of [
    ["fang", "starting_relic"],
    ["adrenal", "boss_drop"],
    ["adrenal", "otter"]
  ]) {
    const meta = state(`direct_${acquisitionSource}`);
    if (acquisitionSource === "starting_relic") meta.status = "awaiting_starting_relic";
    const decision = await evaluateRelicAcquisition(meta, acquisition(relicId, {
      acquisitionSource,
      sourceRewardSlotId: acquisitionSource === "starting_relic" ? null : "slot_relic"
    }));
    assert.equal(decision.decision, "ACQUIRE_DIRECT");
  }
});

test("full slots require replacement for normal, rare, epic, legendary, mythic and stackable incoming", async () => {
  for (const relicId of [
    "risk",
    "adrenal",
    "glasscannon",
    "fracturedsigil",
    "oathofruin",
    "fang"
  ]) {
    const { decision } = await decisionFor(fullIds, relicId);
    assert.equal(decision.decision, "REQUIRE_REPLACEMENT", relicId);
    assert.ok(decision.candidatePlans.length > 0, relicId);
  }
  const { decision: bonus } = await decisionFor(fullIds, "abyssalreliquary");
  assert.equal(bonus.decision, "ACQUIRE_DIRECT");
});

test("legendary and Crown Concord caps are evaluated from each complete final build", async () => {
  const ids = ["fracturedsigil", ...fullIds.slice(0, 7)];
  const { decision } = await decisionFor(ids, "chronoloop");
  assert.equal(decision.reason, "LEGENDARY_LIMIT_REACHED");
  assert.equal(decision.policyMode, "legendary_duel");
  assert.deepEqual(
    new Set(decision.candidatePlans.flatMap((candidate) =>
      candidate.removals.map((removal) => removal.relicId)
    )),
    new Set(["fracturedsigil"])
  );

  const crownBuild = [
    "crownconcord", "fracturedsigil", "chronoloop",
    "fang", "plating", "lucky", "ironboots", "fieldrations"
  ];
  const crown = await decisionFor(crownBuild, "adrenal");
  assert.equal(crown.decision.decision, "REQUIRE_REPLACEMENT");
  assert.equal(
    crown.decision.candidatePlans.some((candidate) =>
      candidate.removals.some((removal) => removal.relicId === "crownconcord")
    ),
    false
  );
});

test("mythic replacement and mutual exclusion candidates remove the current mythic", async () => {
  const ids = ["oathofruin", ...fullIds.slice(0, 7)];
  const { decision } = await decisionFor(ids, "crownconcord");
  assert.equal(decision.reason, "MYTHIC_LIMIT_REACHED");
  assert.ok(decision.candidatePlans.every(
    (candidate) => candidate.removals.some((removal) => removal.relicId === "oathofruin")
  ));
});

test("Abyssal incoming bonus applies before cost and removal lowering the limit is filtered", async () => {
  const incoming = await decisionFor(fullIds, "abyssalreliquary");
  assert.equal(incoming.decision.decision, "ACQUIRE_DIRECT");

  const legal = await decisionFor(
    ["abyssalreliquary", ...fullIds.slice(0, 7)],
    "crownconcord"
  );
  assert.ok(legal.decision.candidatePlans.some((candidate) =>
    candidate.removals.some((removal) => removal.relicId === "abyssalreliquary")
  ));

  const overloaded = await decisionFor(
    ["abyssalreliquary", ...fullIds, "risk"],
    "adrenal"
  );
  assert.equal(
    overloaded.decision.candidatePlans.some((candidate) =>
      candidate.removals.some((removal) => removal.relicId === "abyssalreliquary")
    ),
    false
  );
});

test("Abyssal mythic shift exposes only atomic complete rebalance bundles", async () => {
  const ids = ["abyssalreliquary", ...fullIds, "risk"];
  const { decision } = await decisionFor(ids, "crownconcord");
  assert.equal(decision.reason, "MYTHIC_LIMIT_REACHED");
  assert.deepEqual(decision.secondaryReasons, ["BUILD_CAPACITY_REBALANCE"]);
  assert.ok(decision.candidatePlans.length > 0);
  assert.ok(decision.candidatePlans.every((candidate) => candidate.removals.length === 3));
  assert.ok(decision.candidatePlans.every((candidate) => candidate.resultingSlotLimit === 8));
  assert.ok(decision.candidatePlans.every((candidate) => candidate.resultingSlotsUsed === 8));
});

test("stack target decrements one stack and preserves acquisition metadata and order", async () => {
  const ids = ["fang", "fang", ...fullIds.slice(1, 7)];
  const meta = await pendingFor(ids, "adrenal");
  const target = candidateFor(meta.pendingRelicTransaction, "fang");
  assert.equal(target.removals[0].targetStackDelta, -1);
  assert.equal(target.removals[0].removalMode, "decrement");
  const original = structuredClone(meta.build.relics.find((entry) => entry.relicId === "fang"));
  const committed = await commitRelicReplacement(meta, {
    transactionId: meta.pendingRelicTransaction.transactionId,
    replacementChoiceId: target.replacementChoiceId
  }, context);
  const remaining = committed.build.relics.find((entry) => entry.relicId === "fang");
  assert.equal(remaining.stacks, 1);
  assert.equal(remaining.acquiredRevision, original.acquiredRevision);
  assert.equal(remaining.acquisitionSource, original.acquisitionSource);
  assert.equal(committed.build.relics.at(-1).relicId, "adrenal");
});

test("stack cap and unique duplicate reject without mutating the state", async () => {
  const meta = state();
  meta.build = await buildWith(["fang", "fang", "fang", "fang", "fang"]);
  const before = structuredClone(meta);
  assert.deepEqual(
    await evaluateRelicAcquisition(meta, acquisition("fang")),
    { decision: "REJECT", code: "STACK_CAP_REACHED" }
  );
  assert.deepEqual(meta, before);
  meta.build = await buildWith(["adrenal"]);
  assert.deepEqual(
    await evaluateRelicAcquisition(meta, acquisition("adrenal")),
    { decision: "REJECT", code: "UNIQUE_DUPLICATE" }
  );
});

test("pending transaction and public projection are source-bound and minimal", async () => {
  const meta = await pendingFor();
  const transaction = meta.pendingRelicTransaction;
  assert.equal(transaction.runId, meta.runId);
  assert.equal(transaction.rulesetHash, manifest.rulesetHash);
  assert.equal(transaction.issuedRevision, meta.revision);
  assert.equal(transaction.issuedBuildDigest, meta.build.buildDigest);
  assert.equal(transaction.incoming.sourceOfferId, "offer_replacement");
  assert.equal(transaction.incoming.sourceRewardSlotId, "slot_relic");
  const projection = projectPublicRelicReplacement(meta);
  assert.deepEqual(Object.keys(projection), [
    "transactionId", "reason", "incoming", "choices", "cancelAllowed"
  ]);
  assert.equal(JSON.stringify(projection).includes("resultingBuildDigest"), false);
  assert.equal(JSON.stringify(projection).includes("sourceOfferId"), false);
});

test("commit is atomic, consumes source once and exact retry is idempotent", async () => {
  const meta = await pendingFor();
  const transaction = meta.pendingRelicTransaction;
  const request = {
    transactionId: transaction.transactionId,
    replacementChoiceId: transaction.candidates[0].replacementChoiceId
  };
  const before = structuredClone(meta);
  const committed = await commitRelicReplacement(meta, request, context);
  assert.deepEqual(meta, before);
  assert.equal(committed.pendingRelicTransaction, null);
  assert.equal(committed.pendingOffer, null);
  assert.equal(committed.currentRewardEnvelope.rewardSlots[0].consumed, true);
  assert.equal(committed.currentRewardEnvelope.rewardSlots[0].resolution, "replacement_committed");
  assert.equal(committed.offerSettlementHistory.length, 1);
  assert.equal(committed.relicReplacementHistory.length, 1);
  await assertCanonicalRelicBuildDigestV08(committed.build);
  assert.deepEqual(await commitRelicReplacement(committed, request, context), committed);
  await assert.rejects(
    commitRelicReplacement(committed, {
      ...request,
      replacementChoiceId: transaction.candidates[1].replacementChoiceId
    }, context),
    /REPLACEMENT_ALREADY_COMPLETED/u
  );
});

test("replacement errors are precise and leave the input unchanged", async () => {
  const cases = [
    ["unknown", async (meta) => commitRelicReplacement(meta, {
      transactionId: "unknown",
      replacementChoiceId: "unknown"
    }, context), /REPLACEMENT_TRANSACTION_NOT_FOUND/u],
    ["choice", async (meta) => commitRelicReplacement(meta, {
      transactionId: meta.pendingRelicTransaction.transactionId,
      replacementChoiceId: "unknown"
    }, context), /REPLACEMENT_CHOICE_NOT_ALLOWED/u],
    ["stale", async (meta) => {
      meta.revision += 1;
      return commitRelicReplacement(meta, {
        transactionId: meta.pendingRelicTransaction.transactionId,
        replacementChoiceId: meta.pendingRelicTransaction.candidates[0].replacementChoiceId
      }, context);
    }, /STALE_REPLACEMENT_TRANSACTION/u],
    ["digest", async (meta) => {
      meta.build.buildDigest = "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      return commitRelicReplacement(meta, {
        transactionId: meta.pendingRelicTransaction.transactionId,
        replacementChoiceId: meta.pendingRelicTransaction.candidates[0].replacementChoiceId
      }, context);
    }, /REPLACEMENT_BUILD_CHANGED/u],
    ["run", async (meta) => commitRelicReplacement(meta, {
      transactionId: meta.pendingRelicTransaction.transactionId,
      replacementChoiceId: meta.pendingRelicTransaction.candidates[0].replacementChoiceId
    }, { ...context, runId: "other" }), /REPLACEMENT_BINDING_MISMATCH/u],
    ["ruleset", async (meta) => commitRelicReplacement(meta, {
      transactionId: meta.pendingRelicTransaction.transactionId,
      replacementChoiceId: meta.pendingRelicTransaction.candidates[0].replacementChoiceId
    }, { ...context, rulesetHash: "sha256:other" }), /REPLACEMENT_BINDING_MISMATCH/u]
  ];
  for (const [label, action, pattern] of cases) {
    const meta = await pendingFor();
    if (label === "stale" || label === "digest") {
      await assert.rejects(action(meta), pattern);
    } else {
      const before = structuredClone(meta);
      await assert.rejects(action(meta), pattern);
      assert.deepEqual(meta, before, label);
    }
  }
});

test("source offer and reward slot mismatches fail before any mutation", async () => {
  for (const target of ["offer", "slot"]) {
    const meta = await pendingFor();
    const transaction = meta.pendingRelicTransaction;
    if (target === "offer") meta.pendingOffer.offerId = "other_offer";
    else meta.currentRewardEnvelope.rewardSlots[0].slotId = "other_slot";
    const before = structuredClone(meta);
    await assert.rejects(
      commitRelicReplacement(meta, {
        transactionId: transaction.transactionId,
        replacementChoiceId: transaction.candidates[0].replacementChoiceId
      }, context),
      target === "offer"
        ? /REPLACEMENT_SOURCE_OFFER_MISMATCH/u
        : /REPLACEMENT_SOURCE_SLOT_MISMATCH/u
    );
    assert.deepEqual(meta, before);
  }
});

test("candidate invalidation and forged client fields cannot partially mutate the build", async () => {
  {
    const meta = await pendingFor();
    const candidate = meta.pendingRelicTransaction.candidates[0];
    candidate.removals[0].relicId = "not-owned";
    const before = structuredClone(meta);
    await assert.rejects(
      commitRelicReplacement(meta, {
        transactionId: meta.pendingRelicTransaction.transactionId,
        replacementChoiceId: candidate.replacementChoiceId
      }, context),
      /RELIC_REPLACEMENT_TARGET_CHANGED/u
    );
    assert.deepEqual(meta, before);
  }
  {
    const meta = await pendingFor();
    const transaction = meta.pendingRelicTransaction;
    for (const field of ["relicId", "incomingRelicId", "stacks", "slotLimit"]) {
      await assert.rejects(
        commitRelicReplacement(meta, {
          transactionId: transaction.transactionId,
          replacementChoiceId: transaction.candidates[0].replacementChoiceId,
          [field]: "forged"
        }, context),
        new RegExp(`RELIC_REPLACEMENT_REQUEST_UNKNOWN_FIELD:${field}`, "u")
      );
    }
  }
});

test("cancel discards locked incoming, consumes the source and preserves the build", async () => {
  const meta = await pendingFor();
  const beforeDigest = meta.build.buildDigest;
  const cancelled = await cancelRelicReplacement(meta, {
    transactionId: meta.pendingRelicTransaction.transactionId
  }, context);
  assert.equal(cancelled.build.buildDigest, beforeDigest);
  assert.equal(cancelled.pendingRelicTransaction, null);
  assert.equal(cancelled.pendingOffer, null);
  assert.equal(cancelled.currentRewardEnvelope.rewardSlots[0].consumed, true);
  assert.equal(cancelled.currentRewardEnvelope.rewardSlots[0].resolution, "replacement_cancelled");
  assert.equal(cancelled.relicReplacementHistory[0].cancelled, true);
  assert.deepEqual(
    await cancelRelicReplacement(cancelled, {
      transactionId: meta.pendingRelicTransaction.transactionId
    }, context),
    cancelled
  );
});

test("pending serialization, restart determinism and receipt bounds are stable", async () => {
  const left = await pendingFor();
  const roundTrip = JSON.parse(JSON.stringify(left));
  assert.deepEqual(roundTrip, left);
  const right = await pendingFor();
  assert.deepEqual(right.pendingRelicTransaction, left.pendingRelicTransaction);
  const bounded = structuredClone(left);
  bounded.relicReplacementHistory = Array.from({ length: 64 }, (_, index) => ({
    transactionId: `old_${index}`
  }));
  const committed = await commitRelicReplacement(bounded, {
    transactionId: bounded.pendingRelicTransaction.transactionId,
    replacementChoiceId: bounded.pendingRelicTransaction.candidates[0].replacementChoiceId
  }, context);
  assert.equal(committed.relicReplacementHistory.length, 64);
  assert.equal(committed.relicReplacementHistory.at(-1).transactionId,
    bounded.pendingRelicTransaction.transactionId);
});

test("gold, lives, depth and run modifiers do not change across commit", async () => {
  const meta = await pendingFor();
  meta.gold = 321;
  meta.lives = 2;
  meta.depth = 55;
  const economy = {
    gold: meta.gold,
    lives: meta.lives,
    depth: meta.depth,
    runModifiers: structuredClone(meta.runModifiers)
  };
  const committed = await commitRelicReplacement(meta, {
    transactionId: meta.pendingRelicTransaction.transactionId,
    replacementChoiceId: meta.pendingRelicTransaction.candidates[0].replacementChoiceId
  }, context);
  assert.deepEqual({
    gold: committed.gold,
    lives: committed.lives,
    depth: committed.depth,
    runModifiers: committed.runModifiers
  }, economy);
});

test("starting replacement is rejected for an unreachable non-empty starting build", async () => {
  const meta = state("starting_replacement");
  meta.status = "awaiting_starting_relic";
  meta.build = await buildWith(fullIds);
  assert.deepEqual(
    await evaluateRelicAcquisition(meta, acquisition("fang", {
      acquisitionSource: "starting_relic",
      sourceRewardSlotId: null
    })),
    { decision: "REJECT", code: "STARTING_RELIC_BUILD_NOT_EMPTY" }
  );
});

test("real starting selection remains direct and activates the run", async () => {
  const rulesetContext = {
    runId: "starting_real",
    season: "season-phase3b2c2",
    startedAt: 1_700_000_400_000,
    secret: context.secret
  };
  const ruleset = createV08Meta1Ruleset({ secret: context.secret });
  let meta = await ruleset.createRun({}, rulesetContext);
  meta = await ruleset.selectStartingRelic(meta, {
    offerId: meta.pendingOffer.offerId,
    choiceId: meta.pendingOffer.choices[0].choiceId
  }, rulesetContext);
  assert.equal(meta.status, "active");
  assert.equal(meta.pendingRelicTransaction, null);
  assert.ok(meta.build.relics.some((entry) => entry.relicId === "fang"));
  assert.ok(meta.currentRoomDirective);
});

test("real Warden and Otter offer selections create the same canonical pending transaction", async () => {
  const randomOracle = {
    async deriveRandomBytes(options) {
      return Uint8Array.from(
        { length: options.length },
        (_, index) => (index + Number(options.counter || 0) * 17 +
          String(options.purpose || "").length) & 255
      );
    },
    async deriveIntInclusive(minimum) {
      return minimum;
    }
  };
  for (const source of ["warden", "otter"]) {
    const runContext = {
      runId: `real_${source}_replacement`,
      season: "season-phase3b2c2",
      startedAt: 1_700_000_400_000,
      secret: context.secret,
      randomOracle
    };
    const ruleset = createV08Meta1Ruleset({
      secret: context.secret,
      randomOracle
    });
    let meta = await ruleset.createRun({}, runContext);
    meta = await ruleset.selectStartingRelic(meta, {
      offerId: meta.pendingOffer.offerId,
      choiceId: meta.pendingOffer.choices[0].choiceId
    }, runContext);
    meta.build = await buildWith(fullIds);
    meta.depth = source === "warden" ? 4 : 20;
    meta.roomIndex = meta.depth;
    meta.currentRoomDirective = null;
    meta.currentRewardEnvelope = null;
    if (source === "otter") {
      meta.statistics.roomsCompleted = 1;
      meta.specialRoomScheduleState.otterRoomsSeenThisRun = 0;
    }
    meta = await ruleset.issueRoomDirective(meta, runContext);
    assert.equal(meta.currentRoomDirective.roomType, source === "warden" ? "boss" : "otter");
    const slot = meta.currentRewardEnvelope.rewardSlots[0];
    meta = await ruleset.issueRegularRelicOffer(meta, {
      rewardEnvelopeId: meta.currentRewardEnvelope.envelopeId,
      rewardSlotId: slot.slotId,
      sourceDirectiveId: meta.currentRoomDirective.directiveId
    }, runContext);
    assert.ok(meta.pendingOffer);
    const replacementChoice = meta.pendingOffer.choices.find(
      (choice) => choice.privateRelicId !== "abyssalreliquary"
    );
    assert.ok(replacementChoice);
    meta = await ruleset.selectRegularRelic(meta, {
      offerId: meta.pendingOffer.offerId,
      choiceId: replacementChoice.choiceId
    }, runContext);
    assert.equal(meta.pendingRelicTransaction.transactionType, "relic_replacement");
    assert.equal(meta.pendingOffer.selectionPending, true);
    assert.equal(meta.currentRewardEnvelope.rewardSlots[0].resolution, "selection_pending");
    const pendingSnapshot = structuredClone(meta);
    assert.deepEqual(
      await ruleset.selectRegularRelic(meta, {
        offerId: meta.pendingOffer.offerId,
        choiceId: replacementChoice.choiceId
      }, runContext),
      pendingSnapshot
    );
    const otherChoice = meta.pendingOffer.choices.find(
      (choice) => choice.choiceId !== replacementChoice.choiceId
    );
    if (otherChoice) {
      await assert.rejects(
        ruleset.selectRegularRelic(meta, {
          offerId: meta.pendingOffer.offerId,
          choiceId: otherChoice.choiceId
        }, runContext),
        /RELIC_REWARD_OFFER_SELECTION_ALREADY_PENDING/u
      );
    }
  }
});

test("public replacement payload reports the complete 8-slot and 10-slot candidate sets", async () => {
  let maximum = 0;
  for (const [ids, incoming] of [
    [fullIds, "adrenal"],
    [["abyssalreliquary", ...fullIds, "risk"], "crownconcord"]
  ]) {
    const meta = await pendingFor(ids, incoming);
    const bytes = Buffer.byteLength(
      JSON.stringify(projectPublicRelicReplacement(meta)),
      "utf8"
    );
    maximum = Math.max(maximum, bytes);
    assert.ok(bytes < 20 * 1024, `${bytes} bytes`);
  }
  console.info(`Phase 3B2C2 maximum public replacement projection: ${maximum} bytes`);
});

for (const fixture of fixtures) {
  test(`golden 3B2C2 executable inventory: ${fixture.fixtureId}`, () => {
    assert.ok(catalog.some((entry) => entry.relicId === "fang"));
    assert.equal(fixture.expectedRulesetHash, "manifest.rulesetHash");
    assert.ok(fixture.legacySourceEvidence.every((entry) => entry.includes(":")));
  });
}
