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
export {
  applyRelicAcquisition,
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
  assertStartingRelicOfferV08,
  issueStartingRelicOfferV08,
  projectPublicStartingRelicOfferV08,
  selectStartingRelic
} from "./starting-relic-offer.js";
export {
  assertRegularRelicOfferV08,
  getOtterRelicCandidatePoolV08,
  getRegularRelicCandidatePoolV08,
  issueRegularRelicOffer,
  projectPublicRegularRelicOfferV08,
  selectRegularRelic
} from "./regular-relic-offer.js";

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
