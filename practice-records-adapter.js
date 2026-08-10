(function exposePracticeRecordsAdapter(root, factory) {
  "use strict";
  const api = factory();
  if (root) root.DungeonPracticeRecordsAdapter = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function practiceRecordsAdapter() {
  "use strict";

  const hasOwn = (value, key) => Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
  const integer = (value) => Math.max(0, Math.floor(Number(value) || 0));
  const duration = (value) => {
    const seconds = Math.floor(integer(value) / 1000);
    return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`;
  };
  const fact = (source, key, label, format = String) =>
    hasOwn(source, key) && source[key] !== null && source[key] !== undefined
      ? Object.freeze({ key, label, value: format(source[key]) })
      : null;
  const humanize = (value) => String(value || "").replace(/[_-]+/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase()) || "None";

  function sorted(entries, sortMode, limit) {
    const source = Array.isArray(entries) ? [...entries] : [];
    source.sort(sortMode === "depth"
      ? (a, b) => integer(b.depth) - integer(a.depth) || integer(b.score) - integer(a.score) || integer(b.gold) - integer(a.gold) || integer(b.ts) - integer(a.ts)
      : (a, b) => integer(b.score) - integer(a.score) || integer(b.depth) - integer(a.depth) || integer(b.gold) - integer(a.gold) || integer(b.ts) - integer(a.ts));
    return source.slice(0, Math.max(1, Number(limit) || 20));
  }

  function createListModel(entries, options = {}) {
    const ordered = sorted(entries, options.sortMode, options.limit);
    return Object.freeze({
      context: "practice",
      rows: Object.freeze(ordered.map((entry, index) => Object.freeze({
        ...entry,
        runId: String(entry?.runId || entry?.id || ""),
        rank: index + 1,
        playerName: String(entry?.playerName || "Anonymous"),
        score: integer(entry?.score),
        depth: integer(entry?.depth),
        gold: integer(entry?.gold)
      })))
    });
  }

  function findRankedEntry(entries, runId, options = {}) {
    return createListModel(entries, options).rows.find((entry) => entry.runId === String(runId || "")) || null;
  }

  function createReferencePlatePayload(entry, context = {}) {
    const source = entry && typeof entry === "object" ? entry : {};
    const base = {
      runId: String(source.runId || source.id || ""),
      rank: Number.isInteger(context.rank) && context.rank > 0 ? context.rank : 1,
      playerName: String(source.playerName || "Anonymous"),
      score: integer(source.score)
    };
    if (hasOwn(source, "depth") && source.depth !== null && source.depth !== undefined) base.depth = integer(source.depth);
    if (hasOwn(source, "durationMs") && source.durationMs !== null && source.durationMs !== undefined) base.durationMs = integer(source.durationMs);
    if (hasOwn(source, "outcome") && source.outcome !== null && source.outcome !== undefined) base.outcome = String(source.outcome);
    if (hasOwn(source, "gold") && source.gold !== null && source.gold !== undefined) base.gold = integer(source.gold);

    const build = source.build && typeof source.build === "object" ? source.build : null;
    const summary = source.summary && typeof source.summary === "object" ? source.summary : null;
    if (!build || !summary) {
      return Object.freeze({ entry: Object.freeze({
        ...base,
        detailsAvailable: false,
        detailsUnavailableNotice: "Build Chronicle unavailable for this legacy Practice record."
      }) });
    }

    const relics = Array.isArray(build.relics)
      ? build.relics.map((item) => ({
        relicId: String(item?.relicId || item?.id || ""),
        stacks: Math.max(1, integer(item?.stacks))
      })).filter((item) => item.relicId)
      : [];
    const pacts = Array.isArray(build.pacts) ? [...build.pacts] : [];
    const skillTiers = build.skillTiers && typeof build.skillTiers === "object" ? { ...build.skillTiers } : {};
    const campUpgrades = build.campUpgrades && typeof build.campUpgrades === "object" ? { ...build.campUpgrades } : {};
    const elixirs = build.elixir && typeof build.elixir === "object" ? [{ ...build.elixir }] : [];
    const runModifiers = {
      active: (Array.isArray(source.mutatorIds) ? source.mutatorIds : [])
        .map((id) => ({ modifierId: String(id), stacks: 1 }))
        .filter((item) => item.modifierId)
    };

    const projectedSummary = { ...summary };
    if (hasOwn(source, "durationMs") && source.durationMs !== null && source.durationMs !== undefined) projectedSummary.durationMs = integer(source.durationMs);
    if (hasOwn(source, "gold") && source.gold !== null && source.gold !== undefined) projectedSummary.gold = { earned: integer(source.gold) };

    return Object.freeze({ entry: Object.freeze({
      ...base,
      detailsAvailable: true,
      build: {
        relics,
        pacts,
        skillTiers,
        campUpgrades,
        elixirs,
        runModifiers
      },
      summary: projectedSummary
    }) });
  }
  function createDetailModel(entry, context = {}) {
    const source = entry && typeof entry === "object" ? entry : {};
    const rank = Number.isInteger(context.rank) && context.rank > 0 ? context.rank : null;
    const build = source.build && typeof source.build === "object" ? source.build : null;
    const summary = source.summary && typeof source.summary === "object" ? source.summary : null;
    const base = {
      runId: String(source.runId || source.id || ""),
      rank,
      playerName: String(source.playerName || "Anonymous"),
      score: integer(source.score)
    };
    if (!build || !summary) {
      return Object.freeze({
        ...base,
        notice: "Build Chronicle unavailable for this legacy Practice record.",
        chronicleFacts: Object.freeze([
          { key: "depth", label: "Highest Depth", value: integer(source.depth) },
          { key: "gold", label: "Gold Earned", value: integer(source.gold) }
        ]),
        sections: Object.freeze([]),
        terminalFacts: Object.freeze([])
      });
    }

    const describeRelic = typeof context.describeRelic === "function" ? context.describeRelic : (id) => ({ name: humanize(id), icon: "" });
    const describeMutator = typeof context.describeMutator === "function" ? context.describeMutator : (id) => ({ name: humanize(id) });
    const mutatorIds = Array.isArray(source.mutatorIds) ? source.mutatorIds : [];
    const active = mutatorIds.map((id) => ({ id: String(id), ...describeMutator(String(id)) }));
    const tooltip = active.length
      ? active.map((item) => [item.key ? "[" + item.key + "]" : "", item.name, item.bonus, item.drawback].filter(Boolean).join(" ")).join(" | ")
      : "No mutators used.";
    const relics = (Array.isArray(build.relics) ? build.relics : []).map((item) => {
      const definition = describeRelic(String(item?.relicId || item?.id || "")) || {};
      const stacks = Math.max(1, integer(item?.stacks));
      return Object.freeze({ name: String(definition.name || item?.relicId || "Unknown relic"), icon: String(definition.icon || ""), note: stacks > 1 ? "Stack x" + stacks : "Carried" });
    });
    const chronicleFacts = [
      hasOwn(source, "durationMs") && source.durationMs !== null && source.durationMs !== undefined
        ? Object.freeze({ key: "time-played", label: "Time Played", value: duration(source.durationMs) })
        : null,
      fact(summary, "roomsCompleted", "Rooms Cleared", integer),
      fact(summary, "bossesCompleted", "Bosses Defeated", integer),
      fact(source, "depth", "Highest Depth", integer),
      fact(source, "gold", "Gold Earned", integer),
      fact(source, "score", "Final Score", integer),
      fact(summary, "livesRemaining", "Lives Remaining", integer)
    ].filter(Boolean);
    const terminalFacts = [
      fact(summary, "damageDone", "Damage Done", integer),
      fact(summary, "damageTaken", "Damage Taken", integer),
      fact(summary, "totalKills", "Total Kills", integer),
      fact(summary, "eliteKills", "Elite Kills", integer),
      fact(summary, "potionsUsed", "Potions Used", integer),
      fact(summary, "elixirsUsed", "Elixirs Used", integer),
      fact(summary, "totalGoldCollected", "Gold Collected", integer),
      fact(summary, "deaths", "Deaths", integer)
    ].filter(Boolean);
    return Object.freeze({
      ...base,
      chronicleFacts: Object.freeze(chronicleFacts),
      mutators: Object.freeze({ label: active.length ? "Mutators " + active.length : "No mutators used", tooltip }),
      relics: Object.freeze(relics),
      sections: Object.freeze([
        { title: "Pacts", values: (Array.isArray(build.pacts) ? build.pacts : []).map(humanize) },
        { title: "Skill Tiers", values: Object.entries(build.skillTiers || {}).map(([id, tier]) => humanize(id) + ": " + integer(tier)) },
        { title: "Camp Upgrades", values: Object.entries(build.campUpgrades || {}).map(([id, level]) => humanize(id) + ": " + integer(level)) },
        { title: "Elixir", values: build.elixir?.type ? [humanize(build.elixir.type)] : [] }
      ]),
      terminalTitle: source.outcome === "victory" ? "Victory Chronicle" : "Final Chronicle",
      terminalFacts: Object.freeze(terminalFacts)
    });
  }

  return Object.freeze({ createListModel, createDetailModel, createReferencePlatePayload, findRankedEntry });
});
