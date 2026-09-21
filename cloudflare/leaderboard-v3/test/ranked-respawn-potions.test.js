import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import { applyFatalEventV08 } from "../src/rulesets/v08-meta-1/life-policy.js";
import { applyRelicAcquisition, computeRelicBuildDigestV08 } from "../src/rulesets/v08-meta-1/relic-policy.js";
import { applyCanonicalRunModifierSelection } from "../src/rulesets/v08-meta-1/run-modifiers.js";
import { createRoomRewardEnvelopeV3, settleRoomRewardEnvelopeV3 } from "../src/rulesets/v08-meta-1/reward-policy.js";

const context = { runId: "run_respawn_potions", season: "test", startedAt: 1900000000000,
  secret: "respawn-potion-regression-only", cryptoProvider: webcrypto,
  capabilities: { earlyBalanceOtterRepair: "v1", respawnPotionResources: "v1" } };
async function fixture({satchel = 0, flask = false, modifiers = []} = {}) {
  let state = createInitialMetaStateV08({}, context);
  state.potionPolicyVersion = "v1";
  state.build.campUpgrades = {satchel, relic_ward: 3};
  Object.assign(state.build.resources, {potions: 3 + satchel, maxPotions: 3 + satchel});
  if (modifiers.length) state = await applyCanonicalRunModifierSelection(state,
    {modifierIds: modifiers, activationSource: "server-issued-run-start"},
    {...context, authority: "TRUSTED_RULESET_DOMAIN"});
  if (flask) state.build = await applyRelicAcquisition(state.build,
    {relicId: "flask", acquiredRevision: 0, acquisitionSource: "test", sourceOfferId: "flask"}, context);
  state.status = "active";
  state.build.resources.hp = 0;
  state.build.resources.potions = 0;
  state.build.buildDigest = await computeRelicBuildDigestV08(state.build, webcrypto);
  return state;
}
for (const row of [
  {name: "base", potions: 3, maximum: 3},
  {name: "production Satchel and Flask", satchel: 5, flask: true, potions: 8, maximum: 9},
  {name: "Alchemist", modifiers: ["alchemist"], potions: 5, maximum: 5},
  {name: "Famine", modifiers: ["famine"], potions: 1, maximum: 1},
  {name: "combined modifiers", satchel: 2, modifiers: ["alchemist", "famine"], potions: 4, maximum: 4}
]) test(`life loss renews canonical potions: ${row.name}`, async () => {
  const state = await fixture(row);
  const before = structuredClone(state);
  const result = await applyFatalEventV08(state, {classification: "local_fatal_event"}, context);
  assert.equal(result.publicResult.resolution, "life_lost");
  assert.equal(result.nextState.build.resources.potions, row.potions);
  assert.equal(result.nextState.build.resources.maxPotions, row.maximum);
  assert.equal(result.nextState.build.buildDigest, await computeRelicBuildDigestV08(result.nextState.build, webcrypto));
  assert.deepEqual(state, before);
  assert.deepEqual(await applyFatalEventV08(JSON.parse(JSON.stringify(state)), {classification: "local_fatal_event"}, context), result);
});

test("prevention, terminal defeat and historical rules do not refill potions", async () => {
  for (const mode of ["second_chance", "chronoloop", "terminal", "legacy"]) {
    const state = await fixture();
    if (mode === "second_chance") state.build.resources.hasSecondChance = true;
    if (mode === "chronoloop") state.build = await applyRelicAcquisition(state.build,
      {relicId: "chronoloop", acquiredRevision: 0, acquisitionSource: "test", sourceOfferId: "chrono"}, context);
    if (mode === "terminal") state.lives = 1;
    const result = await applyFatalEventV08(state, {classification: "local_fatal_event"},
      mode === "legacy" ? {...context, capabilities: {earlyBalanceOtterRepair: "v1"}} : context);
    assert.equal(result.nextState.build.resources.potions, 0, mode);
  }
});

test("renewed potion budget permits legitimate consumption and still rejects excess", async () => {
  const {nextState: state} = await applyFatalEventV08(await fixture(), {classification: "local_fatal_event"}, context);
  state.currentRoomDirective = {directiveId: "directive_respawn", roomNonce: "nonce_respawn", runId: state.runId,
    revision: state.revision, roomIndex: 1, depth: 1, roomType: "combat", roomCategory: "combat"};
  state.currentRewardEnvelope = await createRoomRewardEnvelopeV3({state, directive: state.currentRoomDirective,
    envelopeId: "reward_respawn", ...context});
  const request = count => ({envelopeId: state.currentRewardEnvelope.envelopeId,
    roomDirectiveId: state.currentRoomDirective.directiveId, roomNonce: "nonce_respawn",
    claims: [{claimType: "resource", claimId: "potion-use", count}], reportedGoldDelta: 0,
    reportedGoldTotal: 0, turnCount: 20, elapsedMs: 1000, commandJournalDigest: "journal", compactRoomProof: "proof"});
  const accepted = await settleRoomRewardEnvelopeV3(state, request(3), context);
  assert.equal(accepted.state.build.resources.potions, 0);
  await assert.rejects(() => settleRoomRewardEnvelopeV3(state, request(4), context), /REWARD_CLAIM_POTION_USE_LIMIT/);
});


test("browser respawn replaces native potion reset only for the matching capable directive", async () => {
  const {readFile} = await import("node:fs/promises");
  const vm = await import("node:vm");
  const source = await readFile(new URL("../../../scripts/build-pages-v3.mjs", import.meta.url), "utf8");
  const start = source.indexOf("  function syncRankedRespawnPotions(");
  assert(start >= 0, "respawn synchronization must exist");
  const end = source.indexOf("  function syncRankedCanonicalRelics(", start);
  const canonical = source.slice(source.indexOf("  function syncRankedCanonicalPotionState("), start);
  const state = {player: {potions: 7, maxPotions: 11}, runMods: {}};
  let supported = true;
  const publicState = {rulesetHash: "candidate", potionPolicyVersion: "v1",
    currentRoomDirective: {directiveId: "new-life"}, build: {resources: {potions: 8, maxPotions: 9}},
    runModifiers: {summary: {potionModifiers: {healMultiplier: 1}}}};
  const sandbox = {state, window: {DungeonOnlineV3: {getSnapshot: () => ({publicState})},
    DungeonRankedV3Protocol: {supportsRespawnPotionResources: () => supported}}};
  vm.createContext(sandbox);
  vm.runInContext(canonical + source.slice(start, end), sandbox);
  assert.equal(sandbox.syncRankedRespawnPotions({directiveId: "stale"}), false);
  assert.equal(state.player.potions, 7);
  assert.equal(sandbox.syncRankedRespawnPotions({directiveId: "new-life"}), true);
  assert.deepEqual(state.player, {potions: 8, maxPotions: 9});
  state.player.potions = 0;
  supported = false;
  assert.equal(sandbox.syncRankedRespawnPotions({directiveId: "new-life"}), false);
  assert.equal(state.player.potions, 0);
  assert.match(source, /if \(rankedFatalDirective\) syncRankedRespawnPotions\(rankedFatalDirective\);\s+buildRoom\(\)/u);
});
