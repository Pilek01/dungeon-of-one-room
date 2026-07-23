(function installDungeonOnlineV3(root) {
  "use strict";

  const practiceApi = Object.freeze({
    mode: "practice",
    emit() {},
    recordCommand() {},
    requestCheckpoint() {},
    getRoomDirective() {
      return null;
    },
    openLeaderboard() {}
  });

  if (root) {
    root.DungeonOnlineV3 = practiceApi;
  }

  if (typeof module === "object" && module.exports) {
    module.exports = practiceApi;
  }
})(typeof globalThis === "object" ? globalThis : null);
