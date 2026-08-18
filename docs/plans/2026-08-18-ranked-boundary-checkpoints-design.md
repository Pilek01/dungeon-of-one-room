# Ranked boundary checkpoints — design

Date: 2026-08-18
Status: APPROVED DESIGN, NOT IMPLEMENTED

## Authority and scope

This document records the checkpoint behavior approved in the current user
conversation. It is a design specification only. It does not authorize an
implementation, ruleset activation, migration, push, deployment, or release.

The change is limited to Ranked meta-progression. Combat simulation,
movement, AI, animation, audio, rendering, and ordinary non-Ranked gameplay
remain local and unchanged. Online v3 remains checkpoint-authoritative meta
progression, not server-authoritative combat and not cheat-proof.

## Problem

The current Ranked client seals and submits a room checkpoint as soon as the
last enemy dies. The player can still interact with the cleared room after
that point. A chest opened after the checkpoint can therefore change the
local wallet or inventory after the server has already settled the room. The
unsettled change can be carried into the next room and reported there, causing
a legitimate run to fail its integrity checks.

The checkpoint boundary must move from `last enemy defeated` to an explicit
room-exit or fatal boundary. The solution must continue to block simple
DevTools manipulation without adding network traffic during movement or
combat and without making normal transitions feel slower.

## Goals

- Settle a completed room only when the player commits to leaving it.
- Include post-combat chest interactions in the room being left.
- Preserve durable discoveries across death without enabling duplicate
  claims.
- Keep all movement and combat free of network requests.
- Ignore client-edited totals and derive canonical Ranked meta-state from
  validated reward and transaction claims.
- Hide ordinary checkpoint latency inside existing transitions.
- Let a player continue a locally playable run after an integrity failure,
  while excluding that run from the leaderboard.

## Non-goals

- Server-authoritative combat or per-action verification.
- Proof that the player physically performed every locally reported action.
- Protection against a determined attacker who reimplements and forges the
  complete protocol.
- Changes to existing item availability, drop rates, collection limits, or
  non-Ranked gameplay rules.
- Guaranteed preservation of progress when the browser is closed before a
  checkpoint boundary is reached.

## Checkpoint boundaries

There are two settlement outcomes and four player-facing boundaries.

### Room-exit checkpoint

The client snapshots and seals the room journal only when the player enters a
portal after clearing the room, selects normal Extract, or selects Emergency
Extract. The request settles all valid room rewards and resource transactions
up to that boundary.

For a portal, a successful response advances sequential depth and supplies the
canonical meta-state and next server-issued room directive. For either form of
Extract, a successful response settles the eligible current-room state before
the existing extraction flow completes. Extraction eligibility and its other
gameplay rules remain unchanged.

Emergency Extract does not clear the room, does not award the room-clear
reward, and does not advance depth. It settles only the claims and
consequences allowed by the existing canonical rules before the server derives
the emergency gold loss and ends the run.

Defeating the last enemy still enables the existing cleared-room presentation
and exits, but it no longer seals or submits the Ranked checkpoint. The player
may open chests and collect allowed rewards before choosing an exit.

### Fatal checkpoint

Death submits a fatal outcome for the active room. It records the canonical
consequences of death and any valid durable discoveries, but it does not:

- mark the room as cleared;
- award a room-clear reward;
- advance depth;
- turn unearned or unsettled room rewards into canonical progress.

The fatal operation is idempotent. Retrying the same operation cannot apply a
second death, duplicate an item, or advance the run twice. The response
supplies the canonical state needed by the existing retry, recovery, or final
defeat flow.

## Local room journal

The client keeps a compact journal for the active server-issued room. It may
record only Ranked meta-events required for settlement, such as reward-source
claims, opened chests, durable discoveries, resource transactions, and the
chosen terminal outcome. It does not transmit movement, attacks, enemy AI,
animation, or rendering events.

The journal remains open after the last enemy dies. It becomes immutable only
when the player enters a portal, extracts, emergency-extracts, or dies. Once
sealed, every retry uses the same operation identifier and exact payload.

The journal is evidence to validate, not a source of truth. Directly edited
gold, build, rarity, stack, modifier, score, or inventory totals are never
accepted as canonical values.

## Durable discoveries

Durable discoveries include Treasure Map Pieces, relics, and unlocks whose
existing gameplay rules say they survive death. This design does not change
which concrete items are durable; implementation must map the categories to
active v0.8 source evidence rather than guess.

Each eligible durable drop has a server-verifiable claim identity tied to the
specific run, room instance, source, and reward slot. When a fatal checkpoint
accepts such a claim:

- that discovered item remains owned after death;
- only that exact reward instance becomes claimed;
- replaying or retrying the same room cannot grant that instance again;
- an exact retry of the same operation is idempotent and is not treated as a
  duplicate-drop attempt;
- later rooms may continue to generate and grant further items of the same
  kind according to the unchanged game rules;
- completing a map or reaching any other collection limit continues to follow
  the existing game rules.

This prevents farming one drop through intentional deaths without globally
disabling future Treasure Map Pieces, relics, or unlocks.

## Server validation and settlement

Every boundary request carries the expected run revision, room/directive
identity, stable operation identity, terminal outcome, and compact journal.
The Worker validates the request against the pinned ruleset and current
canonical run state.

Settlement must:

1. Reject unknown, stale, cross-room, or already-consumed claim identities.
2. Validate reward sources against the server-issued room, enemies, chests,
   offers, mutators, and other documented meta-rules.
3. Recompute allowed gold, durable claims, build, resource transactions, and
   leaderboard eligibility without trusting client totals.
4. Apply the checkpoint and revision change atomically.
5. Return the same canonical result for an exact retry of a completed
   operation.
6. Fail closed for unknown ruleset versions, identifiers, or hashes.

This blocks simple manipulations such as setting local gold to an arbitrary
value because the edited total has no corresponding valid reward sources. It
does not claim to verify local combat or make the system cheat-proof.

## Transition latency and presentation

Portal checkpointing starts at the same moment as the existing transition.
The current fade and local preparation of safe, non-active next-room assets may
run in parallel with the request. Gameplay in the next room cannot activate
until the Worker returns the canonical state and room directive.

No artificial delay is added. If the checkpoint completes within the existing
transition, the player sees no new UI. Only when the request outlasts the
normal transition does the game show:

`Loading next depth…`

Normal Extract uses `Extracting…`. A fatal checkpoint remains behind the
standard death presentation and does not show a technical synchronization
message during ordinary operation.

## Failures, retries, and integrity messaging

Transport failure does not count as cheating and does not make the run
ineligible. The sealed operation remains pending and is retried with the same
identifier and payload. The game remains on a safe transition, extraction, or
death surface until the canonical result is known.

A duplicated request returns its previously committed result. A recoverable
revision conflict restores the server's canonical result when that can be done
without accepting unvalidated client progress.

An impossible Ranked state, such as invented gold, an invalid reward, or a
reused durable claim, makes the run ineligible for leaderboard publication.
The local game may continue. The player sees this notice once:

`Ranked integrity check failed. You can continue playing, but this run will not be submitted to the leaderboard.`

The UI does not accuse the player of cheating because an integrity mismatch
identifies inconsistent state, not intent. Detailed reason codes remain
available for diagnostics.

## Close, refresh, and Continue

Closing or refreshing the browser before a portal, extraction, or death
boundary cannot guarantee a final network operation. On Continue, the server's
last completed checkpoint remains authoritative. The player returns to the
start of the unresolved room and loses all uncheckpointed discoveries and
resource changes from that attempt, including a durable item that was picked
up locally but never settled.

This explicit trade-off avoids per-pickup network traffic and prevents local
storage or unload-time delivery from becoming an authority mechanism.

## Required implementation evidence

Implementation must begin with focused failing tests and preserve the current
Ranked architecture boundaries. At minimum, coverage must prove:

- a chest opened after the last enemy but before the portal settles in the
  room being left and does not cause a next-room gold mismatch;
- no checkpoint request is sent merely because the last enemy dies;
- portal entry seals one immutable operation and an exact retry is
  idempotent;
- normal Extract and Emergency Extract settle the intended room state once;
- death preserves an eligible durable claim without clearing or advancing the
  room;
- retrying the same death cannot duplicate the durable item or death cost;
- a later room may grant another Treasure Map Piece after an earlier piece was
  preserved;
- edited client totals do not alter canonical state and make the run
  leaderboard-ineligible when appropriate;
- network failure does not itself affect eligibility;
- closing before a boundary restores the start of the unresolved room;
- the latency message appears only when the existing transition is outlasted;
- ordinary portal, extraction, and death presentation remain unchanged when
  the checkpoint is fast.

Because implementation crosses the browser Ranked adapter, shared protocol,
Worker/domain settlement, recovery, and visible Ranked transitions, its plan
must include the focused domain/protocol tests, the exact affected current-tree
Ranked browser scenarios, phase verification, and baseline verification
required by the repository instructions. Release, ruleset activation, D1
changes, push, and deployment require separate explicit authorization.
