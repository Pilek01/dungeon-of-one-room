import manifest from "./data/ruleset-manifest.json" with { type: "json" };
import { RULESET_ID, RULESET_STATUS } from "./constants.js";
import { createInitialMetaStateV08 } from "./meta-state.js";
import {
  consumeRoomDirectiveV08,
  issueNextRoomDirectiveV08
} from "./room-policy.js";
import {
  settleBoundaryRewardEnvelopeV3,
  settleRoomRewardEnvelopeV3,
  refreshIssuedStateDigestV08
} from "./reward-policy.js";
import {
  issueStartingRelicOfferV08,
  projectPublicStartingRelicOfferV08,
  selectStartingRelic
} from "./starting-relic-offer.js";
import {
  issueRegularRelicOffer,
  projectPublicRegularRelicOfferV08,
  selectRegularRelic
} from "./regular-relic-offer.js";
import {
  cancelRelicReplacement,
  commitRelicReplacement,
  projectPublicRelicReplacement
} from "./relic-replacement.js";
import {
  commitRelicRewardFallback,
  resolveRelicFallback,
  resolveRelicRewardAvailability
} from "./relic-reward-fallback.js";
import {
  commitMerchantTransactionV08,
  issueMerchantInventoryV08
} from "./merchant-policy.js";
import {
  commitForgeTransactionV08,
  issueForgeTemperOfferV08,
  issueForgeTransmuteOfferV08
} from "./forge-policy.js";
import {
  commitCrossroadsTransactionV08,
  issueCrossroadsOfferV08
} from "./crossroads-policy.js";
import {
  beginCampSessionV08,
  commitCampTransactionV08,
  issueCampTransactionsV08
} from "./camp-policy.js";
import {
  commitPactTransactionV08,
  issuePactOfferV08
} from "./pact-policy.js";
import { projectPublicMetaTransactionOfferV08 } from "./meta-transaction.js";
import { applyFatalEventV08 } from "./life-policy.js";
import { requestExtractionV08 } from "./outcome-policy.js";
import { deriveFinalScoreV08 } from "./score-policy.js";
import {
  buildFinalProjectionsV08,
  deriveFinalDurationV08
} from "./leaderboard-summary.js";
import { finalizeRunV08 } from "./finalization-policy.js";
import { createLeaderboardSnapshot } from "../../domain/leaderboard-snapshot.js";
import { applyTestAssistanceV08 } from "./test-assistance.js";
import { projectPublicRunModifiers } from "./run-modifiers.js";
import {
  applyPotionResourceTransitionV08,
  assertCanonicalPotionResourcesV08,
  derivePotionMaximumV08,
  initializePotionResourcesV08
} from "./potion-policy.js";
import {
  applyPracticeMutatorImportV08,
  projectPublicMutatorProgressV08,
  resetMutatorCampaignProgressV08
} from "./mutator-progression.js";
import {
  applyPracticeMutatorImportToProfileV08,
  createInitialProfileStateV08,
  hydrateRunFromProfileV08,
  profileStateFromRunV08,
  publicProfileStateV08
} from "./profile-policy.js";
export {
  applyPotionResourceTransitionV08,
  assertCanonicalPotionResourcesV08,
  derivePotionMaximumV08,
  initializePotionResourcesV08
} from "./potion-policy.js";
export {
  applyRelicAcquisition,
  applyRelicRemovalV08,
  assertCanonicalRelicBuildDigestV08,
  canAcquireRelic,
  computeRelicBuildDigestV08,
  getRelicSlotCost,
  getRelicSlotLimit,
  getRelicStackLimit,
  previewRelicAcquisitionV08,
  previewRelicIncomingV08,
  projectPublicBuild
} from "./relic-policy.js";
export {
  RELIC_REPLACEMENT_POLICY_VERSION,
  assertPendingRelicTransactionV08,
  cancelRelicReplacement,
  commitRelicReplacement,
  createPendingRelicTransactionV08,
  evaluateRelicAcquisition,
  isRelicDraftEligibleV08,
  projectPublicRelicReplacement
} from "./relic-replacement.js";
export {
  RELIC_REWARD_FALLBACK_HISTORY_LIMIT,
  RELIC_REWARD_FALLBACK_POLICY_VERSION,
  V08_RELIC_REWARD_FALLBACK_POLICY,
  assertRelicFallbackHistoryV08,
  commitRelicRewardFallback,
  projectPublicRelicFallbackReceiptV08,
  resolveRelicFallback,
  resolveRelicRewardAvailability
} from "./relic-reward-fallback.js";
export {
  assertStartingRelicOfferV08,
  issueStartingRelicOfferV08,
  projectPublicStartingRelicOfferV08,
  selectStartingRelic
} from "./starting-relic-offer.js";
export {
  assertRegularRelicOfferV08,
  getArenaRelicCandidatePoolV08,
  getOtterRelicCandidatePoolV08,
  getRegularRelicCandidatePoolV08,
  issueRegularRelicOffer,
  projectPublicRegularRelicOfferV08,
  selectRegularRelic
} from "./regular-relic-offer.js";
export {
  META_TRANSACTION_POLICY_VERSION,
  META_TRANSACTION_RECEIPT_LIMIT,
  assertMetaTransactionReceiptsV08,
  assertPendingMetaTransactionOfferV08,
  awardCanonicalGoldV08,
  commitMetaTransactionV08,
  computeMetaTransactionStateDigestV08,
  consumeCanonicalMetaSourceV08,
  isCanonicalMetaSourceConsumedV08,
  issueMetaTransactionOfferV08,
  preflightMetaTransactionV08,
  projectPublicMetaTransactionOfferV08,
  spendCanonicalGoldV08
} from "./meta-transaction.js";
export {
  MERCHANT_POLICY_SPEC,
  V08_MERCHANT_TRANSACTION_POLICY,
  commitMerchantTransactionV08,
  issueMerchantInventoryV08
} from "./merchant-policy.js";
export {
  FORGE_POLICY_SPEC,
  V08_FORGE_TRANSACTION_POLICY,
  commitForgeTransactionV08,
  issueForgeTemperOfferV08,
  issueForgeTransmuteOfferV08
} from "./forge-policy.js";
export {
  CROSSROADS_POLICY_SPEC,
  V08_CROSSROADS_TRANSACTION_POLICY,
  advanceCrossroadsTurnsV08,
  commitCrossroadsTransactionV08,
  issueCrossroadsOfferV08
} from "./crossroads-policy.js";
export {
  CAMP_POLICY_SPEC,
  V08_CAMP_TRANSACTION_POLICY,
  beginCampSessionV08,
  closeCampSessionV08,
  commitCampTransactionV08,
  issueCampTransactionsV08
} from "./camp-policy.js";
export {
  PACT_POLICY_SPEC,
  V08_PACT_TRANSACTION_POLICY,
  commitPactTransactionV08,
  issuePactOfferV08
} from "./pact-policy.js";
export {
  LIFE_POLICY_SPEC,
  LIFE_POLICY_VERSION,
  applyFatalEventV08,
  assertLifeLedgerV08,
  createLifeLedgerV08
} from "./life-policy.js";
export {
  OUTCOME_POLICY_VERSION,
  TERMINAL_ELIGIBLE_STATUSES,
  assertTerminalEligibilityV08,
  requestExtractionV08
} from "./outcome-policy.js";
export {
  SCORE_POLICY_SPEC,
  SCORE_VERSION_V08,
  acceptedRunGoldEarnedV08,
  deriveFinalScoreV08
} from "./score-policy.js";
export {
  DURATION_POLICY_VERSION,
  LEADERBOARD_SUMMARY_SPEC,
  buildFinalProjectionsV08,
  deriveFinalDurationV08
} from "./leaderboard-summary.js";
export {
  FINALIZATION_POLICY_VERSION,
  finalizeRunV08
} from "./finalization-policy.js";

function mergeContext(options, context) {
  return {
    ...context,
    secret: context?.secret ?? options.secret,
    randomOracle: context?.randomOracle ?? options.randomOracle,
    capabilities: context?.capabilities ?? options.capabilities
  };
}

export function createV08Meta1Ruleset(options = {}) {
  const rulesetHash = options.rulesetHash || manifest.rulesetHash;
  return Object.freeze({
    rulesetId: RULESET_ID,
    rulesetHash,
    status: RULESET_STATUS,
    capabilities: Object.freeze({ ...(options.capabilities || {}) }),

    createInitialMetaState(input, context) {
      return createInitialMetaStateV08({
        ...input,
        rulesetHash
      }, context);
    },

    async createRun(input, context) {
      const profileUnlocks = input.newCampaign
        ? null
        : input.profileState?.campaign?.unlockedStartDepths;
      const initialInput = {
        ...input,
        rulesetHash,
        unlockedStartDepths: Array.isArray(profileUnlocks) ? profileUnlocks : input.unlockedStartDepths
      };
      let initial = createInitialMetaStateV08(initialInput, context);
      if (input.newCampaign && input.profileState) {
        initial.profileId = input.profileState.profileId;
        initial.mutatorProgress = resetMutatorCampaignProgressV08(
          input.profileState.mutatorProgress
        );
      } else {
        initial = await hydrateRunFromProfileV08(
          initial,
          input.profileState,
          mergeContext(options, context)
        );
      }
      if (input.practiceMutatorImport && !initial.mutatorProgress.importConsumed) {
        initial.mutatorProgress = applyPracticeMutatorImportV08(
          initial.mutatorProgress,
          input.practiceMutatorImport,
          { importedAt: context.now }
        );
      }
      const startingRelicAlreadyGranted = !input.newCampaign && (
        input.profileState?.startingRelicGranted === true ||
        Boolean(input.profileState?.lastExtractedRunId)
      );
      if (initial.build.relics.length > 0 || startingRelicAlreadyGranted) {
        initial.status = "active";
        return issueNextRoomDirectiveV08(initial, mergeContext(options, context));
      }
      return issueStartingRelicOfferV08(initial, mergeContext(options, context));
    },

    applyPracticeMutatorImportToProfile(profile, payload, context = {}) {
      return applyPracticeMutatorImportToProfileV08(profile, payload, context);
    },

    createInitialProfileState(state, profileId) {
      return createInitialProfileStateV08(state, profileId);
    },

    profileStateFromRun(state, profileId, profileRevision) {
      return profileStateFromRunV08(state, profileId, profileRevision);
    },

    publicProfileState(profile) {
      return publicProfileStateV08(profile);
    },

    projectPublicRunModifiers(state) {
      return projectPublicRunModifiers(state);
    },

    projectPublicMutatorProgress(state) {
      return projectPublicMutatorProgressV08(state.mutatorProgress);
    },

    async selectStartingRelic(state, request, context = {}) {
      const mergedContext = mergeContext(options, context);
      const selected = await selectStartingRelic(state, request, mergedContext);
      if (selected.pendingRelicTransaction) return selected;
      if (selected.currentRoomDirective) return selected;
      return issueNextRoomDirectiveV08(selected, mergedContext);
    },

    projectPublicStartingRelicOffer(offer) {
      return projectPublicStartingRelicOfferV08(offer);
    },

    async issueRegularRelicOffer(state, request, context = {}) {
      return issueRegularRelicOffer(
        state,
        request,
        mergeContext(options, context)
      );
    },

    async selectRegularRelic(state, request, context = {}) {
      return selectRegularRelic(
        state,
        request,
        mergeContext(options, context)
      );
    },

    projectPublicRegularRelicOffer(offer) {
      return projectPublicRegularRelicOfferV08(offer);
    },

    async commitRelicReplacement(state, request, context = {}) {
      return commitRelicReplacement(
        state,
        request,
        mergeContext(options, context)
      );
    },

    async cancelRelicReplacement(state, request, context = {}) {
      return cancelRelicReplacement(
        state,
        request,
        mergeContext(options, context)
      );
    },

    projectPublicRelicReplacement(state) {
      return projectPublicRelicReplacement(state);
    },

    resolveRelicRewardAvailability(state, trustedInput) {
      return resolveRelicRewardAvailability(state, trustedInput);
    },

    async commitRelicRewardFallback(state, request, context = {}) {
      return commitRelicRewardFallback(
        state,
        request,
        mergeContext(options, context)
      );
    },

    async issueMerchantInventory(state, context = {}) {
      return issueMerchantInventoryV08(
        state,
        mergeContext(options, context)
      );
    },

    async commitMerchantTransaction(state, request, context = {}) {
      return commitMerchantTransactionV08(
        state,
        request,
        mergeContext(options, context)
      );
    },

    projectPublicMerchantInventory(state) {
      return projectPublicMetaTransactionOfferV08(state?.pendingInventory);
    },

    async issueForgeTemperOffer(state, context = {}) {
      return issueForgeTemperOfferV08(
        state,
        mergeContext(options, context)
      );
    },

    async issueForgeTransmuteOffer(state, context = {}) {
      return issueForgeTransmuteOfferV08(
        state,
        mergeContext(options, context)
      );
    },

    async commitForgeTransaction(state, request, context = {}) {
      return commitForgeTransactionV08(
        state,
        request,
        mergeContext(options, context)
      );
    },

    projectPublicForgeOffer(state) {
      return projectPublicMetaTransactionOfferV08(state?.pendingInventory);
    },

    async issueCrossroadsOffer(state, context = {}) {
      return issueCrossroadsOfferV08(
        state,
        mergeContext(options, context)
      );
    },

    async commitCrossroadsTransaction(state, request, context = {}) {
      return commitCrossroadsTransactionV08(
        state,
        request,
        mergeContext(options, context)
      );
    },

    projectPublicCrossroadsOffer(state) {
      return projectPublicMetaTransactionOfferV08(state?.pendingInventory);
    },

    async beginCampSession(state, context = {}) {
      return beginCampSessionV08(
        state,
        mergeContext(options, context)
      );
    },

    async issueCampTransactions(state, context = {}) {
      return issueCampTransactionsV08(
        state,
        mergeContext(options, context)
      );
    },

    async commitCampTransaction(state, request, context = {}) {
      return commitCampTransactionV08(
        state,
        request,
        mergeContext(options, context)
      );
    },

    projectPublicCampTransactions(state) {
      return projectPublicMetaTransactionOfferV08(state?.pendingInventory);
    },

    async issuePactOffer(state, context = {}) {
      return issuePactOfferV08(
        state,
        mergeContext(options, context)
      );
    },

    async commitPactTransaction(state, request, context = {}) {
      return commitPactTransactionV08(
        state,
        request,
        mergeContext(options, context)
      );
    },

    projectPublicPactOffer(state) {
      return projectPublicMetaTransactionOfferV08(state?.pendingInventory);
    },

    async issueRoomDirective(state, context = {}) {
      return issueNextRoomDirectiveV08(state, mergeContext(options, context));
    },

    async consumeRoomDirective(state, operation, context = {}) {
      return consumeRoomDirectiveV08(
        state,
        operation,
        mergeContext(options, context)
      );
    },

    async refreshRewardEnvelope(state, context = {}) {
      return refreshIssuedStateDigestV08(
        state,
        mergeContext(options, context)
      );
    },

    async reportFatalEvent(state, request, context = {}) {
      const result = await applyFatalEventV08(
        state,
        request,
        mergeContext(options, context)
      );
      if (
        result.nextState.status === "active" &&
        !result.nextState.currentRoomDirective
      ) {
        result.nextState = await issueNextRoomDirectiveV08(
          result.nextState,
          mergeContext(options, context)
        );
      }
      return result;
    },

    requestExtraction(state, request) {
      return requestExtractionV08(state, request);
    },

    computeFinalScore(state) {
      return deriveFinalScoreV08(state);
    },

    buildFinalProjections(state, final) {
      return buildFinalProjectionsV08(state, final);
    },

    deriveFinalDuration(state, finalizedAt) {
      return deriveFinalDurationV08(state, finalizedAt);
    },

    createLeaderboardSnapshot(state, options = {}) {
      const scoreProjection = deriveFinalScoreV08(state);
      const durationProjection = deriveFinalDurationV08(state, options.createdAt);
      const projections = buildFinalProjectionsV08(state, {
        outcome: options.outcome,
        scoreProjection,
        durationProjection
      });
      return createLeaderboardSnapshot({
        runId: state.runId,
        profileId: state.profileId,
        season: state.season,
        playerName: state.playerName,
        score: scoreProjection.score,
        depth: scoreProjection.inputs.acceptedMaxDepth,
        gold: scoreProjection.inputs.acceptedRunGoldEarned,
        durationMs: durationProjection.durationMs,
        outcome: options.outcome,
        snapshotKind: options.snapshotKind,
        assistanceClass: state.assistanceClass || "none",
        build: projections.build,
        summary: projections.summary,
        verificationLevel: state.verificationLevel,
        createdAt: options.createdAt
      });
    },

    markTestAssistance(state, request = {}) {
      if (state.status !== "active") {
        throw new TypeError("TEST_ASSISTANCE_RUN_NOT_ACTIVE");
      }
      if (
        state.pendingOffer ||
        state.pendingRelicTransaction ||
        state.pendingInventory ||
        state.campSession
      ) {
        throw new TypeError("TEST_ASSISTANCE_BOUNDARY_BUSY");
      }
      const nextState = applyTestAssistanceV08(
        state,
        request.assistanceClass
      );
      nextState.revision = state.revision + 1;
      if (nextState.currentRoomDirective) {
        nextState.currentRoomDirective.revision = nextState.revision;
      }
      if (nextState.currentRewardEnvelope) {
        nextState.currentRewardEnvelope.revision = nextState.revision;
      }
      return nextState;
    },

    finalizeRun(state, context = {}) {
      return finalizeRunV08(state, context);
    },

    async settleRoomRewardEnvelope(state, request, context = {}) {
      return settleRoomRewardEnvelopeV3(
        state,
        request,
        mergeContext(options, context)
      );
    },

    async settleBoundaryRewardEnvelope(state, request, settlement, context = {}) {
      return settleBoundaryRewardEnvelopeV3(
        state,
        request,
        settlement,
        mergeContext(options, context)
      );
    }
  });
}

export const V08_META_1_DESCRIPTOR = Object.freeze({
  rulesetId: RULESET_ID,
  rulesetHash: manifest.rulesetHash,
  status: RULESET_STATUS,
  createRuleset: createV08Meta1Ruleset
});

export { manifest as V08_META_1_MANIFEST };
