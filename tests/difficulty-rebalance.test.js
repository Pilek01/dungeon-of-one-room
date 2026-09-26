const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../game.js'), 'utf8');
function fn(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert(start >= 0, `Missing runtime function ${name}`);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}
function runtime(names, extra = {}) {
  const context = {
    state: { depth: 80, bossRoom: false, roomType: 'combat', turn: 10,
      phase: 'playing', player: { hp: 100, bleedTurns: 0 }, runMods: {} },
    window: {}, Math, MIN_EFFECTIVE_DAMAGE: 10,
    ENEMY_LATE_SCALE_START_DEPTH: 20, ENEMY_LATE_SCALE_STEP_DEPTH: 10, ENEMY_LATE_SCALE_PER_STEP: .1,
    ENEMY_DEPTH_GOLD_PER_DEPTH: .02,
    DEPTH_SCALED_ENEMY_TYPES: ['slime', 'skeleton', 'acolyte', 'brute', 'skitter', 'totem', 'riftweaver', 'bulwark'],
    MAX_ELITES_PER_ROOM: 4, SKITTER_BLEED_TURNS: 3, SKITTER_BLEED_DAMAGE_MULTIPLIER: .35,
    MAX_ORDINARY_ELITES_PER_ROOM: 3, ORDINARY_ELITE_ROOM_TYPES: ['combat','treasure','shrine','cursed','ambush','horde'],
    SKITTER_BLEED_COOLDOWN_TURNS: 6,
    clamp: (n,a,b)=>Math.max(a,Math.min(b,n)),
    getBountyContractMultiplier: ()=>1,
    ...extra
  };
  vm.createContext(context);
  for (const n of ['isDifficultyRebalanceEnabled', ...names]) vm.runInContext(fn(n),context);
  return context;
}
test('ordinary and elite mob stats lose late scaling, boss encounters and guardians retain it',()=>{
  const c=runtime(['getEnemyLateDepthMultiplier','getEnemyEncounterDepthMultiplier']);
  assert.equal(c.getEnemyEncounterDepthMultiplier('slime'),1);
  assert.equal(c.getEnemyEncounterDepthMultiplier('skitter'),1);
  assert(Math.abs(c.getEnemyEncounterDepthMultiplier('guardian')-1.7)<1e-10);
  assert(Math.abs(c.getEnemyEncounterDepthMultiplier('blacksmith_guardian')-1.7)<1e-10);
  assert(Math.abs(c.getEnemyEncounterDepthMultiplier('warden')-1.7)<1e-10);
  c.state.bossRoom=true;
  assert(Math.abs(c.getEnemyEncounterDepthMultiplier('slime')-1.7)<1e-10);
});
test('depth kill gold uses bounty before rounding and leaves special enemies unchanged',()=>{
  const c=runtime(['getEnemyDepthGoldMultiplier','rewardForEnemy']);
  c.state.depth=40;
  assert.equal(c.rewardForEnemy({type:'slime'}),4);
  assert.equal(c.rewardForEnemy({type:'brute',elite:true,rewardBonus:3}),13);
  c.getBountyContractMultiplier=()=>1.1;
  assert.equal(c.rewardForEnemy({type:'skeleton'}),6);
  for(const [type,gold] of [['warden',39],['guardian',18],['blacksmith_guardian',22],['otter',28]])
    assert.equal(c.rewardForEnemy({type}),gold);
});
test('combat count has 25/50/25 percent bands only in deep ordinary combat',()=>{
  const c=runtime(['getOrdinaryCombatEnemyCount']);
  for(const [roll,want] of [[0,4],[.24999,4],[.25,5],[.74999,5],[.75,6],[.9999,6]])
    assert.equal(c.getOrdinaryCombatEnemyCount(6,roll),want);
  c.state.depth=19;assert.equal(c.getOrdinaryCombatEnemyCount(5,0),5);
  c.state.depth=80;c.state.roomType='horde';assert.equal(c.getOrdinaryCombatEnemyCount(9,0),9);
});
test('ordinary elite budget never exceeds half the spawned roster or three; special encounters retain budgets',()=>{
  const c=runtime(['getRoomEliteLimit']);
  for(const [n,want] of [[1,0],[3,1],[4,2],[5,2],[6,3],[8,3]])assert.equal(c.getRoomEliteLimit(n),want);
  for(const type of ['combat','treasure','shrine','cursed','ambush','horde'])assert.equal(c.getRoomEliteLimit(4,type),2);
  for(const type of ['arena','pact','duel','boss','final'])assert.equal(c.getRoomEliteLimit(6,type),4);
});
test('Skitter can bleed again at T+6, cannot refresh active bleed, and blocked hits do not consume cooldown',()=>{
  let applications=0;
  const c=runtime(['tryApplySkitterBleed'],{getEnemyEffectiveAttack:e=>e.attack,
    applyPlayerBleed:()=>{applications++;return true;}});
  const enemy={type:'skitter',attack:220,skitterBleedReadyTurn:0};
  c.state.player.hp=90;
  assert.equal(c.tryApplySkitterBleed(enemy,10,100),false);
  assert.equal(enemy.skitterBleedReadyTurn,0);
  c.state.player.bleedTurns=2;
  assert.equal(c.tryApplySkitterBleed(enemy,0,100),false);
  c.state.player.bleedTurns=0;
  assert.equal(c.tryApplySkitterBleed(enemy,0,100),true);
  assert.equal(enemy.skitterBleedReadyTurn,16);
  const restored=JSON.parse(JSON.stringify(enemy));
  c.state.turn=15;assert.equal(c.tryApplySkitterBleed(restored,0,100),false);
  c.state.turn=16;assert.equal(c.tryApplySkitterBleed(restored,0,100),true);
  assert.equal(applications,2);
});
test('old Ranked hashes retain the old combat and reward rules',()=>{
  const c=runtime(['getEnemyDepthGoldMultiplier','rewardForEnemy','getOrdinaryCombatEnemyCount','getRoomEliteLimit'],{
    window:{DungeonRankedV3Protocol:{supportsDifficultyRebalance:()=>false}}
  });
  c.state.onlineV3Ranked=true;c.state.onlineV3RulesetHash='old';
  assert.equal(c.rewardForEnemy({type:'brute'}),4);
  assert.equal(c.getOrdinaryCombatEnemyCount(6,0),6);
  assert.equal(c.getRoomEliteLimit(4),4);
});

test('createEnemy applies the new scale in the real constructor and retains elite modifiers',()=>{
  const c=runtime(['getEnemyLateDepthMultiplier','getEnemyEncounterDepthMultiplier','createEnemy'],{
    scaledCombat:n=>Math.round(n*10), randInt:a=>a, RIFTWEAVER_RANGE:4,
    enemyTactics:null,snapVisual:()=>{},normalizeEliteAffix:s=>s,
    getWardenLatticePatterns:()=>[],syncWardenLatticeState:()=>{},
    getWardenBossProfile:()=>({}),rollEliteAffixForEnemyType:()=> 'juggernaut',ELITE_KILL_GOLD_BONUS:3
  });
  assert.equal(c.createEnemy('brute',1,1).hp,870);
  assert.equal(c.createEnemy('brute',1,1).attack,290);
  const elite=c.createEnemy('brute',1,1,{elite:true});
  assert.equal(elite.hp,1583);
  assert.equal(elite.attack,270);
  assert.equal(elite.rewardBonus,3);
  c.state.bossRoom=true;
  assert.equal(c.createEnemy('brute',1,1).hp,1479);
  assert.equal(c.createEnemy('brute',1,1).attack,493);
});

test('Shrine reinforcement uses lifetime elite budget even after earlier elites die',()=>{
  const c=runtime(['getRoomEliteLimit','spawnShrineCurseEnemies'],{
    countEliteEnemiesInRoom:()=>0,buildOccupiedTilesForShrineCurseSpawn:()=>new Set(),
    rollEnemyTypeWithCaps:()=> 'slime',randomFreeTile:()=>({x:1,y:1}),
    chance:()=>true,createEnemy:(type,x,y,{elite})=>({type,x,y,elite}),spawnParticles:()=>{}
  });
  c.state.roomType='shrine';c.state.enemies=[];
  c.state.roomEnemySpawnCount=6;c.state.roomEliteSpawnCount=3;
  assert.equal(c.spawnShrineCurseEnemies(2),2);
  assert.equal(c.state.enemies.filter(e=>e.elite).length,0);
  assert.equal(c.state.roomEliteSpawnCount,3);
  c.state.enemies=[];c.state.roomEnemySpawnCount=2;c.state.roomEliteSpawnCount=1;
  assert.equal(c.spawnShrineCurseEnemies(2),2);
  assert.equal(c.state.enemies.filter(e=>e.elite).length,1);
  assert.equal(c.state.roomEliteSpawnCount,2);
});

test('ordinary combat distribution leaves legacy and special-room RNG streams untouched',()=>{
  let draws=0;
  const randomMath=Object.create(Math);randomMath.random=()=>{draws++;return .5};
  const c=runtime(['getOrdinaryCombatEnemyCount'],{Math:randomMath});
  c.state.depth=19;c.getOrdinaryCombatEnemyCount(5);assert.equal(draws,0);
  c.state.depth=80;c.state.roomType='horde';c.getOrdinaryCombatEnemyCount(9);assert.equal(draws,0);
  c.state.roomType='combat';assert.equal(c.getOrdinaryCombatEnemyCount(6),5);assert.equal(draws,1);
});
