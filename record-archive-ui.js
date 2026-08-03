(function exposeRecordArchiveUi(root, factory) {
  "use strict";
  const api = factory();
  if (root) root.DungeonRecordArchiveUi = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function recordArchiveUi() {
  "use strict";

  const SELECTORS = Object.freeze({
    archive: "record-archive",
    list: "record-archive-list",
    detail: "record-archive-detail",
    podium: "record-archive-podium",
    podiumCard: "record-archive-podium-card",
    ledger: "record-archive-ledger",
    ledgerRow: "record-archive-ledger-row",
    fact: "record-archive-fact",
    name: "record-archive-name",
    inspect: "record-archive-inspect-button"
  });

  function integer(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function element(documentRef, tagName, className = "", value = "") {
    const node = documentRef.createElement(tagName);
    node.className = className;
    node.textContent = String(value);
    return node;
  }

  function presentFact(source, key, label, format = String) {
    if (!source || !Object.prototype.hasOwnProperty.call(source, key)) return null;
    if (source[key] === null || source[key] === undefined) return null;
    return Object.freeze({ key, label, value: format(source[key]) });
  }

  function formatDuration(value) {
    const seconds = Math.floor(integer(value) / 1000);
    return seconds >= 60
      ? `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`
      : `${seconds}s`;
  }

  function immutableRow(value) {
    return Object.freeze({ ...(value && typeof value === "object" ? value : {}) });
  }

  function fact(documentRef, value) {
    const node = element(documentRef, "div", SELECTORS.fact);
    node.setAttribute("data-record-field", value.key);
    node.append(
      element(documentRef, "span", "record-archive-fact-label", value.label),
      element(documentRef, "strong", "record-archive-fact-value", value.value)
    );
    return node;
  }

  function inspectControl(documentRef, row, onInspect) {
    const node = element(documentRef, "button", SELECTORS.inspect, "Inspect build");
    node.type = "button";
    node.addEventListener("click", () => onInspect(row), { once: true });
    return node;
  }

  function nameControl(documentRef, row, onInspect) {
    const node = element(documentRef, "button", SELECTORS.name, row.playerName || "Anonymous");
    node.type = "button";
    node.setAttribute("data-record-field", "name");
    node.addEventListener("click", () => onInspect(row), { once: true });
    return node;
  }

  function rowFacts(documentRef, row, onInspect) {
    return [
      fact(documentRef, { key: "rank", label: "Rank", value: `#${integer(row.rank)}` }),
      nameControl(documentRef, row, onInspect),
      fact(documentRef, { key: "score", label: "Score", value: integer(row.score) }),
      fact(documentRef, { key: "depth", label: "Depth", value: integer(row.depth) }),
      fact(documentRef, { key: "gold", label: "Gold", value: integer(row.gold) })
    ];
  }

  function renderList(documentRef, archive = {}, options = {}) {
    const onInspect = typeof options.onInspect === "function" ? options.onInspect : () => {};
    const rows = Array.isArray(archive.rows) ? archive.rows.map(immutableRow) : [];
    const rootNode = element(documentRef, "div", `${SELECTORS.archive} ${SELECTORS.list}`);
    const podium = element(documentRef, "section", SELECTORS.podium);
    const ledger = element(documentRef, "section", SELECTORS.ledger);

    for (const row of rows) {
      const rank = integer(row.rank);
      const elevated = rank >= 1 && rank <= 3;
      const card = element(documentRef, "article", elevated ? SELECTORS.podiumCard : SELECTORS.ledgerRow);
      card.setAttribute("data-record-rank", String(rank));
      if (elevated) {
        const medallion = element(documentRef, "img", `record-archive-skull record-archive-skull-rank-${rank}`);
        medallion.src = String(row.medallionSrc || "assets/hd/environment/descent/floor-skull.png");
        medallion.alt = `Rank ${rank} skull`;
        card.append(
          medallion,
          element(documentRef, "p", "record-archive-podium-title", rank === 1 ? "Champion" : `Rank ${rank}`)
        );
      }
      card.append(...rowFacts(documentRef, row, onInspect), inspectControl(documentRef, row, onInspect));
      (elevated ? podium : ledger).append(card);
    }

    if (podium.children.length) rootNode.append(podium);
    if (ledger.children.length) rootNode.append(ledger);
    return rootNode;
  }

  function appendFacts(documentRef, parent, values) {
    for (const value of Array.isArray(values) ? values : []) {
      if (!value || value.value === null || value.value === undefined) continue;
      parent.append(fact(documentRef, value));
    }
  }

  function renderDetail(documentRef, record = {}, options = {}) {
    const rootNode = element(documentRef, "div", `${SELECTORS.archive} ${SELECTORS.detail} record-archive-chronicle-page`);
    const header = element(documentRef, "header", "record-archive-header record-archive-detail-header");
    const identity = element(documentRef, "div");
    const rank = Number(record.rank);
    const kicker = Number.isInteger(rank) && rank > 0
      ? `Build Chronicle | Rank #${rank}`
      : "Build Chronicle";
    identity.append(
      element(documentRef, "p", "record-archive-kicker", kicker),
      element(documentRef, "h3", "record-archive-player", record.playerName || "Anonymous")
    );
    if (record.runId) identity.append(element(documentRef, "small", "", `Run ${record.runId}`));
    header.append(identity, element(documentRef, "p", "record-archive-score", `${integer(record.score)} pts`));
    rootNode.append(header);

    const chronicle = element(documentRef, "section", "record-archive-chronicle record-archive-detail-section");
    chronicle.append(element(documentRef, "h3", "record-archive-section-title", "Run Chronicle"));
    const facts = element(documentRef, "div", "record-archive-chronicle-facts record-archive-detail-metrics");
    appendFacts(documentRef, facts, record.chronicleFacts);
    chronicle.append(facts);
    if (record.mutators) {
      const mutators = element(documentRef, "div", "record-archive-mutators", record.mutators.label || "No mutators used");
      mutators.setAttribute("tabindex", "0");
      mutators.setAttribute("data-record-tooltip", record.mutators.tooltip || "No mutators were active in this run.");
      mutators.setAttribute("aria-label", record.mutators.tooltip || "No mutators were active in this run.");
      chronicle.append(mutators);
    }
    rootNode.append(chronicle);

    if (Array.isArray(record.relics)) {
      const block = element(documentRef, "section", "record-archive-build-section record-archive-detail-section");
      block.append(element(documentRef, "h3", "record-archive-section-title", "Relic Build"));
      const grid = element(documentRef, "div", "record-archive-relic-grid");
      for (const relic of record.relics.length ? record.relics : [{ name: "No relics recorded." }]) {
        if (!relic.icon && !relic.name) continue;
        const card = element(documentRef, "div", "record-archive-relic");
        if (relic.icon) {
          const icon = element(documentRef, "img", "record-archive-relic-icon");
          icon.src = relic.icon;
          icon.alt = "";
          card.append(icon);
        } else {
          card.append(element(documentRef, "span", "record-archive-relic-fallback", "?"));
        }
        const label = element(documentRef, "span");
        label.append(element(documentRef, "strong", "", relic.name || "Unknown relic"));
        if (relic.note) label.append(element(documentRef, "small", "", relic.note));
        card.append(label);
        grid.append(card);
      }
      block.append(grid);
      rootNode.append(block);
    }

    for (const section of Array.isArray(record.sections) ? record.sections : []) {
      const block = element(documentRef, "section", "record-archive-build-section record-archive-detail-section");
      block.append(element(documentRef, "h3", "record-archive-section-title", section.title || "Record"));
      const values = Array.isArray(section.values) ? section.values : [];
      const list = element(documentRef, "ul", "record-archive-build-list");
      for (const value of values.length ? values : ["None recorded"]) list.append(element(documentRef, "li", "", value));
      block.append(list);
      rootNode.append(block);
    }

    const terminal = Array.isArray(record.terminalFacts) ? record.terminalFacts.filter(Boolean) : [];
    if (terminal.length) {
      const block = element(documentRef, "section", "record-archive-build-section record-archive-detail-section");
      block.append(element(documentRef, "h3", "record-archive-section-title", record.terminalTitle || "Final Chronicle"));
      const facts = element(documentRef, "div", "record-archive-stat-grid");
      appendFacts(documentRef, facts, terminal);
      block.append(facts);
      rootNode.append(block);
    }

    if (typeof options.onBack === "function") {
      const back = element(documentRef, "button", "record-archive-back", options.backLabel || "Back to leaderboard");
      back.type = "button";
      back.addEventListener("click", options.onBack, { once: true });
      rootNode.append(back);
    }
    return rootNode;
  }

  return Object.freeze({ SELECTORS, renderList, renderDetail, presentFact, formatDuration });
});
