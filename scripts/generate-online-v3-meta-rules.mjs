import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULESET_ROOT = path.join(
  REPO_ROOT,
  "cloudflare",
  "leaderboard-v3",
  "src",
  "rulesets",
  "v08-meta-1"
);
const DATA_ROOT = path.join(RULESET_ROOT, "data");
const CHECK_ONLY = process.argv.includes("--check");
const RULESET_ID = "v08-meta-1";
const RULESET_STATUS = "test-only";
const BASELINE_COMMIT = "f98820c99066d810169e100beb23a54a332734bd";

const SOURCE_INPUTS = Object.freeze([
  {
    file: "game.js",
    symbols: [
      "MAX_DEPTH",
      "MAX_RELICS",
      "STARTING_RELIC_IDS",
      "MYTHIC_RELIC_ID",
      "MYTHIC_RELIC_SLOT_BONUS",
      "MYTHIC_DOUBLE_LEGENDARY_ID",
      "MAX_NORMAL_RELIC_STACK",
      "START_DEPTH_CHECKPOINTS",
      "START_DEPTH_UNLOCK_BOSS_DEPTHS",
      "MAX_LIVES",
      "ROOM_TYPE_LABELS",
      "CAMPAIGN_REGIONS",
      "CAMPAIGN_REGION_CONFIGS",
      "chooseRoomType",
      "isBossDepth",
      "maybeQueueOtterRoom",
      "rollRelicRarity",
      "buildRelicDraftChoices",
      "buildOtterRoomRelicOfferIds",
      "spawnOtterRewardChest",
      "checkRoomClearBonus",
      "openChest",
      "openStoredRelicChest",
      "spawnArenaRewardChest",
      "openCrossroadsPowerChest",
      "generateMerchantSlots",
      "executeForgeTemper",
      "executeForgeTransmute"
    ]
  },
  {
    file: "room-pity.js",
    symbols: ["FORGE_PITY_DEPTH", "OTTER_PITY_DEPTH", "getGuaranteedCampaignRoom"]
  },
  {
    file: "expansion-content.js",
    symbols: ["ROOM_TYPES", "getRoomWeightMap"]
  },
  {
    file: "pact-room.js",
    symbols: ["PACT_ROOM_PROFILES", "getPactRoomProfile", "canOfferPactRoom"]
  },
  {
    file: "camp-data.js",
    symbols: ["treasure_sense", "bounty_contract", "CAMP_UPGRADES"]
  },
  {
    file: "elixir-data.js",
    symbols: [
      "ELIXIR_STACK_MAX",
      "ELIXIR_DURATION_TURNS",
      "ELIXIR_DISCARD_REFUND_RATIO",
      "ELIXIRS"
    ]
  },
  {
    file: "camp-runtime.js",
    symbols: [
      "state.player.gold",
      "Merchant buys",
      "spendMerchantUpgradeGold",
      "tryReserveRelicFromMerchant",
      "tryBuyReservedRelicFromMerchant",
      "tryUseBlackMarket"
    ]
  },
  {
    file: "loot-tables.js",
    symbols: ["CHEST_THRESHOLD_TREASURE", "CHEST_THRESHOLD_STANDARD", "rollChestOutcome"]
  },
  {
    file: "mutator-data.js",
    symbols: ["MUTATORS", "getMutatorUnlockStatus"]
  },
  {
    file: "relic-data.js",
    symbols: [
      "RELICS",
      "WARDEN_RELIC_DROP_TABLE",
      "WARDEN_RELIC_PITY_BONUS_PER_MISS",
      "WARDEN_RELIC_HARD_PITY_AFTER_MISSES",
      "Golden Idol",
      "Void Reaper",
      "Chaos Orb"
    ]
  },
  {
    file: "relic-runtime.js",
    symbols: [
      "getRelicStackCount",
      "isNormalRelicStackAtCap",
      "getRelicInventoryGroups",
      "getWardenRelicDropRoll",
      "shouldForceWardenFirstDrop"
    ]
  },
  {
    file: "merchant-curation.js",
    symbols: ["chooseMerchantRelicOffer"]
  },
  {
    file: "skills-data.js",
    symbols: ["MAX_SKILL_TIER", "MERCHANT_SKILL_UPGRADES"]
  },
  {
    file: "boss-campaign.js",
    symbols: ["BOSS_PROFILES"]
  },
  {
    file: "vault-room.js",
    symbols: ["VAULT_ENCOUNTER_PROFILE", "isVaultChestAvailable"]
  },
  {
    file: "forge-room.js",
    symbols: ["FORGE_PROFILES", "planForgeTemper", "planForgeTransmute"]
  }
]);

const GENERATED_FILES = Object.freeze([
  "source-manifest.generated.json",
  "run-progression.generated.json",
  "room-types.generated.json",
  "room-eligibility.generated.json",
  "special-room-policy.generated.json",
  "gold-sources.generated.json",
  "gold-modifiers.generated.json",
  "meta-transaction-policy.generated.json",
  "merchant-transaction-policy.generated.json",
  "forge-transaction-policy.generated.json",
  "crossroads-transaction-policy.generated.json",
  "camp-transaction-policy.generated.json",
  "pact-transaction-policy.generated.json",
  "run-modifier-catalog.generated.json",
  "run-modifier-effects.generated.json",
  "run-modifier-selection-policy.generated.json",
  "run-modifier-metadata.generated.json",
  "relic-catalog.generated.json",
  "relic-stack-policy.generated.json",
  "relic-slot-policy.generated.json",
  "starting-relic-policy.generated.json",
  "relic-build-metadata.generated.json",
  "relic-reward-sources.generated.json",
  "relic-rarity-policy.generated.json",
  "relic-pity-policy.generated.json",
  "regular-relic-offer-policy.generated.json",
  "otter-relic-offer-policy.generated.json",
  "arena-relic-offer-policy.generated.json",
  "special-relic-source-audit.generated.json",
  "deferred-special-relic-spec.generated.json",
  "vault-arena-relic-classification.generated.json",
  "relic-reward-fallback-policy.generated.json",
  "room-reward-bounds.generated.json",
  "chest-reward-bounds.generated.json"
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function requireMatch(text, pattern, label) {
  const match = pattern.exec(text);
  if (!match) throw new Error(`SOURCE_PARSE_FAILED:${label}`);
  return match;
}

function extractNumber(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return Number(requireMatch(
    text,
    new RegExp(`const\\s+${escaped}\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)\\s*;`, "u"),
    name
  )[1]);
}

function extractAssignmentNumber(text, expression) {
  const escaped = expression.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return Number(requireMatch(
    text,
    new RegExp(`${escaped}\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)\\s*;`, "u"),
    expression
  )[1]);
}

function extractNumericArray(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const body = requireMatch(
    text,
    new RegExp(`const\\s+${escaped}\\s*=\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)\\s*;`, "u"),
    name
  )[1];
  return Array.from(body.matchAll(/[0-9]+(?:\.[0-9]+)?/gu), (match) => Number(match[0]));
}

function extractBalancedBlock(text, marker, open = "{", close = "}") {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) throw new Error(`SOURCE_PARSE_FAILED:${marker}`);
  const start = text.indexOf(open, markerIndex + marker.length);
  if (start < 0) throw new Error(`SOURCE_PARSE_FAILED:${marker}:open`);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  throw new Error(`SOURCE_PARSE_FAILED:${marker}:close`);
}

function functionsContaining(text, needle) {
  const matches = [...text.matchAll(/function\s+([a-zA-Z0-9_]+)\s*\(/gu)];
  const names = [];
  for (const [index, match] of matches.entries()) {
    const end = matches[index + 1]?.index ?? text.length;
    if (match[1] !== needle.slice(0, -1) && text.slice(match.index, end).includes(needle)) {
      names.push(match[1]);
    }
  }
  return names.sort((left, right) => left.localeCompare(right));
}

function extractFunctionSlice(text, functionName) {
  const matches = [...text.matchAll(/function\s+([a-zA-Z0-9_]+)\s*\(/gu)];
  const index = matches.findIndex((match) => match[1] === functionName);
  if (index < 0) throw new Error(`SOURCE_PARSE_FAILED:function ${functionName}`);
  return text.slice(matches[index].index, matches[index + 1]?.index ?? text.length);
}

function assertVaultArenaRelicClassification(textByFile) {
  const gameSource = textByFile.get("game.js");
  const lootSource = textByFile.get("loot-tables.js");
  const vaultSource = textByFile.get("vault-room.js");
  const expansionSource = textByFile.get("expansion-content.js");
  const metaStateSourcePath = path.join(RULESET_ROOT, "meta-state.js");

  const outcomeIds = new Set(["trap"]);
  for (const match of lootSource.matchAll(/outcome\s*=\s*"([^"]+)"/gu)) {
    outcomeIds.add(match[1]);
  }
  const expectedOutcomeIds = [
    "armor",
    "attack",
    "gold",
    "healing",
    "health",
    "map_fragment",
    "potion",
    "trap"
  ];
  const actualOutcomeIds = [...outcomeIds].sort((left, right) => left.localeCompare(right));
  if (canonicalJson(actualOutcomeIds) !== canonicalJson(expectedOutcomeIds)) {
    throw new Error(`VAULT_RELIC_SOURCE_REVIEW_REQUIRED:CHEST_OUTCOMES:${actualOutcomeIds.join(",")}`);
  }
  if (/\brelic\b/iu.test(lootSource) || /\brelic\b/iu.test(vaultSource)) {
    throw new Error("VAULT_RELIC_SOURCE_REVIEW_REQUIRED:VAULT_OR_LOOT_MODULE_RELIC_REFERENCE");
  }

  const relicDraftBuilders = functionsContaining(gameSource, "buildRelicDraftChoices(");
  const expectedRelicDraftBuilders = [
    "buildOtterRoomRelicOfferIds",
    "openCrossroadsPowerChest",
    "openRelicDraft",
    "spawnArenaRewardChest"
  ];
  if (canonicalJson(relicDraftBuilders) !== canonicalJson(expectedRelicDraftBuilders)) {
    throw new Error(
      `VAULT_RELIC_SOURCE_REVIEW_REQUIRED:RELIC_DRAFT_BUILDERS:${relicDraftBuilders.join(",")}`
    );
  }
  const storedRelicChestCallers = functionsContaining(gameSource, "openStoredRelicChest(");
  if (canonicalJson(storedRelicChestCallers) !== canonicalJson(["openChest"])) {
    throw new Error(
      `VAULT_RELIC_SOURCE_REVIEW_REQUIRED:STORED_RELIC_CHEST_CALLERS:${storedRelicChestCallers.join(",")}`
    );
  }
  const openChest = extractFunctionSlice(gameSource, "openChest");
  if (
    !openChest.includes('chest.type === "arena_reward"') ||
    !openChest.includes('chest.type === "otter_red"') ||
    !openChest.includes("lootTablesApi.rollChestOutcome") ||
    /chest\.type\s*===\s*"vault"/u.test(openChest)
  ) {
    throw new Error("VAULT_RELIC_SOURCE_REVIEW_REQUIRED:OPEN_CHEST_DISPATCH");
  }

  const arenaDefinition = extractBalancedBlock(expansionSource, "arena: Object.freeze");
  const arenaMinimumDepth = Number(requireMatch(
    arenaDefinition,
    /minDepth:\s*(\d+)/u,
    "arena:minDepth"
  )[1]);
  const arenaWaveCount = extractNumber(gameSource, "ARENA_WAVE_COUNT");
  const spawnArenaRewardChest = extractBalancedBlock(gameSource, "function spawnArenaRewardChest");
  const checkRoomClearBonus = extractBalancedBlock(gameSource, "function checkRoomClearBonus");
  const buildRelicDraftChoices = extractFunctionSlice(gameSource, "buildRelicDraftChoices");
  const chooseRelic = extractFunctionSlice(gameSource, "chooseRelic");
  if (
    arenaMinimumDepth !== 40 ||
    arenaWaveCount !== 2 ||
    !spawnArenaRewardChest.includes('new Set(["rare", "epic", "legendary", "mythic"])') ||
    !spawnArenaRewardChest.includes("3 + (state.runMods.extraRelicChoices || 0)") ||
    !spawnArenaRewardChest.includes('type: "arena_reward"') ||
    !checkRoomClearBonus.includes("spawnArenaRewardChest()")
  ) {
    throw new Error("ARENA_RELIC_SOURCE_REVIEW_REQUIRED:ACTIVE_REWARD_CONTRACT");
  }
  if (
    buildRelicDraftChoices.includes("canAcquireRelic") ||
    !chooseRelic.includes("relicSwapPending")
  ) {
    throw new Error("ARENA_RELIC_SOURCE_REVIEW_REQUIRED:REPLACEMENT_CONTRACT");
  }
  return {
    chestOutcomeIds: expectedOutcomeIds,
    relicDraftBuilders: expectedRelicDraftBuilders,
    arenaMinimumDepth,
    arenaWaveCount,
    canonicalMetaStateExtraRelicChoices: false,
    canonicalMetaStatePath: path.relative(REPO_ROOT, metaStateSourcePath).replaceAll("\\", "/")
  };
}

function parseNumericMap(body) {
  const result = {};
  for (const match of body.matchAll(/([a-zA-Z0-9_]+)\s*:\s*([0-9]+(?:\.[0-9]+)?)/gu)) {
    result[match[1]] = Number(match[2]);
  }
  return result;
}

function parseStringMap(body) {
  const result = {};
  for (const match of body.matchAll(/([a-zA-Z0-9_]+)\s*:\s*"([^"]+)"/gu)) {
    result[match[1]] = match[2];
  }
  return result;
}

function parseCampaignRegions(gameSource) {
  const block = extractBalancedBlock(gameSource, "const CAMPAIGN_REGIONS", "[", "]");
  const regions = [];
  const pattern = /\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*minDepth:\s*(\d+),\s*maxDepth:\s*(\d+)\s*\}/gu;
  for (const match of block.matchAll(pattern)) {
    regions.push({
      id: match[1],
      label: match[2],
      minDepth: Number(match[3]),
      maxDepth: Number(match[4])
    });
  }
  if (regions.length === 0) throw new Error("SOURCE_PARSE_FAILED:CAMPAIGN_REGIONS:entries");
  return regions;
}

function parseCampaignRegionConfigs(gameSource) {
  const block = extractBalancedBlock(gameSource, "const CAMPAIGN_REGION_CONFIGS");
  const configs = {};
  const pattern = /([a-zA-Z0-9_]+)\s*:\s*Object\.freeze\(\{\s*roomWeights:\s*Object\.freeze\(\{([^}]*)\}\),\s*vaultChance:\s*([0-9.]+)/gu;
  for (const match of block.matchAll(pattern)) {
    configs[match[1]] = {
      roomWeights: parseNumericMap(match[2]),
      vaultChance: Number(match[3])
    };
  }
  if (Object.keys(configs).length === 0) {
    throw new Error("SOURCE_PARSE_FAILED:CAMPAIGN_REGION_CONFIGS:entries");
  }
  return configs;
}

function parseExpansionRoomTypes(source) {
  const block = extractBalancedBlock(source, "const ROOM_TYPES");
  const roomTypes = [];
  const pattern = /([a-zA-Z0-9_]+)\s*:\s*Object\.freeze\(\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*minDepth:\s*(\d+),\s*regionWeights:\s*Object\.freeze\(\{([^}]*)\}\)/gu;
  for (const match of block.matchAll(pattern)) {
    roomTypes.push({
      key: match[1],
      id: match[2],
      label: match[3],
      category: match[4],
      minDepth: Number(match[5]),
      regionWeights: parseNumericMap(match[6])
    });
  }
  if (roomTypes.length === 0) throw new Error("SOURCE_PARSE_FAILED:ROOM_TYPES:entries");
  return roomTypes;
}

function parsePactProfiles(source) {
  const block = extractBalancedBlock(source, "const PACT_ROOM_PROFILES", "[", "]");
  const profiles = [];
  const pattern = /minDepth:\s*(\d+),\s*enabled:\s*(true|false),\s*weight:\s*([0-9.]+)/gu;
  for (const match of block.matchAll(pattern)) {
    profiles.push({
      minDepth: Number(match[1]),
      enabled: match[2] === "true",
      weight: Number(match[3])
    });
  }
  if (profiles.length === 0) throw new Error("SOURCE_PARSE_FAILED:PACT_ROOM_PROFILES:entries");
  return profiles;
}

function parseRelics(source) {
  const block = extractBalancedBlock(source, "const RELICS", "[", "]");
  const relics = [];
  const pattern = /\{\s*id:\s*"([^"]+)",\s*rarity:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*desc:\s*"([^"]*)"\s*\}/gu;
  for (const match of block.matchAll(pattern)) {
    relics.push({
      id: match[1],
      rarity: match[2],
      name: match[3],
      description: match[4]
    });
  }
  if (relics.length === 0) throw new Error("SOURCE_PARSE_FAILED:RELICS:entries");
  const ids = relics.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error("ACTIVE_RELIC_ID_DUPLICATE");
  return relics;
}

function extractStringArray(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const body = requireMatch(
    text,
    new RegExp(`const\\s+${escaped}\\s*=\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)\\s*;`, "u"),
    name
  )[1];
  return Array.from(body.matchAll(/"([^"]+)"/gu), (match) => match[1]);
}

function extractStringConstant(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return requireMatch(
    text,
    new RegExp(`const\\s+${escaped}\\s*=\\s*"([^"]+)"\\s*;`, "u"),
    name
  )[1];
}

function buildRelicCanonicalData(records, textByFile) {
  const gameSource = textByFile.get("game.js");
  const relicSource = textByFile.get("relic-data.js");
  const relicRuntimeSource = textByFile.get("relic-runtime.js");
  const relics = parseRelics(relicSource);
  const relicIds = relics.map((entry) => entry.id);
  const knownIds = new Set(relicIds);
  const startingRelicIds = extractStringArray(gameSource, "STARTING_RELIC_IDS");
  const maximumRelicSlots = extractNumber(gameSource, "MAX_RELICS");
  const maximumNormalRelicStack = extractNumber(gameSource, "MAX_NORMAL_RELIC_STACK");
  const slotBonusRelicId = extractStringConstant(gameSource, "MYTHIC_RELIC_ID");
  const slotBonus = extractNumber(gameSource, "MYTHIC_RELIC_SLOT_BONUS");
  const doubleLegendaryRelicId = extractStringConstant(gameSource, "MYTHIC_DOUBLE_LEGENDARY_ID");
  const nonStackableNormalIds = [
    "shrineward",
    "ironboots",
    "scoutlens",
    "fieldrations",
    "trapweave",
    "cachekey"
  ];
  const goldModifierByRelicId = {
    idol: "golden-idol",
    voidreaper: "void-reaper-crit-kill",
    chaosorb: "chaos-orb-gold-roll"
  };
  const acquisitionSourcesByRarity = {
    normal: ["starting_relic", "relic_draft", "boss_drop", "merchant", "forge", "otter"],
    rare: ["relic_draft", "boss_drop", "merchant", "forge", "otter"],
    epic: ["relic_draft", "boss_drop", "merchant", "forge", "otter"],
    legendary: ["relic_draft", "boss_drop", "merchant", "forge", "otter"],
    mythic: [
      "relic_draft",
      "boss_drop",
      "merchant",
      "forge",
      "otter",
      "mythic_replacement_roll"
    ]
  };

  for (const relicId of startingRelicIds) {
    if (!knownIds.has(relicId)) throw new Error(`STARTING_RELIC_ID_UNKNOWN:${relicId}`);
  }
  for (const relicId of [...nonStackableNormalIds, slotBonusRelicId, doubleLegendaryRelicId]) {
    if (!knownIds.has(relicId)) throw new Error(`ACTIVE_RELIC_ID_MISMATCH:${relicId}`);
  }
  for (const relicId of Object.keys(goldModifierByRelicId)) {
    if (!knownIds.has(relicId)) throw new Error(`GOLD_RELIC_MODIFIER_UNKNOWN:${relicId}`);
  }
  for (const match of gameSource.matchAll(/\b(?:hasRelic|getRelicById|applyRelic|removeRelic)\("([^"]+)"\)/gu)) {
    if (!knownIds.has(match[1])) throw new Error(`ACTIVE_RELIC_ID_MISMATCH:${match[1]}`);
  }
  for (const marker of ["getRelicStackCount", "isNormalRelicStackAtCap", "getRelicInventoryGroups"]) {
    if (!relicRuntimeSource.includes(marker)) throw new Error(`SOURCE_SYMBOL_MISSING:relic-runtime.js:${marker}`);
  }

  const catalog = relics.map((relic) => {
    const stackable = relic.rarity === "normal" && !nonStackableNormalIds.includes(relic.id);
    const mythicRules = relic.rarity === "mythic"
      ? {
          maximumOwnedMythics: 1,
          grantsRelicSlots: relic.id === slotBonusRelicId ? slotBonus : 0,
          legendarySlotLimit: relic.id === doubleLegendaryRelicId ? 2 : 1
        }
      : null;
    return {
      relicId: relic.id,
      displayName: relic.name,
      rarity: relic.rarity,
      startingEligible: startingRelicIds.includes(relic.id),
      stackable,
      maximumStacks: stackable ? maximumNormalRelicStack : 1,
      slotCost: 1,
      unique: !stackable,
      legendary: relic.rarity === "legendary",
      mythic: relic.rarity === "mythic",
      mythicRules,
      bonusRelicSlots: relic.id === slotBonusRelicId ? slotBonus : 0,
      mutuallyExclusiveWith: relic.rarity === "mythic"
        ? relics.filter((entry) => entry.rarity === "mythic" && entry.id !== relic.id).map((entry) => entry.id)
        : [],
      acquisitionSources: acquisitionSourcesByRarity[relic.rarity].filter(
        (source) => source !== "starting_relic" || startingRelicIds.includes(relic.id)
      ),
      depthRestrictions: [],
      bossRestrictions: [],
      goldModifierRef: goldModifierByRelicId[relic.id] || null,
      buildMetadataFields: [
        "relicId",
        "stacks",
        "acquiredRevision",
        "acquisitionSource",
        "sourceOfferId"
      ],
      legacySourceFiles: ["relic-data.js", "relic-runtime.js", "game.js"],
      legacySourceSymbols: [
        `RELICS:${relic.id}`,
        "isRelicStackable",
        "applyRelic"
      ],
      notes: relic.description
    };
  });

  const sources = sourceRefs(records, [
    "game.js",
    "relic-data.js",
    "relic-runtime.js",
    "loot-tables.js",
    "merchant-curation.js",
    "boss-campaign.js"
  ]);
  const common = { schemaVersion: 1, rulesetId: RULESET_ID, sourceCommit: BASELINE_COMMIT, sources };
  return new Map([
    ["relic-catalog.generated.json", {
      ...common,
      canonicalData: {
        inventoryCount: catalog.length,
        rarityCounts: Object.fromEntries(
          ["normal", "rare", "epic", "legendary", "mythic"].map((rarity) => [
            rarity,
            catalog.filter((entry) => entry.rarity === rarity).length
          ])
        ),
        relics: catalog
      }
    }],
    ["relic-stack-policy.generated.json", {
      ...common,
      canonicalData: {
        maximumNormalRelicStack,
        stackableRelicIds: catalog.filter((entry) => entry.stackable).map((entry) => entry.relicId),
        nonStackableRelicIds: catalog.filter((entry) => !entry.stackable).map((entry) => entry.relicId),
        stackUnitConsumesSlot: true
      }
    }],
    ["relic-slot-policy.generated.json", {
      ...common,
      canonicalData: {
        baseRelicSlots: maximumRelicSlots,
        slotCostPerStack: 1,
        slotBonusRelicId,
        slotBonus,
        maximumLegendaryRelics: 1,
        doubleLegendaryRelicId,
        maximumLegendaryRelicsWithBonus: 2,
        maximumMythicRelics: 1
      }
    }],
    ["starting-relic-policy.generated.json", {
      ...common,
      canonicalData: {
        offerType: "starting_relic",
        sourceType: "run_start",
        sourceId: "v08-fixed-starting-relics",
        choiceCount: startingRelicIds.length,
        choiceOrderPolicy: "legacy-fixed-order",
        startingRelicIds,
        selectionRequired: true,
        skipAllowed: false,
        nextStatus: "active"
      }
    }],
    ["relic-build-metadata.generated.json", {
      ...common,
      canonicalData: {
        buildFields: [
          "relics",
          "relicSlotBase",
          "relicSlotBonus",
          "relicSlotLimit",
          "relicSlotsUsed",
          "uniqueRelicCount",
          "totalRelicStacks",
          "buildDigest"
        ],
        relicEntryFields: [
          "relicId",
          "stacks",
          "acquiredRevision",
          "acquisitionSource",
          "sourceOfferId"
        ],
        digestPolicy: "sha256 canonical JSON excluding buildDigest",
        publicProjectionFields: [
          "relics",
          "relicSlotLimit",
          "relicSlotsUsed",
          "uniqueRelicCount",
          "totalRelicStacks",
          "buildDigest"
        ]
      }
    }]
  ]);
}

function parseWardenRelicDropTable(source) {
  const block = extractBalancedBlock(source, "const WARDEN_RELIC_DROP_TABLE", "[", "]");
  const entries = [];
  const pattern = /\{\s*minDepth:\s*(\d+),\s*dropChance:\s*([0-9.]+),\s*rarityWeights:\s*\{\s*normal:\s*([0-9.]+),\s*rare:\s*([0-9.]+),\s*epic:\s*([0-9.]+),\s*legendary:\s*([0-9.]+)\s*\}\s*\}/gu;
  for (const match of block.matchAll(pattern)) {
    entries.push({
      minDepth: Number(match[1]),
      dropChance: Number(match[2]),
      rarityWeights: {
        normal: Number(match[3]),
        rare: Number(match[4]),
        epic: Number(match[5]),
        legendary: Number(match[6])
      }
    });
  }
  if (entries.length !== 5) {
    throw new Error(`SOURCE_PARSE_FAILED:WARDEN_RELIC_DROP_TABLE:${entries.length}`);
  }
  return entries;
}

function buildRegularRelicOfferCanonicalData(records, textByFile) {
  const gameSource = textByFile.get("game.js");
  const relicDataSource = textByFile.get("relic-data.js");
  const vaultArenaGuard = assertVaultArenaRelicClassification(textByFile);
  const wardenDropTable = parseWardenRelicDropTable(relicDataSource);
  const pityBonusPerMiss = extractNumber(
    relicDataSource,
    "WARDEN_RELIC_PITY_BONUS_PER_MISS"
  );
  const hardPityAfterMisses = extractNumber(
    relicDataSource,
    "WARDEN_RELIC_HARD_PITY_AFTER_MISSES"
  );
  const mythicRelativeChance = extractNumber(
    gameSource,
    "MYTHIC_RELATIVE_TO_LEGENDARY_CHANCE"
  );
  const maximumDepth = extractNumber(gameSource, "MAX_DEPTH");
  const otterMinimumDepth = extractNumber(gameSource, "OTTER_ROOM_MIN_DEPTH");
  const otterMaximumPerRun = extractNumber(gameSource, "OTTER_ROOM_MAX_PER_RUN");
  const otterOfferChoiceCount = extractNumber(gameSource, "OTTER_ROOM_RELIC_CHOICES");
  const otterRoomChance = extractNumber(gameSource, "OTTER_ROOM_CHANCE");
  const otterRoomChanceUltra = extractNumber(gameSource, "OTTER_ROOM_CHANCE_ULTRA");
  const otterPityDepth = extractNumber(
    textByFile.get("room-pity.js"),
    "OTTER_PITY_DEPTH"
  );
  for (const marker of [
    "function buildOtterRoomRelicOfferIds",
    "function spawnOtterRewardChest",
    "chest.type === \"otter_red\"",
    "const fallbackGold = grantGold(50)",
    "const depthBonus = Math.floor(state.depth / 5)",
    "let legendaryChance = 0.02 + depthBonus * 0.008",
    "let epicChance = 0.06 + depthBonus * 0.012",
    "let rareChance = 0.17"
  ]) {
    if (!gameSource.includes(marker)) {
      throw new Error(`SOURCE_SYMBOL_MISSING:game.js:${marker}`);
    }
  }
  const sourceFiles = [
    "game.js",
    "relic-data.js",
    "relic-runtime.js",
    "loot-tables.js",
    "boss-campaign.js",
    "merchant-curation.js",
    "vault-room.js",
    "room-pity.js",
    "camp-runtime.js",
    "forge-room.js",
    "expansion-content.js",
    "pact-room.js"
  ];
  const sources = sourceRefs(records, sourceFiles);
  const common = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit: BASELINE_COMMIT,
    sources
  };
  const inventoryFields = [
    "sourceId",
    "legacySourceFile",
    "legacyFunctionOrSymbol",
    "sourceCategory",
    "roomTypes",
    "depthRange",
    "offerChoiceCount",
    "allowedRarities",
    "rarityWeights",
    "pityStateUsed",
    "specialRestrictions",
    "rewardSlotRequired",
    "implementedIn3B2B2A",
    "deferredReason"
  ];
  const sourceInventory = [
    {
      sourceId: "starting-fixed",
      legacySourceFile: "game.js",
      legacyFunctionOrSymbol: "openStartingRelicDraft",
      sourceCategory: "starting",
      roomTypes: [],
      depthRange: { minimum: 0, maximum: 0 },
      offerChoiceCount: 3,
      allowedRarities: ["normal"],
      rarityWeights: null,
      pityStateUsed: [],
      specialRestrictions: ["fixed fang/plating/lucky order", "mandatory selection"],
      rewardSlotRequired: false,
      implementedIn3B2B2A: false,
      deferredReason: "EXISTING_PHASE_3B2B1"
    },
    {
      sourceId: "standard-chest",
      legacySourceFile: "loot-tables.js",
      legacyFunctionOrSymbol: "rollChestOutcome/openChest",
      sourceCategory: "standard_chest",
      roomTypes: ["combat", "treasure", "shrine", "cursed", "boss"],
      depthRange: { minimum: 1, maximum: maximumDepth },
      offerChoiceCount: 0,
      allowedRarities: [],
      rarityWeights: null,
      pityStateUsed: [],
      specialRestrictions: ["health/healing/attack/armor/potion/map_fragment/gold/trap only"],
      rewardSlotRequired: false,
      implementedIn3B2B2A: false,
      deferredReason: "NO_RELIC_REWARD_IN_BASELINE"
    },
    {
      sourceId: "warden-standard-drop",
      legacySourceFile: "game.js",
      legacyFunctionOrSymbol: "checkRoomClearBonus/openRelicDraft(true)",
      sourceCategory: "standard_boss_reward",
      roomTypes: ["boss"],
      depthRange: { minimum: 5, maximum: maximumDepth - 5 },
      offerChoiceCount: 3,
      allowedRarities: ["normal", "rare", "epic", "legendary", "mythic"],
      rarityWeights: "depth-tiered WARDEN_RELIC_DROP_TABLE plus mythic relative roll",
      pityStateUsed: ["warden-run-drop-miss-streak"],
      specialRestrictions: ["boss depth", "final depth excluded", "profile-scoped first drop at each new boss depth is guaranteed"],
      rewardSlotRequired: true,
      implementedIn3B2B2A: true,
      deferredReason: null
    },
    {
      sourceId: "arena-reward-cache",
      legacySourceFile: "game.js",
      legacyFunctionOrSymbol: "spawnArenaRewardChest/openStoredRelicChest",
      sourceCategory: "special_room_reward",
      roomTypes: ["arena"],
      depthRange: { minimum: 1, maximum: maximumDepth },
      offerChoiceCount: 3,
      allowedRarities: ["rare", "epic", "legendary", "mythic"],
      rarityWeights: "non-boss depth formula",
      pityStateUsed: [],
      specialRestrictions: ["three-wave Arena", "60 gold empty replacement"],
      rewardSlotRequired: true,
      implementedIn3B2B2A: false,
      deferredReason: "SPECIAL_SOURCE_POLICY_PHASE_3B2B2B"
    },
    {
      sourceId: "crossroads-power",
      legacySourceFile: "game.js",
      legacyFunctionOrSymbol: "openCrossroadsPowerChest",
      sourceCategory: "special_room_reward",
      roomTypes: ["crossroads"],
      depthRange: { minimum: 1, maximum: maximumDepth },
      offerChoiceCount: 3,
      allowedRarities: ["epic", "legendary", "mythic"],
      rarityWeights: "non-boss depth formula",
      pityStateUsed: [],
      specialRestrictions: ["15 percent max HP cost", "80 gold empty replacement"],
      rewardSlotRequired: true,
      implementedIn3B2B2A: false,
      deferredReason: "CROSSROADS_SPECIFIC_POLICY_PHASE_3B2B2B"
    },
    {
      sourceId: "otter-crimson-chest",
      legacySourceFile: "game.js",
      legacyFunctionOrSymbol: "buildOtterRoomRelicOfferIds/spawnOtterRewardChest",
      sourceCategory: "special_room_reward",
      roomTypes: ["otter"],
      depthRange: { minimum: 1, maximum: maximumDepth },
      offerChoiceCount: 9,
      allowedRarities: ["rare", "epic", "legendary", "mythic"],
      rarityWeights: "non-boss depth formula",
      pityStateUsed: ["otter-room-pity"],
      specialRestrictions: ["Crimson chest", "50 gold empty replacement"],
      rewardSlotRequired: true,
      implementedIn3B2B2A: false,
      deferredReason: "OTTER_SPECIFIC_POLICY_PHASE_3B2B2B"
    },
    {
      sourceId: "forge-temper",
      legacySourceFile: "game.js",
      legacyFunctionOrSymbol: "executeForgeTemper",
      sourceCategory: "special_room_reward",
      roomTypes: ["forge"],
      depthRange: { minimum: 6, maximum: maximumDepth },
      offerChoiceCount: 1,
      allowedRarities: ["rare", "epic", "legendary", "mythic"],
      rarityWeights: "forge profile",
      pityStateUsed: ["forge-room-pity"],
      specialRestrictions: ["Blacksmith Guardian", "temper profile"],
      rewardSlotRequired: true,
      implementedIn3B2B2A: false,
      deferredReason: "FORGE_SPECIFIC_POLICY_PHASE_3B2B2B"
    },
    {
      sourceId: "forge-transmute",
      legacySourceFile: "game.js",
      legacyFunctionOrSymbol: "executeForgeTransmute",
      sourceCategory: "replacement_reward",
      roomTypes: ["forge"],
      depthRange: { minimum: 6, maximum: maximumDepth },
      offerChoiceCount: 3,
      allowedRarities: ["normal", "rare", "epic", "legendary", "mythic"],
      rarityWeights: "forge transmute profile",
      pityStateUsed: [],
      specialRestrictions: ["sacrifice required", "replacement transaction"],
      rewardSlotRequired: true,
      implementedIn3B2B2A: false,
      deferredReason: "REPLACEMENT_REWARD_PHASE_3B2B2B"
    },
    {
      sourceId: "merchant-relic-slot",
      legacySourceFile: "game.js",
      legacyFunctionOrSymbol: "generateMerchantSlots",
      sourceCategory: "merchant",
      roomTypes: ["merchant"],
      depthRange: { minimum: 3, maximum: maximumDepth },
      offerChoiceCount: 1,
      allowedRarities: ["normal", "rare", "epic", "legendary"],
      rarityWeights: { normal: 60, rare: 25, epic: 12, legendary: 3 },
      pityStateUsed: [],
      specialRestrictions: ["gold price", "reservation and swap flows"],
      rewardSlotRequired: false,
      implementedIn3B2B2A: false,
      deferredReason: "MERCHANT_POLICY_PHASE_3B2B2B"
    },
    {
      sourceId: "merchant-reserved-relic",
      legacySourceFile: "camp-runtime.js",
      legacyFunctionOrSymbol: "tryReserveRelicFromMerchant/tryBuyReservedRelicFromMerchant",
      sourceCategory: "merchant",
      roomTypes: ["merchant"],
      depthRange: { minimum: 3, maximum: maximumDepth },
      offerChoiceCount: 1,
      allowedRarities: ["normal", "rare", "epic", "legendary"],
      rarityWeights: "inherits merchant relic slot",
      pityStateUsed: [],
      specialRestrictions: ["persistent reservation", "deposit", "remaining price"],
      rewardSlotRequired: false,
      implementedIn3B2B2A: false,
      deferredReason: "MERCHANT_POLICY_PHASE_3B2B2B"
    },
    {
      sourceId: "merchant-black-market",
      legacySourceFile: "camp-runtime.js",
      legacyFunctionOrSymbol: "tryUseBlackMarket",
      sourceCategory: "replacement_reward",
      roomTypes: ["merchant"],
      depthRange: { minimum: 3, maximum: maximumDepth },
      offerChoiceCount: 1,
      allowedRarities: ["rare", "epic"],
      rarityWeights: "upgrade tier fixed by sacrificed rarity",
      pityStateUsed: [],
      specialRestrictions: ["sacrifice normal or rare relic", "replacement transaction"],
      rewardSlotRequired: false,
      implementedIn3B2B2A: false,
      deferredReason: "MERCHANT_REPLACEMENT_POLICY_PHASE_3B2B2B"
    },
    {
      sourceId: "vault-standard-chest",
      legacySourceFile: "vault-room.js",
      legacyFunctionOrSymbol: "isVaultChestAvailable/openChest",
      sourceCategory: "special_room_reward",
      roomTypes: ["vault"],
      depthRange: { minimum: 1, maximum: maximumDepth },
      offerChoiceCount: 0,
      allowedRarities: [],
      rarityWeights: null,
      pityStateUsed: [],
      specialRestrictions: ["Guardian lock", "standard chest outcome plus 50 gold"],
      rewardSlotRequired: false,
      implementedIn3B2B2A: false,
      deferredReason: "NO_RELIC_REWARD_IN_BASELINE;VAULT_POLICY_PHASE_3B2B2B"
    }
  ];
  for (const source of sourceInventory) {
    if (Object.keys(source).join(",") !== inventoryFields.join(",")) {
      throw new Error(`RELIC_REWARD_SOURCE_SCHEMA_MISMATCH:${source.sourceId}`);
    }
  }
  const rarityTiers = wardenDropTable.map((entry, index) => ({
    minDepth: entry.minDepth,
    maxDepth: index === 0 ? maximumDepth - 5 : wardenDropTable[index - 1].minDepth - 1,
    dropChance: entry.dropChance,
    rarityWeights: entry.rarityWeights,
    legendaryEligible: entry.rarityWeights.legendary > 0,
    mythicEligible: entry.rarityWeights.legendary > 0
  }));
  const publicChoiceFields = [
    "choiceId",
    "relicId",
    "rarity",
    "currentStacks",
    "resultingStacks",
    "slotCost",
    "resultingSlotsUsed",
    "resultingSlotLimit"
  ];
  const otterRarityPolicy = {
    formula: "non-boss depth formula from rollRelicRarity(false)",
    depthBonusDivisor: 5,
    legendaryBase: 0.02,
    legendaryPerDepthBonus: 0.008,
    epicBase: 0.06,
    epicPerDepthBonus: 0.012,
    rareChance: 0.17,
    mythicRelativeToLegendaryChance: mythicRelativeChance,
    mythicChanceMaximum: 0.02,
    rollOrder: ["mythic", "legendary", "epic", "rare", "normal"],
    normalRollFallback: "all otherwise legal rare+ Otter candidates"
  };
  const otterOfferPolicy = {
    offerType: "relic_reward",
    sourceType: "otter",
    sourceId: "otter-crimson-chest",
    roomType: "otter",
    rewardSlotType: "relic_offer",
    offerChoiceCount: otterOfferChoiceCount,
    minimumDepth: otterMinimumDepth,
    firstEffectiveNonBossDepth: otterMinimumDepth + 1,
    maximumDepth: maximumDepth - 1,
    excludedBossInterval: 5,
    maximumOccurrencesPerRun: otterMaximumPerRun,
    allowedRarities: ["rare", "epic", "legendary", "mythic"],
    candidateAcquisitionSource: "otter",
    rarityPolicy: otterRarityPolicy,
    pityPolicy: {
      rewardOfferPity: "NONE",
      roomScheduleRandomChance: otterRoomChance,
      roomScheduleUltraChance: otterRoomChanceUltra,
      roomSchedulePityDepth: otterPityDepth,
      roomSchedulePityScope: "GAME_SESSION_SCOPED",
      roomSchedulePityStatus: "DEFERRED_GAME_SESSION_SCOPED_PITY"
    },
    requestFields: ["rewardEnvelopeId", "rewardSlotId", "sourceDirectiveId"],
    selectionRequestFields: ["offerId", "choiceId"],
    rngPurposes: [
      "otter-relic-offer-rarity",
      "otter-relic-offer-candidate",
      "otter-relic-choice-order",
      "otter-relic-offer-id",
      "otter-relic-choice-id"
    ],
    selectionPolicy: "existing selectRegularRelic; choose one canonical choice",
    baselineSkipPolicy: "optional draft skip remains deferred with endpoint integration",
    emptyPoolBehavior: "NO_REWARD; canonical reward slot consumed once",
    fullPoolBehavior: "CANONICAL_REPLACEMENT_TRANSACTION",
    staleStoredOfferFallback: "canonical stored reward empty: 50 base gold; stale client/cache binding: REJECT with ONLINE_V3_SECURITY_DIVERGENCE",
    publicChoiceFields,
    publicPayloadTargetBytes: 4096
  };
  const arenaOfferPolicy = {
    offerType: "relic_reward",
    sourceType: "arena",
    sourceId: "arena-reward-cache",
    roomType: "arena",
    roomCategory: "special",
    rewardSlotType: "relic_offer",
    offerChoiceCount: 3,
    extraChoiceEffect: "extraRelicChoices",
    minimumDepth: vaultArenaGuard.arenaMinimumDepth,
    firstEffectiveNonBossDepth: vaultArenaGuard.arenaMinimumDepth + 1,
    maximumDepth: maximumDepth - 1,
    excludedBossInterval: 5,
    waveCount: vaultArenaGuard.arenaWaveCount,
    allowedRarities: ["rare", "epic", "legendary", "mythic"],
    candidateAcquisitionSource: "relic_draft",
    rarityPolicy: {
      ...otterRarityPolicy,
      normalRollFallback: "all otherwise legal rare+ Arena candidates"
    },
    pityPolicy: {
      rewardOfferPity: "NONE",
      roomSchedulePity: "NONE",
      scope: "RUN_SCOPED_NOT_APPLICABLE"
    },
    requestFields: ["rewardEnvelopeId", "rewardSlotId", "sourceDirectiveId"],
    selectionRequestFields: ["offerId", "choiceId"],
    rngPurposes: [
      "arena-relic-offer-rarity",
      "arena-relic-offer-candidate",
      "arena-relic-choice-order",
      "arena-relic-offer-id",
      "arena-relic-choice-id"
    ],
    selectionPolicy: "existing selectRegularRelic; choose one canonical choice",
    baselineSkipPolicy: "optional draft skip remains deferred with endpoint integration",
    emptyPoolBehavior: "NO_REWARD before stored reward creation",
    storedEmptyFallback: {
      fallbackPolicyId: "ARENA_STORED_CACHE_EMPTY_GOLD_V08",
      baseGold: 60,
      condition: "existing canonical stored Arena reward with zero canonical choices"
    },
    fullPoolBehavior: "CANONICAL_REPLACEMENT_TRANSACTION",
    staleStoredOfferFallback: "stale client/cache binding: REJECT with ONLINE_V3_SECURITY_DIVERGENCE",
    sourceEvidence: [
      "expansion-content.js:ROOM_TYPES.arena.minDepth=40",
      "game.js:ARENA_WAVE_COUNT=2 and checkRoomClearBonus",
      "game.js:spawnArenaRewardChest stores 3 + extraRelicChoices rare+ IDs",
      "game.js:buildRelicDraftChoices and rollRelicRarity(false)",
      "game.js:openStoredRelicChest grants 60 gold only for an empty stored cache",
      "game.js:chooseRelic enters the canonical replacement flow when acquisition cannot fit"
    ],
    implementationStatus: "phase-3b2c3b-disconnected-test-only",
    publicChoiceFields,
    publicPayloadTargetBytes: 2048
  };
  const specialAuditFields = [
    "sourceId",
    "sourceCategory",
    "legacySourceFiles",
    "legacyFunctionOrSymbol",
    "trigger",
    "roomType",
    "depthEligibility",
    "runLimit",
    "offerChoiceCount",
    "candidatePool",
    "rarityPolicy",
    "pityPolicy",
    "slotPolicy",
    "selectionPolicy",
    "emptyPoolBehavior",
    "replacementBehavior",
    "serverCanIssueExactly",
    "implementedInThisPhase",
    "deferredReason",
    "sourceEvidence"
  ];
  const specialSourceAudit = [
    {
      sourceId: "vault-standard-chest",
      sourceCategory: "not_active_relic_source",
      legacySourceFiles: ["vault-room.js", "game.js", "loot-tables.js"],
      legacyFunctionOrSymbol: "isVaultChestAvailable/openChest/rollChestOutcome",
      trigger: "Guardian defeated, surviving Vault chest opened",
      roomType: "vault",
      depthEligibility: { minimum: 6, maximum: maximumDepth - 1 },
      runLimit: "Vault schedule only; no relic reward limit exists",
      offerChoiceCount: 0,
      candidatePool: [],
      rarityPolicy: null,
      pityPolicy: { classification: "NONE" },
      slotPolicy: "standard bounded chest claim; no relic_offer slot",
      selectionPolicy: "none",
      emptyPoolBehavior: "not applicable",
      replacementBehavior: "standard chest outcome plus fixed Vault gold bonus; never a relic replacement",
      serverCanIssueExactly: false,
      implementedInThisPhase: false,
      deferredReason: "NOT_AN_ACTIVE_RELIC_SOURCE",
      sourceEvidence: [
        "vault-room.js:isVaultChestAvailable only guards chest interaction",
        "game.js:openChest routes Vault chests to lootTablesApi.rollChestOutcome",
        "loot-tables.js:rollChestOutcome has exactly health/healing/attack/armor/potion/map_fragment/gold/trap outcomes"
      ]
    },
    {
      sourceId: "otter-crimson-chest",
      sourceCategory: "special_room_reward",
      legacySourceFiles: ["game.js", "room-pity.js", "relic-data.js", "relic-runtime.js"],
      legacyFunctionOrSymbol: "buildOtterRoomRelicOfferIds/spawnOtterRewardChest/openChest",
      trigger: "issued Otter directive; Crimson chest revealed after room clear",
      roomType: "otter",
      depthEligibility: {
        minimum: otterMinimumDepth,
        firstEffectiveNonBossDepth: otterMinimumDepth + 1,
        maximum: maximumDepth - 1,
        bossDepthsExcluded: true
      },
      runLimit: otterMaximumPerRun,
      offerChoiceCount: otterOfferChoiceCount,
      candidatePool: "canonical rare/epic/legendary/mythic relics legal for acquisitionSource=otter",
      rarityPolicy: otterRarityPolicy,
      pityPolicy: otterOfferPolicy.pityPolicy,
      slotPolicy: "one RoomRewardEnvelopeV3 relic_offer slot bound to the Otter directive",
      selectionPolicy: "existing selectRegularRelic; opaque offerId and choiceId only",
      emptyPoolBehavior: "NO_REWARD before offer/chest creation; canonical slot consumed once",
      replacementBehavior: "canonical global replacement; canonical stored reward empty grants 50 base gold; stale client cache is rejected",
      serverCanIssueExactly: true,
      implementedInThisPhase: true,
      deferredReason: null,
      sourceEvidence: [
        "game.js:OTTER_ROOM_RELIC_CHOICES=9",
        "game.js:buildOtterRoomRelicOfferIds filters rare+ and stores IDs",
        "game.js:spawnOtterRewardChest reveals otter_red after clear",
        "game.js:openChest resolves the stored Crimson choice set"
      ]
    },
    {
      sourceId: "arena-reward-cache",
      sourceCategory: "special_room_reward",
      legacySourceFiles: ["game.js"],
      legacyFunctionOrSymbol: "spawnArenaRewardChest/openStoredRelicChest",
      trigger: "all Blood Arena waves cleared",
      roomType: "arena",
      depthEligibility: { minimum: 40, maximum: maximumDepth - 1, bossDepthsExcluded: true },
      runLimit: "no explicit per-run cap; eligible non-boss rooms use the room scheduler",
      offerChoiceCount: "3 + extraRelicChoices",
      candidatePool: "baseline rare/epic/legendary/mythic draft-eligible relics; slot capacity is resolved only after selection",
      rarityPolicy: "non-boss depth formula with rare+ filter and whole-pool fallback",
      pityPolicy: { classification: "NONE" },
      slotPolicy: "one stored arena_reward chest",
      selectionPolicy: "choose one or skip",
      emptyPoolBehavior: "pre-spawn empty pool gives NO_REWARD; canonical stored reward empty grants 60 base gold; stale client cache is rejected",
      replacementBehavior: "full-slot legal selections use canonical replacement; cancel discards incoming; no legal replacement rejects without fallback",
      serverCanIssueExactly: true,
      implementedInThisPhase: false,
      deferredReason: "READY_FOR_IMPLEMENTATION",
      sourceEvidence: [
        "expansion-content.js:ROOM_TYPES.arena.minDepth=40",
        "game.js:ARENA_WAVE_COUNT=2 and checkRoomClearBonus",
        "game.js:spawnArenaRewardChest stores 3 + extraRelicChoices rare+ IDs",
        "game.js:openStoredRelicChest grants 60 gold only for an empty stored cache",
        "game.js:chooseRelic enters global replacement state when acquisition cannot fit",
        "Phase 3B2C3A resolves empty-pool, canonical stored-empty, stale-state, cancellation, and no-legal-replacement behavior"
      ]
    },
    {
      sourceId: "crossroads-power",
      sourceCategory: "special_room_transaction",
      legacySourceFiles: ["game.js"],
      legacyFunctionOrSymbol: "armCrossroadsPowerConfirmation/openCrossroadsPowerChest",
      trigger: "player confirms POWER chest and closes MERCY",
      roomType: "crossroads",
      depthEligibility: { minimum: 1, maximum: maximumDepth - 1 },
      runLimit: "one POWER or MERCY choice per Crossroads room",
      offerChoiceCount: "3 + extraRelicChoices",
      candidatePool: "canonical epic/legendary/mythic relics",
      rarityPolicy: "non-boss depth formula with Epic+ fallback",
      pityPolicy: { classification: "NONE" },
      slotPolicy: "transaction-bound reward slot after confirmation",
      selectionPolicy: "choose one or skip after irreversible max-HP penalty",
      emptyPoolBehavior: "penalty remains and 80 gold is granted",
      replacementBehavior: "source-local 80 gold fallback",
      serverCanIssueExactly: true,
      implementedInThisPhase: false,
      deferredReason: "REQUIRES_TRANSACTION_PHASE",
      sourceEvidence: [
        "game.js:openCrossroadsPowerChest",
        "game.js:CROSSROADS_POWER_HP_COST_MULTIPLIER=0.15",
        "game.js:grantGold(80)"
      ]
    },
    {
      sourceId: "merchant-relic-slot",
      sourceCategory: "merchant_transaction",
      legacySourceFiles: ["game.js", "merchant-curation.js", "camp-runtime.js"],
      legacyFunctionOrSymbol: "generateMerchantSlots/chooseMerchantRelicOffer/tryBuyRelicFromMerchant",
      trigger: "Merchant inventory initialization and paid purchase",
      roomType: "merchant",
      depthEligibility: { minimum: 3, maximum: maximumDepth - 1 },
      runLimit: "one generated live relic slot per Merchant inventory",
      offerChoiceCount: 1,
      candidatePool: "rarity-tier pool, preferring unowned relics",
      rarityPolicy: { normal: 60, rare: 25, epic: 12, legendary: 3 },
      pityPolicy: { classification: "NONE" },
      slotPolicy: "transactional inventory slot with sold state",
      selectionPolicy: "pay canonical discounted price; swap flow when full",
      emptyPoolBehavior: "merchantRelicSlot=null",
      replacementBehavior: "full inventory enters Merchant swap transaction",
      serverCanIssueExactly: true,
      implementedInThisPhase: false,
      deferredReason: "REQUIRES_TRANSACTION_PHASE",
      sourceEvidence: [
        "game.js:MERCHANT_RELIC_TIERS",
        "game.js:generateMerchantSlots",
        "camp-runtime.js:tryBuyRelicFromMerchant"
      ]
    },
    {
      sourceId: "merchant-reserved-relic",
      sourceCategory: "merchant_transaction",
      legacySourceFiles: ["game.js", "camp-runtime.js"],
      legacyFunctionOrSymbol: "tryReserveRelicFromMerchant/tryBuyReservedRelicFromMerchant",
      trigger: "reserve live slot with 25 percent deposit; later pay remainder",
      roomType: "merchant",
      depthEligibility: { minimum: 3, maximum: maximumDepth - 1 },
      runLimit: "one persistent reservation",
      offerChoiceCount: 1,
      candidatePool: "inherits original Merchant relic slot",
      rarityPolicy: "inherits original Merchant relic slot",
      pityPolicy: { classification: "NONE" },
      slotPolicy: "persistent reservation with deposit and remaining price",
      selectionPolicy: "paid purchase or discard with lost deposit",
      emptyPoolBehavior: "no reservation",
      replacementBehavior: "full inventory enters Merchant swap transaction",
      serverCanIssueExactly: true,
      implementedInThisPhase: false,
      deferredReason: "REQUIRES_TRANSACTION_PHASE",
      sourceEvidence: [
        "game.js:MERCHANT_RESERVE_DEPOSIT_RATIO=0.25",
        "camp-runtime.js:tryReserveRelicFromMerchant",
        "camp-runtime.js:tryBuyReservedRelicFromMerchant"
      ]
    },
    {
      sourceId: "merchant-black-market",
      sourceCategory: "replacement_transaction",
      legacySourceFiles: ["game.js", "camp-runtime.js"],
      legacyFunctionOrSymbol: "tryUseBlackMarket",
      trigger: "sacrifice an owned normal or rare relic and pay service cost",
      roomType: "merchant",
      depthEligibility: { minimum: 3, maximum: maximumDepth - 1 },
      runLimit: "one generated Merchant service slot",
      offerChoiceCount: 1,
      candidatePool: "rare output for normal sacrifice; epic output for rare sacrifice",
      rarityPolicy: "fixed one-tier upgrade",
      pityPolicy: { classification: "NONE" },
      slotPolicy: "atomic sacrifice, purchase, and replacement",
      selectionPolicy: "choose owned sacrifice then transact",
      emptyPoolBehavior: "transaction rejected and original relic retained",
      replacementBehavior: "core behavior is replacement",
      serverCanIssueExactly: true,
      implementedInThisPhase: false,
      deferredReason: "REQUIRES_TRANSACTION_PHASE",
      sourceEvidence: [
        "camp-runtime.js:tryUseBlackMarket",
        "game.js:eligible normal/rare Black Market inputs"
      ]
    },
    {
      sourceId: "forge-temper",
      sourceCategory: "forge_operation",
      legacySourceFiles: ["game.js", "forge-room.js"],
      legacyFunctionOrSymbol: "executeForgeTemper/planForgeTemper",
      trigger: "cleared Forge interaction; choose Temper",
      roomType: "forge",
      depthEligibility: { minimum: 6, maximum: maximumDepth - 1 },
      runLimit: "Forge used once",
      offerChoiceCount: 1,
      candidatePool: "depth-profile rare/epic/legendary/mythic legal relics",
      rarityPolicy: "FORGE_PROFILES by depth",
      pityPolicy: {
        classification: "GAME_SESSION_SCOPED",
        status: "DEFERRED_GAME_SESSION_SCOPED_PITY"
      },
      slotPolicy: "Forge operation slot, not a regular room reward",
      selectionPolicy: "take one or decline",
      emptyPoolBehavior: "Forge stays cold; no reward",
      replacementBehavior: "full inventory enters relic replacement UI",
      serverCanIssueExactly: true,
      implementedInThisPhase: false,
      deferredReason: "READY_FOR_IMPLEMENTATION",
      sourceEvidence: [
        "forge-room.js:FORGE_PROFILES",
        "forge-room.js:planForgeTemper",
        "game.js:executeForgeTemper"
      ]
    },
    {
      sourceId: "forge-transmute",
      sourceCategory: "replacement_transaction",
      legacySourceFiles: ["game.js", "forge-room.js"],
      legacyFunctionOrSymbol: "executeForgeTransmute/planForgeTransmute",
      trigger: "choose owned relic sacrifice, then generate outputs",
      roomType: "forge",
      depthEligibility: { minimum: 6, maximum: maximumDepth - 1 },
      runLimit: "Forge used once",
      offerChoiceCount: 3,
      candidatePool: "profile-allowed legal outputs excluding sacrifice",
      rarityPolicy: "at or above sacrificed rarity within Forge profile",
      pityPolicy: { classification: "NONE" },
      slotPolicy: "atomic sacrifice and replacement operation",
      selectionPolicy: "choose sacrifice, then one canonical output",
      emptyPoolBehavior: "operation rejected; original relic retained",
      replacementBehavior: "core behavior is replacement",
      serverCanIssueExactly: true,
      implementedInThisPhase: false,
      deferredReason: "REQUIRES_TRANSACTION_PHASE",
      sourceEvidence: [
        "forge-room.js:planForgeTransmute",
        "game.js:executeForgeTransmute",
        "game.js:forgeTransmutePending"
      ]
    },
    {
      sourceId: "global-replacement-rewards",
      sourceCategory: "replacement_policy",
      legacySourceFiles: ["game.js", "camp-runtime.js"],
      legacyFunctionOrSymbol: "chooseRelic/relicSwapPending/legendarySwapPending",
      trigger: "legal offered relic cannot fit current canonical build",
      roomType: "multiple",
      depthEligibility: { minimum: 1, maximum: maximumDepth },
      runLimit: "per offered reward",
      offerChoiceCount: "depends on source",
      candidatePool: "owned outgoing relics plus selected incoming relic",
      rarityPolicy: "inherits source",
      pityPolicy: { classification: "NONE" },
      slotPolicy: "must retain original reward slot until replacement settles",
      selectionPolicy: "select outgoing relic or keep current build",
      emptyPoolBehavior: "keep current build",
      replacementBehavior: "cross-source state machine affects slots, unique, legendary and mythic caps",
      serverCanIssueExactly: true,
      implementedInThisPhase: true,
      deferredReason: null,
      sourceEvidence: [
        "game.js:relicSwapPending",
        "game.js:legendarySwapPending",
        "game.js:chooseRelic"
      ]
    },
    {
      sourceId: "pact-room",
      sourceCategory: "not_active_relic_source",
      legacySourceFiles: ["pact-room.js", "game.js"],
      legacyFunctionOrSymbol: "getPactOfferDefs/applyPactChoice",
      trigger: "Pact sigil interaction",
      roomType: "pact",
      depthEligibility: { minimum: 1, maximum: maximumDepth - 1 },
      runLimit: "Pact schedule",
      offerChoiceCount: 0,
      candidatePool: [],
      rarityPolicy: null,
      pityPolicy: { classification: "NONE" },
      slotPolicy: "pact offer, not relic offer",
      selectionPolicy: "select a pact",
      emptyPoolBehavior: "silent Pact chamber",
      replacementBehavior: "replace or break active pact, not a relic",
      serverCanIssueExactly: false,
      implementedInThisPhase: false,
      deferredReason: "NOT_AN_ACTIVE_RELIC_SOURCE",
      sourceEvidence: [
        "pact-room.js:PACTS",
        "game.js:applyPactChoice mutates activePacts, not relics"
      ]
    },
    {
      sourceId: "debug-cheat-relic-picker",
      sourceCategory: "qa_only",
      legacySourceFiles: ["game.js"],
      legacyFunctionOrSymbol: "tryClaimDebugCheatMerchantRelic/tryDebugAddRelicBySlot",
      trigger: "debug cheat only",
      roomType: "debug",
      depthEligibility: { minimum: 0, maximum: maximumDepth },
      runLimit: "debug-only",
      offerChoiceCount: "catalog picker",
      candidatePool: "debug catalog",
      rarityPolicy: "none",
      pityPolicy: { classification: "NONE" },
      slotPolicy: "none",
      selectionPolicy: "direct debug mutation",
      emptyPoolBehavior: "debug rejection",
      replacementBehavior: "debug-only",
      serverCanIssueExactly: false,
      implementedInThisPhase: false,
      deferredReason: "NOT_PRODUCTION_SOURCE",
      sourceEvidence: [
        "game.js:canUseDebugCheats",
        "game.js:tryClaimDebugCheatMerchantRelic"
      ]
    }
  ];
  for (const source of specialSourceAudit) {
    if (Object.keys(source).join(",") !== specialAuditFields.join(",")) {
      throw new Error(`SPECIAL_RELIC_SOURCE_SCHEMA_MISMATCH:${source.sourceId}`);
    }
  }
  const deferredStatusValues = [
    "IMPLEMENTED",
    "NOT_AN_ACTIVE_RELIC_SOURCE",
    "READY_FOR_IMPLEMENTATION",
    "REQUIRES_TRANSACTION_PHASE",
    "BLOCKED_BY_REPLACEMENT_POLICY",
    "BLOCKED_BY_REPLACEMENT_REWARD_POLICY",
    "UNRESOLVED_ACTIVE_RELIC_SOURCE",
    "NOT_PRODUCTION_SOURCE"
  ];
  const deferredSpecs = specialSourceAudit
    .filter((source) => !source.implementedInThisPhase)
    .map((source) => ({
      sourceId: source.sourceId,
      status: source.deferredReason,
      trigger: source.trigger,
      rewardType: source.sourceCategory,
      offerChoiceCount: source.offerChoiceCount,
      candidatePool: source.candidatePool,
      rarityPolicy: source.rarityPolicy,
      fallback: source.replacementBehavior,
      unresolvedDependencies: source.deferredReason,
      sourceEvidence: source.sourceEvidence
    }));
  for (const spec of deferredSpecs) {
    if (!deferredStatusValues.includes(spec.status)) {
      throw new Error(`SPECIAL_RELIC_DEFERRED_STATUS_INVALID:${spec.sourceId}:${spec.status}`);
    }
  }
  const vaultArenaClassification = {
    phase: "3B2C3A",
    vault: {
      sourceId: "vault-standard-chest",
      classification: "NOT_AN_ACTIVE_RELIC_SOURCE",
      activeChestOutcomeIds: vaultArenaGuard.chestOutcomeIds,
      activeRelicDraftBuilders: vaultArenaGuard.relicDraftBuilders,
      relicOfferChoiceCount: 0,
      relicRewardSlotRequired: false,
      futureChangePolicy: "generator fails with VAULT_RELIC_SOURCE_REVIEW_REQUIRED until a new explicit policy is added",
      sourceEvidence: [
        "vault-room.js only controls Guardian lifecycle, chest locks, threat state, and hazards",
        "game.js:openChest sends ordinary surviving Vault chests through lootTablesApi.rollChestOutcome",
        "loot-tables.js has no relic outcome or relic reference",
        "game.js has no Vault-specific relic draft builder or stored relic chest dispatch"
      ]
    },
    arena: {
      sourceId: "arena-reward-cache",
      classification: "READY_FOR_IMPLEMENTATION",
      legacySourceFiles: ["expansion-content.js", "game.js", "relic-data.js", "relic-runtime.js"],
      legacyFunctionOrSymbol: "ROOM_TYPES.arena/ARENA_WAVE_COUNT/checkRoomClearBonus/spawnArenaRewardChest/openStoredRelicChest/chooseRelic",
      trigger: "issued non-boss Blood Arena room reaches zero enemies after its second wave",
      roomType: "arena",
      minimumDepth: vaultArenaGuard.arenaMinimumDepth,
      maximumDepth: maximumDepth - 1,
      runLimit: "no explicit per-run cap; every scheduler-selected eligible Arena can reward once",
      completionCondition: `all ${vaultArenaGuard.arenaWaveCount} waves cleared; no enemies remain`,
      rewardMoment: "checkRoomClearBonus calls spawnArenaRewardChest immediately after the final wave clear",
      rewardSlotType: "relic_offer",
      offerChoiceCount: "3 + extraRelicChoices (3 normally; 4 with Ascension)",
      candidatePool: "all baseline draft-eligible rare/epic/legendary/mythic relics; no duplicate IDs in one offer",
      allowedRarities: ["rare", "epic", "legendary", "mythic"],
      rarityWeights: {
        mythic: "min(0.02, (0.02 + floor(depth / 5) * 0.008) * 0.1)",
        legendary: "0.02 + floor(depth / 5) * 0.008",
        epic: "0.06 + floor(depth / 5) * 0.012",
        rare: 0.17,
        fallback: "if rolled rarity has no candidate, choose from the whole remaining rare+ pool"
      },
      depthScaling: "legendary and epic chances increase once per five depths; mythic derives from legendary and is capped at 0.02",
      pityPolicy: {
        rewardOfferPity: "NONE",
        roomSchedulePity: "NONE",
        scope: "RUN_SCOPED_NOT_APPLICABLE"
      },
      sourceRestrictions: [
        "non-boss Arena room only",
        "rare+ draft filter",
        "mythic excluded when already owned",
        "owned unique relics excluded",
        "normal stacks at cap excluded"
      ],
      slotPolicy: "one stored arena_reward chest per Arena state via rewardSpawned",
      selectionRequired: false,
      emptyPoolBehavior: "pre-spawn empty pool gives NO_REWARD; canonical stored reward empty grants 60 base gold; stale client/cache binding is rejected",
      fullSlotsBehavior: "offered relic may enter the global replacement UI after selection",
      replacementBehavior: "CANONICAL_GLOBAL_REPLACEMENT_TRANSACTION",
      dependencyStatus: {
        canonicalRunModifierState: "RESOLVED",
        extraRelicChoicesProjection: "RESOLVED",
        globalRelicReplacementTransaction: "RESOLVED",
        emptyPoolPolicy: "RESOLVED",
        staleRewardPolicy: "RESOLVED",
        noLegalReplacementFallback: "RESOLVED",
        replacementRewardFallback: "RESOLVED"
      },
      serverCanIssueExactly: true,
      exactIssuanceBlockers: [],
      boundedClientAttestationRequired: {
        required: true,
        trusted: [
          "Worker-issued Arena RoomDirectiveV3",
          "Worker-issued RoomRewardEnvelopeV3 and one-time reward slot",
          "runId, revision, nonce, directive binding, rulesetHash, canonical build digest"
        ],
        boundedOnly: [
          "Arena completion after two waves",
          "turn count, elapsed time, compact room proof, command journal digest"
        ],
        neverAuthoritativeFromClient: [
          "combat trace, positions, AI, damage, HP, exact kills outside envelope bounds",
          "relicId, rarity, candidate pool, choice count, stack count, foreign reward slot ID"
        ]
      },
      sourceEvidence: [
        "expansion-content.js:ROOM_TYPES.arena",
        "game.js:ARENA_WAVE_COUNT=2",
        "game.js:checkRoomClearBonus",
        "game.js:spawnArenaRewardChest",
        "game.js:buildRelicDraftChoices and rollRelicRarity(false)",
        "game.js:openStoredRelicChest",
        "game.js:chooseRelic replacement state",
        "game.js:applyMutatorsToRun/applyMutatorMidRun ascension",
        "cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/meta-state.js"
      ]
    }
  };
  return new Map([
    ["relic-reward-sources.generated.json", {
      ...common,
      canonicalData: {
        inventoryFields,
        inventoryCount: sourceInventory.length,
        implementedSourceIds: sourceInventory
          .filter((entry) => entry.implementedIn3B2B2A)
          .map((entry) => entry.sourceId),
        deferredSourceIds: sourceInventory
          .filter((entry) => !entry.implementedIn3B2B2A && entry.deferredReason !== "EXISTING_PHASE_3B2B1")
          .map((entry) => entry.sourceId),
        sources: sourceInventory
      }
    }],
    ["relic-rarity-policy.generated.json", {
      ...common,
      canonicalData: {
        implementedSourceId: "warden-standard-drop",
        rarityOrder: ["normal", "rare", "epic", "legendary"],
        rarityTiers,
        mythicRelativeToLegendaryChance: mythicRelativeChance,
        mythicChanceMaximum: 0.02,
        mythicRollOrder: "mythic pre-roll, normalize remainder, then cumulative rarity weights",
        choiceRarityRollPolicy: "one rarity roll per choice",
        unavailableRarityFallback: "all otherwise legal unlocked rarities for this source",
        rounding: "integer RNG over one million canonical units"
      }
    }],
    ["relic-pity-policy.generated.json", {
      ...common,
      canonicalData: {
        implemented: [{
          pityId: "warden-run-drop-miss-streak",
          sourceId: "warden-standard-drop",
          scope: "run",
          statePath: "relicOfferState.sourceSpecificCounters.wardenDropMissStreak",
          bonusPerMiss: pityBonusPerMiss,
          hardPityAfterMisses,
          chanceCapBeforeHardPity: 0.95,
          updateEvent: "reward slot issue attempt",
          retryPolicy: "no increment for a slot with an existing resolution"
        }, {
          pityId: "warden-first-drop-depths",
          sourceId: "warden-standard-drop",
          scope: "profile",
          statePath: "campaign.wardenFirstDropDepths",
          guarantee: "first eligible Warden kill at each boss depth",
          updateEvent: "reward slot resolution",
          retryPolicy: "depth is recorded exactly once after resolution"
        }],
        deferredProfileScoped: [],
        deferredGameSessionScoped: [
          {
            pityId: "forge-room-pity",
            legacyState: "forgeSeenThisGame/forgePityUsedThisGame",
            storageKey: "game save state",
            reason: "DEFERRED_GAME_SESSION_SCOPED_PITY"
          },
          {
            pityId: "otter-room-pity",
            legacyState: "otterSeenThisGame/otterPityUsedThisGame",
            storageKey: "game save state",
            reason: "DEFERRED_GAME_SESSION_SCOPED_PITY"
          }
        ]
      }
    }],
    ["regular-relic-offer-policy.generated.json", {
      ...common,
      canonicalData: {
        offerType: "relic_reward",
        implementedSourceId: "warden-standard-drop",
        sourceType: "boss_reward",
        rewardSlotType: "relic_offer",
        offerChoiceCount: 3,
        minimumDepth: 5,
        maximumDepth: maximumDepth - 5,
        bossInterval: 5,
        finalDepthExcluded: true,
        requestFields: ["rewardEnvelopeId", "rewardSlotId", "sourceDirectiveId"],
        selectionRequestFields: ["offerId", "choiceId"],
        rngPurposes: [
          "relic-offer-drop",
          "relic-offer-rarity",
          "relic-offer-candidate",
          "relic-offer-choice-order",
          "relic-offer-offer-id",
          "relic-offer-choice-id"
        ],
        emptyPoolBehavior: "NO_REWARD; canonical reward slot consumed once",
        fullPoolBehavior: "CANONICAL_REPLACEMENT_TRANSACTION",
        publicChoiceFields,
        publicPayloadTargetBytes: 2048
      }
    }],
    ["otter-relic-offer-policy.generated.json", {
      ...common,
      canonicalData: otterOfferPolicy
    }],
    ["arena-relic-offer-policy.generated.json", {
      ...common,
      canonicalData: arenaOfferPolicy
    }],
    ["special-relic-source-audit.generated.json", {
      ...common,
      canonicalData: {
        auditFields: specialAuditFields,
        sourceCount: specialSourceAudit.length,
        implementedSourceIds: specialSourceAudit
          .filter((source) => source.implementedInThisPhase)
          .map((source) => source.sourceId),
        unresolvedSourceIds: specialSourceAudit
          .filter((source) => source.deferredReason === "UNRESOLVED_ACTIVE_RELIC_SOURCE")
          .map((source) => source.sourceId),
        sources: specialSourceAudit
      }
    }],
    ["deferred-special-relic-spec.generated.json", {
      ...common,
      canonicalData: {
        allowedStatuses: deferredStatusValues,
        sourceCount: deferredSpecs.length,
        sources: deferredSpecs
      }
    }],
    ["vault-arena-relic-classification.generated.json", {
      ...common,
      canonicalData: vaultArenaClassification
    }]
  ]);
}

async function readSources() {
  const records = [];
  const textByFile = new Map();
  for (const entry of SOURCE_INPUTS) {
    const bytes = await readFile(path.join(REPO_ROOT, entry.file));
    const text = bytes.toString("utf8");
    for (const symbol of entry.symbols) {
      if (!text.includes(symbol)) {
        throw new Error(`SOURCE_SYMBOL_MISSING:${entry.file}:${symbol}`);
      }
    }
    records.push({
      file: entry.file.replaceAll("\\", "/"),
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
      evidenceSymbols: [...entry.symbols]
    });
    textByFile.set(entry.file, text);
  }
  records.sort((left, right) => left.file.localeCompare(right.file));
  return { records, textByFile };
}

function sourceRefs(records, files) {
  const selected = new Set(files);
  return records
    .filter((entry) => selected.has(entry.file))
    .map(({ file, byteLength, sha256: digest }) => ({ file, byteLength, sha256: digest }));
}

function goldSourceEntry({
  sourceId,
  legacySourceFile,
  legacyFunctionOrConstant,
  authorityClass,
  calculationInputs = [],
  serverKnownInputs = [],
  clientAttestedInputs = [],
  maximumPerRoomKnown = false,
  maximumPerRunKnown = false,
  stackingRules = "not-applicable",
  roundingRules = "not-applicable",
  appliedOrder = [],
  eligibleRoomTypes = [],
  generatedDataRef = null,
  notes = ""
}) {
  return {
    sourceId,
    legacySourceFile,
    legacyFunctionOrConstant,
    authorityClass,
    calculationInputs,
    serverKnownInputs,
    clientAttestedInputs,
    maximumPerRoomKnown,
    maximumPerRunKnown,
    stackingRules,
    roundingRules,
    appliedOrder,
    eligibleRoomTypes,
    generatedDataRef,
    notes
  };
}

function buildRunModifierCanonicalData(records, textByFile) {
  const gameSource = textByFile.get("game.js");
  const mutatorSource = textByFile.get("mutator-data.js");
  const sourceFiles = ["mutator-data.js", "game.js"];
  const catalogIds = Array.from(
    mutatorSource.matchAll(/\bid:\s*"([a-z_]+)"/gu),
    (match) => match[1]
  );
  const activeReadIds = Array.from(new Set(Array.from(
    gameSource.matchAll(/isMutatorActive\("([a-z_]+)"\)/gu),
    (match) => match[1]
  ))).sort();
  const unlocks = {
    berserker: { metric: "totalKills", threshold: 200 },
    bulwark: { metric: "depthHighscore", threshold: 15 },
    alchemist: { metric: "totalMerchantPots", threshold: 25 },
    greed: { metric: "totalGoldEarned", threshold: 12000 },
    hunter: { metric: "eliteKills", threshold: 90 },
    resilience: { metric: "shieldUsesThisGame", threshold: 60 },
    momentum: { metric: "depthHighscore", threshold: 20 },
    famine: { metric: "potionFreeExtract", threshold: 1 },
    elitist: { metric: "eliteKills", threshold: 250 },
    ascension: { metric: "depthHighscore", threshold: 30 }
  };
  const effectsById = {
    berserker: {
      playerStart: { attackMultiplier: 1.25, maximumHpMultiplier: 0.75 },
      gold: { globalAdditive: 0.2 }
    },
    bulwark: {
      playerStart: { armorMultiplier: 1.3, attackMultiplier: 0.8 },
      gold: { globalAdditive: 0.2 }
    },
    alchemist: {
      potion: { maximumSlotsAdditive: 2, startingPotionsAdditive: 2, healMultiplier: 1.3 },
      reward: { chestHealingDisabled: true },
      gold: { globalAdditive: 0.2 }
    },
    greed: {
      gold: { globalAdditive: 0.4 },
      roomGeneration: { extraEnemiesAdditive: 2 },
      enemy: { hpMultiplier: 1.2 },
      economy: { shopCostMultiplier: 1.25 }
    },
    hunter: {
      playerStart: { critChanceAdditive: 0.2 },
      enemy: { damageMultiplier: 1.25 },
      gold: { globalAdditive: 0.2 }
    },
    resilience: {
      roomEntry: { barrierMaximumHpFraction: 0.2 },
      enemy: { damageMultiplier: 1.2 },
      gold: { globalAdditive: 0.2 }
    },
    momentum: {
      playerDynamic: { attackPerMaximumDepthFraction: 0.005, rounding: "round" },
      enemy: { damageMultiplier: 1.15 },
      gold: { globalAdditive: 0.2 }
    },
    famine: {
      playerStart: { maximumHpMultiplier: 1.3 },
      potion: { maximumSlotsAdditive: -3, minimumMaximumSlots: 1, healMultiplier: 0.5 },
      gold: { globalAdditive: 0.2 }
    },
    elitist: {
      enemy: { eliteChanceAdditive: 0.3, eliteHpMultiplier: 1.25 },
      gold: { globalAdditive: 0.2, eliteRewardMultiplier: 1.6 }
    },
    ascension: {
      relicOffer: { extraRelicChoices: 1 },
      enemy: { attackMultiplierPerThreeMaximumDepths: 0.03, depthStep: 3 },
      gold: { globalAdditive: 0.2 }
    }
  };
  const displayNames = Object.fromEntries(Array.from(
    mutatorSource.matchAll(/\bid:\s*"([a-z_]+)"[\s\S]*?\bname:\s*"([^"]+)"/gu),
    (match) => [match[1], match[2]]
  ));
  const expectedIds = Object.keys(effectsById).sort();
  const parsedIds = [...new Set(catalogIds)].sort();
  if (canonicalJson(parsedIds) !== canonicalJson(expectedIds)) {
    throw new Error("RUN_MODIFIER_CATALOG_INCOMPLETE");
  }
  if (activeReadIds.some((id) => !effectsById[id])) {
    throw new Error("RUN_MODIFIER_POLICY_REFERENCE_UNKNOWN");
  }
  if (expectedIds.some((id) => Object.keys(effectsById[id] || {}).length === 0)) {
    throw new Error("RUN_MODIFIER_EFFECT_UNCLASSIFIED");
  }
  const catalog = expectedIds.map((modifierId) => ({
    modifierId,
    displayName: displayNames[modifierId],
    modifierKind: "MUTATOR",
    legacySourceFiles: sourceFiles,
    legacyFunctionOrSymbol: [
      "MUTATORS",
      "getMutatorUnlockStatus",
      "isMutatorActive",
      "applyMutatorsToRun",
      "applyMutatorMidRun"
    ],
    scope: "RUN_SCOPED",
    unlockSource: unlocks[modifierId],
    selectionMoment: ["BETWEEN_RUNS", "CAMP_MID_RUN_ACTIVATION"],
    stackable: false,
    maximumStacks: 1,
    mutuallyExclusiveWith: [],
    gameplayEffects: effectsById[modifierId],
    goldEffects: effectsById[modifierId].gold || {},
    rewardEffects: effectsById[modifierId].reward || {},
    relicOfferEffects: effectsById[modifierId].relicOffer || {},
    roomGenerationEffects: effectsById[modifierId].roomGeneration || {},
    enemyEffects: effectsById[modifierId].enemy || {},
    scoreEffects: { scoreMultiplier: 1, directEffect: false },
    leaderboardMetadata: ["modifierId", "stacks"],
    profileDependency: "DEFERRED_PROFILE_UNLOCK_VALIDATION",
    serverCanRepresentExactly: true,
    implementedInThisPhase: true,
    deferredReason: "DEFERRED_PROFILE_STATE",
    sourceEvidence: [
      "mutator-data.js:MUTATORS",
      "mutator-data.js:getMutatorUnlockStatus",
      "game.js:applyMutatorsToRun",
      "game.js:applyMutatorMidRun"
    ]
  }));
  const effectsVersion = "v08-run-modifier-effects-1";
  const selectionPolicy = {
    policyVersion: "v08-run-modifier-selection-1",
    maximumActiveModifiers: 3,
    canonicalOrdering: "modifierId-ascending",
    duplicatePolicy: "REJECT",
    replacementPolicy: "REJECT_REMOVAL_OR_REPLACEMENT",
    midRunPolicy: "ALLOW_TRUSTED_ADDITIONS_ONLY",
    trustedAuthority: "TRUSTED_RULESET_DOMAIN",
    trustedActivationSources: ["server-issued-mid-run", "server-issued-run-start"],
    unlockValidation: "DEFERRED_PROFILE_UNLOCK_VALIDATION",
    derivedEffectsVersion: effectsVersion
  };
  const emptyLedgerDigest = `sha256:${sha256(canonicalJson({
    active: [],
    activeCount: 0,
    derivedEffectsVersion: effectsVersion
  }))}`;
  const common = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit: BASELINE_COMMIT,
    sources: sourceRefs(records, sourceFiles)
  };
  return new Map([
    ["run-modifier-catalog.generated.json", {
      ...common,
      canonicalData: { modifierIds: expectedIds, modifiers: catalog }
    }],
    ["run-modifier-effects.generated.json", {
      ...common,
      canonicalData: {
        effectsVersion,
        compositionOrder: expectedIds,
        modifiers: expectedIds.map((modifierId) => ({
          modifierId,
          effectIds: Object.entries(effectsById[modifierId]).flatMap(
            ([domain, values]) => Object.keys(values).map((name) => `${domain}.${name}`)
          ).sort(),
          effects: effectsById[modifierId]
        })),
        baselineDefaults: {
          extraRelicChoices: 0,
          goldMultiplierAdditive: 0,
          eliteGoldMultiplier: 1,
          scoreMultiplier: 1
        }
      }
    }],
    ["run-modifier-selection-policy.generated.json", {
      ...common,
      canonicalData: { ...selectionPolicy, emptyLedgerDigest }
    }],
    ["run-modifier-metadata.generated.json", {
      ...common,
      canonicalData: {
        activeBaselineModifierIds: activeReadIds,
        profileUnlockState: "DEFERRED_PROFILE_STATE",
        gameSessionState: "DEFERRED_GAME_SESSION_STATE",
        clientUnlockClaims: "UNTRUSTED",
        scopeRows: catalog.map((entry) => ({
          modifierId: entry.modifierId,
          unlockScope: entry.modifierId === "resilience"
            ? "PROFILE_SCOPED_WITH_GAME_SESSION_EVIDENCE"
            : "PROFILE_SCOPED",
          selectionScope: "RUN_SCOPED",
          runtimeScope: "RUN_SCOPED",
          serverRepresentation: "CANONICAL_ACTIVE_LEDGER",
          deferredDependency: "DEFERRED_PROFILE_UNLOCK_VALIDATION"
        })),
        legacyRunModFields: [
          "campGoldBonus", "chestHealPenalty", "eliteChance", "eliteGoldMult",
          "eliteHpBonus", "eliteHpMult", "enemyAtkMult", "enemyAtkPerDepth",
          "enemyDamageBonus", "enemyDamageMult", "enemyDoubleMoveChance",
          "enemyHpBonus", "enemyHpMult", "extraEnemies", "extraRelicChoices",
          "extraSpikeMult", "goldMultiplier", "momentumAtkBonus",
          "momentumBaseAtk", "noMerchants", "potionHealMult", "shopCostMult"
        ],
        selectableOtherRunModifierIds: [],
        notes: [
          "All ten active baseline selections are non-stackable mutators.",
          "No active baseline mutual-exclusion pair exists.",
          "Legacy runMods fields are derived runtime effects or non-mutator state, not additional selectable IDs."
        ]
      }
    }]
  ]);
}

function buildCanonicalData(records, textByFile) {
  const gameSource = textByFile.get("game.js");
  const pitySource = textByFile.get("room-pity.js");
  const expansionSource = textByFile.get("expansion-content.js");
  const pactSource = textByFile.get("pact-room.js");
  const campDataSource = textByFile.get("camp-data.js");
  const mutatorSource = textByFile.get("mutator-data.js");
  const relicDataSource = textByFile.get("relic-data.js");
  const maxDepth = extractNumber(gameSource, "MAX_DEPTH");
  const startDepthCheckpoints = extractNumericArray(gameSource, "START_DEPTH_CHECKPOINTS");
  const startDepthUnlockBossDepths = extractNumericArray(
    gameSource,
    "START_DEPTH_UNLOCK_BOSS_DEPTHS"
  );
  const maxLives = extractNumber(gameSource, "MAX_LIVES");
  const roomLabels = parseStringMap(extractBalancedBlock(gameSource, "const ROOM_TYPE_LABELS"));
  const regions = parseCampaignRegions(gameSource);
  const regionConfigs = parseCampaignRegionConfigs(gameSource);
  const expansionRooms = parseExpansionRoomTypes(expansionSource);
  const pactProfiles = parsePactProfiles(pactSource);
  const chooseRoomType = extractBalancedBlock(gameSource, "function chooseRoomType");
  const isBossDepth = extractBalancedBlock(gameSource, "function isBossDepth");
  const bossInterval = Number(requireMatch(
    isBossDepth,
    /state\.depth\s*%\s*(\d+)\s*===\s*0/u,
    "isBossDepth:interval"
  )[1]);
  const guaranteedMerchantRoomIndexes = Array.from(
    chooseRoomType.matchAll(/state\.roomIndex\s*===\s*(\d+)/gu),
    (match) => Number(match[1])
  ).sort((left, right) => left - right);
  const otterMinDepth = extractNumber(gameSource, "OTTER_ROOM_MIN_DEPTH");
  const otterMaxPerRun = extractNumber(gameSource, "OTTER_ROOM_MAX_PER_RUN");
  const otterChance = extractNumber(gameSource, "OTTER_ROOM_CHANCE");
  const otterChanceUltra = extractNumber(gameSource, "OTTER_ROOM_CHANCE_ULTRA");
  const ultraThemeStartDepth = extractNumber(gameSource, "ULTRA_THEME_START_DEPTH");
  const forgePityDepth = extractNumber(pitySource, "FORGE_PITY_DEPTH");
  const otterPityDepth = extractNumber(pitySource, "OTTER_PITY_DEPTH");
  const sourceCommit = BASELINE_COMMIT;
  const maxRelics = extractNumber(gameSource, "MAX_RELICS");
  const maxNormalRelicStack = extractNumber(gameSource, "MAX_NORMAL_RELIC_STACK");
  const maximumElitesPerRoom = extractNumber(gameSource, "MAX_ELITES_PER_ROOM");
  const maximumOtterEnemies = extractNumber(gameSource, "OTTER_ROOM_ENEMY_MAX");
  const goldenIdolBonus = extractNumber(gameSource, "GOLDEN_IDOL_GOLD_MULTIPLIER");
  const voidReaperGold = extractNumber(gameSource, "VOID_REAPER_CRIT_KILL_GOLD");
  const chaosOrbGold = extractNumber(gameSource, "CHAOS_ORB_GOLD_BONUS");
  const avaricePotionGold = extractNumber(
    gameSource,
    "CROSSROADS_MERCY_AVARICE_GOLD_PER_POTION"
  );
  const mutatorIds = Array.from(
    mutatorSource.matchAll(/\bid:\s*"([a-z_]+)"/gu),
    (match) => match[1]
  );
  const relicIds = Array.from(
    relicDataSource.matchAll(/\{\s*id:\s*"([a-z0-9_]+)"/gu),
    (match) => match[1]
  );
  const campUpgradeCaps = Object.fromEntries(
    Array.from(
      campDataSource.matchAll(
        /\bid:\s*"(treasure_sense|bounty_contract)"[\s\S]*?\bmax:\s*(\d+)/gu
      ),
      (match) => [match[1], Number(match[2])]
    )
  );

  const baseRoomCategories = Object.freeze({
    combat: "normal",
    treasure: "special",
    shrine: "special",
    forge: "special",
    pact: "special",
    cursed: "normal",
    otter: "special",
    vault: "special",
    merchant: "special",
    boss: "boss",
    ambush: "normal",
    horde: "normal",
    duel: "normal",
    crossroads: "special",
    arena: "special"
  });
  const roomTypes = Object.entries(roomLabels).map(([id, label]) => ({
    id,
    label,
    category: baseRoomCategories[id],
    scheduleEligible: true,
    sourceMode: "generated-label-manual-versioned-category",
    sourceReference: "game.js:ROOM_TYPE_LABELS/buildRegularRoom"
  }));
  roomTypes.push(
    {
      id: "final",
      label: "Final",
      category: "final",
      scheduleEligible: true,
      sourceMode: "manual-versioned-procedural-rule",
      sourceReference: "game.js:isBossDepth/buildRoom/triggerDepth100Victory"
    },
    {
      id: "camp",
      label: "Camp",
      category: "between-run",
      scheduleEligible: false,
      sourceMode: "manual-versioned-procedural-rule",
      sourceReference: "game.js:phase=camp/startRun"
    }
  );

  const expansionById = new Map(expansionRooms.map((entry) => [entry.id, entry]));
  const pactEnabled = pactProfiles.filter((entry) => entry.enabled);
  const minimumPactDepth = Math.min(...pactEnabled.map((entry) => entry.minDepth));
  const roomEligibility = roomTypes.map((room) => {
    const expansion = expansionById.get(room.id);
    const defaults = {
      minDepth: 1,
      maxDepth: room.id === "final" ? maxDepth : maxDepth - 1,
      maxPerRun: null,
      cooldownDepths: null,
      deterministic: false,
      mutualExclusions: ["boss", "final"]
    };
    if (room.id === "boss") {
      return {
        ...defaults,
        id: room.id,
        minDepth: bossInterval,
        maxDepth: maxDepth - bossInterval,
        deterministic: true,
        scheduleRule: `depth % ${bossInterval} === 0`
      };
    }
    if (room.id === "final") {
      return {
        ...defaults,
        id: room.id,
        minDepth: maxDepth,
        maxDepth,
        maxPerRun: 1,
        deterministic: true,
        mutualExclusions: ["all-other-room-types"],
        scheduleRule: `depth === ${maxDepth}`
      };
    }
    if (room.id === "camp") {
      return {
        ...defaults,
        id: room.id,
        minDepth: null,
        maxDepth: null,
        deterministic: true,
        mutualExclusions: ["in-run-room-directive"],
        scheduleRule: "between runs only; never emitted by chooseRoomType"
      };
    }
    if (room.id === "merchant") {
      return {
        ...defaults,
        id: room.id,
        minDepth: 3,
        guaranteedRoomIndexes: guaranteedMerchantRoomIndexes,
        scheduleRule: "weighted or guaranteed by roomIndex"
      };
    }
    if (room.id === "vault") {
      return {
        ...defaults,
        id: room.id,
        minDepth: Number(requireMatch(
          chooseRoomType,
          /state\.depth\s*>=\s*(\d+)\s*&&\s*chance\(vaultChance\)/u,
          "vault:minDepth"
        )[1]),
        scheduleRule: "independent region vaultChance before weighted selection"
      };
    }
    if (room.id === "forge") {
      return {
        ...defaults,
        id: room.id,
        minDepth: Number(requireMatch(
          chooseRoomType,
          /state\.depth\s*<\s*(\d+)\s*&&\s*type\s*===\s*"forge"/u,
          "forge:minDepth"
        )[1]),
        pityDepth: forgePityDepth,
        scheduleRule: "weighted plus one game-scoped pity"
      };
    }
    if (room.id === "pact") {
      return {
        ...defaults,
        id: room.id,
        minDepth: minimumPactDepth,
        scheduleRule: "depth-profile weight and canOfferPactRoom"
      };
    }
    if (room.id === "otter") {
      return {
        ...defaults,
        id: room.id,
        minDepth: otterMinDepth,
        maxPerRun: otterMaxPerRun,
        pityDepth: otterPityDepth,
        scheduleRule: "queued after a clear by independent chance plus one game-scoped pity"
      };
    }
    if (room.id === "cursed") {
      return {
        ...defaults,
        id: room.id,
        minDepth: Number(requireMatch(
          chooseRoomType,
          /state\.depth\s*<\s*(\d+)\s*&&\s*type\s*===\s*"cursed"/u,
          "cursed:minDepth"
        )[1]),
        scheduleRule: "weighted; replaced by treasure below minDepth"
      };
    }
    if (expansion) {
      return {
        ...defaults,
        id: room.id,
        minDepth: expansion.minDepth,
        scheduleRule: "weighted by expansion-content region profile"
      };
    }
    return {
      ...defaults,
      id: room.id,
      scheduleRule: "weighted by campaign region"
    };
  });

  const runProgression = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, ["game.js"]),
    canonicalData: {
      entranceStartDepth: 0,
      firstPlayableDepth: 1,
      maxDepth,
      terminalDepth: maxDepth,
      bossInterval,
      allowedStartDepths: [0, ...startDepthCheckpoints],
      startDepthUnlockBossDepths,
      initialRoomIndex: 0,
      initialRevision: 0,
      initialGold: extractAssignmentNumber(gameSource, "state.player.gold"),
      initialLives: maxLives,
      depthTransition: 1
    }
  };
  const roomTypesData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, ["game.js", "expansion-content.js"]),
    canonicalData: {
      roomTypes: roomTypes.sort((left, right) => left.id.localeCompare(right.id))
    }
  };
  const roomEligibilityData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, [
      "game.js",
      "room-pity.js",
      "expansion-content.js",
      "pact-room.js"
    ]),
    canonicalData: {
      regions,
      regionConfigs,
      expansionRooms,
      pactProfiles,
      roomEligibility: roomEligibility.sort((left, right) => left.id.localeCompare(right.id))
    }
  };
  const specialRoomPolicyData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, [
      "game.js",
      "room-pity.js",
      "expansion-content.js",
      "pact-room.js"
    ]),
    canonicalData: {
      priority: [
        "final",
        "boss",
        "queued-otter",
        "forge-pity",
        "otter-pity",
        "merchant-guarantee",
        "vault-roll",
        "weighted-room"
      ],
      guaranteedMerchantRoomIndexes,
      forgePityDepth,
      otterPityDepth,
      otter: {
        minDepth: otterMinDepth,
        maxPerRun: otterMaxPerRun,
        chance: otterChance,
        ultraChance: otterChanceUltra,
        ultraStartDepth: ultraThemeStartDepth,
        disallowBossDepth: true
      },
      manualVersionedRules: [
        {
          ruleId: "room-category-map",
          sourceReference: "game.js:ROOM_TYPE_LABELS/buildRegularRoom",
          reason: "Categories are implicit in procedural branches rather than exported data."
        },
        {
          ruleId: "special-room-priority",
          sourceReference: "game.js:chooseRoomType/maybeQueueOtterRoom",
          reason: "Priority is encoded by procedural branch order."
        }
      ],
      unresolvedSourceRules: [
        {
          ruleId: "forge-pity-game-scope",
          marker: "UNRESOLVED_SOURCE_RULE",
          sourceReference: "game.js:forgeSeenThisGame/forgePityUsedThisGame",
          reason: "Baseline persists pity across runs in one local game; Online v3 has no canonical cross-run game session."
        },
        {
          ruleId: "otter-pity-game-scope",
          marker: "UNRESOLVED_SOURCE_RULE",
          sourceReference: "game.js:otterSeenThisGame/otterPityUsedThisGame",
          reason: "Baseline persists pity across runs in one local game; Online v3 has no canonical cross-run game session."
        }
      ],
      deferredOutsidePhase3B1: [
        {
          ruleId: "treasure-map-forced-vault",
          sourceReference: "game.js:forcedNextRoomType=VAULT",
          reason: "Depends on reward/economy state deferred to Phase 3B2."
        },
        {
          ruleId: "crossroads-power-exclusion",
          sourceReference: "game.js:isCrossroadsPowerPenaltyActive",
          reason: "Depends on a local build effect not implemented in Phase 3B1."
        }
      ]
    }
  };
  const goldSourceFiles = [
    "game.js",
    "camp-data.js",
    "camp-runtime.js",
    "loot-tables.js",
    "mutator-data.js",
    "relic-data.js",
    "pact-room.js"
  ];
  const allRunRooms = roomTypes
    .filter((entry) =>
      entry.scheduleEligible && !["merchant", "crossroads"].includes(entry.id)
    )
    .map((entry) => entry.id)
    .sort();
  const grantOrder = [
    "source base amount",
    "source-specific bounty/elite/treasure modifier",
    "Math.round",
    "run additive gold multiplier",
    "Pact of Avarice multiplier",
    "Math.round",
    "minimum positive grant of 1"
  ];
  const goldSources = [
    goldSourceEntry({
      sourceId: "room-clear",
      legacySourceFile: "game.js",
      legacyFunctionOrConstant: "checkRoomClearBonus/goldBonus",
      authorityClass: "SERVER_DERIVED",
      calculationInputs: ["depth", "roomType", "bossRoom"],
      serverKnownInputs: ["directive.depth", "directive.roomType", "canonicalBuild"],
      maximumPerRoomKnown: true,
      maximumPerRunKnown: true,
      stackingRules: "once per completed room",
      roundingRules: "integer base then grantGold rounding",
      appliedOrder: grantOrder,
      eligibleRoomTypes: allRunRooms,
      generatedDataRef: "room-reward-bounds.generated.json#roomClear",
      notes: "Includes the +10 boss/final clear adjustment. Terminal victory has no separate gold grant."
    }),
    goldSourceEntry({
      sourceId: "enemy-kill",
      legacySourceFile: "game.js",
      legacyFunctionOrConstant: "rewardForEnemy/killEnemy",
      authorityClass: "BOUNDED_CLIENT_ATTESTED",
      calculationInputs: ["enemy.type", "enemy.rewardBonus", "enemy.elite", "canonicalBuild"],
      serverKnownInputs: ["directive.roomType", "canonicalBuild"],
      clientAttestedInputs: ["enemy category", "count"],
      maximumPerRoomKnown: true,
      maximumPerRunKnown: true,
      stackingRules: "one grant per killed enemy; aggregate count bounded by envelope",
      roundingRules: "source-specific multiplier rounded before grantGold",
      appliedOrder: grantOrder,
      eligibleRoomTypes: allRunRooms.filter((id) => !["crossroads", "merchant"].includes(id)),
      generatedDataRef: "room-reward-bounds.generated.json#enemyClaims",
      notes: "The Worker cannot prove a local kill. A modified client can claim the envelope maximum."
    }),
    goldSourceEntry({
      sourceId: "elite-kill",
      legacySourceFile: "game.js",
      legacyFunctionOrConstant: "rewardForEnemy/MAX_ELITES_PER_ROOM",
      authorityClass: "BOUNDED_CLIENT_ATTESTED",
      calculationInputs: ["enemy.type", "enemy.rewardBonus", "eliteGoldMult"],
      serverKnownInputs: ["canonicalBuild"],
      clientAttestedInputs: ["elite category", "count"],
      maximumPerRoomKnown: true,
      maximumPerRunKnown: true,
      stackingRules: `maximum ${maximumElitesPerRoom} elites per room`,
      roundingRules: "elite and bounty multiplication then Math.round; grantGold rounds again",
      appliedOrder: grantOrder,
      eligibleRoomTypes: allRunRooms.filter((id) => !["crossroads", "merchant"].includes(id)),
      generatedDataRef: "room-reward-bounds.generated.json#eliteClaims",
      notes: "Elite affixes do not add gold independently; elite status changes the reward multiplier."
    }),
    goldSourceEntry({
      sourceId: "boss-kill",
      legacySourceFile: "game.js",
      legacyFunctionOrConstant: "rewardForEnemy(type=warden)",
      authorityClass: "BOUNDED_CLIENT_ATTESTED",
      calculationInputs: ["warden base 35", "bounty multiplier", "canonicalBuild"],
      serverKnownInputs: ["directive.roomType", "canonicalBuild"],
      clientAttestedInputs: ["boss defeated count"],
      maximumPerRoomKnown: true,
      maximumPerRunKnown: true,
      stackingRules: "one Warden claim in boss/final room",
      roundingRules: "bounty Math.round then grantGold Math.round",
      appliedOrder: grantOrder,
      eligibleRoomTypes: ["boss", "final"],
      generatedDataRef: "room-reward-bounds.generated.json#bossClaims",
      notes: "Boss room completion attestation does not prove the local kill sequence."
    }),
    goldSourceEntry({
      sourceId: "spike-kill-fallback",
      legacySourceFile: "game.js",
      legacyFunctionOrConstant: "tickEnemyBleeds/resolveEnemyHazardStep grantGold(1)",
      authorityClass: "BOUNDED_CLIENT_ATTESTED",
      calculationInputs: ["hazard kill count", "canonicalBuild"],
      serverKnownInputs: ["canonicalBuild"],
      clientAttestedInputs: ["hazard kill count"],
      maximumPerRoomKnown: true,
      maximumPerRunKnown: true,
      stackingRules: "shares the room enemy-count budget",
      roundingRules: "grantGold rounding",
      appliedOrder: grantOrder,
      eligibleRoomTypes: allRunRooms.filter((id) => !["crossroads", "merchant"].includes(id)),
      generatedDataRef: "room-reward-bounds.generated.json#hazardClaims",
      notes: "Legacy grants 1 instead of rewardForEnemy when spikes finish an enemy."
    }),
    ...[
      ["chest-gold", "openChest outcome=gold", "BOUNDED_CLIENT_ATTESTED", "standard or treasure chest random 4..8"],
      ["chest-stat-cap-fallback", "applyChestCapFallback", "BOUNDED_CLIENT_ATTESTED", "ATK/ARM/HP cap fallback may become gold"],
      ["chest-alchemist-fallback", "openChest Alchemist health/healing branches", "BOUNDED_CLIENT_ATTESTED", "random 2..5"],
      ["chest-avarice-potion-fallback", "openChest Pact of Avarice potion branch", "BOUNDED_CLIENT_ATTESTED", "random 2..5"],
      ["chest-shrine-ward-conversion", "rollChestOutcome trap+Shrine Ward", "BOUNDED_CLIENT_ATTESTED", "converted trap follows gold outcome"],
      ["vault-chest-bonus", "openChest roomType=vault grantGold(50)", "BOUNDED_CLIENT_ATTESTED", "added once for each surviving opened vault chest"]
    ].map(([sourceId, symbol, authorityClass, notes]) => goldSourceEntry({
      sourceId,
      legacySourceFile: sourceId === "chest-shrine-ward-conversion" ? "loot-tables.js" : "game.js",
      legacyFunctionOrConstant: symbol,
      authorityClass,
      calculationInputs: ["claim slot", "chest outcome", "canonicalBuild"],
      serverKnownInputs: ["directive.roomType", "canonicalBuild", "issued claim slots"],
      clientAttestedInputs: ["slot ID", "outcome category"],
      maximumPerRoomKnown: true,
      maximumPerRunKnown: true,
      stackingRules: "each issued slot can be consumed once",
      roundingRules: "source amount then Treasure Sense where applicable; grantGold Math.round",
      appliedOrder: grantOrder,
      eligibleRoomTypes: allRunRooms.filter((id) => !["crossroads", "merchant", "otter", "arena"].includes(id)),
      generatedDataRef: "chest-reward-bounds.generated.json",
      notes
    })),
    ...[
      ["crossroads-power-empty", "openCrossroadsPowerChest grantGold(80)", ["crossroads"], "empty relic draft only"],
      ["crossroads-mercy-avarice", "openCrossroadsMercyChest", ["crossroads"], `${avaricePotionGold} per empty potion slot under Avarice`],
      ["arena-cache-empty", "openStoredRelicChest grantGold(60)", ["arena"], "empty generated relic cache only"],
      ["otter-crimson-empty", "openChest otter_red grantGold(50)", ["otter"], "empty generated relic offer only"]
    ].map(([sourceId, symbol, eligibleRoomTypes, notes]) => goldSourceEntry({
      sourceId,
      legacySourceFile: "game.js",
      legacyFunctionOrConstant: symbol,
      authorityClass: ["arena-cache-empty", "otter-crimson-empty"].includes(sourceId)
        ? "SERVER_DERIVED"
        : "HEURISTIC_ONLY",
      calculationInputs: ["canonical reward slot", "canonical offer resolution", "canonicalBuild"],
      serverKnownInputs: [
        "directive.roomType",
        "canonicalBuild",
        "canonical reward slot",
        "canonical stored choices"
      ],
      clientAttestedInputs: ["arena-cache-empty", "otter-crimson-empty"].includes(sourceId)
        ? []
        : ["fallback occurred"],
      maximumPerRoomKnown: true,
      maximumPerRunKnown: true,
      stackingRules: "at most one special cache/chest",
      roundingRules: "grantGold Math.round",
      appliedOrder: grantOrder,
      eligibleRoomTypes,
      generatedDataRef: ["arena-cache-empty", "otter-crimson-empty"].includes(sourceId)
        ? "relic-reward-fallback-policy.generated.json"
        : "room-reward-bounds.generated.json#deferredFallbacks",
      notes: ["arena-cache-empty", "otter-crimson-empty"].includes(sourceId)
        ? `${notes}; server-derived in Phase 3B2C3A only from a canonical stored reward.`
        : `${notes}; not awarded in Phase 3B2A because offer state is deferred.`
    })),
    goldSourceEntry({
      sourceId: "void-reaper-crit-kill",
      legacySourceFile: "game.js",
      legacyFunctionOrConstant: "VOID_REAPER_CRIT_KILL_GOLD/killEnemy",
      authorityClass: "HEURISTIC_ONLY",
      calculationInputs: ["crit kill sequence", "Void Reaper ownership"],
      serverKnownInputs: ["canonicalBuild"],
      clientAttestedInputs: ["crit kill proc count"],
      maximumPerRoomKnown: true,
      maximumPerRunKnown: true,
      stackingRules: "one proc per eligible crit kill",
      roundingRules: "grantGold Math.round",
      appliedOrder: grantOrder,
      eligibleRoomTypes: allRunRooms,
      generatedDataRef: "gold-modifiers.generated.json#procRelics",
      notes: `Legacy base ${voidReaperGold}; exact crit/HP state is not proven and no gold is awarded in Phase 3B2A.`
    }),
    goldSourceEntry({
      sourceId: "chaos-orb-gold-roll",
      legacySourceFile: "game.js",
      legacyFunctionOrConstant: "CHAOS_ORB_ROLL_INTERVAL/CHAOS_ORB_GOLD_BONUS",
      authorityClass: "HEURISTIC_ONLY",
      calculationInputs: ["turn sequence", "Chaos Orb roll"],
      serverKnownInputs: ["canonicalBuild"],
      clientAttestedInputs: ["proc count"],
      maximumPerRoomKnown: false,
      maximumPerRunKnown: false,
      stackingRules: "every 10 local turns; one of six outcomes",
      roundingRules: "applyMultiplier=false; Math.round only",
      appliedOrder: ["base amount", "Math.round", "minimum positive grant of 1"],
      eligibleRoomTypes: allRunRooms,
      generatedDataRef: "gold-modifiers.generated.json#procRelics",
      notes: `Legacy base ${chaosOrbGold}; unbounded local turn inflation prevents a safe reward claim.`
    }),
    goldSourceEntry({
      sourceId: "merchant-buyback",
      legacySourceFile: "camp-runtime.js",
      legacyFunctionOrConstant: "confirmMerchantBuyback",
      authorityClass: "SERVER_DERIVED",
      calculationInputs: ["server-owned relic", "server-issued buyback quote"],
      serverKnownInputs: ["canonical inventory", "pending server quote"],
      maximumPerRoomKnown: false,
      maximumPerRunKnown: false,
      stackingRules: "transactional; consumes one relic",
      roundingRules: "integer payout",
      appliedOrder: ["validate quote", "consume relic", "add payout"],
      eligibleRoomTypes: ["merchant"],
      generatedDataRef: null,
      notes: "Inventory only. Merchant transactions are explicitly deferred beyond Phase 3B2A."
    }),
    goldSourceEntry({
      sourceId: "merchant-spend",
      legacySourceFile: "camp-runtime.js",
      legacyFunctionOrConstant: "spendMerchantUpgradeGold",
      authorityClass: "SERVER_DERIVED",
      calculationInputs: ["server-issued price", "canonical run wallet"],
      serverKnownInputs: ["pending transaction", "gold"],
      maximumPerRoomKnown: false,
      maximumPerRunKnown: false,
      stackingRules: "transactional debit; cannot make gold negative",
      roundingRules: "integer cost",
      appliedOrder: ["validate purchase", "debit run gold then camp gold"],
      eligibleRoomTypes: ["merchant"],
      generatedDataRef: null,
      notes: "Sink inventory only. Not implemented in Phase 3B2A."
    }),
    goldSourceEntry({
      sourceId: "extract-transfer",
      legacySourceFile: "game.js",
      legacyFunctionOrConstant: "extractRun",
      authorityClass: "SERVER_DERIVED",
      calculationInputs: ["canonical run gold", "extract mode"],
      serverKnownInputs: ["gold", "room completion", "emergency_stash level"],
      maximumPerRoomKnown: true,
      maximumPerRunKnown: true,
      stackingRules: "terminates run; transfers or loses existing gold, does not earn run gold",
      roundingRules: "full extract uses rounded gold; emergency extract uses floor",
      appliedOrder: ["resolve loss ratio", "transfer retained amount", "clear run wallet"],
      eligibleRoomTypes: allRunRooms,
      generatedDataRef: null,
      notes: "Inventory only. Extract and Camp ledger are deferred."
    }),
    ...[
      ["shrine-direct-gold", "useShrine/rollShrineOutcome", ["shrine"], "no direct gold grant in active v0.8"],
      ["forge-direct-gold", "forge-room interaction", ["forge"], "no direct gold grant; guardian and room-clear sources still apply"],
      ["pact-room-direct-gold", "pact-room interaction", ["pact"], "no direct award; Avarice is a modifier"],
      ["terminal-victory-direct-gold", "triggerDepth100Victory", ["final"], "no separate terminal award; boss/enemy and room-clear sources apply"],
      ["elite-affix-direct-gold", "applyEliteAffix", allRunRooms, "affixes add no independent gold; elite status is inventoried separately"]
    ].map(([sourceId, symbol, eligibleRoomTypes, notes]) => goldSourceEntry({
      sourceId,
      legacySourceFile: sourceId === "pact-room-direct-gold" ? "pact-room.js" : "game.js",
      legacyFunctionOrConstant: symbol,
      authorityClass: "SERVER_DERIVED",
      calculationInputs: [],
      serverKnownInputs: ["directive.roomType"],
      maximumPerRoomKnown: true,
      maximumPerRunKnown: true,
      stackingRules: "zero direct award",
      roundingRules: "not-applicable",
      appliedOrder: [],
      eligibleRoomTypes,
      generatedDataRef: "gold-sources.generated.json",
      notes
    })),
    goldSourceEntry({
      sourceId: "debug-cheat-gold",
      legacySourceFile: "game.js",
      legacyFunctionOrConstant: "debug +100 gold / Observer Bot unlimited gold",
      authorityClass: "CLIENT_ONLY",
      calculationInputs: ["local debug state"],
      clientAttestedInputs: ["none accepted online"],
      maximumPerRoomKnown: false,
      maximumPerRunKnown: false,
      stackingRules: "excluded from Online v3",
      roundingRules: "not-applicable",
      appliedOrder: [],
      eligibleRoomTypes: [],
      generatedDataRef: "gold-sources.generated.json",
      notes: "Active local diagnostic behavior, explicitly noncanonical and never claimable."
    })
  ].sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  const grantGoldCallArguments = Array.from(
    gameSource.matchAll(/\bgrantGold\(([^;\r\n]*)\)/gu),
    (match) => match[1].replace(/\s+/gu, " ").trim()
  ).filter((argument) => argument !== "amount, options = {}").sort();
  const classifiedGrantGoldCallArguments = [
    "100, { applyMultiplier: false }",
    "1",
    "1",
    "80",
    "50",
    "50",
    "60",
    "CHAOS_ORB_GOLD_BONUS, { applyMultiplier: false }",
    "VOID_REAPER_CRIT_KILL_GOLD",
    "emptyPotionSlots * CROSSROADS_MERCY_AVARICE_GOLD_PER_POTION",
    "goldBonus",
    "randInt(2, 5)",
    "randInt(2, 5)",
    "randInt(2, 5)",
    "raw",
    "rawGold",
    "rewardForEnemy(enemy)"
  ].sort();
  if (canonicalJson(grantGoldCallArguments) !== canonicalJson(classifiedGrantGoldCallArguments)) {
    throw new Error("UNCLASSIFIED_ACTIVE_GOLD_SOURCE:game.js:grantGold");
  }

  const authorityClasses = Object.fromEntries(
    ["SERVER_DERIVED", "SERVER_ISSUED", "BOUNDED_CLIENT_ATTESTED", "HEURISTIC_ONLY", "CLIENT_ONLY"]
      .map((authorityClass) => [
        authorityClass,
        goldSources.filter((entry) => entry.authorityClass === authorityClass).length
      ])
  );
  const goldSourcesData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, goldSourceFiles),
    canonicalData: {
      inventoryCompletenessMarkers: [
        "function grantGold",
        "state.player.gold = Math.max(0, Number(state.player.gold) || 0) + payout",
        "state.player.gold -= fromRun",
        "state.player.gold = keptGold",
        "OBSERVER_BOT_UNLIMITED_GOLD"
      ],
      grantGoldCallArguments,
      authorityClasses,
      goldSources
    }
  };
  const goldModifiersData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, [
      "game.js",
      "camp-data.js",
      "mutator-data.js",
      "relic-data.js",
      "pact-room.js"
    ]),
    canonicalData: {
      maximumRelicSlots: maxRelics,
      maximumNormalRelicStack: maxNormalRelicStack,
      legalRelicIds: [...new Set(relicIds)].sort(),
      presentationOnlyFixtureRelicIds: [...new Set(relicIds)]
        .filter((id) => !["idol", "voidreaper", "chaosorb"].includes(id))
        .sort(),
      legalMutatorIds: mutatorIds.sort(),
      legalPactIds: ["avarice"],
      legalCampUpgradeIds: ["treasure_sense", "bounty_contract"],
      modifiers: [
        { id: "golden-idol", buildPath: "relics", buildId: "idol", perStackAdditive: goldenIdolBonus, stackCap: 1, appliesTo: ["multiplied-grant"] },
        { id: "run-modifier-global-gold", effectPath: "goldMultiplierAdditive", generatedDataRef: "run-modifier-effects.generated.json", appliesTo: ["multiplied-grant"] },
        { id: "run-modifier-elite-gold", effectPath: "eliteGoldMultiplier", generatedDataRef: "run-modifier-effects.generated.json", appliesTo: ["elite-kill"] },
        { id: "avarice", buildPath: "pacts", buildId: "avarice", multiplicative: 1.4, stackCap: 1, appliesTo: ["multiplied-grant"] },
        { id: "treasure-sense", buildPath: "campUpgrades.treasure_sense", multiplicativePerLevel: 0.1, levelCap: campUpgradeCaps.treasure_sense, appliesTo: ["chest-base"] },
        { id: "bounty-contract", buildPath: "campUpgrades.bounty_contract", multiplicativePerLevel: 0.1, levelCap: campUpgradeCaps.bounty_contract, appliesTo: ["enemy-base"] }
      ],
      roundingOrder: grantOrder,
      procRelics: [
        { id: "voidreaper", sourceId: "void-reaper-crit-kill", baseGold: voidReaperGold, phase3b2aAuthority: "HEURISTIC_ONLY" },
        { id: "chaosorb", sourceId: "chaos-orb-gold-roll", baseGold: chaosOrbGold, applyMultiplier: false, phase3b2aAuthority: "HEURISTIC_ONLY" }
      ]
    }
  };
  const enemyBase = {
    slime: 2,
    skeleton: 3,
    brute: 4,
    skitter: 4,
    acolyte: 5,
    totem: 6,
    riftweaver: 7,
    bulwark: 9,
    guardian: 16,
    blacksmith_guardian: 20,
    otter: 25,
    warden: 35
  };
  const maximumEnemiesByRoom = Object.fromEntries(
    roomTypes.filter((entry) => entry.scheduleEligible).map((entry) => [
      entry.id,
      entry.id === "merchant" || entry.id === "crossroads"
        ? 0
        : entry.id === "otter"
          ? maximumOtterEnemies
          : entry.id === "arena"
            ? 14
            : entry.id === "boss" || entry.id === "final"
              ? 5
              : entry.id === "duel" || entry.id === "forge" || entry.id === "vault"
                ? 1
                : entry.id === "horde"
                  ? 9
                  : 9
    ])
  );
  const roomRewardBoundsData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, ["game.js", "camp-data.js", "mutator-data.js"]),
    canonicalData: {
      policyVersion: "v08-gold-claims-1",
      roomClear: {
        baseFormula: "2 + floor(depth / 2)",
        excludedRoomTypes: ["crossroads", "merchant"],
        adjustments: { treasure: -1, vault: -2, shrine: 1, cursed: 4, bossOrFinal: 10 },
        minimum: 1,
        maximumBaseAtDepth100: 62
      },
      enemyClaims: {
        baseGoldByEnemyType: enemyBase,
        maximumEnemiesByRoom,
        maximumElitesPerRoom,
        rewardBonusByRoom: { horde: 1, duel: 10, arena: 2 },
        duplicatePolicy: "REJECT_DUPLICATE_CLAIM_ID"
      },
      bossClaims: { claimId: "enemy:warden", maximumCount: 1, requiredRoomTypes: ["boss", "final"] },
      hazardClaims: { claimId: "hazard-kill", unitBaseGold: 1, sharesEnemyBudget: true },
      telemetryBounds: { minimumElapsedMs: 100, minimumTurnCount: 0, maximumTurnCount: 100000 },
      boundedHistoryLimit: 64,
      maximumGoldDeltaHardCap: 10000,
      deferredFallbacks: ["crossroads-power-empty", "crossroads-mercy-avarice", "arena-cache-empty", "otter-crimson-empty"]
    }
  };
  const chestRewardBoundsData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, ["game.js", "loot-tables.js", "camp-data.js"]),
    canonicalData: {
      maximumChestSlotsByRoom: {
        arena: 1,
        boss: 2,
        combat: 2,
        cursed: 1,
        duel: 1,
        final: 2,
        forge: 0,
        horde: 1,
        merchant: 0,
        otter: 1,
        pact: 0,
        shrine: 1,
        treasure: 3,
        vault: 10,
        ambush: 1,
        crossroads: 1
      },
      standardGoldBase: { minimum: 4, maximum: 8 },
      treasureMultiplier: 6,
      alchemistFallbackBase: { minimum: 2, maximum: 5 },
      avaricePotionFallbackBase: { minimum: 2, maximum: 5 },
      vaultBonusBase: 50,
      specialFallbackBase: { arena: 60, crossroads: 80, otter: 50 },
      slotPolicy: "opaque sequential slots; no physical coordinates; consume at most once"
    }
  };
  const metaTransactionPolicyData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, [
      "game.js",
      "camp-data.js",
      "camp-runtime.js",
      "forge-room.js",
      "pact-room.js"
    ]),
    canonicalData: {
      policyVersion: "v08-meta-transaction-1",
      authority: "SERVER_ISSUED_AND_DERIVED",
      bindingFields: [
        "runId",
        "rulesetHash",
        "revision",
        "stateDigest",
        "buildDigest",
        "sourceInstanceId",
        "offerId",
        "transactionId",
        "choiceId"
      ],
      requestFields: ["transactionId", "choiceId"],
      receiptHistoryLimit: 64,
      exactRetry: "RETURN_CURRENT_CANONICAL_STATE_WITHOUT_REAPPLY",
      conflictingRetry: "REJECT_PAYLOAD_MISMATCH",
      mutationModel: "IMMUTABLE_CLONE_EVALUATE_ATOMIC_COMMIT",
      canonicalLedgers: [
        "goldLedger",
        "build",
        "pendingInventory",
        "offerSettlementHistory",
        "rewardSettlementHistory",
        "relicReplacementHistory",
        "relicFallbackHistory"
      ],
      clientUntrustedFields: [
        "price",
        "amount",
        "gold",
        "target",
        "rarity",
        "stacks",
        "rngResult",
        "resultingBuild",
        "resultingState"
      ]
    }
  };
  const merchantSource = textByFile.get("game.js");
  const merchantRuntimeSource = textByFile.get("camp-runtime.js");
  const merchantSkillsSource = textByFile.get("skills-data.js");
  for (const marker of [
    "const MERCHANT_RESERVE_DEPOSIT_RATIO = 0.25;",
    "const MERCHANT_BUYBACK_RATIO = 0.5;",
    "if (state.lives < MAX_LIVES && Math.random() < 0.10)",
    "const base = Math.min(50, 10 * (bought + 1));"
  ]) {
    if (!merchantSource.includes(marker)) {
      throw new Error(`SOURCE_SYMBOL_MISSING:game.js:${marker}`);
    }
  }
  for (const marker of [
    "function tryBuyRelicFromMerchant()",
    "function tryReserveRelicFromMerchant()",
    "function tryBuyReservedRelicFromMerchant()",
    "function tryUseBlackMarket(relicId)",
    "function trySellRelicToMerchant(relicId)"
  ]) {
    if (!merchantRuntimeSource.includes(marker)) {
      throw new Error(`SOURCE_SYMBOL_MISSING:camp-runtime.js:${marker}`);
    }
  }
  if (!merchantSkillsSource.includes("const MERCHANT_SKILL_UPGRADES =")) {
    throw new Error("SOURCE_SYMBOL_MISSING:skills-data.js:MERCHANT_SKILL_UPGRADES");
  }
  const merchantTransactionPolicyData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, [
      "game.js",
      "camp-runtime.js",
      "merchant-curation.js",
      "relic-data.js",
      "relic-runtime.js",
      "skills-data.js"
    ]),
    canonicalData: {
      policyVersion: "v08-merchant-transaction-1",
      implementationStatus: "m1-disconnected-test-only",
      trigger: "cleared merchant room; player interacts with Merchant",
      relicTiers: [
        { rarity: "normal", weight: 60, price: 300 },
        { rarity: "rare", weight: 25, price: 600 },
        { rarity: "epic", weight: 12, price: 1000 },
        { rarity: "legendary", weight: 3, price: 2000 }
      ],
      relicReturnValues: [
        { rarity: "normal", value: 50 },
        { rarity: "rare", value: 100 },
        { rarity: "epic", value: 200 },
        { rarity: "legendary", value: 400 },
        { rarity: "mythic", value: 800 }
      ],
      reservationDepositRatio: 0.25,
      reservationDepositRefundable: false,
      buybackRatio: 0.5,
      maximumLives: 5,
      maximumSecondChancePurchases: 5,
      maximumSkillTier: 3,
      legendarySkillRequiredDepth: 20,
      skillUpgrades: {
        dash: [
          { tier: 1, cost: 400 },
          { tier: 2, cost: 800 },
          { tier: 3, cost: 1600 }
        ],
        aoe: [
          { tier: 1, cost: 600 },
          { tier: 2, cost: 1200 },
          { tier: 3, cost: 2400 }
        ],
        shield: [
          { tier: 1, cost: 300 },
          { tier: 2, cost: 600 },
          { tier: 3, cost: 1200 }
        ]
      },
      services: [
        { id: "fullheal", baseCost: 150 },
        { id: "combatboost", baseCost: 200 },
        { id: "secondchance", baseCost: 800 },
        { id: "blackmarket", baseCost: 0 }
      ],
      extraLifeService: { id: "onelife", baseCost: 2000, chance: 0.1 },
      potionPrice: {
        sequence: [10, 20, 30, 40, 50],
        cap: 50,
        avariceMultiplier: 2
      },
      merchantFavorDiscounts: {
        merchfavor1: 0.15,
        merchfavor: 0.30,
        merchfavor3: 0.45
      },
      rngPurposes: [
        "merchant/relic-rarity",
        "merchant/relic-candidate",
        "merchant/service-life",
        "merchant/service-choice",
        "merchant/black-market-result"
      ],
      consumption: {
        relicSlot: "purchase or reservation",
        serviceSlot: "successful service",
        reservationDeposit: "on reservation; never refunded",
        buyback: "one canonical relic stack",
        blackMarket: "target removed only with atomic replacement"
      },
      replacementPolicy: "canonical evaluateRelicAcquisition and replacement build",
      sourceEvidence: [
        "game.js:MERCHANT_RELIC_TIERS/generateMerchantSlots",
        "game.js:merchantPotionCost/merchantSkillUpgradeCost",
        "camp-runtime.js:spendMerchantUpgradeGold",
        "camp-runtime.js:tryBuyRelicFromMerchant/tryBuyReservedRelicFromMerchant",
        "camp-runtime.js:tryUseBlackMarket/trySellRelicToMerchant",
        "skills-data.js:MERCHANT_SKILL_UPGRADES"
      ]
    }
  };
  const forgeSource = textByFile.get("forge-room.js");
  for (const marker of [
    "function planForgeTemper(options = {})",
    "function planForgeTransmute(options = {})",
    "if (i === 0)",
    "const targetCount = Math.max(1, Math.floor(Number(options.count) || 3));",
    "const usedIds = new Set([String(sacrificedRelic?.id || \"\")]);"
  ]) {
    if (!forgeSource.includes(marker)) {
      throw new Error(`SOURCE_SYMBOL_MISSING:forge-room.js:${marker}`);
    }
  }
  for (const marker of [
    "function executeForgeTemper()",
    "function executeForgeTransmute(relicIndex)",
    "state.forge.used = true;",
    "state.forgeTransmutePending = { sacrificedRelicId };"
  ]) {
    if (!merchantSource.includes(marker)) {
      throw new Error(`SOURCE_SYMBOL_MISSING:game.js:${marker}`);
    }
  }
  const forgeTransactionPolicyData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, [
      "game.js",
      "forge-room.js",
      "relic-data.js",
      "relic-runtime.js"
    ]),
    canonicalData: {
      policyVersion: "v08-forge-transaction-1",
      implementationStatus: "m1-disconnected-test-only",
      trigger: "cleared Forge room after Blacksmith Guardian; interact with unused Forge",
      cost: { amount: 0, currency: "run_gold" },
      profiles: [
        {
          minDepth: 0,
          label: "Tempered",
          choiceCount: 1,
          rarityWeights: { rare: 0.72, epic: 0.28 },
          allowedRarities: ["rare", "epic"]
        },
        {
          minDepth: 20,
          label: "Masterwork",
          choiceCount: 1,
          rarityWeights: { rare: 0.25, epic: 0.55, legendary: 0.20 },
          allowedRarities: ["rare", "epic", "legendary"]
        },
        {
          minDepth: 40,
          label: "Mythforged",
          choiceCount: 1,
          rarityWeights: { epic: 0.58, legendary: 0.39, mythic: 0.03 },
          allowedRarities: ["epic", "legendary", "mythic"]
        }
      ],
      temper: {
        selection: "uniform first choice from full legal profile pool",
        outputCount: 1,
        consumption: "Forge consumed when a non-empty offer opens",
        cancel: "offered relic is lost; Forge remains consumed",
        emptyPool: "no reward and Forge remains unused"
      },
      transmute: {
        outputCount: 3,
        target: "one canonical owned relic stack",
        rarity: "weighted allowed rarity at or above sacrificed rarity",
        fallback: "full legal allowed-rarity pool when preferred rarity is empty",
        uniqueOutputs: true,
        consumption: "Forge consumed when at least one output opens",
        cancel: "sacrificed relic retained; Forge remains consumed",
        atomicCommit: "remove one source stack and acquire one canonical result"
      },
      rngPurposes: [
        "forge/temper-candidate",
        "forge/transmute-rarity",
        "forge/transmute-candidate"
      ],
      replacementPolicy: "Temper reuses canonical acquisition/replacement; Transmute validates final build after atomic sacrifice",
      sourceEvidence: [
        "forge-room.js:FORGE_PROFILES/planForgeTemper/planForgeTransmute",
        "game.js:executeForgeTemper/executeForgeTransmute",
        "game.js:chooseRelic forgeTransmutePending branch"
      ]
    }
  };
  for (const marker of [
    "const CROSSROADS_POWER_HP_COST_MULTIPLIER = 0.15;",
    "const CROSSROADS_POWER_DURATION_TURNS = 100;",
    "function armCrossroadsPowerConfirmation(chest)",
    "function openCrossroadsPowerChest(chest)",
    "function openCrossroadsMercyChest(chest)",
    "const fallbackGold = grantGold(80);",
    "emptyPotionSlots * CROSSROADS_MERCY_AVARICE_GOLD_PER_POTION"
  ]) {
    if (!merchantSource.includes(marker)) {
      throw new Error(`SOURCE_SYMBOL_MISSING:game.js:${marker}`);
    }
  }
  const crossroadsTransactionPolicyData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, [
      "game.js",
      "relic-data.js",
      "relic-runtime.js"
    ]),
    canonicalData: {
      policyVersion: "v08-crossroads-transaction-1",
      implementationStatus: "m1-disconnected-test-only",
      trigger: "Crossroads room exposes mutually exclusive POWER and MERCY chests",
      power: {
        requiresConfirmation: true,
        maxHpCostMultiplier: 0.15,
        minimumMaxHpCost: 1,
        durationTurns: 100,
        eligibleRarities: ["epic", "legendary", "mythic"],
        baseChoiceCount: 3,
        extraChoiceSource: "canonical run modifier extraRelicChoices",
        emptyPoolFallback: {
          baseGold: 80,
          sourceId: "crossroads-power-empty",
          applyGoldModifiers: true
        },
        cancelAfterConfirmation: "penalty remains and no relic is acquired"
      },
      mercy: {
        requiresConfirmation: false,
        heal: "to canonical maximum HP",
        cooldowns: "reset every canonical skill cooldown",
        potions: "refill every empty slot",
        avarice: {
          suppressPotionRefill: true,
          baseGoldPerEmptySlot: 12,
          sourceId: "crossroads-mercy-avarice",
          applyGoldModifiers: true
        }
      },
      mutualExclusion: "committing either source choice consumes the Crossroads source once",
      rngPurposes: [
        "crossroads/power-rarity",
        "crossroads/power-candidate"
      ],
      replacementPolicy: "POWER reuses canonical acquisition/replacement; fallback only for zero canonical choices",
      sourceEvidence: [
        "game.js:armCrossroadsPowerConfirmation/openCrossroadsPowerChest",
        "game.js:openCrossroadsMercyChest/closeOtherCrossroadsChest",
        "game.js:CROSSROADS_POWER_HP_COST_MULTIPLIER/CROSSROADS_POWER_DURATION_TURNS"
      ]
    }
  };
  const campSource = textByFile.get("camp-data.js");
  const elixirSource = textByFile.get("elixir-data.js");
  const pactTransactionSource = textByFile.get("pact-room.js");
  for (const marker of [
    "function buyCampUpgrade(index)",
    "function buyOrRefillElixir(elixirId)",
    "function discardElixirLoadout()",
    "function sellCampRelicAtIndex(index)",
    "state.campVisitShopCostMult = Number(state.runMods?.shopCostMult) || 1;"
  ]) {
    if (!merchantSource.includes(marker)) {
      throw new Error(`SOURCE_SYMBOL_MISSING:game.js:${marker}`);
    }
  }
  for (const marker of ["baseCost: 30", "costGrowth: 1.4", "max: 20"]) {
    if (!campSource.includes(marker)) {
      throw new Error(`SOURCE_SYMBOL_MISSING:camp-data.js:${marker}`);
    }
  }
  for (const marker of [
    "const ELIXIR_STACK_MAX = 5;",
    "const ELIXIR_DURATION_TURNS = 5;",
    "const ELIXIR_DISCARD_REFUND_RATIO = 0.5;"
  ]) {
    if (!elixirSource.includes(marker)) {
      throw new Error(`SOURCE_SYMBOL_MISSING:elixir-data.js:${marker}`);
    }
  }
  const campTransactionPolicyData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, [
      "game.js",
      "camp-data.js",
      "elixir-data.js",
      "relic-data.js",
      "relic-runtime.js"
    ]),
    canonicalData: {
      policyVersion: "v08-camp-transaction-1",
      implementationStatus: "m1-disconnected-test-only",
      currency: "camp_gold",
      visitMultiplier: "freeze canonical run shopCostMult on Camp entry",
      upgrades: [
        { id: "vitality", baseCost: 30, costGrowth: 1.4, max: 20 },
        { id: "blade", baseCost: 30, costGrowth: 1.4, max: 15 },
        { id: "satchel", baseCost: 15, costGrowth: 1.4, max: 6 },
        { id: "guard", baseCost: 30, costGrowth: 1.4, max: 15 },
        { id: "auto_potion", baseCost: 600, costGrowth: 1.4, max: 1 },
        { id: "potion_strength", baseCost: 80, costGrowth: 1.4, max: 5 },
        { id: "crit_chance", baseCost: 100, costGrowth: 1.4, max: 4 },
        { id: "treasure_sense", baseCost: 80, costGrowth: 1.4, max: 5 },
        { id: "emergency_stash", baseCost: 120, costGrowth: 1.4, max: 3 },
        { id: "bounty_contract", baseCost: 70, costGrowth: 1.4, max: 5 }
      ],
      elixirs: [
        { id: "iron_1", tier: 1, unlockDepth: 0, cost: 75 },
        { id: "fury_1", tier: 1, unlockDepth: 0, cost: 75 },
        { id: "focus_1", tier: 1, unlockDepth: 0, cost: 75 },
        { id: "iron_2", tier: 2, unlockDepth: 20, cost: 200 },
        { id: "fury_2", tier: 2, unlockDepth: 20, cost: 200 },
        { id: "focus_2", tier: 2, unlockDepth: 20, cost: 200 },
        { id: "iron_3", tier: 3, unlockDepth: 40, cost: 500 },
        { id: "fury_3", tier: 3, unlockDepth: 40, cost: 500 },
        { id: "focus_3", tier: 3, unlockDepth: 40, cost: 500 }
      ],
      elixirStackMaximum: 5,
      elixirDurationTurns: 5,
      elixirRefillCost: "ceil(baseCost * missingCharges / 5)",
      elixirDiscardRefundRatio: 0.5,
      relicReturnValues: {
        normal: 50,
        rare: 100,
        epic: 200,
        legendary: 400,
        mythic: 800
      },
      relicSale: "two-step UI confirmation; transaction consumes one canonical stack",
      sourceEvidence: [
        "camp-data.js:CAMP_UPGRADES",
        "game.js:getCampUpgradeCost/buyCampUpgrade",
        "elixir-data.js:ELIXIRS/ELIXIR_STACK_MAX/ELIXIR_DISCARD_REFUND_RATIO",
        "game.js:buyOrRefillElixir/discardElixirLoadout/sellCampRelicAtIndex"
      ]
    }
  };
  for (const marker of [
    "function choosePactOffers(options = {})",
    "const count = Math.max(1, Math.floor(Number(options.count) || 2));",
    "if (depth < pact.minDepth) return false;",
    "if (active.has(pact.id)) return false;"
  ]) {
    if (!pactTransactionSource.includes(marker)) {
      throw new Error(`SOURCE_SYMBOL_MISSING:pact-room.js:${marker}`);
    }
  }
  const pactTransactionPolicyData = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, ["game.js", "pact-room.js"]),
    canonicalData: {
      policyVersion: "v08-pact-transaction-1",
      implementationStatus: "m1-disconnected-test-only",
      trigger: "cleared eligible Pact room; interact with unused sigil",
      offerCount: 2,
      selection: "uniform without replacement from depth-eligible non-active pacts",
      maximumActivePacts: 1,
      pacts: [
        { id: "hunger", minDepth: 25 },
        { id: "precision", minDepth: 25 },
        { id: "velocity", minDepth: 25 },
        { id: "avarice", minDepth: 30 },
        { id: "iron", minDepth: 25 },
        { id: "blood", minDepth: 30 },
        { id: "ruin", minDepth: 35 },
        { id: "silence", minDepth: 35 },
        { id: "cinders", minDepth: 40 },
        { id: "hunt", minDepth: 45 },
        { id: "chains", minDepth: 40 }
      ],
      apply: "selected pact replaces the current pact and consumes the room",
      break: "available only with a current pact; clears it and consumes the room",
      leave: "available only without a current pact; closes prompt without consuming the room",
      cost: { amount: 0, currency: "none" },
      rngPurposes: ["pact/candidate"],
      sourceEvidence: [
        "pact-room.js:PACTS/choosePactOffers/isPactValid",
        "game.js:openPactRoom/applyPactChoice/breakCurrentPact/closePactPrompt"
      ]
    }
  };
  const sourceManifest = {
    schemaVersion: 3,
    rulesetId: RULESET_ID,
    sourceCommit,
    purpose: "Online v3 test-only canonical room, gold, relic, replacement, fallback, run modifier, Arena, and Milestone M1 meta-transaction policies",
    sources: records
  };
  const fallbackSource = textByFile.get("game.js");
  for (const marker of [
    "if (choices.length === 0) return;",
    "if (choices.length <= 0) return false;",
    "const fallbackGold = grantGold(60);",
    "const fallbackGold = grantGold(50);",
    "const scaled = applyMultiplier",
    "state.runMods.goldMultiplier * getPactGoldGainMultiplier()"
  ]) {
    if (!fallbackSource.includes(marker)) {
      throw new Error(`SOURCE_SYMBOL_MISSING:game.js:${marker}`);
    }
  }
  const relicRewardFallbackPolicy = {
    schemaVersion: 1,
    rulesetId: RULESET_ID,
    sourceCommit,
    sources: sourceRefs(records, ["game.js", "relic-data.js", "relic-runtime.js"]),
    canonicalData: {
      policyVersion: "v08-relic-reward-fallback-1",
      securityDivergence: "ONLINE_V3_SECURITY_DIVERGENCE",
      historyLimit: 64,
      sources: [
        {
          sourceType: "regular_relic",
          sourceId: "warden-standard-drop",
          availabilityMode: "pre_offer",
          emptyCandidatePoolOutcome: "NO_REWARD",
          storedRewardEmptyPolicyId: null
        },
        {
          sourceType: "regular_relic",
          sourceId: "otter-crimson-chest",
          availabilityMode: "pre_offer",
          emptyCandidatePoolOutcome: "NO_REWARD",
          storedRewardEmptyPolicyId: "OTTER_CRIMSON_STORED_EMPTY_GOLD_V08"
        },
        {
          sourceType: "stored_relic_chest",
          sourceId: "otter-crimson-chest",
          availabilityMode: "stored_reward",
          emptyCandidatePoolOutcome: "NO_REWARD",
          storedRewardEmptyPolicyId: "OTTER_CRIMSON_STORED_EMPTY_GOLD_V08"
        },
        {
          sourceType: "arena",
          sourceId: "arena-reward-cache",
          availabilityMode: "pre_offer",
          emptyCandidatePoolOutcome: "NO_REWARD",
          storedRewardEmptyPolicyId: "ARENA_STORED_CACHE_EMPTY_GOLD_V08"
        },
        {
          sourceType: "stored_relic_chest",
          sourceId: "arena-reward-cache",
          availabilityMode: "future_arena_spec",
          emptyCandidatePoolOutcome: "NO_REWARD",
          storedRewardEmptyPolicyId: "ARENA_STORED_CACHE_EMPTY_GOLD_V08"
        }
      ],
      fallbackPolicies: [
        {
          fallbackPolicyId: "ARENA_STORED_CACHE_EMPTY_GOLD_V08",
          sourceType: "stored_relic_chest",
          sourceId: "arena-reward-cache",
          reason: "STORED_REWARD_EMPTY",
          awardType: "GOLD",
          goldSourceId: "arena-cache-empty",
          baseAmount: 60,
          applyGoldModifiers: true,
          consumesRewardSlot: true,
          consumesOffer: true,
          consumesTransaction: true
        },
        {
          fallbackPolicyId: "OTTER_CRIMSON_STORED_EMPTY_GOLD_V08",
          sourceType: "stored_relic_chest",
          sourceId: "otter-crimson-chest",
          reason: "STORED_REWARD_EMPTY",
          awardType: "GOLD",
          goldSourceId: "otter-crimson-empty",
          baseAmount: 50,
          applyGoldModifiers: true,
          consumesRewardSlot: true,
          consumesOffer: true,
          consumesTransaction: true
        }
      ],
      rejectedReasons: [
        "STORED_REWARD_STALE",
        "OFFER_EXPIRED",
        "SOURCE_UNAVAILABLE",
        "NO_LEGAL_REPLACEMENT"
      ],
      noRewardReason: "EMPTY_CANDIDATE_POOL"
    }
  };
  const relicData = buildRelicCanonicalData(records, textByFile);
  const regularRelicOfferData = buildRegularRelicOfferCanonicalData(records, textByFile);
  return new Map([
    ["source-manifest.generated.json", sourceManifest],
    ["run-progression.generated.json", runProgression],
    ["room-types.generated.json", roomTypesData],
    ["room-eligibility.generated.json", roomEligibilityData],
    ["special-room-policy.generated.json", specialRoomPolicyData],
    ["gold-sources.generated.json", goldSourcesData],
    ["gold-modifiers.generated.json", goldModifiersData],
    ["meta-transaction-policy.generated.json", metaTransactionPolicyData],
    ["merchant-transaction-policy.generated.json", merchantTransactionPolicyData],
    ["forge-transaction-policy.generated.json", forgeTransactionPolicyData],
    ["crossroads-transaction-policy.generated.json", crossroadsTransactionPolicyData],
    ["camp-transaction-policy.generated.json", campTransactionPolicyData],
    ["pact-transaction-policy.generated.json", pactTransactionPolicyData],
    ["room-reward-bounds.generated.json", roomRewardBoundsData],
    ["chest-reward-bounds.generated.json", chestRewardBoundsData],
    ["relic-reward-fallback-policy.generated.json", relicRewardFallbackPolicy],
    ...buildRunModifierCanonicalData(records, textByFile),
    ...relicData,
    ...regularRelicOfferData
  ]);
}

async function listRulesetFiles(relative = "") {
  const directory = path.join(RULESET_ROOT, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.posix.join(relative.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) files.push(...await listRulesetFiles(child));
    else if (child !== "data/ruleset-manifest.json") files.push(child);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function buildRulesetManifest() {
  const files = [];
  const schemas = [];
  for (const relative of await listRulesetFiles()) {
    const bytes = await readFile(path.join(RULESET_ROOT, relative));
    files.push({
      file: relative,
      byteLength: bytes.byteLength,
      sha256: sha256(bytes)
    });
    if (relative.endsWith(".json")) {
      const parsed = JSON.parse(bytes.toString("utf8"));
      if (Number.isSafeInteger(parsed.schemaVersion)) {
        schemas.push({ file: relative, schemaVersion: parsed.schemaVersion });
      }
    }
  }
  const hashInput = {
    manifestVersion: 2,
    rulesetId: RULESET_ID,
    status: RULESET_STATUS,
    sourceCommit: BASELINE_COMMIT,
    schemas: schemas.sort((left, right) => left.file.localeCompare(right.file)),
    files: files.sort((left, right) => left.file.localeCompare(right.file))
  };
  return {
    ...hashInput,
    rulesetHash: `sha256:${sha256(canonicalJson(hashInput))}`
  };
}

async function writeOrCheck(relative, value) {
  const destination = path.join(DATA_ROOT, relative);
  const expected = `${JSON.stringify(value, null, 2)}\n`;
  if (CHECK_ONLY) {
    const actual = await readFile(destination, "utf8");
    if (actual !== expected) {
      throw new Error(`GENERATED_FILE_DRIFT:${path.relative(REPO_ROOT, destination)}`);
    }
    return;
  }
  await writeFile(destination, expected, "utf8");
}

const { records, textByFile } = await readSources();
const generated = buildCanonicalData(records, textByFile);
for (const relative of GENERATED_FILES) {
  await writeOrCheck(relative, generated.get(relative));
}
const rulesetManifest = await buildRulesetManifest();
await writeOrCheck("ruleset-manifest.json", rulesetManifest);
console.log(CHECK_ONLY ? "Online v3 meta generator check: PASS" : "Online v3 meta manifests generated.");
