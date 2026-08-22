import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const GENERATED_ROOT = new URL("../../../output/pages-test-dist/", import.meta.url);
let generatedBuild;

async function ensureGeneratedBuild() {
  if (generatedBuild) return generatedBuild;
  generatedBuild = Promise.resolve().then(() => {
    if (existsSync(path.join(ROOT_PATH, "output", "pages-test-dist", "game.js"))) return;
    const result = spawnSync(process.execPath, [
      path.join(ROOT_PATH, "scripts", "build-pages-v3.mjs"),
      "--target",
      "test"
    ], { cwd: ROOT_PATH, encoding: "utf8" });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });
  return generatedBuild;
}

async function source(name) {
  await ensureGeneratedBuild();
  return readFile(new URL(name, GENERATED_ROOT), "utf8");
}

function functionBody(text, name, nextName) {
  const start = text.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = text.indexOf(`function ${nextName}`, start);
  assert.ok(end > start, `missing ${nextName} boundary`);
  return text.slice(start, end);
}

test("Ranked Observer Bot opens the canonical Merchant offer before choosing a skill", async () => {
  const game = await source("game.js");
  const merchantAction = functionBody(
    game,
    "runObserverMerchantAction",
    "shouldObserverBotEmergencyExtractNow"
  );
  const openIndex = merchantAction.indexOf("openMerchantMenu()");
  const firstPurchaseIndex = merchantAction.search(/tryBuy(?:Potion|SkillUpgrade)FromMerchant\(/u);

  assert.ok(
    openIndex >= 0,
    "Ranked bot must request the server-issued Merchant offer before attempting a purchase"
  );
  assert.ok(
    firstPurchaseIndex >= 0 && openIndex < firstPurchaseIndex,
    "Merchant offer opening must precede every bot purchase attempt"
  );
});

test("a missing Merchant choice cannot be counted as a successful bot purchase", async () => {
  const runtime = await source("online-v3/ranked-v3-runtime.js");
  const merchantAction = functionBody(
    runtime,
    "onMerchantAction",
    "onMerchantLeave"
  );
  const noChoice = merchantAction.match(/if \(!choice\) \{([\s\S]*?)\n\s*\}/u)?.[1] || "";

  assert.match(noChoice, /failRankedMerchantRequest/u);
  assert.doesNotMatch(
    noChoice,
    /return true;/u,
    "a rejected/no-offer action must not report success to the bot purchase counter"
  );
});

test("Ranked Merchant bot actions wait while the canonical open or commit is pending", async () => {
  const game = await source("game.js");
  const botStep = functionBody(
    game,
    "runObserverBotStep",
    "updateObserverBot"
  );

  assert.match(
    botStep,
    /state\.onlineV3Ranked[\s\S]{0,220}(?:state\.turnInProgress|isRankedAutomationBlocked|isObserverBotBoundaryPending)/u,
    "the Ranked bot must stop issuing Merchant actions while the canonical request is unresolved"
  );
});
