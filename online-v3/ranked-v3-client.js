(function exposeRankedV3Client(root, factory) {
  "use strict";

  const api = factory();
  if (root) root.DungeonRankedV3Client = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createClientModule() {
  "use strict";

  function createPracticeClient() {
    return Object.freeze({
      mode: "practice",
      emit() {},
      recordCommand() {},
      requestCheckpoint() {},
      getRoomDirective() {
        return null;
      },
      openLeaderboard() {}
    });
  }

  function isPracticeClient(value) {
    return Boolean(
      value &&
      value.mode === "practice" &&
      typeof value.emit === "function" &&
      typeof value.recordCommand === "function" &&
      typeof value.requestCheckpoint === "function" &&
      typeof value.getRoomDirective === "function" &&
      typeof value.openLeaderboard === "function"
    );
  }

  return Object.freeze({
    createPracticeClient,
    isPracticeClient
  });
});
