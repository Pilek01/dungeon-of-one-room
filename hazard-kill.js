function finalizeHazardEnemyKill({
  enemy,
  reward,
  reasonText,
  removeEnemy,
  pushLog,
  markUiDirty,
  checkRoomClearBonus
}) {
  removeEnemy(enemy);
  pushLog(`${enemy.name} ${reasonText}. +${reward} gold.`, "good");
  checkRoomClearBonus();
  markUiDirty();
  return true;
}

const hazardKillApi = {
  finalizeHazardEnemyKill
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = hazardKillApi;
}

if (typeof globalThis !== "undefined") {
  globalThis.hazardKillApi = hazardKillApi;
}
