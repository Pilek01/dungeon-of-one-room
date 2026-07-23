const assert = require("node:assert/strict");

const { finalizeHazardEnemyKill } = require("../hazard-kill.js");

function run() {
  {
    const calls = [];
    const enemy = { name: "Skeleton" };
    const result = finalizeHazardEnemyKill({
      enemy,
      reward: 1,
      reasonText: "collapsed on spikes",
      removeEnemy: (target) => calls.push(["removeEnemy", target.name]),
      pushLog: (msg, level) => calls.push(["pushLog", msg, level]),
      markUiDirty: () => calls.push(["markUiDirty"]),
      checkRoomClearBonus: () => calls.push(["checkRoomClearBonus"])
    });

    assert.equal(result, true);
    assert.deepEqual(calls, [
      ["removeEnemy", "Skeleton"],
      ["pushLog", "Skeleton collapsed on spikes. +1 gold.", "good"],
      ["checkRoomClearBonus"],
      ["markUiDirty"]
    ]);
  }

  console.log("hazard-kill tests: OK");
}

run();
