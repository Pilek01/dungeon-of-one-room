# Ranked Fatal Worker Compatibility Design

Status: Approved in chat on 2026-08-11.

## Root cause

Production Pages at `f67eb9554a1395d8399e23fda6094c6e22d7305d` send an optional
`presentationCause` on `report_fatal_event`. Production Worker version
`19b9174c-f720-4484-8f7b-c0918215c29b` predates that request field and rejects
the death mutation. Commit `28f86a7` introduced the field together with a new
candidate ruleset hash, but `9cfcf6b` restored the browser binding to active
production hash `bc0d...` without reverting the payload.

Retaining the field under `bc0d...` is not omission-equivalent: it changes
`lifeLedger.history`, canonical JSON, the state digest, signed checkpoint token,
persisted D1 state, and finalized leaderboard summary. Rejecting it is also not
rolling-compatible because already-loaded f67 clients continue sending it.

## Compatibility contract

The Worker release descriptor is the semantic boundary.

- Every existing production descriptor accepts both cause-bearing and
  cause-free fatal requests.
- A supplied cause is validated with the same bounded normalization used by
  the current life policy.
- Existing production descriptors strip the validated field before invoking
  the ruleset, preserving exact legacy canonical semantics.
- Only a local/new explicitly capable descriptor may retain and project the
  cause. No new production hash is activated in this release.
- The original HTTP request remains the idempotency input. Cause-bearing and
  cause-free bodies using the same operation identity remain conflicting
  requests even though their canonical transitions are equivalent.

## Release topology

The release is Worker-only and is built from exact parent
`f67eb9554a1395d8399e23fda6094c6e22d7305d`. Local `main`, the prior f31
candidate, Pages, browser code, visual receipts, mobile-v1, D1 migrations, and
production ruleset activation are excluded.

Known fatal request validation errors map explicitly to HTTP 422. Unknown or
future internal `FATAL_*` failures continue to map to HTTP 500.

## Verification and rollout

Focused tests must prove old and cause-free payloads, elixir usage, resume,
strip-vs-omit equality for canonical state/digest/token/final summary,
idempotency behavior, all retained production hashes, and explicit error
mapping. Release verification runs fresh from the exact clean candidate SHA.

The Worker is uploaded as an inactive version. After exact version metadata and
override smoke pass, traffic progresses through a controlled canary. The
rollback target remains Worker version
`19b9174c-f720-4484-8f7b-c0918215c29b`. No D1 restore accompanies rollback.
