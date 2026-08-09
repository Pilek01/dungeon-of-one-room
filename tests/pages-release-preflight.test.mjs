import assert from "node:assert/strict";
import test from "node:test";
import { observerBotReleaseConfig } from "../scripts/pages-release-preflight.mjs";

test("release build rejects a missing Observer Bot password", () => {
  assert.throws(
    () => observerBotReleaseConfig({}, "release"),
    /DUNGEON_ONLINE_TEST_BOT_PASSWORD is required for release builds/u
  );
});

test("release config contains only an enabled flag and SHA-256 hash", () => {
  const result = observerBotReleaseConfig({
    DUNGEON_ONLINE_TEST_BOT_PASSWORD: "ephemeral-observer-password"
  }, "release");
  assert.equal(result.enabled, true);
  assert.match(result.passwordHash, /^sha256:[a-f0-9]{64}$/u);
  assert.doesNotMatch(JSON.stringify(result), /ephemeral-observer-password/u);
});
