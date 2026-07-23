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
  }
]);

const GENERATED_FILES = Object.freeze([
  "source-manifest.generated.json",
  "run-progression.generated.json",
  "room-types.generated.json",
  "room-eligibility.generated.json",
  "special-room-policy.generated.json"
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

function buildCanonicalData(records, textByFile) {
  const gameSource = textByFile.get("game.js");
  const pitySource = textByFile.get("room-pity.js");
  const expansionSource = textByFile.get("expansion-content.js");
  const pactSource = textByFile.get("pact-room.js");
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
  const sourceManifest = {
    schemaVersion: 2,
    rulesetId: RULESET_ID,
    sourceCommit,
    purpose: "Phase 3B1 canonical room progression and special-room scheduling",
    sources: records
  };
  return new Map([
    ["source-manifest.generated.json", sourceManifest],
    ["run-progression.generated.json", runProgression],
    ["room-types.generated.json", roomTypesData],
    ["room-eligibility.generated.json", roomEligibilityData],
    ["special-room-policy.generated.json", specialRoomPolicyData]
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
