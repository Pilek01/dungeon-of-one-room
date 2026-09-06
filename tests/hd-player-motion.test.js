const assert = require("node:assert/strict");
const test = require("node:test");
const layers = require("../render/hd-renderer-layers.js");

function snapshot(player = {}, time = 0) {
  return { phase: "playing", playerAnimTimer: time, player: {
    x: 3, y: 3, hp: 10, facing: "east", _tweenT: 120,
    ...player
  } };
}

test("each step shows every walking pose independently of the idle clock", () => {
  for (const clock of [0, 90000, 90119]) {
    const frames = [0, 30, 60, 90].map((time) => layers.selectPlayerVisual(
      snapshot({ _tweenT: time, lastMoveX: 1, lastMoveY: 0 }, clock)
    ).frame);
    assert.deepEqual(frames, [1, 2, 3, 4]);
  }
});

test("breathing is subtle and moving feet settle at the tile boundary", () => {
  const still = layers.selectPlayerMotion(snapshot({}, 600));
  assert.ok(still.y < 0 && still.y >= -1.2);
  const mid = layers.selectPlayerMotion(snapshot({ _tweenT: 60, lastMoveX: 1 }));
  assert.ok(mid.y < -1 && mid.y >= -3);
  const end = layers.selectPlayerMotion(snapshot({ _tweenT: 119.999, lastMoveX: 1 }));
  assert.ok(Math.abs(end.x) < 0.001 && Math.abs(end.y) < 0.001);
});

test("attack winds back, lunges toward facing and recovers without moving simulation", () => {
  for (const [facing, axis, sign] of [["east", "x", 1], ["west", "x", -1], ["south", "y", 1], ["north", "y", -1]]) {
    const at = (timer) => snapshot({ facing, visualAction: "attack", visualActionTimer: timer });
    assert.ok(layers.selectPlayerMotion(at(192))[axis] * sign < 0);
    const source = at(120);
    const before = structuredClone(source);
    assert.ok(layers.selectPlayerMotion(source)[axis] * sign > 3);
    assert.deepEqual(source, before);
    assert.deepEqual(layers.selectPlayerMotion(at(0)), { x: 0, y: 0 });
  }
});

test("damage overrides an attack and death remains still", () => {
  const injured = snapshot({ visualAction: "attack", visualActionTimer: 120, hitFlash: 80 });
  assert.ok(layers.selectPlayerMotion(injured).x < 0);
  for (const time of [0, 600, 90000]) {
    assert.deepEqual(layers.selectPlayerMotion(snapshot({ hp: 0, hitFlash: 80 }, time)), { x: 0, y: 0 });
  }
});

test("drawn movement adds only a bounded pose offset and preserves sprite dimensions", () => {
  const source = snapshot({ _tweenT: 60, _tweenFromX: 32, _tweenFromY: 48, lastMoveX: 1 });
  const before = structuredClone(source);
  const image = {};
  const calls = [];
  layers.drawPlayerLayer({ drawImage(...args) { calls.push(args); } }, source,
    new Map([[layers.selectPlayerVisual(source).key, image]]));
  assert.equal(calls.length, 1);
  assert.ok(calls[0][1] >= 168 && calls[0][1] <= 170);
  assert.ok(calls[0][2] < 176 && calls[0][2] >= 173);
  assert.deepEqual(calls[0].slice(3), [80, 80]);
  assert.deepEqual(source, before);
});
