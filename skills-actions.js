(() => {
  function create(deps = {}) {
    const {
      state,
      SKILL_BY_ID,
      getSkillTier,
      getSkillCooldownRemaining,
      pushLog,
      sign,
      scaledCombat,
      MIN_EFFECTIVE_DAMAGE,
      getEffectiveAdrenaline,
      getFuryAttackPowerMultiplier,
      inBounds,
      isSpikeAt,
      isForgeBlockedTile,
      getChestAt,
      startTween,
      spawnDashTrail,
      getEnemyAt,
      triggerEnemyHitFlash,
      spawnFloatingText,
      spawnParticles,
      killEnemy,
      registerPlayerHitThisTurn,
      getPlayerAttackForDamage,
      getDashRelicDamageMultiplier,
      getPactSkillDamageMultiplier,
      applyRelicDamageModsToHit,
      applyDamageToEnemy,
      applyVampfangLifesteal,
      findDashKnockbackTile,
      getFacingFromDelta,
      applySpikeToEnemy,
      resolvePlayerPitFall,
      resolveEnemyPitFall,
      TILE,
      spawnShockwaveRing,
      playSfx,
      isOnShrine,
      activateShrine,
      setShake,
      getShieldChargesInfo,
      consumeShieldCharge,
      getSkillShieldCapForTier,
      hasRelic,
      isEnemyImmuneToPlayerForcedMovement,
      onSuccessfulSkillCast,
      putSkillOnCooldown,
      finalizeTurn,
      markUiDirty
    } = deps;
    const LEGENDARY_SKILL_TIER = 3;
    const DASH_LEGENDARY_FIRST_HIT_MULT = 1.6;
    const DASH_LEGENDARY_AFTERLINE_TURNS = 4;
    const SHIELD_BASE_HP_MULTIPLIER = 1.0;
    const SHIELD_RARE_HP_MULTIPLIER = 1.25;
    const SHIELD_LEGENDARY_ARMOR_BONUS = scaledCombat(5);
    const FRACTURED_SIGIL_BARRIER_MULTIPLIER = 0.6;

    function cancelDashAim(logText = "Dash canceled.") {
      if (!state.dashAimActive) return false;
      state.dashAimActive = false;
      if (logText) {
        pushLog(logText);
      } else {
        markUiDirty();
      }
      return true;
    }

    function tryArmDashSkill() {
      const skill = SKILL_BY_ID.dash;
      const remaining = getSkillCooldownRemaining(skill.id);
      if (remaining > 0) {
        pushLog(`${skill.name} cooldown: ${remaining} turns.`, "bad");
        return false;
      }
      if (state.dashAimActive) {
        cancelDashAim();
        return true;
      }
      state.dashAimActive = true;
      pushLog("Dash armed. Choose direction (WASD/Arrows). Esc cancels.", "good");
      return true;
    }

    function tryUseDashSkill(forcedDx = null, forcedDy = null) {
      const skill = SKILL_BY_ID.dash;
      const dashTier = getSkillTier(skill.id);
      const remaining = getSkillCooldownRemaining(skill.id);
      if (remaining > 0) {
        state.dashAimActive = false;
        pushLog(`${skill.name} cooldown: ${remaining} turns.`, "bad");
        return false;
      }

      const rawDx = forcedDx == null ? state.player.lastMoveX : forcedDx;
      const rawDy = forcedDy == null ? state.player.lastMoveY : forcedDy;
      const dx = sign(rawDx || 0);
      const dy = sign(rawDy || 0);
      if (dx === 0 && dy === 0) {
        pushLog("Dash needs a direction.", "bad");
        return false;
      }

      const furyMult = typeof getFuryAttackPowerMultiplier === "function"
        ? getFuryAttackPowerMultiplier(getEffectiveAdrenaline())
        : 1;
      const dashRelicMult = typeof getDashRelicDamageMultiplier === "function"
        ? getDashRelicDamageMultiplier()
        : 1;
      const pactSkillMult = typeof getPactSkillDamageMultiplier === "function"
        ? getPactSkillDamageMultiplier()
        : 1;
      const dashDamage = globalThis.dashDamageApi;
      let damage = Math.max(
        MIN_EFFECTIVE_DAMAGE,
        Math.round(((
          typeof getPlayerAttackForDamage === "function"
            ? getPlayerAttackForDamage({ includeChaos: false })
            : state.player.attack
        ) + scaledCombat(1)) * furyMult * dashRelicMult * pactSkillMult)
      );
      if (dashDamage && typeof dashDamage.computeDashStrikeDamage === "function") {
        damage = dashDamage.computeDashStrikeDamage({
          attack: typeof getPlayerAttackForDamage === "function"
            ? getPlayerAttackForDamage({ includeChaos: false })
            : state.player.attack,
          scaledBonus: scaledCombat(1),
          furyMult,
          dashRelicMult,
          pactSkillMult,
          dashTier,
          minDamage: MIN_EFFECTIVE_DAMAGE
        });
      } else if (dashTier >= 1) {
        damage = Math.max(MIN_EFFECTIVE_DAMAGE, damage * 2);
      }
      const maxDashTiles = dashTier >= 2 ? 4 : 3;
      const hitSet = new Set();
      let firstHitBoostApplied = false;
      const path = [];
      let currentX = state.player.x;
      let currentY = state.player.y;
      for (let i = 0; i < maxDashTiles; i += 1) {
        const nx = currentX + dx;
        const ny = currentY + dy;
        if (!inBounds(nx, ny)) break;
        if (typeof isForgeBlockedTile === "function" && isForgeBlockedTile(nx, ny)) break;
        if (getChestAt(nx, ny)) break;
        path.push({ x: nx, y: ny });
        currentX = nx;
        currentY = ny;
      }

      if (path.length === 0) {
        pushLog("Dash blocked.", "bad");
        return false;
      }

      const fromX = state.player.x;
      const fromY = state.player.y;
      startTween(state.player);
      for (const step of path) {
        const previous = { x: state.player.x, y: state.player.y };
        spawnDashTrail(state.player.x, state.player.y, step.x, step.y, {
          tier: dashTier,
          style: dashTier >= LEGENDARY_SKILL_TIER ? "void" : "travel"
        });
        state.player.x = step.x;
        state.player.y = step.y;
        if (typeof resolvePlayerPitFall === "function" && resolvePlayerPitFall(previous)) {
          state.dashAimActive = false;
          if (state.phase === "playing") {
            putSkillOnCooldown(skill.id);
            finalizeTurn();
          }
          return true;
        }

        const enemy = getEnemyAt(step.x, step.y);
        if (enemy && state.enemies.includes(enemy) && !hitSet.has(enemy)) {
          const strikeRawDamage =
            dashTier >= LEGENDARY_SKILL_TIER && !firstHitBoostApplied
              ? Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(damage * DASH_LEGENDARY_FIRST_HIT_MULT))
              : damage;
          const strikeResult = typeof applyRelicDamageModsToHit === "function"
            ? applyRelicDamageModsToHit(strikeRawDamage, enemy, { attackKind: "skill" })
            : { damage: strikeRawDamage, stormProc: false };
          const strikeDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Number(strikeResult.damage) || strikeRawDamage);
          const strikeApply = typeof applyDamageToEnemy === "function"
            ? applyDamageToEnemy(enemy, strikeDamage, { fromPlayer: true })
            : { hpDamage: strikeDamage, shieldAbsorbed: 0 };
          const dealtDamage = Math.max(0, Number(strikeApply.hpDamage) || 0);
          const interacted = dealtDamage > 0 || (Number(strikeApply.shieldAbsorbed) || 0) > 0;
          if (typeof registerPlayerHitThisTurn === "function") {
            registerPlayerHitThisTurn();
          }
          if (dealtDamage > 0 && typeof applyVampfangLifesteal === "function") {
            applyVampfangLifesteal(dealtDamage);
          }
          if (interacted) {
            triggerEnemyHitFlash(enemy);
            if (dealtDamage > 0) {
              spawnFloatingText(enemy.x, enemy.y, `-${dealtDamage}`, "#f4f7ff");
            }
            spawnParticles(enemy.x, enemy.y, "#8ee9ff", 11, 1.3);
            if (dashTier >= LEGENDARY_SKILL_TIER && !firstHitBoostApplied) {
              spawnShockwaveRing(enemy.x, enemy.y, {
                skill: "dash",
                tier: dashTier,
                style: "first-hit",
                color: "#caa4ff",
                core: "#f6f0ff",
                maxRadius: TILE * 1.25,
                life: 190
              });
            }
          }
          if (interacted && strikeResult.stormProc) {
            pushLog("Storm Sigil procs on Dash hit.", "good");
          }
          if (dashTier >= LEGENDARY_SKILL_TIER && !firstHitBoostApplied) {
            firstHitBoostApplied = true;
          }
          hitSet.add(enemy);
          if (enemy.hp <= 0) {
            killEnemy(enemy, "dash strike");
          }
        }
      }
      state.player.lastMoveX = dx;
      state.player.lastMoveY = dy;

      let knockbacks = 0;
      let splashHits = 0;
      let splashKills = 0;
      const landingEnemy = getEnemyAt(state.player.x, state.player.y);
      if (landingEnemy && state.enemies.includes(landingEnemy)) {
        const immuneToForcedMovement =
          typeof isEnemyImmuneToPlayerForcedMovement === "function" &&
          isEnemyImmuneToPlayerForcedMovement(landingEnemy);
        const knockTile = immuneToForcedMovement ? null : findDashKnockbackTile(landingEnemy, dx, dy);
        if (knockTile) {
          startTween(landingEnemy);
          landingEnemy.x = knockTile.x;
          landingEnemy.y = knockTile.y;
          landingEnemy.facing = getFacingFromDelta(knockTile.x - state.player.x, knockTile.y - state.player.y, landingEnemy.facing);
          spawnParticles(knockTile.x, knockTile.y, "#8ed8ff", 8, 1.15);
          if (typeof resolveEnemyPitFall === "function" && resolveEnemyPitFall(landingEnemy, { fromPlayer: true })) {
            knockbacks += 1;
          } else {
            applySpikeToEnemy(landingEnemy, { onEntry: true });
            knockbacks += 1;
          }
        }
      }

      if (dashTier >= 2) {
        const splashDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.floor(damage * 0.6));
        for (const enemy of [...state.enemies]) {
          if (hitSet.has(enemy)) continue;
          if (Math.abs(enemy.x - state.player.x) > 1 || Math.abs(enemy.y - state.player.y) > 1) continue;
          const splashResult = typeof applyRelicDamageModsToHit === "function"
            ? applyRelicDamageModsToHit(splashDamage, enemy, { attackKind: "skill" })
            : { damage: splashDamage, stormProc: false };
          const finalSplashDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Number(splashResult.damage) || splashDamage);
          const splashApply = typeof applyDamageToEnemy === "function"
            ? applyDamageToEnemy(enemy, finalSplashDamage, { fromPlayer: true })
            : { hpDamage: finalSplashDamage, shieldAbsorbed: 0 };
          const dealtSplash = Math.max(0, Number(splashApply.hpDamage) || 0);
          const splashInteracted = dealtSplash > 0 || (Number(splashApply.shieldAbsorbed) || 0) > 0;
          if (typeof registerPlayerHitThisTurn === "function") {
            registerPlayerHitThisTurn();
          }
          if (dealtSplash > 0 && typeof applyVampfangLifesteal === "function") {
            applyVampfangLifesteal(dealtSplash);
          }
          if (splashInteracted) {
            triggerEnemyHitFlash(enemy);
            if (dealtSplash > 0) {
              spawnFloatingText(enemy.x, enemy.y, `-${dealtSplash}`, "#dff0ff");
            }
            splashHits += 1;
            spawnParticles(enemy.x, enemy.y, "#7fc9ff", 8, 1.2);
            spawnShockwaveRing(enemy.x, enemy.y, {
              skill: "dash",
              tier: dashTier,
              style: "impact",
              color: "#89d3ff",
              core: "#ecf8ff",
              maxRadius: TILE * 1.05,
              life: 170
            });
          }
          if (splashInteracted && splashResult.stormProc) {
            pushLog("Storm Sigil procs on Dash splash.", "good");
          }
          if (enemy.hp <= 0) {
            killEnemy(enemy, "dash splash");
            splashKills += 1;
          }
        }
        if (splashHits > 0) {
          spawnShockwaveRing(state.player.x, state.player.y, {
            skill: "dash",
            tier: dashTier,
            style: "landing",
            color: "#8fcaff",
            core: "#e7f6ff",
            maxRadius: TILE * 1.8,
            life: 220
          });
        }
      }

      if (dashTier >= LEGENDARY_SKILL_TIER) {
        const seenTiles = new Set();
        const afterlineTiles = [];
        for (const step of path) {
          const key = `${step.x},${step.y}`;
          if (seenTiles.has(key)) continue;
          seenTiles.add(key);
          afterlineTiles.push({ x: step.x, y: step.y });
        }
        if (afterlineTiles.length > 0) {
          state.player.dashAfterline = {
            turns: DASH_LEGENDARY_AFTERLINE_TURNS,
            maxTurns: DASH_LEGENDARY_AFTERLINE_TURNS,
            tiles: afterlineTiles
          };
          spawnParticles(state.player.x, state.player.y, "#8fcaff", 10, 1.1);
        }
      }

      const travelTiles = Math.max(Math.abs(state.player.x - fromX), Math.abs(state.player.y - fromY));
      const hits = hitSet.size;
      const kills = [...hitSet].filter((enemy) => !state.enemies.includes(enemy)).length;
      if (hits > 0 || knockbacks > 0 || splashHits > 0) {
        pushLog(
          `Dash surges ${travelTiles} tiles: ${hits} hit${hits !== 1 ? "s" : ""}, ${kills} kill${kills !== 1 ? "s" : ""}${knockbacks > 0 ? `, ${knockbacks} knockback` : ""}${splashHits > 0 ? `, splash ${splashHits} hit/${splashKills} kill` : ""}.`,
          "good"
        );
      }
      if (dashTier >= LEGENDARY_SKILL_TIER && path.length > 0) {
        pushLog("Void Lunge leaves an afterline for 4 turns (40% ATK).", "good");
      }
      if (typeof onSuccessfulSkillCast === "function") {
        const continueTurn = onSuccessfulSkillCast(skill.id, skill.name);
        if (continueTurn === false || state.phase !== "playing") {
          return true;
        }
      }

      playSfx("hit");
      if (isOnShrine()) {
        activateShrine();
      }
      setShake(1.9);
      spawnParticles(state.player.x, state.player.y, "#9fdcff", 9, 1.2);
      state.dashAimActive = false;
      state.player.dashImmunityTurns = Math.max(1, Number(state.player.dashImmunityTurns) || 0);
      putSkillOnCooldown(skill.id);
      if (typeof isSpikeAt === "function") {
        state.playerSteppedOnSpikeThisTurn = Boolean(isSpikeAt(state.player.x, state.player.y));
      }
      finalizeTurn();
      return true;
    }

    function tryUseAoeSkill() {
      const skill = SKILL_BY_ID.aoe;
      const aoeTier = getSkillTier(skill.id);
      const remaining = getSkillCooldownRemaining(skill.id);
      if (remaining > 0) {
        pushLog(`${skill.name} cooldown: ${remaining} turns.`, "bad");
        return false;
      }

      const radius = aoeTier >= 2 ? 2 : 1;
      const furyAvailable = Math.max(0, Math.floor(Number(state.player.adrenaline) || 0));
      const furySpent = furyAvailable;
      const furyDamageMultiplier = 0.6 + furySpent * 0.2;
      const targets = state.enemies.filter(
        (enemy) => Math.abs(enemy.x - state.player.x) <= radius && Math.abs(enemy.y - state.player.y) <= radius
      );
      if (targets.length === 0) {
        pushLog("Shockwave has no targets nearby.", "bad");
        return false;
      }

      const furyMult = typeof getFuryAttackPowerMultiplier === "function"
        ? getFuryAttackPowerMultiplier(getEffectiveAdrenaline())
        : 1;
      const pactSkillMult = typeof getPactSkillDamageMultiplier === "function"
        ? getPactSkillDamageMultiplier()
        : 1;
      let baseDamage = Math.max(
        MIN_EFFECTIVE_DAMAGE,
        Math.round((
          typeof getPlayerAttackForDamage === "function"
            ? getPlayerAttackForDamage({ includeChaos: false })
            : state.player.attack
        ) * furyMult * pactSkillMult)
      );
      if (aoeTier >= 1) {
        baseDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(baseDamage * 1.5));
      }
      let kills = 0;
      let knockbacks = 0;
      let disorientedCount = 0;

      function pushEnemyChain(enemy, dx, dy, visited = new Set()) {
        if (!enemy || !state.enemies.includes(enemy)) return false;
        if (dx === 0 && dy === 0) return false;
        if (visited.has(enemy)) return false;
        if (
          typeof isEnemyImmuneToPlayerForcedMovement === "function" &&
          isEnemyImmuneToPlayerForcedMovement(enemy)
        ) return false;
        visited.add(enemy);

        const nx = enemy.x + dx;
        const ny = enemy.y + dy;
        if (!inBounds(nx, ny)) return false;
        if (state.player.x === nx && state.player.y === ny) return false;
        if (typeof isForgeBlockedTile === "function" && isForgeBlockedTile(nx, ny)) return false;
        if (getChestAt(nx, ny)) return false;

        const blocker = getEnemyAt(nx, ny);
        if (blocker && blocker !== enemy) {
          if (!pushEnemyChain(blocker, dx, dy, visited)) {
            return false;
          }
        }
        if (!state.enemies.includes(enemy)) return false;
        startTween(enemy);
        enemy.x = nx;
        enemy.y = ny;
        enemy.facing = getFacingFromDelta(dx, dy, enemy.facing);
        spawnParticles(enemy.x, enemy.y, "#b8ddff", 6, 0.9);
        if (typeof resolveEnemyPitFall === "function" && resolveEnemyPitFall(enemy, { fromPlayer: true })) return true;
        applySpikeToEnemy(enemy, { onEntry: true });
        return true;
      }

      for (const enemy of targets) {
        if (!state.enemies.includes(enemy)) continue;
        const dist = Math.max(Math.abs(enemy.x - state.player.x), Math.abs(enemy.y - state.player.y));
        let damage = MIN_EFFECTIVE_DAMAGE;
        if (aoeTier >= LEGENDARY_SKILL_TIER) {
          const ring1Multiplier = 1.2 + furySpent * 0.2;
          const ring2Multiplier = 0.8 + furySpent * 0.2;
          const ringMultiplier = dist <= 1 ? ring1Multiplier : ring2Multiplier;
          damage = Math.max(MIN_EFFECTIVE_DAMAGE, Math.round(baseDamage * ringMultiplier));
        } else {
          let falloff = 1;
          if (aoeTier >= 2 && dist >= 2) {
            falloff = 0.7;
          }
          damage = Math.max(
            MIN_EFFECTIVE_DAMAGE,
            Math.round(baseDamage * furyDamageMultiplier * falloff)
          );
        }
        const aoeResult = typeof applyRelicDamageModsToHit === "function"
          ? applyRelicDamageModsToHit(damage, enemy, { attackKind: "skill" })
          : { damage, stormProc: false };
        const finalAoeDamage = Math.max(MIN_EFFECTIVE_DAMAGE, Number(aoeResult.damage) || damage);
        const aoeApply = typeof applyDamageToEnemy === "function"
          ? applyDamageToEnemy(enemy, finalAoeDamage, { fromPlayer: true })
          : { hpDamage: finalAoeDamage, shieldAbsorbed: 0 };
        const dealtAoe = Math.max(0, Number(aoeApply.hpDamage) || 0);
        const aoeInteracted = dealtAoe > 0 || (Number(aoeApply.shieldAbsorbed) || 0) > 0;
        if (typeof registerPlayerHitThisTurn === "function") {
          registerPlayerHitThisTurn();
        }
        if (dealtAoe > 0 && typeof applyVampfangLifesteal === "function") {
          applyVampfangLifesteal(dealtAoe);
        }
        if (aoeInteracted) {
          triggerEnemyHitFlash(enemy);
          if (dealtAoe > 0) {
            spawnFloatingText(enemy.x, enemy.y, `-${dealtAoe}`, "#ffe7c8");
          }
          spawnParticles(enemy.x, enemy.y, "#ffd8a1", 8, 1.25);
        }
        if (aoeInteracted && aoeResult.stormProc) {
          pushLog("Storm Sigil procs on Shockwave.", "good");
        }
        if (enemy.hp <= 0) {
          killEnemy(enemy, "shockwave");
          kills += 1;
          continue;
        }

        if (aoeTier >= LEGENDARY_SKILL_TIER && dist <= 1) {
          enemy.disorientedTurns = Math.max(2, Number(enemy.disorientedTurns) || 0);
          enemy.castFlash = Math.max(enemy.castFlash || 0, 80);
          spawnParticles(enemy.x, enemy.y, "#d7c6ff", 6, 0.85);
          disorientedCount += 1;
        }

        if (aoeTier >= 1) {
          const dx = sign(enemy.x - state.player.x);
          const dy = sign(enemy.y - state.player.y);
          if (pushEnemyChain(enemy, dx, dy, new Set())) {
            knockbacks += 1;
          }
        }
      }

      if (furySpent > 0) {
        state.player.adrenaline = Math.max(0, (Number(state.player.adrenaline) || 0) - furySpent);
      }

      spawnShockwaveRing(state.player.x, state.player.y, {
        skill: "aoe",
        tier: aoeTier,
        style: "primary",
        furySpent,
        ringIndex: 1,
        color: aoeTier >= LEGENDARY_SKILL_TIER ? "#ffb35f" : (aoeTier >= 2 ? "#ffc87d" : (aoeTier >= 1 ? "#ffd696" : "#f2cb92")),
        core: aoeTier >= LEGENDARY_SKILL_TIER ? "#fff1d8" : (aoeTier >= 2 ? "#fff5e6" : (aoeTier >= 1 ? "#fff3df" : "#fff0cf")),
        maxRadius: radius >= 2 ? TILE * 3.8 : TILE * 2.4,
        life: radius >= 2 ? 420 : 340
      });
      if (radius >= 2) {
        spawnShockwaveRing(state.player.x, state.player.y, {
          skill: "aoe",
          tier: aoeTier,
          style: "outer",
          furySpent,
          ringIndex: 2,
          color: aoeTier >= LEGENDARY_SKILL_TIER ? "#caa4ff" : "#ffd8a9",
          core: aoeTier >= LEGENDARY_SKILL_TIER ? "#f0e3ff" : "#fff6db",
          maxRadius: TILE * 2.8,
          life: 340
        });
      }
      playSfx("hit");
      setShake(2.3);
      spawnParticles(state.player.x, state.player.y, "#f6c48f", 12, 1.3);
      const dmgPct = Math.round(furyDamageMultiplier * 100);
      const legendaryRing1Pct = Math.round((1.2 + furySpent * 0.2) * 100);
      const legendaryRing2Pct = Math.round((0.8 + furySpent * 0.2) * 100);
      const damageSummary = aoeTier >= LEGENDARY_SKILL_TIER
        ? `uses ${furySpent} Fury (ring1 ${legendaryRing1Pct}%, ring2 ${legendaryRing2Pct}%)`
        : (furySpent > 0 ? `uses ${furySpent} Fury (${dmgPct}% dmg)` : "uses no Fury (60% dmg)");
      pushLog(
        `Shockwave (R${radius}) ${
          damageSummary
        }: ${targets.length} hit${targets.length > 1 ? "s" : ""}${
          kills > 0 ? `, ${kills} kill${kills > 1 ? "s" : ""}` : ""
        }${aoeTier >= 1 ? `, ${knockbacks} knockback` : ""}${
          aoeTier >= LEGENDARY_SKILL_TIER ? `, ${disorientedCount} disoriented` : ""
        }.`,
        "good"
      );
      if (typeof onSuccessfulSkillCast === "function") {
        const continueTurn = onSuccessfulSkillCast(skill.id, skill.name);
        if (continueTurn === false || state.phase !== "playing") {
          return true;
        }
      }
      putSkillOnCooldown(skill.id);
      finalizeTurn();
      return true;
    }

    function tryUseShieldSkill() {
      const skill = SKILL_BY_ID.shield;
      const shieldTier = getSkillTier(skill.id);
      const shieldCharges = shieldTier >= 2 && typeof getShieldChargesInfo === "function"
        ? getShieldChargesInfo()
        : null;
      const remaining = getSkillCooldownRemaining(skill.id);
      if (shieldTier < 2 && remaining > 0) {
        pushLog(`${skill.name} cooldown: ${remaining} turns.`, "bad");
        return false;
      }
      if (shieldTier >= 2) {
        if (!shieldCharges || shieldCharges.charges <= 0) {
          const regenTurns = Math.max(1, Number(shieldCharges?.regenTurns) || 1);
          pushLog(`${skill.name} charges empty. Next charge in ${regenTurns} turns.`, "bad");
          return false;
        }
      }
      const activeShield = Math.max(0, Math.round(Number(state.player.skillShield) || 0));
      const activeFracturedBarrier = Math.max(0, Math.round(Number(state.player.fracturedShieldBarrier) || 0));
      if (activeShield > 0 || activeFracturedBarrier > 0) {
        pushLog("Shield is already active.", "bad");
        return false;
      }
      if (shieldTier >= 2 && typeof consumeShieldCharge === "function" && !consumeShieldCharge()) {
        pushLog(`${skill.name} charge could not be consumed.`, "bad");
        return false;
      }

      state.player.barrierArmor = 0;
      state.player.barrierTurns = 0;
      state.player.shieldStoredDamage = 0;
      const appliedShield = Math.max(
        MIN_EFFECTIVE_DAMAGE,
        Math.round(
          Math.max(1, Number(state.player.maxHp) || 1) *
          (shieldTier >= 1 ? SHIELD_RARE_HP_MULTIPLIER : SHIELD_BASE_HP_MULTIPLIER)
        )
      );
      const shieldCap = typeof getSkillShieldCapForTier === "function"
        ? getSkillShieldCapForTier(shieldTier)
        : Number.POSITIVE_INFINITY;
      const finalShield = Math.min(appliedShield, Number.isFinite(shieldCap) ? shieldCap : appliedShield);
      const fracturedSigilActive = typeof hasRelic === "function" && hasRelic("fracturedsigil");
      const finalBarrier = Math.max(
        MIN_EFFECTIVE_DAMAGE,
        Math.round(finalShield * FRACTURED_SIGIL_BARRIER_MULTIPLIER)
      );
      if (fracturedSigilActive) {
        state.player.fracturedShieldBarrier = Math.max(0, Number(state.player.fracturedShieldBarrier) || 0) + finalBarrier;
        if (typeof capPlayerHpShield === "function") {
          capPlayerHpShield();
        }
      } else {
        state.player.skillShield = finalShield;
      }
      if (shieldTier >= LEGENDARY_SKILL_TIER) {
        const currentBonus = Math.max(0, Number(state.player.skillShieldArmorBonus) || 0);
        if (currentBonus <= 0) {
          state.player.skillShieldArmorBonus = SHIELD_LEGENDARY_ARMOR_BONUS;
          state.player.armor += SHIELD_LEGENDARY_ARMOR_BONUS;
        }
      }
      spawnParticles(state.player.x, state.player.y, "#b4d3ff", 12, 1.15);
      spawnFloatingText(
        state.player.x,
        state.player.y,
        fracturedSigilActive ? `+${finalBarrier} BR` : `+${finalShield} SH`,
        fracturedSigilActive ? "#7be0ff" : "#d8ecff"
      );
      let pushed = 0;
      if (shieldTier >= 1) {
        function pushEnemyChain(enemy, dx, dy, visited = new Set()) {
          if (!enemy || !state.enemies.includes(enemy)) return false;
          if (dx === 0 && dy === 0) return false;
          if (visited.has(enemy)) return false;
          if (
            typeof isEnemyImmuneToPlayerForcedMovement === "function" &&
            isEnemyImmuneToPlayerForcedMovement(enemy)
          ) return false;
          visited.add(enemy);
          const nx = enemy.x + dx;
          const ny = enemy.y + dy;
          if (!inBounds(nx, ny)) return false;
          if (state.player.x === nx && state.player.y === ny) return false;
          if (typeof isForgeBlockedTile === "function" && isForgeBlockedTile(nx, ny)) return false;
          if (getChestAt(nx, ny)) return false;
          const blocker = getEnemyAt(nx, ny);
          if (blocker && blocker !== enemy) {
            if (!pushEnemyChain(blocker, dx, dy, visited)) {
              return false;
            }
          }
          if (!state.enemies.includes(enemy)) return false;
          startTween(enemy);
          enemy.x = nx;
          enemy.y = ny;
          enemy.facing = getFacingFromDelta(dx, dy, enemy.facing);
          spawnParticles(enemy.x, enemy.y, "#b5d4ff", 7, 1.05);
          if (typeof resolveEnemyPitFall === "function" && resolveEnemyPitFall(enemy, { fromPlayer: true })) return true;
          applySpikeToEnemy(enemy, { onEntry: true });
          return true;
        }

        const nearbyEnemies = [...state.enemies].filter(
          (enemy) => Math.abs(enemy.x - state.player.x) <= 1 && Math.abs(enemy.y - state.player.y) <= 1
        );
        for (const enemy of nearbyEnemies) {
          if (!state.enemies.includes(enemy)) continue;
          const awayDx = sign(enemy.x - state.player.x);
          const awayDy = sign(enemy.y - state.player.y);
          if (awayDx === 0 && awayDy === 0) continue;
          if (
            typeof isEnemyImmuneToPlayerForcedMovement === "function" &&
            isEnemyImmuneToPlayerForcedMovement(enemy)
          ) continue;
          if (pushEnemyChain(enemy, awayDx, awayDy, new Set())) {
            pushed += 1;
            continue;
          }
          if (
            typeof isEnemyImmuneToPlayerForcedMovement === "function" &&
            isEnemyImmuneToPlayerForcedMovement(enemy)
          ) continue;
          const knockTile = findDashKnockbackTile(enemy, awayDx, awayDy);
          if (!knockTile) continue;
          startTween(enemy);
          enemy.x = knockTile.x;
          enemy.y = knockTile.y;
          enemy.facing = getFacingFromDelta(knockTile.x - state.player.x, knockTile.y - state.player.y, enemy.facing);
          spawnParticles(knockTile.x, knockTile.y, "#b5d4ff", 7, 1.05);
          if (typeof resolveEnemyPitFall === "function" && resolveEnemyPitFall(enemy, { fromPlayer: true })) {
            pushed += 1;
            continue;
          }
          applySpikeToEnemy(enemy, { onEntry: true });
          pushed += 1;
        }
      }
      setShake(1.2);
      const shieldChargesAfter = shieldTier >= 2 && typeof getShieldChargesInfo === "function"
        ? getShieldChargesInfo()
        : null;
      pushLog(
        `${fracturedSigilActive ? "Fractured Shield" : "Shield"} up: +${fracturedSigilActive ? finalBarrier : finalShield} ${fracturedSigilActive ? "barrier" : "shield"}${shieldTier >= 1 ? `, knockback ${pushed}` : ""}${shieldTier >= LEGENDARY_SKILL_TIER ? `, +${SHIELD_LEGENDARY_ARMOR_BONUS} ARM` : ""}${shieldChargesAfter?.enabled ? `, charges ${shieldChargesAfter.charges}/${shieldChargesAfter.max}` : ""}.`,
        "good"
      );
      if (typeof onSuccessfulSkillCast === "function") {
        const continueTurn = onSuccessfulSkillCast(skill.id, skill.name);
        if (continueTurn === false || state.phase !== "playing") {
          return true;
        }
      }
      if (shieldTier < 2) {
        putSkillOnCooldown(skill.id);
      }
      finalizeTurn();
      return true;
    }

    function tryUseSkillByKey(key) {
      if (state.phase !== "playing") return false;
      if (key === "z") return tryArmDashSkill();
      if (key === "x") return tryUseAoeSkill();
      if (key === "c") return tryUseShieldSkill();
      return false;
    }

    return {
      cancelDashAim,
      tryArmDashSkill,
      tryUseDashSkill,
      tryUseAoeSkill,
      tryUseShieldSkill,
      tryUseSkillByKey
    };
  }

  window.DungeonSkillsActions = {
    create
  };
})();
