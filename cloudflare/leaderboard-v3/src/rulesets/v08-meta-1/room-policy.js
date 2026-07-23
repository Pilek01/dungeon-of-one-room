export const ROOM_POLICY_SPEC = Object.freeze({
  moduleFile: "room-policy.js",
  authority: "SERVER_ISSUED",
  legacySources: Object.freeze([
    "game.js:chooseRoomType/buildRoom/buildRegularRoom/buildBossRoom",
    "room-pity.js",
    "expansion-content.js",
    "pact-room.js"
  ]),
  directiveFields: Object.freeze([
    "id",
    "runId",
    "revision",
    "roomIndex",
    "depth",
    "roomType",
    "roomNonce",
    "encounterProfileId",
    "rewardProfileId",
    "specialRoom",
    "expiresAt"
  ]),
  implementationStatus: "not-implemented"
});
