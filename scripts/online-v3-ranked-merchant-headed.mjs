import { launchMutedBrowser } from "./playwright-muted-launch.mjs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAME_ROOT = path.join(ROOT, "output", "pages-dist");
const ARTIFACT_ROOT = path.join(ROOT, "output", "online-v3-ranked-merchant-headed");
const PROTOCOL_VERSION = "ranked-v3-checkpoint-1";
const RULESET_ID = "v08-meta-1";
const RULESET_HASH = "sha256:08dfa4f97d91b4f21dbfae7232246125ddbbc6a0270cf81a9e1ed012e5f5d403";
const RUN_ID = "run_11111111111111111111111111111111";
const HEADLESS = process.argv.includes("--headless");
const execFileAsync = promisify(execFile);

function loadPlaywright() {
  const roots = [
    process.env.DUNGEON_PLAYWRIGHT_NODE_MODULES,
    path.join(process.env.USERPROFILE || "", ".codex", "skills", "develop-web-game", "node_modules"),
    path.join(ROOT, "node_modules")
  ].filter(Boolean);
  for (const searchRoot of roots) {
    try {
      return require(require.resolve("playwright", { paths: [searchRoot] }));
    } catch {
      // Try the next repository-scoped or skill-scoped dependency root.
    }
  }
  throw new Error("Playwright is unavailable for Ranked Merchant headed QA.");
}

function mimeType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg"
  }[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function directive(depth, roomType, revision) {
  return {
    directiveId: `directive_${depth}_${roomType}`,
    runId: RUN_ID,
    revision,
    roomIndex: depth,
    depth,
    roomType,
    roomCategory: roomType === "boss" ? "boss" : "special",
    directiveSeed: `seed_${depth}_${roomType}`,
    roomNonce: `nonce_${depth}_${roomType}`,
    rewardEnvelopeRef: `reward_${depth}_${roomType}`,
    specialRoomPayload: null
  };
}

function merchantChoices() {
  return [
    {
      transactionId: "merchant_potion",
      choiceId: "merchant_potion",
      kind: "merchant_potion",
      label: "Potion 1",
      status: "available",
      price: 10,
      currency: "run_then_camp"
    },
    ...["dash", "aoe", "shield"].map((skillId) => ({
      transactionId: `merchant_skill_${skillId}`,
      choiceId: `merchant_skill_${skillId}`,
      kind: "merchant_skill_upgrade",
      label: `${skillId} tier 1`,
      status: "available",
      skillId,
      tier: 1,
      price: 400,
      currency: "run_then_camp"
    })),
    {
      transactionId: "merchant_relic",
      choiceId: "merchant_relic",
      kind: "merchant_relic_purchase",
      label: "Acquire plating",
      status: "available",
      relicId: "plating",
      rarity: "normal",
      price: 300,
      currency: "run_then_camp",
      replacement: false
    },
    {
      transactionId: "merchant_reserve",
      choiceId: "merchant_reserve",
      kind: "merchant_relic_reserve",
      label: "Reserve plating",
      status: "available",
      relicId: "plating",
      totalPrice: 300,
      deposit: 75,
      remainingPrice: 225,
      currency: "run_then_camp"
    },
    {
      transactionId: "merchant_service",
      choiceId: "merchant_service",
      kind: "merchant_service",
      label: "combatboost",
      status: "available",
      serviceId: "combatboost",
      price: 200,
      currency: "run_then_camp"
    },
    {
      transactionId: "merchant_leave",
      choiceId: "merchant_leave",
      kind: "leave",
      label: "Leave Merchant",
      status: "available"
    }
  ];
}

function createApiState() {
  return {
    revision: 1,
    currentDirective: directive(3, "merchant", 1),
    offer: null,
    build: {
      relics: [{ relicId: "fang", stacks: 1 }],
      pacts: [],
      campUpgrades: {},
      skillTiers: { dash: 0, aoe: 0, shield: 0 },
      resources: {
        potions: 1,
        maxPotions: 5,
        hp: 100,
        maxHp: 100,
        combatBoostTurns: 0,
        combatBoostAttack: 0,
        combatBoostArmor: 0,
        hasSecondChance: false,
        highestUnlockedDepth: 3,
        skillCooldowns: { dash: 0, aoe: 0, shield: 0 }
      },
      merchant: {
        potionsBought: 0,
        secondChancePurchases: 0,
        reservedRelic: null
      }
    },
    gold: 1200,
    requests: []
  };
}

function projectState(api) {
  return {
    runId: RUN_ID,
    protocolVersion: PROTOCOL_VERSION,
    rulesetId: RULESET_ID,
    rulesetHash: RULESET_HASH,
    revision: api.revision,
    status: "active",
    currentRoomDirective: api.currentDirective,
    currentRewardEnvelope: null,
    build: structuredClone(api.build),
    gold: api.gold,
    campGold: 0,
    lives: 3,
    maxDepth: api.currentDirective.depth,
    startingRelicOffer: null,
    relicOffer: null,
    relicReplacement: null,
    metaTransactionOffer: api.offer
      ? {
          sourceType: "merchant",
          sourceId: "merchant-room",
          sourceInstanceId: "merchant-instance",
          offerId: "merchant-offer",
          choices: structuredClone(api.offer)
        }
      : null,
    campSession: null,
    lifeState: { currentLife: 1 }
  };
}

function responseFor(api, extra = {}) {
  return {
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    runId: RUN_ID,
    revision: api.revision,
    checkpointToken: "checkpoint-token",
    metaState: projectState(api),
    ...extra
  };
}

async function startServer(api) {
  const rootPrefix = `${GAME_ROOT}${path.sep}`;
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (url.pathname.startsWith("/api/v3/")) {
        const body = await readRequestJson(request);
        api.requests.push({ path: url.pathname, method: request.method, body });
        let payload;
        if (url.pathname === "/api/v3/runs/start") {
          payload = responseFor(api, { acceptedBoundary: "run_started" });
        } else if (url.pathname === "/api/v3/runs/event") {
          api.revision += 1;
          api.currentDirective.revision = api.revision;
          if (body.type === "open_meta_offer") {
            api.offer = merchantChoices();
            payload = responseFor(api, { acceptedEvent: "open_meta_offer" });
          } else if (body.type === "commit_meta_transaction") {
            const transactionId = String(body.payload?.transactionId || "");
            if (transactionId === "merchant_skill_dash") {
              api.build.skillTiers.dash = 1;
              api.gold -= 400;
              api.offer = merchantChoices().map((choice) => (
                choice.transactionId === transactionId ? { ...choice, status: "consumed" } : choice
              ));
            } else if (transactionId === "merchant_leave") {
              api.offer = null;
            } else {
              throw new Error(`Unexpected Merchant transaction: ${transactionId}`);
            }
            payload = responseFor(api, { acceptedEvent: "commit_meta_transaction" });
          } else {
            throw new Error(`Unexpected event type: ${body.type}`);
          }
        } else if (url.pathname === "/api/v3/runs/checkpoint") {
          api.revision += 1;
          api.currentDirective = directive(4, "combat", api.revision);
          payload = responseFor(api, { acceptedBoundary: "room_cleared" });
        } else {
          response.writeHead(404, { "content-type": "application/json" });
          response.end(JSON.stringify({ ok: false, code: "QA_ROUTE_NOT_FOUND" }));
          return;
        }
        response.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        });
        response.end(JSON.stringify(payload));
        return;
      }

      const relative = decodeURIComponent(url.pathname) === "/"
        ? "index.html"
        : decodeURIComponent(url.pathname).replace(/^\/+/u, "");
      const candidate = path.resolve(GAME_ROOT, relative);
      if (candidate !== GAME_ROOT && !candidate.startsWith(rootPrefix)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const stat = await fsPromises.stat(candidate);
      const filePath = stat.isDirectory() ? path.join(candidate, "index.html") : candidate;
      response.writeHead(200, {
        "content-type": mimeType(filePath),
        "cache-control": "no-store"
      });
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: String(error?.stack || error) }));
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function dismissBoot(page) {
  await page.waitForFunction(() => typeof window.render_game_to_text === "function");
  await page.keyboard.press("Enter");
  await page.locator(".boot-loading").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("#bootScreen")?.classList.contains("hidden"));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "menu");
}

async function gameState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function moveToward(page, targetKey) {
  const attempted = new Set();
  for (let step = 0; step < 80; step += 1) {
    const state = await gameState(page);
    const target = state.interactables?.[targetKey];
    assert(target, `${targetKey} is missing from the visible game state`);
    if (state.player.x === target.x && state.player.y === target.y) return state;
    const dx = target.x - state.player.x;
    const dy = target.y - state.player.y;
    const candidates = [
      ...(dx ? [{ key: dx > 0 ? "ArrowRight" : "ArrowLeft", axis: "x" }] : []),
      ...(dy ? [{ key: dy > 0 ? "ArrowDown" : "ArrowUp", axis: "y" }] : []),
      { key: "ArrowRight", axis: "x" },
      { key: "ArrowDown", axis: "y" },
      { key: "ArrowLeft", axis: "x" },
      { key: "ArrowUp", axis: "y" }
    ];
    let moved = false;
    for (const candidate of candidates) {
      const signature = `${state.player.x},${state.player.y}:${candidate.key}`;
      if (attempted.has(signature)) continue;
      attempted.add(signature);
      await page.keyboard.press(candidate.key);
      await page.waitForTimeout(70);
      const next = await gameState(page);
      if (next.player.x !== state.player.x || next.player.y !== state.player.y) {
        moved = true;
        break;
      }
    }
    assert(moved, `Could not find a visible path to ${targetKey}`);
  }
  throw new Error(`Visible movement did not reach ${targetKey}`);
}

async function main() {
  assert(path.resolve(ARTIFACT_ROOT).startsWith(`${path.resolve(ROOT, "output")}${path.sep}`));
  await fsPromises.rm(ARTIFACT_ROOT, { recursive: true, force: true });
  await fsPromises.mkdir(ARTIFACT_ROOT, { recursive: true });
  await execFileAsync(process.execPath, [path.join(ROOT, "scripts", "build-pages-v3.mjs")], {
    cwd: ROOT,
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  });

  const api = createApiState();
  const proxy = await startServer(api);
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  const { chromium } = loadPlaywright();
  const browser = await launchMutedBrowser(chromium, { headless: HEADLESS });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      window.DUNGEON_ONLINE_V3_SEASON = "merchant-headed";
      window.DUNGEON_ONLINE_V3_DEBUG = true;
      localStorage.setItem("dungeonOneRoomPlayerName", "MerchantQA");
      localStorage.setItem("dungeonOneRoomGraphicsMode", "hd");
      localStorage.setItem("dungeonOneRoomTutorialRunSeenV1", "1");
    });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error?.stack || error)));
    page.on("requestfailed", (request) => {
      const errorText = request.failure()?.errorText || "";
      const pathname = new URL(request.url()).pathname;
      const expectedAudioAbort =
        errorText === "net::ERR_ABORTED" &&
        /\.(?:mp3|wav|ogg)$/iu.test(pathname);
      if (!expectedAudioAbort) {
        diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${errorText}`);
      }
    });

    await page.goto(`${proxy.baseUrl}/`, { waitUntil: "domcontentloaded" });
    await dismissBoot(page);
    await page.locator(".overlay-menu-row", { hasText: "Ranked (Online)" }).click();
    await page.waitForFunction(() => (
      JSON.parse(window.render_game_to_text()).roomType === "merchant" &&
      window.DungeonOnlineV3?.getSessionState?.() === "ROOM_ACTIVE"
    ));

    const entryAudit = await page.evaluate(() => ({
      game: JSON.parse(window.render_game_to_text()),
      nativeMerchant: Boolean(document.querySelector(".overlay-card-merchant")),
      rankedOverlay: [...document.querySelectorAll(".ranked-v3-overlay")]
        .some((element) => element.getClientRects().length > 0)
    }));
    assert.equal(entryAudit.game.roomType, "merchant");
    assert.equal(entryAudit.game.roomCleared, true);
    assert.equal(entryAudit.nativeMerchant, false, "Merchant menu opened before player interaction");
    assert.equal(entryAudit.rankedOverlay, false, "Ranked overlay opened on Merchant room entry");
    assert.equal(api.requests.filter((entry) => entry.body?.type === "open_meta_offer").length, 0);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "01-merchant-room-before-interaction.png"),
      fullPage: true
    });

    await moveToward(page, "merchant");
    await page.keyboard.press("e");
    await page.locator(".overlay-card-merchant").waitFor({ state: "visible" });
    const merchantAudit = await page.evaluate(() => ({
      game: JSON.parse(window.render_game_to_text()),
      heading: document.querySelector(".overlay-card-merchant .overlay-title")?.textContent?.trim() || "",
      rankedOverlay: [...document.querySelectorAll(".ranked-v3-overlay")]
        .some((element) => element.getClientRects().length > 0),
      visibleText: document.querySelector(".overlay-card-merchant")?.textContent || ""
    }));
    assert.equal(merchantAudit.heading, "Curio Merchant");
    assert.equal(merchantAudit.rankedOverlay, false);
    assert.doesNotMatch(merchantAudit.visibleText, /MERCHANT CHOICES|Run then camp|laststandtorque/iu);
    assert.equal(api.requests.filter((entry) => entry.body?.type === "open_meta_offer").length, 1);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "02-native-ranked-merchant.png"),
      fullPage: true
    });

    const dashRow = page.locator(".overlay-card-merchant .merchant-row", { hasText: /Dash/iu }).first();
    await dashRow.waitFor({ state: "visible" });
    await dashRow.click();
    await page.waitForFunction(() => (
      window.DungeonOnlineV3?.getSnapshot?.()?.publicState?.build?.skillTiers?.dash === 1
    ));
    assert.equal(await page.locator(".overlay-card-merchant").isVisible(), true);
    assert.equal(api.gold, 800);
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "03-native-ranked-merchant-after-purchase.png"),
      fullPage: true
    });

    await page.keyboard.press("Escape");
    await page.locator(".overlay-card-merchant").waitFor({ state: "hidden" });
    await moveToward(page, "portal");
    await page.keyboard.press("e");
    await page.waitForFunction(() => {
      const game = JSON.parse(window.render_game_to_text());
      return game.depth === 4 &&
        game.roomType === "combat" &&
        window.DungeonOnlineV3?.getSessionState?.() === "ROOM_ACTIVE";
    }, null, { timeout: 15_000 });
    const portalAudit = await page.evaluate(() => ({
      game: JSON.parse(window.render_game_to_text()),
      rankedOverlay: [...document.querySelectorAll(".ranked-v3-overlay")]
        .some((element) => element.getClientRects().length > 0),
      snapshot: window.DungeonOnlineV3?.getSnapshot?.()
    }));
    assert.equal(portalAudit.rankedOverlay, false);
    assert.notEqual(portalAudit.game.latestLog, "Online v3 is still resolving the next room.");
    assert.equal(portalAudit.snapshot.publicState.currentRoomDirective.roomType, "combat");
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "04-next-room-after-ranked-merchant.png"),
      fullPage: true
    });

    const mutationSequence = api.requests
      .filter((entry) => ["/api/v3/runs/event", "/api/v3/runs/checkpoint"].includes(entry.path))
      .map((entry) => entry.path.endsWith("/checkpoint")
        ? "checkpoint"
        : `${entry.body.type}:${entry.body.payload?.transactionId || ""}`);
    assert.deepEqual(mutationSequence, [
      "open_meta_offer:",
      "commit_meta_transaction:merchant_skill_dash",
      "commit_meta_transaction:merchant_leave",
      "checkpoint"
    ]);
    assert.deepEqual(diagnostics.consoleErrors, []);
    assert.deepEqual(diagnostics.pageErrors, []);
    assert.deepEqual(diagnostics.failedRequests, []);

    const summary = {
      mode: HEADLESS ? "headless" : "headed",
      nativeMerchantScreens: 1,
      merchantPurchases: 1,
      merchantPortalTransitions: 1,
      mutationSequence,
      consoleErrors: diagnostics.consoleErrors.length,
      pageErrors: diagnostics.pageErrors.length,
      failedRequests: diagnostics.failedRequests.length,
      finalDepth: portalAudit.game.depth,
      finalRoomType: portalAudit.game.roomType
    };
    await fsPromises.writeFile(
      path.join(ARTIFACT_ROOT, "ranked-merchant-headed-summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8"
    );
    console.log(
      `Online v3 Ranked Merchant headed PASS (${summary.merchantPurchases} purchase, ` +
      `${summary.merchantPortalTransitions} portal transition, ${summary.consoleErrors} console errors)`
    );
  } finally {
    await browser.close();
    await closeServer(proxy.server);
  }
}

main().catch(async (error) => {
  await fsPromises.mkdir(ARTIFACT_ROOT, { recursive: true }).catch(() => {});
  await fsPromises.writeFile(
    path.join(ARTIFACT_ROOT, "ranked-merchant-headed-failure.txt"),
    `${String(error?.stack || error)}\n`,
    "utf8"
  ).catch(() => {});
  console.error(error);
  process.exitCode = 1;
});
