const assert = require("node:assert/strict");
const { shouldTriggerFinalBossPhaseShiftOnKill } = require("../final-boss-flow.js");

function run() {
  assert.equal(
    shouldTriggerFinalBossPhaseShiftOnKill({ bossRoom: true, depth: 100, finalBossPhase: 1, enemyType: "warden" }),
    true
  );

  assert.equal(
    shouldTriggerFinalBossPhaseShiftOnKill({ bossRoom: true, depth: 100, finalBossPhase: 1, enemyType: "slime" }),
    false
  );

  assert.equal(
    shouldTriggerFinalBossPhaseShiftOnKill({ bossRoom: true, depth: 100, finalBossPhase: 2, enemyType: "warden" }),
    false
  );

  assert.equal(
    shouldTriggerFinalBossPhaseShiftOnKill({ bossRoom: true, depth: 95, finalBossPhase: 1, enemyType: "warden" }),
    false
  );

  console.log("final-boss-flow tests: OK");
}

run();
