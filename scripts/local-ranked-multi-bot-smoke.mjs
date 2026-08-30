import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveChromeExecutable } from "./local-ranked-multi-bot-browser.mjs";
import { startMultiBotWall as defaultStartMultiBotWall } from "./local-ranked-multi-bot-controller.mjs";
import { assertOwnedSessionChild } from "./local-ranked-multi-bot-domain.mjs";
import { startLocalRankedTest as defaultStartLocalRankedTest } from "./local-ranked-test-launcher-core.mjs";

const FULL_COMMIT_HASH = /^[0-9a-f]{40}$/u;
const REQUIRED_FAILURE_ARTIFACTS = Object.freeze([
  "failure-summary.json",
  "screenshot.png",
  "ranked-diagnostics.json",
  "observer-bot-trace.txt",
  "game-state.json",
  "console.log",
  "network-errors.json"
]);

async function defaultInspectBot(entry) {
  return entry.runtime.page.evaluate(async () => {
    const store = window.DungeonRankedV3Storage.createStore(window.localStorage);
    const installationId = store.getInstallationId(() => window.crypto.randomUUID());
    const digest = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(installationId)
    );
    const installationHash = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    const profile = store.loadProfile() || {};
    const snapshot = window.DungeonOnlineV3?.getSnapshot?.() || {};
    const game = JSON.parse(window.render_game_to_text());
    return {
      name: String(window.localStorage.getItem("dungeonOneRoomPlayerName") || ""),
      graphicsMode: String(document.querySelector("#game")?.dataset.graphicsMode || ""),
      installationHash,
      profileId: String(profile.profileId || ""),
      runId: String(snapshot.runId || ""),
      observerActive: window.DungeonOnlineV3GameBridge?.isRankedTestBotActive?.() === true,
      progress: JSON.stringify({
        depth: Number(game.depth) || 0,
        turn: Number(game.turn) || 0,
        x: Number(game.player?.x) || 0,
        y: Number(game.player?.y) || 0,
        decision: String(window.__DUNGEON_MULTI_BOT_TELEMETRY__?.observerState?.().lastDecision || "")
      })
    };
  });
}

async function defaultWaitForBotProgress(entry, before, inspectBot) {
  await entry.runtime.page.waitForFunction((previous) => {
    const game = JSON.parse(window.render_game_to_text());
    const current = JSON.stringify({
      depth: Number(game.depth) || 0,
      turn: Number(game.turn) || 0,
      x: Number(game.player?.x) || 0,
      y: Number(game.player?.y) || 0,
      decision: String(window.__DUNGEON_MULTI_BOT_TELEMETRY__?.observerState?.().lastDecision || "")
    });
    return current !== previous && window.DungeonOnlineV3GameBridge?.isRankedTestBotActive?.() === true;
  }, before.progress, { timeout: 30_000 });
  return inspectBot(entry);
}

async function verifyFailureArtifacts(artifactDir) {
  const files = new Set(await readdir(artifactDir));
  for (const required of REQUIRED_FAILURE_ARTIFACTS) {
    assert.ok(files.has(required), `Missing smoke artifact: ${required}`);
  }
}

function assertIsolatedBots(bot1, bot2) {
  assert.equal(bot1.name, "bot 1");
  assert.equal(bot2.name, "bot 2");
  assert.equal(bot1.graphicsMode, "hd");
  assert.equal(bot2.graphicsMode, "hd");
  assert.ok(bot1.installationHash && bot2.installationHash);
  assert.notEqual(bot1.installationHash, bot2.installationHash);
  assert.ok(bot1.profileId && bot2.profileId);
  assert.notEqual(bot1.profileId, bot2.profileId);
  assert.ok(bot1.runId && bot2.runId);
  assert.notEqual(bot1.runId, bot2.runId);
  assert.equal(bot1.observerActive, true);
  assert.equal(bot2.observerActive, true);
}

export async function runMultiBotSmoke(options = {}) {
  const repoRoot = path.resolve(String(options.repoRoot || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")));
  const commit = String(options.commit || "");
  if (!FULL_COMMIT_HASH.test(commit)) throw new TypeError("Smoke test requires a full commit hash.");

  const startLocalRankedTest = options.startLocalRankedTest || defaultStartLocalRankedTest;
  const startMultiBotWall = options.startMultiBotWall || defaultStartMultiBotWall;
  const inspectBot = options.inspectBot || defaultInspectBot;
  const waitForBotProgress = options.waitForBotProgress || defaultWaitForBotProgress;
  const password = String(options.password || "local-bot-test");
  const secret = String(options.secret || randomBytes(48).toString("base64"));
  const sessionId = String(options.sessionId || `smoke-${Date.now()}-${randomBytes(4).toString("hex")}`);
  const monitor = options.monitor || { x: 3440, y: 0, width: 1080, height: 1872 };
  const chromeExecutable = options.chromeExecutable || await resolveChromeExecutable();

  let worker = null;
  let wall = null;
  try {
    worker = await startLocalRankedTest({ hash: commit }, {
      repoRoot,
      observerPassword: password,
      secret
    });
    wall = await startMultiBotWall({
      repoRoot,
      sessionId,
      commit,
      monitor,
      worker,
      password,
      secret,
      chromeExecutable,
      testBotCount: 2
    });
    assert.equal(wall.bots.length, 2);

    const before1 = await inspectBot(wall.bots[0]);
    const before2 = await inspectBot(wall.bots[1]);
    assertIsolatedBots(before1, before2);

    const captured = await wall.captureBot("bot-01", { kind: "acceptance_capture" });
    await verifyFailureArtifacts(captured.artifactDir);
    const after1 = await inspectBot(wall.bots[0]);
    assert.equal(after1.observerActive, false);
    const after2 = await waitForBotProgress(wall.bots[1], before2, inspectBot);
    assert.equal(after2.observerActive, true);
    assert.notEqual(after2.progress, before2.progress);

    const bot1FinalPath = assertOwnedSessionChild(wall.sessionRoot, path.join(wall.bots[0].runtime.bot.artifactDir, "smoke-final-state.json"));
    const bot2FinalPath = assertOwnedSessionChild(wall.sessionRoot, path.join(wall.bots[1].runtime.bot.artifactDir, "smoke-final-state.json"));
    await mkdir(path.dirname(bot1FinalPath), { recursive: true });
    await mkdir(path.dirname(bot2FinalPath), { recursive: true });
    await writeFile(bot1FinalPath, `${JSON.stringify(after1, null, 2)}\n`, "utf8");
    await writeFile(bot2FinalPath, `${JSON.stringify(after2, null, 2)}\n`, "utf8");

    return Object.freeze({
      sessionRoot: wall.sessionRoot,
      bot1: after1,
      bot2: after2,
      bot1FinalPath,
      bot2FinalPath
    });
  } finally {
    if (wall) await wall.stop();
    else if (worker) await worker.stop();
  }
}

function readCliOption(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMultiBotSmoke({ commit: readCliOption(process.argv.slice(2), "--commit") }).then(
    (summary) => console.log(`Multi-bot smoke PASS: ${summary.sessionRoot}`),
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  );
}
