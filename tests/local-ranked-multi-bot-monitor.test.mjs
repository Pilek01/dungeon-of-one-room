import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  BotProgressMonitor,
  captureBotFailure,
  classifyImmediateFailure,
  sampleBotPage
} from "../scripts/local-ranked-multi-bot-monitor.mjs";

function activeSample(fingerprint, extra = {}) {
  return {
    game: {
      phase: "playing",
      depth: 5,
      roomIndex: 1,
      turn: fingerprint,
      player: { x: 2, y: 3 },
      enemyCount: 1,
      enemyHpTotal: 10,
      roomCleared: false,
      interactables: { portal: { x: 7, y: 7 } }
    },
    observer: { enabled: true, lastDecision: `move-${fingerprint}` },
    sessionState: "ROOM_ACTIVE",
    overlayText: "",
    pageErrors: [],
    ...extra
  };
}

test("classifies reconnect, integrity, and page errors but ignores intentional stops", () => {
  assert.equal(classifyImmediateFailure(activeSample("A", {
    overlayText: "RANKED RECONNECT REQUIRED"
  }))?.kind, "reconnect");
  assert.equal(classifyImmediateFailure(activeSample("A", {
    sessionState: "RECONNECT_REQUIRED"
  }))?.kind, "reconnect");
  assert.equal(classifyImmediateFailure(activeSample("A", {
    overlayText: "Ranked integrity check failed"
  }))?.kind, "integrity");
  assert.equal(classifyImmediateFailure(activeSample("A", {
    pageErrors: ["boom"]
  }))?.kind, "page_error");
  assert.equal(classifyImmediateFailure(activeSample("A", {
    snapshot: { publicState: { rankEligibility: "provisional", rankIntegrity: { reasonCodes: ["ROOM_SIGNAL"] } } }
  }))?.kind, "integrity");
  assert.equal(classifyImmediateFailure(activeSample("A", {
    intentionalStop: true,
    pageErrors: ["closed"]
  })), null);
  assert.equal(classifyImmediateFailure(activeSample("A", {
    sessionState: "FINALIZED",
    observer: { enabled: false }
  })), null);
});

test("detects the exact 30-second stall while known boundary waits reset the clock", () => {
  const monitor = new BotProgressMonitor({ stallMs: 30_000, loopMs: 30_000 });
  assert.equal(monitor.observe(activeSample("A"), 0), null);
  assert.equal(monitor.observe(activeSample("A"), 29_999), null);
  assert.equal(monitor.observe(activeSample("A"), 30_000)?.kind, "stall");

  const boundaryMonitor = new BotProgressMonitor({ stallMs: 30_000, loopMs: 30_000 });
  assert.equal(boundaryMonitor.observe(activeSample("A"), 0), null);
  assert.equal(boundaryMonitor.observe(activeSample("A", { sessionState: "AWAITING_REWARD_OR_TRANSACTION" }), 30_000), null);
  assert.equal(boundaryMonitor.observe(activeSample("A"), 59_999), null);
  assert.equal(boundaryMonitor.observe(activeSample("A"), 60_000)?.kind, "stall");
});

test("captures a Ranked boundary that remains unchanged beyond its bounded grace period", () => {
  const monitor = new BotProgressMonitor({
    stallMs: 30_000,
    loopMs: 30_000,
    boundaryStallMs: 60_000
  });
  const waiting = activeSample("A", {
    sessionState: "ENTERING_NEXT_ROOM",
    game: {
      ...activeSample("A").game,
      phase: "dead"
    },
    observer: { enabled: true, lastDecision: "online_v3_wait" }
  });

  assert.equal(monitor.observe(waiting, 0), null);
  assert.equal(monitor.observe(waiting, 59_999), null);
  const incident = monitor.observe(waiting, 60_000);
  assert.equal(incident?.kind, "boundary_stall");
  assert.match(incident?.detail || "", /ENTERING_NEXT_ROOM/u);
});

test("detects a sustained A-B-A-B loop without sharing state between bots", () => {
  const first = new BotProgressMonitor({ stallMs: 60_000, loopMs: 30_000 });
  const second = new BotProgressMonitor({ stallMs: 60_000, loopMs: 30_000 });
  assert.equal(first.observe(activeSample("A"), 0), null);
  assert.equal(first.observe(activeSample("B"), 10_000), null);
  assert.equal(first.observe(activeSample("A"), 20_000), null);
  assert.equal(first.observe(activeSample("B"), 30_000)?.kind, "loop");
  assert.equal(second.observe(activeSample("A"), 30_000), null);
});

test("detects an A-B movement loop even while turns and decisions keep changing", () => {
  const monitor = new BotProgressMonitor({ stallMs: 60_000, loopMs: 30_000 });
  const position = (x, y, turn, decision) => activeSample(turn, {
    game: { ...activeSample(turn).game, turn, player: { x, y } },
    observer: { enabled: true, lastDecision: decision }
  });
  assert.equal(monitor.observe(position(2, 3, 10, "left"), 0), null);
  assert.equal(monitor.observe(position(3, 3, 11, "right"), 10_000), null);
  assert.equal(monitor.observe(position(2, 3, 12, "chase"), 20_000), null);
  assert.equal(monitor.observe(position(3, 3, 13, "fallback"), 30_000)?.kind, "loop");
});

test("classifies a cleared active room without a portal as a missing-portal failure", () => {
  const sample = activeSample("A", {
    game: {
      ...activeSample("A").game,
      roomCleared: true,
      interactables: { portal: null }
    }
  });
  assert.equal(classifyImmediateFailure(sample)?.kind, "missing_portal");
});

test("samples readable names for every canonical relic in the current build", async (context) => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  context.after(() => {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  });
  globalThis.window = {
    render_game_to_text: () => JSON.stringify({ depth: 9 }),
    DungeonOnlineV3: {
      getSessionState: () => "ROOM_ACTIVE",
      getSnapshot: () => ({
        publicState: {
          build: {
            relics: [
              { relicId: "fang", stacks: 1 },
              { relicId: "merchfavor1", stacks: 2 }
            ]
          }
        }
      })
    },
    __DUNGEON_MULTI_BOT_TELEMETRY__: {
      observerState: () => ({ enabled: true }),
      relicName: (relicId) => ({ fang: "Blood Fang", merchfavor1: "Merchant's Favor I" })[relicId]
    }
  };
  globalThis.document = { querySelector: () => null };
  const runtime = {
    pageErrors: [],
    page: {
      async evaluate(callback) { return callback(); },
      isClosed: () => false
    }
  };

  const sample = await sampleBotPage(runtime);

  assert.deepEqual(sample.relicNames, {
    fang: "Blood Fang",
    merchfavor1: "Merchant's Favor I"
  });
});

test("captures all seven redacted artifacts once and leaves the failed page open", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dungeon-multi-bot-monitor-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const password = "observer-password-fixture";
  const signingSecret = "signing-secret-fixture";
  let screenshots = 0;
  let stops = 0;
  const runtime = {
    bot: { id: "bot-01", artifactDir: root },
    consoleRing: [`error: ${password}`],
    networkErrors: [{ url: `/api/v3/event?secret=${signingSecret}` }],
    pageErrors: [],
    redact: (value) => String(value).replaceAll(password, "[REDACTED]").replaceAll(signingSecret, "[REDACTED]"),
    page: {
      async screenshot({ path: screenshotPath }) {
        screenshots += 1;
        await writeFile(screenshotPath, "png");
      },
      async evaluate() {
        if (stops === 0) {
          stops += 1;
          return {
            game: { depth: 9, note: password },
            sessionState: "ROOM_ACTIVE",
            snapshot: { revision: 4, token: signingSecret },
            rankedDiagnostics: [{ code: "INTERNAL_ERROR", detail: signingSecret }],
            observerTrace: `trace ${password}`
          };
        }
        stops += 1;
        return true;
      }
    }
  };

  const incident = { kind: "stall", at: "2026-08-30T12:00:00.000Z" };
  const first = await captureBotFailure(runtime, incident, { secrets: [password, signingSecret] });
  const second = await captureBotFailure(runtime, incident, { secrets: [password, signingSecret] });
  assert.equal(first, second);
  assert.equal(screenshots, 1);
  assert.equal(stops, 2, "one collection evaluation and one Observer stop evaluation are expected");
  assert.equal(first.pageLeftOpen, true);

  assert.deepEqual((await readdir(root)).sort(), [
    "console.log",
    "failure-summary.json",
    "game-state.json",
    "network-errors.json",
    "observer-bot-trace.txt",
    "ranked-diagnostics.json",
    "screenshot.png"
  ]);
  for (const file of (await readdir(root)).filter((name) => name !== "screenshot.png")) {
    const text = await readFile(path.join(root, file), "utf8");
    assert.doesNotMatch(text, new RegExp(`${password}|${signingSecret}`, "u"), file);
  }
});

test("still writes all seven public artifacts when the Chrome page has already exited", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dungeon-multi-bot-exited-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const runtime = {
    bot: { id: "bot-08", artifactDir: root },
    consoleRing: ["page closed"],
    networkErrors: [],
    pageErrors: ["Target page, context or browser has been closed"],
    page: {
      async evaluate() { throw new Error("Target page has been closed"); },
      async screenshot() { throw new Error("Target page has been closed"); }
    }
  };

  const record = await captureBotFailure(runtime, { kind: "unexpected_exit" });
  assert.equal(record.pageLeftOpen, false);
  assert.deepEqual((await readdir(root)).sort(), [
    "console.log",
    "failure-summary.json",
    "game-state.json",
    "network-errors.json",
    "observer-bot-trace.txt",
    "ranked-diagnostics.json",
    "screenshot.png"
  ]);
  assert.ok((await readFile(path.join(root, "screenshot.png"))).byteLength > 0);
});
