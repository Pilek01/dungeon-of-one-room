export function validateRoomDirective(directive) {
  if (!directive || typeof directive !== "object") {
    throw new TypeError("ROOM_DIRECTIVE_INVALID");
  }
  for (const key of ["id", "roomType", "roomNonce"]) {
    if (typeof directive[key] !== "string" || !directive[key]) {
      throw new TypeError(`ROOM_DIRECTIVE_INVALID:${key}`);
    }
  }
  if (!Number.isSafeInteger(directive.roomIndex) || directive.roomIndex < 1) {
    throw new TypeError("ROOM_DIRECTIVE_INVALID:roomIndex");
  }
  if (!Number.isSafeInteger(directive.depth) || directive.depth < 1) {
    throw new TypeError("ROOM_DIRECTIVE_INVALID:depth");
  }
  return {
    id: directive.id,
    roomIndex: directive.roomIndex,
    depth: directive.depth,
    roomType: directive.roomType,
    roomNonce: directive.roomNonce,
    publicData: directive.publicData && typeof directive.publicData === "object"
      ? { ...directive.publicData }
      : {}
  };
}

export function assertCurrentRoom(state, request) {
  if (request.roomDirectiveId !== state.roomDirective.id) {
    throw new TypeError("ROOM_DIRECTIVE_MISMATCH");
  }
  if (request.roomNonce !== state.roomDirective.roomNonce) {
    throw new TypeError("ROOM_NONCE_MISMATCH");
  }
}
