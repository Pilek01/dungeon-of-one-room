import pactPolicyDocument from "./data/pact-transaction-policy.generated.json" with { type: "json" };
import {
  commitMetaTransactionV08,
  computeMetaTransactionStateDigestV08,
  consumeCanonicalMetaSourceV08,
  isCanonicalMetaSourceConsumedV08,
  issueMetaTransactionOfferV08
} from "./meta-transaction.js";
import { deriveIntInclusive } from "./rng.js";
import { issueNextRoomDirectiveV08 } from "./room-policy.js";

const policy = pactPolicyDocument.canonicalData;

export const PACT_POLICY_SPEC = Object.freeze({
  moduleFile: "pact-policy.js",
  authority: "SERVER_ISSUED",
  actions: Object.freeze(["apply", "replace", "break", "leave"]),
  offerBinding: "runId+rulesetHash+revision+state/build digest+roomDirectiveId",
  implementationStatus: "m1-test-only"
});

export const V08_PACT_TRANSACTION_POLICY = policy;

function pactRoomBinding(metaState) {
  const directive = metaState.currentRoomDirective;
  if (!directive || directive.roomType !== "pact") {
    throw new TypeError("PACT_SOURCE_UNAVAILABLE");
  }
  if (metaState.pendingPostRoomPact) {
    const pending = metaState.pendingPostRoomPact;
    if (
      !directive.consumed ||
      directive.runId !== metaState.runId ||
      directive.revision !== metaState.revision ||
      directive.directiveId !== pending.completedDirectiveId ||
      directive.roomNonce !== pending.completedDirectiveNonce ||
      pending.completedRevision !== metaState.revision - 1 ||
      pending.completedDepth !== directive.depth ||
      pending.completedRoomIndex !== directive.roomIndex ||
      pending.postSettlementRevision !== metaState.revision ||
      pending.postSettlementBuildDigest !== metaState.build.buildDigest
    ) {
      throw new TypeError("PACT_POST_ROOM_BINDING_STALE");
    }
    return {
      directiveId: pending.completedDirectiveId,
      completedDirectiveId: pending.completedDirectiveId,
      completedRevision: pending.completedRevision,
      postSettlementRevision: pending.postSettlementRevision,
      postSettlementBuildDigest: pending.postSettlementBuildDigest,
      depth: pending.completedDepth,
      roomIndex: pending.completedRoomIndex,
      roomNonce: pending.completedDirectiveNonce,
      phase: "post_room"
    };
  }
  if (directive.runId && directive.runId !== metaState.runId) {
    throw new TypeError("PACT_SOURCE_BINDING_MISMATCH");
  }
  if (directive.revision !== metaState.revision) {
    throw new TypeError("PACT_SOURCE_STALE");
  }
  if (isCanonicalMetaSourceConsumedV08(metaState, directive.directiveId)) {
    throw new TypeError("PACT_SOURCE_ALREADY_CONSUMED");
  }
  return {
    directiveId: directive.directiveId,
    depth: directive.depth,
    roomIndex: directive.roomIndex
  };
}

async function randomInt(metaState, context, purpose, counter, maximum) {
  const derive = context.randomOracle?.deriveIntInclusive
    ? context.randomOracle.deriveIntInclusive.bind(context.randomOracle)
    : deriveIntInclusive;
  return derive(0, maximum, {
    secret: context.secret,
    rulesetId: metaState.rulesetId,
    runId: metaState.runId,
    revision: metaState.revision,
    purpose: `pact/${purpose}`,
    counter,
    cryptoProvider: context.cryptoProvider
  });
}

async function choosePacts(metaState, binding, context) {
  const active = new Set(metaState.build.pacts);
  const pool = policy.pacts.filter(
    (pact) => binding.depth >= pact.minDepth && !active.has(pact.id)
  );
  const choices = [];
  for (
    let index = 0;
    pool.length && index < policy.offerCount;
    index += 1
  ) {
    const selected = await randomInt(
      metaState,
      context,
      "candidate",
      index,
      pool.length - 1
    );
    choices.push(pool.splice(selected, 1)[0]);
  }
  return choices;
}

export async function issuePactOfferV08(metaState, context = {}) {
  if (
    context.capabilities?.postRoomPactSettlement === "post-room-pact-v1" &&
    !metaState.pendingPostRoomPact
  ) {
    throw new TypeError("PACT_POST_ROOM_SETTLEMENT_REQUIRED");
  }
  if (
    metaState.pendingInventory?.sourceType === "pact" &&
    metaState.pendingInventory?.sourceId === "pact-choice"
  ) {
    return structuredClone(metaState);
  }
  const binding = pactRoomBinding(metaState);
  if (!Array.isArray(metaState.build.pacts) || metaState.build.pacts.length > 1) {
    throw new TypeError("PACT_BUILD_INVALID");
  }
  const pacts = await choosePacts(metaState, binding, context);
  if (!pacts.length) return structuredClone(metaState);
  const hasActive = metaState.build.pacts.length === 1;
  const choices = pacts.map((pact) => ({
    kind: hasActive ? "pact_replace" : "pact_apply",
    label: `${hasActive ? "Replace with" : "Bind"} ${pact.id}`,
    publicData: {
      action: hasActive ? "replace" : "apply",
      pactId: pact.id,
      minimumDepth: pact.minDepth,
      cost: 0
    },
    privateData: {
      action: "apply",
      pactId: pact.id,
      expectedCurrentPactId: metaState.build.pacts[0] ?? null
    }
  }));
  choices.push(hasActive
    ? {
        kind: "pact_break",
        label: "Break current pact",
        publicData: {
          action: "break",
          pactId: metaState.build.pacts[0],
          cost: 0
        },
        privateData: {
          action: "break",
          expectedCurrentPactId: metaState.build.pacts[0]
        }
      }
    : {
        kind: "pact_leave",
        label: "Leave pact chamber",
        publicData: { action: "leave", cost: 0 },
        privateData: { action: "leave" }
      });
  return issueMetaTransactionOfferV08(metaState, {
    sourceType: "pact",
    sourceId: "pact-choice",
    sourcePolicyVersion: policy.policyVersion,
    sourceBinding: binding,
    choices
  }, context);
}

export async function commitPactTransactionV08(metaState, request, context = {}) {
  const committed = await commitMetaTransactionV08(metaState, request, ({
    state,
    offer,
    choice
  }) => {
    if (offer.sourceType !== "pact") {
      throw new TypeError("PACT_TRANSACTION_SOURCE_MISMATCH");
    }
    const action = choice.privateData?.action;
    if (action === "leave") {
      return {
        nextState: state,
        publicResult: { action },
        authoritativeCost: { amount: 0, currency: "none" }
      };
    }
    const current = state.build.pacts[0] ?? null;
    if (current !== choice.privateData.expectedCurrentPactId) {
      throw new TypeError("PACT_TARGET_STALE");
    }
    if (action === "apply") {
      const pact = policy.pacts.find(
        (entry) => entry.id === choice.privateData.pactId
      );
      if (
        !pact ||
        offer.sourceBinding.depth < pact.minDepth ||
        current === pact.id
      ) {
        throw new TypeError("PACT_CHOICE_INVALID");
      }
      state.build.pacts = [pact.id];
      consumeCanonicalMetaSourceV08(
        state,
        "pact",
        current ? "pact-replace" : "pact-apply",
        offer.sourceBinding.directiveId
      );
      return {
        nextState: state,
        publicResult: {
          action: current ? "replace" : "apply",
          previousPactId: current,
          pactId: pact.id
        },
        authoritativeCost: { amount: 0, currency: "none" },
        authoritativeReward: { pactId: pact.id }
      };
    }
    if (action === "break") {
      if (!current) throw new TypeError("PACT_BREAK_WITHOUT_ACTIVE");
      state.build.pacts = [];
      consumeCanonicalMetaSourceV08(
        state,
        "pact",
        "pact-break",
        offer.sourceBinding.directiveId
      );
      return {
        nextState: state,
        publicResult: { action, pactId: current },
        authoritativeCost: { amount: 0, currency: "none" }
      };
    }
    throw new TypeError("PACT_TRANSACTION_ACTION_UNKNOWN");
  }, context);
  if (!metaState.pendingPostRoomPact || committed.pendingPostRoomPact === null) {
    return committed;
  }
  const next = structuredClone(committed);
  next.pendingPostRoomPact = null;
  const issued = await issueNextRoomDirectiveV08(next, context);
  const latestReceipt = issued.metaTransactionReceipts?.at(-1);
  if (!latestReceipt || latestReceipt.transactionId !== request.transactionId) {
    throw new TypeError("PACT_TRANSACTION_RECEIPT_MISSING");
  }
  latestReceipt.resultingStateDigest = await computeMetaTransactionStateDigestV08(
    issued,
    context.cryptoProvider
  );
  return issued;
}
