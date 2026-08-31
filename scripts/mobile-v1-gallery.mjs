import { launchMutedBrowser } from "./playwright-muted-launch.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startMobilePreviewServer } from "./mobile-v1-lan-preview.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_ROOT = path.join(ROOT, "output", "mobile-v1-gallery");
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
const LANDSCAPE = Object.freeze({ width: 844, height: 390 });
const PORTRAIT = Object.freeze({ width: 390, height: 844 });
const PORTRAIT_PROFILES = Object.freeze([
  Object.freeze({ name: "small", width: 360, height: 640 }),
  Object.freeze({ name: "typical", width: 390, height: 844 }),
  Object.freeze({ name: "large", width: 430, height: 932 })
]);
const SHOTS = Object.freeze([
  Object.freeze({ id: "01-gameplay", scenario: "enemy_roster_hd", phase: "playing" }),
  Object.freeze({ id: "01b-fury-seven", scenario: "fury_seven_hd", phase: "playing", furyValue: "7/7" }),
  Object.freeze({ id: "02-camp", scenario: "relic_exchange", phase: "camp", overlaySelector: ".overlay-card-camp" }),
  Object.freeze({ id: "03-forge", scenario: "forge", phase: "playing", overlaySelector: ".overlay-card-forge" }),
  Object.freeze({ id: "04-merchant", scenario: "merchant_buyback_hd", phase: "playing", overlaySelector: ".overlay-card-merchant" }),
  Object.freeze({ id: "08-pact", scenario: "pact", phase: "playing", overlaySelector: ".overlay-card-pact-sanctum" })
]);
const JOURNEY_SHOTS = Object.freeze([
  Object.freeze({ id: "09-reward", scenario: "reward_choice_mobile", phase: "relic", overlaySelector: ".overlay-card-relic-draft" }),
  Object.freeze({ id: "10-forge-reward", scenario: "forge_reward_mobile", phase: "relic", overlaySelector: ".overlay-card-forge-reward" }),
  Object.freeze({ id: "11-extract-exchange", scenario: "extract_exchange_mobile", phase: "camp", overlaySelector: ".overlay-card-relic-exchange" }),
  Object.freeze({ id: "12-emergency-extract", scenario: "emergency_extract_mobile", phase: "playing", overlaySelector: ".emergency-extract-confirm" }),
  Object.freeze({ id: "13-death", scenario: "death_mobile", phase: "dead", overlaySelector: ".death-requiem" }),
  Object.freeze({ id: "14-gameover", scenario: "gameover_mobile", phase: "dead", overlaySelector: ".gameover-requiem" }),
  Object.freeze({ id: "15-victory", scenario: "victory_mobile", phase: "won", overlaySelector: ".overlay-card-success" }),
  Object.freeze({ id: "16-records", scenario: "records_mobile", phase: "menu", overlaySelector: ".record-archive-shell" }),
  Object.freeze({ id: "17-nickname", scenario: "nickname_mobile", phase: "menu", overlaySelector: ".overlay-card-dialog" }),
  Object.freeze({ id: "18-camp-start", scenario: "camp_start_mobile", phase: "camp", overlaySelector: ".camp-start-sanctum" })
]);

function loadPlaywright() {
  const roots = [
    process.env.DUNGEON_PLAYWRIGHT_NODE_MODULES,
    path.join(process.env.USERPROFILE || "", ".codex", "skills", "develop-web-game", "node_modules"),
    path.join(ROOT, "node_modules")
  ].filter(Boolean);
  for (const runtimeRoot of roots) {
    try {
      return require(require.resolve("playwright", { paths: [runtimeRoot] }));
    } catch {
      // Try the next explicitly scoped runtime.
    }
  }
  throw new Error("Playwright runtime not found.");
}

async function openMobilePage(browser, baseUrl, scenario, viewport) {
  const context = await browser.newContext({
    viewport,
    userAgent: IPHONE_UA,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  const diagnostics = { consoleErrors: [], pageErrors: [], apiRequests: [] };
  page.on("console", (message) => {
    if (message.type() === "warning" && /AudioContext was not allowed to start/iu.test(message.text())) return;
    if (message.type() === "error" || message.type() === "warning") {
      diagnostics.consoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error?.stack || error)));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) diagnostics.apiRequests.push(request.url());
  });

  const response = await page.goto(`${baseUrl}?scenario=${encodeURIComponent(scenario)}`, {
    waitUntil: "domcontentloaded"
  });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => typeof window.render_game_to_text === "function");
  await page.evaluate(() => {
    document.getElementById("bootScreen")?.classList.add("hidden");
    document.getElementById("gameApp")?.classList.remove("app-hidden");
  });
  return { context, page, diagnostics };
}

async function waitForPhase(page, phase) {
  await page.waitForFunction(
    (expected) => JSON.parse(window.render_game_to_text()).phase === expected,
    phase,
    { timeout: 120000 }
  );
}

async function waitForHd(page) {
  await page.waitForFunction(
    () => document.getElementById("game")?.classList.contains("graphics-hd"),
    null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(500);
}

async function assertCleanPage(page, label) {
  const metrics = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    verticalOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
    state: JSON.parse(window.render_game_to_text())
  }));
  assert.equal(metrics.horizontalOverflow, false, `${label} horizontal overflow`);
  assert.equal(metrics.verticalOverflow, false, `${label} vertical overflow`);
  return metrics;
}

async function assertTouchSurfaceStandards(page, label) {
  const audit = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    const guidance = [...document.querySelectorAll(
      "#screenOverlay .overlay-hint, #screenOverlay .camp-revamp-guide, #screenOverlay .forge-controls, #screenOverlay .pact-sanctum-controls"
    )].filter(visible).map((element) => element.textContent?.trim() || "").join(" | ");
    const visibleKeyBadges = [...document.querySelectorAll(
      "#screenOverlay .overlay-menu-key, #screenOverlay .camp-revamp-key, #screenOverlay .camp-revamp-tab-key, #screenOverlay .forge-choice-key, #screenOverlay .pact-sanctum-key, #screenOverlay .pact-sanctum-leave-key, #screenOverlay .relic-draft-key, #screenOverlay .death-mini-key, #screenOverlay .camp-start-key"
    )].filter(visible).map((element) => element.textContent?.trim() || "").filter(Boolean);
    const overlay = document.getElementById("screenOverlay");
    return {
      guidance,
      visibleKeyBadges,
      runningAnimations: overlay?.getAnimations({ subtree: true }).filter((animation) => animation.playState !== "finished").length || 0
    };
  });
  assert.doesNotMatch(
    audit.guidance,
    /\b(?:Enter|Esc|Arrows|W\/S|Up\s*\/\s*Down|Left\s*\/\s*Right)\b/iu,
    `${label} exposes keyboard-only touch guidance: ${audit.guidance}`
  );
  assert.deepEqual(audit.visibleKeyBadges, [], `${label} exposes keyboard key badges on touch`);
  assert.equal(audit.runningAnimations, 0, `${label} must honor reduced-motion preference`);
}

async function capturePortrait(browser, baseUrl, report) {
  for (const viewport of PORTRAIT_PROFILES) {
    const opened = await openMobilePage(browser, baseUrl, "enemy_roster_hd", viewport);
    const { context, page, diagnostics } = opened;
    try {
      await waitForPhase(page, "playing");
      await waitForHd(page);
      const tutorial = page.locator(".tutorial-overlay-card");
      if (await tutorial.isVisible().catch(() => false)) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(120);
      }
      const portrait = await page.evaluate(() => {
        const rect = (selector) => {
          const box = document.querySelector(selector)?.getBoundingClientRect();
          return box ? { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom } : null;
        };
        const controls = [...document.querySelectorAll("#mobileControls button")].map((button) => {
          const box = button.getBoundingClientRect();
          return {
            id: button.id,
            box: { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom }
          };
        }).filter(({ box }) => box.width > 0 && box.height > 0);
        return {
          rotateVisible: (() => {
            const overlay = document.getElementById("mobileRotateOverlay");
            return Boolean(overlay && !overlay.hidden && getComputedStyle(overlay).display !== "none");
          })(),
          board: rect(".layout-track > .board"),
          canvas: rect("#game"),
          controls: rect("#mobileControls"),
          dpad: rect(".mobile-dpad"),
          actionDock: rect("#mobileActionDock"),
          controlsList: controls,
          viewport: { width: innerWidth, height: innerHeight },
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          verticalOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1
        };
      });
      assert.equal(portrait.rotateVisible, false, `${viewport.name} portrait must stay playable`);
      assert.equal(portrait.horizontalOverflow, false, `${viewport.name} portrait horizontal overflow`);
      assert.equal(portrait.verticalOverflow, false, `${viewport.name} portrait vertical overflow`);
      assert(portrait.board && portrait.board.width >= viewport.width - 1, `${viewport.name} portrait shell must fill viewport`);
      assert(portrait.canvas && Math.abs(portrait.canvas.width - portrait.canvas.height) <= 1, `${viewport.name} board must remain square`);
      assert(portrait.controls && portrait.canvas.bottom <= portrait.controls.y + 1, `${viewport.name} board must finish above controls`);
      assert(portrait.dpad && portrait.dpad.width >= 144 && portrait.dpad.height >= 144, `${viewport.name} portrait must expose full D-pad`);
      assert(portrait.actionDock && portrait.actionDock.width >= 144, `${viewport.name} portrait must expose the action bank`);
      assert(
        portrait.controlsList.every(({ box }) => box.width >= 48 && box.height >= 48 && box.x >= -1 && box.right <= viewport.width + 1 && box.y >= -1 && box.bottom <= viewport.height + 1),
        `${viewport.name} portrait controls must be 48px and contained: ${JSON.stringify(portrait.controlsList)}`
      );
      const id = `00-portrait-${viewport.name}-gameplay`;
      const filePath = path.join(OUTPUT_ROOT, `${id}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      report.push({ id, filePath, metrics: portrait, diagnostics });
    } finally {
      await context.close();
    }
  }
}

async function captureShot(browser, baseUrl, shot, report, viewport = LANDSCAPE, suffix = "") {
  const captureId = `${shot.id}${suffix}`;
  const opened = await openMobilePage(browser, baseUrl, shot.scenario, viewport);
  const { context, page, diagnostics } = opened;
  try {
    await waitForPhase(page, shot.phase);
    await waitForHd(page);
    const tutorial = page.locator(".tutorial-overlay-card");
    if (await tutorial.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(120);
    }
    if (shot.overlaySelector) {
    if (shot.id === "04-merchant") {
      const merchant = await page.locator(".merchant-sanctuary").evaluate((card) => {
        const menu = card.querySelector(".merchant-menu-buyback");
        const summaryCopy = card.querySelector(".merchant-buyback-summary > div");
        const hint = card.querySelector(":scope > .overlay-hint");
        const buybackGrid = card.querySelector(".merchant-buyback-grid");
        const labels = [...card.querySelectorAll(".merchant-buyback-copy > strong")];
        if (buybackGrid) buybackGrid.scrollTop = buybackGrid.scrollHeight;
        const lastRow = card.querySelector(".merchant-buyback-row:last-child");
        const cardBox = card.getBoundingClientRect();
        const menuBox = menu?.getBoundingClientRect();
        const hintBox = hint?.getBoundingClientRect();
        const gridBox = buybackGrid?.getBoundingClientRect();
        const lastRowBox = lastRow?.getBoundingClientRect();
        const result = {
          hintText: hint?.textContent?.trim() || "",
          cardWidth: cardBox.width,
          menuWidth: menuBox?.width || 0,
          hintHeight: hintBox?.height || 0,
          hintBottom: hintBox?.bottom || 0,
          hintClientHeight: hint?.clientHeight || 0,
          hintScrollHeight: hint?.scrollHeight || 0,
          menuTop: menuBox?.top || 0,
          gridScrollbarColor: buybackGrid ? getComputedStyle(buybackGrid).scrollbarColor : "auto",
          lastRowReachable: Boolean(gridBox && lastRowBox && lastRowBox.bottom <= gridBox.bottom + 1 && lastRowBox.top >= gridBox.top - 1),
          summaryDisplay: summaryCopy ? getComputedStyle(summaryCopy).display : "",
          labels: labels.map((label) => ({
            text: label.textContent?.trim() || "",
            clientWidth: label.clientWidth,
            scrollWidth: label.scrollWidth
          }))
        };
        if (buybackGrid) buybackGrid.scrollTop = 0;
        return result;
      });
      assert(merchant.menuWidth >= merchant.cardWidth - 32, `Merchant buyback wastes card width: ${JSON.stringify(merchant)}`);
      assert(
        merchant.hintHeight > 0 && merchant.hintClientHeight + 1 >= merchant.hintScrollHeight,
        `Merchant touch guidance must have a readable grid row: ${JSON.stringify(merchant)}`
      );
      assert(
        merchant.hintBottom <= merchant.menuTop + 1,
        `Merchant touch guidance must not overlap the buyback summary: ${JSON.stringify(merchant)}`
      );
      assert.match(merchant.hintText, /Swipe to scroll/u, "Merchant must explain its internal scroll region");
      assert.notEqual(merchant.gridScrollbarColor, "auto", "Merchant buyback must expose a visible scrollbar affordance");
      assert.equal(merchant.lastRowReachable, true, "Every Merchant buyback row must be reachable by touch scrolling");
      assert.notEqual(merchant.summaryDisplay, "inline", "Merchant buyback summary copy must use a deliberate block layout");
      assert(merchant.labels.length > 0 && merchant.labels.every((label) => label.scrollWidth <= label.clientWidth + 1), `Merchant relic names must be fully legible: ${JSON.stringify(merchant.labels)}`);
    }
      await page.locator(shot.overlaySelector).waitFor({ state: "visible", timeout: 30000 });
      const modal = await page.evaluate(() => {
        const overlay = document.getElementById("screenOverlay");
        return {
          role: overlay?.getAttribute("role") || "",
          modal: overlay?.getAttribute("aria-modal") || "",
          focusInside: Boolean(overlay?.contains(document.activeElement)),
          appInert: Boolean(document.getElementById("gameApp")?.inert)
        };
      });
      assert.deepEqual(
        modal,
        { role: "dialog", modal: "true", focusInside: true, appInert: true },
        `${captureId} must expose a focused modal dialog`
      );
      await assertTouchSurfaceStandards(page, captureId);
      if (viewport.height > viewport.width) {
        const portraitOverlay = await page.locator(shot.overlaySelector).evaluate((card) => {
          const cardBox = card.getBoundingClientRect();
          const scrollables = [card, ...card.querySelectorAll("*")].filter((element) => {
            const style = getComputedStyle(element);
            return /auto|scroll/u.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
          }).map((element) => ({
            className: element.className,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight
          }));
          const sticky = card.querySelector(
            ".camp-revamp-actions, .forge-footer, .mobile-overlay-actions, .pact-sanctum-leave, .relic-draft-footer, .relic-draft-skip, .relic-exchange-actions, .emergency-extract-confirm > .overlay-menu, .death-requiem-actions, .gameover-requiem-actions, .overlay-card-success > .overlay-menu, .camp-start-actions"
          );
          const stickyBox = sticky?.getBoundingClientRect();
          return {
            card: { x: cardBox.x, y: cardBox.y, width: cardBox.width, height: cardBox.height, right: cardBox.right, bottom: cardBox.bottom },
            viewport: { width: innerWidth, height: innerHeight },
            scrollables,
            stickyPosition: sticky ? getComputedStyle(sticky).position : "",
            stickyBox: stickyBox ? { top: stickyBox.top, bottom: stickyBox.bottom, height: stickyBox.height } : null
          };
        });
        assert(
          portraitOverlay.card.width >= portraitOverlay.viewport.width - 20
            && portraitOverlay.card.height >= portraitOverlay.viewport.height - 20,
          `${captureId} must be a purpose-built full-screen mobile surface: ${JSON.stringify(portraitOverlay)}`
        );
        assert(
          portraitOverlay.scrollables.length <= 1,
          `${captureId} must expose one intentional scroll region: ${JSON.stringify(portraitOverlay.scrollables)}`
        );
        assert(
          portraitOverlay.stickyBox
            && /sticky|fixed/u.test(portraitOverlay.stickyPosition)
            && portraitOverlay.stickyBox.bottom <= portraitOverlay.viewport.height - 7,
          `${captureId} primary exit/action must stay above the safe-area edge: ${JSON.stringify(portraitOverlay)}`
        );
        const journeyTargets = await page.locator(`${shot.overlaySelector} button:visible, ${shot.overlaySelector} [role="button"]:visible, ${shot.overlaySelector} input:visible`).evaluateAll((elements) => elements.map((element) => {
          const box = element.getBoundingClientRect();
          let ancestor = element.parentElement;
          let scrollManaged = false;
          while (ancestor && ancestor !== document.body) {
            const style = getComputedStyle(ancestor);
            if (/auto|scroll/u.test(style.overflowY) && ancestor.scrollHeight > ancestor.clientHeight + 1) {
              scrollManaged = true;
              break;
            }
            ancestor = ancestor.parentElement;
          }
          return {
            label: element.getAttribute("aria-label") || element.textContent?.trim() || element.id || element.tagName,
            width: box.width,
            height: box.height,
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            scrollManaged
          };
        }));
        assert(
          journeyTargets.length > 0
            && journeyTargets.every(({ width, height, left, right, top, bottom, scrollManaged }) => (
              width >= 48
              && height >= 48
              && left >= -1
              && right <= portraitOverlay.viewport.width + 1
              && (scrollManaged || (top >= -1 && bottom <= portraitOverlay.viewport.height + 1))
            )),
          `${captureId} interactive targets must remain comfortable and contained: ${JSON.stringify(journeyTargets)}`
        );
      }
      if (shot.id === "02-camp") {
        const camp = await page.locator(".camp-revamp").evaluate((card) => {
          const grid = card.querySelector(".camp-revamp-grid");
          const descriptions = [...card.querySelectorAll(".camp-revamp-copy small")];
          if (grid) grid.scrollTop = grid.scrollHeight;
          const lastRow = card.querySelector(".camp-revamp-row:last-child");
          const firstRow = card.querySelector(".camp-revamp-row");
          const firstCopy = firstRow?.querySelector(".camp-revamp-copy");
          const firstStatus = firstRow?.querySelector(".camp-revamp-status");
          const gridBox = grid?.getBoundingClientRect();
          const lastBox = lastRow?.getBoundingClientRect();
          const result = {
            cardFrame: getComputedStyle(card.closest(".overlay-card-camp")).borderImageSource,
            rowFrame: getComputedStyle(card.querySelector(".camp-revamp-row")).borderImageSource,
            rowWidth: firstRow?.getBoundingClientRect().width || 0,
            rowColumns: firstRow ? getComputedStyle(firstRow).gridTemplateColumns : "",
            copyWidth: firstCopy?.getBoundingClientRect().width || 0,
            statusWidth: firstStatus?.getBoundingClientRect().width || 0,
            descriptions: descriptions.map((description) => {
              const style = getComputedStyle(description);
              return { fontSize: parseFloat(style.fontSize), lineClamp: style.webkitLineClamp };
            }),
            gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns : "",
            names: [...card.querySelectorAll(".camp-revamp-copy strong")].map((name) => ({
              text: name.textContent?.trim() || "",
              clientWidth: name.clientWidth,
              scrollWidth: name.scrollWidth,
              clientHeight: name.clientHeight,
              scrollHeight: name.scrollHeight
            })),
            scrollbarColor: grid ? getComputedStyle(grid).scrollbarColor : "auto",
            lastRowReachable: Boolean(gridBox && lastBox && lastBox.bottom <= gridBox.bottom + 1 && lastBox.top >= gridBox.top - 1)
          };
          if (grid) grid.scrollTop = 0;
          return result;
        });
        assert.notEqual(camp.cardFrame, "none", "Camp card must retain the authoritative gothic frame");
        assert.notEqual(camp.rowFrame, "none", "Camp rows must retain gothic touch-button frames");
        assert(camp.descriptions.length > 0, "Camp must expose readable item descriptions");
        assert.equal(camp.gridColumns.trim().split(/\s+/u).length, 1, `Camp must use one readable touch column: ${camp.gridColumns}`);
        assert(
          camp.descriptions.every((description) => description.fontSize >= 10 && description.lineClamp === "2"),
          `Camp descriptions must use readable two-line copy: ${JSON.stringify(camp.descriptions)}`
        );
        assert.notEqual(camp.scrollbarColor, "auto", "Camp scroll region must expose a visible scrollbar affordance");
        assert.equal(camp.lastRowReachable, true, "Camp last row must be reachable inside its deliberate scroll region");
        assert(
          camp.names.every((name) => name.scrollWidth <= name.clientWidth + 1 && name.scrollHeight <= name.clientHeight + 1),
          `Camp item names must remain fully legible: ${JSON.stringify(camp)}`
        );
      }
      if (shot.id === "03-forge") {
        const forge = await page.locator(".forge-sanctuary").evaluate((card) => {
          const footer = card.querySelector(".forge-footer")?.getBoundingClientRect();
          const choices = card.querySelector(".forge-choice-grid")?.getBoundingClientRect();
          const disabled = card.querySelector('.forge-choice[aria-disabled="true"]');
          const firstChoice = card.querySelector(".forge-choice");
          const cardStyle = getComputedStyle(card);
          const choiceStyle = firstChoice ? getComputedStyle(firstChoice) : null;
          return {
            cardFrame: cardStyle.borderImageSource,
            cardBackground: cardStyle.backgroundImage,
            choiceFrame: choiceStyle?.borderImageSource || "none",
            choiceBackground: choiceStyle?.backgroundImage || "none",
            gridRows: getComputedStyle(card).gridTemplateRows,
            footerHeight: footer?.height || 0,
            choiceHeight: choices?.height || 0,
            disabledOpacity: disabled ? parseFloat(getComputedStyle(disabled).opacity) : 1
          };
        });
        assert.notEqual(forge.cardFrame, "none", "Forge card must retain the authoritative gothic frame");
        assert.match(forge.cardBackground, /anvil-sanctuary-background\.png/u, "Forge must retain its sanctuary art");
        assert.notEqual(forge.choiceFrame, "none", "Forge choices must retain gothic touch-button frames");
        assert.match(forge.choiceBackground, /panel-texture\.png/u, "Forge choices must retain the gothic panel texture");
        assert.equal(forge.gridRows.trim().split(/\s+/u).length, 4, `Forge must use four deliberate layout rows: ${forge.gridRows}`);
        assert(forge.footerHeight <= 53, `Forge Leave footer is oversized: ${JSON.stringify(forge)}`);
        assert(forge.choiceHeight > forge.footerHeight, `Forge choices must dominate the footer: ${JSON.stringify(forge)}`);
        assert(forge.disabledOpacity >= 0.65, `Disabled Forge choice is too muted: ${JSON.stringify(forge)}`);
      }
      if (shot.id === "04-merchant") {
        const closeBox = await page.locator(".merchant-sanctuary [data-action-key='Escape']").boundingBox();
        assert(closeBox && closeBox.width >= 48 && closeBox.height >= 48, "Merchant must expose a 48px touch Back or Close action");
      }
      if (shot.id === "08-pact") {
        const pactTerms = await page.locator(".pact-sanctum-term strong").evaluateAll((terms) => terms.map((term) => {
          const style = getComputedStyle(term);
          return {
            text: term.textContent?.trim() || "",
            whiteSpace: style.whiteSpace,
            overflow: style.overflow,
            clientHeight: term.clientHeight,
            scrollHeight: term.scrollHeight
          };
        }));
        assert(
          pactTerms.length > 0
            && pactTerms.every((term) => term.whiteSpace !== "nowrap" && term.scrollHeight <= term.clientHeight + 1),
          `Pact terms must wrap without clipping: ${JSON.stringify(pactTerms)}`
        );
      }
    }
    if (shot.furyValue) {
      try {
        await page.waitForFunction((expected) => document.getElementById("mobileFuryValue")?.textContent?.trim() === expected, shot.furyValue);
      } catch (error) {
        const actual = await page.evaluate(() => ({
          fury: document.getElementById("mobileFuryValue")?.textContent?.trim(),
          state: JSON.parse(window.render_game_to_text?.() || "{}")
        }));
        throw new Error(`Fury fixture did not reach ${shot.furyValue}: ${JSON.stringify(actual)}`, { cause: error });
      }
      const fury = await page.locator("#mobileFuryMeter").evaluate((element) => ({
        text: element.querySelector("#mobileFuryValue")?.textContent?.trim(),
        now: element.getAttribute("aria-valuenow"),
        max: element.getAttribute("aria-valuemax"),
        width: element.getBoundingClientRect().width,
        scrollWidth: element.scrollWidth
      }));
      assert.deepEqual({ text: fury.text, now: fury.now, max: fury.max }, { text: "7/7", now: "7", max: "7" });
      assert.ok(fury.scrollWidth <= fury.width + 1, "Fury 7/7 meter must not overflow its command-deck slot");
    }
    const metrics = await assertCleanPage(page, captureId);
    if (shot.id === "01-gameplay") {
      const commandLabels = await page.locator("#mobileActionDock .mobile-action-copy strong").evaluateAll((labels) => labels.map((label) => ({
        text: label.textContent?.trim() || "",
        clientWidth: label.clientWidth,
        scrollWidth: label.scrollWidth,
        clientHeight: label.clientHeight,
        scrollHeight: label.scrollHeight
      })));
      assert(
        commandLabels.every((label) => label.scrollWidth <= label.clientWidth + 1 && label.scrollHeight <= label.clientHeight + 1),
        `Mobile command labels must be fully legible: ${JSON.stringify(commandLabels)}`
      );
      const gameplayReference = await page.evaluate(() => {
        const rectOf = (element) => {
          const rect = element?.getBoundingClientRect();
          return rect ? {
            width: rect.width, height: rect.height, top: rect.top,
            bottom: rect.bottom, left: rect.left, right: rect.right
          } : null;
        };
        const styleOf = (element, pseudo = "") => {
          if (!element) return null;
          const style = getComputedStyle(element, pseudo);
          return {
            display: style.display, visibility: style.visibility,
            opacity: Number.parseFloat(style.opacity), fontSize: Number.parseFloat(style.fontSize),
            textTransform: style.textTransform, backgroundImage: style.backgroundImage,
            borderImageSource: style.borderImageSource, width: Number.parseFloat(style.width)
          };
        };
        const visible = (element) => {
          const style = styleOf(element);
          const rect = rectOf(element);
          return Boolean(style && rect && style.display !== "none" && style.visibility !== "hidden" && style.opacity > 0 && rect.width > 0 && rect.height > 0);
        };
        const hasBacking = (element) => {
          const layers = [styleOf(element), styleOf(element, "::before"), styleOf(element, "::after")].filter(Boolean);
          return layers.some((layer) => /(?:panel-texture|gothic-(?:button-frame|dpad-plate)|board-frame|menu-frame|skill-rare-frame)/iu.test(`${layer.backgroundImage} ${layer.borderImageSource}`));
        };
        const deck = document.getElementById("mobileCommandDeck");
        const hud = document.getElementById("mobileHud");
        const row = document.querySelector("#mobileControls .mobile-controls-row");
        const dpad = document.querySelector("#mobileControls .mobile-dpad");
        const actionDock = document.getElementById("mobileActionDock");
        const actionButtons = [...document.querySelectorAll("#mobileActionDock .mact-btn")];
        const regularButtons = actionButtons.filter((button) => !button.classList.contains("mact-q"));
        const labels = [...document.querySelectorAll("#mobileActionDock .mobile-action-copy strong")].map((label) => ({
          text: label.textContent?.trim() || "", rect: rectOf(label), style: styleOf(label)
        }));
        const statuses = [...document.querySelectorAll("#mobileActionDock .mobile-action-copy small")].map((status) => ({
          text: status.textContent?.trim() || "", visible: visible(status), rect: rectOf(status), style: styleOf(status)
        }));
        const icons = actionButtons.map((button) => {
          const icon = button.querySelector("img, .mobile-action-key");
          const label = button.querySelector(".mobile-action-copy strong");
          return { action: button.id, icon: rectOf(icon), label: rectOf(label) };
        });
        const dpadButtons = [...document.querySelectorAll("#mobileControls .mobile-dpad .dpad-btn")].map(rectOf);
        const dpadRect = rectOf(dpad);
        const actionRect = rectOf(actionDock);
        const rowRect = rectOf(row);
        const deckRect = rectOf(deck);
        const hudRect = rectOf(hud);
        const dpadCell = dpadButtons.length ? Math.min(...dpadButtons.map((button) => Math.min(button.width, button.height))) : 0;
        const regularWidths = regularButtons.map((button) => rectOf(button)?.width || 0).filter(Boolean);
        const regularWidth = regularWidths.length ? Math.max(...regularWidths) : 0;
        const extractButton = document.getElementById("mbtnQ");
        const extractRect = rectOf(extractButton);
        const extractPlaqueWidth = styleOf(extractButton, "::before")?.width || 0;
        return {
          labels, statuses, icons, dpadCell,
          extractHitboxWidthRatio: regularWidth > 0 && extractRect ? extractRect.width / regularWidth : 0,
          extractPlaqueWidthRatio: regularWidth > 0 ? extractPlaqueWidth / regularWidth : 0,
          dpadRect, actionRect, rowRect, deckRect, hudRect,
          dpadCenterY: dpadRect ? (dpadRect.top + dpadRect.bottom) / 2 : 0,
          actionCenterY: actionRect ? (actionRect.top + actionRect.bottom) / 2 : 0,
          leftGutter: dpadRect && rowRect ? dpadRect.left - rowRect.left : 0,
          rightGutter: actionRect && rowRect ? rowRect.right - actionRect.right : 0,
          backing: { row: hasBacking(row), dpad: hasBacking(dpad), actionDock: hasBacking(actionDock) }
        };
      });
      assert(
        gameplayReference.labels.length > 0
          && gameplayReference.labels.every(({ style }) => style.fontSize >= 9 && style.fontSize <= 10 && style.textTransform === "uppercase"),
        `Mobile command labels must use 9-10px engraved uppercase type at 844x390: ${JSON.stringify(gameplayReference.labels)}`
      );
      assert(gameplayReference.statuses.every((status) => !status.visible), `Mobile command status ribbons must be visually suppressed at 844x390: ${JSON.stringify(gameplayReference.statuses)}`);
      assert(gameplayReference.icons.every(({ icon, label }) => icon && label && icon.height >= label.height * 2), `Mobile command icons must dominate their labels visually: ${JSON.stringify(gameplayReference.icons)}`);
      assert(gameplayReference.backing.row && gameplayReference.backing.dpad && gameplayReference.backing.actionDock, `Mobile lower control row and both bays must retain visible Gothic frame/texture backing: ${JSON.stringify(gameplayReference.backing)}`);
      assert(
        gameplayReference.hudRect && gameplayReference.actionRect
          && gameplayReference.actionRect.top - gameplayReference.hudRect.bottom <= 12
          && gameplayReference.deckRect && gameplayReference.deckRect.bottom - gameplayReference.actionRect.bottom <= 10,
        `Mobile action bank must fill the framed lower control region: ${JSON.stringify(gameplayReference)}`
      );
      assert(
        gameplayReference.extractHitboxWidthRatio >= 1.8
          && gameplayReference.extractPlaqueWidthRatio >= 1.18
          && gameplayReference.extractPlaqueWidthRatio <= 1.4,
        `Mobile Extract must keep a full-row hitbox and a reference-width visible plaque: ${JSON.stringify(gameplayReference)}`
      );
      assert(
        gameplayReference.dpadCell >= 48 && gameplayReference.dpadRect && gameplayReference.actionRect
          && Math.abs(gameplayReference.dpadCenterY - gameplayReference.actionCenterY) <= 28
          && Math.abs(gameplayReference.leftGutter - gameplayReference.rightGutter) <= 8,
        `Mobile D-pad/action geometry must preserve the approved balanced proportions: ${JSON.stringify(gameplayReference)}`
      );
    }
    const filePath = path.join(OUTPUT_ROOT, `${captureId}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    report.push({ ...shot, id: captureId, filePath, metrics, diagnostics });

    const readGameState = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));

    if (shot.id === "08-pact") {
      await page.locator(".pact-sanctum-leave[data-hd-key='3']").tap();
      await page.waitForFunction(() => !document.querySelector(".overlay-card-pact-sanctum"));
      const state = await readGameState();
      assert.equal(state.phase, "playing", `${captureId} Leave must return to gameplay`);
      assert.equal(state.prompts.pact, false, `${captureId} Leave must close the Pact prompt`);
    }

    if (shot.id === "09-reward" || shot.id === "10-forge-reward") {
      await page.locator(`${shot.overlaySelector} [data-relic-key='1']`).tap();
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "playing");
      await page.locator(shot.overlaySelector).waitFor({ state: "hidden", timeout: 30000 });
      const state = await readGameState();
      assert.equal(state.prompts.relicDraft, false, `${captureId} relic choice must close the reward draft`);
      assert.equal(await page.locator(shot.overlaySelector).isVisible().catch(() => false), false, `${captureId} reward overlay must be removed after choosing`);
    }

    if (shot.id === "11-extract-exchange") {
      const firstRelic = page.locator(".relic-exchange-row[data-camp-key='1']");
      const selectedBefore = await firstRelic.getAttribute("aria-pressed");
      await firstRelic.tap();
      await page.waitForFunction(
        (beforeValue) => document.querySelector(".relic-exchange-row[data-camp-key='1']")?.getAttribute("aria-pressed") !== beforeValue,
        selectedBefore
      );
      assert.notEqual(await firstRelic.getAttribute("aria-pressed"), selectedBefore, `${captureId} relic rows must toggle by touch`);
      await page.locator(".relic-exchange-actions [data-camp-key='y']").tap();
      await page.waitForFunction(() => !document.querySelector(".overlay-card-relic-exchange"));
      const state = await readGameState();
      assert.equal(state.phase, "camp", `${captureId} Sell Selected must return to Camp`);
      await page.waitForFunction(() => /Relics sold:/u.test(document.getElementById("log")?.textContent || ""));
      assert.match(await page.locator("#log").innerText(), /Relics sold:/u, `${captureId} Sell Selected must resolve the exchange`);
    }

    if (shot.id === "12-emergency-extract") {
      await page.locator(".emergency-extract-confirm [data-hd-key='y']").tap();
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "camp");
      const state = await readGameState();
      assert.equal(state.player.gold, 258, `${captureId} emergency extraction must apply the 70% loss`);
      await page.locator(".emergency-extract-confirm").waitFor({ state: "hidden", timeout: 30000 });
      assert.equal(await page.locator(".emergency-extract-confirm").isVisible().catch(() => false), false, `${captureId} confirmation must hide after extraction`);
    }

    if (shot.id === "13-death") {
      await page.locator(".death-requiem-action[data-hd-key='r']").tap();
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "playing");
      await page.locator(".death-requiem").waitFor({ state: "hidden", timeout: 30000 });
      assert.equal(await page.locator(".death-requiem").isVisible().catch(() => false), false, `${captureId} Rise Again must hide the defeat surface`);
    }

    if (shot.id === "14-gameover" || shot.id === "15-victory") {
      await page.locator(`${shot.overlaySelector} [data-hd-key='2']`).tap();
      await page.locator(".record-archive-shell").waitFor({ state: "visible", timeout: 30000 });
      assert.equal((await readGameState()).phase, "menu", `${captureId} Practice Records must enter the menu archive`);
    }

    if (shot.id === "16-records") {
      await page.locator(".ranked-v3-leaderboard-details-button").first().tap();
      await page.locator(".ranked-v3-reference-plate--inspect").waitFor({ state: "visible", timeout: 30000 });
      const backBox = await page.locator(".ranked-v3-inspect-back").boundingBox();
      assert(backBox && backBox.width >= 48 && backBox.height >= 48, `${captureId} record detail Back must remain a 48px target`);
      const detailPath = path.join(OUTPUT_ROOT, `16b-record-detail${suffix}.png`);
      await page.screenshot({ path: detailPath, fullPage: false });
      report.push({ id: `16b-record-detail${suffix}`, filePath: detailPath, diagnostics });
      await page.locator(".ranked-v3-inspect-back").tap();
      await page.locator(".ranked-v3-reference-plate--leaderboard").waitFor({ state: "visible", timeout: 30000 });
    }

    if (shot.id === "17-nickname") {
      const input = page.locator("#nameInput");
      await input.fill("Abyss<>Walker##");
      assert.equal(await input.inputValue(), "AbyssWalker", `${captureId} nickname input must sanitize unsupported characters`);
      await page.locator(".mobile-overlay-action[data-action-key='Enter']").tap();
      await page.locator(".overlay-card-main-menu").waitFor({ state: "visible", timeout: 30000 });
      assert.match(await page.locator(".overlay-card-main-menu").innerText(), /Nickname: AbyssWalker/u, `${captureId} Save must update the visible nickname`);
    }

    if (shot.id === "18-camp-start") {
      await page.locator(".camp-start-choice[data-start-depth-index='3']").tap();
      await page.locator(".camp-start-actions [data-camp-key='Enter']").tap();
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === "playing");
      await page.locator(".camp-start-sanctum").waitFor({ state: "hidden", timeout: 30000 });
      assert.equal(await page.locator(".camp-start-sanctum").isVisible().catch(() => false), false, `${captureId} Start must hide the checkpoint picker`);
    }

    if (shot.id === "04-merchant") {
      await page.locator(".merchant-sanctuary [data-action-key='Escape']").tap();
      await page.locator(".merchant-sanctuary.merchant-view-dashboard").waitFor({ state: "visible", timeout: 30000 });
      await page.locator(".merchant-sanctuary [data-action-key='Escape']").tap();
      await page.waitForFunction(() => !document.getElementById("screenOverlay")?.classList.contains("visible"));
      assert.equal(JSON.parse(await page.evaluate(() => window.render_game_to_text())).phase, "playing");
    }

    if (shot.id === "01-gameplay") {
      await page.locator("#mobileMenuButton").tap();
      await page.waitForFunction(() => document.getElementById("screenOverlay")?.classList.contains("visible"));
      await assertTouchSurfaceStandards(page, "05-mobile-menu");
      const pauseHint = await page.locator(".overlay-card-pause-menu > .overlay-hint").evaluate((hint) => ({
        text: hint.textContent?.trim() || "",
        visible: getComputedStyle(hint).display !== "none" && hint.getBoundingClientRect().height > 0
      }));
      assert.equal(pauseHint.visible, true, "Pause menu must expose its touch guidance");
      assert.match(pauseHint.text, /Tap Continue/u, "Pause menu must explain how to resume on touch");
      assert.match(pauseHint.text, /Swipe to scroll/u, "Pause menu must explain how to reach lower options");
      const menuPath = path.join(OUTPUT_ROOT, "05-mobile-menu.png");
      await page.screenshot({ path: menuPath, fullPage: false });
      report.push({ id: "05-mobile-menu", filePath: menuPath, diagnostics });

      const optionsRow = page.locator(".overlay-card-main-menu .overlay-menu-row").filter({ hasText: "Options" });
      await optionsRow.tap();
      await page.locator(".overlay-card-options").waitFor({ state: "visible", timeout: 30000 });
      await assertTouchSurfaceStandards(page, "06-options");
      const optionsClose = await page.locator(".overlay-card-options [data-action-key='Escape']").boundingBox();
      assert(optionsClose && optionsClose.width >= 48 && optionsClose.height >= 48, "Options must expose a 48px touch Close action");
      const optionsPath = path.join(OUTPUT_ROOT, "06-options.png");
      await page.screenshot({ path: optionsPath, fullPage: false });
      report.push({ id: "06-options", filePath: optionsPath, diagnostics });

      await page.locator(".overlay-card-options [data-action-key='Escape']").tap();
      await page.locator(".overlay-card-main-menu").waitFor({ state: "visible", timeout: 30000 });
      const tutorialRow = page.locator(".overlay-card-main-menu .overlay-menu-row").filter({ hasText: "Tutorial" });
      await tutorialRow.tap();
      await page.locator(".overlay-card-options-tutorial").waitFor({ state: "visible", timeout: 30000 });
      await assertTouchSurfaceStandards(page, "07-tutorial");
      const tutorialClose = await page.locator(".overlay-card-options-tutorial [data-action-key='Escape']").boundingBox();
      assert(tutorialClose && tutorialClose.width >= 48 && tutorialClose.height >= 48, "Tutorial must expose a 48px touch Close action");
      const tutorialPath = path.join(OUTPUT_ROOT, "07-tutorial.png");
      await page.screenshot({ path: tutorialPath, fullPage: false });
      report.push({ id: "07-tutorial", filePath: tutorialPath, diagnostics });
      await page.locator(".overlay-card-options-tutorial [data-action-key='Escape']").tap();
      await page.locator(".overlay-card-main-menu").waitFor({ state: "visible", timeout: 30000 });
    }
  } finally {
    await context.close();
  }
}

async function main() {
  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const preview = await startMobilePreviewServer({ host: "127.0.0.1", port: 0 });
  const { chromium } = loadPlaywright();
  const browser = await launchMutedBrowser(chromium, { headless: true });
  const report = [];
  try {
    await capturePortrait(browser, preview.url, report);
    for (const shot of SHOTS) await captureShot(browser, preview.url, shot, report);
    for (const shot of SHOTS.filter(({ id }) => ["02-camp", "03-forge", "04-merchant", "08-pact"].includes(id))) {
      await captureShot(browser, preview.url, shot, report, PORTRAIT, "-portrait");
    }
    for (const shot of JOURNEY_SHOTS) {
      await captureShot(browser, preview.url, shot, report, PORTRAIT, "-portrait");
    }
    for (const shot of JOURNEY_SHOTS.filter(({ id }) => ["09-reward", "13-death", "14-gameover"].includes(id))) {
      await captureShot(browser, preview.url, shot, report, LANDSCAPE, "-landscape");
    }
    for (const entry of report) {
      assert.deepEqual(entry.diagnostics.consoleErrors, [], `${entry.id} console errors`);
      assert.deepEqual(entry.diagnostics.pageErrors, [], `${entry.id} page errors`);
      assert.deepEqual(entry.diagnostics.apiRequests, [], `${entry.id} emitted /api requests`);
    }
    await fs.writeFile(path.join(OUTPUT_ROOT, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  } finally {
    await browser.close();
    await new Promise((resolve) => preview.server.close(resolve));
  }
  console.log(`Mobile gallery PASS: ${report.map((entry) => entry.id).join(", ")}`);
  console.log(`Output: ${OUTPUT_ROOT}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
