const assert = require("node:assert/strict");
const { getPactSigilRevealFx } = require("../pact-sigil-fx.js");

function run() {
  const fx = getPactSigilRevealFx();
  assert.ok(Array.isArray(fx.particles));
  assert.ok(Array.isArray(fx.rings));
  assert.equal(fx.particles.length, 3);
  assert.equal(fx.rings.length, 2);
  assert.ok(fx.shake > 0);
  assert.deepEqual(fx.particles.map((entry) => entry.color), ["#b56cff", "#ff5ab3", "#f0dcff"]);
  console.log("pact-sigil-fx tests: OK");
}

run();
