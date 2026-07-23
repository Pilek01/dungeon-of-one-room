import test from "node:test";
import assert from "node:assert/strict";
import { MAX_REQUEST_BYTES } from "../src/config.js";
import { canonicalDigest } from "../src/security/digests.js";
import { createHarness } from "./fixtures/harness.js";

const encoder = new TextEncoder();

test("fixture checkpoint token and request remain compact", async (context) => {
  const harness = createHarness();
  const started = (await harness.start()).payload;
  const commands = [
    { code: "move", count: 4 },
    { code: "attack", count: 2 }
  ];
  const checkpointBody = {
    runId: started.runId,
    checkpointToken: started.checkpointToken,
    roomDirectiveId: started.metaState.roomDirective.id,
    roomNonce: started.metaState.roomDirective.roomNonce,
    roomResult: "cleared",
    turnCount: 6,
    elapsedMs: 12_000,
    commandJournalDigest: await canonicalDigest(commands),
    compactRoomProof: {
      roomDirectiveId: started.metaState.roomDirective.id,
      roomNonce: started.metaState.roomDirective.roomNonce,
      commands
    },
    clientSummary: {}
  };
  const tokenBytes = encoder.encode(started.checkpointToken).byteLength;
  const checkpointBytes = encoder.encode(JSON.stringify(checkpointBody)).byteLength;

  assert(tokenBytes < 1_024);
  assert(checkpointBytes < MAX_REQUEST_BYTES);
  context.diagnostic(`fixture checkpoint token: ${tokenBytes} bytes`);
  context.diagnostic(`fixture checkpoint request: ${checkpointBytes} bytes`);
});
