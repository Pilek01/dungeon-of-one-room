const REQUIRED_TEXT_FIELDS = Object.freeze([
  "directiveId",
  "runId",
  "roomType",
  "roomCategory",
  "directiveSeed",
  "roomNonce"
]);

export function assertRoomDirectiveV3(directive) {
  if (!directive || typeof directive !== "object") {
    throw new TypeError("ROOM_DIRECTIVE_INVALID");
  }
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (typeof directive[field] !== "string" || !directive[field]) {
      throw new TypeError(`ROOM_DIRECTIVE_INVALID:${field}`);
    }
  }
  for (const field of ["revision", "roomIndex", "depth", "issuedAt"]) {
    if (!Number.isSafeInteger(directive[field]) || directive[field] < 0) {
      throw new TypeError(`ROOM_DIRECTIVE_INVALID:${field}`);
    }
  }
  if (directive.roomIndex < 1 || directive.depth < 1) {
    throw new TypeError("ROOM_DIRECTIVE_INVALID:sequence");
  }
  if (typeof directive.rewardEnvelopeRef !== "string" || !directive.rewardEnvelopeRef) {
    throw new TypeError("ROOM_DIRECTIVE_INVALID:rewardEnvelopeRef");
  }
  if (Object.hasOwn(directive, "rewardEnvelope")) {
    throw new TypeError("ROOM_DIRECTIVE_PRIVATE_ENVELOPE_LEAK");
  }
  if (directive.offerPolicyRef !== null) {
    throw new TypeError("ROOM_DIRECTIVE_PHASE_3B2A_SCOPE_VIOLATION");
  }
  if (typeof directive.consumed !== "boolean") {
    throw new TypeError("ROOM_DIRECTIVE_INVALID:consumed");
  }
  if (directive.roomCategory === "special") {
    const scalingDepth = directive.specialRoomPayload?.scalingDepth;
    if (
      !Number.isSafeInteger(scalingDepth) ||
      scalingDepth < directive.depth
    ) {
      throw new TypeError("ROOM_DIRECTIVE_INVALID:specialRoomPayload.scalingDepth");
    }
  }
  return directive;
}

export function createRoomDirectiveV3(fields) {
  const directive = {
    directiveId: fields.directiveId,
    runId: fields.runId,
    revision: fields.revision,
    roomIndex: fields.roomIndex,
    depth: fields.depth,
    roomType: fields.roomType,
    roomCategory: fields.roomCategory,
    directiveSeed: fields.directiveSeed,
    roomNonce: fields.roomNonce,
    specialRoomPayload: fields.specialRoomPayload ?? null,
    rewardEnvelopeRef: fields.rewardEnvelopeRef,
    offerPolicyRef: null,
    issuedAt: fields.issuedAt,
    consumed: false
  };
  assertRoomDirectiveV3(directive);
  return Object.freeze(directive);
}
