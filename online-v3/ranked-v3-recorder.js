(function exposeRankedV3Recorder(root, factory) {
  "use strict";

  const api = factory();
  if (root) root.DungeonRankedV3Recorder = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createRecorderModule() {
  "use strict";

  const JOURNAL_VERSION = 1;
  const MAX_JOURNAL_COMMANDS = 4096;

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    }
    return result;
  }

  function canonicalJson(value) {
    return JSON.stringify(canonicalize(value));
  }

  function fnv1a32(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function createRecorder(options = {}) {
    const runId = String(options.runId || "");
    const commands = [];
    let sequence = 0;
    let previousDigest = "00000000";

    function recordCommand(command) {
      if (commands.length >= MAX_JOURNAL_COMMANDS) return null;
      const normalized = canonicalize({
        sequence: sequence + 1,
        roomIndex: Math.max(0, Number(command?.roomIndex) || 0),
        roomNonce: String(command?.roomNonce || ""),
        turn: Math.max(0, Number(command?.turn) || 0),
        type: String(command?.type || "unknown"),
        payload: command?.payload && typeof command.payload === "object"
          ? command.payload
          : {},
        previousDigest
      });
      sequence += 1;
      previousDigest = fnv1a32(canonicalJson(normalized));
      const entry = Object.freeze({ ...normalized, digest: previousDigest });
      commands.push(entry);
      return entry;
    }

    function compactProof() {
      return Object.freeze({
        version: JOURNAL_VERSION,
        runId,
        commandCount: commands.length,
        firstSequence: commands[0]?.sequence || 0,
        lastSequence: commands.at(-1)?.sequence || 0,
        journalDigest: previousDigest
      });
    }

    function snapshot() {
      return Object.freeze({
        ...compactProof(),
        commands: Object.freeze(commands.slice())
      });
    }

    return Object.freeze({
      recordCommand,
      compactProof,
      snapshot
    });
  }

  return Object.freeze({
    JOURNAL_VERSION,
    MAX_JOURNAL_COMMANDS,
    canonicalJson,
    createRecorder
  });
});
