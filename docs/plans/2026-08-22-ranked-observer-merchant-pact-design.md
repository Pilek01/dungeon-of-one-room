# Ranked Observer Merchant and Pact Repair Design

## Goal

Repair two Ranked Observer Bot defects without weakening server authority: canonical Merchant skill purchases must be reachable, and Pact rooms must settle rewards before a canonical Pact choice is applied.

## Selected architecture

Merchant remains a Pages/runtime-only repair. In Ranked, the bot opens the existing canonical Merchant offer before attempting a purchase, waits while the request is in flight, and treats a missing canonical choice as failure rather than a purchase. Practice and human Merchant controls keep their existing paths.

Pact uses a new versioned ruleset capability. On a Pact-room checkpoint, the Worker settles the room with the build that was active during that room. It consumes the completed directive, increments the revision, and creates a post-room Pact offer bound to the completed directive and post-settlement state while withholding the next room directive. Applying, replacing, breaking, or leaving the Pact offer clears the offer and only then issues the next directive. The client reconciles local Pact IDs and direct combat-stat effects exclusively from the accepted canonical projection.

Existing ruleset hashes remain registered and retain their exact behavior. Pages fails closed for an old pinned run: its dormant Pact altar is not targeted by the Observer Bot and cannot invoke local Ranked Pact mutation. New runs use the new capability and complete the canonical post-room flow.

## State and security boundaries

- The server remains the only authority for Pact candidates, actions, build mutation, revision advancement, and the next room directive.
- Reward claims are settled before the Pact mutation, preventing Avarice or another Pact from retroactively changing the completed room.
- Offers remain opaque and revision-bound; clients submit only `transactionId` and `choiceId`.
- A pending post-room Pact offer blocks checkpoint replay and next-room issuance.
- Retry/idempotency semantics remain enforced by the existing event and meta-transaction receipts.
- Practice never enters this bridge and retains the native local Pact system.
- `observer_bot` assistance eligibility remains unchanged; no leaderboard, reward-bound, integrity, or anti-cheat tolerance is relaxed.

## Client flow

1. Ranked Pact room clears and the local summary remains pending.
2. Portal/checkpoint submits the room boundary.
3. A capable new ruleset returns a canonical Pact offer instead of the next room.
4. A human sees Pact choices; the Observer Bot selects a stable available opaque choice.
5. The commit response becomes the sole source for local Pact/effect reconciliation.
6. The response contains the next directive and normal room entry resumes.

For an older ruleset, the bot skips the dormant local altar and proceeds to the portal. No local Ranked Pact prompt or effect is allowed.

## Error handling

Network or canonical validation failures preserve recovery and keep the boundary blocked. A missing Merchant offer cannot increment the bot purchase counter. A missing or stale Pact offer cannot create local effects. Reconnect/resume must re-present a pending post-room Pact offer or the already-issued next directive from canonical state.

## Verification

- RED/GREEN tests for Merchant open-before-action, pending-request lock, and false success.
- Domain/HTTP tests for settle-before-Pact, no retroactive Avarice, apply/replace/break/leave, replay, stale revisions, reconnect, and old-hash retention.
- Client/runtime tests for human and Observer Bot offer handling, old-hash fail-closed behavior, and Pact effect reconciliation.
- Full guard, phase, release, Pages build, syntax, and headed browser-game checks.
- Production canary and post-deploy JSON/API, ruleset availability, asset-byte, console, and gameplay smoke checks.

