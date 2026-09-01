import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { startMultiBotWall } from "../scripts/local-ranked-multi-bot-controller.mjs";

const COMMIT = "a".repeat(40);

function createFixture() {
  const events = [];
  const order = [];
  const launched = [];
  const started = [];
  const captures = [];
  const timers = [];
  const manifests = [];
  const removals = [];
  const resultWrites = [];
  let workerExit = null;
  const worker = {
    url: "http://127.0.0.1:9123",
    getLogs: () => "worker log",
    onExit(listener) { workerExit = listener; return () => { workerExit = null; }; },
    async stop() { order.push("worker:stop"); }
  };

  return {
    events,
    order,
    launched,
    started,
    captures,
    timers,
    manifests,
    removals,
    resultWrites,
    worker,
    async triggerWorkerExit() { await workerExit?.({ expected: false, code: 7 }); },
    options: {
      repoRoot: path.resolve("D:/repo"),
      sessionId: "session-a",
      commit: COMMIT,
      password: "observer-secret",
      secret: "signing-secret",
      chromeExecutable: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      monitor: { x: 3440, y: 0, width: 1080, height: 1872 },
      worker,
      emit: (event) => events.push(event),
      async mkdir() {},
      async writeManifest(manifestPath, manifest) { manifests.push([manifestPath, manifest]); },
      async writeFile(filePath, text) { order.push(`write:${path.basename(filePath)}:${text}`); },
      async writeBotResult(filePath, result) { resultWrites.push([filePath, result]); },
      async rm(candidate, options) { removals.push([candidate, options]); },
      async launchBotWindow(options) {
        launched.push(options);
        const runtime = {
          bot: options.bot,
          page: {},
          async stop() { order.push(`${options.bot.id}:stop`); },
          async focus() { order.push(`${options.bot.id}:focus`); }
        };
        return runtime;
      },
      async startBotRun(runtime, options) {
        started.push([runtime.bot.id, options.url, options.commit]);
        order.push(`${runtime.bot.id}:start`);
        return {
          status: "running",
          startingRelic: { relicId: "fang", name: "Blood Fang" }
        };
      },
      async captureBotFailure(runtime, incident) {
        captures.push([runtime.bot.id, incident]);
        return { botId: runtime.bot.id, artifactDir: runtime.bot.artifactDir, pageLeftOpen: true };
      },
      setInterval(callback) { const timer = { callback }; timers.push(timer); return timer; },
      clearInterval(timer) { timer.cleared = true; },
      wait: async () => {}
    }
  };
}

test("starts eight isolated windows sequentially on one Worker and one commit", async () => {
  const fixture = createFixture();
  const controller = await startMultiBotWall(fixture.options);

  assert.equal(fixture.launched.length, 8);
  assert.equal(fixture.started.length, 8);
  assert.equal(new Set(fixture.launched.map((entry) => entry.bot.profileDir)).size, 8);
  assert.deepEqual(fixture.launched.map((entry) => entry.bot.name), [
    "bot 1", "bot 2", "bot 3", "bot 4", "bot 5", "bot 6", "bot 7", "bot 8"
  ]);
  assert.deepEqual(fixture.launched[0].bounds, { x: 3440, y: 0, width: 540, height: 468 });
  assert.deepEqual(fixture.launched[7].bounds, { x: 3980, y: 1404, width: 540, height: 468 });
  assert.ok(fixture.started.every(([, url, commit]) => url === fixture.worker.url && commit === COMMIT));
  assert.deepEqual(fixture.order.slice(0, 8), [
    "bot-01:start", "bot-02:start", "bot-03:start", "bot-04:start",
    "bot-05:start", "bot-06:start", "bot-07:start", "bot-08:start"
  ]);
  assert.equal(fixture.timers.length, 8);
  assert.equal(controller.bots.length, 8);
  assert.deepEqual(fixture.events[0], { type: "artifact_root", path: controller.sessionRoot });
  const startingEvents = fixture.events.filter(
    (event) => event.type === "bot_status" && event.status === "starting"
  );
  assert.equal(startingEvents.length, 8);
  assert.ok(startingEvents.every((event) => event.startingRelic === ""));
  assert.ok(startingEvents.every((event) => Array.isArray(event.relics)));

  const manifestText = JSON.stringify(fixture.manifests[0][1]);
  assert.match(manifestText, new RegExp(COMMIT, "u"));
  assert.doesNotMatch(manifestText, /observer-secret|signing-secret/u);
});

test("isolates Stop, Focus, and idempotent failure capture per bot", async () => {
  const fixture = createFixture();
  const controller = await startMultiBotWall(fixture.options);
  await controller.focusBot("bot-04");
  await controller.stopBot("bot-04");
  await controller.stopBot("bot-04");
  const first = await controller.captureBot("bot-05", { kind: "stall" });
  const second = await controller.captureBot("bot-05", { kind: "stall" });

  assert.equal(fixture.order.filter((entry) => entry === "bot-04:focus").length, 1);
  assert.equal(fixture.order.filter((entry) => entry === "bot-04:stop").length, 1);
  assert.equal(fixture.captures.length, 1);
  assert.equal(first, second);
  assert.equal(fixture.order.includes("bot-05:stop"), false, "a failed window must remain open");
});

test("stops owned contexts before the Worker, then removes only the owned profile root", async () => {
  const fixture = createFixture();
  const controller = await startMultiBotWall(fixture.options);
  await controller.stop();
  await controller.stop();

  assert.deepEqual(fixture.order.filter((entry) => entry.endsWith(":stop") || entry === "worker:stop"), [
    "bot-01:stop", "bot-02:stop", "bot-03:stop", "bot-04:stop",
    "bot-05:stop", "bot-06:stop", "bot-07:stop", "bot-08:stop", "worker:stop"
  ]);
  assert.equal(fixture.removals.length, 1);
  assert.equal(path.basename(fixture.removals[0][0]), "profiles");
  assert.deepEqual(fixture.removals[0][1], { recursive: true, force: true });
});

test("Stop All still closes every owned resource when one context and the Worker log fail", async () => {
  const fixture = createFixture();
  fixture.options.writeFile = async () => { throw new Error("disk full"); };
  const controller = await startMultiBotWall(fixture.options);
  controller.bots[2].runtime.stop = async () => {
    fixture.order.push("bot-03:stop");
    throw new Error("context close failed");
  };

  await assert.rejects(controller.stop(), /context close failed|disk full/u);
  assert.equal(fixture.order.includes("bot-08:stop"), true);
  assert.equal(fixture.order.includes("worker:stop"), true);
  assert.equal(fixture.removals.length, 1);
});

test("startup failure closes every already-started context, the Worker, and owned profiles", async () => {
  const fixture = createFixture();
  const launch = fixture.options.launchBotWindow;
  fixture.options.launchBotWindow = async (options) => {
    if (options.bot.id === "bot-04") throw new Error("launch failed");
    const runtime = await launch(options);
    if (options.bot.id === "bot-02") {
      runtime.stop = async () => {
        fixture.order.push("bot-02:stop");
        throw new Error("close failed");
      };
    }
    return runtime;
  };

  await assert.rejects(startMultiBotWall(fixture.options), /launch failed/u);
  assert.equal(fixture.order.includes("bot-01:stop"), true);
  assert.equal(fixture.order.includes("bot-03:stop"), true);
  assert.equal(fixture.order.includes("worker:stop"), true);
  assert.equal(fixture.removals.length, 1);
});

test("marks every bot blocked and flushes the Worker log once on unexpected Worker exit", async () => {
  const fixture = createFixture();
  const controller = await startMultiBotWall(fixture.options);
  await fixture.triggerWorkerExit();
  await fixture.triggerWorkerExit();

  assert.equal(fixture.events.filter((event) => event.type === "bot_status" && event.status === "blocked").length, 8);
  assert.equal(fixture.order.filter((entry) => entry.startsWith("write:worker.log")).length, 1);
  assert.equal(fixture.order.some((entry) => entry.endsWith(":stop")), false);
  assert.ok(controller.bots.every((bot) => bot.status === "blocked"));
});

test("marks a legally finalized run complete without creating failure artifacts", async () => {
  const fixture = createFixture();
  fixture.options.sampleBotPage = async () => ({
    game: { phase: "defeat", depth: 12 },
    observer: { enabled: false },
    sessionState: "FINALIZED",
    overlayText: "",
    pageErrors: []
  });
  const controller = await startMultiBotWall(fixture.options);
  await fixture.timers[0].callback();

  assert.equal(controller.bots[0].status, "completed");
  assert.equal(fixture.captures.length, 0);
  assert.equal(fixture.timers[0].cleared, true);
});

test("preserves the final score, highscore, starting relic, and last-life relic build", async () => {
  const fixture = createFixture();
  const samples = [
    {
      game: { phase: "playing", depth: 31, player: { hp: 44 } },
      observer: { enabled: true, lastDecision: "move" },
      sessionState: "ROOM_ACTIVE",
      relicNames: { fang: "Blood Fang", merchfavor1: "Merchant's Favor I" },
      snapshot: { publicState: {
        lives: 1,
        gold: 91,
        build: { relics: [
          { relicId: "fang", stacks: 1 },
          { relicId: "merchfavor1", stacks: 2 }
        ] },
        score: { score: 48_174, inputs: { acceptedRunGoldEarned: 1_942 } },
        mutatorProgress: { depthHighscore: 31 }
      } },
      overlayText: "",
      pageErrors: []
    },
    {
      game: { phase: "defeat" },
      observer: { enabled: false },
      sessionState: "FINALIZED",
      snapshot: null,
      overlayText: "",
      pageErrors: []
    }
  ];
  let index = 0;
  fixture.options.sampleBotPage = async () => samples[Math.min(index++, samples.length - 1)];
  const controller = await startMultiBotWall(fixture.options);
  await fixture.timers[0].callback();
  await fixture.timers[0].callback();

  const completed = fixture.events.filter(
    (event) => event.type === "bot_status" && event.botId === "bot-01"
  ).at(-1);
  assert.equal(completed.status, "completed");
  assert.equal(completed.score, 48_174);
  assert.equal(completed.depthHighscore, 31);
  assert.equal(completed.startingRelic, "Blood Fang");
  assert.deepEqual(completed.relics, [
    { relicId: "fang", name: "Blood Fang", stacks: 1 },
    { relicId: "merchfavor1", name: "Merchant's Favor I", stacks: 2 }
  ]);
  assert.equal(fixture.resultWrites.at(-1)[1].buildLabel, "final_last_life");
  assert.equal(controller.bots[0].status, "completed");
});

test("persists stopped bot results immediately without zeroing their last sample", async () => {
  const fixture = createFixture();
  fixture.options.sampleBotPage = async () => ({
    game: { phase: "playing", depth: 7, score: 700, player: { hp: 33 } },
    observer: { enabled: true, lastDecision: "portal" },
    sessionState: "ROOM_ACTIVE",
    snapshot: { publicState: { mutatorProgress: { depthHighscore: 9 } } },
    overlayText: "",
    pageErrors: []
  });
  const controller = await startMultiBotWall(fixture.options);
  await fixture.timers[0].callback();
  await controller.stopBot("bot-01");

  const persisted = fixture.resultWrites.at(-1)[1];
  assert.equal(persisted.status, "stopped");
  assert.equal(persisted.score, 700);
  assert.equal(persisted.depth, 7);
  assert.equal(persisted.depthHighscore, 9);
  assert.equal(persisted.buildLabel, "last_observed");
});

test("publishes canonical Ranked run metrics for the launcher", async () => {
  const fixture = createFixture();
  fixture.options.sampleBotPage = async () => ({
    game: { phase: "playing", depth: 9, player: { hp: 54 } },
    observer: { enabled: true, lastDecision: "move" },
    sessionState: "ROOM_ACTIVE",
    snapshot: {
      publicState: {
        lives: 4,
        gold: 287,
        score: {
          score: 48_174,
          inputs: { acceptedRunGoldEarned: 1_942 }
        },
        mutatorProgress: { depthHighscore: 31 }
      }
    },
    overlayText: "",
    pageErrors: []
  });
  await startMultiBotWall(fixture.options);
  await fixture.timers[0].callback();

  const latest = fixture.events.filter(
    (event) => event.type === "bot_status" && event.botId === "bot-01"
  ).at(-1);
  assert.equal(latest.depth, 9);
  assert.equal(latest.depthHighscore, 31);
  assert.equal(latest.score, 48_174);
  assert.equal(latest.lives, 4);
  assert.equal(latest.currentGold, 287);
  assert.equal(latest.totalGoldEarned, 1_942);
});

test("keeps polling while an active Observer moves from FINALIZED into the next run", async () => {
  const fixture = createFixture();
  const samples = [
    {
      game: { phase: "camp", depth: 12 },
      observer: { enabled: true, lastDecision: "camp_start_run" },
      sessionState: "FINALIZED",
      overlayText: "",
      pageErrors: []
    },
    {
      game: { phase: "playing", depth: 1 },
      observer: { enabled: true, lastDecision: "move" },
      sessionState: "ROOM_ACTIVE",
      overlayText: "",
      pageErrors: []
    }
  ];
  let sampleIndex = 0;
  fixture.options.sampleBotPage = async () => samples[Math.min(sampleIndex++, samples.length - 1)];
  const controller = await startMultiBotWall(fixture.options);

  await fixture.timers[0].callback();
  assert.equal(controller.bots[0].status, "running");
  assert.notEqual(fixture.timers[0].cleared, true);

  await fixture.timers[0].callback();
  const latest = fixture.events.filter(
    (event) => event.type === "bot_status" && event.botId === "bot-01"
  ).at(-1);
  assert.equal(latest.status, "running");
  assert.equal(latest.depth, 1);
  assert.equal(latest.lastDecision, "move");
});

test("keeps the last live bot state when a failure is captured", async () => {
  const fixture = createFixture();
  fixture.options.sampleBotPage = async () => ({
    game: { phase: "playing", depth: 4, score: 321, player: { hp: 27 } },
    observer: { enabled: true, lastDecision: "extract" },
    sessionState: "UNRECOVERABLE_PROTOCOL_ERROR",
    overlayText: "Ranked reconnect required",
    pageErrors: []
  });
  await startMultiBotWall(fixture.options);
  await fixture.timers[0].callback();

  const failed = fixture.events.filter(
    (event) => event.type === "bot_status" && event.botId === "bot-01" && event.status === "failed"
  ).at(-1);
  assert.equal(failed.depth, 4);
  assert.equal(failed.score, 321);
  assert.equal(failed.hp, 27);
  assert.equal(failed.lastDecision, "extract");
  assert.equal(Number.isNaN(Date.parse(failed.updatedAt)), false);
});

test("rejects an escaped session identifier before creating or deleting paths", async () => {
  const fixture = createFixture();
  await assert.rejects(
    startMultiBotWall({ ...fixture.options, sessionId: "../escape" }),
    /safe multi-bot session ID/u
  );
  assert.equal(fixture.launched.length, 0);
  assert.equal(fixture.removals.length, 0);
});
