import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyRelicAcquisition,
  createV08Meta1Ruleset
} from "../src/rulesets/v08-meta-1/index.js";
import {
  createAuthenticatedRunBootstrap,
  selectAuthenticatedStartingRelic
} from "../src/domain/run-bootstrap.js";
import { TEST_SECRET } from "./fixtures/harness.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };

const NOW = 1_810_000_000_000;
const fixtures = JSON.parse(await readFile(new URL(
  "../src/rulesets/v08-meta-1/test/m3-lives-outcome-golden-fixtures.json",
  import.meta.url
), "utf8"));

async function activeState(seed = 0) {
  const ruleset = createV08Meta1Ruleset({ secret: TEST_SECRET });
  const bootstrap = await createAuthenticatedRunBootstrap({
    playerName: "M3 Lives",
    season: "m3-season",
    gameVersion: "0.8.1",
    rulesetId: "v08-meta-1",
    rulesetHash: manifest.rulesetHash,
    clientInstallIdHash: "install_0123456789abcdef",
    profileId: "profile_0123456789abcdef0123456789abcdef",
    profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp"
  }, {
    ruleset,
    secret: TEST_SECRET,
    now: NOW + seed,
    runId: `run_${seed.toString(16).padStart(16, "0")}`,
    bootstrapNonce: `bootstrap_${seed}`
  });
  const offer = bootstrap.nextState.pendingOffer;
  const selected = await selectAuthenticatedStartingRelic(
    bootstrap.nextState,
    {
      offerId: offer.offerId,
      choiceId: offer.choices[seed % offer.choices.length].choiceId
    },
    { ruleset, secret: TEST_SECRET }
  );
  return { ruleset, state: selected.nextState };
}

async function addRelic(state, relicId, revision = state.revision) {
  state.build = await applyRelicAcquisition(state.build, {
    relicId,
    acquiredRevision: revision,
    acquisitionSource: "m3-fixture",
    sourceOfferId: `m3_${relicId}_${revision}`
  });
}

async function fatal(value, request = { classification: "local_fatal_event" }) {
  return value.ruleset.reportFatalEvent(
    value.state,
    request,
    { secret: TEST_SECRET }
  );
}

test("M3 lives/outcome golden corpus has 12 active-source cases", () => {
  assert.equal(fixtures.length, 12);
  assert.equal(new Set(fixtures.map((entry) => entry.fixtureId)).size, 12);
});

test("fresh canonical state owns five bounded lives and an empty life ledger", async () => {
  const { state } = await activeState(1);
  assert.equal(state.lives, 5);
  assert.equal(state.lifeLedger.maximumLives, 5);
  assert.equal(state.lifeLedger.fatalEvents, 0);
  assert.equal(state.lifeLedger.lifeLosses, 0);
  assert.equal(state.maxDepth, 0);
});

test("Chrono Loop then Second Chance prevent fatal events in baseline order", async () => {
  const value = await activeState(2);
  await addRelic(value.state, "chronoloop", 7);
  value.state.build.resources.hasSecondChance = true;
  const original = structuredClone(value.state);

  const chrono = await fatal(value);
  assert.deepEqual(value.state, original);
  assert.equal(chrono.nextState.lives, 5);
  assert.equal(chrono.nextState.build.resources.hasSecondChance, true);
  assert.equal(chrono.nextState.lifeLedger.chronoLoopPreventions, 1);
  assert.equal(chrono.publicResult.resolution, "prevented_chronoloop");

  const second = await value.ruleset.reportFatalEvent(
    chrono.nextState,
    { classification: "local_fatal_event" },
    { secret: TEST_SECRET }
  );
  assert.equal(second.nextState.lives, 5);
  assert.equal(second.nextState.build.resources.hasSecondChance, false);
  assert.equal(second.nextState.lifeLedger.secondChancePreventions, 1);
  assert.equal(second.publicResult.resolution, "prevented_second_chance");
});

test("actual nonterminal death loses one life and one non-Mythic copy then restarts", async () => {
  const value = await activeState(3);
  const beforeLives = value.state.lives;
  const beforeStacks = value.state.build.totalRelicStacks;
  const result = await fatal(value);
  assert.equal(result.nextState.status, "active");
  assert.equal(result.nextState.lives, beforeLives - 1);
  assert.equal(result.nextState.build.totalRelicStacks, beforeStacks - 1);
  assert.equal(result.nextState.depth, 0);
  assert.equal(result.nextState.currentRoomDirective.depth, 1);
  assert.equal(result.nextState.lifeLedger.currentLife, 2);
  assert.equal(result.publicResult.resolution, "life_lost");
});

test("Mythic relic copies are excluded from the death penalty", async () => {
  const value = await activeState(4);
  value.state.build.relics = [];
  value.state.build = await applyRelicAcquisition(value.state.build, {
    relicId: "abyssalreliquary",
    acquiredRevision: 9,
    acquisitionSource: "m3-fixture",
    sourceOfferId: "m3_mythic"
  });
  const result = await fatal(value);
  assert.equal(result.nextState.lives, 4);
  assert.equal(result.nextState.build.relics[0].relicId, "abyssalreliquary");
  assert.equal(result.publicResult.lostRelicId, null);
});

test("the accepted loss at one life creates terminal defeat without a room", async () => {
  const value = await activeState(5);
  value.state.lives = 1;
  const result = await fatal(value);
  assert.equal(result.nextState.status, "defeat");
  assert.equal(result.nextState.lives, 0);
  assert.equal(result.nextState.currentRoomDirective, null);
  assert.equal(result.nextState.terminalEligibility.outcome, "defeat");
  assert.equal(result.publicResult.resolution, "terminal_defeat");
});

test("fatal presentation cause is bounded, receipt-only, and leaves canonical resolution unchanged", async () => {
  const caused = await activeState(90);
  const plain = await activeState(90);
  caused.state.lives = 1;
  plain.state.lives = 1;
  const withCause = await fatal(caused, {
    classification: "local_fatal_event",
    presentationCause: "  Defeated by The Hollow Seraph  "
  });
  const withoutCause = await fatal(plain);
  assert.equal(withCause.publicResult.presentationCause, "Defeated by The Hollow Seraph");
  assert.equal(withCause.nextState.lifeLedger.history.at(-1).presentationCause, "Defeated by The Hollow Seraph");
  const receiptFreeState = structuredClone(withCause.nextState);
  delete receiptFreeState.lifeLedger.history.at(-1).presentationCause;
  assert.deepEqual(receiptFreeState, withoutCause.nextState);
  for (const request of [
    { classification: "local_fatal_event", presentationCause: " " },
    { classification: "local_fatal_event", presentationCause: "bad\u0001cause" },
    { classification: "local_fatal_event", presentationCause: "x".repeat(161) },
    { classification: "local_fatal_event", presentationCause: "valid", unexpected: true }
  ]) {
    await assert.rejects(() => fatal(caused, request));
  }
});
test("normal and emergency extraction are server-derived and terminal", async () => {
  const normal = await activeState(6);
  normal.state.statistics.roomsCompleted = 1;
  normal.state.gold = 101;
  normal.state.campGold = 7;
  const normalResult = normal.ruleset.requestExtraction(
    normal.state,
    { mode: "normal" }
  );
  assert.equal(normalResult.nextState.status, "extraction");
  assert.equal(normalResult.nextState.gold, 101);
  assert.equal(normalResult.nextState.campGold, 108);
  assert.equal(normalResult.publicResult.goldLost, 0);

  const emergency = await activeState(7);
  emergency.state.gold = 101;
  emergency.state.build.campUpgrades.emergency_stash = 2;
  const emergencyResult = emergency.ruleset.requestExtraction(
    emergency.state,
    { mode: "emergency" }
  );
  assert.equal(emergencyResult.nextState.status, "extraction");
  assert.equal(emergencyResult.nextState.gold, 50);
  assert.equal(emergencyResult.publicResult.goldLost, 51);
  assert.ok(Math.abs(emergencyResult.publicResult.lossRatio - 0.5) < Number.EPSILON);
});

test("premature normal extraction and client-owned result fields fail closed", async () => {
  const value = await activeState(8);
  assert.throws(
    () => value.ruleset.requestExtraction(value.state, { mode: "normal" }),
    /REQUIRES_ACCEPTED_ROOM_CLEAR/u
  );
  for (const request of [
    { classification: "life_lost" },
    { classification: "local_fatal_event", lives: 0 },
    { classification: "local_fatal_event", result: "defeat" },
    { classification: "local_fatal_event", target: "chronoloop" }
  ]) {
    await assert.rejects(
      value.ruleset.reportFatalEvent(
        value.state,
        request,
        { secret: TEST_SECRET }
      )
    );
  }
  assert.throws(
    () => value.ruleset.requestExtraction(value.state, {
      mode: "emergency",
      gold: 0
    }),
    /EXTRACTION_REQUEST_INVALID/u
  );
});

test("128-seed fatal-event property matrix is deterministic, bounded and immutable", async () => {
  for (let seed = 0; seed < 128; seed += 1) {
    const left = await activeState(1000 + seed);
    const right = await activeState(1000 + seed);
    if (seed % 3 === 0) {
      await addRelic(left.state, "chronoloop", 100 + seed);
      await addRelic(right.state, "chronoloop", 100 + seed);
    }
    if (seed % 5 === 0) {
      left.state.build.resources.hasSecondChance = true;
      right.state.build.resources.hasSecondChance = true;
    }
    const leftBefore = structuredClone(left.state);
    const rightBefore = structuredClone(right.state);
    const a = await fatal(left);
    const b = await fatal(right);
    assert.deepEqual(a, b);
    assert.deepEqual(left.state, leftBefore);
    assert.deepEqual(right.state, rightBefore);
    assert.ok(a.nextState.lives >= 0 && a.nextState.lives <= 5);
    assert.equal(a.nextState.lifeLedger.fatalEvents, 1);
  }
});
