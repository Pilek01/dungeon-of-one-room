import manifest from "./data/ruleset-manifest.json" with { type: "json" };
import { RULESET_ID, RULESET_STATUS } from "./constants.js";
import { createInitialMetaStateV08 } from "./meta-state.js";
import {
  consumeRoomDirectiveV08,
  issueNextRoomDirectiveV08
} from "./room-policy.js";
import { settleRoomRewardEnvelopeV3 } from "./reward-policy.js";
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

function mergeContext(options, context) {
  return {
    ...context,
    secret: context?.secret ?? options.secret,
    randomOracle: context?.randomOracle ?? options.randomOracle
  };
}

export function createV08Meta1Ruleset(options = {}) {
  return Object.freeze({
    rulesetId: RULESET_ID,
    rulesetHash: manifest.rulesetHash,
    status: RULESET_STATUS,

    createInitialMetaState(input, context) {
      return createInitialMetaStateV08(input, context);
    },

    async createRun(input, context) {
      const initial = createInitialMetaStateV08(input, context);
      return issueStartingRelicOfferV08(initial, mergeContext(options, context));
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

    async settleRoomRewardEnvelope(state, request, context = {}) {
      return settleRoomRewardEnvelopeV3(
        state,
        request,
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
