(function exposeRankedV3LeaderboardUi(root, factory) {
  "use strict";
  const api = factory(root);
  if (root) root.DungeonRankedV3LeaderboardUi = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function leaderboardUi(root) {
  "use strict";
  const SELECTORS = Object.freeze({ archive: "ranked-v3-record-archive", list: "ranked-v3-leaderboard-list", row: "ranked-v3-leaderboard-row", detailsButton: "ranked-v3-leaderboard-details-button", detail: "ranked-v3-leaderboard-detail", build: "ranked-v3-leaderboard-build" });
  const MAX_ROWS = 73;
  const PODIUM_SIZE = 3;
  const LEDGER_ROWS_PER_PAGE = 7;
  const MAX_LEDGER_PAGES = 10;
  const integer = (value) => Math.max(0, Math.floor(Number(value) || 0));
  const humanize = (value) => String(value || "").replace(/[_-]+/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase()) || "None";
  const duration = (value) => { const seconds = Math.floor(integer(value) / 1000); return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`; };
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
  const createDetailViewModel = (payload = {}) => { const entry = payload.entry && typeof payload.entry === "object" ? payload.entry : {}; return Object.freeze({ ...toLeaderboardRow(entry), season: String(entry.season || ""), build: Object.freeze(normalizeBuild(entry.build)), summary: Object.freeze(entry.summary && typeof entry.summary === "object" ? { ...entry.summary } : {}) }); };
  function fact(documentRef, field, label, value) { const node = element(documentRef, "div", "record-archive-fact"); node.setAttribute("data-record-field", field); node.append(element(documentRef, "span", "record-archive-fact-label", label), element(documentRef, "strong", "record-archive-fact-value", value)); return node; }
  function name(documentRef, row, open) { const node = element(documentRef, "button", "record-archive-name", row.playerName); node.type = "button"; node.setAttribute("data-record-field", "name"); node.addEventListener("click", () => open(row.runId), { once: true }); return node; }
  function inspect(documentRef, row, open) { const node = element(documentRef, "button", SELECTORS.detailsButton, "Inspect build"); node.type = "button"; node.addEventListener("click", () => open(row.runId), { once: true }); return node; }
  function facts(documentRef, row, open) { return [fact(documentRef, "rank", "Rank", `#${row.rank}`), name(documentRef, row, open), fact(documentRef, "score", "Score", row.score), fact(documentRef, "depth", "Depth", row.depth), fact(documentRef, "gold", "Gold", row.gold)]; }
  function renderList(documentRef, rows, open) { const rootNode = element(documentRef, "div", `record-archive ${SELECTORS.archive} ${SELECTORS.list}`); const source = Array.isArray(rows) ? rows : []; const podium = element(documentRef, "section", "record-archive-podium"); const ledger = element(documentRef, "section", "record-archive-ledger"); for (const row of source) { const top = row.rank <= 3; const card = element(documentRef, "article", SELECTORS.row + " " + (top ? "record-archive-podium-card" : "record-archive-ledger-row")); if (top) card.setAttribute("data-record-rank", String(row.rank)); if (top) { const skull = element(documentRef, "img", `record-archive-skull record-archive-skull-rank-${row.rank}`); skull.src = "assets/hd/environment/descent/floor-skull.png"; skull.alt = `Rank ${row.rank} skull`; card.append(skull, element(documentRef, "p", "record-archive-podium-title", row.rank === 1 ? "Champion" : `Rank ${row.rank}`)); } card.append(...facts(documentRef, row, open), inspect(documentRef, row, open)); (top ? podium : ledger).append(card); } if (podium.children.length) rootNode.append(podium); if (ledger.children.length) rootNode.append(ledger); return rootNode; }
  function section(documentRef, rootNode, title, values) {
    const block = element(documentRef, "section", SELECTORS.build + " record-archive-build-section record-archive-detail-section");
    block.append(element(documentRef, "h3", "record-archive-section-title", title));
    const list = element(documentRef, "ul", "record-archive-build-list");
    for (const value of values.length ? values : ["None recorded"]) list.append(element(documentRef, "li", "", value));
    block.append(list);
    rootNode.append(block);
  }

  function relicBuild(documentRef, rootNode, relics) {
    const block = element(documentRef, "section", SELECTORS.build + " record-archive-build-section record-archive-detail-section");
    block.append(element(documentRef, "h3", "record-archive-section-title", "Relic Build"));
    const grid = element(documentRef, "div", "record-archive-relic-grid");
    for (const relic of relics.length ? relics : [{ relicId: "", stacks: 0 }]) {
      if (!relic.relicId) {
        grid.append(element(documentRef, "p", "record-archive-empty", "No relics recorded."));
        continue;
      }
      const definition = root?.DungeonRelicData?.RELICS?.find((item) => item.id === relic.relicId);
      const card = element(documentRef, "div", "record-archive-relic");
      const iconSrc = String(definition?.icon || definition?.iconSrc || "");
      if (iconSrc) {
        const icon = element(documentRef, "img", "record-archive-relic-icon");
        icon.src = iconSrc;
        icon.alt = "";
        card.append(icon);
      } else {
        card.append(element(documentRef, "span", "record-archive-relic-fallback", "?"));
      }
      const label = element(documentRef, "span", "");
      label.append(
        element(documentRef, "strong", "", relicName(relic.relicId)),
        element(documentRef, "small", "", relic.stacks > 1 ? "Stack x" + relic.stacks : "Carried")
      );
      card.append(label);
      grid.append(card);
    }
    block.append(grid);
    rootNode.append(block);
  }

  function summaryStats(documentRef, rootNode, summary) {
    const values = [
      ["Damage Done", summary.damageDone],
      ["Damage Taken", summary.damageTaken],
      ["Total Kills", summary.totalKills],
      ["Elite Kills", summary.eliteKills],
      ["Potions Used", summary.potionsUsed],
      ["Elixirs Used", summary.elixirsUsed],
      ["Gold Collected", summary.totalGoldCollected],
      ["Deaths", summary.deaths]
    ];
    const block = element(documentRef, "section", SELECTORS.build + " record-archive-build-section record-archive-detail-section");
    block.append(element(documentRef, "h3", "record-archive-section-title", "Final Chronicle"));
    const grid = element(documentRef, "div", "record-archive-stat-grid");
    for (const [label, value] of values) grid.append(fact(documentRef, humanize(label).toLowerCase().replace(/\s+/gu, "-"), label, integer(value)));
    block.append(grid);
    rootNode.append(block);
  }

  function renderDetail(documentRef, detail) {
    const rootNode = element(documentRef, "div", "record-archive " + SELECTORS.archive + " " + SELECTORS.detail + " record-archive-chronicle-page record-archive-detail");
    const header = element(documentRef, "header", "record-archive-header record-archive-detail-header");
    const identity = element(documentRef, "div", "");
    identity.append(
      element(documentRef, "p", "record-archive-kicker", "Build Chronicle | Rank #" + detail.rank),
      element(documentRef, "h3", "record-archive-player", detail.playerName),
      element(documentRef, "small", "", detail.runId ? "Run " + detail.runId : "")
    );
    header.append(identity, element(documentRef, "p", "record-archive-score", detail.score + " pts"));

    const chronicle = element(documentRef, "section", "record-archive-chronicle record-archive-detail-section");
    chronicle.append(element(documentRef, "h3", "record-archive-section-title", "Run Chronicle"));
    const summary = detail.summary || {};
    const metrics = element(documentRef, "div", "record-archive-chronicle-facts record-archive-detail-metrics");
    metrics.append(
      fact(documentRef, "time-played", "Time Played", duration(detail.durationMs || summary.durationMs)),
      fact(documentRef, "rooms-cleared", "Rooms Cleared", integer(summary.roomsCompleted)),
      fact(documentRef, "bosses-defeated", "Bosses Defeated", integer(summary.bossesCompleted)),
      fact(documentRef, "depth", "Highest Depth", detail.depth),
      fact(documentRef, "gold", "Gold Earned", detail.gold),
      fact(documentRef, "score", "Final Score", detail.score)
    );
    const active = detail.build.runModifiers || [];
    const tooltip = active.map((modifier) => {
      const id = String(modifier?.modifierId || modifier?.id || "");
      const found = root?.DungeonMutatorData?.MUTATORS?.find((item) => item.id === id);
      return [found?.key ? "[" + found.key + "]" : "", found?.name || humanize(id), found?.bonus, found?.drawback].filter(Boolean).join(" ");
    }).join(" | ") || "No mutators were active in this run.";
    const mutators = element(documentRef, "div", "record-archive-mutators", active.length ? "Mutators " + active.length : "No mutators used");
    mutators.setAttribute("tabindex", "0");
    mutators.setAttribute("data-record-tooltip", tooltip);
    mutators.setAttribute("aria-label", tooltip);
    chronicle.append(metrics, mutators);
    rootNode.append(header, chronicle);

    relicBuild(documentRef, rootNode, detail.build.relics);
    const buildColumns = element(documentRef, "div", "record-archive-detail-columns");
    section(documentRef, buildColumns, "Pacts", detail.build.pacts.map(humanize));
    section(documentRef, buildColumns, "Skill Tiers", Object.entries(detail.build.skillTiers).map(([id, level]) => humanize(id) + ": " + integer(level)));
    rootNode.append(buildColumns);
    section(documentRef, rootNode, "Camp Upgrades", Object.entries(detail.build.campUpgrades).map(([id, level]) => humanize(id) + ": " + integer(level)));
    section(documentRef, rootNode, "Elixirs", detail.build.elixirs.map((elixir) => humanize(elixir.elixirId || elixir.id)));
    summaryStats(documentRef, rootNode, summary);
    return rootNode;
  }
  return Object.freeze({ SELECTORS, normalizeBuild, toLeaderboardRow, createLeaderboardViewModel, createLeaderboardPresentation, createDetailViewModel, renderList, renderDetail });
});
