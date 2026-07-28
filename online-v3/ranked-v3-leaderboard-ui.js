(function exposeRankedV3LeaderboardUi(root, factory) {
  "use strict";

  const api = factory(root);
  if (root) root.DungeonRankedV3LeaderboardUi = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createLeaderboardUiModule(root) {
  "use strict";

  const SELECTORS = Object.freeze({
    root: "ranked-v3-leaderboard",
    list: "ranked-v3-leaderboard-list",
    row: "ranked-v3-leaderboard-row",
    rank: "ranked-v3-leaderboard-rank",
    detailsButton: "ranked-v3-leaderboard-details-button",
    detail: "ranked-v3-leaderboard-detail",
    build: "ranked-v3-leaderboard-build",
    status: "ranked-v3-leaderboard-status"
  });

  function humanize(value) {
    return String(value || "")
      .replace(/[_-]+/gu, " ")
      .replace(/\b\w/gu, (letter) => letter.toUpperCase()) || "None";
  }

  function relicName(relicId) {
    const id = String(relicId || "");
    const relic = Array.isArray(root?.DungeonRelicData?.RELICS)
      ? root.DungeonRelicData.RELICS.find((entry) => entry.id === id)
      : null;
    return String(relic?.name || humanize(id));
  }

  function outcomeLabel(value) {
    return humanize(value || "completed");
  }

  function integer(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function normalizeBuild(value) {
    const build = value && typeof value === "object" ? value : {};
    return {
      relics: Array.isArray(build.relics)
        ? build.relics.map((relic) => ({
          relicId: String(relic?.relicId || ""),
          stacks: Math.max(1, integer(relic?.stacks))
        })).filter((relic) => relic.relicId)
        : [],
      pacts: Array.isArray(build.pacts)
        ? build.pacts.filter((id) => typeof id === "string")
        : [],
      skillTiers: build.skillTiers && typeof build.skillTiers === "object"
        ? { ...build.skillTiers }
        : {},
      campUpgrades: build.campUpgrades && typeof build.campUpgrades === "object"
        ? { ...build.campUpgrades }
        : {},
      elixirs: Array.isArray(build.elixirs) ? build.elixirs.map((item) => ({ ...item })) : [],
      runModifiers: Array.isArray(build.runModifiers?.active)
        ? build.runModifiers.active.map((item) => ({ ...item }))
        : []
    };
  }

  function toLeaderboardRow(entry, index = 0) {
    return Object.freeze({
      runId: String(entry?.runId || ""),
      rank: Math.max(1, integer(entry?.rank) || index + 1),
      playerName: String(entry?.playerName || "Anonymous"),
      score: integer(entry?.score),
      depth: integer(entry?.depth),
      gold: integer(entry?.gold),
      durationMs: integer(entry?.durationMs),
      outcome: String(entry?.outcome || ""),
      verificationLevel: String(entry?.verificationLevel || ""),
      createdAt: integer(entry?.createdAt)
    });
  }

  function createLeaderboardViewModel(payload = {}, rankOffset = 0) {
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    return Object.freeze({
      season: String(payload.season || ""),
      status: String(payload.status || "ready"),
      cursor: typeof payload.cursor === "string" && payload.cursor ? payload.cursor : null,
      rows: Object.freeze(entries.slice(0, 20).map((entry, index) => (
        toLeaderboardRow(entry, rankOffset + index)
      )))
    });
  }

  function createDetailViewModel(payload = {}) {
    const entry = payload.entry && typeof payload.entry === "object" ? payload.entry : {};
    return Object.freeze({
      ...toLeaderboardRow(entry),
      season: String(entry.season || ""),
      build: Object.freeze(normalizeBuild(entry.build)),
      summary: Object.freeze(entry.summary && typeof entry.summary === "object" ? { ...entry.summary } : {})
    });
  }

  function element(documentRef, tag, className, value = "") {
    const node = documentRef.createElement(tag);
    node.className = className;
    node.textContent = String(value);
    return node;
  }

  function renderList(documentRef, rows, onDetail) {
    const list = element(documentRef, "div", SELECTORS.list);
    for (const row of rows) {
      const item = element(documentRef, "article", SELECTORS.row);
      const heading = element(
        documentRef,
        "strong",
        SELECTORS.rank,
        `#${row.rank} ${row.playerName} - ${row.score}`
      );
      const facts = element(
        documentRef,
        "span",
        "",
        `${outcomeLabel(row.outcome)} | Depth ${row.depth} | ${Math.floor(row.durationMs / 1000)}s | Gold ${row.gold}`
      );
      const details = element(documentRef, "button", SELECTORS.detailsButton, "Build details");
      details.type = "button";
      details.addEventListener("click", () => onDetail(row.runId), { once: true });
      item.append(heading, facts, details);
      list.append(item);
    }
    return list;
  }

  function appendSection(documentRef, root, title, values) {
    const section = element(documentRef, "section", SELECTORS.build);
    section.append(element(documentRef, "h3", "", title));
    const list = element(documentRef, "ul", "");
    const entries = values.length ? values : ["None"];
    for (const value of entries) list.append(element(documentRef, "li", "", value));
    section.append(list);
    root.append(section);
  }

  function renderDetail(documentRef, detail) {
    const root = element(documentRef, "div", SELECTORS.detail);
    root.append(element(
      documentRef,
      "p",
      "",
      `${detail.playerName} | ${outcomeLabel(detail.outcome)} | Score ${detail.score} | Depth ${detail.depth}`
    ));
    const summary = detail.summary;
    root.append(element(
      documentRef,
      "p",
      "",
      `Duration ${Math.floor(detail.durationMs / 1000)}s | Final gold ${detail.gold} | Lives ${integer(summary?.lives?.remaining)}/${integer(summary?.lives?.maximum)}`
    ));
    root.append(element(
      documentRef,
      "p",
      "",
      `Published ${new Date(detail.createdAt).toLocaleString()}`
    ));    appendSection(
      documentRef,
      root,
      "Relics",
      detail.build.relics.map((relic) => `${relicName(relic.relicId)} x${relic.stacks}`)
    );
    appendSection(documentRef, root, "Pacts", detail.build.pacts.map(humanize));
    appendSection(
      documentRef,
      root,
      "Run modifiers",
      detail.build.runModifiers.map((modifier) => humanize(modifier.modifierId || modifier.id))
    );
    appendSection(
      documentRef,
      root,
      "Skill tiers",
      Object.entries(detail.build.skillTiers).map(([id, level]) => `${humanize(id)}: ${integer(level)}`)
    );
    appendSection(
      documentRef,
      root,
      "Camp upgrades",
      Object.entries(detail.build.campUpgrades).map(([id, level]) => `${humanize(id)}: ${integer(level)}`)
    );
    appendSection(
      documentRef,
      root,
      "Elixirs",
      detail.build.elixirs.map((elixir) => humanize(elixir.elixirId || elixir.id))
    );
    return root;
  }

  return Object.freeze({
    SELECTORS,
    normalizeBuild,
    toLeaderboardRow,
    createLeaderboardViewModel,
    createDetailViewModel,
    renderList,
    renderDetail
  });
});
