(function exposeRankedV3LeaderboardUi(root, factory) {
  "use strict";
  const api = factory(root);
  if (root) root.DungeonRankedV3LeaderboardUi = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function leaderboardUi(root) {
  "use strict";
  const SELECTORS = Object.freeze({ archive: "ranked-v3-record-archive", list: "ranked-v3-leaderboard-list", row: "ranked-v3-leaderboard-row", detailsButton: "ranked-v3-leaderboard-details-button", detail: "ranked-v3-leaderboard-detail", build: "ranked-v3-leaderboard-build", plate: "ranked-v3-reference-plate", leaderboardPlate: "ranked-v3-reference-plate--leaderboard", art: "ranked-v3-reference-plate-art", overlay: "ranked-v3-reference-plate-overlay", podiumSlot: "ranked-v3-podium-slot", ledgerSlot: "ranked-v3-ledger-slot" });
  const MAX_ROWS = 73;
  const PODIUM_SIZE = 3;
  const LEDGER_ROWS_PER_PAGE = 7;
  const MAX_LEDGER_PAGES = 10;
  const integer = (value) => Math.max(0, Math.floor(Number(value) || 0));
  const humanize = (value) => String(value || "").replace(/[_-]+/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase()) || "None";
  const duration = (value) => { const seconds = Math.floor(integer(value) / 1000); const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; };
  const element = (documentRef, tag, className, value = "") => { const node = documentRef.createElement(tag); node.className = className; node.textContent = String(value); return node; };
  const relicName = (id) => String(root?.DungeonRelicData?.RELICS?.find((relic) => relic.id === id)?.name || humanize(id));
  const normalizeBuild = (value) => { const build = value && typeof value === "object" ? value : {}; return { relics: Array.isArray(build.relics) ? build.relics.map((relic) => ({ relicId: String(relic?.relicId || relic?.id || ""), stacks: Math.max(1, integer(relic?.stacks)) })).filter((relic) => relic.relicId) : [], pacts: Array.isArray(build.pacts) ? build.pacts.filter((id) => typeof id === "string") : [], skillTiers: build.skillTiers && typeof build.skillTiers === "object" ? { ...build.skillTiers } : {}, campUpgrades: build.campUpgrades && typeof build.campUpgrades === "object" ? { ...build.campUpgrades } : {}, elixirs: Array.isArray(build.elixirs) ? build.elixirs.map((item) => ({ ...item })) : [], runModifiers: Array.isArray(build.runModifiers?.active) ? build.runModifiers.active.map((item) => ({ ...item })) : [] }; };
  const toLeaderboardRow = (entry, index = 0) => Object.freeze({ runId: String(entry?.runId || ""), rank: Math.max(1, integer(entry?.rank) || index + 1), playerName: String(entry?.playerName || "Anonymous"), score: integer(entry?.score), depth: integer(entry?.depth), gold: integer(entry?.gold), durationMs: integer(entry?.durationMs), outcome: String(entry?.outcome || ""), verificationLevel: String(entry?.verificationLevel || ""), createdAt: integer(entry?.createdAt) });
  const createLeaderboardViewModel = (payload = {}, rankOffset = 0) => Object.freeze({ season: String(payload.season || ""), status: String(payload.status || "ready"), cursor: typeof payload.cursor === "string" && payload.cursor ? payload.cursor : null, rows: Object.freeze((Array.isArray(payload.entries) ? payload.entries : []).slice(0, MAX_ROWS).map((entry, index) => toLeaderboardRow(entry, rankOffset + index))) });
  const createLeaderboardPresentation = (rows = [], requestedPage = 1) => {
    const source = (Array.isArray(rows) ? rows : []).slice(0, MAX_ROWS);
    const podium = source.slice(0, PODIUM_SIZE);
    const ledgerSource = source.slice(PODIUM_SIZE);
    const pageCount = Math.min(MAX_LEDGER_PAGES, Math.max(1, Math.ceil(ledgerSource.length / LEDGER_ROWS_PER_PAGE)));
    const page = Math.min(pageCount, Math.max(1, integer(requestedPage) || 1));
    const offset = (page - 1) * LEDGER_ROWS_PER_PAGE;
    const ledger = ledgerSource.slice(offset, offset + LEDGER_ROWS_PER_PAGE);
    const firstRank = ledger[0]?.rank || 0;
    const lastRank = ledger.at(-1)?.rank || 0;
    return Object.freeze({
      podium: Object.freeze(podium),
      ledger: Object.freeze(ledger),
      page,
      pageCount,
      pageLabel: `Page ${page} / ${pageCount}`,
      rangeLabel: ledger.length ? `Ranks ${firstRank}-${lastRank}` : "No ranked entries",
      canGoPrevious: page > 1,
      canGoNext: page < pageCount
    });
  };
  async function collectLeaderboardRows(list, options = {}) {
    const rows = [];
    const seenCursors = new Set();
    const season = String(options.season || "");
    let cursor = "";
    while (rows.length < MAX_ROWS) {
      const payload = await list({ season, limit: 50, cursor });
      const page = createLeaderboardViewModel(payload, rows.length);
      rows.push(...page.rows.slice(0, MAX_ROWS - rows.length));
      if (rows.length >= MAX_ROWS || !page.cursor || page.cursor === cursor || seenCursors.has(page.cursor)) break;
      seenCursors.add(page.cursor);
      cursor = page.cursor;
    }
    return Object.freeze(rows);
  }
  const createDetailViewModel = (payload = {}) => { const entry = payload.entry && typeof payload.entry === "object" ? payload.entry : {}; const hasValue = (key) => Object.hasOwn(entry, key) && entry[key] !== null && entry[key] !== undefined; return Object.freeze({ ...toLeaderboardRow(entry), season: String(entry.season || ""), build: Object.freeze(normalizeBuild(entry.build)), summary: Object.freeze(entry.summary && typeof entry.summary === "object" ? { ...entry.summary } : {}), detailsAvailable: entry.detailsAvailable !== false, detailsUnavailableNotice: String(entry.detailsUnavailableNotice || ""), presentationFields: Object.freeze({ score: hasValue("score"), depth: hasValue("depth"), gold: hasValue("gold") }) }); };
  function name(documentRef, row, open) {
    const node = element(documentRef, "button", "record-archive-name", row.playerName);
    node.type = "button";
    node.setAttribute("data-record-field", "name");
    node.setAttribute("data-record-nav-region", "row");
    node.setAttribute("data-record-run-id", row.runId);
    node.setAttribute("data-record-action", "name");
    node.setAttribute("data-record-row-index", String(Math.max(0, integer(row.rank) - 1)));
    node.setAttribute("aria-label", `${row.playerName}, inspect build`);
    node.addEventListener("click", () => open(row.runId, "name"), { once: true });
    return node;
  }
  function inspect(documentRef, row, open) {
    const node = element(documentRef, "button", SELECTORS.detailsButton, "Inspect build");
    node.type = "button";
    node.setAttribute("data-record-nav-region", "row");
    node.setAttribute("data-record-run-id", row.runId);
    node.setAttribute("data-record-action", "inspect");
    node.setAttribute("data-record-row-index", String(Math.max(0, integer(row.rank) - 1)));
    node.setAttribute("aria-label", `Inspect build for ${row.playerName}`);
    node.addEventListener("click", () => open(row.runId, "inspect"), { once: true });
    return node;
  }
  function listHandlers(value) {
    if (typeof value === "function") return { onOpen: value, onPage: () => {}, onClose: () => {} };
    const source = value && typeof value === "object" ? value : {};
    return {
      onOpen: typeof source.onOpen === "function" ? source.onOpen : () => {},
      onPage: typeof source.onPage === "function" ? source.onPage : () => {},
      onClose: typeof source.onClose === "function" ? source.onClose : () => {}
    };
  }

  function control(documentRef, className, value, handler, disabled = false) {
    const node = element(documentRef, "button", className, value);
    node.type = "button";
    node.disabled = Boolean(disabled);
    if (!node.disabled) node.addEventListener("click", handler, { once: true });
    return node;
  }

  function recordNavMeta(node, region, action, runId = "") {
    node.setAttribute("data-record-nav-region", region);
    node.setAttribute("data-record-action", action);
    if (runId) node.setAttribute("data-record-run-id", runId);
    return node;
  }

  const navAttr = (node, name) => String(node?.getAttribute?.(name) || node?.attributes?.get?.(name) || "");
  const navDescendants = (rootNode, predicate) => {
    const found = [];
    const walk = (node) => {
      if (predicate(node)) found.push(node);
      for (const child of node?.children || []) walk(child);
    };
    walk(rootNode);
    return found;
  };
  const navInside = (rootNode, node) => {
    let current = node;
    while (current) {
      if (current === rootNode) return true;
      current = current.parentNode;
    }
    return false;
  };
  const navActions = (rootNode, region, includeDisabled = false) => navDescendants(rootNode, (node) => (
    navAttr(node, "data-record-nav-region") === region && (includeDisabled || !node.disabled)
  ));
  const navFocus = (node) => {
    if (node && !node.disabled && typeof node.focus === "function") node.focus();
    return node;
  };
  const navKey = (event) => String(event?.key || "");
  const navSpace = (key) => key === " " || key === "Spacebar" || key.toLowerCase() === "space";

  function attachRecordNavigation(rootNode, options = {}) {
    if (!rootNode || typeof rootNode.addEventListener !== "function") return null;
    const mode = options.mode === "detail" ? "detail" : "list";
    let lastRowAction = "name";
    const documentRef = rootNode.ownerDocument || root;
    const focusDefault = () => {
      const rows = navActions(rootNode, "row");
      const footer = navActions(rootNode, "footer");
      return navFocus(mode === "detail" ? navActions(rootNode, "equipment")[0] || navActions(rootNode, "detail-action")[0] : rows[0] || footer[0]);
    };
    const equipmentColumns = () => {
      const grid = navDescendants(rootNode, (node) => String(node?.className || "").split(/\s+/u).includes("ranked-v3-inspect-equipment-grid"))[0];
      const template = String(documentRef?.defaultView?.getComputedStyle?.(grid)?.gridTemplateColumns || "");
      const count = template.trim() && template.trim() !== "none" ? template.trim().split(/\s+/u).filter(Boolean).length : 0;
      return Number.isFinite(count) && count > 0 ? count : 5;
    };
    const listGroups = () => {
      const groups = [];
      const byRun = new Map();
      for (const node of navActions(rootNode, "row")) {
        const runId = navAttr(node, "data-record-run-id");
        if (!byRun.has(runId)) {
          const group = { runId, actions: [] };
          byRun.set(runId, group);
          groups.push(group);
        }
        byRun.get(runId).actions.push(node);
      }
      return groups;
    };
    const activeNode = () => {
      const active = documentRef?.activeElement;
      return navInside(rootNode, active) && navAttr(active, "data-record-nav-region") ? active : null;
    };
    const focusRow = (group, action) => navFocus(group?.actions.find((node) => navAttr(node, "data-record-action") === action) || group?.actions[0]);
    const footerMove = (active, direction) => {
      const enabled = navActions(rootNode, "footer");
      if (!enabled.length) return null;
      const current = enabled.indexOf(active);
      const next = current < 0 ? 0 : (current + direction + enabled.length) % enabled.length;
      return navFocus(enabled[next]);
    };
    const invokePage = (action) => {
      const target = navActions(rootNode, "footer", true).find((node) => navAttr(node, "data-record-action") === action);
      if (target && !target.disabled) target.click();
    };
    const handleList = (key, active) => {
      const groups = listGroups();
      const footer = navActions(rootNode, "footer", true);
      const enabledFooter = footer.filter((node) => !node.disabled);
      if (!active) active = groups[0]?.actions[0] || enabledFooter[0] || null;
      if (!active) return;
      const region = navAttr(active, "data-record-nav-region");
      if (region === "footer") {
        if (key === "ArrowLeft" || key.toLowerCase() === "a") footerMove(active, -1);
        else if (key === "ArrowRight" || key.toLowerCase() === "d") footerMove(active, 1);
        else if (key === "ArrowUp" || key.toLowerCase() === "w") focusRow(groups.at(-1), lastRowAction);
        else if (key === "PageUp") invokePage("previous");
        else if (key === "PageDown") invokePage("next");
        else if (key === "Enter" || navSpace(key)) active.click();
        return;
      }
      const groupIndex = groups.findIndex((group) => group.actions.includes(active));
      if (groupIndex < 0) return;
      const currentAction = navAttr(active, "data-record-action");
      lastRowAction = currentAction;
      if (key === "ArrowLeft" || key.toLowerCase() === "a" || key === "ArrowRight" || key.toLowerCase() === "d") {
        focusRow(groups[groupIndex], currentAction === "name" ? "inspect" : "name");
      } else if (key === "ArrowUp" || key.toLowerCase() === "w") {
        if (groupIndex > 0) focusRow(groups[groupIndex - 1], currentAction);
      } else if (key === "ArrowDown" || key.toLowerCase() === "s") {
        if (groupIndex < groups.length - 1) focusRow(groups[groupIndex + 1], currentAction);
        else navFocus(enabledFooter[0]);
      } else if (key === "PageUp") invokePage("previous");
      else if (key === "PageDown") invokePage("next");
      else if (key === "Enter" || navSpace(key)) active.click();
    };
    const handleDetail = (key, active) => {
      const equipment = navActions(rootNode, "equipment");
      const detailActions = navActions(rootNode, "detail-action");
      if (!active) active = equipment[0] || detailActions[0] || null;
      if (!active) return;
      const region = navAttr(active, "data-record-nav-region");
      if (region === "equipment") {
        const index = Number(navAttr(active, "data-relic-index"));
        const find = (delta, limit = 10) => equipment.find((node) => {
          const candidate = Number(navAttr(node, "data-relic-index"));
          return candidate >= 0 && candidate < limit && ((delta > 0 && candidate > index) || (delta < 0 && candidate < index));
        });
        let target = null;
        const columns = equipmentColumns();
        if (key === "ArrowRight" || key.toLowerCase() === "d") target = find(1, Math.floor(index / columns) * columns + columns);
        else if (key === "ArrowLeft" || key.toLowerCase() === "a") target = equipment.slice().reverse().find((node) => Number(navAttr(node, "data-relic-index")) < index && Number(navAttr(node, "data-relic-index")) >= Math.floor(index / columns) * columns);
        else if (key === "ArrowDown" || key.toLowerCase() === "s") target = equipment.find((node) => Number(navAttr(node, "data-relic-index")) === index + columns);
        else if (key === "ArrowUp" || key.toLowerCase() === "w") target = equipment.find((node) => Number(navAttr(node, "data-relic-index")) === index - columns);
        if (target) navFocus(target);
        else if (key === "ArrowDown" || key.toLowerCase() === "s") navFocus(detailActions[0]);
        else if ((key === "ArrowUp" || key.toLowerCase() === "w") && index >= columns) navFocus(equipment.slice().reverse().find((node) => Number(navAttr(node, "data-relic-index")) < index));
        else if (key === "Enter" || navSpace(key)) active.click();
        return;
      }
      const detailIndex = detailActions.indexOf(active);
      if ((key === "ArrowDown" || key.toLowerCase() === "s") && detailIndex < detailActions.length - 1) navFocus(detailActions[detailIndex + 1]);
      else if (key === "ArrowUp" || key.toLowerCase() === "w") navFocus(detailIndex > 0 ? detailActions[detailIndex - 1] : equipment.at(-1));
      else if (key === "Enter" || navSpace(key)) active.click();
    };
    const onKeydown = (event) => {
      const key = navKey(event);
      if (key === "Tab") {
        event.stopPropagation?.();
        return;
      }
      const handled = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Enter", "Escape", "w", "W", "a", "A", "s", "S", "d", "D"].includes(key) || navSpace(key);
      if (!handled) return;
      event.stopPropagation?.();
      if (mode === "detail" && (key === "PageUp" || key === "PageDown")) return;
      event.preventDefault?.();
      if (key === "Escape") {
        if (mode === "detail") options.onBack?.();
        else options.onClose?.();
        return;
      }
      const active = activeNode();
      if (mode === "detail") handleDetail(key, active);
      else handleList(key, active);
    };
    const onFocusin = (event) => {
      const target = event?.target || documentRef?.activeElement;
      if (!navInside(rootNode, target) || navAttr(target, "data-record-nav-region") !== "row") return;
      const action = navAttr(target, "data-record-action");
      if (action === "name" || action === "inspect") lastRowAction = action;
    };
    rootNode.addEventListener("keydown", onKeydown);
    rootNode.addEventListener("focusin", onFocusin);
    return Object.freeze({ focusDefault, destroy: () => {
      rootNode.removeEventListener?.("keydown", onKeydown);
      rootNode.removeEventListener?.("focusin", onFocusin);
    } });
  }

  function scoreDisplay(documentRef, className, value, tagName = "span") {
    const node = element(documentRef, tagName, className);
    node.append(
      element(documentRef, "span", "ranked-v3-score-value", grouped(value)),
      element(documentRef, "span", "ranked-v3-score-unit", "pts")
    );
    return node;
  }

  function leaderboardSlot(documentRef, row, slotClass, open, layout = "ledger") {
    const slot = element(documentRef, "article", `${slotClass} ${SELECTORS.row}`);
    slot.setAttribute("data-record-layout", layout);
    if (!row) {
      slot.setAttribute("aria-hidden", "true");
      return slot;
    }
    slot.setAttribute("data-record-rank", String(row.rank));
    const identity = element(documentRef, "div", "ranked-v3-leaderboard-slot-identity");
    const rank = element(documentRef, "span", "ranked-v3-leaderboard-rank", String(row.rank));
    if (layout === "podium") {
      rank.setAttribute("aria-hidden", "true");
      identity.append(
        rank,
        element(documentRef, "span", "ranked-v3-rank-label", `Rank ${row.rank}`),
        name(documentRef, row, open)
      );
    } else {
      identity.append(rank, name(documentRef, row, open));
    }
    const score = scoreDisplay(documentRef, "ranked-v3-leaderboard-score", row.score);
    if (layout === "podium") {
      const meta = element(documentRef, "div", "ranked-v3-podium-meta");
      meta.append(
        element(documentRef, "span", "ranked-v3-leaderboard-depth", `Depth ${grouped(row.depth)}`),
        element(documentRef, "span", "ranked-v3-podium-divider", "|"),
        element(documentRef, "span", "ranked-v3-leaderboard-gold", `Gold ${grouped(row.gold)}`)
      );
      meta.children[1]?.setAttribute("aria-hidden", "true");
      slot.append(identity, score, meta, inspect(documentRef, row, open));
    } else {
      slot.append(
        identity,
        score,
        element(documentRef, "span", "ranked-v3-leaderboard-depth", grouped(row.depth)),
        element(documentRef, "span", "ranked-v3-leaderboard-gold", grouped(row.gold)),
        inspect(documentRef, row, open)
      );
    }
    return slot;
  }

  function renderList(documentRef, presentationInput, handlerInput) {
    const presentation = presentationInput && !Array.isArray(presentationInput) && Array.isArray(presentationInput.podium) && Array.isArray(presentationInput.ledger)
      ? presentationInput
      : createLeaderboardPresentation(Array.isArray(presentationInput) ? presentationInput : [], 1);
    const handlers = listHandlers(handlerInput);
    const rootNode = element(documentRef, "section", `${SELECTORS.plate} ${SELECTORS.leaderboardPlate} ${SELECTORS.list}`);
    rootNode.append(element(documentRef, "h2", "ranked-v3-reference-plate-title", "Ranked Leaderboard"));
    const art = element(documentRef, "div", SELECTORS.art);
    art.setAttribute("aria-hidden", "true");
    const overlay = element(documentRef, "div", SELECTORS.overlay + " ranked-v3-leaderboard-overlay");
    const heading = element(documentRef, "header", "ranked-v3-leaderboard-heading");
    heading.append(
      element(documentRef, "p", "ranked-v3-leaderboard-display-title", "Ranked Leaderboard"),
      element(documentRef, "p", "ranked-v3-leaderboard-season", "Current Season")
    );
    const podium = element(documentRef, "section", "ranked-v3-leaderboard-podium");
    for (let rank = 1; rank <= PODIUM_SIZE; rank += 1) {
      const row = presentation.podium.find((candidate) => candidate.rank === rank) || null;
      podium.append(leaderboardSlot(documentRef, row, SELECTORS.podiumSlot, handlers.onOpen, "podium"));
    }
    const ledger = element(documentRef, "section", "ranked-v3-leaderboard-ledger");
    const columnHeadings = element(documentRef, "div", "ranked-v3-leaderboard-columns");
    for (const label of ["Rank", "Name", "Score", "Depth", "Gold", "Inspect Build"]) columnHeadings.append(element(documentRef, "span", "ranked-v3-leaderboard-column", label));
    const ledgerRows = element(documentRef, "div", "ranked-v3-leaderboard-ledger-rows");
    for (let index = 0; index < LEDGER_ROWS_PER_PAGE; index += 1) {
      ledgerRows.append(leaderboardSlot(documentRef, presentation.ledger[index] || null, SELECTORS.ledgerSlot, handlers.onOpen, "ledger"));
    }
    ledger.append(columnHeadings, ledgerRows);
    const pager = element(documentRef, "nav", "ranked-v3-leaderboard-pager");
    pager.setAttribute("aria-label", "Leaderboard pages");
    const previous = recordNavMeta(control(documentRef, "ranked-v3-leaderboard-page-control", "Previous page", () => handlers.onPage(presentation.page - 1), !presentation.canGoPrevious), "footer", "previous");
    const next = recordNavMeta(control(documentRef, "ranked-v3-leaderboard-page-control", "Next page", () => handlers.onPage(presentation.page + 1), !presentation.canGoNext), "footer", "next");
    const close = recordNavMeta(control(documentRef, "ranked-v3-leaderboard-close", "Close", handlers.onClose), "footer", "close");
    pager.append(
      previous,
      element(documentRef, "p", "ranked-v3-leaderboard-page-label", presentation.pageLabel),
      element(documentRef, "p", "ranked-v3-leaderboard-range-label", presentation.rangeLabel),
      next,
      close
    );
    overlay.append(heading, podium, ledger, pager);
    rootNode.append(art, overlay);
    attachRecordNavigation(rootNode, { mode: "list", onPage: handlers.onPage, onClose: handlers.onClose });
    return rootNode;
  }
  function grouped(value) { return integer(value).toLocaleString("en-US"); }

  function inspectHandlers(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      onBack: typeof source.onBack === "function" ? source.onBack : () => {},
      onClose: typeof source.onClose === "function" ? source.onClose : () => {}
    };
  }

  function equipmentSlot(documentRef, relic, index) {
    const slot = element(documentRef, "article", "ranked-v3-inspect-equipment-slot");
    if (!relic) {
      slot.setAttribute("aria-hidden", "true");
      return slot;
    }
    const definition = root?.DungeonRelicData?.RELICS?.find((item) => item.id === relic.relicId);
    const relicTooltip = [
      String(definition?.name || relicName(relic.relicId)),
      String(definition?.desc || definition?.description || "Description unavailable."),
      `Stack x${Math.max(1, integer(relic.stacks))}`
    ].join(" | ");
    slot.setAttribute("data-relic-index", String(index));
    recordNavMeta(slot, "equipment", "equipment");
    slot.setAttribute("tabindex", "0");
    slot.setAttribute("data-record-tooltip", relicTooltip);
    slot.setAttribute("aria-label", relicTooltip);
    const iconSrc = String(definition?.icon || definition?.iconSrc || "");
    if (iconSrc) {
      const icon = element(documentRef, "img", "ranked-v3-inspect-equipment-icon");
      icon.src = iconSrc;
      icon.alt = "";
      slot.append(icon);
    } else {
      slot.append(element(documentRef, "span", "ranked-v3-inspect-equipment-fallback", "?"));
    }
    return slot;
  }

  function mutatorTooltip(active) {
    if (!Array.isArray(active) || !active.length) return "No mutators used";
    return active.map((modifier) => {
      const id = String(modifier?.modifierId || modifier?.id || "");
      const found = root?.DungeonMutatorData?.MUTATORS?.find((item) => item.id === id);
      return [found?.key ? `[${found.key}]` : "", found?.name || humanize(id), found?.bonus, found?.drawback].filter(Boolean).join(" ");
    }).join(" | ");
  }

  function chronicleRow(documentRef, label, value) {
    const row = element(documentRef, "article", "ranked-v3-inspect-chronicle-row");
    row.append(element(documentRef, "span", "ranked-v3-inspect-chronicle-label", label));
    row.append(typeof value === "string" ? element(documentRef, "span", "ranked-v3-inspect-chronicle-value", value) : value);
    return row;
  }

  function inspectStat(documentRef, className, label, value) {
    const stat = element(documentRef, "p", className);
    stat.append(
      element(documentRef, "span", "ranked-v3-inspect-stat-label", label),
      element(documentRef, "span", "ranked-v3-inspect-stat-value", grouped(value))
    );
    return stat;
  }
  function renderDetail(documentRef, detail, handlerInput) {
    const handlers = inspectHandlers(handlerInput);
    const summary = detail.summary || {};
    const active = detail.build.runModifiers || [];
    const cause = String(summary.presentationCause || "").trim();
    const isVictory = String(detail.outcome || "").toLowerCase() === "victory";
    const detailsAvailable = detail.detailsAvailable !== false;
    const presentationFields = detail.presentationFields || {};
    const rootNode = element(documentRef, "section", `${SELECTORS.plate} ranked-v3-reference-plate--inspect ${SELECTORS.detail}`);
    rootNode.append(element(documentRef, "h2", "ranked-v3-reference-plate-title", "Inspect Build"));
    const art = element(documentRef, "div", SELECTORS.art);
    art.setAttribute("aria-hidden", "true");
    const overlay = element(documentRef, "div", `${SELECTORS.overlay} ranked-v3-inspect-overlay`);
    const header = element(documentRef, "header", "ranked-v3-inspect-header");
    const rank = element(documentRef, "p", "ranked-v3-inspect-rank", String(detail.rank));
    rank.setAttribute("data-record-rank", String(detail.rank));
    rank.setAttribute("data-rank-digits", integer(detail.rank) >= 10 ? "double" : "single");
    header.append(
      rank,
      element(documentRef, "h3", "ranked-v3-inspect-player", detail.playerName)
    );
    if (detailsAvailable || presentationFields.score) header.append(scoreDisplay(documentRef, "ranked-v3-inspect-score", detail.score, "p"), element(documentRef, "p", "ranked-v3-inspect-score-label", "Final Score"));
    if (detailsAvailable || presentationFields.depth) header.append(inspectStat(documentRef, "ranked-v3-inspect-depth", "Depth", detail.depth));
    if (detailsAvailable || presentationFields.gold) header.append(inspectStat(documentRef, "ranked-v3-inspect-gold", "Gold", detail.gold));
    if (!detailsAvailable) {
      const notice = detail.detailsUnavailableNotice || "Build Chronicle unavailable.";
      const loadout = element(documentRef, "section", "ranked-v3-inspect-loadout");
      loadout.append(element(documentRef, "p", "ranked-v3-inspect-unavailable", notice));
      const actions = element(documentRef, "nav", "ranked-v3-inspect-actions");
      actions.append(recordNavMeta(control(documentRef, "ranked-v3-inspect-back", "Back to Leaderboard", handlers.onBack), "detail-action", "back"));
      overlay.append(header, loadout, actions);
      rootNode.append(art, overlay);
      attachRecordNavigation(rootNode, { mode: "detail", onBack: handlers.onBack, onClose: handlers.onClose });
      return rootNode;
    }
    const loadout = element(documentRef, "section", "ranked-v3-inspect-loadout");
    loadout.append(element(documentRef, "h3", "ranked-v3-inspect-section-title", "Build Loadout"));
    const equipment = element(documentRef, "div", "ranked-v3-inspect-equipment-grid");
    const relics = detail.build.relics.slice(0, 10);
    for (let index = 0; index < 10; index += 1) equipment.append(equipmentSlot(documentRef, relics[index] || null, index));
    loadout.append(equipment);
    const chronicle = element(documentRef, "section", "ranked-v3-inspect-chronicle");
    chronicle.append(element(documentRef, "h3", "ranked-v3-inspect-section-title", "Run Chronicle"));
    const metrics = element(documentRef, "div", "ranked-v3-inspect-chronicle-rows");
    const mutators = element(documentRef, "button", "ranked-v3-inspect-mutators", active.length ? String(active.length) : "No mutators used");
    mutators.type = "button";
    mutators.setAttribute("tabindex", "0");
    const tooltip = mutatorTooltip(active);
    mutators.setAttribute("data-record-tooltip", tooltip);
    mutators.setAttribute("aria-label", tooltip);
    recordNavMeta(mutators, "detail-action", "mutators");
    const earnedGold = summary.gold && typeof summary.gold === "object" ? summary.gold.earned : (summary.goldEarned ?? detail.gold);
    metrics.append(
      chronicleRow(documentRef, "Time Played", duration(summary.durationMs ?? detail.durationMs)),
      chronicleRow(documentRef, "Rooms Cleared", grouped(summary.roomsCompleted)),
      chronicleRow(documentRef, "Bosses Defeated", grouped(summary.bossesCompleted)),
      chronicleRow(documentRef, "Mutators", mutators),
      chronicleRow(documentRef, "Highest Depth", grouped(detail.depth)),
      chronicleRow(documentRef, "Gold Earned", grouped(earnedGold)),
      chronicleRow(documentRef, "Final Score", grouped(detail.score))
    );
    chronicle.append(metrics);
    const terminal = element(documentRef, "section", "ranked-v3-inspect-terminal");
    terminal.append(
      element(documentRef, "h3", "ranked-v3-inspect-terminal-title", isVictory ? "Victory" : "Game Over"),
      element(documentRef, "p", "ranked-v3-inspect-terminal-eyebrow", isVictory ? "Run completed" : "Fell in combat"),
      element(documentRef, "p", "ranked-v3-inspect-terminal-cause", isVictory ? "The descent was conquered." : (cause || "Cause not recorded."))
    );
    const actions = element(documentRef, "nav", "ranked-v3-inspect-actions");
    actions.append(recordNavMeta(control(documentRef, "ranked-v3-inspect-back", "Back to Leaderboard", handlers.onBack), "detail-action", "back"));
    overlay.append(header, loadout, chronicle, terminal, actions);
    rootNode.append(art, overlay);
    attachRecordNavigation(rootNode, { mode: "detail", onBack: handlers.onBack, onClose: handlers.onClose });
    return rootNode;
  }
  const createReferencePlateFocusToken = (runId, action) => Object.freeze({
    region: "row",
    runId: String(runId || ""),
    action: String(action || "")
  });
  const focusReferencePlateAction = (rootNode, reference = {}, fallback = true) => {
    const source = reference && typeof reference === "object" ? reference : {};
    const region = String(source.region || "");
    const action = String(source.action || "");
    const runId = String(source.runId || "");
    const hasReference = Boolean(region || action || runId);
    const target = hasReference && navDescendants(rootNode, (node) => (
      (!region || navAttr(node, "data-record-nav-region") === region)
      && (!action || navAttr(node, "data-record-action") === action)
      && (!runId || navAttr(node, "data-record-run-id") === runId)
      && !node.disabled
    ))[0];
    if (target) return navFocus(target);
    if (!fallback) return null;
    return navFocus(navActions(rootNode, "row")[0] || navActions(rootNode, "footer")[0] || null);
  };
  return Object.freeze({ SELECTORS, normalizeBuild, toLeaderboardRow, createLeaderboardViewModel, createLeaderboardPresentation, collectLeaderboardRows, createDetailViewModel, renderList, renderDetail, attachRecordNavigation, createReferencePlateFocusToken, focusReferencePlateAction });
});
