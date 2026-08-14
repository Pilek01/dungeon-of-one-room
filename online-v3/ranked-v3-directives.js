(function exposeRankedV3Directives(root, factory) {
  "use strict";
  const api = factory();
  if (root) root.DungeonRankedV3Directives = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createDirectiveModule() {
  "use strict";

  const SUPPORTED_TYPES = Object.freeze([
    "combat", "treasure", "shrine", "forge", "pact", "cursed", "otter",
    "vault", "merchant", "ambush", "horde", "duel", "crossroads", "arena",
    "boss", "final"
  ]);

  function applyOnlineV3RoomDirective(directive) {
    if (!directive || typeof directive !== "object") throw new TypeError("RANKED_DIRECTIVE_INVALID");
    for (const field of ["directiveId", "runId", "roomType", "roomCategory", "directiveSeed", "roomNonce"]) {
      if (typeof directive[field] !== "string" || !directive[field]) {
        throw new TypeError(`RANKED_DIRECTIVE_INVALID:${field}`);
      }
    }
    if (!SUPPORTED_TYPES.includes(directive.roomType)) {
      throw new TypeError("RANKED_DIRECTIVE_ROOM_TYPE_UNSUPPORTED");
    }
    if (!Number.isSafeInteger(directive.depth) || directive.depth < 1 || directive.depth > 100) {
      throw new TypeError("RANKED_DIRECTIVE_DEPTH_INVALID");
    }
    if (!Number.isSafeInteger(directive.roomIndex) || directive.roomIndex < 1) {
      throw new TypeError("RANKED_DIRECTIVE_INDEX_INVALID");
    }
    const expectedCategory = directive.roomType === "boss"
      ? "boss"
      : directive.roomType === "final"
        ? "final"
        : null;
    if (expectedCategory && directive.roomCategory !== expectedCategory) {
      throw new TypeError("RANKED_DIRECTIVE_CATEGORY_MISMATCH");
    }
    const specialRoomPayload = directive.specialRoomPayload ?? null;
    if (directive.roomCategory === "special") {
      const scalingDepth = specialRoomPayload?.scalingDepth;
      if (!Number.isSafeInteger(scalingDepth) || scalingDepth < directive.depth) {
        throw new TypeError("RANKED_DIRECTIVE_SCALING_DEPTH_INVALID");
      }
    }
    return Object.freeze({
      directiveId: directive.directiveId,
      runId: directive.runId,
      revision: directive.revision,
      depth: directive.depth,
      roomIndex: directive.roomIndex,
      roomType: directive.roomType,
      roomCategory: directive.roomCategory,
      directiveSeed: directive.directiveSeed,
      roomNonce: directive.roomNonce,
      rewardEnvelopeRef: directive.rewardEnvelopeRef,
      specialRoomPayload: specialRoomPayload
        ? Object.freeze({ ...specialRoomPayload })
        : null
    });
  }

  return Object.freeze({ SUPPORTED_TYPES, applyOnlineV3RoomDirective });
});
