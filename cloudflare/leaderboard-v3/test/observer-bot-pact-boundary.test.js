import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const GENERATED_ROOT = new URL("../../../output/pages-test-dist/", import.meta.url);
let generatedBuild;

async function ensureGeneratedBuild() {
  if (generatedBuild) return generatedBuild;
  generatedBuild = Promise.resolve().then(() => {
    if (existsSync(path.join(ROOT_PATH, "output", "pages-test-dist", "game.js"))) return;
    const result = spawnSync(process.execPath, [
      path.join(ROOT_PATH, "scripts", "build-pages-v3.mjs"),
      "--target",
      "test"
    ], { cwd: ROOT_PATH, encoding: "utf8" });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });
  return generatedBuild;
}

function pactState(overrides = {}) {
  return {
    runId: "run_pact_boundary",
    revision: 7,
    status: "active",
    rulesetHash: "v08-meta-1",
    currentRoomDirective: {
      directiveId: "pact_directive_1",
      runId: "run_pact_boundary",
      revision: 7,
      depth: 30,
      roomIndex: 30,
      roomType: "pact"
    },
    currentRewardEnvelope: { envelopeId: "reward_1" },
    ...overrides
  };
}

function makeBoundaryHarness({ legacy = false } = {}) {
  const calls = [];
  let projectionSyncCount = 0;
  let snapshot = { publicState: pactState() };
  const states = {
    abandoned: "ABANDONED_LOCAL_SESSION",
    active: "ROOM_ACTIVE",
    offer: "AWAITING_REWARD_OR_TRANSACTION",
    resolving: "RESOLVING_ROOM",
    next: "ENTERING_NEXT_ROOM",
    terminal: "TERMINAL",
    finalized: "FINALIZED",
    starting: "STARTING",
    startingRelic: "STARTING_RELIC",
    retrying: "RETRYING",
    finalizing: "FINALIZING",
    reconnect: "RECONNECT_REQUIRED",
    protocolError: "UNRECOVERABLE_PROTOCOL_ERROR"
  };
  const element = () => ({
    hidden: false,
    addEventListener() {},
    append() {},
    appendChild() {},
    setAttribute() {},
    querySelector() { return null; }
  });
  const client = {
    getSnapshot() { return snapshot; },
    async event(action, payload) {
      calls.push({ action, payload });
      if (action === "open_meta_offer") {
        snapshot = {
          publicState: pactState({
            metaTransactionOffer: {
              sourceType: "pact",
              sourceId: "pact-choice",
              choices: [{
                transactionId: "pact_1",
                choiceId: "pact_apply",
                status: "available",
                kind: "pact_apply"
              }]
            }
          })
        };
        return snapshot;
      }
      if (action === "commit_meta_transaction") {
        snapshot = {
          publicState: pactState({
            revision: 9,
            currentRoomDirective: {
              directiveId: "pact_next_directive",
              runId: "run_pact_boundary",
              revision: 9,
              depth: 31,
              roomIndex: 31,
              roomType: "combat",
              consumed: false
            }
          })
        };
        return { metaState: snapshot.publicState };
      }
      if (action === "request_extraction") {
        snapshot = {
          publicState: pactState({
            revision: 10,
            status: "extraction",
            currentRoomDirective: undefined,
            currentRewardEnvelope: undefined
          })
        };
        return { metaState: snapshot.publicState };
      }
      throw new Error(`Unexpected event: ${action}`);
    },
    async checkpoint(payload) {
      calls.push({ action: "checkpoint", payload });
      snapshot = {
        publicState: pactState({
          revision: 8,
          ...(legacy
            ? {
                rulesetHash: "sha256:5c3df81af373b68fce4d8fa242fb61c29b7c3d4ca78d6865d2ee51a58bbab3dd",
                currentRoomDirective: {
                directiveId: "pact_next_directive",
                runId: "run_pact_boundary",
                revision: 8,
                depth: 31,
                roomIndex: 31,
                roomType: "combat",
                consumed: false
                },
                metaTransactionOffer: undefined
              }
            : {
                currentRoomDirective: {
                  ...pactState().currentRoomDirective,
                  consumed: true
                },
                metaTransactionOffer: {
                  sourceType: "pact",
                  sourceId: "pact-choice",
                  choices: [{
                    transactionId: "pact_1",
                    choiceId: "pact_apply",
                    status: "available",
                    kind: "pact_apply"
                  }]
                }
              })
        })
      };
      return { ...snapshot, metaState: snapshot.publicState };
    },
    async resumeCanonical() {
      calls.push({ action: "resume" });
      return { metaState: snapshot.publicState };
    },
    async finalize() {
      calls.push({ action: "finalize" });
      return {
        metaState: {
          ...snapshot.publicState,
          status: "finalized"
        }
      };
    },
    releaseWriter() {},
    clear() {},
    clearRecovery() {}
  };
  const ui = {
    entry: element(),
    overlay: element(),
    button(label, onClick) { return { ...element(), label, onClick }; },
    hide() {},
    setStatus() {},
    setEntryVisible() {},
    showChoices(_title, _description, _choices, onChoice) { this.choiceHandler = onChoice; },
    showMenu() {},
    showMessage(...args) { this.lastMessage = args; },
    showSync() {}
  };
  const root = {
    console,
    URL,
    Promise,
    Date,
    Object,
    String,
    Number,
    Boolean,
    Array,
    Math,
    TypeError,
    Error,
    setTimeout,
    clearTimeout,
    location: { href: "https://example.test/" },
    document: { body: { append() {} }, createElement: element },
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    crypto: { randomUUID() { return "00000000-0000-4000-8000-000000000000"; } },
    addEventListener() {},
    setInterval() { return 0; },
    DungeonRankedV3Protocol: {
      isSupportedRulesetHash() { return true; },
      supportsBoundarySettlement() { return true; },
      supportsPostRoomPact() { return !legacy; }
    },
    DungeonRankedV3Client: {
      createRankedClient() { return client; },
      createLeaderboardClient() { return {}; },
      async sha256Hex() { return "hash"; }
    },
    DungeonRankedV3Directives: {
      applyOnlineV3RoomDirective(directive) { return directive; }
    },
    DungeonRankedV3Offers: {
      relicChoices(offer) { return offer.publicChoices || []; },
      replacementChoices(replacement) { return replacement.publicChoices || []; },
      metaChoices(offer) { return offer.choices || []; },
      pendingRewardSlots() { return []; },
      lostRelicId() { return null; }
    },
    DungeonRankedV3LeaderboardUi: {},
    DungeonRankedV3Ui: {
      createUi() { return ui; },
      relicDetails() { return { name: "Test relic" }; }
    },
    DungeonRankedV3Session: {
      STATES: states,
      createStateMachine(initial = states.active) {
        let current = initial;
        return {
          getState() { return current; },
          transition(next) { current = next; }
        };
      }
    },
    DungeonRankedV3Storage: {
      createStore() {
        return {
          clearSession() {},
          clearWriterLease() {},
          clearRecovery() {},
          clearProfile() {},
          loadRecovery() { return null; },
          loadProfile() { return null; },
          getInstallationId() { return "installation"; }
        };
      }
    },
    DungeonOnlineV3GameBridge: {
      startRanked(directive, publicState) {
        calls.push({ action: "startRanked", directive, publicState });
      },
      isRankedTestBotActive() { return false; },
      requiresRankedTestAssistance() { return false; },
      syncCanonicalProjection(publicState) {
        projectionSyncCount += 1;
      },
      captureRankedBoundary() {
        return { turnCount: 4, rewardClaims: [], reportedGoldDelta: 0 };
      },
      setRoomIntegrityContext(context) { root.integrityContext = context; },
      setNextDirective(directive) { calls.push({ action: "setNextDirective", directive }); },
      enterNextDirective() { calls.push({ action: "enterNextDirective" }); return true; }
    }
  };
  return { root, calls, ui, get projectionSyncCount() { return projectionSyncCount; } };
}

async function installRuntime(harness) {
  await ensureGeneratedBuild();
  const source = await readFile(new URL("online-v3/ranked-v3-runtime.js", GENERATED_ROOT), "utf8");
  vm.runInNewContext(source, harness.root, { filename: "ranked-v3-runtime.js" });
  return harness.root.DungeonOnlineV3;
}

async function settleBoundary(runtime, predicate) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("Ranked boundary did not settle");
}

test("active Ranked Pact receives its canonical post-checkpoint offer before portal entry", async () => {
  const harness = makeBoundaryHarness();
  const runtime = await installRuntime(harness);

  await runtime.onRoomEntered(harness.root.DungeonRankedV3Client.createRankedClient().getSnapshot().publicState.currentRoomDirective);
  await runtime.onLocalRoomCleared({
    turnCount: 4,
    rewardClaims: [],
    completionCapability: harness.root.integrityContext.completionCapability
  });
  assert.equal(runtime.onPortalEntry(), true);
  await settleBoundary(runtime, () => harness.calls.some((entry) => entry.action === "checkpoint"));

  assert.equal(
    harness.calls[0]?.action,
    "checkpoint",
    "Pact settlement must checkpoint before receiving the post-room canonical offer"
  );
  assert.equal(
    harness.calls.some((entry) => entry.action === "open_meta_offer"),
    false,
    "post-room Pact capability must not issue a pre-checkpoint offer"
  );
});

test("normal extraction after a cleared Ranked Pact commits the canonical offer before extracting", async () => {
  const harness = makeBoundaryHarness();
  const runtime = await installRuntime(harness);

  await runtime.onRoomEntered(harness.root.DungeonRankedV3Client.createRankedClient().getSnapshot().publicState.currentRoomDirective);
  await runtime.onLocalRoomCleared({
    turnCount: 4,
    rewardClaims: [],
    completionCapability: harness.root.integrityContext.completionCapability
  });
  await runtime.onExtraction("normal");

  assert.equal(
    harness.calls.some((entry) => entry.action === "request_extraction"),
    false,
    "normal extraction must wait for the mandatory post-room Pact choice"
  );
  assert.equal(typeof harness.ui.choiceHandler, "function", "the canonical Pact offer must be presented");

  await harness.ui.choiceHandler("pact_apply");

  assert.deepEqual(
    harness.calls
      .map((entry) => entry.action)
      .filter((action) => ["checkpoint", "commit_meta_transaction", "request_extraction"].includes(action)),
    ["checkpoint", "commit_meta_transaction", "request_extraction"]
  );
});

test("old Pact capability checkpoints then starts the next directive without opening an offer", async () => {
  const harness = makeBoundaryHarness({ legacy: true });
  const runtime = await installRuntime(harness);

  await runtime.onRoomEntered(harness.root.DungeonRankedV3Client.createRankedClient().getSnapshot().publicState.currentRoomDirective);
  await runtime.onLocalRoomCleared({
    turnCount: 4,
    rewardClaims: [],
    completionCapability: harness.root.integrityContext.completionCapability
  });
  assert.equal(runtime.onPortalEntry(), true);
  await settleBoundary(runtime, () => harness.calls.some((entry) => entry.action === "checkpoint"));

  assert.equal(harness.calls[0]?.action, "checkpoint");
  assert.equal(harness.calls.some((entry) => entry.action === "open_meta_offer"), false);
  assert.equal(harness.calls.filter((entry) => entry.action === "setNextDirective").length, 1, `${JSON.stringify(harness.calls)} ${JSON.stringify(harness.ui.lastMessage)}`);
  assert.equal(harness.calls.filter((entry) => entry.action === "enterNextDirective").length, 1);
  assert.equal(harness.calls.find((entry) => entry.action === "setNextDirective").directive.roomIndex, 31);
});

test("resumed Ranked Pact presents its pending offer before the consumed room sentinel and starts one next room after commit", async () => {
  const harness = makeBoundaryHarness();
  const state = harness.root.DungeonRankedV3Client.createRankedClient().getSnapshot().publicState;
  state.currentRoomDirective.consumed = true;
  state.metaTransactionOffer = {
    sourceType: "pact",
    sourceId: "pact-choice",
    choices: [{
      transactionId: "pact_1",
      choiceId: "pact_apply",
      status: "available",
      kind: "pact_apply"
    }]
  };
  const runtime = await installRuntime(harness);
  await runtime.resumeRanked();
  assert.equal(runtime.getSessionState(), "AWAITING_REWARD_OR_TRANSACTION", JSON.stringify(harness.ui.lastMessage));
  assert.equal(harness.calls.some((entry) => entry.action === "startRanked"), false);
  await harness.ui.choiceHandler("pact_apply");
  assert.equal(harness.calls.filter((entry) => entry.action === "startRanked").length, 1);
  assert.equal(harness.calls.find((entry) => entry.action === "startRanked").directive.roomIndex, 31);
  assert.equal(
    harness.projectionSyncCount,
    0,
    "post-room Pact resume must let startRanked hydrate the canonical projection exactly once"
  );
});

test("Observer Bot fails closed instead of routing a Ranked Pact to the dormant local altar", async () => {
  await ensureGeneratedBuild();
  const gameSource = await readFile(new URL("game.js", GENERATED_ROOT), "utf8");
  const start = gameSource.indexOf("  function runObserverBotPlayingAction() {");
  const end = gameSource.indexOf("  function chooseObserverBotCampStartDepth()", start);
  assert.ok(start >= 0 && end > start, "Observer Bot playing action function is missing");
  const body = gameSource.slice(start, end);

  assert.match(
    body,
    /state\.onlineV3Ranked\s*&&\s*state\.roomType\s*===\s*"pact"[\s\S]*?return\s+(?:false|true);/u,
    "Ranked Pact must stop local altar routing while the canonical boundary owns the offer"
  );
});

test("human Ranked input cannot invoke local Pact mutations before the canonical checkpoint", async () => {
  await ensureGeneratedBuild();
  const gameSource = await readFile(new URL("game.js", GENERATED_ROOT), "utf8");
  for (const signature of ["openPactRoom()", "applyPactChoice(pactId)", "breakCurrentPact()"] ) {
    const start = gameSource.indexOf(`  function ${signature} {`);
    assert.ok(start >= 0, `${signature} is missing`);
    const body = gameSource.slice(start, gameSource.indexOf("\n  }", start) + 4);
    assert.match(body, /if \(state\.onlineV3Ranked\) return false;/u, `${signature} must reject local Ranked mutation`);
  }
});

async function canonicalProjectionSource() {
  await ensureGeneratedBuild();
  const gameSource = await readFile(new URL("game.js", GENERATED_ROOT), "utf8");
  const start = gameSource.indexOf("  function syncRankedRunModifiers(publicState, options = {}) {");
  const end = gameSource.indexOf("    resumeAfterFatal(", start);
  assert.ok(start >= 0 && end > start, "Ranked game bridge projection hook is missing");
  return gameSource.slice(start, end);
}

test("Ranked room restart hydrates canonical Pacts before reset without applying them to the old player", async () => {
  await ensureGeneratedBuild();
  const gameSource = await readFile(new URL("game.js", GENERATED_ROOT), "utf8");
  const bridgeStart = gameSource.indexOf("    startRanked(directive, publicState, options = {}) {");
  const bridgeEnd = gameSource.indexOf("    setNextDirective(directive) {", bridgeStart);
  assert.ok(bridgeStart >= 0 && bridgeEnd > bridgeStart, "Ranked start bridge is missing");
  const body = gameSource.slice(bridgeStart, bridgeEnd);
  assert.match(body, /syncRankedRunModifiers\(publicState, \{ hydrateOnly: true \}\);/u);
  assert.ok(
    body.indexOf("syncRankedRunModifiers(publicState, { hydrateOnly: true });") < body.indexOf("startRun("),
    "Pacts must be hydrated before startRun applies persistent effects"
  );
  const projection = await canonicalProjectionSource();
  assert.match(
    projection,
    /if \(options\.hydrateOnly === true\) \{[\s\S]*?state\.pactBasePlayerStats = null;[\s\S]*?return;[\s\S]*?applySinglePactEffect/u,
    "hydrate-only projection must return before applying a Pact to the old player"
  );
});

test("canonical Pact apply commits hydrate the active pact and apply its effect", async () => {
  const projection = await canonicalProjectionSource();
  assert.match(
    projection,
    /(?:syncRankedRunModifiers|activePacts\s*=)[\s\S]*(?:applyPersistentPactsToRun|applySinglePactEffect)/u,
    "canonical Pact apply must hydrate the active pact and apply its effect"
  );
});

test("canonical Pact replacement commits remove the old effect before applying the new one", async () => {
  const projection = await canonicalProjectionSource();
  assert.match(
    projection,
    /(?:removeSinglePactEffect|pactBasePlayerStats)[\s\S]*(?:applyPersistentPactsToRun|applySinglePactEffect)/u,
    "canonical Pact replacement must remove the previous effect before applying the new one"
  );
});

test("canonical Pact break commits clear the active pact and remove its effect", async () => {
  const projection = await canonicalProjectionSource();
  assert.match(
    projection,
    /(?:activePacts\s*=\s*\[\]|removeSinglePactEffect)/u,
    "canonical Pact break must clear the active pact and remove its effect"
  );
});
