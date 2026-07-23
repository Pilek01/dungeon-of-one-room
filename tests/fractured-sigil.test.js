const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadSkillsActions() {
  const source = fs.readFileSync(
    "C:\\Users\\Kamil\\Downloads\\claudeodeallowed\\Dungeon\\dungeon-1.0\\skills-actions.js",
    "utf8"
  );
  const context = {
    window: {},
    console
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.DungeonSkillsActions;
}

function createDeps({ fractured = false } = {}) {
  const state = {
    phase: "playing",
    player: {
      x: 4,
      y: 4,
      maxHp: 100,
      hpShield: 0,
      fracturedShieldBarrier: 0,
      skillShield: 0,
      skillShieldArmorBonus: 0,
      barrierArmor: 0,
      barrierTurns: 0,
      shieldStoredDamage: 0,
      armor: 0
    },
    enemies: [],
    skillCooldowns: { shield: 0 }
  };

  return {
    state,
    SKILL_BY_ID: { shield: { id: "shield", name: "Shield" } },
    getSkillTier: () => 0,
    getSkillCooldownRemaining: () => 0,
    pushLog: () => {},
    sign: (n) => (n > 0 ? 1 : n < 0 ? -1 : 0),
    scaledCombat: (n) => n * 10,
    MIN_EFFECTIVE_DAMAGE: 1,
    getEffectiveAdrenaline: () => 0,
    getFuryAttackPowerMultiplier: () => 1,
    inBounds: () => true,
    isSpikeAt: () => false,
    isForgeBlockedTile: () => false,
    getChestAt: () => null,
    startTween: () => {},
    spawnDashTrail: () => {},
    getEnemyAt: () => null,
    triggerEnemyHitFlash: () => {},
    spawnFloatingText: () => {},
    spawnParticles: () => {},
    killEnemy: () => {},
    registerPlayerHitThisTurn: () => {},
    getPlayerAttackForDamage: () => 100,
    getDashRelicDamageMultiplier: () => 1,
    getPactSkillDamageMultiplier: () => 1,
    applyRelicDamageModsToHit: (damage) => ({ damage, stormProc: false }),
    applyDamageToEnemy: (enemy, damage) => ({ hpDamage: damage, shieldAbsorbed: 0 }),
    applyVampfangLifesteal: () => {},
    findDashKnockbackTile: () => null,
    getFacingFromDelta: () => "south",
    applySpikeToEnemy: () => {},
    TILE: 16,
    spawnShockwaveRing: () => {},
    playSfx: () => {},
    isOnShrine: () => false,
    activateShrine: () => {},
    setShake: () => {},
    getShieldChargesInfo: () => null,
    consumeShieldCharge: () => true,
    getSkillShieldCapForTier: () => Number.POSITIVE_INFINITY,
    hasRelic: (id) => fractured && id === "fracturedsigil",
    onSuccessfulSkillCast: () => true,
    putSkillOnCooldown: () => {},
    finalizeTurn: () => {},
    markUiDirty: () => {}
  };
}

function run() {
  const skillsActions = loadSkillsActions();

  {
    const deps = createDeps({ fractured: false });
    const api = skillsActions.create(deps);
    const ok = api.tryUseShieldSkill();
    assert.equal(ok, true);
    assert.equal(deps.state.player.skillShield, 100);
    assert.equal(deps.state.player.fracturedShieldBarrier, 0);
  }

  {
    const deps = createDeps({ fractured: true });
    const api = skillsActions.create(deps);
    const ok = api.tryUseShieldSkill();
    assert.equal(ok, true);
    assert.equal(deps.state.player.skillShield, 0);
    assert.equal(deps.state.player.fracturedShieldBarrier, 60);
  }

  console.log("fractured-sigil tests: OK");
}

run();
