(function exposeRankedV3LeaderboardUi(root, factory) {
  "use strict";
  const api = factory(root);
  if (root) root.DungeonRankedV3LeaderboardUi = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function leaderboardUi(root) {
  "use strict";

  const archiveUi = root?.DungeonRecordArchiveUi ||
    (typeof module === "object" && module.exports ? require("../record-archive-ui.js") : null);

  function integer(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function humanize(value) {
    return String(value || "")
      .replace(/[_-]+/gu, " ")
      .replace(/\b\w/gu, (letter) => letter.toUpperCase()) || "None";
  }

  function relicName(id) {
    return String(root?.DungeonRelicData?.RELICS?.find((relic) => relic.id === id)?.name || humanize(id));
  }

  function normalizeBuild(value) {
    const build = value && typeof value === "object" ? value : {};
    return Object.freeze({
      relics: Object.freeze((Array.isArray(build.relics) ? build.relics : []).map((relic) => Object.freeze({
        relicId: String(relic?.relicId || relic?.id || ""),
        stacks: Math.max(1, integer(relic?.stacks))
      })).filter((relic) => relic.relicId)),
      pacts: Object.freeze((Array.isArray(build.pacts) ? build.pacts : []).filter((id) => typeof id === "string")),
      skillTiers: Object.freeze(build.skillTiers && typeof build.skillTiers === "object" ? { ...build.skillTiers } : {}),
      campUpgrades: Object.freeze(build.campUpgrades && typeof build.campUpgrades === "object" ? { ...build.campUpgrades } : {}),
      elixirs: Object.freeze((Array.isArray(build.elixirs) ? build.elixirs : []).map((item) => Object.freeze({ ...item }))),
      runModifiers: Object.freeze((Array.isArray(build.runModifiers?.active) ? build.runModifiers.active : []).map((item) => Object.freeze({ ...item })))
    });
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
    return Object.freeze({
      season: String(payload.season || ""),
      status: String(payload.status || "ready"),
      cursor: typeof payload.cursor === "string" && payload.cursor ? payload.cursor : null,
      rows: Object.freeze((Array.isArray(payload.entries) ? payload.entries : [])
        .slice(0, 20)
        .map((entry, index) => toLeaderboardRow(entry, rankOffset + index)))
    });
  }

  function createDetailViewModel(payload = {}, options = {}) {
    const entry = payload.entry && typeof payload.entry === "object" ? payload.entry : {};
    const listedRank = Number.isInteger(options.rank) && options.rank > 0 ? options.rank : null;
    return Object.freeze({
      ...toLeaderboardRow(entry),
      rank: listedRank,
      season: String(entry.season || ""),
      build: normalizeBuild(entry.build),
      summary: Object.freeze(entry.summary && typeof entry.summary === "object" ? { ...entry.summary } : {})
    });
  }

  function detailModel(detail) {
    const summary = detail.summary || {};
    const active = detail.build.runModifiers || [];
    const tooltip = active.map((modifier) => {
      const id = String(modifier?.modifierId || modifier?.id || "");
      const found = root?.DungeonMutatorData?.MUTATORS?.find((item) => item.id === id);
      return [found?.key ? "[" + found.key + "]" : "", found?.name || humanize(id), found?.bonus, found?.drawback]
        .filter(Boolean)
        .join(" ");
    }).join(" | ") || "No mutators were active in this run.";
    const optional = (key, label, format = integer) =>
      Object.hasOwn(summary, key) && summary[key] !== null && summary[key] !== undefined
        ? Object.freeze({ key, label, value: format(summary[key]) })
        : null;
    const chronicleFacts = [
      optional("durationMs", "Time Played", archiveUi.formatDuration),
      optional("roomsCompleted", "Rooms Cleared"),
      optional("bossesCompleted", "Bosses Defeated"),
      optional("finalDepth", "Highest Depth"),
      optional("goldEarned", "Gold Earned"),
      optional("score", "Final Score"),
      optional("livesRemaining", "Lives Remaining")
    ].filter(Boolean);

    return Object.freeze({
      runId: detail.runId,
      rank: detail.rank,
      playerName: detail.playerName,
      score: detail.score,
      chronicleFacts: Object.freeze(chronicleFacts),
      mutators: Object.freeze({
        label: active.length ? "Mutators " + active.length : "No mutators used",
        tooltip
      }),
      relics: Object.freeze(detail.build.relics.map((relic) => {
        const definition = root?.DungeonRelicData?.RELICS?.find((item) => item.id === relic.relicId);
        return Object.freeze({
          name: relicName(relic.relicId),
          note: relic.stacks > 1 ? "Stack x" + relic.stacks : "Carried",
          icon: String(definition?.icon || definition?.iconSrc || "")
        });
      })),
      sections: Object.freeze([
        { title: "Pacts", values: detail.build.pacts.map(humanize) },
        { title: "Skill Tiers", values: Object.entries(detail.build.skillTiers).map(([id, level]) => humanize(id) + ": " + integer(level)) },
        { title: "Camp Upgrades", values: Object.entries(detail.build.campUpgrades).map(([id, level]) => humanize(id) + ": " + integer(level)) },
        { title: "Elixirs", values: detail.build.elixirs.map((item) => humanize(item?.elixirId || item?.id || "")) }
      ]),
      terminalFacts: Object.freeze([])
    });
  }

  function renderList(documentRef, rows, open) {
    if (!archiveUi) throw new Error("Record archive renderer is unavailable.");
    return archiveUi.renderList(documentRef, { context: "ranked", rows }, {
      onInspect(row) {
        if (typeof open === "function") open(row);
      }
    });
  }
  function renderDetail(documentRef, detail) {
    if (!archiveUi) throw new Error("Record archive renderer is unavailable.");
    return archiveUi.renderDetail(documentRef, detailModel(detail));
  }

  return Object.freeze({
    SELECTORS: archiveUi?.SELECTORS || Object.freeze({}),
    normalizeBuild,
    toLeaderboardRow,
    createLeaderboardViewModel,
    createDetailViewModel,
    renderList,
    renderDetail
  });
});
