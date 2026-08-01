import sourceAuditDocument from "./data/m3-finalization-source-audit.generated.json" with { type: "json" };
import {
  applyRelicRemovalV08,
  getRelicCatalogEntryV08
} from "./relic-policy.js";
import { chooseIndex } from "./rng.js";

const policy = sourceAuditDocument.canonicalData;
const HISTORY_LIMIT = 32;

export const LIFE_POLICY_VERSION = "v08-life-1";

export const LIFE_POLICY_SPEC = Object.freeze({
  moduleFile: "life-policy.js",
  policyVersion: LIFE_POLICY_VERSION,
  authority: Object.freeze({
    maximumLives: "SERVER_DERIVED",
    fatalEventReport: "HEURISTIC_ONLY",
    fatalEventResolution: "SERVER_DERIVED",
    issuedLifePurchase: "SERVER_DERIVED",
    deathRelicLoss: "SERVER_ISSUED"
  }),
  implementationStatus: "m3-canonical"
});

function exactFatalEventRequest(request) {
  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request) ||
    !["classification", "classification,elixirUsage"].includes(Object.keys(request).sort().join(",")) ||
    request.classification !== "local_fatal_event"
  ) {
    throw new TypeError("FATAL_EVENT_CLASSIFICATION_INVALID");
  }
  return request;
}

function normalizeElixirUsage(state, request) {
  if (request.elixirUsage === undefined) return null;
  const usage = request.elixirUsage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage) ||
      Object.keys(usage).sort().join(",") !== "count,elixirId") {
    throw new TypeError("FATAL_ELIXIR_USAGE_INVALID");
  }
  const elixirId = String(usage.elixirId || "");
  const count = usage.count;
  if (!elixirId || !Number.isSafeInteger(count) || count < 1 || count > 5) {
    throw new TypeError("FATAL_ELIXIR_USAGE_INVALID");
  }
  const loadout = Array.isArray(state.build?.elixirs) ? state.build.elixirs : [];
  if (loadout.length !== 1 || loadout[0]?.elixirId !== elixirId ||
      !Number.isSafeInteger(loadout[0]?.charges) || count > loadout[0].charges) {
    throw new TypeError("FATAL_ELIXIR_USAGE_UNAVAILABLE");
  }
  return { elixirId, count };
}

function appendHistory(history, entry) {
  return [...(Array.isArray(history) ? history : []), entry].slice(-HISTORY_LIMIT);
}

function chronoLoopEntry(state) {
  return state.build.relics.find((entry) => entry.relicId === "chronoloop") || null;
}

function chronoLoopAvailable(state) {
  const entry = chronoLoopEntry(state);
  return Boolean(
    entry &&
    state.lifeLedger.chronoLoopConsumedAcquiredRevision !== entry.acquiredRevision
  );
}

function clearTransientBoundary(state) {
  state.currentRoomDirective = null;
  state.currentRewardEnvelope = null;
  state.pendingOffer = null;
  state.pendingRelicTransaction = null;
  state.pendingInventory = null;
  state.campSession = null;
}

function ownedDeathLossCopies(state) {
  const copies = [];
  for (const entry of state.build.relics) {
    if (getRelicCatalogEntryV08(entry.relicId).mythic) continue;
    for (let stack = 0; stack < entry.stacks; stack += 1) {
      copies.push(entry.relicId);
    }
  }
  return copies;
}

async function applyDeathRelicLoss(state, context) {
  const copies = ownedDeathLossCopies(state);
  if (copies.length === 0) return null;
  const selectedIndex = await chooseIndex(copies.length, {
    secret: context.secret,
    runId: state.runId,
    revision: state.revision,
    purpose: "life/death-relic-loss",
    counter: state.lifeLedger.lifeLosses,
    cryptoProvider: context.cryptoProvider
  });
  const relicId = copies[selectedIndex];
  state.build = await applyRelicRemovalV08(
    state.build,
    { relicId, stacks: 1 },
    context
  );
  return relicId;
}

export function createLifeLedgerV08() {
  return {
    policyVersion: LIFE_POLICY_VERSION,
    maximumLives: policy.maximumLives,
    fatalEvents: 0,
    preventedDeaths: 0,
    chronoLoopPreventions: 0,
    secondChancePreventions: 0,
    lifeLosses: 0,
    currentLife: 1,
    chronoLoopConsumedAcquiredRevision: null,
    history: []
  };
}

export function assertLifeLedgerV08(state) {
  const ledger = state?.lifeLedger;
  if (!ledger || ledger.policyVersion !== LIFE_POLICY_VERSION) {
    throw new TypeError("LIFE_LEDGER_INVALID");
  }
  if (ledger.maximumLives !== policy.maximumLives) {
    throw new TypeError("LIFE_LEDGER_MAXIMUM_MISMATCH");
  }
  for (const field of [
    "fatalEvents",
    "preventedDeaths",
    "chronoLoopPreventions",
    "secondChancePreventions",
    "lifeLosses",
    "currentLife"
  ]) {
    if (!Number.isSafeInteger(ledger[field]) || ledger[field] < (field === "currentLife" ? 1 : 0)) {
      throw new TypeError(`LIFE_LEDGER_INVALID:${field}`);
    }
  }
  if (
    ledger.chronoLoopConsumedAcquiredRevision !== null &&
    (
      !Number.isSafeInteger(ledger.chronoLoopConsumedAcquiredRevision) ||
      ledger.chronoLoopConsumedAcquiredRevision < 0
    )
  ) {
    throw new TypeError("LIFE_LEDGER_INVALID:chronoLoopConsumedAcquiredRevision");
  }
  if (!Array.isArray(ledger.history) || ledger.history.length > HISTORY_LIMIT) {
    throw new TypeError("LIFE_LEDGER_INVALID:history");
  }
  if (
    !Number.isSafeInteger(state.lives) ||
    state.lives < 0 ||
    state.lives > ledger.maximumLives
  ) {
    throw new TypeError("LIVES_OUT_OF_BOUNDS");
  }
  return ledger;
}

export async function applyFatalEventV08(state, request, context = {}) {
  exactFatalEventRequest(request);
  assertLifeLedgerV08(state);
  if (state.status !== "active") throw new TypeError("RUN_NOT_ACTIVE");
  const next = structuredClone(state);
  const before = structuredClone(state);
  const elixirUsage = normalizeElixirUsage(next, request);
  if (elixirUsage) {
    next.build.elixirs[0].charges -= elixirUsage.count;
  }
  next.lifeLedger.fatalEvents += 1;

  let resolution;
  let lostRelicId = null;
  if (chronoLoopAvailable(next)) {
    const entry = chronoLoopEntry(next);
    next.lifeLedger.chronoLoopConsumedAcquiredRevision = entry.acquiredRevision;
    next.lifeLedger.preventedDeaths += 1;
    next.lifeLedger.chronoLoopPreventions += 1;
    resolution = "prevented_chronoloop";
  } else if (next.build.resources.hasSecondChance) {
    next.build.resources.hasSecondChance = false;
    next.lifeLedger.preventedDeaths += 1;
    next.lifeLedger.secondChancePreventions += 1;
    resolution = "prevented_second_chance";
  } else {
    next.lives = Math.max(0, next.lives - 1);
    next.lifeLedger.lifeLosses += 1;
    lostRelicId = await applyDeathRelicLoss(next, context);
    clearTransientBoundary(next);
    if (next.lives === 0) {
      next.status = "defeat";
      next.terminalEligibility = {
        outcome: "defeat",
        eligibleRevision: next.revision,
        reason: "canonical_lives_exhausted"
      };
      resolution = "terminal_defeat";
    } else {
      next.depth = 0;
      next.roomIndex = 0;
      next.lifeLedger.currentLife += 1;
      next.lifeLedger.chronoLoopConsumedAcquiredRevision = null;
      resolution = "life_lost";
    }
  }

  const receipt = {
    fatalEvent: next.lifeLedger.fatalEvents,
    resolution,
    livesBefore: before.lives,
    livesAfter: next.lives,
    lostRelicId,
    elixirUsage
  };
  next.lifeLedger.history = appendHistory(next.lifeLedger.history, receipt);
  assertLifeLedgerV08(next);
  if (JSON.stringify(state) !== JSON.stringify(before)) {
    throw new TypeError("LIFE_TRANSITION_MUTATED_INPUT");
  }
  return {
    nextState: next,
    publicResult: receipt
  };
}

export const V08_LIFE_POLICY_DATA = Object.freeze(policy);
