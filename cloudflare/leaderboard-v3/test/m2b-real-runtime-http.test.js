import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { createRulesetRegistry } from "../src/rulesets/registry.js";
import { V08_META_1_LOCAL_RELEASE_DESCRIPTOR } from "../src/rulesets/releases.js";
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { canonicalDigest } from "../src/security/digests.js";
import {
  decodeBoundaryToken,
  signBoundaryToken
} from "../src/security/checkpoint-token.js";
import { TEST_SECRET } from "./fixtures/harness.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const RULESET_ID = "v08-meta-1";
const RULESET_HASH = manifest.rulesetHash;

function createRealHarness(options = {}) {
  const repositories = options.repositories || createMemoryRepositories();
  const registry = options.registry || createRulesetRegistry([
    V08_META_1_LOCAL_RELEASE_DESCRIPTOR
  ]);
  const causes = [];
  let now = 1_800_000_000_000;
  let sequence = 1;
  const worker = createWorker({
    rulesetRegistry: registry,
    rulesetEnvironment: options.environment || "local",
    repositories,
    onError(cause) {
      causes.push(cause);
    },
    now: () => now,
    randomUUID() {
      const suffix = String(sequence).padStart(12, "0");
      sequence += 1;
      return `00000000-0000-4000-8000-${suffix}`;
    }
  });
  const env = { RANKED_V3_HMAC_SECRET: TEST_SECRET };

  async function call(path, body, idempotencyKey) {
    const response = await worker.fetch(new Request(`https://local.invalid${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(body)
    }), env);
    return { response, payload: await response.json() };
  }

  function startBody(overrides = {}) {
    return {
      playerName: "RealRuntime",
      season: "local-season",
      gameVersion: "0.8.1",
      rulesetId: RULESET_ID,
      rulesetHash: RULESET_HASH,
      clientInstallIdHash: "install_0123456789abcdef",
      profileId: "profile_0123456789abcdef0123456789abcdef",
      profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
      recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
      ...overrides
    };
  }

  async function start(key = "real-start-0001", overrides = {}) {
    return call("/api/v3/runs/start", startBody(overrides), key);
  }

  async function select(session, choiceIndex = 0, key = "real-select-0001", overrides = {}) {
    return call("/api/v3/runs/event", {
      runId: session.runId,
      type: "select_starting_relic",
      bootstrapToken: session.bootstrapToken,
      offerId: session.metaState.startingRelicOffer.offerId,
      choiceId: session.metaState.startingRelicOffer.publicChoices[choiceIndex].choiceId,
      ...overrides
    }, key);
  }

  async function checkpoint(session, key = "real-checkpoint-0001", overrides = {}) {
    const directive = session.metaState.currentRoomDirective;
    const commands = [{ code: "move", count: 2 }, { code: "attack", count: 1 }];
    return call("/api/v3/runs/checkpoint", {
      runId: session.runId,
      checkpointToken: session.checkpointToken,
      roomDirectiveId: directive.directiveId,
      roomNonce: directive.roomNonce,
      roomResult: "cleared",
      turnCount: 3,
      elapsedMs: 1_000,
      commandJournalDigest: await canonicalDigest(commands),
      compactRoomProof: {
        roomDirectiveId: directive.directiveId,
        roomNonce: directive.roomNonce,
        commands
      },
      ...overrides
    }, key);
  }

  async function event(session, type, payload, key) {
    const directive = session.metaState.currentRoomDirective;
    return call("/api/v3/runs/event", {
      runId: session.runId,
      checkpointToken: session.checkpointToken,
      roomDirectiveId: directive.directiveId,
      roomNonce: directive.roomNonce,
      type,
      payload
    }, key);
  }

  return {
    repositories,
    registry,
    worker,
    env,
    call,
    start,
    startBody,
    select,
    checkpoint,
    event,
    lastCause() {
      return causes.at(-1) || null;
    },
    advance(ms) {
      now += ms;
    }
  };
}

test("real start returns authenticated bootstrap state without a synthetic room", async () => {
  const harness = createRealHarness();
  const first = await harness.start();
  assert.equal(first.response.status, 201);
  assert.equal(first.payload.metaState.status, "awaiting_starting_relic");
  assert.equal(first.payload.metaState.revision, 0);
  assert.equal(first.payload.metaState.currentRoomDirective, null);
  assert.equal(first.payload.metaState.startingRelicOffer.publicChoices.length, 3);
  assert.equal(typeof first.payload.bootstrapToken, "string");
  assert.equal("checkpointToken" in first.payload, false);
  assert.equal("roomDirectiveId" in first.payload, false);
  assert.equal("roomNonce" in first.payload, false);

  const retry = await harness.start();
  assert.equal(retry.response.status, 201);
  assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
  assert.deepEqual(retry.payload, first.payload);

  const conflict = await harness.start("real-start-0001", { playerName: "Other" });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.payload.error.code, "IDEMPOTENCY_KEY_REUSED");
});

test("authenticated starting selection returns one deterministic first room and exact retry", async () => {
  const harness = createRealHarness();
  const started = (await harness.start()).payload;
  const selected = await harness.select(started);
  assert.equal(selected.response.status, 200);
  assert.equal(selected.payload.metaState.status, "active");
  assert.equal(selected.payload.revision, 1);
  assert.equal(selected.payload.metaState.build.relics.length, 1);
  assert.equal(selected.payload.metaState.currentRoomDirective.revision, 1);
  assert.equal(typeof selected.payload.checkpointToken, "string");
  assert.equal("bootstrapToken" in selected.payload, false);

  const retry = await harness.select(started);
  assert.equal(retry.response.status, 200);
  assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
  assert.deepEqual(retry.payload, selected.payload);

  const conflict = await harness.select(started, 1);
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.payload.error.code, "IDEMPOTENCY_KEY_REUSED");
});

test("starting selection rejects fake authority, stale bindings and token-kind substitution", async () => {
  const harness = createRealHarness();
  const started = (await harness.start()).payload;
  for (const [index, overrides] of [
    [0, { offerId: "offer_fake" }],
    [0, { choiceId: "choice_fake" }],
    [0, { relicId: "relic_fake" }],
    [0, { build: { relics: [] } }]
  ]) {
    const attempt = await harness.select(
      started,
      index,
      `invalid-selection-${JSON.stringify(overrides)}`,
      overrides
    );
    assert.notEqual(attempt.response.status, 200);
  }
  const bootstrapPayload = decodeBoundaryToken(started.bootstrapToken).payload;
  const wrongNonceToken = await signBoundaryToken({
    ...bootstrapPayload,
    bootstrapNonce: "bootstrap_wrong"
  }, TEST_SECRET);
  const wrongNonce = await harness.select(started, 0, "wrong-nonce", {
    bootstrapToken: wrongNonceToken
  });
  assert.equal(wrongNonce.response.status, 409);
  assert.equal(wrongNonce.payload.error.code, "BOOTSTRAP_TOKEN_CONFLICT");

  const selected = (await harness.select(started, 0, "valid-after-failures")).payload;
  const roomAsBootstrap = await harness.select(started, 0, "room-as-bootstrap", {
    bootstrapToken: selected.checkpointToken
  });
  assert.equal(roomAsBootstrap.response.status, 401);
  assert.equal(roomAsBootstrap.payload.error.code, "TOKEN_INVALID");

  const directive = selected.metaState.currentRoomDirective;
  const bootstrapAsRoom = await harness.call("/api/v3/runs/event", {
    runId: selected.runId,
    checkpointToken: started.bootstrapToken,
    roomDirectiveId: directive.directiveId,
    roomNonce: directive.roomNonce,
    type: "open_meta_offer",
    payload: {}
  }, "bootstrap-as-room");
  assert.equal(bootstrapAsRoom.response.status, 401);
  assert.equal(bootstrapAsRoom.payload.error.code, "TOKEN_INVALID");
});

test("concurrent conflicting starting choices commit at most one canonical result", async () => {
  const harness = createRealHarness();
  const started = (await harness.start()).payload;
  const [left, right] = await Promise.all([
    harness.select(started, 0, "concurrent-left"),
    harness.select(started, 1, "concurrent-right")
  ]);
  assert.equal([left, right].filter((result) => result.response.status === 200).length, 1);
  const stored = harness.repositories.snapshotRun(started.runId);
  assert.equal(stored.status, "active");
  assert.equal(stored.revision, 1);
  assert.equal(stored.statistics.roomsIssued, 1);
  assert.equal(stored.offerSettlementHistory.length, 1);
});

test("real room checkpoint consumes one directive and returns the next sequential room", async () => {
  const harness = createRealHarness();
  const started = (await harness.start()).payload;
  const selected = (await harness.select(started)).payload;
  const firstDirective = selected.metaState.currentRoomDirective;
  const cleared = await harness.checkpoint(selected);
  assert.equal(cleared.response.status, 200);
  assert.equal(cleared.payload.revision, 2);
  assert.equal(cleared.payload.metaState.depth, firstDirective.depth);
  assert.equal(
    cleared.payload.metaState.currentRoomDirective.roomIndex,
    firstDirective.roomIndex + 1
  );
  assert.notEqual(
    cleared.payload.metaState.currentRoomDirective.directiveId,
    firstDirective.directiveId
  );
  const retry = await harness.checkpoint(selected);
  assert.equal(retry.response.headers.get("x-idempotent-replay"), "1");
  assert.deepEqual(retry.payload, cleared.payload);
});

test("versioned checkpoint integrity signals are accepted and make the run provisional", async () => {
  const harness = createRealHarness();
  const started = (await harness.start("integrity-start")).payload;
  const selected = (await harness.select(started, 0, "integrity-select")).payload;
  const fixedGold = selected.metaState.currentRewardEnvelope.fixedAwards.reduce(
    (sum, award) => sum + award.amount,
    0
  );
  const cleared = await harness.checkpoint(selected, "integrity-checkpoint", {
    integrityVersion: 1,
    integritySignals: ["local_room_completion_capability_invalid"],
    reportedGoldDelta: fixedGold,
    reportedGoldTotal: selected.metaState.gold + fixedGold
  });
  assert.equal(cleared.response.status, 200);
  assert.equal(cleared.payload.metaState.rankEligibility, "provisional");
});

test("HTTP depth 5 Warden checkpoint accepts bounded potion use", async () => {
  const harness = createRealHarness();
  const started = (await harness.start("warden-potion-start")).payload;
  let session = (await harness.select(started, 0, "warden-potion-select")).payload;

  for (let depth = 1; depth < 5; depth += 1) {
    assert.equal(session.metaState.currentRoomDirective.depth, depth);
    const checkpointed = await harness.checkpoint(
      session,
      `warden-potion-checkpoint-${depth}`
    );
    assert.equal(checkpointed.response.status, 200);
    session = checkpointed.payload;
  }

  assert.equal(session.metaState.currentRoomDirective.roomType, "boss");
  assert.equal(session.metaState.currentRoomDirective.depth, 5);
  const checkpointed = await harness.checkpoint(
    session,
    "warden-potion-checkpoint-5",
    {
      rewardClaims: [
        { claimType: "enemy", claimId: "enemy:warden", count: 1 },
        { claimType: "resource", claimId: "potion-use", count: 1 }
      ]
    }
  );

  assert.equal(checkpointed.response.status, 200);
  assert.equal(checkpointed.payload.metaState.depth, 5);
  assert.equal(checkpointed.payload.metaState.build.resources.potions, 2);
  assert.equal(checkpointed.payload.metaState.currentRoomDirective.depth, 6);
  assert.equal(harness.lastCause(), null);
});

test("registry dispatch is exact and production remains fail closed", async () => {
  for (const [overrides, expectedCode] of [
    [{ rulesetId: "unknown" }, "RULESET_ID_UNSUPPORTED"],
    [{ rulesetHash: "sha256:unknown" }, "RULESET_HASH_UNSUPPORTED"],
    [{ rulesetId: "fixture-v3" }, "RULESET_ID_UNSUPPORTED"]
  ]) {
    const harness = createRealHarness();
    const result = await harness.start(`registry-${expectedCode}`, overrides);
    assert.equal(result.response.status, 422);
    assert.equal(result.payload.error.code, expectedCode);
  }
  const production = createRealHarness({ environment: "production" });
  const denied = await production.start("registry-production");
  assert.equal(denied.response.status, 503);
  assert.equal(denied.payload.error.code, "ABUSE_CONTROL_REQUIRED");
});

test("real finalize rejects a nonterminal room boundary", async () => {
  const harness = createRealHarness();
  const started = (await harness.start()).payload;
  const selected = (await harness.select(started)).payload;
  const result = await harness.call("/api/v3/runs/finalize", {
    runId: selected.runId,
    checkpointToken: selected.checkpointToken
  }, "real-finalize-blocked");
  assert.equal(result.response.status, 401);
  assert.equal(result.payload.error.code, "TOKEN_INVALID");
  assert.equal(harness.repositories.leaderboardCount(), 0);
  assert.equal(harness.repositories.snapshotRun(selected.runId).status, "active");
});

test("real HTTP lifecycle reaches canonical relic and meta transaction systems", async () => {
  const harness = createRealHarness();
  const started = (await harness.start("lifecycle-start")).payload;
  let session = (await harness.select(started, 0, "lifecycle-select")).payload;
  let sequence = 0;
  const covered = new Set();

  async function event(type, payload) {
    sequence += 1;
    const result = await harness.event(
      session,
      type,
      payload,
      `lifecycle-event-${sequence}`
    );
    assert.equal(
      result.response.status,
      200,
      `${type}:${result.payload?.error?.code || "unknown"}`
    );
    session = result.payload;
  }

  async function handleRelicSlot() {
    const slot = session.metaState.currentRewardEnvelope?.rewardSlots?.find(
      (entry) => !entry.consumed
    );
    if (!slot || session.metaState.relicOffer || session.metaState.relicReplacement) {
      return;
    }
    await event("issue_relic_offer", { rewardSlotId: slot.slotId });
    const offer = session.metaState.relicOffer;
    if (!offer) return;
    covered.add("relic_reward");
    await event("select_relic", {
      offerId: offer.offerId,
      choiceId: offer.publicChoices[0].choiceId
    });
    const replacement = session.metaState.relicReplacement;
    if (replacement) {
      await event("commit_relic_replacement", {
        transactionId: replacement.transactionId,
        replacementChoiceId: replacement.choices[0].replacementChoiceId
      });
      covered.add("replacement");
    }
  }

  async function handleMetaRoom(roomType) {
    if (roomType === "merchant" && !covered.has("merchant")) {
      await event("open_meta_offer", {});
      const offer = session.metaState.metaTransactionOffer;
      const choice = offer?.choices.find(
        (entry) => entry.status === "available" && /leave/iu.test(entry.kind)
      ) || offer?.choices.find((entry) => entry.status === "available");
      if (choice) {
        await event("commit_meta_transaction", {
          transactionId: choice.transactionId,
          choiceId: choice.choiceId
        });
        covered.add("merchant");
      }
    } else if (roomType === "forge") {
      const mode = !covered.has("forge_temper") ? "temper" : "transmute";
      if (
        mode === "transmute" &&
        session.metaState.build.relics.length === 0
      ) {
        return;
      }
      await event("open_meta_offer", mode === "transmute"
        ? {
          mode,
          sacrificeRelicId: session.metaState.build.relics[0].relicId
        }
        : { mode });
      const offer = session.metaState.metaTransactionOffer;
      const wanted = offer?.choices.find(
        (entry) =>
          entry.status === "available" &&
          entry.kind.includes(mode)
      ) || offer?.choices.find((entry) => entry.status === "available");
      if (wanted) {
        await event("commit_meta_transaction", {
          transactionId: wanted.transactionId,
          choiceId: wanted.choiceId
        });
        covered.add(`forge_${mode}`);
      }
    } else if (roomType === "crossroads" && !covered.has("crossroads")) {
      await event("open_meta_offer", {});
      const offer = session.metaState.metaTransactionOffer;
      const choice = offer?.choices.find(
        (entry) => entry.status === "available" && entry.kind === "crossroads_mercy"
      ) || offer?.choices.find((entry) => entry.status === "available");
      if (choice) {
        await event("commit_meta_transaction", {
          transactionId: choice.transactionId,
          choiceId: choice.choiceId
        });
        covered.add("crossroads");
      }
    } else if (roomType === "pact" && !covered.has("pact")) {
      await event("open_meta_offer", {});
      const offer = session.metaState.metaTransactionOffer;
      const choice = offer?.choices.find(
        (entry) => entry.status === "available"
      );
      if (choice) {
        await event("commit_meta_transaction", {
          transactionId: choice.transactionId,
          choiceId: choice.choiceId
        });
        covered.add("pact");
      }
    }
  }

  lifecycleRuns:
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) {
      const nextStarted = (
        await harness.start(`lifecycle-start-${attempt}`, {
          profileId: `profile_${String(attempt).repeat(32)}`,
          profileCredential: String.fromCharCode(112 + attempt).repeat(43),
          recoveryCredential: String.fromCharCode(114 + attempt).repeat(43)
        })
      ).payload;
      session = (
        await harness.select(
          nextStarted,
          attempt % 3,
          `lifecycle-select-${attempt}`
        )
      ).payload;
    }
    for (let room = 0; room < 90; room += 1) {
      await handleRelicSlot();
      await handleMetaRoom(session.metaState.currentRoomDirective.roomType);
      if (
        ["merchant", "forge_temper", "forge_transmute", "crossroads", "pact"]
          .every((name) => covered.has(name)) &&
        covered.has("relic_reward")
      ) {
        break lifecycleRuns;
      }
      const tokenPayload = decodeBoundaryToken(session.checkpointToken).payload;
      const stored = harness.repositories.snapshotRun(session.runId);
      assert.equal(
        tokenPayload.stateDigest,
        stored.stateDigest,
        `digest-${attempt}-${room}`
      );
      assert.equal(
        tokenPayload.revision,
        stored.revision,
        `revision-${attempt}-${room}`
      );
      assert.equal(
        tokenPayload.roomDirectiveId,
        stored.currentRoomDirective.directiveId,
        `directive-${attempt}-${room}`
      );
      assert.equal(
        tokenPayload.roomNonce,
        stored.currentRoomDirective.roomNonce,
        `nonce-${attempt}-${room}`
      );
      const checkpointed = await harness.checkpoint(
        session,
        `lifecycle-checkpoint-${attempt}-${room}`
      );
      assert.equal(
        checkpointed.response.status,
        200,
        [
          checkpointed.payload?.error?.code || `checkpoint-${attempt}-${room}`,
          `type=${session.metaState.currentRoomDirective.roomType}`,
          `token=${Boolean(session.checkpointToken)}`,
          `cause=${harness.lastCause()?.message || "none"}`
        ].join(":")
      );
      session = checkpointed.payload;
      if (session.metaState.status !== "active") break;
    }
  }

  for (const system of [
    "relic_reward",
    "replacement",
    "merchant",
    "forge_temper",
    "forge_transmute",
    "crossroads",
    "pact"
  ]) {
    assert(covered.has(system), `real lifecycle did not reach ${system}`);
  }
  assert(session.metaState.revision >= 2);
});
