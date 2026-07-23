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
      "maybeQueueOtterRoom"
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
    file: "camp-runtime.js",
    symbols: ["state.player.gold", "Merchant buys", "spendMerchantUpgradeGold"]
  },
  {
    file: "loot-tables.js",
    symbols: ["CHEST_THRESHOLD_TREASURE", "CHEST_THRESHOLD_STANDARD", "rollChestOutcome"]
  },
  {
    file: "mutator-data.js",
    symbols: ["greed", "elitist", "MUTATORS"]
  },
  {
    file: "relic-data.js",
    symbols: ["RELICS", "Golden Idol", "Void Reaper", "Chaos Orb"]
  },
  {
    file: "relic-runtime.js",
    symbols: ["getRelicStackCount", "isNormalRelicStackAtCap", "getRelicInventoryGroups"]
  },
  {
    file: "merchant-curation.js",
    symbols: ["chooseMerchantRelicOffer"]
  },
  {
    file: "boss-campaign.js",
    symbols: ["BOSS_PROFILES"]
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
  "relic-catalog.generated.json",
  "relic-stack-policy.generated.json",
  "relic-slot-policy.generated.json",
  "starting-relic-policy.generated.json",
  "relic-build-metadata.generated.json",
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
    normal: ["starting_relic", "relic_draft", "boss_drop", "merchant", "forge", "otter", "vault"],
    rare: ["relic_draft", "boss_drop", "merchant", "forge", "otter", "vault"],
    epic: ["relic_draft", "boss_drop", "merchant", "forge", "otter", "vault"],
    legendary: ["relic_draft", "boss_drop", "merchant", "forge", "otter", "vault"],
    mythic: [
      "relic_draft",
      "boss_drop",
      "merchant",
      "forge",
      "otter",
      "vault",
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
      authorityClass: "HEURISTIC_ONLY",
      calculationInputs: ["local offer resolution", "canonicalBuild"],
      serverKnownInputs: ["directive.roomType", "canonicalBuild"],
      clientAttestedInputs: ["fallback occurred"],
      maximumPerRoomKnown: true,
      maximumPerRunKnown: true,
      stackingRules: "at most one special cache/chest",
      roundingRules: "grantGold Math.round",
      appliedOrder: grantOrder,
      eligibleRoomTypes,
      generatedDataRef: "room-reward-bounds.generated.json#deferredFallbacks",
      notes: `${notes}; not awarded in Phase 3B2A because offer state is deferred.`
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
        { id: "greed", buildPath: "mutators", buildId: "greed", additive: 0.4, stackCap: 1, appliesTo: ["multiplied-grant"] },
        { id: "standard-mutator-gold", buildPath: "mutators", excludes: ["greed"], additivePerUnique: 0.2, stackCap: mutatorIds.length - 1, appliesTo: ["multiplied-grant"] },
        { id: "elitist", buildPath: "mutators", buildId: "elitist", multiplicative: 1.6, stackCap: 1, appliesTo: ["elite-kill"] },
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
  const sourceManifest = {
    schemaVersion: 3,
    rulesetId: RULESET_ID,
    sourceCommit,
    purpose: "Phase 3B1 room progression, Phase 3B2A gold, and Phase 3B2B1 relic/starting-offer source inventory",
    sources: records
  };
  const relicData = buildRelicCanonicalData(records, textByFile);
  return new Map([
    ["source-manifest.generated.json", sourceManifest],
    ["run-progression.generated.json", runProgression],
    ["room-types.generated.json", roomTypesData],
    ["room-eligibility.generated.json", roomEligibilityData],
    ["special-room-policy.generated.json", specialRoomPolicyData],
    ["gold-sources.generated.json", goldSourcesData],
    ["gold-modifiers.generated.json", goldModifiersData],
    ["room-reward-bounds.generated.json", roomRewardBoundsData],
    ["chest-reward-bounds.generated.json", chestRewardBoundsData],
    ...relicData
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
