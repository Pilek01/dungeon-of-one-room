import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ui = require("../../../online-v3/ranked-v3-ui.js");

function rankedState(overrides = {}) {
  return {
    rankEligibility: "official",
    assistanceClass: "none",
    rankIntegrity: { reasonCodes: [] },
    ...overrides
  };
}

test("Practice never exposes a Ranked HUD status", () => {
  assert.equal(ui.deriveHudRunStatus(rankedState(), { ranked: false }), null);
});

test("official unassisted Ranked is green and Observer Bot Ranked is blue", () => {
  const official = ui.deriveHudRunStatus(rankedState(), { ranked: true });
  const observer = ui.deriveHudRunStatus(
    rankedState({ assistanceClass: "observer_bot" }),
    { ranked: true }
  );

  assert.equal(official.kind, "official");
  assert.match(official.label, /leaderboard eligible/i);
  assert.equal(observer.kind, "observer");
  assert.match(observer.label, /observer bot/i);
  assert.match(observer.tooltip, /excluded from the official leaderboard/i);
});

test("provisional integrity is always red, including Observer Bot runs", () => {
  const status = ui.deriveHudRunStatus(
    rankedState({
      rankEligibility: "provisional",
      assistanceClass: "observer_bot",
      rankIntegrity: { reasonCodes: ["REPORTED_GOLD_DELTA_MISMATCH"] }
    }),
    { ranked: true }
  );

  assert.equal(status.kind, "invalid");
  assert.equal(status.reasonCode, "REPORTED_GOLD_DELTA_MISMATCH");
  assert.match(status.tooltip, /will not be submitted/i);
});

test("cheats, mixed assistance, and unknown canonical state never appear green", () => {
  for (const publicState of [
    rankedState({ assistanceClass: "cheats" }),
    rankedState({ assistanceClass: "mixed" }),
    null
  ]) {
    assert.equal(
      ui.deriveHudRunStatus(publicState, { ranked: true })?.kind,
      "invalid"
    );
  }
});

test("syncing preserves the last confirmed base status and adds pending context", () => {
  const previous = ui.deriveHudRunStatus(
    rankedState({ assistanceClass: "observer_bot" }),
    { ranked: true }
  );
  const syncing = ui.deriveHudRunStatus(null, {
    ranked: true,
    syncing: true,
    previous
  });

  assert.equal(syncing.kind, "observer");
  assert.equal(syncing.syncing, true);
  assert.match(syncing.tooltip, /synchronization pending/i);
});
