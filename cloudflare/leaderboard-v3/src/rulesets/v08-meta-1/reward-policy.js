import arenaRelicOfferPolicyDocument from "./data/arena-relic-offer-policy.generated.json" with { type: "json" };
import chestBoundsDocument from "./data/chest-reward-bounds.generated.json" with { type: "json" };
import otterRelicOfferPolicyDocument from "./data/otter-relic-offer-policy.generated.json" with { type: "json" };
import progressionDocument from "./data/run-progression.generated.json" with { type: "json" };
import regularRelicOfferPolicyDocument from "./data/regular-relic-offer-policy.generated.json" with { type: "json" };
import rewardBoundsDocument from "./data/room-reward-bounds.generated.json" with { type: "json" };
import {
  calculateChestGoldV08,
  calculateEnemyGoldV08,
  calculateMultipliedGoldV08,
  resolveGoldModifierV08
} from "./gold-policy.js";
import { assertCanonicalRelicBuildDigestV08, computeRelicBuildDigestV08 } from "./relic-policy.js";
import { assertCanonicalRunModifierDigestV08 } from "./run-modifiers.js";
import { applyMutatorProgressDeltaV08 } from "./mutator-progression.js";
import {
  applyIssuedChestStatBonusV08,
  normalizeChestBonusesV08
} from "./chest-bonus-policy.js";
import { deriveIntInclusive } from "./rng.js";
import { RULESET_ID } from "./constants.js";

const arenaRelicOfferPolicy = arenaRelicOfferPolicyDocument.canonicalData;
const chestBounds = chestBoundsDocument.canonicalData;
const otterRelicOfferPolicy = otterRelicOfferPolicyDocument.canonicalData;
const regularRelicOfferPolicy = regularRelicOfferPolicyDocument.canonicalData;
const progression = progressionDocument.canonicalData;
const rewardBounds = rewardBoundsDocument.canonicalData;
const HISTORY_LIMIT = rewardBounds.boundedHistoryLimit;
const CANONICAL_CHEST_OUTCOME_CAPABILITY = "v1";
const CANONICAL_CHEST_OUTCOMES = new Set([
  "health",
  "healing",
  "attack",
  "armor",
  "potion",
  "map_fragment",
  "gold",
  "trap",
  "fallback_gold"
]);
const CHEST_THRESHOLDS = Object.freeze({
  treasure: Object.freeze([
    [0.12, "health"],
    [0.23, "healing"],
    [0.38, "attack"],
    [0.48, "armor"],
    [0.59, "potion"],
    [0.84, "map_fragment"],
    [0.97, "gold"]
  ]),
  standard: Object.freeze([
    [0.18, "health"],
    [0.38, "healing"],
    [0.62, "attack"],
    [0.78, "armor"],
    [0.90, "potion"],
    [0.94, "map_fragment"],
    [0.97, "gold"]
  ])
});
const CANONICAL_ORDINARY_CHEST_ROOMS = new Set([
  "combat",
  "boss",
  "final",
  "cursed",
  "duel",
  "horde",
  "treasure",
  "vault",
  "ambush",
  "shrine"
]);

export const REWARD_POLICY_SPEC = Object.freeze({
  moduleFile: "reward-policy.js",
  authority: "SERVER_ISSUED",
  claimPolicyVersion: rewardBounds.policyVersion,
  selectionBinding: "runId+rulesetHash+revision+roomDirectiveId+roomNonce+envelopeId",
  implementationStatus: "phase-3b2c3b-test-only",
  deferred: Object.freeze([
    "mutator-offers",
    "skill-offers",
    "elixir-offers",
    "merchant",
    "camp",
    "forge",
    "pact"
  ])
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.subtle) throw new TypeError("CRYPTO_PROVIDER_REQUIRED");
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : canonicalJson(value));
  const digest = await cryptoProvider.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function roomClearBase(depth, roomType) {
  if (roomType === "merchant" || roomType === "crossroads") return 0;
  let base = 2 + Math.floor(depth / 2);
  if (roomType === "treasure") base = Math.max(1, base - 1);
  else if (roomType === "vault") base = Math.max(1, base - 2);
  else if (roomType === "shrine") base += 1;
  else if (roomType === "cursed") base += 4;
  if (roomType === "boss" || roomType === "final") base += 10;
  return Math.max(1, base);
}

function rewardScalingDepth(directive) {
  if (directive?.roomCategory !== "special") return directive.depth;
  return Math.max(
    directive.depth,
    Number(directive.specialRoomPayload?.scalingDepth) || directive.depth
  );
}

function enemyMaximumForRoom(roomType) {
  return Math.max(0, Number(rewardBounds.enemyClaims.maximumEnemiesByRoom[roomType]) || 0);
}

function canonicalBuildHasRelic(build, relicId) {
  return Array.isArray(build?.relics) && build.relics.some(
    (entry) => entry?.relicId === relicId && Number(entry.stacks) >= 1
  );
}

function procClaimDefinitions(roomType, canonicalBuild, capabilities) {
  if (capabilities?.boundedProcClaims !== "v1") return [];
  const maximumEnemies = enemyMaximumForRoom(roomType);
  const definitions = [];
  if (canonicalBuildHasRelic(canonicalBuild, "voidreaper")) {
    definitions.push({
      claimType: "proc",
      claimId: "void-reaper-crit-kill",
      maximumCount: maximumEnemies,
      maximumAmount: null,
      unitPolicyRef: "void-reaper-crit-kill",
      requiredRoomType: roomType,
      requiredBuildEffect: "voidreaper",
      stackingPolicy: "bounded-by-accepted-enemy-and-elite-kills",
      duplicatePolicy: "REJECT"
    });
  }
  if (canonicalBuildHasRelic(canonicalBuild, "chaosorb")) {
    definitions.push({
      claimType: "proc",
      claimId: "chaos-orb-gold-roll",
      maximumCount: Math.ceil(rewardBounds.telemetryBounds.maximumTurnCount / 10),
      maximumAmount: null,
      unitPolicyRef: "chaos-orb-gold-roll",
      requiredRoomType: roomType,
      requiredBuildEffect: "chaosorb",
      stackingPolicy: "bounded-by-room-local-turn-count",
      duplicatePolicy: "REJECT"
    });
  }
  return definitions;
}

function claimDefinitions(roomType, canonicalBuild, capabilities) {
  const maximumEnemies = enemyMaximumForRoom(roomType);
  const potionUse = {
    claimType: "resource",
    claimId: "potion-use",
    maximumCount: 18,
    maximumAmount: null,
    unitPolicyRef: "local-potion-consumption",
    requiredRoomType: roomType,
    requiredBuildEffect: null,
    stackingPolicy: "bounded-by-canonical-potions",
    duplicatePolicy: "REJECT"
  };
  const shieldUse = {
    claimType: "resource",
    claimId: "shield-use",
    maximumCount: 18,
    maximumAmount: null,
    unitPolicyRef: "local-shield-consumption",
    requiredRoomType: roomType,
    requiredBuildEffect: null,
    stackingPolicy: "bounded-room-attestation",
    duplicatePolicy: "REJECT"
  };
  const elixirUse = {
    claimType: "resource",
    claimId: "elixir-use",
    maximumCount: 5,
    maximumAmount: null,
    unitPolicyRef: "local-elixir-consumption",
    requiredRoomType: roomType,
    requiredBuildEffect: null,
    stackingPolicy: "bounded-by-canonical-elixir-charges",
    duplicatePolicy: "REJECT"
  };
  if (maximumEnemies <= 0) {
    return [potionUse, elixirUse, shieldUse].concat(
      procClaimDefinitions(roomType, canonicalBuild, capabilities)
    );
  }
  const definitions = [];
  for (const enemyType of Object.keys(rewardBounds.enemyClaims.baseGoldByEnemyType).sort()) {
    const bossOnly = enemyType === "warden";
    if (bossOnly && !["boss", "final"].includes(roomType)) continue;
    definitions.push({
      claimType: "enemy",
      claimId: `enemy:${enemyType}`,
      maximumCount: maximumEnemies,
      maximumAmount: null,
      unitPolicyRef: `enemy-kill:${enemyType}`,
      requiredRoomType: roomType,
      requiredBuildEffect: null,
      stackingPolicy: "shares-room-enemy-budget",
      duplicatePolicy: "REJECT"
    });
    if (!bossOnly) {
      definitions.push({
        claimType: "elite",
        claimId: `elite:${enemyType}`,
        maximumCount: Math.min(maximumEnemies, rewardBounds.enemyClaims.maximumElitesPerRoom),
        maximumAmount: null,
        unitPolicyRef: `elite-kill:${enemyType}`,
        requiredRoomType: roomType,
        requiredBuildEffect: null,
        stackingPolicy: "shares-room-enemy-and-elite-budgets",
        duplicatePolicy: "REJECT"
      });
    }
  }
  definitions.push({
    claimType: "hazard",
    claimId: rewardBounds.hazardClaims.claimId,
    maximumCount: maximumEnemies,
    maximumAmount: null,
    unitPolicyRef: "spike-kill-fallback",
    requiredRoomType: roomType,
    requiredBuildEffect: null,
    stackingPolicy: "shares-room-enemy-budget",
    duplicatePolicy: "REJECT"
  });
  definitions.push(
    potionUse,
    elixirUse,
    shieldUse,
    ...procClaimDefinitions(roomType, canonicalBuild, capabilities)
  );
  return definitions;
}

function claimSlots(roomType) {
  const count = Math.max(0, Number(chestBounds.maximumChestSlotsByRoom[roomType]) || 0);
  return Array.from({ length: count }, (_, index) => ({
    slotId: `chest_${index + 1}`,
    slotType: roomType === "vault" ? "vault-chest" : "chest",
    allowedClaim: "chest-opened",
    consumed: false
  }));
}

function canonicalChestOutcomesEnabled(capabilities) {
  return capabilities?.canonicalChestOutcomes === CANONICAL_CHEST_OUTCOME_CAPABILITY;
}

function canonicalChestRoomEnabled(capabilities, roomType) {
  return canonicalChestOutcomesEnabled(capabilities) && CANONICAL_ORDINARY_CHEST_ROOMS.has(roomType);
}

function buildHasRelic(build, relicId) {
  return Array.isArray(build?.relics) && build.relics.some(
    (entry) => entry?.relicId === relicId && Number(entry.stacks) > 0
  );
}

function buildHasAvarice(build) {
  return Array.isArray(build?.pacts) && build.pacts.includes("avarice");
}

function mutatorHasAlchemist(runModifiers) {
  return Array.isArray(runModifiers?.active) && runModifiers.active.some(
    (entry) => entry?.modifierId === "alchemist" && Number(entry.stacks) > 0
  );
}

function canonicalChestOutcomeFromRoll(roomType, roll) {
  const thresholds = roomType === "treasure"
    ? CHEST_THRESHOLDS.treasure
    : CHEST_THRESHOLDS.standard;
  const normalizedRoll = Math.max(0, Math.min(999_999, Number(roll))) / 1_000_000;
  for (const [threshold, outcome] of thresholds) {
    if (normalizedRoll < threshold) return outcome;
  }
  return "trap";
}

async function issueCanonicalChestSlots({
  state,
  directive,
  slots,
  envelopeId,
  cryptoProvider,
  randomOracle,
  secret
}) {
  const normalizedBonuses = normalizeChestBonusesV08(state.campaign?.chestBonuses);
  const simulatedCampaign = { chestBonuses: normalizedBonuses };
  const hasShrineWard = buildHasRelic(state.build, "shrineward");
  const hasAlchemist = mutatorHasAlchemist(state.runModifiers);
  const hasAvarice = buildHasAvarice(state.build);
  const scalingDepth = rewardScalingDepth(directive);
  const oracle = randomOracle || { deriveIntInclusive };
  const issued = [];
  for (const [index, slot] of slots.entries()) {
    const roll = await oracle.deriveIntInclusive(0, 999_999, {
      secret,
      rulesetId: RULESET_ID,
      runId: state.runId,
      revision: state.revision,
      purpose: "reward/chest-outcome",
      counter: index,
      cryptoProvider
    });
    let outcome = canonicalChestOutcomeFromRoll(directive.roomType, roll);
    if (outcome === "trap" && hasShrineWard) outcome = "gold";
    if (hasAlchemist && (outcome === "health" || outcome === "healing")) {
      outcome = "fallback_gold";
    }
    if (hasAvarice && outcome === "potion") outcome = "fallback_gold";
    if (["health", "attack", "armor"].includes(outcome)) {
      const field = `${outcome}DepthBuckets`;
      const bucket = Math.floor(scalingDepth / 10);
      if ((simulatedCampaign.chestBonuses[field][String(bucket)] || 0) >= 5) {
        outcome = "fallback_gold";
      } else {
        simulatedCampaign.chestBonuses[field][String(bucket)] =
          (simulatedCampaign.chestBonuses[field][String(bucket)] || 0) + 1;
      }
    }
    const awardId = `award_${await sha256({
      envelopeId,
      runId: state.runId,
      rulesetHash: state.rulesetHash,
      revision: state.revision,
      directiveId: directive.directiveId,
      slotId: slot.slotId,
      outcome
    }, cryptoProvider)}`;
    issued.push({
      ...slot,
      canonicalOutcome: { awardId, outcome }
    });
  }
  return issued;
}

function repairLegacyWardenClaimEnvelope(state, envelope) {
  if (!["boss", "final"].includes(envelope.roomType)) return;
  if (envelope.boundedClaims.some((claim) => claim.claimId === "enemy:warden")) return;
  const wardenClaim = claimDefinitions(envelope.roomType).find(
    (claim) => claim.claimId === "enemy:warden"
  );
  if (!wardenClaim) throw new TypeError("WARDEN_REWARD_CLAIM_REQUIRED");
  envelope.boundedClaims.push(wardenClaim);
  envelope.maximumGoldDelta = Math.max(
    envelope.maximumGoldDelta,
    maximumGoldDeltaForEnvelope(
      state.build,
      state.runModifiers,
      envelope.depth,
      envelope.roomType,
      envelope.boundedClaims,
      envelope.claimSlots
    )
  );
}

function relicOfferSlots(directive, envelopeId) {
  let sourcePolicy = null;
  let offerPolicyRef = null;
  if (
    directive.roomCategory === "boss" &&
    directive.depth >= regularRelicOfferPolicy.minimumDepth &&
    directive.depth <= regularRelicOfferPolicy.maximumDepth &&
    directive.depth % regularRelicOfferPolicy.bossInterval === 0
  ) {
    sourcePolicy = regularRelicOfferPolicy;
    offerPolicyRef = "regular-relic-offer-policy.generated.json";
  } else if (
    directive.roomCategory === "special" &&
    directive.roomType === otterRelicOfferPolicy.roomType &&
    directive.depth >= otterRelicOfferPolicy.minimumDepth &&
    directive.depth <= otterRelicOfferPolicy.maximumDepth &&
    directive.depth % otterRelicOfferPolicy.excludedBossInterval !== 0
  ) {
    sourcePolicy = otterRelicOfferPolicy;
    offerPolicyRef = "otter-relic-offer-policy.generated.json";
  } else if (
    directive.roomCategory === arenaRelicOfferPolicy.roomCategory &&
    directive.roomType === arenaRelicOfferPolicy.roomType &&
    directive.depth >= arenaRelicOfferPolicy.minimumDepth &&
    directive.depth <= arenaRelicOfferPolicy.maximumDepth &&
    directive.depth % arenaRelicOfferPolicy.excludedBossInterval !== 0
  ) {
    sourcePolicy = arenaRelicOfferPolicy;
    offerPolicyRef = "arena-relic-offer-policy.generated.json";
  }
  if (!sourcePolicy) return [];
  return [{
    slotId: `relic_slot_${envelopeId.slice(-16)}`,
    slotType: sourcePolicy.rewardSlotType,
    sourceType: sourcePolicy.sourceType,
    sourceId: sourcePolicy.implementedSourceId || sourcePolicy.sourceId,
    offerPolicyRef,
    availabilityMode: "pre_offer",
    canonicalStoredChoiceIds: null,
    consumed: false,
    offerId: null,
    resolution: null
  }];
}

function maximumGoldDeltaForEnvelope(build, runModifiers, depth, roomType, claims, slots) {
  const fixed = calculateMultipliedGoldV08({
    canonicalBuild: build,
    canonicalRunModifiers: runModifiers,
    sourceId: "room-clear",
    baseAmount: roomClearBase(depth, roomType)
  });
  let enemyMaximum = 0;
  let procMaximum = 0;
  for (const claim of claims) {
    if (claim.claimType === "proc") {
      const sourceId = claim.claimId === "void-reaper-crit-kill"
        ? "void-reaper-crit-kill"
        : claim.claimId === "chaos-orb-gold-roll"
          ? "chaos-orb-gold-roll"
          : null;
      if (sourceId) {
        procMaximum += calculateMultipliedGoldV08({
          canonicalBuild: build,
          canonicalRunModifiers: runModifiers,
          sourceId,
          baseAmount: sourceId === "void-reaper-crit-kill" ? 10 : 20,
          ...(sourceId === "chaos-orb-gold-roll"
            ? { context: { applyMultiplier: false } }
            : {})
        }) * claim.maximumCount;
      }
      continue;
    }
    if (!claim.claimId.startsWith("enemy:") && !claim.claimId.startsWith("elite:")) continue;
    const [kind, enemyType] = claim.claimId.split(":");
    enemyMaximum = Math.max(
      enemyMaximum,
      calculateEnemyGoldV08({
        canonicalBuild: build,
        canonicalRunModifiers: runModifiers,
        enemyType,
        elite: kind === "elite",
        rewardBonus: rewardBounds.enemyClaims.rewardBonusByRoom[roomType] || 0
      }) * claim.maximumCount
    );
  }
  const chestMaximum = slots.reduce((sum, slot) => {
    const base = roomType === "treasure"
      ? chestBounds.standardGoldBase.maximum * chestBounds.treasureMultiplier
      : chestBounds.standardGoldBase.maximum;
    return sum + calculateChestGoldV08({
      canonicalBuild: build,
      canonicalRunModifiers: runModifiers,
      baseAmount: base,
      applyTreasureSense: true
    }) + (slot.slotType === "vault-chest"
      ? calculateMultipliedGoldV08({
          canonicalBuild: build,
          canonicalRunModifiers: runModifiers,
          sourceId: "vault-chest-bonus",
          baseAmount: chestBounds.vaultBonusBase
        })
      : 0);
  }, 0);
  return Math.min(
    rewardBounds.maximumGoldDeltaHardCap,
    fixed + enemyMaximum + procMaximum + chestMaximum
  );
}

export async function createRoomRewardEnvelopeV3({
  state,
  directive,
  envelopeId,
  cryptoProvider,
  capabilities,
  randomOracle,
  secret
}) {
  await assertCanonicalRunModifierDigestV08(state.runModifiers, cryptoProvider);
  const scalingDepth = rewardScalingDepth(directive);
  const buildModifier = resolveGoldModifierV08({
    canonicalBuild: state.build,
    canonicalRunModifiers: state.runModifiers,
    sourceId: "room-clear",
    baseAmount: roomClearBase(scalingDepth, directive.roomType),
    context: { roomType: directive.roomType }
  });
  const boundedClaims = claimDefinitions(directive.roomType, state.build, capabilities);
  const slots = claimSlots(directive.roomType);
  const issuedSlots = canonicalChestRoomEnabled(capabilities, directive.roomType)
    ? await issueCanonicalChestSlots({
        state,
        directive,
        slots,
        envelopeId,
        cryptoProvider,
        randomOracle,
        secret
      })
    : slots;
  const rewardSlots = relicOfferSlots(directive, envelopeId);
  const canonicalChestOutcomesVersion = canonicalChestOutcomesEnabled(capabilities)
    ? CANONICAL_CHEST_OUTCOME_CAPABILITY
    : undefined;
  const envelope = {
    envelopeId,
    runId: state.runId,
    rulesetHash: state.rulesetHash,
    directiveId: directive.directiveId,
    revision: state.revision,
    roomIndex: directive.roomIndex,
    depth: directive.depth,
    scalingDepth,
    roomType: directive.roomType,
    claimPolicyVersion: rewardBounds.policyVersion,
    ...(canonicalChestOutcomesVersion ? { canonicalChestOutcomesVersion } : {}),
    fixedAwards: [{
      awardId: "room-clear",
      sourceId: "room-clear",
      baseAmount: roomClearBase(scalingDepth, directive.roomType),
      amount: buildModifier.amount
    }],
    boundedClaims,
    claimSlots: issuedSlots,
    rewardSlots,
    maximumGoldDelta: maximumGoldDeltaForEnvelope(
      state.build,
      state.runModifiers,
      scalingDepth,
      directive.roomType,
      boundedClaims,
      slots
    ),
    consumed: false,
    issuedStateDigest: await sha256({
      runId: state.runId,
      rulesetHash: state.rulesetHash,
      revision: state.revision,
      roomIndex: directive.roomIndex,
      depth: directive.depth,
      scalingDepth,
      roomType: directive.roomType,
      gold: state.gold,
      build: state.build,
      runModifiers: state.runModifiers,
      chestBonuses: normalizeChestBonusesV08(state.campaign?.chestBonuses),
      canonicalChestOutcomesVersion: canonicalChestOutcomesVersion || null,
      canonicalChestOutcomes: canonicalChestRoomEnabled(capabilities, directive.roomType)
        ? issuedSlots.map((slot) => ({
            slotId: slot.slotId,
            canonicalOutcome: slot.canonicalOutcome
          }))
        : null
    }, cryptoProvider)
  };
  assertRoomRewardEnvelopeV3(envelope, capabilities);
  return envelope;
}

function assertCanonicalOutcome(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("REWARD_CHEST_OUTCOME_INVALID");
  }
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(["awardId", "outcome"])) {
    throw new TypeError("REWARD_CHEST_OUTCOME_SCHEMA_INVALID");
  }
  if (typeof value.awardId !== "string" || !value.awardId.trim()) {
    throw new TypeError("REWARD_CHEST_AWARD_ID_INVALID");
  }
  if (!CANONICAL_CHEST_OUTCOMES.has(value.outcome)) {
    throw new TypeError("REWARD_CHEST_OUTCOME_INVALID");
  }
}

function assertCanonicalChestClaimEvidence(claim, outcome) {
  const evidence = claim.localEvidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new TypeError("REWARD_CLAIM_CHEST_EVIDENCE_SCHEMA_INVALID");
  }
  const expectedKeys = ["outcome", "awardId"];
  if (["potion", "map_fragment"].includes(outcome)) expectedKeys.push("count");
  if (["gold", "fallback_gold"].includes(outcome)) expectedKeys.push("baseAmount");
  if (JSON.stringify(Object.keys(evidence).sort()) !== JSON.stringify(expectedKeys.sort())) {
    throw new TypeError("REWARD_CLAIM_CHEST_EVIDENCE_SCHEMA_INVALID");
  }
  if (evidence.outcome !== outcome || typeof evidence.awardId !== "string" || !evidence.awardId.trim()) {
    throw new TypeError("REWARD_CLAIM_CHEST_EVIDENCE_SCHEMA_INVALID");
  }
  const allowedClaimKeys = ["claimType", "claimId", "count", "localEvidence"];
  if (Object.keys(claim).some((key) => !allowedClaimKeys.includes(key))) {
    throw new TypeError("REWARD_CLAIM_CHEST_EVIDENCE_SCHEMA_INVALID");
  }
}

function assertClaimSlots(claimSlots, capabilities, roomType) {
  const ids = new Set();
  for (const slot of claimSlots) {
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) {
      throw new TypeError("REWARD_CLAIM_SLOT_INVALID");
    }
    if (typeof slot.slotId !== "string" || !slot.slotId.trim()) {
      throw new TypeError("REWARD_CLAIM_SLOT_INVALID:slotId");
    }
    if (ids.has(slot.slotId)) throw new TypeError("REWARD_CLAIM_SLOT_DUPLICATE");
    ids.add(slot.slotId);
    if (!["chest", "vault-chest"].includes(slot.slotType)) {
      throw new TypeError("REWARD_CLAIM_SLOT_INVALID:slotType");
    }
    if (slot.allowedClaim !== "chest-opened") {
      throw new TypeError("REWARD_CLAIM_SLOT_INVALID:allowedClaim");
    }
    if (typeof slot.consumed !== "boolean") {
      throw new TypeError("REWARD_CLAIM_SLOT_INVALID:consumed");
    }
    if (canonicalChestRoomEnabled(capabilities, roomType)) assertCanonicalOutcome(slot.canonicalOutcome);
  }
}

export function assertRoomRewardEnvelopeV3(envelope, capabilities = {}) {
  if (!envelope || typeof envelope !== "object") throw new TypeError("REWARD_ENVELOPE_INVALID");
  for (const field of ["envelopeId", "runId", "rulesetHash", "directiveId", "roomType", "claimPolicyVersion", "issuedStateDigest"]) {
    if (typeof envelope[field] !== "string" || !envelope[field]) {
      throw new TypeError(`REWARD_ENVELOPE_INVALID:${field}`);
    }
  }
  for (const field of ["revision", "roomIndex", "depth", "scalingDepth", "maximumGoldDelta"]) {
    if (!Number.isSafeInteger(envelope[field]) || envelope[field] < 0) {
      throw new TypeError(`REWARD_ENVELOPE_INVALID:${field}`);
    }
  }
  if (envelope.scalingDepth < envelope.depth) {
    throw new TypeError("REWARD_ENVELOPE_INVALID:scalingDepth");
  }
  if (
    envelope.canonicalChestOutcomesVersion !== undefined &&
    envelope.canonicalChestOutcomesVersion !== CANONICAL_CHEST_OUTCOME_CAPABILITY
  ) {
    throw new TypeError("REWARD_ENVELOPE_INVALID:canonicalChestOutcomesVersion");
  }
  if (
    canonicalChestOutcomesEnabled(capabilities) &&
    envelope.canonicalChestOutcomesVersion !== CANONICAL_CHEST_OUTCOME_CAPABILITY
  ) {
    throw new TypeError("REWARD_ENVELOPE_INVALID:canonicalChestOutcomesVersion");
  }
  if (
    !Array.isArray(envelope.fixedAwards) ||
    !Array.isArray(envelope.boundedClaims) ||
    !Array.isArray(envelope.claimSlots) ||
    !Array.isArray(envelope.rewardSlots)
  ) {
    throw new TypeError("REWARD_ENVELOPE_INVALID:collections");
  }
  assertClaimSlots(envelope.claimSlots, capabilities, envelope.roomType);
  const rewardSlotIds = new Set();
  for (const slot of envelope.rewardSlots) {
    if (!slot || typeof slot !== "object") throw new TypeError("REWARD_SLOT_INVALID");
    for (const field of ["slotId", "slotType", "sourceType", "sourceId", "offerPolicyRef"]) {
      if (!String(slot[field] || "").trim()) throw new TypeError(`REWARD_SLOT_INVALID:${field}`);
    }
    if (rewardSlotIds.has(slot.slotId)) throw new TypeError("REWARD_SLOT_DUPLICATE");
    rewardSlotIds.add(slot.slotId);
    if (typeof slot.consumed !== "boolean") throw new TypeError("REWARD_SLOT_INVALID:consumed");
    if (slot.offerId !== null && !String(slot.offerId || "").trim()) {
      throw new TypeError("REWARD_SLOT_INVALID:offerId");
    }
    if (
      slot.resolution !== null &&
      ![
        "offer_issued",
        "no_drop",
        "selection_pending",
        "replacement_committed",
        "replacement_cancelled",
        "fallback_awarded",
        "no_reward"
      ].includes(slot.resolution)
    ) {
      throw new TypeError("REWARD_SLOT_INVALID:resolution");
    }
    if (
      !["pre_offer", "stored_reward", "future_arena_spec"].includes(slot.availabilityMode)
    ) {
      throw new TypeError("REWARD_SLOT_INVALID:availabilityMode");
    }
    if (
      slot.availabilityMode === "stored_reward" &&
      !Array.isArray(slot.canonicalStoredChoiceIds)
    ) {
      throw new TypeError("REWARD_SLOT_INVALID:canonicalStoredChoiceIds");
    }
  }
  if (typeof envelope.consumed !== "boolean") throw new TypeError("REWARD_ENVELOPE_INVALID:consumed");
  return envelope;
}

function requireInteger(value, code, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new TypeError(code);
  return value;
}

function requestDigestInput(request) {
  return {
    envelopeId: request.envelopeId,
    roomDirectiveId: request.roomDirectiveId,
    roomNonce: request.roomNonce,
    claims: request.claims,
    reportedGoldDelta: request.reportedGoldDelta,
    reportedGoldTotal: request.reportedGoldTotal,
    turnCount: request.turnCount,
    elapsedMs: request.elapsedMs,
    commandJournalDigest: request.commandJournalDigest,
    compactRoomProof: request.compactRoomProof
  };
}

function issuedStateDigestInput(state, envelope, capabilities = {}) {
  return {
    runId: state.runId,
    rulesetHash: state.rulesetHash,
    revision: envelope.revision,
    roomIndex: envelope.roomIndex,
    depth: envelope.depth,
    scalingDepth: envelope.scalingDepth,
    roomType: envelope.roomType,
    gold: state.gold,
    build: state.build,
    runModifiers: state.runModifiers,
    chestBonuses: normalizeChestBonusesV08(state.campaign?.chestBonuses),
    canonicalChestOutcomesVersion: canonicalChestOutcomesEnabled(capabilities)
      ? CANONICAL_CHEST_OUTCOME_CAPABILITY
      : null,
    canonicalChestOutcomes: canonicalChestRoomEnabled(capabilities, envelope.roomType)
      ? envelope.claimSlots.map((slot) => ({
          slotId: slot.slotId,
          canonicalOutcome: slot.canonicalOutcome
        }))
      : null
  };
}

async function assertIssuedStateDigest(state, envelope, capabilities, cryptoProvider) {
  const expected = await sha256(
    issuedStateDigestInput(state, envelope, capabilities),
    cryptoProvider
  );
  if (expected !== envelope.issuedStateDigest) {
    throw new TypeError("REWARD_ISSUED_STATE_DIGEST_MISMATCH");
  }
}

export async function refreshIssuedStateDigestV08(state, context = {}) {
  const envelope = state?.currentRewardEnvelope;
  if (!envelope || context.capabilities?.canonicalChestOutcomes !== CANONICAL_CHEST_OUTCOME_CAPABILITY) {
    return state;
  }
  envelope.issuedStateDigest = await sha256(
    issuedStateDigestInput(state, envelope, context.capabilities),
    context.cryptoProvider
  );
  return state;
}

async function assertIssuedChestOutcomes(state, envelope, capabilities, context = {}) {
  if (!canonicalChestRoomEnabled(capabilities, envelope.roomType)) return;
  const directive = state.currentRoomDirective;
  const slots = envelope.claimSlots.map(({ canonicalOutcome: _ignored, ...slot }) => slot);
  const expected = await issueCanonicalChestSlots({
    state,
    directive,
    slots,
    envelopeId: envelope.envelopeId,
    cryptoProvider: context.cryptoProvider,
    randomOracle: context.randomOracle,
    secret: context.secret
  });
  for (const [index, slot] of envelope.claimSlots.entries()) {
    if (
      slot.canonicalOutcome.awardId !== expected[index].canonicalOutcome.awardId ||
      slot.canonicalOutcome.outcome !== expected[index].canonicalOutcome.outcome
    ) {
      throw new TypeError("REWARD_CHEST_OUTCOME_ISSUANCE_MISMATCH");
    }
  }
}

function pushAnomaly(anomalies, code) {
  if (!anomalies.includes(code)) anomalies.push(code);
}

function validateBindings(state, envelope, request) {
  const directive = state.currentRoomDirective;
  if (request.envelopeId !== envelope.envelopeId) throw new TypeError("REWARD_ENVELOPE_ID_MISMATCH");
  if (envelope.runId !== state.runId) throw new TypeError("REWARD_ENVELOPE_RUN_MISMATCH");
  if (envelope.rulesetHash !== state.rulesetHash) throw new TypeError("RULESET_HASH_MISMATCH");
  if (envelope.revision !== state.revision) throw new TypeError("REWARD_ENVELOPE_REVISION_MISMATCH");
  if (!directive || envelope.directiveId !== directive.directiveId) {
    throw new TypeError("REWARD_ENVELOPE_DIRECTIVE_MISMATCH");
  }
  if (request.roomDirectiveId !== directive.directiveId) throw new TypeError("REWARD_CLAIM_DIRECTIVE_MISMATCH");
  if (request.roomNonce !== directive.roomNonce) throw new TypeError("REWARD_CLAIM_NONCE_MISMATCH");
  if (request.roomIndex !== undefined && request.roomIndex !== envelope.roomIndex) {
    throw new TypeError("REWARD_CLAIM_ROOM_INDEX_MISMATCH");
  }
  if (request.roomType !== undefined && request.roomType !== envelope.roomType) {
    throw new TypeError("REWARD_CLAIM_ROOM_TYPE_MISMATCH");
  }
}

function calculateClaimAmount(state, envelope, claim, slotById, capabilities = {}) {
  if (!claim || typeof claim !== "object") throw new TypeError("REWARD_CLAIM_INVALID");
  if (typeof claim.claimType !== "string") throw new TypeError("REWARD_CLAIM_TYPE_UNKNOWN");
  if (typeof claim.claimId !== "string") throw new TypeError("REWARD_CLAIM_ID_UNKNOWN");
  requireInteger(claim.count, "REWARD_CLAIM_COUNT_INVALID");
  if (claim.count <= 0) throw new TypeError("REWARD_CLAIM_COUNT_INVALID");

  if (claim.claimType === "chest") {
    const slot = slotById.get(claim.claimId);
    if (!slot) throw new TypeError("REWARD_CLAIM_ID_UNKNOWN");
    if (claim.count !== 1) throw new TypeError("REWARD_CLAIM_COUNT_LIMIT");
    if (slot.consumed) throw new TypeError("REWARD_CLAIM_SLOT_CONSUMED");
    const outcome = String(claim.localEvidence?.outcome || "");
    if (canonicalChestRoomEnabled(capabilities, envelope.roomType)) {
      assertCanonicalOutcome(slot.canonicalOutcome);
      assertCanonicalChestClaimEvidence(claim, slot.canonicalOutcome.outcome);
      const awardId = claim.localEvidence.awardId;
      if (outcome !== slot.canonicalOutcome.outcome) {
        throw new TypeError("REWARD_CLAIM_CHEST_OUTCOME_MISMATCH");
      }
      if (awardId !== slot.canonicalOutcome.awardId) {
        throw new TypeError("REWARD_CLAIM_CHEST_AWARD_ID_MISMATCH");
      }
      if (["health", "attack", "armor", "healing", "trap"].includes(outcome)) {
        slot.consumed = true;
        return {
          amount: 0,
          authority: "SERVER_ISSUED",
          chestStat: ["health", "attack", "armor"].includes(outcome) ? outcome : null
        };
      }
    }
    if (!["opened", "gold", "fallback_gold", "potion", "map_fragment"].includes(outcome)) throw new TypeError("REWARD_CLAIM_CHEST_OUTCOME_INVALID");
    let amount = 0;
    if (outcome === "gold") {
      const baseAmount = requireInteger(
        claim.localEvidence?.baseAmount,
        "REWARD_CLAIM_CHEST_AMOUNT_INVALID"
      );
      const maximum = envelope.roomType === "treasure"
        ? chestBounds.standardGoldBase.maximum * chestBounds.treasureMultiplier
        : chestBounds.standardGoldBase.maximum;
      const minimum = envelope.roomType === "treasure"
        ? chestBounds.standardGoldBase.minimum * chestBounds.treasureMultiplier
        : chestBounds.standardGoldBase.minimum;
      if (baseAmount < minimum || baseAmount > maximum) {
        throw new TypeError("REWARD_CLAIM_CHEST_AMOUNT_LIMIT");
      }
      amount += calculateChestGoldV08({
        canonicalBuild: state.build,
        canonicalRunModifiers: state.runModifiers,
        baseAmount,
        applyTreasureSense: true
      });
    }
    else if (outcome === "fallback_gold") {
      const baseAmount = requireInteger(claim.localEvidence?.baseAmount, "REWARD_CLAIM_CHEST_AMOUNT_INVALID");
      if (baseAmount < 2 || baseAmount > 5) throw new TypeError("REWARD_CLAIM_CHEST_AMOUNT_LIMIT");
      amount += calculateMultipliedGoldV08({
        canonicalBuild: state.build,
        canonicalRunModifiers: state.runModifiers,
        sourceId: "chest-stat-cap-fallback",
        baseAmount
      });
    } else if (outcome === "potion") {
      const count = requireInteger(claim.localEvidence?.count, "REWARD_CLAIM_CHEST_RESOURCE_INVALID");
      if (count !== 1) throw new TypeError("REWARD_CLAIM_CHEST_RESOURCE_LIMIT");
      const resources = state.build.resources;
      resources.potions = Math.min(resources.maxPotions, resources.potions + 1);
    } else if (outcome === "map_fragment") {
      const count = requireInteger(claim.localEvidence?.count, "REWARD_CLAIM_CHEST_RESOURCE_INVALID");
      if (count !== 1) throw new TypeError("REWARD_CLAIM_CHEST_RESOURCE_LIMIT");
      state.campaign.treasureMapFragments += 1;
      if (state.campaign.treasureMapFragments >= 10) {
        state.campaign.treasureMapFragments -= 10;
        state.campaign.forcedNextRoomType = "vault";
      }
    }
    if (slot.slotType === "vault-chest") {
      amount += calculateMultipliedGoldV08({
        canonicalBuild: state.build,
        canonicalRunModifiers: state.runModifiers,
        sourceId: "vault-chest-bonus",
        baseAmount: chestBounds.vaultBonusBase
      });
    }
    slot.consumed = true;
    return { amount, authority: "BOUNDED_CLIENT_ATTESTED" };
  }

  const definition = envelope.boundedClaims.find(
    (entry) => entry.claimType === claim.claimType && entry.claimId === claim.claimId
  );
  if (!definition) {
    if (claim.claimType === "proc") throw new TypeError("REWARD_CLAIM_ID_UNKNOWN");
    const typeKnown = envelope.boundedClaims.some((entry) => entry.claimType === claim.claimType);
    throw new TypeError(typeKnown ? "REWARD_CLAIM_ID_UNKNOWN" : "REWARD_CLAIM_TYPE_UNKNOWN");
  }
  if (claim.count > definition.maximumCount) throw new TypeError("REWARD_CLAIM_COUNT_LIMIT");
  if (claim.claimType === "proc") {
    if (claim.claimId === "void-reaper-crit-kill") {
      const unit = calculateMultipliedGoldV08({
        canonicalBuild: state.build,
        canonicalRunModifiers: state.runModifiers,
        sourceId: "void-reaper-crit-kill",
        baseAmount: 10
      });
      return { amount: unit * claim.count, authority: "BOUNDED_CLIENT_ATTESTED" };
    }
    if (claim.claimId === "chaos-orb-gold-roll") {
      const unit = calculateMultipliedGoldV08({
        canonicalBuild: state.build,
        canonicalRunModifiers: state.runModifiers,
        sourceId: "chaos-orb-gold-roll",
        baseAmount: 20,
        context: { applyMultiplier: false }
      });
      return { amount: unit * claim.count, authority: "BOUNDED_CLIENT_ATTESTED" };
    }
    throw new TypeError("REWARD_CLAIM_ID_UNKNOWN");
  }
  if (claim.claimType === "resource") {
    if (claim.claimId === "shield-use") {
      return { amount: 0, authority: "BOUNDED_CLIENT_ATTESTED" };
    }
    if (claim.claimId === "elixir-use") {
      const elixirId = String(claim.localEvidence?.elixirId || "");
      const loadout = Array.isArray(state.build.elixirs) ? state.build.elixirs : [];
      if (!elixirId || loadout.length !== 1 || loadout[0]?.elixirId !== elixirId) {
        throw new TypeError("REWARD_CLAIM_ELIXIR_USE_INVALID");
      }
      const charges = loadout[0].charges;
      if (!Number.isSafeInteger(charges) || claim.count > charges) {
        throw new TypeError("REWARD_CLAIM_ELIXIR_USE_LIMIT");
      }
      loadout[0].charges = charges - claim.count;
      return { amount: 0, authority: "BOUNDED_CLIENT_ATTESTED" };
    }
    if (claim.claimId !== "potion-use") throw new TypeError("REWARD_CLAIM_ID_UNKNOWN");
    const potions = Math.max(0, Number(state.build.resources?.potions) || 0);
    if (claim.count > potions) throw new TypeError("REWARD_CLAIM_POTION_USE_LIMIT");
    state.build.resources.potions = potions - claim.count;
    return { amount: 0, authority: "BOUNDED_CLIENT_ATTESTED" };
  }

  if (claim.claimType === "hazard") {
    const unit = calculateMultipliedGoldV08({
      canonicalBuild: state.build,
      canonicalRunModifiers: state.runModifiers,
      sourceId: "spike-kill-fallback",
      baseAmount: 1
    });
    return {
      amount: unit * claim.count,
      authority: "BOUNDED_CLIENT_ATTESTED"
    };
  }
  const [kind, enemyType] = claim.claimId.split(":");
  const unit = calculateEnemyGoldV08({
    canonicalBuild: state.build,
    canonicalRunModifiers: state.runModifiers,
    enemyType,
    elite: kind === "elite",
    rewardBonus: rewardBounds.enemyClaims.rewardBonusByRoom[envelope.roomType] || 0
  });
  return { amount: unit * claim.count, authority: "BOUNDED_CLIENT_ATTESTED" };
}

async function settleRewardEnvelopeV3(state, request, context = {}, options = {}) {
  const outcome = options.outcome || "cleared";
  if (!["cleared", "emergency", "fatal"].includes(outcome)) {
    throw new TypeError("REWARD_SETTLEMENT_OUTCOME_INVALID");
  }
  await assertCanonicalRelicBuildDigestV08(state.build, context.cryptoProvider);
  await assertCanonicalRunModifierDigestV08(state.runModifiers, context.cryptoProvider);
  const envelope = assertRoomRewardEnvelopeV3(
    state.currentRewardEnvelope,
    context.capabilities
  );
  const digest = await sha256(requestDigestInput(request), context.cryptoProvider);
  const previous = (state.rewardSettlementHistory || []).find((entry) =>
    entry.envelopeId === request.envelopeId &&
    (entry.outcome || "cleared") === outcome &&
    (outcome !== "fatal" || entry.requestDigest === digest)
  );
  if (previous) {
    if (previous.requestDigest !== digest) throw new TypeError("REWARD_IDEMPOTENCY_PAYLOAD_MISMATCH");
    return {
      state: structuredClone(state),
      authoritativeGoldDelta: previous.authoritativeGoldDelta,
      anomalies: [...previous.anomalies],
      replayed: true
    };
  }
  if (envelope.consumed) throw new TypeError("REWARD_ENVELOPE_ALREADY_CONSUMED");
  validateBindings(state, envelope, request);
  if (canonicalChestOutcomesEnabled(context.capabilities)) {
    await assertIssuedStateDigest(
      state,
      envelope,
      context.capabilities,
      context.cryptoProvider
    );
    await assertIssuedChestOutcomes(
      state,
      envelope,
      context.capabilities,
      context
    );
  }
  if (!Array.isArray(request.claims)) throw new TypeError("REWARD_CLAIMS_REQUIRED");
  if (
    request.claims.some((claim) => claim?.claimType === "proc") &&
    context.capabilities?.boundedProcClaims !== "v1"
  ) {
    throw new TypeError("REWARD_CLAIM_TYPE_UNKNOWN");
  }

  const next = structuredClone(state);
  const mutableEnvelope = next.currentRewardEnvelope;
  repairLegacyWardenClaimEnvelope(next, mutableEnvelope);
  const slotById = new Map(mutableEnvelope.claimSlots.map((slot) => [slot.slotId, slot]));
  const seen = new Set();
  let enemyCount = 0;
  let eliteCount = 0;
  let validatedEnemyCount = 0;
  let validatedEliteCount = 0;
  let validatedEnemyKillCount = 0;
  let validatedEliteKillCount = 0;
  let voidReaperProcCount = 0;
  let chaosOrbProcCount = 0;
  let potionUseCount = 0;
  let shieldUseCount = 0;
  let boundedDelta = 0;
  const evidence = new Set();
  const validationState = outcome === "fatal" ? structuredClone(next) : null;
  const validationEnvelope = validationState?.currentRewardEnvelope || null;
  const validationSlots = validationEnvelope
    ? new Map(validationEnvelope.claimSlots.map((slot) => [slot.slotId, slot]))
    : null;
  for (const claim of request.claims) {
    const appliesToOutcome = outcome !== "fatal" || (
      claim?.claimType === "resource" ||
      (
        claim?.claimType === "chest" &&
        claim?.localEvidence?.outcome === "map_fragment"
      )
    );
    const key = `${claim?.claimType}:${claim?.claimId}`;
    if (seen.has(key)) throw new TypeError("REWARD_CLAIM_DUPLICATE");
    seen.add(key);
    if (claim.claimType === "enemy" || claim.claimType === "elite" || claim.claimType === "hazard") {
      validatedEnemyCount += requireInteger(claim.count, "REWARD_CLAIM_COUNT_INVALID");
    }
    if (claim.claimType === "elite") validatedEliteCount += claim.count;
    if (claim.claimType === "enemy") validatedEnemyKillCount += claim.count;
    if (claim.claimType === "elite") validatedEliteKillCount += claim.count;
    if (claim.claimType === "proc" && claim.claimId === "void-reaper-crit-kill") {
      voidReaperProcCount += requireInteger(claim.count, "REWARD_CLAIM_COUNT_INVALID");
    }
    if (claim.claimType === "proc" && claim.claimId === "chaos-orb-gold-roll") {
      chaosOrbProcCount += requireInteger(claim.count, "REWARD_CLAIM_COUNT_INVALID");
    }
    const result = calculateClaimAmount(
      appliesToOutcome ? next : validationState,
      appliesToOutcome ? mutableEnvelope : validationEnvelope,
      claim,
      appliesToOutcome ? slotById : validationSlots,
      context.capabilities
    );
    if (appliesToOutcome) {
      if (claim.claimType === "enemy" || claim.claimType === "elite" || claim.claimType === "hazard") {
        enemyCount += claim.count;
      }
      if (claim.claimType === "elite") eliteCount += claim.count;
      if (claim.claimType === "resource" && claim.claimId === "potion-use") potionUseCount += claim.count;
      if (claim.claimType === "resource" && claim.claimId === "shield-use") shieldUseCount += claim.count;
      if (
        result.chestStat &&
        canonicalChestRoomEnabled(context.capabilities, envelope.roomType) &&
        outcome === "cleared"
      ) {
        next.campaign = applyIssuedChestStatBonusV08(next.campaign, {
          stat: result.chestStat,
          scalingDepth: mutableEnvelope.scalingDepth
        });
      }
      boundedDelta += result.amount;
    }
    const evidenceId = typeof claim.localEvidence?.evidenceId === "string"
      ? claim.localEvidence.evidenceId
      : "";
    if (evidenceId) {
      if (evidence.has(evidenceId)) throw new TypeError("REWARD_CLAIM_DUPLICATE_EVIDENCE");
      evidence.add(evidenceId);
    }
  }
  if (validatedEnemyCount > enemyMaximumForRoom(envelope.roomType)) {
    throw new TypeError("REWARD_CLAIM_ROOM_ENEMY_BUDGET");
  }
  if (validatedEliteCount > rewardBounds.enemyClaims.maximumElitesPerRoom) {
    throw new TypeError("REWARD_CLAIM_ROOM_ELITE_BUDGET");
  }
  if (voidReaperProcCount > validatedEnemyKillCount + validatedEliteKillCount) {
    throw new TypeError("REWARD_PROC_VOID_REAPER_CAP");
  }
  if (
    chaosOrbProcCount > 0 &&
    chaosOrbProcCount > Math.ceil(requireInteger(request.turnCount, "REWARD_PROC_CHAOS_ORB_TURN_COUNT_INVALID") / 10)
  ) {
    throw new TypeError("REWARD_PROC_CHAOS_ORB_CAP");
  }

  const fixedDelta = outcome === "cleared"
    ? mutableEnvelope.fixedAwards.reduce(
      (sum, award) => sum + requireInteger(award.amount, "REWARD_FIXED_AWARD_INVALID"),
      0
    )
    : 0;
  const authoritativeGoldDelta = fixedDelta + boundedDelta;
  if (authoritativeGoldDelta > mutableEnvelope.maximumGoldDelta) {
    throw new TypeError("REWARD_ENVELOPE_MAXIMUM_EXCEEDED");
  }
  const expectedGold = next.gold + authoritativeGoldDelta;
  const anomalies = [];
  if (outcome !== "fatal" && Number(request.reportedGoldDelta) !== authoritativeGoldDelta) {
    pushAnomaly(anomalies, "REPORTED_GOLD_DELTA_MISMATCH");
  }
  if (outcome !== "fatal" && Number(request.reportedGoldTotal) !== expectedGold) {
    pushAnomaly(anomalies, "REPORTED_GOLD_TOTAL_MISMATCH");
  }
  if (!String(request.commandJournalDigest || "").trim()) {
    pushAnomaly(anomalies, "COMMAND_JOURNAL_DIGEST_MISSING");
  }
  const turnCount = Number(request.turnCount);
  if (
    !Number.isSafeInteger(turnCount) ||
    turnCount < rewardBounds.telemetryBounds.minimumTurnCount ||
    turnCount > rewardBounds.telemetryBounds.maximumTurnCount
  ) {
    pushAnomaly(anomalies, "TURN_COUNT_OUT_OF_BOUNDS");
  }
  const elapsedMs = Number(request.elapsedMs);
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < rewardBounds.telemetryBounds.minimumElapsedMs) {
    pushAnomaly(anomalies, "ELAPSED_MS_BELOW_MINIMUM");
  }
  if (!String(request.compactRoomProof || "").trim()) {
    pushAnomaly(anomalies, "COMPACT_ROOM_PROOF_MISSING");
  }
  if (
    outcome !== "fatal" &&
    mutableEnvelope.maximumGoldDelta > 0 &&
    authoritativeGoldDelta === mutableEnvelope.maximumGoldDelta
  ) {
    pushAnomaly(anomalies, "MAXIMUM_GOLD_DELTA_CLAIMED");
  }

  next.gold = Math.max(0, expectedGold);
  next.build.buildDigest = await computeRelicBuildDigestV08(next.build, context.cryptoProvider);
  const unlockIndex = outcome === "cleared"
    ? progression.startDepthUnlockBossDepths.indexOf(mutableEnvelope.depth)
    : -1;
  if (unlockIndex >= 0) {
    const unlockedDepth = progression.allowedStartDepths[unlockIndex + 1];
    if (unlockedDepth && !next.campaign.unlockedStartDepths.includes(unlockedDepth)) {
      next.campaign.unlockedStartDepths.push(unlockedDepth);
      next.campaign.unlockedStartDepths.sort((left, right) => left - right);
    }
  }
  next.mutatorRunTracking.potionUses += potionUseCount;
  next.mutatorProgress = applyMutatorProgressDeltaV08(next.mutatorProgress, {
    totalKills: next.mutatorProgress.totalKills + enemyCount,
    eliteKills: next.mutatorProgress.eliteKills + eliteCount,
    depthHighscore: outcome === "cleared"
      ? Math.max(next.mutatorProgress.depthHighscore, mutableEnvelope.depth)
      : next.mutatorProgress.depthHighscore,
    totalGoldEarned: next.mutatorProgress.totalGoldEarned + authoritativeGoldDelta,
    shieldUsesThisGame: next.mutatorProgress.shieldUsesThisGame + shieldUseCount
  });
  next.goldLedger.earnedServerDerived += fixedDelta;
  next.goldLedger.earnedBoundedAttested += boundedDelta;
  next.goldLedger.lastDelta = authoritativeGoldDelta;
  next.goldLedger.lastEnvelopeId = mutableEnvelope.envelopeId;
  next.goldLedger.roomClaimsAccepted += 1;
  next.goldLedger.maximumClaimStreak =
    mutableEnvelope.maximumGoldDelta > 0 &&
    authoritativeGoldDelta === mutableEnvelope.maximumGoldDelta
    ? Math.min(8, next.goldLedger.maximumClaimStreak + 1)
    : 0;
  if (next.goldLedger.maximumClaimStreak >= 3) {
    pushAnomaly(anomalies, "REPEATED_MAXIMUM_CLAIM");
  }
  next.goldLedger.anomalyScore = Math.min(100, next.goldLedger.anomalyScore + anomalies.length);
  next.goldLedger.anomalyFlags = [
    ...next.goldLedger.anomalyFlags,
    ...anomalies
  ].slice(-HISTORY_LIMIT);
  mutableEnvelope.consumed = outcome !== "fatal";
  const historyEntry = {
    envelopeId: mutableEnvelope.envelopeId,
    ...(outcome === "cleared" ? {} : { outcome }),
    requestDigest: digest,
    authoritativeGoldDelta,
    anomalies
  };
  next.rewardSettlementHistory = [
    ...(next.rewardSettlementHistory || []),
    historyEntry
  ].slice(-HISTORY_LIMIT);
  return {
    state: next,
    authoritativeGoldDelta,
    anomalies,
    replayed: false
  };
}

export async function settleRoomRewardEnvelopeV3(state, request, context = {}) {
  return settleRewardEnvelopeV3(state, request, context, { outcome: "cleared" });
}

export async function settleBoundaryRewardEnvelopeV3(
  state,
  request,
  options = {},
  context = {}
) {
  if (!["emergency", "fatal"].includes(options.outcome)) {
    throw new TypeError("REWARD_BOUNDARY_OUTCOME_INVALID");
  }
  return settleRewardEnvelopeV3(state, request, context, options);
}

export const V08_REWARD_POLICY_DATA = Object.freeze({
  chestBounds,
  rewardBounds
});
