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
export {
  applyRelicAcquisition,
  assertCanonicalRelicBuildDigestV08,
  canAcquireRelic,
  computeRelicBuildDigestV08,
  getRelicSlotCost,
  getRelicSlotLimit,
  getRelicStackLimit,
  projectPublicBuild
} from "./relic-policy.js";
export {
  assertStartingRelicOfferV08,
  issueStartingRelicOfferV08,
  projectPublicStartingRelicOfferV08,
  selectStartingRelic
} from "./starting-relic-offer.js";

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
      if (selected.currentRoomDirective) return selected;
      return issueNextRoomDirectiveV08(selected, mergedContext);
    },

    projectPublicStartingRelicOffer(offer) {
      return projectPublicStartingRelicOfferV08(offer);
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
