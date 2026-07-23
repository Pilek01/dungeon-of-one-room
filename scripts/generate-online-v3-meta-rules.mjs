import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
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

const SOURCE_INPUTS = Object.freeze([
  { file: "game.js", symbols: ["chooseRoomType", "grantGold", "calculateScore", "startRun", "extractRun"] },
  { file: "camp-data.js", symbols: ["CAMP_UPGRADES"] },
  { file: "camp-runtime.js", symbols: ["tryBuyRelicFromMerchant", "tryBuyPotionFromMerchant"] },
  { file: "relic-data.js", symbols: ["RELICS", "WARDEN_RELIC_DROP_TABLE"] },
  { file: "relic-runtime.js", symbols: ["getRelicReturnSummary"] },
  { file: "loot-tables.js", symbols: ["rollChestOutcome", "rollShrineOutcome"] },
  { file: "mutator-data.js", symbols: ["MUTATORS", "getMutatorUnlockStatus"] },
  { file: "skills-data.js", symbols: ["MERCHANT_SKILL_UPGRADES"] },
  { file: "elixir-data.js", symbols: ["ELIXIRS"] },
  { file: "merchant-curation.js", symbols: ["chooseMerchantRelicOffer"] },
  { file: "forge-room.js", symbols: ["planForgeTemper", "planForgeTransmute"] },
  { file: "pact-room.js", symbols: ["PACTS", "choosePactOffers"] },
  { file: "pact-effects.js", symbols: ["applyPersistentPactEffects"] },
  { file: "room-pity.js", symbols: ["FORGE_PITY_DEPTH", "OTTER_PITY_DEPTH"] },
  { file: "expansion-content.js", symbols: ["ROOM_TYPES", "getRoomWeightMap"] },
  { file: "boss-campaign.js", symbols: ["BOSS_PROFILES", "FINAL_BOSS_PHASE_PROFILES"] }
]);

const RULESET_FILES = Object.freeze([
  "constants.js",
  "rng.js",
  "room-policy.js",
  "gold-policy.js",
  "reward-policy.js",
  "merchant-policy.js",
  "camp-policy.js",
  "forge-policy.js",
  "pact-policy.js",
  "life-policy.js",
  "score-policy.js",
  "leaderboard-summary.js",
  "test/golden-fixtures.examples.json",
  "data/golden-fixtures.manifest.json",
  "data/generated-source-manifest.json"
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

async function buildSourceManifest() {
  const sources = [];
  for (const entry of SOURCE_INPUTS) {
    const bytes = await readFile(path.join(REPO_ROOT, entry.file));
    const text = bytes.toString("utf8");
    for (const symbol of entry.symbols) {
      if (!text.includes(symbol)) {
        throw new Error(`SOURCE_SYMBOL_MISSING:${entry.file}:${symbol}`);
      }
    }
    sources.push({
      file: entry.file.replaceAll("\\", "/"),
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
      evidenceSymbols: [...entry.symbols]
    });
  }
  return {
    schemaVersion: 1,
    rulesetId: "v08-meta-1",
    purpose: "Phase 3A drift detection only; not executable balance data",
    sources
  };
}

async function buildRulesetManifest() {
  const files = [];
  for (const relative of RULESET_FILES) {
    const bytes = await readFile(path.join(RULESET_ROOT, relative));
    files.push({
      file: relative.replaceAll("\\", "/"),
      byteLength: bytes.byteLength,
      sha256: sha256(bytes)
    });
  }
  const hashInput = {
    manifestVersion: 1,
    rulesetId: "v08-meta-1",
    files
  };
  return {
    ...hashInput,
    status: "spec-only",
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

const sourceManifest = await buildSourceManifest();
await writeOrCheck("generated-source-manifest.json", sourceManifest);
const rulesetManifest = await buildRulesetManifest();
await writeOrCheck("ruleset-manifest.json", rulesetManifest);
console.log(CHECK_ONLY ? "Online v3 meta generator check: PASS" : "Online v3 meta manifests generated.");
