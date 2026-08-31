import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";

import { RUN_TTL_MS } from "../src/config.js";
import {
  V08_META_1_CHRONICLE_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_LOCAL_RELEASE_DESCRIPTOR
} from "../src/rulesets/releases.js";
import { finalizeRunV08 } from "../src/rulesets/v08-meta-1/finalization-policy.js";
import {
  assertMetaStateV08,
  createInitialMetaStateV08
} from "../src/rulesets/v08-meta-1/meta-state.js";
import { requestExtractionV08 } from "../src/rulesets/v08-meta-1/outcome-policy.js";
import {
  hydrateRunFromProfileV08,
  profileStateFromRunV08
} from "../src/rulesets/v08-meta-1/profile-policy.js";

const STARTED_AT = 1_940_000_000_000;
const CAPABILITIES = Object.freeze({ campaignChronicle: "v1" });

test("campaign chronicle is enabled only for the new ruleset capability", () => {
  assert.equal(
    V08_META_1_LOCAL_RELEASE_DESCRIPTOR.capabilities.campaignChronicle,
    "v1"
  );
  assert.equal(
    V08_META_1_CHRONICLE_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.capabilities.campaignChronicle,
    undefined
  );
});

function createState(runId) {
  const state = createInitialMetaStateV08(
    { startDepth: 0 },
    {
      runId,
      season: "campaign-chronicle",
      startedAt: STARTED_AT,
      capabilities: CAPABILITIES
    }
  );
  state.profileId = "profile_0123456789abcdef0123456789abcdef";
  state.playerName = "Chronicle Tester";
  state.protocolVersion = "ranked-v3-checkpoint-1";
  state.gameVersion = "0.8.1";
  state.expiresAt = STARTED_AT + RUN_TTL_MS;
  return state;
}

test("campaign chronicle carries every accepted turn and Warden through later descents", async () => {
  const first = createState("run_campaign_chronicle_0001");
  first.status = "active";
  first.statistics.roomsCompleted = 5;
  first.statistics.bossRoomsCompleted = 2;
  first.statistics.finalRoomsCompleted = 1;
  first.build.resources.turn = 37;
  const extracted = requestExtractionV08(first, { mode: "normal" }).nextState;

  assert.deepEqual(extracted.campaign.chronicleCarry, {
    turns: 37,
    wardensDefeated: 3
  });

  const profile = profileStateFromRunV08(extracted, first.profileId, 1);
  const second = await hydrateRunFromProfileV08(
    createState("run_campaign_chronicle_0002"),
    profile,
    { cryptoProvider: webcrypto, capabilities: CAPABILITIES }
  );
  second.status = "defeat";
  second.build.resources.turn = 11;
  second.statistics.bossRoomsCompleted = 1;
  second.terminalEligibility = {
    outcome: "defeat",
    eligibleRevision: second.revision,
    reason: "campaign_chronicle_test"
  };

  const result = finalizeRunV08(second, { finalizedAt: STARTED_AT + 1_000 });
  assert.equal(result.nextState.finalization.summary.turns, 48);
  assert.equal(result.nextState.finalization.summary.bossesCompleted, 4);
  assert.equal(result.response.summary.turns, 48);
  assert.equal(result.response.summary.bossesCompleted, 4);
});

test("legacy campaigns without chronicle carry remain valid and do not invent campaign totals", () => {
  const legacy = createState("run_campaign_chronicle_legacy");
  delete legacy.campaign.chronicleCarry;
  assert.doesNotThrow(() => assertMetaStateV08(legacy));
});
