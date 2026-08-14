import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTestAssistanceV08,
  normalizeTestAssistanceV08
} from "../src/rulesets/v08-meta-1/test-assistance.js";
import { applyRulesetEvent } from "../src/domain/ruleset-runtime.js";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { createV08Meta1Ruleset } from "../src/rulesets/v08-meta-1/index.js";
import { RUN_TTL_MS } from "../src/config.js";
import { TEST_SECRET } from "./fixtures/harness.js";

test("test assistance only escalates and never returns to an official run", () => {
  const official = { assistanceClass: "none" };
  const observer = applyTestAssistanceV08(official, "observer_bot");
  assert.deepEqual(observer, { assistanceClass: "observer_bot" });
  assert.deepEqual(official, { assistanceClass: "none" });
  assert.deepEqual(
    applyTestAssistanceV08(observer, "cheats"),
    { assistanceClass: "mixed" }
  );
  assert.deepEqual(
    applyTestAssistanceV08({ assistanceClass: "mixed" }, "observer_bot"),
    { assistanceClass: "mixed" }
  );
});

test("legacy state normalizes to official and invalid assistance fails closed", () => {
  assert.equal(normalizeTestAssistanceV08(undefined), "none");
  assert.throws(
    () => applyTestAssistanceV08({ assistanceClass: "none" }, "none"),
    /TEST_ASSISTANCE_CLASS_INVALID/u
  );
  assert.throws(
    () => normalizeTestAssistanceV08("developer"),
    /TEST_ASSISTANCE_STATE_INVALID/u
  );
});

test("Ranked assistance event is canonical, revisioned, and projected into snapshots", async () => {
  const now = 1_950_000_000_000;
  const state = createInitialMetaStateV08(
    { startDepth: 0 },
    { runId: "run_test_assistance_0001", season: "test-season", startedAt: now }
  );
  Object.assign(state, {
    status: "active",
    revision: 7,
    profileId: "profile_22222222222222222222222222222222",
    playerName: "Test Runner",
    protocolVersion: "ranked-v3-checkpoint-1",
    gameVersion: "0.8.2",
    expiresAt: now + RUN_TTL_MS
  });
  const ruleset = createV08Meta1Ruleset({ secret: TEST_SECRET });
  const result = await applyRulesetEvent(state, {
    type: "mark_test_assistance",
    payload: { assistanceClass: "observer_bot" }
  }, ruleset, { now, secret: TEST_SECRET });
  assert.equal(result.nextState.revision, 8);
  assert.equal(result.nextState.assistanceClass, "observer_bot");
  assert.equal(state.assistanceClass, "none");
  assert.deepEqual(
    result.storageEffects.map((effect) => effect.type),
    ["update_run"]
  );
  assert.equal(
    ruleset.createLeaderboardSnapshot(result.nextState, {
      snapshotKind: "death",
      outcome: "death",
      createdAt: now
    }).assistanceClass,
    "observer_bot"
  );
  await assert.rejects(
    applyRulesetEvent(result.nextState, {
      type: "mark_test_assistance",
      payload: { assistanceClass: "cheats", forged: true }
    }, ruleset, { now, secret: TEST_SECRET }),
    /TEST_ASSISTANCE_PAYLOAD_INVALID/u
  );
});
