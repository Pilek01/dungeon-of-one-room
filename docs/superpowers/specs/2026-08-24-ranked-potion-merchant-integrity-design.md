# Ranked potion and Merchant integrity repair — design

Date: 2026-08-24
Status: APPROVED
Baseline: `dd751d3a5487902225e3d67cd42178ef2ce1418a`

## Authority and release boundary

This design covers the production Ranked and anti-cheat repair requested in
the current conversation. Online v3 remains checkpoint-authoritative
meta-progression around locally authoritative combat. It does not become
server-authoritative combat or cheat-proof.

Implementation, local commits, regeneration, and pre-deploy verification are
in scope after design approval. Production activation, push, Worker rollout,
Pages deployment, and ruleset activation remain blocked until the user reviews
the final evidence report and gives a separate explicit deployment approval.

The production rollback baseline supplied by the user is:

- source commit `dd751d3a5487902225e3d67cd42178ef2ce1418a`;
- Worker version `60f9b0dc-3f90-4eba-aa3e-3fb4e4102344`;
- Worker rollback version `d22afaf6-afff-4491-a360-f20f31339738`;
- Pages deployment `15dc4412.dungeon-of-one-room.pages.dev`;
- active ruleset `sha256:bf17a65dc721066bf11a1c34063cc18254fe97766852827719eb6aabf36042fa`;
- no D1 migration in that release.

## Confirmed current-tip defects

The audit reconfirmed the earlier hypotheses against `dd751d3`:

1. `applyRelicAcquisition`, replacement, and removal update only the relic
   ledger and digest. Spare Flask does not change canonical `potions` or
   `maxPotions`, although the local game gives each acquired stack one slot and
   one potion and removes one slot when a stack is lost.
2. The Worker derives Alchemist and Famine potion effects but never applies
   them to canonical resources. The client later projects the unchanged Worker
   counts back onto the run.
3. Reward validation still correctly rejects `potion-use` claims greater than
   the canonical current count. The repair must increase the canonical count at
   the legal source rather than widen `REWARD_CLAIM_POTION_USE_LIMIT`.
4. Practice snapshot loading uses truthy fallbacks, so saved zero becomes one
   and a saved maximum below five becomes five.
5. Room and chest potion messages can report `+1 potion` even when
   `grantPotion(1)` returns zero. Shrine already uses the truthful return value.
6. Observer Bot's pending-burst path drinks at any HP below 90% after escape
   and shield fail, without comparing incoming damage, post-hit HP, or
   effective healing. Its shared eligibility helper also forbids a full-HP
   Bleed/Poison cleanse.
7. Ranked Merchant now correctly opens the canonical offer first and blocks
   further automation while a request is pending. However,
   `onMerchantAction()` returns `true` when an async commit is only scheduled,
   and `runObserverMerchantAction()` immediately increments the successful
   purchase counter. Network/422/revision failure therefore consumes a success
   slot.
8. The Worker buyback offer includes every owned relic ID and commit has no
   reserved-ID guard. The local v0.8 implementation excludes the entire
   reserved relic ID from buyback, including aggregated duplicate stacks.
9. Worker HP is not advanced from ordinary local combat, so a wounded client
   can receive `MERCHANT_FULL_HEAL_NOT_LEGAL`. The new boundary protocol carries
   turn and reward evidence but no HP evidence.
10. Combat Boost is set to 100 turns by the Worker but only decremented locally.
    Accepted boundary `turnCount` is available and is already validated and
    used for bounded reward evidence.
11. `highestUnlockedDepth` is initialized and carried between runs of one
    profile but is never advanced by accepted Ranked progress.
12. Start New Ranked and Ranked/Practice storage isolation received focused
    fixes in `b53add5` and `5919efb`; these paths need stronger regression
    coverage, not a second reset implementation.
13. Oath of Ruin advertises three sealed turns, sets the counter to three, and
    decrements it at the end of the same skill turn. Only two later actionable
    turns are blocked. The literal description and turn order are sufficient
    source evidence for a focused off-by-one regression.

## Canonical potion model

### Capacity is derived; current count is transactional

`maxPotions` will be an asserted canonical entitlement derived from trusted
state:

```text
max(1,
  base capacity
  + Camp Satchel level
  + active canonical modifier capacity delta
  + canonical Spare Flask stack count)
```

No client-reported potion total participates in this formula. Every mutation
that can change Satchel, modifiers, relic stacks, or run initialization must
reconcile the entitlement in the same atomic state transition.

`potions` remains an event-driven resource. It is changed only by a canonical
grant, purchase, refill, accepted use claim, or capacity clamp. Reprojection
repeats an absolute state and therefore cannot refill the bag or apply a Flask
twice.

### Start and transition semantics

- Base and Satchel initialize both current and maximum counts from the existing
  canonical profile policy.
- At run start, active Alchemist is applied before Famine, matching the fixed
  order in `applyMutatorsToRun`: Alchemist adds two slots and two starting
  potions; Famine removes three slots down to a minimum of one and clamps the
  current count. Selection order cannot change this fixed start result.
- A mid-campaign Alchemist activation adds two capacity slots but does not
  refill them, matching `applyMutatorMidRun`.
- A mid-campaign Famine activation removes three slots and clamps current
  potions.
- Each acquired Spare Flask stack atomically adds one slot and one current
  potion, capped at the new maximum. Each removed stack removes one slot and
  clamps current. A replacement uses the before/after Flask stack delta, so an
  unchanged net stack count cannot manufacture a refill.
- A carried Flask is included when a later run in the same campaign is hydrated.
  A genuinely new Ranked campaign starts from the empty canonical build.

The shared invariant helper will be called by relic acquisition/removal/
replacement, Camp Satchel, run-modifier transitions, profile hydration, and
state assertions. The build digest remains based on its established fields;
the full canonical state and revision provide idempotency for resources.

### Healing strength

Alchemist/Famine healing strength remains local combat behavior, but its value
must be projected from the canonical modifier ledger. The public projection
will expose the derived potion modifier summary; the Ranked bridge will assign
the absolute multiplier rather than multiplying an already projected value.
Fury and elixir charge/effect systems remain unchanged.

## Reward claims and messages

The existing exact limit stays unchanged:

- count equal to canonical `resources.potions` is accepted;
- count greater by one is rejected with
  `REWARD_CLAIM_POTION_USE_LIMIT`;
- retrying an already committed operation returns/reconstructs its canonical
  result and does not consume again.

Every local reward path will use the integer returned by `grantPotion`. A room
reward or chest reports a potion only when the return is positive; a full bag
reports the existing full/no-gain outcome. Shrine, Merchant, Crossroads, and
canonical chest projections retain their distinct source rules.

Practice loading will use finite-number validation and nullish/explicit
fallbacks: zero is valid, and `maxPotions` is clamped only to the actual gameplay
minimum of one. Practice reads no Ranked projection.

## Observer Bot potion policy

`bot-safety.js` will expose one pure decision function used by both ordinary
bot potion consideration and pending-burst preparation. It returns a decision
and a stable reason rather than a bare threshold.

Inputs include eligibility locks (Risk, Oath, potion count), HP/max HP,
effective heal, barrier, Bleed/Poison remaining value, incoming burst damage,
predicted post-hit HP, turn/enemy-turn identity, cooldown/action state, and a
stable pending-hazard identity.

Decision order:

1. Reject when Risk, Oath, no potions, dead state, pending boundary/commit,
   active turn resolution, cooldown, or the same unresolved action key blocks
   use.
2. Permit a full-HP cleanse only when Bleed/Poison has meaningful remaining
   damage or duration.
3. Permit burst preparation when the hit is lethal or would leave the player
   in the critical band and the potion materially improves survival.
4. Permit ordinary rescue at low HP only when a useful part of the heal is not
   wasted, with status damage contributing to value.
5. Reject a small nonlethal burst at high HP even if no escape or shield is
   available.

The bot stores the accepted action key until the turn/hazard resolves, so one
pending event cannot consume several potions. Manual potion use is unchanged.
Auto Potion keeps its existing turn and cooldown behavior and reuses only the
common eligibility/status facts; it is not invoked a second time by the bot
decision.

Oath receives an applied-turn marker so the advertised three future combat
turns remain blocked without changing its damage cost or manual/Auto Potion
guards.

## Ranked Merchant lifecycle and policy

### Explicit operation state

The boolean bridge currently conflates `submitted` with `committed`. It will be
replaced for Ranked automation with an explicit state machine:

```text
idle -> pending -> confirmed
                -> rejected
                -> uncertain -> resync -> confirmed | retryable | rejected
```

The submitted operation records transaction ID, choice ID, starting revision,
action, and a stable receipt key. The game may show a pending decision but does
not increment `merchantPurchasesThisRoom`. A canonical success callback adds
exactly one receipt and one success count. A repeated callback/reprojection is
ignored by receipt key.

A deterministic 4xx/no-choice/stale-choice result records a skip/failure reason
and does not increment the counter. Transport timeout enters `uncertain`; the
runtime resyncs before retrying. It first checks revision, canonical resources,
wallet, offer status, and transaction receipt. A confirmed earlier commit is
adopted; otherwise any retry uses the same idempotency identity. Bounded
backoff and a per-room failure ceiling prevent an infinite click loop.

Existing canonical-offer-first behavior, pending automation lock, run-then-camp
wallet order, and maximum successful purchases per room remain.

### Deterministic buying priorities

The potion stock target is derived from capacity, next-boss proximity, lives,
HP, and potion uses in a recent rolling turn window. It scales with a large bag
but does not blindly fill it. Survival urgency may reduce the Camp/run reserve,
while a hard floor still protects campaign economy.

After survival needs, the bot evaluates legal server-issued choices in a fixed
order and scored policy: Shield/Dash/AOE upgrades, useful relic acquisition,
legal services, and only then optional economic actions. Full Heal, Combat
Boost, second chance, extra life, and Black Market are considered only when
their canonical preconditions and configured risk/cost limits hold.

Every no-purchase exit records one of a closed trace vocabulary, including
`offer_pending`, `no_canonical_choice`, `bag_full`, `stock_sufficient`,
`insufficient_wallet`, `camp_reserve`, `run_reserve`, `no_useful_upgrade`,
`purchase_limit`, `commit_rejected`, `resync_required`, and
`failure_backoff`. This distinguishes deliberate saving from technical failure.

### Reserved relic guard

The Worker will match the explicit local v0.8 behavior:

1. no buyback choice is issued for an owned relic ID equal to
   `build.merchant.reservedRelic.relicId`;
2. commit rechecks the live reserved ID and rejects a crafted or stale buyback
   choice before removal or payout.

The current model aggregates owned stacks by relic ID and the local source
blocks that entire ID. Therefore a same-ID stack is not independently sellable
while the reservation exists; tests will document this source-derived rule
rather than invent per-instance identity. Other relic IDs and the same relic
after discard/claim remain sellable under normal rules.

## HP, Full Heal, Combat Boost, and Depth

### Bounded HP checkpoint contract

Full Heal requires a small boundary protocol addition. Each exit/fatal
settlement may carry `combatResources: { hp, maxHp }`. The Worker requires
`maxHp` to equal the canonical maximum and `hp` to be an integer within the
legal range. HP is explicitly a bounded checkpoint attestation of locally
authoritative combat, not a trusted source for max HP, gold, inventory,
potions, score, rewards, or eligibility.

This does not claim to verify combat damage. It makes the existing architecture
explicit: local combat already determines survival, while the Worker validates
all meta-state. A fabricated lower HP cannot grant gold, items, score, potion
capacity, or a free heal; it can only make the player eligible to spend the
canonical Full Heal price. The accepted bounded HP becomes canonical carry at
the atomic room boundary. A Merchant room has no intervening combat, so Full
Heal checks that state, charges once, sets HP to canonical max, and projects the
result. Retry and reconnect reuse the committed revision.

If tests reveal another HP-dependent canonical benefit, this section must stop
for renewed design review rather than widening trust.

### Combat Boost

At every accepted room/fatal boundary, the Worker advances its existing
canonical `resources.turn` by validated room `turnCount` and decrements Combat
Boost once by that same delta. The client continues displaying/decrementing the
effect during local combat; canonical projection assigns the absolute remaining
turns, so it does not double-decrement. Reconnect to the last completed boundary
restores the last canonical remaining value and restarts any uncommitted room,
which cannot renew committed turns.

### highestUnlockedDepth

On an accepted cleared-room settlement, set:

```text
highestUnlockedDepth = max(highestUnlockedDepth, cleared depth)
```

Fatal/uncommitted Practice progress cannot advance it. It is carried between
runs of the same active Ranked campaign because the UI describes a campaign
Depth Highscore and the profile already carries the field. Start New Ranked,
which creates a new profile/campaign, resets it to zero. Tests cover 19/20,
reconnect, repeated checkpoint, abandon/finalize, and Practice isolation.

## Compatibility and generated artifacts

The changes touch the versioned ruleset/protocol. Historical hashes remain
byte-pinned and supported. New behavior is capability-gated for newly started
runs; unknown capabilities fail closed. Canonical source is changed first,
then the official generator updates data, manifest, release bindings, and hash.
No generated production bundle is edited by hand.

The Observer Bot receives no server-side exception and no tolerance increase.
`assistanceClass: observer_bot` remains excluded from official rank and podium;
ordinary Ranked uses the same validation paths.

## Test and verification strategy

Every defect starts with a focused failing test that is observed RED before the
implementation. Coverage is grouped into:

- pure potion entitlement/property matrices for Satchel, Alchemist, Famine,
  Flask stacks, transition order, removal, replacement, hydration, clamp, and
  idempotency;
- exact accepted/equal and rejected/+1 reward claims, chest/room/Shrine/
  Merchant grants, manual/Auto/Bot use, fatal and reconnect;
- pure bot decisions for high-HP small burst, lethal/critical burst,
  effective-heal waste, partial/full-HP cleanse, Risk/Oath, cooldown, pending,
  and duplicate action keys;
- Practice Continue zero/lower maximum, truthful reward messages, and Oath's
  three-turn semantics;
- Merchant domain/runtime tests for every choice class, reservation guards,
  wallet order/reserves, rolling potion demand, confirmed-only counters,
  no-choice, 422, timeout, stale revision, resync, idempotent retry, trace
  reasons, purchase ceiling, and clean exit;
- bounded HP/Full Heal, Combat Boost before/at/after expiry and reconnect,
  Depth 19/20, new-campaign reset, Practice isolation, Start New Ranked, and
  Observer leaderboard exclusion.

Final verification follows repository release rules because this is a shared
Ranked/ruleset/protocol and production-bound change: focused tests during TDD,
syntax checks, generator drift, `git diff --check`, one `verify:phase`, exact
affected current-tree browser scenarios, protected baseline, production Pages
build, `verify:full`, local/preview smoke for ordinary Ranked and Observer Bot,
then a whole-diff audit. No deployment follows without the separate approval.

## Known design risks

- HP remains bounded client attestation because combat is local. The protocol
  must not reuse it for score, rewards, max HP, inventory, or anti-cheat claims.
- Combat turn count is already client-attested telemetry. Using the same value
  for boost expiry improves consistency but does not make turn simulation
  server-authoritative.
- The generated-game patch system is marker-sensitive. Tests must verify source
  markers and the exact generated artifact to prevent silent drift.
- The protected v0.8 surface is intentionally touched only for the explicitly
  authorized Practice loader, reward messages, Oath semantics, and shared bot
  helper integration.
