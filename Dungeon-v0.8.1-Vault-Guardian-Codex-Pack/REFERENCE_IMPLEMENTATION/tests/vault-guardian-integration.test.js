const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "game.js"), "utf8");
const vaultRoom = fs.readFileSync(path.join(root, "vault-room.js"), "utf8");
const snapshot = fs.readFileSync(path.join(root, "render", "visual-snapshot.js"), "utf8");
const hdVfx = fs.readFileSync(path.join(root, "render", "hd-vfx.js"), "utf8");
const hdLayers = fs.readFileSync(path.join(root, "render", "hd-renderer-layers.js"), "utf8");
const scenarios = fs.readFileSync(path.join(root, "scenario-overrides.js"), "utf8");

for (const hook of [
  "function isVaultChestLockedForInteraction",
  "function castVaultHoardSentence",
  "function tickVaultHoardSentences",
  "function startVaultLockdownPulse",
  "function executeVaultLockdownPulse",
  "function handleVaultGuardianAbilityKit",
  "function releaseVaultChestsAfterGuardianDeath"
]) {
  assert.ok(game.includes(hook), `missing Vault Guardian integration hook: ${hook}`);
}

assert.match(game, /state\.turn \+= 1;\s*\n\s*tickVaultHoardSentences\(\);/);
assert.match(game, /if \(enemy\.type === "guardian" && state\.roomType === "vault"\) \{\s*\n\s*if \(handleVaultGuardianAbilityKit\(enemy\)\)/);
assert.match(game, /enemy\.cooldown = enemy\.type === "guardian" \? VAULT_GUARDIAN_SLAM_COOLDOWN : 3;/);
assert.match(game, /if \(enemy\.type === "guardian" && state\.roomType === "vault"\) \{\s*\n\s*releaseVaultChestsAfterGuardianDeath\(\);/);
assert.match(game, /if \(isVaultChestLockedForInteraction\(chest\)\)/);
assert.match(game, /openChest\(chest, \{ silent: true \}\)/);
assert.match(game, /vaultCondemnTurns: Math\.max\(0, Math\.round\(Number\(chest\.vaultCondemnTurns\)/);
assert.match(game, /vaultLockdownTargets = targets\.map/);
assert.match(game, /VAULT_LOCKDOWN_DAMAGE_MULTIPLIER/);
assert.match(game, /hasPact\("chains"\)/);

for (const field of [
  "vaultSentenceCooldown",
  "vaultLockdownCooldown",
  "vaultLockdownAiming",
  "vaultLockdownTargets",
  "vaultChestDestroyedTurn",
  "vaultCondemned",
  "vaultCondemnTurns",
  "vaultCondemnMaxTurns",
  "destroyed"
]) {
  assert.ok(game.includes(field), `game state missing ${field}`);
}

for (const exported of [
  "VAULT_GUARDIAN_SLAM_COOLDOWN_TURNS",
  "VAULT_SENTENCE_FIRST_DELAY_TURNS",
  "VAULT_SENTENCE_COOLDOWN_TURNS",
  "VAULT_SENTENCE_FUSE_TURNS",
  "VAULT_LOCKDOWN_FIRST_DELAY_TURNS",
  "VAULT_LOCKDOWN_COOLDOWN_TURNS",
  "chooseVaultSentenceChest",
  "chooseVaultLockdownTargets",
  "getVaultLockdownBlastTiles",
  "shouldReserveGuardianMajorAbility"
]) {
  assert.ok(vaultRoom.includes(exported), `vault-room.js missing ${exported}`);
}

assert.ok(snapshot.includes('"vaultLockdownTargets"') || snapshot.includes("vaultLockdownTargets"));
assert.ok(snapshot.includes('"vaultCondemnTurns"'));
assert.ok(hdVfx.includes('kind: "vault-sentence-mark"'));
assert.ok(hdVfx.includes('kind: "vault-lockdown-area"'));
assert.ok(hdLayers.includes("drawVaultChestLock"));
assert.ok(hdLayers.includes("drawDestroyedVaultChest"));
assert.ok(scenarios.includes("expansion_vault_guardian_hd"));
assert.ok(scenarios.includes('forceExpansionHDShowcaseSetup: "vault-guardian-abilities"'));

console.log("vault-guardian integration tests: OK");
