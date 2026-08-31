import assert from "node:assert/strict";
import test from "node:test";

import {
  launchMutedBrowser,
  launchMutedPersistentContext
} from "../scripts/playwright-muted-launch.mjs";

test("automated Chromium launches always include one mute-audio switch", async () => {
  const calls = [];
  const chromium = {
    async launch(options) {
      calls.push(["launch", options]);
      return "browser";
    },
    async launchPersistentContext(profileDir, options) {
      calls.push(["persistent", profileDir, options]);
      return "context";
    }
  };

  assert.equal(await launchMutedBrowser(chromium, {
    headless: false,
    args: ["--use-gl=angle", "--mute-audio"]
  }), "browser");
  assert.equal(await launchMutedPersistentContext(chromium, "D:/profiles/bot-01", {
    args: ["--no-first-run"]
  }), "context");
  assert.deepEqual(calls, [
    ["launch", { headless: false, args: ["--use-gl=angle", "--mute-audio"] }],
    ["persistent", "D:/profiles/bot-01", { args: ["--no-first-run", "--mute-audio"] }]
  ]);
});
