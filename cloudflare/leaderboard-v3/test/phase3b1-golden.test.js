import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_RELEASE_STATES,
  createRulesetRegistry
} from "../src/rulesets/registry.js";
import {
  V08_META_1_DESCRIPTOR,
  createV08Meta1Ruleset
} from "../src/rulesets/v08-meta-1/index.js";
import {
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import {
  issueNextRoomDirectiveV08,
  specialRoomScalingDepthV08,
  V08_ROOM_POLICY_DATA
} from "../src/rulesets/v08-meta-1/room-policy.js";

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULESET_ROOT = path.join(WORKER_ROOT, "src", "rulesets", "v08-meta-1");
const fixtures = JSON.parse(await readFile(
  path.join(RULESET_ROOT, "test", "phase3b1-golden-fixtures.json"),
  "utf8"
));
const manifest = JSON.parse(await readFile(
  path.join(RULESET_ROOT, "data", "ruleset-manifest.json"),
  "utf8"
));

function secret(label = "secret-a") {
  return `${label}:0123456789abcdef0123456789abcdef`;
}

function zeroOracle() {
  return {
    async deriveRandomBytes(options) {
      const result = new Uint8Array(options.length);
      let offset = 0;
      let block = 0;
      while (offset < result.length) {
        const digest = createHash("sha256")
          .update(JSON.stringify({
            runId: options.runId,
            revision: options.revision,
            purpose: options.purpose,
            counter: options.counter,
            block
          }))
          .digest();
        const take = Math.min(digest.length, result.length - offset);
        result.set(digest.subarray(0, take), offset);
        offset += take;
        block += 1;
      }
      return result;
    },
    async deriveIntInclusive(min) {
      return min;
    }
  };
}

function contextFor(fixture, options = {}) {
  return {
    runId: fixture.runId,
    season: "season-phase3b1",
    startedAt: 1_700_000_000_000,
    elapsedMs: options.elapsedMs ?? 1_000,
    randomOracle: options.randomOracle,
    secret: options.secret
  };
}

function operationFor(state, overrides = {}) {
  const directive = state.currentRoomDirective;
  return {
    directiveId: directive.directiveId,
    runId: state.runId,
    rulesetHash: state.rulesetHash,
    revision: state.revision,
    roomIndex: directive.roomIndex,
    depth: directive.depth,
    roomType: directive.roomType,
    roomNonce: directive.roomNonce,
    completionAttestation: "local-room-completed",
    ...overrides
  };
}

async function createRun(fixture, options = {}) {
  const oracle = options.actual ? undefined : zeroOracle();
  const ruleset = createV08Meta1Ruleset({
    secret: options.secret || secret(),
    randomOracle: oracle
  });
  const context = contextFor(fixture, {
    secret: options.secret || secret(),
    randomOracle: oracle
  });
  const offered = await ruleset.createRun(fixture.initialMetaState, context);
  const state = await ruleset.selectStartingRelic(offered, {
    offerId: offered.pendingOffer.offerId,
    choiceId: offered.pendingOffer.choices[0].choiceId
  }, context);
  return { ruleset, state, context };
}

async function advanceToDirective(ruleset, state, targetDepth, context) {
  let current = state;
  while (current.currentRoomDirective.depth < targetDepth) {
    current = await ruleset.consumeRoomDirective(
      current,
      operationFor(current),
      { ...context, elapsedMs: current.elapsedMs + 1_000 }
    );
  }
  assert.equal(current.currentRoomDirective.depth, targetDepth);
  return current;
}

function assertExpectedHash(state) {
  assert.equal(state.rulesetHash, manifest.rulesetHash);
}

const runners = {
  async "start-run-depth-1"(fixture) {
    const { state } = await createRun(fixture);
    assert.equal(state.depth, 0);
    assert.equal(state.roomIndex, 1);
    assert.equal(state.currentRoomDirective.depth, 1);
    assertExpectedHash(state);
  },

  async "allowed-start-depth"(fixture) {
    const { state } = await createRun(fixture);
    assert.equal(state.startDepth, 11);
    assert.equal(state.depth, 10);
    assert.equal(state.currentRoomDirective.depth, 11);
  },

  async "disallowed-start-depth"(fixture) {
    await assert.rejects(createRun(fixture), /START_DEPTH_NOT_ALLOWED/u);
  },

  async "normal-room"(fixture) {
    const { state } = await createRun(fixture);
    assert.equal(state.currentRoomDirective.roomType, "combat");
    assert.equal(state.currentRoomDirective.roomCategory, "normal");
    assert.equal(state.gold, 0);
    assert.equal(state.lives, 5);
  },

  async "sequential-checkpoint"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    const next = await ruleset.consumeRoomDirective(state, operationFor(state), context);
    assert.equal(next.depth, 1);
    assert.equal(next.revision, 2);
    assert.equal(next.roomIndex, 2);
    assert.equal(next.currentRoomDirective.depth, 2);
    assert.equal(next.currentRoomDirective.revision, 2);
  },

  async "skip-depth-rejected"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    await assert.rejects(
      ruleset.consumeRoomDirective(
        state,
        operationFor(state, { depth: state.currentRoomDirective.depth + 1 }),
        context
      ),
      /DEPTH_SKIP_REJECTED/u
    );
  },

  async "depth-regression-rejected"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    await assert.rejects(
      ruleset.consumeRoomDirective(
        state,
        operationFor(state, { depth: state.currentRoomDirective.depth - 1 }),
        context
      ),
      /DEPTH_REGRESSION_REJECTED/u
    );
  },

  async "directive-reuse-rejected"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    const operation = operationFor(state);
    const next = await ruleset.consumeRoomDirective(state, operation, context);
    await assert.rejects(
      ruleset.consumeRoomDirective(next, operation, context),
      /ROOM_DIRECTIVE_ALREADY_CONSUMED/u
    );
  },

  async "other-run-directive-rejected"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    await assert.rejects(
      ruleset.consumeRoomDirective(
        state,
        operationFor(state, { runId: "run_other" }),
        context
      ),
      /ROOM_DIRECTIVE_RUN_MISMATCH/u
    );
  },

  async "stale-revision-rejected"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    await assert.rejects(
      ruleset.consumeRoomDirective(
        state,
        operationFor(state, { revision: state.revision + 1 }),
        context
      ),
      /ROOM_DIRECTIVE_REVISION_MISMATCH/u
    );
  },

  async "boss-depth"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    const atBoss = await advanceToDirective(ruleset, state, 5, context);
    assert.equal(atBoss.currentRoomDirective.roomType, "boss");
    assert.equal(atBoss.currentRoomDirective.roomCategory, "boss");
  },

  async "final-depth"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    const atFinal = await advanceToDirective(ruleset, state, 100, context);
    assert.equal(atFinal.currentRoomDirective.roomType, "final");
    assert.equal(atFinal.currentRoomDirective.roomCategory, "final");
  },

  async "terminal-victory-directive"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    const atFinal = await advanceToDirective(ruleset, state, 100, context);
    const victory = await ruleset.consumeRoomDirective(
      atFinal,
      operationFor(atFinal),
      context
    );
    assert.equal(victory.depth, 100);
    assert.equal(victory.status, "victory");
    assert.equal(victory.currentRoomDirective, null);
  },

  async "normal-to-special"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    const atVault = await advanceToDirective(ruleset, state, 11, context);
    assert.equal(atVault.currentRoomDirective.roomType, "vault");
    assert.equal(atVault.currentRoomDirective.roomCategory, "special");
  },

  async "special-room-run-limit"(fixture) {
    const oracle = zeroOracle();
    const context = contextFor(fixture, { randomOracle: oracle });
    const state = createInitialMetaStateV08(fixture.initialMetaState, context);
    state.status = "active";
    state.statistics.roomsCompleted = 20;
    state.specialRoomScheduleState.otterRoomsSeenThisRun = 3;
    state.specialRoomScheduleState.forgeSeenInGame = true;
    state.specialRoomScheduleState.forgePityUsedInGame = true;
    state.specialRoomScheduleState.otterSeenInGame = true;
    state.specialRoomScheduleState.otterPityUsedInGame = true;
    const issued = await issueNextRoomDirectiveV08(state, context);
    assert.notEqual(issued.currentRoomDirective.roomType, "otter");
    assert.equal(issued.specialRoomScheduleState.otterRoomsSeenThisRun, 3);
  },

  async "special-room-minimum-depth"() {
    const pact = V08_ROOM_POLICY_DATA.eligibility.roomEligibility.find(
      (entry) => entry.id === "pact"
    );
    assert.equal(pact.minDepth, 25);
    assert.ok(24 < pact.minDepth);
  },

  async "special-room-mutual-exclusion"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    const atBoss = await advanceToDirective(ruleset, state, 5, context);
    assert.equal(atBoss.currentRoomDirective.roomType, "boss");
    assert.notEqual(atBoss.currentRoomDirective.roomCategory, "special");
  },

  async "deterministic-retry"(fixture) {
    const first = await createRun(fixture, { actual: true, secret: secret("retry") });
    const second = await createRun(fixture, { actual: true, secret: secret("retry") });
    assert.deepEqual(first.state, second.state);
  },

  async "worker-restart-same-secret"(fixture) {
    const first = await createRun(fixture, { actual: true, secret: secret("restart") });
    const second = await createRun(fixture, { actual: true, secret: secret("restart") });
    assert.notEqual(first.ruleset, second.ruleset);
    assert.deepEqual(first.state.currentRoomDirective, second.state.currentRoomDirective);
  },

  async "different-rng-secret"(fixture) {
    const first = await createRun(fixture, { actual: true, secret: secret("one") });
    const second = await createRun(fixture, { actual: true, secret: secret("two") });
    assert.notEqual(
      first.state.currentRoomDirective.directiveId,
      second.state.currentRoomDirective.directiveId
    );
    assert.notEqual(
      first.state.currentRoomDirective.directiveSeed,
      second.state.currentRoomDirective.directiveSeed
    );
  },

  async "parallel-issue-same-revision"(fixture) {
    const context = contextFor(fixture, { secret: secret("parallel") });
    const initial = createInitialMetaStateV08(fixture.initialMetaState, context);
    initial.status = "active";
    const [left, right] = await Promise.all([
      issueNextRoomDirectiveV08(initial, context),
      issueNextRoomDirectiveV08(initial, context)
    ]);
    assert.deepEqual(left, right);
    assert.equal(left.revision, 0);
  },

  async "ruleset-hash-mismatch"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    await assert.rejects(
      ruleset.consumeRoomDirective(
        state,
        operationFor(state, { rulesetHash: "sha256:wrong" }),
        context
      ),
      /RULESET_HASH_MISMATCH/u
    );
  },

  async "unknown-ruleset"() {
    const registry = createRulesetRegistry([V08_META_1_DESCRIPTOR]);
    assert.throws(() => registry.resolve("sha256:unknown"), /RULESET_HASH_UNSUPPORTED/u);
  },

  async "old-ruleset-immutability"() {
    const oldHash = `sha256:${"a".repeat(64)}`;
    const nextHash = `sha256:${"b".repeat(64)}`;
    const registry = createRulesetRegistry([
      {
        rulesetId: "old",
        rulesetHash: oldHash,
        status: RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
        createRuleset: () => ({ version: "old" })
      },
      {
        rulesetId: "next",
        rulesetHash: nextHash,
        status: RULESET_RELEASE_STATES.PRODUCTION_RELEASED,
        createRuleset: () => ({ version: "next" })
      }
    ]);
    assert.equal(registry.resolve(oldHash).version, "old");
    assert.equal(registry.resolve(nextHash).version, "next");
  },

  async "room-nonce-reuse"(fixture) {
    const { ruleset, state, context } = await createRun(fixture);
    state.consumedDirectiveNonces.push(state.currentRoomDirective.roomNonce);
    await assert.rejects(
      ruleset.consumeRoomDirective(state, operationFor(state), context),
      /ROOM_NONCE_REUSED/u
    );
  }
};

assert.deepEqual(
  fixtures.map((fixture) => fixture.fixtureId).sort(),
  Object.keys(runners).sort()
);

for (const fixture of fixtures) {
  test(`golden 3B1: ${fixture.fixtureId}`, async () => {
    assert.equal(fixture.expectedRulesetHash, "manifest.rulesetHash");
    await runners[fixture.fixtureId](fixture);
  });
}

test("Vault, Forge and Otter scale to campaign max depth regardless of room depth", () => {
  const state = {
    maxDepth: 31,
    campaign: { scoreCarry: { highWaterDepth: 50, earnedGold: 0 } }
  };
  assert.equal(specialRoomScalingDepthV08(state, "vault", 12), 50);
  assert.equal(specialRoomScalingDepthV08(state, "forge", 21), 50);
  assert.equal(specialRoomScalingDepthV08(state, "otter", 31), 50);
  assert.equal(specialRoomScalingDepthV08(state, "combat", 12), 12);
  assert.equal(specialRoomScalingDepthV08(state, "vault", 60), 60);
});

test("special room directive and reward envelope carry the same campaign scaling depth", async () => {
  const fixture = {
    runId: "run_special_scaling_depth",
    initialMetaState: {}
  };
  const oracle = zeroOracle();
  const context = contextFor(fixture, { randomOracle: oracle });
  const state = createInitialMetaStateV08({}, context);
  state.status = "active";
  state.depth = 11;
  state.roomIndex = 11;
  state.maxDepth = 31;
  state.campaign.scoreCarry = { highWaterDepth: 50, earnedGold: 0 };
  state.campaign.forcedNextRoomType = "vault";
  const issued = await issueNextRoomDirectiveV08(state, context);
  assert.equal(issued.currentRoomDirective.depth, 12);
  assert.equal(issued.currentRoomDirective.specialRoomPayload.scalingDepth, 50);
  assert.equal(issued.currentRewardEnvelope.depth, 12);
  assert.equal(issued.currentRewardEnvelope.scalingDepth, 50);
  assert.equal(issued.currentRewardEnvelope.fixedAwards[0].baseAmount, 25);
});

test("Forge pity at depth 21 is available only once per campaign", async () => {
  assert.ok(
    V08_ROOM_POLICY_DATA.specialPolicy.manualVersionedRules.some(
      (rule) => rule.ruleId === "forge-pity-campaign-scope"
    )
  );
  assert.equal(
    V08_ROOM_POLICY_DATA.specialPolicy.unresolvedSourceRules.some(
      (rule) => rule.ruleId === "forge-pity-game-scope"
    ),
    false
  );
  const firstFixture = { runId: "run_forge_pity_first", initialMetaState: {} };
  const firstContext = contextFor(firstFixture, { randomOracle: zeroOracle() });
  const firstState = createInitialMetaStateV08({}, firstContext);
  firstState.status = "active";
  firstState.depth = 20;
  firstState.roomIndex = 20;
  const first = await issueNextRoomDirectiveV08(firstState, firstContext);
  assert.equal(first.currentRoomDirective.roomType, "forge");
  assert.equal(first.currentRoomDirective.specialRoomPayload.policySource, "forge-pity");
  assert.equal(first.campaign.forgeSeenInCampaign, true);
  assert.equal(first.campaign.forgePityUsedInCampaign, true);

  const secondFixture = { runId: "run_forge_pity_second", initialMetaState: {} };
  const secondContext = contextFor(secondFixture, { randomOracle: zeroOracle() });
  const secondState = createInitialMetaStateV08(
    { campaign: first.campaign },
    secondContext
  );
  secondState.status = "active";
  secondState.depth = 20;
  secondState.roomIndex = 20;
  const second = await issueNextRoomDirectiveV08(secondState, secondContext);
  assert.notEqual(
    second.currentRoomDirective.specialRoomPayload?.policySource,
    "forge-pity"
  );

  const freshFixture = { runId: "run_forge_pity_fresh", initialMetaState: {} };
  const freshContext = contextFor(freshFixture, { randomOracle: zeroOracle() });
  const freshState = createInitialMetaStateV08({}, freshContext);
  freshState.status = "active";
  freshState.depth = 20;
  freshState.roomIndex = 20;
  const fresh = await issueNextRoomDirectiveV08(freshState, freshContext);
  assert.equal(fresh.currentRoomDirective.specialRoomPayload.policySource, "forge-pity");
});
