import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const recorderApi = require("../../../online-v3/ranked-v3-recorder.js");

test("Ranked recorder aggregates bounded proc claims and seals them", () => {
  const recorder = recorderApi.createRewardClaimRecorder();

  assert.equal(recorder.recordVoidReaperCritKill(), true);
  assert.equal(recorder.recordVoidReaperCritKill(), true);
  assert.equal(recorder.recordChaosOrbGoldRoll(), true);
  assert.deepEqual(recorder.snapshot(), [
    { claimType: "proc", claimId: "void-reaper-crit-kill", count: 2 },
    { claimType: "proc", claimId: "chaos-orb-gold-roll", count: 1 }
  ]);
  assert.equal(recorder.recordVoidReaperCritKill(), false);
  assert.equal(recorder.recordChaosOrbGoldRoll(), false);
  assert.deepEqual(recorder.snapshot(), [
    { claimType: "proc", claimId: "void-reaper-crit-kill", count: 2 },
    { claimType: "proc", claimId: "chaos-orb-gold-roll", count: 1 }
  ]);
});

test("Pages build wires proc recording only after successful bounded grants", async () => {
  const builder = await readFile(
    new URL("../../../scripts/build-pages-v3.mjs", import.meta.url),
    "utf8"
  );
  assert.match(builder, /recordVoidReaperCritKill/u);
  assert.match(builder, /recordChaosOrbGoldRoll/u);
  assert.match(
    builder,
    /const voidGold = grantGold\(VOID_REAPER_CRIT_KILL_GOLD\);[\s\S]*recordVoidReaperCritKill/u
  );
  assert.match(
    builder,
    /const chaosGold = grantGold\(CHAOS_ORB_GOLD_BONUS, \{ applyMultiplier: false \}\);[\s\S]*recordChaosOrbGoldRoll/u
  );
  assert.match(builder, /onlineV3BoundedProcClaims/u);
});

test("room integrity captures a run-global turn baseline and reports room-local turns", async () => {
  const builder = await readFile(
    new URL("../../../scripts/build-pages-v3.mjs", import.meta.url),
    "utf8"
  );
  const runtime = await readFile(
    new URL("../../../online-v3/ranked-v3-runtime.js", import.meta.url),
    "utf8"
  );
  assert.match(builder, /let onlineV3RoomStartingTurn = 0;/u);
  assert.match(builder, /onlineV3RoomStartingTurn = Math\.max\(0, Math\.floor\(Number\(state\.turn\)/u);
  assert.match(builder, /turnCount: Math\.max\([\s\S]*Number\(state\.turn\)[\s\S]*onlineV3RoomStartingTurn/u);
  assert.match(runtime, /boundedProcClaims/u);
});

test("protocol exposes versioned bounded proc capability", async () => {
  const protocol = await readFile(
    new URL("../../../online-v3/ranked-v3-protocol.js", import.meta.url),
    "utf8"
  );
  assert.match(protocol, /BOUNDED_PROC_CLAIMS/u);
  assert.match(protocol, /supportsBoundedProcClaims\(value\)/u);
});
