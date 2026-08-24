# Ranked Potion and Merchant Integrity Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ranked potion capacity/current resources, Observer Bot use, Merchant transactions, Full Heal, Combat Boost, and campaign-depth unlocks canonical and reconnect-safe without relaxing anti-cheat validation or affecting Practice/Fury/elixirs.

**Architecture:** Canonical maximum potion capacity is derived from trusted Camp, modifier, and relic state while current potions remain an event-driven resource. Browser automation consumes explicit pending/confirmed/rejected Merchant results, and accepted boundary settlements carry only bounded local-combat HP plus the already validated room turn count. Historical rulesets remain pinned; new protocol behavior is capability-gated.

**Tech Stack:** JavaScript ES modules/CommonJS browser helpers, Node test runner, Cloudflare Worker ruleset/domain modules, generated Pages v3 bridge, existing Ranked boundary protocol and build scripts.

**Spec:** `docs/superpowers/specs/2026-08-24-ranked-potion-merchant-integrity-design.md`

## Global Constraints

- Baseline is `dd751d3a5487902225e3d67cd42178ef2ce1418a`; production deployment remains blocked pending a separate user approval.
- Worker remains authoritative for inventory, potion capacity/current count, progress, purchases, offers, revisions, and legality; local combat remains locally authoritative.
- Do not change or widen `REWARD_CLAIM_POTION_USE_LIMIT` and do not add Observer Bot exceptions.
- `assistanceClass: observer_bot` remains excluded from official ranking and podium.
- Practice and Ranked storage/state remain isolated; Fury and elixir behavior remain unchanged except projection tests proving non-interference.
- Change canonical source first and regenerate artifacts with the official generator/build scripts.
- Start every behavioral task with a focused failing test and observe the intended failure before implementation.
- Preserve the two user-owned untracked plan files and stage only explicit task paths.
- Do not push, activate a ruleset, deploy Worker/Pages, migrate D1, or run production-mutating smoke before the pre-deploy report is approved.

---

### Task 1: Pure canonical potion resource policy

**Files:**
- Create: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/potion-policy.js`
- Create: `cloudflare/leaderboard-v3/test/ranked-potion-resources.test.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/index.js`

**Interfaces:**
- Produces: `derivePotionMaximumV08(input) -> integer`, where `input` has `baseMaximum`, `satchelLevel`, `modifierMaximumSlotsAdditive`, and `flaskStacks`.
- Produces: `applyPotionResourceTransitionV08(resources, transition) -> resources`, where transition has absolute `nextMaximum` and `currentGrant`.
- Produces: `initializePotionResourcesV08(input) -> { potions, maxPotions }` for a new run, with fixed Alchemist-before-Famine start semantics.
- Produces: `assertCanonicalPotionResourcesV08(resources, expectedMaximum) -> resources`.

- [ ] **Step 1: Write the failing pure matrix tests**

Add table-driven cases equivalent to:

```js
for (const row of [
  { name: "base", baseMaximum: 3, satchelLevel: 0, modifierMaximumSlotsAdditive: 0, flaskStacks: 0, expected: 3 },
  { name: "satchel+alchemist", baseMaximum: 3, satchelLevel: 2, modifierMaximumSlotsAdditive: 2, flaskStacks: 0, expected: 7 },
  { name: "famine floor", baseMaximum: 3, satchelLevel: 0, modifierMaximumSlotsAdditive: -3, flaskStacks: 0, expected: 1 },
  { name: "all sources", baseMaximum: 3, satchelLevel: 2, modifierMaximumSlotsAdditive: -1, flaskStacks: 5, expected: 9 }
]) {
  assert.equal(derivePotionMaximumV08(row), row.expected, row.name);
}
```

Also prove positive capacity with/without grant, negative capacity clamp,
maximum five Flask stacks, and current above a new maximum. Exact-operation
retry and absolute reprojection idempotency are covered at the state-machine and bridge layers.

- [ ] **Step 2: Run the test and observe RED**

Run: `node --test cloudflare/leaderboard-v3/test/ranked-potion-resources.test.js`

Expected: FAIL because `potion-policy.js` and its exports do not exist.

- [ ] **Step 3: Implement the pure policy**

Implement strict safe-integer validation and these rules:

```js
export function derivePotionMaximumV08({
  baseMaximum = 3,
  satchelLevel = 0,
  modifierMaximumSlotsAdditive = 0,
  flaskStacks = 0
}) {
  return Math.max(1, baseMaximum + satchelLevel + modifierMaximumSlotsAdditive + flaskStacks);
}

export function applyPotionResourceTransitionV08(resources, {
  nextMaximum,
  currentGrant = 0
}) {
  const next = structuredClone(resources);
  next.maxPotions = nextMaximum;
  next.potions = Math.min(nextMaximum, next.potions + currentGrant);
  return next;
}
```

`initializePotionResourcesV08` starts from base+Satchel, adds Alchemist's two starting potions when active, and clamps against the final maximum after Famine and Flask capacity.

- [ ] **Step 4: Run the focused test and observe GREEN**

Run the Task 1 test. Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Stage the three Task 1 files and commit: `git commit -m "feat: add canonical ranked potion policy"`.

### Task 2: Apply Flask effects atomically to canonical relic mutations

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/relic-policy.js`
- Modify: `cloudflare/leaderboard-v3/test/ranked-potion-resources.test.js`
- Modify: `cloudflare/leaderboard-v3/test/phase3b2c2-golden.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m1-merchant.test.js`

**Interfaces:**
- Consumes: `applyPotionResourceTransitionV08` from Task 1.
- Produces: Flask-aware `applyRelicAcquisition`, `applyRelicRemovalV08`, and `applyRelicReplacementBuildV08` with unchanged signatures.

- [ ] **Step 1: Add failing acquisition/removal/replacement tests**

```js
const once = await applyRelicAcquisition(build, flaskAcquisition, context);
assert.equal(once.resources.maxPotions, 4);
assert.equal(once.resources.potions, 4);

const removed = await applyRelicRemovalV08(fullBagWithTwoFlasks, { relicId: "flask", stacks: 1 }, context);
assert.equal(removed.resources.maxPotions, 4);
assert.equal(removed.resources.potions, 4);
```

Cover Flask ×1/×5, non-Flask acquisition, removal of one stack, Flask→other, other→Flask, unchanged net Flask count, Merchant buyback, and rejection of Flask ×6.

- [ ] **Step 2: Run focused tests and observe RED**

Run: `node --test cloudflare/leaderboard-v3/test/ranked-potion-resources.test.js cloudflare/leaderboard-v3/test/phase3b2c2-golden.test.js cloudflare/leaderboard-v3/test/m1-merchant.test.js`

Expected: FAIL because relic mutations leave resources unchanged.

- [ ] **Step 3: Apply Flask delta exactly once**

```js
function applyFlaskStackDelta(build, beforeStacks, afterStacks) {
  const delta = afterStacks - beforeStacks;
  if (delta === 0) return build;
  build.resources = applyPotionResourceTransitionV08(build.resources, {
    nextMaximum: Math.max(1, build.resources.maxPotions + delta),
    currentGrant: Math.max(0, delta)
  });
  return build;
}
```

Call this once after the final relic list is known. Negative deltas grant zero and clamp; current potions are never reconstructed from maximum.

- [ ] **Step 4: Run focused tests and observe GREEN**

Run the Task 2 command. Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Stage the four Task 2 files and commit: `git commit -m "fix: apply ranked flask resources canonically"`.

### Task 3: Apply Satchel and modifier potion effects at canonical run transitions

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/run-modifiers.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/profile-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/camp-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/meta-state.js`
- Modify: `cloudflare/leaderboard-v3/test/ranked-potion-resources.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m1-camp-pact.test.js`
- Modify: `cloudflare/leaderboard-v3/test/r2-camp-profile.test.js`
- Modify: `cloudflare/leaderboard-v3/test/r2-campaign-parity.test.js`

**Interfaces:**
- Consumes Task 1 policy and Task 2 Flask-aware build.
- Produces `projectPublicRunModifiers().summary.potionModifiers` with capacity/start/heal fields.
- Produces canonical invariant validation against Camp level + modifier ledger + Flask stacks.

- [ ] **Step 1: Add failing transition and property tests**

Test Alchemist, Famine, both together, both selection orders, sequential mid-run additions, Satchel `0..5`, Flask `0..5`, carried Flask, current above reduced maximum, profile hydration, repeated hydration, and empty new campaign.

```js
assert.deepEqual(startResources({ satchel: 0, modifiers: ["alchemist"] }), { potions: 5, maxPotions: 5 });
assert.deepEqual(startResources({ satchel: 0, modifiers: ["alchemist", "famine"] }), { potions: 2, maxPotions: 2 });
```

- [ ] **Step 2: Run focused tests and observe RED**

Run: `node --test cloudflare/leaderboard-v3/test/ranked-potion-resources.test.js cloudflare/leaderboard-v3/test/m1-camp-pact.test.js cloudflare/leaderboard-v3/test/r2-camp-profile.test.js cloudflare/leaderboard-v3/test/r2-campaign-parity.test.js`

Expected: FAIL because modifier effects are not applied to resources.

- [ ] **Step 3: Wire run-start and mid-run transitions**

In `applyCanonicalRunModifierSelection`, derive old/new effects. A `server-issued-mid-run` change applies capacity delta and clamp but no starting potion grant. Profile hydration calls `initializePotionResourcesV08` with base 3, Satchel, active effects, and Flask stacks. Camp Satchel uses the shared transition helper and grants exactly one.

Add an invariant using `derivePotionMaximumV08` and `assertCanonicalPotionResourcesV08` after canonical state mutations.

- [ ] **Step 4: Project healing modifiers**

```js
summary: {
  extraRelicChoices: derived.extraRelicChoices,
  goldMultiplierAdditive: derived.goldMultiplierAdditive,
  potionModifiers: structuredClone(derived.potionModifiers)
}
```

Do not accept a client-provided multiplier.

- [ ] **Step 5: Run focused tests and observe GREEN**

Run the Task 3 command. Expected: PASS.

- [ ] **Step 6: Commit Task 3**

Stage Task 3 files and commit: `git commit -m "fix: canonicalize ranked potion modifiers"`.

### Task 4: Claim parity, projection, Practice zero, truthful rewards, and Oath

**Files:**
- Modify: `scripts/build-pages-v3.mjs`
- Modify: `game.js`
- Modify: `tests/pages-ranked-practice-storage-isolation.test.mjs`
- Create: `tests/potion-state-regressions.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m2b-real-runtime-http.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m4-client-bootstrap.test.js`
- Modify: `cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js`

**Interfaces:**
- Consumes canonical `build.resources` and `runModifiers.summary.potionModifiers`.
- Produces absolute `syncRankedCanonicalPotionState(publicState)` in generated game code.

- [ ] **Step 1: Add failing exact-claim/projection tests**

```js
await assert.doesNotReject(() => checkpoint({ potionUseCount: canonicalPotions }));
await assert.rejects(checkpoint({ potionUseCount: canonicalPotions + 1 }), /REWARD_CLAIM_POTION_USE_LIMIT/u);
```

Add reconnect/reprojection assertions proving identical revisions do not change counts or heal multiplier.

- [ ] **Step 2: Add failing Practice/message/Oath tests**

Load `{ potions: 0, maxPotions: 2 }`; test full-bag room/chest rewards; test Oath skill use followed by three later combat-turn potion attempts. Expect exact 0/2, no false `+1`, and all three attempts blocked.

- [ ] **Step 3: Run focused tests and observe RED**

Run: `node --test tests/potion-state-regressions.test.js tests/pages-ranked-practice-storage-isolation.test.mjs cloudflare/leaderboard-v3/test/m2b-real-runtime-http.test.js cloudflare/leaderboard-v3/test/m4-client-bootstrap.test.js cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js`

- [ ] **Step 4: Implement projection and Practice-safe parsing**

The generated helper validates safe integers, assigns canonical counts, clamps current, and assigns the absolute canonical heal multiplier. Practice uses explicit finite checks:

```js
potions: Number.isFinite(savedPotions) ? Math.max(0, savedPotions) : 1,
maxPotions: Number.isFinite(savedMaxPotions) ? Math.max(1, savedMaxPotions) : 5,
```

- [ ] **Step 5: Make logs conditional and fix Oath tick**

Use `const gained = grantPotion(1)` for room/chest copy. Add `oathPotionLockAppliedTurn`; skip only the first lock tick matching the activation turn, then clear the marker.

- [ ] **Step 6: Run focused tests and observe GREEN**

Run the Task 4 command. Expected: PASS.

- [ ] **Step 7: Commit Task 4**

Stage Task 4 files and commit: `git commit -m "fix: preserve ranked potion parity and practice saves"`.

### Task 5: Shared Observer Bot potion decision

**Files:**
- Modify: `bot-safety.js`
- Modify: `game.js`
- Modify: `scripts/build-pages-v3.mjs`
- Modify: `tests/bot-safety.test.js`
- Modify: `cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js`

**Interfaces:**
- Produces `decideBotPotionUse(options) -> { use, reason, actionKey }`.
- Extends `canBotDrinkPotion(options)` for meaningful full-HP cleanse while retaining Risk/Oath/dead/no-potion locks.
- Produces Observer state `lastPotionActionKey` and bounded `potionUseTurns`.

- [ ] **Step 1: Add failing pure decision tests**

```js
assert.equal(decideBotPotionUse({ hp: 90, maxHp: 100, incomingDamage: 5, effectiveHeal: 20, potions: 2 }).use, false);
assert.equal(decideBotPotionUse({ hp: 40, maxHp: 100, incomingDamage: 45, effectiveHeal: 25, potions: 2 }).reason, "prevent_lethal");
assert.equal(decideBotPotionUse({ hp: 100, maxHp: 100, poisonTurns: 3, poisonDamage: 8, potions: 1 }).reason, "cleanse_poison");
```

Also cover partial/full HP statuses, trivial status, Risk, Oath, boundary/turn/enemy-turn pending, cooldown, duplicate action key, and heal waste.

- [ ] **Step 2: Run pure tests and observe RED**

Run: `node --test tests/bot-safety.test.js`

- [ ] **Step 3: Implement the pure policy**

Calculate barrier-adjusted damage, post-hit HP/ratio, utilized heal, and remaining status damage. Return exactly one of:
`blocked_risk`, `blocked_oath`, `blocked_empty`, `blocked_dead`, `blocked_boundary`,
`blocked_turn`, `blocked_cooldown`, `blocked_duplicate_action`, `cleanse_bleed`,
`cleanse_poison`, `prevent_lethal`, `prevent_critical`, `low_hp_useful_heal`,
`high_hp_low_threat`, or `heal_waste`.

- [ ] **Step 4: Route both bot paths through it**

Replace the `<0.9` burst branch and `<=0.35` helper. Build an action key from turn/enemy-turn and hazard identity. Set it only after potion count decreases; clear when turn/hazard changes and record the use turn.

- [ ] **Step 5: Run bot tests and observe GREEN**

Run: `node --test tests/bot-safety.test.js cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js`

- [ ] **Step 6: Commit Task 5**

Stage Task 5 files and commit: `git commit -m "fix: make observer potion use threat-aware"`.

### Task 6: Reserved relic offer and commit guards

**Files:**
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/merchant-policy.js`
- Modify: `cloudflare/leaderboard-v3/test/m1-merchant.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m2b-real-runtime-http.test.js`

**Interfaces:**
- Preserves Merchant schemas.
- Produces `MERCHANT_RESERVED_RELIC_BUYBACK_FORBIDDEN` on crafted/stale commit.

- [ ] **Step 1: Add failing offer/commit tests**

With a reservation ID also present in aggregated owned stacks, assert no buyback choice for that ID, another ID remains sellable, crafted/stale commit fails before payout/removal, reopen/reconnect keeps the filter, and discard/claim restores normal eligibility.

- [ ] **Step 2: Run tests and observe RED**

Run: `node --test cloudflare/leaderboard-v3/test/m1-merchant.test.js cloudflare/leaderboard-v3/test/m2b-real-runtime-http.test.js`

- [ ] **Step 3: Add both guards**

```js
if (owned.relicId === metaState.build.merchant.reservedRelic?.relicId) continue;
```

Before buyback removal, compare the live reservation and throw the new code.

- [ ] **Step 4: Run tests and observe GREEN**

Run the Task 6 command. Expected: PASS.

- [ ] **Step 5: Commit Task 6**

Stage Task 6 files and commit: `git commit -m "fix: protect ranked merchant reservations"`.

### Task 7: Confirmed-only Merchant automation and deterministic economy

**Files:**
- Modify: `online-v3/ranked-v3-runtime.js`
- Modify: `scripts/build-pages-v3.mjs`
- Modify: `game.js`
- Modify: `cloudflare/leaderboard-v3/test/observer-bot-merchant.test.js`
- Modify: `cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m4-client-bootstrap.test.js`
- Modify: `tests/merchant-curation.test.js`
- Modify: `tests/hd-merchant-screen.test.js`

**Interfaces:**
- Produces bridge callbacks `completeRankedMerchantAction(result)` and `failRankedMerchantAction(result)`.
- Produces `getRankedMerchantMutationState() -> { status, receiptKey, action, reason }`.
- Produces `buildObserverMerchantDecision(context) -> { action, request, reason }`.

- [ ] **Step 1: Add failing lifecycle tests**

Using deferred fake-client promises, prove submission does not increment; success increments once; duplicate callback does not; no choice/422/timeout/stale revision do not; pending blocks duplicates; timeout resyncs before retry; committed state is adopted without second charge; repeated failure backs off and exits.

- [ ] **Step 2: Add failing policy/property tests**

Table-test run-then-camp payment, reserves, full bag, 2/8 after six recent uses, next boss, low lives, purchase limit, and exactly these skip/failure reasons:
`offer_pending`, `no_canonical_choice`, `bag_full`, `stock_sufficient`,
`insufficient_wallet`, `camp_reserve`, `run_reserve`, `no_useful_upgrade`,
`purchase_limit`, `commit_rejected`, `resync_required`, and `failure_backoff`.
Add canonical choices for potion, Shield/Dash/AOE, relic, Full Heal, Combat Boost, second chance, life, and Black Market. Never synthesize absent choices.

- [ ] **Step 3: Run focused tests and observe RED**

Run: `node --test cloudflare/leaderboard-v3/test/observer-bot-merchant.test.js cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js cloudflare/leaderboard-v3/test/m4-client-bootstrap.test.js tests/merchant-curation.test.js tests/hd-merchant-screen.test.js`

- [ ] **Step 4: Implement runtime operation state**

Track `{ status, transactionId, choiceId, startingRevision, action, receiptKey, reason, attempts }`. Dispatch acceptance is not success. On success sync and callback; on deterministic rejection fail callback; on uncertain failure resume and compare canonical revision/offer/resources before same-identity retry.

- [ ] **Step 5: Count receipts and implement policy**

Remove immediate counter increments. Increment only after a new confirmed receipt key. Derive stock target from capacity, boss, lives, HP, and recent uses; score only available choices; emit one closed trace reason per skip/failure.

- [ ] **Step 6: Run focused tests and observe GREEN**

Run the Task 7 command. Expected: PASS.

- [ ] **Step 7: Commit Task 7**

Stage Task 7 files and commit: `git commit -m "fix: confirm ranked merchant bot purchases"`.

### Task 8: Bounded HP, Full Heal, Combat Boost turns, and Depth unlocks

**Files:**
- Modify: `online-v3/ranked-v3-protocol.js`
- Modify: `online-v3/ranked-v3-runtime.js`
- Modify: `scripts/build-pages-v3.mjs`
- Modify: `cloudflare/leaderboard-v3/src/index.js`
- Modify: `cloudflare/leaderboard-v3/src/domain/ruleset-runtime.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/reward-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/merchant-policy.js`
- Modify: `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/profile-policy.js`
- Create: `cloudflare/leaderboard-v3/test/ranked-boundary-resources.test.js`
- Modify: `cloudflare/leaderboard-v3/test/ranked-boundary-checkpoints.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m1-merchant.test.js`
- Modify: `cloudflare/leaderboard-v3/test/r2-campaign-parity.test.js`

**Interfaces:**
- Extends boundary payload with `combatResources: { hp, maxHp }` behind `boundedCombatResources: "v1"`.
- Projects HP only from accepted boundary/service state.
- Uses accepted `turnCount` once for canonical turn/boost advancement.

- [ ] **Step 1: Add failing protocol/domain tests**

Test unknown fields, max mismatch, HP <0/>max/noninteger, exact retry, and prove lower HP cannot change gold, score, max HP, potions, inventory, modifiers, or eligibility.

- [ ] **Step 2: Add failing Full Heal/boost/depth tests**

Cover full/wounded Full Heal, one price, reconnect/carry; boost at 100, deltas, expiry, pre/post-expiry purchase, reconnect/no double tick; depth 19/20, duplicate, fatal, Practice, same-campaign carry, and new-campaign reset.

- [ ] **Step 3: Run focused tests and observe RED**

Run: `node --test cloudflare/leaderboard-v3/test/ranked-boundary-resources.test.js cloudflare/leaderboard-v3/test/ranked-boundary-checkpoints.test.js cloudflare/leaderboard-v3/test/m1-merchant.test.js cloudflare/leaderboard-v3/test/r2-campaign-parity.test.js`

- [ ] **Step 4: Validate/apply bounded HP atomically**

Capture local HP/max HP. Allow only the two integer fields, require canonical max equality, assign HP after all validation, and never reuse it for rewards/gold/score/inventory.

- [ ] **Step 5: Advance boost and Depth**

```js
resources.turn += turnCount;
resources.combatBoostTurns = Math.max(0, resources.combatBoostTurns - turnCount);
if (resources.combatBoostTurns === 0) {
  resources.combatBoostAttack = 0;
  resources.combatBoostArmor = 0;
}
if (outcome === "cleared") {
  resources.highestUnlockedDepth = Math.max(resources.highestUnlockedDepth, envelope.depth);
}
```

Project absolute fields; preserve same-campaign profile carry and existing empty-build new-profile reset.

- [ ] **Step 6: Run focused tests and observe GREEN**

Run the Task 8 command. Expected: PASS.

- [ ] **Step 7: Commit Task 8**

Stage Task 8 files and commit: `git commit -m "fix: settle ranked boundary resources"`.

### Task 9: Cross-system isolation and anti-cheat regressions

**Files:**
- Modify: `cloudflare/leaderboard-v3/test/ranked-integrity.test.js`
- Modify: `cloudflare/leaderboard-v3/test/m3-leaderboard-publication.test.js`
- Modify: `cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js`
- Modify: `tests/pages-ranked-practice-storage-isolation.test.mjs`
- Modify: `cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js`

**Interfaces:**
- Consumes all prior behavior; produces regression evidence only.

- [ ] **Step 1: Add end-to-end state-sequence tests**

Cover Ranked start, Camp, Satchel/modifiers, Flask, room/chest/Shrine/Merchant grant, manual/Auto/Bot use, checkpoint, extract, fatal, reconnect, abandon, and Start New Ranked. Assert no old relic/modifier/potion/Depth/Practice state survives.

- [ ] **Step 2: Add non-interference tests**

Assert Fury and elixir fields stay byte-equivalent during potion-only operations; Practice cannot advance Ranked; Observer stays assisted and absent from official ranks/podium with no alternative validation path.

- [ ] **Step 3: Run focused tests**

Run: `node --test cloudflare/leaderboard-v3/test/ranked-integrity.test.js cloudflare/leaderboard-v3/test/m3-leaderboard-publication.test.js cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js tests/pages-ranked-practice-storage-isolation.test.mjs cloudflare/leaderboard-v3/test/observer-bot-runtime.test.js`

Expected: PASS; fix failures in owning code without weakening assertions.

- [ ] **Step 4: Commit Task 9**

Stage Task 9 tests and commit: `git commit -m "test: lock ranked potion merchant integrity"`.

### Task 10: Generate, verify, independently review, and prepare pre-deploy report

**Files:**
- Modify: generated ruleset data/manifest and release/protocol bindings reported by `node scripts/generate-online-v3-meta-rules.mjs`
- Modify: `progress.md`
- Do not modify: `ONLINE_V3_HANDOFF.md` until production state changes

**Interfaces:**
- Produces one exact candidate commit and Pages artifact.
- Produces reviewer findings for server, client, and test/release risk.

- [ ] **Step 1: Regenerate canonical artifacts**

Run: `node scripts/generate-online-v3-meta-rules.mjs`. Accept only expected provenance/policy/manifest/hash/binding changes; historical releases remain pinned.

- [ ] **Step 2: Run focused aggregate verification**

```text
node --test tests/bot-safety.test.js tests/merchant-curation.test.js tests/hd-merchant-screen.test.js tests/potion-state-regressions.test.js tests/pages-ranked-practice-storage-isolation.test.mjs
node --test cloudflare/leaderboard-v3/test/ranked-potion-resources.test.js cloudflare/leaderboard-v3/test/observer-bot-merchant.test.js cloudflare/leaderboard-v3/test/m1-merchant.test.js cloudflare/leaderboard-v3/test/r2-campaign-parity.test.js cloudflare/leaderboard-v3/test/m2b-real-runtime-http.test.js cloudflare/leaderboard-v3/test/ranked-boundary-resources.test.js cloudflare/leaderboard-v3/test/ranked-boundary-checkpoints.test.js cloudflare/leaderboard-v3/test/online-ranked-boundary-repair.test.js
```

Run changed-JS syntax checks and `git diff --check`.

- [ ] **Step 3: Run required project verification once**

```text
npm run verify:guard
npm run verify:phase
npm run verify:ui-current -- --scenario save
npm run verify:ranked-headed -- --scenario recovery
npm run verify:ranked-headed -- --scenario lifecycle
npm run verify:ranked-headed -- --scenario camp
npm run verify:baseline
npm run verify:full -- --force
```

Do not rerun an unchanged passing fingerprint; inspect full logs only after FAIL.

- [ ] **Step 4: Build and smoke exact candidate**

Run `npm run pages:build`, verify markers/drift and artifact fingerprint, then local/preview smoke ordinary Ranked and Observer Bot: potion capacity/use, confirmed Merchant purchase, reconnect, Start New Ranked, and Practice return. Attribute console/API failures from source and stack.

- [ ] **Step 5: Run three independent reviews**

Review separately: Worker/ruleset authority and anti-cheat; client/Bot/Merchant/Practice; tests/generated drift/release risk. The primary agent validates every finding and reruns affected checks after fixes.

- [ ] **Step 6: Audit complete diff and create candidate commit**

Read the diff from `dd751d3`; search temporary logs, debug flags, secrets, bot exceptions, weakened limits, and unrelated files. Inspect full status and staged paths, update `progress.md`, run `git diff --check`, and exclude both user-owned untracked plans.

- [ ] **Step 7: Present pre-deploy report and stop**

Report root causes, files/count, authority and anti-cheat evidence, RED/GREEN tests, verification totals, reviews, smoke, risks, candidate commit/hash, ruleset hash, and rollback baseline (`dd751d3`; Worker `60f9b0dc-3f90-4eba-aa3e-3fb4e4102344`; rollback `d22afaf6-afff-4491-a360-f20f31339738`). Ask for explicit deploy approval; do not push or deploy.
