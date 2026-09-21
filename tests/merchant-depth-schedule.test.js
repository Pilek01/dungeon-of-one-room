const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const pity = require('../room-pity.js');
const source = fs.readFileSync(require.resolve('../game.js'), 'utf8');
const chooseSource = source.slice(source.indexOf('  function chooseRoomType() {'), source.indexOf('  function getMerchantRelicBasePriceByRarity'));
function select(depth, roomIndex, forcedNextRoomType = '') {
  const context = { state: { depth, roomIndex, forcedNextRoomType }, window: { roomPityApi: pity },
    isBossDepth: () => depth > 0 && depth % 5 === 0,
    getCampaignRegionConfig: () => ({ roomWeights: { combat: 1, merchant: 99 } }),
    selectLocalRoomType: (type, source) => ({ type, source }), expansionContentApi: null,
    isCrossroadsPowerPenaltyActive: () => false, isNaturalSpecialRoomEligible: () => true,
    pickWeightedValue: weights => Object.keys(weights).find(key => weights[key] > 0),
    isRoomTypeUnlocked: () => true, pushLog: () => {} };
  vm.runInNewContext(chooseSource + '; result = chooseRoomType();', context);
  return { ...context.result, pending: context.state.forcedNextRoomType };
}
test('offline merchants follow HUD depth 9..99, independently of run room index', () => {
  for (const start of [0, 5, 10, 20, 50, 90]) {
    const actual = [];
    for (let depth = start; depth <= 100; depth++) {
      if (select(depth, depth - start + 1).type === 'merchant') actual.push(depth);
    }
    assert.deepEqual(actual, [9,19,29,39,49,59,69,79,89,99].filter(d => d >= start), 'start depth ' + start);
  }
});
test('save/Continue room counters cannot shift merchants', () => {
  for (const index of [1, 8, 18, 42, 99]) {
    assert.equal(select(9, index).type, 'merchant');
    assert.notEqual(select(7, index).type, 'merchant');
    assert.notEqual(select(8, index).type, 'merchant');
  }
});
test('scheduled merchant preserves a queued treasure-map vault', () => {
  assert.deepEqual(select(9, 1, 'vault'), { type: 'merchant', source: 'merchant-schedule', pending: 'vault' });
  assert.equal(select(11, 2, 'vault').type, 'vault');
});
