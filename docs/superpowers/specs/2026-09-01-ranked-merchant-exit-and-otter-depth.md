# Ranked Merchant Exit And Otter Depth Design

## Goal

Prevent Ranked Merchant rooms from stalling or crossing a checkpoint with an
unresolved Merchant offer, while preserving the player's ability to reopen the
Merchant until the room is actually left. Make Otter relic eligibility use the
real room depth and reserve `scalingDepth` for reward strength.

## Player-visible contract

- Closing the Merchant UI does not consume the canonical leave choice and does
  not complete the room.
- A player may reopen the Merchant any number of times while still on the same
  depth. Confirmed purchases remain canonical and the refreshed offer is shown.
- Entering the portal, normal extraction, and emergency extraction from a
  Merchant room all settle the Merchant before leaving the depth.
- A deterministic purchase rejection keeps the player in the Merchant room.
- An uncertain purchase or leave result is recovered by canonical resync and
  exact-operation retry; it never advances on an unproven result.

## Merchant exit coordinator

The Ranked browser runtime owns one single-flight exit intent per Merchant
directive. The intent records the directive ID and destination (`portal`,
`normal_extract`, or `emergency_extract`) and exposes one shared promise to all
duplicate callers.

The coordinator performs this order:

1. Verify that the intent still belongs to the active Merchant directive.
2. Await the active Merchant mutation promise, including its existing
   resync/adoption path.
3. Read the refreshed canonical snapshot.
4. If a same-room Merchant offer exists, commit its exact leave choice once.
5. Prove that no Merchant offer remains attached to the directive.
6. Capture the room boundary once and checkpoint it once.
7. Enter the next directive for `portal`, or request the selected extraction
   after the checkpoint for either extraction mode.

Duplicate portal interactions and duplicate extraction callbacks reuse the
same flight. A failed flight clears only the coordinator, preserves the room,
and surfaces the existing recovery UI.

## Worker invariant

A new ruleset capability, `merchantExitBarrier: "v1"`, makes both checkpoint
and extraction fail closed with `MERCHANT_ROOM_TRANSACTION_PENDING` whenever
`pendingInventory.sourceType === "merchant"` is still bound to the current
Merchant directive. The check runs before room consumption or extraction state
mutation. Old release descriptors do not receive the capability.

The client coordinator is the normal path; the Worker invariant is a final
defense preventing a future client regression from persisting a stale Merchant
offer against the next directive.

## Otter eligibility and scaling

Otter reward slot issuance and offer issuance share one pure eligibility
predicate based on:

- `directive.depth` for minimum/maximum depth and excluded boss intervals;
- actual room type/category for source eligibility.

The offer's rarity selection receives
`max(directive.depth, specialRoomPayload.scalingDepth)` as the scaling depth.
Therefore an Otter room at depth 23 with scaling depth 25 is eligible and may
scale rewards as depth 25, while an actual room at depth 25 remains ineligible.

## Compatibility and release state

- Existing ruleset hashes remain registered with their existing capabilities.
- The corrected ruleset gets a new generated manifest hash and a new candidate
  release descriptor/binding.
- No D1 schema change or migration is required.
- Production activation, push, and deployment are outside this task unless the
  user explicitly authorizes them later.

## Required regression coverage

- Purchase followed immediately by portal waits, leaves once, checkpoints once,
  and enters the next directive once.
- Purchase followed immediately by normal or emergency extraction follows the
  same ordering and never installs a next room locally.
- Duplicate leave/portal/extract callbacks share one operation.
- Closing and reopening the Merchant does not consume leave.
- Worker checkpoint and extraction reject an unresolved Merchant offer when the
  capability is enabled and retain legacy behavior without it.
- Otter depth 23 with scaling depth 25 issues a deterministic offer.
- Actual Otter depth 25 is excluded; scaling changes rarity only.
