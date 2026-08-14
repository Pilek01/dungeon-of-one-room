import modifiersDocument from "./data/gold-modifiers.generated.json" with { type: "json" };
import sourcesDocument from "./data/gold-sources.generated.json" with { type: "json" };
import rewardBoundsDocument from "./data/room-reward-bounds.generated.json" with { type: "json" };
import pactPolicyDocument from "./data/pact-transaction-policy.generated.json" with { type: "json" };
import campPolicyDocument from "./data/camp-transaction-policy.generated.json" with { type: "json" };
import {
  createEmptyRunModifierLedgerV08,
  deriveRunModifierEffects
} from "./run-modifiers.js";

const modifiers = modifiersDocument.canonicalData;
const sources = sourcesDocument.canonicalData;
const rewardBounds = rewardBoundsDocument.canonicalData;
const pactPolicy = pactPolicyDocument.canonicalData;
const campPolicy = campPolicyDocument.canonicalData;
const legalSourceIds = new Set(sources.goldSources.map((entry) => entry.sourceId));
const legalRelics = new Set([
  ...modifiers.legalRelicIds,
  ...modifiers.presentationOnlyFixtureRelicIds
]);
const legalPacts = new Set(pactPolicy.pacts.map((entry) => entry.id));
const legalCampUpgrades = new Set(campPolicy.upgrades.map((entry) => entry.id));
const goldenIdolStackCap = modifiers.modifiers.find(
  (entry) => entry.id === "golden-idol"
)?.stackCap;
if (!Number.isSafeInteger(goldenIdolStackCap) || goldenIdolStackCap < 1) {
  throw new TypeError("GOLDEN_IDOL_STACK_CAP_INVALID");
}

export const GOLD_POLICY_SPEC = Object.freeze({
  moduleFile: "gold-policy.js",
  recommendedModel: "private-room-envelope-with-bounded-local-attestation",
  authority: Object.freeze({
    deterministicAwards: "SERVER_DERIVED",
    issuedLimitsAndSlots: "SERVER_ISSUED",
    combatAndChestResults: "BOUNDED_CLIENT_ATTESTED",
    hitCritAndTurnProcs: "HEURISTIC_ONLY"
  }),
  implementationStatus: "phase-3b2a-test-only"
});

function requireSafeAmount(value, code) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new TypeError(code);
  return amount;
}

function normalizeBuild(canonicalBuild = {}) {
  const relics = Array.isArray(canonicalBuild.relics)
    ? canonicalBuild.relics.map((entry) => {
        if (!entry || typeof entry !== "object") throw new TypeError("CANONICAL_BUILD_RELIC_ENTRY_INVALID");
        const relicId = String(entry.relicId || "");
        const stacks = Number(entry.stacks);
        if (!legalRelics.has(relicId)) throw new TypeError(`CANONICAL_BUILD_RELIC_UNKNOWN:${relicId}`);
        if (!Number.isSafeInteger(stacks) || stacks < 1) {
          throw new TypeError(`CANONICAL_BUILD_RELIC_STACKS_INVALID:${relicId}`);
        }
        return { relicId, stacks };
      })
    : [];
  const pacts = Array.isArray(canonicalBuild.pacts) ? [...canonicalBuild.pacts] : [];
  const campUpgrades = canonicalBuild.campUpgrades && typeof canonicalBuild.campUpgrades === "object"
    ? { ...canonicalBuild.campUpgrades }
    : {};
  for (const pactId of pacts) {
    if (!legalPacts.has(pactId)) throw new TypeError(`CANONICAL_BUILD_PACT_UNKNOWN:${pactId}`);
  }
  for (const [upgradeId, level] of Object.entries(campUpgrades)) {
    if (!legalCampUpgrades.has(upgradeId)) {
      throw new TypeError(`CANONICAL_BUILD_CAMP_UPGRADE_UNKNOWN:${upgradeId}`);
    }
    if (!Number.isSafeInteger(level) || level < 0) {
      throw new TypeError(`CANONICAL_BUILD_CAMP_UPGRADE_INVALID:${upgradeId}`);
    }
  }
  return { relics, pacts: [...new Set(pacts)], campUpgrades };
}

function level(build, id, cap) {
  return Math.min(cap, Math.max(0, Number(build.campUpgrades[id]) || 0));
}

function globalMultiplier(build, runModifierEffects) {
  const idolCount = Math.min(
    goldenIdolStackCap,
    build.relics.find((entry) => entry.relicId === "idol")?.stacks || 0
  );
  return 1 +
    idolCount * 0.15 +
    runModifierEffects.goldMultiplierAdditive;
}

export function resolveGoldModifierV08({
  canonicalBuild,
  canonicalRunModifiers,
  sourceId,
  baseAmount,
  context = {}
}) {
  if (!legalSourceIds.has(sourceId)) throw new TypeError(`GOLD_SOURCE_UNKNOWN:${sourceId}`);
  const build = normalizeBuild(canonicalBuild);
  const runModifierEffects = deriveRunModifierEffects(
    canonicalRunModifiers ?? createEmptyRunModifierLedgerV08()
  );
  const raw = requireSafeAmount(baseAmount, "GOLD_BASE_AMOUNT_INVALID");
  const applyMultiplier = context.applyMultiplier !== false;
  const multiplier = applyMultiplier
    ? globalMultiplier(build, runModifierEffects) * (build.pacts.includes("avarice") ? 1.4 : 1)
    : 1;
  return {
    amount: raw <= 0 ? 0 : Math.max(1, Math.round(raw * multiplier)),
    baseAmount: raw,
    multiplier,
    canonicalBuild: build,
    runModifierEffects
  };
}

export function calculateMultipliedGoldV08(input) {
  return resolveGoldModifierV08(input).amount;
}

export function calculateEnemyGoldV08({
  canonicalBuild,
  canonicalRunModifiers,
  enemyType,
  elite = false,
  rewardBonus = 0
}) {
  const base = rewardBounds.enemyClaims.baseGoldByEnemyType[enemyType];
  if (!Number.isSafeInteger(base)) throw new TypeError(`ENEMY_GOLD_TYPE_UNKNOWN:${enemyType}`);
  const build = normalizeBuild(canonicalBuild);
  const runModifierEffects = deriveRunModifierEffects(
    canonicalRunModifiers ?? createEmptyRunModifierLedgerV08()
  );
  const bonus = requireSafeAmount(rewardBonus, "ENEMY_REWARD_BONUS_INVALID");
  const bountyLevel = level(build, "bounty_contract", 5);
  const eliteMultiplier = elite ? runModifierEffects.eliteGoldMultiplier : 1;
  const preGrant = Math.max(
    1,
    Math.round((base + bonus) * (1 + bountyLevel * 0.1) * eliteMultiplier)
  );
  return resolveGoldModifierV08({
    canonicalBuild: build,
    canonicalRunModifiers,
    sourceId: elite ? "elite-kill" : "enemy-kill",
    baseAmount: preGrant
  }).amount;
}

export function calculateChestGoldV08({
  canonicalBuild,
  canonicalRunModifiers,
  baseAmount,
  applyTreasureSense = true
}) {
  const build = normalizeBuild(canonicalBuild);
  const raw = requireSafeAmount(baseAmount, "CHEST_GOLD_AMOUNT_INVALID");
  const treasureLevel = applyTreasureSense ? level(build, "treasure_sense", 5) : 0;
  const preGrant = Math.max(1, Math.round(raw * (1 + treasureLevel * 0.1)));
  return resolveGoldModifierV08({
    canonicalBuild: build,
    canonicalRunModifiers,
    sourceId: "chest-gold",
    baseAmount: preGrant
  }).amount;
}

export function assertGoldLedgerV08(state) {
  if (!Number.isSafeInteger(state.gold) || state.gold < 0) throw new TypeError("GOLD_INVALID");
  const campGold = state.campGold ?? 0;
  if (!Number.isSafeInteger(campGold) || campGold < 0) throw new TypeError("CAMP_GOLD_INVALID");
  const ledger = state.goldLedger;
  if (!ledger || typeof ledger !== "object") throw new TypeError("GOLD_LEDGER_INVALID");
  for (const field of [
    "earnedServerDerived",
    "earnedBoundedAttested",
    "spentServerDerived",
    "lastDelta",
    "roomClaimsAccepted",
    "roomClaimsRejected",
    "anomalyScore",
    "maximumClaimStreak"
  ]) {
    if (!Number.isSafeInteger(ledger[field]) || ledger[field] < 0) {
      throw new TypeError(`GOLD_LEDGER_INVALID:${field}`);
    }
  }
  for (const field of ["campEarnedServerDerived", "campSpentServerDerived"]) {
    const value = ledger[field] ?? 0;
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`GOLD_LEDGER_INVALID:${field}`);
    }
  }
  if (state.gold !== ledger.earnedServerDerived + ledger.earnedBoundedAttested - ledger.spentServerDerived) {
    throw new TypeError("GOLD_LEDGER_TOTAL_MISMATCH");
  }
  if (
    campGold !==
    (ledger.campEarnedServerDerived ?? 0) - (ledger.campSpentServerDerived ?? 0)
  ) {
    throw new TypeError("CAMP_GOLD_LEDGER_TOTAL_MISMATCH");
  }
  if (!Array.isArray(ledger.anomalyFlags) || ledger.anomalyFlags.length > rewardBounds.boundedHistoryLimit) {
    throw new TypeError("GOLD_LEDGER_ANOMALY_HISTORY_INVALID");
  }
  return state;
}

export function clearRunGoldWalletV08(state) {
  assertGoldLedgerV08(state);
  const goldLost = state.gold;
  const spentAfterLoss = state.goldLedger.spentServerDerived + goldLost;
  if (!Number.isSafeInteger(spentAfterLoss)) {
    throw new TypeError("GOLD_LEDGER_SPEND_OVERFLOW");
  }
  state.goldLedger.spentServerDerived = spentAfterLoss;
  state.goldLedger.lastDelta = 0;
  state.gold = 0;
  assertGoldLedgerV08(state);
  return goldLost;
}

export const V08_GOLD_POLICY_DATA = Object.freeze({ modifiers, sources, rewardBounds });
