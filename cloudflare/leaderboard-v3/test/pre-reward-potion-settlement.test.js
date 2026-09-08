import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { createInitialMetaStateV08 } from "../src/rulesets/v08-meta-1/meta-state.js";
import * as rewards from "../src/rulesets/v08-meta-1/reward-policy.js";
import { applyRelicAcquisition, applyRelicRemovalV08, computeRelicBuildDigestV08 } from "../src/rulesets/v08-meta-1/relic-policy.js";
import { issueRegularRelicOffer, selectRegularRelic } from "../src/rulesets/v08-meta-1/regular-relic-offer.js";
import { commitRelicReplacement } from "../src/rulesets/v08-meta-1/relic-replacement.js";

const context = { runId: "run_potion_boundary", season: "test", startedAt: 1900000000000,
  secret: "potion-boundary-regression-secret", cryptoProvider: webcrypto,
  randomOracle: { async deriveIntInclusive() { return 800000; } },
  capabilities: { canonicalChestOutcomes: "v1", potionClaimOrdering: "v1" } };
async function fixture(flask = true) {
  const state = createInitialMetaStateV08({}, context);
  state.status = "active"; state.potionPolicyVersion = "v1";
  state.build.campUpgrades.satchel = 5;
  Object.assign(state.build.resources, { potions: 8, maxPotions: 8 });
  state.build.buildDigest = await computeRelicBuildDigestV08(state.build, webcrypto);
  if (flask) state.build = await applyRelicAcquisition(state.build, { relicId: "flask", acquisitionSource: "test", acquiredRevision: 0, sourceOfferId: "flask" }, context);
  state.currentRoomDirective = { directiveId: "directive_potions", runId: state.runId, revision: state.revision, roomIndex: 1, depth: 20, roomType: "boss", roomCategory: "boss", specialRoomPayload: null };
  state.currentRewardEnvelope = await rewards.createRoomRewardEnvelopeV3({ state, directive: state.currentRoomDirective, envelopeId: "envelope_potions", ...context });
  return state;
}
async function changeFlask(state, acquire) {
  const next = structuredClone(state);
  next.build = acquire
    ? await applyRelicAcquisition(next.build, { relicId: "flask", acquisitionSource: "boss_drop", acquiredRevision: state.revision, sourceOfferId: "new_flask" }, context)
    : await applyRelicRemovalV08(next.build, { relicId: "flask" }, context);
  assert.equal(typeof rewards.capturePreRewardPotionTransitionV08, "function");
  rewards.capturePreRewardPotionTransitionV08(state, next);
  await rewards.refreshIssuedStateDigestV08(next, context);
  return next;
}
function request(state, first, last = 0) {
  const slot = state.currentRewardEnvelope.claimSlots[0];
  const claims = [{ claimType: "resource", claimId: "potion-use", count: first }];
  if (last) claims.push({ claimType: "chest", claimId: slot.slotId, count: 1, localEvidence: { outcome: "potion", awardId: slot.canonicalOutcome.awardId, count: 1 } }, { claimType: "resource", claimId: "potion-use", count: last });
  const fixed = state.currentRewardEnvelope.fixedAwards.reduce((sum, award) => sum + award.amount, 0);
  return { envelopeId: state.currentRewardEnvelope.envelopeId, roomDirectiveId: state.currentRoomDirective.directiveId, roomNonce: state.currentRoomDirective.roomNonce, claims, reportedGoldDelta: fixed, reportedGoldTotal: state.gold + fixed, turnCount: 88, elapsedMs: 1000, commandJournalDigest: "journal", compactRoomProof: "proof" };
}
test("Flask loss after combat preserves ordered uses and replay without extra potions", async () => {
  const state = await changeFlask(await fixture(), false);
  const body = request(state, 5, 5);
  const settled = await rewards.settleRoomRewardEnvelopeV3(state, body, context);
  assert.equal(settled.state.build.resources.potions, 0);
  assert.equal(settled.state.build.resources.maxPotions, 8);
  assert.deepEqual(settled.anomalies, []);
  const replay = await rewards.settleRoomRewardEnvelopeV3(JSON.parse(JSON.stringify(settled.state)), body, context);
  assert.equal(replay.replayed, true);
  assert.equal(replay.state.build.resources.potions, 0);
  await assert.rejects(() => rewards.settleRoomRewardEnvelopeV3(state, request(state, 5, 6), context), /POTION_USE_LIMIT/);
});
test("Flask loss applies capacity after partial consumption, not before", async () => {
  const state = await changeFlask(await fixture(), false);
  for (let uses = 1; uses <= 9; uses++) {
    const result = await rewards.settleRoomRewardEnvelopeV3(state, request(state, uses), context);
    assert.equal(result.state.build.resources.potions, 9 - uses);
  }
});
test("new Flask cannot retroactively authorize a potion used before the reward", async () => {
  const state = await changeFlask(await fixture(false), true);
  await assert.rejects(() => rewards.settleRoomRewardEnvelopeV3(state, request(state, 9), context), /POTION_USE_LIMIT/);
  const result = await rewards.settleRoomRewardEnvelopeV3(state, request(state, 8), context);
  assert.equal(result.state.build.resources.potions, 1);
  assert.equal(result.state.build.resources.maxPotions, 9);
});
test("multiple pre-reward Flask transitions retain order across serialization", async () => {
  let state = await changeFlask(await fixture(), false);
  state = await changeFlask(state, true);
  const result = await rewards.settleRoomRewardEnvelopeV3(JSON.parse(JSON.stringify(state)), request(state, 9), context);
  assert.equal(result.state.build.resources.potions, 1);
});

test("real Warden offer and Flask replacement record the server resource history", async () => {
  let state = await fixture();
  for (const relicId of ["aegisdynamo", "fieldrations", "trapweave", "lucky", "stormsigil", "merchfavor1", "mirrorcarapace"]) {
    state.build = await applyRelicAcquisition(state.build, { relicId, acquiredRevision: state.revision, acquisitionSource: "test", sourceOfferId: relicId }, context);
  }
  await rewards.refreshIssuedStateDigestV08(state, context);
  const slot = state.currentRewardEnvelope.rewardSlots.find(entry => entry.availabilityMode === "pre_offer");
  assert.ok(slot);
  const offerContext = { ...context, randomOracle: undefined };
  state = await issueRegularRelicOffer(state, { rewardEnvelopeId: state.currentRewardEnvelope.envelopeId, rewardSlotId: slot.slotId, sourceDirectiveId: state.currentRoomDirective.directiveId }, offerContext);
  const choice = state.pendingOffer.choices.find(entry => entry.privateRelicId !== "flask");
  assert.ok(choice);
  state = await selectRegularRelic(state, { offerId: state.pendingOffer.offerId, choiceId: choice.choiceId }, offerContext);
  const transaction = state.pendingRelicTransaction;
  assert.ok(transaction);
  const replacement = transaction.candidates.find(entry => entry.removals.some(removal => removal.relicId === "flask"));
  assert.ok(replacement);
  state = await commitRelicReplacement(state, { transactionId: transaction.transactionId, replacementChoiceId: replacement.replacementChoiceId }, offerContext);
  assert.equal(state.preRewardPotionSettlement.startingPotions, 9);
  assert.equal(state.build.resources.potions, 8);
  const replay = await commitRelicReplacement(state, { transactionId: transaction.transactionId, replacementChoiceId: replacement.replacementChoiceId }, offerContext);
  assert.equal(replay.preRewardPotionSettlement.transitions.length, 1);
  await rewards.refreshIssuedStateDigestV08(state, context);
  const result = await rewards.settleRoomRewardEnvelopeV3(state, request(state, 5, 5), context);
  assert.equal(result.state.build.resources.potions, 0);
});
