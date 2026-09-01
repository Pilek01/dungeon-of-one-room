import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createWorker } from "../src/index.js";
import productionWorker from "../src/production-ruleset-entry.js";
import { createRulesetRegistry, RULESET_RELEASE_STATES } from "../src/rulesets/registry.js";
import {
  V08_META_1_LEGACY_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_LOCAL_RELEASE_DESCRIPTOR,
  V08_META_1_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_R2_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_SCORE_CARRY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_HD_BOOT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_BOUNDARY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_WARDEN_HOTFIX_RELEASE_DESCRIPTOR,
  V08_META_1_GOLD_SYNC_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PACT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_CHEST_CARRY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_GOLD_CONTEXT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_OTTER_REPAIR_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_CANONICAL_CHEST_CONTEXT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_CANONICAL_CHEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_CHEST_HP_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_START_RESOURCE_PARITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_MAP_FRAGMENT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_AEGIS_PORTAL_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_CHRONICLE_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_ROOM_REPAIR_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
  V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR
} from "../src/rulesets/releases.js";
import * as releases from "../src/rulesets/releases.js";
import { COMPATIBLE_RULESET_HASHES } from "../src/rulesets/v08-meta-1/ruleset-hash-policy.js";
import manifest from "../src/rulesets/v08-meta-1/data/ruleset-manifest.json" with { type: "json" };
import { createMemoryRepositories } from "./fixtures/memory-repositories.js";
import { TEST_SECRET } from "./fixtures/harness.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(import.meta.url);
const protocol = require("../../../online-v3/ranked-v3-protocol.js");
const EXPECTED_HASH = manifest.rulesetHash;
const CURRENT_PRODUCTION_HASH = "sha256:eaa89c2568870852173c67cfd601ddd32b649322b3d4bf3b66a2114621a6998a";
const PREVIOUS_AEGIS_PORTAL_HASH = "sha256:91843a42a08ca6213e664cc0607e511fbd2c89f2bbfd749b45c0244924da067f";
const PREVIOUS_CHRONICLE_HASH = "sha256:9e6dfc472f9eb0ffd773e42f80cd3ecf7b579a1d76766affdb72417086016b7f";
const PREVIOUS_ROOM_REPAIR_HASH = "sha256:1b3103342a34e570842c73cd4454c9b2e5fa9b7895aac5835d18d4f1ee95b89b";
const PREVIOUS_PORTAL_CLEAR_HASH = "sha256:5ba35a1c03cf160787c553d55782ddb1ec4612a9a08f2dc26da562feeccc73c2";
const PREVIOUS_MAP_FRAGMENT_DEPTH_HASH = "sha256:25dbdb962a478b3a46375ad5b25a3603041edd95ff45b51e2846b13ce7ea2989";
const PREVIOUS_GOLD_PARITY_HASH = "sha256:78ae2f6f797063b7f364e5652e3367f6b26d651302f5c6038576d304dc442ec3";
const PREVIOUS_POTION_MERCHANT_HASH = "sha256:bf17a65dc721066bf11a1c34063cc18254fe97766852827719eb6aabf36042fa";
const PREVIOUS_START_RESOURCE_PARITY_HASH = "sha256:9d6069993fd07784ecfdc146825a8a7b82cde1fd7412f351aeba1ab86c539dbe";
const PREVIOUS_CHEST_HP_HASH = "sha256:48b5bd86604a5f8dae58a4dcf2b1ed9a72252b3e4942fc20693b3e0a8e91438e";
const PREVIOUS_GOLD_CONTEXT_HASH = "sha256:5bf4a0fbf2583b9b59ae050eebdd324bc09038b3aed6d2090cb3a4e5481f79eb";
const PREVIOUS_OTTER_REPAIR_HASH = "sha256:91065f3c515fbc2f996ba74a9fbbcab3d2ce013077af306afd51929e64e1af59";
const PREVIOUS_CHEST_CARRY_HASH = "sha256:35707f6b5ea8b1ad18251dce5e6c18b87653893aad705b6c5543fdd140b88067";
const PREVIOUS_CANONICAL_CHEST_CONTEXT_HASH = "sha256:51a86cf41299257475530a356b98381ac828fdb0ec22e77eff0ded99f1758617";
const PREVIOUS_CANONICAL_CHEST_HASH = "sha256:0a922d5567e7cfba56644e915ac0e331ac74aa3fcc3a2aed478440d64e9878f7";
const PREVIOUS_BOUNDED_PROC_HASH = "sha256:76514cf9e5c89079571a5be117ce84f949d7a3f5ed441d973adc05c95c6dde3c";
const PACT_PREVIOUS_HASH = "sha256:5c3df81af373b68fce4d8fa242fb61c29b7c3d4ca78d6865d2ee51a58bbab3dd";
const GOLD_SYNC_PREVIOUS_HASH = "sha256:87c30b2c011b5103398f9b03f6bf018d71f2a35427c0a04ef7a31b2559a7a6d9";
const INTEGRITY_PREVIOUS_HASH = "sha256:0672eb9aaae11865ebae75a4c6d6dc77cc29f4a079afe562355172d26f073bca";
const PLAYTEST_PREVIOUS_HASH = "sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711";
const BOUNDARY_PREVIOUS_HASH = "sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3";
const HD_BOOT_PREVIOUS_HASH = "sha256:7027a84ff06d6d9304e3d8e4343dbd6b3071c8bec734fad10b85981fa92347e8";
const SCORE_CARRY_PREVIOUS_HASH = "sha256:e4175a6cb29f576a3ad85357a433d6595eb7e9d19a6c5f47ed125ecfe9ae538e";
const WARDEN_HOTFIX_HASH = "sha256:31124ece34ef1c82a28bb977467d169eade8b34c0c13360d7054ab1684e5fe36";
const R2_HASH = "sha256:956251f158e55a0a47f9e43d5680d9aae66a22045c833bd76b8798cdc00e012e";
const PREVIOUS_HASH = "sha256:08dfa4f97d91b4f21dbfae7232246125ddbbc6a0270cf81a9e1ed012e5f5d403";
const LEGACY_HASH = "sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6";

test("Ranked gold parity release retains the previous production hash", () => {
  const active = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR;
  const previous = releases.V08_META_1_GOLD_PARITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;

  assert.ok(previous, "the previous gold-parity descriptor must be retained");
  assert.equal(active.rulesetHash, CURRENT_PRODUCTION_HASH);
  assert.equal(previous.rulesetHash, PREVIOUS_GOLD_PARITY_HASH);
  assert.deepEqual(previous.capabilities, V08_META_1_CHRONICLE_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.capabilities);
  assert.ok(COMPATIBLE_RULESET_HASHES.includes(PREVIOUS_GOLD_PARITY_HASH));
  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_GOLD_PARITY_HASH));
});

test("portal-clear release retains the currently active production hash", () => {
  const active = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR;
  const previous = releases.V08_META_1_PORTAL_CLEAR_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;

  assert.ok(previous, "the previous portal-clear descriptor must be retained");
  assert.equal(active.rulesetHash, CURRENT_PRODUCTION_HASH);
  assert.equal(previous.rulesetHash, PREVIOUS_PORTAL_CLEAR_HASH);
  assert.deepEqual(previous.capabilities, V08_META_1_CHRONICLE_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.capabilities);
  assert.ok(COMPATIBLE_RULESET_HASHES.includes(PREVIOUS_PORTAL_CLEAR_HASH));
  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_PORTAL_CLEAR_HASH));
});

test("Aegis portal release retains the immediately previous production hash", () => {
  const active = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR;
  const previous = V08_META_1_AEGIS_PORTAL_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;
  assert.equal(active.rulesetHash, CURRENT_PRODUCTION_HASH);
  assert.equal(previous.rulesetHash, PREVIOUS_AEGIS_PORTAL_HASH);
  assert.deepEqual(previous.capabilities, V08_META_1_CHRONICLE_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.capabilities);
  assert.ok(COMPATIBLE_RULESET_HASHES.includes(PREVIOUS_AEGIS_PORTAL_HASH));
  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_AEGIS_PORTAL_HASH));
});

test("room-transition repair retains the immediately previous Chronicle production hash", () => {
  const active = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR;
  const previous = V08_META_1_ROOM_REPAIR_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;
  assert.equal(active.rulesetHash, CURRENT_PRODUCTION_HASH);
  assert.equal(previous.rulesetHash, PREVIOUS_ROOM_REPAIR_HASH);
  assert.deepEqual(previous.capabilities, active.capabilities);
  assert.ok(COMPATIBLE_RULESET_HASHES.includes(PREVIOUS_ROOM_REPAIR_HASH));
  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_ROOM_REPAIR_HASH));
});

test("bounded proc release activates a new hash and leaves every historical descriptor proc-free", () => {
  const active = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR;
  const previous = releases.V08_META_1_BOUNDED_PROC_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;

  assert.notEqual(manifest.rulesetHash, PREVIOUS_BOUNDED_PROC_HASH);
  assert.equal(active.rulesetHash, CURRENT_PRODUCTION_HASH);
  assert.equal(active.capabilities.boundedProcClaims, "v1");
  assert.ok(previous, "the previous bounded-proc descriptor must be retained");
  assert.equal(previous.rulesetHash, PREVIOUS_BOUNDED_PROC_HASH);
  assert.equal(previous.capabilities.boundedProcClaims, undefined);
  assert.ok(COMPATIBLE_RULESET_HASHES.includes(manifest.rulesetHash));
  assert.ok(COMPATIBLE_RULESET_HASHES.includes(PREVIOUS_BOUNDED_PROC_HASH));

  const historicalDescriptors = Object.values(releases).filter((value) => (
    value && typeof value === "object" &&
    value.status === RULESET_RELEASE_STATES.PRODUCTION_RELEASED &&
    typeof value.rulesetHash === "string" &&
    value.rulesetHash !== manifest.rulesetHash &&
    value.rulesetHash !== CURRENT_PRODUCTION_HASH &&
    value.rulesetHash !== PREVIOUS_ROOM_REPAIR_HASH &&
    value.rulesetHash !== PREVIOUS_CHRONICLE_HASH &&
    value.rulesetHash !== PREVIOUS_AEGIS_PORTAL_HASH &&
    value.rulesetHash !== PREVIOUS_PORTAL_CLEAR_HASH &&
    value.rulesetHash !== PREVIOUS_GOLD_PARITY_HASH &&
    value.rulesetHash !== PREVIOUS_MAP_FRAGMENT_DEPTH_HASH &&
    value.rulesetHash !== PREVIOUS_START_RESOURCE_PARITY_HASH &&
    value.rulesetHash !== PREVIOUS_CHEST_HP_HASH &&
    value.rulesetHash !== PREVIOUS_POTION_MERCHANT_HASH &&
    value.rulesetHash !== PREVIOUS_OTTER_REPAIR_HASH &&
    value.rulesetHash !== PREVIOUS_GOLD_CONTEXT_HASH &&
    value.rulesetHash !== PREVIOUS_CHEST_CARRY_HASH &&
    value.rulesetHash !== PREVIOUS_CANONICAL_CHEST_CONTEXT_HASH &&
    value.rulesetHash !== PREVIOUS_CANONICAL_CHEST_HASH
  ));
  assert.ok(historicalDescriptors.length > 0);
  for (const descriptor of historicalDescriptors) {
    assert.equal(
      descriptor.capabilities?.boundedProcClaims,
      undefined,
      descriptor.rulesetHash
    );
  }

  assert.equal(protocol.RULESET_HASH, CURRENT_PRODUCTION_HASH);
  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_BOUNDED_PROC_HASH));
  assert.deepEqual(protocol.BOUNDED_PROC_CLAIMS_RULESET_HASHES, [
    CURRENT_PRODUCTION_HASH,
    PREVIOUS_ROOM_REPAIR_HASH,
    PREVIOUS_CHRONICLE_HASH,
    PREVIOUS_AEGIS_PORTAL_HASH,
    PREVIOUS_PORTAL_CLEAR_HASH,
    PREVIOUS_GOLD_PARITY_HASH,
    PREVIOUS_MAP_FRAGMENT_DEPTH_HASH,
    PREVIOUS_START_RESOURCE_PARITY_HASH,
    PREVIOUS_CHEST_HP_HASH,
    PREVIOUS_POTION_MERCHANT_HASH,
    PREVIOUS_OTTER_REPAIR_HASH,
    PREVIOUS_GOLD_CONTEXT_HASH,
    PREVIOUS_CANONICAL_CHEST_CONTEXT_HASH,
    PREVIOUS_CANONICAL_CHEST_HASH,
    PREVIOUS_CHEST_CARRY_HASH
  ]);
  assert.equal(protocol.supportsBoundedProcClaims(manifest.rulesetHash), false);
  assert.equal(protocol.supportsBoundedProcClaims(PREVIOUS_CHEST_CARRY_HASH), true);
  assert.equal(protocol.supportsBoundedProcClaims(PREVIOUS_BOUNDED_PROC_HASH), false);
});

test("canonical chest carry release is hash-gated and preserves the previous production descriptor", () => {
  const active = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR;
  const previous = V08_META_1_CHEST_CARRY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;

  assert.notEqual(manifest.rulesetHash, PREVIOUS_CHEST_CARRY_HASH);
  assert.equal(active.rulesetHash, CURRENT_PRODUCTION_HASH);
  assert.equal(active.capabilities.canonicalChestOutcomes, "v1");
  assert.ok(previous, "the previous chest-carry descriptor must be retained");
  assert.equal(previous.rulesetHash, PREVIOUS_CHEST_CARRY_HASH);
  assert.deepEqual(previous.capabilities, {
    fatalPresentationCauseMode: "retain",
    boundarySettlementMode: "event-journal-v1",
    postRoomPactSettlement: "post-room-pact-v1",
    boundedProcClaims: "v1"
  });
  assert.equal(previous.capabilities.canonicalChestOutcomes, undefined);
  assert.deepEqual(active.capabilities, {
    fatalPresentationCauseMode: "retain",
    boundarySettlementMode: "event-journal-v1",
    postRoomPactSettlement: "post-room-pact-v1",
    boundedProcClaims: "v1",
    canonicalChestOutcomes: "v1",
    earlyBalanceOtterRepair: "v1",
    canonicalPotionResources: "v1",
    boundedCombatResources: "v1",
    rankedStartResourceParity: "v1",
    potionClaimOrdering: "v1",
    mapFragmentMinDepth: "v1",
    exactChestStatCarry: "v1",
    campaignChronicle: "v1"
  });

  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_CHEST_CARRY_HASH));
  assert.deepEqual(protocol.CANONICAL_CHEST_OUTCOMES_RULESET_HASHES, [
    CURRENT_PRODUCTION_HASH,
    PREVIOUS_ROOM_REPAIR_HASH,
    PREVIOUS_CHRONICLE_HASH,
    PREVIOUS_AEGIS_PORTAL_HASH,
    PREVIOUS_PORTAL_CLEAR_HASH,
    PREVIOUS_GOLD_PARITY_HASH,
    PREVIOUS_MAP_FRAGMENT_DEPTH_HASH,
    PREVIOUS_START_RESOURCE_PARITY_HASH,
    PREVIOUS_CHEST_HP_HASH,
    PREVIOUS_POTION_MERCHANT_HASH,
    PREVIOUS_OTTER_REPAIR_HASH,
    PREVIOUS_GOLD_CONTEXT_HASH,
    PREVIOUS_CANONICAL_CHEST_CONTEXT_HASH,
    PREVIOUS_CANONICAL_CHEST_HASH
  ]);
  assert.equal(protocol.supportsCanonicalChestOutcomes(manifest.rulesetHash), false);
  assert.equal(protocol.supportsCanonicalChestOutcomes(PREVIOUS_CHEST_CARRY_HASH), false);
});

test("canonical chest context retains the previous active canonical hash", () => {
  const active = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR;
  const previous = V08_META_1_CANONICAL_CHEST_CONTEXT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;
  assert.equal(active.rulesetHash, CURRENT_PRODUCTION_HASH);
  assert.equal(previous.rulesetHash, PREVIOUS_CANONICAL_CHEST_CONTEXT_HASH);
  assert.equal(previous.capabilities.canonicalChestOutcomes, "v1");
  assert.equal(previous.capabilities.earlyBalanceOtterRepair, undefined);
  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_CANONICAL_CHEST_CONTEXT_HASH));
  assert.equal(protocol.supportsCanonicalChestOutcomes(PREVIOUS_CANONICAL_CHEST_CONTEXT_HASH), true);
});

test("gold-context repair retains the immediately previous canonical release", () => {
  const active = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR;
  const previous = V08_META_1_GOLD_CONTEXT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;
  assert.equal(active.rulesetHash, CURRENT_PRODUCTION_HASH);
  assert.equal(previous.rulesetHash, PREVIOUS_GOLD_CONTEXT_HASH);
  assert.equal(previous.capabilities.canonicalChestOutcomes, "v1");
  assert.equal(previous.capabilities.earlyBalanceOtterRepair, undefined);
  assert.ok(COMPATIBLE_RULESET_HASHES.includes(PREVIOUS_GOLD_CONTEXT_HASH));
  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_GOLD_CONTEXT_HASH));
  assert.equal(protocol.supportsCanonicalChestOutcomes(PREVIOUS_GOLD_CONTEXT_HASH), true);
});

test("canonical chest repair release retains the previous canonical hash and capability contract", () => {
  const active = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR;
  const previous = V08_META_1_CANONICAL_CHEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;
  assert.equal(active.rulesetHash, CURRENT_PRODUCTION_HASH);
  assert.equal(previous.rulesetHash, PREVIOUS_CANONICAL_CHEST_HASH);
  assert.equal(previous.capabilities.canonicalChestOutcomes, "v1");
  assert.equal(previous.capabilities.earlyBalanceOtterRepair, undefined);
  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_CANONICAL_CHEST_HASH));
  assert.deepEqual(protocol.CANONICAL_CHEST_OUTCOMES_RULESET_HASHES, [
    CURRENT_PRODUCTION_HASH,
    PREVIOUS_ROOM_REPAIR_HASH,
    PREVIOUS_CHRONICLE_HASH,
    PREVIOUS_AEGIS_PORTAL_HASH,
    PREVIOUS_PORTAL_CLEAR_HASH,
    PREVIOUS_GOLD_PARITY_HASH,
    PREVIOUS_MAP_FRAGMENT_DEPTH_HASH,
    PREVIOUS_START_RESOURCE_PARITY_HASH,
    PREVIOUS_CHEST_HP_HASH,
    PREVIOUS_POTION_MERCHANT_HASH,
    PREVIOUS_OTTER_REPAIR_HASH,
    PREVIOUS_GOLD_CONTEXT_HASH,
    PREVIOUS_CANONICAL_CHEST_CONTEXT_HASH,
    PREVIOUS_CANONICAL_CHEST_HASH
  ]);
  assert.equal(protocol.supportsCanonicalChestOutcomes(PREVIOUS_CANONICAL_CHEST_HASH), true);
});

test("early balance and Otter repair retain the immediately previous production ruleset", () => {
  const active = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR;
  const previous = V08_META_1_OTTER_REPAIR_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;
  assert.equal(active.capabilities.earlyBalanceOtterRepair, "v1");
  assert.equal(previous.rulesetHash, PREVIOUS_OTTER_REPAIR_HASH);
  assert.equal(previous.capabilities.earlyBalanceOtterRepair, undefined);
  assert.equal(previous.capabilities.canonicalChestOutcomes, "v1");
  assert.ok(COMPATIBLE_RULESET_HASHES.includes(PREVIOUS_OTTER_REPAIR_HASH));
  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_OTTER_REPAIR_HASH));
  assert.equal(protocol.supportsCanonicalChestOutcomes(PREVIOUS_OTTER_REPAIR_HASH), true);
});

test("Ranked start resource parity is hash-gated and preserves the previous production behavior", () => {
  const active = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR;
  const previous = V08_META_1_START_RESOURCE_PARITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;

  assert.equal(active.rulesetHash, CURRENT_PRODUCTION_HASH);
  assert.equal(active.capabilities.rankedStartResourceParity, "v1");
  assert.equal(V08_META_1_LOCAL_RELEASE_DESCRIPTOR.capabilities.rankedStartResourceParity, "v1");
  assert.equal(previous.rulesetHash, PREVIOUS_START_RESOURCE_PARITY_HASH);
  assert.equal(previous.capabilities.boundedCombatResources, "v1");
  assert.equal(previous.capabilities.rankedStartResourceParity, undefined);
  assert.ok(COMPATIBLE_RULESET_HASHES.includes(PREVIOUS_START_RESOURCE_PARITY_HASH));
  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_START_RESOURCE_PARITY_HASH));
  assert.deepEqual(protocol.BOUNDED_COMBAT_RESOURCES_RULESET_HASHES, [
    CURRENT_PRODUCTION_HASH,
    PREVIOUS_ROOM_REPAIR_HASH,
    PREVIOUS_CHRONICLE_HASH,
    PREVIOUS_AEGIS_PORTAL_HASH,
    PREVIOUS_PORTAL_CLEAR_HASH,
    PREVIOUS_GOLD_PARITY_HASH,
    PREVIOUS_MAP_FRAGMENT_DEPTH_HASH,
    PREVIOUS_START_RESOURCE_PARITY_HASH,
    PREVIOUS_CHEST_HP_HASH
  ]);
});

test("map-fragment depth gate is hash-bound and preserves previous production behavior", () => {
  const active = V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR;
  const previous = V08_META_1_MAP_FRAGMENT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;

  assert.equal(active.rulesetHash, CURRENT_PRODUCTION_HASH);
  assert.equal(active.capabilities.mapFragmentMinDepth, "v1");
  assert.equal(V08_META_1_LOCAL_RELEASE_DESCRIPTOR.capabilities.mapFragmentMinDepth, "v1");
  assert.equal(active.capabilities.exactChestStatCarry, "v1");
  assert.equal(V08_META_1_LOCAL_RELEASE_DESCRIPTOR.capabilities.exactChestStatCarry, "v1");
  assert.equal(previous.rulesetHash, PREVIOUS_MAP_FRAGMENT_DEPTH_HASH);
  assert.equal(previous.capabilities.rankedStartResourceParity, "v1");
  assert.equal(previous.capabilities.mapFragmentMinDepth, undefined);
  assert.equal(previous.capabilities.exactChestStatCarry, undefined);
  assert.ok(COMPATIBLE_RULESET_HASHES.includes(PREVIOUS_MAP_FRAGMENT_DEPTH_HASH));
  assert.ok(protocol.SUPPORTED_RULESET_HASHES.includes(PREVIOUS_MAP_FRAGMENT_DEPTH_HASH));
  assert.equal(protocol.supportsCanonicalChestOutcomes(PREVIOUS_MAP_FRAGMENT_DEPTH_HASH), true);
});

async function rootFile(relative) {
  return readFile(path.join(ROOT, relative), "utf8");
}

test("local candidate does not activate its ruleset in production", async () => {
  assert.equal(manifest.rulesetHash, EXPECTED_HASH);
  assert.equal(V08_META_1_LOCAL_RELEASE_DESCRIPTOR.rulesetHash, manifest.rulesetHash);
  assert.equal(V08_META_1_LOCAL_RELEASE_DESCRIPTOR.status, RULESET_RELEASE_STATES.LOCAL_RELEASE_CANDIDATE);
  assert.equal(V08_META_1_LOCAL_RELEASE_DESCRIPTOR.capabilities.merchantExitBarrier, "v1");
  assert.equal(V08_META_1_LOCAL_RELEASE_DESCRIPTOR.capabilities.otterActualDepthEligibility, "v1");
  assert.equal(V08_META_1_LOCAL_RELEASE_DESCRIPTOR.capabilities.roomEliteBudgetByType, "v1");
  assert.equal(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash, CURRENT_PRODUCTION_HASH);
  assert.notEqual(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.rulesetHash, EXPECTED_HASH);
  assert.equal(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities.merchantExitBarrier, undefined);
  assert.equal(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities.otterActualDepthEligibility, undefined);
  assert.equal(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities.roomEliteBudgetByType, undefined);
  assert.equal(V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.status, RULESET_RELEASE_STATES.PRODUCTION_RELEASED);
  assert.equal(
    V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities.boundarySettlementMode,
    "event-journal-v1"
  );
  assert.equal(
    V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR.capabilities.postRoomPactSettlement,
    "post-room-pact-v1"
  );
  const registry = createRulesetRegistry([
    V08_META_1_LEGACY_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_R2_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_WARDEN_HOTFIX_RELEASE_DESCRIPTOR,
    V08_META_1_SCORE_CARRY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_HD_BOOT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_BOUNDARY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_PLAYTEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_GOLD_SYNC_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_PACT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_CHEST_CARRY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_CANONICAL_CHEST_CONTEXT_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_CANONICAL_CHEST_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_OTTER_REPAIR_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_CHEST_HP_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_START_RESOURCE_PARITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    releases.V08_META_1_GOLD_PARITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    releases.V08_META_1_PORTAL_CLEAR_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_CHRONICLE_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR,
    V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR
  ]);
  const resolved = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: CURRENT_PRODUCTION_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(resolved.rulesetHash, CURRENT_PRODUCTION_HASH);
  const portalClearPrevious = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: PREVIOUS_PORTAL_CLEAR_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(portalClearPrevious.rulesetHash, PREVIOUS_PORTAL_CLEAR_HASH);
  assert.deepEqual(
    portalClearPrevious.capabilities,
    V08_META_1_CHRONICLE_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR.capabilities
  );
  const chestHpPrevious = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: PREVIOUS_CHEST_HP_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(chestHpPrevious.rulesetHash, PREVIOUS_CHEST_HP_HASH);
  assert.equal(chestHpPrevious.capabilities.boundedCombatResources, "v1");
  const startResourceParityPrevious = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: PREVIOUS_START_RESOURCE_PARITY_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(startResourceParityPrevious.rulesetHash, PREVIOUS_START_RESOURCE_PARITY_HASH);
  assert.equal(startResourceParityPrevious.capabilities.rankedStartResourceParity, undefined);
  const goldSyncPrevious = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: GOLD_SYNC_PREVIOUS_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(goldSyncPrevious.rulesetHash, GOLD_SYNC_PREVIOUS_HASH);
  const pactPrevious = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: PACT_PREVIOUS_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(pactPrevious.rulesetHash, PACT_PREVIOUS_HASH);
  const playtestPrevious = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: PLAYTEST_PREVIOUS_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(playtestPrevious.rulesetHash, PLAYTEST_PREVIOUS_HASH);
  const r2 = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: R2_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(r2.rulesetHash, R2_HASH);
  const wardenHotfix = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: WARDEN_HOTFIX_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(wardenHotfix.rulesetHash, WARDEN_HOTFIX_HASH);
  const scoreCarryPrevious = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: SCORE_CARRY_PREVIOUS_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(scoreCarryPrevious.rulesetHash, SCORE_CARRY_PREVIOUS_HASH);
  const hdBootPrevious = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: HD_BOOT_PREVIOUS_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(hdBootPrevious.rulesetHash, HD_BOOT_PREVIOUS_HASH);
  const boundaryPrevious = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: BOUNDARY_PREVIOUS_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(boundaryPrevious.rulesetHash, BOUNDARY_PREVIOUS_HASH);
  const previous = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: PREVIOUS_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(previous.rulesetHash, PREVIOUS_HASH);
  const legacy = registry.resolve({
    rulesetId: "v08-meta-1",
    rulesetHash: LEGACY_HASH,
    environment: "production",
    lifecycle: "ranked"
  });
  assert.equal(legacy.rulesetHash, LEGACY_HASH);

  const response = await productionWorker.fetch(new Request(
    "https://production.invalid/api/v3/availability?clientProtocolVersion=ranked-v3-checkpoint-1"
  ), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.rulesetHash, CURRENT_PRODUCTION_HASH);
});

test("production availability reports the activated ruleset", async () => {
  const response = await productionWorker.fetch(new Request(
    "https://production.invalid/api/v3/availability?clientProtocolVersion=ranked-v3-checkpoint-1"
  ), {});
  const body = await response.json();
  assert.equal(body.availability, "active");
  assert.equal(body.productionActivated, true);
  assert.equal(body.rulesetId, "v08-meta-1");
  assert.equal(body.rulesetHash, CURRENT_PRODUCTION_HASH);
});

test("production retains runs pinned to the previous checkpoint-integrity ruleset", async () => {
  const retainedDescriptor = releases.V08_META_1_INTEGRITY_PREVIOUS_PRODUCTION_RELEASE_DESCRIPTOR;
  assert.ok(retainedDescriptor, "previous checkpoint-integrity descriptor must be retained");
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([retainedDescriptor]),
    rulesetEnvironment: "production",
    repositories: createMemoryRepositories()
  });
  const response = await worker.fetch(new Request(
    "https://production.invalid/api/v3/runs/start",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "retained-integrity-start"
      },
      body: JSON.stringify({
        playerName: "Retained Integrity",
        season: "season-1",
        gameVersion: "v0.8.2",
        rulesetId: "v08-meta-1",
        rulesetHash: INTEGRITY_PREVIOUS_HASH,
        clientInstallIdHash: "install_retained_integrity_123456",
        profileId: "profile_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
        recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
        clientProtocolVersion: "ranked-v3-checkpoint-1"
      })
    }
  ), {
    RANKED_V3_HMAC_SECRET: TEST_SECRET,
    RANKED_V3_ABUSE_CONTROL: {
      async limit() {
        return { success: true };
      }
    }
  });
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.metaState.rulesetHash, INTEGRITY_PREVIOUS_HASH);
});

test("production registry starts and abandons the retained R2 ruleset hash", async () => {
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([
      V08_META_1_R2_PRODUCTION_RELEASE_DESCRIPTOR,
      V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR
    ]),
    rulesetEnvironment: "production",
    repositories: createMemoryRepositories()
  });
  const recoveryCredential = "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr";
  const startResponse = await worker.fetch(new Request(
    "https://production.invalid/api/v3/runs/start",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "retained-r2-start"
      },
      body: JSON.stringify({
        playerName: "Retained R2",
        season: "season-1",
        gameVersion: "0.8.1",
        rulesetId: "v08-meta-1",
        rulesetHash: R2_HASH,
        clientInstallIdHash: "install_retained_r2_123456",
        profileId: "profile_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
        recoveryCredential,
        clientProtocolVersion: "ranked-v3-checkpoint-1"
      })
    }
  ), {
    RANKED_V3_HMAC_SECRET: TEST_SECRET,
    RANKED_V3_ABUSE_CONTROL: {
      async limit() {
        return { success: true };
      }
    }
  });
  const started = await startResponse.json();
  assert.equal(startResponse.status, 201, JSON.stringify(started));
  assert.equal(started.metaState.rulesetHash, R2_HASH);

  const selectResponse = await worker.fetch(new Request(
    "https://production.invalid/api/v3/runs/event",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "retained-r2-select"
      },
      body: JSON.stringify({
        runId: started.runId,
        type: "select_starting_relic",
        bootstrapToken: started.bootstrapToken,
        offerId: started.metaState.startingRelicOffer.offerId,
        choiceId: started.metaState.startingRelicOffer.publicChoices[0].choiceId
      })
    }
  ), { RANKED_V3_HMAC_SECRET: TEST_SECRET });
  const selected = await selectResponse.json();
  assert.equal(selectResponse.status, 200, JSON.stringify(selected));
  assert.equal(selected.metaState.status, "active");
  assert.equal(selected.metaState.rulesetHash, R2_HASH);
  const operationId = "op_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const abandonResponse = await worker.fetch(new Request(
    "https://production.invalid/api/v3/runs/abandon",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": operationId
      },
      body: JSON.stringify({
        operationId,
        runId: selected.runId,
        recoveryCredential,
        clientProtocolVersion: "ranked-v3-checkpoint-1",
        lastKnownRevision: selected.metaState.revision
      })
    }
  ), { RANKED_V3_HMAC_SECRET: TEST_SECRET });
  const abandoned = await abandonResponse.json();
  assert.equal(abandonResponse.status, 200, JSON.stringify(abandoned));
  assert.equal(abandoned.metaState.status, "abandoned");
  assert.equal(abandoned.metaState.rulesetHash, R2_HASH);
});

test("production Ranked start uses the edge limiter with a profile-scoped key", async () => {
  const calls = [];
  const metrics = [];
  const worker = createWorker({
    rulesetRegistry: createRulesetRegistry([V08_META_1_PRODUCTION_RELEASE_DESCRIPTOR]),
    rulesetEnvironment: "production",
    repositories: createMemoryRepositories(),
    metrics: { increment: (...entry) => metrics.push(entry) }
  });
  const profileId = "profile_cccccccccccccccccccccccccccccccc";
  const response = await worker.fetch(new Request("https://production.invalid/api/v3/runs/start", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": "production-rate-limit"
    },
    body: JSON.stringify({
      playerName: "Private Tester",
      season: "season-1",
      gameVersion: "v0.8.0",
      rulesetId: "v08-meta-1",
      rulesetHash: CURRENT_PRODUCTION_HASH,
      clientInstallIdHash: "install_production_123456789",
      profileId,
      profileCredential: "ppppppppppppppppppppppppppppppppppppppppppp",
      recoveryCredential: "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
      clientProtocolVersion: "ranked-v3-checkpoint-1"
    })
  }), {
    RANKED_V3_HMAC_SECRET: TEST_SECRET,
    RANKED_V3_ABUSE_CONTROL: {
      async limit(input) {
        calls.push(input);
        return { success: false };
      }
    }
  });
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "START_RATE_LIMITED");
  assert.deepEqual(calls, [{ key: `ranked-start:${profileId}` }]);
  assert.ok(metrics.some((entry) => entry[0] === "rejected_starts" && entry[2] === "edge_rate_limit"));
});

test("Pages release stays same-origin and disconnects all v2 bindings", async () => {
  const [pages, proxy, builder, config, game, ui, runtime, leaderboardUi, style, workerConfig] = await Promise.all([
    rootFile("wrangler.jsonc"),
    rootFile("functions/api/v3/[[path]].js"),
    rootFile("scripts/build-pages-v3.mjs"),
    rootFile("config.js"),
    rootFile("game.js"),
    rootFile("online-v3/ranked-v3-ui.js"),
    rootFile("online-v3/ranked-v3-runtime.js"),
    rootFile("online-v3/ranked-v3-leaderboard-ui.js"),
    rootFile("style.css"),
    rootFile("cloudflare/leaderboard-v3/wrangler.production.toml")
  ]);
  const pagesConfig = JSON.parse(pages);
  assert.deepEqual(pagesConfig.services, [{
    binding: "RANKED_V3_BACKEND",
    service: "dungeon-online-v3-production"
  }]);
  assert.equal("preview" in pagesConfig.env, false);
  assert.match(pages, /"binding": "RANKED_V3_BACKEND"/u);
  assert.match(pages, /"service": "dungeon-online-v3-production"/u);
  assert.doesNotMatch(pages, /RANKED_BACKEND|ranked-v2|ranked-s1/iu);
  assert.match(proxy, /context\.env\.RANKED_V3_BACKEND/u);
  assert.match(builder, /include: \["\/api\/v3\/\*"\]/u);
  assert.match(builder, /\["assets", "render", "online-v3"\]/u);
  assert.doesNotMatch(builder, /Vault-Guardian-Codex-Pack/u);
  assert.match(builder, /title: "Practice \(Offline\)"/u);
  assert.match(builder, /DungeonOnlineV3Menu\?\.extendOptions/u);
  assert.match(builder, /bootInputLocked/u);
  assert.match(builder, /data-menu-index/u);
  assert.match(builder, /Preparing the dungeon/u);
  assert.match(
    builder,
    /state\.onlineV3Directive = state\.onlineV3NextDirective;[\s\S]*?buildRoom\(\);[\s\S]*?DungeonOnlineV3\?\.onRoomEntered\?\.\(state\.onlineV3Directive\)/u
  );
  assert.match(config, /DUNGEON_ONLINE_V3_API = ""/u);
  assert.match(game, /title: "Start New Game"/u);
  assert.doesNotMatch(game, /DungeonOnlineV3Menu|bootInputLocked|data-menu-index/u);
  assert.match(ui, /"Ranked \(Online\)"/u);
  assert.match(ui, /relicDetails/u);
  assert.match(ui, /relic-draft-choice-starting/u);
  assert.match(ui, /stopPropagation/u);
  assert.match(ui, /playerText/u);
  assert.match(runtime, /title: "Ranked \(Online\)"/u);
  assert.match(runtime, /title: "Ranked Leaderboard"/u);
  assert.match(runtime, /"Build Chronicle"/u);
  assert.match(leaderboardUi, /ranked-v3-reference-plate--leaderboard/u);
  assert.match(leaderboardUi, /ranked-v3-reference-plate--inspect/u);
  assert.match(leaderboardUi, /ranked-v3-reference-plate-art/u);
  assert.match(leaderboardUi, /data-record-tooltip/u);
  assert.doesNotMatch(leaderboardUi, /floor-skull\.png/u);
  assert.match(runtime, /await resolveCheckpoint\(\);/u);
  assert.doesNotMatch(runtime, /Resolve checkpoint|server-issued opaque choice/u);
  assert.doesNotMatch(runtime, /ui\.(?:showMessage|showChoices)\("Ranked (?:run finalized|Camp)"|ui\.button\("(?:Open Camp|Finalize)"|`Ranked \$\{state\.status\}`/u);
  assert.match(runtime, /enterRankedCamp/u);
  assert.match(runtime, /onCampAction/u);
  assert.match(builder, /enterRankedCamp/u);
  assert.match(builder, /onCampAction/u);
  assert.match(runtime, /roomClearPending: Boolean\(pendingRoomSummary\)/u);
  assert.match(runtime, /lostRelicId/u);
  assert.match(
    builder,
    /resumeAfterFatal\(directive, publicState, presentation = \{\}\)[\s\S]*?state\.phase = "dead"[\s\S]*?playDeathTrack\(\)/u
  );
  assert.match(builder, /rankedFatalDirective/u);
  assert.match(builder, /if \(state\.onlineV3Ranked\)[\s\S]*?leaveToMainMenu/u);
  assert.match(builder, /DungeonOnlineV3\?\.onRoomEntered\?\.\(state\.onlineV3Directive\)/u);
  assert.match(style, /\.ranked-v3-entry,[\s\S]*display: none !important;/u);
  assert.match(style, /body\.ranked-v3-modal-open #screenOverlay/u);
  assert.match(style, /\[data-record-tooltip\]:focus-visible::after/u);
  assert.doesNotMatch(style, /#32204c|#9b70d8/u);
  assert.match(builder, /\.boot-screen\.loading \.boot-loading/u);
  assert.match(builder, /hdBootLoadingProgress/u);
  assert.match(workerConfig, /workers_dev = false/u);
  assert.match(workerConfig, /name = "RANKED_V3_ABUSE_CONTROL"/u);
  assert.match(workerConfig, /crons = \["\*\/15 \* \* \* \*"\]/u);
  assert.match(workerConfig, /database_name = "dungeon-online-v3-production"/u);
});
test("production menu separates Practice pause, Practice save, and Ranked save choices", async () => {
  const [builder, runtime] = await Promise.all([
    rootFile("scripts/build-pages-v3.mjs"),
    rootFile("online-v3/ranked-v3-runtime.js")
  ]);
  assert.match(builder, /isRunPauseMenuActive\(\)[\s\S]*title: "Main Menu"/u);
  assert.match(builder, /title: "Main Menu"[\s\S]*enterMenu\(\);/u);
  assert.match(builder, /DungeonOnlineV3GameBridge\?\.isRanked\?\.\(\)/u);
  assert.match(builder, /rankedPause[\s\S]*leaveToMainMenu/u);
  assert.match(
    builder,
    /if \(state\.onlineV3Ranked\)[\s\S]*?DungeonOnlineV3\?\.leaveToMainMenu\?\.\(\);[\s\S]*?return;/u
  );
  assert.match(
    builder,
    /holdTerminal\(publicState\)[\s\S]*?finalGameOverPrompt = \{[\s\S]*?playFinalGameOverTrack\(\)/u
  );
  assert.match(
    builder,
    /holdTerminal\(publicState\)[\s\S]*?state\.phase = publicState\?\.status === "victory" \? "won" : "dead";[\s\S]*?syncBgmWithState\(\);[\s\S]*?playFinalGameOverTrack\(\)/u
  );
  assert.match(builder, /data-menu-new-game-index[\s\S]*activateMenuNewGameConfirmSelection/u);
  assert.doesNotMatch(runtime, /options\.get\("continue"\),/u);
  assert.match(runtime, /Start New Ranked/u);
  assert.match(runtime, /Continue Ranked/u);
  assert.match(runtime, /recoveryStore\.loadRecovery\(\)/u);
  assert.match(
    runtime,
    /session\.getState\(\) === root\.DungeonRankedV3Session\.STATES\.finalized[\s\S]*?clearEndedRecovery\(\)/u
  );
});
