import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRulesetRegistry } from '../src/rulesets/registry.js';
import * as releases from '../src/rulesets/releases.js';
import { calculateEnemyGoldV08 } from '../src/rulesets/v08-meta-1/gold-policy.js';
import { createInitialMetaStateV08 } from '../src/rulesets/v08-meta-1/meta-state.js';
import { issueNextRoomDirectiveV08 } from '../src/rulesets/v08-meta-1/room-policy.js';
import { settleRoomRewardEnvelopeV3 } from '../src/rulesets/v08-meta-1/reward-policy.js';
import { V08_META_1_LOCAL_RELEASE_DESCRIPTOR, V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR } from '../src/rulesets/releases.js';

const capabilities={difficultyRebalance:'v1',roomEliteBudgetByType:'v2'};
const protocol = createRequire(import.meta.url)('../../../online-v3/ranked-v3-protocol.js');

test('local Worker retains the previous run ruleset alongside the new candidate', () => {
  const source = readFileSync(new URL('../src/local-ruleset-entry.js', import.meta.url), 'utf8');
  const expression = source.match(/const localRegistry = (createRulesetRegistry\([\s\S]*?\));/u)?.[1];
  assert.ok(expression);
  const registry = vm.runInNewContext(expression, { createRulesetRegistry, ...releases });
  for (const descriptor of [V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR, V08_META_1_LOCAL_RELEASE_DESCRIPTOR]) {
    const resolved = registry.resolve({ rulesetId: descriptor.rulesetId, rulesetHash: descriptor.rulesetHash,
      environment: 'local', lifecycle: 'ranked' });
    assert.equal(resolved.rulesetHash, descriptor.rulesetHash);
    assert.deepEqual(resolved.capabilities, descriptor.capabilities);
  }
});
test('client enables the balance only for the new local descriptor', () => {
  const candidate = V08_META_1_LOCAL_RELEASE_DESCRIPTOR.rulesetHash;
  assert.equal(protocol.DIFFICULTY_REBALANCE_RULESET_HASH, candidate);
  assert.equal(protocol.supportsDifficultyRebalance(candidate), true);
  assert.equal(protocol.supportsDifficultyRebalance(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash), false);
  assert.equal(protocol.supportsDifficultyRebalance('unknown'), false);
  assert.equal(protocol.supportsRespawnPotionResources(candidate), true);
  assert.equal(new Set(protocol.SUPPORTED_RULESET_HASHES).size, protocol.SUPPORTED_RULESET_HASHES.length);
});
test('depth gold scales ordinary kills, including elite bonus and bounty, but not special enemies',()=>{
  for(const [enemyType,depth,rewardBonus,want] of [['slime',0,0,2],['slime',40,0,4],['brute',40,3,13],['skitter',100,0,12],['warden',80,0,35],['otter',80,0,25]]) {
    assert.equal(calculateEnemyGoldV08({enemyType,depth,rewardBonus,capabilities}),want);
  }
  assert.equal(calculateEnemyGoldV08({enemyType:'skeleton',depth:40,capabilities,canonicalBuild:{campUpgrades:{bounty_contract:1}}}),6);
  assert.equal(calculateEnemyGoldV08({enemyType:'brute',depth:80,capabilities:{}}),4);
  assert.equal(calculateEnemyGoldV08({enemyType:'brute',elite:true,depth:40,capabilities}),13);
});
async function issued(caps) {
  const state=createInitialMetaStateV08({runId:'difficulty_fixture',season:'local'},{startedAt:1700000000000});
  state.status='active';state.depth=80;state.roomIndex=80;
  return issueNextRoomDirectiveV08(state,{secret:'difficulty:0123456789abcdef0123456789abcdef',capabilities:caps,
    randomOracle:{deriveIntInclusive:async(min,max,{purpose})=>purpose==='room-type/weighted'?min:max,deriveRandomBytes:async({length})=>new Uint8Array(length)}});
}
function request(state,claims){return {envelopeId:state.currentRewardEnvelope.envelopeId,
  roomDirectiveId:state.currentRoomDirective.directiveId,roomNonce:state.currentRoomDirective.roomNonce,
  claims,reportedGoldDelta:0,reportedGoldTotal:0,turnCount:10,elapsedMs:1000,
  commandJournalDigest:'journal_0123456789abcdef',compactRoomProof:'proof_0123456789abcdef'};}
test('room settlement awards canonical depth gold, bounds cumulative elites and retains old budgets',async()=>{
  const state=await issued(capabilities);
  assert.equal(state.currentRoomDirective.roomType,'combat');
  const claims=[{claimType:'elite',claimId:'elite:brute',count:3},{claimType:'enemy',claimId:'enemy:brute',count:3}];
  const result=await settleRoomRewardEnvelopeV3(state,request(state,claims),{capabilities});
  // d81: clear 42 + 3*round(7*2.62) + 3*round(4*2.62) = 126.
  assert.equal(result.authoritativeGoldDelta,126);
  assert(state.currentRewardEnvelope.maximumGoldDelta>=126);
  await assert.rejects(settleRoomRewardEnvelopeV3(state,request(state,[{claimType:'elite',claimId:'elite:brute',count:4}]),{capabilities}),/LIMIT|BUDGET/);
  const old=await issued({roomEliteBudgetByType:'v2'});
  const legacy=await settleRoomRewardEnvelopeV3(old,request(old,[{claimType:'elite',claimId:'elite:brute',count:4}]),{capabilities:{roomEliteBudgetByType:'v2'}});
  assert.equal(legacy.authoritativeGoldDelta,58);
});
test('new balance stays local while the existing production descriptor remains pinned',()=>{
  assert.equal(V08_META_1_LOCAL_RELEASE_DESCRIPTOR.capabilities.difficultyRebalance,'v1');
  assert.equal(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities.difficultyRebalance,undefined);
  assert.equal(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash,'sha256:dd2bc67015aabc40cb833aec4f224e9a0e9a952a5d3bcd05e33f6144a2f59c05');
});
