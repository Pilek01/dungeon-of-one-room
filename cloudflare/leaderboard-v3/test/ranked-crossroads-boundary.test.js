import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

let generated;
async function game() {
  if (!generated) {
    execFileSync(process.execPath, ["scripts/build-pages-v3.mjs", "--target", "test"], { cwd: new URL("../../..", import.meta.url), stdio: "pipe" });
    generated = await readFile(new URL("../../../output/pages-test-dist/game.js", import.meta.url), "utf8");
  }
  return generated;
}
async function helper(name, nextName) {
  const source = await game();
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf(`  function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `missing ${name}`);
  return source.slice(start, end);
}
test("canonical transaction gold is excluded once without discarding room rewards", async () => {
  const source = await helper("syncRankedBoundaryGold", "syncRankedCrossroadsResolution");
  const ctx = { state: { onlineV3Ranked: true, onlineV3Directive: { directiveId: "room" } }, onlineV3RoomStartingGold: 143, onlineV3LastCanonicalRoomGold: 143 };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  const snapshot = { gold: 261, currentRoomDirective: { directiveId: "room" } };
  ctx.snapshot = snapshot;
  vm.runInContext("syncRankedBoundaryGold(snapshot); syncRankedBoundaryGold(snapshot);", ctx);
  assert.equal(ctx.onlineV3RoomStartingGold, 261);
  assert.equal((261 + 17) - ctx.onlineV3RoomStartingGold, 17);
  ctx.snapshot = { gold: 241, currentRoomDirective: { directiveId: "room" } };
  vm.runInContext("syncRankedBoundaryGold(snapshot)", ctx);
  assert.equal(ctx.onlineV3RoomStartingGold, 241);
  ctx.snapshot = { gold: 999, currentRoomDirective: { directiveId: "other" } };
  vm.runInContext("syncRankedBoundaryGold(snapshot)", ctx);
  assert.equal(ctx.onlineV3RoomStartingGold, 241);
});
test("confirmed Crossroads choice consumes both local chests and applies resources only once", async () => {
  const source = await helper("syncRankedCrossroadsResolution", "resetRankedCanonicalChestSlots");
  const ctx = { state: { onlineV3Ranked: true, onlineV3Directive: { directiveId: "room" }, roomType: "crossroads", turn: 18, relics: [], player: { hp: 50, maxHp: 100 }, skillCooldowns: { shield: 4 }, chests: [{ type: "crossroads_power", opened: false }, { type: "crossroads_mercy", opened: false }] }, applyRelicEffects() {}, removeRelicEffects() {} };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  ctx.snapshot = { currentRoomDirective: { directiveId: "room", specialRoomPayload: { crossroadsResolution: { transactionId: "tx", action: "mercy" } } }, build: { relics: [], resources: { hp: 100, maxHp: 100, turn: 18, crossroadsPowerMaxHpPenalty: 0, crossroadsPowerExpireTurn: -1, skillCooldowns: { shield: 0 } } } };
  vm.runInContext("syncRankedCrossroadsResolution(snapshot)", ctx);
  assert.ok(ctx.state.chests.every(chest => chest.opened));
  assert.equal(ctx.state.player.hp, 100);
  assert.equal(ctx.state.skillCooldowns.shield, 0);
  ctx.state.player.hp = 95;
  vm.runInContext("syncRankedCrossroadsResolution(snapshot)", ctx);
  assert.equal(ctx.state.player.hp, 95, "replayed receipt must not heal twice");
});
test("Ranked native Crossroads effects cannot bypass the canonical choice", async () => {
  const source = await game();
  for (const [name, nextName] of [["openCrossroadsPowerChest", "openCrossroadsMercyChest"], ["openCrossroadsMercyChest", "openChest"]]) {
    const start = source.indexOf(`  function ${name}(`);
    const end = source.indexOf(`  function ${nextName}(`, start);
    assert.ok(start >= 0 && end > start);
    const ctx = { state: { onlineV3Ranked: true } };
    vm.runInNewContext(`${source.slice(start, end)}; ${name}({});`, ctx);
  }
});

test("POWER preserves local penalty then Titan Heart gain instead of overwriting its HP bonus", async () => {
  const source = await helper("syncRankedCrossroadsResolution", "resetRankedCanonicalChestSlots");
  const effects = await helper("applyRelicEffects", "removeRelicEffects");
  const ctx = { state: { onlineV3Ranked: true, onlineV3Directive: { directiveId: "room" }, roomType: "crossroads", turn: 18, relics: [], chests: [], skillCooldowns: {}, player: { hp: 100, maxHp: 100, attack: 50, armor: 5 } },
    scaledCombat: amount => amount * 10, MIN_EFFECTIVE_DAMAGE: 1,
    CROSSROADS_POWER_HP_COST_MULTIPLIER: 0.15, CROSSROADS_POWER_DURATION_TURNS: 100 };
  vm.createContext(ctx); vm.runInContext(effects + source, ctx);
  ctx.snapshot = { currentRoomDirective: { directiveId: "room", specialRoomPayload: { crossroadsResolution: { transactionId: "power", action: "power_acquire" } } }, build: { relics: [{ relicId: "titanheart", stacks: 1 }], resources: { hp: 85, maxHp: 85, crossroadsPowerMaxHpPenalty: 15, crossroadsPowerExpireTurn: 100, turn: 0, skillCooldowns: {} } } };
  vm.runInContext("syncRankedCrossroadsResolution(snapshot)", ctx);
  assert.equal(ctx.state.player.maxHp, 145);
  assert.equal(ctx.state.player.hp, 145);
  assert.equal(ctx.state.player.crossroadsPowerMaxHpPenalty, 15);
  assert.equal(ctx.state.player.crossroadsPowerExpireTurn, 118);
});
