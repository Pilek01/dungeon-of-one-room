# Observer Bot Online Offer Synchronization Design

## Goal

Keep the password-gated Ranked Observer Bot autonomous without allowing its
local gameplay loop to race canonical Online v3 offers, checkpoint mutations,
or portal entry.

## Scope

The change covers Ranked Observer Bot handling for Forge, relic offers, relic
replacement, and generic meta-transaction offers. Practice behavior, ordinary
player-controlled Ranked behavior, Worker rules, protocol schemas, gameplay,
and production configuration remain unchanged.

## Design

The Ranked runtime owns canonical offer resolution. It will track whether the
test bot is enabled and whether an automated Online v3 action is in flight.
When a canonical offer is presented while the bot is active, the runtime will
choose one legal public option deterministically and submit it through the
existing client mutation methods. It will never synthesize transaction IDs,
gold, relics, build state, or checkpoint state.

The game bridge will expose a read-only `isRankedAutomationBlocked()` query.
The Observer Bot loop will return without moving while the Ranked runtime is
processing an offer, checkpoint, recovery transition, or other canonical
boundary. Portal movement resumes only after the runtime has installed the
next server-issued directive.

Forge preserves the operation already chosen by the local bot. Relic and meta
offers select from legal public choices using a stable ordering. Replacement
uses a stable legal candidate. The policy is intentionally deterministic and
minimal; it is test automation, not a new gameplay strategy.

## Error handling

An Online v3 request or validation failure stops automated progress and leaves
the existing recovery UI in control. Automation does not abandon a run,
invent a retry operation, bypass the mutation lock, or loop indefinitely.
Existing exact-retry and canonical resync behavior remains authoritative.

## Verification

Focused regressions must prove that automation waits at a canonical boundary,
submits only legal server-issued choices, resolves Forge before checkpointing,
and enters the portal only after `onlineV3NextDirective` exists. Coverage also
includes relic, replacement, and generic meta offers plus error-state blocking.
The visible Ranked lifecycle scenario must complete without the portal warning
or unexpected console/page errors.
